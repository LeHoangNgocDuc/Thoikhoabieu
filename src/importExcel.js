/* Browser-only XLSX reader tailored to the school templates. No third-party JS library.
 * Uses the ZIP central directory + native DecompressionStream and XML DOM parser.
 * Supports .xlsx; .xls is intentionally not accepted.
 */
const mapping={'7/2':'7F38','7/3':'7F39','9/1':'9F43','9/2':'9F44','9/4':'9F46','9/5':'9F47','9/6':'9F48'};
function xml(text){const node=new DOMParser().parseFromString(text,'application/xml');if(node.getElementsByTagName('parsererror').length)throw Error('File Excel chứa XML không hợp lệ');return node;}
function nodes(node,name){return Array.from(node.getElementsByTagNameNS('*',name));}
function asString(value){return String(value??'').trim();}
async function unzip(bytes){
 const view=new DataView(bytes),data=new Uint8Array(bytes),dec=new TextDecoder();let end=-1;
 for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('Không đọc được cấu trúc ZIP của Excel');
 let pos=view.getUint32(end+16,true),count=view.getUint16(end+10,true);const files=new Map();
 for(let i=0;i<count;i++){
  if(view.getUint32(pos,true)!==0x02014b50)throw Error('Cấu trúc XLSX bị hỏng');
  const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),nlen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),off=view.getUint32(pos+42,true);
  const name=dec.decode(data.subarray(pos+46,pos+46+nlen));
  if(view.getUint32(off,true)!==0x04034b50)throw Error('ZIP local header không hợp lệ');
  const start=off+30+view.getUint16(off+26,true)+view.getUint16(off+28,true);
  files.set(name,{method,size,start});pos+=46+nlen+extra+comment;
 }
 return async name=>{
  const entry=files.get(name.replace(/^\//,''));if(!entry)throw Error(`Không tìm thấy ${name} trong XLSX`);
  const slice=data.subarray(entry.start,entry.start+entry.size);
  if(entry.method===0)return dec.decode(slice);
  if(entry.method!==8)throw Error('Tệp XLSX dùng phương pháp nén không hỗ trợ');
  if(typeof DecompressionStream==='undefined')throw Error('Trình duyệt cần hỗ trợ DecompressionStream. Hãy dùng Chrome/Edge mới.');
  const stream=new Blob([slice]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return dec.decode(await new Response(stream).arrayBuffer());
 };
}
function rowsFromXml(document,strings){const rows=[];
 for(const row of nodes(document,'row')){
  const values={};for(const c of nodes(row,'c')){
   const ref=c.getAttribute('r')||'';const col=ref.match(/^[A-Z]+/)?.[0]||'';let index=0;for(const letter of col)index=index*26+letter.charCodeAt(0)-64;
   const t=c.getAttribute('t'),v=nodes(c,'v')[0]?.textContent;
   values[index]=t==='s'?strings[Number(v)]??'':t==='inlineStr'?(nodes(c,'is')[0]?.textContent??''):(v??'');
  }
  rows[Number(row.getAttribute('r'))] = values;
 }
 return rows;
}
async function loadWorkbook(file){
 const read=await unzip(await file.arrayBuffer());
 const workbook=xml(await read('xl/workbook.xml'));
 const relationships=xml(await read('xl/_rels/workbook.xml.rels'));
 const rels=new Map(nodes(relationships,'Relationship').map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
 let shared=[];try{shared=nodes(xml(await read('xl/sharedStrings.xml')),'si').map(x=>x.textContent||'');}catch{};
 const sheets=[];
 for(const sh of nodes(workbook,'sheet')){
  const id=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const target=rels.get(id);if(!target)continue;
  const path=target.startsWith('/')?target.slice(1):`xl/${target.replace(/^\.\//,'')}`;
  sheets.push({name:sh.getAttribute('name'),rows:rowsFromXml(xml(await read(path)),shared)});
 }
 return sheets;
}

/** Official source files are recognized by CONTENT, never by filename. */
const TEACHER=/^(?:Đức|Lê Hoàng Ngọc Đức|Le Hoang Ngoc Duc)$/iu;
const digits=(value)=>String(value??'').match(/\d+/)?.[0]||'';
const teacher=(value)=>TEACHER.test(asString(value));
function sourceDate(sheets){
 for(const sheet of sheets)for(const row of sheet.rows.slice(0,8)){
  if(!row)continue;
  for(const value of Object.values(row)){
   const m=String(value??'').match(/áp\s*dụng\s*từ\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(20\d{2})/iu);
   if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
 }
 return '';
}
function slot(day,shift,period,className,subject,source){
 const normalized=String(className||'').trim().replace(/[.]/g,'/');
 const classId=mapping[normalized];
 if(!classId)return null;
 return {day:Number(day),shift,period:Number(period),classId,subject,stream:subject==='Tin'?'TIN':'',kind:'MAIN',notes:`Nguồn Excel: ${source}`};
}
function timetableGrade(sheet){
 const h=sheet.rows[4]||{};
 const m=Object.values(h).join(' ').match(/LỚP\s*(7|9)\s*[\/\.]/iu);
 if(m)return Number(m[1]);
 const sh=sheet.name.match(/KHỐI\s*(7|9)/iu);
 return sh?Number(sh[1]):0;
}
function officialSheet(sheets,source,warnings){
 const data=sheets.find(s=>/DỮ\s*LIỆU\s*150\s*TIẾT/iu.test(s.name));
 const grid=sheets.find(s=>/TKB\s*KHỐI\s*[79]/iu.test(s.name));
 const grade=timetableGrade(grid||data||{name:'',rows:[]});
 if(!grade)return [];
 const result=[];
 if(data){
  for(const row of data.rows.slice(2)){
   if(!row||!teacher(row[4])||asString(row[5])!=='Toán')continue;
   const t=slot(digits(row[1]),grade===7?'C':'S',row[2],row[3],'Toán',source);
   if(t&&t.day>=2&&t.day<=8&&t.period>=1&&t.period<=5)result.push(t);
  }
 }
 if(grid){
  // Read the school timetable grid directly, including workbook exports without
  // the optional 'DỮ LIỆU 150 TIẾT' sheet.
  const classes={};for(const [key,val] of Object.entries(grid.rows[4]||{})){
   const match=asString(val).match(/LỚP\s*(\d{1,2}\s*[/.]\s*\d{1,2})/iu);
   if(match)classes[Number(key)]=match[1].replace(/\s/g,'').replace('.','/');
  }
  const fromGrid=[];let day=0;
  for(const row of grid.rows.slice(6)){
   if(!row)continue;
   if(/^THỨ\s*[2-7]/iu.test(asString(row[1])))day=Number(digits(row[1]));
   const period=Number(row[2]);if(!day||!period||period>5)continue;
   for(const [column,className] of Object.entries(classes)){
    const c=Number(column);
    if(teacher(row[c])&&asString(row[c+1])==='Toán'){
     const item=slot(day,grade===7?'C':'S',period,className,'Toán',source);
     if(item)fromGrid.push(item);
    }
   }
  }
  if(!data)result.push(...fromGrid);
  else{
   const keys=a=>new Set(a.map(x=>[x.day,x.shift,x.period,x.classId,x.subject].join('|')));
   const list=keys(result),matrix=keys(fromGrid);
   if(list.size!==matrix.size||[...list].some(k=>!matrix.has(k)))warnings.push(`${source}: dữ liệu 150 tiết và lưới TKB không khớp; ưu tiên bảng dữ liệu 150 tiết.`);
  }
 }
 return result;
}
function ictSheet(sheets,source,warnings){
 const sheet=sheets.find(s=>Object.values(s.rows[1]||{}).some(v=>/THỜI\s*KHÓA\s*BIỂU\s*TIN\s*HỌC/iu.test(asString(v))));
 if(!sheet)return [];
 const result=[];let shift='',dayColumns={},header=false;
 for(let r=1;r<sheet.rows.length;r++){
  const row=sheet.rows[r]||{};const title=Object.values(row).map(asString).join(' ');
  if(/THỜI\s*KHÓA\s*BIỂU\s*TIN\s*HỌC/iu.test(title)){
   if(/BUỔI\s*SÁNG/iu.test(title))shift='S';
   else if(/BUỔI\s*CHIỀU/iu.test(title))shift='C';
   header=false;dayColumns={};continue;
  }
  const dayHeaders=Object.entries(row).filter(([,v])=>/^THỨ\s*[2-7]$/iu.test(asString(v)));
  if(dayHeaders.length>=3){
   dayColumns={};for(const [col,value] of dayHeaders)dayColumns[Number(col)+2]=Number(digits(value));
   header=false;continue;
  }
  if(Object.values(row).some(v=>asString(v).toUpperCase()==='TH')){header=true;continue;}
  const period=Number(row[1]);if(!header||!shift||!(period>=1&&period<=5))continue;
  for(const [column,day] of Object.entries(dayColumns)){
   const value=asString(row[Number(column)]);
   const expr=/(\d{1,2})\s*[./]\s*(\d{1,2})\s*\(\s*Đ\s*\)/giu;
   for(const match of value.matchAll(expr)){
    const item=slot(day,shift,period,`${match[1]}/${match[2]}`,'Tin',source);
    if(item)result.push(item);
    else warnings.push(`${source}: không có lớp Tin ${match[1]}/${match[2]} trong danh mục.`);
   }
  }
 }
 return result;
}
/** A pure entrypoint that also enables repeatable regression tests from real Excel samples. */
export function extractTeacherScheduleFromSheets(sheets,source='Excel'){
 const warnings=[],fromDate=sourceDate(sheets);
 const official=officialSheet(sheets,source,warnings),ict=ictSheet(sheets,source,warnings);
 const slots=[...official,...ict];
 // Verified teacher correction for the school timetable effective 09/11/2026.
 // The uploaded K9 workbook itself places Toan 9/1 on Thursday P3; the
 // teacher confirmed the intended position is FRIDAY morning P3 instead.
 // Restrict this exception to this exact schedule signature. Do not carry it
 // forward automatically to a future/new school timetable.
 if(fromDate==='2026-11-09' && official.length){
  const maths91=slots.filter(s=>s.classId==='9F43'&&s.subject==='Toán'&&s.shift==='S');
  const has=(day,period)=>maths91.some(s=>s.day===day&&s.period===period);
  if(maths91.length===4&&has(3,4)&&has(5,3)&&has(5,4)&&has(6,2)&&!has(6,3)){
   const corrected=maths91.find(s=>s.day===5&&s.period===3);
   corrected.day=6;corrected.period=3;
   corrected.notes+='; Hiệu chỉnh theo xác nhận giáo viên: Thứ Sáu sáng tiết 3';
   warnings.push(`${source}: Toán 9/1 được hiệu chỉnh từ Thứ Năm sáng tiết 3 sang Thứ Sáu sáng tiết 3 theo xác nhận của giáo viên; file gốc giữ nguyên.`);
  }
 }
 const uniq=new Set(),deduped=[];
 for(const s of slots){const key=[s.day,s.shift,s.period,s.classId,s.subject].join('|');if(!uniq.has(key)){uniq.add(key);deduped.push(s);}}
 if(!fromDate)warnings.push(`${source}: không tìm thấy ngày áp dụng trên tiêu đề; cần nhập thủ công.`);
 if(!deduped.length)warnings.push(`${source}: không có tiết của thầy Đức theo mẫu hỗ trợ.`);
 return {slots:deduped,warnings,fromDate,type:official.length?'school':ict.length?'ict':'unknown',source};
}
export async function extractTeacherSchedule(file){
 if(!/\.xlsx$/i.test(file.name))throw Error('Chỉ hỗ trợ Excel .xlsx');
 return extractTeacherScheduleFromSheets(await loadWorkbook(file),file.name);
}
