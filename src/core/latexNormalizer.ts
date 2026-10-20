/**
 * latexNormalizer.ts - Pipeline centralizado e robusto de normalização LaTeX para o Motor-Calc
 * Converte comandos e marcações LaTeX do MathLive para sintaxe interna padronizada do Desmos / Giac.
 */

import { FaultTolerantParser } from './faultTolerantParser';

export class LatexNormalizer {
    /**
     * Normaliza comandos de derivadas em formatos LaTeX / texto para diff(expr, var)
     */
    static normalizeDerivative(inputStr: string): string {
        return FaultTolerantParser.normalizeDerivative(inputStr);
    }

    /**
     * Normaliza frações LaTeX aninhadas iterativamente
     */
    static normalizeFractions(str: string): string {
        let clean = str;
        let passes = 0;
        let prev = '';
        while (prev !== clean && passes < 10) {
            prev = clean;
            clean = clean
                .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))')
                .replace(/frac\s*\(([^()]+)\)\s*\(([^()]+)\)/g, '(($1)/($2))');
            passes++;
        }
        return clean;
    }

    /**
     * Normaliza potências trigonométricas e funções inversas:
     * \sin^2(x) -> ((sin(x))^2)
     * \sin^2 x -> ((sin(x))^2)
     * \sin^{-1}(x) -> asin(x)
     * \cos^{-1}(x) -> acos(x)
     * \tan^{-1}(x) -> atan(x)
     */
    static normalizeTrigPowers(input: string): string {
        let s = input;
        const invTrigMap: Record<string, string> = {
            sin: 'asin', cos: 'acos', tan: 'atan',
            sec: 'asec', csc: 'acsc', cot: 'acot',
            sinh: 'asinh', cosh: 'acosh', tanh: 'atanh'
        };

        const argChunk = '(?:\\((?:[^()]|\\([^()]*\\))*\\)|[a-zA-Z0-9_.]+(?:\\s*\\*\\s*[a-zA-Z0-9_.]+)*(?:\\s*\\^\\s*(?:\\{[^{}]+\\}|\\([^()]+\\)|[+-]?[a-zA-Z0-9_.]+))?)';

        // 1. Inversas com argumento imediato: \sin^{-1}(x), sin^-1(x), \sin^{-1} x, etc.
        s = s.replace(
            new RegExp(`\\\\?(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\\s*\\^\\s*(?:\\{\\s*-1\\s*\\}|\\(\\s*-1\\s*\\)|-1)\\s*(${argChunk})`, 'gi'),
            (_m, fn, rawArg) => {
                const lower = fn.toLowerCase();
                const target = invTrigMap[lower] || `a${lower}`;
                let arg = rawArg.trim();
                if (arg.startsWith('(') && arg.endsWith(')')) arg = arg.slice(1, -1).trim();
                return `${target}(${arg})`;
            }
        );

        // 1B. Inversas restantes antes de expressões complexas: \sin^{-1}((x+1)/2) -> asin((x+1)/2)
        s = s.replace(/\\?(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\s*\^\s*(?:\{\s*-1\s*\}|\(\s*-1\s*\)|-1)/gi,
            (_m, fn) => {
                const lower = fn.toLowerCase();
                return invTrigMap[lower] || `a${lower}`;
            }
        );

        // 2. Potências: \sin^2(x), \sin^{2}(x), \cos^3(x), sin^2 x, \sin^2 2x, \sin^2(2x + 1)
        s = s.replace(
            new RegExp(`\\\\?(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\\s*\\^\\s*(?:\\{([0-9.]+)\\}|\\(([0-9.]+)\\)|([0-9.]+))\\s*(${argChunk})`, 'gi'),
            (_m, fn, p1, p2, p3, rawArg) => {
                const power = p1 || p2 || p3;
                const lower = fn.toLowerCase();
                let arg = rawArg.trim();
                if (arg.startsWith('(') && arg.endsWith(')')) arg = arg.slice(1, -1).trim();
                return `((${lower}(${arg}))^${power})`;
            }
        );

        return s;
    }

    /**
     * Normaliza chamadas de funções matemáticas sem parênteses (Padrão Desmos):
     * \sin x -> sin(x)
     * cos 2x -> cos(2x)
     * cos x^2 -> cos(x^2)
     * sin 2x^2 -> sin(2x^2)
     * ln x -> ln(x)
     * sqrt x -> sqrt(x)
     * \sin x + \cos x -> sin(x) + cos(x)
     */
    static normalizeUnparenthesized(input: string): string {
        let s = input;
        const funcList = 'sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|asin|acos|atan|asec|acsc|acot|asinh|acosh|atanh|arcsin|arccos|arctan|arcsec|arccsc|arccot|arcsinh|arccosh|arctanh|log|ln|exp|sqrt|cbrt';
        const atomWithPow = '[a-zA-Z0-9_.]+(?:\\s*\\^\\s*(?:\\{[^{}]+\\}|\\([^()]+\\)|[+-]?[a-zA-Z0-9_.]+))?';
        const argPattern = `${atomWithPow}(?:\\s*\\*\\s*${atomWithPow})*`;
        const regex = new RegExp(`\\\\?\\b(${funcList})\\s+(?!\\()(${argPattern})(?!\\s*[\\(\\{\\^])`, 'gi');

        s = s.replace(regex, (_m, fn, arg) => {
            return `${fn.toLowerCase()}(${arg.trim()})`;
        });
        return s;
    }

    /**
     * Normaliza expressões completas de LaTeX / MathLive para sintaxe matemática limpa
     */
    static normalize(input: string, _rawLatex?: string, definedMatrixNames?: Set<string>): string {
        let s = (input || '').trim();
        if (!s) return '';

        // Limpeza de marcas e espaçamentos LaTeX
        if (_rawLatex && (_rawLatex.includes('\\begin{') || _rawLatex.includes('matrix}')) && !s.includes('\\begin{')) {
            const namePrefixMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*(?:\s*\([^)]*\))?)\s*=/);
            const prefix = namePrefixMatch ? `${namePrefixMatch[1].trim()} = ` : '';
            const matContentMatch = _rawLatex.match(/\\begin\{(?:b|p|v|V)?matrix\}[\s\S]*?\\end\{(?:b|p|v|V)?matrix\}/);
            if (matContentMatch) {
                s = `${prefix}${matContentMatch[0]}`;
            }
        }

        // Normalização de Matrizes LaTeX (\begin{bmatrix} ... \end{bmatrix}) para listas aninhadas [[...]]
        s = s.replace(/\\begin\{(?:b|p|v|V)?matrix\}([\s\S]*?)\\end\{(?:b|p|v|V)?matrix\}/g, (_m, body) => {
            const rawRows = body.split(/\\\\|\\cr|\\newline/);
            const parsedRows: string[] = [];
            for (const rStr of rawRows) {
                if (!rStr.trim()) continue;
                const rawCols = rStr.split('&');
                const cleanCols = rawCols.map((c: string) => {
                    const clean = c
                        .replace(/\\placeholder\{[^}]*\}/g, '')
                        .replace(/#\?/g, '')
                        .replace(/#@/g, '')
                        .replace(/\\text\{([^}]*)\}/g, '$1')
                        .replace(/\\mathrm\{([^}]*)\}/g, '$1')
                        .trim();
                    return clean || '0';
                });
                if (cleanCols.length > 0) {
                    parsedRows.push(`[${cleanCols.join(', ')}]`);
                }
            }
            return parsedRows.length > 0 ? `[${parsedRows.join(', ')}]` : '[[0, 0], [0, 0]]';
        });

        s = s
            .replace(/\\left\./g, '')
            .replace(/\\right\./g, '')
            .replace(/\\left/g, '')
            .replace(/\\right/g, '')
            .replace(/\s*\\cdot\s*/g, '*')
            .replace(/\s*\\times\s*/g, '*')
            .replace(/\s*\\ast\s*/g, '*')
            .replace(/\\div/g, '/')
            .replace(/∗/g, '*')
            .replace(/⋅/g, '*')
            .replace(/×/g, '*')
            .replace(/"/g, '')
            .replace(/\\,/g, ' ')
            .replace(/\\!/g, ' ')
            .replace(/\\:/g, ' ')
            .replace(/\\;/g, ' ')
            .replace(/\\ /g, ' ');

        // Consertar letras espaçadas geradas quando o utilizador escreve manualmente no teclado (ordenadas por tamanho decrescente)
        const spacedFuncs = [
            'r e d u c e d r o w e c h e l o n f o r m', 'd e t e r m i n a n t', 'm a t r i x r a n k',
            't r a n s p o s e', 'a r c s i n', 'a r c c o s', 'a r c t a n', 's i n h', 'c o s h', 't a n h',
            'c o s s e c', 'c o t a n', 't r a n', 't r a c e', 'i n v e r t', 'r r e f', 'r a n k', 'w i d t h', 'h e i g h t',
            's i n', 'c o s', 't a n', 's e c', 'c s c', 'c o t', 'l o g', 'l n', 'e x p', 'd e t', 'i n v', 't r'
        ];
        spacedFuncs.forEach(func => {
            const regex = new RegExp(func.split('').join('\\s*'), 'gi');
            s = s.replace(regex, func.replace(/\s+/g, ''));
        });

        // Conserta letras espaçadas ou multiplicadas de width e height
        s = s
            .replace(/(?:^|[^a-zA-Z_])w\s*(?:\*|\s)\s*i\s*(?:\*|\s)\s*d\s*(?:\*|\s)\s*t\s*(?:\*|\s)\s*h(?![a-zA-Z0-9_])/gi, (m) => m.startsWith('w') || m.startsWith('W') ? 'width' : m[0] + 'width')
            .replace(/(?:^|[^a-zA-Z_])h\s*(?:\*|\s)\s*e\s*(?:\*|\s)\s*i\s*(?:\*|\s)\s*g\s*(?:\*|\s)\s*h\s*(?:\*|\s)\s*t(?![a-zA-Z0-9_])/gi, (m) => m.startsWith('h') || m.startsWith('H') ? 'height' : m[0] + 'height');

        // Limpa wrappers de texto e operadores LaTeX que o MathLive gera
        s = s
            .replace(/\\operatorname\{([^}]+)\}/gi, '$1')
            .replace(/\\mathrm\{([^}]+)\}/gi, '$1')
            .replace(/\\text\{([^}]+)\}/gi, '$1');

        // Normalização de nomes de funções com subscrito (ex: f_{jose}(x), f_(1)(x), f_1(x))
        s = s.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_[\{\(]([a-zA-Z0-9_]+)[\}\)]\s*(?=\()/g, '$1_$2');
        s = s.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_([a-zA-Z0-9_]+)\s*(?=\()/g, '$1_$2');

        // Normalização de subscript do MathLive para sintaxe universal de colchetes A[r, c] e A[i]
        s = s.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_[\(\{]\s*([0-9]+)\s*,\s*([0-9]+)\s*[\)\}]/g, '$1[$2, $3]');
        s = s.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_\{([0-9]+)\}/g, (match, p1, p2) => {
            if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
            return `${p1}[${p2}]`;
        });
        s = s.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_([0-9]+)\b/g, (match, p1, p2) => {
            if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
            return `${p1}[${p2}]`;
        }).replace(/²/g, '^2').replace(/³/g, '^3');

        // Normalização universal de plicas (derivadas): suporta ordem arbitrária (f', f'', f''', etc.)
        const countPrimesInStr = (m: string) => {
            let cnt = 0;
            if (m.includes('triple') || m.includes('‴')) cnt += 3;
            else if (m.includes('double') || m.includes('″')) cnt += 2;
            const singleMatches = m.match(/\\prime|['´`’′]/g);
            if (singleMatches) cnt += singleMatches.length;
            return cnt > 0 ? "'".repeat(cnt) : "'";
        };

        s = s
            .replace(/\^\s*\{\s*(?:\\(?:triple|double)?prime|['´`’′″‴])+\s*\}/g, m => countPrimesInStr(m))
            .replace(/\^\s*\(\s*(?:\\(?:triple|double)?prime|['´`’′″‴])+\s*\)/g, m => countPrimesInStr(m))
            .replace(/\\tripleprime|‴/g, "'''")
            .replace(/\\doubleprime|″/g, "''")
            .replace(/\\prime/g, "'")
            .replace(/[´`’′]/g, "'")
            .replace(/\^'+/g, m => m.replace(/\^/g, ''));

        // Separa limites colados ao integrando (ex: _1^2x -> _1^2 x, _1x -> _1 x)
        s = s.replace(/([\^_](?:\{[^}]+\}|\([^)]+\)|[0-9.]+))\s*([a-zA-Z_])/g, '$1 $2');

        // Multiplicação escalar para matrizes e variáveis: 2B -> 2*B
        s = s.replace(/(?<![\^_]\s*)(\d+(?:\.\d+)?)\s*([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

        // Raiz enésima: \sqrt[n]{x} -> nthroot(x, n)
        s = s
            .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, 'nthroot($2, $1)')
            .replace(/root\s*\(([^)]+)\)\s*\(([^)]+)\)/g, 'nthroot($2, $1)');

        // Logaritmo com base personalizada: \log_{b}(x) -> ((log(x))/(log(b)))
        s = s.replace(/\\?log_\{?([a-zA-Z0-9.]+)\}?\s*\(([^)]+)\)/gi, '((log($2))/(log($1)))');

        // IMPORTANTE: Potências trigonométricas e funções inversas (\sin^2(x), \sin^{-1}(x), etc.)
        // DEVEM rodar ANTES dos operadores de matriz (^-1) para que \sin^{-1} vire asin e nunca inv(sin)!
        s = this.normalizeTrigPowers(s);

        // Operadores de Matriz: Transposta (^T maiúsculo estrito, ^\top, ^\intercal, ') e Inversa (^-1)
        const isMatrixIdentifier = (name: string): boolean => {
            if (definedMatrixNames && definedMatrixNames.has(name)) return true;
            // Nomes de matrizes por convenção Desmos são letras maiúsculas (ex: A, B, M), nunca x, y, z, t, e, pi ou funções
            return /^[A-Z][A-Za-z0-9_]*$/.test(name) && name !== 'C';
        };
        const exprHasMatrix = (expr: string): boolean => {
            const tokens = expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
            return tokens.some(tok => isMatrixIdentifier(tok));
        };

        s = s
            .replace(/\(([^)]+)\)\^[\{\(]?\s*(?:T|\\top|\\?intercal)\s*[\}\)]?/g, (m, inner) => exprHasMatrix(inner) ? `tran(${inner})` : m)
            .replace(/([A-Za-z_][A-Za-z0-9_]*)\^[\{\(]?\s*(?:T|\\top|\\?intercal)\s*[\}\)]?/g, (m, id) => isMatrixIdentifier(id) ? `tran(${id})` : m)
            .replace(/\(([^)]+)\)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, (m, inner) => exprHasMatrix(inner) ? `inv(${inner})` : m)
            .replace(/([A-Za-z_][A-Za-z0-9_]*)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, (m, id) => isMatrixIdentifier(id) ? `inv(${id})` : m)
            .replace(/\btr\s*\(([^)]+)\)/gi, 'trace($1)');

        // Transposta com plica para matrizes definidas (ex: B' -> tran(B), (A+B)' -> tran(A+B))
        if (definedMatrixNames) {
            for (const mName of definedMatrixNames) {
                s = s.replace(new RegExp(`\\b${mName}'+`, 'g'), `tran(${mName})`);
            }
        }
        s = s.replace(/\(([^)]+)\)'+/g, (m, inner) => exprHasMatrix(inner) ? `tran(${inner})` : m);

        // Funções matemáticas sem parênteses (\sin x, cos 2x, cos x^2, ln x, sqrt x)
        s = this.normalizeUnparenthesized(s);

        // Derivadas
        s = this.normalizeDerivative(s);

        // Frações
        s = this.normalizeFractions(s);

        // Diferenciais
        s = s
            .replace(/\\mathrm\{d\}/gi, ' d ')
            .replace(/\\text\{d\}/gi, ' d ')
            .replace(/\\differentialD/gi, ' d ');

        s = s.replace(/(?<=[a-zA-Z0-9_\)\}\]])\s*d\s*([a-zA-Z_])(?=\s*(?:[+\-*/=,\)\}\]]|$))/gi, ' d $1');

        // Integrais definidas: \int_a^b expr dx
        const boundPattern = '(?:\\{([^}]+)\\}|\\(([^)]+)\\)|(-?[0-9.]+|\\\\[a-zA-Z]+|[a-zA-Z_][a-zA-Z0-9_]*))';
        const innermostDefIntRegex = new RegExp(
            `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*(?:_\\s*${boundPattern}\\s*\\^\\s*${boundPattern}|\\^\\s*${boundPattern}\\s*_\\s*${boundPattern})\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
            'i'
        );

        let intPasses = 0;
        let prevIntStr = '';
        while (prevIntStr !== s && intPasses < 10) {
            prevIntStr = s;
            s = s.replace(innermostDefIntRegex,
                (_m, l1, l2, l3, u1, u2, u3, u4, u5, u6, l4, l5, l6, expr, v) => {
                    let lower = (l1 ?? l2 ?? l3 ?? l4 ?? l5 ?? l6).trim();
                    let upper = (u1 ?? u2 ?? u3 ?? u4 ?? u5 ?? u6).trim();
                    lower = lower.replace(/\\/g, '');
                    upper = upper.replace(/\\/g, '');
                    const integrand = expr.trim() || '1';
                    return `integrate(${integrand}, ${v}, ${lower}, ${upper})`;
                }
            );
            intPasses++;
        }

        // Integrais indefinidas: \int expr dx
        const innermostIndefIntRegex = new RegExp(
            `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
            'i'
        );
        let indefPasses = 0;
        let prevIndefStr = '';
        while (prevIndefStr !== s && indefPasses < 10) {
            prevIndefStr = s;
            s = s.replace(innermostIndefIntRegex, (_m, expr, v) => {
                const integrand = expr.trim() || '1';
                return `integrate(${integrand}, ${v})`;
            });
            indefPasses++;
        }

        // Somatório (\sum_{n=a}^b expr) e Produtório (\prod_{n=a}^b expr)
        s = s.replace(/(?:\\sum|\bsum\b)\s*_\s*(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\s*\^\s*(?:\{([^}]+)\}|\(([^)]+)\)|([^\s]+))\s*(.*)$/i,
            (_m, v1, s1, v2, s2, e1, e2, e3, body) => {
                const v = v1 || v2;
                const start = s1 || s2;
                const endVal = e1 || e2 || e3;
                return `sum(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
            }
        );
        s = s.replace(/(?:\\prod|\bprod\b)\s*_\s*(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\s*\^\s*(?:\{([^}]+)\}|\(([^)]+)\)|([^\s]+))\s*(.*)$/i,
            (_m, v1, s1, v2, s2, e1, e2, e3, body) => {
                const v = v1 || v2;
                const start = s1 || s2;
                const endVal = e1 || e2 || e3;
                return `product(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
            }
        );

        return s;
    }
}
