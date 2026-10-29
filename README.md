# SIC/XE Studio & CPU Simulator

A modern aesthetic two-pass assembler and cycle-accurate visual CPU architecture simulator for Leland Beck's **SIC/XE** (*Simplified Instructional Computer, Extra Equipment*), implemented in TypeScript and React.

---

## 1. Features

- **Two-Pass Assembler**:
  - **Pass 1**: Analyzes statements, calculates `LOCCTR`, identifies instruction formats (1, 2, 3, 4), directives (`START`, `END`, `BYTE`, `WORD`, `RESB`, `RESW`, `BASE`, `NOBASE`), and builds the Symbol Table.
  - **Pass 2**: Emits machine code according to Beck's rules. Automatically selects PC-relative displacement (`-2048..2047`) or Base-relative displacement (`0..4095`) when `BASE` is active, or alerts when Format 4 (`+`) is required.
  - **Beck Object Program**: Generates standard Header (`H`), Text (`T`), Modification (`M`), and End (`E`) records with `^` separators.
  - **Comprehensive Diagnostic Reporting**: Line-numbered syntax error markers, duplicate labels, undefined symbols, out-of-range displacements.

- **Cycle-Accurate CPU Simulator**:
  - **1 MB Byte-Addressable Memory** (`0x00000`–`0xFFFFF`), 24-bit big-endian words.
  - **Register Bank**: `A` (Accumulator), `X` (Index), `L` (Linkage), `B` (Base), `S` (General), `T` (General), `PC` (Program Counter), `SW` (Status Word).
  - **Condition Code (CC)**: `LT` (00), `EQ` (01), `GT` (10) mapped to lowest 2 bits of `SW`.
  - **Fetch → Decode → Execute Cycle**:
    - Dissects raw machine bytes into `op(6)`, `n`, `i`, `x`, `b`, `p`, `e`, displacement/address, `r1`, `r2`.
    - Computes Target Address (`TA`) dynamically and shows the mathematical formula in real time.
    - Resolves Immediate (`#`), Simple, Indirect (`@`), and Standard SIC modes.
  - **Real-Time Highlight Tracking**: Glowing pulses on registers and memory addresses modified by the latest instruction.
  - **Execution Control**: Step, continuous Run with configurable speed slider (20ms to 600ms), Pause, Reset, and Breakpoints.

- **Direct Machine Code / Hex Loader**:
  - Directly load raw hex strings (e.g. `05000101000090102F20093B2FF8...`) or paste Beck object programs without needing assembly source.

- **Interactive 7–10 Minute Demo Walkthrough**:
  - Guided interactive modal showcasing `sum1to5.asm`, symbol resolution, bitfield decoding of `TIX LIMIT`, step-by-step loop execution, and result verification (`RESULT = 15`).

---

## 2. Design Decisions

Where Leland Beck's *System Software* specification was silent or allowed implementation choices:

1. **Condition Code (CC) Representation**:
   - `LT` = `00` (binary 0)
   - `EQ` = `01` (binary 1)
   - `GT` = `10` (binary 2)
   - Stored in the low two bits of `SW` (`SW & 0x03`). Initial CC after reset is `EQ` (`SW = 1`).

2. **Halt Detection**:
   - Normal completion: An unconditional jump `J` to its own address (`HALT J HALT`). The simulator terminates with reason `"Jump to self (normal termination)"`.
   - Out-of-bounds: When PC moves outside the loaded program bounds or outside the 1 MB memory space.
   - Max step threshold: Default 100,000 steps to catch infinite loops.
   - Step count for `sum1to5.asm`: 19 instructions (LDX, LDA, 5 iterations of ADDR/TIX/JLT = 15, STA, plus the final halting J = 19).

3. **Format 3 Displacement Selection Precedence**:
   1. `#number` (immediate numeric literal): If `0 <= n <= 4095`, uses direct displacement (`b=0, p=0`). If outside this range, flags an error to use Format 4 (`+`).
   2. Target symbol:
      - First checks PC-relative: `disp = TA - (LOC + 3)`. If `-2048 <= disp <= 2047`, sets `p=1, b=0`.
      - If outside PC-relative range and `BASE` is active: `disp = TA - BASEADDR`. If `0 <= disp <= 4095`, sets `b=1, p=0`.
      - Otherwise flags an error: `"displacement out of range; use format 4 (+)"`.

4. **Modification (M) Records**:
   - Emitted for Format 4 instructions whose operand is a symbol (relocatable addresses). The length is 5 half-bytes (`M^address^05`). Numeric constants do not emit M-records.

5. **Directives**:
   - `START hex`: Program name from label (up to 6 characters, space-padded), initial LOCCTR.
   - `END [label]`: Optional entry point; defaults to START address if unspecified.
   - `WORD n`: 3 bytes, signed 24-bit two's complement.
   - `BYTE C'...'`: ASCII characters.
   - `BYTE X'...'`: Hex bytes (must be an even number of hex digits).
   - `RESB n` / `RESW n`: Reserve space (breaks T-records).

---

## 3. Supported Instruction Set

### Core Format 3/4
- **Load & Store**: `LDA`, `LDX`, `LDL`, `LDB`, `LDS`, `LDT`, `LDCH`, `STA`, `STX`, `STL`, `STB`, `STS`, `STT`, `STCH`
- **Arithmetic & Logic**: `ADD`, `SUB`, `MUL`, `DIV`, `AND`, `OR`
- **Compare & Test**: `COMP`, `TIX`
- **Jumps & Subroutines**: `J`, `JEQ`, `JGT`, `JLT`, `JSUB`, `RSUB`

### Core Format 2
- `ADDR`, `SUBR`, `MULR`, `DIVR`, `COMPR`, `CLEAR`, `TIXR`, `RMO`, `SHIFTL`, `SHIFTR`

### Unsupported Instructions
- Floating point (`FLOAT`, `FIX`, `NORM`, `LDF`, `STF`, `ADDF`, `SUBF`, `MULF`, `DIVF`, `COMPF`), I/O instructions (`RD`, `WD`, `TD`, `SIO`, `HIO`, `TIO`), and privileged instructions (`SVC`, `LPS`, `STI`, `STSW`, `SSK`) are identified and clearly raise `UnsupportedInstructionException` without crashing.

---

## 4. Running the Tests

To run the unit test suite verifying single-instruction encodings (Section 11.4), assembler output (Section 11.1), and CPU execution trace (Section 11.2 & 11.3):

```bash
npx --yes tsx --test src/sicxe/sicxe.test.ts
```
