// Isolated development profiles only; never attach to the owner's browser storage.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const url = process.env.WINCHESTER_PREVIEW || 'http://localhost:8084/online-games/';
const report = {url,checks:[],errors:[],missing:[],unlabelled:[]};
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    const page = await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('response',response=>{if(response.status()===404&&response.url().startsWith(new URL(url).origin))report.missing.push(response.url());});
    await page.goto(url);
    await page.waitForFunction(()=>window.ZeroHDeviceTransfer&&window.ZeroHApps);
    await page.waitForFunction(()=>[...document.images].filter(img=>img.getBoundingClientRect().width>0).every(img=>img.complete&&img.naturalWidth>0)).catch(async error=>{
      report.images=await page.locator('img').evaluateAll(nodes=>nodes.filter(img=>img.getBoundingClientRect().width>0).map(img=>({src:img.currentSrc,complete:img.complete,width:img.naturalWidth})));
      throw error;
    });
    assert.match(await page.locator('.winchester-desktop-brand p').textContent(),/Version 3/);
    assert.ok(await page.evaluate(()=>crossOriginIsolated));
    await page.locator('#setupWindow [data-window-action="close"]').click();
    const appNames = await page.locator('[data-app]').evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.app))].filter(name=>!['game'].includes(name)));
    for(const name of appNames){
      await page.evaluate(name=>window.ZeroHDesktop.openApp(name),name);
      const window = page.locator(`.window[data-app="${name}"]`);
      if(await window.count()) {
        const fields=await window.locator('input:not([type="hidden"]),select,textarea').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().width&&node.getBoundingClientRect().height)
          .filter(node=>!node.labels?.length&&!node.getAttribute('aria-label')&&!node.getAttribute('aria-labelledby'))
          .map(node=>({id:node.id,type:node.type,placeholder:node.placeholder,parent:node.parentElement.className})));
        report.unlabelled.push(...fields.map(field=>({app:name,...field})));
        const close=window.locator('[data-window-action="close"]');
        if(await close.isVisible())await close.click();
      }
    }
    report.checks.push(`Opened ${appNames.length} desktop apps; visible field labels and resource loads checked`);
    await page.evaluate(()=>window.ZeroHDesktop.openApp('browser'));
    await page.locator('#browserAddress').fill('abc.com:invalid-port');
    await page.locator('#browserAddressForm button').click();
    assert.match(await page.locator('#browserAddress').inputValue(),/^https:\/\/duckduckgo.com\/\?q=/);
    await page.evaluate(()=>{
      const frame=document.querySelector('#browserFrame');
      frame.removeAttribute('src');frame.srcdoc='<!doctype html><title>Sandbox probe</title><p>Isolated page</p>';
    });
    const inner=page.frameLocator('#browserFrame');
    await inner.locator('p').waitFor();
    const access=await inner.locator('p').evaluate(()=>{
      try { return {parentReadable:Boolean(parent.document.querySelector('#desktop'))}; }
      catch(error){return {parentReadable:false,error:error.name};}
    });
    assert.equal(access.parentReadable,false);assert.equal(access.error,'SecurityError');
    await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.__inlineProbe=true';document.head.append(script);});
    assert.equal(await page.evaluate(()=>Boolean(window.__inlineProbe)),false);
    report.checks.push('Same-origin embedded frame blocked from parent; inline script blocked by CSP; malformed URL safe');
    const network=await page.evaluate(async()=>{
      const response=await fetch(new URL('./build-info.json',document.baseURI),{cache:'no-store'});
      return {nosniff:response.headers.get('x-content-type-options'),referrer:response.headers.get('referrer-policy'),info:await response.json()};
    });
    assert.equal(network.nosniff,'nosniff');assert.equal(network.referrer,'no-referrer');
    assert.equal(network.info.projectVersion,'3.0.0-preview.1');
    await page.locator('#browserWindow [data-window-action="close"]').click();
    await page.evaluate(()=>window.ZeroHDesktop.openApp('transfer'));
    await page.locator('#transferNetworkSettings summary').click();
    await page.waitForFunction(()=>document.querySelector('#transferNetworkStatus').textContent.includes('Both devices use it automatically'));
    assert.equal(await page.locator('#transferRelayPassword').inputValue(),'');
    await page.screenshot({path:'output/playwright/winchester-v3-transfer.png'});
    await page.locator('#transferWindow [data-window-action="close"]').click();
    await page.screenshot({path:'output/playwright/winchester-v3-desktop.png'});
    report.checks.push('Version 3 metadata, service-worker response protections, automatic relay and blank manual credentials');
    await context.close();
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const mp=await mobile.newPage();
    mp.on('pageerror',error=>report.errors.push(error.message));
    await mp.goto(url);await mp.waitForFunction(()=>window.ZeroHApps&&window.ZeroHDeviceTransfer);
    await mp.locator('#setupWindow [data-window-action="close"]').click();
    for(const app of ['settings','transfer','programs']){
      await mp.evaluate(app=>window.ZeroHDesktop.openApp(app),app);
      assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${app} fits mobile viewport`);
      await mp.locator(`.window[data-app="${app}"] [data-window-action="close"]`).click();
    }
    await mp.evaluate(()=>window.ZeroHDesktop.openApp('settings'));
    await mp.screenshot({path:'output/playwright/winchester-v3-mobile.png'});
    report.checks.push('390px touch settings, transfer and library; reduced motion');
    await mobile.close();
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);assert.deepEqual(report.unlabelled,[]);
    report.status='passed';
    await fs.writeFile(process.env.WINCHESTER_REPORT || '.local/v3-browser-verification.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);console.error(JSON.stringify(report,null,2));process.exitCode=1;});
