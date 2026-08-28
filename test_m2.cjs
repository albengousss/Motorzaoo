const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  await page.evaluate(() => {
     document.getElementById('add-expr-btn').click();
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
     const mfs = document.querySelectorAll('math-field');
     const mf1 = mfs[0];
     mf1.focus();
     mf1.executeCommand(['insert', 'M=\\left\\{x,0\\right\\},\\left\\{0,y\\right\\}']);
  });
  
  await page.waitForTimeout(500);

  await page.evaluate(() => {
     document.getElementById('add-expr-btn').click();
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
     const mfs = document.querySelectorAll('math-field');
     const mf2 = mfs[1];
     mf2.focus();
     mf2.executeCommand(['insert', 'M']);
  });

  await page.waitForTimeout(1000);

  await browser.close();
})();
