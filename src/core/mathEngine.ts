import { ListEngine } from './listEngine';
import { MatrixEngine } from './matrixEngine';
import { PointEngine, type Point } from './pointEngine';
import { DesmosSemanticError } from './policy';

export class MathEngine {
    public static readonly WINDOW_GLOBALS = new Set([
        'window', 'document', 'location', 'navigator', 'screen', 'history',
        'top', 'self', 'parent', 'frames', 'length', 'name', 'status', 'closed',
        'origin', 'opener', 'frameElement', 'customElements', 'crypto', 'sessionStorage', 'localStorage'
    ]);
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
        'reducedrowechelonform', 'rref', 'svd', 'transpose', 'tran', 'trace', 'tr',
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
            if (clean === 'infty' || clean === 'infinity' || clean === '∞') return 'infinity';
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
    static userFunctions: Record<string, {
        params: string[];
        expr: string;
        ast: any;
        blockId?: string;
        baseCases?: Array<{ args: any[]; ast: any; blockId?: string }>;
    }> = {};
    static userBaseCases: Record<string, Array<{ args: any[]; ast: any; blockId?: string }>> = {};
    static variableAsts: Record<string, any> = {};
    static globalAstProvider: (() => Record<string, any>) | null = null;
    static globalValues: Record<string, any> = {};
    static globalScopeProvider: (() => Record<string, any>) | null = null;
    static angleModeProvider: (() => 'radians' | 'degrees') | null = null;
    static _callDepth: number = 0;
    static MAX_CALL_DEPTH: number = 250;
    static _dynVarDepth: number = 0;
    static MAX_DYN_VAR_DEPTH: number = 64;
    static _dynVarStack: Set<string> = new Set();

    static evalProperty(target: any, rawProp: string): any {
        const prop = typeof rawProp === 'string' ? rawProp.toLowerCase() : '';
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
            if (prop === 'mean') return ListEngine.mean(target);
            if (prop === 'median') return ListEngine.median(target);
            if (prop === 'var' || prop === 'variance' || prop === 'samplevariance') return ListEngine.variance(target);
            if (prop === 'stdev' || prop === 'stddev' || prop === 'samplesd') return ListEngine.stdev(target);
            if (prop === 'varp') return ListEngine.varp(target);
            if (prop === 'stdevp') return ListEngine.stdevp(target);
            if (prop === 'mad') return ListEngine.mad(target);
            if (prop === 'total' || prop === 'sum') return target.reduce((a, b) => a + Number(b), 0);
            if (prop === 'min') return target.length > 0 ? Math.min(...target.map(Number)) : NaN;
            if (prop === 'max') return target.length > 0 ? Math.max(...target.map(Number)) : NaN;
        }
        return NaN;
    }

    static toRad(val: number): number {
        const mode = this.angleModeProvider ? this.angleModeProvider() : 'radians';
        return mode === 'degrees' ? (val * Math.PI) / 180 : val;
    }

    static fromRad(val: number): number {
        const mode = this.angleModeProvider ? this.angleModeProvider() : 'radians';
        return mode === 'degrees' ? (val * 180) / Math.PI : val;
    }

    static throwUndefinedFunction(fnName: string): never {
        throw new DesmosSemanticError(`A função '${fnName}' não está definida.`, 'UNDEFINED_FUNCTION');
    }

    static getGlobalScope(): Record<string, any> {
        return this.globalScopeProvider ? this.globalScopeProvider() : this.globalValues;
    }

    static getVariableAst(name: string): any {
        const asts = this.globalAstProvider ? this.globalAstProvider() : null;
        if (asts && asts[name] !== undefined) return asts[name];
        if (this.variableAsts[name] !== undefined) return this.variableAsts[name];
        return undefined;
    }

    static withLocalBindings(
        baseScope: Record<string, any> | undefined | null,
        bindings: Record<string, any>
    ): Record<string, any> {
        const globals = this.getGlobalScope();
        if (!baseScope || baseScope === globals) {
            return { ...bindings };
        }
        return { ...baseScope, ...bindings };
    }

    static valuesEqual(a: any, b: any): boolean {
        if (typeof a === 'number' && typeof b === 'number') {
            if (isNaN(a) && isNaN(b)) return true;
            return Math.abs(a - b) <= 1e-12;
        }
        if (PointEngine.isPoint(a) && PointEngine.isPoint(b)) {
            return Math.abs(a.x - b.x) <= 1e-12 &&
                Math.abs(a.y - b.y) <= 1e-12 &&
                Math.abs((a.z ?? 0) - (b.z ?? 0)) <= 1e-12;
        }
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((v, i) => this.valuesEqual(v, b[i]));
        }
        return a === b;
    }

    static astHasLocalDependency(
        ast: any,
        scope: Record<string, any>,
        globals: Record<string, any> | null,
        visited: Set<string> = new Set()
    ): boolean {
        if (ast === null || ast === undefined || typeof ast === 'number') return false;
        if (typeof ast === 'string') {
            const rawVar = ast.replace(/[\{\}\\]/g, '').trim();
            const clean = rawVar.toLowerCase();
            if (!rawVar || clean === 'pi' || clean === 'π' || clean === 'e' || clean === 'inf' || clean === 'infty' || clean === 'infinity' || rawVar === '∞') {
                return false;
            }
            if (scope && scope !== globals && (scope[ast] !== undefined || scope[rawVar] !== undefined || scope[clean] !== undefined)) {
                if (!globals || scope[rawVar] !== globals[rawVar]) return true;
            }
            if (!visited.has(rawVar)) {
                const nestedAst = this.getVariableAst(rawVar) ?? this.getVariableAst(ast);
                if (nestedAst !== undefined) {
                    visited.add(rawVar);
                    return this.astHasLocalDependency(nestedAst, scope, globals, visited);
                }
            }
            return false;
        }
        if (Array.isArray(ast)) {
            for (let i = 1; i < ast.length; i++) {
                if (this.astHasLocalDependency(ast[i], scope, globals, visited)) return true;
            }
        }
        return false;
    }

    static resolveDynamicVar(astName: string, scope: Record<string, any> = {}): any {
        const rawVar = astName.replace(/[\{\}\\]/g, '').trim();
        const clean = rawVar.toLowerCase();
        if (clean === 'pi' || clean === 'π') return Math.PI;
        if (clean === 'e') return Math.E;
        if (clean === 'inf' || clean === 'infty' || clean === 'infinity' || rawVar === '∞') return Infinity;

        const globals = this.getGlobalScope();

        // 1. Escopo local explícito (parâmetros de função, 'with', comprehension)
        if (scope && scope !== globals) {
            if (scope[astName] !== undefined) return scope[astName];
            if (scope[rawVar] !== undefined) return scope[rawVar];
            if (scope[clean] !== undefined) return scope[clean];
        }

        // 2. Valor global em cache, exceto quando há AST dinâmica dependente de escopo local (Wackscope)
        const varAst = this.getVariableAst(rawVar) ?? this.getVariableAst(astName);
        const hasGlobalVal = Boolean(globals && (
            (globals[astName] !== undefined && !(typeof globals[astName] === 'number' && isNaN(globals[astName]))) ||
            (globals[rawVar] !== undefined && !(typeof globals[rawVar] === 'number' && isNaN(globals[rawVar])))
        ));

        if (varAst !== undefined) {
            const needsDynamicEval = !hasGlobalVal || this.astHasLocalDependency(varAst, scope, globals);
            if (needsDynamicEval) {
                if (this._dynVarDepth >= this.MAX_DYN_VAR_DEPTH || this._dynVarStack.has(rawVar)) {
                    return NaN;
                }
                this._dynVarDepth++;
                this._dynVarStack.add(rawVar);
                try {
                    return this.evaluateAST(varAst, scope);
                } finally {
                    this._dynVarStack.delete(rawVar);
                    this._dynVarDepth--;
                }
            }
        }

        // 3. Fallback para escopo global (StateManager.values) preservando case-sensitivity
        if (globals) {
            if (globals[astName] !== undefined) return globals[astName];
            if (globals[rawVar] !== undefined) return globals[rawVar];
        }

        const parsed = parseFloat(clean);
        if (!isNaN(parsed) && isFinite(parsed)) return parsed;
        return NaN;
    }

    static matchBaseCase(
        fnName: string,
        evalArgs: any[],
        scope: Record<string, any> = {}
    ): { matched: boolean; ast?: any } {
        const fnDef = this.userFunctions[fnName];
        const cases = (this.userBaseCases[fnName] && this.userBaseCases[fnName].length > 0)
            ? this.userBaseCases[fnName]
            : (fnDef?.baseCases || []);
        if (!cases || cases.length === 0) return { matched: false };

        for (const bc of cases) {
            if (!bc || !Array.isArray(bc.args) || bc.args.length !== evalArgs.length) continue;
            let allMatch = true;
            for (let i = 0; i < evalArgs.length; i++) {
                const expectedVal = typeof bc.args[i] === 'number' ? bc.args[i] : this.evaluateAST(bc.args[i], scope);
                if (!this.valuesEqual(evalArgs[i], expectedVal)) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) {
                return { matched: true, ast: bc.ast };
            }
        }
        return { matched: false };
    }

    static isFunctionRecursive(fnName: string, visited: Set<string> = new Set()): boolean {
        const def = this.userFunctions[fnName];
        if (!def) return false;
        const nextVisited = new Set(visited);
        nextVisited.add(fnName);
        const walk = (node: any): boolean => {
            if (!Array.isArray(node) || node.length === 0) return false;
            const op = node[0];
            if (op === 'Call' && typeof node[1] === 'string') {
                const target = node[1].trim();
                if (nextVisited.has(target)) return true;
                if (this.userFunctions[target] && this.isFunctionRecursive(target, nextVisited)) return true;
            } else if (typeof op === 'string' && this.userFunctions[op]) {
                if (nextVisited.has(op)) return true;
                if (this.isFunctionRecursive(op, nextVisited)) return true;
            }
            for (let i = 1; i < node.length; i++) {
                if (walk(node[i])) return true;
            }
            return false;
        };
        return walk(def.ast);
    }

    static callUserFunction(
        fnName: string,
        evalArgs: any[],
        scope: Record<string, any> = {},
        fastCompiledFn?: (...args: any[]) => any
    ): any {
        if (this._callDepth >= this.MAX_CALL_DEPTH) {
            throw new DesmosSemanticError(
                `Limite máximo de recursão (${this.MAX_CALL_DEPTH}) atingido ao avaliar '${fnName}'.`,
                'RECURSION_LIMIT_EXCEEDED'
            );
        }

        this._callDepth++;
        try {
            const baseMatch = this.matchBaseCase(fnName, evalArgs, scope);
            if (baseMatch.matched) {
                return this.evaluateAST(baseMatch.ast, scope);
            }

            const userFn = this.userFunctions[fnName];
            if (!userFn) {
                return this.throwUndefinedFunction(fnName);
            }

            if (fastCompiledFn && !evalArgs.some(a => a !== null && typeof a === 'object')) {
                return fastCompiledFn(...evalArgs, scope);
            }

            const paramBindings: Record<string, any> = {};
            userFn.params.forEach((param, idx) => {
                paramBindings[param] = evalArgs[idx];
            });
            const localScope = this.withLocalBindings(scope, paramBindings);
            return this.evaluateAST(userFn.ast, localScope);
        } finally {
            this._callDepth--;
        }
    }

    static makeUserFuncWrapper(funcName: string, params: string[], ast: any): (...args: any[]) => any {
        const compiledFast = this.compileMultivariable(ast, params);
        return (...rawArgs: any[]) => {
            let callArgs = rawArgs;
            let scope: Record<string, any> = {};
            if (
                rawArgs.length > params.length &&
                typeof rawArgs[rawArgs.length - 1] === 'object' &&
                rawArgs[rawArgs.length - 1] !== null &&
                !Array.isArray(rawArgs[rawArgs.length - 1])
            ) {
                callArgs = rawArgs.slice(0, rawArgs.length - 1);
                scope = rawArgs[rawArgs.length - 1];
            }
            return this.callUserFunction(funcName, callArgs, scope, compiledFast);
        };
    }

    static cross(a: any, b: any): any {
        if (Array.isArray(a) && Array.isArray(b)) {
            const minLen = Math.min(a.length, b.length);
            const res: any[] = new Array(minLen);
            for (let i = 0; i < minLen; i++) {
                res[i] = MathEngine.cross(a[i], b[i]);
            }
            return res;
        }
        if (Array.isArray(a) && !Array.isArray(b)) {
            return a.map((item: any) => MathEngine.cross(item, b));
        }
        if (!Array.isArray(a) && Array.isArray(b)) {
            return b.map((item: any) => MathEngine.cross(a, item));
        }
        if (PointEngine.isPoint(a) && PointEngine.isPoint(b)) return PointEngine.cross(a, b);
        if (typeof a === 'number' && typeof b === 'number') return a * b;
        if (PointEngine.isPoint(a) || PointEngine.isPoint(b)) {
            throw new DesmosSemanticError(
                'O produto vetorial (\\times / cross) requer pontos 3D; pontos 2D ou mistos não são suportados.',
                'CROSS_PRODUCT_TYPE_ERROR'
            );
        }
        return NaN;
    }

    static midpoint(a: any, b: any): any {
        if (Array.isArray(a) && Array.isArray(b)) {
            const minLen = Math.min(a.length, b.length);
            const res: any[] = new Array(minLen);
            for (let i = 0; i < minLen; i++) {
                res[i] = MathEngine.midpoint(a[i], b[i]);
            }
            return res;
        }
        if (Array.isArray(a) && !Array.isArray(b)) {
            return a.map((item: any) => MathEngine.midpoint(item, b));
        }
        if (!Array.isArray(a) && Array.isArray(b)) {
            return b.map((item: any) => MathEngine.midpoint(a, item));
        }
        if (PointEngine.isPoint(a) && PointEngine.isPoint(b)) {
            return PointEngine.midpoint(a, b);
        }
        return NaN;
    }

    static nCr(nRaw: number, kRaw: number): number {
        const n = Math.round(nRaw);
        const k = Math.round(kRaw);
        if (!isFinite(nRaw) || !isFinite(kRaw) || n < 0) return NaN;
        if (k < 0 || k > n) return 0;
        const r = Math.min(k, n - k);
        let res = 1;
        for (let i = 1; i <= r; i++) {
            res = (res * (n - r + i)) / i;
        }
        return Math.round(res);
    }

    static nPr(nRaw: number, kRaw: number): number {
        const n = Math.round(nRaw);
        const k = Math.round(kRaw);
        if (!isFinite(nRaw) || !isFinite(kRaw) || n < 0) return NaN;
        if (k < 0 || k > n) return 0;
        let res = 1;
        for (let i = 0; i < k; i++) {
            res *= (n - i);
        }
        return res;
    }

    static gcd(...rawArgs: any[]): number {
        const flat: any[] = rawArgs.length === 1 && Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
        if (flat.length === 0) return NaN;
        const gcd2 = (a: number, b: number): number => {
            a = Math.abs(Math.round(a));
            b = Math.abs(Math.round(b));
            while (b !== 0) {
                const t = b;
                b = a % b;
                a = t;
            }
            return a;
        };
        let acc = Number(flat[0]);
        if (!isFinite(acc)) return NaN;
        acc = Math.abs(Math.round(acc));
        for (let i = 1; i < flat.length; i++) {
            const val = Number(flat[i]);
            if (!isFinite(val)) return NaN;
            acc = gcd2(acc, val);
        }
        return acc;
    }

    static lcm(...rawArgs: any[]): number {
        const flat: any[] = rawArgs.length === 1 && Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
        if (flat.length === 0) return NaN;
        let acc = Number(flat[0]);
        if (!isFinite(acc)) return NaN;
        acc = Math.abs(Math.round(acc));
        for (let i = 1; i < flat.length; i++) {
            const val = Number(flat[i]);
            if (!isFinite(val)) return NaN;
            const b = Math.abs(Math.round(val));
            if (acc === 0 || b === 0) {
                acc = 0;
            } else {
                const g = MathEngine.gcd(acc, b);
                acc = (acc / g) * b;
            }
        }
        return acc;
    }

    static mod(a: number, b: number): number {
        if (!isFinite(a) || !isFinite(b) || b === 0) return NaN;
        return ((a % b) + b) % b;
    }

    /**
     * Função erro gaussiana erf(x) com precisão de máquina via série de potências para |x| < 4
     * e aproximação racional assintótica para |x| >= 4.
     */
    static erf(x: number): number {
        if (isNaN(x)) return NaN;
        if (x === 0) return 0;
        if (x === Infinity) return 1;
        if (x === -Infinity) return -1;
        const sign = x < 0 ? -1 : 1;
        const ax = Math.abs(x);
        if (ax < 4) {
            const x2 = ax * ax;
            let term = ax;
            let sum = ax;
            for (let n = 1; n <= 65; n++) {
                term *= -x2 / n;
                const add = term / (2 * n + 1);
                sum += add;
                if (Math.abs(add) < 1e-16 * Math.abs(sum)) break;
            }
            return sign * (2 / Math.sqrt(Math.PI)) * sum;
        }
        const t = 1 / (1 + 0.3275911 * ax);
        const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
        return sign * (1 - poly * Math.exp(-ax * ax));
    }

    /**
     * Arredondamento padrão Desmos com suporte opcional a casas decimais negativas (ex: round(1234, -2) = 1200)
     */
    static round(val: number, decimals: number = 0): number {
        if (!isFinite(val) || isNaN(decimals)) return Math.round(val);
        const d = Math.trunc(decimals);
        if (d === 0) return Math.round(val);
        if (d < 0) {
            const factor = Math.pow(10, -d);
            return Math.round(val / factor) * factor;
        }
        const factor = Math.pow(10, d);
        return Math.round((val + Number.EPSILON * Math.sign(val)) * factor) / factor;
    }

    /**
     * Simplifica frações racionais simbólicas vindas do Giac (ex: 4*pi/8 -> pi/2, 4/8 -> 1/2, 1*x -> x)
     */
    static normalizeFractionDisplay(raw: string): string {
        if (!raw || typeof raw !== 'string') return raw;
        const gcdInt = (a: number, b: number): number => {
            a = Math.abs(a);
            b = Math.abs(b);
            while (b !== 0) {
                const t = a % b;
                a = b;
                b = t;
            }
            return a || 1;
        };

        let res = raw.trim();
        // (num*sym)/den ou num*sym/den
        res = res.replace(/\(?(\d+)\s*\*\s*(pi|sqrt\([^()]+\)|[a-zA-Z_]\w*)\)?\s*\/\s*(\d+)(?![.\d])/g, (m, nStr, sym, dStr) => {
            const n = parseInt(nStr, 10);
            const d = parseInt(dStr, 10);
            if (!d) return m;
            const g = gcdInt(n, d);
            const rn = n / g;
            const rd = d / g;
            if (rd === 1) return rn === 1 ? sym : `${rn}*${sym}`;
            return rn === 1 ? `${sym}/${rd}` : `${rn}*${sym}/${rd}`;
        });
        // Frações inteiras isoladas num/den (ex: 4/8 -> 1/2, 8/4 -> 2)
        res = res.replace(/(?<![.\d\w])(\d+)\s*\/\s*(\d+)(?![.\d\w])/g, (m, nStr, dStr) => {
            const n = parseInt(nStr, 10);
            const d = parseInt(dStr, 10);
            if (!d) return m;
            const g = gcdInt(n, d);
            const rn = n / g;
            const rd = d / g;
            return rd === 1 ? `${rn}` : `${rn}/${rd}`;
        });
        // Remove multiplicações redundantes por 1
        res = res.replace(/(^|[+\-(\s,])1\*(?=[a-zA-Z(])/g, '$1');
        res = res.replace(/\*1(?=$|[+\-)\s,])/g, '');
        return res;
    }

    static ensureCompiledFuncs() {
        this.compiledFuncs['toRad'] = (x: number) => MathEngine.toRad(x);
        this.compiledFuncs['fromRad'] = (x: number) => MathEngine.fromRad(x);
        this.compiledFuncs['add'] = MathEngine.add;
        this.compiledFuncs['sub'] = MathEngine.sub;
        this.compiledFuncs['mul'] = MathEngine.mul;
        this.compiledFuncs['div'] = MathEngine.div;
        this.compiledFuncs['cross'] = MathEngine.cross;
        this.compiledFuncs['midpoint'] = MathEngine.midpoint;
        this.compiledFuncs['nCr'] = MathEngine.nCr;
        this.compiledFuncs['binom'] = MathEngine.nCr;
        this.compiledFuncs['nPr'] = MathEngine.nPr;
        this.compiledFuncs['gcd'] = MathEngine.gcd;
        this.compiledFuncs['lcm'] = MathEngine.lcm;
        this.compiledFuncs['mod'] = MathEngine.mod;
        this.compiledFuncs['erf'] = (x: any) => Array.isArray(x) ? x.map((v: any) => MathEngine.erf(Number(v))) : MathEngine.erf(Number(x));
        this.compiledFuncs['floor'] = Math.floor;
        this.compiledFuncs['ceil'] = Math.ceil;
        this.compiledFuncs['round'] = (val: any, dec: any = 0) => {
            if (Array.isArray(val) || Array.isArray(dec)) {
                const aArr = Array.isArray(val) ? val : [val];
                const dArr = Array.isArray(dec) ? dec : [dec];
                const len = Math.max(aArr.length, dArr.length);
                return Array.from({ length: len }, (_, i) => MathEngine.round(Number(aArr[i % aArr.length]), Number(dArr[i % dArr.length])));
            }
            return MathEngine.round(Number(val), Number(dec));
        };
        this.compiledFuncs['sign'] = Math.sign;
        this.compiledFuncs['sgn'] = Math.sign;
        this.compiledFuncs['listEngine'] = ListEngine;
        this.compiledFuncs['matrixEngine'] = MatrixEngine;
        this.compiledFuncs['pointEngine'] = PointEngine;
        this.compiledFuncs['evaluateAST'] = (MathEngine as any).evaluateAST.bind(MathEngine);
        this.compiledFuncs['evalProperty'] = (target: any, prop: string) => MathEngine.evalProperty(target, prop);
        this.compiledFuncs['realPow'] = MathEngine.realPow;
        this.compiledFuncs['evaluateDefiniteIntegral'] = (MathEngine as any).evaluateDefiniteIntegral?.bind(MathEngine);
        this.compiledFuncs['evaluateDerivative'] = (MathEngine as any).evaluateDerivative?.bind(MathEngine);
        this.compiledFuncs['withLocalBindings'] = (base: any, bindings: any) => MathEngine.withLocalBindings(base, bindings);
        this.compiledFuncs['resolveVar'] = (name: string, scope: Record<string, any> = {}) => MathEngine.resolveDynamicVar(name, scope);
        this.compiledFuncs['callUserFunc'] = (fnName: string, callArgs: any[], scope: Record<string, any> = {}) => MathEngine.callUserFunction(fnName, callArgs, scope);
        this.compiledFuncs['resolveOrThrow'] = (fnName: string, callArgs: any[], scope: Record<string, any> = {}) => MathEngine.resolveOrThrow(fnName, callArgs, scope);
        this.compiledFuncs['undefinedFunc'] = MathEngine.throwUndefinedFunction;
    }

    static evaluateAST(ast: any, scope: Record<string, any> = {}): any {
        if (ast === null || ast === undefined) return NaN;
        if (typeof ast === 'number') return ast;
        if (typeof ast === 'string') {
            return this.resolveDynamicVar(ast, scope);
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
                if (fn === 'sin') return Math.sin(this.toRad(args[0]));
                if (fn === 'cos') return Math.cos(this.toRad(args[0]));
                if (fn === 'tan') return Math.tan(this.toRad(args[0]));
                if (fn === 'sec') return 1 / Math.cos(this.toRad(args[0]));
                if (fn === 'csc') return 1 / Math.sin(this.toRad(args[0]));
                if (fn === 'cot') return 1 / Math.tan(this.toRad(args[0]));
                if (fn === 'sqrt') return Math.sqrt(args[0]);
                if (fn === 'cbrt') return Math.cbrt(args[0]);
                if (fn === 'abs') return Math.abs(args[0]);
                if (fn === 'exp') return Math.exp(args[0]);
                if (fn === 'ln') return Math.log(args[0]);
                if (fn === 'log') return args.length > 1 ? (Math.log(args[1]) / Math.log(args[0])) : Math.log10(args[0]);
                if (fn === 'asin') return this.fromRad(Math.asin(args[0]));
                if (fn === 'acos') return this.fromRad(Math.acos(args[0]));
                if (fn === 'atan') return this.fromRad(args.length > 1 ? Math.atan2(args[0], args[1]) : Math.atan(args[0]));
                if (fn === 'asec') return this.fromRad(Math.acos(1 / args[0]));
                if (fn === 'acsc') return this.fromRad(Math.asin(1 / args[0]));
                if (fn === 'acot') return this.fromRad(Math.atan(1 / args[0]));
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

            // 1. Listas, Sequências Sintéticas, Compreensões e With
            if (op === 'List') {
                if (ast.length - 1 > ListEngine.MAX_ELEMENTS) {
                    throw new DesmosSemanticError('As listas não podem ter mais que 10.000 elementos.', 'LIST_LIMIT_EXCEEDED');
                }
                const items = ast.slice(1).map((item: any) => this.evaluateAST(item, scope));
                if (MatrixEngine.isMatrix(items)) {
                    MatrixEngine.validateDimensions(items.length, items[0].length);
                }
                return items;
            }
            if (op === 'With') {
                const localScope: Record<string, any> = this.withLocalBindings(scope, {});
                const bindings = Array.isArray(ast[2]) ? ast[2] : [];
                for (const [varName, valAst] of bindings) {
                    localScope[varName] = this.evaluateAST(valAst, scope);
                }
                return this.evaluateAST(ast[1], localScope);
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
                const prop = typeof ast[2] === 'string' ? ast[2] : '';
                return MathEngine.evalProperty(target, prop);
            }
            if (op === 'Piecewise') {
                return this.evaluatePiecewise(ast.slice(1), scope);
            }
            if (op === 'Cross') {
                const L = this.evaluateAST(ast[1], scope);
                const R = this.evaluateAST(ast[2], scope);
                return MathEngine.cross(L, R);
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

            // 2. Comandos Estatísticos, Cálculo, Matriciais, Escalares e Geométricos Diretos (0ms sem WebAssembly)
            const opLower = typeof op === 'string' ? op.toLowerCase() : '';
            if (opLower === 'integrate') {
                if (ast.length > 3) {
                    const low = Number(this.evaluateAST(ast[3], scope));
                    const upp = Number(this.evaluateAST(ast[4], scope));
                    const intVar = typeof ast[2] === 'string' ? ast[2] : 'x';
                    return MathEngine.evaluateDefiniteIntegral(ast[1], low, upp, intVar, scope);
                }
                return NaN;
            }
            if (opLower === 'diff' || opLower === 'derivative') {
                const diffVar = typeof ast[2] === 'string' ? ast[2] : 'x';
                return MathEngine.evaluateDerivative(ast[1], diffVar, scope);
            }
            if (opLower === 'sum' || opLower === 'total' || opLower === 'product' || opLower === 'prod') {
                const isProd = opLower === 'product' || opLower === 'prod';
                if (ast.length === 5) {
                    const iterVar = typeof ast[2] === 'string' ? ast[2].trim() : '';
                    if (!iterVar) return NaN;
                    const startVal = Number(this.evaluateAST(ast[3], scope));
                    const endVal = Number(this.evaluateAST(ast[4], scope));
                    if (isNaN(startVal) || isNaN(endVal) || !isFinite(startVal) || !isFinite(endVal)) return NaN;
                    const count = Math.floor(endVal - startVal + 1e-12) + 1;
                    if (count <= 0) return isProd ? 1 : 0;
                    if (count > 100000) {
                        throw new DesmosSemanticError('Limite de iterações excedido no somatório/produtório (máx: 100.000).', 'ITERATION_LIMIT_EXCEEDED');
                    }
                    const loopScope: Record<string, any> = { ...scope };
                    let acc: any = null;
                    for (let idx = 0; idx < count; idx++) {
                        loopScope[iterVar] = startVal + idx;
                        const term = this.evaluateAST(ast[1], loopScope);
                        if (acc === null) {
                            acc = term;
                        } else if (!isProd) {
                            acc = MathEngine.add(acc, term);
                        } else {
                            acc = MathEngine.mul(acc, term);
                        }
                    }
                    return acc === null ? (isProd ? 1 : 0) : acc;
                }
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list)) {
                    return isProd
                        ? list.reduce((a, b) => a * Number(b), 1)
                        : list.reduce((a, b) => a + Number(b), 0);
                }
                return NaN;
            }
            if (opLower === 'mean') {
                return ListEngine.mean(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'length' || opLower === 'size' || opLower === 'count') {
                const list = this.evaluateAST(ast[1], scope);
                if (Array.isArray(list)) return list.length;
                if (PointEngine.isPoint(list)) return PointEngine.magnitude(list);
                return NaN;
            }
            if (opLower === 'min') {
                const args = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                if (args.length === 1 && Array.isArray(args[0]) && args[0].length > 0) return Math.min(...args[0].map(Number));
                if (args.length > 1) return Math.min(...args.map(Number));
                return NaN;
            }
            if (opLower === 'max') {
                const args = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                if (args.length === 1 && Array.isArray(args[0]) && args[0].length > 0) return Math.max(...args[0].map(Number));
                if (args.length > 1) return Math.max(...args.map(Number));
                return NaN;
            }
            if (opLower === 'median') {
                return ListEngine.median(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'var' || opLower === 'variance' || opLower === 'samplevariance') {
                return ListEngine.variance(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'stdev' || opLower === 'stddev' || opLower === 'samplesd') {
                return ListEngine.stdev(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'varp') {
                return ListEngine.varp(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'stdevp') {
                return ListEngine.stdevp(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'mad') {
                return ListEngine.mad(this.evaluateAST(ast[1], scope));
            }
            if (opLower === 'quantile') {
                return ListEngine.quantile(this.evaluateAST(ast[1], scope), this.evaluateAST(ast[2], scope));
            }
            if (opLower === 'quartile') {
                return ListEngine.quartile(this.evaluateAST(ast[1], scope), this.evaluateAST(ast[2], scope));
            }
            if (opLower === 'cov') {
                return ListEngine.cov(this.evaluateAST(ast[1], scope), this.evaluateAST(ast[2], scope));
            }
            if (opLower === 'covp') {
                return ListEngine.covp(this.evaluateAST(ast[1], scope), this.evaluateAST(ast[2], scope));
            }
            if (opLower === 'corr') {
                return ListEngine.corr(this.evaluateAST(ast[1], scope), this.evaluateAST(ast[2], scope));
            }
            if (opLower === 'spearman') {
                return ListEngine.spearman(this.evaluateAST(ast[1], scope), this.evaluateAST(ast[2], scope));
            }
            if (opLower === 'random') {
                const args = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                return ListEngine.random(...args);
            }
            if (opLower === 'erf') {
                const val = this.evaluateAST(ast[1], scope);
                if (Array.isArray(val)) return val.map((v: any) => MathEngine.erf(Number(v)));
                return MathEngine.erf(Number(val));
            }
            if (opLower === 'round') {
                const val = this.evaluateAST(ast[1], scope);
                const dec = ast.length > 2 ? this.evaluateAST(ast[2], scope) : 0;
                if (Array.isArray(val) || Array.isArray(dec)) {
                    const vArr = Array.isArray(val) ? val : [val];
                    const dArr = Array.isArray(dec) ? dec : [dec];
                    const len = Math.max(vArr.length, dArr.length);
                    return Array.from({ length: len }, (_, i) => MathEngine.round(Number(vArr[i % vArr.length]), Number(dArr[i % dArr.length])));
                }
                return MathEngine.round(Number(val), Number(dec));
            }
            if (opLower === 'floor' || opLower === 'ceil' || opLower === 'sign' || opLower === 'sgn') {
                const val = this.evaluateAST(ast[1], scope);
                const fn = opLower === 'floor' ? Math.floor : opLower === 'ceil' ? Math.ceil : Math.sign;
                if (Array.isArray(val)) return val.map((v: any) => fn(Number(v)));
                return fn(Number(val));
            }
            if (opLower === 'mod') {
                const a = this.evaluateAST(ast[1], scope);
                const b = this.evaluateAST(ast[2], scope);
                if (Array.isArray(a) || Array.isArray(b)) {
                    const aArr = Array.isArray(a) ? a : [a];
                    const bArr = Array.isArray(b) ? b : [b];
                    const len = Math.max(aArr.length, bArr.length);
                    return Array.from({ length: len }, (_, i) => MathEngine.mod(Number(aArr[i % aArr.length]), Number(bArr[i % bArr.length])));
                }
                return MathEngine.mod(Number(a), Number(b));
            }
            if (opLower === 'gcd') {
                const args = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                return MathEngine.gcd(...args);
            }
            if (opLower === 'lcm') {
                const args = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                return MathEngine.lcm(...args);
            }
            if (opLower === 'ncr' || opLower === 'binom') {
                const n = this.evaluateAST(ast[1], scope);
                const k = this.evaluateAST(ast[2], scope);
                if (Array.isArray(n) || Array.isArray(k)) {
                    const nArr = Array.isArray(n) ? n : [n];
                    const kArr = Array.isArray(k) ? k : [k];
                    const len = Math.max(nArr.length, kArr.length);
                    return Array.from({ length: len }, (_, i) => MathEngine.nCr(Number(nArr[i % nArr.length]), Number(kArr[i % kArr.length])));
                }
                return MathEngine.nCr(Number(n), Number(k));
            }
            if (opLower === 'npr') {
                const n = this.evaluateAST(ast[1], scope);
                const k = this.evaluateAST(ast[2], scope);
                if (Array.isArray(n) || Array.isArray(k)) {
                    const nArr = Array.isArray(n) ? n : [n];
                    const kArr = Array.isArray(k) ? k : [k];
                    const len = Math.max(nArr.length, kArr.length);
                    return Array.from({ length: len }, (_, i) => MathEngine.nPr(Number(nArr[i % nArr.length]), Number(kArr[i % kArr.length])));
                }
                return MathEngine.nPr(Number(n), Number(k));
            }
            if (opLower === 'det' || opLower === 'determinant') {
                const mat = this.evaluateAST(ast[1], scope);
                return MatrixEngine.isMatrix(mat) ? MatrixEngine.determinant(mat) : NaN;
            }
            if (opLower === 'trace' || opLower === 'tr') {
                const mat = this.evaluateAST(ast[1], scope);
                return MatrixEngine.isMatrix(mat) ? MatrixEngine.trace(mat) : NaN;
            }
            if (opLower === 'rank' || opLower === 'matrixrank') {
                const mat = this.evaluateAST(ast[1], scope);
                return MatrixEngine.isMatrix(mat) ? MatrixEngine.rank(mat) : NaN;
            }
            if (opLower === 'rref' || opLower === 'reducedrowechelonform') {
                const mat = this.evaluateAST(ast[1], scope);
                return MatrixEngine.isMatrix(mat) ? MatrixEngine.rref(mat) : NaN;
            }
            if (opLower === 'inv' || opLower === 'invert') {
                const mat = this.evaluateAST(ast[1], scope);
                return MatrixEngine.isMatrix(mat) ? MatrixEngine.inverse(mat) : NaN;
            }
            if (opLower === 'transpose' || opLower === 'tran') {
                const mat = this.evaluateAST(ast[1], scope);
                return MatrixEngine.isMatrix(mat) ? MatrixEngine.transpose(mat) : NaN;
            }
            if (opLower === 'dot' || opLower === 'pointdot') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                return (PointEngine.isPoint(p1) && PointEngine.isPoint(p2)) ? PointEngine.dot(p1, p2) : NaN;
            }
            if (opLower === 'cross' || opLower === 'pointcross') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                return MathEngine.cross(p1, p2);
            }
            if (opLower === 'midpoint') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                return MathEngine.midpoint(p1, p2);
            }
            if (opLower === 'pointperp' || opLower === 'perp') {
                const p = this.evaluateAST(ast[1], scope);
                return PointEngine.isPoint(p) ? PointEngine.perp(p) : NaN;
            }
            if (opLower === 'distance') {
                const p1 = this.evaluateAST(ast[1], scope);
                const p2 = this.evaluateAST(ast[2], scope);
                return (PointEngine.isPoint(p1) && PointEngine.isPoint(p2)) ? PointEngine.distance(p1, p2) : NaN;
            }
            if (opLower === 'magnitude' || opLower === 'norm') {
                const p = this.evaluateAST(ast[1], scope);
                return PointEngine.isPoint(p) ? PointEngine.magnitude(p) : NaN;
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

            // 3. Avaliação direta de funções definidas pelo usuário (ex: ['f', 3] ou ['Call', 'f', 3])
            if (op === 'Call' && typeof ast[1] === 'string') {
                const fnName = ast[1].trim();
                const argsAst = ast.slice(2);
                if (MathEngine.userFunctions[fnName] || MathEngine.userBaseCases[fnName]?.length) {
                    const evalArgs = argsAst.map((a: any) => this.evaluateAST(a, scope));
                    return this.callUserFunction(fnName, evalArgs, scope);
                }
                return this.evaluateAST([fnName, ...argsAst], scope);
            }
            if (typeof op === 'string' && (MathEngine.userFunctions[op] || MathEngine.userBaseCases[op]?.length)) {
                const evalArgs = ast.slice(1).map((a: any) => this.evaluateAST(a, scope));
                return this.callUserFunction(op, evalArgs, scope);
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

            // 5. Operações Unárias com Suporte a Broadcasting (e arctan(y, x) binário)
            if (op === 'Atan' && ast.length > 2) {
                const y = this.evaluateAST(ast[1], scope);
                const x = this.evaluateAST(ast[2], scope);
                if (Array.isArray(y) || Array.isArray(x)) {
                    const yArr = Array.isArray(y) ? y : [y];
                    const xArr = Array.isArray(x) ? x : [x];
                    const len = Math.max(yArr.length, xArr.length);
                    return Array.from({ length: len }, (_, i) => this.fromRad(Math.atan2(Number(yArr[i % yArr.length]), Number(xArr[i % xArr.length]))));
                }
                return this.fromRad(Math.atan2(Number(y), Number(x)));
            }

            const unaryOps = new Set([
                'Negate', 'Abs', 'Sqrt', 'Cbrt',
                'Sin', 'Cos', 'Tan', 'Sec', 'Csc', 'Cot',
                'Log', 'Ln', 'Exp', 'Erf',
                'Asin', 'Acos', 'Atan', 'Asec', 'Acsc', 'Acot',
                'Sinh', 'Cosh', 'Tanh', 'Asinh', 'Acosh', 'Atanh'
            ]);

            if (unaryOps.has(op)) {
                const arg = this.evaluateAST(ast[1], scope);
                if (op === 'Erf') {
                    if (Array.isArray(arg)) return arg.map((v: any) => MathEngine.erf(Number(v)));
                    return MathEngine.erf(Number(arg));
                }
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
                if (op === 'Sin') return Math.sin(this.toRad(arg));
                if (op === 'Cos') return Math.cos(this.toRad(arg));
                if (op === 'Tan') return Math.tan(this.toRad(arg));
                if (op === 'Sec') return 1 / Math.cos(this.toRad(arg));
                if (op === 'Csc') return 1 / Math.sin(this.toRad(arg));
                if (op === 'Cot') return 1 / Math.tan(this.toRad(arg));
                if (op === 'Ln') return Math.log(arg);
                if (op === 'Log') return ast.length > 2 ? (Math.log(this.evaluateAST(ast[2], scope)) / Math.log(this.evaluateAST(ast[1], scope))) : Math.log10(arg);
                if (op === 'Exp') return Math.exp(arg);
                if (op === 'Asin') return this.fromRad(Math.asin(arg));
                if (op === 'Acos') return this.fromRad(Math.acos(arg));
                if (op === 'Atan') return this.fromRad(Math.atan(arg));
                if (op === 'Asec') return this.fromRad(Math.acos(1 / arg));
                if (op === 'Acsc') return this.fromRad(Math.asin(1 / arg));
                if (op === 'Acot') return this.fromRad(Math.atan(1 / arg));
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

        // Fallback rápido via compilador JIT nativo sem sobrescrever x/y do escopo
        try {
            const fn = this.compile(ast, '__unused_x__', '__unused_y__');
            return fn(NaN, NaN, scope);
        } catch (e) {
            if (e instanceof DesmosSemanticError) throw e;
            return NaN;
        }
    }

    static evaluatePiecewise(branches: Array<[any, any]>, scope: Record<string, any> = {}): any {
        if (branches.length === 0) return 1;
        let hasArrayCond = false;
        const evaluatedConds: any[] = new Array(branches.length);

        for (let i = 0; i < branches.length; i++) {
            const [condAst, valAst] = branches[i];
            if (condAst === null || condAst === undefined) {
                return this.evaluateAST(valAst, scope);
            }
            const condRes = this.evaluateAST(condAst, scope);
            if (Array.isArray(condRes)) {
                hasArrayCond = true;
                evaluatedConds[i] = condRes;
                break;
            }
            evaluatedConds[i] = condRes;
            const isTrue = condRes === true || (typeof condRes === 'number' && !isNaN(condRes) && condRes !== 0);
            if (isTrue) {
                return this.evaluateAST(valAst, scope);
            }
        }

        if (!hasArrayCond) {
            return NaN;
        }

        for (let i = 0; i < branches.length; i++) {
            if (evaluatedConds[i] === undefined && branches[i][0] !== null && branches[i][0] !== undefined) {
                evaluatedConds[i] = this.evaluateAST(branches[i][0], scope);
            }
        }
        const evalVals = branches.map(([, valAst]) => this.evaluateAST(valAst, scope));

        const lengths: number[] = [];
        for (const c of evaluatedConds) {
            if (Array.isArray(c)) lengths.push(c.length);
        }
        for (const v of evalVals) {
            if (Array.isArray(v)) lengths.push(v.length);
        }
        const len = lengths.length > 0 ? Math.min(...lengths) : 0;
        const out: any[] = new Array(len);

        for (let k = 0; k < len; k++) {
            let matched = false;
            for (let i = 0; i < branches.length; i++) {
                const [condAst] = branches[i];
                const rawVal = evalVals[i];
                const elemVal = Array.isArray(rawVal) ? rawVal[k] : rawVal;
                if (condAst === null || condAst === undefined) {
                    out[k] = elemVal;
                    matched = true;
                    break;
                }
                const cRaw = evaluatedConds[i];
                const cElem = Array.isArray(cRaw) ? cRaw[k] : cRaw;
                const isTrue = cElem === true || (typeof cElem === 'number' && !isNaN(cElem) && cElem !== 0);
                if (isTrue) {
                    out[k] = elemVal;
                    matched = true;
                    break;
                }
            }
            if (!matched) out[k] = NaN;
        }
        return out;
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

    private static readonly AST_EVAL_OPS = new Set([
        'with', 'piecewise', 'polygon', 'min', 'max', 'mean', 'total', 'sum', 'product', 'prod', 'length', 'size', 'count',
        'median', 'var', 'variance', 'samplevariance', 'stdev', 'stddev', 'samplesd',
        'varp', 'stdevp', 'mad', 'quantile', 'quartile', 'cov', 'covp', 'corr', 'spearman', 'random',
        'det', 'determinant', 'trace', 'tr', 'rank', 'matrixrank', 'rref', 'reducedrowechelonform',
        'inv', 'invert', 'transpose', 'tran',
        'dot', 'pointdot', 'pointcross', 'pointperp', 'perp', 'distance', 'magnitude', 'norm'
    ]);

    static resolveOrThrow(fnName: string, callArgs: any[], scope: Record<string, any> = {}): any {
        if (this.userFunctions[fnName] || this.userBaseCases[fnName]?.length) {
            return this.callUserFunction(fnName, callArgs, scope);
        }
        const compiled = this.compiledFuncs[fnName];
        if (typeof compiled === 'function') {
            return compiled(...callArgs, scope);
        }
        return this.throwUndefinedFunction(fnName);
    }

    private static nodeToJS(
        node: any,
        lookupIdentJS: (cleanName: string) => string,
        runtimeScopeExprJS: string,
        inlineScalarArith: boolean = false
    ): string {
        const tr = (n: any) => this.nodeToJS(n, lookupIdentJS, runtimeScopeExprJS, inlineScalarArith);

        if (typeof node === 'number') return node.toString();
        if (typeof node === 'string') {
            const cleanNode = node.trim();
            if (cleanNode === 'e') return 'Math.E';
            if (cleanNode === 'pi' || cleanNode === '\\pi' || cleanNode === 'π') return 'Math.PI';
            if (cleanNode === 'inf' || cleanNode === 'infty' || cleanNode === 'infinity' || cleanNode === '∞') return 'Infinity';
            return lookupIdentJS(cleanNode);
        }
        if (Array.isArray(node)) {
            const op = node[0];
            if (op === 'Add') {
                return inlineScalarArith
                    ? `(${tr(node[1])} + ${tr(node[2])})`
                    : `(funcs && funcs.add ? funcs.add(${tr(node[1])}, ${tr(node[2])}) : (${tr(node[1])} + ${tr(node[2])}))`;
            }
            if (op === 'Subtract') {
                return inlineScalarArith
                    ? `(${tr(node[1])} - ${tr(node[2])})`
                    : `(funcs && funcs.sub ? funcs.sub(${tr(node[1])}, ${tr(node[2])}) : (${tr(node[1])} - ${tr(node[2])}))`;
            }
            if (op === 'Multiply') {
                return inlineScalarArith
                    ? `(${tr(node[1])} * ${tr(node[2])})`
                    : `(funcs && funcs.mul ? funcs.mul(${tr(node[1])}, ${tr(node[2])}) : (${tr(node[1])} * ${tr(node[2])}))`;
            }
            if (op === 'Divide') {
                return inlineScalarArith
                    ? `(${tr(node[1])} / (${tr(node[2])} === 0 ? 1e-9 : ${tr(node[2])}))`
                    : `(funcs && funcs.div ? funcs.div(${tr(node[1])}, ${tr(node[2])}) : (${tr(node[1])} / ${tr(node[2])}))`;
            }
            if (op === 'Cross') return `funcs.cross(${tr(node[1])}, ${tr(node[2])})`;
            if (op === 'Power') return `funcs.realPow(${tr(node[1])}, ${tr(node[2])})`;
            if (op === 'Negate') return `(-(${tr(node[1])}))`;
            if (op === 'Equal') return `(${tr(node[1])} === ${tr(node[2])})`;
            if (op === 'NotEqual') return `(${tr(node[1])} !== ${tr(node[2])})`;
            if (op === 'LessThan') return `(${tr(node[1])} < ${tr(node[2])})`;
            if (op === 'GreaterThan') return `(${tr(node[1])} > ${tr(node[2])})`;
            if (op === 'LessEqual') return `(${tr(node[1])} <= ${tr(node[2])})`;
            if (op === 'GreaterEqual') return `(${tr(node[1])} >= ${tr(node[2])})`;
            if (op === 'And') return `(${tr(node[1])} && ${tr(node[2])})`;
            if (op === 'Or') return `(${tr(node[1])} || ${tr(node[2])})`;
            if (op === 'Cbrt') return `Math.cbrt(${tr(node[1])})`;
            if (op === 'Sin') return `Math.sin(funcs.toRad(${tr(node[1])}))`;
            if (op === 'Cos') return `Math.cos(funcs.toRad(${tr(node[1])}))`;
            if (op === 'Tan') return `Math.tan(funcs.toRad(${tr(node[1])}))`;
            if (op === 'Sec') return `(1 / Math.cos(funcs.toRad(${tr(node[1])})))`;
            if (op === 'Csc') return `(1 / Math.sin(funcs.toRad(${tr(node[1])})))`;
            if (op === 'Cot') return `(1 / Math.tan(funcs.toRad(${tr(node[1])})))`;
            if (op === 'Asin') return `funcs.fromRad(Math.asin(${tr(node[1])}))`;
            if (op === 'Acos') return `funcs.fromRad(Math.acos(${tr(node[1])}))`;
            if (op === 'Atan') return node.length > 2 ? `funcs.fromRad(Math.atan2(${tr(node[1])}, ${tr(node[2])}))` : `funcs.fromRad(Math.atan(${tr(node[1])}))`;
            if (op === 'Asec') return `funcs.fromRad(Math.acos(1 / (${tr(node[1])})))`;
            if (op === 'Acsc') return `funcs.fromRad(Math.asin(1 / (${tr(node[1])})))`;
            if (op === 'Acot') return `funcs.fromRad(Math.atan(1 / (${tr(node[1])})))`;
            if (op === 'Sinh') return `Math.sinh(${tr(node[1])})`;
            if (op === 'Cosh') return `Math.cosh(${tr(node[1])})`;
            if (op === 'Tanh') return `Math.tanh(${tr(node[1])})`;
            if (op === 'Asinh') return `Math.asinh(${tr(node[1])})`;
            if (op === 'Acosh') return `Math.acosh(${tr(node[1])})`;
            if (op === 'Atanh') return `Math.atanh(${tr(node[1])})`;
            if (op === 'Erf') return `funcs.erf(${tr(node[1])})`;
            if (op === 'Nthroot') return `funcs.realPow(${tr(node[1])}, 1 / (${tr(node[2])}))`;
            if (op === 'Ln') return `Math.log(${tr(node[1])})`;
            if (op === 'Log') {
                if (node.length > 2) {
                    return `(Math.log(${tr(node[2])}) / Math.log(${tr(node[1])}))`;
                }
                return `Math.log10(${tr(node[1])})`;
            }
            if (op === 'Abs') return `Math.abs(${tr(node[1])})`;
            if (op === 'Exp') return `Math.exp(${tr(node[1])})`;
            if (op === 'Sqrt') return `Math.sqrt(${tr(node[1])})`;

            const opLower = typeof op === 'string' ? op.toLowerCase() : '';
            if (opLower === 'erf') return `funcs.erf(${tr(node[1])})`;
            if (opLower === 'floor') return `Math.floor(${tr(node[1])})`;
            if (opLower === 'ceil') return `Math.ceil(${tr(node[1])})`;
            if (opLower === 'round') return node.length > 2 ? `funcs.round(${tr(node[1])}, ${tr(node[2])})` : `funcs.round(${tr(node[1])})`;
            if (opLower === 'sign' || opLower === 'sgn') return `Math.sign(${tr(node[1])})`;
            if (opLower === 'mod') return `funcs.mod(${tr(node[1])}, ${tr(node[2])})`;
            if (opLower === 'gcd') return `funcs.gcd(${node.slice(1).map(tr).join(', ')})`;
            if (opLower === 'lcm') return `funcs.lcm(${node.slice(1).map(tr).join(', ')})`;
            if (opLower === 'ncr' || opLower === 'binom') return `funcs.nCr(${tr(node[1])}, ${tr(node[2])})`;
            if (opLower === 'npr') return `funcs.nPr(${tr(node[1])}, ${tr(node[2])})`;
            if (opLower === 'cross') return `funcs.cross(${tr(node[1])}, ${tr(node[2])})`;
            if (opLower === 'midpoint') return `funcs.midpoint(${tr(node[1])}, ${tr(node[2])})`;

            if (op === 'List') return `[${node.slice(1).map(tr).join(', ')}]`;
            if (op === 'Range') return `funcs.listEngine.generateRange(${tr(node[1])}, ${tr(node[2])})`;
            if (op === 'RangeStep') return `funcs.listEngine.generateRange(${tr(node[1])}, ${tr(node[3])}, (${tr(node[2])}) - (${tr(node[1])}))`;
            if (op === 'Index') return `funcs.listEngine.evaluateIndex(${tr(node[1])}, ${JSON.stringify(node.length === 3 ? node[2] : node.slice(2))}, scope, (a, s) => funcs.evaluateAST(a, s), ${JSON.stringify(typeof node[1] === 'string' ? node[1] : '')})`;
            if (op === 'MatrixIndex') return `funcs.matrixEngine.indexMatrix(${tr(node[1])}, ${JSON.stringify(node[2])}, ${JSON.stringify(node[3])}, scope, (a, s) => funcs.evaluateAST(a, s))`;
            if (op === 'Comprehension') return `funcs.listEngine.evaluateComprehension(${JSON.stringify(node[1])}, ${JSON.stringify(node[2])}, ${runtimeScopeExprJS}, (a, s) => funcs.evaluateAST(a, s))`;
            if (op === 'MatrixComprehension') return `funcs.matrixEngine.generateMatrixComprehension(${JSON.stringify(node[1])}, ${JSON.stringify(node[2])}, ${runtimeScopeExprJS}, (a, s) => funcs.evaluateAST(a, s))`;
            if (op === 'PropertyAccess') {
                const targetJS = tr(node[1]);
                const prop = typeof node[2] === 'string' ? node[2] : '';
                return `(funcs && funcs.evalProperty ? funcs.evalProperty(${targetJS}, ${JSON.stringify(prop)}) : (${targetJS} && ${targetJS}[${JSON.stringify(prop.toLowerCase())}] !== undefined ? ${targetJS}[${JSON.stringify(prop.toLowerCase())}] : 0))`;
            }
            if (op === 'Point') return `({ x: ${tr(node[1])}, y: ${tr(node[2])}${node.length > 3 ? `, z: ${tr(node[3])}` : ''} })`;

            if (op === 'Integrate' && node.length > 3) {
                const integrandJson = JSON.stringify(node[1]);
                const intVar = typeof node[2] === 'string' ? node[2] : 'x';
                return `funcs.evaluateDefiniteIntegral(${integrandJson}, ${tr(node[3])}, ${tr(node[4])}, ${JSON.stringify(intVar)}, ${runtimeScopeExprJS})`;
            }
            if (op === 'diff') {
                const exprJson = JSON.stringify(node[1]);
                const diffVar = typeof node[2] === 'string' ? node[2] : 'x';
                return `funcs.evaluateDerivative(${exprJson}, ${JSON.stringify(diffVar)}, ${runtimeScopeExprJS})`;
            }
            if (MathEngine.AST_EVAL_OPS.has(opLower)) {
                return `funcs.evaluateAST(${JSON.stringify(node)}, ${runtimeScopeExprJS})`;
            }

            if (op === 'Call') {
                const fnName = node[1];
                const callArgs = node.slice(2).map(tr);
                return `(funcs[${JSON.stringify(fnName)}] ? funcs[${JSON.stringify(fnName)}](${[...callArgs, runtimeScopeExprJS].join(', ')}) : funcs.resolveOrThrow(${JSON.stringify(fnName)}, [${callArgs.join(', ')}], ${runtimeScopeExprJS}))`;
            }

            const argsJS = node.slice(1).map(tr);
            return `(funcs[${JSON.stringify(op)}] ? funcs[${JSON.stringify(op)}](${[...argsJS, runtimeScopeExprJS].join(', ')}) : funcs.resolveOrThrow(${JSON.stringify(op)}, [${argsJS.join(', ')}], ${runtimeScopeExprJS}))`;
        }
        return '0';
    }

    static toJS(node: any, paramName: string = 'x', dependentVar: string = 'y'): string {
        const localParamBinding = `Object.assign({}, typeof x !== 'undefined' ? { [${JSON.stringify(paramName)}]: x } : {}, typeof y !== 'undefined' ? { [${JSON.stringify(dependentVar)}]: y } : {})`;
        const runtimeScopeExpr = `(typeof funcs !== 'undefined' && funcs.withLocalBindings ? funcs.withLocalBindings(typeof scope !== 'undefined' ? scope : {}, ${localParamBinding}) : Object.assign({}, typeof scope !== 'undefined' ? scope : {}, ${localParamBinding}))`;
        const lookup = (cleanNode: string) => {
            if (cleanNode === paramName) return 'x';
            if (cleanNode === dependentVar) return 'y';
            if (MathEngine.WINDOW_GLOBALS.has(cleanNode)) {
                return `(typeof scope !== 'undefined' && scope && scope[${JSON.stringify(cleanNode)}] !== undefined ? scope[${JSON.stringify(cleanNode)}] : (typeof funcs !== 'undefined' && funcs.resolveVar ? ((v) => Number.isNaN(v) ? 0 : v)(funcs.resolveVar(${JSON.stringify(cleanNode)}, ${runtimeScopeExpr})) : 0))`;
            }
            const jsIdentFallback = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleanNode)
                ? `((v) => Number.isNaN(v) && typeof ${cleanNode} !== 'undefined' ? ${cleanNode} : v)`
                : `((v) => v)`;
            const resolvedExpr = `(typeof funcs !== 'undefined' && funcs.resolveVar ? funcs.resolveVar(${JSON.stringify(cleanNode)}, ${runtimeScopeExpr}) : (typeof scope !== 'undefined' && scope && scope[${JSON.stringify(cleanNode)}] !== undefined ? scope[${JSON.stringify(cleanNode)}] : NaN))`;
            return `${jsIdentFallback}(${resolvedExpr})`;
        };
        return this.nodeToJS(node, lookup, runtimeScopeExpr, false);
    }

    private static compileCache: Record<string, (x: number, y: number, scope: Record<string, number>) => number> = {};

    static compile(ast: any, paramName: string = 'x', dependentVar: string = 'y'): (x: number, y: number, scope: Record<string, number>) => number {
        const cacheKey = JSON.stringify(ast) + '::' + paramName + '::' + dependentVar;
        if (MathEngine.compileCache[cacheKey]) {
            return MathEngine.compileCache[cacheKey] as any;
        }
        if (Object.keys(MathEngine.compileCache).length > 500) {
            MathEngine.compileCache = {};
        }

        const jsCode = MathEngine.toJS(ast, paramName, dependentVar);
        const rawFunc = new Function('x', 'y', 'scope', 'funcs', `return ${jsCode};`);
        MathEngine.ensureCompiledFuncs();

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
    static compileMultivariable(ast: any, paramNames: string[]): (...args: any[]) => any {
        const cacheKey = JSON.stringify(ast) + '::multi::' + paramNames.join(',');
        if (MathEngine.compileCache[cacheKey]) {
            return MathEngine.compileCache[cacheKey] as any;
        }

        const lookup = (clean: string) => {
            const pIdx = paramNames.indexOf(clean);
            if (pIdx !== -1) return `(args[${pIdx}] !== undefined ? args[${pIdx}] : 0)`;
            return `(funcs && funcs.resolveVar ? funcs.resolveVar(${JSON.stringify(clean)}, localScope) : (typeof scope !== 'undefined' && scope && scope[${JSON.stringify(clean)}] !== undefined ? scope[${JSON.stringify(clean)}] : NaN))`;
        };
        const bodyExpr = this.nodeToJS(ast, lookup, 'localScope', false);

        const body = `
            return function(...args) {
                let scope = {};
                if (args.length > ${paramNames.length} && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null && !Array.isArray(args[args.length - 1])) {
                    scope = args.pop();
                }
                const paramBindings = {};
                ${paramNames.map((p, i) => `paramBindings[${JSON.stringify(p)}] = args[${i}] !== undefined ? args[${i}] : 0;`).join('\n                ')}
                const localScope = funcs && funcs.withLocalBindings
                    ? funcs.withLocalBindings(scope, paramBindings)
                    : Object.assign({}, scope, paramBindings);
                return ${bodyExpr};
            };
        `;

        try {
            MathEngine.ensureCompiledFuncs();
            const rawFunc = new Function('funcs', body)(MathEngine.compiledFuncs);
            (MathEngine.compileCache as any)[cacheKey] = rawFunc;
            return rawFunc;
        } catch (e) {
            if (e instanceof DesmosSemanticError) throw e;
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
            if (op === 'With' && Array.isArray(ast[2])) {
                const shadowed = new Set<string>();
                const newBindings = ast[2].map((b: any) => {
                    if (Array.isArray(b) && (b[0] === 'Equal' || b[0] === 'Assign') && typeof b[1] === 'string') {
                        shadowed.add(b[1]);
                        return [b[0], b[1], this.substituteAST(b[2], mapping)];
                    }
                    if (Array.isArray(b) && b.length === 2 && typeof b[0] === 'string') {
                        shadowed.add(b[0]);
                        return [b[0], this.substituteAST(b[1], mapping)];
                    }
                    return this.substituteAST(b, mapping);
                });
                const innerMapping = { ...mapping };
                shadowed.forEach(k => delete innerMapping[k]);
                return ['With', this.substituteAST(ast[1], innerMapping), newBindings];
            }
            if ((op === 'Comprehension' || op === 'MatrixComprehension') && Array.isArray(ast[2])) {
                const shadowed = new Set<string>();
                const newBindings = ast[2].map((b: any) => {
                    if (Array.isArray(b) && (b[0] === 'Equal' || b[0] === 'Assign') && typeof b[1] === 'string') {
                        shadowed.add(b[1]);
                        return [b[0], b[1], this.substituteAST(b[2], mapping)];
                    }
                    return this.substituteAST(b, mapping);
                });
                const innerMapping = { ...mapping };
                shadowed.forEach(k => delete innerMapping[k]);
                return [op, this.substituteAST(ast[1], innerMapping), newBindings];
            }
            if (typeof op === 'string' && ['sum', 'prod', 'product', 'integrate'].includes(op.toLowerCase()) && ast.length >= 4 && typeof ast[2] === 'string') {
                const boundVar = ast[2];
                const innerMapping = { ...mapping };
                delete innerMapping[boundVar];
                return [
                    op,
                    this.substituteAST(ast[1], innerMapping),
                    boundVar,
                    ...ast.slice(3).map(child => this.substituteAST(child, mapping))
                ];
            }
            return [op, ...ast.slice(1).map(child => this.substituteAST(child, mapping))];
        }
        return ast;
    }

    /**
     * Expande chamadas a funções de utilizador (ex: f(x, y)) de volta para a sua expressão analítica
     * permitindo que o WebGL renderize curvas implícitas f(x, y) = 0 diretamente na GPU.
     */
    static inlineDynamicVarsForExpansion(
        ast: any,
        boundParams: Set<string>,
        visitedVars: Set<string> = new Set()
    ): any {
        if (ast === null || ast === undefined || typeof ast === 'number') return ast;
        if (typeof ast === 'string') {
            const rawVar = ast.replace(/[\{\}\\]/g, '').trim();
            if (!boundParams.has(ast) && !boundParams.has(rawVar) && !visitedVars.has(rawVar)) {
                const varAst = this.getVariableAst(rawVar) ?? this.getVariableAst(ast);
                if (varAst !== undefined && typeof varAst !== 'number' && this.astContainsAnyIdentifier(varAst)) {
                    const nextVisited = new Set(visitedVars);
                    nextVisited.add(rawVar);
                    return this.inlineDynamicVarsForExpansion(varAst, boundParams, nextVisited);
                }
            }
            return ast;
        }
        if (Array.isArray(ast)) {
            const op = ast[0];
            if (op === 'Call' && typeof ast[1] === 'string') {
                return ['Call', ast[1], ...ast.slice(2).map(child => this.inlineDynamicVarsForExpansion(child, boundParams, visitedVars))];
            }
            return [op, ...ast.slice(1).map(child => this.inlineDynamicVarsForExpansion(child, boundParams, visitedVars))];
        }
        return ast;
    }

    static astContainsAnyIdentifier(ast: any): boolean {
        if (typeof ast === 'string') {
            const clean = ast.replace(/[\{\}\\]/g, '').trim().toLowerCase();
            return !['pi', 'π', 'e', 'inf', 'infty', 'infinity', '∞'].includes(clean);
        }
        if (Array.isArray(ast)) {
            for (let i = 1; i < ast.length; i++) {
                if (this.astContainsAnyIdentifier(ast[i])) return true;
            }
        }
        return false;
    }

    static expandUserFunctions(ast: any, depth: number = 0, visited: Set<string> = new Set()): any {
        if (depth > 12) return ast;
        if (typeof ast === 'string' || typeof ast === 'number') return ast;
        if (Array.isArray(ast)) {
            const op = ast[0];
            const isCallNode = op === 'Call' && typeof ast[1] === 'string';
            const fnName = isCallNode ? ast[1].trim() : (typeof op === 'string' ? op : '');
            const def = fnName ? MathEngine.userFunctions[fnName] : undefined;
            if (def) {
                const hasBaseCases = Boolean((MathEngine.userBaseCases[fnName]?.length) || (def.baseCases?.length));
                if (visited.has(fnName) || hasBaseCases || this.isFunctionRecursive(fnName)) {
                    const startIdx = isCallNode ? 2 : 1;
                    const mappedArgs = ast.slice(startIdx).map(child => this.expandUserFunctions(child, depth, visited));
                    return isCallNode ? ['Call', fnName, ...mappedArgs] : [op, ...mappedArgs];
                }
                const startIdx = isCallNode ? 2 : 1;
                const mapping: Record<string, any> = {};
                for (let i = 0; i < def.params.length; i++) {
                    const p = def.params[i];
                    mapping[p] = this.expandUserFunctions(ast[startIdx + i] ?? p, depth + 1, visited);
                }
                const boundSet = new Set(def.params);
                const expandedBody = this.inlineDynamicVarsForExpansion(def.ast, boundSet);
                const substituted = this.substituteAST(expandedBody, mapping);
                const nextVisited = new Set(visited);
                nextVisited.add(fnName);
                return this.expandUserFunctions(substituted, depth + 1, nextVisited);
            }
            if (isCallNode) {
                return ['Call', ast[1], ...ast.slice(2).map(child => this.expandUserFunctions(child, depth, visited))];
            }
            return [op, ...ast.slice(1).map(child => this.expandUserFunctions(child, depth, visited))];
        }
        return ast;
    }

    static createDerivativeFunction(ast: any, derivVar: string, order: number = 1): (x: number, y: number, scope: Record<string, number>) => number {
        const baseFunc = this.compile(ast, derivVar);
        const h1 = 1e-5;
        const h2 = 1e-4;
        const h3 = 1e-3;
        const h4 = 0.005;
        return (x: number, y: number, scope: Record<string, number>) => {
            if (derivVar === 'x') {
                if (order === 1) return (baseFunc(x + h1, y, scope) - baseFunc(x - h1, y, scope)) / (2 * h1);
                if (order === 2) return (baseFunc(x + h2, y, scope) - 2 * baseFunc(x, y, scope) + baseFunc(x - h2, y, scope)) / (h2 * h2);
                if (order === 3) return (baseFunc(x + 2*h3, y, scope) - 2*baseFunc(x + h3, y, scope) + 2*baseFunc(x - h3, y, scope) - baseFunc(x - 2*h3, y, scope)) / (2 * h3 * h3 * h3);
                return (baseFunc(x + 2*h4, y, scope) - 4*baseFunc(x + h4, y, scope) + 6*baseFunc(x, y, scope) - 4*baseFunc(x - h4, y, scope) + baseFunc(x - 2*h4, y, scope)) / (h4 * h4 * h4 * h4);
            } else if (derivVar === 'y') {
                if (order === 1) return (baseFunc(x, y + h1, scope) - baseFunc(x, y - h1, scope)) / (2 * h1);
                if (order === 2) return (baseFunc(x, y + h2, scope) - 2 * baseFunc(x, y, scope) + baseFunc(x, y - h2, scope)) / (h2 * h2);
                if (order === 3) return (baseFunc(x, y + 2*h3, scope) - 2*baseFunc(x, y + h3, scope) + 2*baseFunc(x, y - h3, scope) - baseFunc(x, y - 2*h3, scope)) / (2 * h3 * h3 * h3);
                return (baseFunc(x, y + 2*h4, scope) - 4*baseFunc(x, y + h4, scope) + 6*baseFunc(x, y, scope) - 4*baseFunc(x, y - h4, scope) + baseFunc(x, y - 2*h4, scope)) / (h4 * h4 * h4 * h4);
            } else {
                const curVal = (scope && scope[derivVar] !== undefined && x === 0) ? scope[derivVar] : x;
                const evalAt = (v: number) => {
                    const localScope = Object.assign({}, scope, { [derivVar]: v });
                    return baseFunc(v, y, localScope);
                };
                if (order === 1) return (evalAt(curVal + h1) - evalAt(curVal - h1)) / (2 * h1);
                if (order === 2) return (evalAt(curVal + h2) - 2 * evalAt(curVal) + evalAt(curVal - h2)) / (h2 * h2);
                if (order === 3) return (evalAt(curVal + 2*h3) - 2*evalAt(curVal + h3) + 2*evalAt(curVal - h3) - evalAt(curVal - 2*h3)) / (2 * h3 * h3 * h3);
                return (evalAt(curVal + 2*h4) - 4*evalAt(curVal + h4) + 6*evalAt(curVal) - 4*evalAt(curVal - h4) + evalAt(curVal - 2*h4)) / (h4 * h4 * h4 * h4);
            }
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
                if (op === 'Ln') return `funcs.intLn(${L})`;
                if (op === 'Ln') return `funcs.intLn(${L})`;
                if (op === 'Log') return `funcs.intLog(${L})`;
                if (op === 'Atan') return `funcs.intAtan(${L})`;
                if (op === 'Asin') return `funcs.intAsin(${L})`;
                if (op === 'Acos') return `funcs.intAcos(${L})`;
                if (op === 'Negate') return `funcs.intNeg(${L})`;
                if (op === 'Abs') return `funcs.intAbs(${L})`;
                if (op === 'Exp') return `funcs.intExp(${L})`;
                if (op === 'Piecewise') {
                    const branchExprs = node.slice(1).map((br: any) => toJS(br[1]));
                    if (branchExprs.length === 0) return '{min: 1, max: 1}';
                    return `((bs) => ({ min: Math.min(...bs.map(b => b.min)), max: Math.max(...bs.map(b => b.max)) }))([${branchExprs.join(', ')}])`;
                }
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
            const isDeg = MathEngine.angleModeProvider ? MathEngine.angleModeProvider() === 'degrees' : false;
            const rMin = isDeg ? a.min * (Math.PI / 180) : a.min;
            const rMax = isDeg ? a.max * (Math.PI / 180) : a.max;
            if (rMax - rMin >= 2 * Math.PI) return { min: -1, max: 1 };
            const minV = Math.sin(rMin), maxV = Math.sin(rMax);
            let min = Math.min(minV, maxV), max = Math.max(minV, maxV);
            const p1 = Math.ceil((rMin - Math.PI/2) / (2*Math.PI)) * 2*Math.PI + Math.PI/2;
            if (p1 >= rMin && p1 <= rMax) max = 1;
            const p2 = Math.ceil((rMin - 3*Math.PI/2) / (2*Math.PI)) * 2*Math.PI + 3*Math.PI/2;
            if (p2 >= rMin && p2 <= rMax) min = -1;
            return { min, max };
        },
        intCos: (a: any) => {
            const isDeg = MathEngine.angleModeProvider ? MathEngine.angleModeProvider() === 'degrees' : false;
            const rMin = isDeg ? a.min * (Math.PI / 180) : a.min;
            const rMax = isDeg ? a.max * (Math.PI / 180) : a.max;
            if (rMax - rMin >= 2 * Math.PI) return { min: -1, max: 1 };
            const minV = Math.cos(rMin), maxV = Math.cos(rMax);
            let min = Math.min(minV, maxV), max = Math.max(minV, maxV);
            const p1 = Math.ceil((rMin) / (2*Math.PI)) * 2*Math.PI;
            if (p1 >= rMin && p1 <= rMax) max = 1;
            const p2 = Math.ceil((rMin - Math.PI) / (2*Math.PI)) * 2*Math.PI + Math.PI;
            if (p2 >= rMin && p2 <= rMax) min = -1;
            return { min, max };
        },
        intSqrt: (a: any) => ({
            min: Math.sqrt(Math.max(0, a.min)),
            max: Math.sqrt(Math.max(0, a.max))
        }),
        intLn: (a: any) => ({
            min: a.min > 0 ? Math.log(a.min) : -Infinity,
            max: a.max > 0 ? Math.log(a.max) : -Infinity
        }),
        intLog: (a: any) => ({
            min: a.min > 0 ? Math.log10(a.min) : -Infinity,
            max: a.max > 0 ? Math.log10(a.max) : -Infinity
        }),
        intAtan: (a: any) => {
            const isDeg = MathEngine.angleModeProvider ? MathEngine.angleModeProvider() === 'degrees' : false;
            const f = isDeg ? (180 / Math.PI) : 1;
            return { min: Math.atan(a.min) * f, max: Math.atan(a.max) * f };
        },
        intAsin: (a: any) => {
            const isDeg = MathEngine.angleModeProvider ? MathEngine.angleModeProvider() === 'degrees' : false;
            const f = isDeg ? (180 / Math.PI) : 1;
            return {
                min: Math.asin(Math.max(-1, Math.min(1, a.min))) * f,
                max: Math.asin(Math.max(-1, Math.min(1, a.max))) * f
            };
        },
        intAcos: (a: any) => {
            const isDeg = MathEngine.angleModeProvider ? MathEngine.angleModeProvider() === 'degrees' : false;
            const f = isDeg ? (180 / Math.PI) : 1;
            return {
                min: Math.acos(Math.max(-1, Math.min(1, a.max))) * f,
                max: Math.acos(Math.max(-1, Math.min(1, a.min))) * f
            };
        },
        intAbs: (a: any) => ({ 
            min: (a.min <= 0 && a.max >= 0) ? 0 : Math.min(Math.abs(a.min), Math.abs(a.max)), 
            max: Math.max(Math.abs(a.min), Math.abs(a.max)) 
        }),
        intExp: (a: any) => ({ min: Math.exp(a.min), max: Math.exp(a.max) })
    };

    static generatePointsAdaptive(ast: any, xMin: number, xMax: number, scope: Record<string, number> = {}, variable: string = 'x', screenWidth: number = 2000): {x: number, y: number}[] {
        const points: {x: number, y: number}[] = [];
        const fastF = this.compile(ast, variable);
        const f = (x: number) => {
            try {
                return fastF(x, 0, scope);
            } catch (e: any) {
                if (e?.code === 'RECURSION_LIMIT_EXCEEDED') return NaN;
                throw e;
            }
        };

        // Amostragem por pixel (alta fidelidade) em vez de recursão que falha em escalas distorcidas
        const steps = screenWidth > 0 ? Math.min(screenWidth * 1.5, 3000) : 1000;
        const dx = (xMax - xMin) / steps;
        
        // Heurística para quebrar assíntotas verticais
        const asymptoteThreshold = (xMax - xMin) * 2; 

        let prevY = NaN;
        for (let i = 0; i <= steps; i++) {
            const x = xMin + i * dx;
            let y = f(x);
            
            if (!isFinite(y)) {
                y = NaN;
            }

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
    /**
     * Avaliação numérica de integrais definidas (inclusive impróprias ±∞ e integrandos descontínuos/piecewise)
     * via transformação trigonométrica x = tan(theta) e quadratura Gauss-Legendre de 5 pontos adaptativa.
     */
    static evaluateDefiniteIntegral(ast: any, lower: number, upper: number, variable: string = 'x', scope: Record<string, number> = {}): number {
        if (isNaN(lower) || isNaN(upper)) return NaN;
        if (lower === upper) return 0;

        let a = lower;
        let b = upper;
        let sign = 1;
        if (a > b) {
            a = upper;
            b = lower;
            sign = -1;
        }

        const fastF = this.compile(ast, variable, '__unused__');

        let qA = a;
        let qB = b;
        let mappedFn: (t: number) => number;

        if (!isFinite(a) || !isFinite(b)) {
            if (a === -Infinity && b === Infinity) {
                qA = -Math.PI / 2;
                qB = Math.PI / 2;
                mappedFn = (theta: number) => {
                    const c = Math.cos(theta);
                    if (Math.abs(c) < 1e-12) return 0;
                    const xVal = Math.tan(theta);
                    const y = fastF(xVal, 0, scope);
                    if (isNaN(y)) return NaN;
                    if (y === 0) return 0;
                    if (!isFinite(y)) return NaN;
                    return y / (c * c);
                };
            } else if (isFinite(a) && b === Infinity) {
                qA = 0;
                qB = Math.PI / 2;
                mappedFn = (theta: number) => {
                    const c = Math.cos(theta);
                    if (Math.abs(c) < 1e-12) return 0;
                    const xVal = a + Math.tan(theta);
                    const y = fastF(xVal, 0, scope);
                    if (isNaN(y)) return NaN;
                    if (y === 0) return 0;
                    if (!isFinite(y)) return NaN;
                    return y / (c * c);
                };
            } else if (a === -Infinity && isFinite(b)) {
                qA = -Math.PI / 2;
                qB = 0;
                mappedFn = (theta: number) => {
                    const c = Math.cos(theta);
                    if (Math.abs(c) < 1e-12) return 0;
                    const xVal = b + Math.tan(theta);
                    const y = fastF(xVal, 0, scope);
                    if (isNaN(y)) return NaN;
                    if (y === 0) return 0;
                    if (!isFinite(y)) return NaN;
                    return y / (c * c);
                };
            } else {
                return NaN;
            }
        } else {
            mappedFn = (xVal: number) => {
                const y = fastF(xVal, 0, scope);
                if (isNaN(y) || !isFinite(y)) return NaN;
                return y;
            };
        }

        const GL5_X = [-0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664];
        const GL5_W = [0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891];

        const gl5 = (lo: number, hi: number): number => {
            const mid = 0.5 * (lo + hi);
            const half = 0.5 * (hi - lo);
            let acc = 0;
            for (let k = 0; k < 5; k++) {
                const val = mappedFn(mid + half * GL5_X[k]);
                if (isNaN(val) || !isFinite(val)) return NaN;
                acc += GL5_W[k] * val;
            }
            return half * acc;
        };

        const adaptiveGL5 = (lo: number, hi: number, whole: number, tol: number, depth: number): number => {
            if (isNaN(whole)) return NaN;
            const mid = 0.5 * (lo + hi);
            const left = gl5(lo, mid);
            const right = gl5(mid, hi);
            if (isNaN(left) || isNaN(right)) return NaN;
            const split = left + right;
            if (depth <= 0 || Math.abs(split - whole) <= tol) {
                return split;
            }
            return adaptiveGL5(lo, mid, left, tol * 0.5, depth - 1) +
                   adaptiveGL5(mid, hi, right, tol * 0.5, depth - 1);
        };

        const basePanels = 128;
        const step = (qB - qA) / basePanels;
        const perPanelTol = 1e-9 / basePanels;
        let total = 0;
        for (let i = 0; i < basePanels; i++) {
            const lo = qA + i * step;
            const hi = i === basePanels - 1 ? qB : qA + (i + 1) * step;
            const whole = gl5(lo, hi);
            if (isNaN(whole)) return NaN;
            const refined = adaptiveGL5(lo, hi, whole, perPanelTol, 12);
            if (isNaN(refined)) return NaN;
            total += refined;
        }
        return sign * total;
    }

    /**
     * Avaliação numérica de derivadas via diferença central sem sobrescrever variáveis secundárias
     */
    static evaluateDerivative(ast: any, variable: string = 'x', scope: Record<string, number> = {}): number {
        const h = 1e-5;
        const curVal = scope[variable] ?? 0;
        const fastF = this.compile(ast, variable, '__unused__');
        const scopePlus = Object.assign({}, scope, { [variable]: curVal + h });
        const scopeMinus = Object.assign({}, scope, { [variable]: curVal - h });
        const fPlus = fastF(curVal + h, 0, scopePlus);
        const fMinus = fastF(curVal - h, 0, scopeMinus);
        return (fPlus - fMinus) / (2 * h);
    }

    static initCompiledFuncs() {
        this.compiledFuncs = {};
        this.ensureCompiledFuncs();
    }
}

// Inicializa o dicionário de funções pré-compiladas
MathEngine.initCompiledFuncs();