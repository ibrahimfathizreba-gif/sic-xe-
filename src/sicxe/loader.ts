/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Memory } from './memory.ts';
import { Registers } from './registers.ts';
import { ObjectProgram } from './types.ts';

export class Loader {
  public static load(
    program: ObjectProgram,
    memory: Memory,
    registers: Registers,
    relocationOffset: number = 0
  ): void {
    for (const textRecord of program.textRecords) {
      const targetAddr = textRecord.startAddress + relocationOffset;
      const hex = textRecord.objectCode;
      const byteList: number[] = [];
      for (let i = 0; i < hex.length; i += 2) {
        byteList.push(parseInt(hex.slice(i, i + 2), 16));
      }
      memory.loadBytes(targetAddr, byteList);
    }

    const firstPc = program.endRecord.firstExecAddress + relocationOffset;
    registers.reset(firstPc);
  }

  public static loadHex(startAddress: number, hexString: string, memory: Memory, registers: Registers): void {
    const cleanHex = hexString.replace(/\s+/g, '');
    if (cleanHex.length % 2 !== 0) {
      throw new Error(`Hex string must have an even number of digits, got ${cleanHex.length}`);
    }
    const bytes: number[] = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.slice(i, i + 2), 16));
    }
    memory.loadBytes(startAddress, bytes);
    registers.reset(startAddress);
  }

  public static parseAndLoadText(
    text: string,
    memory: Memory,
    registers: Registers,
    relocationOffset: number = 0
  ): { progName: string; startAddr: number; length: number; entryPoint: number } {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    let progName = 'NONAME';
    let startAddr = 0;
    let length = 0;
    let entryPoint = 0;

    for (const rawLine of lines) {
      // Support caret-separated or direct column-based format
      let parts: string[];
      if (rawLine.includes('^')) {
        parts = rawLine.split('^').map((p) => p.trim());
      } else {
        const type = rawLine[0].toUpperCase();
        if (type === 'H') {
          parts = ['H', rawLine.slice(1, 7).trim(), rawLine.slice(7, 13), rawLine.slice(13, 19)];
        } else if (type === 'T') {
          parts = ['T', rawLine.slice(1, 7), rawLine.slice(7, 9), rawLine.slice(9)];
        } else if (type === 'M') {
          parts = ['M', rawLine.slice(1, 7), rawLine.slice(7, 9)];
        } else if (type === 'E') {
          parts = ['E', rawLine.slice(1, 7)];
        } else {
          continue;
        }
      }

      const recType = parts[0].toUpperCase();
      if (recType === 'H') {
        progName = parts[1] || 'NONAME';
        startAddr = parseInt(parts[2] || '0', 16);
        length = parseInt(parts[3] || '0', 16);
      } else if (recType === 'T') {
        const tStart = parseInt(parts[1], 16) + relocationOffset;
        const tHex = parts[3];
        const bytes: number[] = [];
        for (let i = 0; i < tHex.length; i += 2) {
          bytes.push(parseInt(tHex.slice(i, i + 2), 16));
        }
        memory.loadBytes(tStart, bytes);
      } else if (recType === 'E') {
        entryPoint = parseInt(parts[1] || startAddr.toString(16), 16) + relocationOffset;
      }
    }

    registers.reset(entryPoint);
    return { progName, startAddr, length, entryPoint };
  }
}
