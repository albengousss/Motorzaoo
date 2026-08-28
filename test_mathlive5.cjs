const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  const res = await page.evaluate(async () => {
    const mf = new window.MathfieldElement();
    
    mf.setValue('M = 5', {format: 'latex'});
    return mf.getValue('ascii-math');
  });
  console.log('MATHLIVE:', res);

  await browser.close();
})();
