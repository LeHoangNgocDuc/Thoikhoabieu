import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeSheetData,progressAt,progressSummary,ppctSequence,eventsForWeek,schoolWeek} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const fresh=()=>normalizeSheetData(structuredClone(seed));
const baseline=(d,classId,stream,subject='Toán')=>d.baselines.find(b=>b.classId===classId&&b.stream===stream&&b.subject===subject);

test('Google UTC timestamp at 17:00Z is the following Vietnam calendar day',()=>{
 const d=fresh();d.baselines.find(b=>b.classId==='9F43'&&b.stream==='TIN').fromDate='2026-11-08T17:00:00.000Z';
 assert.equal(normalizeSheetData(d).baselines.find(b=>b.classId==='9F43'&&b.stream==='TIN').fromDate,'2026-11-09');
});
test('mid-week PPCT target does not count lessons scheduled on later days',()=>{
 const d=fresh();const tuesday=progressAt(d,'9F43','Tin','TIN','2026-11-10');
 const wednesday=progressAt(d,'9F43','Tin','TIN','2026-11-11');
 const sunday=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 assert.equal(tuesday.planned,9);
 assert.equal(wednesday.planned,10);
 assert.equal(sunday.planned,10);
});
test('PPCT plan does not drop to zero during school breaks',()=>{
 const d=fresh();
 assert.equal(schoolWeek('2027-01-11'),0);
 assert.equal(progressAt(d,'9F43','Tin','TIN','2027-01-11').planned,18);
 assert.equal(progressAt(d,'9F43','Tin','TIN','2027-02-08').planned,21);
});
test('unconfirmed baseline refuses to report actual and delta, but displays the planned amount',()=>{
 const d=fresh(),r=progressAt(d,'7F38','Toán','ĐS','2026-11-15');
 assert.equal(r.status,'unconfirmed');assert.equal(r.actual,null);assert.equal(r.delta,null);assert.ok(r.planned>0);
});
test('confirmed initial position alone is insufficient when planned lessons are unmarked',()=>{
 const d=fresh(),b=baseline(d,'9F43','TIN','Tin');b.confirmed=true;b.nextIndex=9;
 const r=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 assert.equal(r.status,'partial');assert.equal(r.actual,9);assert.equal(r.delta,null);assert.equal(r.pending,1);
});
test('confirmed completed entry closes the only Tin 9/1 slot for that week',()=>{
 const d=fresh(),b=baseline(d,'9F43','TIN','Tin');b.confirmed=true;b.nextIndex=9;
 const e=eventsForWeek(d,'2026-11-09').find(x=>x.classId==='9F43'&&x.subject==='Tin');
 const id=ppctSequence(d,9,'Tin','TIN')[9].id;
 d.changes.push({id:'test-tin',date:e.date,shift:e.shift,period:e.period,action:'DONE',classId:'9F43',subject:'Tin',stream:'TIN',kind:'MAIN',ppctId:id,completed:true});
 const r=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 assert.equal(r.status,'ready');assert.equal(r.actual,10);assert.equal(r.pending,0);assert.equal(r.delta,r.actual-r.planned);
 // Same PPCT taught twice is never counted twice.
 d.changes.push({id:'makeup',date:'2026-11-13',shift:'C',period:3,action:'ADD',classId:'9F43',subject:'Tin',stream:'TIN',kind:'MAKEUP',ppctId:id,completed:true});
 assert.equal(progressAt(d,'9F43','Tin','TIN','2026-11-15').actual,10);
});
test('an explicit cancellation is known as not taught, not an unknown lesson',()=>{
 const d=fresh(),b=baseline(d,'9F43','TIN','Tin');b.confirmed=true;b.nextIndex=9;
 const e=eventsForWeek(d,'2026-11-09').find(x=>x.classId==='9F43'&&x.subject==='Tin');
 d.changes.push({id:'off',date:e.date,shift:e.shift,period:e.period,action:'OFF',classId:'9F43',subject:'Tin',stream:'TIN',kind:'MAIN',completed:false});
 const r=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 assert.equal(r.status,'ready');assert.equal(r.off,1);assert.equal(r.actual,9);assert.equal(r.delta,-1);
});
test('unlinked done change is flagged rather than accepted as complete stats',()=>{
 const d=fresh(),b=baseline(d,'9F43','TIN','Tin');b.confirmed=true;b.nextIndex=9;
 const e=eventsForWeek(d,'2026-11-09').find(x=>x.classId==='9F43'&&x.subject==='Tin');
 d.changes.push({id:'bad',date:e.date,shift:e.shift,period:e.period,action:'DONE',classId:'9F43',subject:'Tin',stream:'TIN',kind:'MAIN',ppctId:'UNKNOWN',completed:true});
 const r=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 assert.equal(r.status,'partial');assert.equal(r.unlinked,1);assert.equal(r.delta,null);
});
test('extra tutoring never counts toward official progress',()=>{
 const d=fresh(),b=baseline(d,'9F43','TIN','Tin');b.confirmed=true;b.nextIndex=9;
 const before=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 d.extra_patterns.push({id:'e',day:4,shift:'C',period:2,groups:['9F43'],fromDate:'2026-11-09',active:true,repeatRule:'weekly'});
 const after=progressAt(d,'9F43','Tin','TIN','2026-11-15');
 assert.equal(after.actual,before.actual);assert.equal(after.planned,before.planned);assert.equal(after.pending,before.pending);
});
test('progress summary covers every assigned class/mạch, not only baseline entries',()=>{
 const d=fresh();d.baselines=d.baselines.filter(b=>b.classId!=='9F44');
 const sum=progressSummary(d,'2026-11-15');
 assert.equal(sum.length,12);assert.equal(sum.find(x=>x.classId==='9F44').status,'unconfirmed');
});
