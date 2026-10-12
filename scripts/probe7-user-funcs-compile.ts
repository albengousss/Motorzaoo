import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';

// Simula:
// Bloco 1: f(x) = x^2
const fAst = new PrattParser('x^2').parseExpression();
MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: '1' };
MathEngine.compiledFuncs['f'] = MathEngine.compile(fAst, 'x');

// Bloco 2: g(x) = f(x) + 1
// Em main.ts, linha 1320:
// const ast = new PrattParser(expr).parseExpression();
// MathEngine.userFunctions[funcName] = { params, expr, ast, blockId };
// MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
const gExpr = 'f(x) + 1';
const gRawAst = new PrattParser(gExpr).parseExpression();
console.log('gRawAst:', JSON.stringify(gRawAst));

// MathEngine.compile sem expandUserFunctions:
const gCompiled = MathEngine.compile(gRawAst, 'x');
console.log('gCompiled(3) -> expect 10, got:', gCompiled(3, 0, {}));

// Bloco 3: f(x, y) = x^2 + y^2
const fxyAst = new PrattParser('x^2 + y^2').parseExpression();
MathEngine.userFunctions['f2'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: fxyAst, blockId: '3' };
MathEngine.compiledFuncs['f2'] = MathEngine.compileMultivariable(fxyAst, ['x', 'y']);

// Bloco 4: g2(x, y) = f2(x, y) + 10
const g2RawAst = new PrattParser('f2(x, y) + 10').parseExpression();
const g2Compiled = MathEngine.compileMultivariable(g2RawAst, ['x', 'y']);
console.log('g2Compiled(3, 4) -> expect 35, got:', g2Compiled(3, 4, {}));
