import { useCallback, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Download, Upload, FileImage, XCircle, Palette } from 'lucide-react'

type ToolProps = { tool: ToolDefinition }

type ResolutionPreset = 256 | 512 | 1024 | 2048 | 'custom'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SvgToPngTool({ tool }: ToolProps) {
  const [svgInput, setSvgInput] = useState('')
  const [svgUrl, setSvgUrl] = useState<string | null>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [pngFileSize, setPngFileSize] = useState<number>(0)
  const [resolution, setResolution] = useState<ResolutionPreset>(512)
  const [customWidth, setCustomWidth] = useState(800)
  const [customHeight, setCustomHeight] = useState(600)
  const [bgType, setBgType] = useState<'transparent' | 'white' | 'custom'>('transparent')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const outputWidth = resolution === 'custom' ? customWidth : resolution
  const outputHeight = resolution === 'custom' ? customHeight : resolution

  const loadSVG = useCallback((svg: string) => {
    setError(null)
    const trimmed = svg.trim()
    if (!trimmed) { setError('Empty SVG input.'); return }
    // Basic validation
    if (!trimmed.includes('<')) { setError('Invalid SVG: no XML tags detected.'); return }
    setSvgInput(trimmed)
    // Create blob URL for preview
    const blob = new Blob([trimmed], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    setSvgUrl(url)
    setPngUrl(null)
    return () => URL.revokeObjectURL(url)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (text) loadSVG(text)
    }
    reader.onerror = () => setError('Failed to read SVG file.')
    reader.readAsText(file)
  }, [loadSVG])

  const handleConvert = useCallback(() => {
    setError(null)
    setPngUrl(null)
    if (!svgInput) { setError('No SVG to convert.'); return }
    try {
      // Create an image from SVG
      const img = new Image()
      const blob = new Blob([svgInput], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = outputWidth
        canvas.height = outputHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { setError('Canvas context not available.'); URL.revokeObjectURL(url); return }
        if (bgType === 'white') {
          ctx.fillStyle = '#ffffff'
        } else if (bgType === 'custom') {
          ctx.fillStyle = bgColor
        } else {
          // Transparent - clear canvas explicitly
          ctx.clearRect(0, 0, outputWidth, outputHeight)
        }
        if (bgType !== 'transparent') {
          ctx.fillRect(0, 0, outputWidth, outputHeight)
        }
        ctx.drawImage(img, 0, 0, outputWidth, outputHeight)
        URL.revokeObjectURL(url)
        const pngDataUrl = canvas.toDataURL('image/png')
        setPngUrl(pngDataUrl)
        // Calculate size from base64
        const base64Length = pngDataUrl.split(',')[1].length
        const byteSize = Math.round(base64Length * 0.75)
        setPngFileSize(byteSize)
      }
      img.onerror = () => {
        setError('Failed to render SVG. Check for valid syntax.')
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (e) {
      setError('Conversion error: SVG may contain unsupported features.')
    }
  }, [svgInput, outputWidth, outputHeight, bgType, bgColor])

  const handleDownload = useCallback(() => {
    if (!pngUrl) return
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = 'converted.png'
    a.click()
  }, [pngUrl])

  const presets: { label: string; value: ResolutionPreset }[] = [
    { label: '256px', value: 256 },
    { label: '512px', value: 512 },
    { label: '1024px', value: 1024 },
    { label: '2048px', value: 2048 },
    { label: 'Custom', value: 'custom' },
  ]

  const hasSVG = !!svgUrl
  const hasPNG = !!pngUrl

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          {/* Resolution Presets */}
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Output Resolution</label>
            <div className='grid grid-cols-2 gap-1.5'>
              {presets.map((p) => (
                <button key={p.label} onClick={() => setResolution(p.value)}
                  className={`rounded-lg border px-2 py-1.5 text-center text-xs font-mono transition
                    ${resolution === p.value ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {resolution === 'custom' && (
              <div className='grid grid-cols-2 gap-2 mt-2'>
                <input type='number' value={customWidth} onChange={e => setCustomWidth(Number(e.target.value))}
                  placeholder='Width' min={1} max={4096}
                  className='rounded-lg border border-border bg-base/70 px-2 py-1.5 text-sm focus:border-accent focus:outline-none' />
                <input type='number' value={customHeight} onChange={e => setCustomHeight(Number(e.target.value))}
                  placeholder='Height' min={1} max={4096}
                  className='rounded-lg border border-border bg-base/70 px-2 py-1.5 text-sm focus:border-accent focus:outline-none' />
              </div>
            )}
          </div>

          {/* Background */}
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Background</label>
            <div className='flex gap-2'>
              {(['transparent', 'white', 'custom'] as const).map((t) => (
                <button key={t} onClick={() => setBgType(t)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition
                    ${bgType === t ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-text bg-base/60'}`}>
                  {t === 'transparent' ? 'None' : t === 'white' ? 'White' : 'Custom'}
                </button>
              ))}
            </div>
            {bgType === 'custom' && (
              <div className='flex items-center gap-2'>
                <input type='color' value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className='h-8 w-8 rounded cursor-pointer border-0' />
                <input type='text' value={bgColor} onChange={e => setBgColor(e.target.value)}
                  placeholder='#000000'
                  className='flex-1 rounded-lg border border-border bg-base/70 px-2 py-1.5 text-xs font-mono focus:border-accent focus:outline-none' />
              </div>
            )}
          </div>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Canvas API</Badge>

          <Button onClick={handleConvert} disabled={!svgInput} className='w-full'>
            <FileImage className='mr-2 h-4 w-4' />
            Convert to PNG
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        {error && (
          <Card className='flex items-start gap-3 border border-red-500/50 bg-red-500/10'>
            <XCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-400' />
            <div className='text-sm text-red-200'>{error}</div>
          </Card>
        )}

        <div className='space-y-2'>
          <label className='text-sm font-medium text-accent'>Paste SVG Markup</label>
          <textarea value={svgInput}
            onChange={e => { setSvgInput(e.target.value); loadSVG(e.target.value) }}
            placeholder='<svg ...>...</svg>'
            rows={5}
            className='w-full h-[120px] rounded-xl border border-border bg-base/70 px-3 py-2 font-mono text-xs placeholder:text-muted/50 focus:border-accent focus:outline-none resize-y' />
          <div className='flex items-center gap-2 text-xs text-muted'>
            <Upload className='h-3.5 w-3.5' />
            <input ref={fileInputRef} type='file' accept='.svg' onChange={handleFileUpload} className='hidden' />
            <button onClick={() => fileInputRef.current?.click()} className='underline hover:text-text'>
              Or upload an SVG file
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* SVG Preview */}
          <Card>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-xs font-semibold uppercase text-muted'>SVG Preview</span>
            </div>
            {hasSVG ? (
              <div className='border border-border rounded-lg p-2 bg-white/5 flex items-center justify-center min-h-[200px]'>
                <img src={svgUrl!} alt='SVG Preview' className='max-w-full max-h-[200px] object-contain' />
              </div>
            ) : (
              <div className='text-center text-xs text-muted py-8'>SVG preview appears when valid markup is entered</div>
            )}
          </Card>

          {/* PNG Preview */}
          <Card>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-xs font-semibold uppercase text-muted'>PNG Result ({outputWidth}×{outputHeight})</span>
            </div>
            {hasPNG ? (
              <>
                <div className='border border-border rounded-lg p-2 bg-white/5 flex items-center justify-center min-h-[200px]'>
                  <img src={pngUrl!} alt='PNG Result' className='max-w-full max-h-[200px] object-contain' />
                </div>
                <Button onClick={handleDownload} className='w-full mt-2'>
                  <Download className='mr-2 h-4 w-4' />
                  Download PNG
                </Button>
              </>
            ) : (
              <div className='text-center text-xs text-muted py-8'>
                <Palette className='h-5 w-5 mx-auto mb-2 opacity-50' />
                Click Convert to generate PNG
              </div>
            )}
          </Card>
        </div>
      </div>
    </BaseToolLayout>
  )
}
