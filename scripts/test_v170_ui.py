import asyncio,re,json
from pathlib import Path
from playwright.async_api import async_playwright
R=Path(__file__).resolve().parent.parent
OUT=R/'screenshots_v170';OUT.mkdir(exist_ok=True)
seed=json.loads((R/'public/seed.json').read_text())
seed.update(extra_patterns=[],extra_sessions=[],audit_log=[],ppct_overrides=[])
core=(R/'src/core.js').read_text().replace('export ','')
cache=(R/'src/cache.js').read_text().replace('export ','').replace('localStorage','PREVIEW_STORAGE')
imp=(R/'src/importExcel.js').read_text().replace('export ','')
main=re.sub(r'^import .*?;\n','',(R/'src/main.js').read_text(),flags=re.M).replace('localStorage','PREVIEW_STORAGE')
setup='''
const PREVIEW_STORAGE={_v:{},getItem(k){return this._v[k]??null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};
let MOCK_DATA=__SEED__;
const mockResp=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
const fetch=async(url,opt={})=>{
 const path=String(url),body=opt.body?JSON.parse(opt.body):{};
 if(path.includes('action=session'))return mockResp({ok:true,authenticated:true,backendConfigured:true,apiVersion:'1.7.0',code:'AUTHENTICATED'});
 if(path.includes('action=version'))return mockResp({ok:true,apiVersion:'1.7.0',release:'v1.7.0',commit:'local'});
 if(path==='/api/tkb'&&(!opt.method||opt.method==='GET'))return mockResp({ok:true,data:MOCK_DATA,apiVersion:'1.7.0',gasVersion:'1.7.0'});
 if(body.op==='probeExtra')return mockResp({ok:true,apiVersion:'1.7.0',gasVersion:'1.7.0',extraWrites:true,verifiedWrites:true,verifiedMainWrites:true,supportedActions:['CREATE','EDIT_FUTURE'],supportedMainActions:['ADD','EDIT','DELETE','COPY'],mainScopes:['one','future']});
 if(body.op==='mutateMainSchedule'){
  const data=normalizeSheetData(MOCK_DATA),active=activeVersion(data,body.fromDate);
  if(active.id!==body.expectedVersionId)return mockResp({ok:false,code:'VERSION_CONFLICT',error:'Phiên bản cũ'},409);
  if(body.scope==='future'){
   const draft=previewMainRevision(data,{action:body.action,sourceSlotId:body.sourceSlotId,fromDate:body.fromDate,...body.patch});
   const verId='zzzz-TKB-'+body.fromDate+'-'+Date.now();
   let sourceSlotId=body.sourceSlotId;
   const slots=draft.slots.map(x=>{
    if(x.id==='PREVIEW-NEW-OFFICIAL')sourceSlotId='TEST-MANUAL-'+Date.now();
    return {...x,id:x.id==='PREVIEW-NEW-OFFICIAL'?sourceSlotId:x.id,versionId:verId};
   });
   MOCK_DATA.versions.push({...active,id:verId,fromDate:body.fromDate});MOCK_DATA.slots.push(...slots);
   return mockResp({ok:true,verified:true,versionId:verId,sourceSlotId,operation:body.action,slotCount:slots.length});
  }
  const draft=previewMainOnce(data,{action:body.action,sourceSlotId:body.sourceSlotId,fromDate:body.fromDate,...body.patch});
  const origin=draft.origin;
  const src=body.sourceSlotId;
  const isOnce=MOCK_DATA.changes.some(x=>x.id===src&&x.action==='MAIN_ADD_ONCE');
  const changeId=['COPY','ADD'].includes(body.action)?'MAINADD-'+body.requestId:isOnce?src:'MAIN1-'+body.fromDate+'-'+src;
  const sourceDate=origin?.day?addDays(body.fromDate,Number(origin.day)-2):(origin?.date||body.fromDate);
  const targetDate=body.patch?.day?addDays(body.fromDate,Number(body.patch.day)-2):'';
  let action=body.action==='DELETE'?(isOnce?'MAIN_VOID_ONCE':'MAIN_DELETE_ONCE'):isOnce?'MAIN_ADD_ONCE':(['ADD','COPY'].includes(body.action)?'MAIN_ADD_ONCE':'MAIN_EDIT_ONCE');
  const row={id:changeId,date:action==='MAIN_ADD_ONCE'?targetDate:sourceDate,shift:action==='MAIN_ADD_ONCE'?body.patch.shift:origin?.shift,period:action==='MAIN_ADD_ONCE'?body.patch.period:origin?.period,action,scope:'one',kind:'MAIN',sourceSlotId:isOnce?'':src,classId:body.patch?.classId||origin?.classId,subject:body.patch?.subject||origin?.subject,stream:body.patch?.stream||origin?.stream||'',moveDate:targetDate,moveShift:body.patch?.shift||'',movePeriod:body.patch?.period||0,notes:body.reason||''};
  MOCK_DATA.changes=MOCK_DATA.changes.filter(x=>x.id!==changeId);MOCK_DATA.changes.push(row);
  return mockResp({ok:true,verified:true,scope:'one',changeId,operation:body.action});
 }
 return mockResp({ok:false,code:'UNSUPPORTED_ACTION',error:'Không hỗ trợ'},400);
};
'''.replace('__SEED__',json.dumps(seed,ensure_ascii=False))
html='''<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>__CSS__</style></head><body><div id="app"></div><script>__JS__</script></body></html>'''.replace('__CSS__',(R/'src/style.css').read_text()).replace('__JS__',(setup+core+'\n'+cache+'\n'+imp+'\n'+main+'\nwindow.__tkb=()=> $state;').replace('</script>','<\\/script>'))
async def scenario(page,name,w):
 errs=[]
 page.on('pageerror',lambda e: errs.append(str(e)))
 await page.set_content(html,wait_until='load')
 await page.wait_for_timeout(350)
 assert await page.locator('.timetable').count() or await page.locator('.day-event').count(),(await page.locator('body').inner_text())[:250]
 initial=await page.evaluate("({week:__tkb().week, conflicts:conflicts(eventsForWeek(__tkb().data,'2026-11-09')).length,mode:__tkb().mode})")
 assert initial['conflicts']==1 and initial['mode']=='google',initial
 # Tap the cell itself: every overlapping lesson has its own edit/delete/copy buttons.
 await page.locator('.cell[data-date="2026-11-12"][data-shift="S"][data-period="3"]').click()
 assert await page.locator('.conflict-entry').count()==2
 assert await page.locator('.conflict-entry [data-action="start-delete-main"]').count()==2
 await page.locator('.conflict-editor [data-action="close-modal"]').click()
 # Go to original conflict cell. Main action every event is separate.
 await page.locator('.compact-warning summary').click()
 await page.locator('.conflict-options [data-action="start-move"][data-id="S-TIN-14"]').click()
 assert await page.locator('#move-scope').input_value()=='future'
 await page.screenshot(path=str(OUT/(name+'_main_editor.png')))
 # Save a single-week edit and test no change next week.
 await page.locator('#move-scope').select_option('one')
 await page.locator('#move-date').select_option('2026-11-13')
 await page.locator('#move-period').select_option('1')
 page.once('dialog',lambda d:asyncio.create_task(d.accept()))
 await page.locator('#move-form button[type="submit"]').click()
 await page.wait_for_timeout(400)
 status=await page.evaluate("({edit:__tkb().edit,wk10:conflicts(eventsForWeek(__tkb().data,'2026-11-09')).length,wk11:conflicts(eventsForWeek(__tkb().data,'2026-11-16')).length,changes:__tkb().data.changes.length})")
 assert status['wk10']==0 and status['wk11']==1 and status['changes']==1 and status['edit'] is None,status
 # Switch to week 11, delete exact Tin conflicted only in that week, preserve Toan.
 await page.locator('[data-action="next-week"]').click()
 await page.locator('.compact-warning summary').click()
 await page.locator('.conflict-options [data-action="start-delete-main"][data-id="S-TIN-14"]').click()
 assert await page.locator('#delete-scope').input_value()=='future'
 await page.screenshot(path=str(OUT/(name+'_delete_dialog.png')))
 page.once('dialog',lambda d:asyncio.create_task(d.accept()))
 await page.locator('[data-action="confirm-delete-main"]').click()
 await page.wait_for_timeout(450)
 status2=await page.evaluate("({wk10:conflicts(eventsForWeek(__tkb().data,'2026-11-09')).length,wk11:conflicts(eventsForWeek(__tkb().data,'2026-11-16')).length,wk12:conflicts(eventsForWeek(__tkb().data,'2026-11-23')).length,versions:__tkb().data.versions.length})")
 assert status2['wk11']==0 and status2['wk12']==0 and status2['versions']==2,status2
 assert status2['wk10']==0,'Existing single-week adjustment must still exist'
 # Copy an unrelated existing math lesson then paste onto an empty Saturday cell.
 await page.locator('[data-action="prev-week"]').click()
 # original conflict now no longer conflicts in this week; pick an existing math cell via DOM
 target=page.locator('.cell[data-date="2026-11-10"][data-shift="S"][data-period="4"]')
 await target.click()
 await page.locator('.main-entry-actions [data-action="copy-main"]').click()
 await page.locator('.cell[data-date="2026-11-14"][data-shift="S"][data-period="1"]').click()
 await page.locator('[data-action="start-paste-main"]').click()
 await page.locator('#move-scope').select_option('one')
 await page.screenshot(path=str(OUT/(name+'_copy_paste.png')))
 page.once('dialog',lambda d:asyncio.create_task(d.accept()))
 await page.locator('#move-form button[type="submit"]').click()
 await page.wait_for_timeout(300)
 status3=await page.evaluate("({hasOriginal:eventsForWeek(__tkb().data,'2026-11-09').some(x=>x.date==='2026-11-10'&&x.shift==='S'&&x.period===4&&x.subject==='Toán'),hasCopy:eventsForWeek(__tkb().data,'2026-11-09').some(x=>x.date==='2026-11-14'&&x.shift==='S'&&x.period===1&&x.subject==='Toán'),errors:__tkb().notice,width:document.documentElement.scrollWidth,inner:innerWidth})")
 assert status3['hasOriginal'] and status3['hasCopy'],status3
 assert status3['width']<=status3['inner']+2,status3
 assert not errs,errs
 print(name,'PASS',status3)
async def run():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('desktop',1440,900),('phone',390,844)]:
   page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   try:await scenario(page,name,w)
   except Exception:
    print(name,'FAILED:',(await page.locator('body').inner_text())[:1600])
    await page.screenshot(path=str(OUT/(name+'_error.png')))
    raise
   finally:await page.close()
  await browser.close()
asyncio.run(run())
