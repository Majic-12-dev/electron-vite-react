import { useCallback, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Slider } from '@/components/ui/Slider'
import {
  Network, Search, Play, Square, AlertCircle, ExternalLink, CheckCircle2,
  XCircle, Clock, Filter, List, Grid
} from 'lucide-react'

type PortScannerToolProps = {
  tool: ToolDefinition
}

type PortResult = {
  port: number
  service: string
  status: 'open' | 'closed' | 'filtered' | 'error'
  responseTime?: number
  protocol: string
}

const COMMON_PORTS: { port: number; service: string; protocol: string }[] = [
  { port: 20, service: 'FTP Data', protocol: 'TCP' },
  { port: 21, service: 'FTP Control', protocol: 'TCP' },
  { port: 22, service: 'SSH', protocol: 'TCP' },
  { port: 23, service: 'Telnet', protocol: 'TCP' },
  { port: 25, service: 'SMTP', protocol: 'TCP' },
  { port: 53, service: 'DNS', protocol: 'TCP/UDP' },
  { port: 80, service: 'HTTP', protocol: 'TCP' },
  { port: 110, service: 'POP3', protocol: 'TCP' },
  { port: 143, service: 'IMAP', protocol: 'TCP' },
  { port: 443, service: 'HTTPS', protocol: 'TCP' },
  { port: 445, service: 'SMB', protocol: 'TCP' },
  { port: 993, service: 'IMAPS', protocol: 'TCP' },
  { port: 995, service: 'POP3S', protocol: 'TCP' },
  { port: 1433, service: 'MSSQL', protocol: 'TCP' },
  { port: 2049, service: 'NFS', protocol: 'TCP' },
  { port: 3306, service: 'MySQL', protocol: 'TCP' },
  { port: 3389, service: 'RDP', protocol: 'TCP' },
  { port: 5432, service: 'PostgreSQL', protocol: 'TCP' },
  { port: 5900, service: 'VNC', protocol: 'TCP' },
  { port: 6379, service: 'Redis', protocol: 'TCP' },
  { port: 8080, service: 'HTTP-Proxy', protocol: 'TCP' },
  { port: 8443, service: 'HTTPS-Alt', protocol: 'TCP' },
  { port: 9090, service: 'Web Console', protocol: 'TCP' },
  { port: 27017, service: 'MongoDB', protocol: 'TCP' },
]

const PORT_RANGES: { label: string; ports: number[] }[] = [
  { label: 'Well-known (1-1024)', ports: Array.from({ length: 1024 }, (_, i) => i + 1) },
  { label: 'Common Services', ports: COMMON_PORTS.map(p => p.port) },
  { label: 'Custom', ports: [] },
]

export function PortScannerTool({ tool }: PortScannerToolProps) {
  const [target, setTarget] = useState('localhost')
  const [scanMode, setScanMode] = useState<'quick' | 'common' | 'full'>('common')
  const [concurrency, setConcurrency] = useState(10)
  const [timeoutMs, setTimeoutMs] = useState(3000)
  const [results, setResults] = useState<PortResult[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const abortRef = useRef(false)

  const getServiceName = useCallback((port: number): { service: string; protocol: string } => {
    if (port === 80) return { service: 'HTTP', protocol: 'TCP' }
    if (port === 443) return { service: 'HTTPS', protocol: 'TCP' }
    if (port === 21) return { service: 'FTP', protocol: 'TCP' }
    if (port === 22) return { service: 'SSH', protocol: 'TCP' }
    if (port === 3306) return { service: 'MySQL', protocol: 'TCP' }
    if (port === 5432) return { service: 'PostgreSQL', protocol: 'TCP' }
    if (port === 8080) return { service: 'HTTP-Alt', protocol: 'TCP' }
    return { service: `Port ${port}`, protocol: 'TCP' }
  }, [])

  const checkPort = useCallback(async (target: string, port: number, timeoutMs: number): Promise<PortResult> => {
    const start = performance.now()
    try {
      // Try HTTP/HTTPS as a connection probe
      throw new Error('Cannot check ports directly in browser')
    } catch {
      // Use WebSocket as a connection attempt for common web ports
      if ([80, 443, 8080, 8443, 3000, 8000, 9090, 5000].includes(port)) {
        return new Promise((resolve) => {
          const protocol = [443, 8443].includes(port) ? 'wss' : 'ws'
          const ws = new WebSocket(`${protocol}://${target}:${port}`)
          const timer = window.setTimeout(() => {
            ws.close()
            resolve({
              port,
              service: getServiceName(port).service,
              status: 'filtered',
              responseTime: timeoutMs,
              protocol: getServiceName(port).protocol,
            })
          }, timeoutMs)

          ws.onopen = () => {
            clearTimeout(timer)
            ws.close()
            resolve({
              port,
              service: getServiceName(port).service,
              status: 'open',
              responseTime: Math.round(performance.now() - start),
              protocol: getServiceName(port).protocol,
            })
          }

          ws.onerror = () => {
            clearTimeout(timer)
            resolve({
              port,
              service: getServiceName(port).service,
              status: 'closed',
              responseTime: Math.round(performance.now() - start),
              protocol: getServiceName(port).protocol,
            })
          }
        })
      }

      // For non-web ports, try fetch with CORS
      return new Promise((resolve) => {
        fetch(`http://${target}:${port}`, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        }).then(() => {
          resolve({
            port,
            service: getServiceName(port).service,
            status: 'open',
            responseTime: Math.round(performance.now() - start),
            protocol: getServiceName(port).protocol,
          })
        }).catch(() => {
          // Try HTTPS too
          fetch(`https://${target}:${port}`, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
            signal: AbortSignal.timeout(timeoutMs),
          }).then(() => {
            resolve({
              port,
              service: getServiceName(port).service,
              status: 'open',
              responseTime: Math.round(performance.now() - start),
              protocol: getServiceName(port).protocol,
            })
          }).catch(() => {
            resolve({
              port,
              service: getServiceName(port).service,
              status: 'closed',
              responseTime: Math.round(performance.now() - start),
              protocol: getServiceName(port).protocol,
            })
          })
        })
      })
    }
  }, [getServiceName])

  const startScan = useCallback(async () => {
    if (!target.trim()) {
      setError('Please enter a target host.')
      return
    }

    abortRef.current = false
    setScanning(true)
    setError(null)
    setResults([])

    let ports: number[]
    if (scanMode === 'quick') {
      ports = [80, 443]
    } else if (scanMode === 'common') {
      ports = [...new Set(COMMON_PORTS.map(p => p.port))]
    } else {
      ports = Array.from({ length: 1023 }, (_, i) => i + 1)
    }

    let completed = 0
    const scanResults: PortResult[] = []

    try {
      // Batch scanning with concurrency
      for (let i = 0; i < ports.length; i += concurrency) {
        if (abortRef.current) break

        const batch = ports.slice(i, i + concurrency)
        const batchResults = await Promise.all(
          batch.map(port => checkPort(target.trim(), port, timeoutMs))
        )

        scanResults.push(...batchResults)
        completed += batch.length

        // Update results progressively
        setResults([...scanResults])

        // Yield to browser
        await new Promise(r => window.setTimeout(r, 10))
      }
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Scan failed.')
      }
    } finally {
      setScanning(false)
    }
    }, [target, scanMode, concurrency, timeoutMs, checkPort])

  const stopScan = useCallback(() => {
    abortRef.current = true
    setScanning(false)
  }, [])

  const filteredResults = filterOpen
    ? results.filter(r => r.status === 'open')
    : results

  const openCount = results.filter(r => r.status === 'open').length
  const closedCount = results.filter(r => r.status === 'closed').length
  const filteredCount = results.filter(r => r.status === 'filtered').length

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
    >
      <div className="space-y-4">
        {/* Target Input */}
        <div className="flex gap-2">
          <Input
            value={target}
            onChange={(e) => { setTarget(e.target.value); setError(null) }}
            placeholder="localhost"
            aria-label="Target hostname or IP"
            disabled={scanning}
          />
          {!scanning ? (
            <Button onClick={startScan} disabled={!target.trim()}>
              <Play className="mr-1 h-4 w-4" /> Scan
            </Button>
          ) : (
            <Button variant="ghost" onClick={stopScan} className="text-red-400" disabled={false}>
              <Square className="mr-1 h-4 w-4" fill="currentColor" /> Stop
            </Button>
          )}
        </div>

        {/* Scan Options */}
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted">Scan Type</div>
              <Select value={scanMode} onChange={(e) => setScanMode(e.target.value as typeof scanMode)}>
                <option value="quick">Quick (80, 443)</option>
                <option value="common">Common (24 ports)</option>
                <option value="full">Well-known (1-1023)</option>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted">Concurrency</div>
              <Slider
                min={1}
                max={20}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted">Timeout (ms)</div>
              <Input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                min={500}
                max={10000}
                step={500}
                aria-label="Connection timeout in milliseconds"
              />
            </div>
            <Switch
              label="Only show open ports"
              checked={filterOpen}
              onChange={(e) => setFilterOpen(e.target.checked)}
            />
          </div>
        </Card>

        {/* Progress Info */}
        {scanning && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Network className="w-4 h-4 animate-pulse" />
            Scanning {target}...
          </div>
        )}

        {/* Stats */}
        {results.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Badge className={`border-0 ${openCount > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-base/50 text-muted'}`}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Open: {openCount}
            </Badge>
            <Badge className="border-0 bg-base/50 text-muted">
              <XCircle className="w-3 h-3 mr-1" /> Closed: {closedCount}
            </Badge>
            <Badge className="border-0 bg-base/50 text-muted">
              <Clock className="w-3 h-3 mr-1" /> Filtered: {filteredCount}
            </Badge>
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`w-7 h-7 p-0 ${viewMode === 'list' ? 'bg-base/50' : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`w-7 h-7 p-0 ${viewMode === 'grid' ? 'bg-base/50' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <Grid className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
            <AlertCircle className="inline-block w-4 h-4 mr-1" /> {error}
          </Card>
        )}

        {/* Results */}
        {filteredResults.length > 0 && (
          <Card className="space-y-2">
            {viewMode === 'list' ? (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-semibold uppercase text-muted px-3 py-2 border-b border-border">
                  <span>Service</span>
                  <span>Port</span>
                  <span>Status</span>
                </div>
                {filteredResults.map(r => (
                  <div key={r.port} className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-sm px-3 py-2 rounded-lg hover:bg-base/50 transition">
                    <span className="text-text">{r.service}</span>
                    <span className="text-muted font-mono">{r.port}/{r.protocol.replace('TCP/', '')}</span>
                    <span>
                      {r.status === 'open' ? (
                        <Badge className="border-0 bg-emerald-500/15 text-emerald-400 text-[10px]">OPEN</Badge>
                      ) : r.status === 'filtered' ? (
                        <Badge className="border-0 bg-amber-500/15 text-amber-400 text-[10px]">FILTERED</Badge>
                      ) : (
                        <Badge className="border-0 bg-base/50 text-muted text-[10px]">CLOSED</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {filteredResults.map(r => (
                  <div
                    key={r.port}
                    className={`p-3 rounded-lg border transition ${
                      r.status === 'open'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : r.status === 'filtered'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-border bg-base/50'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">{r.port}</div>
                    <div className="text-xs text-muted truncate">{r.service}</div>
                    {r.status === 'open' && r.responseTime && (
                      <div className="text-[10px] text-emerald-400 mt-1">{r.responseTime}ms</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Info */}
        <Badge className="border-0 bg-accent/15 text-accent">
          Browser-based • Limited to HTTP/WS probes
        </Badge>
      </div>
    </BaseToolLayout>
  )
}
