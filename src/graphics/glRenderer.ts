import { Camera } from './camera';

export class GLRenderer {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext | null = null;
    private quadBuffer: WebGLBuffer | null = null;
    private programCache: Record<string, WebGLProgram> = {};
    private hasDerivatives: boolean = false;

    constructor(canvasId: string = 'webglCanvas') {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!this.canvas) return;

        // Tenta WebGL com contexto alpha para sobrepor perfeitamente com o 2D
        const gl = this.canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
        if (!gl) {
            console.warn('[GLRenderer] WebGL não suportado neste navegador.');
            return;
        }
        this.gl = gl;

        // Ativa extensão de derivadas para anti-aliasing nítido de gradiente
        const ext = gl.getExtension('OES_standard_derivatives');
        this.hasDerivatives = !!ext;

        // Buffer de quad de tela inteira
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const vertices = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Configuração de blending para misturar cores translúcidas de inequações
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
        if (!this.canvas || !this.gl) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();

        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    clear() {
        if (!this.gl) return;
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    private programUniforms: Record<string, string[]> = {};

    /** Converte nó da AST em float expression GLSL */
    static astToGLSL(node: any, scope: Record<string, number> = {}, usedUniforms?: Set<string>): string {
        if (typeof node === 'number') {
            const str = node.toString();
            return str.includes('.') ? str : str + '.0';
        }
        if (typeof node === 'string') {
            const clean = node.trim();
            if (clean === 'x') return 'x';
            if (clean === 'y') return 'y';
            if (clean === 'z') return 'z';
            if (clean === 'pi' || clean === '\\pi' || clean === 'π') return '3.141592653589793';
            if (clean === 'e') return '2.718281828459045';
            
            if (usedUniforms) {
                const safe = clean.replace(/[^a-zA-Z0-9_]/g, '_');
                usedUniforms.add(clean);
                return `u_var_${safe}`;
            }

            const val = scope[clean] !== undefined ? scope[clean] : (scope[clean.toLowerCase()] !== undefined ? scope[clean.toLowerCase()] : 0.0);
            const str = val.toString();
            return str.includes('.') ? str : str + '.0';
        }
        if (Array.isArray(node)) {
            const op = node[0];
            const L = node.length > 1 ? this.astToGLSL(node[1], scope, usedUniforms) : '0.0';
            const R = node.length > 2 ? this.astToGLSL(node[2], scope, usedUniforms) : '0.0';

            if (op === 'Add') return `(${L} + ${R})`;
            if (op === 'Subtract') return `(${L} - ${R})`;
            if (op === 'Multiply') return `(${L} * ${R})`;
            if (op === 'Divide') return `(${L} / (${R} == 0.0 ? 1e-7 : ${R}))`;
            if (op === 'Power') {
                if (typeof node[2] === 'number') {
                    const exp = node[2];
                    if (exp === 2) return `(${L} * ${L})`;
                    if (exp === 3) return `(${L} * ${L} * ${L})`;
                    if (exp === 4) return `((${L} * ${L}) * (${L} * ${L}))`;
                    if (Number.isInteger(exp)) {
                        const absExpStr = Math.abs(exp).toFixed(1);
                        const isEven = (exp % 2 === 0);
                        if (exp > 0) {
                            return isEven ? `pow(abs(${L}) + 1e-9, ${absExpStr})` : `(pow(abs(${L}) + 1e-9, ${absExpStr}) * (${L} < 0.0 ? -1.0 : 1.0))`;
                        } else {
                            const denom = isEven ? `pow(abs(${L}) + 1e-9, ${absExpStr})` : `(pow(abs(${L}) + 1e-9, ${absExpStr}) * (${L} < 0.0 ? -1.0 : 1.0))`;
                            return `(1.0 / max(1e-9, ${denom}))`;
                        }
                    } else {
                        return `(${L} < 0.0 ? -1e9 : pow(max(0.0, ${L}), ${R}))`;
                    }
                }
                return `motor_pow(${L}, ${R})`;
            }
            if (op === 'Sin') return `sin(${L})`;
            if (op === 'Cos') return `cos(${L})`;
            if (op === 'Tan') return `tan(${L})`;
            if (op === 'Sinh') return `sinh(${L})`;
            if (op === 'Cosh') return `cosh(${L})`;
            if (op === 'Tanh') return `tanh(${L})`;
            if (op === 'Asin') return `asin(clamp(${L}, -1.0, 1.0))`;
            if (op === 'Acos') return `acos(clamp(${L}, -1.0, 1.0))`;
            if (op === 'Atan') return node.length > 2 ? `atan(${L}, ${R})` : `atan(${L})`;
            if (op === 'Sec') return `(1.0 / cos(${L}))`;
            if (op === 'Csc') return `(1.0 / sin(${L}))`;
            if (op === 'Cot') return `(1.0 / tan(${L}))`;
            if (op === 'Cbrt') return `(pow(abs(${L}) + 1e-9, 1.0 / 3.0) * (${L} < 0.0 ? -1.0 : 1.0))`;
            if (op === 'Sqrt') return `sqrt(max(0.0, ${L}))`;
            if (op === 'Exp') return `exp(${L})`;
            if (op === 'Log') return `log(max(1e-8, ${L}))`;
            if (op === 'Abs') return `abs(${L})`;
            if (op === 'Negate') return `(-(${L}))`;
        }
        return '0.0';
    }

    private getOrCreateProgram(ast: any, operator: string, scope: Record<string, number>): WebGLProgram | null {
        if (!this.gl) return null;

        const usedUniforms = new Set<string>();
        const exprGLSL = GLRenderer.astToGLSL(ast, scope, usedUniforms);
        const cacheKey = `${exprGLSL}::${operator}`;

        if (this.programCache[cacheKey]) {
            return this.programCache[cacheKey];
        }

        const vsSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = (a_position + 1.0) * 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const isEquation = (operator === '=');
        let conditionCode = '';
        if (isEquation) {
            if (this.hasDerivatives) {
                conditionCode = `
                    float grad = length(vec2(dFdx(val), dFdy(val)));
                    float dist = (grad > 1e-7) ? (abs(val) / grad) : abs(val);
                    float alpha = 1.0 - smoothstep(0.0, 1.8, dist);
                    if (alpha <= 0.0) discard;
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                `;
            } else {
                conditionCode = `
                    float alpha = 1.0 - smoothstep(0.0, 0.08, abs(val));
                    if (alpha <= 0.0) discard;
                    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
                `;
            }
        } else {
            let cond = 'val <= 0.0';
            if (operator === '<') cond = 'val < 0.0';
            else if (operator === '>') cond = 'val > 0.0';
            else if (operator === '>=') cond = 'val >= 0.0';

            conditionCode = `
                if (!(${cond})) discard;
                gl_FragColor = vec4(u_color.rgb, u_color.a * 0.22);
            `;
        }

        const uniformDecls = Array.from(usedUniforms).map(v => {
            const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
            return `uniform float u_var_${safe};`;
        }).join('\n');

        const fsSource = `
            #ifdef GL_OES_standard_derivatives
            #extension GL_OES_standard_derivatives : enable
            #endif
            precision highp float;

            uniform vec4 u_bounds; // xMin, xMax, yMin, yMax
            uniform vec2 u_resolution;
            uniform vec4 u_color;
            ${uniformDecls}
            varying vec2 v_uv;

            float motor_pow(float b, float e) {
                if (b == 0.0) return (e == 0.0 ? 1.0 : 0.0);
                float re = floor(e + 0.5);
                if (abs(e - re) < 1e-5) {
                    float p = pow(abs(b) + 1e-9, abs(re));
                    bool isOdd = (floor(mod(abs(re) + 0.5, 2.0)) == 1.0);
                    float res = isOdd ? (b < 0.0 ? -p : p) : p;
                    return re < 0.0 ? (1.0 / max(1e-9, res)) : res;
                }
                return b < 0.0 ? -1e9 : pow(max(0.0, b), e);
            }

            float evalF(float x, float y) {
                return ${exprGLSL};
            }

            void main() {
                float x = mix(u_bounds.x, u_bounds.y, v_uv.x);
                float y = mix(u_bounds.z, u_bounds.w, v_uv.y);
                float val = evalF(x, y);
                ${conditionCode}
            }
        `;

        const program = this.compileProgram(vsSource, fsSource);
        if (program) {
            (program as any)._uniformNames = Array.from(usedUniforms);
            this.programCache[cacheKey] = program;
            this.programUniforms[cacheKey] = Array.from(usedUniforms);
        }
        return program;
    }

    private compileProgram(vsSource: string, fsSource: string): WebGLProgram | null {
        if (!this.gl) return null;
        const gl = this.gl;

        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('[GLRenderer] Erro no Vertex Shader:', gl.getShaderInfoLog(vs));
            return null;
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('[GLRenderer] Erro no Fragment Shader:', gl.getShaderInfoLog(fs));
            return null;
        }

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('[GLRenderer] Erro ao linkar programa:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    /**
     * Renderiza equação implícita ou inequação diretamente no WebGL
     */
    drawImplicit(ast: any, operator: string, scope: Record<string, number>, hexColor: string) {
        if (!this.gl || !this.quadBuffer) return;
        const gl = this.gl;

        const program = this.getOrCreateProgram(ast, operator, scope);
        if (!program) return;

        gl.useProgram(program);

        // Bind posições
        const aPos = gl.getAttribLocation(program, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        // Uniforms
        const uBounds = gl.getUniformLocation(program, 'u_bounds');
        gl.uniform4f(uBounds, Camera.xMin, Camera.xMax, Camera.yMin, Camera.yMax);

        const uRes = gl.getUniformLocation(program, 'u_resolution');
        gl.uniform2f(uRes, this.canvas.width, this.canvas.height);

        // Converte hex para rgba float
        const rgba = this.hexToRGBA(hexColor);
        const uColor = gl.getUniformLocation(program, 'u_color');
        gl.uniform4f(uColor, rgba[0], rgba[1], rgba[2], rgba[3]);

        // Define valores dinâmicos dos sliders (uniform float u_var_<name>)
        const uniforms: string[] = (program as any)._uniformNames || [];
        for (const vName of uniforms) {
            const val = scope[vName] !== undefined ? scope[vName] : (scope[vName.toLowerCase()] !== undefined ? scope[vName.toLowerCase()] : 0.0);
            const safe = vName.replace(/[^a-zA-Z0-9_]/g, '_');
            const loc = gl.getUniformLocation(program, `u_var_${safe}`);
            if (loc) gl.uniform1f(loc, val);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    private hexToRGBA(hex: string): [number, number, number, number] {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255,
            1.0
        ];
    }
}
