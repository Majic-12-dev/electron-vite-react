import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Copy, Braces, Minimize, Maximize2, AlertTriangle, CheckCircle2 } from 'lucide-react'

type JsonFormatterToolProps = {
  tool: ToolDefinition
}

type FormatMode = 'pretty' | 'minify'

export function JsonFormatterTool({ tool }: JsonFormatterToolProps) {
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<FormatMode>('pretty')
  const [copied, setCopied] = useState(false)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const result = useMemo(() => {
    if (!raw.trim()) return { valid: false as const, output: '', error: null, stats: null }

    try {
      const parsed = JSON.parse(raw)
      let output: string
      if (mode === 'pretty') {
        output = JSON.stringify(parsed, null, 2)
      } else {
        output = JSON.stringify(parsed)
      }

      // Compute some basic stats
      const jsonStr = JSON.stringify(parsed)
      const stats = {
        type: Array.isArray(parsed) ? `Array(${parsed.length})` : typeof parsed,
        originalLen: raw.length,
        outputLen: output.length,
        jsonLen: jsonStr.length,
        keys: typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? Object.keys(parsed).length
          : null,
      }

      return { valid: true as const, output, error: null, stats }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown JSON parse error'

      // Enhance error message with common patterns
      const enhancedError = enhanceErrorMessage(message, raw)

      return { valid: false as const, output: '', error: enhancedError, stats: null }
    }
  }, [raw, mode])

  const handleCopy = useCallback(() => {
    if (!result.valid || !result.output) return
    navigator.clipboard.writeText(result.output).then(() => {
      setCopied(true)
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // ignore
    })
  }, [result])

  const handleClear = useCallback(() => {
    setRaw('')
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Format Mode</div>
            <Select value={mode} onChange={(e) => setMode(e.target.value as FormatMode)}>
              <option value="pretty">Pretty Print (2-space)</option>
              <option value="minify">Minify</option>
            </Select>
          </div>
          {result.valid ? (
            result.stats && (
              <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valid JSON
                </div>
                <div className="space-y-0.5 text-xs text-muted">
                  <div>Type: {result.stats.type}</div>
                  {result.stats.keys !== null && <div>Root keys: {result.stats.keys}</div>}
                  <div>Output size: {result.stats.outputLen.toLocaleString()} chars</div>
                  {mode === 'minify' && (
                    <div>
                      Compressed: {((1 - result.stats.outputLen / result.stats.originalLen) * 100).toFixed(1)}%
                      {' '}smaller
                    </div>
                  )}
                </div>
              </div>
            )
          ) : result.error ? (
            <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Invalid JSON
              </div>
              <pre className="text-xs text-red-300 whitespace-pre-wrap leading-relaxed">
                {result.error}
              </pre>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleCopy}
              disabled={!result.valid}
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
            <Button variant="outline" onClick={handleClear} className="w-full">
              Clear
            </Button>
          </div>
        </div>
      }
    >
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="w-full min-h-[220px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
        placeholder={'Paste JSON here\n\n{\n  "key": "value"\n}'}
        spellCheck={false}
      />
      {result.valid && result.output && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Braces className="h-4 w-4 text-muted" />
            <span className="text-xs font-semibold uppercase text-muted">
              {mode === 'pretty' ? 'Formatted Result' : 'Minified Result'}
            </span>
          </div>
          <div
            className="max-h-[500px] overflow-auto border border-border rounded-lg bg-[#0d1117] p-3 text-sm font-mono"
          >
            <pre className="text-emerald-300 whitespace-pre">{result.output}</pre>
          </div>
        </div>
      )}
    </BaseToolLayout>
  )
}

function enhanceErrorMessage(message: string, raw: string): string {
  const lines = raw.split('\n')

  // Extract position info from the error message
  const posMatch = message.match(/position\s+(\d+)/i)
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10)
    if (!isNaN(pos) && pos >= 0) {
      let charCount = 0
      let lineNum = 1
      let colNum = 1
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length + 1 > pos) {
          lineNum = i + 1
          colNum = pos - charCount + 1
          break
        }
        charCount += lines[i].length + 1 // +1 for newline
      }
      const contextStart = Math.max(0, lineNum - 3)
      const contextEnd = Math.min(lines.length, lineNum + 2)
      const context = lines
        .slice(contextStart, contextEnd)
        .map((l, i) => `${contextStart + i + 1}: ${l}`)
        .join('\n')

      const charAt = pos < raw.length ? raw[pos] : 'EOF'
      return `${message}\nAt line ${lineNum}, column ${colNum} (near: "${charAt}")\n\nContext:\n${context}`
    }
  }

  return message
}
