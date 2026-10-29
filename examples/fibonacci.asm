FIB     START   0
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
