import asyncio,re,json
from pathlib import Path
from playwright.async_api import async_playwright
R=Path('/mnt/data/tkb_v164_work');OUT=R/'screenshots_v164';OUT.mkdir(exist_ok=True)
core=(R/'src/core.js').read_text().replace('export ','')
cache=(R/'src/cache.js').read_text().replace('export ','').replace('localStorage','PREVIEW_STORAGE')
imp=(R/'src/importExcel.js').read_text().replace('export ','')
main=re.sub(r'^import .*?;\n','',(R/'src/main.js').read_text(),flags=re.M).replace('localStorage','PREVIEW_STORAGE')
seed=json.loads((R/'public/seed.json').read_text())
names=['8A_NC','8A_NC','9A_NC','9A_NC','10','10','8B_CB','12']
patterns=[dict(id=f'test-pattern-{i}',day=8 if i<6 else 2,shift='S' if i<4 else 'C' if i<6 else 'T',period=i%2+1,subject='Toán',groups=[n],fromDate='2026-11-09',active=True,repeatRule='weekly',startLesson=1) for i,n in enumerate(names)]
seed.update(extra_patterns=patterns,extra_sessions=[],audit_log=[],extra_requests=[])
setup='''
const PREVIEW_STORAGE={_v:{},getItem(k){return this._v[k]??null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};
const MOCK_DATA=__SEED__;
let mockLoggedIn=false, mockOffline=false;
const mockResp=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
const fetch=async (url,opt={})=>{
 if(mockOffline)throw Error('Connection lost');
 const path=String(url),body=opt.body?JSON.parse(opt.body):{};
 if(path.includes('action=session'))return mockResp({ok:true,authenticated:mockLoggedIn,backendConfigured:true,apiVersion:'1.6.4',code:mockLoggedIn?'AUTHENTICATED':'UNAUTHENTICATED'});
 if(path==='/api/login'){
  if(body.password==='test-v164-browser-only'){mockLoggedIn=true;return mockResp({ok:true,authenticated:true,apiVersion:'1.6.4'});}
  return mockResp({ok:false,code:'INVALID_CREDENTIALS',error:'Mật khẩu không đúng'},401);
 }
 if(path==='/api/tkb'&&(!mockLoggedIn))return mockResp({ok:false,code:'UNAUTHENTICATED',error:'Chưa đăng nhập'},401);
 if(path==='/api/tkb'&&(!opt.method||opt.method==='GET'))return mockResp({ok:true,data:MOCK_DATA,apiVersion:'1.6.4',gasVersion:'1.6.4'});
 if(body.op==='probeExtra')return mockResp({ok:true,apiVersion:'1.6.4',extraWrites:true,verifiedWrites:true,supportedActions:['CREATE','EDIT_FUTURE','EDIT_ONCE']});
 if(body.op==='listExtra')return mockResp({ok:true,patterns:MOCK_DATA.extra_patterns,sessions:MOCK_DATA.extra_sessions,counts:{patterns:8,exceptions:0},apiVersion:'1.6.4'});
 return mockResp({ok:false,code:'UNSUPPORTED_ACTION',error:'Không hỗ trợ thao tác'},400);
};
'''.replace('__SEED__',json.dumps(seed,ensure_ascii=False))
html='''<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>__CSS__</style></head><body><div id="app"></div><script>__JS__</script></body></html>'''.replace('__CSS__',(R/'src/style.css').read_text()).replace('__JS__',(setup+core+'\n'+cache+'\n'+imp+'\n'+main).replace('</script>','<\\/script>'))
async def mainfn():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('phone',390,844),('desktop',1440,900)]:
   page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
   await page.set_content(html,wait_until='load')
   await page.locator('#login-pass').fill('test-v164-browser-only')
   await page.locator('[data-action=login]').first.click()
   await page.locator('.brandtext').wait_for(state='attached',timeout=10000)
   await page.screenshot(path=str(OUT/(name+'_live.png')),full_page=False)
   await page.locator('.compact-warning summary').first.click()
   await page.locator('[data-action=start-move]').first.click()
   await page.wait_for_timeout(300)
   print('MOVE_DIAG',name,await page.locator('.notice').all_text_contents(),await page.evaluate('$state.edit'),errors)
   await page.locator('#move-form').wait_for(timeout=1500)
   await page.screenshot(path=str(OUT/(name+'_move_editor.png')),full_page=False)
   await page.locator('[data-action=close-modal]').last.click()
   await page.evaluate('mockOffline=true; mockLoggedIn=false; init()')
   await page.locator('.cache-notice').first.wait_for(timeout=10000)
   await page.screenshot(path=str(OUT/(name+'_offline_cache.png')),full_page=False)
   dims=await page.evaluate('({doc:document.documentElement.scrollWidth,win:innerWidth,mode:$state.mode,slotCount:$state.data?.slots?.length})')
   print(name,dims,'errors',errors)
   assert dims['mode']=='cached' and dims['slotCount']==18
   assert dims['doc']<=dims['win']+2
   assert not errors
   await page.close()
  await browser.close()
asyncio.run(mainfn())
