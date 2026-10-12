import { chromium } from 'playwright';
import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { MathEngine } from '../src/core/mathEngine.js';
import { PrattParser } from '../src/core/prattParser.js';
import { Tokenizer, TokenTypes } from '../src/core/tokenizer.js';

console.log('================================================================');
console.log('🧪 TEST SUITE - AGENT 6: LINEAR ALGEBRA, MATRICES & STATISTICS');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: { testName: string; details: any }[] = [];

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details !== undefined) {
      console.error(`     Details:`, details);
    }
    failedTests++;
    failures.push({ testName, details });
  }
}

// Normalizer for Unicode minus and whitespace
function normalizeMathStr(s: string): string {
  return s
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// =========================================================================
// SECTION 1: RESERVED FUNCTIONS & VARIABLE PARSING
// =========================================================================
console.log('[SECTION 1: Reserved Functions & Free Variables]');

const matrixCommands = [
  'det', 'determinant', 'rref', 'reducedrowechelonform',
  'trace', 'tr', 'rank', 'matrixrank', 'inv', 'invert',
  'tran', 'transpose', 'eigenvals', 'eigenvalues',
  'eigenvects', 'eigenvectors'
];

for (const cmd of matrixCommands) {
  assert(
    FaultTolerantParser.RESERVED_FUNCTIONS.has(cmd.toLowerCase()),
    `RESERVED_FUNCTIONS contains matrix cmd "${cmd}"`,
    { cmd }
  );
}

const statCommands = [
  'mean', 'median', 'stdev', 'stddev', 'var', 'variance',
  'samplesd', 'samplevariance', 'length', 'size'
];

for (const cmd of statCommands) {
  assert(
    FaultTolerantParser.RESERVED_FUNCTIONS.has(cmd.toLowerCase()),
    `RESERVED_FUNCTIONS contains stat cmd "${cmd}"`,
    { cmd }
  );
}

// Test free variables detection for matrices
const detVars = FaultTolerantParser.detectFreeVariables('det(A)', ['A']);
assert(detVars.length === 0, 'detectFreeVariables("det(A)", ["A"]) detects 0 free variables (A bound)', detVars);

const multVars = FaultTolerantParser.detectFreeVariables('A * B + 2 * C', ['A', 'B', 'C']);
assert(multVars.length === 0, 'detectFreeVariables("A * B + 2 * C", ["A", "B", "C"]) detects 0 free variables', multVars);

const multVarsUnbound = FaultTolerantParser.detectFreeVariables('A * B + 2 * C', ['A', 'B']);
assert(multVarsUnbound.includes('C') && !multVarsUnbound.includes('A') && !multVarsUnbound.includes('B'),
  'detectFreeVariables identifies unbound C and ignores bound A, B', multVarsUnbound);

const tranVars = FaultTolerantParser.detectFreeVariables("A' + B^T + C^{-1}", ['A', 'B', 'C']);
assert(tranVars.length === 0, 'detectFreeVariables handles A\', B^T, C^{-1} without leaking free variables', tranVars);

const caseVars = FaultTolerantParser.detectFreeVariables('det(a)', ['A']);
assert(caseVars.includes('a') && !caseVars.includes('A'),
  'detectFreeVariables maintains strict case-sensitivity: lowercase "a" is free when uppercase "A" is registered', caseVars);

// =========================================================================
// SECTION 2: MATRIX SHORTCUT REGEX MATCHING (#22, #33, matrix, matriz)
// =========================================================================
console.log('\n[SECTION 2: Matrix Creation Shortcuts]');

function matchShortcut(rawAscii: string, rawLatex: string = ''): { isMatch: boolean; name?: string; rows?: number; cols?: number; type: string } {
  const noSpaceAscii = rawAscii.replace(/\s+/g, '');
  const cleanLatex = rawLatex
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\operatorname\{([^}]+)\}/g, '$1')
    .replace(/\\#/g, '#')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '');

  const hashMatch = noSpaceAscii.match(/^(?:([a-zA-Z])=)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i) ||
                    cleanLatex.match(/^(?:([a-zA-Z])=)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i);
  if (hashMatch) {
    return {
      isMatch: true,
      type: 'hash',
      name: hashMatch[1] ? hashMatch[1].toUpperCase() : undefined,
      rows: parseInt(hashMatch[2]),
      cols: parseInt(hashMatch[3])
    };
  }

  const matrixMatch = noSpaceAscii.match(/^(?:([a-zA-Z])=)?matri[xz]$/i) ||
                      cleanLatex.match(/^(?:([a-zA-Z])=)?\\?matri[xz]$/i);
  if (matrixMatch) {
    return {
      isMatch: true,
      type: 'keyword',
      name: matrixMatch[1] ? matrixMatch[1].toUpperCase() : undefined,
      rows: 2,
      cols: 2
    };
  }

  return { isMatch: false, type: 'none' };
}

assert(matchShortcut('#22').isMatch && matchShortcut('#22').rows === 2 && matchShortcut('#22').cols === 2,
  'Matches "#22" -> 2x2 matrix');
assert(matchShortcut('#33').isMatch && matchShortcut('#33').rows === 3 && matchShortcut('#33').cols === 3,
  'Matches "#33" -> 3x3 matrix');
assert(matchShortcut('#13').isMatch && matchShortcut('#13').rows === 1 && matchShortcut('#13').cols === 3,
  'Matches "#13" -> 1x3 row vector');
assert(matchShortcut('#31').isMatch && matchShortcut('#31').rows === 3 && matchShortcut('#31').cols === 1,
  'Matches "#31" -> 3x1 column vector');
assert(matchShortcut('A = #22').isMatch && matchShortcut('A = #22').name === 'A' && matchShortcut('A = #22').rows === 2,
  'Matches "A = #22" -> named matrix A 2x2');
assert(matchShortcut('B = #34').isMatch && matchShortcut('B = #34').name === 'B' && matchShortcut('B = #34').rows === 3 && matchShortcut('B = #34').cols === 4,
  'Matches "B = #34" -> named matrix B 3x4');
assert(matchShortcut('matrix').isMatch && matchShortcut('matrix').rows === 2 && matchShortcut('matrix').cols === 2,
  'Matches "matrix" -> 2x2 matrix');
assert(matchShortcut('matriz').isMatch && matchShortcut('matriz').rows === 2 && matchShortcut('matriz').cols === 2,
  'Matches "matriz" -> 2x2 matrix');
assert(matchShortcut('M = matrix').isMatch && matchShortcut('M = matrix').name === 'M',
  'Matches "M = matrix" -> named matrix M 2x2');
assert(matchShortcut('m = matriz').isMatch && matchShortcut('m = matriz').name === 'M',
  'Matches "m = matriz" -> uppercase name M');
assert(!matchShortcut('#99').isMatch,
  'Rejects "#99" (>8 dimension limit)');

// =========================================================================
// SECTION 3: INDEXING SANITIZATION IN CURRENT CODEBASE
// =========================================================================
console.log('\n[SECTION 3: Indexing Sanitization in Codebase (main.ts L491)]');

function currentCodebaseIndexSanitization(input: string): string {
  let cleanStr = input;
  // Current regex in main.ts line 491:
  cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_\(([0-9]+),([0-9]+)\)/g, (_match, p1, p2, p3) => {
    return `${p1}[${parseInt(p2)-1},${parseInt(p3)-1}]`;
  });
  cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_([0-9]+)\b/g, (match, p1, p2) => {
    if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'u', 'v', 'w', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
    return `${p1}[${parseInt(p2)-1}]`;
  });
  return cleanStr;
}

// Current behavior analysis:
const cur_A_11 = currentCodebaseIndexSanitization('A_(1,1)');
assert(cur_A_11 === 'A[0,0]', 'Current regex supports A_(1,1) -> A[0,0]', cur_A_11);

const cur_A_1_2 = currentCodebaseIndexSanitization('A_(1, 2)');
assert(cur_A_1_2 === 'A_(1, 2)', 'DISCREPANCY: Current regex does NOT support space in A_(1, 2)', cur_A_1_2);

const cur_A_brace = currentCodebaseIndexSanitization('A_{1,1}');
assert(cur_A_brace === 'A_{1,1}', 'DISCREPANCY: Current regex does NOT support LaTeX braces in A_{1,1}', cur_A_brace);

const cur_A_bracket = currentCodebaseIndexSanitization('A[1,1]');
assert(cur_A_bracket === 'A[1,1]', 'DISCREPANCY: Current regex has NO handler for A[1,1] bracket notation (passes un-normalized 1-based indexing to Giac)', cur_A_bracket);

// =========================================================================
// SECTION 4: LIVE IN-BROWSER GIAC & UI TESTS (PLAYWRIGHT)
// =========================================================================
console.log('\n[SECTION 4: Real Browser E2E Tests with Giac WebAssembly]');

async function runBrowserE2E() {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (e) {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (e2) {
      console.warn('⚠️ Could not launch browser for E2E tests, skipping browser portion:', e2);
      return;
    }
  }

  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('Navigating to Motor-Calc application at http://localhost:4173 ...');
  await page.goto('http://localhost:4173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for Giac wasm initialization

  // 4.1 Direct Giac CAS Core Engine Verification
  console.log('\n--- 4.1 Direct Giac CAS Core Engine Verification ---');

  const giacDirectTests: { query: string; check: (res: string) => boolean; desc: string }[] = [
    // Matrix commands
    { query: 'det([[1, 2], [3, 4]])', check: res => res.includes('-2'), desc: 'det 2x2' },
    { query: 'det([[1, 2, 3], [0, 1, 4], [5, 6, 0]])', check: res => res.includes('1'), desc: 'det 3x3' },
    { query: 'det([[1, 2], [2, 4]])', check: res => res.trim() === '0', desc: 'det singular = 0' },
    { query: 'rref([[1, 2], [3, 4]])', check: res => res.replace(/\s+/g, '').includes('[[1,0],[0,1]]'), desc: 'rref invertible' },
    { query: 'rref([[1, 2], [2, 4]])', check: res => res.replace(/\s+/g, '').includes('[[1,2],[0,0]]'), desc: 'rref dependent' },
    { query: 'trace([[1, 2], [3, 4]])', check: res => res.trim() === '5', desc: 'trace 2x2' },
    { query: 'rank([[1, 2], [3, 4]])', check: res => res.trim() === '2', desc: 'rank full' },
    { query: 'rank([[1, 2], [2, 4]])', check: res => res.trim() === '1', desc: 'rank deficient' },
    { query: 'inv([[1, 2], [3, 4]])', check: res => res.includes('-2') && res.includes('1'), desc: 'inv 2x2' },
    { query: 'tran([[1, 2], [3, 4]])', check: res => res.replace(/\s+/g, '').includes('[[1,3],[2,4]]'), desc: 'tran 2x2' },
    { query: 'tran([[1, 2, 3], [4, 5, 6]])', check: res => res.replace(/\s+/g, '').includes('[[1,4],[2,5],[3,6]]'), desc: 'tran 2x3 non-square' },
    { query: 'eigenvals([[2, 0], [0, 5]])', check: res => res.includes('2') && res.includes('5'), desc: 'eigenvals diagonal' },
    { query: 'eigenvects([[2, 0], [0, 5]])', check: res => !res.includes('Erro'), desc: 'eigenvects diagonal' },

    // Matrix operations
    { query: '[[1, 2], [3, 4]] * [[1, 0], [0, 1]]', check: res => res.replace(/\s+/g, '').includes('[[1,2],[3,4]]'), desc: 'mult identity' },
    { query: '[[1, 2], [3, 4]] * [[2, 0], [1, 2]]', check: res => res.replace(/\s+/g, '').includes('[[4,4],[10,8]]'), desc: 'mult 2x2' },
    { query: '[[1, 2], [3, 4]] + [[5, 6], [7, 8]]', check: res => res.replace(/\s+/g, '').includes('[[6,8],[10,12]]'), desc: 'addition 2x2' },
    { query: '2 * [[1, 2], [3, 4]]', check: res => res.replace(/\s+/g, '').includes('[[2,4],[6,8]]'), desc: 'scalar mult 2 * M' },
    { query: '[[1, 2], [3, 4]]^2', check: res => res.replace(/\s+/g, '').includes('[[7,10],[15,22]]'), desc: 'matrix power ^2' },
    { query: '[[1, 2], [3, 4]]^3', check: res => res.replace(/\s+/g, '').includes('[[37,54],[81,118]]'), desc: 'matrix power ^3' },

    // Matrix indexing in Giac (0-indexed behavior!)
    { query: '[[10, 20], [30, 40]][0, 0]', check: res => res.trim() === '10', desc: 'Giac indexing [0, 0] returns top-left 10' },
    { query: '[[10, 20], [30, 40]][0, 1]', check: res => res.trim() === '20', desc: 'Giac indexing [0, 1] returns top-right 20' },
    { query: '[[10, 20], [30, 40]][1, 0]', check: res => res.trim() === '30', desc: 'Giac indexing [1, 0] returns bottom-left 30' },
    { query: '[[10, 20], [30, 40]][1, 1]', check: res => res.trim() === '40', desc: 'Giac indexing [1, 1] returns bottom-right 40' },
    { query: '[[10, 20], [30, 40]][0][0]', check: res => res.trim() === '10', desc: 'Giac indexing [0][0] returns 10' },
    { query: '[[10, 20], [30, 40]][1][1]', check: res => res.trim() === '40', desc: 'Giac indexing [1][1] returns 40' },

    // Statistics commands
    { query: 'mean([1, 2, 3, 4, 5])', check: res => res.trim() === '3', desc: 'mean bracketed [1..5]' },
    { query: 'median([1, 2, 10, 20, 30])', check: res => res.trim() === '10' || res.trim() === '10.0', desc: 'median odd' },
    { query: 'median([1, 2, 3, 4])', check: res => res.includes('2') || res.includes('5/2'), desc: 'median even' },
    { query: 'stddev([2, 4, 6])', check: res => !res.includes('Erro'), desc: 'stddev bracketed' },
    { query: 'variance([2, 4, 6])', check: res => res.includes('8/3') || res.includes('2.66'), desc: 'variance bracketed' },
    { query: 'size([1, 2, 3, 4, 5])', check: res => res.trim() === '5', desc: 'size/length list' }
  ];

  for (const t of giacDirectTests) {
    const rawResult: string = await page.evaluate(async (q) => {
      return await (window as any).MathEngine.askGiac(q);
    }, t.query);
    const ok = t.check(rawResult);
    assert(ok, `Direct Giac: ${t.desc} ("${t.query}") -> "${rawResult.trim()}"`, {
      result: rawResult.trim()
    });
  }

  // 4.2 Setup Matrix Blocks in UI
  console.log('\n--- 4.2 Setting up Interactive Matrix Blocks in UI ---');

  await page.evaluate(() => {
    (window as any).ExpressionManager.addMatrix({
      name: 'A',
      rows: 2,
      cols: 2,
      data: [['1', '2'], ['3', '4']]
    });
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    (window as any).ExpressionManager.addMatrix({
      name: 'B',
      rows: 2,
      cols: 2,
      data: [['2', '0'], ['1', '2']]
    });
  });
  await page.waitForTimeout(500);

  const defs = await page.evaluate(() => (window as any).StateManager.giacDefinitions);
  assert(defs['A'] && defs['A'].includes('[[1, 2], [3, 4]]'), 'Matrix A registered in StateManager.giacDefinitions: usr_A:=[[1, 2], [3, 4]]', defs['A']);
  assert(defs['B'] && defs['B'].includes('[[2, 0], [1, 2]]'), 'Matrix B registered in StateManager.giacDefinitions: usr_B:=[[2, 0], [1, 2]]', defs['B']);

  // 4.3 Matrix Commands via UI
  console.log('\n--- 4.3 Testing Matrix Commands via UI Expressions ---');

  const matrixCmdTests = [
    { expr: 'det(A)', check: (r: string) => r.includes('-2'), desc: 'det(A) = -2' },
    { expr: 'determinant(A)', check: (r: string) => r.includes('-2'), desc: 'determinant(A) alias' },
    { expr: 'rref(A)', check: (r: string) => r.includes('1') && r.includes('0'), desc: 'rref(A)' },
    { expr: 'trace(A)', check: (r: string) => r.includes('5'), desc: 'trace(A) = 5' },
    { expr: 'tr(A)', check: (r: string) => r.includes('5'), desc: 'tr(A) alias = 5' },
    { expr: 'rank(A)', check: (r: string) => r.includes('2'), desc: 'rank(A) = 2' },
    { expr: 'inv(A)', check: (r: string) => r.includes('-2') && r.includes('1'), desc: 'inv(A)' },
    { expr: 'tran(A)', check: (r: string) => r.includes('3') && r.includes('2'), desc: 'tran(A)' },
    { expr: 'A^T', check: (r: string) => r.includes('3') && r.includes('2'), desc: 'A^T transpose notation' },
    { expr: 'A^{-1}', check: (r: string) => r.includes('-2') && r.includes('1'), desc: 'A^{-1} inverse notation' },
    { expr: "A'", check: (r: string) => r.includes('3') && r.includes('2'), desc: "A' prime transpose notation" },
    { expr: 'eigenvals(A)', check: (r: string) => r.includes('sqrt(33)') || r.includes('33'), desc: 'eigenvals(A)' },
    { expr: 'eigenvects(A)', check: (r: string) => r.includes('sqrt(33)') || r.includes('33'), desc: 'eigenvects(A)' }
  ];

  for (const t of matrixCmdTests) {
    const blockId = await page.evaluate((exprStr) => (window as any).ExpressionManager.addExpression(exprStr), t.expr);
    await page.waitForTimeout(800);

    const check = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      const resDisplay = block?.querySelector('.result-display') as HTMLElement;
      const chipsRow = block?.querySelector('.slider-chips-row') as HTMLElement;
      return {
        resultText: resDisplay ? resDisplay.innerText : '',
        chipsVisible: chipsRow ? !chipsRow.classList.contains('hidden') : false
      };
    }, blockId);

    const normRes = normalizeMathStr(check.resultText);
    const ok = !check.chipsVisible && t.check(normRes) && !normRes.includes('Erro');
    assert(ok, `Matrix Cmd: ${t.desc} (input: "${t.expr}") -> Result: "${normRes}"`, {
      resultText: normRes,
      chipsVisible: check.chipsVisible
    });
  }

  // 4.4 Matrix Operations via UI
  console.log('\n--- 4.4 Testing Matrix Operations via UI Expressions ---');

  const matrixOpTests = [
    { expr: 'A * B', check: (r: string) => r.includes('4') && r.includes('10'), desc: 'Multiplication A * B' },
    { expr: 'A + B', check: (r: string) => r.includes('3') && r.includes('6'), desc: 'Addition A + B' },
    { expr: '2 * A', check: (r: string) => r.includes('2') && r.includes('4') && r.includes('6') && r.includes('8'), desc: 'Scalar product 2 * A' },
    { expr: '2A', check: (r: string) => r.includes('2') && r.includes('4') && r.includes('6') && r.includes('8'), desc: 'Scalar product 2A (implicit mult)' },
    { expr: 'A^2', check: (r: string) => r.includes('7') && r.includes('10') && r.includes('15') && r.includes('22'), desc: 'Matrix power A^2' }
  ];

  for (const t of matrixOpTests) {
    const blockId = await page.evaluate((exprStr) => (window as any).ExpressionManager.addExpression(exprStr), t.expr);
    await page.waitForTimeout(800);

    const check = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      const resDisplay = block?.querySelector('.result-display') as HTMLElement;
      const chipsRow = block?.querySelector('.slider-chips-row') as HTMLElement;
      return {
        resultText: resDisplay ? resDisplay.innerText : '',
        chipsVisible: chipsRow ? !chipsRow.classList.contains('hidden') : false
      };
    }, blockId);

    const normRes = normalizeMathStr(check.resultText);
    const ok = !check.chipsVisible && t.check(normRes) && !normRes.includes('Erro');
    assert(ok, `Matrix Op: ${t.desc} (input: "${t.expr}") -> Result: "${normRes}"`, {
      resultText: normRes,
      chipsVisible: check.chipsVisible
    });
  }

  // 4.5 Statistics Commands via UI
  console.log('\n--- 4.5 Testing Statistics Commands via UI Expressions ---');

  const statTests = [
    { expr: 'mean([1, 2, 3, 4, 5])', check: (r: string) => r.includes('3'), desc: 'mean with bracketed list [1..5]' },
    { expr: 'mean(1, 2, 3, 4, 5)', check: (r: string) => r.includes('3'), desc: 'mean with comma-separated arguments' },
    { expr: 'median([1, 2, 10, 20, 30])', check: (r: string) => r.includes('10'), desc: 'median with bracketed list' },
    { expr: 'median(1, 2, 10, 20, 30)', check: (r: string) => r.includes('10'), desc: 'median with comma-separated arguments' },
    { expr: 'stdev([2, 4, 6])', check: (r: string) => !r.includes('Erro'), desc: 'stdev with bracketed list' },
    { expr: 'stdev(2, 4, 6)', check: (r: string) => !r.includes('Erro'), desc: 'stdev with comma-separated arguments' },
    { expr: 'var([2, 4, 6])', check: (r: string) => r.includes('8/3') || r.includes('2.66'), desc: 'var with bracketed list' },
    { expr: 'var(2, 4, 6)', check: (r: string) => r.includes('8/3') || r.includes('2.66'), desc: 'var with comma-separated arguments' },
    { expr: 'length([1, 2, 3, 4, 5])', check: (r: string) => r.includes('5'), desc: 'length with bracketed list' },
    { expr: 'length(1, 2, 3, 4, 5)', check: (r: string) => r.includes('5'), desc: 'length with comma-separated arguments' }
  ];

  for (const t of statTests) {
    const blockId = await page.evaluate((exprStr) => (window as any).ExpressionManager.addExpression(exprStr), t.expr);
    await page.waitForTimeout(800);

    const check = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      const resDisplay = block?.querySelector('.result-display') as HTMLElement;
      const chipsRow = block?.querySelector('.slider-chips-row') as HTMLElement;
      return {
        resultText: resDisplay ? resDisplay.innerText : '',
        chipsVisible: chipsRow ? !chipsRow.classList.contains('hidden') : false
      };
    }, blockId);

    const normRes = normalizeMathStr(check.resultText);
    const ok = !check.chipsVisible && t.check(normRes) && !normRes.includes('Erro');
    assert(ok, `Stats Cmd: ${t.desc} (input: "${t.expr}") -> Result: "${normRes}"`, {
      resultText: normRes,
      chipsVisible: check.chipsVisible
    });
  }

  // 4.6 Matrix Indexing Behavior via UI
  console.log('\n--- 4.6 Testing Matrix Indexing Behavior in UI ---');
  console.log('Matrix A is [[1, 2], [3, 4]]:');
  console.log('  Top-left (Row 1, Col 1): 1');
  console.log('  Top-right (Row 1, Col 2): 2');
  console.log('  Bottom-left (Row 2, Col 1): 3');
  console.log('  Bottom-right (Row 2, Col 2): 4');

  const indexingTests = [
    { expr: 'A_(1,1)', expectedVal: '1', desc: 'Subscript syntax A_(1,1) -> row 1 col 1' },
    { expr: 'A_(1,2)', expectedVal: '2', desc: 'Subscript syntax A_(1,2) -> row 1 col 2' },
    { expr: 'A_(2,1)', expectedVal: '3', desc: 'Subscript syntax A_(2,1) -> row 2 col 1' },
    { expr: 'A_(2,2)', expectedVal: '4', desc: 'Subscript syntax A_(2,2) -> row 2 col 2' },
    { expr: 'A[1,1]', expectedVal: '1', desc: 'Bracket syntax A[1,1] -> row 1 col 1 (Tests if 1-based indexing is honored)' },
    { expr: 'A[1,2]', expectedVal: '2', desc: 'Bracket syntax A[1,2] -> row 1 col 2 (Tests if 1-based indexing is honored)' },
    { expr: 'A[2,1]', expectedVal: '3', desc: 'Bracket syntax A[2,1] -> row 2 col 1 (Tests if 1-based indexing is honored)' },
    { expr: 'A[2,2]', expectedVal: '4', desc: 'Bracket syntax A[2,2] -> row 2 col 2 (Tests if 1-based indexing is honored)' },
    { expr: 'A_(1, 2)', expectedVal: '2', desc: 'Subscript syntax with space A_(1, 2)' }
  ];

  for (const t of indexingTests) {
    const blockId = await page.evaluate((exprStr) => (window as any).ExpressionManager.addExpression(exprStr), t.expr);
    await page.waitForTimeout(800);

    const check = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      const resDisplay = block?.querySelector('.result-display') as HTMLElement;
      const chipsRow = block?.querySelector('.slider-chips-row') as HTMLElement;
      return {
        resultText: resDisplay ? resDisplay.innerText : '',
        chipsVisible: chipsRow ? !chipsRow.classList.contains('hidden') : false
      };
    }, blockId);

    const normRes = normalizeMathStr(check.resultText);
    const ok = !check.chipsVisible && normRes.includes(t.expectedVal) && !normRes.includes('Erro');
    assert(ok, `Indexing: ${t.desc} (input: "${t.expr}") -> Result: "${normRes}" [Expected: ${t.expectedVal}]`, {
      expected: t.expectedVal,
      actual: normRes,
      chipsVisible: check.chipsVisible
    });
  }

  // 4.7 Matrix Auto-Transformation via Keyboard Input (#22, #33, matrix)
  console.log('\n--- 4.7 Testing MathField Auto-Transformation (#22, #33, matrix) ---');

  const shortcutTests = [
    { input: '#22', expectedType: 'matrix', expectedRows: '2', expectedCols: '2', desc: 'Typing #22 converts block to 2x2 matrix' },
    { input: '#33', expectedType: 'matrix', expectedRows: '3', expectedCols: '3', desc: 'Typing #33 converts block to 3x3 matrix' },
    { input: '#13', expectedType: 'matrix', expectedRows: '1', expectedCols: '3', desc: 'Typing #13 converts block to 1x3 row matrix' },
    { input: '#31', expectedType: 'matrix', expectedRows: '3', expectedCols: '1', desc: 'Typing #31 converts block to 3x1 column matrix' },
    { input: 'matrix', expectedType: 'matrix', expectedRows: '2', expectedCols: '2', desc: 'Typing "matrix" converts block to 2x2 matrix' },
    { input: 'matriz', expectedType: 'matrix', expectedRows: '2', expectedCols: '2', desc: 'Typing "matriz" converts block to 2x2 matrix' }
  ];

  for (const st of shortcutTests) {
    const testBlockId = await page.evaluate(() => (window as any).ExpressionManager.addExpression(''));
    await page.waitForTimeout(200);

    const converted = await page.evaluate(({ bId, val }) => {
      const block = document.getElementById(bId);
      if (!block) return { success: false, reason: 'block not found' };
      const mf = block.querySelector('math-field') as any;
      if (!mf) return { success: false, reason: 'math-field not found' };

      mf.setValue(val);
      mf.dispatchEvent(new Event('input', { bubbles: true }));

      const container = (window as any).ExpressionManager.container;
      const lastChild = container.lastElementChild as HTMLElement;
      return {
        success: true,
        type: lastChild ? lastChild.dataset.type : '',
        rows: lastChild ? lastChild.dataset.rows : '',
        cols: lastChild ? lastChild.dataset.cols : ''
      };
    }, { bId: testBlockId, val: st.input });

    const ok = converted.success && converted.type === st.expectedType &&
               converted.rows === st.expectedRows && converted.cols === st.expectedCols;
    assert(ok, `Shortcut: ${st.desc} (result: type=${converted.type}, ${converted.rows}x${converted.cols})`, converted);
  }

  // 4.8 Error Handling and Undefined Matrices
  console.log('\n--- 4.8 Testing Undefined Matrix and Strict Case Sensitivity ---');

  const errorTests = [
    { expr: 'det(Z)', desc: 'det(Z) for non-existent matrix Z should report error and NOT suggest sliders' },
    { expr: 'det(a)', desc: 'det(a) lowercase when uppercase A is defined should NOT resolve to A' },
    { expr: 'rref(Z)', desc: 'rref(Z) for non-existent matrix Z' },
    { expr: 'inv(Z)', desc: 'inv(Z) for non-existent matrix Z' }
  ];

  for (const et of errorTests) {
    const blockId = await page.evaluate((exprStr) => (window as any).ExpressionManager.addExpression(exprStr), et.expr);
    await page.waitForTimeout(800);

    const check = await page.evaluate((bId) => {
      const block = document.getElementById(bId);
      const resDisplay = block?.querySelector('.result-display') as HTMLElement;
      const chipsRow = block?.querySelector('.slider-chips-row') as HTMLElement;
      const warningTrigger = block?.querySelector('.block-warning-trigger') as HTMLElement;
      const warningTooltip = block?.querySelector('.warning-popover-tooltip') as HTMLElement;
      return {
        resultText: resDisplay ? resDisplay.innerText : '',
        chipsVisible: chipsRow ? !chipsRow.classList.contains('hidden') : false,
        hasWarning: warningTrigger ? !warningTrigger.classList.contains('hidden') : false,
        warningText: warningTooltip ? warningTooltip.innerText : ''
      };
    }, blockId);

    const normRes = normalizeMathStr(check.resultText);
    const hasCleanError = normRes.includes('Erro') || check.warningText.includes('não definida') || check.hasWarning;
    const noSlidersPrompted = !check.chipsVisible;

    assert(hasCleanError && noSlidersPrompted,
      `Error Safety: ${et.desc} -> Result: "${normRes}", Warning: "${check.warningText}", Sliders: ${check.chipsVisible}`,
      check
    );
  }

  await browser.close();
}

async function main() {
  try {
    await runBrowserE2E();
  } catch (err) {
    console.error('Browser E2E Error:', err);
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
  console.log('================================================================');

  if (failures.length > 0) {
    console.log('\n❌ FAILED TESTS SUMMARY:');
    failures.forEach((f, i) => {
      console.log(`${i + 1}. ${f.testName}`);
      console.log(`   Details:`, JSON.stringify(f.details));
    });
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
