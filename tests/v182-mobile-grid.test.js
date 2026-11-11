import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MOBILE_PERIODS,canMergeTutorPair,collapseTutorDisplay,planMobileWeekCells} from '../src/mobileDisplay.js';
import {addDays} from '../src/core.js';

const dates=Array.from({length:7},(_,i)=>addDays('2026-11-09',i));
const extra=(date,shift,period,groups,opts={})=>({id:`${date}-${shift}${period}-${groups}`,kind:'EXTRA',subject:'Toán',date,shift,period,groups:[groups],lessonNumber:1,status:'PLANNED',...opts});
const official=(date,shift,period)=>({id:`${date}-${shift}${period}-official`,kind:'MAIN',subject:'Tin',date,shift,period,classId:'7F39'});
const at=(cells,date,shift,period)=>cells.filter(x=>x.date===date&&x.shift===shift&&x.period===period);

test('8-column x 13-row grid: seven headers plus twelve independent rows per day',()=>{
 assert.deepEqual(MOBILE_PERIODS.map(x=>x.label),['S1','S2','S3','S4','S5','C1','C2','C3','C4','C5','T1','T2']);
 const cells=planMobileWeekCells([],dates);
 assert.equal(cells.length,84);
 assert.equal(cells.filter(x=>x.shift==='T').length,14);
 assert.equal(cells.filter(x=>x.row===12).length,7);assert.equal(cells.filter(x=>x.row===13).length,7);
 assert.deepEqual(new Set(cells.map(x=>x.col)),new Set([2,3,4,5,6,7,8]));
});

test('morning/afternoon tutoring 2 periods collapse visually into one span-2 card, source remains unchanged',()=>{
 const rows=[extra(dates[0],'S',1,'9A_NC'),extra(dates[0],'S',2,'9A_NC'),extra(dates[1],'C',4,'8A_NC'),extra(dates[1],'C',5,'8A_NC')];
 const original=JSON.stringify(rows);
 const cells=planMobileWeekCells(rows,dates);
 assert.equal(cells.length,82);
 assert.equal(at(cells,dates[0],'S',1)[0].span,2);
 assert.equal(at(cells,dates[0],'S',2).length,0);
 assert.equal(at(cells,dates[1],'C',4)[0].span,2);
 assert.equal(at(cells,dates[1],'C',5).length,0);
 assert.equal(JSON.stringify(rows),original);
});

test('two evening classes T1 and T2 always remain independent, even when labels are equal',()=>{
 const rows=[extra(dates[0],'T',1,'11'),extra(dates[0],'T',2,'7A_NC')];
 let cells=planMobileWeekCells(rows,dates);
 assert.equal(at(cells,dates[0],'T',1)[0].span,1);
 assert.equal(at(cells,dates[0],'T',2)[0].span,1);
 assert.equal(cells.length,84);
 assert.equal(collapseTutorDisplay([extra(dates[0],'T',1,'11'),extra(dates[0],'T',2,'11')]).length,2);
});

test('never merge two different classes or different lessons',()=>{
 const first=extra(dates[0],'S',1,'9A_NC');
 assert.equal(canMergeTutorPair(first,extra(dates[0],'S',2,'9B_CB')),false);
 assert.equal(canMergeTutorPair(first,extra(dates[0],'S',2,'9A_NC',{lessonTitle:'Other'})),false);
 assert.equal(planMobileWeekCells([first,extra(dates[0],'S',2,'9B_CB')],dates).length,84);
});

test('slot collision blocks merging and retains every event for selection',()=>{
 const rows=[extra(dates[0],'S',1,'9A_NC'),extra(dates[0],'S',2,'9A_NC'),official(dates[0],'S',2)];
 const cells=planMobileWeekCells(rows,dates);
 assert.equal(cells.length,84);
 assert.equal(at(cells,dates[0],'S',1)[0].span,1);
 assert.equal(at(cells,dates[0],'S',2)[0].events.length,2);
 assert.equal(collapseTutorDisplay(rows).length,3);
});

test('phone UI exposes real CSS grid, full class labels, menu and distinct evening rows',()=>{
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(main,/mobileWeekBoard\(filtered,conflictKeys,page,allOfficial,allExtras\)/);
 assert.match(main,/data-action="cycle-calendar-view"/);
 assert.match(main,/data-action="toggle-drawer"/);
 assert.match(css,/grid-template-columns:28px repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-rows:26px repeat\(12,minmax\(0,1fr\)\)/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/overflow:hidden!important/);
 assert.doesNotMatch(main,/S\$\{esc\(p\)\} · B\$\{esc/);
});
