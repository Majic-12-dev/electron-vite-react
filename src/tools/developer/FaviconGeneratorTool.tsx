import { useState, useCallback, useRef } from 'react'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Upload, Download, Image, Trash2, Package } from 'lucide-react'

interface FaviconSize {
  size: number
  label: string
  selected: boolean
  canvasElement?: HTMLCanvasElement
  dataUrl?: string
}

interface FaviconFile {
  name: string
  dataUrl: string
  width: number
  height: number
}

const DEFAULT_SIZES: FaviconSize[] = [
  { size: 16, label: '16×16 (favicon.ico)', selected: true },
  { size: 32, label: '32×32 (favicon.ico)', selected: true },
  { size: 48, label: '48×48 (Windows)', selected: true },
  { size: 64, label: '64×64 (Windows)', selected: false },
  { size: 96, label: '96×96 (Google TV)', selected: false },
  { size: 128, label: '128×128 (Chrome Web Store)', selected: false },
  { size: 180, label: '180×180 (Apple Touch Icon)', selected: false },
  { size: 192, label: '192×192 (Android)', selected: false },
  { size: 512, label: '512×512 (PWA)', selected: false },
]

function cropSquare(dataUrl: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }

      const minDim = Math.min(img.width, img.height)
      const sx = (img.width - minDim) / 2
      const sy = (img.height - minDim) / 2

      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function FaviconGeneratorTool() {
  const [sourceImage, setSourceImage] = useState<FaviconFile | null>(null)
  const [sizes, setSizes] = useState<FaviconSize[]>(DEFAULT_SIZES)
  const [generatedFavicons, setGeneratedFavicons] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, SVG, WebP)')
      return
    }

    setError('')

    const reader = new FileReader()
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string
      const img = document.createElement('img')
      img.onload = () => {
        setSourceImage({
          name: file.name,
          dataUrl,
          width: img.width,
          height: img.height,
        })
        setGeneratedFavicons({})
      }
      img.onerror = () => setError('Failed to load image')
      img.src = dataUrl
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsDataURL(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleSizeToggle = useCallback((index: number) => {
    setSizes((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], selected: !updated[index].selected }
      return updated
    })
  }, [])

  const handleSelectAll = useCallback(() => setSizes((prev) => prev.map((s) => ({ ...s, selected: true }))), [])
  const handleDeselectAll = useCallback(() => setSizes((prev) => prev.map((s) => ({ ...s, selected: false }))), [])

  const generateFavicons = useCallback(async () => {
    if (!sourceImage) return

    const selectedSizes = sizes.filter((s) => s.selected)
    if (selectedSizes.length === 0) {
      setError('Select at least one size to generate')
      return
    }

    setError('')
    const favicons: Record<number, string> = {}

    for (const size of selectedSizes) {
      try {
        const dataUrl = await cropSquare(sourceImage.dataUrl, size.size)
        favicons[size.size] = dataUrl
      } catch {
        // skip failed size
      }
    }

    setGeneratedFavicons(favicons)
  }, [sourceImage, sizes])

  const downloadIndividual = useCallback((size: number, dataUrl: string) => {
    const link = document.createElement('a')
    link.download = `favicon-${size}x${size}.png`
    link.href = dataUrl
    link.click()
  }, [])

  const downloadAll = useCallback(() => {
    Object.entries(generatedFavicons).forEach(([size, dataUrl]) => {
      const link = document.createElement('a')
      link.download = `favicon-${size}x${size}.png`
      link.href = dataUrl
      link.click()
    })

    // Generate basic favicon HTML snippet
    const selectedSizes = sizes.filter((s) => s.selected && generatedFavicons[s.size])
    let html = '<!-- Favicons -->\n'
    selectedSizes.forEach((s) => {
      const sz = s.size
      if (sz === 16 || sz === 32) {
        html += `<link rel="icon" type="image/png" sizes="${sz}x${sz}" href="/favicon-${sz}x${sz}.png">\n`
      } else if (sz === 180) {
        html += `<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n`
      } else {
        html += `<link rel="icon" type="image/png" sizes="${sz}x${sz}" href="/favicon-${sz}x${sz}.png">\n`
      }
    })
    html += `<link rel="manifest" href="/site.webmanifest">\n`

    // Download the HTML snippet
    const blob = new Blob([html], { type: 'text/html' })
    const link = document.createElement('a')
    link.download = 'favicon-html-snippet.html'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [generatedFavicons, sizes])

  const handleClear = useCallback(() => {
    setSourceImage(null)
    setGeneratedFavicons({})
    setError('')
    setSizes(DEFAULT_SIZES)
  }, [])

  return (
    <BaseToolLayout title="Favicon Generator">
      <div className="space-y-6">
        <div className="mb-4 text-sm text-muted-foreground">
          Generate favicons in multiple sizes from a single image. Supports PNG, JPG, SVG, and WebP input.
        </div>

        {/* Upload Area */}
        <div className="flex flex-col items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            aria-label="Upload source image"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 hover:border-primary hover:bg-accent/50 transition-all cursor-pointer"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-muted-foreground">Upload source image</span>
          </button>

          {sourceImage && (
            <div className="flex items-center gap-4">
              <img
                src={sourceImage.dataUrl}
                alt="Source"
                className="h-16 w-16 rounded-lg object-cover border"
              />
              <div className="text-sm">
                <p className="font-medium">{sourceImage.name}</p>
                <p className="text-muted-foreground">{sourceImage.width}×{sourceImage.height}px</p>
              </div>
              <button
                onClick={handleClear}
                className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                aria-label="Clear"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Size Selection */}
        {sourceImage && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Output Sizes
                </h3>
                <div className="flex gap-2">
                  <button onClick={handleSelectAll} className="text-xs text-primary hover:underline">
                    Select All
                  </button>
                  <button onClick={handleDeselectAll} className="text-xs text-primary hover:underline">
                    Clear All
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Favicon sizes">
                {sizes.map((size, index) => (
                  <label
                    key={size.size}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      size.selected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={size.selected}
                      onChange={() => handleSizeToggle(index)}
                      className="rounded"
                      aria-label={`${size.size}x${size.size} ${size.label}`}
                    />
                    <span className="text-sm">{size.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateFavicons}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors"
            >
              Generate Favicons
            </button>

            {/* Results */}
            {Object.keys(generatedFavicons).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Generated Favicons</h3>
                  <button
                    onClick={downloadAll}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Package className="h-4 w-4" />
                    Download All + HTML Snippet
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(generatedFavicons).map(([size, dataUrl]) => (
                    <div key={size} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card border">
                      <img src={dataUrl} alt={`${size}x${size}`} className="border rounded" style={{ width: Math.min(parseInt(size), 64), height: Math.min(parseInt(size), 64) }} />
                      <span className="text-xs font-medium">{size}×{size}</span>
                      <button
                        onClick={() => downloadIndividual(parseInt(size), dataUrl)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </BaseToolLayout>
  )
}
