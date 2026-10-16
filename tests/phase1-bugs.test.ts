import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/core/stateManager';
import { ODESolver } from '../src/core/odeSolver';
import { MathAnalyzer } from '../src/core/analyzer';

describe('Fase 1 Regression Tests', () => {
    beforeEach(() => {
        StateManager.values = {};
        StateManager.asts = {};
        StateManager.dependents = {};
        StateManager.varVersions = {};
        StateManager.globalCacheVersion = 0;
    });

    // Item 1: Topological cascade update (Kahn) on diamond A->B->C->D with shortcut A->C
    it('Item 1: cascadeUpdate updates diamond DAG A->B->C->D with shortcut A->C correctly and without stale evaluations', () => {
        // A is slider variable
        StateManager.values['A'] = 1;

        // B = A + 1
        StateManager.defineVariable('B', ['Add', 'A', 1]);
        // C = A + B
        StateManager.defineVariable('C', ['Add', 'A', 'B']);
        // D = C * 2
        StateManager.defineVariable('D', ['Multiply', 'C', 2]);

        expect(StateManager.values['B']).toBe(2);
        expect(StateManager.values['C']).toBe(3); // 1 + 2 = 3
        expect(StateManager.values['D']).toBe(6); // 3 * 2 = 6

        // Update A = 2
        StateManager.updateSlider('A', 2);

        // Expected: B = 3, C = 2 + 3 = 5, D = 5 * 2 = 10
        expect(StateManager.values['B']).toBe(3);
        expect(StateManager.values['C']).toBe(5);
        expect(StateManager.values['D']).toBe(10);
    });

    // Item 2: defineVariable removes name from all dependents[*] before registering new dependencies
    it('Item 2: defineVariable removes previous dependencies before registering new ones', () => {
        // b = a * 2
        StateManager.defineVariable('b', ['Multiply', 'a', 2]);
        expect(StateManager.dependents['a']?.has('b')).toBe(true);

        // redefine b = c * 2
        StateManager.defineVariable('b', ['Multiply', 'c', 2]);
        expect(StateManager.dependents['a']?.has('b')).toBe(false);
        expect(StateManager.dependents['c']?.has('b')).toBe(true);
    });

    // Item 3: recalculate deletes values[name] when result is NaN
    it('Item 3: recalculate deletes values[name] when result is NaN', () => {
        StateManager.values['x'] = 10;
        // Divide by zero or undefined var resulting in NaN
        // In MathEngine, 0 / 0 or NaN expression
        StateManager.defineVariable('x', ['Divide', 0, 0]);
        expect('x' in StateManager.values).toBe(false);
    });

    // Item 4: gc cleans asts and dependents even if not in values
    it('Item 4: gc iterates and cleans asts and dependents for removed variables', () => {
        StateManager.asts['orphanAst'] = ['Add', 1, 2];
        StateManager.dependents['orphanDep'] = new Set(['orphanChild']);

        StateManager.gc([]);

        expect('orphanAst' in StateManager.asts).toBe(false);
        expect('orphanDep' in StateManager.dependents).toBe(false);
    });

    // Item 5: ODESolver handles NaN/Infinity immediately, guards h, checks divergence after y5
    it('Item 5: ODESolver handles NaN/divergence safely without returning NaN or hanging', () => {
        // A function that returns NaN immediately
        const points = ODESolver.solveDormandPrince(() => NaN, 0, 1, 10);
        expect(points.length).toBe(1); // Only initial point {0, 1}
        expect(isNaN(points[0].y)).toBe(false);

        // A function with vertical asymptote / blowup y' = 1 + y^2 at x=0, y=0 (blows up at pi/2 ~ 1.57)
        const blowupPoints = ODESolver.solveDormandPrince((_t, y) => 1 + y * y, 0, 0, 3);
        for (const pt of blowupPoints) {
            expect(isFinite(pt.x)).toBe(true);
            expect(isFinite(pt.y)).toBe(true);
            expect(Math.abs(pt.y)).toBeLessThanOrEqual(1e10);
        }
    });

    // Item 6: ODESolver reuses k[6] as k[0] (FSAL) and preserves identical numerical output
    it('Item 6: ODESolver uses FSAL (First Same As Last) and reduces f evaluations while maintaining exact results', () => {
        let evalCount = 0;
        const f = (t: number, y: number) => {
            evalCount++;
            return -2 * t * y; // exact y = exp(-t^2)
        };

        const res = ODESolver.solveDormandPrince(f, 0, 1, 2, 0.1, 1e-6);
        expect(res.length).toBeGreaterThan(5);

        // Without FSAL, total evaluations is 112.
        // With FSAL, exactly 1 evaluation is saved per accepted step after the first, reducing to 97.
        expect(evalCount).toBeLessThanOrEqual(100);

        // Verify that numerical accuracy matches analytical solution exp(-t^2)
        for (const pt of res) {
            const exact = Math.exp(-pt.x * pt.x);
            expect(Math.abs(pt.y - exact)).toBeLessThan(1e-4);
        }
    });

    // Item 7: getIntersections removes > 20 cutoff and detects coincident curves
    it('Item 7: getIntersections supports > 20 intersections and detects coincident curves', () => {
        // Curve with many intersections: sin(20x) and 0 on [0, 4]
        // In [0, 4], 20x goes from 0 to 80, ~ 80/pi ~ 25 roots
        const f = (x: number) => Math.sin(20 * x);
        const g = (_x: number) => 0;
        const pts = MathAnalyzer.getIntersections(f, g, 0, 4);
        expect(pts.length).toBeGreaterThan(20);

        // Coincident curves should return []
        const fSame = (x: number) => x * x + 1;
        const gSame = (x: number) => x * x + 1;
        const coincident = MathAnalyzer.getIntersections(fSame, gSame, -5, 5);
        expect(coincident.length).toBe(0);
    });

    // Item 8: Double roots promoted to root type
    it('Item 8: MathAnalyzer detects double roots for x^2 and (x-1)^2 as root, not just extremum/intercept', () => {
        // f(x) = (x - 1)^2 has double root at x = 1
        const f1 = (x: number) => (x - 1) * (x - 1);
        const pts1 = MathAnalyzer.getNotablePoints(f1, 0, 2);
        const root1 = pts1.find(p => Math.abs(p.x - 1) < 1e-3);
        expect(root1).toBeDefined();
        expect(root1?.type).toBe('root');

        // f(x) = x^2 has double root at x = 0
        const f2 = (x: number) => x * x;
        const pts2 = MathAnalyzer.getNotablePoints(f2, -2, 2);
        const root2 = pts2.find(p => Math.abs(p.x) < 1e-3);
        expect(root2).toBeDefined();
        expect(root2?.type).toBe('root');

        // f(x) = x^2 + 1 does NOT have a root
        const f3 = (x: number) => x * x + 1;
        const pts3 = MathAnalyzer.getNotablePoints(f3, -2, 2);
        const root3 = pts3.find(p => p.type === 'root');
        expect(root3).toBeUndefined();
    });

    // Deep check: cascadeUpdate recalculation counts & cyclic graphs
    it('Item 1 Deep: cascadeUpdate recalculates each node in diamond DAG exactly once and handles cycles gracefully', () => {
        let cCalcCount = 0;
        let dCalcCount = 0;

        StateManager.values['A'] = 1;
        StateManager.defineVariable('B', ['Add', 'A', 1]);
        StateManager.defineVariable('C', ['Add', 'A', 'B']);
        StateManager.defineVariable('D', ['Multiply', 'C', 2]);

        // Monitor recalculations
        const originalRecalculate = (StateManager as any).recalculate.bind(StateManager);
        (StateManager as any).recalculate = (name: string) => {
            if (name === 'C') cCalcCount++;
            if (name === 'D') dCalcCount++;
            return originalRecalculate(name);
        };

        cCalcCount = 0;
        dCalcCount = 0;
        StateManager.updateSlider('A', 3);

        expect(cCalcCount).toBe(1);
        expect(dCalcCount).toBe(1);
        expect(StateManager.values['C']).toBe(3 + (3 + 1)); // 3 + 4 = 7
        expect(StateManager.values['D']).toBe(14);

        // Cyclic graph A -> B -> A should not freeze and should update B
        StateManager.values = {};
        StateManager.asts = {};
        StateManager.dependents = {};
        StateManager.values['a'] = 1;
        StateManager.defineVariable('b', ['Add', 'a', 1]);
        StateManager.defineVariable('a', ['Add', 'b', 1]);
        StateManager.updateSlider('a', 5);
        expect(StateManager.values['b']).toBe(6);

        // defineVariable propagates updates to existing dependents
        StateManager.values = {};
        StateManager.asts = {};
        StateManager.dependents = {};
        StateManager.values['x'] = 2;
        StateManager.defineVariable('y', ['Multiply', 'x', 2]); // y = 4
        StateManager.defineVariable('z', ['Add', 'y', 1]);       // z = 5
        expect(StateManager.values['z']).toBe(5);

        StateManager.defineVariable('y', ['Multiply', 'x', 10]); // y = 20
        expect(StateManager.values['z']).toBe(21);
    });

    // Deep check: getIntersections detects exact grid roots and tangential intersections
    it('Item 7 Deep: getIntersections finds exact grid roots, transversal lines, and tangential curves', () => {
        // Exact grid zero
        const ptsX0 = MathAnalyzer.getIntersections(x => x, _x => 0, -5, 5);
        expect(ptsX0.length).toBe(1);
        expect(Math.abs(ptsX0[0].x)).toBeLessThan(1e-4);
        expect(Math.abs(ptsX0[0].y)).toBeLessThan(1e-4);

        // Transversal lines intersecting at (0, 0)
        const pts2X = MathAnalyzer.getIntersections(x => 2 * x, x => x, -5, 5);
        expect(pts2X.length).toBe(1);
        expect(Math.abs(pts2X[0].x)).toBeLessThan(1e-4);

        // Tangent contact: x^2 and 0 at (0, 0)
        const ptsTan = MathAnalyzer.getIntersections(x => x * x, _x => 0, -2, 2);
        expect(ptsTan.length).toBe(1);
        expect(Math.abs(ptsTan[0].x)).toBeLessThan(1e-4);
        expect(Math.abs(ptsTan[0].y)).toBeLessThan(1e-4);

        // Tangent contact off-center: (x-1)^2 and 0 at (1, 0)
        const ptsTan1 = MathAnalyzer.getIntersections(x => (x - 1) * (x - 1), _x => 0, 0, 2);
        expect(ptsTan1.length).toBe(1);
        expect(Math.abs(ptsTan1[0].x - 1)).toBeLessThan(1e-4);
    });

    // Deep check: ODESolver.solveBidirectional resets lastTruncated
    it('Item 13 Deep: solveBidirectional resets lastTruncated cleanly', () => {
        // Set lastTruncated to true intentionally
        ODESolver.lastTruncated = true;

        // Normal linear ODE with finite solution y' = y, y(0) = 1
        const pts = ODESolver.solveBidirectional((_x, y) => y, 0, 1, -1, 1);
        expect(pts.length).toBeGreaterThan(5);
        expect(ODESolver.lastTruncated).toBe(false);
    });
});
