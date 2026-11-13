/**
 * Policy: Classes Formais de Política 2D (cx) vs. 3D (wC) e Travas de Custo (Ht)
 * Baseado na engenharia reversa do código-fonte oficial (shared_calculator_desktop.js).
 */

export interface Policy {
    readonly is3D: boolean;
    readonly name: '2D' | '3D';
    readonly validImplicitVariables: readonly string[];
    readonly validExpressionVariables: readonly string[];
    readonly validParametricVariables: readonly string[];
    isValidSlider(symbol: string): boolean;
    shouldPromoteToSlider(ast: any, symbol: string): boolean;
}

/**
 * Política 2D (Classe cx em shared_calculator_desktop.js)
 * - Coordenadas espaciais reservadas: x, y, r, theta
 * - z NÃO é coordenada espacial no plano 2D -> isValidSlider('z') === true (promovível a slider!)
 */
export class Policy2D implements Policy {
    readonly is3D = false;
    readonly name = '2D' as const;
    readonly validImplicitVariables = ['x', 'y', 'r', 'theta'] as const;
    readonly validExpressionVariables = ['x'] as const;
    readonly validParametricVariables = ['t'] as const;

    isValidSlider(symbol: string): boolean {
        const clean = symbol.trim();
        // Em 2D, x, y, t e constantes matemáticas não podem virar slider
        const reserved = new Set(['x', 'y', 't', 'e', 'pi', 'width', 'height']);
        return !reserved.has(clean);
    }

    shouldPromoteToSlider(ast: any, symbol: string): boolean {
        if (!this.isValidSlider(symbol)) return false;
        // No Desmos, só promove para slider interativo se o lado direito for constante escalar finita
        if (typeof ast === 'number' && Number.isFinite(ast)) return true;
        if (Array.isArray(ast) && ast[0] === 'Negate' && typeof ast[1] === 'number') return true;
        return false;
    }
}

/**
 * Política 3D (Classe wC em shared_calculator_desktop.js)
 * - Coordenadas espaciais reservadas: x, y, z
 * - z É a terceira coordenada espacial no espaço 3D -> isValidSlider('z') === false (nunca pode virar slider!)
 */
export class Policy3D implements Policy {
    readonly is3D = true;
    readonly name = '3D' as const;
    readonly validImplicitVariables = ['x', 'y', 'z'] as const;
    readonly validExpressionVariables = ['x', 'y'] as const;
    readonly validParametricVariables = ['t', 'u', 'v'] as const;

    isValidSlider(symbol: string): boolean {
        const clean = symbol.trim();
        // Em 3D, z é coordenada reservada
        const reserved = new Set(['x', 'y', 'z', 't', 'u', 'v', 'e', 'pi', 'width', 'height']);
        return !reserved.has(clean);
    }

    shouldPromoteToSlider(ast: any, symbol: string): boolean {
        if (!this.isValidSlider(symbol)) return false;
        if (typeof ast === 'number' && Number.isFinite(ast)) return true;
        if (Array.isArray(ast) && ast[0] === 'Negate' && typeof ast[1] === 'number') return true;
        return false;
    }
}

/**
 * Travas de Custo de Hardware WebGL (Módulo Ht em shared_calculator_desktop.js)
 * Previne falhas de TDR (driver reset), loops infinitos e travamentos de GPU.
 */
export class CostBudgetManager {
    /** Tamanho máximo de lista suportado em UBOs de GPU (wf em Desmos) */
    public static readonly GPU_MAX_LIST_SIZE = 100;

    /** Número máximo de iterações em loop unrolling estático de sum/prod na GPU (Y1/Z1) */
    public static readonly GPU_LONG_SUM = 1000;

    /** Custo máximo de raymarching implícito em tempo real */
    public static readonly MAX_RAYCAST_COST = 50;

    /** Custo máximo de restrições de desigualdade na GPU (qp) */
    public static readonly MAX_RESTRICTION_COST = 10000;

    /**
     * Avalia se a AST tem complexidade aceitável para compilação em shader fragmentado
     */
    static checkShaderCost(ast: any, listSizes: Record<string, number> = {}): { canCompile: boolean; reason?: string } {
        for (const [name, size] of Object.entries(listSizes)) {
            if (size > this.GPU_MAX_LIST_SIZE) {
                return {
                    canCompile: false,
                    reason: `Tamanho da lista '${name}' (${size}) excede o limite seguro da GPU (${this.GPU_MAX_LIST_SIZE}).`
                };
            }
        }

        let nodeCount = 0;
        let maxDepth = 0;

        function walk(node: any, depth: number) {
            nodeCount++;
            if (depth > maxDepth) maxDepth = depth;
            if (Array.isArray(node)) {
                for (let i = 1; i < node.length; i++) {
                    walk(node[i], depth + 1);
                }
            }
        }
        walk(ast, 0);

        if (maxDepth > 40 || nodeCount > 250) {
            return {
                canCompile: false,
                reason: `Expressão complexa demais para shader GPU (profundidade ${maxDepth}, nós ${nodeCount}).`
            };
        }

        return { canCompile: true };
    }
}

/**
 * Gerenciador centralizado de políticas (PolicyManager)
 */
export class PolicyManager {
    private static policy2D = new Policy2D();
    private static policy3D = new Policy3D();

    static getPolicy(is3D: boolean = false): Policy {
        return is3D ? this.policy3D : this.policy2D;
    }
}

/**
 * Erro semântico explícito no estilo Desmos (substitui fallbacks silenciosos).
 */
export class DesmosSemanticError extends Error {
    public readonly code: string;
    constructor(message: string, code: string = 'SEMANTIC_ERROR') {
        super(message);
        this.name = 'DesmosSemanticError';
        this.code = code;
    }
}

export const PROTECTED_CONSTANTS = new Set([
    'e', 'pi', 'π', '\\pi', 'tau', 'τ', '\\tau',
    'inf', 'infty', 'infinity', '∞', 'ans', 'width', 'height'
]);

export const SPATIAL_COORDINATE_VARS_2D = new Set([
    'x', 'y', 'r', 'theta', '\\theta', 'θ'
]);

export const SPATIAL_COORDINATE_VARS = new Set([
    ...SPATIAL_COORDINATE_VARS_2D,
    'z', 'phi', '\\phi', 'φ', 'rho', '\\rho', 'ρ'
]);

export function isSpatialCoordinateVar(name: string, is3D: boolean = false): boolean {
    const clean = (name || '').trim();
    const lower = clean.toLowerCase();
    if (SPATIAL_COORDINATE_VARS_2D.has(clean) || SPATIAL_COORDINATE_VARS_2D.has(lower)) {
        return true;
    }
    return is3D && (SPATIAL_COORDINATE_VARS.has(clean) || SPATIAL_COORDINATE_VARS.has(lower));
}

export const AST_STRUCTURAL_OPS = new Set([
    'Add', 'Subtract', 'Multiply', 'Divide', 'Power', 'Negate', 'Cross',
    'List', 'Range', 'RangeStep', 'Index', 'MatrixIndex', 'MatrixBlock', 'Slice', 'Dot', 'PropertyAccess',
    'DotProduct', 'Point', 'Tuple', 'Comprehension', 'MatrixComprehension', 'ForDomain', 'With',
    'Abs', 'Sqrt', 'Cbrt', 'Nthroot', 'Exp', 'Ln', 'Log',
    'Sin', 'Cos', 'Tan', 'Sec', 'Csc', 'Cot',
    'Asin', 'Acos', 'Atan', 'Asec', 'Acsc', 'Acot',
    'Sinh', 'Cosh', 'Tanh', 'Asinh', 'Acosh', 'Atanh',
    'Integrate', 'Sum', 'Prod', 'diff', 'Lim', 'Equal', 'Equals',
    'Less', 'Greater', 'LessEqual', 'GreaterEqual', 'And', 'Or',
    'Piecewise', 'Conditional', 'Action', 'ActionSeq', 'Polygon',
    'DerivativeCall', 'Factorial'
]);

export const RESERVED_BUILTIN_NAMES = new Set([
    ...PROTECTED_CONSTANTS,
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
    'arcsin', 'arccos', 'arctan', 'arcsec', 'arccsc', 'arccot',
    'asin', 'acos', 'atan', 'asec', 'acsc', 'acot',
    'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
    'sqrt', 'cbrt', 'nthroot', 'abs', 'exp', 'ln', 'log',
    'floor', 'ceil', 'round', 'sign', 'sgn', 'mod', 'gcd', 'lcm',
    'nCr', 'ncr', 'nPr', 'npr', 'binom',
    'min', 'max', 'mean', 'median', 'stdev', 'stddev', 'stdevp', 'var', 'variance', 'varp', 'samplesd', 'samplevariance', 'cov', 'covp', 'corr', 'spearman', 'quartile', 'quantile', 'mad', 'erf', 'arsinh', 'arcosh', 'artanh', 'total', 'count', 'length', 'sort', 'unique', 'join', 'repeat',
    'dot', 'cross', 'midpoint', 'distance', 'mag', 'magnitude', 'norm', 'pointperp', 'perp',
    'det', 'determinant', 'inv', 'invert', 'tran', 'transpose', 'rref', 'trace', 'rank', 'matrixrank',
    'rows', 'columns', 'cols', 'dims', 'identity', 'eye', 'zeros', 'ones',
    'polygon', 'rgb', 'hsv', 'for', 'with', 'and', 'or',
    'sum', 'prod', 'int', 'integrate', 'defint', 'diff', 'lim', 'limit', 'taylor', 'edo', 'solveode', 'laplace', 'random', 'shuffle'
]);

const GREEK_LETTER_NAMES = new Set([
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau',
    'upsilon', 'phi', 'chi', 'psi', 'omega',
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi',
    'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'
]);

/**
 * Extrai o conteúdo de um grupo delimitado balanceado (ex: '(...)', '{...}', '[...]').
 */
export function extractBalancedGroup(
    str: string,
    openIndex: number,
    openChar: string = '(',
    closeChar: string = ')'
): { content: string; endIndex: number } | null {
    if (openIndex < 0 || openIndex >= str.length || str[openIndex] !== openChar) {
        return null;
    }
    let depth = 0;
    for (let i = openIndex; i < str.length; i++) {
        const ch = str[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
            depth--;
            if (depth === 0) {
                return { content: str.slice(openIndex + 1, i), endIndex: i };
            }
        }
    }
    return null;
}

/**
 * Divide uma expressão no operador relacional de nível superior ('=', '<=', '>=', '<', '>', '\le', '\ge'),
 * ignorando operadores dentro de (), [], {} ou após cláusulas 'for'/'with' de nível superior.
 */
export function splitTopLevelComparison(expr: string): { lhs: string; op: string; rhs: string } | null {
    let paren = 0;
    let bracket = 0;
    let brace = 0;
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (ch === '(') { paren++; continue; }
        if (ch === ')') { paren = Math.max(0, paren - 1); continue; }
        if (ch === '[') { bracket++; continue; }
        if (ch === ']') { bracket = Math.max(0, bracket - 1); continue; }
        if (ch === '{') { brace++; continue; }
        if (ch === '}') { brace = Math.max(0, brace - 1); continue; }

        if (paren !== 0 || bracket !== 0 || brace !== 0) continue;

        if (/[a-zA-Z]/.test(ch) && (i === 0 || !/[a-zA-Z0-9_]/.test(expr[i - 1]))) {
            const wordMatch = expr.slice(i).match(/^(for|with)(?![a-zA-Z0-9_])/);
            if (wordMatch) {
                return null;
            }
        }

        if (expr.startsWith('\\le', i) && !/[a-zA-Z]/.test(expr[i + 3] || '')) {
            return { lhs: expr.slice(0, i), op: '<=', rhs: expr.slice(i + 3) };
        }
        if (expr.startsWith('\\ge', i) && !/[a-zA-Z]/.test(expr[i + 3] || '')) {
            return { lhs: expr.slice(0, i), op: '>=', rhs: expr.slice(i + 3) };
        }
        if (expr.startsWith('<=', i) || expr.startsWith('>=', i) || expr.startsWith('!=', i)) {
            return { lhs: expr.slice(0, i), op: expr.slice(i, i + 2), rhs: expr.slice(i + 2) };
        }
        if (ch === '<' || ch === '>' || ch === '=') {
            if (ch === '=' && (expr[i + 1] === '=' || expr[i - 1] === ':' || expr[i + 1] === '>')) {
                continue;
            }
            return { lhs: expr.slice(0, i), op: ch, rhs: expr.slice(i + 1) };
        }
    }
    return null;
}

/**
 * Coleta identificadores livres em uma AST, ignorando variáveis locais ligadas por 'for'/'with'/integrais/somatórios.
 */
export function collectASTIdentifiers(
    node: any,
    options: { includeCalledFunctions?: boolean; boundVars?: Set<string> } = {}
): Set<string> {
    const out = new Set<string>();
    const bound = new Set(options.boundVars ?? []);
    const includeFuncs = options.includeCalledFunctions ?? false;

    const visit = (n: any, localBound: Set<string>) => {
        if (n === null || n === undefined || typeof n === 'number' || typeof n === 'boolean') return;
        if (typeof n === 'string') {
            const clean = n.trim();
            if (clean && !localBound.has(clean)) {
                out.add(clean);
            }
            return;
        }
        if (!Array.isArray(n) || n.length === 0) return;

        const op = n[0];
        if (op === 'Dot' || op === 'PropertyAccess') {
            visit(n[1], localBound);
            return;
        }
        if (op === 'Comprehension' || op === 'MatrixComprehension' || op === 'With') {
            const nextBound = new Set(localBound);
            const rawBindings = (n.length === 3 && Array.isArray(n[2]) && Array.isArray(n[2][0]))
                ? n[2]
                : n.slice(2);
            for (const binding of rawBindings) {
                if (Array.isArray(binding) && typeof binding[0] === 'string') {
                    visit(binding[1], localBound);
                    nextBound.add(binding[0].trim());
                }
            }
            visit(n[1], nextBound);
            return;
        }
        if ((op === 'Sum' || op === 'Prod' || op === 'Integrate') && typeof n[2] === 'string') {
            const nextBound = new Set(localBound);
            nextBound.add(n[2].trim());
            visit(n[1], nextBound);
            for (let i = 3; i < n.length; i++) visit(n[i], localBound);
            return;
        }
        if (typeof op === 'string' && !AST_STRUCTURAL_OPS.has(op) && !RESERVED_BUILTIN_NAMES.has(op.toLowerCase())) {
            if (includeFuncs && !localBound.has(op)) {
                out.add(op);
            }
        }
        for (let i = 1; i < n.length; i++) {
            visit(n[i], localBound);
        }
    };

    visit(node, bound);
    return out;
}

/**
 * Coleta apenas os nomes de funções chamadas na AST que não são operadores estruturais nem built-ins.
 */
export function collectCalledFunctionNames(node: any, boundVars: Set<string> = new Set()): string[] {
    const out = new Set<string>();

    const visit = (n: any, localBound: Set<string>) => {
        if (!Array.isArray(n) || n.length === 0) return;
        const op = n[0];
        if (op === 'Dot' || op === 'PropertyAccess') {
            visit(n[1], localBound);
            return;
        }
        if (op === 'Comprehension' || op === 'MatrixComprehension' || op === 'With') {
            const nextBound = new Set(localBound);
            const rawBindings = (n.length === 3 && Array.isArray(n[2]) && Array.isArray(n[2][0]))
                ? n[2]
                : n.slice(2);
            for (const binding of rawBindings) {
                if (Array.isArray(binding) && typeof binding[0] === 'string') {
                    visit(binding[1], localBound);
                    nextBound.add(binding[0].trim());
                }
            }
            visit(n[1], nextBound);
            return;
        }
        if ((op === 'Sum' || op === 'Prod' || op === 'Integrate') && typeof n[2] === 'string') {
            const nextBound = new Set(localBound);
            nextBound.add(n[2].trim());
            visit(n[1], nextBound);
            for (let i = 3; i < n.length; i++) visit(n[i], localBound);
            return;
        }
        if (op === 'DerivativeCall' && typeof n[1] === 'string') {
            const baseName = n[1].trim();
            if (baseName && !RESERVED_BUILTIN_NAMES.has(baseName.toLowerCase()) && !localBound.has(baseName)) {
                out.add(baseName);
            }
            if (n[3] !== undefined) visit(n[3], localBound);
            return;
        }
        if (typeof op === 'string' && !AST_STRUCTURAL_OPS.has(op) && !RESERVED_BUILTIN_NAMES.has(op.toLowerCase())) {
            if (!localBound.has(op)) {
                out.add(op);
            }
        }
        for (let i = 1; i < n.length; i++) {
            visit(n[i], localBound);
        }
    };

    visit(node, boundVars);
    return Array.from(out);
}

/**
 * Verifica com precisão de AST se a expressão usa coordenadas espaciais (x, y, r, theta; e z, phi, rho em 3D).
 */
export function astContainsSpatialCoord(ast: any, is3D: boolean = false): boolean {
    const ids = collectASTIdentifiers(ast, { includeCalledFunctions: false });
    const target2D = ['x', 'y', 'r', 'theta', '\\theta', 'θ'];
    const target3D = ['z', 'phi', '\\phi', 'φ', 'rho', '\\rho', 'ρ'];
    for (const id of target2D) {
        if (ids.has(id)) return true;
    }
    if (is3D) {
        for (const id of target3D) {
            if (ids.has(id)) return true;
        }
    }
    return false;
}

/**
 * Valida se um nome segue a regra de identificadores do Desmos:
 * 1 letra (+ subscrito opcional ou sufixo numérico legado), letra grega, ou nome multi-letra vindo de \operatorname{...}.
 */
export function isValidDesmosIdentifier(
    name: string,
    options: { fromOperatorName?: boolean; allowLegacyDigitSuffix?: boolean } = {}
): boolean {
    const clean = (name || '').trim();
    if (!clean) return false;
    if (options.fromOperatorName) {
        return /^[a-zA-Z\u0370-\u03FF][a-zA-Z0-9_\u0370-\u03FF]*$/.test(clean);
    }
    const bareGreek = clean.startsWith('\\') ? clean.slice(1) : clean;
    if (GREEK_LETTER_NAMES.has(bareGreek.split('_')[0])) {
        const parts = bareGreek.split('_');
        return parts.length === 1 || (parts.length === 2 && /^[a-zA-Z0-9_]+$/.test(parts[1]));
    }
    if (/^[a-zA-Z\u0370-\u03FF](?:_[a-zA-Z0-9_]+)?$/.test(clean)) {
        return true;
    }
    if ((options.allowLegacyDigitSuffix ?? true) && /^[a-zA-Z]\d+$/.test(clean)) {
        return true;
    }
    return false;
}

export type StatementClassification =
    | { kind: 'var_assign'; name: string; lhsAst: any; rhsAst: any }
    | { kind: 'func_def'; name: string; params: string[]; lhsAst: any; rhsAst: any }
    | { kind: 'func_base_case'; name: string; argAsts: any[]; lhsAst: any; rhsAst: any }
    | { kind: 'plot_equation'; lhsAst: any; rhsAst: any };

function checkCircularDependency(
    targetName: string,
    directDeps: Set<string>,
    existingDeps: Record<string, Set<string>>
): boolean {
    if (directDeps.has(targetName)) return true;
    const visited = new Set<string>();
    const queue = Array.from(directDeps);
    while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === targetName) return true;
        if (visited.has(curr)) continue;
        visited.add(curr);
        const next = existingDeps[curr];
        if (next) {
            for (const dep of next) {
                if (!visited.has(dep)) queue.push(dep);
            }
        }
    }
    return false;
}

/**
 * Classifica uma igualdade parsed via PrattParser AST (`lhsAst = rhsAst`) e valida
 * proteção de constantes/funções reservadas e definições circulares diretas ou indiretas.
 */
export function classifyStatementAST(
    lhsAst: any,
    rhsAst: any,
    options: {
        is3D?: boolean;
        existingVarAsts?: Record<string, any>;
        existingFuncAsts?: Record<string, { params: string[]; ast: any; blockId?: string }>;
        operatorNames?: Set<string>;
        currentBlockId?: string;
    } = {}
): StatementClassification {
    const existingDeps: Record<string, Set<string>> = {};
    if (options.existingVarAsts) {
        for (const [k, vAst] of Object.entries(options.existingVarAsts)) {
            existingDeps[k] = collectASTIdentifiers(vAst, { includeCalledFunctions: true });
        }
    }
    if (options.existingFuncAsts) {
        for (const [k, fDef] of Object.entries(options.existingFuncAsts)) {
            existingDeps[k] = collectASTIdentifiers(fDef.ast, {
                includeCalledFunctions: true,
                boundVars: new Set(fDef.params)
            });
        }
    }

    // 1. Atribuição de variável / constante ou equação coordenada (LHS = identificador simples)
    if (typeof lhsAst === 'string') {
        const varName = lhsAst.trim();
        const lower = varName.toLowerCase();
        if (PROTECTED_CONSTANTS.has(varName) || PROTECTED_CONSTANTS.has(lower) ||
            RESERVED_BUILTIN_NAMES.has(varName) || RESERVED_BUILTIN_NAMES.has(lower)) {
            throw new DesmosSemanticError(
                `Não é possível redefinir a constante ou identificador reservado '${varName}'.`,
                'PROTECTED_IDENTIFIER'
            );
        }

        const rhsDeps = collectASTIdentifiers(rhsAst, { includeCalledFunctions: true });
        if (checkCircularDependency(varName, rhsDeps, existingDeps)) {
            throw new DesmosSemanticError(
                `Definição circular: não é possível definir '${varName}' em termos de si mesmo.`,
                'CIRCULAR_DEFINITION'
            );
        }

        if (isSpatialCoordinateVar(varName, Boolean(options.is3D))) {
            return { kind: 'plot_equation', lhsAst, rhsAst };
        }

        return { kind: 'var_assign', name: varName, lhsAst, rhsAst };
    }

    // 2. Definição de função f(x, y, ...) = expr (ou equação de gráfico se f já pertence a outro bloco)
    if (Array.isArray(lhsAst) && lhsAst.length >= 2 && typeof lhsAst[0] === 'string') {
        const isCallWrapper = lhsAst[0] === 'Call' && lhsAst.length >= 3 && typeof lhsAst[1] === 'string';
        const funcName = isCallWrapper ? lhsAst[1].trim() : lhsAst[0].trim();
        const argNodes = isCallWrapper ? lhsAst.slice(2) : lhsAst.slice(1);
        const lowerFunc = funcName.toLowerCase();
        const isBuiltinOrStructural =
            AST_STRUCTURAL_OPS.has(funcName) ||
            RESERVED_BUILTIN_NAMES.has(funcName) ||
            RESERVED_BUILTIN_NAMES.has(lowerFunc) ||
            PROTECTED_CONSTANTS.has(funcName) ||
            PROTECTED_CONSTANTS.has(lowerFunc);

        if (!isBuiltinOrStructural) {
            const isValidFn = isValidDesmosIdentifier(funcName, { fromOperatorName: options.operatorNames?.has(funcName) });

            // Base case externo (ex: f_{actorial}(0) = 1), independente da ordem dos blocos
            const allConstArgs = argNodes.length >= 1 && argNodes.every(arg =>
                collectASTIdentifiers(arg, { includeCalledFunctions: true }).size === 0
            );
            if (allConstArgs && isValidFn) {
                const rhsIds = collectASTIdentifiers(rhsAst);
                const hasPlotCoord = rhsIds.has('x') || rhsIds.has('y') || (Boolean(options.is3D) && rhsIds.has('z'));
                if (!hasPlotCoord) {
                    return { kind: 'func_base_case', name: funcName, argAsts: argNodes, lhsAst, rhsAst };
                }
            }

            const existingFunc = options.existingFuncAsts?.[funcName];
            if (existingFunc?.blockId && options.currentBlockId && existingFunc.blockId !== options.currentBlockId) {
                return { kind: 'plot_equation', lhsAst, rhsAst };
            }

            const allValidParams = argNodes.every(arg =>
                typeof arg === 'string' &&
                !PROTECTED_CONSTANTS.has(arg) &&
                !PROTECTED_CONSTANTS.has(arg.toLowerCase()) &&
                isValidDesmosIdentifier(arg)
            );
            const uniqueParams = new Set(argNodes as string[]);
            if (allValidParams && uniqueParams.size === argNodes.length) {
                if (!isValidFn) {
                    throw new DesmosSemanticError(
                        `Nome de função '${funcName}' inválido: use apenas 1 letra (com subscrito opcional) ou \\operatorname{...}.`,
                        'INVALID_FUNCTION_NAME'
                    );
                }
                const unwrapCall = (node: any): { fn: string; args: any[] } | null => {
                    if (!Array.isArray(node) || node.length === 0) return null;
                    if (node[0] === 'Call' && typeof node[1] === 'string') {
                        return { fn: node[1].trim(), args: node.slice(2) };
                    }
                    if (typeof node[0] === 'string') {
                        return { fn: node[0].trim(), args: node.slice(1) };
                    }
                    return null;
                };
                const directCall = unwrapCall(rhsAst);
                const isTrivialSelfIdentity = Boolean(
                    directCall &&
                    directCall.fn === funcName &&
                    directCall.args.length === argNodes.length &&
                    directCall.args.every((a, idx) => a === argNodes[idx])
                );
                if (isTrivialSelfIdentity) {
                    throw new DesmosSemanticError(
                        `Definição recursiva/circular não suportada para '${funcName}'.`,
                        'CIRCULAR_DEFINITION'
                    );
                }
                return { kind: 'func_def', name: funcName, params: argNodes as string[], lhsAst, rhsAst };
            }
        }
    }

    // 3. Caso contrário, equação implícita / relacional a ser plotada
    return { kind: 'plot_equation', lhsAst, rhsAst };
}


