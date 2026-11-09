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
export async function extractTeacherSchedule(file){
 if(!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Chỉ hỗ trợ định dạng Excel .xlsx');
 const sheets=await loadWorkbook(file),result=[],warnings=[];
 for(const sheet of sheets){
  if(!sheet.name.toUpperCase().includes('DỮ LIỆU 150 TIẾT'))continue;
  const match=file.name.match(/K(7|9)-TKB/i),grade=match?Number(match[1]):0;
  if(!grade){warnings.push('Không xác định được khối từ tên file (cần có K7-TKB hoặc K9-TKB)');continue;}
  for(const row of sheet.rows.slice(2)){
   if(!row)continue;
   const v=x=>asString(row[x]);const d=/\d+/.exec(v(1));const cls=v(3),subject=v(5);
   if(!d||!mapping[cls]||v(4).toLowerCase()!=='đức'||!['Toán','Tin'].includes(subject))continue;
   result.push({day:Number(d[0]),shift:grade===7?'C':'S',period:Number(v(2)),classId:mapping[cls],subject,stream:subject==='Tin'?'TIN':'',kind:'MAIN',notes:`Nhập từ ${file.name}`});
  }
 }
 if(result.length)return {slots:result,warnings,type:'school'};
 const sheet=sheets[0];
 if(sheet&&asString(sheet.rows[1]?.[1]).includes('THỜI KHÓA BIỂU TIN HỌC')){
  for(const [shift,first,last] of [['S',6,10],['C',17,20]])for(let r=first;r<=last;r++){
   const row=sheet.rows[r]||{},period=Number(row[1]);if(!period)continue;
   for(const [day,col] of [[2,4],[3,8],[4,12],[5,16],[6,20]]){
    const v=asString(row[col]);for(const part of v.split(/[\n;]/)){
     const m=part.match(/\b([79])[.\/]([1-9])\s*\(\s*Đ\s*\)/i);if(!m)continue;
     const classId=mapping[`${m[1]}/${m[2]}`];if(!classId)continue;
     result.push({day,shift,period,classId,subject:'Tin',stream:'TIN',kind:'MAIN',notes:`Nhập từ ${file.name}`});
    }
   }
  }
  return {slots:result,warnings,type:'ict'};
 }
 warnings.push('Không nhận diện được mẫu Excel. Chỉ có 2 mẫu nguồn khối 7/9 và mẫu TKB Tin được hỗ trợ.');
 return {slots:[],warnings,type:'unknown'};
}
