import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Input } from '@/components/ui/Input'
import { Download, Type, Sparkle } from 'lucide-react'

type MemeGeneratorToolProps = {
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

/** Classic meme font stack */
const MEME_FONTS = [
  'Impact',
  'Arial Black',
  'Comic Sans MS',
  'System',
  'Times New Roman',
] as const
type MemeFont = typeof MEME_FONTS[number]

const FONT_PRESETS: Record<string, string> = {
  Impact: 'Impact, "Arial Black", sans-serif',
  'Arial Black': '"Arial Black", Impact, sans-serif',
  'Comic Sans MS': '"Comic Sans MS", "Comic Sans", cursive',
  System: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'Times New Roman': '"Times New Roman", Times, serif',
}

/** Measure text width for wrapping */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0] || ''

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i]
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = words[i]
    } else {
      currentLine = testLine
    }
  }
  lines.push(currentLine)
  return lines
}

/** Draw text with classic meme style: black stroke, white fill */
function drawMemeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  fontFace: string,
  top: boolean,
) {
  ctx.save()
  ctx.font = `bold ${fontSize}px ${fontFace}`
  ctx.textAlign = 'center'
  ctx.textBaseline = top ? 'top' : 'bottom'
  ctx.lineJoin = 'round'
  ctx.lineWidth = fontSize / 8
  ctx.strokeStyle = '#000000'
  ctx.fillStyle = '#ffffff'

  const lines = wrapText(ctx, text, maxWidth - fontSize)
  const lineHeight = fontSize * 1.1
  const totalHeight = lines.length * lineHeight

  for (let i = 0; i < lines.length; i++) {
    const lineY = top ? y + i * lineHeight : y - (lines.length - 1 - i) * lineHeight
    ctx.strokeText(lines[i], x, lineY)
    ctx.fillText(lines[i], x, lineY)
  }
  ctx.restore()
}

export function MemeGeneratorTool({ tool }: MemeGeneratorToolProps) {
  const [topText, setTopText] = useState('')
  const [bottomText, setBottomText] = useState('')
  const [fontSizePct, setFontSizePct] = useState(10)
  const [fontFamily, setFontFamily] = useState<MemeFont>('Impact')
  const [memeUrl, setMemeUrl] = useState<string | null>(null)
  const [memeSize, setMemeSize] = useState<number | null>(null)

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (n: React.ReactNode) => void
        setError: (m: string | null) => void
      },
    ) => {
      if (files.length === 0) throw new Error('No image provided.')

      const file = files[0]
      context.setProgress(20)

      try {
        const image = await loadImage(file.file)
        context.setProgress(50)

        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(image, 0, 0)

        // Calculate font size as percentage of canvas width
        const fontSize = Math.round((image.naturalWidth * fontSizePct) / 100)

        // Draw top text
        if (topText) {
          drawMemeText(
            ctx,
            topText.toUpperCase(),
            canvas.width / 2,
            fontSize * 0.2,
            canvas.width,
            fontSize,
            FONT_PRESETS[fontFamily],
            true,
          )
        }

        // Draw bottom text
        if (bottomText) {
          drawMemeText(
            ctx,
            bottomText.toUpperCase(),
            canvas.width / 2,
            canvas.height - fontSize * 0.2,
            canvas.width,
            fontSize,
            FONT_PRESETS[fontFamily],
            false,
          )
        }

        context.setProgress(90)

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
            'image/png',
          )
        })

        setMemeSize(blob.size)
        const url = URL.createObjectURL(blob)
        setMemeUrl(url)
        context.setProgress(100)

        const formatSize = (bytes: number) =>
          bytes < 1024 * 1024
            ? `${(bytes / 1024).toFixed(1)} KB`
            : `${(bytes / (1024 * 1024)).toFixed(2)} MB`

        context.setResult(
          <>
            <Badge className="border-0 bg-emerald-100 text-emerald-700">
              Meme ready{memeSize ? ` • ${formatSize(memeSize)}` : ''}
            </Badge>
          </>,
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to generate meme.'
        context.setError(msg)
        throw new Error(msg)
      }
    },
    [topText, bottomText, fontSizePct, fontFamily, memeSize],
  )

  const handleDownload = useCallback(() => {
    if (!memeUrl) return
    const a = document.createElement('a')
    a.href = memeUrl
    a.download = 'meme.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [memeUrl])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      maxFiles={1}
      onProcess={handleProcess}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Top Text</div>
            <Input
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder="TOP TEXT"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Bottom Text</div>
            <Input
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              placeholder="BOTTOM TEXT"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Font</div>
            <Select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as MemeFont)}>
              {MEME_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Font Size</div>
            <Slider
              min={3}
              max={20}
              step={1}
              value={fontSizePct}
              onChange={(e) => setFontSizePct(Number(e.target.value))}
              label="Size"
            />
            <div className="text-xs text-muted">{fontSizePct}/20</div>
          </div>
          <Badge className="border-0 bg-accent/15 text-accent">
            Classic meme style • Auto-uppercase
          </Badge>
        </div>
      }
      result={
        memeUrl ? (
          <div className="space-y-4">
            <img
              src={memeUrl}
              alt="Generated meme"
              className="max-h-80 rounded-xl border border-border"
            />
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={handleDownload}>
                <Download className="mr-1 h-4 w-4" /> Download
              </Button>
            </div>
          </div>
        ) : null
      }
    />
  )
}
