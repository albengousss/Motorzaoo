import re
with open('src/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"canvasEl\.addEventListener\('touchstart', \(e\) => \{\n    e\.preventDefault\(\); // Impede scroll natural na tela\n    if \(e\.touches\.length === 1\) \{\n        isDragging = true;\n        lastX = e\.touches\[0\]\.clientX;\n        lastY = e\.touches\[0\]\.clientY;\n        tooltip\.style\.display = 'none';\n    \} else if \(e\.touches\.length === 2\) \{\n        isDragging = false;\n        initialPinchDistance = Math\.hypot\(\n            e\.touches\[0\]\.clientX - e\.touches\[1\]\.clientX,\n            e\.touches\[0\]\.clientY - e\.touches\[1\]\.clientY\n        \);\n    \}\n\}\);\n\ncanvasEl\.addEventListener\('touchmove', \(e\) => \{\n    e\.preventDefault\(\);\n    if \(isDragging && e\.touches\.length === 1\) \{\n        Camera\.pan\(e\.touches\[0\]\.clientX - lastX, e\.touches\[0\]\.clientY - lastY\);\n        lastX = e\.touches\[0\]\.clientX;\n        lastY = e\.touches\[0\]\.clientY;\n        drawFrame\(\);\n    \} else if \(e\.touches\.length === 2\) \{"
print(bool(re.search(pattern, content, flags=re.DOTALL)))
