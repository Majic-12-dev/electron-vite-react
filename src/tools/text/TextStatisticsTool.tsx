import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Copy, CheckCircle, BarChart3 } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

// Syllable counting helper
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const m = word.match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

function analyzeText(text: string) {
  if (!text.trim()) return null

  const chars = text.length
  const charsNoSpace = text.replace(/\s/g, '').length
  const words = text.trim().split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const sentenceCount = sentences.length
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  const paragraphCount = Math.max(paragraphs.length, 1)
  
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word.replace(/[^a-zA-Z]/g, '')), 0)
  
  // Average syllables per word
  const avgSyllables = wordCount > 0 ? syllableCount / wordCount : 0

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const flesch = sentenceCount > 0 && wordCount > 0
    ? Math.max(0, Math.min(100, 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * avgSyllables))
    : 0

  // Flesch-Kincaid Grade Level
  const fkGrade = sentenceCount > 0 && wordCount > 0
    ? 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59
    : 0

  // Unique words
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''))).size
  const lexicalDiversity = wordCount > 0 ? (uniqueWords / wordCount) * 100 : 0

  // Average word length
  const avgWordLength = wordCount > 0 ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0

  // Average sentence length
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0

  // Reading time (average 238 words per minute)
  const readingTimeMin = wordCount / 238

  // Speaking time (average 150 words per minute)
  const speakingTimeMin = wordCount / 150

  // Top words
  const freq: Record<string, number> = {}
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
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
    'this', 'that', 'these', 'those', 'am', 'and', 'but', 'if', 'or', 'because', 'about'])

  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
    if (clean.length > 2 && !stopWords.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1
    }
  })

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Reading level classification
  let readingLevel: string
  if (flesch >= 90) readingLevel = 'Very Easy (5th grade)'
  else if (flesch >= 80) readingLevel = 'Easy (6th grade)'
  else if (flesch >= 70) readingLevel = 'Fairly Easy (7th grade)'
  else if (flesch >= 60) readingLevel = 'Standard (8-9th grade)'
  else if (flesch >= 50) readingLevel = 'Fairly Difficult (10-12th grade)'
  else if (flesch >= 30) readingLevel = 'Difficult (College)'
  else readingLevel = 'Very Difficult (Graduate)'

  return {
    chars,
    charsNoSpace,
    wordCount,
    sentenceCount,
    paragraphCount,
    syllableCount,
    avgSyllables,
    flesch,
    fkGrade,
    uniqueWords,
    lexicalDiversity,
    avgWordLength,
    avgSentenceLength,
    readingTimeMin,
    speakingTimeMin,
    topWords,
    readingLevel,
  }
}

export function TextStatisticsTool({ tool }: ToolProps) {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const stats = analyzeText(input)

  const handleCopy = useCallback(() => {
    if (!stats) return
    const report = `Text Statistics Report
━━━━━━━━━━━━━━━━━━━━━━

Characters: ${stats.chars} (${stats.charsNoSpace} without spaces)
Words: ${stats.wordCount}
Sentences: ${stats.sentenceCount}
Paragraphs: ${stats.paragraphCount}
Syllables: ${stats.syllableCount}

Readability:
  Flesch Reading Ease: ${stats.flesch.toFixed(1)} / 100
  Reading Level: ${stats.readingLevel}
  Flesch-Kincaid Grade: ${stats.fkGrade.toFixed(1)}
  Lexical Diversity: ${stats.lexicalDiversity.toFixed(1)}%

Averages:
  Syllables per word: ${stats.avgSyllables.toFixed(1)}
  Word length: ${stats.avgWordLength.toFixed(1)} chars
  Sentence length: ${stats.avgSentenceLength.toFixed(1)} words

Estimated Time:
  Reading: ${stats.readingTimeMin < 1 ? `${Math.round(stats.readingTimeMin * 60)}s` : `${stats.readingTimeMin.toFixed(1)} min`}
  Speaking: ${stats.speakingTimeMin < 1 ? `${Math.round(stats.speakingTimeMin * 60)}s` : `${stats.speakingTimeMin.toFixed(1)} min`}

Top Words: ${stats.topWords.map(([w, c]) => `${w} (${c})`).join(', ')}
`
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [stats])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => {
        // Analysis is live; process button triggers report copy
        handleCopy()
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Metrics Tracked</div>
            <ul className="text-xs text-muted space-y-1">
              <li>• Character & word counts</li>
              <li>• Sentence & paragraph counts</li>
              <li>• Flesch Reading Ease score</li>
              <li>• Flesch-Kincaid Grade Level</li>
              <li>• Lexical Diversity (%)</li>
              <li>• Top frequent words</li>
              <li>• Estimated reading time</li>
              <li>• Estimated speaking time</li>
            </ul>
          </div>
          <Button onClick={handleCopy} disabled={!stats} className="w-full">
            <Copy className="mr-2 h-4 w-4" />
            Copy Report
          </Button>
          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted">Paste your text</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste article, essay, or any text to analyze..."
            rows={10}
            className="w-full rounded-xl border border-border bg-base/70 px-3 py-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        {stats && (
          <>
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Characters', stats.chars.toString()],
                ['Words', stats.wordCount.toString()],
                ['Sentences', stats.sentenceCount.toString()],
                ['Paragraphs', stats.paragraphCount.toString()],
              ].map(([label, value]) => (
                <Card key={label} className="text-center p-3">
                  <div className="text-lg font-mono font-bold text-accent">{value}</div>
                  <div className="text-xs text-muted">{label}</div>
                </Card>
              ))}
            </div>

            {/* Readability */}
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-semibold text-text">Readability Analysis</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted">Flesch Reading Ease</div>
                  <div className={`text-lg font-mono font-bold ${
                    stats.flesch >= 70 ? 'text-green-400' : stats.flesch >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {stats.flesch.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted">{stats.readingLevel}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Flesch-Kincaid Grade</div>
                  <div className="text-lg font-mono font-bold text-text">{stats.fkGrade.toFixed(1)}</div>
                  <div className="text-xs text-muted">U.S. school grade level</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Lexical Diversity</div>
                  <div className="text-lg font-mono font-bold text-text">{stats.lexicalDiversity.toFixed(1)}%</div>
                  <div className="text-xs text-muted">Unique words / total words</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Avg Sentence Length</div>
                  <div className="text-lg font-mono font-bold text-text">{stats.avgSentenceLength.toFixed(1)}</div>
                  <div className="text-xs text-muted">words per sentence</div>
                </div>
              </div>
            </Card>

            {/* Time Estimates */}
            <Card className="space-y-2">
              <h3 className="text-sm font-semibold text-text">Estimated Time</h3>
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border border-border bg-base/50 px-3 py-2 text-center">
                  <div className="text-xs text-muted">📖 Reading</div>
                  <div className="font-mono font-bold text-text">
                    {stats.readingTimeMin < 1 ? `${Math.round(stats.readingTimeMin * 60)}s` : `${stats.readingTimeMin.toFixed(1)} min`}
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-border bg-base/50 px-3 py-2 text-center">
                  <div className="text-xs text-muted">🎤 Speaking</div>
                  <div className="font-mono font-bold text-text">
                    {stats.speakingTimeMin < 1 ? `${Math.round(stats.speakingTimeMin * 60)}s` : `${stats.speakingTimeMin.toFixed(1)} min`}
                  </div>
                </div>
              </div>
            </Card>

            {/* Top Words */}
            {stats.topWords.length > 0 && (
              <Card className="space-y-2">
                <h3 className="text-sm font-semibold text-text">Most Frequent Words</h3>
                <div className="flex flex-wrap gap-2">
                  {stats.topWords.map(([word, count]) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-base/50 px-3 py-1 text-xs text-text"
                    >
                      <span className="font-medium">{word}</span>
                      <span className="text-muted">×{count}</span>
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Copy button */}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleCopy}>
                {copied ? (
                  <CheckIcon />
                ) : (
                  <CopyIcon />
                )}
                {copied ? 'Report Copied!' : 'Copy Full Report'}
              </Button>
            </div>
          </>
        )}
      </div>
    </BaseToolLayout>
  )
}

function CopyIcon() {
  return <Copy className="mr-2 h-4 w-4" />
}

function CheckIcon() {
  return <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
}
