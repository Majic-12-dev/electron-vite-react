import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Download, ImageDown } from 'lucide-react'

type Format = 'webp' | 'png' | 'jpeg'

type WebpConverterToolProps = {
  tool: ToolDefinition
}

/** Load a file into an HTMLImageElement */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
    img.src = URL.createObjectURL(file)
  })
}

/** Convert an image to a canvas and export as target format */
async function convertImage(
  image: HTMLImageElement,
  format: Format,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not supported')

  // For JPEG, fill white background (handles transparency correctly)
  if (format === 'jpeg') {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.drawImage(image, 0, 0)

  const mimeType = format === 'webp' ? 'image/webp' : format === 'png' ? 'image/png' : 'image/jpeg'
  const q = format === 'png' ? undefined : quality / 100

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to convert to ${format}`))),
      mimeType,
      q,
    )
  })
}

export function WebpConverterTool({ tool }: WebpConverterToolProps) {
  const [format, setFormat] = useState<Format>('webp')
  const [quality, setQuality] = useState(85)
  const [openAfter, setOpenAfter] = useState(true)
  const [result, setResult] = useState<{
    total: number
    blobs: Blob[]
    urls: string[]
    names: string[]
  } | null>(null)

  const handleProcess = useCallback(
    async (files: ToolFile[], context: {
      setProgress: (v: number) => void
      setResult: (n: React.ReactNode) => void
      setError: (m: string | null) => void
    }) => {
      if (files.length === 0) throw new Error('No images provided.')

      context.setProgress(10)
      const blobs: Blob[] = []
      const urls: string[] = []
      const names: string[] = []
      const ext = format === 'jpeg' ? 'jpg' : format

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const image = await loadImage(file.file)
          const blob = await convertImage(image, format, quality)
          const baseName = file.name.replace(/\.[^.]+$/, '')
          names.push(`${baseName}.${ext}`)
          blobs.push(blob)
          urls.push(URL.createObjectURL(blob))
        } catch (err: unknown) {
          console.warn(`Skipping ${file.name}:`, err)
        }
        context.setProgress(10 + Math.round(((i + 1) / files.length) * 80))
      }

      if (blobs.length === 0) throw new Error('No images could be converted.')

      setResult({ total: blobs.length, blobs, urls, names })

      context.setResult(
        <>
          <Badge className="border-0 bg-emerald-100 text-emerald-700">
            {blobs.length} file(s) converted
          </Badge>
          <div className="mt-4 space-y-2">
            {urls.map((url, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <img src={url} alt={names[idx]} className="h-12 w-12 rounded-lg object-cover" />
                <span className="text-xs flex-1 truncate text-muted">{names[idx]}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = url
                    a.download = names[idx]
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                  }}
                >
                  <Download className="mr-1 h-3 w-3" /> Save
                </Button>
              </div>
            ))}
          </div>
        </>,
      )
    },
    [format, quality],
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      onProcess={handleProcess}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Target Format</div>
            <Select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              <option value="webp">WebP</option>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Quality</div>
            <Select
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            >
              {[100, 95, 90, 85, 80, 70, 60, 50].map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </Select>
            {format === 'png' && (
              <div className="text-xs text-muted/60 mt-1">Quality does not affect PNG output.</div>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={openAfter}
              onChange={(e) => setOpenAfter(e.target.checked)}
            />
            Download files after conversion
          </label>
          <Badge className="border-0 bg-accent/15 text-accent">
            Offline • Canvas API conversion
          </Badge>
        </div>
      }
    />
  )
}
