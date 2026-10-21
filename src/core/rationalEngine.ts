/**
 * RationalEngine (Módulo Hr estilo Desmos)
 * Aritmética Racional Híbrida Exata com guarda de overflow de 53 bits (Wx = 2^53 - 1)
 * Preserva representações {n: numerador, d: denominador} irredutíveis.
 */

export class Rational {
    readonly n: number;
    readonly d: number;
    readonly isRational = true;

    constructor(n: number, d: number) {
        this.n = n;
        this.d = d;
    }

    valueOf(): number {
        return this.n / this.d;
    }

    toString(): string {
        return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
    }
}

export class RationalEngine {
    /** Limite de inteiros exatos IEEE 754 (2^53 - 1) — Wx em shared_calculator_desktop.js */
    public static readonly MAX_SAFE_INT = 9007199254740991;

    /**
     * Máximo Divisor Comum (Algoritmo de Euclides — If em shared_calculator_desktop.js)
     */
    static gcd(a: number, b: number): number {
        a = Math.abs(Math.round(a));
        b = Math.abs(Math.round(b));
        while (b > 0) {
            const t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    /**
     * Construtor de número racional irredutível simplificado por MDC
     */
    static create(n: number, d: number = 1): Rational | null {
        if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
        if (Math.abs(n) > this.MAX_SAFE_INT || Math.abs(d) > this.MAX_SAFE_INT) return null;

        let num = Math.round(n);
        let den = Math.round(d);

        if (den < 0) {
            num = -num;
            den = -den;
        }

        if (num === 0) {
            return new Rational(0, 1);
        }

        const g = this.gcd(num, den);
        num = num / g;
        den = den / g;

        if (Math.abs(num) > this.MAX_SAFE_INT || Math.abs(den) > this.MAX_SAFE_INT) {
            return null;
        }

        return new Rational(num, den);
    }

    /**
     * Verifica se um objeto é um número racional válido
     */
    static isRational(val: any): val is Rational {
        return !!(val && typeof val === 'object' && val.isRational === true && typeof val.n === 'number' && typeof val.d === 'number' && val.d > 0);
    }

    /**
     * Converte um float para fração irredutível via Frações Contínuas
     */
    static fromNumber(val: number, maxDen: number = 100000): Rational | null {
        if (!Number.isFinite(val) || Number.isNaN(val)) return null;
        if (Number.isInteger(val)) {
            return this.create(val, 1);
        }

        const sign = val < 0 ? -1 : 1;
        const x = Math.abs(val);

        let h1 = 1, h0 = 0;
        let k1 = 0, k0 = 1;
        let b = x;

        do {
            const a = Math.floor(b);
            let aux = h1; h1 = a * h1 + h0; h0 = aux;
            aux = k1; k1 = a * k1 + k0; k0 = aux;

            if (k1 > maxDen) break;
            const approx = h1 / k1;
            if (Math.abs(approx - x) < 1e-11) {
                return this.create(sign * h1, k1);
            }
            b = 1 / (b - a);
        } while (Number.isFinite(b) && Math.abs(x - h1 / k1) > 1e-11);

        if (k1 <= maxDen && Math.abs(h1 / k1 - x) < 1e-6) {
            return this.create(sign * h1, k1);
        }

        return null;
    }

    /**
     * Adição racional exata (a + b) com guarda Wx
     */
    static add(a: Rational, b: Rational): Rational | number {
        const g = this.gcd(a.d, b.d);
        const denB_g = b.d / g;
        const denA_g = a.d / g;
        
        const num = a.n * denB_g + b.n * denA_g;
        const den = a.d * denB_g;

        if (Math.abs(num) > this.MAX_SAFE_INT || Math.abs(den) > this.MAX_SAFE_INT) {
            return (a.n / a.d) + (b.n / b.d);
        }

        const res = this.create(num, den);
        return res ?? (a.n / a.d + b.n / b.d);
    }

    /**
     * Subtração racional exata (a - b) com guarda Wx
     */
    static subtract(a: Rational, b: Rational): Rational | number {
        return this.add(a, new Rational(-b.n, b.d));
    }

    /**
     * Multiplicação racional exata (a * b) com guarda Wx e simplificação cruzada
     */
    static multiply(a: Rational, b: Rational): Rational | number {
        const g1 = this.gcd(a.n, b.d);
        const g2 = this.gcd(b.n, a.d);

        const num = (a.n / g1) * (b.n / g2);
        const den = (a.d / g2) * (b.d / g1);

        if (Math.abs(num) > this.MAX_SAFE_INT || Math.abs(den) > this.MAX_SAFE_INT) {
            return (a.n / a.d) * (b.n / b.d);
        }

        const res = this.create(num, den);
        return res ?? ((a.n / a.d) * (b.n / b.d));
    }

    /**
     * Divisão racional exata (a / b) com guarda Wx
     */
    static divide(a: Rational, b: Rational): Rational | number {
        if (b.n === 0) return (a.n / a.d) / 0;
        return this.multiply(a, new Rational(b.d * (b.n < 0 ? -1 : 1), Math.abs(b.n)));
    }

    /**
     * Potenciação inteira exata (a ^ p)
     */
    static power(a: Rational, p: number): Rational | number {
        if (!Number.isInteger(p)) {
            return Math.pow(a.n / a.d, p);
        }
        if (p === 0) return new Rational(1, 1);
        if (p < 0) {
            if (a.n === 0) return Infinity;
            return this.power(new Rational(a.d * (a.n < 0 ? -1 : 1), Math.abs(a.n)), -p);
        }
        const num = Math.pow(a.n, p);
        const den = Math.pow(a.d, p);
        if (Math.abs(num) > this.MAX_SAFE_INT || Math.abs(den) > this.MAX_SAFE_INT) {
            return Math.pow(a.n / a.d, p);
        }
        const res = this.create(num, den);
        return res ?? Math.pow(a.n / a.d, p);
    }

    /**
     * Converte o racional para string LaTeX formatada (\frac{n}{d} ou número inteiro)
     */
    static toLatex(r: Rational): string {
        if (r.d === 1) return `${r.n}`;
        const sign = r.n < 0 ? '-' : '';
        return `${sign}\\frac{${Math.abs(r.n)}}{${r.d}}`;
    }

    /**
     * Converte o racional para string decimal
     */
    static toDecimalString(r: Rational, precision: number = 10): string {
        const val = r.n / r.d;
        return parseFloat(val.toFixed(precision)).toString();
    }
}
