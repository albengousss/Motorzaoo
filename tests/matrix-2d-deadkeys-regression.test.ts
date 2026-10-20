// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';
import { GLRenderer } from '../src/graphics/glRenderer';
import { PrattParser } from '../src/core/prattParser';
import { StateManager } from '../src/core/stateManager';
import { ExpressionManager } from '../src/ui/expressionManager';
import { MatrixEngine } from '../src/core/matrixEngine';
import { MathEngine } from '../src/core/mathEngine';
import * as fs from 'fs';
import * as path from 'path';

describe('Regression Suite: 2D z-sliders, GLSL uniforms, ABNT2 deadkeys, KaTeX fonts & Anonymous Matrices', () => {

    it('detects "z" as free variable in 2D mode, but protects "z" as coordinate in 3D mode', () => {
        const expr = 'x^2 + y^2 + z^2 = 2';
        // In 2D mode (is2DMode = true):
        const free2D = FaultTolerantParser.detectFreeVariables(expr, [], true);
        expect(free2D).toContain('z');
        expect(free2D).not.toContain('x');
        expect(free2D).not.toContain('y');

        // In 3D mode (is2DMode = false):
        const free3D = FaultTolerantParser.detectFreeVariables(expr, [], false);
        expect(free3D).not.toContain('z');
        expect(free3D).not.toContain('x');
        expect(free3D).not.toContain('y');
    });

    it('GLRenderer.astToGLSL maps "z" to a uniform in 2D WebGL instead of raw undeclared identifier', () => {
        const usedUniforms = new Set<string>();
        const ast = new PrattParser('x^2 + y^2 + z^2').parseExpression();
        const glsl = GLRenderer.astToGLSL(ast, {}, usedUniforms);

        // GLSL expression must reference u_var_z and register z in usedUniforms
        expect(glsl).toContain('u_var_z');
        expect(usedUniforms.has('z')).toBe(true);
        // It must NOT have bare ' + z' or 'z * z' as an undeclared symbol
        expect(glsl).not.toMatch(/\bz\b/);
    });

    it('verifies that all 20 KaTeX woff2 fonts are deployed in public/assets/fonts and public/fonts', () => {
        const expectedFonts = [
            'KaTeX_AMS-Regular.woff2',
            'KaTeX_Caligraphic-Bold.woff2',
            'KaTeX_Caligraphic-Regular.woff2',
            'KaTeX_Fraktur-Bold.woff2',
            'KaTeX_Fraktur-Regular.woff2',
            'KaTeX_Main-Bold.woff2',
            'KaTeX_Main-BoldItalic.woff2',
            'KaTeX_Main-Italic.woff2',
            'KaTeX_Main-Regular.woff2',
            'KaTeX_Math-BoldItalic.woff2',
            'KaTeX_Math-Italic.woff2',
            'KaTeX_SansSerif-Bold.woff2',
            'KaTeX_SansSerif-Italic.woff2',
            'KaTeX_SansSerif-Regular.woff2',
            'KaTeX_Script-Regular.woff2',
            'KaTeX_Size1-Regular.woff2',
            'KaTeX_Size2-Regular.woff2',
            'KaTeX_Size3-Regular.woff2',
            'KaTeX_Size4-Regular.woff2',
            'KaTeX_Typewriter-Regular.woff2'
        ];

        const assetsFontsDir = path.resolve(__dirname, '../public/assets/fonts');
        const rootFontsDir = path.resolve(__dirname, '../public/fonts');

        expect(fs.existsSync(assetsFontsDir)).toBe(true);
        expect(fs.existsSync(rootFontsDir)).toBe(true);

        expectedFonts.forEach(fontFile => {
            const path1 = path.join(assetsFontsDir, fontFile);
            const path2 = path.join(rootFontsDir, fontFile);
            expect(fs.existsSync(path1), `Missing ${fontFile} in public/assets/fonts`).toBe(true);
            expect(fs.existsSync(path2), `Missing ${fontFile} in public/fonts`).toBe(true);
            expect(fs.statSync(path1).size).toBeGreaterThan(1000);
            expect(fs.statSync(path2).size).toBeGreaterThan(1000);
        });
    });

    it('verifies favicon link in index.html', () => {
        const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
        expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    });

    it('verifies LaTeX healing cleans accidental literal caret artifacts from ABNT2 deadkeys', () => {
        const strayLatex = 'x\\text{^}2 + y\\text{^}3';
        const fixed = strayLatex
            .replace(/\\text\{\^\}([0-9a-zA-Z]+)/g, '^{$1}')
            .replace(/\\text\{\^\}/g, '')
            .replace(/\\hat\{\}/g, '');
        expect(fixed).toBe('x^{2} + y^{3}');
    });

    it('handles "z" as a configurable scalar slider in 2D mode, but reserves it as spatial coordinate in 3D mode', () => {
        StateManager.viewMode = '2d';
        const reserved2D = StateManager.viewMode === '3d' ? ['x', 'y', 'z', 't', 'e', 'pi'] : ['x', 'y', 't', 'e', 'pi'];
        expect(reserved2D).not.toContain('z');

        const isCoord2D = (varName: string) => (varName === 'x' || varName === 'y' || varName === 'e' || varName === 'pi' || (StateManager.viewMode === '3d' && varName === 'z'));
        expect(isCoord2D('z')).toBe(false);
        expect(isCoord2D('x')).toBe(true);
        expect(isCoord2D('y')).toBe(true);

        StateManager.viewMode = '3d';
        const reserved3D = StateManager.viewMode === '3d' ? ['x', 'y', 'z', 't', 'e', 'pi'] : ['x', 'y', 't', 'e', 'pi'];
        expect(reserved3D).toContain('z');

        const isCoord3D = (varName: string) => (varName === 'x' || varName === 'y' || varName === 'e' || varName === 'pi' || (StateManager.viewMode === '3d' && varName === 'z'));
        expect(isCoord3D('z')).toBe(true);

        // Reset
        StateManager.viewMode = '2d';
    });

    it('uses word-boundary regexes so math functions like max() and hypot() are not treated as forbidden coordinates', () => {
        const checkForbidden = (rightSide: string, is3D: boolean) => {
            return is3D
                ? (/\b[xyz]\b/.test(rightSide) || /\\mathbf\{[xyz]\}/.test(rightSide))
                : (/\b[xy]\b/.test(rightSide) || /\\mathbf\{[xy]\}/.test(rightSide));
        };

        // Functions containing letter 'x' or 'y' as substrings should NOT trigger coordinate prohibition
        expect(checkForbidden('max(2, 3)', false)).toBe(false);
        expect(checkForbidden('hypot(3, 4)', false)).toBe(false);
        expect(checkForbidden('sqrt(16)', false)).toBe(false);
        expect(checkForbidden('z + 1', false)).toBe(false); // z is allowed in 2D expressions

        // Standalone x or y MUST be recognized as coordinates
        expect(checkForbidden('x + 1', false)).toBe(true);
        expect(checkForbidden('2 * y', false)).toBe(true);
        expect(checkForbidden('z + 1', true)).toBe(true); // in 3D, z is a coordinate
    });

    it('requires sliders to be defined before plotting curves (Desmos parity for x^2 + y^2 + z^2 = 2)', () => {
        StateManager.viewMode = '2d';
        StateManager.values = {};
        const cleanStr = 'x^2 + y^2 + z^2 = 2';
        const boundForSliders = ['x', 'y', 't', 'pi', 'e'];
        
        // Before slider is created:
        const freeBefore = FaultTolerantParser.detectFreeVariables(cleanStr, boundForSliders, true);
        const missingBefore = freeBefore.filter(v => StateManager.values[v] === undefined);
        expect(missingBefore).toEqual(['z']);
        // Because missingBefore.length > 0, the curve MUST NOT be pushed to validEquations!

        // User clicks to create slider z:
        StateManager.values['z'] = 1;
        const freeAfter = FaultTolerantParser.detectFreeVariables(cleanStr, [...boundForSliders, ...Object.keys(StateManager.values)], true);
        const missingAfter = freeAfter.filter(v => StateManager.values[v] === undefined);
        expect(missingAfter).toEqual([]);
        // Now missingAfter is empty, so the curve IS plotted with z = 1!
    });

    it('generates Desmos-compliant inline matrix LaTeX with zero defaults', () => {
        const mat22 = ExpressionManager.generateMatrixLatex(2, 2);
        expect(mat22).toBe('\\begin{bmatrix} 0 & 0 \\\\ 0 & 0 \\end{bmatrix}');

        const mat34 = ExpressionManager.generateMatrixLatex(3, 4);
        expect(mat34).toBe('\\begin{bmatrix} 0 & 0 & 0 & 0 \\\\ 0 & 0 & 0 & 0 \\\\ 0 & 0 & 0 & 0 \\end{bmatrix}');

        const customData = ExpressionManager.generateMatrixLatex(2, 2, [['1', '2'], ['3', '4']]);
        expect(customData).toBe('\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}');
    });

    it('distinguishes pure literal matrix from matrix operations', () => {
        const pureAst = new PrattParser('[[1, 2], [3, 4]]').parseExpression();
        const pureClean = '[[1, 2], [3, 4]]';
        const isPureLiteral = (pureAst[0] === 'List' && Array.isArray(pureAst[1]) && pureAst[1][0] === 'List') ||
            /^\[\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\](?:\s*,\s*\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\])*\]$/.test(pureClean.trim());
        expect(isPureLiteral).toBe(true);

        const opAst = new PrattParser('[[1, 2], [3, 4]] * 2').parseExpression();
        const opClean = '[[1, 2], [3, 4]] * 2';
        const isOpLiteral = (opAst[0] === 'List' && Array.isArray(opAst[1]) && opAst[1][0] === 'List') ||
            /^\[\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\](?:\s*,\s*\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\])*\]$/.test(opClean.trim());
        expect(isOpLiteral).toBe(false);

        // Op evaluation evaluates to a matrix
        const evalRes = MathEngine.evaluateAST(opAst, {});
        expect(MatrixEngine.isMatrix(evalRes)).toBe(true);
        expect(evalRes).toEqual([[2, 4], [6, 8]]);
        expect(MatrixEngine.formatMatrixDisplay(evalRes)).toBe('[[2, 4], [6, 8]]');
    });

    it('creates pure inline math-field blocks and handles for matrices without legacy purple widgets', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();

        const blockId = ExpressionManager.addMatrix({ name: 'A', rows: 2, cols: 2 });
        const block = document.getElementById(blockId);
        expect(block).toBeTruthy();

        // Must NOT be a custom widget card
        expect(block?.dataset.type).not.toBe('matrix');
        expect(block?.querySelector('.matrix-name-input')).toBeNull();
        expect(block?.querySelector('.matrix-dim-badge')).toBeNull();

        // MUST be a standard math-field expression block with inline handle
        const mf = block?.querySelector('math-field') as any;
        expect(mf).toBeTruthy();
        expect(mf.value).toBe('A = \\begin{bmatrix} 0 & 0 \\\\ 0 & 0 \\end{bmatrix}');

        const handle = block?.querySelector('.matrix-inline-handle');
        expect(handle).toBeTruthy();

        const tooltip = block?.querySelector('.matrix-inline-tooltip');
        expect(tooltip).toBeTruthy();
    });

    it('restores clean Desmos color circle border on setError(blockId, null) without white ring gap', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();

        const blockId = ExpressionManager.addBlock(false, 'x^2');
        const block = document.getElementById(blockId)!;
        block.dataset.color = '#2d70b3';
        const visBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        expect(visBtn).toBeTruthy();

        // Trigger error then clear error
        ExpressionManager.setError(blockId, 'Algum erro');
        expect(visBtn.style.display).toBe('none');

        ExpressionManager.setError(blockId, null);
        expect(visBtn.style.display).toBe('flex');
        expect(visBtn.style.border).toMatch(/2px solid (?:#2d70b3|rgb\(45, 112, 179\))/);
        expect(visBtn.style.border).not.toContain('#ffffff');
        expect(visBtn.style.boxShadow).toBe('none');
    });
});
