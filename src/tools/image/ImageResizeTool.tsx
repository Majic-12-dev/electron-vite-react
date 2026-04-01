import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/useAppStore'

type ImageResizeToolProps = {
  tool: ToolDefinition
}

export function ImageResizeTool({ tool }: ImageResizeToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [mode, setMode] = useState<'percent' | 'width' | 'height' | 'fit'>('percent')
  const [percent, setPercent] = useState(50)
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [sharpen, setSharpen] = useState(true)
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
        if (!window.api?.resizeImages) {
          throw new Error('The image resize engine is not available in this build.')
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
        const result = await window.api.resizeImages({
          inputPaths,
          outputDir,
          mode,
          percent,
          width,
          height,
          sharpen,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Resize complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Resized {result.totalOutputs} file(s).</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Resize Mode</div>
            <Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value='percent'>By Percentage</option>
              <option value='width'>By Width</option>
              <option value='height'>By Height</option>
              <option value='fit'>Fit Inside Box</option>
            </Select>
          </div>

          {mode === 'percent' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Percentage</div>
              <Input
                type='number'
                min={1}
                max={400}
                value={percent}
                onChange={(event) => setPercent(Number(event.target.value))}
              />
            </div>
          ) : null}

          {mode === 'width' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Width (px)</div>
              <Input
                type='number'
                min={1}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
              />
            </div>
          ) : null}

          {mode === 'height' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Height (px)</div>
              <Input
                type='number'
                min={1}
                value={height}
                onChange={(event) => setHeight(Number(event.target.value))}
              />
            </div>
          ) : null}

          {mode === 'fit' ? (
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <div className='text-xs font-semibold uppercase text-muted'>Width (px)</div>
                <Input
                  type='number'
                  min={1}
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                />
              </div>
              <div className='space-y-2'>
                <div className='text-xs font-semibold uppercase text-muted'>Height (px)</div>
                <Input
                  type='number'
                  min={1}
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
              </div>
            </div>
          ) : null}

          <Switch
            checked={sharpen}
            onChange={(event) => setSharpen(event.target.checked)}
            label='Smart sharpening'
          />

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
