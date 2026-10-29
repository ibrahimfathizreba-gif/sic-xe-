/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Pause, StepForward, RotateCcw, Cpu, Code2, BookOpen, Sparkles, HelpCircle } from 'lucide-react';
import { EXAMPLES, ExampleProgram } from '../sicxe/examples.ts';

interface HeaderProps {
  selectedExampleId: string;
  onSelectExample: (example: ExampleProgram) => void;
  onAssemble: () => void;
  onStep: () => void;
  onRunToggle: () => void;
  onReset: () => void;
  isRunning: boolean;
  isHalted: boolean;
  stepSpeed: number;
  onSpeedChange: (speed: number) => void;
  onOpenDemo: () => void;
  onOpenCheatSheet: () => void;
  stepCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  selectedExampleId,
  onSelectExample,
  onAssemble,
  onStep,
  onRunToggle,
  onReset,
  isRunning,
  isHalted,
  stepSpeed,
  onSpeedChange,
  onOpenDemo,
  onOpenCheatSheet,
  stepCount,
}) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 select-none">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm shadow-inner">
          <Cpu className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white tracking-tight text-base font-sans">
              SIC/XE Studio
            </span>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
              SIMULATOR & ASM
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
            Beck System Software · Two-Pass Assembler & Cycle-Accurate CPU
          </p>
        </div>
      </div>

      {/* Zone 2: Navigation, Examples & Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Example Selector */}
        <div className="flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs text-slate-300">
          <Code2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 text-[11px] font-sans">Program:</span>
          <select
            value={selectedExampleId}
            onChange={(e) => {
              const ex = EXAMPLES.find((item) => item.id === e.target.value);
              if (ex) onSelectExample(ex);
            }}
            className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-1"
          >
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id} className="bg-slate-900 text-slate-200">
                {ex.title}
              </option>
            ))}
          </select>
        </div>

        {/* Speed Slider */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-1 text-xs text-slate-300">
          <span className="text-slate-400 text-[11px]">Speed:</span>
          <input
            type="range"
            min="20"
            max="600"
            step="20"
            value={stepSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-20 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            title={`${stepSpeed}ms delay between instructions`}
          />
          <span className="font-mono text-[11px] text-cyan-300 min-w-9 text-right">
            {stepSpeed}ms
          </span>
        </div>

        {/* Assemble Button */}
        <button
          onClick={onAssemble}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600/70 rounded-lg transition-colors shadow-sm"
          title="Run Pass 1 & Pass 2, produce Object Code and load into Memory"
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Assemble & Load</span>
        </button>

        {/* Execution Stepper Buttons */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 shadow-sm">
          {/* Step Forward */}
          <button
            onClick={onStep}
            disabled={isRunning || isHalted}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-700/80 disabled:opacity-40 disabled:hover:bg-transparent rounded-md transition-colors"
            title="Execute exactly one instruction (Step)"
          >
            <StepForward className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-sans">Step</span>
          </button>

          {/* Run / Pause */}
          <button
            onClick={onRunToggle}
            disabled={isHalted}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
            } disabled:opacity-40`}
            title={isRunning ? 'Pause CPU execution' : 'Run CPU continuously'}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 rounded-md transition-colors"
            title="Reset CPU registers and reload program"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone 3: Interactive Guide & Reference Modal Triggers */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDemo}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-700/50 rounded-lg transition-colors"
          title="Launch 7-10 minute presentation walkthrough script"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Demo Script</span>
        </button>

        <button
          onClick={onOpenCheatSheet}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors"
          title="Architecture Reference & nixbpe guide"
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Reference</span>
        </button>
      </div>
    </header>
  );
};
