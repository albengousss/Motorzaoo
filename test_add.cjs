const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  await page.click('#add-expr-btn');
  
  await page.waitForTimeout(500);
  
  const blocks = await page.evaluate(() => document.getElementById('expressions-list').children.length);
  console.log('BLOCKS COUNT:', blocks);

  await browser.close();
})();
