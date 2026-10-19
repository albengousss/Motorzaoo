import { describe, it, expect } from 'vitest';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { ListEngine } from '../src/core/listEngine';
import { StateManager } from '../src/core/stateManager';

describe('Fase 2: Motor de Listas, Broadcasting e Compreensões (Desmos Parity)', () => {

    describe('1. Sequências de Faixa Sintética', () => {
        it('gera [a...b] com passo padrão +1 se a <= b', () => {
            const ast = new PrattParser('[1...5]').parseExpression();
            expect(ast).toEqual(['Range', 1, 5]);
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([1, 2, 3, 4, 5]);
        });

        it('gera [a...b] com passo padrão -1 se a > b', () => {
            const ast = new PrattParser('[5...1]').parseExpression();
            expect(ast).toEqual(['Range', 5, 1]);
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([5, 4, 3, 2, 1]);
        });

        it('gera faixas com números negativos: [3...-3]', () => {
            const ast = new PrattParser('[3...-3]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([3, 2, 1, 0, -1, -2, -3]);
        });

        it('gera [4...4] como lista unitária', () => {
            const ast = new PrattParser('[4...4]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([4]);
        });

        it('deduz passo em [a, c...b]: [1, 3...11] com passo 2', () => {
            const ast = new PrattParser('[1, 3...11]').parseExpression();
            expect(ast).toEqual(['RangeStep', 1, 3, 11]);
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([1, 3, 5, 7, 9, 11]);
        });

        it('deduz passo decrescente: [10, 8...0] com passo -2', () => {
            const ast = new PrattParser('[10, 8...0]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([10, 8, 6, 4, 2, 0]);
        });

        it('deduz passo decimal limpo: [0, 0.5...2]', () => {
            const ast = new PrattParser('[0, 0.5...2]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([0, 0.5, 1, 1.5, 2]);
        });

        it('retorna lista vazia se passo contradiz limites (ex: [5, 8...2])', () => {
            const ast = new PrattParser('[5, 8...2]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([]);
        });

        it('retorna apenas primeiro elemento se passo ultrapassa limite imediatamente (ex: [1, 5...2])', () => {
            const ast = new PrattParser('[1, 5...2]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([1]);
        });

        it('respeita teto rígido de 10.000 elementos contra loops infinitos', () => {
            const list = ListEngine.generateRange(1, 100000);
            expect(list.length).toBe(10000);
            expect(list[0]).toBe(1);
            expect(list[9999]).toBe(10000);
        });
    });

    describe('2. Broadcasting Universal com Truncamento no Menor Comprimento', () => {
        it('opera escalar-lista (L + c, c + L)', () => {
            const ast1 = new PrattParser('[1, 2, 3] + 10').parseExpression();
            expect(MathEngine.evaluateAST(ast1)).toEqual([11, 12, 13]);

            const ast2 = new PrattParser('10 + [1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(ast2)).toEqual([11, 12, 13]);
        });

        it('opera escalar-lista com subtração (L - c e c - L)', () => {
            const ast1 = new PrattParser('[10, 20, 30] - 5').parseExpression();
            expect(MathEngine.evaluateAST(ast1)).toEqual([5, 15, 25]);

            const ast2 = new PrattParser('10 - [1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(ast2)).toEqual([9, 8, 7]);
        });

        it('opera escalar-lista com multiplicação e divisão', () => {
            const ast1 = new PrattParser('2 * [1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(ast1)).toEqual([2, 4, 6]);

            const ast2 = new PrattParser('[10, 20, 30] / 10').parseExpression();
            expect(MathEngine.evaluateAST(ast2)).toEqual([1, 2, 3]);
        });

        it('opera exponenciação escalar-lista e lista-escalar', () => {
            const ast1 = new PrattParser('[1, 2, 3] ^ 2').parseExpression();
            expect(MathEngine.evaluateAST(ast1)).toEqual([1, 4, 9]);

            const ast2 = new PrattParser('2 ^ [1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(ast2)).toEqual([2, 4, 8]);
        });

        it('trunca estritamente no menor comprimento em operações lista-lista', () => {
            // [1, 2, 3] + [10, 20] -> truncado para tamanho 2: [11, 22]
            const astAdd = new PrattParser('[1, 2, 3] + [10, 20]').parseExpression();
            expect(MathEngine.evaluateAST(astAdd)).toEqual([11, 22]);

            // [1, 2, 3, 4] * [10, 20] -> [10, 40]
            const astMul = new PrattParser('[1, 2, 3, 4] * [10, 20]').parseExpression();
            expect(MathEngine.evaluateAST(astMul)).toEqual([10, 40]);

            // [10, 20] - [1, 2, 3] -> [9, 18]
            const astSub = new PrattParser('[10, 20] - [1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(astSub)).toEqual([9, 18]);
        });

        it('aplica funções matemáticas unárias sobre listas via broadcasting', () => {
            const astSin = new PrattParser('sin([0, pi/2])').parseExpression();
            const resSin = MathEngine.evaluateAST(astSin);
            expect(resSin[0]).toBeCloseTo(0);
            expect(resSin[1]).toBeCloseTo(1);

            const astAbs = new PrattParser('abs([-5, 3, -2])').parseExpression();
            expect(MathEngine.evaluateAST(astAbs)).toEqual([5, 3, 2]);

            const astSqrt = new PrattParser('sqrt([4, 9, 16])').parseExpression();
            expect(MathEngine.evaluateAST(astSqrt)).toEqual([2, 3, 4]);

            const astNeg = new PrattParser('-[1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(astNeg)).toEqual([-1, -2, -3]);
        });
    });

    describe('3. Filtros Booleanos, Indexação e Limpeza IEEE-754', () => {
        const scope = { L: [10, 20, 30, 40, 50] };

        it('indexação 1-based por número único: L[1], L[3]', () => {
            const ast1 = new PrattParser('L[1]').parseExpression();
            expect(MathEngine.evaluateAST(ast1, scope)).toBe(10);

            const ast3 = new PrattParser('L[3]').parseExpression();
            expect(MathEngine.evaluateAST(ast3, scope)).toBe(30);

            const astOut = new PrattParser('L[99]').parseExpression();
            expect(Number.isNaN(MathEngine.evaluateAST(astOut, scope))).toBe(true);
        });

        it('seleciona múltiplos índices: L[1, 3, 5]', () => {
            const ast = new PrattParser('L[1, 3, 5]').parseExpression();
            expect(MathEngine.evaluateAST(ast, scope)).toEqual([10, 30, 50]);
        });

        it('indexa por lista de índices: L[M]', () => {
            const localScope = { L: [10, 20, 30, 40, 50], M: [3, 1] };
            const ast = new PrattParser('L[M]').parseExpression();
            expect(MathEngine.evaluateAST(ast, localScope)).toEqual([30, 10]);
        });

        it('fatiamentos abertos e fechados: L[...3], L[3...], L[2...4]', () => {
            const astStart = new PrattParser('L[...3]').parseExpression();
            expect(MathEngine.evaluateAST(astStart, scope)).toEqual([10, 20, 30]);

            const astEnd = new PrattParser('L[3...]').parseExpression();
            expect(MathEngine.evaluateAST(astEnd, scope)).toEqual([30, 40, 50]);

            const astSlice = new PrattParser('L[2...4]').parseExpression();
            expect(MathEngine.evaluateAST(astSlice, scope)).toEqual([20, 30, 40]);
        });

        it('filtro booleano: L[L > 25]', () => {
            const ast = new PrattParser('L[L > 25]').parseExpression();
            expect(MathEngine.evaluateAST(ast, scope)).toEqual([30, 40, 50]);
        });

        it('filtro de igualdade: L[L = 30]', () => {
            const localScope = { L: [10, 30, 20, 30, 50] };
            const ast = new PrattParser('L[L = 30]').parseExpression();
            expect(MathEngine.evaluateAST(ast, localScope)).toEqual([30, 30]);
        });

        it('filtro composto: L[L > 15 and L < 45]', () => {
            const ast = new PrattParser('L[L > 15 and L < 45]').parseExpression();
            expect(MathEngine.evaluateAST(ast, scope)).toEqual([20, 30, 40]);
        });

        it('limpeza de NaNs via IEEE-754: L[L = L]', () => {
            const dirtyScope = { L: [1, NaN, 2, NaN, 3] };
            const ast = new PrattParser('L[L = L]').parseExpression();
            expect(MathEngine.evaluateAST(ast, dirtyScope)).toEqual([1, 2, 3]);
        });

        it('limpeza de infinitos e NaNs: L[-inf < L < inf]', () => {
            const dirtyScope = { L: [-Infinity, -5, 0, 10, Infinity, NaN] };
            const ast = new PrattParser('L[-inf < L < inf]').parseExpression();
            expect(MathEngine.evaluateAST(ast, dirtyScope)).toEqual([-5, 0, 10]);
        });
    });

    describe('4. Compreensões de Lista e Malhas Cartesianas de Pontos', () => {
        it('compreensão unidimensional: [2k for k = [1, 2, 3]]', () => {
            const ast = new PrattParser('[2k for k = [1, 2, 3]]').parseExpression();
            expect(MathEngine.evaluateAST(ast)).toEqual([2, 4, 6]);
        });

        it('compreensão sem colchetes externos: 2k for k = [1, 2, 3]', () => {
            const ast = new PrattParser('2k for k = [1, 2, 3]').parseExpression();
            expect(MathEngine.evaluateAST(ast)).toEqual([2, 4, 6]);
        });

        it('compreensão encadeada em expressões: [2k for k = [1, 2, 3]] + 2', () => {
            const ast = new PrattParser('[2k for k = [1, 2, 3]] + 2').parseExpression();
            expect(MathEngine.evaluateAST(ast)).toEqual([4, 6, 8]);
        });

        it('malha cartesiana bidimensional de pontos: (x, y) for x = [1, 2], y = [3, 4]', () => {
            const ast = new PrattParser('(x, y) for x = [1, 2], y = [3, 4]').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([
                { x: 1, y: 3 },
                { x: 1, y: 4 },
                { x: 2, y: 3 },
                { x: 2, y: 4 }
            ]);
        });

        it('polígonos com listas de coordenadas: polygon([-1, 0, 1], [4, 5, 4])', () => {
            const ast = new PrattParser('polygon([-1, 0, 1], [4, 5, 4])').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([
                { x: -1, y: 4 },
                { x: 0, y: 5 },
                { x: 1, y: 4 }
            ]);
        });
    });

    describe('5. Comandos Estatísticos Instantâneos em Listas', () => {
        const testList = [1, 2, 3, 4, 5];
        const scope = { L: testList };

        it('calcula mean, total e length instantaneamente', () => {
            expect(MathEngine.evaluateAST(new PrattParser('mean(L)').parseExpression(), scope)).toBe(3);
            expect(MathEngine.evaluateAST(new PrattParser('total(L)').parseExpression(), scope)).toBe(15);
            expect(MathEngine.evaluateAST(new PrattParser('length(L)').parseExpression(), scope)).toBe(5);
        });

        it('calcula min, max e median', () => {
            const sc = { M: [5, 2, 9, 1, 7] };
            expect(MathEngine.evaluateAST(new PrattParser('min(M)').parseExpression(), sc)).toBe(1);
            expect(MathEngine.evaluateAST(new PrattParser('max(M)').parseExpression(), sc)).toBe(9);
            expect(MathEngine.evaluateAST(new PrattParser('median(M)').parseExpression(), sc)).toBe(5);
        });

        it('calcula var e stdev amostral', () => {
            const sc = { V: [2, 4, 4, 4, 5, 5, 7, 9] };
            const variance = MathEngine.evaluateAST(new PrattParser('var(V)').parseExpression(), sc);
            expect(variance).toBeCloseTo(4.5714, 3);
            const sd = MathEngine.evaluateAST(new PrattParser('stdev(V)').parseExpression(), sc);
            expect(sd).toBeCloseTo(2.138, 3);
        });
    });

    describe('6. Propagação de Listas no StateManager', () => {
        it('salva lista no StateManager sem ser deletada por isNaN', () => {
            const ast = new PrattParser('[1, 2, 3]').parseExpression();
            StateManager.defineVariable('L_test', ast);
            expect(StateManager.values['L_test']).toEqual([1, 2, 3]);
        });

        it('propaga atualização reativa em cascata para variáveis dependentes', () => {
            const astL = new PrattParser('[1, 2, 3]').parseExpression();
            StateManager.defineVariable('L_react', astL);

            const astM = new PrattParser('L_react * 2').parseExpression();
            StateManager.defineVariable('M_react', astM);
            expect(StateManager.values['M_react']).toEqual([2, 4, 6]);

            // Atualiza L_react
            StateManager.defineVariable('L_react', new PrattParser('[10, 20]').parseExpression());
            expect(StateManager.values['L_react']).toEqual([10, 20]);
            expect(StateManager.values['M_react']).toEqual([20, 40]);
        });
    });
});
