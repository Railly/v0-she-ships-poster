export interface SpeakerData {
  name: string
  role: string
}

export interface FilterSettings {
  bgBlur: number        // 0-40, default 6
  bgGrain: number       // 0-1, default 0.14
  faceGrain: number     // 0-1, default 0.10
  faceTintHex: string   // default "#7e3a60"
  faceTintOpacity: number // 0-1, default 0.66
  accentColor: string   // default "#e49bc2"
  overlay: boolean      // whether to position crop at real face location
  autoPosition: boolean // nudge box to avoid logo/badge clipping
  panX: number          // -100 to 100, horizontal image shift (%)
  panY: number          // -100 to 100, vertical image shift (%)
  zoom: number          // 0.5 to 2.0, image zoom level
}

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
}

export interface EyesRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface FaceDetectionResult {
  faceBox: FaceBox
  rightHalfBox: FaceBox
  eyesRegion: EyesRegion
  smileRegion: FaceBox
  landmarks: { x: number; y: number }[]
}

export type TemplateType = "half-face" | "eyes" | "smile"

export interface PosterOptions {
  speaker: SpeakerData
  image: HTMLImageElement
  bgImage?: HTMLImageElement | null
  detection: FaceDetectionResult
  template: TemplateType
  filter: FilterSettings
  width: number
  height: number
}
