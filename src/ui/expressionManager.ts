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
        'Invert': ['Invert( <Matriz> )']
    };

    static showAutocomplete(mf: any) {
        const ascii = mf.getValue('ascii-math');
        // Check if cursor is typing a word. Mathlive might have a selection. 
        // We'll just check if the last word typed matches a CAS command prefix.
        const match = ascii.match(/([A-Z][A-Za-z]*)$/);
        
        if (match) {
            const prefix = match[1];
            const suggestions = Object.keys(this.casDocs).filter(k => k.startsWith(prefix));
            
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
                        // Replace the typed prefix with the full command and a parenthesis
                        const newAscii = ascii.substring(0, ascii.length - prefix.length) + cmd + '(';
                        mf.setValue(newAscii, { format: 'ascii-math' });
                        mf.executeCommand(['performWithFeedback', 'moveToMathFieldEnd']);
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

    static addBlock(): string {
        this.blockCounter++;
        const blockId = 'expr-block-' + this.blockCounter;

        const block = document.createElement('div');
        block.id = blockId;
        block.style.cssText = 'display: flex; background: #fff; border-bottom: 1px solid #ccc; transition: background 0.2s, box-shadow 0.2s;';

        // --- ZONA DE CAPTURA E VISIBILIDADE ---
        const grabZone = document.createElement('div');
        grabZone.style.cssText = 'width: 44px; background: #f7f7f7; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; user-select: none; color: #777; gap: 4px;';
        
        const numberSpan = document.createElement('span');
        numberSpan.className = 'block-number';
        numberSpan.style.cssText = 'cursor: grab; font-size: 13px; font-weight: bold; width: 100%; text-align: center; padding: 4px 0;';
        
        const visibilityBtn = document.createElement('div');
        visibilityBtn.className = 'visibility-toggle';
        visibilityBtn.dataset.visible = 'true';
        visibilityBtn.innerHTML = '●'; // Círculo cheio
        visibilityBtn.title = 'Mostrar / Esconder';
        visibilityBtn.style.cssText = 'cursor: pointer; font-size: 16px; opacity: 1; color: #1e88e5; user-select: none; transition: 0.2s; margin-top: -6px;';
        
        visibilityBtn.onclick = () => {
            const isVisible = visibilityBtn.dataset.visible === 'true';
            visibilityBtn.dataset.visible = isVisible ? 'false' : 'true';
            visibilityBtn.innerHTML = isVisible ? '○' : '●'; // Círculo vazio/cheio
            visibilityBtn.style.color = isVisible ? '#ccc' : '#1e88e5';
            this.onUpdateCallback();
        };
        
        grabZone.appendChild(numberSpan);
        grabZone.appendChild(visibilityBtn);

        // --- ÁREA DE CONTEÚDO (Matemática + Slider) ---
        const contentZone = document.createElement('div');
        contentZone.style.cssText = 'display: flex; flex-direction: column; flex-grow: 1; overflow: hidden;';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; align-items: center; padding: 8px; gap: 8px; overflow: hidden;';
        
        const mf = document.createElement('math-field');
        (mf as any).setOptions({
            smartMode: false,
            virtualKeyboardMode: window.innerWidth <= 768 ? 'onfocus' : 'manual',
            menuItems: [], // Remove a barra escura de menu/opções
            inlineShortcuts: {
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
                '>=': '\\ge',
                '/': '\\frac{#@}{#?}'
            }
        });
        mf.style.cssText = 'flex-grow: 1; border: none; outline: none; font-size: 18px; background: transparent;';
        
        const resultSpan = document.createElement('div');
        resultSpan.className = 'result-display';
        resultSpan.style.cssText = 'color: #555; font-size: 14px; font-weight: bold; font-family: math; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%; flex-shrink: 1; text-align: right; margin-right: 5px; cursor: help; user-select: text;';

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.style.cssText = 'background: none; border: none; color: #ff4444; cursor: pointer; font-size: 18px; padding: 0 4px; flex-shrink: 0; margin-left: auto;';
        
        topRow.appendChild(mf);
        topRow.appendChild(resultSpan);
        topRow.appendChild(delBtn);
        contentZone.appendChild(topRow);

        // --- LINHA DO SLIDER ---
        const sliderRow = document.createElement('div');
        sliderRow.className = 'slider-row';
        sliderRow.style.cssText = 'display: none; gap: 8px; align-items: center; padding: 8px 12px; background: #fafafa; border-top: 1px dashed #eee;';
        
        sliderRow.innerHTML = `
            <input type="text" class="min-val" value="-10" style="width: 45px; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
            <input type="range" class="slider-input" min="-10" max="10" step="0.1" value="1" style="flex-grow: 1; cursor: pointer;">
            <input type="text" class="max-val" value="10" style="width: 45px; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
        `;
        contentZone.appendChild(sliderRow);
        
        block.appendChild(grabZone);
        block.appendChild(contentZone);
        this.container.appendChild(block);

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

        // --- EVENTOS BÁSICOS ---
        delBtn.onclick = () => {
            block.remove();
            this.updateBlockNumbers();
            this.onUpdateCallback();
        };

        mf.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addBlock();
                this.updateBlockNumbers();
            }
        });
        mf.addEventListener('input', () => {
            this.showAutocomplete(mf);
            this.onUpdateCallback();
        });
        
        // Esconder autocomplete se perder o foco
        mf.addEventListener('focusout', () => {
            setTimeout(() => { this.autocompleteDiv.style.display = 'none'; }, 200);
        });

        sliderInput.addEventListener('input', () => {
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
            block.style.backgroundColor = '#e8f0fe'; // Azul igual do Desmos!
            block.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)';
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

        setTimeout(() => mf.focus(), 10);
        return blockId;
    }

    static addExpression(asciiValue: string): string {
        const blockId = this.addBlock();
        const block = document.getElementById(blockId);
        if (block) {
            const mf = block.querySelector('math-field');
            if (mf) {
                (mf as any).setValue(asciiValue);
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
                (mf as any).setValue(asciiValue);
            }
        }
    }

    static getAllExpressions(): {id: string, rawAscii: string, visible: boolean}[] {
        const blocks = Array.from(this.container.children);
        const exprs: {id: string, rawAscii: string, visible: boolean}[] = [];
        blocks.forEach((block: any) => {
            const mf = block.querySelector('math-field');
            const visBtn = block.querySelector('.visibility-toggle');
            if (mf) {
                const ascii = mf.getValue('ascii-math');
                const visible = visBtn ? (visBtn as HTMLElement).dataset.visible === 'true' : true;
                if (ascii) exprs.push({ id: block.id, rawAscii: ascii, visible });
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
            
            if (rightSide.includes('x') || rightSide.includes('y')) {
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
                resDisplay.innerText = result;
                resDisplay.title = result; // Adiciona tooltip para textos muito longos
            }
        }
    }
}