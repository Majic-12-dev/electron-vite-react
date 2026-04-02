import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Copy, CheckCircle, Droplets } from 'lucide-react'

type ColorConverterToolProps = {
  tool: ToolDefinition
}

// --- Conversion helpers ---

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let cleaned = hex.replace('#', '').trim()
  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
  }
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return { r, g, b }
}

function parseRgb(input: string): { r: number; g: number; b: number } | null {
  const m = input.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  // comma or space separated numbers
  const parts = input.split(/[,/\s]+/).map(Number).filter((n) => !Number.isNaN(n))
  if (parts.length === 3 && parts.every((p) => p >= 0 && p <= 255)) {
    return { r: parts[0], g: parts[1], b: parts[2] }
  }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  )
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  let h = 0,
    s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100
  l /= 100
  h /= 360
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function parseHsl(input: string): { h: number; s: number; l: number } | null {
  const m = input.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i)
  if (m) return { h: +m[1], s: +m[2], l: +m[3] }
  const parts = input.split(/[,/\s]+/).map(Number)
  if (
    parts.length === 3 &&
    parts[0] >= 0 &&
    parts[0] <= 360 &&
    parts[1] >= 0 &&
    parts[1] <= 100 &&
    parts[2] >= 0 &&
    parts[2] <= 100
  ) {
    return { h: parts[0], s: parts[1], l: parts[2] }
  }
  return null
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function ColorConverterTool({ tool }: ColorConverterToolProps) {
  const [input, setInput] = useState('#3b82f6')
  const [rgb, setRgb] = useState<{ r: number; g: number; b: number }>({ r: 59, g: 130, b: 246 })
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const parsed = useMemo(() => {
    // Try hex
    const hex = parseHex(input)
    if (hex) return hex
    // Try RGB
    const rgb2 = parseRgb(input)
    if (rgb2) return rgb2
    // Try HSL
    const hsl = parseHsl(input)
    if (hsl) return hslToRgb(hsl.h, hsl.s, hsl.l)
    return null
  }, [input])

  const syncRgb = useCallback(() => {
    if (parsed) setRgb(parsed)
  }, [parsed])

  // Live update on input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    setInput(val)
    const h = parseHex(val)
    if (h) setRgb(h)
    const r = parseRgb(val)
    if (r) setRgb(r)
    const hs = parseHsl(val)
    if (hs) setRgb(hslToRgb(hs.h, hs.s, hs.l))
  }, [])

  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb])
  const hex = useMemo(() => rgbToHex(rgb.r, rgb.g, rgb.b), [rgb])

  const textColor = useMemo(() => {
    const lum = luminance(rgb.r, rgb.g, rgb.b)
    return lum > 0.179 ? '#1a1a2e' : '#ffffff'
  }, [rgb])

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }, [])

  const presets = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Color Input</div>
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder='#3b82f6, rgb(59,130,246), hsl(217,91%,60%)'
            />
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Presets</div>
            <div className='flex flex-wrap gap-2'>
              {presets.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setInput(c)
                    setRgb(parseHex(c)!)
                  }}
                  className='h-8 w-8 rounded-lg border border-border'
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <Button onClick={syncRgb} className='w-full' disabled={!parsed}>
            <Droplets className='mr-2 h-4 w-4' />
            Convert
          </Button>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      {parsed && (
        <div className='space-y-4'>
          {/* Visual color preview */}
          <Card
            className='flex items-center justify-center rounded-2xl'
            style={{ height: '120px', backgroundColor: hex }}
          >
            <div
              className='text-lg font-mono font-semibold tracking-wide'
              style={{ color: textColor }}
            >
              {hex.toUpperCase()}
            </div>
          </Card>

          {/* HEX */}
          <div className='rounded-xl border border-border bg-base/60 px-3 py-2'>
            <div className='text-xs font-semibold uppercase text-muted mb-1'>HEX</div>
            <div className='flex items-center justify-between'>
              <code className='font-mono text-sm text-text'>{hex.toUpperCase()}</code>
              <Button
                variant='ghost'
                className='h-6 text-[10px]'
                onClick={() => handleCopy(hex.toUpperCase(), 'hex')}
              >
                {copiedKey === 'hex' ? (
                  <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                ) : (
                  <Copy className='mr-1 h-3 w-3' />
                )}
                Copy
              </Button>
            </div>
          </div>

          {/* RGB */}
          <div className='rounded-xl border border-border bg-base/60 px-3 py-2'>
            <div className='text-xs font-semibold uppercase text-muted mb-1'>RGB</div>
            <div className='flex items-center justify-between'>
              <code className='font-mono text-sm text-text'>
                rgb({rgb.r}, {rgb.g}, {rgb.b})
              </code>
              <Button
                variant='ghost'
                className='h-6 text-[10px]'
                onClick={() => handleCopy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, 'rgb')}
              >
                {copiedKey === 'rgb' ? (
                  <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                ) : (
                  <Copy className='mr-1 h-3 w-3' />
                )}
                Copy
              </Button>
            </div>
          </div>

          {/* HSL */}
          <div className='rounded-xl border border-border bg-base/60 px-3 py-2'>
            <div className='text-xs font-semibold uppercase text-muted mb-1'>HSL</div>
            <div className='flex items-center justify-between'>
              <code className='font-mono text-sm text-text'>
                hsl({hsl.h}, {hsl.s}%, {hsl.l}%)
              </code>
              <Button
                variant='ghost'
                className='h-6 text-[10px]'
                onClick={() => handleCopy(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, 'hsl')}
              >
                {copiedKey === 'hsl' ? (
                  <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                ) : (
                  <Copy className='mr-1 h-3 w-3' />
                )}
                Copy
              </Button>
            </div>
          </div>

          {/* RGB channels */}
          <div className='grid grid-cols-3 gap-3 text-center'>
            {[
              { label: 'R', value: rgb.r, color: '#ef4444' },
              { label: 'G', value: rgb.g, color: '#22c55e' },
              { label: 'B', value: rgb.b, color: '#3b82f6' },
            ].map(({ label, value, color }) => (
              <div key={label} className='space-y-1'>
                <div className='text-xs font-semibold text-muted'>{label}</div>
                <div className='font-mono text-lg text-text'>{value}</div>
                <div className='h-1 rounded-full bg-base' style={{ backgroundColor: color, opacity: value / 255 }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {!parsed && input.length > 0 && (
        <Card className='border border-red-500/50 bg-red-500/10 text-sm text-red-200'>
          Unable to parse the color input. Use HEX (#3b82f6), RGB (rgb(59,130,246)), or HSL (hsl(217,91%,60%)).
        </Card>
      )}
    </BaseToolLayout>
  )
}
