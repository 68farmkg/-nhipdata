// Dựng bảng 29 chỉ số (điểm, hiệu suất, KL, GT, khối ngoại ròng, thỏa thuận, vốn hóa) -> data/indices.json
// Mỗi bước tự ghi nguồn nào sống/chết vào data/indices-status.json. KHÔNG tự điền số: thiếu thì để null và nói lý do.
import fs from 'node:fs';
import { INDICES, SECTORS, ALIAS, sectorOf, membersOf, aggregate, perf, toDong } from './indices-lib.mjs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const B = 'https://trading.vietcap.com.vn', VH = { Origin: B, Referer: B + '/', 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const status = { at: new Date().toISOString(), listing: {}, board: {}, groups: {}, levels: {}, pt: {}, sectorFit: {}, icb: {} };
const num = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
async function http(url, opt = {}, ms = 25000, tries = 3) {
  let last = 'không kết nối được';
  for (let t = 0; t < tries; t++) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { ...opt, signal: ctl.signal });
      if (r.status === 429 || r.status >= 500) { last = 'HTTP ' + r.status; await sleep(1500 * (t + 1)); continue; }
      if (!r.ok) return { err: 'HTTP ' + r.status };
      return { json: await r.json() };
    } catch (e) { last = String(e && e.message || e).slice(0, 80); await sleep(1000 * (t + 1)); } finally { clearTimeout(to); }
  }
  return { err: last };
}
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
const g = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

/* ---------- 1. Danh sách mã (Vietcap getAll) ---------- */
const exOf = { HSX: 'HOSE', HOSE: 'HOSE', HNX: 'HNX', UPCOM: 'UPCOM' };
const la = await http(B + '/api/price/symbols/getAll', { headers: VH });
let all = la.json ? (Array.isArray(la.json) ? la.json : la.json.data || []) : [];
const exBy = {}; for (const x of all) if (x && x.type === 'STOCK' && exOf[x.board] && /^[A-Z0-9]{2,5}$/.test(String(x.symbol))) exBy[x.symbol] = exOf[x.board];
const syms = Object.keys(exBy); status.listing = { http: la.err || 'ok', n: syms.length };
if (syms.length < 1000) { status.error = 'Không lấy được danh sách mã — giữ file cũ'; fs.writeFileSync('data/indices-status.json', JSON.stringify(status)); console.log(status.error); process.exit(1); }

/* ---------- 2. Bảng giá (Vietcap getList): giá, số cổ phiếu, mã ngành, khớp, khối ngoại ---------- */
const chunks = []; for (let i = 0; i < syms.length; i += 100) chunks.push(syms.slice(i, i + 100));
const parts = await pool(chunks, 6, async ch => (await http(B + '/api/price/symbols/getList', { method: 'POST', headers: VH, body: JSON.stringify({ symbols: ch }) }, 25000, 3)));
status.board = { chunks: chunks.length, failed: parts.filter(p => !p.json).length, firstErr: (parts.find(p => p.err) || {}).err || null };
const rows = [];
for (const p of parts) for (const it of (Array.isArray(p.json) ? p.json : (p.json && p.json.data) || [])) {
  const s = String(g(it, 'listingInfo.symbol') || g(it, 'matchPrice.symbol') || '').toUpperCase(), ex = exBy[s]; if (!ex) continue;
  const price0 = num(g(it, 'matchPrice.matchPrice')), ref = num(g(it, 'listingInfo.refPrice')), price = price0 > 0 ? price0 : ref, sh = num(g(it, 'listingInfo.listedShare'));
  const tq = num(g(it, 'matchPrice.accumulatedVolume')), tvRaw = num(g(it, 'matchPrice.accumulatedValue')), icb = g(it, 'listingInfo.icbCode2') || g(it, 'matchPrice.icbCode2');
  rows.push({ s, ex, price, ref, sh, icb: icb == null ? null : String(icb), sec: sectorOf(icb), cap: price > 0 && sh > 0 ? price * sh : null, tq, tv: tvRaw > 0 ? toDong(tvRaw, price, tq) : tvRaw,
    bq: num(g(it, 'matchPrice.foreignBuyVolume')), sq: num(g(it, 'matchPrice.foreignSellVolume')), bv: num(g(it, 'matchPrice.foreignBuyValue')), sv: num(g(it, 'matchPrice.foreignSellValue')), pq: null, pv: null });
}
status.board.rows = rows.length; status.board.withShares = rows.filter(r => r.sh > 0).length; status.board.withIcb = rows.filter(r => r.icb).length;
for (const r of rows) if (r.icb) status.icb[r.icb] = (status.icb[r.icb] || 0) + 1;
status.board.icbUnmapped = Object.keys(status.icb).filter(k => !sectorOf(k)).slice(0, 20);
const rowMap = new Map(rows.map(r => [r.s, r]));

/* ---------- 3. Nhóm thành phần chính thức (Vietcap getByGroup), thử 2 máy chủ ---------- */
const GROUPS = { HOSE: 300, HNX: 150, UPCOM: 300, VN30: 25, VN100: 80, VNMidCap: 50, VNSmallCap: 100, VNAllShare: 200, HNX30: 25 };
const groups = {}, oldMem = rd('data/index-members.json', {});
for (const k of Object.keys(GROUPS)) {
  let got = null, tried = [];
  for (const host of ['https://mt.vietcap.com.vn', B]) {
    const r = await http(host + '/api/price/symbols/getByGroup?group=' + k, { headers: VH }, 20000, 2);
    const arr = Array.isArray(r.json) ? r.json : (r.json && (r.json.data || r.json.symbols)) || [];
    const l = arr.map(x => String(typeof x === 'string' ? x : (x && (x.symbol || x.ticker || x.code)) || '').toUpperCase()).filter(s => /^[A-Z0-9]{2,5}$/.test(s) && exBy[s]);
    tried.push(host.replace('https://', '') + ':' + (r.err || l.length));
    if (l.length >= GROUPS[k]) { got = [...new Set(l)]; break; }
  }
  if (got) groups[k] = got; else if (oldMem.groups && oldMem.groups[k]) { groups[k] = oldMem.groups[k]; tried.push('dùng bản cũ'); }
  status.groups[k] = { n: groups[k] ? groups[k].length : 0, tried };
}

/* ---------- 4. Điểm chỉ số + hiệu suất (VNDirect DChart, dự phòng Vietcap OHLC) ---------- */
const to = Math.floor(Date.now() / 1000), from = to - 430 * 86400;
const iso = t => new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 10);
async function levels(code) {
  for (const a of (ALIAS[code] || [code])) {
    const r = await http('https://dchart-api.vndirect.com.vn/dchart/history?' + new URLSearchParams({ symbol: a, resolution: 'D', from: String(from), to: String(to) }), { headers: { 'User-Agent': UA, Accept: 'application/json' } }, 20000, 2);
    const j = r.json; if (j && j.s === 'ok' && Array.isArray(j.t) && j.t.length > 5 && Array.isArray(j.c)) return { src: 'vndirect-dchart:' + a, t: j.t.map(Number), c: j.c.map(Number), v: (j.v || []).map(Number) };
    status.levels[code] = (status.levels[code] || '') + ' vnd[' + a + ']:' + (r.err || (j && j.s) || '?');
  }
  const r = await http(B + '/api/chart/OHLCChart/gap-chart', { method: 'POST', headers: VH, body: JSON.stringify({ timeFrame: 'ONE_DAY', symbols: [(ALIAS[code] || [code])[0]], countBack: 300, to }) }, 20000, 2);
  const x = Array.isArray(r.json) ? r.json[0] : null;
  if (x && Array.isArray(x.c) && Array.isArray(x.t) && x.c.length > 5) return { src: 'vietcap-ohlc', t: x.t.map(Number), c: x.c.map(Number), v: (x.v || []).map(Number) };
  status.levels[code] = (status.levels[code] || '') + ' vcap:' + (r.err || 'rỗng'); return null;
}
const lv = {}; await pool(INDICES.map(i => i[0]), 5, async code => { lv[code] = await levels(code); });
const vnTs = lv.VNINDEX && lv.VNINDEX.t.length ? lv.VNINDEX.t[lv.VNINDEX.t.length - 1] : null, day = vnTs ? iso(vnTs) : null;

/* ---------- 5. Thỏa thuận cuối phiên (VNDirect stock_prices: ptVolume/ptValue) ---------- */
if (day) {
  const want = syms, got = new Map();
  const bulk = await http('https://api-finfo.vndirect.com.vn/v4/stock_prices?q=' + encodeURIComponent('date:' + day) + '&size=4000&sort=code', { headers: { 'User-Agent': UA } }, 40000, 2);
  for (const x of (bulk.json && bulk.json.data) || []) if (x && x.code && String(x.date).slice(0, 10) === day) got.set(x.code, x);
  status.pt = { day, bulk: bulk.err || (bulk.json && bulk.json.data ? bulk.json.data.length : 0) };
  if (got.size < 500) {
    const miss = want.filter(s => !got.has(s));
    await pool(miss, 12, async s => { const r = await http('https://api-finfo.vndirect.com.vn/v4/stock_prices?q=' + encodeURIComponent('code:' + s + '~date:' + day) + '&size=1', { headers: { 'User-Agent': UA } }, 15000, 2); const x = r.json && r.json.data && r.json.data[0]; if (x) got.set(s, x); });
    status.pt.perCode = got.size;
  }
  let ratioN = 0, ratioSum = 0;
  for (const [s, x] of got) { const r = rowMap.get(s); if (!r) continue; r.pq = num(x.ptVolume); r.pv = num(x.ptValue); if (x.close > 0 && x.ptVolume > 0 && x.ptValue > 0) { ratioN++; ratioSum += x.ptValue / (x.close * x.ptVolume); } }
  status.pt.stocks = got.size; status.pt.valueToPriceQtyRatio = ratioN ? Math.round(ratioSum / ratioN * 1000) / 1000 : null;   // ≈1 hoặc ≈1000 => đơn vị đồng; ≈0.001 => nghìn đồng
  if (status.pt.valueToPriceQtyRatio && status.pt.valueToPriceQtyRatio < 0.01) for (const r of rows) if (r.pv != null) r.pv *= 1000;
}

/* ---------- 6. Ghép ---------- */
const man = rd('data/index-members-manual.json', {}), out = {}, members = {};
for (const [code, name, grp] of INDICES) {
  const L = lv[code], c = L ? L.c : [], d = L ? L.t.map(iso) : [], m = membersOf(code, groups, man, rows), ag = aggregate(m.list, rowMap), pf = L ? perf(c, d) : null;
  const last = L ? c[c.length - 1] : null, prev = L && c.length > 1 ? c[c.length - 2] : null;
  const lastDay = L ? d[d.length - 1] : null, stale = !!(day && lastDay && lastDay < day);
  out[code] = {
    name, grp, pts: last, chg: last != null && prev ? Math.round((last - prev) * 100) / 100 : null, pct: pf ? pf.d1 : null, perf: pf, spark: L ? c.slice(-60).map(x => Math.round(x * 100) / 100) : null,
    asOf: lastDay, stale, ptsSrc: L ? L.src : null, idxVol: L && L.v.length ? L.v[L.v.length - 1] : null,
    ...ag, memSrc: m.src, memNote: m.note, reasons: {
      ...(L ? {} : { pts: 'không nguồn nào trả điểm cho ' + code }),
      ...(m.src === 'thiếu' ? { flow: m.note } : {}),
      ...(ag.ptq == null && m.list.length ? { pt: 'chưa lấy được số thỏa thuận cuối phiên' } : {}),
    },
  };
  if (m.list.length && m.list.length <= 900) members[code] = m.list;
  if (L && ag.estPct != null && pf && pf.d1 != null) { const diff = Math.round((ag.estPct - pf.d1) * 100) / 100; out[code].fit = diff; if (SECTORS.includes(code) || m.src === 'ước tính') status.sectorFit[code] = diff; }
}
fs.mkdirSync('data', { recursive: true });
const withPts = Object.values(out).filter(x => x.pts != null).length;
status.withPts = withPts; status.day = day; status.ok = withPts >= 5;
fs.writeFileSync('data/indices-status.json', JSON.stringify(status));
if (!status.ok) { console.log('Quá ít chỉ số có điểm — giữ file cũ', withPts); process.exit(1); }
fs.writeFileSync('data/indices.json', JSON.stringify({ ok: true, built: new Date().toISOString(), day, units: { cap: 'đồng', gt: 'đồng', nnv: 'đồng', ptv: 'đồng', kl: 'cổ phiếu', nnq: 'cổ phiếu', ptq: 'cổ phiếu' }, note: 'KL/GT/khối ngoại/vốn hóa là TỔNG theo cổ phiếu thành phần (vốn hóa = giá × số cổ phiếu niêm yết, chưa điều chỉnh tỷ lệ tự do chuyển nhượng). Thỏa thuận là số cuối phiên gần nhất.', indices: out }));
fs.writeFileSync('data/index-members.json', JSON.stringify({ ok: true, built: new Date().toISOString(), groups, members }));
if (!fs.existsSync('data/index-members-manual.json')) fs.writeFileSync('data/index-members-manual.json', JSON.stringify({ _huong_dan: 'Dán danh sách mã cho chỉ số còn thiếu, vd "VNDIAMOND": ["ACB","FPT",...]. Lấy từ bảng thành phần trên hsx.vn.' }, null, 2));
console.log('Chỉ số có điểm:', withPts + '/' + INDICES.length, '| ngày', day, '| mã có số cổ phiếu', status.board.withShares);
