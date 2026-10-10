import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function run() {
  console.log('--- STARTING SIDEBAR & MATRIX SYNC PLAYWRIGHT TESTS ---');

  // Start vite preview on port 4173
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: 'f:\\Motorzao\\Motorzaoo',
    shell: true,
    stdio: 'pipe'
  });

  // Give preview a moment to start
  await new Promise(r => setTimeout(r, 2000));

  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('cdn.tailwindcss.com') && !text.includes('GL emulation')) {
        console.log('BROWSER LOG:', text);
      }
    });

    console.log('Navigating to http://localhost:4173...');
    await page.goto('http://localhost:4173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 1. Add matrix A
    console.log('\n[TEST 1: Adding Matrix A]');
    await page.locator('#add-matrix-btn').click();
    await page.waitForTimeout(300);

    const initialMatrix = await page.evaluate(() => {
      const block = document.querySelector('div[data-type="matrix"]');
      const cells = document.querySelectorAll('.matrix-cell');
      const sidebar = document.getElementById('sidebar');
      const resizer = document.getElementById('sidebar-resizer');
      const expandTab = document.getElementById('sidebar-expand-tab');
      return {
        exists: !!block,
        cellCount: cells.length,
        firstCellWidth: (cells[0] as HTMLElement)?.style.width,
        sidebarWidth: sidebar?.getBoundingClientRect().width,
        resizerVisible: resizer ? window.getComputedStyle(resizer).display !== 'none' : false,
        expandTabVisible: expandTab ? window.getComputedStyle(expandTab).display !== 'none' : false
      };
    });
    console.log('Initial Matrix & Sidebar State:', initialMatrix);
    if (!initialMatrix.exists || initialMatrix.cellCount !== 4) throw new Error('FAIL: Matrix A not properly created');
    if (!initialMatrix.resizerVisible) throw new Error('FAIL: Sidebar draggable resizer not visible on desktop');

    // 2. Drag sidebar resizer to widen sidebar and check live cell resizing
    console.log('\n[TEST 2: Dragging Sidebar Resizer to Widen Sidebar (live matrix cell update)]');
    const resizerBox = await page.locator('#sidebar-resizer').boundingBox();
    if (!resizerBox) throw new Error('Sidebar resizer bounding box not found');

    // Drag resizer to the right (+150px)
    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(resizerBox.x + 150, resizerBox.y + 100, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const widenedState = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      const cells = document.querySelectorAll<HTMLInputElement>('.matrix-cell');
      return {
        sidebarWidth: sidebar?.getBoundingClientRect().width,
        firstCellWidth: cells[0]?.style.width
      };
    });
    console.log('Widened State:', widenedState);
    if (!widenedState.sidebarWidth || widenedState.sidebarWidth <= initialMatrix.sidebarWidth!) {
      throw new Error('FAIL: Sidebar did not widen on drag');
    }
    const initialCellW = parseInt(initialMatrix.firstCellWidth || '0', 10);
    const widenedCellW = parseInt(widenedState.firstCellWidth || '0', 10);
    console.log(`Cell width dynamic scaling: ${initialCellW}px -> ${widenedCellW}px`);
    if (widenedCellW < initialCellW) {
      throw new Error('FAIL: Matrix cells did not dynamically expand with widened sidebar');
    }

    // 3. Drag sidebar resizer past left limit (< 100px) so sidebar and matrix collapse ("sumir")
    console.log('\n[TEST 3: Dragging Sidebar Resizer beyond bar to the left (<100px) - sidebar & matrix sumir]');
    const resizerBox2 = await page.locator('#sidebar-resizer').boundingBox();
    if (!resizerBox2) throw new Error('Sidebar resizer bounding box not found');

    await page.mouse.move(resizerBox2.x + resizerBox2.width / 2, resizerBox2.y + 100);
    await page.mouse.down();
    await page.mouse.move(50, resizerBox2.y + 100, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const collapsedState = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      const expandTab = document.getElementById('sidebar-expand-tab');
      return {
        sidebarDisplay: sidebar?.style.display,
        sidebarWidth: sidebar?.getBoundingClientRect().width,
        expandTabDisplay: expandTab ? window.getComputedStyle(expandTab).display : 'none',
        bodyCursor: document.body.style.cursor,
        bodySelectNone: document.body.classList.contains('select-none')
      };
    });
    console.log('Collapsed State:', collapsedState);
    if (collapsedState.sidebarDisplay !== 'none' || collapsedState.expandTabDisplay === 'none') {
      throw new Error('FAIL: Sidebar did not collapse and matrix did not disappear when dragged past boundary');
    }
    if (collapsedState.bodyCursor !== '' || collapsedState.bodySelectNone) {
      throw new Error('FAIL: Body cursor or select-none stuck after collapse drag');
    }

    // 4. Click expand tab to restore sidebar
    console.log('\n[TEST 4: Restoring sidebar via expand tab]');
    await page.locator('#sidebar-expand-tab').click();
    await page.waitForTimeout(300);

    const restoredState = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      const matrix = document.querySelector('div[data-type="matrix"]');
      return {
        sidebarDisplay: sidebar?.style.display,
        sidebarWidth: sidebar?.getBoundingClientRect().width,
        matrixVisible: !!matrix
      };
    });
    console.log('Restored State:', restoredState);
    if (restoredState.sidebarDisplay === 'none' || !restoredState.matrixVisible) {
      throw new Error('FAIL: Sidebar not restored properly');
    }

    // 5. Test dragging matrix handle beyond the bar to the left (targetCols <= 0) so matrix disappears ("a matriz sumir")
    console.log('\n[TEST 5: Dragging matrix handle far left beyond bar so matrix disappears]');
    const dragHandle = page.locator('.matrix-drag-handle').first();
    const handleBox = await dragHandle.boundingBox();
    console.log('Handle Box:', handleBox);
    if (!handleBox) throw new Error('Drag handle bounding box not found');

    const elAtPoint = await page.evaluate((b) => {
      const el = document.elementFromPoint(b.x + b.width/2, b.y + b.height/2);
      return { tag: el?.tagName, class: el?.className, id: el?.id };
    }, handleBox);
    console.log('Element at handle center:', elAtPoint);

    // Drag handle far left to x = 10 (well past the 1st column to left boundary)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(10, handleBox.y + handleBox.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const matrixAfterLeftDrag = await page.evaluate(() => {
      return {
        matrixCount: document.querySelectorAll('div[data-type="matrix"]').length
      };
    });
    console.log('Matrix count after drag beyond bar to left:', matrixAfterLeftDrag);
    if (matrixAfterLeftDrag.matrixCount !== 0) {
      throw new Error('FAIL: Matrix should disappear when dragged beyond the bar to the left');
    }

    // 6. Test Add matrix again, check operations and slider suppression
    console.log('\n[TEST 6: Re-adding matrix and verifying Desmos parity ops]');
    await page.locator('#add-matrix-btn').click();
    await page.waitForTimeout(300);

    // Set matrix cells to [[1, 2], [3, 4]]
    await page.evaluate(() => {
      const cells = document.querySelectorAll<HTMLInputElement>('.matrix-cell');
      if (cells.length >= 4) {
        cells[0].value = '1';
        cells[1].value = '2';
        cells[2].value = '3';
        cells[3].value = '4';
        cells[0].dispatchEvent(new Event('input'));
        cells[1].dispatchEvent(new Event('input'));
        cells[2].dispatchEvent(new Event('input'));
        cells[3].dispatchEvent(new Event('input'));
      }
    });
    await page.waitForTimeout(300);

    // Add expression det(A)
    const detBlockId = await page.evaluate(() => {
      return (window as any).ExpressionManager.addExpression('det(A)');
    });
    await page.waitForTimeout(1000);

    const detCheck = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      const chips = block?.querySelector('.slider-chips-row') as HTMLElement;
      const res = block?.querySelector('.result-display') as HTMLElement;
      return {
        resText: res?.innerText,
        chipsVisible: chips && !chips.classList.contains('hidden')
      };
    }, detBlockId);
    console.log('det(A) Check:', detCheck);
    if (detCheck.chipsVisible) throw new Error('FAIL: Sliders proposed for det(A) with defined matrix A!');
    if (!detCheck.resText || (!detCheck.resText.includes('-2') && !detCheck.resText.includes('−2'))) {
      throw new Error(`FAIL: Expected det(A) to be -2, got '${detCheck.resText}'`);
    }

    // 7. Test 8-column matrix live adaptation across sidebar resize
    console.log('\n[TEST 7: Multi-column (8 cols) matrix dynamic cell calculation across sidebar widths]');
    await page.evaluate(() => {
      const block = document.querySelector('div[data-type="matrix"]');
      const addColBtn = block?.querySelector('button[title*="Adicionar Coluna"]') as HTMLButtonElement;
      for (let i = 0; i < 6; i++) {
        addColBtn?.click();
      }
    });
    await page.waitForTimeout(300);

    const eightColCheck = await page.evaluate(() => {
      const block = document.querySelector('div[data-type="matrix"]');
      const cells = block?.querySelectorAll<HTMLInputElement>('.matrix-cell') || [];
      const cellW = cells[0]?.style.width;
      return {
        cols: block?.getAttribute('data-cols'),
        cellW: parseInt(cellW || '0', 10)
      };
    });
    console.log('8-column state at 220px:', eightColCheck);
    if (eightColCheck.cols !== '8' || eightColCheck.cellW < 20 || eightColCheck.cellW > 35) {
      throw new Error(`FAIL: 8-column cell width expected between 20px and 35px at 220px, got ${eightColCheck.cellW}`);
    }

    console.log('\n✅ ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (browser) await browser.close();
    if (preview.pid) {
      try {
        const { execSync } = await import('child_process');
        execSync(`taskkill /F /T /PID ${preview.pid}`, { stdio: 'ignore' });
      } catch (e) {
        preview.kill();
      }
    }
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
