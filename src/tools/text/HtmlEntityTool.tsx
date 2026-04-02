import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Copy, CheckCircle, ArrowLeftRight } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

// HTML entity encoding/decoding maps
const ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  ' ': '&nbsp;',
  '©': '&copy;',
  '®': '&reg;',
  '™': '&trade;',
  '–': '&ndash;',
  '—': '&mdash;',
  '…': '&hellip;',
  '€': '&euro;',
  '£': '&pound;',
  '¥': '&yen;',
  '¢': '&cent;',
  '«': '&laquo;',
  '»': '&raquo;',
  '†': '&dagger;',
  '‡': '&Dagger;',
  '•': '&bull;',
  '·': '&middot;',
  '°': '&deg;',
  '±': '&plusmn;',
  '×': '&times;',
  '÷': '&divide;',
  '¼': '&frac14;',
  '½': '&frac12;',
  '¾': '&frac34;',
  '²': '&sup2;',
  '³': '&sup3;',
  '¹': '&sup1;',
  'µ': '&micro;',
}

// Build reverse map
const DECODE_MAP: Record<string, string> = {}
Object.entries(ENTITY_MAP).forEach(([char, entity]) => {
  DECODE_MAP[entity] = char
})

function encodeHtmlEntities(input: string, namedOnly: boolean): string {
  if (!input) return ''
  
  // Always encode the critical ones
  let result = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  if (!namedOnly) {
    Object.entries(ENTITY_MAP).forEach(([char, entity]) => {
      if (char !== '&' && char !== '<' && char !== '>') {
        result = result.split(char).join(entity)
      }
    })
  }
  
  return result
}

function decodeHtmlEntities(input: string): string {
  if (!input) return ''
  return input.replace(/&(#?[\d\w]+);/g, (match, entity) => {
    // Named entity
    const named = `&${entity};`
    if (DECODE_MAP[named]) return DECODE_MAP[named]
    
    // Decimal numeric entity &#123;
    if (match.startsWith('&#') && match.endsWith(';') && !entity.startsWith('x')) {
      const num = parseInt(entity, 10)
      if (!isNaN(num)) return String.fromCharCode(num)
    }
    
    // Hex numeric entity &#xAB;
    if (match.startsWith('&#x') && match.endsWith(';')) {
      const num = parseInt(entity.slice(1), 16)
      if (!isNaN(num)) return String.fromCharCode(num)
    }
    
    return match
  })
}

export function HtmlEntityTool({ tool }: ToolProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [copied, setCopied] = useState(false)
  const [namedOnly, setNamedOnly] = useState(false)

  const handleProcess = useCallback(() => {
    if (!input.trim()) {
      setOutput(null)
      return
    }
    setCopied(false)
    if (mode === 'encode') {
      setOutput(encodeHtmlEntities(input, namedOnly))
    } else {
      setOutput(decodeHtmlEntities(input))
    }
  }, [input, mode, namedOnly])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [output])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => handleProcess()}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Mode</div>
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('encode'); setOutput(null); }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs ${
                  mode === 'encode'
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'border border-border bg-base/50 text-muted hover:text-text'
                }`}
              >
                Encode
              </button>
              <button
                onClick={() => { setMode('decode'); setOutput(null); }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs ${
                  mode === 'decode'
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'border border-border bg-base/50 text-muted hover:text-text'
                }`}
              >
                Decode
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Encode Options</div>
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={namedOnly}
                onChange={(e) => setNamedOnly(e.target.checked)}
                className="rounded border-border bg-base/50"
              />
              Named entities only (critical + symbols)
            </label>
          </div>
          <Button onClick={handleProcess} className="w-full">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Convert
          </Button>
          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted">
            {mode === 'encode' ? 'Plain text to encode' : 'HTML entities to decode'}
          </label>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setOutput(null); }}
            placeholder={mode === 'encode' ? 'Enter plain text...' : 'Enter HTML entities like &amp; &lt; &gt;'}
            rows={8}
            className="w-full rounded-xl border border-border bg-base/70 px-3 py-3 text-sm font-mono text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        {output && (
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-muted">
                {mode === 'encode' ? 'Encoded output' : 'Decoded output'}
              </div>
              <Button variant="ghost" className="h-6 text-xs" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle className="mr-1 h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="mr-1 h-3 w-3" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="rounded-xl border border-border bg-base/60 p-3 text-sm font-mono whitespace-pre-wrap break-words text-text max-h-64 overflow-auto">
              {output}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
