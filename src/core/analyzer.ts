export interface NotablePoint {
    x: number;
    y: number;
    type: 'root' | 'intercept' | 'extremum' | 'intersect';
}

export class MathAnalyzer {
    /**
     * Algoritmo de Bisseção Robusto com Checagem de Continuidade:
     * Encontra o zero da função cortando o intervalo pela metade,
     * garantindo que descontinuidades verticais (assíntotas) não sejam marcadas como raízes.
     */
    private static bisection(f: (x: number) => number, a: number, b: number, tol = 1e-7): number | null {
        let fa = f(a);
        let fb = f(b);

        if (!isFinite(fa) || !isFinite(fb) || isNaN(fa) || isNaN(fb)) return null;
        if (fa * fb > 0) return null; // Sem mudança de sinal

        // Teste de descontinuidade / salto de assíntota vertical
        if (Math.abs(fa - fb) > 1e4 && Math.abs(b - a) < 1e-2) return null;

        let mid = a;
        for (let i = 0; i < 50; i++) {
            mid = (a + b) / 2;
            const fmid = f(mid);

            if (!isFinite(fmid) || isNaN(fmid)) return null;

            if (Math.abs(fmid) < tol || (b - a) / 2 < tol) {
                // Checagem crucial de resíduo: para ser uma raiz legítima, |f(mid)| DEVE estar perto de 0!
                // Em assíntotas verticais (ex: 1/x), (b-a)/2 < tol converge para 0, mas f(mid) é gigantesco!
                if (Math.abs(fmid) < 1e-3) {
                    return mid;
                }
                return null;
            }

            if (fa * fmid < 0) {
                b = mid;
                fb = fmid;
            } else {
                a = mid;
                fa = fmid;
            }
        }

        const finalVal = f(mid);
        return isFinite(finalVal) && Math.abs(finalVal) < 1e-3 ? mid : null;
    }

    /**
     * Caça Raízes (corte com eixo X), Extremos (máximos e mínimos) e Interseções com o Eixo Y.
     */
    static getNotablePoints(f: (x: number) => number, xMin: number, xMax: number): NotablePoint[] {
        const points: NotablePoint[] = [];
        const steps = 150;
        const dx = (xMax - xMin) / steps;
        const h = 1e-5;

        // Derivada numérica (Diferenças Finitas Centrais)
        const df = (x: number) => {
            const y1 = f(x + h);
            const y0 = f(x - h);
            if (!isFinite(y1) || !isFinite(y0)) return NaN;
            return (y1 - y0) / (2 * h);
        };

        // 1. Interseção com o Eixo Y (x = 0)
        if (xMin <= 0 && xMax >= 0) {
            const yInt = f(0);
            if (isFinite(yInt) && !isNaN(yInt)) {
                points.push({ x: 0, y: yInt, type: 'intercept' });
            }
        }

        let prevX = xMin;
        let prevY = f(prevX);
        let prevDy = df(prevX);

        // Varredura
        for (let i = 1; i <= steps; i++) {
            const currX = xMin + i * dx;
            const currY = f(currX);
            const currDy = df(currX);

            // Se o segmento for identicamente zero, não gera raízes infinitas
            if (Math.abs(prevY) < 1e-9 && Math.abs(currY) < 1e-9) {
                prevX = currX;
                prevY = currY;
                prevDy = currDy;
                continue;
            }

            // 2. Caçador de Raízes (Mudança estrita de sinal no Y contínuo)
            if (isFinite(prevY) && isFinite(currY) && (prevY * currY < 0 || (prevY === 0 && currY !== 0) || (currY === 0 && prevY !== 0))) {
                const rootX = this.bisection(f, prevX, currX);
                if (rootX !== null) {
                    points.push({ x: rootX, y: 0, type: 'root' });
                }
            }

            // 3. Caçador de Extremos (Mudança de sinal na Derivada, ignorando retas)
            if (Math.abs(prevDy) > 1e-7 && Math.abs(currDy) > 1e-7 && isFinite(prevDy) && isFinite(currDy) && prevDy * currDy < 0) {
                // Evita assíntotas verticais onde a derivada explode
                if (Math.abs(currY) < 1e5 && Math.abs(prevY) < 1e5) {
                    const extX = this.bisection(df, prevX, currX, 1e-5);
                    if (extX !== null) {
                        const extY = f(extX);
                        if (isFinite(extY) && !isNaN(extY) && Math.abs(extY) < 1e6) {
                            points.push({ x: extX, y: extY, type: 'extremum' });
                        }
                    }
                }
            }

            prevX = currX;
            prevY = currY;
            prevDy = currDy;
        }

        return this.filterDuplicates(points);
    }

    /**
     * Encontra interseções entre duas funções f e g: h(x) = f(x) - g(x) = 0
     */
    static getIntersections(f: (x: number) => number, g: (x: number) => number, xMin: number, xMax: number): NotablePoint[] {
        const h_func = (x: number) => {
            const fx = f(x);
            const gx = g(x);
            if (!isFinite(fx) || !isFinite(gx)) return NaN;
            return fx - gx;
        };

        const points: NotablePoint[] = [];
        const steps = 150;
        const dx = (xMax - xMin) / steps;

        let prevX = xMin;
        let prevY = h_func(prevX);

        for (let i = 1; i <= steps; i++) {
            const currX = xMin + i * dx;
            const currY = h_func(currX);

            // Se as duas curvas forem idênticas ou colineares neste intervalo, pula
            if (Math.abs(prevY) < 1e-7 && Math.abs(currY) < 1e-7) {
                prevX = currX;
                prevY = currY;
                continue;
            }

            if (isFinite(prevY) && isFinite(currY) && prevY * currY < 0) {
                const rootX = this.bisection(h_func, prevX, currX);
                if (rootX !== null) {
                    const yVal = f(rootX);
                    if (isFinite(yVal) && !isNaN(yVal)) {
                        points.push({ x: rootX, y: yVal, type: 'intersect' });
                    }
                }
            }

            prevX = currX;
            prevY = currY;
        }

        const filtered = this.filterDuplicates(points);
        // Se houver mais de 20 interseções, as curvas coincidem no domínio (não são pontos discretos)
        if (filtered.length > 20) return [];
        return filtered;
    }

    private static filterDuplicates(points: NotablePoint[]): NotablePoint[] {
        const unique: NotablePoint[] = [];
        for (const p of points) {
            const isDup = unique.some(u => Math.abs(u.x - p.x) < 1e-4 && Math.abs(u.y - p.y) < 1e-4);
            if (!isDup) unique.push(p);
        }
        return unique;
    }
}