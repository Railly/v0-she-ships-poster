import type { PosterOptions, FaceBox, FilterSettings } from "./types"

// ── Grain texture (procedurally generated, cached) ──────────────────
let grainCanvas: HTMLCanvasElement | null = null

function getGrainTexture(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas
  grainCanvas = document.createElement("canvas")
  grainCanvas.width = 512
  grainCanvas.height = 512
  const ctx = grainCanvas.getContext("2d")!
  const imageData = ctx.createImageData(512, 512)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const val = Math.random() * 255
    imageData.data[i] = val
    imageData.data[i + 1] = val
    imageData.data[i + 2] = val
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return grainCanvas
}

// ── Tile grain over a region ────────────────────────────────────────
function tileGrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number
) {
  if (alpha <= 0) return
  const grain = getGrainTexture()
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = "overlay"
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  for (let gx = x; gx < x + w; gx += 512) {
    for (let gy = y; gy < y + h; gy += 512) {
      ctx.drawImage(grain, gx, gy)
    }
  }
  ctx.restore()
}

// ── Helper: cover-fit source coordinates ────────────────────────────
function getCoverCoords(
  imgW: number,
  imgH: number,
  targetW: number,
  targetH: number
) {
  const imgRatio = imgW / imgH
  const targetRatio = targetW / targetH
  let sx: number, sy: number, sw: number, sh: number
  if (imgRatio > targetRatio) {
    sh = imgH
    sw = imgH * targetRatio
    sx = (imgW - sw) / 2
    sy = 0
  } else {
    sw = imgW
    sh = imgW / targetRatio
    sx = 0
    sy = (imgH - sh) / 2
  }
  return { sx, sy, sw, sh }
}

// ── Clamp source coordinates to image bounds ────────────────────────
function clampBox(box: FaceBox, imgW: number, imgH: number): FaceBox {
  const x = Math.max(0, Math.min(box.x, imgW - 1))
  const y = Math.max(0, Math.min(box.y, imgH - 1))
  const w = Math.min(box.width, imgW - x)
  const h = Math.min(box.height, imgH - y)
  return { x, y, width: w, height: h }
}

// ── Parse hex to rgba string ────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Convert image coordinates to poster "cover" coordinates ─────────
function imgToCanvas(
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number,
  cover: { sx: number; sy: number; sw: number; sh: number }
) {
  const scaleX = canvasW / cover.sw
  const scaleY = canvasH / cover.sh
  return {
    x: (imgX - cover.sx) * scaleX,
    y: (imgY - cover.sy) * scaleY,
    w: imgW * scaleX,
    h: imgH * scaleY,
  }
}

// ── Render grayscale + tinted image onto an offscreen canvas ────────
function renderGrayscaleTinted(
  image: HTMLImageElement,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  filter: FilterSettings
): HTMLCanvasElement {
  const off = document.createElement("canvas")
  off.width = Math.ceil(destW)
  off.height = Math.ceil(destH)
  const offCtx = off.getContext("2d")!

  // Step 1: Draw grayscale
  offCtx.filter = "grayscale(100%)"
  offCtx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, destW, destH)
  offCtx.filter = "none"

  // Step 2: Color tint via multiply blend
  offCtx.globalCompositeOperation = "multiply"
  offCtx.fillStyle = hexToRgba(filter.faceTintHex, filter.faceTintOpacity)
  offCtx.fillRect(0, 0, destW, destH)

  // Step 3: Lighten slightly with screen for depth
  offCtx.globalCompositeOperation = "screen"
  offCtx.fillStyle = hexToRgba(filter.faceTintHex, 0.1)
  offCtx.fillRect(0, 0, destW, destH)
  offCtx.globalCompositeOperation = "source-over"

  return off
}

// ── Main render function ────────────────────────────────────────────
export function renderPoster(
  canvas: HTMLCanvasElement,
  options: PosterOptions
): void {
  const { speaker, image, bgImage, detection, template, filter, width, height } = options
  const ctx = canvas.getContext("2d")!
  canvas.width = width
  canvas.height = height

  const cover = getCoverCoords(image.width, image.height, width, height)

  // ── 1) Dark base fill ───────────────────────────────────────────
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, width, height)

  // ── 2) Background: full speaker image, B&W + blur + grain ──────
  // Draw a blurred, desaturated, dimmed version of the speaker photo
  {
    const bgOff = document.createElement("canvas")
    bgOff.width = width
    bgOff.height = height
    const bgCtx = bgOff.getContext("2d")!

    bgCtx.filter = `grayscale(100%) blur(${filter.bgBlur}px) brightness(0.3)`
    // Draw slightly oversized to avoid blur edge artifacts
    const blurPad = filter.bgBlur * 2
    bgCtx.drawImage(
      image,
      cover.sx, cover.sy, cover.sw, cover.sh,
      -blurPad, -blurPad, width + blurPad * 2, height + blurPad * 2
    )
    bgCtx.filter = "none"

    ctx.drawImage(bgOff, 0, 0)
  }

  // Background grain
  tileGrain(ctx, 0, 0, width, height, filter.bgGrain)

  // ── 3) Overlay bg.jpeg template on top ──────────────────────────
  // The bg image has decorations baked in (SS logo, crosshairs, side text)
  // We composite it so the dark parts are transparent-ish
  if (bgImage) {
    const bgCover = getCoverCoords(bgImage.width, bgImage.height, width, height)
    ctx.drawImage(
      bgImage,
      bgCover.sx, bgCover.sy, bgCover.sw, bgCover.sh,
      0, 0, width, height
    )
  }

  // ── 4) Determine crop region based on template ─────────────────
  let cropRegion: FaceBox
  if (template === "eyes") {
    cropRegion = detection.eyesRegion
  } else {
    cropRegion = detection.rightHalfBox
  }
  const clamped = clampBox(cropRegion, image.width, image.height)

  // ── 5) Compute box position & size ─────────────────────────────
  const boxMarginRight = width * 0.04
  const boxMaxWidth = width * 0.48
  const boxMaxHeight = height * 0.52
  const boxTopOffset = height * 0.06

  let boxX: number, boxY: number, boxWidth: number, boxHeight: number

  if (filter.overlay) {
    // Overlay mode: map crop region to its real position on the poster
    const mapped = imgToCanvas(
      clamped.x, clamped.y, clamped.width, clamped.height,
      width, height, cover
    )
    boxX = mapped.x
    boxY = mapped.y
    boxWidth = mapped.w
    boxHeight = mapped.h
  } else {
    // Standard right-side box, preserve aspect ratio
    const cropAspect = clamped.width / clamped.height
    if (cropAspect > boxMaxWidth / boxMaxHeight) {
      boxWidth = boxMaxWidth
      boxHeight = boxMaxWidth / cropAspect
    } else {
      boxHeight = boxMaxHeight
      boxWidth = boxMaxHeight * cropAspect
    }
    boxX = width - boxWidth - boxMarginRight
    boxY = boxTopOffset
  }

  // ── 6) Draw the grayscale + tinted face crop into box ──────────
  {
    const tintedCrop = renderGrayscaleTinted(
      image,
      clamped.x, clamped.y, clamped.width, clamped.height,
      boxWidth, boxHeight,
      filter
    )

    ctx.save()
    ctx.beginPath()
    ctx.rect(boxX, boxY, boxWidth, boxHeight)
    ctx.clip()
    ctx.drawImage(tintedCrop, boxX, boxY)
    tileGrain(ctx, boxX, boxY, boxWidth, boxHeight, filter.faceGrain)
    ctx.restore()
  }

  // Border around the crop box
  ctx.strokeStyle = filter.accentColor
  ctx.lineWidth = 2
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

  // ── 7) Badge label — OUTSIDE the box, touching top-right corner
  {
    const badgeText = speaker.badgeLabel.toUpperCase()
    const badgeFontSize = Math.round(width * 0.016)
    ctx.font = `bold ${badgeFontSize}px "Geist", sans-serif`
    const textMetrics = ctx.measureText(badgeText)
    const badgeTextW = textMetrics.width

    const badgePadY = badgeFontSize * 1.2
    const badgeW = width * 0.042
    const badgeH = badgeTextW + badgePadY * 2

    // Badge sits OUTSIDE the box: its LEFT edge touches the box's RIGHT edge
    // Its TOP edge aligns with the box's TOP edge
    const badgeX = boxX + boxWidth
    const badgeY = boxY

    ctx.save()
    ctx.fillStyle = filter.accentColor
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH)

    // Rotated text centered in the badge
    ctx.translate(badgeX + badgeW / 2, badgeY + badgeH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = "#1a1a1a"
    ctx.font = `bold ${badgeFontSize}px "Geist", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(badgeText, 0, 0)
    ctx.restore()
  }

  // ── 8) Small portrait — same grayscale + tint filter as crop ───
  {
    const portraitSize = width * 0.2
    const portraitX = width * 0.1
    // Position below the crop box area or at a sensible Y
    const portraitY = filter.overlay
      ? Math.max(boxY + boxHeight + height * 0.03, height * 0.5)
      : height * 0.55

    // Draw portrait with the SAME exact filter as the face crop
    const tintedPortrait = renderGrayscaleTinted(
      image,
      0, 0, image.width, image.height,
      portraitSize, portraitSize,
      filter
    )
    ctx.drawImage(tintedPortrait, portraitX, portraitY)
    tileGrain(ctx, portraitX, portraitY, portraitSize, portraitSize, filter.faceGrain)

    // Green brackets
    const bracketPad = 8
    const bracketLen = 14
    ctx.strokeStyle = "#4ade80"
    ctx.lineWidth = 2

    // Top-right bracket
    const trX = portraitX + portraitSize + bracketPad
    const trY = portraitY - bracketPad
    ctx.beginPath()
    ctx.moveTo(trX - bracketLen, trY)
    ctx.lineTo(trX, trY)
    ctx.lineTo(trX, trY + bracketLen)
    ctx.stroke()

    // Bottom-left bracket
    const blX = portraitX - bracketPad
    const blY = portraitY + portraitSize + bracketPad
    ctx.beginPath()
    ctx.moveTo(blX + bracketLen, blY)
    ctx.lineTo(blX, blY)
    ctx.lineTo(blX, blY - bracketLen)
    ctx.stroke()
  }

  // ── 9) Smart text layout ───────────────────────────────────────
  const textLeftX = width * 0.1

  // Determine text-safe width: space to the left of the box (or badge)
  const badgeOuterRight = boxX + boxWidth + width * 0.042
  const boxLeftEdge = boxX
  const rightObstacle = filter.overlay
    ? Math.min(boxLeftEdge, badgeOuterRight)
    : boxLeftEdge
  const textMaxWidth = Math.max(rightObstacle - textLeftX - width * 0.04, width * 0.25)

  // ── 9a) Event title ────────────────────────────────────────────
  let titleY = height * 0.15
  const titleFontSize = Math.round(width * 0.042)
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${titleFontSize}px "Geist Mono", monospace`
  ctx.textAlign = "left"

  const titleLines = wrapText(ctx, speaker.eventTitle.toUpperCase(), textMaxWidth)
  for (const line of titleLines) {
    ctx.fillText(line, textLeftX, titleY)
    titleY += titleFontSize * 1.25
  }

  // ── 9b) Date text ─────────────────────────────────────────────
  const dateY = titleY + height * 0.02
  const dateFontSize = Math.round(width * 0.02)
  ctx.fillStyle = "#4ade80"
  ctx.font = `${dateFontSize}px "Geist Mono", monospace`
  const dateLines = speaker.eventDate.split("\n")
  let currentDateY = dateY
  for (const line of dateLines) {
    ctx.fillText(line.toUpperCase(), textLeftX, currentDateY)
    currentDateY += dateFontSize * 1.5
  }

  // ── 9c) Speaker name (large, accent) ──────────────────────────
  const portraitBottomY = (filter.overlay
    ? Math.max(boxY + boxHeight + height * 0.03, height * 0.5)
    : height * 0.55) + width * 0.2 // portraitY + portraitSize

  const nameY = portraitBottomY + height * 0.07
  const nameFontSize = Math.round(width * 0.065)
  ctx.fillStyle = filter.accentColor
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  ctx.textAlign = "left"

  const nameMaxWidth = width * 0.8
  const nameWords = speaker.name.toUpperCase().split(" ")
  let currentNameY = nameY
  let currentNameLine = ""

  for (const word of nameWords) {
    const testLine = currentNameLine ? `${currentNameLine} ${word}` : word
    const testWidth = ctx.measureText(testLine).width
    if (testWidth > nameMaxWidth && currentNameLine) {
      ctx.fillText(currentNameLine, textLeftX, currentNameY)
      currentNameY += nameFontSize * 1.1
      currentNameLine = word
    } else {
      currentNameLine = testLine
    }
  }
  if (currentNameLine) {
    ctx.fillText(currentNameLine, textLeftX, currentNameY)
    currentNameY += nameFontSize * 1.1
  }

  // ── 9d) Speaker role ──────────────────────────────────────────
  const roleY = currentNameY + height * 0.01
  const roleFontSize = Math.round(width * 0.018)
  ctx.fillStyle = "#ffffff"
  ctx.font = `${roleFontSize}px "Geist", sans-serif`
  const roleLines = wrapText(ctx, speaker.role.toUpperCase(), width * 0.5)
  for (let i = 0; i < roleLines.length; i++) {
    ctx.fillText(roleLines[i], textLeftX, roleY + i * roleFontSize * 1.5)
  }
}

// ── Export as PNG blob ──────────────────────────────────────────────
export function exportPoster(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Failed to export canvas"))
      },
      "image/png",
      1
    )
  })
}

// ── Utility: wrap text into lines ───────────────────────────────────
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
