import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type ImageWatermarkToolProps = {
  tool: ToolDefinition
}

export function ImageWatermarkTool({ tool }: ImageWatermarkToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [wmType, setWmType] = useState<'text' | 'image'>('text')
  const [wmText, setWmText] = useState('© DocFlow Pro')
  const [wmImagePath, setWmImagePath] = useState<string | null>(null)
  const [wmFileName, setWmFileName] = useState<string>('')
  const [position, setPosition] = useState('center')
  const [rotation, setRotation] = useState(-30)
  const [opacity, setOpacity] = useState(40)
  const [size, setSize] = useState(120)
  const [color, setColor] = useState('#ffffff')
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const handleSelectWatermarkImage = async () => {
    const selected = await window.api.selectFile({
      title: 'Select watermark image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (selected) {
      setWmImagePath(selected)
      setWmFileName(selected.split(/[/\\]/).pop() || 'watermark.png')
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='image/*'
      onProcess={async (files, context) => {
        if (!window.api?.watermarkImages) {
          throw new Error('The image watermark engine is not available in this build.')
        }

        const inputPaths = files.map((file) => file.path).filter(Boolean) as string[]
        if (inputPaths.length !== files.length) {
          throw new Error('Some files are missing paths. Remove and re-add them.')
        }

        if (wmType === 'image' && !wmImagePath) {
          throw new Error('Please select a watermark image.')
        }
        if (wmType === 'text' && !wmText.trim()) {
          throw new Error('Please enter watermark text.')
        }

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(15)
        const result = await window.api.watermarkImages({
          inputPaths,
          outputDir,
          type: wmType,
          text: wmType === 'text' ? wmText : undefined,
          imagePath: wmType === 'image' ? wmImagePath || undefined : undefined,
          opacity: opacity / 100,
          rotation,
          size,
          position,
          color: wmType === 'text' ? color : undefined,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Watermarking complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Watermarked {result.totalOutputs} file(s).</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Watermark Type</div>
            <div className='flex gap-2'>
              <Button
                variant={wmType === 'text' ? 'primary' : 'outline'}
                onClick={() => setWmType('text')}
                className='flex-1 text-xs'
              >
                Text
              </Button>
              <Button
                variant={wmType === 'image' ? 'primary' : 'outline'}
                onClick={() => setWmType('image')}
                className='flex-1 text-xs'
              >
                Image
              </Button>
            </div>
          </div>

          {wmType === 'text' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Watermark Text</div>
              <input
                type='text'
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                className='w-full rounded-xl border border-border bg-base/60 px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent/60'
                placeholder='© Your watermark'
              />
              <div className='flex items-center gap-3'>
                <div className='flex-1 space-y-1'>
                  <div className='text-xs text-muted'>Color</div>
                  <div className='flex items-center gap-2'>
                    <input
                      type='color'
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className='h-8 w-8 cursor-pointer rounded border border-border bg-transparent'
                    />
                    <span className='text-xs text-muted font-mono'>{color}</span>
                  </div>
                </div>
                <div className='flex-1 space-y-1'>
                  <div className='text-xs font-semibold uppercase text-muted'>Font Size</div>
                  <Select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                    {[24, 32, 48, 64, 80, 96, 120, 160, 200].map((v) => (
                      <option key={v} value={v}>{v}px</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Watermark Image</div>
              {wmFileName ? (
                <div className='flex items-center gap-2 rounded-xl border border-border bg-base/60 p-3'>
                  <span className='text-xs text-foreground'>{wmFileName}</span>
                  <Button variant='outline' onClick={handleSelectWatermarkImage} className='text-xs ml-auto'>
                    Change
                  </Button>
                </div>
              ) : (
                <Button variant='outline' onClick={handleSelectWatermarkImage} className='w-full'>
                  Select Image…
                </Button>
              )}
              <div className='space-y-1'>
                <div className='text-xs text-muted'>Max Width</div>
                <Select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                  {[32, 48, 64, 96, 128, 192, 256, 384, 512].map((v) => (
                    <option key={v} value={v}>{v}px</option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Position</div>
            <Select value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value='top-left'>Top Left</option>
              <option value='top-center'>Top Center</option>
              <option value='top-right'>Top Right</option>
              <option value='center-left'>Center Left</option>
              <option value='center'>Center</option>
              <option value='center-right'>Center Right</option>
              <option value='bottom-left'>Bottom Left</option>
              <option value='bottom-center'>Bottom Center</option>
              <option value='bottom-right'>Bottom Right</option>
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Rotation: {rotation}°</div>
            <input
              type='range'
              min={-180}
              max={180}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className='w-full accent-accent'
            />
            <div className='flex justify-between text-xs text-muted'>
              <span>-180°</span>
              <span>0°</span>
              <span>+180°</span>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Opacity: {opacity}%</div>
            <input
              type='range'
              min={5}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className='w-full accent-accent'
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
