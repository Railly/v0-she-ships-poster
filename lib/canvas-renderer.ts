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

// ── BACKGROUND: adjust source crop to handle offset, always full-bleed
function drawBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cover: { sx: number; sy: number; sw: number; sh: number },
  width: number, height: number,
  filter: FilterSettings,
  offsetX = 0, offsetY = 0
) {
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, width, height)

  // Instead of shifting the destination (which leaves black gaps),
  // we adjust the SOURCE crop to show more/less of the image.
  // This keeps the draw at (0,0,width,height) = always full-bleed.
  const scaleX = cover.sw / width
  const scaleY = cover.sh / height

  // Shift source crop by the offset (converted to image-space)
  let sx = cover.sx - offsetX * scaleX
  let sy = cover.sy - offsetY * scaleY
  const sw = cover.sw
  const sh = cover.sh

  // Clamp to image bounds
  sx = Math.max(0, Math.min(sx, image.width - sw))
  sy = Math.max(0, Math.min(sy, image.height - sh))

  const sharpOff = document.createElement("canvas")
  sharpOff.width = width
  sharpOff.height = height
  const sc = sharpOff.getContext("2d")!
  sc.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)

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

  const cover = getCoverCoords(image.width, image.height, width, height)

  // Determine crop region
  let cropRegion: FaceBox
  if (template === "eyes") cropRegion = detection.eyesRegion
  else if (template === "smile") cropRegion = detection.smileRegion
  else cropRegion = detection.rightHalfBox
  const clamped = clampBox(cropRegion, image.width, image.height)

  // ── COMPUTE BOX POSITION ──────────────────────────────────────
  // Box is positioned independently from BG. BG is always full-bleed
  // (no offset). Box is clamped to a safe zone.
  const margin = width * 0.06
  const cropAspect = clamped.width / clamped.height
  let boxX: number, boxY: number, boxW: number, boxH: number

  // Offset applied to BOTH bg and box to keep them aligned
  let bgOffsetX = 0, bgOffsetY = 0

  if (filter.overlay) {
    // Use EXACT natural position + size from imgToCanvas.
    // Both the BG and the box use the same cover coords, so this
    // guarantees pixel-perfect alignment.
    const nat = imgToCanvas(
      clamped.x, clamped.y, clamped.width, clamped.height,
      width, height, cover
    )
    boxX = nat.x; boxY = nat.y; boxW = nat.w; boxH = nat.h

    // If the box extends above or past canvas edges, shift BOTH
    // the box and BG by the same amount to keep alignment.
    // Use a generous top margin so the image's top is visible above the box.
    const safeTop = height * 0.12
    if (boxY < safeTop) {
      bgOffsetY = safeTop - boxY
      boxY = safeTop
    }
    // Ensure box doesn't go below 55% of canvas
    if (boxY + boxH > height * 0.55) {
      const shift = (boxY + boxH) - height * 0.55
      bgOffsetY -= shift
      boxY -= shift
    }
    // Ensure box stays within horizontal bounds
    // Account for badge width (~5% of canvas) on the right side
    const badgeAllowance = width * 0.05
    if (boxX < margin) {
      bgOffsetX = margin - boxX
      boxX = margin
    }
    if (boxX + boxW + badgeAllowance > width - margin) {
      const shift = (boxX + boxW + badgeAllowance) - (width - margin)
      bgOffsetX -= shift
      boxX -= shift
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
  drawBackground(ctx, image, cover, width, height, filter, bgOffsetX, bgOffsetY)
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
