"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import {
  TriangleAlert,
  RotateCcw,
  Minus,
  Plus,
  Crosshair,
} from "lucide-react"
import type { TemplateType, FilterSettings } from "@/lib/types"

interface PosterControlsProps {
  template: TemplateType
  onTemplateChange: (t: TemplateType) => void
  filter: FilterSettings
  onFilterChange: (f: FilterSettings) => void
}

// ── 2D Drag Pad ─────────────────────────────────────────────────────
// Figma-style: click or drag anywhere on the pad to set panX/panY.
// Shows crosshair at current position with axis lines.
function DragPad({
  panX,
  panY,
  onChange,
}: {
  panX: number
  panY: number
  onChange: (x: number, y: number) => void
}) {
  const padRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const posFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current
      if (!pad) return
      const rect = pad.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 200 - 100
      const y = ((clientY - rect.top) / rect.height) * 200 - 100
      onChange(
        Math.round(Math.max(-100, Math.min(100, x))),
        Math.round(Math.max(-100, Math.min(100, y)))
      )
    },
    [onChange]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsDragging(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      posFromEvent(e.clientX, e.clientY)
    },
    [posFromEvent]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      posFromEvent(e.clientX, e.clientY)
    },
    [isDragging, posFromEvent]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Keyboard: arrow keys for fine control
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 2
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          onChange(Math.max(-100, panX - step), panY)
          break
        case "ArrowRight":
          e.preventDefault()
          onChange(Math.min(100, panX + step), panY)
          break
        case "ArrowUp":
          e.preventDefault()
          onChange(panX, Math.max(-100, panY - step))
          break
        case "ArrowDown":
          e.preventDefault()
          onChange(panX, Math.min(100, panY + step))
          break
      }
    },
    [panX, panY, onChange]
  )

  // Convert -100..100 to 0%..100%
  const dotLeft = ((panX + 100) / 200) * 100
  const dotTop = ((panY + 100) / 200) * 100

  return (
    <div
      ref={padRef}
      role="slider"
      tabIndex={0}
      aria-label="Image position control"
      aria-valuetext={`Pan X: ${panX}, Pan Y: ${panY}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`
        relative w-full aspect-square max-w-[180px] mx-auto
        rounded-lg border bg-[#111] select-none
        focus:outline-none focus:ring-1 focus:ring-[#E49BC2]/50
        transition-colors
        ${isDragging ? "border-[#E49BC2] cursor-grabbing" : "border-[#333] cursor-crosshair hover:border-[#555]"}
      `}
    >
      {/* Grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Center cross (faint) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#282828]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#282828]" />
        {/* Quarter lines */}
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-[#1a1a1a]" />
        <div className="absolute left-3/4 top-0 bottom-0 w-px bg-[#1a1a1a]" />
        <div className="absolute top-1/4 left-0 right-0 h-px bg-[#1a1a1a]" />
        <div className="absolute top-3/4 left-0 right-0 h-px bg-[#1a1a1a]" />
      </div>

      {/* Active position crosshair lines */}
      <div
        className="absolute top-0 bottom-0 w-px bg-[#E49BC2]/20 pointer-events-none transition-[left] duration-75"
        style={{ left: `${dotLeft}%` }}
      />
      <div
        className="absolute left-0 right-0 h-px bg-[#E49BC2]/20 pointer-events-none transition-[top] duration-75"
        style={{ top: `${dotTop}%` }}
      />

      {/* Dot indicator */}
      <div
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[left,top] duration-75"
        style={{ left: `${dotLeft}%`, top: `${dotTop}%` }}
      >
        <div
          className={`
            w-full h-full rounded-full border-2
            ${isDragging ? "border-[#E49BC2] bg-[#E49BC2]/30 scale-110" : "border-[#E49BC2]/70 bg-[#E49BC2]/15"}
            transition-all
          `}
        />
      </div>

      {/* Corner labels */}
      <span className="absolute top-1.5 left-2 text-[8px] font-mono text-[#444] pointer-events-none">
        L
      </span>
      <span className="absolute top-1.5 right-2 text-[8px] font-mono text-[#444] pointer-events-none">
        R
      </span>
    </div>
  )
}

// ── Zoom Strip ──────────────────────────────────────────────────────
function ZoomStrip({
  zoom,
  onChange,
}: {
  zoom: number
  onChange: (z: number) => void
}) {
  const step = 0.05
  const min = 0.5
  const max = 2.0

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, zoom - step))}
        className="flex items-center justify-center w-7 h-7 rounded border border-[#333] bg-[#1a1a1a] text-[#a0a0a0] hover:border-[#555] hover:text-[#f0f0f0] transition-colors cursor-pointer"
        aria-label="Zoom out"
      >
        <Minus className="h-3 w-3" />
      </button>

      <div className="flex-1 relative h-7 flex items-center">
        <div className="w-full h-1 rounded-full bg-[#222] relative">
          {/* 100% tick mark */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-[#444]"
            style={{ left: `${((1.0 - min) / (max - min)) * 100}%` }}
          />
          {/* Fill */}
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-[#E49BC2]/40 transition-[width] duration-75"
            style={{ width: `${((zoom - min) / (max - min)) * 100}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#E49BC2] bg-[#1a1a1a] transition-[left] duration-75"
            style={{ left: `${((zoom - min) / (max - min)) * 100}%` }}
          />
        </div>
        <input
          type="range"
          min={min * 100}
          max={max * 100}
          step={step * 100}
          value={Math.round(zoom * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Zoom level"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, zoom + step))}
        className="flex items-center justify-center w-7 h-7 rounded border border-[#333] bg-[#1a1a1a] text-[#a0a0a0] hover:border-[#555] hover:text-[#f0f0f0] transition-colors cursor-pointer"
        aria-label="Zoom in"
      >
        <Plus className="h-3 w-3" />
      </button>

      <span className="text-xs font-mono text-[#666] w-12 text-right tabular-nums">
        {zoom.toFixed(2)}x
      </span>
    </div>
  )
}

// ── Main Controls ───────────────────────────────────────────────────
export function PosterControls({
  template,
  onTemplateChange,
  filter,
  onFilterChange,
}: PosterControlsProps) {
  const updateFilter = (key: keyof FilterSettings, value: number | string | boolean) => {
    onFilterChange({ ...filter, [key]: value })
  }

  const handlePanChange = useCallback(
    (x: number, y: number) => {
      onFilterChange({ ...filter, panX: x, panY: y })
    },
    [filter, onFilterChange]
  )

  const handleZoomChange = useCallback(
    (z: number) => {
      onFilterChange({ ...filter, zoom: z })
    },
    [filter, onFilterChange]
  )

  const resetPosition = () => {
    onFilterChange({ ...filter, panX: 0, panY: 0, zoom: 1.0 })
  }

  const isDefaultPos = filter.panX === 0 && filter.panY === 0 && filter.zoom === 1.0

  // Detect if running on Safari/iOS for a more targeted warning
  const [isSafariLike, setIsSafariLike] = useState(false)
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent
      setIsSafariLike(/^((?!chrome|android).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua))
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Template selector */}
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2">
          Crop Style
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {(["half-face", "eyes", "smile"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTemplateChange(t)}
              className={`rounded-md border px-2 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                template === t
                  ? "border-[#E49BC2] bg-[#E49BC2]/10 text-[#E49BC2]"
                  : "border-[#2a2a2a] bg-[#141414] text-[#777] hover:border-[#444] hover:text-[#aaa]"
              }`}
            >
              {t === "half-face" ? "Half Face" : t === "eyes" ? "Eyes" : "Smile"}
            </button>
          ))}
        </div>
      </div>

      {/* Position & Zoom */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-[#666] flex items-center gap-1.5">
            <Crosshair className="h-3 w-3" />
            Position & Zoom
          </h2>
          {!isDefaultPos && (
            <button
              type="button"
              onClick={resetPosition}
              className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#E49BC2]/60 hover:text-[#E49BC2] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset
            </button>
          )}
        </div>

        {/* Drag pad */}
        <DragPad panX={filter.panX} panY={filter.panY} onChange={handlePanChange} />

        {/* Coordinates readout */}
        <div className="flex justify-center gap-4 mt-2 mb-3">
          <span className="text-[9px] font-mono text-[#555] tabular-nums">
            X: {filter.panX > 0 ? "+" : ""}
            {filter.panX}
          </span>
          <span className="text-[9px] font-mono text-[#555] tabular-nums">
            Y: {filter.panY > 0 ? "+" : ""}
            {filter.panY}
          </span>
        </div>

        {/* Zoom strip */}
        <ZoomStrip zoom={filter.zoom} onChange={handleZoomChange} />

        <p className="text-[9px] font-mono text-[#444] mt-2 leading-relaxed text-center">
          Drag to reposition. Use arrow keys for precision (hold Shift for bigger steps).
        </p>
      </div>

      {/* Auto-position toggle */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#777]">
            Auto Reposition
          </span>
          <button
            type="button"
            onClick={() => updateFilter("autoPosition", !filter.autoPosition)}
            className={`relative w-9 h-[18px] rounded-full transition-colors cursor-pointer ${
              filter.autoPosition ? "bg-[#E49BC2]" : "bg-[#333]"
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-[#f0f0f0] transition-transform ${
                filter.autoPosition ? "translate-x-[18px]" : "translate-x-0"
              }`}
            />
            <span className="sr-only">Toggle auto position</span>
          </button>
        </div>
        <p className="text-[9px] font-mono text-[#555] leading-relaxed mt-1.5">
          If the crop overlaps the logo or text, enable this to auto-fit within safe bounds.
        </p>
      </div>

      {/* Overlay Mode - commented out as requested */}
      {/* <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#777]">
            Overlay Mode
          </span>
          <button
            type="button"
            onClick={() => updateFilter("overlay", !filter.overlay)}
            className={`relative w-9 h-[18px] rounded-full transition-colors cursor-pointer ${
              filter.overlay ? "bg-[#E49BC2]" : "bg-[#333]"
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-[#f0f0f0] transition-transform ${
                filter.overlay ? "translate-x-[18px]" : "translate-x-0"
              }`}
            />
            <span className="sr-only">Toggle overlay mode</span>
          </button>
        </div>
      </div> */}

      {/* ── Filter Controls (commented out, not deleted) ─────────── */}
      {/*
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-3">
          Filters
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#777]">BG Blur</label>
              <span className="text-[10px] font-mono text-[#555]">{filter.bgBlur}px</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={filter.bgBlur}
              onChange={(e) => updateFilter("bgBlur", Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer bg-[#333] accent-[#E49BC2]" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#777]">BG Grain</label>
              <span className="text-[10px] font-mono text-[#555]">{Math.round(filter.bgGrain * 100)}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={Math.round(filter.bgGrain * 100)}
              onChange={(e) => updateFilter("bgGrain", Number(e.target.value) / 100)}
              className="w-full h-1 rounded-full appearance-none cursor-pointer bg-[#333] accent-[#E49BC2]" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#777]">Face Grain</label>
              <span className="text-[10px] font-mono text-[#555]">{Math.round(filter.faceGrain * 100)}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={Math.round(filter.faceGrain * 100)}
              onChange={(e) => updateFilter("faceGrain", Number(e.target.value) / 100)}
              className="w-full h-1 rounded-full appearance-none cursor-pointer bg-[#333] accent-[#E49BC2]" />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#777] mb-1.5 block">Face Tint</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={filter.faceTintHex}
                onChange={(e) => updateFilter("faceTintHex", e.target.value)}
                className="w-7 h-7 rounded border border-[#333] bg-transparent cursor-pointer shrink-0" />
              <input type="text" value={filter.faceTintHex}
                onChange={(e) => updateFilter("faceTintHex", e.target.value)}
                className="w-full rounded border border-[#333] bg-[#1a1a1a] px-2 py-1 text-[10px] text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#777]">Tint Opacity</label>
              <span className="text-[10px] font-mono text-[#555]">{Math.round(filter.faceTintOpacity * 100)}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={Math.round(filter.faceTintOpacity * 100)}
              onChange={(e) => updateFilter("faceTintOpacity", Number(e.target.value) / 100)}
              className="w-full h-1 rounded-full appearance-none cursor-pointer bg-[#333] accent-[#E49BC2]" />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#777] mb-1.5 block">Accent Color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={filter.accentColor}
                onChange={(e) => updateFilter("accentColor", e.target.value)}
                className="w-7 h-7 rounded border border-[#333] bg-transparent cursor-pointer shrink-0" />
              <input type="text" value={filter.accentColor}
                onChange={(e) => updateFilter("accentColor", e.target.value)}
                className="w-full rounded border border-[#333] bg-[#1a1a1a] px-2 py-1 text-[10px] text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none" />
            </div>
          </div>
        </div>
      </div>
      */}

      {/* Safari / iOS warning */}
      {isSafariLike && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[#3a3020] bg-[#141414] px-3 py-2.5">
          <TriangleAlert className="h-3.5 w-3.5 text-[#f0c040] shrink-0 mt-0.5" />
          <p className="text-[9px] font-mono text-[#888] leading-relaxed">
            Some effects may look different here.
            For best results try Chrome or Firefox on desktop.
          </p>
        </div>
      )}
    </div>
  )
}
