import asyncio,subprocess,re,sys,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'screenshots_v163'
OUT.mkdir(exist_ok=True)
async def main():
 proc=subprocess.Popen(['node',str(ROOT/'scripts/local_v163_server.mjs')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 url=proc.stdout.readline().strip().split('=',1)[1]
 try:
  async with async_playwright() as pw:
   browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   desktop=await browser.new_context(viewport={'width':1440,'height':900})
   mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1,has_touch=True)
   reports=[]
   for label,ctx in [('desktop',desktop),('phone',mobile)]:
    page=await ctx.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
    await page.goto(url,wait_until='networkidle')
    await page.get_by_text('Đăng nhập Smart TKB').wait_for()
    await page.screenshot(path=str(OUT/f'{label}_login.png'),full_page=True)
    await page.locator('#login-pass').fill('test-v163-browser-only')
    await page.locator('[data-action=login]').click()
    await page.locator('.brandtext').wait_for()
    if label=='phone':
     await page.locator('[data-action=toggle-drawer]').first.click()
    await page.locator('[data-view=extraList]').first.click()
    await page.locator('.data-table tbody tr').first.wait_for()
    await page.wait_for_timeout(200)
    rows=await page.locator('.data-table tbody tr').count()
    assert rows==8,(label,rows)
    await page.screenshot(path=str(OUT/f'{label}_extras.png'),full_page=True)
    await page.reload(wait_until='networkidle')
    await page.locator('.brandtext').wait_for()
    # after reload starts in calendar view; menu again to verify list still available
    if label=='phone':await page.locator('[data-action=toggle-drawer]').first.click()
    await page.locator('[data-view=extraList]').first.click()
    await page.locator('.data-table tbody tr').first.wait_for()
    assert await page.locator('.data-table tbody tr').count()==8
    width=await page.evaluate('({body:document.body.scrollWidth,win:innerWidth})')
    reports.append((label,rows,width,errs))
    assert not errs,(label,errs)
    assert width['body']<=width['win']+2,(label,width)
    await page.close()
   await browser.close()
   for r in reports:print('PASS',r)
 finally:
  proc.terminate();proc.wait(timeout=10)
asyncio.run(main())
