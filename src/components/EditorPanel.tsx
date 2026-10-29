/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Code, FileText, Hash, Binary, AlertCircle, Copy, Check, UploadCloud, Terminal } from 'lucide-react';
import { AssemblerResult } from '../sicxe/types.ts';
import { formatHex24 } from '../sicxe/registers.ts';

interface EditorPanelProps {
  sourceCode: string;
  onSourceChange: (newCode: string) => void;
  asmResult: AssemblerResult | null;
  onAssemble: () => void;
  onLoadDirectHex: (startAddr: number, hexString: string) => void;
  onLoadDirectObjText: (text: string) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  sourceCode,
  onSourceChange,
  asmResult,
  onAssemble,
  onLoadDirectHex,
  onLoadDirectObjText,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'object' | 'symbols' | 'loader'>('editor');
  const [copiedObj, setCopiedObj] = useState(false);
  const [manualHexInput, setManualHexInput] = useState('05000101000090102F20093B2FF80F20063F2FFD000006');
  const [manualStartAddr, setManualStartAddr] = useState('000000');
  const [manualObjText, setManualObjText] = useState(
    'H^PROG  ^000000^00001A\nT^000000^17^05000101000090102F20093B2FF80F20063F2FFD000006\nE^000000'
  );

  const lines = sourceCode.split('\n');

  const handleCopyObject = () => {
    if (asmResult?.objectProgram?.fullText) {
      navigator.clipboard.writeText(asmResult.objectProgram.fullText);
      setCopiedObj(true);
      setTimeout(() => setCopiedObj(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'editor'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Assembly Source</span>
          </button>

          <button
            onClick={() => setActiveTab('object')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'object'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Object Program</span>
          </button>

          <button
            onClick={() => setActiveTab('symbols')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'symbols'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Symbol Table</span>
          </button>

          <button
            onClick={() => setActiveTab('loader')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'loader'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title="Load raw machine code or Beck object program directly"
          >
            <Binary className="w-3.5 h-3.5" />
            <span>Hex / Direct Loader</span>
          </button>
        </div>

        {asmResult && (
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>
              Len: <strong className="text-slate-200">0x{asmResult.programLength.toString(16).toUpperCase()}</strong> ({asmResult.programLength}B)
            </span>
            <span>
              Start: <strong className="text-slate-200">0x{formatHex24(asmResult.startAddress)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Tab 1: Source Editor */}
      {activeTab === 'editor' && (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 overflow-auto flex text-xs font-mono bg-slate-950/80 p-1">
            {/* Line numbers */}
            <div className="select-none text-slate-600 text-right pr-3 pl-2 py-2 border-r border-slate-800/80 bg-slate-950/40 min-w-8">
              {lines.map((_, i) => (
                <div key={i} className="leading-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={sourceCode}
              onChange={(e) => onSourceChange(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-transparent text-slate-200 pl-3 py-2 leading-5 focus:outline-none resize-none font-mono whitespace-pre overflow-x-auto selection:bg-cyan-900/60"
              placeholder="Enter SIC/XE assembly code here..."
            />
          </div>

          {/* Diagnostic Error Banner if assembly has errors */}
          {asmResult && !asmResult.success && asmResult.errors.length > 0 && (
            <div className="bg-rose-950/80 border-t border-rose-800/80 p-2.5 max-h-32 overflow-y-auto">
              <div className="flex items-center gap-1.5 text-rose-300 font-semibold text-xs mb-1">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>Assembly Errors ({asmResult.errors.length})</span>
              </div>
              <div className="space-y-1">
                {asmResult.errors.map((err, idx) => (
                  <div key={idx} className="text-[11px] font-mono text-rose-200/90 flex items-start gap-2">
                    <span className="text-rose-400 font-bold">Line {err.line}:</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Object Program View */}
      {activeTab === 'object' && (
        <div className="flex-1 flex flex-col p-4 bg-slate-950/90 overflow-auto text-xs font-mono">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div>
              <h4 className="text-slate-200 font-semibold text-xs">Beck Standard Object Program</h4>
              <p className="text-[11px] text-slate-400">Header (H), Text (T), Modification (M), End (E) records</p>
            </div>
            {asmResult?.objectProgram && (
              <button
                onClick={handleCopyObject}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              >
                {copiedObj ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedObj ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          {asmResult?.objectProgram ? (
            <div className="space-y-3">
              {/* Record by record explanation */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Records Breakdown</div>
                {/* Header */}
                <div className="flex items-start gap-2">
                  <span className="bg-blue-950/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/60 text-[10px] font-bold">
                    H
                  </span>
                  <div className="text-slate-300">
                    <span className="text-cyan-300 font-semibold">{asmResult.objectProgram.header.recordText}</span>
                    <div className="text-[11px] text-slate-400">
                      Program: {asmResult.objectProgram.header.progName.trim()} · Start: 0x{formatHex24(asmResult.objectProgram.header.startAddress)} · Length: 0x{formatHex24(asmResult.objectProgram.header.length)}
                    </div>
                  </div>
                </div>

                {/* Text records */}
                {asmResult.objectProgram.textRecords.map((t, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/60 text-[10px] font-bold">
                      T
                    </span>
                    <div className="text-slate-300">
                      <span className="text-emerald-300 font-semibold break-all">{t.recordText}</span>
                      <div className="text-[11px] text-slate-400">
                        Address: 0x{formatHex24(t.startAddress)} · Bytes: {t.length} (0x{t.length.toString(16).toUpperCase()})
                      </div>
                    </div>
                  </div>
                ))}

                {/* Mod records */}
                {asmResult.objectProgram.modRecords.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/60 text-[10px] font-bold">
                      M
                    </span>
                    <div className="text-slate-300">
                      <span className="text-amber-300 font-semibold">{m.recordText}</span>
                      <div className="text-[11px] text-slate-400">
                        Relocation address: 0x{formatHex24(m.address)} · {m.halfBytes} half-bytes
                      </div>
                    </div>
                  </div>
                ))}

                {/* End record */}
                <div className="flex items-start gap-2">
                  <span className="bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60 text-[10px] font-bold">
                    E
                  </span>
                  <div className="text-slate-300">
                    <span className="text-purple-300 font-semibold">{asmResult.objectProgram.endRecord.recordText}</span>
                    <div className="text-[11px] text-slate-400">
                      First executable address: 0x{formatHex24(asmResult.objectProgram.endRecord.firstExecAddress)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw file format */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Raw File Output:</label>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 select-all overflow-x-auto leading-relaxed">
                  {asmResult.objectProgram.fullText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Assemble the program to view generated Beck object records.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Symbol Table */}
      {activeTab === 'symbols' && (
        <div className="flex-1 flex flex-col p-3 bg-slate-950/90 overflow-auto text-xs font-mono">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
            <div>
              <h4 className="text-slate-200 font-semibold text-xs">Pass 1 Symbol Table</h4>
              <p className="text-[11px] text-slate-400">Labels resolved to target addresses</p>
            </div>
            <span className="text-slate-400 text-[11px]">
              {asmResult?.symbolList.length || 0} Symbols
            </span>
          </div>

          {asmResult && asmResult.symbolList.length > 0 ? (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-3">Symbol</th>
                    <th className="py-1.5 px-3">Hex Address</th>
                    <th className="py-1.5 px-3">Decimal</th>
                    <th className="py-1.5 px-3">Line</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
                  {asmResult.symbolList.map((sym, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-1.5 px-3 text-cyan-300 font-bold">{sym.name}</td>
                      <td className="py-1.5 px-3 text-amber-300 font-mono">0x{formatHex24(sym.address)}</td>
                      <td className="py-1.5 px-3 text-slate-300 font-mono">{sym.address}</td>
                      <td className="py-1.5 px-3 text-slate-400">{sym.definedLine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No symbols defined. Assemble code to populate the table.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Direct Hex / Object Program Loader */}
      {activeTab === 'loader' && (
        <div className="flex-1 flex flex-col p-4 bg-slate-950/90 overflow-auto text-xs space-y-4">
          <div>
            <h4 className="text-slate-200 font-semibold text-xs">Direct Machine Code Loader</h4>
            <p className="text-[11px] text-slate-400">
              Satisfies Section 6.1 hand-assembled mode: load raw hex bytes or paste Beck object program text directly.
            </p>
          </div>

          {/* Option A: Raw Hex Loader */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-medium text-xs">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Load Raw Hex Machine Code</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-[11px]">Start Address (Hex):</label>
              <input
                type="text"
                value={manualStartAddr}
                onChange={(e) => setManualStartAddr(e.target.value)}
                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                placeholder="000000"
              />
            </div>
            <textarea
              value={manualHexInput}
              onChange={(e) => setManualHexInput(e.target.value)}
              className="w-full h-16 bg-slate-950 border border-slate-700/80 rounded p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 resize-none"
              placeholder="Paste hex bytes, e.g. 05000101000090102F20093B2FF8..."
            />
            <button
              onClick={() => {
                const addr = parseInt(manualStartAddr, 16) || 0;
                onLoadDirectHex(addr, manualHexInput);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-medium text-xs transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Load Hex Into Memory</span>
            </button>
          </div>

          {/* Option B: Object Program Text Loader */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-medium text-xs">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Load Beck Object Program (`.obj`)</span>
            </div>
            <textarea
              value={manualObjText}
              onChange={(e) => setManualObjText(e.target.value)}
              className="w-full h-24 bg-slate-950 border border-slate-700/80 rounded p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
              placeholder="H^PROG  ^000000^00001A&#10;T^000000^17^...&#10;E^000000"
            />
            <button
              onClick={() => onLoadDirectObjText(manualObjText)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium text-xs transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Parse & Load Object Program</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
