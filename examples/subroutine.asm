SUBPRG  START   1000
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
