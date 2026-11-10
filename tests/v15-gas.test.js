import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const gs=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../public/seed.json',import.meta.url),'utf8'));
function mock(){
 const tables={classes:structuredClone(seed.classes),ppct:structuredClone(seed.ppct),changes:[],ppct_overrides:[],audit_log:[]};
 const ctxt={JSON,Date,String,Number,Array,Math,RegExp,Object,Set,Utilities:{getUuid:()=>`id-${tables.audit_log.length+1}`}};
 ctxt.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:(name)=>({
   getRange:(row)=>({setValues:(rows)=>{
      const cols=ctxt.TBL[name],values=rows[0];
      tables[name][row-2]=Object.fromEntries(cols.map((key,i)=>[key,values[i]]));
   }}),
   deleteRow:(row)=>{tables[name].splice(row-2,1);}
 })})};
 vm.createContext(ctxt);vm.runInContext(gs+'\nthis.TBL=TABLES;this.saveOfficialChange_=saveOfficialChange_;this.undoOfficialChange_=undoOfficialChange_;this.encode_=encode_;this.validateBatch_=validateBatch_;',ctxt);
 ctxt.read_=table=>structuredClone(tables[table]||[]);
 ctxt.appendBatch_=(table,records)=>{tables[table].push(...structuredClone(records));};
 // Rebind the function declarations to mocked in-context functions.
 vm.runInContext('read_=this.read_;appendBatch_=this.appendBatch_;',ctxt);
 return {tables,save:ctxt.saveOfficialChange_,undo:ctxt.undoOfficialChange_};
}
const row=(id='C-2026-11-09-C1')=>({id,date:'2026-11-09',shift:'C',period:1,action:'DONE',classId:'7F38',subject:'Toán',stream:'ĐS',kind:'MAIN',notes:'',ppctId:'M7-ĐS-21',completed:true,updatedAt:'',scope:'following',titleOverride:''});
test('V1.5 Apps Script saves audited change and undo keeps immutable audit trail',()=>{
 const ctx=mock();const r=ctx.save({row:row(),expectedUpdatedAt:'',reason:'Dạy xong'});
 assert.equal(r.ok,true);assert.equal(ctx.tables.changes.length,1);assert.equal(ctx.tables.audit_log.length,1);
 assert.equal(ctx.undo({id:'C-2026-11-09-C1'}).ok,true);
 assert.equal(ctx.tables.changes.length,0);assert.equal(ctx.tables.audit_log.length,2);
 assert.equal(ctx.tables.audit_log[1].action,'UNDO');
});
test('V1.5 Apps Script prevents stale writes, tampered class and wrong PPCT',()=>{
 const ctx=mock();ctx.save({row:row(),expectedUpdatedAt:''});
 assert.throws(()=>ctx.save({row:row(),expectedUpdatedAt:''}),/vừa được sửa/);
 const bad=row('x');bad.classId='9F43';assert.throws(()=>ctx.save({row:bad,expectedUpdatedAt:''}),/PPCT không thuộc/);
});
test('V1.5 stream rule and lesson correction undo together',()=>{
 const ctx=mock();const r=row();r.scope='future';const rule={id:'r1',classId:'7F38',subject:'Toán',fromDate:'2026-11-16',toDate:'',pattern:['ĐS','ĐS','HH','ĐS'],notes:'',updatedAt:'1'};
 ctx.save({row:r,expectedUpdatedAt:'',rule});assert.equal(ctx.tables.ppct_overrides.length,1);
 ctx.undo({id:r.id});assert.equal(ctx.tables.ppct_overrides.length,0);
});
