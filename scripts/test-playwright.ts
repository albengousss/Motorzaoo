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

  console.log('Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for wasm

  console.log('\n--- TEST 1: Add Matrix via button and check Giac registration ---');
  await page.locator('#add-matrix-btn').click();
  await page.waitForTimeout(300);

  const initialCheck = await page.evaluate(`(() => {
    const win = window;
    const defs = win.StateManager ? win.StateManager.giacDefinitions : {};
    return {
      hasA: !!defs['A'],
      defA: defs['A'],
      cellCount: document.querySelectorAll('.matrix-cell').length
    };
  })()`);
  console.log('Initial Matrix Check:', initialCheck);
  if (!initialCheck.hasA) throw new Error('FAIL: Matrix A not registered in StateManager.giacDefinitions!');

  console.log('\n--- TEST 2: Autocomplete with 0 on cell clear / erasure ---');
  const firstCell = page.locator('.matrix-cell').first();
  await firstCell.focus();
  // Simulate user selecting and hitting backspace
  await firstCell.press('Backspace');
  await page.waitForTimeout(100);
  const valAfterBack = await firstCell.inputValue();
  console.log('Value after Backspace:', valAfterBack);
  if (valAfterBack !== '0') throw new Error(`FAIL: Expected '0' after Backspace, got '${valAfterBack}'`);

  // Simulate user typing another number
  await firstCell.type('5');
  await page.waitForTimeout(100);
  console.log('Value after typing 5:', await firstCell.inputValue());

  // Simulate user clearing with backspaces
  await firstCell.press('Backspace');
  await page.waitForTimeout(100);
  const valAfterClear = await firstCell.inputValue();
  console.log('Value after clearing 5:', valAfterClear);
  if (valAfterClear !== '0') throw new Error(`FAIL: Expected '0' after clearing, got '${valAfterClear}'`);

  console.log('\n--- TEST 3: Dragging Resizable Borders ---');
  const rightBracket = page.locator('.bracket-right-resizable').first();
  const bottomBorder = page.locator('.matrix-bottom-resizable').first();
  const dragHandle = page.locator('.matrix-drag-handle').first();

  console.log('Right bracket visible:', await rightBracket.isVisible());
  console.log('Bottom border visible:', await bottomBorder.isVisible());
  console.log('Corner drag handle visible:', await dragHandle.isVisible());

  // 3a. Drag right bracket to add columns
  const rBox = await rightBracket.boundingBox();
  if (rBox) {
    await page.mouse.move(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rBox.x + 80, rBox.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  const cellsAfterColDrag = await page.locator('.matrix-cell').count();
  console.log('Cells after dragging right bracket:', cellsAfterColDrag);

  // 3b. Drag bottom border to add rows
  const bBox = await bottomBorder.boundingBox();
  if (bBox) {
    await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(bBox.x, bBox.y + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  const cellsAfterRowDrag = await page.locator('.matrix-cell').count();
  console.log('Cells after dragging bottom border:', cellsAfterRowDrag);

  // Check updated Giac definition has new dimensions
  const defAfterDrag = await page.evaluate(`(() => window.StateManager ? window.StateManager.giacDefinitions['A'] : '')()`);
  console.log('Giac definition for A after drag:', defAfterDrag);

  console.log('\n--- TEST 4: Typing "matrix" and "matriz" auto-transform ---');
  // Trigger convert by inputting "matrix" into a math-field
  await page.evaluate(`(() => {
    // Add expression
    window.ExpressionManager.addExpression();
    const blocks = document.querySelectorAll('div[data-type="expression"]');
    const lastBlock = blocks[blocks.length - 1];
    const mf = lastBlock.querySelector('math-field');
    mf.setValue('matrix');
    mf.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(500);

  const matBlocksCount = await page.locator('div[data-type="matrix"]').count();
  console.log('Visual matrix blocks count after typing "matrix":', matBlocksCount);
  if (matBlocksCount < 2) throw new Error('FAIL: "matrix" did not convert block to visual matrix!');

  // Trigger convert by inputting "M = matriz" into another math-field
  await page.evaluate(`(() => {
    window.ExpressionManager.addExpression();
    const blocks = document.querySelectorAll('div[data-type="expression"]');
    const lastBlock = blocks[blocks.length - 1];
    const mf = lastBlock.querySelector('math-field');
    mf.setValue('M = matriz');
    mf.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(500);

  const matBlocksCount2 = await page.locator('div[data-type="matrix"]').count();
  console.log('Visual matrix blocks count after typing "M = matriz":', matBlocksCount2);
  if (matBlocksCount2 < 3) throw new Error('FAIL: "M = matriz" did not convert block to visual matrix!');

  console.log('\n--- TEST 5: Giac Matrix Operations & Calculations ---');
  const casEvalResults = await page.evaluate(async () => {
    const win = window;
    const MathEngine = win.MathEngine;
    // Set A and B
    win.StateManager.giacDefinitions['A'] = 'usr_A:=[[1, 2], [3, 4]]';
    win.StateManager.giacDefinitions['B'] = 'usr_B:=[[5, 6], [7, 8]]';
    await win.MathEngine.askGiac('usr_A:=[[1, 2], [3, 4]]');
    await win.MathEngine.askGiac('usr_B:=[[5, 6], [7, 8]]');

    const addRes = await win.MathEngine.askGiac('usr_A + usr_B');
    const scalarRes = await win.MathEngine.askGiac('2 * usr_A');
    const detRes = await win.MathEngine.askGiac('det(usr_A)');
    const tranRes = await win.MathEngine.askGiac('tran(usr_A)');
    const invRes = await win.MathEngine.askGiac('inv(usr_A)');
    const rrefRes = await win.MathEngine.askGiac('rref(usr_A)');

    return {
      add: addRes,
      scalar: scalarRes,
      det: detRes,
      tran: tranRes,
      inv: invRes,
      rref: rrefRes
    };
  });
  console.log('CAS Evaluation Results:', casEvalResults);

  console.log('\n🎉 ALL BROWSER PLAYWRIGHT TESTS PASSED CLEANLY! 🎉');
  await browser.close();
  process.exit(0);
}

run().catch(err => {
  console.error('ERROR in test:', err);
  process.exit(1);
});
