import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Image, Code, Download } from 'lucide-react'

type ImageToBase64ToolProps = {
  tool: ToolDefinition
}

export function ImageToBase64Tool({ tool }: ImageToBase64ToolProps) {
  const [base64, setBase64] = useState<string | null>(null)
  const [imageType, setImageType] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result is "data:image/png;base64,..."
      const commaIdx = result.indexOf(',')
      const base64Str = result.slice(commaIdx + 1)
      const mime = result.slice(5, commaIdx) // "image/png;base64" or similar
      setBase64(base64Str)
      setImageType(mime.split(';')[0] || file.type)
      setPreview(result)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleProcess = useCallback(async (files: { file: File }[]) => {
    if (files.length > 0) {
      handleFile(files[0].file)
    }
  }, [handleFile])

  const handleCopy = useCallback(() => {
    if (!base64) return
    navigator.clipboard.writeText(base64).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [base64])

  const handleDownload = useCallback(() => {
    if (!base64 || !imageType) return
    const link = document.createElement('a')
    link.href = `data:${imageType};base64,${base64}`
    link.download = `image.${imageType.split('/').pop() || 'png'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [base64, imageType])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='image/*'
      onProcess={handleProcess}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Info</div>
            <div className='rounded-xl border border-border bg-base/60 px-3 py-2 text-xs text-muted'>
              <div className='flex justify-between mb-1'><span>Type</span><span className='font-mono text-text'>{imageType || '—'}</span></div>
              <div className='flex justify-between'><span>Base64 size</span><span className='font-mono text-text'>{base64 ? `${(base64.length * 0.75 / 1024).toFixed(1)} KB` : '—'}</span></div>
            </div>
          </div>
          {base64 && (
            <div className='flex flex-col gap-2'>
              <Button variant='secondary' onClick={handleCopy} className='w-full'>
                <Copy className='mr-2 h-4 w-4' />
                Copy Base64
              </Button>
              <Button variant='outline' onClick={handleDownload} className='w-full'>
                <Download className='mr-2 h-4 w-4' />
                Download Image
              </Button>
            </div>
          )}
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className='space-y-4'>
        {preview && (
          <Card className='space-y-2'>
            <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
              <Image className='h-3.5 w-3.5' />
              Preview
            </div>
            <div className='flex items-center justify-center rounded-xl border border-border bg-base/60 p-4'>
              <img src={preview} alt='Preview' className='max-h-64 max-w-full object-contain' />
            </div>
          </Card>
        )}

        {base64 && (
          <Card className='space-y-2'>
            <div className='flex items-center gap-1.5 text-xs font-semibold text-accent'>
              <Code className='h-3.5 w-3.5' />
              Base64 Output
            </div>
            <Textarea value={`data:${imageType};base64,${base64}`} onChange={() => {}} rows={6} readOnly className='font-mono text-xs break-all' />
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
