import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collapseTutorDisplay} from '../src/mobileDisplay.js';
const event=(period,groups=['9A_NC'],extra={})=>({id:'e'+period,kind:'EXTRA',date:'2026-11-09',shift:'T',period,groups,subject:'Toán',lessonNumber:1,lessonTitle:'Phương trình',status:'PLANNED',...extra});
test('two consecutive representations of the same class collapse into a single display block',()=>{
 const rows=[event(1),event(2)],old=JSON.stringify(rows);
 const display=collapseTutorDisplay(rows);
 assert.equal(display.length,1);assert.equal(display[0].period,1);assert.equal(display[0].periodEnd,2);
 assert.deepEqual(display[0].displayMergedIds,['e1','e2']);assert.equal(JSON.stringify(rows),old,'source rows must stay immutable');
});
test('custom tutoring names are retained verbatim; distinct groups and lesson content never merge',()=>{
 assert.equal(collapseTutorDisplay([event(1,['9A_NC']),event(2,['9B_CB'])]).length,2);
 assert.equal(collapseTutorDisplay([event(1,['9A_NC']),event(2,['9A_NC'],{lessonTitle:'Đề luyện số 2'})]).length,2);
 assert.deepEqual(collapseTutorDisplay([event(1,['DT 2 Nhóm A']),event(2,['DT 2 Nhóm A'])])[0].groups,['DT 2 Nhóm A']);
});
test('independent lessons are preserved even when there is an official lesson in the same period',()=>{
 const rows=[event(1),event(2),{kind:'MAIN',date:'2026-11-09',shift:'T',period:2,classId:'7F38'}];
 const displayed=collapseTutorDisplay(rows);assert.equal(displayed.length,2);assert.ok(displayed.find(x=>x.kind==='MAIN'));
});
test('no merging across dates or shifts; no lost extras',()=>{
 assert.equal(collapseTutorDisplay([event(1),event(2,['9A_NC'],{date:'2026-11-10'})]).length,2);
 assert.equal(collapseTutorDisplay([event(1),event(2,['9A_NC'],{shift:'C'})]).length,2);
});
test('the mobile UX exposes the five progress columns and readable full groups',()=>{
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.ok(main.includes('mobile-stats-table'));assert.ok(main.includes('Lớp / Môn</th><th>Kế hoạch</th><th>Đã dạy</th><th>Nhanh / Chậm</th><th>Tiết tiếp theo'));
 assert.ok(main.includes('mobile-topline'));assert.ok(main.includes('drawer-stats-period'));assert.ok(main.includes('drawer-extra-grade'));
 assert.ok(main.includes('touchstart'));assert.ok(main.includes('touchend'));
 assert.ok(!main.includes('S${esc(p)} · B${esc(e.lessonNumber||1)}'));
 assert.ok(css.includes('.mobile-stats-scroller{display:block'));assert.ok(css.includes('.lesson.tutor .lesson-name'));
});
