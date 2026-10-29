/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { EditorPanel } from './components/EditorPanel.tsx';
import { CpuPipeline } from './components/CpuPipeline.tsx';
import { InspectorPanel } from './components/InspectorPanel.tsx';
import { DemoModal } from './components/DemoModal.tsx';
import { CheatSheetModal } from './components/CheatSheetModal.tsx';

import { Assembler } from './sicxe/assembler.ts';
import { CPU } from './sicxe/cpu.ts';
import { Memory } from './sicxe/memory.ts';
import { Registers } from './sicxe/registers.ts';
import { Loader } from './sicxe/loader.ts';
import { Decoder } from './sicxe/decoder.ts';
import { EXAMPLES, ExampleProgram } from './sicxe/examples.ts';
import {
  AssemblerResult,
  ConditionCode,
  DecodedInstruction,
  MemoryChange,
  RegisterChange,
  RegisterId,
} from './sicxe/types.ts';

export default function App() {
  // Core SIC/XE machine state instances (persisted in refs)
  const memoryRef = useRef<Memory>(new Memory());
  const registersRef = useRef<Registers>(new Registers());
  const cpuRef = useRef<CPU>(new CPU(memoryRef.current, registersRef.current));

  // Application State
  const [selectedExample, setSelectedExample] = useState<ExampleProgram>(EXAMPLES[0]);
  const [sourceCode, setSourceCode] = useState<string>(EXAMPLES[0].source);
  const [asmResult, setAsmResult] = useState<AssemblerResult | null>(null);

  // CPU Live State
  const [registers, setRegisters] = useState<Record<RegisterId, number>>({
    A: 0,
    X: 0,
    L: 0,
    B: 0,
    S: 0,
    T: 0,
    F: 0,
    PC: 0,
    SW: 1, // CC = EQ
  });
  const [conditionCode, setConditionCode] = useState<ConditionCode>('EQ');
  const [currentInstruction, setCurrentInstruction] = useState<DecodedInstruction | null>(null);
  const [changedRegisters, setChangedRegisters] = useState<RegisterChange[]>([]);
  const [memoryChanges, setMemoryChanges] = useState<MemoryChange[]>([]);
  const [stepCount, setStepCount] = useState<number>(0);
  const [isHalted, setIsHalted] = useState<boolean>(false);
  const [haltReason, setHaltReason] = useState<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stepSpeed, setStepSpeed] = useState<number>(100);
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());

  // Modal Dialogs
  const [isDemoOpen, setIsDemoOpen] = useState<boolean>(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState<boolean>(false);

  // Sync state from internal machine refs
  const syncMachineState = useCallback(() => {
    const regs = registersRef.current;
    const cpu = cpuRef.current;

    setRegisters(regs.cloneValues());
    setConditionCode(regs.getConditionCode());
    setStepCount(cpu.stepCount);
    setIsHalted(cpu.halted);
    setHaltReason(cpu.haltReason);

    // Try to decode current instruction at PC for preview
    const pc = regs.get('PC');
    if (pc >= 0 && pc < memoryRef.current.size && !cpu.halted) {
      try {
        const decoded = Decoder.decode(pc, memoryRef.current, regs);
        setCurrentInstruction(decoded);
      } catch {
        // If un-decodable bytes or at end
        setCurrentInstruction(null);
      }
    } else {
      setCurrentInstruction(null);
    }
  }, []);

  // Assemble and load routine
  const handleAssembleAndLoad = useCallback(
    (customSource?: string) => {
      setIsRunning(false);
      const codeToAssemble = customSource ?? sourceCode;
      const res = Assembler.assemble(codeToAssemble);
      setAsmResult(res);

      if (res.success && res.objectProgram) {
        // Reset memory & registers
        memoryRef.current.clear();
        registersRef.current.reset(res.startAddress);

        // Load into memory
        Loader.load(res.objectProgram, memoryRef.current, registersRef.current);

        // Recreate CPU instance
        cpuRef.current = new CPU(memoryRef.current, registersRef.current);
        cpuRef.current.setProgramBounds(res.startAddress, res.programLength);

        setChangedRegisters([]);
        setMemoryChanges([]);
        setTraceLogs([
          `[Assembler] Successfully assembled '${res.objectProgram.header.progName.trim()}' (${res.programLength} bytes).`,
          `[Loader] Loaded object program at 0x${res.startAddress.toString(16).padStart(6, '0').toUpperCase()}. Entry PC: 0x${res.firstExecAddress.toString(16).padStart(6, '0').toUpperCase()}.`,
        ]);

        syncMachineState();
      } else {
        setTraceLogs((prev) => [
          ...prev,
          `[Assembler Error] Assembly failed with ${res.errors.length} error(s).`,
        ]);
      }
    },
    [sourceCode, syncMachineState]
  );

  // Execute a single step
  const handleStep = useCallback(() => {
    if (cpuRef.current.halted) return;

    try {
      const result = cpuRef.current.step();

      setChangedRegisters(result.registerChanges);
      setMemoryChanges(result.memoryChanges);
      setTraceLogs((prev) => [...prev, result.traceLine]);

      syncMachineState();

      // Check breakpoint after step
      const currentPc = registersRef.current.get('PC');
      if (breakpoints.has(currentPc)) {
        setIsRunning(false);
        setTraceLogs((prev) => [
          ...prev,
          `[Breakpoint] Paused at PC: 0x${currentPc.toString(16).padStart(6, '0').toUpperCase()}`,
        ]);
      }
    } catch (err: unknown) {
      setIsRunning(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      setIsHalted(true);
      setHaltReason(errMsg);
      setTraceLogs((prev) => [...prev, `[CPU Exception] ${errMsg}`]);
      syncMachineState();
    }
  }, [breakpoints, syncMachineState]);

  // Run timer loop
  useEffect(() => {
    if (!isRunning || isHalted) return;

    const timer = setInterval(() => {
      const pc = registersRef.current.get('PC');
      if (breakpoints.has(pc) && stepCount > 0) {
        setIsRunning(false);
        setTraceLogs((prev) => [
          ...prev,
          `[Breakpoint Hit] Stopped at PC: 0x${pc.toString(16).padStart(6, '0').toUpperCase()}`,
        ]);
        return;
      }

      if (cpuRef.current.halted) {
        setIsRunning(false);
        return;
      }

      handleStep();
    }, stepSpeed);

    return () => clearInterval(timer);
  }, [isRunning, isHalted, stepSpeed, handleStep, breakpoints, stepCount]);

  // Reset CPU
  const handleReset = useCallback(() => {
    setIsRunning(false);
    if (asmResult && asmResult.objectProgram) {
      memoryRef.current.clear();
      Loader.load(asmResult.objectProgram, memoryRef.current, registersRef.current);
      cpuRef.current = new CPU(memoryRef.current, registersRef.current);
      cpuRef.current.setProgramBounds(asmResult.startAddress, asmResult.programLength);
    } else {
      registersRef.current.reset(0);
      cpuRef.current = new CPU(memoryRef.current, registersRef.current);
    }

    setChangedRegisters([]);
    setMemoryChanges([]);
    setTraceLogs((prev) => [...prev, '[CPU Reset] Registers restored to initial state.']);
    syncMachineState();
  }, [asmResult, syncMachineState]);

  // Select example program
  const handleSelectExample = useCallback(
    (example: ExampleProgram) => {
      setSelectedExample(example);
      setSourceCode(example.source);
      handleAssembleAndLoad(example.source);
    },
    [handleAssembleAndLoad]
  );

  // Direct hex loading
  const handleLoadDirectHex = useCallback(
    (startAddr: number, hexString: string) => {
      setIsRunning(false);
      try {
        memoryRef.current.clear();
        Loader.loadHex(startAddr, hexString, memoryRef.current, registersRef.current);
        cpuRef.current = new CPU(memoryRef.current, registersRef.current);
        setChangedRegisters([]);
        setMemoryChanges([]);
        setTraceLogs([
          `[Direct Hex Loader] Loaded ${hexString.length / 2} bytes at 0x${startAddr.toString(16).padStart(6, '0').toUpperCase()}.`,
        ]);
        syncMachineState();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTraceLogs((prev) => [...prev, `[Loader Error] ${msg}`]);
      }
    },
    [syncMachineState]
  );

  // Direct object program loading
  const handleLoadDirectObjText = useCallback(
    (text: string) => {
      setIsRunning(false);
      try {
        memoryRef.current.clear();
        const info = Loader.parseAndLoadText(text, memoryRef.current, registersRef.current);
        cpuRef.current = new CPU(memoryRef.current, registersRef.current);
        cpuRef.current.setProgramBounds(info.startAddr, info.length);
        setChangedRegisters([]);
        setMemoryChanges([]);
        setTraceLogs([
          `[Object Loader] Loaded program '${info.progName}' (${info.length} bytes). Entry PC: 0x${info.entryPoint.toString(16).padStart(6, '0').toUpperCase()}.`,
        ]);
        syncMachineState();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTraceLogs((prev) => [...prev, `[Object Loader Error] ${msg}`]);
      }
    },
    [syncMachineState]
  );

  // Toggle breakpoint
  const handleToggleBreakpoint = useCallback((loc: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(loc)) {
        next.delete(loc);
      } else {
        next.add(loc);
      }
      return next;
    });
  }, []);

  // Initial assembly on mount
  useEffect(() => {
    handleAssembleAndLoad(EXAMPLES[0].source);
  }, []);

  // Get RESULT memory word for demo verification
  const resultMemVal = memoryRef.current.getWord(0x0017);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden selection:bg-cyan-900/60 selection:text-white">
      {/* Top Bar Header */}
      <Header
        selectedExampleId={selectedExample.id}
        onSelectExample={handleSelectExample}
        onAssemble={() => handleAssembleAndLoad()}
        onStep={handleStep}
        onRunToggle={() => setIsRunning(!isRunning)}
        onReset={handleReset}
        isRunning={isRunning}
        isHalted={isHalted}
        stepSpeed={stepSpeed}
        onSpeedChange={setStepSpeed}
        onOpenDemo={() => setIsDemoOpen(true)}
        onOpenCheatSheet={() => setIsCheatSheetOpen(true)}
        stepCount={stepCount}
      />

      {/* Main 3-Column Studio Workspace */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left Column: Editor & Object Program (4 Cols) */}
        <div className="lg:col-span-4 h-full min-h-0">
          <EditorPanel
            sourceCode={sourceCode}
            onSourceChange={setSourceCode}
            asmResult={asmResult}
            onAssemble={() => handleAssembleAndLoad()}
            onLoadDirectHex={handleLoadDirectHex}
            onLoadDirectObjText={handleLoadDirectObjText}
          />
        </div>

        {/* Center Column: CPU Pipeline & Registers Bank (4 Cols) */}
        <div className="lg:col-span-4 h-full min-h-0">
          <CpuPipeline
            currentInstruction={currentInstruction}
            registers={registers}
            conditionCode={conditionCode}
            changedRegisters={changedRegisters}
            stepCount={stepCount}
            isHalted={isHalted}
            haltReason={haltReason}
            isRunning={isRunning}
          />
        </div>

        {/* Right Column: Listing, Memory Matrix & Trace Log (4 Cols) */}
        <div className="lg:col-span-4 h-full min-h-0">
          <InspectorPanel
            listing={asmResult?.listing || []}
            currentPc={registers.PC}
            memory={memoryRef.current}
            memoryChanges={memoryChanges}
            traceLogs={traceLogs}
            onClearTrace={() => setTraceLogs([])}
            breakpoints={breakpoints}
            onToggleBreakpoint={handleToggleBreakpoint}
          />
        </div>
      </main>

      {/* Demo Walkthrough Script Modal */}
      <DemoModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        onLoadAndAssembleDemo={() => {
          setSelectedExample(EXAMPLES[0]);
          setSourceCode(EXAMPLES[0].source);
          handleAssembleAndLoad(EXAMPLES[0].source);
        }}
        onStep={handleStep}
        onRun={() => setIsRunning(true)}
        onReset={handleReset}
        stepCount={stepCount}
        regA={registers.A}
        regX={registers.X}
        resultMemoryWord={resultMemVal}
      />

      {/* Architecture Cheatsheet Modal */}
      <CheatSheetModal isOpen={isCheatSheetOpen} onClose={() => setIsCheatSheetOpen(false)} />
    </div>
  );
}
