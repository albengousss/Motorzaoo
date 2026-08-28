const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  const res1 = await page.evaluate(async () => {
    // MathEngine is not exported globally. We need to evaluate via giac directly.
    const m = window.Module;
    const evalGiac = m.cwrap('caseval', 'string', ['string']);
    return evalGiac("usr_M:=[[2,2],[3,4]]");
  });
  console.log('RES1:', res1);

  const res2 = await page.evaluate(async () => {
    return window.Module.cwrap('caseval', 'string', ['string'])("usr_N:=[[8,9],[3,7]]");
  });
  console.log('RES2:', res2);

  const res3 = await page.evaluate(async () => {
    return window.Module.cwrap('caseval', 'string', ['string'])("usr_M * usr_N");
  });
  console.log('RES3:', res3);

  await browser.close();
})();
