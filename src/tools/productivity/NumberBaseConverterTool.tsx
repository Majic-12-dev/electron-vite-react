import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { CheckCircle, Copy, Hash, List } from 'lucide-react'

type NumberBaseConverterToolProps = {
  tool: ToolDefinition
}

type Base = 2 | 8 | 10 | 16

const BASES: { value: Base; label: string; prefix: string }[] = [
  { value: 2, label: 'BIN', prefix: '0b' },
  { value: 8, label: 'OCT', prefix: '0o' },
  { value: 10, label: 'DEC', prefix: '' },
  { value: 16, label: 'HEX', prefix: '0x' },
]

export function NumberBaseConverterTool({ tool }: NumberBaseConverterToolProps) {
  const [inputValue, setInputValue] = useState('')
  const [sourceBase, setSourceBase] = useState<Base>(10)
  const [copiedBase, setCopiedBase] = useState<Base | null>(null)

  const decimalValue = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase()
    if (!trimmed) return null
    try {
      // Strip common prefixes
      let clean = trimmed
      if (clean.startsWith('0b')) clean = clean.slice(2)
      else if (clean.startsWith('0o')) clean = clean.slice(2)
      else if (clean.startsWith('0x')) clean = clean.slice(2)
      // Handle decimal point for DEC only
      if (sourceBase === 10 && clean.includes('.')) return parseFloat(clean)
      const parsed = parseInt(clean, sourceBase)
      if (Number.isNaN(parsed)) return null
      return parsed
    } catch {
      return null
    }
  }, [inputValue, sourceBase])

  const conversions = useMemo(() => {
    if (decimalValue === null) return null
    return BASES.map(({ value: base }) => {
      if (base === 10) return { base, value: String(decimalValue), label: `${decimalValue}` }
      if (Number.isInteger(decimalValue)) {
        return { base, value: (decimalValue as number).toString(base).toUpperCase(), label: '' }
      }
      return { base, value: '—', label: 'Non-integer' }
    })
  }, [decimalValue])

  const handleCopy = useCallback((text: string, base: Base) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedBase(base)
      setTimeout(() => setCopiedBase(null), 2000)
    })
  }, [])

  const isValidInput = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase()
    if (!trimmed) return true
    try {
      const clean = trimmed.replace(/^0[box]/, '')
      if (sourceBase === 10) {
        if (clean.includes('.')) return !isNaN(parseFloat(clean))
        return /^\d+$/.test(clean)
      }
      if (sourceBase === 2) return /^[01]+$/.test(clean)
      return !isNaN(parseInt(clean, sourceBase))
    } catch {
      return false
    }
  }, [inputValue, sourceBase])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Source Base</div>
            <div className='grid grid-cols-4 gap-1'>
              {BASES.map(({ value: b, label }) => (
                <button
                  key={b}
                  onClick={() => setSourceBase(b)}
                  className={`rounded-xl border px-2 py-2 text-center text-xs font-medium transition ${
                    sourceBase === b
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-base/60 text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>
              Quick Examples
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs'>
              {[
                { val: '255', base: 10 as Base, label: '255 (DEC)' },
                { val: 'ff', base: 16 as Base, label: 'FF (HEX)' },
                { val: '11111111', base: 2 as Base, label: '11111111 (BIN)' },
                { val: '377', base: 8 as Base, label: '377 (OCT)' },
              ].map(({ val, base, label }) => (
                <button
                  key={val}
                  onClick={() => {
                    setInputValue(val)
                    setSourceBase(base)
                  }}
                  className='text-left rounded-lg border border-border bg-base/50 px-3 py-2 hover:bg-panel text-muted hover:text-text'
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-6'>
        {/* Input */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <label className='text-xs font-semibold uppercase text-muted'>
              Enter a number
            </label>
            <span className='text-[10px] text-muted'>
              {BASES.find((b) => b.value === sourceBase)?.label} input
            </span>
          </div>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              sourceBase === 2
                ? '11111111'
                : sourceBase === 8
                ? '377'
                : sourceBase === 16
                ? 'FF'
                : '255'
            }
            className='font-mono text-lg'
          />
          {!isValidInput && inputValue.length > 0 && (
            <p className='text-xs text-red-400'>
              Invalid {BASES.find((b) => b.value === sourceBase)?.label} number
            </p>
          )}
        </div>

        {/* Results */}
        {conversions && (
          <Card className='space-y-3'>
            <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
              <List className='h-3.5 w-3.5' />
              Conversions
            </div>
            {conversions.map(({ base, value, label }) => (
              <div
                key={base}
                className='flex items-center justify-between rounded-xl border border-border bg-base/60 px-3 py-2'
              >
                <div className='flex items-center gap-3'>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                      base === sourceBase
                        ? 'bg-accent/20 text-accent'
                        : 'bg-base text-muted'
                    }`}
                  >
                    {BASES.find((b) => b.value === base)?.label}
                  </span>
                  <code className='font-mono text-sm text-text'>
                    {base === 2 && value !== '—'
                      ? `0b${value}`
                      : base === 8
                      ? `0o${value}`
                      : base === 16 && !isNaN(Number(value))
                      ? `0x${value}`
                      : value}
                  </code>
                </div>
                <Button
                  variant='ghost'
                  className='h-6 w-6 flex-shrink-0'
                  onClick={() =>
                    handleCopy(
                      base === 2
                        ? `0b${value}`
                        : base === 8
                        ? `0o${value}`
                        : base === 16 && !isNaN(Number(value))
                        ? `0x${value}`
                        : value,
                      base
                    )
                  }
                >
                  {copiedBase === base ? (
                    <CheckCircle className='h-3 w-3 text-green-400' />
                  ) : (
                    <Copy className='h-3 w-3' />
                  )}
                </Button>
              </div>
            ))}
          </Card>
        )}

        {decimalValue !== null && (
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <div className='text-[10px] font-semibold uppercase text-muted'>Bit Length</div>
              <div className='font-mono text-lg text-text'>
                {Number.isInteger(decimalValue) && decimalValue > 0
                  ? Math.ceil(Math.log2(decimalValue + 1))
                  : '—'}
              </div>
            </div>
            <div className='space-y-1'>
              <div className='text-[10px] font-semibold uppercase text-muted'>
                Parity
              </div>
              <div className='font-mono text-lg text-text'>
                {Number.isInteger(decimalValue)
                  ? (decimalValue as number) % 2 === 0
                    ? 'Even'
                    : 'Odd'
                  : '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
