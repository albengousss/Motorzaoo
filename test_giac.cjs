const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  await page.waitForFunction('window.giacReady === true');
  
  const res1 = await page.evaluate(async () => {
    return window.Module.cwrap('caseval', 'string', ['string'])("diff(x, x)");
  });
  console.log('diff(x,x) ->', res1);

  const res2 = await page.evaluate(async () => {
    return window.Module.cwrap('caseval', 'string', ['string'])("g(x):=diff(x, x)");
  });
  console.log('g(x):=diff(x,x) ->', res2);

  const res3 = await page.evaluate(async () => {
    return window.Module.cwrap('caseval', 'string', ['string'])("g(x)");
  });
  console.log('g(x) ->', res3);

  const res4 = await page.evaluate(async () => {
    return window.Module.cwrap('caseval', 'string', ['string'])("g(2)");
  });
  console.log('g(2) ->', res4);

  await browser.close();
})();
