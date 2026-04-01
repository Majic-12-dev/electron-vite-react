import { useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAppStore } from '@/store/useAppStore'

type ArchiveZipToolProps = {
  tool: ToolDefinition
}

export function ArchiveZipTool({ tool }: ArchiveZipToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [mode, setMode] = useState<'zip' | 'unzip'>('zip')
  const [outputPath, setOutputPath] = useState(preferences.defaultOutputDir || '')

  const handleChooseOutput = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) {
      setOutputPath(selected)
      setDefaultOutputDir(selected)
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (files, context) => {
        const sources = files.map((f) => f.path).filter((p): p is string => !!p)
        if (sources.length === 0) throw new Error('No files selected.')
        
        const path = outputPath || (await window.api.getDefaultOutputDir())
        if (!outputPath) setOutputPath(path)
        
        context.setProgress(15)
        const result = await window.api.processArchive({
          mode,
          sources,
          outputPath: path,
        })
        
        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Processing complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>{mode === 'zip' ? 'Archived' : 'Extracted'} {result.count} item(s).</div>
              <div className='text-xs text-muted'>Output: {result.outputPath}</div>
              <div className='pt-2'>
                <Button variant='secondary' onClick={() => window.api.revealInFolder(result.outputPath)}>
                  Open Output
                </Button>
              </div>
            </div>
          </>,
        )
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Mode</div>
            <div className='grid grid-cols-2 gap-2'>
              <Button
                variant={mode === 'zip' ? 'primary' : 'secondary'}
                onClick={() => setMode('zip')}
              >
                Zip
              </Button>
              <Button
                variant={mode === 'unzip' ? 'primary' : 'secondary'}
                onClick={() => setMode('unzip')}
              >
                Unzip
              </Button>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Folder</div>
            <Input
              value={outputPath}
              readOnly
              placeholder='Select output folder...'
              onClick={handleChooseOutput}
              className='cursor-pointer'
            />
            <Button variant='outline' className='w-full' onClick={handleChooseOutput}>
              Change Folder
            </Button>
          </div>
        </div>
      }
    />
  )
}
