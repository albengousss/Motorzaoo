import { PrattParser } from "./src/core/prattParser";
try {
    const ast = new PrattParser("(Determinant())-()").parseExpression();
    console.log("NO ERROR", JSON.stringify(ast));
} catch(e) {
    console.log("ERROR", e.message);
}
