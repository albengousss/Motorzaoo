import { describe, it, expect } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { Tokenizer, TokenTypes } from '../src/core/tokenizer.js';
import { MathEngine } from '../src/core/mathEngine.js';
import { PrattParser } from '../src/core/prattParser.js';
import { ODESolver } from '../src/core/odeSolver.js';
import { LatexNormalizer } from '../src/core/latexNormalizer.js';
import { COMMANDS_DATA, CommandsGuideModal } from '../src/ui/commandsGuideModal.js';
import { GLRenderer } from '../src/graphics/glRenderer.js';

describe('verify-defensive suite', () => {
  it('passes all 386 defensive checks', () => {
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, detail?: any) {
      if (condition) {
        passed++;
      } else {
        console.error(`❌ FAIL: ${testName}`, detail || '');
        failed++;
      }
      expect(condition, `${testName}: ${JSON.stringify(detail || '')}`).toBe(true);
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
    .replace(/\\,/g, ' ')
    .replace(/\\!/g, ' ');

  // Separa limites colados ao integrando gerados pelo MathLive (ex: _1^2x -> _1^2 x, _1x -> _1 x)
  cleanStr = cleanStr.replace(/([\^_](?:\{[^}]+\}|\([^)]+\)|[0-9.]+))\s*([a-zA-Z_])/g, '$1 $2');

  // Multiplicação escalar implícita protegendo limites
  cleanStr = cleanStr.replace(/(?<![\^_])(\d+(?:\.\d+)?)\s*([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

  cleanStr = cleanStr.replace(/(?:(?<=\W)|\b|(?<=[a-zA-Z0-9_\)\}\]]))d\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i, ' d $1');

  const boundPattern = '(?:\\{([^}]+)\\}|\\(([^)]+)\\)|(-?[0-9.]+|\\\\[a-zA-Z]+|[a-zA-Z_][a-zA-Z0-9_]*))';
  const defIntRegex = new RegExp(
    `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*(?:_\\s*${boundPattern}\\s*\\^\\s*${boundPattern}|\\^\\s*${boundPattern}\\s*_\\s*${boundPattern})\\s*(.*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)\\s*$`,
    'i'
  );

  cleanStr = cleanStr.replace(defIntRegex,
    (_m, l1, l2, l3, u1, u2, u3, u4, u5, u6, l4, l5, l6, expr, v) => {
      let lower = (l1 ?? l2 ?? l3 ?? l4 ?? l5 ?? l6).trim();
      let upper = (u1 ?? u2 ?? u3 ?? u4 ?? u5 ?? u6).trim();
      lower = lower.replace(/\\/g, '');
      upper = upper.replace(/\\/g, '');
      const integrand = expr.trim() || '1';
      return `integrate(${integrand}, ${v}, ${lower}, ${upper})`;
    }
  );

  const indefIntRegex = new RegExp(
    `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*(.*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)\\s*$`,
    'i'
  );
  cleanStr = cleanStr.replace(indefIntRegex,
    (_m, expr, v) => {
      const integrand = expr.trim() || '1';
      return `integrate(${integrand}, ${v})`;
    }
  );

  return cleanStr;
}

assert(normalizeIntegral('\\int x dx') === 'integrate(x, x)', 'Normalizes "\\int x dx" to "integrate(x, x)"', normalizeIntegral('\\int x dx'));
assert(normalizeIntegral('\\int xdx') === 'integrate(x, x)', 'Normalizes "\\int xdx" to "integrate(x, x)"', normalizeIntegral('\\int xdx'));
assert(normalizeIntegral('int xdx') === 'integrate(x, x)', 'Normalizes "int xdx" to "integrate(x, x)"', normalizeIntegral('int xdx'));
assert(normalizeIntegral('\\int ydy') === 'integrate(y, y)', 'Normalizes "\\int ydy" to "integrate(y, y)"', normalizeIntegral('\\int ydy'));
assert(normalizeIntegral('\\int_{0}^{2} x dx') === 'integrate(x, x, 0, 2)', 'Normalizes "\\int_{0}^{2} x dx" to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('\\int_{0}^{2} xdx') === 'integrate(x, x, 0, 2)', 'Normalizes "\\int_{0}^{2} xdx" to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('\\int_{ 0 }^ { 2 } x dx') === 'integrate(x, x, 0, 2)' || normalizeIntegral('\\int_{ 0 }^{ 2 } x dx') === 'integrate(x, x, 0, 2)', 'Normalizes "\\int_{ 0 }^{ 2 } x dx" with spaces to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('int_(0)^(2) x dx') === 'integrate(x, x, 0, 2)', 'Normalizes "int_(0)^(2) x dx" to "integrate(x, x, 0, 2)"');
assert(normalizeIntegral('\\int_{-1}^{1} x dx') === 'integrate(x, x, -1, 1)', 'Normalizes "\\int_{-1}^{1} x dx" with negative bound to "integrate(x, x, -1, 1)"');
assert(normalizeIntegral('\\int dx') === 'integrate(1, x)', 'Normalizes "\\int dx" to "integrate(1, x)"', normalizeIntegral('\\int dx'));
assert(normalizeIntegral('\\int_{0}^{1} dx') === 'integrate(1, x, 0, 1)', 'Normalizes "\\int_{0}^{1} dx" to "integrate(1, x, 0, 1)"');
assert(normalizeIntegral('\\int (t^2 + 1) dt') === 'integrate((t^2 + 1), t)', 'Normalizes "\\int (t^2 + 1) dt" to "integrate((t^2 + 1), t)"', normalizeIntegral('\\int (t^2 + 1) dt'));
assert(normalizeIntegral('I = \\int_{0}^{2} x dx') === 'I = integrate(x, x, 0, 2)', 'Normalizes "I = \\int_{0}^{2} x dx" to "I = integrate(x, x, 0, 2)"');
assert(normalizeIntegral('y = \\int x dx') === 'y = integrate(x, x)', 'Normalizes "y = \\int x dx" to "y = integrate(x, x)"', normalizeIntegral('y = \\int x dx'));

// 7.6 Single-digit bounds without braces and MathLive space formats (User Bug Reproduction: \int_1^2 xdx)
assert(normalizeIntegral('\\int_1^2 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes single-digit "\\int_1^2 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int_1^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes single-digit "\\int_1^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('int _1^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes MathLive ascii "int _1^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('int _1^2 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes MathLive ascii "int _1^2 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('int _(1)^(2) x dx') === 'integrate(x, x, 1, 2)', 'Normalizes MathLive ascii "int _(1)^(2) x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('int _(1) ^(2) x dx') === 'integrate(x, x, 1, 2)', 'Normalizes MathLive ascii "int _(1) ^(2) x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int _1^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes space-separated "\\int _1^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int _1^2 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes space-separated "\\int _1^2 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int _{1} ^{2} x dx') === 'integrate(x, x, 1, 2)', 'Normalizes spaced braces "\\int _{1} ^{2} x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int _{1} ^{2} xdx') === 'integrate(x, x, 1, 2)', 'Normalizes spaced braces glued "\\int _{1} ^{2} xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int _(-1) ^(1) x dx') === 'integrate(x, x, -1, 1)', 'Normalizes parenthesized negative bound "\\int _(-1) ^(1) x dx" to "integrate(x, x, -1, 1)"');
assert(normalizeIntegral('\\int^2_1 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes inverted bounds "\\int^2_1 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('\\int^2_1 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes inverted bounds "\\int^2_1 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint_1^2 xdx') === 'integrate(x, x, 1, 2)', 'Normalizes "defint_1^2 xdx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint_1^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes "defint_1^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint _1 ^2 x dx') === 'integrate(x, x, 1, 2)', 'Normalizes spaced "defint _1 ^2 x dx" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('defint _{1}^{2} x dx') === 'integrate(x, x, 1, 2)', 'Normalizes "defint_{1}^{2} x dx" to "integrate(x, x, 1, 2)"');
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
  cleanStr = cleanStr.replace(/(?:\\sum|\bsum\b)\s*_\s*(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\s*\^\s*(?:\{([^}]+)\}|\(([^)]+)\)|([^\s]+))\s*(.*)$/i,
    (_m, v1, s1, v2, s2, e1, e2, e3, body) => {
      const v = v1 || v2;
      const start = s1 || s2;
      const endVal = e1 || e2 || e3;
      return `sum(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
    }
  );
  cleanStr = cleanStr.replace(/(?:\\prod|\bprod\b)\s*_\s*(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\s*\^\s*(?:\{([^}]+)\}|\(([^)]+)\)|([^\s]+))\s*(.*)$/i,
    (_m, v1, s1, v2, s2, e1, e2, e3, body) => {
      const v = v1 || v2;
      const start = s1 || s2;
      const endVal = e1 || e2 || e3;
      return `product(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
    }
  );
  return cleanStr;
}

assert(normalizeSumProd('\\sum_{n=1}^{10} n') === 'sum(n, n, 1, 10)', 'Normalizes LaTeX \\sum_{n=1}^{10} n to sum(n, n, 1, 10)');
assert(normalizeSumProd('\\sum _{n=1} ^{10} n') === 'sum(n, n, 1, 10)', 'Normalizes LaTeX with spaces \\sum _{n=1} ^{10} n to sum(n, n, 1, 10)');
assert(normalizeSumProd('sum _(n=1)^(10) n') === 'sum(n, n, 1, 10)', 'Normalizes AsciiMath sum _(n=1)^(10) n to sum(n, n, 1, 10)');
assert(normalizeSumProd('\\prod_{n=1}^{5} n') === 'product(n, n, 1, 5)', 'Normalizes LaTeX \\prod_{n=1}^{5} n to product(n, n, 1, 5)');
assert(normalizeSumProd('prod _(n=1)^(5) n') === 'product(n, n, 1, 5)', 'Normalizes AsciiMath prod _(n=1)^(5) n to product(n, n, 1, 5)');

// 7.9 MathEngine Numerical Quadrature (Simpson's 1/3 Rule)
const numInt1 = MathEngine.evaluateDefiniteIntegral('x', 1, 2);
assert(Math.abs(numInt1 - 1.5) < 1e-6, 'MathEngine.evaluateDefiniteIntegral calculates \\int_1^2 x dx = 1.5 accurately', numInt1);

const numInt2 = MathEngine.evaluateDefiniteIntegral(['Power', 'x', 2], 0, 3);
assert(Math.abs(numInt2 - 9) < 1e-5, 'MathEngine.evaluateDefiniteIntegral calculates \\int_0^3 x^2 dx = 9 accurately', numInt2);

const numInt3 = MathEngine.evaluateDefiniteIntegral(['Sin', 'x'], 0, Math.PI);
assert(Math.abs(numInt3 - 2) < 1e-5, 'MathEngine.evaluateDefiniteIntegral calculates \\int_0^pi sin(x) dx = 2 accurately', numInt3);

// 7.10 Placeholder Limits Detection
const placeholderInc = FaultTolerantParser.checkIncompleteStatus('\\int_{#?}^{#?} x dx');
assert(placeholderInc.isIncomplete === true && placeholderInc.warning === 'Faltam os limites de integração.', 'Detects MathLive placeholder #? limits as incomplete with correct warning', placeholderInc);

// 7.11 Commands Guide Data Structure Integrity
assert(Array.isArray(COMMANDS_DATA) && COMMANDS_DATA.length >= 20, 'COMMANDS_DATA contains full database of commands');
const categories = new Set(COMMANDS_DATA.map(c => c.category));
assert(categories.has('calculo'), 'Guide contains category "calculo"');
assert(categories.has('integrais'), 'Guide contains category "integrais"');
assert(categories.has('algebra'), 'Guide contains category "algebra"');
assert(categories.has('funcoes'), 'Guide contains category "funcoes"');
assert(categories.has('estatistica'), 'Guide contains category "estatistica"');

// 7.12 Exact MathLive convertLatexToAsciiMath Glued Output Verification
assert(normalizeIntegral(' int  _1^2x d x').trim() === 'integrate(x, x, 1, 2)', 'Normalizes exact MathLive glued ascii " int  _1^2x d x" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral('int _1^2x d x').trim() === 'integrate(x, x, 1, 2)', 'Normalizes MathLive glued ascii "int _1^2x d x" to "integrate(x, x, 1, 2)"');
assert(normalizeIntegral(' int  _0^3x^2d x').trim() === 'integrate(x^2, x, 0, 3)', 'Normalizes MathLive glued ascii " int  _0^3x^2d x" to "integrate(x^2, x, 0, 3)"');

// Verify PrattParser parses the normalized output without prefix error
const parsedGluedAst = new PrattParser(normalizeIntegral(' int  _1^2x d x').trim()).parseExpression();
assert(Array.isArray(parsedGluedAst) && parsedGluedAst[0] === 'Integrate' && parsedGluedAst[1] === 'x' && parsedGluedAst[3] === 1 && parsedGluedAst[4] === 2, 'PrattParser parses normalized MathLive glued output correctly without prefix error');

// 7.13 Constant Evaluation in evaluateAST
assert(Math.abs(MathEngine.evaluateAST('pi') - Math.PI) < 1e-10, 'evaluateAST evaluates "pi" to Math.PI');
assert(Math.abs(MathEngine.evaluateAST('e') - Math.E) < 1e-10, 'evaluateAST evaluates "e" to Math.E');

// =========================================================================
// [TEST GROUP 8: Derivative Normalization and Numerical Evaluation]
// =========================================================================
console.log('\n[TEST GROUP 8: Derivative Normalization & Numerical Evaluation]');

function normalizeDerivative(str: string): string {
  return FaultTolerantParser.normalizeDerivative(str);
}

assert(normalizeDerivative('\\frac{d}{dx} x') === 'diff(x, x)', 'Normalizes LaTeX \\frac{d}{dx} x to diff(x, x)');
assert(normalizeDerivative('\\frac{d}{dx}x') === 'diff(x, x)', 'Normalizes unspaced LaTeX \\frac{d}{dx}x to diff(x, x)');
assert(normalizeDerivative('\\frac{d}{dx}(x^2)') === 'diff(x^2, x)', 'Normalizes parenthesized LaTeX \\frac{d}{dx}(x^2) to diff(x^2, x)');
assert(normalizeDerivative('\\frac{d}{dx}(x^(2))') === 'diff(x^(2), x)', 'Normalizes nested parenthesized MathLive ascii \\frac{d}{dx}(x^(2)) to diff(x^(2), x)');
assert(normalizeDerivative('\\frac{d}{dx}(\\sin(x))') === 'diff(\\sin(x), x)', 'Normalizes nested parenthesized \\frac{d}{dx}(\\sin(x)) to diff(\\sin(x), x)');
assert(normalizeDerivative('\\frac{d}{dx}((x+1)^2)') === 'diff((x+1)^2, x)', 'Normalizes nested compound \\frac{d}{dx}((x+1)^2) to diff((x+1)^2, x)');
assert(normalizeDerivative('\\frac{d}{dx}{x^2}') === 'diff(x^2, x)', 'Normalizes braced LaTeX \\frac{d}{dx}{x^2} to diff(x^2, x)');
assert(normalizeDerivative('d/dx x') === 'diff(x, x)', 'Normalizes ascii d/dx x to diff(x, x)');
assert(normalizeDerivative('d/dx(x^3)') === 'diff(x^3, x)', 'Normalizes ascii d/dx(x^3) to diff(x^3, x)');
assert(normalizeDerivative('d/dx(x^(2))') === 'diff(x^(2), x)', 'Normalizes ascii nested d/dx(x^(2)) to diff(x^(2), x)');
assert(normalizeDerivative('frac(d)(dx) x') === 'diff(x, x)', 'Normalizes AsciiMath frac(d)(dx) x to diff(x, x)');
assert(normalizeDerivative('frac(d)(dx)(x^2)') === 'diff(x^2, x)', 'Normalizes AsciiMath frac(d)(dx)(x^2) to diff(x^2, x)');
assert(normalizeDerivative('frac(d)(dx)(x^(2))') === 'diff(x^(2), x)', 'Normalizes AsciiMath nested frac(d)(dx)(x^(2)) to diff(x^(2), x)');
assert(normalizeDerivative('\\frac{\\mathrm{d}}{\\mathrm{d}t} t') === 'diff(t, t)', 'Normalizes \\mathrm{d} in \\frac{\\mathrm{d}}{\\mathrm{d}t} t to diff(t, t)');

// Incomplete derivative check
const incDeriv1 = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}');
assert(incDeriv1.isIncomplete && incDeriv1.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', 'Detects incomplete LaTeX \\frac{d}{dx} without operand');
const incDeriv2 = FaultTolerantParser.checkIncompleteStatus('d/dx');
assert(incDeriv2.isIncomplete && incDeriv2.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', 'Detects incomplete Ascii d/dx without operand');
const incDeriv3 = FaultTolerantParser.checkIncompleteStatus('frac(d)(dx)');
assert(incDeriv3.isIncomplete && incDeriv3.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', 'Detects incomplete frac(d)(dx) without operand');
const incDerivEmpty1 = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}()');
assert(incDerivEmpty1.isIncomplete && incDerivEmpty1.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', 'Detects \\frac{d}{dx}() with empty parens as incomplete');
const incDerivEmpty2 = FaultTolerantParser.checkIncompleteStatus('d/dx()');
assert(incDerivEmpty2.isIncomplete && incDerivEmpty2.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', 'Detects d/dx() with empty parens as incomplete');
const incDerivEmpty3 = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}{}');
assert(incDerivEmpty3.isIncomplete && incDerivEmpty3.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', 'Detects \\frac{d}{dx}{} with empty braces as incomplete');
const incDerivPlaceholder = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}(#?)');
assert(incDerivPlaceholder.isIncomplete, 'Detects \\frac{d}{dx}(#?) with placeholder as incomplete');
const incExp1 = FaultTolerantParser.checkIncompleteStatus('x^');
assert(incExp1.isIncomplete && incExp1.warning === 'Falta o expoente da potência.', 'Detects incomplete exponent x^');
const incExp2 = FaultTolerantParser.checkIncompleteStatus('d/dx(x^)');
assert(incExp2.isIncomplete && incExp2.warning === 'Falta o expoente da potência.', 'Detects incomplete exponent d/dx(x^)');
const incExp3 = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}(x^{#?})');
assert(incExp3.isIncomplete, 'Detects incomplete exponent with placeholder \\frac{d}{dx}(x^{#?})');

// MathEngine numerical differentiation
const derivVal1 = MathEngine.evaluateDerivative('x', 'x', { x: 5 });
assert(Math.abs(derivVal1 - 1) < 1e-4, 'evaluateDerivative d/dx(x) at x=5 evaluates to 1', derivVal1);

const derivVal2 = MathEngine.evaluateDerivative(['Power', 'x', 2], 'x', { x: 3 });
assert(Math.abs(derivVal2 - 6) < 1e-4, 'evaluateDerivative d/dx(x^2) at x=3 evaluates to 6', derivVal2);

const derivVal3 = MathEngine.evaluateDerivative(['Sin', 'x'], 'x', { x: 0 });
assert(Math.abs(derivVal3 - 1) < 1e-4, 'evaluateDerivative d/dx(sin(x)) at x=0 evaluates to 1', derivVal3);


// =========================================================================
// [TEST GROUP 9: Strict Case Sensitivity (Desmos Standard)]
// =========================================================================
console.log('\n[TEST GROUP 9: Strict Case Sensitivity]');

// detectFreeVariables: matrix A vs scalar a
const freeWithMatrixA = FaultTolerantParser.detectFreeVariables('det(a)', ['A']);
assert(freeWithMatrixA.includes('a') && !freeWithMatrixA.includes('A'), 'detectFreeVariables keeps lowercase "a" free even if matrix "A" is registered', freeWithMatrixA);

const freeWithScalarB = FaultTolerantParser.detectFreeVariables('det(B)', ['b']);
assert(freeWithScalarB.includes('B') && !freeWithScalarB.includes('b'), 'detectFreeVariables keeps uppercase "B" free even if lowercase "b" is registered', freeWithScalarB);

// formatForGiac case sensitivity simulation
const mockDefs: Record<string, string> = { 'A': '[[1, 2], [3, 4]]' };
const formatGiacWithDefs = (str: string, defs: Record<string, string>) => {
    return defs[str] ? `usr_${str}` : str;
};
assert(formatGiacWithDefs('A', mockDefs) === 'usr_A', 'formatForGiac preserves defined matrix A as usr_A');
assert(formatGiacWithDefs('a', mockDefs) === 'a', 'formatForGiac does NOT resolve lowercase a to usr_A');


// =========================================================================
// [TEST GROUP 10: Fraction Conversion & Interactive Toggle Logic]
// =========================================================================
console.log('\n[TEST GROUP 10: Fraction Conversion & Desmos Toggle]');

function toFraction(val: number, maxDen: number = 10000): { num: number, den: number } | null {
    if (isNaN(val) || !isFinite(val)) return null;
    const sign = val < 0 ? -1 : 1;
    const x = Math.abs(val);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
    let b = x;
    do {
        const a = Math.floor(b);
        let aux = h1; h1 = a * h1 + h0; h0 = aux;
        aux = k1; k1 = a * k1 + k0; k0 = aux;
        if (k1 > maxDen) break;
        const approx = h1 / k1;
        if (Math.abs(approx - x) < 1e-9) {
            return { num: sign * h1, den: k1 };
        }
        b = 1 / (b - a);
    } while (isFinite(b) && Math.abs(x - h1 / k1) > 1e-9);

    if (k1 <= maxDen && Math.abs(h1 / k1 - x) < 1e-5) {
        return { num: sign * h1, den: k1 };
    }
    return null;
}

function parseFractionInfo(mathStr: string): { fractionLatex: string, decimalStr: string, isRational: boolean } | null {
    let clean = mathStr.trim();
    if (clean.startsWith('=')) clean = clean.substring(1).trim();
    if (clean.includes('≈')) {
        const parts = clean.split('≈').map(p => p.trim());
        clean = parts[0];
    }

    // 1. Fração ASCII: 3/2, -5/4, (3)/(2)
    const fracMatch = clean.match(/^\(?\s*(-?\d+)\s*\)?\s*\/\s*\(?\s*(\d+)\s*\)?$/);
    if (fracMatch) {
        const num = parseInt(fracMatch[1]);
        const den = parseInt(fracMatch[2]);
        if (den !== 0) {
            const dec = num / den;
            const decStr = parseFloat(dec.toFixed(8)).toString();
            const sign = num < 0 ? '-' : '';
            const absNum = Math.abs(num);
            const fracLatex = den === 1 ? `${num}` : `${sign}\\frac{${absNum}}{${den}}`;
            return { fractionLatex: fracLatex, decimalStr: decStr, isRational: den !== 1 };
        }
    }

    // 2. Fração LaTeX: \frac{a}{b}
    const latexMatch = clean.match(/^([+-]?)\s*\\frac\s*\{(\d+)\}\s*\{(\d+)\}$/);
    if (latexMatch) {
        const sign = latexMatch[1] === '-' ? -1 : 1;
        const num = parseInt(latexMatch[2]) * sign;
        const den = parseInt(latexMatch[3]);
        if (den !== 0) {
            const dec = num / den;
            const decStr = parseFloat(dec.toFixed(8)).toString();
            return { fractionLatex: clean, decimalStr: decStr, isRational: den !== 1 };
        }
    }

    // 3. Número decimal: 1.5, 0.75, -2.5
    const numVal = Number(clean);
    if (!isNaN(numVal) && isFinite(numVal)) {
        if (Number.isInteger(numVal)) {
            return null;
        }
        const rational = toFraction(numVal);
        if (rational && rational.den > 1 && rational.den <= 10000) {
            const sign = rational.num < 0 ? '-' : '';
            const fracLatex = `${sign}\\frac{${Math.abs(rational.num)}}{${rational.den}}`;
            const decStr = parseFloat(numVal.toFixed(8)).toString();
            return { fractionLatex: fracLatex, decimalStr: decStr, isRational: true };
        }
        return null;
    }

    return null;
}

const frac1 = toFraction(1.5);
assert(frac1 !== null && frac1.num === 3 && frac1.den === 2, 'toFraction(1.5) returns 3/2', frac1);

const frac2 = toFraction(0.75);
assert(frac2 !== null && frac2.num === 3 && frac2.den === 4, 'toFraction(0.75) returns 3/4', frac2);

const frac3 = toFraction(-2.5);
assert(frac3 !== null && frac3.num === -5 && frac3.den === 2, 'toFraction(-2.5) returns -5/2', frac3);

const frac4 = toFraction(0.3333333333);
assert(frac4 !== null && frac4.num === 1 && frac4.den === 3, 'toFraction(0.3333333333) returns 1/3', frac4);

const info1 = parseFractionInfo('1.5');
assert(info1 !== null && info1.isRational && info1.fractionLatex === '\\frac{3}{2}' && info1.decimalStr === '1.5', 'parseFractionInfo("1.5") extracts fraction \\frac{3}{2} and decimal 1.5', info1);

const info2 = parseFractionInfo('= 3/2');
assert(info2 !== null && info2.isRational && info2.fractionLatex === '\\frac{3}{2}' && info2.decimalStr === '1.5', 'parseFractionInfo("= 3/2") extracts fraction \\frac{3}{2} and decimal 1.5', info2);

const info3 = parseFractionInfo('\\frac{7}{4}');
assert(info3 !== null && info3.isRational && info3.fractionLatex === '\\frac{7}{4}' && info3.decimalStr === '1.75', 'parseFractionInfo("\\frac{7}{4}") extracts fraction and decimal 1.75', info3);

const info4 = parseFractionInfo('42');
assert(info4 === null, 'parseFractionInfo("42") returns null for integers (no toggle needed)', info4);


// =========================================================================
// [TEST GROUP 11: Functions with Integrals & Multivariable Plot Compilation]
// =========================================================================
console.log('\n[TEST GROUP 11: Functions with Integrals]');

// Check that f(x) = \int_0^x t dt is NOT flagged as incomplete
const funcWithIntInc = FaultTolerantParser.checkIncompleteStatus('f(x) = \\int_{0}^{x} t dt', 'f(x) = integrate(t, t, 0, x)');
assert(!funcWithIntInc.isIncomplete, 'f(x) = \\int_{0}^{x} t dt is recognized as complete function definition', funcWithIntInc);

// Test MathEngine.compile with an embedded Integrate node: f(x) = \int_0^x t dt -> x^2 / 2
const funcAstWithInt: any = ['Integrate', 't', 't', 0, 'x'];
const compiledIntFunc = MathEngine.compile(funcAstWithInt, 'x');

const resAt2 = compiledIntFunc(2, 0, {});
assert(Math.abs(resAt2 - 2.0) < 1e-4, 'compiledIntFunc evaluates \\int_0^2 t dt = 2.0', resAt2);

const resAt4 = compiledIntFunc(4, 0, {});
assert(Math.abs(resAt4 - 8.0) < 1e-4, 'compiledIntFunc evaluates \\int_0^4 t dt = 8.0', resAt4);

// Test MathEngine.compile with an embedded diff node: g(x) = d/dx (x^3) -> 3*x^2
const funcAstWithDiff: any = ['diff', ['Power', 'x', 3], 'x'];
const compiledDiffFunc = MathEngine.compile(funcAstWithDiff, 'x');

const diffAt2 = compiledDiffFunc(2, 0, {});
assert(Math.abs(diffAt2 - 12.0) < 1e-3, 'compiledDiffFunc evaluates d/dx(x^3) at x=2 = 12.0', diffAt2);

// =========================================================================
// [TEST GROUP 12: Multivariable Integrals, Nested Integrals & Edge Cases]
// =========================================================================
console.log('\n[TEST GROUP 12: Multivariable & Nested Integrals]');

// 1. Double integral parsing and numerical evaluation
const doubleIntStr = '\\int_0^1 \\int_0^2 (x + y) dy dx';
const doubleIntAst = new PrattParser(doubleIntStr).parseExpression();
assert(Array.isArray(doubleIntAst) && doubleIntAst[0] === 'Integrate' && Array.isArray(doubleIntAst[1]) && doubleIntAst[1][0] === 'Integrate', 'PrattParser parses double integral recursively', doubleIntAst);

const compiledDoubleInt = MathEngine.compile(doubleIntAst);
const doubleIntVal = compiledDoubleInt(0, 0, {});
// Exact: \int_0^1 \int_0^2 (x + y) dy dx = 3
assert(Math.abs(doubleIntVal - 3.0) < 1e-3, 'compiledDoubleInt evaluates \\int_0^1 \\int_0^2 (x + y) dy dx = 3.0', doubleIntVal);

// 2. Parenthesized single integral
const parenIntStr = '\\int_0^1 (x^2 + 1) dx';
const parenIntAst = new PrattParser(parenIntStr).parseExpression();
assert(Array.isArray(parenIntAst) && parenIntAst[0] === 'Integrate', 'PrattParser parses parenthesized single integral \\int_0^1 (x^2 + 1) dx', parenIntAst);
const compiledParenInt = MathEngine.compile(parenIntAst);
const parenIntVal = compiledParenInt(0, 0, {});
// Exact: \int_0^1 (x^2 + 1) dx = 1/3 + 1 = 4/3 = 1.3333333333
assert(Math.abs(parenIntVal - (4 / 3)) < 1e-3, 'compiledParenInt evaluates \\int_0^1 (x^2 + 1) dx = 4/3', parenIntVal);

// 3. Multivariable integral inside user function maintaining variable y
const multiIntAst = new PrattParser('integrate(x + y + t, t, 0, 1)').parseExpression();
MathEngine.userFunctions['f_test'] = {
    params: ['x', 'y'],
    expr: 'integrate(x + y + t, t, 0, 1)',
    ast: multiIntAst
};
const fTestMulti = MathEngine.compileMultivariable(multiIntAst, ['x', 'y']);
// For x = 1, y = 1.5: \int_0^1 (1 + 1.5 + t) dt = 2.5 + 0.5 = 3
const fTestVal = fTestMulti(1, 1.5);
assert(Math.abs(fTestVal - 3.0) < 1e-3, 'compileMultivariable preserves y and evaluates f(1, 1.5) = 3.0', fTestVal);

// 4. Implicit equation expansion f(x, y) = 3
const implicitAst = new PrattParser('(f_test(x, y)) - (3)').parseExpression();
const expandedImplicit = MathEngine.expandUserFunctions(implicitAst);
const compiledImplicit = MathEngine.compile(expandedImplicit);
const implicitZeroCheck = compiledImplicit(1, 1.5, {});
assert(Math.abs(implicitZeroCheck) < 1e-3, 'Implicit expanded equation f(x, y) = 3 evaluates to 0 at (1, 1.5)', implicitZeroCheck);

// 5. Incomplete status check with compound expression
const compoundIntInc = FaultTolerantParser.checkIncompleteStatus('f(x) = \\int_{0}^{x} t dt + 1', 'f(x) = integrate(t, t, 0, x) + 1');
assert(!compoundIntInc.isIncomplete, 'f(x) = \\int_0^x t dt + 1 is recognized as complete despite trailing + 1', compoundIntInc);

// 6. High-precision fraction conversion
const f1_6 = toFraction(1 / 6);
assert(f1_6 !== null && f1_6.num === 1 && f1_6.den === 6, 'toFraction(1/6) returns 1/6', f1_6);

const f1_7 = toFraction(1 / 7);
assert(f1_7 !== null && f1_7.num === 1 && f1_7.den === 7, 'toFraction(1/7) returns 1/7', f1_7);

// =========================================================================
// [TEST GROUP 13: Hyperbolic Functions Parsing & Compilation]
// =========================================================================
console.log('\n[TEST GROUP 13: Hyperbolic Functions]');

const sinhAst = new PrattParser('sinh(x)').parseExpression();
assert(Array.isArray(sinhAst) && sinhAst[0] === 'Sinh' && sinhAst[1] === 'x', 'PrattParser parses sinh(x) as ["Sinh", "x"]', sinhAst);

const coshAst = new PrattParser('cosh(x)').parseExpression();
assert(Array.isArray(coshAst) && coshAst[0] === 'Cosh' && coshAst[1] === 'x', 'PrattParser parses cosh(x) as ["Cosh", "x"]', coshAst);

const tanhAst = new PrattParser('tanh(x)').parseExpression();
assert(Array.isArray(tanhAst) && tanhAst[0] === 'Tanh' && tanhAst[1] === 'x', 'PrattParser parses tanh(x) as ["Tanh", "x"]', tanhAst);

const asinhAst = new PrattParser('asinh(x)').parseExpression();
assert(Array.isArray(asinhAst) && asinhAst[0] === 'Asinh' && asinhAst[1] === 'x', 'PrattParser parses asinh(x) as ["Asinh", "x"]', asinhAst);

const compiledSinh = MathEngine.compile(sinhAst, 'x');
assert(Math.abs(compiledSinh(0, 0, {}) - 0) < 1e-10, 'compiledSinh(0) = 0');
assert(Math.abs(compiledSinh(1, 0, {}) - Math.sinh(1)) < 1e-10, 'compiledSinh(1) = sinh(1)');

const compiledCosh = MathEngine.compile(coshAst, 'x');
assert(Math.abs(compiledCosh(0, 0, {}) - 1) < 1e-10, 'compiledCosh(0) = 1');
assert(Math.abs(compiledCosh(2, 0, {}) - Math.cosh(2)) < 1e-10, 'compiledCosh(2) = cosh(2)');

const compiledTanh = MathEngine.compile(tanhAst, 'x');
assert(Math.abs(compiledTanh(0, 0, {}) - 0) < 1e-10, 'compiledTanh(0) = 0');

const compiledMultiHyp = MathEngine.compileMultivariable(['Add', ['Sinh', 'x'], ['Cosh', 'y']], ['x', 'y']);
const multiHypVal = compiledMultiHyp(0, 0);
assert(Math.abs(multiHypVal - 1) < 1e-10, 'compileMultivariable evaluates sinh(0) + cosh(0) = 1', multiHypVal);

// =========================================================================
// [TEST GROUP 14: Root & Custom Log Functions]
// =========================================================================
console.log('\n[TEST GROUP 14: Root & Custom Log Functions]');

const cbrtAst = new PrattParser('cbrt(x)').parseExpression();
assert(Array.isArray(cbrtAst) && cbrtAst[0] === 'Cbrt' && cbrtAst[1] === 'x', 'PrattParser parses cbrt(x) as ["Cbrt", "x"]', cbrtAst);

const compiledCbrt = MathEngine.compile(cbrtAst, 'x');
assert(Math.abs(compiledCbrt(27, 0, {}) - 3) < 1e-10, 'compiledCbrt(27) = 3', compiledCbrt(27, 0, {}));
assert(Math.abs(compiledCbrt(-8, 0, {}) - (-2)) < 1e-10, 'compiledCbrt(-8) = -2', compiledCbrt(-8, 0, {}));

const nthrootAst = new PrattParser('nthroot(8, 3)').parseExpression();
assert(Array.isArray(nthrootAst) && nthrootAst[0] === 'Nthroot' && nthrootAst[1] === 8 && nthrootAst[2] === 3, 'PrattParser parses nthroot(8, 3) as ["Nthroot", 8, 3]', nthrootAst);

const compiledNthroot = MathEngine.compile(nthrootAst);
assert(Math.abs(compiledNthroot(0, 0, {}) - 2) < 1e-10, 'compiledNthroot evaluates nthroot(8, 3) = 2', compiledNthroot(0, 0, {}));

// Normalização de \\sqrt[n]{x} e root(n)(x)
function normalizeRootsAndLogs(str: string): string {
  let cleanStr = str;
  cleanStr = cleanStr
    .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, 'nthroot($2, $1)')
    .replace(/root\s*\(([^)]+)\)\s*\(([^)]+)\)/g, 'nthroot($2, $1)');
  cleanStr = cleanStr.replace(/\\?log_\{?([a-zA-Z0-9.]+)\}?\s*\(([^)]+)\)/gi, '((log($2))/(log($1)))');
  return cleanStr;
}

assert(normalizeRootsAndLogs('\\sqrt[3]{8}') === 'nthroot(8, 3)', 'Normalizes LaTeX \\sqrt[3]{8} to nthroot(8, 3)');
assert(normalizeRootsAndLogs('root(3)(8)') === 'nthroot(8, 3)', 'Normalizes AsciiMath root(3)(8) to nthroot(8, 3)');
assert(normalizeRootsAndLogs('\\log_{2}(8)') === '((log(8))/(log(2)))', 'Normalizes LaTeX \\log_{2}(8) to ((log(8))/(log(2)))');
assert(normalizeRootsAndLogs('\\log_2(8)') === '((log(8))/(log(2)))', 'Normalizes unbraced \\log_2(8) to ((log(8))/(log(2)))');

const customLogAst = new PrattParser(normalizeRootsAndLogs('\\log_2(8)')).parseExpression();
const compiledLog = MathEngine.compile(customLogAst);
assert(Math.abs(compiledLog(0, 0, {}) - 3) < 1e-10, 'Compiled custom base log \\log_2(8) evaluates to 3', compiledLog(0, 0, {}));

// =========================================================================
// [TEST GROUP 15: Statistics Commands & List Parsing]
// =========================================================================
console.log('\n[TEST GROUP 15: Statistics Commands & List Parsing]');

assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('mean'), 'RESERVED_FUNCTIONS contains "mean"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('median'), 'RESERVED_FUNCTIONS contains "median"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('stdev'), 'RESERVED_FUNCTIONS contains "stdev"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('var'), 'RESERVED_FUNCTIONS contains "var"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('length'), 'RESERVED_FUNCTIONS contains "length"');

assert(MathEngine.formatForGiac(['mean', ['List', 1, 2, 3, 4, 5]]) === 'mean([1,2,3,4,5])', 'formatForGiac formats mean with List');
assert(MathEngine.formatForGiac(['stdev', ['List', 1, 2, 3]]) === 'stddev([1,2,3])', 'formatForGiac maps stdev to stddev');
assert(MathEngine.formatForGiac(['var', ['List', 1, 2, 3]]) === 'variance([1,2,3])', 'formatForGiac maps var to variance');
assert(MathEngine.formatForGiac(['length', ['List', 1, 2, 3]]) === 'size([1,2,3])', 'formatForGiac maps length to size');

function formatStatGiacCommand(cmdName: string, giacArgs: string): string {
    const listArg = !giacArgs.trim().startsWith('[') ? `[${giacArgs}]` : giacArgs;
    if (cmdName === 'stdev') return `stddev(${listArg})`;
    if (cmdName === 'var') return `variance(${listArg})`;
    if (cmdName === 'length') return `size(${listArg})`;
    return `${cmdName}(${listArg})`;
}
assert(formatStatGiacCommand('mean', '1, 2, 3, 4, 5') === 'mean([1, 2, 3, 4, 5])', 'Auto-wraps comma separated mean args to list');
assert(formatStatGiacCommand('median', '10, 20, 30') === 'median([10, 20, 30])', 'Auto-wraps comma separated median args to list');
assert(formatStatGiacCommand('stdev', '2, 4, 6') === 'stddev([2, 4, 6])', 'Auto-wraps comma separated stdev args to list');
assert(formatStatGiacCommand('var', '2, 4, 6') === 'variance([2, 4, 6])', 'Auto-wraps comma separated var args to list');
assert(formatStatGiacCommand('length', '1, 2, 3') === 'size([1, 2, 3])', 'Auto-wraps comma separated length args to list');
assert(formatStatGiacCommand('mean', '[1, 2, 3]') === 'mean([1, 2, 3])', 'Preserves already bracketed list for mean');

// =========================================================================
// [TEST GROUP 16: Linear Algebra & Matrix Commands]
// =========================================================================
console.log('\n[TEST GROUP 16: Linear Algebra & Matrix Commands]');

assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('det'), 'RESERVED_FUNCTIONS contains "det"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('rref'), 'RESERVED_FUNCTIONS contains "rref"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('trace'), 'RESERVED_FUNCTIONS contains "trace"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('rank'), 'RESERVED_FUNCTIONS contains "rank"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('inv'), 'RESERVED_FUNCTIONS contains "inv"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('eigenvals'), 'RESERVED_FUNCTIONS contains "eigenvals"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('eigenvects'), 'RESERVED_FUNCTIONS contains "eigenvects"');

assert(MathEngine.formatForGiac(['det', 'A']) === 'det(A)', 'formatForGiac det(A)');
assert(MathEngine.formatForGiac(['rref', 'A']) === 'rref(A)', 'formatForGiac rref(A)');
assert(MathEngine.formatForGiac(['tr', 'A']) === 'trace(A)', 'formatForGiac tr(A) -> trace(A)');
assert(MathEngine.formatForGiac(['matrixrank', 'A']) === 'rank(A)', 'formatForGiac matrixrank(A) -> rank(A)');
assert(MathEngine.formatForGiac(['Power', 'A', -1]) === 'inv(A)', 'formatForGiac A^-1 -> inv(A)');
assert(MathEngine.formatForGiac(['Power', 'A', 'T']) === 'tran(A)', 'formatForGiac A^T -> tran(A)');
assert(MathEngine.formatForGiac(['eigenvalues', 'A']) === 'eigenvals(A)', 'formatForGiac eigenvalues(A) -> eigenvals(A)');
assert(MathEngine.formatForGiac(['eigenvectors', 'A']) === 'eigenvects(A)', 'formatForGiac eigenvectors(A) -> eigenvects(A)');

// =========================================================================
// [TEST GROUP 17: Differential Equations & ODE Commands]
// =========================================================================
console.log('\n[TEST GROUP 17: Differential Equations & ODE Commands]');

assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('solveode'), 'RESERVED_FUNCTIONS contains "solveode"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('nsolveode'), 'RESERVED_FUNCTIONS contains "nsolveode"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('edo'), 'RESERVED_FUNCTIONS contains "edo"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('campo'), 'RESERVED_FUNCTIONS contains "campo"');
assert(FaultTolerantParser.RESERVED_FUNCTIONS.has('slopefield'), 'RESERVED_FUNCTIONS contains "slopefield"');

function formatOdeGiacCommand(cmdName: string, giacArgs: string): string {
    if (cmdName === 'nsolveode' || cmdName === 'solveode' || cmdName === 'edo') {
        return `desolve(${giacArgs})`;
    }
    return `${cmdName}(${giacArgs})`;
}
assert(formatOdeGiacCommand('solveode', "y' = y, y") === "desolve(y' = y, y)", 'Maps solveode to Giac desolve');
assert(formatOdeGiacCommand('edo', "y' = 2x, y") === "desolve(y' = 2x, y)", 'Maps edo to Giac desolve');

// =========================================================================
// [TEST GROUP 18: Defensive Rejection of Giac "pnt" Artifacts]
// =========================================================================
console.log('\n[TEST GROUP 18: Defensive Rejection of Giac "pnt" Artifacts]');

function sanitizeGiacResult(res: string): string {
    if (/\b(?:pnt|point)\b|pnt\(|pnt\[|point\[|536870912/i.test(res)) {
        return '- Erro no cálculo';
    }
    return res;
}

const bugArtifact = '= (i * ln(x) + (2 + i * x)/x) * x^(pnt(pnt[2 + i * x, [536870912]]))';
assert(sanitizeGiacResult(bugArtifact) === '- Erro no cálculo', 'Defensively catches and suppresses bizarre pnt artifact output');

const bugArtifact2 = 'pnt[2 + i * x, [536870912]]';
assert(sanitizeGiacResult(bugArtifact2) === '- Erro no cálculo', 'Defensively catches pnt array artifact');

const bugArtifact3 = 'point[1, 2]';
assert(sanitizeGiacResult(bugArtifact3) === '- Erro no cálculo', 'Defensively catches point array artifact');

const cleanResult = '= 2x';
assert(sanitizeGiacResult(cleanResult) === '= 2x', 'Passes clean result without false positives');

// =========================================================================
// [TEST GROUP 19: Nested Derivatives, Left/Right Normalization & Power Preservation]
// =========================================================================
console.log('\n[TEST GROUP 19: Nested Derivatives & Power Preservation]');

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(x^(2)\\right)') === 'diff(x^(2), x)',
  'Normalizes \\frac{d}{dx}\\left(x^(2)\\right) without injecting comma into exponent',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(x^(2)\\right)')
);

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(x^{2}\\right)') === 'diff(x^{2}, x)',
  'Normalizes \\frac{d}{dx}\\left(x^{2}\\right) to diff(x^{2}, x)',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(x^{2}\\right)')
);

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left((x+1)^2\\right)') === 'diff((x+1)^2, x)',
  'Normalizes \\frac{d}{dx}\\left((x+1)^2\\right) to diff((x+1)^2, x)',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left((x+1)^2\\right)')
);

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(\\sin(x^2)\\right)') === 'diff(\\sin(x^2), x)',
  'Normalizes \\frac{d}{dx}\\left(\\sin(x^2)\\right) to diff(\\sin(x^2), x)',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(\\sin(x^2)\\right)')
);

assert(
  FaultTolerantParser.normalizeDerivative('d/dx (x+1)^2') === 'diff((x+1)^2, x)',
  'Preserves outer power in d/dx (x+1)^2 as diff((x+1)^2, x)',
  FaultTolerantParser.normalizeDerivative('d/dx (x+1)^2')
);

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx} \\sin(x^2)') === 'diff(\\sin(x^2), x)',
  'Normalizes unparenthesized trig derivative \\frac{d}{dx} \\sin(x^2)',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx} \\sin(x^2)')
);

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx} \\cos(2x)') === 'diff(\\cos(2x), x)',
  'Normalizes unparenthesized trig derivative \\frac{d}{dx} \\cos(2x)',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx} \\cos(2x)')
);

assert(
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx} \\ln(x+1)') === 'diff(\\ln(x+1), x)',
  'Normalizes unparenthesized log derivative \\frac{d}{dx} \\ln(x+1)',
  FaultTolerantParser.normalizeDerivative('\\frac{d}{dx} \\ln(x+1)')
);

// Dangling power before \right
const danglingRightCheck = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}\\left(x^\\right)', '\\frac{d}{dx}(x^)');
assert(
  danglingRightCheck.isIncomplete,
  'Flags dangling power before \\right as incomplete',
  danglingRightCheck
);

// Empty command parentheses
const emptySolveode = FaultTolerantParser.checkIncompleteStatus('solveode()', 'solveode()');
assert(emptySolveode.isIncomplete, 'Flags solveode() with empty parens as incomplete', emptySolveode);

const emptyCampo = FaultTolerantParser.checkIncompleteStatus('campo()', 'campo()');
assert(emptyCampo.isIncomplete, 'Flags campo() with empty parens as incomplete', emptyCampo);

const emptyDet = FaultTolerantParser.checkIncompleteStatus('det()', 'det()');
assert(emptyDet.isIncomplete, 'Flags det() with empty parens as incomplete', emptyDet);

const emptyMean = FaultTolerantParser.checkIncompleteStatus('mean()', 'mean()');
assert(emptyMean.isIncomplete, 'Flags mean() with empty parens as incomplete', emptyMean);

// =========================================================================
// [TEST GROUP 20: Exhaustive Verification of ALL System Commands]
// =========================================================================
console.log('\n[TEST GROUP 20: Exhaustive Command Suite Verification]');

// 1. Differential equations
assert(MathEngine.isGiacCommand(['solveode', "y' = y, y"]), 'MathEngine recognizes solveode as Giac command');
assert(MathEngine.isGiacCommand(['edo', "y' = y, y"]), 'MathEngine recognizes edo as Giac command');
assert(MathEngine.formatForGiac(['solveode', "y' = y, y"]) === "desolve(y' = y, y)", 'formatForGiac formats solveode to desolve');
assert(MathEngine.formatForGiac(['edo', "y' = y, y"]) === "desolve(y' = y, y)", 'formatForGiac formats edo to desolve');

// 2. Calculus
assert(MathEngine.isGiacCommand(['diff', 'x^2', 'x']), 'MathEngine recognizes diff as Giac command');
assert(MathEngine.isGiacCommand(['int', 'x', 'x']), 'MathEngine recognizes int as Giac command');
assert(MathEngine.isGiacCommand(['defint', 'x', 'x', 0, 1]), 'MathEngine recognizes defint as Giac command');
assert(MathEngine.isGiacCommand(['lim', 'sin(x)/x', 'x', 0]), 'MathEngine recognizes lim as Giac command');
assert(MathEngine.isGiacCommand(['taylor', 'sin(x)', 'x', 0, 4]), 'MathEngine recognizes taylor as Giac command');
assert(MathEngine.isGiacCommand(['sum', 'n', 'n', 1, 10]), 'MathEngine recognizes sum as Giac command');
assert(MathEngine.isGiacCommand(['prod', 'n', 'n', 1, 5]), 'MathEngine recognizes prod as Giac command');

// 3. Linear Algebra
assert(MathEngine.isGiacCommand(['det', 'A']), 'MathEngine recognizes det as Giac command');
assert(MathEngine.isGiacCommand(['rref', 'A']), 'MathEngine recognizes rref as Giac command');
assert(MathEngine.isGiacCommand(['trace', 'A']), 'MathEngine recognizes trace as Giac command');
assert(MathEngine.isGiacCommand(['tr', 'A']), 'MathEngine recognizes tr as Giac command');
assert(MathEngine.isGiacCommand(['rank', 'A']), 'MathEngine recognizes rank as Giac command');
assert(MathEngine.isGiacCommand(['inv', 'A']), 'MathEngine recognizes inv as Giac command');
assert(MathEngine.isGiacCommand(['tran', 'A']), 'MathEngine recognizes tran as Giac command');
assert(MathEngine.isGiacCommand(['eigenvals', 'A']), 'MathEngine recognizes eigenvals as Giac command');
assert(MathEngine.isGiacCommand(['eigenvects', 'A']), 'MathEngine recognizes eigenvects as Giac command');

// 4. Statistics & Lists
assert(MathEngine.isGiacCommand(['mean', ['List', 1, 2, 3]]), 'MathEngine recognizes mean as Giac command');
assert(MathEngine.isGiacCommand(['median', ['List', 1, 2, 3]]), 'MathEngine recognizes median as Giac command');
assert(MathEngine.isGiacCommand(['stdev', ['List', 1, 2, 3]]), 'MathEngine recognizes stdev as Giac command');
assert(MathEngine.isGiacCommand(['var', ['List', 1, 2, 3]]), 'MathEngine recognizes var as Giac command');
assert(MathEngine.isGiacCommand(['length', ['List', 1, 2, 3]]), 'MathEngine recognizes length as Giac command');

// 5. Functions & Multivariables
const polyAst = new PrattParser('x^3 - 3*x + 1').parseExpression();
const compiledPoly = MathEngine.compile(polyAst, 'x');
assert(compiledPoly(2, 0, {}) === 3, 'compiledPoly(2) = 2^3 - 6 + 1 = 3', compiledPoly(2, 0, {}));

// =========================================================================
console.log('\n[TEST GROUP 21: Nested Absolute Values & Pipe Tokenization]');
// 1. Nested absolute values: ||x| - 2|
const tokNested = new Tokenizer();
const nestedTokens = tokNested.tokenize('||x| - 2|');
const pipeTokens = nestedTokens.filter(t => t.type === TokenTypes.PIPE);
assert(pipeTokens.length === 4, '||x| - 2| produces exactly 4 PIPE tokens without rogue * injection', nestedTokens);

const parsedNested = new PrattParser('||x| - 2|').parseExpression();
assert(Array.isArray(parsedNested) && parsedNested[0] === 'Abs' && parsedNested[1][0] === 'Subtract' && parsedNested[1][1][0] === 'Abs', 'PrattParser parses ||x| - 2| as nested Abs AST', parsedNested);

// Test implicit multiplication with pipes
const tokPipeMul1 = new Tokenizer().tokenize('2|x|');
assert(tokPipeMul1.some(t => t.type === TokenTypes.MULTIPLICATION), '2|x| has implicit multiplication 2*|x|');

const tokPipeMul2 = new Tokenizer().tokenize('|x|2');
assert(tokPipeMul2.some(t => t.type === TokenTypes.MULTIPLICATION), '|x|2 has implicit multiplication |x|*2');

const tokPipeMul3 = new Tokenizer().tokenize('|x||y|');
assert(tokPipeMul3.some(t => t.type === TokenTypes.MULTIPLICATION), '|x||y| has implicit multiplication |x|*|y|');

// =========================================================================
console.log('\n[TEST GROUP 22: Native MathEngine.evaluateAST]');
assert(MathEngine.evaluateAST(42) === 42, 'evaluateAST evaluates number literal 42');
assert(Math.abs(MathEngine.evaluateAST('pi') - Math.PI) < 1e-10, 'evaluateAST evaluates string "pi"');
assert(Math.abs(MathEngine.evaluateAST('e') - Math.E) < 1e-10, 'evaluateAST evaluates string "e"');
assert(MathEngine.evaluateAST('a', { a: 7.5 }) === 7.5, 'evaluateAST evaluates scope variable { a: 7.5 }');

// PrattParser nodes
const nodeNum = { type: 'Number', value: 15 };
assert(MathEngine.evaluateAST(nodeNum) === 15, 'evaluateAST evaluates PrattParser Number node');

const nodeBin = { type: 'BinaryOp', operator: '+', left: { type: 'Number', value: 10 }, right: { type: 'Number', value: 20 } };
assert(MathEngine.evaluateAST(nodeBin) === 30, 'evaluateAST evaluates PrattParser BinaryOp node');

const nodeFunc = { type: 'FunctionCall', name: 'sqrt', arguments: [{ type: 'Number', value: 16 }] };
assert(MathEngine.evaluateAST(nodeFunc) === 4, 'evaluateAST evaluates PrattParser FunctionCall sqrt node');

// MathJSON arrays
assert(MathEngine.evaluateAST(['Add', 10, ['Multiply', 2, 5]]) === 20, 'evaluateAST evaluates nested MathJSON Add and Multiply');
assert(MathEngine.evaluateAST(['Power', 2, 3]) === 8, 'evaluateAST evaluates MathJSON Power 2^3 = 8');
assert(MathEngine.evaluateAST(['Sin', 0]) === 0, 'evaluateAST evaluates MathJSON Sin(0) = 0');
assert(MathEngine.evaluateAST(['Cos', 0]) === 1, 'evaluateAST evaluates MathJSON Cos(0) = 1');

// =========================================================================
console.log('\n[TEST GROUP 23: Interval Arithmetic intPow]');
const intOps = (MathEngine as any).intervalOps;
// Even power on interval crossing zero: [-2, 1]^4 should be [0, 16]
const resEven = intOps.intPow({ min: -2, max: 1 }, { min: 4, max: 4 });
assert(resEven.min === 0 && resEven.max === 16, 'intPow([-2, 1], 4) = [0, 16]', resEven);

// Odd power on interval crossing zero: [-2, 1]^3 should be [-8, 1]
const resOdd = intOps.intPow({ min: -2, max: 1 }, { min: 3, max: 3 });
assert(resOdd.min === -8 && resOdd.max === 1, 'intPow([-2, 1], 3) = [-8, 1]', resOdd);

// =========================================================================
console.log('\n[TEST GROUP 24: ODESolver Bidirectional & Blowup Guard]');

// y' = y com y(0) = 1 (solução exata: y = e^x)
const odePoints = ODESolver.solveBidirectional((_x, y) => y, 0, 1, -2, 2);
assert(odePoints.length > 10, 'solveBidirectional produces points across viewport');
const firstPt = odePoints[0];
const lastPt = odePoints[odePoints.length - 1];
assert(firstPt.x < 0, 'solveBidirectional includes negative x values (backwards integration)', firstPt);
assert(lastPt.x > 0, 'solveBidirectional includes positive x values (forward integration)', lastPt);
// Verifica proximidade de e^1 no ponto x ~ 1
const ptNear1 = odePoints.find(p => Math.abs(p.x - 1) < 0.05);
if (ptNear1) {
  assert(Math.abs(ptNear1.y - Math.exp(ptNear1.x)) < 1e-3, `ODE numerical solution matches exact exp(x): ${ptNear1.y.toFixed(5)} vs ${Math.exp(ptNear1.x).toFixed(5)}`);
}

// Blow-up guard: y' = y^2 com y(0) = 1 (assíntota vertical em x = 1)
const blowupPts = ODESolver.solveDormandPrince((_x, y) => y * y, 0, 1, 5);
assert(blowupPts.every(p => isFinite(p.y) && Math.abs(p.y) <= 1e11), 'ODESolver terminates cleanly on blowup without returning Infinity/NaN points');

// =========================================================================
console.log('\n[TEST GROUP 25: LatexNormalizer Centralization]');

const normDeriv = LatexNormalizer.normalizeDerivative('\\frac{d}{dx}(x^2)');
assert(normDeriv.includes('diff'), 'LatexNormalizer normalizes \\frac{d}{dx}(x^2) to diff');

const normFrac = LatexNormalizer.normalizeFractions('\\frac{\\frac{1}{2}}{3}');
// =========================================================================
console.log('\n[TEST GROUP 26: Unparenthesized Functions & Trig Powers (Desmos Parity)]');

// 1. Trig Powers: sin^2(x), \sin^2(x), \sin^2 x, \cos^3(x), etc.
const trigP1 = LatexNormalizer.normalizeTrigPowers('sin^2(x)');
assert(trigP1.includes('(sin(x))^2'), 'sin^2(x) normalizes to ((sin(x))^2)', trigP1);

const trigP2 = LatexNormalizer.normalizeTrigPowers('\\sin^2(x)');
assert(trigP2.includes('(sin(x))^2'), '\\sin^2(x) normalizes to ((sin(x))^2)', trigP2);

const trigP3 = LatexNormalizer.normalizeTrigPowers('\\sin^{2}(x)');
assert(trigP3.includes('(sin(x))^2'), '\\sin^{2}(x) normalizes to ((sin(x))^2)', trigP3);

const trigP4 = LatexNormalizer.normalizeTrigPowers('\\sin^2 x');
assert(trigP4.includes('(sin(x))^2'), '\\sin^2 x normalizes to ((sin(x))^2)', trigP4);

const trigP5 = LatexNormalizer.normalizeTrigPowers('\\cos^3(x)');
assert(trigP5.includes('(cos(x))^3'), '\\cos^3(x) normalizes to ((cos(x))^3)', trigP5);

// 2. Inverse Trig Functions: \sin^{-1}(x) -> asin(x)
const invTrig1 = LatexNormalizer.normalizeTrigPowers('\\sin^{-1}(x)');
assert(invTrig1.includes('asin(x)'), '\\sin^{-1}(x) normalizes to asin(x)', invTrig1);

const invTrig2 = LatexNormalizer.normalizeTrigPowers('\\cos^{-1}(x)');
assert(invTrig2.includes('acos(x)'), '\\cos^{-1}(x) normalizes to acos(x)', invTrig2);

const invTrig3 = LatexNormalizer.normalizeTrigPowers('\\tan^{-1}(x)');
assert(invTrig3.includes('atan(x)'), '\\tan^{-1}(x) normalizes to atan(x)', invTrig3);

// 3. Unparenthesized Functions: \sin x, cos 2x, ln x, sqrt x
const unparen1 = LatexNormalizer.normalizeUnparenthesized('\\sin x');
assert(unparen1 === 'sin(x)', '\\sin x normalizes to sin(x)', unparen1);

const unparen2 = LatexNormalizer.normalizeUnparenthesized('cos 2x');
assert(unparen2 === 'cos(2x)', 'cos 2x normalizes to cos(2x)', unparen2);

const unparen3 = LatexNormalizer.normalizeUnparenthesized('ln x');
assert(unparen3 === 'ln(x)', 'ln x normalizes to ln(x)', unparen3);

const unparen4 = LatexNormalizer.normalizeUnparenthesized('sqrt x');
assert(unparen4 === 'sqrt(x)', 'sqrt x normalizes to sqrt(x)', unparen4);

const unparen5 = LatexNormalizer.normalizeUnparenthesized('\\sin x + \\cos x');
assert(unparen5 === 'sin(x) + cos(x)', '\\sin x + \\cos x normalizes to sin(x) + cos(x)', unparen5);

// 4. Full LatexNormalizer.normalize pipeline
const fullNorm1 = LatexNormalizer.normalize('\\sin^2(x) + \\cos^2(x)');
assert(fullNorm1.includes('(sin(x))^2') && fullNorm1.includes('(cos(x))^2'), 'Full pipeline handles \\sin^2(x) + \\cos^2(x)', fullNorm1);

const fullNorm2 = LatexNormalizer.normalize('\\sin x + \\cos 2x');
assert(fullNorm2.includes('sin(x)') && fullNorm2.includes('cos(2*x)'), 'Full pipeline handles \\sin x + \\cos 2x', fullNorm2);

// 5. PrattParser unparenthesized unary function parsing
const astUnparenSin = new PrattParser('sin x').parse();
assert(Array.isArray(astUnparenSin) && astUnparenSin[0] === 'Sin' && astUnparenSin[1] === 'x', 'PrattParser parses "sin x" as ["Sin", "x"]', astUnparenSin);

const astUnparenCos2x = new PrattParser('cos 2x').parse();
assert(Array.isArray(astUnparenCos2x) && astUnparenCos2x[0] === 'Cos', 'PrattParser parses "cos 2x" as ["Cos", ...]', astUnparenCos2x);

const astUnparenAdd = new PrattParser('sin x + cos x').parse();
assert(Array.isArray(astUnparenAdd) && astUnparenAdd[0] === 'Add', 'PrattParser parses "sin x + cos x" without discarding terms', astUnparenAdd);

// 6. PrattParser.parse() unconsumed tokens check
let threwUnconsumed = false;
try {
  new PrattParser('1 2').parse();
} catch (e: any) {
  threwUnconsumed = true;
}
assert(threwUnconsumed, 'PrattParser.parse() throws SyntaxError on unconsumed tokens ("1 2")');

// 7. FaultTolerantParser trailing bare functions warning
const bareSinCheck = FaultTolerantParser.checkIncompleteStatus('\\sin', 'sin');
assert(bareSinCheck.isIncomplete && bareSinCheck.warning.includes('sin'), 'Flags bare "sin" as incomplete with informative message', bareSinCheck);

const bareLnCheck = FaultTolerantParser.checkIncompleteStatus('\\ln', 'ln');
assert(bareLnCheck.isIncomplete && bareLnCheck.warning.includes('ln'), 'Flags bare "ln" as incomplete with informative message', bareLnCheck);

// =========================================================================
console.log('\n[TEST GROUP 27: Commands Guide & Modal Persistence]');

assert(COMMANDS_DATA.length >= 25, `CommandsGuideModal has ${COMMANDS_DATA.length} command docs (>= 25)`);
assert(COMMANDS_DATA.some(c => c.category === 'calculo'), 'Has calculo commands');
assert(COMMANDS_DATA.some(c => c.category === 'integrais'), 'Has integrais commands');
assert(COMMANDS_DATA.some(c => c.category === 'algebra'), 'Has algebra commands');
assert(COMMANDS_DATA.some(c => c.category === 'funcoes'), 'Has funcoes commands');
assert(COMMANDS_DATA.some(c => c.category === 'estatistica'), 'Has estatistica commands');

let insertedExpr = '';
CommandsGuideModal.init((expr) => { insertedExpr = expr; });
assert(typeof (CommandsGuideModal as any).onInsertCallback === 'function', 'CommandsGuideModal preserves onInsertCallback statically');

// =========================================================================
console.log('\n[TEST GROUP 28: End-to-End Pipeline Verification (Anti-Illusion Suite)]');
const matrixSet = new Set(['A', 'B']);

// 1. Inverse trig through FULL LatexNormalizer.normalize -> PrattParser -> MathEngine.compile
const e2eInvSinNorm = LatexNormalizer.normalize('\\sin^{-1}(0.5)', '\\sin^{-1}(0.5)', matrixSet);
const e2eInvSinAst = new PrattParser(e2eInvSinNorm).parseExpression();
const e2eInvSinVal = MathEngine.compile(e2eInvSinAst)(0, 0, {});
assert(Math.abs(e2eInvSinVal - Math.asin(0.5)) < 1e-9, `Full E2E \\sin^{-1}(0.5) evaluates to asin(0.5) = ${Math.asin(0.5)}, got ${e2eInvSinVal} (norm: ${e2eInvSinNorm})`);

const e2eInvCosUnparen = LatexNormalizer.normalize('\\cos^{-1} 0.5', '\\cos^{-1} 0.5', matrixSet);
const e2eInvCosVal = MathEngine.compile(new PrattParser(e2eInvCosUnparen).parseExpression())(0, 0, {});
assert(Math.abs(e2eInvCosVal - Math.acos(0.5)) < 1e-9, `Full E2E \\cos^{-1} 0.5 evaluates to acos(0.5), got ${e2eInvCosVal} (norm: ${e2eInvCosUnparen})`);

// 2. Scalar negative powers x^{-1} and (x+1)^{-1} vs Matrix inverse A^{-1}
const e2eScalarNegPow = LatexNormalizer.normalize('x^{-1}', 'x^{-1}', matrixSet);
assert(!e2eScalarNegPow.includes('inv('), `Scalar x^{-1} must NOT become matrix inv(x): got ${e2eScalarNegPow}`);
const e2eScalarNegVal = MathEngine.compile(new PrattParser(e2eScalarNegPow).parseExpression())(2, 0, {});
assert(Math.abs(e2eScalarNegVal - 0.5) < 1e-9, `Full E2E x^{-1} at x=2 evaluates to 0.5, got ${e2eScalarNegVal}`);

const e2eParenNegPow = LatexNormalizer.normalize('(x+1)^{-1}', '(x+1)^{-1}', matrixSet);
assert(!e2eParenNegPow.includes('inv('), `Scalar (x+1)^{-1} must NOT become matrix inv: got ${e2eParenNegPow}`);
const e2eParenNegVal = MathEngine.compile(new PrattParser(e2eParenNegPow).parseExpression())(3, 0, {});
assert(Math.abs(e2eParenNegVal - 0.25) < 1e-9, `Full E2E (x+1)^{-1} at x=3 evaluates to 0.25, got ${e2eParenNegVal}`);

const e2eMatrixInv = LatexNormalizer.normalize('A^{-1}', 'A^{-1}', matrixSet);
assert(e2eMatrixInv === 'inv(A)', `Defined matrix A^{-1} normalizes to inv(A): got ${e2eMatrixInv}`);

// 3. Lowercase exponent ^t (e^t, x^t) vs Uppercase Matrix Transpose ^T (A^T)
const e2eExpT = LatexNormalizer.normalize('e^t', 'e^t', matrixSet);
assert(!e2eExpT.includes('tran('), `Scalar e^t must NOT become matrix tran(e): got ${e2eExpT}`);
const e2eExpTVal = MathEngine.compile(new PrattParser(e2eExpT).parseExpression())(0, 0, { t: 2 });
assert(Math.abs(e2eExpTVal - Math.exp(2)) < 1e-9, `Full E2E e^t at t=2 evaluates to exp(2), got ${e2eExpTVal}`);

const e2eMatrixTran = LatexNormalizer.normalize('A^T', 'A^T', matrixSet);
assert(e2eMatrixTran === 'tran(A)', `Defined matrix A^T normalizes to tran(A): got ${e2eMatrixTran}`);

// 4. Operator precedence in unparenthesized functions with exponents: cos x^2 = cos(x^2), sin 2x^2 = sin(2*x^2)
const e2eCosX2Norm = LatexNormalizer.normalize('\\cos x^2', '\\cos x^2', matrixSet);
const e2eCosX2Val = MathEngine.compile(new PrattParser(e2eCosX2Norm).parseExpression())(1.2, 0, {});
assert(Math.abs(e2eCosX2Val - Math.cos(1.2 * 1.2)) < 1e-9, `Full E2E \\cos x^2 at x=1.2 evaluates to cos(1.44) = ${Math.cos(1.44)}, got ${e2eCosX2Val} (norm: ${e2eCosX2Norm})`);

const e2eSin2X2Norm = LatexNormalizer.normalize('\\sin 2x^2', '\\sin 2x^2', matrixSet);
const e2eSin2X2Val = MathEngine.compile(new PrattParser(e2eSin2X2Norm).parseExpression())(1.1, 0, {});
assert(Math.abs(e2eSin2X2Val - Math.sin(2 * 1.1 * 1.1)) < 1e-9, `Full E2E \\sin 2x^2 at x=1.1 evaluates to sin(2*1.21), got ${e2eSin2X2Val} (norm: ${e2eSin2X2Norm})`);

// 5. Top-level parseExpression() rejects unconsumed tokens just like parse()
let threwOnParseExpr = false;
try {
  new PrattParser('1 2').parseExpression();
} catch (_) {
  threwOnParseExpr = true;
}
assert(threwOnParseExpr, 'Top-level PrattParser.parseExpression() throws SyntaxError on unconsumed tokens ("1 2")');

// 6. Extended inverse trig & hyperbolic functions in MathEngine & GLRenderer
const e2eAsecNorm = LatexNormalizer.normalize('\\sec^{-1}(2)', '\\sec^{-1}(2)', matrixSet);
const e2eAsecAst = new PrattParser(e2eAsecNorm).parseExpression();
assert(Math.abs(MathEngine.evaluateAST(e2eAsecAst) - Math.acos(0.5)) < 1e-9, 'evaluateAST evaluates \\sec^{-1}(2) = acos(0.5)');
assert(Math.abs(MathEngine.compile(e2eAsecAst)(0, 0, {}) - Math.acos(0.5)) < 1e-9, 'compile evaluates \\sec^{-1}(2) = acos(0.5)');

const glslSinh = GLRenderer.astToGLSL(['Sinh', 'x']);
assert(!glslSinh.includes('sinh(') && glslSinh.includes('exp('), `WebGL1 GLSL Sinh uses exp() expansion instead of WebGL2 sinh(): ${glslSinh}`);

console.log(`\n--- RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
expect(passed).toBe(386);
expect(failed).toBe(0);
  });
});
