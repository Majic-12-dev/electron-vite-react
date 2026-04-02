import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Slider } from '@/components/ui/Slider'
import { Trim, Download, Info, AlertCircle, AudioLines, Play, Pause } from 'lucide-react'

type AudioTrimmerToolProps = {
  tool: ToolDefinition
}

export function AudioTrimmerTool({ tool }: AudioTrimmerToolProps) {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [outputSize, setOutputSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [previewMode, setPreviewMode] = useState<'full' | 'trim'>('trim')

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef(0)

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close()
      if (originalUrl) URL.revokeObjectURL(originalUrl)
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  }, [])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = (seconds % 60).toFixed(2)
    return `${m}:${s.padStart(5, '0')}`
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const loadFile = useCallback(async (file: File): Promise<AudioBuffer> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    const arrayBuffer = await file.arrayBuffer()
    return audioContextRef.current.decodeAudioData(arrayBuffer)
  }, [])

  const handleProcess = useCallback(async (files: ToolFile[], ctx: {
    setProgress: (v: number) => void
    setResult: (n: React.ReactNode) => void
    setError: (m: string | null) => void
  }) => {
    if (files.length === 0) throw new Error('No audio file provided.')
    if (files.length > 1) throw new Error('Only one audio file at a time.')

    setProcessing(true)
    setError(null)
    setOutputUrl(null)
    setOutputSize(null)

    try {
      const file = files[0].file
      setFileName(file.name)
      ctx.setProgress(15)

      const buffer = await loadFile(file)
      setAudioBuffer(buffer)
      setStartTime(0)
      setEndTime(buffer.duration)

      // Create a preview URL
      const blob = new Blob([file], { type: file.type })
      const url = URL.createObjectURL(blob)
      setOriginalUrl(url)
      ctx.setProgress(30)

      // Auto-trim: keep the first 30 seconds or full duration if shorter
      ctx.setProgress(90)
      ctx.setResult(<Badge className="border-0 bg-accent/15 text-accent">
        Audio loaded • {formatTime(buffer.duration)} • {buffer.numberOfChannels}ch • {buffer.sampleRate}Hz
      </Badge>)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cannot decode this audio file.'
      setError(msg)
      ctx.setError(msg)
    } finally {
      setProcessing(false)
    }
  }, [loadFile])

  const playPreview = useCallback(() => {
    if (!audioBuffer || !audioContextRef.current) return

    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current.disconnect()
    }

    if (playing) {
      setPlaying(false)
      return
    }

    const source = audioContextRef.current.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContextRef.current.destination)

    if (previewMode === 'trim') {
      source.start(0, startTime, endTime - startTime)
    } else {
      source.start(0, startTime)
    }

    startTimeRef.current = audioContextRef.current.currentTime
    sourceRef.current = source
    setPlaying(true)

    source.onended = () => setPlaying(false)
  }, [audioBuffer, startTime, endTime, previewMode, playing])

  const trim = useCallback(async () => {
    if (!audioBuffer) {
      setError('No audio loaded.')
      return
    }
    if (endTime <= startTime) {
      setError('End time must be greater than start time.')
      return
    }

    setProcessing(true)
    setError(null)
    try {
      const sampleRate = audioBuffer.sampleRate
      const channels = audioBuffer.numberOfChannels
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)
      const frameCount = endSample - startSample

      const offlineCtx = new OfflineAudioContext(channels, frameCount, sampleRate)
      const source = offlineCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineCtx.destination)
      source.start(0, startTime, endTime - startTime)

      const trimmed = await offlineCtx.startRendering()

      // Encode to WAV
      const wavBlob = encodeWav(trimmed)
      const url = URL.createObjectURL(wavBlob)
      setOutputUrl(url)
      setOutputSize(wavBlob.size)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Trimming failed.')
    } finally {
      setProcessing(false)
    }
  }, [audioBuffer, startTime, endTime])

  /** Encode AudioBuffer to WAV */
  function encodeWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const length = buffer.length
    const bitDepth = 16
    const bytesPerSample = bitDepth / 8
    const blockAlign = numChannels * bytesPerSample
    const dataSize = length * blockAlign
    const arrayBuffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(arrayBuffer)

    // RIFF header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }
    writeString(0, 'RIFF')
    view.setUint32(4, dataSize + 36, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    writeString(36, 'data')
    view.setUint32(40, dataSize, true)

    // Write samples
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
        view.setInt16(offset, sample * 0x7fff, true)
        offset += bytesPerSample
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  const handleDownload = useCallback(() => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    const baseName = fileName.replace(/\.[^.]+$/, '')
    a.download = `${baseName}-trimmed.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [outputUrl, fileName])

  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), endTime - 0.1)
    setStartTime(val)
    setPreviewMode('trim')
  }, [endTime])

  const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), startTime + 0.1)
    setEndTime(val)
    setPreviewMode('trim')
  }, [startTime])

  const trimDuration = endTime - startTime

  // Visual waveform representation (simplified)
  const waveformWidth = 300
  const startPercent = audioBuffer ? (startTime / audioBuffer.duration) * 100 : 0
  const endPercent = audioBuffer ? (endTime / audioBuffer.duration) * 100 : 100

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="audio/*"
      instructions="Drop an audio file or click to browse. Set start/end times to trim."
      maxFiles={1}
      onProcess={handleProcess}
      options={
        audioBuffer ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted">File Info</div>
              <div className="text-xs text-muted p-2 rounded bg-base/50">
                <div>{fileName}</div>
                <div>Duration: {formatTime(audioBuffer.duration)}</div>
                <div>Sample Rate: {audioBuffer.sampleRate}Hz • Channels: {audioBuffer.numberOfChannels}</div>
              </div>
            </div>

            {/* Visual timeline */}
            <div className="relative h-6 rounded bg-base/50 overflow-hidden" role="slider" aria-label="Trim range selector" aria-valuemin={0} aria-valuemax={audioBuffer.duration} aria-valuenow={trimDuration}>
              <div
                className="absolute top-0 bottom-0 bg-accent/20 transition-all"
                style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-muted">
                {formatTime(startTime)} — {formatTime(endTime)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted" htmlFor="start-time">Start Time</label>
                <div className="flex items-center gap-2">
                  <input
                    id="start-time"
                    type="number"
                    className="w-full h-8 rounded border border-border bg-base/70 px-2 text-xs text-text"
                    min={0}
                    max={audioBuffer.duration}
                    step={0.1}
                    value={startTime}
                    onChange={handleStartTimeChange}
                    aria-label="Start trim time (seconds)"
                  />
                  <span className="text-xs text-muted shrink-0">{formatTime(startTime)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted" htmlFor="end-time">End Time</label>
                <div className="flex items-center gap-2">
                  <input
                    id="end-time"
                    type="number"
                    className="w-full h-8 rounded border border-border bg-base/70 px-2 text-xs text-text"
                    min={0}
                    max={audioBuffer.duration}
                    step={0.1}
                    value={endTime}
                    onChange={handleEndTimeChange}
                    aria-label="End trim time (seconds)"
                  />
                  <span className="text-xs text-muted shrink-0">{formatTime(endTime)}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted flex items-center gap-1">
              <AudioLines className="w-3 h-3" />
              Trimmed: {formatTime(trimDuration)} ({((trimDuration / audioBuffer.duration) * 100).toFixed(0)}% of original)
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={playPreview}>
                {playing ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                {playing ? 'Stop' : 'Preview'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStartTime(0); setEndTime(audioBuffer.duration) }}
              >
                Reset
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted text-center py-8">
            {error ? '' : 'Load an audio file to trim.'}
          </div>
        )
      }
      result={outputUrl ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge className="border-0 bg-emerald-100 text-emerald-700">Trimmed: {outputSize ? formatSize(outputSize) : ''}</Badge>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Download WAV
            </Button>
          </div>
          {outputUrl && (
            <audio src={outputUrl} controls className="w-full" aria-label="Trimmed audio preview" />
          )}
        </Card>
      ) : error ? (
        <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
          <AlertCircle className="inline-block w-4 h-4 mr-1" /> {error}
        </Card>
      ) : originalUrl ? (
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Info className="w-3 h-3" />
            Original audio:
          </div>
          <audio src={originalUrl} controls className="w-full" aria-label="Original audio preview" />
        </Card>
      ) : null}
    />
  )
}
