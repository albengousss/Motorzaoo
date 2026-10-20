import { Camera } from './camera';
import { StateManager } from '../core/stateManager';


function formatDesmosAxisNumber(val: number, isRad: boolean = false): string {
    if (Math.abs(val) < 1e-10) return '0';
    // Se o valor estiver no modo radianos ou for múltiplo de π/4, formatar simbolicamente
    const piRatio = val / Math.PI;
    const nearestQuarter = Math.round(piRatio * 4);
    if ((isRad || Math.abs(val % (Math.PI / 4)) < 1e-4) && Math.abs(piRatio * 4 - nearestQuarter) < 1e-4) {
        const sign = nearestQuarter < 0 ? '-' : '';
        const absQ = Math.abs(nearestQuarter);
        if (absQ === 0) return '0';
        if (absQ === 4) return `${sign}π`;
        if (absQ === 8) return `${sign}2π`;
        if (absQ % 4 === 0) return `${sign}${absQ / 4}π`;
        if (absQ === 2) return `${sign}π/2`;
        if (absQ === 6) return `${sign}3π/2`;
        if (absQ % 2 === 0) return `${sign}${absQ / 2}π/2`;
        if (absQ === 1) return `${sign}π/4`;
        return `${sign}${absQ}π/4`;
    }
    return parseFloat(val.toFixed(6)).toString();
}

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
            StateManager.updateViewportDimensions(rect.width, rect.height);
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, Camera.width, Camera.height);
    }

	drawArea(points: {x: number, y: number}[], color: string = '#2d70b3') {
        if (points.length < 2) return;
        
        this.ctx.fillStyle = color + '66'; // Opacidade oficial Desmos de 40% (#...66)
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
        this.ctx.fillStyle = color + '66'; // Opacidade oficial Desmos de 40% (#...66)
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

        // Calcula a escala de cada eixo independentemente com base na densidade ideal do Desmos
        const calcStep = (range: number) => {
            const rawStep = range / 10;
            const mag = Math.floor(Math.log10(rawStep));
            const magPow = Math.pow(10, mag);
            let step = magPow;
            if (rawStep > 5 * magPow) step = 5 * magPow;
            else if (rawStep > 2 * magPow) step = 2 * magPow;
            return step;
        };

        const isRadMode = StateManager.angleMode === 'radians';
        const majorStepX = (StateManager.xStep && StateManager.xStep > 0) ? StateManager.xStep : calcStep(rangeX);
        const majorStepY = (StateManager.yStep && StateManager.yStep > 0) ? StateManager.yStep : calcStep(rangeY);

        // Subdivisão secundária (minor grid) precisa para qualquer magnitude (10^-15 a 10^15)
        const getNormalizedSubdivisions = (step: number, isRad: boolean) => {
            if (isRad || Math.abs(step % (Math.PI / 4)) < 1e-4) return 4;
            const mag = Math.floor(Math.log10(step));
            const mantissa = Math.round(step / Math.pow(10, mag)); // 1, 2, ou 5
            if (mantissa === 2) return 4;
            return 5;
        };

        const minorSubdivsX = getNormalizedSubdivisions(majorStepX, isRadMode);
        const minorStepX = majorStepX / minorSubdivsX;

        const minorSubdivsY = getNormalizedSubdivisions(majorStepY, isRadMode);
        const minorStepY = majorStepY / minorSubdivsY;

        const W = Camera.width;
        const H = Camera.height;

        const isProjector = StateManager.projectorMode;
        this.ctx.font = isProjector ? 'bold 16px Arial' : '13px Arial';
        this.ctx.fillStyle = isProjector ? '#111111' : '#666666';

        // Cores oficiais Desmos
        const minorGridColor = isProjector ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.1215)'; // #e0e0e0
        const majorGridColor = isProjector ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.40)';   // #999999
        const axisColor = isProjector ? 'rgba(0, 0, 0, 1.0)' : 'rgba(0, 0, 0, 0.902)';          // #191919
        const axisWidth = isProjector ? 2.5 : 1.5;

        const showAxes = this.showAxes && StateManager.showAxes;
        const showGrid = this.showGrid && StateManager.gridType !== 'none';
        const isPolar = StateManager.gridType === 'polar';

        // Clamping suave das coordenadas do eixo 0 com margem para badges
        let zeroY = Camera.toPixelY(0);
        const isClampedY = zeroY < 22 || zeroY > H - 22;
        if (zeroY < 22) zeroY = 22; 
        if (zeroY > H - 22) zeroY = H - 22;

        let zeroX = Camera.toPixelX(0);
        const isClampedX = zeroX < 26 || zeroX > W - 26;
        if (zeroX < 26) zeroX = 26;
        if (zeroX > W - 26) zeroX = W - 26;

        // 1. Grelha Polar (se ativada)
        if (showGrid && isPolar) {
            const centerX = Math.floor(Camera.toPixelX(0)) + 0.5;
            const centerY = Math.floor(Camera.toPixelY(0)) + 0.5;
            const maxRadiusMath = Math.hypot(
                Math.max(Math.abs(Camera.xMin), Math.abs(Camera.xMax)),
                Math.max(Math.abs(Camera.yMin), Math.abs(Camera.yMax))
            );
            this.ctx.lineWidth = 1;

            const totalCircles = Math.floor((maxRadiusMath * 1.25) / minorStepX);
            for (let k = 1; k <= totalCircles; k++) {
                const r = k * minorStepX;
                const pxRadius = (r / (Camera.xMax - Camera.xMin)) * W;
                if (pxRadius <= 0) continue;
                const isMajor = (k % minorSubdivsX === 0);
                this.ctx.strokeStyle = isMajor ? majorGridColor : minorGridColor;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, pxRadius, 0, 2 * Math.PI);
                this.ctx.stroke();

                if (isMajor && showAxes && r <= Camera.xMax) {
                    const px = Math.floor(Camera.toPixelX(r)) + 0.5;
                    this.ctx.fillStyle = isProjector ? '#111111' : '#666666';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'top';
                    this.ctx.fillText(formatDesmosAxisNumber(r, isRadMode), px, zeroY + 5);
                }
            }

            // Raios angulares a cada 15 graus (secundários) e 30 graus (principais)
            const rayLength = Math.hypot(W, H) * 1.5;
            for (let deg = 0; deg < 360; deg += 15) {
                const isMajorRay = deg % 30 === 0;
                this.ctx.strokeStyle = isMajorRay ? majorGridColor : minorGridColor;
                const rad = (deg * Math.PI) / 180;
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, centerY);
                this.ctx.lineTo(centerX + Math.cos(rad) * rayLength, centerY - Math.sin(rad) * rayLength);
                this.ctx.stroke();
            }
        }

        // 2. Grelha Cartesiana em 2 Camadas (Minor e Major) + Eixo X (Indexação inteira k imune a deriva IEEE-754)
        if (showGrid && !isPolar) {
            const kMinX = Math.ceil(Camera.xMin / minorStepX);
            const kMaxX = Math.floor(Camera.xMax / minorStepX);

            // Camada Secundária (Minor Gridlines X)
            this.ctx.strokeStyle = minorGridColor;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            for (let k = kMinX; k <= kMaxX; k++) {
                if (k % minorSubdivsX !== 0) {
                    const x = k * minorStepX;
                    if (Math.abs(x) > 1e-10) {
                        const px = Math.floor(Camera.toPixelX(x)) + 0.5;
                        this.ctx.moveTo(px, 0);
                        this.ctx.lineTo(px, H);
                    }
                }
            }
            this.ctx.stroke();

            // Camada Principal (Major Gridlines X)
            this.ctx.strokeStyle = majorGridColor;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const kMajorMinX = Math.ceil(Camera.xMin / majorStepX);
            const kMajorMaxX = Math.floor(Camera.xMax / majorStepX);
            for (let k = kMajorMinX; k <= kMajorMaxX; k++) {
                const x = k * majorStepX;
                if (Math.abs(x) > 1e-10) {
                    const px = Math.floor(Camera.toPixelX(x)) + 0.5;
                    this.ctx.moveTo(px, 0);
                    this.ctx.lineTo(px, H);
                }
            }
            this.ctx.stroke();
        }

        // 3. Grelha Cartesiana em 2 Camadas (Minor e Major) + Eixo Y (Indexação inteira k imune a deriva IEEE-754)
        if (showGrid && !isPolar) {
            const kMinY = Math.ceil(Camera.yMin / minorStepY);
            const kMaxY = Math.floor(Camera.yMax / minorStepY);

            // Camada Secundária (Minor Gridlines Y)
            this.ctx.strokeStyle = minorGridColor;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            for (let k = kMinY; k <= kMaxY; k++) {
                if (k % minorSubdivsY !== 0) {
                    const y = k * minorStepY;
                    if (Math.abs(y) > 1e-10) {
                        const py = Math.floor(Camera.toPixelY(y)) + 0.5;
                        this.ctx.moveTo(0, py);
                        this.ctx.lineTo(W, py);
                    }
                }
            }
            this.ctx.stroke();

            // Camada Principal (Major Gridlines Y)
            this.ctx.strokeStyle = majorGridColor;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const kMajorMinY = Math.ceil(Camera.yMin / majorStepY);
            const kMajorMaxY = Math.floor(Camera.yMax / majorStepY);
            for (let k = kMajorMinY; k <= kMajorMaxY; k++) {
                const y = k * majorStepY;
                if (Math.abs(y) > 1e-10) {
                    const py = Math.floor(Camera.toPixelY(y)) + 0.5;
                    this.ctx.moveTo(0, py);
                    this.ctx.lineTo(W, py);
                }
            }
            this.ctx.stroke();
        }

        // 4. Desenho dos Eixos Principais (X=0 e Y=0) com cor #191919 e espessura 1.5px
        if (showAxes) {
            // Eixo Vertical Y (X = 0)
            const pyAxisX = Math.floor(Camera.toPixelX(0)) + 0.5;
            if (pyAxisX >= -10 && pyAxisX <= W + 10) {
                this.ctx.strokeStyle = hoverY ? '#2d70b3' : axisColor;
                this.ctx.lineWidth = hoverY ? (axisWidth + 1) : axisWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(pyAxisX, 0);
                this.ctx.lineTo(pyAxisX, H);
                this.ctx.stroke();
            }

            // Eixo Horizontal X (Y = 0)
            const pxAxisY = Math.floor(Camera.toPixelY(0)) + 0.5;
            if (pxAxisY >= -10 && pxAxisY <= H + 10) {
                this.ctx.strokeStyle = hoverX ? '#2d70b3' : axisColor;
                this.ctx.lineWidth = hoverX ? (axisWidth + 1) : axisWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(0, pxAxisY);
                this.ctx.lineTo(W, pxAxisY);
                this.ctx.stroke();
            }
        }

        // 5. Rótulos Numéricos dos Eixos (com suporte a badge translúcido de borda e múltiplos de π)
        if (showAxes) {
            this.ctx.font = isProjector ? 'bold 16px Arial' : '13px Arial';
            this.ctx.fillStyle = isProjector ? '#111111' : '#666666';

            // Rótulos do Eixo X
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            const kMajorMinX = Math.ceil(Camera.xMin / majorStepX);
            const kMajorMaxX = Math.floor(Camera.xMax / majorStepX);
            for (let k = kMajorMinX; k <= kMajorMaxX; k++) {
                const x = k * majorStepX;
                if (Math.abs(x) < 1e-10) continue;
                const px = Math.floor(Camera.toPixelX(x)) + 0.5;
                const numStr = formatDesmosAxisNumber(x, isRadMode);

                // Badge de fundo suave se estiver colado na borda da tela
                if (isClampedY) {
                    const textMetrics = this.ctx.measureText(numStr);
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    this.ctx.fillRect(px - textMetrics.width / 2 - 2, zeroY + 3, textMetrics.width + 4, 16);
                    this.ctx.fillStyle = isProjector ? '#111111' : '#666666';
                }
                this.ctx.fillText(numStr, px, zeroY + 4);
            }

            // Rótulos do Eixo Y
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'middle';
            const kMajorMinY = Math.ceil(Camera.yMin / majorStepY);
            const kMajorMaxY = Math.floor(Camera.yMax / majorStepY);
            for (let k = kMajorMinY; k <= kMajorMaxY; k++) {
                const y = k * majorStepY;
                if (Math.abs(y) < 1e-10) continue;
                const py = Math.floor(Camera.toPixelY(y)) + 0.5;
                const numStr = formatDesmosAxisNumber(y, isRadMode);

                if (isClampedX) {
                    const textMetrics = this.ctx.measureText(numStr);
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    this.ctx.fillRect(zeroX - textMetrics.width - 7, py - 8, textMetrics.width + 4, 16);
                    this.ctx.fillStyle = isProjector ? '#111111' : '#666666';
                }
                this.ctx.fillText(numStr, zeroX - 5, py);
            }
        }

        // 6. Setas nos Eixos (se ativadas)
        if (showAxes && StateManager.showArrows) {
            this.ctx.fillStyle = axisColor;
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

        // 7. Legendas dos Eixos X e Y
        if (showAxes) {
            this.ctx.fillStyle = isProjector ? '#111111' : '#444444';
            this.ctx.font = isProjector ? 'bold 14px Arial' : 'italic 13px Arial';
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
        
        this.ctx.fillStyle = color + '66'; // Opacidade oficial Desmos de 40% (#...66)
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