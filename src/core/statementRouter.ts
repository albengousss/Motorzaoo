import { Tokenizer } from './tokenizer';
import { PrattParser } from './prattParser';
import {
    classifyStatementAST,
    collectASTIdentifiers,
    splitTopLevelComparison
} from './policy';

export type ParsedStatement =
    | {
        kind: 'var_assign';
        name: string;
        lhsAst: any;
        rhsAst: any;
        operatorNames: Set<string>;
        lhsRaw: string;
        rhsRaw: string;
    }
    | {
        kind: 'func_def';
        name: string;
        params: string[];
        lhsAst: any;
        rhsAst: any;
        operatorNames: Set<string>;
        lhsRaw: string;
        rhsRaw: string;
    }
    | {
        kind: 'func_base_case';
        name: string;
        argAsts: any[];
        lhsAst: any;
        rhsAst: any;
        operatorNames: Set<string>;
        lhsRaw: string;
        rhsRaw: string;
    }
    | {
        kind: 'plot_equation';
        operator: string;
        lhsAst: any;
        rhsAst: any;
        ast: any;
        operatorNames: Set<string>;
        lhsRaw: string;
        rhsRaw: string;
    }
    | {
        kind: 'expression';
        ast: any;
        operatorNames: Set<string>;
    };

/**
 * Extrai nomes de operadores declarados explicitamente via \operatorname{...}.
 */
export function extractOperatorNames(expr: string): Set<string> {
    const names = new Set<string>();
    try {
        const tokens = new Tokenizer().tokenize(expr);
        for (const tok of tokens) {
            if (tok.isOperatorName && tok.value) {
                names.add(tok.value.replace(/[\{\}\\]/g, '').trim());
            }
        }
    } catch (_) {
        const re = /\\operatorname\*?\{([a-zA-Z\u0370-\u03FF_][a-zA-Z0-9_\u0370-\u03FF]*)\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(expr)) !== null) {
            names.add(m[1].trim());
        }
    }
    return names;
}

/**
 * Analisa uma instrução normalizada usando AST do PrattParser e classificações do PolicyManager,
 * eliminando regexes frágeis de atribuição, definição de função e equação implícita.
 */
export function parseAndClassifyStatement(
    cleanStr: string,
    options: {
        is3D?: boolean;
        existingVarAsts?: Record<string, any>;
        existingFuncAsts?: Record<string, { params: string[]; ast: any; blockId?: string }>;
        currentBlockId?: string;
    } = {}
): ParsedStatement {
    const trimmed = cleanStr.trim();
    const operatorNames = extractOperatorNames(trimmed);
    const comp = splitTopLevelComparison(trimmed);

    if (!comp) {
        const ast = new PrattParser(trimmed).parseExpression();
        return { kind: 'expression', ast, operatorNames };
    }

    const lhsRaw = comp.lhs.trim();
    const rhsRaw = comp.rhs.trim();
    if (!lhsRaw || !rhsRaw) {
        // Deixa o PrattParser falhar naturalmente com SyntaxError de expressão incompleta
        new PrattParser(trimmed).parseExpression();
        throw new SyntaxError('Expressão relacional incompleta');
    }

    const lhsAst = new PrattParser(lhsRaw).parseExpression();
    const rhsAst = new PrattParser(rhsRaw).parseExpression();

    if (comp.op === '=') {
        const classified = classifyStatementAST(lhsAst, rhsAst, {
            is3D: options.is3D,
            existingVarAsts: options.existingVarAsts,
            existingFuncAsts: options.existingFuncAsts,
            operatorNames,
            currentBlockId: options.currentBlockId
        });

        if (classified.kind === 'var_assign') {
            return {
                kind: 'var_assign',
                name: classified.name,
                lhsAst,
                rhsAst,
                operatorNames,
                lhsRaw,
                rhsRaw
            };
        }

        if (classified.kind === 'func_def') {
            return {
                kind: 'func_def',
                name: classified.name,
                params: classified.params,
                lhsAst,
                rhsAst,
                operatorNames,
                lhsRaw,
                rhsRaw
            };
        }

        if (classified.kind === 'func_base_case') {
            return {
                kind: 'func_base_case',
                name: classified.name,
                argAsts: classified.argAsts,
                lhsAst,
                rhsAst,
                operatorNames,
                lhsRaw,
                rhsRaw
            };
        }

        return {
            kind: 'plot_equation',
            operator: '=',
            lhsAst,
            rhsAst,
            ast: ['Subtract', lhsAst, rhsAst],
            operatorNames,
            lhsRaw,
            rhsRaw
        };
    }

    const chainRelOps = new Set(['LessThan', 'GreaterThan', 'LessEqual', 'GreaterEqual', 'Equal', 'NotEqual', 'And']);
    if (comp.op !== '=' && Array.isArray(rhsAst) && chainRelOps.has(rhsAst[0])) {
        const fullAst = new PrattParser(trimmed).parseExpression();
        return { kind: 'expression', ast: fullAst, operatorNames };
    }

    return {
        kind: 'plot_equation',
        operator: comp.op,
        lhsAst,
        rhsAst,
        ast: ['Subtract', lhsAst, rhsAst],
        operatorNames,
        lhsRaw,
        rhsRaw
    };
}

/**
 * Helper puro para verificar se um identificador AST corresponde apenas à coordenada 'y'
 * (para conversão implícita `sin(y)` -> `x - sin(y)`), ignorando nomes como `identity` ou `y_1`.
 */
export function isImplicitYOnlyExpression(ast: any, is3D: boolean = false): boolean {
    if (!ast || (Array.isArray(ast) && (ast[0] === 'Point' || ast[0] === 'List' || ast[0] === 'Polygon'))) {
        return false;
    }
    const ids = collectASTIdentifiers(ast, { includeCalledFunctions: false });
    return ids.has('y') && !ids.has('x') && !(is3D && ids.has('z'));
}
