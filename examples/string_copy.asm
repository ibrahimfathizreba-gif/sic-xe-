STRCPY  START   0
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
