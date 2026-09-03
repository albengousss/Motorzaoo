/**
 * Câmera Orbital 3D para o Motor-Calc
 * Suporta rotação esférica (arcball), pan e zoom suaves, com eixo Z como altura (padrão cálculo/engenharia).
 */
export class Camera3D {
    // Posição e orientação da câmera
    static target: [number, number, number] = [0, 0, 0];
    static distance: number = 18;
    static theta: number = Math.PI / 4;   // 45 graus horizontal
    static phi: number = Math.PI / 6;     // 30 graus vertical
    static minDistance: number = 2;
    static maxDistance: number = 100;

    // Dimensões do viewport
    static width: number = 800;
    static height: number = 600;
    static fov: number = 45 * (Math.PI / 180); // 45 graus
    static near: number = 0.1;
    static far: number = 200.0;

    // Matrizes 4x4 (Column-Major)
    static viewMatrix: Float32Array = new Float32Array(16);
    static projMatrix: Float32Array = new Float32Array(16);
    static viewProjMatrix: Float32Array = new Float32Array(16);
    static invViewProjMatrix: Float32Array = new Float32Array(16);

    static eyePos: [number, number, number] = [0, 0, 0];

    static resize(w: number, h: number) {
        this.width = Math.max(w, 1);
        this.height = Math.max(h, 1);
        this.updateMatrices();
    }

    static reset() {
        this.target = [0, 0, 0];
        this.distance = 18;
        this.theta = Math.PI / 4;
        this.phi = Math.PI / 6;
        this.updateMatrices();
    }

    static rotate(dTheta: number, dPhi: number) {
        this.theta += dTheta;
        // Limita a elevação vertical entre -85 e 85 graus para evitar inversão brusca
        const maxPhi = 85 * (Math.PI / 180);
        this.phi = Math.max(-maxPhi, Math.min(maxPhi, this.phi + dPhi));
        this.updateMatrices();
    }

    static zoom(factor: number) {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance * factor));
        this.updateMatrices();
    }

    static pan(dx: number, dy: number) {
        // Converte movimento de pixels da tela para deslocamento no espaço do target
        const factor = (this.distance * 0.002);
        
        // Vetores laterais relativos à câmera
        const sinT = Math.sin(this.theta);
        const cosT = Math.cos(this.theta);
        const sinP = Math.sin(this.phi);
        const cosP = Math.cos(this.phi);

        // Vetor right no plano XY
        const rx = cosT;
        const ry = -sinT;
        
        // Vetor up da câmera
        const ux = -sinT * sinP;
        const uy = -cosT * sinP;
        const uz = cosP;

        this.target[0] -= (rx * dx - ux * dy) * factor;
        this.target[1] -= (ry * dx - uy * dy) * factor;
        this.target[2] -= (uz * dy) * factor;

        this.updateMatrices();
    }

    static updateMatrices() {
        // Calcula a posição do olho em coordenadas esféricas (Z para cima)
        const cosP = Math.cos(this.phi);
        const sinP = Math.sin(this.phi);
        const cosT = Math.cos(this.theta);
        const sinT = Math.sin(this.theta);

        const ex = this.target[0] + this.distance * cosP * sinT;
        const ey = this.target[1] + this.distance * cosP * cosT;
        const ez = this.target[2] + this.distance * sinP;
        this.eyePos = [ex, ey, ez];

        // 1. View Matrix (LookAt)
        this.lookAt(this.viewMatrix, this.eyePos, this.target, [0, 0, 1]);

        // 2. Projection Matrix (Perspective)
        const aspect = this.width / this.height;
        this.perspective(this.projMatrix, this.fov, aspect, this.near, this.far);

        // 3. ViewProjection = Proj * View
        this.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);

        // 4. Invert ViewProjection (usado no Raymarching de raios da câmera)
        this.invert(this.invViewProjMatrix, this.viewProjMatrix);
    }

    // --- UTILITÁRIOS MATRICIAIS 4x4 (COLUMN-MAJOR) ---
    private static lookAt(out: Float32Array, eye: [number, number, number], center: [number, number, number], up: [number, number, number]) {
        let z0 = eye[0] - center[0];
        let z1 = eye[1] - center[1];
        let z2 = eye[2] - center[2];
        let len = 1 / Math.hypot(z0, z1, z2);
        z0 *= len; z1 *= len; z2 *= len;

        let x0 = up[1] * z2 - up[2] * z1;
        let x1 = up[2] * z0 - up[0] * z2;
        let x2 = up[0] * z1 - up[1] * z0;
        len = 1 / Math.hypot(x0, x1, x2);
        x0 *= len; x1 *= len; x2 *= len;

        const y0 = z1 * x2 - z2 * x1;
        const y1 = z2 * x0 - z0 * x2;
        const y2 = z0 * x1 - z1 * x0;

        out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
        out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
        out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
        out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
        out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
        out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
        out[15] = 1;
    }

    private static perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number) {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
        out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
    }

    private static multiply(out: Float32Array, a: Float32Array, b: Float32Array) {
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                out[i * 4 + j] =
                    a[0 * 4 + j] * b[i * 4 + 0] +
                    a[1 * 4 + j] * b[i * 4 + 1] +
                    a[2 * 4 + j] * b[i * 4 + 2] +
                    a[3 * 4 + j] * b[i * 4 + 3];
            }
        }
    }

    private static invert(out: Float32Array, a: Float32Array) {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) return;
        det = 1.0 / det;

        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    }
}
