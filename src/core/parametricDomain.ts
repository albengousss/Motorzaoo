/**
 * parametricDomain.ts - Domínios padrão paramétricos/polares, conversão polar implícita e regra de preenchimento CW/CCW.
 */

export const DEFAULT_PARAMETRIC_BOUNDS = {
    min: 0,
    max: 1,
    minExpr: '0',
    maxExpr: '1'
} as const;

export const DEFAULT_POLAR_BOUNDS = {
    min: 0,
    max: 12 * Math.PI,
    minExpr: '0',
    maxExpr: '12\\pi'
} as const;

export interface Point2DLike {
    x: number;
    y: number;
}

const DOMAIN_BOUND_OPS = new Set(['LessThan', 'LessEqual', 'GreaterThan', 'GreaterEqual', 'And']);

function defaultEvalDomainScalar(ast: any): number {
    if (typeof ast === 'number') return ast;
    if (typeof ast === 'string') {
        const clean = ast.replace(/[\{\}\\]/g, '').trim();
        if (clean === 'pi' || clean === 'π') return Math.PI;
        if (clean === 'e') return Math.E;
        const num = Number(clean);
        return clean !== '' && !Number.isNaN(num) ? num : NaN;
    }
    if (!Array.isArray(ast) || ast.length === 0) return NaN;
    const op = ast[0];
    if (op === 'Negate') return -defaultEvalDomainScalar(ast[1]);
    if (op === 'Add') return defaultEvalDomainScalar(ast[1]) + defaultEvalDomainScalar(ast[2]);
    if (op === 'Subtract') return defaultEvalDomainScalar(ast[1]) - defaultEvalDomainScalar(ast[2]);
    if (op === 'Multiply') return defaultEvalDomainScalar(ast[1]) * defaultEvalDomainScalar(ast[2]);
    if (op === 'Divide') {
        const d = defaultEvalDomainScalar(ast[2]);
        return d === 0 ? NaN : defaultEvalDomainScalar(ast[1]) / d;
    }
    return NaN;
}

/**
 * Extrai intervalo contínuo (ex: -2 < t < 2 ou 0 <= theta <= 12*pi) de uma AST relacional `ForDomain`.
 */
export function extractContinuousDomainFromAst(
    condAst: any,
    evalScalar: (ast: any) => number = defaultEvalDomainScalar
): {
    paramVar: string;
    tMin: number;
    tMax: number;
    hasLower: boolean;
    hasUpper: boolean;
    check: (val: number) => boolean;
} | null {
    if (!Array.isArray(condAst) || !DOMAIN_BOUND_OPS.has(condAst[0])) {
        return null;
    }

    const comparisons: Array<{ op: string; lhs: any; rhs: any }> = [];
    const collect = (n: any) => {
        if (!Array.isArray(n)) return;
        if (n[0] === 'And') {
            collect(n[1]);
            collect(n[2]);
        } else if (n[0] === 'LessThan' || n[0] === 'LessEqual' || n[0] === 'GreaterThan' || n[0] === 'GreaterEqual') {
            comparisons.push({ op: n[0], lhs: n[1], rhs: n[2] });
        }
    };
    collect(condAst);
    if (comparisons.length === 0) return null;

    let detectedVar: string | null = null;
    let lower = -Infinity;
    let upper = Infinity;
    let lowerStrict = false;
    let upperStrict = false;

    const cleanVarName = (v: any): string | null => {
        if (typeof v !== 'string') return null;
        const clean = v.replace(/[\{\}\\]/g, '').trim();
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(clean) ? clean : null;
    };

    for (const c of comparisons) {
        const lVar = cleanVarName(c.lhs);
        const rVar = cleanVarName(c.rhs);
        const lVal = evalScalar(c.lhs);
        const rVal = evalScalar(c.rhs);

        if (lVar && Number.isNaN(lVal) && !Number.isNaN(rVal)) {
            if (!detectedVar) detectedVar = lVar;
            if (detectedVar !== lVar) return null;
            if (c.op === 'LessThan' || c.op === 'LessEqual') {
                if (rVal < upper) {
                    upper = rVal;
                    upperStrict = c.op === 'LessThan';
                }
            } else {
                if (rVal > lower) {
                    lower = rVal;
                    lowerStrict = c.op === 'GreaterThan';
                }
            }
        } else if (rVar && Number.isNaN(rVal) && !Number.isNaN(lVal)) {
            if (!detectedVar) detectedVar = rVar;
            if (detectedVar !== rVar) return null;
            if (c.op === 'LessThan' || c.op === 'LessEqual') {
                if (lVal > lower) {
                    lower = lVal;
                    lowerStrict = c.op === 'LessThan';
                }
            } else {
                if (lVal < upper) {
                    upper = lVal;
                    upperStrict = c.op === 'GreaterThan';
                }
            }
        } else {
            return null;
        }
    }

    if (!detectedVar) return null;
    const hasLower = Number.isFinite(lower);
    const hasUpper = Number.isFinite(upper);
    const effectiveMin = hasLower ? lower : (hasUpper ? upper - 20 : 0);
    const effectiveMax = hasUpper ? upper : (hasLower ? lower + 20 : 1);

    const check = (val: number): boolean => {
        if (!Number.isFinite(val)) return false;
        if (hasLower) {
            if (lowerStrict ? val <= lower : val < lower) return false;
        }
        if (hasUpper) {
            if (upperStrict ? val >= upper : val > upper) return false;
        }
        return true;
    };

    return {
        paramVar: detectedVar,
        tMin: effectiveMin,
        tMax: effectiveMax,
        hasLower,
        hasUpper,
        check
    };
}

/**
 * Verifica se uma AST contém coordenadas polares implícitas (`r` ou `theta`) livres (não sombreadas).
 */
export function astUsesPolarSpatialCoord(ast: any, boundVars: Set<string> = new Set()): boolean {
    if (typeof ast === 'string') {
        const clean = ast.replace(/[\{\}\\]/g, '').trim();
        const normalized = clean === 'θ' ? 'theta' : clean;
        if (boundVars.has(normalized)) return false;
        return normalized === 'r' || normalized === 'theta';
    }
    if (!Array.isArray(ast) || ast.length === 0) return false;
    const op = ast[0];
    if (op === 'Dot' || op === 'PropertyAccess') {
        return astUsesPolarSpatialCoord(ast[1], boundVars);
    }
    if (op === 'Comprehension' || op === 'MatrixComprehension' || op === 'With') {
        const nextBound = new Set(boundVars);
        const rawBindings = Array.isArray(ast[2]) ? ast[2] : [];
        for (const b of rawBindings) {
            if (Array.isArray(b)) {
                if (astUsesPolarSpatialCoord(b[1], boundVars)) return true;
                if (typeof b[0] === 'string') nextBound.add(b[0].trim());
            }
        }
        return astUsesPolarSpatialCoord(ast[1], nextBound);
    }
    if ((op === 'Sum' || op === 'Prod' || op === 'Integrate') && typeof ast[2] === 'string') {
        const nextBound = new Set(boundVars);
        nextBound.add(ast[2].trim());
        for (let i = 3; i < ast.length; i++) {
            if (astUsesPolarSpatialCoord(ast[i], boundVars)) return true;
        }
        return astUsesPolarSpatialCoord(ast[1], nextBound);
    }
    for (let i = 1; i < ast.length; i++) {
        if (astUsesPolarSpatialCoord(ast[i], boundVars)) return true;
    }
    return false;
}

/**
 * Converte equações polares implícitas (em `r` e `theta`) para AST Cartesiana equivalente em `(x, y)`:
 * - `r` -> `sqrt(x^2 + y^2)`
 * - `theta` -> `atan(y, x)` (compatível com WebGL e ImplicitEngine em radianos e graus)
 */
export function rewritePolarImplicitAst(ast: any, boundVars: Set<string> = new Set()): any {
    if (typeof ast === 'string') {
        const clean = ast.replace(/[\{\}\\]/g, '').trim();
        const normalized = clean === 'θ' ? 'theta' : clean;
        if (!boundVars.has(normalized)) {
            if (normalized === 'r') {
                return ['Sqrt', ['Add', ['Power', 'x', 2], ['Power', 'y', 2]]];
            }
            if (normalized === 'theta') {
                return ['Atan', 'y', 'x'];
            }
        }
        return ast;
    }
    if (!Array.isArray(ast) || ast.length === 0) return ast;

    const op = ast[0];
    if (op === 'Dot' || op === 'PropertyAccess') {
        return [op, rewritePolarImplicitAst(ast[1], boundVars), ast[2]];
    }
    if (op === 'Comprehension' || op === 'MatrixComprehension' || op === 'With') {
        const nextBound = new Set(boundVars);
        const rawBindings = Array.isArray(ast[2]) ? ast[2] : [];
        const mappedBindings = rawBindings.map((b: any) => {
            if (!Array.isArray(b)) return b;
            const rhs = rewritePolarImplicitAst(b[1], boundVars);
            if (typeof b[0] === 'string') nextBound.add(b[0].trim());
            return [b[0], rhs];
        });
        return [op, rewritePolarImplicitAst(ast[1], nextBound), mappedBindings];
    }
    if ((op === 'Sum' || op === 'Prod' || op === 'Integrate') && typeof ast[2] === 'string') {
        const nextBound = new Set(boundVars);
        nextBound.add(ast[2].trim());
        return [
            op,
            rewritePolarImplicitAst(ast[1], nextBound),
            ast[2],
            ...ast.slice(3).map(child => rewritePolarImplicitAst(child, boundVars))
        ];
    }

    return [op, ...ast.slice(1).map(child => rewritePolarImplicitAst(child, boundVars))];
}

/**
 * Divide uma sequência de pontos em subcaminhos contínuos separados por quebras `NaN` (ex: `(0/0, 0/0)`).
 */
export function splitSubpathsAtBreaks(points: Point2DLike[]): Point2DLike[][] {
    const subpaths: Point2DLike[][] = [];
    let current: Point2DLike[] = [];
    for (const p of points) {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            if (current.length > 0) {
                subpaths.push(current);
                current = [];
            }
        } else {
            current.push(p);
        }
    }
    if (current.length > 0) subpaths.push(current);
    return subpaths;
}

/**
 * Calcula o índice de rotação (winding number) de um ponto `(px, py)` em relação a um polígono/curva fechada.
 * - Orientação anti-horária (CCW) produz +1 no interior
 * - Orientação horária (CW) produz -1 no interior
 */
export function computeSubpathWindingNumber(px: number, py: number, path: Point2DLike[]): number {
    if (!path || path.length < 3) return 0;
    let wn = 0;
    const isLeft = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
        (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);

    for (let i = 0; i < path.length; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % path.length];
        if (p1.y <= py) {
            if (p2.y > py && isLeft(p1.x, p1.y, p2.x, p2.y, px, py) > 0) {
                wn++;
            }
        } else {
            if (p2.y <= py && isLeft(p1.x, p1.y, p2.x, p2.y, px, py) < 0) {
                wn--;
            }
        }
    }
    return wn;
}

/**
 * Regra non-zero de preenchimento paramétrico estilo Desmos:
 * Um loop externo CCW (+1) combinado com um furo interno CW (-1) anula o winding number no interior (0 = não preenchido).
 */
export function isPointFilledNonZero(
    px: number,
    py: number,
    pointsOrSubpaths: Point2DLike[] | Point2DLike[][]
): boolean {
    const subpaths = Array.isArray(pointsOrSubpaths[0])
        ? (pointsOrSubpaths as Point2DLike[][])
        : splitSubpathsAtBreaks(pointsOrSubpaths as Point2DLike[]);
    let totalWinding = 0;
    for (const sub of subpaths) {
        totalWinding += computeSubpathWindingNumber(px, py, sub);
    }
    return totalWinding !== 0;
}
