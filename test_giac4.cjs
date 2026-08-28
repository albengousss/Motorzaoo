const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  const res = await page.evaluate(async () => {
    return {
      a: window.evalGiac('g(x):=diff(x,x)
      b: window.evalGiac('g(x):=diff(x,x)
      c: window.evalGiac('g(x):=diff(x,x)
    };
  });
  console.log('GIAC:', res);

  await browser.close();
})();
