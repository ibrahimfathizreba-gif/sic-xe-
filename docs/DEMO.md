# SIC/XE 7–10 Minute Live Demonstration Script

This script walks through a comprehensive live demo of the SIC/XE Assembler and CPU Simulator for presentations and grading reviews.

---

## Step 1: Program Overview & Two-Pass Assembly (1.5 Minutes)

1. **Select Example**: Click the **Program** dropdown in the top bar and choose **"Sum 1 to 5 (Beck Section 11)"**.
2. **Examine Source Code**:
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
3. **Assemble & Load**: Click **"Assemble & Load"**.
   - Pass 1 computes `LOCCTR` for each line and identifies the program length: `0x00001A` (26 bytes).
   - Pass 2 translates each instruction into machine code and loads it directly into simulated memory at `0x000000`.

---

## Step 2: Symbol Table & Object Records Inspection (1.5 Minutes)

1. Click the **"Symbol Table"** tab in the left panel:
   - `PROG`: `0x000000`
   - `LOOP`: `0x000006`
   - `HALT`: `0x000011`
   - `LIMIT`: `0x000014`
   - `RESULT`: `0x000017`
2. Click the **"Object Program"** tab:
   - **Header (H)**: `H^PROG  ^000000^00001A`
   - **Text (T)**: `T^000000^17^05000101000090102F20093B2FF80F20063F2FFD000006`
   - **End (E)**: `E^000000`

---

## Step 3: Bitfield Decoding by Hand: `TIX LIMIT` (2 Minutes)

1. Look at instruction line 5 in the **Listing & Step** panel:
   - Location: `0x000008`
   - Source: `TIX LIMIT`
   - Object Code: `2F2009`
2. **Decode `2F2009` step by step**:
   - `TIX` opcode is `0x2C` (`00101100` binary).
   - Low 2 bits of byte 0 are `n` and `i`. Since it is simple addressing (`LIMIT` is a symbol), `n=1, i=1` (`11` binary).
   - First byte = `(0x2C & 0xFC) | 0x03 = 0x2F`.
   - Flags `x b p e`:
     - Not indexed (`x=0`)
     - Not base-relative (`b=0`)
     - PC-relative (`p=1`): Target address `LIMIT` is at `0x000014`. Next PC will be `0x000008 + 3 = 0x00000B`.
       Displacement = `0x000014 - 0x00000B = 0x000009`.
     - Standard 3-byte format (`e=0`).
     - Flags `xbpe = 0010` = `0x2`.
   - Putting it together: `2F` (byte 0), `2` (high nibble byte 1), `009` (disp) $\to$ **`2F2009`**!
3. Notice how the center panel's **Instruction Pipeline & Bitfield Decoder** displays this breakdown automatically when the CPU reaches `0x000008`.

---

## Step 4: Step Through Loop Iteration 1 (1.5 Minutes)

1. Click **"Step"** to execute `LDX #1`:
   - Register `X` turns amber and updates to `0x000001` (1).
2. Click **"Step"** to execute `LDA #0`:
   - Register `A` updates to `0x000000` (0).
3. Click **"Step"** to execute `ADDR X,A`:
   - Register `A` becomes `0x000001` (1).
4. Click **"Step"** to execute `TIX LIMIT`:
   - Register `X` increments to `0x000002` (2).
   - CPU compares `X` (2) with `LIMIT` (6).
   - Since $2 < 6$, the **Condition Code (CC)** becomes **`LT`** (Less Than).
5. Click **"Step"** to execute `JLT LOOP`:
   - Condition matches! PC jumps back to `LOOP` (`0x000006`).

---

## Step 5: Continuous Run & Final Result Verification (1.5 Minutes)

1. Adjust the **Speed slider** in the top bar to `80ms`.
2. Click **"Run"**.
3. Watch the loop execute smoothly across 5 iterations:
   - Iteration 1: $A = 1, X = 2, CC = LT$
   - Iteration 2: $A = 3, X = 3, CC = LT$
   - Iteration 3: $A = 6, X = 4, CC = LT$
   - Iteration 4: $A = 10, X = 5, CC = LT$
   - Iteration 5: $A = 15, X = 6, CC = EQ$
4. On iteration 5, when $X = 6$, `TIX LIMIT` sets CC to **`EQ`**.
5. `JLT LOOP` is **not taken**! Execution continues to `STA RESULT`.
6. `STA RESULT` stores `0x00000F` (15) into memory at `0x000017`.
7. `HALT J HALT` executes, jumping to itself $\to$ CPU detects normal termination and halts cleanly!
8. **Check Memory Matrix**:
   - Click the **"RESULT (0x17)"** quick jump button in the Memory tab.
   - Address `0x000017` displays `00 00 0F` highlighted in emerald green!
   - Register `A` = `0x00000F` ($15_{10}$).
   - Register `X` = `0x000006` ($6_{10}$).
   - Total step count = **19 instructions**.
