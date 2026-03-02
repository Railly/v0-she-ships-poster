"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { PosterForm } from "@/components/poster-form"
import { PosterPreview } from "@/components/poster-preview"
import { PosterControls } from "@/components/poster-controls"
import { detectFace } from "@/lib/face-detection"
import { exportPoster } from "@/lib/canvas-renderer"
import type {
  SpeakerData,
  FaceDetectionResult,
  TemplateType,
  FilterSettings,
} from "@/lib/types"

const DEFAULT_SPEAKER: SpeakerData = {
  name: "Larissa Balakdjian",
  role: "GTM @ ElevenLabs | Ex-Salesforce | B2B Strategic Sales",
  eventTitle: "Mas alla del titulo: construir desde el proposito",
  eventDate: "Jueves 5\nde Marzo\n3 P.M",
  badgeLabel: "PARTICIPANTE",
}

const DEFAULT_FILTER: FilterSettings = {
  bgBlur: 5,
  bgGrain: 0.14,
  faceGrain: 0.10,
  faceTintHex: "#7e3a60",
  faceTintOpacity: 0.66,
  accentColor: "#e49bc2",
  overlay: true,
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function PosterGeneratorPage() {
  const [speaker, setSpeaker] = useState<SpeakerData>(DEFAULT_SPEAKER)
  const [filter, setFilter] = useState<FilterSettings>(DEFAULT_FILTER)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [detection, setDetection] = useState<FaceDetectionResult | null>(null)
  const [template, setTemplate] = useState<TemplateType>("eyes")

  const [isProcessing, setIsProcessing] = useState(false)
  const [modelStatus, setModelStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")

  const exportCanvasRef = useRef<HTMLCanvasElement>(null)

  // Preload bg.png and larissa.png on mount
  useEffect(() => {
    let cancelled = false

    async function preload() {
      setIsProcessing(true)
      setModelStatus("loading")

      try {
        // Load both images in parallel
        const [bgImg, speakerImg] = await Promise.all([
          loadImage("/bg.png"),
          loadImage("/larissa.png"),
        ])

        if (cancelled) return

        setBgImage(bgImg)
        setImage(speakerImg)

        // Run face detection on the preloaded speaker image
        const result = await detectFace(speakerImg)
        if (cancelled) return

        if (result) {
          setDetection(result)
          setModelStatus("ready")
        } else {
          setModelStatus("error")
        }
      } catch {
        if (!cancelled) setModelStatus("error")
      } finally {
        if (!cancelled) setIsProcessing(false)
      }
    }

    preload()
    return () => {
      cancelled = true
    }
  }, [])

  const handleImageUpload = useCallback(async (file: File) => {
    setIsProcessing(true)
    setModelStatus("loading")

    const img = new Image()
    img.crossOrigin = "anonymous"
    const url = URL.createObjectURL(file)
    img.src = url

    img.onload = async () => {
      setImage(img)
      try {
        const result = await detectFace(img)
        if (result) {
          setDetection(result)
          setModelStatus("ready")
        } else {
          setModelStatus("error")
        }
      } catch {
        setModelStatus("error")
      } finally {
        setIsProcessing(false)
      }
    }

    img.onerror = () => {
      setIsProcessing(false)
      setModelStatus("error")
    }
  }, [])

  const handleExport = useCallback(async () => {
    const canvas = exportCanvasRef.current
    if (!canvas) return

    try {
      const blob = await exportPoster(canvas)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${speaker.name.toLowerCase().replace(/\s+/g, "-")}-poster.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
    }
  }, [speaker.name])

  const canExport = !!image && !!detection && !isProcessing

  return (
    <div className="min-h-screen bg-[#0e0e0e]">
      {/* Header */}
      <header className="border-b border-[#222] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 font-mono text-lg font-bold text-[#f0f0f0]">
              <span className="text-[#E49BC2]">SS</span>
              <svg
                className="h-5 w-5 text-[#4ade80]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="10" r="6" />
                <circle cx="16" cy="6" r="3" />
                <rect x="8" y="16" width="2" height="4" rx="1" />
                <rect x="14" y="16" width="2" height="4" rx="1" />
              </svg>
            </div>
            <span className="text-xs font-mono text-[#555] uppercase tracking-widest">
              Poster Generator
            </span>
          </div>
          {modelStatus === "ready" && (
            <span className="text-xs font-mono text-[#4ade80] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
              Face detection ready
            </span>
          )}
          {modelStatus === "loading" && (
            <span className="text-xs font-mono text-[#E49BC2] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E49BC2] animate-pulse" />
              Loading models...
            </span>
          )}
          {modelStatus === "error" && (
            <span className="text-xs font-mono text-[#ff6b6b] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b6b]" />
              No face detected
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto flex max-w-7xl flex-col lg:flex-row gap-8 p-6">
        {/* Left panel: form + controls */}
        <div className="flex flex-col gap-8 lg:w-[360px] shrink-0 overflow-y-auto max-h-[calc(100vh-80px)] pb-8 pr-2">
          <PosterForm
            speaker={speaker}
            onSpeakerChange={setSpeaker}
            onImageUpload={handleImageUpload}
            hasImage={!!image}
          />
          <div className="border-t border-[#222] pt-6">
            <PosterControls
              template={template}
              onTemplateChange={setTemplate}
              filter={filter}
              onFilterChange={setFilter}
              onExport={handleExport}
              isProcessing={isProcessing}
              canExport={canExport}
            />
          </div>
        </div>

        {/* Right panel: preview */}
        <div className="flex-1 flex items-start justify-center lg:sticky lg:top-6 self-start">
          <PosterPreview
            speaker={speaker}
            image={image}
            bgImage={bgImage}
            detection={detection}
            template={template}
            filter={filter}
            exportCanvasRef={exportCanvasRef}
          />
        </div>
      </main>

      {/* Off-screen export canvas (full resolution) */}
      <canvas
        ref={exportCanvasRef}
        width={1080}
        height={1350}
        className="fixed -left-[9999px] top-0 pointer-events-none"
      />
    </div>
  )
}
