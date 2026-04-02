import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Type as TypeIcon, ArrowDownUp, ArrowUp, ArrowDown, CaseSensitive, Terminal } from 'lucide-react'

type CaseConverterToolProps = {
  tool: ToolDefinition
}

const transformations = [
  { name: 'UPPERCASE', fn: (s: string) => s.toUpperCase(), icon: ArrowUp },
  { name: 'lowercase', fn: (s: string) => s.toLowerCase(), icon: ArrowDown },
  { name: 'Title Case', fn: (s: string) => s.replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()), icon: CaseSensitive },
  { name: 'Sentence case', fn: (s: string) => {
    const lower = s.toLowerCase()
    return lower.replace(/(^|\.?\s*[a-z])/g, (m, p1) => p1.toUpperCase())
  }, icon: TypeIcon },
  { name: 'camelCase', fn: (s: string) => {
    const parts = s.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean)
    return parts.map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join('')
  }, icon: Terminal },
  { name: 'PascalCase', fn: (s: string) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''), icon: CaseSensitive },
  { name: 'snake_case', fn: (s: string) => s.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)?.map(w => w.toLowerCase()).join('_') || s.toLowerCase(), icon: ArrowDownUp },
  { name: 'kebab-case', fn: (s: string) => s.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)?.map(w => w.toLowerCase()).join('-') || s.toLowerCase(), icon: ArrowDownUp },
  { name: 'CONSTANT_CASE', fn: (s: string) => (s.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)?.map(w => w.toUpperCase()).join('_') || s.toUpperCase()), icon: ArrowUp },
  { name: 'invert', fn: (s: string) => s.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''), icon: ArrowDownUp },
  { name: 'aLtErNaTiNg', fn: (s: string) => s.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join(''), icon: CaseSensitive },
] as const

export function CaseConverterTool({ tool }: CaseConverterToolProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [activeTransform, setActiveTransform] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const apply = useCallback((name: string) => {
    if (!input.trim()) return
    const t = transformations.find(t => t.name === name)
    if (t) {
      setResult(t.fn(input.trim()))
      setActiveTransform(name)
      setCopied(false)
    }
  }, [input])

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [result])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Transformations</div>
            <div className='grid grid-cols-1 gap-1.5'>
              {transformations.map(t => {
                const Icon = t.icon
                const isActive = activeTransform === t.name
                return (
                  <button
                    key={t.name}
                    type='button'
                    onClick={() => apply(t.name)}
                    disabled={!input.trim()}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition
                      ${isActive ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text hover:bg-panel'}
                      disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <Icon className='h-3.5 w-3.5 flex-shrink-0' />
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>Input text</label>
          <Textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setResult(null); setActiveTransform(null) }}
            placeholder='Enter or paste your text here...'
            rows={5}
            className='font-mono'
          />
        </div>

        {result && (
          <Card className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='text-xs font-semibold text-accent'>{activeTransform}</div>
              <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
                {copied ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <Copy className='mr-1 h-3 w-3' />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className='overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-base/60 p-3 text-sm font-mono text-text'>
              {result}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
