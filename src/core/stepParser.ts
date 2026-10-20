/**
 * Utilitários para parsing e formatação de passos de eixos (Step) estilo Desmos
 * Suporta múltiplos de pi (pi, \pi, π, pi/2, pi/4, 2pi, 3pi/2), frações e decimais
 */

export function parseStepInput(raw: string): number | null {
    if (!raw || !raw.trim()) return null;
    let s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/\\pi/g, 'pi').replace(/π/g, 'pi');
    if (s === 'pi') return Math.PI;
    if (s === '2pi') return 2 * Math.PI;
    if (s === 'pi/2') return Math.PI / 2;
    if (s === 'pi/4') return Math.PI / 4;
    if (s === '3pi/2' || s === '3/2pi') return 1.5 * Math.PI;
    const frac = s.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (frac) {
        const d = parseFloat(frac[2]);
        return d !== 0 ? parseFloat(frac[1]) / d : null;
    }
    const piFrac = s.match(/^(\d+(?:\.\d+)?)?pi\/(\d+(?:\.\d+)?)$/);
    if (piFrac) {
        const d = parseFloat(piFrac[2]);
        return d !== 0 ? ((piFrac[1] ? parseFloat(piFrac[1]) : 1) * Math.PI) / d : null;
    }
    const piMul = s.match(/^(\d+(?:\.\d+)?)pi$/);
    if (piMul) {
        return parseFloat(piMul[1]) * Math.PI;
    }
    const n = parseFloat(s);
    return (Number.isFinite(n) && n > 0) ? n : null;
}

export function formatStepForDisplay(val: number | null): string {
    if (!val) return '';
    if (Math.abs(val - Math.PI) < 1e-5) return 'π';
    if (Math.abs(val - Math.PI / 2) < 1e-5) return 'π/2';
    if (Math.abs(val - Math.PI / 4) < 1e-5) return 'π/4';
    if (Math.abs(val - 2 * Math.PI) < 1e-5) return '2π';
    if (Math.abs(val - 1.5 * Math.PI) < 1e-5) return '3π/2';
    return val.toString();
}
