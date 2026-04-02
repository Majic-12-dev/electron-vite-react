import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, Diff, AlertTriangle, XCircle, GitCompare } from 'lucide-react'

type ToolProps = { tool: ToolDefinition }

type DiffEntry = {
  keyPath: string
  type: 'added' | 'removed' | 'modified'
  oldValue?: string
  newValue?: string
}

function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return { [prefix]: obj }
  }
  const result: Record<string, unknown> = {}
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      Object.assign(result, flattenObject(item, `${prefix}[${i}]`))
    })
  } else {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      Object.assign(result, flattenObject(v, prefix ? `${prefix}.${k}` : k))
    }
  }
  return result
}

function computeDiff(a: unknown, b: unknown): DiffEntry[] {
  const flatA = flattenObject(a)
  const flatB = flattenObject(b)
  const allKeys = new Set([...Object.keys(flatA), ...Object.keys(flatB)])
  const sortedKeys = [...allKeys].sort()
  const diffs: DiffEntry[] = []

  for (const key of sortedKeys) {
    const inA = key in flatA
    const inB = key in flatB
    const valA = flatA[key]
    const valB = flatB[key]

    if (!inA) {
      diffs.push({ keyPath: key, type: 'added', newValue: JSON.stringify(valB) })
    } else if (!inB) {
      diffs.push({ keyPath: key, type: 'removed', oldValue: JSON.stringify(valA) })
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      diffs.push({ keyPath: key, type: 'modified', oldValue: JSON.stringify(valA), newValue: JSON.stringify(valB) })
    }
  }

  return diffs
}

function prettyPrint(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

export function JsonDiffTool({ tool }: ToolProps) {
  const [jsonA, setJsonA] = useState('')
  const [jsonB, setJsonB] = useState('')
  const [parsedA, setParsedA] = useState<unknown>(null)
  const [parsedB, setParsedB] = useState<unknown>(null)
  const [errorA, setErrorA] = useState<string | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)
  const [diff, setDiff] = useState<DiffEntry[] | null>(null)

  const validateA = useCallback(() => {
    if (!jsonA.trim()) { setErrorA(null); setParsedA(null); return }
    try {
      setParsedA(JSON.parse(jsonA)); setErrorA(null)
    } catch (e) {
      setErrorA((e as Error).message); setParsedA(null)
    }
  }, [jsonA])

  const validateB = useCallback(() => {
    if (!jsonB.trim()) { setErrorB(null); setParsedB(null); return }
    try {
      setParsedB(JSON.parse(jsonB)); setErrorB(null)
    } catch (e) {
      setErrorB((e as Error).message); setParsedB(null)
    }
  }, [jsonB])

  const handleValidate = useCallback(() => {
    validateA()
    validateB()
  }, [validateA, validateB])

  const handleCompare = useCallback(() => {
    validateA()
    validateB()
    try {
      const a = JSON.parse(jsonA)
      const b = JSON.parse(jsonB)
      const result = computeDiff(a, b)
      setDiff(result)
    } catch {
      setDiff(null)
    }
  }, [jsonA, jsonB, validateA, validateB])

  const handlePrettyA = useCallback(() => {
    try {
      setJsonA(prettyPrint(JSON.parse(jsonA)))
      setErrorA(null)
    } catch (e) {
      setErrorA((e as Error).message)
    }
  }, [jsonA])

  const handlePrettyB = useCallback(() => {
    try {
      setJsonB(prettyPrint(JSON.parse(jsonB)))
      setErrorB(null)
    } catch (e) {
      setErrorB((e as Error).message)
    }
  }, [jsonB])

  const handleMinifyA = useCallback(() => {
    try {
      setJsonA(JSON.stringify(JSON.parse(jsonA)))
      setErrorA(null)
    } catch (e) {
      setErrorA((e as Error).message)
    }
  }, [jsonA])

  const handleMinifyB = useCallback(() => {
    try {
      setJsonB(JSON.stringify(JSON.parse(jsonB)))
      setErrorB(null)
    } catch (e) {
      setErrorB((e as Error).message)
    }
  }, [jsonB])

  const added = diff?.filter(d => d.type === 'added').length ?? 0
  const removed = diff?.filter(d => d.type === 'removed').length ?? 0
  const modified = diff?.filter(d => d.type === 'modified').length ?? 0
  const hasDiff = !!diff
  const hasData = jsonA.trim().length > 0 || jsonB.trim().length > 0

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>JSON Input Validation</label>
            <div className='flex flex-col gap-2'>
              <Button variant='outline' onClick={() => { validateA(); validateB(); }}>
                Validate Both
              </Button>
              <Button variant='secondary' onClick={() => { handlePrettyA(); handlePrettyB(); }}>
                Pretty Print Both
              </Button>
              <Button variant='outline' onClick={() => { handleMinifyA(); handleMinifyB(); }}>
                Minify Both
              </Button>
            </div>
          </div>
          {hasDiff && (
            <div className='space-y-1'>
              <label className='text-xs font-semibold uppercase text-muted'>Diff Summary</label>
              <div className='grid grid-cols-3 gap-2'>
                <Badge className='text-center bg-green-500/15 text-green-400 border-0'>+{added}</Badge>
                <Badge className='text-center bg-red-500/15 text-red-400 border-0'>-{removed}</Badge>
                <Badge className='text-center bg-yellow-500/15 text-yellow-600 border-0'>~{modified}</Badge>
              </div>
            </div>
          )}
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
          <Button onClick={handleCompare} disabled={!jsonA.trim() || !jsonB.trim()} className='w-full'>
            <Diff className='mr-2 h-4 w-4' />
            Compare
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Two Column Inputs */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='space-y-1'>
            <label className='text-sm font-medium text-accent'>JSON A (Original)</label>
            <textarea value={jsonA} onChange={e => { setJsonA(e.target.value); setErrorA(null) }} rows={10}
              placeholder='Paste JSON A here...'
              className='w-full h-[240px] font-mono text-xs rounded-xl border border-border bg-base/70 px-3 py-2 placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y' />
            {errorA && (
              <div className='flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-200'>
                <AlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
                {errorA}
              </div>
            )}
            <div className='flex gap-2'>
              <Button variant='ghost' size='sm' onClick={handlePrettyA} className='flex-1 text-xs'>Pretty</Button>
              <Button variant='ghost' size='sm' onClick={handleMinifyA} className='flex-1 text-xs'>Minify</Button>
            </div>
          </div>
          <div className='space-y-1'>
            <label className='text-sm font-medium text-accent'>JSON B (Modified)</label>
            <textarea value={jsonB} onChange={e => { setJsonB(e.target.value); setErrorB(null) }} rows={10}
              placeholder='Paste JSON B here...'
              className='w-full h-[240px] font-mono text-xs rounded-xl border border-border bg-base/70 px-3 py-2 placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y' />
            {errorB && (
              <div className='flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-200'>
                <AlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
                {errorB}
              </div>
            )}
            <div className='flex gap-2'>
              <Button variant='ghost' size='sm' onClick={handlePrettyB} className='flex-1 text-xs'>Pretty</Button>
              <Button variant='ghost' size='sm' onClick={handleMinifyB} className='flex-1 text-xs'>Minify</Button>
            </div>
          </div>
        </div>

        {/* Diff Results */}
        {hasDiff && (
          <Card className='divide-y divide-border'>
            {diff?.map((entry, i) => (
              <div key={i} className={`px-3 py-2 flex items-start gap-2 ${entry.type === 'added' ? 'bg-green-500/10' : entry.type === 'removed' ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${entry.type === 'added' ? 'bg-green-500/20 text-green-400' : entry.type === 'removed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-600'}`}>
                  {entry.type === 'added' ? '+' : entry.type === 'removed' ? '-' : '~'}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='font-mono text-xs font-medium truncate'>{entry.keyPath}</div>
                  <div className='text-xs text-muted mt-0.5'>
                    {entry.type === 'added' && <span className='text-green-400'>New: {entry.newValue}</span>}
                    {entry.type === 'removed' && <span className='text-red-400'>Was: {entry.oldValue}</span>}
                    {entry.type === 'modified' && (
                      <>
                        <div className='text-red-400'>Old: {entry.oldValue}</div>
                        <div className='text-green-400'>New: {entry.newValue}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )) ?? null}
            {diff?.length === 0 && (
              <div className='px-3 py-4 text-center text-sm text-muted'>
                ✅ No differences found — JSON structures are identical.
              </div>
            )}
          </Card>
        )}

        {!diff && (
          <Card className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
        <div className="flex justify-center mb-2"><GitCompare className="h-6 w-6 text-accent" /></div>
            <p>Enter two JSON objects and click Compare to see differences.</p>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
