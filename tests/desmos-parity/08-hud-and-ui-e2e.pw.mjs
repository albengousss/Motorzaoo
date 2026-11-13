import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT_DIR = process.cwd();
const PORT = 5179;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const ARTIFACT_SCREENSHOT =
    process.env.PHASE_A_SCREENSHOT_PATH ||
    'C:\\Users\\calda\\.gemini\\antigravity\\brain\\e3397fcc-776e-46e3-8316-2f8bdf22b523\\phase_a_e2e_verified.png';

function assert(cond, msg) {
    if (!cond) {
        throw new Error(`E2E Assertion Failed: ${msg}`);
    }
}

async function waitForServer(url, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Vite server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function launchBrowser() {
    for (const channel of ['chrome', 'msedge', undefined]) {
        try {
            return await chromium.launch({
                ...(channel ? { channel } : {}),
                headless: true
            });
        } catch (_) {}
    }
    throw new Error('Could not launch Chrome, Edge, or Playwright Chromium');
}

async function setMathBlockValue(page, blockId, value) {
    await page.evaluate(
        ({ id, val }) => {
            const block = document.getElementById(id);
            const mf = block?.querySelector('math-field');
            if (!mf) throw new Error(`Missing math-field for ${id}`);
            if (typeof mf.setValue === 'function') {
                mf.setValue(val, { suppressChangeNotifications: false });
            } else {
                mf.value = val;
            }
            mf.dispatchEvent(new Event('input', { bubbles: true }));
            mf.dispatchEvent(new Event('change', { bubbles: true }));
        },
        { id: blockId, val: value }
    );
}

async function run() {
    const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
    const viteProc = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let browser;
    try {
        await waitForServer(BASE_URL);
        browser = await launchBrowser();
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        const consoleErrors = [];
        const pageErrors = [];
        page.on('console', (msg) => {
            const text = msg.text();
            if (msg.type() === 'error' && !text.includes('Invalid keybindings for current keyboard layout')) {
                consoleErrors.push(text);
            }
        });
        page.on('pageerror', (err) => {
            pageErrors.push(err.message || String(err));
        });

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => Boolean(window.ExpressionManager && window.StateManager), { timeout: 10000 });
        await page.waitForTimeout(300);

        // 1. Boot verification: zero runtime / TDZ errors
        assert(pageErrors.length === 0, `Unexpected pageErrors on boot: ${pageErrors.join(' | ')}`);
        assert(consoleErrors.length === 0, `Unexpected console.error on boot: ${consoleErrors.join(' | ')}`);

        // 2. 2D Canvas painted & non-blank
        const canvasMetrics = await page.evaluate(() => {
            const canvas = document.getElementById('graphCanvas');
            if (!canvas) return null;
            const ctx = canvas.getContext('2d');
            if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
            const sample = ctx.getImageData(0, 0, Math.min(200, canvas.width), Math.min(200, canvas.height)).data;
            let uniqueColors = 0;
            const seen = new Set();
            for (let i = 0; i < sample.length; i += 4) {
                seen.add(`${sample[i]},${sample[i + 1]},${sample[i + 2]},${sample[i + 3]}`);
                if (seen.size > 4) {
                    uniqueColors = seen.size;
                    break;
                }
            }
            return { width: canvas.width, height: canvas.height, uniqueColors: seen.size || uniqueColors };
        });
        assert(canvasMetrics && canvasMetrics.width > 100 && canvasMetrics.height > 100, 'graphCanvas has zero dimensions');
        assert(canvasMetrics.uniqueColors > 2, 'graphCanvas appears blank (axes/grid did not draw)');

        // 3. Lucide icons rendered in HUD buttons
        const hudSvgCheck = await page.evaluate(() => {
            const zoomInSvg = document.querySelector('#zoom-in-btn svg');
            const zoomOutSvg = document.querySelector('#zoom-out-btn svg');
            const kbSvg = document.querySelector('#toggle-keyboard-btn svg');
            return Boolean(
                zoomInSvg && zoomInSvg.getBoundingClientRect().width > 0 &&
                zoomOutSvg && zoomOutSvg.getBoundingClientRect().width > 0 &&
                kbSvg && kbSvg.getBoundingClientRect().width > 0
            );
        });
        assert(hudSvgCheck, 'Lucide SVG icons missing or 0px in zoom/keyboard HUD buttons');

        // 4. Pan/Zoom activates reset-view-btn cleanly
        await page.click('#zoom-in-btn');
        await page.waitForTimeout(350);
        const resetVisible = await page.evaluate(() => {
            const btn = document.getElementById('reset-view-btn');
            return Boolean(btn && !btn.classList.contains('hidden') && btn.querySelector('svg'));
        });
        assert(resetVisible, '#reset-view-btn should become visible with SVG icon after zoom-in');
        await page.click('#reset-view-btn');
        await page.waitForTimeout(350);

        // 5. #mode-3d-btn & #mode-2d-btn switching works cleanly without TDZ
        await page.click('#mode-3d-btn');
        await page.waitForTimeout(200);
        const is3D = await page.evaluate(() => {
            const c3d = document.getElementById('canvas3d');
            return window.StateManager.viewMode === '3d' && c3d && !c3d.classList.contains('hidden');
        });
        assert(is3D, '#mode-3d-btn did not switch viewMode to 3d / show #canvas3d');
        await page.click('#mode-2d-btn');
        await page.waitForTimeout(200);
        const is2D = await page.evaluate(() => {
            const c2d = document.getElementById('graphCanvas');
            return window.StateManager.viewMode === '2d' && c2d && !c2d.classList.contains('hidden');
        });
        assert(is2D, '#mode-2d-btn did not restore viewMode to 2d');

        // 6. #toggle-keyboard-btn opens/closes virtual keyboard
        await page.click('#toggle-keyboard-btn');
        await page.waitForTimeout(250);
        const vkOpened = await page.evaluate(() => Boolean(window.mathVirtualKeyboard && window.mathVirtualKeyboard.visible));
        assert(vkOpened, '#toggle-keyboard-btn did not open mathVirtualKeyboard');
        await page.click('#toggle-keyboard-btn');
        await page.waitForTimeout(200);
        const vkClosed = await page.evaluate(() => Boolean(window.mathVirtualKeyboard && !window.mathVirtualKeyboard.visible));
        assert(vkClosed, '#toggle-keyboard-btn did not close mathVirtualKeyboard');

        // 7. Add expressions matching Phase A + Phase B parity & bug checks
        const ids = await page.evaluate(() => {
            const firstId = document.querySelector('#expressions-list > div')?.id;
            const em = window.ExpressionManager;
            const idList = [
                firstId || em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, '')
            ];
            return idList;
        });

        await setMathBlockValue(page, ids[0], 'y = x^2');
        await setMathBlockValue(page, ids[1], 'r = \\sqrt{\\theta}');
        await setMathBlockValue(page, ids[2], '[1...10]');
        await setMathBlockValue(page, ids[3], '0/0');
        await setMathBlockValue(page, ids[4], '\\int_{-1}^{1}\\sqrt{1-x^2}dx');
        await setMathBlockValue(page, ids[5], '\\sum_{n=1}^{10} n');
        await setMathBlockValue(page, ids[6], 'x^2 + y^2 + a^2 = 2');
        await setMathBlockValue(page, ids[7], 'y = a x + b');
        await setMathBlockValue(page, ids[8], 'x +');
        // Phase B checks
        await setMathBlockValue(page, ids[9], 'max([1, 2, 3])');
        await setMathBlockValue(page, ids[10], '\\binom{5}{2}');
        await setMathBlockValue(page, ids[11], 'f(x) = 3');
        await setMathBlockValue(page, ids[12], '\\pi = 3');
        await setMathBlockValue(page, ids[13], 'x = x');
        await setMathBlockValue(page, ids[14], '[1...10001]');
        await setMathBlockValue(page, ids[15], '2 + 3');
        await page.waitForTimeout(1800);

        // Inspect all Phase A + Phase B UI fixes inside live Chromium
        const checks = await page.evaluate((blockIds) => {
            const getRes = (id) => document.getElementById(id)?.querySelector('.result-display')?.textContent?.trim() || '';
            const isWarnHidden = (id) => {
                const w = document.getElementById(id)?.querySelector('.block-warning-trigger');
                return !w || w.classList.contains('hidden') || getComputedStyle(w).display === 'none';
            };
            const isVisHidden = (id) => {
                const v = document.getElementById(id)?.querySelector('.visibility-toggle');
                return !v || getComputedStyle(v).display === 'none';
            };
            const getTooltipText = (id) => {
                const tooltip = document.getElementById(id)?.querySelector('.warning-popover-tooltip');
                return tooltip?.textContent?.trim() || '';
            };

            const bChips = document.getElementById(blockIds[6]);
            const chipsRow = bChips?.querySelector('.slider-chips-row');
            const chipBtn = chipsRow?.querySelector('button');
            const chipsRect = chipsRow?.getBoundingClientRect();
            const blockRect = bChips?.getBoundingClientRect();
            const btnRect = chipBtn?.getBoundingClientRect();

            const bIncomplete = document.getElementById(blockIds[8]);
            const warnTrigger = bIncomplete?.querySelector('.block-warning-trigger');
            const tooltip = bIncomplete?.querySelector('.warning-popover-tooltip');
            if (tooltip) tooltip.classList.add('force-visible');
            const ttRect = tooltip?.getBoundingClientRect();

            return {
                listText: getRes(blockIds[2]),
                indefText: getRes(blockIds[3]),
                intText: getRes(blockIds[4]),
                intWarnHidden: isWarnHidden(blockIds[4]),
                intVisHidden: isVisHidden(blockIds[4]),
                sumText: getRes(blockIds[5]),
                sumWarnHidden: isWarnHidden(blockIds[5]),
                sumVisHidden: isVisHidden(blockIds[5]),
                chipsDisplay: chipsRow ? getComputedStyle(chipsRow).display : null,
                chipsHeight: chipsRect ? chipsRect.height : 0,
                chipBtnHeight: btnRect ? btnRect.height : 0,
                chipUnclipped: Boolean(chipsRect && blockRect && btnRect && chipsRect.bottom <= blockRect.bottom + 2 && btnRect.height >= 18),
                incompleteWarnVisible: Boolean(warnTrigger && !warnTrigger.classList.contains('hidden')),
                tooltipWidth: ttRect ? ttRect.width : 0,
                tooltipHeight: ttRect ? ttRect.height : 0,
                tooltipText: tooltip?.textContent?.trim() || '',
                // Phase B telemetry
                maxText: getRes(blockIds[9]),
                maxWarnHidden: isWarnHidden(blockIds[9]),
                binomText: getRes(blockIds[10]),
                binomWarnHidden: isWarnHidden(blockIds[10]),
                constFnWarnHidden: isWarnHidden(blockIds[11]),
                constFnVisHidden: isVisHidden(blockIds[11]),
                piWarnVisible: !isWarnHidden(blockIds[12]),
                piTooltip: getTooltipText(blockIds[12]),
                xxWarnVisible: !isWarnHidden(blockIds[13]),
                xxTooltip: getTooltipText(blockIds[13]),
                listLimitWarnVisible: !isWarnHidden(blockIds[14]),
                listLimitTooltip: getTooltipText(blockIds[14]),
                siblingOkText: getRes(blockIds[15]),
                siblingOkWarnHidden: isWarnHidden(blockIds[15])
            };
        }, ids);

        assert(checks.listText.includes('(10 elementos)'), `Expected "(10 elementos)" with space, got "${checks.listText}"`);
        assert(checks.indefText === '= indef', `Expected "0/0" result "= indef", got "${checks.indefText}"`);
        assert(checks.intText.startsWith('='), `Expected definite integral result starting with "=", got "${checks.intText}"`);
        assert(checks.intWarnHidden, `False warning icon remained visible on definite integral (${checks.intText})`);
        assert(checks.intVisHidden, 'Visibility circle should be hidden on non-plottable definite integral');
        assert(checks.sumWarnHidden, `False warning icon remained visible on solved sum (${checks.sumText})`);
        assert(checks.sumVisHidden, 'Visibility circle should be hidden on non-plottable sum');
        assert(checks.chipsDisplay === 'flex', `Expected .slider-chips-row display "flex", got "${checks.chipsDisplay}"`);
        assert(checks.chipUnclipped, `Expected .slider-chips-row unclipped (height=${checks.chipsHeight}, btnH=${checks.chipBtnHeight})`);
        assert(checks.incompleteWarnVisible, 'Expected warning trigger on incomplete expression "x +"');
        assert(checks.tooltipWidth >= 100 && checks.tooltipHeight > 12 && checks.tooltipHeight <= 90,
            `Tooltip size collapsed or distorted: ${checks.tooltipWidth}x${checks.tooltipHeight} ("${checks.tooltipText}")`);

        // Phase B assertions
        assert(checks.maxText === '= 3', `Expected max([1, 2, 3]) result "= 3", got "${checks.maxText}"`);
        assert(checks.maxWarnHidden, `Unexpected warning on max([1, 2, 3])`);
        assert(checks.binomText === '= 10', `Expected \\binom{5}{2} result "= 10", got "${checks.binomText}"`);
        assert(checks.binomWarnHidden, `Unexpected warning on \\binom{5}{2}`);
        assert(checks.sumText === '= 55', `Expected \\sum_{n=1}^{10} n result "= 55", got "${checks.sumText}"`);
        assert(checks.constFnWarnHidden, `Expected constant function f(x) = 3 to stay clean without warning`);
        assert(!checks.constFnVisHidden, `Expected constant function f(x) = 3 visibility toggle to be shown`);
        assert(checks.piWarnVisible && checks.piTooltip.includes('redefinir'), `Expected protected-constant warning tooltip on "\\pi = 3", got "${checks.piTooltip}"`);
        assert(checks.xxWarnVisible && checks.xxTooltip.includes('circular'), `Expected circular-definition warning tooltip on "x = x", got "${checks.xxTooltip}"`);
        assert(checks.listLimitWarnVisible && checks.listLimitTooltip.includes('10.000'),
            `Expected list limit semantic warning tooltip on "[1...10001]", got "${checks.listLimitTooltip}"`);
        assert(checks.siblingOkText === '= 5' && checks.siblingOkWarnHidden,
            `Error isolation failed on sibling "2 + 3": text="${checks.siblingOkText}", warnHidden=${checks.siblingOkWarnHidden}`);

        // Also ensure solved sum has no active slider chips or slider inputs
        const sumHasSliders = await page.evaluate((sumId) => {
            const el = document.getElementById(sumId);
            const chips = el?.querySelector('.slider-chips-row');
            const chipsVisible = Boolean(chips && !chips.classList.contains('hidden') && getComputedStyle(chips).display !== 'none');
            const hasRange = Boolean(el?.querySelector('.slider-container input[type="range"]'));
            return chipsVisible || hasRange;
        }, ids[5]);
        assert(!sumHasSliders, 'Expected \\sum_{n=1}^{10} n not to emit active slider UI');

        fs.mkdirSync(path.dirname(ARTIFACT_SCREENSHOT), { recursive: true });
        await page.screenshot({ path: ARTIFACT_SCREENSHOT, fullPage: true });

        // 8. Phase C E2E checks (Vectors 3D/Cross, Piecewise, With, Recursion base case, Wackscope)
        page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
        await page.evaluate(() => window._clearAll());
        await page.waitForTimeout(200);

        const cIds1 = await page.evaluate(() => {
            const firstId = document.querySelector('#expressions-list > div')?.id;
            const em = window.ExpressionManager;
            return [
                firstId || em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, '')
            ];
        });

        await setMathBlockValue(page, cIds1[0], '(6,5,4)\\times(1,2,3)');
        await setMathBlockValue(page, cIds1[1], '(1,2)\\times(3,4)');
        await setMathBlockValue(page, cIds1[2], '(1,2,3)');
        await setMathBlockValue(page, cIds1[3], '\\{x < 0: -x, x\\}');
        await setMathBlockValue(page, cIds1[4], 'c^2 \\operatorname{with} c = 2');
        await setMathBlockValue(page, cIds1[5], 'f(0)=1');
        await setMathBlockValue(page, cIds1[6], 'f(x)=x*f(x-1)');
        await setMathBlockValue(page, cIds1[7], 'f(5)');
        await page.waitForTimeout(1500);

        const cChecks1 = await page.evaluate((blockIds) => {
            const getRes = (id) => document.getElementById(id)?.querySelector('.result-display')?.textContent?.trim() || '';
            const isWarnHidden = (id) => {
                const w = document.getElementById(id)?.querySelector('.block-warning-trigger');
                return !w || w.classList.contains('hidden') || getComputedStyle(w).display === 'none';
            };
            const isVisHidden = (id) => {
                const v = document.getElementById(id)?.querySelector('.visibility-toggle');
                return !v || getComputedStyle(v).display === 'none';
            };
            const getTooltipText = (id) => document.getElementById(id)?.querySelector('.warning-popover-tooltip')?.textContent?.trim() || '';
            const hasSliderUI = (id) => {
                const el = document.getElementById(id);
                const chips = el?.querySelector('.slider-chips-row');
                const chipsVisible = Boolean(chips && !chips.classList.contains('hidden') && getComputedStyle(chips).display !== 'none');
                const hasRange = Boolean(el?.querySelector('.slider-container input[type="range"]'));
                return chipsVisible || hasRange;
            };

            return {
                crossRes: getRes(blockIds[0]),
                crossWarnHidden: isWarnHidden(blockIds[0]),
                cross2dWarnVisible: !isWarnHidden(blockIds[1]),
                cross2dTooltip: getTooltipText(blockIds[1]),
                pt3dWarnVisible: !isWarnHidden(blockIds[2]),
                pt3dTooltip: getTooltipText(blockIds[2]),
                pwWarnHidden: isWarnHidden(blockIds[3]),
                pwVisHidden: isVisHidden(blockIds[3]),
                withRes: getRes(blockIds[4]),
                withWarnHidden: isWarnHidden(blockIds[4]),
                withHasSliders: hasSliderUI(blockIds[4]),
                cGlobalPolluted: Object.prototype.hasOwnProperty.call(window.StateManager.values, 'c'),
                baseRes: getRes(blockIds[5]),
                baseWarnHidden: isWarnHidden(blockIds[5]),
                recWarnHidden: isWarnHidden(blockIds[6]),
                fac5Res: getRes(blockIds[7]),
                fac5WarnHidden: isWarnHidden(blockIds[7])
            };
        }, cIds1);

        assert(cChecks1.crossRes === '= (7, -14, 7)', `Expected (6,5,4)x(1,2,3) result "= (7, -14, 7)", got "${cChecks1.crossRes}"`);
        assert(!cChecks1.crossWarnHidden && cChecks1.pt3dWarnVisible,
            `Expected 3D-in-2D warnings in 2D mode for 3D cross/point, got crossWarnHidden=${cChecks1.crossWarnHidden}, pt3dWarnVisible=${cChecks1.pt3dWarnVisible}`);
        assert(cChecks1.cross2dWarnVisible, `Expected semantic error warning on 2D cross product "(1,2)\\times(3,4)" (tooltip="${cChecks1.cross2dTooltip}")`);
        assert(cChecks1.pt3dWarnVisible, `Expected 3D-in-2D error warning on "(1,2,3)" in 2D mode (tooltip="${cChecks1.pt3dTooltip}")`);
        assert(cChecks1.pwWarnHidden, `Unexpected warning on piecewise "{x < 0: -x, x}"`);
        assert(!cChecks1.pwVisHidden, `Expected visibility toggle shown on piecewise "{x < 0: -x, x}"`);
        assert(cChecks1.withRes === '= 4', `Expected "c^2 with c = 2" result "= 4", got "${cChecks1.withRes}"`);
        assert(cChecks1.withWarnHidden && !cChecks1.withHasSliders, `Unexpected warning/slider on "c^2 with c = 2"`);
        assert(!cChecks1.cGlobalPolluted, `Expected "with c = 2" not to pollute StateManager.values.c`);
        assert(cChecks1.baseWarnHidden && !cChecks1.baseRes.includes('Curva'),
            `Expected f(0)=1 without warning or "Curva de Solução", got res="${cChecks1.baseRes}"`);
        assert(cChecks1.recWarnHidden, `Expected recursive f(x)=x*f(x-1) without warning`);
        assert(cChecks1.fac5Res === '= 120' && cChecks1.fac5WarnHidden,
            `Expected f(5) "= 120" without warning, got "${cChecks1.fac5Res}"`);

        // Switch to 3D mode: 3D cross product & 3D point must stay clean without 2D-mode warnings
        await page.click('#mode-3d-btn');
        await page.waitForTimeout(800);
        const c3dChecks = await page.evaluate((blockIds) => {
            const getRes = (id) => document.getElementById(id)?.querySelector('.result-display')?.textContent?.trim() || '';
            const isWarnHidden = (id) => {
                const w = document.getElementById(id)?.querySelector('.block-warning-trigger');
                return !w || w.classList.contains('hidden') || getComputedStyle(w).display === 'none';
            };
            return {
                crossRes3d: getRes(blockIds[0]),
                crossWarnHidden3d: isWarnHidden(blockIds[0]),
                pt3dWarnHidden3d: isWarnHidden(blockIds[2])
            };
        }, cIds1);
        assert(c3dChecks.crossRes3d === '= (7, -14, 7)' && c3dChecks.crossWarnHidden3d,
            `Expected clean (6,5,4)x(1,2,3) "= (7, -14, 7)" in 3D mode, got res="${c3dChecks.crossRes3d}", warnHidden=${c3dChecks.crossWarnHidden3d}`);
        assert(c3dChecks.pt3dWarnHidden3d, 'Expected (1,2,3) warning to clear in 3D mode');
        await page.click('#mode-2d-btn');
        await page.waitForTimeout(300);

        // 9. Phase C Wackscope E2E check in clean sheet: w = x^3 - y^3, f(x, y) = w, f(3, 2) -> = 19
        await page.evaluate(() => window._clearAll());
        await page.waitForTimeout(200);
        const cIds2 = await page.evaluate(() => {
            const firstId = document.querySelector('#expressions-list > div')?.id;
            const em = window.ExpressionManager;
            return [
                firstId || em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, '')
            ];
        });
        await setMathBlockValue(page, cIds2[0], 'w = x^3 - y^3');
        await setMathBlockValue(page, cIds2[1], 'f(x, y) = w');
        await setMathBlockValue(page, cIds2[2], 'f(3, 2)');
        await page.waitForTimeout(1000);

        const cChecks2 = await page.evaluate((blockIds) => {
            const getRes = (id) => document.getElementById(id)?.querySelector('.result-display')?.textContent?.trim() || '';
            const isWarnHidden = (id) => {
                const w = document.getElementById(id)?.querySelector('.block-warning-trigger');
                return !w || w.classList.contains('hidden') || getComputedStyle(w).display === 'none';
            };
            return {
                wWarnHidden: isWarnHidden(blockIds[0]),
                fWarnHidden: isWarnHidden(blockIds[1]),
                f32Res: getRes(blockIds[2]),
                f32WarnHidden: isWarnHidden(blockIds[2])
            };
        }, cIds2);

        assert(cChecks2.wWarnHidden, 'Expected "w = x^3 - y^3" not to warn');
        assert(cChecks2.fWarnHidden, 'Expected "f(x, y) = w" not to warn');
        assert(cChecks2.f32Res === '= 19' && cChecks2.f32WarnHidden,
            `Expected wackscope "f(3, 2)" result "= 19" without warning, got "${cChecks2.f32Res}"`);

        // 9. Keyboard shortcut fix: "cross" -> \times, "times" -> NOT \times
        await page.evaluate(() => window._clearAll());
        await page.waitForTimeout(200);
        const kbIds = await page.evaluate(() => {
            const firstId = document.querySelector('#expressions-list > div')?.id;
            const em = window.ExpressionManager;
            return [firstId || em.addBlock(false, ''), em.addBlock(false, '')];
        });
        await page.evaluate((id) => document.getElementById(id)?.querySelector('math-field')?.focus?.(), kbIds[0]);
        await page.waitForTimeout(100);
        await page.keyboard.type('cross');
        await page.waitForTimeout(150);
        await page.evaluate((id) => document.getElementById(id)?.querySelector('math-field')?.focus?.(), kbIds[1]);
        await page.waitForTimeout(100);
        await page.keyboard.type('times');
        await page.waitForTimeout(150);
        const shortcutCheck = await page.evaluate((blockIds) => ({
            crossVal: document.getElementById(blockIds[0])?.querySelector('math-field')?.getValue?.() || '',
            timesVal: document.getElementById(blockIds[1])?.querySelector('math-field')?.getValue?.() || ''
        }), kbIds);
        assert(shortcutCheck.crossVal.trim() === '\\times',
            `Expected typing "cross" in math-field to become \\times, got "${shortcutCheck.crossVal}"`);
        assert(shortcutCheck.timesVal.length > 0 && !shortcutCheck.timesVal.includes('\\times'),
            `Expected typing "times" in math-field NOT to become \\times (and stay focused in block 2), got "${shortcutCheck.timesVal}"`);

        // 10. Phase D E2E checks (parametric/polar domains, implicit polar, matrix integral [a/b], block matrices, list fns)
        await page.evaluate(() => window._clearAll());
        await page.waitForTimeout(200);
        const dIds = await page.evaluate(() => {
            const firstId = document.querySelector('#expressions-list > div')?.id;
            const em = window.ExpressionManager;
            return [
                firstId || em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, ''),
                em.addBlock(false, '')
            ];
        });

        await setMathBlockValue(page, dIds[0], '(-\\cos(t), \\sin(t))');
        await setMathBlockValue(page, dIds[1], 'r = \\sqrt{\\theta}');
        await setMathBlockValue(page, dIds[2], '2 r \\cos(\\theta) = 1');
        await setMathBlockValue(page, dIds[3], '\\int_{0}^{1} [[x, x^2], [x^3, x^4]] dx');
        await setMathBlockValue(page, dIds[4], 'M = [[1, 2], [3, 4]]');
        await setMathBlockValue(page, dIds[5], 'B = [M, M^2; M^3, M^T]');
        await setMathBlockValue(page, dIds[6], '\\operatorname{join}([1, 2], 3)');
        await setMathBlockValue(page, dIds[7], '\\operatorname{repeat}([1, 2], 2)');
        await page.waitForTimeout(1500);

        const dChecks = await page.evaluate((blockIds) => {
            const getEl = (id) => document.getElementById(id);
            const getRes = (id) => {
                const res = getEl(id)?.querySelector('.result-display');
                if (!res) return '';
                const mf = res.querySelector('math-field');
                if (mf && typeof mf.getValue === 'function') return String(mf.getValue() || '').trim();
                const katexAnn = res.querySelector('.katex-mathml annotation');
                if (katexAnn && katexAnn.textContent) return katexAnn.textContent.trim();
                return (res.textContent || '').trim();
            };
            const isWarnHidden = (id) => {
                const w = getEl(id)?.querySelector('.block-warning-trigger');
                return !w || w.classList.contains('hidden') || getComputedStyle(w).display === 'none';
            };
            const getDomainState = (id) => {
                const row = getEl(id)?.querySelector('.domain-bounds-row');
                const visible = Boolean(row && !row.classList.contains('hidden') && getComputedStyle(row).display !== 'none');
                const minVal = row?.querySelector('.domain-min-input')?.value || '';
                const maxVal = row?.querySelector('.domain-max-input')?.value || '';
                return { visible, minVal, maxVal };
            };
            const impPolarChips = getEl(blockIds[2])?.querySelector('.slider-chips-row');
            const impPolarHasSliders = Boolean(
                impPolarChips && !impPolarChips.classList.contains('hidden') && getComputedStyle(impPolarChips).display !== 'none'
            );
            const fracBtn = getEl(blockIds[3])?.querySelector('.fraction-toggle-btn');
            const fracBtnVisible = Boolean(fracBtn && !fracBtn.classList.contains('hidden') && getComputedStyle(fracBtn).display !== 'none');

            return {
                paramDomain: getDomainState(blockIds[0]),
                paramWarnHidden: isWarnHidden(blockIds[0]),
                polarDomain: getDomainState(blockIds[1]),
                polarWarnHidden: isWarnHidden(blockIds[1]),
                impPolarWarnHidden: isWarnHidden(blockIds[2]),
                impPolarHasSliders,
                intMatResBefore: getRes(blockIds[3]),
                hasMfracBefore: Boolean(getEl(blockIds[3])?.querySelector('.result-display .ML__frac, .result-display .mfrac')),
                intMatWarnHidden: isWarnHidden(blockIds[3]),
                fracBtnVisible,
                mRes: getRes(blockIds[4]),
                mTooltip: getEl(blockIds[4])?.querySelector('.warning-popover-tooltip')?.textContent?.trim() || '',
                mWarnHidden: isWarnHidden(blockIds[4]),
                blockMatRes: getRes(blockIds[5]),
                blockMatWarnHidden: isWarnHidden(blockIds[5]),
                joinRes: getRes(blockIds[6]),
                joinWarnHidden: isWarnHidden(blockIds[6]),
                repeatRes: getRes(blockIds[7]),
                repeatWarnHidden: isWarnHidden(blockIds[7])
            };
        }, dIds);

        assert(dChecks.paramDomain.visible && dChecks.paramDomain.minVal === '0' && dChecks.paramDomain.maxVal === '1',
            `Expected parametric domain [0, 1], got ${JSON.stringify(dChecks.paramDomain)}`);
        assert(dChecks.paramWarnHidden, 'Expected parametric curve not to warn');
        assert(dChecks.polarDomain.visible && dChecks.polarDomain.minVal === '0' && dChecks.polarDomain.maxVal.includes('12'),
            `Expected polar domain [0, 12pi], got ${JSON.stringify(dChecks.polarDomain)}`);
        assert(dChecks.polarWarnHidden, 'Expected explicit polar curve not to warn');
        assert(dChecks.impPolarWarnHidden && !dChecks.impPolarHasSliders,
            `Expected implicit polar equation not to warn or emit r/theta sliders (warnHidden=${dChecks.impPolarWarnHidden}, sliders=${dChecks.impPolarHasSliders})`);
        assert(dChecks.intMatWarnHidden && dChecks.fracBtnVisible,
            `Expected matrix definite integral to succeed with [a/b] toggle visible (warnHidden=${dChecks.intMatWarnHidden}, fracBtn=${dChecks.fracBtnVisible}, res="${dChecks.intMatResBefore}")`);

        // Click [a/b] toggle on matrix definite integral and edit parametric domain bound
        await page.locator(`#${dIds[3]} .fraction-toggle-btn`).click();
        await page.locator(`#${dIds[0]} .domain-max-input`).fill('2pi');
        await page.locator(`#${dIds[0]} .domain-max-input`).press('Enter');
        await page.waitForTimeout(300);

        const dAfterChecks = await page.evaluate((blockIds) => {
            const getEl = (id) => document.getElementById(id);
            const resEl = getEl(blockIds[3])?.querySelector('.result-display');
            const mf = resEl?.querySelector('math-field');
            const katexAnn = resEl?.querySelector('.katex-mathml annotation');
            const intMatAfter = mf && typeof mf.getValue === 'function'
                ? String(mf.getValue() || '').trim()
                : (katexAnn?.textContent ? katexAnn.textContent.trim() : (resEl?.textContent || '').trim());
            const hasFracClass = Boolean(resEl?.querySelector('.ML__frac, .mfrac'));
            const fracBtnActive = Boolean(getEl(blockIds[3])?.querySelector('.fraction-toggle-btn.active'));
            const paramWarn = getEl(blockIds[0])?.querySelector('.block-warning-trigger');
            const paramWarnHidden = !paramWarn || paramWarn.classList.contains('hidden') || getComputedStyle(paramWarn).display === 'none';
            return { intMatAfter, hasFracClass, fracBtnActive, paramWarnHidden };
        }, dIds);

        assert(
            dChecks.intMatResBefore.includes('0.5') &&
            dAfterChecks.intMatAfter !== dChecks.intMatResBefore &&
            !dAfterChecks.intMatAfter.includes('0.5') &&
            !dAfterChecks.intMatAfter.includes('0.333') &&
            (dAfterChecks.fracBtnActive || dAfterChecks.hasFracClass || (dAfterChecks.intMatAfter.includes('21') && dAfterChecks.intMatAfter.includes('51'))),
            `Expected [a/b] toggle to convert decimals (0.5/0.333) to fractions, before="${dChecks.intMatResBefore}", after="${dAfterChecks.intMatAfter}", fracBtnActive=${dAfterChecks.fracBtnActive}, hasFracClass=${dAfterChecks.hasFracClass}`
        );
        assert(dAfterChecks.paramWarnHidden, 'Expected editing parametric max bound to 2pi to stay clean');
        assert(dChecks.mWarnHidden, `Expected "M = [[1, 2], [3, 4]]" not to warn, got res="${dChecks.mRes}", tooltip="${dChecks.mTooltip}"`);
        assert(dChecks.blockMatWarnHidden && dChecks.blockMatRes.length > 0 && dChecks.blockMatRes.includes('37') && dChecks.blockMatRes.includes('118'),
            `Expected block matrix B = [M, M^2; M^3, M^T] to evaluate (4x4 with M^3 containing 37 and 118), got "${dChecks.blockMatRes}"`);
        assert(dChecks.joinWarnHidden && dChecks.joinRes.replace(/\s+/g, '').includes('[1,2,3]'),
            `Expected join([1,2], 3) result to contain "[1,2,3]", got "${dChecks.joinRes}"`);
        assert(dChecks.repeatWarnHidden && dChecks.repeatRes.replace(/\s+/g, '').includes('[1,1,2,2]'),
            `Expected repeat([1,2], 2) result to contain "[1,1,2,2]", got "${dChecks.repeatRes}"`);

        assert(pageErrors.length === 0, `pageErrors during interaction: ${pageErrors.join(' | ')}`);
        assert(consoleErrors.length === 0, `consoleErrors during interaction: ${consoleErrors.join(' | ')}`);

        console.log('E2E_ALL_PASSED', JSON.stringify({ phaseAB: checks, phaseC1: cChecks1, phaseC2: cChecks2, shortcutCheck, phaseD: dChecks, phaseDAfter: dAfterChecks }, null, 2));
    } finally {
        if (browser) await browser.close().catch(() => {});
        if (viteProc && !viteProc.killed) {
            if (process.platform === 'win32' && viteProc.pid) {
                spawn('taskkill', ['/PID', String(viteProc.pid), '/T', '/F'], { stdio: 'ignore' });
            } else {
                viteProc.kill('SIGTERM');
            }
        }
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
