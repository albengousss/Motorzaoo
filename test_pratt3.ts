import { PrattParser } from './src/core/prattParser.ts';
try {
    console.log(JSON.stringify(new PrattParser("(Determinant())-()").parseExpression()));
} catch(e) {
    console.log("ERROR", e.message);
}
