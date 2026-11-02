// Dựng data/announcements.json: thông báo/tin chính thức từ HOSE, HNX, UBCKNN.
// Mỗi nguồn: thử RSS/Atom; nếu là trang HTML thì lấy các liên kết có chữ dài. Ghi HTTP + số mục của TỪNG nguồn vào
// data/announcements-status.json -> chạy lần đầu xem nguồn nào sống, sửa mảng SOURCES bên dưới cho đúng địa chỉ thật.
// Nguồn "gnews:" là RSS Google News giới hạn theo tên miền (gián tiếp nhưng ổn định); nhãn trong app ghi rõ là gián tiếp.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const gn = d => 'https://news.google.com/rss/search?q=' + encodeURIComponent('site:' + d) + '+when:14d&hl=vi&gl=VN&ceid=VN:vi';
const SOURCES = [
  { id: 'hose-gn', org: 'HOSE', via: 'gián tiếp (Google News theo tên miền)', url: gn('hsx.vn') },
  { id: 'hnx-gn', org: 'HNX', via: 'gián tiếp (Google News theo tên miền)', url: gn('hnx.vn') },
  { id: 'ssc-gn', org: 'UBCKNN', via: 'gián tiếp (Google News theo tên miền)', url: gn('ssc.gov.vn') },
  { id: 'hose-site', org: 'HOSE', via: 'trực tiếp', url: 'https://www.hsx.vn/vi' , html: true },
  { id: 'hnx-site', org: 'HNX', via: 'trực tiếp', url: 'https://hnx.vn/vi-vn/', html: true },
  { id: 'ssc-site', org: 'UBCKNN', via: 'trực tiếp', url: 'https://ssc.gov.vn/', html: true },
];
const OUT = 'data/announcements.json', STAT = 'data/announcements-status.json', KEEP_DAYS = 14, MAX = 200;
let old = []; try { const o = JSON.parse(fs.readFileSync(OUT, 'utf8')); if (o && Array.isArray(o.items)) old = o.items; } catch (e) { }
const status = { at: new Date().toISOString(), sources: {} };
const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i')); return m ? dec(m[1]) : ''; };
async function get(url) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,*/*' }, signal: ctl.signal, redirect: 'follow' }); return { status: r.status, text: r.ok ? await r.text() : '' }; }
  catch (e) { return { status: 0, text: '' }; } finally { clearTimeout(to); }
}
function fromRss(x, s) {
  const out = [], re = /<(item|entry)\b[\s\S]*?<\/\1>/gi; let m;
  while ((m = re.exec(x))) {
    const b = m[0], title = tag(b, 'title'); let link = tag(b, 'link'); if (!link) { const h = b.match(/<link[^>]*href="([^"]+)"/i); link = h ? h[1] : ''; }
    const dt = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published'), t = Date.parse(dt);
    if (title && /^https?:\/\//.test(link)) out.push({ t: isFinite(t) ? t : null, title: title.replace(/\s+-\s+[^-]{2,40}$/, ''), link, org: s.org, src: s.id, via: s.via });
  }
  return out;
}
function fromHtml(x, s) {
  const out = [], seen = new Set(), re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi; let m; const base = new URL(s.url);
  while ((m = re.exec(x))) {
    const text = dec(m[2]); if (text.length < 30 || text.length > 300) continue;
    let link; try { link = new URL(m[1], base).href; } catch (e) { continue; }
    if (!/^https?:/.test(link) || seen.has(link)) continue; seen.add(link);
    out.push({ t: null, title: text, link, org: s.org, src: s.id, via: s.via });
  }
  return out.slice(0, 40);
}
let all = [], okSrc = 0;
for (const s of SOURCES) {
  const r = await get(s.url); let items = [];
  if (r.text) items = /<(rss|feed|rdf)\b/i.test(r.text) ? fromRss(r.text, s) : (s.html ? fromHtml(r.text, s) : []);
  status.sources[s.id] = { http: r.status, n: items.length, via: s.via }; if (items.length) okSrc++;
  all = all.concat(items);
}
const now = Date.now(), cut = now - KEEP_DAYS * 864e5, byLink = new Map();
for (const it of old) byLink.set(it.link, it);
for (const it of all) { const o = byLink.get(it.link); byLink.set(it.link, { ...it, t: it.t || (o && o.t) || now, first: (o && o.first) || now }); }
let items = [...byLink.values()].filter(x => (x.t || x.first || now) >= cut).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, MAX);
fs.mkdirSync('data', { recursive: true });
status.ok = okSrc > 0; status.okSources = okSrc; status.items = items.length;
fs.writeFileSync(STAT, JSON.stringify(status));
if (!okSrc) { console.log('Không nguồn nào trả mục nào — giữ announcements.json cũ', JSON.stringify(status)); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify({ ok: true, built: new Date().toISOString(), note: 'Nguồn trực tiếp là trang HTML của sàn/UBCKNN (liên kết có chữ dài); nguồn gián tiếp là Google News theo tên miền. Xem announcements-status.json để biết nguồn nào đang sống.', items }));
console.log('Nguồn sống:', okSrc + '/' + SOURCES.length, '| mục:', items.length);
