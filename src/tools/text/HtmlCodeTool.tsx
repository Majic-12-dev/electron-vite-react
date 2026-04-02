import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Code2, Copy, CheckCircle, FileCode } from 'lucide-react'

type HtmlCodeToolProps = {
  tool: ToolDefinition
}

function encodeHtml(input: string): string {
  const el = document.createElement('textarea')
  el.textContent = input
  return el.innerHTML
}

function decodeHtml(input: string): string {
  const el = document.createElement('textarea')
  el.innerHTML = input
  return el.value
}

type Mode = 'encode' | 'decode'

export function HtmlCodeTool({ tool }: HtmlCodeToolProps) {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('encode')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProcess = useCallback(() => {
    if (!inputText.trim()) {
      setError('Please enter some text or HTML.')
      setOutputText(null)
      return
    }
    try {
      if (mode === 'encode') {
        setOutputText(encodeHtml(inputText))
      } else {
        setOutputText(decodeHtml(inputText))
      }
      setError(null)
    } catch {
      setError('Failed to process the input.')
      setOutputText(null)
    }
  }, [inputText, mode])

  const handleCopy = useCallback(() => {
    if (!outputText) return
    navigator.clipboard.writeText(outputText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [outputText])

  const handleClear = useCallback(() => {
    setInputText('')
    setOutputText(null)
    setError(null)
  }, [])

  const inputChars = inputText.length
  const outputChars = outputText?.length ?? 0

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Mode</div>
            <div className='flex gap-2'>
              {([
                { v: 'encode' as Mode, label: 'Encode → Entities' },
                { v: 'decode' as Mode, label: 'Decode → HTML' },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => {
                    setMode(opt.v)
                    setOutputText(null)
                    setError(null)
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition ${
                    mode === opt.v
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-base/60 text-muted hover:text-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Quick Examples</div>
            <div className='flex flex-wrap gap-2'>
              {mode === 'encode' ? (
                ['<b>bold</b>', '<p class="a">Hello &amp; bye</p>', '<div>1 < 2</div>'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInputText(s)
                      setError(null)
                    }}
                    className='rounded-full border border-border bg-base/60 px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-text'
                  >
                    {s.slice(0, 18)}…
                  </button>
                ))
              ) : (
                ['&lt;b&gt;Hello&lt;/b&gt;', '&amp; &quot; &apos;', '&#60;div&#62;'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInputText(s)
                      setError(null)
                    }}
                    className='rounded-full border border-border bg-base/60 px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-text'
                  >
                    {s.slice(0, 20)}…
                  </button>
                ))
              )}
            </div>
          </div>

          <Button onClick={handleProcess} disabled={!inputText.trim()} className='w-full'>
            <FileCode className='mr-2 h-4 w-4' />
            {mode === 'encode' ? 'Encode' : 'Decode'}
          </Button>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Input */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <label className='text-xs font-semibold uppercase text-muted'>Input</label>
            {inputChars > 0 && <span className='text-[10px] text-muted'>{inputChars} chars</span>}
          </div>
          <Textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value)
              setError(null)
            }}
            placeholder={mode === 'encode' ? '<p>Enter HTML here...</p>' : '&lt;p&gt;Enter entities here...&lt;/p&gt;'}
            rows={6}
            className='font-mono text-sm'
          />
        </div>

        {/* Output */}
        {outputText && (
          <Card className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
                <Code2 className='h-3.5 w-3.5' />
                {mode === 'encode' ? 'Encoded entities' : 'Decoded HTML'}
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] text-muted'>{outputChars} chars</span>
                <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
                  {copied ? (
                    <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                  ) : (
                    <Copy className='mr-1 h-3 w-3' />
                  )}
                  Copy
                </Button>
              </div>
            </div>
            <pre className='overflow-x-auto rounded-xl border border-border bg-base/60 p-3 text-xs text-text whitespace-pre-wrap break-all'>
              {outputText}
            </pre>
          </Card>
        )}

        {error && (
          <Card className='border border-red-500/50 bg-red-500/10 text-sm text-red-200'>
            {error}
          </Card>
        )}

        <Button variant='ghost' onClick={handleClear} disabled={!inputText && !outputText}>
          Clear All
        </Button>
      </div>
    </BaseToolLayout>
  )
}
