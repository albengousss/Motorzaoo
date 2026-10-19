import { ListEngine } from './listEngine';
import { MatrixEngine } from './matrixEngine';
import { PointEngine, type Point } from './pointEngine';

export class MathEngine {
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
        this.initGiacWorker();
        if (this.giacWorker) {
            const id = 'giac_' + (++this.reqCounter) + '_' + Date.now();
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    if (this.giacCallbacks[id]) {
                        delete this.giacCallbacks[id];
                        resolve('(Tempo limite de cálculo excedido)');
                    }
                }, 12000);

                this.giacCallbacks[id] = (res) => {
                    clearTimeout(timer);
                    resolve(res);
                };

                this.giacWorker!.postMessage({ id, query: expression });
            });
        }

        return Promise.resolve('(A carregar motor matemático... aguarde)');
    }
    
    static readonly GIAC_COMMANDS = [
        'limit', 'lim', 'int', 'integrate', 'defint', 'diff', 'applymatrix', 'characteristicpolynomial', 
        'determinant', 'det', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'identity', 'invert', 'inv',
        'jordandiagonalization', 'matrixrank', 'rank', 'qrdecomposition', 
        'reducedrowechelonform', 'rref', 'svd', 'transpose', 'tran', 'trace', 'tr', 'cross', 'dot',
        'taylor', 'taylorpolynomial', 'sum', 'product', 'prod',
        'mean', 'median', 'stdev', 'stddev', 'var', 'variance', 'samplesd', 'samplevariance', 'length', 'size',
        'desolve', 'solveode', 'edo', 'nsolveode', 'campo', 'slopefield', 'laplace', 'inverselaplace', 'index'
    ];

    static isGiacCommand(ast: any): boolean {
        if (Array.isArray(ast) && typeof ast[0] === 'string') {
            return this.GIAC_COMMANDS.includes(ast[0].toLowerCase());
        }
        return false;
    }

    static formatForGiac(ast: any): string {
        if (typeof ast === 'number') return ast.toString();
        if (typeof ast === 'string') {
            const clean = ast.replace(/[\{\}\\]/g, '');
            const defs = (typeof window !== 'undefined' && (window as any).StateManager?.giacDefinitions) || {};
            if (defs[clean]) {
                return `usr_${clean}`;
            }
            return clean;
        }
        if (Array.isArray(ast)) {
            const op = ast[0];
            if (op === 'Add') return `(${this.formatForGiac(ast[1])} + ${this.formatForGiac(ast[2])})`;
            if (op === 'Subtract') return `(${this.formatForGiac(ast[1])} - ${this.formatForGiac(ast[2])})`;
            if (op === 'Multiply') return `(${this.formatForGiac(ast[1])} * ${this.formatForGiac(ast[2])})`;
            if (op === 'Divide') return `(${this.formatForGiac(ast[1])} / ${this.formatForGiac(ast[2])})`;
            if (op === 'Power') {
                const base = this.formatForGiac(ast[1]);
                const exp = ast[2];
                const isMatBase = base.startsWith('usr_') || /^[A-Z][A-Za-z0-9_]*$/.test(base);
                if (isMatBase && (exp === -1 || (Array.isArray(exp) && exp[0] === 'Negate' && exp[1] === 1))) {
                    return `inv(${base})`;
                }
                if (isMatBase && (exp === 'T' || exp === 'top' || exp === 'intercal')) {
                    return `tran(${base})`;
                }
                return `(${base})^(${this.formatForGiac(exp)})`;
            }
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
            if (op === 'Index') {
                const target = this.formatForGiac(ast[1]);
                const indices = ast.slice(2).map((idxNode: any) => {
                    if (typeof idxNode === 'number') {
                        return (idxNode - 1).toString();
                    }
                    const formatted = this.formatForGiac(idxNode);
                    if (/^\d+$/.test(formatted)) {
                        return (parseInt(formatted) - 1).toString();
                    }
                    return `(${formatted} - 1)`;
                });
                return `${target}${indices.map((idx: string) => `[${idx}]`).join('')}`;
            }
            const opLower = op.toLowerCase();
            if (opLower === 'taylor' || opLower === 'taylorpolynomial') {
                const args = ast.slice(1);
                if (args.length >= 4) {
                    return `taylor(${this.formatForGiac(args[0])}, ${this.formatForGiac(args[1])}=${this.formatForGiac(args[2])}, ${this.formatForGiac(args[3])})`;
                }
            }
            // Function call: se for função do utilizador registrada no Giac, prefixa com usr_
            if (this.userFunctions[op]) {
                return `usr_${op}(${ast.slice(1).map((x: any) => this.formatForGiac(x)).join(', ')})`;
            }
            let giacOp = opLower;
            if (opLower === 'reducedrowechelonform') giacOp = 'rref';
            else if (opLower === 'matrixrank') giacOp = 'rank';
            else if (opLower === 'determinant') giacOp = 'det';
            else if (opLower === 'invert') giacOp = 'inv';
            else if (opLower === 'transpose') giacOp = 'tran';
            else if (opLower === 'tr') giacOp = 'trace';
            else if (opLower === 'eigenvalues') giacOp = 'eigenvals';
            else if (opLower === 'eigenvectors') giacOp = 'eigenvects';
            else if (opLower === 'prod') giacOp = 'product';
            else if (opLower === 'stdev' || opLower === 'stddev') giacOp = 'stddev';
            else if (opLower === 'var') giacOp = 'variance';
            else if (opLower === 'length') giacOp = 'size';
            else if (opLower === 'lim') giacOp = 'limit';
            else if (opLower === 'solveode' || opLower === 'edo' || opLower === 'nsolveode') giacOp = 'desolve';
            return `${giacOp}(${ast.slice(1).map((x: any) => this.formatForGiac(x)).join(', ')})`;
        }
        return '';
    }

    // Dicionário na RAM para guardar funções criadas pelo usuário (ex: f(x) = x^2, f(x,y))
    static compiledFuncs: Record<string, any> = {};
    static userFunctions: Record<string, { params: string[], expr: string, ast: any, blockId?: string }> = {};
    static globalValues: Record<string, any> = {};
    static globalScopeProvider: (() => Record<string, any>) | null = null;

    static evaluateAST(ast: any, scope: Record<string, any> = {}): any {
        if (ast === null || ast === undefined) return NaN;
        if (typeof ast === 'number') return ast;
        if (typeof ast === 'string') {
            const rawVar = ast.replace(/[\{\}\\]/g, '').trim();
            const clean = rawVar.toLowerCase();
            if (clean === 'pi' || clean === 'π') return Math.PI;
            if (clean === 'e') return Math.E;
            if (clean === 'inf' || clean === 'infty' || clean === 'infinity') return Infinity;

            // 1. Prioridade para escopo local explícito
            if (scope[ast] !== undefined) return scope[ast];
            if (scope[rawVar] !== undefined) return scope[rawVar];
            if (scope[clean] !== undefined) return scope[clean];

            // 2. Fallback para escopo global (StateManager.values) preservando case-sensitivity
            const globals = this.globalScopeProvider ? this.globalScopeProvider() : this.globalValues;
            if (globals) {
                if (globals[ast] !== undefined) return globals[ast];
                if (globals[rawVar] !== undefined) return globals[rawVar];
            }

            const parsed = parseFloat(clean);
            if (!isNaN(parsed) && isFinite(parsed)) return parsed;
            return NaN;
        }

        // Suporte a nós AST do PrattParser ({ type: 'Number', ... })
        if (typeof ast === 'object' && !Array.isArray(ast)) {
            if (ast.type === 'Number') {
                return typeof ast.value === 'number' ? ast.value : parseFloat(ast.value);
            }
            if (ast.type === 'Identifier') {
                return this.evaluateAST(ast.value, scope);
            }
            if (ast.type === 'BinaryOp') {
                const L = this.evaluateAST(ast.left, scope);
                const R = this.evaluateAST(ast.right, scope);
                if (Array.isArray(L) || Array.isArray(R)) {
                    const opMap: Record<string, string> = { '+': 'Add', '-': 'Subtract', '*': 'Multiply', '/': 'Divide', '^': 'Power' };
                    return ListEngine.broadcastBinary(opMap[ast.operator] || 'Add', L, R, this.realPow);
                }
                if (ast.operator === '+') return L + R;
                if (ast.operator === '-') return L - R;
                if (ast.operator === '*') return L * R;
                if (ast.operator === '/') return R === 0 ? NaN : L / R;
                if (ast.operator === '^') return this.realPow(L, R);
            }
            if (ast.type === 'UnaryOp') {
                const arg = this.evaluateAST(ast.argument, scope);
                if (Array.isArray(arg)) {
                    return ListEngine.broadcastUnary(ast.operator === '-' ? 'Negate' : 'Add', arg);
                }
                if (ast.operator === '-') return -arg;
                if (ast.operator === '+') return arg;
            }
            if (ast.type === 'FunctionCall') {
                const fn = (ast.name || '').toLowerCase();
                const args = (ast.arguments || []).map((a: any) => this.evaluateAST(a, scope));
                if (Array.isArray(args[0])) {
                    return ListEngine.broadcastUnary(fn.charAt(0).toUpperCase() + fn.slice(1), args[0]);
                }
                if (fn === 'sin') return Math.sin(args[0]);
                if (fn === 'cos') return Math.cos(args[0]);
                if (fn === 'tan') return Math.tan(args[0]);
                if (fn === 'sec') return 1 / Math.cos(args[0]);
                if (fn === 'csc') return 1 / Math.sin(args[0]);
                if (fn === 'cot') return 1 / Math.tan(args[0]);
                if (fn === 'sqrt') return Math.sqrt(args[0]);
                if (fn === 'cbrt') return Math.cbrt(args[0]);
                if (fn === 'abs') return Math.abs(args[0]);
                if (fn === 'exp') return Math.exp(args[0]);
                if (fn === 'log' || fn === 'ln') return Math.log(args[0]);
                if (fn === 'asin') return Math.asin(args[0]);
                if (fn === 'acos') return Math.acos(args[0]);
                if (fn === 'atan') return args.length > 1 ? Math.atan2(args[0], args[1]) : Math.atan(args[0]);
                if (fn === 'asec') return Math.acos(1 / args[0]);
                if (fn === 'acsc') return Math.asin(1 / args[0]);
                if (fn === 'acot') return Math.atan(1 / args[0]);
                if (fn === 'sinh') return Math.sinh(args[0]);
                if (fn === 'cosh') return Math.cosh(args[0]);
                if (fn === 'tanh') return Math.tanh(args[0]);
                if (fn === 'asinh') return Math.asinh(args[0]);
                if (fn === 'acosh') return Math.acosh(args[0]);
                if (fn === 'atanh') return Math.atanh(args[0]);
            }
        }

        // Suporte a arrays MathJSON (['Add', 1, 2], etc.)
        if (Array.isArray(ast)) {
            const op = ast[0];

            // 1. Listas, Sequências Sintéticas e Compreensões
            if (op === 'List') {
                return ast.slice(1).map((item: any) => this.evaluateAST(item, scope));
            }
            if (op === 'Range') {
                const start = this.evaluateAST(ast[1], scope);
                const end = this.evaluateAST(ast[2], scope);
                return ListEngine.generateRange(start, end);
            }
            if (op === 'RangeStep') {
                const start = this.evaluateAST(ast[1], scope);
                const second = this.evaluateAST(ast[2], scope);
                const end = this.evaluateAST(ast[3], scope);
                return ListEngine.generateRange(start, end, second - start);
            }
            if (op === 'Index') {
                const target = this.evaluateAST(ast[1], scope);
                const targetVar = typeof ast[1] === 'string' ? ast[1].replace(/[\{\}\\]/g, '') : undefined;
                const indexArg = ast.length === 3 ? ast[2] : ast.slice(2);
                return ListEngine.evaluateIndex(target, indexArg, scope, (a, s) => this.evaluateAST(a, s), targetVar);
            }
            if (op === 'MatrixIndex') {
                const target = this.evaluateAST(ast[1], scope);
                const rowSpec = ast[2];
                const colSpec = ast[3];
                return MatrixEngine.indexMatrix(target, rowSpec, colSpec, scope, (a, s) => this.evaluateAST(a, s));
            }
            if (op === 'Slice') {
                return ast;
            }
            if (op === 'Comprehension') {
                return ListEngine.evaluateComprehension(ast[1], ast[2], scope, (a, s) => this.evaluateAST(a, s));
            }
            if (op === 'MatrixComprehension') {
                return MatrixEngine.generateMatrixComprehension(ast[1], ast[2], scope, (a, s) => this.evaluateAST(a, s));
            }
            if (op === 'PropertyAccess') {
                const target = this.evaluateAST(ast[1], scope);
                const prop = typeof ast[2] === 'string' ? ast[2].toLowerCase() : '';
                if (PointEngine.isPoint(target)) {
                    if (prop === 'x') return target.x;
                    if (prop === 'y') return target.y;
                    if (prop === 'z') return target.z !== undefined ? target.z : 0;
                    if (prop === 'mag' || prop === 'magnitude') return PointEngine.magnitude(target);
                }
                if (MatrixEngine.isMatrix(target)) {
                    if (prop === 'rows' || prop === 'row') return target.length;
                    if (prop === 'columns' || prop === 'cols' || prop === 'col') return target[0]?.length || 0;
                    if (prop === 'det') return MatrixEngine.determinant(target);
                    if (prop === 'trace' || prop === 'tr') return MatrixEngine.trace(target);
                    if (prop === 'rank') return MatrixEngine.rank(target);
                }
                if (Array.isArray(target)) {
                    if (prop === 'length' || prop === 'count' || prop === 'size') return target.length;
                    if (prop === 'mean') return target.reduce((a, b) => a + Number(b), 0) / target.length;
                    if (prop === 'total' || prop === 'sum') return target.reduce((a, b) => a + Number(b), 0);
                    if (prop === 'min') return Math.min(...target.map(Number));
                    if (prop === 'max') return Math.max(...target.map(Number));
                }
                return NaN;
            }
            if (op === 'Cross') {
                const L = this.evaluateAST(ast[1], scope);
                const R = this.evaluateAST(ast[2], scope);
                if (PointEngine.isPoint(L) && PointEngine.isPoint(R)) {
                    return PointEngine.cross(L, R);
                }
                if (typeof L === 'number' && typeof R === 'number') {
                    return L * R;
                }
                return NaN;
            }
            if (op === 'Point') {
                const x = this.evaluateAST(ast[1], scope);
                const y = this.evaluateAST(ast[2], scope);
                const pt: Point = { x, y };
                if (ast.length > 3) {
                    pt.z = this.evaluateAST(ast[3], scope);
                }
                return pt;
            }
            if (op === 'Polygon') {
                const xList = this.evaluateAST(ast[1], scope);
                const yList = ast.length > 2 ? this.evaluateAST(ast[2], scope) : undefined;
                return ListEngine.createPolygon(xList, yList);
            }

            // 2. Comandos Estatísticos, Matriciais e Geométricos Diretos (0ms sem WebAssembly)
            const opLower = typeof op === 'string' ? op.toLowerCase() : '';
            if (opLower === 'mean') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list) && list.length > 0) {
                    return list.reduce((a, b) => a + Number(b), 0) / list.length;
                }
            }
            if (opLower === 'total' || opLower === 'sum') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list)) {
                    return list.reduce((a, b) => a + Number(b), 0);
                }
            }
            if (opLower === 'length' || opLower === 'size' || opLower === 'count') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list)) return list.length;
                if (PointEngine.isPoint(list)) return PointEngine.magnitude(list);
            }
            if (opLower === 'min') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list) && list.length > 0) return Math.min(...list.map(Number));
            }
            if (opLower === 'max') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list) && list.length > 0) return Math.max(...list.map(Number));
            }
            if (opLower === 'median') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list) && list.length > 0) {
                    const sorted = [...list].map(Number).sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                }
            }
            if (opLower === 'var' || opLower === 'variance') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list) && list.length > 1) {
                    const m = list.reduce((a, b) => a + Number(b), 0) / list.length;
                    return list.reduce((acc, v) => acc + (Number(v) - m) ** 2, 0) / (list.length - 1);
                }
            }
            if (opLower === 'stdev' || opLower === 'stddev') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list) && list.length > 1) {
                    const m = list.reduce((a, b) => a + Number(b), 0) / list.length;
                    const variance = list.reduce((acc, v) => acc + (Number(v) - m) ** 2, 0) / (list.length - 1);
                    return Math.sqrt(variance);
                }
            }
            if (opLower === 'det') {
                const mat = this.evaluateAST(ast[1], scope);
                if (MatrixEngine.isMatrix(mat)) return MatrixEngine.determinant(mat);
            }
            if (opLower === 'trace' || opLower === 'tr') {
                const mat = this.evaluateAST(ast[1], scope);
                if (MatrixEngine.isMatrix(mat)) return MatrixEngine.trace(mat);
            }
            if (opLower === 'rank') {
                const mat = this.evaluateAST(ast[1], scope);
                if (MatrixEngine.isMatrix(mat)) return MatrixEngine.rank(mat);
            }
            if (opLower === 'rref') {
                const mat = this.evaluateAST(ast[1], scope);
                if (MatrixEngine.isMatrix(mat)) return MatrixEngine.rref(mat);
            }
            if (opLower === 'inv') {
                const mat = this.evaluateAST(ast[1], scope);
                if (MatrixEngine.isMatrix(mat)) return MatrixEngine.inverse(mat);
            }
            if (opLower === 'transpose') {
                const mat = this.evaluateAST(ast[1], scope);
                if (MatrixEngine.isMatrix(mat)) return MatrixEngine.transpose(mat);
            }
            if (opLower === 'dot' || opLower === 'pointdot') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                if (PointEngine.isPoint(p1) && PointEngine.isPoint(p2)) return PointEngine.dot(p1, p2);
            }
            if (opLower === 'cross' || opLower === 'pointcross') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                if (PointEngine.isPoint(p1) && PointEngine.isPoint(p2)) return PointEngine.cross(p1, p2);
            }
            if (opLower === 'pointperp' || opLower === 'perp') {
                const p = this.evaluateAST(ast[1], scope);
                if (PointEngine.isPoint(p)) return PointEngine.perp(p);
            }
            if (opLower === 'distance') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                if (PointEngine.isPoint(p1) && PointEngine.isPoint(p2)) return PointEngine.distance(p1, p2);
            }
            if (opLower === 'magnitude' || opLower === 'norm') {
                const p = this.evaluateAST(ast[1], scope);
                if (PointEngine.isPoint(p)) return PointEngine.magnitude(p);
            }

            // Transformação Linear quando a chamada for uma Matriz: M(x, y) ou M(P) ou M(L)
            const globals = this.globalScopeProvider ? this.globalScopeProvider() : this.globalValues;
            const rawOp = typeof op === 'string' ? op.replace(/[\{\}\\]/g, '').trim() : '';
            const resolvedMat = scope[op] || scope[rawOp] || (globals && (globals[op] || globals[rawOp]));
            if (typeof op === 'string' && resolvedMat && MatrixEngine.isMatrix(resolvedMat)) {
                const mat = resolvedMat;
                const rawArgs = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                if (rawArgs.length === 1) {
                    if (PointEngine.isPoint(rawArgs[0])) {
                        return MatrixEngine.transformPoint(mat, rawArgs[0]);
                    }
                    if (Array.isArray(rawArgs[0])) {
                        return rawArgs[0].map((item: any) => PointEngine.isPoint(item) ? MatrixEngine.transformPoint(mat, item) : item);
                    }
                }
                if (rawArgs.length === 2 && typeof rawArgs[0] === 'number' && typeof rawArgs[1] === 'number') {
                    return MatrixEngine.transformPoint(mat, { x: rawArgs[0], y: rawArgs[1] });
                }
                if (rawArgs.length === 3 && typeof rawArgs[0] === 'number' && typeof rawArgs[1] === 'number' && typeof rawArgs[2] === 'number') {
                    return MatrixEngine.transformPoint(mat, { x: rawArgs[0], y: rawArgs[1], z: rawArgs[2] });
                }
            }

            // 3. Avaliação direta de funções definidas pelo usuário (ex: ['f', 3] ou ['f', 'x'])
            if (typeof op === 'string' && MathEngine.userFunctions[op]) {
                const userFn = MathEngine.userFunctions[op];
                const localScope: Record<string, any> = { ...scope };
                userFn.params.forEach((param, idx) => {
                    localScope[param] = this.evaluateAST(ast[idx + 1], scope);
                });
                return this.evaluateAST(userFn.ast, localScope);
            }

            // 4. Operações Binárias Aritméticas e Relacionais com Suporte a Vetores, Matrizes e Broadcasting
            const binaryOps = new Set([
                'Add', 'Subtract', 'Multiply', 'Divide', 'Power',
                'Equal', 'NotEqual', 'LessThan', 'GreaterThan', 'LessEqual', 'GreaterEqual',
                'And', 'Or'
            ]);

            if (binaryOps.has(op)) {
                const L = this.evaluateAST(ast[1], scope);
                const R = this.evaluateAST(ast[2], scope);

                // Álgebra de Pontos e Vetores
                if (PointEngine.isPoint(L) && PointEngine.isPoint(R)) {
                    if (op === 'Add') return PointEngine.add(L, R);
                    if (op === 'Subtract') return PointEngine.subtract(L, R);
                    if (op === 'Multiply') return PointEngine.dot(L, R);
                }
                if (PointEngine.isPoint(L) && typeof R === 'number') {
                    if (op === 'Multiply') return PointEngine.scale(L, R);
                    if (op === 'Divide') return PointEngine.divide(L, R);
                }
                if (typeof L === 'number' && PointEngine.isPoint(R)) {
                    if (op === 'Multiply') return PointEngine.scale(R, L);
                }

                // Álgebra Matricial Nativa
                if (MatrixEngine.isMatrix(L) && MatrixEngine.isMatrix(R)) {
                    if (op === 'Add') return MatrixEngine.add(L, R);
                    if (op === 'Subtract') return MatrixEngine.subtract(L, R);
                    if (op === 'Multiply') return MatrixEngine.multiply(L, R);
                }
                if (MatrixEngine.isMatrix(L) && typeof R === 'number') {
                    if (op === 'Multiply') return MatrixEngine.scale(L, R);
                    if (op === 'Divide') return MatrixEngine.scale(L, 1 / R);
                    if (op === 'Power') return MatrixEngine.power(L, R);
                }
                if (typeof L === 'number' && MatrixEngine.isMatrix(R)) {
                    if (op === 'Multiply') return MatrixEngine.scale(R, L);
                }
                if (MatrixEngine.isMatrix(L) && (R === 'T' || (typeof R === 'string' && R.toUpperCase() === 'T'))) {
                    if (op === 'Power') return MatrixEngine.transpose(L);
                }
                if (MatrixEngine.isMatrix(L) && PointEngine.isPoint(R)) {
                    if (op === 'Multiply') return MatrixEngine.transformPoint(L, R);
                }
                if (MatrixEngine.isMatrix(L) && Array.isArray(R) && R.length > 0 && PointEngine.isPoint(R[0])) {
                    if (op === 'Multiply') return R.map(p => MatrixEngine.transformPoint(L, p));
                }

                if (Array.isArray(L) || Array.isArray(R)) {
                    return ListEngine.broadcastBinary(op, L, R, this.realPow);
                }
                if (op === 'Add') return L + R;
                if (op === 'Subtract') return L - R;
                if (op === 'Multiply') return L * R;
                if (op === 'Divide') return R === 0 ? NaN : L / R;
                if (op === 'Power') return this.realPow(L, R);
                return ListEngine.applyScalarBinary(op, L, R, this.realPow);
            }

            // 5. Operações Unárias com Suporte a Broadcasting
            const unaryOps = new Set([
                'Negate', 'Abs', 'Sqrt', 'Cbrt',
                'Sin', 'Cos', 'Tan', 'Sec', 'Csc', 'Cot',
                'Log', 'Ln', 'Exp',
                'Asin', 'Acos', 'Atan', 'Asec', 'Acsc', 'Acot',
                'Sinh', 'Cosh', 'Tanh', 'Asinh', 'Acosh', 'Atanh'
            ]);

            if (unaryOps.has(op)) {
                const arg = this.evaluateAST(ast[1], scope);
                if (PointEngine.isPoint(arg)) {
                    if (op === 'Negate') return PointEngine.negate(arg);
                }
                if (MatrixEngine.isMatrix(arg)) {
                    if (op === 'Negate') return MatrixEngine.scale(arg, -1);
                }
                if (Array.isArray(arg)) {
                    return ListEngine.broadcastUnary(op, arg);
                }
                if (op === 'Negate') return -arg;
                if (op === 'Abs') return Math.abs(arg);
                if (op === 'Sqrt') return Math.sqrt(arg);
                if (op === 'Cbrt') return Math.cbrt(arg);
                if (op === 'Sin') return Math.sin(arg);
                if (op === 'Cos') return Math.cos(arg);
                if (op === 'Tan') return Math.tan(arg);
                if (op === 'Sec') return 1 / Math.cos(arg);
                if (op === 'Csc') return 1 / Math.sin(arg);
                if (op === 'Cot') return 1 / Math.tan(arg);
                if (op === 'Log' || op === 'Ln') return Math.log(arg);
                if (op === 'Exp') return Math.exp(arg);
                if (op === 'Asin') return Math.asin(arg);
                if (op === 'Acos') return Math.acos(arg);
                if (op === 'Atan') return Math.atan(arg);
                if (op === 'Asec') return Math.acos(1 / arg);
                if (op === 'Acsc') return Math.asin(1 / arg);
                if (op === 'Acot') return Math.atan(1 / arg);
                if (op === 'Sinh') return Math.sinh(arg);
                if (op === 'Cosh') return Math.cosh(arg);
                if (op === 'Tanh') return Math.tanh(arg);
                if (op === 'Asinh') return Math.asinh(arg);
                if (op === 'Acosh') return Math.acosh(arg);
                if (op === 'Atanh') return Math.atanh(arg);
            }

            if (op === 'Nthroot') {
                const base = this.evaluateAST(ast[1], scope);
                const exp = this.evaluateAST(ast[2], scope);
                if (Array.isArray(base) || Array.isArray(exp)) {
                    return ListEngine.broadcastBinary('Power', base, ListEngine.broadcastBinary('Divide', 1, exp, this.realPow), this.realPow);
                }
                return this.realPow(base, 1 / exp);
            }
        }

        // Fallback rápido via compilador JIT nativo
        try {
            const fn = this.compile(ast);
            return fn(0, 0, scope);
        } catch (_) {
            return NaN;
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

    // Operadores Aritméticos Universais (suporte a Números, Listas, Matrizes e Pontos)
    static add(a: any, b: any): any {
        if (PointEngine.isPoint(a) && PointEngine.isPoint(b)) return PointEngine.add(a, b);
        if (MatrixEngine.isMatrix(a) && MatrixEngine.isMatrix(b)) return MatrixEngine.add(a, b);
        if (Array.isArray(a) || Array.isArray(b)) return ListEngine.broadcastBinary('Add', a, b, MathEngine.realPow);
        return a + b;
    }

    static sub(a: any, b: any): any {
        if (PointEngine.isPoint(a) && PointEngine.isPoint(b)) return PointEngine.subtract(a, b);
        if (MatrixEngine.isMatrix(a) && MatrixEngine.isMatrix(b)) return MatrixEngine.subtract(a, b);
        if (Array.isArray(a) || Array.isArray(b)) return ListEngine.broadcastBinary('Subtract', a, b, MathEngine.realPow);
        return a - b;
    }

    static mul(a: any, b: any): any {
        if (PointEngine.isPoint(a) && PointEngine.isPoint(b)) return PointEngine.dot(a, b);
        if (PointEngine.isPoint(a) && typeof b === 'number') return PointEngine.scale(a, b);
        if (typeof a === 'number' && PointEngine.isPoint(b)) return PointEngine.scale(b, a);
        if (MatrixEngine.isMatrix(a) && MatrixEngine.isMatrix(b)) return MatrixEngine.multiply(a, b);
        if (MatrixEngine.isMatrix(a) && PointEngine.isPoint(b)) return MatrixEngine.transformPoint(a, b);
        if (MatrixEngine.isMatrix(a) && typeof b === 'number') return MatrixEngine.scale(a, b);
        if (typeof a === 'number' && MatrixEngine.isMatrix(b)) return MatrixEngine.scale(b, a);
        if (Array.isArray(a) || Array.isArray(b)) return ListEngine.broadcastBinary('Multiply', a, b, MathEngine.realPow);
        return a * b;
    }

    static div(a: any, b: any): any {
        if (PointEngine.isPoint(a) && typeof b === 'number') return PointEngine.divide(a, b);
        if (Array.isArray(a) || Array.isArray(b)) return ListEngine.broadcastBinary('Divide', a, b, MathEngine.realPow);
        return b === 0 ? NaN : a / b;
    }

    static toJS(node: any, paramName: string = 'x', dependentVar: string = 'y'): string {
        if (typeof node === 'number') return node.toString();
        if (typeof node === 'string') {
            const cleanNode = node.trim();
            if (cleanNode === 'e') return 'Math.E';
            if (cleanNode === 'pi' || cleanNode === '\\pi' || cleanNode === 'π') return 'Math.PI';
            
            // Associa a variável escolhida (ex: y) ao motor interno X e Y
            if (cleanNode === paramName) return 'x'; 
            if (cleanNode === dependentVar) return 'y';
            
            return `(typeof scope !== 'undefined' && scope[${JSON.stringify(cleanNode)}] !== undefined ? scope[${JSON.stringify(cleanNode)}] : (typeof ${cleanNode} !== 'undefined' ? ${cleanNode} : 0))`;
        }
        if (Array.isArray(node)) {
            const op = node[0];
            if (op === 'Add') return `(funcs && funcs.add ? funcs.add(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[2], paramName, dependentVar)}) : (${this.toJS(node[1], paramName, dependentVar)} + ${this.toJS(node[2], paramName, dependentVar)}))`;
            if (op === 'Subtract') return `(funcs && funcs.sub ? funcs.sub(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[2], paramName, dependentVar)}) : (${this.toJS(node[1], paramName, dependentVar)} - ${this.toJS(node[2], paramName, dependentVar)}))`;
            if (op === 'Multiply') return `(funcs && funcs.mul ? funcs.mul(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[2], paramName, dependentVar)}) : (${this.toJS(node[1], paramName, dependentVar)} * ${this.toJS(node[2], paramName, dependentVar)}))`;
            if (op === 'Divide') return `(funcs && funcs.div ? funcs.div(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[2], paramName, dependentVar)}) : (${this.toJS(node[1], paramName, dependentVar)} / ${this.toJS(node[2], paramName, dependentVar)}))`;
            if (op === 'Power') return `funcs.realPow(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[2], paramName, dependentVar)})`;
            if (op === 'Cbrt') return `Math.cbrt(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Sin') return `Math.sin(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Cos') return `Math.cos(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Tan') return `Math.tan(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Sec') return `(1 / Math.cos(${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Csc') return `(1 / Math.sin(${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Cot') return `(1 / Math.tan(${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Asin') return `Math.asin(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Acos') return `Math.acos(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Atan') return `Math.atan(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Asec') return `Math.acos(1 / (${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Acsc') return `Math.asin(1 / (${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Acot') return `Math.atan(1 / (${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Sinh') return `Math.sinh(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Cosh') return `Math.cosh(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Tanh') return `Math.tanh(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Asinh') return `Math.asinh(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Acosh') return `Math.acosh(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Atanh') return `Math.atanh(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Nthroot') return `funcs.realPow(${this.toJS(node[1], paramName, dependentVar)}, 1 / (${this.toJS(node[2], paramName, dependentVar)}))`;
            if (op === 'Log') return `Math.log(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Abs') return `Math.abs(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Exp') return `Math.exp(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Sqrt') return `Math.sqrt(${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'Negate') return `(-${this.toJS(node[1], paramName, dependentVar)})`;
            if (op === 'List') return `[${node.slice(1).map((n: any) => this.toJS(n, paramName, dependentVar)).join(', ')}]`;
            if (op === 'Range') return `funcs.listEngine.generateRange(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[2], paramName, dependentVar)})`;
            if (op === 'RangeStep') return `funcs.listEngine.generateRange(${this.toJS(node[1], paramName, dependentVar)}, ${this.toJS(node[3], paramName, dependentVar)}, (${this.toJS(node[2], paramName, dependentVar)}) - (${this.toJS(node[1], paramName, dependentVar)}))`;
            if (op === 'Index') return `funcs.listEngine.evaluateIndex(${this.toJS(node[1], paramName, dependentVar)}, ${JSON.stringify(node.length === 3 ? node[2] : node.slice(2))}, scope, (a, s) => funcs.evaluateAST(a, s), ${JSON.stringify(typeof node[1] === 'string' ? node[1] : '')})`;
            if (op === 'MatrixIndex') return `funcs.matrixEngine.indexMatrix(${this.toJS(node[1], paramName, dependentVar)}, ${JSON.stringify(node[2])}, ${JSON.stringify(node[3])}, scope, (a, s) => funcs.evaluateAST(a, s))`;
            if (op === 'Comprehension') return `funcs.listEngine.evaluateComprehension(${JSON.stringify(node[1])}, ${JSON.stringify(node[2])}, scope, (a, s) => funcs.evaluateAST(a, s))`;
            if (op === 'MatrixComprehension') return `funcs.matrixEngine.generateMatrixComprehension(${JSON.stringify(node[1])}, ${JSON.stringify(node[2])}, scope, (a, s) => funcs.evaluateAST(a, s))`;
            if (op === 'PropertyAccess') {
                const targetJS = this.toJS(node[1], paramName, dependentVar);
                const prop = typeof node[2] === 'string' ? node[2].toLowerCase() : '';
                return `(funcs && funcs.evaluateAST ? funcs.evaluateAST(${JSON.stringify(node)}, typeof scope !== 'undefined' ? scope : { [${JSON.stringify(node[1])}]: ${targetJS} }) : (${targetJS} && ${targetJS}.${prop} !== undefined ? ${targetJS}.${prop} : 0))`;
            }
            if (op === 'Point') return `({ x: ${this.toJS(node[1], paramName, dependentVar)}, y: ${this.toJS(node[2], paramName, dependentVar)}${node.length > 3 ? `, z: ${this.toJS(node[3], paramName, dependentVar)}` : ''} })`;
            
            if (op === 'Integrate' && node.length > 3) {
                const integrandJson = JSON.stringify(node[1]);
                const intVar = typeof node[2] === 'string' ? node[2] : 'x';
                return `funcs.evaluateDefiniteIntegral(${integrandJson}, ${this.toJS(node[3], paramName, dependentVar)}, ${this.toJS(node[4], paramName, dependentVar)}, ${JSON.stringify(intVar)}, Object.assign({}, scope, { [${JSON.stringify(paramName)}]: x, [${JSON.stringify(dependentVar)}]: y }))`;
            }

            if (op === 'diff') {
                const exprJson = JSON.stringify(node[1]);
                const diffVar = typeof node[2] === 'string' ? node[2] : 'x';
                return `funcs.evaluateDerivative(${exprJson}, ${JSON.stringify(diffVar)}, Object.assign({}, scope, { [${JSON.stringify(paramName)}]: x, [${JSON.stringify(dependentVar)}]: y }))`;
            }

            // Trata chamadas customizadas ou não reconhecidas (ex: f(x) ou f(x, y) ou f(2, 3, 1, 0, 2))
            if (op === 'Call') {
                const fnName = node[1];
                const args = node.slice(2).map((n: any) => this.toJS(n, paramName, dependentVar));
                args.push('scope');
                return `(funcs[${JSON.stringify(fnName)}] ? funcs[${JSON.stringify(fnName)}](${args.join(', ')}) : 0)`;
            }
            
            // Funções que são parseadas como ["nome", arg1, ...] 
            // e que podem ser do utilizador (ex: f(2, 3, 1, 0, 2))
            const argsJS = node.slice(1).map((n: any) => this.toJS(n, paramName, dependentVar));
            argsJS.push('scope');
            return `(funcs[${JSON.stringify(op)}] ? funcs[${JSON.stringify(op)}](${argsJS.join(', ')}) : 0)`;
        }
        return '0';
    }

    private static compileCache: Record<string, (x: number, y: number, scope: Record<string, number>) => number> = {};

    static compile(ast: any, paramName: string = 'x', dependentVar: string = 'y'): (x: number, y: number, scope: Record<string, number>) => number {
        const cacheKey = JSON.stringify(ast) + '::' + paramName + '::' + dependentVar;
        if (MathEngine.compileCache[cacheKey]) {
            return MathEngine.compileCache[cacheKey] as any;
        }

        const jsCode = MathEngine.toJS(ast, paramName, dependentVar);
        const rawFunc = new Function('x', 'y', 'scope', 'funcs', `return ${jsCode};`);
        
        MathEngine.compiledFuncs['add'] = MathEngine.add;
        MathEngine.compiledFuncs['sub'] = MathEngine.sub;
        MathEngine.compiledFuncs['mul'] = MathEngine.mul;
        MathEngine.compiledFuncs['div'] = MathEngine.div;
        MathEngine.compiledFuncs['listEngine'] = ListEngine;
        MathEngine.compiledFuncs['matrixEngine'] = MatrixEngine;
        MathEngine.compiledFuncs['pointEngine'] = PointEngine;
        MathEngine.compiledFuncs['evaluateAST'] = (MathEngine as any).evaluateAST.bind(MathEngine);
        MathEngine.compiledFuncs['realPow'] = MathEngine.realPow;
        MathEngine.compiledFuncs['evaluateDefiniteIntegral'] = (MathEngine as any).evaluateDefiniteIntegral?.bind(MathEngine);
        MathEngine.compiledFuncs['evaluateDerivative'] = (MathEngine as any).evaluateDerivative?.bind(MathEngine);
        const compiled = (x: number, yOrScope?: number | Record<string, number>, maybeScope?: Record<string, number>) => {
            let y = 0;
            let scope: Record<string, number> = {};
            if (typeof yOrScope === 'object' && yOrScope !== null) {
                scope = yOrScope;
                y = 0;
            } else {
                if (typeof yOrScope === 'number') y = yOrScope;
                if (maybeScope && typeof maybeScope === 'object' && maybeScope !== null) scope = maybeScope;
            }
            return rawFunc(x, y, scope, MathEngine.compiledFuncs);
        };
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
                return `(scope[${JSON.stringify(clean)}] !== undefined ? scope[${JSON.stringify(clean)}] : 0)`;
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
                if (op === 'Sec') return `(1 / Math.cos(${toJS(node[1])}))`;
                if (op === 'Csc') return `(1 / Math.sin(${toJS(node[1])}))`;
                if (op === 'Cot') return `(1 / Math.tan(${toJS(node[1])}))`;
                if (op === 'Asin') return `Math.asin(${toJS(node[1])})`;
                if (op === 'Acos') return `Math.acos(${toJS(node[1])})`;
                if (op === 'Atan') return `Math.atan(${toJS(node[1])})`;
                if (op === 'Asec') return `Math.acos(1 / (${toJS(node[1])}))`;
                if (op === 'Acsc') return `Math.asin(1 / (${toJS(node[1])}))`;
                if (op === 'Acot') return `Math.atan(1 / (${toJS(node[1])}))`;
                if (op === 'Sinh') return `Math.sinh(${toJS(node[1])})`;
                if (op === 'Cosh') return `Math.cosh(${toJS(node[1])})`;
                if (op === 'Tanh') return `Math.tanh(${toJS(node[1])})`;
                if (op === 'Asinh') return `Math.asinh(${toJS(node[1])})`;
                if (op === 'Acosh') return `Math.acosh(${toJS(node[1])})`;
                if (op === 'Atanh') return `Math.atanh(${toJS(node[1])})`;
                if (op === 'Sqrt') return `Math.sqrt(${toJS(node[1])})`;
                if (op === 'Cbrt') return `Math.cbrt(${toJS(node[1])})`;
                if (op === 'Nthroot') return `funcs.realPow(${toJS(node[1])}, 1 / (${toJS(node[2])}))`;
                if (op === 'Abs') return `Math.abs(${toJS(node[1])})`;
                if (op === 'Exp') return `Math.exp(${toJS(node[1])})`;
                if (op === 'Log') return `Math.log(${toJS(node[1])})`;
                
                if (op === 'Integrate' && node.length > 3) {
                    const integrandJson = JSON.stringify(node[1]);
                    const intVar = typeof node[2] === 'string' ? node[2] : 'x';
                    const paramsJson = JSON.stringify(paramNames);
                    return `funcs.evaluateDefiniteIntegral(${integrandJson}, ${toJS(node[3])}, ${toJS(node[4])}, ${JSON.stringify(intVar)}, Object.assign({}, scope, Object.fromEntries(${paramsJson}.map((p, i) => [p, args[i] !== undefined ? args[i] : 0]))))`;
                }

                if (op === 'diff') {
                    const exprJson = JSON.stringify(node[1]);
                    const diffVar = typeof node[2] === 'string' ? node[2] : 'x';
                    const paramsJson = JSON.stringify(paramNames);
                    return `funcs.evaluateDerivative(${exprJson}, ${JSON.stringify(diffVar)}, Object.assign({}, scope, Object.fromEntries(${paramsJson}.map((p, i) => [p, args[i] !== undefined ? args[i] : 0]))))`;
                }

                const args = node.slice(1).map(toJS);
                args.push('scope');
                return `(funcs[${JSON.stringify(op)}] ? funcs[${JSON.stringify(op)}](${args.join(', ')}) : 0)`;
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
            MathEngine.compiledFuncs['evaluateDefiniteIntegral'] = (MathEngine as any).evaluateDefiniteIntegral?.bind(MathEngine);
            MathEngine.compiledFuncs['evaluateDerivative'] = (MathEngine as any).evaluateDerivative?.bind(MathEngine);
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
    static expandUserFunctions(ast: any, depth: number = 0): any {
        if (depth > 12) return ast;
        if (typeof ast === 'string' || typeof ast === 'number') return ast;
        if (Array.isArray(ast)) {
            const op = ast[0];
            const def = MathEngine.userFunctions[op];
            if (def) {
                const mapping: Record<string, any> = {};
                for (let i = 0; i < def.params.length; i++) {
                    const p = def.params[i];
                    mapping[p] = this.expandUserFunctions(ast[i + 1] ?? p, depth + 1);
                }
                const substituted = this.substituteAST(def.ast, mapping);
                return this.expandUserFunctions(substituted, depth + 1);
            }
            return [op, ...ast.slice(1).map(child => this.expandUserFunctions(child, depth))];
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
                return `{min: (scope[${JSON.stringify(cleanNode)}] || 0), max: (scope[${JSON.stringify(cleanNode)}] || 0)}`;
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
                if (op === 'Integrate' || op === 'diff') return '{min: -Infinity, max: Infinity}';
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
            if (b.min === b.max && Math.round(b.min) === b.min) {
                const n = Math.round(b.min);
                if (n === 0) return { min: 1, max: 1 };
                if (n % 2 === 0) {
                    if (a.min <= 0 && a.max >= 0) {
                        return { min: 0, max: Math.max(Math.pow(a.min, n), Math.pow(a.max, n)) };
                    }
                    const v1 = Math.pow(a.min, n);
                    const v2 = Math.pow(a.max, n);
                    return { min: Math.min(v1, v2), max: Math.max(v1, v2) };
                } else {
                    const v1 = MathEngine.realPow(a.min, n);
                    const v2 = MathEngine.realPow(a.max, n);
                    return { min: Math.min(v1, v2), max: Math.max(v1, v2) };
                }
            }
            const p1 = MathEngine.realPow(a.min, b.min);
            const p2 = MathEngine.realPow(a.min, b.max);
            const p3 = MathEngine.realPow(a.max, b.min);
            const p4 = MathEngine.realPow(a.max, b.max);
            const valid = [p1, p2, p3, p4].filter(x => !isNaN(x) && isFinite(x));
            if (valid.length === 0) return { min: 0, max: 0 };
            return { min: Math.min(...valid), max: Math.max(...valid) };
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

    /**
     * Avaliação numérica rápida e ultra-precisa de integrais definidas via Regra de Simpson 1/3 composta
     */
    static evaluateDefiniteIntegral(ast: any, lower: number, upper: number, variable: string = 'x', scope: Record<string, number> = {}): number {
        if (isNaN(lower) || !isFinite(lower) || isNaN(upper) || !isFinite(upper)) return NaN;
        if (lower === upper) return 0;
        const fastF = this.compile(ast, variable, '__unused__');
        const n = 200; // 400 subintervalos para máxima convergência
        const h = (upper - lower) / (2 * n);
        let sum = fastF(lower, 0, scope) + fastF(upper, 0, scope);
        for (let i = 1; i < 2 * n; i++) {
            const x = lower + i * h;
            const y = fastF(x, 0, scope);
            if (isNaN(y) || !isFinite(y)) return NaN;
            sum += (i % 2 === 1 ? 4 : 2) * y;
        }
        return (h / 3) * sum;
    }

    /**
     * Avaliação numérica de derivadas via diferença central
     */
    static evaluateDerivative(ast: any, variable: string = 'x', scope: Record<string, number> = {}): number {
        const h = 1e-5;
        const curVal = scope[variable] ?? 0;
        const scopePlus = Object.assign({}, scope, { [variable]: curVal + h });
        const scopeMinus = Object.assign({}, scope, { [variable]: curVal - h });
        const fPlus = this.compile(ast, variable)(curVal + h, 0, scopePlus);
        const fMinus = this.compile(ast, variable)(curVal - h, 0, scopeMinus);
        return (fPlus - fMinus) / (2 * h);
    }

    static initCompiledFuncs() {
        this.compiledFuncs['add'] = this.add;
        this.compiledFuncs['sub'] = this.sub;
        this.compiledFuncs['mul'] = this.mul;
        this.compiledFuncs['div'] = this.div;
        this.compiledFuncs['listEngine'] = ListEngine;
        this.compiledFuncs['matrixEngine'] = MatrixEngine;
        this.compiledFuncs['pointEngine'] = PointEngine;
        this.compiledFuncs['evaluateAST'] = (MathEngine as any).evaluateAST.bind(MathEngine);
        this.compiledFuncs['realPow'] = MathEngine.realPow;
        this.compiledFuncs['evaluateDefiniteIntegral'] = (MathEngine as any).evaluateDefiniteIntegral?.bind(MathEngine);
        this.compiledFuncs['evaluateDerivative'] = (MathEngine as any).evaluateDerivative?.bind(MathEngine);
    }
}

// Inicializa o dicionário de funções pré-compiladas
MathEngine.initCompiledFuncs();