export class ODESolver {
    // Dormand-Prince 5(4) coefficients
    private static readonly a_dp = [
        [],
        [1/5],
        [3/40, 9/40],
        [44/45, -56/15, 32/9],
        [19372/6561, -25360/2187, 64448/6561, -212/729],
        [9017/3168, -355/33, 46732/5247, 49/176, -5103/18656],
        [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84]
    ];
    private static readonly c_dp = [0, 1/5, 3/10, 4/5, 8/9, 1, 1];
    private static readonly b5_dp = [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84, 0];
    private static readonly b4_dp = [5179/57600, 0, 7571/16695, 393/640, -92097/339200, 187/2100, 1/40];

    static solveDormandPrince(f: (t: number, y: number) => number, t0: number, y0: number, tMax: number, h0: number = 0.1, tol: number = 1e-6): {x: number, y: number}[] {
        const points = [{x: t0, y: y0}];
        let t = t0;
        let y = y0;
        let h = h0;

        let maxSteps = 10000;
        let steps = 0;

        while (t < tMax && steps < maxSteps) {
            steps++;
            if (t + h > tMax) h = tMax - t;

            const k = new Array(7).fill(0);
            for (let i = 0; i < 7; i++) {
                let sum = 0;
                for (let j = 0; j < i; j++) {
                    sum += this.a_dp[i][j] * k[j];
                }
                k[i] = h * f(t + this.c_dp[i] * h, y + sum);
            }

            let y5 = y, y4 = y;
            for (let i = 0; i < 7; i++) {
                y5 += this.b5_dp[i] * k[i];
                y4 += this.b4_dp[i] * k[i];
            }

            const error = Math.abs(y5 - y4);
            
            if (!isFinite(y) || Math.abs(y) > 1e10 || isNaN(y)) break;

            if (error <= tol || h < 1e-10) {
                t += h;
                y = y5;
                if (!isFinite(y) || Math.abs(y) > 1e10 || isNaN(y)) break;
                points.push({x: t, y});
            }
            
            if (error === 0) {
                h *= 2;
            } else {
                const s = 0.84 * Math.pow(tol / error, 0.2);
                h = Math.max(1e-10, Math.min(h * s, 5 * h)); // Limit growth/shrink
            }
        }
        return points;
    }

    /**
     * Resolve a EDO de primeira ordem y' = f(x, y) em ambas as direções a partir de (x0, y0)
     */
    static solveBidirectional(f: (t: number, y: number) => number, x0: number, y0: number, xMin: number, xMax: number, tol: number = 1e-6): {x: number, y: number}[] {
        // Integração para a frente (x0 -> xMax)
        const forward = (xMax > x0)
            ? this.solveDormandPrince(f, x0, y0, xMax, Math.max(1e-4, (xMax - x0) / 100), tol)
            : [{ x: x0, y: y0 }];

        // Integração para trás (x0 -> xMin)
        const tauMax = x0 - xMin;
        const backward = (tauMax > 0)
            ? this.solveDormandPrince((tau, y) => -f(x0 - tau, y), 0, y0, tauMax, Math.max(1e-4, tauMax / 100), tol)
            : [];

        // Converte coordenadas de volta para o plano Cartesiano (x = x0 - tau)
        const revPoints: {x: number, y: number}[] = [];
        for (let i = backward.length - 1; i > 0; i--) {
            revPoints.push({ x: x0 - backward[i].x, y: backward[i].y });
        }

        return [...revPoints, ...forward];
    }
}
