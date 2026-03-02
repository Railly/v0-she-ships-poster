"use client"

import { Download, Eye, ScanFace, Loader2 } from "lucide-react"
import type { TemplateType, FilterSettings } from "@/lib/types"

interface PosterControlsProps {
  template: TemplateType
  onTemplateChange: (t: TemplateType) => void
  filter: FilterSettings
  onFilterChange: (f: FilterSettings) => void
  onExport: () => void
  isProcessing: boolean
  canExport: boolean
}

const labelClass =
  "block text-xs font-mono uppercase tracking-wider text-[#a0a0a0] mb-1.5"
const sliderClass =
  "w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#333] accent-[#E49BC2]"
const hexInputClass =
  "w-full rounded border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none"

export function PosterControls({
  template,
  onTemplateChange,
  filter,
  onFilterChange,
  onExport,
  isProcessing,
  canExport,
}: PosterControlsProps) {
  const updateFilter = (key: keyof FilterSettings, value: number | string) => {
    onFilterChange({ ...filter, [key]: value })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Template selector */}
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#E49BC2]">
        Template
      </h2>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onTemplateChange("half-face")}
          className={`flex-1 flex flex-col items-center gap-2 rounded border px-4 py-4 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
            template === "half-face"
              ? "border-[#E49BC2] bg-[#E49BC2]/10 text-[#E49BC2]"
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
              ? "border-[#E49BC2] bg-[#E49BC2]/10 text-[#E49BC2]"
              : "border-[#333] bg-[#1a1a1a] text-[#a0a0a0] hover:border-[#555]"
          }`}
        >
          <Eye className="h-5 w-5" />
          Eyes Only
        </button>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs font-mono text-[#4ade80]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Detecting face...
        </div>
      )}

      {/* ── Filter Controls ──────────────────────────────────────── */}
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#E49BC2] mt-2">
        Filters
      </h2>

      {/* Background Blur */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>BG Blur</label>
          <span className="text-xs font-mono text-[#666]">{filter.bgBlur}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={filter.bgBlur}
          onChange={(e) => updateFilter("bgBlur", Number(e.target.value))}
          className={sliderClass}
        />
      </div>

      {/* Background Grain */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>BG Grain</label>
          <span className="text-xs font-mono text-[#666]">
            {Math.round(filter.bgGrain * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(filter.bgGrain * 100)}
          onChange={(e) => updateFilter("bgGrain", Number(e.target.value) / 100)}
          className={sliderClass}
        />
      </div>

      {/* Face Grain */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Face Grain</label>
          <span className="text-xs font-mono text-[#666]">
            {Math.round(filter.faceGrain * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(filter.faceGrain * 100)}
          onChange={(e) =>
            updateFilter("faceGrain", Number(e.target.value) / 100)
          }
          className={sliderClass}
        />
      </div>

      {/* Face Tint Hex */}
      <div>
        <label className={labelClass}>Face Tint Color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={filter.faceTintHex}
            onChange={(e) => updateFilter("faceTintHex", e.target.value)}
            className="w-8 h-8 rounded border border-[#333] bg-transparent cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={filter.faceTintHex}
            onChange={(e) => updateFilter("faceTintHex", e.target.value)}
            className={hexInputClass}
            placeholder="#9A7E8E"
          />
        </div>
      </div>

      {/* Face Tint Opacity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Tint Opacity</label>
          <span className="text-xs font-mono text-[#666]">
            {Math.round(filter.faceTintOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(filter.faceTintOpacity * 100)}
          onChange={(e) =>
            updateFilter("faceTintOpacity", Number(e.target.value) / 100)
          }
          className={sliderClass}
        />
      </div>

      {/* Accent Color */}
      <div>
        <label className={labelClass}>Accent Color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={filter.accentColor}
            onChange={(e) => updateFilter("accentColor", e.target.value)}
            className="w-8 h-8 rounded border border-[#333] bg-transparent cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={filter.accentColor}
            onChange={(e) => updateFilter("accentColor", e.target.value)}
            className={hexInputClass}
            placeholder="#E49BC2"
          />
        </div>
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport || isProcessing}
        className="flex items-center justify-center gap-2 rounded bg-[#E49BC2] px-4 py-3 text-sm font-mono font-bold uppercase tracking-wider text-[#1a1a1a] transition-all hover:bg-[#d488b3] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mt-2"
      >
        <Download className="h-4 w-4" />
        Download PNG
      </button>
    </div>
  )
}
