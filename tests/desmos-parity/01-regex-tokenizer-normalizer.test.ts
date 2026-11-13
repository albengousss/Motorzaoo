import { describe, it, expect } from 'vitest';
import { Tokenizer, TokenTypes } from '../../src/core/tokenizer';
import { LatexNormalizer } from '../../src/core/latexNormalizer';
import { PrattParser } from '../../src/core/prattParser';
import { MathEngine } from '../../src/core/mathEngine';

describe('Desmos Parity Module 01: Regex, Tokenizer & LaTeX Normalizer', () => {
    it('normalizes basic LaTeX fractions, nthroots, products and tokenizes comparison operators', () => {
        expect(LatexNormalizer.normalize('\\frac{1}{2}')).toBe('((1)/(2))');
        expect(LatexNormalizer.normalize('\\sqrt[3]{x}')).toBe('nthroot(x, 3)');
        expect(LatexNormalizer.normalize('2\\cdot x')).toBe('2*x');
        expect(new Tokenizer().tokenize('x \\le 5')[1].type).toBe(TokenTypes.LESS_EQUAL);
        expect(new Tokenizer().tokenize('x \\ge -2')[1].type).toBe(TokenTypes.GREATER_EQUAL);
        expect(new PrattParser(LatexNormalizer.normalize('\\sqrt{x}')).parseExpression()).toEqual(['Sqrt', 'x']);
    });

    it('preserves \\times as TokenTypes.CROSS separately from multiplication', () => {
        const toks = new Tokenizer().tokenize('u \\times v');
        expect(toks.map(t => t.type)).toEqual([
            TokenTypes.IDENTIFIER,
            TokenTypes.CROSS,
            TokenTypes.IDENTIFIER
        ]);
        expect(toks[1].value).toBe('\\times');
    });

    it('tokenizes scientific notation, absolute value pipes, and implicit products', () => {
        const sci = new Tokenizer().tokenize('1e-5 + 2.5e3');
        expect(sci[0]).toEqual({ type: TokenTypes.NUMBER, value: '1e-5' });
        expect(sci[2]).toEqual({ type: TokenTypes.NUMBER, value: '2.5e3' });

        const absAst = new PrattParser('2|x|').parseExpression();
        expect(absAst).toEqual(['Multiply', 2, ['Abs', 'x']]);

        const implicitPi = new PrattParser('\\pi x').parseExpression();
        expect(implicitPi).toEqual(['Multiply', 'pi', 'x']);
    });

    it('Phase B: keeps subscripted identifiers L_1, M_1 distinct from indexing L[1], M[1,2]', () => {
        const normSub = LatexNormalizer.normalize('L_1 + L_{2}', '');
        expect(normSub).not.toContain('L[1]');
        expect(normSub).not.toContain('L[2]');
        expect(new PrattParser('L_1').parseExpression()).toBe('L_1');

        const normIdx = LatexNormalizer.normalize('L[1]', '');
        expect(new PrattParser(normIdx).parseExpression()).toEqual(['Index', 'L', 1]);

        const mixedAst = new PrattParser(LatexNormalizer.normalize('M_1 + M[1, 2]', '')).parseExpression();
        expect(mixedAst).toEqual(['Add', 'M_1', ['Index', 'M', 1, 2]]);
    });

    it('Phase B: splits unspaced multi-letter runs ab into a*b and unknown func(x) into f*u*n*c*(x)', () => {
        const abNorm = LatexNormalizer.normalize('ab', '');
        expect(abNorm).toBe('a*b');
        expect(new PrattParser(abNorm).parseExpression()).toEqual(['Multiply', 'a', 'b']);

        const funcNorm = LatexNormalizer.normalize('func(x)', '');
        const funcAst = new PrattParser(funcNorm).parseExpression();
        expect(Array.isArray(funcAst)).toBe(true);
        expect(funcAst[0]).toBe('Multiply');

        // Built-ins, científicos, propriedades com ponto e 1-letra + subscrito ficam intactos
        expect(LatexNormalizer.normalize('sin(x)', '')).toBe('sin(x)');
        expect(LatexNormalizer.normalize('1e-5', '')).toBe('1e-5');
        expect(LatexNormalizer.normalize('M.rows', '')).toBe('M.rows');
        expect(LatexNormalizer.normalize('a_{bc}', '')).toBe('a_bc');
        expect(LatexNormalizer.normalize('\\operatorname{func}(x)', '')).toContain('\\operatorname{func}');
    });

    it('Phase B: fixes \\arcsin^{2}(x) normalization instead of corrupting into \\arc((sin(x))^2)', () => {
        const norm = LatexNormalizer.normalize('\\arcsin^{2}(x)', '\\arcsin^{2}(x)');
        expect(norm).not.toContain('\\arc(');
        const val = MathEngine.evaluateAST(new PrattParser(norm).parseExpression(), { x: 0.5 });
        expect(val).toBeCloseTo(Math.pow(Math.asin(0.5), 2), 8);

        const sinSq = LatexNormalizer.normalize('\\sin^{2}(x) + \\cos^{2}(x)', '');
        expect(MathEngine.evaluateAST(new PrattParser(sinSq).parseExpression(), { x: 0.7 })).toBeCloseTo(1, 8);
    });

    it('Phase B: enforces strict word boundaries on spacedFuncs (never splitting var names containing tr/ln/det/sec/tan/inv)', () => {
        const collapsed = LatexNormalizer.normalize('t r a c e ( M )', '');
        expect(collapsed.replace(/\s+/g, '')).toContain('trace(M)');

        // Palavras que contêm substrings como det, tan, tr, ln, inv em operadores/subscritos não podem ser corrompidas
        expect(LatexNormalizer.normalize('\\operatorname{traceable}', '')).toBe('\\operatorname{traceable}');
        expect(LatexNormalizer.normalize('\\operatorname{lnvar} + 1', '')).toContain('\\operatorname{lnvar}');
        const subNorm = LatexNormalizer.normalize('x_{tr} + x_{tan} + a_{inv}', '');
        expect(subNorm).toContain('x_tr');
        expect(subNorm).toContain('x_tan');
        expect(subNorm).toContain('a_inv');
        expect(new PrattParser(subNorm).parseExpression()).toEqual(['Add', ['Add', 'x_tr', 'x_tan'], 'a_inv']);
    });

    it('Phase B: preserves whitespace separators around \\operatorname{for|with|and|or}', () => {
        const forNorm = LatexNormalizer.normalize('[2k \\operatorname{for} k = [1, 2, 3]]', '');
        expect(forNorm).toContain(' for ');
        const forVal = MathEngine.evaluateAST(new PrattParser(forNorm).parseExpression());
        expect(forVal).toEqual([2, 4, 6]);

        const withNorm = LatexNormalizer.normalize('a + b \\operatorname{with} a = 2, b = 3', '');
        expect(withNorm).toContain(' with ');
        const withVal = MathEngine.evaluateAST(new PrattParser(withNorm).parseExpression());
        expect(withVal).toBe(5);

        const andOrNorm = LatexNormalizer.normalize('x > 0 \\operatorname{and} x < 5', '');
        expect(andOrNorm).toContain(' and ');
        const toks = new Tokenizer().tokenize(LatexNormalizer.normalize('x < 0 \\operatorname{or} x > 5', ''));
        expect(toks.some(t => t.type === TokenTypes.OR)).toBe(true);
    });

    it('Phase B: strips \\tildeNbsp, placeholders #?, and supports \\binom{n}{k} & balanced nested \\log_{b}(...)', () => {
        const cleanSpaced = LatexNormalizer.normalize('2\\tildeNbsp x + #? + \\placeholder{y}\u00A0', '');
        expect(cleanSpaced).not.toContain('tildeNbsp');
        expect(cleanSpaced).not.toContain('#?');
        expect(cleanSpaced).not.toContain('\u00A0');
        expect(cleanSpaced).not.toContain('placeholder');

        const binomNorm = LatexNormalizer.normalize('\\binom{5}{2}', '\\binom{5}{2}');
        expect(MathEngine.evaluateAST(new PrattParser(binomNorm).parseExpression())).toBe(10);
        const binomAsciiNorm = LatexNormalizer.normalize('(((5) choose (2)))', '\\binom{5}{2}');
        expect(MathEngine.evaluateAST(new PrattParser(binomAsciiNorm).parseExpression())).toBe(10);

        const rootNorm = LatexNormalizer.normalize('\\sqrt[3]{8}', '\\sqrt[3]{8}');
        expect(MathEngine.evaluateAST(new PrattParser(rootNorm).parseExpression())).toBe(2);

        const nestedLogNorm = LatexNormalizer.normalize('\\log_{1 + 1}(\\sin(\\pi/2) + 7)', '');
        expect(MathEngine.evaluateAST(new PrattParser(nestedLogNorm).parseExpression())).toBeCloseTo(3, 8);
    });
});
