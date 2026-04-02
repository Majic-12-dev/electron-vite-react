import { useState, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Shield, Copy, Download, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'

type DetectionCategory = 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'url'

type DetectedItem = {
  value: string
  category: DetectionCategory
  startIndex: number
  endIndex: number
  masked: string
}

const PII_PATTERNS: [DetectionCategory, RegExp][] = [
  ['email', /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g],
  ['phone', /(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g],
  ['credit_card', /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g],
  ['ip_address', /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g],
  ['url', /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g],
]

function maskValue(value: string, category: DetectionCategory): string {
  if (category === 'email') {
    const [user, domain] = value.split('@')
    if (!domain) return '[EMAIL]'
    const parts = domain.split('.')
    const maskedUser = user[0] + '***' + (user.length > 1 ? user[user.length - 1] : '')
    const maskedDomain = parts[0][0] + '***' + '.' + parts[parts.length - 1]
    return `${maskedUser}@${maskedDomain}`
  }
  return `[${category.toUpperCase().replace('_', ' ')}]`
}

export default function DataAnonymizerTool({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState('')
  const [detections, setDetections] = useState<DetectedItem[]>([])
  const [mode, setMode] = useState<'redact' | 'mask' | 'generic'>('mask')
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const detectPII = useCallback(() => {
    const found: DetectedItem[] = []
    for (const [category, pattern] of PII_PATTERNS) {
      const matches = [...input.matchAll(pattern)]
      const seen = new Set<string>()
      for (const m of matches) {
        if (seen.has(m[0])) continue
        seen.add(m[0])
        found.push({
          value: m[0],
          category,
          startIndex: m.index || 0,
          endIndex: (m.index || 0) + m[0].length,
          masked: maskValue(m[0], category),
        })
      }
    }
    found.sort((a, b) => a.startIndex - b.startIndex)
    setDetections(found)
    setDone(true)
  }, [input])

  const buildOutput = useCallback(() => {
    if (detections.length === 0) return input
    let result = input
    for (let i = detections.length - 1; i >= 0; i--) {
      const d = detections[i]
      let replacement: string
      if (mode === 'redact') replacement = '***'
      else if (mode === 'mask') replacement = d.masked
      else replacement = `[${d.category.toUpperCase().replace('_', ' ')}]`
      result = result.substring(0, d.startIndex) + replacement + result.substring(d.endIndex)
    }
    return result
  }, [input, detections, mode])

  const downloadOutput = () => {
    const output = buildOutput()
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'anonymized.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyOutput = () => {
    navigator.clipboard.writeText(buildOutput())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const counts: Record<string, number> = {}
  for (const d of detections) {
    counts[d.category] = (counts[d.category] || 0) + 1
  }

  const previewOutput = buildOutput()

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-4">
        <textarea
          className="w-full h-40 px-3 py-2 rounded-lg border border-border bg-input/50 text-base/90 placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/60 font-mono text-sm resize-y"
          placeholder="Paste text containing emails, phone numbers, SSNs, credit cards, IP addresses, URLs..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={detectPII} disabled={!input.trim()}>
            <Shield className="w-4 h-4 mr-1" /> Detect PII
          </Button>
          {detections.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyOutput}>
              <Copy className="w-4 h-4 mr-1" /> {copied ? 'Copied!' : 'Copy Anonymized'}
            </Button>
          )}
          {detections.length > 0 && (
            <Button size="sm" variant="outline" onClick={downloadOutput}>
              <Download className="w-4 h-4 mr-1" /> Download .txt
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="mode" checked={mode === 'mask'} onChange={() => setMode('mask')} /> Mask
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="mode" checked={mode === 'redact'} onChange={() => setMode('redact')} /> Redact (***)
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="mode" checked={mode === 'generic'} onChange={() => setMode('generic')} /> Generic Label
          </label>
        </div>

        {done && detections.length === 0 && (
          <Card className="rounded-xl border border-border/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="w-4 h-4 inline mr-1" /> No PII patterns detected in the text.
          </Card>
        )}

        {detections.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(counts).map(([cat, count]) => (
                <Badge key={cat} className={cn(
                  cat === 'email' ? 'bg-accent/10 text-accent border-accent/30' :
                  cat === 'phone' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                  'bg-destructive/10 text-destructive border-destructive/30'
                )}>
                  {cat.replace('_', ' ')}: {count}
                </Badge>
              ))}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {detections.map((d, i) => (
                <div key={i} className="flex gap-2 text-sm font-mono px-2 py-1 rounded bg-base/40">
                  <span className="text-accent min-w-[80px]">{d.category.replace('_', ' ')}</span>
                  <span className="text-destructive line-through">{d.value}</span>
                  <span className="text-muted">→</span>
                  <span className="text-success">{mode === 'mask' ? d.masked : `[${d.category.toUpperCase()}]`}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted mb-1">Preview:</p>
              <pre className="max-h-32 overflow-y-auto p-3 rounded-lg bg-base/30 text-sm font-mono whitespace-pre-wrap break-words">
                {previewOutput}
              </pre>
            </div>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
