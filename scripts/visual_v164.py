import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
OUT=Path('/mnt/data/tkb_v164_work/screenshots_v164');OUT.mkdir(exist_ok=True)
URL='http://localhost:36309'
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for name,w,h in [('phone',390,844),('desktop',1440,900)]:
   page=await browser.new_page(viewport={'width':w,'height':h}, device_scale_factor=1)
   errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
   await page.goto(URL,wait_until='domcontentloaded')
   await page.locator('#login-pass').fill('test-v163-browser-only')
   await page.locator('[data-action="login"]').click()
   await page.locator('.brandtext').wait_for(timeout=12000)
   await page.wait_for_timeout(300)
   await page.screenshot(path=str(OUT/(name+'_live.png')),full_page=False)
   # Navigate to saved extras
   if name=='phone':
    await page.locator('.top-menu-toggle').first.click()
   await page.locator('[data-view="extraList"]').first.click()
   await page.locator('.data-table tbody tr').first.wait_for(timeout=12000)
   count=await page.locator('.data-table tbody tr').count()
   assert count==8,(name,count)
   await page.screenshot(path=str(OUT/(name+'_extras.png')),full_page=False)
   # Startup from last known good cache while HTTP API is unavailable
   await page.route('**/api/tkb**',lambda route: route.abort())
   await page.reload(wait_until='domcontentloaded')
   await page.locator('.cache-notice').wait_for(timeout=10000)
   assert await page.locator('.timetable').count()>0,(name,'no cached timetable')
   await page.screenshot(path=str(OUT/(name+'_offline_cached.png')),full_page=False)
   dims=await page.evaluate('({doc:document.documentElement.scrollWidth,window:innerWidth})')
   print(name,'list_rows',count,'cached_board',await page.locator('.timetable').count(),'dims',dims,'page_errors',errors)
   assert not errors
   assert dims['doc']<=dims['window']+2
   await page.close()
  await browser.close()
asyncio.run(main())
