import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Volume2, Square, Play, Plus, Minus, Settings2 } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

const SAMPLE_TEXTS: Record<string, string> = {
  'Short Greeting': 'Hello! Welcome to DocFlow Pro. This is a demo of the text-to-speech feature. Feel free to type any text and click play to hear it spoken aloud.',
  'Long Paragraph': 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet at least once. It has been used for decades as a typing exercise and font showcase. Modern text-to-speech engines can render it with natural intonation and proper pacing, making it useful for testing pronunciation models.',
  'News Style': 'Breaking news: Scientists have discovered a new species of deep-sea fish that can withstand extreme pressure and complete darkness. The creature was found at a depth of over 7,000 meters in the Mariana Trench. Researchers say this discovery could change our understanding of life in extreme environments.',
}

export function TextToSpeechTool({ tool }: ToolProps) {
  const [text, setText] = useState(SAMPLE_TEXTS['Short Greeting'])
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceUri, setSelectedVoiceUri] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      setVoices(available)
      if (!selectedVoiceUri && available.length > 0) {
        setSelectedVoiceUri(available[0].voiceURI)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.onvoiceschanged = null
      window.speechSynthesis.cancel()
    }
  }, [selectedVoiceUri])

  const selectedVoice = useMemo(
    () => voices.find((v) => v.voiceURI === selectedVoiceUri) ?? null,
    [voices, selectedVoiceUri],
  )

  // Group voices by language
  const voicesByLang = useMemo(() => {
    const groups: Record<string, SpeechSynthesisVoice[]> = {}
    voices.forEach((v) => {
      const lang = v.lang.substring(0, 2).toUpperCase()
      if (!groups[lang]) groups[lang] = []
      groups[lang].push(v)
    })
    return groups
  }, [voices])

  const handleSpeak = useCallback(() => {
    if (!text.trim()) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    utterance.onstart = () => {
      setIsSpeaking(true)
      setIsPaused(false)
    }
    utterance.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }

    window.speechSynthesis.speak(utterance)
  }, [text, selectedVoice, rate, pitch, volume])

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause()
    setIsPaused(true)
  }, [])

  const handleResume = useCallback(() => {
    window.speechSynthesis.resume()
    setIsPaused(false)
  }, [])

  // Word and char count
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => handleSpeak()}
      options={
        <div className="space-y-4 text-sm">
          {/* Voice Selection */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Voice</div>
            <select
              value={selectedVoiceUri}
              onChange={(e) => setSelectedVoiceUri(e.target.value)}
              className="w-full rounded-lg border border-border bg-base/70 px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {Object.entries(voicesByLang).map(([lang, langVoices]) => (
                <optgroup key={lang} label={lang}>
                  {langVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} {v.localService ? '(local)' : '(remote)'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase text-muted">Speed</span>
              <span className="font-mono text-text">{rate.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRate((r) => Math.max(0.5, Math.round((r - 0.1) * 10) / 10))}
                className="h-6 w-6 flex items-center justify-center rounded border border-border bg-base/50 text-muted hover:text-text"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="flex-1 accent-accent"
              />
              <button
                onClick={() => setRate((r) => Math.min(2, Math.round((r + 0.1) * 10) / 10))}
                className="h-6 w-6 flex items-center justify-center rounded border border-border bg-base/50 text-muted hover:text-text"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Pitch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase text-muted">Pitch</span>
              <span className="font-mono text-text">{pitch}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase text-muted">Volume</span>
              <span className="font-mono text-text">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Samples */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Sample Texts</div>
            <div className="flex flex-col gap-1.5">
              {Object.keys(SAMPLE_TEXTS).map((label) => (
                <button
                  key={label}
                  onClick={() => setText(SAMPLE_TEXTS[label])}
                  className="text-left rounded-lg border border-border bg-base/50 px-3 py-1.5 text-xs text-muted hover:bg-panel hover:text-text transition"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Badge className="border-0 bg-accent/15 text-accent">Browser API • No API key needed</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Text input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-muted">Text to speak</label>
            <span className="text-xs text-muted">
              {wordCount} words • {charCount} chars
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text you want to hear spoken aloud..."
            rows={6}
            className="w-full rounded-xl border border-border bg-base/70 px-3 py-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        {/* Playback Controls */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className={`h-5 w-5 ${isSpeaking ? 'text-accent animate-pulse' : 'text-muted'}`} />
              <div>
                <div className="text-sm font-semibold text-text">
                  {isSpeaking
                    ? isPaused
                      ? 'Paused'
                      : 'Playing...'
                    : 'Ready'}
                </div>
                <div className="text-xs text-muted">
                  {selectedVoice
                    ? `${selectedVoice.name} • ${selectedVoice.lang.toUpperCase()}`
                    : voices.length > 0
                      ? 'Select a voice in options →'
                      : 'Waiting for voices...'}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!isSpeaking && !isPaused && (
                <Button onClick={handleSpeak} disabled={!text.trim()}>
                  <Play className="mr-2 h-4 w-4" />
                  Play
                </Button>
              )}
              {isSpeaking && !isPaused && (
                <>
                  <Button variant="secondary" onClick={handlePause}>
                    Pause
                  </Button>
                  <Button variant="outline" onClick={handleStop}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
              {isPaused && (
                <>
                  <Button onClick={handleResume}>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                  <Button variant="outline" onClick={handleStop}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quick settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-xs text-muted hover:text-text transition"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showSettings ? 'Hide' : 'Show'} current settings
          </button>
          {showSettings && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border bg-base/50 px-2 py-1.5">
                <div className="text-muted">Speed</div>
                <div className="font-mono text-text">{rate.toFixed(1)}x</div>
              </div>
              <div className="rounded-lg border border-border bg-base/50 px-2 py-1.5">
                <div className="text-muted">Pitch</div>
                <div className="font-mono text-text">{pitch}</div>
              </div>
              <div className="rounded-lg border border-border bg-base/50 px-2 py-1.5">
                <div className="text-muted">Volume</div>
                <div className="font-mono text-text">{Math.round(volume * 100)}%</div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </BaseToolLayout>
  )
}
