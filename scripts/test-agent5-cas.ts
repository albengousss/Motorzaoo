import { PrattParser } from '../src/core/prattParser.js';
import { MathEngine } from '../src/core/mathEngine.js';
import { Tokenizer } from '../src/core/tokenizer.js';
import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { chromium } from 'playwright';

console.log('===============================================================');
console.log('🧪 TEST SUITE: AGENT 5 - MOTOR SIMBÓLICO GIAC, TRADUÇÃO & WORKER');
console.log('===============================================================\n');

let passedTests = 0;
let failedTests = 0;
const issues: Array<{ test: string; detail: string; severity: 'CRITICAL' | 'WARNING' | 'INFO' }> = [];

function assert(cond: boolean, name: string, detail?: any, severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'CRITICAL') {
    if (cond) {
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } else {
        console.error(`  ❌ [FAIL] ${name}`);
        if (detail) console.error(`     Detail:`, detail);
        failedTests++;
        issues.push({ test: name, detail: typeof detail === 'object' ? JSON.stringify(detail) : String(detail), severity });
    }
}

// ===============================================================
// 1. TESTES DE AST E formatForGiac DOS COMANDOS SIMBÓLICOS
// ===============================================================
console.log('--- 1. AST & formatForGiac Symbolic Commands ---');

// 1.1 int (indefinite)
try {
    const ast = new PrattParser('int(x^2, x)').parseExpression();
    const isGiac = MathEngine.isGiacCommand(ast);
    const giacStr = MathEngine.formatForGiac(ast);
    assert(isGiac, 'MathEngine.isGiacCommand("int(x^2, x)") should be true');
    assert(giacStr === 'int((x)^(2), x)', 'formatForGiac("int(x^2, x)") output', giacStr);
} catch (e: any) {
    assert(false, 'Parse/format int(x^2, x)', e.message);
}

// 1.2 defint (definite)
try {
    const ast = new PrattParser('int(x^2, x, 0, 1)').parseExpression();
    const isGiac = MathEngine.isGiacCommand(ast);
    const giacStr = MathEngine.formatForGiac(ast);
    assert(isGiac, 'MathEngine.isGiacCommand("int(x^2, x, 0, 1)") should be true');
    assert(giacStr === 'int((x)^(2), x, 0, 1)', 'formatForGiac("int(x^2, x, 0, 1)") output', giacStr);
} catch (e: any) {
    assert(false, 'Parse/format int(x^2, x, 0, 1)', e.message);
}

// 1.3 diff
try {
    const ast = new PrattParser('diff(x^3, x)').parseExpression();
    const isGiac = MathEngine.isGiacCommand(ast);
    const giacStr = MathEngine.formatForGiac(ast);
    assert(isGiac, 'MathEngine.isGiacCommand("diff(x^3, x)") should be true');
    assert(giacStr === 'diff((x)^(3), x)', 'formatForGiac("diff(x^3, x)") output', giacStr);
} catch (e: any) {
    assert(false, 'Parse/format diff(x^3, x)', e.message);
}

// 1.4 d/dx normalization to diff
{
    const norm = FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}(x^3)');
    assert(norm === 'diff(x^3, x)', 'normalizeDerivative("\\frac{d}{dx}(x^3)") -> diff(x^3, x)', norm);

    const normAscii = FaultTolerantParser.normalizeDerivative('d/dx(sin(x))');
    assert(normAscii === 'diff(sin(x), x)', 'normalizeDerivative("d/dx(sin(x))") -> diff(sin(x), x)', normAscii);
}

// 1.5 lim: lim_{x -> 0} (sin(x)/x) vs lim(f(x), x, a)
try {
    // Standard Desmos / LaTeX visual syntax
    const astVisualLim = new PrattParser('\\lim_{x -> 0} (sin(x)/x)').parseExpression();
    const isGiacVisual = MathEngine.isGiacCommand(astVisualLim);
    const giacStrVisual = MathEngine.formatForGiac(astVisualLim);
    assert(isGiacVisual, 'MathEngine.isGiacCommand("\\lim_{x -> 0} ...") should be true');
    assert(giacStrVisual === 'limit((sin(x) / x), x, 0)', 'formatForGiac("\\lim_{x -> 0} ...") output', giacStrVisual);
} catch (e: any) {
    assert(false, 'Parse/format \\lim_{x -> 0} (sin(x)/x)', e.message);
}

// Functional syntax lim(expr, var, target) in PrattParser
try {
    const astFuncLim = new PrattParser('lim(sin(x)/x, x, 0)').parseExpression();
    const giacStrFunc = MathEngine.formatForGiac(astFuncLim);
    assert(giacStrFunc === 'limit((sin(x) / x), x, 0)', 'PrattParser functional lim(expr, var, target)', giacStrFunc);
} catch (e: any) {
    // Note: functional lim is handled via generic CAS match in main.ts, PrattParser expects visual lim_{var -> target} expr
    assert(false, 'PrattParser functional lim(expr, var, target)', e.message, 'WARNING');
}

// 1.6 taylor
try {
    const ast = new PrattParser('taylor(sin(x), x, 0, 4)').parseExpression();
    const isGiac = MathEngine.isGiacCommand(ast);
    const giacStr = MathEngine.formatForGiac(ast);
    assert(isGiac, 'MathEngine.isGiacCommand("taylor(...)") should be true');
    assert(giacStr === 'taylor(sin(x), x=0, 4)' || giacStr === 'taylor(sin(x), x, 0, 4)', 'formatForGiac("taylor(...)") output', giacStr);
} catch (e: any) {
    assert(false, 'Parse/format taylor(...)', e.message);
}

// 1.7 sum
try {
    const ast = new PrattParser('sum(n^2, n, 1, 10)').parseExpression();
    const isGiac = MathEngine.isGiacCommand(ast);
    const giacStr = MathEngine.formatForGiac(ast);
    assert(isGiac, 'MathEngine.isGiacCommand("sum(...)") should be true');
    assert(giacStr === 'sum((n)^(2), n, 1, 10)', 'formatForGiac("sum(...)") output', giacStr);
} catch (e: any) {
    assert(false, 'Parse/format sum(...)', e.message);
}

// 1.8 prod
try {
    const ast = new PrattParser('prod(n, n, 1, 5)').parseExpression();
    const isGiac = MathEngine.isGiacCommand(ast);
    const giacStr = MathEngine.formatForGiac(ast);
    assert(isGiac, 'MathEngine.isGiacCommand("prod(...)") should be true');
    assert(giacStr === 'product(n, n, 1, 5)', 'formatForGiac("prod(...)") maps to product(...)', giacStr);
} catch (e: any) {
    assert(false, 'Parse/format prod(...)', e.message);
}

// 1.9 edo & solveode
try {
    const astEdo = new PrattParser('edo(diff(y, x) - y, y)').parseExpression();
    const isGiacEdo = MathEngine.isGiacCommand(astEdo);
    const giacStrEdo = MathEngine.formatForGiac(astEdo);
    assert(isGiacEdo, 'MathEngine.isGiacCommand("edo(...)") should be true');
    assert(giacStrEdo.startsWith('desolve('), 'formatForGiac("edo(...)") maps to desolve(...)', giacStrEdo);

    const astSolveOde = new PrattParser('solveode(diff(y, x) - y, y)').parseExpression();
    const isGiacSolveOde = MathEngine.isGiacCommand(astSolveOde);
    const giacStrSolveOde = MathEngine.formatForGiac(astSolveOde);
    assert(isGiacSolveOde, 'MathEngine.isGiacCommand("solveode(...)") should be true');
    assert(giacStrSolveOde.startsWith('desolve('), 'formatForGiac("solveode(...)") maps to desolve(...)', giacStrSolveOde);
} catch (e: any) {
    assert(false, 'Parse/format edo/solveode', e.message);
}

// 1.10 laplace
{
    const isLaplaceInList = MathEngine.GIAC_COMMANDS.includes('laplace');
    assert(isLaplaceInList, 'MathEngine.GIAC_COMMANDS includes "laplace"', { isLaplaceInList }, 'WARNING');

    try {
        const ast = new PrattParser('laplace(sin(t), t, s)').parseExpression();
        const isGiac = MathEngine.isGiacCommand(ast);
        const giacStr = MathEngine.formatForGiac(ast);
        assert(isGiac, 'MathEngine.isGiacCommand("laplace(...)") should be true', { isGiac, ast }, 'WARNING');
        assert(giacStr === 'laplace(sin(t), t, s)', 'formatForGiac("laplace(...)") output', giacStr, 'WARNING');
    } catch (e: any) {
        assert(false, 'PrattParser handles "laplace(sin(t), t, s)"', e?.message, 'WARNING');
    }
}

// ===============================================================
// 2. CASOS DE BORDA: INTEGRAIS IMPRÓPRIAS, LIMITES NO INFINITO, DIFERENCIAIS COLADOS
// ===============================================================
console.log('\n--- 2. Edge Cases: Improper Integrals, Infinity, Glued Differentials ---');

// 2.1 Diferenciais colados: xdx, \int sin(x)dx, \int x^2dx
{
    const tok1 = new Tokenizer();
    tok1.init('x dx');
    const tokens1 = tok1.tokenize();
    assert(tokens1.some(t => t.type === 'd'), 'Tokenizer detects spaced differential "x dx"');

    const tok2 = new Tokenizer();
    tok2.init('xdx');
    const tokens2 = tok2.tokenize();
    assert(tokens2.some(t => t.type === 'd'), 'Tokenizer parses glued differential "xdx" as variable + d x', tokens2);

    const tok3 = new Tokenizer();
    tok3.init('\\int sin(x)dx');
    const tokens3 = tok3.tokenize();
    assert(tokens3.some(t => t.type === 'd'), 'Tokenizer parses "\\int sin(x)dx" with differential', tokens3);

    try {
        const astInt = new PrattParser('\\int x dx').parseExpression();
        assert(Array.isArray(astInt) && astInt[0] === 'Integrate' && astInt[2] === 'x', 'PrattParser parses "\\int x dx"', astInt);
    } catch (e: any) {
        assert(false, 'PrattParser parses "\\int x dx"', e?.message);
    }

    try {
        const astIntSin = new PrattParser('\\int sin(x) dx').parseExpression();
        assert(Array.isArray(astIntSin) && astIntSin[0] === 'Integrate' && astIntSin[1][0] === 'Sin', 'PrattParser parses "\\int sin(x) dx"', astIntSin);
    } catch (e: any) {
        assert(false, 'PrattParser parses "\\int sin(x) dx"', e?.message);
    }
}

// 2.2 Limites no infinito e Integrais Impróprias na Gramática / AST
{
    try {
        const astLimInf = new PrattParser('\\lim_{x -> inf} (1/x)').parseExpression();
        const giacLimInf = MathEngine.formatForGiac(astLimInf);
        assert(giacLimInf.includes('limit(') && giacLimInf.includes('inf'), 'PrattParser + formatForGiac handles \\lim_{x -> inf} (1/x)', giacLimInf);
    } catch (e: any) {
        assert(false, 'PrattParser parses "\\lim_{x -> inf} (1/x)"', e?.message);
    }

    try {
        const astLimInfinity = new PrattParser('\\lim_{x -> infinity} (1/x)').parseExpression();
        const giacLimInfinity = MathEngine.formatForGiac(astLimInfinity);
        assert(giacLimInfinity.includes('limit(') && giacLimInfinity.includes('infinity'), 'PrattParser + formatForGiac handles \\lim_{x -> infinity} (1/x)', giacLimInfinity);
    } catch (e: any) {
        assert(false, 'PrattParser parses "\\lim_{x -> infinity} (1/x)"', e?.message);
    }

    // Improper integral \int_0^\infty e^(-x) dx via functional format
    try {
        const astImpInt = new PrattParser('int(exp(-x), x, 0, inf)').parseExpression();
        const giacImpInt = MathEngine.formatForGiac(astImpInt);
        assert(giacImpInt === 'int(exp((-x)), x, 0, inf)', 'formatForGiac formats improper integral "int(exp(-x), x, 0, inf)"', giacImpInt);
    } catch (e: any) {
        assert(false, 'PrattParser parses "int(exp(-x), x, 0, inf)"', e?.message);
    }

    // Improper integral in LaTeX visual form \int_0^\infty e^(-x) dx
    const boundPattern = '(?:\\{([^}]+)\\}|\\(([^)]+)\\)|(-?[0-9.]+|\\\\[a-zA-Z]+|[a-zA-Z_][a-zA-Z0-9_]*))';
    const innermostDefIntRegex = new RegExp(
        `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*(?:_\\s*${boundPattern}\\s*\\^\\s*${boundPattern}|\\^\\s*${boundPattern}\\s*_\\s*${boundPattern})\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
        'i'
    );
    const testVisualImp = '\\int_{0}^{\\infty} e^{-x} dx';
    const matchVisualImp = testVisualImp.match(innermostDefIntRegex);
    assert(!!matchVisualImp, 'main.ts innermostDefIntRegex matches visual improper integral "\\int_{0}^{\\infty} e^{-x} dx"', { match: matchVisualImp });
}

// 2.3 Supressão defensiva de artefatos pnt / point[] / 536870912
{
    const pntArtifacts = [
        'pnt(1,2)',
        'point[1, 2]',
        'pnt[3, 4]',
        'point(0,0)',
        '536870912',
        'Erro: undef',
        'Bad Argument Value'
    ];

    const testRejection = (res: string) => {
        return res.includes('Erro') || res.includes('undef') || res.includes('Bad Argument') || res.includes('pnt') || res.includes('point[') || res.includes('point(') || res.includes('536870912');
    };

    for (const artifact of pntArtifacts) {
        assert(testRejection(artifact), `Artifact suppression catches "${artifact}"`);
    }

    const cleanValidResults = [
        'x^3/3',
        '[[1, 0], [0, 1]]',
        '3.14159',
        '-cos(x)',
        'exp(-x)'
    ];

    for (const valid of cleanValidResults) {
        assert(!testRejection(valid), `Artifact suppression does not false-positive on valid result "${valid}"`);
    }
}

// ===============================================================
// 3. EXECUÇÃO NO NAVEGADOR VIA PLAYWRIGHT COM MOTOR REAL GIAC WASM
// ===============================================================
console.log('\n--- 3. Browser Giac Real Engine Execution & Concurrency ---');

async function runBrowserTests() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:4173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for wasm

    // Test 3.1: Direct execution of symbolic commands in real Giac WASM
    const casCommandsToTest = [
        { name: 'int (indefinite)', query: 'integrate(x^2, x)', expected: 'x^3/3' },
        { name: 'defint (definite)', query: 'integrate(x^2, x, 0, 1)', expected: '1/3' },
        { name: 'diff', query: 'diff(x^3, x)', expected: '3*x^2' },
        { name: 'lim at 0', query: 'limit(sin(x)/x, x, 0)', expected: '1' },
        { name: 'lim at infinity', query: 'limit(1/x, x, inf)', expected: '0' },
        { name: 'improper integral', query: 'integrate(exp(-x), x, 0, inf)', expected: '1' },
        { name: 'taylor', query: 'convert(taylor(sin(x), x=0, 3), polynom)', expected: 'x-1/6*x^3' },
        { name: 'sum', query: 'sum(n, n, 1, 10)', expected: '55' },
        { name: 'product', query: 'product(n, n, 1, 5)', expected: '120' },
        { name: 'edo / desolve', query: "desolve(y'=y, y)", expectedContains: 'exp(x)' },
        { name: 'solveode with initial condition', query: "desolve([y'=y, y(0)=2], y)", expected: '2*exp(x)' },
        { name: 'laplace', query: 'laplace(sin(t), t, s)', expected: '1/(s^2+1)' }
    ];

    console.log('  Testing Symbolic Evaluations on real Giac WASM...');
    for (const testCase of casCommandsToTest) {
        const result: string = await page.evaluate(async (q: string) => {
            return (window as any).MathEngine.askGiac(q);
        }, testCase.query);

        const cleanRes = result.replace(/"/g, '').replace(/\s+/g, '').split('=')[0];
        if (testCase.expected) {
            const expClean = testCase.expected.replace(/\s+/g, '');
            assert(cleanRes === expClean, `Giac evaluated ${testCase.name} (${testCase.query}) -> ${cleanRes}`, { expected: expClean, received: cleanRes });
        } else if (testCase.expectedContains) {
            const expContainsClean = testCase.expectedContains.replace(/\s+/g, '');
            assert(cleanRes.includes(expContainsClean), `Giac evaluated ${testCase.name} contains "${expContainsClean}" -> ${cleanRes}`, { received: cleanRes });
        }
    }

    // Test 3.2: Stale Query Cancellation & Rapid Typing Simulation
    console.log('\n  Simulating Rapid Typing & Asynchronous Stale Query Cancellation...');
    const rapidTypingResult = await page.evaluate(async () => {
        const win = window as any;
        const state = win.StateManager;
        const blockId = 'test_rapid_typing_block';

        const queries = [
            'integrate(x, x)',
            'integrate(x^2, x)',
            'integrate(x^3, x)',
            'integrate(x^4, x)',
            'integrate(x^5, x)'
        ];

        let finalCommittedResult = '';
        const promises: Promise<any>[] = [];

        for (const q of queries) {
            // Update active query synchronously as user types
            state.activeGiacQuery[blockId] = q;
            const currentQ = q;

            // Fire async query
            const p = win.MathEngine.askGiac(currentQ).then((res: string) => {
                // Check stale query cancellation logic (same as main.ts line 774 and 1103)
                if (state.activeGiacQuery[blockId] !== currentQ) {
                    // Stale query! Discarded!
                    return { query: currentQ, discarded: true };
                }
                finalCommittedResult = res;
                return { query: currentQ, discarded: false, result: res };
            });
            promises.push(p);
        }

        const resolved = await Promise.all(promises);
        return {
            finalCommittedResult,
            activeQuery: state.activeGiacQuery[blockId],
            resolved
        };
    });

    const discardedCount = rapidTypingResult.resolved.filter((r: any) => r.discarded).length;
    const keptCount = rapidTypingResult.resolved.filter((r: any) => !r.discarded).length;
    assert(keptCount === 1, `Rapid typing kept exactly 1 final result (kept: ${keptCount}, discarded: ${discardedCount})`);
    assert(rapidTypingResult.finalCommittedResult.includes('x^6/6'), `Committed result corresponds to last query "integrate(x^5, x)" -> ${rapidTypingResult.finalCommittedResult}`);

    // Test 3.3: Web Worker vs Main Thread Giac
    console.log('\n  Testing Web Worker state vs Main Thread...');
    const workerStatus = await page.evaluate(() => {
        const win = window as any;
        return {
            isGiacReady: win.MathEngine.isGiacReady,
            hasMainModule: !!(win.Module && (typeof win.Module.cwrap === 'function' || typeof win.Module._caseval === 'function')),
            hasWorker: !!win.MathEngine.giacWorker
        };
    });
    console.log('  Worker/Module status:', workerStatus);

    await browser.close();

    console.log('\n===============================================================');
    console.log(`📊 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('===============================================================');

    if (issues.length > 0) {
        console.log('\n⚠️ DETECTED ISSUES & GAPS:');
        for (const issue of issues) {
            console.log(`[${issue.severity}] ${issue.test}: ${issue.detail}`);
        }
    }
}

runBrowserTests().catch(err => {
    console.error('Test Suite Failed with fatal error:', err);
    process.exit(1);
});
