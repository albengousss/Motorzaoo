import { MathEngine } from './mathEngine';

export class StateManager {
    // Memória rápida: Valores numéricos prontos para o motor gráfico ler
    static values: Record<string, number> = {};
    
    // Memória profunda: Árvores AST originais das variáveis compostas (ex: b = a * 2)
    static asts: Record<string, any> = {};

    // ODEs e Comandos Genéricos CAS: Armazena estado assíncrono para respostas do Giac
    static odeSolutions: Record<string, { query: string, name: string, expr: string, ast: any, index: number, spawnedBlockId?: string }> = {};
    static pendingOdes: Record<string, boolean> = {};
    
    static casSolutions: Record<string, { query: string, result: string, ast?: any, name?: string, variable?: string, index?: number, spawnedBlockId?: string }> = {};
    static pendingCas: Record<string, boolean> = {};
    static casSpawnedBlocks: Record<string, string> = {};
    static casIndices: Record<string, number> = {};
    
    // Armazena as definições enviadas ao Giac para evitar spam de _caseval
    static giacDefinitions: Record<string, string> = {};
    
    // Gerenciamento Inteligente de Índices (reaproveitamento para ODEs e CAS)
    static getNextFuncIndex(): number {
        const usedOde = Object.values(this.odeSolutions).filter(o => o && o.name !== 'Erro').map(o => o.index);
        const usedCas = Object.values(this.casIndices);
        const used = new Set([...usedOde, ...usedCas]);
        let i = 1;
        while (used.has(i)) i++;
        return i;
    }
    
    // O Grafo DAG: "Quem eu preciso atualizar se esta variável mudar?"
    // Ex: dependents["a"] = Set(["b", "c"]) -> Se 'a' mudar, recalcule 'b' e 'c'.
    static dependents: Record<string, Set<string>> = {};

    // Sistema de Cache: Incrementado para invalidar malhas de Marching Squares e matrizes intervalares sem re-parsing
    static globalCacheVersion: number = 0;
    static varVersions: Record<string, number> = {};

    /**
     * Extrai todas as variáveis (letras) de dentro de uma árvore MathJSON
     */
    static extractVariables(ast: any): string[] {
        let vars = new Set<string>();

        function traverse(node: any) {
            if (typeof node === 'string') {
                const isVar = /^\\?[a-zA-Z_][a-zA-Z0-9_]*$/.test(node);
                const isConstant = ['pi', '\\pi', 'π', 'e'].includes(node);
                if (isVar && !isConstant) vars.add(node);
            } else if (Array.isArray(node)) {
                // No MathJSON, o index 0 é a operação (ex: "Add", "Sin"), então começamos do 1
                for (let i = 1; i < node.length; i++) {
                    traverse(node[i]);
                }
            }
        }

        traverse(ast);
        return Array.from(vars);
    }

    /**
     * Limpeza (Garbage Collection): Remove variáveis que já não existem nos blocos
     */
    static gc(activeVars: string[]) {
        const activeSet = new Set(activeVars);
        for (const key in this.values) {
            if (!activeSet.has(key)) {
                delete this.values[key];
                delete this.asts[key];
                delete this.varVersions[key];
                for (const depKey in this.dependents) {
                    this.dependents[depKey].delete(key);
                }
            }
        }
    }

    /**
     * Define uma variável complexa no sistema (Acionado quando o usuário digita "b = a * 2")
     */
    static defineVariable(name: string, ast: any) {
        this.asts[name] = ast;
        const deps = this.extractVariables(ast);

        // Registra a dependência no Grafo DAG
        deps.forEach(dep => {
            if (!this.dependents[dep]) {
                this.dependents[dep] = new Set();
            }
            this.dependents[dep].add(name);
        });

        // Tenta calcular o valor imediato se as dependências já existirem
        this.recalculate(name);
    }

    /**
     * Atualiza um slider e propaga a onda de choque pelo Grafo (Acionado ao mover o mouse)
     */
    static updateSlider(name: string, value: number) {
        if (this.values[name] !== value) {
            this.values[name] = value;
            this.varVersions[name] = (this.varVersions[name] || 0) + 1;
            this.globalCacheVersion++;
            this.cascadeUpdate(name);
        }
    }

    /**
     * Recalcula uma variável específica usando o Compute Engine
     */
    private static recalculate(name: string) {
        if (this.asts[name] !== undefined) {
            const val = MathEngine.evaluateAST(this.asts[name], this.values);
            if (!isNaN(val) && this.values[name] !== val) {
                this.values[name] = val;
                this.varVersions[name] = (this.varVersions[name] || 0) + 1;
                this.globalCacheVersion++;
            }
        }
    }

    /**
     * Propagação do Estado (O Coração da Fase 2)
     * Usa uma fila (Busca em Largura) para atualizar todas as dependências em cascata sem travar a thread.
     */
    private static cascadeUpdate(changedVar: string) {
        const queue = [changedVar];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            
            if (visited.has(current)) continue; // Proteção contra loop infinito (A = B e B = A)
            visited.add(current);

            const deps = this.dependents[current];
            if (deps) {
                deps.forEach(dep => {
                    this.recalculate(dep); // Atualiza o filho
                    queue.push(dep);       // Adiciona o filho na fila para ver se ele tem netos
                });
            }
        }
    }
}