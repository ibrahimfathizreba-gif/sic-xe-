# PROJECT SPEC: SIC/XE Assembler + CPU Simulator (Java)

> **Audience:** an autonomous AI coding agent. Build this project end to end.
> **Rule:** do not ask clarifying questions. Where this spec is silent, choose the simplest option consistent with Leland Beck's *System Software* SIC/XE conventions, and record the choice in `README.md` under "Design decisions".
> **Authority:** sections 3–6 (machine model, instruction set, assembler, simulator) are authoritative. If a worked example in section 11 disagrees with them, follow sections 3–6 and report the discrepancy in `README.md`.

---

## 1. Overview

Build a teaching tool for the hypothetical **SIC/XE** computer (*Simplified Instructional Computer, Extra Equipment*) with two stages that are connected:

1. **Assembler** – reads SIC/XE assembly source, runs a two-pass algorithm, and produces machine code (listing, symbol table, object program).
2. **Simulator** – loads machine code into a simulated memory and executes it with a **Fetch → Decode → Execute** cycle, showing the effect of every instruction on registers and memory.

Data flow:

```
assembly text -> [Assembler Pass 1] -> symbol table
                 [Assembler Pass 2] -> object code (listing + H/T/E/M records)
                 [Loader]           -> Memory
                 [CPU.step() loop]  -> Registers + Memory after every instruction -> Display
```

**Primary goal:** correctness and clarity of the step-by-step display. This is a university project that must be demonstrable live in 7–10 minutes.

## 2. Technology and constraints

- Language: **Java 17**. Build tool: **Maven**. Tests: **JUnit 5**. No other third-party dependencies.
- GUI (optional phase 4): **Swing** only (ships with the JDK; no JavaFX).
- Core logic (`core`, `asm`, `loader`) must have **zero dependency on CLI or GUI code**. The CPU must never print; it returns data and the display layer renders it.
- All numbers inside the machine are unsigned integers stored in Java `int`; mask explicitly (24-bit words, 20-bit addresses).
- Deterministic, single-threaded core. The GUI may run `Run` on a worker thread.
- Package root: `sicxe`. Project name: `sicxe-sim`.

## 3. Machine model (SIC/XE)

### 3.1 Memory
- Byte-addressable, **1 MB = 2^20 bytes**, addresses `0x00000`–`0xFFFFF`.
- **Word = 3 bytes = 24 bits**, **big-endian** (most significant byte at the lowest address).
- Any access outside `[0, size)` raises `MemoryAccessException`.
- Memory size is a constructor parameter (default 1 048 576) so tests can use smaller memories.

### 3.2 Registers

| Name | Number | Size | Purpose |
|---|---|---|---|
| A  | 0 | 24-bit | Accumulator |
| X  | 1 | 24-bit | Index |
| L  | 2 | 24-bit | Linkage (return address) |
| B  | 3 | 24-bit | Base |
| S  | 4 | 24-bit | General |
| T  | 5 | 24-bit | General |
| F  | 6 | 48-bit | Floating point (**not supported**, keep the slot but do not use) |
| PC | 8 | 24-bit | Program counter |
| SW | 9 | 24-bit | Status word; the condition code (CC) is exposed through it |

- Registers hold unsigned 24-bit values. For arithmetic and comparison interpret them as **24-bit two's complement signed** values; results wrap modulo 2^24.
- **Condition code (CC)** values: `LT`, `EQ`, `GT`. Keep a `ConditionCode` enum and also mirror it in `SW` using a fixed encoding of your choice (suggested: low two bits `LT=00, EQ=01, GT=10`), documented in `README.md`. Initial CC after reset: `EQ`.
- Reset state: all registers 0, PC = program start address.

### 3.3 Instruction formats

| Format | Bytes | Layout |
|---|---|---|
| 1 | 1 | `op(8)` |
| 2 | 2 | `op(8) r1(4) r2(4)` |
| 3 | 3 | `op(6) n i x b p e disp(12)` |
| 4 | 4 | `op(6) n i x b p e address(20)` — selected when `e = 1` (assembler: `+` prefix) |

- First byte: `opcodeByte & 0xFC` is the opcode for formats 3/4; the low two bits are `n` and `i`. For formats 1 and 2 the low two bits of the opcode are 0, so keying every opcode table lookup by `byte0 & 0xFC` works for all formats.
- `xbpe` is the high nibble of byte 1 for formats 3/4: `x=8, b=4, p=2, e=1`.
- Format 2 register nibbles use the register numbers in 3.2.

### 3.4 Addressing modes and effective address (TA)

`ni` bits: `00` = standard SIC (see below), `01` = immediate, `10` = indirect, `11` = simple.

Computing the target address **TA** for formats 3/4 (PC is the address of the **next** instruction, i.e. already advanced by the instruction length):

1. Format 4 (`e=1`): `TA = address20`.
2. Format 3, `b=1`: `TA = (B) + disp12` (disp **unsigned**, 0..4095).
3. Format 3, `p=1`: `TA = (PC) + signExtend12(disp12)` (range −2048..2047).
4. Format 3, `b=0, p=0`: `TA = disp12` (direct).
5. If `x=1`: `TA = TA + (X)`.
6. `TA &= 0xFFFFF`.

(`b=1` and `p=1` together is illegal → `IllegalInstructionException`.)

Operand fetch (for instructions that read an operand):

| ni | Mode | Operand value |
|---|---|---|
| 01 | immediate | `value = TA` (no memory access) |
| 11 | simple | `value = word at TA` |
| 10 | indirect | `TA2 = word at TA; value = word at TA2` |
| 00 | standard SIC | address = lower 15 bits (`b,p,e,disp`), plus `(X)` if `x=1`; `value = word at address` |

For **store** instructions the destination is `TA` (indirect: `TA2`); immediate mode is illegal. For **jumps** the target is `TA` (indirect: `TA2`); immediate mode is illegal.

### 3.5 Condition code and halting

- `COMP`, `COMPR`, `TIX`, `TIXR` set CC to `LT`, `EQ` or `GT` (signed compare).
- `JLT`, `JEQ`, `JGT` jump when CC matches.
- **Halt conditions** (simulator stops and reports the reason):
  1. A `J` whose target equals its own address (idiomatic `HALT J HALT`).
  2. PC outside the loaded program range, or an address outside memory.
  3. Max step count reached (default 100 000; configurable) – reported as "possible infinite loop".
  4. Any simulator exception (illegal/unsupported instruction, division by zero, etc.).

## 4. Instruction set

Table-driven: one `Opcode` enum / table with `mnemonic, opcode, format, operandKind, semantics`. Adding an instruction must be a one-line table change plus a semantic lambda/case.

**Core set (MUST):**

| Mnemonic | Opcode | Fmt | Semantics |
|---|---|---|---|
| LDA | 00 | 3/4 | A ← operand |
| LDX | 04 | 3/4 | X ← operand |
| LDL | 08 | 3/4 | L ← operand |
| LDB | 68 | 3/4 | B ← operand |
| LDS | 6C | 3/4 | S ← operand |
| LDT | 74 | 3/4 | T ← operand |
| LDCH | 50 | 3/4 | A[rightmost byte] ← byte at TA (other bytes of A unchanged) |
| STA | 0C | 3/4 | word at TA ← A |
| STX | 10 | 3/4 | word at TA ← X |
| STL | 14 | 3/4 | word at TA ← L |
| STB | 78 | 3/4 | word at TA ← B |
| STS | 7C | 3/4 | word at TA ← S |
| STT | 84 | 3/4 | word at TA ← T |
| STCH | 54 | 3/4 | byte at TA ← A[rightmost byte] |
| ADD | 18 | 3/4 | A ← A + operand |
| SUB | 1C | 3/4 | A ← A − operand |
| MUL | 20 | 3/4 | A ← A × operand (low 24 bits) |
| DIV | 24 | 3/4 | A ← A ÷ operand (signed, truncate toward zero); operand 0 → `ArithmeticSimException` |
| COMP | 28 | 3/4 | CC ← compare(A, operand) |
| TIX | 2C | 3/4 | X ← X + 1; CC ← compare(X, operand) |
| J | 3C | 3/4 | PC ← TA |
| JEQ | 30 | 3/4 | if CC = EQ then PC ← TA |
| JGT | 34 | 3/4 | if CC = GT then PC ← TA |
| JLT | 38 | 3/4 | if CC = LT then PC ← TA |
| JSUB | 48 | 3/4 | L ← PC (next instruction); PC ← TA |
| RSUB | 4C | 3/4 | PC ← L (assembles with no operand: `4F0000`) |
| ADDR | 90 | 2 | r2 ← r2 + r1 |
| SUBR | 94 | 2 | r2 ← r2 − r1 |
| MULR | 98 | 2 | r2 ← r2 × r1 |
| DIVR | 9C | 2 | r2 ← r2 ÷ r1 |
| COMPR | A0 | 2 | CC ← compare(r1, r2) |
| CLEAR | B4 | 2 | r1 ← 0 |
| TIXR | B8 | 2 | X ← X + 1; CC ← compare(X, r1) |
| RMO | AC | 2 | r2 ← r1 |

**Extended set (SHOULD):** `AND 40`, `OR 44` (3/4, A ← A op operand); `SHIFTL A4`, `SHIFTR A8` (format 2, `r1, n`; the second nibble encodes `n−1`; SHIFTL is a circular left shift, SHIFTR an arithmetic right shift).

**Unsupported (MUST fail clearly, never crash):** floating point (`LDF STF ADDF SUBF MULF DIVF COMPF FLOAT FIX NORM`), I/O (`RD WD TD SIO HIO TIO`), `SVC`, `LPS`, `STI`, `STSW`, `SSK`. The assembler may accept them in source only if it can encode them; the simulator raises `UnsupportedInstructionException("<mnemonic> is not supported")`.

## 5. Assembler specification

### 5.1 Source format
- One statement per line. Format: `[LABEL] MNEMONIC [OPERAND]`, whitespace separated.
- A line whose first character is `.` is a comment. `;` starts a trailing comment. Blank lines allowed.
- A line that starts in column 0 with a non-space character defines a **label** (1–6 chars recommended, letters/digits/underscore, first char a letter; do not enforce 6 as an error, only warn).
- Mnemonics and register names are case-insensitive; labels are case-sensitive.
- Numbers: decimal by default; `START` operand is **hexadecimal**; `X'..'` is hex bytes; `C'..'` is characters.

### 5.2 Operand forms

| Form | Meaning |
|---|---|
| `SYMBOL` | simple (ni=11) |
| `SYMBOL,X` | simple + indexed (x=1) |
| `#SYMBOL` / `#number` | immediate (ni=01) |
| `@SYMBOL` | indirect (ni=10) |
| `+MNEMONIC …` | format 4 (e=1) |
| `r1` / `r1,r2` / `r1,n` | format 2 (`A X L B S T`, numbers 0–9) |
| *(none)* | `RSUB` |

### 5.3 Directives

| Directive | Meaning |
|---|---|
| `START hex` | program name = label; start address |
| `END [label]` | end of source; optional first-executable label (default = start address) |
| `BYTE C'..'` / `BYTE X'..'` | emit bytes |
| `WORD n` | emit one 3-byte word (signed decimal allowed, stored two's complement) |
| `RESB n` | reserve n bytes (no object code) |
| `RESW n` | reserve n words (3n bytes, no object code) |
| `BASE symbol` | tell the assembler that B will contain the address of `symbol` (generates **no** code; the program must load B itself, e.g. `LDB #symbol`) |
| `NOBASE` | cancel base-relative assumption |

Non-goals: `EQU`, `ORG`, expressions, literals (`=C'..'`), program blocks, control sections, macros.

### 5.4 Pass 1
- `LOCCTR` starts at the `START` address (default 0 if no `START`).
- For each statement record `(lineNo, LOCCTR, label, mnemonic, operand, length)` in an intermediate list.
- Insert labels into the **symbol table** (`Map<String,Integer>`); a duplicate label is an error (continue assembling).
- Lengths: format 1 = 1, format 2 = 2, format 3 = 3, `+` format 4 = 4, `WORD` = 3, `RESW n` = 3n, `RESB n` = n, `BYTE C'EOF'` = 3 (number of chars), `BYTE X'05'` = 1 (hex digits / 2).
- Program length = final LOCCTR − start address.

### 5.5 Pass 2 – encoding rules
For every statement, produce object code as a hex string.

**Format 2:** `opcode(8) r1(4) r2(4)`. `CLEAR r1`, `TIXR r1` → `r2 = 0`. `SHIFTL/SHIFTR r1,n` → `r2 = n−1`.

**Format 3/4 flags:** `n,i` from the operand prefix; `x` if `,X`; `e = 1` iff `+`.

**Format 3 displacement selection** (in this order):
1. `#number` (immediate constant): requires `0 ≤ n ≤ 4095`, `disp = n`, `b=p=0`. Otherwise error "constant too large for format 3, use +".
2. Operand is a symbol with address `TA` (this includes `#SYMBOL`, `@SYMBOL`, `SYMBOL,X`):
   a. **PC-relative:** `disp = TA − (LOC + 3)`; if `−2048 ≤ disp ≤ 2047` use it, `p=1`, store `disp & 0xFFF`.
   b. else **base-relative** if a `BASE` is active: `disp = TA − BASEADDR`; if `0 ≤ disp ≤ 4095` use it, `b=1`.
   c. else error "displacement out of range; use format 4 (+)".

**Format 4:** `address = TA` (or the immediate constant), 20 bits, `b=p=0`, `e=1`.

**Bytes:** `BYTE`/`WORD` emit their data; `RESB/RESW/START/END/BASE/NOBASE` emit nothing.

**Errors** (collect all, with line numbers, do not stop at the first): unknown mnemonic, undefined symbol, duplicate symbol, bad operand, displacement out of range, constant out of range, missing `START`/`END` (warning only).

### 5.6 Outputs (`AssemblerResult`)
1. **Listing:** `LINE  LOC  OBJECT  SOURCE` for every line (errors printed under the offending line).
2. **Symbol table:** sorted by address.
3. **Object program** (Beck format, all fields `^`-separated in the human-readable file):
   - `H^name(6, padded)^start(6 hex)^length(6 hex)`
   - `T^start(6 hex)^length(2 hex, ≤ 0x1E bytes)^object codes…` – start a new T record when a `RESB/RESW` gap occurs or 30 bytes are reached.
   - `M^address(6 hex)^05` for every **format-4 instruction whose operand is a symbol** (relocatable address; length = 5 half-bytes). Not for immediate constants.
   - `E^first-instruction address(6 hex)`
4. **Memory image:** `Map<Integer,Byte>` / byte array + start address + length + entry point, so the simulator can load directly without text parsing.

## 6. Simulator specification

### 6.1 Loader
- `Loader.load(ObjectProgram, Memory, Registers)`: write T-record bytes to memory at their addresses; set `PC = E-record address`. Applying M records is a no-op when loading at the assembled address (implement the hook anyway: optional `relocationOffset`).
- Also support `Loader.loadHex(startAddress, hexString)` for the "type machine code by hand" mode (minimal mode that must work from phase 1).

### 6.2 CPU
```java
public StepResult step();        // executes exactly one instruction
public RunResult run(int maxSteps, Predicate<Integer> breakpoint);
```
`step()` algorithm:
1. **Fetch:** read byte 0 at `PC`; determine the format from the opcode table (and from `e` for formats 3/4); read the remaining bytes.
2. **Decode:** build an immutable `DecodedInstruction` (`opcode, mnemonic, format, n,i,x,b,p,e, disp/address, r1, r2, length, rawBytesHex`).
3. **Advance PC** by the instruction length (so PC-relative uses the next-instruction address).
4. **Execute:** compute TA, fetch operand per 3.4, apply semantics.
5. Return a `StepResult` containing: `pcBefore`, `rawBytesHex`, a disassembly string (e.g. `TIX LIMIT` → `TIX 0014`, `LDX #1`), `TA` (nullable), operand value (nullable), `registerChanges` (name, old, new), `memoryChanges` (address, old bytes, new bytes), `pcAfter`, `ConditionCode` after, `halted`, `haltReason`.

Arithmetic: 24-bit wraparound; signed interpretation for compare/divide; display both hex (6 digits) and signed decimal.

### 6.3 Exceptions
`IllegalInstructionException`, `UnsupportedInstructionException`, `MemoryAccessException`, `ArithmeticSimException`. All carry the PC and raw bytes; the CLI/GUI shows a clear message and stops.

## 7. Architecture

```
sicxe-sim/
  pom.xml
  README.md
  examples/            sum1to5.asm, subroutine.asm, formats.asm, bytes.asm
  src/main/java/sicxe/
    core/    Memory, Registers, ConditionCode, Opcode (table), Format,
             DecodedInstruction, Decoder, CPU, StepResult, RunResult, *Exception
    asm/     SourceLine, Parser, SymbolTable, Assembler (pass1/pass2),
             Encoder, AssemblerResult, AsmError, ObjectProgram, ObjectWriter
    loader/  Loader, ObjectProgramReader
    cli/     Main, ReplSession, TraceFormatter
    gui/     MainFrame, RegisterPanel, MemoryPanel, ListingPanel (phase 4, optional)
  src/test/java/sicxe/   one test class per package + EndToEndTest
```

Design rules: small classes, no static mutable state, the `Opcode` table is the single source of truth for both assembler and simulator, public methods documented with Javadoc, no magic numbers (named constants for masks).

## 8. Command-line interface (phase 1–3 deliverable)

```
sicxe asm  <file.asm> [-o file.obj] [--list]       # assemble, print listing/symtab/object program
sicxe run  <file.asm|file.obj> [--trace] [--max-steps N] [--dump ADDR LEN]
sicxe repl [file.asm|file.obj]                      # interactive stepper
```

**REPL commands:** `load <file>`, `step|s [n]`, `run|r`, `regs`, `mem <hexaddr> [len]`, `break <hexaddr>`, `reset`, `list`, `help`, `quit`.

**Trace line format (one per step):**
```
#003 PC=000006  9010      ADDR X,A      | A: 000000 -> 000001
#004 PC=000008  2F2009    TIX LIMIT     | TA=000014 val=000006 | X: 000001 -> 000002 | CC=LT
#005 PC=00000B  3B2FF8    JLT LOOP      | TA=000006 | PC: 00000E -> 000006
```
After a run, print the final registers and (with `--dump`) a hex dump, plus the halt reason.

## 9. GUI (phase 4, only after phases 1–3 are green)

Swing window: left = source editor + **Assemble** button; centre = listing table; right = registers table (highlight values changed by the last step in a different colour) and condition code; bottom = memory hex-dump table (16 bytes per row, the row at `PC` highlighted, written bytes highlighted) and a console; toolbar = **Assemble, Load, Step, Run, Reset, Speed slider**. The GUI only calls `Assembler`, `Loader`, `CPU.step()`; no logic duplicated.

## 10. Implementation phases (with acceptance criteria)

| Phase | Deliverable | Done when |
|---|---|---|
| 1 | `Memory`, `Registers`, `Opcode` table, `Decoder`, `CPU.step()` for the core set, `Loader.loadHex`, CLI `run`/`repl` | Section 11.3 trace reproduced from hex `050001010000…` |
| 2 | Assembler pass 1 + pass 2, listing, symtab, H/T/E/M records, CLI `asm` | Section 11.1 and 11.2 outputs match; all 11.4 unit encodings pass |
| 3 | Integration: `run file.asm` assembles then loads then executes; error reporting; halt/max-steps; extended instructions | Section 11 end-to-end test passes; error-case tests pass |
| 4 | Swing GUI, `README.md` with usage and screenshots description, 3+ example programs | GUI reproduces 11.3 interactively |

After each phase run `mvn test`. Never leave the build red.

## 11. Worked example and tests

### 11.1 Sample program `examples/sum1to5.asm` (sums 1..5, expected result 15)
```
PROG    START   0
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
```

**Expected symbol table:** `PROG=0000, LOOP=0006, HALT=0011, LIMIT=0014, RESULT=0017`. Program length = `0x1A` (26 bytes).

**Expected object code:**

| LOC | Source | Object |
|---|---|---|
| 0000 | LDX #1 | 050001 |
| 0003 | LDA #0 | 010000 |
| 0006 | ADDR X,A | 9010 |
| 0008 | TIX LIMIT | 2F2009 |
| 000B | JLT LOOP | 3B2FF8 |
| 000E | STA RESULT | 0F2006 |
| 0011 | J HALT | 3F2FFD |
| 0014 | WORD 6 | 000006 |
| 0017 | RESW 1 | — |

**Expected object program:**
```
H^PROG  ^000000^00001A
T^000000^17^05000101000090102F20093B2FF80F20063F2FFD000006
E^000000
```
(No `M` records: the program has no format-4 symbol operands.)

Worked check for `TIX LIMIT`: opcode `2C` with `n=1,i=1` → byte `2F`; PC-relative so `xbpe = 0010 = 2`; `disp = 0x14 − (0x08 + 3) = 9` → `2F 2 009` = `2F2009`.

### 11.2 Expected execution (CC after each `TIX`)

| Iteration | After ADDR (A) | After TIX (X) | CC | JLT |
|---|---|---|---|---|
| 1 | 1 | 2 | LT | taken |
| 2 | 3 | 3 | LT | taken |
| 3 | 6 | 4 | LT | taken |
| 4 | 10 | 5 | LT | taken |
| 5 | 15 | 6 | EQ | not taken |

Then `STA RESULT` writes `00 00 0F` at `0x17..0x19`, then the simulator halts on `HALT J HALT` with reason "jump to self". Final registers: `A=00000F  X=000006  PC=000011`. Executed instructions: `LDX`, `LDA`, 5 × (`ADDR`, `TIX`, `JLT`), `STA`, and the final `J` = 19. Tests should assert registers and memory; assert the step count (19) only if the implementation counts the halting `J` as a step, and document that choice.

### 11.3 First trace lines (must match exactly in content, format may follow section 8)
```
#001 PC=000000  050001   LDX #1        | X: 000000 -> 000001
#002 PC=000003  010000   LDA #0        | A: 000000 -> 000000
#003 PC=000006  9010     ADDR X,A      | A: 000000 -> 000001
#004 PC=000008  2F2009   TIX LIMIT     | TA=000014 val=000006 | X: 000001 -> 000002 | CC=LT
#005 PC=00000B  3B2FF8   JLT LOOP      | TA=000006 | PC: 00000E -> 000006
#006 PC=000006  9010     ADDR X,A      | A: 000001 -> 000003
```

### 11.4 Single-instruction encoding unit tests (assembler must produce these)

| Context | Source | Expected |
|---|---|---|
| at 0000, `RETADR`=0030 | `STL RETADR` | `17202D` |
| at 0003, `LENGTH`=0033 | `LDB #LENGTH` | `69202D` |
| `RDREC`=1036 | `+JSUB RDREC` | `4B101036` |
| – | `COMP #0` | `290000` |
| – | `RSUB` | `4F0000` |
| after `BASE LENGTH` (LENGTH=0033), `BUFFER`=0036, too far for PC-relative | `STCH BUFFER,X` | `57C003` |
| – | `CLEAR X` | `B410` |
| – | `+LDT #4096` | `75101000` |
| – | `TIXR T` | `B850` |
| – | `COMPR A,S` | `A004` |
| – | `LDA #3` | `010003` |
| – | `ADDR X,A` | `9010` |

### 11.5 Additional required tests
- **Addressing modes:** immediate, indirect (`@`), indexed (`,X`), PC-relative negative and positive displacement, base-relative, format 4, standard SIC (`ni=00`).
- **Boundary displacements:** PC-relative exactly `+2047` and `−2048` (ok) and `+2048`, `−2049` (error without `BASE`/`+`).
- **Instruction semantics:** one test per core-set instruction, including `LDCH/STCH` byte handling, `MUL` wraparound, `DIV` by zero, `COMP/TIX/TIXR` for all three CC outcomes, `JSUB`/`RSUB` round trip (L holds the return address).
- **Errors:** undefined symbol, duplicate label, unknown mnemonic, out-of-range displacement; assembly must continue and report all errors with line numbers.
- **Directives:** `BYTE C'EOF'` → `454F46`, `BYTE X'F1'` → `F1`, `WORD -1` → `FFFFFF`, `RESB 4096` splits T records.
- **Halting:** jump-to-self, max-steps, PC outside program, unsupported instruction.
- **Round trip:** assemble `sum1to5.asm`, write the object program text, parse it back with `ObjectProgramReader`, load, run, assert `memory[0x17..0x19] = 00 00 0F`.

## 12. Deliverables
1. Complete Maven project that builds with `mvn clean package` and passes `mvn test`.
2. `examples/` with at least: `sum1to5.asm`, a subroutine example (`JSUB`/`RSUB`), a format-4 + base-relative example, a `BYTE`/`WORD` data example.
3. `README.md`: how to build and run, CLI usage, supported instruction set, non-goals, "Design decisions" (every choice made where this spec was silent), and known limitations.
4. A short `docs/DEMO.md` with the 7–10 minute demo script: assemble `sum1to5.asm`, show the symbol table, decode one instruction's `nixbpe` bits by hand, load into the simulator, step through the first loop iteration, `run` to the end, show `RESULT = 15`.

## 13. Quality rules
- Prefer clear, readable code over clever code; this project will be explained to a professor.
- Every public class and method has a one-line Javadoc.
- No `System.out` outside `cli`/`gui`.
- Do not hard-code the sample program anywhere in main code; it only appears in `examples/` and tests.
- When a hand-computed value in this spec conflicts with your implementation, re-derive it from sections 3–5, trust the derivation, and note the mismatch in `README.md`.
