import { describe, it, expect, beforeEach } from 'vitest';
import { Rational, RationalEngine } from '../src/core/rationalEngine';
import { MatrixEngine } from '../src/core/matrixEngine';
import { Policy2D, Policy3D, PolicyManager, CostBudgetManager } from '../src/core/policy';
import { ExpressionManager } from '../src/ui/expressionManager';
import { StateManager } from '../src/core/stateManager';
import { MathEngine } from '../src/core/mathEngine';

describe('Fase 2.5: Refinamento do Motor Base', () => {

    // ─────────────────────────────────────────────────────────────
    // 1. MÓDULO RACIONAL HÍBRIDO (Hr, _e, If e guarda Wx = 2^53 - 1)
    // ─────────────────────────────────────────────────────────────
    describe('1. RationalEngine (Módulo Hr estilo Desmos)', () => {
        it('deve implementar interoperabilidade numérica nativa via valueOf()', () => {
            const r = new Rational(3, 2);
            expect(r.valueOf()).toBe(1.5);
            expect(+r).toBe(1.5);
            expect(r + 1).toBe(2.5);
            expect(Number(r)).toBe(1.5);
            expect(Math.sin(new Rational(0, 1))).toBe(0);
        });

        it('deve calcular o MDC euclidiano com precisão e sinais (If)', () => {
            expect(RationalEngine.gcd(54, 24)).toBe(6);
            expect(RationalEngine.gcd(-54, 24)).toBe(6);
            expect(RationalEngine.gcd(0, 10)).toBe(10);
            expect(RationalEngine.gcd(7, 13)).toBe(1);
        });

        it('deve criar frações irredutíveis simplificadas por MDC', () => {
            const r1 = RationalEngine.create(6, 4);
            expect(r1).not.toBeNull();
            expect(r1!.n).toBe(3);
            expect(r1!.d).toBe(2);

            const r2 = RationalEngine.create(3, -2);
            expect(r2!.n).toBe(-3);
            expect(r2!.d).toBe(2);

            const rZero = RationalEngine.create(0, 10);
            expect(rZero!.n).toBe(0);
            expect(rZero!.d).toBe(1);

            expect(RationalEngine.create(1, 0)).toBeNull();
        });

        it('deve respeitar a guarda de overflow Wx = 2^53 - 1 (9007199254740991)', () => {
            const limit = RationalEngine.MAX_SAFE_INT;
            expect(limit).toBe(9007199254740991);
            expect(RationalEngine.create(limit, 1)).not.toBeNull();
            expect(RationalEngine.create(limit + 1, 1)).toBeNull();
        });

        it('deve converter floats em frações contínuas exatas (fromNumber)', () => {
            const rInt = RationalEngine.fromNumber(5);
            expect(rInt!.n).toBe(5);
            expect(rInt!.d).toBe(1);

            const rHalf = RationalEngine.fromNumber(0.5);
            expect(rHalf!.n).toBe(1);
            expect(rHalf!.d).toBe(2);

            const rThird = RationalEngine.fromNumber(1 / 3);
            expect(rThird!.n).toBe(1);
            expect(rThird!.d).toBe(3);

            const rThreeHalves = RationalEngine.fromNumber(1.5);
            expect(rThreeHalves!.n).toBe(3);
            expect(rThreeHalves!.d).toBe(2);

            const rNeg = RationalEngine.fromNumber(-0.75);
            expect(rNeg!.n).toBe(-3);
            expect(rNeg!.d).toBe(4);
        });

        it('deve realizar operações aritméticas exatas com simplificação contínua', () => {
            const a = RationalEngine.create(1, 2)!;
            const b = RationalEngine.create(1, 3)!;

            const sum = RationalEngine.add(a, b) as Rational;
            expect(sum.n).toBe(5);
            expect(sum.d).toBe(6);

            const diff = RationalEngine.subtract(a, b) as Rational;
            expect(diff.n).toBe(1);
            expect(diff.d).toBe(6);

            const prod = RationalEngine.multiply(a, b) as Rational;
            expect(prod.n).toBe(1);
            expect(prod.d).toBe(6);

            const quot = RationalEngine.divide(a, b) as Rational;
            expect(quot.n).toBe(3);
            expect(quot.d).toBe(2);

            const powPos = RationalEngine.power(RationalEngine.create(2, 3)!, 2) as Rational;
            expect(powPos.n).toBe(4);
            expect(powPos.d).toBe(9);

            const powNeg = RationalEngine.power(RationalEngine.create(2, 3)!, -1) as Rational;
            expect(powNeg.n).toBe(3);
            expect(powNeg.d).toBe(2);

            const powZero = RationalEngine.power(RationalEngine.create(2, 3)!, 0) as Rational;
            expect(powZero.n).toBe(1);
            expect(powZero.d).toBe(1);
        });

        it('deve formatar LaTeX e decimais fielmente ao padrão Desmos', () => {
            expect(RationalEngine.toLatex(new Rational(3, 2))).toBe('\\frac{3}{2}');
            expect(RationalEngine.toLatex(new Rational(-3, 2))).toBe('-\\frac{3}{2}');
            expect(RationalEngine.toLatex(new Rational(5, 1))).toBe('5');
            expect(RationalEngine.toDecimalString(new Rational(3, 2))).toBe('1.5');
            expect(RationalEngine.toDecimalString(new Rational(1, 3))).toBe('0.3333333333');
            expect(RationalEngine.toDecimalString(new Rational(1, 3), 8)).toBe('0.33333333');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. PERFEIÇÃO DO SUBSISTEMA DE MATRIZES & TRUNCAMENTO VISUAL
    // ─────────────────────────────────────────────────────────────
    describe('2. Matrizes Inline & Truncamento Visual (formatMatrixLaTeX e mutable_originalMatrix)', () => {
        it('deve manter matrizes pequenas (<= 6x6) intactas sem reticências', () => {
            const m2x2 = [[1, 2], [3, 4]];
            const res = MatrixEngine.formatMatrixLaTeX(m2x2, 6, 6);
            expect(res.isTruncated).toBe(false);
            expect(res.rows).toBe(2);
            expect(res.cols).toBe(2);
            expect(res.latex).toBe('\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}');
        });

        it('deve truncar matrizes grandes (> 6x6) com cdots, vdots, ddots e selo de dimensão', () => {
            const m7x7: number[][] = [];
            for (let r = 0; r < 7; r++) {
                const row: number[] = [];
                for (let c = 0; c < 7; c++) row.push((r + 1) * 10 + (c + 1));
                m7x7.push(row);
            }

            const res = MatrixEngine.formatMatrixLaTeX(m7x7, 6, 6);
            expect(res.isTruncated).toBe(true);
            expect(res.rows).toBe(7);
            expect(res.cols).toBe(7);
            expect(res.latex).toContain('\\cdots');
            expect(res.latex).toContain('\\vdots');
            expect(res.latex).toContain('\\ddots');
            expect(res.latex.startsWith('\\begin{bmatrix}')).toBe(true);
            expect(res.latex.endsWith('\\end{bmatrix}')).toBe(true);
        });

        it('deve executar todas as operações matriciais simbólicas e numéricas', () => {
            const A = [[1, 2], [3, 4]];
            const B = [[2, 0], [1, 2]];

            expect(MatrixEngine.determinant(A)).toBe(-2);
            expect(MatrixEngine.trace(A)).toBe(5);
            expect(MatrixEngine.add(A, B)).toEqual([[3, 2], [4, 6]]);
            expect(MatrixEngine.multiply(A, B)).toEqual([[4, 4], [10, 8]]);
            expect(MatrixEngine.transpose(A)).toEqual([[1, 3], [2, 4]]);
            expect(MatrixEngine.rank([[1, 2], [2, 4]])).toBe(1);

            // Transformação Linear sobre pontos: R90 * (1, 0) -> (0, 1)
            const rot90 = [[0, -1], [1, 0]];
            const transformed = MatrixEngine.transformPoint(rot90, { x: 1, y: 0 });
            expect(transformed.x).toBeCloseTo(0);
            expect(transformed.y).toBeCloseTo(1);
        });

        it('deve analisar fração racional com parseFractionInfo integrado ao RationalEngine', () => {
            const f1 = ExpressionManager.parseFractionInfo('1.5');
            expect(f1).not.toBeNull();
            expect(f1!.fractionLatex).toBe('\\frac{3}{2}');
            expect(f1!.decimalStr).toBe('1.5');
            expect(f1!.isRational).toBe(true);

            const f2 = ExpressionManager.parseFractionInfo('3/2');
            expect(f2).not.toBeNull();
            expect(f2!.fractionLatex).toBe('\\frac{3}{2}');

            const f3 = ExpressionManager.parseFractionInfo('\\frac{6}{4}');
            expect(f3).not.toBeNull();
            expect(f3!.fractionLatex).toBe('\\frac{3}{2}'); // Simplificada por MDC!

            const fInt = ExpressionManager.parseFractionInfo('4');
            expect(fInt).toBeNull(); // Inteiro puro não tem toggle fracionário
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. POLÍTICAS 2D (cx) vs 3D (wC) E TRAVAS DE CUSTO (Ht)
    // ─────────────────────────────────────────────────────────────
    describe('3. Políticas 2D vs. 3D e Travas de Custo (Ht)', () => {
        it('deve permitir z como slider em 2D e reservar z em 3D', () => {
            const p2d = PolicyManager.getPolicy(false);
            const p3d = PolicyManager.getPolicy(true);

            expect(p2d.name).toBe('2D');
            expect(p2d.is3D).toBe(false);
            expect(p2d.isValidSlider('z')).toBe(true);
            expect(p2d.isValidSlider('a')).toBe(true);
            expect(p2d.isValidSlider('x')).toBe(false);
            expect(p2d.isValidSlider('y')).toBe(false);
            expect(p2d.isValidSlider('t')).toBe(false);

            expect(p3d.name).toBe('3D');
            expect(p3d.is3D).toBe(true);
            expect(p3d.isValidSlider('z')).toBe(false); // Em 3D, z é coordenada espacial!
            expect(p3d.isValidSlider('x')).toBe(false);
            expect(p3d.isValidSlider('y')).toBe(false);
            expect(p3d.isValidSlider('a')).toBe(true);
            expect(p3d.isValidSlider('k')).toBe(true);
        });

        it('deve avaliar a promoção a slider de acordo com a política oficial', () => {
            const p2d = PolicyManager.getPolicy(false);
            expect(p2d.shouldPromoteToSlider(5, 'm')).toBe(true);
            expect(p2d.shouldPromoteToSlider(['Negate', 2.5], 'k')).toBe(true);
            expect(p2d.shouldPromoteToSlider(['Add', 1, 2], 'm')).toBe(false); // Expressão não-constante
            expect(p2d.shouldPromoteToSlider(5, 'x')).toBe(false); // x é coordenada reservada
        });

        it('deve limitar custo de shaders WebGL prevenindo travamentos e TDR (CostBudgetManager)', () => {
            const simpleAst = ['Add', 'x', 'y'];
            const simpleCost = CostBudgetManager.checkShaderCost(simpleAst);
            expect(simpleCost.canCompile).toBe(true);

            // Rejeição por tamanho excessivo de lista na GPU (> 100)
            const listCost = CostBudgetManager.checkShaderCost(simpleAst, { my_list: 150 });
            expect(listCost.canCompile).toBe(false);
            expect(listCost.reason).toContain('excede o limite seguro da GPU');

            // Rejeição por profundidade excessiva de árvore
            let deepAst: any = 'x';
            for (let i = 0; i < 45; i++) {
                deepAst = ['Sin', deepAst];
            }
            const deepCost = CostBudgetManager.checkShaderCost(deepAst);
            expect(deepCost.canCompile).toBe(false);
            expect(deepCost.reason).toContain('complexa demais para shader GPU');
        });
    });
});
