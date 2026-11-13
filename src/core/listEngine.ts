/**
 * ListEngine: Motor Vetorial de Listas, Sequências Sintéticas, Broadcasting e Compreensões
 * Implementa a especificação completa de listas do Desmos (Fase 2 do plano de reforma).
 */

import { DesmosSemanticError } from './policy';

export class ListEngine {
    public static readonly MAX_ELEMENTS = 10000;
    public static angleModeProvider?: () => 'radians' | 'degrees';

    /**
     * Gera sequências sintéticas [a...b] ou [a, c...b]
     * - [a...b]: passo padrão (+1 se a <= b, -1 se a > b)
     * - [a, c...b]: passo deduzido d = c - a
     * - Salvaguarda rígida contra loops infinitos (teto de 10.000 elementos)
     */
    static generateRange(start: number, end: number, step?: number): number[] {
        if (!isFinite(start) || !isFinite(end) || (step !== undefined && !isFinite(step))) {
            return [];
        }

        let effectiveStep: number;
        if (step !== undefined) {
            effectiveStep = step;
        } else {
            effectiveStep = start <= end ? 1 : -1;
        }

        // Se passo for zero, retorna apenas o valor inicial
        if (effectiveStep === 0) {
            return [start];
        }

        // Se a direção do passo contradiz os limites, retorna lista vazia (Padrão Desmos)
        if (effectiveStep > 0 && start > end) return [];
        if (effectiveStep < 0 && start < end) return [];

        const result: number[] = [];
        const eps = 1e-9;
        let count = 0;

        if (effectiveStep > 0) {
            for (let val = start; val <= end + eps; count++) {
                // Arredondamento limpo para evitar drift de ponto flutuante IEEE-754 (ex: 0.1 + 0.2)
                const cleanVal = Number((start + count * effectiveStep).toPrecision(12));
                if (cleanVal > end + eps) break;
                if (count >= ListEngine.MAX_ELEMENTS) {
                    throw new DesmosSemanticError('As listas não podem ter mais que 10.000 elementos.', 'LIST_LIMIT_EXCEEDED');
                }
                result.push(cleanVal);
                val = cleanVal + effectiveStep;
            }
        } else {
            for (let val = start; val >= end - eps; count++) {
                const cleanVal = Number((start + count * effectiveStep).toPrecision(12));
                if (cleanVal < end - eps) break;
                if (count >= ListEngine.MAX_ELEMENTS) {
                    throw new DesmosSemanticError('As listas não podem ter mais que 10.000 elementos.', 'LIST_LIMIT_EXCEEDED');
                }
                result.push(cleanVal);
                val = cleanVal + effectiveStep;
            }
        }

        return result;
    }

    /**
     * Aplica uma operação escalar binária
     */
    static applyScalarBinary(op: string, a: any, b: any, realPowFn: (b: number, e: number) => number): any {
        if (op === 'Add') return a + b;
        if (op === 'Subtract') return a - b;
        if (op === 'Multiply') return a * b;
        if (op === 'Divide') {
            if (b === 0) return a === 0 ? NaN : (a > 0 ? Infinity : -Infinity);
            return a / b;
        }
        if (op === 'Power') return realPowFn(a, b);
        if (op === 'Equal') {
            // Em IEEE-754, NaN === NaN é false
            if (typeof a === 'number' && isNaN(a)) return false;
            if (typeof b === 'number' && isNaN(b)) return false;
            return a === b;
        }
        if (op === 'NotEqual') {
            if (typeof a === 'number' && isNaN(a)) return true;
            if (typeof b === 'number' && isNaN(b)) return true;
            return a !== b;
        }
        if (op === 'LessThan') return a < b;
        if (op === 'GreaterThan') return a > b;
        if (op === 'LessEqual') return a <= b;
        if (op === 'GreaterEqual') return a >= b;
        if (op === 'And') return Boolean(a) && Boolean(b);
        if (op === 'Or') return Boolean(a) || Boolean(b);
        return NaN;
    }

    /**
     * Broadcasting Binário Universal com Truncamento no Menor Comprimento (Padrão Desmos)
     * - Escalar + Lista: mapeia escalar sobre todos os itens
     * - Lista + Escalar: mapeia cada item sobre o escalar
     * - Lista + Lista: trunca estritamente em min(|L1|, |L2|)
     */
    static broadcastBinary(op: string, a: any, b: any, realPowFn: (b: number, e: number) => number): any {
        const isArrA = Array.isArray(a);
        const isArrB = Array.isArray(b);

        if (isArrA && isArrB) {
            const minLen = Math.min(a.length, b.length);
            const res: any[] = new Array(minLen);
            for (let i = 0; i < minLen; i++) {
                res[i] = this.applyScalarBinary(op, a[i], b[i], realPowFn);
            }
            return res;
        }

        if (isArrA && !isArrB) {
            return a.map((val: any) => this.applyScalarBinary(op, val, b, realPowFn));
        }

        if (!isArrA && isArrB) {
            return b.map((val: any) => this.applyScalarBinary(op, a, val, realPowFn));
        }

        return this.applyScalarBinary(op, a, b, realPowFn);
    }

    /**
     * Aplica uma operação matemática unária
     */
    static applyScalarUnary(op: string, a: any): any {
        if (typeof a !== 'number') a = Number(a);
        if (op === 'Negate') return -a;
        if (op === 'Abs') return Math.abs(a);
        if (op === 'Sqrt') return Math.sqrt(a);
        if (op === 'Cbrt') return Math.cbrt(a);
        const isDeg = ListEngine.angleModeProvider ? ListEngine.angleModeProvider() === 'degrees' : false;
        const toRad = (x: number) => isDeg ? x * (Math.PI / 180) : x;
        const fromRad = (x: number) => isDeg ? x * (180 / Math.PI) : x;

        if (op === 'Sin') return Math.sin(toRad(a));
        if (op === 'Cos') return Math.cos(toRad(a));
        if (op === 'Tan') return Math.tan(toRad(a));
        if (op === 'Sec') return 1 / Math.cos(toRad(a));
        if (op === 'Csc') return 1 / Math.sin(toRad(a));
        if (op === 'Cot') return 1 / Math.tan(toRad(a));
        if (op === 'Sinh') return Math.sinh(a);
        if (op === 'Cosh') return Math.cosh(a);
        if (op === 'Tanh') return Math.tanh(a);
        if (op === 'Asinh') return Math.asinh(a);
        if (op === 'Acosh') return Math.acosh(a);
        if (op === 'Atanh') return Math.atanh(a);
        if (op === 'Asin') return fromRad(Math.asin(a));
        if (op === 'Acos') return fromRad(Math.acos(a));
        if (op === 'Atan') return fromRad(Math.atan(a));
        if (op === 'Asec') return fromRad(Math.acos(1 / a));
        if (op === 'Acsc') return fromRad(Math.asin(1 / a));
        if (op === 'Acot') return fromRad(Math.atan(1 / a));
        if (op === 'Ln') return Math.log(a);
        if (op === 'Log') return Math.log10(a);
        if (op === 'Exp') return Math.exp(a);
        return NaN;
    }

    /**
     * Broadcasting Unário Universal
     */
    static broadcastUnary(op: string, a: any): any {
        if (Array.isArray(a)) {
            return a.map(val => this.applyScalarUnary(op, val));
        }
        return this.applyScalarUnary(op, a);
    }

    /**
     * Indexação, Fatiamento e Filtros Booleanos com Padrão Desmos
     * - 1-based indexing: L[1]
     * - Múltiplos índices: L[1, 3, 5] ou L[M]
     * - Slices: L[...4], L[3...], L[2...5]
     * - Filtros: L[L > 0], L[L = 5], L[L != 2], L[L > -3 and L < 5]
     * - Limpeza IEEE-754: L[L = L] (remove NaNs), L[-inf < L < inf] (remove infinitos e NaNs)
     */
    static evaluateIndex(
        target: any,
        indexNode: any,
        scope: Record<string, any>,
        evalAst: (ast: any, s: Record<string, any>) => any,
        targetVarName?: string
    ): any {
        if (!Array.isArray(target)) {
            return NaN;
        }

        // Caso 1: Fatiamento explícito ["Slice", startNode, endNode]
        if (Array.isArray(indexNode) && indexNode[0] === 'Slice') {
            const rawStart = indexNode[1] !== null && indexNode[1] !== undefined ? evalAst(indexNode[1], scope) : 1;
            const rawEnd = indexNode[2] !== null && indexNode[2] !== undefined ? evalAst(indexNode[2], scope) : target.length;
            
            const start1Based = isFinite(rawStart) ? Math.floor(rawStart) : 1;
            const end1Based = isFinite(rawEnd) ? Math.floor(rawEnd) : target.length;

            const startIdx = Math.max(0, start1Based - 1);
            const endIdx = Math.min(target.length, end1Based);

            if (startIdx >= endIdx) return [];
            return target.slice(startIdx, endIdx);
        }

        // Caso 2: Filtro condicional booleano
        // Se for um nó de comparação (GreaterThan, LessThan, Equal, NotEqual, And, Or, etc.)
        const compOps = new Set(['GreaterThan', 'LessThan', 'GreaterEqual', 'LessEqual', 'Equal', 'NotEqual', 'And', 'Or']);
        if (Array.isArray(indexNode) && compOps.has(indexNode[0])) {
            const filtered: any[] = [];
            for (let i = 0; i < target.length; i++) {
                const elem = target[i];
                // Cria escopo local onde a variável da lista representa o elemento atual
                const localScope: Record<string, any> = { ...scope };
                if (targetVarName) localScope[targetVarName] = elem;
                localScope['x'] = elem;

                const condResult = evalAst(indexNode, localScope);
                if (Boolean(condResult)) {
                    filtered.push(elem);
                }
            }
            return filtered;
        }

        // Avalia o argumento de índice (ou lista de múltiplos índices, ex: L[1, 3, 5])
        let evaluatedIndex: any;
        if (Array.isArray(indexNode) && indexNode.length > 0 && typeof indexNode[0] !== 'string') {
            evaluatedIndex = indexNode.map(n => evalAst(n, scope)).flat();
        } else {
            evaluatedIndex = evalAst(indexNode, scope);
        }

        // Caso 3: Máscara booleana (array de booleans com mesmo tamanho da lista)
        if (Array.isArray(evaluatedIndex) && evaluatedIndex.length > 0 && typeof evaluatedIndex[0] === 'boolean') {
            const filtered: any[] = [];
            const minLen = Math.min(target.length, evaluatedIndex.length);
            for (let i = 0; i < minLen; i++) {
                if (evaluatedIndex[i] === true) {
                    filtered.push(target[i]);
                }
            }
            return filtered;
        }

        // Caso 4: Lista de índices numéricos (1-based), ex: L[[1, 3, 5]] ou L[M]
        if (Array.isArray(evaluatedIndex)) {
            return evaluatedIndex.map(idx => {
                const num = Math.floor(Number(idx));
                if (num >= 1 && num <= target.length) {
                    return target[num - 1];
                }
                return NaN;
            });
        }

        // Caso 5: Índice numérico único (1-based), ex: L[1], L[3]
        if (typeof evaluatedIndex === 'number' && !isNaN(evaluatedIndex)) {
            const idx = Math.floor(evaluatedIndex);
            if (idx >= 1 && idx <= target.length) {
                return target[idx - 1];
            }
            return NaN;
        }

        return NaN;
    }

    /**
     * Avaliação de Compreensões de Lista e Malhas Cartesianas de Pontos
     * Sintaxe: [expr for var1 = list1, var2 = list2, ...]
     * Ex: [2k for k = [1, 2, 3]] -> [2, 4, 6]
     * Ex: (x, y) for x = [1, 2], y = [3, 4] -> [(1, 3), (1, 4), (2, 3), (2, 4)]
     */
    static evaluateComprehension(
        exprAst: any,
        bindings: Array<[string, any]>,
        scope: Record<string, any>,
        evalAst: (ast: any, s: Record<string, any>) => any
    ): any[] {
        if (!bindings || bindings.length === 0) return [];

        // Avalia cada lista de ligação
        const evaluatedBindings: Array<{ varName: string, values: any[] }> = [];
        for (const [varName, listNode] of bindings) {
            const listVal = evalAst(listNode, scope);
            const arr = Array.isArray(listVal) ? listVal : [listVal];
            evaluatedBindings.push({ varName, values: arr });
        }

        const results: any[] = [];

        // Gera o produto cartesiano das variáveis
        const iterate = (bindingIndex: number, currentScope: Record<string, any>) => {
            if (bindingIndex >= evaluatedBindings.length) {
                if (results.length >= ListEngine.MAX_ELEMENTS) {
                    throw new DesmosSemanticError('As listas não podem ter mais que 10.000 elementos.', 'LIST_LIMIT_EXCEEDED');
                }
                const val = evalAst(exprAst, currentScope);
                results.push(val);
                return;
            }

            const current = evaluatedBindings[bindingIndex];
            for (let i = 0; i < current.values.length; i++) {
                const nextScope = { ...currentScope, [current.varName]: current.values[i] };
                iterate(bindingIndex + 1, nextScope);
            }
        };

        iterate(0, { ...scope });
        return results;
    }

    /**
     * Polígono baseado em listas de coordenadas (Padrão Desmos: polygon(XList, YList))
     */
    static createPolygon(xList: any[], yList: any[]): Array<{ x: number, y: number }> {
        if (!Array.isArray(xList) || !Array.isArray(yList)) return [];
        const minLen = Math.min(xList.length, yList.length);
        const pts: Array<{ x: number, y: number }> = [];
        for (let i = 0; i < minLen; i++) {
            const x = Number(xList[i]);
            const y = Number(yList[i]);
            if (isFinite(x) && isFinite(y)) {
                pts.push({ x, y });
            }
        }
        return pts;
    }

    /**
     * Média aritmética de uma lista numérica
     */
    static mean(list: any[]): number {
        if (!Array.isArray(list) || list.length === 0) return NaN;
        let sum = 0;
        for (let i = 0; i < list.length; i++) {
            const v = Number(list[i]);
            if (isNaN(v)) return NaN;
            sum += v;
        }
        return sum / list.length;
    }

    /**
     * Mediana de uma lista numérica
     */
    static median(list: any[]): number {
        if (!Array.isArray(list) || list.length === 0) return NaN;
        const sorted = list.map(Number);
        if (sorted.some(isNaN)) return NaN;
        sorted.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /**
     * Variância amostral (divisor n - 1)
     */
    static variance(list: any[]): number {
        if (!Array.isArray(list) || list.length < 2) return NaN;
        const m = this.mean(list);
        if (isNaN(m)) return NaN;
        let acc = 0;
        for (let i = 0; i < list.length; i++) {
            const d = Number(list[i]) - m;
            acc += d * d;
        }
        return acc / (list.length - 1);
    }

    /**
     * Desvio padrão amostral (divisor n - 1)
     */
    static stdev(list: any[]): number {
        const v = this.variance(list);
        return isNaN(v) ? NaN : Math.sqrt(v);
    }

    /**
     * Variância populacional (divisor n)
     */
    static varp(list: any[]): number {
        if (!Array.isArray(list) || list.length === 0) return NaN;
        const m = this.mean(list);
        if (isNaN(m)) return NaN;
        let acc = 0;
        for (let i = 0; i < list.length; i++) {
            const d = Number(list[i]) - m;
            acc += d * d;
        }
        return acc / list.length;
    }

    /**
     * Desvio padrão populacional (divisor n)
     */
    static stdevp(list: any[]): number {
        const v = this.varp(list);
        return isNaN(v) ? NaN : Math.sqrt(v);
    }

    /**
     * Mean Absolute Deviation (padrão Desmos): mean(|L - mean(L)|)
     */
    static mad(list: any[]): number {
        if (!Array.isArray(list) || list.length === 0) return NaN;
        const m = this.mean(list);
        if (isNaN(m)) return NaN;
        let acc = 0;
        for (let i = 0; i < list.length; i++) {
            acc += Math.abs(Number(list[i]) - m);
        }
        return acc / list.length;
    }

    /**
     * Quantil por interpolação linear (padrão Desmos: idx = p * (n - 1), p in [0, 1])
     */
    static quantile(list: any[], pRaw: any): any {
        if (!Array.isArray(list) || list.length === 0) return Array.isArray(pRaw) ? pRaw.map(() => NaN) : NaN;
        const sorted = list.map(Number);
        if (sorted.some(isNaN)) return Array.isArray(pRaw) ? pRaw.map(() => NaN) : NaN;
        sorted.sort((a, b) => a - b);

        const computeOne = (pVal: number): number => {
            if (isNaN(pVal) || pVal < 0 || pVal > 1) return NaN;
            if (sorted.length === 1) return sorted[0];
            const idx = pVal * (sorted.length - 1);
            const lo = Math.floor(idx);
            const hi = Math.ceil(idx);
            const frac = idx - lo;
            return sorted[lo] * (1 - frac) + sorted[hi] * frac;
        };

        if (Array.isArray(pRaw)) return pRaw.map(v => computeOne(Number(v)));
        return computeOne(Number(pRaw));
    }

    /**
     * Quartis (padrão Desmos/Tukey: divide ao meio pela mediana excluindo a mediana ímpar)
     */
    static quartile(list: any[], qRaw: any): any {
        if (!Array.isArray(list) || list.length === 0) return Array.isArray(qRaw) ? qRaw.map(() => NaN) : NaN;
        const sorted = list.map(Number);
        if (sorted.some(isNaN)) return Array.isArray(qRaw) ? qRaw.map(() => NaN) : NaN;
        sorted.sort((a, b) => a - b);

        const n = sorted.length;
        const halfLen = Math.floor(n / 2);
        const lowerHalf = sorted.slice(0, halfLen);
        const upperHalf = sorted.slice(n - halfLen);

        const computeOne = (qVal: number): number => {
            if (!Number.isInteger(qVal) || qVal < 0 || qVal > 4) return NaN;
            if (n === 1) return sorted[0];
            if (qVal === 0) return sorted[0];
            if (qVal === 4) return sorted[n - 1];
            if (qVal === 2) return this.median(sorted);
            if (qVal === 1) return this.median(lowerHalf);
            if (qVal === 3) return this.median(upperHalf);
            return NaN;
        };

        if (Array.isArray(qRaw)) return qRaw.map(v => computeOne(Number(v)));
        return computeOne(Number(qRaw));
    }

    /**
     * Covariância amostral (divisor n - 1)
     */
    static cov(a: any[], b: any[]): number {
        if (!Array.isArray(a) || !Array.isArray(b)) return NaN;
        const n = Math.min(a.length, b.length);
        if (n < 2) return NaN;
        const ax = a.slice(0, n).map(Number);
        const bx = b.slice(0, n).map(Number);
        if (ax.some(isNaN) || bx.some(isNaN)) return NaN;
        const ma = ax.reduce((s, v) => s + v, 0) / n;
        const mb = bx.reduce((s, v) => s + v, 0) / n;
        let acc = 0;
        for (let i = 0; i < n; i++) acc += (ax[i] - ma) * (bx[i] - mb);
        return acc / (n - 1);
    }

    /**
     * Covariância populacional (divisor n)
     */
    static covp(a: any[], b: any[]): number {
        if (!Array.isArray(a) || !Array.isArray(b)) return NaN;
        const n = Math.min(a.length, b.length);
        if (n < 1) return NaN;
        const ax = a.slice(0, n).map(Number);
        const bx = b.slice(0, n).map(Number);
        if (ax.some(isNaN) || bx.some(isNaN)) return NaN;
        const ma = ax.reduce((s, v) => s + v, 0) / n;
        const mb = bx.reduce((s, v) => s + v, 0) / n;
        let acc = 0;
        for (let i = 0; i < n; i++) acc += (ax[i] - ma) * (bx[i] - mb);
        return acc / n;
    }

    /**
     * Coeficiente de correlação de Pearson: corr(A, B)
     */
    static corr(a: any[], b: any[]): number {
        if (!Array.isArray(a) || !Array.isArray(b)) return NaN;
        const n = Math.min(a.length, b.length);
        if (n < 2) return NaN;
        const ax = a.slice(0, n).map(Number);
        const bx = b.slice(0, n).map(Number);
        if (ax.some(isNaN) || bx.some(isNaN)) return NaN;
        const ma = ax.reduce((s, v) => s + v, 0) / n;
        const mb = bx.reduce((s, v) => s + v, 0) / n;
        let num = 0, ssA = 0, ssB = 0;
        for (let i = 0; i < n; i++) {
            const da = ax[i] - ma;
            const db = bx[i] - mb;
            num += da * db;
            ssA += da * da;
            ssB += db * db;
        }
        const denom = Math.sqrt(ssA * ssB);
        return denom === 0 ? NaN : num / denom;
    }

    /**
     * Coeficiente de correlação de Spearman com ranks médios para empates
     */
    static spearman(a: any[], b: any[]): number {
        if (!Array.isArray(a) || !Array.isArray(b)) return NaN;
        const n = Math.min(a.length, b.length);
        if (n < 2) return NaN;
        const rank = (arr: number[]): number[] => {
            const indexed = arr.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
            const ranks = new Array<number>(arr.length);
            let i = 0;
            while (i < indexed.length) {
                let j = i;
                while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
                const avgRank = (i + j) / 2 + 1;
                for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
                i = j + 1;
            }
            return ranks;
        };
        const ax = a.slice(0, n).map(Number);
        const bx = b.slice(0, n).map(Number);
        if (ax.some(isNaN) || bx.some(isNaN)) return NaN;
        return this.corr(rank(ax), rank(bx));
    }

    /**
     * Gerador determinístico de números aleatórios (padrão Desmos):
     * - random() -> float [0, 1)
     * - random(n) -> lista de n floats [0, 1)
     * - random(n, seed) -> lista determinística de n floats [0, 1)
     * - random(L) -> 1 elemento aleatório de L
     * - random(L, n) -> lista de n elementos amostrados de L
     * - random(L, n, seed) -> amostragem determinística com semente
     */
    static random(...args: any[]): any {
        const makePrng = (seedInput?: any): (() => number) => {
            if (seedInput === undefined || seedInput === null || (typeof seedInput === 'number' && isNaN(seedInput))) {
                return () => Math.random();
            }
            let h = 2166136261 >>> 0;
            const seedStr = String(seedInput);
            for (let i = 0; i < seedStr.length; i++) {
                h ^= seedStr.charCodeAt(i);
                h = Math.imul(h, 16777619) >>> 0;
            }
            let state = (h || 0x9e3779b9) >>> 0;
            return () => {
                state = (state + 0x6d2b79f5) | 0;
                let t = Math.imul(state ^ (state >>> 15), 1 | state);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        };

        if (args.length === 0) {
            return Math.random();
        }
        const first = args[0];
        if (Array.isArray(first)) {
            if (first.length === 0) return args.length === 1 ? NaN : [];
            if (args.length === 1) {
                return first[Math.floor(Math.random() * first.length)];
            }
            const count = Math.max(0, Math.floor(Number(args[1])));
            if (isNaN(count)) return NaN;
            if (count > ListEngine.MAX_ELEMENTS) {
                throw new DesmosSemanticError('As listas não podem ter mais que 10.000 elementos.', 'LIST_LIMIT_EXCEEDED');
            }
            const rng = makePrng(args.length >= 3 ? args[2] : undefined);
            const out: any[] = [];
            for (let i = 0; i < count; i++) {
                out.push(first[Math.floor(rng() * first.length)]);
            }
            return out;
        }

        const count = Math.max(0, Math.floor(Number(first)));
        if (isNaN(count)) return NaN;
        if (count > ListEngine.MAX_ELEMENTS) {
            throw new DesmosSemanticError('As listas não podem ter mais que 10.000 elementos.', 'LIST_LIMIT_EXCEEDED');
        }
        const rng = makePrng(args.length >= 2 ? args[1] : undefined);
        const out: number[] = [];
        for (let i = 0; i < count; i++) out.push(rng());
        return out;
    }

    /**
     * Formatação amigável de listas no painel de resultados do usuário (Estilo Desmos)
     * Ex: "= [1, 2, 3, 4, 5]" ou "= [1, 2, 3, ...] (100 elementos)"
     */
    static formatListDisplay(list: any[]): string {
        if (!Array.isArray(list)) return '= []';
        const total = list.length;
        if (total === 0) return '= []';

        const formatVal = (v: any): string => {
            if (typeof v === 'number') {
                if (isNaN(v)) return 'indef';
                if (!isFinite(v)) return v > 0 ? '∞' : '-∞';
                return parseFloat(v.toFixed(6)).toString();
            }
            if (Array.isArray(v) && v[0] === 'Point') {
                return `(${v.slice(1).map(formatVal).join(', ')})`;
            }
            if (typeof v === 'object' && v !== null && 'x' in v && 'y' in v) {
                if ('z' in v && v.z !== undefined) {
                    return `(${formatVal(v.x)}, ${formatVal(v.y)}, ${formatVal(v.z)})`;
                }
                return `(${formatVal(v.x)}, ${formatVal(v.y)})`;
            }
            return String(v);
        };

        if (total <= 6) {
            return `= [${list.map(formatVal).join(', ')}]`;
        }

        const preview = list.slice(0, 5).map(formatVal).join(', ');
        return `= [${preview}, ...] (${total} elementos)`;
    }
}
