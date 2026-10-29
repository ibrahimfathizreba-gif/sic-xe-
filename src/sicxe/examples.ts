/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExampleProgram {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
  source: string;
  expectedResult: string;
}

export const EXAMPLES: ExampleProgram[] = [
  {
    id: 'sum1to5',
    title: 'Sum 1 to 5 (Beck Section 11)',
    description: 'Calculates the sum of integers 1 through 5 using a loop with TIX and JLT. Demonstrates PC-relative addressing, condition codes, and normal termination via jump-to-self.',
    difficulty: 'Beginner',
    tags: ['Loop', 'TIX', 'JLT', 'PC-Relative'],
    expectedResult: 'A = 15 (0x00000F), X = 6 (0x000006), RESULT at 0x000017 = 0x00000F',
    source: `PROG    START   0
        LDX     #1
        LDA     #0
LOOP    ADDR    X,A
        TIX     LIMIT
        JLT     LOOP
        STA     RESULT
HALT    J       HALT
LIMIT   WORD    6
RESULT  RESW    1
        END     PROG
`,
  },
  {
    id: 'subroutine',
    title: 'Subroutine Call (JSUB / RSUB)',
    description: 'Demonstrates modular programming with JSUB and RSUB. The subroutine DOUBL doubles register A using ADDR, saving and restoring linkage via register L.',
    difficulty: 'Intermediate',
    tags: ['Subroutine', 'JSUB', 'RSUB', 'ADDR'],
    expectedResult: 'A = 24 (0x000018) after doubling 12 twice, stored in RES',
    source: `SUBPRG  START   1000
        LDA     #6
        JSUB    DOUBL
        JSUB    DOUBL
        STA     RES
STOP    J       STOP
. Subroutine DOUBL: computes A = A + A
DOUBL   ADDR    A,A
        RSUB
RES     RESW    1
        END     SUBPRG
`,
  },
  {
    id: 'base_format4',
    title: 'Base-Relative & Format 4 (+)',
    description: 'Shows base-relative addressing (BASE & NOBASE) and extended 4-byte format (+JSUB, +LDT) when targets exceed the 12-bit PC-relative range (-2048..2047).',
    difficulty: 'Advanced',
    tags: ['BASE', 'Format 4', 'Indexed', 'STCH'],
    expectedResult: 'Demonstrates +LDT, BASE relocation, and buffer indexing',
    source: `EXTPRG  START   0
        LDB     #DATA
        BASE    DATA
        +LDT    #4096
        CLEAR   X
        LDA     #65
        STCH    BUFFER,X
        TIXR    T
HALT    J       HALT
        RESB    3000
DATA    BYTE    C'SICXE'
BUFFER  RESB    10
        NOBASE
        END     EXTPRG
`,
  },
  {
    id: 'string_copy',
    title: 'Buffer Copy (LDCH / STCH)',
    description: 'Copies a 5-byte string "HELLO" from SRC to DEST byte by byte using indexed addressing (LDCH SRC,X and STCH DEST,X) with TIX loop control.',
    difficulty: 'Intermediate',
    tags: ['Strings', 'LDCH', 'STCH', 'Indexed'],
    expectedResult: 'DEST buffer at 0x00001E contains "HELLO" (48 45 4C 4C 4F)',
    source: `STRCPY  START   0
        CLEAR   X
        LDT     #5
LOOP    LDCH    SRC,X
        STCH    DEST,X
        TIXR    T
        JLT     LOOP
HALT    J       HALT
SRC     BYTE    C'HELLO'
DEST    RESB    5
        END     STRCPY
`,
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci Sequence Generator',
    description: 'Generates the first 6 Fibonacci numbers (1, 1, 2, 3, 5, 8) and stores the 6th number (8) in FIB_N using register arithmetic.',
    difficulty: 'Advanced',
    tags: ['Algorithm', 'RMO', 'Arithmetic'],
    expectedResult: 'FIB_N contains 8 (0x000008), A contains 8',
    source: `FIB     START   0
        LDA     #1
        LDS     #1
        LDX     #2
        LDT     #6
FIBLOOP RMO     A,B
        ADDR    S,A
        RMO     B,S
        TIXR    T
        JLT     FIBLOOP
        STA     FIB_N
HALT    J       HALT
FIB_N   RESW    1
        END     FIB
`,
  },
];
