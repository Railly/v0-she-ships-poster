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

  // Initial cover-fit (may be adjusted for overlay alignment)
  const cover = getCoverCoords(image.width, image.height, width, height)

  // ── 3) Determine crop region based on template ─────────────────
  let cropRegion: FaceBox
  if (template === "eyes") {
    cropRegion = detection.eyesRegion
  } else if (template === "smile") {
    cropRegion = detection.smileRegion
  } else {
    cropRegion = detection.rightHalfBox
  }
  const clamped = clampBox(cropRegion, image.width, image.height)

  // ── 4) Compute box position & size ─────────────────────────────
  const boxMargin = width * 0.04
  const boxMaxWidth = width * 0.48
  const boxMaxHeight = height * 0.45
  const minTopMargin = height * 0.10
  const minBottomMargin = height * 0.38

  let boxX: number, boxY: number, boxWidth: number, boxHeight: number

  if (filter.overlay) {
    // Map face crop to its natural position in the poster
    const initial = imgToCanvas(
      clamped.x, clamped.y, clamped.width, clamped.height,
      width, height, cover
    )
    boxX = initial.x
    boxY = initial.y
    boxWidth = initial.w
    boxHeight = initial.h

    // If the box overflows top or bottom, shift the COVER source offset
    // so the background image AND box move together (maintaining alignment)
    const safeTop = minTopMargin
    const safeBottom = height - minBottomMargin

    if (boxY < safeTop) {
      // Face is too high -- shift cover.sy DOWN (reveal lower part of image)
      const shiftCanvas = safeTop - boxY
      const scaleY = cover.sh / height
      cover.sy += shiftCanvas * scaleY
      // Clamp cover.sy to not go past image
      cover.sy = Math.min(cover.sy, image.height - cover.sh)
    } else if (boxY + boxHeight > safeBottom) {
      // Face is too low -- shift cover.sy UP
      const shiftCanvas = (boxY + boxHeight) - safeBottom
      const scaleY = cover.sh / height
      cover.sy -= shiftCanvas * scaleY
      cover.sy = Math.max(0, cover.sy)
    }

    // Now remap with the adjusted cover -- both BG and box use this
    const mapped = imgToCanvas(
      clamped.x, clamped.y, clamped.width, clamped.height,
      width, height, cover
    )
    boxX = mapped.x
    boxY = mapped.y
    boxWidth = mapped.w
    boxHeight = mapped.h

    // Also clamp horizontally
    if (boxX < boxMargin) boxX = boxMargin
    if (boxX + boxWidth > width - boxMargin) {
      boxWidth = width - boxMargin - boxX
    }
  } else {
    // Standard positioning: crop box on the right side
    const cropAspect = clamped.width / clamped.height
    if (cropAspect > boxMaxWidth / boxMaxHeight) {
      boxWidth = boxMaxWidth
      boxHeight = boxMaxWidth / cropAspect
    } else {
      boxHeight = boxMaxHeight
      boxWidth = boxMaxHeight * cropAspect
    }
    boxX = width - boxWidth - boxMargin
    boxY = minTopMargin
  }

  // ── 1) Dark base fill ───────────────────────────────────────────
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, width, height)

  // ── 2) Speaker image as blurred B&W background, full bleed
  // Uses the (possibly adjusted) cover coords so BG aligns with overlay box
  {
    const sharpOff = document.createElement("canvas")
    sharpOff.width = width
    sharpOff.height = height
    const sharpCtx = sharpOff.getContext("2d")!
    sharpCtx.fillStyle = "#111111"
    sharpCtx.fillRect(0, 0, width, height)
    sharpCtx.drawImage(
      image,
      cover.sx, cover.sy, cover.sw, cover.sh,
      0, 0, width, height
    )

    const pad = filter.bgBlur * 3
    const blurOff = document.createElement("canvas")
    blurOff.width = width + pad * 2
    blurOff.height = height + pad * 2
    const blurCtx = blurOff.getContext("2d")!
    blurCtx.fillStyle = "#111111"
    blurCtx.fillRect(0, 0, blurOff.width, blurOff.height)
    blurCtx.filter = `grayscale(100%) blur(${filter.bgBlur}px) brightness(0.3)`
    blurCtx.drawImage(sharpOff, pad, pad)
    blurCtx.filter = "none"

    ctx.drawImage(
      blurOff,
      pad, pad, width, height,
      0, 0, width, height
    )
  }

  // Background grain
  tileGrain(ctx, 0, 0, width, height, filter.bgGrain)

  // ── 5) Draw the grayscale + tinted face crop into box ──────────
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

  // ── 6) Badge label — OUTSIDE box, touching top-right corner ────
  {
    const badgeText = speaker.badgeLabel.toUpperCase()
    const badgeFontSize = Math.round(width * 0.016)
    ctx.font = `bold ${badgeFontSize}px "Geist", sans-serif`
    const textMetrics = ctx.measureText(badgeText)
    const badgeTextW = textMetrics.width

    const badgePadY = badgeFontSize * 1.2
    const badgeW = width * 0.042
    const badgeH = badgeTextW + badgePadY * 2

    // Badge left edge = box right edge (extends outward)
    const badgeX = boxX + boxWidth
    const badgeY = boxY

    ctx.save()
    ctx.fillStyle = filter.accentColor
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH)

    ctx.translate(badgeX + badgeW / 2, badgeY + badgeH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = "#1a1a1a"
    ctx.font = `bold ${badgeFontSize}px "Geist", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(badgeText, 0, 0)
    ctx.restore()
  }

  // ── 7) Small portrait — same grayscale + tint filter ───────────
  const portraitMaxW = width * 0.17
  const portraitMaxH = height * 0.16
  const imgAspect = image.width / image.height
  let portraitW: number, portraitH: number
  if (imgAspect > portraitMaxW / portraitMaxH) {
    portraitW = portraitMaxW
    portraitH = portraitMaxW / imgAspect
  } else {
    portraitH = portraitMaxH
    portraitW = portraitMaxH * imgAspect
  }

  // Position portrait: always below the crop box with a gap
  const portraitX = width * 0.06
  const portraitY = filter.overlay
    ? Math.max(boxY + boxHeight + height * 0.03, height * 0.40)
    : height * 0.36

  {
    const tintedPortrait = renderGrayscaleTinted(
      image,
      0, 0, image.width, image.height,
      portraitW, portraitH,
      filter
    )
    ctx.drawImage(tintedPortrait, portraitX, portraitY)
    tileGrain(ctx, portraitX, portraitY, portraitW, portraitH, filter.faceGrain)

    // Green brackets
    const bracketPad = 8
    const bracketLen = 14
    ctx.strokeStyle = "#4ade80"
    ctx.lineWidth = 2

    const trX = portraitX + portraitW + bracketPad
    const trY = portraitY - bracketPad
    ctx.beginPath()
    ctx.moveTo(trX - bracketLen, trY)
    ctx.lineTo(trX, trY)
    ctx.lineTo(trX, trY + bracketLen)
    ctx.stroke()

    const blX = portraitX - bracketPad
    const blY = portraitY + portraitH + bracketPad
    ctx.beginPath()
    ctx.moveTo(blX + bracketLen, blY)
    ctx.lineTo(blX, blY)
    ctx.lineTo(blX, blY - bracketLen)
    ctx.stroke()
  }

  // ── 8) Overlay bg.png ON TOP of everything (frame layer) ───────
  if (bgImage) {
    const bgCover = getCoverCoords(bgImage.width, bgImage.height, width, height)
    ctx.drawImage(
      bgImage,
      bgCover.sx, bgCover.sy, bgCover.sw, bgCover.sh,
      0, 0, width, height
    )
  }

  // ── 9) Text layout — name + role only (drawn after bg.png) ────
  const textLeftX = width * 0.06

  // Speaker name — WHITE, large, big gap from portrait
  const portraitBottomY = portraitY + portraitH
  const nameY = portraitBottomY + height * 0.10
  const nameFontSize = Math.round(width * 0.075)
  ctx.fillStyle = "#ffffff"
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  ctx.textAlign = "left"

  const nameMaxWidth = width * 0.88
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
    currentNameY += nameFontSize * 1.05
  }

  // Speaker role — green, nearly zero gap from name
  const roleY = currentNameY
  const roleFontSize = Math.round(width * 0.026)
  ctx.fillStyle = "#4ade80"
  ctx.font = `600 ${roleFontSize}px "Geist", sans-serif`
  const roleLines = wrapText(ctx, speaker.role.toUpperCase(), width * 0.7)
  for (let i = 0; i < roleLines.length; i++) {
    ctx.fillText(roleLines[i], textLeftX, roleY + i * roleFontSize * 1.35)
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
