import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Copy as CopyIcon, CheckCircle, RefreshCw, FileType } from 'lucide-react'

type LoremGeneratorToolProps = {
  tool: ToolDefinition
}

const WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do',
  'eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim',
  'ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi',
  'aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit',
  'voluptate','velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint',
  'occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt',
  'mollit','anim','id','est','laborum','perspiciatis','unde','omnis','iste','natus',
  'error','voluptatem','accusantium','doloremque','laudantium','totam','rem','aperiam',
  'eaque','ipsa','quae','ab','illo','inventore','veritatis','quasi','architecto','beatae',
  'vitae','dicta','sunt','explicabo','nemo','ipsam','voluptas','aspernatur','aut',
  'odit','fugit','consequuntur','magni','dolores','eos','qui','ratione','sequi',
  'nesciunt','neque','porro','quisquam','numquam','praesentium','atque','corrupti',
]

function pick(n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)])
  return out
}

function sentence(wordCount: number): string {
  const words = pick(wordCount)
  words[0] = words[0][0].toUpperCase() + words[0].slice(1)
  return words.join(' ') + '.'
}

function paragraph(sentenceCount: number): string {
  return Array.from({ length: sentenceCount }, () => sentence(6 + Math.floor(Math.random() * 12))).join(' ')
}

type OutputMode = 'paragraphs' | 'sentences' | 'words'

export function LoremGeneratorTool({ tool }: LoremGeneratorToolProps) {
  const [count, setCount] = useState(3)
  const [mode, setMode] = useState<OutputMode>('paragraphs')
  const [startWithLorem, setStartWithLorem] = useState(true)
  const [generated, setGenerated] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(() => {
    let result = ''
    if (mode === 'paragraphs') {
      result = Array.from({ length: count }, (_, i) => {
        let p = paragraph(3 + Math.floor(Math.random() * 5))
        if (i === 0 && startWithLorem) {
          p = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' + p.split('.').slice(1).join('.')
        }
        return p
      }).join('\n\n')
    } else if (mode === 'sentences') {
      const sents = Array.from({ length: count }, (_, i) => {
        let s = sentence(6 + Math.floor(Math.random() * 12))
        if (i === 0 && startWithLorem) {
          s = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
        }
        return s
      }).join(' ')
      result = sents
    } else {
      const words = startWithLorem ? ['Lorem','ipsum','dolor','sit','amet,', ...pick(Math.max(0, count - 5))] : pick(count)
      result = words.join(' ')
    }
    setGenerated(result)
    setCopied(false)
  }, [count, mode, startWithLorem])

  const wordCount = useMemo(() => generated.split(/\s+/).filter(Boolean).length, [generated])
  const charCount = useMemo(() => generated.length, [generated])

  const handleCopy = useCallback(() => {
    if (!generated) return
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [generated])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Mode</div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as OutputMode)}
              className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
            >
              <option value='paragraphs'>Paragraphs</option>
              <option value='sentences'>Sentences</option>
              <option value='words'>Words</option>
            </select>
          </div>
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Count</label>
            <div className='flex items-center gap-2'>
              <Button variant='ghost' className='h-8 w-8 rounded-lg' onClick={() => setCount(Math.max(1, count - 1))}>−</Button>
              <input
                type='number'
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-center text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              />
              <Button variant='ghost' className='h-8 w-8 rounded-lg' onClick={() => setCount(Math.min(100, count + 1))}>+</Button>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <label className='flex items-center gap-1.5 text-xs text-muted cursor-pointer'>
              <input
                type='checkbox'
                checked={startWithLorem}
                onChange={(e) => setStartWithLorem(e.target.checked)}
                className='rounded border-border accent-accent'
              />
              Start with "Lorem ipsum"
            </label>
          </div>
          <Button onClick={handleGenerate} className='w-full'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Generate
          </Button>
          {generated && (
            <div className='space-y-1 text-xs text-muted'>
              <div className='flex justify-between'><span>Words</span><span className='font-mono'>{wordCount}</span></div>
              <div className='flex justify-between'><span>Characters</span><span className='font-mono'>{charCount}</span></div>
            </div>
          )}
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      {generated && (
        <Card className='space-y-2'>
          <div className='flex items-center justify-between'>
            <FileType className='h-4 w-4 text-muted' />
            <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
              {copied ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <CopyIcon className='mr-1 h-3 w-3' />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Textarea value={generated} onChange={() => {}} rows={12} readOnly className='font-serif' />
        </Card>
      )}
    </BaseToolLayout>
  )
}
