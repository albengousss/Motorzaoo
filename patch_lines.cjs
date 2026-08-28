const fs = require('fs');
let lines = fs.readFileSync('src/main.ts', 'utf8').split('n');

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const ast = new PrattParser(expressaoPlot).parseExpression();')) {
        start = i;
    }
    if (start !== -1 && i > start && lines[i].includes('} else {')) {
        end = i + 2;
        break;
    }
}

if (start !== -1 && end !== -1) {
    const replacement = `
            const giacVars = Object.keys(StateManager.giacDefinitions);
            const isMatrixArithmetic = expressaoPlot.includes('{') || expressaoPlot.includes('[');
            const hasGiacVar = giacVars.some(v => new RegExp('\\b' + v + '\\b').test(expressaoPlot)) && !StateManager.values.hasOwnProperty(expressaoPlot);
            
            // MODO CALCULADORA (Sem gráficos)
            const isPlot = expressaoPlot.includes('x') || expressaoPlot.includes('y');
            
            if (!isPlot && !isImplicit && !isDerivativePlot && !isExplicitY) {
                if (hasGiacVar || isMatrixArithmetic) {
                    const currentQuery = expressaoPlot;
                    const cached = StateManager.casSolutions[item.id];
                    if (cached && cached.query === currentQuery) {
                        ExpressionManager.setResult(item.id, `= ${cached.result}`);
                    } else if (!StateManager.pendingCas[item.id]) {
                        ExpressionManager.setResult(item.id, 'Calculando...');
                        StateManager.pendingCas[item.id] = true;
                        
                        let giacQuery = prefixGiac(expressaoPlot).replace(/left{/g, '[').replace(/right}/g, ']')
                                         .replace(/{/g, '[').replace(/}/g, ']')
                                         .replace(/left[/g, '[').replace(/right]/g, ']');
                        giacQuery = giacQuery.replace(/]s*[/g, '],[');

                        MathEngine.askGiac(giacQuery).then(res => {
                            StateManager.pendingCas[item.id] = false;
                            let formattedRes = res.replace(/"/g, '').replace(/list[/g, '[').replace(/usr_/g, '');
                            if (formattedRes.includes('Erro') || formattedRes.includes('undef')) {
                                formattedRes = 'Erro no cálculo';
                            }
                            StateManager.casSolutions[item.id] = { query: currentQuery, result: formattedRes, ast: null };
                            ExpressionManager.setResult(item.id, `= ${formattedRes}`);
                            drawFrame();
                        });
                    }
                    return;
                }
            }

            // MODO GRÁFICO (Simplificar com Giac se tiver matriz/variáveis do CAS)
            if (hasGiacVar || isMatrixArithmetic) {
                const cached = StateManager.casSolutions[item.id + "_plot"];
                if (cached && cached.query === expressaoPlot) {
                    expressaoPlot = cached.result;
                    // Extrair matrizes 1x1 ou resultados escalar: ex: [[x^2]] -> x^2
                    if (expressaoPlot.startsWith('[[') && expressaoPlot.endsWith(']]') && !expressaoPlot.substring(2, expressaoPlot.length - 2).includes('[')) {
                        expressaoPlot = expressaoPlot.substring(2, expressaoPlot.length - 2);
                    } else if (expressaoPlot.startsWith('[') && expressaoPlot.endsWith(']') && !expressaoPlot.substring(1, expressaoPlot.length - 1).includes('[')) {
                        expressaoPlot = expressaoPlot.substring(1, expressaoPlot.length - 1);
                    }
                } else {
                    if (!StateManager.pendingCas[item.id + "_plot"]) {
                        StateManager.pendingCas[item.id + "_plot"] = true;
                        let giacQuery = prefixGiac(expressaoPlot).replace(/left{/g, '[').replace(/right}/g, ']')
                                         .replace(/{/g, '[').replace(/}/g, ']')
                                         .replace(/left[/g, '[').replace(/right]/g, ']');
                        giacQuery = giacQuery.replace(/]s*[/g, '],[');
                        MathEngine.askGiac("simplify(" + giacQuery + ")").then(res => {
                            StateManager.pendingCas[item.id + "_plot"] = false;
                            let formattedRes = res.replace(/"/g, '').replace(/list[/g, '[').replace(/usr_/g, '');
                            StateManager.casSolutions[item.id + "_plot"] = { query: expressaoPlot, result: formattedRes };
                            drawFrame();
                        });
                    }
                    return; // Aguarda o Giac calcular a versão simplificada
                }
            }
            
            const ast = new PrattParser(expressaoPlot).parseExpression();
            
            if (!isPlot && !isImplicit && !isDerivativePlot && !isExplicitY) {
                const evalFunc = MathEngine.compile(ast);
                const val = evalFunc(0, 0, StateManager.values);
                if (!isNaN(val)) ExpressionManager.setResult(item.id, '= ' + parseFloat(val.toFixed(4)).toString());
                else ExpressionManager.setResult(item.id, '');
                return; 
            } else {
                ExpressionManager.setResult(item.id, '');
            }`.split('n');

    lines.splice(start, end - start + 1, ...replacement);
    fs.writeFileSync('src/main.ts', lines.join('n'));
    console.log("Patched lines successfully.");
} else {
    console.log("Block not found.");
}
