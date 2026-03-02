"use client"

import { Download, Loader2, TriangleAlert, Move, ZoomIn, RotateCcw } from "lucide-react"
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

export function PosterControls({
  template,
  onTemplateChange,
  filter,
  onFilterChange,
  onExport,
  isProcessing,
  canExport,
}: PosterControlsProps) {
  const updateFilter = (key: keyof FilterSettings, value: number | string | boolean) => {
    onFilterChange({ ...filter, [key]: value })
  }

  const resetPosition = () => {
    onFilterChange({ ...filter, panX: 0, panY: 0, zoom: 1.0 })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Template selector */}
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#E49BC2]">
        Template
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {(["half-face", "eyes", "smile"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTemplateChange(t)}
            className={`flex flex-col items-center gap-2 rounded border px-3 py-3 text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
              template === t
                ? "border-[#E49BC2] bg-[#E49BC2]/10 text-[#E49BC2]"
                : "border-[#333] bg-[#1a1a1a] text-[#a0a0a0] hover:border-[#555]"
            }`}
          >
            {t === "half-face" ? "Half Face" : t === "eyes" ? "Eyes Only" : "Smile"}
          </button>
        ))}
      </div>

      {/* Overlay Mode - commented out as requested */}
      {/* <div className="flex items-center justify-between rounded border border-[#333] bg-[#1a1a1a] px-4 py-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#a0a0a0]">
            Overlay Mode
          </span>
          <p className="text-[10px] font-mono text-[#555] mt-0.5">
            Match crop position to real face location
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateFilter("overlay", !filter.overlay)}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            filter.overlay ? "bg-[#E49BC2]" : "bg-[#333]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[#f0f0f0] transition-transform ${
              filter.overlay ? "translate-x-5" : "translate-x-0"
            }`}
          />
          <span className="sr-only">Toggle overlay mode</span>
        </button>
      </div> */}

      {/* Auto-position toggle */}
      <div className="flex flex-col gap-2 rounded border border-[#333] bg-[#1a1a1a] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-[#a0a0a0]">
              Auto Position
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateFilter("autoPosition", !filter.autoPosition)}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
              filter.autoPosition ? "bg-[#E49BC2]" : "bg-[#333]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[#f0f0f0] transition-transform ${
                filter.autoPosition ? "translate-x-5" : "translate-x-0"
              }`}
            />
            <span className="sr-only">Toggle auto position</span>
          </button>
        </div>
        <p className="text-[10px] font-mono text-[#666] leading-relaxed">
          If the face crop looks cut off or overlaps the logo, turn this on
          to automatically reposition it within safe bounds.
        </p>
      </div>

      {/* Image Position & Zoom */}
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#E49BC2] mt-2 flex items-center gap-2">
        <Move className="h-3.5 w-3.5" />
        Position & Zoom
      </h2>

      {/* Pan X */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Horizontal</label>
          <span className="text-xs font-mono text-[#666]">{filter.panX > 0 ? "+" : ""}{filter.panX}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={filter.panX}
          onChange={(e) => updateFilter("panX", Number(e.target.value))}
          className={sliderClass}
        />
      </div>

      {/* Pan Y */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>Vertical</label>
          <span className="text-xs font-mono text-[#666]">{filter.panY > 0 ? "+" : ""}{filter.panY}</span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={filter.panY}
          onChange={(e) => updateFilter("panY", Number(e.target.value))}
          className={sliderClass}
        />
      </div>

      {/* Zoom */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass}>
            <ZoomIn className="inline h-3 w-3 mr-1 -translate-y-px" />
            Zoom
          </label>
          <span className="text-xs font-mono text-[#666]">{filter.zoom.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={50}
          max={200}
          step={1}
          value={Math.round(filter.zoom * 100)}
          onChange={(e) => updateFilter("zoom", Number(e.target.value) / 100)}
          className={sliderClass}
        />
      </div>

      {/* Reset position button */}
      <button
        type="button"
        onClick={resetPosition}
        className="flex items-center justify-center gap-2 rounded border border-[#333] bg-[#1a1a1a] px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#a0a0a0] transition-colors hover:border-[#555] hover:text-[#f0f0f0] cursor-pointer"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Position
      </button>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs font-mono text-[#4ade80]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Detecting face...
        </div>
      )}

      {/* ── Filter Controls (commented out, not deleted) ─────────── */}
      {/*
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#E49BC2] mt-2">
        Filters
      </h2>

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
            className="w-full rounded border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none"
            placeholder="#934370"
          />
        </div>
      </div>

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
            className="w-full rounded border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none"
            placeholder="#E49BC2"
          />
        </div>
      </div>
      */}

      {/* Safari / iOS warning */}
      <div className="flex items-start gap-2.5 rounded border border-[#3a3020] bg-[#1a1a1a] px-4 py-3">
        <TriangleAlert className="h-4 w-4 text-[#f0c040] shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-[#888] leading-relaxed">
          <span className="text-[#c0a040]">Heads up --</span> some effects
          like the B&W filter may render differently on Safari and iOS.
          For the best results, use Chrome or Firefox on desktop.
        </p>
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
