const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  // Wait for the first math-field to be ready
  await page.waitForSelector('math-field');
  
  // Type M * N directly into the UI!
  await page.evaluate(() => {
     const mf = document.querySelector('math-field');
     mf.focus();
     mf.executeCommand(['insert', 'M*N']);
  });
  
  // Give it a moment to react
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
