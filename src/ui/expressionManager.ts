import { StateManager } from '../core/stateManager';
import { MathEngine } from '../core/mathEngine';
import { PrattParser } from '../core/prattParser';

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

    static init(onUpdate: () => void) {
        this.autocompleteDiv.style.cssText = 'position: absolute; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: sans-serif; font-size: 12px; z-index: 9999; display: none; padding: 5px; max-height: 200px; overflow-y: auto; width: 300px; text-align: left;';
        document.body.appendChild(this.autocompleteDiv);

        this.onUpdateCallback = onUpdate;
        this.addBtn.addEventListener('click', () => {
            this.addBlock();
            this.updateBlockNumbers();
        });
        this.addBlock();
        this.updateBlockNumbers();
    }

    /**
     * Atualiza a numeração lateral (1, 2, 3...) de todos os blocos na tela
     */
    static updateBlockNumbers() {
        const blocks = Array.from(this.container.children);
        blocks.forEach((block: any, index) => {
            const numSpan = block.querySelector('.block-number');
            if (numSpan) numSpan.innerText = (index + 1).toString();
        });
    }

    static addBlock(autoFocus: boolean = true): string {
        this.blockCounter++;
        const blockId = 'expr-block-' + this.blockCounter;

        const block = document.createElement('div');
        block.id = blockId;
        block.className = 'flex border-b border-gray-100 bg-white transition-colors duration-200 relative group';

        const grabZone = document.createElement('div');
        grabZone.className = 'w-12 bg-white flex flex-col items-center justify-start pt-[14px] shrink-0 select-none text-gray-500 gap-1.5';
        
        const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19'];
        const colorIndex = Array.from(this.container.children).length % colors.length;
        const blockColor = colors[colorIndex];
        block.dataset.color = blockColor;

          const visibilityBtn = document.createElement('div');
          visibilityBtn.className = 'visibility-toggle';
          visibilityBtn.dataset.visible = 'true';
          visibilityBtn.title = 'Mostrar / Esconder';
          // Desmos-style circle
          visibilityBtn.style.cssText = `width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${blockColor}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; background: ${blockColor}20;`;
          
          const numberSpan = document.createElement('span');
          numberSpan.className = 'block-number';
          numberSpan.style.cssText = `font-size: 14px; font-weight: bold; color: ${blockColor}; cursor: grab;`;
          numberSpan.innerText = this.blockCounter.toString();
          
          visibilityBtn.appendChild(numberSpan);
          
                  visibilityBtn.onclick = () => {
            const isVisible = visibilityBtn.dataset.visible === 'true';
            visibilityBtn.dataset.visible = isVisible ? 'false' : 'true';
            const currentColor = block.dataset.color || blockColor;
            visibilityBtn.style.background = isVisible ? 'transparent' : `${currentColor}20`;
            visibilityBtn.style.borderStyle = isVisible ? 'dashed' : 'solid';
            numberSpan.style.opacity = isVisible ? '0.3' : '1';
            this.onUpdateCallback();
        };

        visibilityBtn.oncontextmenu = (e) => {
            e.preventDefault();
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = block.dataset.color || blockColor;
            colorInput.style.position = 'absolute';
            colorInput.style.opacity = '0';
            document.body.appendChild(colorInput);
            colorInput.focus();
            colorInput.click();
            
            colorInput.onchange = () => {
                const newColor = colorInput.value;
                block.dataset.color = newColor;
                const isVisible = visibilityBtn.dataset.visible === 'true';
                visibilityBtn.style.borderColor = newColor;
                visibilityBtn.style.background = isVisible ? `${newColor}20` : 'transparent';
                numberSpan.style.color = newColor;
                this.onUpdateCallback();
                document.body.removeChild(colorInput);
            };
        };
          
          grabZone.appendChild(visibilityBtn);

        // --- ÁREA DE CONTEÚDO (Matemática + Slider) ---
        const contentZone = document.createElement('div');
        contentZone.className = 'flex flex-col grow overflow-hidden';
        const topRow = document.createElement('div');
        topRow.className = 'flex items-start px-2 py-3 gap-2 overflow-hidden min-h-[56px]';

        const mathContainer = document.createElement('div');
        mathContainer.className = 'flex flex-col grow overflow-hidden pt-1';

        const mf = document.createElement('math-field');
        mf.className = 'border-none outline-none text-lg bg-transparent w-full';
        
        const resultSpan = document.createElement('div');
        resultSpan.className = 'result-display text-gray-400 text-sm font-semibold overflow-x-auto w-full shrink text-left mt-1 hidden select-text';

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i data-lucide="x" class="w-5 h-5"></i>';
        delBtn.className = 'bg-transparent border-none text-gray-400 cursor-pointer text-base py-1 px-3 shrink-0 ml-auto transition-all opacity-40 hover:opacity-100 hover:text-gray-800 outline-none';

        mathContainer.appendChild(mf);
        mathContainer.appendChild(resultSpan);

        topRow.appendChild(mathContainer);
        topRow.appendChild(delBtn);
        contentZone.appendChild(topRow);

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
            'int': '\\int',
            'limit': '\\lim',
            'lim': '\\lim',
            'e': 'e',
            'sqrt': '\\sqrt',
            '<=': '\\le',
            '>=': '\\ge'
        };
        const currentBindings = mathField.keybindings || [];
        mathField.keybindings = [
            { key: '/', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '[Slash]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '[NumpadDivide]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] },
            { key: '^', ifMode: 'math', command: 'moveToSuperscript' },
            { key: 'shift+[Digit6]', ifMode: 'math', command: 'moveToSuperscript' },
            ...currentBindings
        ];
        mathField.style.setProperty('--contains-highlight-background', 'transparent');
        mathField.style.setProperty('--highlight-background', 'transparent');
        mathField.style.setProperty('--highlight-color', 'transparent');
        mathField.style.setProperty('--placeholder-color', 'transparent');
        mathField.style.setProperty('--placeholder-opacity', '0');
        mathField.style.setProperty('--selection-background-color', 'rgba(180, 200, 255, 0.4)');

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
            this.showAutocomplete(mf);
            this.onUpdateCallback();
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
            }
        });

        // --- FÍSICA CUSTOMIZADA DO DRAG AND DROP (DESMOS STYLE) ---
        // Aqui o bloco inteiro flutua suavemente sobre os outros!
        grabZone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            grabZone.style.cursor = 'grabbing';
            block.classList.add('bg-blue-50', 'shadow-md', 'z-50'); // Azul igual do Desmos!
            // handled by tailwind
            block.style.position = 'relative';
            block.style.zIndex = '1000';

            let startY = e.clientY;
            let currentTranslate = 0;

            const onMove = (moveEvent: PointerEvent) => {
                currentTranslate = moveEvent.clientY - startY;
                block.style.transform = `translateY(${currentTranslate}px)`;

                const blocks = Array.from(this.container.children) as HTMLElement[];
                const index = blocks.indexOf(block);

                // Lógica que troca os elementos de lugar no DOM dinamicamente
                if (currentTranslate > block.offsetHeight / 2 && index < blocks.length - 1) {
                    const nextBlock = blocks[index + 1];
                    this.container.insertBefore(nextBlock, block);
                    startY += nextBlock.offsetHeight; // Compensa a altura para o mouse não pular
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
                block.style.backgroundColor = '';
                block.style.boxShadow = '';
                block.style.position = '';
                block.style.zIndex = '';
                block.style.transform = '';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                this.onUpdateCallback();
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        if (autoFocus) setTimeout(() => mf.focus(), 10);
        return blockId;
    }

    static addExpression(asciiValue: string, autoFocus: boolean = false): string {
        const blockId = this.addBlock(autoFocus);
        const block = document.getElementById(blockId);
        if (block) {
            const mf = block.querySelector('math-field');
            if (mf) {
                (mf as any).setValue(asciiValue, { suppressChangeNotifications: true });
            }
        }
        this.updateBlockNumbers();
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

    static getAllExpressions(): {id: string, rawAscii: string, visible: boolean, color: string}[] {
        const blocks = Array.from(this.container.children);
        const exprs: {id: string, rawAscii: string, visible: boolean, color: string}[] = [];
        blocks.forEach((block: any) => {
            const mf = block.querySelector('math-field');
            const visBtn = block.querySelector('.visibility-toggle');
            if (mf) {
                const ascii = mf.getValue('ascii-math');
                const visible = visBtn ? (visBtn as HTMLElement).dataset.visible === 'true' : true;
                const color = block.dataset.color || '#000000';
                if (ascii) exprs.push({ id: block.id, rawAscii: ascii, visible, color });
            }
        });
        return exprs;
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
                if (!result) {
                    resDisplay.classList.add('hidden');
                } else {
                    resDisplay.classList.remove('hidden');
                    resDisplay.title = result;
                    const win = window as any;
                    if (win.katex && result.startsWith('= ')) {
                        try {
                            const mathStr = result.substring(2);
                            if (mathStr.includes('Erro') || mathStr.includes('indefinido') || mathStr.includes('carregar')) {
                                resDisplay.innerText = result;
                            } else {
                                const html = win.katex.renderToString(mathStr, { throwOnError: false });
                                resDisplay.innerHTML = '= <span style="display:inline-block; vertical-align: middle;">' + html + '</span>';
                            }
                        } catch(e) {
                            resDisplay.innerText = result;
                        }
                    } else {
                        resDisplay.innerText = result;
                    }
                }
            }
        }
    }
}