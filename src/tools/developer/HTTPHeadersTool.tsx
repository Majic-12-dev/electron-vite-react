import { useState, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Globe, Loader2, Copy, Check, ExternalLink, AlertCircle, Clock } from 'lucide-react'

type HTTPHeadersToolProps = {
  tool: ToolDefinition
}

type HeaderEntry = {
  name: string
  value: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

export function HTTPHeadersTool({ tool }: HTTPHeadersToolProps) {
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<HeaderEntry[]>([])
  const [status, setStatus] = useState<FetchState>('idle')
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedHeader, setCopiedHeader] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [corsMode, setCorsMode] = useState<'cors' | 'no-cors' | 'same-origin'>('cors')
  const [useProxy, setUseProxy] = useState(false)

  const normalizeUrl = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  const isValidUrl = (input: string): boolean => {
    try {
      const normalized = normalizeUrl(input)
      if (!normalized) return false
      new URL(normalized)
      return true
    } catch {
      return false
    }
  }

  const handleFetchHeaders = useCallback(async () => {
    if (!isValidUrl(url)) {
      setErrorMessage('Please enter a valid URL (e.g., https://example.com)')
      setStatus('error')
      return
    }

    const targetUrl = normalizeUrl(url)
    setStatus('loading')
    setErrorMessage(null)
    setHeaders([])
    setStatusCode(null)
    setResponseTime(null)

    const startTime = performance.now()

    try {
      const fetchUrl = useProxy
        ? `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
        : targetUrl

      const response = await fetch(fetchUrl, {
        method: 'HEAD',
        mode: corsMode,
        redirect: 'follow',
      }).catch(async () => {
        // HEAD might fail for some servers, fallback to GET
        return fetch(fetchUrl, {
          method: 'GET',
          mode: corsMode,
          redirect: 'follow',
        })
      })

      const elapsed = Math.round(performance.now() - startTime)
      setResponseTime(elapsed)
      setStatusCode(response.status)

      const headerEntries: HeaderEntry[] = []
      response.headers.forEach((value, name) => {
        headerEntries.push({ name, value })
      })

      // Sort headers alphabetically
      headerEntries.sort((a, b) => a.name.localeCompare(b.name))

      setHeaders(headerEntries)
      setStatus('success')
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime)
      setResponseTime(elapsed)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to fetch headers. The server may not support CORS. Try enabling the CORS proxy option.'
      )
      setStatus('error')
    }
  }, [url, corsMode, useProxy])

  const handleCopyHeader = useCallback((name: string, value: string) => {
    const text = `${name}: ${value}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedHeader(name)
    setTimeout(() => setCopiedHeader(null), 2000)
  }, [])

  const handleCopyAllHeaders = useCallback(() => {
    const text = headers.map(h => `${h.name}: ${h.value}`).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }, [headers])

  const filteredHeaders = headers.filter(
    h =>
      !filterText ||
      h.name.toLowerCase().includes(filterText.toLowerCase()) ||
      h.value.toLowerCase().includes(filterText.toLowerCase())
  )

  const categorizeHeader = (name: string): string => {
    const lower = name.toLowerCase()
    if (lower.startsWith('content-')) return 'Content'
    if (lower.startsWith('x-') || lower.startsWith('cf-') || lower.startsWith('x-')) return 'Custom'
    if (lower.startsWith('strict-') || lower.startsWith('content-security') || lower.includes('security')) return 'Security'
    if (lower.includes('cache')) return 'Cache'
    if (lower.includes('cors') || lower.startsWith('access-control')) return 'CORS'
    return 'General'
  }

  const groupedHeaders = filteredHeaders.reduce<Record<string, HeaderEntry[]>>((acc, h) => {
    const category = categorizeHeader(h.name)
    acc[category] = acc[category] || []
    acc[category].push(h)
    return acc
  }, {})

  const categoryOrder = ['General', 'Content', 'Security', 'CORS', 'Cache', 'Custom']
  const orderedCategories = Object.keys(groupedHeaders).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Fetch Mode</label>
            <select
              value={corsMode}
              onChange={(e) => setCorsMode(e.target.value as 'cors' | 'no-cors' | 'same-origin')}
              className="w-full h-9 rounded-lg border border-border bg-base/60 px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="cors">CORS</option>
              <option value="no-cors">No-CORS</option>
              <option value="same-origin">Same-Origin</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                className="rounded border-border bg-base/60 accent-accent"
              />
              Use CORS Proxy
              <span className="text-[10px] text-muted">(bypasses CORS restrictions)</span>
            </label>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleFetchHeaders}
              disabled={status === 'loading' || !url.trim()}
              className="w-full"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" /> Fetch Headers
                </>
              )}
            </Button>
          </div>

          {responseTime !== null && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Clock className="h-3 w-3" /> Response time: {responseTime}ms
            </div>
          )}

          {status === 'success' && headers.length > 0 && (
            <Button variant="outline" onClick={handleCopyAllHeaders} className="w-full text-xs">
              <Copy className="mr-2 h-3 w-3" /> Copy All Headers
            </Button>
          )}

          <Badge className="border-0 bg-accent/15 text-accent">Client-side • CORS-aware</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* URL Input */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-[#0d1117] px-3">
            <Globe className="h-4 w-4 text-muted flex-shrink-0" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetchHeaders()}
              placeholder="Enter URL (e.g., https://example.com)"
              className="w-full h-10 bg-transparent border-0 text-sm text-text focus:outline-none placeholder:text-muted"
            />
          </div>
          <Button onClick={handleFetchHeaders} disabled={status === 'loading' || !url.trim()}>
            {status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Error State */}
        {status === 'error' && errorMessage && (
          <Card className="border border-red-500/50 bg-red-500/10">
            <div className="flex items-start gap-3 text-sm text-red-200">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Request Failed</div>
                <div className="text-xs text-red-300/80 mt-1">{errorMessage}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Status Code Badge */}
        {statusCode !== null && (
          <div className="flex items-center gap-2">
            <Badge
              className={`border-0 ${
                statusCode >= 200 && statusCode < 300
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : statusCode >= 300 && statusCode < 400
                  ? 'bg-yellow-500/15 text-yellow-300'
                  : 'bg-red-500/15 text-red-300'
              }`}
            >
              {statusCode} {getStatusText(statusCode)}
            </Badge>
            {headers.length > 0 && (
              <span className="text-xs text-muted">{headers.length} headers found</span>
            )}
          </div>
        )}

        {/* Filter */}
        {status === 'success' && headers.length > 3 && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-[#0d1117] px-3">
            <span className="text-xs text-muted flex-shrink-0">Filter:</span>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search headers..."
              className="w-full h-8 bg-transparent border-0 text-xs text-text focus:outline-none placeholder:text-muted"
            />
          </div>
        )}

        {/* Headers Display */}
        {status === 'success' && filteredHeaders.length > 0 && (
          <div className="space-y-4">
            {orderedCategories.map(category => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{category} ({groupedHeaders[category].length})</h4>
                <div className="space-y-1">
                  {groupedHeaders[category].map(header => (
                    <div
                      key={header.name}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-base/40 px-3 py-2.5 hover:bg-base/70 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-medium text-accent">{header.name}</div>
                        <div className="text-xs text-muted truncate mt-0.5 font-mono">{header.value}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyHeader(header.name, header.value)}
                        className="flex-shrink-0 text-muted hover:text-text opacity-0 group-hover:opacity-100 transition"
                        title="Copy header value"
                      >
                        {copiedHeader === header.name ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {status === 'idle' && (
          <Card className="flex flex-col items-center justify-center py-12 space-y-3">
            <Globe className="h-10 w-10 text-muted" />
            <div className="text-sm font-medium text-text">Ready to fetch headers</div>
            <div className="text-xs text-muted text-center max-w-sm">
              Enter a URL above and click Fetch to retrieve all HTTP response headers. Use the CORS proxy if you encounter cross-origin restrictions.
            </div>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}

function getStatusText(code: number): string {
  const statusMap: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  }
  return statusMap[code] || 'Unknown'
}
