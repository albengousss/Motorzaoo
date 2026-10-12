import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';

// Defina f(x) = x^2
const fAst = new PrattParser('x^2').parseExpression();
MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: '1' };

// Defina g(x) = f(x) + 1
// Se g(x) for definido sem expandir f(x):
const gAst = new PrattParser('f(x) + 1').parseExpression();
MathEngine.userFunctions['g'] = { params: ['x'], expr: 'f(x) + 1', ast: gAst, blockId: '2' };

// Agora vamos expandir h(x) = g(x) * 2
const hAst = new PrattParser('g(x) * 2').parseExpression();
console.log('hAst raw:', JSON.stringify(hAst));
const hExpanded = MathEngine.expandUserFunctions(hAst);
console.log('hExpanded once:', JSON.stringify(hExpanded));
const hExpandedTwice = MathEngine.expandUserFunctions(hExpanded);
console.log('hExpanded twice:', JSON.stringify(hExpandedTwice));
