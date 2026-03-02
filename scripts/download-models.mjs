import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const modelsDir = path.join(__dirname, "..", "public", "models")

const BASE_URL =
  "https://unpkg.com/@vladmandic/face-api@1.7.14/model/"

const files = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
]

async function download() {
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true })
  }

  for (const file of files) {
    const url = BASE_URL + file
    const dest = path.join(modelsDir, file)

    if (fs.existsSync(dest)) {
      console.log(`Skipping ${file} (already exists)`)
      continue
    }

    console.log(`Downloading ${file}...`)
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${file}`)
      const buffer = Buffer.from(await resp.arrayBuffer())
      fs.writeFileSync(dest, buffer)
      console.log(`  Saved ${file} (${buffer.length} bytes)`)
    } catch (err) {
      console.error(`  Failed to download ${file}: ${err.message}`)
    }
  }
  console.log("Done!")
}

download()
