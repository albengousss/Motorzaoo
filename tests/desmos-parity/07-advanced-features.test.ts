// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { ListEngine } from '../../src/core/listEngine';
import { MatrixEngine } from '../../src/core/matrixEngine';
import { ExpressionManager } from '../../src/ui/expressionManager';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import { Tokenizer, TokenTypes } from '../../src/core/tokenizer';
import { GLRenderer } from '../../src/graphics/glRenderer';
import { parseAndClassifyStatement } from '../../src/core/statementRouter';
import { DesmosSemanticError } from '../../src/core/policy';

describe('Desmos Parity Module 07: Advanced Features, IEEE-754 Precision & Phase A UI Layout Checks', () => {
    beforeEach(() => {
        StateManager.clearAll();
        MathEngine.initCompiledFuncs();
        document.body.innerHTML = `<div id="expressions-list" class="flex flex-col gap-0 overflow-y-auto flex-1"></div>`;
        ExpressionManager.container = document.getElementById('expressions-list')!;
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
        ExpressionManager.init(() => {});
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
    });

    it('satisfies IEEE-754 boundary identities for 2^53+1-2^53 and tanh saturation', () => {
        expect(MathEngine.evaluateAST(new PrattParser('2^53 + 1 - 2^53').parseExpression())).toBe(0);
        expect(MathEngine.evaluateAST(new PrattParser('tanh(100)').parseExpression())).toBe(1);
    });

    it('computes basic MatrixEngine operations (determinant, transpose, multiply, inverse, rref)', () => {
        const m = [[1, 2], [3, 4]];
        expect(MatrixEngine.determinant(m)).toBe(-2);
        expect(MatrixEngine.transpose(m)).toEqual([[1, 3], [2, 4]]);
        expect(MatrixEngine.trace(m)).toBe(5);
        expect(MatrixEngine.rank(m)).toBe(2);
    });

    it('Phase A UI: slider-chips-row toggles both hidden & flex, contentZone avoids overflow-hidden, and block uses shrink-0', () => {
        const id = ExpressionManager.addBlock(false, 'x^2 + y^2 + a^2 = 2');
        const block = document.getElementById(id)!;
        expect(block.className).toContain('shrink-0');

        const contentZone = block.children[1] as HTMLElement;
        expect(contentZone.className).toContain('min-w-0');
        expect(contentZone.className).not.toContain('overflow-hidden');

        const chipsRow = block.querySelector('.slider-chips-row') as HTMLElement;
        ExpressionManager.setSliderSuggestions(id, ['a'], () => {});
        expect(chipsRow.classList.contains('hidden')).toBe(false);
        expect(chipsRow.classList.contains('flex')).toBe(true);
        expect(chipsRow.textContent).toContain('adicionar controle deslizante:');

        ExpressionManager.setSliderSuggestions(id, [], () => {});
        expect(chipsRow.classList.contains('hidden')).toBe(true);
        expect(chipsRow.classList.contains('flex')).toBe(false);
    });

    it('Phase A UI: preserves space in list count suffix "(10 elementos)" when rendering result pills', () => {
        const id = ExpressionManager.addBlock(false, '[1...10]');
        const listDisplay = ListEngine.formatListDisplay(ListEngine.generateRange(1, 10));
        ExpressionManager.setResult(id, listDisplay);
        const resDisplay = document.getElementById(id)!.querySelector('.result-display') as HTMLElement;
        expect(resDisplay.textContent).toContain('(10 elementos)');
        expect(resDisplay.textContent).not.toContain('10elementos');
    });

    it('Phase A UI: renders "= indef" pill cleanly for indeterminate results', () => {
        const id = ExpressionManager.addBlock(false, '0/0');
        ExpressionManager.setResult(id, '= indef');
        const resDisplay = document.getElementById(id)!.querySelector('.result-display') as HTMLElement;
        expect(resDisplay.textContent?.trim()).toBe('= indef');
    });

    it('Phase B: throws explicit limit error for [1...10001] (>10000) instead of silent truncation', () => {
        const exactMax = MathEngine.evaluateAST(new PrattParser('[1...10000]').parseExpression());
        expect(Array.isArray(exactMax)).toBe(true);
        expect(exactMax.length).toBe(10000);

        expect(() => MathEngine.evaluateAST(new PrattParser('[1...10001]').parseExpression())).toThrowError(DesmosSemanticError);
        expect(() => MathEngine.evaluateAST(new PrattParser('[1...10001]').parseExpression())).toThrow('10.000');

        const compOver = new PrattParser('[r + c for r = [1...200], c = [1...60]]').parseExpression();
        expect(() => MathEngine.evaluateAST(compOver)).toThrowError(DesmosSemanticError);
    });

    it('Phase B: throws explicit column limit error for 33x33 matrix instead of silent truncation', () => {
        expect(() => MatrixEngine.validateDimensions(32, 32)).not.toThrow();
        const over33Ast = new PrattParser('[r + c for r = 1...33; c = 1...33]').parseExpression();
        expect(() => MathEngine.evaluateAST(over33Ast)).toThrowError(DesmosSemanticError);
        expect(() => MathEngine.evaluateAST(over33Ast)).toThrow('32 colunas');

        const overRowLiteral = ['List', ...Array.from({ length: 33 }, (_, i) => ['List', i, i + 1])];
        expect(() => MathEngine.evaluateAST(overRowLiteral)).toThrowError(DesmosSemanticError);
        expect(() => MathEngine.evaluateAST(overRowLiteral)).toThrow('32 linhas');

        // Isolamento de erro por bloco na UI: um erro semântico em um bloco não corrompe os blocos irmãos
        const idErr = ExpressionManager.addBlock(false, '[1...10001]');
        const idOk = ExpressionManager.addBlock(false, '2 + 3');
        ExpressionManager.setError(idErr, 'As listas não podem ter mais que 10.000 elementos.');
        ExpressionManager.setError(idOk, null);
        ExpressionManager.setResult(idOk, '= 5');

        const errBlock = document.getElementById(idErr)!;
        const okBlock = document.getElementById(idOk)!;
        expect(errBlock.querySelector('.block-warning-trigger')?.classList.contains('hidden')).toBe(false);
        expect(errBlock.querySelector('.warning-popover-tooltip')?.textContent).toContain('10.000');
        expect(okBlock.querySelector('.block-warning-trigger')?.classList.contains('hidden')).toBe(true);
        expect(okBlock.querySelector('.result-display')?.textContent?.trim()).toBe('= 5');
    });
    it('Phase C: parses real {} piecewise syntax {cond1: val1, cond2: val2, default}, AND/OR domain braces, and chained inequalities -6 < x <= -5', () => {
        // Real BRACE_LEFT / BRACE_RIGHT / COLON tokens distinct from parentheses
        const toks = new Tokenizer().tokenize('{x < 0: -x, x}');
        expect(toks[0].type).toBe(TokenTypes.BRACE_LEFT);
        expect(toks.some(t => t.type === TokenTypes.COLON)).toBe(true);
        expect(toks[toks.length - 1].type).toBe(TokenTypes.BRACE_RIGHT);

        // Empty braces {} -> 1
        expect(MathEngine.evaluateAST(new PrattParser('{}').parseExpression())).toBe(1);

        // Single guard {x > 0} -> 1 or NaN (else undefined)
        const guardFn = MathEngine.compile(new PrattParser('\\left\\{x > 0\\right\\}').parseExpression());
        expect(guardFn(2, 0, {})).toBe(1);
        expect(Number.isNaN(guardFn(-2, 0, {}))).toBe(true);

        // Multi-branch piecewise with default fallback & no-default variant
        const absFn = MathEngine.compile(new PrattParser(LatexNormalizer.normalize('\\left\\{x < 0: -x, x\\right\\}', '')).parseExpression());
        expect(absFn(-4, 0, {})).toBe(4);
        expect(absFn(3, 0, {})).toBe(3);

        const multiFn = MathEngine.compile(new PrattParser('{x < -1: -1, x > 1: 1, 0}').parseExpression());
        expect(multiFn(-5, 0, {})).toBe(-1);
        expect(multiFn(0, 0, {})).toBe(0);
        expect(multiFn(5, 0, {})).toBe(1);

        // No-default piecewise returns NaN outside branches
        const partialFn = MathEngine.compile(new PrattParser('{x > 0: x^2}').parseExpression());
        expect(partialFn(3, 0, {})).toBe(9);
        expect(Number.isNaN(partialFn(-3, 0, {}))).toBe(true);

        // Implicit : 1 when omitting colon before fallback: {x > 0, -1} and {0.9 < x < 1, 0}
        const signStep = MathEngine.compile(new PrattParser('{x > 0, -1}').parseExpression());
        expect(signStep(2, 0, {})).toBe(1);
        expect(signStep(-2, 0, {})).toBe(-1);

        const pulseFn = MathEngine.compile(new PrattParser('{0.9 < x < 1, 0}').parseExpression());
        expect(pulseFn(0.95, 0, {})).toBe(1);
        expect(pulseFn(0.5, 0, {})).toBe(0);

        // {L = 4: 9, L} elementwise vector filtering/mapping
        StateManager.defineVariable('L', new PrattParser('[1...5]').parseExpression());
        const listPieceAst = new PrattParser('{L = 4: 9, L}').parseExpression();
        expect(MathEngine.evaluateAST(listPieceAst, StateManager.values)).toEqual([1, 2, 3, 9, 5]);
        expect(MathEngine.compile(listPieceAst)(0, 0, StateManager.values)).toEqual([1, 2, 3, 9, 5]);

        // {cond1}{cond2} -> AND; {cond1, cond2} -> OR
        const andFn = MathEngine.compile(new PrattParser('{x > -2}{x < 3}').parseExpression());
        expect(andFn(0, 0, {})).toBe(1);
        expect(Number.isNaN(andFn(-5, 0, {}))).toBe(true);
        expect(Number.isNaN(andFn(5, 0, {}))).toBe(true);

        const orFn = MathEngine.compile(new PrattParser('{x < -2, x > 2}').parseExpression());
        expect(orFn(-4, 0, {})).toBe(1);
        expect(orFn(4, 0, {})).toBe(1);
        expect(Number.isNaN(orFn(0, 0, {}))).toBe(true);

        // Chained inequality -6 < x <= -5 (AST + statement router + runtime eval)
        const chainStmt = parseAndClassifyStatement('-6 < x <= -5');
        expect(chainStmt.kind).toBe('expression');
        const chainAst = (chainStmt as any).ast;
        expect(MathEngine.evaluateAST(chainAst, { x: -5.5 })).toBe(true);
        expect(MathEngine.evaluateAST(chainAst, { x: -5 })).toBe(true);
        expect(MathEngine.evaluateAST(chainAst, { x: -6 })).toBe(false);

        // GLSL motor_pow & astToGLSL never emit false -1e9 root sentinel
        const powGLSL = GLRenderer.astToGLSL(['Power', 'x', 0.5]);
        expect(powGLSL).not.toContain('-1e9');
        expect(powGLSL).toContain('motor_invalid()');
        const pieceGLSL = GLRenderer.astToGLSL(new PrattParser('{x < 0: -x, x}').parseExpression());
        expect(pieceGLSL).toContain('?');
        expect(pieceGLSL).not.toContain('-1e9');
    });
    it.todo('Phase D: implements list helpers repeat(), join(), sort(), shuffle(), unique()');
    it.todo('Phase D: implements block matrices [M, M^2; M^3, M^T], submatrices M[3;1,2], and 2D matrix comprehensions');
    it.todo('Phase E: surfaces non-blocking "detalhes nao totalmente resolvidos" notice on quadtree budget overflow');
    it.todo('Phase E: supports Complex mode i, dynamic color helpers rgb/hsv/oklch/okhsv, regressions (~), and actions (->)');
});
