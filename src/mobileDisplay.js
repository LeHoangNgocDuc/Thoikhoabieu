import {parseGroups} from './core.js';
/** Merge adjacent representations of one tutoring class/session for display ONLY.
 * Never change saved sessions or PPCT. Different classes, subjects, lessons or statuses
 * are distinct even when scheduled next to one another.
 */
export function collapseTutorDisplay(events){
 const source=[...events].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.shift).localeCompare(String(b.shift))||Number(a.period)-Number(b.period));
 const result=[];
 for(const e of source){
  if(e.kind!=='EXTRA'){result.push(e);continue;}
  const groups=parseGroups(e.groups).map(x=>String(x).trim().toLocaleLowerCase('vi')).sort().join('|');
  if(!groups){result.push(e);continue;}
  const previous=[...result].reverse().find(x=>x.kind==='EXTRA'&&x.date===e.date&&x.shift===e.shift&&x.subject===e.subject&&Number(x.periodEnd||x.period)===Number(e.period)-1&&parseGroups(x.groups).map(y=>String(y).trim().toLocaleLowerCase('vi')).sort().join('|')===groups);
  if(previous && String(previous.lessonNumber||1)===String(e.lessonNumber||1) && String(previous.lessonTitle||'').trim()===String(e.lessonTitle||'').trim() && String(previous.status||'PLANNED')===String(e.status||'PLANNED') && String(previous.startTime||'')===String(e.startTime||'') && String(previous.endTime||'')===String(e.endTime||'')){
   previous.periodEnd=Number(e.period);previous.displayMergedIds=[...(previous.displayMergedIds||[previous.id]),e.id];
  } else result.push({...e,periodEnd:Number(e.period)});
 }
 return result;
}
