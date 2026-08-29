import { ComputeEngine } from '@cortex-js/compute-engine';

export class MathEngine {
    private static ce = new ComputeEngine();

    /**
     * O Método Mágico Assíncrono: Pede ao Oráculo para resolver integrais, derivadas e limites!
     */
    static async askGiac(expression: string): Promise<string> {
        console.log("GIAC QUERY:", expression);
        return new Promise((resolve) => {
            const m = (window as any).Module;
            if (!(window as any).giacReady || !m) {
                resolve('(A carregar motor matemático... aguarde)');
                return;
            }

            try {
                let res = '';
                if (typeof m.cwrap === 'function') {
                    const evaluateGiac = m.cwrap('caseval', 'string', ['string']);
                    res = evaluateGiac(expression);
                } else if (typeof m._caseval === 'function') {
                    const ptr = m.allocate(m.intArrayFromString(expression), 'i8', 0);
                    const resPtr = m._caseval(ptr);
                    res = m.UTF8ToString(resPtr);
                    m._free(ptr);
                } else {
                    resolve('(Erro: Funções de avaliação não encontradas)');
                    return;
                }
                resolve(res);
            } catch (e: any) {
                resolve(`(Erro: ${e.message})`);
            }
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
            
            // Function call
            return `${op.toLowerCase()}(${ast.slice(1).map((x: any) => this.formatForGiac(x)).join(', ')})`;
        }
        return '';
    }

    // Dicionário na RAM para guardar funções criadas pelo usuário (ex: f(x) = x^2)
    static compiledFuncs: Record<string, any> = {};

    static evaluateAST(ast: any, scope: Record<string, number> = {}): number {
        try {
            this.ce.pushScope();
            for (const [varName, value] of Object.entries(scope)) {
                this.ce.assign(varName, value);
            }
            const mathNode = this.ce.box(ast);
            const resultNode = mathNode.N(); 

            if (typeof (resultNode as any).json === 'number') return (resultNode as any).json;
            if (typeof (resultNode as any).numericValue === 'number') return (resultNode as any).numericValue;
            
            const val = resultNode.valueOf();
            if (typeof val === 'number') return val;
            return NaN;
        } catch (error) {
            return NaN;
        } finally {
            try { this.ce.popScope(); } catch (_) {}
        }
    }

    static compile(ast: any, paramName: string = 'x', dependentVar: string = 'y'): (x: number, y: number, scope: Record<string, number>) => number {
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
                if (op === 'Power') return `Math.pow(${toJS(node[1])}, ${toJS(node[2])})`;
                if (op === 'Sin') return `Math.sin(${toJS(node[1])})`;
                if (op === 'Cos') return `Math.cos(${toJS(node[1])})`;
                if (op === 'Tan') return `Math.tan(${toJS(node[1])})`;
                if (op === 'Log') return `Math.log(${toJS(node[1])})`;
                if (op === 'Abs') return `Math.abs(${toJS(node[1])})`;
                if (op === 'Exp') return `Math.exp(${toJS(node[1])})`;
                if (op === 'Sqrt') return `Math.sqrt(${toJS(node[1])})`;
                if (op === 'Negate') return `(-${toJS(node[1])})`;
                if (op === 'List') return `[${node.slice(1).map(toJS).join(', ')}]`;
                
                // Trata chamadas customizadas ou não reconhecidas (ex: f(x))
                if (op === 'Call') {
                    return `(funcs['${node[1]}'] ? funcs['${node[1]}'](${toJS(node[2])}, ${toJS(node[2])}, scope) : 0)`;
                }
                
                // Funções que são parseadas como ["nome", arg1, ...] 
                // e que podem ser do utilizador
                return `(funcs['${op}'] ? funcs['${op}'](${node.length > 1 ? toJS(node[1]) : 0}, ${node.length > 2 ? toJS(node[2]) : 0}, scope) : 0)`;
            }
            return '0';
        };

        const jsCode = toJS(ast);
        const rawFunc = new Function('x', 'y', 'scope', 'funcs', `return ${jsCode};`);
        
        // CORREÇÃO CRÍTICA: Chamamos a classe MathEngine diretamente para não perder o escopo!
        return (x: number, y: number, scope: Record<string, number>) => rawFunc(x, y, scope, MathEngine.compiledFuncs);
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
                if (op === 'Negate') return `funcs.intNeg(${L})`;
                if (op === 'Abs') return `funcs.intAbs(${L})`;
                if (op === 'Exp') return `funcs.intExp(${L})`;
                // Por agora apenas operações core
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
        intAbs: (a: any) => ({ 
            min: (a.min <= 0 && a.max >= 0) ? 0 : Math.min(Math.abs(a.min), Math.abs(a.max)), 
            max: Math.max(Math.abs(a.min), Math.abs(a.max)) 
        }),
        intExp: (a: any) => ({ min: Math.exp(a.min), max: Math.exp(a.max) })
    };

    static generatePointsAdaptive(ast: any, xMin: number, xMax: number, scope: Record<string, number> = {}, variable: string = 'x'): {x: number, y: number}[] {
        const points: {x: number, y: number}[] = [];
        const fastF = this.compile(ast, variable); 
        const f = (x: number) => fastF(x, 0, scope); 

        const maxDepth = 7; 
        const loss_goal = 0.05; 

        const sample = (x1: number, y1: number, x2: number, y2: number, depth: number) => {
            const xMid = (x1 + x2) / 2;
            const yMid = f(xMid);

            if (depth >= maxDepth || isNaN(y1) || isNaN(y2) || isNaN(yMid)) {
                points.push({ x: xMid, y: yMid });
                points.push({ x: x2, y: y2 });
                return;
            }

            // Distância Euclidiana da coordenada interpolada à reta A-B
            const num = Math.abs((x2 - x1) * (y1 - yMid) - (x1 - xMid) * (y2 - y1));
            const den = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const error = den === 0 ? 0 : (num / den);

            if (error > loss_goal) {
                sample(x1, y1, xMid, yMid, depth + 1);
                sample(xMid, yMid, x2, y2, depth + 1);
            } else {
                points.push({ x: xMid, y: yMid });
                points.push({ x: x2, y: y2 });
            }
        };

        const steps = 50; 
        const dx = (xMax - xMin) / steps;
        
        let currentX = xMin;
        let currentY = f(currentX);
        points.push({ x: currentX, y: currentY });

        for (let i = 0; i < steps; i++) {
            const nextX = currentX + dx;
            const nextY = f(nextX);
            sample(currentX, currentY, nextX, nextY, 0);
            currentX = nextX;
            currentY = nextY;
        }
        return points;
    }
}