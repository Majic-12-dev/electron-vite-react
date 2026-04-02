import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Download, QrCode, RefreshCw } from 'lucide-react'
import QRCodeLib from 'qrcode'

type QrCodeGeneratorToolProps = {
  tool: ToolDefinition
}

export function QrCodeGeneratorTool({ tool }: QrCodeGeneratorToolProps) {
  const [text, setText] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generateQR = useCallback(async () => {
    if (!text.trim()) {
      setError('Please enter some text or a URL.')
      setQrDataUrl(null)
      return
    }
    try {
      const dataUrl = await QRCodeLib.toDataURL(text.trim(), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 256,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
      })
      setQrDataUrl(dataUrl)
      setError(null)
    } catch (err) {
      setError('Failed to generate QR code. The input may be too long.')
      setQrDataUrl(null)
    }
  }, [text])

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = 'qrcode.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [qrDataUrl])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => {
        await generateQR()
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Input</div>
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(null)
              }}
              placeholder='Enter a URL or text to encode'
              rows={3}
            />
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Quick Examples</div>
            <div className='flex flex-wrap gap-2'>
              {['https://example.com', 'Hello, World!', 'tel:+1234567890'].map((sample) => (
                <button
                  key={sample}
                  onClick={() => {
                    setText(sample)
                    setError(null)
                  }}
                  className='rounded-full border border-border bg-base/60 px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-text'
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={generateQR} className='w-full'>
            <QrCode className='mr-2 h-4 w-4' />
            Generate
          </Button>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
      result={
        qrDataUrl ? (
          <Card className='space-y-4'>
            <div className='flex flex-col items-center gap-4'>
              <div className='rounded-xl border border-border bg-white p-4'>
                <img
                  src={qrDataUrl}
                  alt='QR Code'
                  className='h-48 w-48'
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <div className='flex gap-2'>
                <Button variant='secondary' onClick={handleDownload}>
                  <Download className='mr-2 h-4 w-4' />
                  Download PNG
                </Button>
                <Button variant='ghost' onClick={generateQR}>
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Regenerate
                </Button>
              </div>
            </div>
          </Card>
        ) : error ? (
          <Card className='border border-red-500/50 bg-red-500/10 text-sm text-red-200'>
            {error}
          </Card>
        ) : null
      }
    />
  )
}
