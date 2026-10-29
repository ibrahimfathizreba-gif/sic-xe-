/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConditionCode, RegisterId, REGISTER_NAMES, REGISTER_NUMBERS } from './types.ts';

export function toSigned24(val: number): number {
  const masked = val & 0xffffff;
  if (masked & 0x800000) {
    return masked - 0x1000000;
  }
  return masked;
}

export function toUnsigned24(val: number): number {
  return ((val % 0x1000000) + 0x1000000) % 0x1000000;
}

export function formatHex24(val: number): string {
  return (val & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
}

export function formatHex20(val: number): string {
  return (val & 0xfffff).toString(16).padStart(5, '0').toUpperCase();
}

export class Registers {
  private values: Record<RegisterId, number> = {
    A: 0,
    X: 0,
    L: 0,
    B: 0,
    S: 0,
    T: 0,
    F: 0,
    PC: 0,
    SW: 1, // CC = EQ (low 2 bits = 01)
  };

  constructor(startPc: number = 0) {
    this.reset(startPc);
  }

  public get(reg: RegisterId): number {
    return this.values[reg] & 0xffffff;
  }

  public set(reg: RegisterId, value: number): void {
    if (reg === 'SW') {
      this.values.SW = value & 0xffffff;
      return;
    }
    this.values[reg] = toUnsigned24(value);
  }

  public getByNumber(num: number): number {
    const reg = REGISTER_NUMBERS[num];
    if (!reg) {
      throw new Error(`Invalid register number: ${num}`);
    }
    return this.get(reg);
  }

  public setByNumber(num: number, value: number): void {
    const reg = REGISTER_NUMBERS[num];
    if (!reg) {
      throw new Error(`Invalid register number: ${num}`);
    }
    this.set(reg, value);
  }

  public getConditionCode(): ConditionCode {
    const ccBits = this.values.SW & 0x03;
    if (ccBits === 0) return 'LT';
    if (ccBits === 1) return 'EQ';
    return 'GT';
  }

  public setConditionCode(cc: ConditionCode): void {
    let bits = 1; // EQ
    if (cc === 'LT') bits = 0;
    else if (cc === 'GT') bits = 2;

    this.values.SW = (this.values.SW & ~0x03) | bits;
  }

  public reset(startPc: number = 0): void {
    this.values = {
      A: 0,
      X: 0,
      L: 0,
      B: 0,
      S: 0,
      T: 0,
      F: 0,
      PC: startPc & 0xffffff,
      SW: 1, // CC = EQ
    };
  }

  public cloneValues(): Record<RegisterId, number> {
    return { ...this.values };
  }
}
