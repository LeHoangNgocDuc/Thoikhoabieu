import asyncio,json,re
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path('/mnt/data/Smart_TKB_V1_6_1');OUT=ROOT/'screenshots';OUT.mkdir(exist_ok=True)
def html():
 core=(ROOT/'src/core.js').read_text().replace('export ','')
 imp=(ROOT/'src/importExcel.js').read_text().replace('export ','')
 main=(ROOT/'src/main.js').read_text();main=re.sub(r'^import .*?;\n','',main,flags=re.M)
 main=main.replace("const seed=await fetch('/seed.json').then(r=>r.json());","const seed=PREVIEW_SEED;")
 main=main.replace("const sess=await fetch('/api/tkb?action=session').then(r=>r.json());","const sess={authenticated:false,backendConfigured:false};")
 main=main.replace('localStorage','PREVIEW_STORAGE')
 seed=json.dumps(json.loads((ROOT/'public/seed.json').read_text()),ensure_ascii=False)
 js='const PREVIEW_STORAGE={getItem:()=>null,setItem:()=>{}};const PREVIEW_SEED='+seed+';\n'+core+'\n'+imp+'\n'+main
 # ensure no closing script in source
 js=js.replace('</script>','<\\/script>')
 css=(ROOT/'src/style.css').read_text()
 return '<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script type="module">'+js+'</script></body></html>'
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('mobile',390,844),('desktop',1440,900),('tablet',820,1180)]:
   context=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
   page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.set_content(html(),wait_until='load')
   await page.wait_for_selector('.timetable',timeout=4000)
   await page.screenshot(path=str(OUT/f'{name}_week.png'),full_page=True)
   print(name,'errors',errors,'scroller',await page.evaluate('''() => ({bodyWidth: document.body.scrollWidth, innerWidth: innerWidth, tableHeight: document.querySelector('.week-scroller')?.clientHeight, contentHeight: document.querySelector('.content')?.clientHeight, hasGrid:!!document.querySelector('.timetable')})'''))
   await page.locator('[data-action="layout-day"]').click()
   await page.screenshot(path=str(OUT/f'{name}_day.png'),full_page=True)
   print(name,'day cards',await page.locator('.day-event').count())
   await page.locator('.menu-toggle').click()
   await page.locator('.sidebar [data-view="extra"]').click()
   await page.locator('[data-action="select-day"][data-day="7"]').click()
   await page.locator('.day-event').last.click()
   await page.screenshot(path=str(OUT/f'{name}_editor.png'),full_page=True)
   print(name,'modal',await page.locator('#extra-form').count(),'inputs',await page.locator('[data-extra-class]').count())
   await page.locator('[data-extra-class="7F38"]').check()
   await page.locator('[data-extra-class="7F39"]').check()
   await page.locator('#extra-free-classes').fill('Nhóm nâng cao Toán 9')
   await page.locator('#extra-lesson-title').fill('Luyện tập nâng cao')
   await page.locator('#extra-form [type=submit]').click()
   print(name,'save-state',await page.locator('.notice').inner_text(), 'events',await page.locator('.day-entry').count())
   await page.locator('[data-action="next-week"]').click()
   print(name,'recurrence-week-11',await page.locator('.day-entry').count(),'notes', (await page.locator('.day-board').inner_text())[-180:])
   await page.screenshot(path=str(OUT/f'{name}_recurrence.png'),full_page=True)
   await context.close()
  await browser.close()
asyncio.run(run())
