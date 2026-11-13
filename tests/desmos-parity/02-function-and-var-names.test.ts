import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { FaultTolerantParser } from '../../src/core/faultTolerantParser';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import {
    DesmosSemanticError,
    astContainsSpatialCoord,
    classifyStatementAST,
    isValidDesmosIdentifier
} from '../../src/core/policy';
import { parseAndClassifyStatement, extractOperatorNames } from '../../src/core/statementRouter';

describe('Desmos Parity Module 02: Function & Variable Names, Protection & Error Boundaries', () => {
    beforeEach(() => {
        StateManager.clearAll();
        MathEngine.initCompiledFuncs();
    });

    it('parses single-letter and normalized subscripted function definitions and calls', () => {
        const cleanCall = LatexNormalizer.normalize('f_{unc}(3, 2)');
        const ast = new PrattParser(cleanCall).parseExpression();
        expect(ast).toEqual(['f_unc', 3, 2]);

        const defAst = new PrattParser('x^2 + y^2').parseExpression();
        MathEngine.userFunctions['f_unc'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: defAst, blockId: 'b1' };
        MathEngine.compiledFuncs['f_unc'] = MathEngine.compileMultivariable(defAst, ['x', 'y']);
        expect(MathEngine.evaluateAST(ast, {})).toBe(13);
    });

    it('detects missing sliders in 2D vs 3D coordinate modes', () => {
        expect(FaultTolerantParser.detectFreeVariables('x^2 + y^2 + a^2 = 2', ['x', 'y'], true)).toEqual(['a']);
        expect(FaultTolerantParser.detectFreeVariables('x^2 + y^2 + z^2 = 2', ['x', 'y'], true)).toEqual(['z']);
        expect(FaultTolerantParser.detectFreeVariables('x^2 + y^2 + z^2 = 2', ['x', 'y', 'z'], false)).toEqual([]);
    });

    it('flags missing differential dx/dt on integrals in FaultTolerantParser.checkIncompleteStatus', () => {
        const bad = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{1} x^2', 'int_0^1 x^2');
        expect(bad.isIncomplete).toBe(true);
        expect(bad.warning).toBe('O integrando deve terminar com uma variável de integração, como dx.');

        const ok = FaultTolerantParser.checkIncompleteStatus('\\int_{0}^{1} x^2 dx', 'int_0^1 x^2 dx');
        expect(ok.isIncomplete).toBe(false);
        expect(ok.warning).toBeNull();
    });

    it('detects numerical derivative of compiled functions f\', f\'\', f\'\'\'', () => {
        const ast = new PrattParser('x^3').parseExpression();
        const d1 = MathEngine.createDerivativeFunction(ast, 'x', 1);
        const d2 = MathEngine.createDerivativeFunction(ast, 'x', 2);
        expect(d1(2, 0, {})).toBeCloseTo(12, 3);
        expect(d2(2, 0, {})).toBeCloseTo(12, 2);
    });

    it('Phase B: throws explicit undefined-function error for unknown calls like func(x), unknownfn(1) instead of silently returning 0', () => {
        expect(() => MathEngine.evaluateAST(['func', 'x'], { x: 2 })).toThrowError(DesmosSemanticError);
        expect(() => MathEngine.evaluateAST(['unknownfn', 1], {})).toThrowError(DesmosSemanticError);
        expect(() => MathEngine.evaluateAST(['f_9', 2], {})).toThrowError(DesmosSemanticError);

        const compiledUnknown = MathEngine.compile(['unknownfn', 'x'], 'x');
        expect(() => compiledUnknown(1, 0, {})).toThrowError(DesmosSemanticError);

        const parsedUnknown = parseAndClassifyStatement('\\operatorname{unknownfn}(1)');
        expect(parsedUnknown.kind).toBe('expression');
        if (parsedUnknown.kind === 'expression') {
            expect(() => MathEngine.evaluateAST(parsedUnknown.ast, {})).toThrowError(DesmosSemanticError);
        }
    });

    it('Phase B: handles \\operatorname{isprime}(x) multi-char names while disallowing plain multi-char function names', () => {
        const validOp = parseAndClassifyStatement('\\operatorname{isprime}(x) = x + 1');
        expect(validOp.kind).toBe('func_def');
        if (validOp.kind === 'func_def') {
            expect(validOp.name).toBe('isprime');
            expect(validOp.params).toEqual(['x']);
            expect(extractOperatorNames('\\operatorname{isprime}(x) = x + 1').has('isprime')).toBe(true);
        }

        expect(FaultTolerantParser.detectFreeVariables('\\operatorname{isprime}(x) = x + 1', [], true)).toEqual([]);
        expect(FaultTolerantParser.detectFreeVariables('\\operatorname{myvar} + 1', [], true)).toEqual(['myvar']);

        // Nome multi-letra sem \operatorname é inválido como nome de função na classificação direta AST
        expect(() => parseAndClassifyStatement('func(x) = x + 1')).toThrowError(DesmosSemanticError);
        expect(isValidDesmosIdentifier('func')).toBe(false);
        expect(isValidDesmosIdentifier('isprime', { fromOperatorName: true })).toBe(true);

        // E pela normalização de UI, func(x) se decompõe em f*u*n*c*(x) em vez de criar função func
        const normFunc = LatexNormalizer.normalize('func(x) = x + 1', '');
        const normStmt = parseAndClassifyStatement(normFunc);
        expect(normStmt.kind).toBe('plot_equation');
    });

    it('Phase B: rejects assigning protected built-in variables or circular self-definitions (x = x)', () => {
        for (const stmt of ['pi = 3', 'e = 2', 'tau = 6', 'inf = 1', 'width = 100', 'height = 100', 'sin = 5']) {
            expect(() => parseAndClassifyStatement(stmt)).toThrowError(DesmosSemanticError);
        }

        for (const circular of ['x = x', 'a = a', 'a = a + 1', 'f(x) = f(x)']) {
            expect(() => parseAndClassifyStatement(circular)).toThrowError(DesmosSemanticError);
        }

        // Ciclo indireto: a = b + 1 quando b = a + 1 já existe
        expect(() =>
            classifyStatementAST('a', ['Add', 'b', 1], {
                existingVarAsts: { b: ['Add', 'a', 1] }
            })
        ).toThrowError(DesmosSemanticError);

        // Em 2D z = 5 é slider válido; em 3D z é coordenada espacial (plot_equation)
        expect(parseAndClassifyStatement('z = 5', { is3D: false }).kind).toBe('var_assign');
        expect(parseAndClassifyStatement('z = x^2', { is3D: true }).kind).toBe('plot_equation');
        expect(parseAndClassifyStatement('y = x^2', { is3D: false }).kind).toBe('plot_equation');
    });

    it('Phase B: unifies assignment detection via PrattParser AST rather than fragile regexes in main.ts', () => {
        // Regressões do bug .includes('x')
        expect(astContainsSpatialCoord(new PrattParser('max([1, 2, 3])').parseExpression(), false)).toBe(false);
        expect(astContainsSpatialCoord(new PrattParser('exp(1)').parseExpression(), false)).toBe(false);
        const crossAst = new PrattParser(LatexNormalizer.normalize('(1, 0, 0) \\times (0, 1, 0)', '')).parseExpression();
        expect(astContainsSpatialCoord(crossAst, true)).toBe(false);
        expect(astContainsSpatialCoord(new PrattParser('P.x').parseExpression(), false)).toBe(false);
        expect(astContainsSpatialCoord(new PrattParser('x^2 + 1').parseExpression(), false)).toBe(true);

        // Regressão de isRhsConstant: editar f(x) = 3 no próprio bloco define função constante (func_def)
        const existingFuncAsts = { f: { params: ['x'], ast: ['Power', 'x', 2], blockId: 'b1' } };
        const sameBlockDef = parseAndClassifyStatement('f(x) = 3', {
            existingFuncAsts,
            currentBlockId: 'b1'
        });
        expect(sameBlockDef.kind).toBe('func_def');

        // Em um bloco diferente, f(x, y) = 3 é plot_equation (curva de nível)
        const otherBlockPlot = parseAndClassifyStatement('f(x, y) = 3', {
            existingFuncAsts: { f: { params: ['x', 'y'], ast: ['Add', 'x', 'y'], blockId: 'b1' } },
            currentBlockId: 'b2'
        });
        expect(otherBlockPlot.kind).toBe('plot_equation');

        // Compreensões com '=' após 'for' ou 'with' nunca são divididas como equações relacionais
        expect(parseAndClassifyStatement('2k for k = [1, 2, 3]').kind).toBe('expression');
        expect(parseAndClassifyStatement('2x with x = 5').kind).toBe('expression');
    });
});
