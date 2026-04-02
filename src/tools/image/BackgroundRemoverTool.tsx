import { useState, useRef, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'

type BackgroundRemoverToolProps = {
  tool: ToolDefinition
}

/* ═══════ Color-space helpers ═══════ */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

function colorDistance(hsv: [number, number, number], target: [number, number, number]): number {
  const dh = Math.min(Math.abs(hsv[0] - target[0]), 1 - Math.abs(hsv[0] - target[0]))
  const ds = Math.abs(hsv[1] - target[1])
  const dv = Math.abs(hsv[2] - target[2])
  return Math.sqrt(dh * dh * 3 + ds * ds + dv * dv) / Math.sqrt(5)
}

/* ═══════ Gaussian blur (separable) ═══════ */
function gaussianBlurFloat(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src
  const sigma = Math.max(radius / 2, 0.5)
  const ks = 2 * radius + 1
  const weights = new Float32Array(ks)
  let wsum = 0
  for (let i = 0; i < ks; i++) {
    const v = Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma))
    weights[i] = v; wsum += v
  }
  for (let i = 0; i < ks; i++) weights[i] /= wsum

  const horiz = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let di = 0; di < ks; di++) {
        const nx = Math.min(w - 1, Math.max(0, x - radius + di))
        v += src[y * w + nx] * weights[di]
      }
      horiz[y * w + x] = v
    }
  }
  const out = new Float32Array(src.length)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0
      for (let di = 0; di < ks; di++) {
        const ny = Math.min(h - 1, Math.max(0, y - radius + di))
        v += horiz[ny * w + x] * weights[di]
      }
      out[y * w + x] = v
    }
  }
  return out
}

/* ═══════ Component ═══════ */
export function BackgroundRemoverTool({ tool }: BackgroundRemoverToolProps) {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasResult, setHasResult] = useState(false)
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const origRef = useRef<ImageData | null>(null)
  const currentRef = useRef<ImageData | null>(null)

  const [tolerance, setTolerance] = useState(40)
  const [featherAmount, setFeatherAmount] = useState(3)

  const [viewOriginal, setViewOriginal] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── File handling ── */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      loadSourceImage(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    // reset input
    event.target.value = ''
  }

  const loadSourceImage = (dataUrl: string) => {
    setIsProcessing(true)
    setHasResult(false)
    setViewOriginal(false)
    const img = new Image()
    img.onload = () => {
      setSourceImage(img)
      const canvas = mainCanvasRef.current
      if (!canvas) return
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      origRef.current = ctx.getImageData(0, 0, img.width, img.height)
      currentRef.current = null
      setIsProcessing(false)
    }
    img.src = dataUrl
  }

  /* ── Processing ── */
  const runRemoval = useCallback(() => {
    if (!mainCanvasRef.current || !origRef.current) return
    const canvas = mainCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsProcessing(true)

    // Run in next tick so UI updates before heavy work
    requestIdleCallback ? requestIdleCallback(doProcessing) : setTimeout(doProcessing, 10)

    function doProcessing() {
      if (!mainCanvasRef.current) return
      const canvas = mainCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const imgData = origRef.current!
      const w = imgData.width
      const h = imgData.height
      const src = imgData.data
      const out = new Uint8ClampedArray(src.length)

      // Sample background from 4 edges
      const samples: [number, number, number][] = []
      const edgeW = Math.max(1, Math.floor(w * 0.04))
      const edgeH = Math.max(1, Math.floor(h * 0.04))
      for (let y = 0; y < edgeH; y++) {
        for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 10))) {
          samples.push([src[(y * w + x) * 4], src[(y * w + x) * 4 + 1], src[(y * w + x) * 4 + 2]])
        }
      }
      for (let y = h - edgeH; y < h; y++) {
        for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 10))) {
          samples.push([src[(y * w + x) * 4], src[(y * w + x) * 4 + 1], src[(y * w + x) * 4 + 2]])
        }
      }
      for (let x = 0; x < edgeW; x++) {
        for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 10))) {
          samples.push([src[(y * w + x) * 4], src[(y * w + x) * 4 + 1], src[(y * w + x) * 4 + 2]])
        }
      }
      for (let x = w - edgeW; x < w; x++) {
        for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 10))) {
          samples.push([src[(y * w + x) * 4], src[(y * w + x) * 4 + 1], src[(y * w + x) * 4 + 2]])
        }
      }
      // Average sample colors in HSV
      let avgH = 0, avgS = 0, avgV = 0
      for (const [r, g, b] of samples) {
        const [h2, s, v] = rgbToHsv(r, g, b)
        avgH += h2; avgS += s; avgV += v
      }
      avgH /= samples.length; avgS /= samples.length; avgV /= samples.length
      const bgHsv: [number, number, number] = [avgH, avgS, avgV]

      const tol = tolerance / 100
      const alpha = new Float32Array(w * h)

      // Pass: compute alpha
      for (let i = 0; i < w * h; i++) {
        const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2]
        const [h2, s, v] = rgbToHsv(r, g, b)
        const dist = colorDistance([h2, s, v], bgHsv)
        alpha[i] = dist < tol ? 0 : dist < tol + 0.15 ? (dist - tol) / 0.15 : 1
      }

      // Feather via Gaussian blur
      if (featherAmount > 0) {
        const blurred = gaussianBlurFloat(alpha, w, h, featherAmount)
        for (let i = 0; i < w * h; i++) alpha[i] = blurred[i]
      }

      // Compose RGBA
      for (let i = 0; i < w * h; i++) {
        out[i * 4] = src[i * 4]
        out[i * 4 + 1] = src[i * 4 + 1]
        out[i * 4 + 2] = src[i * 4 + 2]
        out[i * 4 + 3] = Math.round(Math.min(255, Math.max(0, alpha[i] * 255)))
      }

      const result = new ImageData(out, w, h)
      currentRef.current = result
      ctx.putImageData(result, 0, 0)
      setHasResult(true)
      setIsProcessing(false)
    }
  }, [tolerance, featherAmount])

  /* ── Download ── */
  const downloadPng = () => {
    if (!mainCanvasRef.current) return
    const link = document.createElement('a')
    link.download = 'no-background.png'
    link.href = mainCanvasRef.current.toDataURL('image/png')
    link.click()
  }

  const handleViewChange = (view: boolean) => {
    if (!currentRef.current || !mainCanvasRef.current) return
    const ctx = mainCanvasRef.current.getContext('2d')
    if (!ctx) return
    if (view) {
      ctx.putImageData(origRef.current!, 0, 0)
    } else {
      ctx.putImageData(currentRef.current, 0, 0)
    }
    setViewOriginal(view)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-semibold text-muted uppercase">Upload Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
            />
          </div>

          {sourceImage && !isProcessing && (
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Tolerance</span>
                  <span>{tolerance}</span>
                </div>
              <Slider
                value={tolerance}
                min={5}
                max={80}
                step={1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTolerance(Number(e.target.value))}
              />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Edge Feathering</span>
                  <span>{featherAmount}</span>
                </div>
                <Slider
                  value={featherAmount}
                  min={0}
                  max={10}
                  step={1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFeatherAmount(Number(e.target.value))}
                />
              </div>

              <Button onClick={runRemoval} className="w-full" variant="primary">
                Remove Background
              </Button>

              {hasResult && (
                <div className="space-y-2">
                  <Button onClick={() => handleViewChange(!viewOriginal)} variant="outline" className="w-full text-xs">
                    {viewOriginal ? 'Show Result' : 'Show Original'}
                  </Button>
                  <Button onClick={downloadPng} variant="secondary" className="w-full">
                    Download PNG
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      {/* Preview area */}
      <div className="p-4 bg-gray-100 rounded-lg min-h-[200px] flex items-center justify-center overflow-hidden">
        {isProcessing ? (
          <p className="text-sm text-muted animate-pulse">Processing…</p>
        ) : sourceImage ? (
          <canvas ref={mainCanvasRef} className="max-w-full max-h-[500px]" />
        ) : (
          <p className="text-sm text-muted">Upload an image to preview here</p>
        )}
      </div>
    </BaseToolLayout>
  )
}
