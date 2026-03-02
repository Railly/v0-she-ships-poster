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

// ── LAYOUT HELPERS ──────────────────────────────────────────────────

interface LayoutResult {
  boxX: number; boxY: number; boxWidth: number; boxHeight: number
  bgOffsetX: number; bgOffsetY: number
  // Text zone: absolute Y where name starts, and X margin
  textX: number; textY: number; textMaxW: number
  // Portrait position
  portraitX: number; portraitY: number; portraitW: number; portraitH: number
}

function computeLayout(
  template: TemplateType,
  overlay: boolean,
  clamped: FaceBox,
  image: HTMLImageElement,
  cover: { sx: number; sy: number; sw: number; sh: number },
  width: number,
  height: number
): LayoutResult {
  const margin = width * 0.06
  const imgAspect = image.width / image.height

  // Portrait sizing (constant for all templates)
  const pScale = width * 0.13
  let pW: number, pH: number
  if (imgAspect > 1) { pW = pScale; pH = pScale / imgAspect }
  else { pH = pScale; pW = pScale * imgAspect }

  if (template === "half-face") {
    // ── HALF-FACE: tall thin box on the RIGHT, text on the LEFT ──
    const cropAspect = clamped.width / clamped.height
    let bW: number, bH: number

    if (overlay) {
      const natural = imgToCanvas(
        clamped.x, clamped.y, clamped.width, clamped.height,
        width, height, cover
      )
      bW = natural.w
      bH = natural.h
      // Constrain to max 42% width, 65% height
      if (bW > width * 0.42) { bH *= (width * 0.42) / bW; bW = width * 0.42 }
      if (bH > height * 0.65) { bW *= (height * 0.65) / bH; bH = height * 0.65 }

      let bX = natural.x
      let bY = natural.y
      let offX = 0, offY = 0

      // Push into safe zone
      const safeT = height * 0.10
      const safeB = height * 0.75
      if (bY < safeT) { offY = safeT - bY }
      if (bY + bH > safeB) { offY = safeB - (bY + bH) }
      if (bX + bW > width - margin) { offX = (width - margin) - (bX + bW) }
      if (bX < width * 0.45) { offX = width * 0.45 - bX }

      bX += offX; bY += offY
      const textBottomY = bY + bH + height * 0.02
      const nameFS = Math.round(width * 0.075)
      const roleFS = Math.round(width * 0.026)

      return {
        boxX: bX, boxY: bY, boxWidth: bW, boxHeight: bH,
        bgOffsetX: offX, bgOffsetY: offY,
        textX: margin, textY: textBottomY,
        textMaxW: bX - margin - width * 0.03,
        portraitX: margin, portraitY: bY + bH - pH,
        portraitW: pW, portraitH: pH,
      }
    } else {
      // Non-overlay: fixed right-side position
      bH = height * 0.60
      bW = bH * cropAspect
      if (bW > width * 0.40) { bW = width * 0.40; bH = bW / cropAspect }
      const bX = width - bW - margin
      const bY = height * 0.10

      return {
        boxX: bX, boxY: bY, boxWidth: bW, boxHeight: bH,
        bgOffsetX: 0, bgOffsetY: 0,
        textX: margin, textY: bY + bH + height * 0.02,
        textMaxW: bX - margin - width * 0.02,
        portraitX: margin, portraitY: bY + bH - pH,
        portraitW: pW, portraitH: pH,
      }
    }
  } else {
    // ── EYES / SMILE: horizontal box, centered, text below ───────
    const cropAspect = clamped.width / clamped.height

    if (overlay) {
      const natural = imgToCanvas(
        clamped.x, clamped.y, clamped.width, clamped.height,
        width, height, cover
      )
      let bW = natural.w, bH = natural.h
      // Constrain to max 70% width, 30% height
      if (bW > width * 0.70) { bH *= (width * 0.70) / bW; bW = width * 0.70 }
      if (bH > height * 0.30) { bW *= (height * 0.30) / bH; bH = height * 0.30 }

      let bX = natural.x, bY = natural.y
      let offX = 0, offY = 0

      const safeT = height * 0.10
      const safeB = height * 0.50
      if (bY < safeT) { offY = safeT - bY }
      if (bY + bH > safeB) { offY = safeB - (bY + bH) }
      // Horizontal: center-ish, but keep in bounds
      if (bX < margin) { offX = margin - bX }
      if (bX + bW > width - margin) { offX = (width - margin) - (bX + bW) }

      bX += offX; bY += offY

      return {
        boxX: bX, boxY: bY, boxWidth: bW, boxHeight: bH,
        bgOffsetX: offX, bgOffsetY: offY,
        textX: margin, textY: bY + bH + height * 0.12,
        textMaxW: width * 0.88,
        portraitX: margin, portraitY: bY + bH + height * 0.02,
        portraitW: pW, portraitH: pH,
      }
    } else {
      // Non-overlay: centered horizontal box
      let bW = width * 0.65, bH = bW / cropAspect
      if (bH > height * 0.28) { bH = height * 0.28; bW = bH * cropAspect }
      const bX = (width - bW) / 2
      const bY = height * 0.12

      return {
        boxX: bX, boxY: bY, boxWidth: bW, boxHeight: bH,
        bgOffsetX: 0, bgOffsetY: 0,
        textX: margin, textY: bY + bH + height * 0.12,
        textMaxW: width * 0.88,
        portraitX: margin, portraitY: bY + bH + height * 0.02,
        portraitW: pW, portraitH: pH,
      }
    }
  }
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

  // Compute layout for this template
  const L = computeLayout(template, filter.overlay, clamped, image, cover, width, height)

  // ── 1) Dark base + blurred B&W background ──────────────────────
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, width, height)

  {
    const pad = Math.max(filter.bgBlur * 3, 40)
    const bigW = width + pad * 2
    const bigH = height + pad * 2

    // Draw image sharp first, with offset for overlay alignment
    // Use the full source image (0, 0, iw, ih) at cover-fit + offset
    // to guarantee full coverage (no black gaps)
    const sharpOff = document.createElement("canvas")
    sharpOff.width = bigW
    sharpOff.height = bigH
    const sharpCtx = sharpOff.getContext("2d")!
    sharpCtx.fillStyle = "#111111"
    sharpCtx.fillRect(0, 0, bigW, bigH)

    // Draw the full original image at a scale that covers the big canvas
    // centered on the offset position — this fills ALL gaps naturally
    const coverBig = getCoverCoords(image.width, image.height, bigW, bigH)
    sharpCtx.drawImage(
      image,
      coverBig.sx, coverBig.sy, coverBig.sw, coverBig.sh,
      L.bgOffsetX, L.bgOffsetY, bigW, bigH
    )

    // Blur + grayscale
    const blurOff = document.createElement("canvas")
    blurOff.width = bigW
    blurOff.height = bigH
    const blurCtx = blurOff.getContext("2d")!
    blurCtx.filter = `grayscale(100%) blur(${filter.bgBlur}px) brightness(0.3)`
    blurCtx.drawImage(sharpOff, 0, 0)
    blurCtx.filter = "none"

    ctx.drawImage(blurOff, pad, pad, width, height, 0, 0, width, height)
  }
  tileGrain(ctx, 0, 0, width, height, filter.bgGrain)

  // ── 2) Tinted face crop box ────────────────────────────────────
  {
    const tc = renderGrayscaleTinted(
      image, clamped.x, clamped.y, clamped.width, clamped.height,
      L.boxWidth, L.boxHeight, filter
    )
    ctx.save()
    ctx.beginPath()
    ctx.rect(L.boxX, L.boxY, L.boxWidth, L.boxHeight)
    ctx.clip()
    ctx.drawImage(tc, L.boxX, L.boxY)
    tileGrain(ctx, L.boxX, L.boxY, L.boxWidth, L.boxHeight, filter.faceGrain)
    ctx.restore()
  }
  ctx.strokeStyle = filter.accentColor
  ctx.lineWidth = 2
  ctx.strokeRect(L.boxX, L.boxY, L.boxWidth, L.boxHeight)

  // ── 3) Badge — outside box, top-right corner ───────────────────
  {
    const badgeText = speaker.badgeLabel.toUpperCase()
    const badgeFontSize = Math.round(width * 0.016)
    ctx.font = `bold ${badgeFontSize}px "Geist", sans-serif`
    const textW = ctx.measureText(badgeText).width
    const badgePadY = badgeFontSize * 1.2
    const badgeW = width * 0.042
    const badgeH = textW + badgePadY * 2
    const badgeX = L.boxX + L.boxWidth
    const badgeY = L.boxY

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

  // ── 4) Small portrait (tinted, with green brackets) ────────────
  {
    const tp = renderGrayscaleTinted(
      image, 0, 0, image.width, image.height,
      L.portraitW, L.portraitH, filter
    )
    ctx.drawImage(tp, L.portraitX, L.portraitY)
    tileGrain(ctx, L.portraitX, L.portraitY, L.portraitW, L.portraitH, filter.faceGrain)

    const bPad = 8, bLen = 14
    ctx.strokeStyle = "#4ade80"
    ctx.lineWidth = 2
    // Top-right bracket
    ctx.beginPath()
    ctx.moveTo(L.portraitX + L.portraitW + bPad - bLen, L.portraitY - bPad)
    ctx.lineTo(L.portraitX + L.portraitW + bPad, L.portraitY - bPad)
    ctx.lineTo(L.portraitX + L.portraitW + bPad, L.portraitY - bPad + bLen)
    ctx.stroke()
    // Bottom-left bracket
    ctx.beginPath()
    ctx.moveTo(L.portraitX - bPad + bLen, L.portraitY + L.portraitH + bPad)
    ctx.lineTo(L.portraitX - bPad, L.portraitY + L.portraitH + bPad)
    ctx.lineTo(L.portraitX - bPad, L.portraitY + L.portraitH + bPad - bLen)
    ctx.stroke()
  }

  // ── 5) bg.png frame overlay ────────────────────────────────────
  if (bgImage) {
    const bgCover = getCoverCoords(bgImage.width, bgImage.height, width, height)
    ctx.drawImage(bgImage, bgCover.sx, bgCover.sy, bgCover.sw, bgCover.sh, 0, 0, width, height)
  }

  // ── 6) Name + Role text ────────────────────────────────────────
  const nameFontSize = Math.round(width * 0.075)
  const roleFontSize = Math.round(width * 0.026)

  ctx.fillStyle = "#ffffff"
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  ctx.textAlign = "left"

  const nameWords = speaker.name.toUpperCase().split(" ")
  let curY = L.textY
  let curLine = ""

  for (const word of nameWords) {
    const test = curLine ? `${curLine} ${word}` : word
    if (ctx.measureText(test).width > L.textMaxW && curLine) {
      ctx.fillText(curLine, L.textX, curY)
      curY += nameFontSize * 1.08
      curLine = word
    } else {
      curLine = test
    }
  }
  if (curLine) {
    ctx.fillText(curLine, L.textX, curY)
    curY += nameFontSize * 0.85
  }

  // Role — immediately after name, ZERO extra gap
  ctx.fillStyle = "#4ade80"
  ctx.font = `600 ${roleFontSize}px "Geist", sans-serif`
  const roleLines = wrapText(ctx, speaker.role.toUpperCase(), L.textMaxW)
  for (let i = 0; i < roleLines.length; i++) {
    ctx.fillText(roleLines[i], L.textX, curY + i * roleFontSize * 1.35)
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
