// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionManager } from '../src/ui/expressionManager';

describe('Phase 1: HUD & Pixel Parity 100% Test Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <header id="dcg-header"></header>
            <div id="sidebar" style="width: 500px;">
                <div id="sidebar-header">
                    <button id="add-item-btn"></button>
                    <button id="edit-list-btn"></button>
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
                <button id="settings-btn"></button>
                <div id="zoom-container">
                    <button id="zoom-in-btn"></button>
                    <button id="zoom-out-btn"></button>
                    <button id="reset-view-btn" class="hidden"></button>
                </div>
            </div>
        `;
        ExpressionManager.container = document.getElementById('expressions-list')!;
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
        ExpressionManager.init(() => {});
        // Clear initial block added by init to test from scratch
        ExpressionManager.container.innerHTML = '';
        ExpressionManager.blockCounter = 0;
    });

    it('1. Strict 6-Color Cycle (Vermelho, Azul, Verde, Roxo, Laranja, Preto #000000)', () => {
        const expectedColors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
        const blocks: string[] = [];

        for (let i = 0; i < 6; i++) {
            blocks.push(ExpressionManager.addBlock());
        }

        blocks.forEach((id, idx) => {
            const el = document.getElementById(id);
            expect(el).toBeTruthy();
            expect(el!.dataset.color).toBe(expectedColors[idx]);
        });

        // 7th block loops back to red
        const seventh = ExpressionManager.addBlock();
        const el7 = document.getElementById(seventh);
        expect(el7!.dataset.color).toBe(expectedColors[0]);
    });

    it('2. .dcg-tab geometry (38px width) and 29x29px circular icon', () => {
        const blockId = ExpressionManager.addBlock();
        const el = document.getElementById(blockId);
        expect(el).toBeTruthy();

        const tab = el!.querySelector('.dcg-tab') as HTMLElement;
        expect(tab).toBeTruthy();
        expect(tab.className).toContain('dcg-tab');
        expect(tab.className).toContain('w-[38px]');

        const visBtn = tab.querySelector('.visibility-toggle') as HTMLElement;
        expect(visBtn).toBeTruthy();
        expect(visBtn.style.width).toBe('29px');
        expect(visBtn.style.height).toBe('29px');

        const numSpan = tab.querySelector('.block-number') as HTMLElement;
        expect(numSpan).toBeTruthy();
        expect(numSpan.textContent).toBe('1');
    });

    it('3. Dynamic Focus Highlight on Block and .dcg-tab', () => {
        const blockId = ExpressionManager.addBlock();
        const block = document.getElementById(blockId) as HTMLElement;
        const tab = block.querySelector('.dcg-tab') as HTMLElement;

        // Idle state
        expect(block.classList.contains('is-focused')).toBe(false);

        // Trigger focusin
        block.dispatchEvent(new Event('focusin', { bubbles: true }));
        expect(block.classList.contains('is-focused')).toBe(true);
        expect(tab.style.backgroundColor).toBe('rgb(210, 231, 245)'); // #d2e7f5 in RGB

        // Trigger focusout
        block.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
        expect(block.classList.contains('is-focused')).toBe(false);
        expect(tab.style.backgroundColor).toBe('rgb(238, 238, 238)'); // #eeeeee in RGB
    });

    it('4. Result display pill styling and fraction toggle', () => {
        const blockId = ExpressionManager.addBlock();
        ExpressionManager.setResult(blockId, '1.5');

        const block = document.getElementById(blockId) as HTMLElement;
        const resDisplay = block.querySelector('.result-display') as HTMLElement;
        expect(resDisplay).toBeTruthy();
        expect(resDisplay.classList.contains('hidden')).toBe(false);

        // Fraction button present for rational numbers
        const fracBtn = resDisplay.querySelector('.fraction-toggle-btn') as HTMLButtonElement;
        expect(fracBtn).toBeTruthy();
        expect(fracBtn.textContent?.trim()).toBe('a/b');
    });

    it('5. Dual Undo / Redo synchronization between header and sidebar', () => {
        const headerUndo = document.getElementById('undo-btn') as HTMLButtonElement;
        const sidebarUndo = document.getElementById('sidebar-undo-btn') as HTMLButtonElement;
        expect(headerUndo).toBeTruthy();
        expect(sidebarUndo).toBeTruthy();

        // Initially disabled with no history
        expect(headerUndo.disabled).toBe(true);
        expect(sidebarUndo.disabled).toBe(true);
    });
});
