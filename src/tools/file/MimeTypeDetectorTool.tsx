import { useState, useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type MimeTypeDetectorToolProps = {
  tool: ToolDefinition
}

// Common MIME type mapping by extension
const EXTENSION_TO_MIME: Record<string, string> = {
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  // Archives
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  // Code/Data
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'application/toml',
  '.sql': 'application/sql',
  '.sh': 'application/x-sh',
  '.py': 'text/x-python',
  // Fonts
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  // Misc
  '.exe': 'application/x-msdownload',
  '.dmg': 'application/x-apple-diskimage',
  '.iso': 'application/x-iso9660-image',
}

// Magic byte signatures for sniffing
const MAGIC_SIGNATURES: { offset: number; bytes: number[]; mime: string; description: string }[] = [
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png', description: 'PNG Image' },
  { offset: 0, bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg', description: 'JPEG Image' },
  { offset: 0, bytes: [0x47, 0x49, 0x46], mime: 'image/gif', description: 'GIF Image' },
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/x-wav', description: 'RIFF Container (WAV/WEBP)' },
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], mime: 'application/zip', description: 'ZIP/PPTX/DOCX/XLSX' },
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], mime: 'application/pdf', description: 'PDF Document' },
  { offset: 0, bytes: [0x1f, 0x8b], mime: 'application/gzip', description: 'GZIP Archive' },
  { offset: 0, bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], mime: 'application/x-7z-compressed', description: '7-Zip Archive' },
  { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0], mime: 'application/x-ole-storage', description: 'OLE Compound (Old Office)' },
  { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50], mime: 'image/webp', description: 'WebP Image' },
]

type FileResult = {
  name: string
  size: number
  typeFromBrowser: string
  typeByExtension: string
  typeByMagic: string | null
  magicDescription: string | null
  confidence: 'high' | 'medium' | 'low'
}

export function MimeTypeDetectorTool({ tool }: MimeTypeDetectorToolProps) {
  const [results, setResults] = useState<FileResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const detectMagicBytes = useCallback((buffer: ArrayBuffer): { mime: string; description: string } | null => {
    const view = new Uint8Array(buffer)
    for (const sig of MAGIC_SIGNATURES) {
      if (view.length < sig.offset + sig.bytes.length) continue
      let match = true
      for (let j = 0; j < sig.bytes.length; j++) {
        if (view[sig.offset + j] !== sig.bytes[j]) {
          match = false
          break
        }
      }
      if (match) return { mime: sig.mime, description: sig.description }
    }
    return null
  }, [])

  const handleProcess = useCallback(async (
    files: Array<{ file: File; name: string; size: number }>,
    context: { setProgress: (v: number) => void; setResult: (r: ReactNode | null) => void; setError: (m: string | null) => void }
  ) => {
    if (!files.length) {
      context.setError('No files selected.')
      return
    }

    setIsProcessing(true)
    context.setProgress(0)

    try {
      const total = files.length
      const fileResults: FileResult[] = []

      for (let i = 0; i < total; i++) {
        const toolFile = files[i]
        const ext = '.' + toolFile.name.split('.').pop()?.toLowerCase()

        const extType = EXTENSION_TO_MIME[ext] || 'application/octet-stream'

        let magicResult: { mime: string; description: string } | null = null
        try {
          const buffer = await toolFile.file.slice(0, 32).arrayBuffer()
          magicResult = detectMagicBytes(buffer)
        } catch {
          // File too small or unreadable
        }

        let confidence: 'high' | 'medium' | 'low' = 'low'
        if (magicResult && magicResult.mime === extType && toolFile.file.type) {
          if (toolFile.file.type === extType) {
            confidence = 'high'
          } else {
            confidence = 'medium'
          }
        } else if (magicResult) {
          confidence = 'medium'
        } else if (toolFile.file.type === extType) {
          confidence = 'high'
        } else if (toolFile.file.type) {
          confidence = 'medium'
        }

        // For RIFF files, distinguish WAV vs WebP by looking at container type
        let finalMagicDescription: string | null = null
        let finalMagicType: string | null = null
        if (magicResult) {
          finalMagicType = magicResult.mime
          finalMagicDescription = magicResult.description
          if (magicResult.mime === 'image/webp') {
            finalMagicType = 'image/webp'
          } else if (magicResult.mime === 'application/x-ole-storage' && extType.includes('vnd.openxmlformats')) {
            finalMagicType = 'detect-new-ole'
          }
        }

        fileResults.push({
          name: toolFile.name,
          size: toolFile.size,
          typeFromBrowser: toolFile.file.type || '(unknown)',
          typeByExtension: extType,
          typeByMagic: finalMagicType,
          magicDescription: finalMagicDescription,
          confidence,
        })
        context.setProgress(Math.round(((i + 1) / total) * 90))
      }

      setResults(fileResults)
      context.setProgress(100)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">Detection Complete</h3>
          <div className="space-y-2">
            {fileResults.map((r, i) => (
              <div key={i} className="rounded-lg border border-border bg-base/30 p-3 text-xs space-y-1">
                <div className="font-medium text-text">{r.name}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span className="text-muted">Browser:</span>
                  <span className="font-mono text-text">{r.typeFromBrowser}</span>
                  <span className="text-muted">Extension:</span>
                  <span className="font-mono text-text">{r.typeByExtension}</span>
                  {r.typeByMagic && (
                    <>
                      <span className="text-muted">Magic:</span>
                      <span className="font-mono text-text">{r.typeByMagic}</span>
                    </>
                  )}
                  <span className="text-muted">Confidence:</span>
                  <Badge className={`border-0 w-fit ${r.confidence === 'high' ? 'bg-green-500/15 text-green-600' : r.confidence === 'medium' ? 'bg-yellow-500/15 text-yellow-600' : 'bg-red-500/15 text-red-400'}`}>
                    {r.confidence}
                  </Badge>
                </div>
                {r.magicDescription && (
                  <div className="text-muted italic">{r.magicDescription}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )

      context.setResult(resultCard)
    } catch (err) {
      context.setError(err instanceof Error ? err.message : 'Detection failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [detectMagicBytes])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="*/*"
      onProcess={handleProcess}
      loading={isProcessing}
      options={
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted">
            Detect MIME types using three signal layers: browser detection, file extension mapping, and magic byte signatures.
          </p>
        </div>
      }
    >
      <canvas ref={previewCanvasRef} className="hidden" />
    </BaseToolLayout>
  )
}
