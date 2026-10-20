import { MathEngine } from './mathEngine';
import { StateManager } from './stateManager';

export class ImplicitEngine {
    private static edges = [
        [], [[2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[0, 1], [2, 3]], [[0, 2]], [[0, 3]], 
        [[0, 3]], [[0, 2]], [[0, 3], [1, 2]], [[0, 1]], [[1, 3]], [[1, 2]], [[2, 3]], []
    ];

    private static cache: Record<string, { geometry: any, versions: Record<string, number>, bounds: string }> = {};
    static clearCache() { this.cache = {}; }

    static generateImplicit(id: string, ast: any, operator: string, scope: any, xMin: number, xMax: number, yMin: number, yMax: number) {
        const deps = StateManager.extractVariables(ast);
        let versionsMatched = true;
        
        // Verifica se a cache é válida (chave inclui o operador)
        const boundsKey = `${xMin},${xMax},${yMin},${yMax}`;
        const cacheKey = `${id}:${operator}`;
        const cached = this.cache[cacheKey];
        
        if (cached && cached.bounds === boundsKey) {
            for (const dep of deps) {
                if (cached.versions[dep] !== StateManager.varVersions[dep]) {
                    versionsMatched = false;
                    break;
                }
            }
            if (versionsMatched) return cached.geometry;
        }

        const segments: {x1:number, y1:number, x2:number, y2:number}[] = [];
        const fills: {x:number, y:number, w:number, h:number}[] = [];
        
        let quadCount = 0;
        const MAX_QUADS = 16384; 
        
        // Interval evaluator
        const intF = MathEngine.compileInterval(ast);
        // Scalar evaluator for Marching Squares
        const fastF = MathEngine.compile(ast);
        const f = (x: number, y: number) => fastF(x, y, scope);

        const processLeafQuad = (x: number, y: number, w: number, h: number) => {
            const v0 = f(x, y + h);       const v1 = f(x + w, y + h);   
            const v2 = f(x + w, y);       const v3 = f(x, y); 
            const vC = f(x + w / 2, y + h / 2);

            let caseIndex = 0;
            if (v0 > 0) caseIndex |= 8;
            if (v1 > 0) caseIndex |= 4;
            if (v2 > 0) caseIndex |= 2;
            if (v3 > 0) caseIndex |= 1;

            let lines = this.edges[caseIndex];
            // Desambiguação dos casos 5 e 10 do Marching Squares usando o valor do centro vC
            if (caseIndex === 5) {
                lines = vC > 0 ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
            } else if (caseIndex === 10) {
                lines = vC > 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
            }

            if (lines && lines.length > 0) {
                const interp = (val1: number, val2: number) => Math.abs(val1) / (Math.abs(val1) + Math.abs(val2) || 1);
                const getPoint = (edge: number) => {
                    if (edge === 0) return { x: x + w * interp(v0, v1), y: y + h }; 
                    if (edge === 1) return { x: x + w, y: y + h - h * interp(v1, v2) }; 
                    if (edge === 2) return { x: x + w - w * interp(v2, v3), y: y }; 
                    if (edge === 3) return { x: x, y: y + h - h * interp(v0, v3) }; 
                    return { x, y };
                };
                lines.forEach(line => {
                    const p1 = getPoint(line[0]); const p2 = getPoint(line[1]);
                    segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
                });
            }
            
            // Preenchimento final para inequações
            if (operator !== '=') {
                let centerSatisfied = false;
                if (operator === '<' && vC < 0) centerSatisfied = true;
                else if (operator === '<=' && vC <= 0) centerSatisfied = true;
                else if (operator === '>' && vC > 0) centerSatisfied = true;
                else if (operator === '>=' && vC >= 0) centerSatisfied = true;
                if (centerSatisfied) fills.push({ x, y, w, h });
            }
        };

        const w = (xMax - xMin);
        const h = (yMax - yMin);

        // Subdivisão em fila (BFS - Breadth-First Search) para refinamento uniforme do canvas
        const queue: { x: number, y: number, w: number, h: number }[] = [{ x: xMin, y: yMin, w, h }];
        let head = 0;

        while (head < queue.length) {
            const quad = queue[head++];
            if (head > 2048) {
                queue.splice(0, head);
                head = 0;
            }

            quadCount++;
            const qx = quad.x, qy = quad.y, qw = quad.w, qh = quad.h;

            // Avaliação Intervalar do bloco inteiro
            const xInt = { min: qx, max: qx + qw };
            const yInt = { min: qy, max: qy + qh };
            const vInt = intF(xInt, yInt, scope);

            // Verifica se a inequação é provável neste bloco
            let possible = false;
            let guaranteed = false;
            if (operator === '<') {
                if (vInt.min < 0) possible = true;
                if (vInt.max < 0) guaranteed = true;
            } else if (operator === '<=') {
                if (vInt.min <= 0) possible = true;
                if (vInt.max <= 0) guaranteed = true;
            } else if (operator === '>') {
                if (vInt.max > 0) possible = true;
                if (vInt.min > 0) guaranteed = true;
            } else if (operator === '>=') {
                if (vInt.max >= 0) possible = true;
                if (vInt.min >= 0) guaranteed = true;
            } else if (operator === '=') {
                if (vInt.min <= 0 && vInt.max >= 0) possible = true;
            }

            if (!possible) continue; // Bloco completamente fora

            if (guaranteed && operator !== '=') {
                fills.push({ x: qx, y: qy, w: qw, h: qh });
                continue; 
            }

            // Critério de parada: muito pequeno ou limite de quads alcançado
            const isTiny = (qw < (xMax - xMin) / 256) || (qh < (yMax - yMin) / 256);
            const remainingQueue = queue.length - head;
            if (!isTiny && quadCount + remainingQueue + 4 <= MAX_QUADS) {
                const hw = qw / 2; const hh = qh / 2;
                queue.push({ x: qx, y: qy + hh, w: hw, h: hh });      
                queue.push({ x: qx + hw, y: qy + hh, w: hw, h: hh }); 
                queue.push({ x: qx, y: qy, w: hw, h: hh });           
                queue.push({ x: qx + hw, y: qy, w: hw, h: hh });      
            } else {
                processLeafQuad(qx, qy, qw, qh);
            }
        }
        
        const geometry = { segments, fills };
        
        const currentVersions: Record<string, number> = {};
        deps.forEach(dep => currentVersions[dep] = StateManager.varVersions[dep] || 0);
        
        this.cache[cacheKey] = { geometry, versions: currentVersions, bounds: boundsKey };
        
        return geometry;
    }
}