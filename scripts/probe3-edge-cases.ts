import { Tokenizer } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';

const cases = [
    'a x',
    'ab',
    'a b',
    '2 a',
    'a(x+1)',
    'a sin(x)',
    '(x+1)sin(x)',
    '(x+1)(y+1)',
    'sin(x)cos(x)',
    'sin(x)x',
    'x^2 sin(x)',
    'x^2y^2',
    'x^2 y^2',
    'x^2(x+1)',
    'x^2 2',
    '|x|',
    '|-2|',
    '|x+1|',
    '2|x|',
    '|x||y|',
    '|x|sin(x)',
    'x|x|'
];

const tok = new Tokenizer();
for (const c of cases) {
    try {
        const tokens = tok.tokenize(c);
        const ast = new PrattParser(c).parseExpression();
        console.log(`PASS: "${c}" ->`, JSON.stringify(ast));
    } catch (e: any) {
        console.log(`FAIL: "${c}" ->`, e.message);
    }
}
