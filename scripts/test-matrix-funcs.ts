import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { MatrixEngine } from '../src/core/matrixEngine';

MathEngine.initCompiledFuncs();

console.log('Testing matrix function f(x) = [[x, 0], [0, x]]...');

const expr = '[[x, 0], [0, x]]';
const ast = new PrattParser(expr).parseExpression();
console.log('Matrix AST:', JSON.stringify(ast));

MathEngine.userFunctions['f'] = { params: ['x'], expr, ast, blockId: 'b1' };
StateManager.userFunctions['f'] = { params: ['x'], expr, ast, blockId: 'b1' };

const callAst = new PrattParser('f(3)').parseExpression();
console.log('Call AST for f(3):', JSON.stringify(callAst));

const evalRes = MathEngine.evaluateAST(callAst, StateManager.values);
console.log('Evaluation result for f(3):', evalRes);
console.log('isMatrix(evalRes):', MatrixEngine.isMatrix(evalRes));
console.log('Formatted display:', MatrixEngine.formatMatrixDisplay(evalRes));

console.log('\nTesting multivariable matrix function a(x, y, z) = [[x, 0, 0], [0, y, 0], [0, 0, z]]...');
const expr3D = '[[x, 0, 0], [0, y, 0], [0, 0, z]]';
const ast3D = new PrattParser(expr3D).parseExpression();

MathEngine.userFunctions['a'] = { params: ['x', 'y', 'z'], expr: expr3D, ast: ast3D, blockId: 'b2' };
StateManager.userFunctions['a'] = { params: ['x', 'y', 'z'], expr: expr3D, ast: ast3D, blockId: 'b2' };

const callAst3D = new PrattParser('a(1, 2, 3)').parseExpression();
const evalRes3D = MathEngine.evaluateAST(callAst3D, StateManager.values);
console.log('Evaluation result for a(1, 2, 3):', evalRes3D);
console.log('isMatrix(evalRes3D):', MatrixEngine.isMatrix(evalRes3D));
console.log('Formatted display:', MatrixEngine.formatMatrixDisplay(evalRes3D));
