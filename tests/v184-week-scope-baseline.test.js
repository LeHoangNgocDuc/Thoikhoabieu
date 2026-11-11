import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {eventsForWeek,progressAt,ppctSequence,effectiveBaseline,normalizeSheetData} from '../src/core.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
const gas=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
const baseline=()=>structuredClone(seed.baselines.find(x=>x.classId==='9F43'&&x.stream==='ĐS'));
function fixture(){
 const tabs={baselines:structuredClone(seed.baselines),baseline_revisions:[],ppct:structuredClone(seed.ppct),classes:structuredClone(seed.classes),changes:structuredClone(seed.changes||[]),audit_log:[]};
 const sheet=name=>({
  getLastRow:()=>tabs[name].length+1,
  getRange:(first)=>({setValues:rows=>{for(let i=0;i<rows.length;i++){const obj=Object.fromEntries(c.TABLES[name].map((k,j)=>[k,rows[i][j]]));tabs[name][first+i-2]=obj;}}}),
  deleteRow:row=>tabs[name].splice(row-2,1)
 });
 const c={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:sheet}),flush:()=>{}},
  Utilities:{getUuid:()=> 'random-uuid',formatDate:d=>d.toISOString().slice(0,10)}};
 vm.createContext(c);vm.runInContext(gas+'\nthis.TABLES=TABLES;this.saveRevision=saveBaselineRevision_;',c);
 c.read_=name=>structuredClone(tabs[name]||[]).map(x=>name==='baselines'?{...x,confirmed:x.confirmed===true||String(x.confirmed)==='true',nextIndex:Number(x.nextIndex)}:x);
 c.appendBatch_=(name,rows)=>tabs[name].push(...structuredClone(rows));
 c.audit_=record=>tabs.audit_log.push(structuredClone(record));
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_;audit_=this.audit_;',c);
 return {tabs,c,state:()=>normalizeSheetData({...seed,...structuredClone(tabs)})};
}
function save(c,base,seq,n,week,expectedUpdatedAt=''){
 return c.saveRevision({baselineId:base.id,fromDate:week,nextIndex:n,ppctId:seq[n].id,expectedBaselineIndex:base.nextIndex,expectedUpdatedAt});
}
test('future week revision never changes earlier week TKB or earlier progress and keeps lesson titles read only',()=>{
 const {tabs,c,state}=fixture(),b=baseline(),cls='9F43',week='2026-11-16',prior='2026-11-09';
 const sequence=ppctSequence(state(),9,'Toán','ĐS',cls);
 const earlier=eventsForWeek(state(),prior).filter(e=>e.classId===cls&&e.stream==='ĐS').map(e=>[e.date,e.ppct?.id,e.ppct?.title]);
 const earlierProgress=progressAt(state(),cls,'Toán','ĐS','2026-11-15');
 const chosen=Math.min(sequence.length-1,b.nextIndex+6),originalPPCT=structuredClone(tabs.ppct);
 const result=save(c,b,sequence,chosen,week);assert.equal(result.verified,true);
 assert.equal(tabs.baselines.find(x=>x.id===b.id).nextIndex,b.nextIndex);
 assert.deepEqual(tabs.ppct,originalPPCT);
 assert.deepEqual(eventsForWeek(state(),prior).filter(e=>e.classId===cls&&e.stream==='ĐS').map(e=>[e.date,e.ppct?.id,e.ppct?.title]),earlier);
 assert.equal(progressAt(state(),cls,'Toán','ĐS','2026-11-15').actual,earlierProgress.actual);
 assert.equal(progressAt(state(),cls,'Toán','ĐS','2026-11-15').delta,earlierProgress.delta);
 const future=eventsForWeek(state(),week).filter(e=>e.classId===cls&&e.stream==='ĐS');
 assert.equal(future[0]?.ppct?.id,sequence[chosen].id);
 assert.equal(future[0]?.ppct?.title,sequence[chosen].title);
 assert.equal(effectiveBaseline(state(),cls,'Toán','ĐS',week).nextIndex,chosen);
 const other=eventsForWeek(state(),week).filter(e=>e.classId==='9F46'&&e.stream==='ĐS');
 assert.ok(other.length);assert.equal(tabs.baseline_revisions.length,1);
});
test('multiple future anchors take effect only from their own Mondays',()=>{
 const {tabs,c,state}=fixture(),b=baseline(),seq=ppctSequence(state(),9,'Toán','ĐS');
 save(c,b,seq,b.nextIndex+3,'2026-11-16');
 const mid=eventsForWeek(state(),'2026-11-16').filter(x=>x.classId===b.classId&&x.stream===b.stream).map(x=>x.ppct.id);
 save(c,b,seq,b.nextIndex+7,'2026-11-23');
 assert.deepEqual(eventsForWeek(state(),'2026-11-16').filter(x=>x.classId===b.classId&&x.stream===b.stream).map(x=>x.ppct.id),mid);
 assert.equal(eventsForWeek(state(),'2026-11-23').find(x=>x.classId===b.classId&&x.stream===b.stream).ppct.id,seq[b.nextIndex+7].id);
 assert.equal(tabs.baseline_revisions.length,2);
});
test('a saved week anchor retries safely and rejects stale updates and changes to confirmed lessons',()=>{
 const {tabs,c,state}=fixture(),b=baseline(),seq=ppctSequence(state(),9,'Toán','ĐS');
 const r=save(c,b,seq,b.nextIndex+2,'2026-11-16');
 assert.equal(save(c,b,seq,b.nextIndex+2,'2026-11-16').alreadySaved,true);
 assert.throws(()=>save(c,b,seq,b.nextIndex+4,'2026-11-16'),/thiết bị khác/);
 tabs.changes.push({id:'DONE-A',date:'2026-11-17',classId:b.classId,subject:b.subject,stream:b.stream,kind:'MAIN',action:'DONE',completed:true,ppctId:seq[b.nextIndex+2].id});
 assert.throws(()=>save(c,b,seq,b.nextIndex+4,'2026-11-16',tabs.baseline_revisions[0].updatedAt),/Đã có 1 tiết xác nhận/);
 assert.equal(tabs.baseline_revisions[0].nextIndex,b.nextIndex+2);
});
test('reject non-Mondays and weeks earlier than historical starting point',()=>{
 const {c,state}=fixture(),b=baseline(),seq=ppctSequence(state(),9,'Toán','ĐS');
 assert.throws(()=>save(c,b,seq,b.nextIndex,'2026-11-17'),/Thứ Hai/);
 assert.throws(()=>save(c,b,seq,b.nextIndex,'2026-11-02'),/trước ngày bắt đầu/);
});
test('source form cannot edit lesson names and only the save action writes an anchor',()=>{
 const ui=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(ui,/Nội dung bài từ PPCT & tiến độ \(chỉ xem\)/);
 assert.doesNotMatch(ui,/id="base-title-/);
 assert.match(ui,/op:'saveBaselineRevision'/);
 assert.match(ui,/Never change \$state\.data, PPCT catalog, baseline or Google Sheets on select/);
});
test('fresh reload and read-only cache both retain week anchors',async()=>{
 const {tabs,c,state}=fixture(),b=baseline(),seq=ppctSequence(state(),9,'Toán','ĐS');
 save(c,b,seq,b.nextIndex+3,'2026-11-16');
 const reloaded=normalizeSheetData(JSON.parse(JSON.stringify(state())));
 assert.equal(reloaded.baseline_revisions.length,1);
 assert.equal(eventsForWeek(reloaded,'2026-11-16').find(x=>x.classId===b.classId&&x.stream==='ĐS').ppct.id,seq[b.nextIndex+3].id);
 const {snapshotText,validateSnapshot}=await import('../src/cache.js');
 const cache=validateSnapshot(snapshotText(reloaded));
 assert.equal(cache.data.baseline_revisions[0].fromDate,'2026-11-16');
 const prior=validateSnapshot(snapshotText({...reloaded,baseline_revisions:undefined}));
 assert.deepEqual(prior.data.baseline_revisions,[]);
});
