import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {progressAt,progressSummary,mathStreamPattern,eventsForWeek,ppctSequence,normalizeSheetData} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const state=()=>normalizeSheetData(structuredClone(seed));
test('V1.5 unconfirmed baselines never fabricate actual counts or pace',()=>{
 const data=state();const r=progressAt(data,'9F43','Toán','ĐS','2026-11-15');
 assert.equal(r.status,'unconfirmed');assert.equal(typeof r.actual,'number');assert.equal(typeof r.delta,'number');assert.equal(r.provisional,true);
});
test('V1.5 actual is distinct confirmed PPCT, not forecasted slots',()=>{
 const data=state();const b=data.baselines.find(x=>x.classId==='9F43'&&x.subject==='Toán'&&x.stream==='ĐS');
 b.confirmed=true;b.nextIndex=23;
 const date='2026-11-15';const seq=ppctSequence(data,9,'Toán','ĐS');
 const pre=progressAt(data,'9F43','Toán','ĐS',date);
 assert.equal(pre.actual,23);
 data.changes.push({id:'c1',date:'2026-11-10',shift:'S',period:4,classId:'9F43',subject:'Toán',stream:'ĐS',action:'DONE',ppctId:seq[23].id,completed:true});
 data.changes.push({id:'c2',date:'2026-11-11',shift:'S',period:1,classId:'9F43',subject:'Toán',stream:'ĐS',action:'ADD',ppctId:seq[23].id,completed:true});
 const now=progressAt(data,'9F43','Toán','ĐS',date);
 assert.equal(now.actual,24,'same PPCT counted once');assert.equal(now.status,'partial','Unconfirmed timetable lessons remain unknown');assert.equal(typeof now.delta,'number','Number is provisional until all teaching outcomes are confirmed');assert.equal(now.provisional,true);
 assert.equal(progressAt(data,'9F46','Toán','ĐS',date).status,'unconfirmed');
 assert.equal(progressAt(data,'9F43','Toán','HH',date).status,'unconfirmed');
});
test('V1.5 correction on a class changes its future projection but not another class or stream',()=>{
 const data=state();const week='2026-11-09';const first=eventsForWeek(data,week).find(e=>e.classId==='9F43'&&e.subject==='Toán'&&e.stream==='ĐS');
 assert.ok(first?.ppct);
 const after=ppctSequence(data,9,'Toán','ĐS').find((x,i,a)=>a[i-1]?.id===first.ppct.id);
 assert.ok(after);
 const other=eventsForWeek(data,'2026-11-16').filter(e=>e.classId==='9F46'&&e.subject==='Toán').map(e=>e.ppct?.id);
 const hh=eventsForWeek(data,'2026-11-16').filter(e=>e.classId==='9F43'&&e.stream==='HH').map(e=>e.ppct?.id);
 data.changes.push({id:'fix',date:first.date,shift:first.shift,period:first.period,classId:first.classId,subject:'Toán',stream:'ĐS',action:'EDIT',ppctId:after.id,completed:true,kind:'MAIN',scope:'following'});
 assert.deepEqual(eventsForWeek(data,'2026-11-16').filter(e=>e.classId==='9F46'&&e.subject==='Toán').map(e=>e.ppct?.id),other);
 assert.deepEqual(eventsForWeek(data,'2026-11-16').filter(e=>e.classId==='9F43'&&e.stream==='HH').map(e=>e.ppct?.id),hh);
 assert.equal(eventsForWeek(data,week).find(e=>e.changeId==='fix').ppct.id,after.id);
});
test('V1.5 weekly stream rules apply to only chosen class from effective date',()=>{
 const data=state();const week='2026-11-16';const before=eventsForWeek(data,week).filter(e=>e.classId==='7F38'&&e.subject==='Toán');
 assert.equal(before.length,4);
 const ds=before.filter(e=>e.stream==='ĐS').length,hh=before.length-ds;
 const pattern=ds===2&&hh===2?['HH','ĐS','HH','ĐS']:mathStreamPattern(ds,hh).slice().reverse();
 data.ppct_overrides=[{id:'r1',classId:'7F38',subject:'Toán',fromDate:week,toDate:'',pattern}];
 const after=eventsForWeek(data,week).filter(e=>e.classId==='7F38'&&e.subject==='Toán');
 assert.deepEqual(after.map(e=>e.stream),pattern);
 const other=eventsForWeek(data,week).filter(e=>e.classId==='9F43'&&e.subject==='Toán');
 assert.equal(other.length,4);
});
test('V1.5 finished record on different date counts only when <= report date',()=>{
 const data=state(),b=data.baselines.find(x=>x.classId==='7F38'&&x.stream==='ĐS');b.confirmed=true;
 const ppct=ppctSequence(data,7,'Toán','ĐS')[b.nextIndex];
 data.changes.push({id:'x',date:'2026-11-18',shift:'C',period:1,classId:'7F38',subject:'Toán',stream:'ĐS',action:'DONE',ppctId:ppct.id,completed:true});
 assert.equal(progressAt(data,'7F38','Toán','ĐS','2026-11-15').actual,b.nextIndex);
 assert.equal(progressAt(data,'7F38','Toán','ĐS','2026-11-22').actual,b.nextIndex+1);
});
test('V1.5 normalization loads new audit and overrides with old Sheets intact',()=>{
 const data=state();assert.deepEqual(data.ppct_overrides,[]);assert.deepEqual(data.audit_log,[]);
 const x=normalizeSheetData({...data,ppct_overrides:[{id:'rule',classId:'9F43',subject:'Toán',fromDate:'2026-11-16',pattern:'["ĐS","HH","ĐS","HH"]'}]});
 assert.deepEqual(x.ppct_overrides[0].pattern,['ĐS','HH','ĐS','HH']);
 assert.equal(x.slots.length,18);
});
test('V1.5 one-off unconfirmed correction changes display only, not upcoming pointer',()=>{
 const data=state(),date='2026-11-09';const before=eventsForWeek(data,date);
 const lesson=before.find(e=>e.classId==='9F43'&&e.stream==='ĐS');const seq=ppctSequence(data,9,'Toán','ĐS');
 const explicit=seq[seq.findIndex(p=>p.id===lesson.ppct.id)+3];
 const nextDate='2026-11-16',original=eventsForWeek(data,nextDate).filter(e=>e.classId==='9F43'&&e.stream==='ĐS').map(e=>e.ppct?.id);
 data.changes.push({id:'one',date:lesson.date,shift:lesson.shift,period:lesson.period,classId:'9F43',subject:'Toán',stream:'ĐS',action:'EDIT',kind:'MAIN',ppctId:explicit.id,completed:false,scope:'one',titleOverride:'Bài đã chỉnh'});
 const adjusted=eventsForWeek(data,date).find(e=>e.changeId==='one');assert.equal(adjusted.ppct.id,explicit.id);assert.equal(adjusted.ppct.title,'Bài đã chỉnh');
 assert.deepEqual(eventsForWeek(data,nextDate).filter(e=>e.classId==='9F43'&&e.stream==='ĐS').map(e=>e.ppct?.id),original);
});
