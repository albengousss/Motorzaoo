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
        'int', 'integrate', 'integral', 'defint', 'diff', 'derivative',
        'lim', 'limit', 'limitabove', 'limitbelow', 'sum', 'prod', 'product',
        'det', 'determinant', 'inv', 'invert', 'tran', 'transpose',
        'rref', 'reducedrowechelonform', 'rank', 'matrixrank',
        'trace', 'tr', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects',
        'matrix', 'matriz', 'ddx', 'dx',
        'solve', 'nsolve', 'factor', 'expand', 'simplify',
        'solveode', 'nsolveode', 'edo', 'campo', 'slopefield', 'campovetorial',
        'taylor', 'taylorpolynomial', 'laplace', 'inverselaplace',
        'mean', 'median', 'stdev', 'stddev', 'var', 'variance', 'samplesd', 'samplevariance',
        'length', 'size'
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
        s = s.replace(/\\(?:mathrm|text|operatorname)\{d\}/gi, 'd');
        s = s.replace(/\\text\{[^}]*\}/g, '');
        return s;
    }

    /**
     * Normaliza derivadas em LaTeX e AsciiMath para diff(expr, var) de forma resiliente
     * com suporte completo a delimitadores aninhados (evita corromper x^(2) em x^(2, x)).
     */
    static normalizeDerivative(inputStr: string): string {
        // Limpa wrappers visuais \left e \right do LaTeX para normalização pura
        let str = inputStr
            .replace(/\\left\s*([(\[{|])/g, '$1')
            .replace(/\\right\s*([)\]}|])/g, '$1')
            .replace(/\\left\./g, '')
            .replace(/\\right\./g, '')
            .replace(/\\left\b/g, '')
            .replace(/\\right\b/g, '');

        const derivOpRegex = /(?:\\frac\{\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|d)\s*\}\{\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|d)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}|frac\s*\(\s*(?:\\mathrm\{d\}|d)\s*\)\s*\(\s*(?:\\mathrm\{d\}|d)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)|(?:\(?\s*d\s*\)?\s*\/\s*\(?\s*d\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)?)|\\bdd([a-zA-Z_][a-zA-Z0-9_]*)\b)/i;
        
        let match: RegExpExecArray | null;
        let guard = 0;
        while ((match = derivOpRegex.exec(str)) !== null && guard++ < 10) {
            const fullMatch = match[0];
            const matchIndex = match.index;
            const derivVar = match[1] || match[2] || match[3] || match[4] || 'x';
            
            let afterIndex = matchIndex + fullMatch.length;
            while (afterIndex < str.length && /\s/.test(str[afterIndex])) {
                afterIndex++;
            }
            
            if (afterIndex >= str.length) {
                break;
            }
            
            let operand = '';
            let endIndex = afterIndex;
            
            if (str[afterIndex] === '(' || str[afterIndex] === '{' || str[afterIndex] === '[') {
                const openChar = str[afterIndex];
                const closeChar = openChar === '(' ? ')' : (openChar === '{' ? '}' : ']');
                let depth = 0;
                let i = afterIndex;
                for (; i < str.length; i++) {
                    if (str[i] === openChar) depth++;
                    else if (str[i] === closeChar) {
                        depth--;
                        if (depth === 0) {
                            i++;
                            break;
                        }
                    }
                }
                operand = str.slice(afterIndex + 1, i - 1).trim();
                endIndex = i;

                // Se houver uma potência logo após os delimitadores fechados (ex: (x+1)^2 ou (x+1)^(2))
                const powerMatch = str.slice(endIndex).match(/^\s*\^(\{[^}]*\}|\([^)]*\)|[a-zA-Z0-9.]+)/);
                if (powerMatch) {
                    operand = `(${operand})${powerMatch[0].trim()}`;
                    endIndex += powerMatch[0].length;
                }
            } else {
                let depth = 0;
                let j = afterIndex;
                for (; j < str.length; j++) {
                    const ch = str[j];
                    if (ch === '(' || ch === '{' || ch === '[') depth++;
                    else if (ch === ')' || ch === '}' || ch === ']') {
                        if (depth === 0) break;
                        depth--;
                    } else if (depth === 0 && (ch === '=' || ch === ';' || ch === ',')) {
                        break;
                    }
                }
                operand = str.slice(afterIndex, j).trim();
                endIndex = j;
            }
            
            if (!operand) {
                break;
            }

            const replacement = `diff(${operand}, ${derivVar})`;
            str = str.slice(0, matchIndex) + replacement + str.slice(endIndex);
        }
        return str;
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
        const boundSet = new Set<string>([
            ...this.PROTECTED_IDENTIFIERS,
            ...boundVariables
        ]);

        if (funcDecl) {
            boundSet.add(funcDecl[1]);
            funcDecl[2].split(',').forEach(p => boundSet.add(p.trim()));
            cleaned = cleaned.substring(funcDecl[0].length);
        } else {
            const assignDecl = cleaned.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            if (assignDecl) {
                // Se é 'a = 5', o próprio 'a' não é uma variável livre da expressão, é o alvo
                boundSet.add(assignDecl[1]);
                cleaned = cleaned.substring(assignDecl[0].length);
            }
        }

        // Operador diferencial: d/dx, \frac{d}{dx}, etc. O 'd' nunca é variável livre!
        const derivVarMatch = cleaned.match(/(?:\\frac\{\s*(?:\\mathrm\{d\}|d)\s*\}\{\s*(?:\\mathrm\{d\}|d)([a-zA-Z_][a-zA-Z0-9_]*)\s*\}|d\/d([a-zA-Z_][a-zA-Z0-9_]*)|(?:\(?d\)?\/\(?d([a-zA-Z_][a-zA-Z0-9_]*)\)?))\b/i);
        if (derivVarMatch) {
            const dVar = derivVarMatch[1] || derivVarMatch[2] || derivVarMatch[3];
            if (dVar) boundSet.add(dVar);
        }

        // Operadores de Integrais (int, defint, \int): protege 'd' e a variável de integração
        const hasIntCmd = /(?:\\int(?![a-zA-Z])|\\iint|\\iiint|\bint\b|\bdefint\b)/i.test(cleaned);
        if (hasIntCmd) {
            boundSet.add('d');
            boundSet.add('D');
            const diffVarMatches = cleaned.matchAll(/(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|(?<=\W)|\b|(?<=[a-zA-Z0-9_\)\}\]]))d\s*\\?([a-zA-Z_][a-zA-Z0-9_]*)/gi);
            for (const dm of diffVarMatches) {
                if (dm[1]) {
                    const varToken = dm[1].replace(/[\{\}\\]/g, '');
                    boundSet.add(varToken);
                }
            }
        }

        // Índices mudos de somatórios e produtórios (\sum_{n=1}^{10}, \prod_{i=1}^5)
        const sumProdMatches = cleaned.matchAll(/(?:\\sum|\\prod|\bsum\b|\bprod\b)\s*_\s*\{?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gi);
        for (const spm of sumProdMatches) {
            if (spm[1]) boundSet.add(spm[1]);
        }

        // Preserva letras gregas matemáticas antes da remoção geral de LaTeX
        const greekLetters = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];
        greekLetters.forEach(g => {
            const reg = new RegExp(`\\\\${g}\\b`, 'gi');
            cleaned = cleaned.replace(reg, g);
        });

        // 'd' só deve ser protegido se houver operador diferencial ou integral na expressão
        const hasDiffOp = derivVarMatch || hasIntCmd || /(?:\\frac\{\s*(?:\\mathrm\{d\}|d)|\bd\^?\d*\/d|\bddx\b|\\differentialD|\\partial)/i.test(rawStr);
        if (hasDiffOp) {
            boundSet.add('d');
        }

        // Operadores de matriz: transposta (^T, ^\top, ') e inversa (^-1) não são variáveis livres!
        cleaned = cleaned
            .replace(/\^\{?(?:T|\\top|intercal)\}?/gi, ' ')
            .replace(/\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, ' ')
            .replace(/'/g, ' ');

        // Funções reservadas e operadores matriciais espaçados pelo MathLive (det, rref, trace, rank, etc.)
        const spacedCasFuncs = [
            'rref', 'det', 'trace', 'rank', 'tran', 'transpose', 'inv', 'invert', 'matrix', 'matriz'
        ];
        spacedCasFuncs.forEach(fn => {
            const regex = new RegExp(fn.split('').join('\\s*'), 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });

        // Remove comandos LaTeX de formatação (ex: \frac, \left, \right, \operatorname)
        cleaned = cleaned.replace(/\\[a-zA-Z]+/g, ' ');

        // Remove diferenciais e operadores de integrais
        cleaned = cleaned
            .replace(/(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|\bd)\s*\\?[a-zA-Z_][a-zA-Z0-9_]*/gi, ' ')
            .replace(/(?:\\int(?![a-zA-Z])|\\iint|\\iiint|\bint\b|\bdefint\b)/gi, ' ');

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
                if (!boundSet.has(subscriptVar)) {
                    freeVars.add(subscriptVar);
                }
            } else if (match[2]) {
                const word = match[2];
                const lowerWord = word.toLowerCase();

                // Se a palavra inteira for uma função reservada, ignora
                if (this.RESERVED_FUNCTIONS.has(lowerWord) || boundSet.has(word)) {
                    continue;
                }

                // Se for uma palavra de 1 letra
                if (word.length === 1) {
                    if (!boundSet.has(word)) {
                        freeVars.add(word);
                    }
                } else {
                    // Sequência de letras que não é função reservada (ex: 'sqr', 'ab', 'kx')
                    // Desmos decompõe em letras individuais
                    for (const char of word) {
                        if (!boundSet.has(char)) {
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

        // Integral sem diferencial terminal (Padrão Desmos: int ou defint)
        const hasVisualIntegral = (
            /(?:\\int(?![a-zA-Z])|\\iint|\\iiint|\bint\b|\bdefint\b)/i.test(trimmedLatex) ||
            /(?:\\int(?![a-zA-Z])|\\iint|\\iiint|\bint\b|\bdefint\b)/i.test(trimmedAscii)
        ) && !/^(?:usr_)?[a-zA-Z_]+\s*(?:\([^)]*\))?\s*=\s*(?:integrate|Integral)\(/i.test(trimmedAscii)
          && !/^(?:integrate|Integral)\(/i.test(trimmedAscii);

        if (hasVisualIntegral) {
            // Limites vazios em integral definida (ex: \int_{}^{}, \int_{0}^{}, \int_{}^{2})
            if (/(?:_\{|\^\{|_\(|\^\()\s*(?:\}|\))/.test(trimmedLatex) || /(?:_\{|\^\{|_\(|\^\()\s*(?:\}|\))/.test(trimmedAscii)) {
                return { isIncomplete: true, warning: 'Faltam os limites de integração.' };
            }

            let sForDiff = (trimmedLatex || trimmedAscii || '').trim();
            sForDiff = sForDiff
                .replace(/#\?/g, '')
                .replace(/#@/g, '')
                .replace(/\\placeholder\{[^}]*\}/g, '')
                .replace(/\\mathrm\{d\}/gi, ' d ')
                .replace(/\\text\{d\}/gi, ' d ')
                .replace(/\\differentialD/gi, ' d ')
                .replace(/\\,/g, ' ')
                .trim();
            
            // Separa diferencial colado ao integrando (ex: xdx -> x d x, ydy -> y d y, (x+1)dt -> (x+1) d t), mas não palavras reservadas como defint, diff, det
            sForDiff = sForDiff.replace(/(?:(?<=\W)|\b|(?<=[a-zA-Z0-9_\)\}\]]))d(?!efint|iff|et)\s*(\\?[a-zA-Z_][a-zA-Z0-9_]*|\([a-zA-Z_][a-zA-Z0-9_]*\))/gi, ' d $1');

            // Se termina com operador diferencial incompleto "d" sem variável (ex: \int x d)
            if (/(?:^|[^a-zA-Z0-9_\\]|\s)d\s*$/i.test(sForDiff)) {
                return { isIncomplete: true, warning: 'O integrando deve terminar com uma variável de integração, como dx.' };
            }

            // Se termina imediatamente após a declaração da integral sem integrando ou diferencial
            if (/(?:\\int(?![a-zA-Z])|\bint\b|\bdefint\b)\s*(?:_\{[^}]*\}\^\{[^}]*\}|_[a-zA-Z0-9.]+\^[a-zA-Z0-9.]+)?\s*$/i.test(sForDiff)) {
                return { isIncomplete: true, warning: 'O integrando deve terminar com uma variável de integração, como dx.' };
            }

            const intCount = (sForDiff.match(/(?:\\int(?![a-zA-Z])|\\iint|\\iiint|\bint\b|\bdefint\b)/gi) || []).length;
            const sWithoutIntKeywords = sForDiff.replace(/(?:\\int(?![a-zA-Z])|\\iint|\\iiint|\bdefint\b|\bint\b)/gi, ' ');
            const diffMatches = sWithoutIntKeywords.match(/(?:^|[^a-zA-Z0-9_\\]|\s)d\s*(?:\\?[a-zA-Z_][a-zA-Z0-9_]*|\([a-zA-Z_][a-zA-Z0-9_]*\))/gi) || [];
            if (diffMatches.length < intCount) {
                return { isIncomplete: true, warning: 'O integrando deve terminar com uma variável de integração, como dx.' };
            }

            // Se o diferencial está presente mas os limites ainda têm placeholders do MathLive (#?), avisa sobre limites
            if (/(?:_\{|\^\{|_\(|\^\()\s*(?:#\?|#@)/.test(trimmedLatex) || /(?:_\{|\^\{|_\(|\^\()\s*(?:#\?|#@)/.test(trimmedAscii)) {
                return { isIncomplete: true, warning: 'Faltam os limites de integração.' };
            }
        }

        // Placeholders ativos do MathLive (#?, #@ ou \placeholder)
        if (/(?:#\?|#@|\\placeholder\{)/.test(trimmedLatex) || /(?:#\?|#@)/.test(trimmedAscii)) {
            if (/\\frac\{\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|d)\s*\}\{\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|d)[a-zA-Z_]?\s*\}\s*(?:\\left)?\(\s*(?:#\?|#@|\))/i.test(trimmedLatex) || /d\/d[a-zA-Z_]?\s*\(\s*(?:#\?|#@|\))/i.test(trimmedAscii)) {
                return { isIncomplete: true, warning: 'Informe a função para derivar (ex: d/dx(x^2)).' };
            }
            return { isIncomplete: true, warning: 'Preencha o termo em falta.' };
        }

        // Operador diferencial incompleto: \frac{d}{dx} ou d/dx sem argumento, ou com argumento vazio () ou {}
        if (
            /^(?:\\frac\{\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|d)\s*\}\{\s*(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD|d)[a-zA-Z_]?\s*\}|frac\s*\(\s*(?:\\mathrm\{d\}|d)\s*\)\s*\(\s*(?:\\mathrm\{d\}|d)[a-zA-Z_]?\s*\)|d\/d[a-zA-Z_]?|\(?d\)?\/\(?d[a-zA-Z_]?\)?)\s*(?:(?:\(|\{)\s*(?:\)|\})|\\left\(\s*\\right\))?\s*$/i.test(trimmedLatex) ||
            /^(?:d\/d[a-zA-Z_]?|\(?d\)?\/\(?d[a-zA-Z_]?\)?|frac\s*\(\s*d\s*\)\s*\(\s*d[a-zA-Z_]?\s*\))\s*(?:\(\s*\))?\s*$/i.test(trimmedAscii)
        ) {
            return { isIncomplete: true, warning: 'Informe a função para derivar (ex: d/dx(x^2)).' };
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

        // Expoente vazio ou incompleto: ^, ^{}, ^(), x^, x^{}, x^(), ou seguido de fechamento: (x^) ou \left(x^\right)
        if (/\^\s*(?:\{\s*\}|\(\s*\)|\)|\\right|\\le|\\ge|\\times|\\cdot|$|[,;])/.test(trimmedLatex) || /\^\s*(?:\{\s*\}|\(\s*\)|\)|$|[,;])/.test(trimmedAscii)) {
            return { isIncomplete: true, warning: 'Falta o expoente da potência.' };
        }

        // Parênteses vazios isolados ou em expressão: () ou 1 + ()
        if (/\(\s*\)/.test(trimmedAscii) || /(?:\\left\s*)?\(\s*(?:\\right\s*)?\)/.test(trimmedLatex)) {
            return { isIncomplete: true, warning: 'Preencha a expressão entre parênteses.' };
        }

        // Operador binário ou relacional solto no fim: +, -, *, /, ^, =, <, >, <=, >=, \cdot, \times
        if (/[+\-*/^=<>]$|\\le$|\\ge$|<=|>=|\\cdot$|\\times$/.test(trimmedAscii) || /[+\-*/^=<>]$|\\le$|\\ge$|\\cdot$|\\times$/.test(trimmedLatex)) {
            return { isIncomplete: true, warning: 'Falta um termo após o operador.' };
        }
        if (/[+\-*/^]\s*[,;\)\]\}]/.test(trimmedAscii) || /[+\-*/^]\s*[,;\)\]\}]/.test(trimmedLatex)) {
            return { isIncomplete: true, warning: 'Falta um termo após o operador.' };
        }

        // Módulo incompleto (|x)
        let pipes = 0;
        for (const ch of trimmedAscii) if (ch === '|') pipes++;
        if (pipes % 2 !== 0) {
            return { isIncomplete: true, warning: 'Feche a barra de módulo para concluir.' };
        }

        // Comandos e funções com parênteses vazios (ex: sin(), cos(), solveode(), det(), mean(), diff())
        const emptyParenMatch = trimmedAscii.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)/) ||
                                trimmedLatex.match(/(?:\\operatorname\{([^}]+)\}|\\([a-zA-Z]+)|\b([a-zA-Z_][a-zA-Z0-9_]*))\s*(?:\\left)?\(\s*(?:\\right)?\)/);
        if (emptyParenMatch) {
            const rawFn = (emptyParenMatch[1] || emptyParenMatch[2] || emptyParenMatch[3] || '').toLowerCase();
            if (rawFn === 'diff' || rawFn === 'derivative' || rawFn === 'ddx' || rawFn === 'dx') {
                return { isIncomplete: true, warning: 'Informe a função para derivar (ex: d/dx(x^2)).' };
            }
            if (this.RESERVED_FUNCTIONS.has(rawFn)) {
                return { isIncomplete: true, warning: `Informe os argumentos de ${rawFn}.` };
            }
        }

        // Funções unárias reservadas soltas no fim da linha sem argumento (ex: sin, cos, ln, sqrt)
        const trailingFnMatch = trimmedAscii.match(/(?:^|[^a-zA-Z_])(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|asin|acos|atan|asinh|acosh|atanh|log|ln|exp|sqrt|cbrt)\s*$/i) ||
                                trimmedLatex.match(/(?:\\operatorname\{([^}]+)\}|\\([a-zA-Z]+))\s*$/);
        if (trailingFnMatch) {
            const rawFn = (trailingFnMatch[1] || trailingFnMatch[2] || '').toLowerCase();
            if (this.RESERVED_FUNCTIONS.has(rawFn)) {
                return { isIncomplete: true, warning: `Informe o argumento de ${rawFn} (ex: ${rawFn}(x)).` };
            }
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
