import os

with open('src/main.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'if (!nonPlottingCmds.includes(cmdName) && !isJustNumber && !isListOrMatrix) {' in line:
        start_idx = i
    if 'ExpressionManager.setResult(item.id, `= ${cleanResult}`);' in line and start_idx != -1:
        # Wait, there are two of these. We want the one inside the else block
        if '} else {' in lines[i-1]:
            end_idx = i + 1
            break

if start_idx != -1 and end_idx != -1:
    new_block = '''                                    if (!nonPlottingCmds.includes(cmdName) && !isJustNumber && !isListOrMatrix) {
                                        if (assignTarget && assignTarget.includes('(')) {
                                            fname = assignTarget.split('(')[0].replace(/[\\{\\}\\\\]/g, '');
                                            extractVar = assignTarget.split('(')[1].replace(')', '').replace(/[\\{\\}\\\\]/g, '');
                                        } else if (assignTarget) {
                                            fname = assignTarget.replace(/[\\{\\}\\\\]/g, '');
                                        } else {
                                            idx = StateManager.casSolutions[item.id]?.index ?? StateManager.getNextFuncIndex();
                                            fname = `f_{${idx}}`;
                                            
                                            if (cmdName === 'integral' && cmdArgs.split(',').length <= 2) {
                                                const cName = `C_{${idx}}`;
                                                if (!cleanResult.includes(cName)) {
                                                    cleanResult += ` + ${cName}`;
                                                }
                                                if (!StateManager.values.hasOwnProperty(cName)) {
                                                    StateManager.values[cName] = 0;
                                                    ExpressionManager.addExpression(`${cName} = 0`);
                                                }
                                            }
                                        }
                                    }
                                } catch(e) {}

                                let resAst = null;
                                if (!cleanResult.includes('Erro')) {
                                    try {
                                        let parseableResult = cleanResult;
                                        const arrowMatch = cleanResult.match(/^(?:\\(?[a-zA-Z_]+\\)?\\s*->\\s*)(.*)/);
                                        if (arrowMatch) parseableResult = arrowMatch[1];
                                        resAst = new PrattParser(parseableResult).parseExpression();
                                    } catch (e) {
                                        resAst = ast;
                                    }
                                }

                                let spawnedId = StateManager.casSolutions[item.id]?.spawnedBlockId;

                                if (fname && !assignTarget) {
                                    const expressionStr = `${fname}(${extractVar}) = ${cleanResult}`;
                                    if (spawnedId && document.getElementById(spawnedId)) {
                                        ExpressionManager.updateExpression(spawnedId, expressionStr);
                                    } else {
                                        spawnedId = ExpressionManager.addExpression(expressionStr);
                                    }
                                    ExpressionManager.setResult(item.id, '');
                                } else if (assignTarget && assignTarget.includes('(')) {
                                    ExpressionManager.setResult(item.id, `= ${cleanResult}`);
                                } else {
                                    ExpressionManager.setResult(item.id, `= ${cleanResult}`);
                                }

                                StateManager.casSolutions[item.id] = { query: currentQuery, result: cleanResult, ast: resAst, name: fname, variable: extractVar, index: idx, spawnedBlockId: spawnedId };
'''
    lines = lines[:start_idx] + [new_block] + lines[end_idx:]
    with open('src/main.ts', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("SUCCESS")
else:
    print(f"FAILED {start_idx} {end_idx}")
