/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Memory } from './memory.ts';
import { lookupOpcodeByByte } from './opcodes.ts';
import { formatHex20, formatHex24, Registers } from './registers.ts';
import { DecodedInstruction, InstructionFormat, REGISTER_NUMBERS } from './types.ts';

export class IllegalInstructionException extends Error {
  constructor(public readonly pc: number, public readonly rawBytesHex: string, message: string) {
    super(`Illegal instruction at PC=0x${formatHex24(pc)} [${rawBytesHex}]: ${message}`);
    this.name = 'IllegalInstructionException';
  }
}

export class UnsupportedInstructionException extends Error {
  constructor(public readonly pc: number, public readonly mnemonic: string) {
    super(`Unsupported instruction at PC=0x${formatHex24(pc)}: ${mnemonic} is not supported`);
    this.name = 'UnsupportedInstructionException';
  }
}

export class Decoder {
  public static decode(pc: number, memory: Memory, registers: Registers): DecodedInstruction {
    const byte0 = memory.getByte(pc);
    const def = lookupOpcodeByByte(byte0);

    if (!def) {
      throw new IllegalInstructionException(pc, byte0.toString(16).padStart(2, '0').toUpperCase(), `Unknown opcode byte: 0x${byte0.toString(16).padStart(2, '0').toUpperCase()}`);
    }

    if (def.isUnsupported) {
      throw new UnsupportedInstructionException(pc, def.mnemonic);
    }

    // Format 1
    if (def.format === 1) {
      const rawBytes = [byte0];
      const rawBytesHex = byte0.toString(16).padStart(2, '0').toUpperCase();
      return {
        pcBefore: pc,
        length: 1,
        rawBytes,
        rawBytesHex,
        opcode: def.opcode,
        mnemonic: def.mnemonic,
        format: 1,
        addressingMode: 'none',
        disassembly: def.mnemonic,
      };
    }

    // Format 2
    if (def.format === 2) {
      const byte1 = memory.getByte(pc + 1);
      const rawBytes = [byte0, byte1];
      const rawBytesHex = rawBytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');

      const r1Num = (byte1 >> 4) & 0x0f;
      const r2Num = byte1 & 0x0f;
      const r1 = REGISTER_NUMBERS[r1Num];
      const r2 = REGISTER_NUMBERS[r2Num];

      let disassembly = def.mnemonic;
      let shiftAmount: number | undefined;

      if (def.mnemonic === 'CLEAR' || def.mnemonic === 'TIXR') {
        disassembly = `${def.mnemonic} ${r1 || r1Num}`;
      } else if (def.mnemonic === 'SHIFTL' || def.mnemonic === 'SHIFTR') {
        shiftAmount = r2Num + 1;
        disassembly = `${def.mnemonic} ${r1 || r1Num}, ${shiftAmount}`;
      } else {
        disassembly = `${def.mnemonic} ${r1 || r1Num}, ${r2 || r2Num}`;
      }

      return {
        pcBefore: pc,
        length: 2,
        rawBytes,
        rawBytesHex,
        opcode: def.opcode,
        mnemonic: def.mnemonic,
        format: 2,
        r1,
        r2,
        r1Num,
        r2Num,
        shiftAmount,
        addressingMode: 'register',
        disassembly,
      };
    }

    // Format 3 or 4
    const byte1 = memory.getByte(pc + 1);
    const n = (byte0 >> 1) & 1;
    const i = byte0 & 1;
    const x = (byte1 >> 7) & 1;
    const b = (byte1 >> 6) & 1;
    const p = (byte1 >> 5) & 1;
    const e = (byte1 >> 4) & 1;

    if (b === 1 && p === 1) {
      const rawBytesHex = [byte0, byte1].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
      throw new IllegalInstructionException(pc, rawBytesHex, 'b=1 and p=1 together is illegal');
    }

    const fmt: InstructionFormat = e === 1 ? 4 : 3;
    const length = fmt === 4 ? 4 : 3;

    const rawBytes: number[] = [byte0, byte1];
    rawBytes.push(memory.getByte(pc + 2));
    if (fmt === 4) {
      rawBytes.push(memory.getByte(pc + 3));
    }
    const rawBytesHex = rawBytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');

    let dispOrAddr = 0;
    if (fmt === 3) {
      dispOrAddr = ((byte1 & 0x0f) << 8) | rawBytes[2];
    } else {
      dispOrAddr = ((byte1 & 0x0f) << 16) | (rawBytes[2] << 8) | rawBytes[3];
    }

    // Compute Target Address
    const nextPc = pc + length;
    let targetAddress = 0;
    let taFormula = '';

    if (n === 0 && i === 0) {
      // Standard SIC mode: lower 15 bits
      const addr15 = ((byte1 & 0x7f) << 8) | rawBytes[2];
      targetAddress = addr15;
      taFormula = `SIC standard 15-bit: 0x${addr15.toString(16).padStart(4, '0').toUpperCase()}`;
      if (x === 1) {
        const xVal = registers.get('X');
        targetAddress = (targetAddress + xVal) & 0xfffff;
        taFormula += ` + X(0x${formatHex20(xVal)}) = 0x${formatHex20(targetAddress)}`;
      }
    } else if (fmt === 4) {
      // Format 4 direct address
      targetAddress = dispOrAddr & 0xfffff;
      taFormula = `Direct 20-bit address: 0x${formatHex20(targetAddress)}`;
      if (x === 1) {
        const xVal = registers.get('X');
        targetAddress = (targetAddress + xVal) & 0xfffff;
        taFormula += ` + X(0x${formatHex20(xVal)}) = 0x${formatHex20(targetAddress)}`;
      }
    } else {
      // Format 3
      if (b === 1) {
        const bVal = registers.get('B');
        targetAddress = (bVal + dispOrAddr) & 0xfffff;
        taFormula = `Base-rel: (B: 0x${formatHex20(bVal)}) + disp(0x${dispOrAddr.toString(16).toUpperCase()}) = 0x${formatHex20(targetAddress)}`;
      } else if (p === 1) {
        // Sign extend 12-bit disp
        const signedDisp = dispOrAddr & 0x800 ? dispOrAddr - 0x1000 : dispOrAddr;
        targetAddress = (nextPc + signedDisp) & 0xfffff;
        const dispStr = signedDisp >= 0 ? `+${signedDisp}` : `${signedDisp}`;
        taFormula = `PC-rel: (PC: 0x${formatHex20(nextPc)}) + (${dispStr}) = 0x${formatHex20(targetAddress)}`;
      } else {
        targetAddress = dispOrAddr & 0xfffff;
        taFormula = `Direct disp: 0x${formatHex20(targetAddress)}`;
      }

      if (x === 1) {
        const xVal = registers.get('X');
        targetAddress = (targetAddress + xVal) & 0xfffff;
        taFormula += ` + X(0x${formatHex20(xVal)}) = 0x${formatHex20(targetAddress)}`;
      }
    }

    // Determine addressing mode
    let addressingMode: DecodedInstruction['addressingMode'] = 'simple';
    if (n === 0 && i === 1) {
      addressingMode = 'immediate';
    } else if (n === 1 && i === 0) {
      addressingMode = 'indirect';
    } else if (n === 1 && i === 1) {
      addressingMode = 'simple';
    } else if (n === 0 && i === 0) {
      addressingMode = 'standard_sic';
    }

    // Disassembly formatting
    const prefix = fmt === 4 ? '+' : '';
    let operandStr = '';
    if (def.mnemonic === 'RSUB') {
      operandStr = '';
    } else if (addressingMode === 'immediate') {
      operandStr = `#${targetAddress}`;
    } else if (addressingMode === 'indirect') {
      operandStr = `@0x${formatHex20(targetAddress)}`;
    } else {
      operandStr = `0x${formatHex20(targetAddress)}`;
      if (x === 1) operandStr += ',X';
    }

    const disassembly = `${prefix}${def.mnemonic} ${operandStr}`.trim();

    return {
      pcBefore: pc,
      length,
      rawBytes,
      rawBytesHex,
      opcode: def.opcode,
      mnemonic: def.mnemonic,
      format: fmt,
      n,
      i,
      x,
      b,
      p,
      e,
      dispOrAddr,
      targetAddress,
      taFormula,
      addressingMode,
      disassembly,
    };
  }
}
