import { useState, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ArrowLeftRight, Download, FileAudio, Music, AlertCircle, Loader2 } from 'lucide-react'

/** Encode an AudioBuffer to WAV format */
function encodeWav(buffer: AudioBuffer, bitDepth: number): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = length * blockAlign
  const headerSize = 44
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, dataSize + 36, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true) // audio format (1=PCM, 3=IEEE float)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write interleaved samples
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i]
      const clamped = Math.max(-1, Math.min(1, sample))
      if (bitDepth === 8) {
        view.setUint8(offset, ((clamped + 1) / 2) * 255)
      } else if (bitDepth === 16) {
        view.setInt16(offset, clamped * 0x7fff, true)
      } else {
        view.setFloat32(offset, clamped, true)
      }
      offset += bytesPerSample
    }
  }

  return arrayBuffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

export default function AudioConverterTool({ tool }: { tool: ToolDefinition }) {
  const [file, setFile] = useState<File | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [format, setFormat] = useState<'wav' | 'webm'>('wav')
  const [sampleRate, setSampleRate] = useState(44100)
  const [channels, setChannels] = useState<'mono' | 'stereo'>('stereo')
  const [bitDepth, setBitDepth] = useState(16)
  const [processing, setProcessing] = useState(false)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [outputSize, setOutputSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setOutputUrl(null)
    setOutputSize(null)
    try {
      const arrayBuffer = await f.arrayBuffer()
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(arrayBuffer)
      setAudioBuffer(buf)
      ctx.close()
    } catch {
      setError('Cannot decode this audio file.')
      setAudioBuffer(null)
    }
  }, [])

  const convert = useCallback(async () => {
    if (!audioBuffer) return
    setProcessing(true)
    setError(null)

    try {
      // Resample + channel conversion using OfflineAudioContext
      const newChannels = channels === 'mono' ? 1 : 2
      const offlineCtx = new OfflineAudioContext(newChannels, audioBuffer.sampleRate * audioBuffer.duration, sampleRate)

      const source = offlineCtx.createBufferSource()
      let bufferToUse = audioBuffer

      // If channel change needed, manually create new buffer
      if (audioBuffer.numberOfChannels !== newChannels) {
        const newBuffer = new AudioContext().createBuffer(newChannels, audioBuffer.length, audioBuffer.sampleRate)
        for (let ch = 0; ch < newChannels; ch++) {
          const srcData = audioBuffer.getChannelData(ch % audioBuffer.numberOfChannels)
          newBuffer.copyToChannel(srcData, ch)
        }
        bufferToUse = newBuffer
      }

      source.buffer = bufferToUse
      source.connect(offlineCtx.destination)
      source.start()

      const resampled = await offlineCtx.startRendering()

      let output: ArrayBuffer

      if (format === 'wav') {
        output = encodeWav(resampled, bitDepth)
      } else {
        // WebM: use MediaRecorder with canvas-based audio source
        // Since we can't easily do MediaRecorder for audio-only, fall back to WAV internally
        const wavData = encodeWav(resampled, 16)
        const wavBlob = new Blob([wavData], { type: 'audio/wav' })
        output = wavData
        
        // Attempt MediaRecorder for WebM
        try {
          const audioCtx = new AudioContext()
          const webmBuffer = await audioCtx.decodeAudioData(wavData.slice(0))
          const dest = audioCtx.createMediaStreamDestination()
          const src = audioCtx.createBufferSource()
          src.buffer = webmBuffer
          src.connect(dest)
          
          const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' })
          const chunks: Blob[] = []
          recorder.ondataavailable = (e) => chunks.push(e.data)
          
          const done = new Promise<void>((resolve) => {
            recorder.onstop = () => resolve()
          })
          
          recorder.start()
          src.start()
          src.onended = () => {
            setTimeout(() => recorder.stop(), 100)
          }
          
          await done
          audioCtx.close()
          
          const webmBlob = new Blob(chunks, { type: 'audio/webm' })
          output = await webmBlob.arrayBuffer()
        } catch {
          // Fall back to WAV if MediaRecorder fails
          output = wavData
        }
      }

      const blob = new Blob([output], { type: format === 'wav' ? 'audio/wav' : 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setOutputUrl(url)
      setOutputSize(blob.size)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed'
      setError(msg)
    }

    setProcessing(false)
  }, [audioBuffer, format, sampleRate, channels, bitDepth])

  const download = () => {
    if (!outputUrl) return
    const a = document.createElement('a')
    const ext = format === 'wav' ? 'wav' : 'webm'
    a.href = outputUrl
    a.download = (file?.name?.replace(/\.[^.]+$/, '') || 'audio') + '-converted.' + ext
    a.click()
  }

  const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / (1024 * 1024)).toFixed(2) + ' MB')

  const estimatedSize = audioBuffer ? (() => {
    const duration = audioBuffer.duration
    const newChannels = channels === 'mono' ? 1 : 2
    if (format === 'wav') {
      return 44 + duration * sampleRate * newChannels * (bitDepth / 8)
    }
    return duration * sampleRate * newChannels * 0.5 // rough WebM estimate
  })() : null

  return (
    <BaseToolLayout
      title="Audio Converter"
      description="Convert audio formats, resample, and change channel configuration."
      accept="audio/*"
      instructions="Drop an audio file or click to browse."
      maxFiles={1}
    >
      <div className="space-y-4">
        <label className="block w-full px-3 py-2 rounded-lg border border-border bg-input/50 text-sm cursor-pointer hover:border-accent/50 text-center">
          <FileAudio className="w-5 h-5 inline mr-1 text-muted" />
          Select Audio File
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
        </label>

        {audioBuffer && (
            <Badge>{formatSize(audioBuffer.duration * audioBuffer.sampleRate * audioBuffer.numberOfChannels * 4 + 44)} input • {audioBuffer.duration.toFixed(1)}s • {audioBuffer.sampleRate}Hz • {audioBuffer.numberOfChannels}ch</Badge>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
            <p className="text-xs text-muted mb-2">Output Format</p>
            <div className="flex gap-2">
              <button className={`flex-1 px-3 py-1.5 rounded text-sm ${format === 'wav' ? 'bg-accent/20 text-accent ring-1 ring-accent' : 'bg-base/40 text-muted'}`} onClick={() => setFormat('wav')}>WAV</button>
              <button className={`flex-1 px-3 py-1.5 rounded text-sm ${format === 'webm' ? 'bg-accent/20 text-accent ring-1 ring-accent' : 'bg-base/40 text-muted'}`} onClick={() => setFormat('webm')}>WebM</button>
            </div>
          </Card>

          <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
            <p className="text-xs text-muted mb-2">Sample Rate</p>
            <select className="w-full px-2 py-1.5 rounded bg-input/50 border border-border text-sm text-text" value={sampleRate} onChange={(e) => setSampleRate(parseInt(e.target.value))}>
              {[8000, 16000, 22050, 44100, 48000, 96000].map(sr => <option key={sr} value={sr}>{sr.toLocaleString()} Hz</option>)}
            </select>
          </Card>

          <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
            <p className="text-xs text-muted mb-2">Channels</p>
            <select className="w-full px-2 py-1.5 rounded bg-input/50 border border-border text-sm text-text" value={channels} onChange={(e) => setChannels(e.target.value as 'mono' | 'stereo')}>
              <option value="mono">Mono (1ch)</option>
              <option value="stereo">Stereo (2ch)</option>
            </select>
          </Card>

          {format === 'wav' && (
            <Card className="rounded-xl border border-border/60 bg-base/50 px-3 py-2">
              <p className="text-xs text-muted mb-2">Bit Depth</p>
              <select className="w-full px-2 py-1.5 rounded bg-input/50 border border-border text-sm text-text" value={bitDepth} onChange={(e) => setBitDepth(parseInt(e.target.value))}>
                <option value={8}>8-bit</option>
                <option value={16}>16-bit</option>
                <option value={32}>32-bit (float)</option>
              </select>
            </Card>
          )}
        </div>

        {estimatedSize && (
          <p className="text-xs text-muted">Estimated output size: {formatSize(estimatedSize)}</p>
        )}

        <Button size="sm" onClick={convert} disabled={!audioBuffer || processing}>
          {processing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Converting...</> : <><ArrowLeftRight className="w-4 h-4 mr-1" /> Convert</>}
        </Button>

        {error && (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 inline mr-1" /> {error}
          </Card>
        )}

        {outputUrl && outputSize !== null && (
          <div className="space-y-2">
            <Badge className="bg-emerald-100 text-emerald-700">Converted: {formatSize(outputSize)}</Badge>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="w-4 h-4 mr-1" /> Download
            </Button>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
