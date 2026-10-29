/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { List, HardDrive, Terminal, ArrowRight, CornerDownRight, Copy, Check, Trash2, Search } from 'lucide-react';
import { ListingLine, MemoryChange } from '../sicxe/types.ts';
import { formatHex20, formatHex24 } from '../sicxe/registers.ts';
import { Memory } from '../sicxe/memory.ts';

interface InspectorPanelProps {
  listing: ListingLine[];
  currentPc: number;
  memory: Memory;
  memoryChanges: MemoryChange[];
  traceLogs: string[];
  onClearTrace: () => void;
  breakpoints: Set<number>;
  onToggleBreakpoint: (loc: number) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  listing,
  currentPc,
  memory,
  memoryChanges,
  traceLogs,
  onClearTrace,
  breakpoints,
  onToggleBreakpoint,
}) => {
  const [activeTab, setActiveTab] = useState<'listing' | 'memory' | 'trace'>('listing');
  const [memBaseAddr, setMemBaseAddr] = useState(0);
  const [memJumpInput, setMemJumpInput] = useState('000000');
  const [traceFilter, setTraceFilter] = useState('');
  const [copiedTrace, setCopiedTrace] = useState(false);
  const traceEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll trace to bottom
  useEffect(() => {
    if (activeTab === 'trace') {
      traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [traceLogs, activeTab]);

  // Generate 16-byte memory rows for view
  const rowCount = 20; // 20 rows = 320 bytes visible per page
  const memoryRows: Array<{ addr: number; bytes: number[]; ascii: string }> = [];

  for (let r = 0; r < rowCount; r++) {
    const rowAddr = memBaseAddr + r * 16;
    if (rowAddr >= memory.size) break;
    const rowBytes: number[] = [];
    let ascii = '';

    for (let c = 0; c < 16; c++) {
      const byteAddr = rowAddr + c;
      if (byteAddr < memory.size) {
        const val = memory.getByte(byteAddr);
        rowBytes.push(val);
        // Printable ASCII
        ascii += val >= 32 && val <= 126 ? String.fromCharCode(val) : '.';
      }
    }

    memoryRows.push({ addr: rowAddr, bytes: rowBytes, ascii });
  }

  const handleJumpToAddr = () => {
    const parsed = parseInt(memJumpInput, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed < memory.size) {
      setMemBaseAddr(Math.floor(parsed / 16) * 16);
    }
  };

  const handleJumpToPc = () => {
    const target = Math.floor(currentPc / 16) * 16;
    setMemBaseAddr(Math.max(0, target));
    setMemJumpInput(formatHex24(currentPc));
  };

  const handleCopyTrace = () => {
    navigator.clipboard.writeText(traceLogs.join('\n'));
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  // Check if a byte was modified recently
  const isByteModified = (addr: number) => {
    return memoryChanges.some((mc) => addr >= mc.address && addr < mc.address + mc.newBytes.length);
  };

  // Check if byte is part of current instruction at PC
  const isBytePc = (addr: number) => {
    return addr >= currentPc && addr < currentPc + 3;
  };

  const filteredTrace = traceLogs.filter((l) => l.toLowerCase().includes(traceFilter.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('listing')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'listing'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Listing & Step</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'memory'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Memory Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('trace')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'trace'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Trace Log</span>
            {traceLogs.length > 0 && (
              <span className="ml-1 text-[10px] font-mono bg-slate-700 text-slate-200 px-1 rounded-full">
                {traceLogs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Listing View */}
      {activeTab === 'listing' && (
        <div className="flex-1 overflow-auto text-xs font-mono bg-slate-950/90 p-2">
          {listing.length > 0 ? (
            <div className="border border-slate-800/80 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-1 px-2 w-7 text-center">BP</th>
                    <th className="py-1 px-2 w-9">Line</th>
                    <th className="py-1 px-2 w-16">LOC</th>
                    <th className="py-1 px-2 w-24">Object</th>
                    <th className="py-1 px-2">Source Instruction</th>
                    <th className="py-1 px-2 text-right hidden sm:table-cell">nixbpe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {listing.map((item, idx) => {
                    const isPcRow = item.mnemonic && item.loc === currentPc;
                    const hasBp = breakpoints.has(item.loc);

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          isPcRow
                            ? 'bg-cyan-950/50 font-semibold text-white'
                            : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        {/* Breakpoint toggle */}
                        <td className="py-1 px-1 text-center">
                          {item.mnemonic && (
                            <button
                              onClick={() => onToggleBreakpoint(item.loc)}
                              className={`w-3.5 h-3.5 rounded-full inline-block transition-colors ${
                                hasBp
                                  ? 'bg-rose-500 ring-2 ring-rose-400'
                                  : 'hover:bg-slate-700 bg-transparent'
                              }`}
                              title={hasBp ? 'Remove breakpoint' : 'Set breakpoint at 0x' + formatHex24(item.loc)}
                            />
                          )}
                        </td>

                        {/* Line number */}
                        <td className="py-1 px-2 text-slate-500 text-[11px]">{item.lineNo}</td>

                        {/* LOC */}
                        <td className="py-1 px-2 font-mono text-amber-300/90 text-[11px]">
                          {item.mnemonic ? formatHex24(item.loc) : ''}
                        </td>

                        {/* Object Code */}
                        <td className="py-1 px-2 font-mono text-emerald-400 font-bold tracking-wider text-[11px]">
                          {item.objectCode || ''}
                        </td>

                        {/* Source Line with active indicator */}
                        <td className="py-1 px-2">
                          <div className="flex items-center gap-2">
                            {isPcRow && <ArrowRight className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                            <span className={isPcRow ? 'text-cyan-200' : 'text-slate-300'}>
                              {item.sourceText}
                            </span>
                          </div>
                        </td>

                        {/* nixbpe summary */}
                        <td className="py-1 px-2 text-right font-mono text-[10px] text-slate-400 hidden sm:table-cell">
                          {item.nixbpe
                            ? `${item.nixbpe.n}${item.nixbpe.i}${item.nixbpe.x}${item.nixbpe.b}${item.nixbpe.p}${item.nixbpe.e}`
                            : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <List className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Assemble a program to inspect synchronized listing lines.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Memory Matrix View */}
      {activeTab === 'memory' && (
        <div className="flex-1 flex flex-col p-3 bg-slate-950/90 overflow-hidden text-xs font-mono">
          {/* Quick jump controls */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800 text-[11px] flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Address:</span>
              <input
                type="text"
                value={memJumpInput}
                onChange={(e) => setMemJumpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJumpToAddr()}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-amber-300 text-xs font-mono focus:outline-none focus:border-cyan-500"
                placeholder="000000"
              />
              <button
                onClick={handleJumpToAddr}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
              >
                Go
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleJumpToPc}
                className="px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 rounded text-xs flex items-center gap-1"
              >
                <span>Jump to PC</span>
              </button>
              <button
                onClick={() => {
                  setMemBaseAddr(0x17);
                  setMemJumpInput('000017');
                }}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                title="Jump to RESULT location (0x17) in sum1to5 example"
              >
                RESULT (0x17)
              </button>
            </div>
          </div>

          {/* Hex dump table */}
          <div className="flex-1 overflow-auto border border-slate-800/80 rounded-lg">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-1 px-2 w-16">ADDR</th>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <th key={i} className="py-1 px-1 text-center w-6 text-slate-500">
                      {i.toString(16).toUpperCase()}
                    </th>
                  ))}
                  <th className="py-1 px-2 text-slate-400">ASCII</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {memoryRows.map((row) => (
                  <tr key={row.addr} className="hover:bg-slate-800/30">
                    <td className="py-1 px-2 text-amber-300 font-bold bg-slate-950/40">
                      0x{formatHex24(row.addr)}
                    </td>
                    {row.bytes.map((byte, colIdx) => {
                      const byteAddr = row.addr + colIdx;
                      const isPc = isBytePc(byteAddr);
                      const isMod = isByteModified(byteAddr);

                      return (
                        <td
                          key={colIdx}
                          className={`py-1 px-1 text-center font-mono ${
                            isPc
                              ? 'bg-cyan-900/80 text-cyan-200 font-bold rounded'
                              : isMod
                              ? 'bg-emerald-900/80 text-emerald-200 font-bold rounded'
                              : byte !== 0
                              ? 'text-slate-200'
                              : 'text-slate-600'
                          }`}
                          title={`Address: 0x${formatHex24(byteAddr)} (${byteAddr})`}
                        >
                          {byte.toString(16).padStart(2, '0').toUpperCase()}
                        </td>
                      );
                    })}
                    <td className="py-1 px-2 text-slate-400 tracking-widest text-[10px] border-l border-slate-800/60">
                      {row.ascii}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400 font-sans">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-cyan-600" />
              <span>Current PC bytes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
              <span>Modified memory</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Execution Trace Log */}
      {activeTab === 'trace' && (
        <div className="flex-1 flex flex-col p-3 bg-slate-950/95 overflow-hidden text-xs font-mono">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={traceFilter}
                onChange={(e) => setTraceFilter(e.target.value)}
                placeholder="Filter trace lines..."
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyTrace}
                disabled={traceLogs.length === 0}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] disabled:opacity-40"
              >
                {copiedTrace ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy</span>
              </button>
              <button
                onClick={onClearTrace}
                disabled={traceLogs.length === 0}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded text-[11px] disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto space-y-1 font-mono text-[11px] p-1 bg-slate-950 rounded border border-slate-850">
            {filteredTrace.length > 0 ? (
              filteredTrace.map((log, idx) => (
                <div key={idx} className="hover:bg-slate-900/60 p-0.5 rounded leading-relaxed text-slate-300">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-600">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No trace entries yet. Step or Run the program to record CPU cycles.</p>
              </div>
            )}
            <div ref={traceEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
