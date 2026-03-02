"use client"

import { useEffect, useRef, useCallback } from "react"
import type {
  SpeakerData,
  FaceDetectionResult,
  TemplateType,
  FilterSettings,
} from "@/lib/types"
import { renderPoster } from "@/lib/canvas-renderer"

interface PosterPreviewProps {
  speaker: SpeakerData
  image: HTMLImageElement | null
  bgImage: HTMLImageElement | null
  detection: FaceDetectionResult | null
  template: TemplateType
  filter: FilterSettings
  exportCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

const POSTER_W = 1080
const POSTER_H = 1350

export function PosterPreview({
  speaker,
  image,
  bgImage,
  detection,
  template,
  filter,
  exportCanvasRef,
}: PosterPreviewProps) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    if (!image || !detection) return

    const exportCanvas = exportCanvasRef.current
    if (exportCanvas) {
      renderPoster(exportCanvas, {
        speaker,
        image,
        bgImage,
        detection,
        template,
        filter,
        width: POSTER_W,
        height: POSTER_H,
      })
    }

    const displayCanvas = displayCanvasRef.current
    if (displayCanvas && exportCanvas) {
      const dpr = window.devicePixelRatio || 1
      const displayW = displayCanvas.clientWidth
      const displayH = displayCanvas.clientHeight
      displayCanvas.width = displayW * dpr
      displayCanvas.height = displayH * dpr
      const ctx = displayCanvas.getContext("2d")!
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, displayW, displayH)
      ctx.drawImage(exportCanvas, 0, 0, displayW, displayH)
    }
  }, [speaker, image, bgImage, detection, template, filter, exportCanvasRef])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [draw])

  if (!image || !detection) {
    return (
      <div className="flex items-center justify-center aspect-[4/5] w-full max-w-[540px] rounded border border-dashed border-[#333] bg-[#0e0e0e]">
        <div className="text-center px-6">
          <div className="text-[#555] font-mono text-sm mb-2">
            No preview yet
          </div>
          <div className="text-[#444] font-mono text-xs">
            Upload a photo to generate the poster
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center w-full max-w-[540px]">
      <canvas
        ref={displayCanvasRef}
        className="w-full aspect-[4/5] rounded"
        style={{ imageRendering: "auto" }}
      />
    </div>
  )
}
