import { Tokenizer, TokenTypes } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { ImplicitEngine } from '../src/core/implicitEngine';

console.log('=== TEST PROBE 2: IMPLICIT & USER FUNCTIONS ===');

// Test 1: Implicit equations
const eq1 = 'x^2 + y^2 = 1';
const implicitMatch1 = eq1.replace(/\s+/g, '').match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
console.log('eq1 match:', implicitMatch1);
if (implicitMatch1) {
    const parts = eq1.split(implicitMatch1[2]);
    const expr = `(${parts[0]})-(${parts[1]})`;
    const ast = new PrattParser(expr).parseExpression();
    console.log('eq1 AST:', JSON.stringify(ast));
    const geom = ImplicitEngine.generateImplicit('eq1', ast, '=', {}, -2, 2, -2, 2);
    console.log('eq1 segments count:', geom.segments.length, 'fills count:', geom.fills.length);
}

// Test 2: Inequation x^2 + y^2 <= 4
const eq2 = 'x^2 + y^2 <= 4';
const implicitMatch2 = eq2.replace(/\s+/g, '').match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
console.log('eq2 match:', implicitMatch2);
if (implicitMatch2) {
    const parts = eq2.split(implicitMatch2[2]);
    const expr = `(${parts[0]})-(${parts[1]})`;
    const ast = new PrattParser(expr).parseExpression();
    console.log('eq2 AST:', JSON.stringify(ast));
    const geom = ImplicitEngine.generateImplicit('eq2', ast, '<=', {}, -3, 3, -3, 3);
    console.log('eq2 segments count:', geom.segments.length, 'fills count:', geom.fills.length);
}

// Test 3: Inequation x*y > 1
const eq3 = 'x*y > 1';
const implicitMatch3 = eq3.replace(/\s+/g, '').match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
console.log('eq3 match:', implicitMatch3);
if (implicitMatch3) {
    const parts = eq3.split(implicitMatch3[2]);
    const expr = `(${parts[0]})-(${parts[1]})`;
    const ast = new PrattParser(expr).parseExpression();
    console.log('eq3 AST:', JSON.stringify(ast));
    const geom = ImplicitEngine.generateImplicit('eq3', ast, '>', {}, -5, 5, -5, 5);
    console.log('eq3 segments count:', geom.segments.length, 'fills count:', geom.fills.length);
}

// Test 4: User functions
console.log('\n--- User Functions Test ---');
// f(x) = x^2
const fAst = new PrattParser('x^2').parseExpression();
MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: '1' };
StateManager.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: '1' };
MathEngine.compiledFuncs['f'] = (x: number) => x * x;

// g(x) = f(x) + 1
const gAst = new PrattParser('f(x) + 1').parseExpression();
console.log('gAst raw:', JSON.stringify(gAst));
const gExpanded = MathEngine.expandUserFunctions(gAst);
console.log('gExpanded:', JSON.stringify(gExpanded));

// Multi-variable: f(x, y) = x^2 + y^2
const f2Ast = new PrattParser('x^2 + y^2').parseExpression();
MathEngine.userFunctions['h'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: f2Ast, blockId: '2' };
StateManager.userFunctions['h'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: f2Ast, blockId: '2' };
MathEngine.compiledFuncs['h'] = MathEngine.compileMultivariable(f2Ast, ['x', 'y']);

console.log('h(3, 4) compiled:', MathEngine.compiledFuncs['h'](3, 4));

// Dependent call: k(x, y) = h(x, y) - 25
const kAst = new PrattParser('h(x, y) - 25').parseExpression();
const kExpanded = MathEngine.expandUserFunctions(kAst);
console.log('kAst raw:', JSON.stringify(kAst));
console.log('kExpanded:', JSON.stringify(kExpanded));

// Test evaluate of compiled function calling another compiled function
const compiledG = MathEngine.compile(gAst);
console.log('compiledG(3) [calls funcs.f]:', compiledG(3, 0, {}));

// Test compileMultivariable for dependent function
const compiledK = MathEngine.compileMultivariable(kAst, ['x', 'y']);
console.log('compiledK(3, 4) [calls funcs.h]:', compiledK(3, 4));
