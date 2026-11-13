/**
 * PointEngine: Álgebra Vetorial e Geometria de Pontos Estilo Desmos (Fase 3 do plano de reforma)
 * Suporta soma, subtração, escalação, produtos escalar e vetorial, distâncias,
 * rotações perpendiculares e acessores de coordenadas.
 */

import { DesmosSemanticError } from './policy';

export interface Point {
    x: number;
    y: number;
    z?: number;
}

export class PointEngine {
    /**
     * Verifica se o valor é uma instância de Ponto 2D ou 3D
     */
    static isPoint(val: any): boolean {
        return (
            typeof val === 'object' &&
            val !== null &&
            !Array.isArray(val) &&
            'x' in val &&
            'y' in val &&
            typeof val.x === 'number' &&
            typeof val.y === 'number'
        );
    }

    /**
     * Soma vetorial de dois pontos: (x1, y1) + (x2, y2) = (x1 + x2, y1 + y2)
     */
    static add(p1: Point, p2: Point): Point {
        const res: Point = {
            x: Number((p1.x + p2.x).toPrecision(12)),
            y: Number((p1.y + p2.y).toPrecision(12))
        };
        if (p1.z !== undefined || p2.z !== undefined) {
            res.z = Number(((p1.z || 0) + (p2.z || 0)).toPrecision(12));
        }
        return res;
    }

    /**
     * Subtração vetorial de dois pontos: (x1, y1) - (x2, y2) = (x1 - x2, y1 - y2)
     */
    static subtract(p1: Point, p2: Point): Point {
        const res: Point = {
            x: Number((p1.x - p2.x).toPrecision(12)),
            y: Number((p1.y - p2.y).toPrecision(12))
        };
        if (p1.z !== undefined || p2.z !== undefined) {
            res.z = Number(((p1.z || 0) - (p2.z || 0)).toPrecision(12));
        }
        return res;
    }

    /**
     * Escalação de ponto por escalar: c * (x, y) = (c*x, c*y)
     */
    static scale(p: Point, scalar: number): Point {
        const res: Point = {
            x: Number((p.x * scalar).toPrecision(12)),
            y: Number((p.y * scalar).toPrecision(12))
        };
        if (p.z !== undefined) {
            res.z = Number((p.z * scalar).toPrecision(12));
        }
        return res;
    }

    /**
     * Divisão de ponto por escalar: (x, y) / c = (x/c, y/c)
     */
    static divide(p: Point, scalar: number): Point {
        if (scalar === 0) {
            return { x: NaN, y: NaN, ...(p.z !== undefined ? { z: NaN } : {}) };
        }
        const res: Point = {
            x: Number((p.x / scalar).toPrecision(12)),
            y: Number((p.y / scalar).toPrecision(12))
        };
        if (p.z !== undefined) {
            res.z = Number((p.z / scalar).toPrecision(12));
        }
        return res;
    }

    /**
     * Negação vetorial: -(x, y) = (-x, -y)
     */
    static negate(p: Point): Point {
        return {
            x: -p.x === 0 ? 0 : -p.x,
            y: -p.y === 0 ? 0 : -p.y,
            ...(p.z !== undefined ? { z: -p.z === 0 ? 0 : -p.z } : {})
        };
    }

    /**
     * Produto escalar (dot product): (x1, y1) \cdot (x2, y2) = x1*x2 + y1*y2
     */
    static dot(p1: Point, p2: Point): number {
        let sum = p1.x * p2.x + p1.y * p2.y;
        if (p1.z !== undefined || p2.z !== undefined) {
            sum += (p1.z || 0) * (p2.z || 0);
        }
        return Number(sum.toPrecision(12));
    }

    /**
     * Produto vetorial (cross product) exclusivo para pontos/vetores 3D no estilo Desmos:
     * Lança DesmosSemanticError explícito para pontos 2D em vez de retornar determinante escalar silencioso.
     */
    static cross(p1: Point, p2: Point): Point {
        if (p1.z === undefined || p2.z === undefined) {
            throw new DesmosSemanticError(
                'O produto vetorial (\\times / cross) exige pontos 3D; não é possível calcular em pontos 2D.',
                'CROSS_PRODUCT_TYPE_ERROR'
            );
        }
        const z1 = p1.z;
        const z2 = p2.z;
        return {
            x: Number((p1.y * z2 - z1 * p2.y).toPrecision(12)),
            y: Number((z1 * p2.x - p1.x * z2).toPrecision(12)),
            z: Number((p1.x * p2.y - p1.y * p2.x).toPrecision(12))
        };
    }

    /**
     * Ponto médio entre dois pontos 2D ou 3D: midpoint(P1, P2)
     */
    static midpoint(p1: Point, p2: Point): Point {
        const res: Point = {
            x: Number(((p1.x + p2.x) / 2).toPrecision(12)),
            y: Number(((p1.y + p2.y) / 2).toPrecision(12))
        };
        if (p1.z !== undefined || p2.z !== undefined) {
            res.z = Number((((p1.z || 0) + (p2.z || 0)) / 2).toPrecision(12));
        }
        return res;
    }

    /**
     * Rotação perpendicular anti-horária de 90°: pointPerp(P) = (-y, x)
     */
    static perp(p: Point): Point {
        return {
            x: -p.y === 0 ? 0 : -p.y,
            y: p.x === 0 ? 0 : p.x,
            ...(p.z !== undefined ? { z: p.z } : {})
        };
    }

    /**
     * Distância euclidiana entre dois pontos
     */
    static distance(p1: Point, p2: Point): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Magnitude (norma euclidiana) do vetor
     */
    static magnitude(p: Point): number {
        const z = p.z || 0;
        return Math.sqrt(p.x * p.x + p.y * p.y + z * z);
    }

    /**
     * Formatação para exibição textual de ponto
     */
    static formatPointDisplay(p: Point): string {
        if (p.z !== undefined) {
            return `(${parseFloat(p.x.toFixed(3))}, ${parseFloat(p.y.toFixed(3))}, ${parseFloat(p.z.toFixed(3))})`;
        }
        return `(${parseFloat(p.x.toFixed(3))}, ${parseFloat(p.y.toFixed(3))})`;
    }
}
