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
