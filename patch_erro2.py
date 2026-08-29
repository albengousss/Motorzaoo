import os
import re

file_path = 'src/main.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# For genericCasMatch, if args are empty, don't show an error, show a placeholder
# currentQuery = assignTarget ? `${assignTarget}=${cmdName}(${cmdArgs})` : `${cmdName}(${cmdArgs})`;
# Replace in the genericCasMatch area
content = content.replace(
    "const currentQuery = assignTarget ? `${assignTarget}=${cmdName}(${cmdArgs})` : `${cmdName}(${cmdArgs})`;",
    "const currentQuery = assignTarget ? `${assignTarget}=${cmdName}(${cmdArgs})` : `${cmdName}(${cmdArgs})`;\n                    if (cmdArgs.trim() === '') {\n                        ExpressionManager.setResult(item.id, '');\n                        return;\n                    }"
)

# Also fix the ODE matcher
# const solveMatch = noSpaceStr.match(/^(?:solveode|resolvere|resolveredo|edo)\((.+)\)$/i);
# (This one already requires (.+) so it won't match empty parens!)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched main.ts again")
