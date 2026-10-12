import { Tokenizer } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';

console.log('--- TEST x^{2}(x+1) ---');
const t1 = new Tokenizer().tokenize('x^{2}(x+1)');
console.log('x^{2}(x+1) tokens:', t1);
try {
    const p1 = new PrattParser('x^{2}(x+1)').parseExpression();
    console.log('x^{2}(x+1) AST:', JSON.stringify(p1));
} catch (e: any) {
    console.error('Error:', e.message);
}

const t2 = new Tokenizer().tokenize('x^2(x+1)');
console.log('x^2(x+1) tokens:', t2);
