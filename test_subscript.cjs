const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  await page.evaluate(() => {
     const mf = document.querySelector('math-field');
     mf.focus();
     mf.executeCommand(['insert', 'M_{1,2}']);
  });
  
  await page.waitForTimeout(500);

  const res = await page.evaluate(async () => {
    const mf = document.querySelector('math-field');
    return {
      latex: mf.getValue('latex'),
      ascii: mf.getValue('ascii-math')
    };
  });
  console.log('MATHLIVE:', res);

  await browser.close();
})();
