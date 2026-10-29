/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Cpu, Binary, Calculator, CheckCircle2, AlertTriangle, ArrowRight, Gauge } from 'lucide-react';
import { ConditionCode, DecodedInstruction, RegisterChange, RegisterId } from '../sicxe/types.ts';
import { formatHex20, formatHex24, toSigned24 } from '../sicxe/registers.ts';

interface CpuPipelineProps {
  currentInstruction: DecodedInstruction | null;
  registers: Record<RegisterId, number>;
  conditionCode: ConditionCode;
  changedRegisters: RegisterChange[];
  stepCount: number;
  isHalted: boolean;
  haltReason?: string;
  isRunning: boolean;
}

export const CpuPipeline: React.FC<CpuPipelineProps> = ({
  currentInstruction,
  registers,
  conditionCode,
  changedRegisters,
  stepCount,
  isHalted,
  haltReason,
  isRunning,
}) => {
  const isChanged = (reg: RegisterId) => changedRegisters.some((c) => c.reg === reg);

  const registerList: Array<{ id: RegisterId; name: string; desc: string }> = [
    { id: 'A', name: 'A (Accumulator)', desc: 'Primary 24-bit arithmetic & data register' },
    { id: 'X', name: 'X (Index)', desc: 'Index register for array/indexed addressing' },
    { id: 'L', name: 'L (Linkage)', desc: 'Return address for subroutine jumps (JSUB)' },
    { id: 'B', name: 'B (Base)', desc: 'Base address for base-relative addressing' },
    { id: 'S', name: 'S (General)', desc: 'General-purpose working register' },
    { id: 'T', name: 'T (General)', desc: 'General-purpose working register' },
    { id: 'PC', name: 'PC (Program Counter)', desc: 'Address of the next instruction to fetch' },
    { id: 'SW', name: 'SW (Status Word)', desc: 'Status register including condition code (CC)' },
  ];

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
      {/* 1. Instruction Fetch & Bitfield Decoder Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200 tracking-wide font-sans">
              Instruction Pipeline & Bitfield Decoder
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {currentInstruction ? (
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded">
                Format {currentInstruction.format} ({currentInstruction.length} bytes)
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-500">Awaiting step</span>
            )}
          </div>
        </div>

        {currentInstruction ? (
          <div className="space-y-3">
            {/* Instruction Summary Bar */}
            <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Disassembly</span>
                <span className="font-mono text-base font-bold text-white tracking-wide">
                  {currentInstruction.disassembly}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Raw Machine Bytes</span>
                <span className="font-mono text-sm font-semibold text-amber-300 tracking-widest">
                  {currentInstruction.rawBytesHex.match(/.{1,2}/g)?.join(' ')}
                </span>
              </div>
            </div>

            {/* nixbpe Interactive Flag Breakdown for Formats 3 and 4 */}
            {(currentInstruction.format === 3 || currentInstruction.format === 4) && (
              <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-sans font-medium">Addressing Flags (n i x b p e)</span>
                  <span className="font-mono text-cyan-400 text-[11px]">
                    Mode: <strong className="text-white uppercase">{currentInstruction.addressingMode}</strong>
                  </span>
                </div>

                {/* 6 Flags Grid */}
                <div className="grid grid-cols-6 gap-1.5 text-center font-mono">
                  {/* n flag */}
                  <div className={`p-1 rounded border transition-colors ${
                    currentInstruction.n ? 'bg-cyan-950/70 border-cyan-600/70 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <div className="text-[10px] font-sans font-bold text-slate-400">n</div>
                    <div className="text-xs font-bold">{currentInstruction.n ?? 0}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate" title="Indirect (1 = indirect / simple)">
                      {currentInstruction.n ? 'Indirect' : '—'}
                    </div>
                  </div>

                  {/* i flag */}
                  <div className={`p-1 rounded border transition-colors ${
                    currentInstruction.i ? 'bg-cyan-950/70 border-cyan-600/70 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <div className="text-[10px] font-sans font-bold text-slate-400">i</div>
                    <div className="text-xs font-bold">{currentInstruction.i ?? 0}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate" title="Immediate (1 = immediate / simple)">
                      {currentInstruction.i ? 'Immed' : '—'}
                    </div>
                  </div>

                  {/* x flag */}
                  <div className={`p-1 rounded border transition-colors ${
                    currentInstruction.x ? 'bg-amber-950/70 border-amber-600/70 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <div className="text-[10px] font-sans font-bold text-slate-400">x</div>
                    <div className="text-xs font-bold">{currentInstruction.x ?? 0}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate" title="Indexed addressing (1 = add register X)">
                      {currentInstruction.x ? 'Indexed' : '—'}
                    </div>
                  </div>

                  {/* b flag */}
                  <div className={`p-1 rounded border transition-colors ${
                    currentInstruction.b ? 'bg-purple-950/70 border-purple-600/70 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <div className="text-[10px] font-sans font-bold text-slate-400">b</div>
                    <div className="text-xs font-bold">{currentInstruction.b ?? 0}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate" title="Base relative (1 = add register B)">
                      {currentInstruction.b ? 'Base-rel' : '—'}
                    </div>
                  </div>

                  {/* p flag */}
                  <div className={`p-1 rounded border transition-colors ${
                    currentInstruction.p ? 'bg-emerald-950/70 border-emerald-600/70 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <div className="text-[10px] font-sans font-bold text-slate-400">p</div>
                    <div className="text-xs font-bold">{currentInstruction.p ?? 0}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate" title="PC relative (1 = add next PC)">
                      {currentInstruction.p ? 'PC-rel' : '—'}
                    </div>
                  </div>

                  {/* e flag */}
                  <div className={`p-1 rounded border transition-colors ${
                    currentInstruction.e ? 'bg-rose-950/70 border-rose-600/70 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <div className="text-[10px] font-sans font-bold text-slate-400">e</div>
                    <div className="text-xs font-bold">{currentInstruction.e ?? 0}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate" title="Extended Format 4 (1 = 20-bit address)">
                      {currentInstruction.e ? 'Fmt 4' : '—'}
                    </div>
                  </div>
                </div>

                {/* Target Address Calculation Formula */}
                {currentInstruction.targetAddress !== undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-slate-400 text-[11px]">Formula:</span>
                      <span className="font-mono text-cyan-200 text-[11px]">{currentInstruction.taFormula}</span>
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-slate-400 text-[11px]">TA: </span>
                      <span className="font-bold text-amber-300">
                        0x{formatHex20(currentInstruction.targetAddress)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Format 2 Register breakdown */}
            {currentInstruction.format === 2 && (
              <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-2.5 flex items-center justify-around text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Register 1 (r1)</span>
                  <span className="text-cyan-300 font-bold text-sm">
                    {currentInstruction.r1 || `r${currentInstruction.r1Num}`}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">
                    {currentInstruction.shiftAmount !== undefined ? 'Shift Amount' : 'Register 2 (r2)'}
                  </span>
                  <span className="text-amber-300 font-bold text-sm">
                    {currentInstruction.shiftAmount !== undefined
                      ? `${currentInstruction.shiftAmount} bits`
                      : currentInstruction.r2 || `r${currentInstruction.r2Num}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs">
            <p>Click "Step" or "Run" to fetch and decode the first instruction at PC.</p>
          </div>
        )}
      </div>

      {/* 2. Condition Code (CC) Status */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-300">Condition Code (CC)</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              conditionCode === 'LT'
                ? 'bg-rose-950/90 text-rose-300 border border-rose-600 shadow-sm'
                : 'bg-slate-950 text-slate-600 border border-slate-800'
            }`}
          >
            LT (00)
          </span>
          <span
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              conditionCode === 'EQ'
                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-600 shadow-sm'
                : 'bg-slate-950 text-slate-600 border border-slate-800'
            }`}
          >
            EQ (01)
          </span>
          <span
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              conditionCode === 'GT'
                ? 'bg-blue-950/90 text-blue-300 border border-blue-600 shadow-sm'
                : 'bg-slate-950 text-slate-600 border border-slate-800'
            }`}
          >
            GT (10)
          </span>
        </div>
      </div>

      {/* 3. Registers Bank */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 shadow-md flex-1 flex flex-col">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Binary className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200 tracking-wide font-sans">
              24-Bit Register Bank
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Step Count: <strong className="text-white">{stepCount}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
          {registerList.map((reg) => {
            const val = registers[reg.id];
            const signedVal = toSigned24(val);
            const changed = isChanged(reg.id);

            return (
              <div
                key={reg.id}
                title={reg.desc}
                className={`p-2 rounded-lg border transition-all ${
                  changed
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-sans font-semibold text-slate-300">{reg.id}</span>
                  {changed && (
                    <span className="text-[9px] font-mono text-amber-400 uppercase tracking-tighter">Updated</span>
                  )}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-white tracking-wider">
                  0x{formatHex24(val)}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                  Dec: <span className="text-slate-300">{signedVal}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Halt status alert banner if CPU halted */}
        {isHalted && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold">Execution Halted:</span> {haltReason || 'Normal completion'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
