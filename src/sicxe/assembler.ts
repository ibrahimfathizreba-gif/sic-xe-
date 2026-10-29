/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OPCODES } from './opcodes.ts';
import { formatHex20, formatHex24, toUnsigned24 } from './registers.ts';
import { AsmError, AssemblerResult, InstructionFormat, ListingLine, ObjectProgram, REGISTER_NAMES, RegisterId, SymbolEntry } from './types.ts';

interface ParsedLine {
  lineNo: number;
  rawLine: string;
  label?: string;
  mnemonic?: string;
  operand?: string;
  comment?: string;
  isFormat4: boolean;
  baseMnemonic?: string;
}

export class Assembler {
  public static assemble(source: string): AssemblerResult {
    const lines = source.split(/\r?\n/);
    const errors: AsmError[] = [];
    const warnings: string[] = [];

    // Parse source lines
    const parsedLines: ParsedLine[] = lines.map((line, idx) => {
      return this.parseLine(line, idx + 1);
    });

    // PASS 1: Calculate LOCCTR and build Symbol Table
    let locctr = 0;
    let startAddress = 0;
    let progName = 'NONAME';
    let hasStart = false;
    let hasEnd = false;
    let endOperand: string | undefined;

    const symbolTable = new Map<string, number>();
    const symbolList: SymbolEntry[] = [];
    const lineLocs: number[] = [];
    const lineLengths: number[] = [];

    for (let i = 0; i < parsedLines.length; i++) {
      const pl = parsedLines[i];
      lineLocs.push(locctr);

      if (!pl.mnemonic) {
        // Comment or empty line
        lineLengths.push(0);
        continue;
      }

      const mnemUpper = pl.mnemonic.toUpperCase();

      if (mnemUpper === 'START') {
        hasStart = true;
        if (pl.operand) {
          const parsedStart = parseInt(pl.operand, 16);
          if (isNaN(parsedStart)) {
            errors.push({ line: pl.lineNo, message: `Invalid hexadecimal START operand: ${pl.operand}` });
          } else {
            startAddress = parsedStart;
            locctr = startAddress;
            lineLocs[i] = locctr;
          }
        }
        if (pl.label) {
          progName = pl.label.slice(0, 6);
          symbolTable.set(pl.label, startAddress);
          symbolList.push({ name: pl.label, address: startAddress, definedLine: pl.lineNo });
        }
        lineLengths.push(0);
        continue;
      }

      if (mnemUpper === 'END') {
        hasEnd = true;
        endOperand = pl.operand;
        lineLengths.push(0);
        continue;
      }

      // Record label
      if (pl.label) {
        if (symbolTable.has(pl.label)) {
          errors.push({ line: pl.lineNo, message: `Duplicate label: '${pl.label}'` });
        } else {
          symbolTable.set(pl.label, locctr);
          symbolList.push({ name: pl.label, address: locctr, definedLine: pl.lineNo });
        }
      }

      // Directives and instruction lengths
      let len = 0;
      if (mnemUpper === 'WORD') {
        len = 3;
      } else if (mnemUpper === 'RESW') {
        const count = parseInt(pl.operand || '0', 10);
        if (isNaN(count) || count < 0) {
          errors.push({ line: pl.lineNo, message: `Invalid RESW operand: ${pl.operand}` });
        } else {
          len = 3 * count;
        }
      } else if (mnemUpper === 'RESB') {
        const count = parseInt(pl.operand || '0', 10);
        if (isNaN(count) || count < 0) {
          errors.push({ line: pl.lineNo, message: `Invalid RESB operand: ${pl.operand}` });
        } else {
          len = count;
        }
      } else if (mnemUpper === 'BYTE') {
        const byteLen = this.calculateByteLength(pl.operand);
        if (byteLen === null) {
          errors.push({ line: pl.lineNo, message: `Invalid BYTE operand syntax: ${pl.operand}` });
          len = 0;
        } else {
          len = byteLen;
        }
      } else if (mnemUpper === 'BASE' || mnemUpper === 'NOBASE') {
        len = 0;
      } else {
        // Instruction
        const baseMnem = pl.baseMnemonic || pl.mnemonic;
        const opDef = OPCODES[baseMnem.toUpperCase()];
        if (!opDef) {
          errors.push({ line: pl.lineNo, message: `Unknown mnemonic: '${pl.mnemonic}'` });
          len = 0;
        } else if (pl.isFormat4) {
          if (opDef.format !== '3/4') {
            errors.push({ line: pl.lineNo, message: `Cannot use format 4 (+) with mnemonic: '${pl.mnemonic}'` });
          }
          len = 4;
        } else if (opDef.format === 1) {
          len = 1;
        } else if (opDef.format === 2) {
          len = 2;
        } else if (opDef.format === '3/4') {
          len = 3;
        }
      }

      lineLengths.push(len);
      locctr += len;
    }

    if (!hasStart) {
      warnings.push('Missing START directive; assuming start address 0x000000');
    }
    if (!hasEnd) {
      warnings.push('Missing END directive');
    }

    const programLength = locctr - startAddress;

    // PASS 2: Object code generation
    const listing: ListingLine[] = [];
    const memoryImage = new Map<number, number>();
    let baseAddress: number | null = null;
    let baseSymbol: string | null = null;

    interface ModRecord {
      address: number;
      halfBytes: number;
    }
    const modRecords: ModRecord[] = [];

    // Text records tracking
    interface TextRecItem {
      loc: number;
      hex: string;
      bytes: number[];
    }
    const textItems: TextRecItem[] = [];

    for (let i = 0; i < parsedLines.length; i++) {
      const pl = parsedLines[i];
      const loc = lineLocs[i];
      const len = lineLengths[i];
      let objectCode = '';
      let nixbpeInfo: ListingLine['nixbpe'];
      let lineError: string | undefined;

      if (!pl.mnemonic) {
        listing.push({
          lineNo: pl.lineNo,
          loc,
          objectCode: '',
          sourceText: pl.rawLine,
          comment: pl.comment,
        });
        continue;
      }

      const mnemUpper = pl.mnemonic.toUpperCase();

      if (mnemUpper === 'START' || mnemUpper === 'END') {
        listing.push({
          lineNo: pl.lineNo,
          loc,
          objectCode: '',
          sourceText: pl.rawLine,
          label: pl.label,
          mnemonic: pl.mnemonic,
          operand: pl.operand,
          comment: pl.comment,
        });
        continue;
      }

      if (mnemUpper === 'BASE') {
        if (!pl.operand) {
          errors.push({ line: pl.lineNo, message: 'BASE directive requires a symbol operand' });
        } else {
          baseSymbol = pl.operand;
          if (symbolTable.has(pl.operand)) {
            baseAddress = symbolTable.get(pl.operand)!;
          } else {
            errors.push({ line: pl.lineNo, message: `Undefined symbol in BASE: '${pl.operand}'` });
          }
        }
        listing.push({
          lineNo: pl.lineNo,
          loc,
          objectCode: '',
          sourceText: pl.rawLine,
          label: pl.label,
          mnemonic: pl.mnemonic,
          operand: pl.operand,
          comment: pl.comment,
        });
        continue;
      }

      if (mnemUpper === 'NOBASE') {
        baseAddress = null;
        baseSymbol = null;
        listing.push({
          lineNo: pl.lineNo,
          loc,
          objectCode: '',
          sourceText: pl.rawLine,
          label: pl.label,
          mnemonic: pl.mnemonic,
          comment: pl.comment,
        });
        continue;
      }

      if (mnemUpper === 'RESW' || mnemUpper === 'RESB') {
        listing.push({
          lineNo: pl.lineNo,
          loc,
          objectCode: '',
          sourceText: pl.rawLine,
          label: pl.label,
          mnemonic: pl.mnemonic,
          operand: pl.operand,
          comment: pl.comment,
        });
        continue;
      }

      if (mnemUpper === 'WORD') {
        const val = parseInt(pl.operand || '0', 10);
        if (isNaN(val)) {
          lineError = `Invalid WORD operand: ${pl.operand}`;
          errors.push({ line: pl.lineNo, message: lineError });
        } else {
          objectCode = (toUnsigned24(val)).toString(16).padStart(6, '0').toUpperCase();
        }
      } else if (mnemUpper === 'BYTE') {
        const bytesHex = this.encodeByteOperand(pl.operand);
        if (bytesHex === null) {
          lineError = `Invalid BYTE operand: ${pl.operand}`;
          errors.push({ line: pl.lineNo, message: lineError });
        } else {
          objectCode = bytesHex;
        }
      } else {
        // Machine instruction
        const baseMnem = (pl.baseMnemonic || pl.mnemonic).toUpperCase();
        const opDef = OPCODES[baseMnem];

        if (opDef) {
          if (opDef.format === 1) {
            objectCode = opDef.opcode.toString(16).padStart(2, '0').toUpperCase();
          } else if (opDef.format === 2) {
            const encodedFmt2 = this.encodeFormat2(opDef.opcode, baseMnem, pl.operand);
            if (encodedFmt2.error) {
              lineError = encodedFmt2.error;
              errors.push({ line: pl.lineNo, message: lineError });
            } else {
              objectCode = encodedFmt2.hex;
            }
          } else if (opDef.format === '3/4') {
            const fmtResult = this.encodeFormat3Or4({
              loc,
              opDef,
              isFormat4: pl.isFormat4,
              operand: pl.operand,
              symbolTable,
              baseAddress,
            });

            if (fmtResult.error) {
              lineError = fmtResult.error;
              errors.push({ line: pl.lineNo, message: lineError });
            } else {
              objectCode = fmtResult.hex;
              nixbpeInfo = fmtResult.nixbpe;
              if (fmtResult.isRelocatable) {
                // Modification record at loc + 1 (5 half-bytes)
                modRecords.push({ address: loc + 1, halfBytes: 5 });
              }
            }
          }
        }
      }

      // Write object code to memory image and text item
      if (objectCode) {
        const byteList: number[] = [];
        for (let b = 0; b < objectCode.length; b += 2) {
          const byteVal = parseInt(objectCode.slice(b, b + 2), 16);
          memoryImage.set(loc + b / 2, byteVal);
          byteList.push(byteVal);
        }
        textItems.push({ loc, hex: objectCode, bytes: byteList });
      }

      listing.push({
        lineNo: pl.lineNo,
        loc,
        objectCode,
        sourceText: pl.rawLine,
        label: pl.label,
        mnemonic: pl.mnemonic,
        operand: pl.operand,
        comment: pl.comment,
        format: (len as InstructionFormat) || undefined,
        nixbpe: nixbpeInfo,
        error: lineError,
      });
    }

    // Determine first executable address
    let firstExecAddress = startAddress;
    if (endOperand) {
      if (symbolTable.has(endOperand)) {
        firstExecAddress = symbolTable.get(endOperand)!;
      } else {
        const hexVal = parseInt(endOperand, 16);
        if (!isNaN(hexVal)) {
          firstExecAddress = hexVal;
        } else {
          errors.push({ line: parsedLines.length, message: `Undefined symbol in END: '${endOperand}'` });
        }
      }
    }

    // Build Object Program (Beck H, T, M, E records)
    let objectProgram: ObjectProgram | null = null;
    if (errors.length === 0) {
      objectProgram = this.buildObjectProgram({
        progName,
        startAddress,
        programLength,
        firstExecAddress,
        textItems,
        modRecords,
      });
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      listing,
      symbolTable,
      symbolList: symbolList.sort((a, b) => a.address - b.address),
      objectProgram,
      startAddress,
      programLength,
      firstExecAddress,
      memoryImage,
    };
  }

  private static isMnemonicOrDirective(token: string): boolean {
    const t = token.toUpperCase();
    if (t.startsWith('+')) {
      return OPCODES[t.slice(1)] !== undefined;
    }
    const directives = ['START', 'END', 'BYTE', 'WORD', 'RESB', 'RESW', 'BASE', 'NOBASE'];
    return directives.includes(t) || OPCODES[t] !== undefined;
  }

  private static parseLine(line: string, lineNo: number): ParsedLine {
    const rawLine = line;
    let text = line;
    let comment: string | undefined;

    // Check full-line comment
    if (text.trim().startsWith('.')) {
      return { lineNo, rawLine, comment: text.trim(), isFormat4: false };
    }

    // Check trailing comment
    const commentIdx = text.indexOf(';');
    if (commentIdx !== -1) {
      comment = text.slice(commentIdx + 1).trim();
      text = text.slice(0, commentIdx);
    }

    // If blank line
    if (!text.trim()) {
      return { lineNo, rawLine, comment, isFormat4: false };
    }

    const hasCol0 = text[0] !== ' ' && text[0] !== '\t';
    const trimmed = text.trim();
    const tokens = trimmed.split(/\s+/);

    let label: string | undefined;
    let mnemonic = '';
    let operand: string | undefined;

    if (!hasCol0) {
      // Indented line: no label in column 0
      mnemonic = tokens[0];
      if (tokens.length > 1) {
        operand = tokens.slice(1).join(' ').trim();
      }
    } else {
      // Starts in column 0
      if (tokens.length === 1) {
        // Single token in line
        if (this.isMnemonicOrDirective(tokens[0])) {
          mnemonic = tokens[0];
        } else {
          label = tokens[0];
        }
      } else if (tokens.length === 2) {
        // 2 tokens: e.g. "STL RETADR", "RESB 45", "END PROG", "CLEAR X", "LOOP RSUB"
        if (this.isMnemonicOrDirective(tokens[0])) {
          // Token 0 is mnemonic
          mnemonic = tokens[0];
          operand = tokens[1];
        } else if (this.isMnemonicOrDirective(tokens[1])) {
          // Token 0 is label, token 1 is mnemonic (e.g. "HALT RSUB")
          label = tokens[0];
          mnemonic = tokens[1];
        } else {
          // Default to label + mnemonic
          label = tokens[0];
          mnemonic = tokens[1];
        }
      } else {
        // 3 or more tokens: e.g. "PROG START 0", "LOOP ADDR X,A", "LIMIT WORD 6"
        // Or unindented "ADDR X, A" where operand had spaces
        if (this.isMnemonicOrDirective(tokens[1])) {
          // Standard: [0] = label, [1] = mnemonic, [2..] = operand
          label = tokens[0];
          mnemonic = tokens[1];
          operand = tokens.slice(2).join(' ').trim();
        } else if (this.isMnemonicOrDirective(tokens[0])) {
          // Unindented mnemonic with operand parts
          mnemonic = tokens[0];
          operand = tokens.slice(1).join(' ').trim();
        } else {
          label = tokens[0];
          mnemonic = tokens[1];
          operand = tokens.slice(2).join(' ').trim();
        }
      }
    }

    let isFormat4 = false;
    let baseMnemonic = mnemonic;

    if (mnemonic.startsWith('+')) {
      isFormat4 = true;
      baseMnemonic = mnemonic.slice(1);
    }

    return {
      lineNo,
      rawLine,
      label,
      mnemonic: mnemonic || undefined,
      operand,
      comment,
      isFormat4,
      baseMnemonic: baseMnemonic || undefined,
    };
  }

  private static calculateByteLength(operand?: string): number | null {
    if (!operand) return null;
    const match = operand.match(/^([CX])'([^']*)'$/i);
    if (!match) return null;
    const type = match[1].toUpperCase();
    const content = match[2];
    if (type === 'C') {
      return content.length;
    }
    if (type === 'X') {
      if (content.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/.test(content)) return null;
      return content.length / 2;
    }
    return null;
  }

  private static encodeByteOperand(operand?: string): string | null {
    if (!operand) return null;
    const match = operand.match(/^([CX])'([^']*)'$/i);
    if (!match) return null;
    const type = match[1].toUpperCase();
    const content = match[2];
    if (type === 'C') {
      return Array.from(content)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
        .join('');
    }
    if (type === 'X') {
      if (content.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/.test(content)) return null;
      return content.toUpperCase();
    }
    return null;
  }

  private static encodeFormat2(opcode: number, mnemonic: string, operand?: string): { hex: string; error?: string } {
    const opHex = opcode.toString(16).padStart(2, '0').toUpperCase();
    if (!operand) {
      return { hex: `${opHex}00` };
    }

    const parts = operand.split(',').map((s) => s.trim().toUpperCase());

    const getRegNum = (rName: string): number | null => {
      if (REGISTER_NAMES[rName as RegisterId] !== undefined) {
        return REGISTER_NAMES[rName as RegisterId];
      }
      const num = parseInt(rName, 10);
      if (!isNaN(num) && num >= 0 && num <= 9) return num;
      return null;
    };

    if (mnemonic === 'CLEAR' || mnemonic === 'TIXR') {
      const r1 = getRegNum(parts[0]);
      if (r1 === null) return { hex: '', error: `Invalid register: ${parts[0]}` };
      return { hex: `${opHex}${r1.toString(16)}0`.toUpperCase() };
    }

    if (mnemonic === 'SHIFTL' || mnemonic === 'SHIFTR') {
      const r1 = getRegNum(parts[0]);
      if (r1 === null) return { hex: '', error: `Invalid register: ${parts[0]}` };
      const n = parseInt(parts[1], 10);
      if (isNaN(n) || n < 1 || n > 16) {
        return { hex: '', error: `Shift amount must be between 1 and 16, got: ${parts[1]}` };
      }
      const nNibble = (n - 1) & 0x0f;
      return { hex: `${opHex}${r1.toString(16)}${nNibble.toString(16)}`.toUpperCase() };
    }

    // Two registers: r1, r2
    const r1 = getRegNum(parts[0]);
    const r2 = parts[1] ? getRegNum(parts[1]) : 0;
    if (r1 === null) return { hex: '', error: `Invalid register r1: ${parts[0]}` };
    if (r2 === null) return { hex: '', error: `Invalid register r2: ${parts[1]}` };

    return { hex: `${opHex}${r1.toString(16)}${r2.toString(16)}`.toUpperCase() };
  }

  private static encodeFormat3Or4(params: {
    loc: number;
    opDef: { opcode: number; mnemonic: string };
    isFormat4: boolean;
    operand?: string;
    symbolTable: Map<string, number>;
    baseAddress: number | null;
  }): { hex: string; error?: string; nixbpe?: ListingLine['nixbpe']; isRelocatable?: boolean } {
    const { loc, opDef, isFormat4, operand, symbolTable, baseAddress } = params;

    // RSUB takes no operand
    if (opDef.mnemonic === 'RSUB') {
      // 4F0000 (n=1, i=1, x=0, b=0, p=0, e=0, disp=0)
      return {
        hex: '4F0000',
        nixbpe: { n: 1, i: 1, x: 0, b: 0, p: 0, e: 0 },
      };
    }

    if (!operand) {
      return { hex: '', error: `Missing operand for ${opDef.mnemonic}` };
    }

    let n = 1;
    let i = 1;
    let x = 0;
    let b = 0;
    let p = 0;
    const e = isFormat4 ? 1 : 0;
    let isRelocatable = false;

    let targetOp = operand.trim();

    // Check indexed (,X)
    if (targetOp.toUpperCase().endsWith(',X')) {
      x = 1;
      targetOp = targetOp.slice(0, -2).trim();
    }

    // Check immediate (#) or indirect (@)
    let isImmediate = false;
    let isIndirect = false;

    if (targetOp.startsWith('#')) {
      n = 0;
      i = 1;
      isImmediate = true;
      targetOp = targetOp.slice(1).trim();
    } else if (targetOp.startsWith('@')) {
      n = 1;
      i = 0;
      isIndirect = true;
      targetOp = targetOp.slice(1).trim();
    }

    // Check if targetOp is a numeric constant
    const numericMatch = targetOp.match(/^-?\d+$/);
    const isNumericConstant = isImmediate && numericMatch !== null;

    let dispOrAddr = 0;

    if (isNumericConstant) {
      const numVal = parseInt(targetOp, 10);
      if (isFormat4) {
        dispOrAddr = numVal & 0xfffff;
      } else {
        if (numVal < 0 || numVal > 4095) {
          return { hex: '', error: 'constant too large for format 3, use +' };
        }
        dispOrAddr = numVal & 0xfff;
      }
    } else {
      // Target is a symbol
      if (!symbolTable.has(targetOp)) {
        return { hex: '', error: `Undefined symbol: '${targetOp}'` };
      }
      const targetAddr = symbolTable.get(targetOp)!;

      if (isFormat4) {
        dispOrAddr = targetAddr & 0xfffff;
        isRelocatable = true;
      } else {
        // Format 3 displacement selection:
        // 2a. PC-relative: disp = TA - (LOC + 3)
        const pcNext = loc + 3;
        const pcDisp = targetAddr - pcNext;

        if (pcDisp >= -2048 && pcDisp <= 2047) {
          p = 1;
          dispOrAddr = pcDisp & 0xfff;
        } else if (baseAddress !== null) {
          // 2b. Base-relative if BASE is active: disp = TA - BASEADDR
          const baseDisp = targetAddr - baseAddress;
          if (baseDisp >= 0 && baseDisp <= 4095) {
            b = 1;
            dispOrAddr = baseDisp & 0xfff;
          } else {
            return { hex: '', error: 'displacement out of range; use format 4 (+)' };
          }
        } else {
          return { hex: '', error: 'displacement out of range; use format 4 (+)' };
        }
      }
    }

    // First byte: (opDef.opcode & 0xFC) | (n << 1) | i
    const byte0 = (opDef.opcode & 0xfc) | (n << 1) | i;
    // Second byte high nibble: (x << 3) | (b << 2) | (p << 1) | e
    const xbpe = (x << 3) | (b << 2) | (p << 1) | e;

    let hex = '';
    if (isFormat4) {
      const byte1 = (xbpe << 4) | ((dispOrAddr >> 16) & 0x0f);
      const byte2 = (dispOrAddr >> 8) & 0xff;
      const byte3 = dispOrAddr & 0xff;
      hex = [byte0, byte1, byte2, byte3]
        .map((bVal) => bVal.toString(16).padStart(2, '0').toUpperCase())
        .join('');
    } else {
      const byte1 = (xbpe << 4) | ((dispOrAddr >> 8) & 0x0f);
      const byte2 = dispOrAddr & 0xff;
      hex = [byte0, byte1, byte2]
        .map((bVal) => bVal.toString(16).padStart(2, '0').toUpperCase())
        .join('');
    }

    return {
      hex,
      nixbpe: { n, i, x, b, p, e },
      isRelocatable,
    };
  }

  private static buildObjectProgram(params: {
    progName: string;
    startAddress: number;
    programLength: number;
    firstExecAddress: number;
    textItems: Array<{ loc: number; hex: string; bytes: number[] }>;
    modRecords: Array<{ address: number; halfBytes: number }>;
  }): ObjectProgram {
    const { progName, startAddress, programLength, firstExecAddress, textItems, modRecords } = params;

    // Header record: H^name(6, padded)^start(6 hex)^length(6 hex)
    const namePadded = progName.padEnd(6, ' ').slice(0, 6);
    const startHex = formatHex24(startAddress);
    const lenHex = formatHex24(programLength);
    const hRecord = `H^${namePadded}^${startHex}^${lenHex}`;

    // Text records: T^start(6 hex)^length(2 hex, <= 0x1E bytes)^object codes...
    const tRecords: Array<{ startAddress: number; length: number; objectCode: string; recordText: string }> = [];

    let currentTStart = -1;
    let currentTHex = '';
    let currentTBytes = 0;
    let expectedNextLoc = -1;

    const flushT = () => {
      if (currentTBytes > 0 && currentTStart !== -1) {
        const lenByteHex = currentTBytes.toString(16).padStart(2, '0').toUpperCase();
        const recText = `T^${formatHex24(currentTStart)}^${lenByteHex}^${currentTHex}`;
        tRecords.push({
          startAddress: currentTStart,
          length: currentTBytes,
          objectCode: currentTHex,
          recordText: recText,
        });
        currentTStart = -1;
        currentTHex = '';
        currentTBytes = 0;
        expectedNextLoc = -1;
      }
    };

    for (const item of textItems) {
      const itemBytes = item.bytes.length;

      // If gap in address (e.g. RESW / RESB), flush current T
      if (expectedNextLoc !== -1 && item.loc !== expectedNextLoc) {
        flushT();
      }

      // If adding this item exceeds 30 bytes (0x1E), flush
      if (currentTBytes + itemBytes > 30) {
        flushT();
      }

      if (currentTStart === -1) {
        currentTStart = item.loc;
      }

      currentTHex += item.hex;
      currentTBytes += itemBytes;
      expectedNextLoc = item.loc + itemBytes;
    }
    flushT();

    // Modification records: M^address(6 hex)^05
    const mRecords = modRecords.map((m) => {
      const addrHex = formatHex24(m.address);
      const halfHex = m.halfBytes.toString(16).padStart(2, '0').toUpperCase();
      return {
        address: m.address,
        halfBytes: m.halfBytes,
        recordText: `M^${addrHex}^${halfHex}`,
      };
    });

    // End record: E^first-instruction address(6 hex)
    const eRecord = `E^${formatHex24(firstExecAddress)}`;

    const fullLines = [
      hRecord,
      ...tRecords.map((t) => t.recordText),
      ...mRecords.map((m) => m.recordText),
      eRecord,
    ];

    return {
      header: {
        progName: namePadded,
        startAddress,
        length: programLength,
        recordText: hRecord,
      },
      textRecords: tRecords,
      modRecords: mRecords,
      endRecord: {
        firstExecAddress,
        recordText: eRecord,
      },
      fullText: fullLines.join('\n'),
    };
  }
}
