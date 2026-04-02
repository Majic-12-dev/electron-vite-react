import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Copy, CheckCircle, BarChart3 } from 'lucide-react'
import { analyzeText } from '@/utils/textStats'

type ToolProps = {
  tool: ToolDefinition
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
