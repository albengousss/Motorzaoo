import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { MatrixEngine } from '../src/core/matrixEngine';
import { ListEngine } from '../src/core/listEngine';
import { PointEngine } from '../src/core/pointEngine';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';

describe('E2E Pipeline: Multi-Expression & Matrix Function Integration', () => {
    beforeEach(() => {
        MathEngine.initCompiledFuncs();
        StateManager.values = {};
        StateManager.asts = {};
        StateManager.giacDefinitions = {};
        StateManager.casSolutions = {};
        StateManager.userFunctions = {};
        MathEngine.userFunctions = {};
    });

    it('1. Sequence: f(x) = x^2 followed by f(3) evaluates to 9 with no errors or phantom sliders', () => {
        // Step 1: User defines f(x) = x^2 in Block 1
        const expr1 = 'x^2';
        const funcName = 'f';
        const paramNames = ['x'];
        const ast1 = new PrattParser(expr1).parseExpression();
        MathEngine.userFunctions[funcName] = { params: paramNames, expr: expr1, ast: ast1, blockId: 'block-1' };
        StateManager.userFunctions[funcName] = { params: paramNames, expr: expr1, ast: ast1, blockId: 'block-1' };
        MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast1, 'x');

        // Step 2: In Block 2, user types f(3)
        const ast2 = new PrattParser('f(3)').parseExpression();
        expect(ast2).toEqual(['f', 3]);

        // Evaluate locally
        const val = MathEngine.evaluateAST(ast2, StateManager.values);
        expect(val).toBe(9);

        // Verify free variable detection suppresses phantom slider for f
        const bound = ['x', 'y', 'z', ...Object.keys(MathEngine.userFunctions)];
        const freeVars = FaultTolerantParser.detectFreeVariables('f(3)', bound);
        expect(freeVars).toEqual([]);
    });

    it('2. Sequence: Matrix function f(x) = [[x, 0], [0, x]] followed by f(3) returns 2x2 matrix', () => {
        // Step 1: User defines f(x) = [[x, 0], [0, x]]
        const expr1 = '[[x, 0], [0, x]]';
        const funcName = 'f';
        const paramNames = ['x'];
        const ast1 = new PrattParser(expr1).parseExpression();
        MathEngine.userFunctions[funcName] = { params: paramNames, expr: expr1, ast: ast1, blockId: 'block-1' };
        StateManager.userFunctions[funcName] = { params: paramNames, expr: expr1, ast: ast1, blockId: 'block-1' };
        MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast1, 'x');

        // Step 2: User evaluates f(3)
        const ast2 = new PrattParser('f(3)').parseExpression();
        const res = MathEngine.evaluateAST(ast2, StateManager.values);

        expect(MatrixEngine.isMatrix(res)).toBe(true);
        expect(res).toEqual([[3, 0], [0, 3]]);

        const display = MatrixEngine.formatMatrixDisplay(res);
        expect(display).toBe('[[3, 0], [0, 3]]');

        // Slider protection
        const bound = ['x', 'y', 'z', ...Object.keys(MathEngine.userFunctions)];
        const freeVars = FaultTolerantParser.detectFreeVariables('f(3)', bound);
        expect(freeVars).toEqual([]);
    });

    it('3. Sequence: Multivariable matrix function a(x, y, z) = [[x, 0, 0], [0, y, 0], [0, 0, z]] evaluated at (1, 2, 3)', () => {
        // Step 1: User defines a(x, y, z) = [[x, 0, 0], [0, y, 0], [0, 0, z]]
        const expr3D = '[[x, 0, 0], [0, y, 0], [0, 0, z]]';
        const funcName = 'a';
        const paramNames = ['x', 'y', 'z'];
        const ast3D = new PrattParser(expr3D).parseExpression();
        MathEngine.userFunctions[funcName] = { params: paramNames, expr: expr3D, ast: ast3D, blockId: 'block-1' };
        StateManager.userFunctions[funcName] = { params: paramNames, expr: expr3D, ast: ast3D, blockId: 'block-1' };
        MathEngine.compiledFuncs[funcName] = MathEngine.compileMultivariable(ast3D, paramNames);

        // Step 2: User evaluates a(1, 2, 3)
        const callAst = new PrattParser('a(1, 2, 3)').parseExpression();
        const res = MathEngine.evaluateAST(callAst, StateManager.values);

        expect(MatrixEngine.isMatrix(res)).toBe(true);
        expect(res).toEqual([
            [1, 0, 0],
            [0, 2, 0],
            [0, 0, 3]
        ]);

        const display = MatrixEngine.formatMatrixDisplay(res);
        expect(display).toBe('[[1, 0, 0], [0, 2, 0], [0, 0, 3]]');
    });

    it('4. Shortcut regex recognition for function signatures and dimensions', () => {
        const hashRegex = /^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i;
        const matrixRegex = /^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?\\?matri[xz]$/i;

        // Tests for hash shortcuts
        const m1 = 'f(x)=#22'.match(hashRegex);
        expect(m1).not.toBeNull();
        expect(m1![1]).toBe('f(x)');
        expect(m1![2]).toBe('2');
        expect(m1![3]).toBe('2');

        const m2 = 'a(x,y,z)=#33'.match(hashRegex);
        expect(m2).not.toBeNull();
        expect(m2![1]).toBe('a(x,y,z)');
        expect(m2![2]).toBe('3');
        expect(m2![3]).toBe('3');

        const m3 = 'B=#24'.match(hashRegex);
        expect(m3).not.toBeNull();
        expect(m3![1]).toBe('B');
        expect(m3![2]).toBe('2');
        expect(m3![3]).toBe('4');

        // Tests for matrix shortcuts
        const mat1 = 'f(x)=matrix'.match(matrixRegex);
        expect(mat1).not.toBeNull();
        expect(mat1![1]).toBe('f(x)');

        const mat2 = 'a(x)=matriz'.match(matrixRegex);
        expect(mat2).not.toBeNull();
        expect(mat2![1]).toBe('a(x)');

        const mat3 = 'a(x,y,z)=matrix'.match(matrixRegex);
        expect(mat3).not.toBeNull();
        expect(mat3![1]).toBe('a(x,y,z)');

        const mat4 = 'matrix'.match(matrixRegex);
        expect(mat4).not.toBeNull();
        expect(mat4![1]).toBeUndefined();
    });

    it('5. Chained dependencies: a = 5, b = 2a, c = a + b', () => {
        StateManager.defineVariable('a', 5);
        StateManager.defineVariable('b', new PrattParser('2 * a').parseExpression());
        StateManager.defineVariable('c', new PrattParser('a + b').parseExpression());

        expect(StateManager.values['a']).toBe(5);
        expect(StateManager.values['b']).toBe(10);
        expect(StateManager.values['c']).toBe(15);
    });

    it('6. Function composition: f(x) = x + 1, g(x) = 2x, g(f(3))', () => {
        const astF = new PrattParser('x + 1').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x + 1', ast: astF };
        MathEngine.compiledFuncs['f'] = MathEngine.compile(astF, 'x');

        const astG = new PrattParser('2 * x').parseExpression();
        MathEngine.userFunctions['g'] = { params: ['x'], expr: '2 * x', ast: astG };
        MathEngine.compiledFuncs['g'] = MathEngine.compile(astG, 'x');

        const callAst = new PrattParser('g(f(3))').parseExpression();
        const res = MathEngine.evaluateAST(callAst, StateManager.values);
        expect(res).toBe(8);
    });

    it('7. Matrix arithmetic and operations: A + B, det(A), 2A', () => {
        const A = [[1, 2], [3, 4]];
        const B = [[5, 6], [7, 8]];

        expect(MatrixEngine.add(A, B)).toEqual([[6, 8], [10, 12]]);
        expect(MatrixEngine.scale(A, 2)).toEqual([[2, 4], [6, 8]]);
        expect(MatrixEngine.determinant(A)).toBeCloseTo(-2, 6);
        expect(MatrixEngine.transpose(A)).toEqual([[1, 3], [2, 4]]);
    });

    it('8. Point transformations via matrix: A * (x, y)', () => {
        const rot90 = [[0, -1], [1, 0]];
        const pt = { x: 3, y: 4 };
        const transformed = MatrixEngine.transformPoint(rot90, pt);
        expect(transformed.x).toBeCloseTo(-4, 6);
        expect(transformed.y).toBeCloseTo(3, 6);
    });
});
