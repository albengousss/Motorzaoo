import 'mathlive';
import { PrattParser } from './core/prattParser';
import { StateManager } from './core/stateManager';
import { MathEngine } from './core/mathEngine';
import { ImplicitEngine } from './core/implicitEngine';
import { Renderer } from './graphics/renderer';
import { Camera } from './graphics/camera';
import { ExpressionManager } from './ui/expressionManager';
import { MathAnalyzer } from './core/analyzer'; 
import { ODESolver } from './core/odeSolver';

const renderer = new Renderer('graphCanvas');
const colors = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#fa7e19'];

let isShiftDown = false;
let mouseX = 0; let mouseY = 0;
let hoverX = false; let hoverY = false;

let renderMemory_points: {mathX: number, mathY: number}[] = [];
let renderMemory_curves: {f: (x: number) => number}[] = [];

const tooltip = document.createElement('div');
tooltip.style.cssText = 'position: fixed; background: rgba(0, 0, 0, 0.75); color: white; padding: 4px 8px; border-radius: 4px; font-family: sans-serif; font-size: 13px; pointer-events: none; display: none; z-index: 2000; transform: translate(-50%, -100%); margin-top: -12px; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0px 2px 4px rgba(0,0,0,0.2);';
document.body.appendChild(tooltip);

function drawFrame() {
    renderer.resize();
    renderer.clear();
    renderer.drawAxes(hoverX, hoverY);

    renderMemory_points = [];
    renderMemory_curves = [];

    // Clear function cache to remove deleted EDOs/functions
    MathEngine.compiledFuncs = {};

    const rawData = ExpressionManager.getAllExpressions();
    const validEquations: {id: string, ast: any, isImplicit: boolean, operator: string, isEdo: boolean, isDerivative: boolean, derivVar?: string, isIvp?: boolean, name?: string, x0?: number, y0?: number, isHidden?: boolean, variable?: string}[] = [];
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
            .replace(/\\cdot/g, '*');

        // Normalização de plicas (derivadas)
        cleanStr = cleanStr
            .replace(/\^\s*\{\s*\\prime\s*\}/g, "'")
            .replace(/\^\s*\{\s*'\s*\}/g, "'")   // captura y^{'}
            .replace(/\^\s*\(\s*'\s*\)/g, "'")   // captura y^(')
            .replace(/\^\s*'/g, "'")             // captura y^'
            .replace(/\\prime/g, "'")
            .replace(/[´`’′]/g, "'")
            .replace(/″/g, "''");

        // Convert d/dx(expr) to diff(expr, x)
        cleanStr = cleanStr.replace(/(?:\\frac\{d\}\{d([a-zA-Z_])\}|d\/d([a-zA-Z_])|\(d\)\/\(d([a-zA-Z_])\))\s*\(([^)]+)\)/g, 'diff($4, $1$2$3)');

        // Versão sem espaços APENAS para os testes de Regex (EDO, IVP, Associações)
        const noSpaceStr = cleanStr.replace(/\s+/g, '');

        // Parsing inicial para descobrir o tipo de comando
        let ast: any = null;
        try {
            ast = new PrattParser(cleanStr).parseExpression();
        } catch(e) {}

        if (ast && MathEngine.isGiacCommand(ast)) {
            const giacQuery = MathEngine.formatForGiac(ast);
            ExpressionManager.setResult(item.id, 'Calculando...');
            MathEngine.askGiac(giacQuery).then(res => {
                const cleanResult = res.replace(/"/g, '');
                ExpressionManager.setResult(item.id, `= ${cleanResult}`);
            });
            return;
        }

        // 2. EQUAÇÕES DIFERENCIAIS E COMANDOS CAS GENÉRICOS
        let isEdo = false;
        let edoNameMatch = '';
        let edoExpr = '';

        const campoMatch = noSpaceStr.match(/^(?:campovetorial|slopefield|campo)\((.+)\)$/i);
        const solveMatch = noSpaceStr.match(/^(?:solveode|resolvere|resolveredo|edo)\((.+)\)$/i);
        // Universal CAS command detector (e.g. Factor, Simplify, Substitute, etc.)
        const genericCasMatch = noSpaceStr.match(/^([A-Za-z]+)\((.*)\)$/);
        
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
            'samplesd', 'covariance', 'variance', 'samplevariance',
            'mean', 'median', 'unique', 'frequency',
            'fitpoly', 'fitpow', 'fitexp', 'fitsin', 'fitlog', 'normalize',
            'setseed', 'randomuniform', 'randombetween', 'shuffle', 'randomelement', 'sample', 'randompolynomial',
            'sequence', 'iterationlist', 'element', 'first', 'last', 'take', 'append', 'flatten', 'length',
            'sum', 'product', 'rootlist',
            'tocomplex', 'topoint', 'topolar', 'toexponential',
            'intersect', 'radius', 'distance', 'angle', 'perpendicularbisector', 'applymatrix', 'reflect', 'rotate', 'shear', 'stretch', 'translate', 'infinitecone', 'surdtext', 'setviewdirection', 'setvisibleinview', 'attachcopytoview', 'setdecoration'
        ]);

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
                    validEquations.push({ id: item.id, ast: cached.ast, isImplicit: false, isEdo: false, name: cached.name, operator: '=', isDerivative: false, isHidden: !item.visible });
                    
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
                        const cleanResult = res.replace(/"/g, '').replace(/list\[/g, '[');
                        
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
                                
                                // Auto-spawn da função explícita
                                const cleanFnName = nextName.replace(/[\{\}\\]/g, '');
                                const expressionStr = `${cleanFnName}(x) = ${finalExpr}`;
                                
                                let spawnedId = StateManager.odeSolutions[item.id]?.spawnedBlockId;
                                if (spawnedId && document.getElementById(spawnedId)) {
                                    ExpressionManager.updateExpression(spawnedId, expressionStr);
                                } else {
                                    spawnedId = ExpressionManager.addExpression(expressionStr);
                                }
                                
                                StateManager.odeSolutions[item.id] = { query: currentQuery, name: nextName, expr: finalExpr, ast, index: idx, spawnedBlockId: spawnedId };
                            } catch(e) {
                                StateManager.odeSolutions[item.id] = { query: currentQuery, name: 'Erro', expr: 'Parse falhou', ast: null, index: -1 };
                            }
                        }
                        drawFrame();
                    });
                }
            }
            return; // Interrompe para não renderizar mais nada como texto
        } else if (genericCasMatch && casCommandsList.has(genericCasMatch[1].toLowerCase())) {
            const cmdName = genericCasMatch[1].toLowerCase();
            const cmdArgs = genericCasMatch[2];
            const currentQuery = `${cmdName}(${cmdArgs})`;

            const cached = StateManager.casSolutions[item.id];
            if (cached && cached.query === currentQuery) {
                if (cached.name && cached.variable && !cached.result.startsWith('Erro')) {
                    ExpressionManager.setResult(item.id, `= ${cached.name}(${cached.variable}) = ${cached.result}`);
                } else {
                    ExpressionManager.setResult(item.id, `= ${cached.result}`);
                }
                
                if (cached.ast) {
                    validEquations.push({ id: item.id, ast: cached.ast, isImplicit: false, isEdo: false, name: cached.name || '', operator: '=', isDerivative: false, isHidden: !item.visible });
                    
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
                        ExpressionManager.setResult(item.id, `Erro CAS`);
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

                    // Mapeia comandos GeoGebra para Giac nativo!
                    let giacCommand = currentQuery;
                    if (cmdName === 'derivative' || cmdName === 'nderivative') giacCommand = `diff(${cmdArgs})`;
                    else if (cmdName === 'implicitderivative') {
                        // ImplicitDerivative(x^2 + y^2, y, x) -> diff(expr, x)/diff(expr, y)*(-1)
                        const args = cmdArgs.split(',').map(s => s.trim());
                        if (args.length === 1) {
                            giacCommand = `-(diff(${args[0]}, x))/(diff(${args[0]}, y))`;
                        } else if (args.length === 3) {
                            giacCommand = `-(diff(${args[0]}, ${args[2]}))/(diff(${args[0]}, ${args[1]}))`;
                        }
                    }
                    else if (cmdName === 'integral' || cmdName === 'integralsymbolic' || cmdName === 'nintegral') giacCommand = `integrate(${cmdArgs})`;
                    else if (cmdName === 'integralbetween') {
                        // IntegralBetween(f, g, a, b)
                        const args = cmdArgs.split(',').map(s => s.trim());
                        if (args.length === 4) giacCommand = `integrate(${args[0]} - (${args[1]}), x, ${args[2]}, ${args[3]})`;
                        else if (args.length === 5) giacCommand = `integrate(${args[0]} - (${args[1]}), ${args[2]}, ${args[3]}, ${args[4]})`;
                    }
                    else if (cmdName === 'limitabove') giacCommand = `limit(${cmdArgs}, 1)`;
                    else if (cmdName === 'limitbelow') giacCommand = `limit(${cmdArgs}, -1)`;
                    else if (cmdName === 'completesquare') giacCommand = `canonical_form(${cmdArgs})`;
                    else if (cmdName === 'nsolve' || cmdName === 'nsolutions') giacCommand = `fsolve(${cmdArgs})`;
                    else if (cmdName === 'solutions') giacCommand = `solve(${cmdArgs})`;
                    else if (cmdName === 'cross') giacCommand = `cross_point(${cmdArgs})`; 
                    else if (cmdName === 'dot') giacCommand = `dot_product(${cmdArgs})`;
                    else if (cmdName === 'primefactors') giacCommand = `ifactors(${cmdArgs})`;
                    else if (cmdName === 'matrixrank') giacCommand = `rank(${cmdArgs})`;
                    else if (cmdName === 'reducedrowechelonform') giacCommand = `rref(${cmdArgs})`;
                    else if (cmdName === 'nsolveode') {
                        // NSolveODE is complicated (needs lists of variables).
                        // Fallback to desolve for now
                        giacCommand = `desolve(${cmdArgs})`;
                    }
                    
                    MathEngine.askGiac(giacCommand).then(res => {
                        StateManager.pendingCas[item.id] = false;
                        if (res.includes('carregar')) {
                            ExpressionManager.setResult(item.id, `(A carregar motor...)`);
                            StateManager.pendingCas[item.id] = false;
                        } else if (res.includes('Erro') || res.includes('ausente') || res.includes('Mock')) {
                            StateManager.casSolutions[item.id] = { query: currentQuery, result: 'Erro no cálculo' };
                            ExpressionManager.setResult(item.id, `Erro CAS`);
                        } else {
                            // Limpa as aspas do Giac
                            let cleanResult = res.replace(/"/g, '').replace(/list\[/g, '[');
                            let ast = null;
                            let idx = undefined;
                            let fname = undefined;
                            
                            try { 
                                ast = new PrattParser(cleanResult).parseExpression();
                                // Se o parse deu certo e é uma expressão, vamos dar um nome f_n!
                                idx = StateManager.getNextFuncIndex();
                                fname = `f_{${idx}}`;
                            } catch(e) {}
                            
                            StateManager.casSolutions[item.id] = { query: currentQuery, result: cleanResult, ast, name: fname, variable: extractVar, index: idx };
                        }
                        drawFrame();
                    });
                }
            }
            return; // Interrompe para não renderizar o gráfico disto
        } else {
            // Detecção fallback (legado)
            const eqIndex = noSpaceStr.indexOf('=');
            if (eqIndex > 0) {
                const leftSide = noSpaceStr.substring(0, eqIndex);
                const rightSideClean = cleanStr.substring(cleanStr.indexOf('=') + 1);
                
                if (leftSide.endsWith("'")) {
                    isEdo = true;
                    edoNameMatch = leftSide.substring(0, leftSide.length - 1).replace(/[\{\}\\]/g, '');
                    edoExpr = rightSideClean;
                } else if (leftSide.startsWith("d") && leftSide.endsWith("/dx")) {
                    isEdo = true;
                    edoNameMatch = leftSide.substring(1, leftSide.length - 3).replace(/[\{\}\(\)\\]/g, '');
                    edoExpr = rightSideClean;
                } else if (leftSide.match(/^\\frac\{d([a-zA-Z_][a-zA-Z0-9_\{\}]*)\}\{dx\}$/)) {
                    isEdo = true;
                    const m = leftSide.match(/^\\frac\{d([a-zA-Z_][a-zA-Z0-9_\{\}]*)\}\{dx\}$/);
                    if (m) edoNameMatch = m[1].replace(/[\{\}\\]/g, '');
                    edoExpr = rightSideClean;
                }
            }
        }

        if (isEdo) {
            if (edoNameMatch === 'y') edoNameMatch = 'y'; 
            try {
                const astEdo = new PrattParser(edoExpr).parseExpression();
                validEquations.push({ id: item.id, ast: astEdo, isImplicit: false, isEdo: true, name: edoNameMatch, operator: '=', isDerivative: false, isHidden: !item.visible });
                ExpressionManager.setResult(item.id, `Campo Vetorial (${edoNameMatch}')`);
            } catch(e) {
                ExpressionManager.setResult(item.id, `Erro EDO: ${(e as Error).message}`);
            }
            return;
        }

        // 2.5. PROBLEMA DE VALOR INICIAL (IVP)
        const ivpMatch = noSpaceStr.match(/^([a-zA-Z_][a-zA-Z0-9_\{\}]*)\(([\d\.\-]+)\)=([\d\.\-]+)$/);
        if (ivpMatch) {
            let edoName = ivpMatch[1].replace(/[\{\}\\]/g, '');
            const x0 = parseFloat(ivpMatch[2]);
            const y0 = parseFloat(ivpMatch[3]);
            validEquations.push({ id: item.id, isImplicit: false, isEdo: false, isDerivative: false, isIvp: true, name: edoName, x0, y0, ast: null, operator: '=', isHidden: !item.visible });
            ExpressionManager.setResult(item.id, `Curva de Solução (${edoName})`);
            return;
        }

        // 3. FUNÇÕES CUSTOMIZADAS E DERIVADAS SALVAS
        const funcMatch = cleanStr.match(/^\\?([a-zA-Z_][a-zA-Z0-9_\{\}]*)\(([a-zA-Z])\)=(.+)$/);
        if (funcMatch) {
            const funcName = funcMatch[1].replace(/[\{\}\\]/g, ''); 
            const paramName = funcMatch[2];
            const expr = funcMatch[3];
            try {
                const derivMatch = expr.match(/^(?:\\frac\{d\}\{d([a-zA-Z])\}|d\/d([a-zA-Z])|\(d\)\/\(d([a-zA-Z])\))(.+)$/);
                if (derivMatch) {
                    const derivVar = derivMatch[1] || derivMatch[2] || derivMatch[3];
                    const derivExpr = derivMatch[4];
                    const ast = new PrattParser(derivExpr).parseExpression();
                    MathEngine.compiledFuncs[funcName] = MathEngine.createDerivativeFunction(ast, derivVar);
                } else {
                    const ast = new PrattParser(expr).parseExpression();
                    MathEngine.compiledFuncs[funcName] = MathEngine.compile(ast, paramName);
                    // Empurra para plotar!
                    validEquations.push({ id: item.id, ast, isImplicit: false, operator: '=', isEdo: false, isDerivative: false, isHidden: !item.visible, variable: paramName });
                    
                    // Envia para o Giac para poder ser integrada/derivada simbolicamente!
                    const giacDef = `${funcName}(${paramName}):=${expr}`;
                    if (StateManager.giacDefinitions[funcName] !== giacDef) {
                        StateManager.giacDefinitions[funcName] = giacDef;
                        MathEngine.askGiac(giacDef);
                    }
                }
                ExpressionManager.setResult(item.id, 'Função guardada');
            } catch(e) {}
            return; 
        }

        // 4. SLIDERS GLOBAIS
        const assignmentMatch = noSpaceStr.match(/^\\?([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/);
        if (assignmentMatch) {
            const varName = assignmentMatch[1].replace(/[\\]/g, '');
            const rightSide = assignmentMatch[2];
            // Validate using cleanStr to preserve spaces in the expression being parsed
            const rightSideClean = cleanStr.substring(cleanStr.indexOf('=') + 1);
            if (!['x', 'y', 'e', 'pi'].includes(varName) && !rightSide.includes('x') && !rightSide.includes('y')) {
                activeVars.push(varName);
                try {
                    const parser = new PrattParser(rightSideClean);
                    StateManager.defineVariable(varName, parser.parseExpression());
                    ExpressionManager.processBlockState(item.id, ascii, StateManager.values);
                    ExpressionManager.setResult(item.id, ''); 
                    
                    // Envia variável para o Giac!
                    const giacDef = `${varName}:=${rightSideClean}`;
                    if (StateManager.giacDefinitions[varName] !== giacDef) {
                        StateManager.giacDefinitions[varName] = giacDef;
                        MathEngine.askGiac(giacDef);
                    }
                } catch (e) {}
                return; 
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
            
            if (expressaoPlot.startsWith('y=')) {
                expressaoPlot = expressaoPlot.substring(2);
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
                        } else if (implicitMatch[1].includes('y') && implicitMatch[1] !== 'y') {
                            isImplicit = true; 
                        } else if (implicitMatch[1].includes('x')) {
                            isImplicit = true;
                        }
                    } else if (!expressaoPlot.includes('x') && expressaoPlot.includes('y')) {
                        expressaoPlot = `x-(${expressaoPlot})`;
                        isImplicit = true;
                        operator = '=';
                    }
                }
            }

            const ast = new PrattParser(expressaoPlot).parseExpression();

            // MODO CALCULADORA (Sem gráficos)
            const isPlot = expressaoPlot.includes('x') || expressaoPlot.includes('y');
            if (!isPlot && !isImplicit && !isDerivativePlot && !isExplicitY) {
                const evalFunc = MathEngine.compile(ast);
                const val = evalFunc(0, 0, StateManager.values);
                if (!isNaN(val)) ExpressionManager.setResult(item.id, '= ' + parseFloat(val.toFixed(4)).toString());
                else ExpressionManager.setResult(item.id, '');
                return; 
            } else {
                ExpressionManager.setResult(item.id, '');
            }

            validEquations.push({ id: item.id, ast, isImplicit, operator, isEdo: false, isDerivative: isDerivativePlot, derivVar: derivVarTarget, isHidden: !item.visible });
        } catch (e) {}
    });

    // Run Garbage Collection for deleted sliders
    StateManager.gc(activeVars);

    const explicitCurves: { f: (x: number) => number, color: string }[] = [];

    // --- RENDERIZAÇÃO ---
    validEquations.forEach((item, index) => {
        if (item.isHidden) return;
        
        const color = colors[index % colors.length];

        if (item.isEdo) {
            // Desenha o slope field
            const compiledEdo = MathEngine.compile(item.ast, 'x', item.name); 
            renderer.drawSlopeField(compiledEdo, StateManager.values, color);
            // Armazena a EDO
            MathEngine.compiledFuncs[item.name + "_edo"] = compiledEdo;

        } else if (item.isIvp) {
            // Pinta a curva da solução da EDO
            const ivpItem = item as any;
            const compiledEdo = MathEngine.compiledFuncs[ivpItem.name + "_edo"];
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
            }
        } else if (item.isDerivative) {
            const derivFunc = MathEngine.createDerivativeFunction(item.ast, item.derivVar || 'x');
            const f = (x: number) => derivFunc(x, 0, StateManager.values);
            
            const pontos = [];
            const steps = 300; const dx = (Camera.xMax - Camera.xMin) / steps;
            for (let i = 0; i <= steps; i++) {
                const x = Camera.xMin + i * dx;
                pontos.push({ x, y: f(x) });
            }
            renderer.drawCurve(pontos, color);
            explicitCurves.push({ f, color });
            renderMemory_curves.push({ f }); 

        } else if (item.isImplicit) {
            const geometria = ImplicitEngine.generateImplicit(
                item.id, item.ast, item.operator, StateManager.values, 
                Camera.xMin, Camera.xMax, Camera.yMin, Camera.yMax
            );
            renderer.drawFills(geometria.fills, color);
            renderer.drawSegments(geometria.segments, color);

        } else if (Array.isArray(item.ast) && item.ast[0] === 'Integrate') {
            const funcAst = item.ast[1]; const minAst = item.ast[3]; const maxAst = item.ast[4];
            const minVal = MathEngine.evaluateAST(minAst, StateManager.values);
            const maxVal = MathEngine.evaluateAST(maxAst, StateManager.values);

            if (!isNaN(minVal) && !isNaN(maxVal)) {
                const pontos = MathEngine.generatePointsAdaptive(funcAst, minVal, maxVal, StateManager.values);
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
            const f = (x: number) => fastF(x, 0, StateManager.values);
            const pontos = MathEngine.generatePointsAdaptive(item.ast, Camera.xMin, Camera.xMax, StateManager.values, item.variable || 'x');
            
            renderer.drawCurve(pontos, color);
            explicitCurves.push({ f, color });
            renderMemory_curves.push({ f }); 
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
}

ExpressionManager.init(drawFrame);

// --- TECLADO VIRTUAL PERSONALIZADO MATHLIVE ---
setTimeout(() => {
    if ((window as any).mathVirtualKeyboard) {
        (window as any).mathVirtualKeyboard.layouts = [
            'numeric',
            {
                label: 'Motor-Calc',
                tooltip: 'EDO, Integrais e Atalhos',
                rows: [
                    [
                        { latex: "´", label: "Derivada (´)" },
                        { latex: "x" }, { latex: "y" }, { latex: "t" }, { latex: "C_0" }, { latex: "C_1" },
                        { class: 'separator w5' },
                        { insert: "Solveode(", label: "Solveode" },
                        { insert: "Integral(", label: "Integral" }
                    ],
                    [
                        { latex: "f_1" }, { latex: "f_2" }, { latex: "=" },
                        { class: 'separator w5' },
                        { insert: "Derivative(", label: "Derivative" },
                        { insert: "Slopefield(", label: "Slopefield" },
                        { class: 'action font-glyph bottom right', label: '&#x232b;', command: ['performWithFeedback', 'deleteBackward'] }
                    ],
                    [
                        { latex: "<" }, { latex: ">" }, { latex: "\\le" }, { latex: "\\ge" }, { latex: "\\neq" },
                        { class: 'separator w5' },
                        { insert: "IntegralBetween(", label: "IntDefinida" },
                        { insert: "Limit(", label: "Limit" },
                        { class: 'action font-glyph bottom right', label: '&#x23ce;', command: ['performWithFeedback', 'commit'] }
                    ]
                ]
            },
            'symbols',
            'alphabetic'
        ];
    }
}, 500);

window.addEventListener('resize', drawFrame);

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
    }
}, {passive: true});
window.addEventListener('touchmove', (e) => {
    if (!isDraggingSidebar) return;
    const dy = startY - e.touches[0].clientY; // Invertido porque o painel cresce para cima
    let newHeight = startHeight + dy;
    if (newHeight < 100) newHeight = 100;
    if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;
    sidebarEl.style.height = `${newHeight}px`;
    drawFrame();
});
window.addEventListener('touchend', () => isDraggingSidebar = false);

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

canvasEl.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; tooltip.style.display = 'none'; });
window.addEventListener('mouseup', () => isDragging = false);

canvasEl.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    if (isShiftDown) {
        const oldX = hoverX; const oldY = hoverY;
        updateHover();
        if (oldX !== hoverX || oldY !== hoverY) drawFrame();
    }

    if (isDragging) {
        Camera.pan(e.clientX - lastX, e.clientY - lastY);
        drawFrame();
    } else {
        let foundCollision = false;
        let snapPixelX = 0; let snapPixelY = 0;
        let labelText = "";

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
            const mathMouseX = Camera.toMathX(mouseX);
            for (const curve of renderMemory_curves) {
                const mathY = curve.f(mathMouseX);
                if (isNaN(mathY)) continue;

                const py = Camera.toPixelY(mathY);
                if (Math.abs(mouseY - py) < 15) {
                    foundCollision = true;
                    snapPixelX = mouseX; snapPixelY = py; 
                    labelText = `(${formatCoord(mathMouseX)}, ${formatCoord(mathY)})`;
                    break;
                }
            }
        }

        if (foundCollision) {
            tooltip.innerText = labelText;
            tooltip.style.display = 'block';
            tooltip.style.left = (rect.left + snapPixelX) + 'px';
            tooltip.style.top = (rect.top + snapPixelY - 10) + 'px';
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
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        tooltip.style.display = 'none';
    } else if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
}, {passive: false});

canvasEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
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
    if (e.touches.length === 0) isDragging = false;
});