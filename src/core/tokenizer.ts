export const TokenTypes = {
    VAR: 'VAR', PRINT: 'PRINT', NUMBER: 'NUMBER', IDENTIFIER: 'IDENTIFIER',
    ADDITION: '+', SUBTRACTION: '-', MULTIPLICATION: '*', DIVISION: '/',
    EXPONENTIATION: '^', PARENTHESIS_LEFT: '(', PARENTHESIS_RIGHT: ')',
    BRACKET_LEFT: '[', BRACKET_RIGHT: ']', COMMA: ',',
    SEMICOLON: ';', ASSIGNMENT: '=', 
    INTEGRAL: 'int', LIMIT: 'lim', UNDERSCORE: '_', DIFFERENTIAL: 'd', ARROW: '->',
    PIPE: '|',
    EOF: 'EOF'
};

const TokenSpec: Array<[RegExp, string | null]> = [
    [/^\s+/, null], 
    [/^\\?(?:int|integrate)(?![a-zA-Z])/, TokenTypes.INTEGRAL],
    [/^\\?(?:lim|limit)(?![a-zA-Z])/, TokenTypes.LIMIT],
    [/^->/, TokenTypes.ARROW],
    [/^_/, TokenTypes.UNDERSCORE],
    [/^\bd\b/, TokenTypes.DIFFERENTIAL],
    [/^\\?[a-zA-Z_][a-zA-Z0-9_\{\}]*/, TokenTypes.IDENTIFIER],
    [/^(?:\d+(?:\.\d*)?|\.\d+)/, TokenTypes.NUMBER],
    [/^\+/, TokenTypes.ADDITION],
    [/^\-/, TokenTypes.SUBTRACTION],
    [/^\*/, TokenTypes.MULTIPLICATION],
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
        let processed = str.replace(/d([a-zA-Z])$/i, ' d $1');
        
        // Multiplicação implícita inteligente universal
        // 1. (x+1)(x-1) -> (x+1)*(x-1)
        processed = processed.replace(/\)\s*\(/g, ')*(');
        // 2. (x+1)x ou (x+1)2 -> (x+1)*x ou (x+1)*2
        processed = processed.replace(/\)\s*([a-zA-Z0-9])/g, ')*$1');
        // 3. 2(x+1) -> 2*(x+1)
        processed = processed.replace(/(\d)\s*\(/g, '$1*(');
        // 4. 2x, 2y, 2z, etc. -> 2*x, 2*y, 2*z
        processed = processed.replace(/(\d)\s*([a-zA-Z])/g, '$1*$2');
        // 5. x(...), y(...), z(...), t(...) -> x*(...), y*(...), z*(...)
        processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*\(/g, '$1$2*(');
        // 6. Multiplicação implícita entre variáveis quaisquer: xy, xz, yz, zx, zy, yx, etc. (incluindo espaços: x z, y z)
        let prev = '';
        while (prev !== processed) {
            prev = processed;
            processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*([xyzt])(?![a-zA-Z_])/g, '$1$2*$3');
        }
        // 7. Multiplicação implícita entre x/y/z/t e funções (ex: x sin(y) ou z cos(x) -> x*sin(y))
        processed = processed.replace(/(^|[^a-zA-Z_])([xyzt])\s*\\?(sin|cos|tan|log|ln|exp|abs|sqrt|asin|acos|atan|sec|csc|cot)(?![a-zA-Z_])/g, '$1$2*$3');
        // 8. \pi x ou \pi(x) -> \pi*x ou \pi*(x)
        processed = processed.replace(/(\\pi|π)\s*([a-zA-Z0-9\(])/g, '$1*$2');

        this.string = processed;
        this.cursor = 0;
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
                // Limpa as barras invertidas do MathLive
                if (type === TokenTypes.IDENTIFIER) return { type, value: match[0].replace('\\', '') };
                return { type, value: match[0] };
            }
        }
        throw new SyntaxError(`Símbolo inesperado encontrado em "${str[0]}"`);
    }
}