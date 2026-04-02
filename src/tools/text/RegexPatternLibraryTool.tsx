import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Copy, Regex, CheckCircle2, AlertTriangle, List, X } from 'lucide-react'
 
type ToolProps = {
  tool: ToolDefinition
}
 
type MatchInfo = {
  match: string
  index: number
  groups: (string | undefined)[]
}
 
type RegexResult = {
  valid: boolean
  matches: MatchInfo[]
  error: string | null
}
 
type RegexPreset = {
  id: string
  name: string
  pattern: string
  flags: string
  description: string
}
 
const PRESETS: RegexPreset[] = [
  {
    id: 'custom',
    name: 'Custom',
    pattern: '',
    flags: 'gi',
    description: 'Type your own regex pattern',
  },
  {
    id: 'email',
    name: 'Email',
    pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
    flags: 'gi',
    description: 'Matches standard email addresses',
  },
  {
    id: 'url',
    name: 'URL',
    pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)',
    flags: 'gi',
    description: 'Matches HTTP/HTTPS URLs with optional www, paths, and query strings',
  },
  {
    id: 'phone',
    name: 'Phone Number',
    pattern: '\\+?[\\d\\s.\\-()]{7,}',
    flags: 'g',
    description: 'Matches common phone number formats including country codes',
  },
  {
    id: 'ipv4',
    name: 'IPv4',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',
    flags: 'g',
    description: 'Matches valid IPv4 addresses (0.0.0.0 to 255.255.255.255)',
  },
  {
    id: 'date',
    name: 'Date (YYYY-MM-DD)',
    pattern: '\\b\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b',
    flags: 'g',
    description: 'Matches dates in ISO 8601 format: YYYY-MM-DD',
  },
  {
    id: 'html-tag',
    name: 'HTML Tag',
    pattern: '<\\/?([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>',
    flags: 'gi',
    description: 'Matches opening and closing HTML tags with attributes',
  },
  {
    id: 'credit-card',
    name: 'Credit Card',
    pattern: '\\b(?:\\d[ -]*?){13,19}\\b',
    flags: 'g',
    description: 'Matches credit card numbers (13-19 digits, with optional spaces or dashes)',
  },
]
 
export function RegexPatternLibraryTool({ tool }: ToolProps) {
  const [selectedPreset, setSelectedPreset] = useState('custom')
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('gi')
  const [testString, setTestString] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
 
  const preset = useMemo(
    () => PRESETS.find((p) => p.id === selectedPreset) ?? PRESETS[0],
    [selectedPreset],
  )
 
  const flagOptions = useMemo(
    () => [
      { value: 'g', label: 'g — Global', checked: flags.includes('g') },
      { value: 'i', label: 'i — Case Insensitive', checked: flags.includes('i') },
      { value: 'm', label: 'm — Multiline', checked: flags.includes('m') },
    ],
    [flags],
  )
 
  const handleFlagToggle = useCallback((flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.replace(flag, '') : prev + flag))
  }, [])
 
  const handlePresetChange = useCallback((value: string) => {
    const p = PRESETS.find((pr) => pr.id === value)
    if (p) {
      setSelectedPreset(p.id)
      setPattern(p.pattern)
      setFlags(p.flags)
    }
  }, [])
 
  const activePresetId = useMemo(() => {
    if (!pattern) return 'custom'
    const match = PRESETS.find(
      (p) => p.id !== 'custom' && p.pattern === pattern,
    )
    return match?.id ?? 'custom'
  }, [pattern])
 
  const result = useMemo((): RegexResult => {
    if (!pattern || !testString) {
      return { valid: false, matches: [], error: null }
    }
 
    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid regex pattern'
      return { valid: false, matches: [], error: message }
    }
 
    const matches: MatchInfo[] = []
 
    if (flags.includes('g')) {
      let match: RegExpExecArray | null
      let safety = 0
      const maxIterations = 10000
      while ((match = regex.exec(testString)) !== null && safety < maxIterations) {
        safety++
        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }
        matches.push({
          match: match[0],
          index: match.index,
          groups: Array.from(match).slice(1),
        })
      }
    } else {
      const match = regex.exec(testString)
      if (match) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: Array.from(match).slice(1),
        })
      }
    }
 
    return { valid: true, matches, error: null }
  }, [pattern, flags, testString])
 
  const highlightedString = useMemo(() => {
    if (!result.valid || result.matches.length === 0) return null
 
    const segments: { text: string; isMatch: boolean }[] = []
    let lastIdx = 0
 
    for (const m of result.matches) {
      if (m.index > lastIdx) {
        segments.push({ text: testString.slice(lastIdx, m.index), isMatch: false })
      }
      segments.push({ text: m.match, isMatch: true })
      lastIdx = m.index + m.match.length
    }
    if (lastIdx < testString.length) {
      segments.push({ text: testString.slice(lastIdx), isMatch: false })
    }
 
    return (
      <div className="break-all whitespace-pre-wrap leading-relaxed">
        {segments.map((seg, i) =>
          seg.isMatch ? (
            <mark
              key={i}
              className="bg-emerald-500/30 text-emerald-300 rounded px-0.5 border border-emerald-500/40"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i} className="text-muted">
              {seg.text}
            </span>
          ),
        )}
      </div>
    )
  }, [result, testString])
 
  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopiedField(null), 2000)
    }).catch(() => {})
  }, [])
 
  const handleCopyAllMatches = useCallback(() => {
    if (result.matches.length === 0) return
    const text = result.matches.map((m) => m.match).join('\n')
    handleCopy(text, 'all-matches')
  }, [result, handleCopy])
 
  const handleCopyPattern = useCallback(() => {
    handleCopy(pattern, 'pattern')
  }, [pattern, handleCopy])
 
  const handleClear = useCallback(() => {
    setPattern('')
    setTestString('')
    setFlags('gi')
    setSelectedPreset('custom')
  }, [])
 
  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          {/* Preset description */}
          {preset.id !== 'custom' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted">Selected Preset</div>
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-semibold text-accent">{preset.name}</span>
                </div>
                <p className="text-xs text-muted">{preset.description}</p>
              </div>
            </div>
          )}
 
          {/* Flags */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Flags</div>
            <div className="grid grid-cols-3 gap-1.5">
              {flagOptions.map((f) => (
                <label
                  key={f.value}
                  className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border transition cursor-pointer ${
                    flags.includes(f.value)
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border/50 bg-base/40 text-muted hover:border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={flags.includes(f.value)}
                    onChange={() => handleFlagToggle(f.value)}
                    className="sr-only"
                  />
                  <span className="font-mono text-xs">{f.value}</span>
                  <span className="text-[10px]">{f.label.split('—')[1]?.trim()}</span>
                </label>
              ))}
            </div>
          </div>
 
          {/* Match summary */}
          {result.valid && result.matches.length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''} found
              </div>
              <div className="space-y-1 mt-2 max-h-72 overflow-auto">
                {result.matches.slice(0, 30).map((m, i) => (
                  <div key={i} className="text-xs font-mono">
                    <Badge className="bg-accent/10 text-accent border-accent/30 mr-1 px-1.5 py-0 text-[10px]">
                      {i}
                    </Badge>
                    <span className="text-emerald-300">{m.match}</span>{' '}
                    <span className="text-muted">@{m.index}</span>
                    {m.groups.length > 0 && (
                      <span className="text-muted"> ({m.groups.length} groups)</span>
                    )}
                  </div>
                ))}
                {result.matches.length > 30 && (
                  <div className="text-xs text-muted">
                    …and {result.matches.length - 30} more
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                onClick={handleCopyAllMatches}
                className="w-full text-xs h-8 mt-2"
              >
                <Copy className="h-3 w-3 mr-2" />
                {copiedField === 'all-matches' ? 'Copied!' : 'Copy All Matches'}
              </Button>
            </div>
          )}
 
          {result.error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Invalid Pattern
              </div>
              <div className="text-xs text-red-300">{result.error}</div>
            </div>
          )}
 
          {!result.valid && !result.error && pattern && testString && (
            <div className="rounded-xl border border-border/40 bg-base/40 p-3 text-center text-xs text-muted">
              No matches
            </div>
          )}
 
          <Button variant="outline" onClick={handleClear} className="w-full">
            Clear All
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Preset selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-muted" />
            <span className="text-xs font-semibold uppercase text-muted">Pattern Library</span>
          </div>
          <Select
            value={activePresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="font-mono"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id !== 'custom' && ` — ${p.description}`}
              </option>
            ))}
          </Select>
        </div>
 
        {/* Pattern input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Regex className="h-4 w-4 text-muted" />
            <span className="text-xs font-semibold uppercase text-muted">Regex Pattern</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 rounded-xl border border-border bg-[#0d1117]">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted">/</span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value)
                  setSelectedPreset('custom')
                }}
                placeholder="e.g. \\w+@\\w+\\.\\w+"
                className="w-full h-10 bg-transparent border-0 px-6 py-2 text-sm font-mono text-text focus:outline-none"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center rounded-xl border border-border bg-[#0d1117] px-2 text-sm font-mono text-accent">
              /{flags || ''}
            </div>
            {pattern && (
              <Button
                variant="ghost"
                onClick={handleCopyPattern}
                className="shrink-0 h-10 px-3"
                title="Copy pattern"
              >
                {copiedField === 'pattern' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-muted" />
                )}
              </Button>
            )}
          </div>
        </div>
 
        {/* Test string */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">Test String</span>
            {testString && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                onClick={() => setTestString('')}
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            className="w-full min-h-[120px] p-3 border border-border rounded-xl bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Paste text to test against…"
            spellCheck={false}
          />
        </div>
 
        {/* Highlighted result */}
        {highlightedString && (
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">
                Matches (highlighted)
              </span>
              <Button
                variant="ghost"
                onClick={() => handleCopy(testString, 'test-string')}
                className="text-xs h-7 px-2"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedField === 'test-string' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="max-h-[300px] overflow-auto rounded-lg border border-border bg-[#0d1117] p-3 text-sm font-mono leading-relaxed">
              {highlightedString}
            </div>
          </Card>
        )}
 
        {/* No matches indicator */}
        {!result.valid && !result.error && pattern && testString && (
          <Card className="border border-border/40 bg-base/40 text-center text-sm text-muted py-6">
            No matches found
          </Card>
        )}
 
        {/* Group details */}
        {result.valid &&
          result.matches.length > 0 &&
          result.matches.some((m) => m.groups.length > 0) && (
            <Card className="space-y-2">
              <span className="text-xs font-semibold uppercase text-muted">Match Groups</span>
              <div className="space-y-3 max-h-[300px] overflow-auto">
                {result.matches.slice(0, 20).map((m, i) => (
                  <div key={i} className="rounded-lg bg-base/40 border border-border/50 p-2 text-xs">
                    <div className="font-mono text-emerald-300 mb-1">
                      <Badge className="bg-accent/10 text-accent border-accent/30 mr-1 px-1.5 py-0 text-[10px]">
                        {i}
                      </Badge>
                      "{m.match}" (index {m.index})
                    </div>
                    {m.groups.length > 0 && (
                      <div className="ml-2 space-y-0.5">
                        {m.groups.map((g, gi) => (
                          <div key={gi} className="text-muted font-mono">
                            <span className="text-text">[{gi}]</span>{' '}
                            {g !== undefined ? `"${g}"` : 'undefined'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
      </div>
    </BaseToolLayout>
  )
}
