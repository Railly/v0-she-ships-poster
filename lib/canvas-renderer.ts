import type { PosterOptions, FaceBox } from "./types"

// ── Grain texture (procedurally generated) ──────────────────────────
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

// ── Main render function ────────────────────────────────────────────
export function renderPoster(
  canvas: HTMLCanvasElement,
  options: PosterOptions
): void {
  const { speaker, image, detection, template, width, height } = options
  const ctx = canvas.getContext("2d")!
  canvas.width = width
  canvas.height = height

  const grain = getGrainTexture()

  // ── 1) Dark background fill ─────────────────────────────────────
  ctx.fillStyle = "#141414"
  ctx.fillRect(0, 0, width, height)

  // ── 2) Background: B&W + blur + darkened full face ──────────────
  // We use an offscreen canvas for the blur since ctx.filter is
  // limited in some browsers. OffscreenCanvas gives us reliable blur.
  const bgOff = document.createElement("canvas")
  bgOff.width = width
  bgOff.height = height
  const bgCtx = bgOff.getContext("2d")!

  const cover = getCoverCoords(image.width, image.height, width, height)
  bgCtx.filter = "grayscale(100%) blur(14px) brightness(0.35)"
  bgCtx.drawImage(
    image,
    cover.sx,
    cover.sy,
    cover.sw,
    cover.sh,
    0,
    0,
    width,
    height
  )
  bgCtx.filter = "none"

  // draw blurred bg to main canvas
  ctx.drawImage(bgOff, 0, 0)

  // grain overlay on background
  ctx.globalAlpha = 0.12
  ctx.globalCompositeOperation = "overlay"
  for (let gx = 0; gx < width; gx += 512) {
    for (let gy = 0; gy < height; gy += 512) {
      ctx.drawImage(grain, gx, gy)
    }
  }
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1

  // ── 3) Face crop box (right side) ──────────────────────────────
  const boxMarginRight = width * 0.04
  const boxTop = height * 0.06
  const boxWidth = width * 0.48
  const boxHeight = height * 0.52
  const boxX = width - boxWidth - boxMarginRight
  const boxY = boxTop

  // Determine which region to crop
  const cropRegion =
    template === "half-face" ? detection.rightHalfBox : detection.eyesRegion
  const clamped = clampBox(cropRegion, image.width, image.height)

  // Draw the cropped face into the box
  ctx.save()
  ctx.beginPath()
  ctx.rect(boxX, boxY, boxWidth, boxHeight)
  ctx.clip()
  ctx.drawImage(
    image,
    clamped.x,
    clamped.y,
    clamped.width,
    clamped.height,
    boxX,
    boxY,
    boxWidth,
    boxHeight
  )

  // Pink/magenta tint
  ctx.globalCompositeOperation = "multiply"
  ctx.fillStyle = "rgba(160, 50, 110, 0.65)"
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
  ctx.globalCompositeOperation = "source-over"

  // Additional color layer for richer tint
  ctx.globalCompositeOperation = "screen"
  ctx.fillStyle = "rgba(80, 10, 50, 0.25)"
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
  ctx.globalCompositeOperation = "source-over"

  // Grain on the face crop
  ctx.globalAlpha = 0.15
  ctx.globalCompositeOperation = "overlay"
  for (let gx = boxX; gx < boxX + boxWidth; gx += 512) {
    for (let gy = boxY; gy < boxY + boxHeight; gy += 512) {
      ctx.drawImage(grain, gx, gy)
    }
  }
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1
  ctx.restore()

  // Pink border around box
  ctx.strokeStyle = "#e891b9"
  ctx.lineWidth = 2
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

  // ── 4) "SPEAKER" badge ─────────────────────────────────────────
  const badgeW = width * 0.045
  const badgeH = height * 0.1
  const badgeX = boxX + boxWidth - badgeW / 2
  const badgeY = boxY + 10

  ctx.save()
  ctx.translate(badgeX + badgeW / 2, badgeY + badgeH / 2)
  ctx.fillStyle = "#e891b9"
  ctx.fillRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH)

  // Text inside badge (rotated)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = "#1a1a1a"
  ctx.font = `bold ${Math.round(width * 0.018)}px "Geist", sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("SPEAKER", 0, 0)
  ctx.restore()

  // ── 5) Small portrait with green brackets ──────────────────────
  const portraitSize = width * 0.2
  const portraitX = width * 0.1
  const portraitY = height * 0.55
  const bracketPad = 8
  const bracketLen = 14

  // Draw original photo (small)
  ctx.drawImage(image, portraitX, portraitY, portraitSize, portraitSize)

  // Green corner brackets
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

  // ── 6) Logo area ("SS" + sheep-like icon) ──────────────────────
  const logoY = height * 0.035
  ctx.textAlign = "center"

  // "SS" text
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${Math.round(width * 0.04)}px "Geist Mono", monospace`
  ctx.fillText("SS", width * 0.42, logoY + width * 0.04)

  // Simple sheep icon (drawn as a small shape)
  const sheepX = width * 0.48
  const sheepY = logoY + width * 0.015
  const sheepSize = width * 0.03
  ctx.fillStyle = "#4ade80"
  // body (rounded rect approximation)
  ctx.beginPath()
  ctx.arc(sheepX, sheepY + sheepSize * 0.4, sheepSize * 0.45, 0, Math.PI * 2)
  ctx.fill()
  // head
  ctx.beginPath()
  ctx.arc(
    sheepX + sheepSize * 0.35,
    sheepY + sheepSize * 0.15,
    sheepSize * 0.22,
    0,
    Math.PI * 2
  )
  ctx.fill()
  // legs
  ctx.fillRect(
    sheepX - sheepSize * 0.25,
    sheepY + sheepSize * 0.7,
    sheepSize * 0.08,
    sheepSize * 0.3
  )
  ctx.fillRect(
    sheepX + sheepSize * 0.15,
    sheepY + sheepSize * 0.7,
    sheepSize * 0.08,
    sheepSize * 0.3
  )

  // ── 7) Event title text ────────────────────────────────────────
  const titleX = width * 0.1
  let titleY = height * 0.15
  const titleFontSize = Math.round(width * 0.042)
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${titleFontSize}px "Geist Mono", monospace`
  ctx.textAlign = "left"

  const titleLines = wrapText(
    ctx,
    speaker.eventTitle.toUpperCase(),
    boxX - titleX - width * 0.05,
    titleFontSize
  )
  for (const line of titleLines) {
    ctx.fillText(line, titleX, titleY)
    titleY += titleFontSize * 1.25
  }

  // ── 8) Date text ───────────────────────────────────────────────
  const dateY = titleY + height * 0.02
  const dateFontSize = Math.round(width * 0.02)
  ctx.fillStyle = "#4ade80"
  ctx.font = `${dateFontSize}px "Geist Mono", monospace`
  const dateLines = speaker.eventDate.split("\n")
  let currentDateY = dateY
  for (const line of dateLines) {
    ctx.fillText(line.toUpperCase(), titleX, currentDateY)
    currentDateY += dateFontSize * 1.5
  }

  // ── 9) Speaker name (large, green) ─────────────────────────────
  const nameY = portraitY + portraitSize + height * 0.07
  const nameFontSize = Math.round(width * 0.065)
  ctx.fillStyle = "#4ade80"
  ctx.font = `900 ${nameFontSize}px "Geist", sans-serif`
  ctx.textAlign = "left"

  const nameWords = speaker.name.toUpperCase().split(" ")
  let currentNameY = nameY
  for (const word of nameWords) {
    ctx.fillText(word, titleX, currentNameY)
    currentNameY += nameFontSize * 1.1
  }

  // ── 10) Speaker role ───────────────────────────────────────────
  const roleY = currentNameY + height * 0.015
  const roleFontSize = Math.round(width * 0.018)
  ctx.fillStyle = "#ffffff"
  ctx.font = `${roleFontSize}px "Geist", sans-serif`
  ctx.letterSpacing = "2px"
  const roleLines = wrapText(
    ctx,
    speaker.role.toUpperCase(),
    width * 0.4,
    roleFontSize
  )
  for (const line of roleLines) {
    ctx.fillText(line, titleX, roleY + roleLines.indexOf(line) * roleFontSize * 1.5)
  }
  ctx.letterSpacing = "0px"

  // ── 11) Side text (rotated) ────────────────────────────────────
  const sideTextFont = `${Math.round(width * 0.013)}px "Geist Mono", monospace`

  // Left side
  ctx.save()
  ctx.translate(width * 0.025, height * 0.5)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.font = sideTextFont
  ctx.textAlign = "center"
  ctx.letterSpacing = "3px"
  ctx.fillText(speaker.sideTextLeft.toUpperCase(), 0, 0)
  ctx.letterSpacing = "0px"
  ctx.restore()

  // Right side
  ctx.save()
  ctx.translate(width * 0.975, height * 0.5)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.font = sideTextFont
  ctx.textAlign = "center"
  ctx.letterSpacing = "3px"
  ctx.fillText(speaker.sideTextRight.toUpperCase(), 0, 0)
  ctx.letterSpacing = "0px"
  ctx.restore()

  // ── 12) Crosshair decorations ──────────────────────────────────
  drawCrosshair(ctx, width * 0.04, height * 0.04, width * 0.02)
  drawCrosshair(ctx, width * 0.96, height * 0.04, width * 0.02)
  drawCrosshair(ctx, width * 0.04, height * 0.96, width * 0.02)
  drawCrosshair(ctx, width * 0.96, height * 0.96, width * 0.02)
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
  maxWidth: number,
  _fontSize: number
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

// ── Utility: draw crosshair ─────────────────────────────────────────
function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.strokeStyle = "rgba(255,255,255,0.2)"
  ctx.lineWidth = 1

  // cross lines
  ctx.beginPath()
  ctx.moveTo(x - size, y)
  ctx.lineTo(x + size, y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x, y + size)
  ctx.stroke()

  // circle
  ctx.beginPath()
  ctx.arc(x, y, size * 0.6, 0, Math.PI * 2)
  ctx.stroke()
}
