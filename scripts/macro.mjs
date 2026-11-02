// Dựng data/macro.json: FRED (CSV công khai) + World Bank (API công khai, không cần khóa).
// An toàn: chuỗi nào lỗi thì GIỮ NGUYÊN số cũ của chuỗi đó; hỏng quá nửa thì không ghi đè file.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (compatible; NHIP-DataBot/1.0; +https://github.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = 'data/macro.json', STAT = 'data/macro-status.json';
let old = {}; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { }
const status = { at: new Date().toISOString(), ok: false, fred: {}, wb: {} };

async function get(url, ms = 25000) {
  for (let t = 0; t < 3; t++) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctl.signal });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (t + 1)); continue; }
      if (!r.ok) return { err: 'HTTP ' + r.status };
      return { text: await r.text() };
    } catch (e) { await sleep(1000 * (t + 1)); } finally { clearTimeout(to); }
  }
  return { err: 'không kết nối được' };
}

/* ---------- FRED ---------- */
// kind: level = giữ nguyên | yoy = %/năm | mom = thay đổi so với kỳ trước | qoqa = tăng trưởng quý quy năm (%)
const FRED = [
  { id: 'DFEDTARU', n: 'Lãi suất mục tiêu Fed (cận trên)', u: '%', kind: 'level', g: 'Chính sách tiền tệ' },
  { id: 'DGS10', n: 'Lợi suất trái phiếu Mỹ 10 năm', u: '%', kind: 'level', g: 'Chính sách tiền tệ' },
  { id: 'DGS2', n: 'Lợi suất trái phiếu Mỹ 2 năm', u: '%', kind: 'level', g: 'Chính sách tiền tệ' },
  { id: 'T10Y2Y', n: 'Chênh lệch lợi suất 10 năm – 2 năm', u: 'điểm %', kind: 'level', g: 'Chính sách tiền tệ' },
  { id: 'CPIAUCSL', n: 'CPI Mỹ (so cùng kỳ)', u: '%', kind: 'yoy', g: 'Lạm phát' },
  { id: 'PCEPILFE', n: 'PCE lõi Mỹ (so cùng kỳ)', u: '%', kind: 'yoy', g: 'Lạm phát' },
  { id: 'UNRATE', n: 'Tỷ lệ thất nghiệp Mỹ', u: '%', kind: 'level', g: 'Việc làm' },
  { id: 'PAYEMS', n: 'Việc làm phi nông nghiệp Mỹ (thay đổi tháng)', u: 'nghìn người', kind: 'mom', g: 'Việc làm' },
  { id: 'ICSA', n: 'Trợ cấp thất nghiệp lần đầu (tuần)', u: 'người', kind: 'level', g: 'Việc làm' },
  { id: 'GDPC1', n: 'GDP thực Mỹ (quý, quy năm)', u: '%', kind: 'qoqa', g: 'Tăng trưởng' },
  { id: 'UMCSENT', n: 'Niềm tin người tiêu dùng (ĐH Michigan)', u: 'điểm', kind: 'level', g: 'Tăng trưởng' },
];
function parseCsv(t) {
  const rows = t.trim().split(/\r?\n/).slice(1).map(l => l.split(',')); const out = [];
  for (const [d, v] of rows) { const x = Number(v); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v !== '.' && v !== '' && isFinite(x)) out.push([d, x]); }
  return out;
}
function transform(kind, s) {
  if (kind === 'level') return s;
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (kind === 'yoy') { const lag = i - 12; if (lag >= 0) out.push([s[i][0], (s[i][1] / s[lag][1] - 1) * 100]); }
    else if (kind === 'mom') { if (i >= 1) out.push([s[i][0], s[i][1] - s[i - 1][1]]); }
    else if (kind === 'qoqa') { if (i >= 1) out.push([s[i][0], (Math.pow(s[i][1] / s[i - 1][1], 4) - 1) * 100]); }
  }
  return out;
}
const r2 = v => Math.round(v * 1000) / 1000;
const fred = {}; let fredOk = 0;
const start = new Date(Date.now() - 6 * 365 * 864e5).toISOString().slice(0, 10);
for (const f of FRED) {
  const r = await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + f.id + '&cosd=' + start);
  let s = r.text ? parseCsv(r.text) : [];
  if (!s.length) { status.fred[f.id] = r.err || 'rỗng'; if (old.fred && old.fred[f.id]) fred[f.id] = { ...old.fred[f.id], stale: true }; continue; }
  s = transform(f.kind, s); if (s.length < 2) { status.fred[f.id] = 'thiếu điểm'; continue; }
  const tail = s.slice(-24).map(([d, v]) => [d, r2(v)]);
  fred[f.id] = { n: f.n, u: f.u, g: f.g, kind: f.kind, last: tail[tail.length - 1], prev: tail[tail.length - 2], series: tail };
  status.fred[f.id] = 'ok'; fredOk++; await sleep(300);
}

/* ---------- World Bank ---------- */
const CTRY = ['VNM', 'USA', 'CHN', 'JPN', 'KOR', 'WLD'];
const WB = [
  { id: 'NY.GDP.MKTP.KD.ZG', n: 'Tăng trưởng GDP', u: '%/năm' },
  { id: 'FP.CPI.TOTL.ZG', n: 'Lạm phát (CPI)', u: '%/năm' },
  { id: 'SL.UEM.TOTL.ZS', n: 'Thất nghiệp (ước tính ILO)', u: '% lực lượng lao động' },
  { id: 'NY.GDP.PCAP.CD', n: 'GDP bình quân đầu người', u: 'USD' },
  { id: 'BX.KLT.DINV.WD.GD.ZS', n: 'FDI ròng vào / GDP', u: '% GDP' },
  { id: 'BN.CAB.XOKA.GD.ZS', n: 'Cán cân vãng lai / GDP', u: '% GDP' },
  { id: 'NE.EXP.GNFS.KD.ZG', n: 'Tăng trưởng xuất khẩu hàng hóa & dịch vụ', u: '%/năm' },
];
const wb = {}; let wbOk = 0;
for (const w of WB) {
  const r = await get('https://api.worldbank.org/v2/country/' + CTRY.join(';') + '/indicator/' + w.id + '?format=json&mrv=8&per_page=200');
  let j = null; try { j = JSON.parse(r.text || 'null'); } catch (e) { }
  const rows = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : [];
  const c = {};
  for (const x of rows) { if (x.value == null || !x.countryiso3code) continue; (c[x.countryiso3code] = c[x.countryiso3code] || []).push([String(x.date), r2(Number(x.value))]); }
  for (const k of Object.keys(c)) c[k].sort((a, b) => a[0] < b[0] ? -1 : 1);
  if (!Object.keys(c).length) { status.wb[w.id] = r.err || 'rỗng'; if (old.wb && old.wb[w.id]) wb[w.id] = { ...old.wb[w.id], stale: true }; continue; }
  wb[w.id] = { n: w.n, u: w.u, countries: c }; status.wb[w.id] = 'ok'; wbOk++; await sleep(300);
}

status.fredOk = fredOk; status.fredTotal = FRED.length; status.wbOk = wbOk; status.wbTotal = WB.length;
fs.mkdirSync('data', { recursive: true });
const bad = fredOk < FRED.length / 2 || wbOk < WB.length / 2;
if (bad) { status.error = 'Quá nhiều chuỗi lỗi — giữ nguyên macro.json cũ'; fs.writeFileSync(STAT, JSON.stringify(status)); console.log(status.error, JSON.stringify(status)); process.exit(1); }
const out = { ok: true, built: new Date().toISOString(), source: 'FRED (fredgraph.csv) + World Bank API qua GitHub Actions', note: 'PMI/ISM và số liệu tháng của Việt Nam (GSO) chưa có nguồn công khai miễn phí ổn định nên chưa đưa vào.', countries: CTRY, fred, wb };
fs.writeFileSync(OUT, JSON.stringify(out)); status.ok = true; fs.writeFileSync(STAT, JSON.stringify(status));
console.log('FRED', fredOk + '/' + FRED.length, '| WB', wbOk + '/' + WB.length);
