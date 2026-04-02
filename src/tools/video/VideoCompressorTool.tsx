import { useCallback, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { Select } from '@/components/ui/Select'
import { Download, Video, Loader2, AlertCircle } from 'lucide-react'

type VideoCompressorToolProps = {
  tool: ToolDefinition
}

export function VideoCompressorTool({ tool }: VideoCompressorToolProps) {
  const [quality, setQuality] = useState(80)
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm')
  const [maintainAudio, setMaintainAudio] = useState(true)
  const [maxWidth, setMaxWidth] = useState(1920)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [outputSize, setOutputSize] = useState<number | null>(null)
  const [inputSize, setInputSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const calculateBitrate = (originalSize: number, duration: number, quality: number): number => {
    // Base bitrate from quality percentage
    const baseBitrate = (quality / 100) * 5000000 // 5 Mbps max
    // If we know the original bitrate, use it as a reference
    const originalBitrate = (originalSize * 8) / duration
    return Math.min(baseBitrate, originalBitrate)
  }

  const compressVideo = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'

      const url = URL.createObjectURL(file)

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        // Calculate dimensions
        let w = video.videoWidth
        let h = video.videoHeight
        if (w > maxWidth) {
          const ratio = maxWidth / w
          w = maxWidth
          h = Math.round(h * ratio)
        }
        // Ensure even dimensions
        if (w % 2 !== 0) w += 1
        if (h % 2 !== 0) h += 1
        canvas.width = w
        canvas.height = h

        // Setup MediaRecorder
        const stream = canvas.captureStream(30)

        // Try to capture audio if supported
        let audioStream: MediaStream | undefined
        if (maintainAudio) {
          try {
            const audioCtx = new AudioContext()
            const source = audioCtx.createMediaElementSource(video)
            const dest = audioCtx.createMediaStreamDestination()
            source.connect(dest)
            source.connect(audioCtx.destination)
            audioStream = dest.stream
            audioStream.getAudioTracks().forEach(t => stream.addTrack(t))
          } catch {
            // Audio capture not supported, proceed silently
          }
        }

        const mimeType =
          format === 'webm'
            ? MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : 'video/webm'
            : MediaRecorder.isTypeSupported('video/mp4')
              ? 'video/mp4'
              : 'video/webm'

        const bitrate = calculateBitrate(file.size, video.duration, quality)
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: Math.round(bitrate),
        })

        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        recorder.onstop = () => {
          URL.revokeObjectURL(url)
          const blob = new Blob(chunks, { type: mimeType })
          resolve(blob)
        }

        recorder.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('MediaRecorder failed during compression.'))
        }

        // Start recording
        recorder.start(100) // Collect data every 100ms
        video.play()

        const drawFrame = () => {
          if (video.paused || video.ended) return
          ctx.drawImage(video, 0, 0, w, h)
          requestAnimationFrame(drawFrame)
        }
        drawFrame()

        video.onended = () => {
          setTimeout(() => recorder.stop(), 200)
        }
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Cannot load or decode this video file.'))
      }

      video.src = url
    })
  }, [quality, format, maintainAudio, maxWidth])

  const handleProcess = useCallback(async (files: ToolFile[], ctx: {
    setProgress: (v: number) => void
    setResult: (n: React.ReactNode) => void
    setError: (m: string | null) => void
  }) => {
    if (files.length === 0) throw new Error('No video file provided.')
    if (files.length > 1) throw new Error('Only one video file at a time.')

    setProcessing(true)
    setError(null)
    setOutputUrl(null)
    setOutputSize(null)

    try {
      const file = files[0].file
      setInputSize(file.size)
      ctx.setProgress(10)

      const compressedBlob = await compressVideo(file)
      ctx.setProgress(90)

      const url = URL.createObjectURL(compressedBlob)
      setOutputUrl(url)
      setOutputSize(compressedBlob.size)
      ctx.setProgress(100)

      ctx.setResult(<Badge className="border-0 bg-accent/15 text-accent">Compression complete</Badge>)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compression failed.'
      setError(msg)
      ctx.setError(msg)
    } finally {
      setProcessing(false)
    }
  }, [compressVideo])

  const handleDownload = useCallback(() => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    const ext = format
    a.download = `compressed.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [outputUrl, format])

  const compressionRatio = inputSize && outputSize
    ? Math.round(((inputSize - outputSize) / inputSize) * 100)
    : 0

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="video/*"
      maxFiles={1}
      onProcess={handleProcess}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Quality</div>
            <Slider
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              unit="%"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Output Format</div>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
            >
              <option value="webm">WebM (VP9)</option>
              <option value="mp4">MP4 (if supported)</option>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Max Width</div>
            <Select
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
            >
              {[640, 854, 1280, 1920, 2560].map(w => (
                <option key={w} value={w}>{w}px ({w >= 1920 ? 'HD+' : w >= 1280 ? 'HD' : w >= 854 ? 'SD' : 'Low'})</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={maintainAudio}
              onChange={(e) => setMaintainAudio(e.target.checked)}
            />
            Preserve audio track
          </label>
          <Badge className="border-0 bg-accent/15 text-accent">Offline • Canvas + MediaRecorder</Badge>
        </div>
      }
      result={outputUrl ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="border-0 bg-emerald-100 text-emerald-700">
              Compressed {compressionRatio > 0 ? `↓ ${compressionRatio}%` : '—'}
            </Badge>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-base/50 p-4">
            <video
              src={outputUrl}
              controls
              className="w-full max-h-64 rounded-lg"
              aria-label="Compressed video preview"
            />
          </div>
          <div className="text-xs text-muted">
            {inputSize ? `Original: ${formatSize(inputSize)}` : ''} → {outputSize ? formatSize(outputSize) : ''}
          </div>
        </Card>
      ) : error ? (
        <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
          <AlertCircle className="inline-block w-4 h-4 mr-1" /> {error}
        </Card>
      ) : null}
    />
  )
}
