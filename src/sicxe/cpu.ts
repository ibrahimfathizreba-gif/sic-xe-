/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Decoder, IllegalInstructionException } from './decoder.ts';
import { Memory } from './memory.ts';
import { formatHex20, formatHex24, Registers, toSigned24, toUnsigned24 } from './registers.ts';
import { ConditionCode, DecodedInstruction, MemoryChange, RegisterChange, RunResult, StepResult } from './types.ts';

export class ArithmeticSimException extends Error {
  constructor(public readonly pc: number, message: string) {
    super(`Arithmetic error at PC=0x${formatHex24(pc)}: ${message}`);
    this.name = 'ArithmeticSimException';
  }
}

export class CPU {
  public stepCount: number = 0;
  public halted: boolean = false;
  public haltReason?: string;
  public programStart: number = 0;
  public programLength: number = 0;

  constructor(public readonly memory: Memory, public readonly registers: Registers) {}

  public setProgramBounds(start: number, length: number): void {
    this.programStart = start;
    this.programLength = length;
  }

  public step(): StepResult {
    if (this.halted) {
      throw new Error(`CPU is already halted: ${this.haltReason}`);
    }

    const pcBefore = this.registers.get('PC');

    // Bounds check
    if (pcBefore < 0 || pcBefore >= this.memory.size) {
      this.halted = true;
      this.haltReason = `PC 0x${formatHex24(pcBefore)} is outside memory boundary`;
      return this.createHaltResult(pcBefore, pcBefore, this.haltReason);
    }

    // Decode instruction
    const decoded: DecodedInstruction = Decoder.decode(pcBefore, this.memory, this.registers);
    const nextPc = (pcBefore + decoded.length) & 0xffffff;
    // Step 3: Advance PC by instruction length
    this.registers.set('PC', nextPc);

    const regChanges: RegisterChange[] = [];
    const memChanges: MemoryChange[] = [];
    const ccBefore = this.registers.getConditionCode();

    const trackReg = (reg: Parameters<Registers['set']>[0], newVal: number) => {
      const oldVal = this.registers.get(reg);
      const masked = toUnsigned24(newVal);
      if (oldVal !== masked) {
        regChanges.push({ reg, oldValue: oldVal, newValue: masked });
      }
      this.registers.set(reg, masked);
    };

    const trackMemByte = (addr: number, val: number) => {
      const oldByte = this.memory.getByte(addr);
      const newByte = val & 0xff;
      if (oldByte !== newByte) {
        memChanges.push({ address: addr, oldBytes: [oldByte], newBytes: [newByte] });
      }
      this.memory.setByte(addr, newByte);
    };

    const trackMemWord = (addr: number, val: number) => {
      const oldBytes = [this.memory.getByte(addr), this.memory.getByte(addr + 1), this.memory.getByte(addr + 2)];
      const v = val & 0xffffff;
      const newBytes = [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
      memChanges.push({ address: addr, oldBytes, newBytes });
      this.memory.setWord(addr, v);
    };

    let operandVal: number | undefined;
    let effectiveTarget = decoded.targetAddress;

    // Resolve indirect target address if applicable
    if (decoded.addressingMode === 'indirect' && effectiveTarget !== undefined) {
      effectiveTarget = this.memory.getWord(effectiveTarget) & 0xfffff;
    }

    // Operand Fetch for Format 3/4 (except store and jumps)
    if (decoded.format === 3 || decoded.format === 4) {
      const isStore = ['STA', 'STX', 'STL', 'STB', 'STS', 'STT', 'STCH'].includes(decoded.mnemonic);
      const isJump = ['J', 'JEQ', 'JGT', 'JLT', 'JSUB'].includes(decoded.mnemonic);
      const isRsub = decoded.mnemonic === 'RSUB';

      if (isStore || isJump) {
        if (decoded.addressingMode === 'immediate') {
          throw new IllegalInstructionException(pcBefore, decoded.rawBytesHex, `Immediate addressing is illegal for ${decoded.mnemonic}`);
        }
      } else if (!isRsub && effectiveTarget !== undefined) {
        if (decoded.addressingMode === 'immediate') {
          operandVal = effectiveTarget;
        } else if (decoded.mnemonic === 'LDCH') {
          operandVal = this.memory.getByte(effectiveTarget);
        } else {
          operandVal = this.memory.getWord(effectiveTarget);
        }
        decoded.operandValue = operandVal;
      }
    }

    // Execute Instruction
    switch (decoded.mnemonic) {
      // Loads
      case 'LDA':
        if (operandVal !== undefined) trackReg('A', operandVal);
        break;
      case 'LDX':
        if (operandVal !== undefined) trackReg('X', operandVal);
        break;
      case 'LDL':
        if (operandVal !== undefined) trackReg('L', operandVal);
        break;
      case 'LDB':
        if (operandVal !== undefined) trackReg('B', operandVal);
        break;
      case 'LDS':
        if (operandVal !== undefined) trackReg('S', operandVal);
        break;
      case 'LDT':
        if (operandVal !== undefined) trackReg('T', operandVal);
        break;
      case 'LDCH':
        if (effectiveTarget !== undefined) {
          const byteVal = this.memory.getByte(effectiveTarget);
          const currentA = this.registers.get('A');
          const newA = (currentA & 0xffff00) | (byteVal & 0xff);
          trackReg('A', newA);
        }
        break;

      // Stores
      case 'STA':
        if (effectiveTarget !== undefined) trackMemWord(effectiveTarget, this.registers.get('A'));
        break;
      case 'STX':
        if (effectiveTarget !== undefined) trackMemWord(effectiveTarget, this.registers.get('X'));
        break;
      case 'STL':
        if (effectiveTarget !== undefined) trackMemWord(effectiveTarget, this.registers.get('L'));
        break;
      case 'STB':
        if (effectiveTarget !== undefined) trackMemWord(effectiveTarget, this.registers.get('B'));
        break;
      case 'STS':
        if (effectiveTarget !== undefined) trackMemWord(effectiveTarget, this.registers.get('S'));
        break;
      case 'STT':
        if (effectiveTarget !== undefined) trackMemWord(effectiveTarget, this.registers.get('T'));
        break;
      case 'STCH':
        if (effectiveTarget !== undefined) {
          const rightmost = this.registers.get('A') & 0xff;
          trackMemByte(effectiveTarget, rightmost);
        }
        break;

      // Arithmetic
      case 'ADD':
        if (operandVal !== undefined) {
          trackReg('A', this.registers.get('A') + operandVal);
        }
        break;
      case 'SUB':
        if (operandVal !== undefined) {
          trackReg('A', this.registers.get('A') - operandVal);
        }
        break;
      case 'MUL':
        if (operandVal !== undefined) {
          trackReg('A', this.registers.get('A') * operandVal);
        }
        break;
      case 'DIV':
        if (operandVal !== undefined) {
          const signedOp = toSigned24(operandVal);
          if (signedOp === 0) {
            throw new ArithmeticSimException(pcBefore, 'Division by zero');
          }
          const signedA = toSigned24(this.registers.get('A'));
          const quotient = Math.trunc(signedA / signedOp);
          trackReg('A', quotient);
        }
        break;
      case 'AND':
        if (operandVal !== undefined) {
          trackReg('A', this.registers.get('A') & operandVal);
        }
        break;
      case 'OR':
        if (operandVal !== undefined) {
          trackReg('A', this.registers.get('A') | operandVal);
        }
        break;

      // Compare & Test
      case 'COMP':
        if (operandVal !== undefined) {
          const signedA = toSigned24(this.registers.get('A'));
          const signedOp = toSigned24(operandVal);
          let newCc: ConditionCode = 'EQ';
          if (signedA < signedOp) newCc = 'LT';
          else if (signedA > signedOp) newCc = 'GT';
          this.registers.setConditionCode(newCc);
        }
        break;
      case 'TIX':
        if (operandVal !== undefined) {
          const newX = (this.registers.get('X') + 1) & 0xffffff;
          trackReg('X', newX);
          const signedX = toSigned24(newX);
          const signedOp = toSigned24(operandVal);
          let newCc: ConditionCode = 'EQ';
          if (signedX < signedOp) newCc = 'LT';
          else if (signedX > signedOp) newCc = 'GT';
          this.registers.setConditionCode(newCc);
        }
        break;

      // Jumps
      case 'J':
        if (effectiveTarget !== undefined) {
          // Check halt condition: jump to self (HALT J HALT)
          if (effectiveTarget === pcBefore) {
            this.halted = true;
            this.haltReason = 'Jump to self (normal termination)';
          }
          trackReg('PC', effectiveTarget);
        }
        break;
      case 'JEQ':
        if (this.registers.getConditionCode() === 'EQ' && effectiveTarget !== undefined) {
          trackReg('PC', effectiveTarget);
        }
        break;
      case 'JGT':
        if (this.registers.getConditionCode() === 'GT' && effectiveTarget !== undefined) {
          trackReg('PC', effectiveTarget);
        }
        break;
      case 'JLT':
        if (this.registers.getConditionCode() === 'LT' && effectiveTarget !== undefined) {
          trackReg('PC', effectiveTarget);
        }
        break;
      case 'JSUB':
        if (effectiveTarget !== undefined) {
          trackReg('L', nextPc);
          trackReg('PC', effectiveTarget);
        }
        break;
      case 'RSUB':
        trackReg('PC', this.registers.get('L'));
        break;

      // Format 2
      case 'ADDR':
        if (decoded.r1 && decoded.r2) {
          trackReg(decoded.r2, this.registers.get(decoded.r2) + this.registers.get(decoded.r1));
        }
        break;
      case 'SUBR':
        if (decoded.r1 && decoded.r2) {
          trackReg(decoded.r2, this.registers.get(decoded.r2) - this.registers.get(decoded.r1));
        }
        break;
      case 'MULR':
        if (decoded.r1 && decoded.r2) {
          trackReg(decoded.r2, this.registers.get(decoded.r2) * this.registers.get(decoded.r1));
        }
        break;
      case 'DIVR':
        if (decoded.r1 && decoded.r2) {
          const r1Val = toSigned24(this.registers.get(decoded.r1));
          if (r1Val === 0) {
            throw new ArithmeticSimException(pcBefore, `Division by zero in DIVR (${decoded.r1} is 0)`);
          }
          const r2Val = toSigned24(this.registers.get(decoded.r2));
          trackReg(decoded.r2, Math.trunc(r2Val / r1Val));
        }
        break;
      case 'COMPR':
        if (decoded.r1 && decoded.r2) {
          const val1 = toSigned24(this.registers.get(decoded.r1));
          const val2 = toSigned24(this.registers.get(decoded.r2));
          let newCc: ConditionCode = 'EQ';
          if (val1 < val2) newCc = 'LT';
          else if (val1 > val2) newCc = 'GT';
          this.registers.setConditionCode(newCc);
        }
        break;
      case 'CLEAR':
        if (decoded.r1) {
          trackReg(decoded.r1, 0);
        }
        break;
      case 'TIXR':
        if (decoded.r1) {
          const newX = (this.registers.get('X') + 1) & 0xffffff;
          trackReg('X', newX);
          const signedX = toSigned24(newX);
          const signedR1 = toSigned24(this.registers.get(decoded.r1));
          let newCc: ConditionCode = 'EQ';
          if (signedX < signedR1) newCc = 'LT';
          else if (signedX > signedR1) newCc = 'GT';
          this.registers.setConditionCode(newCc);
        }
        break;
      case 'RMO':
        if (decoded.r1 && decoded.r2) {
          trackReg(decoded.r2, this.registers.get(decoded.r1));
        }
        break;
      case 'SHIFTL':
        if (decoded.r1 && decoded.shiftAmount !== undefined) {
          const n = decoded.shiftAmount;
          const val = this.registers.get(decoded.r1);
          const shifted = ((val << n) | (val >>> (24 - n))) & 0xffffff;
          trackReg(decoded.r1, shifted);
        }
        break;
      case 'SHIFTR':
        if (decoded.r1 && decoded.shiftAmount !== undefined) {
          const n = decoded.shiftAmount;
          const signedVal = toSigned24(this.registers.get(decoded.r1));
          const shifted = toUnsigned24(signedVal >> n);
          trackReg(decoded.r1, shifted);
        }
        break;
    }

    this.stepCount++;
    const pcAfter = this.registers.get('PC');
    const ccAfter = this.registers.getConditionCode();

    // Check if PC jumped outside program bounds or memory
    if (this.programLength > 0 && (pcAfter < this.programStart || pcAfter >= this.programStart + this.programLength)) {
      if (!this.halted) {
        this.halted = true;
        this.haltReason = `PC 0x${formatHex24(pcAfter)} moved outside loaded program range (0x${formatHex24(this.programStart)} - 0x${formatHex24(this.programStart + this.programLength)})`;
      }
    }

    // Build trace line matching Section 8 & 11.3
    const stepNumStr = `#${this.stepCount.toString().padStart(3, '0')}`;
    const pcStr = `PC=${formatHex24(pcBefore)}`;
    const hexPad = decoded.rawBytesHex.padEnd(8, ' ');
    const disasmPad = decoded.disassembly.padEnd(13, ' ');

    let details = '';
    if (decoded.targetAddress !== undefined && decoded.mnemonic !== 'RSUB' && decoded.format >= 3) {
      details += `TA=${formatHex24(decoded.targetAddress)} `;
      if (operandVal !== undefined) {
        details += `val=${formatHex24(operandVal)} | `;
      } else {
        details += '| ';
      }
    }

    const regChangesStr = regChanges
      .filter((r) => r.reg !== 'SW')
      .map((r) => `${r.reg}: ${formatHex24(r.oldValue)} -> ${formatHex24(r.newValue)}`)
      .join(' | ');

    if (regChangesStr) {
      details += regChangesStr;
    }

    if (ccBefore !== ccAfter) {
      details += `${details ? ' | ' : ''}CC=${ccAfter}`;
    }

    const traceLine = `${stepNumStr} ${pcStr}  ${hexPad} ${disasmPad} | ${details}`.trim();

    return {
      stepNumber: this.stepCount,
      pcBefore,
      pcAfter,
      instruction: decoded,
      registerChanges: regChanges,
      memoryChanges: memChanges,
      conditionCodeBefore: ccBefore,
      conditionCodeAfter: ccAfter,
      traceLine,
      halted: this.halted,
      haltReason: this.haltReason,
    };
  }

  public run(maxSteps: number = 100000, breakpoint?: (pc: number) => boolean): RunResult {
    let steps = 0;

    while (!this.halted && steps < maxSteps) {
      const pc = this.registers.get('PC');
      if (breakpoint && breakpoint(pc)) {
        return {
          totalSteps: steps,
          halted: false,
          haltReason: `Breakpoint hit at PC=0x${formatHex24(pc)}`,
          finalRegisters: this.registers.cloneValues(),
          finalConditionCode: this.registers.getConditionCode(),
        };
      }

      this.step();
      steps++;
    }

    if (!this.halted && steps >= maxSteps) {
      this.halted = true;
      this.haltReason = `Max step count reached (${maxSteps}) - possible infinite loop`;
    }

    return {
      totalSteps: steps,
      halted: this.halted,
      haltReason: this.haltReason || 'Completed',
      finalRegisters: this.registers.cloneValues(),
      finalConditionCode: this.registers.getConditionCode(),
    };
  }

  private createHaltResult(pcBefore: number, pcAfter: number, reason: string): StepResult {
    const cc = this.registers.getConditionCode();
    return {
      stepNumber: this.stepCount,
      pcBefore,
      pcAfter,
      instruction: {
        pcBefore,
        length: 0,
        rawBytes: [],
        rawBytesHex: '',
        opcode: 0,
        mnemonic: 'HALT',
        format: 1,
        disassembly: 'HALT',
      },
      registerChanges: [],
      memoryChanges: [],
      conditionCodeBefore: cc,
      conditionCodeAfter: cc,
      traceLine: `#${this.stepCount.toString().padStart(3, '0')} PC=${formatHex24(pcBefore)} HALTED: ${reason}`,
      halted: true,
      haltReason: reason,
    };
  }
}
