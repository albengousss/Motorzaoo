import { Camera } from './camera';
import { StateManager } from '../core/stateManager';

export class Renderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    showGrid: boolean = true;
    showAxes: boolean = true;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!; 
    }

    // Lê o tamanho do container CSS e aplica na resolução interna do Canvas com densidade de pixel correta
    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            const dpr = window.devicePixelRatio || 1;
            const rect = parent.getBoundingClientRect();
            
            // O tamanho lógico (CSS)
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            
            // O tamanho físico (Pixels reais)
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            
            // Normaliza o contexto para não termos que multiplicar tudo por dpr depois
            this.ctx.resetTransform();
            this.ctx.scale(dpr, dpr);
            
            // Comunica a câmera para ela arrumar a proporção (usando tamanho lógico)!
            Camera.resize(rect.width, rect.height);
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, Camera.width, Camera.height);
    }

	drawArea(points: {x: number, y: number}[], color: string = '#2d70b3') {
        if (points.length < 2) return;
        
        this.ctx.fillStyle = color + '40'; // Adiciona 25% de opacidade na cor
        this.ctx.beginPath();
        
        // Começa na base (y=0) do primeiro ponto
        const startX = Camera.toPixelX(points[0].x);
        const zeroY = Camera.toPixelY(0);
        this.ctx.moveTo(startX, zeroY);

        for (let i = 0; i < points.length; i++) {
            if (!isNaN(points[i].y)) {
                this.ctx.lineTo(Camera.toPixelX(points[i].x), Camera.toPixelY(points[i].y));
            }
        }

        // Desce para a base (y=0) do último ponto
        const endX = Camera.toPixelX(points[points.length - 1].x);
        this.ctx.lineTo(endX, zeroY);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Pinta a borda sólida por cima do preenchimento
        this.drawCurve(points, color);
    }

    drawPolygon(points: { x: number, y: number }[], color: string = '#2d70b3') {
        if (!points || points.length < 3) return;
        this.ctx.fillStyle = color + '40'; // 25% opacity
        this.ctx.beginPath();
        const startX = Camera.toPixelX(points[0].x);
        const startY = Camera.toPixelY(points[0].y);
        this.ctx.moveTo(startX, startY);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(Camera.toPixelX(points[i].x), Camera.toPixelY(points[i].y));
        }
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawSegments(segments: {x1:number, y1:number, x2:number, y2:number}[], color: string = '#2d70b3') {
        if (segments.length === 0) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        // Pinta todos os fragmentos gerados pelo Marching Squares
        segments.forEach(seg => {
            this.ctx.moveTo(Camera.toPixelX(seg.x1), Camera.toPixelY(seg.y1));
            this.ctx.lineTo(Camera.toPixelX(seg.x2), Camera.toPixelY(seg.y2));
        });
        
        this.ctx.stroke();
    }

    drawAxes(hoverX: boolean = false, hoverY: boolean = false) {
        const rangeX = Camera.xMax - Camera.xMin;
        const rangeY = Camera.yMax - Camera.yMin;

        // Calcula a escala de cada eixo independentemente para manter marcações perfeitas em qualquer proporção
        const calcStep = (range: number) => {
            const rawStep = range / 10;
            const mag = Math.floor(Math.log10(rawStep));
            const magPow = Math.pow(10, mag);
            let step = magPow;
            if (rawStep > 5 * magPow) step = 5 * magPow;
            else if (rawStep > 2 * magPow) step = 2 * magPow;
            return step;
        };

        const stepX = (StateManager.xStep && StateManager.xStep > 0) ? StateManager.xStep : calcStep(rangeX);
        const stepY = (StateManager.yStep && StateManager.yStep > 0) ? StateManager.yStep : calcStep(rangeY);

        // Usar Camera.width/height (dimensões LÓGICAS)
        const W = Camera.width;
        const H = Camera.height;

        const isProjector = StateManager.projectorMode;
        this.ctx.font = isProjector ? 'bold 14px Arial' : '12px Arial';
        this.ctx.fillStyle = isProjector ? '#222' : '#666';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        const axisWidth = isProjector ? 3 : 2;
        const gridColor = isProjector ? '#c8c8c8' : '#e0e0e0';
        const gridWidth = isProjector ? 1.5 : 1;
        const showAxes = this.showAxes && StateManager.showAxes;
        const showGrid = this.showGrid && StateManager.gridType !== 'none';
        const isPolar = StateManager.gridType === 'polar';

        let zeroY = Camera.toPixelY(0);
        if (zeroY < 20) zeroY = 20; 
        if (zeroY > H - 20) zeroY = H - 20;

        let zeroX = Camera.toPixelX(0);
        if (zeroX < 20) zeroX = 20;
        if (zeroX > W - 20) zeroX = W - 20;

        // 1. Grelha Polar (se ativada)
        if (showGrid && isPolar) {
            const centerX = Camera.toPixelX(0);
            const centerY = Camera.toPixelY(0);
            const maxRadiusMath = Math.hypot(
                Math.max(Math.abs(Camera.xMin), Math.abs(Camera.xMax)),
                Math.max(Math.abs(Camera.yMin), Math.abs(Camera.yMax))
            );
            this.ctx.strokeStyle = gridColor;
            this.ctx.lineWidth = gridWidth;

            // Círculos concêntricos a cada stepX
            for (let r = stepX; r <= maxRadiusMath * 1.25; r += stepX) {
                const pxRadius = (r / (Camera.xMax - Camera.xMin)) * W;
                if (pxRadius <= 0) continue;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, pxRadius, 0, 2 * Math.PI);
                this.ctx.stroke();

                if (showAxes && r <= Camera.xMax) {
                    const px = Camera.toPixelX(r);
                    this.ctx.fillStyle = isProjector ? '#222' : '#666';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'top';
                    this.ctx.fillText(parseFloat(r.toFixed(4)).toString(), px, zeroY + 5);
                }
            }

            // Raios angulares a cada 15 graus
            const rayLength = Math.hypot(W, H) * 1.5;
            for (let deg = 0; deg < 360; deg += 15) {
                const rad = (deg * Math.PI) / 180;
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, centerY);
                this.ctx.lineTo(centerX + Math.cos(rad) * rayLength, centerY - Math.sin(rad) * rayLength);
                this.ctx.stroke();
            }
        }

        // 2. Grelha Cartesiana e Eixo X
        const startX = Math.ceil(Camera.xMin / stepX) * stepX;
        for (let x = startX; x <= Camera.xMax; x += stepX) {
            const px = Camera.toPixelX(x);
            const isAxis = Math.abs(x) < 1e-10;
            if ((isAxis && showAxes) || (!isAxis && showGrid && !isPolar)) {
                this.ctx.beginPath();
                this.ctx.moveTo(px, 0);
                this.ctx.lineTo(px, H);
                
                if (isAxis) {
                    this.ctx.strokeStyle = hoverY ? '#2d70b3' : '#000';
                    this.ctx.lineWidth = hoverY ? (axisWidth + 1) : axisWidth;
                } else {
                    this.ctx.strokeStyle = gridColor;
                    this.ctx.lineWidth = gridWidth;
                }
                this.ctx.stroke();

                if (!isAxis && showAxes) {
                    const numStr = parseFloat(x.toFixed(4)).toString();
                    this.ctx.fillStyle = isProjector ? '#222' : '#666';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'top';
                    this.ctx.fillText(numStr, px, zeroY + 5);
                }
            }
        }

        // 3. Grelha Cartesiana e Eixo Y
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        const startY = Math.ceil(Camera.yMin / stepY) * stepY;
        for (let y = startY; y <= Camera.yMax; y += stepY) {
            const py = Camera.toPixelY(y);
            const isAxis = Math.abs(y) < 1e-10;
            if ((isAxis && showAxes) || (!isAxis && showGrid && !isPolar)) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, py);
                this.ctx.lineTo(W, py);
                
                if (isAxis) {
                    this.ctx.strokeStyle = hoverX ? '#2d70b3' : '#000';
                    this.ctx.lineWidth = hoverX ? (axisWidth + 1) : axisWidth;
                } else {
                    this.ctx.strokeStyle = gridColor;
                    this.ctx.lineWidth = gridWidth;
                }
                this.ctx.stroke();

                if (!isAxis && showAxes) {
                    const numStr = parseFloat(y.toFixed(4)).toString();
                    this.ctx.fillStyle = isProjector ? '#222' : '#666';
                    this.ctx.textAlign = 'right';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(numStr, zeroX - 5, py);
                }
            }
        }

        // 4. Setas nos Eixos (se ativadas)
        if (showAxes && StateManager.showArrows) {
            this.ctx.fillStyle = '#000';
            // Seta no Eixo X (apontando para a direita)
            if (zeroY >= 0 && zeroY <= H) {
                this.ctx.beginPath();
                this.ctx.moveTo(W - 4, zeroY);
                this.ctx.lineTo(W - 14, zeroY - 5);
                this.ctx.lineTo(W - 14, zeroY + 5);
                this.ctx.closePath();
                this.ctx.fill();
            }
            // Seta no Eixo Y (apontando para cima)
            if (zeroX >= 0 && zeroX <= W) {
                this.ctx.beginPath();
                this.ctx.moveTo(zeroX, 4);
                this.ctx.lineTo(zeroX - 5, 14);
                this.ctx.lineTo(zeroX + 5, 14);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }

        // 5. Legendas dos Eixos X e Y
        if (showAxes) {
            this.ctx.fillStyle = isProjector ? '#111' : '#444';
            this.ctx.font = isProjector ? 'bold 13px Arial' : 'italic 12px Arial';
            if (StateManager.xLabel && StateManager.xLabel.trim()) {
                this.ctx.textAlign = 'right';
                this.ctx.textBaseline = 'bottom';
                this.ctx.fillText(StateManager.xLabel, W - 18, zeroY - 6);
            }
            if (StateManager.yLabel && StateManager.yLabel.trim()) {
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(StateManager.yLabel, zeroX + 8, 16);
            }
        }
    }

    drawDiscretePoint(x: number, y: number, color: string, label?: string) {
        const px = Camera.toPixelX(x);
        const py = Camera.toPixelY(y);
        if (px < -20 || px > Camera.width + 20 || py < -20 || py > Camera.height + 20) return;

        this.ctx.beginPath();
        this.ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();

        if (label) {
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.fillStyle = '#333';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(label, px + 8, py - 4);
        }
    }

    drawPoints(points: {x: number, y: number}[], color: string) {
        if (points.length === 0) return;
        const W = Camera.width;
        const H = Camera.height;
        
        points.forEach(p => {
            const px = Camera.toPixelX(p.x);
            const py = Camera.toPixelY(p.y);
            
            // Usa dimensões lógicas (Camera) em vez de físicas (canvas.*) — fix DPR
            if (px < -10 || px > W + 10 || py < -10 || py > H + 10) return;

            this.ctx.beginPath();
            this.ctx.arc(px, py, 4.5, 0, Math.PI * 2);
            
            this.ctx.fillStyle = '#e8e8e8';
            this.ctx.fill();
            
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeStyle = color;
            this.ctx.stroke();
        });
    }

    drawNotablePoint(p: { x: number, y: number, color?: string, isHovered?: boolean, type?: string }) {
        const px = Camera.toPixelX(p.x);
        const py = Camera.toPixelY(p.y);
        const W = Camera.width;
        const H = Camera.height;
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) return;

        const color = p.color || '#2d70b3';

        if (p.isHovered) {
            // Halo / Glow
            this.ctx.beginPath();
            this.ctx.arc(px, py, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = color + '33';
            this.ctx.fill();

            // Ponto central em destaque
            this.ctx.beginPath();
            this.ctx.arc(px, py, 6, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.lineWidth = 2.5;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.stroke();
        } else {
            // Ponto discreto com visual limpo do Desmos
            this.ctx.beginPath();
            this.ctx.arc(px, py, 4.5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#f8fafc';
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = color;
            this.ctx.stroke();
        }
    }

    drawPinnedPointBadge(p: { x: number, y: number, text: string, color: string, type?: string, showTangent?: boolean, slope?: number }) {
        const px = Camera.toPixelX(p.x);
        const py = Camera.toPixelY(p.y);
        const W = Camera.width;
        const H = Camera.height;

        // Se tiver tangente ativada, desenha a reta tangente no gráfico!
        if (p.showTangent && typeof p.slope === 'number' && isFinite(p.slope)) {
            this.ctx.save();
            this.ctx.strokeStyle = p.color;
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([6, 4]);

            const m = p.slope;
            const x1 = Camera.xMin;
            const y1 = p.y + m * (x1 - p.x);
            const x2 = Camera.xMax;
            const y2 = p.y + m * (x2 - p.x);

            const px1 = Camera.toPixelX(x1);
            const py1 = Camera.toPixelY(y1);
            const px2 = Camera.toPixelX(x2);
            const py2 = Camera.toPixelY(y2);

            this.ctx.beginPath();
            this.ctx.moveTo(px1, py1);
            this.ctx.lineTo(px2, py2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        if (px < -40 || px > W + 40 || py < -40 || py > H + 40) return;

        // Desenha ponto ancorado fixo
        this.ctx.beginPath();
        this.ctx.arc(px, py, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.fill();
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();

        // Caixa da etiqueta (Badge flutuante estilo Desmos)
        this.ctx.font = 'bold 12px sans-serif';
        const metrics = this.ctx.measureText(p.text);
        const textWidth = metrics.width;
        const paddingX = 8;
        const badgeWidth = textWidth + paddingX * 2;
        const badgeHeight = 22;

        let badgeX = px - badgeWidth / 2;
        let badgeY = py - 32;

        // Evita sair dos limites da tela
        if (badgeX < 10) badgeX = 10;
        if (badgeX + badgeWidth > W - 10) badgeX = W - badgeWidth - 10;
        if (badgeY < 10) badgeY = py + 12;

        this.ctx.save();
        // Sombra suave
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 2;

        // Fundo do badge
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.beginPath();
        this.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
        this.ctx.fill();

        // Borda sutil na cor da curva
        this.ctx.shadowColor = 'transparent';
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Texto
        this.ctx.fillStyle = '#1e293b';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(p.text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
        this.ctx.restore();
    }

    private roundRect(x: number, y: number, w: number, h: number, r: number) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.arcTo(x + w, y, x + w, y + h, r);
        this.ctx.arcTo(x + w, y + h, x, y + h, r);
        this.ctx.arcTo(x, y + h, x, y, r);
        this.ctx.arcTo(x, y, x + w, y, r);
        this.ctx.closePath();
    }

    // Aceita cor, estilo de linha (sólida, tracejada, pontilhada) e espessura
    drawCurve(
        points: {x: number, y: number}[], 
        color: string = '#2d70b3', 
        lineStyle: 'solid' | 'dashed' | 'dotted' = 'solid', 
        lineWidth: number = 2
    ) {
        if (points.length === 0) return;
        
        this.ctx.strokeStyle = color; 
        const effectiveLineWidth = StateManager.projectorMode ? (lineWidth * 1.4) : lineWidth;
        this.ctx.lineWidth = effectiveLineWidth;

        if (lineStyle === 'dashed') {
            this.ctx.setLineDash([8, 6]);
        } else if (lineStyle === 'dotted') {
            this.ctx.setLineDash([2.5, 4]);
        } else {
            this.ctx.setLineDash([]);
        }

        this.ctx.beginPath();
        let levantarPincel = true;
        let prevY = 0;
        let prevPy = 0;

        for (let i = 0; i < points.length; i++) {
            // Se o ponto contiver NaN ou Infinity, levantamos o pincel.
            if (isNaN(points[i].y) || isNaN(points[i].x) || !isFinite(points[i].x) || !isFinite(points[i].y)) {
                levantarPincel = true;
                continue;
            }

            const px = Camera.toPixelX(points[i].x);
            const py = Camera.toPixelY(points[i].y);

            // Detecção de assíntota vertical: se houver salto enorme na tela com mudança brusca de sinal
            if (!levantarPincel) {
                const deltaPy = Math.abs(py - prevPy);
                const screenH = Camera.height;
                const signChanged = (points[i].y * prevY < 0);
                if (deltaPy > screenH * 0.75 && (signChanged || deltaPy > screenH * 1.5)) {
                    levantarPincel = true;
                }
            }

            if (levantarPincel) {
                this.ctx.moveTo(px, py);
                levantarPincel = false;
            } else {
                this.ctx.lineTo(px, py);
            }
            prevY = points[i].y;
            prevPy = py;
        }
        
        this.ctx.stroke(); 
        this.ctx.setLineDash([]);
    }
    drawFills(fills: {x:number, y:number, w:number, h:number}[], color: string = '#2d70b3') {
        if (fills.length === 0) return;
        
        this.ctx.fillStyle = color + '40'; // O '40' no hex significa 25% de opacidade
        this.ctx.beginPath();
        
        fills.forEach(f => {
            const px = Camera.toPixelX(f.x);
            const py = Camera.toPixelY(f.y + f.h); // Y inverte no canvas (cima é zero)
            const pw = Camera.toPixelX(f.x + f.w) - px;
            const ph = Camera.toPixelY(f.y) - py;
            this.ctx.rect(px, py, pw, ph);
        });
        
        this.ctx.fill();
    }

    
    drawSlopeField(f: (x: number, y: number, scope: any) => number, scope: any, color: string = '#2d70b3') {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();

        const xMin = Camera.xMin;
        const xMax = Camera.xMax;
        const yMin = Camera.yMin;
        const yMax = Camera.yMax;

        const cols = 40;
        const rows = 40;
        const dx = (xMax - xMin) / cols;
        const dy = (yMax - yMin) / rows;

        const lengthMultiplier = Math.min(
            Math.abs(Camera.toPixelX(xMin + dx) - Camera.toPixelX(xMin)),
            Math.abs(Camera.toPixelY(yMin + dy) - Camera.toPixelY(yMin))
        ) * 0.35; // 35% of grid cell size

        const scaleX = Camera.width / Math.max(1e-9, xMax - xMin);
        const scaleY = Camera.height / Math.max(1e-9, yMax - yMin);

        for (let i = 0; i <= cols; i++) {
            for (let j = 0; j <= rows; j++) {
                const x = xMin + i * dx;
                const y = yMin + j * dy;

                const m = f(x, y, scope);
                if (isNaN(m) || !isFinite(m)) continue;

                // Converte inclinação matemática (mundo) para ângulo visual exato na tela (pixels)
                const angle = Math.atan2(m * scaleY, scaleX);
                const ux = Math.cos(angle);
                const uy = Math.sin(angle);

                const px = Camera.toPixelX(x);
                const py = Camera.toPixelY(y);

                const lineHalfX = ux * lengthMultiplier;
                const lineHalfY = uy * lengthMultiplier;

                this.ctx.moveTo(px - lineHalfX, py + lineHalfY); 
                this.ctx.lineTo(px + lineHalfX, py - lineHalfY); 
            }
        }
        
        this.ctx.stroke();
    }
}