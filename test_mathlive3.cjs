const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  const res = await page.evaluate(async () => {
    const mf = new window.MathfieldElement();
    
    // Test * typed from keyboard
    mf.executeCommand(['insert', '*']);
    const v1 = mf.getValue('ascii-math');
    const l1 = mf.getValue('latex');
    
    mf.setValue('M \\ast N', {format: 'latex'});
    const v2 = mf.getValue('ascii-math');

    mf.setValue('M \\cdot N', {format: 'latex'});
    const v3 = mf.getValue('ascii-math');

    return {
      inserted_star_ascii: v1,
      inserted_star_latex: l1,
      ast: v2,
      cdot: v3
    };
  });
  console.log('MATHLIVE:', res);

  await browser.close();
})();
