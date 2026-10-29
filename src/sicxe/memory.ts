/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class MemoryAccessException extends Error {
  constructor(public readonly address: number, public readonly size: number, message?: string) {
    super(message || `Memory access violation at address 0x${address.toString(16).padStart(5, '0').toUpperCase()} (size: ${size})`);
    this.name = 'MemoryAccessException';
  }
}

export class Memory {
  private readonly bytes: Uint8Array;
  public readonly size: number;
  private modifiedAddresses: Set<number> = new Set();

  constructor(size: number = 1048576) {
    this.size = size;
    this.bytes = new Uint8Array(size);
  }

  public getByte(address: number): number {
    if (address < 0 || address >= this.size) {
      throw new MemoryAccessException(address, 1);
    }
    return this.bytes[address];
  }

  public setByte(address: number, val: number): void {
    if (address < 0 || address >= this.size) {
      throw new MemoryAccessException(address, 1);
    }
    this.bytes[address] = val & 0xff;
    this.modifiedAddresses.add(address);
  }

  public getWord(address: number): number {
    if (address < 0 || address + 2 >= this.size) {
      throw new MemoryAccessException(address, 3);
    }
    const b0 = this.bytes[address];
    const b1 = this.bytes[address + 1];
    const b2 = this.bytes[address + 2];
    return ((b0 << 16) | (b1 << 8) | b2) >>> 0;
  }

  public setWord(address: number, val: number): void {
    if (address < 0 || address + 2 >= this.size) {
      throw new MemoryAccessException(address, 3);
    }
    const v = val & 0xffffff;
    this.bytes[address] = (v >> 16) & 0xff;
    this.bytes[address + 1] = (v >> 8) & 0xff;
    this.bytes[address + 2] = v & 0xff;
    this.modifiedAddresses.add(address);
    this.modifiedAddresses.add(address + 1);
    this.modifiedAddresses.add(address + 2);
  }

  public getBytes(startAddress: number, length: number): Uint8Array {
    if (startAddress < 0 || startAddress + length > this.size) {
      throw new MemoryAccessException(startAddress, length);
    }
    return this.bytes.slice(startAddress, startAddress + length);
  }

  public loadBytes(startAddress: number, data: number[] | Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setByte(startAddress + i, data[i]);
    }
  }

  public isModified(address: number): boolean {
    return this.modifiedAddresses.has(address);
  }

  public clearModified(): void {
    this.modifiedAddresses.clear();
  }

  public clear(): void {
    this.bytes.fill(0);
    this.modifiedAddresses.clear();
  }
}
