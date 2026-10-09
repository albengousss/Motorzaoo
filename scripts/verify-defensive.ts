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

// 5. Matrix normalizations (Giac CAS transformations)
console.log('\n[TEST GROUP 5: Giac Matrix Expression Normalizations]');

function testPrefixGiac(input: string, knownMatrices: Set<string>): string {
  let s = input.trim();
  // Transpose: A^T or A^{\top} or A'
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?(?:T|\\top)\}?/g, 'tran($1)');
  // Inverse: A^{-1}
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?-1\}?/g, 'inv($1)');
  // Determinant: det(A)
  s = s.replace(/\bdet\s*\(([^)]+)\)/g, 'det($1)');
  // Scalar mult: 2A -> 2*A
  s = s.replace(/(\d+)\s*([A-Z][a-zA-Z0-9_]*)/g, '$1*$2');
  return s;
}

const transRes = testPrefixGiac('A^T + B^{-1}', new Set(['A', 'B']));
assert(
  transRes === 'tran(A) + inv(B)',
  'Transforms A^T and B^{-1} into CAS tran(A) and inv(B)',
  transRes
);

const scalarRes = testPrefixGiac('2A + 3B', new Set(['A', 'B']));
assert(
  scalarRes === '2*A + 3*B',
  'Transforms 2A + 3B into 2*A + 3*B',
  scalarRes
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
