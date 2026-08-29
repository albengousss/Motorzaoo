const TokenTypes = {
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

interface Token { type: string; value: string; }

class Tokenizer {
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



class PrattParser {
    tokenizer = new Tokenizer();
    lookahead: Token | null = null;

    constructor(expression: string) {
        this.tokenizer.init(expression);
        this.lookahead = this.tokenizer.getNextToken();
    }

    eat(tokenType: string) {
        const token = this.lookahead;
        if (token == null) throw new SyntaxError(`Fim inesperado da expressão.`);
        if (token.type !== tokenType) throw new SyntaxError(`Esperado ${tokenType}, recebido ${token.type}`);
        this.lookahead = this.tokenizer.getNextToken();
        return token;
    }

    parseExpression(precedence: number = 0): any {
        let token = this.lookahead;
        if (!token) throw new SyntaxError(`Expressão vazia.`);
        this.lookahead = this.tokenizer.getNextToken();
        let left = this.nud(token);

        while (this.lookahead && precedence < this.getPrecedence(this.lookahead.type)) {
            token = this.lookahead;
            this.lookahead = this.tokenizer.getNextToken();
            left = this.led(token, left);
        }
        return left;
    }

    nud(token: Token): any {
        if (token.type === TokenTypes.NUMBER) return parseFloat(token.value);
        if (token.type === TokenTypes.SUBTRACTION) return ["Negate", this.parseExpression(14)];
        
        if (token.type === TokenTypes.PARENTHESIS_LEFT) {
            const expr = this.parseExpression(0);
            this.eat(TokenTypes.PARENTHESIS_RIGHT);
            return expr;
        }

        if (token.type === TokenTypes.BRACKET_LEFT) {
            const list = ["List"];
            if (this.lookahead && this.lookahead.type !== TokenTypes.BRACKET_RIGHT) {
                list.push(this.parseExpression(0));
                while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    list.push(this.parseExpression(0));
                }
            }
            this.eat(TokenTypes.BRACKET_RIGHT);
            return list;
        }

        // MÓDULO MATEMÁTICO: |-2| vira ["Abs", -2]
        if (token.type === TokenTypes.PIPE) {
            const expr = this.parseExpression(0);
            this.eat(TokenTypes.PIPE);
            return ["Abs", expr];
        }
        
        // INTEGRAL E LIMITE
        if (token.type === TokenTypes.INTEGRAL || token.value === 'int' || token.value === '\\int') {
            const list: any[] = ["Integrate"];
            let lower = null;
            let upper = null;
            
            // Aceita limites em qualquer ordem (ex: \int_0^2 ou \int^2_0)
            for (let i = 0; i < 2; i++) {
                if (this.lookahead && this.lookahead.type === TokenTypes.UNDERSCORE) {
                    this.eat(TokenTypes.UNDERSCORE);
                    lower = this.parseExpression(10);
                } else if (this.lookahead && this.lookahead.type === TokenTypes.EXPONENTIATION) {
                    this.eat(TokenTypes.EXPONENTIATION);
                    upper = this.parseExpression(10);
                }
            }
            
            const expr = this.parseExpression(0);
            
            // Consumir o diferencial opcional ex: 'dy', 'dx'
            let diffVar = "x";
            if (this.lookahead && this.lookahead.type === TokenTypes.IDENTIFIER && this.lookahead.value.startsWith('d')) {
                diffVar = this.lookahead.value.substring(1).replace(/[\{\}\\]/g, '');
                this.eat(TokenTypes.IDENTIFIER);
            }
            
            list.push(expr);
            list.push(diffVar);
            if (lower !== null && upper !== null) {
                list.push(lower);
                list.push(upper);
            }
            return list;
        }

        // LIMITE
        if (token.type === TokenTypes.LIMIT || token.value === '\\lim') {
            const list: any[] = ["Limit"];
            let variable = "x";
            let target: any = 0;
            
            // lim_{x -> 0} f(x)
            if (this.lookahead && this.lookahead.type === TokenTypes.UNDERSCORE) {
                this.eat(TokenTypes.UNDERSCORE);
            }
            // pode estar entre chaves {x->0} ou parenteses (x->0)
            let expectClose = null;
            if (this.lookahead && (this.lookahead.type === TokenTypes.PARENTHESIS_LEFT || this.lookahead.value === '{')) {
                expectClose = this.lookahead.type === TokenTypes.PARENTHESIS_LEFT ? TokenTypes.PARENTHESIS_RIGHT : TokenTypes.PARENTHESIS_RIGHT; // tokenizer converte { e } para PARENTHESIS
                this.eat(this.lookahead.type);
            }
                
                if (this.lookahead && this.lookahead.type === TokenTypes.IDENTIFIER) {
                    variable = this.lookahead.value.replace(/[\{\}\\]/g, '');
                    this.eat(TokenTypes.IDENTIFIER);
                }
                
                if (this.lookahead && this.lookahead.type === TokenTypes.ARROW) {
                    this.eat(TokenTypes.ARROW);
                }
                
                target = this.parseExpression(0);
                
                if (expectClose && this.lookahead && this.lookahead.type === expectClose) {
                    this.eat(expectClose);
                }
            const expr = this.parseExpression(0);
            list.push(expr);
            list.push(variable);
            list.push(target);
            return list;
        }

        if (token.type === TokenTypes.IDENTIFIER) {
            // Limpa as chaves e remove espaços em branco (ex: f_{1} vira f_1)
            let rawName = token.value.replace(/[\{\}\\]/g, '').trim(); 

            if (this.lookahead && this.lookahead.type === TokenTypes.PARENTHESIS_LEFT) {
                this.eat(TokenTypes.PARENTHESIS_LEFT);
                const args = [];
                if (this.lookahead && this.lookahead.type !== TokenTypes.PARENTHESIS_RIGHT) {
                    args.push(this.parseExpression(0));
                    while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                        this.eat(TokenTypes.COMMA);
                        args.push(this.parseExpression(0));
                    }
                }
                this.eat(TokenTypes.PARENTHESIS_RIGHT);
                
                let name = rawName.toLowerCase();
                if (name === 'ln') name = 'log';
                if (name === 'tg') name = 'tan';
                
                if (['sin', 'cos', 'tan', 'log', 'exp', 'sqrt', 'abs'].includes(name)) {
                    return [name.charAt(0).toUpperCase() + name.slice(1), args[0]];
                }
                return [rawName, ...args];
            }
            return rawName; 
        }
        throw new SyntaxError(`Prefixo desconhecido para: ${token.value}`);
    }

    led(token: Token, left: any): any {
        if (token.type === TokenTypes.ADDITION) return ["Add", left, this.parseExpression(10)];
        if (token.type === TokenTypes.SUBTRACTION) return ["Subtract", left, this.parseExpression(10)];
        if (token.type === TokenTypes.MULTIPLICATION) return ["Multiply", left, this.parseExpression(20)];
        if (token.type === TokenTypes.DIVISION) return ["Divide", left, this.parseExpression(20)];
        if (token.type === TokenTypes.EXPONENTIATION) return ["Power", left, this.parseExpression(30 - 1)];
        throw new SyntaxError(`Infixo desconhecido para: ${token.value}`);
    }

    getPrecedence(type: string): number {
        if (type === TokenTypes.ADDITION || type === TokenTypes.SUBTRACTION) return 10;
        if (type === TokenTypes.MULTIPLICATION || type === TokenTypes.DIVISION) return 20;
        if (type === TokenTypes.EXPONENTIATION) return 30;
        return 0;
    }
}
console.log(JSON.stringify(new PrattParser('Determinant()=').parseExpression()));