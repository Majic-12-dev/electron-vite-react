import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Copy, CheckCircle, Hash, ArrowLeftRight } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

// Caesar cipher implementation
function caesarCipher(text: string, shift: number): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 65 : 97
    return String.fromCharCode(((char.charCodeAt(0) - base + shift % 26 + 26) % 26) + base)
  })
}

// Vigenère cipher
function vigenereCipher(text: string, key: string, decrypt: boolean = false): string {
  if (!key) return text
  const keyUpper = key.toUpperCase().replace(/[^A-Z]/g, '')
  if (!keyUpper) return text

  let ki = 0
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 65 : 97
    const shift = keyUpper.charCodeAt(ki % keyUpper.length) - 65
    ki++
    const effectiveShift = decrypt ? -shift : shift
    return String.fromCharCode(((char.charCodeAt(0) - base + effectiveShift + 26) % 26) + base)
  })
}

// Rot13 is just Caesar with shift 13
function rot13(text: string): string {
  return caesarCipher(text, 13)
}

// Atbash cipher (A↔Z, B↔Y, etc.)
function atbashCipher(text: string): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 65 : 97
    return String.fromCharCode(base + (25 - (char.charCodeAt(0) - base)))
  })
}

export function CipherTool({ tool }: ToolProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [cipher, setCipher] = useState<'caesar' | 'rot13' | 'vigenere' | 'atbash'>('rot13')
  const [shift, setShift] = useState(13)
  const [key, setKey] = useState('')
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [copied, setCopied] = useState(false)

  const handleProcess = useCallback(() => {
    let result: string
    switch (cipher) {
      case 'caesar':
        result = caesarCipher(input, mode === 'encrypt' ? shift : -shift)
        break
      case 'rot13':
        result = rot13(input) // symmetric, mode doesn't matter
        break
      case 'vigenere':
        result = vigenereCipher(input, key, mode === 'decrypt')
        break
      case 'atbash':
        result = atbashCipher(input) // symmetric, mode doesn't matter
        break
      default:
        result = input
    }
    setOutput(result)
    setCopied(false)
  }, [input, cipher, shift, key, mode])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [output])

  const needsShift = cipher === 'caesar'
  const needsKey = cipher === 'vigenere'

  const ciphers = [
    { id: 'caesar' as const, label: 'Caesar', desc: 'Shift by N positions' },
    { id: 'rot13' as const, label: 'ROT13', desc: 'Shift by 13 (symmetric)' },
    { id: 'vigenere' as const, label: 'Vigenère', desc: 'Polyalphabetic key' },
    { id: 'atbash' as const, label: 'Atbash', desc: 'Reverse alphabet' },
  ]

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => handleProcess()}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Cipher</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ciphers.map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => { setCipher(id); setOutput(null); }}
                  className={`text-left rounded-lg border px-2.5 py-2 transition ${
                    cipher === id
                      ? 'border-accent/50 bg-accent/15'
                      : 'border-border bg-base/50 hover:bg-panel'
                  }`}
                >
                  <div className={`text-xs font-semibold ${cipher === id ? 'text-accent' : 'text-text'}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-muted">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Mode</div>
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('encrypt'); setOutput(null); }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs transition ${
                  mode === 'encrypt'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'border border-border bg-base/50 text-muted hover:text-text'
                }`}
              >
                Encrypt
              </button>
              <button
                onClick={() => { setMode('decrypt'); setOutput(null); }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs transition ${
                  mode === 'decrypt'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'border border-border bg-base/50 text-muted hover:text-text'
                }`}
              >
                Decrypt
              </button>
            </div>
          </div>

          {needsShift && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted">Shift: {shift}</div>
              <input
                type="range"
                min={1}
                max={25}
                value={shift}
                onChange={(e) => setShift(parseInt(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <button onClick={() => setShift(1)} className="text-muted hover:text-text">A+1</button>
                <span>Caesar shift: {shift}</span>
                <button onClick={() => setShift(25)} className="text-muted hover:text-text">A+25</button>
              </div>
            </div>
          )}

          {needsKey && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted">Key</div>
              <input
                type="text"
                value={key}
                onChange={(e) => { setKey(e.target.value); setOutput(null) }}
                placeholder="e.g. SECRETKEY"
                className="w-full h-9 rounded-xl border border-border bg-base/70 px-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          )}

          <Button onClick={handleProcess} className="w-full" disabled={!input.trim()}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}
          </Button>
          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted">Input text</label>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setOutput(null) }}
            placeholder="Enter text to encrypt or decrypt..."
            rows={6}
            className="w-full rounded-xl border border-border bg-base/70 px-3 py-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        {output && (
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted" />
                <span className="text-xs font-semibold uppercase text-muted">
                  {mode === 'encrypt' ? 'Encrypted output' : 'Decrypted output'}
                </span>
              </div>
              <Button variant="ghost" className="h-6 text-xs" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle className="mr-1 h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="mr-1 h-3 w-3" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="rounded-xl border border-border bg-base/60 p-3 text-sm font-mono whitespace-pre-wrap break-words text-text max-h-48 overflow-auto">
              {output}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
