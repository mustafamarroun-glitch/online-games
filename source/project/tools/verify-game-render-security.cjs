// Test-only interception exposes existing controllers in an isolated browser.
// No debugging hook is added to the published application.
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext();
    await context.route('**/coi-direct.js',route=>route.fulfill({contentType:'text/javascript',body:'// Isolated test fixture: no engine launch or service-worker redirect.'}));
    await context.route('**/launcher-games.mjs',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:await response.text()+'\nwindow.__loadGameForSecurityTest=(id,state)=>controllers.get(id).load(state);'});
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('launcher.html',process.env.WINCHESTER_PREVIEW||'http://localhost:8084/online-games/').href);
    await page.waitForFunction(()=>window.__loadGameForSecurityTest);
    const result=await page.evaluate(()=>{
      const attack='<img data-game-attack src="invalid" onerror="alert(1)">';
      for(const id of ['internethearts','spades']) {
        const state=window.ZeroHGames.snapshot(id);
        if(id==='internethearts'){state.scores[0]=attack;state.roundPoints[0]=attack;}
        else {state.teamScores[0]=attack;state.round=attack;state.bids[1]=attack;state.tricksWon[1]=attack;}
        state.hands[1][0].suit=attack;
        state.hands[1][0].rank=attack;
        window.__loadGameForSecurityTest(id,state);
      }
      return {injected:document.querySelectorAll('[data-game-attack]').length,text:document.querySelector('[data-game-root="internethearts"] [data-trick-score]').textContent};
    });
    assert.equal(result.injected,0);assert.ok(result.text.includes('<img data-game-attack'));assert.deepEqual(errors,[]);
    const report={status:'passed',checks:['Host-supplied card suits/ranks, scores, round points, bids and trick counts render as text'],errors};
    await fs.writeFile('.local/v3-game-render-verification.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
