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
        
        // Multiplicação implícita (ex: 2x -> 2*x)
        processed = processed.replace(/(\d)([a-zA-Z\(])/g, '$1*$2');
        
        // CORREÇÃO: O replace acima transforma funções como f_1(3) em f_1*(3). 
        // Esta linha reverte o erro caso o asterisco esteja a separar um identificador de um parêntesis!
        processed = processed.replace(/(\\?[a-zA-Z_][a-zA-Z0-9_\{\}]*)\*\(/g, '$1(');

        // Tratamento especial de yx e xy (juntos ou separados) que falhariam no parser como identificador único
        processed = processed.replace(/(^|[^a-zA-Z_])y\s*x(?![a-zA-Z_])/g, '$1y*x');
        processed = processed.replace(/(^|[^a-zA-Z_])x\s*y(?![a-zA-Z_])/g, '$1x*y');
        
        // Multiplicação implícita entre x/y e funções (ex: x sin(y) -> x*sin(y))
        processed = processed.replace(/(^|[^a-zA-Z_])([xy])\s+(sin|cos|tan|log|ln|exp|abs|sqrt)(?![a-zA-Z_])/g, '$1$2*$3');

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