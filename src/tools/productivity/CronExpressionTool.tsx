import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { CheckCircle, Clock, Copy } from 'lucide-react'

type CronExpressionToolProps = {
  tool: ToolDefinition
}

type CronField = {
  name: string
  min: number
  max: number
  values: string[]
}

const MONTH_NAMES = [
  '',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const FIELDS: CronField[] = [
  { name: 'Minute', min: 0, max: 59, values: [] },
  { name: 'Hour', min: 0, max: 23, values: [] },
  { name: 'Day of Month', min: 1, max: 31, values: [] },
  { name: 'Month', min: 1, max: 12, values: MONTH_NAMES.slice(1) },
  { name: 'Day of Week', min: 0, max: 7, values: DAY_NAMES },
]

function describeField(field: CronField, raw: string): string {
  if (raw === '*') return `every ${field.name.toLowerCase()}`

  if (raw.includes(',')) {
    const parts = raw.split(',')
    return `${field.name.toLowerCase()}: ${parts.join(', ')}`
  }

  if (raw.includes('/')) {
    const [base, step] = raw.split('/')
    return `every ${step} ${field.name.toLowerCase()}${base === '*' ? '' : ` starting at ${base}`}`
  }

  if (raw.includes('-')) {
    const [start, end] = raw.split('-')
    return `${field.name.toLowerCase()} ${start}–${end}`
  }

  const val = parseInt(raw)
  if (!isNaN(val) && field.values.length > 0 && val >= 1 && val <= field.values.length) {
    return `${field.name.toLowerCase()}: ${field.values[val - 1]}`
  }

  return raw
}

function summarizeCron(parts: string[]): string | null {
  const [min, hour, dom, month, dow] = parts

  // Common patterns
  if (parts.every((p) => p === '*')) return 'Every minute'
  if (
    min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*'
  ) return 'At the start of every hour'

  if (
    min === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*'
  ) return 'Midnight every day'

  if (
    min === '30' && hour === '0' && dom === '*' && month === '*' && dow === '*'
  ) return '00:30 AM every day'

  return null
}

export function CronExpressionTool({ tool }: CronExpressionToolProps) {
  const [expression, setExpression] = useState('* * * * *')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const cronFields = useMemo(() => {
    const parts = expression.trim().split(/\s+/)
    if (parts.length !== 5) return null
    return parts
  }, [expression])

  const parsedFields = useMemo(() => {
    if (!cronFields) return null
    return FIELDS.map((field, i) => ({
      ...field,
      raw: cronFields[i],
      description: describeField(field, cronFields[i]),
    }))
  }, [cronFields])

  const summary = useMemo(() => {
    if (!cronFields) return null
    return summarizeCron(cronFields)
  }, [cronFields])

  // Next few occurrences
  const nextRuns = useMemo(() => {
    if (!parsedFields) return []
    const now = new Date()
    const results: Date[] = []
    let check = new Date(now.getTime() + 60 * 1000) // start one minute ahead

    for (
      let attempts = 0;
      results.length < 5 && attempts < 525600;
      attempts++
    ) {
      const m = check.getMinutes()
      const h = check.getHours()
      const d = check.getDate()
      const mo = check.getMonth() + 1
      const dow = check.getDay() || 7

      const matchMin = matchValue(m, cronFields![0])
      const matchHour = matchValue(h, cronFields![1])
      const matchDom = matchValue(d, cronFields![2])
      const matchMonth = matchValue(mo, cronFields![3])
      const matchDow = matchValue(dow, cronFields![4])

      if (matchMin && matchHour && matchDom && matchMonth && matchDow) {
        results.push(new Date(check))
      }

      check = new Date(check.getTime() + 60 * 1000)
    }
    return results
  }, [parsedFields, cronFields])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(expression).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [expression])

  // Validate: reset error if all chars are valid cron chars
  const validate = useCallback((val: string) => {
    if (!val.trim()) {
      setError('Please enter a cron expression.')
      return false
    }
    const parts = val.trim().split(/\s+/)
    if (parts.length !== 5) {
      setError(`Expected 5 fields, got ${parts.length}.`)
      return false
    }
    const cron = /^[0-9,/*\-]+$/
    if (!parts.every((p) => cron.test(p))) {
      setError('Invalid characters in cron expression.')
      return false
    }
    setError(null)
    return true
  }, [])

  const handleProcess = useCallback(() => {
    validate(expression)
  }, [expression, validate])

  const presets = [
    { label: 'Every minute', expr: '* * * * *' },
    { label: 'Every hour', expr: '0 * * * *' },
    { label: 'Every day at midnight', expr: '0 0 * * *' },
    { label: 'Every Sunday midnight', expr: '0 0 * * 0' },
    { label: 'Every 5 minutes', expr: '*/5 * * * *' },
    { label: 'Every Monday 9am', expr: '0 9 * * 1' },
    { label: 'Weekdays at 8am', expr: '0 8 * * 1-5' },
    { label: 'First of month', expr: '0 0 1 * *' },
  ]

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Cron Expression</div>
            <Input
              value={expression}
              onChange={(e) => {
                setExpression(e.target.value)
                validate(e.target.value)
              }}
              className='font-mono'
              placeholder='* * * * *'
            />
            <div className='flex gap-1 text-[9px] text-muted font-mono'>
              <span className='flex-1 text-center'>MIN</span>
              <span className='flex-1 text-center'>HR</span>
              <span className='flex-1 text-center'>DOM</span>
              <span className='flex-1 text-center'>MON</span>
              <span className='flex-1 text-center'>DOW</span>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Presets</div>
            <div className='space-y-1'>
              {presets.map((p) => (
                <button
                  key={p.expr}
                  onClick={() => {
                    setExpression(p.expr)
                    setError(null)
                  }}
                  className={`w-full text-left rounded-lg border px-3 py-1.5 text-xs transition ${
                    expression === p.expr
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-base/60 text-muted hover:border-accent hover:text-text'
                  }`}
                >
                  <span className='font-mono'>{p.expr}</span>
                  <span className='text-muted ml-2'>→ {p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleProcess} className='w-full'>
            <Clock className='mr-2 h-4 w-4' />
            Analyze
          </Button>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Expression display */}
        <div className='flex items-center justify-between rounded-xl border border-border bg-base/60 px-3 py-2'>
          <code className='font-mono text-lg text-text'>{expression}</code>
          <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
            {copied ? (
              <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
            ) : (
              <Copy className='mr-1 h-3 w-3' />
            )}
            Copy
          </Button>
        </div>

        {summary && (
          <Card className='border-accent/30 bg-accent/5 text-sm text-text'>
            {summary}
          </Card>
        )}

        {error && (
          <Card className='border border-red-500/50 bg-red-500/10 text-sm text-red-200'>
            {error}
          </Card>
        )}

        {/* Field breakdown */}
        {parsedFields && !error && (
          <Card className='space-y-3'>
            <div className='text-xs font-semibold uppercase text-muted'>Field Breakdown</div>
            {parsedFields.map((field, i) => (
              <div key={i} className='flex items-center justify-between'>
                <span className='text-xs text-muted w-28'>{field.name}</span>
                <code className='font-mono text-sm text-accent'>{field.raw}</code>
                <span className='text-xs text-text ml-2'>{field.description}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Next runs */}
        {nextRuns.length > 0 && !error && (
          <Card className='space-y-3'>
            <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
              <Clock className='h-3.5 w-3.5' />
              Next 5 Occurrences
            </div>
            {nextRuns.map((date, i) => (
              <div
                key={i}
                className='flex items-center justify-between rounded-xl border border-border bg-base/60 px-3 py-2'
              >
                <span className='rounded-md bg-accent/15 w-6 h-6 text-[10px] font-semibold flex items-center justify-center text-accent'>
                  {i + 1}
                </span>
                <span className='text-sm text-text'>
                  {date.toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZoneName: 'short',
                  })}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}

function matchValue(val: number, expr: string): boolean {
  if (expr === '*') return true
  // Handle comma-separated
  if (expr.includes(',')) {
    return expr.split(',').some((part) => matchValue(val, part.trim()))
  }
  // Handle step
  if (expr.includes('/')) {
    const [base, stepStr] = expr.split('/')
    const step = parseInt(stepStr)
    const start = base === '*' ? 0 : parseInt(base)
    return val >= start && (val - start) % step === 0
  }
  // Handle range
  if (expr.includes('-')) {
    const [startStr, endStr] = expr.split('-')
    const start = parseInt(startStr)
    const end = parseInt(endStr)
    return val >= start && val <= end
  }
  // Exact match
  return val === parseInt(expr)
}
