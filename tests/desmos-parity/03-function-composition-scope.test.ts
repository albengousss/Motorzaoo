import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';
import { StateManager } from '../../src/core/stateManager';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import { FaultTolerantParser } from '../../src/core/faultTolerantParser';
import { DesmosSemanticError } from '../../src/core/policy';
import { parseAndClassifyStatement } from '../../src/core/statementRouter';

describe('Desmos Parity Module 03: Function Composition, Scope, With & Recursion', () => {
    beforeEach(() => {
        StateManager.clearAll();
        MathEngine.initCompiledFuncs();
    });

    it('chains single-variable and multivariable user functions f(g(x))', () => {
        const fAst = new PrattParser('x^2').parseExpression();
        const gAst = new PrattParser('f(x) + 1').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: 'b1' };
        MathEngine.userFunctions['g'] = { params: ['x'], expr: 'f(x) + 1', ast: gAst, blockId: 'b2' };
        MathEngine.compiledFuncs['f'] = MathEngine.compile(fAst, 'x');
        MathEngine.compiledFuncs['g'] = MathEngine.compile(gAst, 'x');

        expect(MathEngine.evaluateAST(new PrattParser('f(g(2))').parseExpression(), {})).toBe(25);
        expect(MathEngine.expandUserFunctions(new PrattParser('g(x+1)').parseExpression())).toEqual([
            'Add',
            ['Power', ['Add', 'x', 1], 2],
            1
        ]);
    });

    it('supports subscripted parameter evaluation with variable arguments f(v_{ar})', () => {
        const fAst = new PrattParser('x^3').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^3', ast: fAst, blockId: 'b1' };
        MathEngine.compiledFuncs['f'] = MathEngine.compile(fAst, 'x');
        StateManager.values['v_ar'] = 3;

        expect(MathEngine.evaluateAST(new PrattParser('f(v_{ar})').parseExpression(), StateManager.values)).toBe(27);
    });

    // Phase C roadmap parity checks
    it('Phase C: supports dynamic scope binding (wackscope) f(x,y)=w with w=x^3-y^3', () => {
        StateManager.values.x = 10;
        StateManager.values.y = 1;
        const wAst = new PrattParser(LatexNormalizer.normalize('x^3-y^3')).parseExpression();
        StateManager.defineVariable('w', wAst);

        const fAst = new PrattParser('w').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x', 'y'], expr: 'w', ast: fAst, blockId: 'b_f' };
        MathEngine.compiledFuncs['f'] = MathEngine.makeUserFuncWrapper('f', ['x', 'y'], fAst);

        // Via AST direto, compileMultivariable, compile e expandUserFunctions
        expect(MathEngine.evaluateAST(['Call', 'f', 3, 2], StateManager.values)).toBe(19);
        expect(MathEngine.compiledFuncs['f'](3, 2, StateManager.values)).toBe(19);

        const directMulti = MathEngine.compileMultivariable(fAst, ['x', 'y']);
        expect(directMulti(3, 2, StateManager.values)).toBe(19);

        const compiledCurve = MathEngine.compile(['Call', 'f', 'x', 2], 'x');
        expect(compiledCurve(3, 0, StateManager.values)).toBe(19);

        const expanded = MathEngine.expandUserFunctions(['Call', 'f', 3, 2]);
        expect(MathEngine.evaluateAST(expanded, StateManager.values)).toBe(19);
    });

    it('Phase C: supports local parameter shadowing over globals of the same name', () => {
        StateManager.values.x = 10;
        StateManager.values.c = 99;

        const dAst = new PrattParser('x + 1').parseExpression();
        StateManager.defineVariable('d', dAst);

        const fAst = new PrattParser('x + 1').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x + 1', ast: fAst, blockId: 'b_f' };
        MathEngine.compiledFuncs['f'] = MathEngine.makeUserFuncWrapper('f', ['x'], fAst);

        const gAst = new PrattParser('d').parseExpression();
        MathEngine.userFunctions['g'] = { params: ['x'], expr: 'd', ast: gAst, blockId: 'b_g' };
        MathEngine.compiledFuncs['g'] = MathEngine.makeUserFuncWrapper('g', ['x'], gAst);

        const withShadowExpr = LatexNormalizer.normalize('c + (c^2 \\operatorname{with} c = 2)');
        const hAst = new PrattParser(withShadowExpr).parseExpression();
        MathEngine.userFunctions['h'] = { params: ['c'], expr: withShadowExpr, ast: hAst, blockId: 'b_h' };
        MathEngine.compiledFuncs['h'] = MathEngine.makeUserFuncWrapper('h', ['c'], hAst);

        expect(MathEngine.evaluateAST(['Call', 'f', 4], StateManager.values)).toBe(5);
        expect(MathEngine.compiledFuncs['f'](4, StateManager.values)).toBe(5);
        expect(MathEngine.evaluateAST(['Call', 'g', 4], StateManager.values)).toBe(5);
        expect(MathEngine.evaluateAST(MathEngine.expandUserFunctions(['Call', 'h', 5]), StateManager.values)).toBe(9);
        expect(MathEngine.evaluateAST(['Call', 'h', 5], StateManager.values)).toBe(9);
        expect(StateManager.values.x).toBe(10);
        expect(StateManager.values.c).toBe(99);
    });

    it('Phase C: implements "with" local substitution c^2 \\operatorname{with} c=2 without polluting global scope', () => {
        const exprStr = LatexNormalizer.normalize('c^2 \\operatorname{with} c = 2');
        const parsed = parseAndClassifyStatement(exprStr);
        expect(parsed.kind).toBe('expression');
        if (parsed.kind !== 'expression') throw new Error('Expected expression');

        expect(FaultTolerantParser.detectFreeVariables('c^2 \\operatorname{with} c = 2', [])).not.toContain('c');
        expect(MathEngine.evaluateAST(parsed.ast, StateManager.values)).toBe(4);
        expect(StateManager.values.c).toBeUndefined();

        StateManager.values.c = 10;
        StateManager.defineVariable('d', new PrattParser('c + 1').parseExpression());
        expect(MathEngine.evaluateAST(parsed.ast, StateManager.values)).toBe(4);

        const dWithExpr = LatexNormalizer.normalize('d \\operatorname{with} c = 2');
        const dWithAst = new PrattParser(dWithExpr).parseExpression();
        expect(MathEngine.evaluateAST(dWithAst, StateManager.values)).toBe(3);
        expect(StateManager.values.c).toBe(10);
    });

    it('Phase C: supports polymorphism returning/accepting Points and Lists in user functions', () => {
        const ptFnAst = new PrattParser(LatexNormalizer.normalize('2*P + (1, 0)')).parseExpression();
        MathEngine.userFunctions['f'] = { params: ['P'], expr: '2*P + (1, 0)', ast: ptFnAst, blockId: 'b_pt' };
        MathEngine.compiledFuncs['f'] = MathEngine.makeUserFuncWrapper('f', ['P'], ptFnAst);

        const propFnAst = new PrattParser(LatexNormalizer.normalize('P.x + P.y')).parseExpression();
        MathEngine.userFunctions['g'] = { params: ['P'], expr: 'P.x + P.y', ast: propFnAst, blockId: 'b_prop' };
        MathEngine.compiledFuncs['g'] = MathEngine.makeUserFuncWrapper('g', ['P'], propFnAst);

        const listFnAst = new PrattParser(LatexNormalizer.normalize('2*L + 1')).parseExpression();
        MathEngine.userFunctions['h'] = { params: ['L'], expr: '2*L + 1', ast: listFnAst, blockId: 'b_list' };
        MathEngine.compiledFuncs['h'] = MathEngine.makeUserFuncWrapper('h', ['L'], listFnAst);

        const retPtAst = new PrattParser(LatexNormalizer.normalize('(x, x^2)')).parseExpression();
        MathEngine.userFunctions['p'] = { params: ['x'], expr: '(x, x^2)', ast: retPtAst, blockId: 'b_retpt' };
        MathEngine.compiledFuncs['p'] = MathEngine.makeUserFuncWrapper('p', ['x'], retPtAst);

        const pArg = ['Point', 3, 4];
        expect(MathEngine.evaluateAST(['Call', 'f', pArg], StateManager.values)).toEqual({ x: 7, y: 8 });
        expect(MathEngine.compiledFuncs['f']({ x: 3, y: 4 })).toEqual({ x: 7, y: 8 });

        const multiPt = MathEngine.compileMultivariable(ptFnAst, ['P']);
        expect(multiPt({ x: 3, y: 4 })).toEqual({ x: 7, y: 8 });

        expect(MathEngine.evaluateAST(['Call', 'g', pArg], StateManager.values)).toBe(7);
        expect(MathEngine.compiledFuncs['g']({ x: 3, y: 4 })).toBe(7);
        expect(MathEngine.compileMultivariable(propFnAst, ['P'])({ x: 3, y: 4 })).toBe(7);

        expect(MathEngine.evaluateAST(['Call', 'h', ['List', 1, 2, 3]], StateManager.values)).toEqual([3, 5, 7]);
        expect(MathEngine.compiledFuncs['h']([1, 2, 3])).toEqual([3, 5, 7]);

        expect(MathEngine.evaluateAST(['Call', 'p', 3], StateManager.values)).toEqual({ x: 3, y: 9 });
        expect(MathEngine.compiledFuncs['p'](3)).toEqual({ x: 3, y: 9 });
    });

    it('Phase C: resolves external base cases & mutual recursion f_{actorial}(0)=1, f_{actorial}(x)=x*f_{actorial}(x-1) without echoing literal f(3)', () => {
        const baseNorm = LatexNormalizer.normalize('f_{actorial}(0) = 1');
        const recNorm = LatexNormalizer.normalize('f_{actorial}(x) = x * f_{actorial}(x - 1)');

        // Verifica classificação independente de ordem (base case pode vir antes ou depois da definição)
        const baseStmt = parseAndClassifyStatement(baseNorm);
        expect(baseStmt.kind).toBe('func_base_case');
        const recStmt = parseAndClassifyStatement(recNorm);
        expect(recStmt.kind).toBe('func_def');
        if (baseStmt.kind !== 'func_base_case' || recStmt.kind !== 'func_def') throw new Error('Unexpected statement kinds');

        const factName = recStmt.name;
        expect(baseStmt.name).toBe(factName);
        MathEngine.userFunctions[factName] = { params: recStmt.params, expr: recStmt.rhsRaw, ast: recStmt.rhsAst, blockId: 'b_rec' };
        MathEngine.userBaseCases[factName] = [{ args: baseStmt.argAsts, ast: baseStmt.rhsAst, blockId: 'b_base' }];
        MathEngine.compiledFuncs[factName] = MathEngine.makeUserFuncWrapper(factName, recStmt.params, recStmt.rhsAst);

        expect(MathEngine.evaluateAST(['Call', factName, 0], StateManager.values)).toBe(1);
        expect(MathEngine.evaluateAST(['Call', factName, 3], StateManager.values)).toBe(6);
        expect(MathEngine.evaluateAST(['Call', factName, 5], StateManager.values)).toBe(120);
        expect(MathEngine.compiledFuncs[factName](5)).toBe(120);

        // Recursão guardada com piecewise inline
        const sumNorm = LatexNormalizer.normalize('s(x) = \\{x=0: 0, x + s(x-1)\\}');
        const sumStmt = parseAndClassifyStatement(sumNorm);
        expect(sumStmt.kind).toBe('func_def');
        if (sumStmt.kind !== 'func_def') throw new Error('Expected func_def');
        MathEngine.userFunctions['s'] = { params: ['x'], expr: sumStmt.rhsRaw, ast: sumStmt.rhsAst, blockId: 'b_s' };
        MathEngine.compiledFuncs['s'] = MathEngine.makeUserFuncWrapper('s', ['x'], sumStmt.rhsAst);
        expect(MathEngine.evaluateAST(['Call', 's', 4], StateManager.values)).toBe(10);

        // Recursão mútua convergente e divergente (com guarda de profundidade explícita)
        const eStmt = parseAndClassifyStatement(LatexNormalizer.normalize('\\operatorname{even}(n) = \\{n=0: 1, \\operatorname{odd}(n-1)\\}'));
        const oStmt = parseAndClassifyStatement(LatexNormalizer.normalize('\\operatorname{odd}(n) = \\{n=0: 0, \\operatorname{even}(n-1)\\}'));
        expect(eStmt.kind).toBe('func_def');
        expect(oStmt.kind).toBe('func_def');
        if (eStmt.kind === 'func_def' && oStmt.kind === 'func_def') {
            MathEngine.userFunctions['even'] = { params: ['n'], expr: eStmt.rhsRaw, ast: eStmt.rhsAst, blockId: 'b_e' };
            MathEngine.userFunctions['odd'] = { params: ['n'], expr: oStmt.rhsRaw, ast: oStmt.rhsAst, blockId: 'b_o' };
            MathEngine.compiledFuncs['even'] = MathEngine.makeUserFuncWrapper('even', ['n'], eStmt.rhsAst);
            MathEngine.compiledFuncs['odd'] = MathEngine.makeUserFuncWrapper('odd', ['n'], oStmt.rhsAst);
            expect(MathEngine.evaluateAST(['Call', 'even', 4], StateManager.values)).toBe(1);
            expect(MathEngine.evaluateAST(['Call', 'odd', 4], StateManager.values)).toBe(0);
        }

        const r1Stmt = parseAndClassifyStatement(LatexNormalizer.normalize('r_1(x) = r_2(x)'));
        const r2Stmt = parseAndClassifyStatement(LatexNormalizer.normalize('r_2(x) = r_1(x)'));
        expect(r1Stmt.kind).toBe('func_def');
        expect(r2Stmt.kind).toBe('func_def');
        if (r1Stmt.kind === 'func_def' && r2Stmt.kind === 'func_def') {
            MathEngine.userFunctions['r_1'] = { params: ['x'], expr: r1Stmt.rhsRaw, ast: r1Stmt.rhsAst, blockId: 'b_r1' };
            MathEngine.userFunctions['r_2'] = { params: ['x'], expr: r2Stmt.rhsRaw, ast: r2Stmt.rhsAst, blockId: 'b_r2' };
            MathEngine.compiledFuncs['r_1'] = MathEngine.makeUserFuncWrapper('r_1', ['x'], r1Stmt.rhsAst);
            MathEngine.compiledFuncs['r_2'] = MathEngine.makeUserFuncWrapper('r_2', ['x'], r2Stmt.rhsAst);
            expect(() => MathEngine.evaluateAST(['Call', 'r_1', 5], StateManager.values)).toThrowError(DesmosSemanticError);
            expect(() => MathEngine.evaluateAST(['Call', factName, -1], StateManager.values)).toThrowError(DesmosSemanticError);
        }
    });
});
