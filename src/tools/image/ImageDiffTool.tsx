import { useCallback, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Layers, Download, ImageOff } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

class DiffImageState {
  dataUrl: string | null = null
  diffPercent: number = 0
  width: number = 0
  height: number = 0
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function ImageDiffTool({ tool }: ToolProps) {
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [previewA, setPreviewA] = useState<string | null>(null)
  const [previewB, setPreviewB] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(30)
  const [diffState, setDiffState] = useState<DiffImageState | null>(null)
  const [comparing, setComparing] = useState(false)

  const handleFileA = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFileA(f)
    setDiffState(null)
    if (f) setPreviewA(URL.createObjectURL(f))
    else setPreviewA(null)
  }, [])

  const handleFileB = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFileB(f)
    setDiffState(null)
    if (f) setPreviewB(URL.createObjectURL(f))
    else setPreviewB(null)
  }, [])

  const handleCompare = useCallback(async () => {
    if (!fileA || !fileB) return
    setComparing(true)
    setDiffState(null)

    try {
      const [imgA, imgB] = await Promise.all([loadImageFile(fileA), loadImageFile(fileB)])

      const width = Math.min(imgA.width, imgB.width)
      const height = Math.min(imgA.height, imgB.height)

      const canvasA = document.createElement('canvas')
      canvasA.width = width
      canvasA.height = height
      const ctxA = canvasA.getContext('2d')!
      ctxA.drawImage(imgA, 0, 0, width, height)

      const canvasB = document.createElement('canvas')
      canvasB.width = width
      canvasB.height = height
      const ctxB = canvasB.getContext('2d')!
      ctxB.drawImage(imgB, 0, 0, width, height)

      const dataA = ctxA.getImageData(0, 0, width, height)
      const dataB = ctxB.getImageData(0, 0, width, height)

      const diffCanvas = document.createElement('canvas')
      diffCanvas.width = width
      diffCanvas.height = height
      const diffCtx = diffCanvas.getContext('2d')!
      const diffData = diffCtx.createImageData(width, height)

      let diffPixels = 0
      const totalPixels = width * height

      for (let i = 0; i < dataA.data.length; i += 4) {
        const rD = Math.abs(dataA.data[i] - dataB.data[i])
        const gD = Math.abs(dataA.data[i + 1] - dataB.data[i + 1])
        const bD = Math.abs(dataA.data[i + 2] - dataB.data[i + 2])
        const aD = Math.abs(dataA.data[i + 3] - dataB.data[i + 3])

        if (rD > threshold || gD > threshold || bD > threshold || aD > threshold) {
          diffPixels++
          diffData.data[i] = 255
          diffData.data[i + 1] = 0
          diffData.data[i + 2] = 100
          diffData.data[i + 3] = 180
        } else {
          diffData.data[i] = dataA.data[i]
          diffData.data[i + 1] = dataA.data[i + 1]
          diffData.data[i + 2] = dataA.data[i + 2]
          diffData.data[i + 3] = dataA.data[i + 3]
        }
      }

      diffCtx.putImageData(diffData, 0, 0)
      const diffPercent = totalPixels > 0 ? (diffPixels / totalPixels) * 100 : 0

      setDiffState({
        dataUrl: diffCanvas.toDataURL('image/png'),
        diffPercent,
        width,
        height,
      })
    } catch (_err) {
      setDiffState({ dataUrl: null, diffPercent: 0, width: 0, height: 0 })
    } finally {
      setComparing(false)
    }
  }, [fileA, fileB, threshold])

  const handleDownload = useCallback(() => {
    if (!diffState?.dataUrl) return
    const a = document.createElement('a')
    a.href = diffState.dataUrl
    a.download = 'image-diff.png'
    a.click()
  }, [diffState])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>
              Tolerance Threshold ({threshold})
            </div>
            <input
              type='range'
              min={0}
              max={255}
              value={threshold}
              onChange={(e) => {
                setThreshold(parseInt(e.target.value, 10))
                setDiffState(null)
              }}
              className='w-full accent-accent'
            />
            <div className='flex justify-between text-[10px] text-muted'>
              <span>Sensitive (0)</span>
              <span>Tolerant (255)</span>
            </div>
          </div>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Canvas API</Badge>

          <Button
            onClick={handleCompare}
            disabled={!fileA || !fileB || comparing}
            className='w-full'
          >
            <Layers className='mr-2 h-4 w-4' />
            {comparing ? 'Comparing...' : 'Compare'}
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Card>
            <div className='text-xs font-semibold uppercase text-muted mb-2'>Image A (Original)</div>
            <input
              type='file'
              accept='image/*'
              onChange={handleFileA}
              className='w-full text-xs text-muted file:mr-2 file:rounded-lg file:border file:border-border file:bg-panel file:px-3 file:py-1.5 file:text-xs file:text-text file:cursor-pointer file:hover:bg-panel-strong'
            />
            {previewA && (
              <div className='mt-3 flex justify-center'>
                <img src={previewA} alt='Image A' className='max-h-48 object-contain rounded-lg border border-border' />
              </div>
            )}
          </Card>

          <Card>
            <div className='text-xs font-semibold uppercase text-muted mb-2'>Image B (Modified)</div>
            <input
              type='file'
              accept='image/*'
              onChange={handleFileB}
              className='w-full text-xs text-muted file:mr-2 file:rounded-lg file:border file:border-border file:bg-panel file:px-3 file:py-1.5 file:text-xs file:text-text file:cursor-pointer file:hover:bg-panel-strong'
            />
            {previewB && (
              <div className='mt-3 flex justify-center'>
                <img src={previewB} alt='Image B' className='max-h-48 object-contain rounded-lg border border-border' />
              </div>
            )}
          </Card>
        </div>

        {previewA && previewB && (
          <Card>
            <div className='text-sm font-semibold text-text mb-3'>Preview</div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='text-center'>
                <div className='text-[10px] uppercase text-muted mb-1'>Image A</div>
                <img src={previewA} alt='A' className='max-h-64 w-full object-contain rounded border border-border bg-base/40' />
              </div>
              <div className='text-center'>
                <div className='text-[10px] uppercase text-muted mb-1'>Image B</div>
                <img src={previewB} alt='B' className='max-h-64 w-full object-contain rounded border border-border bg-base/40' />
              </div>
            </div>
          </Card>
        )}

        {diffState?.dataUrl && (
          <Card className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm font-semibold text-accent'>
                <ImageOff className='h-4 w-4' />
                Visual Diff
              </div>
              <Button variant='ghost' size='sm' onClick={handleDownload}>
                <Download className='mr-1 h-3 w-3' />
                Download PNG
              </Button>
            </div>

            <div className='text-center p-4 bg-base/40 rounded-xl'>
              <img src={diffState.dataUrl} alt='Diff' className='max-h-96 w-full object-contain mx-auto' />
            </div>

            <div className='text-center'>
              <div className='inline-block px-4 py-2 rounded-xl bg-accent/10 border border-accent/30'>
                <span className='text-lg font-bold text-accent'>
                  {diffState.diffPercent.toFixed(1)}%
                </span>
                <span className='text-sm text-muted ml-2'>pixels differ</span>
              </div>
              <div className='text-[10px] text-muted mt-1'>
                {diffState.width} × {diffState.height} compared at threshold: {threshold}
              </div>
            </div>
          </Card>
        )}

        {diffState && !diffState.dataUrl && (
          <Card className='text-center text-sm text-red-300 border-red-500/30 bg-red-500/5'>
            Error comparing images. Ensure both files are valid images.
          </Card>
        )}

        {!diffState && !comparing && (
          <Card className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
            <div className='flex justify-center mb-2'>
              <Layers className='h-6 w-6 text-accent' />
            </div>
            <p>Upload two images and click Compare to see pixel-level differences.</p>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
