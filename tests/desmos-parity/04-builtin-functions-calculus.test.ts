import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { ListEngine } from '../../src/core/listEngine';
import { MatrixEngine } from '../../src/core/matrixEngine';
import { PointEngine } from '../../src/core/pointEngine';
import { RationalEngine } from '../../src/core/rationalEngine';
import { LatexNormalizer } from '../../src/core/latexNormalizer';

describe('Desmos Parity Module 04: Built-in Functions, Domains, Calculus & Statistics', () => {
    beforeEach(() => {
        StateManager.clearAll();
        StateManager.angleMode = 'radians';
        MathEngine.initCompiledFuncs();
    });

    it('evaluates log base 10, ln base e, and custom base \\log_2(8)', () => {
        expect(MathEngine.evaluateAST(new PrattParser('log(100)').parseExpression())).toBeCloseTo(2, 6);
        expect(MathEngine.evaluateAST(new PrattParser('ln(e^3)').parseExpression())).toBeCloseTo(3, 6);
        const norm = LatexNormalizer.normalize('\\log_{2}(8)');
        expect(MathEngine.evaluateAST(new PrattParser(norm).parseExpression())).toBeCloseTo(3, 6);
    });

    it('respects radians vs degrees angle modes for trigonometric functions', () => {
        expect(MathEngine.evaluateAST(new PrattParser('sin(pi/2)').parseExpression())).toBeCloseTo(1, 6);
        StateManager.angleMode = 'degrees';
        expect(MathEngine.evaluateAST(new PrattParser('sin(90)').parseExpression())).toBeCloseTo(1, 6);
    });

    it('Phase A: preserves whitespace before element count in ListEngine.formatListDisplay', () => {
        const list = ListEngine.generateRange(1, 10);
        const formatted = ListEngine.formatListDisplay(list);
        expect(formatted).toBe('= [1, 2, 3, 4, 5, ...] (10 elementos)');
    });

    it('Phase A: produces NaN/Infinity on 0/0, 1/0, and exp(1000) in local AST evaluator for indef/∞ detection', () => {
        const zeroOverZero = MathEngine.evaluateAST(new PrattParser('0/0').parseExpression());
        expect(Number.isNaN(zeroOverZero)).toBe(true);

        const oneOverZero = MathEngine.evaluateAST(new PrattParser('1/0').parseExpression());
        expect(Number.isNaN(oneOverZero)).toBe(true);

        const overflowExp = MathEngine.evaluateAST(new PrattParser('exp(1000)').parseExpression());
        expect(overflowExp).toBe(Infinity);
    });

    it('evaluates finite definite integrals numerically via evaluateDefiniteIntegral', () => {
        const ast = new PrattParser('sqrt(1 - x^2)').parseExpression();
        const area = MathEngine.evaluateDefiniteIntegral(ast, -1, 1, 'x', {});
        expect(area).toBeCloseTo(Math.PI / 2, 2);
    });

    // Phase C & D roadmap parity checks
    it('Phase C: evaluates \\sum_{n=1}^{10} n and \\prod_{n=1}^{5} n directly in MathEngine.evaluateAST & toJS', () => {
        const sumAst = new PrattParser(LatexNormalizer.normalize('\\sum_{n=1}^{10} n')).parseExpression();
        expect(MathEngine.evaluateAST(sumAst, {})).toBe(55);
        expect(MathEngine.compile(sumAst, 'x')(0, 0, {})).toBe(55);

        const prodAst = new PrattParser(LatexNormalizer.normalize('\\prod_{n=1}^{5} n')).parseExpression();
        expect(MathEngine.evaluateAST(prodAst, {})).toBe(120);
        expect(MathEngine.compile(prodAst, 'x')(0, 0, {})).toBe(120);

        const compoundAst = new PrattParser(LatexNormalizer.normalize('\\sum_{n=1}^{5} n + \\sum_{k=1}^{4} k')).parseExpression();
        expect(MathEngine.evaluateAST(compoundAst, {})).toBe(25);

        const nestedAst = new PrattParser(LatexNormalizer.normalize('\\sum_{i=1}^{3} \\sum_{j=1}^{i} j')).parseExpression();
        expect(MathEngine.evaluateAST(nestedAst, {})).toBe(10);

        const sumWithXAst = new PrattParser(LatexNormalizer.normalize('\\sum_{n=1}^{3} n \\cdot x')).parseExpression();
        expect(MathEngine.evaluateAST(sumWithXAst, { x: 2 })).toBe(12);
        expect(MathEngine.compile(sumWithXAst, 'x')(2, 0, {})).toBe(12);

        const listProdAst = new PrattParser('prod([2, 3, 4])').parseExpression();
        expect(MathEngine.evaluateAST(listProdAst, {})).toBe(24);

        expect(MathEngine.normalizeFractionDisplay('4*pi/8')).toBe('pi/2');
        expect(MathEngine.normalizeFractionDisplay('6*pi/4')).toBe('3*pi/2');
    });

    it('Phase C: evaluates improper integrals \\int_{-\\infty}^{\\infty} e^{-x^2} dx = sqrt(pi) via coordinate transform', () => {
        const gaussAst = new PrattParser(LatexNormalizer.normalize('e^{-x^2}')).parseExpression();
        const gaussArea = MathEngine.evaluateDefiniteIntegral(gaussAst, -Infinity, Infinity, 'x', {});
        expect(gaussArea).toBeCloseTo(Math.sqrt(Math.PI), 4);

        const expDecayAst = new PrattParser(LatexNormalizer.normalize('e^{-x}')).parseExpression();
        const halfInfArea = MathEngine.evaluateDefiniteIntegral(expDecayAst, 0, Infinity, 'x', {});
        expect(halfInfArea).toBeCloseTo(1, 5);

        const cauchyAst = new PrattParser('1 / (1 + x^2)').parseExpression();
        const cauchyHalf = MathEngine.evaluateDefiniteIntegral(cauchyAst, 0, Infinity, 'x', {});
        expect(cauchyHalf).toBeCloseTo(Math.PI / 2, 5);

        // Discontinuous narrow piecewise pulse: area = 0.1
        const pulseAst = new PrattParser(LatexNormalizer.normalize('\\left\\{0.9 < x < 1: 1, 0\\right\\}')).parseExpression();
        const pulseArea = MathEngine.evaluateDefiniteIntegral(pulseAst, -2, 2, 'x', {});
        expect(pulseArea).toBeCloseTo(0.1, 3);

        // Leibniz \frac{d}{dx} evaluation in evaluateAST and compile
        const diffAst = new PrattParser(LatexNormalizer.normalize('\\frac{d}{dx}(x^3)')).parseExpression();
        expect(MathEngine.evaluateAST(diffAst, { x: 2 })).toBeCloseTo(12, 3);
        expect(MathEngine.compile(diffAst, 'x')(2, 0, {})).toBeCloseTo(12, 3);
    });

    it('Phase C: evaluates built-ins erf(1), mod(10,3), round(1234,-2), nPr(4,3), nCr(4,3), arsinh, arctan(5,2)', () => {
        const ev = (expr: string) => {
            const ast = new PrattParser(LatexNormalizer.normalize(expr)).parseExpression();
            return {
                astEval: MathEngine.evaluateAST(ast, {}),
                jitEval: MathEngine.compile(ast, 'x')(0, 0, {})
            };
        };

        const rErf = ev('erf(1)');
        expect(rErf.astEval).toBeCloseTo(0.84270079, 6);
        expect(rErf.jitEval).toBeCloseTo(0.84270079, 6);

        const rModPos = ev('mod(10, 3)');
        expect(rModPos.astEval).toBe(1);
        expect(rModPos.jitEval).toBe(1);
        expect(MathEngine.evaluateAST(new PrattParser('mod(-1, 3)').parseExpression(), {})).toBe(2);

        const rRoundNeg = ev('round(1234, -2)');
        expect(rRoundNeg.astEval).toBe(1200);
        expect(rRoundNeg.jitEval).toBe(1200);
        expect(ev('round(3.14159, 2)').astEval).toBeCloseTo(3.14, 10);

        const rNpr = ev('nPr(4, 3)');
        expect(rNpr.astEval).toBe(24);
        expect(rNpr.jitEval).toBe(24);

        const rNcr = ev('nCr(4, 3)');
        expect(rNcr.astEval).toBe(4);
        expect(rNcr.jitEval).toBe(4);

        const rArsinh = ev('arsinh(1)');
        expect(rArsinh.astEval).toBeCloseTo(Math.asinh(1), 8);
        expect(rArsinh.jitEval).toBeCloseTo(Math.asinh(1), 8);
        expect(ev('arcosh(2)').astEval).toBeCloseTo(Math.acosh(2), 8);
        expect(ev('artanh(0.5)').astEval).toBeCloseTo(Math.atanh(0.5), 8);

        const rAtan2 = ev('arctan(5, 2)');
        expect(rAtan2.astEval).toBeCloseTo(Math.atan2(5, 2), 8);
        expect(rAtan2.jitEval).toBeCloseTo(Math.atan2(5, 2), 8);
    });

    it('Phase C: evaluates statistics cov, corr, spearman, quartile, quantile, mad, seeded random(L, 10, seed)', () => {
        const A = [1, 2, 3, 4, 5];
        const B = [2, 4, 5, 4, 5];
        const scope: Record<string, any> = { L: [1, 2, 3, 4], A, B };
        const ev = (expr: string) => {
            const ast = new PrattParser(LatexNormalizer.normalize(expr)).parseExpression();
            return MathEngine.evaluateAST(ast, scope);
        };

        expect(ev('cov(A, B)')).toBeCloseTo(1.5, 8);
        expect(ev('covp(A, B)')).toBeCloseTo(1.2, 8);
        expect(ev('corr(A, B)')).toBeCloseTo(1.5 / Math.sqrt(2.5 * 1.5), 8);
        expect(ev('spearman([1, 2, 3, 4], [10, 20, 30, 40])')).toBeCloseTo(1, 8);
        expect(ev('spearman(A, B)')).toBeCloseTo(7 / Math.sqrt(90), 8);

        // Desmos quartile (median of halves) vs quantile (linear interpolation p*(n-1))
        expect(ev('quartile(L, 1)')).toBeCloseTo(1.5, 8);
        expect(ev('quartile(L, 2)')).toBeCloseTo(2.5, 8);
        expect(ev('quartile(L, 3)')).toBeCloseTo(3.5, 8);
        expect(ev('quantile(L, 0.25)')).toBeCloseTo(1.75, 8);
        expect(ev('quantile(L, 0.75)')).toBeCloseTo(3.25, 8);

        expect(ev('mad(A)')).toBeCloseTo(1.2, 8);
        expect(ev('stdevp(L)')).toBeCloseTo(Math.sqrt(1.25), 8);
        expect(ev('varp(L)')).toBeCloseTo(1.25, 8);
        expect(ev('A.mad')).toBeCloseTo(1.2, 8);
        expect(ev('L.varp')).toBeCloseTo(1.25, 8);

        const s1 = ev('random(L, 10, 42)');
        const s2 = ev('random(L, 10, 42)');
        const s3 = ev('random(L, 10, 99)');
        expect(Array.isArray(s1)).toBe(true);
        expect(s1.length).toBe(10);
        expect(s1).toEqual(s2);
        expect(s1).not.toEqual(s3);
    });
    it('Phase D: evaluates matrix-valued definite integrals \\int_0^1 [[x,x^2],[x^3,x^4]] dx', () => {
        const clean = LatexNormalizer.normalize('\\int_{0}^{1} [[x,x^2],[x^3,x^4]] dx');
        const ast = new PrattParser(clean).parseExpression();
        expect(ast[0]).toBe('Integrate');

        const low = MathEngine.evaluateAST(ast[3], {});
        const upp = MathEngine.evaluateAST(ast[4], {});
        const matRes = MathEngine.evaluateDefiniteIntegral(ast[1], low, upp, ast[2], {});
        expect(MatrixEngine.isMatrix(matRes)).toBe(true);
        expect(matRes[0][0]).toBeCloseTo(0.5, 9);
        expect(matRes[0][1]).toBeCloseTo(1 / 3, 9);
        expect(matRes[1][0]).toBeCloseTo(0.25, 9);
        expect(matRes[1][1]).toBeCloseTo(0.2, 9);

        expect(RationalEngine.fromNumber(matRes[0][0])).toMatchObject({ n: 1, d: 2 });
        expect(RationalEngine.fromNumber(matRes[0][1])).toMatchObject({ n: 1, d: 3 });
        expect(RationalEngine.fromNumber(matRes[1][0])).toMatchObject({ n: 1, d: 4 });
        expect(RationalEngine.fromNumber(matRes[1][1])).toMatchObject({ n: 1, d: 5 });

        const ptAst = new PrattParser(LatexNormalizer.normalize('\\int_{0}^{1} (x, x^2) dx')).parseExpression();
        const ptRes = MathEngine.evaluateDefiniteIntegral(ptAst[1], 0, 1, 'x', {});
        expect(PointEngine.isPoint(ptRes)).toBe(true);
        expect(ptRes.x).toBeCloseTo(0.5, 9);
        expect(ptRes.y).toBeCloseTo(1 / 3, 9);

        const listAst = new PrattParser(LatexNormalizer.normalize('\\int_{0}^{1} [x, x^2, x^3] dx')).parseExpression();
        const listRes = MathEngine.evaluateDefiniteIntegral(listAst[1], 0, 1, 'x', {});
        expect(Array.isArray(listRes)).toBe(true);
        expect(listRes[0]).toBeCloseTo(0.5, 9);
        expect(listRes[1]).toBeCloseTo(1 / 3, 9);
        expect(listRes[2]).toBeCloseTo(0.25, 9);
    });
});
