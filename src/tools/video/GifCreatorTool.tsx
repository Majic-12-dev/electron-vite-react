import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Image as ImageIcon, Download, Play, Square, Trash2, Settings2 } from 'lucide-react'

/** Extract image element from a File */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
    img.src = URL.createObjectURL(file)
  })
}

/** Convert canvas frames to animated GIF using a simple LZW encoder */
function encodeGif(
  frames: ImageData[],
  width: number,
  height: number,
  delay: number,
  repeat: number,
): Uint8Array {
  const framesCount = frames.length
  // Calculate global color table size (nearest power of 2)
  const paletteSize = 256
  const globalColorTable = buildPalette(frames)

  const out: number[] = []

  // GIF Header
  out.push(...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // GIF89a

  // Logical Screen Descriptor
  out.push(width & 0xff, (width >> 8) & 0xff)
  out.push(height & 0xff, (height >> 8) & 0xff)
  // Global Color Table Flag = 1, Color Resolution = 8, Sort = 0, Size = 7 (256 colors)
  out.push(0xf7)
  out.push(0) // Background Color Index
  out.push(0) // Pixel Aspect Ratio

  // Global Color Table
  for (let i = 0; i < paletteSize; i++) {
    const entry = globalColorTable[i] || [0, 0, 0]
    out.push(entry[0], entry[1], entry[2])
  }

  // Netscape Application Extension (loop)
  if (repeat >= 0) {
    out.push(0x21, 0xff, 0x0b)
    out.push(...'NETSCAPE2.0'.split('').map(c => c.charCodeAt(0)))
    out.push(0x03, 0x01)
    out.push(repeat & 0xff, (repeat >> 8) & 0xff)
    out.push(0x00)
  }

  // Graphics Control Extension + Image Descriptor + Image Data for each frame
  for (let f = 0; f < framesCount; f++) {
    const frame = frames[f]
    const indexed = quantizeFrame(frame.data, globalColorTable)

    // Graphic Control Extension
    out.push(0x21, 0xf9, 0x04) // Extension introducer, GCE label, block size
    out.push(0x00) // Disposal method 0, no transparency
    const delayCs = Math.round(delay / 10) // centiseconds
    out.push(delayCs & 0xff, (delayCs >> 8) & 0xff)
    out.push(0x00) // Transparent color index
    out.push(0x00) // Block terminator

    // Image Descriptor
    out.push(0x2c)
    out.push(0x00, 0x00) // Left position
    out.push(0x00, 0x00) // Top position
    out.push(width & 0xff, (width >> 8) & 0xff)
    out.push(height & 0xff, (height >> 8) & 0xff)
    out.push(0x00) // No local color table, no interlace

    // LZW encode
    const lzwData = lzwEncode(indexed, 8)
    out.push(8) // LZW minimum code size
    // Sub-blocks
    let offset = 0
    while (offset < lzwData.length) {
      const blockSize = Math.min(255, lzwData.length - offset)
      out.push(blockSize)
      for (let b = 0; b < blockSize; b++) {
        out.push(lzwData[offset + b])
      }
      offset += blockSize
    }
    out.push(0x00) // Block terminator
  }

  // Trailer
  out.push(0x3b)

  return new Uint8Array(out)
}

function buildPalette(frames: ImageData[]): [number, number, number][] {
  const palette: [number, number, number][] = []
  const used = new Set<string>()

  for (const frame of frames) {
    const d = frame.data
    for (let i = 0; i < d.length; i += 4) {
      // Round to nearest 32 to reduce colors
      const r = Math.round(d[i] / 32) * 32
      const g = Math.round(d[i + 1] / 32) * 32
      const b = Math.round(d[i + 2] / 32) * 32
      // Clamp
      const cr = Math.min(255, r)
      const cg = Math.min(255, g)
      const cb = Math.min(255, b)
      const key = `${cr},${cg},${cb}`
      if (!used.has(key) && palette.length < 256) {
        used.add(key)
        palette.push([cr, cg, cb])
      }
    }
  }

  // Pad to 256
  while (palette.length < 256) {
    palette.push([0, 0, 0])
  }
  return palette
}

function quantizeFrame(
  data: Uint8ClampedArray,
  palette: [number, number, number][],
): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    let bestDist = Infinity
    let bestIdx = 0
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0]
      const dg = g - palette[p][1]
      const db = b - palette[p][2]
      const dist = dr * dr + dg * dg + db * db
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = p
      }
    }
    result.push(bestIdx)
  }
  return result
}

function lzwEncode(data: number[], minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1

  const outBits: number[] = []
  let buffer = 0
  let bitsInBuffer = 0

  function writeCode(code: number) {
    buffer |= code << bitsInBuffer
    bitsInBuffer += codeSize
    while (bitsInBuffer >= 8) {
      outBits.push(buffer & 0xff)
      buffer >>= 8
      bitsInBuffer -= 8
    }
  }

  // Initialize dictionary
  const dict = new Map<string, number>()
  for (let i = 0; i < clearCode; i++) {
    dict.set(String(i), i)
  }

  writeCode(clearCode)
  if (data.length === 0) {
    writeCode(eoiCode)
    if (bitsInBuffer > 0) {
      outBits.push(buffer & 0xff)
    }
    return outBits
  }

  let w = String(data[0])
  for (let i = 1; i < data.length; i++) {
    const k = String(data[i])
    const wk = w + ',' + k
    if (dict.has(wk)) {
      w = wk
    } else {
      if (dict.has(w)) {
        writeCode(dict.get(w)!)
      } else {
        // Reset dictionary
        writeCode(clearCode)
        nextCode = eoiCode + 1
        codeSize = minCodeSize + 1
        dict.clear()
        for (let j = 0; j < clearCode; j++) {
          dict.set(String(j), j)
        }
      }
      if (nextCode < 4096) {
        dict.set(wk, nextCode)
        if (nextCode >= (1 << codeSize) && codeSize < 12) {
          codeSize++
        }
        nextCode++
      } else {
        writeCode(clearCode)
        nextCode = eoiCode + 1
        codeSize = minCodeSize + 1
        dict.clear()
        for (let j = 0; j < clearCode; j++) {
          dict.set(String(j), j)
        }
      }
      w = k
    }
  }

  if (dict.has(w)) {
    writeCode(dict.get(w)!)
  }
  writeCode(eoiCode)
  if (bitsInBuffer > 0) {
    outBits.push(buffer & 0xff)
  }

  return outBits
}

type GifCreatorToolProps = {
  tool: ToolDefinition
}

export function GifCreatorTool({ tool }: GifCreatorToolProps) {
  const [frameDelay, setFrameDelay] = useState(500)
  const [loop, setLoop] = useState(true)
  const [quality, setQuality] = useState(10)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [gifSize, setGifSize] = useState<number | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewFrames, setPreviewFrames] = useState<string[]>([])

  // Clean up preview frames on unmount
  useEffect(() => {
    return () => {
      previewFrames.forEach(u => { try { URL.revokeObjectURL(u) } catch {} })
    }
  }, [])

  const handleProcess = useCallback(async (files: ToolFile[], ctx: {
    setProgress: (v: number) => void
    setResult: (n: React.ReactNode) => void
    setError: (m: string | null) => void
  }) => {
    if (files.length === 0) throw new Error('No images provided.')
    if (files.length > 100) throw new Error('Maximum 100 frames allowed.')
    setProcessing(true)
    setError(null)
    setGifUrl(null)
    setGifSize(null)
    setPreviewFrames([])

    try {
      // Load all images
      ctx.setProgress(10)
      const images = await Promise.all(files.map(f => loadImage(f.file)))

      ctx.setProgress(30)
      // Determine canvas size (resize to max quality dimension)
      const maxDim = Math.pow(2, Math.floor(Math.log2(quality * 50 + 50))) // quality 1-10 -> 100-500px
      let canvasW = images[0].width
      let canvasH = images[0].height

      if (canvasW > maxDim || canvasH > maxDim) {
        const ratio = maxDim / Math.max(canvasW, canvasH)
        canvasW = Math.round(canvasW * ratio)
        canvasH = Math.round(canvasH * ratio)
      }
      // Ensure even dimensions (required by GIF spec)
      if (canvasW % 2 !== 0) canvasW += 1
      if (canvasH % 2 !== 0) canvasH += 1

      // Generate frames
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.width = canvasW
      canvas.height = canvasH

      const frameData: ImageData[] = []
      const previewUrls: string[] = []

      for (let i = 0; i < images.length; i++) {
        context.clearRect(0, 0, canvasW, canvasH)
        // Cover fit
        const imgRatio = images[i].width / images[i].height
        const cvsRatio = canvasW / canvasH
        let sx: number, sy: number, sWidth: number, sHeight: number
        if (imgRatio > cvsRatio) {
          sHeight = images[i].height
          sWidth = sHeight * cvsRatio
          sx = (images[i].width - sWidth) / 2
          sy = 0
        } else {
          sWidth = images[i].width
          sHeight = sWidth / cvsRatio
          sx = 0
          sy = (images[i].height - sHeight) / 2
        }
        context.drawImage(images[i], sx, sy, sWidth, sHeight, 0, 0, canvasW, canvasH)
        frameData.push(context.getImageData(0, 0, canvasW, canvasH))
        previewUrls.push(canvas.toDataURL('image/jpeg', 0.7))
        ctx.setProgress(30 + Math.round((i / images.length) * 40))
      }

      setPreviewFrames(previewUrls)

      ctx.setProgress(75)
      // Encode GIF
      const gifData = encodeGif(frameData, canvasW, canvasH, frameDelay, loop ? 0 : 1)
      const blob = new Blob([gifData], { type: 'image/gif' })
      const url = URL.createObjectURL(blob)
      setGifUrl(url)
      setGifSize(blob.size)
      ctx.setProgress(100)

      ctx.setResult(<>
        <Badge className="border-0 bg-emerald-100 text-emerald-700">GIF generated successfully</Badge>
      </>)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create GIF.'
      setError(msg)
      ctx.setError(msg)
    } finally {
      setProcessing(false)
    }
  }, [frameDelay, loop, quality])

  const handleDownload = useCallback(() => {
    if (!gifUrl) return
    const a = document.createElement('a')
    a.href = gifUrl
    a.download = 'animation.gif'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [gifUrl])

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setPreviewIndex(prev => Math.max(0, prev - 1))
    } else if (e.key === 'ArrowRight') {
      setPreviewIndex(prev => Math.min(previewFrames.length - 1, prev + 1))
    }
  }, [previewFrames.length])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      instructions="Drop images here in frame order, or click to browse."
      maxFiles={100}
      reorderable={true}
      onProcess={handleProcess}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Frame Delay</div>
            <Slider
              min={50}
              max={2000}
              step={50}
              value={frameDelay}
              onChange={(e) => setFrameDelay(Number(e.target.value))}
              unit="ms"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Max Dimension</div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              label="Size"
            />
            <div className="text-xs text-muted">
              {Math.pow(2, Math.floor(Math.log2(quality * 50 + 50)))}px max side
            </div>
          </div>
          <Switch
            label="Loop animation"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side canvas</Badge>
        </div>
      }
      result={gifUrl ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="border-0 bg-emerald-100 text-emerald-700">
              GIF ready • {gifSize ? formatSize(gifSize) : ''}
            </Badge>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border border-border bg-white p-4">
              <img
                src={gifUrl}
                alt="Animated GIF preview"
                className="max-h-64"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            {previewFrames.length > 0 && (
              <div className="w-full">
                <div className="text-xs text-muted mb-2">Frames ({previewFrames.length})</div>
                <div
                  className="flex gap-2 overflow-x-auto pb-2"
                  onKeyDown={handleKeyDown}
                  tabIndex={0}
                  role="region"
                  aria-label="Frame preview"
                >
                  {previewFrames.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewIndex(i)}
                      className={`shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition ${
                        i === previewIndex ? 'border-accent' : 'border-border'
                      }`}
                      aria-label={`Frame ${i + 1}`}
                      aria-pressed={i === previewIndex}
                    >
                      <img src={src} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : error ? (
        <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
          {error}
        </Card>
      ) : null}
    />
  )
}
