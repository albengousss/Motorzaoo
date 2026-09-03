import 'mathlive';
import './style.css';
import { PrattParser } from './core/prattParser';
import { StateManager } from './core/stateManager';

let validEquations: {id: string, ast: any, isImplicit: boolean, operator: string, isEdo: boolean, isDerivative: boolean, derivVar?: string, isIvp?: boolean, isPoint?: boolean, pointX?: number, pointY?: number, pointLabel?: string, isParametric?: boolean, astX?: any, astY?: any, astZ?: any, isExplicitZ?: boolean, tMin?: number, tMax?: number, paramVar?: string, depVar?: string, indepVar?: string, condition?: (x: number, y: number, scope: any, t?: number) => boolean, name?: string, x0?: number, y0?: number, isHidden?: boolean, variable?: string, color?: string}[] = [];
let dragDistance = 0;
import { MathEngine } from './core/mathEngine';
import { Renderer } from './graphics/renderer';
import { GLRenderer } from './graphics/glRenderer';
import { Camera } from './graphics/camera';
import { Camera3D } from './graphics/camera3d';
import { Renderer3D } from './graphics/renderer3d';
import type { Surface3DItem } from './graphics/renderer3d';
import { ExpressionManager } from './ui/expressionManager';
import { MathAnalyzer } from './core/analyzer'; 
import { ODESolver } from './core/odeSolver';

const renderer = new Renderer('graphCanvas');
const glRenderer = new GLRenderer('webglCanvas');
const renderer3d = new Renderer3D('canvas3d');
const colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19'];

function resizeAll() {
    renderer.resize();
    glRenderer.resize();
    renderer3d.resize();
}

function getFreeVariables(ast: any, boundVars: string[] = []): string[] {
    const vars = new Set<string>();
    const standardNames = new Set(['pi', 'e', ...boundVars]);

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

let renderMemory_points: {mathX: number, mathY: number}[] = [];
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
    'limit', 'limitabove', 'limitbelow',
    'derivative', 'implicitderivative', 'nderivative',
    'integral', 'integralsymbolic', 'integralbetween', 'nintegral',
    'solveode', 'nsolveode',
    'taylorpolynomial', 'laplace', 'inverselaplace',
    'dimension', 'dot', 'cross', 'unitvector', 'unitperpendicularvector', 'perpendicularvector',
    'transpose', 'matrixrank', 'reducedrowechelonform', 'invert', 'characteristicpolynomial', 'minimalpolynomial',
    'eigenvalues', 'eigenvectors', 'jordandiagonalization', 'qrdecomposition', 'svd', 'ludecomposition',
    'isprime', 'nextprime', 'previousprime', 'primefactors', 'factors',
    'divisors', 'divisorslist', 'divisorssum',
    'gcd', 'lcm', 'extendedgcd',
    'div', 'mod', 'division', 'modularexponent', 'mixednumber', 'rationalize',
    'binomialdist', 'pascal', 'hypergeometric', 'poisson', 'zipf', 'normal', 'cauchy', 'exponential', 'weibull', 'gamma', 'chisquared', 'tdistribution',
    'determinant', 'applymatrix',
    'samplesd', 'covariance', 'variance', 'samplevariance',
    'mean', 'median', 'unique', 'frequency',
    'fitpoly', 'fitpow', 'fitexp', 'fitsin', 'fitlog', 'normalize',
    'setseed', 'randomuniform', 'randombetween', 'shuffle', 'randomelement', 'sample', 'randompolynomial',
    'sequence', 'iterationlist', 'element', 'first', 'last', 'take', 'append', 'flatten', 'length',
    'sum', 'product', 'rootlist',
    'tocomplex', 'topoint', 'topolar', 'toexponential',
    'intersect', 'radius', 'distance', 'angle', 'perpendicularbisector', 'applymatrix', 'reflect', 'rotate', 'shear', 'stretch', 'translate', 'infinitecone', 'surdtext', 'setviewdirection', 'setvisibleinview', 'attachcopytoview', 'setdecoration'
]);

/** Substitui variáveis definidas pelo utilizador com o prefixo usr_ para o Giac */
function prefixGiac(str: string): string {
    let res = str;
    const vars = Object.keys(StateManager.giacDefinitions);
    vars.sort((a, b) => b.length - a.length); // substitui as mais longas primeiro para evitar colisões
    for (const v of vars) {
        res = res.replace(new RegExp(`\\b${v}\\b`, 'g'), `usr_${v}`);
    }
    return res;
}

/** Interpreta condições de domínio do tipo {x >= 0} ou {-2 <= x <= 2} ou {0 <= t <= 2pi} */
function parseDomainCondition(condRaw: string): { condition: (x: number, y: number, scope: any, t?: number) => boolean, tBounds?: { tMin: number, tMax: number } } | null {
    let cleanCond = condRaw.trim()
        .replace(/\\le/g, '<=')
        .replace(/\\ge/g, '>=')
        .replace(/\\leq/g, '<=')
        .replace(/\\geq/g, '>=')
        .replace(/\\pi/g, 'pi')
        .replace(/π/g, 'pi');

    // 1. Desigualdade dupla: lower <= var <= upper (ex: -2 <= x <= 2, 0 <= t <= 2pi)
    const doubleMatch = cleanCond.match(/^(.+?)\s*(<=|<)\s*([a-zA-Z_])\s*(<=|<)\s*(.+)$/);
    if (doubleMatch) {
        const lowerStr = doubleMatch[1];
        const op1 = doubleMatch[2];
        const targetVar = doubleMatch[3];
        const op2 = doubleMatch[4];
        const upperStr = doubleMatch[5];

        let lowerAst: any = null;
        let upperAst: any = null;
        try {
            lowerAst = new PrattParser(lowerStr).parseExpression();
            upperAst = new PrattParser(upperStr).parseExpression();
        } catch(e) {}

        if (lowerAst && upperAst) {
            const lowerF = MathEngine.compile(lowerAst);
            const upperF = MathEngine.compile(upperAst);

            let tBounds: { tMin: number, tMax: number } | undefined = undefined;
            if (targetVar === 't' || targetVar === 'theta') {
                const minVal = lowerF(0, 0, StateManager.values);
                const maxVal = upperF(0, 0, StateManager.values);
                if (isFinite(minVal) && isFinite(maxVal)) {
                    tBounds = { tMin: minVal, tMax: maxVal };
                }
            }

            const condition = (x: number, y: number, scope: any, t?: number) => {
                const targetVal = targetVar === 'x' ? x : (targetVar === 'y' ? y : ((targetVar === 't' || targetVar === 'theta') ? (t ?? 0) : (scope[targetVar] ?? 0)));
                const lVal = lowerF(0, 0, scope);
                const uVal = upperF(0, 0, scope);
                const ok1 = op1 === '<=' ? lVal <= targetVal : lVal < targetVal;
                const ok2 = op2 === '<=' ? targetVal <= uVal : targetVal < uVal;
                return ok1 && ok2;
            };

            return { condition, tBounds };
        }
    }

    // 2. Desigualdade simples: var >= bound ou var <= bound (ex: x >= 0, t <= 5)
    const singleMatch = cleanCond.match(/^([a-zA-Z_])\s*(<=|>=|<|>|==|=)\s*(.+)$/);
    if (singleMatch) {
        const targetVar = singleMatch[1];
        const op = singleMatch[2];
        const boundStr = singleMatch[3];

        let boundAst: any = null;
        try {
            boundAst = new PrattParser(boundStr).parseExpression();
        } catch(e) {}

        if (boundAst) {
            const boundF = MathEngine.compile(boundAst);

            let tBounds: { tMin: number, tMax: number } | undefined = undefined;
            if (targetVar === 't' || targetVar === 'theta') {
                const val = boundF(0, 0, StateManager.values);
                if (isFinite(val)) {
                    if (op === '>=' || op === '>') tBounds = { tMin: val, tMax: 10 };
                    else if (op === '<=' || op === '<') tBounds = { tMin: -10, tMax: val };
                }
            }

            const condition = (x: number, y: number, scope: any, t?: number) => {
                const targetVal = targetVar === 'x' ? x : (targetVar === 'y' ? y : ((targetVar === 't' || targetVar === 'theta') ? (t ?? 0) : (scope[targetVar] ?? 0)));
                const bVal = boundF(0, 0, scope);
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

/** RAF debounce: evita múltiplos redraws no mesmo frame quando várias Promises terminam juntas */
let _rafPending = false;
function scheduleFrame() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => { _rafPending = false; drawFrame(); });
}

function drawFrame() {
    glRenderer.clear();
    renderer.clear();
    renderer.drawAxes(hoverX, hoverY);

    renderMemory_points = [];
    renderMemory_curves = [];
    renderMemory_segments = [];
    renderMemory_curve_points = [];

    // Limpa apenas as funções compiladas de EDOs/CAS; funções do utilizador serão recompiladas
    // somente quando as expressões mudarem (via isDirty).
    MathEngine.compiledFuncs = { realPow: MathEngine.realPow };

    const rawData = ExpressionManager.getAllExpressions();
    validEquations = [];
    const activeVars: string[] = [];

    rawData.forEach(item => {
        let ascii = item.rawAscii.trim();
        if (!ascii) {
            ExpressionManager.setResult(item.id, '');
            return;
        }
        // =========================================================
        // SANITIZAÇÃO: O Triturador de Sujeira do MathLive
        // =========================================================
        let cleanStr = ascii
            .replace(/\\left/g, '')
            .replace(/\\right/g, '')
            .replace(/\\cdot/g, '*')
            .replace(/\\times/g, '*')
            .replace(/\\ast/g, '*')
            .replace(/∗/g, '*')
            .replace(/⋅/g, '*')
            .replace(/×/g, '*');

        // Consertar letras espaçadas geradas quando o utilizador escreve manualmente no teclado
        const spacedFuncs = ['s i n', 'c o s', 't a n', 's e c', 'c s c', 'c o s s e c', 'c o t', 'c o t a n', 'a r c s i n', 'a r c c o s', 'a r c t a n', 'l o g', 'l n', 'e x p'];
        spacedFuncs.forEach(func => {
            const regex = new RegExp(func.split('').join('\\s*'), 'g');
            cleanStr = cleanStr.replace(regex, func.replace(/\s+/g, ''));
        });

        // Normalização de nomes de funções com subscrito (ex: f_{jose}(x), f_(1)(x), f_1(x))
        cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_[\{\(]([a-zA-Z0-9_]+)[\}\)]\s*(?=\()/g, '$1_$2');
        cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_([a-zA-Z0-9_]+)\s*(?=\()/g, '$1_$2');

        // Indexação de matrizes e listas (MathLive subscript para Giac 0-indexed)
        cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_\(([0-9]+),([0-9]+)\)/g, (_match, p1, p2, p3) => {
            return `${p1}[${parseInt(p2)-1},${parseInt(p3)-1}]`;
        });
        cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_([0-9]+)/g, (match, p1, p2) => {
            if (['f', 'g', 'h', 'c', 'C', 'y', 'x'].includes(p1)) return match;
            return `${p1}[${parseInt(p2)-1}]`;
        }).replace(/²/g, '^2').replace(/³/g, '^3');
        
        // Normalização universal de plicas (derivadas): suporta apóstrofo ('), unicode prime (′), acento agudo (´), etc.
        cleanStr = cleanStr
            .replace(/\^\s*\{\s*(?:\\prime|['´`’′]|\\doubleprime|″)+\s*\}/g, m => m.includes('double') || m.includes('″') || (m.match(/['´`’′]/g) || []).length > 1 ? "''" : "'")
            .replace(/\^\s*\(\s*(?:\\prime|['´`’′]|\\doubleprime|″)+\s*\)/g, m => m.includes('double') || m.includes('″') || (m.match(/['´`’′]/g) || []).length > 1 ? "''" : "'")
            .replace(/\^\s*(?:\\doubleprime|″)/g, "''")
            .replace(/\^\s*(?:\\prime|['´`’′])/g, "'")
            .replace(/\\doubleprime/g, "''")
            .replace(/\\prime/g, "'")
            .replace(/″/g, "''")
            .replace(/[´`’′]/g, "'")
            .replace(/\^'+/g, m => m.replace(/\^/g, ''));

        // Normalização de frações (LaTeX \frac{a}{b} e AsciiMath frac(a)(b))
        cleanStr = cleanStr
            .replace(/frac\s*\(([^)]+)\)\s*\(([^)]+)\)/g, '(($1)/($2))')
            .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '(($1)/($2))');

        // Convert d/dx(expr) to diff(expr, x)
        cleanStr = cleanStr.replace(/(?:\\frac\{d\}\{d([a-zA-Z_])\}|d\/d([a-zA-Z_])|\(d\)\/\(d([a-zA-Z_])\))\s*\(([^)]+)\)/g, 'diff($4, $1$2$3)');

        // Normalização universal de diferenciais e integrais (LaTeX e MathLive)
        cleanStr = cleanStr
            .replace(/\\mathrm\{d\}/gi, ' d ')
            .replace(/\\text\{d\}/gi, ' d ')
            .replace(/\\differentialD/gi, ' d ')
            .replace(/\\,/g, ' ');

        // 1. Integral definida: \int_0^2 x dx ou \int_{0}^{2} x dx ou \int^2_0 x dx
        cleanStr = cleanStr.replace(/\\?int(?:_(?:\{([^}]+)\}|([a-zA-Z0-9.]+))\^(?:\{([^}]+)\}|([a-zA-Z0-9.]+))|\^(?:\{([^}]+)\}|([a-zA-Z0-9.]+))_(?:\{([^}]+)\}|([a-zA-Z0-9.]+)))\s*(.+?)\s*d\s*([a-zA-Z_])\s*$/i,
            (_m, l1, l2, u1, u2, u3, u4, l3, l4, expr, v) => {
                const lower = l1 ?? l2 ?? l3 ?? l4;
                const upper = u1 ?? u2 ?? u3 ?? u4;
                return `integrate(${expr.trim()}, ${v}, ${lower}, ${upper})`;
            }
        );

        // 2. Integral indefinida: \int y dy ou \int ydy ou int t dy ou \int h dy
        cleanStr = cleanStr.replace(/\\?int\s*(.+?)\s*d\s*([a-zA-Z_])\s*$/i,
            (_m, expr, v) => `integrate(${expr.trim()}, ${v})`
        );

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
        try {
            ast = new PrattParser(cleanStr).parseExpression();
        } catch(e) {}

        if (ast && MathEngine.isGiacCommand(ast)) {
            const giacQuery = MathEngine.formatForGiac(ast);
            const cached = StateManager.casSolutions[item.id];
            if (cached && cached.query === giacQuery) {
                ExpressionManager.setResult(item.id, `= ${cached.result}`);
                try {
                    const solvedAst = new PrattParser(cached.result).parseExpression();
                    const free = getFreeVariables(solvedAst, []);
                    if (free.includes('x') || (!isNaN(Number(cached.result)) && isFinite(Number(cached.result)))) {
                        validEquations.push({ 
                            color: item.color, 
                            id: item.id, 
                            ast: solvedAst, 
                            isImplicit: false, 
                            operator: '=', 
                            isEdo: false, 
                            isDerivative: false, 
                            isHidden: !item.visible, 
                            variable: 'x' 
                        });
                    }
                } catch(e) {}
            } else {
                ExpressionManager.setResult(item.id, 'Calculando...');
                MathEngine.askGiac(giacQuery).then(res => {
                    const cleanResult = res.replace(/"/g, '').trim();
                    StateManager.casSolutions[item.id] = { query: giacQuery, result: cleanResult };
                    scheduleFrame();
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
                    
                    let giacQ = `desolve(${odeEq}, ${depVar})`;
                    
                    // Extrair pontos de condição inicial: SolveODE(y' = y, (0, 2)) ou SolveODE(y''=y, (0,2), (0,1))
                    const doublePtMatch = odeEq.match(/(.+?),\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*,\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
                    const singlePtMatch = !doublePtMatch ? odeEq.match(/(.+?),\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/) : null;
                    
                    if (doublePtMatch) {
                        giacQ = `desolve([${doublePtMatch[1]}, ${depVar}(${doublePtMatch[2]})=${doublePtMatch[3]}, ${depVar}'(${doublePtMatch[4]})=${doublePtMatch[5]}], ${depVar})`;
                    } else if (singlePtMatch) {
                        giacQ = `desolve([${singlePtMatch[1]}, ${depVar}(${singlePtMatch[2]})=${singlePtMatch[3]}], ${depVar})`;
                    }
                    
                    MathEngine.askGiac(giacQ).then(res => {
                        StateManager.pendingOdes[item.id] = false;
                        const cleanResult = res.replace(/"/g, '').replace(/list\[/g, '[').replace(/usr_/g, '').trim();
                        
                        let finalExpr = cleanResult;
                        if (cleanResult.startsWith('[') && cleanResult.endsWith(']')) {
                            const inner = cleanResult.substring(1, cleanResult.length - 1);
                            if (inner) finalExpr = inner.split(',')[0];
                            else finalExpr = 'Erro: Sem solução';
                        }
                        
                        if (finalExpr.includes('Erro') || finalExpr.includes('ausente') || finalExpr.includes('Mock')) {
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
                        scheduleFrame();
                    });
                }
            }
            return; // Interrompe para não renderizar mais nada como texto
        } else if (genericCasMatch && casCommandsList.has(genericCasMatch[2].toLowerCase())) {
            const assignTarget = genericCasMatch[1];
            const cmdName = genericCasMatch[2].toLowerCase();
            const cmdArgs = genericCasMatch[3];
            const currentQuery = assignTarget ? `${assignTarget}=${cmdName}(${cmdArgs})` : `${cmdName}(${cmdArgs})`;
                    if (cmdArgs.trim() === '') {
                        ExpressionManager.setResult(item.id, '');
                        return;
                    }

            const cached = StateManager.casSolutions[item.id];
            if (cached && cached.query === currentQuery) {
                ExpressionManager.setResult(item.id, cached.result.includes('Erro') ? `- Erro no cálculo` : `= ${cached.result}`);
                
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
                    if (argsList.length >= 2 && (cmdName === 'integral' || cmdName === 'derivative' || cmdName === 'limit')) {
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
                    } catch (_) {}

                    // Mapeia comandos GeoGebra para Giac nativo!
                    // Converte sintaxe de matriz GeoGebra {{1,2},{3,4}} para sintaxe Giac [[1,2],[3,4]]
                    const giacArgs = prefixGiac(expandedArgs.replace(/\{/g, '[').replace(/\}/g, ']'));

                    let giacCommand = `${cmdName}(${giacArgs})`;
                    
                    if (cmdName === 'derivative' || cmdName === 'nderivative') giacCommand = `diff(${giacArgs})`;
                    else if (cmdName === 'implicitderivative') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 1) giacCommand = `-(diff(${args[0]}, x))/(diff(${args[0]}, y))`;
                        else if (args.length === 3) giacCommand = `-(diff(${args[0]}, ${args[2]}))/(diff(${args[0]}, ${args[1]}))`;
                    }
                    else if (cmdName === 'integral' || cmdName === 'integralsymbolic' || cmdName === 'nintegral') giacCommand = `integrate(${giacArgs})`;
                    else if (cmdName === 'integralbetween') {
                        const args = giacArgs.split(',').map(s => s.trim());
                        if (args.length === 4) giacCommand = `integrate(${args[0]} - (${args[1]}), x, ${args[2]}, ${args[3]})`;
                        else if (args.length === 5) giacCommand = `integrate(${args[0]} - (${args[1]}), ${args[2]}, ${args[3]}, ${args[4]})`;
                    }
                    else if (cmdName === 'limitabove') giacCommand = `limit(${giacArgs}, 1)`;
                    else if (cmdName === 'limitbelow') giacCommand = `limit(${giacArgs}, -1)`;
                    else if (cmdName === 'completesquare') giacCommand = `canonical_form(${giacArgs})`;
                    else if (cmdName === 'nsolve' || cmdName === 'nsolutions') giacCommand = `fsolve(${giacArgs})`;
                    else if (cmdName === 'solutions') giacCommand = `solve(${giacArgs})`;
                    else if (cmdName === 'cross') giacCommand = `cross_point(${giacArgs})`; 
                    else if (cmdName === 'dot') giacCommand = `dot_product(${giacArgs})`;
                    else if (cmdName === 'primefactors') giacCommand = `ifactors(${giacArgs})`;
                    else if (cmdName === 'matrixrank') giacCommand = `rank(${giacArgs})`;
                    else if (cmdName === 'reducedrowechelonform') giacCommand = `rref(${giacArgs})`;
                    else if (cmdName === 'determinant') giacCommand = `det(${giacArgs})`;
                    else if (cmdName === 'eigenvalues') giacCommand = `eigenvals(${giacArgs})`;
                    else if (cmdName === 'eigenvectors') giacCommand = `eigenvects(${giacArgs})`;
                    else if (cmdName === 'invert') giacCommand = `inv(${giacArgs})`;
                    else if (cmdName === 'ludecomposition') giacCommand = `lu(${giacArgs})`;
                    else if (cmdName === 'lcm') giacCommand = `lcm(${giacArgs})`;
                    else if (cmdName === 'jordandiagonalization') giacCommand = `jordan(${giacArgs})`;
                    else if (cmdName === 'characteristicpolynomial') giacCommand = `charpoly(${giacArgs})`;
                    else if (cmdName === 'minimalpolynomial') giacCommand = `pmin(${giacArgs})`;
                    else if (cmdName === 'dimension') giacCommand = `dim(${giacArgs})`;
                    else if (cmdName === 'length') giacCommand = `abs(${giacArgs})`;
                    else if (cmdName === 'transpose') giacCommand = `tran(${giacArgs})`;
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
                    else if (cmdName === 'nsolveode') giacCommand = `desolve(${giacArgs})`;

                                const noSimplifyCmds = ['simplify', 'factor', 'expand', 'nsolve', 'nsolutions', 'solutions', 'solve', 'limit', 'limitabove', 'limitbelow', 'cross', 'dot', 'primefactors', 'matrixrank', 'qrdecomposition', 'laplace', 'applymatrix', 'nsolveode', 'desolve'];
                                if (!noSimplifyCmds.includes(cmdName)) {
                                    giacCommand = `simplify(${giacCommand})`;
                                }
                    
                    if (assignTarget) {
                    
                        giacCommand = `${assignTarget}:=${giacCommand}`;
                    
                    }
                    
                    MathEngine.askGiac(giacCommand).then(res => {
                        StateManager.pendingCas[item.id] = false;
                        if (res.includes('carregar')) {
                            ExpressionManager.setResult(item.id, `(A carregar motor...)`);
                            StateManager.pendingCas[item.id] = false;
                        } else if (res.includes('Erro') || res.includes('ausente') || res.includes('Mock')) {
                            StateManager.casSolutions[item.id] = { query: currentQuery, result: 'Erro no cálculo' };
                            ExpressionManager.setResult(item.id, `- Erro no cálculo`);
                        } else {
                            // Limpa as aspas do Giac e espaços extras
                            let cleanResult = res.replace(/"/g, '').replace(/list\[/g, '[').replace(/usr_/g, '').trim();
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
                                  const nonPlottingCmds = ['determinant', 'dot', 'cross', 'length', 'dimension', 'matrixrank', 'lcm', 'gcd', 'nsolve', 'nsolutions', 'solutions', 'solve', 'limit', 'limitabove', 'limitbelow'];
                                  
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
            } catch(e) {}
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
                              } catch(e) {}
                              
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
                        scheduleFrame();
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
                    const derivMatch = !isMultiVar ? expr.match(/^(?:\\frac\{d\}\{d([a-zA-Z])\}|d\/d([a-zA-Z])|\(d\)\/\(d([a-zA-Z])\))\s*(.+)$/) : null;
                    if (derivMatch) {
                        const derivVar = derivMatch[1] || derivMatch[2] || derivMatch[3];
                        const derivExpr = derivMatch[4];
                        const ast = new PrattParser(derivExpr).parseExpression();
                        MathEngine.compiledFuncs[funcName] = MathEngine.createDerivativeFunction(ast, derivVar);
                        MathEngine.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        StateManager.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: true, derivVar, isHidden: !item.visible, variable: paramNames[0] });
                        ExpressionManager.setResult(item.id, `Derivada ${funcName}(${paramNames[0]})`);
                    } else {
                        const ast = new PrattParser(expr).parseExpression();
                        MathEngine.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        StateManager.userFunctions[funcName] = { params: paramNames, expr, ast, blockId: item.id };
                        
                        if (isMultiVar) {
                            // Função multivariável (ex: f(x, y) = x^2*y + y^2/x ou f(x, y, z, a, b))
                            MathEngine.compiledFuncs[funcName] = MathEngine.compileMultivariable(ast, paramNames);
                            
                            // Envia definição multivariável ao Giac para permitir int(f(x, y, z), y) e diff(f(x, y), x)
                            const giacDef = `usr_${funcName}(${paramNames.join(',')}):=${expr}`;
                            if (StateManager.giacDefinitions[funcName] !== giacDef) {
                                StateManager.giacDefinitions[funcName] = giacDef;
                                StateManager.casSolutions = {};
                                MathEngine.askGiac(giacDef);
                            }

                            ExpressionManager.setResult(item.id, `Função ${funcName}(${paramNames.join(', ')}) guardada`);
                        } else {
                            // Função monovariável (ex: f(x) = x^2)
                            const paramName = paramNames[0];
                            // Se o lado direito for comando simbólico Giac (ex: integral, derivada simbólica, limit, factor):
                            if (MathEngine.isGiacCommand(ast)) {
                                const giacQuery = MathEngine.formatForGiac(ast);
                                const cached = StateManager.casSolutions[item.id];
                                if (cached && cached.query === giacQuery) {
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
                                    MathEngine.askGiac(giacQuery).then(res => {
                                        const cleanRes = res.replace(/"/g, '').trim();
                                        StateManager.casSolutions[item.id] = { query: giacQuery, result: cleanRes };
                                        scheduleFrame();
                                    });
                                    MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                                    validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                                }
                            } else {
                                MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                                // Empurra para plotar no gráfico!
                                validEquations.push({ color: item.color, id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                                
                                // Verifica se depende de variáveis adicionais (sliders)
                                const freeVars = getFreeVariables(ast, [paramName]);
                                if (freeVars.length > 0) {
                                    const unbound = freeVars.filter(v => StateManager.values[v] === undefined && MathEngine.compiledFuncs[v] === undefined);
                                    if (unbound.length > 0) {
                                        ExpressionManager.setResult(item.id, `Defina o slider para: ${unbound.join(', ')}`);
                                    } else {
                                        ExpressionManager.setResult(item.id, `Função ${funcName}(${paramName}) salva`);
                                    }
                                } else {
                                    ExpressionManager.setResult(item.id, `Função ${funcName}(${paramName}) salva`);
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
                } catch(e) {
                    ExpressionManager.setResult(item.id, `Erro: ${(e as Error).message}`);
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
            } catch(e) {}
        }

        // 4. SLIDERS GLOBAIS E DEFINIÇÃO DE MATRIZES
        const assignmentMatch = noSpaceStr.match(/^\\?([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/);
        if (assignmentMatch) {
            const varName = assignmentMatch[1].replace(/[\\]/g, '');
            const rightSide = assignmentMatch[2];
            const rightSideClean = cleanStr.substring(cleanStr.indexOf('=') + 1).trim();
            
            const blockEl = document.getElementById(item.id);
            const mfEl = blockEl ? blockEl.querySelector('math-field') : null;
            const rawLatex = mfEl ? (mfEl as any).getValue('latex') : '';
            
            // É matriz ou vetor? Verifica LaTeX, chaves e colchetes
            const cleanMatStr = rightSideClean.replace(/\\/g, '');
            const isMatrix = cleanMatStr.startsWith('{') || cleanMatStr.startsWith('[') || 
                             cleanMatStr.startsWith('lbrace') || cleanMatStr.startsWith('matrix') ||
                             rawLatex.includes('\\{') || rawLatex.includes('\\bmatrix') || rawLatex.includes('\\pmatrix');
            
            if (isMatrix) {
                // Se o rightSideClean tiver lbrace, vamos tentar usar o latex diretamente!
                let giacMatrix = '';
                if (cleanMatStr.startsWith('lbrace') || !cleanMatStr.includes('{')) {
                    // Limpar o LaTeX para Giac: \{ -> [ e \} -> ]
                    giacMatrix = rawLatex.replace(/\\left\\{/g, '[').replace(/\\right\\}/g, ']')
                                         .replace(/\\{/g, '[').replace(/\\}/g, ']')
                                         .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']')
                                         .replace(/=/g, '').replace(/[a-zA-Z_]+\s*/, ''); 
                    // Isso é um fallback bruto, mas funciona melhor com o rawLatex limpo.
                    // Garantimos que a string de matriz tenha colchetes:
                    const matchMat = giacMatrix.match(/\[.*\]/);
                    if (matchMat) giacMatrix = matchMat[0];
                } else {
                    giacMatrix = cleanMatStr.replace(/\{/g, '[').replace(/\}/g, ']');
                }
                // Fix missing commas between rows: [[a,b][c,d]] -> [[a,b],[c,d]]
                giacMatrix = giacMatrix.replace(/\]\s*\[/g, '],[');
                const giacDef = `usr_${varName}:=${giacMatrix}`;
                
                if (StateManager.giacDefinitions[varName] !== giacDef) {
                    StateManager.giacDefinitions[varName] = giacDef;
                    StateManager.casSolutions = {}; // INVALIDE CACHE SO DEPENDENTS UPDATE!
                    MathEngine.askGiac(giacDef).then(res => {
                        let formattedRes = res.replace(/"/g, '').replace(/list\[/g, '[').replace(/usr_/g, '').trim();
                        ExpressionManager.setResult(item.id, formattedRes.includes('Erro') ? `- Erro no cálculo` : `= ${formattedRes}`);
                    });
                } else {
                    ExpressionManager.setResult(item.id, `= [Matriz Registada]`);
                }
                return; // Encerra o processamento, pois não queremos renderizar gráfico disto
            }

            const isMultiVarProd = varName.length > 1 && !varName.includes('_') && /[xyzt]/.test(varName);
            if (!['x', 'y', 'z', 't', 'e', 'pi'].includes(varName) && !isMultiVarProd && !genericCasMatch) {
                // Suporte para declaração de ponto A = (x, y)
                let pointAst: any = null;
                try {
                    pointAst = new PrattParser(rightSideClean).parseExpression();
                } catch (e) {}

                if (pointAst && pointAst[0] === 'Point') {
                    const evalX = MathEngine.compile(pointAst[1])(0, 0, StateManager.values);
                    const evalY = MathEngine.compile(pointAst[2])(0, 0, StateManager.values);
                    if (isFinite(evalX) && isFinite(evalY)) {
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
                        ExpressionManager.setResult(item.id, `= (${parseFloat(evalX.toFixed(3))}, ${parseFloat(evalY.toFixed(3))})`);
                        return;
                    }
                }

                if (!rightSide.includes('x') && !rightSide.includes('y') && !rightSide.includes('z')) {
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
                    } catch (e) {}
                    return; 
                }
            }
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
            
            const zExplicitMatch = cleanStr.match(/^\s*z\s*=\s*(.+)$/);
            const yExplicitMatch = cleanStr.match(/^\s*y\s*=\s*(.+)$/);
            if (zExplicitMatch) {
                expressaoPlot = zExplicitMatch[1].trim();
                isExplicitZ = true;
            } else if (yExplicitMatch) {
                expressaoPlot = yExplicitMatch[1].trim();
                isExplicitY = true;
            } else {
                // Captura gráficos de derivadas diretas como: d/dx sin(x)
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

            let ast = new PrattParser(expressaoPlot).parseExpression();
            ast = MathEngine.expandUserFunctions(ast);

            // Suporte para plotagem de pontos individuais ou curvas paramétricas: (x(t), y(t)) ou (x(t), y(t), z(t))
            if (ast && ast[0] === 'Point') {
                const is3D = ast.length > 3;
                const varsX = StateManager.extractVariables(ast[1]);
                const varsY = StateManager.extractVariables(ast[2]);
                const varsZ = is3D ? StateManager.extractVariables(ast[3]) : [];
                const isParametric = varsX.includes('t') || varsY.includes('t') || varsZ.includes('t');

                if (isParametric) {
                    const hasTrig = JSON.stringify(ast).toLowerCase().includes('sin') || JSON.stringify(ast).toLowerCase().includes('cos');
                    const tMin = explicitTBounds?.tMin ?? (hasTrig ? 0 : -10);
                    const tMax = explicitTBounds?.tMax ?? (hasTrig ? 2 * Math.PI : 10);

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
                        paramVar: 't',
                        condition: conditionFn,
                        operator: '=',
                        isHidden: !item.visible
                    });
                    ExpressionManager.setResult(item.id, `Curva Paramétrica ${is3D ? '3D ' : ''}(t ∈ [${parseFloat(tMin.toFixed(2))}, ${parseFloat(tMax.toFixed(2))}])`);
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

            // MODO CALCULADORA (Sem gráficos)
            const isPlot = expressaoPlot.includes('x') || expressaoPlot.includes('y') || expressaoPlot.includes('z');
            if (!isPlot && !isImplicit && !isDerivativePlot && !isExplicitY && !isExplicitZ) {
                // Tenta PRIMEIRO a avaliação numérica direta local (ex: f(0, 2), 2 + 3, sin(pi/4), f(2, 3, 1, 0, 2))
                const evalFunc = MathEngine.compile(ast);
                const val = evalFunc(0, 0, StateManager.values);
                if (!isNaN(val)) {
                    ExpressionManager.setResult(item.id, '= ' + parseFloat(val.toFixed(4)).toString());
                    return;
                }

                const giacVars = Object.keys(StateManager.giacDefinitions);
                const hasGiacVar = giacVars.some(v => new RegExp(`\\b${v}\\b`).test(expressaoPlot)) && !StateManager.values.hasOwnProperty(expressaoPlot);
                const isMatrixArithmetic = expressaoPlot.includes('{') || expressaoPlot.includes('[');

                if (hasGiacVar || isMatrixArithmetic) {
                    const currentQuery = expressaoPlot;
                    const cached = StateManager.casSolutions[item.id];
                    if (cached && cached.query === currentQuery) {
                        ExpressionManager.setResult(item.id, cached.result.includes('Erro') ? `- Erro no cálculo` : `= ${cached.result}`);
                    } else if (!StateManager.pendingCas[item.id]) {
                        ExpressionManager.setResult(item.id, 'Calculando...');
                        StateManager.pendingCas[item.id] = true;
                        
                        let giacQuery = prefixGiac(expressaoPlot).replace(/\\left\\{/g, '[').replace(/\\right\\}/g, ']')
                                         .replace(/\\{/g, '[').replace(/\\}/g, ']')
                                         .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
                        giacQuery = giacQuery.replace(/\]\s*\[/g, '],[');

                        MathEngine.askGiac(giacQuery).then(res => {
                            StateManager.pendingCas[item.id] = false;
                            let formattedRes = res.replace(/"/g, '').replace(/list\[/g, '[').replace(/usr_/g, '').trim();
                            
                            // If Giac returns an error, fallback to local eval if we can
                            if (formattedRes.includes('Erro') || formattedRes.includes('undef')) {
                                formattedRes = 'Erro no cálculo';
                            }
                            
                            StateManager.casSolutions[item.id] = { query: currentQuery, result: formattedRes, ast: null };
                            ExpressionManager.setResult(item.id, formattedRes.includes('Erro') ? `- Erro no cálculo` : `= ${formattedRes}`);
                            scheduleFrame();
                        });
                    }
                    return;
                }
                
                ExpressionManager.setResult(item.id, '');
                return; 
            } else {
                ExpressionManager.setResult(item.id, '');
            }

            validEquations.push({ color: item.color, id: item.id, ast, isImplicit, operator, isEdo: false, isDerivative: isDerivativePlot, derivVar: derivVarTarget, condition: conditionFn, isHidden: !item.visible, isExplicitZ });
        } catch (e) {
            // Em vez de engolir o erro silenciosamente, avisa o utilizador no ecrã
            ExpressionManager.setResult(item.id, '⚠ Sintaxe Inválida');
        }
    });

    // Run Garbage Collection for deleted sliders
    StateManager.gc(activeVars);

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
                try {
                    if (Array.isArray(item.ast) && item.ast[0] === 'Equal') {
                        const left = GLRenderer.astToGLSL(item.ast[1], StateManager.values);
                        const right = GLRenderer.astToGLSL(item.ast[2], StateManager.values);
                        glsl = `(${left}) - (${right})`;
                    } else {
                        glsl = GLRenderer.astToGLSL(item.ast, StateManager.values);
                    }
                } catch (_) {}

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

        if (item.isPoint && typeof item.pointX === 'number' && typeof item.pointY === 'number') {
            renderer.drawDiscretePoint(item.pointX, item.pointY, color, item.pointLabel);
            renderMemory_points.push({ mathX: item.pointX, mathY: item.pointY });
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
                // FWD
                const tMax = Camera.xMax;
                const pointsFwd = ODESolver.solveDormandPrince(
                    (t: number, y: number) => compiledEdo(t, y, StateManager.values), 
                    ivpItem.x0, ivpItem.y0, 
                    tMax, 
                    (tMax - ivpItem.x0) / 100
                );
                // BWD (reverse independent variable to integrate backwards)
                const tauMax = ivpItem.x0 - Camera.xMin;
                const pointsBwd = ODESolver.solveDormandPrince(
                    (tau: number, y: number) => -compiledEdo(ivpItem.x0 - tau, y, StateManager.values), 
                    0, ivpItem.y0, 
                    tauMax, 
                    tauMax / 100
                );
                
                const reversed = pointsBwd.map((p: any) => ({ x: ivpItem.x0 - p.x, y: p.y })).reverse();
                reversed.pop(); // remove point at tau=0 (x0) to prevent duplicate
                const allPoints = reversed.concat(pointsFwd);
                
                renderer.drawCurve(allPoints, color);
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

            renderer.drawCurve(pontos, color);
            renderMemory_curve_points.push({ points: pontos, color });

        } else if (item.isDerivative) {
            const derivFunc = MathEngine.createDerivativeFunction(item.ast, item.derivVar || 'x');
            const f = (x: number) => derivFunc(x, 0, StateManager.values);
            
            // Usa amostragem adaptativa em vez de um loop fixo de 300 pontos
            const derivAst = item.ast;
            const derivVar = item.derivVar || 'x';
            const pontos = MathEngine.generatePointsAdaptive(derivAst, Camera.xMin, Camera.xMax, StateManager.values, derivVar, canvasEl.width)
                .map(p => ({ x: p.x, y: f(p.x) }));

            renderer.drawCurve(pontos, color);
            explicitCurves.push({ f, color });
            renderMemory_curves.push({ f, color }); 

        } else if (item.isImplicit) {
            glRenderer.drawImplicit(item.ast, item.operator, StateManager.values, color);

        } else if (Array.isArray(item.ast) && item.ast[0] === 'Integrate') {
            const funcAst = item.ast[1]; const minAst = item.ast[3]; const maxAst = item.ast[4];
            const minVal = MathEngine.evaluateAST(minAst, StateManager.values);
            const maxVal = MathEngine.evaluateAST(maxAst, StateManager.values);

            if (!isNaN(minVal) && !isNaN(maxVal)) {
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
                ExpressionManager.setResult(item.id, 'Limites indefinidos');
            }
        } else {
            const fastF = MathEngine.compile(item.ast, item.variable || 'x');
            const f = (x: number) => {
                if (item.condition && !item.condition(x, 0, StateManager.values)) return NaN;
                return fastF(x, 0, StateManager.values);
            };
            const pontos = MathEngine.generatePointsAdaptive(item.ast, Camera.xMin, Camera.xMax, StateManager.values, item.variable || 'x', canvasEl.width)
                .map(p => ({ x: p.x, y: f(p.x) }));
            
            renderer.drawCurve(pontos, color);
            explicitCurves.push({ f, color });
            renderMemory_curves.push({ f, color }); 
        }
    });

    // --- ANÁLISE DE PONTOS NOTÁVEIS ---
    for (let i = 0; i < explicitCurves.length; i++) {
        const curve = explicitCurves[i];
        const points = MathAnalyzer.getNotablePoints(curve.f, Camera.xMin, Camera.xMax);
        renderer.drawPoints(points, curve.color);
        
        points.forEach(p => renderMemory_points.push({ mathX: p.x, mathY: p.y }));

        for (let j = i + 1; j < explicitCurves.length; j++) {
            const other = explicitCurves[j];
            const intersects = MathAnalyzer.getIntersections(curve.f, other.f, Camera.xMin, Camera.xMax);
            renderer.drawPoints(intersects, '#888888'); 
            
            intersects.forEach(p => renderMemory_points.push({ mathX: p.x, mathY: p.y }));
        }
    }

    if (globalTracePoint) {
        renderer.drawPoints([{x: globalTracePoint.x, y: globalTracePoint.y}], globalTracePoint.color);
    }
}

ExpressionManager.init(drawFrame);

// ─── HANDLERS GLOBAIS DOS BOTÕES DO HUD ───────────────────────────────────────

/** Repõe a vista para o estado padrão (zoom 1:1, centrado na origem) */

// --- CONFIGURAÇÕES DO GRÁFICO ---
(window as any)._toggleSettings = () => {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
};

(window as any)._updateSettings = () => {
    const axesCb = document.getElementById('setting-axes') as HTMLInputElement;
    const gridCb = document.getElementById('setting-grid') as HTMLInputElement;
    if (axesCb && gridCb) {
        renderer.showAxes = axesCb.checked;
        renderer.showGrid = gridCb.checked;
        drawFrame();
    }
};

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

/** Limpa todas as expressões e reinicia o estado */
(window as any)._clearAll = () => {
    if (!confirm('Limpar todas as expressões?')) return;
    const list = document.getElementById('expressions-list');
    if (list) list.innerHTML = '';
    ExpressionManager.blockCounter = 0;
    StateManager.values = {};
    StateManager.asts = {};
    StateManager.odeSolutions = {};
    StateManager.casSolutions = {};
    StateManager.pendingOdes = {};
    StateManager.pendingCas = {};
    StateManager.giacDefinitions = {};
    StateManager.dependents = {};
    MathEngine.compiledFuncs = {};
    ExpressionManager.addBlock();
    drawFrame();
};

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
                label: 'func',
                tooltip: 'Funções e Cálculo',
                rows: [
                    [
                        { insert: "sin(", latex: "\\sin" },
                        { insert: "cos(", latex: "\\cos" },
                        { insert: "tan(", latex: "\\tan" },
                        { insert: "cot(", latex: "\\cot" },
                        { insert: "sec(", latex: "\\sec" },
                        { insert: "csc(", latex: "\\csc" }
                    ],
                    [
                        { insert: "arcsin(", latex: "\\arcsin" },
                        { insert: "arccos(", latex: "\\arccos" },
                        { insert: "arctan(", latex: "\\arctan" },
                        { insert: "sinh(", latex: "\\sinh" },
                        { insert: "cosh(", latex: "\\cosh" },
                        { insert: "tanh(", latex: "\\tanh" }
                    ],
                    [
                        { insert: "d/dx(#?)", latex: "\\frac{d}{dx}" },
                        { insert: "\\int #? d x", latex: "\\int" },
                        { insert: "\\int_{#?}^{#?} #? d x", latex: "\\int_a^b" },
                        { insert: "\\lim_{x \\to #?} #?", latex: "\\lim" },
                        { insert: "|#?|", latex: "|x|" },
                        { insert: "ln(", latex: "\\ln" },
                        { insert: "log(", latex: "\\log" }
                    ],
                    [
                        { insert: "SolveODE(#?)", label: "EDO", tooltip: "Resolver EDO" },
                        { insert: "Campo(#?)", label: "Campo", tooltip: "Campo de Direções" },
                        { insert: "f(x, y) = ", label: "f(x, y)" },
                        { insert: "g(x, y) = ", label: "g(x, y)" },
                        { insert: "Simplify(#?)", label: "Simplificar" },
                        { insert: "Factor(#?)", label: "Fatorar" }
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
            if (vk.visible) {
                if (kbIcon) {
                    kbIcon.setAttribute('data-lucide', 'chevron-down');
                    if ((window as any).lucide) (window as any).lucide.createIcons();
                }
                if (window.innerWidth <= 768) {
                    const keyboardHeight = vk.boundingRect.height || 280;
                    
                    if (!sidebarEl.dataset.savedHeight) {
                        sidebarEl.dataset.savedHeight = sidebarEl.getBoundingClientRect().height.toString();
                    }
                    
                    // Posiciona a barra exatamente acima do teclado sem distorcer o canvas
                    sidebarEl.style.marginBottom = `${keyboardHeight}px`;
                    sidebarEl.style.maxHeight = `calc(100vh - ${keyboardHeight + 50}px)`;
                    
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
                if (window.innerWidth <= 768) {
                    sidebarEl.style.marginBottom = '0px';
                    sidebarEl.style.maxHeight = '';
                    if (sidebarEl.dataset.savedHeight) {
                        sidebarEl.style.height = `${sidebarEl.dataset.savedHeight}px`;
                        sidebarEl.dataset.savedHeight = '';
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


function getClosestCurvePoint(pixelX: number, pixelY: number, maxDist: number = 15): { mathX: number, mathY: number, px: number, py: number, color: string, dist: number } | null {
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
            closest = { mathX, mathY: y, px: pixelX, py, color: curve.color, dist };
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
    isDragging = true; 
    isTracing = false;
    dragDistance = 0;
    lastX = e.clientX; 
    lastY = e.clientY; 
    
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
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

canvasEl.addEventListener('click', (e) => {
    if (dragDistance < 5 && !isTracing) {
        const rect = canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const mathX = Camera.xMin + (mx / Camera.width) * (Camera.xMax - Camera.xMin);
        const mathY = Camera.yMax - (my / Camera.height) * (Camera.yMax - Camera.yMin);
        
        const activeSlopeFields = validEquations.filter(eq => eq.isEdo);
        if (activeSlopeFields.length > 0) {
            const edoName = activeSlopeFields[0].name;
            const x0 = parseFloat(mathX.toFixed(2));
            const y0 = parseFloat(mathY.toFixed(2));
            ExpressionManager.addExpression(`${edoName}(${x0}) = ${y0}`);
        }
    }
});

window.addEventListener('mouseup', () => { 
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

    if (isShiftDown) {
        const oldX = hoverX; const oldY = hoverY;
        updateHover();
        if (oldX !== hoverX || oldY !== hoverY) drawFrame();
    }

    if (isDragging) {
        dragDistance += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        Camera.pan(dx, dy);
        drawFrame();
    } else if (isTracing) {
        // Find closest point with a large maxDist to lock onto the curve
        const closest = getClosestCurvePoint(mouseX, mouseY, 2000);
        if (closest) {
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
        }
    } else {
        let foundCollision = false;
        let snapPixelX = 0; let snapPixelY = 0;
        let labelText = '';

        const formatCoord = (val: number) => parseFloat(val.toFixed(4)).toString();

        for (const p of renderMemory_points) {
            const px = Camera.toPixelX(p.mathX);
            const py = Camera.toPixelY(p.mathY);
            const dist = Math.hypot(mouseX - px, mouseY - py); 
            
            if (dist < 12) { 
                foundCollision = true;
                snapPixelX = px; snapPixelY = py;
                labelText = `(${formatCoord(p.mathX)}, ${formatCoord(p.mathY)})`;
                break;
            }
        }

        if (!foundCollision) {
            const closest = getClosestCurvePoint(mouseX, mouseY, 15);
            if (closest) {
                foundCollision = true;
                snapPixelX = closest.px; snapPixelY = closest.py;
                labelText = `(${formatCoord(closest.mathX)}, ${formatCoord(closest.mathY)})`;
            }
        }

        if (foundCollision) {
            tooltip.innerText = labelText;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + snapPixelX) + 'px';
            tooltip.style.top = (rect.top + snapPixelY - 10) + 'px';
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            document.body.style.cursor = 'crosshair';
        } else {
            tooltip.style.display = 'none';
            document.body.style.cursor = 'default';
        }
    }
    lastX = e.clientX; lastY = e.clientY;
});


canvasEl.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    let fX = factor; let fY = factor;

    if (isShiftDown) {
        if (hoverX) fY = 1.0; 
        else if (hoverY) fX = 1.0; 
    }

    Camera.zoom(fX, fY, mouseX, mouseY);
    drawFrame();
    tooltip.style.display = 'none'; 
}, { passive: false });

// --- TOUCH EVENTS PARA CELULAR ---
let initialPinchDistance = -1;

canvasEl.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Impede scroll natural na tela
    if (e.touches.length === 1) {
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
            drawFrame();
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
            drawFrame();
        }
        return;
    }

    if (e.touches.length === 1 && isDragging) {
        Camera.pan(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        drawFrame();
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
            drawFrame();
        }
    }
}, {passive: false});

canvasEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = -1;
    if (e.touches.length === 0) {
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
            drawFrame();
        } else if (isPanning3D) {
            Camera3D.pan(dx, dy);
            drawFrame();
        }
    });

    canvas3dEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        Camera3D.zoom(factor);
        drawFrame();
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
            drawFrame();
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
            drawFrame();
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
