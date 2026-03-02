"use client"

import { Download, Eye, ScanFace, Loader2 } from "lucide-react"
import type { TemplateType } from "@/lib/types"

interface PosterControlsProps {
  template: TemplateType
  onTemplateChange: (t: TemplateType) => void
  onExport: () => void
  isProcessing: boolean
  canExport: boolean
}

export function PosterControls({
  template,
  onTemplateChange,
  onExport,
  isProcessing,
  canExport,
}: PosterControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#e891b9]">
        Template
      </h2>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onTemplateChange("half-face")}
          className={`flex-1 flex flex-col items-center gap-2 rounded border px-4 py-4 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
            template === "half-face"
              ? "border-[#e891b9] bg-[#e891b9]/10 text-[#e891b9]"
              : "border-[#333] bg-[#1a1a1a] text-[#a0a0a0] hover:border-[#555]"
          }`}
        >
          <ScanFace className="h-5 w-5" />
          Half Face
        </button>
        <button
          type="button"
          onClick={() => onTemplateChange("eyes")}
          className={`flex-1 flex flex-col items-center gap-2 rounded border px-4 py-4 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
            template === "eyes"
              ? "border-[#e891b9] bg-[#e891b9]/10 text-[#e891b9]"
              : "border-[#333] bg-[#1a1a1a] text-[#a0a0a0] hover:border-[#555]"
          }`}
        >
          <Eye className="h-5 w-5" />
          Eyes Only
        </button>
      </div>

      {/* Status indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs font-mono text-[#4ade80]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Detecting face...
        </div>
      )}

      {/* Export button */}
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport || isProcessing}
        className="flex items-center justify-center gap-2 rounded bg-[#e891b9] px-4 py-3 text-sm font-mono font-bold uppercase tracking-wider text-[#1a1a1a] transition-all hover:bg-[#d478a3] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <Download className="h-4 w-4" />
        Download PNG
      </button>
    </div>
  )
}
