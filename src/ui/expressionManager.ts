import { StateManager } from '../core/stateManager';
import { MathEngine } from '../core/mathEngine';
import { MatrixEngine } from '../core/matrixEngine';
import { RationalEngine } from '../core/rationalEngine';
import { PrattParser } from '../core/prattParser';
import { HistoryManager, type BlockSnapshot } from '../core/historyManager';
import { convertLatexToMarkup } from 'mathlive';

export class ExpressionManager {
    static container: HTMLElement = typeof document !== 'undefined' ? document.getElementById('expressions-list')! : (null as any);
    static addBtn: HTMLElement = typeof document !== 'undefined' ? document.getElementById('add-expr-btn')! : (null as any);
    static onUpdateCallback: () => void;
    static blockCounter = 0;
    static activeMathfield: any = null;

    // ─── POPOVER DE ESTILO (DESMOS STYLE) ──────────────────────────
    static stylePopover: HTMLDivElement = typeof document !== 'undefined' ? document.createElement('div') : (null as any);
    static currentStyledBlock: HTMLElement | null = null;

    static initStylePopover() {
        this.stylePopover.id = 'expression-style-popover';
        this.stylePopover.className = 'fixed bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-50 select-none hidden flex-col gap-3 min-w-[230px] transition-all duration-150';
        this.stylePopover.innerHTML = `
            <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                <span class="text-xs font-bold text-gray-700 tracking-wide uppercase">Estilo da Curva</span>
                <button id="close-style-popover" class="text-gray-400 hover:text-gray-700 p-0.5 rounded cursor-pointer transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <!-- Paleta de Cores Desmos -->
            <div>
                <span class="text-[11px] font-semibold text-gray-500 block mb-1.5">Cor</span>
                <div class="grid grid-cols-6 gap-1.5" id="style-color-palette">
                    ${['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'].map(c => `
                        <button class="color-swatch w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110 active:scale-95 border-2 border-white shadow-sm flex items-center justify-center" data-color="${c}" style="background-color: ${c}">
                        </button>
                    `).join('')}
                </div>
            </div>
            <!-- Estilo da Linha -->
            <div>
                <span class="text-[11px] font-semibold text-gray-500 block mb-1.5">Traçado</span>
                <div class="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg" id="style-line-types">
                    <button class="line-style-btn py-1.5 px-2 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all flex flex-col items-center gap-1 cursor-pointer" data-style="solid" title="Linha Sólida">
                        <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2.5"/></svg>
                        <span class="text-[10px]">Sólida</span>
                    </button>
                    <button class="line-style-btn py-1.5 px-2 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all flex flex-col items-center gap-1 cursor-pointer" data-style="dashed" title="Linha Tracejada">
                        <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2.5" stroke-dasharray="6,4"/></svg>
                        <span class="text-[10px]">Tracejada</span>
                    </button>
                    <button class="line-style-btn py-1.5 px-2 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all flex flex-col items-center gap-1 cursor-pointer" data-style="dotted" title="Linha Pontilhada">
                        <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" stroke-width="2.5" stroke-dasharray="2,3"/></svg>
                        <span class="text-[10px]">Pontilhada</span>
                    </button>
                </div>
            </div>
            <!-- Espessura da Linha -->
            <div>
                <span class="text-[11px] font-semibold text-gray-500 block mb-1.5">Espessura</span>
                <div class="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg" id="style-line-widths">
                    <button class="line-width-btn py-1 px-2 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all cursor-pointer" data-width="1.5">Fina</button>
                    <button class="line-width-btn py-1 px-2 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all cursor-pointer" data-width="2.5">Normal</button>
                    <button class="line-width-btn py-1 px-2 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 transition-all cursor-pointer" data-width="4">Grossa</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.stylePopover);

        // Event listeners do Popover:
        const closeBtn = this.stylePopover.querySelector('#close-style-popover');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeStylePopover());

        // Cor
        this.stylePopover.querySelectorAll('.color-swatch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetColor = (e.currentTarget as HTMLElement).dataset.color;
                if (targetColor && this.currentStyledBlock) {
                    this.applyBlockColor(this.currentStyledBlock, targetColor);
                    this.updatePopoverSelection();
                    this.onUpdateCallback();
                }
            });
        });

        // Tipo de linha
        this.stylePopover.querySelectorAll('.line-style-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const style = (e.currentTarget as HTMLElement).dataset.style;
                if (style && this.currentStyledBlock) {
                    this.currentStyledBlock.dataset.lineStyle = style;
                    this.updatePopoverSelection();
                    this.onUpdateCallback();
                }
            });
        });

        // Espessura
        this.stylePopover.querySelectorAll('.line-width-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const width = (e.currentTarget as HTMLElement).dataset.width;
                if (width && this.currentStyledBlock) {
                    this.currentStyledBlock.dataset.lineWidth = width;
                    this.updatePopoverSelection();
                    this.onUpdateCallback();
                }
            });
        });

        // Fechar ao clicar fora
        document.addEventListener('pointerdown', (e) => {
            if (this.stylePopover.style.display !== 'none' && !this.stylePopover.classList.contains('hidden')) {
                if (!this.stylePopover.contains(e.target as Node) && !(e.target as HTMLElement).closest('.visibility-toggle')) {
                    this.closeStylePopover();
                }
            }
        });
    }

    static openStylePopover(block: HTMLElement, anchorEl: HTMLElement) {
        this.currentStyledBlock = block;
        const rect = anchorEl.getBoundingClientRect();
        
        let left = rect.right + 10;
        let top = rect.top - 10;

        if (left + 240 > window.innerWidth) {
            left = rect.left - 240 - 10;
        }
        if (top + 280 > window.innerHeight) {
            top = Math.max(10, window.innerHeight - 290);
        }

        this.stylePopover.style.left = `${left}px`;
        this.stylePopover.style.top = `${top}px`;
        this.stylePopover.classList.remove('hidden');
        this.stylePopover.style.display = 'flex';
        this.updatePopoverSelection();
    }

    static closeStylePopover() {
        this.stylePopover.classList.add('hidden');
        this.stylePopover.style.display = 'none';
        this.currentStyledBlock = null;
    }

    static updatePopoverSelection() {
        if (!this.currentStyledBlock) return;
        const currentColor = this.currentStyledBlock.dataset.color || '#2d70b3';
        const currentStyle = this.currentStyledBlock.dataset.lineStyle || 'solid';
        const currentWidth = this.currentStyledBlock.dataset.lineWidth || '2.5';

        this.stylePopover.querySelectorAll('.color-swatch').forEach((swatch: any) => {
            if (swatch.dataset.color === currentColor) {
                swatch.style.outline = '2px solid #2d70b3';
                swatch.style.outlineOffset = '2px';
            } else {
                swatch.style.outline = 'none';
            }
        });

        this.stylePopover.querySelectorAll('.line-style-btn').forEach((btn: any) => {
            if (btn.dataset.style === currentStyle) {
                btn.classList.add('bg-white', 'shadow-xs', 'text-blue-600');
                btn.classList.remove('text-gray-600');
            } else {
                btn.classList.remove('bg-white', 'shadow-xs', 'text-blue-600');
                btn.classList.add('text-gray-600');
            }
        });

        this.stylePopover.querySelectorAll('.line-width-btn').forEach((btn: any) => {
            if (btn.dataset.width === currentWidth) {
                btn.classList.add('bg-white', 'shadow-xs', 'text-blue-600', 'font-bold');
                btn.classList.remove('text-gray-600');
            } else {
                btn.classList.remove('bg-white', 'shadow-xs', 'text-blue-600', 'font-bold');
                btn.classList.add('text-gray-600');
            }
        });
    }

    static applyBlockColor(block: HTMLElement, color: string) {
        block.dataset.color = color;
        const visBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        const numSpan = block.querySelector('.block-number') as HTMLElement;
        if (visBtn) {
            const isVisible = visBtn.dataset.visible !== 'false';
            if (isVisible) {
                visBtn.style.backgroundColor = color;
                visBtn.style.border = '2px solid ' + color;
                visBtn.style.boxShadow = 'none';
            } else {
                visBtn.style.backgroundColor = '#ffffff';
                visBtn.style.border = '2px dashed ' + color;
                visBtn.style.boxShadow = 'none';
            }
        }
        if (numSpan) {
            numSpan.style.color = '#666666';
        }
    }

    static init(onUpdate?: () => void) {
        if (typeof document !== 'undefined') {
            this.container = document.getElementById('expressions-list')!;
            this.addBtn = document.getElementById('add-expr-btn')!;
        }
        this.initStylePopover();

        this.onUpdateCallback = onUpdate || (() => {});
        
        // Botão Principal Adicionar Item (+) do Cabeçalho
        const addItemBtn = document.getElementById('add-item-btn');
        const addItemDropdown = document.getElementById('add-item-dropdown');

        const toggleDropdown = (e?: Event) => {
            if (e) {
                e.stopPropagation();
            }
            if (!addItemDropdown) return;
            const isHidden = addItemDropdown.classList.contains('hidden');
            if (isHidden) {
                addItemDropdown.classList.remove('hidden');
                addItemDropdown.classList.add('flex');
            } else {
                addItemDropdown.classList.add('hidden');
                addItemDropdown.classList.remove('flex');
            }
        };

        const closeDropdown = () => {
            if (addItemDropdown) {
                addItemDropdown.classList.add('hidden');
                addItemDropdown.classList.remove('flex');
            }
        };

        (window as any)._toggleAddItemMenu = toggleDropdown;
        (window as any)._closeAddItemMenu = closeDropdown;

        if (addItemBtn) {
            addItemBtn.onclick = (e) => {
                toggleDropdown(e);
            };
        }

        // Fechar ao clicar fora
        document.addEventListener('pointerdown', (e) => {
            if (!addItemDropdown || addItemDropdown.classList.contains('hidden')) return;
            const target = e.target as Node;
            if (addItemBtn && (addItemBtn === target || addItemBtn.contains(target))) {
                return;
            }
            if (!addItemDropdown.contains(target)) {
                closeDropdown();
            }
        });

        const handleAddItem = (type: string, e?: Event) => {
            if (e) e.stopPropagation();
            closeDropdown();
            if (type === 'expression') {
                this.addBlock(true);
            } else if (type === 'note') {
                this.addNote('', true);
            } else if (type === 'table') {
                this.addTable(undefined, true);
            } else if (type === 'matrix') {
                this.addMatrix(undefined, true);
            } else if (type === 'folder') {
                this.addFolder('Nova Pasta', true);
            }
            this.updateBlockNumbers();
            HistoryManager.recordState(true);
        };

        (window as any)._addItem = handleAddItem;

        const menuAddExpr = document.getElementById('menu-add-expr');
        if (menuAddExpr) menuAddExpr.onclick = (e) => handleAddItem('expression', e);

        const menuAddNote = document.getElementById('menu-add-note');
        if (menuAddNote) menuAddNote.onclick = (e) => handleAddItem('note', e);

        const menuAddTable = document.getElementById('menu-add-table');
        if (menuAddTable) menuAddTable.onclick = (e) => handleAddItem('table', e);

        const menuAddMatrix = document.getElementById('menu-add-matrix');
        if (menuAddMatrix) menuAddMatrix.onclick = (e) => handleAddItem('matrix', e);

        const menuAddFolder = document.getElementById('menu-add-folder');
        if (menuAddFolder) menuAddFolder.onclick = (e) => handleAddItem('folder', e);

        // Clicar em espaço vazio no #expressions-list adiciona nova expressão
        if (this.container) {
            this.container.addEventListener('click', (e) => {
                if (e.target === this.container) {
                    handleAddItem('expression');
                }
            });
        }

        // Botão Adicionar Expressão Legacy
        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => {
                this.addBlock();
                this.updateBlockNumbers();
                HistoryManager.recordState(true);
            });
        }

        // Botão Adicionar Tabela
        const addTableBtn = document.getElementById('add-table-btn');
        if (addTableBtn) {
            addTableBtn.addEventListener('click', () => {
                this.addTable();
                this.updateBlockNumbers();
                HistoryManager.recordState(true);
            });
        }

        // Botão Adicionar Matriz
        const addMatrixBtn = document.getElementById('add-matrix-btn');
        if (addMatrixBtn) {
            addMatrixBtn.addEventListener('click', () => {
                this.addMatrix();
                this.updateBlockNumbers();
                HistoryManager.recordState(true);
            });
        }

        // Botão Adicionar Nota
        const addNoteBtn = document.getElementById('add-note-btn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                this.addNote();
                this.updateBlockNumbers();
                HistoryManager.recordState(true);
            });
        }

        // Botão Adicionar Pasta
        const addFolderBtn = document.getElementById('add-folder-btn');
        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => {
                this.addFolder();
                this.updateBlockNumbers();
                HistoryManager.recordState(true);
            });
        }

        // Botões Undo / Redo do cabeçalho global e da sidebar
        const undoBtns = [document.getElementById('undo-btn'), document.getElementById('sidebar-undo-btn')].filter(Boolean) as HTMLButtonElement[];
        const redoBtns = [document.getElementById('redo-btn'), document.getElementById('sidebar-redo-btn')].filter(Boolean) as HTMLButtonElement[];
        undoBtns.forEach(btn => btn.addEventListener('click', () => HistoryManager.undo()));
        redoBtns.forEach(btn => btn.addEventListener('click', () => HistoryManager.redo()));

        const editListBtn = document.getElementById('edit-list-btn');
        const doneEditListBtn = document.getElementById('done-edit-list-btn');
        if (editListBtn) {
            editListBtn.addEventListener('click', () => {
                if (this.container) {
                    this.container.classList.add('is-editing-list');
                    editListBtn.classList.add('hidden');
                    if (doneEditListBtn) {
                        doneEditListBtn.classList.remove('hidden');
                        doneEditListBtn.classList.add('flex');
                    }
                }
            });
        }
        if (doneEditListBtn) {
            doneEditListBtn.addEventListener('click', () => {
                if (this.container) {
                    this.container.classList.remove('is-editing-list');
                    doneEditListBtn.classList.add('hidden');
                    doneEditListBtn.classList.remove('flex');
                    if (editListBtn) editListBtn.classList.remove('hidden');
                }
            });
        }

        HistoryManager.init(
            () => this.onUpdateCallback(),
            (canUndo, canRedo) => {
                undoBtns.forEach(btn => btn.disabled = !canUndo);
                redoBtns.forEach(btn => btn.disabled = !canRedo);
            }
        );

        this.addBlock();
        this.updateBlockNumbers();
        HistoryManager.recordState(true);
    }

    /**
     * Atualiza a numeração lateral (1, 2, 3...) de todos os blocos de expressão na tela
     */
    static updateBlockNumbers() {
        let index = 1;
        const blocks = Array.from(this.container.children);
        blocks.forEach((block: any) => {
            if (block.dataset.type === 'expression') {
                const numSpan = block.querySelector('.block-number');
                if (numSpan) {
                    numSpan.textContent = index.toString();
                    numSpan.innerText = index.toString();
                }
                index++;
            }
        });
    }

    static addBlock(autoFocus: boolean = true, initialValue: string = '', folderId?: string, autoSliderVar?: string, parentBlockId?: string): string {
        this.blockCounter++;
        const blockId = 'expr-block-' + this.blockCounter;

        const block = document.createElement('div');
        block.id = blockId;
        block.dataset.type = 'expression';
        if (autoSliderVar) {
            block.dataset.autoSlider = autoSliderVar;
        }
        if (parentBlockId) {
            block.dataset.parentBlockId = parentBlockId;
        }
        if (folderId) {
            block.dataset.folderId = folderId;
            block.className = 'flex border-b border-[#dcdcdc] bg-white transition-colors duration-150 relative group pl-3 border-l-4 border-l-blue-300 min-h-[43px]';
        } else {
            block.className = 'flex border-b border-[#dcdcdc] bg-white transition-colors duration-150 relative group min-h-[43px]';
        }

        // Aba lateral esquerda (.dcg-tab) estilo Desmos (largura exata 38px)
        const grabZone = document.createElement('div');
        grabZone.className = 'dcg-tab w-[38px] min-w-[38px] max-w-[38px] bg-[#eeeeee] flex items-center justify-center shrink-0 select-none relative';
        
        // Ciclo estrito de 6 cores oficiais Desmos (Vermelho, Azul, Verde, Roxo, Laranja, Preto)
        const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
        const colorIndex = Array.from(this.container.children).length % colors.length;
        const blockColor = colors[colorIndex];
        block.dataset.color = blockColor;
        block.dataset.lineStyle = 'solid';
        block.dataset.lineWidth = '2.5';

        // Row Index Number (Desmos: número 10.4px posicionado em top: 2px, left: 3px)
        const numberSpan = document.createElement('span');
        numberSpan.className = 'block-number';
        numberSpan.textContent = this.blockCounter.toString();
        numberSpan.innerText = this.blockCounter.toString();

        // Círculo oficial Desmos (29x29px centralizado na aba)
        const visibilityBtn = document.createElement('div');
        visibilityBtn.className = 'visibility-toggle';
        visibilityBtn.dataset.visible = 'true';
        visibilityBtn.title = 'Clique: ocultar/exibir | Botão direito ou segurar: estilo';
        visibilityBtn.style.cssText = 'width: 29px; height: 29px; border-radius: 50%; background-color: ' + blockColor + '; border: 2px solid ' + blockColor + '; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; position: relative; margin: auto; flex-shrink: 0;';
        
        const warningTrigger = document.createElement('div');
        warningTrigger.className = 'block-warning-trigger hidden';
        warningTrigger.style.display = 'none';
        warningTrigger.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div class="warning-popover-tooltip"></div>
        `;
        
        warningTrigger.onclick = (e) => {
            e.stopPropagation();
            const tt = warningTrigger.querySelector('.warning-popover-tooltip') as HTMLElement;
            if (tt) {
                tt.classList.toggle('force-visible');
            }
        };

        // Long press detection para dispositivos touch e mouse
        let longPressTimer: any = null;
        let isLongPress = false;

        const startLongPress = () => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.openStylePopover(block, visibilityBtn);
            }, 450);
        };

        const cancelLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        visibilityBtn.addEventListener('pointerdown', (e) => {
            if (e.button === 0) startLongPress();
        });
        visibilityBtn.addEventListener('pointerup', cancelLongPress);
        visibilityBtn.addEventListener('pointercancel', cancelLongPress);
        visibilityBtn.addEventListener('pointerleave', cancelLongPress);

        visibilityBtn.onclick = () => {
            if (isLongPress) return;
            const isVisible = visibilityBtn.dataset.visible === 'true';
            visibilityBtn.dataset.visible = isVisible ? 'false' : 'true';
            const currentColor = block.dataset.color || blockColor;
            if (isVisible) {
                visibilityBtn.style.backgroundColor = '#ffffff';
                visibilityBtn.style.border = '2px dashed ' + currentColor;
                visibilityBtn.style.boxShadow = 'none';
            } else {
                visibilityBtn.style.backgroundColor = currentColor;
                visibilityBtn.style.border = '2px solid ' + currentColor;
                visibilityBtn.style.boxShadow = 'none';
            }
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        visibilityBtn.oncontextmenu = (e) => {
            e.preventDefault();
            this.openStylePopover(block, visibilityBtn);
        };
        
        const iconSlot = document.createElement('div');
        iconSlot.className = 'relative w-[29px] h-[29px] flex items-center justify-center shrink-0';
        iconSlot.appendChild(visibilityBtn);
        iconSlot.appendChild(warningTrigger);

        grabZone.appendChild(numberSpan);
        grabZone.appendChild(iconSlot);

        // --- ÁREA DE CONTEÚDO (Matemática + Slider) ---
        const contentZone = document.createElement('div');
        contentZone.className = 'flex flex-col grow overflow-hidden';
        const topRow = document.createElement('div');
        topRow.className = 'flex items-center px-2 py-2 gap-2 overflow-visible min-h-[50px] relative';

        const mathContainer = document.createElement('div');
        mathContainer.className = 'flex items-center grow overflow-visible min-w-0 relative';

        const mf = document.createElement('math-field');
        mf.className = 'border-none outline-none text-lg bg-transparent w-full';

        const matrixHandle = document.createElement('div');
        matrixHandle.className = 'matrix-inline-handle';
        matrixHandle.title = 'Arraste para redimensionar matriz (m × n)';
        matrixHandle.style.display = 'none';

        const matrixTooltip = document.createElement('div');
        matrixTooltip.className = 'matrix-inline-tooltip';
        matrixTooltip.style.display = 'none';
        
        const resultSpan = document.createElement('div');
        resultSpan.className = 'result-display text-gray-800 text-sm font-semibold shrink-0 ml-auto mr-1 hidden select-text flex items-center gap-1.5 transition-all';

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
        delBtn.className = 'block-delete-btn bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-auto transition-opacity opacity-0 group-hover:opacity-100 hover:text-gray-700 hover:bg-gray-100 rounded-md outline-none';

        mathContainer.appendChild(mf);
        mathContainer.appendChild(matrixHandle);
        mathContainer.appendChild(matrixTooltip);
        topRow.appendChild(mathContainer);
        topRow.appendChild(resultSpan);
        topRow.appendChild(delBtn);
        contentZone.appendChild(topRow);

        const parseMatrixFromLatex = (latex: string) => {
            const match = latex.match(/([\s\S]*?)\\begin\{(?:b|p|v|V)?matrix\}([\s\S]*?)\\end\{(?:b|p|v|V)?matrix\}([\s\S]*)/);
            if (!match) return null;
            const prefix = match[1];
            const body = match[2];
            const suffix = match[3];
            const rawRows = body.split(/\\\\|\\cr|\\newline/);
            const grid: string[][] = [];
            for (const rStr of rawRows) {
                if (!rStr.trim()) continue;
                const colStrs = rStr.split('&');
                const rowArr = colStrs.map((c: string) => {
                    const clean = c.replace(/#\?/g, '').replace(/#@/g, '').replace(/\\placeholder\{[^}]*\}/g, '').trim();
                    return clean || '0';
                });
                if (rowArr.length > 0) grid.push(rowArr);
            }
            const rows = grid.length || 1;
            const cols = Math.max(1, ...grid.map(r => r.length));

            // Preserva células em _mutableOriginalMatrix (estilo Desmos mutable_originalMatrix / bq)
            if (!(block as any)._mutableOriginalMatrix) {
                (block as any)._mutableOriginalMatrix = [];
            }
            const mut = (block as any)._mutableOriginalMatrix;
            for (let r = 0; r < grid.length; r++) {
                if (!mut[r]) mut[r] = [];
                for (let c = 0; c < grid[r].length; c++) {
                    const cell = grid[r][c];
                    if (cell !== undefined && cell.trim() !== '') {
                        mut[r][c] = cell;
                    }
                }
            }

            return { prefix, rows, cols, grid, suffix };
        };

        const buildResizedMatrixLatex = (prefix: string, newRows: number, newCols: number, existingGrid: string[][], suffix: string) => {
            const mut: string[][] = (block as any)._mutableOriginalMatrix || [];
            const rowStrs: string[] = [];
            for (let r = 0; r < newRows; r++) {
                const colStrs: string[] = [];
                for (let c = 0; c < newCols; c++) {
                    let val = '0';
                    if (existingGrid[r] && existingGrid[r][c] !== undefined && existingGrid[r][c].trim() !== '') {
                        val = existingGrid[r][c].trim();
                    } else if (mut[r] && mut[r][c] !== undefined && mut[r][c].trim() !== '') {
                        val = mut[r][c].trim();
                    }
                    colStrs.push(val);
                }
                rowStrs.push(colStrs.join(' & '));
            }
            return `${prefix}\\begin{bmatrix} ${rowStrs.join(' \\\\ ')} \\end{bmatrix}${suffix}`;
        };

        const mathEl = mf as any;
        let isDraggingHandle = false;

        const isCursorInsideMatrix = () => {
            const model = (mf as any).model || (mf as any)._mathfield?.model;
            const env = model?.parentEnvironment?.environmentName;
            if (env && (env.includes('matrix') || env === 'array')) {
                return true;
            }
            const shadow = mf.shadowRoot;
            if (shadow) {
                if (shadow.querySelector('.ML__matrix .ML__caret, .ML__matrix .ML__focused, .ML__matrix .ML__selected')) {
                    return true;
                }
                // Se existe cursor/foco ativo no mathfield porém FORA de .ML__matrix (ex: no 'a = ' ou após ']'), cursor está fora da matriz!
                if (shadow.querySelector('.ML__caret, .ML__focused, .ML__selected')) {
                    return false;
                }
            }
            // Fallback para ambientes de teste (ex: jsdom) onde layout visual de caret não é gerado
            const isTestEnv = typeof navigator !== 'undefined' && /jsdom|node\.js/i.test(navigator.userAgent || '');
            if (isTestEnv) {
                const val = (typeof mathEl.getValue === 'function' ? mathEl.getValue('latex') : mathEl.value) || '';
                const trimmed = val.replace(/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*/, '').trim();
                if (trimmed.startsWith('\\begin{') && trimmed.endsWith('\\end{bmatrix}')) {
                    const isPure = !trimmed.includes('+') && !trimmed.includes('*') && !trimmed.includes('-');
                    if (isPure) return true;
                }
            }
            return false;
        };

        const updateHandlePosition = () => {
            const latex = typeof mathEl.getValue === 'function' ? mathEl.getValue('latex') : (mathEl.value || '');
            const hasMatrix = /\\begin\{(?:b|p|v|V)?matrix\}/.test(latex);
            if (!hasMatrix) {
                matrixHandle.style.display = 'none';
                matrixTooltip.style.display = 'none';
                return;
            }

            const isFocused = block.classList.contains('is-focused') || document.activeElement === mf || (mf.shadowRoot && mf.shadowRoot.activeElement);
            const inMatrix = isCursorInsideMatrix();
            if (!isDraggingHandle && (!isFocused || !inMatrix)) {
                matrixHandle.style.display = 'none';
                matrixTooltip.style.display = 'none';
                return;
            }

            matrixHandle.style.display = 'block';

            const containerRect = mathContainer.getBoundingClientRect();
            let handleLeft = 0;
            let handleTop = 0;

            const shadow = mf.shadowRoot;
            if (shadow) {
                const delims = shadow.querySelectorAll('.ML__delimsizing, .ML__close, .ML__matrix, .ML__base [data-atom-id]');
                let rightmostEl: any = null;
                let maxX = -Infinity;
                delims.forEach((el: any) => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.right > maxX) {
                        maxX = r.right;
                        rightmostEl = el;
                    }
                });
                if (rightmostEl) {
                    const rect = rightmostEl.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && containerRect.width > 0) {
                        handleLeft = rect.right - containerRect.left - 4;
                        handleTop = rect.bottom - containerRect.top - 6;
                    }
                }
            }

            if (handleLeft <= 0 || handleTop <= 0) {
                const mfRect = mf.getBoundingClientRect();
                if (mfRect.width > 0 && containerRect.width > 0) {
                    handleLeft = Math.min(mfRect.width, 180);
                    handleTop = Math.max(24, mfRect.height - 12);
                } else {
                    handleLeft = 140;
                    handleTop = 32;
                }
            }

            matrixHandle.style.left = `${handleLeft}px`;
            matrixHandle.style.top = `${handleTop}px`;
            matrixTooltip.style.left = `${handleLeft + 7}px`;
            matrixTooltip.style.top = `${handleTop - 6}px`;
        };

        (block as any)._updateMatrixHandle = updateHandlePosition;

        let startX = 0;
        let startY = 0;
        let initialRows = 2;
        let initialCols = 2;
        let currentRows = 2;
        let currentCols = 2;
        let pfx = '';
        let sfx = '';
        let matrixGrid: string[][] = [];

        matrixHandle.addEventListener('pointerdown', (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            matrixHandle.setPointerCapture(e.pointerId);
            isDraggingHandle = true;
            matrixHandle.classList.add('is-dragging');

            const latex = typeof mathEl.getValue === 'function' ? mathEl.getValue('latex') : (mathEl.value || '');
            const parsed = parseMatrixFromLatex(latex);
            if (parsed) {
                pfx = parsed.prefix;
                sfx = parsed.suffix;
                initialRows = parsed.rows;
                initialCols = parsed.cols;
                matrixGrid = parsed.grid;
            } else {
                pfx = '';
                sfx = '';
                initialRows = 2;
                initialCols = 2;
                matrixGrid = [['0', '0'], ['0', '0']];
            }
            currentRows = initialRows;
            currentCols = initialCols;
            startX = e.clientX;
            startY = e.clientY;

            matrixTooltip.innerText = `${currentRows} × ${currentCols}`;
            matrixTooltip.style.display = 'block';
        });

        matrixHandle.addEventListener('pointermove', (e: PointerEvent) => {
            if (!isDraggingHandle) return;
            e.preventDefault();
            e.stopPropagation();

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const dCols = Math.round(dx / 36);
            const dRows = Math.round(dy / 28);

            const targetRows = Math.min(8, Math.max(1, initialRows + dRows));
            const targetCols = Math.min(8, Math.max(1, initialCols + dCols));

            if (targetRows !== currentRows || targetCols !== currentCols) {
                currentRows = targetRows;
                currentCols = targetCols;
                matrixTooltip.innerText = `${currentRows} × ${currentCols}`;

                const newLatex = buildResizedMatrixLatex(pfx, currentRows, currentCols, matrixGrid, sfx);
                mathEl.setValue(newLatex, { mode: 'math' });
                updateHandlePosition();
                this.onUpdateCallback();
            }
        });

        const endDragHandle = (e: PointerEvent) => {
            if (!isDraggingHandle) return;
            isDraggingHandle = false;
            matrixHandle.classList.remove('is-dragging');
            matrixTooltip.style.display = 'none';
            try {
                matrixHandle.releasePointerCapture(e.pointerId);
            } catch (_) {}
            updateHandlePosition();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        matrixHandle.addEventListener('pointerup', endDragHandle);
        matrixHandle.addEventListener('pointercancel', endDragHandle);

        mf.addEventListener('selection-change', () => updateHandlePosition());
        block.addEventListener('mouseleave', () => {
            if (!isDraggingHandle) updateHandlePosition();
        });

        // --- CHIPS DE SUGESTÃO DE SLIDERS (DESMOS STYLE) ---
        const sliderChipsRow = document.createElement('div');
        sliderChipsRow.className = 'slider-chips-row hidden flex-wrap items-center gap-1.5 px-3 py-1.5 bg-blue-50/70 border-t border-blue-100 text-xs text-gray-600 select-none';
        contentZone.appendChild(sliderChipsRow);

        // --- LINHA DO SLIDER ---
        const sliderRow = document.createElement('div');
        sliderRow.className = 'slider-row';
        sliderRow.style.cssText = 'display: none; gap: 8px; align-items: center; padding: 8px 12px; background: #fafafa; border-top: 1px dashed #eee;';
        
        sliderRow.innerHTML = `
            <button class="play-btn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background-color: #f0f4f9; color: #2d70b3; transition: all 0.2s;" title="Animar Slider">
                <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <input type="text" class="min-val" value="-10" style="width: 45px; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
            <input type="range" class="slider-input" min="-10" max="10" step="0.1" value="1" style="flex-grow: 1; cursor: pointer;">
            <input type="text" class="max-val" value="10" style="width: 45px; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
        `;
        contentZone.appendChild(sliderRow);
        
        // Dynamic Focus Highlight: aba transiciona para #d2e7f5 e borda para #2d70b3
        block.addEventListener('focusin', () => {
            grabZone.style.backgroundColor = '#d2e7f5';
            block.classList.add('is-focused');
            updateHandlePosition();
        });
        block.addEventListener('focusout', (e) => {
            if (!block.contains((e as FocusEvent).relatedTarget as Node)) {
                grabZone.style.backgroundColor = '#eeeeee';
                block.classList.remove('is-focused');
                updateHandlePosition();
            }
        });

        block.appendChild(grabZone);
        block.appendChild(contentZone);
        if (parentBlockId) {
            const parentEl = document.getElementById(parentBlockId);
            if (parentEl && parentEl.nextSibling) {
                this.container.insertBefore(block, parentEl.nextSibling);
            } else {
                this.container.appendChild(block);
            }
        } else {
            this.container.appendChild(block);
        }
        this.updateBlockNumbers();
        if ((window as any).lucide) (window as any).lucide.createIcons({ root: block });

        const mathField = mf as any;
        mathField.smartMode = false;
        mathField.smartFence = true;
        mathField.smartSuperscript = false;
        mathField.mathVirtualKeyboardPolicy = 'auto';
        mathField.menuItems = [];
        mathField.inlineShortcuts = {
            'matrix': '\\begin{bmatrix} 0 & 0 \\\\ 0 & 0 \\end{bmatrix}',
            'matriz': '\\begin{bmatrix} 0 & 0 \\\\ 0 & 0 \\end{bmatrix}',
            'pi': '\\pi',
            'theta': '\\theta',
            'alpha': '\\alpha',
            'beta': '\\beta',
            'gamma': '\\gamma',
            'delta': '\\delta',
            'Delta': '\\Delta',
            'lambda': '\\lambda',
            'Lambda': '\\Lambda',
            'sigma': '\\sigma',
            'Sigma': '\\Sigma',
            'omega': '\\omega',
            'Omega': '\\Omega',
            'phi': '\\phi',
            'Phi': '\\Phi',
            'mu': '\\mu',
            'sqrt': '\\sqrt{#?}',
            'cbrt': '\\sqrt[3]{#?}',
            'nthroot': '\\sqrt[#?]{#?}',
            'sum': '\\sum_{#?}^{#?}',
            'prod': '\\prod_{#?}^{#?}',
            'int': '\\int',
            'defint': '\\int_{#?}^{#?}',
            'limit': '\\lim',
            'lim': '\\lim',
            'inf': '\\infty',
            'infty': '\\infty',
            '<=': '\\le',
            '>=': '\\ge',
            '!=': '\\ne',
            'pm': '\\pm',
            '+-': '\\pm',
            'approx': '\\approx',
            '*': '\\cdot',
            'cdot': '\\cdot',
            'times': '\\times',
            'div': '\\div',
            'e': 'e',
            'width': '\\operatorname{width}',
            'height': '\\operatorname{height}',
            'd/dx': '\\frac{d}{dx}',
            'ddx': '\\frac{d}{dx}',
            'diff': '\\frac{d}{dx}',
            'det': '\\det',
            'rref': '\\operatorname{rref}',
            'trace': '\\operatorname{trace}',
            'rank': '\\operatorname{rank}',
            'transpose': '\\operatorname{transpose}',
            'inv': '\\operatorname{inv}',
            'tau': '\\tau',
            '->': '\\to'
        };
        const currentBindings = mathField.keybindings || [];
        const keysToOverride = new Set([
            '#', 'shift+[Digit3]',
            '/', '[Slash]', '[NumpadDivide]',
            '*',
            '\\', '[Backslash]', 'Backslash', '[IntlBackslash]', 'IntlBackslash',
            ']', '[BracketRight]', 'BracketRight',
            '[', '[BracketLeft]', 'BracketLeft'
        ]);
        const filteredBindings = currentBindings.filter((b: any) => {
            if (keysToOverride.has(b.key)) return false;
            const cmd = Array.isArray(b.command) ? b.command[0] : b.command;
            if (cmd === 'switchMode') return false;
            return true;
        });
        mathField.keybindings = [
            { key: '#', ifMode: 'math', command: ['insert', '\\#'] },
            { key: 'shift+[Digit3]', ifMode: 'math', command: ['insert', '\\#'] },
            { key: '/', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '[Slash]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '[NumpadDivide]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '*', ifMode: 'math', command: ['insert', '\\cdot'] },
            { key: ']', ifMode: 'math', command: ['insert', ']'] },
            { key: '[BracketRight]', ifMode: 'math', command: ['insert', ']'] },
            { key: '[', ifMode: 'math', command: ['insert', '['] },
            { key: '[BracketLeft]', ifMode: 'math', command: ['insert', '['] },
            ...filteredBindings
        ];
        mathField.style.setProperty('--contains-highlight-background', 'transparent');
        mathField.style.setProperty('--highlight-background', 'transparent');
        mathField.style.setProperty('--highlight-color', 'transparent');
        mathField.style.setProperty('--placeholder-color', '#94a3b8');
        mathField.style.setProperty('--placeholder-opacity', '0.6');
        mathField.style.setProperty('--box-placeholder-color', '#94a3b8');
        mathField.style.setProperty('--prompt-border', 'none');
        mathField.style.setProperty('--prompt-background', 'transparent');
        mathField.style.setProperty('--prompt-highlight-color', 'transparent');
        mathField.style.setProperty('--selection-background-color', 'rgba(66, 133, 244, 0.25)');
        mathField.style.setProperty('--_selection-background-color', 'rgba(66, 133, 244, 0.25)');
        mathField.style.setProperty('--selection-color', '#1f2937');
        mathField.style.setProperty('--_selection-color', '#1f2937');

        const injectCleanStyles = () => {
            if (mf.shadowRoot) {
                let styleEl = mf.shadowRoot.querySelector('#clean-desmos-styles') as HTMLStyleElement;
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'clean-desmos-styles';
                    mf.shadowRoot.appendChild(styleEl);
                }
                styleEl.textContent = `
                    :host {
                        --selection-background-color: rgba(66, 133, 244, 0.25) !important;
                        --_selection-background-color: rgba(66, 133, 244, 0.25) !important;
                        --selection-color: #1f2937 !important;
                        --_selection-color: #1f2937 !important;
                        --box-placeholder-color: #94a3b8 !important;
                        --_box-placeholder-color: #94a3b8 !important;
                    }
                    .ML__selection {
                        background: rgba(66, 133, 244, 0.25) !important;
                        background-color: rgba(66, 133, 244, 0.25) !important;
                        border-radius: 2px !important;
                    }
                    .ML__selected {
                        color: #1f2937 !important;
                        background: transparent !important;
                    }
                    ::selection {
                        background: rgba(66, 133, 244, 0.25) !important;
                        color: #1f2937 !important;
                    }
                    .ML__focused .ML__empty-line-anchor.ML__selected::after {
                        background: rgba(66, 133, 244, 0.25) !important;
                    }
                    .ML__placeholder, .ML__prompt, .ML__empty, [data-placeholder] {
                        border: none !important;
                        background: transparent !important;
                        background-color: transparent !important;
                        outline: none !important;
                        box-shadow: none !important;
                    }
                    .ML__box-placeholder {
                        color: #94a3b8 !important;
                        border-color: #94a3b8 !important;
                        background: transparent !important;
                        background-color: transparent !important;
                    }
                    .ML__contains-highlight, .ML__highlight {
                        background: transparent !important;
                        background-color: transparent !important;
                    }
                `;
            }
        };
        setTimeout(injectCleanStyles, 10);
        setTimeout(injectCleanStyles, 80);
        mf.addEventListener('focus', injectCleanStyles);
        mf.addEventListener('input', injectCleanStyles);

        const sliderInput = sliderRow.querySelector('.slider-input') as HTMLInputElement;
        const minInput = sliderRow.querySelector('.min-val') as HTMLInputElement;
        const maxInput = sliderRow.querySelector('.max-val') as HTMLInputElement;

        // --- LÓGICA DE ATUALIZAÇÃO DOS LIMITES DINÂMICOS ---
        const updateLimits = () => {
            try {
                // Analisa e resolve a matemática dentro da caixinha de limites!
                const pMin = new PrattParser(minInput.value);
                const valMin = MathEngine.evaluateAST(pMin.parseExpression(), StateManager.values);
                if (!isNaN(valMin)) sliderInput.min = valMin.toString();

                const pMax = new PrattParser(maxInput.value);
                const valMax = MathEngine.evaluateAST(pMax.parseExpression(), StateManager.values);
                if (!isNaN(valMax)) sliderInput.max = valMax.toString();
                
                const varNameMatch = (mf as any).getValue('ascii-math').match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                if (varNameMatch) {
                    StateManager.updateSlider(varNameMatch[1], parseFloat(sliderInput.value));
                    this.onUpdateCallback();
                }
            } catch(e) {
                console.warn('[ExpressionManager] Failed to update slider limits:', e);
            }
        };
        // Se o usuário mexer na caixa de texto do min ou do max, o sistema recalcula!
        minInput.addEventListener('change', updateLimits);
        maxInput.addEventListener('change', updateLimits);

        // --- ANIMAÇÃO DE SLIDERS (PLAY / PAUSE) ---
        const playBtn = sliderRow.querySelector('.play-btn') as HTMLButtonElement;
        let isPlaying = false;
        let animRafId: number | null = null;
        let animDirection = 1;

        const stopAnimation = () => {
            if (animRafId !== null) {
                cancelAnimationFrame(animRafId);
                animRafId = null;
            }
            isPlaying = false;
            if (playBtn) {
                playBtn.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>';
                if ((window as any).lucide) (window as any).lucide.createIcons({ root: playBtn });
            }
        };

        const animStep = () => {
            if (!isPlaying) return;
            const min = parseFloat(sliderInput.min) || -10;
            const max = parseFloat(sliderInput.max) || 10;
            const range = max - min;
            const stepDelta = (range / 300) * animDirection;
            let current = parseFloat(sliderInput.value) + stepDelta;

            if (current >= max) {
                current = max;
                animDirection = -1;
            } else if (current <= min) {
                current = min;
                animDirection = 1;
            }

            sliderInput.value = current.toFixed(2);
            
            const ascii = (mf as any).getValue('ascii-math');
            const match = ascii.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            if (match) {
                const varName = match[1];
                const roundedVal = parseFloat(current.toFixed(2));
                (mf as any).setValue(`${varName} = ${roundedVal}`);
                StateManager.updateSlider(varName, roundedVal);
                this.onUpdateCallback();
            }

            animRafId = requestAnimationFrame(animStep);
        };

        if (playBtn) {
            playBtn.onclick = () => {
                if (isPlaying) {
                    stopAnimation();
                } else {
                    isPlaying = true;
                    playBtn.innerHTML = '<i data-lucide="pause" class="w-3.5 h-3.5 fill-current"></i>';
                    if ((window as any).lucide) (window as any).lucide.createIcons({ root: playBtn });
                    animRafId = requestAnimationFrame(animStep);
                }
            };
        }

        // --- EVENTOS BÁSICOS ---
        delBtn.onclick = () => {
            stopAnimation();
            block.remove();
            this.updateBlockNumbers();
            HistoryManager.recordState(true);
            this.onUpdateCallback();
        };

        let lastPowerTime = 0;
        let justMovedToSuperscript = false;
        const handlePower = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now - lastPowerTime < 100) {
                return;
            }
            lastPowerTime = now;
            justMovedToSuperscript = true;
            (mf as any).executeCommand('moveToSuperscript');
        };

        let lastFractionTime = 0;
        const handleFraction = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now - lastFractionTime < 150) {
                return;
            }
            lastFractionTime = now;
            (mf as any).executeCommand(['insert', '\\frac{#@}{#?}']);
        };

        const isCaretKey = (e: KeyboardEvent) => {
            if (e.key === '^') return true;
            // Teclado US (Shift + 6)
            if (e.shiftKey && e.code === 'Digit6') {
                return true;
            }
            // Teclado ABNT2 (Brasil): Dead key de acentuação circunflexa
            if (e.key === 'Dead' && (e.shiftKey || e.code === 'Quote' || e.code === 'Backquote')) {
                return true;
            }
            return false;
        };

        const focusAdjacentBlock = (dir: 'up' | 'down') => {
            const adjBlock = (dir === 'up' ? block.previousElementSibling : block.nextElementSibling) as HTMLElement;
            if (adjBlock) {
                const adjMf = adjBlock.querySelector('math-field, textarea, input') as HTMLElement;
                if (adjMf) adjMf.focus();
            }
        };

        mf.addEventListener('move-out', (e: any) => {
            const dir = e.detail?.direction;
            if (dir === 'upward') {
                e.preventDefault();
                focusAdjacentBlock('up');
            } else if (dir === 'downward') {
                e.preventDefault();
                focusAdjacentBlock('down');
            }
        });

        mf.addEventListener('keydown', (e: KeyboardEvent) => {
            // Atalho Desmos Ctrl+Shift+Setas (Al / yq / vke: redimensionamento matricial e convert-list)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                const currentLatex = (mf as any).getValue?.('latex') || '';
                const parsed = parseMatrixFromLatex(currentLatex);
                if (parsed) {
                    e.preventDefault();
                    e.stopPropagation();
                    let newRows = parsed.rows;
                    let newCols = parsed.cols;
                    if (e.key === 'ArrowDown') newRows = Math.min(8, parsed.rows + 1);
                    else if (e.key === 'ArrowUp') newRows = Math.max(1, parsed.rows - 1);
                    else if (e.key === 'ArrowRight') newCols = Math.min(8, parsed.cols + 1);
                    else if (e.key === 'ArrowLeft') newCols = Math.max(1, parsed.cols - 1);

                    if (newRows !== parsed.rows || newCols !== parsed.cols) {
                        const newLatex = buildResizedMatrixLatex(parsed.prefix, newRows, newCols, parsed.grid, parsed.suffix);
                        (mf as any).setValue(newLatex, { mode: 'math' });
                        updateHandlePosition();
                        this.onUpdateCallback();
                        HistoryManager.recordState(true);
                    }
                    return;
                }

                // Conversão de lista [x] em matriz (Desmos convert-list: [1, 2] -> matriz)
                const listMatch = currentLatex.match(/^([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*)?(?:\\left\[|\[)([\s\S]*?)(?:\\right\]|\])$/);
                if (listMatch && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const prefix = listMatch[1] || '';
                    const inner = listMatch[2] || '';
                    const items = inner.split(',').map((s: string) => s.trim()).filter(Boolean);
                    const grid: string[][] = [];
                    if (e.key === 'ArrowRight') {
                        // Converte lista em vetor linha (1 x N)
                        grid.push(items.length > 0 ? items : ['0']);
                    } else {
                        // Converte lista em vetor coluna (N x 1)
                        if (items.length > 0) {
                            for (const it of items) grid.push([it]);
                        } else {
                            grid.push(['0']);
                        }
                    }
                    const rCount = grid.length;
                    const cCount = Math.max(1, ...grid.map(r => r.length));
                    const matLatex = this.generateMatrixLatex(rCount, cCount, grid);
                    (mf as any).setValue(prefix + matLatex, { mode: 'math' });
                    updateHandlePosition();
                    this.onUpdateCallback();
                    HistoryManager.recordState(true);
                    return;
                }
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                this.addBlock();
                this.updateBlockNumbers();
            } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
                const dir = e.key === 'ArrowUp' ? 'up' : 'down';
                const rawLatex = (mf as any).getValue?.('latex') || '';
                const hasVerticalStructure = /\\frac|\\int|\\sum|\\prod|\\lim|\^|_/.test(rawLatex);
                if (!hasVerticalStructure) {
                    e.preventDefault();
                    focusAdjacentBlock(dir);
                } else {
                    const posBefore = (mf as any).position;
                    queueMicrotask(() => {
                        if (document.activeElement === mf && (mf as any).position === posBefore) {
                            focusAdjacentBlock(dir);
                        }
                    });
                }
            } else if (e.key === 'Backspace') {
                const val = (mf as any).getValue('ascii-math') || '';
                if (!val && this.container.children.length > 1) {
                    e.preventDefault();
                    const prevBlock = (block.previousElementSibling || block.nextElementSibling) as HTMLElement;
                    delBtn.click();
                    if (prevBlock) {
                        const targetMf = prevBlock.querySelector('math-field, textarea, input') as HTMLElement;
                        if (targetMf) targetMf.focus();
                    }
                }
            } else if (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide') {
                handleFraction(e);
            } else if (isCaretKey(e)) {
                handlePower(e);
            } else if (e.key === ']' || e.code === 'BracketRight') {
                e.preventDefault();
                (mf as any).executeCommand(['insert', ']']);
            } else if (e.key === '[' || e.code === 'BracketLeft') {
                e.preventDefault();
                (mf as any).executeCommand(['insert', '[']);
            }
        });

        mf.addEventListener('beforeinput', (e: any) => {
            if (e.data === '/') {
                handleFraction(e);
            } else if (e.data === '^') {
                if (justMovedToSuperscript) {
                    e.preventDefault();
                    e.stopPropagation();
                    justMovedToSuperscript = false;
                } else {
                    handlePower(e);
                }
            } else if (typeof e.data === 'string' && e.data.startsWith('^')) {
                // Em teclados ABNT2, a combinação da tecla morta '^' com o próximo caractere gera '^2', etc.
                e.preventDefault();
                e.stopPropagation();
                if (!justMovedToSuperscript) {
                    (mf as any).executeCommand('moveToSuperscript');
                }
                justMovedToSuperscript = false;
                const remainder = e.data.replace(/^\^+/, '');
                if (remainder) {
                    (mf as any).executeCommand(['insert', remainder]);
                }
            } else {
                justMovedToSuperscript = false;
            }
        });

        mf.addEventListener('input', () => {
            let rawLatex = (mf as any).getValue('latex') || '';

            // Cura automática de resíduos literais de '^' inseridos por teclados internacionais/ABNT2
            if (rawLatex.includes('\\text{^}') || rawLatex.includes('\\hat{}') || rawLatex.includes('^\\text{^}')) {
                const fixedLatex = rawLatex
                    .replace(/\\text\{\^\}([0-9a-zA-Z]+)/g, '^{$1}')
                    .replace(/\\text\{\^\}/g, '')
                    .replace(/\\hat\{\}/g, '');
                if (fixedLatex !== rawLatex) {
                    (mf as any).setValue(fixedLatex, { silenceNotifications: true });
                    rawLatex = fixedLatex;
                }
            }
            const rawAscii = (mf as any).getValue('ascii-math') || '';

            // Auto-transformação Instantânea por Digitação (matrix, matriz, A = matrix, #24, B = #24, #33, #13)
            const noSpaceAscii = rawAscii.replace(/\s+/g, '');
            const cleanLatex = rawLatex
                .replace(/\\text\{([^}]+)\}/g, '$1')
                .replace(/\\mathrm\{([^}]+)\}/g, '$1')
                .replace(/\\operatorname\{([^}]+)\}/g, '$1')
                .replace(/\\#/g, '#')
            // 0. Atalhos Desmos Instantâneos de Bloco (note / aspas, folder, table, ticker)
            const isNoteTrigger = noSpaceAscii === 'note' || noSpaceAscii === 'nota' ||
                                  cleanLatex === 'note' || cleanLatex === 'nota' ||
                                  rawAscii.trim() === '"' || rawLatex.trim() === '"' ||
                                  cleanLatex === '"' || rawLatex.includes('\\text{"}');
            if (isNoteTrigger) {
                this.convertBlockToNote(block.id);
                return;
            }

            const isFolderTrigger = noSpaceAscii === 'folder' || noSpaceAscii === 'pasta' ||
                                    cleanLatex === 'folder' || cleanLatex === 'pasta';
            if (isFolderTrigger) {
                this.convertBlockToFolder(block.id);
                return;
            }

            const isTableTrigger = noSpaceAscii === 'table' || noSpaceAscii === 'tabela' ||
                                   cleanLatex === 'table' || cleanLatex === 'tabela';
            if (isTableTrigger) {
                this.convertBlockToTable(block.id);
                return;
            }

            const isTickerTrigger = noSpaceAscii === 'ticker' || cleanLatex === 'ticker';
            if (isTickerTrigger) {
                this.convertBlockToNote(block.id, 'Ticker: Animação Contínua');
                return;
            }

            // 1. Atalho Desmos #ab (ex: #24 cria 2x4, #33 cria 3x3, #13 cria 1x3, B = #24, f(x) = #22, a(x,y,z) = #33)
            const hashMatch = noSpaceAscii.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i) ||
                              cleanLatex.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i);
            if (hashMatch) {
                const rawName = hashMatch[1] ? hashMatch[1].trim() : undefined;
                const prefix = rawName ? `${rawName} = ` : '';
                const rCount = parseInt(hashMatch[2]);
                const cCount = parseInt(hashMatch[3]);
                const matLatex = this.generateMatrixLatex(rCount, cCount);
                mathEl.setValue(prefix + matLatex, { mode: 'math' });
                mf.focus();
                try {
                    mathEl.executeCommand('moveToMathFieldStart');
                    const steps = prefix ? prefix.trim().length + 1 : 1;
                    for (let i = 0; i < steps; i++) mathEl.executeCommand('moveToNextChar');
                    if (mf.shadowRoot) {
                        const firstCell = mf.shadowRoot.querySelector('.ML__matrix td, .ML__matrix [data-atom-id], .ML__matrix span');
                        if (firstCell && typeof (firstCell as HTMLElement).click === 'function') {
                            (firstCell as HTMLElement).click();
                        }
                    }
                } catch (_) {}
                updateHandlePosition();
                this.onUpdateCallback();
                HistoryManager.recordState(true);
                return;
            }

            // 2. Atalho Desmos 'matrix' / 'matriz' (cria matriz 2x2 padrão, ex: matrix, A = matrix, f(x) = matrix, a(x,y,z) = matrix)
            const matrixMatch = noSpaceAscii.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?matri[xz]$/i) ||
                                cleanLatex.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?\\?matri[xz]$/i);
            if (matrixMatch) {
                const rawName = matrixMatch[1] ? matrixMatch[1].trim() : undefined;
                const prefix = rawName ? `${rawName} = ` : '';
                const matLatex = this.generateMatrixLatex(2, 2);
                mathEl.setValue(prefix + matLatex, { mode: 'math' });
                mf.focus();
                try {
                    mathEl.executeCommand('moveToMathFieldStart');
                    const steps = prefix ? prefix.trim().length + 1 : 1;
                    for (let i = 0; i < steps; i++) mathEl.executeCommand('moveToNextChar');
                    if (mf.shadowRoot) {
                        const firstCell = mf.shadowRoot.querySelector('.ML__matrix td, .ML__matrix [data-atom-id], .ML__matrix span');
                        if (firstCell && typeof (firstCell as HTMLElement).click === 'function') {
                            (firstCell as HTMLElement).click();
                        }
                    }
                } catch (_) {}
                updateHandlePosition();
                this.onUpdateCallback();
                HistoryManager.recordState(true);
                return;
            }

            // Sintaxe de colchetes: [[1, 2], [3, 4]] ou A = [[1, 2], [3, 4]] ou f(x) = [[x, 0], [0, x]]
            const bracketMatch = cleanLatex.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=\s*)?(\[\[.*\]\])$/);
            if (bracketMatch) {
                const rawBn = bracketMatch[1] ? bracketMatch[1].trim() : undefined;
                const prefix = rawBn ? `${rawBn} = ` : '';
                try {
                    const rawInner = bracketMatch[2];
                    const rowMatches = rawInner.slice(1, -1).split(/\],\s*\[/);
                    const parsedGrid: string[][] = [];
                    for (const rStr of rowMatches) {
                        const cleanCells = rStr.replace(/[\[\]]/g, '').split(',').map((c: string) => c.trim() || '0');
                        if (cleanCells.length > 0) parsedGrid.push(cleanCells);
                    }
                    if (parsedGrid.length > 0) {
                        const rCount = Math.min(8, parsedGrid.length);
                        const cCount = Math.min(8, Math.max(...parsedGrid.map(r => r.length)));
                        for (const r of parsedGrid) {
                            while (r.length < cCount) r.push('0');
                        }
                        const matLatex = this.generateMatrixLatex(rCount, cCount, parsedGrid);
                        mathEl.setValue(prefix + matLatex, { mode: 'math' });
                        mf.focus();
                        updateHandlePosition();
                        this.onUpdateCallback();
                        HistoryManager.recordState(true);
                        return;
                    }
                } catch(e) {
                    console.warn('[ExpressionManager] Failed to parse matrix input:', e);
                }
            }

            updateHandlePosition();
            this.onUpdateCallback();
            HistoryManager.recordState(false);
        });

        mf.addEventListener('paste', (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text') || '';
            if (!text.trim()) return;

            // 1. Detecta colagem de link do Desmos (ex: https://www.desmos.com/calculator/5ls5ggt5gd)
            const desmosMatch = text.match(/desmos\.com\/calculator\/([a-zA-Z0-9]+)/);
            if (desmosMatch) {
                const currentVal = (mf as any).getValue('ascii-math') || '';
                if (!currentVal.trim()) {
                    e.preventDefault();
                    ExpressionManager.importFromDesmosUrl(desmosMatch[1], block);
                    return;
                }
            }

            // 2. Detecta colagem de JSON de estado do Desmos ou Motorzaoo
            const trimmed = text.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.expressions?.list || Array.isArray(parsed) || parsed.version) {
                        const currentVal = (mf as any).getValue('ascii-math') || '';
                        if (!currentVal.trim()) {
                            e.preventDefault();
                            ExpressionManager.importFromStateJson(parsed, block);
                            return;
                        }
                    }
                } catch (_) {}
            }
        });
        
        mf.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 120);
            }
        });

        sliderInput.addEventListener('input', () => {
            if (isPlaying) stopAnimation();
            const ascii = (mf as any).getValue('ascii-math');
            const match = ascii.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            if (match) {
                const varName = match[1];
                const newVal = parseFloat(sliderInput.value);
                
                // A LINHA MÁGICA: Atualiza o texto do math-field para você ver o número mudando!
                (mf as any).setValue(`${varName} = ${newVal}`);
                
                // Atualiza o motor matemático e redesenha a tela
                StateManager.updateSlider(varName, newVal);
                this.onUpdateCallback();
                HistoryManager.recordState(false);
            }
        });

        // --- FÍSICA CUSTOMIZADA DO DRAG AND DROP (DESMOS STYLE) ---
        this.setupBlockDrag(block, grabZone);

        if (initialValue) {
            if (typeof (mf as any).setValue === 'function') {
                (mf as any).setValue(initialValue, { suppressChangeNotifications: true });
            } else {
                (mf as any).value = initialValue;
            }
        }
        if (autoFocus) setTimeout(() => mf.focus(), 10);
        return blockId;
    }

    static setupBlockDrag(block: HTMLElement, grabZone: HTMLElement) {
        grabZone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            grabZone.style.cursor = 'grabbing';
            block.classList.add('bg-blue-50', 'shadow-md', 'z-50');
            block.style.position = 'relative';
            block.style.zIndex = '1000';

            let startY = e.clientY;
            let currentTranslate = 0;

            const onMove = (moveEvent: PointerEvent) => {
                currentTranslate = moveEvent.clientY - startY;
                block.style.transform = `translateY(${currentTranslate}px)`;

                const blocks = Array.from(this.container.children) as HTMLElement[];
                const index = blocks.indexOf(block);

                if (currentTranslate > block.offsetHeight / 2 && index < blocks.length - 1) {
                    const nextBlock = blocks[index + 1];
                    this.container.insertBefore(nextBlock, block);
                    startY += nextBlock.offsetHeight;
                    currentTranslate = moveEvent.clientY - startY;
                } else if (currentTranslate < -block.offsetHeight / 2 && index > 0) {
                    const prevBlock = blocks[index - 1];
                    this.container.insertBefore(block, prevBlock);
                    startY -= prevBlock.offsetHeight;
                    currentTranslate = moveEvent.clientY - startY;
                }
                block.style.transform = `translateY(${currentTranslate}px)`;
                this.updateBlockNumbers();
            };

            const onUp = () => {
                grabZone.style.cursor = 'grab';
                block.classList.remove('bg-blue-50', 'shadow-md', 'z-50');
                block.style.backgroundColor = '';
                block.style.boxShadow = '';
                block.style.position = '';
                block.style.zIndex = '';
                block.style.transform = '';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                this.onUpdateCallback();
                HistoryManager.recordState(true);
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }

    static addNote(text: string = '', autoFocus: boolean = true, folderId?: string, replaceBlock?: HTMLElement): string {
        this.blockCounter++;
        const blockId = 'note-block-' + this.blockCounter;

        const block = document.createElement('div');
        block.id = blockId;
        block.dataset.type = 'note';
        if (folderId) {
            block.dataset.folderId = folderId;
            block.className = 'flex border-b border-gray-100 bg-amber-50/20 hover:bg-amber-50/40 transition-colors duration-200 relative group pl-3 border-l-4 border-l-amber-300';
        } else {
            block.className = 'flex border-b border-gray-100 bg-white hover:bg-amber-50/20 transition-colors duration-200 relative group';
        }

        const grabZone = document.createElement('div');
        grabZone.className = 'dcg-tab w-[38px] min-w-[38px] max-w-[38px] bg-[#eeeeee] flex flex-col items-center justify-center shrink-0 select-none text-amber-500 relative cursor-grab';
        grabZone.innerHTML = `
            <div class="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs" title="Bloco de Nota Explicativa">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </div>
        `;

        const contentZone = document.createElement('div');
        contentZone.className = 'flex items-start px-2 py-2.5 gap-2 grow overflow-hidden min-h-[48px]';

        const textarea = document.createElement('textarea');
        textarea.className = 'w-full bg-transparent resize-none outline-none text-gray-700 text-sm font-normal placeholder-gray-400 py-1 leading-relaxed';
        textarea.placeholder = 'Adicione uma anotação, enunciado ou comentário explicativo...';
        textarea.rows = 1;
        textarea.value = text;

        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(32, textarea.scrollHeight) + 'px';
        };
        textarea.addEventListener('input', () => {
            autoResize();
            HistoryManager.recordState(false);
        });
        textarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && e.shiftKey) {
                setTimeout(autoResize, 5);
            }
        });
        setTimeout(autoResize, 10);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        delBtn.className = 'block-delete-btn bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-auto transition-all opacity-40 hover:opacity-100 hover:text-red-500 outline-none';
        delBtn.onclick = () => {
            block.remove();
            this.updateBlockNumbers();
            HistoryManager.recordState(true);
            this.onUpdateCallback();
        };

        contentZone.appendChild(textarea);
        contentZone.appendChild(delBtn);

        block.appendChild(grabZone);
        block.appendChild(contentZone);

        this.setupBlockDrag(block, grabZone);

        if (replaceBlock && replaceBlock.parentNode) {
            replaceBlock.parentNode.replaceChild(block, replaceBlock);
        } else {
            this.container.appendChild(block);
        }
        this.updateBlockNumbers();

        if (autoFocus) setTimeout(() => textarea.focus(), 15);
        return blockId;
    }

    /**
     * Converte instantaneamente um bloco de expressão em uma Nota Explicativa (Desmos style: "note" ou aspas)
     */
    static convertBlockToNote(blockId: string, text: string = ''): string | null {
        const targetBlock = document.getElementById(blockId);
        if (!targetBlock) return null;
        const folderId = targetBlock.dataset.folderId;
        const nid = this.addNote(text, true, folderId, targetBlock);
        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
        return nid;
    }

    static getNextMatrixName(): string {
        const used = new Set<string>();
        const blocks = Array.from(this.container.children);
        blocks.forEach((b: any) => {
            if (b.dataset.type === 'matrix') {
                const nameInp = b.querySelector('.matrix-name-input') as HTMLInputElement;
                if (nameInp) used.add(nameInp.value.trim().toUpperCase());
            } else if (b.dataset.type === 'expression') {
                const mf = b.querySelector('math-field');
                if (mf) {
                    const val = (mf.value || '').trim();
                    const match = val.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                    if (match) used.add(match[1].toUpperCase());
                }
            }
        });
        const candidates = ['A', 'B', 'C', 'D', 'M', 'N', 'P'];
        for (const name of candidates) {
            if (!used.has(name)) return name;
        }
        return `M${this.blockCounter}`;
    }

    static generateMatrixLatex(rows: number, cols: number, data?: string[][]): string {
        const rowStrs: string[] = [];
        for (let r = 0; r < rows; r++) {
            const colStrs: string[] = [];
            for (let c = 0; c < cols; c++) {
                const val = data && data[r] && data[r][c] !== undefined && data[r][c].trim() !== '' ? data[r][c].trim() : '0';
                colStrs.push(val);
            }
            rowStrs.push(colStrs.join(' & '));
        }
        return `\\begin{bmatrix} ${rowStrs.join(' \\\\ ')} \\end{bmatrix}`;
    }

    static updateMatrixBlockVisual(block: HTMLElement, isNonPlottable: boolean) {
        block.dataset.isPlottable = isNonPlottable ? 'false' : 'true';
        block.dataset.isMatrix = isNonPlottable ? 'true' : 'false';
        const visBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        if (visBtn) {
            visBtn.style.display = isNonPlottable ? 'none' : 'flex';
        }
    }

    static addMatrix(
        matrixData?: { name?: string; rows?: number; cols?: number; data?: string[][] },
        autoFocus: boolean = true,
        folderId?: string,
        replaceBlock?: HTMLElement
    ): string {
        const rawName = matrixData?.name?.trim();
        const rows = Math.min(8, Math.max(1, matrixData?.rows || 2));
        const cols = Math.min(8, Math.max(1, matrixData?.cols || 2));
        const prefix = rawName ? `${rawName} = ` : '';
        const matrixLatex = this.generateMatrixLatex(rows, cols, matrixData?.data);
        const fullLatex = prefix + matrixLatex;

        let targetBlock = replaceBlock;
        let blockId = targetBlock?.id;

        if (!targetBlock) {
            blockId = this.addBlock(autoFocus, fullLatex, folderId);
            targetBlock = document.getElementById(blockId) || undefined;
        } else {
            const mf = targetBlock.querySelector('math-field') as any;
            if (mf) {
                mf.setValue(fullLatex, { mode: 'math' });
                if (autoFocus) mf.focus();
            }
        }

        if (targetBlock) {
            const targetMf = targetBlock.querySelector('math-field') as any;
            if (targetMf && autoFocus) {
                targetMf.focus();
                try {
                    targetMf.executeCommand('moveToMathFieldStart');
                    const steps = prefix ? prefix.trim().length + 1 : 1;
                    for (let i = 0; i < steps; i++) targetMf.executeCommand('moveToNextChar');
                    if (targetMf.shadowRoot) {
                        const firstCell = targetMf.shadowRoot.querySelector('.ML__matrix td, .ML__matrix [data-atom-id], .ML__matrix span');
                        if (firstCell && typeof (firstCell as HTMLElement).click === 'function') {
                            (firstCell as HTMLElement).click();
                        }
                    }
                } catch (_) {}
            }
            if (typeof (targetBlock as any)._updateMatrixHandle === 'function') {
                (targetBlock as any)._updateMatrixHandle();
            }
        }

        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
        return blockId || '';
    }

    static convertBlockToMatrix(blockId: string, name?: string, rows: number = 2, cols: number = 2): string | null {
        const targetBlock = document.getElementById(blockId);
        if (!targetBlock) return null;
        const folderId = targetBlock.dataset.folderId;
        return this.addMatrix({ name: name !== undefined ? name : undefined, rows, cols }, true, folderId, targetBlock);
    }

    static addTable(
        tableData?: { xCol?: string; yCol?: string; rows?: { x: string; y: string }[]; connectLines?: boolean },
        autoFocus: boolean = true,
        folderId?: string,
        replaceBlock?: HTMLElement
    ): string {
        this.blockCounter++;
        const blockId = 'table-block-' + this.blockCounter;

        const xCol = tableData?.xCol || 'x_1';
        const yCol = tableData?.yCol || 'y_1';
        const connectLines = tableData?.connectLines ?? false;
        const initialRows = tableData?.rows ? JSON.parse(JSON.stringify(tableData.rows)) : [
            { x: '0', y: '0' },
            { x: '1', y: '1' },
            { x: '2', y: '4' }
        ];

        const block = document.createElement('div');
        block.id = blockId;
        block.dataset.type = 'table';
        const blockColor = '#4f46e5';
        block.dataset.color = blockColor;
        block.dataset.lineStyle = 'solid';
        block.dataset.lineWidth = '2.5';
        if (folderId) {
            block.dataset.folderId = folderId;
            block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group pl-3 border-l-4 border-l-indigo-300';
        } else {
            block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group';
        }

        const grabZone = document.createElement('div');
        grabZone.className = 'dcg-tab w-[38px] min-w-[38px] max-w-[38px] bg-[#eeeeee] flex flex-col items-center justify-center shrink-0 select-none text-gray-500 relative';

        const visibilityBtn = document.createElement('div');
        visibilityBtn.className = 'visibility-toggle';
        visibilityBtn.dataset.visible = 'true';
        visibilityBtn.title = 'Clique: ocultar/exibir | Botão direito ou segurar: estilo';
        visibilityBtn.style.cssText = `width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${blockColor}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; background: ${blockColor}20; position: relative;`;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'block-number';
        numberSpan.style.cssText = `font-size: 14px; font-weight: bold; color: ${blockColor}; cursor: grab;`;
        numberSpan.innerText = this.blockCounter.toString();
        visibilityBtn.appendChild(numberSpan);

        visibilityBtn.onclick = () => {
            const isVisible = visibilityBtn.dataset.visible === 'true';
            visibilityBtn.dataset.visible = isVisible ? 'false' : 'true';
            visibilityBtn.style.background = isVisible ? 'transparent' : `${block.dataset.color || blockColor}20`;
            visibilityBtn.style.borderStyle = isVisible ? 'dashed' : 'solid';
            numberSpan.style.opacity = isVisible ? '0.3' : '1';
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };
        visibilityBtn.oncontextmenu = (e) => {
            e.preventDefault();
            this.openStylePopover(block, visibilityBtn);
        };
        grabZone.appendChild(visibilityBtn);

        const contentZone = document.createElement('div');
        contentZone.className = 'flex flex-col grow overflow-hidden px-2 py-3 gap-2';

        // Cabeçalho da Tabela
        const headerRow = document.createElement('div');
        headerRow.className = 'flex items-center justify-between pb-1 border-b border-gray-100';

        const colLabels = document.createElement('div');
        colLabels.className = 'flex items-center gap-4 grow pl-2';

        const xColInput = document.createElement('input');
        xColInput.type = 'text';
        xColInput.className = 'table-col-x font-bold text-xs text-indigo-900 bg-transparent border-none outline-none w-14 text-center';
        xColInput.value = xCol;

        const yColInput = document.createElement('input');
        yColInput.type = 'text';
        yColInput.className = 'table-col-y font-bold text-xs text-indigo-900 bg-transparent border-none outline-none w-14 text-center';
        yColInput.value = yCol;

        colLabels.appendChild(xColInput);
        colLabels.appendChild(yColInput);

        const connectLabel = document.createElement('label');
        connectLabel.className = 'flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer select-none';
        connectLabel.innerHTML = `<input type="checkbox" class="table-connect-lines rounded text-indigo-600 cursor-pointer" ${connectLines ? 'checked' : ''}> Ligar Linhas`;
        const connectLinesCb = connectLabel.querySelector('.table-connect-lines') as HTMLInputElement;
        connectLinesCb.onchange = () => {
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        delBtn.className = 'block-delete-btn bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-2 transition-all opacity-40 hover:opacity-100 hover:text-red-500 outline-none';
        delBtn.onclick = () => {
            block.remove();
            this.updateBlockNumbers();
            HistoryManager.recordState(true);
            this.onUpdateCallback();
        };

        headerRow.appendChild(colLabels);
        headerRow.appendChild(connectLabel);
        headerRow.appendChild(delBtn);
        contentZone.appendChild(headerRow);

        // Container de Linhas da Tabela
        const rowsContainer = document.createElement('div');
        rowsContainer.className = 'flex flex-col gap-1 max-h-[220px] overflow-y-auto py-1';

        const createRowEl = (xVal: string, yVal: string) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'table-data-row flex items-center gap-2 group';

            const xi = document.createElement('input');
            xi.type = 'text';
            xi.className = 'table-cell-x w-1/2 text-center text-xs font-mono py-1 px-1 rounded border border-gray-200 bg-white hover:border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-300 outline-none transition-all shadow-2xs';
            xi.value = xVal;

            const yi = document.createElement('input');
            yi.type = 'text';
            yi.className = 'table-cell-y w-1/2 text-center text-xs font-mono py-1 px-1 rounded border border-gray-200 bg-white hover:border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-300 outline-none transition-all shadow-2xs';
            yi.value = yVal;

            const rowDel = document.createElement('button');
            rowDel.className = 'text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer text-xs shrink-0';
            rowDel.innerHTML = '×';
            rowDel.onclick = () => {
                rowDiv.remove();
                this.onUpdateCallback();
                HistoryManager.recordState(true);
            };

            xi.oninput = () => {
                this.onUpdateCallback();
                HistoryManager.recordState(false);
            };
            yi.oninput = () => {
                this.onUpdateCallback();
                HistoryManager.recordState(false);
            };

            xi.onkeydown = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === 'ArrowRight') {
                    if (e.key === 'Enter') e.preventDefault();
                    yi.focus();
                } else if (e.key === 'ArrowDown') {
                    const nextRow = rowDiv.nextElementSibling as HTMLElement;
                    if (nextRow) {
                        const nextXi = nextRow.querySelector('.table-cell-x') as HTMLInputElement;
                        if (nextXi) nextXi.focus();
                    }
                } else if (e.key === 'ArrowUp') {
                    const prevRow = rowDiv.previousElementSibling as HTMLElement;
                    if (prevRow) {
                        const prevXi = prevRow.querySelector('.table-cell-x') as HTMLInputElement;
                        if (prevXi) prevXi.focus();
                    }
                }
            };

            yi.onkeydown = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                    const nextRow = rowDiv.nextElementSibling as HTMLElement;
                    if (nextRow) {
                        e.preventDefault();
                        const nextXi = nextRow.querySelector('.table-cell-x') as HTMLInputElement;
                        if (nextXi) nextXi.focus();
                    } else {
                        // Última linha: cria nova linha automaticamente (Desmos UX!)
                        e.preventDefault();
                        const newRow = createRowEl('', '');
                        rowsContainer.appendChild(newRow);
                        const newXi = newRow.querySelector('.table-cell-x') as HTMLInputElement;
                        if (newXi) newXi.focus();
                        this.onUpdateCallback();
                        HistoryManager.recordState(true);
                    }
                } else if (e.key === 'ArrowLeft') {
                    xi.focus();
                } else if (e.key === 'ArrowDown') {
                    const nextRow = rowDiv.nextElementSibling as HTMLElement;
                    if (nextRow) {
                        const nextYi = nextRow.querySelector('.table-cell-y') as HTMLInputElement;
                        if (nextYi) nextYi.focus();
                    }
                } else if (e.key === 'ArrowUp') {
                    const prevRow = rowDiv.previousElementSibling as HTMLElement;
                    if (prevRow) {
                        const prevYi = prevRow.querySelector('.table-cell-y') as HTMLInputElement;
                        if (prevYi) prevYi.focus();
                    }
                }
            };

            rowDiv.appendChild(xi);
            rowDiv.appendChild(yi);
            rowDiv.appendChild(rowDel);
            return rowDiv;
        };

        initialRows.forEach((r: { x: string; y: string }) => {
            rowsContainer.appendChild(createRowEl(r.x, r.y));
        });
        contentZone.appendChild(rowsContainer);

        // Botão + Linha
        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'self-start py-1 px-2.5 rounded bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 border border-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs mt-1';
        addRowBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Linha`;
        addRowBtn.onclick = () => {
            const newRow = createRowEl('', '');
            rowsContainer.appendChild(newRow);
            const newXi = newRow.querySelector('.table-cell-x') as HTMLInputElement;
            if (newXi) newXi.focus();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };
        contentZone.appendChild(addRowBtn);

        block.appendChild(grabZone);
        block.appendChild(contentZone);

        this.setupBlockDrag(block, grabZone);
        if (replaceBlock && replaceBlock.parentNode) {
            replaceBlock.parentNode.replaceChild(block, replaceBlock);
        } else {
            this.container.appendChild(block);
        }
        if ((window as any).lucide) (window as any).lucide.createIcons({ root: block });

        this.updateBlockNumbers();
        if (autoFocus) {
            setTimeout(() => {
                const fc = rowsContainer.querySelector('.table-cell-x') as HTMLInputElement;
                if (fc) fc.focus();
            }, 20);
        }
        return blockId;
    }

    /**
     * Converte instantaneamente um bloco de expressão em uma Tabela de Dados (Desmos style: "table" ou "tabela")
     */
    static convertBlockToTable(blockId: string): string | null {
        const targetBlock = document.getElementById(blockId);
        if (!targetBlock) return null;
        const folderId = targetBlock.dataset.folderId;
        const tid = this.addTable(undefined, true, folderId, targetBlock);
        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
        return tid;
    }

    static addFolder(title: string = 'Nova Pasta', autoFocus: boolean = true, replaceBlock?: HTMLElement): string {
        this.blockCounter++;
        const folderId = 'folder-' + this.blockCounter;

        const block = document.createElement('div');
        block.id = folderId;
        block.dataset.type = 'folder';
        block.dataset.collapsed = 'false';
        block.className = 'flex flex-col border-b border-gray-200 bg-gray-50/90 transition-colors duration-200 relative group select-none';

        const header = document.createElement('div');
        header.className = 'flex items-center px-2 py-2.5 gap-2 cursor-pointer hover:bg-gray-100 transition-colors';

        // Toggle collapse button
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 rounded transition-transform';
        collapseBtn.innerHTML = `<svg class="folder-chevron w-4 h-4 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

        // Folder icon
        const folderIcon = document.createElement('div');
        folderIcon.className = 'folder-icon text-emerald-600 flex items-center justify-center';
        folderIcon.innerHTML = `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

        // Title input
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'folder-title-input font-bold text-gray-800 text-sm bg-transparent border-none outline-none grow px-1 hover:bg-white/60 focus:bg-white rounded transition-colors';
        titleInput.value = title;
        titleInput.placeholder = 'Nome da Pasta';
        titleInput.onclick = (e) => e.stopPropagation();
        titleInput.oninput = () => HistoryManager.recordState(false);

        // Group visibility toggle button
        const visBtn = document.createElement('button');
        visBtn.className = 'visibility-toggle folder-vis-btn w-6 h-6 rounded-full flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors';
        visBtn.dataset.visible = 'true';
        visBtn.title = 'Ocultar / Exibir todo o conteúdo da pasta';
        visBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

        visBtn.onclick = (e) => {
            e.stopPropagation();
            const isVis = visBtn.dataset.visible === 'true';
            visBtn.dataset.visible = isVis ? 'false' : 'true';
            visBtn.innerHTML = isVis ? 
                `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>` :
                `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
            visBtn.classList.toggle('text-gray-300', isVis);
            visBtn.classList.toggle('text-emerald-600', !isVis);
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        // Add expression inside folder button (+)
        const addInFolderBtn = document.createElement('button');
        addInFolderBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-white rounded transition-colors';
        addInFolderBtn.title = 'Adicionar expressão nesta pasta';
        addInFolderBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
        addInFolderBtn.onclick = (e) => {
            e.stopPropagation();
            if (block.dataset.collapsed === 'true') {
                this.toggleFolderCollapse(folderId);
            }
            this.addBlock(true, '', folderId);
            HistoryManager.recordState(true);
        };

        // Delete folder button
        const delFolderBtn = document.createElement('button');
        delFolderBtn.className = 'w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded transition-colors';
        delFolderBtn.title = 'Excluir pasta e itens';
        delFolderBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delFolderBtn.onclick = (e) => {
            e.stopPropagation();
            const children = this.container.querySelectorAll(`[data-folder-id="${folderId}"]`);
            children.forEach(c => c.remove());
            block.remove();
            this.updateBlockNumbers();
            HistoryManager.recordState(true);
            this.onUpdateCallback();
        };

        header.onclick = () => {
            this.toggleFolderCollapse(folderId);
        };

        header.appendChild(collapseBtn);
        header.appendChild(folderIcon);
        header.appendChild(titleInput);
        header.appendChild(addInFolderBtn);
        header.appendChild(visBtn);
        header.appendChild(delFolderBtn);

        block.appendChild(header);
        if (replaceBlock && replaceBlock.parentNode) {
            replaceBlock.parentNode.replaceChild(block, replaceBlock);
        } else {
            this.container.appendChild(block);
        }

        this.updateBlockNumbers();

        if (autoFocus) setTimeout(() => titleInput.focus(), 15);
        return folderId;
    }

    /**
     * Converte instantaneamente um bloco de expressão em uma Pasta Organizadora (Desmos style: "folder" ou "pasta")
     */
    static convertBlockToFolder(blockId: string, title: string = 'Nova Pasta'): string | null {
        const targetBlock = document.getElementById(blockId);
        if (!targetBlock) return null;
        const fid = this.addFolder(title, true, targetBlock);
        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
        return fid;
    }

    static toggleFolderCollapse(folderId: string) {
        const folder = document.getElementById(folderId);
        if (!folder) return;
        const isCollapsed = folder.dataset.collapsed === 'true';
        folder.dataset.collapsed = isCollapsed ? 'false' : 'true';

        const chevron = folder.querySelector('.folder-chevron') as HTMLElement;
        if (chevron) {
            chevron.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
        }

        const children = this.container.querySelectorAll(`[data-folder-id="${folderId}"]`) as NodeListOf<HTMLElement>;
        children.forEach(child => {
            child.style.display = isCollapsed ? 'flex' : 'none';
        });

        HistoryManager.recordState(true);
    }

    static restoreFromSnapshot(blocks: BlockSnapshot[]) {
        this.container.innerHTML = '';
        if (!blocks || blocks.length === 0) {
            this.addBlock(false);
            this.updateBlockNumbers();
            return;
        }

        blocks.forEach(b => {
            if (b.type === 'folder') {
                const fid = this.addFolder(b.content, false);
                const folderEl = document.getElementById(fid);
                if (folderEl) {
                    folderEl.id = b.id;
                    if (!b.visible) {
                        const visBtn = folderEl.querySelector('.visibility-toggle') as HTMLElement;
                        if (visBtn) visBtn.click();
                    }
                    if (b.isCollapsed) {
                        this.toggleFolderCollapse(b.id);
                    }
                }
            } else if (b.type === 'note') {
                const nid = this.addNote(b.content, false, b.folderId);
                const noteEl = document.getElementById(nid);
                if (noteEl) {
                    noteEl.id = b.id;
                }
            } else if (b.type === 'matrix') {
                const mid = this.addMatrix(b.matrixData, false, b.folderId);
                const matEl = document.getElementById(mid);
                if (matEl) {
                    matEl.id = b.id;
                    this.applyBlockColor(matEl, b.color);
                    matEl.dataset.lineStyle = b.lineStyle;
                    matEl.dataset.lineWidth = b.lineWidth.toString();
                    if (!b.visible) {
                        const visBtn = matEl.querySelector('.visibility-toggle') as HTMLElement;
                        if (visBtn) visBtn.click();
                    }
                }
            } else if (b.type === 'table') {
                const tid = this.addTable(b.tableData, false, b.folderId);
                const tblEl = document.getElementById(tid);
                if (tblEl) {
                    tblEl.id = b.id;
                    this.applyBlockColor(tblEl, b.color);
                    tblEl.dataset.lineStyle = b.lineStyle;
                    tblEl.dataset.lineWidth = b.lineWidth.toString();
                    if (!b.visible) {
                        const visBtn = tblEl.querySelector('.visibility-toggle') as HTMLElement;
                        if (visBtn) visBtn.click();
                    }
                }
            } else {
                const bid = this.addBlock(false, b.content, b.folderId);
                const blockEl = document.getElementById(bid);
                if (blockEl) {
                    blockEl.id = b.id;
                    this.applyBlockColor(blockEl, b.color);
                    blockEl.dataset.lineStyle = b.lineStyle;
                    blockEl.dataset.lineWidth = b.lineWidth.toString();
                    if (!b.visible) {
                        const visBtn = blockEl.querySelector('.visibility-toggle') as HTMLElement;
                        if (visBtn) visBtn.click();
                    }
                    const sliderRow = blockEl.querySelector('.slider-row') as HTMLElement;
                    if (sliderRow && b.sliderVal !== undefined) {
                        const sliderInput = sliderRow.querySelector('.slider-input') as HTMLInputElement;
                        const minInput = sliderRow.querySelector('.min-val') as HTMLInputElement;
                        const maxInput = sliderRow.querySelector('.max-val') as HTMLInputElement;
                        if (sliderInput && b.sliderVal) sliderInput.value = b.sliderVal;
                        if (minInput && b.sliderMin) minInput.value = b.sliderMin;
                        if (maxInput && b.sliderMax) maxInput.value = b.sliderMax;
                    }
                }
            }
        });
        this.updateBlockNumbers();
    }

    /**
     * Importa um grafo público do Desmos pelo ID da URL (ex: 5ls5ggt5gd)
     */
    static async importFromDesmosUrl(calcId: string, replaceBlock?: HTMLElement): Promise<boolean> {
        try {
            const resp = await fetch(`https://www.desmos.com/calculator/${calcId}`);
            if (!resp.ok) return false;
            const html = await resp.text();
            const match = html.match(/data-load-data="([^"]+)"/);
            if (match) {
                const rawJson = match[1].replace(/&quot;/g, '"');
                const data = JSON.parse(rawJson);
                if (data.graph?.stateUrl) {
                    const stateResp = await fetch(data.graph.stateUrl);
                    if (stateResp.ok) {
                        const stateJson = await stateResp.json();
                        this.importFromStateJson(stateJson, replaceBlock);
                        return true;
                    }
                }
            }
        } catch (e) {
            console.warn('[ExpressionManager] Erro ao importar do Desmos:', e);
        }
        return false;
    }

    /**
     * Importa um estado em formato JSON (Desmos calc-state ou Motorzaoo snapshot)
     */
    static importFromStateJson(state: any, replaceBlock?: HTMLElement) {
        if (!state) return;
        const exprList = state.expressions?.list || (Array.isArray(state) ? state : null);
        if (!exprList || !Array.isArray(exprList)) return;

        if (replaceBlock && replaceBlock.parentNode) {
            replaceBlock.remove();
        }

        const folderMap: Record<string, string> = {};

        exprList.forEach((item: any) => {
            if (!item) return;
            const targetFolderId = item.folderId ? folderMap[item.folderId] : undefined;

            if (item.type === 'folder') {
                const fid = this.addFolder(item.title || 'Pasta', false);
                if (item.id) folderMap[item.id] = fid;
                if (item.collapsed) this.toggleFolderCollapse(fid);
            } else if (item.type === 'text') {
                this.addNote(item.text || '', false, targetFolderId);
            } else if (item.type === 'table') {
                const cols = item.columns || [];
                let xCol = 'x_1';
                let yCol = 'y_1';
                let xVals: string[] = [];
                let yVals: string[] = [];
                if (cols.length >= 1) {
                    xCol = cols[0].latex || 'x_1';
                    xVals = cols[0].values || [];
                }
                if (cols.length >= 2) {
                    yCol = cols[1].latex || 'y_1';
                    yVals = cols[1].values || [];
                }
                const rowCount = Math.max(xVals.length, yVals.length, 3);
                const rows: { x: string; y: string }[] = [];
                for (let i = 0; i < rowCount; i++) {
                    rows.push({ x: xVals[i] !== undefined ? xVals[i] : '', y: yVals[i] !== undefined ? yVals[i] : '' });
                }
                this.addTable({ xCol, yCol, rows, connectLines: !!item.lines }, false, targetFolderId);
            } else {
                const latex = item.latex || '';
                if (latex.trim()) {
                    const bid = this.addBlock(false, latex, targetFolderId);
                    const blockEl = document.getElementById(bid);
                    if (blockEl) {
                        if (item.color) this.applyBlockColor(blockEl, item.color);
                        if (item.hidden) {
                            const vis = blockEl.querySelector('.visibility-toggle') as HTMLElement;
                            if (vis) vis.click();
                        }
                        if (item.lineStyle) blockEl.dataset.lineStyle = item.lineStyle;
                    }
                }
            }
        });

        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
    }

    static addExpression(asciiValue: string, autoFocus: boolean = false, autoSliderVar?: string, parentBlockId?: string): string {
        const blockId = this.addBlock(autoFocus, asciiValue, undefined, autoSliderVar, parentBlockId);
        const block = document.getElementById(blockId);
        if (block) {
            const mf = block.querySelector('math-field');
            if (mf) {
                (mf as any).setValue(asciiValue);
            }
        }
        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
        return blockId;
    }

    static updateExpression(blockId: string, asciiValue: string) {
        const block = document.getElementById(blockId);
        if (block) {
            const mf = block.querySelector('math-field');
            if (mf) {
                (mf as any).setValue(asciiValue, { suppressChangeNotifications: true });
            }
        }
    }

    static getAllExpressions(): {
        id: string, 
        rawAscii: string, 
        visible: boolean, 
        color: string,
        lineStyle: 'solid' | 'dashed' | 'dotted',
        lineWidth: number,
        isTable?: boolean,
        tablePoints?: { x: number, y: number, rowIndex: number, tableBlockId: string }[],
        connectLines?: boolean,
        isMatrix?: boolean,
        matrixName?: string,
        latex?: string
    }[] {
        const blocks = Array.from(this.container.children);
        const exprs: {
            id: string, 
            rawAscii: string, 
            visible: boolean, 
            color: string,
            lineStyle: 'solid' | 'dashed' | 'dotted',
            lineWidth: number,
            isTable?: boolean,
            tablePoints?: { x: number, y: number, rowIndex: number, tableBlockId: string }[],
            connectLines?: boolean,
            isMatrix?: boolean,
            matrixName?: string,
            latex?: string
        }[] = [];

        // Mapa de visibilidade das pastas
        const folderVisMap: Record<string, boolean> = {};
        blocks.forEach((block: any) => {
            if (block.dataset.type === 'folder') {
                const visBtn = block.querySelector('.visibility-toggle');
                folderVisMap[block.id] = visBtn ? (visBtn.dataset.visible !== 'false') : true;
            }
        });

        blocks.forEach((block: any) => {
            if (block.dataset.type === 'note' || block.dataset.type === 'folder') return;

            const visBtn = block.querySelector('.visibility-toggle');
            let visible = visBtn ? (visBtn as HTMLElement).dataset.visible === 'true' : true;
            
            // Se pertencer a uma pasta oculta, fica oculta no gráfico
            const folderId = block.dataset.folderId;
            if (folderId && folderVisMap[folderId] === false) {
                visible = false;
            }

            const color = block.dataset.color || '#2d70b3';
            const lineStyle = (block.dataset.lineStyle as 'solid' | 'dashed' | 'dotted') || 'solid';
            const lineWidth = parseFloat(block.dataset.lineWidth || '2.5');

            if (block.dataset.type === 'matrix') {
                const nameInput = block.querySelector('.matrix-name-input') as HTMLInputElement;
                const name = nameInput ? nameInput.value.trim() : '';
                const rows = parseInt(block.dataset.rows || '2');
                const cols = parseInt(block.dataset.cols || '2');
                const data: string[][] = [];
                for (let r = 0; r < rows; r++) {
                    const rowArr: string[] = [];
                    for (let c = 0; c < cols; c++) {
                        const cell = block.querySelector(`.matrix-cell[data-r="${r}"][data-c="${c}"]`) as HTMLInputElement;
                        rowArr.push(cell ? (cell.value.trim() || '0') : '0');
                    }
                    data.push(rowArr);
                }
                const giacMatrix = `[[${data.map(r => r.join(', ')).join('], [')}]]`;
                exprs.push({
                    id: block.id,
                    rawAscii: name ? `${name} = ${giacMatrix}` : giacMatrix,
                    visible,
                    color,
                    lineStyle,
                    lineWidth,
                    isMatrix: true,
                    matrixName: name || undefined
                });
                return;
            }

            if (block.dataset.type === 'table') {
                const connectLinesCb = block.querySelector('.table-connect-lines') as HTMLInputElement;
                const connectLines = connectLinesCb ? connectLinesCb.checked : false;
                const tablePoints: { x: number, y: number, rowIndex: number, tableBlockId: string }[] = [];
                const rowEls = block.querySelectorAll('.table-data-row');
                rowEls.forEach((rEl: HTMLElement, idx: number) => {
                    const xi = rEl.querySelector('.table-cell-x') as HTMLInputElement;
                    const yi = rEl.querySelector('.table-cell-y') as HTMLInputElement;
                    if (xi && yi && xi.value.trim() !== '' && yi.value.trim() !== '') {
                        const nx = parseFloat(xi.value.trim());
                        const ny = parseFloat(yi.value.trim());
                        if (isFinite(nx) && isFinite(ny)) {
                            tablePoints.push({ x: nx, y: ny, rowIndex: idx, tableBlockId: block.id });
                        }
                    }
                });
                exprs.push({
                    id: block.id,
                    rawAscii: '',
                    visible,
                    color,
                    lineStyle,
                    lineWidth,
                    isTable: true,
                    tablePoints,
                    connectLines
                });
                return;
            }

            const mf = block.querySelector('math-field');
            if (mf) {
                const ascii = typeof mf.getValue === 'function' ? mf.getValue('ascii-math') : (mf.value || mf.getAttribute('value') || '');
                const latex = typeof mf.getValue === 'function' ? mf.getValue('latex') : (mf.value || mf.getAttribute('value') || '');
                if (ascii || latex) exprs.push({ id: block.id, rawAscii: ascii || '', latex: latex || '', visible, color, lineStyle, lineWidth });
            }
        });
        return exprs;
    }

    /**
     * Exibe chips de sugestão de criação de sliders no estilo Desmos ("adicionar controle: [m] [b] [todos]")
     */
    static setSliderSuggestions(blockId: string, freeVars: string[], onAddSlider: (v: string) => void) {
        const block = document.getElementById(blockId);
        if (!block) return;
        const chipsRow = block.querySelector('.slider-chips-row') as HTMLElement;
        if (!chipsRow) return;

        if (!freeVars || freeVars.length === 0) {
            chipsRow.innerHTML = '';
            chipsRow.classList.add('hidden');
            return;
        }

        chipsRow.innerHTML = `<span class="font-medium text-gray-500">adicionar controle deslizante:</span>`;
        freeVars.forEach(v => {
            const btn = document.createElement('button');
            btn.className = 'px-2 py-0.5 rounded bg-white hover:bg-blue-600 hover:text-white border border-gray-200 hover:border-blue-500 text-blue-600 font-semibold shadow-2xs transition-all cursor-pointer text-xs';
            btn.innerText = v;
            btn.onclick = (e) => {
                e.stopPropagation();
                onAddSlider(v);
            };
            chipsRow.appendChild(btn);
        });

        if (freeVars.length > 1) {
            const allBtn = document.createElement('button');
            allBtn.className = 'px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 font-semibold shadow-2xs transition-all cursor-pointer text-xs';
            allBtn.innerText = 'tudo';
            allBtn.onclick = (e) => {
                e.stopPropagation();
                freeVars.forEach(v => onAddSlider(v));
            };
            chipsRow.appendChild(allBtn);
        }

        chipsRow.classList.remove('hidden');
    }

    /**
     * Exibe ou oculta o indicador de erro sutil com tooltip na margem esquerda (Estilo Desmos)
     */
    static setError(blockId: string, errorMsg: string | null) {
        const block = document.getElementById(blockId);
        if (!block) return;
        const warningTrigger = block.querySelector('.block-warning-trigger') as HTMLElement;
        const visibilityBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        const tooltipEl = block.querySelector('.warning-popover-tooltip') as HTMLElement;

        if (errorMsg) {
            if (warningTrigger) {
                warningTrigger.classList.remove('hidden');
                warningTrigger.style.display = 'flex';
                if (tooltipEl) tooltipEl.innerText = errorMsg;
            }
            if (visibilityBtn) {
                visibilityBtn.style.display = 'none';
            }
        } else {
            if (warningTrigger) {
                warningTrigger.classList.add('hidden');
                warningTrigger.style.display = 'none';
                if (tooltipEl) tooltipEl.innerText = '';
            }
            if (visibilityBtn) {
                if (block.dataset.isMatrix === 'true' || block.dataset.isPlottable === 'false') {
                    visibilityBtn.style.display = 'none';
                } else {
                    visibilityBtn.style.display = 'flex';
                    const curColor = block.dataset.color || '#2d70b3';
                    const isVisible = visibilityBtn.dataset.visible !== 'false';
                    visibilityBtn.style.backgroundColor = isVisible ? curColor : 'transparent';
                    visibilityBtn.style.border = isVisible ? ('2px solid ' + curColor) : ('2px dashed ' + curColor);
                    visibilityBtn.style.boxShadow = 'none';
                }
            }
        }
    }

    static processBlockState(blockId: string, ascii: string, scope: any) {
        const block = document.getElementById(blockId);
        if (!block) return false;

        const sliderRow = block.querySelector('.slider-row') as HTMLElement;
        if (!sliderRow) return false;
        
        const assignmentMatch = ascii.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
        
        if (assignmentMatch) {
            const varName = assignmentMatch[1];
            
            // Prevent sliders for reserved variables and coordinates (z is only coordinate in 3D mode)
            const isCoord = (varName === 'x' || varName === 'y' || varName === 'e' || varName === 'pi' || (StateManager.viewMode === '3d' && varName === 'z'));
            if (isCoord) {
                sliderRow.style.display = 'none';
                return false;
            }

            const rightSide = assignmentMatch[2];
            
            // Só inibe o slider se o lado direito contiver as variáveis independentes x ou y (ou z em 3D) como palavras isoladas
            const hasForbiddenCoords = StateManager.viewMode === '3d' ? /\b[xyz]\b/.test(rightSide) : /\b[xy]\b/.test(rightSide);
            if (hasForbiddenCoords) {
                sliderRow.style.display = 'none';
                return false;
            }

            const evalResult = scope[varName];

            if (typeof evalResult === 'number' && !isNaN(evalResult)) {
                sliderRow.style.display = 'flex'; 
                
                const sliderInput = sliderRow.querySelector('.slider-input') as HTMLInputElement;
                
                if (document.activeElement !== sliderInput) {
                    sliderInput.value = evalResult.toString();
                }
                return true; 
            }
        }
        
        sliderRow.style.display = 'none';
        return false;
    }

    static toFraction(val: number, maxDen: number = 100000): { num: number, den: number } | null {
        const r = RationalEngine.fromNumber(val, maxDen);
        return r ? { num: r.n, den: r.d } : null;
    }

    static parseFractionInfo(mathStr: string): { fractionLatex: string, decimalStr: string, isRational: boolean } | null {
        let clean = mathStr.trim();
        if (clean.startsWith('=')) clean = clean.substring(1).trim();
        if (clean.includes('≈')) {
            const parts = clean.split('≈').map(p => p.trim());
            clean = parts[0];
        }

        // 1. Fração ASCII: 3/2, -5/4, (3)/(2)
        const fracMatch = clean.match(/^\(?\s*(-?\d+)\s*\)?\s*\/\s*\(?\s*(\d+)\s*\)?$/);
        if (fracMatch) {
            const num = parseInt(fracMatch[1]);
            const den = parseInt(fracMatch[2]);
            const r = RationalEngine.create(num, den);
            if (r) {
                return {
                    fractionLatex: RationalEngine.toLatex(r),
                    decimalStr: RationalEngine.toDecimalString(r),
                    isRational: r.d !== 1
                };
            }
        }

        // 2. Fração LaTeX: \frac{a}{b}
        const latexMatch = clean.match(/^([+-]?)\s*\\frac\s*\{(\d+)\}\s*\{(\d+)\}$/);
        if (latexMatch) {
            const sign = latexMatch[1] === '-' ? -1 : 1;
            const num = parseInt(latexMatch[2]) * sign;
            const den = parseInt(latexMatch[3]);
            const r = RationalEngine.create(num, den);
            if (r) {
                return {
                    fractionLatex: RationalEngine.toLatex(r),
                    decimalStr: RationalEngine.toDecimalString(r),
                    isRational: r.d !== 1
                };
            }
        }

        // 3. Número decimal: 1.5, 0.75, -2.5
        const numVal = Number(clean);
        if (!isNaN(numVal) && isFinite(numVal)) {
            if (Number.isInteger(numVal)) {
                return null;
            }
            const r = RationalEngine.fromNumber(numVal);
            if (r && r.d > 1 && r.d <= 100000) {
                return {
                    fractionLatex: RationalEngine.toLatex(r),
                    decimalStr: RationalEngine.toDecimalString(r),
                    isRational: true
                };
            }
            return null;
        }

        return null;
    }

    static renderLatexMarkup(latex: string): string {
        const win = typeof window !== 'undefined' ? (window as any) : {};
        if (typeof win.katex?.renderToString === 'function') {
            try {
                return win.katex.renderToString(latex, { throwOnError: false });
            } catch (_) {}
        }
        try {
            if (typeof convertLatexToMarkup === 'function') {
                return convertLatexToMarkup(latex);
            }
        } catch (_) {}
        return latex;
    }

    static setResult(id: string, result: string) {
        const block = document.getElementById(id);
        if (block) {
            const resDisplay = block.querySelector('.result-display') as HTMLElement;
            if (resDisplay) {
                if (!result || result.includes('Sintaxe Inválida') || result.includes('incompleta')) {
                    resDisplay.classList.add('hidden');
                    resDisplay.innerHTML = '';
                    return;
                }
                if (/\b(?:pnt|point)\b|pnt\(|pnt\[|point\[|536870912/i.test(result)) {
                    result = '- Erro no cálculo';
                }
                resDisplay.classList.remove('hidden');
                resDisplay.title = result;

                let mathStr = result.trim();
                if (mathStr.startsWith('= ')) mathStr = mathStr.substring(2);
                mathStr = mathStr.replace(/^matrix\s*\[/g, '[').replace(/^list\s*\[/g, '[');

                // Detectar se o resultado é uma matriz: [[1, 2], [3, 4]] ou \begin{bmatrix} ... \end{bmatrix}
                const matrixMatch = mathStr.match(/^\[\s*\[(.*)\]\s*\]$/);
                const isExplicitBmatrix = mathStr.startsWith('\\begin{bmatrix}') || mathStr.includes('\\begin{bmatrix}');
                if (matrixMatch || isExplicitBmatrix) {
                    try {
                        let katexMatrix = mathStr;
                        let isTruncated = false;
                        let dimRows = 0;
                        let dimCols = 0;

                        if (matrixMatch) {
                            const rowStrings = mathStr.slice(1, -1).split(/\],\s*\[/);
                            const parsedGrid: number[][] = [];
                            let allNumeric = true;
                            for (const r of rowStrings) {
                                const cells = r.replace(/[\[\]]/g, '').split(',').map((c: string) => {
                                    const num = Number(c.trim());
                                    if (isNaN(num)) allNumeric = false;
                                    return num;
                                });
                                parsedGrid.push(cells);
                            }

                            if (allNumeric && parsedGrid.length > 0) {
                                const fmt = MatrixEngine.formatMatrixLaTeX(parsedGrid, 6, 6);
                                katexMatrix = fmt.latex;
                                isTruncated = fmt.isTruncated;
                                dimRows = fmt.rows;
                                dimCols = fmt.cols;
                            } else {
                                const katexRows = rowStrings.map((r: string) => {
                                    const cells = r.replace(/[\[\]]/g, '').split(',').map((c: string) => c.trim());
                                    return cells.join(' & ');
                                }).join(' \\\\ ');
                                katexMatrix = `\\begin{bmatrix} ${katexRows} \\end{bmatrix}`;
                            }
                        }

                        const html = this.renderLatexMarkup(katexMatrix);
                        const badgeHtml = isTruncated
                            ? `<span class="matrix-dim-badge ml-1.5 inline-block text-[10px] font-sans font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded px-1 py-0.2 select-none">${dimRows} × ${dimCols}</span>`
                            : '';
                        resDisplay.innerHTML = `<span class="font-semibold text-gray-800 select-text">= <span style="display:inline-block; vertical-align: middle;">${html}</span>${badgeHtml}</span>`;
                        this.updateMatrixBlockVisual(block, true);
                        return;
                    } catch(e) {
                        console.warn('[ExpressionManager] Failed to format matrix result:', e);
                    }
                }

                // Botão de Fração Interativo Desmos [a/b] para cálculos com resultado racional
                const fractionInfo = this.parseFractionInfo(mathStr);
                if (fractionInfo && fractionInfo.isRational) {
                    const isFracActive = (block as any)._showFraction === true;
                    const valueToRender = isFracActive ? fractionInfo.fractionLatex : fractionInfo.decimalStr;
                    let valueHtml = valueToRender;
                    if (isFracActive) {
                        try {
                            valueHtml = this.renderLatexMarkup(fractionInfo.fractionLatex);
                        } catch (err) {
                            console.warn('[ExpressionManager] Fraction markup render failed:', err);
                        }
                    }
                    
                    resDisplay.innerHTML = `
                        <div class="flex items-center gap-1.5 select-none">
                            <button type="button" class="fraction-toggle-btn flex items-center justify-center w-6 h-6 rounded border transition-all cursor-pointer select-none text-[10px] font-bold font-serif leading-none tracking-tighter ${isFracActive ? 'bg-blue-100 border-blue-400 text-blue-700 shadow-xs' : 'bg-white border-gray-300 text-gray-500 hover:text-gray-800 hover:bg-gray-100 hover:border-gray-400'}" title="${isFracActive ? 'Mostrar aproximação decimal' : 'Mostrar fração exata'}">
                                a/b
                            </button>
                            <span class="font-semibold text-gray-800 select-text">= <span style="display:inline-block; vertical-align: middle;">${valueHtml}</span></span>
                        </div>
                    `;
                    const btn = resDisplay.querySelector('.fraction-toggle-btn') as HTMLButtonElement;
                    if (btn) {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            (block as any)._showFraction = !isFracActive;
                            this.setResult(id, result);
                        });
                    }
                    return;
                }

                if (mathStr.startsWith('[[') && mathStr.endsWith(']]')) {
                    mathStr = mathStr.replace(/\[\[/g, '\\begin{bmatrix} ')
                                     .replace(/\]\]/g, ' \\end{bmatrix}')
                                     .replace(/\],\s*\[/g, ' \\\\ ')
                                     .replace(/,\s*/g, ' & ');
                }

                if (!mathStr.includes('Erro') && !mathStr.includes('indefinido') && !mathStr.includes('carregar')) {
                    if (mathStr.includes('\\') || mathStr.startsWith('[') || mathStr.includes('matrix')) {
                        try {
                            const html = this.renderLatexMarkup(mathStr);
                            resDisplay.innerHTML = '<span class="font-semibold text-gray-800 select-text">= <span style="display:inline-block; vertical-align: middle;">' + html + '</span></span>';
                        } catch(e) {
                            resDisplay.innerText = `= ${mathStr}`;
                        }
                    } else {
                        resDisplay.innerText = `= ${mathStr}`;
                    }
                } else {
                    resDisplay.innerText = `= ${mathStr}`;
                }
            }
        }
    }

    /**
     * Recalcula em tempo real os tamanhos e posições das alças de todas as matrizes
     * de acordo com a largura atual da barra lateral e sua borda arrastável.
     */
    static updateAllMatrixSizes(): void {
        const blocks = document.querySelectorAll<HTMLElement>('#expressions-list > div');
        blocks.forEach((block) => {
            if (typeof (block as any)._updateMatrixHandle === 'function') {
                (block as any)._updateMatrixHandle();
            }
        });
    }
}