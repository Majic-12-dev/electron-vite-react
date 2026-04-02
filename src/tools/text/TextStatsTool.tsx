import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { BarChart3, Copy, CheckCircle, Type, FileText, Clock, Hash, List, BookOpen, TrendingUp } from 'lucide-react'

type TextStatsToolProps = {
  tool: ToolDefinition
}

interface TextMetrics {
  wordCount: number
  charCount: number
  charCountNoSpaces: number
  sentenceCount: number
  paragraphCount: number
  readingTime: string
  speakingTime: string
  fleschEase: number
  fleschGrade: number
  keywordDensity: Array<{word: string; count: number; density: number}>
  charFrequency: Array<{char: string; count: number; percentage: number}>
  topWords: Array<{word: string; count: number}>
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const m = word.match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

function analyzeText(text: string): TextMetrics | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const chars = text.length
  const charsNoSpaces = text.replace(/\s/g, '').length
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const sentenceCount = Math.max(sentences.length, 1)
  const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  const paragraphCount = Math.max(paragraphs.length, 1)

  // Reading/Speaking time
  const readingSec = (wordCount / 238) * 60
  const speakingSec = (wordCount / 150) * 60
  const fmt = (s: number) => {
    if (s < 60) return `${Math.ceil(s)}s`
    const m = Math.floor(s / 60)
    const r = Math.ceil(s % 60)
    return r > 0 ? `${m}m ${r}s` : `${m}m`
  }

  // Flesch Readability
  const syllables = words.reduce((sum, w) => sum + countSyllables(w.replace(/[^a-zA-Z]/g, '')), 0)
  const avgSyllables = wordCount > 0 ? syllables / wordCount : 0
  const fleschEase = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * avgSyllables
  const fleschGrade = 0.39 * (wordCount / sentenceCount) + 11.8 * avgSyllables - 15.59

  // Character frequency
  const charFreq: Record<string, number> = {}
  for (const ch of text.toLowerCase()) {
    if (/[a-z]/.test(ch)) {
      charFreq[ch] = (charFreq[ch] || 0) + 1
    }
  }
  const totalCharsAlpha = Object.values(charFreq).reduce((a, b) => a + b, 0)
  const charFrequency = Object.entries(charFreq)
    .map(([char, count]) => ({ char, count, percentage: totalCharsAlpha > 0 ? (count / totalCharsAlpha) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Keyword density
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'i', 'me', 'my', 'myself',
    'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
    'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom',
    'this', 'that', 'these', 'those', 'am', 'and', 'but', 'if', 'or', 'because', 'about'
  ])

  const freq: Record<string, number> = {}
  let meaningfulCount = 0
  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '')
    if (clean.length > 2 && !stopWords.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1
      meaningfulCount++
    }
  })

  const keywordDensity = Object.entries(freq)
    .map(([word, count]) => ({ word, count, density: meaningfulCount > 0 ? (count / meaningfulCount) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const topWords = Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    wordCount,
    charCount: chars,
    charCountNoSpaces: charsNoSpaces,
    sentenceCount,
    paragraphCount,
    readingTime: fmt(readingSec),
    speakingTime: fmt(speakingSec),
    fleschEase: Math.max(0, Math.min(100, fleschEase)),
    fleschGrade: Math.max(0, fleschGrade),
    keywordDensity,
    charFrequency,
    topWords,
  }
}

export function TextStatsTool({ tool }: TextStatsToolProps) {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const metrics = useMemo(() => analyzeText(text), [text])

  const handleClear = useCallback(() => setText(''), [])

  const handleCopy = useCallback(() => {
    if (!metrics) return
    const report = `Text Statistics Report
━━━━━━━━━━━━━━━━━━━━━━

Words: ${metrics.wordCount}
Characters: ${metrics.charCount} (${metrics.charCountNoSpaces} without spaces)
Sentences: ${metrics.sentenceCount}
Paragraphs: ${metrics.paragraphCount}

Readability:
  Flesch Reading Ease: ${metrics.fleschEase.toFixed(1)} / 100
  Flesch-Kincaid Grade: ${metrics.fleschGrade.toFixed(1)}

Time:
  Reading: ${metrics.readingTime}
  Speaking: ${metrics.speakingTime}

Top Keywords:
${metrics.keywordDensity.map((kw, i) => `${i + 1}. ${kw.word} (${kw.count}x, ${kw.density.toFixed(1)}%)`).join('\n')}

Character Frequency:
${metrics.charFrequency.map(cf => `${cf.char.toUpperCase()}: ${cf.count} (${cf.percentage.toFixed(1)}%)`).join('\n')}
`
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [metrics])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Analysis Features</div>
            <ul className='text-xs text-muted space-y-1'>
              <li>• Word count & character analysis</li>
              <li>• Sentence & paragraph counts</li>
              <li>• Flesch-Kincaid readability</li>
              <li>• Keyword density</li>
              <li>• Character frequency distribution</li>
              <li>• Top words & reading time</li>
            </ul>
          </div>

          <Button onClick={handleCopy} disabled={!metrics} className='w-full'>
            {copied ? <CheckCircle className='mr-2 h-4 w-4' /> : <Copy className='mr-2 h-4 w-4' />}
            {copied ? 'Copied!' : 'Copy Report'}
          </Button>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>Input text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Paste or type your text here for comprehensive analysis...'
            rows={10}
            className='w-full min-h-[160px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
          />
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

        {metrics && (
          <>
            {/* Primary Stats */}
            <Card className='p-3'>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                {[
                  { icon: Type, label: 'Words', value: metrics.wordCount },
                  { icon: FileText, label: 'Characters', value: metrics.charCount },
                  { icon: Hash, label: 'Sentences', value: metrics.sentenceCount },
                  { icon: List, label: 'Paragraphs', value: metrics.paragraphCount },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className='text-center'>
                    <Icon className='h-4 w-4 mx-auto text-accent mb-1' />
                    <div className='text-lg font-mono font-bold text-text'>{value}</div>
                    <div className='text-xs text-muted'>{label}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Readability */}
            <Card className='p-3'>
              <div className='flex items-center gap-2 mb-3'>
                <TrendingUp className='h-4 w-4 text-muted' />
                <h3 className='text-sm font-semibold text-text'>Readability Analysis</h3>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <div className='text-xs text-muted'>Flesch Reading Ease</div>
                  <div className={`text-lg font-mono font-bold ${
                    metrics.fleschEase >= 70 ? 'text-green-400' : metrics.fleschEase >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {metrics.fleschEase.toFixed(1)} / 100
                  </div>
                  <div className='text-xs text-muted'>
                    {metrics.fleschEase >= 90 ? 'Very Easy (5th grade)' :
                     metrics.fleschEase >= 80 ? 'Easy (6th grade)' :
                     metrics.fleschEase >= 70 ? 'Fairly Easy (7th grade)' :
                     metrics.fleschEase >= 60 ? 'Standard (8-9th grade)' :
                     metrics.fleschEase >= 50 ? 'Fairly Difficult (10-12th grade)' :
                     metrics.fleschEase >= 30 ? 'Difficult (College)' : 'Very Difficult (Graduate)'}
                  </div>
                </div>
                <div>
                  <div className='text-xs text-muted'>Flesch-Kincaid Grade</div>
                  <div className='text-lg font-mono font-bold text-text'>{metrics.fleschGrade.toFixed(1)}</div>
                  <div className='text-xs text-muted'>U.S. school grade level</div>
                </div>
              </div>
            </Card>

            {/* Time Estimates */}
            <Card className='p-3'>
              <div className='flex items-center gap-2 mb-2'>
                <Clock className='h-4 w-4 text-muted' />
                <h3 className='text-sm font-semibold text-text'>Time Estimates</h3>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='text-center p-2 rounded-lg bg-base/50'>
                  <div className='text-xs text-muted'>📖 Reading</div>
                  <div className='font-mono font-bold text-text'>{metrics.readingTime}</div>
                  <div className='text-[10px] text-muted'>at 238 WPM</div>
                </div>
                <div className='text-center p-2 rounded-lg bg-base/50'>
                  <div className='text-xs text-muted'>🎤 Speaking</div>
                  <div className='font-mono font-bold text-text'>{metrics.speakingTime}</div>
                  <div className='text-[10px] text-muted'>at 150 WPM</div>
                </div>
              </div>
            </Card>

            {/* Keyword Density */}
            {metrics.keywordDensity.length > 0 && (
              <Card className='p-3'>
                <div className='flex items-center gap-2 mb-2'>
                  <BookOpen className='h-4 w-4 text-muted' />
                  <h3 className='text-sm font-semibold text-text'>Keyword Density</h3>
                </div>
                <div className='space-y-1'>
                  {metrics.keywordDensity.map((kw) => (
                    <div key={kw.word} className='flex items-center gap-2 text-xs'>
                      <span className='font-mono font-medium text-text w-24 truncate'>{kw.word}</span>
                      <div className='flex-1 h-2 bg-muted/20 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-accent/60 rounded-full transition-all'
                          style={{ width: `${Math.min(100, kw.density * 10)}%` }}
                        />
                      </div>
                      <span className='text-muted font-mono w-16 text-right'>{kw.count}× ({kw.density.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Character Frequency */}
            {metrics.charFrequency.length > 0 && (
              <Card className='p-3'>
                <div className='flex items-center gap-2 mb-2'>
                  <BarChart3 className='h-4 w-4 text-muted' />
                  <h3 className='text-sm font-semibold text-text'>Character Frequency</h3>
                </div>
                <div className='space-y-1'>
                  {metrics.charFrequency.map((cf) => (
                    <div key={cf.char} className='flex items-center gap-2 text-xs'>
                      <span className='font-mono font-bold text-text w-6'>{cf.char.toUpperCase()}</span>
                      <div className='flex-1 h-2 bg-muted/20 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-accent/40 rounded-full transition-all'
                          style={{ width: `${cf.percentage}%` }}
                        />
                      </div>
                      <span className='text-muted font-mono w-16 text-right'>{cf.count} ({cf.percentage.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </BaseToolLayout>
  )
}
