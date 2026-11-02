// Dựng data/symbols.json = danh sách ~1.500 mã 3 sàn từ Vietcap: { syms: [["FPT","HOSE"], ...] }
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const B = 'https://trading.vietcap.com.vn', sleep = ms => new Promise(r => setTimeout(r, ms));
let list = [];
for (let t = 0; t < 4 && !list.length; t++) {
  try { const r = await fetch(B + '/api/price/symbols/getAll', { headers: { Origin: B, Referer: B + '/', Accept: 'application/json', 'User-Agent': UA } }); if (r.ok) { const j = await r.json(); list = Array.isArray(j) ? j : (j && j.data) || []; } else console.log('HTTP', r.status); } catch (e) { }
  if (!list.length) await sleep(2000 * (t + 1));
}
const exOf = { HSX: 'HOSE', HOSE: 'HOSE', HNX: 'HNX', UPCOM: 'UPCOM' }, syms = [], seen = new Set();
for (const x of list) { const c = String(x && x.symbol || ''), f = exOf[x && x.board]; if (x && x.type === 'STOCK' && f && /^[A-Z0-9]{2,5}$/.test(c) && !seen.has(c)) { seen.add(c); syms.push([c, f]); } }
if (syms.length < 1000) { console.log('Chỉ có', syms.length, 'mã — giữ file cũ'); process.exit(1); }
syms.sort((a, b) => a[0] < b[0] ? -1 : 1);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/symbols.json', JSON.stringify({ ok: true, built: new Date().toISOString(), n: syms.length, syms }));
console.log('Số mã:', syms.length);
