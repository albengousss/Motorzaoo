import { ComputeEngine } from '@cortex-js/compute-engine';

export class MathEngine {
    private static ce = new ComputeEngine();
    private static giacWorker: Worker | null = null;
    private static giacCallbacks: Record<string, (result: string) => void> = {};
    private static reqCounter = 0;
    static isGiacReady = false;

    private static initGiacWorker() {
        if (typeof window === 'undefined') return;
        if (this.giacWorker) return;

        try {
            this.giacWorker = new Worker('/giacWorker.js');
            this.giacWorker.onmessage = (e) => {
                const data = e.data;
                if (!data) return;
                if (data.type === 'READY') {
                    console.log('[MathEngine] Giac Worker pronto!');
                    this.isGiacReady = true;
                    return;
                }
                if (data.id && this.giacCallbacks[data.id]) {
                    this.giacCallbacks[data.id](data.result || data.error || '');
                    delete this.giacCallbacks[data.id];
                }
            };
            this.giacWorker.onerror = (err) => {
                console.error('[MathEngine] Erro no Giac Worker:', err);
            };
        } catch (e) {
            console.error('[MathEngine] Falha ao instanciar Giac Worker:', e);
        }
    }

    /**
     * O Método Mágico Assíncrono: Avaliação ultra-rápida e resiliente via Giac WebAssembly!
     */
    static async askGiac(expression: string): Promise<string> {
        const executeOnModule = (m: any): string => {
            try {
                if (typeof m.cwrap === 'function') {
                    const evaluateGiac = m.cwrap('caseval', 'string', ['string']);
                    return evaluateGiac(expression);
                } else if (typeof m._caseval === 'function') {
                    const ptr = m.allocate(m.intArrayFromString(expression), 'i8', 0);
                    const resPtr = m._caseval(ptr);
                    const res = m.UTF8ToString(resPtr);
                    m._free(ptr);
                    return res;
                }
                return 'Erro: Funções de avaliação não encontradas';
            } catch (err: any) {
                return `Erro: ${err?.message || String(err)}`;
            }
        };

        // 1. Execução direta e instantânea na thread principal se o Module estiver pronto
        const m = (typeof window !== 'undefined' ? (window as any).Module : null);
        if (m && (typeof m.cwrap === 'function' || typeof m._caseval === 'function')) {
            return executeOnModule(m);
        }

        // 2. Se o Worker estiver pronto, tenta executar nele com timeout curto de fallback
        this.initGiacWorker();
        if (this.giacWorker && this.isGiacReady) {
            const id = 'giac_' + (++this.reqCounter) + '_' + Date.now();
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    if (this.giacCallbacks[id]) {
                        delete this.giacCallbacks[id];
                        const fallbackM = (typeof window !== 'undefined' ? (window as any).Module : null);
                        if (fallbackM && (typeof fallbackM.cwrap === 'function' || typeof fallbackM._caseval === 'function')) {
                            resolve(executeOnModule(fallbackM));
                        } else {
                            resolve('(A carregar motor matemático... aguarde)');
                        }
                    }
                }, 2000);

                this.giacCallbacks[id] = (res) => {
                    clearTimeout(timer);
                    resolve(res);
                };

                this.giacWorker!.postMessage({ id, query: expression });
            });
        }

        // 3. Polling rápido enquanto o Giac carrega (resolve assim que inicializar)
        return new Promise((resolve) => {
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                const mod = (typeof window !== 'undefined' ? (window as any).Module : null);
                if (mod && (typeof mod.cwrap === 'function' || typeof mod._caseval === 'function')) {
                    clearInterval(poll);
                    resolve(executeOnModule(mod));
                } else if (attempts > 50) { // 10 segundos
                    clearInterval(poll);
                    resolve('(A carregar motor matemático... aguarde)');
                }
            }, 200);
        });
    }
    
    static readonly GIAC_COMMANDS = [
        'limit', 'int', 'integrate', 'diff', 'desolve', 'applymatrix', 'characteristicpolynomial', 
        'determinant', 'eigenvalues', 'eigenvectors', 'identity', 'invert', 
        'jordandiagonalization', 'matrixrank', 'qrdecomposition', 
        'reducedrowechelonform', 'svd', 'transpose', 'cross', 'dot'
    ];

    static isGiacCommand(ast: any): boolean {
        if (Array.isArray(ast) && typeof ast[0] === 'string') {
            return this.GIAC_COMMANDS.includes(ast[0].toLowerCase());
        }
        return false;
    }

    static formatForGiac(ast: any): string {
        if (typeof ast === 'number') return ast.toString();
        if (typeof ast === 'string') return ast;
        if (Array.isArray(ast)) {
            const op = ast[0];
            if (op === 'Add') return `(${this.formatForGiac(ast[1])} + ${this.formatForGiac(ast[2])})`;
            if (op === 'Subtract') return `(${this.formatForGiac(ast[1])} - ${this.formatForGiac(ast[2])})`;
            if (op === 'Multiply') return `(${this.formatForGiac(ast[1])} * ${this.formatForGiac(ast[2])})`;
            if (op === 'Divide') return `(${this.formatForGiac(ast[1])} / ${this.formatForGiac(ast[2])})`;
            if (op === 'Power') return `(${this.formatForGiac(ast[1])})^(${this.formatForGiac(ast[2])})`;
            if (op === 'Negate') return `(-${this.formatForGiac(ast[1])})`;
            if (op === 'List') return `[${ast.slice(1).map((x: any) => this.formatForGiac(x)).join(',')}]`;
            
            if (op === 'Integrate') {
                const expr = this.formatForGiac(ast[1]);
                const variable = this.formatForGiac(ast[2] || 'x');
                if (ast.length > 3) {
                    const lower = this.formatForGiac(ast[3]);
                    const upper = this.formatForGiac(ast[4]);
                    return `int(${expr}, ${variable}, ${lower}, ${upper})`;
                }
                return `int(${expr}, ${variable})`;
            }

            if (op === 'Limit') {
                const expr = this.formatForGiac(ast[1]);
                const variable = this.formatForGiac(ast[2] || 'x');
                const target = this.formatForGiac(ast[3]);
                return `limit(${expr}, ${variable}, ${target})`;
            }
                     // Function call: se for função do utilizador registrada no Giac, prefixa com usr_
            if (this.userFunctions[op]) {
                return `usr_${op}(${ast.slice(1).map((x: any) => this.formatForGiac(x)).join(', ')})`;
            }
            return `${op.toLowerCase()}(${ast.slice(1).map((x: any) => this.formatForGiac(x)).join(', ')})`;
        }
        return '';
    }

    // Dicionário na RAM para guardar funções criadas pelo usuário (ex: f(x) = x^2, f(x,y))
    static compiledFuncs: Record<string, any> = {};
    static userFunctions: Record<string, { params: string[], expr: string, ast: any, blockId?: string }> = {};

    static evaluateAST(ast: any, scope: Record<string, number> = {}): number {
        try {
            this.ce.pushScope();
            Object.entries(scope).forEach(([k, v]) => {
                if (typeof v === 'number' && !isNaN(v)) {
                    this.ce.assign(k, v);
                }
            });
            const result = this.ce.box(ast).evaluate();
            return Number((result as any).numericValue ?? (result as any).json ?? result.valueOf());
        } catch (_) {
            return NaN;
        } finally {
            try { this.ce.popScope(); } catch (_) {}
        }
    }

    static realPow(base: number, exp: number): number {
        if (base >= 0) return Math.pow(base, exp);
        // Raiz cúbica ou potências com denominador ímpar para bases negativas
        if (Math.abs(exp - 1/3) < 1e-4) return -Math.cbrt(-base);
        const inv = 1 / exp;
        const roundInv = Math.round(inv);
        if (Math.abs(inv - roundInv) < 1e-4 && roundInv % 2 !== 0) {
            return -Math.pow(-base, exp);
        }
        return Math.pow(base, exp);
    }

    private static compileCache: Record<string, (x: number, y: number, scope: Record<string, number>) => number> = {};

    static compile(ast: any, paramName: string = 'x', dependentVar: string = 'y'): (x: number, y: number, scope: Record<string, number>) => number {
        const cacheKey = JSON.stringify(ast) + '::' + paramName + '::' + dependentVar;
        if (MathEngine.compileCache[cacheKey]) {
            return MathEngine.compileCache[cacheKey] as any;
        }

        const toJS = (node: any): string => {
            if (typeof node === 'number') return node.toString();
            if (typeof node === 'string') {
                const cleanNode = node.trim();
                if (cleanNode === 'e') return 'Math.E';
                if (cleanNode === 'pi' || cleanNode === '\\pi' || cleanNode === 'π') return 'Math.PI';
                
                // Associa a variável escolhida (ex: y) ao motor interno X e Y
                if (cleanNode === paramName) return 'x'; 
                if (cleanNode === dependentVar) return 'y';
                
                return `(scope['${cleanNode}'] || 0)`;
            }
            if (Array.isArray(node)) {
                const op = node[0];
                if (op === 'Add') return `(${toJS(node[1])} + ${toJS(node[2])})`;
                if (op === 'Subtract') return `(${toJS(node[1])} - ${toJS(node[2])})`;
                if (op === 'Multiply') return `(${toJS(node[1])} * ${toJS(node[2])})`;
                if (op === 'Divide') return `(${toJS(node[1])} / ${toJS(node[2])})`;
                if (op === 'Power') return `funcs.realPow(${toJS(node[1])}, ${toJS(node[2])})`;
                if (op === 'Cbrt') return `Math.cbrt(${toJS(node[1])})`;
                if (op === 'Sin') return `Math.sin(${toJS(node[1])})`;
                if (op === 'Cos') return `Math.cos(${toJS(node[1])})`;
                if (op === 'Tan') return `Math.tan(${toJS(node[1])})`;
                if (op === 'Sec') return `(1 / Math.cos(${toJS(node[1])}))`;
                if (op === 'Csc') return `(1 / Math.sin(${toJS(node[1])}))`;
                if (op === 'Cot') return `(1 / Math.tan(${toJS(node[1])}))`;
                if (op === 'Asin') return `Math.asin(${toJS(node[1])})`;
                if (op === 'Acos') return `Math.acos(${toJS(node[1])})`;
                if (op === 'Atan') return `Math.atan(${toJS(node[1])})`;
                if (op === 'Log') return `Math.log(${toJS(node[1])})`;
                if (op === 'Abs') return `Math.abs(${toJS(node[1])})`;
                if (op === 'Exp') return `Math.exp(${toJS(node[1])})`;
                if (op === 'Sqrt') return `Math.sqrt(${toJS(node[1])})`;
                if (op === 'Negate') return `(-${toJS(node[1])})`;
                if (op === 'List') return `[${node.slice(1).map(toJS).join(', ')}]`;
                
                // Trata chamadas customizadas ou não reconhecidas (ex: f(x) ou f(x, y) ou f(2, 3, 1, 0, 2))
                if (op === 'Call') {
                    const fnName = node[1];
                    const args = node.slice(2).map(toJS);
                    args.push('scope');
                    return `(funcs['${fnName}'] ? funcs['${fnName}'](${args.join(', ')}) : 0)`;
                }
                
                // Funções que são parseadas como ["nome", arg1, ...] 
                // e que podem ser do utilizador (ex: f(2, 3, 1, 0, 2))
                const argsJS = node.slice(1).map(toJS);
                argsJS.push('scope');
                return `(funcs['${op}'] ? funcs['${op}'](${argsJS.join(', ')}) : 0)`;
            }
            return '0';
        };

        const jsCode = toJS(ast);
        const rawFunc = new Function('x', 'y', 'scope', 'funcs', `return ${jsCode};`);
        
        MathEngine.compiledFuncs['realPow'] = MathEngine.realPow;
        const compiled = (x: number, y: number, scope: Record<string, number>) => rawFunc(x, y, scope, MathEngine.compiledFuncs);
        MathEngine.compileCache[cacheKey] = compiled;
        return compiled;
    }

    /**
     * Compila uma função com número arbitrário de variáveis (ex: f(x, y), f(x, y, z, a, b))
     */
    static compileMultivariable(ast: any, paramNames: string[]): (...args: any[]) => number {
        const cacheKey = JSON.stringify(ast) + '::multi::' + paramNames.join(',');
        if (MathEngine.compileCache[cacheKey]) {
            return MathEngine.compileCache[cacheKey] as any;
        }

        const toJS = (node: any): string => {
            if (typeof node === 'number') return node.toString();
            if (typeof node === 'string') {
                const clean = node.trim();
                if (clean === 'e') return 'Math.E';
                if (clean === 'pi' || clean === '\\pi' || clean === 'π') return 'Math.PI';
                const pIdx = paramNames.indexOf(clean);
                if (pIdx !== -1) return `(args[${pIdx}] !== undefined ? args[${pIdx}] : 0)`;
                return `(scope['${clean}'] !== undefined ? scope['${clean}'] : 0)`;
            }
            if (Array.isArray(node)) {
                const op = node[0];
                if (op === 'Add') return `(${toJS(node[1])} + ${toJS(node[2])})`;
                if (op === 'Subtract') return `(${toJS(node[1])} - ${toJS(node[2])})`;
                if (op === 'Multiply') return `(${toJS(node[1])} * ${toJS(node[2])})`;
                if (op === 'Divide') return `(${toJS(node[1])} / (${toJS(node[2])} === 0 ? 1e-9 : ${toJS(node[2])}))`;
                if (op === 'Power') return `funcs.realPow(${toJS(node[1])}, ${toJS(node[2])})`;
                if (op === 'Negate') return `(-(${toJS(node[1])}))`;
                if (op === 'Sin') return `Math.sin(${toJS(node[1])})`;
                if (op === 'Cos') return `Math.cos(${toJS(node[1])})`;
                if (op === 'Tan') return `Math.tan(${toJS(node[1])})`;
                if (op === 'Sqrt') return `Math.sqrt(${toJS(node[1])})`;
                if (op === 'Abs') return `Math.abs(${toJS(node[1])})`;
                if (op === 'Exp') return `Math.exp(${toJS(node[1])})`;
                if (op === 'Log') return `Math.log(${toJS(node[1])})`;
                
                const args = node.slice(1).map(toJS);
                args.push('scope');
                return `(funcs['${op}'] ? funcs['${op}'](${args.join(', ')}) : 0)`;
            }
            return '0';
        };

        const body = `
            return function(...args) {
                let scope = {};
                if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null) {
                    scope = args.pop();
                }
                return ${toJS(ast)};
            };
        `;

        try {
            MathEngine.compiledFuncs['realPow'] = MathEngine.realPow;
            const rawFunc = new Function('funcs', body)(MathEngine.compiledFuncs);
            (MathEngine.compileCache as any)[cacheKey] = rawFunc;
            return rawFunc;
        } catch(e) {
            console.error('[compileMultivariable] Erro:', e);
            return () => 0;
        }
    }

    /**
     * Substitui parâmetros numa árvore AST (ex: { x: 'x', y: 'y' })
     */
    static substituteAST(ast: any, mapping: Record<string, any>): any {
        if (typeof ast === 'string') {
            return mapping[ast] !== undefined ? mapping[ast] : ast;
        }
        if (typeof ast === 'number') return ast;
        if (Array.isArray(ast)) {
            const op = ast[0];
            return [op, ...ast.slice(1).map(child => this.substituteAST(child, mapping))];
        }
        return ast;
    }

    /**
     * Expande chamadas a funções de utilizador (ex: f(x, y)) de volta para a sua expressão analítica
     * permitindo que o WebGL renderize curvas implícitas f(x, y) = 0 diretamente na GPU.
     */
    static expandUserFunctions(ast: any): any {
        if (typeof ast === 'string' || typeof ast === 'number') return ast;
        if (Array.isArray(ast)) {
            const op = ast[0];
            const def = MathEngine.userFunctions[op];
            if (def) {
                const mapping: Record<string, any> = {};
                for (let i = 0; i < def.params.length; i++) {
                    const p = def.params[i];
                    mapping[p] = this.expandUserFunctions(ast[i + 1] ?? p);
                }
                return this.substituteAST(def.ast, mapping);
            }
            return [op, ...ast.slice(1).map(child => this.expandUserFunctions(child))];
        }
        return ast;
    }

    static createDerivativeFunction(ast: any, derivVar: string): (x: number, y: number, scope: Record<string, number>) => number {
        const baseFunc = this.compile(ast, derivVar);
        const h = 1e-5; // numeric differentiation step
        return (x: number, y: number, scope: Record<string, number>) => {
            // using central difference
            if (derivVar === 'x') {
                return (baseFunc(x + h, y, scope) - baseFunc(x - h, y, scope)) / (2 * h);
            } else if (derivVar === 'y') {
                return (baseFunc(x, y + h, scope) - baseFunc(x, y - h, scope)) / (2 * h);
            }
            return 0;
        };
    }

    static compileInterval(ast: any, paramName: string = 'x', dependentVar: string = 'y'): (x: {min: number, max: number}, y: {min: number, max: number}, scope: Record<string, number>) => {min: number, max: number} {
        // Gera um avaliador de Aritmética de Intervalos
        const toJS = (node: any): string => {
            if (typeof node === 'number') return `{min: ${node}, max: ${node}}`;
            if (typeof node === 'string') {
                const cleanNode = node.trim();
                if (cleanNode === 'e') return `{min: Math.E, max: Math.E}`;
                if (cleanNode === 'pi' || cleanNode === '\\pi' || cleanNode === 'π') return `{min: Math.PI, max: Math.PI}`;
                if (cleanNode === paramName) return 'x'; 
                if (cleanNode === dependentVar) return 'y';
                return `{min: (scope['${cleanNode}'] || 0), max: (scope['${cleanNode}'] || 0)}`;
            }
            if (Array.isArray(node)) {
                const op = node[0];
                const L = node.length > 1 ? toJS(node[1]) : '';
                const R = node.length > 2 ? toJS(node[2]) : '';
                
                if (op === 'Add') return `funcs.intAdd(${L}, ${R})`;
                if (op === 'Subtract') return `funcs.intSub(${L}, ${R})`;
                if (op === 'Multiply') return `funcs.intMul(${L}, ${R})`;
                if (op === 'Divide') return `funcs.intDiv(${L}, ${R})`;
                if (op === 'Power') return `funcs.intPow(${L}, ${R})`;
                if (op === 'Sin') return `funcs.intSin(${L})`;
                if (op === 'Cos') return `funcs.intCos(${L})`;
                if (op === 'Tan') return `funcs.intDiv(funcs.intSin(${L}), funcs.intCos(${L}))`;
                if (op === 'Sqrt') return `funcs.intSqrt(${L})`;
                if (op === 'Log') return `funcs.intLog(${L})`;
                if (op === 'Atan') return `funcs.intAtan(${L})`;
                if (op === 'Asin') return `funcs.intAsin(${L})`;
                if (op === 'Acos') return `funcs.intAcos(${L})`;
                if (op === 'Negate') return `funcs.intNeg(${L})`;
                if (op === 'Abs') return `funcs.intAbs(${L})`;
                if (op === 'Exp') return `funcs.intExp(${L})`;
            }
            return '{min: 0, max: 0}';
        };

        const jsCode = toJS(ast);
        const rawFunc = new Function('x', 'y', 'scope', 'funcs', `return ${jsCode};`);
        
        return (x: {min: number, max: number}, y: {min: number, max: number}, scope: Record<string, number>) => rawFunc(x, y, scope, this.intervalOps);
    }

    // Operações base para Intervalos
    static intervalOps = {
        intAdd: (a: any, b: any) => ({ min: a.min + b.min, max: a.max + b.max }),
        intSub: (a: any, b: any) => ({ min: a.min - b.max, max: a.max - b.min }),
        intMul: (a: any, b: any) => {
            const p1 = a.min * b.min, p2 = a.min * b.max, p3 = a.max * b.min, p4 = a.max * b.max;
            return { min: Math.min(p1, p2, p3, p4), max: Math.max(p1, p2, p3, p4) };
        },
        intDiv: (a: any, b: any) => {
            if (b.min <= 0 && b.max >= 0) return { min: -Infinity, max: Infinity }; // divisão por zero no intervalo
            const p1 = a.min / b.min, p2 = a.min / b.max, p3 = a.max / b.min, p4 = a.max / b.max;
            return { min: Math.min(p1, p2, p3, p4), max: Math.max(p1, p2, p3, p4) };
        },
        intNeg: (a: any) => ({ min: -a.max, max: -a.min }),
        intPow: (a: any, b: any) => {
            if (b.min === b.max && b.min % 2 === 0) {
                if (a.min <= 0 && a.max >= 0) return { min: 0, max: Math.max(Math.pow(a.min, b.min), Math.pow(a.max, b.min)) };
                return { min: Math.min(Math.pow(a.min, b.min), Math.pow(a.max, b.min)), max: Math.max(Math.pow(a.min, b.min), Math.pow(a.max, b.min)) };
            }
            return { min: Math.min(Math.pow(a.min, b.min), Math.pow(a.max, b.min)), max: Math.max(Math.pow(a.min, b.max), Math.pow(a.max, b.max)) };
        },
        intSin: (a: any) => {
            if (a.max - a.min >= 2 * Math.PI) return { min: -1, max: 1 };
            const minV = Math.sin(a.min), maxV = Math.sin(a.max);
            let min = Math.min(minV, maxV), max = Math.max(minV, maxV);
            const p1 = Math.ceil((a.min - Math.PI/2) / (2*Math.PI)) * 2*Math.PI + Math.PI/2;
            if (p1 >= a.min && p1 <= a.max) max = 1;
            const p2 = Math.ceil((a.min - 3*Math.PI/2) / (2*Math.PI)) * 2*Math.PI + 3*Math.PI/2;
            if (p2 >= a.min && p2 <= a.max) min = -1;
            return { min, max };
        },
        intCos: (a: any) => {
            if (a.max - a.min >= 2 * Math.PI) return { min: -1, max: 1 };
            const minV = Math.cos(a.min), maxV = Math.cos(a.max);
            let min = Math.min(minV, maxV), max = Math.max(minV, maxV);
            const p1 = Math.ceil((a.min) / (2*Math.PI)) * 2*Math.PI;
            if (p1 >= a.min && p1 <= a.max) max = 1;
            const p2 = Math.ceil((a.min - Math.PI) / (2*Math.PI)) * 2*Math.PI + Math.PI;
            if (p2 >= a.min && p2 <= a.max) min = -1;
            return { min, max };
        },
        intSqrt: (a: any) => ({
            min: Math.sqrt(Math.max(0, a.min)),
            max: Math.sqrt(Math.max(0, a.max))
        }),
        intLog: (a: any) => ({
            min: a.min > 0 ? Math.log(a.min) : -Infinity,
            max: a.max > 0 ? Math.log(a.max) : -Infinity
        }),
        intAtan: (a: any) => ({
            min: Math.atan(a.min),
            max: Math.atan(a.max)
        }),
        intAsin: (a: any) => ({
            min: Math.asin(Math.max(-1, Math.min(1, a.min))),
            max: Math.asin(Math.max(-1, Math.min(1, a.max)))
        }),
        intAcos: (a: any) => ({
            min: Math.acos(Math.max(-1, Math.min(1, a.max))),
            max: Math.acos(Math.max(-1, Math.min(1, a.min)))
        }),
        intAbs: (a: any) => ({ 
            min: (a.min <= 0 && a.max >= 0) ? 0 : Math.min(Math.abs(a.min), Math.abs(a.max)), 
            max: Math.max(Math.abs(a.min), Math.abs(a.max)) 
        }),
        intExp: (a: any) => ({ min: Math.exp(a.min), max: Math.exp(a.max) })
    };

    static generatePointsAdaptive(ast: any, xMin: number, xMax: number, scope: Record<string, number> = {}, variable: string = 'x', screenWidth: number = 2000): {x: number, y: number}[] {
        const points: {x: number, y: number}[] = [];
        const fastF = this.compile(ast, variable);
        const f = (x: number) => fastF(x, 0, scope);

        // Amostragem por pixel (alta fidelidade) em vez de recursão que falha em escalas distorcidas
        const steps = screenWidth > 0 ? Math.min(screenWidth * 1.5, 3000) : 1000;
        const dx = (xMax - xMin) / steps;
        
        // Heurística para quebrar assíntotas verticais
        const asymptoteThreshold = (xMax - xMin) * 2; 

        let prevY = NaN;
        for (let i = 0; i <= steps; i++) {
            const x = xMin + i * dx;
            let y = f(x);
            
            // Prevenir Inifity que estraga o WebGL/Canvas
            if (y > 1e6) y = 1e6;
            if (y < -1e6) y = -1e6;

            if (!isNaN(y) && !isNaN(prevY)) {
                if (Math.abs(y - prevY) > asymptoteThreshold && (y * prevY < 0)) {
                    points.push({ x: x - dx/2, y: NaN }); // Levanta o pincel na assíntota
                }
            }
            
            points.push({ x, y });
            prevY = y;
        }
        return points;
    }
}