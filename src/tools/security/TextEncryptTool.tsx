import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Lock, Unlock, KeyRound, AlertCircle } from 'lucide-react'

type TextEncryptToolProps = {
  tool: ToolDefinition
}

// AES-GCB encrypt/decrypt using Web Crypto
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptText(text: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  // Prepend salt + iv + ciphertext, base64
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptText(b64: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)
  const key = await deriveKey(password, salt)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

export function TextEncryptTool({ tool }: TextEncryptToolProps) {
  const [text, setText] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleProcess = useCallback(async () => {
    if (!text.trim() || !password.trim()) {
      setError('Please enter both text and a password.')
      return
    }
    setError(null)
    setResult(null)
    setCopied(false)
    try {
      if (mode === 'encrypt') {
        const encrypted = await encryptText(text.trim(), password)
        setResult(encrypted)
      } else {
        const decrypted = await decryptText(text.trim(), password)
        setResult(decrypted)
      }
    } catch (e) {
      setError(mode === 'decrypt' ? 'Decryption failed. Check your password.' : 'Encryption failed.')
      setResult(null)
    }
  }, [text, password, mode])

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [result])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Mode</div>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => { setMode('encrypt'); setError(null); setResult(null) }}
                className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-medium transition
                  ${mode === 'encrypt' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
              >
                <Lock className='mx-auto mb-1 h-4 w-4' />
                Encrypt
              </button>
              <button
                type='button'
                onClick={() => { setMode('decrypt'); setError(null); setResult(null) }}
                className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-medium transition
                  ${mode === 'decrypt' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
              >
                <Unlock className='mx-auto mb-1 h-4 w-4' />
                Decrypt
              </button>
            </div>
          </div>
          <div className='space-y-2'>
            <label className='text-xs font-semibold uppercase text-muted'>Password</label>
            <Input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Enter a strong password'
            />
            {password && (
              <div className='flex gap-0.5'>
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1.5 rounded-full transition ${password.length > (i + 1) * 6 ? (password.length > 20 ? 'bg-green-400' : 'bg-yellow-400') : 'bg-border'}`}
                  />
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleProcess} disabled={!text.trim() || !password.trim()} className='w-full'>
            {mode === 'encrypt' ? <><Lock className='mr-2 h-4 w-4' /> Encrypt</> : <><Unlock className='mr-2 h-4 w-4' /> Decrypt</>}
          </Button>
          <div className='rounded-xl border border-border bg-base/60 px-3 py-2 text-xs text-muted'>
            Uses AES-256-GCM with PBKDF2 (100K iterations). All done locally.
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-xs font-semibold uppercase text-muted'>
            {mode === 'encrypt' ? 'Text to encrypt' : 'Encrypted text (Base64)'}
          </label>
          <Textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null); setError(null) }}
            placeholder={mode === 'encrypt' ? 'Enter secret text...' : 'Paste encrypted Base64 string...'}
            rows={5}
            className='font-mono'
          />
        </div>

        {error && (
          <div className='flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
            <AlertCircle className='h-4 w-4 flex-shrink-0' />
            {error}
          </div>
        )}

        {result && (
          <Card className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
                <KeyRound className='h-3.5 w-3.5' />
                {mode === 'encrypt' ? 'Encrypted (Base64)' : 'Decrypted Text'}
              </div>
              <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
                {copied ? <CheckCircle className='mr-1 h-3 w-3 text-green-400' /> : <Copy className='mr-1 h-3 w-3' />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Textarea value={result} onChange={() => {}} rows={5} readOnly className='font-mono text-sm break-all' />
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
