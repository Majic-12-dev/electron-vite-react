import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Camera, Download, Monitor, Square, Trash2, Copy, Image as ImageIcon, Crop as CropIcon, AlertCircle } from 'lucide-react'

type ScreenshotToolProps = {
  tool: ToolDefinition
}

type ScreenshotEntry = {
  id: string
  url: string
  timestamp: number
  width: number
  height: number
  source: 'display' | 'camera' | 'tab'
}

export function ScreenshotTool({ tool }: ScreenshotToolProps) {
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([])
  const [recording, setRecording] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [selectedSource, setSelectedSource] = useState<'display' | 'window' | 'tab'>('display')
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [cropMode, setCropMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [stream])

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      screenshots.forEach(s => { try { URL.revokeObjectURL(s.url) } catch {} })
    }
  }, [])

  const captureDisplay = useCallback(async () => {
    try {
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          cursor: 'always' as const,
          displaySurface: selectedSource === 'tab' ? 'browser' as const : selectedSource === 'window' ? 'window' as const : 'monitor' as const,
        },
        audio: false,
      }
      const mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
      
      // Take a snapshot
      const video = document.createElement('video')
      video.srcObject = mediaStream
      await new Promise<void>(resolve => {
        video.onloadedmetadata = () => {
          video.play()
          setTimeout(resolve, 100)
        }
      })
      
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      
      // Stop the stream
      mediaStream.getTracks().forEach(t => t.stop())
      
      const url = canvas.toDataURL('image/png')
      const entry: ScreenshotEntry = {
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        url,
        timestamp: Date.now(),
        width: canvas.width,
        height: canvas.height,
        source: 'display',
      }
      
      setScreenshots(prev => [entry, ...prev])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Screenshot permission was denied.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to capture display.')
      }
    }
  }, [selectedSource])

  const captureCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
      
      const video = document.createElement('video')
      video.srcObject = mediaStream
      await new Promise<void>(resolve => {
        video.onloadedmetadata = () => { video.play(); setTimeout(resolve, 100) }
      })
      
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      
      mediaStream.getTracks().forEach(t => t.stop())
      
      const url = canvas.toDataURL('image/png')
      const entry: ScreenshotEntry = {
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        url,
        timestamp: Date.now(),
        width: canvas.width,
        height: canvas.height,
        source: 'camera',
      }
      
      setScreenshots(prev => [entry, ...prev])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Camera permission was denied.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to capture camera.')
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true,
      })
      
      setStream(mediaStream)
      setRecording(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
        videoRef.current.muted = true
      }
      
      // Stop recording when user shares stop
      mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording()
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotAllowedError') {
        setError('Failed to start recording.')
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
      setRecording(false)
    }
  }, [stream])

  const countdownCapture = useCallback(async (source: 'display' | 'camera') => {
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(0)
    if (source === 'display') await captureDisplay()
    else await captureCamera()
  }, [captureDisplay, captureCamera])

  const download = useCallback((entry: ScreenshotEntry) => {
    const a = document.createElement('a')
    a.href = entry.url
    a.download = `screenshot-${entry.timestamp}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const downloadAll = useCallback(() => {
    screenshots.forEach((s, i) => {
      setTimeout(() => download(s), i * 300)
    })
  }, [screenshots, download])

  const remove = useCallback((id: string) => {
    setScreenshots(prev => {
      const entry = prev.find(s => s.id === id)
      if (entry) {
        try { URL.revokeObjectURL(entry.url) } catch {}
      }
      return prev.filter(s => s.id !== id)
    })
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const copyToClipboard = useCallback(async (entry: ScreenshotEntry) => {
    try {
      const res = await fetch(entry.url)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {
      setError('Failed to copy image to clipboard.')
    }
  }, [])

  const handleCrop = useCallback(() => {
    if (!selectedId) return
    const entry = screenshots.find(s => s.id === selectedId)
    if (!entry) return
    
    // For simplicity, we just download the current image as-is
    // A full crop tool would use a cropping library
    download(entry)
  }, [selectedId, screenshots, download])

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString()
  const formatCountdown = (n: number) => n > 0 ? `📸 ${n}...` : ''

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
    >
      <div className="space-y-4">
        {/* Source Selection */}
        <Card className="space-y-3">
          <div className="text-xs font-semibold uppercase text-muted">Capture Source</div>
          <div className="flex gap-2">
            <Select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as 'display' | 'window' | 'tab')}
              aria-label="Capture source"
            >
              <option value="display">Full Screen</option>
              <option value="window">Application Window</option>
              <option value="tab">Browser Tab</option>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => countdownCapture('display')} aria-label="Capture screen with 3 second countdown">
              <Monitor className="mr-1 h-4 w-4" /> Capture Screen
            </Button>
            <Button variant="outline" onClick={() => countdownCapture('camera')} aria-label="Capture camera with 3 second countdown">
              <Camera className="mr-1 h-4 w-4" /> Camera
            </Button>
            {!recording ? (
              <Button variant="ghost" onClick={startRecording}>
                <Square className="mr-1 h-4 w-4 text-red-400" /> Record
              </Button>
            ) : (
              <Button variant="ghost" onClick={stopRecording} className="text-red-400">
                <Square className="mr-1 h-4 w-4" fill="currentColor" /> Stop
              </Button>
            )}
          </div>
        </Card>

        {/* Countdown indicator */}
        {countdown > 0 && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50" role="alert" aria-live="assertive" aria-label="Countdown in progress">
            <div className="text-6xl font-bold text-white animate-pulse">
              {formatCountdown(countdown)}
            </div>
          </div>
        )}

        {/* Recording Preview */}
        {recording && (
          <Card className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Recording in progress...
            </div>
            <video
              ref={videoRef}
              className="w-full rounded-lg border border-border max-h-64 object-contain bg-black"
              autoPlay
              muted
              playsInline
              aria-label="Recording preview"
            />
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
            <AlertCircle className="inline-block w-4 h-4 mr-1" /> {error}
          </Card>
        )}

        {/* Screenshots Gallery */}
        {screenshots.length > 0 && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">
                Screenshots ({screenshots.length})
              </span>
              <div className="flex gap-2">
                {selectedId && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCrop}>
                      <CropIcon className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(screenshots.find(s => s.id === selectedId)!)}>
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={downloadAll}>
                  <Download className="w-3 h-3 mr-1" /> All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {screenshots.map(s => (
                <div
                  key={s.id}
                  className={`group relative rounded-xl overflow-hidden cursor-pointer transition border-2 ${
                    selectedId === s.id ? 'border-accent' : 'border-border hover:border-accent/50'
                  }`}
                  onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(selectedId === s.id ? null : s.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Screenshot ${formatTime(s.timestamp)}, ${s.source}`}
                  aria-pressed={selectedId === s.id}
                >
                  <img
                    src={s.url}
                    alt={`Screenshot ${formatTime(s.timestamp)}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                    <div className="flex gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          download(s)
                        }}
                        aria-label={`Download screenshot ${formatTime(s.timestamp)}`}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-400"
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(s.id)
                        }}
                        aria-label={`Remove screenshot ${formatTime(s.timestamp)}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Info */}
        <Badge className="border-0 bg-accent/15 text-accent">
          Uses Display & Camera APIs • Requires permissions
        </Badge>

        {/* Hidden canvas for internal use */}
        <canvas ref={canvasRef} className="hidden" />
        <canvas ref={cropCanvasRef} className="hidden" />
      </div>
    </BaseToolLayout>
  )
}
