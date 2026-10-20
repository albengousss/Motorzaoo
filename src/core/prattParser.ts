import { Tokenizer, TokenTypes } from './tokenizer';
import type { Token } from './tokenizer';

export class PrattParser {
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

    private depth: number = 0;

    parse(): any {
        return this.parseExpression(0);
    }

    parseExpression(precedence: number = 0): any {
        const isTopLevel = (this.depth === 0);
        this.depth++;
        try {
            let token = this.lookahead;
            if (!token) throw new SyntaxError(`Expressão vazia.`);
            this.lookahead = this.tokenizer.getNextToken();
            let left = this.nud(token);

            while (this.lookahead && precedence < this.getPrecedence(this.lookahead.type)) {
                token = this.lookahead;
                this.lookahead = this.tokenizer.getNextToken();
                left = this.led(token, left);
            }

            if (isTopLevel && this.lookahead !== null) {
                // Suporte a múltiplos pontos ou expressões separadas por vírgula no nível raiz: (1, 1), (2, 1), (3, 1)
                if (this.lookahead.type === TokenTypes.COMMA) {
                    const list = ["List", left];
                    while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                        this.eat(TokenTypes.COMMA);
                        list.push(this.parseExpression(0));
                    }
                    return list;
                }
                throw new SyntaxError(`Símbolo inesperado ou operador ausente: "${this.lookahead.value}"`);
            }
            return left;
        } finally {
            this.depth--;
        }
    }

    nud(token: Token): any {
        if (token.type === TokenTypes.NUMBER) return parseFloat(token.value);
        if (token.type === TokenTypes.DIFFERENTIAL) return "d";
        if (token.type === TokenTypes.ADDITION) return this.parseExpression(14);
        if (token.type === TokenTypes.SUBTRACTION) return ["Negate", this.parseExpression(14)];
        
        if (token.type === TokenTypes.PARENTHESIS_LEFT) {
            const expr = this.parseExpression(0);
            if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                const point = ["Point", expr];
                while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    point.push(this.parseExpression(0));
                }
                this.eat(TokenTypes.PARENTHESIS_RIGHT);
                return point;
            }
            this.eat(TokenTypes.PARENTHESIS_RIGHT);
            return expr;
        }

        if (token.type === TokenTypes.ELLIPSIS) {
            const end = this.parseExpression(0);
            return ["Slice", 1, end];
        }

        if (token.type === TokenTypes.BRACKET_LEFT) {
            // 1. Lista vazia: []
            if (this.lookahead && this.lookahead.type === TokenTypes.BRACKET_RIGHT) {
                this.eat(TokenTypes.BRACKET_RIGHT);
                return ["List"];
            }

            // 2. Fatiamento aberto no início: [...k]
            if (this.lookahead && this.lookahead.type === TokenTypes.ELLIPSIS) {
                this.eat(TokenTypes.ELLIPSIS);
                const end = this.parseExpression(0);
                this.eat(TokenTypes.BRACKET_RIGHT);
                return ["Slice", 1, end];
            }

            // 3. Primeiro elemento da lista ou expressão de compreensão
            const first = this.parseExpression(0);

            // Se o primeiro item já foi parsed como compreensão [expr for ...]:
            if (Array.isArray(first) && (first[0] === 'Comprehension' || first[0] === 'MatrixComprehension')) {
                this.eat(TokenTypes.BRACKET_RIGHT);
                return first;
            }

            // 4. Sequência de faixa sintética: [a...b] ou [a...]
            if (this.lookahead && this.lookahead.type === TokenTypes.ELLIPSIS) {
                this.eat(TokenTypes.ELLIPSIS);
                if (this.lookahead && this.lookahead.type === TokenTypes.BRACKET_RIGHT) {
                    this.eat(TokenTypes.BRACKET_RIGHT);
                    return ["Slice", first, null];
                }
                const end = this.parseExpression(0);
                this.eat(TokenTypes.BRACKET_RIGHT);
                return ["Range", first, end];
            }

            // 5. Elementos separados por vírgula: [a, c...b] ou lista padrão [a, b, ...]
            if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                this.eat(TokenTypes.COMMA);
                const second = this.parseExpression(0);

                // Passo deduzido: [a, c...b]
                if (this.lookahead && this.lookahead.type === TokenTypes.ELLIPSIS) {
                    this.eat(TokenTypes.ELLIPSIS);
                    const end = this.parseExpression(0);
                    this.eat(TokenTypes.BRACKET_RIGHT);
                    return ["RangeStep", first, second, end];
                }

                const list = ["List", first, second];
                while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    list.push(this.parseExpression(0));
                }
                this.eat(TokenTypes.BRACKET_RIGHT);
                return list;
            }

            this.eat(TokenTypes.BRACKET_RIGHT);
            return ["List", first];
        }

        // MÓDULO MATEMÁTICO: |-2| vira ["Abs", -2]
        if (token.type === TokenTypes.PIPE) {
            const expr = this.parseExpression(0);
            this.eat(TokenTypes.PIPE);
            return ["Abs", expr];
        }
        
        // INTEGRAL E LIMITE
        if (token.type === TokenTypes.INTEGRAL || token.value === 'int' || token.value === '\\int' || token.value === 'integrate') {
            const list: any[] = ["Integrate"];
            let lower: any = null;
            let upper: any = null;

            // Formato funcional: int(expr, var, [lower, upper]) ou integrate(...)
            if (this.lookahead && this.lookahead.type === TokenTypes.PARENTHESIS_LEFT) {
                this.eat(TokenTypes.PARENTHESIS_LEFT);
                const expr = this.parseExpression(0);
                let diffVar: string | null = null;
                if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    const varNode = this.parseExpression(0);
                    if (typeof varNode === 'string') diffVar = varNode.replace(/[\{\}\\]/g, '');
                    else if (typeof varNode === 'number') diffVar = varNode.toString();
                }
                if (!diffVar && token.value !== 'integrate') {
                    throw new Error("O integrando deve terminar com uma variável de integração, como dx.");
                }
                diffVar = diffVar || 'x';

                if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    lower = this.parseExpression(0);
                }
                if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    upper = this.parseExpression(0);
                }
                this.eat(TokenTypes.PARENTHESIS_RIGHT);
                list.push(expr);
                list.push(diffVar);
                if (lower !== null && upper !== null) {
                    list.push(lower);
                    list.push(upper);
                }
                return list;
            }
            
            // Aceita limites em qualquer ordem (ex: \int_0^2 ou \int^2_0)
            for (let i = 0; i < 2; i++) {
                if (this.lookahead && this.lookahead.type === TokenTypes.UNDERSCORE) {
                    this.eat(TokenTypes.UNDERSCORE);
                    lower = this.parseExpression(30);
                } else if (this.lookahead && this.lookahead.type === TokenTypes.EXPONENTIATION) {
                    this.eat(TokenTypes.EXPONENTIATION);
                    upper = this.parseExpression(30);
                }
            }

            // Descarta multiplicação implícita residual entre o limite superior e o integrando (ex: \int_0^2 x -> 2*x)
            if (this.lookahead && this.lookahead.type === TokenTypes.MULTIPLICATION) {
                this.eat(TokenTypes.MULTIPLICATION);
            }
            
            let expr: any = null;
            // Se o lookahead já for o diferencial (ex: \int dx ou \int_{0}^{1} dt), o integrando é 1
            if (this.lookahead && (this.lookahead.type === TokenTypes.DIFFERENTIAL || (this.lookahead.type === TokenTypes.IDENTIFIER && this.lookahead.value.startsWith('d') && this.lookahead.value.length > 1))) {
                expr = 1;
            } else if (this.lookahead) {
                expr = this.parseExpression(0);
            } else {
                throw new Error("O integrando deve terminar com uma variável de integração, como dx.");
            }
            
            // Consumir o diferencial obrigatório (Padrão Desmos: 'dx', 'dt', 'dy', etc.)
            let diffVar: string | null = null;
            if (this.lookahead && this.lookahead.type === TokenTypes.DIFFERENTIAL) {
                this.eat(TokenTypes.DIFFERENTIAL);
                if (this.lookahead && this.lookahead.type === TokenTypes.MULTIPLICATION) {
                    this.eat(TokenTypes.MULTIPLICATION);
                }
                if (this.lookahead && (this.lookahead.type === TokenTypes.IDENTIFIER || this.lookahead.type === TokenTypes.VAR)) {
                    diffVar = this.lookahead.value.replace(/[\{\}\\]/g, '');
                    this.eat(this.lookahead.type);
                }
            } else if (this.lookahead && (this.lookahead.type === TokenTypes.IDENTIFIER || this.lookahead.type === TokenTypes.VAR) && this.lookahead.value.startsWith('d') && this.lookahead.value.length > 1) {
                diffVar = this.lookahead.value.substring(1).replace(/[\{\}\\]/g, '');
                this.eat(this.lookahead.type);
            }

            if (!diffVar) {
                throw new Error("O integrando deve terminar com uma variável de integração, como dx.");
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
        if (token.type === TokenTypes.LIMIT || token.value === '\\lim' || token.value === 'lim') {
            // Suporte a forma funcional: lim(expr, var, target)
            if (this.lookahead && this.lookahead.type === TokenTypes.PARENTHESIS_LEFT) {
                this.eat(TokenTypes.PARENTHESIS_LEFT);
                const expr = this.parseExpression(0);
                let variable = "x";
                let target: any = 0;
                if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                    if (this.lookahead && (this.lookahead.type === TokenTypes.IDENTIFIER || this.lookahead.type === TokenTypes.VAR)) {
                        variable = this.lookahead.value.replace(/[\{\}\\]/g, '');
                        this.eat(this.lookahead.type);
                    }
                    if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                        this.eat(TokenTypes.COMMA);
                        target = this.parseExpression(0);
                    }
                }
                this.eat(TokenTypes.PARENTHESIS_RIGHT);
                return ["Limit", expr, variable, target];
            }

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
                expectClose = TokenTypes.PARENTHESIS_RIGHT; // tokenizer converte { e } para PARENTHESIS
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
            // Descarta multiplicação implícita residual após fechar o limite (ex: lim_{x -> 0} *(sin(x)/x))
            if (this.lookahead && this.lookahead.type === TokenTypes.MULTIPLICATION) {
                this.eat(TokenTypes.MULTIPLICATION);
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
            let name = rawName.toLowerCase();
            if (name === 'tg') name = 'tan';
            if (name === 'cossec') name = 'csc';
            if (name === 'cotan') name = 'cot';
            if (name === 'arcsin') name = 'asin';
            if (name === 'arccos') name = 'acos';
            if (name === 'arctan') name = 'atan';
            if (name === 'arcsec') name = 'asec';
            if (name === 'arccsc' || name === 'arccossec') name = 'acsc';
            if (name === 'arccot' || name === 'arccotan') name = 'acot';
            if (name === 'arcsinh') name = 'asinh';
            if (name === 'arccosh') name = 'acosh';
            if (name === 'arctanh') name = 'atanh';

            const unaryMathFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'asec', 'acsc', 'acot', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'log', 'ln', 'exp', 'sqrt', 'cbrt', 'abs'];

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

                if (name === 'log') {
                    if (args.length === 2) {
                        return ['Log', args[0], args[1]];
                    }
                    return ['Log', args[0]];
                }
                if (name === 'log') {
                    if (args.length === 2) {
                        return ['Log', args[0], args[1]];
                    }
                    return ['Log', args[0]];
                }
                if (name === 'log') {
                    if (args.length === 2) {
                        return ['Log', args[0], args[1]];
                    }
                    return ['Log', args[0]];
                }
                if (unaryMathFuncs.includes(name)) {
                    return [name.charAt(0).toUpperCase() + name.slice(1), args[0]];
                }
                if (name === 'nthroot' && args.length === 2) {
                    return ['Nthroot', args[0], args[1]];
                }
                if (name === 'polygon') {
                    return ['Polygon', ...args];
                }
                return [rawName, ...args];
            }

            // Suporte defensivo a funções matemáticas unárias sem parênteses (ex: sin x, cos 2x, ln x, sqrt x)
            if (unaryMathFuncs.includes(name)) {
                if (this.lookahead && [TokenTypes.NUMBER, TokenTypes.IDENTIFIER, TokenTypes.VAR, TokenTypes.PARENTHESIS_LEFT, TokenTypes.PIPE, TokenTypes.ADDITION, TokenTypes.SUBTRACTION].includes(this.lookahead.type)) {
                    const arg = this.parseExpression(19);
                    return [name.charAt(0).toUpperCase() + name.slice(1), arg];
                }
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

        // Acesso a propriedades (.x, .y, .z, .rows, .columns, etc.): P.x, M.rows
        if (token.type === TokenTypes.DOT) {
            let propToken = this.lookahead;
            if (!propToken || (
                propToken.type !== TokenTypes.IDENTIFIER &&
                propToken.type !== TokenTypes.VAR &&
                propToken.type !== TokenTypes.DIFFERENTIAL &&
                !['rows', 'columns', 'row', 'col', 'cols', 'det', 'trace', 'tr', 'rank', 'x', 'y', 'z', 'magnitude', 'mag', 'length', 'size', 'count', 'mean', 'total', 'sum', 'min', 'max'].includes(propToken.value)
            )) {
                throw new SyntaxError(`Esperado identificador de propriedade após "."`);
            }
            const propName = propToken.value.replace(/[\{\}\\]/g, '');
            this.eat(propToken.type);
            return ["PropertyAccess", left, propName];
        }

        // Fatiamento e indexação por colchetes: L[1], L[1, 3], M[r; c], M[; c], M[r;]
        if (token.type === TokenTypes.BRACKET_LEFT) {
            // Caso especial: indexação matricial com omissão de linhas M[; c]
            if (this.lookahead && this.lookahead.type === TokenTypes.SEMICOLON) {
                this.eat(TokenTypes.SEMICOLON);
                let colParts: any = null;
                if (this.lookahead && this.lookahead.type !== TokenTypes.BRACKET_RIGHT) {
                    const firstCol = this.parseExpression(0);
                    colParts = [firstCol];
                    while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                        this.eat(TokenTypes.COMMA);
                        colParts.push(this.parseExpression(0));
                    }
                }
                this.eat(TokenTypes.BRACKET_RIGHT);
                const finalCols = colParts && colParts.length === 1 ? colParts[0] : colParts;
                return ["MatrixIndex", left, null, finalCols];
            }

            // Slices abertos no início: L[...4]
            if (this.lookahead && this.lookahead.type === TokenTypes.ELLIPSIS) {
                this.eat(TokenTypes.ELLIPSIS);
                const end = this.parseExpression(0);
                this.eat(TokenTypes.BRACKET_RIGHT);
                return ["Index", left, ["Slice", 1, end]];
            }

            const first = this.parseExpression(0);

            // Slices intermediários ou abertos no fim: L[3...] ou L[2...5]
            if (this.lookahead && this.lookahead.type === TokenTypes.ELLIPSIS) {
                this.eat(TokenTypes.ELLIPSIS);
                if (this.lookahead && this.lookahead.type === TokenTypes.BRACKET_RIGHT) {
                    this.eat(TokenTypes.BRACKET_RIGHT);
                    return ["Index", left, ["Slice", first, null]];
                }
                const end = this.parseExpression(0);
                this.eat(TokenTypes.BRACKET_RIGHT);
                return ["Index", left, ["Slice", first, end]];
            }

            // Múltiplos índices ou dimensão de linha: L[1, 3, 5] ou M[1, 2; ...]
            const rowParts = [first];
            while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                this.eat(TokenTypes.COMMA);
                rowParts.push(this.parseExpression(0));
            }

            // Se for seguido por ponto e vírgula (;), é indexação matricial dimensional M[r; c]
            if (this.lookahead && this.lookahead.type === TokenTypes.SEMICOLON) {
                this.eat(TokenTypes.SEMICOLON);
                let colParts: any = null;
                if (this.lookahead && this.lookahead.type !== TokenTypes.BRACKET_RIGHT) {
                    const firstCol = this.parseExpression(0);
                    colParts = [firstCol];
                    while (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                        this.eat(TokenTypes.COMMA);
                        colParts.push(this.parseExpression(0));
                    }
                }
                this.eat(TokenTypes.BRACKET_RIGHT);
                const finalRows = rowParts.length === 1 ? rowParts[0] : rowParts;
                const finalCols = colParts && colParts.length === 1 ? colParts[0] : colParts;
                return ["MatrixIndex", left, finalRows, finalCols];
            }

            this.eat(TokenTypes.BRACKET_RIGHT);
            if (rowParts.length > 1) {
                return ["Index", left, ...rowParts];
            }
            return ["Index", left, first];
        }


        // Operadores relacionais e de comparação: <, >, <=, >=, ==, !=, =
        if (token.type === TokenTypes.LESS || token.type === TokenTypes.GREATER ||
            token.type === TokenTypes.LESS_EQUAL || token.type === TokenTypes.GREATER_EQUAL ||
            token.type === TokenTypes.EQUAL || token.type === TokenTypes.ASSIGNMENT ||
            token.type === TokenTypes.NOT_EQUAL) {

            let op = 'Equal';
            if (token.type === TokenTypes.LESS) op = 'LessThan';
            else if (token.type === TokenTypes.GREATER) op = 'GreaterThan';
            else if (token.type === TokenTypes.LESS_EQUAL) op = 'LessEqual';
            else if (token.type === TokenTypes.GREATER_EQUAL) op = 'GreaterEqual';
            else if (token.type === TokenTypes.NOT_EQUAL) op = 'NotEqual';
            else if (token.type === TokenTypes.EQUAL || token.type === TokenTypes.ASSIGNMENT) op = 'Equal';

            const right = this.parseExpression(8);

            // Comparações encadeadas: ex: -inf < L < inf ou 0 <= x <= 5
            const relOps = new Set(['LessThan', 'GreaterThan', 'LessEqual', 'GreaterEqual', 'Equal', 'NotEqual']);
            if (Array.isArray(left) && relOps.has(left[0])) {
                const middle = left[2];
                return ["And", left, [op, middle, right]];
            }

            return [op, left, right];
        }

        // Operadores lógicos: AND e OR
        if (token.type === TokenTypes.AND) return ["And", left, this.parseExpression(4)];
        if (token.type === TokenTypes.OR) return ["Or", left, this.parseExpression(3)];

        // Produto vetorial (\times): P1 \times P2
        if (token.type === TokenTypes.CROSS) return ["Cross", left, this.parseExpression(20)];

        // Compreensão de lista ou matriz: expr for var = list, var2 = list2 (ou com ';' para matriz)
        if (token.type === TokenTypes.FOR) {
            const bindings: Array<[string, any]> = [];
            let isMatrixComp = false;
            while (true) {
                let varToken = this.lookahead;
                if (!varToken || (varToken.type !== TokenTypes.IDENTIFIER && varToken.type !== TokenTypes.VAR)) {
                    throw new SyntaxError(`Esperado identificador de variável após "for".`);
                }
                const varName = varToken.value.replace(/[\{\}\\]/g, '');
                this.eat(varToken.type);

                this.eat(TokenTypes.ASSIGNMENT);
                let listExpr = this.parseExpression(2);
                if (this.lookahead && this.lookahead.type === TokenTypes.ELLIPSIS) {
                    this.eat(TokenTypes.ELLIPSIS);
                    const end = this.parseExpression(2);
                    listExpr = ["Range", listExpr, end];
                }
                bindings.push([varName, listExpr]);

                if (this.lookahead && this.lookahead.type === TokenTypes.SEMICOLON) {
                    this.eat(TokenTypes.SEMICOLON);
                    isMatrixComp = true;
                } else if (this.lookahead && this.lookahead.type === TokenTypes.COMMA) {
                    this.eat(TokenTypes.COMMA);
                } else {
                    break;
                }
            }
            if (isMatrixComp) {
                return ["MatrixComprehension", left, bindings];
            }
            return ["Comprehension", left, bindings];
        }

        throw new SyntaxError(`Infixo desconhecido para: ${token.value}`);
    }

    getPrecedence(type: string): number {
        if (type === TokenTypes.DOT) return 50;
        if (type === TokenTypes.BRACKET_LEFT) return 40;
        if (type === TokenTypes.EXPONENTIATION) return 30;
        if (type === TokenTypes.MULTIPLICATION || type === TokenTypes.DIVISION || type === TokenTypes.CROSS) return 20;
        if (type === TokenTypes.ADDITION || type === TokenTypes.SUBTRACTION) return 10;
        if (type === TokenTypes.LESS || type === TokenTypes.GREATER ||
            type === TokenTypes.LESS_EQUAL || type === TokenTypes.GREATER_EQUAL ||
            type === TokenTypes.EQUAL || type === TokenTypes.ASSIGNMENT ||
            type === TokenTypes.NOT_EQUAL) return 8;
        if (type === TokenTypes.AND) return 4;
        if (type === TokenTypes.OR) return 3;
        if (type === TokenTypes.FOR) return 2;
        return 0;
    }
}