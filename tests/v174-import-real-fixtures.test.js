import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractTeacherScheduleFromSheets} from '../src/importExcel.js';
import {eventsForWeek,conflicts} from '../src/core.js';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/teacher-workbooks.json',import.meta.url),'utf8'));
const converted=fixtures.map(x=>({file:x.file,sheets:x.sheets.map(s=>({...s,rows:Object.entries(s.rows).reduce((a,[r,v])=>(a[Number(r)]=v,a),[])}))}));
const parsed=converted.map(f=>extractTeacherScheduleFromSheets(f.sheets,f.file));
test('three uploaded Excel workbooks yield exactly 4+8+6 teacher lessons',()=>{
 assert.deepEqual(parsed.map(x=>x.slots.length),[4,8,6]);
 assert.deepEqual([...new Set(parsed.map(x=>x.fromDate))],['2026-11-09']);
});
test('Thursday morning period 3 retains only Tin 7/3 after teacher correction',()=>{
 const all=parsed.flatMap(x=>x.slots);
 assert.deepEqual(all.filter(x=>x.day===5&&x.shift==='S'&&x.period===3).map(x=>[x.classId,x.subject]),[['7F39','Tin']]);
});
test('Friday morning period 3 has Toan 9/1 and four Toan 9/1 lessons remain',()=>{
 const all=parsed.flatMap(x=>x.slots);
 assert.deepEqual(all.filter(x=>x.day===6&&x.shift==='S'&&x.period===3).map(x=>[x.classId,x.subject]),[['9F43','Toán']]);
 const p=all.filter(x=>x.classId==='9F43'&&x.subject==='Toán').map(x=>[x.day,x.period]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 assert.deepEqual(p,[[3,4],[5,4],[6,2],[6,3]]);
 assert.match(parsed[1].warnings.join(' '),/hiệu chỉnh/i);
});
test('all 18 lessons have expected shift, classes and no duplication',()=>{
 const all=parsed.flatMap(x=>x.slots),keys=new Set(all.map(x=>[x.day,x.shift,x.period,x.classId,x.subject].join('|')));
 assert.equal(all.length,keys.size);
 assert.equal(all.filter(x=>x.shift==='C'&&x.subject==='Toán').length,4);
 assert.equal(all.filter(x=>x.shift==='S'&&x.subject==='Toán').length,8);
 assert.equal(all.filter(x=>x.subject==='Tin').length,6);
});

test('corrected local seed has 18 official lessons and zero weekly conflicts',()=>{
 const seed=JSON.parse(readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
 const official=eventsForWeek(seed,'2026-11-09').filter(e=>e.kind!=='EXTRA');
 assert.equal(official.length,18);
 assert.equal(conflicts(official).length,0);
 assert.deepEqual(official.filter(e=>e.date==='2026-11-12'&&e.shift==='S'&&e.period===3).map(e=>e.classId),['7F39']);
 assert.deepEqual(official.filter(e=>e.date==='2026-11-13'&&e.shift==='S'&&e.period===3).map(e=>e.classId),['9F43']);
});
