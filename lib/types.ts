export interface SpeakerData {
  name: string
  role: string
  eventTitle: string
  eventDate: string
  sideTextLeft: string
  sideTextRight: string
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
  width: number
  height: number
}
