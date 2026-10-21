import { parseStepInput, formatStepForDisplay } from './core/stepParser';
import 'mathlive';
import { MathfieldElement } from 'mathlive';
import './style.css';

if (typeof window !== 'undefined' && (MathfieldElement as any)) {
    try {
        MathfieldElement.fontsDirectory = '/assets/fonts';
    } catch (_) {}
}
import { PrattParser } from './core/prattParser';
import { FaultTolerantParser } from './core/faultTolerantParser';
import { LatexNormalizer } from './core/latexNormalizer';
import { StateManager } from './core/stateManager';
import { HistoryManager } from './core/historyManager';
import { createIcons, icons } from 'lucide';

// Expõe createIcons nativo do bundle (eliminando dependência de CDN unpkg)
(window as any).lucide = {
    createIcons: (options?: any) => createIcons({ icons, ...options })
};

let validEquations: {id: string, ast?: any, isImplicit: boolean, operator: string, isEdo: boolean, isDerivative: boolean, derivVar?: string, isIvp?: boolean, isPoint?: boolean, pointX?: number, pointY?: number, pointLabel?: string, isParametric?: boolean, astX?: any, astY?: any, astZ?: any, isExplicitZ?: boolean, tMin?: number, tMax?: number, paramVar?: string, depVar?: string, indepVar?: string, condition?: (x: number, y: number, scope: any, t?: number) => boolean, name?: string, x0?: number, y0?: number, isHidden?: boolean, variable?: string, color?: string, lineStyle?: 'solid' | 'dashed' | 'dotted', lineWidth?: number, isTable?: boolean, tablePoints?: { x: number, y: number, rowIndex: number, tableBlockId: string }[], connectLines?: boolean, isPolygon?: boolean, isPointsList?: boolean, points?: { x: number, y: number }[]}[] = [];
let cachedNotablePointsKey = '';
let cachedNotablePointsList: NotablePointData[] = [];
let dragDistance = 0;
import { MathEngine } from './core/mathEngine';
import { ListEngine } from './core/listEngine';
import { MatrixEngine } from './core/matrixEngine';
import { PointEngine } from './core/pointEngine';
import { ImplicitEngine } from './core/implicitEngine';
import { Renderer } from './graphics/renderer';
import { GLRenderer } from './graphics/glRenderer';
import { Camera } from './graphics/camera';
import { Camera3D } from './graphics/camera3d';
import { Renderer3D } from './graphics/renderer3d';
import type { Surface3DItem } from './graphics/renderer3d';
import { ExpressionManager } from './ui/expressionManager';
import { MathAnalyzer } from './core/analyzer'; 
import { ODESolver } from './core/odeSolver';
import { CommandsGuideModal } from './ui/commandsGuideModal';

const renderer = new Renderer('graphCanvas');
const glRenderer = new GLRenderer('webglCanvas');
const renderer3d = new Renderer3D('canvas3d');
const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];

function resizeAll() {
    renderer.resize();
    glRenderer.resize();
    renderer3d.resize();
    StateManager.updateViewportDimensions(Camera.width, Camera.height);
    updateZoomHomeButton();
}

function getFreeVariables(ast: any, boundVars: string[] = []): string[] {
    const vars = new Set<string>();
    const standardNames = new Set(['pi', 'e', 'width', 'height', ...boundVars]);

    function walk(node: any) {
        if (typeof node === 'string') {
            const clean = node.trim();
            if (!standardNames.has(clean) && isNaN(Number(clean))) {
                vars.add(clean);
            }
        } else if (Array.isArray(node)) {
            const op = node[0];
            const isBuiltin = ['Add', 'Subtract', 'Multiply', 'Divide', 'Power', 'Negate', 'Sin', 'Cos', 'Tan', 'Sqrt', 'Abs', 'Exp', 'Log', 'Integrate', 'Point', 'Limit'].includes(op);
            if (!isBuiltin && typeof op === 'string' && !standardNames.has(op)) {
                vars.add(op);
            }
            if (op === 'Integrate') {
                const intVar = typeof node[2] === 'string' ? node[2].trim() : '';
                const innerBound = new Set([...standardNames, intVar, 'd', 'D']);
                const subWalk = (subNode: any) => {
                    if (typeof subNode === 'string') {
                        const clean = subNode.trim();
                        if (!innerBound.has(clean) && isNaN(Number(clean))) vars.add(clean);
                    } else if (Array.isArray(subNode)) {
                        for (let j = 1; j < subNode.length; j++) subWalk(subNode[j]);
                    }
                };
                if (node[1]) subWalk(node[1]);
                for (let i = 3; i < node.length; i++) walk(node[i]);
                return;
            }
            for (let i = 1; i < node.length; i++) {
                walk(node[i]);
            }
        }
    }
    walk(ast);
    return Array.from(vars);
}

let isShiftDown = false;
let mouseX = 0; let mouseY = 0;
let hoverX = false; let hoverY = false;

interface NotablePointData {
    mathX: number;
    mathY: number;
    type: 'root' | 'intercept' | 'extremum' | 'intersect' | 'trace' | 'point' | 'curve' | 'y-intercept' | 'extrema';
    color: string;
    curveF?: (x: number) => number;
    label?: string;
    slope?: number;
}

interface PinnedPoint {
    id: string;
    mathX: number;
    mathY: number;
    color: string;
    text?: string;
    type: string;
    curveF?: (x: number) => number;
    showTangent?: boolean;
    slope?: number;
}

interface DraggablePoint {
    mathX: number;
    mathY: number;
    color: string;
    type: 'table' | 'expression';
    tableBlockId?: string;
    rowIndex?: number;
    exprBlockId?: string;
}

let draggableCanvasPoints: DraggablePoint[] = [];
let activeDragPoint: DraggablePoint | null = null;
let isDraggingPoint = false;

let renderMemory_points: NotablePointData[] = [];
let pinnedPoints: PinnedPoint[] = [];
(window as any)._pinnedPoints = pinnedPoints;
(window as any)._setPinnedPoints = (pts: PinnedPoint[]) => { pinnedPoints = pts; (window as any)._pinnedPoints = pts; drawFrame(); };
let hoveredNotablePoint: NotablePointData | null = null;
let renderMemory_curves: {f: (x: number) => number, color: string}[] = [];
let renderMemory_segments: {x1: number, y1: number, x2: number, y2: number, color: string}[] = [];
let renderMemory_curve_points: {points: {x: number, y: number}[], color: string}[] = [];
let globalTracePoint: { x: number, y: number, color: string } | null = null;
let isTracing = false;


const tooltip = document.createElement('div');
tooltip.style.cssText = 'position: fixed; background: rgba(0, 0, 0, 0.75); color: white; padding: 4px 8px; border-radius: 4px; font-family: sans-serif; font-size: 13px; pointer-events: none; display: none; z-index: 2000; transform: translate(-50%, -100%); margin-top: -12px; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0px 2px 4px rgba(0,0,0,0.2);';
document.body.appendChild(tooltip);

// ─── CONSTANTES DO MÓDULO (fora do loop de render para não serem recriadas 60x/s) ───

/** Conjunto de todos os comandos CAS suportados (criado uma única vez) */
const casCommandsList = new Set([
    'factor', 'ifactor', 'cfactor', 'cifactor', 'expand', 'simplify',
    'polynomial', 'coefficients', 'degree', 'completesquare',
    'numerator', 'denominator', 'commondenominator', 'partialfractions',
    'substitute', 'leftside', 'rightside',
    'groebnerlex', 'groebnerlexdeg', 'groebnerdegrevlex', 'eliminate',
    'solve', 'csolve', 'solvecubic', 'solvequartic', 'plotsolve', 'root',
    'nsolve', 'nsolutions', 'min', 'max',
    'limit', 'limitabove', 'limitbelow', 'lim',
    'derivative', 'implicitderivative', 'nderivative', 'diff',
    'integral', 'integralsymbolic', 'integralbetween', 'nintegral', 'int', 'defint',
    'solveode', 'nsolveode', 'edo', 'resolvere', 'resolveredo',
    'taylor', 'taylorpolynomial', 'laplace', 'inverselaplace',
    'dimension', 'dot', 'cross', 'unitvector', 'unitperpendicularvector', 'perpendicularvector',
    'transpose', 'tran', 'matrixrank', 'rank', 'reducedrowechelonform', 'rref', 'invert', 'inv', 'characteristicpolynomial', 'minimalpolynomial',
    'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'jordandiagonalization', 'qrdecomposition', 'svd', 'ludecomposition',
    'isprime', 'nextprime', 'previousprime', 'primefactors', 'factors',
    'divisors', 'divisorslist', 'divisorssum',
    'gcd', 'lcm', 'extendedgcd',
    'div', 'mod', 'division', 'modularexponent', 'mixednumber', 'rationalize',
    'binomialdist', 'pascal', 'hypergeometric', 'poisson', 'zipf', 'normal', 'cauchy', 'exponential', 'weibull', 'gamma', 'chisquared', 'tdistribution',
    'determinant', 'det', 'trace', 'tr', 'applymatrix',
    'samplesd', 'covariance', 'variance', 'samplevariance', 'stdev', 'stddev', 'var',
    'mean', 'median', 'unique', 'frequency',
    'fitpoly', 'fitpow', 'fitexp', 'fitsin', 'fitlog', 'normalize',
    'setseed', 'randomuniform', 'randombetween', 'shuffle', 'randomelement', 'sample', 'randompolynomial',
    'sequence', 'iterationlist', 'element', 'first', 'last', 'take', 'append', 'flatten', 'length', 'size',
    'sum', 'product', 'prod', 'rootlist',
    'tocomplex', 'topoint', 'topolar', 'toexponential', 'nthroot',
    'intersect', 'radius', 'distance', 'angle', 'perpendicularbisector', 'applymatrix', 'reflect', 'rotate', 'shear', 'stretch', 'translate', 'infinitecone', 'surdtext', 'setviewdirection', 'setvisibleinview', 'attachcopytoview', 'setdecoration'
]);

/** Substitui variáveis definidas pelo utilizador com o prefixo usr_ para o Giac */
function prefixGiac(str: string): string {
    let res = str;
    // Remove delimitadores de LaTeX residuais de operadores e textos
    res = res.replace(/\\operatorname\{([^}]+)\}/gi, '$1').replace(/\\mathrm\{([^}]+)\}/gi, '$1').replace(/\\text\{([^}]+)\}/gi, '$1');

    // Transposta: (A+B)^T, (A+B)', A^T, A^{T}, A^{\top}, A^{\intercal}, A'
    res = res.replace(/\(([^)]+)\)\^\{?(?:T|\\top|intercal)\}?/g, 'tran($1)');
    res = res.replace(/\(([^)]+)\)'/g, 'tran($1)');
    res = res.replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?(?:T|\\top|intercal)\}?/g, 'tran($1)');
    res = res.replace(/([A-Za-z_][A-Za-z0-9_]*)'/g, 'tran($1)');

    // Inversa: (A*B)^{-1}, A^{-1}, A^-1, A^(-1), A^({-1})
    res = res.replace(/\(([^)]+)\)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)');
    res = res.replace(/([A-Za-z_][A-Za-z0-9_]*)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)');

    // Aliases CAS comuns e comandos puros do Desmos
    res = res.replace(/\btr\s*\(([^)]+)\)/gi, 'trace($1)');
    res = res.replace(/\\?det\s*\(([^)]+)\)/gi, 'det($1)');
    res = res.replace(/\bdeterminant\s*\(([^)]+)\)/gi, 'det($1)');
    res = res.replace(/\breducedrowechelonform\s*\(([^)]+)\)/gi, 'rref($1)');
    res = res.replace(/\bmatrixrank\s*\(([^)]+)\)/gi, 'rank($1)');
    res = res.replace(/\binvert\s*\(([^)]+)\)/gi, 'inv($1)');
    res = res.replace(/\btranspose\s*\(([^)]+)\)/gi, 'tran($1)');
    res = res.replace(/\beigenvalues\s*\(([^)]+)\)/gi, 'eigenvals($1)');
    res = res.replace(/\beigenvectors\s*\(([^)]+)\)/gi, 'eigenvects($1)');

    // Multiplicação escalar implícita (ex: 2A -> 2*A, 3.5B -> 3.5*B)
    res = res.replace(/(\d+(?:\.\d+)?)\s*([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

    // Símbolos de multiplicação LaTeX e unicode
    res = res.replace(/\\cdot/g, '*');
    res = res.replace(/\\times/g, '*');

    // Multiplicação matricial implícita entre variáveis matriciais: A B -> A * B ou AB -> A * B
    const knownVars = Object.keys(StateManager.giacDefinitions);
    for (const v1 of knownVars) {
        for (const v2 of knownVars) {
            res = res.replace(new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v1}\\s+${v2}(?=[^a-zA-Z_]|$)`, 'g'), `${v1}*${v2}`);
            if (v1.length === 1 && v2.length === 1 && v1 !== v2) {
                res = res.replace(new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v1}${v2}(?=[^a-zA-Z_]|$)`, 'g'), `${v1}*${v2}`);
            }
        }
    }

    const vars = [...knownVars];
    vars.sort((a, b) => b.length - a.length); // substitui as mais longas primeiro para evitar colisões
    for (const v of vars) {
        // Substitui a variável sem engolir se já estiver prefixada com usr_
        res = res.replace(new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v}(?=[^a-zA-Z_]|$)`, 'g'), `usr_${v}`);
    }
    return res;
}

/** Interpreta condições de domínio do tipo {x >= 0} ou {-2 <= x <= 2} ou {0 <= t <= 2pi} */
function parseDomainCondition(condRaw: string): { condition: (x: number, y: number, scope: any, t?: number) => boolean, tBounds?: { tMin: number, tMax: number } } | null {
    let cleanCond = condRaw.trim()
        .replace(/\\leq/g, '<=')
        .replace(/\\geq/g, '>=')
        .replace(/\\le/g, '<=')
        .replace(/\\ge/g, '>=')
        .replace(/\\pi/g, 'pi')
        .replace(/π/g, 'pi')
        .replace(/\\infty/g, 'infinity')
        .replace(/\\inf\b/g, 'infinity')
        .replace(/\binf\b/g, 'infinity');

    // 1. Desigualdade dupla: lower <= var <= upper (ex: -2 <= x <= 2, 0 <= t <= 2pi, -infinity <= t <= infinity)
    const doubleMatch = cleanCond.match(/^(.+?)\s*(<=|<)\s*([a-zA-Z_])\s*(<=|<)\s*(.+)$/);
    if (doubleMatch) {
        const lowerStr = doubleMatch[1].trim();
        const op1 = doubleMatch[2];
        const targetVar = doubleMatch[3];
        const op2 = doubleMatch[4];
        const upperStr = doubleMatch[5].trim();

        const isLowerInf = lowerStr.includes('infinity');
        const isUpperInf = upperStr.includes('infinity');
        const minInfVal = isLowerInf ? (lowerStr.startsWith('-') ? -Infinity : Infinity) : null;
        const maxInfVal = isUpperInf ? (upperStr.startsWith('-') ? -Infinity : Infinity) : null;

        let lowerAst: any = null;
        let upperAst: any = null;
        try {
            if (!isLowerInf) lowerAst = new PrattParser(lowerStr).parseExpression();
            if (!isUpperInf) upperAst = new PrattParser(upperStr).parseExpression();
        } catch(e) {
            console.warn('[Main] PrattParser failed parsing bounds in domain condition:', e);
        }

        if ((lowerAst !== null || isLowerInf) && (upperAst !== null || isUpperInf)) {
            const lowerF = lowerAst !== null ? MathEngine.compile(lowerAst) : () => minInfVal!;
            const upperF = upperAst !== null ? MathEngine.compile(upperAst) : () => maxInfVal!;

            let tBounds: { tMin: number, tMax: number } | undefined = undefined;
            if (targetVar === 't' || targetVar === 'theta') {
                const minVal = isLowerInf ? minInfVal! : lowerF(0, 0, StateManager.values);
                const maxVal = isUpperInf ? maxInfVal! : upperF(0, 0, StateManager.values);
                tBounds = { tMin: minVal, tMax: maxVal };
            }

            const condition = (x: number, y: number, scope: any, t?: number) => {
                const targetVal = targetVar === 'x' ? x : (targetVar === 'y' ? y : ((targetVar === 't' || targetVar === 'theta') ? (t ?? 0) : (scope[targetVar] ?? 0)));
                const lVal = isLowerInf ? minInfVal! : lowerF(0, 0, scope);
                const uVal = isUpperInf ? maxInfVal! : upperF(0, 0, scope);
                const ok1 = isLowerInf ? true : (op1 === '<=' ? lVal <= targetVal : lVal < targetVal);
                const ok2 = isUpperInf ? true : (op2 === '<=' ? targetVal <= uVal : targetVal < uVal);
                return ok1 && ok2;
            };

            return { condition, tBounds };
        }
    }

    // 2. Desigualdade simples: var >= bound ou var <= bound (ex: x >= 0, t <= 5, t >= -infinity)
    const singleMatch = cleanCond.match(/^([a-zA-Z_])\s*(<=|>=|<|>|==|=)\s*(.+)$/);
    if (singleMatch) {
        const targetVar = singleMatch[1];
        const op = singleMatch[2];
        const boundStr = singleMatch[3].trim();
        const isBoundInf = boundStr.includes('infinity');
        const infBoundVal = isBoundInf ? (boundStr.startsWith('-') ? -Infinity : Infinity) : null;

        let boundAst: any = null;
        try {
            if (!isBoundInf) boundAst = new PrattParser(boundStr).parseExpression();
        } catch(e) {
            console.warn('[Main] PrattParser failed parsing single bound in domain condition:', e);
        }

        if (boundAst !== null || isBoundInf) {
            const boundF = boundAst !== null ? MathEngine.compile(boundAst) : () => infBoundVal!;

            let tBounds: { tMin: number, tMax: number } | undefined = undefined;
            if (targetVar === 't' || targetVar === 'theta') {
                const val = isBoundInf ? infBoundVal! : boundF(0, 0, StateManager.values);
                if (op === '>=' || op === '>') tBounds = { tMin: val, tMax: Infinity };
                else if (op === '<=' || op === '<') tBounds = { tMin: -Infinity, tMax: val };
            }

            const condition = (x: number, y: number, scope: any, t?: number) => {
                const targetVal = targetVar === 'x' ? x : (targetVar === 'y' ? y : ((targetVar === 't' || targetVar === 'theta') ? (t ?? 0) : (scope[targetVar] ?? 0)));
                const bVal = isBoundInf ? infBoundVal! : boundF(0, 0, scope);
                if (op === '>=') return targetVal >= bVal;
                if (op === '>') return targetVal > bVal;
                if (op === '<=') return targetVal <= bVal;
                if (op === '<') return targetVal < bVal;
                if (op === '==' || op === '=') return Math.abs(targetVal - bVal) < 1e-4;
                return true;
            };

            return { condition, tBounds };
        }
    }

    // 3. Desigualdade simples invertida: bound <= var ou bound >= var (ex: 0 <= t, -5 <= t)
    const invSingleMatch = cleanCond.match(/^(.+?)\s*(<=|>=|<|>|==|=)\s*([a-zA-Z_])$/);
    if (invSingleMatch) {
        const boundStr = invSingleMatch[1].trim();
        const rawOp = invSingleMatch[2];
        const targetVar = invSingleMatch[3];
        // Inverte o operador: bound <= var  =>  var >= bound
        const op = rawOp === '<=' ? '>=' : (rawOp === '<' ? '>' : (rawOp === '>=' ? '<=' : (rawOp === '>' ? '<' : rawOp)));
        const isBoundInf = boundStr.includes('infinity');
        const infBoundVal = isBoundInf ? (boundStr.startsWith('-') ? -Infinity : Infinity) : null;

        let boundAst: any = null;
        try {
            if (!isBoundInf) boundAst = new PrattParser(boundStr).parseExpression();
        } catch(e) {
            console.warn('[Main] PrattParser failed parsing inverted bound in domain condition:', e);
        }

        if (boundAst !== null || isBoundInf) {
            const boundF = boundAst !== null ? MathEngine.compile(boundAst) : () => infBoundVal!;

            let tBounds: { tMin: number, tMax: number } | undefined = undefined;
            if (targetVar === 't' || targetVar === 'theta') {
                const val = isBoundInf ? infBoundVal! : boundF(0, 0, StateManager.values);
                if (op === '>=' || op === '>') tBounds = { tMin: val, tMax: Infinity };
                else if (op === '<=' || op === '<') tBounds = { tMin: -Infinity, tMax: val };
            }

            const condition = (x: number, y: number, scope: any, t?: number) => {
                const targetVal = targetVar === 'x' ? x : (targetVar === 'y' ? y : ((targetVar === 't' || targetVar === 'theta') ? (t ?? 0) : (scope[targetVar] ?? 0)));
                const bVal = isBoundInf ? infBoundVal! : boundF(0, 0, scope);
                if (op === '>=') return targetVal >= bVal;
                if (op === '>') return targetVal > bVal;
                if (op === '<=') return targetVal <= bVal;
                if (op === '<') return targetVal < bVal;
                if (op === '==' || op === '=') return Math.abs(targetVal - bVal) < 1e-4;
                return true;
            };

            return { condition, tBounds };
        }
    }

    return null;
}

let _rafPending = false;
let expressionsDirty = true;

function markExpressionsDirty() {
    expressionsDirty = true;
    scheduleFrame();
}

function scheduleFrame() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => { _rafPending = false; drawFrame(); });
}



function compileAllExpressions() {
    // Inicializa funções pré-compiladas do motor matemático (add, sub, mul, div, listEngine, matrixEngine, pointEngine, etc.)
    MathEngine.initCompiledFuncs();
    StateManager.updateViewportDimensions(Camera.width, Camera.height);

    const rawData = ExpressionManager.getAllExpressions();
    validEquations = [];
    const activeVars: string[] = ['width', 'height'];
    const definedUserFunctionNames = new Set<string>();
    const definedMatrixNames = new Set<string>();

    // 0. Pré-registro de Matrizes e Funções de Usuário (Suporte a Definição Fora de Ordem e Supressão de Sliders)
    rawData.forEach(item => {
        if (item.isMatrix && item.matrixName) {
            const rawName = item.matrixName.trim();
            const rightSide = item.rawAscii.substring(item.rawAscii.indexOf('=') + 1).trim();
            const funcMatch = rawName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)$/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const paramNames = funcMatch[2].split(',').map(s => s.trim());
                definedUserFunctionNames.add(funcName);
                try {
                    const ast = new PrattParser(rightSide).parseExpression();
                    MathEngine.userFunctions[funcName] = { params: paramNames, expr: rightSide, ast, blockId: item.id };
                    StateManager.userFunctions[funcName] = { params: paramNames, expr: rightSide, ast, blockId: item.id };
                    if (paramNames.length === 1) {
                        const p0 = paramNames[0];
                        MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, p0);
                        const d1 = MathEngine.createDerivativeFunction(ast, p0, 1);
                        const d2 = MathEngine.createDerivativeFunction(ast, p0, 2);
                        const d3 = MathEngine.createDerivativeFunction(ast, p0, 3);
                        MathEngine.compiledFuncs[`${funcName}'`] = (x: number, scope: any) => d1(x, 0, scope);
                        MathEngine.compiledFuncs[`${funcName}''`] = (x: number, scope: any) => d2(x, 0, scope);
                        MathEngine.compiledFuncs[`${funcName}'''`] = (x: number, scope: any) => d3(x, 0, scope);
                    } else if (paramNames.length > 1) {
                        MathEngine.compiledFuncs[funcName] = MathEngine.compileMultivariable(ast, paramNames);
                    }
                } catch (_) {}
                const giacDef = `usr_${funcName}(${paramNames.join(',')}):=${rightSide}`;
                if (StateManager.giacDefinitions[funcName] !== giacDef) {
                    StateManager.giacDefinitions[funcName] = giacDef;
                    StateManager.casSolutions = {};
                    MathEngine.askGiac(giacDef);
                }
            } else {
                definedMatrixNames.add(rawName);
                const giacDef = `usr_${rawName}:=${rightSide}`;
                if (StateManager.giacDefinitions[rawName] !== giacDef) {
                    StateManager.giacDefinitions[rawName] = giacDef;
                    StateManager.casSolutions = {};
                    MathEngine.askGiac(giacDef);
                }
            }
        } else if (!item.isMatrix && !item.isTable) {
            const ascii = item.rawAscii || '';
            const cleanStr = LatexNormalizer.normalize(ascii, item.latex, definedMatrixNames);
            const matrixAssignMatch = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(\[\[[\s\S]*\]\])$/);
            if (matrixAssignMatch) {
                const rawName = matrixAssignMatch[1].trim();
                const rightSide = matrixAssignMatch[2].trim();
                definedMatrixNames.add(rawName);
                const giacDef = "usr_" + rawName + ":=" + rightSide;
                if (StateManager.giacDefinitions[rawName] !== giacDef) {
                    StateManager.giacDefinitions[rawName] = giacDef;
                    StateManager.casSolutions = {};
                    MathEngine.askGiac(giacDef);
                }
            }
            const funcMatch = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)\s*=\s*(.+)$/);
            if (funcMatch) {
                const funcName = funcMatch[1].replace(/[\{\}\\]/g, '');
                const paramNames = funcMatch[2].split(',').map(s => s.trim().replace(/[\{\}\\]/g, ''));
                const expr = funcMatch[3].trim();
                definedUserFunctionNames.add(funcName);
                try {
                    const ast = new PrattParser(expr).parseExpression();
                    MathEngine.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                    StateManager.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                    if (paramNames.length === 1) {
                        MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramNames[0]);
                    } else if (paramNames.length > 1) {
                        MathEngine.compiledFuncs[funcName] = MathEngine.compileMultivariable(ast, paramNames);
                    }
                } catch (_) {}
            }
        }
    });

    // Sliders adicionados pelo usuário no Desmos são expressões de primeira classe (permanentes)
    // e nunca devem ser auto-deletados do painel de expressões ao compilar.

    rawData.forEach(item => {
        if (item.isTable) {
            if (item.tablePoints && item.tablePoints.length > 0) {
                validEquations.push({
                    color: item.color,
                    id: item.id,
                    isTable: true,
                    tablePoints: item.tablePoints,
                    connectLines: item.connectLines ?? false,
                    operator: '=',
                    isImplicit: false,
                    isEdo: false,
                    isDerivative: false,
                    isHidden: !item.visible,
                    lineStyle: item.lineStyle,
                    lineWidth: item.lineWidth
                });
            }
            return;
        }

        if (item.isMatrix && item.matrixName) {
            const rawName = item.matrixName.trim();
            const rightSide = item.rawAscii.substring(item.rawAscii.indexOf('=') + 1).trim();
            const funcMatch = rawName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)$/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const paramNames = funcMatch[2].split(',').map(s => s.trim());
                try {
                    const ast = new PrattParser(rightSide).parseExpression();
                    MathEngine.userFunctions[funcName] = { params: paramNames, expr: rightSide, ast, blockId: item.id };
                    StateManager.userFunctions[funcName] = { params: paramNames, expr: rightSide, ast, blockId: item.id };
                    if (paramNames.length === 1) {
                        MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramNames[0]);
                    } else if (paramNames.length > 1) {
                        MathEngine.compiledFuncs[funcName] = MathEngine.compileMultivariable(ast, paramNames);
                    }
                    ExpressionManager.setError(item.id, null);
                    ExpressionManager.setResult(item.id, '');
                } catch(e) {
                    ExpressionManager.setError(item.id, `Erro: ${(e as Error).message}`);
                }
            } else {
                ExpressionManager.setError(item.id, null);
                ExpressionManager.setResult(item.id, '');
            }
            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            return;
        }

        let ascii = item.rawAscii.trim() || (item.latex || '').trim();
        if (!ascii) {
            ExpressionManager.setResult(item.id, '');
            ExpressionManager.setError(item.id, null);
            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            ExpressionManager.processBlockState(item.id, '', {});
            return;
        }

        // Validação estrita de incompletude e diferencial obrigatório (Padrão Desmos)
        const incCheck = FaultTolerantParser.checkIncompleteStatus(item.latex || '', ascii);
        if (incCheck.isIncomplete) {
            ExpressionManager.setResult(item.id, '');
            ExpressionManager.setError(item.id, incCheck.warning);
            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            ExpressionManager.processBlockState(item.id, '', {});
            return;
        }
        // Sanitização e normalização centralizada via LatexNormalizer
        let cleanStr = LatexNormalizer.normalize(ascii, item.latex, definedMatrixNames);


        // Extração de restrições de domínio entre chaves: ex: y = x^2 {x >= 0} ou {0 <= t <= 2pi}
        let conditionFn: ((x: number, y: number, scope: any, t?: number) => boolean) | undefined = undefined;
        let explicitTBounds: { tMin: number, tMax: number } | undefined = undefined;
        const isMatrixDef = cleanStr.includes('{{') || cleanStr.includes('[[');
        if (!isMatrixDef) {
            const domainMatch = cleanStr.match(/(.+?)\s*\{([^}]+)\}\s*$/);
            if (domainMatch && /[<>]|\\le|\\ge|<=|>=/.test(domainMatch[2])) {
                const parsedCond = parseDomainCondition(domainMatch[2]);
                if (parsedCond) {
                    conditionFn = parsedCond.condition;
                    explicitTBounds = parsedCond.tBounds;
                    cleanStr = domainMatch[1].trim();
                }
            }
        }

        // Versão sem espaços APENAS para os testes de Regex (EDO, IVP, Associações)
        const noSpaceStr = cleanStr.replace(/\s+/g, '').replace(/²/g, '^2').replace(/³/g, '^3');

        // Parsing inicial para descobrir o tipo de comando
        let ast: any = null;
        let assignVarName: string | null = null;
        try {
            ast = new PrattParser(cleanStr).parseExpression();
        } catch(_) {
            // Live typing natural fallback
        }

        const funcDeclEarly = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)\s*=/);
        if (!ast && !funcDeclEarly) {
            const assignMatch = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (assignMatch) {
                try {
                    const rhsAst = new PrattParser(assignMatch[2].trim()).parseExpression();
                    if (rhsAst && MathEngine.isGiacCommand(rhsAst)) {
                        ast = rhsAst;
                        assignVarName = assignMatch[1];
                    }
                } catch(_) {
                    // Live typing natural fallback
                }
            }
        }

        if (ast && MathEngine.isGiacCommand(ast)) {
            const matrixOnlyCmdsEarly = new Set(['det', 'determinant', 'rref', 'reducedrowechelonform', 'trace', 'tr', 'matrixrank', 'rank', 'invert', 'inv', 'transpose', 'tran', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'ludecomposition', 'jordandiagonalization', 'index']);
            if (matrixOnlyCmdsEarly.has(ast[0].toLowerCase())) {
                const targetName = typeof ast[1] === 'string' ? ast[1].replace(/[\{\}\\]/g, '') : '';
                if (targetName && !definedMatrixNames.has(targetName)) {
                    ExpressionManager.setError(item.id, `Erro: Matriz "${targetName}" não definida`);
                    ExpressionManager.setResult(item.id, '- Erro no cálculo');
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                    return;
                }
            }

            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            const expandedAst = MathEngine.expandUserFunctions(ast);
            const giacQuery = MathEngine.formatForGiac(expandedAst);
            StateManager.activeGiacQuery[item.id] = giacQuery;
            let cached: any = StateManager.casSolutions[item.id];
            if (cached && (cached.result.includes('pnt') || cached.result.includes('point[') || cached.result.includes('point(') || cached.result.includes('536870912') || cached.result.includes('Erro'))) {
                delete StateManager.casSolutions[item.id];
                cached = undefined;
            }
            const isIntegralCmd = ast[0] === 'Integrate';
            const isDefiniteInt = isIntegralCmd && ast.length > 3;

            // Pré-avaliação numérica instantânea para integrais definidas
            let numIntegralVal: number | null = null;
            if (isDefiniteInt) {
                try {
                    const lowVal = MathEngine.evaluateAST(ast[3], StateManager.values);
                    const uppVal = MathEngine.evaluateAST(ast[4], StateManager.values);
                    const intVar = (typeof ast[2] === 'string' ? ast[2] : 'x');
                    const numRes = MathEngine.evaluateDefiniteIntegral(ast[1], lowVal, uppVal, intVar, StateManager.values);
                    if (!isNaN(numRes) && isFinite(numRes)) {
                        numIntegralVal = numRes;
                    }
                } catch(err) {
                    console.warn('[Main] Error evaluating numerical definite integral fallback:', err);
                }
            }

            const formatCasDisplay = (rawRes: string): string => {
                if (rawRes.includes('Erro') || rawRes.includes('pnt') || rawRes.includes('point[') || rawRes.includes('point(') || rawRes.includes('536870912')) {
                    if (numIntegralVal !== null) {
                        return `= ${parseFloat(numIntegralVal.toFixed(6))}`;
                    }
                    return '- Erro no cálculo';
                }
                let cleanRes = rawRes;
                if (isDefiniteInt && cleanRes.includes('=')) {
                    cleanRes = cleanRes.split('=')[0].trim();
                }
                if (isDefiniteInt) {
                    return `= ${cleanRes}`;
                }
                if (isIntegralCmd) {
                    if (!/[+\-]\s*c\b/i.test(cleanRes)) {
                        return `= ${cleanRes} + C`;
                    }
                }
                return `= ${cleanRes}`;
            };

            const updateSlidersForGiac = () => {
                if (isIntegralCmd) {
                    const intVar = (typeof ast[2] === 'string' ? ast[2] : 'x').toLowerCase();
                    const bound = new Set([intVar, 'd', 'x', 'y', 'z', 't', 'pi', 'e', ...Object.keys(StateManager.values), ...Object.keys(StateManager.giacDefinitions), ...definedMatrixNames]);
                    const freeInAst = getFreeVariables(ast, Array.from(bound));
                    const missingSliders = freeInAst.filter(v => 
                        StateManager.values[v] === undefined && 
                        !MathEngine.compiledFuncs[v] &&
                        !StateManager.giacDefinitions[v] &&
                        !definedMatrixNames.has(v)
                    );
                    if (missingSliders.length > 0) {
                        ExpressionManager.setSliderSuggestions(item.id, missingSliders, (varName) => {
                            ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                            scheduleFrame();
                        });
                    } else {
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                    }
                } else {
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                }
            };

            if (cached && cached.query === giacQuery) {
                ExpressionManager.setResult(item.id, formatCasDisplay(cached.result));
                updateSlidersForGiac();
                if (assignVarName && assignVarName !== 'y' && isDefiniteInt) {
                    try {
                        const numAst = new PrattParser(cached.result).parseExpression();
                        const numVal = MathEngine.compile(numAst)(0, 0, StateManager.values);
                        if (!isNaN(numVal) && isFinite(numVal)) {
                            StateManager.values[assignVarName] = numVal;
                            StateManager.defineVariable(assignVarName, numAst);
                        } else if (numIntegralVal !== null) {
                            StateManager.values[assignVarName] = numIntegralVal;
                        }
                    } catch(e) {
                        if (numIntegralVal !== null) {
                            StateManager.values[assignVarName] = numIntegralVal;
                        }
                    }
                }
                try {
                    const solvedAst = new PrattParser(cached.result).parseExpression();
                    const free = getFreeVariables(solvedAst, []);
                    if (!isDefiniteInt && (assignVarName === null || assignVarName === 'y') && (free.includes('x') || (!isNaN(Number(cached.result)) && isFinite(Number(cached.result))))) {
                        validEquations.push({ 
                            color: item.color, 
                            id: item.id, 
                            ast: solvedAst, 
                            isImplicit: false, 
                            operator: '=', 
                            isEdo: false, 
                            isDerivative: false, 
                            isHidden: !item.visible, 
                            variable: isIntegralCmd && typeof ast[2] === 'string' ? ast[2] : 'x'
                        });
                    }
                } catch(e) {
                    console.warn('[Main] Error building curve for integral/diff:', e);
                }
            } else {
                if (numIntegralVal !== null) {
                    ExpressionManager.setResult(item.id, `= ${parseFloat(numIntegralVal.toFixed(10))}`);
                    if (assignVarName && assignVarName !== 'y') {
                        StateManager.values[assignVarName] = numIntegralVal;
                    }
                } else {
                    ExpressionManager.setResult(item.id, 'Calculando...');
                }
                MathEngine.askGiac(giacQuery).then(res => {
                    if (StateManager.activeGiacQuery[item.id] !== giacQuery) return; // Stale query from typing, discard!
                    let cleanResult = res.replace(/"/g, '')
                                          .replace(/matrix\s*\[/g, '[')
                                          .replace(/list\s*\[/g, '[')
                                          .replace(/usr_/g, '')
                                          .trim();
                    if (cleanResult.includes('Erro') || cleanResult.includes('undef') || cleanResult.includes('Bad Argument') || cleanResult.includes('pnt') || cleanResult.includes('point[') || cleanResult.includes('536870912')) {
                        cleanResult = numIntegralVal !== null ? `${parseFloat(numIntegralVal.toFixed(10))}` : 'Erro no cálculo';
                    }
                    if (cleanResult !== 'Erro no cálculo' && !cleanResult.includes('pnt') && !cleanResult.includes('point[') && !cleanResult.includes('536870912')) {
                        StateManager.casSolutions[item.id] = { query: giacQuery, result: cleanResult };
                    } else {
                        delete StateManager.casSolutions[item.id];
                    }
                    ExpressionManager.setResult(item.id, formatCasDisplay(cleanResult));
                    if (assignVarName && assignVarName !== 'y' && isDefiniteInt) {
                        try {
                            const numAst = new PrattParser(cleanResult).parseExpression();
                            const numVal = MathEngine.compile(numAst)(0, 0, StateManager.values);
                            if (!isNaN(numVal) && isFinite(numVal)) {
                                StateManager.values[assignVarName] = numVal;
                                StateManager.defineVariable(assignVarName, numAst);
                            } else if (numIntegralVal !== null) {
                                StateManager.values[assignVarName] = numIntegralVal;
                            }
                        } catch(e) {
                            if (numIntegralVal !== null) {
                                StateManager.values[assignVarName] = numIntegralVal;
                            }
                        }
                    }
                    updateSlidersForGiac();
                    markExpressionsDirty();
                });
            }
            return;
        }


        // 2. EQUAÇÕES DIFERENCIAIS E COMANDOS CAS GENÉRICOS
        let isEdo = false;
        let edoNameMatch = '';
        let edoExpr = '';

        const campoMatch = noSpaceStr.match(/^(?:campovetorial|slopefield|campo)\((.+)\)$/i);
        const solveMatch = noSpaceStr.match(/^(?:solveode|resolvere|resolveredo|edo)\((.+)\)$/i);
        // Universal CAS command detector (e.g. Factor, Simplify, Substitute, etc.)
        const genericCasMatch = noSpaceStr.match(/^(?:([a-zA-Z_][a-zA-Z0-9_\{\}]*(?:\([a-zA-Z_]\))?)=)?([A-Za-z]+)\((.*)\)$/);
        

        if (campoMatch) {
            const innerEq = campoMatch[1];
            const eqIdx = innerEq.indexOf('=');
            if (eqIdx > 0) {
                const leftSide = innerEq.substring(0, eqIdx);
                edoExpr = innerEq.substring(eqIdx + 1);
                if (leftSide.endsWith("'")) edoNameMatch = leftSide.substring(0, leftSide.length - 1).replace(/[\{\}\\]/g, '');
                else if (leftSide.startsWith("d") && leftSide.endsWith("/dx")) edoNameMatch = leftSide.substring(1, leftSide.length - 3).replace(/[\{\}\(\)\\]/g, '');
                else edoNameMatch = 'y';
            } else {
                edoExpr = innerEq;
                edoNameMatch = 'y';
            }
            isEdo = true;
        } else if (solveMatch) {
            const innerArgs = solveMatch[1];
            const currentQuery = innerArgs;
            
            const cached = StateManager.odeSolutions[item.id];
            if (cached && cached.query === currentQuery) {
                if (cached.name === 'Erro') {
                    ExpressionManager.setResult(item.id, `Erro EDO: ${cached.expr}`);
                } else {
                    ExpressionManager.setResult(item.id, `= ${cached.name}(x) = ${cached.expr}`);
                    validEquations.push({ color: item.color, id: item.id, ast: cached.ast, isImplicit: false, isEdo: false, name: cached.name, operator: '=', isDerivative: false, isHidden: !item.visible });
                    
                    // Registar para que f_1(3) funcione!
                    if (cached.name) {
                        const cleanName = cached.name.replace(/[\{\}\\]/g, '');
                        MathEngine.compiledFuncs[cleanName] = MathEngine.compile(cached.ast, 'x');
                    }
                }
            } else {
                ExpressionManager.setResult(item.id, 'Solucionando EDO...');
                if (!StateManager.pendingOdes[item.id]) {
                    StateManager.pendingOdes[item.id] = true;
                    // Pré-processar a equação para o formato do Giac
                    let odeEq = currentQuery;
                    odeEq = odeEq.replace(/\(?dy\)?\s*\/\s*\(?dx\)?/g, "y'"); // converte dy/dx para y'
                    
                    const depVarMatch = odeEq.match(/([a-zA-Z_][a-zA-Z0-9_\{\}]*)'/);
                    const depVar = depVarMatch ? depVarMatch[1].replace(/[\{\}\\]/g, '') : 'y';
                    
                    // Extrair pontos de condição inicial: SolveODE(y' = y, (0, 2)) ou SolveODE(y''=y, (0,2), (0,1))
                    const doublePtMatch = odeEq.match(/(.+?),\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*,\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
                    const singlePtMatch = !doublePtMatch ? odeEq.match(/(.+?),\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/) : null;
                    
                    let giacQ = '';
                    if (doublePtMatch) {
                        giacQ = `desolve([${doublePtMatch[1]}, ${depVar}(${doublePtMatch[2]})=${doublePtMatch[3]}, ${depVar}'(${doublePtMatch[4]})=${doublePtMatch[5]}], ${depVar})`;
                    } else if (singlePtMatch) {
                        giacQ = `desolve([${singlePtMatch[1]}, ${depVar}(${singlePtMatch[2]})=${singlePtMatch[3]}], ${depVar})`;
                    } else {
                        const trimmedEq = odeEq.trim();
                        if (new RegExp(`,\\s*${depVar}\\s*$`).test(trimmedEq)) {
                            giacQ = `desolve(${trimmedEq})`;
                        } else {
                            giacQ = `desolve(${trimmedEq}, ${depVar})`;
                        }
                    }
                    
                    StateManager.activeGiacQuery[item.id] = giacQ;
                    MathEngine.askGiac(giacQ).then(res => {
                        StateManager.pendingOdes[item.id] = false;
                        if (StateManager.activeGiacQuery[item.id] !== giacQ) return; // Stale query from typing, discard!
                        const cleanResult = res.replace(/"/g, '').replace(/list\[/g, '[').replace(/usr_/g, '').trim();
                        
                        let finalExpr = cleanResult;
                        if (cleanResult.startsWith('[') && cleanResult.endsWith(']')) {
                            const inner = cleanResult.substring(1, cleanResult.length - 1);
                            if (inner) finalExpr = inner.split(',')[0];
                            else finalExpr = 'Erro: Sem solução';
                        }
                        
                        if (finalExpr.includes('Erro') || finalExpr.includes('ausente') || finalExpr.includes('Mock') || finalExpr.includes('pnt') || finalExpr.includes('point[') || finalExpr.includes('536870912')) {
                            StateManager.odeSolutions[item.id] = { query: currentQuery, name: 'Erro', expr: 'Falha ou Mock', ast: null, index: -1 };
                            ExpressionManager.setResult(item.id, `Erro EDO: Giac ausente/Falha`);
                        } else if (finalExpr.includes('carregar')) {
                            ExpressionManager.setResult(item.id, `(A carregar motor...)`);
                            // Reset pending state so it tries again next frame
                            StateManager.pendingOdes[item.id] = false;
                        } else {
                            try {
                                const idx = StateManager.getNextFuncIndex();
                                const nextName = `f_{${idx}}`;
                                
                                // O ComputeEngine lida melhor com variáveis sem underscore (c0 em vez de c_0)
                                finalExpr = finalExpr.replace(/c_([0-9]+)/g, 'C$1');
                                
                                const ast = new PrattParser(finalExpr).parseExpression();
                                
                                // Extrair variáveis C0, C1, etc. para auto-spawnar sliders!
                                const constants = finalExpr.match(/C\d+/g) || [];
                                constants.forEach(c => {
                                    if (!StateManager.values.hasOwnProperty(c)) {
                                        StateManager.values[c] = 1;
                                        ExpressionManager.addExpression(`${c} = 1`);
                                    }
                                });
                                
                                 StateManager.odeSolutions[item.id] = { query: currentQuery, name: nextName, expr: finalExpr, ast, index: idx };
                            } catch(e) {
                                StateManager.odeSolutions[item.id] = { query: currentQuery, name: 'Erro', expr: 'Parse falhou', ast: null, index: -1 };
                            }
                        }
                        markExpressionsDirty();
                    });
                }
            }
            return; // Interrompe para não renderizar mais nada como texto
        } else if (genericCasMatch && casCommandsList.has(genericCasMatch[2].toLowerCase())) {
            const assignTarget = genericCasMatch[1];
            const cmdName = genericCasMatch[2].toLowerCase();
            const cmdArgs = genericCasMatch[3];
            const currentQuery = assignTarget ? `${assignTarget}=${cmdName}(${cmdArgs})` : `${cmdName}(${cmdArgs})`;
            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            if (cmdArgs.trim() === '') {
                ExpressionManager.setResult(item.id, '');
                return;
            }

            // Validação estrita de sensibilidade a maiúsculas/minúsculas para comandos de matriz (ex: det(A) vs det(a))
            const matrixOnlyCmds = new Set(['det', 'determinant', 'rref', 'reducedrowechelonform', 'trace', 'tr', 'matrixrank', 'rank', 'invert', 'inv', 'transpose', 'tran', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'ludecomposition', 'jordandiagonalization']);
            if (matrixOnlyCmds.has(cmdName)) {
                const rawArg = cmdArgs.trim().replace(/[\{\}\\]/g, '');
                if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawArg) && !definedMatrixNames.has(rawArg)) {
                    const errMsg = `Erro: Matriz "${rawArg}" não definida`;
                    StateManager.casSolutions[item.id] = { query: currentQuery, result: errMsg };
                    ExpressionManager.setResult(item.id, `- ${errMsg}`);
                    ExpressionManager.setError(item.id, errMsg);
                    StateManager.pendingCas[item.id] = false;
                    scheduleFrame();
                    return;
                }
            }

            let cached: any = StateManager.casSolutions[item.id];
            if (cached && (cached.result.includes('pnt') || cached.result.includes('point[') || cached.result.includes('536870912') || cached.result.includes('Erro'))) {
                delete StateManager.casSolutions[item.id];
                cached = undefined;
            }
            if (cached && cached.query === currentQuery) {
                ExpressionManager.setResult(item.id, cached.result.includes('Erro') ? `- Erro no cálculo` : `= ${cached.result}`);
                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                
                if (cached.ast) {
                    validEquations.push({ color: item.color, id: item.id, ast: cached.ast, isImplicit: false, isEdo: false, name: cached.name || '', operator: '=', isDerivative: false, isHidden: !item.visible, variable: cached.variable });
                    
                    // Registar para que f_n(3) funcione!
                    if (cached.name) {
                        const cleanName = cached.name.replace(/[\{\}\\]/g, '');
                        MathEngine.compiledFuncs[cleanName] = MathEngine.compile(cached.ast, cached.variable || 'x');
                    }
                }
            } else {
                ExpressionManager.setResult(item.id, 'Processando CAS...');
                if (!StateManager.pendingCas[item.id]) {
                    StateManager.pendingCas[item.id] = true;
                    // Força a exigir variável de integração se só for passado 1 argumento
                    if ((cmdName === 'integral' || cmdName === 'nintegral' || cmdName === 'derivative') && !cmdArgs.includes(',')) {
                        StateManager.casSolutions[item.id] = { query: currentQuery, result: 'Erro: Informe a variável. Ex: Integral(expressão, x)' };
                        ExpressionManager.setResult(item.id, `- Erro no cálculo`);
                        StateManager.pendingCas[item.id] = false;
                        drawFrame();
                        return;
                    }

                    // Tenta extrair a variável do comando (ex: Integral(x^2, x) -> x)
                    const argsList = cmdArgs.split(',').map(s => s.trim());
                    let extractVar = 'x';
                    if (argsList.length >= 2 && (cmdName === 'integral' || cmdName === 'derivative' || cmdName === 'limit' || cmdName === 'lim')) {
                        extractVar = argsList[1].replace(/[\{\}\\]/g, '');
                    }

                    // Expande funções de usuário nos argumentos (ex: Derivative(f(x, y), x) -> diff(2xy + y^2, x))
                    let expandedArgs = cmdArgs;
                    try {
                        let dummyAst = new PrattParser(`[${cmdArgs}]`).parseExpression();
                        dummyAst = MathEngine.expandUserFunctions(dummyAst);
                        if (Array.isArray(dummyAst) && dummyAst[0] === 'List') {
                            expandedArgs = dummyAst.slice(1).map((a: any) => MathEngine.formatForGiac(a)).join(', ');
                        }
                    } catch(err) {
                        console.warn('[Main] Error expanding user functions in Giac args:', err);
                    }

                    // Mapeia comandos para Giac nativo!
                    let giacArgs = prefixGiac(expandedArgs.replace(/\{/g, '[').replace(/\}/g, ']'));

                    let giacCommand = `${cmdName}(${giacArgs})`;
                    
                    if (cmdName === 'derivative' || cmdName === 'nderivative' || cmdName === 'diff') giacCommand = `diff(${giacArgs})`;
                    else if (cmdName === 'lim' || cmdName === 'limit') giacCommand = `limit(${giacArgs})`;
                    else if (cmdName === 'implicitderivative') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 1) giacCommand = `-(diff(${args[0]}, x))/(diff(${args[0]}, y))`;
                        else if (args.length === 3) giacCommand = `-(diff(${args[0]}, ${args[2]}))/(diff(${args[0]}, ${args[1]}))`;
                    }
                    else if (cmdName === 'integral' || cmdName === 'integralsymbolic' || cmdName === 'nintegral' || cmdName === 'int') giacCommand = `integrate(${giacArgs})`;
                    else if (cmdName === 'integralbetween') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 4) giacCommand = `integrate(${args[0]} - (${args[1]}), x, ${args[2]}, ${args[3]})`;
                        else if (args.length === 5) giacCommand = `integrate(${args[0]} - (${args[1]}), ${args[2]}, ${args[3]}, ${args[4]})`;
                    }
                    else if (cmdName === 'limitabove') giacCommand = `limit(${giacArgs}, 1)`;
                    else if (cmdName === 'limitbelow') giacCommand = `limit(${giacArgs}, -1)`;
                    else if (cmdName === 'taylor' || cmdName === 'taylorpolynomial') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 1) giacCommand = `taylor(${args[0]}, x=0, 4)`;
                        else if (args.length === 2) giacCommand = `taylor(${args[0]}, ${args[1]}=0, 4)`;
                        else if (args.length === 4) giacCommand = `taylor(${args[0]}, ${args[1]}=${args[2]}, ${args[3]})`;
                        else giacCommand = `taylor(${giacArgs})`;
                    }
                    else if (cmdName === 'completesquare') giacCommand = `canonical_form(${giacArgs})`;
                    else if (cmdName === 'nsolve' || cmdName === 'nsolutions') giacCommand = `fsolve(${giacArgs})`;
                    else if (cmdName === 'solutions') giacCommand = `solve(${giacArgs})`;
                    else if (cmdName === 'cross') giacCommand = `cross(${giacArgs})`; 
                    else if (cmdName === 'dot') giacCommand = `dot(${giacArgs})`;
                    else if (cmdName === 'primefactors') giacCommand = `ifactors(${giacArgs})`;
                    else if (cmdName === 'matrixrank' || cmdName === 'rank') giacCommand = `rank(${giacArgs})`;
                    else if (cmdName === 'reducedrowechelonform' || cmdName === 'rref') giacCommand = `rref(${giacArgs})`;
                    else if (cmdName === 'determinant' || cmdName === 'det') giacCommand = `det(${giacArgs})`;
                    else if (cmdName === 'trace' || cmdName === 'tr') giacCommand = `trace(${giacArgs})`;
                    else if (cmdName === 'eigenvalues' || cmdName === 'eigenvals') giacCommand = `eigenvals(${giacArgs})`;
                    else if (cmdName === 'eigenvectors' || cmdName === 'eigenvects') giacCommand = `eigenvects(${giacArgs})`;
                    else if (cmdName === 'invert' || cmdName === 'inv') giacCommand = `inv(${giacArgs})`;
                    else if (cmdName === 'ludecomposition') giacCommand = `lu(${giacArgs})`;
                    else if (cmdName === 'lcm') giacCommand = `lcm(${giacArgs})`;
                    else if (cmdName === 'jordandiagonalization') giacCommand = `jordan(${giacArgs})`;
                    else if (cmdName === 'characteristicpolynomial') giacCommand = `charpoly(${giacArgs})`;
                    else if (cmdName === 'minimalpolynomial') giacCommand = `pmin(${giacArgs})`;
                    else if (cmdName === 'dimension') giacCommand = `dim(${giacArgs})`;
                    else if (cmdName === 'length' || cmdName === 'size') {
                        const isIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(giacArgs.replace(/^usr_/, '').trim());
                        const listArg = (!giacArgs.trim().startsWith('[') && !definedMatrixNames.has(giacArgs.trim()) && !isIdent) ? `[${giacArgs}]` : giacArgs;
                        giacCommand = `size(${listArg})`;
                    }
                    else if (cmdName === 'mean' || cmdName === 'median') {
                        const isIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(giacArgs.replace(/^usr_/, '').trim());
                        const listArg = (!giacArgs.trim().startsWith('[') && !isIdent) ? `[${giacArgs}]` : giacArgs;
                        giacCommand = `${cmdName}(${listArg})`;
                    }
                    else if (cmdName === 'stdev' || cmdName === 'stddev' || cmdName === 'samplesd') {
                        const isIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(giacArgs.replace(/^usr_/, '').trim());
                        const listArg = (!giacArgs.trim().startsWith('[') && !isIdent) ? `[${giacArgs}]` : giacArgs;
                        giacCommand = `stddev(${listArg})`;
                    }
                    else if (cmdName === 'var' || cmdName === 'variance' || cmdName === 'samplevariance') {
                        const isIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(giacArgs.replace(/^usr_/, '').trim());
                        const listArg = (!giacArgs.trim().startsWith('[') && !isIdent) ? `[${giacArgs}]` : giacArgs;
                        giacCommand = `variance(${listArg})`;
                    }
                    else if (cmdName === 'sum') giacCommand = `sum(${giacArgs})`;
                    else if (cmdName === 'product' || cmdName === 'prod') giacCommand = `product(${giacArgs})`;
                    else if (cmdName === 'nthroot') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 2) giacCommand = `root(${args[1]}, ${args[0]})`;
                    }
                    else if (cmdName === 'transpose' || cmdName === 'tran') giacCommand = `tran(${giacArgs})`;
                    else if (cmdName === 'unitvector') giacCommand = `normalize(${giacArgs})`;
                    else if (cmdName === 'svd') giacCommand = `svd(${giacArgs})`;
                    else if (cmdName === 'qrdecomposition') giacCommand = `qr(${giacArgs})`;
                    else if (cmdName === 'laplace') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 1) giacCommand = `laplace(${args[0]}, t, s)`;
                        else if (args.length === 2) giacCommand = `laplace(${args[0]}, ${args[1]}, s)`;
                        else giacCommand = `laplace(${giacArgs})`;
                    }
                    else if (cmdName === 'applymatrix') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length >= 2) giacCommand = `${args[0]} * ${args[1]}`;
                    }
                    else if (cmdName === 'nsolveode' || cmdName === 'solveode' || cmdName === 'edo') giacCommand = `desolve(${giacArgs})`;

                    const noSimplifyCmds = ['simplify', 'factor', 'expand', 'nsolve', 'nsolutions', 'solutions', 'solve', 'limit', 'lim', 'limitabove', 'limitbelow', 'cross', 'dot', 'primefactors', 'matrixrank', 'rank', 'reducedrowechelonform', 'rref', 'determinant', 'det', 'trace', 'tr', 'invert', 'inv', 'transpose', 'tran', 'qrdecomposition', 'laplace', 'applymatrix', 'nsolveode', 'desolve', 'solveode', 'edo', 'taylor', 'taylorpolynomial', 'mean', 'median', 'stdev', 'stddev', 'samplesd', 'var', 'variance', 'samplevariance', 'length', 'size', 'eigenvalues', 'eigenvals', 'eigenvectors', 'eigenvects', 'sum', 'product', 'prod'];
                    if (!noSimplifyCmds.includes(cmdName)) {
                        giacCommand = `simplify(${giacCommand})`;
                    }
                    
                    if (assignTarget) {
                        giacCommand = `${assignTarget}:=${giacCommand}`;
                    }
                    
                    StateManager.activeGiacQuery[item.id] = currentQuery;
                    MathEngine.askGiac(giacCommand).then(res => {
                        StateManager.pendingCas[item.id] = false;
                        if (StateManager.activeGiacQuery[item.id] !== currentQuery) return; // Stale query from typing, discard!
                        if (res.includes('carregar')) {
                            ExpressionManager.setResult(item.id, `(A carregar motor...)`);
                            StateManager.pendingCas[item.id] = false;
                        } else if (res.includes('Erro') || res.includes('ausente') || res.includes('Mock') || res.includes('pnt') || res.includes('point[') || res.includes('536870912')) {
                            delete StateManager.casSolutions[item.id];
                            ExpressionManager.setResult(item.id, `- Erro no cálculo`);
                            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        } else {
                            // Limpa as aspas do Giac e espaços extras
                            let cleanResult = res.replace(/"/g, '').replace(/matrix\s*\[/g, '[').replace(/list\s*\[/g, '[').replace(/usr_/g, '').trim();
                            if (cleanResult.includes('Erro') || cleanResult.includes('pnt') || cleanResult.includes('point[') || cleanResult.includes('536870912')) {
                                delete StateManager.casSolutions[item.id];
                                ExpressionManager.setResult(item.id, `- Erro no cálculo`);
                                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                                return;
                            }
                            const arrowMatchClean = cleanResult.match(/^(?:\(?[a-zA-Z_]+\)?\s*->\s*)(.*)/);
                            if (arrowMatchClean) cleanResult = arrowMatchClean[1];
                            
                            const lambdaMatch = cleanResult.match(/^\(\w\)\s*->\s*(.*)$/);
                            if (lambdaMatch) {
                                cleanResult = lambdaMatch[1];
                            }
                            
                            let ast = null;
                            let idx = undefined;
                            let fname = undefined;
                            
                            try { 
                                  ast = new PrattParser(cleanResult).parseExpression();
                                  
                                  // Comandos que não devem virar funções plotáveis
                                  const nonPlottingCmds = ['determinant', 'det', 'dot', 'cross', 'length', 'dimension', 'matrixrank', 'rank', 'reducedrowechelonform', 'rref', 'trace', 'tr', 'invert', 'inv', 'transpose', 'tran', 'lcm', 'gcd', 'nsolve', 'nsolutions', 'solutions', 'solve', 'limit', 'limitabove', 'limitbelow'];
                                  
                                  // Se for apenas um número ou uma lista/matriz, não precisamos transformar numa função plotável
                                  let isJustNumber = false;
            try {
                const tempAst = new PrattParser(cleanResult).parseExpression();
                const tempFunc = MathEngine.compile(tempAst, 'x');
                const v1 = tempFunc(0, 0, StateManager.values);
                const v2 = tempFunc(1, 0, StateManager.values);
                if (!isNaN(v1) && v1 === v2) {
                    isJustNumber = true;
                }
            } catch(e) {
                console.warn('[Main] Error evaluating constant result probe:', e);
            }
                                  const isListOrMatrix = cleanResult.trim().startsWith('[');
                                  
                                  if (!nonPlottingCmds.includes(cmdName) && !isJustNumber && !isListOrMatrix) {
                                      if (assignTarget && assignTarget.includes('(')) {
                                          fname = assignTarget.split('(')[0].replace(/[\\{\\}\\]/g, '');
                                          extractVar = assignTarget.split('(')[1].replace(')', '').replace(/[\\{\\}\\]/g, '');
                                      } else if (assignTarget) {
                                          fname = assignTarget.replace(/[\\{\\}\\]/g, '');
                                      } else {
                                          idx = StateManager.casIndices[item.id] ?? StateManager.getNextFuncIndex();
                                          fname = `f_{${idx}}`;
                                      }
                                  }
                              } catch(e) {
                                  console.warn('[Main] Error resolving CAS result curve name:', e);
                              }
                              
                              let resAst = null;
                              if (!cleanResult.includes('Erro')) {
                                  try {
                                      let parseableResult = cleanResult;
                                      const arrowMatch = cleanResult.match(/^(?:\(?[a-zA-Z_]+\)?\s*->\s*)(.*)/);
                                      if (arrowMatch) parseableResult = arrowMatch[1];
                                      resAst = new PrattParser(parseableResult).parseExpression();
                                  } catch (e) {
                                      resAst = ast;
                                  }
                              }

                              StateManager.casSolutions[item.id] = { query: currentQuery, result: cleanResult, ast: resAst, name: fname, variable: extractVar, index: idx };
        
                              ExpressionManager.setResult(item.id, `= ${cleanResult}`);

                              // Cleanup orphaned blocks from previous app versions (legacy)
                              const spawnedId = StateManager.casSpawnedBlocks[item.id];
                              if (spawnedId && document.getElementById(spawnedId)) {
                                  document.getElementById(spawnedId)!.remove();
                                  delete StateManager.casSpawnedBlocks[item.id];
                                  delete StateManager.casIndices[item.id];
                                  ExpressionManager.updateBlockNumbers();
                              }

                              if (resAst && fname) {
                                  validEquations.push({ color: item.color, id: item.id, ast: resAst, isImplicit: false, isEdo: false, name: fname, operator: '=', isDerivative: false, isHidden: !item.visible, variable: extractVar });
                                  
                                  // Registar para que f_n(3) funcione!
                                  const cleanName = fname.replace(/[\{\}\\]/g, '');
                                  MathEngine.compiledFuncs[cleanName] = MathEngine.compile(resAst, extractVar);
                              }               
                        }
                        markExpressionsDirty();
                    });
                }
            }
            return; // Interrompe para não renderizar o gráfico disto
        } else {
            // Detecção Universal de Equações Diferenciais Ordinárias (EDOs)
            const eqIndex = noSpaceStr.indexOf('=');
            if (eqIndex > 0) {
                const leftSide = noSpaceStr.substring(0, eqIndex);
                const rightSideClean = cleanStr.substring(cleanStr.indexOf('=') + 1).trim();

                // 1. Plicas: y' = ..., y'(x) = ..., y'(t) = ..., x'(t) = ..., v' = ...
                const primeMatch = leftSide.match(/^([a-zA-Z_][a-zA-Z0-9_]*)'(?:\(([a-zA-Z_][a-zA-Z0-9_]*)\))?$/);
                if (primeMatch) {
                    isEdo = true;
                    edoNameMatch = primeMatch[1];
                    const indep = primeMatch[2] || (edoNameMatch === 'x' ? 't' : 'x');
                    edoExpr = rightSideClean;
                    (item as any)._indepVar = indep;
                }
                // 2. Leibniz simples: dy/dx, dy/dt, dx/dt, dv/dt, etc.
                else if (leftSide.match(/^d([a-zA-Z_][a-zA-Z0-9_]*)\/d([a-zA-Z_][a-zA-Z0-9_]*)$/)) {
                    const m = leftSide.match(/^d([a-zA-Z_][a-zA-Z0-9_]*)\/d([a-zA-Z_][a-zA-Z0-9_]*)$/)!;
                    isEdo = true;
                    edoNameMatch = m[1];
                    edoExpr = rightSideClean;
                    (item as any)._indepVar = m[2];
                }
                // 3. Leibniz LaTeX: \frac{dy}{dx}, \frac{dy}{dt}, \frac{d(y)}{dt}
                else if (leftSide.match(/^\\frac\{d\(?([a-zA-Z_][a-zA-Z0-9_]*)\)?\}\{d\(?([a-zA-Z_][a-zA-Z0-9_]*)\)?\}$/)) {
                    const m = leftSide.match(/^\\frac\{d\(?([a-zA-Z_][a-zA-Z0-9_]*)\)?\}\{d\(?([a-zA-Z_][a-zA-Z0-9_]*)\)?\}$/)!;
                    isEdo = true;
                    edoNameMatch = m[1];
                    edoExpr = rightSideClean;
                    (item as any)._indepVar = m[2];
                }
                // 4. Notação diff(y, x) = ... ou diff(y, t) = ...
                else if (leftSide.match(/^diff\(([a-zA-Z_][a-zA-Z0-9_]*),([a-zA-Z_][a-zA-Z0-9_]*)\)$/)) {
                    const m = leftSide.match(/^diff\(([a-zA-Z_][a-zA-Z0-9_]*),([a-zA-Z_][a-zA-Z0-9_]*)\)$/)!;
                    isEdo = true;
                    edoNameMatch = m[1];
                    edoExpr = rightSideClean;
                    (item as any)._indepVar = m[2];
                }
            }
        }

        if (isEdo) {
            const depVar = edoNameMatch || 'y';
            const indepVar = (item as any)._indepVar || (depVar === 'x' ? 't' : 'x');
            try {
                const astEdo = new PrattParser(edoExpr).parseExpression();
                validEquations.push({ 
                    color: item.color, 
                    id: item.id, 
                    ast: astEdo, 
                    isImplicit: false, 
                    isEdo: true, 
                    name: depVar, 
                    depVar,
                    indepVar,
                    operator: '=', 
                    isDerivative: false, 
                    isHidden: !item.visible 
                });

                // Verifica se há parâmetros livres na EDO (ex: k em dy/dt = -k*y)
                const freeParams = getFreeVariables(astEdo, [depVar, indepVar]);
                if (freeParams.length > 0) {
                    const paramDetails = freeParams.map(p => `${p}=${StateManager.values[p] ?? '?'}`).join(', ');
                    ExpressionManager.setResult(item.id, `Campo (${depVar}' em ${indepVar} | ${paramDetails})`);
                } else {
                    ExpressionManager.setResult(item.id, `Campo Vetorial (${depVar}' em ${indepVar})`);
                }
            } catch(e) {
                ExpressionManager.setResult(item.id, `Erro EDO: ${(e as Error).message}`);
            }
            return;
        }

        // 2.5. PROBLEMA DE VALOR INICIAL (IVP)
        const ivpMatch = cleanStr.match(/^([a-zA-Z_][a-zA-Z0-9_\{\}]*)\s*\(([\d\.\-]+)\)\s*=\s*([\d\.\-]+)$/);
        if (ivpMatch) {
            let edoName = ivpMatch[1].replace(/[\{\}\\]/g, '');
            const x0 = parseFloat(ivpMatch[2]);
            const y0 = parseFloat(ivpMatch[3]);
            validEquations.push({ color: item.color, id: item.id, isImplicit: false, isEdo: false, isDerivative: false, isIvp: true, name: edoName, x0, y0, ast: null, operator: '=', isHidden: !item.visible });
            ExpressionManager.setResult(item.id, `Curva de Solução (${edoName}(${x0}) = ${y0})`);
            return;
        }

        // 3. FUNÇÕES CUSTOMIZADAS (Mono e Multivariáveis: f(x), f(x, y), f(x, y, z, a, b))
        const funcMatch = cleanStr.match(/^\\?([a-zA-Z_][a-zA-Z0-9_\{\}]*)\s*\(([^)]+)\)\s*=\s*(.+)$/);
        if (funcMatch) {
            const funcName = funcMatch[1].replace(/[\{\}\\]/g, ''); 
            const paramNames = funcMatch[2].split(',').map(s => s.trim().replace(/[\{\}\\]/g, ''));
            const expr = funcMatch[3].trim();
            const isMultiVar = paramNames.length > 1;

            // Se for uma função já existente e o usuário está escrevendo f(x, y) = 0 (ou f(x, y) = constante)
            // ou se está em outro bloco de expressão, isso NÃO é uma definição, mas sim uma EQUAÇÃO A PLOTAR!
            const existingFunc = MathEngine.userFunctions[funcName];
            const isRhsConstant = !isNaN(Number(expr)) || expr === '0';
            const isDifferentBlock = !!(existingFunc && existingFunc.blockId && existingFunc.blockId !== item.id);
            const isPlotEquation = !!(existingFunc && (isRhsConstant || isDifferentBlock));

            if (!isPlotEquation) {
                try {
                    const directDiff = !isMultiVar ? expr.match(/^diff\s*\(\s*(.+?)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/i) : null;
                    const derivMatch = directDiff || (!isMultiVar ? expr.match(/^(?:\\frac\{d\}\{d([a-zA-Z])\}|d\/d([a-zA-Z])|\(d\)\/\(d([a-zA-Z])\))\s*(.+)$/) : null);
                    if (derivMatch) {
                        const derivVar = directDiff ? directDiff[2] : (derivMatch[1] || derivMatch[2] || derivMatch[3]);
                        const derivExpr = directDiff ? directDiff[1] : derivMatch[4];
                        const ast = new PrattParser(derivExpr).parseExpression();
                        MathEngine.compiledFuncs[funcName] = MathEngine.createDerivativeFunction(ast, derivVar);
                        MathEngine.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        StateManager.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        definedUserFunctionNames.add(funcName);
                        validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: true, derivVar, isHidden: !item.visible, variable: paramNames[0] });
                        ExpressionManager.setError(item.id, null);
                        ExpressionManager.setResult(item.id, `Derivada ${funcName}(${paramNames[0]})`);
                    } else {
                        const ast = new PrattParser(expr).parseExpression();
                        MathEngine.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        StateManager.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        definedUserFunctionNames.add(funcName);
                        
                        const isMatrixValued = expr.trim().startsWith('[[') || (Array.isArray(ast) && ast[0] === 'List' && Array.isArray(ast[1]) && ast[1][0] === 'List');

                        if (isMultiVar) {
                            // Função multivariável (ex: f(x, y) = x^2*y + y^2/x ou a(x, y, z) = [[x, 0, 0], [0, y, 0], [0, 0, z]])
                            MathEngine.compiledFuncs[funcName] = MathEngine.compileMultivariable(ast, paramNames);
                            
                            // Envia definição multivariável ao Giac para permitir int(f(x, y, z), y) e diff(f(x, y), x)
                            const giacDef = `usr_${funcName}(${paramNames.join(',')}):=${expr}`;
                            if (StateManager.giacDefinitions[funcName] !== giacDef) {
                                StateManager.giacDefinitions[funcName] = giacDef;
                                StateManager.casSolutions = {};
                                MathEngine.askGiac(giacDef);
                            }

                            if (isMatrixValued) {
                                ExpressionManager.setResult(item.id, '');
                            } else {
                                ExpressionManager.setResult(item.id, '');
                            }
                        } else {
                            // Função monovariável (ex: f(x) = x^2 ou f(x) = [[x, 0], [0, x]])
                            const paramName = paramNames[0];
                            if (isMatrixValued) {
                                MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                                ExpressionManager.setResult(item.id, '');
                                ExpressionManager.setError(item.id, null);
                                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                                const giacDef = `usr_${funcName}(${paramName}):=${expr}`;
                                if (StateManager.giacDefinitions[funcName] !== giacDef) {
                                    StateManager.giacDefinitions[funcName] = giacDef;
                                    StateManager.casSolutions = {};
                                    MathEngine.askGiac(giacDef);
                                }
                            } else if (MathEngine.isGiacCommand(ast)) {
                                const giacQuery = MathEngine.formatForGiac(ast);
                                const cached = StateManager.casSolutions[item.id];
                                if (cached && (cached.result.includes('pnt') || cached.result.includes('point[') || cached.result.includes('536870912') || cached.result.includes('Erro'))) {
                                    delete StateManager.casSolutions[item.id];
                                } else if (cached && cached.query === giacQuery) {
                                    try {
                                        const solvedAst = new PrattParser(cached.result).parseExpression();
                                        MathEngine.compiledFuncs[funcName] = MathEngine.compile(solvedAst, paramName);
                                        validEquations.push({ color: item.color, id: item.id, ast: solvedAst, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                                        ExpressionManager.setResult(item.id, `= ${cached.result}`);
                                    } catch(err) {
                                        MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                                        validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                                        ExpressionManager.setResult(item.id, `= ${cached.result}`);
                                    }
                                } else {
                                    ExpressionManager.setResult(item.id, 'Calculando...');
                                    ExpressionManager.setError(item.id, null);
                                    StateManager.activeGiacQuery[item.id] = giacQuery;
                                    MathEngine.askGiac(giacQuery).then(res => {
                                        if (StateManager.activeGiacQuery[item.id] !== giacQuery) return; // Stale query, discard!
                                        const cleanRes = res.replace(/"/g, '').trim();
                                        if (cleanRes.includes('Erro') || cleanRes.includes('pnt') || cleanRes.includes('point[') || cleanRes.includes('536870912')) {
                                            delete StateManager.casSolutions[item.id];
                                            return;
                                        }
                                        StateManager.casSolutions[item.id] = { query: giacQuery, result: cleanRes };
                                        markExpressionsDirty();
                                    });
                                    MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                                    validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                                }
                            } else {
                                MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                                
                                // Verifica se depende de variáveis adicionais (sliders)
                                const freeVars = getFreeVariables(ast, [paramName, 'pi', 'e']);
                                const unbound = freeVars.filter(v => StateManager.values[v] === undefined && MathEngine.compiledFuncs[v] === undefined && !definedMatrixNames.has(v));
                                if (unbound.length > 0) {
                                    ExpressionManager.setSliderSuggestions(item.id, unbound, (varName) => {
                                        ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                                        scheduleFrame();
                                    });
                                    ExpressionManager.setError(item.id, `Muitas variáveis. Tente definir: ${unbound.join(', ')}`);
                                    ExpressionManager.setResult(item.id, '');
                                    return;
                                } else {
                                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                                    ExpressionManager.setError(item.id, null);
                                    ExpressionManager.setResult(item.id, '');
                                    // Empurra para plotar no gráfico somente quando todas as variáveis estiverem definidas!
                                    validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                                }
                                
                                // Envia para o Giac para poder ser integrada/derivada simbolicamente!
                                const giacDef = `usr_${funcName}(${paramName}):=${expr}`;
                                if (StateManager.giacDefinitions[funcName] !== giacDef) {
                                    StateManager.giacDefinitions[funcName] = giacDef;
                                    StateManager.casSolutions = {}; // INVALIDE CACHE
                                    MathEngine.askGiac(giacDef);
                                }
                            }
                        }
                    }
                    ExpressionManager.setError(item.id, null);
                } catch(e) {
                    ExpressionManager.setError(item.id, `Erro: ${(e as Error).message}`);
                    ExpressionManager.setResult(item.id, '');
                }
                return; 
            }
        }

        // 3.5. CURVAS POLARES: r = f(theta) ou r = f(t)
        const polarMatch = cleanStr.match(/^\s*r\s*=\s*(.+)$/);
        if (polarMatch) {
            let rExpr = polarMatch[1].trim();
            rExpr = rExpr.replace(/\\theta/g, 'theta').replace(/θ/g, 'theta');
            const thetaVar = rExpr.includes('theta') ? 'theta' : 't';
            try {
                const astR = new PrattParser(rExpr).parseExpression();
                const astX = ["Multiply", astR, ["Cos", thetaVar]];
                const astY = ["Multiply", astR, ["Sin", thetaVar]];

                const tMin = explicitTBounds?.tMin ?? 0;
                const tMax = explicitTBounds?.tMax ?? (2 * Math.PI);

                const freePolar = getFreeVariables(astR, [thetaVar, 'pi', 'e']);
                const unboundPolar = freePolar.filter(v => StateManager.values[v] === undefined && !MathEngine.compiledFuncs[v] && !definedMatrixNames.has(v));
                if (unboundPolar.length > 0) {
                    ExpressionManager.setSliderSuggestions(item.id, unboundPolar, (varName) => {
                        ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                        scheduleFrame();
                    });
                    ExpressionManager.setError(item.id, `Muitas variáveis. Tente definir: ${unboundPolar.join(', ')}`);
                    ExpressionManager.setResult(item.id, '');
                    return;
                } else {
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                    ExpressionManager.setError(item.id, null);
                }

                validEquations.push({
                    color: item.color,
                    id: item.id,
                    ast: astR,
                    isImplicit: false,
                    isEdo: false,
                    isDerivative: false,
                    isParametric: true,
                    astX,
                    astY,
                    tMin,
                    tMax,
                    paramVar: thetaVar,
                    condition: conditionFn,
                    operator: '=',
                    isHidden: !item.visible
                });
                ExpressionManager.setResult(item.id, 'Curva Polar (r = f(θ))');
                return;
            } catch(e) {
                console.warn('[Main] Error processing polar curve:', e);
            }
        }

        // 4. SLIDERS GLOBAIS E DEFINIÇÃO DE MATRIZES
        const assignmentMatch = noSpaceStr.match(/^\\?([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/);
        if (item.isMatrix && !assignmentMatch) {
            ExpressionManager.setResult(item.id, '');
            ExpressionManager.setError(item.id, null);
            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            return;
        }
        if (assignmentMatch) {
            const varName = assignmentMatch[1].replace(/[\\]/g, '');
            const rightSide = assignmentMatch[2];
            const rightSideClean = cleanStr.substring(cleanStr.indexOf('=') + 1).trim();
            
            const blockEl = document.getElementById(item.id);
            const mfEl = blockEl ? blockEl.querySelector('math-field') : null;
            const rawLatex = mfEl ? (mfEl as any).getValue('latex') : '';
            
            // É matriz ou vetor 2D? Verifica se tem estrutura multidimensional ou comando de matriz
            const cleanMatStr = rightSideClean.replace(/\\/g, '');
            const is2DMatrix = item.isMatrix || cleanMatStr.startsWith('[[') || cleanMatStr.startsWith('{{') || 
                               cleanMatStr.includes('],[') || cleanMatStr.includes('};{') ||
                               (cleanMatStr.startsWith('[') && cleanMatStr.includes(';')) ||
                               cleanMatStr.startsWith('matrix') || cleanMatStr.startsWith('begin{') ||
                               rawLatex.includes('matrix}') || rawLatex.includes('\\bmatrix') || rawLatex.includes('\\pmatrix') || rawLatex.includes('\\begin{');
            
            if (is2DMatrix) {
                // Se o rightSideClean tiver lbrace ou begin{matrix}, vamos tentar usar o latex diretamente!
                let giacMatrix = '';
                if (cleanMatStr.startsWith('lbrace') || cleanMatStr.startsWith('begin{') || rawLatex.includes('\\begin{') || !cleanMatStr.includes('{')) {
                    // Limpar o LaTeX para Giac: \{ -> [ e \} -> ]
                    giacMatrix = rawLatex.replace(/\\left\\{/g, '[').replace(/\\right\\}/g, ']')
                                         .replace(/\\{/g, '[').replace(/\\}/g, ']')
                                         .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']')
                                         .replace(/\\begin\{(?:b|p|v|V)?matrix\}/g, '[')
                                         .replace(/\\end\{(?:b|p|v|V)?matrix\}/g, ']')
                                         .replace(/\\\\/g, '],[')
                                         .replace(/&/g, ',')
                                         .replace(/#/g, '')
                                         .replace(/=/g, '').replace(/[a-zA-Z_]+\s*/, ''); 
                    const matchMat = giacMatrix.match(/\[.*\]/);
                    if (matchMat) giacMatrix = matchMat[0];
                } else {
                    giacMatrix = cleanMatStr.replace(/\{/g, '[').replace(/\}/g, ']');
                }
                // Fix missing commas between rows: [[a,b][c,d]] -> [[a,b],[c,d]]
                giacMatrix = giacMatrix.replace(/\]\s*\[/g, '],[');
                const giacDef = `usr_${varName}:=${giacMatrix}`;
                
                // Armazena a matriz nativamente no StateManager.values para cálculo e indexação instantâneos
                try {
                    let parsedMatrix: any = null;
                    try {
                        parsedMatrix = JSON.parse(giacMatrix);
                    } catch (_) {
                        const matAst = new PrattParser(giacMatrix).parseExpression();
                        parsedMatrix = MathEngine.evaluateAST(matAst, StateManager.values);
                    }
                    if (MatrixEngine.isMatrix(parsedMatrix)) {
                        StateManager.defineVariable(varName, parsedMatrix);
                        StateManager.values[varName] = parsedMatrix;
                        activeVars.push(varName);
                    }
                } catch(e) {
                    console.warn('[Main] Erro ao registrar matriz nativa:', e);
                }

                ExpressionManager.setResult(item.id, '');
                ExpressionManager.setError(item.id, null);
                if (blockEl) ExpressionManager.updateMatrixBlockVisual(blockEl, true);
                if (StateManager.giacDefinitions[varName] !== giacDef) {
                    StateManager.giacDefinitions[varName] = giacDef;
                    StateManager.casSolutions = {}; // INVALIDE CACHE SO DEPENDENTS UPDATE!
                    MathEngine.askGiac(giacDef);
                }
                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                return; // Encerra o processamento, pois não queremos renderizar gráfico disto
            } else if (cleanMatStr.startsWith('[') || rightSideClean.includes('for ') || rightSideClean.toLowerCase().includes('polygon(')) {
                // Definição nativa de Listas, Sequências, Matrizes e Vetores Desmos
                try {
                    const listAst = new PrattParser(rightSideClean).parseExpression();
                    const listVal = MathEngine.evaluateAST(listAst, StateManager.values);
                    StateManager.defineVariable(varName, listAst);
                    StateManager.values[varName] = listVal;
                    activeVars.push(varName);
                    ExpressionManager.processBlockState(item.id, ascii, StateManager.values);
                    if (MatrixEngine.isMatrix(listVal)) {
                        ExpressionManager.setResult(item.id, MatrixEngine.formatMatrixDisplay(listVal));
                    } else {
                        ExpressionManager.setResult(item.id, ListEngine.formatListDisplay(listVal));
                    }
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});

                    // Sincroniza com Giac para comandos CAS que dependam de L
                    if (Array.isArray(listVal)) {
                        const giacListStr = `usr_${varName}:=[${listVal.map(v => typeof v === 'number' ? (isNaN(v) ? 'undef' : (!isFinite(v) ? (v > 0 ? 'infinity' : '-infinity') : v)) : JSON.stringify(v)).join(',')}]`;
                        if (StateManager.giacDefinitions[varName] !== giacListStr) {
                            StateManager.giacDefinitions[varName] = giacListStr;
                            MathEngine.askGiac(giacListStr);
                        }
                    }

                    // Se a lista contiver pontos, plota todos os pontos!
                    if (Array.isArray(listVal) && listVal.length > 0 && typeof listVal[0] === 'object' && listVal[0] !== null && 'x' in listVal[0] && 'y' in listVal[0]) {
                        validEquations.push({
                            color: item.color,
                            id: item.id,
                            ast: listAst,
                            isImplicit: false,
                            isEdo: false,
                            isDerivative: false,
                            isPointsList: true,
                            points: listVal,
                            operator: '=',
                            isHidden: !item.visible
                        });
                    }
                    return;
                } catch(e) {
                    console.warn('[Main] Erro ao definir lista/matriz:', e);
                }
            }

            const isMultiVarProd = varName.length > 1 && !varName.includes('_') && /[xyzt]/.test(varName);
            const reservedAssignVars = StateManager.viewMode === '3d' ? ['x', 'y', 'z', 't', 'e', 'pi'] : ['x', 'y', 't', 'e', 'pi'];
            if (!reservedAssignVars.includes(varName) && !isMultiVarProd && !genericCasMatch) {
                // Suporte para declaração de ponto A = (x, y) ou A = (x, y, z)
                let pointAst: any = null;
                try {
                    pointAst = new PrattParser(rightSideClean).parseExpression();
                } catch (e) {
                    console.warn('[Main] Error parsing point assignment:', e);
                }

                if (pointAst && pointAst[0] === 'Point') {
                    const evalX = MathEngine.compile(pointAst[1])(0, 0, StateManager.values);
                    const evalY = MathEngine.compile(pointAst[2])(0, 0, StateManager.values);
                    const is3D = pointAst.length > 3;
                    const evalZ = is3D ? MathEngine.compile(pointAst[3])(0, 0, StateManager.values) : undefined;
                    if (isFinite(evalX) && isFinite(evalY)) {
                        const ptObj: any = { x: evalX, y: evalY };
                        if (is3D && evalZ !== undefined && isFinite(evalZ)) ptObj.z = evalZ;
                        StateManager.defineVariable(varName, pointAst);
                        StateManager.values[varName] = ptObj;
                        activeVars.push(varName);
                        validEquations.push({
                            color: item.color,
                            id: item.id,
                            ast: pointAst,
                            isImplicit: false,
                            isEdo: false,
                            isDerivative: false,
                            isPoint: true,
                            pointX: evalX,
                            pointY: evalY,
                            pointLabel: `${varName}(${parseFloat(evalX.toFixed(3))}, ${parseFloat(evalY.toFixed(3))})`,
                            operator: '=',
                            isHidden: !item.visible
                        });
                        ExpressionManager.setResult(item.id, `= ${PointEngine.formatPointDisplay(ptObj)}`);
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        return;
                    }
                }

                const hasForbiddenCoords = StateManager.viewMode === '3d'
                    ? (/\b[xyz]\b/.test(rightSide) || /\\mathbf\{[xyz]\}/.test(rightSide))
                    : (/\b[xy]\b/.test(rightSide) || /\\mathbf\{[xy]\}/.test(rightSide));
                if (!hasForbiddenCoords) {
                    activeVars.push(varName);
                    try {
                        const parser = new PrattParser(rightSideClean);
                        StateManager.defineVariable(varName, parser.parseExpression());
                        ExpressionManager.processBlockState(item.id, ascii, StateManager.values);
                        ExpressionManager.setResult(item.id, ''); 
                        
                        // Envia variável para o Giac!
                        const giacDef = `usr_${varName}:=${rightSideClean}`;
                        if (StateManager.giacDefinitions[varName] !== giacDef) {
                            StateManager.giacDefinitions[varName] = giacDef;
                            MathEngine.askGiac(giacDef);
                        }
                    } catch (e) {
                        console.warn('[Main] Error defining variable or sending to Giac:', e);
                    }
                    return; 
                }
            }
        } else {
            // Se esta linha não é uma atribuição, esconde qualquer slider residual que possa ter estado nela
            ExpressionManager.processBlockState(item.id, '', {});
        }

        // 5. GRÁFICOS (Implícitas, Explícitas e Derivadas Diretas)
        try {
            let expressaoPlot = cleanStr;
            let isImplicit = false;
            let operator = '=';
            let isDerivativePlot = false;
            let derivVarTarget = 'x';
            
            let isExplicitY = false;
            let isExplicitZ = false;
            
            const zExplicitMatch = StateManager.viewMode === '3d' ? cleanStr.match(/^\s*z\s*=\s*(.+)$/) : null;
            const yExplicitMatch = cleanStr.match(/^\s*y\s*=\s*(.+)$/);
            if (zExplicitMatch) {
                expressaoPlot = zExplicitMatch[1].trim();
                isExplicitZ = true;
            } else if (yExplicitMatch) {
                expressaoPlot = yExplicitMatch[1].trim();
                isExplicitY = true;
            } else {
                // Captura gráficos de derivadas diretas como: diff(sin(x), x) ou d/dx sin(x)
                const directDiffPlot = expressaoPlot.match(/^diff\s*\(\s*(.+?)\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/i);
                if (directDiffPlot) {
                    derivVarTarget = directDiffPlot[2];
                    expressaoPlot = directDiffPlot[1];
                    isDerivativePlot = true;
                } else {
                    const derivPlotMatch = expressaoPlot.match(/^(?:\\frac\{d\}\{d([a-zA-Z])\}|d\/d([a-zA-Z])|\(d\)\/\(d([a-zA-Z])\))(.+)$/);
                    if (derivPlotMatch) {
                        derivVarTarget = derivPlotMatch[1] || derivPlotMatch[2] || derivPlotMatch[3];
                        expressaoPlot = derivPlotMatch[4];
                        isDerivativePlot = true;
                    } else {
                        const implicitMatch = noSpaceStr.match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
                        if (implicitMatch) {
                            const parts = cleanStr.split(implicitMatch[2]);
                            operator = implicitMatch[2];
                            expressaoPlot = `(${parts[0]})-(${parts[1]})`;
                            
                            if (operator !== '=') {
                                isImplicit = true;
                            } else if (implicitMatch[1].includes('z') || implicitMatch[3]?.includes('z') || noSpaceStr.includes('z')) {
                                isImplicit = true;
                            } else if (implicitMatch[1].includes('y') && implicitMatch[1] !== 'y') {
                                isImplicit = true; 
                            } else if (implicitMatch[1].includes('x')) {
                                isImplicit = true;
                            }
                        } else if (!expressaoPlot.includes('x') && expressaoPlot.includes('y') && !expressaoPlot.includes('z')) {
                            expressaoPlot = `x-(${expressaoPlot})`;
                            isImplicit = true;
                            operator = '=';
                        }
                    }
                }
            }

            let ast = new PrattParser(expressaoPlot).parseExpression();
            ast = MathEngine.expandUserFunctions(ast);

            // Suporte para plotagem de pontos individuais ou curvas paramétricas: (x(t), y(t)) ou (x(t), y(t), z(t))
            if (ast && ast[0] === 'Point') {
                const is3D = ast.length > 3;
                const varsX = StateManager.extractVariables(ast[1]);
                const varsY = StateManager.extractVariables(ast[2]);
                const varsZ = is3D ? StateManager.extractVariables(ast[3]) : [];
                const allVars = [...varsX, ...varsY, ...varsZ];
                const isParametric = allVars.includes('t') || allVars.includes('theta') || allVars.includes('u');
                const paramVar = (allVars.includes('theta')) ? 'theta' : (allVars.includes('u') ? 'u' : 't');

                if (isParametric) {
                    const hasTrig = JSON.stringify(ast).toLowerCase().includes('sin') || JSON.stringify(ast).toLowerCase().includes('cos');
                    let tMin = explicitTBounds?.tMin ?? (hasTrig ? 0 : -10);
                    let tMax = explicitTBounds?.tMax ?? (hasTrig ? 2 * Math.PI : 10);
                    const rawTMin = explicitTBounds?.tMin;
                    const rawTMax = explicitTBounds?.tMax;
                    if (tMin === -Infinity) tMin = -100;
                    if (tMax === Infinity) tMax = 100;

                    // Sugestões de sliders para variáveis livres (ex: a, b em (a*cos(t), b*sin(t)))
                    const freeParams = getFreeVariables(ast, [paramVar, 'x', 'y', 'z', 'd', 'pi', 'e']);
                    const unboundParams = freeParams.filter(v => StateManager.values[v] === undefined && !MathEngine.compiledFuncs[v] && !definedMatrixNames.has(v));
                    if (unboundParams.length > 0) {
                        ExpressionManager.setSliderSuggestions(item.id, unboundParams, (varName) => {
                            ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                            scheduleFrame();
                        });
                        ExpressionManager.setError(item.id, `Muitas variáveis. Tente definir: ${unboundParams.join(', ')}`);
                        return;
                    } else {
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        ExpressionManager.setError(item.id, null);
                    }

                    validEquations.push({
                        color: item.color,
                        id: item.id,
                        ast,
                        isImplicit: false,
                        isEdo: false,
                        isDerivative: false,
                        isParametric: true,
                        astX: ast[1],
                        astY: ast[2],
                        astZ: is3D ? ast[3] : undefined,
                        tMin,
                        tMax,
                        paramVar,
                        condition: conditionFn,
                        operator: '=',
                        isHidden: !item.visible
                    });
                    const dispMin = rawTMin === -Infinity ? '-∞' : parseFloat(tMin.toFixed(2));
                    const dispMax = rawTMax === Infinity ? '∞' : parseFloat(tMax.toFixed(2));
                    ExpressionManager.setResult(item.id, `Curva Paramétrica ${is3D ? '3D ' : ''}(${paramVar} ∈ [${dispMin}, ${dispMax}])`);
                    return;
                } else {
                    const evalX = MathEngine.compile(ast[1])(0, 0, StateManager.values);
                    const evalY = MathEngine.compile(ast[2])(0, 0, StateManager.values);
                    const evalZ = is3D ? MathEngine.compile(ast[3])(0, 0, StateManager.values) : 0;
                    if (isFinite(evalX) && isFinite(evalY) && (!is3D || isFinite(evalZ))) {
                        const ptLabel = is3D
                            ? `(${parseFloat(evalX.toFixed(3))}, ${parseFloat(evalY.toFixed(3))}, ${parseFloat(evalZ.toFixed(3))})`
                            : `(${parseFloat(evalX.toFixed(3))}, ${parseFloat(evalY.toFixed(3))})`;
                        validEquations.push({
                            color: item.color,
                            id: item.id,
                            ast,
                            isImplicit: false,
                            isEdo: false,
                            isDerivative: false,
                            isPoint: true,
                            pointX: evalX,
                            pointY: evalY,
                            pointLabel: ptLabel,
                            operator: '=',
                            condition: conditionFn,
                            isHidden: !item.visible
                        });
                        ExpressionManager.setResult(item.id, `= ${ptLabel}`);
                        return;
                    }
                }
            }

            // 4.5. LISTAS, MATRIZES E PONTOS NÃO ATRIBUÍDOS
            if (ast) {
                try {
                    const evalRes = MathEngine.evaluateAST(ast, StateManager.values);
                    if (PointEngine.isPoint(evalRes)) {
                        validEquations.push({
                            color: item.color,
                            id: item.id,
                            ast,
                            isImplicit: false,
                            isEdo: false,
                            isDerivative: false,
                            isPoint: true,
                            pointX: evalRes.x,
                            pointY: evalRes.y,
                            pointLabel: `(${parseFloat(evalRes.x.toFixed(3))}, ${parseFloat(evalRes.y.toFixed(3))})`,
                            operator: '=',
                            isHidden: !item.visible
                        });
                        ExpressionManager.setResult(item.id, `= ${PointEngine.formatPointDisplay(evalRes)}`);
                        ExpressionManager.setError(item.id, null);
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        return;
                    }
                    if (MatrixEngine.isMatrix(evalRes)) {
                        const isPureLiteralMatrix = (ast[0] === 'List' && Array.isArray(ast[1]) && ast[1][0] === 'List') ||
                            /^\[\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\](?:\s*,\s*\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*\s*\])*\]$/.test(cleanStr.trim());
                        if (isPureLiteralMatrix) {
                            ExpressionManager.setResult(item.id, '');
                        } else {
                            ExpressionManager.setResult(item.id, `= ${MatrixEngine.formatMatrixDisplay(evalRes)}`);
                        }
                        ExpressionManager.setError(item.id, null);
                        const curBlock = typeof document !== 'undefined' ? document.getElementById(item.id) : null;
                        if (curBlock) ExpressionManager.updateMatrixBlockVisual(curBlock, true);
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        return;
                    }
                    if (ast[0] === 'Polygon' && Array.isArray(evalRes)) {
                        validEquations.push({
                            color: item.color,
                            id: item.id,
                            ast,
                            isImplicit: false,
                            isEdo: false,
                            isDerivative: false,
                            isPolygon: true,
                            points: evalRes,
                            operator: '=',
                            isHidden: !item.visible
                        });
                        ExpressionManager.setResult(item.id, `Polígono (${evalRes.length} vértices)`);
                        ExpressionManager.setError(item.id, null);
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        return;
                    }
                    if (Array.isArray(evalRes)) {
                        // Verifica se é lista de pontos (ex: malha cartesiana ou múltiplos pontos: (1,1),(2,2))
                        const isListOfPoints = evalRes.length > 0 && typeof evalRes[0] === 'object' && evalRes[0] !== null && 'x' in evalRes[0] && 'y' in evalRes[0];
                        if (isListOfPoints) {
                            validEquations.push({
                                color: item.color,
                                id: item.id,
                                ast,
                                isImplicit: false,
                                isEdo: false,
                                isDerivative: false,
                                isPointsList: true,
                                points: evalRes,
                                operator: '=',
                                isHidden: !item.visible
                            });
                        }
                        ExpressionManager.setResult(item.id, ListEngine.formatListDisplay(evalRes));
                        ExpressionManager.setError(item.id, null);
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                        return;
                    }
                } catch (e) {
                    // segue para outros modos se não for lista/matriz/ponto
                }
            }

            // MODO CALCULADORA (Sem gráficos)
            const isPlot = expressaoPlot.includes('x') || expressaoPlot.includes('y') || expressaoPlot.includes('z');
            if (!isPlot && !isImplicit && !isDerivativePlot && !isExplicitY && !isExplicitZ) {
                // 1. AVALIAÇÃO DIRETA LOCAL (0ms, Instantâneo, Padrão Desmos: números, pontos, matrizes, listas, funções de usuário)
                let localVal: any = undefined;
                if (ast) {
                    try {
                        localVal = MathEngine.evaluateAST(ast, StateManager.values);
                    } catch (_) {}

                    if (localVal === undefined || (typeof localVal === 'number' && isNaN(localVal))) {
                        try {
                            const evalFunc = MathEngine.compile(ast);
                            const compiledVal = evalFunc(0, 0, StateManager.values);
                            if (!isNaN(compiledVal) && isFinite(compiledVal)) {
                                localVal = compiledVal;
                            }
                        } catch (_) {}
                    }
                }

                if (localVal !== undefined && (typeof localVal !== 'number' || (!isNaN(localVal) && isFinite(localVal)))) {
                    if (typeof localVal === 'number') {
                        ExpressionManager.setResult(item.id, '= ' + parseFloat(localVal.toFixed(10)).toString());
                    } else if (PointEngine.isPoint(localVal)) {
                        ExpressionManager.setResult(item.id, '= ' + PointEngine.formatPointDisplay(localVal));
                    } else if (MatrixEngine.isMatrix(localVal)) {
                        ExpressionManager.setResult(item.id, '= ' + MatrixEngine.formatMatrixDisplay(localVal));
                        const curBlock = typeof document !== 'undefined' ? document.getElementById(item.id) : null;
                        if (curBlock) ExpressionManager.updateMatrixBlockVisual(curBlock, true);
                    } else if (Array.isArray(localVal)) {
                        ExpressionManager.setResult(item.id, ListEngine.formatListDisplay(localVal));
                    }
                    ExpressionManager.setError(item.id, null);
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                    return;
                }

                // 2. Comandos CAS avançados ou avaliação via Giac (somente se não pôde ser avaliado localmente)
                const giacVars = Object.keys(StateManager.giacDefinitions);
                const hasGiacVar = giacVars.some(v => new RegExp(`(?:^|(?<=[^a-zA-Z_]))${v}(?=[^a-zA-Z_]|$)`).test(expressaoPlot)) && !StateManager.values.hasOwnProperty(expressaoPlot);
                const isMatrixArithmetic = expressaoPlot.includes('{') || expressaoPlot.includes('[') ||
                    /(?:^|(?<=[^a-zA-Z_]))([A-Za-z_][A-Za-z0-9_]*)\^\{?(?:T|\\top|intercal|-1)\}?/.test(expressaoPlot) ||
                    /\b(rref|det|inv|tran|transpose|rank|matrixrank|trace|tr|eigenvalues|eigenvectors)\s*\(/i.test(expressaoPlot) ||
                    Array.from(definedMatrixNames).some(m => new RegExp(`(?:^|(?<=[^a-zA-Z_]))${m}(?=[^a-zA-Z_]|$)`).test(expressaoPlot));

                if (MathEngine.isGiacCommand(ast) || hasGiacVar || isMatrixArithmetic) {
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                    const currentQuery = expressaoPlot;
                    let cached: any = StateManager.casSolutions[item.id];
                    if (cached && (cached.result.includes('pnt') || cached.result.includes('point[') || cached.result.includes('536870912') || cached.result.includes('Erro'))) {
                        delete StateManager.casSolutions[item.id];
                        cached = undefined;
                    }
                    if (cached && cached.query === currentQuery) {
                        ExpressionManager.setResult(item.id, cached.result.includes('Erro') ? `- Erro no cálculo` : `= ${cached.result}`);
                        ExpressionManager.setError(item.id, null);
                        ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                    } else if (!StateManager.pendingCas[item.id]) {
                        StateManager.pendingCas[item.id] = true;
                        
                        let giacQuery = prefixGiac(expressaoPlot).replace(/\\left\\{/g, '[').replace(/\\right\\}/g, ']')
                                         .replace(/\\{/g, '[').replace(/\\}/g, ']')
                                         .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
                        giacQuery = giacQuery.replace(/\]\s*\[/g, '],[');

                        StateManager.activeGiacQuery[item.id] = currentQuery;
                        MathEngine.askGiac(giacQuery).then(res => {
                            StateManager.pendingCas[item.id] = false;
                            if (StateManager.activeGiacQuery[item.id] !== currentQuery) return; // Stale query, discard!
                            let formattedRes = res.replace(/"/g, '')
                                                  .replace(/matrix\s*\[/g, '[')
                                                  .replace(/list\s*\[/g, '[')
                                                  .replace(/usr_/g, '')
                                                  .trim();
                            
                            // If Giac returns an error or geometric artifact
                            if (formattedRes.includes('Erro') || formattedRes.includes('undef') || formattedRes.includes('Bad Argument') || formattedRes.includes('pnt') || formattedRes.includes('point[') || formattedRes.includes('536870912')) {
                                delete StateManager.casSolutions[item.id];
                                ExpressionManager.setResult(item.id, `- Erro no cálculo`);
                                scheduleFrame();
                                return;
                            }
                            
                            StateManager.casSolutions[item.id] = { query: currentQuery, result: formattedRes, ast: null };
                            ExpressionManager.setResult(item.id, `= ${formattedRes}`);
                            ExpressionManager.setError(item.id, null);
                            ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                            scheduleFrame();
                        });
                    }
                    return;
                }

                // 3. Detecção de Sliders Livres para Variáveis Não Definidas (ex: 'm + 1')
                const boundForSliders = [
                    'x', 'y', ...(StateManager.viewMode === '3d' ? ['z'] : []), 't', 'pi', 'e',
                    ...Object.keys(StateManager.values),
                    ...Object.keys(StateManager.giacDefinitions),
                    ...definedMatrixNames,
                    ...definedUserFunctionNames,
                    ...Object.keys(MathEngine.userFunctions),
                    ...Object.keys(MathEngine.compiledFuncs)
                ];
                const free = FaultTolerantParser.detectFreeVariables(cleanStr, boundForSliders, StateManager.viewMode !== '3d');
                const missingSliders = free.filter(v => 
                    StateManager.values[v] === undefined && 
                    !MathEngine.compiledFuncs[v] &&
                    !StateManager.giacDefinitions[v] &&
                    !definedMatrixNames.has(v) &&
                    !definedUserFunctionNames.has(v) &&
                    !MathEngine.userFunctions[v]
                );
                if (missingSliders.length > 0) {
                    ExpressionManager.setSliderSuggestions(item.id, missingSliders, (varName) => {
                        ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                        scheduleFrame();
                    });
                    ExpressionManager.setError(item.id, null);
                    ExpressionManager.setResult(item.id, '');
                    return;
                }

                ExpressionManager.setError(item.id, null);
                ExpressionManager.setResult(item.id, '');
                return; 
            } else {
                ExpressionManager.setResult(item.id, '');
            }

            // Detecção de parâmetros livres para sugestão de sliders (Estilo Desmos)
            let missingSliders: string[] = [];
            try {
                if (ast && !isEdo) {
                    let boundForSliders = [
                        'x', 'y', ...(StateManager.viewMode === '3d' ? ['z'] : []), 't', 'pi', 'e',
                        ...Object.keys(StateManager.values),
                        ...Object.keys(StateManager.giacDefinitions),
                        ...definedMatrixNames,
                        ...definedUserFunctionNames,
                        ...Object.keys(MathEngine.userFunctions),
                        ...Object.keys(MathEngine.compiledFuncs)
                    ];
                    const funcDeclMatch = ascii.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)\s*=/);
                    if (funcDeclMatch) {
                        const params = funcDeclMatch[2].split(',').map(s => s.trim());
                        boundForSliders.push(...params, funcDeclMatch[1]);
                    }
                    const free = FaultTolerantParser.detectFreeVariables(cleanStr, boundForSliders, StateManager.viewMode !== '3d');
                    missingSliders = free.filter(v => 
                        StateManager.values[v] === undefined && 
                        !MathEngine.compiledFuncs[v] &&
                        !StateManager.giacDefinitions[v] &&
                        !definedMatrixNames.has(v) &&
                        !definedUserFunctionNames.has(v) &&
                        !MathEngine.userFunctions[v]
                    );
                }
            } catch(e) {
                missingSliders = [];
            }

            if (missingSliders.length > 0) {
                ExpressionManager.setSliderSuggestions(item.id, missingSliders, (varName) => {
                    ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                    scheduleFrame();
                });
                const varsList = missingSliders.join(', ');
                ExpressionManager.setError(item.id, `Muitas variáveis. Tente definir: ${varsList}`);
                return;
            } else {
                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                ExpressionManager.setError(item.id, null);
            }

            validEquations.push({ 
                color: item.color, 
                id: item.id, 
                ast, 
                isImplicit, 
                operator, 
                isEdo: false, 
                isDerivative: isDerivativePlot, 
                derivVar: derivVarTarget, 
                condition: conditionFn, 
                isHidden: !item.visible, 
                isExplicitZ,
                lineStyle: item.lineStyle,
                lineWidth: item.lineWidth
            });
        } catch (e: any) {
            // Em vez de engolir o erro com tarjas feias na tela, limpa o result display e sinaliza na margem esquerda (Estilo Desmos)
            ExpressionManager.setResult(item.id, '');
            ExpressionManager.processBlockState(item.id, '', {});
            const inc = FaultTolerantParser.checkIncompleteStatus(item.latex || '', ascii);
            if (ascii.trim().length === 0) {
                ExpressionManager.setError(item.id, null);
                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            } else if (e?.message?.includes('integrando deve terminar') || inc.warning === 'O integrando deve terminar com uma variável de integração, como dx.') {
                ExpressionManager.setError(item.id, 'O integrando deve terminar com uma variável de integração, como dx.');
                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                return;
            } else if (inc.isIncomplete) {
                ExpressionManager.setError(item.id, inc.warning);
            } else {
                ExpressionManager.setError(item.id, 'Expressão incompleta');
            }

            // Tenta detectar parâmetros livres para sugestão de sliders mesmo em estado intermediário (ex: 'sqr' ou 'a*x')
            try {
                const free = FaultTolerantParser.detectFreeVariables(cleanStr, [
                    ...(StateManager.viewMode === '3d' ? ['z'] : []),
                    ...Object.keys(StateManager.values),
                    ...Object.keys(StateManager.giacDefinitions),
                    ...definedMatrixNames,
                    ...definedUserFunctionNames,
                    ...Object.keys(MathEngine.userFunctions)
                ], StateManager.viewMode !== '3d');
                const missingSliders = free.filter(v => 
                    StateManager.values[v] === undefined && 
                    !MathEngine.compiledFuncs[v] &&
                    !MathEngine.userFunctions[v] &&
                    !definedUserFunctionNames.has(v) &&
                    !StateManager.giacDefinitions[v] &&
                    !definedMatrixNames.has(v)
                );
                if (missingSliders.length > 0) {
                    ExpressionManager.setSliderSuggestions(item.id, missingSliders, (varName) => {
                        ExpressionManager.addExpression(`${varName} = 1`, false, undefined, item.id);
                        scheduleFrame();
                    });
                } else {
                    ExpressionManager.setSliderSuggestions(item.id, [], () => {});
                }
            } catch(err) {
                ExpressionManager.setSliderSuggestions(item.id, [], () => {});
            }
        }
    });

    // Sincroniza visual das abas (.dcg-tab): se uma expressão é plotável, restaura o círculo colorido
    const plottableIds = new Set(validEquations.map(eq => eq.id));
    rawData.forEach(item => {
        const block = typeof document !== 'undefined' ? document.getElementById(item.id) : null;
        if (block && plottableIds.has(item.id)) {
            ExpressionManager.updateMatrixBlockVisual(block, false);
        }
    });

    const currentBlockIds = new Set(rawData.map(r => r.id));

    // Run Garbage Collection for deleted sliders and user functions
    StateManager.gc(activeVars, currentBlockIds);

    // Limpeza Instantânea: Remove funções de usuário apagadas ou alteradas
    for (const fName in StateManager.userFunctions) {
        if (!definedUserFunctionNames.has(fName)) {
            delete StateManager.userFunctions[fName];
            delete MathEngine.userFunctions[fName];
            delete MathEngine.compiledFuncs[fName];
            delete StateManager.giacDefinitions[fName];
        }
    }

    // Limpeza de caches CAS de blocos inexistentes
    for (const bId in StateManager.casSolutions) {
        if (!currentBlockIds.has(bId)) {
            delete StateManager.casSolutions[bId];
        }
    }
    for (const bId in StateManager.odeSolutions) {
        if (!currentBlockIds.has(bId)) {
            delete StateManager.odeSolutions[bId];
        }
    }
}


function updateZoomHomeButton() {
    const resetBtn = document.getElementById('reset-view-btn');
    if (!resetBtn) return;
    const expectedYHalf = 10 * (Camera.height / (Camera.width || 1));
    const isAtDefault = StateManager.viewMode === '3d'
        ? (Math.abs(Camera3D.distance - 18) < 1e-2 && Math.abs(Camera3D.theta - Math.PI / 4) < 1e-2 && Math.abs(Camera3D.phi - Math.PI / 6) < 1e-2 && Math.abs(Camera3D.target[0]) < 1e-3 && Math.abs(Camera3D.target[1]) < 1e-3 && Math.abs(Camera3D.target[2]) < 1e-3)
        : (!Camera.hasUserInteracted || (Math.abs(Camera.xMin - (-10)) < 1e-3 && Math.abs(Camera.xMax - 10) < 1e-3 && Math.abs(Camera.yMin - (-expectedYHalf)) < 1e-3 && Math.abs(Camera.yMax - expectedYHalf) < 1e-3));
    
    if (isAtDefault) {
        resetBtn.classList.add('hidden');
        resetBtn.classList.remove('flex');
    } else {
        resetBtn.classList.remove('hidden');
        resetBtn.classList.add('flex');
    }
}

function drawFrame() {
    if (expressionsDirty) {
        compileAllExpressions();
        expressionsDirty = false;
    }

    glRenderer.clear();
    renderer.clear();
    renderer.drawAxes(hoverX, hoverY);
    syncGraphSettingsUI();

    renderMemory_points = [];
    renderMemory_curves = [];
    renderMemory_segments = [];
    renderMemory_curve_points = [];
    draggableCanvasPoints = [];

    // --- RENDERIZAÇÃO 3D ---
    if (StateManager.viewMode === '3d') {
        const surfaces3D: Surface3DItem[] = [];

        validEquations.forEach((item, index) => {
            if (item.isHidden) return;
            const color = item.color || colors[index % colors.length];

            // 1. Superfície Explícita z = f(x, y) ou função dependente de x e y
            if (item.ast && (item.isExplicitZ || (!item.isImplicit && !item.isParametric && !item.isPoint && !item.isEdo && !item.isIvp))) {
                const free = getFreeVariables(item.ast, []);
                if (item.isExplicitZ || free.includes('x') || free.includes('y')) {
                    const fastZ = MathEngine.compileMultivariable(item.ast, ['x', 'y']);
                    surfaces3D.push({
                        id: item.id,
                        color,
                        isImplicit: false,
                        funcZ: (x, y, s) => fastZ(x, y, s),
                        name: item.name
                    });
                }
            }
            // 2. Superfície Implícita 3D F(x, y, z) = 0 via Raymarching
            else if (item.isImplicit && item.ast) {
                let glsl = '';
                const usedUniforms = new Set<string>();
                try {
                    if (Array.isArray(item.ast) && item.ast[0] === 'Equal') {
                        const left = GLRenderer.astToGLSL(item.ast[1], StateManager.values, usedUniforms);
                        const right = GLRenderer.astToGLSL(item.ast[2], StateManager.values, usedUniforms);
                        glsl = `(${left}) - (${right})`;
                    } else {
                        glsl = GLRenderer.astToGLSL(item.ast, StateManager.values, usedUniforms);
                    }
                } catch(err) {
                    console.warn('[Main] Error compiling 3D GLSL surface:', err);
                }

                if (glsl) {
                    surfaces3D.push({
                        id: item.id,
                        color,
                        isImplicit: true,
                        glslExpr: glsl,
                        name: item.name
                    });
                }
            }
            // 3. Curva Paramétrica 3D (x(t), y(t), z(t))
            else if (item.isParametric && item.astX && item.astY) {
                const paramVar = item.paramVar || 't';
                const fastX = MathEngine.compile(item.astX, paramVar);
                const fastY = MathEngine.compile(item.astY, paramVar);
                const fastZ = item.astZ ? MathEngine.compile(item.astZ, paramVar) : () => 0;
                surfaces3D.push({
                    id: item.id,
                    color,
                    isImplicit: false,
                    parametric: (t, s) => [fastX(t, 0, s), fastY(t, 0, s), fastZ(t, 0, s)],
                    tMin: item.tMin ?? -10,
                    tMax: item.tMax ?? 10
                });
            }
        });

        renderer3d.render(surfaces3D, StateManager.values);
        return;
    }

    const explicitCurves: { f: (x: number) => number, color: string }[] = [];

    // --- RENDERIZAÇÃO 2D ---
    validEquations.forEach((item, index) => {
        if (item.isHidden) return;
        
        const color = item.color || colors[index % colors.length];

        if ((item as any).isTable && (item as any).tablePoints) {
            const tablePoints = (item as any).tablePoints as { x: number, y: number, rowIndex: number, tableBlockId: string }[];
            if ((item as any).connectLines && tablePoints.length > 1) {
                renderer.drawCurve(tablePoints, color, item.lineStyle || 'solid', item.lineWidth || 2);
                renderMemory_curve_points.push({ points: tablePoints, color });
            }
            tablePoints.forEach(tp => {
                const label = `(${tp.x}, ${tp.y})`;
                renderer.drawDiscretePoint(tp.x, tp.y, color, label);
                renderMemory_points.push({ mathX: tp.x, mathY: tp.y, type: 'point', color, label });
                draggableCanvasPoints.push({
                    mathX: tp.x,
                    mathY: tp.y,
                    color,
                    type: 'table',
                    tableBlockId: tp.tableBlockId,
                    rowIndex: tp.rowIndex
                });
            });
            return;
        }

        if (item.isPolygon && Array.isArray(item.points)) {
            renderer.drawPolygon(item.points, color);
            return;
        }

        if (item.isPointsList && Array.isArray(item.points)) {
            renderer.drawPoints(item.points, color);
            item.points.forEach(p => {
                const label = `(${p.x}, ${p.y})`;
                renderMemory_points.push({ mathX: p.x, mathY: p.y, type: 'point', color, label });
            });
            return;
        }

        if (item.isPoint && typeof item.pointX === 'number' && typeof item.pointY === 'number') {
            renderer.drawDiscretePoint(item.pointX, item.pointY, color, item.pointLabel);
            renderMemory_points.push({ mathX: item.pointX, mathY: item.pointY, type: 'point', color, label: item.pointLabel });
            draggableCanvasPoints.push({
                mathX: item.pointX,
                mathY: item.pointY,
                color,
                type: 'expression',
                exprBlockId: item.id
            });
        } else if (item.isEdo) {
            // Desenha o slope field
            const indep = item.indepVar || 'x';
            const dep = item.depVar || item.name || 'y';
            const compiledEdo = MathEngine.compile(item.ast, indep, dep); 
            renderer.drawSlopeField(compiledEdo, StateManager.values, color);
            // Armazena a EDO
            MathEngine.compiledFuncs[dep + "_edo"] = compiledEdo;
            if (item.name) MathEngine.compiledFuncs[item.name + "_edo"] = compiledEdo;

        } else if (item.isIvp) {
            // Pinta a curva da solução da EDO
            const ivpItem = item as any;
            const compiledEdo = MathEngine.compiledFuncs[ivpItem.name + "_edo"] || MathEngine.compiledFuncs["y_edo"];
            if (compiledEdo) {
                const allPoints = ODESolver.solveBidirectional(
                    (t: number, y: number) => compiledEdo(t, y, StateManager.values),
                    ivpItem.x0,
                    ivpItem.y0,
                    Camera.xMin,
                    Camera.xMax
                );
                
                renderer.drawCurve(allPoints, color, item.lineStyle, item.lineWidth);
                renderMemory_curve_points.push({ points: allPoints, color });
            }
        } else if (item.isParametric) {
            const paramVar = item.paramVar || 't';
            const fastX = MathEngine.compile(item.astX, paramVar);
            const fastY = MathEngine.compile(item.astY, paramVar);
            const tMin = item.tMin ?? 0;
            const tMax = item.tMax ?? (2 * Math.PI);
            const steps = 800;
            const dt = (tMax - tMin) / steps;
            const pontos: { x: number, y: number }[] = [];

            for (let i = 0; i <= steps; i++) {
                const tVal = tMin + i * dt;
                const px = fastX(tVal, 0, StateManager.values);
                const py = fastY(tVal, 0, StateManager.values);
                if (item.condition && !item.condition(px, py, StateManager.values, tVal)) {
                    pontos.push({ x: px, y: NaN });
                } else if (!isFinite(px) || !isFinite(py) || isNaN(px) || isNaN(py)) {
                    pontos.push({ x: px, y: NaN });
                } else {
                    pontos.push({ x: px, y: py });
                }
            }

            renderer.drawCurve(pontos, color, item.lineStyle, item.lineWidth);
            renderMemory_curve_points.push({ points: pontos, color });

        } else if (item.isDerivative) {
            const derivFunc = MathEngine.createDerivativeFunction(item.ast, item.derivVar || 'x');
            const f = (x: number) => derivFunc(x, 0, StateManager.values);
            
            // Usa amostragem adaptativa em vez de um loop fixo de 300 pontos
            const derivAst = item.ast;
            const derivVar = item.derivVar || 'x';
            const pontos = MathEngine.generatePointsAdaptive(derivAst, Camera.xMin, Camera.xMax, StateManager.values, derivVar, canvasEl.clientWidth || Camera.width)
                .map(p => ({ x: p.x, y: f(p.x) }));

            renderer.drawCurve(pontos, color, item.lineStyle, item.lineWidth);
            explicitCurves.push({ f, color });
            renderMemory_curves.push({ f, color }); 

        } else if (item.isImplicit) {
            glRenderer.drawImplicit(item.ast, item.operator, StateManager.values, color);
            // Marching Squares para popular renderMemory_segments quando for igualdade '=' (apenas quando não estiver arrastando a tela)
            if (item.operator === '=' && !isDragging) {
                const marchRes = ImplicitEngine.generateImplicit(item.id, item.ast, item.operator, StateManager.values, Camera.xMin, Camera.xMax, Camera.yMin, Camera.yMax);
                if (marchRes && marchRes.segments) {
                    for (const seg of marchRes.segments) {
                        renderMemory_segments.push({ x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, color });
                    }
                }
            }

        } else if (Array.isArray(item.ast) && item.ast[0] === 'Integrate' && !isNaN(MathEngine.evaluateAST(item.ast[3], StateManager.values)) && !isNaN(MathEngine.evaluateAST(item.ast[4], StateManager.values))) {
            const funcAst = item.ast[1]; const minAst = item.ast[3]; const maxAst = item.ast[4];
            const minVal = MathEngine.evaluateAST(minAst, StateManager.values);
            const maxVal = MathEngine.evaluateAST(maxAst, StateManager.values);

            const pontos = MathEngine.generatePointsAdaptive(funcAst, minVal, maxVal, StateManager.values, 'x', canvasEl.width);
            let area = 0;
            if (pontos.length > 1) {
                for (let i = 0; i < pontos.length - 1; i++) {
                    const dx = pontos[i+1].x - pontos[i].x;
                    area += ((pontos[i].y + pontos[i+1].y) / 2) * dx;
                }
            }
            ExpressionManager.setResult(item.id, '= ' + parseFloat(area.toFixed(4)).toString());
        } else {
            const fastF = MathEngine.compile(item.ast, item.variable || 'x');
            const f = (x: number) => {
                if (item.condition && !item.condition(x, 0, StateManager.values)) return NaN;
                return fastF(x, 0, StateManager.values);
            };
            const pontos = MathEngine.generatePointsAdaptive(item.ast, Camera.xMin, Camera.xMax, StateManager.values, item.variable || 'x', canvasEl.clientWidth || Camera.width)
                .map(p => ({ x: p.x, y: f(p.x) }));
            
            renderer.drawCurve(pontos, color, item.lineStyle, item.lineWidth);
            explicitCurves.push({ f, color });
            renderMemory_curves.push({ f, color }); 
        }
    });

    // --- ANÁLISE DE PONTOS NOTÁVEIS (DESMOS STYLE COM CACHE) ---
    const currentNotableKey = `${Camera.xMin.toFixed(4)}_${Camera.xMax.toFixed(4)}_${StateManager.varVersions['__global__'] || 0}_${explicitCurves.length}_${isDragging}`;
    if (currentNotableKey === cachedNotablePointsKey) {
        renderMemory_points.push(...cachedNotablePointsList);
    } else {
        const computedPoints: typeof renderMemory_points = [];
        for (let i = 0; i < explicitCurves.length; i++) {
            const curve = explicitCurves[i];
            const points = MathAnalyzer.getNotablePoints(curve.f, Camera.xMin, Camera.xMax);
            
            points.forEach(p => {
                const h = 1e-5;
                const dfVal = (curve.f(p.x + h) - curve.f(p.x - h)) / (2 * h);
                computedPoints.push({ 
                    mathX: p.x, 
                    mathY: p.y, 
                    type: p.type, 
                    color: curve.color, 
                    curveF: curve.f, 
                    slope: isFinite(dfVal) ? dfVal : undefined 
                });
            });

            if (!isDragging) {
                for (let j = i + 1; j < explicitCurves.length; j++) {
                    const other = explicitCurves[j];
                    const intersects = MathAnalyzer.getIntersections(curve.f, other.f, Camera.xMin, Camera.xMax);
                    intersects.forEach(p => computedPoints.push({ 
                        mathX: p.x, 
                        mathY: p.y, 
                        type: 'intersect', 
                        color: '#64748b', 
                        curveF: curve.f 
                    }));
                }
            }
        }
        cachedNotablePointsKey = currentNotableKey;
        cachedNotablePointsList = computedPoints;
        renderMemory_points.push(...computedPoints);
    }

    // Renderiza os pontos notáveis com o método dedicado de snapping
    renderMemory_points.forEach(np => {
        const isHovered = hoveredNotablePoint ? (Math.abs(hoveredNotablePoint.mathX - np.mathX) < 1e-4 && Math.abs(hoveredNotablePoint.mathY - np.mathY) < 1e-4) : false;
        renderer.drawNotablePoint({
            x: np.mathX,
            y: np.mathY,
            color: np.color,
            isHovered,
            type: np.type
        });
    });

    // Renderiza etiquetas e pontos fixados (Pinned Points)
    pinnedPoints.forEach(pp => {
        if (pp.curveF) {
            const curY = pp.curveF(pp.mathX);
            if (!isNaN(curY) && isFinite(curY)) {
                pp.mathY = curY;
                const h = 1e-5;
                const dfVal = (pp.curveF(pp.mathX + h) - pp.curveF(pp.mathX - h)) / (2 * h);
                if (isFinite(dfVal)) pp.slope = dfVal;
            }
        }
        const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
        const text = `(${formatCoord(pp.mathX)}, ${formatCoord(pp.mathY)})`;
        renderer.drawPinnedPointBadge({
            x: pp.mathX,
            y: pp.mathY,
            text,
            color: pp.color,
            type: pp.type,
            showTangent: pp.showTangent,
            slope: pp.slope
        });
    });

    if (globalTracePoint) {
        renderer.drawDiscretePoint(globalTracePoint.x, globalTracePoint.y, globalTracePoint.color);
    }
    updateZoomHomeButton();
}

ExpressionManager.init(markExpressionsDirty);
(window as any).ExpressionManager = ExpressionManager;
(window as any).StateManager = StateManager;

CommandsGuideModal.init((exampleExpr) => {
    ExpressionManager.addExpression(exampleExpr);
    scheduleFrame();
});
(window as any)._toggleCommandsGuide = () => CommandsGuideModal.show();

// ─── HANDLERS GLOBAIS DOS BOTÕES DO HUD ───────────────────────────────────────

/** Repõe a vista para o estado padrão (zoom 1:1, centrado na origem) */

// --- CONFIGURAÇÕES DO GRÁFICO (Estilo Desmos: Popover Flutuante) ---
function syncGraphSettingsUI() {
    const popover = document.getElementById('graph-settings-popover');
    if (!popover || popover.classList.contains('hidden')) return;

    const xminInput = document.getElementById('setting-xmin') as HTMLInputElement;
    const xmaxInput = document.getElementById('setting-xmax') as HTMLInputElement;
    const yminInput = document.getElementById('setting-ymin') as HTMLInputElement;
    const ymaxInput = document.getElementById('setting-ymax') as HTMLInputElement;

    if (xminInput && document.activeElement !== xminInput) xminInput.value = Camera.xMin.toFixed(2);
    if (xmaxInput && document.activeElement !== xmaxInput) xmaxInput.value = Camera.xMax.toFixed(2);
    if (yminInput && document.activeElement !== yminInput) yminInput.value = Camera.yMin.toFixed(2);
    if (ymaxInput && document.activeElement !== ymaxInput) ymaxInput.value = Camera.yMax.toFixed(2);
}

function updateGridButtons() {
    const btnCartesian = document.getElementById('grid-type-cartesian');
    const btnPolar = document.getElementById('grid-type-polar');
    if (!btnCartesian || !btnPolar) return;
    if (StateManager.gridType === 'polar') {
        btnPolar.classList.add('bg-white', 'text-blue-600', 'shadow-xs');
        btnPolar.classList.remove('hover:text-gray-900');
        btnCartesian.classList.remove('bg-white', 'text-blue-600', 'shadow-xs');
        btnCartesian.classList.add('hover:text-gray-900');
    } else {
        btnCartesian.classList.add('bg-white', 'text-blue-600', 'shadow-xs');
        btnCartesian.classList.remove('hover:text-gray-900');
        btnPolar.classList.remove('bg-white', 'text-blue-600', 'shadow-xs');
        btnPolar.classList.add('hover:text-gray-900');
    }
}

function updateAngleButtons() {
    const btnRad = document.getElementById('angle-mode-radians');
    const btnDeg = document.getElementById('angle-mode-degrees');
    if (!btnRad || !btnDeg) return;
    if (StateManager.angleMode === 'degrees') {
        btnDeg.classList.add('bg-white', 'text-blue-600', 'shadow-xs');
        btnDeg.classList.remove('hover:text-gray-900');
        btnRad.classList.remove('bg-white', 'text-blue-600', 'shadow-xs');
        btnRad.classList.add('hover:text-gray-900');
    } else {
        btnRad.classList.add('bg-white', 'text-blue-600', 'shadow-xs');
        btnRad.classList.remove('hover:text-gray-900');
        btnDeg.classList.remove('bg-white', 'text-blue-600', 'shadow-xs');
        btnDeg.classList.add('hover:text-gray-900');
    }
}

(window as any)._toggleSettings = () => {
    const popover = document.getElementById('graph-settings-popover');
    if (popover) {
        const isHidden = popover.classList.contains('hidden');
        if (isHidden) {
            popover.classList.remove('hidden');
            popover.classList.add('flex');
            
            const xminInput = document.getElementById('setting-xmin') as HTMLInputElement;
            const xmaxInput = document.getElementById('setting-xmax') as HTMLInputElement;
            const yminInput = document.getElementById('setting-ymin') as HTMLInputElement;
            const ymaxInput = document.getElementById('setting-ymax') as HTMLInputElement;
            const xstepInput = document.getElementById('setting-xstep') as HTMLInputElement;
            const ystepInput = document.getElementById('setting-ystep') as HTMLInputElement;
            const xlabelInput = document.getElementById('setting-xlabel') as HTMLInputElement;
            const ylabelInput = document.getElementById('setting-ylabel') as HTMLInputElement;
            const axesCb = document.getElementById('setting-axes') as HTMLInputElement;
            const arrowsCb = document.getElementById('setting-arrows') as HTMLInputElement;
            const gridCb = document.getElementById('setting-grid') as HTMLInputElement;
            const projCb = document.getElementById('setting-projector') as HTMLInputElement;

            if (xminInput) xminInput.value = Camera.xMin.toFixed(2);
            if (xmaxInput) xmaxInput.value = Camera.xMax.toFixed(2);
            if (yminInput) yminInput.value = Camera.yMin.toFixed(2);
            if (ymaxInput) ymaxInput.value = Camera.yMax.toFixed(2);
            if (xstepInput) xstepInput.value = formatStepForDisplay(StateManager.xStep);
            if (ystepInput) ystepInput.value = formatStepForDisplay(StateManager.yStep);
            if (xlabelInput) xlabelInput.value = StateManager.xLabel || '';
            if (ylabelInput) ylabelInput.value = StateManager.yLabel || '';
            if (axesCb) axesCb.checked = StateManager.showAxes;
            if (arrowsCb) arrowsCb.checked = StateManager.showArrows;
            if (gridCb) gridCb.checked = renderer.showGrid && StateManager.gridType !== 'none';
            if (projCb) projCb.checked = StateManager.projectorMode;

            updateGridButtons();
            updateAngleButtons();
        } else {
            popover.classList.add('hidden');
            popover.classList.remove('flex');
        }
    }
};

(window as any)._updateSettings = () => {
    const axesCb = document.getElementById('setting-axes') as HTMLInputElement;
    const gridCb = document.getElementById('setting-grid') as HTMLInputElement;
    if (axesCb && gridCb) {
        renderer.showAxes = axesCb.checked;
        StateManager.showAxes = axesCb.checked;
        renderer.showGrid = gridCb.checked;
        if (!gridCb.checked) StateManager.gridType = 'none';
        else if (StateManager.gridType === 'none') StateManager.gridType = 'cartesian';
        drawFrame();
    }
};


export { parseStepInput, formatStepForDisplay };

function initSettingsPopoverListeners() {
    const popover = document.getElementById('graph-settings-popover');
    const settingsBtn = document.getElementById('settings-btn');
    if (!popover) return;

    // Fechar ao clicar fora
    document.addEventListener('pointerdown', (e) => {
        if (!popover.classList.contains('hidden') && !popover.contains(e.target as Node) && settingsBtn && !settingsBtn.contains(e.target as Node)) {
            popover.classList.add('hidden');
            popover.classList.remove('flex');
        }
    });

    const applyLimits = () => {
        const x1 = parseFloat((document.getElementById('setting-xmin') as HTMLInputElement)?.value);
        const x2 = parseFloat((document.getElementById('setting-xmax') as HTMLInputElement)?.value);
        const y1 = parseFloat((document.getElementById('setting-ymin') as HTMLInputElement)?.value);
        const y2 = parseFloat((document.getElementById('setting-ymax') as HTMLInputElement)?.value);
        if (Number.isFinite(x1) && Number.isFinite(x2) && x2 > x1) {
            Camera.xMin = x1;
            Camera.xMax = x2;
            Camera.hasUserInteracted = true;
        }
        if (Number.isFinite(y1) && Number.isFinite(y2) && y2 > y1) {
            Camera.yMin = y1;
            Camera.yMax = y2;
            Camera.hasUserInteracted = true;
        }
        drawFrame();
    };

    ['setting-xmin', 'setting-xmax', 'setting-ymin', 'setting-ymax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', applyLimits);
            el.addEventListener('keydown', (e: any) => { if (e.key === 'Enter') applyLimits(); });
        }
    });

    document.getElementById('setting-xstep')?.addEventListener('input', (e: any) => {
        StateManager.xStep = parseStepInput(e.target.value);
        drawFrame();
    });

    document.getElementById('setting-ystep')?.addEventListener('input', (e: any) => {
        StateManager.yStep = parseStepInput(e.target.value);
        drawFrame();
    });

    document.getElementById('setting-xlabel')?.addEventListener('input', (e: any) => {
        StateManager.xLabel = e.target.value || '';
        drawFrame();
    });

    document.getElementById('setting-ylabel')?.addEventListener('input', (e: any) => {
        StateManager.yLabel = e.target.value || '';
        drawFrame();
    });

    document.getElementById('setting-axes')?.addEventListener('change', (e: any) => {
        StateManager.showAxes = e.target.checked;
        renderer.showAxes = e.target.checked;
        drawFrame();
    });

    document.getElementById('setting-arrows')?.addEventListener('change', (e: any) => {
        StateManager.showArrows = e.target.checked;
        drawFrame();
    });

    document.getElementById('setting-grid')?.addEventListener('change', (e: any) => {
        renderer.showGrid = e.target.checked;
        if (!e.target.checked) {
            StateManager.gridType = 'none';
        } else if (StateManager.gridType === 'none') {
            StateManager.gridType = 'cartesian';
        }
        updateGridButtons();
        drawFrame();
    });

    document.getElementById('setting-projector')?.addEventListener('change', (e: any) => {
        StateManager.projectorMode = e.target.checked;
        drawFrame();
    });

    document.getElementById('grid-type-cartesian')?.addEventListener('click', () => {
        StateManager.gridType = 'cartesian';
        renderer.showGrid = true;
        const gridCb = document.getElementById('setting-grid') as HTMLInputElement;
        if (gridCb) gridCb.checked = true;
        updateGridButtons();
        drawFrame();
    });

    document.getElementById('grid-type-polar')?.addEventListener('click', () => {
        StateManager.gridType = 'polar';
        renderer.showGrid = true;
        const gridCb = document.getElementById('setting-grid') as HTMLInputElement;
        if (gridCb) gridCb.checked = true;
        updateGridButtons();
        drawFrame();
    });

    document.getElementById('angle-mode-radians')?.addEventListener('click', () => {
        StateManager.angleMode = 'radians';
        updateAngleButtons();
        compileAllExpressions();
        drawFrame();
    });

    document.getElementById('angle-mode-degrees')?.addEventListener('click', () => {
        StateManager.angleMode = 'degrees';
        updateAngleButtons();
        compileAllExpressions();
        drawFrame();
    });
}

(window as any)._resetView = () => {
    if (StateManager.viewMode === '3d') {
        Camera3D.reset();
        renderer3d.resize();
    } else {
        Camera.reset();
        renderer.resize();
        glRenderer.resize();
    }
    drawFrame();
};

let activeZoomAnimation: number | null = null;

function animateSmoothZoom(targetScaleFactor: number, duration: number = 200) {
    if (activeZoomAnimation !== null) {
        cancelAnimationFrame(activeZoomAnimation);
        activeZoomAnimation = null;
    }

    if (StateManager.viewMode === '3d') {
        Camera3D.zoom(targetScaleFactor);
        drawFrame();
        return;
    }

    const startXMin = Camera.xMin;
    const startXMax = Camera.xMax;
    const startYMin = Camera.yMin;
    const startYMax = Camera.yMax;

    const centerX = (startXMin + startXMax) / 2;
    const centerY = (startYMin + startYMax) / 2;
    const halfSpanX = ((startXMax - startXMin) * targetScaleFactor) / 2;
    const halfSpanY = ((startYMax - startYMin) * targetScaleFactor) / 2;

    const targetXMin = centerX - halfSpanX;
    const targetXMax = centerX + halfSpanX;
    const targetYMin = centerY - halfSpanY;
    const targetYMax = centerY + halfSpanY;

    if (targetXMax - targetXMin <= 1e-8 || targetYMax - targetYMin <= 1e-8) return;

    const startTime = performance.now();

    function step(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Desmos cubic ease-out: 1 - (1 - progress)^3
        const ease = 1 - Math.pow(1 - progress, 3);

        Camera.xMin = startXMin + (targetXMin - startXMin) * ease;
        Camera.xMax = startXMax + (targetXMax - startXMax) * ease;
        Camera.yMin = startYMin + (targetYMin - startYMin) * ease;
        Camera.yMax = startYMax + (targetYMax - startYMax) * ease;

        drawFrame();

        if (progress < 1) {
            activeZoomAnimation = requestAnimationFrame(step);
        } else {
            Camera.xMin = targetXMin;
            Camera.xMax = targetXMax;
            Camera.yMin = targetYMin;
            Camera.yMax = targetYMax;
            activeZoomAnimation = null;
            drawFrame();
        }
    }

    activeZoomAnimation = requestAnimationFrame(step);
}

(window as any)._zoomIn = () => {
    animateSmoothZoom(0.5, 200);
};

(window as any)._zoomOut = () => {
    animateSmoothZoom(2.0, 200);
};

/** Limpa todas as expressões e reinicia o estado */
(window as any)._clearAll = () => {
    if (!confirm('Limpar todas as expressões?')) return;
    const list = document.getElementById('expressions-list');
    if (list) list.innerHTML = '';
    ExpressionManager.blockCounter = 0;
    StateManager.clearAll();
    StateManager.updateViewportDimensions(Camera.width, Camera.height);
    MathEngine.userFunctions = {};
    MathEngine.initCompiledFuncs();
    ImplicitEngine.clearCache();
    pinnedPoints = [];
    (window as any)._pinnedPoints = pinnedPoints;
    hoveredNotablePoint = null;
    ExpressionManager.addBlock();
    HistoryManager.recordState(true);
    drawFrame();
};

initSettingsPopoverListeners();

// Inicialização — resize inicial obrigatório antes do primeiro draw
resizeAll();
drawFrame();

// Inicializa ícones Lucide no documento
setTimeout(() => { if ((window as any).lucide) (window as any).lucide.createIcons(); }, 100);

// --- TECLADO VIRTUAL PERSONALIZADO MATHLIVE (Estilo Desmos / GeoGebra) ---
setTimeout(() => {
    if ((window as any).mathVirtualKeyboard) {
        (window as any).mathVirtualKeyboard.layouts = [
            {
                label: '123',
                tooltip: 'Álgebra e Números',
                rows: [
                    [
                        { latex: "x" },
                        { latex: "y" },
                        { latex: "a^2", insert: "^2" },
                        { latex: "a^b", insert: "^{#?}" },
                        { latex: "\\sqrt{x}", insert: "\\sqrt{#?}" },
                        { latex: "\\frac{a}{b}", insert: "\\frac{#?}{#?}" },
                        { latex: "\\pi" },
                        { latex: "e" }
                    ],
                    [
                        { insert: "7", label: "7" },
                        { insert: "8", label: "8" },
                        { insert: "9", label: "9" },
                        { latex: "\\times", insert: "*" },
                        { latex: "\\div", insert: "/" },
                        { latex: "(" },
                        { latex: ")" },
                        { insert: "'", label: "a'", tooltip: "Derivada (plica)" }
                    ],
                    [
                        { insert: "4", label: "4" },
                        { insert: "5", label: "5" },
                        { insert: "6", label: "6" },
                        { latex: "+" },
                        { latex: "-" },
                        { latex: "<" },
                        { latex: ">" },
                        { latex: "t" }
                    ],
                    [
                        { insert: "1", label: "1" },
                        { insert: "2", label: "2" },
                        { insert: "3", label: "3" },
                        { latex: "=" },
                        { latex: "\\le" },
                        { latex: "\\ge" },
                        { class: "action", label: "←", tooltip: "Mover cursor à esquerda", command: ["performWithFeedback", "moveToPreviousChar"] },
                        { class: "action", label: "→", tooltip: "Mover cursor à direita", command: ["performWithFeedback", "moveToNextChar"] }
                    ],
                    [
                        { insert: "0", label: "0" },
                        { insert: ".", label: "." },
                        { label: "(-)", tooltip: "Negativo", insert: "(-#?)" },
                        { class: "separator w5" },
                        { class: "action font-glyph w20", label: "&#x232b;", tooltip: "Apagar", command: ["performWithFeedback", "deleteBackward"] },
                        { class: "action font-glyph w20", label: "&#x23ce;", tooltip: "Enter / Nova Linha", command: ["performWithFeedback", "commit"] }
                    ]
                ]
            },
            {
                label: 'calc',
                tooltip: 'Cálculo Diferencial, Integral e EDOs',
                rows: [
                    [
                        { insert: "\\frac{d}{dx}\\left(#?\\right)", latex: "\\frac{d}{dx}" },
                        { insert: "\\frac{d^2}{dx^2}\\left(#?\\right)", latex: "\\frac{d^2}{dx^2}" },
                        { insert: "\\frac{\\partial}{\\partial x}\\left(#?\\right)", latex: "\\frac{\\partial}{\\partial x}" },
                        { insert: "\\int #? d x", latex: "\\int" },
                        { insert: "\\int_{#?}^{#?} #? d x", latex: "\\int_a^b" },
                        { insert: "\\sum_{n=#?}^{#?} #?", latex: "\\sum" },
                        { insert: "\\prod_{n=#?}^{#?} #?", latex: "\\prod" },
                        { latex: "\\infty" }
                    ],
                    [
                        { insert: "\\lim_{x \\to #?} #?", latex: "\\lim" },
                        { insert: "\\lim_{x \\to \\infty} #?", latex: "\\lim_{x\\to\\infty}" },
                        { insert: "y' = #?", label: "y'", tooltip: "Equação Diferencial y'" },
                        { insert: "y'' = #?", label: "y''", tooltip: "Equação Diferencial y''" },
                        { insert: "SolveODE(#?)", label: "SolveODE", tooltip: "Resolver EDO" },
                        { insert: "Campo(#?)", label: "Campo", tooltip: "Campo de Direções" },
                        { insert: "Taylor(#?, x, 0, 4)", label: "Taylor", tooltip: "Série de Taylor" },
                        { insert: "\\nabla", latex: "\\nabla" }
                    ],
                    [
                        { insert: "ln(#?)", latex: "\\ln" },
                        { insert: "log(#?)", latex: "\\log" },
                        { insert: "log_{#?}(#?)", latex: "\\log_b" },
                        { insert: "e^{#?}", latex: "e^x" },
                        { insert: "f(x) = #?", label: "f(x)" },
                        { insert: "f(x, y) = #?", label: "f(x, y)" },
                        { latex: "\\theta" },
                        { latex: "\\pi" }
                    ],
                    [
                        { class: "action", label: "←", command: ["performWithFeedback", "moveToPreviousChar"] },
                        { class: "action", label: "→", command: ["performWithFeedback", "moveToNextChar"] },
                        { class: "separator w10" },
                        { class: "action font-glyph w20", label: "&#x232b;", command: ["performWithFeedback", "deleteBackward"] },
                        { class: "action font-glyph w20", label: "&#x23ce;", command: ["performWithFeedback", "commit"] }
                    ]
                ]
            },
            {
                label: 'CAS',
                tooltip: 'Computação Algébrica Simbólica & Matrizes',
                rows: [
                    [
                        { insert: "Solve(#?)", label: "Solve", tooltip: "Resolver Simbolicamente" },
                        { insert: "NSolve(#?)", label: "NSolve", tooltip: "Resolver Numericamente" },
                        { insert: "Simplify(#?)", label: "Simplify", tooltip: "Simplificar Expressão" },
                        { insert: "Factor(#?)", label: "Factor", tooltip: "Fatorar Polinómio" },
                        { insert: "Expand(#?)", label: "Expand", tooltip: "Expandir Expressão" },
                        { insert: "PartialFractions(#?)", label: "PartFrac", tooltip: "Frações Parciais" }
                    ],
                    [
                        { insert: "\\begin{bmatrix} 0 & 0 \\\\ 0 & 0 \\end{bmatrix}", label: "Mat 2x2", tooltip: "Matriz 2x2" },
                        { insert: "\\begin{bmatrix} 0 & 0 & 0 \\\\ 0 & 0 & 0 \\\\ 0 & 0 & 0 \\end{bmatrix}", label: "Mat 3x3", tooltip: "Matriz 3x3" },
                        { insert: "\\begin{bmatrix} 0 \\\\ 0 \\end{bmatrix}", label: "Vet 2D", tooltip: "Vetor Coluna 2D" },
                        { insert: "det(#?)", label: "det", tooltip: "Determinante det(A)" },
                        { insert: "inv(#?)", label: "A⁻¹", tooltip: "Inversa inv(A)" }
                    ],
                    [
                        { insert: "eigenvals(#?)", label: "Eigenvals", tooltip: "Autovalores" },
                        { insert: "eigenvects(#?)", label: "Eigenvects", tooltip: "Autovetores" },
                        { insert: "rref(#?)", label: "rref", tooltip: "Escalonamento Reduzido rref(A)" },
                        { insert: "rank(#?)", label: "rank", tooltip: "Posto da Matriz rank(A)" },
                        { insert: "trace(#?)", label: "trace", tooltip: "Traço trace(A)" },
                        { insert: "transpose(#?)", label: "Aᵀ", tooltip: "Transposta transpose(A)" }
                    ],
                    [
                        { class: "action", label: "←", command: ["performWithFeedback", "moveToPreviousChar"] },
                        { class: "action", label: "→", command: ["performWithFeedback", "moveToNextChar"] },
                        { class: "separator w10" },
                        { class: "action font-glyph w20", label: "&#x232b;", command: ["performWithFeedback", "deleteBackward"] },
                        { class: "action font-glyph w20", label: "&#x23ce;", command: ["performWithFeedback", "commit"] }
                    ]
                ]
            },
            {
                label: 'func',
                tooltip: 'Trigonometria, Hiperbólicas e Estatística',
                rows: [
                    [
                        { insert: "sin(#?)", latex: "\\sin" },
                        { insert: "cos(#?)", latex: "\\cos" },
                        { insert: "tan(#?)", latex: "\\tan" },
                        { insert: "cot(#?)", latex: "\\cot" },
                        { insert: "sec(#?)", latex: "\\sec" },
                        { insert: "csc(#?)", latex: "\\csc" }
                    ],
                    [
                        { insert: "arcsin(#?)", latex: "\\arcsin" },
                        { insert: "arccos(#?)", latex: "\\arccos" },
                        { insert: "arctan(#?)", latex: "\\arctan" },
                        { insert: "sinh(#?)", latex: "\\sinh" },
                        { insert: "cosh(#?)", latex: "\\cosh" },
                        { insert: "tanh(#?)", latex: "\\tanh" }
                    ],
                    [
                        { insert: "|#?|", latex: "|x|" },
                        { insert: "\\sqrt[#?]{#?}", latex: "\\sqrt[n]{x}" },
                        { insert: "floor(#?)", label: "floor" },
                        { insert: "ceil(#?)", label: "ceil" },
                        { insert: "sign(#?)", label: "sign" },
                        { insert: "Mean(#?)", label: "Média" },
                        { insert: "Normal(#?, #?, #?)", label: "Normal" }
                    ],
                    [
                        { class: "action", label: "←", command: ["performWithFeedback", "moveToPreviousChar"] },
                        { class: "action", label: "→", command: ["performWithFeedback", "moveToNextChar"] },
                        { class: "separator w10" },
                        { class: "action font-glyph w20", label: "&#x232b;", command: ["performWithFeedback", "deleteBackward"] },
                        { class: "action font-glyph w20", label: "&#x23ce;", command: ["performWithFeedback", "commit"] }
                    ]
                ]
            },
            'alphabetic'
        ];
    }
}, 500);

    // Usa ResizeObserver no container para lidar com window resize E com md:resize-x da sidebar!
    const graphContainer = document.getElementById('graph-container');
    if (graphContainer) {
        const resizeObserver = new ResizeObserver(() => {
            resizeAll();
            drawFrame();
        });
        resizeObserver.observe(graphContainer);
    } else {
        window.addEventListener('resize', () => {
            resizeAll();
            drawFrame();
        });
    }

// --- CONTROLES DE INTERFACE DO RATO ---
const canvasEl = document.getElementById('graphCanvas') as HTMLCanvasElement;
const sidebarEl = document.getElementById('sidebar') as HTMLElement;
const sidebarHeader = document.getElementById('sidebar-header') as HTMLElement;

// Permite arrastar o topo do painel no celular para ajustar o tamanho!
let isDraggingSidebar = false;
let startY = 0;
let startHeight = 0;

sidebarHeader.addEventListener('touchstart', (e) => {
    if (window.innerWidth <= 768) {
        // Se tocou em um botão dentro do header, não inicia o arraste da gaveta
        if ((e.target as HTMLElement).closest('button, a')) return;
        isDraggingSidebar = true;
        startY = e.touches[0].clientY;
        startHeight = sidebarEl.getBoundingClientRect().height;
        sidebarEl.style.flex = 'none'; // Previne conflitos do flexbox
    }
}, {passive: true});

window.addEventListener('touchmove', (e) => {
    if (!isDraggingSidebar) return;
    // Previne o scroll da página enquanto arrasta a barra
    if (e.cancelable) e.preventDefault(); 
    
    const dy = startY - e.touches[0].clientY; // Cresce para cima
    let newHeight = startHeight + dy;
    
    // Limita a altura, ignorando o innerHeight que buga com teclado aberto
    if (newHeight < 80) newHeight = 80; 
    const maxH = screen.availHeight * 0.8;
    if (newHeight > maxH) newHeight = maxH;
    
    sidebarEl.style.height = `${newHeight}px`;
    resizeAll();
    drawFrame();
}, {passive: false});

window.addEventListener('touchend', () => {
    if (isDraggingSidebar) {
        isDraggingSidebar = false;
        resizeAll();
        drawFrame();
    }
});

// --- CONTROLE DE REDIMENSIONAMENTO E COLAPSO DA BARRA LATERAL (Desktop & Mobile) ---
const sidebarResizer = document.getElementById('sidebar-resizer');
const sidebarExpandTab = document.getElementById('sidebar-expand-tab');
const collapseSidebarBtn = document.getElementById('collapse-sidebar-btn');

let savedSidebarWidth = 500;
let isDraggingSidebarResizer = false;

let activeSidebarAnimation: number | null = null;

function animateSidebarWidth(targetWidth: number, onComplete?: () => void) {
    if (window.innerWidth <= 768) return;
    if (activeSidebarAnimation !== null) {
        cancelAnimationFrame(activeSidebarAnimation);
        activeSidebarAnimation = null;
    }

    const startW = sidebarEl.getBoundingClientRect().width;
    const diff = targetWidth - startW;
    if (Math.abs(diff) < 2) {
        sidebarEl.style.width = `${targetWidth}px`;
        if (targetWidth === 0) {
            sidebarEl.style.display = 'none';
            if (sidebarResizer) sidebarResizer.style.display = 'none';
            if (sidebarExpandTab) sidebarExpandTab.style.display = 'flex';
        } else {
            sidebarEl.style.display = 'flex';
            if (sidebarResizer) sidebarResizer.style.display = 'flex';
            if (sidebarExpandTab) sidebarExpandTab.style.display = 'none';
        }
        resizeAll();
        drawFrame();
        ExpressionManager.updateAllMatrixSizes();
        onComplete?.();
        return;
    }

    const duration = 200; // ms
    const startTime = performance.now();

    function step(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Desmos cubic ease-out curve
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentWidth = startW + diff * ease;
        sidebarEl.style.width = `${currentWidth}px`;
        resizeAll();
        drawFrame();
        ExpressionManager.updateAllMatrixSizes();

        if (progress < 1) {
            activeSidebarAnimation = requestAnimationFrame(step);
        } else {
            sidebarEl.style.width = `${targetWidth}px`;
            if (targetWidth === 0) {
                sidebarEl.style.display = 'none';
                if (sidebarResizer) sidebarResizer.style.display = 'none';
                if (sidebarExpandTab) sidebarExpandTab.style.display = 'flex';
            } else {
                sidebarEl.style.display = 'flex';
                if (sidebarResizer) sidebarResizer.style.display = 'flex';
                if (sidebarExpandTab) sidebarExpandTab.style.display = 'none';
            }
            activeSidebarAnimation = null;
            resizeAll();
            drawFrame();
            ExpressionManager.updateAllMatrixSizes();
            onComplete?.();
        }
    }
    activeSidebarAnimation = requestAnimationFrame(step);
}

function collapseDesktopSidebar(fromDrag: boolean = false) {
    if (window.innerWidth <= 768) return;
    const currentW = sidebarEl.getBoundingClientRect().width;
    if (currentW > 150) savedSidebarWidth = currentW;

    if (fromDrag || isDraggingSidebarResizer) {
        isDraggingSidebarResizer = false;
        document.body.classList.remove('select-none');
        document.body.style.cursor = '';
        if (sidebarResizer) sidebarResizer.classList.remove('is-dragging');
    }

    animateSidebarWidth(0);
}

function expandDesktopSidebar() {
    if (window.innerWidth <= 768) return;
    sidebarEl.style.display = 'flex';
    sidebarEl.style.width = '0px';
    if (sidebarResizer) sidebarResizer.style.display = 'flex';
    if (sidebarExpandTab) sidebarExpandTab.style.display = 'none';
    const restoreW = Math.max(290, Math.min(Math.floor(window.innerWidth * 0.80), savedSidebarWidth || 500));
    animateSidebarWidth(restoreW);
}

if (sidebarResizer) {
    sidebarResizer.addEventListener('pointerdown', (e) => {
        if (window.innerWidth <= 768) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingSidebarResizer = true;
        sidebarResizer.setPointerCapture(e.pointerId);
        document.body.classList.add('select-none');
        document.body.style.cursor = 'col-resize';
        sidebarResizer.classList.add('is-dragging');
    });

    sidebarResizer.addEventListener('pointermove', (e) => {
        if (!isDraggingSidebarResizer) return;
        const newWidth = e.clientX;
        const minCollapseThreshold = 150; // Arrastou além da barra para a esquerda: anima colapso suave!
        const maxAllowedWidth = Math.floor(window.innerWidth * 0.80);

        if (newWidth < minCollapseThreshold) {
            try {
                sidebarResizer.releasePointerCapture(e.pointerId);
            } catch(err) {
                console.warn('[Main] Error releasing sidebar resizer pointer capture on collapse:', err);
            }
            collapseDesktopSidebar(true);
            return;
        }

        if (sidebarEl.style.display === 'none') {
            sidebarEl.style.display = 'flex';
            if (sidebarExpandTab) sidebarExpandTab.style.display = 'none';
        }

        const clampedWidth = Math.min(maxAllowedWidth, Math.max(220, newWidth));
        sidebarEl.style.width = `${clampedWidth}px`;
        savedSidebarWidth = clampedWidth;

        resizeAll();
        drawFrame();
        ExpressionManager.updateAllMatrixSizes();
    });

    const stopDraggingResizer = (e: PointerEvent) => {
        if (!isDraggingSidebarResizer) return;
        isDraggingSidebarResizer = false;
        try {
            sidebarResizer.releasePointerCapture(e.pointerId);
        } catch(err) {
            console.warn('[Main] Error releasing sidebar resizer pointer capture:', err);
        }
        document.body.classList.remove('select-none');
        document.body.style.cursor = '';
        sidebarResizer.classList.remove('is-dragging');
        resizeAll();
        drawFrame();
        ExpressionManager.updateAllMatrixSizes();
    };

    sidebarResizer.addEventListener('pointerup', stopDraggingResizer);
    sidebarResizer.addEventListener('pointercancel', stopDraggingResizer);
}

if (sidebarExpandTab) {
    sidebarExpandTab.addEventListener('click', (e) => {
        e.stopPropagation();
        expandDesktopSidebar();
    });
}

if (collapseSidebarBtn) {
    collapseSidebarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseDesktopSidebar();
    });
}

// Observa mudanças de dimensões da sidebar em tempo real (window resize, devtools, orientation, etc.)
if (sidebarEl) {
    const sidebarObserver = new ResizeObserver(() => {
        ExpressionManager.updateAllMatrixSizes();
    });
    sidebarObserver.observe(sidebarEl);
}


// --- CONTROLE DE TECLADO VIRTUAL E GAVETA MOBILE (Estilo Desmos) ---
setTimeout(() => {
    // 1. Botão Flutuante de Abrir / Fechar Teclado
    const toggleKbBtn = document.getElementById('toggle-keyboard-btn');
    if (toggleKbBtn) {
        toggleKbBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const vk = (window as any).mathVirtualKeyboard;
            if (vk) {
                if (vk.visible) {
                    vk.hide();
                } else {
                    vk.show();
                    const activeEl = document.activeElement;
                    if (!activeEl || activeEl.tagName.toLowerCase() !== 'math-field') {
                        const mfs = document.querySelectorAll('math-field');
                        if (mfs.length > 0) (mfs[mfs.length - 1] as HTMLElement).focus();
                    }
                }
            }
        });
    }

    // 2. Botão de Recolher / Expandir Painel no Mobile
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-mobile-btn');
    const sidebarChevron = document.getElementById('sidebar-chevron-icon');
    let isSidebarCollapsed = false;
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                isSidebarCollapsed = !isSidebarCollapsed;
                if (isSidebarCollapsed) {
                    if (!sidebarEl.dataset.savedHeight) {
                        sidebarEl.dataset.savedHeight = sidebarEl.getBoundingClientRect().height.toString();
                    }
                    sidebarEl.style.height = '46px';
                    if (sidebarChevron) sidebarChevron.setAttribute('data-lucide', 'chevron-up');
                } else {
                    sidebarEl.style.height = sidebarEl.dataset.savedHeight ? `${sidebarEl.dataset.savedHeight}px` : '42vh';
                    if (sidebarChevron) sidebarChevron.setAttribute('data-lucide', 'chevron-down');
                }
                if ((window as any).lucide) (window as any).lucide.createIcons();
                setTimeout(() => { resizeAll(); drawFrame(); }, 50);
            }
        });
    }

    // 3. Listener de exibição do Teclado Virtual MathLive
    if ((window as any).mathVirtualKeyboard) {
        (window as any).mathVirtualKeyboard.addEventListener('virtual-keyboard-toggle', () => {
            const vk = (window as any).mathVirtualKeyboard;
            const kbIcon = document.getElementById('keyboard-btn-icon');
            const exprList = document.getElementById('expressions-list');
            if (vk.visible) {
                if (kbIcon) {
                    kbIcon.setAttribute('data-lucide', 'chevron-down');
                    if ((window as any).lucide) (window as any).lucide.createIcons();
                }
                if (window.innerWidth > 768) {
                    if (exprList) exprList.style.paddingBottom = '252px';
                    const activeEl = document.activeElement as HTMLElement;
                    if (activeEl && activeEl.tagName && activeEl.tagName.toLowerCase() === 'math-field') {
                        const block = activeEl.closest('.group') as HTMLElement;
                        if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } else {
                    const keyboardHeight = vk.boundingRect.height || 280;
                    
                    if (!sidebarEl.dataset.savedHeight) {
                        sidebarEl.dataset.savedHeight = sidebarEl.getBoundingClientRect().height.toString();
                    }
                    
                    // Posiciona a barra compacta acima do teclado preservando o canvas visível no topo
                    sidebarEl.style.marginBottom = `${keyboardHeight}px`;
                    sidebarEl.style.height = '180px';
                    sidebarEl.style.maxHeight = '180px';
                    sidebarEl.style.flex = 'none';
                    
                    setTimeout(() => {
                        resizeAll();
                        drawFrame();
                        const activeEl = document.activeElement as HTMLElement;
                        if (activeEl && activeEl.tagName.toLowerCase() === 'math-field') {
                            const block = activeEl.closest('.group') as HTMLElement;
                            if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 60);
                }
            } else {
                if (kbIcon) {
                    kbIcon.setAttribute('data-lucide', 'keyboard');
                    if ((window as any).lucide) (window as any).lucide.createIcons();
                }
                if (window.innerWidth > 768) {
                    if (exprList) exprList.style.paddingBottom = '0px';
                } else {
                    sidebarEl.style.marginBottom = '0px';
                    sidebarEl.style.maxHeight = '';
                    sidebarEl.style.flex = '';
                    if (sidebarEl.dataset.savedHeight) {
                        sidebarEl.style.height = `${sidebarEl.dataset.savedHeight}px`;
                        sidebarEl.dataset.savedHeight = '';
                    } else {
                        sidebarEl.style.height = '';
                    }
                }
                
                setTimeout(() => { resizeAll(); drawFrame(); }, 60);
                
                if (document.activeElement && document.activeElement.tagName.toLowerCase() === 'math-field') {
                    (document.activeElement as HTMLElement).blur();
                }
            }
        });
    }
}, 800);

let isDragging = false;
let lastX = 0; let lastY = 0;

window.addEventListener('keydown', (e) => { 
    if(e.key === 'Shift') { isShiftDown = true; updateHover(); drawFrame(); }
});
window.addEventListener('keyup', (e) => { 
    if(e.key === 'Shift') { isShiftDown = false; updateHover(); drawFrame(); }
});

function updateHover() {
    if (!isShiftDown) { hoverX = false; hoverY = false; return; }
    const pxFromXAxis = Math.abs(mouseY - Camera.toPixelY(0));
    const pxFromYAxis = Math.abs(mouseX - Camera.toPixelX(0));
    hoverX = pxFromXAxis < 40; 
    hoverY = pxFromYAxis < 40; 
    if (hoverX && hoverY) {
        if (pxFromXAxis < pxFromYAxis) hoverY = false;
        else hoverX = false;
    }
}


function getClosestCurvePoint(pixelX: number, pixelY: number, maxDist: number = 15): { mathX: number, mathY: number, px: number, py: number, color: string, dist: number, curveF?: (x: number) => number, slope?: number } | null {
    let closest: any = null;
    let minDist = maxDist;
    const mathX = Camera.toMathX(pixelX);
    

    // 1. Explicit Curves
    for (const curve of renderMemory_curves) {
        const y = curve.f(mathX);
        if (isNaN(y)) continue;
        const py = Camera.toPixelY(y);
        const dist = Math.abs(pixelY - py);
        if (dist < minDist) {
            minDist = dist;
            const h = 1e-5;
            const dfVal = (curve.f(mathX + h) - curve.f(mathX - h)) / (2 * h);
            closest = { mathX, mathY: y, px: pixelX, py, color: curve.color, dist, curveF: curve.f, slope: isFinite(dfVal) ? dfVal : undefined };
        }
    }

    // 2. Implicit Segments
    for (const seg of renderMemory_segments) {
        const px1 = Camera.toPixelX(seg.x1);
        const py1 = Camera.toPixelY(seg.y1);
        const px2 = Camera.toPixelX(seg.x2);
        const py2 = Camera.toPixelY(seg.y2);
        
        const l2 = (px1 - px2)**2 + (py1 - py2)**2;
        let t = 0;
        if (l2 !== 0) t = Math.max(0, Math.min(1, ((pixelX - px1) * (px2 - px1) + (pixelY - py1) * (py2 - py1)) / l2));
        
        const projX = px1 + t * (px2 - px1);
        const projY = py1 + t * (py2 - py1);
        const dist = Math.hypot(pixelX - projX, pixelY - projY);
        
        if (dist < minDist) {
            minDist = dist;
            closest = { mathX: Camera.toMathX(projX), mathY: Camera.toMathY(projY), px: projX, py: projY, color: seg.color, dist };
        }
    }
    
    // 3. ODE / Parametric Curves
    for (const cp of renderMemory_curve_points) {
        for (let i = 0; i < cp.points.length - 1; i++) {
            const p1 = cp.points[i];
            const p2 = cp.points[i+1];
            if (isNaN(p1.y) || isNaN(p2.y)) continue;
            
            const px1 = Camera.toPixelX(p1.x);
            const py1 = Camera.toPixelY(p1.y);
            const px2 = Camera.toPixelX(p2.x);
            const py2 = Camera.toPixelY(p2.y);
            
            const l2 = (px1 - px2)**2 + (py1 - py2)**2;
            let t = 0;
            if (l2 !== 0) t = Math.max(0, Math.min(1, ((pixelX - px1) * (px2 - px1) + (pixelY - py1) * (py2 - py1)) / l2));
            
            const projX = px1 + t * (px2 - px1);
            const projY = py1 + t * (py2 - py1);
            const dist = Math.hypot(pixelX - projX, pixelY - projY);
            
            if (dist < minDist) {
                minDist = dist;
                closest = { mathX: Camera.toMathX(projX), mathY: Camera.toMathY(projY), px: projX, py: projY, color: cp.color, dist };
            }
        }
    }
    return closest;
}

canvasEl.addEventListener('mousedown', (e) => { 
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 0. Dragging de pontos discretos (Tabelas ou Coordenadas)
    let foundDragPt: DraggablePoint | null = null;
    let closestDragDist = 14;
    for (const dp of draggableCanvasPoints) {
        const px = Camera.toPixelX(dp.mathX);
        const py = Camera.toPixelY(dp.mathY);
        const dist = Math.hypot(mx - px, my - py);
        if (dist < closestDragDist) {
            closestDragDist = dist;
            foundDragPt = dp;
        }
    }

    if (foundDragPt) {
        isDraggingPoint = true;
        activeDragPoint = foundDragPt;
        isDragging = false;
        isTracing = false;
        document.body.style.cursor = 'grabbing';
        const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
        tooltip.innerText = `(${formatCoord(foundDragPt.mathX)}, ${formatCoord(foundDragPt.mathY)})`;
        tooltip.style.display = 'block';
        tooltip.style.left = (rect.left + Camera.toPixelX(foundDragPt.mathX)) + 'px';
        tooltip.style.top = (rect.top + Camera.toPixelY(foundDragPt.mathY) - 10) + 'px';
        tooltip.style.backgroundColor = foundDragPt.color;
        tooltip.style.color = '#fff';
        return;
    }

    isDragging = true; 
    isTracing = false;
    dragDistance = 0;
    lastX = e.clientX; 
    lastY = e.clientY; 
    
    const closest = getClosestCurvePoint(mx, my, 15);
    if (closest) {
        isTracing = true;
        isDragging = false;
        
        const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
        tooltip.innerText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
        tooltip.style.display = 'block';
        tooltip.style.left = (rect.left + closest.px) + 'px';
        tooltip.style.top = (rect.top + closest.py - 10) + 'px';
        tooltip.style.backgroundColor = closest.color;
        tooltip.style.color = '#fff';
        document.body.style.cursor = 'crosshair';
        
        globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
        drawFrame();
    } else {
        tooltip.style.display = 'none'; 
    }
});

function handleCanvasPointerTap(clientX: number, clientY: number, altKey: boolean = false) {
    const rect = canvasEl.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    
    // 1. Desafixar se tocar perto de um ponto fixado existente (raio 24px no mobile, 18px no desktop)
    const hitRadius = window.innerWidth <= 768 ? 24 : 18;
    const pinnedIdx = pinnedPoints.findIndex(pp => {
        const px = Camera.toPixelX(pp.mathX);
        const py = Camera.toPixelY(pp.mathY);
        return Math.hypot(mx - px, my - py) < hitRadius;
    });
    if (pinnedIdx !== -1) {
        pinnedPoints.splice(pinnedIdx, 1);
        (window as any)._pinnedPoints = pinnedPoints;
        HistoryManager.recordState(true);
        scheduleFrame();
        return;
    }

    // 2. Fixar se tocar em um ponto notável (hoveredNotablePoint ou dentro de hitRadius)
    let targetNotable = hoveredNotablePoint;
    if (!targetNotable) {
        for (const p of renderMemory_points) {
            const px = Camera.toPixelX(p.mathX);
            const py = Camera.toPixelY(p.mathY);
            if (Math.hypot(mx - px, my - py) < hitRadius) {
                targetNotable = p;
                break;
            }
        }
    }
    if (targetNotable) {
        const existing = pinnedPoints.find(pp => Math.abs(pp.mathX - targetNotable!.mathX) < 1e-4 && Math.abs(pp.mathY - targetNotable!.mathY) < 1e-4);
        if (existing) {
            existing.showTangent = !existing.showTangent;
        } else {
            pinnedPoints.push({
                id: 'pin_' + Date.now() + Math.random().toString(36).slice(2, 6),
                mathX: targetNotable.mathX,
                mathY: targetNotable.mathY,
                color: targetNotable.color,
                type: targetNotable.type,
                curveF: targetNotable.curveF,
                slope: targetNotable.slope,
                showTangent: altKey
            });
        }
        (window as any)._pinnedPoints = pinnedPoints;
        HistoryManager.recordState(true);
        scheduleFrame();
        return;
    }

    // 3. Fixar ponto na curva se clicar/tocar em curva explícita ou paramétrica
    const closest = getClosestCurvePoint(mx, my, hitRadius);
    if (closest) {
        pinnedPoints.push({
            id: 'pin_' + Date.now() + Math.random().toString(36).slice(2, 6),
            mathX: closest.mathX,
            mathY: closest.mathY,
            color: closest.color,
            type: 'curve',
            curveF: closest.curveF,
            slope: closest.slope,
            showTangent: altKey
        });
        (window as any)._pinnedPoints = pinnedPoints;
        HistoryManager.recordState(true);
        scheduleFrame();
        return;
    }

    // 4. Condição inicial de Campo de Direções (EDO) ao clicar/tocar no canvas
    const mathX = Camera.toMathX(mx);
    const mathY = Camera.toMathY(my);
    const activeSlopeFields = validEquations.filter(eq => eq.isEdo);
    if (activeSlopeFields.length > 0) {
        const edoName = activeSlopeFields[0].name;
        const x0 = parseFloat(mathX.toFixed(2));
        const y0 = parseFloat(mathY.toFixed(2));
        ExpressionManager.addExpression(`${edoName}(${x0}) = ${y0}`);
    }
}

canvasEl.addEventListener('click', (e) => {
    if (dragDistance < 5 && !isTracing && !isDraggingPoint) {
        handleCanvasPointerTap(e.clientX, e.clientY, e.altKey || false);
    }
});

window.addEventListener('mouseup', () => { 
    if (isDraggingPoint) {
        isDraggingPoint = false;
        activeDragPoint = null;
        document.body.style.cursor = 'default';
        HistoryManager.recordState(true);
    }
    isDragging = false; 
    isTracing = false;
    if (globalTracePoint) {
        globalTracePoint = null;
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        drawFrame();
    }
});

canvasEl.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    const coordsEl = document.getElementById('cursor-coords');
    if (coordsEl) {
        const mathX = Camera.toMathX(mouseX);
        const mathY = Camera.toMathY(mouseY);
        coordsEl.innerText = `${mathX.toFixed(3)}, ${mathY.toFixed(3)}`;
    }

    if (isDraggingPoint && activeDragPoint) {
        const newMathX = parseFloat(Camera.toMathX(mouseX).toFixed(2));
        const newMathY = parseFloat(Camera.toMathY(mouseY).toFixed(2));

        if (activeDragPoint.type === 'table' && activeDragPoint.tableBlockId !== undefined && activeDragPoint.rowIndex !== undefined) {
            const tblBlock = document.getElementById(activeDragPoint.tableBlockId);
            if (tblBlock) {
                const rows = tblBlock.querySelectorAll('.table-data-row');
                const rowEl = rows[activeDragPoint.rowIndex];
                if (rowEl) {
                    const xi = rowEl.querySelector('.table-cell-x') as HTMLInputElement;
                    const yi = rowEl.querySelector('.table-cell-y') as HTMLInputElement;
                    if (xi && yi) {
                        xi.value = newMathX.toString();
                        yi.value = newMathY.toString();
                    }
                }
            }
            activeDragPoint.mathX = newMathX;
            activeDragPoint.mathY = newMathY;
            markExpressionsDirty();
        } else if (activeDragPoint.type === 'expression' && activeDragPoint.exprBlockId) {
            const exprBlock = document.getElementById(activeDragPoint.exprBlockId);
            if (exprBlock) {
                const mf = exprBlock.querySelector('math-field');
                if (mf) {
                    const currentVal = (mf as any).getValue('ascii-math');
                    const nameMatch = currentVal.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                    const varPrefix = nameMatch ? `${nameMatch[1]} = ` : '';
                    (mf as any).setValue(`${varPrefix}(${newMathX}, ${newMathY})`);
                    activeDragPoint.mathX = newMathX;
                    activeDragPoint.mathY = newMathY;
                    markExpressionsDirty();
                }
            }
        }

        const px = Camera.toPixelX(newMathX);
        const py = Camera.toPixelY(newMathY);
        tooltip.innerText = `(${newMathX}, ${newMathY})`;
        tooltip.style.display = 'block';
        tooltip.style.left = (rect.left + px) + 'px';
        tooltip.style.top = (rect.top + py - 10) + 'px';
        return;
    }

    if (isShiftDown) {
        const oldX = hoverX; const oldY = hoverY;
        updateHover();
        if (oldX !== hoverX || oldY !== hoverY) scheduleFrame();
    }

    if (isDragging) {
        dragDistance += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        Camera.pan(dx, dy);
        scheduleFrame();
    } else if (isTracing) {
        // Continuous trace locked onto curve while holding mouse
        const closest = getClosestCurvePoint(mouseX, mouseY, 2000);
        if (closest) {
            const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
            let label = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            if (typeof closest.slope === 'number' && isFinite(closest.slope)) {
                label += ` | m=${parseFloat(closest.slope.toFixed(3))}`;
            }
            tooltip.innerText = label;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + closest.px) + 'px';
            tooltip.style.top = (rect.top + closest.py - 10) + 'px';
            tooltip.style.backgroundColor = closest.color;
            tooltip.style.color = '#fff';
            document.body.style.cursor = 'crosshair';
            
            globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
            scheduleFrame();
        }
    } else {
        const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();

        // 0. Hover sobre pontos arrastáveis
        let foundHoverDrag: DraggablePoint | null = null;
        for (const dp of draggableCanvasPoints) {
            const px = Camera.toPixelX(dp.mathX);
            const py = Camera.toPixelY(dp.mathY);
            if (Math.hypot(mouseX - px, mouseY - py) < 14) {
                foundHoverDrag = dp;
                break;
            }
        }
        if (foundHoverDrag) {
            document.body.style.cursor = 'grab';
            tooltip.innerText = `(${foundHoverDrag.mathX.toFixed(2)}, ${foundHoverDrag.mathY.toFixed(2)}) [Arrastar]`;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + Camera.toPixelX(foundHoverDrag.mathX)) + 'px';
            tooltip.style.top = (rect.top + Camera.toPixelY(foundHoverDrag.mathY) - 10) + 'px';
            tooltip.style.backgroundColor = foundHoverDrag.color;
            tooltip.style.color = '#fff';
            return;
        }

        // 1. Magnetic Snapping on Notable Points (Roots, Extrema, Intercepts, Intersections)
        let foundNotable: NotablePointData | null = null;
        let snapDist = 16;
        for (const p of renderMemory_points) {
            const px = Camera.toPixelX(p.mathX);
            const py = Camera.toPixelY(p.mathY);
            const dist = Math.hypot(mouseX - px, mouseY - py);
            if (dist < snapDist) {
                snapDist = dist;
                foundNotable = p;
            }
        }

        if (foundNotable) {
            const needRedraw = !hoveredNotablePoint || 
                hoveredNotablePoint.mathX !== foundNotable.mathX || 
                hoveredNotablePoint.mathY !== foundNotable.mathY;
            hoveredNotablePoint = foundNotable;
            if (needRedraw) scheduleFrame();

            const snapPx = Camera.toPixelX(foundNotable.mathX);
            const snapPy = Camera.toPixelY(foundNotable.mathY);

            let typePrefix = '';
            if (foundNotable.type === 'root') typePrefix = 'Raiz: ';
            else if (foundNotable.type === 'y-intercept' || foundNotable.type === 'intercept') typePrefix = 'Intercepto: ';
            else if (foundNotable.type === 'extrema' || foundNotable.type === 'extremum') typePrefix = 'Extremo: ';
            else if (foundNotable.type === 'intersect') typePrefix = 'Interseção: ';

            let label = `${typePrefix}(${formatCoord(foundNotable.mathX)}, ${formatCoord(foundNotable.mathY)})`;
            if (typeof foundNotable.slope === 'number' && isFinite(foundNotable.slope)) {
                label += ` | m=${parseFloat(foundNotable.slope.toFixed(3))}`;
            }

            tooltip.innerText = label;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + snapPx) + 'px';
            tooltip.style.top = (rect.top + snapPy - 12) + 'px';
            tooltip.style.backgroundColor = foundNotable.color;
            tooltip.style.color = '#fff';
            document.body.style.cursor = 'pointer';
        } else {
            if (hoveredNotablePoint) {
                hoveredNotablePoint = null;
                scheduleFrame();
            }

            // 2. Smooth Curve Hover Tracing
            const closest = getClosestCurvePoint(mouseX, mouseY, 14);
            if (closest) {
                let label = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
                if (typeof closest.slope === 'number' && isFinite(closest.slope)) {
                    label += ` | m=${parseFloat(closest.slope.toFixed(3))}`;
                }
                tooltip.innerText = label;
                tooltip.style.display = 'block';
                tooltip.style.left = (rect.left + closest.px) + 'px';
                tooltip.style.top = (rect.top + closest.py - 10) + 'px';
                tooltip.style.backgroundColor = closest.color;
                tooltip.style.color = '#fff';
                document.body.style.cursor = 'crosshair';
            } else {
                tooltip.style.display = 'none';
                document.body.style.cursor = 'default';
            }
        }
    }
    lastX = e.clientX; lastY = e.clientY;
});

canvasEl.addEventListener('mouseleave', () => { 
    tooltip.style.display = 'none'; 
    if (hoveredNotablePoint) {
        hoveredNotablePoint = null;
        scheduleFrame();
    }
});

canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    let fX = factor; let fY = factor;

    if (isShiftDown) {
        if (hoverX) fY = 1.0; 
        else if (hoverY) fX = 1.0; 
    }

    Camera.zoom(fX, fY, mouseX, mouseY);
    scheduleFrame();
    tooltip.style.display = 'none'; 
}, { passive: false });

// --- TOUCH EVENTS PARA CELULAR ---
let initialPinchDistance = -1;
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

canvasEl.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Impede scroll natural na tela
    if (e.touches.length === 1) {
        touchStartTime = Date.now();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;

        isDragging = true;
        isTracing = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        
        const rect = canvasEl.getBoundingClientRect();
        const mx = lastX - rect.left;
        const my = lastY - rect.top;
        
        const closest = getClosestCurvePoint(mx, my, 25);
        if (closest) {
            isTracing = true;
            isDragging = false;
            
            const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
            tooltip.innerText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + closest.px) + 'px';
            tooltip.style.top = (rect.top + closest.py - 10) + 'px';
            tooltip.style.backgroundColor = closest.color;
            tooltip.style.color = '#fff';
            
            globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
            scheduleFrame();
        } else {
            tooltip.style.display = 'none';
        }
    } else if (e.touches.length === 2) {
        isDragging = false;
        isTracing = false;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
}, {passive: false});

canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        if (Math.hypot(e.touches[0].clientX - touchStartX, e.touches[0].clientY - touchStartY) > 10) {
            touchMoved = true;
        }
    }
    const rect = canvasEl.getBoundingClientRect();
    if (isTracing && e.touches.length === 1) {
        const mx = e.touches[0].clientX - rect.left;
        const my = e.touches[0].clientY - rect.top;
        
        const closest = getClosestCurvePoint(mx, my, 2000);
        if (closest) {
            const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();
            tooltip.innerText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + closest.px) + 'px';
            tooltip.style.top = (rect.top + closest.py - 10) + 'px';
            tooltip.style.backgroundColor = closest.color;
            tooltip.style.color = '#fff';
            
            globalTracePoint = { x: closest.mathX, y: closest.mathY, color: closest.color };
            scheduleFrame();
        }
        return;
    }

    if (e.touches.length === 1 && isDragging) {
        Camera.pan(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        scheduleFrame();
    } else if (e.touches.length === 2) {
        const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (initialPinchDistance > 0) {
            const factor = initialPinchDistance / currentDistance;
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            Camera.zoom(factor, factor, centerX - rect.left, centerY - rect.top);
            initialPinchDistance = currentDistance;
            scheduleFrame();
        }
    }
}, {passive: false});

canvasEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = -1;
    if (e.touches.length === 0) {
        const elapsed = Date.now() - touchStartTime;
        if (!touchMoved && elapsed < 350) {
            handleCanvasPointerTap(touchStartX, touchStartY);
        }
        isDragging = false;
        isTracing = false;
        if (globalTracePoint) {
            globalTracePoint = null;
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            drawFrame();
        }
        tooltip.style.display = 'none';
    }
});

// --- ALTERNADOR DE MODO 2D / 3D (Estilo Desmos / GeoGebra) ---
const mode2dBtn = document.getElementById('mode-2d-btn');
const mode3dBtn = document.getElementById('mode-3d-btn');
const canvas3dEl = document.getElementById('canvas3d') as HTMLCanvasElement;
const webgl2dCanvas = document.getElementById('webglCanvas') as HTMLCanvasElement;

function switchViewMode(mode: '2d' | '3d') {
    StateManager.viewMode = mode;
    if (mode === '2d') {
        mode2dBtn?.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        mode2dBtn?.classList.remove('text-gray-500', 'hover:text-gray-900');
        mode3dBtn?.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        mode3dBtn?.classList.add('text-gray-500', 'hover:text-gray-900');

        canvasEl.classList.remove('hidden');
        webgl2dCanvas?.classList.remove('hidden');
        canvas3dEl?.classList.add('hidden');
    } else {
        mode3dBtn?.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        mode3dBtn?.classList.remove('text-gray-500', 'hover:text-gray-900');
        mode2dBtn?.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        mode2dBtn?.classList.add('text-gray-500', 'hover:text-gray-900');

        canvasEl.classList.add('hidden');
        webgl2dCanvas?.classList.add('hidden');
        canvas3dEl?.classList.remove('hidden');
        renderer3d.resize();
    }
    resizeAll();
    markExpressionsDirty();
    drawFrame();
}

mode2dBtn?.addEventListener('click', () => switchViewMode('2d'));
mode3dBtn?.addEventListener('click', () => switchViewMode('3d'));

// --- CONTROLES 3D (MOUSE & TOUCH) ---
let isRotating3D = false;
let isPanning3D = false;
let last3DX = 0;
let last3DY = 0;
let initialPinch3D = -1;

if (canvas3dEl) {
    canvas3dEl.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas3dEl.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !e.shiftKey) {
            isRotating3D = true;
        } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
            isPanning3D = true;
        }
        last3DX = e.clientX;
        last3DY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        isRotating3D = false;
        isPanning3D = false;
    });

    canvas3dEl.addEventListener('mousemove', (e) => {
        const dx = e.clientX - last3DX;
        const dy = e.clientY - last3DY;
        last3DX = e.clientX;
        last3DY = e.clientY;

        if (isRotating3D) {
            Camera3D.rotate(-dx * 0.008, dy * 0.008);
            scheduleFrame();
        } else if (isPanning3D) {
            Camera3D.pan(dx, dy);
            scheduleFrame();
        }
    });

    canvas3dEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        Camera3D.zoom(factor);
        scheduleFrame();
    }, { passive: false });

    // Touch 3D
    canvas3dEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            isRotating3D = true;
            isPanning3D = false;
            last3DX = e.touches[0].clientX;
            last3DY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            isRotating3D = false;
            isPanning3D = true;
            last3DX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            last3DY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            initialPinch3D = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: false });

    canvas3dEl.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isRotating3D) {
            const dx = e.touches[0].clientX - last3DX;
            const dy = e.touches[0].clientY - last3DY;
            last3DX = e.touches[0].clientX;
            last3DY = e.touches[0].clientY;
            Camera3D.rotate(-dx * 0.01, dy * 0.01);
            scheduleFrame();
        } else if (e.touches.length === 2) {
            const curCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const curCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const dx = curCenterX - last3DX;
            const dy = curCenterY - last3DY;
            last3DX = curCenterX;
            last3DY = curCenterY;
            Camera3D.pan(dx, dy);

            const curDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (initialPinch3D > 0 && curDist > 0) {
                const factor = initialPinch3D / curDist;
                Camera3D.zoom(factor);
                initialPinch3D = curDist;
            }
            scheduleFrame();
        }
    }, { passive: false });

    canvas3dEl.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) initialPinch3D = -1;
        if (e.touches.length === 0) {
            isRotating3D = false;
            isPanning3D = false;
        }
    });
}

// Exposição global para interatividade e testes
if (typeof window !== 'undefined') {
    (window as any).StateManager = StateManager;
    (window as any).ExpressionManager = ExpressionManager;
    (window as any).MathEngine = MathEngine;
}
