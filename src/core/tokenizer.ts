export const TokenTypes = {
    VAR: 'VAR', PRINT: 'PRINT', NUMBER: 'NUMBER', IDENTIFIER: 'IDENTIFIER',
    ADDITION: '+', SUBTRACTION: '-', MULTIPLICATION: '*', DIVISION: '/',
    EXPONENTIATION: '^', PARENTHESIS_LEFT: '(', PARENTHESIS_RIGHT: ')',
    BRACKET_LEFT: '[', BRACKET_RIGHT: ']', COMMA: ',',
    SEMICOLON: ';', ASSIGNMENT: '=', 
    INTEGRAL: 'int', LIMIT: 'lim', UNDERSCORE: '_', DIFFERENTIAL: 'd', ARROW: '->',
    PIPE: '|',
    ELLIPSIS: '...', FOR: 'for',
    LESS: '<', GREATER: '>', LESS_EQUAL: '<=', GREATER_EQUAL: '>=',
    EQUAL: '==', NOT_EQUAL: '!=',
    AND: 'and', OR: 'or',
    DOT: '.', CROSS: '\\times',
    EOF: 'EOF'
};

const TokenSpec: Array<[RegExp, string | null]> = [
    [/^\s+/, null], 
    [/^(?:\.\.\.|\.\.|\\(?:ldots|dots|cdots|dotsb))/, TokenTypes.ELLIPSIS],
    [/^\\?(?:int|defint|integrate|iint|iiint)(?![a-zA-Z])/, TokenTypes.INTEGRAL],
    [/^\\?(?:lim|limit)(?![a-zA-Z])/, TokenTypes.LIMIT],
    [/^->/, TokenTypes.ARROW],
    [/^\\?(?:(?:operatorname|mathrm|text)\{for\}|\bfor\b)(?![a-zA-Z])/, TokenTypes.FOR],
    [/^\\?(?:(?:operatorname|mathrm|text)\{and\}|\band\b|land\b|wedge\b)(?![a-zA-Z])/, TokenTypes.AND],
    [/^\\?(?:(?:operatorname|mathrm|text)\{or\}|\bor\b|lor\b|vee\b)(?![a-zA-Z])/, TokenTypes.OR],
    [/^(?:<=|\\le(?:q)?(?![a-zA-Z]))/, TokenTypes.LESS_EQUAL],
    [/^(?:>=|\\ge(?:q)?(?![a-zA-Z]))/, TokenTypes.GREATER_EQUAL],
    [/^(?:!=|\\ne(?:q)?(?![a-zA-Z]))/, TokenTypes.NOT_EQUAL],
    [/^==/, TokenTypes.EQUAL],
    [/^</, TokenTypes.LESS],
    [/^>/, TokenTypes.GREATER],
    [/^\\?[a-zA-Z][a-zA-Z0-9]*_(?:\{[a-zA-Z0-9]+\}|\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+)/, TokenTypes.IDENTIFIER],
    [/^_/, TokenTypes.UNDERSCORE],
    [/^\bd\b/, TokenTypes.DIFFERENTIAL],
    [/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/, TokenTypes.NUMBER],
    [/^\./, TokenTypes.DOT],
    [/^\\times(?![a-zA-Z])/, TokenTypes.CROSS],
    [/^\\?[a-zA-Z_][a-zA-Z0-9_]*'+/, TokenTypes.IDENTIFIER],
    [/^\\?[a-zA-Z_][a-zA-Z0-9_]*/, TokenTypes.IDENTIFIER],
    [/^\+/, TokenTypes.ADDITION],
    [/^\-/, TokenTypes.SUBTRACTION],
    [/^(?:\*|\\cdot(?![a-zA-Z]))/, TokenTypes.MULTIPLICATION],
    [/^\//, TokenTypes.DIVISION],
    [/^\^/, TokenTypes.EXPONENTIATION],
    [/^\(/, TokenTypes.PARENTHESIS_LEFT],
    [/^\)/, TokenTypes.PARENTHESIS_RIGHT],
    [/^\{/, TokenTypes.PARENTHESIS_LEFT],  
    [/^\}/, TokenTypes.PARENTHESIS_RIGHT], 
    [/^\[/, TokenTypes.BRACKET_LEFT],
    [/^\]/, TokenTypes.BRACKET_RIGHT],
    [/^,/, TokenTypes.COMMA],
    [/^\|/, TokenTypes.PIPE],
    [/^;/, TokenTypes.SEMICOLON],
    [/^=/, TokenTypes.ASSIGNMENT]
];

export interface Token { type: string; value: string; }

export class Tokenizer {
    private cursor: number = 0;
    private string: string = '';

    init(str: string) {
        let processed = str.trim()
            .replace(/π/g, 'pi')
            .replace(/θ/g, 'theta')
            .replace(/√\s*([a-zA-Z0-9_\(])/g, 'sqrt($1)')
            .replace(/(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD)\s*([a-zA-Z_][a-zA-Z0-9_]*)/gi, ' d $1')
            .replace(/(?<!\.)(?:(?<=[^\w\.])|(?<=[\)\}\]\d])|(?<=(?:^|[^a-zA-Z_])[a-zA-Z_]))d\s*(?!et\b|im\b|eg\b|ot\b|ist\b|iff\b|efint\b)([a-zA-Z_]+)(?=\s*[+\-*\/,;\)\]]|\s*d\s*[a-zA-Z_]|\s*$)/gi, ' d $1');
        
        // Multiplicação implícita inteligente universal
        // 1. (x+1)(x-1) -> (x+1)*(x-1)
        processed = processed.replace(/\)\s*\(/g, ')*(');
        // 2. (x+1)x ou (x+1)2 -> (x+1)*x ou (x+1)*2 (MAS NÃO antes de diferencial d x, dt, dx, etc. nem palavras-chave)
        processed = processed.replace(/\)\s*(?!d\s+[a-zA-Z_]|d[a-zA-Z_]\b|\b(?:for|and|or|to|in)\b)([a-zA-Z0-9])/gi, ')*$1');
        // 3. 2(x+1) -> 2*(x+1) (MAS NÃO em f2(x) nem em limites ^1( ou _0()
        processed = processed.replace(/(?<![\^_a-zA-Z])(\d)\s*\(/g, '$1*(');
        // 4. 2x, 2y, 2z, etc. (evitando quebrar notação científica 2e-5 e palavras-chave)
        processed = processed.replace(/(\d)\s*(?!e[+-]?\d|\b(?:for|and|or|to|in)\b)([a-zA-Z])/gi, '$1*$2');
        // 5. x(...), y(...), z(...), t(...) -> x*(...), y*(...), z*(...)
        processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*\(/g, '$1$2*(');
        // 6. Exponenciação com chaves seguida de identificador, parênteses ou função: x^{2}y, x^{2}(x+1) (mas não palavras-chave)
        processed = processed.replace(/\}\s*(?!\b(?:for|and|or|to|in)\b)(?=[a-zA-Z0-9_\(\\|])/gi, '}*');
        // 7. Potências numéricas soltas: x^2(x+1) (MAS NÃO em potências de funções como sin^2(x))
        processed = processed.replace(/(?<!\b(?:sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|asin|acos|atan|asinh|acosh|atanh|log|ln|exp|sqrt|cbrt))(\^[0-9]+)\s*\(/gi, '$1*(');
        // 8. Módulos matemáticos (|...|) com detecção contextual e suporte a aninhamento arbitrário
        let pipeDepth = 0;
        let lastPipeType: 'OPEN' | 'CLOSE' | null = null;
        let pipeAdjusted = '';

        for (let i = 0; i < processed.length; i++) {
            const ch = processed[i];
            if (ch === '|') {
                // Procurar último caractere significativo antes deste pipe
                let prevNonSpace = '';
                for (let j = pipeAdjusted.length - 1; j >= 0; j--) {
                    if (pipeAdjusted[j] !== ' ') { prevNonSpace = pipeAdjusted[j]; break; }
                }

                const isAfterOperand = Boolean(prevNonSpace && /[0-9a-zA-Z_\)\}\]]/.test(prevNonSpace));
                const isAfterOpOrOpen = !prevNonSpace || /[+\-*\/^=,;(\[{<>]/.test(prevNonSpace);

                let isOpening = false;
                if (isAfterOpOrOpen) {
                    isOpening = true;
                } else if (isAfterOperand) {
                    // Precedido por operando: se já temos pipes abertos, este fecha
                    if (pipeDepth > 0) {
                        isOpening = false;
                    } else {
                        // Se não havia pipe aberto, é abertura com multiplicação implícita (ex: 2|x|)
                        isOpening = true;
                    }
                } else if (prevNonSpace === '|') {
                    if (lastPipeType === 'OPEN') {
                        isOpening = true;
                    } else {
                        // Após fechar um pipe (|x||y|): se depth === 0, abre o próximo
                        isOpening = (pipeDepth === 0);
                    }
                }

                if (isOpening) {
                    // Se precedido por operando ou pipe fechado, injeta '*' (ex: 2|x| -> 2*|x|, |x||y| -> |x|*|y|)
                    if (prevNonSpace && (/[0-9a-zA-Z_\)\}\]]/.test(prevNonSpace) || (prevNonSpace === '|' && lastPipeType === 'CLOSE'))) {
                        pipeAdjusted += '*';
                    }
                    pipeAdjusted += '|';
                    pipeDepth++;
                    lastPipeType = 'OPEN';
                } else {
                    pipeAdjusted += '|';
                    pipeDepth = Math.max(0, pipeDepth - 1);
                    lastPipeType = 'CLOSE';

                    // Após fechar pipe, se for seguido por operando, injeta '*' (ex: |x|2 -> |x|*2, |x|y -> |x|*y, |x|(y) -> |x|*(y))
                    let nextNonSpace = '';
                    for (let j = i + 1; j < processed.length; j++) {
                        if (processed[j] !== ' ') { nextNonSpace = processed[j]; break; }
                    }
                    if (nextNonSpace && /[0-9a-zA-Z_\(\{]/.test(nextNonSpace)) {
                        pipeAdjusted += '*';
                    }
                }
            } else {
                pipeAdjusted += ch;
            }
        }
        processed = pipeAdjusted;

        // 9. Multiplicação implícita entre variáveis quaisquer: xy, xz, yz, zx, zy, yx, etc. (incluindo espaços: x z, y z)
        let prev = '';
        while (prev !== processed) {
            prev = processed;
            processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*([xyzt])(?![a-zA-Z_])/g, '$1$2*$3');
        }
        // 10. Multiplicação implícita com coordenadas x, y, z, t: x sin(x), xsin(x)
        processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*\\?(asinh|acosh|atanh|asin|acos|atan|sinh|cosh|tanh|cbrt|nthroot|sqrt|sec|csc|cot|sin|cos|tan|log|ln|exp|abs)(?![a-zA-Z_])/g, '$1$2*$3');
        // Letras genéricas/sliders exigem espaço antes de função (ex: a sin(x), a asinh(x)), evitando quebrar asin(x), asinh(x), acos(x), atan(x)
        processed = processed.replace(/(^|[^a-zA-Z_])([a-zA-Z])\s+\\?(asinh|acosh|atanh|asin|acos|atan|sinh|cosh|tanh|cbrt|nthroot|sqrt|sec|csc|cot|sin|cos|tan|log|ln|exp|abs)(?![a-zA-Z_])/g, '$1$2*$3');
        // Letras separadas por espaço: MAS NUNCA quando envolver diferencial d ou palavras-chave (ex: x dx ou k for)
        processed = processed.replace(/(^|[^a-zA-Z_])(?![dD]\s+[a-zA-Z_]|\b(?:for|and|or|to|in)\b)([a-zA-Z])\s+(?![dD]\s+[a-zA-Z_]|\b(?:for|and|or|to|in)\b)([a-zA-Z])(?![a-zA-Z_])/gi, '$1$2*$3');
        // 11. \pi x ou \pi(x) -> \pi*x ou \pi*(x)
        processed = processed.replace(/(\\pi|pi)\s*([a-zA-Z0-9\(])/g, '$1*$2');

        this.string = processed;
        this.cursor = 0;
    }

    tokenize(str?: string): Token[] {
        if (str !== undefined) this.init(str);
        const tokens: Token[] = [];
        while (this.hasMoreTokens()) {
            const tok = this.getNextToken();
            if (tok) tokens.push(tok);
        }
        return tokens;
    }

    hasMoreTokens(): boolean { return this.cursor < this.string.length; }

    getNextToken(): Token | null {
        if (!this.hasMoreTokens()) return null;
        const str = this.string.slice(this.cursor);

        for (const [regex, type] of TokenSpec) {
            const match = regex.exec(str);
            if (match) {
                this.cursor += match[0].length;
                if (type === null) return this.getNextToken();
                // Limpa as barras invertidas e delimitadores de subscrito do MathLive
                if (type === TokenTypes.IDENTIFIER) return { type, value: match[0].replace(/[\{\}\\\(\)]/g, '') };
                return { type, value: match[0] };
            }
        }
        throw new SyntaxError(`Símbolo inesperado encontrado em "${str[0]}"`);
    }
}