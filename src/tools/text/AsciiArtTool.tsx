import { useCallback, useEffect, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Clock, Copy, Save, Type, CheckCircle2, XCircle, Trash2 } from 'lucide-react'

type ToolProps = { tool: ToolDefinition }

type HistoryEntry = {
  text: string
  font: FontType
  art: string
  timestamp: number
}

const HISTORY_KEY = 'docflow-ascii-history'

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 10)))
  } catch {
    // quota exceeded, skip
  }
}

/* ── ASCII Font Definitions ── */

const BIG_BLOCKS: Record<string, string[]> = {
  A: ['  ##  ', ' #  # ', ' #####', ' #  # ', '#    #'],
  B: ['#### ', '#   #', '#### ', '#   #', '#### '],
  C: ['  ###', ' #   ', ' #   ', ' #   ', '  ###'],
  D: ['#### ', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '###  ', '#    ', '#####'],
  F: ['#####', '#    ', '###  ', '#    ', '#    '],
  G: ['  ###', ' #   ', '# ###', '#  # ', '  ## '],
  H: ['#   #', '#   #', '#####', '#   #', '#   #'],
  I: ['###', ' # ', ' # ', ' # ', '###'],
  J: ['  ###', '    #', '    #', '#  # ', ' ##  '],
  K: ['#  # ', '# #  ', '##   ', '# #  ', '#  # '],
  L: ['#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', ' ### '],
  P: ['###  ', '#  # ', '###  ', '#    ', '#    '],
  Q: [' ### ', '#   #', '# # #', '#  # ', ' ## #'],
  R: ['###  ', '#  # ', '###  ', '# #  ', '#  # '],
  S: [' ####', '#    ', ' ### ', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', ' # # ', ' # # ', '  #  '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#   #', '#   #', ' # # ', '#   #', '#   #'],
  Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '   # ', '  #  ', ' #   ', '#####'],
  ' ': ['     ', '     ', '     ', '     ', '     '],
  '0': [' ### ', '# # #', '# # #', '# # #', ' ### '],
  '1': ['##  ', ' #  ', ' #  ', ' #  ', '### '],
  '2': ['### ', '#  # ', '  ## ', ' #   ', '#####'],
  '3': [' ###', '   #', '  ##', '   #', ' ###'],
  '4': ['#  # ', '#  # ', '#####', '   # ', '   # '],
  '5': ['#####', '#    ', '###  ', '    #', '#### '],
  '6': [' ###', '##   ', '#### ', '# # #', ' ### '],
  '7': ['#####', '  #  ', '   # ', '  #  ', ' #   '],
  '8': [' ### ', '# # #', ' ### ', '# # #', ' ### '],
  '9': [' ### ', '# # #', ' ####', '    #', ' ### '],
  '!': [' # ', ' # ', ' # ', '   ', ' # '],
  '?': [' ###', '   #', '  # ', '    ', ' #  '],
  '.': ['  ', '  ', '  ', '  ', '##'],
  ',': ['  ', '  ', '  ', ' # ', ' # '],
  '-': ['       ', ' ##### ', '       ', '       ', '       '],
  ':': [' ##', ' ##', '    ', ' ##', ' ##'],
  ';': [' ##', ' ##', '    ', ' # ', ' # '],
  '@': [' ### ', '#  # ', '# @# ', '#    ', ' ### '],
  '#': ['  #  ', '### #', ' #   ', '# ###', '  #  '],
  '$': ['  #  ', ' ### ', '# #  ', '  # #', ' ### '],
  '%': ['#   #', '  #  ', '  #  ', '  #  ', '#   #'],
  '&': [' #  ', '# # ', ' # # ', '## ##', ' ### '],
  '*': [' # # ', '  #  ', '#####', '  #  ', ' # # '],
  '+': ['     ', '  #  ', '#####', '  #  ', '     '],
  '=': ['       ', ' ##### ', '       ', ' ##### ', '       '],
  '_': ['       ', '       ', '       ', '       ', '#######'],
  '(': ['  #  ', ' #   ', ' #   ', ' #   ', '  #  '],
  ')': ['  #  ', '   # ', '   # ', '   # ', '  #  '],
}

const MEDIUM_CHARS: Record<string, string[]> = {
  A: [' _  ', '| | ', '|_| '],
  B: ['|__ ', '|__ ', '|_| '],
  C: [' _  ', '| |', '|_|'],
  D: ['|_| ', '| | ', '|_| '],
  E: ['|_  ', '|_  ', '|_| '],
  F: ['|_  ', '|   ', '|   '],
  G: [' _  ', '|_  ', '|_| '],
  H: ['|  | ', '|--| ', '|  | '],
  I: [' _ ', '| |', '|_|'],
  J: ['  J ', '  J ', '|_| '],
  K: ['| / ', '|/  ', '|\\  '],
  L: ['|   ', '|   ', '|_| '],
  M: ['|\\/|', '| ||', '|  |'],
  N: ['|\\ |', '| \\|', '|  |'],
  O: [' _  ', '| | ', '|_| '],
  P: ['|__ ', '|   ', '|   '],
  Q: [' _  ', '| | ', '|_|\\'],
  R: ['|_  ', '| \\ ', '|  |'],
  S: ['|__ ', ' __|', '|__ '],
  T: [' ___ ', ' |_  ', '   | '],
  U: ['|  |', '|  |', '|__|'],
  V: ['\\  /', ' \\/ ', '    '],
  W: ['\\  /', '|\\/|', '|  |'],
  X: ['\\ /', ' X ', '/ \\'],
  Y: ['\\ /', ' X ', ' | '],
  Z: [' _  ', '|_  ', '|__ '],
  '0': [' _  ', '| | ', '|_| '],
  '1': ['| | ', '  | ', '|_| '],
  '2': [' _  ', ' _| ', '|__ '],
  '3': ['_  ', '_| ', '_| '],
  '4': ['| | ', '|_| ', '  | '],
  '5': [' _  ', '|_  ', ' _| '],
  '6': [' _  ', '|_  ', '|_| '],
  '7': ['__  ', '  | ', ' /  '],
  '8': [' _  ', '|_| ', '|_| '],
  '9': [' _  ', '|_| ', ' _| '],
  ' ': ['   ', '   ', '   '],
  '!': [' _ ', '| |', '|_|'],
  '?': [' _  ', ' _| ', '    '],
}

const SMALL_CHARS: Record<string, string> = {
  a: ' @ ', b: '@| ', c: ' @', d: ' |@', e: '@@ ', f: '|@', g: '@|', h: '@|@', i: '@', j: ' @',
  k: '@ @', l: '|@', m: '@@@', n: '@ |', o: ' @ ', p: '@| ', q: ' |@', r: '@ ', s: ' @', t: '|@|',
  u: '@ @', v: ' v ', w: 'w w', x: 'x x', y: '\\y/', z: ' z ', ' ': ' ',
  '0': ' 0 ', '1': ' 1 ', '2': ' 2 ', '3': ' 3 ', '4': ' 4 ', '5': ' 5 ', '6': ' 6 ', '7': ' 7 ', '8': ' 8 ', '9': ' 9 ',
}

function renderBig(text: string, charWidth: number): string {
  const lines: string[] = ['', '', '', '', '']
  for (const ch of text.toUpperCase()) {
    const art = BIG_BLOCKS[ch] || BIG_BLOCKS[' ']
    for (let i = 0; i < 5; i++) {
      lines[i] += (art[i] || '     ').padEnd(Math.max(5, charWidth)) + '  '
    }
  }
  return lines.join('\n')
}

function renderSmall(text: string): string {
  return text.toLowerCase().split('').map(ch => SMALL_CHARS[ch] ?? ' ').join('')
}

function renderMedium(text: string): string {
  const lines: string[] = ['', '', '']
  for (const ch of text.toUpperCase()) {
    const art = MEDIUM_CHARS[ch] || MEDIUM_CHARS[' '] || ['   ', '   ', '   ']
    if (Array.isArray(art)) {
      for (let i = 0; i < 3; i++) {
        lines[i] += (art[i] || '   ').padEnd(5) + ' '
      }
    }
  }
  return lines.join('\n')
}

type FontType = 'blocks' | 'small' | 'medium'

const fonts: { key: FontType; label: string }[] = [
  { key: 'blocks', label: 'Blocks (Big, 5 lines)' },
  { key: 'medium', label: 'Medium (3 lines)' },
  { key: 'small', label: 'Small (1 line)' },
]

export function AsciiArtTool({ tool }: ToolProps) {
  const [input, setInput] = useState('')
  const [font, setFont] = useState<FontType>('blocks')
  const [charWidth, setCharWidth] = useState(5)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    saveHistory(history)
  }, [history])

  const artOutput = (() => {
    if (!input.trim()) return ''
    if (font === 'blocks') return renderBig(input, charWidth)
    if (font === 'small') return renderSmall(input)
    return renderMedium(input)
  })()

  const handleCopy = useCallback(() => {
    if (!artOutput) return
    navigator.clipboard.writeText(artOutput).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [artOutput])

  const handleSave = useCallback(() => {
    if (!artOutput.trim()) return
    const entry: HistoryEntry = {
      text: input,
      font,
      art: artOutput,
      timestamp: Date.now(),
    }
    setHistory(prev => [entry, ...prev].slice(0, 10))
  }, [artOutput, input, font])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    try { localStorage.removeItem(HISTORY_KEY) } catch {}
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Font Style</label>
            <div className='space-y-1'>
              {fonts.map((f) => (
                <button key={f.key} type='button' onClick={() => setFont(f.key)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition
                    ${font === f.key ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {font === 'blocks' && (
            <div className='space-y-2'>
              <label className='text-xs font-semibold uppercase text-muted'>Char Width: {charWidth}</label>
              <input type='range' min={3} max={10} value={charWidth} onChange={e => setCharWidth(Number(e.target.value))} className='w-full accent-accent' />
              <div className='flex justify-between text-[10px] text-muted px-1'><span>Narrow</span><span>Wide</span></div>
            </div>
          )}

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Built-in Fonts</Badge>

          <Button onClick={handleSave} disabled={!artOutput} className='w-full'>
            <Save className='mr-2 h-4 w-4' />
            Save to History
          </Button>

          <Button variant='outline' onClick={() => setShowHistory(!showHistory)} className='w-full'>
            <Clock className='mr-2 h-4 w-4' />
            {showHistory ? 'Hide' : 'Show'} History ({history.length})
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Input */}
        <div className='space-y-2'>
          <label className='text-sm font-medium text-accent'>Enter Text (max 20 chars)</label>
          <input
            type='text'
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 20))}
            placeholder='Type your text...'
            maxLength={20}
            className='w-full rounded-xl border border-border bg-base/70 px-3 py-2.5 font-mono text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent' />
          <div className='text-right text-[10px] text-muted'>{input.length}/20 chars</div>
        </div>

        {/* ASCII Output */}
        <Card>
          <div className='flex items-center justify-between mb-3'>
            <span className='text-xs font-semibold uppercase text-muted'>ASCII Art Preview</span>
            <Button variant='ghost' size='sm' onClick={handleCopy} disabled={!artOutput} className='text-xs'>
              {copied ? <CheckCircle2 className='mr-1 h-3 w-3' /> : <Copy className='mr-1 h-3 w-3' />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <pre className={`rounded-lg bg-black/30 border border-border p-4 overflow-x-auto whitespace-pre font-mono ${font === 'small' ? 'text-xs' : 'text-[10px] leading-snug'}`}>
            {artOutput || <span className='text-muted/50'>Type something to generate ASCII art</span>}
          </pre>
        </Card>

        {/* History */}
        {showHistory && history.length > 0 && (
          <Card>
            <div className='flex items-center justify-between mb-3'>
              <span className='text-xs font-semibold uppercase text-muted flex items-center gap-1'>
                <Clock className='h-3 w-3' /> Recent ({history.length})
              </span>
              <Button variant='ghost' size='sm' onClick={handleClearHistory} className='text-[10px] text-red-400'>
                <Trash2 className='mr-1 h-3 w-3' /> Clear
              </Button>
            </div>
            <div className='space-y-2 max-h-[300px] overflow-y-auto'>
              {history.map((h, i) => (
                <button
                  key={i}
                  type='button'
                  onClick={() => { setInput(h.text); setFont(h.font) }}
                  className='w-full text-left rounded-lg border border-border bg-base/40 p-2 hover:bg-base/70 transition text-[10px] font-mono'>
                  <div className='truncate mb-1 font-sans text-xs text-muted'>
                    {h.text} · {new Date(h.timestamp).toLocaleString()}
                  </div>
                  <pre className='overflow-hidden text-muted/70 whitespace-pre line-clamp-3'>
                    {h.art}
                  </pre>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Quick presets */}
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>Quick Presets</label>
          <div className='flex flex-wrap gap-1.5'>
            {['Hello', 'DocFlow', 'ERROR', '404', 'OK', 'YES', 'NO', 'WOW', 'ART', '!!!'].map(t => (
              <button key={t} type='button' onClick={() => setInput(t)} className='rounded-lg border border-border bg-base/60 px-2 py-1 text-xs text-muted hover:text-text hover:border-accent transition'>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </BaseToolLayout>
  )
}
