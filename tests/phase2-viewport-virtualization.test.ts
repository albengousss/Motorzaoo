// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/core/stateManager';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';
import { parseStepInput, formatStepForDisplay } from '../src/core/stepParser';
import { ExpressionManager } from '../src/ui/expressionManager';

describe('Phase 1 Residuals & Phase 2 Viewport & Virtualization Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="sidebar" style="width: 500px;">
                <div id="sidebar-header">
                    <button id="add-item-btn"></button>
                    <button id="edit-list-btn"></button>
                    <button id="done-edit-list-btn" class="hidden"></button>
                    <button id="undo-btn"></button>
                    <button id="redo-btn"></button>
                    <button id="sidebar-undo-btn"></button>
                    <button id="sidebar-redo-btn"></button>
                </div>
                <div id="expressions-list"></div>
                <div id="sliders-container"></div>
            </div>
            <div id="sidebar-resizer"></div>
            <button id="sidebar-expand-tab"></button>
            <div id="graph-container">
                <canvas id="graphCanvas"></canvas>
            </div>
        `;
        ExpressionManager.container = document.getElementById('expressions-list')!;
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
        ExpressionManager.init(() => {});
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
    });

    describe('1. Step Input Parsing (pi, fractions, decimals)', () => {
        it('parses pi, \\pi, and π correctly', () => {
            expect(parseStepInput('pi')).toBeCloseTo(Math.PI, 6);
            expect(parseStepInput('\\pi')).toBeCloseTo(Math.PI, 6);
            expect(parseStepInput('π')).toBeCloseTo(Math.PI, 6);
        });

        it('parses fractional multiples of pi (pi/2, pi/4, 2pi, 3pi/2)', () => {
            expect(parseStepInput('pi/2')).toBeCloseTo(Math.PI / 2, 6);
            expect(parseStepInput('pi/4')).toBeCloseTo(Math.PI / 4, 6);
            expect(parseStepInput('2pi')).toBeCloseTo(2 * Math.PI, 6);
            expect(parseStepInput('3pi/2')).toBeCloseTo(1.5 * Math.PI, 6);
            expect(parseStepInput('\\pi/2')).toBeCloseTo(Math.PI / 2, 6);
        });

        it('parses numeric fractions (1/2, 3/4, 5/2)', () => {
            expect(parseStepInput('1/2')).toBe(0.5);
            expect(parseStepInput('3/4')).toBe(0.75);
            expect(parseStepInput('5/2')).toBe(2.5);
        });

        it('parses standard positive decimal steps', () => {
            expect(parseStepInput('0.2')).toBe(0.2);
            expect(parseStepInput('1')).toBe(1);
            expect(parseStepInput('5')).toBe(5);
        });

        it('rejects invalid or negative/zero steps', () => {
            expect(parseStepInput('')).toBeNull();
            expect(parseStepInput('   ')).toBeNull();
            expect(parseStepInput('0')).toBeNull();
            expect(parseStepInput('-2')).toBeNull();
            expect(parseStepInput('abc')).toBeNull();
        });

        it('formats steps for display correctly', () => {
            expect(formatStepForDisplay(Math.PI)).toBe('π');
            expect(formatStepForDisplay(Math.PI / 2)).toBe('π/2');
            expect(formatStepForDisplay(Math.PI / 4)).toBe('π/4');
            expect(formatStepForDisplay(2 * Math.PI)).toBe('2π');
            expect(formatStepForDisplay(1.5 * Math.PI)).toBe('3π/2');
            expect(formatStepForDisplay(0.5)).toBe('0.5');
            expect(formatStepForDisplay(null)).toBe('');
        });
    });

    describe('2. Minor Grid Subdivisions (Mantissa Normalization at Any Zoom Magnitude)', () => {
        const getNormalizedSubdivisions = (step: number, isRad: boolean) => {
            if (isRad || Math.abs(step % (Math.PI / 4)) < 1e-4) return 4;
            const mag = Math.floor(Math.log10(step));
            const mantissa = Math.round(step / Math.pow(10, mag)); // 1, 2, ou 5
            if (mantissa === 2) return 4;
            return 5;
        };

        it('computes 4 subdivisions for mantissa 2 and 5 for mantissa 1 and 5 in standard zoom', () => {
            expect(getNormalizedSubdivisions(1, false)).toBe(5);
            expect(getNormalizedSubdivisions(2, false)).toBe(4);
            expect(getNormalizedSubdivisions(5, false)).toBe(5);
            expect(getNormalizedSubdivisions(10, false)).toBe(5);
            expect(getNormalizedSubdivisions(20, false)).toBe(4);
            expect(getNormalizedSubdivisions(50, false)).toBe(5);
        });

        it('correctly handles decimal zoom scales (< 0.5) without round-to-zero bugs', () => {
            expect(getNormalizedSubdivisions(0.5, false)).toBe(5);
            expect(getNormalizedSubdivisions(0.2, false)).toBe(4);
            expect(getNormalizedSubdivisions(0.1, false)).toBe(5);
            expect(getNormalizedSubdivisions(0.05, false)).toBe(5);
            expect(getNormalizedSubdivisions(0.02, false)).toBe(4);
            expect(getNormalizedSubdivisions(0.01, false)).toBe(5);
            expect(getNormalizedSubdivisions(0.002, false)).toBe(4);
        });

        it('uses 4 subdivisions in radian mode or steps of pi/4, pi/2, pi', () => {
            expect(getNormalizedSubdivisions(Math.PI / 2, false)).toBe(4);
            expect(getNormalizedSubdivisions(Math.PI, false)).toBe(4);
            expect(getNormalizedSubdivisions(1, true)).toBe(4);
        });
    });

    describe('3. Integer Grid Indexing Immunity on Negative Coordinates', () => {
        it('identifies major vs minor gridlines consistently across negative numbers', () => {
            const majorStep = 2;
            const minorSubdivs = 4;
            const minorStep = majorStep / minorSubdivs; // 0.5
            const xMin = -4;
            const xMax = 4;

            const kMin = Math.ceil(xMin / minorStep); // -8
            const kMax = Math.floor(xMax / minorStep); // 8

            const minorLines: number[] = [];
            const majorLines: number[] = [];

            for (let k = kMin; k <= kMax; k++) {
                const x = k * minorStep;
                if (Math.abs(x) < 1e-10) continue; // Axis line

                if (k % minorSubdivs !== 0) {
                    minorLines.push(x);
                } else {
                    majorLines.push(x);
                }
            }

            // Major lines should be exact multiples of 2 (-4, -2, 2, 4)
            expect(majorLines).toEqual([-4, -2, 2, 4]);
            // Minor lines should NOT contain any multiple of 2
            minorLines.forEach(x => {
                expect(Math.abs(x) % 2).not.toBe(0);
            });
        });
    });

    describe('4. Viewport Reactive Variables (width and height)', () => {
        it('updates viewport dimensions reactively and notifies DAG', () => {
            StateManager.updateViewportDimensions(1420, 900);
            expect(StateManager.values['width']).toBe(1420);
            expect(StateManager.values['height']).toBe(900);

            // Define a dependent variable aspect = width / height
            // AST: ["Divide", "width", "height"]
            StateManager.defineVariable('aspect', ['Divide', 'width', 'height']);
            expect(StateManager.values['aspect']).toBeCloseTo(1420 / 900, 6);

            // Resize viewport again
            StateManager.updateViewportDimensions(1920, 1080);
            expect(StateManager.values['width']).toBe(1920);
            expect(StateManager.values['height']).toBe(1080);
            expect(StateManager.values['aspect']).toBeCloseTo(1920 / 1080, 6);
        });

        it('clears state cleanly during StateManager.clearAll()', () => {
            StateManager.updateViewportDimensions(1280, 720);
            StateManager.clearAll();
            expect(StateManager.values).toEqual({});
        });

        it('protects width and height in FaultTolerantParser so no phantom sliders are proposed', () => {
            expect(FaultTolerantParser.PROTECTED_IDENTIFIERS.has('width')).toBe(true);
            expect(FaultTolerantParser.PROTECTED_IDENTIFIERS.has('height')).toBe(true);

            const freeInWidth = FaultTolerantParser.detectFreeVariables('x + width');
            expect(freeInWidth).not.toContain('width');

            const freeInHeight = FaultTolerantParser.detectFreeVariables('y * height');
            expect(freeInHeight).not.toContain('height');

            const freeInBoth = FaultTolerantParser.detectFreeVariables('width * height + a');
            expect(freeInBoth).toEqual(['a']);
        });
    });

    describe('5. Edit List Mode & Done Button Coordination', () => {
        it('toggles is-editing-list and swaps #edit-list-btn and #done-edit-list-btn', () => {
            const editBtn = document.getElementById('edit-list-btn') as HTMLButtonElement;
            const doneBtn = document.getElementById('done-edit-list-btn') as HTMLButtonElement;
            const list = document.getElementById('expressions-list')!;

            expect(editBtn).toBeTruthy();
            expect(doneBtn).toBeTruthy();
            expect(list.classList.contains('is-editing-list')).toBe(false);
            expect(doneBtn.classList.contains('hidden')).toBe(true);

            // Click Edit List
            editBtn.click();
            expect(list.classList.contains('is-editing-list')).toBe(true);
            expect(editBtn.classList.contains('hidden')).toBe(true);
            expect(doneBtn.classList.contains('hidden')).toBe(false);

            // Click Done
            doneBtn.click();
            expect(list.classList.contains('is-editing-list')).toBe(false);
            expect(editBtn.classList.contains('hidden')).toBe(false);
            expect(doneBtn.classList.contains('hidden')).toBe(true);
        });

        it('assigns block-delete-btn class to expression, note and table delete buttons', () => {
            const blockId = ExpressionManager.addBlock();
            const block = document.getElementById(blockId);
            expect(block).toBeTruthy();

            const delBtn = block!.querySelector('.block-delete-btn');
            expect(delBtn).toBeTruthy();
        });
    });
});
