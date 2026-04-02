import { useCallback, useMemo, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  CheckCircle,
  Code2,
  Copy,
  Download,
  Minimize2,
  AlignLeft,
} from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type Format = 'html' | 'css' | 'javascript'
type Action = 'minify' | 'beautify'

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'javascript', label: 'JavaScript' },
]

// ─── HTML ────────────────────────────────────────────────────────

function minifyHtml(input: string): string {
  let s = input
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/>\s+</g, '> <')
  s = s.replace(/[ \t\r\n]+/g, ' ')
  s = s.replace(/> </g, '><')
  return s.trim()
}

function beautifyHtml(input: string, indent = 2): string {
  let result = ''
  let depth = 0
  const pad = (n: number) => ' '.repeat(n * indent)

  // Tokenize: capture tags and everything between them
  const TAG_RE = /(<\/?[a-zA-Z][\s\S]*?>)|([^<]+)/g
  let m: RegExpExecArray | null

  while ((m = TAG_RE.exec(input)) !== null) {
    const tag = m[1]
    const text = m[2]
    if (tag) {
      if (tag.startsWith('</')) {
        depth = Math.max(0, depth - 1)
        result += pad(depth) + tag + '\n'
      } else if (
        tag.endsWith('/>') ||
        /<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(tag)
      ) {
        result += pad(depth) + tag + '\n'
      } else {
        result += pad(depth) + tag + '\n'
        depth++
      }
    } else if (text) {
      const t = text.trim()
      if (t) result += pad(depth) + t + '\n'
    }
  }
  return result.trimEnd()
}

// ─── CSS ─────────────────────────────────────────────────────────

function minifyCss(input: string): string {
  let s = input
  s = s.replace(/\/\/[^\n]*/g, '')
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/\s*\{\s*/g, '{')
  s = s.replace(/\s*\}\s*/g, '}')
  s = s.replace(/\s*:\s*/g, ':')
  s = s.replace(/\s*;\s*/g, ';')
  s = s.replace(/\s*,\s*/g, ',')
  s = s.replace(/;}/g, '}')
  s = s.replace(/\{\}/g, '')
  return s.trim()
}

function beautifyCss(input: string, indent = 2): string {
  let result = ''
  const pad = (n: number) => ' '.repeat(n * indent)
  let cleaned = input.replace(/\/\*[\s\S]*?\*\//g, '')

  // Parse CSS: selector { prop: val; prop: val; }
  // Use character-by-character approach for reliability
  let i = 0
  const len = cleaned.length
  let selector = ''
  let depth = 0

  while (i < len) {
    const ch = cleaned[i]
    if (ch === '{') {
      depth++
      result += pad(depth - 1) + selector.trim() + ' {\n'
      selector = ''
      i++
      continue
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1)
      result = result.trimEnd()
      if (!result.endsWith('\n')) result += '\n'
      result += pad(depth) + '}\n'
      i++
      continue
    }
    if (ch === ';') {
      const prop = selector.trim()
      if (prop) result += pad(depth) + prop + ';\n'
      selector = ''
      i++
      continue
    }
    if (/\s/.test(ch)) {
      i++
      continue
    }
    selector += ch
    i++
  }
  return result.trimEnd()
}

// ─── JavaScript ──────────────────────────────────────────────────

function minifyJs(input: string): string {
  let result = ''
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]

    // Single-line comment
    if (ch === '/' && input[i + 1] === '/') {
      while (i < len && input[i] !== '\n') i++
      continue
    }

    // Block comment
    if (ch === '/' && input[i + 1] === '*') {
      i += 2
      while (i < len && !(input[i] === '*' && input[i + 1] === '/')) i++
      i += 2
      continue
    }

    // String literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch
      result += ch
      i++
      while (i < len && input[i] !== q) {
        if (input[i] === '\\') {
          result += input.slice(i, i + 2)
          i += 2
        } else {
          result += input[i]
          i++
        }
      }
      if (i < len) { result += input[i]; i++ }
      continue
    }

    // Regex literal (heuristic)
    if (ch === '/') {
      const raw = result.trimEnd()
      const prev = raw.length > 0 ? raw[raw.length - 1] : ''
      const needsRegex = ['(', '{', '[', ',', ';', ':', '!', '=', '<', '>', '&', '|', '^', '?', '+', '-', '*', '%', '~'].includes(prev)
      if (needsRegex) {
        result += '/'
        i++
        while (i < len && input[i] !== '/') {
          if (input[i] === '\\') { result += input.slice(i, i + 2); i += 2 }
          else if (input[i] === '[') {
            result += '['; i++
            while (i < len && input[i] !== ']') {
              if (input[i] === '\\') { result += input.slice(i, i + 2); i += 2 }
              else { result += input[i]; i++ }
            }
            result += ']'; if (i < len) i++
          } else { result += input[i]; i++ }
        }
        result += '/'; i++
        while (i < len && /[gimsuy]/.test(input[i])) { result += input[i]; i++ }
        continue
      }
    }

    // Whitespace
    if (/\s/.test(ch)) {
      const raw = result.trimEnd()
      const last = raw.length > 0 ? raw[raw.length - 1] : ''
      let next = i
      while (next < len && /\s/.test(input[next])) next++
      const nxt = next < len ? input[next] : ''
      if (/[a-zA-Z0-9_$]/.test(last) && /[a-zA-Z0-9_$]/.test(nxt)) {
        result += ' '
      }
      i = next
      continue
    }

    result += ch
    i++
  }
  return result.trim()
}

function beautifyJs(input: string, indent = 2): string {
  let result = ''
  let depth = 0
  let i = 0
  const len = input.length
  const pad = (n: number) => ' '.repeat(n * indent)
  let inString: string | null = null

  while (i < len) {
    const ch = input[i]

    // String literals
    if (inString) {
      result += ch
      if (ch === '\\') { i++; if (i < len) { result += input[i]; i++ }; continue }
      if (ch === inString) { inString = null; i++; continue }
      if (ch === '\n') { i++; continue }
      i++
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      result += ch; i++
      continue
    }

    // Comments
    if (ch === '/' && input[i + 1] === '/') {
      result += pad(depth)
      while (i < len && input[i] !== '\n') { result += input[i]; i++ }
      result += '\n'
      continue
    }
    if (ch === '/' && input[i + 1] === '*') {
      result += pad(depth) + '/*'
      i += 2
      while (i < len && !(input[i] === '*' && input[i + 1] === '/')) {
        if (input[i] === '\n') { result += pad(depth); i++; continue }
        result += input[i]; i++
      }
      result += '*/\n'; i += 2
      continue
    }

    if (ch === '{') { result += ' {\n'; depth++; i++; continue }
    if (ch === '}') {
      depth = Math.max(0, depth - 1)
      result = result.trimEnd()
      if (!result.endsWith('\n')) result += '\n'
      result += pad(depth) + '}\n'
      i++
      continue
    }
    if (ch === ';') { result += ';\n'; i++; continue }
    if (/\s/.test(ch)) { i++; continue }

    result += ch; i++
  }
  return result.trimEnd()
}

// ─── Component ───────────────────────────────────────────────────

export function CodeMinifierTool({ tool }: ToolProps) {
  const [format, setFormat] = useState<Format>('html')
  const [action, setAction] = useState<Action>('minify')
  const [source, setSource] = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const copyT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => {
    if (!output) return null
    const orig = new Blob([source]).size
    const res = new Blob([output]).size
    const saved = orig - res
    const ratio = orig > 0 ? ((saved / orig) * 100).toFixed(1) : '0.0'
    return { orig, res, saved, ratio: action === 'minify' ? ratio : null }
  }, [source, output, action])

  const doTransform = useCallback(() => {
    if (!source.trim()) { setOutput(''); return }
    let r = ''
    if (action === 'minify') {
      if (format === 'html') r = minifyHtml(source)
      else if (format === 'css') r = minifyCss(source)
      else r = minifyJs(source)
    } else {
      if (format === 'html') r = beautifyHtml(source)
      else if (format === 'css') r = beautifyCss(source)
      else r = beautifyJs(source)
    }
    setOutput(r)
    setCopied(false)
  }, [source, format, action])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      if (copyT.current) clearTimeout(copyT.current)
      copyT.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [output])

  const handleDownload = useCallback(() => {
    if (!output) return
    const ext: Record<Format, string> = { html: 'html', css: 'css', javascript: 'js' }
    const suffix = action === 'minify' ? '.min' : ''
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code${suffix}.${ext[format]}`
    a.click()
    URL.revokeObjectURL(url)
  }, [output, format, action])

  const handleSwap = useCallback(() => {
    if (!output) return
    setSource(output)
    setOutput('')
    setCopied(false)
  }, [output])

  const ext = format === 'javascript' ? 'js' : format

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Format</label>
            <Select value={format} onChange={(e) => { setFormat(e.target.value as Format); setOutput(''); setCopied(false) }}>
              {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Action</label>
            <div className='grid grid-cols-2 gap-2'>
              <button type='button' onClick={() => { setAction('minify'); setOutput(''); setCopied(false) }}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${action === 'minify' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text hover:bg-panel'}`}>
                <Minimize2 className='h-4 w-4' /> Minify
              </button>
              <button type='button' onClick={() => { setAction('beautify'); setOutput(''); setCopied(false) }}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${action === 'beautify' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text hover:bg-panel'}`}>
                <AlignLeft className='h-4 w-4' /> Beautify
              </button>
            </div>
          </div>

          {stats && (
            <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-2'>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-emerald-400'>
                <CheckCircle className='h-3.5 w-3.5' /> {action === 'minify' ? 'Minified' : 'Beautified'} successfully
              </div>
              {action === 'minify' && stats.ratio && (
                <div className='space-y-1'>
                  <div className='text-xs text-emerald-300'>{stats.ratio}% size reduction</div>
                  <div className='text-[11px] text-muted'>
                    {stats.orig.toLocaleString()} → {stats.res.toLocaleString()} bytes
                    {stats.saved > 0 && <span className='text-emerald-300 ml-1'>(−{stats.saved.toLocaleString()} B saved)</span>}
                  </div>
                </div>
              )}
              {action === 'beautify' && (
                <div className='text-[11px] text-muted'>{stats.orig.toLocaleString()} → {stats.res.toLocaleString()} bytes</div>
              )}
            </div>
          )}

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only • No dependencies</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <label className='text-xs font-semibold uppercase text-muted'>Input ({format})</label>
            {source && <button type='button' onClick={() => { setSource(''); setOutput(''); setCopied(false) }} className='text-xs text-accent hover:text-accent/80'>Clear</button>}
          </div>
          <Textarea value={source} onChange={e => { setSource(e.target.value); setOutput(''); setCopied(false) }}
            placeholder={`Paste your ${format} code here...`} rows={10} className='font-mono' spellCheck={false} />
        </div>

        <div className='flex gap-3'>
          <Button onClick={doTransform} disabled={!source.trim()}>
            {action === 'minify'
              ? <><Minimize2 className='mr-2 h-4 w-4' /> Minify {ext.toUpperCase()}</>
              : <><AlignLeft className='mr-2 h-4 w-4' /> Beautify {ext.toUpperCase()}</>}
          </Button>
          {output && <Button variant='secondary' onClick={handleSwap}>Swap Output → Input</Button>}
        </div>

        {output && (
          <Card className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Code2 className='h-4 w-4 text-accent' />
                <span className='text-xs font-semibold uppercase text-muted'>Output ({action})</span>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant='ghost' className='h-7 px-2 text-xs' onClick={handleCopy}>
                  {copied ? <CheckCircle className='mr-1 h-3 w-3 text-emerald-400' /> : <Copy className='mr-1 h-3 w-3' />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant='ghost' className='h-7 px-2 text-xs' onClick={handleDownload}>
                  <Download className='mr-1 h-3 w-3' /> Download
                </Button>
              </div>
            </div>
            <pre className='overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-base/60 p-3 text-xs font-mono text-text max-h-[500px]'>
              {output}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
