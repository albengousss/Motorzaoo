export class Camera {
    static xMin = -10; static xMax = 10;
    static yMin = -10; static yMax = 10;
    static width = 800; static height = 600;
    static isInitialized = false;

    /** Calcula a proporção real da tela na primeira vez que abre */
    static resize(w: number, h: number) {
        this.width = w; 
        this.height = h;
        if (!this.isInitialized && w > 0 && h > 0) {
            const ratio = w / h;
            this.yMin = -10; 
            this.yMax = 10;
            this.xMin = -10 * ratio;
            this.xMax = 10 * ratio;
            this.isInitialized = true;
        }
    }

    /** Repõe a câmara para a vista padrão */
    static reset() {
        this.isInitialized = false;
        this.resize(this.width, this.height);
    }

    static toPixelX(mathX: number): number { return ((mathX - this.xMin) / (this.xMax - this.xMin)) * this.width; }
    static toPixelY(mathY: number): number { return (1 - (mathY - this.yMin) / (this.yMax - this.yMin)) * this.height; }
    static toMathX(pixelX: number): number { return this.xMin + (pixelX / this.width) * (this.xMax - this.xMin); }
    static toMathY(pixelY: number): number { return this.yMax - (pixelY / this.height) * (this.yMax - this.yMin); }

    /** Zoom com fatores independentes para X e Y (estilo Desmos) */
    static zoom(factorX: number, factorY: number, mouseX: number, mouseY: number) {
        const mathX = this.toMathX(mouseX);
        const mathY = this.toMathY(mouseY);
        const newXMin = mathX - (mathX - this.xMin) * factorX;
        const newXMax = mathX + (this.xMax - mathX) * factorX;
        const newYMin = mathY - (mathY - this.yMin) * factorY;
        const newYMax = mathY + (this.yMax - mathY) * factorY;
        // Limites de zoom: evita viewport degenerado (xMin ≈ xMax)
        if (newXMax - newXMin > 1e-8 && newYMax - newYMin > 1e-8) {
            if (newXMax - newXMin < 1e10 && newYMax - newYMin < 1e10) {
                this.xMin = newXMin; this.xMax = newXMax;
                this.yMin = newYMin; this.yMax = newYMax;
            }
        }
    }

    /** Pan em pixels — arrastar para baixo revela valores de y maiores (yMax aumenta) */
    static pan(dx: number, dy: number) {
        const mathDx = (dx / this.width) * (this.xMax - this.xMin);
        const mathDy = (dy / this.height) * (this.yMax - this.yMin);
        // dx > 0 = arrastar para a direita → revelar valores de x menores (shift esquerdo)
        this.xMin -= mathDx; this.xMax -= mathDx;
        // dy > 0 = arrastar para baixo → revelar valores de y maiores (shift para cima no math space)
        // Nota: no Canvas, Y cresce para baixo, então arrastar para baixo deve revelar
        // a parte superior do gráfico → yMin e yMax devem DIMINUIR (a janela sobe)
        this.yMin += mathDy; this.yMax += mathDy;
    }
}