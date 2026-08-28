const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4173');
  
  await page.waitForFunction('window.giacReady === true');
  
  console.log("Adding block 1: M={{x,0},{0,y}}");
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

  console.log("Adding block 2: M");
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

  console.log("Testing responsiveness...");
  const isResponsive = await page.evaluate(() => {
     return true;
  });
  console.log('Responsive?', isResponsive);

  const html = await page.content();
  console.log(html.substring(0, 200));

  await browser.close();
})();
