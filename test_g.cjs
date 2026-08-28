const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  await page.waitForFunction('window.giacReady === true');
  
  const results = await page.evaluate(() => {
     return {
         res: window._giacEval('usr_g(x):=diff(x,x)')
     };
  });
  console.log('GIAC:', results);
  await browser.close();
})();
