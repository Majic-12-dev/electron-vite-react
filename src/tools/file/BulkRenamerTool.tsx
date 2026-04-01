import { useEffect, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/useAppStore'

type BulkRenamerToolProps = {
  tool: ToolDefinition
}

type CaseType = 'none' | 'lower' | 'upper' | 'title'

export function BulkRenamerTool({ tool }: BulkRenamerToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)
  const [addSequence, setAddSequence] = useState(true)
  const [caseType, setCaseType] = useState<CaseType>('none')
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const buildTargetName = (file: ToolFile, index: number) => {
    const { base, ext } = splitName(file.name)
    let nextBase = base

    if (find) {
      if (useRegex) {
        try {
          const regex = new RegExp(find, 'g')
          nextBase = nextBase.replace(regex, replace)
        } catch {
          // Ignore invalid regex and keep original base.
        }
      } else {
        nextBase = nextBase.split(find).join(replace)
      }
    }

    nextBase = applyCase(nextBase, caseType)

    const sequence = addSequence ? formatSequence(startNumber + index, padding) : ''
    const stitched = `${prefix}${nextBase}${suffix}${sequence ? `_${sequence}` : ''}`

    return `${stitched}${ext}`
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (files, context) => {
        if (!window.api?.bulkRename) {
          throw new Error('The rename engine is not available in this build.')
        }

        const items = files
          .map((file, index) => ({
            sourcePath: file.path,
            targetName: buildTargetName(file, index),
          }))
          .filter((item) => item.sourcePath)

        if (items.length !== files.length) {
          throw new Error('Some files are missing paths. Remove and re-add them.')
        }

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(15)
        const result = await window.api.bulkRename({
          outputDir,
          items: items as { sourcePath: string; targetName: string }[],
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Rename complete</Badge>
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
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Prefix</div>
              <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
            </div>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Suffix</div>
              <Input value={suffix} onChange={(event) => setSuffix(event.target.value)} />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Find</div>
              <Input value={find} onChange={(event) => setFind(event.target.value)} />
            </div>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Replace</div>
              <Input value={replace} onChange={(event) => setReplace(event.target.value)} />
            </div>
          </div>

          <Switch
            checked={useRegex}
            onChange={(event) => setUseRegex(event.target.checked)}
            label='Use regex for find/replace'
          />

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Start Number</div>
              <Input
                type='number'
                min={0}
                value={startNumber}
                onChange={(event) => setStartNumber(Number(event.target.value))}
              />
            </div>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Padding</div>
              <Input
                type='number'
                min={1}
                max={6}
                value={padding}
                onChange={(event) => setPadding(Number(event.target.value))}
              />
            </div>
          </div>

          <Switch
            checked={addSequence}
            onChange={(event) => setAddSequence(event.target.checked)}
            label='Append sequence number'
          />

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Case</div>
            <Select value={caseType} onChange={(event) => setCaseType(event.target.value as CaseType)}>
              <option value='none'>Keep original</option>
              <option value='lower'>lowercase</option>
              <option value='upper'>UPPERCASE</option>
              <option value='title'>Title Case</option>
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

          <PreviewList buildTargetName={buildTargetName} />
        </div>
      }
    />
  )
}

function PreviewList({ buildTargetName }: { buildTargetName: (file: ToolFile, index: number) => string }) {
  return (
    <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
      Preview updates when files are added to the queue.
      <PreviewContent buildTargetName={buildTargetName} />
    </div>
  )
}

function PreviewContent({ buildTargetName }: { buildTargetName: (file: ToolFile, index: number) => string }) {
  const [files, setFiles] = useState<ToolFile[]>([])

  useEffect(() => {
    const handler = (event: CustomEvent<ToolFile[]>) => {
      setFiles(event.detail)
    }
    window.addEventListener('docflow:files', handler as EventListener)
    return () => window.removeEventListener('docflow:files', handler as EventListener)
  }, [])

  if (!files.length) {
    return <div className='mt-2 text-xs text-muted'>Add files to see preview names.</div>
  }

  return (
    <div className='mt-2 max-h-40 space-y-1 overflow-y-auto text-xs'>
      {files.map((file, index) => (
        <div key={file.id} className='flex items-center justify-between gap-2'>
          <span className='truncate'>{file.name}</span>
          <span className='text-text'>{buildTargetName(file, index)}</span>
        </div>
      ))}
    </div>
  )
}

function splitName(filename: string) {
  const dot = filename.lastIndexOf('.')
  if (dot > 0) {
    return { base: filename.slice(0, dot), ext: filename.slice(dot) }
  }
  return { base: filename, ext: '' }
}

function applyCase(value: string, caseType: CaseType) {
  switch (caseType) {
    case 'lower':
      return value.toLowerCase()
    case 'upper':
      return value.toUpperCase()
    case 'title':
      return value
        .split(' ')
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
        .join(' ')
    default:
      return value
  }
}

function formatSequence(value: number, padding: number) {
  const digits = Math.max(padding, 1)
  return value.toString().padStart(digits, '0')
}
