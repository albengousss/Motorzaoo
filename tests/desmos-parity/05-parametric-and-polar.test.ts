// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import { FaultTolerantParser } from '../../src/core/faultTolerantParser';
import { ImplicitEngine } from '../../src/core/implicitEngine';
import { ExpressionManager } from '../../src/ui/expressionManager';
import { Renderer } from '../../src/graphics/renderer';
import { GLRenderer } from '../../src/graphics/glRenderer';
import { parseAndClassifyStatement } from '../../src/core/statementRouter';
import {
    DEFAULT_PARAMETRIC_BOUNDS,
    DEFAULT_POLAR_BOUNDS,
    extractContinuousDomainFromAst,
    astUsesPolarSpatialCoord,
    rewritePolarImplicitAst,
    splitSubpathsAtBreaks,
    computeSubpathWindingNumber,
    isPointFilledNonZero
} from '../../src/core/parametricDomain';

describe('Desmos Parity Module 05: Parametric & Polar Curves', () => {
    beforeEach(() => {
        StateManager.clearAll();
        StateManager.angleMode = 'radians';
        MathEngine.initCompiledFuncs();
        document.body.innerHTML = `<div id="expressions-list" class="flex flex-col gap-0 overflow-y-auto flex-1"></div>`;
        ExpressionManager.container = document.getElementById('expressions-list')!;
        ExpressionManager.blockCounter = 0;
        ExpressionManager.init(() => {});
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
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

    it('Phase D: uses default 0 <= t <= 1 domain for (-cos(t), sin(t)) and 0 <= theta <= 12*pi for polar curves', () => {
        expect(DEFAULT_PARAMETRIC_BOUNDS).toEqual({
            min: 0,
            max: 1,
            minExpr: '0',
            maxExpr: '1'
        });
        expect(DEFAULT_POLAR_BOUNDS.min).toBe(0);
        expect(DEFAULT_POLAR_BOUNDS.max).toBeCloseTo(12 * Math.PI, 10);
        expect(DEFAULT_POLAR_BOUNDS.minExpr).toBe('0');
        expect(DEFAULT_POLAR_BOUNDS.maxExpr).toBe('12\\pi');

        // At default parametric upper bound t=1: (-cos(1), sin(1))
        const paramAst = new PrattParser(LatexNormalizer.normalize('(-\\cos(t), \\sin(t))')).parseExpression();
        const atOne = MathEngine.evaluateAST(paramAst, { t: DEFAULT_PARAMETRIC_BOUNDS.max });
        expect(atOne.x).toBeCloseTo(-Math.cos(1), 6);
        expect(atOne.y).toBeCloseTo(Math.sin(1), 6);

        // At default polar upper bound theta = 12*pi: r = sqrt(12*pi), x = r*cos(12*pi) = sqrt(12*pi), y ~ 0
        const rAst = new PrattParser(LatexNormalizer.normalize('\\sqrt{\\theta}')).parseExpression();
        const rMax = MathEngine.evaluateAST(rAst, { theta: DEFAULT_POLAR_BOUNDS.max });
        expect(rMax).toBeCloseTo(Math.sqrt(12 * Math.PI), 8);
    });

    it('Phase D: renders inline editable parametric/polar domain bounds in expression rows', () => {
        const id = ExpressionManager.addExpression('(-cos(t), sin(t))');
        ExpressionManager.setDomainBounds(id, {
            active: true,
            paramVar: 't',
            minExpr: DEFAULT_PARAMETRIC_BOUNDS.minExpr,
            maxExpr: DEFAULT_PARAMETRIC_BOUNDS.maxExpr
        });

        const block = document.getElementById(id)!;
        const row = block.querySelector('.domain-bounds-row') as HTMLElement;
        const minInput = row.querySelector('.domain-min-input') as HTMLInputElement;
        const maxInput = row.querySelector('.domain-max-input') as HTMLInputElement;
        const label = row.querySelector('.domain-var-label') as HTMLElement;

        expect(row.classList.contains('hidden')).toBe(false);
        expect(label.textContent).toBe('≤ t ≤');
        expect(minInput.value).toBe('0');
        expect(maxInput.value).toBe('1');

        // User edits inline max domain bound
        maxInput.value = '2pi';
        maxInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(ExpressionManager.getAllExpressions().find(e => e.id === id)?.domainMax).toBe('2pi');

        // Polar row shows theta and 12π default
        const polarId = ExpressionManager.addExpression('r = sqrt(theta)');
        ExpressionManager.setDomainBounds(polarId, {
            active: true,
            paramVar: 'theta',
            minExpr: DEFAULT_POLAR_BOUNDS.minExpr,
            maxExpr: DEFAULT_POLAR_BOUNDS.maxExpr
        });
        const polarBlock = document.getElementById(polarId)!;
        expect(polarBlock.querySelector('.domain-var-label')?.textContent).toBe('≤ θ ≤');
        expect((polarBlock.querySelector('.domain-max-input') as HTMLInputElement).value).toBe('12π');

        // Non-parametric rows hide the domain row and omit bounds
        ExpressionManager.setDomainBounds(id, { active: false });
        expect(row.classList.contains('hidden')).toBe(true);
        expect(ExpressionManager.getAllExpressions().find(e => e.id === id)?.domainMax).toBeUndefined();
    });

    it('Phase D: plots parametric curves returned by functions and comprehensions: t_1(x), (t^2, t) for -2<t<2', () => {
        // Function returning Point called with x: t_1(t) = (cos(t), sin(t)) -> t_1(x)
        const defStmt = parseAndClassifyStatement(LatexNormalizer.normalize('t_1(t) = (cos(t), sin(t))'));
        expect(defStmt.kind).toBe('func_def');
        if (defStmt.kind === 'func_def') {
            MathEngine.userFunctions[defStmt.name] = {
                params: defStmt.params,
                expr: defStmt.rhsRaw,
                ast: defStmt.rhsAst
            };
        }
        const callAst = new PrattParser(LatexNormalizer.normalize('t_1(x)')).parseExpression();
        const expanded = MathEngine.expandUserFunctions(callAst);
        expect(expanded[0]).toBe('Point');
        expect(StateManager.extractVariables(expanded)).toContain('x');
        expect(MathEngine.evaluateAST(expanded, { x: Math.PI })).toMatchObject({
            x: expect.closeTo(-1, 6),
            y: expect.closeTo(0, 6)
        });

        // Continuous ForDomain parametric: (t^2, t) for -2 < t < 2
        const forAst = new PrattParser(LatexNormalizer.normalize('(t^2, t) for -2 < t < 2')).parseExpression();
        expect(forAst[0]).toBe('ForDomain');
        expect(forAst[1][0]).toBe('Point');
        const dom = extractContinuousDomainFromAst(forAst[2]);
        expect(dom).not.toBeNull();
        expect(dom!.paramVar).toBe('t');
        expect(dom!.tMin).toBe(-2);
        expect(dom!.tMax).toBe(2);
        expect(dom!.check(0)).toBe(true);
        expect(dom!.check(-2)).toBe(false);
        expect(dom!.check(2)).toBe(false);

        // Discrete point-list comprehension: [(t^2, t) for t = -2...2]
        const listCompAst = new PrattParser(LatexNormalizer.normalize('[(t^2, t) for t = -2...2]')).parseExpression();
        expect(listCompAst[0]).toBe('Comprehension');
        const discretePts = MathEngine.evaluateAST(listCompAst, {});
        expect(discretePts).toEqual([
            { x: 4, y: -2 },
            { x: 1, y: -1 },
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 4, y: 2 }
        ]);
    });

    it('Phase D: supports parametric fill and CW/CCW inner-hole exclusion', () => {
        // Outer CCW square [-2, 2]^2 + NaN gap (0/0, 0/0) + Inner CW square [-1, 1]^2
        const ccwOuter = [
            { x: -2, y: -2 },
            { x: 2, y: -2 },
            { x: 2, y: 2 },
            { x: -2, y: 2 }
        ];
        const cwInnerHole = [
            { x: -1, y: -1 },
            { x: -1, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: -1 }
        ];
        const nanGap = { x: NaN, y: NaN };
        const combinedOpposite = [...ccwOuter, nanGap, ...cwInnerHole];

        const loops = splitSubpathsAtBreaks(combinedOpposite);
        expect(loops.length).toBe(2);
        expect(computeSubpathWindingNumber(0, 0, ccwOuter)).toBe(1);
        expect(computeSubpathWindingNumber(0, 0, cwInnerHole)).toBe(-1);

        // Non-zero rule excludes center hole (1 + (-1) = 0) while filling outer ring (1 + 0 = 1)
        expect(isPointFilledNonZero(0, 0, combinedOpposite)).toBe(false);
        expect(isPointFilledNonZero(1.5, 0, combinedOpposite)).toBe(true);

        // Same-orientation CCW inner loop yields winding +2 (filled center)
        const ccwInner = [...cwInnerHole].reverse();
        expect(isPointFilledNonZero(0, 0, [...ccwOuter, nanGap, ...ccwInner])).toBe(true);

        // Renderer.fillParametricLoop draws both subpaths onto a single path and fills with 'nonzero'
        const fillMock = vi.fn();
        const moveToMock = vi.fn();
        const lineToMock = vi.fn();
        const closePathMock = vi.fn();
        const beginPathMock = vi.fn();
        const mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: beginPathMock,
            moveTo: moveToMock,
            lineTo: lineToMock,
            closePath: closePathMock,
            fill: fillMock,
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 2
        };
        Renderer.prototype.fillParametricLoop.call({ ctx: mockCtx }, combinedOpposite, '#2d70b3');
        expect(beginPathMock).toHaveBeenCalledTimes(1);
        expect(moveToMock).toHaveBeenCalledTimes(2);
        expect(closePathMock).toHaveBeenCalledTimes(2);
        expect(fillMock).toHaveBeenCalledWith('nonzero');

        // UI popover #style-fill-toggle toggles dataset.fill and getAllExpressions().fill
        const id = ExpressionManager.addExpression('(cos(2*pi*t), sin(2*pi*t))');
        const block = document.getElementById(id)!;
        const visBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        ExpressionManager.openStylePopover(block, visBtn);
        const fillBtn = document.getElementById('style-fill-toggle') as HTMLButtonElement;
        expect(fillBtn).not.toBeNull();
        expect(ExpressionManager.getAllExpressions().find(e => e.id === id)?.fill).toBe(false);
        fillBtn.click();
        expect(block.dataset.fill).toBe('true');
        expect(ExpressionManager.getAllExpressions().find(e => e.id === id)?.fill).toBe(true);
    });

    it('Phase D: plots implicit polar equations such as 2*r*cos(theta) = 1', () => {
        const stmt = parseAndClassifyStatement(LatexNormalizer.normalize('2*r*\\cos(\\theta) = 1'));
        expect(stmt.kind).toBe('plot_equation');
        if (stmt.kind !== 'plot_equation') return;

        expect(astUsesPolarSpatialCoord(stmt.ast)).toBe(true);
        const cartAst = rewritePolarImplicitAst(stmt.ast);
        expect(astUsesPolarSpatialCoord(cartAst)).toBe(false);

        // 2 * r * cos(theta) = 2x -> 2x - 1 = 0 => zero on line x = 0.5
        const fn = MathEngine.compile(cartAst);
        expect(fn(0.5, 0, {})).toBeCloseTo(0, 6);
        expect(fn(0.5, 3, {})).toBeCloseTo(0, 6);
        expect(fn(1, 0, {})).toBeCloseTo(1, 6);

        // Interval / Quadtree ImplicitEngine also finds segments along x = 0.5
        const imp = ImplicitEngine.generateImplicit('test-polar', cartAst, '=', {}, -2, 2, -2, 2);
        expect(imp.segments.length).toBeGreaterThan(0);
        for (const seg of imp.segments) {
            expect((seg.x1 + seg.x2) / 2).toBeCloseTo(0.5, 1);
        }

        // GLSL translation guards atan(0, 0) cleanly for r^2 = cos(2*theta)
        const lemStmt = parseAndClassifyStatement('r^2 = cos(2*theta)');
        if (lemStmt.kind === 'plot_equation') {
            const lemCart = rewritePolarImplicitAst(lemStmt.ast);
            const glsl = GLRenderer.astToGLSL(lemCart);
            expect(glsl).toContain('atan(');
            expect(glsl).toContain('== 0.0');
        }
    });
});
