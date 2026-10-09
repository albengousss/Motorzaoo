import { StateManager } from '../core/stateManager';
import { MathEngine } from '../core/mathEngine';
import { PrattParser } from '../core/prattParser';
import { HistoryManager, type BlockSnapshot } from '../core/historyManager';

export class ExpressionManager {
    static container = document.getElementById('expressions-list')!;
    static addBtn = document.getElementById('add-expr-btn')!;
    static onUpdateCallback: () => void;
    static blockCounter = 0;
    static activeMathfield: any = null;

    static autocompleteDiv = document.createElement('div');
    static casDocs: Record<string, string[]> = {
        'Integral': ['Integral( <Função>, <Variável> )', 'Integral( <Função>, <Variável>, <Início>, <Fim> )'],
        'IntegralSymbolic': ['IntegralSymbolic( <Função>, <Variável> )'],
        'IntegralBetween': ['IntegralBetween( <Função f>, <Função g>, <Início>, <Fim> )', 'IntegralBetween( <Função f>, <Função g>, <Variável>, <Início>, <Fim> )'],
        'NIntegral': ['NIntegral( <Função>, <Variável>, <Início>, <Fim> )'],
        'Derivative': ['Derivative( <Função>, <Variável> )', 'Derivative( <Função>, <Variável>, <Ordem> )'],
        'NDerivative': ['NDerivative( <Função> )', 'NDerivative( <Função>, <Ordem> )'],
        'ImplicitDerivative': ['ImplicitDerivative( <Expressão> )', 'ImplicitDerivative( <Expressão>, <Var Dependente>, <Var Independente> )'],
        'Solveode': ['Solveode( <Equação> )', 'Solveode( <Equação>, <Ponto> )', 'Solveode( <Equação>, <Ponto f>, <Ponto f\'> )'],
        'NSolveODE': ['NSolveODE( <Lista de Derivadas>, <X Inicial>, <Lista de Y Iniciais>, <X Final> )'],
        'Slopefield': ['Slopefield( <Equação Diferencial> )'],
        'Locus': ['Locus( <Ponto Q>, <Ponto P> )', 'Locus( <Campo Vetorial>, <Ponto> )'],
        'Factor': ['Factor( <Polinômio> )'],
        'Expand': ['Expand( <Expressão> )'],
        'Simplify': ['Simplify( <Expressão> )'],
        'Limit': ['Limit( <Função>, <Variável>, <Valor> )'],
        'Solutions': ['Solutions( <Equação> )'],
        'NSolve': ['NSolve( <Equação> )'],
        'MatrixRank': ['MatrixRank( <Matriz> )'],
        'Invert': ['Invert( <Matriz> )'],
        'Determinant': ['Determinant( <Matriz> )'],
        'Eigenvalues': ['Eigenvalues( <Matriz> )'],
        'Eigenvectors': ['Eigenvectors( <Matriz> )'],
        'LUDecomposition': ['LUDecomposition( <Matriz> )'],
        'Laplace': ['Laplace( <Função> )', 'Laplace( <Função>, <Variável>, <S> )'],
        'LCM': ['LCM( <Número>, <Número> )', 'LCM( <Polinómio>, <Polinómio> )'],
        'JordanDiagonalization': ['JordanDiagonalization( <Matriz> )'],
        'ApplyMatrix': ['ApplyMatrix( <Matriz>, <Objeto> )'],
        'CharacteristicPolynomial': ['CharacteristicPolynomial( <Matriz> )'],
        'MinimalPolynomial': ['MinimalPolynomial( <Matriz> )'],
        'Dimension': ['Dimension( <Matriz> )'],
        'Dot': ['Dot( <Vetor>, <Vetor> )'],
        'Cross': ['Cross( <Vetor>, <Vetor> )'],
        'Length': ['Length( <Vetor> )'],
        'QRDecomposition': ['QRDecomposition( <Matriz> )'],
        'ReducedRowEchelonForm': ['ReducedRowEchelonForm( <Matriz> )'],
        'SVD': ['SVD( <Matriz> )'],
        'Transpose': ['Transpose( <Matriz> )'],
        'UnitVector': ['UnitVector( <Vetor> )']
    };

    static showAutocomplete(mf: any) {
        // Remover espaços para evitar que 'I n' falhe na deteção
        const ascii = mf.getValue('ascii-math').replace(/\s+/g, '');
        // Check if cursor is typing a word. Mathlive might have a selection. 
        // We'll just check if the last word typed matches a CAS command prefix (case-insensitive).
        const match = ascii.match(/([A-Za-z]{2,})$/); // Requer pelo menos 2 letras para sugerir
        
        if (match) {
            const prefix = match[1].toLowerCase();
            const suggestions = Object.keys(this.casDocs).filter(k => k.toLowerCase().startsWith(prefix));
            
            if (suggestions.length > 0) {
                this.autocompleteDiv.innerHTML = '';
                suggestions.forEach(cmd => {
                    const row = document.createElement('div');
                    row.style.cssText = 'padding: 4px; border-bottom: 1px solid #eee; cursor: pointer;';
                    
                    const title = document.createElement('strong');
                    title.innerText = cmd;
                    row.appendChild(title);
                    
                    this.casDocs[cmd].forEach(docLine => {
                        const div = document.createElement('div');
                        div.style.cssText = 'color: #555; margin-left: 10px; font-family: monospace; font-size: 11px;';
                        div.innerText = docLine;
                        row.appendChild(div);
                    });
                    
                    row.onmouseenter = () => row.style.background = '#f0f0f0';
                    row.onmouseleave = () => row.style.background = 'white';
                    
                    row.onclick = () => {
                        // Obter o ASCII original (com espaços) para fazer a substituição correta no final
                        const originalAscii = mf.getValue('ascii-math');
                        const regexMatch = originalAscii.match(/[A-Za-z\s]+$/);
                        let typedRaw = regexMatch ? regexMatch[0] : match[1];
                        
                        const newAscii = originalAscii.substring(0, originalAscii.length - typedRaw.length) + cmd + '(';
                        mf.setValue(newAscii, { format: 'ascii-math' });
                        mf.executeCommand(['performWithFeedback', 'moveToMathFieldEnd']);
                        mf.executeCommand(['performWithFeedback', 'moveToPreviousChar']);
                        this.autocompleteDiv.style.display = 'none';
                        this.onUpdateCallback();
                    };
                    
                    this.autocompleteDiv.appendChild(row);
                });
                
                const rect = mf.getBoundingClientRect();
                this.autocompleteDiv.style.left = rect.left + 'px';
                this.autocompleteDiv.style.top = (rect.bottom + window.scrollY) + 'px';
                this.autocompleteDiv.style.display = 'block';
            } else {
                this.autocompleteDiv.style.display = 'none';
            }
        } else {
            this.autocompleteDiv.style.display = 'none';
        }
    }

    // ─── POPOVER DE ESTILO (DESMOS STYLE) ──────────────────────────
    static stylePopover: HTMLDivElement = document.createElement('div');
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
                    ${['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#333333'].map(c => `
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
            visBtn.style.borderColor = color;
            const isVisible = visBtn.dataset.visible === 'true';
            visBtn.style.background = isVisible ? `${color}20` : 'transparent';
        }
        if (numSpan) {
            numSpan.style.color = color;
        }
    }

    static init(onUpdate: () => void) {
        this.autocompleteDiv.style.cssText = 'position: absolute; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: sans-serif; font-size: 12px; z-index: 9999; display: none; padding: 5px; max-height: 200px; overflow-y: auto; width: 300px; text-align: left;';
        document.body.appendChild(this.autocompleteDiv);
        this.initStylePopover();

        this.onUpdateCallback = onUpdate;
        
        // Botão Adicionar Expressão
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

        // Botões Undo / Redo do cabeçalho
        const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
        const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
        if (undoBtn) {
            undoBtn.addEventListener('click', () => HistoryManager.undo());
        }
        if (redoBtn) {
            redoBtn.addEventListener('click', () => HistoryManager.redo());
        }

        HistoryManager.init(
            () => this.onUpdateCallback(),
            (canUndo, canRedo) => {
                if (undoBtn) undoBtn.disabled = !canUndo;
                if (redoBtn) redoBtn.disabled = !canRedo;
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
                if (numSpan) numSpan.innerText = index.toString();
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
            block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group pl-3 border-l-4 border-l-blue-300';
        } else {
            block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group';
        }

        const grabZone = document.createElement('div');
        grabZone.className = 'w-12 bg-white flex flex-col items-center justify-start pt-[14px] shrink-0 select-none text-gray-500 gap-1.5';
        
        const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19'];
        const colorIndex = Array.from(this.container.children).length % colors.length;
        const blockColor = colors[colorIndex];
        block.dataset.color = blockColor;
        block.dataset.lineStyle = 'solid';
        block.dataset.lineWidth = '2.5';

        const visibilityBtn = document.createElement('div');
        visibilityBtn.className = 'visibility-toggle';
        visibilityBtn.dataset.visible = 'true';
        visibilityBtn.title = 'Clique: ocultar/exibir | Botão direito ou segurar: estilo';
        // Desmos-style circle
        visibilityBtn.style.cssText = `width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${blockColor}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; background: ${blockColor}20; position: relative;`;
        
        const numberSpan = document.createElement('span');
        numberSpan.className = 'block-number';
        numberSpan.style.cssText = `font-size: 14px; font-weight: bold; color: ${blockColor}; cursor: grab;`;
        numberSpan.innerText = this.blockCounter.toString();

        const warningTrigger = document.createElement('div');
        warningTrigger.className = 'block-warning-trigger hidden';
        warningTrigger.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div class="warning-popover-tooltip"></div>
        `;
        
        visibilityBtn.appendChild(numberSpan);
        visibilityBtn.appendChild(warningTrigger);

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
            visibilityBtn.style.background = isVisible ? 'transparent' : `${currentColor}20`;
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

        // --- ÁREA DE CONTEÚDO (Matemática + Slider) ---
        const contentZone = document.createElement('div');
        contentZone.className = 'flex flex-col grow overflow-hidden';
        const topRow = document.createElement('div');
        topRow.className = 'flex items-center px-2 py-2 gap-2 overflow-hidden min-h-[50px] relative';

        const mathContainer = document.createElement('div');
        mathContainer.className = 'flex items-center grow overflow-hidden min-w-0';

        const mf = document.createElement('math-field');
        mf.className = 'border-none outline-none text-lg bg-transparent w-full';
        
        const resultSpan = document.createElement('div');
        resultSpan.className = 'result-display text-gray-800 text-sm font-semibold shrink-0 ml-auto mr-1 hidden select-text flex items-center gap-1.5 transition-all';

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
        delBtn.className = 'bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-auto transition-all opacity-40 hover:opacity-100 hover:text-gray-800 outline-none';

        mathContainer.appendChild(mf);
        topRow.appendChild(mathContainer);
        topRow.appendChild(resultSpan);
        topRow.appendChild(delBtn);
        contentZone.appendChild(topRow);

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
        
        block.appendChild(grabZone);
        block.appendChild(contentZone);
        this.container.appendChild(block);
        if ((window as any).lucide) (window as any).lucide.createIcons({ root: block });

        const mathField = mf as any;
        mathField.smartMode = false;
        mathField.smartFence = true;
        mathField.smartSuperscript = false;
        mathField.mathVirtualKeyboardPolicy = 'auto';
        mathField.menuItems = [];
        mathField.inlineShortcuts = {
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
            'd/dx': '\\frac{d}{dx}',
            'ddx': '\\frac{d}{dx}',
            'diff': '\\frac{d}{dx}'
        };
        const currentBindings = mathField.keybindings || [];
        mathField.keybindings = [
            { key: '/', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '[Slash]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '[NumpadDivide]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '^', ifMode: 'math', command: 'moveToSuperscript' },
            { key: 'shift+[Digit6]', ifMode: 'math', command: 'moveToSuperscript' },
            { key: '*', ifMode: 'math', command: ['insert', '\\cdot'] },
            ...currentBindings
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
        mathField.style.setProperty('--selection-background-color', 'transparent');
        mathField.style.setProperty('--_selection-background-color', 'transparent');

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
                        --selection-background-color: transparent !important;
                        --_selection-background-color: transparent !important;
                        --box-placeholder-color: #94a3b8 !important;
                        --_box-placeholder-color: #94a3b8 !important;
                    }
                    .ML__selection, 
                    .ML__selected,
                    .ML__focused .ML__empty-line-anchor.ML__selected::after {
                        background: transparent !important;
                        background-color: transparent !important;
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
            } catch(e) {}
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

        const handlePower = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            (mf as any).executeCommand('moveToSuperscript');
        };

        const handleFraction = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            (mf as any).executeCommand(['insert', '\\frac{#@}{#?}']);
        };

        const isCaretKey = (e: KeyboardEvent) => {
            if (e.key === '^') return true;
            // Teclado ABNT2 (Shift + ~) ou US-Intl (Shift + 6 ou Shift + `)
            if (e.shiftKey && (e.code === 'BracketLeft' || e.code === 'Digit6' || e.code === 'Backquote' || e.key === 'Dead')) {
                return true;
            }
            return false;
        };

        mf.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addBlock();
                this.updateBlockNumbers();
            } else if (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide') {
                handleFraction(e);
            } else if (isCaretKey(e)) {
                handlePower(e);
            }
        });

        mf.addEventListener('beforeinput', (e: any) => {
            if (e.data === '/') {
                handleFraction(e);
            } else if (e.data === '^') {
                handlePower(e);
            }
        });

        mf.addEventListener('input', () => {
            const rawAscii = (mf as any).getValue('ascii-math') || '';
            const rawLatex = (mf as any).getValue('latex') || '';

            // Auto-transformação Instantânea por Digitação (matrix, matriz, A = matrix, M = matriz)
            const noSpaceAscii = rawAscii.replace(/\s+/g, '');
            const cleanLatex = rawLatex.replace(/\\text\{([^}]+)\}/g, '$1').replace(/\\mathrm\{([^}]+)\}/g, '$1').replace(/\s+/g, '');
            const matrixMatch = noSpaceAscii.match(/^(?:([a-zA-Z])=)?matri[xz]$/i) ||
                                cleanLatex.match(/^(?:([a-zA-Z])=)?\\?matri[xz]$/i);
            if (matrixMatch) {
                const targetName = matrixMatch[1] ? matrixMatch[1].toUpperCase() : undefined;
                this.convertBlockToMatrix(block.id, targetName);
                return;
            }

            // Se o usuário inseriu ou colou uma matriz LaTeX (\begin{bmatrix}, \begin{pmatrix}, etc.) ou bracket notation [[1, 2], [3, 4]]
            if (rawLatex.includes('\\begin{bmatrix}') || rawLatex.includes('\\begin{pmatrix}') || rawLatex.includes('\\begin{matrix}') || cleanLatex.startsWith('[[') || cleanLatex.includes('=[[')) {
                const nameMatch = rawLatex.match(/^\s*([a-zA-Z])\s*=/);
                const targetName = nameMatch ? nameMatch[1].toUpperCase() : undefined;
                const matContentMatch = rawLatex.match(/\\begin\{(?:b|p|v|V)?matrix\}([\s\S]*?)\\end\{(?:b|p|v|V)?matrix\}/);
                if (matContentMatch) {
                    const rowStrs = matContentMatch[1].split(/\\\\/);
                    const parsedData: string[][] = [];
                    for (const rStr of rowStrs) {
                        if (!rStr.trim()) continue;
                        const colStrs = rStr.split('&');
                        const rowArr = colStrs.map((c: string) => {
                            const clean = c.replace(/#\?/g, '').replace(/#@/g, '').replace(/\\placeholder\{[^}]*\}/g, '').trim();
                            return clean || '0';
                        });
                        if (rowArr.length > 0) parsedData.push(rowArr);
                    }
                    if (parsedData.length > 0) {
                        const rCount = Math.min(8, parsedData.length);
                        const cCount = Math.min(8, Math.max(...parsedData.map((r: string[]) => r.length)));
                        for (const r of parsedData) {
                            while (r.length < cCount) r.push('0');
                        }
                        this.addMatrix({ name: targetName, rows: rCount, cols: cCount, data: parsedData }, true, block.dataset.folderId, block);
                        this.updateBlockNumbers();
                        this.onUpdateCallback();
                        HistoryManager.recordState(true);
                        return;
                    }
                }

                // Sintaxe de colchetes: [[1, 2], [3, 4]] ou A = [[1, 2], [3, 4]]
                const bracketMatch = cleanLatex.match(/^(?:([a-zA-Z])=)?(\[\[.*\]\])$/);
                if (bracketMatch) {
                    const bTargetName = bracketMatch[1] ? bracketMatch[1].toUpperCase() : undefined;
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
                            this.addMatrix({ name: bTargetName, rows: rCount, cols: cCount, data: parsedGrid }, true, block.dataset.folderId, block);
                            this.updateBlockNumbers();
                            this.onUpdateCallback();
                            HistoryManager.recordState(true);
                            return;
                        }
                    } catch(e) {}
                }
            }

            this.showAutocomplete(mf);
            this.onUpdateCallback();
            HistoryManager.recordState(false);
        });
        
        mf.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 120);
            }
        });
        
        // Esconder autocomplete se perder o foco
        mf.addEventListener('focusout', () => {
            setTimeout(() => { this.autocompleteDiv.style.display = 'none'; }, 200);
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
            (mf as any).setValue(initialValue, { suppressChangeNotifications: true });
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

    static addNote(text: string = '', autoFocus: boolean = true, folderId?: string): string {
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
        grabZone.className = 'w-12 bg-transparent flex flex-col items-center justify-start pt-[14px] shrink-0 select-none text-amber-500 gap-1.5 cursor-grab';
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
        setTimeout(autoResize, 10);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        delBtn.className = 'bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-auto transition-all opacity-40 hover:opacity-100 hover:text-red-500 outline-none';
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

        this.container.appendChild(block);
        this.updateBlockNumbers();

        if (autoFocus) setTimeout(() => textarea.focus(), 15);
        return blockId;
    }

    static getNextMatrixName(): string {
        const used = new Set<string>();
        const blocks = Array.from(this.container.children);
        blocks.forEach((b: any) => {
            if (b.dataset.type === 'matrix') {
                const nameInp = b.querySelector('.matrix-name-input') as HTMLInputElement;
                if (nameInp) used.add(nameInp.value.trim().toUpperCase());
            }
        });
        const candidates = ['A', 'B', 'C', 'D', 'M', 'N', 'P'];
        for (const name of candidates) {
            if (!used.has(name)) return name;
        }
        return `M${this.blockCounter}`;
    }

    static addMatrix(
        matrixData?: { name?: string; rows?: number; cols?: number; data?: string[][] },
        autoFocus: boolean = true,
        folderId?: string,
        replaceBlock?: HTMLElement
    ): string {
        this.blockCounter++;
        const blockId = 'matrix-block-' + this.blockCounter;

        const defaultName = matrixData?.name || this.getNextMatrixName();
        let rows = matrixData?.rows || 2;
        let cols = matrixData?.cols || 2;
        let cellValues = matrixData?.data ? JSON.parse(JSON.stringify(matrixData.data)) : [
            ['1', '0'],
            ['0', '1']
        ];

        const block = document.createElement('div');
        block.id = blockId;
        block.dataset.type = 'matrix';
        block.dataset.rows = rows.toString();
        block.dataset.cols = cols.toString();
        const blockColor = '#7c3aed';
        block.dataset.color = blockColor;
        block.dataset.lineStyle = 'solid';
        block.dataset.lineWidth = '2.5';
        if (folderId) {
            block.dataset.folderId = folderId;
            block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group pl-3 border-l-4 border-l-purple-300';
        } else {
            block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group';
        }

        const grabZone = document.createElement('div');
        grabZone.className = 'w-12 bg-white flex flex-col items-center justify-start pt-[14px] shrink-0 select-none text-gray-500 gap-1.5';

        const visibilityBtn = document.createElement('div');
        visibilityBtn.className = 'visibility-toggle';
        visibilityBtn.dataset.visible = 'true';
        visibilityBtn.title = 'Clique: ocultar/exibir | Botão direito ou segurar: estilo';
        visibilityBtn.style.cssText = `width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${blockColor}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; background: ${blockColor}20; position: relative;`;

        const nameBadge = document.createElement('span');
        nameBadge.className = 'font-bold text-sm text-purple-700 select-none';
        nameBadge.innerText = defaultName;
        visibilityBtn.appendChild(nameBadge);

        visibilityBtn.onclick = () => {
            const isVisible = visibilityBtn.dataset.visible === 'true';
            visibilityBtn.dataset.visible = isVisible ? 'false' : 'true';
            visibilityBtn.style.background = isVisible ? 'transparent' : `${block.dataset.color || blockColor}20`;
            visibilityBtn.style.borderStyle = isVisible ? 'dashed' : 'solid';
            nameBadge.style.opacity = isVisible ? '0.3' : '1';
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

        // Header do Bloco: Nome, Dimensões e Controles de Redimensionamento (+L, -L, +C, -C)
        const headerRow = document.createElement('div');
        headerRow.className = 'flex items-center gap-2 flex-wrap';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'matrix-name-input uppercase font-bold text-base text-purple-900 w-7 text-center bg-purple-50/80 border border-purple-200 rounded focus:bg-white focus:border-purple-500 outline-none transition-colors';
        nameInput.value = defaultName;
        nameInput.maxLength = 2;
        nameInput.title = 'Nome da Matriz';
        nameInput.oninput = () => {
            const val = nameInput.value.trim().toUpperCase() || 'A';
            nameBadge.innerText = val;
            updateGiacDefinition();
            this.onUpdateCallback();
            HistoryManager.recordState(false);
        };

        const eqSpan = document.createElement('span');
        eqSpan.className = 'text-gray-400 font-bold text-sm';
        eqSpan.innerText = '=';

        const dimBadge = document.createElement('span');
        dimBadge.className = 'matrix-dim-badge px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 select-none';
        dimBadge.innerText = `${rows}×${cols}`;

        // Controles de Linhas e Colunas (+ Linha, - Linha, + Coluna, - Coluna)
        const ctrlGroup = document.createElement('div');
        ctrlGroup.className = 'flex items-center gap-1 bg-gray-100 p-0.5 rounded-md text-xs';

        const createCtrlBtn = (text: string, title: string, onClick: () => void) => {
            const btn = document.createElement('button');
            btn.className = 'px-1.5 py-0.5 rounded bg-white hover:bg-purple-600 hover:text-white font-semibold text-gray-700 transition-colors shadow-2xs cursor-pointer text-[11px]';
            btn.innerText = text;
            btn.title = title;
            btn.onclick = (e) => {
                e.stopPropagation();
                onClick();
            };
            return btn;
        };

        // Grade da Matriz com Parênteses / Colchetes Estilizados, Bordas Arrastáveis e Alça Interativa
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'flex flex-col my-1 select-none overflow-visible relative';

        const matrixBody = document.createElement('div');
        matrixBody.className = 'flex items-stretch select-none relative';

        const bracketLeft = document.createElement('div');
        bracketLeft.className = 'border-l-2 border-t-2 border-b-2 border-gray-800 w-2.5 self-stretch rounded-l-xs shrink-0 mr-1.5 my-0.5 select-none pointer-events-none';

        const gridCenterCol = document.createElement('div');
        gridCenterCol.className = 'flex flex-col grow select-none';

        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid gap-1.5 py-1 px-1 grow select-none';

        // Borda inferior arrastável para alterar linhas
        const bottomBorder = document.createElement('div');
        bottomBorder.className = 'matrix-bottom-resizable w-full mt-0.5 select-none touch-none';
        bottomBorder.title = 'Arraste a borda inferior para redimensionar linhas';

        gridCenterCol.appendChild(gridContainer);
        gridCenterCol.appendChild(bottomBorder);

        const rightBracketWrapper = document.createElement('div');
        rightBracketWrapper.className = 'relative flex items-center self-stretch shrink-0 select-none touch-none';
        rightBracketWrapper.title = 'Arraste a borda para redimensionar colunas';

        const bracketRight = document.createElement('div');
        bracketRight.className = 'bracket-right-resizable border-r-2 border-t-2 border-b-2 border-gray-800 w-4 self-stretch rounded-r-xs shrink-0 ml-1.5 my-0.5 select-none flex items-center justify-center touch-none';
        bracketRight.title = 'Arraste a borda para redimensionar colunas';
        bracketRight.innerHTML = `<span class="w-0.5 h-3.5 bg-gray-400 rounded-full opacity-60"></span>`;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'matrix-drag-handle touch-none';
        dragHandle.title = 'Arraste o vértice para redimensionar linhas e colunas (m × n)';

        const dimTooltip = document.createElement('div');
        dimTooltip.className = 'matrix-dim-tooltip';
        dimTooltip.innerText = `${rows} × ${cols}`;

        rightBracketWrapper.appendChild(bracketRight);
        rightBracketWrapper.appendChild(dragHandle);
        rightBracketWrapper.appendChild(dimTooltip);

        matrixBody.appendChild(bracketLeft);
        matrixBody.appendChild(gridCenterCol);
        matrixBody.appendChild(rightBracketWrapper);

        gridWrapper.appendChild(matrixBody);

        let startX = 0;
        let startY = 0;
        let startRows = rows;
        let startCols = cols;
        let activeDragEl: HTMLElement | null = null;
        let resizeMode: 'both' | 'cols' | 'rows' = 'both';

        const updateGiacDefinition = () => {
            const curName = nameInput.value.trim().toUpperCase() || 'A';
            const giacMatrix = `[[${cellValues.map((r: string[]) => r.map((c: string) => (c && c.trim()) || '0').join(', ')).join('], [')}]]`;
            const giacDef = `usr_${curName}:=${giacMatrix}`;
            StateManager.giacDefinitions[curName] = giacDef;
            StateManager.casSolutions = {};
            MathEngine.askGiac(giacDef);
        };

        const onPointerMove = (e: PointerEvent) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Cada ~38px horizontal = +1 coluna, cada ~30px vertical = +1 linha
            let targetCols = startCols;
            let targetRows = startRows;

            if (resizeMode === 'both' || resizeMode === 'cols') {
                targetCols = Math.max(1, Math.min(8, startCols + Math.round(dx / 38)));
            }
            if (resizeMode === 'both' || resizeMode === 'rows') {
                targetRows = Math.max(1, Math.min(8, startRows + Math.round(dy / 30)));
            }

            if (targetCols !== cols || targetRows !== rows) {
                const newValues: string[][] = [];
                for (let r = 0; r < targetRows; r++) {
                    newValues[r] = [];
                    for (let c = 0; c < targetCols; c++) {
                        const existing = cellValues[r]?.[c];
                        newValues[r][c] = (existing !== undefined && existing !== null && existing.trim() !== '') ? existing.trim() : '0';
                    }
                }
                rows = targetRows;
                cols = targetCols;
                cellValues = newValues;
                renderGrid();
                dimTooltip.innerText = `${rows} × ${cols}`;
                dimTooltip.classList.add('visible');
                this.onUpdateCallback();
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (activeDragEl) {
                try {
                    activeDragEl.releasePointerCapture(e.pointerId);
                } catch(err) {}
                activeDragEl = null;
            }
            bracketRight.classList.remove('matrix-dragging');
            bottomBorder.classList.remove('matrix-dragging');
            dragHandle.classList.remove('matrix-dragging');
            dimTooltip.classList.remove('visible');
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            updateGiacDefinition();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        const startResize = (mode: 'both' | 'cols' | 'rows') => (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            startRows = rows;
            startCols = cols;
            resizeMode = mode;
            activeDragEl = (e.currentTarget as HTMLElement) || dragHandle;
            try {
                activeDragEl.setPointerCapture(e.pointerId);
            } catch(err) {}
            if (mode === 'both' || mode === 'cols') bracketRight.classList.add('matrix-dragging');
            if (mode === 'both' || mode === 'rows') bottomBorder.classList.add('matrix-dragging');
            dragHandle.classList.add('matrix-dragging');
            dimTooltip.innerText = `${rows} × ${cols}`;
            dimTooltip.classList.add('visible');
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        };

        dragHandle.addEventListener('pointerdown', startResize('both'));
        bracketRight.addEventListener('pointerdown', startResize('cols'));
        rightBracketWrapper.addEventListener('pointerdown', startResize('cols'));
        bottomBorder.addEventListener('pointerdown', startResize('rows'));

        const focusCell = (r: number, c: number) => {
            const target = gridContainer.querySelector(`.matrix-cell[data-r="${r}"][data-c="${c}"]`) as HTMLInputElement;
            if (target) {
                target.focus();
                target.select();
            }
        };

        const renderGrid = () => {
            block.dataset.rows = rows.toString();
            block.dataset.cols = cols.toString();
            dimBadge.innerText = `${rows}×${cols}`;
            dimTooltip.innerText = `${rows} × ${cols}`;
            gridContainer.innerHTML = '';
            gridContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(38px, 1fr))`;

            for (let r = 0; r < rows; r++) {
                if (!cellValues[r]) cellValues[r] = [];
                for (let c = 0; c < cols; c++) {
                    const rawVal = cellValues[r][c];
                    const val = (rawVal !== undefined && rawVal !== null && rawVal.trim() !== '') ? rawVal.trim() : '0';
                    cellValues[r][c] = val;
                    const cell = document.createElement('input');
                    cell.type = 'text';
                    cell.placeholder = '0';
                    cell.className = 'matrix-cell text-center text-xs font-mono font-medium py-1 px-1 rounded border border-gray-200 hover:border-purple-300 focus:border-purple-600 focus:bg-white outline-none transition-all shadow-2xs w-11 h-7.5 bg-white/70';
                    cell.dataset.r = r.toString();
                    cell.dataset.c = c.toString();
                    cell.value = val;

                    cell.onfocus = () => {
                        cell.select();
                    };

                    // Autocomplete instantâneo com 0 quando o usuário apaga (Backspace / Delete)
                    cell.onkeydown = (e: KeyboardEvent) => {
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                            const isAllSelected = (cell.selectionStart === 0 && cell.selectionEnd === cell.value.length);
                            if (isAllSelected || cell.value.length <= 1) {
                                e.preventDefault();
                                cell.value = '0';
                                cellValues[r][c] = '0';
                                cell.select();
                                updateGiacDefinition();
                                this.onUpdateCallback();
                                HistoryManager.recordState(false);
                                return;
                            }
                        } else if (e.key === 'ArrowRight' && cell.selectionStart === cell.value.length) {
                            if (cell.value.trim() === '') { cell.value = '0'; cellValues[r][c] = '0'; }
                            if (c < cols - 1) focusCell(r, c + 1);
                            else if (r < rows - 1) focusCell(r + 1, 0);
                        } else if (e.key === 'ArrowLeft' && cell.selectionEnd === 0) {
                            if (cell.value.trim() === '') { cell.value = '0'; cellValues[r][c] = '0'; }
                            if (c > 0) focusCell(r, c - 1);
                            else if (r > 0) focusCell(r - 1, cols - 1);
                        } else if (e.key === 'ArrowDown') {
                            if (cell.value.trim() === '') { cell.value = '0'; cellValues[r][c] = '0'; }
                            if (r < rows - 1) focusCell(r + 1, c);
                        } else if (e.key === 'ArrowUp') {
                            if (cell.value.trim() === '') { cell.value = '0'; cellValues[r][c] = '0'; }
                            if (r > 0) focusCell(r - 1, c);
                        } else if (e.key === 'Tab') {
                            if (cell.value.trim() === '') { cell.value = '0'; cellValues[r][c] = '0'; }
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (cell.value.trim() === '') {
                                cell.value = '0';
                                cellValues[r][c] = '0';
                            }
                            if (c < cols - 1) {
                                focusCell(r, c + 1);
                            } else if (r < rows - 1) {
                                focusCell(r + 1, 0);
                            } else if (rows < 8) {
                                addRow();
                                setTimeout(() => focusCell(r + 1, 0), 10);
                            }
                        }
                    };

                    cell.oninput = () => {
                        if (cell.value.trim() === '') {
                            cell.value = '0';
                            cellValues[r][c] = '0';
                            cell.select();
                        } else {
                            cellValues[r][c] = cell.value.trim();
                        }
                        updateGiacDefinition();
                        this.onUpdateCallback();
                        HistoryManager.recordState(false);
                    };

                    cell.onblur = () => {
                        if (cell.value.trim() === '') {
                            cell.value = '0';
                            cellValues[r][c] = '0';
                            updateGiacDefinition();
                            this.onUpdateCallback();
                            HistoryManager.recordState(false);
                        }
                    };

                    gridContainer.appendChild(cell);
                }
            }
            updateGiacDefinition();
        };

        const addRow = () => {
            if (rows >= 8) return;
            rows++;
            cellValues.push(new Array(cols).fill('0'));
            renderGrid();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        const delRow = () => {
            if (rows <= 1) return;
            rows--;
            cellValues.pop();
            renderGrid();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        const addCol = () => {
            if (cols >= 8) return;
            cols++;
            cellValues.forEach((row: string[]) => row.push('0'));
            renderGrid();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        const delCol = () => {
            if (cols <= 1) return;
            cols--;
            cellValues.forEach((row: string[]) => row.pop());
            renderGrid();
            this.onUpdateCallback();
            HistoryManager.recordState(true);
        };

        ctrlGroup.appendChild(createCtrlBtn('+L', 'Adicionar Linha (+ Linha)', addRow));
        ctrlGroup.appendChild(createCtrlBtn('-L', 'Remover Linha (- Linha)', delRow));
        ctrlGroup.appendChild(createCtrlBtn('+C', 'Adicionar Coluna (+ Coluna)', addCol));
        ctrlGroup.appendChild(createCtrlBtn('-C', 'Remover Coluna (- Coluna)', delCol));

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        delBtn.className = 'bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-auto transition-all opacity-40 hover:opacity-100 hover:text-red-500 outline-none';
        delBtn.onclick = () => {
            const currentName = nameInput.value.trim().toUpperCase() || defaultName;
            delete StateManager.giacDefinitions[currentName];
            block.remove();
            this.updateBlockNumbers();
            HistoryManager.recordState(true);
            this.onUpdateCallback();
        };

        headerRow.appendChild(nameInput);
        headerRow.appendChild(eqSpan);
        headerRow.appendChild(dimBadge);
        headerRow.appendChild(ctrlGroup);
        headerRow.appendChild(delBtn);
        contentZone.appendChild(headerRow);
        contentZone.appendChild(gridWrapper);

        // Barra de Ações Rápidas de CAS (det, inv, tran, rref, rank, tr)
        const actionsRow = document.createElement('div');
        actionsRow.className = 'flex items-center gap-1 flex-wrap pt-1 border-t border-gray-100';

        const resultDisplay = document.createElement('div');
        resultDisplay.className = 'matrix-res-display w-full text-xs font-semibold text-purple-700 bg-purple-50/70 p-1.5 rounded border border-purple-200 hidden select-text';

        const createCasChip = (label: string, cmd: string, giacCmd: string) => {
            const chip = document.createElement('button');
            chip.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 hover:bg-purple-600 hover:text-white text-gray-700 transition-all cursor-pointer shadow-2xs';
            chip.innerText = label;
            chip.onclick = () => {
                const curName = nameInput.value.trim().toUpperCase() || 'A';
                const giacMatrix = `[[${cellValues.map((r: string[]) => r.map((c: string) => (c && c.trim()) || '0').join(', ')).join('], [')}]]`;
                resultDisplay.innerText = 'Calculando...';
                resultDisplay.classList.remove('hidden');

                MathEngine.askGiac(`${giacCmd}(${giacMatrix})`).then(res => {
                    const cleanRes = res.replace(/"/g, '')
                                        .replace(/matrix\s*\[/g, '[')
                                        .replace(/list\s*\[/g, '[')
                                        .trim();
                    const win = window as any;

                    // Se a resposta for uma matriz, renderiza com colchetes KaTeX
                    const isMatRes = cleanRes.startsWith('[[') && cleanRes.endsWith(']]');
                    if (isMatRes && win.katex) {
                        try {
                            const rowStrings = cleanRes.slice(1, -1).split(/\],\s*\[/);
                            const katexRows = rowStrings.map((r: string) => {
                                const cells = r.replace(/[\[\]]/g, '').split(',').map((c: string) => c.trim());
                                return cells.join(' & ');
                            }).join(' \\\\ ');
                            const katexMatrix = `\\begin{bmatrix} ${katexRows} \\end{bmatrix}`;
                            const html = win.katex.renderToString(`${cmd}(${curName}) = ${katexMatrix}`, { throwOnError: false });
                            resultDisplay.innerHTML = `<div class="flex items-center justify-between"><span>${html}</span><button class="add-as-block-btn text-[10px] text-purple-600 hover:underline cursor-pointer ml-2 shrink-0 font-bold">+ Bloco</button></div>`;
                            const addBlockBtn = resultDisplay.querySelector('.add-as-block-btn');
                            if (addBlockBtn) {
                                addBlockBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    const parsedGrid = rowStrings.map((r: string) => r.replace(/[\[\]]/g, '').split(',').map((c: string) => c.trim()));
                                    this.addMatrix({
                                        rows: parsedGrid.length,
                                        cols: parsedGrid[0]?.length || 1,
                                        data: parsedGrid
                                    });
                                });
                            }
                            return;
                        } catch(e) {}
                    }

                    if (win.katex) {
                        try {
                            const html = win.katex.renderToString(`${cmd}(${curName}) = ${cleanRes}`, { throwOnError: false });
                            resultDisplay.innerHTML = `<div class="flex items-center justify-between"><span>${html}</span><button class="add-as-block-btn text-[10px] text-purple-600 hover:underline cursor-pointer ml-2 shrink-0 font-bold">+ Bloco</button></div>`;
                        } catch(e) {
                            resultDisplay.innerText = `${cmd}(${curName}) = ${cleanRes}`;
                        }
                    } else {
                        resultDisplay.innerText = `${cmd}(${curName}) = ${cleanRes}`;
                    }

                    const addBlockBtn = resultDisplay.querySelector('.add-as-block-btn');
                    if (addBlockBtn) {
                        addBlockBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.addExpression(`${cmd}(${curName})`, true);
                        });
                    }
                });
            };
            return chip;
        };

        actionsRow.appendChild(createCasChip('det', 'Determinant', 'det'));
        actionsRow.appendChild(createCasChip('A⁻¹', 'Invert', 'inv'));
        actionsRow.appendChild(createCasChip('Aᵀ', 'Transpose', 'tran'));
        actionsRow.appendChild(createCasChip('rref', 'ReducedRowEchelonForm', 'rref'));
        actionsRow.appendChild(createCasChip('rank', 'MatrixRank', 'rank'));
        actionsRow.appendChild(createCasChip('tr', 'Trace', 'trace'));

        contentZone.appendChild(actionsRow);
        contentZone.appendChild(resultDisplay);

        block.appendChild(grabZone);
        block.appendChild(contentZone);

        renderGrid();
        updateGiacDefinition();
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
                const firstCell = gridContainer.querySelector('.matrix-cell') as HTMLInputElement;
                if (firstCell) firstCell.focus();
            }, 20);
        }

        return blockId;
    }

    /**
     * Converte instantaneamente um bloco de expressão em um bloco de Matriz Visual Interativa (Desmos style)
     */
    static convertBlockToMatrix(blockId: string, name?: string): string | null {
        const targetBlock = document.getElementById(blockId);
        if (!targetBlock) return null;
        const folderId = targetBlock.dataset.folderId;
        const mid = this.addMatrix({ name: name || this.getNextMatrixName() }, true, folderId, targetBlock);
        this.updateBlockNumbers();
        this.onUpdateCallback();
        HistoryManager.recordState(true);
        return mid;
    }

    static addTable(
        tableData?: { xCol?: string; yCol?: string; rows?: { x: string; y: string }[]; connectLines?: boolean },
        autoFocus: boolean = true,
        folderId?: string
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
        grabZone.className = 'w-12 bg-white flex flex-col items-center justify-start pt-[14px] shrink-0 select-none text-gray-500 gap-1.5';

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
        delBtn.className = 'bg-transparent border-none text-gray-400 cursor-pointer p-1 shrink-0 ml-2 transition-all opacity-40 hover:opacity-100 hover:text-red-500 outline-none';
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
        this.container.appendChild(block);
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

    static addFolder(title: string = 'Nova Pasta', autoFocus: boolean = true): string {
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
        this.container.appendChild(block);

        this.updateBlockNumbers();

        if (autoFocus) setTimeout(() => titleInput.focus(), 15);
        return folderId;
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
                const name = nameInput ? nameInput.value.trim().toUpperCase() : 'A';
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
                    rawAscii: `${name} = ${giacMatrix}`,
                    visible,
                    color,
                    lineStyle,
                    lineWidth,
                    isMatrix: true,
                    matrixName: name
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
                const ascii = mf.getValue('ascii-math');
                const latex = mf.getValue('latex');
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
        const numberSpan = block.querySelector('.block-number') as HTMLElement;
        const warningTrigger = block.querySelector('.block-warning-trigger') as HTMLElement;
        const visibilityBtn = block.querySelector('.visibility-toggle') as HTMLElement;
        const tooltipEl = block.querySelector('.warning-popover-tooltip') as HTMLElement;

        if (errorMsg) {
            if (numberSpan) numberSpan.style.display = 'none';
            if (warningTrigger) {
                warningTrigger.classList.remove('hidden');
                if (tooltipEl) tooltipEl.innerText = errorMsg;
            }
            if (visibilityBtn) {
                visibilityBtn.style.borderColor = '#d97706';
                visibilityBtn.style.background = '#fef3c7';
            }
        } else {
            if (numberSpan) numberSpan.style.display = '';
            if (warningTrigger) {
                warningTrigger.classList.add('hidden');
                if (tooltipEl) tooltipEl.innerText = '';
            }
            if (visibilityBtn) {
                const curColor = block.dataset.color || '#2d70b3';
                const isVisible = visibilityBtn.dataset.visible === 'true';
                visibilityBtn.style.borderColor = curColor;
                visibilityBtn.style.background = isVisible ? `${curColor}20` : 'transparent';
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
            
            // Prevent sliders for reserved variables and coordinates
            if (['x', 'y', 'e', 'pi'].includes(varName)) {
                sliderRow.style.display = 'none';
                return false;
            }

            const rightSide = assignmentMatch[2];
            
            // Só inibe o slider se o lado direito contiver as variáveis independentes x ou y (como palavras isoladas)
            if (/\b[xy]\b/.test(rightSide)) {
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
                resDisplay.classList.remove('hidden');
                resDisplay.title = result;
                const win = window as any;

                let mathStr = result.trim();
                if (mathStr.startsWith('= ')) mathStr = mathStr.substring(2);
                mathStr = mathStr.replace(/^matrix\s*\[/g, '[').replace(/^list\s*\[/g, '[');

                // Detectar se o resultado é uma matriz: [[1, 2], [3, 4]]
                const matrixMatch = mathStr.match(/^\[\s*\[(.*)\]\s*\]$/);
                if (matrixMatch && win.katex) {
                    try {
                        const rowStrings = mathStr.slice(1, -1).split(/\],\s*\[/);
                        const katexRows = rowStrings.map((r: string) => {
                            const cells = r.replace(/[\[\]]/g, '').split(',').map((c: string) => c.trim());
                            return cells.join(' & ');
                        }).join(' \\\\ ');
                        const katexMatrix = `\\begin{bmatrix} ${katexRows} \\end{bmatrix}`;
                        const html = win.katex.renderToString(katexMatrix, { throwOnError: false });
                        resDisplay.innerHTML = `<div class="flex items-center justify-between"><span>= ${html}</span><button class="add-as-block-btn text-[10px] text-purple-600 hover:underline cursor-pointer ml-2 shrink-0 font-bold" title="Adicionar como novo bloco de matriz">+ Bloco</button></div>`;
                        const addBlockBtn = resDisplay.querySelector('.add-as-block-btn');
                        if (addBlockBtn) {
                            addBlockBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const parsedGrid = rowStrings.map((r: string) => r.replace(/[\[\]]/g, '').split(',').map((c: string) => c.trim()));
                                this.addMatrix({
                                    rows: parsedGrid.length,
                                    cols: parsedGrid[0]?.length || 1,
                                    data: parsedGrid
                                });
                            });
                        }
                        return;
                    } catch(e) {}
                }

                if (win.katex && !mathStr.includes('Erro') && !mathStr.includes('indefinido') && !mathStr.includes('carregar')) {
                    try {
                        const html = win.katex.renderToString(mathStr, { throwOnError: false });
                        resDisplay.innerHTML = '= <span style="display:inline-block; vertical-align: middle;">' + html + '</span>';
                    } catch(e) {
                        resDisplay.innerText = `= ${mathStr}`;
                    }
                } else {
                    resDisplay.innerText = `= ${mathStr}`;
                }
            }
        }
    }
}