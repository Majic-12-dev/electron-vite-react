import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, ArrowLeftRight, AlertCircle } from 'lucide-react'

type Base64ToolProps = {
  tool: ToolDefinition
}

export function Base64Tool({ tool }: Base64ToolProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleEncode = useCallback(() => {
    if (!input) { setOutput(null); return }
    try {
      const encoded = btoa(unescape(encodeURIComponent(input)))
      setOutput(encoded)
      setError(null)
    } catch (e) {
      setError('Failed to encode: input contains invalid characters.')
      setOutput(null)
    }
  }, [input])

  const handleDecode = useCallback(() => {
    if (!input) { setOutput(null); return }
    try {
      const decoded = decodeURIComponent(escape(atob(input.trim())))
      setOutput(decoded)
      setError(null)
    } catch (e) {
      setError('Failed to decode: input is not valid Base64.')
      setOutput(null)
    }
  }, [input])

  const handleProcess = useCallback(() => {
    if (mode === 'encode') handleEncode()
    else handleDecode()
  }, [mode, handleEncode, handleDecode])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [output])

  const handleSwap = useCallback(() => {
    if (output) {
      setInput(output)
      setOutput(input)
      setError(null)
      setMode(prev => prev === 'encode' ? 'decode' : 'encode')
    }
  }, [input, output])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Mode</div>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => { setMode('encode'); setError(null) }}
                className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-medium transition
                  ${mode === 'encode' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
              >
                Encode
              </button>
              <button
                type='button'
                onClick={() => { setMode('decode'); setError(null) }}
                className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-medium transition
                  ${mode === 'decode' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
              >
                Decode
              </button>
            </div>
          </div>
          <Button onClick={handleProcess} disabled={!input.trim()} className='w-full'>
            <ArrowLeftRight className='mr-2 h-4 w-4' />
            {mode === 'encode' ? 'Encode to Base64' : 'Decode from Base64'}
          </Button>
          {output && (
            <div className='space-y-1 text-xs text-muted'>
              <div className='flex justify-between'><span>Output length</span><span className='font-mono'>{output.length} chars</span></div>
            </div>
          )}
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>
            {mode === 'encode' ? 'Text to encode' : 'Base64 to decode'}
          </label>
          <Textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setOutput(null); setError(null) }}
            placeholder={mode === 'encode' ? 'Enter text to encode to Base64...' : 'Paste Base64 string to decode...'}
            rows={6}
            className='font-mono'
          />
        </div>

        {error && (
          <div className='flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
            <AlertCircle className='h-4 w-4 flex-shrink-0' />
            {error}
          </div>
        )}

        {output && (
          <Card className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='text-xs font-semibold text-accent'>
                {mode === 'encode' ? 'Base64 Encoded' : 'Decoded Text'}
              </div>
              <div className='flex gap-2'>
                <Button variant='ghost' className='h-6 text-[10px]' onClick={handleSwap}>
                  <ArrowLeftRight className='h-3 w-3' />
                </Button>
                <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
                  {copied ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <Copy className='mr-1 h-3 w-3' />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
            <Textarea value={output} onChange={() => {}} rows={6} readOnly className='font-mono text-sm' />
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
