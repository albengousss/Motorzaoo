const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const s1 = "            const ast = new PrattParser(expressaoPlot).parseExpression();";
const s2 = "                const evalFunc = MathEngine.compile(ast);";
const s3 = "            } else {n                ExpressionManager.setResult(item.id, '');n            }";

const idx1 = code.indexOf(s1);
const idx3 = code.indexOf(s3, idx1);

if (idx1 !== -1 && idx3 !== -1) {
    const endIdx = idx3 + s3.length;
    const oldBlock = code.substring(idx1, endIdx);
    
    const replacement = `            const ast = new PrattParser(expressaoPlot).parseExpression();

            if (!isPlot && !isImplicit && !isDerivativePlot && !isExplicitY) {
                const evalFunc = MathEngine.compile(ast);
                const val = evalFunc(0, 0, StateManager.values);
                if (!isNaN(val)) ExpressionManager.setResult(item.id, '= ' + parseFloat(val.toFixed(4)).toString());
                else ExpressionManager.setResult(item.id, '');
                return; 
            }`;
            
    code = code.replace(oldBlock, replacement);
    fs.writeFileSync('src/main.ts', code);
    console.log("Fixed manually.");
} else {
    console.log("Not found.");
}
