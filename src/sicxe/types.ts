/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConditionCode = 'LT' | 'EQ' | 'GT';

export type RegisterId = 'A' | 'X' | 'L' | 'B' | 'S' | 'T' | 'F' | 'PC' | 'SW';

export const REGISTER_NUMBERS: Record<number, RegisterId> = {
  0: 'A',
  1: 'X',
  2: 'L',
  3: 'B',
  4: 'S',
  5: 'T',
  6: 'F',
  8: 'PC',
  9: 'SW',
};

export const REGISTER_NAMES: Record<RegisterId, number> = {
  A: 0,
  X: 1,
  L: 2,
  B: 3,
  S: 4,
  T: 5,
  F: 6,
  PC: 8,
  SW: 9,
};

export type InstructionFormat = 1 | 2 | 3 | 4;

export interface OpcodeDef {
  mnemonic: string;
  opcode: number; // 8-bit opcode (for fmt 3/4, bits 7-2 are used, bits 1-0 are 0)
  format: InstructionFormat | '3/4';
  description: string;
  isExtended?: boolean;
  isUnsupported?: boolean;
}

export interface DecodedInstruction {
  pcBefore: number;
  length: number;
  rawBytes: number[];
  rawBytesHex: string;
  opcode: number;
  mnemonic: string;
  format: InstructionFormat;
  // nixbpe flags for formats 3/4
  n?: number;
  i?: number;
  x?: number;
  b?: number;
  p?: number;
  e?: number;
  dispOrAddr?: number;
  // format 2 registers
  r1?: RegisterId;
  r2?: RegisterId;
  r1Num?: number;
  r2Num?: number;
  shiftAmount?: number;
  // calculated Target Address & explanation
  targetAddress?: number;
  taFormula?: string;
  operandValue?: number;
  addressingMode?: 'immediate' | 'simple' | 'indirect' | 'standard_sic' | 'register' | 'none';
  disassembly: string;
}

export interface RegisterChange {
  reg: RegisterId;
  oldValue: number;
  newValue: number;
}

export interface MemoryChange {
  address: number;
  oldBytes: number[];
  newBytes: number[];
}

export interface StepResult {
  stepNumber: number;
  pcBefore: number;
  pcAfter: number;
  instruction: DecodedInstruction;
  registerChanges: RegisterChange[];
  memoryChanges: MemoryChange[];
  conditionCodeBefore: ConditionCode;
  conditionCodeAfter: ConditionCode;
  traceLine: string;
  halted: boolean;
  haltReason?: string;
}

export interface RunResult {
  totalSteps: number;
  halted: boolean;
  haltReason: string;
  finalRegisters: Record<RegisterId, number>;
  finalConditionCode: ConditionCode;
}

export interface AsmError {
  line: number;
  message: string;
  sourceText?: string;
}

export interface ListingLine {
  lineNo: number;
  loc: number;
  objectCode: string;
  sourceText: string;
  label?: string;
  mnemonic?: string;
  operand?: string;
  comment?: string;
  format?: InstructionFormat;
  nixbpe?: { n: number; i: number; x: number; b: number; p: number; e: number };
  error?: string;
}

export interface SymbolEntry {
  name: string;
  address: number;
  definedLine: number;
}

export interface ObjectProgram {
  header: {
    progName: string;
    startAddress: number;
    length: number;
    recordText: string;
  };
  textRecords: Array<{
    startAddress: number;
    length: number;
    objectCode: string;
    recordText: string;
  }>;
  modRecords: Array<{
    address: number;
    halfBytes: number;
    recordText: string;
  }>;
  endRecord: {
    firstExecAddress: number;
    recordText: string;
  };
  fullText: string;
}

export interface AssemblerResult {
  success: boolean;
  errors: AsmError[];
  warnings: string[];
  listing: ListingLine[];
  symbolTable: Map<string, number>;
  symbolList: SymbolEntry[];
  objectProgram: ObjectProgram | null;
  startAddress: number;
  programLength: number;
  firstExecAddress: number;
  memoryImage: Map<number, number>; // address -> byte
}
