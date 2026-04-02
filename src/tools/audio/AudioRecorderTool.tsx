import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Mic, Square, Download, Clock, AlertCircle, AudioLines, Trash2, Pause } from 'lucide-react'

type AudioRecorderToolProps = {
  tool: ToolDefinition
}

type Recording = {
  id: string
  url: string
  blob: Blob
  duration: number
  timestamp: number
  format: string
}

export function AudioRecorderTool({ tool }: AudioRecorderToolProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [format, setFormat] = useState<'webm' | 'wav' | 'ogg'>('webm')
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioLevelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const pausedTimeRef = useRef(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioLevelRef.current) clearInterval(audioLevelRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      recordings.forEach(r => { try { URL.revokeObjectURL(r.url) } catch {} })
    }
  }, [])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    audioLevelRef.current = setInterval(() => {
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setAudioLevel(Math.round((avg / 255) * 100))
    }, 100)

    return audioCtx
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      })
      streamRef.current = stream

      // Determine supported mime type
      let mimeType = ''
      const formatOptions = {
        webm: ['audio/webm', 'audio/webm;codecs=opus'],
        ogg: ['audio/ogg', 'audio/ogg;codecs=opus'],
        wav: ['audio/wav'], // Not really supported by MediaRecorder, will fall back
      }

      for (const mt of formatOptions[format]) {
        if (MediaRecorder.isTypeSupported(mt)) {
          mimeType = mt
          break
        }
      }

      const recorderOptions = mimeType ? { mimeType } : {}
      const recorder = new MediaRecorder(stream, recorderOptions)

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const actualMime = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: actualMime })
        const url = URL.createObjectURL(blob)
        const duration = (Date.now() - startTimeRef.current) / 1000
        const detectedFormat = actualMime.includes('webm') ? 'webm' : actualMime.includes('ogg') ? 'ogg' : 'webm'

        const recording: Recording = {
          id: crypto.randomUUID?.() ?? `${Date.now()}`,
          url,
          blob,
          duration,
          timestamp: Date.now(),
          format: detectedFormat,
        }
        setRecordings(prev => [recording, ...prev])
        setStatus('stopped')
      }

      mediaRecorderRef.current = recording
      recorder.start(100)
      startTimeRef.current = Date.now() - pausedTimeRef.current
      setStatus('recording')

      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setElapsed(elapsed)
      }, 100)

      // Start audio level monitoring
      const audioCtx = startAudioLevelMonitoring(stream)

      // Auto-close audio context when stream ends
      stream.getAudioTracks()[0].addEventListener('ended', () => {
        audioCtx.close()
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Microphone permission was denied. Please allow microphone access.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start recording.')
      }
    }
  }, [format, startAudioLevelMonitoring])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (audioLevelRef.current) clearInterval(audioLevelRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    pausedTimeRef.current = 0
    setAudioLevel(0)
    setElapsed(0)
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      pausedTimeRef.current = elapsed
      if (timerRef.current) clearInterval(timerRef.current)
      setStatus('paused')
    }
  }, [elapsed])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      startTimeRef.current = Date.now() - pausedTimeRef.current
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000)
      }, 100)
      setStatus('recording')
    }
  }, [])

  const download = useCallback((recording: Recording) => {
    const a = document.createElement('a')
    a.href = recording.url
    a.download = `recording-${recording.timestamp}.${recording.format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const downloadAll = useCallback(() => {
    recordings.forEach((r, i) => {
      setTimeout(() => download(r), i * 200)
    })
  }, [recordings, download])

  const removeRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id)
      if (rec) { try { URL.revokeObjectURL(rec.url) } catch {} }
      return prev.filter(r => r.id !== id)
    })
  }, [])

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
    >
      <div className="space-y-4">
        {/* Controls */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'webm' | 'wav' | 'ogg')}
                aria-label="Output format"
              >
                <option value="webm">WebM (Opus)</option>
                <option value="ogg">OGG</option>
                <option value="wav">WAV</option>
              </Select>
              <Badge className={`border-0 px-2 py-0.5 transition ${
                status === 'recording' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                'bg-accent/15 text-accent'
              }`} aria-live="polite" aria-label={`Recording status: ${status}`}>
                {status === 'recording' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 inline-block" />}
                {status === 'idle' ? 'Ready' : status === 'recording' ? 'Recording' : status === 'paused' ? 'Paused' : 'Stopped'}
              </Badge>
            </div>
            <span className="font-mono text-sm text-text" aria-live="polite" aria-label={`Elapsed time: ${formatTime(elapsed)}`}>
              {formatTime(elapsed)}
            </span>
          </div>

          {/* Audio level meter */}
          <div className="space-y-1">
            <div className="text-xs text-muted flex items-center justify-between">
              <span>Audio Level</span>
              <span className="font-mono">{audioLevel}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-base/50 overflow-hidden" role="meter" aria-valuenow={audioLevel} aria-valuemin={0} aria-valuemax={100} aria-label="Audio input level">
              <div
                className={`h-full rounded-full transition-all ${
                  audioLevel > 80 ? 'bg-red-500' : audioLevel > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(audioLevel, 100)}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-center">
            {status === 'idle' || status === 'stopped' ? (
              <Button onClick={startRecording} aria-label="Start recording">
                <Mic className="mr-2 h-4 w-4" /> Record
              </Button>
            ) : status === 'recording' ? (
              <>
                <Button variant="outline" onClick={pauseRecording} aria-label="Pause recording">
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
                <Button variant="ghost" className="text-red-400" onClick={stopRecording} aria-label="Stop recording">
                  <Square className="mr-2 h-4 w-4" fill="currentColor" /> Stop
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={resumeRecording} aria-label="Resume recording">
                <Mic className="mr-2 h-4 w-4" /> Resume
              </Button>
            )}
          </div>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
            <AlertCircle className="inline-block w-4 h-4 mr-1" /> {error}
          </Card>
        )}

        {/* Recordings */}
        {recordings.length > 0 && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">
                Recordings ({recordings.length})
              </span>
              {recordings.length > 1 && (
                <Button variant="ghost" size="sm" onClick={downloadAll}>
                  <Download className="w-3 h-3 mr-1" /> Download All
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {recordings.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-base/60 p-3">
                  <div className="shrink-0 rounded-lg bg-accent/10 p-2 text-accent">
                    <AudioLines className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Clock className="w-3 h-3" />
                      {formatTime(r.duration)}
                      <span className="opacity-50">•</span>
                      {formatSize(r.blob.size)}
                      <span className="opacity-50">•</span>
                      {r.format.toUpperCase()}
                    </div>
                    <audio
                      src={r.url}
                      controls
                      className="w-full mt-1 max-h-8"
                      aria-label={`Recording from ${new Date(r.timestamp).toLocaleTimeString()}`}
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => download(r)} aria-label={`Download recording ${formatTime(r.duration)}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400"
                      onClick={() => removeRecording(r.id)}
                      aria-label={`Delete recording ${formatTime(r.duration)}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Info badge */}
        <Badge className="border-0 bg-accent/15 text-accent">
          Uses MediaRecorder API • Browser audio capture
        </Badge>
      </div>
    </BaseToolLayout>
  )
}
