import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { Copy, RefreshCw, CheckCircle, Lock } from 'lucide-react'

type PasswordGeneratorToolProps = {
  tool: ToolDefinition
}

function getStrength(
  password: string,
  hasUpper: boolean,
  hasLower: boolean,
  hasNumbers: boolean,
  hasSymbols: boolean,
): { label: string; color: string; score: number } {
  const criteria = [hasUpper, hasLower, hasNumbers, hasSymbols].filter(Boolean).length
  const len = password.length

  if (len < 8 || criteria < 2) return { label: 'Weak', color: 'text-red-400', score: 1 }
  if (len < 12 || criteria < 3) return { label: 'Medium', color: 'text-yellow-400', score: 2 }
  if (len >= 12 && criteria >= 4) return { label: 'Strong', color: 'text-green-400', score: 3 }
  return { label: 'Medium', color: 'text-yellow-400', score: 2 }
}

function generatePassword({
  length,
  uppercase,
  lowercase,
  numbers,
  symbols,
}: {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const nums = '0123456789'
  const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let charset = ''
  if (uppercase) charset += upper
  if (lowercase) charset += lower
  if (numbers) charset += nums
  if (symbols) charset += syms

  if (!charset) return ''

  // Ensure at least one character from each selected set
  let result = ''
  const sets: string[] = []
  if (uppercase) sets.push(upper)
  if (lowercase) sets.push(lower)
  if (numbers) sets.push(nums)
  if (symbols) sets.push(syms)

  // Use crypto.getRandomValues for cryptographically secure randomness
  const secureRandom = (max: number): number => {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return array[0] % max
  }

  for (const set of sets) {
    result += set[secureRandom(set.length)]
  }

  for (let i = result.length; i < length; i++) {
    result += charset[secureRandom(charset.length)]
  }

  // Fisher-Yates shuffle with secure randomness
  const arr = result.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr.join('')
}

export function PasswordGeneratorTool({ tool }: PasswordGeneratorToolProps) {
  const [length, setLength] = useState(16)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleGenerate = useCallback(() => {
    if (!uppercase && !lowercase && !numbers && !symbols) return
    const newPassword = generatePassword({ length, uppercase, lowercase, numbers, symbols })
    setPassword(newPassword)
    setCopied(false)
  }, [length, uppercase, lowercase, numbers, symbols])

  const handleCopy = useCallback(async () => {
    if (!password) return
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(password)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = password
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [password])

  const hasSelection = uppercase || lowercase || numbers || symbols
  const strength = useMemo(
    () =>
      password
        ? getStrength(password, uppercase, lowercase, numbers, symbols)
        : { label: '', color: '', score: 0 },
    [password, uppercase, lowercase, numbers, symbols],
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => {
        handleGenerate()
      }}
      options={
        <div className='space-y-5 text-sm'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-xs font-semibold uppercase text-muted'>
              <span>Length</span>
              <span className='text-accent'>{length}</span>
            </div>
            <input
              type='range'
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className='w-full accent-accent'
            />
            <div className='flex justify-between text-[10px] text-muted'>
              <span>8</span>
              <span>64</span>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='text-xs font-semibold uppercase text-muted'>Character Sets</div>
            <div className='space-y-2'>
              <Switch checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} label='Uppercase (A-Z)' />
              <Switch checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} label='Lowercase (a-z)' />
              <Switch checked={numbers} onChange={(e) => setNumbers(e.target.checked)} label='Numbers (0-9)' />
              <Switch checked={symbols} onChange={(e) => setSymbols(e.target.checked)} label='Symbols (!@#$...)' />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={!hasSelection} className='w-full'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Generate Password
          </Button>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
      result={
        password ? (
          <Card className='space-y-4'>
            <div className='space-y-3'>
              <div className='rounded-xl border border-border bg-base/60 p-4'>
                <div className='break-all font-mono text-lg tracking-wider text-text'>
                  {password}
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <Badge className={`border-0 ${strength.color.replace('text-', 'bg-').replace('400', '400/20')} ${strength.color}`}>
                  {strength.label}
                </Badge>
                <Button variant={copied ? 'secondary' : 'outline'} onClick={handleCopy}>
                  {copied ? (
                    <>
                      <CheckCircle className='mr-2 h-4 w-4' />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className='mr-2 h-4 w-4' />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>
              <div className='flex flex-wrap items-center gap-2 text-xs text-muted'>
                <Lock className='h-3 w-3' />
                <span>
                  Entropy: ~{Math.round(password.length * Math.log2([uppercase, lowercase, numbers, symbols].filter(Boolean).length * 26))} bits
                </span>
              </div>
            </div>
          </Card>
        ) : null
      }
    />
  )
}
