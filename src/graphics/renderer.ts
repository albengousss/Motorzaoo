import { Camera } from './camera';

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
        // Usa a grelha do eixo que tiver intervalo maior, para manter labels legíveis
        const rawStep = Math.max(rangeX, rangeY) / 10;
        const mag = Math.floor(Math.log10(rawStep));
        const magPow = Math.pow(10, mag);
        
        let step = magPow;
        if (rawStep > 5 * magPow) step = 5 * magPow;
        else if (rawStep > 2 * magPow) step = 2 * magPow;

        // Usar Camera.width/height (dimensões LÓGICAS) — this.canvas.width é físico (DPR-scaled)
        const W = Camera.width;
        const H = Camera.height;

        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#666';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        let zeroY = Camera.toPixelY(0);
        if (zeroY < 20) zeroY = 20; 
        if (zeroY > H - 20) zeroY = H - 20;

        let zeroX = Camera.toPixelX(0);
        if (zeroX < 20) zeroX = 20;
        if (zeroX > W - 20) zeroX = W - 20;

        const startX = Math.ceil(Camera.xMin / step) * step;
        for (let x = startX; x <= Camera.xMax; x += step) {
            const px = Camera.toPixelX(x);
            const isAxis = Math.abs(x) < 1e-10;
            if ((isAxis && this.showAxes) || (!isAxis && this.showGrid)) {
                this.ctx.beginPath();
                this.ctx.moveTo(px, 0);
                this.ctx.lineTo(px, H);
                
                if (isAxis) {
                    this.ctx.strokeStyle = hoverY ? '#2d70b3' : '#000';
                    this.ctx.lineWidth = hoverY ? 3 : 2;
                } else {
                    this.ctx.strokeStyle = '#e0e0e0';
                    this.ctx.lineWidth = 1;
                }
                this.ctx.stroke();

                if (!isAxis && this.showAxes) {
                    const numStr = parseFloat(x.toFixed(4)).toString();
                    this.ctx.fillText(numStr, px, zeroY + 5);
                }
            }
        }

        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        const startY = Math.ceil(Camera.yMin / step) * step;
        for (let y = startY; y <= Camera.yMax; y += step) {
            const py = Camera.toPixelY(y);
            const isAxis = Math.abs(y) < 1e-10;
            if ((isAxis && this.showAxes) || (!isAxis && this.showGrid)) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, py);
                this.ctx.lineTo(W, py);
                
                if (isAxis) {
                    this.ctx.strokeStyle = hoverX ? '#2d70b3' : '#000';
                    this.ctx.lineWidth = hoverX ? 3 : 2;
                } else {
                    this.ctx.strokeStyle = '#e0e0e0';
                    this.ctx.lineWidth = 1;
                }
                this.ctx.stroke();

                if (!isAxis && this.showAxes) {
                    const numStr = parseFloat(y.toFixed(4)).toString();
                    this.ctx.fillText(numStr, zeroX - 5, py);
                }
            }
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

    // Modificamos para aceitar a cor como parâmetro
    drawCurve(points: {x: number, y: number}[], color: string = '#2d70b3') {
        if (points.length === 0) return;
        
        this.ctx.strokeStyle = color; 
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        let levantarPincel = true;

        for (let i = 0; i < points.length; i++) {
            // Se o motor mandou um NaN, é uma assíntota! Levantamos o pincel.
            if (isNaN(points[i].y)) {
                levantarPincel = true;
                continue;
            }

            const px = Camera.toPixelX(points[i].x);
            const py = Camera.toPixelY(points[i].y);

            if (levantarPincel) {
                this.ctx.moveTo(px, py);
                levantarPincel = false;
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        
        this.ctx.stroke(); 
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

        // "A área de visualização é dividida de forma matricial - por norma, numa grelha quadrada 40x40"
        const cols = 40;
        const rows = 40;
        const dx = (xMax - xMin) / cols;
        const dy = (yMax - yMin) / rows;

        // LengthMultiplier - Fator visual do comprimento
        const lengthMultiplier = Math.min(
            Math.abs(Camera.toPixelX(xMin + dx) - Camera.toPixelX(xMin)),
            Math.abs(Camera.toPixelY(yMin + dy) - Camera.toPixelY(yMin))
        ) * 0.35; // 35% of grid cell size

        for (let i = 0; i <= cols; i++) {
            for (let j = 0; j <= rows; j++) {
                const x = xMin + i * dx;
                const y = yMin + j * dy;

                const m = f(x, y, scope);
                if (isNaN(m) || !isFinite(m)) continue;

                // Extrair o vetor unitário: u = (1/sqrt(1+m^2), m/sqrt(1+m^2))
                const mag = Math.sqrt(1 + m * m);
                const ux = 1 / mag;
                const uy = m / mag;

                const px = Camera.toPixelX(x);
                const py = Camera.toPixelY(y);

                // Como pixelY inverte a direção, uy deve ser subtraído visualmente (mas já tratamos isso usando toPixel em offsets relativos ou invertendo aqui)
                const lineHalfX = ux * lengthMultiplier;
                const lineHalfY = uy * lengthMultiplier; // Cuidado com a direção Y do canvas

                this.ctx.moveTo(px - lineHalfX, py + lineHalfY); 
                this.ctx.lineTo(px + lineHalfX, py - lineHalfY); 
            }
        }
        
        this.ctx.stroke();
    }
}