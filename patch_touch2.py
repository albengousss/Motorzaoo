import sys

with open('src/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

helper_code = '''canvasEl.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Impede scroll natural na tela
    if (e.touches.length === 1) {
        isDragging = true;
        isTracing = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        
        const rect = canvasEl.getBoundingClientRect();
        const mx = lastX - rect.left;
        const my = lastY - rect.top;
        
        const closest = getClosestCurvePoint(mx, my, 25);
        if (closest) {
            isTracing = true;
            isDragging = false;
            
            const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
            tooltip.innerText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + closest.px) + 'px';
            tooltip.style.top = (rect.top + closest.py - 10) + 'px';
            tooltip.style.backgroundColor = closest.color;
            tooltip.style.color = '#fff';
            
            globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
            drawFrame();
        } else {
            tooltip.style.display = 'none';
        }
    } else if (e.touches.length === 2) {
        isDragging = false;
        isTracing = false;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
}, {passive: false});

canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    if (isTracing && e.touches.length === 1) {
        const mx = e.touches[0].clientX - rect.left;
        const my = e.touches[0].clientY - rect.top;
        
        const closest = getClosestCurvePoint(mx, my, 2000);
        if (closest) {
            const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
            tooltip.innerText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + closest.px) + 'px';
            tooltip.style.top = (rect.top + closest.py - 10) + 'px';
            tooltip.style.backgroundColor = closest.color;
            tooltip.style.color = '#fff';
            
            globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
            drawFrame();
        }
        return;
    }

    if (e.touches.length === 1 && isDragging) {'''

old_touch = '''canvasEl.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Impede scroll natural na tela
    if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        tooltip.style.display = 'none';
    } else if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
}, {passive: false});

canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    if (e.touches.length === 1 && isDragging) {'''

content = content.replace(old_touch.replace('\n', '\r\n'), helper_code.replace('\n', '\r\n'))
content = content.replace(old_touch, helper_code)

touchend_old = '''canvasEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = -1;
    if (e.touches.length === 0) isDragging = false;
});'''

touchend_new = '''canvasEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = -1;
    if (e.touches.length === 0) {
        isDragging = false;
        isTracing = false;
        if (globalTracePoint) {
            globalTracePoint = null;
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            drawFrame();
        }
        tooltip.style.display = 'none';
    }
});'''

content = content.replace(touchend_old.replace('\n', '\r\n'), touchend_new.replace('\n', '\r\n'))
content = content.replace(touchend_old, touchend_new)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)
