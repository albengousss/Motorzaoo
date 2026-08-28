const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  const res = await page.evaluate(async () => {
    const mf = new window.MathfieldElement();
    
    mf.setValue('M \\cdot N', {format: 'latex'});
    const res1 = mf.getValue('ascii-math');

    mf.setValue('M \\times N', {format: 'latex'});
    const res2 = mf.getValue('ascii-math');

    mf.setValue('M * N', {format: 'latex'});
    const res3 = mf.getValue('ascii-math');

    mf.setValue('M N', {format: 'latex'});
    const res4 = mf.getValue('ascii-math');

    return {
      cdot: res1,
      times: res2,
      star: res3,
      space: res4
    };
  });
  console.log('MATHLIVE:', res);

  await browser.close();
})();
