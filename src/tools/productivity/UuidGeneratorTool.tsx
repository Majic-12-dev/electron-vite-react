import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, RefreshCw, Hash, List, Settings2, BarChart } from 'lucide-react'

type UuidGeneratorToolProps = {
  tool: ToolDefinition
}

type UuidVersion = 'v4' | 'v7'

function generateBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return bytes
}

function generateV4(): string {
  const b = generateBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}

function generateV7(): string {
  const now = Date.now()
  const unixTsMs = now * 1000 // to microseconds for UUIDv7
  // Simple UUIDv7 approximation using timestamp + random
  const b = generateBytes(16)
  // Set timestamp (48 bits) - use current ms timestamp
  const tsBytes = new ArrayBuffer(8)
  const view = new DataView(tsBytes)
  view.setBigUint64(0, BigInt(now), false)
  
  b[0] = (now / 0x10000000000) & 0xff
  b[1] = (now / 0x100000000) & 0xff
  b[2] = (now / 0x1000000) & 0xff
  b[3] = (now / 0x10000) & 0xff
  b[4] = (now / 0x100) & 0xff
  b[5] = now & 0xff
  
  // Set version to 7
  b[6] = (b[6] & 0x0f) | 0x70
  // Set variant to RFC 4122
  b[8] = (b[8] & 0x3f) | 0x80
  
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}

export function UuidGeneratorTool({ tool }: UuidGeneratorToolProps) {
  const [version, setVersion] = useState<UuidVersion>('v4')
  const [count, setCount] = useState(5)
  const [uppercase, setUppercase] = useState(false)
  const [stripHyphens, setStripHyphens] = useState(false)
  const [uuids, setUuids] = useState<string[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const handleGenerate = useCallback(() => {
    const gen = version === 'v4' ? generateV4 : generateV7
    const results = Array.from({ length: count }, gen)
    setUuids(results.map(u => {
      let r = u
      if (stripHyphens) r = r.replace(/-/g, '')
      if (uppercase) r = r.toUpperCase()
      return r
    }))
  }, [count, version, uppercase, stripHyphens])

  const handleCopyAll = useCallback(() => {
    if (uuids.length === 0) return
    navigator.clipboard.writeText(uuids.join('\n')).then(() => {
      setCopiedIdx(-1)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }, [uuids])

  const handleCopyOne = useCallback((uuid: string, idx: number) => {
    navigator.clipboard.writeText(uuid).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Version</div>
            <div className='flex gap-2'>
              {[
                { v: 'v4' as UuidVersion, label: 'Random (v4)' },
                { v: 'v7' as UuidVersion, label: 'Time-sorted (v7)' },
              ].map(opt => (
                <button
                  key={opt.v}
                  type='button'
                  onClick={() => setVersion(opt.v)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                    ${version === opt.v ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Count</div>
            <div className='flex items-center gap-2'>
              <Button variant='ghost' className='h-8 w-8 rounded-lg' onClick={() => setCount(Math.max(1, count - 1))}>−</Button>
              <input
                type='number'
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-center text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              />
              <Button variant='ghost' className='h-8 w-8 rounded-lg' onClick={() => setCount(Math.min(50, count + 1))}>+</Button>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Formatting</div>
            <label className='flex items-center gap-2 text-xs text-muted cursor-pointer'>
              <input type='checkbox' checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} className='rounded border-border accent-accent' />
              UPPERCASE
            </label>
            <label className='flex items-center gap-2 text-xs text-muted cursor-pointer'>
              <input type='checkbox' checked={stripHyphens} onChange={(e) => setStripHyphens(e.target.checked)} className='rounded border-border accent-accent' />
              No hyphens
            </label>
          </div>

          <Button onClick={handleGenerate} className='w-full'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Generate
          </Button>

          {uuids.length > 0 && (
            <div className='flex items-center justify-between text-xs text-muted'>
              <span>{uuids.length} UUIDs</span>
              <BarChart className='h-3.5 w-3.5 text-accent' />
            </div>
          )}

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      {uuids.length > 0 && (
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
              <List className='h-3.5 w-3.5' />
              Generated UUIDs
            </div>
            <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopyAll}>
              {copiedIdx === -1 ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <Copy className='mr-1 h-3 w-3' />}
              Copy All
            </Button>
          </div>

          <Card className='divide-y divide-border'>
            {uuids.map((uuid, i) => (
              <div key={i} className='flex items-center justify-between py-2 first:pt-0 last:pb-0'>
                <code className='font-mono text-sm text-text break-all'>{uuid}</code>
                <Button variant='ghost' className='h-6 w-6 flex-shrink-0' onClick={() => handleCopyOne(uuid, i)}>
                  {copiedIdx === i ? <CheckCircle className='h-3 w-3 text-green-400' /> : <Copy className='h-3 w-3' />}
                </Button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </BaseToolLayout>
  )
}
