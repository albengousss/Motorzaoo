import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('cdn.tailwindcss.com') && !text.includes('GL emulation')) {
      console.log('PAGE LOG:', text);
    }
  });

  await page.goto('http://localhost:4173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for Giac wasm

  console.log('1. Adding matrix B = [[1, 2], [3, 4]]');
  await page.evaluate(() => {
    window.ExpressionManager.addMatrix({
      name: 'B',
      rows: 2,
      cols: 2,
      data: [['1', '2'], ['3', '4']]
    });
  });
  await page.waitForTimeout(500);

  // Check Giac def for B
  const defB = await page.evaluate(() => window.StateManager.giacDefinitions['B']);
  console.log('Registered B in giacDefinitions:', defB);

  const testOps = [
    { expr: 'det(B)', desc: 'Determinant det(B)' },
    { expr: 'rref(B)', desc: 'Reduced row echelon form rref(B)' },
    { expr: 'trace(B)', desc: 'Trace trace(B)' },
    { expr: 'tr(B)', desc: 'Trace tr(B)' },
    { expr: 'rank(B)', desc: 'Rank rank(B)' },
    { expr: 'B^{-1}', desc: 'Inverse B^{-1}' },
    { expr: 'B^T', desc: 'Transpose B^T' },
    { expr: "B'", desc: "Transpose B'" },
    { expr: 'B + B', desc: 'Addition B + B' },
    { expr: '2B', desc: 'Scalar mult 2B' }
  ];

  for (const op of testOps) {
    console.log(`\nTesting: ${op.desc} with input: "${op.expr}"`);
    const blockId = await page.evaluate((exprStr) => {
      return window.ExpressionManager.addExpression(exprStr);
    }, op.expr);

    // Wait for Giac async processing & frame schedule
    await page.waitForTimeout(1000);

    const check = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      if (!block) return { found: false };
      const resDisplay = block.querySelector('.result-display') as HTMLElement;
      const chipsRow = block.querySelector('.slider-chips-row') as HTMLElement;
      const errorTooltip = block.querySelector('.block-warning-tooltip') as HTMLElement;
      const warningTrigger = block.querySelector('.block-warning-trigger') as HTMLElement;

      return {
        found: true,
        resultText: resDisplay ? resDisplay.innerText : '',
        chipsVisible: chipsRow ? !chipsRow.classList.contains('hidden') : false,
        chipsText: chipsRow ? chipsRow.innerText : '',
        hasWarning: warningTrigger ? !warningTrigger.classList.contains('hidden') : false,
        warningText: errorTooltip ? errorTooltip.innerText : ''
      };
    }, blockId);

    console.log(`Result: "${check.resultText}"`);
    console.log(`Slider Chips Visible: ${check.chipsVisible} ("${check.chipsText}")`);
    console.log(`Warning Visible: ${check.hasWarning} ("${check.warningText}")`);

    if (check.chipsVisible) {
      console.error(`❌ FAILURE: Slider chips prompted for defined matrix in ${op.desc}!`);
    }
    if (check.resultText.includes('Erro')) {
      console.error(`❌ FAILURE: Calculation error in ${op.desc}! Result was: "${check.resultText}"`);
    }
  }

  await browser.close();
}

run().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
