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

