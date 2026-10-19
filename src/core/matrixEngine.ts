/**
 * MatrixEngine: Álgebra Matricial Estilo Desmos (Fase 3 do plano de reforma)
 * Suporta criação, operações, indexação dimensional com ponto e vírgula M[r; c],
 * compreensões bidimensionais e transformações geométricas de pontos.
 */

export interface Point2DOr3D {
    x: number;
    y: number;
    z?: number;
}

export class MatrixEngine {
    public static readonly MAX_ROWS = 32;
    public static readonly MAX_COLS = 32;

    /**
     * Verifica se o valor é uma matriz 2D válida (array de arrays numéricos com dimensões uniformes)
     */
    static isMatrix(val: any): boolean {
        if (!Array.isArray(val) || val.length === 0) return false;
        if (!Array.isArray(val[0]) || val[0].length === 0) return false;
        const colCount = val[0].length;
        for (let i = 0; i < val.length; i++) {
            if (!Array.isArray(val[i]) || val[i].length !== colCount) return false;
        }
        return true;
    }

    /**
     * Retorna as dimensões [linhas, colunas] da matriz
     */
    static getDimensions(m: number[][]): { rows: number; cols: number } {
        if (!this.isMatrix(m)) return { rows: 0, cols: 0 };
        return { rows: m.length, cols: m[0].length };
    }

    /**
     * Soma de duas matrizes (A + B)
     */
    static add(a: number[][], b: number[][]): number[][] {
        const dimA = this.getDimensions(a);
        const dimB = this.getDimensions(b);
        if (dimA.rows !== dimB.rows || dimA.cols !== dimB.cols) {
            throw new Error(`Dimensões incompatíveis para soma matricial: [${dimA.rows}x${dimA.cols}] e [${dimB.rows}x${dimB.cols}]`);
        }
        return a.map((row, r) => row.map((val, c) => val + b[r][c]));
    }

    /**
     * Subtração de duas matrizes (A - B)
     */
    static subtract(a: number[][], b: number[][]): number[][] {
        const dimA = this.getDimensions(a);
        const dimB = this.getDimensions(b);
        if (dimA.rows !== dimB.rows || dimA.cols !== dimB.cols) {
            throw new Error(`Dimensões incompatíveis para subtração matricial: [${dimA.rows}x${dimA.cols}] e [${dimB.rows}x${dimB.cols}]`);
        }
        return a.map((row, r) => row.map((val, c) => val - b[r][c]));
    }

    /**
     * Multiplicação por escalar (c * M ou M * c)
     */
    static scale(m: number[][], scalar: number): number[][] {
        return m.map(row => row.map(val => val * scalar));
    }

    /**
     * Multiplicação de duas matrizes (A * B)
     */
    static multiply(a: number[][], b: number[][]): number[][] {
        const dimA = this.getDimensions(a);
        const dimB = this.getDimensions(b);
        if (dimA.cols !== dimB.rows) {
            throw new Error(`Dimensões incompatíveis para produto matricial: [${dimA.rows}x${dimA.cols}] * [${dimB.rows}x${dimB.cols}]`);
        }
        const res: number[][] = [];
        for (let r = 0; r < dimA.rows; r++) {
            const row: number[] = [];
            for (let c = 0; c < dimB.cols; c++) {
                let sum = 0;
                for (let k = 0; k < dimA.cols; k++) {
                    sum += a[r][k] * b[k][c];
                }
                row.push(Number(sum.toPrecision(12)));
            }
            res.push(row);
        }
        return res;
    }

    /**
     * Transposição de matriz (M^T ou M')
     */
    static transpose(m: number[][]): number[][] {
        const dim = this.getDimensions(m);
        const res: number[][] = [];
        for (let c = 0; c < dim.cols; c++) {
            const row: number[] = [];
            for (let r = 0; r < dim.rows; r++) {
                row.push(m[r][c]);
            }
            res.push(row);
        }
        return res;
    }

    /**
     * Determinante de matriz quadrada det(M)
     */
    static determinant(m: number[][]): number {
        const dim = this.getDimensions(m);
        if (dim.rows !== dim.cols) {
            throw new Error(`Determinante requer matriz quadrada, recebida [${dim.rows}x${dim.cols}]`);
        }
        const n = dim.rows;
        if (n === 1) return m[0][0];
        if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
        if (n === 3) {
            return (
                m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
                m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
                m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
            );
        }

        // Eliminação Gaussiana com pivoteamento parcial para N x N
        const a = m.map(row => [...row]);
        let det = 1;
        for (let i = 0; i < n; i++) {
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
                    maxRow = k;
                }
            }
            if (Math.abs(a[maxRow][i]) < 1e-12) return 0;
            if (maxRow !== i) {
                const tmp = a[i];
                a[i] = a[maxRow];
                a[maxRow] = tmp;
                det = -det;
            }
            det *= a[i][i];
            const pivot = a[i][i];
            for (let k = i + 1; k < n; k++) {
                const factor = a[k][i] / pivot;
                for (let j = i; j < n; j++) {
                    a[k][j] -= factor * a[i][j];
                }
            }
        }
        return Number(det.toPrecision(12));
    }

    /**
     * Traço da matriz trace(M) (soma dos elementos da diagonal principal)
     */
    static trace(m: number[][]): number {
        const dim = this.getDimensions(m);
        const minDim = Math.min(dim.rows, dim.cols);
        let tr = 0;
        for (let i = 0; i < minDim; i++) {
            tr += m[i][i];
        }
        return tr;
    }

    /**
     * Posto da matriz rank(M)
     */
    static rank(m: number[][]): number {
        const rrefMat = this.rref(m);
        let r = 0;
        for (let i = 0; i < rrefMat.length; i++) {
            if (rrefMat[i].some(v => Math.abs(v) > 1e-9)) {
                r++;
            }
        }
        return r;
    }

    /**
     * Forma Escalonada Reduzida por Linhas (RREF)
     */
    static rref(m: number[][]): number[][] {
        const dim = this.getDimensions(m);
        const a = m.map(row => [...row]);
        let lead = 0;
        for (let r = 0; r < dim.rows; r++) {
            if (lead >= dim.cols) break;
            let i = r;
            while (Math.abs(a[i][lead]) < 1e-9) {
                i++;
                if (i === dim.rows) {
                    i = r;
                    lead++;
                    if (lead === dim.cols) return a.map(row => row.map(v => Number(v.toPrecision(10))));
                }
            }
            const tmp = a[i];
            a[i] = a[r];
            a[r] = tmp;

            const lv = a[r][lead];
            for (let j = 0; j < dim.cols; j++) {
                a[r][j] /= lv;
            }
            for (let k = 0; k < dim.rows; k++) {
                if (k !== r) {
                    const factor = a[k][lead];
                    for (let j = 0; j < dim.cols; j++) {
                        a[k][j] -= factor * a[r][j];
                    }
                }
            }
            lead++;
        }
        return a.map(row => row.map(v => Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(10))));
    }

    /**
     * Inversa de matriz quadrada (M^-1) via Gauss-Jordan
     */
    static inverse(m: number[][]): number[][] {
        const dim = this.getDimensions(m);
        if (dim.rows !== dim.cols) {
            throw new Error(`Inversa requer matriz quadrada, recebida [${dim.rows}x${dim.cols}]`);
        }
        const n = dim.rows;
        // Matriz aumentada [A | I]
        const aug: number[][] = [];
        for (let i = 0; i < n; i++) {
            const row: number[] = [...m[i]];
            for (let j = 0; j < n; j++) {
                row.push(i === j ? 1 : 0);
            }
            aug.push(row);
        }

        for (let i = 0; i < n; i++) {
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
                    maxRow = k;
                }
            }
            if (Math.abs(aug[maxRow][i]) < 1e-12) {
                throw new Error(`Matriz é singular e não possui inversa (det = 0).`);
            }
            const tmp = aug[i];
            aug[i] = aug[maxRow];
            aug[maxRow] = tmp;

            const pivot = aug[i][i];
            for (let j = 0; j < 2 * n; j++) {
                aug[i][j] /= pivot;
            }
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug[k][i];
                    for (let j = 0; j < 2 * n; j++) {
                        aug[k][j] -= factor * aug[i][j];
                    }
                }
            }
        }

        const inv: number[][] = [];
        for (let i = 0; i < n; i++) {
            inv.push(aug[i].slice(n).map(v => Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(10))));
        }
        return inv;
    }

    /**
     * Potência inteira de matriz (M^k)
     * - k = 0 -> Matriz Identidade I
     * - k > 0 -> M * M * ... * M
     * - k < 0 -> (M^-1)^|k|
     */
    static power(m: number[][], power: number): number[][] {
        const dim = this.getDimensions(m);
        if (dim.rows !== dim.cols) {
            throw new Error(`Potência requer matriz quadrada, recebida [${dim.rows}x${dim.cols}]`);
        }
        const n = dim.rows;
        const p = Math.floor(power);

        if (p === 0) {
            return Array.from({ length: n }, (_, r) =>
                Array.from({ length: n }, (_, c) => (r === c ? 1 : 0))
            );
        }

        let base = m;
        if (p < 0) {
            base = this.inverse(m);
        }

        const absP = Math.abs(p);
        let result: number[][] = Array.from({ length: n }, (_, r) =>
            Array.from({ length: n }, (_, c) => (r === c ? 1 : 0))
        );

        let cur = base;
        let e = absP;
        while (e > 0) {
            if (e % 2 === 1) {
                result = this.multiply(result, cur);
            }
            if (e > 1) {
                cur = this.multiply(cur, cur);
            }
            e = Math.floor(e / 2);
        }

        return result;
    }

    /**
     * Transformação Linear de Pontos por Matriz (M(x, y) ou M(P))
     * Multiplica a matriz pelo vetor de coordenadas do ponto.
     */
    static transformPoint(m: number[][], p: Point2DOr3D): Point2DOr3D {
        const dim = this.getDimensions(m);
        if (dim.rows === 2 && dim.cols === 2) {
            const x = m[0][0] * p.x + m[0][1] * p.y;
            const y = m[1][0] * p.x + m[1][1] * p.y;
            return {
                x: Number(x.toPrecision(12)),
                y: Number(y.toPrecision(12)),
                ...(p.z !== undefined ? { z: p.z } : {})
            };
        }
        if (dim.rows === 3 && dim.cols === 3) {
            const zIn = p.z || 0;
            const x = m[0][0] * p.x + m[0][1] * p.y + m[0][2] * zIn;
            const y = m[1][0] * p.x + m[1][1] * p.y + m[1][2] * zIn;
            const z = m[2][0] * p.x + m[2][1] * p.y + m[2][2] * zIn;
            return {
                x: Number(x.toPrecision(12)),
                y: Number(y.toPrecision(12)),
                z: Number(z.toPrecision(12))
            };
        }
        throw new Error(`Transformação de ponto requer matriz 2x2 ou 3x3, recebida [${dim.rows}x${dim.cols}]`);
    }

    /**
     * Indexação Dimensional com Semicólon M[r; c] (Padrão Desmos)
     * - M[2; 3]: valor escalar na linha 2, coluna 3 (1-based)
     * - M[1, 2;]: linhas 1 e 2 com todas as colunas
     * - M[; 3]: coluna 3 inteira com todas as linhas
     * - M[1, 2; 3, 4]: submatriz
     */
    static indexMatrix(
        m: number[][],
        rowSpec: any,
        colSpec: any,
        scope: Record<string, any>,
        evalAst: (a: any, s: Record<string, any>) => any
    ): any {
        if (!this.isMatrix(m)) return NaN;
        const dim = this.getDimensions(m);

        // Resolve índices de linhas (1-based)
        let rowIndices: number[] = [];
        if (rowSpec === null || rowSpec === undefined) {
            rowIndices = Array.from({ length: dim.rows }, (_, i) => i + 1);
        } else {
            const evaluatedRow = Array.isArray(rowSpec) && typeof rowSpec[0] !== 'string'
                ? rowSpec.map(n => evalAst(n, scope)).flat()
                : evalAst(rowSpec, scope);
            if (Array.isArray(evaluatedRow)) {
                rowIndices = evaluatedRow.map(Number);
            } else if (typeof evaluatedRow === 'number') {
                rowIndices = [evaluatedRow];
            }
        }

        // Resolve índices de colunas (1-based)
        let colIndices: number[] = [];
        if (colSpec === null || colSpec === undefined) {
            colIndices = Array.from({ length: dim.cols }, (_, i) => i + 1);
        } else {
            const evaluatedCol = Array.isArray(colSpec) && typeof colSpec[0] !== 'string'
                ? colSpec.map(n => evalAst(n, scope)).flat()
                : evalAst(colSpec, scope);
            if (Array.isArray(evaluatedCol)) {
                colIndices = evaluatedCol.map(Number);
            } else if (typeof evaluatedCol === 'number') {
                colIndices = [evaluatedCol];
            }
        }

        // Caso 1: Acesso a escalar único M[r; c]
        const isSingleRow = (rowSpec !== null && rowSpec !== undefined && !Array.isArray(rowSpec)) || (Array.isArray(rowSpec) && rowSpec.length === 1 && typeof rowSpec[0] === 'number');
        const isSingleCol = (colSpec !== null && colSpec !== undefined && !Array.isArray(colSpec)) || (Array.isArray(colSpec) && colSpec.length === 1 && typeof colSpec[0] === 'number');
        if (isSingleRow && isSingleCol && rowIndices.length === 1 && colIndices.length === 1) {
            const r = Math.floor(rowIndices[0]);
            const c = Math.floor(colIndices[0]);
            if (r >= 1 && r <= dim.rows && c >= 1 && c <= dim.cols) {
                return m[r - 1][c - 1];
            }
            return NaN;
        }

        // Caso 2: Linha única M[r;] ou coluna única M[; c] como lista 1D
        if (rowIndices.length === 1 && (colSpec === null || colSpec === undefined)) {
            const r = Math.floor(rowIndices[0]);
            if (r >= 1 && r <= dim.rows) {
                return [...m[r - 1]];
            }
            return [];
        }

        if ((rowSpec === null || rowSpec === undefined) && colIndices.length === 1) {
            const c = Math.floor(colIndices[0]);
            if (c >= 1 && c <= dim.cols) {
                return m.map(row => row[c - 1]);
            }
            return [];
        }

        // Caso 3: Submatriz 2D
        const sub: number[][] = [];
        for (const r of rowIndices) {
            const r1 = Math.floor(r);
            if (r1 >= 1 && r1 <= dim.rows) {
                const row: number[] = [];
                for (const c of colIndices) {
                    const c1 = Math.floor(c);
                    if (c1 >= 1 && c1 <= dim.cols) {
                        row.push(m[r1 - 1][c1 - 1]);
                    }
                }
                sub.push(row);
            }
        }
        return sub;
    }

    /**
     * Compreensão Matricial Bidimensional com Semicólon (Padrão Desmos)
     * Sintaxe: expr for rVar = rList; cVar = cList
     * Ex: [r * c for r = 1...3; c = 1...4]
     */
    static generateMatrixComprehension(
        exprAst: any,
        bindings: Array<[string, any]>,
        scope: Record<string, any>,
        evalAst: (a: any, s: Record<string, any>) => any
    ): number[][] {
        if (!bindings || bindings.length < 2) return [];

        const [rVar, rExpr] = bindings[0];
        const [cVar, cExpr] = bindings[1];

        const rVal = evalAst(rExpr, scope);
        const cVal = evalAst(cExpr, scope);

        const rList: any[] = Array.isArray(rVal) ? rVal : [rVal];
        const cList: any[] = Array.isArray(cVal) ? cVal : [cVal];

        const numRows = Math.min(rList.length, MatrixEngine.MAX_ROWS);
        const numCols = Math.min(cList.length, MatrixEngine.MAX_COLS);

        const mat: number[][] = [];
        for (let i = 0; i < numRows; i++) {
            const row: number[] = [];
            for (let j = 0; j < numCols; j++) {
                const localScope = {
                    ...scope,
                    [rVar]: rList[i],
                    [cVar]: cList[j]
                };
                const val = evalAst(exprAst, localScope);
                row.push(typeof val === 'number' && !isNaN(val) ? val : 0);
            }
            mat.push(row);
        }

        return mat;
    }

    /**
     * Formata matriz para visualização elegante em LaTeX e saída textual
     */
    static formatMatrixDisplay(m: number[][]): string {
        if (!this.isMatrix(m)) return '[]';
        const rowsStr = m.map(row => row.join(', ')).join('], [');
        return `[[${rowsStr}]]`;
    }
}
