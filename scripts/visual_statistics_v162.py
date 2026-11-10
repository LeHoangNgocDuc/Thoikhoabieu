import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots_v162'
OUT.mkdir(exist_ok=True)
def html():
 core=(ROOT/'src/core.js').read_text().replace('export ','')
 imp=(ROOT/'src/importExcel.js').read_text().replace('export ','')
 main=(ROOT/'src/main.js').read_text()
 main=re.sub(r'^import .*?;\n','',main,flags=re.M)
 main=main.replace("const seed=await fetch('/seed.json').then(r=>r.json());","const seed=PREVIEW_SEED;")
 main=main.replace("const sess=await fetch('/api/tkb?action=session').then(r=>r.json());","const sess={authenticated:false,backendConfigured:false};")
 main=main.replace('localStorage','PREVIEW_STORAGE')
 seed=json.dumps(json.loads((ROOT/'public/seed.json').read_text()),ensure_ascii=False)
 js='const PREVIEW_STORAGE={getItem:key=>key===\"smart-tkb-focus-v14\"?\"off\":null,setItem:()=>{}};const PREVIEW_SEED='+seed+';\n'+core+'\n'+imp+'\n'+main
 css=(ROOT/'src/style.css').read_text()
 return '<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script type="module">'+js.replace('</script>','<\\/script>')+'</script></body></html>'
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('phone',390,844),('tablet',820,1180),('desktop',1440,900)]:
   page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
   await page.set_content(html(),wait_until='load')
   await page.wait_for_selector('.timetable',timeout=6000)
   if w<800:
    toggle=page.locator('[data-action="toggle-drawer"]')
    if await toggle.count():await toggle.first.click()
   await page.locator('[data-view="statistics"]').first.click()
   await page.wait_for_selector('.stats-table',timeout=5000)
   await page.screenshot(path=str(OUT/f'{name}_statistics.png'),full_page=True)
   values=await page.evaluate('''() => ({body:document.body.scrollWidth,win:innerWidth,tableRows:document.querySelectorAll('.stats-table tbody tr').length,heading:document.querySelector('.pagehead h2')?.textContent,summary:document.querySelector('.statistics-summary')?.textContent?.trim()?.slice(0,160)})''')
   print(name, 'errors=',errs, 'view=',values)
   if errs:raise Exception(f'{name}: {errs}')
   if values['body']>values['win']+2:raise Exception(f'Horizontal overflow {name}: {values}')
   assert values['tableRows']==12
   await page.close()
  await browser.close()
asyncio.run(run())
