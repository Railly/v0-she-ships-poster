"use client"

import { useRef } from "react"
import { Upload } from "lucide-react"
import type { SpeakerData } from "@/lib/types"

interface PosterFormProps {
  speaker: SpeakerData
  onSpeakerChange: (data: SpeakerData) => void
  onImageUpload: (file: File) => void
  hasImage: boolean
}

export function PosterForm({
  speaker,
  onSpeakerChange,
  onImageUpload,
  hasImage,
}: PosterFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const update = (field: keyof SpeakerData, value: string) => {
    onSpeakerChange({ ...speaker, [field]: value })
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[#E49BC2]">
        Poster Details
      </h2>

      {/* Photo upload */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[#a0a0a0] mb-2">
          Photo
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 rounded border border-dashed border-[#333] bg-[#1a1a1a] px-4 py-6 text-sm text-[#a0a0a0] transition-colors hover:border-[#E49BC2] hover:text-[#E49BC2] cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          {hasImage ? "Change photo" : "Upload photo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImageUpload(file)
          }}
        />
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[#a0a0a0] mb-2">
          Name
        </label>
        <input
          type="text"
          value={speaker.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full rounded border border-[#333] bg-[#1a1a1a] px-3 py-2 text-sm text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none"
          placeholder="Catherine Romani"
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[#a0a0a0] mb-2">
          Role / Title
        </label>
        <input
          type="text"
          value={speaker.role}
          onChange={(e) => update("role", e.target.value)}
          className="w-full rounded border border-[#333] bg-[#1a1a1a] px-3 py-2 text-sm text-[#f0f0f0] font-mono focus:border-[#E49BC2] focus:outline-none"
          placeholder="Strategic Growth & Funding Consultant"
        />
      </div>




    </div>
  )
}
