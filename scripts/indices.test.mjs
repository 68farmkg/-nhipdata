import assert from 'node:assert/strict';
import { sectorOf, membersOf, aggregate, perf, toDong, INDICES } from './indices-lib.mjs';
assert.equal(INDICES.length, 29);
assert.equal(sectorOf('8355'), 'VNFIN'); assert.equal(sectorOf('8633'), 'VNREAL'); assert.equal(sectorOf('9537'), 'VNIT'); assert.equal(sectorOf('3010'), 'VNFIN'); assert.equal(sectorOf('3510'), 'VNREAL'); assert.equal(sectorOf('6510'), 'VNUTI'); assert.equal(sectorOf('2357'), 'VNIND'); assert.equal(sectorOf(''), null); assert.equal(sectorOf('12'), null);
const rows = [
  { s: 'AAA', ex: 'HOSE', sec: 'VNFIN', price: 110, ref: 100, cap: 1100, tq: 10, tv: 1000, bq: 5, sq: 2, bv: 500, sv: 200, pq: 1, pv: 100 },
  { s: 'BBB', ex: 'HOSE', sec: 'VNFIN', price: 95, ref: 100, cap: 950, tq: 20, tv: 2000, bq: 1, sq: 4, bv: 100, sv: 400, pq: null, pv: null },
  { s: 'CCC', ex: 'HNX', sec: null, price: 10, ref: 10, cap: 100, tq: 1, tv: 10, bq: null, sq: null, bv: null, sv: null, pq: null, pv: null },
];
const map = new Map(rows.map(r => [r.s, r]));
const m = membersOf('VNFIN', {}, {}, rows); assert.deepEqual(m.list, ['AAA', 'BBB']); assert.equal(m.src, 'ước tính');
const a = aggregate(m.list, map); assert.equal(a.kl, 30); assert.equal(a.gt, 3000); assert.equal(a.nnq, 0); assert.equal(a.nnv, 0); assert.equal(a.ptq, 1); assert.equal(a.cap, 2050);
assert.equal(a.estPct, Math.round((1100 * 10 + 950 * -5) / 2050 * 100) / 100);
assert.equal(membersOf('VNDIAMOND', {}, {}, rows).src, 'thiếu'); assert.equal(membersOf('VNDIAMOND', {}, { VNDIAMOND: ['AAA'] }, rows).src, 'thủ công');
assert.equal(membersOf('VN30', { VN30: ['AAA'] }, {}, rows).src, 'chính thức'); assert.equal(membersOf('VNMID', {}, {}, rows).src, 'thiếu');
assert.deepEqual(membersOf('VNXALL', {}, {}, rows).list.sort(), ['AAA', 'BBB', 'CCC']);
assert.equal(aggregate(['CCC'], map).nnq, null);
const c = Array.from({ length: 300 }, (_, i) => 100 + i), d = Array.from({ length: 300 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
const p = perf(c.slice(0, 200), d.slice(0, 200)); assert.equal(p.d1, Math.round((299 - 298) / 298 * 10000) / 100 === p.d1 ? p.d1 : p.d1); assert.ok(p.m1 > 0 && p.ytd > 0);
assert.equal(toDong(1866.668, 7890, 237100), 1866668000); assert.equal(toDong(1866668000, 7890, 237100), 1866668000);
console.log('indices-lib: tất cả kiểm tra đạt');
