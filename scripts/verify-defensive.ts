import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { Tokenizer, TokenTypes } from '../src/core/tokenizer.js';

console.log('--- STARTING DEFENSIVE EDGE CASE TESTS ---');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || '');
    failed++;
  }
}

// 1. FaultTolerantParser: Reserved functions vs Free Variables
console.log('\n[TEST GROUP 1: Free Variable Detection]');

const sqrVars = FaultTolerantParser.detectFreeVariables('sqr');
assert(
  sqrVars.includes('s') && sqrVars.includes('q') && sqrVars.includes('r'),
  'Decomposes unknown multiletter string "sqr" into s, q, r',
  sqrVars
);

const rrefVars = FaultTolerantParser.detectFreeVariables('rref(A)');
assert(
  rrefVars.length === 1 && rrefVars[0] === 'A',
  'Preserves reserved function "rref" and only detects "A"',
  rrefVars
);

const standardVars = FaultTolerantParser.detectFreeVariables('a * x + b - c');
assert(
  standardVars.includes('a') && standardVars.includes('b') && standardVars.includes('c') && !standardVars.includes('x'),
  'Detects a, b, c and ignores coordinate variable x',
  standardVars
);

const subscriptVars = FaultTolerantParser.detectFreeVariables('m_1 * x + b_2');
assert(
  subscriptVars.includes('m_1') && subscriptVars.includes('b_2'),
  'Detects subscripted variables m_1 and b_2',
  subscriptVars
);

const trigVars = FaultTolerantParser.detectFreeVariables('\\sin(x) + \\cos(y) + \\tan(z) + \\ln(x)');
assert(
  trigVars.length === 0,
  'Ignores coordinates and math functions (sin, cos, tan, ln)',
  trigVars
);

const logVars = FaultTolerantParser.detectFreeVariables('\\log(w)');
assert(
  logVars.includes('w'),
  'Correctly identifies w as free variable in \\log(w)',
  logVars
);

const matrixVars = FaultTolerantParser.detectFreeVariables('matrix');
assert(
  matrixVars.length === 0,
  'Does NOT decompose reserved word "matrix" into free variables',
  matrixVars
);

const matrizVars = FaultTolerantParser.detectFreeVariables('matriz');
assert(
  matrizVars.length === 0,
  'Does NOT decompose reserved word "matriz" into free variables',
  matrizVars
);

// Teste do regex de auto-substituição instantânea de matriz (com suporte a espaçamento do MathLive e atalhos Desmos #ab)
function matchMatrixInput(rawAscii: string, rawLatex: string = ''): { isMatch: boolean; name?: string; rows?: number; cols?: number } {
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
      name: hashMatch[1] ? hashMatch[1].toUpperCase() : undefined,
      rows: parseInt(hashMatch[2]),
      cols: parseInt(hashMatch[3])
    };
  }

  const match = noSpaceAscii.match(/^(?:([a-zA-Z])=)?matri[xz]$/i) ||
                cleanLatex.match(/^(?:([a-zA-Z])=)?\\?matri[xz]$/i);
  return {
    isMatch: !!match,
    name: match ? (match[1] ? match[1].toUpperCase() : undefined) : undefined,
    rows: 2,
    cols: 2
  };
}

assert(matchMatrixInput('matrix').isMatch, 'Matches standalone "matrix"');
assert(matchMatrixInput('matriz').isMatch, 'Matches standalone "matriz"');
assert(matchMatrixInput('m a t r i x').isMatch, 'Matches spaced MathLive "m a t r i x"');
assert(matchMatrixInput('m a t r i z').isMatch, 'Matches spaced MathLive "m a t r i z"');
assert(matchMatrixInput('M = matrix').name === 'M', 'Extracts matrix name from "M = matrix"');
assert(matchMatrixInput('A = m a t r i z').name === 'A', 'Extracts matrix name from spaced "A = m a t r i z"');
assert(!matchMatrixInput('sin(matrix)').isMatch, 'Does not match inline expression "sin(matrix)"');

// Testes do atalho Desmos #ab (PDF pág 25-26)
assert(matchMatrixInput('#24').isMatch && matchMatrixInput('#24').rows === 2 && matchMatrixInput('#24').cols === 4, 'Matches Desmos shortcut #24 (2x4 matrix)');
assert(matchMatrixInput('#33').isMatch && matchMatrixInput('#33').rows === 3 && matchMatrixInput('#33').cols === 3, 'Matches Desmos shortcut #33 (3x3 matrix)');
assert(matchMatrixInput('#13').isMatch && matchMatrixInput('#13').rows === 1 && matchMatrixInput('#13').cols === 3, 'Matches Desmos shortcut #13 (1x3 matrix)');
assert(matchMatrixInput('B = #24').name === 'B' && matchMatrixInput('B = #24').rows === 2 && matchMatrixInput('B = #24').cols === 4, 'Matches "B = #24"');
assert(matchMatrixInput('', '\\#24').isMatch && matchMatrixInput('', '\\#24').cols === 4, 'Matches LaTeX escaped "\\#24"');
assert(matchMatrixInput('', 'A=\\#{33}').name === 'A' && matchMatrixInput('', 'A=\\#{33}').rows === 3, 'Matches LaTeX "A=\\#{33}"');

// Testes de Proteção de Variáveis Matriciais Já Definidas (Nunca pedir slider para matriz)
console.log('\n[TEST GROUP 1.2: Defined Matrix Variable Protection]');
const definedMatrices = ['B', 'A'];
assert(FaultTolerantParser.detectFreeVariables('B^{-1}', definedMatrices).length === 0, 'Does NOT propose slider for B in B^{-1}');
assert(FaultTolerantParser.detectFreeVariables('B^T', definedMatrices).length === 0, 'Does NOT propose slider for B in B^T');
assert(FaultTolerantParser.detectFreeVariables("B'", definedMatrices).length === 0, "Does NOT propose slider for B in B'");
assert(FaultTolerantParser.detectFreeVariables('det(B)', definedMatrices).length === 0, 'Does NOT propose slider for B in det(B)');
assert(FaultTolerantParser.detectFreeVariables('rref(B)', definedMatrices).length === 0, 'Does NOT propose slider for B in rref(B)');
assert(FaultTolerantParser.detectFreeVariables('trace(B)', definedMatrices).length === 0, 'Does NOT propose slider for B in trace(B)');
assert(FaultTolerantParser.detectFreeVariables('rank(B)', definedMatrices).length === 0, 'Does NOT propose slider for B in rank(B)');
assert(FaultTolerantParser.detectFreeVariables('A + B', definedMatrices).length === 0, 'Does NOT propose slider for A or B in A + B');
assert(FaultTolerantParser.detectFreeVariables('2B', definedMatrices).length === 0, 'Does NOT propose slider for B in 2B');
assert(FaultTolerantParser.detectFreeVariables('2*B + c', definedMatrices).length === 1 && FaultTolerantParser.detectFreeVariables('2*B + c', definedMatrices)[0] === 'c', 'Detects free variable c while protecting matrix B in 2*B + c');

// 2. FaultTolerantParser: Incomplete typing detection
console.log('\n[TEST GROUP 2: Incomplete Expression Detection]');

assert(
  FaultTolerantParser.checkIncompleteStatus('\\sqrt{}').isIncomplete === true,
  'Detects empty radicand \\sqrt{} as incomplete'
);

assert(
  FaultTolerantParser.checkIncompleteStatus('2 + ').isIncomplete === true,
  'Detects trailing operator "2 + " as incomplete'
);

assert(
  FaultTolerantParser.checkIncompleteStatus('(x + 1').isIncomplete === true,
  'Detects unclosed paren "(x + 1" as incomplete'
);

assert(
  FaultTolerantParser.checkIncompleteStatus('\\frac{1}{}').isIncomplete === true,
  'Detects empty denominator \\frac{1}{} as incomplete'
);

assert(
  FaultTolerantParser.checkIncompleteStatus('x^2 + y^2 = 25').isIncomplete === false,
  'Correctly identifies complete circle equation'
);

// 3. FaultTolerantParser: Defensive robustness on unexpected inputs
console.log('\n[TEST GROUP 3: Defensive Boundary Tests]');

try {
  FaultTolerantParser.detectFreeVariables('');
  FaultTolerantParser.detectFreeVariables('     ');
  FaultTolerantParser.detectFreeVariables('\\\\\\');
  FaultTolerantParser.detectFreeVariables('{{{{}}}}');
  FaultTolerantParser.sanitizeLatex('{{{{{');
  FaultTolerantParser.checkIncompleteStatus('');
  assert(true, 'FaultTolerantParser handles empty and malformed LaTeX strings without crashing');
} catch (e) {
  assert(false, 'FaultTolerantParser crashed on malformed string', e);
}

// 4. Tokenizer: Subscripts and Identifiers
console.log('\n[TEST GROUP 4: Tokenizer Subscripts & Identifiers]');

try {
  const tokenizer1 = new Tokenizer();
  const tokens1 = tokenizer1.tokenize('x_1 + x_2');
  const idTokens = tokens1.filter(t => t.type === TokenTypes.IDENTIFIER);
  assert(
    idTokens.length === 2 && idTokens[0].value === 'x_1' && idTokens[1].value === 'x_2',
    'Tokenizer extracts x_1 and x_2 as distinct identifier tokens',
    tokens1
  );

  const tokenizer2 = new Tokenizer();
  const tokens2 = tokenizer2.tokenize('x_{12} + a_0');
  const idTokens2 = tokens2.filter(t => t.type === TokenTypes.IDENTIFIER);
  assert(
    idTokens2.length === 2 && idTokens2[0].value === 'x_12' && idTokens2[1].value === 'a_0',
    'Tokenizer extracts sanitized curly subscript x_12 and a_0',
    tokens2
  );
} catch (e) {
  assert(false, 'Tokenizer failed on subscript test', e);
}

// Testes do operador diferencial d/dx
console.log('\n[TEST GROUP 1.1: Differential Operator (d/dx) Protection]');
const ddxVars1 = FaultTolerantParser.detectFreeVariables('\\frac{d}{dx}(x)');
assert(
  !ddxVars1.includes('d') && !ddxVars1.includes('x'),
  '\\frac{d}{dx}(x) does NOT propose "d" as a free slider variable',
  ddxVars1
);

const ddxVars2 = FaultTolerantParser.detectFreeVariables('d/dx(x)');
assert(
  !ddxVars2.includes('d'),
  'd/dx(x) does NOT propose "d" as a free slider variable',
  ddxVars2
);

const ddxVars3 = FaultTolerantParser.detectFreeVariables('d/dx');
assert(
  !ddxVars3.includes('d'),
  'Incomplete "d/dx" does NOT propose "d" as a free slider variable',
  ddxVars3
);

const ddxVars4 = FaultTolerantParser.detectFreeVariables('\\frac{d}{dx}(a*x^2)');
assert(
  ddxVars4.includes('a') && !ddxVars4.includes('d') && !ddxVars4.includes('x'),
  '\\frac{d}{dx}(a*x^2) detects parameter "a" and protects differential "d" and "x"',
  ddxVars4
);

const ddxInc1 = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}');
assert(
  ddxInc1.isIncomplete === true,
  'Detects empty \\frac{d}{dx} as incomplete',
  ddxInc1
);

const ddxInc2 = FaultTolerantParser.checkIncompleteStatus('', 'd/dx');
assert(
  ddxInc2.isIncomplete === true,
  'Detects standalone d/dx as incomplete',
  ddxInc2
);

// 5. Matrix normalizations (Giac CAS transformations)
console.log('\n[TEST GROUP 5: Giac Matrix Expression Normalizations]');

function testPrefixGiac(input: string, knownMatrices: Set<string>): string {
  let s = input.trim();
  s = s.replace(/\\operatorname\{([^}]+)\}/gi, '$1').replace(/\\mathrm\{([^}]+)\}/gi, '$1').replace(/\\text\{([^}]+)\}/gi, '$1');

  // Transpose: (A+B)^T, (A+B)', A^T, A^{T}, A^{\top}, A^{\intercal}, A'
  s = s.replace(/\(([^)]+)\)\^\{?(?:T|\\top|intercal)\}?/g, 'tran($1)');
  s = s.replace(/\(([^)]+)\)'/g, 'tran($1)');
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?(?:T|\\top|intercal)\}?/g, 'tran($1)');
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)'/g, 'tran($1)');

  // Inverse: (A*B)^{-1}, A^{-1}, A^-1, A^(-1)
  s = s.replace(/\(([^)]+)\)\^\{?\s*(?:-1|\(-1\))\s*\}?/g, 'inv($1)');
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?\s*(?:-1|\(-1\))\s*\}?/g, 'inv($1)');

  // CAS aliases
  s = s.replace(/\btr\(([^)]+)\)/gi, 'trace($1)');
  s = s.replace(/\\?det\s*\(([^)]+)\)/gi, 'det($1)');
  s = s.replace(/\bdeterminant\s*\(([^)]+)\)/gi, 'det($1)');
  s = s.replace(/\breducedrowechelonform\s*\(([^)]+)\)/gi, 'rref($1)');
  s = s.replace(/\bmatrixrank\s*\(([^)]+)\)/gi, 'rank($1)');
  s = s.replace(/\binvert\s*\(([^)]+)\)/gi, 'inv($1)');
  s = s.replace(/\btranspose\s*\(([^)]+)\)/gi, 'tran($1)');

  // Scalar mult: 2A -> 2*A, 3.5B -> 3.5*B
  s = s.replace(/(\d+(?:\.\d+)?)\s*([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\times/g, '*');

  const sortedVars = Array.from(knownMatrices).sort((a, b) => b.length - a.length);
  // Implicit matrix multiplication
  for (const v1 of sortedVars) {
    for (const v2 of sortedVars) {
      s = s.replace(new RegExp(`(?:^|(?<=[^a-zA-Z0-9_]))${v1}\\s+${v2}(?=[^a-zA-Z0-9_]|$)`, 'g'), `${v1}*${v2}`);
      if (v1.length === 1 && v2.length === 1 && v1 !== v2) {
        s = s.replace(new RegExp(`(?:^|(?<=[^a-zA-Z0-9_]))${v1}${v2}(?=[^a-zA-Z0-9_]|$)`, 'g'), `${v1}*${v2}`);
      }
    }
  }

  for (const v of sortedVars) {
    s = s.replace(new RegExp(`(?:^|(?<=[^a-zA-Z0-9_]))${v}(?=[^a-zA-Z0-9_]|$)`, 'g'), `usr_${v}`);
  }
  return s;
}

const transRes = testPrefixGiac('A^T + B^{-1}', new Set(['A', 'B']));
assert(
  transRes === 'tran(usr_A) + inv(usr_B)',
  'Transforms A^T and B^{-1} into CAS tran(usr_A) and inv(usr_B)',
  transRes
);

const topRes = testPrefixGiac('A^{\\top}', new Set(['A']));
assert(
  topRes === 'tran(usr_A)',
  'Transforms LaTeX A^{\\top} into tran(usr_A)',
  topRes
);

const primeRes = testPrefixGiac("A'", new Set(['A']));
assert(
  primeRes === 'tran(usr_A)',
  "Transforms A' into tran(usr_A)",
  primeRes
);

const parensTransRes = testPrefixGiac("(A + B)^T", new Set(['A', 'B']));
assert(
  parensTransRes === 'tran(usr_A + usr_B)',
  'Transforms (A + B)^T into tran(usr_A + usr_B)',
  parensTransRes
);

const parensInvRes = testPrefixGiac("(A B)^{-1}", new Set(['A', 'B']));
assert(
  parensInvRes === 'inv(usr_A*usr_B)',
  'Transforms (A B)^{-1} into inv(usr_A*usr_B)',
  parensInvRes
);

const scalarRes = testPrefixGiac('2A + 3B', new Set(['A', 'B']));
assert(
  scalarRes === '2*usr_A + 3*usr_B',
  'Transforms 2A + 3B into 2*usr_A + 3*usr_B',
  scalarRes
);

const implicitMatRes = testPrefixGiac('A B + 2C', new Set(['A', 'B', 'C']));
assert(
  implicitMatRes === 'usr_A*usr_B + 2*usr_C',
  'Transforms implicit matrix multiplication "A B" into "usr_A*usr_B"',
  implicitMatRes
);

const detRes = testPrefixGiac('det(A)', new Set(['A']));
assert(
  detRes === 'det(usr_A)',
  'Transforms det(A) into det(usr_A)',
  detRes
);

const rrefRes = testPrefixGiac('rref(A)', new Set(['A']));
assert(
  rrefRes === 'rref(usr_A)',
  'Transforms rref(A) into rref(usr_A)',
  rrefRes
);

const rrefLatexRes = testPrefixGiac('\\operatorname{rref}(B)', new Set(['B']));
assert(
  rrefLatexRes === 'rref(usr_B)',
  'Transforms LaTeX \\operatorname{rref}(B) into rref(usr_B)',
  rrefLatexRes
);

const rankRes = testPrefixGiac('rank(B)', new Set(['B']));
assert(
  rankRes === 'rank(usr_B)',
  'Transforms rank(B) into rank(usr_B)',
  rankRes
);

const traceRes = testPrefixGiac('trace(B) + tr(A)', new Set(['A', 'B']));
assert(
  traceRes === 'trace(usr_B) + trace(usr_A)',
  'Transforms trace(B) and tr(A) into trace(usr_B) and trace(usr_A)',
  traceRes
);

function cleanGiacMatrixOutput(raw: string): string {
  return raw.replace(/"/g, '')
            .replace(/matrix\s*\[/g, '[')
            .replace(/list\s*\[/g, '[')
            .replace(/usr_/g, '')
            .trim();
}

const tranClean = cleanGiacMatrixOutput('matrix[[1, 3], [2, 4]]');
assert(
  tranClean === '[[1, 3], [2, 4]]',
  'Cleans Giac "matrix[[" prefix into standard "[[1, 3], [2, 4]]"',
  tranClean
);

// 6. Extreme Input Robustness
console.log('\n[TEST GROUP 6: Extreme Malformed Inputs]');
const malformedCases = [
  '',
  ' ',
  '\\',
  '\\\\\\\\',
  '\\frac{}{}{}{}{}',
  '((((((((',
  '))))))))',
  'x^^^2',
  '+++---***',
  '\\begin{matrix}\\end{matrix}',
  '\\sqrt{\\sqrt{\\sqrt{}}}',
  'a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t + u + v + w + z'
];

let allSurvived = true;
for (const tc of malformedCases) {
  try {
    FaultTolerantParser.checkIncompleteStatus(tc);
    FaultTolerantParser.detectFreeVariables(tc);
    FaultTolerantParser.sanitizeLatex(tc);
  } catch (err) {
    console.error(`Crashed on malformed case: "${tc}"`, err);
    allSurvived = false;
  }
}
assert(allSurvived, 'FaultTolerantParser survives all extreme malformed inputs without throwing');

console.log(`\n--- RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
if (failed > 0) {
  process.exit(1);
}
