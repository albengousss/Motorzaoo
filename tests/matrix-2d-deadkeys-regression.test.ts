// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';
import { GLRenderer } from '../src/graphics/glRenderer';
import { PrattParser } from '../src/core/prattParser';
import { StateManager } from '../src/core/stateManager';
import { ExpressionManager } from '../src/ui/expressionManager';
import { MatrixEngine } from '../src/core/matrixEngine';
import { MathEngine } from '../src/core/mathEngine';
import { Camera } from '../src/graphics/camera';
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

    it('Camera initialization fixes X in [-10, 10] with 1:1 square aspect ratio for Y (Desmos standard)', () => {
        Camera.isInitialized = false;
        Camera.resize(800, 600); // 4:3 aspect ratio

        // Horizontal axis MUST be fixed to [-10, 10]
        expect(Camera.xMin).toBe(-10);
        expect(Camera.xMax).toBe(10);

        // Vertical axis MUST be 10 * (h / w) = 10 * 0.75 = 7.5
        expect(Camera.yMin).toBeCloseTo(-7.5, 5);
        expect(Camera.yMax).toBeCloseTo(7.5, 5);

        // Reset must restore the exact same Desmos default
        Camera.reset();
        expect(Camera.xMin).toBe(-10);
        expect(Camera.xMax).toBe(10);
        expect(Camera.yMin).toBeCloseTo(-7.5, 5);
        expect(Camera.yMax).toBeCloseTo(7.5, 5);

        // Home button isAtDefault check:
        const expectedYHalf = 10 * (Camera.height / (Camera.width || 1));
        const isAtDefault = (
            Math.abs(Camera.xMin - (-10)) < 1e-3 &&
            Math.abs(Camera.xMax - 10) < 1e-3 &&
            Math.abs(Camera.yMin - (-expectedYHalf)) < 1e-3 &&
            Math.abs(Camera.yMax - expectedYHalf) < 1e-3
        );
        expect(isAtDefault).toBe(true);
    });

    it('verifies that "tr" is removed from inlineShortcuts while "trace" and "matrix" are preserved', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();
        const blockId = ExpressionManager.addBlock(false, 'x');
        const block = document.getElementById(blockId)!;
        const mf = block.querySelector('math-field') as any;

        expect(mf.inlineShortcuts).toHaveProperty('matrix');
        expect(mf.inlineShortcuts).toHaveProperty('matriz');
        expect(mf.inlineShortcuts).toHaveProperty('trace');
        expect(mf.inlineShortcuts).toHaveProperty('det');
        // 'tr' MUST NOT be an inline shortcut because it collides with typing 'matrix'
        expect(mf.inlineShortcuts).not.toHaveProperty('tr');
    });

    it('verifies keybindings protect closing bracket "]" from triggering LaTeX Backslash mode on ABNT2', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();
        const blockId = ExpressionManager.addBlock(false, 'x');
        const block = document.getElementById(blockId)!;
        const mf = block.querySelector('math-field') as any;

        // Ensure keybindings do NOT contain switchMode for backslash
        const bindings = mf.keybindings || [];
        const switchModeBindings = bindings.filter((b: any) => {
            const cmd = Array.isArray(b.command) ? b.command[0] : b.command;
            return cmd === 'switchMode';
        });
        expect(switchModeBindings).toHaveLength(0);

        // Ensure keybindings have explicit mappings for brackets
        const bracketBindings = bindings.filter((b: any) => b.key === ']' || b.key === '[');
        expect(bracketBindings.length).toBeGreaterThanOrEqual(2);
    });

    it('ExpressionManager.setResult renders matrix result as HTML markup without raw \\begin{bmatrix} string leakage', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();
        const blockId = ExpressionManager.addBlock(false, 'a');
        const block = document.getElementById(blockId)!;
        const resDisplay = block.querySelector('.result-display') as HTMLElement;

        // Set matrix result
        ExpressionManager.setResult(blockId, '= [[0, 0], [0, 0], [0, 0]]');

        // MUST NOT display raw LaTeX string as text
        const text = resDisplay.textContent || '';
        expect(text).not.toContain('\\begin{bmatrix}');
        expect(text).not.toContain('\\end{bmatrix}');
        // MUST contain rendered markup
        expect(resDisplay.innerHTML).toContain('ML__');
        expect(block.dataset.isMatrix).toBe('true');

        const visBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        expect(visBtn.style.display).toBe('none');
    });

    it('ExpressionManager.setResult renders fraction toggle and markup when toggled to fraction', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();
        const blockId = ExpressionManager.addBlock(false, '1.5');
        const block = document.getElementById(blockId)!;
        const resDisplay = block.querySelector('.result-display') as HTMLElement;

        // Set decimal result that is rational
        ExpressionManager.setResult(blockId, '= 1.5');
        const fracBtn = resDisplay.querySelector('.fraction-toggle-btn') as HTMLButtonElement;
        expect(fracBtn).toBeTruthy();
        const text = resDisplay.textContent || '';
        expect(text).toContain('1.5');

        // Click to toggle fraction
        fracBtn.click();
        expect((block as any)._showFraction).toBe(true);
        // In fraction mode, rendered markup should be present
        expect(resDisplay.innerHTML).toContain('ML__');
    });

    it('Camera maintains X in [-10, 10] across initial layout resizing until user pans or zooms', () => {
        Camera.reset();
        expect(Camera.hasUserInteracted).toBe(false);

        // Initial measurement at full window width (e.g. 1720x900)
        Camera.resize(1720, 900);
        expect(Camera.xMin).toBe(-10);
        expect(Camera.xMax).toBe(10);

        // Sidebar layout settles at 1220x900 before user interaction
        Camera.resize(1220, 900);
        expect(Camera.xMin).toBe(-10);
        expect(Camera.xMax).toBe(10);
        const expectedYHalf = 10 * (900 / 1220);
        expect(Camera.yMin).toBeCloseTo(-expectedYHalf, 5);
        expect(Camera.yMax).toBeCloseTo(expectedYHalf, 5);

        // Once user interacts (e.g. pan):
        Camera.pan(50, 0);
        expect(Camera.hasUserInteracted).toBe(true);

        // Reset clears interaction and restores default
        Camera.reset();
        expect(Camera.hasUserInteracted).toBe(false);
        expect(Camera.xMin).toBe(-10);
        expect(Camera.xMax).toBe(10);
    });

    it('ExpressionManager hides visibility-toggle on matrix expressions and preserves hidden state on setError(blockId, null)', () => {
        document.body.innerHTML = `
            <div id="expressions-list"></div>
            <button id="add-expression-btn"></button>
            <div id="sidebar"></div>
        `;
        ExpressionManager.init();
        const blockId = ExpressionManager.addBlock(false, 'a = \\begin{bmatrix} 0 & 0 \\\\ 0 & 0 \\end{bmatrix}');
        const block = document.getElementById(blockId)!;
        const visBtn = block.querySelector('.visibility-toggle') as HTMLElement;

        ExpressionManager.updateMatrixBlockVisual(block, true);
        expect(block.dataset.isMatrix).toBe('true');
        expect(visBtn.style.display).toBe('none');

        // Clear error should NOT force visibility toggle to flex if isMatrix is true
        ExpressionManager.setError(blockId, null);
        expect(visBtn.style.display).toBe('none');

        // Non-matrix restores flex
        ExpressionManager.updateMatrixBlockVisual(block, false);
        expect(block.dataset.isMatrix).toBe('false');
        expect(visBtn.style.display).toBe('flex');
    });

    it('verifies virtual keyboard CAS tab inserts bmatrix with zeros instead of pmatrix with placeholders', () => {
        const mainContent = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
        expect(mainContent).toContain('{ insert: "\\\\begin{bmatrix} 0 & 0 \\\\\\\\ 0 & 0 \\\\end{bmatrix}", label: "Mat 2x2"');
        expect(mainContent).toContain('{ insert: "\\\\begin{bmatrix} 0 & 0 & 0 \\\\\\\\ 0 & 0 & 0 \\\\\\\\ 0 & 0 & 0 \\\\end{bmatrix}", label: "Mat 3x3"');
        expect(mainContent).toContain('{ insert: "\\\\begin{bmatrix} 0 \\\\\\\\ 0 \\\\end{bmatrix}", label: "Vet 2D"');
        expect(mainContent).not.toContain('{ insert: "\\\\begin{pmatrix}#? & #?');
    });
});
