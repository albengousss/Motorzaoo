import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { Tokenizer, TokenTypes } from '../src/core/tokenizer.js';
import { MathEngine } from '../src/core/mathEngine.js';
import { PrattParser } from '../src/core/prattParser.js';

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

  // Inverse: (A*B)^{-1}, A^{-1}, A^-1, A^(-1), A^({-1})
  s = s.replace(/\(([^)]+)\)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)');
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)');

  // CAS aliases
  s = s.replace(/\btr\s*\(([^)]+)\)/gi, 'trace($1)');
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
      s = s.replace(new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v1}\\s+${v2}(?=[^a-zA-Z_]|$)`, 'g'), `${v1}*${v2}`);
      if (v1.length === 1 && v2.length === 1 && v1 !== v2) {
        s = s.replace(new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v1}${v2}(?=[^a-zA-Z_]|$)`, 'g'), `${v1}*${v2}`);
      }
    }
  }

  for (const v of sortedVars) {
    s = s.replace(new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v}(?=[^a-zA-Z_]|$)`, 'g'), `usr_${v}`);
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

const invCurlyParen = testPrefixGiac('B^({-1})', new Set(['B']));
assert(
  invCurlyParen === 'inv(usr_B)',
  'Transforms complex inverse B^({-1}) into inv(usr_B)',
  invCurlyParen
);

(global as any).window = { StateManager: { giacDefinitions: { B: 'usr_B:=[[1,2],[3,4]]' } } };
const formatPowerInv = MathEngine.formatForGiac(['Power', 'B', ['Negate', 1]]);
assert(
  formatPowerInv === 'inv(usr_B)',
  'formatForGiac converts Power with -1 exponent to inv(usr_B)',
  formatPowerInv
);

const spacedDetFree = FaultTolerantParser.detectFreeVariables('d e t ( B )', ['B']);
assert(
  spacedDetFree.length === 0,
  'detectFreeVariables does not treat spaced "d e t" as free variables',
  JSON.stringify(spacedDetFree)
);

const spacedRrefFree = FaultTolerantParser.detectFreeVariables('r r e f ( B )', ['B']);
assert(
  spacedRrefFree.length === 0,
  'detectFreeVariables does not treat spaced "r r e f" as free variables',
  JSON.stringify(spacedRrefFree)
);

const spacedTraceFree = FaultTolerantParser.detectFreeVariables('t r a c e ( B )', ['B']);
assert(
  spacedTraceFree.length === 0,
  'detectFreeVariables does not treat spaced "t r a c e" as free variables',
  JSON.stringify(spacedTraceFree)
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

// 7. Integrals, Defint and Differential Validation (Desmos Standard)
console.log('\n[TEST GROUP 7: Integrals, Defint and Differential Validation (Desmos Standard)]');

const missingDiffMsg = 'O integrando deve terminar com uma variável de integração, como dx.';

// 7.1 Incomplete status detection for integrals missing terminal differential
const intMissing1 = FaultTolerantParser.checkIncompleteStatus('\\int x');
assert(intMissing1.isIncomplete && intMissing1.warning === missingDiffMsg, 'Detects missing differential in indefinite integral "\\int x"', intMissing1);

const intMissing2 = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{2} x');
assert(intMissing2.isIncomplete && intMissing2.warning === missingDiffMsg, 'Detects missing differential in definite integral "\\int_{0}^{2} x"', intMissing2);

const intMissing3 = FaultTolerantParser.checkIncompleteStatus('\\int');
assert(intMissing3.isIncomplete && intMissing3.warning === missingDiffMsg, 'Detects missing differential in standalone "\\int"', intMissing3);

const intMissing4 = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{2}');
assert(intMissing4.isIncomplete && intMissing4.warning === missingDiffMsg, 'Detects missing differential in standalone "\\int_{0}^{2}"', intMissing4);

const intMissing5 = FaultTolerantParser.checkIncompleteStatus('\\int_{#?}^{#?}');
assert(intMissing5.isIncomplete && intMissing5.warning === missingDiffMsg, 'Detects missing differential in MathLive shortcut "\\int_{#?}^{#?}"', intMissing5);

const intMissing6 = FaultTolerantParser.checkIncompleteStatus('\\int #?');
assert(intMissing6.isIncomplete && intMissing6.warning === missingDiffMsg, 'Detects missing differential in MathLive shortcut "\\int #?"', intMissing6);

const intMissing7 = FaultTolerantParser.checkIncompleteStatus('', 'int x');
assert(intMissing7.isIncomplete && intMissing7.warning === missingDiffMsg, 'Detects missing differential in ASCII "int x"', intMissing7);

const intMissing8 = FaultTolerantParser.checkIncompleteStatus('', 'defint x');
assert(intMissing8.isIncomplete && intMissing8.warning === missingDiffMsg, 'Detects missing differential in ASCII "defint x"', intMissing8);

const intMissing9 = FaultTolerantParser.checkIncompleteStatus('\\int x d');
assert(intMissing9.isIncomplete && intMissing9.warning === missingDiffMsg, 'Detects incomplete differential "\\int x d"', intMissing9);

const intMissing10 = FaultTolerantParser.checkIncompleteStatus('\\int \\sin(x)');
assert(intMissing10.isIncomplete && intMissing10.warning === missingDiffMsg, 'Detects missing differential in "\\int \\sin(x)"', intMissing10);

const intMissing11 = FaultTolerantParser.checkIncompleteStatus('\\int_{}^{} x dx');
assert(intMissing11.isIncomplete && intMissing11.warning === 'Faltam os limites de integração.', 'Detects empty limits in "\\int_{}^{} x dx"', intMissing11);

const intMissing12 = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{} x dx');
assert(intMissing12.isIncomplete && intMissing12.warning === 'Faltam os limites de integração.', 'Detects empty upper limit in "\\int_{0}^{} x dx"', intMissing12);

const intMissing13 = FaultTolerantParser.checkIncompleteStatus('\\int_{}^{2} x dx');
assert(intMissing13.isIncomplete && intMissing13.warning === 'Faltam os limites de integração.', 'Detects empty lower limit in "\\int_{}^{2} x dx"', intMissing13);

// 7.2 Complete integrals with differential
const intComplete1 = FaultTolerantParser.checkIncompleteStatus('\\int x dx');
assert(!intComplete1.isIncomplete && intComplete1.warning === null, 'Accepts complete indefinite integral "\\int x dx"', intComplete1);

const intComplete2 = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{2} x dx');
assert(!intComplete2.isIncomplete && intComplete2.warning === null, 'Accepts complete definite integral "\\int_{0}^{2} x dx"', intComplete2);

const intComplete3 = FaultTolerantParser.checkIncompleteStatus('\\int (x^2 + 1) dt');
assert(!intComplete3.isIncomplete && intComplete3.warning === null, 'Accepts complete integral with dt "\\int (x^2 + 1) dt"', intComplete3);

const intComplete4 = FaultTolerantParser.checkIncompleteStatus('\\int \\sin(x) dx');
assert(!intComplete4.isIncomplete && intComplete4.warning === null, 'Accepts complete integral with sin "\\int \\sin(x) dx"', intComplete4);

const intComplete5 = FaultTolerantParser.checkIncompleteStatus('\\int dx');
assert(!intComplete5.isIncomplete && intComplete5.warning === null, 'Accepts empty integrand with dx "\\int dx"', intComplete5);

const intComplete6 = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{1} dx');
assert(!intComplete6.isIncomplete && intComplete6.warning === null, 'Accepts empty integrand definite "\\int_{0}^{1} dx"', intComplete6);

const intComplete7 = FaultTolerantParser.checkIncompleteStatus('\\int x \\mathrm{d}x');
assert(!intComplete7.isIncomplete && intComplete7.warning === null, 'Accepts LaTeX \\mathrm{d}x in "\\int x \\mathrm{d}x"', intComplete7);

const intComplete8 = FaultTolerantParser.checkIncompleteStatus('\\int xdx');
assert(!intComplete8.isIncomplete && intComplete8.warning === null, 'Accepts glued differential "\\int xdx"', intComplete8);

const intComplete9 = FaultTolerantParser.checkIncompleteStatus('\\int ydy');
assert(!intComplete9.isIncomplete && intComplete9.warning === null, 'Accepts glued differential "\\int ydy"', intComplete9);

const intComplete10 = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{2} xdx');
assert(!intComplete10.isIncomplete && intComplete10.warning === null, 'Accepts glued differential in definite integral "\\int_{0}^{2} xdx"', intComplete10);

const intComplete11 = FaultTolerantParser.checkIncompleteStatus('int_(0)^(2) x dx');
assert(!intComplete11.isIncomplete && intComplete11.warning === null, 'Accepts AsciiMath bounds "int_(0)^(2) x dx"', intComplete11);

// 7.3 Free Variable and Phantom Slider Suppression
const intFree1 = FaultTolerantParser.detectFreeVariables('\\int x dx');
assert(intFree1.length === 0, 'No slider suggestions for "\\int x dx"', intFree1);

const intFree2 = FaultTolerantParser.detectFreeVariables('\\int_{0}^{2} x dx');
assert(intFree2.length === 0, 'No slider suggestions for "\\int_{0}^{2} x dx"', intFree2);

const intFree3 = FaultTolerantParser.detectFreeVariables('\\int (a * x) dx');
assert(intFree3.length === 1 && intFree3[0] === 'a', 'Only detects parameter "a" in "\\int (a * x) dx" (protects d and x)', intFree3);

const intFree4 = FaultTolerantParser.detectFreeVariables('\\int (m * t + b) dt');
assert(intFree4.includes('m') && intFree4.includes('b') && !intFree4.includes('t') && !intFree4.includes('d'), 'Detects m and b in "\\int (m * t + b) dt" (protects d and t)', intFree4);

const intFree5 = FaultTolerantParser.detectFreeVariables('\\int x');
assert(!intFree5.includes('d'), 'Missing differential "\\int x" does NOT suggest slider for "d"', intFree5);

const intFree6 = FaultTolerantParser.detectFreeVariables('\\int t');
assert(!intFree6.includes('d'), 'Missing differential "\\int t" does NOT suggest slider for "d"', intFree6);

const intFree7 = FaultTolerantParser.detectFreeVariables('\\int xdx');
assert(intFree7.length === 0, 'No slider suggestions for glued "\\int xdx"', intFree7);

const intFree8 = FaultTolerantParser.detectFreeVariables('\\int (a * x) dx');
assert(intFree8.length === 1 && intFree8[0] === 'a', 'Only detects parameter "a" in "\\int (a * x) dx" with glued diff', intFree8);

// 7.4 PrattParser differential validation and AST generation
const prattAst1 = new PrattParser('\\int x dx').parseExpression();
assert(Array.isArray(prattAst1) && prattAst1[0] === 'Integrate' && prattAst1[1] === 'x' && prattAst1[2] === 'x', 'PrattParser parses "\\int x dx" as ["Integrate", "x", "x"]', prattAst1);

const prattAst2 = new PrattParser('\\int_{0}^{2} x dx').parseExpression();
assert(Array.isArray(prattAst2) && prattAst2[0] === 'Integrate' && prattAst2[1] === 'x' && prattAst2[2] === 'x' && prattAst2[3] === 0 && prattAst2[4] === 2, 'PrattParser parses "\\int_{0}^{2} x dx" with limits 0 and 2', prattAst2);

const prattAst3 = new PrattParser('\\int dx').parseExpression();
assert(Array.isArray(prattAst3) && prattAst3[0] === 'Integrate' && prattAst3[1] === 1 && prattAst3[2] === 'x', 'PrattParser parses "\\int dx" with default integrand 1', prattAst3);

const prattAst4 = new PrattParser('\\int xdx').parseExpression();
assert(Array.isArray(prattAst4) && prattAst4[0] === 'Integrate' && prattAst4[1] === 'x' && prattAst4[2] === 'x', 'PrattParser parses glued "\\int xdx"', prattAst4);

const prattAst5 = new PrattParser('\\int ydy').parseExpression();
assert(Array.isArray(prattAst5) && prattAst5[0] === 'Integrate' && prattAst5[1] === 'y' && prattAst5[2] === 'y', 'PrattParser parses glued "\\int ydy"', prattAst5);

const prattAst6 = new PrattParser('\\int_{0}^{2} xdx').parseExpression();
assert(Array.isArray(prattAst6) && prattAst6[0] === 'Integrate' && prattAst6[1] === 'x' && prattAst6[2] === 'x' && prattAst6[3] === 0 && prattAst6[4] === 2, 'PrattParser parses glued "\\int_{0}^{2} xdx"', prattAst6);

let prattErr1Thrown = false;
try {
  new PrattParser('\\int x').parseExpression();
} catch (e: any) {
  prattErr1Thrown = e.message.includes('integrando deve terminar com uma variável de integração');
}
assert(prattErr1Thrown, 'PrattParser throws Desmos error when differential is missing in "\\int x"');

let prattErr2Thrown = false;
try {
  new PrattParser('\\int_{0}^{2} x').parseExpression();
} catch (e: any) {
  prattErr2Thrown = e.message.includes('integrando deve terminar com uma variável de integração');
}
assert(prattErr2Thrown, 'PrattParser throws Desmos error when differential is missing in "\\int_{0}^{2} x"');

let prattErr3Thrown = false;
try {
  new PrattParser('\\int').parseExpression();
} catch (e: any) {
  prattErr3Thrown = e.message.includes('integrando deve terminar com uma variável de integração');
}
assert(prattErr3Thrown, 'PrattParser throws Desmos error when differential is missing in standalone "\\int"');

let prattErr4Thrown = false;
try {
  new PrattParser('int(x)').parseExpression();
} catch (e: any) {
  prattErr4Thrown = e.message.includes('integrando deve terminar com uma variável de integração');
}
assert(prattErr4Thrown, 'PrattParser throws Desmos error when variable is missing in functional "int(x)"');

// 7.5 Integral Normalization Transformation (Desmos standard)
function normalizeIntegral(str: string): string {
  let cleanStr = str
    .replace(/\\mathrm\{d\}/gi, ' d ')
    .replace(/\\text\{d\}/gi, ' d ')
    .replace(/\\differentialD/gi, ' d ')
    .replace(/\\,/g, ' ');

  cleanStr = cleanStr.replace(/(?:(?<=\W)|\b|(?<=[a-zA-Z0-9_\)\}\]]))d\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i, ' d $1');

  const boundPattern = '(?:\\{([^}]+)\\}|\\(([^)]+)\\)|(\\\\[a-zA-Z]+|[a-zA-Z0-9.\\-]+))';
  const defIntRegex = new RegExp(
    `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))(?:_${boundPattern}\\^${boundPattern}|\\^${boundPattern}_${boundPattern})\\s*(.*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)\\s*$`,
    'i'
  );

  cleanStr = cleanStr.replace(defIntRegex,
    (_m, l1, l2, l3, u1, u2, u3, u4, u5, u6, l4, l5, l6, expr, v) => {
      let lower = (l1 ?? l2 ?? l3 ?? l4 ?? l5 ?? l6).trim();
      let upper = (u1 ?? u2 ?? u3 ?? u4 ?? u5 ?? u6).trim();
      if (lower.startsWith('\\')) lower = lower.substring(1);
      if (upper.startsWith('\\')) upper = upper.substring(1);
      const integrand = expr.trim() || '1';
      return `integrate(${integrand}, ${v}, ${lower}, ${upper})`;
    }
  );

  cleanStr = cleanStr.replace(/(?:\bdefint(?![a-zA-Z])|\\int(?![a-zA-Z])|\bint(?![a-zA-Z]))\s*(.*?)\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|\bd)\s*\\?([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i,
    (_m, expr, v) => {
      const integrand = expr.trim() || '1';
      return `integrate(${integrand}, ${v})`;
    }
  );

  return cleanStr;
}

assert(normalizeIntegral('\\int x dx') === 'integrate(x, x)', 'Normalizes "\\int x dx" to "integrate(x, x)"');
assert(normalizeIntegral('\\int xdx') === 'integrate(x, x)', 'Normalizes "\\int xdx" to "integrate(x, x)"');
assert(normalizeIntegral('int xdx') === 'integrate(x, x)', 'Normalizes "int xdx" to "integrate(x, x)"');
assert(normalizeIntegral('\\int ydy') === 'integrate(y, y)', 'Normalizes "\\int ydy" to "integrate(y, y)"');
assert(normalizeIntegral('\\int_{0}^{2} x dx') === 'integrate(x, x, 0, 2)', 'Normalizes "\\int_{0}^{2} x dx" to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('\\int_{0}^{2} xdx') === 'integrate(x, x, 0, 2)', 'Normalizes "\\int_{0}^{2} xdx" to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('\\int_{ 0 }^ { 2 } x dx') === 'integrate(x, x, 0, 2)' || normalizeIntegral('\\int_{ 0 }^{ 2 } x dx') === 'integrate(x, x, 0, 2)', 'Normalizes "\\int_{ 0 }^{ 2 } x dx" with spaces to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('int_(0)^(2) x dx') === 'integrate(x, x, 0, 2)', 'Normalizes "int_(0)^(2) x dx" to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('\\int_{-1}^{1} x dx') === 'integrate(x, x, -1, 1)', 'Normalizes "\\int_{-1}^{1} x dx" with negative bound to "integrate(x, x, -1, 1)"');
assert(normalizeIntegral('\\int dx') === 'integrate(1, x)', 'Normalizes "\\int dx" to "integrate(1, x)"');
assert(normalizeIntegral('\\int_{0}^{1} dx') === 'integrate(1, x, 0, 1)', 'Normalizes "\\int_{0}^{1} dx" to "integrate(1, x, 0, 1)"');
assert(normalizeIntegral('\\int (t^2 + 1) dt') === 'integrate((t^2 + 1), t)', 'Normalizes "\\int (t^2 + 1) dt" to "integrate((t^2 + 1), t)"');
assert(normalizeIntegral('I = \\int_{0}^{2} x dx') === 'I = integrate(x, x, 0, 2)', 'Normalizes "I = \\int_{0}^{2} x dx" to "I = integrate(x, x, 0, 2)"');
assert(normalizeIntegral('y = \\int x dx') === 'y = integrate(x, x)', 'Normalizes "y = \\int x dx" to "y = integrate(x, x)"');

// 7.6 Single-digit bounds without braces (User Bug Reproduction: \int_1^2 xdx)
assert(normalizeIntegral('\\int_1^2 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes single-digit "\\int_1^2 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int_1^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes single-digit "\\int_1^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int^2_1 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes inverted bounds "\\int^2_1 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int^2_1 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes inverted bounds "\\int^2_1 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint_1^2 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes "defint_1^2 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint_1^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes "defint_1^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint_{1}^{2} x dx') === 'integrate(x, x, 1, 2)', 'Normalizes "defint_{1}^{2} x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int_0^\\pi \\sin(x) dx') === 'integrate(\\sin(x), x, 0, pi)', 'Normalizes "\\int_0^\\pi \\sin(x) dx" with pi bound');
assert(normalizeIntegral('\\int_1^2 dx') === 'integrate(1, x, 1, 2)', 'Normalizes "\\int_1^2 dx" to "integrate(1, x, 1, 2)"');
assert(normalizeIntegral('\\int_1^2dx') === 'integrate(1, x, 1, 2)', 'Normalizes "\\int_1^2dx" to "integrate(1, x, 1, 2)"');
assert(normalizeIntegral('I = \\int_1^2 xdx') === 'I = integrate(x, x, 1, 2)', 'Normalizes assignment "I = \\int_1^2 xdx"');

// 7.7 Full main.ts Pipeline Subscript Protection Test
function fullPipelineClean(input: string): string {
  let cleanStr = input;
  cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_\(([0-9]+),([0-9]+)\)/g, (_match, p1, p2, p3) => {
    return `${p1}[${parseInt(p2)-1},${parseInt(p3)-1}]`;
  });
  cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_([0-9]+)\b/g, (match, p1, p2) => {
    if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'u', 'v', 'w', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
    return `${p1}[${parseInt(p2)-1}]`;
  });
  return normalizeIntegral(cleanStr);
}

assert(fullPipelineClean('\\int_1^2 xdx') === 'integrate(x, x, 1, 2)', 'Pipeline does NOT corrupt \\int_1^2 into \\int[0]^2');
assert(fullPipelineClean('\\int_0^2 xdx') === 'integrate(x, x, 0, 2)', 'Pipeline does NOT corrupt \\int_0^2 into \\int[-1]^2');
assert(fullPipelineClean('L_1') === 'L[0]', 'Pipeline correctly converts list variable L_1 into L[0]');
assert(fullPipelineClean('M_3') === 'M[2]', 'Pipeline correctly converts matrix variable M_3 into M[2]');

// 7.8 Sum and Product Normalization
function normalizeSumProd(input: string): string {
  let cleanStr = input;
  cleanStr = cleanStr.replace(/\\sum_(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\^\{?([^}\s]+)\}?\s*(.*)$/i,
    (_m, v1, s1, v2, s2, endVal, body) => {
      const v = v1 || v2;
      const start = s1 || s2;
      return `sum(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
    }
  );
  cleanStr = cleanStr.replace(/\\prod_(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\^\{?([^}\s]+)\}?\s*(.*)$/i,
    (_m, v1, s1, v2, s2, endVal, body) => {
      const v = v1 || v2;
      const start = s1 || s2;
      return `product(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
    }
  );
  return cleanStr;
}

assert(normalizeSumProd('\\sum_{n=1}^{10} n') === 'sum(n, n, 1, 10)', 'Normalizes LaTeX \\sum_{n=1}^{10} n to sum(n, n, 1, 10)');
assert(normalizeSumProd('\\prod_{n=1}^{5} n') === 'product(n, n, 1, 5)', 'Normalizes LaTeX \\prod_{n=1}^{5} n to product(n, n, 1, 5)');

// 7.9 Commands Guide Data Structure Integrity
import { COMMANDS_DATA } from '../src/ui/commandsGuideModal.js';
assert(Array.isArray(COMMANDS_DATA) && COMMANDS_DATA.length >= 20, 'COMMANDS_DATA contains full database of commands');
const categories = new Set(COMMANDS_DATA.map(c => c.category));
assert(categories.has('calculo'), 'Guide contains category "calculo"');
assert(categories.has('integrais'), 'Guide contains category "integrais"');
assert(categories.has('algebra'), 'Guide contains category "algebra"');
assert(categories.has('funcoes'), 'Guide contains category "funcoes"');
assert(categories.has('estatistica'), 'Guide contains category "estatistica"');

console.log(`\n--- RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
if (failed > 0) {
  process.exit(1);
}


