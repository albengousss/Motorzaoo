export class SymbolTable {
    // Nosso dicionário de variáveis na memória
    private static variables: Record<string, number> = {};

    /**
     * Define o valor de uma variável (Ex: quando o usuário mover o slider do 'a')
     */
    static set(name: string, value: number) {
        this.variables[name] = value;
    }

    /**
     * Resgata o valor de uma variável. Retorna 0 se não existir.
     */
    static get(name: string): number {
        return this.variables[name] ?? 0; 
    }

    /**
     * Retorna uma cópia de todo o escopo atual (necessário para os cálculos em lote)
     */
    static getAll() {
        return { ...this.variables };
    }
}