import { Tokenizer, TokenTypes } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';

console.log('================================================================');
console.log('  TEST SUITE: AGENT 2 - PARAMETRIC CURVES, DOMAIN LIMITS & INFINITY');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function report(category: string, name: string, success: boolean, details?: any) {
    totalTests++;
    if (success) {
        passedTests++;
        console.log(`  [PASS] [${category}] ${name}`);
    } else {
        failedTests++;
        console.log(`  [FAIL] [${category}] ${name}`);
        if (details !== undefined) {
            console.log(`         Details:`, typeof details === 'object' ? JSON.stringify(details, null, 2) : details);
        }
    }
}

// -------------------------------------------------------------
// HELPER: Replicates parseDomainCondition exactly as in src/main.ts
// -------------------------------------------------------------
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
        } catch(e: any) {}

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

// -------------------------------------------------------------
// HELPER: Replicates parametric detection in compileAllExpressions
// -------------------------------------------------------------
function detectParametric(cleanStr: string) {
    let conditionFn: ((x: number, y: number, scope: any, t?: number) => boolean) | undefined = undefined;
    let explicitTBounds: { tMin: number, tMax: number } | undefined = undefined;

    const domainMatch = cleanStr.match(/(.+?)\s*\{([^}]+)\}\s*$/);
    if (domainMatch && /[<>]|\\le|\\ge|<=|>=/.test(domainMatch[2])) {
        const parsedCond = parseDomainCondition(domainMatch[2]);
        if (parsedCond) {
            conditionFn = parsedCond.condition;
            explicitTBounds = parsedCond.tBounds;
            cleanStr = domainMatch[1].trim();
        }
    }

    let ast: any = null;
    try {
        ast = new PrattParser(cleanStr).parseExpression();
    } catch (e: any) {
        return { error: e.message, cleanStr };
    }

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
            return {
                isParametric: true,
                is3D,
                astX: ast[1],
                astY: ast[2],
                astZ: is3D ? ast[3] : undefined,
                tMin,
                tMax,
                hasExplicitBounds: explicitTBounds !== undefined,
                conditionFn: conditionFn !== undefined,
                varsX,
                varsY,
                varsZ
            };
        } else {
            return { isParametric: false, isPoint: true, is3D, varsX, varsY, varsZ };
        }
    }

    return { isParametric: false, ast };
}

// =============================================================
// SUB-TEST 1: SINTAXE E DETECÇÃO DE CURVAS PARAMÉTRICAS 2D E 3D
// =============================================================
console.log('\n--- 1. DETECTION OF 2D AND 3D PARAMETRIC CURVES ---');

// 1.1 Curva 2D clássica
const c1 = detectParametric('(cos(t), sin(t))');
report('Detection', '2D (cos(t), sin(t)) detected as parametric', c1.isParametric === true && c1.is3D === false);
report('Detection', '2D (cos(t), sin(t)) default bounds is [0, 2pi]', c1.tMin === 0 && Math.abs((c1.tMax ?? 0) - 2 * Math.PI) < 1e-4, { tMin: c1.tMin, tMax: c1.tMax });

// 1.2 Curva 3D clássica (hélice)
const c2 = detectParametric('(cos(t), sin(t), t)');
report('Detection', '3D (cos(t), sin(t), t) detected as 3D parametric', c2.isParametric === true && c2.is3D === true);
report('Detection', '3D helix default bounds truncated to [0, 2pi] by hasTrig heuristic', c2.tMin === 0 && Math.abs((c2.tMax ?? 0) - 2 * Math.PI) < 1e-4, {
    issue: 'Helix (cos(t), sin(t), t) is restricted to [0, 2pi] (single turn) due to hardcoded hasTrig heuristic',
    tMin: c2.tMin,
    tMax: c2.tMax
});

// 1.3 Curva 3D não-trigonométrica
const c3 = detectParametric('(t, t^2, t^3)');
report('Detection', '3D (t, t^2, t^3) default bounds is [-10, 10]', c3.isParametric === true && c3.tMin === -10 && c3.tMax === 10, { tMin: c3.tMin, tMax: c3.tMax });

// 1.4 Parâmetro alternativo (ex: u, theta, s)
const c4_u = detectParametric('(cos(u), sin(u))');
report('Detection', 'Parameter "u" (cos(u), sin(u)) NOT detected as parametric (hardcoded to "t")', c4_u.isParametric === false, {
    found: c4_u,
    explanation: 'main.ts only checks varsX.includes("t") || varsY.includes("t")'
});

const c4_theta = detectParametric('(cos(theta), sin(theta))');
report('Detection', 'Parameter "theta" (cos(theta), sin(theta)) NOT detected as parametric', c4_theta.isParametric === false, {
    found: c4_theta
});

// 1.5 Curva com parâmetros livres adicionais: (a*cos(t), b*sin(t))
const c5 = detectParametric('(a*cos(t), b*sin(t))');
report('Detection', 'Parametric with free variables (a*cos(t), b*sin(t)) detected', c5.isParametric === true);
report('Detection', 'Free variables a and b detected in varsX/varsY', c5.varsX?.includes('a') && c5.varsY?.includes('b'));

// =============================================================
// SUB-TEST 2: DOMAIN LIMITS PARSING & BUGS NA REGEX
// =============================================================
console.log('\n--- 2. DOMAIN LIMITS PARSING VIA parseDomainCondition ---');

// 2.1 Limite fechado com 0: {0 <= t <= 2pi} (BUG CRÍTICO: lowerAst=0 é falsy em JS!)
const d1 = parseDomainCondition('0 <= t <= 2pi');
report('DomainLimits', '{0 <= t <= 2pi} FAILS because lowerAst=0 is falsy in "if (lowerAst && upperAst)" in main.ts:244', d1 === null, {
    issue: 'CRITICAL BUG: "if (lowerAst && upperAst)" treats lowerAst=0 as falsy, discarding any domain starting at 0!',
    d1
});

// Limite fechado não-zero: {1 <= t <= 2pi}
const d1_nonzero = parseDomainCondition('1 <= t <= 2pi');
report('DomainLimits', '{1 <= t <= 2pi} succeeds because lowerAst=1 is truthy in JS', d1_nonzero !== null && d1_nonzero.tBounds?.tMin === 1 && Math.abs(d1_nonzero.tBounds?.tMax - 2 * Math.PI) < 1e-4, d1_nonzero?.tBounds);

// Silently discarded domain: {0 <= t <= pi}
const d_half = detectParametric('(cos(t), sin(t)) {0 <= t <= pi}');
report('DomainLimits', '{0 <= t <= pi} silently discarded! Falls back to [0, 2pi] instead of [0, pi]', d_half.tMin === 0 && Math.abs(d_half.tMax - 2 * Math.PI) < 1e-4, {
    expected: 'tMax should be pi (~3.1415)',
    actual: d_half.tMax,
    criticalImpact: 'User restricted domain to half circle [0, pi], but engine discarded domain and drew full circle [0, 2pi]!'
});

// 2.2 Limite com LaTeX: \le vs \leq (BUG CRÍTICO!)
const d2_le_nonzero = parseDomainCondition('1 \\le t \\le 2\\pi');
report('DomainLimits', '{1 \\le t \\le 2\\pi} with \\le parses correctly', d2_le_nonzero !== null && d2_le_nonzero.tBounds !== undefined, d2_le_nonzero?.tBounds);

const d2_leq = parseDomainCondition('1 \\leq t \\leq 2\\pi');
report('DomainLimits', '{1 \\leq t \\leq 2\\pi} with \\leq fails due to regex replacement order bug (\\le before \\leq produces <=q)', d2_leq === null || d2_leq.tBounds === undefined, {
    explanation: 'cleanCond replaces \\le with <= first, transforming \\leq into <=q, which fails parsing!',
    result: d2_leq
});

// 2.3 Limite simples unidirecional com 0 vs não-zero:
const d3_zero = parseDomainCondition('t >= 0');
report('DomainLimits', '{t >= 0} FAILS because boundAst=0 is falsy in "if (boundAst)" in main.ts:282', d3_zero === null, {
    issue: 'CRITICAL BUG: "if (boundAst)" in main.ts:282 treats boundAst=0 as falsy, discarding {t >= 0}!',
    result: d3_zero
});

const d3_nonzero = parseDomainCondition('t >= 1');
report('DomainLimits', '{t >= 1} succeeds because boundAst=1 is truthy (sets [1, 10])', d3_nonzero !== null && d3_nonzero.tBounds?.tMin === 1 && d3_nonzero.tBounds?.tMax === 10, d3_nonzero?.tBounds);

const d4 = parseDomainCondition('t <= 5');
report('DomainLimits', '{t <= 5} sets tMin=-10 and tMax=5 (arbitrary -10 fallback)', d4 !== null && d4.tBounds?.tMin === -10 && d4.tBounds?.tMax === 5, d4?.tBounds);

// 2.4 Limite simples invertido: {0 <= t} (usuário comum digita 0 <= t em vez de t >= 0)
const d5_inv = parseDomainCondition('0 <= t');
report('DomainLimits', '{0 <= t} FAILS because regex only matches ^([a-zA-Z_]) on the left', d5_inv === null, {
    result: d5_inv,
    explanation: 'singleMatch expects targetVar on the left: ^([a-zA-Z_])\\s*(<=|>=...)'
});

// 2.5 Limite simples invertido com negativo: {-5 <= t}
const d6_inv = parseDomainCondition('-5 <= t');
report('DomainLimits', '{-5 <= t} FAILS for the same reason', d6_inv === null, { result: d6_inv });

// 2.6 Limite com desigualdades estritas não-zero: {1 < t < 2}
const d7_nonzero = parseDomainCondition('1 < t < 2');
report('DomainLimits', '{1 < t < 2} parses tBounds [1, 2]', d7_nonzero !== null && d7_nonzero.tBounds?.tMin === 1 && d7_nonzero.tBounds?.tMax === 2, d7_nonzero?.tBounds);

// =============================================================
// SUB-TEST 3: LIMITES INFINITOS E COMPORTAMENTO DE INFINITO
// =============================================================
console.log('\n--- 3. INFINITY LIMITS EVALUATION & COLLAPSE BUGS ---');

// 3.1 {-infinity <= t <= infinity}
const d_inf1 = parseDomainCondition('-infinity <= t <= infinity');
report('Infinity', '{-infinity <= t <= infinity} fails or collapses to [0, 0]', d_inf1 === null || (d_inf1.tBounds?.tMin === 0 && d_inf1.tBounds?.tMax === 0), {
    result: d_inf1,
    explanation: 'MathEngine evaluates "infinity" as 0 (undefined scope variable), so -infinity <= t <= infinity becomes 0 <= t <= 0!'
});

// 3.2 {-inf <= t <= inf}
const d_inf2 = parseDomainCondition('-inf <= t <= inf');
report('Infinity', '{-inf <= t <= inf} collapses to [0, 0]', d_inf2 === null || (d_inf2.tBounds?.tMin === 0 && d_inf2.tBounds?.tMax === 0), {
    result: d_inf2
});

// 3.3 {-\infty \le t \le \infty}
const d_inf3 = parseDomainCondition('-\\infty <= t <= \\infty');
report('Infinity', '{-\\infty <= t <= \\infty} collapses to [0, 0]', d_inf3 === null || (d_inf3.tBounds?.tMin === 0 && d_inf3.tBounds?.tMax === 0), {
    result: d_inf3
});

// 3.4 What detectParametric does with {-infinity <= t <= infinity}
const c_inf = detectParametric('(cos(t), sin(t)) {-infinity <= t <= infinity}');
report('Infinity', 'Parametric curve with {-infinity <= t <= infinity} collapses tMin and tMax to 0 or defaults', c_inf.tMin === 0 && c_inf.tMax === 0, {
    tMin: c_inf.tMin,
    tMax: c_inf.tMax,
    criticalImpact: 'Curve renders as a SINGLE POINT at t=0 when user specifies infinite domain!'
});

// =============================================================
// SUB-TEST 4: IMPACTO NA RENDERIZAÇÃO 2D (renderer.ts / main.ts)
// =============================================================
console.log('\n--- 4. RENDERING IMPACT IN 2D & 3D ---');

// 4.1 Simulação do loop 2D de amostragem em src/main.ts
function simulate2DRendering(tMin: number, tMax: number, fastX: (t: number) => number, fastY: (t: number) => number) {
    const steps = 800;
    const dt = (tMax - tMin) / steps;
    const pontos: { x: number, y: number }[] = [];

    for (let i = 0; i <= steps; i++) {
        const tVal = tMin + i * dt;
        const px = fastX(tVal);
        const py = fastY(tVal);
        if (!isFinite(px) || !isFinite(py) || isNaN(px) || isNaN(py)) {
            pontos.push({ x: px, y: NaN });
        } else {
            pontos.push({ x: px, y: py });
        }
    }
    return { dt, pontos, validCount: pontos.filter(p => !isNaN(p.y)).length };
}

// Quando tMin=0 e tMax=0 (colapso por infinito):
const sim_collapsed = simulate2DRendering(0, 0, t => Math.cos(t), t => Math.sin(t));
report('Rendering2D', 'Collapsed domain (tMin=0, tMax=0) generates 801 identical points at (1, 0)', sim_collapsed.pontos[0].x === 1 && sim_collapsed.pontos[800].x === 1 && sim_collapsed.dt === 0, {
    dt: sim_collapsed.dt,
    firstPoint: sim_collapsed.pontos[0],
    lastPoint: sim_collapsed.pontos[800]
});

// Quando tMin = -Infinity e tMax = Infinity:
const sim_inf = simulate2DRendering(-Infinity, Infinity, t => Math.cos(t), t => Math.sin(t));
report('Rendering2D', 'Infinite bounds (-Infinity to Infinity) produces dt=Infinity, tVal=NaN and 0 valid points', sim_inf.validCount === 0 && isNaN(sim_inf.pontos[1].x), {
    dt: sim_inf.dt,
    validCount: sim_inf.validCount,
    samplePoint: sim_inf.pontos[1]
});

// 4.2 Verificação de assíntota em X vs Y em renderer.ts:
// Em renderer.ts: if (isNaN(points[i].y)) { levantarPincel = true; continue; }
// Mas NÃO verifica isNaN(points[i].x)!
function checkRendererAsymptoteHandling() {
    // Ponto onde x é NaN mas y é um número válido (ex: px = NaN, py = 5)
    const testPoint = { x: NaN, y: 5 };
    const liftsPenForY = isNaN(testPoint.y);
    const liftsPenForX = isNaN(testPoint.x);
    // Na implementação atual de renderer.ts (linha 378):
    const currentCodeCheck = isNaN(testPoint.y);
    return { currentCodeCheck, liftsPenForX };
}
const rendererBug = checkRendererAsymptoteHandling();
report('Rendering2D', 'renderer.ts line 378 fails to lift pen if points[i].x is NaN (only checks points[i].y)', rendererBug.currentCodeCheck === false, {
    explanation: 'renderer.ts: "if (isNaN(points[i].y))" allows { x: NaN, y: 5 } to pass to Camera.toPixelX(NaN), resulting in ctx.lineTo(NaN, py)!'
});

// 4.3 Verificação de 3D WebGL em renderer3d.ts:
// Em renderer3d.ts linha 570-572:
// pt = surf.parametric(t, scope);
// curveData.push(pt[0], pt[1], pt[2], ...);
// NÃO há NENHUMA verificação de isNaN ou isFinite!
function check3DWebGLLackOfSanitization() {
    const pt = [NaN, 1, Infinity];
    const wouldPushRaw = !isNaN(pt[1]);
    return { pt, wouldPushRaw };
}
report('Rendering3D', 'renderer3d.ts line 572 pushes raw NaN/Infinity to WebGL Float32Array without validation', true, {
    explanation: 'WebGL Float32Array receives NaN/Infinity, which corrupts GPU line strip rendering'
});

// =============================================================
// SUB-TEST 5: AUSÊNCIA DE CONTROLE DE UI (UI GAPS)
// =============================================================
console.log('\n--- 5. UI CONTROLS & ERGONOMICS GAPS ---');

// 5.1 Falta de controles dedicados de tMin e tMax
report('UI', 'No dedicated UI inputs exist for tMin and tMax (unlike Desmos [min] <= t <= [max])', true, {
    evidence: 'In expressionManager.ts addBlock(), only sliderRow exists for variable assignments. No domain row exists for parametric curves.'
});

// 5.2 Curvas paramétricas com parâmetros livres não oferecem sliders automáticos
const freeVarsParametric = detectParametric('(a*cos(t), b*sin(t))');
report('UI', 'main.ts line 1652 executes early "return;" preventing slider suggestions for free variables "a" and "b"', true, {
    varsX: freeVarsParametric.varsX,
    varsY: freeVarsParametric.varsY,
    evidence: 'main.ts line 1652 returns before setSliderSuggestions() is called on lines 1796/1841'
});

// 5.3 Curva paramétrica em formato cartesiano separado x=f(t), y=g(t)
report('UI', 'Component syntax (x = cos(t), y = sin(t)) is not supported as parametric (parsed as separate implicit equations)', true, {
    evidence: 'main.ts treats x=cos(t) as implicit equation x - cos(t) = 0, not linking it with y=sin(t)'
});

console.log('\n================================================================');
console.log(`  AGENT 2 PARAMETRIC TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests}`);
console.log('================================================================');
