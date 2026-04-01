import { useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type ChecksumToolProps = {
  tool: ToolDefinition
}

export function ChecksumTool({ tool }: ChecksumToolProps) {
  const [algorithm, setAlgorithm] = useState<'md5' | 'sha1' | 'sha256'>('sha256')
  const [compare, setCompare] = useState('')

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (files, context) => {
        if (!window.api?.checksumFiles) {
          throw new Error('The checksum engine is not available in this build.')
        }

        const inputPaths = files.map((file) => file.path).filter(Boolean) as string[]
        if (inputPaths.length !== files.length) {
          throw new Error('Some files are missing paths. Remove and re-add them.')
        }

        context.setProgress(10)
        const result = await window.api.checksumFiles({ inputPaths, algorithm })

        context.setProgress(90)
        context.setResult(
          <div className='space-y-3 text-sm text-muted'>
            {result.items.map((item) => {
              const hash = item[algorithm]
              const match = compare ? hash.toLowerCase() === compare.trim().toLowerCase() : null
              return (
                <div key={item.path} className='rounded-xl border border-border bg-base/60 p-3'>
                  <div className='text-xs text-muted'>{item.path}</div>
                  <div className='mt-1 text-sm text-text'>{hash}</div>
                  {match !== null ? (
                    <div className={match ? 'text-green-400' : 'text-red-300'}>
                      {match ? 'Match' : 'Mismatch'}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>,
        )
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Algorithm</div>
            <Select
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value as typeof algorithm)}
            >
              <option value='md5'>MD5</option>
              <option value='sha1'>SHA-1</option>
              <option value='sha256'>SHA-256</option>
            </Select>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Compare Hash</div>
            <Input
              value={compare}
              onChange={(event) => setCompare(event.target.value)}
              placeholder='Paste hash to compare'
            />
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline verification</Badge>
        </div>
      }
    />
  )
}
