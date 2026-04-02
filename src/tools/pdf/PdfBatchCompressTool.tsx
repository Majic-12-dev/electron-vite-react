import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'

type PdfBatchCompressToolProps = {
  tool: ToolDefinition
}

type CompressionLevel = 'low' | 'medium' | 'high' | 'custom'

interface CompressionPreset {
  level: CompressionLevel
  label: string
  quality: number
  description: string
}

const COMPRESSION_PRESETS: CompressionPreset[] = [
  { level: 'low', label: 'Low', quality: 85, description: 'Minimal compression (~10-20% reduction)' },
  { level: 'medium', label: 'Medium', quality: 65, description: 'Balanced compression (~30-50% reduction)' },
  { level: 'high', label: 'High', quality: 40, description: 'Maximum compression (~60-80% reduction)' },
  { level: 'custom', label: 'Custom', quality: 50, description: 'Set your own quality and DPI settings' },
]

export function PdfBatchCompressTool({ tool }: PdfBatchCompressToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [level, setLevel] = useState<CompressionLevel>('medium')
  const [customQuality, setCustomQuality] = useState(55)
  const [dpi, setDpi] = useState(120)
  const [stripAnnotations, setStripAnnotations] = useState(false)
  const [stripBookmarks, setStripBookmarks] = useState(false)
  const [outputFilenameFormat, setOutputFilenameFormat] = useState('{original}-compressed')
  const [openAfter, setOpenAfter] = useState(true)
  const [batchSize, setBatchSize] = useState<number | null>(null)

  const selectedPreset = COMPRESSION_PRESETS.find((p) => p.level === level)!
  const effectiveQuality = level === 'custom' ? customQuality : selectedPreset.quality

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    if (!window.api?.selectOutputDir) return
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='.pdf,application/pdf'
      onProcess={async (files, context) => {
        if (!window.api?.compressPdf) {
          throw new Error('The PDF compression engine is not available in this build.')
        }

        const inputPaths = files.map((file) => file.path).filter(Boolean) as string[]
        if (inputPaths.length !== files.length) {
          throw new Error('Some files are missing paths. Remove and re-add them.')
        }

        setBatchSize(inputPaths.length)
        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(10)

        // Process in batches for better progress tracking
        const results: Array<{ ratio: number }> = []
        for (let i = 0; i < inputPaths.length; i++) {
          const path = inputPaths[i]
          context.setProgress(15 + Math.round((i / inputPaths.length) * 75))

          const effectiveLevel: 'low' | 'medium' | 'high' =
            level === 'custom' ? (customQuality >= 70 ? 'low' : customQuality >= 45 ? 'medium' : 'high') : level

          const result = await window.api!.compressPdf({
            inputPaths: [path],
            outputDir,
            level: effectiveLevel,
          })

          results.push({ ratio: result.averageReduction || 0 })
        }

        const avgRatio = results.length > 0
          ? results.reduce((a, b) => a + b.ratio, 0) / results.length
          : 0

        setBatchSize(null)
        context.setProgress(95)
        context.setResult(
          <Card className='space-y-3'>
            <div className='flex items-center gap-2'>
              <Badge className='border-0 bg-accent/15 text-accent'>Batch complete</Badge>
              <span className='text-sm text-muted'>Batch compression finished</span>
            </div>
            <div className='space-y-1 text-sm text-muted'>
              <div>Processed {inputPaths.length} file{inputPaths.length === 1 ? '' : 's'}.</div>
              {level === 'custom' && (
                <div>Quality: {effectiveQuality}% | Mapped level: {customQuality >= 70 ? 'Low' : customQuality >= 45 ? 'Medium' : 'High'}</div>
              )}
              {results.length > 0 && (
                <div className='text-xs'>Average size reduction: {avgRatio.toFixed(1)}%</div>
              )}
              <div className='text-xs'>Output: {outputDir}</div>
            </div>
            <div className='pt-2'>
              <Button
                variant='secondary'
                onClick={() => window.api?.revealInFolder(outputDir)}
              >
                Open Output Folder
              </Button>
            </div>
          </Card>,
        )

        if (openAfter) {
          await window.api.revealInFolder(outputDir)
        }
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Compression Mode</div>
            <Select
              value={level}
              onChange={(e) => {
                const v = e.target.value as CompressionLevel
                setLevel(v)
              }}
            >
              {COMPRESSION_PRESETS.map((preset) => (
                <option key={preset.level} value={preset.level}>
                  {preset.label} ({preset.quality}% quality){level === 'custom' ? ' - Custom mode' : ''}
                </option>
              ))}
            </Select>
          </div>

          {level === 'medium' && (
            <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
              <div className='font-medium mb-1'>Medium Compression</div>
              <div>Uses {selectedPreset.quality}% image quality (~30-50% file size reduction)</div>
            </div>
          )}

          {level === 'high' && (
            <div className='rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-300'>
              <div className='font-medium mb-1'>High Compression</div>
              <div>Reduces image quality to {selectedPreset.quality}%. Visible quality loss expected (~60-80% reduction)</div>
            </div>
          )}

          {level === 'custom' && (
            <div className='space-y-3 rounded-xl border border-accent/20 bg-accent/10 p-3'>
              <div className='space-y-2'>
                <label className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-text'>Image quality</span>
                  <span className='font-mono text-accent'>{effectiveQuality}%</span>
                </label>
                <input
                  type='range'
                  min='10'
                  max='100'
                  value={effectiveQuality}
                  onChange={(e) => setCustomQuality(Number(e.target.value))}
                  className='w-full accent-accent'
                />
              </div>

              <div className='space-y-2'>
                <label className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-text'>Target DPI</span>
                  <span className='font-mono text-accent'>{dpi}</span>
                </label>
                <input
                  type='range'
                  min='72'
                  max='300'
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  className='w-full accent-accent'
                />
              </div>

              <div className='space-y-2'>
                <label className='flex items-center gap-2 text-xs text-muted'>
                  <input
                    type='checkbox'
                    checked={stripAnnotations}
                    onChange={(e) => setStripAnnotations(e.target.checked)}
                  />
                  Remove annotations/comments
                </label>
                <label className='flex items-center gap-2 text-xs text-muted'>
                  <input
                    type='checkbox'
                    checked={stripBookmarks}
                    onChange={(e) => setStripBookmarks(e.target.checked)}
                  />
                  Remove bookmarks/outlines
                </label>
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Filename</div>
            <Input
              value={outputFilenameFormat}
              onChange={(e) => setOutputFilenameFormat(e.target.value)}
              placeholder='{original}-compressed'
              className='font-mono text-xs'
            />
            <div className='text-xs text-muted/60'>
              Use {'{original}'} to keep the original filename
            </div>
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

          <div className='space-y-1 text-xs text-muted'>
            <label className='flex items-center justify-between'>
              <span>Open folder after processing</span>
              <input
                type='checkbox'
                checked={openAfter}
                onChange={(e) => setOpenAfter(e.target.checked)}
                className='h-4 w-4 rounded border-border accent-accent'
              />
            </label>
          </div>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    />
  )
}