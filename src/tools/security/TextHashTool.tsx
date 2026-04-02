import { useCallback, useEffect, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Hash, Calculator } from 'lucide-react'

type TextHashToolProps = {
  tool: ToolDefinition
}

async function cryptoHash(algo: string, text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const hashBuffer = await crypto.subtle.digest(algo, ab)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Simple MD5 in JS (Web Crypto doesn't support MD5)
async function md5(text: string): Promise<string> {
  // UTF-8 encode
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)) }
    else if (c < 0xd800 || c >= 0xe000) { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)) }
    else {
      // Surrogate pair
      c = 0x10000 + (((c & 0x3ff) << 10) | (text.charCodeAt(++i) & 0x3ff))
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    }
  }
  
  const len = bytes.length
  const padded = [...bytes]
  padded.push(0x80)
  while (padded.length % 64 !== 56) padded.push(0)
  const bitLen = len * 8
  for (let i = 0; i < 8; i++) padded.push((bitLen >>> (i * 8)) & 0xff)

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21

  function add(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }
  function ror(x: number, n: number): number { return (x >>> n) | (x << (32 - n)) }

  const T = Array.from({ length: 64 }, (_, i) => Math.floor(4294967296 * Math.abs(Math.sin(i + 1))))
  const M = padded

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476

  for (let offset = 0; offset < M.length; offset += 64) {
    const A = a, B = b, C = c, D = d
    const X = M.slice(offset, offset + 16)

    function md5round(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return add(b, ror(add(add(a, add((b & c) | ((~b) & d), add(x, t))), b), s))
    }
    function md5roundG(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return add(b, ror(add(add(a, add((b & d) | (c & (~d)), add(x, t))), b), s))
    }
    function md5roundH(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return add(b, ror(add(add(a, add(b ^ c ^ d, add(x, t))), b), s))
    }
    function md5roundI(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
      return add(b, ror(add(add(a, add(c ^ (b | (~d)), add(x, t))), b), s))
    }

    a = md5round(a, b, c, d, X[ 0], S11, T[ 0]); d = md5round(d, a, b, c, X[ 1], S12, T[ 1])
    c = md5round(c, d, a, b, X[ 2], S13, T[ 2]); b = md5round(b, c, d, a, X[ 3], S14, T[ 3])
    a = md5round(a, b, c, d, X[ 4], S11, T[ 4]); d = md5round(d, a, b, c, X[ 5], S12, T[ 5])
    c = md5round(c, d, a, b, X[ 6], S13, T[ 6]); b = md5round(b, c, d, a, X[ 7], S14, T[ 7])
    a = md5round(a, b, c, d, X[ 8], S11, T[ 8]); d = md5round(d, a, b, c, X[ 9], S12, T[ 9])
    c = md5round(c, d, a, b, X[10], S13, T[10]); b = md5round(b, c, d, a, X[11], S14, T[11])
    a = md5round(a, b, c, d, X[12], S11, T[12]); d = md5round(d, a, b, c, X[13], S12, T[13])
    c = md5round(c, d, a, b, X[14], S13, T[14]); b = md5round(b, c, d, a, X[15], S14, T[15])

    a = md5roundG(a, b, c, d, X[ 1], S21, T[16]); d = md5roundG(d, a, b, c, X[ 6], S22, T[17])
    c = md5roundG(c, d, a, b, X[11], S23, T[18]); b = md5roundG(b, c, d, a, X[ 0], S24, T[19])
    a = md5roundG(a, b, c, d, X[ 5], S21, T[20]); d = md5roundG(d, a, b, c, X[10], S22, T[21])
    c = md5roundG(c, d, a, b, X[15], S23, T[22]); b = md5roundG(b, c, d, a, X[ 4], S24, T[23])
    a = md5roundG(a, b, c, d, X[ 9], S21, T[24]); d = md5roundG(d, a, b, c, X[14], S22, T[25])
    c = md5roundG(c, d, a, b, X[ 3], S23, T[26]); b = md5roundG(b, c, d, a, X[ 8], S24, T[27])
    a = md5roundG(a, b, c, d, X[12], S21, T[28]); d = md5roundG(d, a, b, c, X[ 7], S22, T[29])
    c = md5roundG(c, d, a, b, X[ 2], S23, T[30]); b = md5roundG(b, c, d, a, X[13], S24, T[31])

    a = md5roundH(a, b, c, d, X[ 5], S31, T[32]); d = md5roundH(d, a, b, c, X[ 8], S32, T[33])
    c = md5roundH(c, d, a, b, X[11], S33, T[34]); b = md5roundH(b, c, d, a, X[14], S34, T[35])
    a = md5roundH(a, b, c, d, X[ 1], S31, T[36]); d = md5roundH(d, a, b, c, X[ 4], S32, T[37])
    c = md5roundH(c, d, a, b, X[ 7], S33, T[38]); b = md5roundH(b, c, d, a, X[10], S34, T[39])
    a = md5roundH(a, b, c, d, X[13], S31, T[40]); d = md5roundH(d, a, b, c, X[ 0], S32, T[41])
    c = md5roundH(c, d, a, b, X[ 3], S33, T[42]); b = md5roundH(b, c, d, a, X[ 6], S34, T[43])
    a = md5roundH(a, b, c, d, X[ 9], S31, T[44]); d = md5roundH(d, a, b, c, X[12], S32, T[45])
    c = md5roundH(c, d, a, b, X[15], S33, T[46]); b = md5roundH(b, c, d, a, X[ 2], S34, T[47])

    a = md5roundI(a, b, c, d, X[ 0], S41, T[48]); d = md5roundI(d, a, b, c, X[ 7], S42, T[49])
    c = md5roundI(c, d, a, b, X[14], S43, T[50]); b = md5roundI(b, c, d, a, X[ 5], S44, T[51])
    a = md5roundI(a, b, c, d, X[12], S41, T[52]); d = md5roundI(d, a, b, c, X[ 3], S42, T[53])
    c = md5roundI(c, d, a, b, X[10], S43, T[54]); b = md5roundI(b, c, d, a, X[ 1], S44, T[55])
    a = md5roundI(a, b, c, d, X[ 8], S41, T[56]); d = md5roundI(d, a, b, c, X[15], S42, T[57])
    c = md5roundI(c, d, a, b, X[ 6], S43, T[58]); b = md5roundI(b, c, d, a, X[13], S44, T[59])
    a = md5roundI(a, b, c, d, X[ 4], S41, T[60]); d = md5roundI(d, a, b, c, X[11], S42, T[61])
    c = md5roundI(c, d, a, b, X[ 2], S43, T[62]); b = md5roundI(b, c, d, a, X[ 9], S44, T[63])

    a = add(a, A); b = add(b, B); c = add(c, C); d = add(d, D)
  }

  return [a, b, c, d].map(v => {
    let s = (v >>> 0).toString(16)
    while (s.length < 8) s = '0' + s
    return s
  }).join('')
}

type HashResult = {
  algo: string
  hash: string
  bitLength: number
}

export function TextHashTool({ tool }: TextHashToolProps) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<HashResult[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [isComputing, setIsComputing] = useState(false)

  const computeAll = useCallback(async (input: string) => {
    if (!input.trim()) { setResults([]); setIsComputing(false); return }
    setIsComputing(true)
    try {
      const [sha256, sha512, sha1Val, md5Val] = await Promise.all([
        cryptoHash('SHA-256', input),
        cryptoHash('SHA-512', input),
        cryptoHash('SHA-1', input),
        md5(input),
      ])
      setResults([
        { algo: 'SHA-1', hash: sha1Val, bitLength: 160 },
        { algo: 'SHA-256', hash: sha256, bitLength: 256 },
        { algo: 'SHA-512', hash: sha512, bitLength: 512 },
        { algo: 'MD5', hash: md5Val, bitLength: 128 },
      ])
    } finally {
      setIsComputing(false)
    }
  }, [])

  useEffect(() => {
    if (!text.trim()) { setResults([]); return }
    let cancelled = false
    computeAll(text).then(() => { /* setResults handled inside computeAll */ })
    return () => { cancelled = true }
  }, [text, computeAll])

  const handleCopy = useCallback((hash: string, idx: number) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Supported Algorithms</div>
            <div className='space-y-1.5'>
              {['SHA-1 (160-bit)', 'SHA-256 (256-bit)', 'SHA-512 (512-bit)', 'MD5 (128-bit, JS)'].map(a => (
                <div key={a} className='flex items-center justify-between rounded-lg border border-border bg-base/60 px-3 py-1.5 text-xs'>
                  <span className='text-muted'>{a}</span>
                  <Hash className='h-3 w-3 text-accent' />
                </div>
              ))}
            </div>
          </div>
          <div className='rounded-xl border border-border bg-base/60 px-3 py-2 text-xs text-muted'>
            All hashing done in-browser using Web Crypto API + JS MD5. No data leaves your device.
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>Text to hash</label>
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); if (!(e.target.value.trim())) setResults([]) }}
            placeholder='Enter any text to compute its hashes...'
          />
        </div>

        {(isComputing || results.length > 0) && (
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Results</div>
            {isComputing ? (
              <div className='text-sm text-muted animate-pulse'>Computing hashes...</div>
            ) : (
              results.map((r, i) => (
                <Card key={r.algo} className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2 text-xs'>
                      <Calculator className='h-3.5 w-3.5 text-accent' />
                      <span className='font-semibold text-text'>{r.algo}</span>
                      <span className='text-muted'>({r.bitLength} bits)</span>
                    </div>
                    <Button variant='ghost' className='h-6 text-[10px]' onClick={() => handleCopy(r.hash, i)}>
                      {copiedIdx === i ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <Copy className='mr-1 h-3 w-3' />}
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className='overflow-x-auto rounded-xl border border-border bg-base/60 px-3 py-2'>
                    <code className='font-mono text-xs text-text break-all'>{r.hash}</code>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
