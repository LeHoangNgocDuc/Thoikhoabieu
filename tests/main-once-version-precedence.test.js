import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleForDate,isMainOnceSuperseded} from '../src/core.js';
const week='2026-11-09',day='2026-11-12';
const base={id:'TIN73',versionId:'zzzz-TKB-2026-11-09-1794300000000-abcd',day:5,shift:'S',period:3,classId:'73',subject:'Tin',stream:'TIN'};
const state={versions:[{id:base.versionId,fromDate:week}],slots:[base],changes:[{id:'MAIN1-2026-11-09-TIN73',action:'MAIN_DELETE_ONCE',sourceSlotId:'TIN73',scope:'one',date:day,updatedAt:'2026-11-10T01:00:00.000Z'}]};
test('old week deletion cannot mask a later official revision in the same week',()=>{
 assert.equal(isMainOnceSuperseded(state.changes[0],state.versions[0],week),true);
 assert.equal(scheduleForDate(state,day).filter(x=>x.id==='TIN73').length,1);
});
test('a new week-only deletion after official revision remains effective',()=>{
 const newer={...state,changes:[{...state.changes[0],updatedAt:'2026-11-11T01:00:00.000Z'}]};
 assert.equal(scheduleForDate(newer,day).filter(x=>x.id==='TIN73').length,0);
});
test('week-only deletion remains effective for an earlier official version',()=>{
 const older={...state,versions:[{...state.versions[0],fromDate:'2026-11-02'}]};
 assert.equal(scheduleForDate(older,day).filter(x=>x.id==='TIN73').length,0);
});
