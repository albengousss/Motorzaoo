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
     * Normaliza expressões completas de LaTeX / MathLive para sintaxe matemática limpa
     */
    static normalize(input: string): string {
        let s = input.trim();

        // Limpeza de marcas e espaçamentos LaTeX
        s = s
            .replace(/\\left/g, '')
            .replace(/\\right/g, '')
            .replace(/\\cdot/g, '*')
            .replace(/\\times/g, '*')
            .replace(/\\div/g, '/')
            .replace(/\\operatorname\{([^}]+)\}/g, '$1')
            .replace(/\\mathrm\{([^}]+)\}/g, '$1')
            .replace(/\\text\{([^}]+)\}/g, '$1')
            .replace(/\\,/g, ' ')
            .replace(/\\!/g, ' ')
            .replace(/\\:/g, ' ')
            .replace(/\\;/g, ' ')
            .replace(/\\ /g, ' ');

        // Transposta A^T, A^\top -> tran(A)
        s = s.replace(/([a-zA-Z0-9_]+)\s*\^\s*\{?\s*(?:T|\\top|top)\s*\}?/g, 'tran($1)');
        s = s.replace(/\(([^)]+)\)'+/g, 'tran($1)');

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

        return s;
    }
}
