import { useState, useMemo, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Copy, ArrowLeftRight, FileDiff } from 'lucide-react'
import { diffLines } from 'diff'

type TextDiffToolProps = {
  tool: ToolDefinition
}

type DiffMode = 'lines' | 'words'

type DiffLine = {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  leftNum?: number
  rightNum?: number
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const changes = diffLines(oldText, newText)
  const lines: DiffLine[] = []

  let leftNum = 0
  let rightNum = 0

  for (const c of changes) {
    const parts = (c.value.endsWith('\n') ? c.value.slice(0, -1) : c.value).split('\n')
    for (const part of parts) {
      if (c.added) {
        rightNum++
        lines.push({ type: 'added', content: part, rightNum })
      } else if (c.removed) {
        leftNum++
        lines.push({ type: 'removed', content: part, leftNum })
      } else {
        leftNum++
        rightNum++
        lines.push({ type: 'unchanged', content: part, leftNum, rightNum })
      }
    }
  }
  return lines
}

function computeWordDiff(oldText: string, newText: string): DiffLine[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)

  // Build inline diff using LCS-style approach
  const m = oldWords.length
  const n = newWords.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldWords[i] === newWords[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1]
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const lines: DiffLine[] = []
  let i = 0, j = 0

  while (i < m || j < n) {
    if (i < m && j < n && oldWords[i] === newWords[j]) {
      let word = oldWords[i]
      if (word.includes('\n')) {
        const parts = word.split('\n')
        for (let k = 0; k < parts.length; k++) {
          lines.push({ type: 'unchanged', content: parts[k] })
          if (k < parts.length - 1) {
            lines.push({ type: 'newline', content: '' } as unknown as DiffLine)
          }
        }
      } else {
        lines.push({ type: 'unchanged', content: word })
      }
      i++
      j++
    } else if (j < n && (i === m || dp[i][j] === dp[i][j + 1])) {
      let word = newWords[j]
      if (word.includes('\n')) {
        const parts = word.split('\n')
        for (let k = 0; k < parts.length; k++) {
          lines.push({ type: 'added', content: parts[k] } as DiffLine)
          if (k < parts.length - 1) {
            lines.push({ type: 'newline', content: '' } as unknown as DiffLine)
          }
        }
      } else {
        lines.push({ type: 'added', content: word } as DiffLine)
      }
      j++
    } else if (i < m) {
      let word = oldWords[i]
      if (word.includes('\n')) {
        const parts = word.split('\n')
        for (let k = 0; k < parts.length; k++) {
          lines.push({ type: 'removed', content: parts[k] } as DiffLine)
          if (k < parts.length - 1) {
            lines.push({ type: 'newline', content: '' } as unknown as DiffLine)
          }
        }
      } else {
        lines.push({ type: 'removed', content: word } as DiffLine)
      }
      i++
    }
  }
  return lines
}

export function TextDiffTool({ tool }: TextDiffToolProps) {
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [mode, setMode] = useState<DiffMode>('lines')
  const [error, setError] = useState<string | null>(null)

  const handleCompare = useCallback(() => {
    if (!leftText && !rightText) {
      setError('Paste text in both panels to compare.')
      return
    }
    setError(null)
  }, [leftText, rightText])

  const handleSwap = useCallback(() => {
    setLeftText(rightText)
    setRightText(leftText)
  }, [leftText, rightText])

  const handleCopyDiff = useCallback(() => {
    const diffText = diffLinesOutput
      .map((line) => {
        if (line.type === 'added') return `+ ${line.content}`
        if (line.type === 'removed') return `- ${line.content}`
        return `  ${line.content}`
      })
      .join('\n')
    navigator.clipboard.writeText(diffText).catch(() => {
      // ignore
    })
  }, [])

  const hasInputs = leftText.length > 0 || rightText.length > 0

  const diffLinesOutput = useMemo(() => {
    if (!hasInputs) return []
    if (mode === 'lines') {
      return computeLineDiff(leftText, rightText)
    }
    return computeWordDiff(leftText, rightText)
  }, [leftText, rightText, mode, hasInputs])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    let unchanged = 0
    for (const line of diffLinesOutput) {
      if (line.type === 'added') added++
      else if (line.type === 'removed') removed++
      else unchanged++
    }
    return { added, removed, unchanged, total: diffLinesOutput.length }
  }, [diffLinesOutput])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Diff Mode</div>
            <Select value={mode} onChange={(e) => setMode(e.target.value as DiffMode)}>
              <option value="lines">Line-by-line</option>
              <option value="words">Word-level</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleCompare} disabled={!hasInputs} className="w-full">
              <FileDiff className="mr-2 h-4 w-4" />
              Compare
            </Button>
            <Button variant="outline" onClick={handleSwap} disabled={!hasInputs} className="w-full">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Swap
            </Button>
          </div>
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {error}
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">Original (Left)</span>
            <button
              type="button"
              className="text-xs text-accent hover:text-accent/80"
              onClick={() => setLeftText('')}
            >
              Clear
            </button>
          </div>
          <textarea
            value={leftText}
            onChange={(e) => setLeftText(e.target.value)}
            className="w-full h-64 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
            placeholder="Paste original text here..."
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">Modified (Right)</span>
            <button
              type="button"
              className="text-xs text-accent hover:text-accent/80"
              onClick={() => setRightText('')}
            >
              Clear
            </button>
          </div>
          <textarea
            value={rightText}
            onChange={(e) => setRightText(e.target.value)}
            className="w-full h-64 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
            placeholder="Paste modified text here..."
          />
        </div>
      </div>

      {hasInputs && diffLinesOutput.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-emerald-500/20 border border-emerald-500/30 rounded" />
                {stats.added} added
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-red-500/20 border border-red-500/30 rounded" />
                {stats.removed} removed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-gray-500/10 border border-gray-500/20 rounded" />
                {stats.unchanged} unchanged
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={handleCopyDiff}
              className="text-xs h-7 px-2 gap-1"
            >
              <Copy className="h-3 w-3" />
              Copy diff
            </Button>
          </div>
          <div className="border border-border rounded-lg bg-[#0d1117] max-h-[500px] overflow-auto">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs font-mono leading-5">
                <tbody>
                  {diffLinesOutput.map((line, idx) => {
                    if ((line as unknown as { type?: string }).type === 'newline') {
                      return (
                        <tr key={idx} className="h-[1px]">
                          <td className="px-1 text-muted-foreground w-10 text-right select-none">
                            {(line as any).leftNum || ''}
                          </td>
                          <td className="px-1 text-muted-foreground w-10 text-right select-none">
                            {(line as any).rightNum || ''}
                          </td>
                          <td className="w-8 select-none text-muted-foreground" />
                          <td className="h-[1px] bg-border/30" />
                        </tr>
                      )
                    }
                    const isAdded = line.type === 'added'
                    const isRemoved = line.type === 'removed'
                    const prefix = isAdded ? '+' : isRemoved ? '-' : ' '
                    return (
                      <tr
                        key={idx}
                        className={
                          isAdded
                            ? 'bg-emerald-900/20'
                            : isRemoved
                              ? 'bg-red-900/20'
                              : ''
                        }
                      >
                        <td className="px-1 text-muted-foreground w-10 text-right select-none">
                          {line.leftNum ?? ''}
                        </td>
                        <td className="px-1 text-muted-foreground w-10 text-right select-none">
                          {line.rightNum ?? ''}
                        </td>
                        <td className="w-8 text-center select-none">
                          <span
                            className={
                              isAdded
                                ? 'text-emerald-400'
                                : isRemoved
                                  ? 'text-red-400'
                                  : 'text-muted-foreground'
                            }
                          >
                            {prefix}
                          </span>
                        </td>
                        <td
                          className={
                            isAdded
                              ? 'text-emerald-300'
                              : isRemoved
                                ? 'text-red-300'
                                : 'text-muted-foreground'
                          }
                        >
                          {line.content}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </BaseToolLayout>
  )
}
