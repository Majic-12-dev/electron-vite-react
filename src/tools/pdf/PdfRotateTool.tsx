import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type PdfRotateToolProps = {
  tool: ToolDefinition
}

export function PdfRotateTool({ tool }: PdfRotateToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [rotation, setRotation] = useState(90)
  const [applyTo, setApplyTo] = useState<'all' | 'ranges'>('all')
  const [ranges, setRanges] = useState('1-2')
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
      accept='.pdf,application/pdf'
      onProcess={async (files, context) => {
        if (!window.api?.rotatePdf) {
          throw new Error('The PDF rotation engine is not available in this build.')
        }

        if (applyTo === 'ranges' && !ranges.trim()) {
          throw new Error('Enter page ranges to rotate.')
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
        const result = await window.api.rotatePdf({
          inputPaths,
          outputDir,
          rotation,
          ranges: applyTo === 'ranges' ? ranges.trim() : null,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Rotation complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Processed {result.totalOutputs} file(s).</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Rotation</div>
            <Select
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
            >
              <option value={90}>Rotate 90° clockwise</option>
              <option value={180}>Rotate 180°</option>
              <option value={270}>Rotate 270° clockwise</option>
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Apply To</div>
            <Select
              value={applyTo}
              onChange={(event) => setApplyTo(event.target.value as typeof applyTo)}
            >
              <option value='all'>All pages</option>
              <option value='ranges'>Specific pages</option>
            </Select>
          </div>

          {applyTo === 'ranges' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Page Ranges</div>
              <Input
                value={ranges}
                onChange={(event) => setRanges(event.target.value)}
                placeholder='Example: 1-2,5'
              />
            </div>
          ) : null}

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
              onChange={(event) => setOpenAfter(event.target.checked)}
            />
            Open folder after processing
          </label>
        </div>
      }
    />
  )
}
