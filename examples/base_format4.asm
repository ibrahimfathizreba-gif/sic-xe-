EXTPRG  START   0
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
