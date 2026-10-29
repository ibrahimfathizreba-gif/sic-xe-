/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, ChevronRight, Play, StepForward, Code2, Cpu, HardDrive } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadAndAssembleDemo: () => void;
  onStep: () => void;
  onRun: () => void;
  onReset: () => void;
  stepCount: number;
  regA: number;
  regX: number;
  resultMemoryWord: number;
}

export const DemoModal: React.FC<DemoModalProps> = ({
  isOpen,
  onClose,
  onLoadAndAssembleDemo,
  onStep,
  onRun,
  onReset,
  stepCount,
  regA,
  regX,
  resultMemoryWord,
}) => {
  const [currentStep, setCurrentStep] = useState(1);

  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      title: '1. Program Structure & Pass 1 LOCCTR',
      desc: 'Assemble the sample program sum1to5.asm. Pass 1 calculates the LOCCTR for each statement, determining the size of each instruction and directive. The total program length is 0x1A (26 bytes).',
      actionLabel: 'Assemble sum1to5.asm',
      actionIcon: <Code2 className="w-4 h-4" />,
      action: onLoadAndAssembleDemo,
      notes: 'Watch the Editor tab switch to Listing and Symbol Table. Program starts at 0x0000 and ends with E^000000.',
    },
    {
      num: 2,
      title: '2. Symbol Table & Label Addresses',
      desc: 'Pass 1 establishes the symbol table: PROG=0000, LOOP=0006, HALT=0011, LIMIT=0014, RESULT=0017. All future label references resolve against these exact addresses.',
      actionLabel: 'Reset & Prepare CPU',
      actionIcon: <Cpu className="w-4 h-4" />,
      action: onReset,
      notes: 'Notice how LIMIT (0x0014) is placed right after the halting J instruction at 0x0011.',
    },
    {
      num: 3,
      title: '3. Hand-Decode nixbpe Bits: TIX LIMIT (0x0008)',
      desc: 'Examine the instruction at 0x0008: 2F 20 09. Opcode 2C with n=1, i=1 yields 2F. PC-relative displacement: disp = 0x14 - (0x08 + 3) = 0x09. Thus xbpe = 0010 = 2, yielding object code 2F2009!',
      actionLabel: 'Step 1 (Fetch LDX #1)',
      actionIcon: <StepForward className="w-4 h-4" />,
      action: onStep,
      notes: 'Look at the Instruction Pipeline bitfield decoder card in the center panel: every bit is highlighted in real time!',
    },
    {
      num: 4,
      title: '4. Step Through First Loop Iteration',
      desc: 'Watch registers A and X evolve. Step through LDX #1, LDA #0, then loop body: ADDR X,A (A becomes 1), TIX LIMIT (X increments to 2, compares to 6 -> CC is LT), and JLT LOOP (jump taken back to 0x0006).',
      actionLabel: 'Execute Next Step',
      actionIcon: <StepForward className="w-4 h-4" />,
      action: onStep,
      notes: 'Current registers: A = ' + regA + ', X = ' + regX + ', Step: ' + stepCount,
    },
    {
      num: 5,
      title: '5. Run to Completion & Verify RESULT = 15',
      desc: 'Run the remaining loop cycles until X reaches 6, making CC equal to EQ. JLT is not taken, STA writes 15 (0x00000F) into memory address 0x0017 (RESULT), and the CPU halts on HALT J HALT.',
      actionLabel: 'Run CPU to Halt',
      actionIcon: <Play className="w-4 h-4" />,
      action: onRun,
      notes: 'Verification: Final A = 15 (0x0F), Final X = 6 (0x06), Memory[0x17] = ' + resultMemoryWord + '.',
    },
  ];

  const current = steps[currentStep - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">7–10 Minute Demo Walkthrough</h3>
              <p className="text-xs text-slate-400">Interactive live presentation script for grading & review</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Dots */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80">
          {steps.map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-1.5 text-xs font-medium py-1 px-2.5 rounded-lg transition-colors ${
                currentStep === s.num
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === s.num ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {s.num}
              </span>
              <span className="hidden sm:inline">Step {s.num}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div>
            <h4 className="text-base font-semibold text-white mb-1.5">{current.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{current.desc}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="text-[11px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">
              Presenter Notes & Verification:
            </div>
            <p className="text-slate-300 font-mono text-[11px] leading-relaxed">{current.notes}</p>
          </div>

          {/* Machine Live State Snapshot */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
            <div>
              <span className="text-[10px] text-slate-500 block">Step Count</span>
              <span className="text-amber-300 font-bold">{stepCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Register A</span>
              <span className="text-cyan-300 font-bold">{regA} (0x{regA.toString(16).toUpperCase()})</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Register X</span>
              <span className="text-emerald-300 font-bold">{regX}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">RESULT (0x17)</span>
              <span className="text-purple-300 font-bold">{resultMemoryWord}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={current.action}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            {current.actionIcon}
            <span>{current.actionLabel}</span>
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Previous
              </button>
            )}
            {currentStep < steps.length ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
