import type { PosterOptions, FaceBox, FilterSettings, TemplateType } from "./types"

// ── Safari detection: ctx.filter is not supported ───────────────────
function supportsCtxFilter(): boolean {
  if (typeof document === "undefined") return false
  const c = document.createElement("canvas")
  c.width = 1; c.height = 1
  const ctx = c.getContext("2d")!
  ctx.filter = "grayscale(100%)"
  return ctx.filter === "grayscale(100%)"
}
let _supportsFilter: boolean | null = null
function hasCtxFilter(): boolean {
  if (_supportsFilter === null) _supportsFilter = supportsCtxFilter()
  return _supportsFilter
}

// ── Manual pixel grayscale (Safari fallback) ────────────────────────
function applyGrayscale(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const imgData = ctx.getImageData(x, y, w, h)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114
    d[i] = d[i+1] = d[i+2] = gray
  }
  ctx.putImageData(imgData, x, y)
}

// ── Manual pixel brightness (Safari fallback) ───────────────────────
function applyBrightness(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, factor: number) {
  const imgData = ctx.getImageData(x, y, w, h)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = Math.min(255, d[i] * factor)
    d[i+1] = Math.min(255, d[i+1] * factor)
    d[i+2] = Math.min(255, d[i+2] * factor)
  }
  ctx.putImageData(imgData, x, y)
}

// ── Stackblur-lite for Safari (box blur approximation) ──────────────
function applyBoxBlur(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  if (radius <= 0) return
  const passes = 3 // 3-pass box blur approximates Gaussian
  const imgData = ctx.getImageData(x, y, w, h)
  const d = imgData.data
  const len = w * h * 4
  const tmp = new Uint8ClampedArray(len)

  for (let pass = 0; pass < passes; pass++) {
    // Horizontal pass
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        let r = 0, g = 0, b = 0, count = 0
        for (let k = -radius; k <= radius; k++) {
          const c2 = Math.min(w - 1, Math.max(0, col + k))
          const idx = (row * w + c2) * 4
          r += d[idx]; g += d[idx+1]; b += d[idx+2]; count++
        }
        const idx = (row * w + col) * 4
        tmp[idx] = r / count; tmp[idx+1] = g / count; tmp[idx+2] = b / count; tmp[idx+3] = d[idx+3]
      }
    }
    // Vertical pass
    for (let col = 0; col < w; col++) {
      for (let row = 0; row < h; row++) {
        let r = 0, g = 0, b = 0, count = 0
        for (let k = -radius; k <= radius; k++) {
          const r2 = Math.min(h - 1, Math.max(0, row + k))
          const idx = (r2 * w + col) * 4
          r += tmp[idx]; g += tmp[idx+1]; b += tmp[idx+2]; count++
        }
        const idx = (row * w + col) * 4
        d[idx] = r / count; d[idx+1] = g / count; d[idx+2] = b / count
      }
    }
  }
  ctx.putImageData(imgData, x, y)
}

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
// `align` controls vertical alignment: "top" keeps the top of the image visible,
// "center" (default) centers the crop.
function getCoverCoords(imgW: number, imgH: number, targetW: number, targetH: number, align: "top" | "center" = "center") {
  const imgRatio = imgW / imgH
  const targetRatio = targetW / targetH
  let sx: number, sy: number, sw: number, sh: number
  if (imgRatio > targetRatio) {
    sh = imgH; sw = imgH * targetRatio; sx = (imgW - sw) / 2; sy = 0
  } else {
    sw = imgW; sh = imgW / targetRatio; sx = 0
    sy = align === "top" ? 0 : (imgH - sh) / 2
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
  const dw = Math.ceil(destW)
  const dh = Math.ceil(destH)
  off.width = dw
  off.height = dh
  const offCtx = off.getContext("2d")!

  if (hasCtxFilter()) {
    offCtx.filter = "grayscale(100%)"
    offCtx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, dw, dh)
    offCtx.filter = "none"
  } else {
    // Safari fallback: draw then apply manual grayscale
    offCtx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, dw, dh)
    applyGrayscale(offCtx, 0, 0, dw, dh)
  }

  offCtx.globalCompositeOperation = "multiply"
  offCtx.fillStyle = hexToRgba(filter.faceTintHex, filter.faceTintOpacity)
  offCtx.fillRect(0, 0, dw, dh)
  offCtx.globalCompositeOperation = "screen"
  offCtx.fillStyle = hexToRgba(filter.faceTintHex, 0.1)
  offCtx.fillRect(0, 0, dw, dh)
  offCtx.globalCompositeOperation = "source-over"
  return off
}

// ── BACKGROUND: static full-bleed draw, no offset ───────────────────
function drawBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cover: { sx: number; sy: number; sw: number; sh: number },
  width: number, height: number,
  filter: FilterSettings
) {
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, width, height)

  // Always draw at (0,0) with no offset. BG is static across all templates.
  const sharpOff = document.createElement("canvas")
  sharpOff.width = width
  sharpOff.height = height
  const sc = sharpOff.getContext("2d")!
  sc.drawImage(image, cover.sx, cover.sy, cover.sw, cover.sh, 0, 0, width, height)

  ctx.filter = `grayscale(100%) blur(${filter.bgBlur}px) brightness(0.3)`
  ctx.drawImage(sharpOff, 0, 0)
  ctx.filter = "none"
}

// ── Main render function ────────────────────────────────────────────
export function renderPoster(canvas: HTMLCanvasElement, options: PosterOptions): void {
  const { speaker, image, bgImage, detection, template, filter, width, height } = options
  const ctx = canvas.getContext("2d")!
  canvas.width = width
  canvas.height = height

  // Top-aligned cover: always shows the topmost part of the image (e.g., full head)
  const cover = getCoverCoords(image.width, image.height, width, height, "top")

  // Determine crop region
  let cropRegion: FaceBox
  if (template === "eyes") cropRegion = detection.eyesRegion
  else if (template === "smile") cropRegion = detection.smileRegion
  else cropRegion = detection.rightHalfBox
  const clamped = clampBox(cropRegion, image.width, image.height)

  // ── COMPUTE BOX POSITION ──────────────────────────────────────
  // BG is always static (top-aligned, no offset). Only the box moves.
  const margin = width * 0.06
  const cropAspect = clamped.width / clamped.height
  let boxX: number, boxY: number, boxW: number, boxH: number

  if (filter.overlay) {
    // Natural position from imgToCanvas -- matches the BG since both
    // use the same top-aligned cover coords.
    const nat = imgToCanvas(
      clamped.x, clamped.y, clamped.width, clamped.height,
      width, height, cover
    )
    boxX = nat.x; boxY = nat.y; boxW = nat.w; boxH = nat.h

    // When autoPosition is ON, nudge the box so it doesn't collide
    // with the logo zone at the top or get clipped by canvas edges.
    // The BG stays static -- only the box moves. The blur makes any
    // slight edge misalignment at the box border invisible.
    if (filter.autoPosition) {
      const logoZoneBottom = height * 0.12 // logo occupies ~top 12%
      const badgeW = width * 0.05

      // Push box below logo zone
      if (boxY < logoZoneBottom) {
        boxY = logoZoneBottom
      }
      // Keep box + badge within right edge
      if (boxX + boxW + badgeW > width - margin) {
        boxX = width - margin - boxW - badgeW
      }
      // Keep box within left edge
      if (boxX < margin) {
        boxX = margin
      }
      // Keep box from going below the text area (~58%)
      if (boxY + boxH > height * 0.58) {
        boxY = height * 0.58 - boxH
      }
    }
  } else {
    if (template === "half-face") {
      boxH = height * 0.55; boxW = boxH * cropAspect
      if (boxW > width * 0.35) { boxW = width * 0.35; boxH = boxW / cropAspect }
      boxX = width - boxW - margin; boxY = height * 0.08
    } else {
      boxW = width * 0.60; boxH = boxW / cropAspect
      if (boxH > height * 0.25) { boxH = height * 0.25; boxW = boxH * cropAspect }
      boxX = (width - boxW) / 2; boxY = height * 0.22
    }
  }

  // ── 1) DRAW BACKGROUND ────────────���─────────────────────────────
  drawBackground(ctx, image, cover, width, height, filter)
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

  // ── 3) BADGE ──────────────────────────────────────────────────
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

  // ── 4) bg.png frame overlay ────────────────────────────────────
  if (bgImage) {
    const bgCover = getCoverCoords(bgImage.width, bgImage.height, width, height)
    ctx.drawImage(bgImage, bgCover.sx, bgCover.sy, bgCover.sw, bgCover.sh, 0, 0, width, height)
  }

  // ── 5) BOTTOM SECTION: portrait + name + role ─────────────────
  // Built from the canvas bottom upward. Text max-width is constrained
  // for all templates. Portrait sits above name, never overlapping.

  const nameFontSize = Math.round(width * 0.075)
  const roleFontSize = Math.round(width * 0.026)
  const textX = margin
  const textMaxW = width * 0.46

  // Pre-calculate role lines
  ctx.font = `600 ${roleFontSize}px "Geist", sans-serif`
  const roleLines = wrapText(ctx, speaker.role.toUpperCase(), textMaxW)
  const roleBlockH = roleLines.length * roleFontSize * 1.4

  // Pre-calculate name lines
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  const nameWords = speaker.name.toUpperCase().split(" ")
  const nameLines: string[] = []
  let tmpLine = ""
  for (const word of nameWords) {
    const test = tmpLine ? `${tmpLine} ${word}` : word
    if (ctx.measureText(test).width > textMaxW && tmpLine) {
      nameLines.push(tmpLine)
      tmpLine = word
    } else { tmpLine = test }
  }
  if (tmpLine) nameLines.push(tmpLine)
  const nameBlockH = nameLines.length * nameFontSize * 1.1

  // Portrait sizing
  const imgAspect = image.width / image.height
  const pScale = width * 0.12
  let pW: number, pH: number
  if (imgAspect > 1) { pW = pScale; pH = pScale / imgAspect }
  else { pH = pScale; pW = pScale * imgAspect }

  // Layout from bottom: role -> gap -> name -> big gap -> portrait
  const bottomEdge = height * 0.93
  const roleStartY = bottomEdge - roleBlockH
  const nameRoleGap = nameFontSize * 0.6
  const nameBottomY = roleStartY - nameRoleGap
  const nameTopY = nameBottomY - nameBlockH + nameFontSize
  // Portrait sits above the name with moderate spacing
  const portraitGap = nameFontSize * 0.5
  const pY = nameTopY - nameFontSize - portraitGap - pH
  const pX = margin

  // Draw portrait
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

  // Draw name
  ctx.fillStyle = "#ffffff"
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  ctx.textAlign = "left"
  for (let i = 0; i < nameLines.length; i++) {
    ctx.fillText(nameLines[i], textX, nameTopY + i * nameFontSize * 1.1)
  }

  // Draw role
  ctx.fillStyle = "#4ade80"
  ctx.font = `600 ${roleFontSize}px "Geist", sans-serif`
  for (let i = 0; i < roleLines.length; i++) {
    ctx.fillText(roleLines[i], textX, roleStartY + i * roleFontSize * 1.4)
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
