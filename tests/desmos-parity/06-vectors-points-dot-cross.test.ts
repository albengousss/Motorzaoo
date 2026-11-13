import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { PointEngine } from '../../src/core/pointEngine';
import { ListEngine } from '../../src/core/listEngine';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import { DesmosSemanticError } from '../../src/core/policy';

describe('Desmos Parity Module 06: Points, Vectors 2D/3D, Dot Product & Cross Product', () => {
    beforeEach(() => {
        StateManager.clearAll();
        MathEngine.initCompiledFuncs();
    });

    it('evaluates 2D and 3D vector arithmetic (+, -, scale, dot, distance, magnitude)', () => {
        expect(PointEngine.add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
        expect(PointEngine.subtract({ x: 6, y: 5, z: 4 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 5, y: 3, z: 1 });
        expect(PointEngine.scale({ x: 1, y: 2 }, 3)).toEqual({ x: 3, y: 6 });
        expect(PointEngine.dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
        expect(PointEngine.distance({ x: 1, y: 2 }, { x: 4, y: 6 })).toBeCloseTo(5, 6);
        expect(PointEngine.formatPointDisplay({ x: 7, y: -14, z: 7 })).toBe('(7, -14, 7)');
    });

    it('computes 3D cross product via PointEngine.cross((6,5,4), (1,2,3)) = (7, -14, 7)', () => {
        const res = PointEngine.cross({ x: 6, y: 5, z: 4 }, { x: 1, y: 2, z: 3 });
        expect(res).toEqual({ x: 7, y: -14, z: 7 });
    });

    it('evaluates point addition and dot product via MathEngine AST', () => {
        const addAst = new PrattParser('(1, 2) + (3, 4)').parseExpression();
        expect(MathEngine.evaluateAST(addAst)).toEqual({ x: 4, y: 6 });

        const dotAst = new PrattParser('(1, 2) * (3, 4)').parseExpression();
        expect(MathEngine.evaluateAST(dotAst)).toBe(11);
    });

    it('constructs polygon vertex lists cleanly with ListEngine.createPolygon', () => {
        const poly = ListEngine.createPolygon([-1, 0, 1], [4, 5, 4]);
        expect(poly).toEqual([{ x: -1, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 4 }]);
    });

    // Phase C roadmap parity checks
    it('Phase C: evaluates 3D \\times cross product inside MathEngine.evaluateAST and MathEngine.toJS', () => {
        const norm = LatexNormalizer.normalize('(6, 5, 4) \\times (1, 2, 3)', '');
        const ast = new PrattParser(norm).parseExpression();
        expect(MathEngine.evaluateAST(ast)).toEqual({ x: 7, y: -14, z: 7 });

        const compiledFn = MathEngine.compile(ast);
        expect(compiledFn(0, 0, {})).toEqual({ x: 7, y: -14, z: 7 });

        // Scalar \times scalar remains standard multiplication
        const scalarAst = new PrattParser(LatexNormalizer.normalize('2 \\times 3', '')).parseExpression();
        expect(MathEngine.evaluateAST(scalarAst)).toBe(6);
    });

    it('Phase C: returns semantic type error when applying cross product \\times to 2D points instead of scalar -2', () => {
        const norm2d = LatexNormalizer.normalize('(1, 2) \\times (3, 4)', '');
        const ast2d = new PrattParser(norm2d).parseExpression();
        expect(() => MathEngine.evaluateAST(ast2d)).toThrowError(DesmosSemanticError);

        const compiled2d = MathEngine.compile(ast2d);
        expect(() => compiled2d(0, 0, {})).toThrowError(DesmosSemanticError);

        // Mixed 2D and 3D point also throws explicit semantic error
        const normMixed = LatexNormalizer.normalize('(1, 2) \\times (1, 2, 3)', '');
        const astMixed = new PrattParser(normMixed).parseExpression();
        expect(() => MathEngine.evaluateAST(astMixed)).toThrowError(DesmosSemanticError);
    });

    it('Phase C: broadcasts 3D cross product over lists of 3D points', () => {
        const normList = LatexNormalizer.normalize('[(1, 0, 0), (0, 1, 0)] \\times [(0, 1, 0), (0, 0, 1)]', '');
        const astList = new PrattParser(normList).parseExpression();
        const result = MathEngine.evaluateAST(astList);
        expect(result).toEqual([
            { x: 0, y: 0, z: 1 },
            { x: 1, y: 0, z: 0 }
        ]);
        expect(ListEngine.formatListDisplay(result)).toBe('= [(0, 0, 1), (1, 0, 0)]');

        // Point \times list of 3D points
        const normBroadcast = LatexNormalizer.normalize('(1, 0, 0) \\times [(0, 1, 0), (0, 0, 1)]', '');
        const resBroadcast = MathEngine.evaluateAST(new PrattParser(normBroadcast).parseExpression());
        expect(resBroadcast).toEqual([
            { x: 0, y: 0, z: 1 },
            { x: 0, y: -1, z: 0 }
        ]);
    });

    it('Phase C: supports .z accessor, midpoint(), and 3D point formatting in 2D/3D', () => {
        StateManager.defineVariable('p_a', new PrattParser('(2, 4, 6)').parseExpression());
        StateManager.defineVariable('p_b', new PrattParser('(4, 8, 10)').parseExpression());

        const zAst = new PrattParser('p_a.z').parseExpression();
        expect(MathEngine.evaluateAST(zAst, StateManager.values)).toBe(6);
        expect(MathEngine.compile(zAst)(0, 0, StateManager.values)).toBe(6);

        const midAst = new PrattParser(LatexNormalizer.normalize('midpoint(p_a, p_b)', '')).parseExpression();
        expect(MathEngine.evaluateAST(midAst, StateManager.values)).toEqual({ x: 3, y: 6, z: 8 });
        expect(MathEngine.compile(midAst)(0, 0, StateManager.values)).toEqual({ x: 3, y: 6, z: 8 });
        expect(PointEngine.formatPointDisplay(MathEngine.evaluateAST(midAst, StateManager.values))).toBe('(3, 6, 8)');
    });
});
