import { Tokenizer, TokenTypes } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { ImplicitEngine } from '../src/core/implicitEngine';

console.log('=== TEST PROBE: INVESTIGATION AGENT 4 ===');

// Probe 1: Scientific notation
const tok1 = new Tokenizer();
const t1 = tok1.tokenize('1e-5');
console.log('1e-5 tokens:', t1);
try {
    const p1 = new PrattParser('1e-5').parseExpression();
    console.log('1e-5 AST:', p1);
} catch (e: any) {
    console.error('1e-5 AST error:', e.message);
}

// Probe 1b: 2.5e-3, 1e+10, 1e4
console.log('1e+10 tokens:', tok1.tokenize('1e+10'));
console.log('2.5e-3 tokens:', tok1.tokenize('2.5e-3'));

// Probe 2: Chained power x^2^3
try {
    const p2 = new PrattParser('x^2^3').parseExpression();
    console.log('x^2^3 AST:', JSON.stringify(p2));
} catch (e: any) {
    console.error('x^2^3 error:', e.message);
}

// Probe 3: Implicit multiplication 2x, 2(x+1), x sin(x)
const implicitCases = [
    '2x',
    '2(x+1)',
    'x sin(x)',
    'x*sin(x)',
    '2x sin(x)',
    '(x+1)(x-1)',
    '3xy',
    'x y',
    'x^2 y^2',
    '2x^3',
    'x(x+1)'
];
for (const expr of implicitCases) {
    try {
        const tokens = tok1.tokenize(expr);
        const ast = new PrattParser(expr).parseExpression();
        console.log(`[${expr}] -> AST:`, JSON.stringify(ast));
    } catch (e: any) {
        console.error(`[${expr}] -> ERROR:`, e.message);
    }
}
