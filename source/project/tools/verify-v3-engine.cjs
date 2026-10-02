// Fresh profile and actual local files. No owner browser data is touched.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const path=require('node:path');
 const profile=await fs.mkdtemp(path.resolve('.local/v3-engine-profile-'));
 const context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:900},args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const report={checks:[],errors:[],violations:[],renderDiagnostics:[]};
 let timer;
 try {
  assert.ok(process.env.ZERO_HOUR_DATA,'ZERO_HOUR_DATA is required');
  await context.addInitScript(()=>{window.showDirectoryPicker=undefined;window.__v3Toasts=[];document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const text=document.querySelector('#toastRegion')?.textContent;if(text&&!window.__v3Toasts.includes(text))window.__v3Toasts.push(text);}).observe(document.body,{childList:true,subtree:true}));document.addEventListener('securitypolicyviolation',e=>console.log('V3_POLICY_VIOLATION:'+e.violatedDirective+':'+e.blockedURI));});
  const page=await context.newPage();
  timer=setInterval(async()=>console.log(JSON.stringify({stage:report.stage,progress:await page.locator('#libraryProgressCopy').textContent().catch(()=>''),toasts:await page.evaluate(()=>window.__v3Toasts).catch(()=>[]),error:report.errors.slice(-1)})),20000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',message=>{if(message.text().startsWith('V3_POLICY_VIOLATION:'))report.violations.push(message.text());if(/webgl|shader|fail|error|\[play\] boot/i.test(message.text())){report.renderDiagnostics.push(message.text().slice(0,400));if(report.renderDiagnostics.length>32)report.renderDiagnostics.shift();}});
  await page.goto(process.env.WINCHESTER_PREVIEW||'http://localhost:8084/online-games/');
  await page.waitForFunction(()=>window.ZeroHAssetLibrary);
  report.stage='Selecting actual local files';
  await page.locator('#folderInput').setInputFiles(process.env.ZERO_HOUR_DATA);
  report.stage='Scanning compatible archives';
  await page.locator('#prepareLibraryButton').waitFor({state:'visible',timeout:120000});
  await page.locator('#prepareLibraryButton').click();
  report.stage='Preparing selected archives';
  await page.waitForFunction(()=>window.ZeroHAssetLibrary.summary().ready||window.__v3Toasts.some(text=>text.includes('Library preparation failed')),null,{timeout:180000});
  assert.ok(await page.evaluate(()=>window.ZeroHAssetLibrary.summary().ready),await page.evaluate(()=>window.__v3Toasts.join('\n')));
  report.checks.push('Actual compatible game archives selected and prepared in isolated browser storage');
  const frameLoop=page.waitForEvent('console',{predicate:message=>message.text().includes('[play] threaded frame loop started'),timeout:180000});
  report.stage='Booting actual engine';
  await page.locator('.launch-button[data-launch-game]').click();
  await frameLoop;
  report.checks.push('Real Zero Hour threaded frame loop under Version 3 security policy');
  report.boot='passed';
  let rendered=false;
  try { for(let attempt=0;attempt<12;attempt++){
    await page.waitForTimeout(5000);
    const shot=await page.screenshot({timeout:15000});
    const stats=await require('sharp')(shot).stats();
    if(stats.channels.slice(0,3).some(channel=>channel.mean>5)){
      await fs.writeFile('output/playwright/winchester-v3-engine.png',shot);rendered=true;break;
    }
  }} catch(error){report.graphicsIssue=error.message;}
  report.graphics=rendered?'visible pixels captured':'unverified: isolated headless capture did not complete';
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.violations,[]);
  if(rendered)report.checks.push('Visible game graphics captured');
  report.status=rendered?'passed':'partial: engine boot passed; graphics capture unverified';
 } catch(error){report.status='failed';report.failure=error.message;process.exitCode=1;}
 finally{clearInterval(timer);await fs.writeFile('.local/v3-engine-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();if(!profile.startsWith(path.resolve('.local')+path.sep+'v3-engine-profile-'))throw new Error('Unsafe test profile cleanup');await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:300});}
})();
