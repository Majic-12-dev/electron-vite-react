import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/useAppStore'

type TextMergeToolProps = {
  tool: ToolDefinition
}

const separators = [
  { label: 'Single newline', value: '\n' },
  { label: 'Double newline', value: '\n\n' },
  { label: 'CSV row break', value: '\r\n' },
  { label: 'Custom', value: 'custom' },
]

export function TextMergeTool({ tool }: TextMergeToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [outputName, setOutputName] = useState('merged.txt')
  const [separatorChoice, setSeparatorChoice] = useState('\n\n')
  const [customSeparator, setCustomSeparator] = useState('\n\n')
  const [includeHeader, setIncludeHeader] = useState(true)
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const separator =
    separatorChoice === 'custom' ? customSeparator : separatorChoice || '\n'

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='.txt,.csv,.log,text/plain,text/csv'
      reorderable
      onProcess={async (files, context) => {
        if (!window.api?.mergeTextFiles) {
          throw new Error('The text merge engine is not available in this build.')
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
        const result = await window.api.mergeTextFiles({
          inputPaths,
          outputDir,
          outputName: outputName.trim() || 'merged.txt',
          separator,
          includeHeader,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Merge complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Combined {result.sourceCount} file(s).</div>
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
            <div className='text-xs font-semibold uppercase text-muted'>Output Name</div>
            <Input value={outputName} onChange={(event) => setOutputName(event.target.value)} />
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Separator</div>
            <Select
              value={separatorChoice}
              onChange={(event) => setSeparatorChoice(event.target.value)}
            >
              {separators.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            {separatorChoice === 'custom' ? (
              <Input
                value={customSeparator}
                onChange={(event) => setCustomSeparator(event.target.value)}
                placeholder='Enter custom separator'
              />
            ) : null}
          </div>
          <Switch
            checked={includeHeader}
            onChange={(event) => setIncludeHeader(event.target.checked)}
            label='Include filename headers'
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
