/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpcodeDef } from './types.ts';

export const OPCODES: Record<string, OpcodeDef> = {
  // Format 3/4 Core Load & Store
  LDA: { mnemonic: 'LDA', opcode: 0x00, format: '3/4', description: 'Load Accumulator from memory' },
  LDX: { mnemonic: 'LDX', opcode: 0x04, format: '3/4', description: 'Load Index Register from memory' },
  LDL: { mnemonic: 'LDL', opcode: 0x08, format: '3/4', description: 'Load Linkage Register from memory' },
  LDB: { mnemonic: 'LDB', opcode: 0x68, format: '3/4', description: 'Load Base Register from memory' },
  LDS: { mnemonic: 'LDS', opcode: 0x6c, format: '3/4', description: 'Load General Register S from memory' },
  LDT: { mnemonic: 'LDT', opcode: 0x74, format: '3/4', description: 'Load General Register T from memory' },
  LDCH: { mnemonic: 'LDCH', opcode: 0x50, format: '3/4', description: 'Load Character into rightmost byte of A' },

  STA: { mnemonic: 'STA', opcode: 0x0c, format: '3/4', description: 'Store Accumulator into memory' },
  STX: { mnemonic: 'STX', opcode: 0x10, format: '3/4', description: 'Store Index Register into memory' },
  STL: { mnemonic: 'STL', opcode: 0x14, format: '3/4', description: 'Store Linkage Register into memory' },
  STB: { mnemonic: 'STB', opcode: 0x78, format: '3/4', description: 'Store Base Register into memory' },
  STS: { mnemonic: 'STS', opcode: 0x7c, format: '3/4', description: 'Store General Register S into memory' },
  STT: { mnemonic: 'STT', opcode: 0x84, format: '3/4', description: 'Store General Register T into memory' },
  STCH: { mnemonic: 'STCH', opcode: 0x54, format: '3/4', description: 'Store rightmost byte of A into memory' },

  // Format 3/4 Arithmetic & Logic
  ADD: { mnemonic: 'ADD', opcode: 0x18, format: '3/4', description: 'Add operand to A' },
  SUB: { mnemonic: 'SUB', opcode: 0x1c, format: '3/4', description: 'Subtract operand from A' },
  MUL: { mnemonic: 'MUL', opcode: 0x20, format: '3/4', description: 'Multiply A by operand (low 24 bits)' },
  DIV: { mnemonic: 'DIV', opcode: 0x24, format: '3/4', description: 'Divide A by operand (signed integer)' },
  AND: { mnemonic: 'AND', opcode: 0x40, format: '3/4', description: 'Bitwise AND A with operand', isExtended: true },
  OR: { mnemonic: 'OR', opcode: 0x44, format: '3/4', description: 'Bitwise OR A with operand', isExtended: true },

  // Format 3/4 Compare & Test
  COMP: { mnemonic: 'COMP', opcode: 0x28, format: '3/4', description: 'Compare A with operand; set CC' },
  TIX: { mnemonic: 'TIX', opcode: 0x2c, format: '3/4', description: 'Increment X, then compare with operand; set CC' },

  // Format 3/4 Jumps & Subroutine
  J: { mnemonic: 'J', opcode: 0x3c, format: '3/4', description: 'Jump to target address' },
  JEQ: { mnemonic: 'JEQ', opcode: 0x30, format: '3/4', description: 'Jump to target address if CC is EQ' },
  JGT: { mnemonic: 'JGT', opcode: 0x34, format: '3/4', description: 'Jump to target address if CC is GT' },
  JLT: { mnemonic: 'JLT', opcode: 0x38, format: '3/4', description: 'Jump to target address if CC is LT' },
  JSUB: { mnemonic: 'JSUB', opcode: 0x48, format: '3/4', description: 'Jump to subroutine (L = next PC, PC = TA)' },
  RSUB: { mnemonic: 'RSUB', opcode: 0x4c, format: '3/4', description: 'Return from subroutine (PC = L)' },

  // Format 2 Register-to-Register
  ADDR: { mnemonic: 'ADDR', opcode: 0x90, format: 2, description: 'Add r1 to r2 (r2 = r2 + r1)' },
  SUBR: { mnemonic: 'SUBR', opcode: 0x94, format: 2, description: 'Subtract r1 from r2 (r2 = r2 - r1)' },
  MULR: { mnemonic: 'MULR', opcode: 0x98, format: 2, description: 'Multiply r2 by r1 (r2 = r2 * r1)' },
  DIVR: { mnemonic: 'DIVR', opcode: 0x9c, format: 2, description: 'Divide r2 by r1 (r2 = r2 / r1)' },
  COMPR: { mnemonic: 'COMPR', opcode: 0xa0, format: 2, description: 'Compare r1 with r2; set CC' },
  CLEAR: { mnemonic: 'CLEAR', opcode: 0xb4, format: 2, description: 'Clear register r1 to 0' },
  TIXR: { mnemonic: 'TIXR', opcode: 0xb8, format: 2, description: 'Increment X, then compare with r1; set CC' },
  RMO: { mnemonic: 'RMO', opcode: 0xac, format: 2, description: 'Register move (r2 = r1)' },
  SHIFTL: { mnemonic: 'SHIFTL', opcode: 0xa4, format: 2, description: 'Circular shift left r1 by n bits', isExtended: true },
  SHIFTR: { mnemonic: 'SHIFTR', opcode: 0xa8, format: 2, description: 'Arithmetic shift right r1 by n bits', isExtended: true },

  // Unsupported Instructions (clearly signaled, never crash)
  FLOAT: { mnemonic: 'FLOAT', opcode: 0xc0, format: 1, description: 'Convert integer to float (unsupported)', isUnsupported: true },
  FIX: { mnemonic: 'FIX', opcode: 0xc4, format: 1, description: 'Convert float to integer (unsupported)', isUnsupported: true },
  NORM: { mnemonic: 'NORM', opcode: 0xc8, format: 1, description: 'Normalize float (unsupported)', isUnsupported: true },
  LDF: { mnemonic: 'LDF', opcode: 0x70, format: '3/4', description: 'Load Float (unsupported)', isUnsupported: true },
  STF: { mnemonic: 'STF', opcode: 0x80, format: '3/4', description: 'Store Float (unsupported)', isUnsupported: true },
  ADDF: { mnemonic: 'ADDF', opcode: 0x58, format: '3/4', description: 'Add Float (unsupported)', isUnsupported: true },
  SUBF: { mnemonic: 'SUBF', opcode: 0x5c, format: '3/4', description: 'Subtract Float (unsupported)', isUnsupported: true },
  MULF: { mnemonic: 'MULF', opcode: 0x60, format: '3/4', description: 'Multiply Float (unsupported)', isUnsupported: true },
  DIVF: { mnemonic: 'DIVF', opcode: 0x64, format: '3/4', description: 'Divide Float (unsupported)', isUnsupported: true },
  COMPF: { mnemonic: 'COMPF', opcode: 0x88, format: '3/4', description: 'Compare Float (unsupported)', isUnsupported: true },
  RD: { mnemonic: 'RD', opcode: 0xd8, format: '3/4', description: 'Read Device (unsupported)', isUnsupported: true },
  WD: { mnemonic: 'WD', opcode: 0xdc, format: '3/4', description: 'Write Device (unsupported)', isUnsupported: true },
  TD: { mnemonic: 'TD', opcode: 0xe0, format: '3/4', description: 'Test Device (unsupported)', isUnsupported: true },
  SIO: { mnemonic: 'SIO', opcode: 0xf0, format: 1, description: 'Start I/O (unsupported)', isUnsupported: true },
  HIO: { mnemonic: 'HIO', opcode: 0xf4, format: 1, description: 'Halt I/O (unsupported)', isUnsupported: true },
  TIO: { mnemonic: 'TIO', opcode: 0xf8, format: 1, description: 'Test I/O (unsupported)', isUnsupported: true },
  SVC: { mnemonic: 'SVC', opcode: 0xb0, format: 2, description: 'Supervisor Call (unsupported)', isUnsupported: true },
  LPS: { mnemonic: 'LPS', opcode: 0xd0, format: '3/4', description: 'Load Processor Status (unsupported)', isUnsupported: true },
  STI: { mnemonic: 'STI', opcode: 0xd4, format: '3/4', description: 'Store Interrupt (unsupported)', isUnsupported: true },
  STSW: { mnemonic: 'STSW', opcode: 0xe8, format: '3/4', description: 'Store Status Word (unsupported)', isUnsupported: true },
  SSK: { mnemonic: 'SSK', opcode: 0xec, format: '3/4', description: 'Set Storage Key (unsupported)', isUnsupported: true },
};

// Map from opcode byte (masked by 0xFC) to OpcodeDef
export const OPCODE_BY_BYTE: Map<number, OpcodeDef> = new Map();

for (const key of Object.keys(OPCODES)) {
  const def = OPCODES[key];
  OPCODE_BY_BYTE.set(def.opcode, def);
}

export function lookupOpcodeByByte(byte: number): OpcodeDef | undefined {
  const masked = byte & 0xfc;
  return OPCODE_BY_BYTE.get(masked) || OPCODE_BY_BYTE.get(byte);
}
