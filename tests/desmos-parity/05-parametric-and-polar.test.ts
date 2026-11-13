import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import { FaultTolerantParser } from '../../src/core/faultTolerantParser';

describe('Desmos Parity Module 05: Parametric & Polar Curves', () => {
    beforeEach(() => {
        StateManager.clearAll();
        StateManager.angleMode = 'radians';
        MathEngine.initCompiledFuncs();
    });

    it('parses parametric tuple (-cos(t), sin(t)) into Point AST and evaluates along t', () => {
        const clean = LatexNormalizer.normalize('(-\\cos(t), \\sin(t))');
        const ast = new PrattParser(clean).parseExpression();
        expect(ast[0]).toBe('Point');

        const p0 = MathEngine.evaluateAST(ast, { t: 0 });
        expect(p0.x).toBeCloseTo(-1, 6);
        expect(p0.y).toBeCloseTo(0, 6);

        const pHalf = MathEngine.evaluateAST(ast, { t: Math.PI / 2 });
        expect(pHalf.x).toBeCloseTo(0, 6);
        expect(pHalf.y).toBeCloseTo(1, 6);
    });

    it('normalizes and parses polar equation r = \\sqrt{\\theta} cleanly', () => {
        const clean = LatexNormalizer.normalize('r = \\sqrt{\\theta}');
        const rhsAst = new PrattParser(clean.split('=')[1].trim()).parseExpression();
        expect(rhsAst).toEqual(['Sqrt', 'theta']);
        const free = FaultTolerantParser.detectFreeVariables(clean, ['r', 'theta', 'x', 'y'], true);
        expect(free).toEqual([]);
    });

    // Phase D roadmap parity checks
    it.todo('Phase D: uses default 0 <= t <= 1 domain for (-cos(t), sin(t)) and 0 <= theta <= 12*pi for polar curves');
    it.todo('Phase D: renders inline editable parametric/polar domain bounds in expression rows');
    it.todo('Phase D: plots parametric curves returned by functions and comprehensions: t_1(x), (t^2, t) for -2<t<2');
    it.todo('Phase D: supports parametric fill and CW/CCW inner-hole exclusion');
    it.todo('Phase D: plots implicit polar equations such as 2*r*cos(theta) = 1');
});
