export class Camera {
    static xMin = -10; static xMax = 10;
    static yMin = -10; static yMax = 10;
    static width = 800; static height = 600;
    static isInitialized = false;

    // NOVO: Calcula a proporção real da tela na primeira vez que abre
    static resize(w: number, h: number) {
        this.width = w; 
        this.height = h;
        if (!this.isInitialized && w > 0 && h > 0) {
            const ratio = w / h;
            this.yMin = -10; 
            this.yMax = 10;
            // O eixo X agora se estica para obedecer ao tamanho do seu monitor!
            this.xMin = -10 * ratio;
            this.xMax = 10 * ratio;
            this.isInitialized = true;
        }
    }

    static toPixelX(mathX: number): number { return ((mathX - this.xMin) / (this.xMax - this.xMin)) * this.width; }
    static toPixelY(mathY: number): number { return (1 - (mathY - this.yMin) / (this.yMax - this.yMin)) * this.height; }
    static toMathX(pixelX: number): number { return this.xMin + (pixelX / this.width) * (this.xMax - this.xMin); }
    static toMathY(pixelY: number): number { return this.yMax - (pixelY / this.height) * (this.yMax - this.yMin); }

    // NOVO: Zoom agora recebe fatores independentes para criar a função de "esticar" do Desmos
    static zoom(factorX: number, factorY: number, mouseX: number, mouseY: number) {
        const mathX = this.toMathX(mouseX);
        const mathY = this.toMathY(mouseY);
        this.xMin = mathX - (mathX - this.xMin) * factorX;
        this.xMax = mathX + (this.xMax - mathX) * factorX;
        this.yMin = mathY - (mathY - this.yMin) * factorY;
        this.yMax = mathY + (this.yMax - mathY) * factorY;
    }

    static pan(dx: number, dy: number) {
        const mathDx = (dx / this.width) * (this.xMax - this.xMin);
        const mathDy = (dy / this.height) * (this.yMax - this.yMin);
        this.xMin -= mathDx; this.xMax -= mathDx;
        this.yMin += mathDy; this.yMax += mathDy;
    }
}