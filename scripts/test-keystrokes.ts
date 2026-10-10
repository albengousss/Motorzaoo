import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4173');
  await page.waitForTimeout(2000);

  // Add matrix
  await page.locator('#add-matrix-btn').click();
  await page.waitForTimeout(300);

  const nameInput = page.locator('.matrix-name-input').first();
  await nameInput.fill('B');
  await page.waitForTimeout(300);

  const expressionsToTest = ['B', '2B', 'B^{-1}', 'B^T', "B'", 'det(B)', 'trace(B)', 'rank(B)', 'B+B'];

  for (const expr of expressionsToTest) {
    console.log(`\n=== Testing "${expr}" ===`);
    await page.evaluate(() => window.ExpressionManager.addExpression());
    await page.waitForTimeout(200);

    const mf = page.locator('math-field').last();
    await mf.focus();
    // Simulate user typing each character
    for (const ch of expr) {
      await mf.press(ch);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => {
      const blocks = document.querySelectorAll('div[data-type="expression"]');
      const b = blocks[blocks.length - 1];
      const res = b.querySelector('.result-display')?.textContent || '';
      const chipsRow = b.querySelector('.slider-chips-row');
      const chipsVisible = chipsRow && !chipsRow.classList.contains('hidden');
      const chipsText = chipsRow?.textContent || '';
      const warn = b.querySelector('.block-warning-trigger');
      const warnVisible = warn && !warn.classList.contains('hidden');
      return { res: res.trim(), chipsVisible, chipsText, warnVisible };
    });
    console.log(`Result: "${state.res}"`);
    console.log(`Chips visible: ${state.chipsVisible} ("${state.chipsText}")`);
    console.log(`Warning visible: ${state.warnVisible}`);
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
