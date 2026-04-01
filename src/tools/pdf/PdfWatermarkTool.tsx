import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type PdfWatermarkToolProps = {
  tool: ToolDefinition
}

const positions = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top', label: 'Top' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

export function PdfWatermarkTool({ tool }: PdfWatermarkToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [type, setType] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [imagePath, setImagePath] = useState('')
  const [opacity, setOpacity] = useState(0.2)
  const [rotation, setRotation] = useState(30)
  const [size, setSize] = useState(48)
  const [position, setPosition] = useState('center')
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const handleChooseImage = async () => {
    if (!window.api?.selectFile) return
    const selected = await window.api.selectFile({
      title: 'Select watermark image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (selected) setImagePath(selected)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='.pdf,application/pdf'
      onProcess={async (files, context) => {
        if (!window.api?.watermarkPdf) {
          throw new Error('The PDF watermark engine is not available in this build.')
        }

        if (type === 'text' && !text.trim()) {
          throw new Error('Enter watermark text to continue.')
        }

        if (type === 'image' && !imagePath) {
          throw new Error('Select an image watermark to continue.')
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
        const result = await window.api.watermarkPdf({
          inputPaths,
          outputDir,
          type,
          text: text.trim(),
          imagePath,
          opacity,
          rotation,
          size,
          position,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Watermark applied</Badge>
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
            <div className='text-xs font-semibold uppercase text-muted'>Watermark Type</div>
            <Select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              <option value='text'>Text</option>
              <option value='image'>Image</option>
            </Select>
          </div>

          {type === 'text' ? (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Text</div>
              <Input value={text} onChange={(event) => setText(event.target.value)} />
            </div>
          ) : (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Image</div>
              <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
                {imagePath || 'No image selected'}
              </div>
              <Button variant='outline' onClick={handleChooseImage}>
                Choose Watermark Image
              </Button>
            </div>
          )}

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Position</div>
            <Select value={position} onChange={(event) => setPosition(event.target.value)}>
              {positions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>
                {type === 'text' ? 'Font Size' : 'Scale %'}
              </div>
              <Input
                type='number'
                min={type === 'text' ? 8 : 5}
                max={type === 'text' ? 144 : 100}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </div>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Opacity</div>
              <Input
                type='number'
                min={0.05}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Rotation</div>
            <Input
              type='number'
              min={-180}
              max={180}
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
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
              onChange={(event) => setOpenAfter(event.target.checked)}
            />
            Open folder after processing
          </label>
        </div>
      }
    />
  )
}
