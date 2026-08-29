import os
import re

file_path = 'src/main.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix genericCasMatch caching bug where '= Erro no cálculo' is displayed
# Line 297 is: ExpressionManager.setResult(item.id, `= ${cached.result}`);
content = content.replace(
    "ExpressionManager.setResult(item.id, `= ${cached.result}`);",
    "ExpressionManager.setResult(item.id, cached.result.includes('Erro') ? `- Erro no cálculo` : `= ${cached.result}`);"
)

# Line 396 and 397:
# StateManager.casSolutions[item.id] = { query: currentQuery, result: 'Erro no cálculo' };
# ExpressionManager.setResult(item.id, `Erro CAS`);
content = content.replace(
    "ExpressionManager.setResult(item.id, `Erro CAS`);",
    "ExpressionManager.setResult(item.id, `- Erro no cálculo`);"
)

# Line 690:
# formattedRes = 'Erro no cálculo';
# Line 694:
# ExpressionManager.setResult(item.id, `= ${formattedRes}`);
content = content.replace(
    "ExpressionManager.setResult(item.id, `= ${formattedRes}`);",
    "ExpressionManager.setResult(item.id, formattedRes.includes('Erro') ? `- Erro no cálculo` : `= ${formattedRes}`);"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched main.ts")
