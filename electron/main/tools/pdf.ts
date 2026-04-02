import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument, degrees, rgb, StandardFonts, PDFDict, PDFName, PDFRawStream, PDFArray, PDFNumber } from 'pdf-lib'
import { ensureDir } from '../utils/fs'
import { validatePaths } from '../utils/pathValidation'

interface EncryptOptions {
  userPassword?: string
  ownerPassword?: string
  permissions: {
    printing: 'printAllowed' | 'notAllowed'
    modifying: 'modifyingAllowed' | 'notAllowed'
    copying: 'copyingAllowed' | 'notAllowed'
    annotating: 'annotatingAllowed' | 'notAllowed'
    form: 'formAllowed' | 'notAllowed'
  }
}

const PERMISSION_MAP = {
  print: { allowed: 'print_allowed' as const, denied: 'not_allowed' as const },
  modify: { allowed: 'modify_allowed' as const, denied: 'not_allowed' as const },
  copy: { allowed: 'copy_allowed' as const, denied: 'not_allowed' as const },
  annotate: { allowed: 'annotate_allowed' as const, denied: 'not_allowed' as const },
  form: { allowed: 'form_allowed' as const, denied: 'not_allowed' as const },
} as const;

export type MergePdfPayload = {
  inputPaths: string[]
  outputDir: string
  outputName: string
}

export type SplitPdfPayload = {
  inputPaths: string[]
  outputDir: string
  mode: 'ranges' | 'extract' | 'remove'
  ranges?: string
}

export type RotatePdfPayload = {
  inputPaths: string[]
  outputDir: string
  rotation: number
  ranges?: string | null
}

export type WatermarkPdfPayload = {
  inputPaths: string[]
  outputDir: string
  type: 'text' | 'image'
  text?: string
  imagePath?: string
  opacity: number
  rotation: number
  size: number
  position: string
}

export type MetadataPdfPayload = {
  inputPaths: string[]
  outputDir: string
  metadata: {
    title?: string | null
    author?: string | null
    subject?: string | null
    keywords?: string | null
    creator?: string | null
  }
}

export type UnlockPdfPayload = {
  inputPaths: string[]
  outputDir: string
  password: string
}

export type CompressPdfPayload = {
  inputPaths: string[]
  outputDir: string
  level: 'low' | 'medium' | 'high'
}

export async function mergePdf({ inputPaths, outputDir, outputName }: MergePdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const safeName = sanitizeFileName(outputName || 'merged.pdf')
  const outputPath = path.join(outputDir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)

  validatePaths(inputPaths, outputPath)
  await ensureDir(outputDir)

  const merged = await PDFDocument.create()
  let totalPages = 0

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
    totalPages += pages.length
  }

  const mergedBytes = await merged.save()
  await fs.writeFile(outputPath, mergedBytes)

  return { outputPath, pageCount: totalPages }
}

export async function splitPdf({ inputPaths, outputDir, mode, ranges }: SplitPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const pageCount = doc.getPageCount()
    const baseName = path.parse(filePath).name
    const splitDir = path.join(outputDir, `${sanitizeFileName(baseName)}_split`)
    await ensureDir(splitDir)

    if (mode === 'extract') {
      for (let index = 0; index < pageCount; index += 1) {
        const outDoc = await PDFDocument.create()
        const [page] = await outDoc.copyPages(doc, [index])
        outDoc.addPage(page)
        const outputPath = path.join(
          splitDir,
          `${sanitizeFileName(baseName)}_page_${index + 1}.pdf`,
        )
        await fs.writeFile(outputPath, await outDoc.save())
        outputs.push(outputPath)
      }
      continue
    }

    const parsedRanges = parsePageRanges(ranges || '', pageCount)
    if (!parsedRanges.length) {
      throw new Error('No valid page ranges were provided.')
    }

    if (mode === 'remove') {
      const removeSet = new Set<number>()
      parsedRanges.forEach(({ start, end }) => {
        for (let idx = start; idx <= end; idx += 1) removeSet.add(idx)
      })
      const keepIndices = doc
        .getPageIndices()
        .filter((index) => !removeSet.has(index))
      const outDoc = await PDFDocument.create()
      const pages = await outDoc.copyPages(doc, keepIndices)
      pages.forEach((page) => outDoc.addPage(page))
      const outputPath = path.join(splitDir, `${sanitizeFileName(baseName)}_removed.pdf`)
      await fs.writeFile(outputPath, await outDoc.save())
      outputs.push(outputPath)
      continue
    }

    for (const range of parsedRanges) {
      const outDoc = await PDFDocument.create()
      const indices = []
      for (let idx = range.start; idx <= range.end; idx += 1) indices.push(idx)
      const pages = await outDoc.copyPages(doc, indices)
      pages.forEach((page) => outDoc.addPage(page))
      const outputPath = path.join(
        splitDir,
        `${sanitizeFileName(baseName)}_${range.start + 1}-${range.end + 1}.pdf`,
      )
      await fs.writeFile(outputPath, await outDoc.save())
      outputs.push(outputPath)
    }
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function rotatePdf({ inputPaths, outputDir, rotation, ranges }: RotatePdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const indices = doc.getPageIndices()
    const pageCount = indices.length
    const allowedRanges = ranges ? parsePageRanges(ranges || '', pageCount) : null
    const target = allowedRanges
      ? new Set(allowedRanges.flatMap((range) => expandRange(range)))
      : new Set(indices)

    indices.forEach((index) => {
      if (!target.has(index)) return
      const page = doc.getPage(index)
      page.setRotation(degrees(rotation))
    })

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_rotated.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save())
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function watermarkPdf({
  inputPaths,
  outputDir,
  type,
  text,
  imagePath,
  opacity,
  rotation,
  size,
  position,
}: WatermarkPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []
  let imageBytes: Uint8Array | null = null
  let imageType: 'png' | 'jpg' | null = null

  if (type === 'image') {
    if (!imagePath) throw new Error('No watermark image selected.')
    imageBytes = await fs.readFile(imagePath)
    imageType = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
  }

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    let embeddedImage: any = null
    if (type === 'image' && imageBytes && imageType) {
      embeddedImage =
        imageType === 'png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes)
    }

    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize()
      if (type === 'text') {
        const { x, y } = getPosition(position, width, height, size, size)
        page.drawText(text || 'WATERMARK', {
          x,
          y,
          size,
          rotate: degrees(rotation),
          opacity: clamp(opacity, 0.05, 1),
          color: rgb(0.35, 0.35, 0.35),
        })
        return
      }

      if (embeddedImage) {
        const scale = clamp(size, 5, 100) / 100
        const imgWidth = embeddedImage.width * scale
        const imgHeight = embeddedImage.height * scale
        const { x, y } = getPosition(position, width, height, imgWidth, imgHeight)
        page.drawImage(embeddedImage, {
          x,
          y,
          width: imgWidth,
          height: imgHeight,
          rotate: degrees(rotation),
          opacity: clamp(opacity, 0.05, 1),
        })
      }
    })

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_watermarked.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save())
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function updateMetadata({ inputPaths, outputDir, metadata }: MetadataPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    if (metadata.title) doc.setTitle(metadata.title)
    if (metadata.author) doc.setAuthor(metadata.author)
    if (metadata.subject) doc.setSubject(metadata.subject)
    if (metadata.keywords) doc.setKeywords(metadata.keywords.split(',').map((item) => item.trim()))
    if (metadata.creator) doc.setCreator(metadata.creator)

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_metadata.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save())
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export type EncryptPdfPayload = {
  inputPaths: string[]
  outputDir: string
  userPassword?: string
  ownerPassword?: string
  permissions: {
    print: boolean
    modify: boolean
    copy: boolean
    annotate: boolean
    form: boolean
  }
}

export async function encryptPdf({
  inputPaths,
  outputDir,
  userPassword,
  ownerPassword,
  permissions,
}: EncryptPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    const encryptOptions = {
      userPassword: userPassword || undefined,
      ownerPassword: ownerPassword || undefined,
      permissions: {
        printing: permissions.print ? 'printAllowed' : 'notAllowed',
        modifying: permissions.modify ? 'modifyingAllowed' : 'notAllowed',
        copying: permissions.copy ? 'copyingAllowed' : 'notAllowed',
        annotating: permissions.annotate ? 'annotatingAllowed' : 'notAllowed',
        form: permissions.form ? 'formAllowed' : 'notAllowed',
      },
    }

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_encrypted.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save({ encrypt: encryptOptions } as any))
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function compressPdf({ inputPaths, outputDir, level }: CompressPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []
  let totalInputSize = 0
  let totalOutputSize = 0

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    totalInputSize += bytes.length

    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    const optimizedBytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    })

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_compressed.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, optimizedBytes)

    const stats = await fs.stat(outputPath)
    totalOutputSize += stats.size
    outputs.push(outputPath)
  }

  const averageReduction = totalInputSize > 0 ? ((totalInputSize - totalOutputSize) / totalInputSize) * 100 : 0

  return {
    outputDir,
    inputCount: inputPaths.length,
    averageReduction,
    outputs,
  }
}

export type RepairPdfPayload = {
  inputPaths: string[]
  outputDir: string
}

export async function unlockPdf({ inputPaths, outputDir, password }: UnlockPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
    })

    const unlockedBytes = await doc.save()

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_unlocked.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, unlockedBytes)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export type PdfToImagesPayload = {
  inputPaths: string[]
  outputDir: string
  format: 'png' | 'jpg'
  quality: number
  dpi: number
  pageRange?: string
}

export async function repairPdf({ inputPaths, outputDir }: RepairPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    let doc: any = null
    try {
      // Try to load the PDF, ignoring some errors
      const bytes = await fs.readFile(filePath)
      doc = await PDFDocument.load(bytes, { ignoreEncryption: true }).catch(async (err: Error) => {
        // If loading fails, try again with more lenient options or throw
        throw new Error(`Failed to load PDF: ${err.message}`)
      })

      // Re-save creates a fresh, structurally sound PDF
      const repairedBytes = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      })

      const baseName = path.parse(filePath).name
      const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_repaired.pdf`)
      await ensureDir(outputDir)
      await fs.writeFile(outputPath, repairedBytes)
      outputs.push(outputPath)
    } catch (error) {
      console.error(`Repair failed for ${filePath}:`, error)
      throw error
    } finally {
      // PDFDocument doesn't have a close method, but we can null the reference
      doc = null
    }
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export type TextToPdfPayload = {
  inputPaths: string[]
  outputDir: string
  outputName?: string
  title?: string
  fontSize?: number
  lineHeight?: number
  margin?: number
  maxLineWidth?: number
}

export type ExtractPdfText = {
  inputPath: string
  pages?: string
}

export async function extractPdfText({ inputPath, pages }: ExtractPdfText) {
  const bytes = await fs.readFile(inputPath)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pageCount = doc.getPageCount()

  const pageNumbers = pages && pages.trim()
    ? parsePdfPageRange(pages.trim(), pageCount)
    : Array.from({ length: pageCount }, (_, i) => i + 1)

  const results: { page: number; text: string }[] = []

  for (const pageNum of pageNumbers) {
    // pdf-lib does not currently support extracting text from content streams.
    // It stores text in encoded streams that need a PDF parser/renderer to decode.
    // This function returns a placeholder structure. Use pdfjs-dist for full extraction.
    results.push({
      page: pageNum,
      text: '[Text extraction not supported by pdf-lib. Use pdfjs-dist or pdf-parse.]',
    })
  }

  return { inputPath, totalCount: pageCount, results }
}

export async function textToPdf({
  inputPaths,
  outputDir,
  outputName,
  title,
  fontSize,
  lineHeight,
  margin,
  maxLineWidth,
}: TextToPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No input files provided.')
  }

  await ensureDir(outputDir)

  const doc = await PDFDocument.create()
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)

  const fontSizeFinal = fontSize ?? 11
  const lineHeightFinal = lineHeight ?? 14
  const marginFinal = margin ?? 48
  const maxLineWidthFinal = maxLineWidth ?? 480

  let totalPages = 0

  for (const filePath of inputPaths) {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split(/\r?\n/)
    const fileName = path.parse(filePath).name

    const pageWidth = 595.28 // A4 width approx
    const pageHeight = 841.89 // A4 height approx
    let page = doc.addPage([pageWidth, pageHeight])
    totalPages++

    let x = marginFinal
    let y = pageHeight - marginFinal

    // Title
    if (title || fileName) {
      const displayTitle = title || fileName
      if (y - fontSizeFinal - 10 < marginFinal) {
        page = doc.addPage([pageWidth, pageHeight])
        totalPages++
        y = pageHeight - marginFinal
      }
      page.drawText(displayTitle, {
        x,
        y: y - fontSizeFinal,
        size: fontSizeFinal + 4,
        font: helvetica,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= fontSizeFinal * 2 + 10
    }

    // Content
    for (const line of lines) {
      if (y - fontSizeFinal < marginFinal) {
        page = doc.addPage([pageWidth, pageHeight])
        totalPages++
        y = pageHeight - marginFinal
      }

      let textToDraw = line
      if (maxLineWidthFinal > 0 && line.length > maxLineWidthFinal) {
        textToDraw = line.substring(0, maxLineWidthFinal) + '...'
      }

      page.drawText(textToDraw, {
        x,
        y: y - fontSizeFinal,
        size: fontSizeFinal,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      })
      y -= lineHeightFinal
    }
  }

  const safeName = sanitizeFileName(outputName || 'converted.pdf')
  const outputPath = path.join(outputDir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  validatePaths(inputPaths, outputPath)

  const pdfBytes = await doc.save()
  await fs.writeFile(outputPath, pdfBytes)

  return { outputPath, totalPages }
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\\\|?*]+/g, '_').trim()
}

function parsePageRanges(input: string, pageCount: number) {
  if (!input) return []
  const ranges: { start: number; end: number }[] = []
  const parts = input.split(',')
  parts.forEach((part) => {
    const trimmed = part.trim()
    if (!trimmed) return
    if (trimmed.includes('-')) {
      const [startRaw, endRaw] = trimmed.split('-')
      const start = clampIndex(Number(startRaw), pageCount)
      const end = clampIndex(Number(endRaw), pageCount)
      if (Number.isNaN(start) || Number.isNaN(end)) return
      ranges.push({ start: Math.min(start, end), end: Math.max(start, end) })
      return
    }
    const single = clampIndex(Number(trimmed), pageCount)
    if (!Number.isNaN(single)) {
      ranges.push({ start: single, end: single })
    }
  })
  return ranges
}

function clampIndex(value: number, pageCount: number) {
  if (!Number.isFinite(value)) return Number.NaN
  const normalized = Math.min(Math.max(Math.floor(value), 1), pageCount)
  return normalized - 1
}

function expandRange(range: { start: number; end: number }) {
  const result: number[] = []
  for (let idx = range.start; idx <= range.end; idx += 1) {
    result.push(idx)
  }
  return result
}

function getPosition(
  position: string,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  contentHeight: number,
) {
  const margin = 32
  const map: Record<string, { x: number; y: number }> = {
    'top-left': { x: margin, y: pageHeight - contentHeight - margin },
    top: { x: (pageWidth - contentWidth) / 2, y: pageHeight - contentHeight - margin },
    'top-right': { x: pageWidth - contentWidth - margin, y: pageHeight - contentHeight - margin },
    left: { x: margin, y: (pageHeight - contentHeight) / 2 },
    center: { x: (pageWidth - contentWidth) / 2, y: (pageHeight - contentHeight) / 2 },
    right: { x: pageWidth - contentWidth - margin, y: (pageHeight - contentHeight) / 2 },
    'bottom-left': { x: margin, y: margin },
    bottom: { x: (pageWidth - contentWidth) / 2, y: margin },
    'bottom-right': { x: pageWidth - contentWidth - margin, y: margin },
  }
  return map[position] || map.center
}

function parsePdfPageRange(input: string, pageCount: number): number[] {
  if (!input) return []
  const pages = new Set<number>()
  const parts = input.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.includes('-')) {
      const [s, e] = trimmed.split('-').map(Number)
      const start = Math.max(1, Math.min(s || 1, pageCount))
      const end = Math.max(1, Math.min(e || pageCount, pageCount))
      for (let i = start; i <= end; i++) pages.add(i)
    } else {
      const n = Number(trimmed)
      if (n >= 1 && n <= pageCount) pages.add(n)
    }
  }
  return Array.from(pages).sort((a, b) => a - b)
}

export async function pdfToImages({
  inputPaths,
  outputDir,
  format,
  quality,
  dpi,
  pageRange,
}: PdfToImagesPayload) {
  if (!inputPaths.length) throw new Error('No PDF files provided.')
  await ensureDir(outputDir)

  const { getDocument } = await import('pdfjs-dist')
  const { createCanvas } = await import('@napi-rs/canvas')

  const outputs: string[] = []
  let totalPages = 0

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise
    const pageCount = pdf.numPages
    if (pageCount === 0) continue

    const pagesToRender = pageRange && pageRange.trim()
      ? parsePdfPageRange(pageRange.trim(), pageCount)
      : Array.from({ length: pageCount }, (_, i) => i + 1)

    if (!pagesToRender.length) continue

    const baseName = path.parse(filePath).name
    const ext = format === 'jpg' ? 'jpg' : 'png'
    const outDir = pageCount > 1 ? path.join(outputDir, `${sanitizeFileName(baseName)}_images`) : outputDir
    if (pageCount > 1) await ensureDir(outDir)

    for (const pageNum of pagesToRender) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: dpi / 72 })

      const canvas = createCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d') as any
      await page.render({ canvasContext: ctx, viewport }).promise

      const imageBuffer = format === 'jpg'
        ? canvas.toBuffer('image/jpeg', quality / 100)
        : canvas.toBuffer('image/png')

      const pageLabel = `${pageNum}`.padStart(String(pageCount).length, '0')
      const outName = pageCount > 1
        ? `${sanitizeFileName(baseName)}_page_${pageLabel}.${ext}`
        : `${sanitizeFileName(baseName)}.${ext}`

      const outputPath = await uniqueOutPath(path.join(outDir, outName))
      await fs.writeFile(outputPath, imageBuffer)
      outputs.push(outputPath)
      totalPages++
    }
    pdf.destroy()
  }

  return {
    outputDir: outputs.length > 0 ? path.dirname(outputs[0]) : outputDir,
    totalOutputs: outputs.length,
    totalPages,
  }
}

async function uniqueOutPath(targetPath: string) {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// ─── PDF Image Extraction ──────────────────────────────────────────────────────────────────
export type ExtractPdfImagesPayload = {
  filePath: string
}

export type ExtractPdfImageResult = {
  data: string
  page: number
  format: 'jpeg' | 'png'
}

export async function extractPdfImages({
  filePath,
}: ExtractPdfImagesPayload): Promise<{ images: ExtractPdfImageResult[] }> {
  const rawBytes = await fs.readFile(filePath)
  const doc = await PDFDocument.load(rawBytes, { ignoreEncryption: true })
  const pageCount = doc.getPageCount()

  const images: ExtractPdfImageResult[] = []

  // Scan raw PDF bytes for image XObjects.
  // This works by finding stream objects marked with /Subtype /Image and extracting them.
  // Handles DCTDecode (JPEG) streams directly and FlateDecode streams after decompression.
  for (let pageIdx = 0; pageIdx < pageCount; pageIdx += 1) {
    const page = doc.getPage(pageIdx)

    try {
      const resources = page.node.Resources()
      if (!resources) continue

      const xObjectDict = resources.lookup(PDFName.of('XObject'))
      if (!xObjectDict || !(xObjectDict instanceof PDFDict)) continue

      const keys = xObjectDict.keys()
      for (const key of keys) {
        try {
          const xobjRaw = xObjectDict.lookup(key, PDFDict)
          if (!xobjRaw) continue

          const subtype = xobjRaw.lookup(PDFName.of('Subtype'))
          if (!(subtype instanceof PDFName) || subtype.toString() !== '/Image') continue

          // This is an image XObject
          const width = xobjRaw.lookup(PDFName.of('Width'))
          const height = xobjRaw.lookup(PDFName.of('Height'))
          if (!width || !height) continue

          // Get the stream data — xobjRaw is a PDFRawStream but TS narrows it
          // to `never` for PDFDict & PDFRawStream when looking up with PDFDict type.
          // Use `any` cast since pdf-lib's lookup returns PDFDict but image XObjects are PDFRawStream.
          const xobjStream = xobjRaw as unknown as { contents: () => Uint8Array }
          const streamBytes = typeof xobjStream.contents === 'function' ? xobjStream.contents() : await extractDecodedStream(xobjStream as any)
          if (!streamBytes || streamBytes.length === 0) continue

          // Determine the image format
          const filterVal = xobjRaw.lookup(PDFName.of('Filter'))
          const colorSpace = xobjRaw.lookup(PDFName.of('ColorSpace'))

          let format: 'jpeg' | 'png' = 'jpeg'
          let imageData: Uint8Array | null = null

          if (isJpegEncoded(filterVal)) {
            // DCTDecode - try to wrap in valid JPEG or use raw
            imageData = tryWrapAsJpeg(streamBytes)
            if (imageData) format = 'jpeg'
          }

          // Fallback: try PNG
          if (!imageData) {
            imageData = tryConvertToPng(streamBytes, xobjRaw)
            if (imageData) format = 'png'
          }

          // Last resort: try raw bytes as JPEG
          if (!imageData) {
            imageData = tryExtractJpegFromRaw(streamBytes)
            if (imageData) format = 'jpeg'
          }

          if (imageData && imageData.length > 200) {
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
            const base64 = `data:${mimeType};base64,${Buffer.from(imageData).toString('base64')}`
            images.push({ data: base64, page: pageIdx + 1, format })
          }
        } catch (e) {
          console.warn(`Failed to extract XObject image from page ${pageIdx + 1}:`, e)
          continue
        }
      }
    } catch (e) {
      console.warn(`Failed to scan page ${pageIdx + 1} for images:`, e)
      continue
    }
  }

  return { images }
}

// ─── PDF Page Reorder ──────────────────────────────────────────────────────────────────
export type ReorderPdfPagesPayload = {
  filePath: string
  pageOrder: number[]
  outputDir: string
  outputName?: string
}

export type GetPdfPageCountPayload = {
  filePath: string
}

export async function getPdfPageCount({
  filePath,
}: GetPdfPageCountPayload): Promise<{ pageCount: number }> {
  const bytes = await fs.readFile(filePath)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return { pageCount: doc.getPageCount() }
}

export async function reorderPdfPages({
  filePath,
  pageOrder,
  outputDir,
  outputName,
}: ReorderPdfPagesPayload): Promise<{ outputPath: string; pageCount: number }> {
  if (!pageOrder.length) {
    throw new Error('No pages specified for the new order.')
  }

  const bytes = await fs.readFile(filePath)
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const srcPageCount = srcDoc.getPageCount()

  for (const idx of pageOrder) {
    if (idx < 0 || idx >= srcPageCount) {
      throw new Error(`Invalid page index: ${idx}. PDF has ${srcPageCount} pages (0-indexed).`)
    }
  }

  const newDoc = await PDFDocument.create()
  const pages = await newDoc.copyPages(srcDoc, pageOrder)
  pages.forEach((page) => newDoc.addPage(page))

  const baseName = path.parse(filePath).name
  const safeName = sanitizeFileName(outputName || `${baseName}_reordered.pdf`)
  const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`
  const outputPath = path.join(outputDir, finalName)
  await ensureDir(outputDir)
  await fs.writeFile(outputPath, await newDoc.save())

  return { outputPath, pageCount: pages.length }
}

// ─── Internal helpers for image extraction ───────────────────────────────────────

function isJpegEncoded(filterVal: any): boolean {
  if (!filterVal) return false
  if (filterVal instanceof PDFName) return filterVal.toString() === '/DCTDecode'
  if (Array.isArray(filterVal)) {
    for (const f of filterVal as any[]) {
      if (f instanceof PDFName && (f.toString() === '/DCTDecode')) return true
    }
  }
  if (filterVal instanceof PDFArray) {
    for (let i = 0; i < filterVal.size(); i++) {
      const f = filterVal.lookup(i)
      if (f instanceof PDFName && f.toString() === '/DCTDecode') return true
    }
  }
  return false
}

function tryWrapAsJpeg(streamBytes: Uint8Array): Uint8Array | null {
  // Check if it's already a valid JPEG
  if (
    streamBytes[0] === 0xff &&
    streamBytes[1] === 0xd8 &&
    streamBytes[streamBytes.length - 2] === 0xff &&
    streamBytes[streamBytes.length - 1] === 0xd9
  ) {
    return streamBytes
  }

  // Try to embed in JPEG structure
  // For DCTDecode streams that lack JPEG markers, wrap with SOI and EOI
  if (streamBytes.length > 10) {
    const soi = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
    const eoi = new Uint8Array([0xff, 0xd9])
    const wrapped = new Uint8Array(soi.length + streamBytes.length + eoi.length)
    wrapped.set(soi, 0)
    wrapped.set(streamBytes, soi.length)
    wrapped.set(eoi, soi.length + streamBytes.length)
    return wrapped
  }
  return null
}

function tryExtractJpegFromRaw(streamBytes: Uint8Array): Uint8Array | null {
  // Scan for JPEG markers in the raw stream
  let jpegStart = -1
  for (let i = 0; i < streamBytes.length - 1 && jpegStart < 0; i++) {
    if ((streamBytes as any as number[])[i] === 0xff && (streamBytes as any as number[])[i + 1] === 0xd8) {
      jpegStart = i
    }
  }

  if (jpegStart < 0) return null

  let jpegEnd = streamBytes.length
  for (let i = jpegStart + 2; i < streamBytes.length - 1; i++) {
    if ((streamBytes as any as number[])[i] === 0xff && (streamBytes as any as number[])[i + 1] === 0xd9) {
      jpegEnd = i + 2
      break
    }
  }

  return streamBytes.slice(jpegStart, jpegEnd)
}

function tryConvertToPng(streamBytes: Uint8Array, xobj: PDFDict): Uint8Array | null {
  // Try to convert raw pixel data to PNG using basic PNG signature + IHDR + IDAT + IEND
  // This is a fallback for non-JPEG images in FlateDecode format
  const widthObj = xobj.lookup(PDFName.of('Width'))
  const heightObj = xobj.lookup(PDFName.of('Height'))
  const bitsPerComponent = xobj.lookup(PDFName.of('BitsPerComponent'))
  const colorSpaceVal = xobj.lookup(PDFName.of('ColorSpace'))

  // Extract numeric values
  const width = extractPdfInt(widthObj)
  const height = extractPdfInt(heightObj)
  const bits = extractPdfInt(bitsPerComponent) || 8

  if (!width || !height || width > 10000 || height > 10000) return null

  // Determine channels from color space
  let channels = 3
  if (colorSpaceVal instanceof PDFName) {
    if (colorSpaceVal.toString() === '/DeviceGray' || colorSpaceVal.toString() === '/Gray') channels = 1
  }

  // Build minimal PNG
  try {
    const rowSize = Math.ceil((width * bits * channels) / 8)
    if (rowSize === 0 || rowSize * height !== streamBytes.length && streamBytes.length > rowSize * height + 10) {
      // For FlateDecode, attempt to decompress
      const zlib = require('zlib')
      try {
        const inflated = zlib.inflateSync(streamBytes)
        if (inflated && inflated.length > 0) {
          return encodePng(inflated, width, height, channels)
        }
      } catch {
        // zlib failed, skip
      }
    } else {
      return encodePng(streamBytes.slice(0, rowSize * height), width, height, channels)
    }
  } catch {
    return null
  }
  return null
}

function encodePng(pixelData: Uint8Array, width: number, height: number, channels: number): Uint8Array | null {
  // Minimal PNG encoder
  const zlib = require('zlib')
  const chunks: Uint8Array[] = []

  // PNG Header
  chunks.push(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

  // IHDR
  const ihdrData = new Uint8Array(13)
  writeBEInt32(ihdrData, 0, width)
  writeBEInt32(ihdrData, 4, height)
  ihdrData[8] = 8 // bits per component
  ihdrData[9] = channels === 1 ? 0 : 2 // grayscale or RGB
  ihdrData[10] = 0 // compression method
  ihdrData[11] = 0 // filter method
  ihdrData[12] = 0 // interlace
  chunks.push(makePngChunk('IHDR', ihdrData))

  // IDAT
  let idatData: Uint8Array
  try {
    idatData = zlib.deflateSync(pixelData)
  } catch {
    return null
  }
  chunks.push(makePngChunk('IDAT', idatData))

  // IEND
  chunks.push(makePngChunk('IEND', new Uint8Array(0)))

  // Combine
  let totalLen = 0
  for (const c of chunks) totalLen += c.length
  const png = new Uint8Array(totalLen)
  let offset = 0
  for (const c of chunks) {
    png.set(c, offset)
    offset += c.length
  }
  return png
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  // Convert ASCII type to bytes
  const typeBytes = new Uint8Array(4)
  for (let i = 0; i < 4 && i < type.length; i++) {
    typeBytes[i] = type.charCodeAt(i)
  }

  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  writeBEInt32(chunk, 0, data.length) // Length
  chunk.set(typeBytes, 4) // Type
  chunk.set(data, 8) // Data

  // CRC
  const crc = crc32(chunk, 4, 4 + data.length)
  writeBEInt32(chunk, 8 + data.length, crc)
  return chunk
}

function crc32(data: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let i = start; i < end; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xedb88320
      else crc >>>= 1
    }
  }
  return crc ^ 0xffffffff
}

function writeBEInt32(arr: Uint8Array, offset: number, value: number) {
  arr[offset] = (value >>> 24) & 0xff
  arr[offset + 1] = (value >>> 16) & 0xff
  arr[offset + 2] = (value >>> 8) & 0xff
  arr[offset + 3] = value & 0xff
}

async function extractDecodedStream(xobj: any): Promise<Uint8Array | null> {
  // If xobj is a raw stream, return contents
  if (typeof xobj?.contents === 'function') return xobj.contents()
  return null
}

function extractPdfInt(val: any): number {
  if (val instanceof PDFNumber) return val.asNumber()
  return typeof val === 'number' ? val : NaN
}