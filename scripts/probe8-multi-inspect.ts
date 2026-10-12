import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';

const fxyAst = new PrattParser('x^2 + y^2').parseExpression();
MathEngine.userFunctions['f2'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: fxyAst, blockId: '3' };
const fnF2 = MathEngine.compileMultivariable(fxyAst, ['x', 'y']);
MathEngine.compiledFuncs['f2'] = fnF2;

console.log('MathEngine.compiledFuncs["f2"](3, 4):', fnF2(3, 4));

const g2RawAst = new PrattParser('f2(x, y) + 10').parseExpression();
const fnG2 = MathEngine.compileMultivariable(g2RawAst, ['x', 'y']);
console.log('g2 code inspection...');
console.log('fnG2(3, 4):', fnG2(3, 4));
console.log('fnG2(3, 4, {}):', fnG2(3, 4, {}));
