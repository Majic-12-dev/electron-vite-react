import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ensureDir } from '../utils/fs'

export type ConvertImagesPayload = {
  inputPaths: string[]
  outputDir: string
  format: 'jpg' | 'png' | 'webp'
  quality: number
  keepTimestamps: boolean
}

export type ResizeImagesPayload = {
  inputPaths: string[]
  outputDir: string
  mode: 'percent' | 'width' | 'height' | 'fit'
  percent: number
  width: number
  height: number
  sharpen: boolean
}

export type CompressImagesPayload = {
  inputPaths: string[]
  outputDir: string
  quality: number
  format: 'auto' | 'jpg' | 'png' | 'webp'
}

export type ImagesToPdfPayload = {
  inputPaths: string[]
  outputDir: string
  outputName: string
}

export type StripExifPayload = {
  inputPaths: string[]
  outputDir: string
}

export type FilterImagesPayload = {
  inputPaths: string[]
  outputDir: string
  filter: 'grayscale' | 'sepia' | 'invert'
}

export type RenameImagesPayload = {
  outputDir: string
  items: { sourcePath: string; targetName: string }[]
}

export type WatermarkImagesPayload = {
  inputPaths: string[]
  outputDir: string
  type: 'text' | 'image'
  text?: string
  imagePath?: string
  opacity: number
  rotation: number
  size: number
  position: string
  color?: string
}

export async function convertImages({
  inputPaths,
  outputDir,
  format,
  quality,
  keepTimestamps,
}: ConvertImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const baseName = path.parse(filePath).name
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(baseName)}.${format}`),
    )
    let pipeline = sharp(filePath)
    pipeline = applyFormat(pipeline, format, quality)
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
    if (keepTimestamps) {
      await copyTimestamps(filePath, outputPath)
    }
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function resizeImages({
  inputPaths,
  outputDir,
  mode,
  percent,
  width,
  height,
  sharpen,
}: ResizeImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    let pipeline = sharp(filePath)
    const metadata = await pipeline.metadata()

    if (mode === 'percent') {
      if (!metadata.width || !metadata.height) {
        throw new Error(`Unable to read dimensions for ${filePath}`)
      }
      const nextWidth = Math.max(1, Math.round(metadata.width * (percent / 100)))
      const nextHeight = Math.max(1, Math.round(metadata.height * (percent / 100)))
      pipeline = pipeline.resize(nextWidth, nextHeight)
    } else if (mode === 'width') {
      pipeline = pipeline.resize({ width: Math.max(1, Math.round(width)) })
    } else if (mode === 'height') {
      pipeline = pipeline.resize({ height: Math.max(1, Math.round(height)) })
    } else if (mode === 'fit') {
      pipeline = pipeline.resize({
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        fit: 'inside',
      })
    }

    if (sharpen) pipeline = pipeline.sharpen()

    const parsed = path.parse(filePath)
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_resized${parsed.ext}`),
    )
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function compressImages({
  inputPaths,
  outputDir,
  quality,
  format,
}: CompressImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const targetFormat = format === 'auto' ? normalizeFormat(parsed.ext) : format
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_compressed.${targetFormat}`),
    )

    let pipeline = sharp(filePath)
    pipeline = applyFormat(pipeline, targetFormat, quality)
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function stripExif({ inputPaths, outputDir }: StripExifPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_clean${parsed.ext}`),
    )
    await sharp(filePath).toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function filterImages({ inputPaths, outputDir, filter }: FilterImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const filterSuffix = filter === 'grayscale' ? '_grayscale' : filter === 'sepia' ? '_sepia' : '_inverted'
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}${filterSuffix}${parsed.ext}`),
    )

    let pipeline = sharp(filePath)
    switch (filter) {
      case 'grayscale':
        pipeline = pipeline.grayscale()
        break
      case 'sepia':
        pipeline = pipeline.modulate({ brightness: 1.1, saturation: 0.5 }).recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131],
        ])
        break
      case 'invert':
        pipeline = pipeline.negate()
        break
    }
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function renameImages({ outputDir, items }: RenameImagesPayload) {
  if (!items.length) throw new Error('No items provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const item of items) {
    if (!item.sourcePath) {
      throw new Error('Invalid source path')
    }

    const sourcePath = item.sourcePath
    const targetPath = path.join(outputDir, sanitizeFileName(item.targetName))

    await fs.copyFile(sourcePath, targetPath)
    outputs.push(targetPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function imagesToPdf({ inputPaths, outputDir, outputName }: ImagesToPdfPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  let pageCount = 0

  for (const filePath of inputPaths) {
    const ext = path.extname(filePath).toLowerCase()
    let imageBytes: Uint8Array = new Uint8Array(await fs.readFile(filePath))
    let embedType: 'png' | 'jpg' = ext === '.png' ? 'png' : 'jpg'

    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      imageBytes = new Uint8Array(await sharp(filePath).png().toBuffer())
      embedType = 'png'
    } else if (ext === '.png') {
      embedType = 'png'
    } else {
      embedType = 'jpg'
    }

    const image =
      embedType === 'png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes)

    const page = doc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    pageCount += 1
  }

  const safeName = sanitizeFileName(outputName || 'images.pdf')
  const outputPath = path.join(outputDir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  await fs.writeFile(outputPath, await doc.save())

  return { outputPath, pageCount }
}

export async function watermarkImages({
  inputPaths,
  outputDir,
  type,
  text,
  imagePath,
  opacity,
  rotation,
  size,
  position,
  color,
}: WatermarkImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  if (type === 'text' && !text) throw new Error('No watermark text provided.')
  if (type === 'image' && !imagePath) throw new Error('No watermark image selected.')
  await ensureDir(outputDir)

  const positionMap: Record<string, { left: 'left' | 'right' | 'center'; top: 'top' | 'bottom' | 'center' }> = {
    'top-left': { left: 'left', top: 'top' },
    'top-center': { left: 'center', top: 'top' },
    'top-right': { left: 'right', top: 'top' },
    'center-left': { left: 'left', top: 'center' },
    center: { left: 'center', top: 'center' },
    'center-right': { left: 'right', top: 'center' },
    'bottom-left': { left: 'left', top: 'bottom' },
    'bottom-center': { left: 'center', top: 'bottom' },
    'bottom-right': { left: 'right', top: 'bottom' },
  }

  const { left: hAlign, top: vAlign } = positionMap[position] ?? positionMap.center

  // Build watermark overlay buffer
  let overlay: Buffer
  if (type === 'text') {
    const escapedText = (text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
    const safeText = text ?? ''
    const svgWidth = size * (safeText.length * 0.6 + 2)
    const svgHeight = size + 20
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">\n` +
      `  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"\n` +
      `        font-family="Arial, sans-serif" font-size="${size}" fill="${color ?? '#ffffff'}"\n` +
      `        font-weight="bold">${escapedText}</text>\n</svg>`
    overlay = await sharp(Buffer.from(svg))
      .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: undefined, height: undefined }) // keep original
      .png()
      .toBuffer()
  } else {
    const stats = await fs.stat(imagePath!)
    if (stats.size > 50 * 1024 * 1024) throw new Error('Watermark image must be under 50MB.')
    overlay = await sharp(imagePath!)
      .resize({ width: size, fit: 'inside', withoutEnlargement: true })
      .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_watermarked.${parsed.ext}`),
    )

    const img = sharp(filePath)
    const metadata = await img.metadata()
    if (!metadata.width || !metadata.height) continue

    const wmMeta = await sharp(overlay).metadata()
    if (!wmMeta.width || !wmMeta.height) continue

    const targetSize = Math.min(size, Math.max(metadata.width, metadata.height) * 0.25)
    const resizedOverlay = await sharp(overlay)
      .resize({ width: targetSize, height: targetSize, fit: 'inside' })
      .png()
      .ensureAlpha()
      .toBuffer()

    const resizedMeta = await sharp(resizedOverlay).metadata()
    if (!resizedMeta.width || !resizedMeta.height) continue

    // Calculate exact pixel position
    let left = 0, top = 0
    if (hAlign === 'left') left = 10
    else if (hAlign === 'center') left = Math.round((metadata.width - resizedMeta.width) / 2)
    else left = metadata.width - resizedMeta.width - 10

    if (vAlign === 'top') top = 10
    else if (vAlign === 'center') top = Math.round((metadata.height - resizedMeta.height) / 2)
    else top = metadata.height - resizedMeta.height - 10

    left = Math.max(0, left)
    top = Math.max(0, top)

    // Apply opacity: if opacity < 1, composite resized overlay onto transparent canvas
    let finalOverlay = resizedOverlay
    if (opacity < 1) {
      const canvasSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${resizedMeta.width}" height="${resizedMeta.height}"/>`
      finalOverlay = await sharp(Buffer.from(canvasSvg))
        .composite([{ input: resizedOverlay, blend: 'atop' }])
        .png()
        .toBuffer()
    }

    const result = await img
      .composite([{ input: finalOverlay, left, top, blend: 'over' }])
      .toBuffer()

    await fs.writeFile(outputPath, result)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

function applyFormat(
  pipeline: sharp.Sharp,
  format: 'jpg' | 'png' | 'webp',
  quality: number,
) {
  if (format === 'png') {
    const compressionLevel = Math.min(9, Math.max(0, Math.round((100 - quality) / 10)))
    return pipeline.png({ compressionLevel })
  }
  if (format === 'webp') {
    return pipeline.webp({ quality })
  }
  return pipeline.jpeg({ quality, mozjpeg: true })
}

function normalizeFormat(ext: string) {
  const cleaned = ext.replace('.', '').toLowerCase()
  if (cleaned === 'jpeg') return 'jpg'
  if (cleaned === 'jpg' || cleaned === 'png' || cleaned === 'webp') return cleaned
  return 'jpg'
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim()
}

async function uniquePath(targetPath: string) {
  const parsed = path.parse(targetPath)
  let attempt = 0
  let candidate = targetPath
  while (true) {
    try {
      await fs.access(candidate)
      attempt += 1
      candidate = path.join(parsed.dir, `${parsed.name}(${attempt})${parsed.ext}`)
    } catch {
      return candidate
    }
  }
}

async function copyTimestamps(source: string, target: string) {
  try {
    const stats = await fs.stat(source)
    await fs.utimes(target, stats.atime, stats.mtime)
  } catch {
    // ignore timestamp errors
  }
}
