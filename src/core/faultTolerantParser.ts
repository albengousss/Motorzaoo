/**
 * Parser Tolerante a Falhas e Analisador Heurístico de Expressões (Estilo Desmos)
 * Garante que estados intermediários de digitação nunca disparem exceções fatais,
 * detecta variáveis livres efêmeras e distingue operadores reservados.
 */

export interface TolerantParseResult {
    isValid: boolean;
    freeVariables: string[];
    isReservedFunction: boolean;
    warning: string | null;
    cleanAscii: string;
}

export class FaultTolerantParser {
    // Funções nativas e operadores CAS que não devem ser interpretados como incógnitas soltas
    public static readonly RESERVED_FUNCTIONS = new Set([
        'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
        'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
        'asinh', 'acosh', 'atanh',
        'sqrt', 'cbrt', 'nthroot', 'exp', 'log', 'ln', 'lg',
        'abs', 'floor', 'ceil', 'round', 'sign', 'sgn',
        'int', 'integrate', 'integral', 'diff', 'derivative',
        'lim', 'limit', 'sum', 'prod',
        'det', 'determinant', 'inv', 'invert', 'tran', 'transpose',
        'rref', 'reducedrowechelonform', 'rank', 'matrixrank',
        'trace', 'tr', 'eigenvalues', 'eigenvectors',
        'matrix', 'matriz', 'ddx', 'dx',
        'solve', 'nsolve', 'factor', 'expand', 'simplify'
    ]);

    // Coordenadas universais e constantes matemáticas protegidas
    public static readonly PROTECTED_IDENTIFIERS = new Set([
        'x', 'y', 'z', 'pi', 'e'
    ]);

    /**
     * Limpa resíduos de LaTeX gerados pelo MathLive para análise interna
     */
    static sanitizeLatex(latex: string): string {
        if (!latex) return '';
        let s = latex.trim();
        // Remove delimitadores de placeholder vazios do MathLive
        s = s.replace(/#\?/g, '');
        s = s.replace(/#@/g, '');
        s = s.replace(/\\placeholder\{[^}]*\}/g, '');
        s = s.replace(/\\text\{[^}]*\}/g, '');
        return s;
    }

    /**
     * Detecta variáveis livres em uma expressão, mesmo em estados intermediários.
     * Exemplo: 'sqr' -> ['s', 'q', 'r'] (como no Desmos)
     *          'rref' -> [] (reconhecido como operador)
     *          'y = a*x + b' -> ['a', 'b']
     *          'x_1' -> ['x_1'] (variável subscrita íntegra)
     */
    static detectFreeVariables(rawStr: string, boundVariables: string[] = []): string[] {
        if (!rawStr) return [];

        let cleaned = rawStr.trim();
        // Remove definições à esquerda do sinal de igual caso seja função ou atribuição
        // Ex: f(x) = ... ou a = ...
        const funcDecl = cleaned.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)\s*=/);
        const boundSet = new Set<string>([...this.PROTECTED_IDENTIFIERS, ...boundVariables]);

        if (funcDecl) {
            boundSet.add(funcDecl[1].toLowerCase());
            funcDecl[2].split(',').forEach(p => boundSet.add(p.trim().toLowerCase()));
            cleaned = cleaned.substring(funcDecl[0].length);
        } else {
            const assignDecl = cleaned.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            if (assignDecl) {
                // Se é 'a = 5', o próprio 'a' não é uma variável livre da expressão, é o alvo
                boundSet.add(assignDecl[1]);
                cleaned = cleaned.substring(assignDecl[0].length);
            }
        }

        const freeVars = new Set<string>();

        // Regex para capturar:
        // 1. Variáveis com subscrito: x_1, a_{2}, v_init
        // 2. Identificadores gerais: letras ou sequências de letras
        const tokenRegex = /([a-zA-Z][a-zA-Z0-9]*_(?:\{[a-zA-Z0-9]+\}|[a-zA-Z0-9]+))|([a-zA-Z]+)/g;
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(cleaned)) !== null) {
            if (match[1]) {
                // Variável subscrita (ex: x_1, x_2)
                const subscriptVar = match[1].replace(/[\{\}]/g, '');
                if (!boundSet.has(subscriptVar) && !boundSet.has(subscriptVar.toLowerCase())) {
                    freeVars.add(subscriptVar);
                }
            } else if (match[2]) {
                const word = match[2];
                const lowerWord = word.toLowerCase();

                // Se a palavra inteira for uma função reservada, ignora
                if (this.RESERVED_FUNCTIONS.has(lowerWord) || boundSet.has(lowerWord)) {
                    continue;
                }

                // Se for uma palavra de 1 letra
                if (word.length === 1) {
                    if (!boundSet.has(word) && !boundSet.has(lowerWord)) {
                        freeVars.add(word);
                    }
                } else {
                    // Sequência de letras que não é função reservada (ex: 'sqr', 'ab', 'kx')
                    // Desmos decompõe em letras individuais
                    for (const char of word) {
                        const charLower = char.toLowerCase();
                        if (!boundSet.has(char) && !boundSet.has(charLower)) {
                            freeVars.add(char);
                        }
                    }
                }
            }
        }

        return Array.from(freeVars);
    }

    /**
     * Analisa se a expressão está em um estado incompleto aceitável
     */
    static checkIncompleteStatus(latex: string = '', ascii: string = ''): { isIncomplete: boolean; warning: string | null } {
        const trimmedLatex = (latex || '').trim();
        const trimmedAscii = (ascii || trimmedLatex || '').trim();

        if (!trimmedAscii && !trimmedLatex) {
            return { isIncomplete: false, warning: null };
        }

        // Raiz quadrada vazia: \sqrt{}
        if (/\\sqrt\{\s*\}|\bsqrt\(\s*\)/.test(trimmedLatex) || /\\sqrt\{\s*\}/.test(trimmedAscii)) {
            return { isIncomplete: true, warning: 'Falta uma expressão dentro da raiz.' };
        }

        // Fração vazia: \frac{}{}
        if (/\\frac\{\s*\}\{\s*\}|\\frac\{[^}]*\}\{\s*\}/.test(trimmedLatex)) {
            return { isIncomplete: true, warning: 'Falta o denominador da fração.' };
        }
        if (/\\frac\{\s*\}\{/.test(trimmedLatex)) {
            return { isIncomplete: true, warning: 'Falta o numerador da fração.' };
        }

        // Operador binário solto no fim: +, -, *, /, ^
        if (/[+\-*/^=]$/.test(trimmedAscii)) {
            return { isIncomplete: true, warning: 'Falta um termo após o operador.' };
        }

        // Parênteses desbalanceados
        let openP = 0;
        for (const ch of trimmedAscii) {
            if (ch === '(') openP++;
            else if (ch === ')') openP--;
        }
        if (openP > 0) {
            return { isIncomplete: true, warning: 'Feche os parênteses para concluir a fórmula.' };
        }

        return { isIncomplete: false, warning: null };
    }
}
