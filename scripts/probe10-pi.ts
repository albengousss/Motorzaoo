import { Tokenizer } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';

const expressions = [
    '\\pi x',
    '\\pi y',
    '2\\pi r',
    '\\pi(x+1)',
    'π x',
    'π y',
    '2π r',
    'π(x+1)'
];

const tok = new Tokenizer();
for (const expr of expressions) {
    try {
        const tokens = tok.tokenize(expr);
        const parser = new PrattParser(expr);
        const ast = parser.parseExpression();
        console.log(`[${expr}] -> tokens:`, tokens.map(t => `${t.type}:${t.value}`).join(' '), 'AST:', JSON.stringify(ast), 'Lookahead left:', parser.lookahead);
    } catch (e: any) {
        console.log(`[${expr}] -> ERROR:`, e.message);
    }
}
