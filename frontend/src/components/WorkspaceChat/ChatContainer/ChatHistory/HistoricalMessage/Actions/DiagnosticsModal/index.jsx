import React, { useState } from "react";
import { TerminalWindow, X, Copy, Check } from "@phosphor-icons/react";
import useCopyText from "@/hooks/useCopyText";

export default function DiagnosticsButton({
  chatId = null,
  uuid = null,
  metrics = {},
  role = "assistant",
  error = null,
  sources = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { copied, copyText } = useCopyText();

  if (role === "user") return null;

  const diagnosticPayload = {
    timestamp: new Date().toISOString(),
    chatId,
    uuid,
    hasError: !!error,
    error: error || null,
    metrics: metrics || {},
    sourceCount: sources?.length || 0,
    sources: sources?.map((s) => ({
      title: s.title || s.docTitle || "Unknown",
      score: s.score ?? null,
      chunkSource: s.chunkSource || null,
    })),
  };

  const jsonString = JSON.stringify(diagnosticPayload, null, 2);

  return (
    <>
      <div className="mt-3 relative">
        <button
          onClick={() => setIsOpen(true)}
          data-tooltip-id="diagnostics-assistant-button"
          data-tooltip-content="Show Diagnostics"
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Show Diagnostics"
        >
          <TerminalWindow size={20} className="mb-1" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#121214]">
              <div className="flex items-center gap-2">
                <TerminalWindow size={22} className="text-cyan-400" />
                <h3 className="font-semibold text-white text-base">
                  Execution Diagnostics
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyText(jsonString)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
              {/* Status Overview */}
              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800/80">
                  <div className="text-[10px] uppercase text-zinc-500 font-semibold mb-1">
                    Status
                  </div>
                  <div className={error ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                    {error ? "Error Encountered" : "Completed Successfully"}
                  </div>
                </div>
                <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800/80">
                  <div className="text-[10px] uppercase text-zinc-500 font-semibold mb-1">
                    Citations / Sources
                  </div>
                  <div className="text-white font-bold">
                    {sources?.length || 0} retrieved
                  </div>
                </div>
              </div>

              {/* Error Details If Any */}
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300">
                  <div className="text-[10px] uppercase text-red-400 font-bold mb-1">
                    Error Log
                  </div>
                  <pre className="whitespace-pre-wrap break-all text-xs font-mono text-red-200">
                    {typeof error === "object" ? JSON.stringify(error, null, 2) : String(error)}
                  </pre>
                </div>
              )}

              {/* Metrics Breakdown */}
              {metrics && Object.keys(metrics).length > 0 && (
                <div className="p-3 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-zinc-300">
                  <div className="text-[10px] uppercase text-cyan-400 font-bold mb-2">
                    Performance Metrics
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-zinc-400">
                    {metrics.model && (
                      <div>Model: <span className="text-zinc-200">{metrics.model}</span></div>
                    )}
                    {metrics.duration && (
                      <div>Duration: <span className="text-zinc-200">{metrics.duration.toFixed(2)}s</span></div>
                    )}
                    {metrics.outputTps && (
                      <div>Speed: <span className="text-zinc-200">{metrics.outputTps.toFixed(1)} tok/s</span></div>
                    )}
                    {metrics.total_tokens && (
                      <div>Tokens: <span className="text-zinc-200">{metrics.total_tokens}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Full Raw Payload */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-zinc-500 font-semibold">
                  Raw Diagnostic JSON
                </div>
                <pre className="p-3 bg-black/60 rounded-lg border border-zinc-800/80 text-zinc-300 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                  {jsonString}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
