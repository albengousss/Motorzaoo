import { ExpressionManager } from '../ui/expressionManager';

export interface BlockSnapshot {
    id: string;
    type: 'expression' | 'note' | 'folder' | 'matrix' | 'table';
    content: string; // ascii/latex para math, texto para nota, titulo para pasta
    color: string;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    lineWidth: number;
    visible: boolean;
    folderId?: string;
    isCollapsed?: boolean;
    sliderMin?: string;
    sliderMax?: string;
    sliderVal?: string;
    matrixData?: {
        name: string;
        rows: number;
        cols: number;
        data: string[][];
    };
    tableData?: {
        xCol: string;
        yCol: string;
        rows: { x: string; y: string }[];
        connectLines?: boolean;
    };
}

export interface HistorySnapshot {
    blocks: BlockSnapshot[];
    pinnedPoints: any[];
    timestamp: number;
}

export class HistoryManager {
    private static undoStack: HistorySnapshot[] = [];
    private static redoStack: HistorySnapshot[] = [];
    private static maxHistory = 50;
    private static isPerformingAction = false;
    private static debounceTimer: any = null;
    private static onUpdateCallback: (() => void) | null = null;
    private static onHistoryChangeCallback: ((canUndo: boolean, canRedo: boolean) => void) | null = null;

    static init(onUpdate: () => void, onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void) {
        this.onUpdateCallback = onUpdate;
        if (onHistoryChange) this.onHistoryChangeCallback = onHistoryChange;

        // Listener global de atalhos de teclado Ctrl+Z e Ctrl+Y / Ctrl+Shift+Z
        window.addEventListener('keydown', (e) => {
            // Ignora se estiver num input padrão (fora do escopo da sidebar) ou se o math-field tiver seleção ativa interna
            const isCtrl = e.ctrlKey || e.metaKey;
            if (!isCtrl) return;

            if (e.key === 'z' || e.key === 'Z') {
                if (e.shiftKey) {
                    // Ctrl + Shift + Z = Redo
                    e.preventDefault();
                    this.redo();
                } else {
                    // Ctrl + Z = Undo
                    // Se o foco estiver num math-field ou input normal sem histórico interno de bloco, aciona undo global
                    e.preventDefault();
                    this.undo();
                }
            } else if (e.key === 'y' || e.key === 'Y') {
                // Ctrl + Y = Redo
                e.preventDefault();
                this.redo();
            }
        });
    }

    static notifyChange() {
        if (this.onHistoryChangeCallback) {
            this.onHistoryChangeCallback(this.canUndo(), this.canRedo());
        }
    }

    static canUndo(): boolean {
        return this.undoStack.length > 1; // Pelo menos 1 estado anterior além do atual
    }

    static canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Captura o estado atual da interface e registra no histórico
     */
    static recordState(immediate: boolean = false) {
        if (this.isPerformingAction) return;

        if (immediate) {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.captureCurrentState();
        } else {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.captureCurrentState();
            }, 400);
        }
    }

    private static captureCurrentState() {
        const snapshot = this.getSnapshot();
        // Não adiciona se for idêntico ao topo da pilha
        if (this.undoStack.length > 0) {
            const last = this.undoStack[this.undoStack.length - 1];
            if (JSON.stringify(last.blocks) === JSON.stringify(snapshot.blocks)) {
                return;
            }
        }

        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        // Ao realizar uma nova ação, o redo é limpo
        this.redoStack = [];
        this.notifyChange();
    }

    static getSnapshot(): HistorySnapshot {
        const blocks: BlockSnapshot[] = [];
        const container = ExpressionManager.container;
        if (container) {
            Array.from(container.children).forEach((el: any) => {
                const blockType = (el.dataset.type as 'expression' | 'note' | 'folder' | 'matrix' | 'table') || 'expression';
                let content = '';
                let matrixData: any = undefined;
                let tableData: any = undefined;

                if (blockType === 'expression') {
                    const mf = el.querySelector('math-field');
                    content = mf ? (mf.getValue('ascii-math') || '') : '';
                } else if (blockType === 'note') {
                    const textarea = el.querySelector('textarea');
                    content = textarea ? textarea.value : '';
                } else if (blockType === 'folder') {
                    const titleInput = el.querySelector('.folder-title-input');
                    content = titleInput ? titleInput.value : 'Pasta';
                } else if (blockType === 'matrix') {
                    const nameInput = el.querySelector('.matrix-name-input') as HTMLInputElement;
                    const name = nameInput ? nameInput.value.trim() : 'A';
                    const rows = parseInt(el.dataset.rows || '2');
                    const cols = parseInt(el.dataset.cols || '2');
                    const data: string[][] = [];
                    for (let r = 0; r < rows; r++) {
                        const rowArr: string[] = [];
                        for (let c = 0; c < cols; c++) {
                            const cell = el.querySelector(`.matrix-cell[data-r="${r}"][data-c="${c}"]`) as HTMLInputElement;
                            rowArr.push(cell ? cell.value : '0');
                        }
                        data.push(rowArr);
                    }
                    content = `${name} = [[${data.map(r => r.join(', ')).join('], [')}]]`;
                    matrixData = { name, rows, cols, data };
                } else if (blockType === 'table') {
                    const xColInput = el.querySelector('.table-col-x') as HTMLInputElement;
                    const yColInput = el.querySelector('.table-col-y') as HTMLInputElement;
                    const xCol = xColInput ? xColInput.value.trim() : 'x_1';
                    const yCol = yColInput ? yColInput.value.trim() : 'y_1';
                    const connectLinesCb = el.querySelector('.table-connect-lines') as HTMLInputElement;
                    const connectLines = connectLinesCb ? connectLinesCb.checked : false;
                    const rows: { x: string; y: string }[] = [];
                    const rowEls = el.querySelectorAll('.table-data-row');
                    rowEls.forEach((rEl: HTMLElement) => {
                        const xi = rEl.querySelector('.table-cell-x') as HTMLInputElement;
                        const yi = rEl.querySelector('.table-cell-y') as HTMLInputElement;
                        if (xi && yi) {
                            rows.push({ x: xi.value, y: yi.value });
                        }
                    });
                    content = `Table(${xCol}, ${yCol})`;
                    tableData = { xCol, yCol, rows, connectLines };
                }

                const visBtn = el.querySelector('.visibility-toggle');
                const isVisible = visBtn ? (visBtn.dataset.visible !== 'false') : true;

                const sliderRow = el.querySelector('.slider-row');
                const minInput = sliderRow ? sliderRow.querySelector('.min-val') : null;
                const maxInput = sliderRow ? sliderRow.querySelector('.max-val') : null;
                const sliderInput = sliderRow ? sliderRow.querySelector('.slider-input') : null;

                blocks.push({
                    id: el.id,
                    type: blockType,
                    content,
                    color: el.dataset.color || '#2d70b3',
                    lineStyle: (el.dataset.lineStyle as any) || 'solid',
                    lineWidth: parseFloat(el.dataset.lineWidth || '2.5'),
                    visible: isVisible,
                    folderId: el.dataset.folderId,
                    isCollapsed: el.dataset.collapsed === 'true',
                    sliderMin: minInput ? minInput.value : undefined,
                    sliderMax: maxInput ? maxInput.value : undefined,
                    sliderVal: sliderInput ? sliderInput.value : undefined,
                    matrixData,
                    tableData
                });
            });
        }

        const pinned = (window as any)._pinnedPoints ? [...(window as any)._pinnedPoints] : [];

        return {
            blocks,
            pinnedPoints: pinned,
            timestamp: Date.now()
        };
    }

    static undo() {
        if (!this.canUndo()) return;
        this.isPerformingAction = true;

        const current = this.undoStack.pop()!;
        this.redoStack.push(current);

        const previous = this.undoStack[this.undoStack.length - 1];
        this.restoreSnapshot(previous);

        this.isPerformingAction = false;
        this.notifyChange();
        if (this.onUpdateCallback) this.onUpdateCallback();
    }

    static redo() {
        if (!this.canRedo()) return;
        this.isPerformingAction = true;

        const next = this.redoStack.pop()!;
        this.undoStack.push(next);
        this.restoreSnapshot(next);

        this.isPerformingAction = false;
        this.notifyChange();
        if (this.onUpdateCallback) this.onUpdateCallback();
    }

    private static restoreSnapshot(snapshot: HistorySnapshot) {
        ExpressionManager.restoreFromSnapshot(snapshot.blocks);
        if (snapshot.pinnedPoints && (window as any)._setPinnedPoints) {
            (window as any)._setPinnedPoints(snapshot.pinnedPoints);
        }
    }
}
