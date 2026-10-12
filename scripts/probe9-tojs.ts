import { PrattParser } from '../src/core/prattParser';

const ast = new PrattParser('f2(x, y) + 10').parseExpression();
const paramNames = ['x', 'y'];

const toJS = (node: any): string => {
    if (typeof node === 'number') return node.toString();
    if (typeof node === 'string') {
        const clean = node.trim();
        if (clean === 'e') return 'Math.E';
        if (clean === 'pi' || clean === '\\pi' || clean === 'π') return 'Math.PI';
        const pIdx = paramNames.indexOf(clean);
        if (pIdx !== -1) return `(args[${pIdx}] !== undefined ? args[${pIdx}] : 0)`;
        return `(scope['${clean}'] !== undefined ? scope['${clean}'] : 0)`;
    }
    if (Array.isArray(node)) {
        const op = node[0];
        if (op === 'Add') return `(${toJS(node[1])} + ${toJS(node[2])})`;
        const args = node.slice(1).map(toJS);
        args.push('scope');
        return `(funcs['${op}'] ? funcs['${op}'](${args.join(', ')}) : 0)`;
    }
    return '0';
};

console.log('toJS(ast):', toJS(ast));
