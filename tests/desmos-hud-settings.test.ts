import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/core/stateManager';
import { MathEngine } from '../src/core/mathEngine';

describe('Desmos HUD & Graph Settings Test Suite', () => {
    beforeEach(() => {
        StateManager.angleMode = 'radians';
        StateManager.projectorMode = false;
        StateManager.gridType = 'cartesian';
        StateManager.showAxes = true;
        StateManager.showArrows = false;
        StateManager.xLabel = '';
        StateManager.yLabel = '';
        StateManager.xStep = null;
        StateManager.yStep = null;
        MathEngine.initCompiledFuncs();
    });

    it('manages graph settings state defaults correctly', () => {
        expect(StateManager.angleMode).toBe('radians');
        expect(StateManager.projectorMode).toBe(false);
        expect(StateManager.gridType).toBe('cartesian');
        expect(StateManager.showAxes).toBe(true);
        expect(StateManager.showArrows).toBe(false);
    });

    it('evaluates trigonometric functions in radians by default', () => {
        // sin(pi / 2) = 1
        const resSin = MathEngine.evaluateAST(['Sin', Math.PI / 2]);
        expect(resSin).toBeCloseTo(1, 6);

        // cos(0) = 1
        const resCos = MathEngine.evaluateAST(['Cos', 0]);
        expect(resCos).toBeCloseTo(1, 6);

        // tan(pi / 4) = 1
        const resTan = MathEngine.evaluateAST(['Tan', Math.PI / 4]);
        expect(resTan).toBeCloseTo(1, 6);
    });

    it('evaluates trigonometric functions in degrees when angleMode is set to degrees', () => {
        StateManager.angleMode = 'degrees';

        // sin(90°) = 1
        const resSin90 = MathEngine.evaluateAST(['Sin', 90]);
        expect(resSin90).toBeCloseTo(1, 6);

        // cos(60°) = 0.5
        const resCos60 = MathEngine.evaluateAST(['Cos', 60]);
        expect(resCos60).toBeCloseTo(0.5, 6);

        // tan(45°) = 1
        const resTan45 = MathEngine.evaluateAST(['Tan', 45]);
        expect(resTan45).toBeCloseTo(1, 6);

        // Inverse: asin(1) = 90°
        const resAsin1 = MathEngine.evaluateAST(['Asin', 1]);
        expect(resAsin1).toBeCloseTo(90, 6);

        // acos(0.5) = 60°
        const resAcosHalf = MathEngine.evaluateAST(['Acos', 0.5]);
        expect(resAcosHalf).toBeCloseTo(60, 6);

        // atan(1) = 45°
        const resAtan1 = MathEngine.evaluateAST(['Atan', 1]);
        expect(resAtan1).toBeCloseTo(45, 6);
    });

    it('compiles functions respecting angleMode in JS runtime', () => {
        StateManager.angleMode = 'degrees';
        const compiledFn = MathEngine.compile(['Sin', ['Add', 'x', 0]]);
        
        // f(90) in degrees should be 1
        expect(compiledFn(90, 0, {})).toBeCloseTo(1, 6);
        // f(30) in degrees should be 0.5
        expect(compiledFn(30, 0, {})).toBeCloseTo(0.5, 6);
    });

    it('toggles projector mode, grid types, and custom axis steps', () => {
        StateManager.projectorMode = true;
        expect(StateManager.projectorMode).toBe(true);

        StateManager.gridType = 'polar';
        expect(StateManager.gridType).toBe('polar');

        StateManager.gridType = 'none';
        expect(StateManager.gridType).toBe('none');

        StateManager.xStep = 0.5;
        StateManager.yStep = 2;
        StateManager.xLabel = 'tempo (s)';
        StateManager.yLabel = 'posição (m)';

        expect(StateManager.xStep).toBe(0.5);
        expect(StateManager.yStep).toBe(2);
        expect(StateManager.xLabel).toBe('tempo (s)');
        expect(StateManager.yLabel).toBe('posição (m)');
    });
});
