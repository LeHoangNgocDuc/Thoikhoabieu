import os,re,json,glob,datetime,argparse
import pdfplumber,openpyxl
from docx import Document
parser=argparse.ArgumentParser(description='Rebuild seed from the 7 original files')
parser.add_argument('--input-dir',default='/mnt/data',help='Folder containing the 7 original uploaded files')
args=parser.parse_args()
ROOT=os.path.abspath(args.input_dir)
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','public','seed.json'))
CLASSES=[{'id':'7F38','name':'7/2','grade':7,'subjects':['Toán','Tin']}, {'id':'7F39','name':'7/3','grade':7,'subjects':['Tin']},{'id':'9F43','name':'9/1','grade':9,'subjects':['Toán','Tin']},{'id':'9F44','name':'9/2','grade':9,'subjects':['Tin']},{'id':'9F46','name':'9/4','grade':9,'subjects':['Toán']},{'id':'9F47','name':'9/5','grade':9,'subjects':['Tin']},{'id':'9F48','name':'9/6','grade':9,'subjects':['Tin']}]

# Extract PDF table with visually distinct DS vs HH cells (table numeric anchor in columns 1 vs 3/4).
def maths(path,grade):
    entries=[];current_week=None
    with pdfplumber.open(path) as pdf:
      for ip,page in enumerate(pdf.pages):
        tables=page.extract_tables()
        for table in tables:
          header=' '.join(str(x or '') for r in table[:2] for x in r)
          if 'PPCT' not in header or 'bài học' not in header: continue
          active=None
          for row in table[1:]:
            rw=[str(x or '').replace('\n',' ').strip() for x in row]
            w=' '.join(rw[:1]);m=re.search(r'Tuần\s*(\d+)',w,re.I)
            if m:current_week=int(m.group(1))
            periods=[]
            if len(rw)>1 and re.fullmatch(r'\d{1,2}',rw[1]):periods.append(('ĐS',int(rw[1])))
            for ix in ([2] if len(rw)<=10 else [2,3,4]):
              if len(rw)>ix and re.fullmatch(r'\d{1,2}',rw[ix]):periods.append(('HH',int(rw[ix])))
            pieces=[]
            for z in rw[(3 if len(rw)<=10 else 5):(6 if len(rw)<=10 else 9)]:
              if z and z not in pieces:pieces.append(z)
            lesson=' '.join(pieces).strip()
            if periods:
              st,no=periods[0]
              active={'id':f'M{grade}-{st}-{no}','grade':grade,'subject':'Toán','stream':st,'week':current_week,'period':no,'title':lesson,'source':os.path.basename(path)}
              entries.append(active)
            elif active and lesson and not any(k in lesson for k in ['HỌC KÌ','HỌC KỲ','Tiết PPCT','Tên bài học']):
              if lesson not in active['title']: active['title']=(active['title']+' '+lesson).strip()
    # de-duplicate the same period as PDF can contain continued pages
    cleaned={}
    for e in entries:
      key=(e['stream'],e['period'])
      if key not in cleaned:cleaned[key]=e
      elif len(e['title'])>len(cleaned[key]['title']):cleaned[key]=e
    return sorted(cleaned.values(),key=lambda e:(e['week'] or 999,e['period'],0 if e['stream']=='ĐS' else 1))

def tin7(path):
 d=Document(path);res=[]
 for t in d.tables:
  if len(t.columns)!=5:continue
  for row in t.rows[1:]:
   cells=[c.text.strip().replace('\n',' ') for c in row.cells]
   w=re.search(r'Tuần\s*(\d+)',cells[0]);n=re.search(r'\d+',cells[1])
   if w and n and cells[2]:
    p=int(n.group());res.append({'id':f'T7-{p}','grade':7,'subject':'Tin','stream':'TIN','week':int(w.group(1)),'period':p,'title':cells[2],'source':os.path.basename(path)})
 return res

def tin9(path):
 d=Document(path);res=[]
 t=next(t for t in d.tables if len(t.columns)==11)
 for row in t.rows[2:]:
  a=[c.text.strip().replace('\n',' ') for c in row.cells]
  if not a[1] or not a[3] or not a[4].startswith('Tuần'): continue
  periods=[int(x) for x in re.findall(r'\d+',a[3].split('KTTX')[0])]
  weeks=[int(x) for x in re.findall(r'\d+',a[4])]
  for ix,p in enumerate(periods):
   week=weeks[ix] if len(weeks)>ix else (weeks[-1] if weeks else None)
   res.append({'id':f'T9-{p}-{ix+1}' if len(periods)>1 else f'T9-{p}', 'grade':9,'subject':'Tin','stream':'TIN','week':week,'period':p,'title':a[1],'source':os.path.basename(path),'note':'Kiểm tra thường xuyên' if 'KTTX' in a[3] else ''})
 return res

# Import main school table: only relevant teacher. Two sources for grade 7 and 9.
name_to_id={c['name']:c['id'] for c in CLASSES}
schedules=[]
for grade in [7,9]:
 filename=next(f for f in glob.glob(ROOT+'/*.xlsx') if f'K{grade}-TKB' in f)
 wb=openpyxl.load_workbook(filename,read_only=True,data_only=True)
 sh=wb['DỮ LIỆU 150 TIẾT'];sh.reset_dimensions()
 for row in list(sh.iter_rows(values_only=True))[1:]:
  day,period,cl,teacher,sub=(list(row)+[None]*5)[:5]
  if not isinstance(teacher,str) or teacher.strip().lower()!='đức':continue
  if str(cl).strip() not in name_to_id:continue
  no=re.search(r'\d+',str(day))
  if not no:continue
  # Grade 7 main TKB afternoon, grade 9 morning, confirmed by teacher.
  schedules.append({'id':f'S-{grade}-{len(schedules)+1}','versionId':'v4-2026','day':int(no.group()),'shift':'C' if grade==7 else 'S','period':int(period),'classId':name_to_id[str(cl).strip()],'subject':'Toán','stream':'','kind':'MAIN','notes':'Nhập từ '+os.path.basename(filename)})

# Import the ICT source containing morning and afternoon Tin lessons with the teacher code (Đ), only valid columns for ICT.
filename=ROOT+'/mau-danh-sach-hoc-sinh.xlsx';sh=openpyxl.load_workbook(filename,data_only=True).active
# weekday positions: day2 uses col D (4), day3 H (8), day4 L (12), day5 P (16), day6 T (20)
for shift,first,last in [('S',6,10),('C',17,20)]:
 for row in range(first,last+1):
  period=sh.cell(row,1).value
  if not isinstance(period,int):continue
  for d,ci in [(2,4),(3,8),(4,12),(5,16),(6,20)]:
   value=sh.cell(row,ci).value
   if not value:continue
   # split lines in case one cell has multiple groups
   for part in str(value).split('\n'):
    m=re.search(r'\b([79])[.\/]([1-9])\s*\(\s*Đ\s*\)',part,re.I)
    if not m:continue
    cls=f'{m.group(1)}/{m.group(2)}'
    if cls not in name_to_id:continue
    schedules.append({'id':f'S-TIN-{len(schedules)+1}','versionId':'v4-2026','day':d,'shift':shift,'period':period,'classId':name_to_id[cls],'subject':'Tin','stream':'TIN','kind':'MAIN','notes':'Nhập từ mau-danh-sach-hoc-sinh.xlsx, ký hiệu GV Đ'})

ppct=[]
for grade in [7,9]:
 path=next(p for p in glob.glob(ROOT+'/*.pdf') if f'Toán {grade}' in p)
 ppct+=maths(path,grade)
ppct+=tin7(next(p for p in glob.glob(ROOT+'/*.docx') if 'Tin 7' in p))
ppct+=tin9(next(p for p in glob.glob(ROOT+'/*.docx') if 'Tin 9' in p))
# Baseline: teacher should confirm start. Default from week 10 of each grade and stream, not mark progress actually completed.
baselines=[]
for c in CLASSES:
 for subject in c['subjects']:
  for stream in (['ĐS','HH'] if subject=='Toán' else ['TIN']):
   seq=sorted([e for e in ppct if e['grade']==c['grade'] and e['subject']==subject and e['stream']==stream], key=lambda e:(e['week'] or 999, e['period']))
   idx=next((i for i,x in enumerate(seq) if x['week'] and x['week']>=10),0)
   baselines.append({'id':f"B-{c['id']}-{subject}-{stream}",'classId':c['id'],'subject':subject,'stream':stream,'fromDate':'2026-11-09','nextIndex':idx,'confirmed':False})
output={'school':'THCS Nam Nha Trang - Phân hiệu Vĩnh Trường','year':'2026-2027','classes':CLASSES,'versions':[{'id':'v4-2026','name':'TKB lần 4 (09/11 - 13/12/2026)','fromDate':'2026-11-09','toDate':'2026-12-13','notes':'Nguồn: TKB K7, K9 và TKB Tin sáng/chiều'}],'slots':schedules,'ppct':ppct,'baselines':baselines,'changes':[]}
with open(OUT,'w',encoding='utf8') as f:json.dump(output,f,ensure_ascii=False,indent=2)
print('SEED',OUT,'slots',len(schedules),'PPCT',len(ppct),'baselines',len(baselines))
from collections import Counter
print('slots by subject',Counter((x['subject'],x['shift']) for x in schedules))
print('ppct by stream',Counter((x['grade'],x['subject'],x['stream']) for x in ppct))
for e in ppct[:12]:print(e['id'],e['week'],e['title'][:70])
