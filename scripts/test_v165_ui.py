import asyncio,re,json
from pathlib import Path
from playwright.async_api import async_playwright
R=Path('/mnt/data/Smart_TKB_V1_6_5_Fix'); OUT=R/'screenshots_v165';OUT.mkdir(exist_ok=True)
seed=json.loads((R/'public/seed.json').read_text()); seed.update(extra_patterns=[],extra_sessions=[],audit_log=[],ppct_overrides=[])
core=(R/'src/core.js').read_text().replace('export ','')
cache=(R/'src/cache.js').read_text().replace('export ','').replace('localStorage','PREVIEW_STORAGE')
imp=(R/'src/importExcel.js').read_text().replace('export ','')
main=re.sub(r'^import .*?;\n','',(R/'src/main.js').read_text(),flags=re.M).replace('localStorage','PREVIEW_STORAGE')
setup='''
const PREVIEW_STORAGE={_v:{},getItem(k){return this._v[k]??null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};
const MOCK_DATA=__SEED__;
let mockLoggedIn=false;
const mockResp=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
const fetch=async (url,opt={})=>{
 const path=String(url),body=opt.body?JSON.parse(opt.body):{};
 if(path.includes('action=session'))return mockResp({ok:true,authenticated:mockLoggedIn,backendConfigured:true,apiVersion:'1.6.5',code:mockLoggedIn?'AUTHENTICATED':'UNAUTHENTICATED'});
 if(path.includes('action=version'))return mockResp({ok:true,apiVersion:'1.6.5',release:'v1.6.5',commit:'local'});
 if(path==='/api/login') {mockLoggedIn=true;return mockResp({ok:true,authenticated:true,apiVersion:'1.6.5'});}
 if(path==='/api/tkb'&&!mockLoggedIn)return mockResp({ok:false,code:'UNAUTHENTICATED',error:'Chưa đăng nhập'},401);
 if(path==='/api/tkb'&&(!opt.method||opt.method==='GET'))return mockResp({ok:true,data:MOCK_DATA,apiVersion:'1.6.5',gasVersion:'1.6.5'});
 if(body.op==='probeExtra')return mockResp({ok:true,apiVersion:'1.6.5',gasVersion:'1.6.5',extraWrites:true,verifiedWrites:true,supportedActions:['CREATE','EDIT_FUTURE']});
 if(body.op==='reviseMainSchedule'){
  const preview=previewMainRevision(normalizeSheetData(MOCK_DATA),{sourceSlotId:body.sourceSlotId,fromDate:body.fromDate,...body.patch});
  if(preview.version.id!==body.expectedVersionId)return mockResp({ok:false,code:'VERSION_CONFLICT',error:'Phiên bản sai'},409);
  const id='zzzz-TKB-'+body.fromDate+'-9999999999999';
  MOCK_DATA.versions.push({...preview.version,id,fromDate:body.fromDate});
  MOCK_DATA.slots.push(...preview.slots.map(x=>({...x,versionId:id})));
  return mockResp({ok:true,verified:true,versionId:id,sourceSlotId:body.sourceSlotId,fromDate:body.fromDate});
 }
 return mockResp({ok:false,code:'UNSUPPORTED_ACTION',error:'Không hỗ trợ'},400);
};
'''.replace('__SEED__',json.dumps(seed,ensure_ascii=False))
html='''<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>__CSS__</style></head><body><div id="app"></div><script>__JS__</script></body></html>'''.replace('__CSS__',(R/'src/style.css').read_text()).replace('__JS__',(setup+core+'\n'+cache+'\n'+imp+'\n'+main).replace('</script>','<\\/script>'))
async def run():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('phone',390,844),('desktop',1440,900)]:
   page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.set_content(html,wait_until='load')
   print('INIT',name,'pageerrors',errors,'content', (await page.locator('body').inner_text())[:300]); await page.locator('#login-pass').fill('test-password-not-real',timeout=4000)
   await page.locator('[data-action=login]').first.click()
   await page.wait_for_timeout(1600); print('POSTLOGIN',name,errors,(await page.locator('body').inner_text())[:500]); await page.locator('.compact-warning').first.wait_for(timeout=3000)
   await page.locator('.compact-warning summary').first.click()
   await page.locator('[data-action=start-move][data-id="S-TIN-14"]').first.click()
   await page.locator('#move-form').wait_for(timeout=5000)
   await page.screenshot(path=str(OUT/(name+'_persistent_edit.png')),full_page=False)
   assert await page.locator('#move-scope').input_value()=='future'
   await page.locator('#move-date').select_option('2026-11-13')
   await page.locator('#move-shift').select_option('S')
   await page.locator('#move-period').select_option('1')
   page.once('dialog', lambda d:asyncio.create_task(d.accept()))
   await page.locator('#move-form button[type=submit]').click()
   await page.wait_for_timeout(900)
   result=await page.evaluate("({edit:$state.edit, version:activeVersion($state.data,'2026-11-16').id,conflicts:conflicts(eventsForWeek($state.data,'2026-11-16')).length,slotCount:$state.data.slots.length,doc:document.documentElement.scrollWidth,win:innerWidth})")
   print(name,result,'errors',errors)
   assert result['conflicts']==0 and result['slotCount']==36 and result['edit']==None
   assert result['doc']<=result['win']+2
   assert not errors
   await page.close()
  await browser.close()
asyncio.run(run())
