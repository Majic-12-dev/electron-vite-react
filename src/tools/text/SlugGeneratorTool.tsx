import { useCallback, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Link, Zap } from 'lucide-react'

type SlugGeneratorToolProps = {
  tool: ToolDefinition
}

// Simple diacritics map for accent removal
const ACCENT_MAP: Record<string, string> = {
  'a': 'àáâãäåāăą', 'A': 'ÀÁÂÃÄÅĀĂĄ',
  'c': 'çćĉċč', 'C': 'ÇĆĈĊČ',
  'd': 'ďđ', 'D': 'ĎĐ',
  'e': 'èéêëēĕėęě', 'E': 'ÈÉÊËĒĔĖĘĚ',
  'g': 'ĝğġģ', 'G': 'ĜĞĠĢ',
  'h': 'ĥħ', 'H': 'ĤĦ',
  'i': 'ìíîïĩīĭįı', 'I': 'ÌÍÎÏĨĪĬĮ',
  'j': 'ĵ', 'J': 'Ĵ',
  'k': 'ķĸ', 'K': 'Ķ',
  'l': 'ĺļľŀł', 'L': 'ĹĻĽĿŁ',
  'n': 'ñńņňŉŋ', 'N': 'ÑŃŅŇŊ',
  'o': 'òóôõöøōŏő', 'O': 'ÒÓÔÕÖØŌŎŐ',
  'r': 'ŕŗř', 'R': 'ŔŖŘ',
  's': 'śŝşš', 'S': 'ŚŜŞŠ',
  't': 'ţťŧ', 'T': 'ŢŤŦ',
  'u': 'ùúûüũūŭůűų', 'U': 'ÙÚÛÜŨŪŬŮŰŲ',
  'w': 'ŵ', 'W': 'Ŵ',
  'y': 'ýÿŷ', 'Y': 'ÝŸŶ',
  'z': 'źżž', 'Z': 'ŹŻŽ',
}

function reverseAccentMap(map: Record<string, string>): Map<string, string> {
  const rev = new Map<string, string>()
  for (const [replacement, chars] of Object.entries(map)) {
    for (const ch of chars) rev.set(ch, replacement)
  }
  return rev
}

const REV_ACCENTS = reverseAccentMap(ACCENT_MAP)

function removeAccents(str: string): string {
  return str.split('').map(ch => REV_ACCENTS.get(ch) || ch).join('')
}

function toSlug(input: string, separator: string = '-', lower: boolean = true, maxLen: number = 0): string {
  let s = removeAccents(input.trim())
  if (lower) s = s.toLowerCase()
  // Replace non-alphanumeric with separator
  s = s.replace(/[^a-zA-Z0-9]/g, separator)
  // Collapse consecutive separators
  const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  s = s.replace(new RegExp(escapedSep + '+', 'g'), separator)
  // Trim separators from ends
  s = s.replace(new RegExp('^' + escapedSep + '|' + escapedSep + '$', 'g'), '')
  if (maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen).replace(new RegExp(escapedSep + '+$', 'g'), '')
  return s
}

export function SlugGeneratorTool({ tool }: SlugGeneratorToolProps) {
  const [input, setInput] = useState('')
  const [separator, setSeparator] = useState('-')
  const [lowercase, setLowercase] = useState(true)
  const [maxLen, setMaxLen] = useState(0)
  const [slug, setSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [autoLive, setAutoLive] = useState(true)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generate = useCallback(() => {
    if (!input.trim()) { setSlug(null); return }
    const s = toSlug(input, separator, lowercase, maxLen)
    setSlug(s)
    setCopied(false)
  }, [input, separator, lowercase, maxLen])

  // Live generation
  useCallback(() => {
    if (autoLive && input.trim()) {
      const s = toSlug(input, separator, lowercase, maxLen)
      setSlug(s)
    }
  }, [input, separator, lowercase, maxLen, autoLive])

  // Re-generate on option change if there's input
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInput(v)
    if (autoLive && v.trim()) {
      const s = toSlug(v, separator, lowercase, maxLen)
      setSlug(s)
      setCopied(false)
    }
  }, [autoLive, separator, lowercase, maxLen])

  const handleOptionChange = useCallback(() => {
    if (input.trim()) generate()
  }, [input, separator, lowercase, maxLen, generate])

  const handleCopy = useCallback(() => {
    if (!slug) return
    navigator.clipboard.writeText(slug).then(() => {
      setCopied(true)
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [slug])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Options</div>
            <div className='space-y-3'>
              <label className='flex items-center gap-2 text-xs text-muted cursor-pointer'>
                <input type='checkbox' checked={autoLive} onChange={(e) => setAutoLive(e.target.checked)} className='rounded border-border accent-accent' />
                Live preview
              </label>
              <div className='space-y-1'>
                <div className='text-[10px] uppercase text-muted'>Separator</div>
                <div className='flex gap-2'>
                  {[
                    { label: '-', value: '-' },
                    { label: '_', value: '_' },
                    { label: '.', value: '.' },
                    { label: '/', value: '/' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type='button'
                      onClick={() => { setSeparator(opt.value); setTimeout(() => input.trim() && generate(), 0) }}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-center font-mono text-sm transition
                        ${separator === opt.value ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className='flex items-center gap-2 text-xs text-muted cursor-pointer'>
                <input type='checkbox' checked={lowercase} onChange={(e) => { setLowercase(e.target.checked); setTimeout(() => input.trim() && generate(), 0) }} className='rounded border-border accent-accent' />
                Lowercase
              </label>
              <div className='space-y-1'>
                <div className='text-[10px] uppercase text-muted'>Max length (0 = unlimited)</div>
                <input
                  type='number'
                  min={0}
                  max={200}
                  value={maxLen}
                  onChange={(e) => { setMaxLen(Math.max(0, parseInt(e.target.value) || 0)); setTimeout(() => input.trim() && generate(), 0) }}
                  className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-center text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
                />
              </div>
            </div>
          </div>
          {!autoLive && input.trim() && (
            <Button onClick={generate} className='w-full'>
              <Zap className='mr-2 h-4 w-4' />
              Generate
            </Button>
          )}
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>Input text or title</label>
          <Input
            value={input}
            onChange={handleChange}
            placeholder='e.g. Hello World — My First Post!'
          />
        </div>

        {slug && (
          <Card className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5 text-xs text-accent'>
                <Link className='h-3.5 w-3.5' />
                Slug
              </div>
              <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
                {copied ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <Copy className='mr-1 h-3 w-3' />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className='rounded-xl border border-border bg-base/60 px-4 py-3 font-mono text-sm text-text break-words'>
              {slug}
            </div>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
