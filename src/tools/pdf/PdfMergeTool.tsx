import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/useAppStore'

type PdfMergeToolProps = {
  tool: ToolDefinition
}

export function PdfMergeTool({ tool }: PdfMergeToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [outputName, setOutputName] = useState('merged.pdf')
  const [openAfter, setOpenAfter] = useState(true)

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
      reorderable
      onProcess={async (files, context) => {
        if (!window.api?.mergePdf) {
          throw new Error('The PDF engine is not available in this build.')
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

        const sanitizedName = outputName.trim() || 'merged.pdf'

        context.setProgress(15)
        const result = await window.api.mergePdf({
          inputPaths,
          outputDir,
          outputName: sanitizedName,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Success</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Merged {result.pageCount} pages.</div>
              <div className='text-xs text-muted'>Output: {result.outputPath}</div>
              <div className='pt-2'>
                <Button
                  variant='secondary'
                  onClick={() => window.api.revealInFolder(result.outputPath)}
                >
                  Open Output Folder
                </Button>
              </div>
            </div>
          </>,
        )

        if (openAfter) {
          await window.api.revealInFolder(result.outputPath)
        }
      }}
      options={
        <div className='space-y-4 text-sm'>
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
            <div className='text-xs font-semibold uppercase text-muted'>Output Name</div>
            <Input value={outputName} onChange={(event) => setOutputName(event.target.value)} />
          </div>

          <div className='space-y-2'>
            <Switch
              checked={openAfter}
              onChange={(event) => setOpenAfter(event.target.checked)}
              label='Open folder after merge'
            />
          </div>

          <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
            Drag to reorder files in the queue before merging.
          </div>
        </div>
      }
    />
  )
}
