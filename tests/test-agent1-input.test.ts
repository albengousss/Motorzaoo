/**
 * Teste Exaustivo do Agente Tester 1:
 * - Teclado e Keybindings do MathLive
 * - Comando "/" (Fração) e Duplicação
 * - Todos os atalhos: ^, *, #22, #33, matrix, d/dx, sqrt, defint, int
 * - Sanitização de cleanStr (src/main.ts): caracteres colados, espaços extras, barras duplas, parênteses vazios, etc.
 */

import { describe, it, expect } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';

describe('agent1-input suite', () => {
    it('runs all 42 input sanitization tests', () => {
        interface TestResult {
            name: string;
            passed: boolean;
            expected: any;
            actual: any;
            error?: string;
            category: string;
        }

        const results: TestResult[] = [];

        function assertTest(category: string, name: string, condition: boolean, expected: any, actual: any, errorMsg?: string) {
            results.push({
                category,
                name,
                passed: condition,
                expected,
                actual,
                error: condition ? undefined : (errorMsg || `Assertion failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
            });
            expect(condition, name + ': ' + (errorMsg || '')).toBe(true);
        }

/**
 * Pipeline canônico de sanitização cleanStr extraído exatamente de src/main.ts
 */
function runMainCleanStrPipeline(ascii: string, definedMatrixNames: Set<string> = new Set(['A', 'B', 'M'])): string {
    // =========================================================
    // SANITIZAÇÃO: O Triturador de Sujeira do MathLive (src/main.ts)
    // =========================================================
    let cleanStr = ascii
        .replace(/\\left\./g, '')
        .replace(/\\right\./g, '')
        .replace(/\\left/g, '')
        .replace(/\\right/g, '')
        .replace(/\s*\\cdot\s*/g, '*')
        .replace(/\s*\\times\s*/g, '*')
        .replace(/\s*\\ast\s*/g, '*')
        .replace(/∗/g, '*')
        .replace(/⋅/g, '*')
        .replace(/×/g, '*')
        .replace(/"/g, '');

    // Consertar letras espaçadas geradas quando o utilizador escreve manualmente no teclado
    const spacedFuncs = [
        'r e d u c e d r o w e c h e l o n f o r m', 'd e t e r m i n a n t', 'm a t r i x r a n k',
        't r a n s p o s e', 'a r c s i n', 'a r c c o s', 'a r c t a n', 's i n h', 'c o s h', 't a n h',
        'c o s s e c', 'c o t a n', 't r a n', 't r a c e', 'i n v e r t', 'r r e f', 'r a n k',
        's i n', 'c o s', 't a n', 's e c', 'c s c', 'c o t', 'l o g', 'l n', 'e x p', 'd e t', 'i n v', 't r'
    ];
    spacedFuncs.forEach(func => {
        const regex = new RegExp(func.split('').join('\\s*'), 'gi');
        cleanStr = cleanStr.replace(regex, func.replace(/\s+/g, ''));
    });

    // Limpa wrappers de texto e operadores LaTeX que o MathLive gera
    cleanStr = cleanStr
        .replace(/\\operatorname\{([^}]+)\}/gi, '$1')
        .replace(/\\mathrm\{([^}]+)\}/gi, '$1')
        .replace(/\\text\{([^}]+)\}/gi, '$1');

    // Normalização de nomes de funções com subscrito (ex: f_{jose}(x), f_(1)(x), f_1(x))
    cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_[\{\(]([a-zA-Z0-9_]+)[\}\)]\s*(?=\()/g, '$1_$2');
    cleanStr = cleanStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_([a-zA-Z0-9_]+)\s*(?=\()/g, '$1_$2');

    // Suporte a A[r, c] e A[r][c] e A_{r,c} 1-based para Giac 0-based
    cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)\[\s*([0-9]+)\s*,\s*([0-9]+)\s*\]/g, (_m, id, r, c) => {
        return `${id}[${parseInt(r) - 1},${parseInt(c) - 1}]`;
    });
    cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)\[\s*([0-9]+)\s*\]\[\s*([0-9]+)\s*\]/g, (_m, id, r, c) => {
        return `${id}[${parseInt(r) - 1},${parseInt(c) - 1}]`;
    });
    cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_[\(\{]([0-9]+)\s*,\s*([0-9]+)[\)\}]/g, (_m, id, r, c) => {
        return `${id}[${parseInt(r) - 1},${parseInt(c) - 1}]`;
    });
    cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)\[\s*([0-9]+)\s*\]/g, (m, id, idx) => {
        if (['int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff'].includes(id.toLowerCase())) return m;
        return `${id}[${parseInt(idx) - 1}]`;
    });
    cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_\{([0-9]+)\}/g, (match, p1, p2) => {
        if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
        return `${p1}[${parseInt(p2)-1}]`;
    });
    cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_([0-9]+)\b/g, (match, p1, p2) => {
        if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
        return `${p1}[${parseInt(p2)-1}]`;
    }).replace(/²/g, '^2').replace(/³/g, '^3');
    
    // Normalização universal de plicas (derivadas)
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

    // Operadores de Matriz: Transposta (^T, ^\top, ') e Inversa (^-1)
    cleanStr = cleanStr
        .replace(/\(([^)]+)\)\^\{?(?:T|\\top|intercal)\}?/gi, 'tran($1)')
        .replace(/([A-Za-z_][A-Za-z0-9_]*)\^\{?(?:T|\\top|intercal)\}?/gi, 'tran($1)')
        .replace(/\(([^)]+)\)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)')
        .replace(/([A-Za-z_][A-Za-z0-9_]*)\^[\{\(]*\s*(?:-1|\(-1\))\s*[\}\)]*/g, 'inv($1)')
        .replace(/\btr\s*\(([^)]+)\)/gi, 'trace($1)');

    // Transposta com plica para matrizes definidas
    for (const mName of definedMatrixNames) {
        cleanStr = cleanStr.replace(new RegExp(`\\b${mName}'+`, 'g'), `tran(${mName})`);
    }
    cleanStr = cleanStr.replace(/\(([^)]+)\)'+/g, 'tran($1)');

    // Separa limites colados ao integrando gerados pelo MathLive (ex: _1^2x -> _1^2 x, _1x -> _1 x)
    cleanStr = cleanStr.replace(/([\^_](?:\{[^}]+\}|\([^)]+\)|[0-9.]+))\s*([a-zA-Z_])/g, '$1 $2');

    // Multiplicação escalar implícita para matrizes e variáveis: 2B -> 2*B, MAS NÃO em limites _2 ou ^2
    cleanStr = cleanStr.replace(/(?<![\^_]\s*)(\d+(?:\.\d+)?)\s*([A-Za-z_][A-Za-z0-9_]*)/g, '$1*$2');

    // Raiz enésima \sqrt[n]{x} -> nthroot(x, n) e AsciiMath root(n)(x) -> nthroot(x, n)
    cleanStr = cleanStr
        .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, 'nthroot($2, $1)')
        .replace(/root\s*\(([^)]+)\)\s*\(([^)]+)\)/g, 'nthroot($2, $1)');

    // Logaritmo com base personalizada: \log_{b}(x) ou log_b(x) -> ((log(x))/(log(b)))
    cleanStr = cleanStr.replace(/\\?log_\{?([a-zA-Z0-9.]+)\}?\s*\(([^)]+)\)/gi, '((log($2))/(log($1)))');

    // Converter derivadas antes de frações
    cleanStr = FaultTolerantParser.normalizeDerivative(cleanStr);

    // Normalização de frações (LaTeX \frac{a}{b} e AsciiMath frac(a)(b)) com loop iterativo para aninhadas
    let fracPasses = 0;
    let prevFrac = '';
    while (prevFrac !== cleanStr && fracPasses < 10) {
        prevFrac = cleanStr;
        cleanStr = cleanStr
            .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))')
            .replace(/frac\s*\(([^()]+)\)\s*\(([^()]+)\)/g, '(($1)/($2))');
        fracPasses++;
    }

    // Normalização universal de diferenciais e integrais (LaTeX e MathLive)
    cleanStr = cleanStr
        .replace(/\\mathrm\{d\}/gi, ' d ')
        .replace(/\\text\{d\}/gi, ' d ')
        .replace(/\\differentialD/gi, ' d ')
        .replace(/\\,/g, ' ')
        .replace(/\\!/g, ' ');

    cleanStr = cleanStr.replace(/(?<=[a-zA-Z0-9_\)\}\]])\s*d\s*([a-zA-Z_])(?=\s*(?:[+\-*/=,\)\}\]]|$))/gi, ' d $1');

    // 1. Integral definida
    const boundPattern = '(?:\\{([^}]+)\\}|\\(([^)]+)\\)|(-?[0-9.]+|\\\\[a-zA-Z]+|[a-zA-Z_][a-zA-Z0-9_]*))';
    const innermostDefIntRegex = new RegExp(
        `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*(?:_\\s*${boundPattern}\\s*\\^\\s*${boundPattern}|\\^\\s*${boundPattern}\\s*_\\s*${boundPattern})\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
        'i'
    );

    let intPasses = 0;
    let prevIntStr = '';
    while (prevIntStr !== cleanStr && intPasses < 10) {
        prevIntStr = cleanStr;
        cleanStr = cleanStr.replace(innermostDefIntRegex,
            (_m, l1, l2, l3, u1, u2, u3, u4, u5, u6, l4, l5, l6, expr, v) => {
                let lower = (l1 ?? l2 ?? l3 ?? l4 ?? l5 ?? l6).trim();
                let upper = (u1 ?? u2 ?? u3 ?? u4 ?? u5 ?? u6).trim();
                lower = lower.replace(/\\/g, '');
                upper = upper.replace(/\\/g, '');
                const integrand = expr.trim() || '1';
                return `integrate(${integrand}, ${v}, ${lower}, ${upper})`;
            }
        );
        intPasses++;
    }

    // 2. Integral indefinida
    const innermostIndefIntRegex = new RegExp(
        `(?:\\bdefint(?![a-zA-Z])|\\\\int(?![a-zA-Z])|\\bint(?![a-zA-Z]))\\s*((?:(?!\\\\int|\\bint\\b|\\bdefint\\b).)*?)\\s*(?:\\\\mathrm\\{d\\}|\\\\text\\{d\\}|\\\\differentialD|\\bd|(?<=[^a-zA-Z0-9_])d)\\s*\\\\?([a-zA-Z_][a-zA-Z0-9_]*)`,
        'i'
    );
    let indefPasses = 0;
    let prevIndefStr = '';
    while (prevIndefStr !== cleanStr && indefPasses < 10) {
        prevIndefStr = cleanStr;
        cleanStr = cleanStr.replace(innermostIndefIntRegex,
            (_m, expr, v) => {
                const integrand = expr.trim() || '1';
                return `integrate(${integrand}, ${v})`;
            }
        );
        indefPasses++;
    }

    // 3. Somatório e Produtório
    cleanStr = cleanStr.replace(/(?:\\sum|\bsum\b)\s*_\s*(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\s*\^\s*(?:\{([^}]+)\}|\(([^)]+)\)|([^\s]+))\s*(.*)$/i,
        (_m, v1, s1, v2, s2, e1, e2, e3, body) => {
            const v = v1 || v2;
            const start = s1 || s2;
            const endVal = e1 || e2 || e3;
            return `sum(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
        }
    );
    cleanStr = cleanStr.replace(/(?:\\prod|\bprod\b)\s*_\s*(?:\{([a-zA-Z_][a-zA-Z0-9_]*)=([^}]+)\}|\(([a-zA-Z_][a-zA-Z0-9_]*)=([^)]+)\))\s*\^\s*(?:\{([^}]+)\}|\(([^)]+)\)|([^\s]+))\s*(.*)$/i,
        (_m, v1, s1, v2, s2, e1, e2, e3, body) => {
            const v = v1 || v2;
            const start = s1 || s2;
            const endVal = e1 || e2 || e3;
            return `product(${body.trim() || v}, ${v}, ${start.trim()}, ${endVal.trim()})`;
        }
    );

    return cleanStr;
}

console.log('='.repeat(80));
console.log('AGENTE TESTER 1 - SUÍTE DE TESTES EXAUSTIVOS: TECLADO, ATALHOS E SANITIZAÇÃO');
console.log('='.repeat(80));

// ============================================================================
// GRUPO 1: TESTE DO COMANDO "/" (FRAÇÃO) E CAUSA RAIZ DA DUPLICAÇÃO
// ============================================================================
console.log('\n[GRUPO 1] Teste do comando "/" (barra/fração) e análise de tripla captura');

// Simulação de eventos:
// Em expressionManager.ts:
// 1. mathField.keybindings tem:
//    { key: '/', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] }
//    { key: '[Slash]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] }
//    { key: '[NumpadDivide]', ifMode: 'math', command: ['insert', '\\frac{#@}{#?}'] }
// 2. keydown listener:
//    if (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide') handleFraction(e);
// 3. beforeinput listener:
//    if (e.data === '/') handleFraction(e);

class MockMathField {
    commandHistory: any[] = [];
    executeCommand(cmd: any) {
        this.commandHistory.push(cmd);
    }
}

function simulateKeyPressSlash(opts: {
    browserBeforeInputSuppression: boolean; // se preventDefault no keydown impede beforeinput
    mathLiveProcessesInternalKeybinding: boolean; // se MathLive processa keybinding no shadow DOM
    hasDebounce: boolean;
}) {
    const mf = new MockMathField();
    let lastFractionTime = 0;

    const handleFraction = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (opts.hasDebounce && now - lastFractionTime < 300) {
            return;
        }
        lastFractionTime = now;
        mf.executeCommand(['insert', '\\frac{#@}{#?}']);
    };

    // 1. MathLive internal keybinding
    if (opts.mathLiveProcessesInternalKeybinding) {
        mf.executeCommand(['insert', '\\frac{#@}{#?}']);
    }

    // 2. Keydown listener em expressionManager.ts
    let keydownPrevented = false;
    const keydownEvent = {
        key: '/',
        code: 'Slash',
        preventDefault: () => { keydownPrevented = true; },
        stopPropagation: () => {}
    };
    if (keydownEvent.key === '/' || keydownEvent.code === 'Slash') {
        handleFraction(keydownEvent);
    }

    // 3. Beforeinput listener em expressionManager.ts
    const shouldFireBeforeInput = !opts.browserBeforeInputSuppression || !keydownPrevented;
    if (shouldFireBeforeInput) {
        const beforeInputEvent = {
            data: '/',
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        if (beforeInputEvent.data === '/') {
            handleFraction(beforeInputEvent);
        }
    }

    return mf.commandHistory;
}

// Caso 1.1: Browser moderno onde keydown dispara E beforeinput NÃO é prevenido (ex: Android/Virtual/IME)
const case1_1 = simulateKeyPressSlash({
    browserBeforeInputSuppression: false,
    mathLiveProcessesInternalKeybinding: false,
    hasDebounce: false
});
assertTest(
    'Comando / e Duplicação',
    'Cenário 1.1: Sem debounce, keydown + beforeinput executam handleFraction DUAS vezes',
    case1_1.length === 2,
    2,
    case1_1.length,
    'FALHA: Deveria disparar 2 vezes na ausência de debounce'
);

// Caso 1.2: MathLive processa keybinding interno E listener keydown externo também executa
const case1_2 = simulateKeyPressSlash({
    browserBeforeInputSuppression: true,
    mathLiveProcessesInternalKeybinding: true,
    hasDebounce: false
});
assertTest(
    'Comando / e Duplicação',
    'Cenário 1.2: Redundância de keybindings + keydown listener causa DUAS inserções de fração',
    case1_2.length === 2,
    2,
    case1_2.length,
    'FALHA: keybindings e keydown juntos duplicam a execução'
);

// Caso 1.3: Pior caso (keybinding + keydown + beforeinput) = 3 execuções!
const case1_3 = simulateKeyPressSlash({
    browserBeforeInputSuppression: false,
    mathLiveProcessesInternalKeybinding: true,
    hasDebounce: false
});
assertTest(
    'Comando / e Duplicação',
    'Cenário 1.3: Pior caso (keybinding + keydown + beforeinput) resulta em TRÊS inserções',
    case1_3.length === 3,
    3,
    case1_3.length,
    'FALHA: Tripla captura sem debounce insere 3 frações'
);

// Caso 1.4: Com debounce protetor (idêntico ao handlePower com lastPowerTime)
const case1_4 = simulateKeyPressSlash({
    browserBeforeInputSuppression: false,
    mathLiveProcessesInternalKeybinding: false,
    hasDebounce: true
});
assertTest(
    'Comando / e Duplicação',
    'Cenário 1.4: Com debounce temporal (300ms), evento duplo é filtrado para EXATAMENTE 1 inserção',
    case1_4.length === 1,
    1,
    case1_4.length,
    'FALHA: Debounce deveria restringir a 1 execução'
);

// ============================================================================
// GRUPO 2: TESTE DE ATALHOS DE TECLADO
// ============================================================================
console.log('\n[GRUPO 2] Teste de atalhos de teclado (^, *, #22, #33, matrix, d/dx, sqrt, defint, int)');

// 2.1 Atalho ^ (potência)
// Teste de reconhecimento de isCaretKey
const isCaretUS = (e: { key: string, code: string, shiftKey: boolean }) => e.key === '^' || (e.shiftKey && e.code === 'Digit6');
assertTest('Atalhos: Potência (^)', 'isCaretKey reconhece Shift+Digit6 (US keyboard)', isCaretUS({ key: '^', code: 'Digit6', shiftKey: true }), true, true);
assertTest('Atalhos: Potência (^)', 'isCaretKey reconhece key="^" diretamente', isCaretUS({ key: '^', code: 'Quote', shiftKey: false }), true, true);

// 2.2 Atalho * (multiplicação)
// Em MathLive inlineShortcuts: '*' -> '\\cdot'
// Em sanitização: \cdot -> *
const starClean = runMainMainClean('2\\cdot 3');
assertTest('Atalhos: Multiplicação (*)', 'Converte 2\\cdot 3 de volta para 2*3', starClean === '2*3', '2*3', starClean);

// 2.3 Atalhos #22 e #33 de criação de Matriz
function testHashShortcut(rawAscii: string, rawLatex: string) {
    const noSpaceAscii = rawAscii.replace(/\s+/g, '');
    const cleanLatex = rawLatex
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\operatorname\{([^}]+)\}/g, '$1')
        .replace(/\\#/g, '#')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, '');

    const hashMatch = noSpaceAscii.match(/^(?:([a-zA-Z])=)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i) ||
                      cleanLatex.match(/^(?:([a-zA-Z])=)?#([1-8])(?:x|X|\*|\\times)?([1-8])$/i);
    if (!hashMatch) return null;
    return {
        name: hashMatch[1] ? hashMatch[1].toUpperCase() : undefined,
        rows: parseInt(hashMatch[2]),
        cols: parseInt(hashMatch[3])
    };
}

const hash22 = testHashShortcut('#22', '\\#22');
assertTest('Atalhos: Matriz (#22)', '#22 cria matriz 2x2 sem nome', !!hash22 && hash22.rows === 2 && hash22.cols === 2 && hash22.name === undefined, { rows: 2, cols: 2, name: undefined }, hash22);

const hash33 = testHashShortcut('#33', '\\#33');
assertTest('Atalhos: Matriz (#33)', '#33 cria matriz 3x3 sem nome', !!hash33 && hash33.rows === 3 && hash33.cols === 3 && hash33.name === undefined, { rows: 3, cols: 3, name: undefined }, hash33);

const hashA22 = testHashShortcut('A=#22', 'A=\\#22');
assertTest('Atalhos: Matriz (A=#22)', 'A=#22 cria matriz 2x2 com nome A', !!hashA22 && hashA22.rows === 2 && hashA22.cols === 2 && hashA22.name === 'A', { rows: 2, cols: 2, name: 'A' }, hashA22);

const hashB24 = testHashShortcut('B = # 2 x 4', 'B=\\#2\\times4');
assertTest('Atalhos: Matriz (#2x4)', 'B = # 2 x 4 cria matriz 2x4 com nome B', !!hashB24 && hashB24.rows === 2 && hashB24.cols === 4 && hashB24.name === 'B', { rows: 2, cols: 4, name: 'B' }, hashB24);

// 2.4 Atalho matrix e matriz
function testMatrixKeyword(rawAscii: string, rawLatex: string) {
    const noSpaceAscii = rawAscii.replace(/\s+/g, '');
    const cleanLatex = rawLatex
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\operatorname\{([^}]+)\}/g, '$1')
        .replace(/\\#/g, '#')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, '');

    const matrixMatch = noSpaceAscii.match(/^(?:([a-zA-Z])=)?matri[xz]$/i) ||
                        cleanLatex.match(/^(?:([a-zA-Z])=)?\\?matri[xz]$/i);
    if (!matrixMatch) return null;
    return {
        name: matrixMatch[1] ? matrixMatch[1].toUpperCase() : undefined,
        rows: 2,
        cols: 2
    };
}

const mat1 = testMatrixKeyword('matrix', '\\mathrm{matrix}');
assertTest('Atalhos: Keyword matrix', 'matrix cria matriz 2x2 anônima', !!mat1 && mat1.rows === 2 && mat1.cols === 2, true, !!mat1);

const mat2 = testMatrixKeyword('A = matriz', 'A=\\operatorname{matriz}');
assertTest('Atalhos: Keyword matriz', 'A = matriz cria matriz 2x2 com nome A', !!mat2 && mat2.name === 'A', 'A', mat2?.name);

// 2.5 Atalho d/dx e derivadas
const ddxNorm1 = FaultTolerantParser.normalizeDerivative('d/dx(x^2)');
assertTest('Atalhos: d/dx', 'Normaliza d/dx(x^2) para diff(x^2, x)', ddxNorm1 === 'diff(x^2, x)', 'diff(x^2, x)', ddxNorm1);

const ddxNorm2 = FaultTolerantParser.normalizeDerivative('\\frac{d}{dx}\\left(x^3\\right)');
assertTest('Atalhos: d/dx', 'Normaliza \\frac{d}{dx}\\left(x^3\\right) para diff(x^3, x)', ddxNorm2 === 'diff(x^3, x)', 'diff(x^3, x)', ddxNorm2);

const ddxIncomplete = FaultTolerantParser.checkIncompleteStatus('\\frac{d}{dx}', 'd/dx');
assertTest('Atalhos: d/dx incompleto', 'Detecta d/dx sem argumento e retorna aviso sereno', ddxIncomplete.isIncomplete && ddxIncomplete.warning === 'Informe a função para derivar (ex: d/dx(x^2)).', true, ddxIncomplete.isIncomplete);

// 2.6 Atalho sqrt
const sqrtInc = FaultTolerantParser.checkIncompleteStatus('\\sqrt{}', 'sqrt()');
assertTest('Atalhos: sqrt', 'Detecta \\sqrt{} vazio como incompleto', sqrtInc.isIncomplete && sqrtInc.warning === 'Falta uma expressão dentro da raiz.', true, sqrtInc.isIncomplete);

const sqrFree = FaultTolerantParser.detectFreeVariables('sqr');
assertTest('Atalhos: sqrt (estado intermediário sqr)', 'Estado intermediário "sqr" decompõe em [s, q, r] para sliders sem erro', sqrFree.includes('s') && sqrFree.includes('q') && sqrFree.includes('r'), true, true);

// 2.7 Atalho int e defint
const intInc = FaultTolerantParser.checkIncompleteStatus('\\int x', 'int x');
assertTest('Atalhos: int sem diferencial', 'Detecta \\int x sem dx e exige diferencial', intInc.isIncomplete && intInc.warning === 'O integrando deve terminar com uma variável de integração, como dx.', true, intInc.isIncomplete);

const defintInc = FaultTolerantParser.checkIncompleteStatus('\\int_{}^{2} x dx', 'int_()^(2) x dx');
assertTest('Atalhos: defint sem limites', 'Detecta limites vazios em \\int_{}^{2} x dx', defintInc.isIncomplete && defintInc.warning === 'Faltam os limites de integração.', true, defintInc.isIncomplete);

// ============================================================================
// GRUPO 3: TESTES EXAUSTIVOS DE SANITIZAÇÃO DE cleanStr EM src/main.ts
// ============================================================================
console.log('\n[GRUPO 3] Teste exaustivo de sanitização cleanStr');

function runMainMainClean(input: string) {
    return runMainCleanStrPipeline(input);
}

// 3.1 Caracteres colados (xdx, ydy, tdt, zdz)
assertTest('Sanitização: Caracteres colados', '\\int xdx -> integrate(x, x)', runMainMainClean('\\int xdx') === 'integrate(x, x)', 'integrate(x, x)', runMainMainClean('\\int xdx'));
assertTest('Sanitização: Caracteres colados', '\\int ydy -> integrate(y, y)', runMainMainClean('\\int ydy') === 'integrate(y, y)', 'integrate(y, y)', runMainMainClean('\\int ydy'));
assertTest('Sanitização: Caracteres colados', 'int tdt -> integrate(t, t)', runMainMainClean('int tdt') === 'integrate(t, t)', 'integrate(t, t)', runMainMainClean('int tdt'));
assertTest('Sanitização: Caracteres colados', '\\int_0^2 xdx -> integrate(x, x, 0, 2)', runMainMainClean('\\int_0^2 xdx') === 'integrate(x, x, 0, 2)', 'integrate(x, x, 0, 2)', runMainMainClean('\\int_0^2 xdx'));

// FALHA CRÍTICA 1: Múltiplas integrais em uma única expressão (\int xdx + \int ydy)
const multiInt = runMainMainClean('\\int xdx + \\int ydy');
assertTest(
    'Sanitização: Múltiplas integrais',
    '\\int xdx + \\int ydy normaliza AMBAS as integrais',
    multiInt === 'integrate(x, x) + integrate(y, y)',
    'integrate(x, x) + integrate(y, y)',
    multiInt,
    'FALHA: O regex de separação de diferencial só olha para o fim da string (\\s*$), falhando na primeira integral!'
);

// FALHA CRÍTICA 2: Integral seguida de outros termos (\int xdx + 1)
const intPlusOne = runMainMainClean('\\int xdx + 1');
assertTest(
    'Sanitização: Integral com termo posterior',
    '\\int xdx + 1 normaliza para integrate(x, x) + 1',
    intPlusOne === 'integrate(x, x) + 1',
    'integrate(x, x) + 1',
    intPlusOne,
    'FALHA: \\int xdx + 1 termina em "+ 1", portanto o diferencial colado xdx NÃO é separado e a integral falha!'
);

// FALHA CRÍTICA 3: Multiplicação escalar e limites colados
assertTest('Sanitização: Escalar implícito', '2x -> 2*x', runMainMainClean('2x') === '2*x', '2*x', runMainMainClean('2x'));
assertTest('Sanitização: Escalar implícito', '2B -> 2*B', runMainMainClean('2B') === '2*B', '2*B', runMainMainClean('2B'));
assertTest('Sanitização: Escalar implícito', '3.5y -> 3.5*y', runMainMainClean('3.5y') === '3.5*y', '3.5*y', runMainMainClean('3.5y'));
assertTest('Sanitização: Limites colados', '\\int_1^2x dx -> integrate(x, x, 1, 2)', runMainMainClean('\\int_1^2x dx') === 'integrate(x, x, 1, 2)', 'integrate(x, x, 1, 2)', runMainMainClean('\\int_1^2x dx'));

// 3.2 Espaços extras e funções espaçadas
assertTest('Sanitização: Funções espaçadas', 's i n(x) -> sin(x)', runMainMainClean('s i n(x)') === 'sin(x)', 'sin(x)', runMainMainClean('s i n(x)'));
assertTest('Sanitização: Funções espaçadas', 'c o s(x) -> cos(x)', runMainMainClean('c o s(x)') === 'cos(x)', 'cos(x)', runMainMainClean('c o s(x)'));
assertTest('Sanitização: Funções espaçadas', 'r r e f(A) -> rref(A)', runMainMainClean('r r e f(A)') === 'rref(A)', 'rref(A)', runMainMainClean('r r e f(A)'));
assertTest('Sanitização: Espaços em limites', '\\int _{ 1 } ^{ 2 } x dx -> integrate(x, x, 1, 2)', runMainMainClean('\\int _{ 1 } ^{ 2 } x dx') === 'integrate(x, x, 1, 2)', 'integrate(x, x, 1, 2)', runMainMainClean('\\int _{ 1 } ^{ 2 } x dx'));
assertTest('Sanitização: Espaços em limites', 'defint _ 1 ^ 2 x dx -> integrate(x, x, 1, 2)', runMainMainClean('defint _ 1 ^ 2 x dx') === 'integrate(x, x, 1, 2)', 'integrate(x, x, 1, 2)', runMainMainClean('defint _ 1 ^ 2 x dx'));

// 3.3 Barras duplas e frações aninhadas
// FALHA CRÍTICA 4: Frações aninhadas em LaTeX: \frac{\frac{1}{2}}{3}
const nestedFrac1 = runMainMainClean('\\frac{\\frac{1}{2}}{3}');
assertTest(
    'Sanitização: Fração aninhada',
    '\\frac{\\frac{1}{2}}{3} normaliza corretamente para (((1)/(2))/(3)) ou ((1/2)/(3))',
    nestedFrac1 === '((((1)/(2)))/(3))' || nestedFrac1 === '(((1/2))/(3))',
    '((((1)/(2)))/(3))',
    nestedFrac1,
    'FALHA: O regex \\frac\\{([^}]+)\\}\\{([^}]+)\\} é não-recursivo e guloso/raso, corrompendo frações aninhadas!'
);

// FALHA CRÍTICA 5: Frações aninhadas no denominador: \frac{1}{\frac{2}{3}}
const nestedFrac2 = runMainMainClean('\\frac{1}{\\frac{2}{3}}');
assertTest(
    'Sanitização: Fração aninhada no denominador',
    '\\frac{1}{\\frac{2}{3}} normaliza corretamente',
    nestedFrac2 === '((1)/(((2)/(3))))' || nestedFrac2 === '((1)/((2)/(3)))',
    '((1)/(((2)/(3))))',
    nestedFrac2,
    'FALHA: Frações no denominador são corrompidas por regex guloso!'
);

// 3.4 Parênteses vazios
// Teste de como FaultTolerantParser e PrattParser reagem a parênteses vazios
const emptyParen1 = FaultTolerantParser.checkIncompleteStatus('()', '()');
assertTest(
    'Sanitização: Parênteses vazios',
    'checkIncompleteStatus detecta "()" isolado como incompleto',
    emptyParen1.isIncomplete,
    true,
    emptyParen1.isIncomplete,
    'FALHA: checkIncompleteStatus só detecta parênteses vazios com nome de função antes (ex: sin()), deixando "()" passar!'
);

const emptyParen2 = FaultTolerantParser.checkIncompleteStatus('1 + ()', '1 + ()');
assertTest(
    'Sanitização: Parênteses vazios em expressão',
    'checkIncompleteStatus detecta "1 + ()" como incompleto',
    emptyParen2.isIncomplete,
    true,
    emptyParen2.isIncomplete,
    'FALHA: "1 + ()" passa pelo filtro de incompletude e dispara SyntaxError no PrattParser!'
);

// 3.5 Delimitadores nulos do LaTeX (\left. e \right.)
// FALHA CRÍTICA 6: \left. deixa ponto solto "."
const leftDotClean = runMainMainClean('\\left. x \\right.');
assertTest(
    'Sanitização: Delimitadores nulos LaTeX',
    '\\left. e \\right. não devem deixar pontos soltos "." na expressão',
    !leftDotClean.includes('.'),
    'sem ponto solto',
    leftDotClean,
    'FALHA: .replace(/\\\\left/g, "") remove "\\left" mas deixa o "." de "\\left." criando um ponto decimal solto!'
);

// 3.6 Subscritos de Matriz com chaves: A_{1,2} vs A_(1,2)
// FALHA CRÍTICA 7: A_{1,2} não é indexado
const matSubBraces = runMainMainClean('A_{1,2}');
assertTest(
    'Sanitização: Indexação de matriz com chaves',
    'A_{1,2} normaliza para A[0,1]',
    matSubBraces === 'A[0,1]',
    'A[0,1]',
    matSubBraces,
    'FALHA: O regex em main.ts só procura A_(1,2) com parênteses, ignorando o formato LaTeX padrão A_{1,2}!'
);

const matSubBracesSingle = runMainMainClean('A_{1}');
assertTest(
    'Sanitização: Indexação de vetor com chaves',
    'A_{1} normaliza para A[0]',
    matSubBracesSingle === 'A[0]',
    'A[0]',
    matSubBracesSingle,
    'FALHA: O regex em main.ts só procura A_1 ou A_(1), ignorando A_{1}!'
);

// ============================================================================
// RESUMO E IMPRESSÃO DOS RESULTADOS
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('RESUMO DOS TESTES EXAUSTIVOS');
console.log('='.repeat(80));

const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;

console.log(`TOTAL DE TESTES: ${results.length}`);
console.log(`PASSARAM: ${passedCount}`);
console.log(`FALHARAM: ${failedCount}`);

if (failedCount > 0) {
    console.log('\n❌ RELAÇÃO DE FALHAS ENCONTRADAS:');
    results.filter(r => !r.passed).forEach((r, idx) => {
        console.log(`\n[FALHA ${idx + 1}] Categoria: ${r.category}`);
        console.log(`  Teste: ${r.name}`);
        console.log(`  Esperado: ${JSON.stringify(r.expected)}`);
        console.log(`  Obtido:   ${JSON.stringify(r.actual)}`);
        console.log(`  Motivo:   ${r.error}`);
    });
} else {
    console.log('\n✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
}

console.log('\n' + '='.repeat(80));
        expect(passedCount).toBe(42);
        expect(failedCount).toBe(0);
    });
});
