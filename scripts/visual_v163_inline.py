import asyncio,re,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'screenshots_v163';OUT.mkdir(exist_ok=True)
core=(ROOT/'src/core.js').read_text().replace('export ','')
imp=(ROOT/'src/importExcel.js').read_text().replace('export ','')
main=re.sub(r'^import .*?;\n','',(ROOT/'src/main.js').read_text(),flags=re.M).replace('localStorage','PREVIEW_STORAGE')
seed=json.loads((ROOT/'public/seed.json').read_text())
names=['8A_NC','8A_NC','9A_NC','9A_NC','10','10','8B_CB','12']
patterns=[dict(id=f'test-pattern-{i}',day=8 if i<6 else 2,shift='S' if i<4 else 'C' if i<6 else 'T',period=i%2+1,subject='Toán',groups=[n],fromDate='2026-11-09',active=True,repeatRule='weekly',startLesson=1) for i,n in enumerate(names)]
seed.update(extra_patterns=patterns,extra_sessions=[],audit_log=[])
setup='''
const PREVIEW_STORAGE={_v:{},getItem(k){return this._v[k]??null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};
const MOCK_DATA=__SEED__;
let mockLoggedIn=false;
const mockResp=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
const fetch=async (url,opt={})=>{
 const path=String(url);const body=opt.body?JSON.parse(opt.body):{};
 if(path.includes('action=session'))return mockResp({ok:true,authenticated:mockLoggedIn,backendConfigured:true,apiVersion:'1.6.3',code:mockLoggedIn?'AUTHENTICATED':'UNAUTHENTICATED'});
 if(path==='/api/login'){
  if(body.password==='test-v163-browser-only'){mockLoggedIn=true;return mockResp({ok:true,authenticated:true,apiVersion:'1.6.3'});}
  return mockResp({ok:false,code:'INVALID_CREDENTIALS',error:'Mật khẩu không đúng'},401);
 }
 if(path==='/api/tkb'&&(!mockLoggedIn))return mockResp({ok:false,code:'UNAUTHENTICATED',error:'Chưa đăng nhập'},401);
 if(path==='/api/tkb'&&(!opt.method||opt.method==='GET'))return mockResp({ok:true,data:MOCK_DATA,apiVersion:'1.6.3',gasVersion:'1.6.2'});
 if(body.op==='probeExtra')return mockResp({ok:true,apiVersion:'1.6.2',extraWrites:true,verifiedWrites:true,supportedActions:['CREATE','EDIT_FUTURE','EDIT_ONCE']});
 if(body.op==='listExtra')return mockResp({ok:true,patterns:MOCK_DATA.extra_patterns,sessions:MOCK_DATA.extra_sessions,counts:{patterns:8,exceptions:0},apiVersion:'1.6.2'});
 return mockResp({ok:false,code:'UNSUPPORTED_ACTION',error:'Không hỗ trợ thao tác'},400);
};
'''.replace('__SEED__',json.dumps(seed,ensure_ascii=False))
html='''<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>__CSS__</style></head><body><div id="app"></div><script>__JS__</script></body></html>'''.replace('__CSS__',(ROOT/'src/style.css').read_text()).replace('__JS__',(setup+core+'\n'+imp+'\n'+main).replace('</script>','<\\/script>'))
async def mainfn():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('desktop',1440,900),('phone',390,844)]:
   page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.set_content(html,wait_until='load')
   await page.get_by_text('Đăng nhập Smart TKB').wait_for(timeout=10000)
   await page.screenshot(path=str(OUT/f'{name}_login.png'),full_page=True)
   await page.locator('#login-pass').fill('test-v163-browser-only')
   await page.locator('[data-action=login]').click()
   await page.locator('.brandtext').wait_for(state='attached',timeout=10000)
   await page.locator('.menu-toggle').first.dispatch_event('click')
   await page.locator('[data-view=extraList]').first.click()
   await page.locator('.data-table tbody tr').first.wait_for(timeout=10000)
   assert await page.locator('.data-table tbody tr').count()==8
   await page.screenshot(path=str(OUT/f'{name}_extras.png'),full_page=True)
   # Simulate reload / re-initialization while session is already authenticated
   await page.evaluate('init()')
   await page.locator('.data-table tbody tr').first.wait_for(timeout=10000)
   assert await page.locator('.data-table tbody tr').count()==8
   sizes=await page.evaluate('({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,win:innerWidth})')
   print(name,'rows=',await page.locator('.data-table tbody tr').count(),'size=',sizes,'errors=',errors)
   assert not errors
   assert sizes['doc']<=sizes['win']+2,(name,sizes)
   await page.close()
  await browser.close()
asyncio.run(mainfn())
