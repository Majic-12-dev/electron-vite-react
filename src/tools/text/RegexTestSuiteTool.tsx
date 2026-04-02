import { useState, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Search, Clock, Copy, Save, ChevronDown, ChevronUp, Plus } from 'lucide-react'

type TestTab = { id: string; label: string; text: string }

type MatchResult = {
  fullMatch: string
  groups: string[]
  startIndex: number
  endIndex: number
}

function getSavedPatterns(): string[] {
  try {
    const raw = localStorage.getItem('docflow-regex-patterns')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePatterns(patterns: string[]) {
  try {
    localStorage.setItem('docflow-regex-patterns', JSON.stringify(patterns.slice(0, 10)))
  } catch { /* ignore */ }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function RegexTestSuiteTool({ tool }: { tool: ToolDefinition }) {
  const [pattern, setPattern] = useState('')
  const [flagG, setFlagG] = useState(true)
  const [flagI, setFlagI] = useState(false)
  const [flagM, setFlagM] = useState(false)
  const [flagS, setFlagS] = useState(false)
  const [tabs, setTabs] = useState<TestTab[]>([{ id: '1', label: 'Test 1', text: '' }])
  const [activeTab, setActiveTab] = useState('1')
  const [results, setResults] = useState<MatchResult[]>([])
  const [execTime, setExecTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [highlightedText, setHighlightedText] = useState('')
  const [savedToast, setSavedToast] = useState(false)

  const activeText = tabs.find(t => t.id === activeTab)?.text ?? ''
  const saved = getSavedPatterns()

  const runRegex = useCallback(() => {
    if (!pattern) return
    let flags = ''
    if (flagG) flags += 'g'
    if (flagI) flags += 'i'
    if (flagM) flags += 'm'
    if (flagS) flags += 's'

    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch (e: any) {
      setError(e.message)
      setResults([])
      setHighlightedText('')
      return
    }

    setError(null)
    const matches: MatchResult[] = []
    const text = activeText

    const startTime = performance.now()

    if (!flagG) {
      const m = regex.exec(text)
      if (m) {
        const groups = m.slice(1).map(s => s ?? '')
        matches.push({ fullMatch: m[0], groups, startIndex: m.index || 0, endIndex: (m.index || 0) + m[0].length })
      }
    } else {
      let m
      let safety = 0
      const maxIterations = 10000
      while ((m = regex.exec(text)) !== null && safety < maxIterations) {
        safety++
        if (m[0].length === 0) { regex.lastIndex++; continue }
        const groups = m.slice(1).map(s => s ?? '')
        matches.push({ fullMatch: m[0], groups, startIndex: m.index || 0, endIndex: m.index + m[0].length })
      }
    }

    const endTime = performance.now()
    setExecTime(endTime - startTime)
    setResults(matches)

    // Build highlighted text
    if (matches.length === 0) {
      setHighlightedText(escapeHtml(text))
    } else {
      let html = ''
      let lastEnd = 0
      for (const m of matches) {
        html += escapeHtml(text.substring(lastEnd, m.startIndex))
        html += `<mark class="bg-accent/30 px-0.5 rounded">${escapeHtml(m.fullMatch)}</mark>`
        lastEnd = m.endIndex
      }
      html += escapeHtml(text.substring(lastEnd))
      setHighlightedText(html)
    }
  }, [pattern, flagG, flagI, flagM, flagS, activeText])

  const addTab = () => {
    const id = Date.now().toString()
    setTabs([...tabs, { id, label: `Test ${tabs.length + 1}`, text: '' }])
    setActiveTab(id)
  }

  const removeTab = (id: string) => {
    if (tabs.length <= 1) return
    const next = tabs.filter(t => t.id !== id)
    setTabs(next)
    if (activeTab === id) setActiveTab(next[0].id)
  }

  const updateTabText = (text: string) => {
    setTabs(tabs.map(t => t.id === activeTab ? { ...t, text } : t))
  }

  const copyResults = () => {
    const lines = results.map((m, i) => `Match ${i+1}: "${m.fullMatch}" (pos ${m.startIndex}-${m.endIndex})`)
    navigator.clipboard.writeText(lines.join('\n'))
  }

  const saveCurrentPattern = () => {
    if (!pattern) return
    const existing = getSavedPatterns()
    savePatterns([pattern, ...existing.filter(p => p !== pattern)])
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-3">
        {/* Pattern input */}
        <div className="flex gap-2 items-start">
          <span className="text-lg text-muted px-1 py-[10px]">/</span>
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-input/50 text-base/90 placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/60 font-mono text-sm"
            placeholder="regex pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <span className="text-lg text-muted px-1 py-[10px]">/</span>
          <div className="flex gap-1 mt-1">
            {[
              { flag: 'g', checked: flagG, set: setFlagG },
              { flag: 'i', checked: flagI, set: setFlagI },
              { flag: 'm', checked: flagM, set: setFlagM },
              { flag: 's', checked: flagS, set: setFlagS },
            ].map(f => (
              <label key={f.flag} className="flex items-center gap-0.5 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={f.checked} onChange={() => f.set(!f.checked)} />
                {f.flag}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={runRegex} disabled={!pattern}>
            <Search className="w-4 h-4 mr-1" /> Match
          </Button>
          <Button size="sm" variant="outline" onClick={saveCurrentPattern} disabled={!pattern}>
            <Save className="w-4 h-4 mr-1" /> {savedToast ? 'Saved!' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={copyResults} disabled={results.length === 0}>
            <Copy className="w-4 h-4 mr-1" /> Copy
          </Button>
        </div>

        {/* Saved patterns */}
        {saved.length > 0 && (
          <div>
            <Button size="sm" variant="outline" onClick={() => setShowSaved(!showSaved)}>
              {showSaved ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              Saved Patterns ({saved.length})
            </Button>
            {showSaved && (
              <div className="flex flex-wrap gap-1 mt-1">
                {saved.map((p, i) => (
                  <Badge key={i} className="cursor-pointer font-mono bg-accent/10 text-accent border-accent/30" onClick={() => setPattern(p)}>
                    /{p}/
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
            Regex Error: {error}
          </Card>
        )}

        {/* Test string tabs */}
        <div>
          <div className="flex gap-1 mb-1">
            {tabs.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <button
                  className={`px-2 py-1 text-xs rounded-t ${t.id === activeTab ? 'bg-accent/20 text-accent' : 'bg-base/40 text-muted hover:bg-base/60'}`}
                  onClick={() => setActiveTab(t.id)}
                >{t.label}</button>
                {tabs.length > 1 && (
                  <button className="text-xs text-destructive hover:text-destructive/80" onClick={() => removeTab(t.id)}>×</button>
                )}
              </div>
            ))}
            <button className="px-2 py-1 text-xs rounded-t bg-base/30 text-muted hover:bg-base/50" onClick={addTab}>
              <Plus className="w-3 h-3 inline" />
            </button>
          </div>
          <textarea
            className="w-full h-32 px-3 py-2 rounded-b-lg rounded-tl-lg border border-border bg-input/50 text-base/90 placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/60 font-mono text-sm resize-y"
            placeholder="Enter test string here..."
            value={activeText}
            onChange={(e) => updateTabText(e.target.value)}
          />
        </div>

        {/* Results */}
        {execTime !== null && (
          <div className="flex items-center gap-1 text-xs text-muted"><Clock className="w-3 h-3" /> {execTime.toFixed(2)}ms</div>
        )}
        {!error && pattern && (
          <Badge className={results.length > 0 ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30'}>
            {results.length} match{results.length !== 1 ? 'es' : ''}
          </Badge>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {/* Highlighted text */}
            <div className="p-3 rounded-lg bg-base/30 font-mono text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlightedText }} />

            {/* Match table */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm font-mono">
                <thead className="bg-base/40 sticky top-0">
                  <tr>
                    <th className="px-3 py-1 text-left text-muted">#</th>
                    <th className="px-3 py-1 text-left text-muted">Match</th>
                    <th className="px-3 py-1 text-left text-muted">Groups</th>
                    <th className="px-3 py-1 text-left text-muted">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((m, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-3 py-1 text-muted">{i + 1}</td>
                      <td className="px-3 py-1 text-accent truncate max-w-[200px]">{m.fullMatch}</td>
                      <td className="px-3 py-1 text-muted">{m.groups.join(', ') || '—'}</td>
                      <td className="px-3 py-1 text-muted">{m.startIndex}–{m.endIndex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
