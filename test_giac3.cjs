const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  const res = await page.evaluate(async () => {
    return {
      a: window.evalGiac('M:=[x,0],[0,y]; M')
      b: window.evalGiac('M:=[x,0],[0,y]; M')
      c: window.evalGiac('M:=[x,0],[0,y]; M')
    };
  });
  console.log('GIAC:', res);

  await browser.close();
})();
