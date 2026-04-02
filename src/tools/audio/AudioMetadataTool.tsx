import { useState, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { AudioLines, Copy, Download, FileAudio, AlertCircle, Music } from 'lucide-react'

type AudioInfo = {
  fileName: string
  fileSize: number
  fileType: string
  lastModified: string
  duration: number
  sampleRate: number
  channels: number
  peakAmplitude: number
  rmsLevel: number
  bitDepthEstimate: string
  bitrateEstimate: string
  channelLabels: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = (seconds % 60).toFixed(2)
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${secs.padStart(5, '0')}`
  return `${mins}:${secs.padStart(5, '0')}`
}

export default function AudioMetadataTool({ tool }: { tool: ToolDefinition }) {
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const analyzeAudio = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setAudioInfo(null)
    setWaveformData([])

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioContext = new AudioContext()

      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      } catch {
        setError('Could not decode audio data. The file may not be a supported audio format.')
        setLoading(false)
        return
      }

      const channelData = audioBuffer.getChannelData(0)
      const numChannels = audioBuffer.numberOfChannels

      // Calculate peak and RMS
      let peak = 0
      let rmsSum = 0
      const sampleLength = channelData.length

      for (let i = 0; i < sampleLength; i++) {
        const val = Math.abs(channelData[i])
        if (val > peak) peak = val
        rmsSum += channelData[i] * channelData[i]
      }

      const rms = Math.sqrt(rmsSum / sampleLength)

      // Estimate bit depth based on sample values
      // This is heuristic — check for quantization patterns
      let bitDepthEstimate = 'Unknown'
      const uniqueValues = new Set<number>()
      const step = Math.max(1, Math.floor(sampleLength / 10000))
      for (let i = 0; i < sampleLength; i += step) {
        uniqueValues.add(Math.round(channelData[i] * 32767))
      }
      if (uniqueValues.size <= 256) bitDepthEstimate = '~8-bit'
      else if (uniqueValues.size <= 65536) bitDepthEstimate = '~16-bit'
      else bitDepthEstimate = '~24/32-bit'

      // Bitrate estimate
      const totalBits = audioBuffer.duration * audioBuffer.sampleRate * audioBuffer.numberOfChannels * 16
      const bitrateKbps = (totalBits / audioBuffer.duration / 1000).toFixed(0)

      const info: AudioInfo = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'Unknown',
        lastModified: new Date(file.lastModified).toLocaleString(),
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: numChannels,
        peakAmplitude: peak,
        rmsLevel: rms,
        bitDepthEstimate,
        bitrateEstimate: bitrateKbps + ' kbps',
        channelLabels: numChannels === 1 ? 'Mono' : numChannels === 2 ? 'Stereo' : `${numChannels} channels`,
      }

      setAudioInfo(info)

      // Downsample waveform data for visualization
      const samples = 200
      const waveform: number[] = []
      const step2 = Math.floor(sampleLength / samples)
      for (let i = 0; i < samples; i++) {
        waveform.push(channelData[i * step2])
      }
      setWaveformData(waveform)

      audioContext.close()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze audio'
      setError(message)
    }

    setLoading(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) analyzeAudio(file)
  }, [analyzeAudio])

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'
    ctx.fillRect(0, 0, width, height)

    const midY = height / 2
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * width
      const y = midY - waveformData[i] * (midY - 4)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw center line
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(width, midY)
    ctx.stroke()
  }, [waveformData])

  // Draw waveform when data changes
  useState(() => {
    if (waveformData.length > 0) {
      requestAnimationFrame(drawWaveform)
    }
  })

  const copyMetadata = () => {
    if (!audioInfo) return
    const text = JSON.stringify(audioInfo, null, 2)
    navigator.clipboard.writeText(text)
  }

  const downloadMetadata = () => {
    if (!audioInfo) return
    const text = JSON.stringify(audioInfo, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = audioInfo.fileName.replace(/\.[^.]+$/, '') + '-metadata.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <BaseToolLayout
      title="Audio Metadata"
      description="Inspect audio file properties: duration, sample rate, channels, bitrate, and visualize the waveform."
      accept="audio/*"
      instructions="Drop an audio file or click to browse."
      maxFiles={1}
      onProcess={async (files) => {
        if (files.length > 0) await analyzeAudio(files[0].file)
      }}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Or upload below:</p>
        <label className="block w-full px-3 py-2 rounded-lg border border-border bg-input/50 text-sm cursor-pointer hover:border-accent/50 text-center">
          <FileAudio className="w-5 h-5 inline mr-1 text-muted" />
          Select Audio File
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
        </label>

        {loading && (
          <Card className="rounded-xl border border-border/60 px-4 py-3 text-sm text-muted animate-pulse">
            Analyzing audio file...
          </Card>
        )}

        {error && (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 inline mr-1" /> {error}
          </Card>
        )}

        {audioInfo && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyMetadata}>
                <Copy className="w-4 h-4 mr-1" /> Copy JSON
              </Button>
              <Button size="sm" variant="outline" onClick={downloadMetadata}>
                <Download className="w-4 h-4 mr-1" /> Download JSON
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
                <p className="text-xs text-muted mb-1">File</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Name</span><span className="text-text">{audioInfo.fileName}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Size</span><span className="text-text">{formatFileSize(audioInfo.fileSize)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Type</span><span className="text-text">{audioInfo.fileType}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Modified</span><span className="text-text">{audioInfo.lastModified}</span></div>
                </div>
              </Card>

              <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
                <p className="text-xs text-muted mb-1">Audio Properties</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Duration</span><span className="text-text font-mono">{formatDuration(audioInfo.duration)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Sample Rate</span><span className="text-text font-mono">{audioInfo.sampleRate.toLocaleString()} Hz</span></div>
                  <div className="flex justify-between"><span className="text-muted">Channels</span><span className="text-text">{audioInfo.channelLabels}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Bitrate (est.)</span><span className="text-text font-mono">{audioInfo.bitrateEstimate}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Bit Depth (est.)</span><span className="text-text">{audioInfo.bitDepthEstimate}</span></div>
                </div>
              </Card>

              <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
                <p className="text-xs text-muted mb-1">Analysis</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Peak Amplitude</span><span className="text-text font-mono">{audioInfo.peakAmplitude.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">RMS Level</span><span className="text-text font-mono">{audioInfo.rmsLevel.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Dynamic Range</span><span className="text-text">{(20 * Math.log10(audioInfo.peakAmplitude / (audioInfo.rmsLevel || 1e-10))).toFixed(1)} dB</span></div>
                </div>
              </Card>

              <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2 flex flex-col items-center justify-center">
                <p className="text-xs text-muted mb-2">Waveform Preview</p>
                <canvas ref={canvasRef} width={300} height={80} className="rounded border border-border w-full" />
              </Card>
            </div>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
