import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type CompressionLevel = 'low' | 'medium' | 'high'

interface CompressionInfo {
  level: CompressionLevel
  label: string
  quality: number // 0-100 for image quality
  description: string
}

const COMPRESSION_LEVELS: CompressionInfo[] = [
  {
    level: 'low',
    label: 'Low',
    quality: 85,
    description: 'Minimal compression, best quality. Reduces ~10-20%.',
  },
  {
    level: 'medium',
    label: 'Medium',
    quality: 65,
    description: 'Balanced compression. Reduces ~30-50%.',
  },
  {
    level: 'high',
    label: 'High',
    quality: 40,
    description: 'Maximum compression, visible quality loss. Reduces ~60-80%.',
  },
]

type CompressPdfToolProps = {
  tool: ToolDefinition
}

export function CompressPdfTool({ tool }: CompressPdfToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [level, setLevel] = useState<CompressionLevel>('medium')
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const selectedLevel = COMPRESSION_LEVELS.find((l) => l.level === level)!

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

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(10)

        const result = await window.api.compressPdf({
          inputPaths,
          outputDir,
          level,
        })

        context.setProgress(90)
        context.setResult(
          <Card className='space-y-3'>
            <div className='flex items-center gap-2'>
              <Badge className='border-0 bg-accent/15 text-accent'>Success</Badge>
              <span className='text-sm text-muted'>Compression complete</span>
            </div>
            <div className='space-y-1 text-sm text-muted'>
              <div>Level: {selectedLevel.label} (quality: {selectedLevel.quality}%)</div>
              <div>Processed {result.inputCount} file{result.inputCount === 1 ? '' : 's'}.</div>
              {result.averageReduction && (
                <div>Average size reduction: {result.averageReduction.toFixed(1)}%</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Compression Level</div>
            <div className='space-y-2'>
              {COMPRESSION_LEVELS.map((lvl) => (
                <div
                  key={lvl.level}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                    level === lvl.level
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-base/60 hover:border-accent/50'
                  }`}
                  onClick={() => setLevel(lvl.level)}
                >
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border-2 ${
                      level === lvl.level
                        ? 'border-accent bg-accent'
                        : 'border-border'
                    }`}
                  >
                    {level === lvl.level && (
                      <div className='flex h-full items-center justify-center'>
                        <div className='h-1.5 w-1.5 rounded-full bg-white' />
                      </div>
                    )}
                  </div>
                  <div className='flex-1'>
                    <div className='font-medium text-text'>{lvl.label}</div>
                    <div className='text-xs text-muted'>{lvl.description}</div>
                  </div>
                </div>
              ))}
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

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-xs text-muted'>Open folder after compression</span>
              <input
                type='checkbox'
                checked={openAfter}
                onChange={(e) => setOpenAfter(e.target.checked)}
                className='h-4 w-4 rounded border-border accent-accent'
              />
            </div>
          </div>

          <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
            <div className='font-medium mb-1'>How it works</div>
            <div>
              This tool re-encodes images within the PDF at a lower quality setting and
              optimizes the document structure. Higher compression levels use lower image
              quality to achieve smaller file sizes.
            </div>
          </div>
        </div>
      }
    />
  )
}
