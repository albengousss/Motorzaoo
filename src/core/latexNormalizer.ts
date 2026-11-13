/**
 * latexNormalizer.ts - Pipeline centralizado e robusto de normalização LaTeX para o Motor-Calc
 * Converte comandos e marcações LaTeX do MathLive para sintaxe interna padronizada do Desmos / Giac.
 */

import { FaultTolerantParser } from './faultTolerantParser';
import { extractBalancedGroup, RESERVED_BUILTIN_NAMES } from './policy';

const OPERATORNAME_UNWRAP_WORDS = new Set([
    'width', 'height', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
    'arcsin', 'arccos', 'arctan', 'arcsec', 'arccsc', 'arccot',
    'asin', 'acos', 'atan', 'asec', 'acsc', 'acot',
    'sinh', 'cosh', 'tanh', 'arcsinh', 'arccosh', 'arctanh', 'asinh', 'acosh', 'atanh', 'arsinh', 'arcosh', 'artanh', 'erf',
    'log', 'ln', 'exp', 'sqrt', 'cbrt', 'nthroot', 'abs',
    'floor', 'ceil', 'round', 'sign', 'sgn', 'mod', 'gcd', 'lcm',
    'ncr', 'npr', 'binom',
    'min', 'max', 'mean', 'median', 'stdev', 'stdevp', 'var', 'varp', 'cov', 'covp', 'corr', 'spearman', 'quartile', 'quantile', 'mad', 'samplesd', 'samplevariance', 'total', 'count', 'length', 'sort', 'unique', 'join', 'repeat',
    'dot', 'cross', 'midpoint', 'distance', 'mag', 'magnitude', 'norm', 'pointperp', 'perp',
    'det', 'determinant', 'inv', 'invert', 'tran', 'transpose', 'rref', 'trace', 'rank', 'matrixrank',
    'reducedrowechelonform', 'rows', 'columns', 'cols', 'dims', 'identity', 'eye', 'zeros', 'ones',
    'polygon', 'rgb', 'hsv', 'random', 'shuffle',
    'sum', 'prod', 'product', 'int', 'integrate', 'defint', 'diff', 'lim', 'limit', 'taylor', 'edo', 'solveode', 'laplace',
    'inf', 'infty', 'infinity', 'pi', 'tau', 'ans'
]);

const KNOWN_DESMOS_WORDS = new Set([
    ...Array.from(RESERVED_BUILTIN_NAMES).map(w => w.toLowerCase()),
    ...OPERATORNAME_UNWRAP_WORDS,
    'product', 'variance', 'cossec', 'cotan', 'root', 'true', 'false', 'to', 'in', 'not',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau',
    'upsilon', 'phi', 'chi', 'psi', 'omega'
]);

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
        while (prev !== clean && passes < 30) {
            prev = clean;
            const fracMatch = /\\(?:d|t)?frac(?![a-zA-Z])/.exec(clean);
            if (fracMatch) {
                let pos = fracMatch.index + fracMatch[0].length;
                while (pos < clean.length && /\s/.test(clean[pos])) pos++;
                const numGroup = extractBalancedGroup(clean, pos, '{', '}');
                if (numGroup) {
                    pos = numGroup.endIndex + 1;
                    while (pos < clean.length && /\s/.test(clean[pos])) pos++;
                    const denGroup = extractBalancedGroup(clean, pos, '{', '}');
                    if (denGroup) {
                        clean =
                            clean.slice(0, fracMatch.index) +
                            `((${numGroup.content.trim()})/(${denGroup.content.trim()}))` +
                            clean.slice(denGroup.endIndex + 1);
                        passes++;
                        continue;
                    }
                }
            }
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
    static normalizeBinomials(input: string): string {
        let s = input;
        let passes = 0;
        while (passes < 15) {
            const match = /\\(?:d|t)?binom(?![a-zA-Z])/.exec(s);
            if (!match) break;
            let pos = match.index + match[0].length;
            while (pos < s.length && /\s/.test(s[pos])) pos++;
            const first = extractBalancedGroup(s, pos, '{', '}');
            if (!first) break;
            pos = first.endIndex + 1;
            while (pos < s.length && /\s/.test(s[pos])) pos++;
            const second = extractBalancedGroup(s, pos, '{', '}');
            if (!second) break;
            s = s.slice(0, match.index) + `nCr(${first.content.trim()}, ${second.content.trim()})` + s.slice(second.endIndex + 1);
            passes++;
        }

        // Suporte à serialização ascii-math do MathLive para \binom{n}{k}: (((n) choose (k))) ou n choose k
        let choosePasses = 0;
        while (choosePasses < 15) {
            const cMatch = /\bchoose\b/.exec(s);
            if (!cMatch) break;

            let leftEnd = cMatch.index - 1;
            while (leftEnd >= 0 && /\s/.test(s[leftEnd])) leftEnd--;
            if (leftEnd < 0) break;

            let leftStart = -1;
            let leftContent = '';
            if (s[leftEnd] === ')') {
                let depth = 0;
                for (let i = leftEnd; i >= 0; i--) {
                    if (s[i] === ')') depth++;
                    else if (s[i] === '(') {
                        depth--;
                        if (depth === 0) {
                            leftStart = i;
                            break;
                        }
                    }
                }
                if (leftStart === -1) break;
                leftContent = s.slice(leftStart + 1, leftEnd).trim();
            } else if (/[A-Za-z0-9_.]/.test(s[leftEnd])) {
                leftStart = leftEnd;
                while (leftStart > 0 && /[A-Za-z0-9_.]/.test(s[leftStart - 1])) leftStart--;
                leftContent = s.slice(leftStart, leftEnd + 1).trim();
            } else {
                break;
            }

            let rightStart = cMatch.index + cMatch[0].length;
            while (rightStart < s.length && /\s/.test(s[rightStart])) rightStart++;
            if (rightStart >= s.length) break;

            let rightEnd = -1;
            let rightContent = '';
            if (s[rightStart] === '(') {
                const rightGroup = extractBalancedGroup(s, rightStart, '(', ')');
                if (!rightGroup) break;
                rightEnd = rightGroup.endIndex;
                rightContent = rightGroup.content.trim();
            } else {
                const rAtom = /^[+-]?[A-Za-z0-9_.]+/.exec(s.slice(rightStart));
                if (!rAtom) break;
                rightEnd = rightStart + rAtom[0].length - 1;
                rightContent = rAtom[0].trim();
            }

            if (!leftContent || !rightContent) break;
            s = s.slice(0, leftStart) + `nCr(${leftContent}, ${rightContent})` + s.slice(rightEnd + 1);
            choosePasses++;
        }
        return s;
    }

    static normalizeNthRoots(input: string): string {
        let s = input;
        let passes = 0;
        while (passes < 10) {
            const match = /\\?sqrt\s*(?=\[)/.exec(s);
            if (!match) break;
            const degStart = match.index + match[0].length;
            const degGroup = extractBalancedGroup(s, degStart, '[', ']');
            if (!degGroup) break;
            let pos = degGroup.endIndex + 1;
            while (pos < s.length && /\s/.test(s[pos])) pos++;
            const bodyGroup = extractBalancedGroup(s, pos, '{', '}');
            if (!bodyGroup) break;
            s = s.slice(0, match.index) + `nthroot(${bodyGroup.content.trim()}, ${degGroup.content.trim()})` + s.slice(bodyGroup.endIndex + 1);
            passes++;
        }
        return s;
    }

    static normalizeLogBases(input: string): string {
        let s = input;
        let passes = 0;
        while (passes < 10) {
            const match = /(?<![a-zA-Z])\\?log\s*_/i.exec(s);
            if (!match) break;
            let pos = match.index + match[0].length;
            while (pos < s.length && /\s/.test(s[pos])) pos++;
            let base = '';
            if (s[pos] === '{' || s[pos] === '(') {
                const open = s[pos];
                const baseGroup = extractBalancedGroup(s, pos, open, open === '{' ? '}' : ')');
                if (!baseGroup) break;
                base = baseGroup.content.trim();
                pos = baseGroup.endIndex + 1;
            } else {
                const baseMatch = /^[a-zA-Z0-9.]+/.exec(s.slice(pos));
                if (!baseMatch) break;
                base = baseMatch[0];
                pos += base.length;
            }
            while (pos < s.length && /\s/.test(s[pos])) pos++;
            if (s[pos] !== '(') break;
            const argGroup = extractBalancedGroup(s, pos, '(', ')');
            if (!argGroup) break;
            s = s.slice(0, match.index) + `((log(${argGroup.content.trim()}))/(log(${base})))` + s.slice(argGroup.endIndex + 1);
            passes++;
        }
        return s;
    }

    static collapseSpacedFuncs(input: string): string {
        const shields: string[] = [];
        const shield = (str: string) => {
            const token = `\u0000SH${shields.length}\u0000`;
            shields.push(str);
            return token;
        };

        let s = input
            .replace(/\\operatorname\*?\{[^}]+\}/g, m => shield(m))
            .replace(/\\(?:mathrm|text)\{[^}]+\}/g, m => shield(m))
            .replace(/_\{[^}]+\}/g, m => shield(m));

        const spacedFuncs = [
            'r e d u c e d r o w e c h e l o n f o r m', 'd e t e r m i n a n t', 'm a t r i x r a n k',
            't r a n s p o s e', 'a r c s i n h', 'a r c c o s h', 'a r c t a n h',
            'a r c s i n', 'a r c c o s', 'a r c t a n', 'a r c s e c', 'a r c c s c', 'a r c c o t',
            's i n h', 'c o s h', 't a n h', 'c o s s e c', 'c o t a n',
            't r a n', 't r a c e', 'i n v e r t', 'r r e f', 'r a n k', 'w i d t h', 'h e i g h t',
            's i n', 'c o s', 't a n', 's e c', 'c s c', 'c o t', 'l o g', 'l n', 'e x p', 'd e t', 'i n v', 't r'
        ];
        for (const func of spacedFuncs) {
            const letters = func.split(/\s+/);
            const word = letters.join('');
            const spacedPattern = letters.join('\\s+');
            const regex = new RegExp(`(?<![a-zA-Z0-9_\\\\])${spacedPattern}(?![a-zA-Z0-9_])`, 'gi');
            s = s.replace(regex, word);
        }

        // Conserta letras espaçadas ou multiplicadas de width e height (ex: w * i * d * t * h)
        s = s
            .replace(/(?<![a-zA-Z0-9_\\])w\s*(?:\*|\s)\s*i\s*(?:\*|\s)\s*d\s*(?:\*|\s)\s*t\s*(?:\*|\s)\s*h(?![a-zA-Z0-9_])/gi, 'width')
            .replace(/(?<![a-zA-Z0-9_\\])h\s*(?:\*|\s)\s*e\s*(?:\*|\s)\s*i\s*(?:\*|\s)\s*g\s*(?:\*|\s)\s*h\s*(?:\*|\s)\s*t(?![a-zA-Z0-9_])/gi, 'height');

        return s.replace(/\u0000SH(\d+)\u0000/g, (_m, idx) => shields[Number(idx)]);
    }

    static splitImplicitMultiLetter(input: string): string {
        const pattern = /\\operatorname\*?\{[^}]+\}|\\[a-zA-Z]+|\.[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z](?:_\{[^}]+\}|_\([^)]+\)|_[a-zA-Z0-9_]+)|(?<=\d)[eE](?=[+-]?\d)|[a-zA-Z]{2,}(?:\s*\()?/g;
        return input.replace(pattern, (match) => {
            if (match.startsWith('\\') || match.startsWith('.')) return match;
            if (/^[a-zA-Z]_/.test(match)) return match;
            if (/^[eE]$/.test(match)) return match;

            const hasOpenParen = match.endsWith('(');
            const word = hasOpenParen ? match.slice(0, -1).trimEnd() : match;
            const trailingSpace = hasOpenParen ? match.slice(word.length, -1) : '';
            if (KNOWN_DESMOS_WORDS.has(word) || KNOWN_DESMOS_WORDS.has(word.toLowerCase())) {
                return match;
            }
            const split = word.split('').join('*');
            return hasOpenParen ? `${split}*${trailingSpace}(` : split;
        });
    }

    static normalizeTrigPowers(input: string): string {
        let s = input;
        const invTrigMap: Record<string, string> = {
            sin: 'asin', cos: 'acos', tan: 'atan',
            sec: 'asec', csc: 'acsc', cot: 'acot',
            sinh: 'asinh', cosh: 'acosh', tanh: 'atanh'
        };

        const trigNames = 'arcsinh|arccosh|arctanh|arcsin|arccos|arctan|arcsec|arccsc|arccot|asinh|acosh|atanh|asin|acos|atan|asec|acsc|acot|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot';
        const unparenChunk = '[a-zA-Z0-9_.]+(?:\\s*\\*\\s*[a-zA-Z0-9_.]+)*(?:\\s*\\^\\s*(?:\\{[^{}]+\\}|\\([^()]+\\)|[+-]?[a-zA-Z0-9_.]+))?';
        const headRegex = new RegExp(`(?<![a-zA-Z])\\\\?(${trigNames})\\s*\\^\\s*`, 'i');

        let passes = 0;
        while (passes < 15) {
            const match = headRegex.exec(s);
            if (!match) break;

            const fnLower = match[1].toLowerCase();
            let pos = match.index + match[0].length;
            let exp = '';

            if (s[pos] === '{' || s[pos] === '(') {
                const open = s[pos];
                const expGroup = extractBalancedGroup(s, pos, open, open === '{' ? '}' : ')');
                if (!expGroup) break;
                exp = expGroup.content.trim();
                pos = expGroup.endIndex + 1;
            } else {
                const expMatch = /^-?[0-9.]+/.exec(s.slice(pos));
                if (!expMatch) break;
                exp = expMatch[0];
                pos += exp.length;
            }

            let afterExp = pos;
            while (afterExp < s.length && /\s/.test(s[afterExp])) afterExp++;

            if (exp === '-1' && invTrigMap[fnLower]) {
                const target = invTrigMap[fnLower];
                if (s[afterExp] === '(') {
                    const argGroup = extractBalancedGroup(s, afterExp, '(', ')');
                    if (argGroup) {
                        s = s.slice(0, match.index) + `${target}(${argGroup.content.trim()})` + s.slice(argGroup.endIndex + 1);
                        passes++;
                        continue;
                    }
                } else {
                    const argMatch = new RegExp(`^(${unparenChunk})`).exec(s.slice(afterExp));
                    if (argMatch) {
                        s = s.slice(0, match.index) + `${target}(${argMatch[1].trim()})` + s.slice(afterExp + argMatch[0].length);
                        passes++;
                        continue;
                    }
                }
                s = s.slice(0, match.index) + target + s.slice(pos);
                passes++;
                continue;
            }

            const powerStr = /^[0-9.]+$/.test(exp) ? exp : `(${exp})`;
            if (s[afterExp] === '(') {
                const argGroup = extractBalancedGroup(s, afterExp, '(', ')');
                if (!argGroup) break;
                s = s.slice(0, match.index) + `((${fnLower}(${argGroup.content.trim()}))^${powerStr})` + s.slice(argGroup.endIndex + 1);
                passes++;
                continue;
            }

            const argMatch = new RegExp(`^(${unparenChunk})`).exec(s.slice(afterExp));
            if (!argMatch) break;
            s = s.slice(0, match.index) + `((${fnLower}(${argMatch[1].trim()}))^${powerStr})` + s.slice(afterExp + argMatch[0].length);
            passes++;
        }

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
        // Prefere o LaTeX bruto quando disponível, evitando perdas de MathLive ascii-math (\times -> *, \operatorname -> letras espaçadas)
        let s = (_rawLatex && _rawLatex.trim()) ? _rawLatex.trim() : (input || '').trim();
        if (!s) return '';

        // Limpeza de marcas de estilo e espaçamentos LaTeX
        s = s
            .replace(/\\(?:limits|displaystyle|textstyle)(?![a-zA-Z])/g, '')
            .replace(/\\[Bb]igg?[lrm]?(?![a-zA-Z])/g, '');

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
            .replace(/\\tildeNbsp(?![a-zA-Z])/g, ' ')
            .replace(/\u00A0/g, ' ')
            .replace(/\\placeholder\{[^}]*\}/g, '')
            .replace(/#\?/g, '')
            .replace(/#@/g, '')
            .replace(/\\left\./g, '')
            .replace(/\\right\./g, '')
            .replace(/\\left/g, '')
            .replace(/\\right/g, '')
            .replace(/\s*\\cdot\s*/g, '*')
            .replace(/\s*\\times(?![a-zA-Z])\s*/g, ' \\times ')
            .replace(/\s*\\ast\s*/g, '*')
            .replace(/\\div/g, '/')
            .replace(/∗/g, '*')
            .replace(/⋅/g, '*')
            .replace(/\s*×\s*/g, ' \\times ')
            .replace(/"/g, '')
            .replace(/\\,/g, ' ')
            .replace(/\\!/g, ' ')
            .replace(/\\:/g, ' ')
            .replace(/\\;/g, ' ')
            .replace(/\\ /g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        // Consertar letras espaçadas com fronteiras de palavra estritas (sem corromper subscritos ou variáveis)
        s = this.collapseSpacedFuncs(s);

        // Desembrulha operadores conhecidos e palavras-chave mantendo separação por espaço;
        // preserva \operatorname{desconhecido} para nomes de função multi-letra explícitos.
        s = s
            .replace(/\\operatorname\*?\{([^}]+)\}/gi, (m, inner) => {
                const trimmed = inner.trim();
                const lower = trimmed.toLowerCase();
                if (lower === 'for' || lower === 'with' || lower === 'and' || lower === 'or') {
                    return ` ${lower} `;
                }
                if (OPERATORNAME_UNWRAP_WORDS.has(lower)) {
                    return trimmed;
                }
                return m;
            })
            .replace(/\\mathrm\{(?!d\})([^}]+)\}/gi, '$1')
            .replace(/\\text\{(?!d\})([^}]+)\}/gi, '$1')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        // Normalização de nomes de funções e variáveis com subscrito (mantendo L_1 / M_1 distintos de L[1] / M[1,2])
        s = s.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_[\{\(]([a-zA-Z0-9_]+)[\}\)]\s*(?=\()/g, '$1_$2');
        s = s.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_([a-zA-Z0-9_]+)\s*(?=\()/g, '$1_$2');
        s = s.replace(/(?<![\\a-zA-Z])([a-zA-Z])_[\{\(]([a-zA-Z0-9_]+)[\}\)]/g, '$1_$2');
        s = s.replace(/²/g, '^2').replace(/³/g, '^3');

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

        // Multiplicação escalar para matrizes e variáveis: 2B -> 2*B (preservando notação científica 1e-5 e palavras-chave)
        s = s.replace(/(?<![\^_]\s*)(\d+(?:\.\d+)?)\s*(?!(?:[eE][+-]?\d|(?:for|with|and|or|choose)\b))([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

        // Binomial \binom{n}{k} -> nCr(n, k)
        s = this.normalizeBinomials(s);

        // Raiz enésima: \sqrt[n]{x} -> nthroot(x, n) (balanceada)
        s = this.normalizeNthRoots(s);
        s = s.replace(/root\s*\(([^)]+)\)\s*\(([^)]+)\)/g, 'nthroot($2, $1)');

        // Logaritmo com base personalizada (balanceado/aninhado): \log_{b}(...) -> ((log(...))/(log(b)))
        s = this.normalizeLogBases(s);

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

        // Diferenciais e Integrais (protegendo \operatorname{...}, comandos LaTeX, subscritos e identificadores)
        s = s
            .replace(/\\mathrm\{d\}/gi, ' d ')
            .replace(/\\text\{d\}/gi, ' d ')
            .replace(/\\differentialD/gi, ' d ');

        const hasIntegralCmd = /(?:\\int(?![a-zA-Z])|\bint\b|\bdefint\b)/i.test(s);
        if (hasIntegralCmd) {
            const intShields: string[] = [];
            const shieldInt = (m: string) => {
                const tok = `\u0000ISH${intShields.length}\u0000`;
                intShields.push(m);
                return tok;
            };
            s = s.replace(/\\operatorname\*?\{[^}]+\}/g, shieldInt);

            const diffShields: string[] = [];
            const shieldDiff = (m: string) => {
                const tok = `\u0000DSH${diffShields.length}\u0000`;
                diffShields.push(m);
                return tok;
            };
            s = s
                .replace(/\u0000ISH\d+\u0000/g, shieldDiff)
                .replace(/_(?:\{[^}]+\}|[a-zA-Z0-9_]+)/g, shieldDiff)
                .replace(/\\[a-zA-Z]+/g, shieldDiff)
                .replace(/\b(?:defint|diff|det|median|midpoint|stdev|stdevp|round|product|random|gcd|lcm|mad|mod|std|odd|even|ode|edo|pdf|cdf|idx|width)\b/gi, shieldDiff);

            s = s.replace(/(?<=[a-zA-Z0-9_\)\}\]])\s*d\s*([a-zA-Z_])(?=\s*(?:[+\-*/=,\)\}\]]|$))/gi, ' d $1');

            s = s.replace(/\u0000DSH(\d+)\u0000/g, (_m, idx) => diffShields[Number(idx)]);

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

            s = s.replace(/\u0000ISH(\d+)\u0000/g, (_m, idx) => intShields[Number(idx)]);
        }

        // Somatório (\sum_{n=a}^b expr) e Produtório (\prod_{n=a}^b expr) com parser balanceado
        s = this.normalizeSumProd(s);

        // Regra Desmos de identificadores: separa runs multi-letras não subscritos fora de \operatorname{...} / propriedades
        s = this.splitImplicitMultiLetter(s);

        return s;
    }

    /**
     * Normaliza \\sum_{v=a}^{b} body e \\prod_{v=a}^{b} body com leitura balanceada de limites e corpo,
     * permitindo múltiplas somas/produtos em sequência (a + b) e aninhamentos arbitrários.
     */
    private static normalizeSumProd(input: string): string {
        if (!/(?:sum|prod)/i.test(input)) return input;

        const readBalanced = (str: string, openIdx: number, openCh: string, closeCh: string): { text: string; nextIdx: number } | null => {
            if (str[openIdx] !== openCh) return null;
            let depth = 0;
            let i = openIdx;
            while (i < str.length) {
                const ch = str[i];
                if (ch === '\\' && i + 1 < str.length) {
                    i += 2;
                    continue;
                }
                if (ch === openCh) depth++;
                else if (ch === closeCh) {
                    depth--;
                    if (depth === 0) {
                        return { text: str.slice(openIdx + 1, i), nextIdx: i + 1 };
                    }
                }
                i++;
            }
            return null;
        };

        const readBound = (str: string, startIdx: number): { text: string; nextIdx: number } | null => {
            let p = startIdx;
            while (p < str.length && /\s/.test(str[p])) p++;
            if (p >= str.length) return null;
            if (str[p] === '{') return readBalanced(str, p, '{', '}');
            if (str[p] === '(') return readBalanced(str, p, '(', ')');
            const cmdMatch = str.slice(p).match(/^(\\[a-zA-Z]+|[+-]?(?:\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z0-9_]*))/);
            if (!cmdMatch) return null;
            return { text: cmdMatch[1], nextIdx: p + cmdMatch[1].length };
        };

        const findTopLevelEq = (str: string): number => {
            let depth = 0;
            for (let i = 0; i < str.length; i++) {
                const ch = str[i];
                if (ch === '\\' && i + 1 < str.length) { i++; continue; }
                if (ch === '{' || ch === '(' || ch === '[') depth++;
                else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
                else if (ch === '=' && depth === 0) return i;
            }
            return -1;
        };

        const advanceHeaderIfCalculus = (str: string, idx: number): { nextIdx: number; expectOp: boolean } | null => {
            const sub = str.slice(idx);
            const m = sub.match(/^(?:\\(sum|prod|int)(?![a-zA-Z0-9])|(?<![a-zA-Z0-9_\\])(sum|prod)(?![a-zA-Z0-9]))/i);
            if (!m) return null;
            let p = idx + m[0].length;
            let seenBound = false;
            for (let k = 0; k < 2; k++) {
                while (p < str.length && /\s/.test(str[p])) p++;
                if (p < str.length && (str[p] === '_' || str[p] === '^')) {
                    const b = readBound(str, p + 1);
                    if (b) {
                        p = b.nextIdx;
                        seenBound = true;
                        continue;
                    }
                }
                break;
            }
            return { nextIdx: p, expectOp: seenBound };
        };

        let out = '';
        let cursor = 0;
        const cmdRegex = /(?:\\(sum|prod)(?![a-zA-Z0-9])|(?<![a-zA-Z0-9_\\])(sum|prod)(?![a-zA-Z0-9]))/gi;

        while (cursor < input.length) {
            cmdRegex.lastIndex = cursor;
            const match = cmdRegex.exec(input);
            if (!match) {
                out += input.slice(cursor);
                break;
            }

            const cmdStart = match.index;
            const kind = (match[1] || match[2]).toLowerCase();
            const fnName = kind === 'sum' ? 'sum' : 'product';
            let p = cmdRegex.lastIndex;
            while (p < input.length && /\s/.test(input[p])) p++;

            if (p >= input.length || (input[p] !== '_' && input[p] !== '^')) {
                out += input.slice(cursor, cmdRegex.lastIndex);
                cursor = cmdRegex.lastIndex;
                continue;
            }

            let lowerRaw: string | null = null;
            let upperRaw: string | null = null;
            let valid = true;

            for (let k = 0; k < 2; k++) {
                while (p < input.length && /\s/.test(input[p])) p++;
                const opCh = input[p];
                if (opCh !== '_' && opCh !== '^') { valid = false; break; }
                const bound = readBound(input, p + 1);
                if (!bound) { valid = false; break; }
                if (opCh === '_' && lowerRaw === null) lowerRaw = bound.text;
                else if (opCh === '^' && upperRaw === null) upperRaw = bound.text;
                else { valid = false; break; }
                p = bound.nextIdx;
            }

            if (!valid || lowerRaw === null || upperRaw === null) {
                out += input.slice(cursor, cmdRegex.lastIndex);
                cursor = cmdRegex.lastIndex;
                continue;
            }

            const eqIdx = findTopLevelEq(lowerRaw);
            if (eqIdx <= 0) {
                out += input.slice(cursor, cmdRegex.lastIndex);
                cursor = cmdRegex.lastIndex;
                continue;
            }

            const varName = lowerRaw.slice(0, eqIdx).trim();
            const startExpr = lowerRaw.slice(eqIdx + 1).trim();
            const endExpr = upperRaw.trim();
            if (!varName || !startExpr || !endExpr) {
                out += input.slice(cursor, cmdRegex.lastIndex);
                cursor = cmdRegex.lastIndex;
                continue;
            }

            out += input.slice(cursor, cmdStart);
            while (p < input.length && /\s/.test(input[p])) p++;
            const bodyStart = p;

            let parenDepth = 0;
            let braceDepth = 0;
            let absDepth = 0;
            let expectOperand = true;

            while (p < input.length) {
                const ch = input[p];
                if (/\s/.test(ch)) {
                    p++;
                    continue;
                }

                if (parenDepth === 0 && braceDepth === 0 && absDepth === 0) {
                    if (ch === ')' || ch === ']' || ch === '}' || ch === ',' || ch === ';' || ch === '=' || ch === '<' || ch === '>' || ch === ':') {
                        break;
                    }
                    if (!expectOperand && (ch === '+' || ch === '-')) {
                        break;
                    }
                    if (/^\\(?:le|ge|leq|geq|neq|right(?:\||\}|\)|\])?|\})/.test(input.slice(p))) {
                        break;
                    }
                    if (!expectOperand && /^(?:\\operatorname\{\s*(?:with|for)\s*\}|\b(?:with|for)\b)/i.test(input.slice(p))) {
                        break;
                    }
                }

                const calcHdr = advanceHeaderIfCalculus(input, p);
                if (calcHdr && calcHdr.expectOp) {
                    p = calcHdr.nextIdx;
                    expectOperand = true;
                    continue;
                }

                if (input.startsWith('\\left|', p)) {
                    absDepth++;
                    expectOperand = true;
                    p += 6;
                    continue;
                }
                if (input.startsWith('\\right|', p)) {
                    if (absDepth > 0) absDepth--;
                    expectOperand = false;
                    p += 7;
                    continue;
                }
                if (input.startsWith('\\left', p)) {
                    p += 5;
                    continue;
                }
                if (input.startsWith('\\right', p)) {
                    p += 6;
                    continue;
                }
                if (input.startsWith('\\{', p)) {
                    braceDepth++;
                    expectOperand = true;
                    p += 2;
                    continue;
                }
                if (input.startsWith('\\}', p)) {
                    if (braceDepth > 0) braceDepth--;
                    expectOperand = false;
                    p += 2;
                    continue;
                }

                if (ch === '(' || ch === '[') {
                    parenDepth++;
                    expectOperand = true;
                    p++;
                    continue;
                }
                if (ch === ')' || ch === ']') {
                    if (parenDepth > 0) parenDepth--;
                    expectOperand = false;
                    p++;
                    continue;
                }
                if (ch === '{') {
                    braceDepth++;
                    expectOperand = true;
                    p++;
                    continue;
                }
                if (ch === '}') {
                    if (braceDepth > 0) braceDepth--;
                    expectOperand = false;
                    p++;
                    continue;
                }

                if (ch === '\\') {
                    const cmdM = input.slice(p).match(/^\\([a-zA-Z]+|.)/);
                    const cmd = cmdM ? cmdM[1] : '';
                    p += cmdM ? cmdM[0].length : 1;
                    expectOperand = (cmd === 'cdot' || cmd === 'times' || cmd === 'div' || cmd === 'pm' || cmd === 'mp');
                    continue;
                }

                if (ch === '*' || ch === '/' || ch === '^' || ch === '_' || ch === '+' || ch === '-' || ch === ':' || ch === ',' || ch === '=') {
                    expectOperand = true;
                    p++;
                    continue;
                }

                expectOperand = false;
                p++;
            }

            const rawBody = input.slice(bodyStart, p).trim();
            const normBody = this.normalizeSumProd(rawBody || varName);
            const normStart = this.normalizeSumProd(startExpr);
            const normEnd = this.normalizeSumProd(endExpr);
            out += `${fnName}(${normBody}, ${varName}, ${normStart}, ${normEnd})`;
            cursor = p;
        }

        return out;
    }
}
