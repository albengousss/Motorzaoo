import sys

with open('src/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize CRLF to LF for easy replacement
content = content.replace('\r\n', '\n')

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
        
        const closest = getClosestCurvePoint(mx, my, 25); // Maior leniência no touch
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
});

canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isTracing && e.touches.length === 1) {
        const rect = canvasEl.getBoundingClientRect();
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

    if (isDragging && e.touches.length === 1) {
        Camera.pan(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        drawFrame();
    } else if (e.touches.length === 2) {'''

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
});

canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isDragging && e.touches.length === 1) {
        Camera.pan(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        drawFrame();
    } else if (e.touches.length === 2) {'''

content = content.replace(old_touch, helper_code)

touchend_old = '''canvasEl.addEventListener('touchend', () => {
    isDragging = false;
    initialPinchDistance = -1;
});'''

touchend_new = '''canvasEl.addEventListener('touchend', () => {
    isDragging = false;
    isTracing = false;
    initialPinchDistance = -1;
    if (globalTracePoint) {
        globalTracePoint = null;
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        drawFrame();
    }
    tooltip.style.display = 'none';
});'''

content = content.replace(touchend_old, touchend_new)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)
