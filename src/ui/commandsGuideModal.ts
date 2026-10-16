export interface CommandDoc {
    id: string;
    category: 'calculo' | 'integrais' | 'algebra' | 'funcoes' | 'estatistica';
    name: string;
    syntax: string;
    example: string;
    description: string;
    shortcut?: string;
}

export const COMMANDS_DATA: CommandDoc[] = [
    // 1. CÁLCULO & DERIVADAS
    {
        id: 'diff',
        category: 'calculo',
        name: 'Derivada Simbólica',
        syntax: 'd/dx(f(x)) ou diff(f(x), x)',
        example: 'd/dx(x^3 - 3x)',
        description: 'Calcula a derivada de primeira ordem da expressão em relação a x. Digite "d/dx" ou "diff" para conversão automática.',
        shortcut: 'd/dx ou diff'
    },
    {
        id: 'prime',
        category: 'calculo',
        name: 'Notação de Linha / Plica',
        syntax: "f'(x) ou y'",
        example: "f(x) = x^3; f'(x)",
        description: 'Derivada usando apóstrofo (\') para funções previamente definidas. Suporta derivadas de ordem superior (f\'\', f\'\'\').',
        shortcut: "'"
    },
    {
        id: 'limit',
        category: 'calculo',
        name: 'Limite',
        syntax: 'limit(f(x), x, a) ou \\lim',
        example: 'limit(sin(x)/x, x, 0)',
        description: 'Calcula o limite da função quando a variável se aproxima de um ponto específico. Digite "lim" para atalho.',
        shortcut: 'lim ou limit'
    },
    {
        id: 'slopefield',
        category: 'calculo',
        name: 'Campo de Direções (EDO)',
        syntax: 'campo(y\') ou slopefield(f(x, y))',
        example: 'campo(x - y)',
        description: 'Plota visualmente no gráfico o campo de direções / inclinações de equações diferenciais ordinárias dy/dx = f(x, y).',
        shortcut: 'campo ou slopefield'
    },
    {
        id: 'solveode',
        category: 'calculo',
        name: 'Resolução de EDO',
        syntax: "edo(y' = f(x, y)) ou solveode(...)",
        example: "edo(y' = -2y)",
        description: 'Calcula a solução analítica geral ou particular de equações diferenciais ordinárias de 1ª e 2ª ordem.',
        shortcut: 'edo ou solveode'
    },
    {
        id: 'taylor',
        category: 'calculo',
        name: 'Polinômio de Taylor',
        syntax: 'taylor(f(x), x, ponto, ordem)',
        example: 'taylor(cos(x), x, 0, 4)',
        description: 'Gera a expansão em série/polinômio de Taylor em torno de um ponto até a ordem desejada.'
    },

    // 2. INTEGRAIS
    {
        id: 'int_indef',
        category: 'integrais',
        name: 'Integral Indefinida',
        syntax: 'int f(x) dx ou \\int f(x) dx',
        example: '\\int (x^2 + 2x) dx',
        description: 'Calcula a antiderivada simbólica da função com constante de integração (+ C). Digite "int" para o símbolo imediato.',
        shortcut: 'int'
    },
    {
        id: 'int_def',
        category: 'integrais',
        name: 'Integral Definida',
        syntax: '\\int_a^b f(x) dx ou defint_a^b f(x) dx',
        example: '\\int_1^2 x dx',
        description: 'Calcula o valor numérico exato (fração) e decimal da área sob a curva f(x) de a até b. Digite "defint" para limites rápidos.',
        shortcut: 'defint ou \\int_a^b'
    },
    {
        id: 'int_unit',
        category: 'integrais',
        name: 'Integral de Diferencial',
        syntax: '\\int dx ou \\int_a^b dx',
        example: '\\int_0^3 dx',
        description: 'Calcula a integral quando o integrando é 1 implícito. Avalia com precisão tanto indefinida quanto definida.',
        shortcut: '\\int dx'
    },
    {
        id: 'int_between',
        category: 'integrais',
        name: 'Área Entre Duas Curvas',
        syntax: 'integralbetween(f, g, a, b)',
        example: 'integralbetween(x, x^2, 0, 1)',
        description: 'Calcula a área da região delimitada entre as funções f(x) e g(x) no intervalo de a até b.'
    },

    // 3. MATRIZES & ÁLGEBRA LINEAR
    {
        id: 'matrix_create',
        category: 'algebra',
        name: 'Criar Matriz Interativa',
        syntax: 'matrix, matriz ou #linhasxcolunas',
        example: 'A = #22 ou B = matrix',
        description: 'Abre o editor interativo de matriz em grade. Atalho Desmos ultra-rápido: digite "#22" para 2x2, "#33" para 3x3, "#13" para 1x3, etc.',
        shortcut: 'matrix, matriz, #22, #33'
    },
    {
        id: 'det',
        category: 'algebra',
        name: 'Determinante',
        syntax: 'det(A)',
        example: 'det(A)',
        description: 'Calcula o determinante escalar da matriz quadrada definida A. Digite "det" para formatação automática.',
        shortcut: 'det'
    },
    {
        id: 'rref',
        category: 'algebra',
        name: 'Forma Escalonada Reduzida (RREF)',
        syntax: 'rref(A)',
        example: 'rref(A)',
        description: 'Aplica a eliminação de Gauss-Jordan retornando a forma escalonada reduzida por linhas da matriz.',
        shortcut: 'rref'
    },
    {
        id: 'trace',
        category: 'algebra',
        name: 'Traço da Matriz',
        syntax: 'trace(A) ou tr(A)',
        example: 'trace(A)',
        description: 'Calcula a soma dos elementos da diagonal principal da matriz quadrada.',
        shortcut: 'trace ou tr'
    },
    {
        id: 'rank',
        category: 'algebra',
        name: 'Posto da Matriz (Rank)',
        syntax: 'rank(A)',
        example: 'rank(A)',
        description: 'Determina a dimensão do espaço gerado pelas linhas/colunas (número de linhas linearmente independentes).',
        shortcut: 'rank'
    },
    {
        id: 'inv',
        category: 'algebra',
        name: 'Matriz Inversa',
        syntax: 'A^{-1}, A^-1 ou inv(A)',
        example: 'A^{-1}',
        description: 'Calcula a matriz inversa de A tal que A * A^{-1} = I. Digite "^-1" diretamente após a matriz no modelo Desmos.',
        shortcut: 'A^{-1} ou inv(A)'
    },
    {
        id: 'transpose',
        category: 'algebra',
        name: 'Matriz Transposta',
        syntax: "A^T, A' ou tran(A)",
        example: 'A^T',
        description: 'Troca as linhas pelas colunas da matriz A. Suporta notação sobrescrita A^T, plica A\' ou função tran(A).',
        shortcut: "A^T ou A'"
    },
    {
        id: 'matrix_ops',
        category: 'algebra',
        name: 'Operações com Matrizes',
        syntax: 'A + B, A - B, 2A, A * B',
        example: '2A + 3B',
        description: 'Combinações lineares e multiplicação matricial direta. Multiplicação por escalar aceita notação implícita (ex: 2A).',
        shortcut: 'A + B, 2A, A*B'
    },
    {
        id: 'eigen',
        category: 'algebra',
        name: 'Autovalores e Autovetores',
        syntax: 'eigenvalues(A) / eigenvectors(A)',
        example: 'eigenvalues(A)',
        description: 'Calcula os autovalores (valores próprios) e autovetores da transformação linear associada à matriz.'
    },
    {
        id: 'vectors',
        category: 'algebra',
        name: 'Produto Vetorial e Escalar',
        syntax: 'cross(u, v) / dot(u, v)',
        example: 'cross([1, 0, 0], [0, 1, 0])',
        description: 'Calcula produto vetorial (cross product no R³) e produto interno/escalar (dot product) entre vetores.'
    },

    // 4. FUNÇÕES & TRIGONOMETRIA
    {
        id: 'trig',
        category: 'funcoes',
        name: 'Trigonometria Básica',
        syntax: 'sin(x), cos(x), tan(x)',
        example: 'sin(2x) + cos(x)',
        description: 'Funções seno, cosseno e tangente com suporte a radianos e conversão fluida do teclado.',
        shortcut: 'sin, cos, tan'
    },
    {
        id: 'recip_trig',
        category: 'funcoes',
        name: 'Trigonométricas Recíprocas',
        syntax: 'sec(x), csc(x), cot(x)',
        example: 'sec(x)^2',
        description: 'Secante, cossecante e cotangente com visualização de descontinuidades e assíntotas.',
        shortcut: 'sec, csc, cot'
    },
    {
        id: 'inv_trig',
        category: 'funcoes',
        name: 'Trigonométricas Inversas',
        syntax: 'arcsin(x), arccos(x), arctan(x)',
        example: 'arctan(x)',
        description: 'Funções trigonométricas inversas (arco seno, arco cosseno e arco tangente).',
        shortcut: 'arcsin, arccos, arctan'
    },
    {
        id: 'roots',
        category: 'funcoes',
        name: 'Raízes e Radicais',
        syntax: 'sqrt(x), cbrt(x), nthroot(n, x)',
        example: 'sqrt(x + 4)',
        description: 'Raiz quadrada (atalho "sqrt"), cúbica ("cbrt") e n-ésima ("nthroot") com plotagem de ramos reais.',
        shortcut: 'sqrt, cbrt'
    },
    {
        id: 'logs',
        category: 'funcoes',
        name: 'Logaritmos e Exponenciais',
        syntax: 'ln(x), log(x), log_b(x), e^x',
        example: 'ln(x^2 + 1)',
        description: 'Logaritmo natural (base e), logaritmo na base 10 ou com base personalizada subscrita log_2(x).',
        shortcut: 'ln, log'
    },
    {
        id: 'abs',
        category: 'funcoes',
        name: 'Valor Absoluto / Módulo',
        syntax: '|x| ou abs(x)',
        example: '|x - 2| + 1',
        description: 'Módulo de um número ou expressão. Digite a tecla | ou a função abs(x).',
        shortcut: '| ou abs'
    },
    {
        id: 'domain_restriction',
        category: 'funcoes',
        name: 'Restrição de Domínio',
        syntax: 'f(x) {condição}',
        example: 'y = x^2 {x >= 0}',
        description: 'Limita o traçado da função apenas à região especificada entre chaves {}. Ex: {x > 0}, {0 <= x <= 2pi}.',
        shortcut: '{condição}'
    },

    // 5. ESTATÍSTICA, SOMATÓRIOS & LISTAS
    {
        id: 'sum',
        category: 'estatistica',
        name: 'Somatório (Notação Sigma)',
        syntax: '\\sum_{n=a}^b expr ou sum(...)',
        example: '\\sum_{n=1}^{10} n',
        description: 'Calcula o somatório finito de uma expressão indexada de n=a até b. Digite "sum" para o modelo Desmos.',
        shortcut: 'sum'
    },
    {
        id: 'prod',
        category: 'estatistica',
        name: 'Produtório (Notação Pi)',
        syntax: '\\prod_{n=a}^b expr ou product(...)',
        example: '\\prod_{n=1}^{5} n',
        description: 'Calcula o produto consecutivo de termos indexados de n=a até b. Digite "prod" para atalho.',
        shortcut: 'prod'
    },
    {
        id: 'stats_mean',
        category: 'estatistica',
        name: 'Média e Mediana',
        syntax: 'mean(L), median(L)',
        example: 'mean([2, 4, 6, 8, 10])',
        description: 'Média aritmética e valor mediano de um conjunto de dados ou lista numérica.',
        shortcut: 'mean, median'
    },
    {
        id: 'stats_variance',
        category: 'estatistica',
        name: 'Variância e Desvio Padrão',
        syntax: 'variance(L), stdev(L), samplesd(L)',
        example: 'variance([1, 2, 3, 4, 5])',
        description: 'Medidas de dispersão estatística de distribuições e conjuntos de dados numéricos.'
    },
    {
        id: 'lists_ops',
        category: 'estatistica',
        name: 'Listas e Vetores',
        syntax: 'L = [1, 2, 3, 4], length(L)',
        example: 'L = [1, 3, 5, 7]; length(L)',
        description: 'Definição de listas numéricas entre colchetes, acesso indexado L_1 e operações agregadas.'
    }
];

export class CommandsGuideModal {
    private static modalEl: HTMLElement | null = null;
    private static activeCategory: string = 'all';
    private static searchQuery: string = '';
    private static onInsertCallback: ((expr: string) => void) | null = null;

    static init(onInsertExpression?: (expr: string) => void) {
        if (onInsertExpression) this.onInsertCallback = onInsertExpression;
        if (typeof document === 'undefined') return;
        if (this.modalEl) return;

        const modal = document.createElement('div');
        modal.id = 'commands-guide-modal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] hidden flex-col items-center justify-center p-3 md:p-6 select-none transition-all duration-200';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden text-gray-800">
                <!-- Header -->
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md font-bold text-lg">
                            ∑
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                                Guia de Comandos & Funções
                                <span class="text-[11px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Modelo Desmos</span>
                            </h2>
                            <p class="text-xs text-gray-500">Digite comandos naturalmente no teclado para conversão matemática instantânea</p>
                        </div>
                    </div>
                    <button id="close-guide-btn" class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer" title="Fechar (Esc)">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <!-- Barra de Pesquisa e Filtros -->
                <div class="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    <div class="relative flex-1">
                        <input id="guide-search-input" type="text" placeholder="Pesquisar comando, atalho ou exemplo (ex: int, defint, det, matrix)..."
                            class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs" />
                        <svg class="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>

                    <!-- Category Pills -->
                    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-semibold">
                        <button data-cat="all" class="guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-blue-600 text-white shadow-xs cursor-pointer">Todos</button>
                        <button data-cat="calculo" class="guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">Cálculo</button>
                        <button data-cat="integrais" class="guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">Integrais</button>
                        <button data-cat="algebra" class="guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">Matrizes & Álgebra</button>
                        <button data-cat="funcoes" class="guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">Trigonometria</button>
                        <button data-cat="estatistica" class="guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer">Estatística & Listas</button>
                    </div>
                </div>

                <!-- Lista de Comandos com Scroll -->
                <div id="guide-commands-list" class="flex-1 overflow-y-auto p-5 space-y-3 bg-white">
                </div>

                <!-- Footer com Dicas e Atalhos -->
                <div class="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-mono text-[10px]">Esc</span>
                        <span>para fechar</span>
                        <span class="hidden md:inline">• Clique em qualquer exemplo para copiá-lo</span>
                    </div>
                    <div class="font-medium text-blue-600">
                        Motorzao Calculator
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modalEl = modal;

        // Listeners
        const closeBtn = modal.querySelector('#close-guide-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.hide();
            }
        });

        const searchInput = modal.querySelector('#guide-search-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value.toLowerCase().trim();
                this.renderList(this.onInsertCallback || undefined);
            });
        }

        const catBtns = modal.querySelectorAll('.guide-cat-btn');
        catBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                catBtns.forEach(b => {
                    b.className = 'guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 cursor-pointer';
                });
                btn.className = 'guide-cat-btn px-3 py-1.5 rounded-lg transition-all bg-blue-600 text-white shadow-xs cursor-pointer';
                this.activeCategory = (btn as HTMLElement).dataset.cat || 'all';
                this.renderList(this.onInsertCallback || undefined);
            });
        });

        this.renderList(this.onInsertCallback || undefined);
    }

    static show() {
        if (!this.modalEl) this.init();
        if (this.modalEl) {
            this.modalEl.classList.remove('hidden');
            this.modalEl.classList.add('flex');
            const searchInput = this.modalEl.querySelector('#guide-search-input') as HTMLInputElement;
            if (searchInput) {
                searchInput.value = '';
                this.searchQuery = '';
                setTimeout(() => searchInput.focus(), 50);
            }
            this.renderList(this.onInsertCallback || undefined);
        }
    }

    static hide() {
        if (this.modalEl) {
            this.modalEl.classList.add('hidden');
            this.modalEl.classList.remove('flex');
        }
    }

    private static getCategoryBadge(cat: string): { label: string; color: string } {
        switch (cat) {
            case 'calculo': return { label: 'Cálculo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
            case 'integrais': return { label: 'Integrais', color: 'bg-blue-100 text-blue-800 border-blue-200' };
            case 'algebra': return { label: 'Álgebra & Matrizes', color: 'bg-purple-100 text-purple-800 border-purple-200' };
            case 'funcoes': return { label: 'Trigonometria & Funções', color: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'estatistica': return { label: 'Estatística & Séries', color: 'bg-rose-100 text-rose-800 border-rose-200' };
            default: return { label: 'Geral', color: 'bg-gray-100 text-gray-800 border-gray-200' };
        }
    }

    private static renderList(onInsert?: (expr: string) => void) {
        if (!this.modalEl) return;
        const listEl = this.modalEl.querySelector('#guide-commands-list');
        if (!listEl) return;

        const filtered = COMMANDS_DATA.filter(cmd => {
            const matchesCat = this.activeCategory === 'all' || cmd.category === this.activeCategory;
            if (!matchesCat) return false;

            if (!this.searchQuery) return true;
            const q = this.searchQuery;
            return cmd.name.toLowerCase().includes(q) ||
                   cmd.syntax.toLowerCase().includes(q) ||
                   cmd.example.toLowerCase().includes(q) ||
                   cmd.description.toLowerCase().includes(q) ||
                   (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q));
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center text-center text-gray-400">
                    <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="font-semibold text-gray-600 text-sm">Nenhum comando encontrado para "${this.searchQuery}"</p>
                    <p class="text-xs text-gray-400 mt-1">Tente buscar por "int", "det", "d/dx", "matrix" ou selecione "Todos".</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(cmd => {
            const badge = this.getCategoryBadge(cmd.category);
            return `
                <div class="border border-gray-200 rounded-xl p-3.5 hover:border-blue-300 hover:shadow-xs transition-all bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div class="flex-1 space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-gray-900 text-sm">${cmd.name}</span>
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}">${badge.label}</span>
                            ${cmd.shortcut ? `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">Atalho: ${cmd.shortcut}</span>` : ''}
                        </div>
                        <p class="text-xs text-gray-600 leading-relaxed">${cmd.description}</p>
                        <div class="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            <span class="font-semibold text-gray-400">Sintaxe:</span>
                            <code class="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded font-mono text-gray-700 text-[11px]">${cmd.syntax}</code>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                        <button class="guide-example-pill px-3 py-1.5 bg-blue-50/80 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="Copiar exemplo"
                                data-example="${cmd.example}">
                            <span>Ex: ${cmd.example}</span>
                            <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Wire up example click buttons
        const exampleBtns = listEl.querySelectorAll('.guide-example-pill');
        exampleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ex = (btn as HTMLElement).dataset.example || '';
                if (onInsert) {
                    onInsert(ex);
                    this.hide();
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(ex);
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `<span class="text-emerald-600 font-bold">Copiado! ✓</span>`;
                    setTimeout(() => { btn.innerHTML = originalText; }, 1200);
                }
            });
        });
    }
}
