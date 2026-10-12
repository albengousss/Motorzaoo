import { Tokenizer } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';

const expressions = ['2|x|', '|x||y|', '|x|sin(x)', 'x|x|', 'a x', 'a b', 'a sin(x)', 'x^2(x+1)', 'x^2 2'];
const tok = new Tokenizer();

for (const e of expressions) {
    console.log(`\nExpression: "${e}"`);
    console.log('Processed string in tokenizer:', (tok as any).string);
    const tokens = tok.tokenize(e);
    console.log('Tokens:', tokens);
    const parser = new PrattParser(e);
    const ast = parser.parseExpression();
    console.log('Parsed AST:', ast);
    console.log('Remaining lookahead after parseExpression():', parser.lookahead);
}
