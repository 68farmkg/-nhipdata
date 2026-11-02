// Hàm thuần (không gọi mạng) cho bảng chỉ số: ngành ICB -> chỉ số ngành HOSE, định nghĩa thành phần, tổng hợp, hiệu suất.
export const INDICES = [
  // [mã, tên hiển thị, nhóm]
  ['VNINDEX', 'VN-Index', 'Thị trường'], ['VN30', 'VN30', 'Thị trường'], ['HNXINDEX', 'HNX-Index', 'Thị trường'], ['HNX30', 'HNX30', 'Thị trường'],
  ['UPCOMINDEX', 'UPCoM-Index', 'Thị trường'], ['VNXALL', 'VNX Allshare', 'Thị trường'], ['VNALL', 'VN Allshare', 'Thị trường'],
  ['VN100', 'VN100', 'Quy mô'], ['VNMID', 'VN Midcap', 'Quy mô'], ['VNSML', 'VN Smallcap', 'Quy mô'], ['VN50GROWTH', 'VN50 Growth', 'Quy mô'], ['VNX50', 'VNX50', 'Quy mô'],
  ['VNCOND', 'Tiêu dùng không thiết yếu', 'Ngành'], ['VNCONS', 'Tiêu dùng thiết yếu', 'Ngành'], ['VNENE', 'Năng lượng', 'Ngành'], ['VNFIN', 'Tài chính', 'Ngành'],
  ['VNHEAL', 'Y tế', 'Ngành'], ['VNIND', 'Công nghiệp', 'Ngành'], ['VNIT', 'Công nghệ thông tin', 'Ngành'], ['VNMAT', 'Nguyên vật liệu', 'Ngành'],
  ['VNREAL', 'Bất động sản', 'Ngành'], ['VNUTI', 'Tiện ích', 'Ngành'],
  ['VNDIAMOND', 'VN Diamond', 'Chuyên biệt'], ['VNDIVIDEND', 'VN Dividend', 'Chuyên biệt'], ['VNFINLEAD', 'VN Fin Lead', 'Chuyên biệt'], ['VNFINSELECT', 'VN Fin Select', 'Chuyên biệt'],
  ['VNSI', 'VNSI', 'Chuyên biệt'], ['VNMITECH', 'VN MITECH', 'Chuyên biệt'], ['VNSHINE', 'VN Shine', 'Chuyên biệt'],
];
export const SECTORS = ['VNCOND', 'VNCONS', 'VNENE', 'VNFIN', 'VNHEAL', 'VNIND', 'VNIT', 'VNMAT', 'VNREAL', 'VNUTI'];
// Tên khác của cùng một chỉ số ở từng nguồn giá (thử lần lượt).
export const ALIAS = { VNMID: ['VNMID', 'VNMIDCAP'], VNSML: ['VNSML', 'VNSMALLCAP'], VNALL: ['VNALL', 'VNALLSHARE'], HNXINDEX: ['HNXINDEX', 'HNX'], UPCOMINDEX: ['UPCOMINDEX', 'UPCOM'] };

// ICB (cả bản 2012 lẫn 2019) -> chỉ số ngành HOSE. ƯỚC TÍNH: phải đối chiếu với điểm chính thức (xem fit trong indices.json).
const S2012 = { '0500': 'VNENE', '1300': 'VNMAT', '1700': 'VNMAT', '2300': 'VNMAT', '2700': 'VNIND', '3300': 'VNCOND', '3500': 'VNCONS', '3700': 'VNCOND', '4500': 'VNHEAL', '5300': 'VNCOND', '5500': 'VNCOND', '5700': 'VNCOND', '6500': 'VNIT', '7500': 'VNUTI', '8300': 'VNFIN', '8500': 'VNFIN', '8600': 'VNREAL', '8700': 'VNFIN', '9500': 'VNIT' };
const S2019 = { '1010': 'VNIT', '1510': 'VNIT', '2010': 'VNHEAL', '3010': 'VNFIN', '3020': 'VNFIN', '3030': 'VNFIN', '3510': 'VNREAL', '4010': 'VNCOND', '4020': 'VNCOND', '4030': 'VNCOND', '4040': 'VNCOND', '4050': 'VNCOND', '4510': 'VNCONS', '4520': 'VNCONS', '5010': 'VNMAT', '5020': 'VNIND', '5510': 'VNMAT', '5520': 'VNMAT', '6010': 'VNENE', '6510': 'VNUTI' };
export function sectorOf(icb) {
  const c = String(icb == null ? '' : icb).replace(/\D/g, '');
  if (c.length < 4) return null;
  const c4 = c.slice(0, 4);
  if (S2019[c4]) return S2019[c4];
  if (S2012[c4]) return S2012[c4];
  if (c4[3] !== '0') {                       // mã cấp 4 kiểu ICB 2012 (vd 8355, 2357)
    if (c4 === '2357') return 'VNIND';
    if (c4 === '2353') return 'VNMAT';
    return S2012[c4.slice(0, 2) + '00'] || null;
  }
  return null;
}

// Cổ phiếu thành phần của từng chỉ số, từ: nhóm Vietcap (g), thủ công (man), hàng bảng giá (rows).
// Trả { list:[mã], src:'chính thức'|'ước tính'|'thủ công'|'thiếu', note }
export function membersOf(code, g, man, rows) {
  const by = ex => rows.filter(r => r.ex === ex).map(r => r.s);
  const grp = k => (g && Array.isArray(g[k]) && g[k].length ? g[k] : null);
  if (man && Array.isArray(man[code]) && man[code].length) return { list: man[code], src: 'thủ công', note: 'danh sách do bạn nhập' };
  const ok = (list, src, note) => ({ list, src, note: note || '' });
  switch (code) {
    case 'VNINDEX': return grp('HOSE') ? ok(grp('HOSE'), 'chính thức') : ok(by('HOSE'), 'ước tính', 'toàn bộ cổ phiếu HOSE');
    case 'VN30': return grp('VN30') ? ok(grp('VN30'), 'chính thức') : none('không lấy được nhóm VN30');
    case 'HNXINDEX': return grp('HNX') ? ok(grp('HNX'), 'chính thức') : ok(by('HNX'), 'ước tính', 'toàn bộ cổ phiếu HNX');
    case 'HNX30': return grp('HNX30') ? ok(grp('HNX30'), 'chính thức') : none('không lấy được nhóm HNX30');
    case 'UPCOMINDEX': return grp('UPCOM') ? ok(grp('UPCOM'), 'chính thức') : ok(by('UPCOM'), 'ước tính', 'toàn bộ cổ phiếu UPCoM');
    case 'VNXALL': return ok([...new Set([...(grp('HOSE') || by('HOSE')), ...(grp('HNX') || by('HNX'))])], 'ước tính', 'HOSE + HNX (VNX Allshare thực tế lọc theo tiêu chí riêng)');
    case 'VNALL': return grp('VNAllShare') ? ok(grp('VNAllShare'), 'chính thức') : ok(by('HOSE'), 'ước tính', 'toàn bộ HOSE');
    case 'VN100': return grp('VN100') ? ok(grp('VN100'), 'chính thức') : (grp('VN30') && grp('VNMidCap') ? ok([...grp('VN30'), ...grp('VNMidCap')], 'chính thức', 'VN30 + VNMidcap') : none('không lấy được nhóm VN100'));
    case 'VNMID': return grp('VNMidCap') ? ok(grp('VNMidCap'), 'chính thức') : none('không lấy được nhóm VNMidCap');
    case 'VNSML': return grp('VNSmallCap') ? ok(grp('VNSmallCap'), 'chính thức') : none('không lấy được nhóm VNSmallCap');
    case 'VNX50': {
      const top = rows.filter(r => (r.ex === 'HOSE' || r.ex === 'HNX') && r.cap > 0).sort((a, b) => b.cap - a.cap).slice(0, 50).map(r => r.s);
      return top.length === 50 ? ok(top, 'ước tính', '50 mã vốn hóa lớn nhất HOSE+HNX (chỉ số thật còn xét thanh khoản, tỷ lệ tự do chuyển nhượng)') : none('thiếu dữ liệu vốn hóa');
    }
    default:
      if (SECTORS.includes(code)) { const l = rows.filter(r => r.ex === 'HOSE' && r.sec === code).map(r => r.s); return l.length ? ok(l, 'ước tính', 'gom theo mã ngành ICB của Vietcap') : none('Vietcap không trả mã ngành'); }
      return none('chưa có nguồn thành phần — dán danh sách vào data/index-members-manual.json');
  }
  function none(note) { return { list: [], src: 'thiếu', note }; }
}

const sum = (a, f) => a.reduce((s, x) => s + (Number.isFinite(f(x)) ? f(x) : 0), 0);
// Tổng hợp theo danh sách mã. rows đã chuẩn hóa: s, price, ref, sh, tq, tv(đồng), bq, sq, bv, sv, pq, pv, cap
export function aggregate(list, rowMap) {
  const rs = list.map(s => rowMap.get(s)).filter(Boolean);
  const hasF = rs.some(r => r.bv != null || r.sv != null), hasP = rs.some(r => r.pq != null || r.pv != null);
  const capT = sum(rs, r => r.cap);
  let w = 0, wp = 0;
  for (const r of rs) if (r.cap > 0 && r.price > 0 && r.ref > 0) { wp += r.cap * (r.price / r.ref - 1) * 100; w += r.cap; }
  return {
    n: list.length, nHit: rs.length, cap: capT || null, kl: sum(rs, r => r.tq) || null, gt: sum(rs, r => r.tv) || null,
    nnq: hasF ? sum(rs, r => (r.bq || 0) - (r.sq || 0)) : null, nnv: hasF ? sum(rs, r => (r.bv || 0) - (r.sv || 0)) : null,
    ptq: hasP ? sum(rs, r => r.pq) : null, ptv: hasP ? sum(rs, r => r.pv) : null,
    estPct: w > 0 ? Math.round(wp / w * 100) / 100 : null,
  };
}

// Hiệu suất từ dãy đóng cửa theo ngày (cũ -> mới) + ngày (yyyy-mm-dd)
export function perf(c, d) {
  const n = c.length; if (n < 2) return null;
  const at = k => (n - 1 - k >= 0 ? c[n - 1 - k] : null), pc = k => (at(k) ? Math.round((c[n - 1] / at(k) - 1) * 10000) / 100 : null);
  const y = String(d[n - 1] || '').slice(0, 4); let first = null;
  for (let i = 0; i < n; i++) if (String(d[i]).slice(0, 4) === y) { first = i > 0 ? c[i - 1] : c[i]; break; }   // đóng cửa cuối năm trước
  return { d1: pc(1), w1: pc(5), m1: pc(21), m3: pc(63), y1: pc(250), ytd: first ? Math.round((c[n - 1] / first - 1) * 10000) / 100 : null };
}

// Đưa giá trị khớp lệnh về ĐỒNG: nguồn lúc trả triệu đồng, lúc trả đồng -> nhận biết theo tỷ lệ với giá×khối lượng
export function toDong(v, price, qty) {
  if (!(v > 0)) return v; const p = price > 0 ? price : 0, q = qty > 0 ? qty : 0;
  if (p > 0 && q > 0) { const r = v / (p * q); return r < 0.001 ? Math.round(v * 1e6) : v; }
  return v < 1e5 ? Math.round(v * 1e6) : v;
}
