import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Type, FileText, Hash, List, BookOpen } from 'lucide-react'

type WordCounterToolProps = {
  tool: ToolDefinition
}

type TextMetrics = {
  words: number
  wordsWithoutSpaces: number
  characters: number
  charactersWithoutSpaces: number
  sentences: number
  paragraphs: number
  lines: number
  readingTime: string
  speakingTime: string
}

function analyzeText(text: string): TextMetrics {
  const trimmed = text.trim()
  if (!trimmed) {
    return { words: 0, wordsWithoutSpaces: 0, characters: 0, charactersWithoutSpaces: 0, sentences: 0, paragraphs: 0, lines: 0, readingTime: '0s', speakingTime: '0s' }
  }
  const words = trimmed.split(/\s+/).filter(Boolean)
  const characters = text.length
  const charactersWithoutSpaces = text.replace(/\s/g, '').length
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  const paragraphs = trimmed.split(/\n\n+/).filter(s => s.trim().length > 0).length
  const lines = trimmed.split(/\n/).length
  const wordCount = words.length
  // Average reading speed: 238 WPM, speaking: 150 WPM
  const readingSec = (wordCount / 238) * 60
  const speakingSec = (wordCount / 150) * 60
  const fmt = (s: number) => {
    if (s < 60) return `${Math.ceil(s)}s`
    const m = Math.floor(s / 60)
    const r = Math.ceil(s % 60)
    return r > 0 ? `${m}m ${r}s` : `${m}m`
  }
  return {
    words: wordCount,
    wordsWithoutSpaces: wordCount,
    characters,
    charactersWithoutSpaces,
    sentences,
    paragraphs,
    lines,
    readingTime: fmt(readingSec),
    speakingTime: fmt(speakingSec),
  }
}

export function WordCounterTool({ tool }: WordCounterToolProps) {
  const [text, setText] = useState('')
  const metrics = useMemo(() => analyzeText(text), [text])

  const handleClear = useCallback(() => setText(''), [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Statistics</div>
            <div className='grid grid-cols-2 gap-2'>
              {[
                { icon: Type, label: 'Words', value: metrics.words },
                { icon: FileText, label: 'Characters', value: metrics.characters },
                { icon: Hash, label: 'Sentences', value: metrics.sentences },
                { icon: List, label: 'Paragraphs', value: metrics.paragraphs },
                { icon: Type, label: 'Lines', value: metrics.lines },
                { icon: BookOpen, label: 'Read Time', value: metrics.readingTime },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className='rounded-xl border border-border bg-base/60 px-3 py-2'>
                  <div className='flex items-center gap-1.5 text-xs text-muted'>
                    <Icon className='h-3 w-3' />
                    {label}
                  </div>
                  <div className='font-mono text-lg font-semibold text-text'>{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Estimates</div>
            <div className='space-y-1 text-xs text-muted'>
              <div className='flex justify-between'>
                <span>Reading (238 WPM)</span>
                <span className='font-mono text-accent'>{metrics.readingTime}</span>
              </div>
              <div className='flex justify-between'>
                <span>Speaking (150 WPM)</span>
                <span className='font-mono text-accent'>{metrics.speakingTime}</span>
              </div>
              <div className='flex justify-between'>
                <span>Char (no spaces)</span>
                <span className='font-mono text-accent'>{metrics.charactersWithoutSpaces}</span>
              </div>
            </div>
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>Input text</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Paste or type your text here to get live word count and reading time...'
            rows={12}
            className='font-mono'
          />
        </div>
        <div className='flex gap-2'>
          {text && (
            <button
              type='button'
              onClick={handleClear}
              className='text-xs text-muted underline hover:text-text'
            >
              Clear text
            </button>
          )}
        </div>
      </div>
    </BaseToolLayout>
  )
}
