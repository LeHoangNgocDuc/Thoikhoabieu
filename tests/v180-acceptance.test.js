import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EXTRA_CLASSES,addDays,eventsForWeek,conflicts,activeVersion,tutoringForRange,tutoringForWeek,normalizeSheetData,progressAt,applyStreamAssignments,previewMainOnce,previewMainRevision} from '../src/core.js';
import {extractTeacherScheduleFromSheets} from '../src/importExcel.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const books=JSON.parse(fs.readFileSync(new URL('./fixtures/teacher-workbooks.json',import.meta.url),'utf8'));
const sheets=books.map(x=>x.sheets.map(s=>({...s,rows:Object.entries(s.rows).reduce((a,[r,v])=>(a[Number(r)]=v,a),[])})));
function mockedGAS(){
 const tabs={classes:structuredClone(seed.classes),versions:structuredClone(seed.versions),slots:structuredClone(seed.slots),changes:[],audit_log:[],ppct_overrides:[]};
 let seq=0;
 const context={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,Utilities:{getUuid:()=>String(++seq).padStart(8,'0')+'-test',formatDate:d=>d.toISOString().slice(0,10)},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>({getLastRow:()=>tabs[name].length+1,getRange:(start,col,height,width)=>({setValues:vals=>{for(let i=0;i<vals.length;i++){const keys=context.TABLES[name];tabs[name][start-2+i]=Object.fromEntries(keys.map((k,j)=>[k,vals[i][j]]));}}}),deleteRow:row=>tabs[name].splice(row-2,1),deleteRows:(row,n)=>tabs[name].splice(row-2,n)})}),flush:()=>{}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8')+'\nthis.mutate=mutateMainSchedule_;this.TABLES=TABLES;',context);
 context.read_=name=>structuredClone(tabs[name]||[]);context.appendBatch_=(name,rows)=>{tabs[name]??=[];tabs[name].push(...structuredClone(rows));};context.audit_=row=>tabs.audit_log.push(structuredClone(row));
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_;audit_=this.audit_;',context);
 const state=()=>normalizeSheetData(structuredClone({...seed,...tabs}));
 let requestIndex=0;const request=(action,scope,sourceSlotId,patch,fromDate='2026-11-09')=>context.mutate({action,scope,sourceSlotId,patch,fromDate,expectedVersionId:activeVersion(state(),fromDate).id,requestId:`acceptance-12345678-${++requestIndex}`,reason:'kiểm thử 1.8'});
 return {state,tabs,request};
}
test('three real Excel fixtures: 4+8+6 lessons, correct days, one clean 18-lesson schedule',()=>{
 const results=sheets.map((s,i)=>extractTeacherScheduleFromSheets(s,books[i].file));
 assert.deepEqual(results.map(r=>r.slots.length),[4,8,6]);assert.deepEqual(results.map(r=>r.fromDate),['2026-11-09','2026-11-09','2026-11-09']);
 const all=results.flatMap(r=>r.slots);assert.equal(all.length,18);
 assert.equal(all.filter(x=>x.day===5&&x.shift==='S'&&x.period===3).length,1);
 assert.equal(all.find(x=>x.day===5&&x.shift==='S'&&x.period===3).classId,'7F39');
 assert.equal(all.find(x=>x.day===6&&x.shift==='S'&&x.period===3).classId,'9F43');
 const keys=all.map(x=>`${x.day}|${x.shift}|${x.period}`);assert.equal(new Set(keys).size,18);
});
test('two unique lesson ids never collide in the corrected source schedule',()=>{
 const e=eventsForWeek(seed,'2026-11-09');assert.equal(e.length,18);assert.equal(conflicts(e).length,0);
});
test('21 tutoring classes and two-week recurrence remain separate from PPCT',()=>{
 assert.equal(EXTRA_CLASSES.length,21);assert.equal(new Set(EXTRA_CLASSES).size,21);
 assert.equal(EXTRA_CLASSES[0],'6A');assert.equal(EXTRA_CLASSES.at(-1),'12C');
 const s=structuredClone(seed);
 s.extra_patterns=[{id:'extra-6a',day:7,shift:'S',period:1,subject:'Toán',groups:['6A'],startLesson:1,fromDate:'2026-11-09',active:true,repeatRule:'weekly'},
 {id:'extra-12c',day:8,shift:'T',period:2,subject:'Toán',groups:['12C'],startLesson:1,fromDate:'2026-11-09',active:true,repeatRule:'weekly'}];
 s.extra_sessions=[{id:'override',date:'2026-11-14',shift:'S',period:1,subject:'Toán',groups:['6A'],patternId:'extra-6a',action:'EDIT',teachingStatus:'DONE',completed:true,lessonNumber:1}];
 const items=tutoringForRange(s,'2026-11-09','2026-11-22');assert.equal(items.length,4);
 assert.equal(items.filter(x=>x.status==='DONE').length,1);
 const before=progressAt(seed,'7F38','Toán','ĐS','2026-11-14');
 const after=progressAt(s,'7F38','Toán','ĐS','2026-11-14');
 assert.equal(after.actual,before.actual);assert.equal(after.planned,before.planned);assert.equal(after.delta,before.delta);
});
test('teacher sets distinct 2D-2H and 3D-1H math distribution for selected class',()=>{
 const s=structuredClone(seed);
 s.ppct_overrides=[{id:'math7',classId:'7F38',subject:'Toán',fromDate:'2026-11-09',toDate:'',pattern:['ĐS','HH','ĐS','HH']}];
 const week=eventsForWeek(s,'2026-11-09');
 assert.deepEqual(week.filter(x=>x.classId==='7F38'&&x.subject==='Toán').map(x=>x.stream),['ĐS','HH','ĐS','HH']);
 s.ppct_overrides[0].pattern=['ĐS','ĐS','HH','ĐS'];
 const changed=eventsForWeek(s,'2026-11-09');
 assert.deepEqual(changed.filter(x=>x.classId==='7F38'&&x.subject==='Toán').map(x=>x.stream),['ĐS','ĐS','HH','ĐS']);
});
test('replaceSlot one-week replaces by a NEW ID and survives re-read; next week is original',()=>{
 const {request,state,tabs}=mockedGAS();const source=tabs.slots.find(x=>x.classId==='9F43'&&x.day===6&&x.period===3);
 const patch={day:6,shift:'S',period:3,classId:'7F39',subject:'Tin',stream:'TIN'};
 assert.ok(source);assert.doesNotThrow(()=>previewMainOnce(state(),{action:'REPLACE',sourceSlotId:source.id,fromDate:'2026-11-09',...patch}));
 const out=request('REPLACE','one',source.id,patch);assert.equal(out.verified,true);
 const now=eventsForWeek(state(),'2026-11-09').filter(x=>x.date==='2026-11-13'&&x.shift==='S'&&x.period===3);
 assert.equal(now.length,1);assert.equal(now[0].classId,'7F39');assert.notEqual(now[0].id,source.id);
 const next=eventsForWeek(state(),'2026-11-16').filter(x=>x.date==='2026-11-20'&&x.shift==='S'&&x.period===3);
 assert.equal(next.length,1);assert.equal(next[0].classId,'9F43');assert.equal(tabs.slots.length,18);
 // Backend row is still present after a fresh state read, analogous to F5.
 assert.equal(tabs.changes.filter(x=>x.action==='MAIN_REPLACE_ONCE').length,1);
});
test('replaceSlot future keeps older version immutable, changes next weeks, new id and durable version',()=>{
 const {request,state,tabs}=mockedGAS();const source=tabs.slots.find(x=>x.classId==='9F43'&&x.day===6&&x.period===3);
 const patch={day:6,shift:'S',period:3,classId:'7F39',subject:'Tin',stream:'TIN'};
 assert.doesNotThrow(()=>previewMainRevision(state(),{action:'REPLACE',sourceSlotId:source.id,fromDate:'2026-11-09',...patch}));
 const out=request('REPLACE','future',source.id,patch);assert.equal(out.verified,true);assert.equal(tabs.versions.length,2);
 assert.equal(tabs.slots.filter(x=>x.versionId===tabs.versions[0].id).length,18);
 const current=eventsForWeek(state(),'2026-11-09').find(x=>x.date==='2026-11-13'&&x.shift==='S'&&x.period===3);
 const following=eventsForWeek(state(),'2026-11-16').find(x=>x.date==='2026-11-20'&&x.shift==='S'&&x.period===3);
 assert.equal(current.id,out.sourceSlotId);assert.equal(following.id,out.sourceSlotId);assert.notEqual(out.sourceSlotId,source.id);
});
test('delete then add same slot in one week does not resurrect the old lesson; no loss of PPCT',()=>{
 const {request,state,tabs}=mockedGAS(),source=tabs.slots.find(x=>x.classId==='9F43'&&x.day===6&&x.period===3);
 const ppctOld=JSON.stringify(seed.ppct),baselineOld=JSON.stringify(seed.baselines);
 request('DELETE','one',source.id,null);
 const result=request('ADD','one','',{day:6,shift:'S',period:3,classId:'7F39',subject:'Tin',stream:'TIN'});
 assert.equal(result.verified,true);
 const now=eventsForWeek(state(),'2026-11-09').filter(x=>x.date==='2026-11-13'&&x.shift==='S'&&x.period===3);
 assert.equal(now.length,1);assert.equal(now[0].classId,'7F39');assert.notEqual(now[0].id,source.id);
 assert.equal(JSON.stringify(seed.ppct),ppctOld);assert.equal(JSON.stringify(seed.baselines),baselineOld);
});
test('remove replaced one-week lesson hides it without resurrecting previous source',()=>{
 const {request,state,tabs}=mockedGAS(),source=tabs.slots.find(x=>x.classId==='9F43'&&x.day===6&&x.period===3);
 const replacement=request('REPLACE','one',source.id,{day:6,shift:'S',period:3,classId:'7F39',subject:'Tin',stream:'TIN'});
 request('DELETE','one',replacement.changeId,null);
 assert.equal(eventsForWeek(state(),'2026-11-09').filter(x=>x.date==='2026-11-13'&&x.shift==='S'&&x.period===3).length,0);
 assert.equal(eventsForWeek(state(),'2026-11-16').filter(x=>x.date==='2026-11-20'&&x.shift==='S'&&x.period===3).length,1);
});
test('progress never hides actual/delta but marks missing baseline as provisional',()=>{
 const summary=progressAt(seed,'7F38','Toán','ĐS','2026-11-12');
 assert.equal(summary.status,'unconfirmed');assert.equal(typeof summary.actual,'number');assert.equal(typeof summary.delta,'number');assert.equal(summary.provisional,true);
});
