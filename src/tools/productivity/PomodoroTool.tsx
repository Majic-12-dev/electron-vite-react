import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Play, Pause, RotateCcw, SkipForward, Coffee } from 'lucide-react'

type PomodoroToolProps = {
  tool: ToolDefinition
}

type TimerState = 'idle' | 'work' | 'shortBreak' | 'longBreak'

export function PomodoroTool({ tool }: PomodoroToolProps) {
  const [workMinutes, setWorkMinutes] = useState(25)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5)
  const [longBreakMinutes, setLongBreakMinutes] = useState(15)
  const [sessionsBeforeLong, setSessionsBeforeLong] = useState(4)
  
  const [state, setState] = useState<TimerState>('idle')
  const [remaining, setRemaining] = useState(0)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  // Play a short beep
  const playBeep = useCallback(() => {
    try {
      const ctx = audioRef.current ?? new AudioContext()
      audioRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      gain.gain.value = 0.3
      osc.start()
      setTimeout(() => { osc.stop(); osc.disconnect() }, 300)
    } catch {
      // audio unavailable
    }
  }, [])

  const totalSeconds = useCallback((s: TimerState) => {
    return ((s === 'work' ? workMinutes : s === 'shortBreak' ? shortBreakMinutes : longBreakMinutes) * 60)
  }, [workMinutes, shortBreakMinutes, longBreakMinutes])

  const startTimer = useCallback((s: TimerState) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const secs = totalSeconds(s)
    setRemaining(secs)
    setState(s)
    setIsRunning(true)
  }, [totalSeconds])

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          playBeep()
          if (state === 'work') {
            const next = completedSessions + 1
            setCompletedSessions(next)
            if (next % sessionsBeforeLong === 0) {
              setTimeout(() => startTimer('longBreak'), 500)
            } else {
              setTimeout(() => startTimer('shortBreak'), 500)
            }
          } else {
            setTimeout(() => startTimer('work'), 500)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, state, playBeep, completedSessions, sessionsBeforeLong, startTimer])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const progress = totalSeconds(state) > 0 ? ((totalSeconds(state) - remaining) / totalSeconds(state)) * 100 : 0

  const stateLabels: Record<TimerState, string> = {
    idle: 'Ready',
    work: 'Work',
    shortBreak: 'Short Break',
    longBreak: 'Long Break',
  }

  const stateColors: Record<TimerState, string> = {
    idle: 'text-muted',
    work: 'text-red-300',
    shortBreak: 'text-emerald-300',
    longBreak: 'text-blue-300',
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Durations</div>
            {[
              { label: 'Work (min)', value: workMinutes, setter: setWorkMinutes, disabled: isRunning },
              { label: 'Short Break (min)', value: shortBreakMinutes, setter: setShortBreakMinutes, disabled: isRunning },
              { label: 'Long Break (min)', value: longBreakMinutes, setter: setLongBreakMinutes, disabled: isRunning },
            ].map(({ label, value, setter, disabled }) => (
              <div key={label} className='flex items-center justify-between gap-2'>
                <span className='text-xs text-muted'>{label}</span>
                <div className='flex items-center gap-1'>
                  <button type='button' disabled={disabled} onClick={() => setter(Math.max(1, value - 1))} className='w-6 h-6 rounded border border-border text-xs text-text hover:bg-panel disabled:opacity-40'>-</button>
                  <input type='number' min={1} max={90} value={value} onChange={(e) => setter(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))} disabled={disabled} className='w-12 h-8 rounded-lg border border-border bg-base/70 px-2 text-center text-sm font-mono text-text disabled:opacity-40' />
                  <button type='button' disabled={disabled} onClick={() => setter(Math.min(90, value + 1))} className='w-6 h-6 rounded border border-border text-xs text-text hover:bg-panel disabled:opacity-40'>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Long break every</div>
            <select
              value={sessionsBeforeLong}
              onChange={(e) => setSessionsBeforeLong(parseInt(e.target.value))}
              disabled={isRunning}
              className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-sm text-text disabled:opacity-40'
            >
              {[2, 3, 4, 5].map(n => <option key={n} value={n}>Every {n} sessions</option>)}
            </select>
          </div>
          {completedSessions > 0 && (
            <div className='rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-xs text-accent'>
              {completedSessions} session(s) completed
            </div>
          )}
          <Badge className='border-0 bg-accent/15 text-accent'>Client-side only</Badge>
        </div>
      }
    >
      <div className='flex flex-col items-center gap-6 py-8'>
        <div className='text-center'>
          <div className={`text-xs font-semibold uppercase tracking-wider ${stateColors[state]}`}>
            {stateLabels[state]}
          </div>
          <div className={`text-6xl font-mono font-bold tracking-tight text-text mt-2`}>
            {formatTime(remaining)}
          </div>
        </div>

        {/* Progress bar */}
        <div className='w-full max-w-xs'>
          <div className='h-2 w-full rounded-full bg-base/60 overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-1000 ${state === 'work' ? 'bg-red-400' : 'bg-emerald-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className='flex gap-3'>
          {state === 'idle' ? (
            <Button onClick={() => startTimer('work')} className='px-8'>
              <Play className='mr-2 h-4 w-4' />
              Start
            </Button>
          ) : (
            <>
              <Button onClick={() => { setIsRunning(!isRunning) }} className='px-6'>
                {isRunning ? <Pause className='mr-2 h-4 w-4' /> : <Play className='mr-2 h-4 w-4' />}
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
              <Button variant='ghost' onClick={() => startTimer(state)}>
                <RotateCcw className='h-4 w-4' />
              </Button>
              <Button variant='ghost' onClick={() => { setState('idle'); setRemaining(0); setIsRunning(false) }}>
                <SkipForward className='h-4 w-4' />
              </Button>
            </>
          )}
        </div>

        {/* Session indicators */}
        {completedSessions > 0 && (
          <Card className='w-full max-w-xs'>
            <div className='flex items-center gap-4'>
              <Coffee className='h-4 w-4 text-accent' />
              <div className='flex gap-1.5'>
                {Array.from({ length: Math.min(sessionsBeforeLong, 12) }, (_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${i < (completedSessions % sessionsBeforeLong || sessionsBeforeLong) ? 'bg-accent' : 'bg-base/60'}`}
                  />
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
