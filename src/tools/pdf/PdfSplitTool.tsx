import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type PdfSplitToolProps = {
  tool: ToolDefinition
}

export function PdfSplitTool({ tool }: PdfSplitToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [mode, setMode] = useState<'ranges' | 'extract' | 'remove'>('ranges')
  const [ranges, setRanges] = useState('1-3,5')
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
        if (!window.api?.splitPdf) {
          throw new Error('The PDF split engine is not available in this build.')
        }

        if (mode !== 'extract' && !ranges.trim()) {
          throw new Error('Enter page ranges to continue.')
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
        const result = await window.api.splitPdf({
          inputPaths,
          outputDir,
          mode,
          ranges: ranges.trim(),
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Split complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Created {result.totalOutputs} file(s).</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Split Mode</div>
            <Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value='ranges'>Split by page ranges</option>
              <option value='extract'>Extract every page</option>
              <option value='remove'>Remove specific pages</option>
            </Select>
          </div>

          {mode !== 'extract' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Ranges</div>
              <Input
                value={ranges}
                onChange={(event) => setRanges(event.target.value)}
                placeholder='Example: 1-3,5,8-10'
              />
              <p className='text-xs text-muted'>
                Use commas to separate ranges. Pages are 1-indexed.
              </p>
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
