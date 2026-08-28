import { SymbolTable } from '../core/symbolTable';
import { PrattParser } from '../core/prattParser';

export class HUD {
    static draggedSlider: HTMLElement | null = null;

    static createSlider(name: string, min: string | number, max: string | number, value: number, onUpdate: () => void, onDelete: (name: string) => void) {
        const container = document.getElementById('sliders-container')!;
        
        const wrapper = document.createElement('div');
        wrapper.draggable = true;
        wrapper.style.cssText = 'background: #fff; padding: 12px; margin-bottom: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #ddd; transition: all 0.2s;';
        
        // MUDANÇA: Os inputs de Min e Max agora são do tipo "text" para aceitar equações
        wrapper.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #aaa; cursor: grab; font-size: 16px; user-select: none;" class="drag-handle">⠿</span>
                    <span style="font-weight: bold; color: #333; font-style: italic;">${name} = <span id="val_${name}">${value}</span></span>
                </div>
                <button id="del_${name}" style="background: none; border: none; color: #ff4444; cursor: pointer; font-size: 14px;">✖</button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" id="min_${name}" value="${min}" style="width: 50px; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 3px;">
                <input type="range" id="slider_${name}" min="${min}" max="${max}" step="0.1" value="${value}" style="flex-grow: 1; cursor: pointer;">
                <input type="text" id="max_${name}" value="${max}" style="width: 50px; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 3px;">
            </div>
        `;
        container.appendChild(wrapper);

        const slider = document.getElementById(`slider_${name}`) as HTMLInputElement;
        const inputMin = document.getElementById(`min_${name}`) as HTMLInputElement;
        const inputMax = document.getElementById(`max_${name}`) as HTMLInputElement;
        const valDisplay = document.getElementById(`val_${name}`) as HTMLSpanElement;
        const delBtn = document.getElementById(`del_${name}`) as HTMLButtonElement;

        delBtn.onclick = () => {
            wrapper.remove();
            SymbolTable.set(name, 0);
            onDelete(name);
        };

        // MUDANÇA: Agora o motor AVALIA a matemática do que você digitou no limite!
        const updateBounds = () => {
            import('../core/mathEngine').then(({ MathEngine }) => {
                const scope = SymbolTable.getAll();
                const astMin = new PrattParser(inputMin.value).parseExpression();
                const astMax = new PrattParser(inputMax.value).parseExpression();
                const evalMin = MathEngine.evaluateAST(astMin, scope);
                const evalMax = MathEngine.evaluateAST(astMax, scope);
                
                if (typeof evalMin === 'number' && !isNaN(evalMin)) slider.min = evalMin.toString();
                if (typeof evalMax === 'number' && !isNaN(evalMax)) slider.max = evalMax.toString();
            });
        };

        inputMin.addEventListener('change', updateBounds);
        inputMax.addEventListener('change', updateBounds);

        SymbolTable.set(name, value);
        
        slider.addEventListener('input', () => {
            const numValue = parseFloat(slider.value);
            valDisplay.innerText = numValue.toFixed(1);
            SymbolTable.set(name, numValue);
            onUpdate();
        });

        // (Física de Drag & Drop continua igual aqui para baixo...)
        wrapper.addEventListener('dragstart', (e) => {
            this.draggedSlider = wrapper;
            e.dataTransfer!.effectAllowed = 'move';
            setTimeout(() => wrapper.style.opacity = '0.4', 0);
        });
        wrapper.addEventListener('dragend', () => {
            wrapper.style.opacity = '1';
            this.draggedSlider = null;
        });
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedSlider || this.draggedSlider === wrapper) return;
            const bounding = wrapper.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
                wrapper.style.borderBottom = '3px solid #2d70b3';
                wrapper.style.borderTop = '1px solid #ddd';
            } else {
                wrapper.style.borderTop = '3px solid #2d70b3';
                wrapper.style.borderBottom = '1px solid #ddd';
            }
        });
        wrapper.addEventListener('dragleave', () => {
            wrapper.style.borderTop = '1px solid #ddd';
            wrapper.style.borderBottom = '1px solid #ddd';
        });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.style.borderTop = '1px solid #ddd';
            wrapper.style.borderBottom = '1px solid #ddd';
            if (!this.draggedSlider || this.draggedSlider === wrapper) return;

            const bounding = wrapper.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
                container.insertBefore(this.draggedSlider, wrapper.nextSibling);
            } else {
                container.insertBefore(this.draggedSlider, wrapper);
            }
        });
    }

    static promptSliders(vars: string[], onAdd: (v: string) => void, onAddAll: () => void) {
        let container = document.getElementById('slider-prompts');
        if (!container) {
            container = document.createElement('div');
            container.id = 'slider-prompts';
            container.style.cssText = 'padding: 10px; background: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 6px; margin-bottom: 15px; font-size: 14px; color: #721c24; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;';
            const sidebar = document.getElementById('sidebar');
            const sliderContainer = document.getElementById('sliders-container');
            sidebar?.insertBefore(container, sliderContainer);
        }

        if (vars.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = `<span style="font-weight: bold;">⚠️ adicionar controle deslizante:</span>`;

        vars.forEach(v => {
            const btn = document.createElement('button');
            btn.innerText = v;
            btn.style.cssText = 'padding: 4px 10px; cursor: pointer; background: #fff; border: 1px solid #ccc; border-radius: 4px; font-weight: bold; font-family: serif;';
            btn.onclick = () => onAdd(v);
            container.appendChild(btn);
        });

        if (vars.length > 1) {
            const btnAll = document.createElement('button');
            btnAll.innerText = 'tudo';
            btnAll.style.cssText = 'padding: 4px 10px; cursor: pointer; background: #3b5998; color: white; border: none; border-radius: 4px; font-weight: bold;';
            btnAll.onclick = onAddAll;
            container.appendChild(btnAll);
        }
    }
}