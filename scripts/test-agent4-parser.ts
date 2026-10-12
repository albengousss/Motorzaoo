/**
 * TEST-AGENT4-PARSER.TS
 * Suíte de Testes Exaustivos do Agente Tester 4:
 * 1. Tokenizer & PrattParser (Expressões complexas, precedência, números científicos, potências encadeadas, multiplicação implícita)
 * 2. Equações Implícitas & Inequações (ImplicitEngine, Marching Squares, detecção e compilação intervalar)
 * 3. Funções de Usuário (Mono e multivariáveis, dependentes, substituição de AST e expansão)
 */

import { Tokenizer, TokenTypes } from '../src/core/tokenizer';
import { PrattParser } from '../src/core/prattParser';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { ImplicitEngine } from '../src/core/implicitEngine';

console.log('======================================================================');
console.log('   SUÍTE EXAUSTIVA DE TESTES - AGENTE TESTER 4 (PARSER & IMPLÍCITAS)');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;
const failures: Array<{ test: string; category: string; expected: string; got: string; reason: string }> = [];

function assert(condition: boolean, testName: string, category: string, expected: any, got: any, reason: string) {
    if (condition) {
        console.log(`  ✅ [PASS] ${testName}`);
        passed++;
    } else {
        console.error(`  ❌ [FAIL] ${testName}`);
        console.error(`     Esperado: ${JSON.stringify(expected)}`);
        console.error(`     Obtido:   ${JSON.stringify(got)}`);
        console.error(`     Causa:    ${reason}`);
        failed++;
        failures.push({
            test: testName,
            category,
            expected: JSON.stringify(expected),
            got: JSON.stringify(got),
            reason
        });
    }
}

// -------------------------------------------------------------------------------------------------
// SEÇÃO 1: TOKENIZER & PRATTPARSER - PRECEDÊNCIA DE OPERADORES & SÍMBOLOS MATEMÁTICOS
// -------------------------------------------------------------------------------------------------
console.log('--- SEÇÃO 1: Precedência de Operadores & Aritmética Básica ---');

{
    // 1.1 Precedência Adição vs Multiplicação
    const ast1 = new PrattParser('2 + 3 * 4').parseExpression();
    assert(
        JSON.stringify(ast1) === JSON.stringify(['Add', 2, ['Multiply', 3, 4]]),
        'Precedência Adição / Multiplicação: 2 + 3 * 4',
        'Precedência',
        ['Add', 2, ['Multiply', 3, 4]],
        ast1,
        'Multiplicação deve ter precedência maior que adição'
    );

    // 1.2 Associatividade à Esquerda de Divisão e Multiplicação
    const ast2 = new PrattParser('8 / 2 * 4').parseExpression();
    assert(
        JSON.stringify(ast2) === JSON.stringify(['Multiply', ['Divide', 8, 2], 4]),
        'Associatividade à esquerda: 8 / 2 * 4 -> (8 / 2) * 4',
        'Precedência',
        ['Multiply', ['Divide', 8, 2], 4],
        ast2,
        'Divisão e multiplicação têm mesma precedência (20), devem associar à esquerda'
    );

    // 1.3 Subtrações encadeadas: 10 - 4 - 2 -> (10 - 4) - 2
    const ast3 = new PrattParser('10 - 4 - 2').parseExpression();
    assert(
        JSON.stringify(ast3) === JSON.stringify(['Subtract', ['Subtract', 10, 4], 2]),
        'Subtração associativa à esquerda: 10 - 4 - 2',
        'Precedência',
        ['Subtract', ['Subtract', 10, 4], 2],
        ast3,
        'Subtração deve associar à esquerda'
    );

    // 1.4 Unary Minus vs Exponenciação: -2^2 deve ser -(2^2) = -4
    const ast4 = new PrattParser('-2^2').parseExpression();
    assert(
        JSON.stringify(ast4) === JSON.stringify(['Negate', ['Power', 2, 2]]),
        'Precedência Negate vs Power: -2^2 vira ["Negate", ["Power", 2, 2]]',
        'Precedência',
        ['Negate', ['Power', 2, 2]],
        ast4,
        'Em notação padrão matemática (e Desmos), -x^2 = -(x^2)'
    );

    // 1.5 Potências encadeadas: x^2^3 deve ser associativa à direita -> x^(2^3)
    const ast5 = new PrattParser('x^2^3').parseExpression();
    assert(
        JSON.stringify(ast5) === JSON.stringify(['Power', 'x', ['Power', 2, 3]]),
        'Potências encadeadas x^2^3 associam à direita: x^(2^3)',
        'Precedência',
        ['Power', 'x', ['Power', 2, 3]],
        ast5,
        'Exponenciação matemática pura deve ser associativa à direita'
    );

    // 1.6 Avaliação numérica de potência encadeada: 2^3^2 = 2^9 = 512
    const fnPow = MathEngine.compile(ast5);
    const valPow = MathEngine.compile(new PrattParser('2^3^2').parseExpression())(0, 0, {});
    assert(
        valPow === 512,
        'Avaliação numérica de 2^3^2 = 512 (e não (2^3)^2 = 64)',
        'Precedência',
        512,
        valPow,
        '2^3^2 deve avaliar para 512'
    );
}

// -------------------------------------------------------------------------------------------------
// SEÇÃO 2: NÚMEROS CIENTÍFICOS (1e-5, 2.5e-3, 1e+10)
// -------------------------------------------------------------------------------------------------
console.log('\n--- SEÇÃO 2: Notação Científica de Números ---');

{
    const tok = new Tokenizer();

    // 2.1 1e-5
    const tokens1e5 = tok.tokenize('1e-5');
    const isSingleNumber1 = tokens1e5.length === 1 && tokens1e5[0].type === TokenTypes.NUMBER;
    assert(
        isSingleNumber1,
        'Tokenização de 1e-5 como token NUMBER único',
        'Notação Científica',
        [{ type: 'NUMBER', value: '1e-5' }],
        tokens1e5,
        'O Tokenizer atual fragmenta 1e-5 em 1, *, e, -, 5'
    );

    let ast1e5: any = null;
    try {
        ast1e5 = new PrattParser('1e-5').parseExpression();
    } catch (e: any) {
        ast1e5 = e.message;
    }
    const val1e5 = typeof ast1e5 === 'number' ? ast1e5 : MathEngine.compile(ast1e5)(0, 0, {});
    assert(
        Math.abs(val1e5 - 1e-5) < 1e-12,
        'Avaliação de 1e-5 deve resultar em 0.00001 (1e-5)',
        'Notação Científica',
        0.00001,
        val1e5,
        'Como 1e-5 foi decomposto em 1*e - 5, avalia para e - 5 = -2.2817 em vez de 0.00001'
    );

    // 2.2 2.5e-3
    const tokens2e3 = tok.tokenize('2.5e-3');
    assert(
        tokens2e3.length === 1 && tokens2e3[0].type === TokenTypes.NUMBER,
        'Tokenização de 2.5e-3 como token NUMBER único',
        'Notação Científica',
        [{ type: 'NUMBER', value: '2.5e-3' }],
        tokens2e3,
        'Tokenizer quebra 2.5e-3 em 2.5, *, e, -, 3'
    );

    // 2.3 1e+10
    const tokens1ePlus = tok.tokenize('1e+10');
    assert(
        tokens1ePlus.length === 1 && tokens1ePlus[0].type === TokenTypes.NUMBER,
        'Tokenização de 1e+10 como token NUMBER único',
        'Notação Científica',
        [{ type: 'NUMBER', value: '1e+10' }],
        tokens1ePlus,
        'Tokenizer quebra 1e+10 em 1, *, e, +, 10'
    );
}

// -------------------------------------------------------------------------------------------------
// SEÇÃO 3: MULTIPLICAÇÃO IMPLÍCITA
// -------------------------------------------------------------------------------------------------
console.log('\n--- SEÇÃO 3: Multiplicação Implícita ---');

{
    // 3.1 Padrão clássico: 2x, 2(x+1)
    const ast2x = new PrattParser('2x').parseExpression();
    assert(
        JSON.stringify(ast2x) === JSON.stringify(['Multiply', 2, 'x']),
        'Multiplicação implícita número-variável: 2x',
        'Multiplicação Implícita',
        ['Multiply', 2, 'x'],
        ast2x,
        '2x deve virar 2*x'
    );

    const ast2paren = new PrattParser('2(x+1)').parseExpression();
    assert(
        JSON.stringify(ast2paren) === JSON.stringify(['Multiply', 2, ['Add', 'x', 1]]),
        'Multiplicação implícita número-parênteses: 2(x+1)',
        'Multiplicação Implícita',
        ['Multiply', 2, ['Add', 'x', 1]],
        ast2paren,
        '2(x+1) deve virar 2*(x+1)'
    );

    // 3.2 Variável com função: x sin(x)
    const astXSin = new PrattParser('x sin(x)').parseExpression();
    assert(
        JSON.stringify(astXSin) === JSON.stringify(['Multiply', 'x', ['Sin', 'x']]),
        'Multiplicação implícita x sin(x)',
        'Multiplicação Implícita',
        ['Multiply', 'x', ['Sin', 'x']],
        astXSin,
        'x sin(x) deve virar x*sin(x)'
    );

    // 3.3 Variável com parênteses: x(x+1)
    const astXparen = new PrattParser('x(x+1)').parseExpression();
    assert(
        JSON.stringify(astXparen) === JSON.stringify(['Multiply', 'x', ['Add', 'x', 1]]),
        'Multiplicação implícita x(x+1)',
        'Multiplicação Implícita',
        ['Multiply', 'x', ['Add', 'x', 1]],
        astXparen,
        'x(x+1) deve virar x*(x+1)'
    );

    // 3.4 Multiplicação implícita com potência antes de parênteses: x^2(x+1)
    const parserPowParen = new PrattParser('x^2(x+1)');
    const astPowParen = parserPowParen.parseExpression();
    const noTrailingPowParen = parserPowParen.lookahead === null;
    assert(
        noTrailingPowParen && JSON.stringify(astPowParen) === JSON.stringify(['Multiply', ['Power', 'x', 2], ['Add', 'x', 1]]),
        'Multiplicação implícita x^2(x+1) consome expressão completa',
        'Multiplicação Implícita',
        ['Multiply', ['Power', 'x', 2], ['Add', 'x', 1]],
        astPowParen,
        'Regra 3 do Tokenizer exige (?<![\\^_])(\\d)\\(, bloqueando 2(x+1) se 2 for expoente ^2'
    );

    // 3.5 Parênteses com módulo ou número com módulo: 2|x|
    const parserMod = new PrattParser('2|x|');
    const astMod = parserMod.parseExpression();
    const noTrailingMod = parserMod.lookahead === null;
    assert(
        noTrailingMod && JSON.stringify(astMod) === JSON.stringify(['Multiply', 2, ['Abs', 'x']]),
        'Multiplicação implícita 2|x|',
        'Multiplicação Implícita',
        ['Multiply', 2, ['Abs', 'x']],
        astMod,
        'Tokenizer não possui regra para multiplicação implícita antes do pipe "|"'
    );

    // 3.6 Símbolo pi com variáveis: \pi x e π x
    const parserPiLatex = new PrattParser('\\pi x');
    const astPiLatex = parserPiLatex.parseExpression();
    assert(
        JSON.stringify(astPiLatex) === JSON.stringify(['Multiply', 'pi', 'x']),
        'Multiplicação implícita \\pi x',
        'Multiplicação Implícita',
        ['Multiply', 'pi', 'x'],
        astPiLatex,
        '\\pi x deve virar \\pi*x'
    );

    let astPiUnicode: any = null;
    let piUnicodeThrows = false;
    try {
        const parserPiUnicode = new PrattParser('π x');
        astPiUnicode = parserPiUnicode.parseExpression();
    } catch (e: any) {
        piUnicodeThrows = true;
        astPiUnicode = e.message;
    }
    assert(
        !piUnicodeThrows && JSON.stringify(astPiUnicode) === JSON.stringify(['Multiply', 'pi', 'x']),
        'Multiplicação implícita com caractere unicode π x',
        'Multiplicação Implícita',
        ['Multiply', 'pi', 'x'],
        astPiUnicode,
        'TokenSpec regex [/^[a-zA-Z_].../] rejeita o caractere unicode "π"'
    );

    // 3.7 Parênteses duplos: (x+1)(x-1)
    const astDoubleParen = new PrattParser('(x+1)(x-1)').parseExpression();
    assert(
        JSON.stringify(astDoubleParen) === JSON.stringify(['Multiply', ['Add', 'x', 1], ['Subtract', 'x', 1]]),
        'Multiplicação implícita (x+1)(x-1)',
        'Multiplicação Implícita',
        ['Multiply', ['Add', 'x', 1], ['Subtract', 'x', 1]],
        astDoubleParen,
        'Parenteses adjacentes devem virar multiplicação'
    );
}

// -------------------------------------------------------------------------------------------------
// SEÇÃO 4: EQUAÇÕES IMPLÍCITAS & INEQUAÇÕES (ImplicitEngine)
// -------------------------------------------------------------------------------------------------
console.log('\n--- SEÇÃO 4: Equações Implícitas & Inequações (ImplicitEngine) ---');

{
    // 4.1 Círculo implícito: x^2 + y^2 = 1
    const circleAst = new PrattParser('x^2 + y^2 - 1').parseExpression();
    const geomCircle = ImplicitEngine.generateImplicit('circle1', circleAst, '=', {}, -2, 2, -2, 2);
    assert(
        geomCircle.segments.length > 500 && geomCircle.fills.length === 0,
        'Círculo implícito x^2 + y^2 = 1 gera segmentos Marching Squares sem fills',
        'Equações Implícitas',
        { segmentsCountMin: 500, fillsCount: 0 },
        { segmentsCount: geomCircle.segments.length, fillsCount: geomCircle.fills.length },
        'Equação igual (=) gera contorno contínuo de segmentos sem preenchimento'
    );

    // 4.2 Inequação de círculo preenchido: x^2 + y^2 <= 4
    const diskAst = new PrattParser('x^2 + y^2 - 4').parseExpression();
    const geomDisk = ImplicitEngine.generateImplicit('disk1', diskAst, '<=', {}, -3, 3, -3, 3);
    const hasOriginFill = geomDisk.fills.some(f => f.x <= 0 && f.x + f.w >= 0 && f.y <= 0 && f.y + f.h >= 0);
    assert(
        geomDisk.segments.length > 500 && geomDisk.fills.length > 1000 && hasOriginFill,
        'Inequação x^2 + y^2 <= 4 gera bordas e blocos de preenchimento (incluindo origem)',
        'Inequações',
        { hasOriginFill: true, fillsMin: 1000 },
        { hasOriginFill, fillsCount: geomDisk.fills.length },
        '<= deve preencher a região interior'
    );

    // 4.3 Hipérbole: x*y > 1
    const hypAst = new PrattParser('x*y - 1').parseExpression();
    const geomHyp = ImplicitEngine.generateImplicit('hyp1', hypAst, '>', {}, -5, 5, -5, 5);
    const originNotFilled = !geomHyp.fills.some(f => f.x <= 0 && f.x + f.w >= 0 && f.y <= 0 && f.y + f.h >= 0);
    assert(
        geomHyp.segments.length > 400 && geomHyp.fills.length > 500 && originNotFilled,
        'Inequação x*y > 1 gera hipérbole e preenche apenas quadrantes I e III',
        'Inequações',
        { originNotFilled: true, fillsMin: 500 },
        { originNotFilled, fillsCount: geomHyp.fills.length },
        'Origem (0, 0) não satisfaz x*y > 1'
    );

    // 4.4 Inequação linear: x + y < 0
    const linAst = new PrattParser('x + y').parseExpression();
    const geomLin = ImplicitEngine.generateImplicit('lin1', linAst, '<', {}, -5, 5, -5, 5);
    assert(
        geomLin.segments.length > 200 && geomLin.fills.length > 500,
        'Inequação linear estrita x + y < 0 gera semiplano preenchido',
        'Inequações',
        { segmentsMin: 200, fillsMin: 500 },
        { segmentsCount: geomLin.segments.length, fillsCount: geomLin.fills.length },
        'Interval arithmetic resolve semiplano linear'
    );

    // 4.5 Cache de ImplicitEngine invalida corretamente quando variáveis de escopo mudam
    StateManager.varVersions['a'] = 1;
    const paramAst = new PrattParser('x^2 + y^2 - a').parseExpression();
    const geomA1 = ImplicitEngine.generateImplicit('paramEq', paramAst, '=', { a: 1 }, -3, 3, -3, 3);
    StateManager.varVersions['a'] = 2;
    const geomA2 = ImplicitEngine.generateImplicit('paramEq', paramAst, '=', { a: 4 }, -3, 3, -3, 3);
    assert(
        geomA1.segments.length !== geomA2.segments.length || geomA1 !== geomA2,
        'Cache do ImplicitEngine re-executa quando varVersions incrementa',
        'Equações Implícitas',
        true,
        geomA1 !== geomA2,
        'Cache deve respeitar StateManager.varVersions'
    );
}

// -------------------------------------------------------------------------------------------------
// SEÇÃO 5: FUNÇÕES DE USUÁRIO (f(x), f(x, y), Definições Dependentes)
// -------------------------------------------------------------------------------------------------
console.log('\n--- SEÇÃO 5: Funções de Usuário & Definições Dependentes ---');

{
    // 5.1 Registro e compilação de função monovariável: f(x) = x^2
    const fAst = new PrattParser('x^2').parseExpression();
    MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: 'block_f' };
    StateManager.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: fAst, blockId: 'block_f' };
    MathEngine.compiledFuncs['f'] = MathEngine.compile(fAst, 'x');

    const fCompiledVal = MathEngine.compiledFuncs['f'](4, 0, {});
    assert(
        fCompiledVal === 16,
        'Função monovariável f(x) = x^2 avalia f(4) = 16',
        'Funções de Usuário',
        16,
        fCompiledVal,
        'Compilação de monovariável deve produzir função matemática rápida'
    );

    // 5.2 Expansão analítica de f(x) com expandUserFunctions: f(x+3) -> (x+3)^2
    const callAst1 = new PrattParser('f(x+3)').parseExpression();
    const expandedAst1 = MathEngine.expandUserFunctions(callAst1);
    assert(
        JSON.stringify(expandedAst1) === JSON.stringify(['Power', ['Add', 'x', 3], 2]),
        'expandUserFunctions substitui parâmetro analiticamente: f(x+3) -> (x+3)^2',
        'Funções de Usuário',
        ['Power', ['Add', 'x', 3], 2],
        expandedAst1,
        'expandUserFunctions deve mapear parâmetros da AST'
    );

    // 5.3 Função dependente monovariável: g(x) = f(x) + 1
    const gAst = new PrattParser('f(x) + 1').parseExpression();
    MathEngine.userFunctions['g'] = { params: ['x'], expr: 'f(x) + 1', ast: gAst, blockId: 'block_g' };
    StateManager.userFunctions['g'] = { params: ['x'], expr: 'f(x) + 1', ast: gAst, blockId: 'block_g' };
    MathEngine.compiledFuncs['g'] = MathEngine.compile(gAst, 'x');

    const gCompiledVal = MathEngine.compiledFuncs['g'](3, 0, {});
    assert(
        gCompiledVal === 10,
        'Função dependente g(x) = f(x) + 1 avalia g(3) = 10 chamando funcs.f',
        'Funções de Usuário',
        10,
        gCompiledVal,
        'g(x) deve delegar para funcs.f(x)'
    );

    // 5.4 Função multivariável pura: h(x, y) = x^2 + y^2
    const hAst = new PrattParser('x^2 + y^2').parseExpression();
    MathEngine.userFunctions['h'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: hAst, blockId: 'block_h' };
    StateManager.userFunctions['h'] = { params: ['x', 'y'], expr: 'x^2 + y^2', ast: hAst, blockId: 'block_h' };
    MathEngine.compiledFuncs['h'] = MathEngine.compileMultivariable(hAst, ['x', 'y']);

    const hCompiledVal = MathEngine.compiledFuncs['h'](3, 4);
    assert(
        hCompiledVal === 25,
        'Função multivariável h(x, y) = x^2 + y^2 avalia h(3, 4) = 25',
        'Funções de Usuário',
        25,
        hCompiledVal,
        'compileMultivariable deve indexar args[0] e args[1]'
    );

    // 5.5 Função multivariável dependente chamando outra função multivariável: k(x, y) = h(x, y) - 25
    // Note: se o nome tiver dígitos (ex: h2) ou se passar múltiplos argumentos, verificamos se o parser gera ['h', 'x', 'y']
    const kAst = new PrattParser('h(x, y) - 25').parseExpression();
    MathEngine.userFunctions['k'] = { params: ['x', 'y'], expr: 'h(x, y) - 25', ast: kAst, blockId: 'block_k' };
    StateManager.userFunctions['k'] = { params: ['x', 'y'], expr: 'h(x, y) - 25', ast: kAst, blockId: 'block_k' };
    MathEngine.compiledFuncs['k'] = MathEngine.compileMultivariable(kAst, ['x', 'y']);

    const kCompiledVal = MathEngine.compiledFuncs['k'](3, 4);
    assert(
        kCompiledVal === 0,
        'Função multivariável dependente k(x, y) = h(x, y) - 25 avalia k(3, 4) = 0',
        'Funções de Usuário',
        0,
        kCompiledVal,
        'compileMultivariable deve delegar para funcs.h com múltiplos argumentos'
    );

    // 5.6 Falha com identificador contendo dígitos em chamada de função: f2(x, y)
    // O Tokenizer regra 3 transforma f2(x, y) em f2*(x, y), fazendo o parser enxergar f2 * Point(x, y)
    const parserNumFunc = new PrattParser('f2(x, y)');
    const astNumFunc = parserNumFunc.parseExpression();
    const isDirectCall = Array.isArray(astNumFunc) && astNumFunc[0] === 'f2' && astNumFunc[1] === 'x' && astNumFunc[2] === 'y';
    assert(
        isDirectCall,
        'Chamada de função com dígito no nome f2(x, y) não deve virar f2*(x, y)',
        'Tokenizer & Funções de Usuário',
        ['f2', 'x', 'y'],
        astNumFunc,
        'Regra 3 do Tokenizer (\\d)\\s*\\( converte o 2 de f2 em multiplicação implícita f2*(x, y)'
    );

    // 5.7 Expansão recursiva multinível em expandUserFunctions: h(x) -> g(x) * 2 -> (f(x) + 1) * 2 -> (x^2 + 1) * 2
    // MathEngine.expandUserFunctions atualmente não é recursivo para descer nas definições internas expandidas
    const nestedH = new PrattParser('g(x) * 2').parseExpression();
    const fullyExpanded = MathEngine.expandUserFunctions(nestedH);
    const isFullyExpanded = JSON.stringify(fullyExpanded).includes('Power');
    assert(
        isFullyExpanded,
        'expandUserFunctions deve expandir recursivamente funções dependentes em cadeia',
        'Funções de Usuário',
        ['Multiply', ['Add', ['Power', 'x', 2], 1], 2],
        fullyExpanded,
        'expandUserFunctions substitui def.ast mas não roda recursivamente sobre o resultado inserido'
    );
}

// -------------------------------------------------------------------------------------------------
// RESUMO FINAL
// -------------------------------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`RESULTADO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU (Total: ${passed + failed})`);
console.log('======================================================================\n');

if (failures.length > 0) {
    console.log('DETALHAMENTO DAS FALHAS IDENTIFICADAS:');
    failures.forEach((f, idx) => {
        console.log(`\n[FALHA ${idx + 1}] Categoria: ${f.category} | Teste: ${f.test}`);
        console.log(`  Esperado: ${f.expected}`);
        console.log(`  Obtido:   ${f.got}`);
        console.log(`  Motivo:   ${f.reason}`);
    });
}
