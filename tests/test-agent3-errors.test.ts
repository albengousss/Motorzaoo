import { describe, it, expect } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { Tokenizer, TokenTypes } from '../src/core/tokenizer.js';
import { PrattParser } from '../src/core/prattParser.js';
import { MathEngine } from '../src/core/mathEngine.js';

describe('agent3-errors suite', () => {
    it('runs all 139 pipeline cases and 14 free variable checks', () => {

// =========================================================================
// AGENT 3: EXHAUSTIVE TEST HARNESS
// =========================================================================

interface TestCase {
    id: string;
    category: string;
    subCategory: string;
    latex: string;
    ascii: string;
    expectedOutcome: 'ERROR_OR_INCOMPLETE' | 'VALID_SUCCESS';
    expectedWarningPattern?: RegExp;
    notes?: string;
}

interface TestReportItem {
    id: string;
    category: string;
    subCategory: string;
    latex: string;
    ascii: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL_FALSE_POSITIVE' | 'FAIL_FALSE_NEGATIVE' | 'FAIL_PARSER_EXCEPTION';
    detail: string;
}

// Conjunto de comandos CAS reconhecidos exatamente como em main.ts
const casCommandsList = new Set([
    'factor', 'ifactor', 'cfactor', 'cifactor', 'expand', 'simplify',
    'polynomial', 'coefficients', 'degree', 'completesquare',
    'numerator', 'denominator', 'commondenominator', 'partialfractions',
    'substitute', 'leftside', 'rightside',
    'groebnerlex', 'groebnerlexdeg', 'groebnerdegrevlex', 'eliminate',
    'solve', 'csolve', 'solvecubic', 'solvequartic', 'plotsolve', 'root',
    'nsolve', 'nsolutions', 'min', 'max',
    'limit', 'limitabove', 'limitbelow', 'lim',
    'derivative', 'implicitderivative', 'nderivative', 'diff',
    'integral', 'integralsymbolic', 'integralbetween', 'nintegral', 'int', 'defint',
    'solveode', 'nsolveode', 'edo', 'resolvere', 'resolveredo',
    'taylor', 'taylorpolynomial', 'laplace', 'inverselaplace',
    'dimension', 'dot', 'cross', 'unitvector', 'unitperpendicularvector', 'perpendicularvector',
    'transpose', 'tran', 'matrixrank', 'rank', 'reducedrowechelonform', 'rref', 'invert', 'inv', 'characteristicpolynomial', 'minimalpolynomial',
    'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'jordandiagonalization', 'qrdecomposition', 'svd', 'ludecomposition',
    'isprime', 'nextprime', 'previousprime', 'primefactors', 'factors',
    'divisors', 'divisorslist', 'divisorssum',
    'gcd', 'lcm', 'extendedgcd',
    'div', 'mod', 'division', 'modularexponent', 'mixednumber', 'rationalize',
    'binomialdist', 'pascal', 'hypergeometric', 'poisson', 'zipf', 'normal', 'cauchy', 'exponential', 'weibull', 'gamma', 'chisquared', 'tdistribution',
    'determinant', 'det', 'trace', 'tr', 'applymatrix',
    'samplesd', 'covariance', 'variance', 'samplevariance', 'stdev', 'stddev', 'var',
    'mean', 'median', 'unique', 'frequency',
    'fitpoly', 'fitpow', 'fitexp', 'fitsin', 'fitlog', 'normalize',
    'setseed', 'randomuniform', 'randombetween', 'shuffle', 'randomelement', 'sample', 'randompolynomial',
    'sequence', 'iterationlist', 'element', 'first', 'last', 'take', 'append', 'flatten', 'length', 'size',
    'sum', 'product', 'prod', 'rootlist',
    'tocomplex', 'topoint', 'topolar', 'toexponential', 'nthroot',
    'intersect', 'radius', 'distance', 'angle', 'perpendicularbisector', 'applymatrix', 'reflect', 'rotate', 'shear', 'stretch', 'translate', 'infinitecone', 'surdtext', 'setviewdirection', 'setvisibleinview', 'attachcopytoview', 'setdecoration'
]);

// SIMULADOR 100% FIEL DO FLUXO COMPLETO DE main.ts
function runMainPipelineSimulation(
    latex: string,
    asciiInput: string,
    definedMatrices: Set<string> = new Set(['A', 'B', 'M']),
    definedUserFuncs: Record<string, any> = { f: { params: ['x'] } }
): {
    hasError: boolean;
    errorMsg: string | null;
    route: string;
    exception?: string;
} {
    let ascii = asciiInput.trim() || (latex || '').trim();
    if (!ascii) {
        return { hasError: false, errorMsg: null, route: 'EMPTY' };
    }

    // 1. checkIncompleteStatus (main.ts line 445)
    const incCheck = FaultTolerantParser.checkIncompleteStatus(latex || '', ascii);
    if (incCheck.isIncomplete) {
        return { hasError: true, errorMsg: incCheck.warning, route: 'INCOMPLETE_EARLY_RETURN' };
    }

    // 2. Sanitização (main.ts lines 456-616)
    let cleanStr = ascii
        .replace(/\\left/g, '')
        .replace(/\\right/g, '')
        .replace(/\\cdot/g, '*')
        .replace(/\\times/g, '*')
        .replace(/\\ast/g, '*')
        .replace(/∗/g, '*')
        .replace(/⋅/g, '*')
        .replace(/×/g, '*')
        .replace(/"/g, '');

    const spacedFuncs = [
        's i n', 'c o s', 't a n', 's i n h', 'c o s h', 't a n h', 's e c', 'c s c', 'c o s s e c', 'c o t', 'c o t a n',
        'a r c s i n', 'a r c c o s', 'a r c t a n', 'l o g', 'l n', 'e x p',
        'r r e f', 'd e t', 't r a c e', 't r', 'r a n k', 't r a n', 't r a n s p o s e',
        'i n v', 'i n v e r t', 'd e t e r m i n a n t', 'm a t r i x r a n k',
        'r e d u c e d r o w e c h e l o n f o r m'
    ];
    spacedFuncs.forEach(func => {
        const regex = new RegExp(func.split('').join('\\s*'), 'gi');
        cleanStr = cleanStr.replace(regex, func.replace(/\s+/g, ''));
    });

    cleanStr = cleanStr
        .replace(/\\operatorname\{([^}]+)\}/gi, '$1')
        .replace(/\\mathrm\{([^}]+)\}/gi, '$1')
        .replace(/\\text\{([^}]+)\}/gi, '$1');

    cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_[\{\(]([a-zA-Z0-9_]+)[\}\)]\s*(?=\()/g, '$1_$2');
    cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_([a-zA-Z0-9_]+)\s*(?=\()/g, '$1_$2');

    cleanStr = cleanStr
        .replace(/\^\s*\{\s*(?:\\prime|['´`’′]|\\doubleprime|″)+\s*\}/g, m => m.includes('double') || m.includes('″') || (m.match(/['´`’′]/g) || []).length > 1 ? "''" : "'")
        .replace(/\^\s*\(\s*(?:\\prime|['´`’′]|\\doubleprime|″)+\s*\)/g, m => m.includes('double') || m.includes('″') || (m.match(/['´`’′]/g) || []).length > 1 ? "''" : "'")
        .replace(/\^\s*(?:\\doubleprime|″)/g, "''")
        .replace(/\^\s*(?:\\prime|['´`’′])/g, "'")
        .replace(/\\doubleprime/g, "''")
        .replace(/\\prime/g, "'")
        .replace(/″/g, "''")
        .replace(/[´`’′]/g, "'")
        .replace(/\^'+/g, m => m.replace(/\^/g, ''));

    cleanStr = cleanStr
        .replace(/\(([^)]+)\)\^\{?(?:T|\\top|intercal)\}?/gi, 'tran($1)')
        .replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?(?:T|\\top|intercal)\}?/gi, 'tran($1)')
        .replace(/\(([^)]+)\)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)')
        .replace(/([A-Za-z_][A-Za-z0-9_]*)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)')
        .replace(/\btr\s*\(([^)]+)\)/gi, 'trace($1)');

    for (const mName of definedMatrices) {
        cleanStr = cleanStr.replace(new RegExp(`\\b${mName}'+`, 'g'), `tran(${mName})`);
    }
    cleanStr = cleanStr.replace(/\(([^)]+)\)'+/g, 'tran($1)');

    cleanStr = cleanStr.replace(/([\^_](?:\{[^}]+\}|\([^)]+\)|[0-9.]+))\s*([a-zA-Z_])/g, '$1 $2');
    cleanStr = cleanStr.replace(/(?<![\^_])(\d+(?:\.\d+)?)\s*([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

    cleanStr = cleanStr
        .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, 'nthroot($2, $1)')
        .replace(/root\s*\(([^)]+)\)\s*\(([^)]+)\)/g, 'nthroot($2, $1)');

    cleanStr = cleanStr.replace(/\\?log_\{?([a-zA-Z0-9.]+)\}?\s*\(([^)]+)\)/gi, '((log($2))/(log($1)))');

    cleanStr = FaultTolerantParser.normalizeDerivative(cleanStr);

    cleanStr = cleanStr
        .replace(/frac\s*\(([^)]+)\)\s*\(([^)]+)\)/g, '(($1)/($2))')
        .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '(($1)/($2))');

    cleanStr = cleanStr
        .replace(/\\mathrm\{d\}/gi, ' d ')
        .replace(/\\text\{d\}/gi, ' d ')
        .replace(/\\differentialD/gi, ' d ')
        .replace(/\\,/g, ' ')
        .replace(/\\!/g, ' ');

    cleanStr = cleanStr.replace(/(?:(?<=\W)|\b|(?<=[a-zA-Z0-9_\)\}\]]))d\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i, ' d $1');

    // Integrais definidas
    const boundPattern = '(?:\\{([^}]+)\\}|\\(([^)]+)\\)|(-?[0-9.]+|\\\\[a-zA-Z]+|[a-zA-Z_][a-zA-Z0-9_]*))';
    const innermostDefIntRegex = new RegExp(
        `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*(?:_\\s*${boundPattern}\\s*\\^\\s*${boundPattern}|\\^\\s*${boundPattern}\\s*_\\s*${boundPattern})\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
        'i'
    );
    let intPasses = 0;
    let prevIntStr = '';
    while (prevIntStr !== cleanStr && intPasses < 10) {
        prevIntStr = cleanStr;
        cleanStr = cleanStr.replace(innermostDefIntRegex, (_m, l1, l2, l3, u1, u2, u3, u4, u5, u6, l4, l5, l6, expr, v) => {
            let lower = (l1 ?? l2 ?? l3 ?? l4 ?? l5 ?? l6).trim().replace(/\\/g, '');
            let upper = (u1 ?? u2 ?? u3 ?? u4 ?? u5 ?? u6).trim().replace(/\\/g, '');
            const integrand = expr.trim() || '1';
            return `integrate(${integrand}, ${v}, ${lower}, ${upper})`;
        });
        intPasses++;
    }

    // Integrais indefinidas
    const innermostIndefIntRegex = new RegExp(
        `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
        'i'
    );
    let indefPasses = 0;
    let prevIndefStr = '';
    while (prevIndefStr !== cleanStr && indefPasses < 10) {
        prevIndefStr = cleanStr;
        cleanStr = cleanStr.replace(innermostIndefIntRegex, (_m, expr, v) => {
            const integrand = expr.trim() || '1';
            return `integrate(${integrand}, ${v})`;
        });
        indefPasses++;
    }

    const noSpaceStr = cleanStr.replace(/\s+/g, '').replace(/²/g, '^2').replace(/³/g, '^3');

    // 3. Parsing inicial (main.ts line 638)
    let ast: any = null;
    let assignVarName: string | null = null;
    try {
        ast = new PrattParser(cleanStr).parseExpression();
    } catch (e) {}

    const funcDeclEarly = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)\s*=/);
    if (!ast && !funcDeclEarly) {
        const assignMatch = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
        if (assignMatch) {
            try {
                const rhsAst = new PrattParser(assignMatch[2].trim()).parseExpression();
                if (rhsAst && MathEngine.isGiacCommand(rhsAst)) {
                    ast = rhsAst;
                    assignVarName = assignMatch[1];
                }
            } catch (e) {}
        }
    }

    // 4. Se for GiacCommand
    if (ast && MathEngine.isGiacCommand(ast)) {
        const matrixOnlyCmdsEarly = new Set(['det', 'determinant', 'rref', 'reducedrowechelonform', 'trace', 'tr', 'matrixrank', 'rank', 'invert', 'inv', 'transpose', 'tran', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'ludecomposition', 'jordandiagonalization']);
        if (matrixOnlyCmdsEarly.has(ast[0].toLowerCase()) && typeof ast[1] === 'string' && !definedMatrices.has(ast[1].replace(/[\{\}\\]/g, ''))) {
            return { hasError: true, errorMsg: `Erro: Matriz "${ast[1]}" não definida`, route: 'MATRIX_UNDEFINED_ERROR' };
        }
        return { hasError: false, errorMsg: null, route: 'GIAC_COMMAND_AST' };
    }

    // 5. EDO e Comandos CAS Genéricos (main.ts line 818)
    const campoMatch = noSpaceStr.match(/^(?:campovetorial|slopefield|campo)\((.+)\)$/i);
    const solveMatch = noSpaceStr.match(/^(?:solveode|resolvere|resolveredo|edo)\((.+)\)$/i);
    const genericCasMatch = noSpaceStr.match(/^(?:([a-zA-Z_][a-zA-Z0-9_\{\}]*(?:\([a-zA-Z_]\))?)=)?([A-Za-z]+)\((.*)\)$/);

    if (campoMatch) {
        return { hasError: false, errorMsg: null, route: 'CAMPO_VETORIAL' };
    } else if (solveMatch) {
        return { hasError: false, errorMsg: null, route: 'SOLVE_ODE' };
    } else if (genericCasMatch && casCommandsList.has(genericCasMatch[2].toLowerCase())) {
        const cmdName = genericCasMatch[2].toLowerCase();
        const cmdArgs = genericCasMatch[3];
        const matrixOnlyCmds = new Set(['det', 'determinant', 'rref', 'reducedrowechelonform', 'trace', 'tr', 'matrixrank', 'rank', 'invert', 'inv', 'transpose', 'tran', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'ludecomposition', 'jordandiagonalization']);
        if (matrixOnlyCmds.has(cmdName)) {
            const rawArg = cmdArgs.trim().replace(/[\{\}\\]/g, '');
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawArg) && !definedMatrices.has(rawArg)) {
                return { hasError: true, errorMsg: `Erro: Matriz "${rawArg}" não definida`, route: 'MATRIX_UNDEFINED_ERROR' };
            }
        }
        return { hasError: false, errorMsg: null, route: 'GENERIC_CAS_MATCH' };
    }

    // 6. Funções customizadas f(x) = ... ou f(x, y) = ...
    const funcMatch = cleanStr.match(/^\\?([a-zA-Z_][a-zA-Z0-9_\{\}]*)\s*\(([^)]+)\)\s*=\s*(.+)$/);
    if (funcMatch) {
        const funcName = funcMatch[1].replace(/[\{\}\\]/g, '');
        const paramNames = funcMatch[2].split(',').map(s => s.trim().replace(/[\{\}\\]/g, ''));
        const expr = funcMatch[3].trim();
        try {
            const astFn = new PrattParser(expr).parseExpression();
            return { hasError: false, errorMsg: null, route: 'USER_FUNCTION_DEF' };
        } catch (e: any) {
            return { hasError: true, errorMsg: 'Expressão incompleta', route: 'USER_FUNCTION_PARSE_FAIL', exception: e.message };
        }
    }

    // 7. Matrizes literais A = [[1, 2], [3, 4]] ou [[1, 2], [3, 4]]
    if (cleanStr.includes('[[') || cleanStr.includes('{{') || /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\[\[/.test(cleanStr)) {
        return { hasError: false, errorMsg: null, route: 'MATRIX_DEFINITION' };
    }

    // 8. Gráficos, Equações e Avaliação de Bloco (main.ts lines 1560-1835)
    try {
        let expressaoPlot = cleanStr;
        const zExplicitMatch = cleanStr.match(/^\s*z\s*=\s*(.+)$/);
        const yExplicitMatch = cleanStr.match(/^\s*y\s*=\s*(.+)$/);
        if (zExplicitMatch) {
            expressaoPlot = zExplicitMatch[1].trim();
        } else if (yExplicitMatch) {
            expressaoPlot = yExplicitMatch[1].trim();
        } else {
            const implicitMatch = noSpaceStr.match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
            if (implicitMatch) {
                const parts = cleanStr.split(implicitMatch[2]);
                expressaoPlot = `(${parts[0]})-(${parts[1]})`;
            }
        }

        // Tenta parsear expressaoPlot com PrattParser
        const finalAst = new PrattParser(expressaoPlot).parseExpression();
        return { hasError: false, errorMsg: null, route: 'PLOT_OR_CALC_SUCCESS' };
    } catch (e: any) {
        // CATCH BLOCK EXATO DE main.ts (line 1809)
        const inc = FaultTolerantParser.checkIncompleteStatus(latex || '', ascii);
        if (ascii.trim().length === 0) {
            return { hasError: false, errorMsg: null, route: 'CATCH_EMPTY' };
        } else if (e?.message?.includes('integrando deve terminar') || inc.warning === 'O integrando deve terminar com uma variável de integração, como dx.') {
            return { hasError: true, errorMsg: 'O integrando deve terminar com uma variável de integração, como dx.', route: 'CATCH_INTEGRAL_NO_DIFF', exception: e.message };
        } else if (inc.isIncomplete) {
            return { hasError: true, errorMsg: inc.warning, route: 'CATCH_INCOMPLETE_WARNING', exception: e.message };
        } else {
            return { hasError: true, errorMsg: 'Expressão incompleta', route: 'CATCH_FALLBACK_GENERIC', exception: e.message };
        }
    }
}

// =========================================================================
// BANCO EXAUSTIVO DE TESTES
// =========================================================================
const testCases: TestCase[] = [
    // ---------------------------------------------------------------------
    // CAT 1: TRUE POSITIVES (Erros Reais e Incompletudes)
    // ---------------------------------------------------------------------
    { id: 'TP01', category: 'TruePositives', subCategory: 'TrailingOp', latex: 'x+', ascii: 'x+', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP02', category: 'TruePositives', subCategory: 'TrailingOp', latex: 'x-', ascii: 'x-', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP03', category: 'TruePositives', subCategory: 'TrailingOp', latex: '2*', ascii: '2*', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP04', category: 'TruePositives', subCategory: 'TrailingOp', latex: 'x/', ascii: 'x/', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP05', category: 'TruePositives', subCategory: 'TrailingOp', latex: 'x^', ascii: 'x^', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP06', category: 'TruePositives', subCategory: 'TrailingOp', latex: 'x=', ascii: 'x=', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP07', category: 'TruePositives', subCategory: 'TrailingOp', latex: '3 + 4 *', ascii: '3 + 4 *', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP08', category: 'TruePositives', subCategory: 'TrailingOp', latex: '(x + )', ascii: '(x + )', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP09', category: 'TruePositives', subCategory: 'TrailingOp', latex: '(2 *)', ascii: '(2 *)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP10', category: 'TruePositives', subCategory: 'TrailingOp', latex: '(x^)', ascii: '(x^)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    
    // Derivadas Incompletas
    { id: 'TP11', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: '\\frac{d}{dx}()', ascii: 'frac(d)(dx)()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP12', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: 'd/dx()', ascii: 'd/dx()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP13', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: '\\frac{d}{dx}{}', ascii: 'frac(d)(dx){}', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP14', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: '\\frac{d}{dx}', ascii: 'd/dx', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP15', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: 'd/dx', ascii: 'd/dx', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP16', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: 'd/dx(x^)', ascii: 'd/dx(x^)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP17', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: '\\frac{d}{dx}(#?)', ascii: 'd/dx(#?)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP18', category: 'TruePositives', subCategory: 'DerivativeIncomplete', latex: 'diff()', ascii: 'diff()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },

    // Integrais Incompletas
    { id: 'TP19', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int x', ascii: 'int x', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP20', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int', ascii: 'int', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP21', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int x^2', ascii: 'int x^2', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP22', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int (x+1)', ascii: 'int (x+1)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP23', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int x d', ascii: 'int x d', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP24', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int_{}^{} x dx', ascii: 'int_{}^{} x dx', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP25', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int_{0}^{} x dx', ascii: 'int_{0}^{} x dx', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP26', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int_{}^{1} x dx', ascii: 'int_{}^{1} x dx', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP27', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: 'defint x', ascii: 'defint x', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP28', category: 'TruePositives', subCategory: 'IntegralIncomplete', latex: '\\int_0^1 x', ascii: 'int_0^1 x', expectedOutcome: 'ERROR_OR_INCOMPLETE' },

    // Funções e Operadores Vazios
    { id: 'TP29', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: '\\sqrt{}', ascii: 'sqrt()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP30', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: 'sqrt()', ascii: 'sqrt()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP31', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: '\\frac{}{}', ascii: 'frac()()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP32', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: '\\frac{x}{}', ascii: 'frac(x)()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP33', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: '\\frac{}{x}', ascii: 'frac()(x)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP34', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: 'sin()', ascii: 'sin()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP35', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: 'cos()', ascii: 'cos()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP36', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: 'det()', ascii: 'det()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP37', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: 'mean()', ascii: 'mean()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP38', category: 'TruePositives', subCategory: 'EmptyFunctions', latex: 'solveode()', ascii: 'solveode()', expectedOutcome: 'ERROR_OR_INCOMPLETE' },

    // Delimitadores desbalanceados
    { id: 'TP39', category: 'TruePositives', subCategory: 'UnbalancedParens', latex: '(x + 1', ascii: '(x + 1', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP40', category: 'TruePositives', subCategory: 'UnbalancedParens', latex: '((x + 1)', ascii: '((x + 1)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP41', category: 'TruePositives', subCategory: 'UnbalancedParens', latex: '2 * (3 + (4 * x)', ascii: '2 * (3 + (4 * x)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },

    // Matriz indefinida (strict case check)
    { id: 'TP42', category: 'TruePositives', subCategory: 'UndefinedMatrix', latex: 'det(Z)', ascii: 'det(Z)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },
    { id: 'TP43', category: 'TruePositives', subCategory: 'UndefinedMatrix', latex: 'rref(K)', ascii: 'rref(K)', expectedOutcome: 'ERROR_OR_INCOMPLETE' },

    // ---------------------------------------------------------------------
    // CAT 2: FALSE POSITIVES CANDIDATES (Expressões Válidas que DEVEM PASSAR)
    // ---------------------------------------------------------------------
    // 2.1 Funções Compostas
    { id: 'FP01', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\sin(\\cos(x))', ascii: 'sin(cos(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP02', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\cos(\\tan(x))', ascii: 'cos(tan(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP03', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\ln(\\exp(x))', ascii: 'ln(exp(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP04', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\log(\\ln(x))', ascii: 'log(ln(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP05', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\exp(\\sqrt{x})', ascii: 'exp(sqrt(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP06', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\sqrt{\\sin(x) + 1}', ascii: 'sqrt(sin(x) + 1)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP07', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: 'f(g(x))', ascii: 'f(g(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP08', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: 'f(g(h(x)))', ascii: 'f(g(h(x)))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP09', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\sin(\\sin(\\sin(x)))', ascii: 'sin(sin(sin(x)))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP10', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\sinh(\\cosh(x))', ascii: 'sinh(cosh(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP11', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '\\tan(\\arctan(x))', ascii: 'tan(arctan(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP12', category: 'FalsePositivesCheck', subCategory: 'CompositeFunctions', latex: '|\\sin(x)|', ascii: '|sin(x)|', expectedOutcome: 'VALID_SUCCESS' },

    // 2.2 Multivariáveis
    { id: 'FP13', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'x^2 + y^2 = 1', ascii: 'x^2 + y^2 = 1', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP14', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'x^2 + y^2 + z^2 = 9', ascii: 'x^2 + y^2 + z^2 = 9', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP15', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'z = x^2 + y^2', ascii: 'z = x^2 + y^2', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP16', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'z = \\sin(x) * \\cos(y)', ascii: 'z = sin(x) * cos(y)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP17', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'f(x, y) = x^2 + y^2', ascii: 'f(x, y) = x^2 + y^2', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP18', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'f(x, y, z) = x*y + z', ascii: 'f(x, y, z) = x*y + z', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP19', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'x*y = 1', ascii: 'x*y = 1', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP20', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'y = 2*x + 1', ascii: 'y = 2*x + 1', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP21', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'x^2 - y^2 = 4', ascii: 'x^2 - y^2 = 4', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP22', category: 'FalsePositivesCheck', subCategory: 'Multivariable', latex: 'x/y + y/x = 2', ascii: 'x/y + y/x = 2', expectedOutcome: 'VALID_SUCCESS' },

    // 2.3 Matrizes
    { id: 'FP23', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '[[1, 2], [3, 4]]', ascii: '[[1, 2], [3, 4]]', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP24', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '{{1, 2}, {3, 4}}', ascii: '{{1, 2}, {3, 4}}', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP25', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: 'A = [[1, 2], [3, 4]]', ascii: 'A = [[1, 2], [3, 4]]', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP26', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '\\det(A)', ascii: 'det(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP27', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '\\mathrm{rref}(A)', ascii: 'rref(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP28', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '\\mathrm{trace}(A)', ascii: 'trace(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP29', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '\\mathrm{rank}(A)', ascii: 'rank(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP30', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: 'A^T', ascii: 'A^T', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP31', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: 'A^{-1}', ascii: 'A^(-1)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP32', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: '2*A', ascii: '2*A', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP33', category: 'FalsePositivesCheck', subCategory: 'Matrices', latex: 'A + B', ascii: 'A + B', expectedOutcome: 'VALID_SUCCESS' },

    // 2.4 Parênteses Aninhados Profundos
    { id: 'FP34', category: 'FalsePositivesCheck', subCategory: 'NestedParens', latex: '((((x + 1))))', ascii: '((((x + 1))))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP35', category: 'FalsePositivesCheck', subCategory: 'NestedParens', latex: '(1 + (2 * (3 + (4 * x))))', ascii: '(1 + (2 * (3 + (4 * x))))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP36', category: 'FalsePositivesCheck', subCategory: 'NestedParens', latex: '((x + 1) * (x - 1))', ascii: '((x + 1) * (x - 1))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP37', category: 'FalsePositivesCheck', subCategory: 'NestedParens', latex: '(((x^2 + 1) / (x^2 - 1)))', ascii: '(((x^2 + 1) / (x^2 - 1)))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP38', category: 'FalsePositivesCheck', subCategory: 'NestedParens', latex: '((((((x))))))', ascii: '((((((x))))))', expectedOutcome: 'VALID_SUCCESS' },

    // 2.5 Operadores Unários (-x, +x, -(x+1), etc.)
    { id: 'FP39', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '-x', ascii: '-x', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP40', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '-5', ascii: '-5', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP41', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '-(x + 1)', ascii: '-(x + 1)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP42', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '-\\sin(x)', ascii: '-sin(x)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP43', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '(-x)^2', ascii: '(-x)^2', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP44', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '-x^2', ascii: '-x^2', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP45', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '+x', ascii: '+x', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP46', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '+5', ascii: '+5', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP47', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '+(x + 1)', ascii: '+(x + 1)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP48', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '+\\sin(x)', ascii: '+sin(x)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP49', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: 'x - (-y)', ascii: 'x - (-y)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP50', category: 'FalsePositivesCheck', subCategory: 'UnaryOperators', latex: '2 * (+x)', ascii: '2 * (+x)', expectedOutcome: 'VALID_SUCCESS' },

    // 2.6 Potências com Frações e Expoentes Complexos
    { id: 'FP51', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: 'x^{\\frac{1}{2}}', ascii: 'x^(1/2)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP52', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: 'x^{\\frac{2}{3}}', ascii: 'x^(2/3)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP53', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: 'x^{-\\frac{1}{2}}', ascii: 'x^(-1/2)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP54', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: '(x + 1)^{\\frac{1}{3}}', ascii: '(x + 1)^(1/3)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP55', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: '2^{3/2}', ascii: '2^(3/2)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP56', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: 'x^{2^3}', ascii: 'x^(2^3)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP57', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: 'e^{-x^2}', ascii: 'e^(-x^2)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP58', category: 'FalsePositivesCheck', subCategory: 'FractionalPowers', latex: '2^{x + 1}', ascii: '2^(x + 1)', expectedOutcome: 'VALID_SUCCESS' },

    // 2.7 Derivadas Válidas (Leibniz e Funcionais)
    { id: 'FP59', category: 'FalsePositivesCheck', subCategory: 'Derivatives', latex: '\\frac{d}{dx}(x^2)', ascii: 'd/dx(x^2)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP60', category: 'FalsePositivesCheck', subCategory: 'Derivatives', latex: '\\frac{d}{dx}(\\sin(x))', ascii: 'd/dx(sin(x))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP61', category: 'FalsePositivesCheck', subCategory: 'Derivatives', latex: 'd/dx(x^3 + 2*x)', ascii: 'd/dx(x^3 + 2*x)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP62', category: 'FalsePositivesCheck', subCategory: 'Derivatives', latex: '\\frac{d}{dx}(x+1)^2', ascii: 'd/dx((x+1)^2)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP63', category: 'FalsePositivesCheck', subCategory: 'Derivatives', latex: '\\frac{d}{dt}(\\cos(t))', ascii: 'd/dt(cos(t))', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP64', category: 'FalsePositivesCheck', subCategory: 'Derivatives', latex: 'diff(x^4, x)', ascii: 'diff(x^4, x)', expectedOutcome: 'VALID_SUCCESS' },

    // 2.8 Derivadas de Ordem Superior e Plicas
    { id: 'FP65', category: 'FalsePositivesCheck', subCategory: 'HigherDerivatives', latex: "f'(x)", ascii: "f'(x)", expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP66', category: 'FalsePositivesCheck', subCategory: 'HigherDerivatives', latex: "f''(x)", ascii: "f''(x)", expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP67', category: 'FalsePositivesCheck', subCategory: 'HigherDerivatives', latex: "f'''(x)", ascii: "f'''(x)", expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP68', category: 'FalsePositivesCheck', subCategory: 'HigherDerivatives', latex: "edo(y'' + y = 0)", ascii: "edo(y'' + y = 0)", expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP69', category: 'FalsePositivesCheck', subCategory: 'HigherDerivatives', latex: "campo(y' = 2*x)", ascii: "campo(y' = 2*x)", expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP70', category: 'FalsePositivesCheck', subCategory: 'HigherDerivatives', latex: "solveode(y' = y, (0, 1))", ascii: "solveode(y' = y, (0, 1))", expectedOutcome: 'VALID_SUCCESS' },

    // 2.9 Integrais Válidas
    { id: 'FP71', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: '\\int x dx', ascii: 'int x dx', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP72', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: '\\int dx', ascii: 'int dx', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP73', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: '\\int (x^2 + 1) dx', ascii: 'int (x^2 + 1) dx', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP74', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: '\\int_0^1 x^2 dx', ascii: 'int_0^1 x^2 dx', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP75', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: '\\int_{0}^{2} \\sin(x) dx', ascii: 'int_0^2 sin(x) dx', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP76', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: '\\int_{-1}^{1} (x+1) dt', ascii: 'int_{-1}^1 (x+1) dt', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP77', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: 'integrate(x^2, x)', ascii: 'integrate(x^2, x)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP78', category: 'FalsePositivesCheck', subCategory: 'Integrals', latex: 'integrate(x, x, 0, 1)', ascii: 'integrate(x, x, 0, 1)', expectedOutcome: 'VALID_SUCCESS' },

    // 2.10 Limites Válidos
    { id: 'FP79', category: 'FalsePositivesCheck', subCategory: 'Limits', latex: '\\lim_{x \\to 0} \\frac{\\sin(x)}{x}', ascii: 'lim_{x -> 0} (sin(x)/x)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP80', category: 'FalsePositivesCheck', subCategory: 'Limits', latex: 'lim(sin(x)/x, x, 0)', ascii: 'lim(sin(x)/x, x, 0)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP81', category: 'FalsePositivesCheck', subCategory: 'Limits', latex: 'limit((x^2 - 1)/(x - 1), x, 1)', ascii: 'limit((x^2 - 1)/(x - 1), x, 1)', expectedOutcome: 'VALID_SUCCESS' },

    // 2.11 Variáveis Livres e Sliders
    { id: 'FP82', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'a*x + b', ascii: 'a*x + b', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP83', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'k*x^2 + m*x + c', ascii: 'k*x^2 + m*x + c', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP84', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'a', ascii: 'a', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP85', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'b', ascii: 'b', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP86', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'm_1*x + b_1', ascii: 'm_1*x + b_1', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP87', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'a = 5', ascii: 'a = 5', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP88', category: 'FalsePositivesCheck', subCategory: 'FreeVars', latex: 'b = 2.5', ascii: 'b = 2.5', expectedOutcome: 'VALID_SUCCESS' },

    // 2.12 Comandos Estatísticos
    { id: 'FP89', category: 'FalsePositivesCheck', subCategory: 'Statistics', latex: 'mean(1, 2, 3, 4)', ascii: 'mean(1, 2, 3, 4)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP90', category: 'FalsePositivesCheck', subCategory: 'Statistics', latex: 'median([1, 5, 2, 8])', ascii: 'median([1, 5, 2, 8])', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP91', category: 'FalsePositivesCheck', subCategory: 'Statistics', latex: 'stdev(10, 20, 30)', ascii: 'stdev(10, 20, 30)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP92', category: 'FalsePositivesCheck', subCategory: 'Statistics', latex: 'var(1, 2, 3)', ascii: 'var(1, 2, 3)', expectedOutcome: 'VALID_SUCCESS' },

    // 2.13 Álgebra Linear
    { id: 'FP93', category: 'FalsePositivesCheck', subCategory: 'LinearAlgebra', latex: 'eigenvalues(A)', ascii: 'eigenvalues(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP94', category: 'FalsePositivesCheck', subCategory: 'LinearAlgebra', latex: 'eigenvectors(A)', ascii: 'eigenvectors(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP95', category: 'FalsePositivesCheck', subCategory: 'LinearAlgebra', latex: 'inv(A)', ascii: 'inv(A)', expectedOutcome: 'VALID_SUCCESS' },
    { id: 'FP96', category: 'FalsePositivesCheck', subCategory: 'LinearAlgebra', latex: 'tran(A)', ascii: 'tran(A)', expectedOutcome: 'VALID_SUCCESS' }
];

console.log('='.repeat(80));
console.log(`RUNNING FULL PIPELINE SUITE: ${testCases.length} TOTAL SPECIFIED CASES`);
console.log('='.repeat(80));

const reportItems: TestReportItem[] = [];

testCases.forEach(tc => {
    const res = runMainPipelineSimulation(tc.latex, tc.ascii);
    const isError = res.hasError;
    const isExpectedError = tc.expectedOutcome === 'ERROR_OR_INCOMPLETE';

    let status: TestReportItem['status'] = 'PASS';
    let detail = `Route: ${res.route} | ErrorMsg: ${res.errorMsg || 'None'}`;

    if (isExpectedError && !isError) {
        status = 'FAIL_FALSE_NEGATIVE';
        detail = `Expected error or incomplete warning, but pipeline marked it VALID! Route: ${res.route}`;
    } else if (!isExpectedError && isError) {
        status = 'FAIL_FALSE_POSITIVE';
        detail = `Valid mathematical expression marked as ERROR! Route: ${res.route} | Error: "${res.errorMsg}" | Exception: ${res.exception || 'none'}`;
    }

    reportItems.push({
        id: tc.id,
        category: tc.category,
        subCategory: tc.subCategory,
        latex: tc.latex,
        ascii: tc.ascii,
        expected: tc.expectedOutcome,
        actual: isError ? `ERROR("${res.errorMsg}")` : 'VALID',
        status,
        detail
    });
});

const passCount = reportItems.filter(r => r.status === 'PASS').length;
const failFalsePositive = reportItems.filter(r => r.status === 'FAIL_FALSE_POSITIVE');
const failFalseNegative = reportItems.filter(r => r.status === 'FAIL_FALSE_NEGATIVE');

console.log(`\nRESULTS:`);
console.log(`  PASSED:          ${passCount} / ${reportItems.length} (${((passCount / reportItems.length) * 100).toFixed(1)}%)`);
console.log(`  FALSE POSITIVES: ${failFalsePositive.length}`);
console.log(`  FALSE NEGATIVES: ${failFalseNegative.length}`);

if (failFalsePositive.length > 0) {
    console.log('\n🚨 DETAILED BREAKDOWN OF FALSE POSITIVES (VALID CODE FLAGGED AS ERROR):');
    failFalsePositive.forEach((fp, i) => {
        console.log(`  [FP #${i + 1}] ID=${fp.id} [${fp.subCategory}]`);
        console.log(`       Input: LaTeX="${fp.latex}" | ASCII="${fp.ascii}"`);
        console.log(`       Report: ${fp.detail}`);
    });
}

if (failFalseNegative.length > 0) {
    console.log('\n⚠️ DETAILED BREAKDOWN OF FALSE NEGATIVES (INVALID CODE NOT FLAGGED):');
    failFalseNegative.forEach((fn, i) => {
        console.log(`  [FN #${i + 1}] ID=${fn.id} [${fn.subCategory}]`);
        console.log(`       Input: LaTeX="${fn.latex}" | ASCII="${fn.ascii}"`);
        console.log(`       Report: ${fn.detail}`);
    });
}

// =========================================================================
// INVESTIGAÇÃO ADICIONAL PROFUNDA DE DETECÇÃO DE VARIÁVEIS LIVRES
// =========================================================================
console.log('\n' + '='.repeat(80));
console.log('DEEP INVESTIGATION: FaultTolerantParser.detectFreeVariables');
console.log('='.repeat(80));

const varDetectionCases = [
    { expr: 'a*x + b', bound: [], expected: ['a', 'b'] },
    { expr: 'sqr', bound: [], expected: ['s', 'q', 'r'] },
    { expr: 'rref(A)', bound: [], expected: ['A'] },
    { expr: 'det(M)', bound: [], expected: ['M'] },
    { expr: 'sin(x) + cos(y) + tan(z)', bound: [], expected: [] },
    { expr: 'm_1*x + b_2', bound: [], expected: ['m_1', 'b_2'] },
    { expr: '\\int x^k dx', bound: [], expected: ['k'] },
    { expr: '\\frac{d}{dx}(x^n)', bound: [], expected: ['n'] },
    { expr: 'A^T + B^{-1}', bound: [], expected: ['A', 'B'] },
    { expr: 'matrix', bound: [], expected: [] },
    { expr: 'matriz', bound: [], expected: [] },
    { expr: 'y = a*x + b', bound: [], expected: ['a', 'b'] },
    { expr: 'f(x) = c*x^2 + d', bound: [], expected: ['c', 'd'] },
    { expr: 'f(x, y) = a*x + b*y', bound: [], expected: ['a', 'b'] }
];

let freeVarPassed = 0;
let freeVarFailed = 0;

varDetectionCases.forEach((tc, idx) => {
    const detected = FaultTolerantParser.detectFreeVariables(tc.expr, tc.bound).sort();
    const expected = [...tc.expected].sort();
    const isMatch = JSON.stringify(detected) === JSON.stringify(expected);
    if (isMatch) {
        freeVarPassed++;
    } else {
        freeVarFailed++;
        console.log(`❌ FREE VAR MISMATCH [Case #${idx + 1}]: "${tc.expr}"`);
        console.log(`   Expected: ${JSON.stringify(expected)} | Got: ${JSON.stringify(detected)}`);
    }
});

console.log(`FREE VAR DETECTION: ${freeVarPassed} Passed, ${freeVarFailed} Failed`);
        expect(passCount).toBe(139);
        expect(failFalsePositive.length).toBe(0);
        expect(failFalseNegative.length).toBe(0);
        expect(freeVarPassed).toBe(14);
        expect(freeVarFailed).toBe(0);
    });
});
