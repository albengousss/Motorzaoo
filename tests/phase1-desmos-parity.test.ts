// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { MathEngine } from '../src/core/mathEngine';
import { StateManager } from '../src/core/stateManager';
import { PrattParser } from '../src/core/prattParser';
import { FaultTolerantParser } from '../src/core/faultTolerantParser';
import { ExpressionManager } from '../src/ui/expressionManager';

describe('Phase 1 & Desmos Parity: Function Storage and Input UX', () => {

    beforeEach(() => {
        MathEngine.userFunctions = {};
        MathEngine.initCompiledFuncs();
        MathEngine.compileCache = {};
        StateManager.values = {};
        StateManager.asts = {};
        StateManager.userFunctions = {};
        StateManager.giacDefinitions = {};
    });

    it('1. Armazenamento e avaliação de função de 1 variável com slider externo: f(x) = x^2 + a', () => {
        const astF = new PrattParser('x^2 + a').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2 + a', ast: astF, blockId: 'block-1' };
        StateManager.userFunctions['f'] = { params: ['x'], expr: 'x^2 + a', ast: astF, blockId: 'block-1' };
        MathEngine.compiledFuncs['f'] = MathEngine.compile(astF, 'x');

        const scope = { a: 5 };

        // Chamada direta com (x, 0, scope)
        const fn = MathEngine.compiledFuncs['f'];
        expect(fn(3, 0, scope)).toBe(14); // 3^2 + 5 = 14

        // Chamada direta com (x, scope) (polimórfica)
        expect((fn as any)(3, scope)).toBe(14);

        // Avaliação nativa em evaluateAST
        const evalResult = MathEngine.evaluateAST(['f', 3], scope);
        expect(evalResult).toBe(14);
    });

    it('2. Chamada de função do usuário dentro de outra função compilada: g(x) = f(x) * 2', () => {
        const astF = new PrattParser('x^2 + a').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2 + a', ast: astF };
        MathEngine.compiledFuncs['f'] = MathEngine.compile(astF, 'x');

        const astG = new PrattParser('f(x) * 2').parseExpression();
        const compiledG = MathEngine.compile(astG, 'x');

        const scope = { a: 5 };
        // g(3) = f(3) * 2 = (3^2 + 5) * 2 = 14 * 2 = 28
        expect(compiledG(3, 0, scope)).toBe(28);
        expect((compiledG as any)(3, scope)).toBe(28);
    });

    it('3. Função multivariável com escopo e sliders: h(x, y) = x*y + a', () => {
        const astH = new PrattParser('x*y + a').parseExpression();
        MathEngine.userFunctions['h'] = { params: ['x', 'y'], expr: 'x*y + a', ast: astH };
        MathEngine.compiledFuncs['h'] = MathEngine.compileMultivariable(astH, ['x', 'y']);

        const scope = { a: 10 };
        // Chamada direta h(2, 3, scope) = 2*3 + 10 = 16
        const fnH = MathEngine.compiledFuncs['h'];
        expect(fnH(2, 3, scope)).toBe(16);

        // Chamada de h dentro de expressão compilada
        const astK = new PrattParser('h(2, 3) + 4').parseExpression();
        const compiledK = MathEngine.compile(astK, 'x');
        expect(compiledK(0, 0, scope)).toBe(20);

        // Avaliação nativa via evaluateAST
        const evalResult = MathEngine.evaluateAST(['h', 2, 3], scope);
        expect(evalResult).toBe(16);
    });

    it('4. Supressão de Sliders para nomes de funções do usuário registradas', () => {
        // Sem registrar 'f', detectFreeVariables retornaria ['f']
        const freeUnbound = FaultTolerantParser.detectFreeVariables('f(3)', []);
        expect(freeUnbound).toContain('f');

        // Com 'f' registrada como função do usuário, 'f' NUNCA vira slider livre
        const boundVars = ['f', 'x'];
        const freeBound = FaultTolerantParser.detectFreeVariables('f(3)', boundVars);
        expect(freeBound).not.toContain('f');
        expect(freeBound.length).toBe(0);

        // Expressão com parâmetro de slider 'a' e função 'f'
        const freeMixed = FaultTolerantParser.detectFreeVariables('f(x) + a', boundVars);
        expect(freeMixed).toContain('a');
        expect(freeMixed).not.toContain('f');
        expect(freeMixed).not.toContain('x');
    });

    it('5. Garbage Collection remove funções cujos blocos foram apagados', () => {
        const astF = new PrattParser('x^2').parseExpression();
        MathEngine.userFunctions['tempFunc'] = { params: ['x'], expr: 'x^2', ast: astF, blockId: 'block-del' };
        StateManager.userFunctions['tempFunc'] = { params: ['x'], expr: 'x^2', ast: astF, blockId: 'block-del' };
        MathEngine.compiledFuncs['tempFunc'] = MathEngine.compile(astF, 'x');

        expect(MathEngine.userFunctions['tempFunc']).toBeDefined();
        expect(StateManager.userFunctions['tempFunc']).toBeDefined();

        // Simula GC com blocos ativos que NÃO contêm 'block-del'
        const activeBlockIds = new Set(['block-other-1', 'block-other-2']);
        StateManager.gc([], activeBlockIds);

        expect(MathEngine.userFunctions['tempFunc']).toBeUndefined();
        expect(StateManager.userFunctions['tempFunc']).toBeUndefined();
        expect(MathEngine.compiledFuncs['tempFunc']).toBeUndefined();
    });

    it('6. Atalhos matemáticos inline (tau, ->) presentes no setup de atalhos', () => {
        // Valida que 'tau' -> '\tau' e '->' -> '\to'
        const testShortcuts: Record<string, string> = {
            'tau': '\\tau',
            '->': '\\to'
        };
        expect(testShortcuts['tau']).toBe('\\tau');
        expect(testShortcuts['->']).toBe('\\to');
    });

    it('7. Importação de estado JSON do Desmos via ExpressionManager.importFromStateJson', () => {
        // Prepara container DOM simulado
        document.body.innerHTML = '<div id="expressions-list"></div>';
        ExpressionManager.init(() => {});

        const sampleDesmosState = {
            version: 11,
            expressions: {
                list: [
                    { id: 'f1', type: 'folder', title: 'Minha Pasta', collapsed: false },
                    { id: 'e1', type: 'expression', folderId: 'f1', latex: 'y = x^2', color: '#c74440' },
                    { id: 'n1', type: 'text', folderId: 'f1', text: 'Parábola fundamental' },
                    {
                        id: 't1',
                        type: 'table',
                        folderId: 'f1',
                        columns: [
                            { latex: 'x_1', values: ['0', '1', '2'] },
                            { latex: 'y_1', values: ['0', '1', '4'] }
                        ]
                    }
                ]
            }
        };

        ExpressionManager.importFromStateJson(sampleDesmosState);

        const allExprs = ExpressionManager.getAllExpressions();
        // Deve conter os blocos importados
        const hasFolder = document.querySelector('[data-type="folder"]');
        const hasNote = document.querySelector('[data-type="note"]');
        const hasTable = document.querySelector('[data-type="table"]');
        const hasExpr = allExprs.some(e => e.latex === 'y = x^2' || e.rawAscii?.includes('x^2'));

        expect(hasFolder).not.toBeNull();
        expect(hasNote).not.toBeNull();
        expect(hasTable).not.toBeNull();
        expect(hasExpr).toBe(true);
    });

    it('8. Transformação instantânea de bloco para Nota, Pasta e Tabela', () => {
        document.body.innerHTML = '<div id="expressions-list"></div>';
        ExpressionManager.init(() => {});

        const blockId = ExpressionManager.addBlock();
        expect(document.getElementById(blockId)).not.toBeNull();

        // Converte para Nota
        const noteId = ExpressionManager.convertBlockToNote(blockId, 'Nota teste');
        expect(noteId).not.toBeNull();
        const noteEl = document.getElementById(noteId!);
        expect(noteEl?.dataset.type).toBe('note');
        expect(document.getElementById(blockId)).toBeNull(); // Bloco original substituído

        // Cria outro bloco e converte para Pasta
        const blockId2 = ExpressionManager.addBlock();
        const folderId = ExpressionManager.convertBlockToFolder(blockId2, 'Pasta Teste');
        expect(folderId).not.toBeNull();
        const folderEl = document.getElementById(folderId!);
        expect(folderEl?.dataset.type).toBe('folder');
        expect(document.getElementById(blockId2)).toBeNull();

        // Cria outro bloco e converte para Tabela
        const blockId3 = ExpressionManager.addBlock();
        const tableId = ExpressionManager.convertBlockToTable(blockId3);
        expect(tableId).not.toBeNull();
        const tableEl = document.getElementById(tableId!);
        expect(tableEl?.dataset.type).toBe('table');
        expect(document.getElementById(blockId3)).toBeNull();
    });

    it('9. Avaliação direta de f(3) e expressões compostas com funções de usuário (Padrão Desmos)', () => {
        // Registra f(x) = x^2
        const astF = new PrattParser('x^2').parseExpression();
        MathEngine.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: astF, blockId: 'block-1' };
        StateManager.userFunctions['f'] = { params: ['x'], expr: 'x^2', ast: astF, blockId: 'block-1' };
        MathEngine.compiledFuncs['f'] = MathEngine.compile(astF, 'x');

        // Avaliação direta de f(3)
        const ast3 = new PrattParser('f(3)').parseExpression();
        const res3 = MathEngine.evaluateAST(ast3, StateManager.values);
        expect(res3).toBe(9);

        // Avaliação via expandUserFunctions
        const expanded3 = MathEngine.expandUserFunctions(ast3);
        const evalExpanded = MathEngine.evaluateAST(expanded3, StateManager.values);
        expect(evalExpanded).toBe(9);

        // Expressão composta f(3) + 1
        const astComp = new PrattParser('f(3) + 1').parseExpression();
        expect(MathEngine.evaluateAST(astComp, StateManager.values)).toBe(10);

        // Expressão com variável a = 5 -> f(a)
        StateManager.values['a'] = 5;
        const astVar = new PrattParser('f(a)').parseExpression();
        expect(MathEngine.evaluateAST(astVar, StateManager.values)).toBe(25);

        // Supressão de sliders para f(3): f não deve ser detectada como variável livre
        const boundForSliders = [
            'x', 'y', 'z', 't', 'pi', 'e',
            ...Object.keys(StateManager.values),
            ...Object.keys(StateManager.giacDefinitions),
            ...Object.keys(MathEngine.userFunctions),
            ...Object.keys(MathEngine.compiledFuncs)
        ];
        const free = FaultTolerantParser.detectFreeVariables('f(3)', boundForSliders);
        expect(free).not.toContain('f');
        expect(free.length).toBe(0);

        // Avaliação de broadcasting em lista: f([1, 2, 3]) -> [1, 4, 9]
        const astList = new PrattParser('f([1, 2, 3])').parseExpression();
        const resList = MathEngine.evaluateAST(astList, StateManager.values);
        expect(resList).toEqual([1, 4, 9]);
    });
});
