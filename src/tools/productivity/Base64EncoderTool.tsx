import { useState, useCallback, useRef, ChangeEvent } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  Copy,
  CheckCircle2,
  FileUp,
  FileDown,
  ArrowLeftRight,
  AlertTriangle,
  Code2,
  Download,
} from 'lucide-react'

type Base64EncoderToolProps = {
  tool: ToolDefinition
}

type TabMode = 'text' | 'file'

const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/

function looksLikeBase64(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length < 4) return false
  // Must be all valid base64 chars
  if (!BASE64_REGEX.test(trimmed.replace(/\s/g, ''))) return false
  // Reasonable length (not just random short string)
  if (trimmed.length < 20) return false
  return true
}

export function Base64EncoderTool({ tool }: Base64EncoderToolProps) {
  const [tab, setTab] = useState<TabMode>('text')

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-4">
        <TabBar value={tab} onChange={setTab} />
        {tab === 'text' ? <TextMode /> : <FileMode />}
      </div>
    </BaseToolLayout>
  )
}

// ─── Tab bar ────────────────────────────────────────────────────────────────

function TabBar({ value, onChange }: { value: TabMode; onChange: (t: TabMode) => void }) {
  return (
    <div className="flex gap-2">
      {(['text', 'file'] as TabMode[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            value === t
              ? 'bg-accent text-white'
              : 'bg-base/60 text-muted hover:bg-base hover:text-text'
          }`}
        >
          {t === 'text' ? 'Text Mode' : 'File Mode'}
        </button>
      ))}
    </div>
  )
}

// ─── Text Mode ──────────────────────────────────────────────────────────────

function TextMode() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEncode = useCallback(() => {
    try {
      setError(null)
      setMode('encode')
      setOutput(btoa(unescape(encodeURIComponent(input))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encoding failed')
      setOutput('')
    }
  }, [input])

  const handleDecode = useCallback(() => {
    try {
      setError(null)
      setMode('decode')
      setOutput(decodeURIComponent(escape(atob(input.trim()))))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid Base64 input'
      setError(msg)
      setOutput('')
    }
  }, [input])

  // Auto-detect: suggest decode if input looks like base64
  const suggestDecode = looksLikeBase64(input) && mode !== 'decode'

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [output])

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted">
          Input Text
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full min-h-[160px] rounded-lg border border-border bg-base/50 p-3 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Type or paste text here…"
          spellCheck={false}
        />
      </div>

      {suggestDecode && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Input looks like Base64 — did you want to decode it?</span>
            <Button
              variant="ghost"
              onClick={handleDecode}
              className="ml-auto h-auto px-2 py-0.5 text-xs"
            >
            <ArrowLeftRight className="mr-1 h-3 w-3" />
            Decode
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleEncode} disabled={!input.trim()}>
          <Code2 className="mr-2 h-4 w-4" />
          Encode
        </Button>
        <Button onClick={handleDecode} disabled={!input.trim()} variant="secondary">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Decode
        </Button>
      </div>

      {error && (
        <Card className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </Card>
      )}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">
              {mode === 'encode' ? 'Encoded (Base64)' : 'Decoded Result'}
            </span>
            <Button
              variant="ghost"
              onClick={handleCopy}
              className="h-auto p-1 text-xs"
            >
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
          </div>
          <textarea
            readOnly
            value={output}
            className="w-full min-h-[120px] rounded-lg border border-border bg-[#0d1117] p-3 text-sm font-mono text-emerald-300 resize-y"
          />
        </div>
      )}
    </div>
  )
}

// ─── File Mode ──────────────────────────────────────────────────────────────

function FileMode() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [base64Output, setBase64Output] = useState<string | null>(null)
  const [decodeInput, setDecodeInput] = useState('')
  const [decodeFileName, setDecodeFileName] = useState('decoded-file')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const decodeInputRef = useRef<HTMLTextAreaElement>(null)

  const handleFilePick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setError(null)
      setFileName(file.name)
      setDecodeFileName(`decoded-${file.name}`)
      setBase64Output(null)
      setMode('encode')

      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip data:…;base64, prefix to get raw base64
        const raw = result.includes(',') ? result.split(',')[1] : result
        setBase64Output(raw)
      }
      reader.onerror = () => {
        setError('Failed to read file')
      }
      reader.readAsDataURL(file)

      // Reset input so same file can be re-selected
      e.target.value = ''
    },
    [],
  )

  const handleDownloadBase64 = useCallback(() => {
    if (!base64Output) return
    const blob = new Blob([base64Output], { type: 'text/plain' })
    triggerDownload(blob, `${fileName || 'output'}.b64`)
  }, [base64Output, fileName])

  const handleDecodeFile = useCallback(() => {
    if (!decodeInput.trim()) {
      setError('Paste Base64 data to decode')
      return
    }
    setError(null)
    setMode('decode')
    try {
      const raw = decodeInput.trim().replace(/\s/g, '')
      const byteCharacters = atob(raw)
      const bytes = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        bytes[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([bytes])
      triggerDownload(blob, decodeFileName || 'decoded-file')
      setFileName(null)
      setBase64Output(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid Base64 input')
    }
  }, [decodeInput, decodeFileName])

  return (
    <div className="space-y-4">
      {/* Encode section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text">Encode File → Base64</h3>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFilePick}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="secondary"
          className="w-full"
        >
          <FileUp className="mr-2 h-4 w-4" />
          Choose File to Encode
        </Button>

        {fileName && (
          <div className="rounded-lg border border-border bg-base/60 px-3 py-2 text-xs text-muted">
            Selected: <span className="text-text font-medium">{fileName}</span>
          </div>
        )}

        {base64Output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">Base64 Output</span>
              <Button variant="ghost" onClick={handleDownloadBase64} className="text-xs">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">Download .b64</span>
              </Button>
            </div>
            <textarea
              readOnly
              value={base64Output}
              className="w-full min-h-[100px] rounded-lg border border-border bg-[#0d1117] p-3 text-xs font-mono text-emerald-300 resize-y"
            />
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Decode section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text">Decode Base64 → File</h3>
        <textarea
          ref={decodeInputRef}
          value={decodeInput}
          onChange={(e) => setDecodeInput(e.target.value)}
          className="w-full min-h-[120px] rounded-lg border border-border bg-base/50 p-3 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Paste Base64 data here…"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={decodeFileName}
            onChange={(e) => setDecodeFileName(e.target.value)}
            placeholder="decoded-file"
            className="w-full rounded-lg border border-border bg-base/50 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button onClick={handleDecodeFile} disabled={!decodeInput.trim()}>
            <FileDown className="mr-2 h-4 w-4" />
            Decode & Download
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </Card>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
