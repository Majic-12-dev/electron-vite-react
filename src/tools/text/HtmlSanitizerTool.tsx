import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Copy, Download, Minimize2, Maximize2, Eye, Shield } from 'lucide-react'

type HtmlSanitizerToolProps = {
  tool: ToolDefinition
}

type SanitizeMode = 'remove' | 'minify' | 'beautify' | 'text-only' | 'links' | 'images'

export function HtmlSanitizerTool({ tool }: HtmlSanitizerToolProps) {
  const [mode, setMode] = useState<SanitizeMode>('remove')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [stats, setStats] = useState<{ before: number; after: number } | null>(null)
  const [dangerousTags, setDangerousTags] = useState<string[]>(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link'])

  const toggleTag = useCallback((tag: string) => {
    setDangerousTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }, [])

  const sanitize = useCallback(() => {
    if (!input.trim()) {
      setOutput('')
      setStats(null)
      return
    }

    const beforeSize = new Blob([input]).size
    let result = input

    if (mode === 'remove') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(input, 'text/html')
      dangerousTags.forEach((tag) => {
        doc.querySelectorAll(tag).forEach((el) => el.remove())
      })
      result = doc.body.innerHTML
    } else if (mode === 'minify') {
      result = input
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim()
    } else if (mode === 'beautify') {
      result = input
        .replace(/></g, '>\n<')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
    } else if (mode === 'text-only') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(input, 'text/html')
      result = doc.body.textContent || ''
    } else if (mode === 'links') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(input, 'text/html')
      const links = Array.from(doc.querySelectorAll('a[href]'))
        .map((a) => `  <a href="${a.getAttribute('href')}">${a.textContent?.trim()}</a>`)
        .join('\n')
      result = `<div>\n${links}\n</div>`
    } else if (mode === 'images') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(input, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img[src]'))
        .map((img) => `  <img src="${img.getAttribute('src')}" alt="${img.getAttribute('alt') || ''}" />`)
        .join('\n')
      result = `<div>\n${imgs}\n</div>`
    }

    const afterSize = new Blob([result]).size
    setOutput(result)
    setStats({ before: beforeSize, after: afterSize })
  }, [input, mode, dangerousTags])

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (r: ReactNode | null) => void
        setError: (m: string | null) => void
      },
    ) => {
      try {
        let htmlContent = input
        if (files.length > 0) {
          htmlContent = await files[0].file.text()
          setInput(htmlContent)
        }
        context.setProgress(30)
        sanitize()
        context.setProgress(100)
        context.setResult(null)
      } catch (err) {
        context.setError(err instanceof Error ? err.message : 'Sanitization failed.')
      }
    },
    [input, sanitize],
  )

  const copyOutput = () => {
    navigator.clipboard.writeText(output)
  }

  const downloadOutput = () => {
    const blob = new Blob([output], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sanitized.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  const modes: { value: SanitizeMode; label: string; icon: ReactNode }[] = [
    { value: 'remove', label: 'Remove Danger Tags', icon: <Shield className="h-4 w-4"/> },
    { value: 'minify', label: 'Minify', icon: <Minimize2 className="h-4 w-4"/> },
    { value: 'beautify', label: 'Beautify', icon: <Maximize2 className="h-4 w-4"/> },
    { value: 'text-only', label: 'Text Only', icon: <Eye className="h-4 w-4"/> },
    { value: 'links', label: 'Extract Links', icon: <Maximize2 className="h-4 w-4"/> },
    { value: 'images', label: 'Extract Images', icon: <Eye className="h-4 w-4"/> },
  ]

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={handleProcess}
      accept=".html,.htm"
    >
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => (
            <Button
              key={m.value}
              variant={mode === m.value ? 'primary' : 'ghost'}
              size="sm"
              className="gap-1"
              onClick={() => setMode(m.value)}
            >
              {m.icon} {m.label}
            </Button>
          ))}
        </div>

        {/* Dangerous tags toggle (shown only in 'remove' mode) */}
        {mode === 'remove' && (
          <div className="p-2 rounded border border-border space-y-2">
            <span className="text-xs font-semibold text-foreground">Tags to remove:</span>
            <div className="flex flex-wrap gap-1">
              {['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link'].map((tag) => (
                <Badge
                  key={tag}
                  className={`cursor-pointer text-xs ${dangerousTags.includes(tag) ? 'bg-destructive/20 text-destructive' : 'bg-muted/50'}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input textarea */}
        <div>
          <label className="text-xs font-semibold text-foreground">Input HTML</label>
          <textarea
            className="w-full h-40 rounded border border-border bg-base p-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-accent"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="<p>Paste HTML here...</p>"
          />
        </div>

        {/* Sanitize button */}
        <Button onClick={sanitize} disabled={!input.trim()}>
          Sanitize
        </Button>

        {/* Output */}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Output</span>
              {stats && (
                <Badge className="text-xs">
                  {stats.before.toLocaleString()} → {stats.after.toLocaleString()} bytes
                  ({stats.after < stats.before ? '-' : '+'}{((stats.after - stats.before) / Math.max(stats.before, 1) * 100).toFixed(1)}%)
                </Badge>
              )}
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={copyOutput} className="gap-1 text-xs">
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadOutput} className="gap-1 text-xs">
                  <Download className="h-3 w-3" /> Download
                </Button>
              </div>
            </div>
            <textarea
              className="w-full h-40 rounded border border-border bg-base p-2 text-xs font-mono resize-y"
              value={output}
              readOnly
            />
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
