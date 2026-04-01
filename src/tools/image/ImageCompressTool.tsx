import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type ImageCompressToolProps = {
  tool: ToolDefinition
}

export function ImageCompressTool({ tool }: ImageCompressToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [quality, setQuality] = useState(80)
  const [format, setFormat] = useState<'auto' | 'jpg' | 'png' | 'webp'>('auto')
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
      accept='image/*'
      onProcess={async (files, context) => {
        if (!window.api?.compressImages) {
          throw new Error('The image compression engine is not available in this build.')
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
        const result = await window.api.compressImages({
          inputPaths,
          outputDir,
          quality,
          format,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Compression complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Compressed {result.totalOutputs} file(s).</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Quality</div>
            <Select value={quality} onChange={(event) => setQuality(Number(event.target.value))}>
              {[95, 90, 85, 80, 70, 60, 50].map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </Select>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Format</div>
            <Select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
              <option value='auto'>Same as input</option>
              <option value='jpg'>JPG</option>
              <option value='png'>PNG</option>
              <option value='webp'>WEBP</option>
            </Select>
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
              onChange={(event) => setOpenAfter(event.target.checked)}
            />
            Open folder after processing
          </label>
        </div>
      }
    />
  )
}
