export const DAYS=[{n:2,label:'Thứ 2'},{n:3,label:'Thứ 3'},{n:4,label:'Thứ 4'},{n:5,label:'Thứ 5'},{n:6,label:'Thứ 6'},{n:7,label:'Thứ 7'},{n:8,label:'Chủ nhật'}];
export const SHIFTS=[{id:'S',label:'Sáng',count:5},{id:'C',label:'Chiều',count:5},{id:'T',label:'Tối',count:2}];
export const SLOT_KEY=(shift,period)=>`${shift}${period}`;
export const scheduleKey=(d,s,p)=>`${d}|${s}|${p}`;
export function parseDate(iso){return new Date(`${iso}T12:00:00`)}
export function isoDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
export function addDays(date,n){const d=parseDate(date);d.setDate(d.getDate()+n);return isoDate(d)}
export function monday(date){const d=parseDate(date),day=d.getDay();return addDays(date,-((day+6)%7))}
export function schoolWeek(date){
 const mon=monday(date), start=monday('2026-09-07');
 // The provided 2026-2027 PPCT skips the weeks beginning 11/01 and 08/02/2027.
 if(mon==='2027-01-11'||mon==='2027-02-08')return 0;
 let week=Math.floor((parseDate(mon)-parseDate(start))/(7*86400000))+1;
 if(mon>='2027-01-18')week-=1;
 if(mon>='2027-02-15')week-=1;
 return week;
}
export function classById(state,id){return (state.classes||[]).find(c=>c.id===id)}
// Google Sheets/App Script can serialize date and numeric cells differently from seed.json.
// Normalize at the data boundary AND tolerate old deployments that return numeric fields as strings.
export function normalizeSheetData(raw){
 const out={};for(const k of ['classes','versions','slots','ppct','baselines','changes','extra_sessions','extra_patterns','ppct_overrides','audit_log'])out[k]=Array.isArray(raw?.[k])?raw[k].map(x=>({...x})):[];
 const toIso=v=>{if(!v)return '';const str=String(v).trim();const iso=str.match(/^(\d{4}-\d{2}-\d{2})/);if(iso)return iso[1];const d=str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return d?`${d[3]}-${d[2]}-${d[1]}`:str;};
 out.classes.forEach(x=>{
  // Some existing Sheets cells like 7/2 were auto-detected as dates by Google Sheets.
  // Old Apps Script deployments sent their JS Date serialized as ISO timestamps.
  const knownNames={'7F38':'7/2','7F39':'7/3','9F43':'9/1','9F44':'9/2','9F46':'9/4','9F47':'9/5','9F48':'9/6'};
  if(x.name instanceof Date||/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(String(x.name||''))){x.name=knownNames[x.id]||x.id;}
  x.grade=Number(x.grade);if(typeof x.subjects==='string'){try{x.subjects=JSON.parse(x.subjects)}catch{x.subjects=[];}}if(!Array.isArray(x.subjects))x.subjects=[];});
 out.versions.forEach(x=>{x.fromDate=toIso(x.fromDate);x.toDate=toIso(x.toDate);});
 out.slots.forEach(x=>{x.day=Number(x.day);x.period=Number(x.period);x.shift=String(x.shift||'').trim().toUpperCase();x.versionId=String(x.versionId||'').trim();x.stream=String(x.stream||'');});
 out.ppct.forEach(x=>{x.grade=Number(x.grade);x.week=Number(x.week);x.period=Number(x.period);});
 out.baselines.forEach(x=>{x.fromDate=toIso(x.fromDate);x.nextIndex=Number(x.nextIndex);x.confirmed=x.confirmed===true||String(x.confirmed).toLowerCase()==='true';});
 out.changes.forEach(x=>{x.date=toIso(x.date);x.period=Number(x.period);x.completed=x.completed===true||String(x.completed).toLowerCase()==='true';x.scope=String(x.scope||'one');x.titleOverride=String(x.titleOverride||'');});
 out.ppct_overrides.forEach(x=>{x.fromDate=toIso(x.fromDate);x.toDate=toIso(x.toDate);x.pattern=parseStreamPattern(x.pattern);});
 out.extra_sessions.forEach(x=>{x.date=toIso(x.date);x.period=Number(x.period);x.shift=String(x.shift||'').trim().toUpperCase();x.groups=parseGroups(x.groups);x.completed=x.completed===true||String(x.completed).toLowerCase()==='true';x.lessonNumber=Number(x.lessonNumber)||0;x.patternId=String(x.patternId||'');x.action=String(x.action||'EDIT');x.classIds=parseGroups(x.classIds);x.customGroups=parseGroups(x.customGroups);x.repeatRule=x.repeatRule||'once';x.revision=Number(x.revision)||0;});
 out.extra_patterns.forEach(x=>{x.day=Number(x.day);x.period=Number(x.period);x.fromDate=toIso(x.fromDate);x.toDate=toIso(x.toDate);x.shift=String(x.shift||'').trim().toUpperCase();x.groups=parseGroups(x.groups);x.startLesson=Number(x.startLesson)||1;x.active=x.active===true||String(x.active).toLowerCase()==='true';x.classIds=parseGroups(x.classIds);x.customGroups=parseGroups(x.customGroups);x.repeatRule=x.repeatRule||'weekly';x.revision=Number(x.revision)||0;});
 return out;
}
export function parseStreamPattern(value){if(Array.isArray(value))return value.map(x=>String(x).trim().toUpperCase()).filter(x=>x==='ĐS'||x==='HH');if(!value)return [];try{const x=JSON.parse(value);if(Array.isArray(x))return parseStreamPattern(x)}catch{}return String(value).split(/[,;\s]+/).map(x=>x.toUpperCase()).filter(x=>x==='ĐS'||x==='HH');}
export function parseGroups(value){
 if(Array.isArray(value))return [...new Set(value.map(x=>String(x||'').trim()).filter(Boolean))];
 if(!value)return [];
 try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parseGroups(parsed);}catch{}
 return [...new Set(String(value).split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean))];
}
// V1.4: tutoring recurrence is independent of official TKB versions and PPCT.
// Old extra_sessions without a patternId remain one-time entries, so upgrades never lose them.
export function dayNumber(date){const x=parseDate(date).getDay();return x===0?8:x+1;}
export function recurringDateInWeek(pattern,week){return addDays(monday(week),Number(pattern.day)-2);}
export function tutoringForWeek(state,week){
 const start=monday(week),end=addDays(start,6);
 const overrides=state.extra_sessions||[];
 const all=[];
 for(const pattern of state.extra_patterns||[]){
  if(pattern.active===false||String(pattern.active).toLowerCase()==='false')continue;
  const date=recurringDateInWeek(pattern,start);
  if(!pattern.fromDate||date<pattern.fromDate||(pattern.toDate&&date>pattern.toDate))continue;
  const override=overrides.find(x=>x.patternId===pattern.id&&x.date===date);
  if(override?.action==='CANCEL')continue;
  // Count delivered/planned occurrences, excluding explicitly cancelled weeks.
  let lessonNumber=Number(pattern.startLesson)||1;
  let probe=recurringDateInWeek(pattern,monday(pattern.fromDate));
  if(probe<pattern.fromDate)probe=addDays(probe,7);
  for(;probe<date;probe=addDays(probe,7)){
   if(pattern.toDate&&probe>pattern.toDate)break;
   if(!overrides.some(x=>x.patternId===pattern.id&&x.date===probe&&x.action==='CANCEL'))lessonNumber++;
  }
  const resolved={...pattern,...(override&&override.action==='EDIT'?override:{}),id:override?.action==='EDIT'?override.id:`${pattern.id}@${date}`,patternId:pattern.id,day:Number(pattern.day),date,recurring:true,kind:'EXTRA',groups:parseGroups(override?.action==='EDIT'?override.groups:pattern.groups),lessonNumber:override?.lessonNumber>0?Number(override.lessonNumber):lessonNumber,revision:Number(pattern.revision||0),occurrenceRevision:Number(override?.revision||0),completed:override?.action==='EDIT'?Boolean(override.completed):false};
  resolved.status=resolved.completed?'DONE':'PLANNED';resolved.ppct=null;resolved.classId='';
  all.push(resolved);
 }
 for(const item of overrides){
  if(item.patternId||item.action==='CANCEL'||item.date<start||item.date>end)continue;
  all.push({...item,kind:'EXTRA',recurring:false,groups:parseGroups(item.groups),classIds:parseGroups(item.classIds),customGroups:parseGroups(item.customGroups),revision:Number(item.revision)||0,classId:'',status:item.completed?'DONE':'PLANNED',lessonNumber:Number(item.lessonNumber)||1,ppct:null});
 }
 return all.sort((a,b)=>a.date.localeCompare(b.date)||'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period);
}
export function activeVersion(state,date){return [...(state.versions||[])].filter(v=>String(v.fromDate||'').slice(0,10)<=date).sort((a,b)=>String(b.fromDate).localeCompare(String(a.fromDate))||String(b.id).localeCompare(String(a.id)))[0]||null}
export function scheduleForDate(state,date){
 const ver=activeVersion(state,date);
 const day=parseDate(date).getDay()===0?8:parseDate(date).getDay()+1;
 const base=ver&&schoolWeek(date)!==0?(state.slots||[]).filter(x=>String(x.versionId).trim()===String(ver.id).trim()&&Number(x.day)===day).map(s=>({...s,date,changeId:'',status:'PLANNED'})):[];
 for(const ch of (state.changes||[]).filter(x=>x.date===date)){
  const index=base.findIndex(x=>x.shift===ch.shift&&x.period===Number(ch.period));
  if(ch.action==='CLEAR')continue;
  if(ch.action==='OFF'||ch.action==='DONE'||ch.action==='EDIT'){
   if(index>=0){const was=base[index];base[index]={...was,...(ch.action==='EDIT'?{classId:ch.classId||was.classId,subject:ch.subject||was.subject,stream:ch.stream||was.stream}:{}),status:ch.action==='OFF'?'OFF':(ch.action==='DONE'||ch.completed)?'DONE':'PLANNED',notes:ch.notes||was.notes,ppctId:ch.ppctId||'',scope:ch.scope||'following',titleOverride:ch.titleOverride||'',changeId:ch.id};}
  }else if(ch.action==='ADD'){
   const event={id:ch.id,versionId:ver?.id||'',date,day,shift:ch.shift,period:Number(ch.period),classId:ch.classId,subject:ch.subject,stream:ch.stream||'',kind:ch.kind||'EXTRA',notes:ch.notes||'',status:ch.completed?'DONE':'PLANNED',ppctId:ch.ppctId||'',scope:ch.scope||'following',titleOverride:ch.titleOverride||'',changeId:ch.id};
   // keep conflicts visible for audit instead of silently overwriting
   base.push(event);
  }
 }
 return base.sort((a,b)=>'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period);
}
export function conflicts(events){const map=new Map();for(const e of events){const k=scheduleKey(e.date,e.shift,e.period);if(e.status==='OFF')continue;map.set(k,[...(map.get(k)||[]),e]);}return [...map].filter(([,list])=>list.length>1).map(([key,items])=>({key,items}));}
export function ppctSequence(state,grade,subject,stream){return (state.ppct||[]).filter(p=>p.grade===grade&&p.subject===subject&&p.stream===stream).sort((a,b)=>(a.week||99)-(b.week||99)||a.period-b.period)}
// Distribute math streams in lesson order, not by placing all Algebra before Geometry.
// School plan: 3 Algebra + 1 Geometry = Algebra, Algebra, Geometry, Algebra.
export function mathStreamPattern(algebraCount,geometryCount,total=algebraCount+geometryCount){
 let ds=Math.max(0,Number(algebraCount)||0),hh=Math.max(0,Number(geometryCount)||0);
 total=Math.max(0,Number(total)||0);
 if(ds+hh!==total){
  if(ds+hh===0){ds=total;hh=0;}
  else {const proposed=Math.round(total*ds/(ds+hh));ds=Math.min(total,Math.max(0,proposed));hh=total-ds;}
 }
 if(total===4&&ds===3&&hh===1)return ['ĐS','ĐS','HH','ĐS'];
 if(total===4&&ds===2&&hh===2)return ['ĐS','HH','ĐS','HH'];
 if(total===4&&ds===1&&hh===3)return ['HH','HH','ĐS','HH'];
 const result=[];let next=ds>=hh?'ĐS':'HH';
 while(ds>0||hh>0){
  if((next==='ĐS'&&ds===0)||(next==='HH'&&hh===0))next=next==='ĐS'?'HH':'ĐS';
  result.push(next);if(next==='ĐS')ds--;else hh--;
  next=next==='ĐS'?'HH':'ĐS';
 }
 return result;
}
export function applyStreamAssignments(state,weekEvents){
 const groups=new Map();
 for(const e of weekEvents){
  if(e.subject!=='Toán'||e.kind!=='MAIN')continue;
  const wk=schoolWeek(e.date),key=`${e.classId}|${wk}`;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
 }
 for(const [key,events] of groups){
  const [classId,wk]=key.split('|'),c=classById(state,classId);if(!c)continue;
  const dsCount=ppctSequence(state,c.grade,'Toán','ĐS').filter(x=>x.week===Number(wk)).length;
  const hhCount=ppctSequence(state,c.grade,'Toán','HH').filter(x=>x.week===Number(wk)).length;
  events.sort((a,b)=>a.date.localeCompare(b.date)||'SCT'.indexOf(a.shift)-'SCT'.indexOf(b.shift)||a.period-b.period);
  const weekStart=monday(events[0].date);
  const rule=[...(state.ppct_overrides||[])].filter(r=>r.classId===classId&&r.subject==='Toán'&&r.fromDate<=weekStart&&(!r.toDate||r.toDate>=weekStart)).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0];
  // A rule is applied only when it still matches this week's official PPCT stream totals.
  const expected=mathStreamPattern(dsCount,hhCount,events.length);
  const rulePattern=parseStreamPattern(rule?.pattern);
  const validRule=rulePattern.length===events.length&&rulePattern.filter(x=>x==='ĐS').length===expected.filter(x=>x==='ĐS').length&&rulePattern.filter(x=>x==='HH').length===expected.filter(x=>x==='HH').length;
  const pattern=validRule?rulePattern:expected;
  // Preserve explicit stream overrides on individual lessons; assign only blank entries.
  const remaining={'ĐS':pattern.filter(x=>x==='ĐS').length,'HH':pattern.filter(x=>x==='HH').length};
  for(const e of events)if(e.stream==='ĐS'||e.stream==='HH')remaining[e.stream]=Math.max(0,remaining[e.stream]-1);
  const blanks=events.filter(e=>e.stream!=='ĐS'&&e.stream!=='HH');
  const leftover=pattern.filter(x=>remaining[x]>0&&remaining[x]-- >0);
  blanks.forEach((e,i)=>{e.stream=leftover[i]||pattern[i]||'ĐS';e.streamInferred=true;});
 }
 return weekEvents;
}
export function project(state,untilDate){
 const baselines=state.baselines||[];
 const earliest=baselines.map(b=>b.fromDate).sort()[0]||monday(untilDate);
 const start=monday(earliest),end=addDays(monday(untilDate),6);
 const all=[];
 for(let week=start;week<=end;week=addDays(week,7)){
  const events=[];for(let i=0;i<7;i++)events.push(...scheduleForDate(state,addDays(week,i)));
  applyStreamAssignments(state,events);all.push(...events);
 }
 const pointer=new Map();for(const b of baselines)pointer.set(`${b.classId}|${b.subject}|${b.stream}`,Number(b.nextIndex)||0);
 for(const e of all){
  // Extra tutoring groups are not official curriculum lessons, even if a name matches a formal class.
  if(e.kind==='EXTRA'){e.ppct=null;continue;}
  if(e.date<(baselines.find(b=>b.classId===e.classId&&b.subject===e.subject&&b.stream===e.stream)?.fromDate||'9999'))continue;
  const cls=classById(state,e.classId);if(!cls)continue;
  const key=`${e.classId}|${e.subject}|${e.stream}`;
  const seq=ppctSequence(state,cls.grade,e.subject,e.stream);
  let i=pointer.get(key);
  if(i===undefined){continue;}
  const initial=i;const match=e.ppctId?seq.findIndex(x=>x.id===e.ppctId):-1;
  if(match>=0)i=match;
  e.ppct=seq[i]||null;
  if(e.kind==='EXTRA'&&!e.ppctId){e.ppct=null;} // extra tutoring is independent of official PPCT
  if(e.titleOverride&&e.ppct)e.ppct={...e.ppct,title:e.titleOverride};
  if(e.status!=='OFF'&&e.ppct){const newPointer=e.scope==='one'&&e.status!=='DONE'&&match>=0?initial+1:i+1;pointer.set(key,Math.max(pointer.get(key),newPointer));}
 }
 return {events:all,pointers:pointer};
}
export function eventsForWeek(state,week){return project(state,addDays(monday(week),6)).events.filter(e=>e.date>=monday(week)&&e.date<=addDays(monday(week),6));}
export function seedSanity(state){
 const names=new Set((state.classes||[]).map(c=>c.id));
 const badSlots=(state.slots||[]).filter(e=>!names.has(e.classId)||!DAYS.some(d=>d.n===Number(e.day))||!SHIFTS.some(s=>s.id===e.shift&&e.period>=1&&e.period<=s.count));
 return {badSlots,conflicts:conflicts(eventsForWeek(state,monday('2026-11-09')))};
}


// V1.5: Actual progress must never infer completed lessons from timetable projections.
// Unconfirmed baselines return no pace comparison instead of fabricated results.
export function progressAt(state,classId,subject,stream,throughDate){
 const cls=classById(state,classId);
 if(!cls)return {status:'missing-class'};
 const baseline=(state.baselines||[]).find(b=>b.classId===classId&&b.subject===subject&&b.stream===stream);
 const seq=ppctSequence(state,cls.grade,subject,stream);
 const wk=schoolWeek(throughDate);
 const planned=seq.filter(p=>p.week>0&&p.week<=wk).length;
 if(!baseline||!baseline.confirmed||throughDate<baseline.fromDate){return {status:'unconfirmed',classId,subject,stream,planned,actual:null,delta:null,next:null};}
 const next=Math.min(seq.length,Math.max(0,Number(baseline.nextIndex)||0));
 const completed=new Set(seq.slice(0,next).map(p=>p.id));
 let unlinked=0;
 for(const ch of state.changes||[]){
  if(ch.classId!==classId||ch.subject!==subject||ch.stream!==stream)continue;
  if(ch.date<baseline.fromDate||ch.date>throughDate||!ch.completed||ch.action==='OFF')continue;
  if(ch.ppctId&&seq.some(p=>p.id===ch.ppctId))completed.add(ch.ppctId);
  else unlinked++;
 }
 const actual=completed.size;
 return {status:'ready',classId,subject,stream,planned,actual,delta:actual-planned,unlinked,
    next:seq.find(p=>!completed.has(p.id))||null,baselineDate:baseline.fromDate};
}
export function progressSummary(state,throughDate){
 return (state.baselines||[]).map(b=>progressAt(state,b.classId,b.subject,b.stream,throughDate));
}

// V1.6: independent tutoring sessions can share one slot with multiple groups,
// but two distinct sessions at the same slot are a genuine collision.
export function extraSlotOverlap(a,b){
 if(a.date!==b.date||a.shift!==b.shift)return false;
 if(a.startTime&&a.endTime&&b.startTime&&b.endTime)return a.startTime<b.endTime&&b.startTime<a.endTime;
 return Number(a.period)===Number(b.period);
}
export function extraGroupLabels(item,state){
 const names=new Map((state?.classes||[]).map(c=>[c.id,c.name]));
 return parseGroups(item.groups).map(id=>names.get(id)||id);
}
