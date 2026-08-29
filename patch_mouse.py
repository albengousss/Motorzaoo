import sys
import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

helper_code = '''
function getClosestCurvePoint(pixelX: number, pixelY: number, maxDist: number = 15): { mathX: number, mathY: number, px: number, py: number, color: string, dist: number } | null {
    let closest: any = null;
    let minDist = maxDist;
    const mathX = Camera.toMathX(pixelX);
    const mathY = Camera.toMathY(pixelY);

    // 1. Explicit Curves
    for (const curve of renderMemory_curves) {
        const y = curve.f(mathX);
        if (isNaN(y)) continue;
        const py = Camera.toPixelY(y);
        const dist = Math.abs(pixelY - py);
        if (dist < minDist) {
            minDist = dist;
            closest = { mathX, mathY: y, px: pixelX, py, color: curve.color, dist };
        }
    }

    // 2. Implicit Segments
    for (const seg of renderMemory_segments) {
        const px1 = Camera.toPixelX(seg.x1);
        const py1 = Camera.toPixelY(seg.y1);
        const px2 = Camera.toPixelX(seg.x2);
        const py2 = Camera.toPixelY(seg.y2);
        
        const l2 = (px1 - px2)**2 + (py1 - py2)**2;
        let t = 0;
        if (l2 !== 0) t = Math.max(0, Math.min(1, ((pixelX - px1) * (px2 - px1) + (pixelY - py1) * (py2 - py1)) / l2));
        
        const projX = px1 + t * (px2 - px1);
        const projY = py1 + t * (py2 - py1);
        const dist = Math.hypot(pixelX - projX, pixelY - projY);
        
        if (dist < minDist) {
            minDist = dist;
            closest = { mathX: Camera.toMathX(projX), mathY: Camera.toMathY(projY), px: projX, py: projY, color: seg.color, dist };
        }
    }
    
    // 3. ODE / Parametric Curves
    for (const cp of renderMemory_curve_points) {
        for (let i = 0; i < cp.points.length - 1; i++) {
            const p1 = cp.points[i];
            const p2 = cp.points[i+1];
            if (isNaN(p1.y) || isNaN(p2.y)) continue;
            
            const px1 = Camera.toPixelX(p1.x);
            const py1 = Camera.toPixelY(p1.y);
            const px2 = Camera.toPixelX(p2.x);
            const py2 = Camera.toPixelY(p2.y);
            
            const l2 = (px1 - px2)**2 + (py1 - py2)**2;
            let t = 0;
            if (l2 !== 0) t = Math.max(0, Math.min(1, ((pixelX - px1) * (px2 - px1) + (pixelY - py1) * (py2 - py1)) / l2));
            
            const projX = px1 + t * (px2 - px1);
            const projY = py1 + t * (py2 - py1);
            const dist = Math.hypot(pixelX - projX, pixelY - projY);
            
            if (dist < minDist) {
                minDist = dist;
                closest = { mathX: Camera.toMathX(projX), mathY: Camera.toMathY(projY), px: projX, py: projY, color: cp.color, dist };
            }
        }
    }
    return closest;
}

canvasEl.addEventListener('mousedown', (e) => { 
    isDragging = true; 
    isTracing = false;
    lastX = e.clientX; 
    lastY = e.clientY; 
    
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const closest = getClosestCurvePoint(mx, my, 15);
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
        document.body.style.cursor = 'crosshair';
        
        globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
        drawFrame();
    } else {
        tooltip.style.display = 'none'; 
    }
});

window.addEventListener('mouseup', () => { 
    isDragging = false; 
    isTracing = false;
    if (globalTracePoint) {
        globalTracePoint = null;
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        drawFrame();
    }
});

canvasEl.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    const coordsEl = document.getElementById('cursor-coords');
    if (coordsEl) {
        const mathX = Camera.toMathX(mouseX);
        const mathY = Camera.toMathY(mouseY);
        coordsEl.innerText = `${mathX.toFixed(3)}, ${mathY.toFixed(3)}`;
    }

    if (isShiftDown) {
        const oldX = hoverX; const oldY = hoverY;
        updateHover();
        if (oldX !== hoverX || oldY !== hoverY) drawFrame();
    }

    if (isDragging) {
        Camera.pan(e.clientX - lastX, e.clientY - lastY);
        drawFrame();
    } else if (isTracing) {
        // Find closest point with a large maxDist to lock onto the curve
        const closest = getClosestCurvePoint(mouseX, mouseY, 2000);
        if (closest) {
            const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
            tooltip.innerText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + closest.px) + 'px';
            tooltip.style.top = (rect.top + closest.py - 10) + 'px';
            tooltip.style.backgroundColor = closest.color;
            tooltip.style.color = '#fff';
            document.body.style.cursor = 'crosshair';
            
            globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
            drawFrame();
        }
    } else {
        let foundCollision = false;
        let snapPixelX = 0; let snapPixelY = 0;
        let labelText = '';

        const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();

        for (const p of renderMemory_points) {
            const px = Camera.toPixelX(p.mathX);
            const py = Camera.toPixelY(p.mathY);
            const dist = Math.hypot(mouseX - px, mouseY - py); 
            
            if (dist < 12) { 
                foundCollision = true;
                snapPixelX = px; snapPixelY = py;
                labelText = `(${formatCoord(p.mathX)}, ${formatCoord(p.mathY)})`;
                break;
            }
        }

        if (!foundCollision) {
            const closest = getClosestCurvePoint(mouseX, mouseY, 15);
            if (closest) {
                foundCollision = true;
                snapPixelX = closest.px; snapPixelY = closest.py;
                labelText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            }
        }

        if (foundCollision) {
            tooltip.innerText = labelText;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + snapPixelX) + 'px';
            tooltip.style.top = (rect.top + snapPixelY - 10) + 'px';
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            document.body.style.cursor = 'crosshair';
        } else {
            tooltip.style.display = 'none';
            document.body.style.cursor = 'default';
        }
    }
    lastX = e.clientX; lastY = e.clientY;
});
'''

pattern = r"canvasEl\.addEventListener\('mousedown', \(e\) => \{ isDragging = true; lastX = e\.clientX; lastY = e\.clientY; tooltip\.style\.display = 'none'; \}\);\nwindow\.addEventListener\('mouseup', \(\) => isDragging = false\);\n\ncanvasEl\.addEventListener\('mousemove', \(e\) => \{.*?\n    lastX = e\.clientX; lastY = e\.clientY;\n\}\);"

content = re.sub(pattern, helper_code, content, flags=re.DOTALL)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)
