import { describe, it, expect, beforeEach } from 'vitest';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { MatrixEngine } from '../src/core/matrixEngine';
import { PointEngine, type Point } from '../src/core/pointEngine';
import { StateManager } from '../src/core/stateManager';

describe('Fase 3: Álgebra Matricial Estilo Desmos & Vetores de Ponto', () => {

    beforeEach(() => {
        StateManager.clearAll();
    });

    // =========================================================================
    // 1. CRIAÇÃO DE MATRIZES E VALIDAÇÃO DE DIMENSÕES
    // =========================================================================
    describe('1. Criação e Validação de Matrizes', () => {
        it('reconhece matrizes 2D retangulares e quadradas', () => {
            const m22 = [[1, 2], [3, 4]];
            const m23 = [[1, 2, 3], [4, 5, 6]];
            expect(MatrixEngine.isMatrix(m22)).toBe(true);
            expect(MatrixEngine.isMatrix(m23)).toBe(true);
            expect(MatrixEngine.getDimensions(m22)).toEqual({ rows: 2, cols: 2 });
            expect(MatrixEngine.getDimensions(m23)).toEqual({ rows: 2, cols: 3 });
        });

        it('rejeita arrays 1D, arrays irregulares e tipos primitivos', () => {
            expect(MatrixEngine.isMatrix([1, 2, 3])).toBe(false);
            expect(MatrixEngine.isMatrix([[1, 2], [3]])).toBe(false);
            expect(MatrixEngine.isMatrix([])).toBe(false);
            expect(MatrixEngine.isMatrix(null)).toBe(false);
            expect(MatrixEngine.isMatrix(42)).toBe(false);
        });

        it('formata matriz para exibição limpa estilo Desmos', () => {
            const m = [[1, 2], [3, 4]];
            expect(MatrixEngine.formatMatrixDisplay(m)).toBe('[[1, 2], [3, 4]]');
        });
    });

    // =========================================================================
    // 2. ARITMÉTICA MATRICIAL BÁSICA (+, -, escalar, produto)
    // =========================================================================
    describe('2. Aritmética Matricial', () => {
        const A = [[1, 2], [3, 4]];
        const B = [[5, 6], [7, 8]];

        it('soma de matrizes de mesma dimensão (A + B)', () => {
            const res = MatrixEngine.add(A, B);
            expect(res).toEqual([[6, 8], [10, 12]]);
        });

        it('subtração de matrizes de mesma dimensão (A - B)', () => {
            const res = MatrixEngine.subtract(A, B);
            expect(res).toEqual([[-4, -4], [-4, -4]]);
        });

        it('dispara erro para soma ou subtração de dimensões incompatíveis', () => {
            const C = [[1, 2, 3], [4, 5, 6]];
            expect(() => MatrixEngine.add(A, C)).toThrow(/Dimensões incompatíveis/);
            expect(() => MatrixEngine.subtract(A, C)).toThrow(/Dimensões incompatíveis/);
        });

        it('multiplicação por escalar (c * M e M * c)', () => {
            const scaled = MatrixEngine.scale(A, 3);
            expect(scaled).toEqual([[3, 6], [9, 12]]);
        });

        it('produto matricial clássico (A * B)', () => {
            const res = MatrixEngine.multiply(A, B);
            // [1*5 + 2*7, 1*6 + 2*8] = [5+14, 6+16] = [19, 22]
            // [3*5 + 4*7, 3*6 + 4*8] = [15+28, 18+32] = [43, 50]
            expect(res).toEqual([[19, 22], [43, 50]]);
        });

        it('produto de matrizes retangulares compatíveis (2x3 * 3x2 -> 2x2)', () => {
            const R1 = [[1, 2, 3], [4, 5, 6]]; // 2x3
            const R2 = [[7, 8], [9, 1], [2, 3]]; // 3x2
            const res = MatrixEngine.multiply(R1, R2);
            // [1*7 + 2*9 + 3*2, 1*8 + 2*1 + 3*3] = [7+18+6, 8+2+9] = [31, 19]
            // [4*7 + 5*9 + 6*2, 4*8 + 5*1 + 6*3] = [28+45+12, 32+5+18] = [85, 55]
            expect(res).toEqual([[31, 19], [85, 55]]);
        });

        it('dispara erro para produto com colunas de A != linhas de B', () => {
            const C = [[1, 2], [3, 4], [5, 6]]; // 3x2
            expect(() => MatrixEngine.multiply(A, C)).toThrow(/Dimensões incompatíveis/);
        });
    });

    // =========================================================================
    // 3. TRANSPOSIÇÃO, DETERMINANTE, TRAÇO, POSTO, RREF E INVERSA
    // =========================================================================
    describe('3. Funções e Propriedades Avançadas de Matrizes', () => {
        it('transposta M^T ou M\' para matrizes quadradas e retangulares', () => {
            const sq = [[1, 2], [3, 4]];
            expect(MatrixEngine.transpose(sq)).toEqual([[1, 3], [2, 4]]);

            const rect = [[1, 2, 3], [4, 5, 6]];
            expect(MatrixEngine.transpose(rect)).toEqual([[1, 4], [2, 5], [3, 6]]);
        });

        it('determinante analítico 1x1, 2x2 e 3x3', () => {
            expect(MatrixEngine.determinant([[7]])).toBe(7);
            expect(MatrixEngine.determinant([[1, 2], [3, 4]])).toBe(-2);
            const m33 = [
                [6, 1, 1],
                [4, -2, 5],
                [2, 8, 7]
            ];
            // det = 6*(-14 - 40) - 1*(28 - 10) + 1*(32 - (-4))
            //     = 6*(-54) - 1*(18) + 1*(36) = -324 - 18 + 36 = -306
            expect(MatrixEngine.determinant(m33)).toBe(-306);
        });

        it('determinante 4x4 via Eliminação Gaussiana', () => {
            const m44 = [
                [1, 0, 2, -1],
                [3, 0, 0, 5],
                [2, 1, 4, -3],
                [1, 0, 5, 0]
            ];
            // Expansão pela coluna 2 (único elemento não-nulo é linha 3, valor 1):
            // det = (-1)^(3+2) * 1 * det([1, 2, -1], [3, 0, 5], [1, 5, 0])
            // subdet = 1*(0 - 25) - 2*(0 - 5) + (-1)*(15 - 0) = -25 + 10 - 15 = -30
            // det = -1 * (-30) = 30
            expect(MatrixEngine.determinant(m44)).toBe(30);
        });

        it('dispara erro se determinante for chamado em matriz não-quadrada', () => {
            expect(() => MatrixEngine.determinant([[1, 2, 3], [4, 5, 6]])).toThrow(/matriz quadrada/);
        });

        it('traço (trace) soma da diagonal principal', () => {
            const M = [[2, 1, 3], [4, 5, 6], [7, 8, -1]];
            expect(MatrixEngine.trace(M)).toBe(6);
        });

        it('RREF (Reduced Row Echelon Form) e Posto (Rank)', () => {
            const M = [
                [1, 2, -1, -4],
                [2, 3, -1, -11],
                [-2, 0, -3, 22]
            ];
            const rrefM = MatrixEngine.rref(M);
            expect(rrefM).toEqual([
                [1, 0, 0, -8],
                [0, 1, 0, 1],
                [0, 0, 1, -2]
            ]);
            expect(MatrixEngine.rank(M)).toBe(3);

            // Matriz dependente (posto 1)
            const dep = [[1, 2], [2, 4]];
            expect(MatrixEngine.rank(dep)).toBe(1);
            expect(MatrixEngine.rref(dep)).toEqual([[1, 2], [0, 0]]);
        });

        it('inversa de matriz M^-1 via Gauss-Jordan', () => {
            const M = [[4, 7], [2, 6]];
            // det = 24 - 14 = 10
            // M^-1 = 1/10 * [[6, -7], [-2, 4]] = [[0.6, -0.7], [-0.2, 0.4]]
            const inv = MatrixEngine.inverse(M);
            expect(inv[0][0]).toBeCloseTo(0.6);
            expect(inv[0][1]).toBeCloseTo(-0.7);
            expect(inv[1][0]).toBeCloseTo(-0.2);
            expect(inv[1][1]).toBeCloseTo(0.4);

            // Produto M * M^-1 deve ser a matriz identidade
            const prod = MatrixEngine.multiply(M, inv);
            expect(prod[0][0]).toBeCloseTo(1);
            expect(prod[0][1]).toBeCloseTo(0);
            expect(prod[1][0]).toBeCloseTo(0);
            expect(prod[1][1]).toBeCloseTo(1);
        });

        it('dispara erro ao inverter matriz singular (det = 0)', () => {
            const singular = [[1, 2], [2, 4]];
            expect(() => MatrixEngine.inverse(singular)).toThrow(/singular/);
        });

        it('potência inteira de matriz (M^0 = I, M^k, M^-k)', () => {
            const M = [[1, 2], [3, 4]];
            // M^0 = [[1, 0], [0, 1]]
            expect(MatrixEngine.power(M, 0)).toEqual([[1, 0], [0, 1]]);

            // M^1 = M
            expect(MatrixEngine.power(M, 1)).toEqual(M);

            // M^2 = M * M = [[7, 10], [15, 22]]
            expect(MatrixEngine.power(M, 2)).toEqual([[7, 10], [15, 22]]);

            // M^-1 é equivalente a inverse(M)
            const inv = MatrixEngine.inverse(M);
            const powNeg1 = MatrixEngine.power(M, -1);
            expect(powNeg1[0][0]).toBeCloseTo(inv[0][0]);
            expect(powNeg1[1][1]).toBeCloseTo(inv[1][1]);
        });
    });

    // =========================================================================
    // 4. INDEXAÇÃO DIMENSIONAL COM SEMICÓLON: M[r; c]
    // =========================================================================
    describe('4. Indexação Dimensional com Semicólon M[r; c]', () => {
        const M = [
            [10, 20, 30],
            [40, 50, 60],
            [70, 80, 90]
        ];
        const evalMock = (a: any) => a;

        it('acessa elemento escalar único: M[2; 3] -> 60 (1-based)', () => {
            const res = MatrixEngine.indexMatrix(M, 2, 3, {}, evalMock);
            expect(res).toBe(60);
        });

        it('retorna NaN para índices fora dos limites em M[r; c]', () => {
            expect(MatrixEngine.indexMatrix(M, 0, 1, {}, evalMock)).toBeNaN();
            expect(MatrixEngine.indexMatrix(M, 4, 1, {}, evalMock)).toBeNaN();
            expect(MatrixEngine.indexMatrix(M, 1, 5, {}, evalMock)).toBeNaN();
        });

        it('retorna linha única inteira como lista 1D: M[2;] -> [40, 50, 60]', () => {
            const res = MatrixEngine.indexMatrix(M, 2, null, {}, evalMock);
            expect(res).toEqual([40, 50, 60]);
        });

        it('retorna coluna única inteira como lista 1D: M[; 3] -> [30, 60, 90]', () => {
            const res = MatrixEngine.indexMatrix(M, null, 3, {}, evalMock);
            expect(res).toEqual([30, 60, 90]);
        });

        it('extrai submatriz: M[1, 3; 2, 3]', () => {
            const res = MatrixEngine.indexMatrix(M, [1, 3], [2, 3], {}, evalMock);
            expect(res).toEqual([
                [20, 30],
                [80, 90]
            ]);
        });

        it('extrai múltiplas linhas completas: M[1, 2;]', () => {
            const res = MatrixEngine.indexMatrix(M, [1, 2], null, {}, evalMock);
            expect(res).toEqual([
                [10, 20, 30],
                [40, 50, 60]
            ]);
        });

        it('avalia via PrattParser e MathEngine: M[2; 1] e M[; 2]', () => {
            StateManager.values['M'] = [
                [1, 2],
                [3, 4]
            ];
            const astCell = new PrattParser('M[2; 1]').parseExpression();
            expect(MathEngine.evaluateAST(astCell)).toBe(3);

            const astCol = new PrattParser('M[; 2]').parseExpression();
            expect(MathEngine.evaluateAST(astCol)).toEqual([2, 4]);

            const astRow = new PrattParser('M[1;]').parseExpression();
            expect(MathEngine.evaluateAST(astRow)).toEqual([1, 2]);
        });
    });

    // =========================================================================
    // 5. ACESSORES DE PROPRIEDADES MATRICIAIS (.rows, .columns, .det, etc.)
    // =========================================================================
    describe('5. Acessores de Propriedades Matriciais (.rows, .columns, etc.)', () => {
        beforeEach(() => {
            StateManager.values['A'] = [
                [1, 2, 3],
                [4, 5, 6]
            ];
            StateManager.values['sq'] = [
                [1, 2],
                [3, 4]
            ];
        });

        it('avalia A.rows e A.columns', () => {
            const astRows = new PrattParser('A.rows').parseExpression();
            expect(MathEngine.evaluateAST(astRows)).toBe(2);

            const astCols = new PrattParser('A.columns').parseExpression();
            expect(MathEngine.evaluateAST(astCols)).toBe(3);
        });

        it('avalia sq.det, sq.trace e sq.rank', () => {
            const astDet = new PrattParser('sq.det').parseExpression();
            expect(MathEngine.evaluateAST(astDet)).toBe(-2);

            const astTr = new PrattParser('sq.trace').parseExpression();
            expect(MathEngine.evaluateAST(astTr)).toBe(5);

            const astRk = new PrattParser('sq.rank').parseExpression();
            expect(MathEngine.evaluateAST(astRk)).toBe(2);
        });
    });

    // =========================================================================
    // 6. COMPREENSÕES MATRICIAIS 2D COM SEMICÓLON
    // =========================================================================
    describe('6. Compreensões Matriciais Bidimensionais', () => {
        it('gera matriz por compreensão com faixa: [r * c for r = 1...3; c = 1...4]', () => {
            const ast = new PrattParser('[r * c for r = 1...3; c = 1...4]').parseExpression();
            expect(ast[0]).toBe('MatrixComprehension');
            const mat = MathEngine.evaluateAST(ast);
            expect(MatrixEngine.isMatrix(mat)).toBe(true);
            expect(MatrixEngine.getDimensions(mat)).toEqual({ rows: 3, cols: 4 });
            expect(mat).toEqual([
                [1, 2, 3, 4],
                [2, 4, 6, 8],
                [3, 6, 9, 12]
            ]);
        });

        it('gera matriz a partir de listas pré-definidas', () => {
            StateManager.values['L1'] = [10, 20];
            StateManager.values['L2'] = [1, 2, 3];
            const ast = new PrattParser('[x + y for x = L1; y = L2]').parseExpression();
            const mat = MathEngine.evaluateAST(ast);
            expect(mat).toEqual([
                [11, 12, 13],
                [21, 22, 23]
            ]);
        });

        it('aplica limite de segurança MAX_ROWS e MAX_COLS (32x32)', () => {
            const ast = new PrattParser('[r + c for r = 1...50; c = 1...50]').parseExpression();
            const mat = MathEngine.evaluateAST(ast);
            expect(MatrixEngine.getDimensions(mat)).toEqual({ rows: 32, cols: 32 });
        });
    });

    // =========================================================================
    // 7. ÁLGEBRA VETORIAL DE PONTOS (2D E 3D)
    // =========================================================================
    describe('7. Álgebra Vetorial e Geometria de Pontos', () => {
        const P1: Point = { x: 1, y: 2 };
        const P2: Point = { x: 3, y: 4 };
        const P3D_1: Point = { x: 1, y: 2, z: 3 };
        const P3D_2: Point = { x: 4, y: 5, z: 6 };

        it('reconhece pontos 2D e 3D válidos', () => {
            expect(PointEngine.isPoint(P1)).toBe(true);
            expect(PointEngine.isPoint(P3D_1)).toBe(true);
            expect(PointEngine.isPoint([1, 2])).toBe(false);
            expect(PointEngine.isPoint({ x: 1 })).toBe(false);
        });

        it('soma vetorial de pontos: P1 + P2', () => {
            expect(PointEngine.add(P1, P2)).toEqual({ x: 4, y: 6 });
            expect(PointEngine.add(P3D_1, P3D_2)).toEqual({ x: 5, y: 7, z: 9 });
        });

        it('subtração vetorial de pontos: P1 - P2', () => {
            expect(PointEngine.subtract(P1, P2)).toEqual({ x: -2, y: -2 });
            expect(PointEngine.subtract(P3D_1, P3D_2)).toEqual({ x: -3, y: -3, z: -3 });
        });

        it('multiplicação por escalar e divisão: c * P, P / c', () => {
            expect(PointEngine.scale(P1, 3)).toEqual({ x: 3, y: 6 });
            expect(PointEngine.divide(P1, 2)).toEqual({ x: 0.5, y: 1 });
            expect(PointEngine.divide(P1, 0).x).toBeNaN();
        });

        it('negação vetorial: -P', () => {
            expect(PointEngine.negate(P1)).toEqual({ x: -1, y: -2 });
            expect(PointEngine.negate(P3D_1)).toEqual({ x: -1, y: -2, z: -3 });
        });

        it('produto escalar (dot product): P1 * P2 e dot(P1, P2)', () => {
            // 2D: 1*3 + 2*4 = 3 + 8 = 11
            expect(PointEngine.dot(P1, P2)).toBe(11);
            // 3D: 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
            expect(PointEngine.dot(P3D_1, P3D_2)).toBe(32);
        });

        it('produto vetorial (cross product): 2D escalar e 3D vetor', () => {
            // 2D: determinante escalar 1*4 - 2*3 = 4 - 6 = -2
            expect(PointEngine.cross(P1, P2)).toBe(-2);

            // 3D: vetor
            // x = 2*6 - 3*5 = 12 - 15 = -3
            // y = 3*4 - 1*6 = 12 - 6 = 6
            // z = 1*5 - 2*4 = 5 - 8 = -3
            expect(PointEngine.cross(P3D_1, P3D_2)).toEqual({ x: -3, y: 6, z: -3 });
        });

        it('rotação perpendicular anti-horária de 90°: pointPerp(P) -> (-y, x)', () => {
            expect(PointEngine.perp(P1)).toEqual({ x: -2, y: 1 });
            expect(PointEngine.perp({ x: 3, y: -5 })).toEqual({ x: 5, y: 3 });
        });

        it('distância euclidiana e magnitude de ponto', () => {
            const origin: Point = { x: 0, y: 0 };
            const p34: Point = { x: 3, y: 4 };
            expect(PointEngine.distance(origin, p34)).toBe(5);
            expect(PointEngine.magnitude(p34)).toBe(5);
            expect(PointEngine.magnitude({ x: 1, y: 2, z: 2 })).toBe(3); // sqrt(1+4+4) = 3
        });

        it('formata ponto para exibição limpa estilo Desmos', () => {
            expect(PointEngine.formatPointDisplay(P1)).toBe('(1, 2)');
            expect(PointEngine.formatPointDisplay(P3D_1)).toBe('(1, 2, 3)');
        });
    });

    // =========================================================================
    // 8. ACESSORES DE COORDENADAS DE PONTOS (.x, .y, .z, .magnitude)
    // =========================================================================
    describe('8. Acessores de Coordenadas de Pontos (.x, .y, .z, .magnitude)', () => {
        beforeEach(() => {
            StateManager.values['P'] = { x: 7, y: 11 };
            StateManager.values['Q'] = { x: 1, y: 2, z: 2 };
        });

        it('avalia P.x e P.y via PrattParser e MathEngine', () => {
            const astX = new PrattParser('P.x').parseExpression();
            expect(MathEngine.evaluateAST(astX)).toBe(7);

            const astY = new PrattParser('P.y').parseExpression();
            expect(MathEngine.evaluateAST(astY)).toBe(11);
        });

        it('avalia Q.z e Q.magnitude', () => {
            const astZ = new PrattParser('Q.z').parseExpression();
            expect(MathEngine.evaluateAST(astZ)).toBe(2);

            const astMag = new PrattParser('Q.magnitude').parseExpression();
            expect(MathEngine.evaluateAST(astMag)).toBe(3);
        });
    });

    // =========================================================================
    // 9. TRANSFORMAÇÕES LINEARES DE PONTOS POR MATRIZES
    // =========================================================================
    describe('9. Transformações Lineares de Pontos por Matrizes', () => {
        const M_rot90 = [
            [0, -1],
            [1, 0]
        ];

        it('transforma ponto 2D via MatrixEngine.transformPoint', () => {
            const p: Point = { x: 2, y: 3 };
            const pTransformed = MatrixEngine.transformPoint(M_rot90, p);
            // 0*2 + (-1)*3 = -3
            // 1*2 + 0*3 = 2
            expect(pTransformed).toEqual({ x: -3, y: 2 });
        });

        it('transforma ponto 3D via matriz 3x3', () => {
            const M3 = [
                [2, 0, 0],
                [0, 3, 0],
                [0, 0, 4]
            ];
            const p: Point = { x: 1, y: 1, z: 1 };
            expect(MatrixEngine.transformPoint(M3, p)).toEqual({ x: 2, y: 3, z: 4 });
        });

        it('avalia multiplicação M * P e chamada de matriz como função M(P)', () => {
            StateManager.values['M'] = M_rot90;
            StateManager.values['P'] = { x: 4, y: 5 };

            // M * P
            const astMul = new PrattParser('M * P').parseExpression();
            expect(MathEngine.evaluateAST(astMul)).toEqual({ x: -5, y: 4 });

            // M(P)
            const astCall = new PrattParser('M(P)').parseExpression();
            expect(MathEngine.evaluateAST(astCall)).toEqual({ x: -5, y: 4 });

            // M(4, 5)
            const astCallCoords = new PrattParser('M(4, 5)').parseExpression();
            expect(MathEngine.evaluateAST(astCallCoords)).toEqual({ x: -5, y: 4 });
        });

        it('transforma uma lista de pontos M(L)', () => {
            StateManager.values['M'] = M_rot90;
            StateManager.values['pts'] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];

            const astListTrans = new PrattParser('M(pts)').parseExpression();
            const res = MathEngine.evaluateAST(astListTrans);
            expect(res).toEqual([
                { x: 0, y: 1 },
                { x: -1, y: 0 }
            ]);
        });
    });

    // =========================================================================
    // 10. FUNÇÕES TOMANDO PONTOS: f(P) = P.x + P.y
    // =========================================================================
    describe('10. Funções Tomando Pontos', () => {
        it('avalia função que recebe ponto e acessa suas propriedades', () => {
            // f(P) = P.x + P.y
            const fAst = new PrattParser('P.x + P.y').parseExpression();
            const testPoint = { x: 10, y: 25 };
            const scope = { P: testPoint };
            const res = MathEngine.evaluateAST(fAst, scope);
            expect(res).toBe(35);
        });

        it('avalia função que recebe ponto e retorna outro ponto invertido: g(P) = (P.y, P.x)', () => {
            const gAst = new PrattParser('(P.y, P.x)').parseExpression();
            const testPoint = { x: 12, y: 34 };
            const scope = { P: testPoint };
            const res = MathEngine.evaluateAST(gAst, scope);
            expect(res).toEqual({ x: 34, y: 12 });
        });
    });

    // =========================================================================
    // 11. MÚLTIPLOS PONTOS NA MESMA LINHA & DESCONTINUIDADES COM NaN
    // =========================================================================
    describe('11. Múltiplos Pontos na Mesma Linha e Descontinuidades', () => {
        it('converte sequência de pontos separados por vírgula em lista de pontos', () => {
            const ast = new PrattParser('(1, 2), (3, 4), (5, 6)').parseExpression();
            expect(ast[0]).toBe('List');
            const res = MathEngine.evaluateAST(ast);
            expect(res).toEqual([
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 6 }
            ]);
        });

        it('permite ponto delimitador de descontinuidade (0/0, 0/0) com NaN', () => {
            const ast = new PrattParser('(0/0, 0/0)').parseExpression();
            const res = MathEngine.evaluateAST(ast);
            expect(PointEngine.isPoint(res)).toBe(true);
            expect(res.x).toBeNaN();
            expect(res.y).toBeNaN();
        });
    });

    // =========================================================================
    // 12. COMPILAÇÃO JIT (toJS) PARA MATRIZES E PONTOS
    // =========================================================================
    describe('12. Compilação JIT (toJS)', () => {
        it('compila e executa produto escalar de pontos em JS', () => {
            const ast = new PrattParser('P1 * P2').parseExpression();
            const jsCode = MathEngine.toJS(ast);
            const fn = new Function('funcs', 'P1', 'P2', `return ${jsCode}`);
            const res = fn(MathEngine.compiledFuncs, { x: 2, y: 3 }, { x: 4, y: 5 });
            expect(res).toBe(23); // 2*4 + 3*5 = 8 + 15 = 23
        });

        it('compila e executa acessor de propriedade .x em JS', () => {
            const ast = new PrattParser('P.x + 10').parseExpression();
            const jsCode = MathEngine.toJS(ast);
            const fn = new Function('funcs', 'P', `return ${jsCode}`);
            const res = fn(MathEngine.compiledFuncs, { x: 15, y: 20 });
            expect(res).toBe(25);
        });
    });

    // =========================================================================
    // 13. COMANDOS GLOBAIS ESTILO DESMOS NO MATHENGINE
    // =========================================================================
    describe('13. Comandos Globais de Álgebra Linear e Vetores', () => {
        beforeEach(() => {
            StateManager.values['M'] = [
                [2, 0],
                [0, 5]
            ];
            StateManager.values['p1'] = { x: 1, y: 0 };
            StateManager.values['p2'] = { x: 0, y: 1 };
        });

        it('det(M), trace(M), rank(M), rref(M), inv(M)', () => {
            expect(MathEngine.evaluateAST(new PrattParser('det(M)').parseExpression())).toBe(10);
            expect(MathEngine.evaluateAST(new PrattParser('trace(M)').parseExpression())).toBe(7);
            expect(MathEngine.evaluateAST(new PrattParser('rank(M)').parseExpression())).toBe(2);
            expect(MathEngine.evaluateAST(new PrattParser('rref(M)').parseExpression())).toEqual([[1, 0], [0, 1]]);
            expect(MathEngine.evaluateAST(new PrattParser('inv(M)').parseExpression())).toEqual([[0.5, 0], [0, 0.2]]);
        });

        it('dot(p1, p2), cross(p1, p2), pointperp(p1), distance(p1, p2)', () => {
            expect(MathEngine.evaluateAST(new PrattParser('dot(p1, p2)').parseExpression())).toBe(0);
            expect(MathEngine.evaluateAST(new PrattParser('cross(p1, p2)').parseExpression())).toBe(1);
            expect(MathEngine.evaluateAST(new PrattParser('pointperp(p1)').parseExpression())).toEqual({ x: 0, y: 1 });
            expect(MathEngine.evaluateAST(new PrattParser('distance(p1, p2)').parseExpression())).toBeCloseTo(Math.SQRT2);
        });
    });
});
