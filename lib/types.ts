export interface SpeakerData {
  name: string
  role: string
  eventTitle: string
  eventDate: string
  sideTextLeft: string
  sideTextRight: string
  badgeLabel: string
}

export interface FilterSettings {
  bgBlur: number        // 0-40, default 14
  bgGrain: number       // 0-1, default 0.12
  faceGrain: number     // 0-1, default 0.15
  faceTintHex: string   // default "#9A7E8E"
  faceTintOpacity: number // 0-1, default 0.65
  accentColor: string   // default "#E49BC2"
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
  landmarks: { x: number; y: number }[]
}

export type TemplateType = "half-face" | "eyes"

export interface PosterOptions {
  speaker: SpeakerData
  image: HTMLImageElement
  detection: FaceDetectionResult
  template: TemplateType
  filter: FilterSettings
  width: number
  height: number
}
