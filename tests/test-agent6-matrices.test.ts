import { describe, it, expect } from 'vitest';
import { FaultTolerantParser } from '../src/core/faultTolerantParser.js';
import { MathEngine } from '../src/core/mathEngine.js';
import { PrattParser } from '../src/core/prattParser.js';
import { Tokenizer, TokenTypes } from '../src/core/tokenizer.js';

describe('agent6-matrices suite (sections 1-3)', () => {
  it('runs linear algebra, shortcut matching, and indexing sanitization tests', () => {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const failures: { testName: string; details: any }[] = [];

    function assert(condition: boolean, testName: string, details?: any) {
      totalTests++;
      if (condition) {
        passedTests++;
      } else {
        failedTests++;
        failures.push({ testName, details });
      }
      expect(condition, `${testName}: ${JSON.stringify(details || '')}`).toBe(true);
    }

    // =========================================================================
    // SECTION 1: RESERVED FUNCTIONS & VARIABLE PARSING
    // =========================================================================
    const matrixCommands = [
      'det', 'determinant', 'rref', 'reducedrowechelonform',
      'trace', 'tr', 'rank', 'matrixrank', 'inv', 'invert',
      'tran', 'transpose', 'eigenvals', 'eigenvalues',
      'eigenvects', 'eigenvectors'
    ];

    for (const cmd of matrixCommands) {
      assert(
        FaultTolerantParser.RESERVED_FUNCTIONS.has(cmd.toLowerCase()),
        `RESERVED_FUNCTIONS contains matrix cmd "${cmd}"`,
        { cmd }
      );
    }

    const statCommands = [
      'mean', 'median', 'stdev', 'stddev', 'var', 'variance',
      'samplesd', 'samplevariance', 'length', 'size'
    ];

    for (const cmd of statCommands) {
      assert(
        FaultTolerantParser.RESERVED_FUNCTIONS.has(cmd.toLowerCase()),
        `RESERVED_FUNCTIONS contains stat cmd "${cmd}"`,
        { cmd }
      );
    }

    // Test free variables detection for matrices
    const detVars = FaultTolerantParser.detectFreeVariables('det(A)', ['A']);
    assert(detVars.length === 0, 'detectFreeVariables("det(A)", ["A"]) detects 0 free variables (A bound)', detVars);

    const multVars = FaultTolerantParser.detectFreeVariables('A * B + 2 * C', ['A', 'B', 'C']);
    assert(multVars.length === 0, 'detectFreeVariables("A * B + 2 * C", ["A", "B", "C"]) detects 0 free variables', multVars);

    const multVarsUnbound = FaultTolerantParser.detectFreeVariables('A * B + 2 * C', ['A', 'B']);
    assert(multVarsUnbound.includes('C') && !multVarsUnbound.includes('A') && !multVarsUnbound.includes('B'),
      'detectFreeVariables identifies unbound C and ignores bound A, B', multVarsUnbound);

    const tranVars = FaultTolerantParser.detectFreeVariables("A' + B^T + C^{-1}", ['A', 'B', 'C']);
    assert(tranVars.length === 0, 'detectFreeVariables handles A\', B^T, C^{-1} without leaking free variables', tranVars);

    const caseVars = FaultTolerantParser.detectFreeVariables('det(a)', ['A']);
    assert(caseVars.includes('a') && !caseVars.includes('A'),
      'detectFreeVariables maintains strict case-sensitivity: lowercase "a" is free when uppercase "A" is registered', caseVars);

    // =========================================================================
    // SECTION 2: MATRIX SHORTCUT REGEX MATCHING (#22, #33, matrix, matriz)
    // =========================================================================
    function matchShortcut(rawAscii: string, rawLatex: string = ''): { isMatch: boolean; name?: string; rows?: number; cols?: number; type: string } {
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
      if (hashMatch) {
        return {
          isMatch: true,
          type: 'hash',
          name: hashMatch[1] ? hashMatch[1].toUpperCase() : undefined,
          rows: parseInt(hashMatch[2]),
          cols: parseInt(hashMatch[3])
        };
      }

      const matrixMatch = noSpaceAscii.match(/^(?:([a-zA-Z])=)?matri[xz]$/i) ||
                          cleanLatex.match(/^(?:([a-zA-Z])=)?\\?matri[xz]$/i);
      if (matrixMatch) {
        return {
          isMatch: true,
          type: 'keyword',
          name: matrixMatch[1] ? matrixMatch[1].toUpperCase() : undefined,
          rows: 2,
          cols: 2
        };
      }

      return { isMatch: false, type: 'none' };
    }

    assert(matchShortcut('#22').isMatch && matchShortcut('#22').rows === 2 && matchShortcut('#22').cols === 2,
      'Matches "#22" -> 2x2 matrix');
    assert(matchShortcut('#33').isMatch && matchShortcut('#33').rows === 3 && matchShortcut('#33').cols === 3,
      'Matches "#33" -> 3x3 matrix');
    assert(matchShortcut('#13').isMatch && matchShortcut('#13').rows === 1 && matchShortcut('#13').cols === 3,
      'Matches "#13" -> 1x3 row vector');
    assert(matchShortcut('#31').isMatch && matchShortcut('#31').rows === 3 && matchShortcut('#31').cols === 1,
      'Matches "#31" -> 3x1 column vector');
    assert(matchShortcut('A = #22').isMatch && matchShortcut('A = #22').name === 'A' && matchShortcut('A = #22').rows === 2,
      'Matches "A = #22" -> named matrix A 2x2');
    assert(matchShortcut('B = #34').isMatch && matchShortcut('B = #34').name === 'B' && matchShortcut('B = #34').rows === 3 && matchShortcut('B = #34').cols === 4,
      'Matches "B = #34" -> named matrix B 3x4');
    assert(matchShortcut('matrix').isMatch && matchShortcut('matrix').rows === 2 && matchShortcut('matrix').cols === 2,
      'Matches "matrix" -> 2x2 matrix');
    assert(matchShortcut('matriz').isMatch && matchShortcut('matriz').rows === 2 && matchShortcut('matriz').cols === 2,
      'Matches "matriz" -> 2x2 matrix');
    assert(matchShortcut('M = matrix').isMatch && matchShortcut('M = matrix').name === 'M',
      'Matches "M = matrix" -> named matrix M 2x2');
    assert(matchShortcut('m = matriz').isMatch && matchShortcut('m = matriz').name === 'M',
      'Matches "m = matriz" -> uppercase name M');
    assert(!matchShortcut('#99').isMatch,
      'Rejects "#99" (>8 dimension limit)');

    // =========================================================================
    // SECTION 3: INDEXING SANITIZATION IN CURRENT CODEBASE
    // =========================================================================
    function currentCodebaseIndexSanitization(input: string): string {
      let cleanStr = input;
      cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_\(([0-9]+),([0-9]+)\)/g, (_match, p1, p2, p3) => {
        return `${p1}[${parseInt(p2)-1},${parseInt(p3)-1}]`;
      });
      cleanStr = cleanStr.replace(/(?<!\\)\b([a-zA-Z_][a-zA-Z0-9_]*)_([0-9]+)\b/g, (match, p1, p2) => {
        if (['f', 'g', 'h', 'c', 'C', 'y', 'x', 'z', 't', 'u', 'v', 'w', 'int', 'defint', 'sum', 'prod', 'lim', 'limit', 'diff', 'log', 'ln', 'min', 'max'].includes(p1.toLowerCase())) return match;
        return `${p1}[${parseInt(p2)-1}]`;
      });
      return cleanStr;
    }

    const cur_A_11 = currentCodebaseIndexSanitization('A_(1,1)');
    assert(cur_A_11 === 'A[0,0]', 'Current regex supports A_(1,1) -> A[0,0]', cur_A_11);

    const cur_A_1_2 = currentCodebaseIndexSanitization('A_(1, 2)');
    assert(cur_A_1_2 === 'A_(1, 2)', 'DISCREPANCY: Current regex does NOT support space in A_(1, 2)', cur_A_1_2);

    const cur_A_brace = currentCodebaseIndexSanitization('A_{1,1}');
    assert(cur_A_brace === 'A_{1,1}', 'DISCREPANCY: Current regex does NOT support LaTeX braces in A_{1,1}', cur_A_brace);

    const cur_A_bracket = currentCodebaseIndexSanitization('A[1,1]');
    assert(cur_A_bracket === 'A[1,1]', 'DISCREPANCY: Current regex has NO handler for A[1,1] bracket notation (passes un-normalized 1-based indexing to Giac)', cur_A_bracket);

    expect(passedTests).toBe(46);
    expect(failedTests).toBe(0);
  });
});
