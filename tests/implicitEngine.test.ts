import { describe, it, expect } from 'vitest';
import { ImplicitEngine } from '../src/core/implicitEngine';

describe('ImplicitEngine Tests (Items 9, 10, 11)', () => {
    it('Item 11: cache key differentiates by operator', () => {
        const circleAst = ['Subtract', ['Add', ['Power', 'x', 2], ['Power', 'y', 2]], 4]; // x^2 + y^2 - 4

        // Equality: x^2 + y^2 = 4 (only segments, no fills)
        const eqGeom = ImplicitEngine.generateImplicit('circle1', circleAst, '=', {}, -3, 3, -3, 3);
        expect(eqGeom.segments.length).toBeGreaterThan(0);
        expect(eqGeom.fills.length).toBe(0);

        // Inequality with same id: x^2 + y^2 <= 4 (has fills)
        const ineqGeom = ImplicitEngine.generateImplicit('circle1', circleAst, '<=', {}, -3, 3, -3, 3);
        expect(ineqGeom.fills.length).toBeGreaterThan(0);
        // Ensure eqGeom and ineqGeom are not returning the same cached geometry
        expect(ineqGeom).not.toBe(eqGeom);
    });

    it('Item 10: saddle point Marching Squares disambiguation for case 5 and 10', () => {
        // Hyperbolic saddle: z = x * y
        const saddleAst = ['Multiply', 'x', 'y'];
        const geom = ImplicitEngine.generateImplicit('saddle', saddleAst, '=', {}, -2, 2, -2, 2);
        expect(geom.segments.length).toBeGreaterThan(0);
    });

    it('Item 9: BFS subdivision generates complete geometry across viewport', () => {
        const lineAst = ['Subtract', ['Add', 'x', 'y'], 0]; // x + y = 0
        const geom = ImplicitEngine.generateImplicit('line', lineAst, '=', {}, -5, 5, -5, 5);
        expect(geom.segments.length).toBeGreaterThan(10);
    });
});
