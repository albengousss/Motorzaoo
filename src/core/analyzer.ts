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

        if (Math.abs(fa) < 1e-12) return a;
        if (Math.abs(fb) < 1e-12) return b;
        if (fa * fb > 0) return null; // Sem mudança de sinal

        // Teste de descontinuidade / salto de assíntota vertical
        if (Math.abs(fa - fb) > 1e4 && Math.abs(b - a) < 1e-2) return null;

        // Limiar de resíduo relativo à escala da função
        const scale = Math.max(1, Math.abs(fa), Math.abs(fb));
        const resTol = Math.max(1e-3, 1e-4 * scale);

        let mid = a;
        for (let i = 0; i < 50; i++) {
            mid = (a + b) / 2;
            const fmid = f(mid);

            if (!isFinite(fmid) || isNaN(fmid)) return null;

            if (Math.abs(fmid) < tol || (b - a) / 2 < tol) {
                // Checagem crucial de resíduo relativo: para ser uma raiz legítima, |f(mid)| deve ser proporcionalmente próximo de 0
                if (Math.abs(fmid) < resTol) {
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
        return isFinite(finalVal) && Math.abs(finalVal) < resTol ? mid : null;
    }

    /**
     * Caça Raízes (corte com eixo X), Extremos (máximos e mínimos) e Interseções com o Eixo Y.
     */
    static getNotablePoints(f: (x: number) => number, xMin: number, xMax: number): NotablePoint[] {
        const points: NotablePoint[] = [];
        const span = Math.abs(xMax - xMin);
        const steps = Math.min(1000, Math.max(150, Math.floor(span * 20)));
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

            // 2. Caçador de Raízes (Mudança estrita de sinal no Y contínuo ou zero numérico)
            if (isFinite(prevY) && isFinite(currY)) {
                if (Math.abs(prevY) < 1e-9) {
                    points.push({ x: prevX, y: 0, type: 'root' });
                } else if (Math.abs(currY) < 1e-9) {
                    points.push({ x: currX, y: 0, type: 'root' });
                } else if (prevY * currY < 0) {
                    const rootX = this.bisection(f, prevX, currX);
                    if (rootX !== null) {
                        points.push({ x: rootX, y: 0, type: 'root' });
                    }
                }
            }

            // 3. Caçador de Extremos (Mudança de sinal na Derivada, ignorando retas)
            const derivTol = 1e-7 * Math.max(1, Math.abs(prevY), Math.abs(currY));
            if (isFinite(prevDy) && isFinite(currDy) && Math.abs(currY) < 1e5 && Math.abs(prevY) < 1e5) {
                let extX: number | null = null;
                if (Math.abs(prevDy) < 1e-12) {
                    extX = prevX;
                } else if (Math.abs(currDy) < 1e-12) {
                    extX = currX;
                } else if (Math.abs(prevDy) > derivTol && Math.abs(currDy) > derivTol && prevDy * currDy < 0) {
                    extX = this.bisection(df, prevX, currX, 1e-5);
                }

                if (extX !== null) {
                    const extY = f(extX);
                    if (isFinite(extY) && !isNaN(extY) && Math.abs(extY) < 1e6) {
                        if (Math.abs(extY) < 1e-4) {
                            // Raiz dupla: extremum tangente ao eixo x promovido para 'root'
                            points.push({ x: extX, y: 0, type: 'root' });
                        } else {
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

        const h_step = 1e-5;
        const dh = (x: number) => {
            const y1 = h_func(x + h_step);
            const y0 = h_func(x - h_step);
            if (!isFinite(y1) || !isFinite(y0)) return NaN;
            return (y1 - y0) / (2 * h_step);
        };

        const points: NotablePoint[] = [];
        const span = Math.abs(xMax - xMin);
        const steps = Math.min(1000, Math.max(150, Math.floor(span * 20)));
        const dx = (xMax - xMin) / steps;

        let prevX = xMin;
        let prevY = h_func(prevX);
        let prevDh = dh(prevX);
        let coincidentSamples = (isFinite(prevY) && Math.abs(prevY) < 1e-6) ? 1 : 0;

        for (let i = 1; i <= steps; i++) {
            const currX = xMin + i * dx;
            const currY = h_func(currX);
            const currDh = dh(currX);

            if (isFinite(currY) && Math.abs(currY) < 1e-6) {
                coincidentSamples++;
            }

            // Se as duas curvas forem idênticas ou colineares neste intervalo, pula
            if (Math.abs(prevY) < 1e-7 && Math.abs(currY) < 1e-7) {
                prevX = currX;
                prevY = currY;
                prevDh = currDh;
                continue;
            }

            if (isFinite(prevY) && isFinite(currY)) {
                // 1. Zeros nas amostras numéricas
                if (Math.abs(currY) < 1e-9) {
                    const yVal = f(currX);
                    if (isFinite(yVal) && !isNaN(yVal)) {
                        points.push({ x: currX, y: yVal, type: 'intersect' });
                    }
                } else if (Math.abs(prevY) < 1e-9) {
                    const yVal = f(prevX);
                    if (isFinite(yVal) && !isNaN(yVal)) {
                        points.push({ x: prevX, y: yVal, type: 'intersect' });
                    }
                } else if (prevY * currY < 0) {
                    // 2. Mudança estrita de sinal
                    const rootX = this.bisection(h_func, prevX, currX);
                    if (rootX !== null) {
                        const yVal = f(rootX);
                        if (isFinite(yVal) && !isNaN(yVal)) {
                            points.push({ x: rootX, y: yVal, type: 'intersect' });
                        }
                    }
                }
            }

            // 3. Interseções tangenciais (extremos de h(x) com valor nulo)
            if (isFinite(prevDh) && isFinite(currDh) && Math.abs(prevDh) > 1e-7 && Math.abs(currDh) > 1e-7 && prevDh * currDh < 0) {
                const extX = this.bisection(dh, prevX, currX, 1e-5);
                if (extX !== null) {
                    const extH = h_func(extX);
                    if (isFinite(extH) && Math.abs(extH) < 1e-4) {
                        const yVal = f(extX);
                        if (isFinite(yVal) && !isNaN(yVal)) {
                            points.push({ x: extX, y: yVal, type: 'intersect' });
                        }
                    }
                }
            }

            prevX = currX;
            prevY = currY;
            prevDh = currDh;
        }

        // Se quase todos os pontos coincidem (|h(x)| < eps), as curvas coincidem no domínio
        if (coincidentSamples >= Math.floor(steps * 0.85)) {
            return [];
        }

        return this.filterDuplicates(points);
    }

    private static filterDuplicates(points: NotablePoint[]): NotablePoint[] {
        const unique: NotablePoint[] = [];
        for (const p of points) {
            const idx = unique.findIndex(u => Math.abs(u.x - p.x) < 1e-4 && Math.abs(u.y - p.y) < 1e-4);
            if (idx === -1) {
                unique.push(p);
            } else {
                // Em caso de conflito de mesmo ponto (x,y), prioriza 'root' sobre 'intercept' e 'extremum'
                if (p.type === 'root' && unique[idx].type !== 'root') {
                    unique[idx] = p;
                }
            }
        }
        return unique;
    }
}