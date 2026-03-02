import type { PosterOptions, FaceBox, FilterSettings, TemplateType } from "./types"

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

function tileGrain(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, alpha: number
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
function getCoverCoords(imgW: number, imgH: number, targetW: number, targetH: number) {
  const imgRatio = imgW / imgH
  const targetRatio = targetW / targetH
  let sx: number, sy: number, sw: number, sh: number
  if (imgRatio > targetRatio) {
    sh = imgH; sw = imgH * targetRatio; sx = (imgW - sw) / 2; sy = 0
  } else {
    sw = imgW; sh = imgW / targetRatio; sx = 0; sy = (imgH - sh) / 2
  }
  return { sx, sy, sw, sh }
}

function clampBox(box: FaceBox, imgW: number, imgH: number): FaceBox {
  const x = Math.max(0, Math.min(box.x, imgW - 1))
  const y = Math.max(0, Math.min(box.y, imgH - 1))
  const w = Math.min(box.width, imgW - x)
  const h = Math.min(box.height, imgH - y)
  return { x, y, width: w, height: h }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function imgToCanvas(
  imgX: number, imgY: number, imgW: number, imgH: number,
  canvasW: number, canvasH: number,
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

function renderGrayscaleTinted(
  image: HTMLImageElement,
  srcX: number, srcY: number, srcW: number, srcH: number,
  destW: number, destH: number, filter: FilterSettings
): HTMLCanvasElement {
  const off = document.createElement("canvas")
  off.width = Math.ceil(destW)
  off.height = Math.ceil(destH)
  const offCtx = off.getContext("2d")!
  offCtx.filter = "grayscale(100%)"
  offCtx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, destW, destH)
  offCtx.filter = "none"
  offCtx.globalCompositeOperation = "multiply"
  offCtx.fillStyle = hexToRgba(filter.faceTintHex, filter.faceTintOpacity)
  offCtx.fillRect(0, 0, destW, destH)
  offCtx.globalCompositeOperation = "screen"
  offCtx.fillStyle = hexToRgba(filter.faceTintHex, 0.1)
  offCtx.fillRect(0, 0, destW, destH)
  offCtx.globalCompositeOperation = "source-over"
  return off
}

// ── BACKGROUND: draw blurred B&W with offset, filling gaps ──────────
function drawBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cover: { sx: number; sy: number; sw: number; sh: number },
  width: number, height: number,
  bgOffsetX: number, bgOffsetY: number,
  filter: FilterSettings
) {
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, width, height)

  // We draw the sharp image TWICE on an offscreen canvas:
  //   1. Once at (0,0) to fill the entire poster (gap-filler)
  //   2. Once at (offsetX, offsetY) to align face with overlay box
  // Then blur the whole thing. The second draw overwrites the first
  // where they overlap, and the first fills any edge gaps.

  const pad = Math.max(filter.bgBlur * 3, 50)
  const bigW = width + pad * 2
  const bigH = height + pad * 2

  const sharpOff = document.createElement("canvas")
  sharpOff.width = bigW
  sharpOff.height = bigH
  const sc = sharpOff.getContext("2d")!
  sc.fillStyle = "#111111"
  sc.fillRect(0, 0, bigW, bigH)

  // Layer 1: full cover at (pad, pad) -- fills entire area, no gaps
  sc.drawImage(
    image,
    cover.sx, cover.sy, cover.sw, cover.sh,
    pad, pad, width, height
  )

  // Layer 2: same image at (pad + offset, pad + offset) -- aligns face
  // This overdraw ONLY matters in the overlapping area (most of the canvas)
  // and the non-overlapping edges keep the gap-filler from layer 1
  if (bgOffsetX !== 0 || bgOffsetY !== 0) {
    sc.drawImage(
      image,
      cover.sx, cover.sy, cover.sw, cover.sh,
      pad + bgOffsetX, pad + bgOffsetY, width, height
    )
  }

  // Blur + grayscale the combined result
  const blurOff = document.createElement("canvas")
  blurOff.width = bigW
  blurOff.height = bigH
  const bc = blurOff.getContext("2d")!
  bc.filter = `grayscale(100%) blur(${filter.bgBlur}px) brightness(0.3)`
  bc.drawImage(sharpOff, 0, 0)
  bc.filter = "none"

  // Crop center back to poster
  ctx.drawImage(blurOff, pad, pad, width, height, 0, 0, width, height)
}

// ── Main render function ────────────────────────────────────────────
export function renderPoster(canvas: HTMLCanvasElement, options: PosterOptions): void {
  const { speaker, image, bgImage, detection, template, filter, width, height } = options
  const ctx = canvas.getContext("2d")!
  canvas.width = width
  canvas.height = height

  const cover = getCoverCoords(image.width, image.height, width, height)

  // Determine crop region
  let cropRegion: FaceBox
  if (template === "eyes") cropRegion = detection.eyesRegion
  else if (template === "smile") cropRegion = detection.smileRegion
  else cropRegion = detection.rightHalfBox
  const clamped = clampBox(cropRegion, image.width, image.height)

  // ── COMPUTE BOX POSITION ──────────────────────────────────────
  const margin = width * 0.06
  const cropAspect = clamped.width / clamped.height
  let boxX: number, boxY: number, boxW: number, boxH: number
  let bgOffsetX = 0, bgOffsetY = 0

  if (filter.overlay) {
    // Map crop to natural canvas position
    const nat = imgToCanvas(
      clamped.x, clamped.y, clamped.width, clamped.height,
      width, height, cover
    )
    boxW = nat.w; boxH = nat.h; boxX = nat.x; boxY = nat.y

    // Template-specific constraints
    if (template === "half-face") {
      // Cap width to 40%, height to 60%
      if (boxW > width * 0.40) { boxH *= (width * 0.40) / boxW; boxW = width * 0.40 }
      if (boxH > height * 0.60) { boxW *= (height * 0.60) / boxH; boxH = height * 0.60 }
    } else {
      // Eyes/smile: cap width to 65%, height to 28%
      if (boxW > width * 0.65) { boxH *= (width * 0.65) / boxW; boxW = width * 0.65 }
      if (boxH > height * 0.28) { boxW *= (height * 0.28) / boxH; boxH = height * 0.28 }
    }

    // Push into safe zone using offset (so BG moves with box)
    const safeTop = height * 0.10
    const safeBottom = height * 0.58

    if (boxY < safeTop) { bgOffsetY = safeTop - boxY }
    else if (boxY + boxH > safeBottom) { bgOffsetY = safeBottom - (boxY + boxH) }

    if (template === "half-face") {
      // Keep box on the right side
      const minLeft = width * 0.48
      if (boxX < minLeft) bgOffsetX = minLeft - boxX
      if (boxX + boxW + bgOffsetX > width - margin) {
        bgOffsetX = (width - margin - boxW) - boxX
      }
    } else {
      // Center horizontally-ish
      if (boxX < margin) bgOffsetX = margin - boxX
      if (boxX + boxW + bgOffsetX > width - margin) {
        bgOffsetX = (width - margin - boxW) - boxX
      }
    }

    boxX += bgOffsetX
    boxY += bgOffsetY
  } else {
    // Non-overlay: fixed positions
    if (template === "half-face") {
      boxH = height * 0.55
      boxW = boxH * cropAspect
      if (boxW > width * 0.38) { boxW = width * 0.38; boxH = boxW / cropAspect }
      boxX = width - boxW - margin
      boxY = height * 0.10
    } else {
      boxW = width * 0.60
      boxH = boxW / cropAspect
      if (boxH > height * 0.25) { boxH = height * 0.25; boxW = boxH * cropAspect }
      boxX = (width - boxW) / 2
      boxY = height * 0.12
    }
  }

  // ── 1) DRAW BACKGROUND ─────────────────────────────────────────
  drawBackground(ctx, image, cover, width, height, bgOffsetX, bgOffsetY, filter)
  tileGrain(ctx, 0, 0, width, height, filter.bgGrain)

  // ── 2) TINTED FACE CROP BOX ────────────────────────────────────
  const tc = renderGrayscaleTinted(
    image, clamped.x, clamped.y, clamped.width, clamped.height,
    boxW, boxH, filter
  )
  ctx.save()
  ctx.beginPath()
  ctx.rect(boxX, boxY, boxW, boxH)
  ctx.clip()
  ctx.drawImage(tc, boxX, boxY)
  tileGrain(ctx, boxX, boxY, boxW, boxH, filter.faceGrain)
  ctx.restore()

  ctx.strokeStyle = filter.accentColor
  ctx.lineWidth = 2
  ctx.strokeRect(boxX, boxY, boxW, boxH)

  // ── 3) BADGE — outside box, top-right corner ──────────────────
  {
    const badgeText = speaker.badgeLabel.toUpperCase()
    const badgeFontSize = Math.round(width * 0.016)
    ctx.font = `bold ${badgeFontSize}px "Geist", sans-serif`
    const textW = ctx.measureText(badgeText).width
    const badgePadY = badgeFontSize * 1.2
    const badgeW = width * 0.042
    const badgeH = textW + badgePadY * 2
    const badgeX = boxX + boxW
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

  // ── 4) PORTRAIT — smart positioning ────────────────────────────
  // Sizing
  const imgAspect = image.width / image.height
  const pScale = width * 0.12
  let pW: number, pH: number
  if (imgAspect > 1) { pW = pScale; pH = pScale / imgAspect }
  else { pH = pScale; pW = pScale * imgAspect }

  // For half-face: portrait on the LEFT, bottom-aligned with box
  // For eyes/smile: portrait below the box, left side
  let pX: number, pY: number
  if (template === "half-face") {
    pX = margin
    pY = boxY + boxH - pH
  } else {
    pX = margin
    pY = boxY + boxH + height * 0.02
  }

  {
    const tp = renderGrayscaleTinted(
      image, 0, 0, image.width, image.height, pW, pH, filter
    )
    ctx.drawImage(tp, pX, pY)
    tileGrain(ctx, pX, pY, pW, pH, filter.faceGrain)

    const bPad = 8, bLen = 14
    ctx.strokeStyle = "#4ade80"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pX + pW + bPad - bLen, pY - bPad)
    ctx.lineTo(pX + pW + bPad, pY - bPad)
    ctx.lineTo(pX + pW + bPad, pY - bPad + bLen)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pX - bPad + bLen, pY + pH + bPad)
    ctx.lineTo(pX - bPad, pY + pH + bPad)
    ctx.lineTo(pX - bPad, pY + pH + bPad - bLen)
    ctx.stroke()
  }

  // ── 5) bg.png frame overlay ────────────────────────────────────
  if (bgImage) {
    const bgCover = getCoverCoords(bgImage.width, bgImage.height, width, height)
    ctx.drawImage(bgImage, bgCover.sx, bgCover.sy, bgCover.sw, bgCover.sh, 0, 0, width, height)
  }

  // ── 6) NAME + ROLE TEXT ────────────────────────────────────────
  // Text ALWAYS starts after both the box bottom and portrait bottom
  // to guarantee it's never clipped and never collides
  const nameFontSize = Math.round(width * 0.075)
  const roleFontSize = Math.round(width * 0.026)

  const textX = margin
  let textMaxW: number
  let textStartY: number

  if (template === "half-face") {
    // Text on the left, constrained to space before the box
    textMaxW = boxX - margin - width * 0.02
    // Start below portrait (which is bottom-aligned with box)
    textStartY = pY + pH + height * 0.03
  } else {
    // Text full width, below both box and portrait
    textMaxW = width * 0.88
    const bottomMost = Math.max(boxY + boxH, pY + pH)
    textStartY = bottomMost + height * 0.03
  }

  // Clamp: if text would go past 92% of height, push it up
  const maxTextBottom = height * 0.92
  // Estimate total text height (name ~2 lines + role ~2 lines)
  const estTextH = nameFontSize * 2.2 + roleFontSize * 3
  if (textStartY + estTextH > maxTextBottom) {
    textStartY = maxTextBottom - estTextH
  }

  // Draw name
  ctx.fillStyle = "#ffffff"
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  ctx.textAlign = "left"

  const nameWords = speaker.name.toUpperCase().split(" ")
  let curY = textStartY
  let curLine = ""

  for (const word of nameWords) {
    const test = curLine ? `${curLine} ${word}` : word
    if (ctx.measureText(test).width > textMaxW && curLine) {
      ctx.fillText(curLine, textX, curY)
      curY += nameFontSize * 1.08
      curLine = word
    } else {
      curLine = test
    }
  }
  if (curLine) {
    ctx.fillText(curLine, textX, curY)
    curY += nameFontSize * 0.4  // very tight gap before role
  }

  // Role — nearly zero gap from name
  ctx.fillStyle = "#4ade80"
  ctx.font = `600 ${roleFontSize}px "Geist", sans-serif`
  const roleLines = wrapText(ctx, speaker.role.toUpperCase(), textMaxW)
  for (let i = 0; i < roleLines.length; i++) {
    ctx.fillText(roleLines[i], textX, curY + i * roleFontSize * 1.35)
  }
}

export function exportPoster(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error("Failed to export canvas")) },
      "image/png", 1
    )
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = test
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
