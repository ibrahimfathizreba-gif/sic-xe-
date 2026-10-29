/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, BookOpen, Layers, Terminal, Cpu } from 'lucide-react';

interface CheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheatSheetModal: React.FC<CheatSheetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">SIC/XE Architecture Cheatsheet</h3>
              <p className="text-xs text-slate-400">Leland Beck System Software reference specifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-300">
          {/* Section 1: Registers */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Registers (24-bit Words, Big-Endian)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">A (0)</span>
                <span className="text-[11px] text-slate-400 font-sans">Accumulator</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">X (1)</span>
                <span className="text-[11px] text-slate-400 font-sans">Index Register</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">L (2)</span>
                <span className="text-[11px] text-slate-400 font-sans">Linkage (JSUB return)</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">B (3)</span>
                <span className="text-[11px] text-slate-400 font-sans">Base Register</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">S (4)</span>
                <span className="text-[11px] text-slate-400 font-sans">General Working</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">T (5)</span>
                <span className="text-[11px] text-slate-400 font-sans">General Working</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">PC (8)</span>
                <span className="text-[11px] text-slate-400 font-sans">Program Counter</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                <span className="font-bold text-cyan-300 block">SW (9)</span>
                <span className="text-[11px] text-slate-400 font-sans">CC in low 2 bits</span>
              </div>
            </div>
          </div>

          {/* Section 2: Instruction Formats */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Instruction Formats</span>
            </h4>
            <div className="space-y-2 font-mono">
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded flex justify-between items-center">
                <span>Format 1 (1 byte)</span>
                <span className="text-amber-300 font-semibold">op(8)</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded flex justify-between items-center">
                <span>Format 2 (2 bytes)</span>
                <span className="text-amber-300 font-semibold">op(8) r1(4) r2(4)</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded flex justify-between items-center">
                <span>Format 3 (3 bytes)</span>
                <span className="text-emerald-300 font-semibold">op(6) n i x b p e disp(12)</span>
              </div>
              <div className="p-2 bg-slate-950/70 border border-slate-800 rounded flex justify-between items-center">
                <span>Format 4 (4 bytes, prefix +)</span>
                <span className="text-purple-300 font-semibold">op(6) n i x b p e address(20)</span>
              </div>
            </div>
          </div>

          {/* Section 3: nixbpe and Addressing Modes */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Addressing Modes & Target Address (TA)</span>
            </h4>
            <div className="overflow-hidden border border-slate-800 rounded-lg">
              <table className="w-full text-left font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2">ni Bits</th>
                    <th className="p-2">Addressing Mode</th>
                    <th className="p-2">Operand Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 bg-slate-950/40">
                  <tr>
                    <td className="p-2 text-cyan-300">01</td>
                    <td className="p-2 text-slate-200">Immediate (#)</td>
                    <td className="p-2 text-slate-400">value = TA (no memory access)</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-emerald-300">11</td>
                    <td className="p-2 text-slate-200">Simple</td>
                    <td className="p-2 text-slate-400">value = word at TA</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-amber-300">10</td>
                    <td className="p-2 text-slate-200">Indirect (@)</td>
                    <td className="p-2 text-slate-400">TA2 = word at TA; value = word at TA2</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-purple-300">00</td>
                    <td className="p-2 text-slate-200">Standard SIC</td>
                    <td className="p-2 text-slate-400">15-bit address; value = word at address</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
              <p>• <strong>PC-relative (p=1):</strong> TA = (PC) + signExtend12(disp) [range -2048..2047]</p>
              <p>• <strong>Base-relative (b=1):</strong> TA = (B) + disp [range 0..4095]</p>
              <p>• <strong>Indexed (x=1):</strong> TA = TA + (X)</p>
              <p>• <strong>Extended (e=1):</strong> TA = address(20)</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
