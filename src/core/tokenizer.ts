export const TokenTypes = {
    VAR: 'VAR', PRINT: 'PRINT', NUMBER: 'NUMBER', IDENTIFIER: 'IDENTIFIER',
    ADDITION: '+', SUBTRACTION: '-', MULTIPLICATION: '*', DIVISION: '/',
    EXPONENTIATION: '^', PARENTHESIS_LEFT: '(', PARENTHESIS_RIGHT: ')',
    BRACE_LEFT: '{', BRACE_RIGHT: '}', COLON: ':',
    BRACKET_LEFT: '[', BRACKET_RIGHT: ']', COMMA: ',',
    SEMICOLON: ';', ASSIGNMENT: '=', 
    INTEGRAL: 'int', LIMIT: 'lim', UNDERSCORE: '_', DIFFERENTIAL: 'd', ARROW: '->',
    PIPE: '|',
    ELLIPSIS: '...', FOR: 'for', WITH: 'with',
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
    [/^\\?(?:(?:operatorname\*?|mathrm|text)\{for\}|\bfor\b)(?![a-zA-Z])/, TokenTypes.FOR],
    [/^\\?(?:(?:operatorname\*?|mathrm|text)\{with\}|\bwith\b)(?![a-zA-Z])/, TokenTypes.WITH],
    [/^\\?(?:(?:operatorname\*?|mathrm|text)\{and\}|\band\b|land\b|wedge\b)(?![a-zA-Z])/, TokenTypes.AND],
    [/^\\?(?:(?:operatorname\*?|mathrm|text)\{or\}|\bor\b|lor\b|vee\b)(?![a-zA-Z])/, TokenTypes.OR],
    [/^\\operatorname\*?\{([a-zA-Z_][a-zA-Z0-9_]*)\}/, TokenTypes.IDENTIFIER],
    [/^(?:<=|\\le(?:q)?(?![a-zA-Z]))/, TokenTypes.LESS_EQUAL],
    [/^(?:>=|\\ge(?:q)?(?![a-zA-Z]))/, TokenTypes.GREATER_EQUAL],
    [/^(?:!=|\\ne(?:q)?(?![a-zA-Z]))/, TokenTypes.NOT_EQUAL],
    [/^==/, TokenTypes.EQUAL],
    [/^</, TokenTypes.LESS],
    [/^>/, TokenTypes.GREATER],
    [/^\\?[a-zA-Z][a-zA-Z0-9]*_(?:\{[a-zA-Z0-9_]+\}|\([a-zA-Z0-9_]+\)|[a-zA-Z0-9_]+)/, TokenTypes.IDENTIFIER],
    [/^_/, TokenTypes.UNDERSCORE],
    [/^\bd\b/, TokenTypes.DIFFERENTIAL],
    [/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/, TokenTypes.NUMBER],
    [/^\./, TokenTypes.DOT],
    [/^(?:\\times(?![a-zA-Z])|×)/, TokenTypes.CROSS],
    [/^\\?[a-zA-Z_][a-zA-Z0-9_]*'+/, TokenTypes.IDENTIFIER],
    [/^\\?[a-zA-Z_][a-zA-Z0-9_]*/, TokenTypes.IDENTIFIER],
    [/^\+/, TokenTypes.ADDITION],
    [/^\-/, TokenTypes.SUBTRACTION],
    [/^(?:\*|\\cdot(?![a-zA-Z]))/, TokenTypes.MULTIPLICATION],
    [/^\//, TokenTypes.DIVISION],
    [/^\^/, TokenTypes.EXPONENTIATION],
    [/^\(/, TokenTypes.PARENTHESIS_LEFT],
    [/^\)/, TokenTypes.PARENTHESIS_RIGHT],
    [/^\{/, TokenTypes.BRACE_LEFT],
    [/^\}/, TokenTypes.BRACE_RIGHT],
    [/^:/, TokenTypes.COLON],
    [/^\[/, TokenTypes.BRACKET_LEFT],
    [/^\]/, TokenTypes.BRACKET_RIGHT],
    [/^,/, TokenTypes.COMMA],
    [/^\|/, TokenTypes.PIPE],
    [/^;/, TokenTypes.SEMICOLON],
    [/^=/, TokenTypes.ASSIGNMENT]
];

export interface Token { type: string; value: string; isOperatorName?: boolean; }

export class Tokenizer {
    private cursor: number = 0;
    private string: string = '';

    private static preprocessBraces(str: string): string {
        // Protege chaves literais do Desmos (\left\{ ... \right\}, \{ ... \}) como marcadores PUA
        let s = str
            .replace(/\\left\s*\\\{/g, '\uE001')
            .replace(/\\right\s*\\\}/g, '\uE002')
            .replace(/\\\{/g, '\uE001')
            .replace(/\\\}/g, '\uE002')
            .replace(/\\left\./g, '')
            .replace(/\\right\./g, '')
            .replace(/\\left(?![a-zA-Z])/g, '')
            .replace(/\\right(?![a-zA-Z])/g, '');

        const kindStack: Array<'KEEP' | 'GROUP' | 'PIECE'> = [];
        let out = '';

        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '{') {
                // Verifica contexto antes de '{'
                const prefix = out.replace(/[ \t]+$/, '');
                const isOpOrText = /\\(?:operatorname\*?|mathrm|text)$/.test(prefix);
                let kind: 'KEEP' | 'GROUP' | 'PIECE' = 'PIECE';

                if (isOpOrText) {
                    kind = 'KEEP';
                } else if (prefix.endsWith('^')) {
                    kind = 'GROUP';
                } else if (prefix.endsWith('_')) {
                    // Mantém v_{ar}, f_{1} como IDENTIFIER se NÃO for \int/\lim/\sum/\prod e conteúdo for alfanumérico simples
                    const isCalcSub = /(?:^|[^a-zA-Z])\\?(?:int|defint|integrate|lim|limit|sum|prod|product)_$/i.test(prefix);
                    if (!isCalcSub) {
                        let depth = 1;
                        let closeIdx = i + 1;
                        while (closeIdx < s.length && depth > 0) {
                            if (s[closeIdx] === '{') depth++;
                            else if (s[closeIdx] === '}') depth--;
                            closeIdx++;
                        }
                        const inner = depth === 0 ? s.slice(i + 1, closeIdx - 1) : '';
                        kind = /^[a-zA-Z0-9_]+$/.test(inner) ? 'KEEP' : 'GROUP';
                    } else {
                        kind = 'GROUP';
                    }
                } else if (/\\(?:sqrt|cbrt|abs|ln|log|exp|sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh)$/.test(prefix)) {
                    kind = 'GROUP';
                }

                kindStack.push(kind);
                out += kind === 'KEEP' ? '{' : (kind === 'GROUP' ? '(' : '\uE001');
            } else if (ch === '}') {
                const kind = kindStack.pop() || 'PIECE';
                out += kind === 'KEEP' ? '}' : (kind === 'GROUP' ? ')' : '\uE002');
            } else {
                out += ch;
            }
        }
        return out;
    }

    init(str: string) {
        let processed = Tokenizer.preprocessBraces((str || '')
            .replace(/\\tildeNbsp(?![a-zA-Z])/g, ' ')
            .replace(/\u00A0/g, ' ')
            .replace(/\\placeholder\{[^}]*\}/g, '')
            .replace(/#\?/g, '')
            .replace(/#@/g, '')
            .replace(/(\\operatorname\*?\{(?:for|with|and|or)\})/gi, ' $1 ')
            .trim()
            .replace(/π/g, 'pi')
            .replace(/θ/g, 'theta')
            .replace(/√\s*([a-zA-Z0-9_\(])/g, 'sqrt($1)')
            .replace(/(?:\\mathrm\{d\}|\\text\{d\}|\\differentialD)\s*([a-zA-Z_][a-zA-Z0-9_]*)/gi, ' d $1')
            .replace(/(?<!\.)(?:(?<=[^\w\.])|(?<=[\)\}\]\d])|(?<=(?:^|[^a-zA-Z_])[a-zA-Z_]))d\s*(?!et\b|im\b|eg\b|ot\b|ist\b|iff\b|efint\b)([a-zA-Z_]+)(?=\s*[+\-*\/,;\)\]]|\s*d\s*[a-zA-Z_]|\s*$)/gi, ' d $1'));
        
        // Escuda \operatorname*{...}, \mathrm{...}, \text{...} durante multiplicação implícita
        const shields: string[] = [];
        processed = processed.replace(/\\(?:operatorname\*?|mathrm|text)\{[^}]*\}/g, (m) => {
            const key = `\uE010${shields.length}\uE011`;
            shields.push(m);
            return key;
        });

        // Multiplicação implícita inteligente universal
        // 1. (x+1)(x-1) -> (x+1)*(x-1), e pares com chaves piecewise \uE001...\uE002
        processed = processed.replace(/\)\s*\(/g, ')*(');
        processed = processed.replace(/\uE002\s*\uE001/g, '\uE002*\uE001');
        processed = processed.replace(/\)\s*\uE001/g, ')*\uE001');
        processed = processed.replace(/\uE002\s*\(/g, '\uE002*(');
        // 2. (x+1)x, {cond}x -> )*x, \uE002*x (MAS NÃO antes de diferencial d x, dt, dx, operadores LaTeX como \times/\cdot, nem palavras-chave)
        processed = processed.replace(/([\)\uE002])\s*(?!d\s+[a-zA-Z_]|d[a-zA-Z_]\b|\b(?:for|with|and|or|to|in)\b|\\(?:times|cdot|div|ast|leq?|geq?|neq?|land|lor|wedge|vee|ldots|dots|cdots|dotsb)(?![a-zA-Z]))([a-zA-Z0-9\\])/gi, '$1*$2');
        // 3. 2(x+1) -> 2*(x+1) (MAS NÃO em f2(x) nem em limites ^1( ou _0()
        processed = processed.replace(/(?<![\^_a-zA-Z])(\d)\s*\(/g, '$1*(');
        // 3b. Operando antes de chave piecewise \uE001 (exceto palavras-chave e \operatorname)
        processed = processed.replace(/(?<![\^_])([0-9a-zA-Z_\]\}])\s*\uE001/g, (m, prevCh, offset, fullStr) => {
            const tail = fullStr.slice(0, offset + prevCh.length);
            const wordMatch = /([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(tail);
            if (wordMatch && /^(?:for|with|and|or|to|in|else)$/i.test(wordMatch[1])) {
                return m;
            }
            return `${prevCh}*\uE001`;
        });
        // 4. 2x, 2y, 2z, etc. (evitando quebrar notação científica 2e-5 e palavras-chave)
        processed = processed.replace(/(\d)\s*(?!e[+-]?\d|\b(?:for|with|and|or|to|in)\b)([a-zA-Z])/gi, '$1*$2');
        // 5. x(...), y(...), z(...), t(...) -> x*(...), y*(...), z*(...)
        processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*\(/g, '$1$2*(');
        // 6. Exponenciação com chaves seguida de identificador, parênteses ou função: x^{2}y, x^{2}(x+1)
        processed = processed.replace(/(\^\{[^{}]*\})\s*(?!\b(?:for|with|and|or|to|in)\b|\\(?:times|cdot|div|ast|leq?|geq?|neq?|land|lor|wedge|vee|ldots|dots|cdots|dotsb)(?![a-zA-Z]))(?=[a-zA-Z0-9_\(\\|\uE001])/gi, '$1*');
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

                const isAfterOperand = Boolean(prevNonSpace && /[0-9a-zA-Z_\)\}\]\uE002]/.test(prevNonSpace));
                const isAfterOpOrOpen = !prevNonSpace || /[+\-*\/^=,;(\[{<>\uE001]/.test(prevNonSpace);

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
                    if (prevNonSpace && (/[0-9a-zA-Z_\)\}\]\uE002]/.test(prevNonSpace) || (prevNonSpace === '|' && lastPipeType === 'CLOSE'))) {
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
                    if (nextNonSpace && /[0-9a-zA-Z_\(\{\uE001]/.test(nextNonSpace)) {
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
        processed = processed.replace(/(^|[^a-zA-Z_])(?![dD]\s+[a-zA-Z_]|\b(?:for|with|and|or|to|in)\b)([a-zA-Z])\s+(?![dD]\s+[a-zA-Z_]|\b(?:for|with|and|or|to|in)\b)([a-zA-Z])(?![a-zA-Z_])/gi, '$1$2*$3');
        // 11. \pi x ou \pi(x) -> \pi*x ou \pi*(x)
        processed = processed.replace(/(\\pi|pi)\s*([a-zA-Z0-9\(\uE001])/g, '$1*$2');

        // Restaura \operatorname*{...}, \mathrm{...}, \text{...} e converte marcadores piecewise PUA em '{' / '}' reais
        processed = processed
            .replace(/\uE010(\d+)\uE011/g, (_m, idx) => shields[Number(idx)])
            .replace(/\uE001/g, '{')
            .replace(/\uE002/g, '}');

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
                if (type === TokenTypes.IDENTIFIER && match.length > 1 && match[1] !== undefined) {
                    return { type, value: match[1].trim(), isOperatorName: true };
                }
                // Limpa as barras invertidas e delimitadores de subscrito do MathLive
                if (type === TokenTypes.IDENTIFIER) return { type, value: match[0].replace(/[\{\}\\\(\)]/g, '') };
                return { type, value: match[0] };
            }
        }
        throw new SyntaxError(`Símbolo inesperado encontrado em "${str[0]}"`);
    }
}