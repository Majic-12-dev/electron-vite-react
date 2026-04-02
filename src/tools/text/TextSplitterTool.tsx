import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Split, Copy, CheckCircle, List } from 'lucide-react'

type TextSplitterToolProps = {
  tool: ToolDefinition
}

type SplitMode =
  | 'lines'
  | 'words'
  | 'characters'
  | 'sentences'
  | 'paragraphs'
  | 'custom'

export function TextSplitterTool({ tool }: TextSplitterToolProps) {
  const [inputText, setInputText] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('lines')
  const [customDelimiter, setCustomDelimiter] = useState(',')
  const [numChunks, setNumChunks] = useState(1)
  const [results, setResults] = useState<string[] | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const modeOptions: { value: SplitMode; label: string }[] = [
    { value: 'lines', label: 'Lines' },
    { value: 'words', label: 'Words' },
    { value: 'characters', label: 'Characters' },
    { value: 'sentences', label: 'Sentences' },
    { value: 'paragraphs', label: 'Paragraphs' },
    { value: 'custom', label: 'Custom' },
  ]

  const handleSplit = useCallback(() => {
    if (!inputText.trim()) return
    const text = inputText

    let chunks: string[]
    switch (splitMode) {
      case 'lines':
        chunks = text
          .split(/\r?\n/)
          .filter((l) => l.length > 0)
          .map((l) => l.trim())
        break
      case 'words':
        chunks = text.split(/\s+/).filter((w) => w.length > 0)
        break
      case 'characters':
        chunks = Array.from(text)
        break
      case 'sentences':
        chunks = text
          .split(/(?<=[.!?])\s+/)
          .filter((s) => s.length > 0)
          .map((s) => s.trim())
        break
      case 'paragraphs':
        chunks = text
          .split(/\n\s*\n/)
          .filter((p) => p.trim().length > 0)
          .map((p) => p.trim())
        break
      case 'custom':
        if (customDelimiter.length === 0) {
          chunks = [text]
        } else {
          chunks = text.split(customDelimiter).filter((s) => s.length > 0)
        }
        break
    }

    // Apply chunking if numChunks > 1
    if (numChunks > 1) {
      const chunkSize = Math.ceil(chunks.length / numChunks)
      const chunked: string[] = []
      for (let i = 0; i < chunks.length; i += chunkSize) {
        chunked.push(chunks.slice(i, i + chunkSize).join(' '))
      }
      setResults(chunked.slice(0, numChunks))
    } else {
      setResults(chunks)
    }
  }, [inputText, splitMode, customDelimiter, numChunks])

  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }, [])

  const handleCopyAll = useCallback(() => {
    if (!results) return
    navigator.clipboard.writeText(results.join('\n---\n')).then(() => {
      setCopiedIdx(-1)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }, [results])

  const inputLength = useMemo(() => inputText.length, [inputText])
  const resultCount = results?.length ?? 0

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Split by</div>
            <div className='grid grid-cols-2 gap-1'>
              {modeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSplitMode(value)}
                  className={`rounded-xl border px-2 py-2 text-center text-xs font-medium transition ${
                    splitMode === value
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-base/60 text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {splitMode === 'custom' && (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Delimiter</div>
              <Input
                value={customDelimiter}
                onChange={(e) => setCustomDelimiter(e.target.value)}
                placeholder="e.g. ',' or '|' or '\\t'"
              />
            </div>
          )}

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>
              Chunk into groups
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                className='h-8 w-8 rounded-lg'
                onClick={() => setNumChunks(Math.max(1, numChunks - 1))}
              >
                −
              </Button>
              <input
                type='number'
                min={1}
                max={100}
                value={numChunks}
                onChange={(e) =>
                  setNumChunks(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
                }
                className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-center text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              />
              <Button
                variant='ghost'
                className='h-8 w-8 rounded-lg'
                onClick={() => setNumChunks(Math.min(100, numChunks + 1))}
              >
                +
              </Button>
            </div>
          </div>

          <Button onClick={handleSplit} disabled={!inputText.trim()} className='w-full'>
            <Split className='mr-2 h-4 w-4' />
            Split Text
          </Button>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Input */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <label className='text-xs font-semibold uppercase text-muted'>Input text</label>
            {inputLength > 0 && <span className='text-[10px] text-muted'>{inputLength} chars</span>}
          </div>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Paste your text here...'
            rows={6}
          />
        </div>

        {/* Results */}
        {results && results.length > 0 && (
          <Card className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
                <List className='h-3.5 w-3.5' />
                {resultCount} {resultCount === 1 ? 'chunk' : 'chunks'}
              </div>
              <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopyAll}>
                {copiedIdx === -1 ? (
                  <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                ) : (
                  <Copy className='mr-1 h-3 w-3' />
                )}
                Copy All
              </Button>
            </div>
            <div className='max-h-[400px] overflow-y-auto space-y-2'>
              {results.map((chunk, i) => (
                <div
                  key={i}
                  className='group flex items-start justify-between gap-2 rounded-xl border border-border bg-base/60 p-3 transition'
                >
                  <div className='flex gap-2 min-w-0 flex-1'>
                    <span className='flex-shrink-0 rounded-md bg-accent/15 w-6 h-6 text-[10px] font-semibold flex items-center justify-center text-accent'>
                      {i + 1}
                    </span>
                    <pre className='text-xs text-text whitespace-pre-wrap break-all font-normal'>
                      {chunk}
                    </pre>
                  </div>
                  <button
                    onClick={() => handleCopy(chunk, i)}
                    className='flex-shrink-0 text-muted hover:text-text transition opacity-0 group-hover:opacity-100'
                  >
                    {copiedIdx === i ? (
                      <CheckCircle className='h-3.5 w-3.5 text-green-400' />
                    ) : (
                      <Copy className='h-3.5 w-3.5' />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
