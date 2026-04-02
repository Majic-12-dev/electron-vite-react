// src/tools/audio/AudioRecorderTool.tsx
import { useState, useRef, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Mic, StopCircle, Download } from 'lucide-react'

export default function AudioRecorderTool({ tool }: { tool: ToolDefinition }) {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.current = new MediaRecorder(stream)
    audioChunks.current = []
    
    mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data)
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
      setAudioUrl(URL.createObjectURL(blob))
    }
    
    mediaRecorder.current.start()
    setRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop()
    mediaRecorder.current?.stream.getTracks().forEach(t => t.stop())
    setRecording(false)
  }, [])

  return (
    <BaseToolLayout
      title="Audio Recorder"
      description="Capture audio directly from your microphone."
      instructions="Click start to begin recording."
    >
      <div className="flex gap-2">
        {!recording ? (
          <Button onClick={startRecording}><Mic className="mr-2 h-4 w-4" /> Start</Button>
        ) : (
          <Button variant="secondary" onClick={stopRecording}><StopCircle className="mr-2 h-4 w-4" /> Stop</Button>
        )}
      </div>
      {audioUrl && (
        <div className="mt-4">
          <audio src={audioUrl} controls className="w-full" />
          <a href={audioUrl} download="recording.webm" className="mt-2 inline-block">
            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Download</Button>
          </a>
        </div>
      )}
    </BaseToolLayout>
  )
}
