import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type PdfToImagesToolProps = {
  tool: ToolDefinition
}

export function PdfToImagesTool({ tool }: PdfToImagesToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [quality, setQuality] = useState(92)
  const [dpi, setDpi] = useState(150)
  const [pageRange, setPageRange] = useState('')
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='.pdf'
      onProcess={async (files, context) => {
        if (!window.api?.pdfToImages) {
          throw new Error('The PDF-to-Images engine is not available.')
        }

        const inputPaths = files.map((file) => file.path).filter(Boolean) as string[]
        if (inputPaths.length !== files.length) {
          throw new Error('Some files are missing paths. Remove and re-add them.')
        }

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(15)
        const result = await window.api.pdfToImages({
          inputPaths,
          outputDir,
          format,
          quality,
          dpi,
          pageRange: pageRange || undefined,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Conversion complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Rendered {result.totalPages} page(s) to {result.totalOutputs} image(s).</div>
              <div className='text-xs text-muted'>Output: {result.outputDir}</div>
              <div className='pt-2'>
                <Button
                  variant='secondary'
                  onClick={() => window.api.revealInFolder(result.outputDir)}
                >
                  Open Output Folder
                </Button>
              </div>
            </div>
          </>,
        )

        if (openAfter) {
          await window.api.revealInFolder(result.outputDir)
        }
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Format</div>
            <div className='flex gap-2'>
              <Button
                variant={format === 'png' ? 'primary' : 'outline'}
                onClick={() => setFormat('png')}
                className='flex-1 text-xs'
              >
                PNG
              </Button>
              <Button
                variant={format === 'jpg' ? 'primary' : 'outline'}
                onClick={() => setFormat('jpg')}
                className='flex-1 text-xs'
              >
                JPG
              </Button>
            </div>
          </div>

          {format === 'jpg' && (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Quality: {quality}%</div>
              <input
                type='range'
                min={50}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className='w-full accent-accent'
              />
            </div>
          )}

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Resolution (DPI)</div>
            <Select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
              {[72, 96, 120, 150, 200, 300, 600].map((v) => (
                <option key={v} value={v}>
                  {v} DPI {v <= 96 ? '(screen)' : v <= 150 ? '(standard)' : v <= 300 ? '(print)' : '(high-res)'}
                </option>
              ))}
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Page Range</div>
            <input
              type='text'
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              className='w-full rounded-xl border border-border bg-base/60 px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent/60'
              placeholder='e.g. 1-3, 5, 8-10 (leave empty for all)'
            />
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Folder</div>
            <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
              {outputDirLabel}
            </div>
            <Button variant='outline' onClick={handleChooseFolder}>
              Change Folder
            </Button>
          </div>

          <label className='flex items-center gap-2 text-xs text-muted'>
            <input
              type='checkbox'
              checked={openAfter}
              onChange={(e) => setOpenAfter(e.target.checked)}
            />
            Open folder after processing
          </label>
        </div>
      }
    />
  )
}
