import { useState, useCallback, useRef, useMemo } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  Copy,
  CheckCircle2,
  AlertTriangle,
  IndentDecrease,
  Minimize2,
  FileCheck,
  FileCode,
} from 'lucide-react'

type XmlFormatterToolProps = {
  tool: ToolDefinition
}

type ActionMode = 'format' | 'minify' | 'validate'

function indentXml(xml: string, indentSize: number = 2): string {
  let formatted = ''
  let indent = 0
  const pad = ' '.repeat(indentSize)

  // Split by tags - handle self-closing and regular tags
  const lines = xml.replace(/>\s*</g, '><').trim()
  const chars = lines.split('')
  let i = 0

  while (i < chars.length) {
    const char = chars[i]

    if (char === '<') {
      // Extract the full tag
      let tag = ''
      while (i < chars.length && chars[i] !== '>') {
        tag += chars[i]
        i++
      }
      if (i < chars.length) {
        tag += chars[i] // add >
        i++
      }

      const isClosing = tag.startsWith('</')
      const isSelfClosing = tag.endsWith('/>') || /^<(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)(?:[\s/>]|$)/i.test(tag)

      if (isClosing) {
        indent = Math.max(0, indent - 1)
        formatted += pad.repeat(indent) + tag + '\n'
      } else if (isSelfClosing) {
        formatted += pad.repeat(indent) + tag + '\n'
      } else {
        formatted += pad.repeat(indent) + tag + '\n'
        indent++
      }
    } else if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') {
      // Text content
      let text = ''
      while (i < chars.length && chars[i] !== '<') {
        text += chars[i]
        i++
      }
      const trimmedText = text.trim()
      if (trimmedText) {
        formatted += pad.repeat(indent) + trimmedText + '\n'
      }
    } else {
      i++
    }
  }

  return formatted.trimEnd()
}

function minifyXml(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '') // remove comments
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim()
}

type ValidationResult = {
  valid: boolean
  error?: string
  line?: number
  column?: number
}

function validateXml(xml: string): ValidationResult {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const parseError = doc.querySelector('parsererror')

    if (parseError) {
      const errorText = parseError.textContent || 'Unknown XML parse error'

      // Try to extract line/column from Firefox and Chromium-style error messages
      let line: number | undefined
      let column: number | undefined

      // Chromium: "error on line X at column Y: ..."
      const chromeMatch = errorText.match(/line (\d+) at column (\d+)/i)
      if (chromeMatch) {
        line = parseInt(chromeMatch[1], 10)
        column = parseInt(chromeMatch[2], 10)
      }

      // Firefox: "XML Parsing Error: ... Line Number X, Column Y: ..."
      const ffMatch = errorText.match(/Line Number\s+(\d+),\s*Column\s+(\d+)/i)
      if (ffMatch) {
        line = parseInt(ffMatch[1], 10)
        column = parseInt(ffMatch[2], 10)
      }

      // Fallback: try "Line X:" pattern
      if (line === undefined) {
        const lineMatch = errorText.match(/[Ll]ine[:\s]+(\d+)/)
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10)
        }
      }

      return {
        valid: false,
        error: errorText.trim(),
        line,
        column,
      }
    }

    return { valid: true }
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Unknown XML validation error',
    }
  }
}

export function XmlFormatterTool({ tool }: XmlFormatterToolProps) {
  const [raw, setRaw] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasValidOutput = output !== null

  const handleFormat = useCallback(() => {
    if (!raw.trim()) return
    setValidation(null)
    try {
      // Validate first
      const valResult = validateXml(raw)
      if (!valResult.valid) {
        setOutput(null)
        setValidation(valResult)
        return
      }
      const formatted = indentXml(raw.trim(), 2)
      setOutput(formatted)
      setValidation(valResult)
    } catch (e) {
      setOutput(null)
      setValidation({
        valid: false,
        error: e instanceof Error ? e.message : 'Formatting error',
      })
    }
  }, [raw])

  const handleMinify = useCallback(() => {
    if (!raw.trim()) return
    setValidation(null)
    try {
      const valResult = validateXml(raw)
      if (!valResult.valid) {
        setOutput(null)
        setValidation(valResult)
        return
      }
      const minified = minifyXml(raw.trim())
      setOutput(minified)
      setValidation(valResult)
    } catch (e) {
      setOutput(null)
      setValidation({
        valid: false,
        error: e instanceof Error ? e.message : 'Minification error',
      })
    }
  }, [raw])

  const handleValidate = useCallback(() => {
    if (!raw.trim()) {
      setValidation(null)
      setOutput(null)
      return
    }
    const result = validateXml(raw)
    setValidation(result)
    if (result.valid) {
      // If valid but no format run, show formatted output
      const formatted = indentXml(raw.trim(), 2)
      setOutput(formatted)
    } else {
      setOutput(null)
    }
  }, [raw])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [output])

  const handleClear = useCallback(() => {
    setRaw('')
    setOutput(null)
    setValidation(null)
  }, [])

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-3">
        {/* Input */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted">
            Raw XML Input
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="w-full min-h-[180px] rounded-lg border border-border bg-base/50 p-3 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder={"<root>\n  <item>Hello</item>\n</root>"}
            spellCheck={false}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleFormat} disabled={!raw.trim()}>
            <IndentDecrease className="mr-2 h-4 w-4" />
            Format
          </Button>
          <Button onClick={handleMinify} disabled={!raw.trim()} variant="secondary">
            <Minimize2 className="mr-2 h-4 w-4" />
            Minify
          </Button>
          <Button onClick={handleValidate} disabled={!raw.trim()} variant="outline">
            <FileCheck className="mr-2 h-4 w-4" />
            Validate
          </Button>
          <Button onClick={handleClear} variant="ghost" disabled={!raw && !output}>
            Clear
          </Button>
        </div>

        {/* Validation feedback */}
        {validation && (
          <Card
            className={`p-3 text-sm ${
              validation.valid
                ? 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                : 'border border-red-500/50 bg-red-500/10 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span className="font-medium">Valid XML</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
                  <span className="font-medium">Invalid XML</span>
                </>
              )}
            </div>
            {validation.line !== undefined && (
              <div className="mt-1 text-xs opacity-80">
                Line {validation.line}
                {validation.column !== undefined ? `, Column ${validation.column}` : ''}
              </div>
            )}
            {!validation.valid && validation.error && (
              <pre className="mt-2 whitespace-pre-wrap text-xs font-mono leading-relaxed opacity-90">
                {validation.error}
              </pre>
            )}
          </Card>
        )}

        {/* Formatted / Minified Output */}
        {hasValidOutput && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">Output</span>
              {output && (
                <Button variant="ghost" onClick={handleCopy} className="h-auto p-1 text-xs">
                  {copied ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      <span className="text-xs text-muted">Copy</span>
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="max-h-[500px] overflow-auto rounded-lg border border-border bg-[#0d1117] p-3 text-sm font-mono">
              <pre className="text-emerald-300 whitespace-pre">{output}</pre>
            </div>
            {output && (
              <div className="text-xs text-muted">
                {(output.split('\n').length)} lines · {output.length.toLocaleString()} chars
              </div>
            )}
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
