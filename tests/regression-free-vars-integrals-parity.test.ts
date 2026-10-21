import { describe, it, expect, beforeEach } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';
import { MathEngine } from '../src/core/mathEngine';
import { PrattParser } from '../src/core/prattParser';
import { StateManager } from '../src/core/stateManager';

describe('Regression & Desmos Parity: Free Variables, Equations & Function Integrals', () => {

    beforeEach(() => {
        StateManager.clearAll();
        MathEngine.compiledFuncs = {};
        MathEngine.userFunctions = {};
        StateManager.userFunctions = {};
        StateManager.values = {};
    });

    describe('1. Detecção de Variáveis Livres em Equações (a+b=2 e c+d+e+w=2)', () => {
        it('deve identificar corretamente as variáveis livres em a + b = 2', () => {
            const bound = ['x', 'y', 't', 'pi', 'e'];
            const free = FaultTolerantParser.detectFreeVariables('a + b = 2', bound, true);
            expect(free).toContain('a');
            expect(free).toContain('b');
            expect(free.length).toBe(2);
        });

        it('deve identificar c, d, w como variáveis livres em c + d + e + w = 2 (protegendo Euler e)', () => {
            const bound = ['x', 'y', 't', 'pi', 'e'];
            const free = FaultTolerantParser.detectFreeVariables('c + d + e + w = 2', bound, true);
            expect(free).toContain('c');
            expect(free).toContain('d');
            expect(free).toContain('w');
            expect(free).not.toContain('e'); // 'e' é constante matemática protegida
            expect(free.length).toBe(3);
        });

        it('toJS não deve substituir variáveis não definidas por 0 (evitando avaliar a+b-2 como -2)', () => {
            const ast = new PrattParser('(a + b) - 2').parseExpression();
            const js = MathEngine.toJS(ast);
            const fn = new Function('x', 'y', 'scope', 'funcs', `return ${js};`);
            
            // Sem definir 'a' e 'b', deve retornar NaN (e NUNCA 0 - 2 = -2!)
            const res = fn(0, 0, {}, MathEngine.compiledFuncs);
            expect(Number.isNaN(res)).toBe(true);

            // Com 'a' e 'b' definidos no escopo, avalia corretamente
            const resDefined = fn(0, 0, { a: 1, b: 2 }, MathEngine.compiledFuncs);
            expect(resDefined).toBe(1);
        });

        it('toJS não deve avaliar c+d+e+w-2 como 0.7182818285 quando c, d, w não existem', () => {
            const ast = new PrattParser('(c + d + e + w) - 2').parseExpression();
            const js = MathEngine.toJS(ast);
            const fn = new Function('x', 'y', 'scope', 'funcs', `return ${js};`);

            const res = fn(0, 0, {}, MathEngine.compiledFuncs);
            expect(Number.isNaN(res)).toBe(true); // NaN, não Math.E - 2!
        });
    });

    describe('2. Definição de Função por Integral: g(x) = \\int f(x) dx', () => {
        it('expandUserFunctions deve substituir f(x) pela sua definição antes de formatar para o Giac', () => {
            // Registra f(x) = x^2
            const fAst = new PrattParser('x^2').parseExpression();
            MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst };

            // Expressão de g(x) = \int f(x) dx
            const gAst = new PrattParser('integrate(f(x), x)').parseExpression();
            const expanded = MathEngine.expandUserFunctions(gAst);

            // expanded deve conter Power(x, 2), e não f(x)
            expect(expanded[0]).toBe('Integrate');
            expect(expanded[1][0]).toBe('Power');
            expect(expanded[1][1]).toBe('x');
            expect(expanded[1][2]).toBe(2);

            // formatForGiac deve gerar int((x)^(2), x) sem resíduo usr_f
            const giacStr = MathEngine.formatForGiac(expanded);
            expect(giacStr).toMatch(/^(?:int|integrate)/);
            expect(giacStr).not.toContain('usr_f');
        });

        it('após resolução analítica, g(2) deve avaliar x^3 / 3 = 8/3 e não 0', () => {
            // Simula resultado resolvido pelo Giac para g(x): x^3 / 3
            const solvedAst = new PrattParser('(x^3)/3').parseExpression();
            MathEngine.userFunctions['g'] = { params: ['x'], expr: '(x^3)/3', ast: solvedAst };
            MathEngine.compiledFuncs['g'] = MathEngine.compile(solvedAst, 'x');

            // Chamada de g(2)
            const callAst = new PrattParser('g(2)').parseExpression();
            const val = MathEngine.evaluateAST(callAst, StateManager.values);
            expect(val).toBeCloseTo(8 / 3, 5);
            expect(val).not.toBe(0);
        });
    });
});
