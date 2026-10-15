import { Camera3D } from './camera3d';

export interface Surface3DItem {
    id: string;
    color: string;
    funcZ?: (x: number, y: number, s: any) => number;
    glslExpr?: string; // Para raymarching de implícitas F(x, y, z) = 0
    isImplicit: boolean;
    parametric?: (t: number, s: any) => [number, number, number];
    tMin?: number;
    tMax?: number;
    name?: string;
}

export class Renderer3D {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
    private isWebGL2: boolean = false;
    get usingWebGL2(): boolean { return this.isWebGL2; }

    // Shaders e Buffers
    private lineProgram: WebGLProgram | null = null;
    private surfaceProgram: WebGLProgram | null = null;
    private raymarchProgramCache: Record<string, WebGLProgram> = {};
    private quadBuffer: WebGLBuffer | null = null;

    // Geometria da grade e caixa
    private boxBuffer: WebGLBuffer | null = null;
    private boxVertexCount: number = 0;
    private gridBuffer: WebGLBuffer | null = null;
    private gridVertexCount: number = 0;
    private axisBuffer: WebGLBuffer | null = null;

    // Resolução da malha explícita
    private meshGridSize = 64;
    private meshVertexBuffer: WebGLBuffer | null = null;
    private meshIndexBuffer: WebGLBuffer | null = null;

    constructor(canvasId: string = 'canvas3d') {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!this.canvas) return;

        // Tenta WebGL2 primeiro; se indisponível, faz fallback para WebGL1
        let gl: any = this.canvas.getContext('webgl2', { antialias: true, alpha: true, depth: true });
        if (gl) {
            this.isWebGL2 = true;
        } else {
            gl = this.canvas.getContext('webgl', { antialias: true, alpha: true, depth: true });
            this.isWebGL2 = false;
        }

        if (!gl) {
            console.warn('[Renderer3D] WebGL não suportado.');
            return;
        }
        this.gl = gl;

        this.initGLState();
        this.initLineShader();
        this.initSurfaceShader();
        this.initBoxAndGridGeometry();
        this.initMeshGeometry();
        this.initQuadGeometry();
    }

    private initGLState() {
        const gl = this.gl!;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
        if (!this.canvas || !this.gl) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2); // limita a 2 para fluidez máxima
        const rect = parent.getBoundingClientRect();

        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        Camera3D.resize(rect.width, rect.height);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    clear() {
        if (!this.gl) return;
        this.gl.clearColor(0.98, 0.99, 1.0, 1.0); // Fundo limpo suave
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    // --- 1. SHADER E GEOMETRIA DE LINHAS (EIXOS E GRADE) ---
    private initLineShader() {
        const vs = `
            attribute vec3 a_position;
            attribute vec4 a_color;
            uniform mat4 u_viewProj;
            varying vec4 v_color;
            void main() {
                v_color = a_color;
                gl_Position = u_viewProj * vec4(a_position, 1.0);
            }
        `;
        const fs = `
            precision mediump float;
            varying vec4 v_color;
            void main() {
                gl_FragColor = v_color;
            }
        `;
        this.lineProgram = this.createProgram(vs, fs);
    }

    private initBoxAndGridGeometry() {
        const gl = this.gl!;
        const bounds = 5.0;

        // 1. Eixos principais estilo Desmos 3D: X (Vermelho), Y (Verde), Z (Azul)
        // Cores altamente saturadas e nítidas para contrastar com o fundo
        const axisData = [
            // Eixo X Negativo e Positivo (Vermelho)
            -bounds, 0, 0,  0.88, 0.22, 0.22, 0.70,
                  0, 0, 0,  0.88, 0.22, 0.22, 0.70,
                  0, 0, 0,  0.95, 0.15, 0.15, 1.0,
             bounds, 0, 0,  0.95, 0.15, 0.15, 1.0,

            // Eixo Y Negativo e Positivo (Verde)
             0, -bounds, 0, 0.12, 0.68, 0.32, 0.70,
             0,       0, 0, 0.12, 0.68, 0.32, 0.70,
             0,       0, 0, 0.10, 0.78, 0.28, 1.0,
             0,  bounds, 0, 0.10, 0.78, 0.28, 1.0,

            // Eixo Z Negativo e Positivo (Azul)
             0, 0, -bounds, 0.18, 0.45, 0.88, 0.70,
             0, 0,       0, 0.18, 0.45, 0.88, 0.70,
             0, 0,       0, 0.15, 0.50, 0.98, 1.0,
             0, 0,  bounds, 0.15, 0.50, 0.98, 1.0,
        ];
        this.axisBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.axisBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axisData), gl.STATIC_DRAW);

        // 2. Grade no plano XY principal (z = 0) estilo Desmos 3D - Linhas escuras com alto contraste
        const gridData: number[] = [];
        const step = 1.0;
        for (let i = -bounds; i <= bounds; i += step) {
            const isMajor = Math.abs(i) % 5 === 0;
            const gridColor = isMajor 
                ? [0.20, 0.26, 0.36, 0.85]  // Linha mestra escura (#334155)
                : [0.48, 0.55, 0.65, 0.55]; // Linha secundária nítida (#7b8da4)

            // Linhas paralelas a Y
            gridData.push(i, -bounds, 0, ...gridColor);
            gridData.push(i,  bounds, 0, ...gridColor);
            // Linhas paralelas a X
            gridData.push(-bounds, i, 0, ...gridColor);
            gridData.push( bounds, i, 0, ...gridColor);
        }
        this.gridBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridData), gl.STATIC_DRAW);
        this.gridVertexCount = gridData.length / 7;

        // 3. Caixa delimitadora cúbica [-5, 5]^3 com arestas escuras bem definidas
        const b = bounds;
        const boxLines = [
            -b,-b,-b,  b,-b,-b,   b,-b,-b,  b, b,-b,   b, b,-b, -b, b,-b,  -b, b,-b, -b,-b,-b,
            -b,-b, b,  b,-b, b,   b,-b, b,  b, b, b,   b, b, b, -b, b, b,  -b, b, b, -b,-b, b,
            -b,-b,-b, -b,-b, b,   b,-b,-b,  b,-b, b,   b, b,-b,  b, b, b,  -b, b,-b, -b, b, b
        ];
        const boxData: number[] = [];
        const boxColor = [0.32, 0.38, 0.48, 0.80]; // Arestas da caixa com contraste impecável
        for (let i = 0; i < boxLines.length; i += 3) {
            boxData.push(boxLines[i], boxLines[i+1], boxLines[i+2], ...boxColor);
        }
        this.boxBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxData), gl.STATIC_DRAW);
        this.boxVertexCount = boxData.length / 7;
    }

    // --- 2. SHADER E MALHA DE SUPERFÍCIES EXPLÍCITAS z = f(x, y) ---
    private initSurfaceShader() {
        const vs = `
            attribute vec3 a_position;
            attribute vec3 a_normal;
            uniform mat4 u_viewProj;
            varying vec3 v_normal;
            varying vec3 v_worldPos;
            void main() {
                v_normal = a_normal;
                v_worldPos = a_position;
                gl_Position = u_viewProj * vec4(a_position, 1.0);
            }
        `;
        const fs = `
            precision mediump float;
            varying vec3 v_normal;
            varying vec3 v_worldPos;
            uniform vec3 u_lightDir;
            uniform vec3 u_eyePos;
            uniform vec3 u_baseColor;
            uniform float u_alpha;

            void main() {
                vec3 norm = normalize(v_normal);
                if (!gl_FrontFacing) norm = -norm;

                vec3 light = normalize(u_lightDir);
                float diff = max(dot(norm, light), 0.3);
                
                vec3 view = normalize(u_eyePos - v_worldPos);
                vec3 halfDir = normalize(light + view);
                float spec = pow(max(dot(norm, halfDir), 0.0), 32.0) * 0.35;

                // Desmos 3D dual-tone: frente com cor da expressão, verso com contraste ardósia elegante
                vec3 surfaceColor = gl_FrontFacing ? u_baseColor : mix(u_baseColor * 0.65, vec3(0.18, 0.22, 0.32), 0.45);
                vec3 finalColor = surfaceColor * diff + vec3(1.0) * spec;

                gl_FragColor = vec4(finalColor, u_alpha);
            }
        `;
        this.surfaceProgram = this.createProgram(vs, fs);
    }

    private initMeshGeometry() {
        const gl = this.gl!;
        const N = this.meshGridSize;
        const indices: number[] = [];

        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const p1 = j * (N + 1) + i;
                const p2 = p1 + 1;
                const p3 = (j + 1) * (N + 1) + i;
                const p4 = p3 + 1;

                indices.push(p1, p2, p3);
                indices.push(p2, p4, p3);
            }
        }

        this.meshIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.meshVertexBuffer = gl.createBuffer();
    }

    private initQuadGeometry() {
        const gl = this.gl!;
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const quad = new Float32Array([
            -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0, -1.0,  1.0,  1.0
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    }

    // --- 3. RAYMARCHING DE EQUAÇÕES IMPLÍCITAS F(x, y, z) = 0 ---
    private getRaymarchProgram(glslExpr: string): WebGLProgram | null {
        if (this.raymarchProgramCache[glslExpr]) return this.raymarchProgramCache[glslExpr];

        const varMatches = Array.from(glslExpr.matchAll(/u_var_([a-zA-Z0-9_]+)/g)).map(m => m[1]);
        const uniqueVars = Array.from(new Set(varMatches));
        const uniformDecls = uniqueVars.map(v => `uniform float u_var_${v};`).join('\n');

        const vs = `
            attribute vec2 a_pos;
            varying vec2 v_uv;
            void main() {
                v_uv = a_pos;
                gl_Position = vec4(a_pos, 0.0, 1.0);
            }
        `;

        const fs = `
            precision highp float;
            varying vec2 v_uv;
            uniform mat4 u_invViewProj;
            uniform vec3 u_eyePos;
            uniform vec3 u_lightDir;
            uniform vec3 u_color;
            ${uniformDecls}

            float motor_pow(float b, float e) {
                if (b == 0.0) return (e == 0.0 ? 1.0 : 0.0);
                float re = floor(e + 0.5);
                if (abs(e - re) < 1e-5) {
                    float p = pow(abs(b) + 1e-9, abs(re));
                    float res = (mod(abs(re), 2.0) > 0.5) ? (b < 0.0 ? -p : p) : p;
                    return re < 0.0 ? (1.0 / max(1e-9, res)) : res;
                }
                return b < 0.0 ? -1e9 : pow(max(0.0, b), e);
            }

            // Função analítica F(x, y, z)
            float evaluateF(vec3 p) {
                float x = p.x;
                float y = p.y;
                float z = p.z;
                return ${glslExpr};
            }

            // Normal analítica por gradiente numérico (diferenças centrais)
            vec3 computeNormal(vec3 p, float eps) {
                return normalize(vec3(
                    evaluateF(p + vec3(eps, 0.0, 0.0)) - evaluateF(p - vec3(eps, 0.0, 0.0)),
                    evaluateF(p + vec3(0.0, eps, 0.0)) - evaluateF(p - vec3(0.0, eps, 0.0)),
                    evaluateF(p + vec3(0.0, 0.0, eps)) - evaluateF(p - vec3(0.0, 0.0, eps))
                ));
            }

            // Interseção raio-caixa [-5, 5]^3
            bool intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax, out float tnear, out float tfar) {
                vec3 invD = 1.0 / rd;
                vec3 t0 = (boxMin - ro) * invD;
                vec3 t1 = (boxMax - ro) * invD;
                vec3 tmin = min(t0, t1);
                vec3 tmax = max(t0, t1);
                tnear = max(max(tmin.x, tmin.y), tmin.z);
                tfar = min(min(tmax.x, tmax.y), tmax.z);
                return tfar >= max(tnear, 0.0);
            }

            void main() {
                // Reconstrói o raio da câmera a partir da matriz invertida
                vec4 nearP = u_invViewProj * vec4(v_uv, -1.0, 1.0);
                vec4 farP  = u_invViewProj * vec4(v_uv,  1.0, 1.0);
                nearP /= nearP.w;
                farP  /= farP.w;

                vec3 ro = u_eyePos;
                vec3 rd = normalize(farP.xyz - nearP.xyz);

                float tnear, tfar;
                if (!intersectBox(ro, rd, vec3(-5.0), vec3(5.0), tnear, tfar)) {
                    discard;
                }

                float t = max(tnear, 0.0);
                float stepSize = (tfar - t) / 72.0;
                float prevVal = evaluateF(ro + rd * t);
                bool hit = false;
                vec3 hitPos;

                for (int i = 0; i < 72; i++) {
                    t += stepSize;
                    if (t > tfar) break;
                    vec3 p = ro + rd * t;
                    float val = evaluateF(p);

                    // Mudança de sinal indica travessia da superfície
                    if (prevVal * val <= 0.0) {
                        // Refinamento por bissecção binária (5 iterações)
                        float ta = t - stepSize;
                        float tb = t;
                        for (int j = 0; j < 5; j++) {
                            float tm = (ta + tb) * 0.5;
                            if (evaluateF(ro + rd * ta) * evaluateF(ro + rd * tm) <= 0.0) {
                                tb = tm;
                            } else {
                                ta = tm;
                            }
                        }
                        hitPos = ro + rd * ((ta + tb) * 0.5);
                        hit = true;
                        break;
                    }
                    prevVal = val;
                }

                if (!hit) discard;

                vec3 norm = computeNormal(hitPos, 0.015);
                bool isFront = dot(norm, rd) < 0.0;
                if (!isFront) norm = -norm; // Dupla face

                vec3 light = normalize(u_lightDir);
                float diff = max(dot(norm, light), 0.3);
                vec3 view = -rd;
                vec3 halfDir = normalize(light + view);
                float spec = pow(max(dot(norm, halfDir), 0.0), 24.0) * 0.35;

                // Desmos 3D dual-tone: frente com a cor vibrante, verso com contraste de volume
                vec3 baseCol = isFront ? u_color : mix(u_color * 0.65, vec3(0.18, 0.22, 0.32), 0.45);
                vec3 col = baseCol * diff + vec3(1.0) * spec;
                gl_FragColor = vec4(col, 0.95);
            }
        `;

        const prog = this.createProgram(vs, fs);
        if (prog) {
            (prog as any)._uniformNames = uniqueVars;
            this.raymarchProgramCache[glslExpr] = prog;
        }
        return prog;
    }

    // --- RENDERIZAÇÃO PRINCIPAL DO FRAME 3D ---
    render(surfaces: Surface3DItem[], scope: Record<string, number> = {}) {
        if (!this.gl) return;
        const gl = this.gl;
        this.clear();

        const viewProj = Camera3D.viewProjMatrix;
        const invViewProj = Camera3D.invViewProjMatrix;
        const eyePos = Camera3D.eyePos;
        const lightDir = [0.4, 0.6, 0.8]; // Luz diagonal superior

        // 1. Desenha Superfícies Implícitas F(x, y, z) = 0 via Raymarching
        for (const surf of surfaces) {
            if (surf.isImplicit && surf.glslExpr) {
                this.renderImplicitRaymarch(surf, invViewProj, eyePos, lightDir, scope);
            }
        }

        // 2. Desenha Superfícies Explícitas z = f(x, y)
        for (const surf of surfaces) {
            if (!surf.isImplicit && surf.funcZ && this.surfaceProgram) {
                this.renderExplicitSurface(surf, scope, viewProj, eyePos, lightDir);
            }
        }

        // 3. Desenha Curvas Paramétricas 3D (x(t), y(t), z(t))
        for (const surf of surfaces) {
            if (surf.parametric) {
                this.renderParametricCurve(surf, scope, viewProj);
            }
        }

        // 4. Desenha Bounding Box cúbica, Grade no plano XY e Eixos RGB (sempre visíveis e nítidos)
        if (this.lineProgram) {
            gl.useProgram(this.lineProgram);
            const uVP = gl.getUniformLocation(this.lineProgram, 'u_viewProj');
            const aPos = gl.getAttribLocation(this.lineProgram, 'a_position');
            const aCol = gl.getAttribLocation(this.lineProgram, 'a_color');

            gl.uniformMatrix4fv(uVP, false, viewProj);
            gl.enableVertexAttribArray(aPos);
            gl.enableVertexAttribArray(aCol);

            // 4.1. Grade no plano XY principal (z = 0) estilo Desmos 3D
            if (this.gridBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
                gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
                gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
                gl.lineWidth(1.5);
                gl.drawArrays(gl.LINES, 0, this.gridVertexCount);
            }

            // 4.3. Caixa delimitadora cúbica [-5, 5]^3
            if (this.boxBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
                gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
                gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
                gl.lineWidth(2.0);
                gl.drawArrays(gl.LINES, 0, this.boxVertexCount);
            }

            // 4.4. Eixos X, Y, Z destacados estilo Desmos 3D
            if (this.axisBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.axisBuffer);
                gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
                gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
                gl.lineWidth(3.5);
                gl.drawArrays(gl.LINES, 0, 12);
            }
        }
    }

    private renderExplicitSurface(surf: Surface3DItem, scope: any, viewProj: Float32Array, eyePos: number[], lightDir: number[]) {
        const gl = this.gl!;
        const N = this.meshGridSize;
        const bounds = 5.0;
        const step = (bounds * 2) / N;
        const stride = N + 1;

        const zGrid = new Float32Array(stride * stride);
        const valid = new Uint8Array(stride * stride);

        // 1. Avalia Z uma única vez por vértice
        for (let j = 0; j <= N; j++) {
            const y = -bounds + j * step;
            for (let i = 0; i <= N; i++) {
                const x = -bounds + i * step;
                const p = j * stride + i;
                const val = surf.funcZ!(x, y, scope);
                if (typeof val === 'number' && isFinite(val) && !isNaN(val)) {
                    zGrid[p] = Math.max(-bounds * 2, Math.min(bounds * 2, val));
                    valid[p] = 1;
                } else {
                    zGrid[p] = 0;
                    valid[p] = 0;
                }
            }
        }

        const vertexData = new Float32Array(stride * stride * 6); // pos(3) + normal(3)
        let idx = 0;

        // 2. Monta geometria e calcula normais a partir do zGrid existente (sem re-avaliar funcZ)
        for (let j = 0; j <= N; j++) {
            const y = -bounds + j * step;
            for (let i = 0; i <= N; i++) {
                const x = -bounds + i * step;
                const p = j * stride + i;
                const z = zGrid[p];

                let dzdx = 0;
                if (i > 0 && i < N && valid[p - 1] && valid[p + 1]) {
                    dzdx = (zGrid[p + 1] - zGrid[p - 1]) / (2 * step);
                } else if (i < N && valid[p + 1]) {
                    dzdx = (zGrid[p + 1] - z) / step;
                } else if (i > 0 && valid[p - 1]) {
                    dzdx = (z - zGrid[p - 1]) / step;
                }

                let dzdy = 0;
                if (j > 0 && j < N && valid[p - stride] && valid[p + stride]) {
                    dzdy = (zGrid[p + stride] - zGrid[p - stride]) / (2 * step);
                } else if (j < N && valid[p + stride]) {
                    dzdy = (zGrid[p + stride] - z) / step;
                } else if (j > 0 && valid[p - stride]) {
                    dzdy = (z - zGrid[p - stride]) / step;
                }

                let nx = -dzdx, ny = -dzdy, nz = 1.0;
                const len = Math.hypot(nx, ny, nz) || 1.0;
                nx /= len; ny /= len; nz /= len;

                vertexData[idx++] = x;
                vertexData[idx++] = y;
                vertexData[idx++] = z;
                vertexData[idx++] = nx;
                vertexData[idx++] = ny;
                vertexData[idx++] = nz;
            }
        }

        // 3. Monta índices apenas para triângulos cujos vértices são válidos no domínio
        const dynamicIndices: number[] = [];
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const p1 = j * stride + i;
                const p2 = p1 + 1;
                const p3 = (j + 1) * stride + i;
                const p4 = p3 + 1;

                if (valid[p1] && valid[p2] && valid[p3]) {
                    dynamicIndices.push(p1, p2, p3);
                }
                if (valid[p2] && valid[p4] && valid[p3]) {
                    dynamicIndices.push(p2, p4, p3);
                }
            }
        }

        if (dynamicIndices.length === 0) return;

        gl.useProgram(this.surfaceProgram!);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

        const aPos = gl.getAttribLocation(this.surfaceProgram!, 'a_position');
        const aNorm = gl.getAttribLocation(this.surfaceProgram!, 'a_normal');
        const uVP = gl.getUniformLocation(this.surfaceProgram!, 'u_viewProj');
        const uEye = gl.getUniformLocation(this.surfaceProgram!, 'u_eyePos');
        const uLight = gl.getUniformLocation(this.surfaceProgram!, 'u_lightDir');
        const uAlpha = gl.getUniformLocation(this.surfaceProgram!, 'u_alpha');
        const uBaseCol = gl.getUniformLocation(this.surfaceProgram!, 'u_baseColor');

        gl.enableVertexAttribArray(aPos);
        gl.enableVertexAttribArray(aNorm);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 24, 12);

        gl.uniformMatrix4fv(uVP, false, viewProj);
        gl.uniform3fv(uEye, new Float32Array(eyePos));
        gl.uniform3fv(uLight, new Float32Array(lightDir));
        gl.uniform1f(uAlpha, 0.92);

        const rgbSurf = this.hexToRgb(surf.color || '#3b82f6');
        gl.uniform3fv(uBaseCol, new Float32Array(rgbSurf));

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(dynamicIndices), gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, dynamicIndices.length, gl.UNSIGNED_SHORT, 0);
    }

    private renderImplicitRaymarch(surf: Surface3DItem, invViewProj: Float32Array, eyePos: number[], lightDir: number[], scope: Record<string, number> = {}) {
        const gl = this.gl!;
        const prog = this.getRaymarchProgram(surf.glslExpr!);
        if (!prog) return;

        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);

        const aPos = gl.getAttribLocation(prog, 'a_pos');
        const uInvVP = gl.getUniformLocation(prog, 'u_invViewProj');
        const uEye = gl.getUniformLocation(prog, 'u_eyePos');
        const uLight = gl.getUniformLocation(prog, 'u_lightDir');
        const uCol = gl.getUniformLocation(prog, 'u_color');

        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(uInvVP, false, invViewProj);
        gl.uniform3fv(uEye, new Float32Array(eyePos));
        gl.uniform3fv(uLight, new Float32Array(lightDir));

        // Define uniforms de variáveis dinâmicas (sliders)
        const uniforms: string[] = (prog as any)._uniformNames || [];
        for (const vName of uniforms) {
            const val = scope[vName] !== undefined ? scope[vName] : (scope[vName.toLowerCase()] !== undefined ? scope[vName.toLowerCase()] : 0.0);
            const safe = vName.replace(/[^a-zA-Z0-9_]/g, '_');
            const loc = gl.getUniformLocation(prog, `u_var_${safe}`);
            if (loc) gl.uniform1f(loc, val);
        }

        // Cor da superfície (converte hex/nome para rgb)
        const rgb = this.hexToRgb(surf.color || '#3b82f6');
        gl.uniform3fv(uCol, new Float32Array(rgb));

        gl.disable(gl.DEPTH_TEST);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.enable(gl.DEPTH_TEST);
    }

    private renderParametricCurve(surf: Surface3DItem, scope: any, viewProj: Float32Array) {
        const gl = this.gl!;
        if (!this.lineProgram || !surf.parametric) return;

        const steps = 300;
        const t0 = surf.tMin ?? 0;
        const t1 = surf.tMax ?? (Math.PI * 4);
        const curveData: number[] = [];
        const rgb = this.hexToRgb(surf.color || '#ef4444');

        for (let i = 0; i <= steps; i++) {
            const t = t0 + (t1 - t0) * (i / steps);
            const pt = surf.parametric(t, scope);
            if (!isFinite(pt[0]) || !isFinite(pt[1]) || !isFinite(pt[2])) continue;
            curveData.push(pt[0], pt[1], pt[2], rgb[0], rgb[1], rgb[2], 1.0);
        }

        const curveBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(curveData), gl.STATIC_DRAW);

        gl.useProgram(this.lineProgram);
        const aPos = gl.getAttribLocation(this.lineProgram, 'a_position');
        const aCol = gl.getAttribLocation(this.lineProgram, 'a_color');
        const uVP = gl.getUniformLocation(this.lineProgram, 'u_viewProj');

        gl.enableVertexAttribArray(aPos);
        gl.enableVertexAttribArray(aCol);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
        gl.uniformMatrix4fv(uVP, false, viewProj);
        gl.lineWidth(3.5);
        const vertexCount = Math.floor(curveData.length / 7);
        if (vertexCount > 0) {
            gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);
        }
        gl.deleteBuffer(curveBuf);
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram | null {
        const gl = this.gl!;
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('VS Compile Error:', gl.getShaderInfoLog(vs));
            return null;
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('FS Compile Error:', gl.getShaderInfoLog(fs));
            return null;
        }

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('Program Link Error:', gl.getProgramInfoLog(prog));
            return null;
        }
        return prog;
    }

    private hexToRgb(hex: string): [number, number, number] {
        let clean = hex.replace('#', '');
        if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
        const num = parseInt(clean, 16);
        if (isNaN(num)) return [0.2, 0.5, 0.9];
        return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
    }
}
