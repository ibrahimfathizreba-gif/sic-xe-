/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Assembler } from './assembler.ts';
import { CPU } from './cpu.ts';
import { Memory } from './memory.ts';
import { Registers } from './registers.ts';
import { Loader } from './loader.ts';
import { EXAMPLES } from './examples.ts';

test('Section 11.4 - Single instruction encoding unit tests', () => {
  // 1. at 0000, RETADR=0030: STL RETADR -> 17202D
  const src1 = `TEST START 0
STL RETADR
RETADR RESW 1
END TEST`;
  // We can also test with custom address
  const src1Exact = `TEST START 0
STL RETADR
RESB 45
RETADR RESW 1
END TEST`;
  const res1 = Assembler.assemble(src1Exact);
  assert.equal(res1.success, true, 'res1 assembly should succeed');
  const lineSTL = res1.listing.find((l) => l.mnemonic === 'STL');
  assert.equal(lineSTL?.objectCode, '17202D');

  // 2. at 0003, LENGTH=0033: LDB #LENGTH -> 69202D
  const src2 = `TEST START 0
RESB 3
LDB #LENGTH
RESB 45
LENGTH RESW 1
END TEST`;
  const res2 = Assembler.assemble(src2);
  assert.equal(res2.success, true);
  const lineLDB = res2.listing.find((l) => l.mnemonic === 'LDB');
  assert.equal(lineLDB?.objectCode, '69202D');

  // 3. RDREC=1036: +JSUB RDREC -> 4B101036
  const src3 = `TEST START 0
+JSUB RDREC
RESB 4146
RDREC RESW 1
END TEST`;
  const res3 = Assembler.assemble(src3);
  assert.equal(res3.success, true);
  const lineJSUB = res3.listing.find((l) => l.mnemonic === '+JSUB');
  assert.equal(lineJSUB?.objectCode, '4B101036');

  // 4. COMP #0 -> 290000
  const src4 = `TEST START 0
COMP #0
END TEST`;
  const res4 = Assembler.assemble(src4);
  assert.equal(res4.success, true);
  const lineCOMP = res4.listing.find((l) => l.mnemonic === 'COMP');
  assert.equal(lineCOMP?.objectCode, '290000');

  // 5. RSUB -> 4F0000
  const src5 = `TEST START 0
RSUB
END TEST`;
  const res5 = Assembler.assemble(src5);
  assert.equal(res5.success, true);
  const lineRSUB = res5.listing.find((l) => l.mnemonic === 'RSUB');
  assert.equal(lineRSUB?.objectCode, '4F0000');

  // 6. after BASE LENGTH (LENGTH=0033), BUFFER=0036, too far for PC-relative: STCH BUFFER,X -> 57C003
  const src6 = `TEST START 0
RESB 51
LENGTH RESB 3
BUFFER RESW 1
RESB 4000
BASE LENGTH
STCH BUFFER,X
END TEST`;
  const res6 = Assembler.assemble(src6);
  assert.equal(res6.success, true);
  const lineSTCH = res6.listing.find((l) => l.mnemonic === 'STCH');
  // targetAddr = 0x36, BASE = 0x33 -> disp = 3. x=1, b=1 -> xbpe = 1100 = C.
  assert.equal(lineSTCH?.objectCode, '57C003');

  // 7. CLEAR X -> B410
  const src7 = `TEST START 0
CLEAR X
END TEST`;
  const res7 = Assembler.assemble(src7);
  assert.equal(res7.success, true);
  const lineCLEAR = res7.listing.find((l) => l.mnemonic === 'CLEAR');
  assert.equal(lineCLEAR?.objectCode, 'B410');

  // 8. +LDT #4096 -> 75101000
  const src8 = `TEST START 0
+LDT #4096
END TEST`;
  const res8 = Assembler.assemble(src8);
  assert.equal(res8.success, true);
  const lineLDT = res8.listing.find((l) => l.mnemonic === '+LDT');
  assert.equal(lineLDT?.objectCode, '75101000');

  // 9. TIXR T -> B850
  const src9 = `TEST START 0
TIXR T
END TEST`;
  const res9 = Assembler.assemble(src9);
  assert.equal(res9.success, true);
  const lineTIXR = res9.listing.find((l) => l.mnemonic === 'TIXR');
  assert.equal(lineTIXR?.objectCode, 'B850');

  // 10. COMPR A,S -> A004
  const src10 = `TEST START 0
COMPR A,S
END TEST`;
  const res10 = Assembler.assemble(src10);
  assert.equal(res10.success, true);
  const lineCOMPR = res10.listing.find((l) => l.mnemonic === 'COMPR');
  assert.equal(lineCOMPR?.objectCode, 'A004');

  // 11. LDA #3 -> 010003
  const src11 = `TEST START 0
LDA #3
END TEST`;
  const res11 = Assembler.assemble(src11);
  assert.equal(res11.success, true);
  const lineLDA = res11.listing.find((l) => l.mnemonic === 'LDA');
  assert.equal(lineLDA?.objectCode, '010003');

  // 12. ADDR X,A -> 9010
  const src12 = `TEST START 0
ADDR X,A
END TEST`;
  const res12 = Assembler.assemble(src12);
  assert.equal(res12.success, true);
  const lineADDR = res12.listing.find((l) => l.mnemonic === 'ADDR');
  assert.equal(lineADDR?.objectCode, '9010');
});

test('Section 11.1 - sum1to5.asm Assembler output verification', () => {
  const sumExample = EXAMPLES.find((e) => e.id === 'sum1to5')!;
  const result = Assembler.assemble(sumExample.source);

  assert.equal(result.success, true, 'Assembly should succeed with 0 errors');
  assert.equal(result.errors.length, 0);

  // Check symbol table
  assert.equal(result.symbolTable.get('PROG'), 0x0000);
  assert.equal(result.symbolTable.get('LOOP'), 0x0006);
  assert.equal(result.symbolTable.get('HALT'), 0x0011);
  assert.equal(result.symbolTable.get('LIMIT'), 0x0014);
  assert.equal(result.symbolTable.get('RESULT'), 0x0017);

  // Check program length
  assert.equal(result.programLength, 0x1a);

  // Check object codes
  const listingMap = new Map<number, string>();
  for (const line of result.listing) {
    if (line.mnemonic) {
      listingMap.set(line.loc, line.objectCode);
    }
  }

  assert.equal(listingMap.get(0x0000), '050001'); // LDX #1
  assert.equal(listingMap.get(0x0003), '010000'); // LDA #0
  assert.equal(listingMap.get(0x0006), '9010');   // ADDR X,A
  assert.equal(listingMap.get(0x0008), '2F2009'); // TIX LIMIT
  assert.equal(listingMap.get(0x000b), '3B2FF8'); // JLT LOOP
  assert.equal(listingMap.get(0x000e), '0F2006'); // STA RESULT
  assert.equal(listingMap.get(0x0011), '3F2FFD'); // J HALT
  assert.equal(listingMap.get(0x0014), '000006'); // WORD 6
  assert.equal(listingMap.get(0x0017), '');       // RESW 1 (no object code)

  // Check Object Program text
  assert.ok(result.objectProgram !== null);
  const lines = result.objectProgram!.fullText.split('\n');
  assert.equal(lines[0], 'H^PROG  ^000000^00001A');
  assert.equal(lines[1], 'T^000000^17^05000101000090102F20093B2FF80F20063F2FFD000006');
  assert.equal(lines[2], 'E^000000');
});

test('Section 11.2 & 11.3 - CPU execution of sum1to5.asm', () => {
  const sumExample = EXAMPLES.find((e) => e.id === 'sum1to5')!;
  const asmResult = Assembler.assemble(sumExample.source);
  assert.equal(asmResult.success, true);

  const memory = new Memory();
  const registers = new Registers();

  Loader.load(asmResult.objectProgram!, memory, registers);
  const cpu = new CPU(memory, registers);
  cpu.setProgramBounds(asmResult.startAddress, asmResult.programLength);

  // Step 1: LDX #1
  const step1 = cpu.step();
  assert.equal(step1.instruction.mnemonic, 'LDX');
  assert.equal(registers.get('X'), 1);

  // Step 2: LDA #0
  const step2 = cpu.step();
  assert.equal(step2.instruction.mnemonic, 'LDA');
  assert.equal(registers.get('A'), 0);

  // Loop iteration 1
  // Step 3: ADDR X,A
  const step3 = cpu.step();
  assert.equal(step3.instruction.mnemonic, 'ADDR');
  assert.equal(registers.get('A'), 1);

  // Step 4: TIX LIMIT -> X becomes 2, compares with LIMIT (6) -> CC = LT
  const step4 = cpu.step();
  assert.equal(step4.instruction.mnemonic, 'TIX');
  assert.equal(registers.get('X'), 2);
  assert.equal(registers.getConditionCode(), 'LT');

  // Step 5: JLT LOOP -> taken, PC becomes 0x0006
  const step5 = cpu.step();
  assert.equal(step5.instruction.mnemonic, 'JLT');
  assert.equal(registers.get('PC'), 0x0006);

  // Now run the remaining steps to completion
  const runResult = cpu.run(1000);
  assert.equal(runResult.halted, true);
  assert.equal(runResult.haltReason, 'Jump to self (normal termination)');

  // Final step count should be 19
  // (LDX, LDA, 5 * (ADDR, TIX, JLT) = 15, STA, J HALT = 2 -> total 19)
  assert.equal(cpu.stepCount, 19, 'Total executed steps should be 19');

  // Final registers: A = 15 (0x0F), X = 6 (0x06), PC = 0x000011
  assert.equal(registers.get('A'), 15);
  assert.equal(registers.get('X'), 6);
  assert.equal(registers.get('PC'), 0x0011);

  // Memory at RESULT (0x0017) should contain 15 (0x00000F)
  const resultVal = memory.getWord(0x0017);
  assert.equal(resultVal, 15);
});

test('Directives BYTE and WORD encoding', () => {
  const src = `DIR START 0
C1 BYTE C'EOF'
X1 BYTE X'F1'
W1 WORD -1
END DIR`;
  const res = Assembler.assemble(src);
  assert.equal(res.success, true);
  const c1 = res.listing.find((l) => l.label === 'C1');
  assert.equal(c1?.objectCode, '454F46');
  const x1 = res.listing.find((l) => l.label === 'X1');
  assert.equal(x1?.objectCode, 'F1');
  const w1 = res.listing.find((l) => l.label === 'W1');
  assert.equal(w1?.objectCode, 'FFFFFF');
});

test('Format 4 modification record generation', () => {
  const src = `RELOC START 1000
+JSUB TARGET
TARGET RSUB
END RELOC`;
  const res = Assembler.assemble(src);
  assert.equal(res.success, true);
  assert.ok(res.objectProgram !== null);
  assert.equal(res.objectProgram!.modRecords.length, 1);
  assert.equal(res.objectProgram!.modRecords[0].address, 0x1001);
  assert.equal(res.objectProgram!.modRecords[0].halfBytes, 5);
});

test('All built-in example programs assemble cleanly with 0 errors', () => {
  for (const example of EXAMPLES) {
    const res = Assembler.assemble(example.source);
    assert.equal(
      res.success,
      true,
      `Example '${example.title}' failed assembly: ${res.errors.map((e) => e.message).join(', ')}`
    );
    assert.equal(res.errors.length, 0);
  }
});

