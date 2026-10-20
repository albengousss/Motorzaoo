import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { ListEngine } from '../src/core/listEngine';
import { LatexNormalizer } from '../src/core/latexNormalizer';
import { StateManager } from '../src/core/stateManager';
import { GLRenderer } from '../src/graphics/glRenderer';
import { ImplicitEngine } from '../src/core/implicitEngine';

describe('Audit Fixes Regression & Desmos Parity Suite', () => {

    beforeEach(() => {
        StateManager.clearAll();
        StateManager.angleMode = 'radians';
        MathEngine.initCompiledFuncs();
    });

    // -------------------------------------------------------------------------
    // 1. Logarithm Base: log (base 10) vs ln (base e) vs custom base log(b, x)
    // -------------------------------------------------------------------------
    describe('1. Logarithms (log vs ln)', () => {
        it('evaluates log as base 10', () => {
            const ast = new PrattParser('log(10)').parseExpression();
            expect(ast[0]).toBe('Log');
            const res = MathEngine.evaluateAST(ast);
            expect(res).toBeCloseTo(1, 6);

            const ast100 = new PrattParser('log(100)').parseExpression();
            expect(MathEngine.evaluateAST(ast100)).toBeCloseTo(2, 6);

            const compiled = MathEngine.compile(ast);
            expect(compiled(0, 0, {})).toBeCloseTo(1, 6);
        });

        it('evaluates ln as base e', () => {
            const ast = new PrattParser('ln(e)').parseExpression();
            expect(ast[0]).toBe('Ln');
            const res = MathEngine.evaluateAST(ast);
            expect(res).toBeCloseTo(1, 6);

            const ast1 = new PrattParser('ln(1)').parseExpression();
            expect(MathEngine.evaluateAST(ast1)).toBeCloseTo(0, 6);
        });

        it('evaluates custom base log(2, 8) = 3 and \\log_{2}(8)', () => {
            const ast28 = new PrattParser('log(2, 8)').parseExpression();
            expect(ast28).toEqual(['Log', 2, 8]);
            const res28 = MathEngine.evaluateAST(ast28);
            expect(res28).toBeCloseTo(3, 6);

            // Normalized \log_{2}(8)
            const norm = LatexNormalizer.normalize('\\log_{2}(8)');
            const astNorm = new PrattParser(norm).parseExpression();
            const resNorm = MathEngine.evaluateAST(astNorm);
            expect(resNorm).toBeCloseTo(3, 6);
        });

        it('emits correct GLSL for Ln and Log', () => {
            const astLn = ['Ln', 'x'];
            const glslLn = GLRenderer.astToGLSL(astLn, {}, new Set());
            expect(glslLn).toContain('log(max(1e-8, x))');

            const astLog = ['Log', 'x'];
            const glslLog = GLRenderer.astToGLSL(astLog, {}, new Set());
            expect(glslLog).toContain('0.4342944819032518');
        });
    });

    // -------------------------------------------------------------------------
    // 2. Angle Mode: degrees vs radians propagation
    // -------------------------------------------------------------------------
    describe('2. Angle Mode (degrees vs radians)', () => {
        it('propagates degrees mode to vectorized ListEngine operations', () => {
            StateManager.angleMode = 'degrees';
            const astDeg = new PrattParser('sin([0, 90, 180])').parseExpression();
            const resDeg = MathEngine.evaluateAST(astDeg);
            expect(resDeg[0]).toBeCloseTo(0, 5);
            expect(resDeg[1]).toBeCloseTo(1, 5);
            expect(resDeg[2]).toBeCloseTo(0, 5);

            StateManager.angleMode = 'radians';
            const astRad = new PrattParser('sin([0, pi/2, pi])').parseExpression();
            const resRad = MathEngine.evaluateAST(astRad);
            expect(resRad[0]).toBeCloseTo(0, 5);
            expect(resRad[1]).toBeCloseTo(1, 5);
            expect(resRad[2]).toBeCloseTo(0, 5);
        });

        it('converts inverse trig outputs to degrees in ListEngine', () => {
            StateManager.angleMode = 'degrees';
            const astAsin = new PrattParser('asin([0, 0.5, 1])').parseExpression();
            const res = MathEngine.evaluateAST(astAsin);
            expect(res[0]).toBeCloseTo(0, 4);
            expect(res[1]).toBeCloseTo(30, 4);
            expect(res[2]).toBeCloseTo(90, 4);
        });

        it('supports degrees in multivariable inverse trig (asec, acsc, acot)', () => {
            StateManager.angleMode = 'degrees';
            const ast = new PrattParser('asec(2)').parseExpression();
            const fn = MathEngine.compileMultivariable(ast, ['x']);
            const res = fn(0);
            expect(res).toBeCloseTo(60, 4); // asec(2) = acos(0.5) = 60 deg
        });

        it('applies angle mode to interval arithmetic', () => {
            StateManager.angleMode = 'degrees';
            const ops = (MathEngine as any).intervalOps;
            const resSin = ops.intSin({ min: 0, max: 90 });
            expect(resSin.min).toBeCloseTo(0, 4);
            expect(resSin.max).toBeCloseTo(1, 4);

            const resAtan = ops.intAtan({ min: 0, max: 1 });
            expect(resAtan.min).toBeCloseTo(0, 4);
            expect(resAtan.max).toBeCloseTo(45, 4); // atan(1) = 45 deg
        });

        it('wraps GLSL angles with degrees conversion factor', () => {
            StateManager.angleMode = 'degrees';
            const ast = ['Sin', 'x'];
            const glsl = GLRenderer.astToGLSL(ast, {}, new Set());
            expect(glsl).toContain('0.017453292519943295');

            const astAsin = ['Asin', 'x'];
            const glslAsin = GLRenderer.astToGLSL(astAsin, {}, new Set());
            expect(glslAsin).toContain('57.29577951308232');
        });
    });

    // -------------------------------------------------------------------------
    // 3. Window Global Leakage Protection
    // -------------------------------------------------------------------------
    describe('3. Window Global Leakage Protection', () => {
        it('does not leak window properties (name, length, status, closed, self, top)', () => {
            const astName = new PrattParser('name + 5').parseExpression();
            const jsName = MathEngine.toJS(astName);
            const fnName = new Function('x', 'y', 'scope', 'funcs', `return ${jsName};`);
            
            // Without scope definition, should return 0 + 5 = 5 (and NOT window.name which is string "")
            expect(fnName(0, 0, {}, MathEngine.compiledFuncs)).toBe(5);

            // With scope definition, should return scope value
            expect(fnName(0, 0, { name: 10 }, MathEngine.compiledFuncs)).toBe(15);
        });

        it('does not leak window.length or window.status', () => {
            const astLen = new PrattParser('length * 2').parseExpression();
            const jsLen = MathEngine.toJS(astLen);
            const fnLen = new Function('x', 'y', 'scope', 'funcs', `return ${jsLen};`);
            expect(fnLen(0, 0, {}, MathEngine.compiledFuncs)).toBe(0);
            expect(fnLen(0, 0, { length: 7 }, MathEngine.compiledFuncs)).toBe(14);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Higher Order Derivatives (f''', f'''') & Arbitrary Variable
    // -------------------------------------------------------------------------
    describe('4. Derivatives (higher order & arbitrary variable)', () => {
        it('normalizes multi-prime derivatives without collapsing to 2nd order', () => {
            const norm3 = LatexNormalizer.normalize("f'''(x)");
            expect(norm3).toContain("f'''(x)");

            const normPrime3 = LatexNormalizer.normalize("f^{\\prime\\prime\\prime}(x)");
            expect(normPrime3).toContain("f'''(x)");

            const norm4 = LatexNormalizer.normalize("f''''(x)");
            expect(norm4).toContain("f''''(x)");
        });

        it('computes 1st, 2nd, 3rd, and 4th order numerical derivatives accurately', () => {
            // f(x) = x^4 -> f'(x) = 4x^3, f''(x) = 12x^2, f'''(x) = 24x, f''''(x) = 24
            const ast = new PrattParser('x^4').parseExpression();
            const d1 = MathEngine.createDerivativeFunction(ast, 'x', 1);
            const d2 = MathEngine.createDerivativeFunction(ast, 'x', 2);
            const d3 = MathEngine.createDerivativeFunction(ast, 'x', 3);
            const d4 = MathEngine.createDerivativeFunction(ast, 'x', 4);

            expect(d1(2, 0, {})).toBeCloseTo(32, 2); // 4 * 8 = 32
            expect(d2(2, 0, {})).toBeCloseTo(48, 1); // 12 * 4 = 48
            expect(d3(2, 0, {})).toBeCloseTo(48, 1); // 24 * 2 = 48
            expect(d4(2, 0, {})).toBeCloseTo(24, 0); // 24
        });

        it('supports derivative with respect to arbitrary variable (e.g. t)', () => {
            // f(t) = t^3 -> d/dt(t^3) = 3t^2
            const ast = new PrattParser('t^3').parseExpression();
            const dt = MathEngine.createDerivativeFunction(ast, 't', 1);
            expect(dt(0, 0, { t: 4 })).toBeCloseTo(48, 1); // 3 * 16 = 48
        });
    });

    // -------------------------------------------------------------------------
    // 5. Adaptive Points Sampling: Clamping Removed
    // -------------------------------------------------------------------------
    describe('5. Adaptive Sampling', () => {
        it('does not clamp points to 1e6 flatline', () => {
            const ast = new PrattParser('x^4').parseExpression();
            const points = MathEngine.generatePointsAdaptive(ast, 30, 40, {}, 'x', 200);
            const last = points[points.length - 1];
            // 40^4 = 2,560,000 which is > 1e6
            expect(last.y).toBeGreaterThan(2000000);
        });
    });

    // -------------------------------------------------------------------------
    // 6. Complete State Reset (StateManager.clearAll & ImplicitEngine.clearCache)
    // -------------------------------------------------------------------------
    describe('6. State Reset', () => {
        it('clears all state manager variables, caches, and definitions', () => {
            StateManager.values['a'] = 10;
            StateManager.giacDefinitions['f'] = 'f(x):=x^2';
            StateManager.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: ['Power', 'x', 2], blockId: 'b1' };
            StateManager.casSolutions['b1'] = '2x';
            
            StateManager.clearAll();
            expect(StateManager.values).toEqual({});
            expect(StateManager.giacDefinitions).toEqual({});
            expect(StateManager.userFunctions).toEqual({});
            expect(StateManager.casSolutions).toEqual({});
        });

        it('clears implicit engine quadtree cache', () => {
            expect(typeof ImplicitEngine.clearCache).toBe('function');
            ImplicitEngine.clearCache();
        });
    });
});
