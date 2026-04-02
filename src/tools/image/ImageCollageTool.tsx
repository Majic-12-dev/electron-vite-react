import { useState, useCallback, useRef, ChangeEvent } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Download, ImagePlus, Trash2 } from 'lucide-react'

type ImageCollageToolProps = {
  tool: ToolDefinition
}

type LayoutType = '2x2' | '3x3' | '1+3' | '2+1' | 'horizontal' | 'vertical'

const LAYOUT_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: '2x2', label: '2×2 Grid' },
  { value: '3x3', label: '3×3 Grid' },
  { value: '1+3', label: '1+3 Sidebar' },
  { value: '2+1', label: '2+1 Stacked' },
  { value: 'horizontal', label: 'Horizontal Strip' },
  { value: 'vertical', label: 'Vertical Strip' },
]

const OUTPUT_WIDTH = 1200

interface CollageImageData {
  file: File
  img: HTMLImageElement
  dataUrl: string
}

export function ImageCollageTool({ tool }: ImageCollageToolProps) {
  const [images, setImages] = useState<CollageImageData[]>([])
  const [layout, setLayout] = useState<LayoutType>('2x2')
  const [gap, setGap] = useState(8)
  const [bgColor, setBgColor] = useState('#1f1f1f')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const getExpectedImages = (l: LayoutType): number => {
    switch (l) {
      case '2x2': return 4
      case '3x3': return 9
      case '1+3': return 4
      case '2+1': return 3
      case 'horizontal': return 2
      case 'vertical': return 2
      default: return 2
    }
  }

  // Helper: cover-style draw an image into a rect
  const drawCover = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
      const imgRatio = img.width / img.height
      const cellRatio = w / h
      let drawX: number, drawY: number, drawW: number, drawH: number

      if (imgRatio > cellRatio) {
        drawH = h
        drawW = h * imgRatio
        drawX = x - (drawW - w) / 2
        drawY = y
      } else {
        drawW = w
        drawH = w / imgRatio
        drawX = x
        drawY = y - (drawH - h) / 2
      }

      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()
      ctx.drawImage(img, drawX, drawY, drawW, drawH)
      ctx.restore()
    },
    [],
  )

  const handleFilePick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      setError(null)
      const expected = getExpectedImages(layout)

      const slotsUsed = images.length
      const remaining = expected - slotsUsed
      if (remaining <= 0) {
        setError(`This layout expects ${expected} image(s). Clear first to change layout.`)
        return
      }

      const toLoad = files.slice(0, remaining)
      let loaded = 0
      const results: CollageImageData[] = []

      toLoad.forEach((file) => {
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            results.push({ file, img, dataUrl: reader.result as string })
            loaded++
            if (loaded === toLoad.length) {
              setImages((prev) => {
                const merged = [...prev, ...results].slice(0, expected)
                setRendered(false)
                return merged
              })
            }
          }
          img.onerror = () => {
            setError(`Failed to load image: ${file.name}`)
          }
          img.src = reader.result as string
        }
        reader.onerror = () => {
          setError(`Failed to read file: ${file.name}`)
        }
        reader.readAsDataURL(file)
      })

      e.target.value = ''
    },
    [images.length, layout],
  )

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      setRendered(false)
      return next
    })
  }, [])

  const handleClear = useCallback(() => {
    setImages([])
    setRendered(false)
    setPreviewUrl(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setError(null)
  }, [])

  const renderCollage = useCallback(() => {
    if (images.length === 0) {
      setError('Add some images first')
      return
    }

    setError(null)

    const canvas = canvasRef.current || document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Canvas not supported in this browser')
      return
    }

    const g = gap
    let cells: { x: number; y: number; w: number; h: number; imgIdx: number }[] = []
    const canvasH: number = (() => {
      switch (layout) {
        case '2x2': {
          const cellW = (OUTPUT_WIDTH - g * 3) / 2
          const totalH = cellW * 2 + g * 3
          cells = [
            { x: g, y: g, w: cellW, h: cellW, imgIdx: 0 },
            { x: g * 2 + cellW, y: g, w: cellW, h: cellW, imgIdx: 1 },
            { x: g, y: g * 2 + cellW, w: cellW, h: cellW, imgIdx: 2 },
            { x: g * 2 + cellW, y: g * 2 + cellW, w: cellW, h: cellW, imgIdx: 3 },
          ]
          return totalH
        }
        case '3x3': {
          const cellW = (OUTPUT_WIDTH - g * 4) / 3
          const totalH = cellW * 3 + g * 4
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              cells.push({
                x: g + col * (cellW + g),
                y: g + row * (cellW + g),
                w: cellW,
                h: cellW,
                imgIdx: row * 3 + col,
              })
            }
          }
          return totalH
        }
        case '1+3': {
          const leftW = (OUTPUT_WIDTH - g * 3) / 2
          const rightW = leftW
          const leftH = leftW + rightW * 3 + g * 2
          const cellHeight = rightW
          cells = [
            { x: g, y: g, w: leftW, h: leftH, imgIdx: 0 },
            { x: g * 2 + leftW, y: g, w: rightW, h: cellHeight, imgIdx: 1 },
            { x: g * 2 + leftW, y: g * 2 + cellHeight, w: rightW, h: cellHeight, imgIdx: 2 },
            { x: g * 2 + leftW, y: g * 3 + cellHeight * 2, w: rightW, h: cellHeight, imgIdx: 3 },
          ]
          return leftH + g * 2
        }
        case '2+1': {
          const topCellW = (OUTPUT_WIDTH - g * 3) / 2
          const topH = topCellW
          const botW = OUTPUT_WIDTH - g * 2
          const botH = topCellW
          cells = [
            { x: g, y: g, w: topCellW, h: topH, imgIdx: 0 },
            { x: g * 2 + topCellW, y: g, w: topCellW, h: topH, imgIdx: 1 },
            { x: g, y: g * 2 + topH, w: botW, h: botH, imgIdx: 2 },
          ]
          return botH + topH + g * 3
        }
        case 'horizontal': {
          const imgW = (OUTPUT_WIDTH - g * 3) / 2
          const imgH = Math.round(OUTPUT_WIDTH * 0.4)
          cells = [
            { x: g, y: g, w: imgW, h: imgH, imgIdx: 0 },
            { x: g * 2 + imgW, y: g, w: imgW, h: imgH, imgIdx: 1 },
          ]
          return imgH + g * 2
        }
        case 'vertical': {
          const imgH = (OUTPUT_WIDTH * 0.6 - g * 3) / 2
          const w = OUTPUT_WIDTH - g * 2
          cells = [
            { x: g, y: g, w, h: imgH, imgIdx: 0 },
            { x: g, y: g * 2 + imgH, w, h: imgH, imgIdx: 1 },
          ]
          return imgH * 2 + g * 3
        }
        default: {
          cells = []
          return 800
        }
      }
    })()

    canvas.width = OUTPUT_WIDTH
    canvas.height = canvasH

    // Background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw each cell
    cells.forEach((cell) => {
      if (cell.imgIdx < images.length) {
        drawCover(ctx, images[cell.imgIdx].img, cell.x, cell.y, cell.w, cell.h)
      } else {
        // Placeholder for missing images
        ctx.strokeStyle = bgColor
        ctx.lineWidth = 1
        ctx.strokeRect(cell.x, cell.y, cell.w, cell.h)
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`Image ${cell.imgIdx + 1}`, cell.x + cell.w / 2, cell.y + cell.h / 2)
      }
    })

    // Generate preview URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
        setPreviewUrl(url)
        setRendered(true)
      }
    }, 'image/png')
  }, [images, layout, gap, bgColor, drawCover])

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return
    const a = document.createElement('a')
    a.download = 'collage.png'
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
  }, [])

  const expectedCount = getExpectedImages(layout)
  const canRender = images.length >= 2

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-4">
        {/* File upload */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilePick}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
            className="w-full"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Add Images ({images.length}/{expectedCount})
          </Button>

          {/* Image thumbnails */}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={`${img.dataUrl.slice(0, 20)}-${i}`} className="group relative">
                  <img
                    src={img.dataUrl}
                    alt={`Image ${i + 1}`}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-1 -right-1 rounded-full bg-red-500/80 p-0.5 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-3 w-3 text-white" />
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-white">
                    {i + 1}
                  </span>
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= expectedCount}
                className="h-16 w-16 rounded-lg border-2 border-dashed border-border"
              >
                <ImagePlus className="h-5 w-5 text-muted" />
              </Button>
            </div>
          )}
        </div>

        {/* Controls */}
        <Card className="space-y-3 p-4">
          <div className="text-xs font-semibold uppercase text-muted">Layout</div>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setLayout(opt.value)
                  setRendered(false)
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  layout === opt.value
                    ? 'border-accent bg-accent/20 text-accent'
                    : 'border-border bg-base/40 text-muted hover:border-border/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Gap: {gap}px</label>
              <input
                type="range"
                min={0}
                max={40}
                value={gap}
                onChange={(e) => {
                  setGap(Number(e.target.value))
                  setRendered(false)
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => {
                    setBgColor(e.target.value)
                    setRendered(false)
                  }}
                  className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="text-xs font-mono text-muted">{bgColor}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={renderCollage}
            disabled={!canRender}
            className="w-full"
          >
            Generate Collage
          </Button>
        </Card>

        {error && (
          <Card className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </Card>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">Preview</span>
              <div className="flex gap-2">
                <Button onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </Button>
                <Button variant="ghost" onClick={handleClear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Card className="overflow-hidden bg-base/40">
              <img
                src={previewUrl}
                alt="Collage preview"
                className="w-full object-contain"
              />
            </Card>
          </div>
        )}

        {/* Hidden canvas for rendering */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </BaseToolLayout>
  )
}
