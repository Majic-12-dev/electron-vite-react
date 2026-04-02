import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Play, Plus, Trash2, Code2, Clock, FileCode, AlertCircle, Copy, ChevronDown, ChevronRight } from 'lucide-react'

type HeaderEntry = { key: string; value: string }

type ApiResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

type ApiTesterToolProps = {
  tool: ToolDefinition
}

export function ApiTesterTool({ tool }: ApiTesterToolProps) {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<HeaderEntry[]>([{ key: '', value: '' }])
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [headersExpanded, setHeadersExpanded] = useState(true)
  const [bodyExpanded, setBodyExpanded] = useState(true)
  const [responseSection, setResponseSection] = useState<'body' | 'headers'>('body')

  const addHeader = useCallback(() => {
    setHeaders(prev => [...prev, { key: '', value: '' }])
  }, [])

  const removeHeader = useCallback((index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setHeaders(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h))
  }, [])

  const send = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL.')
      return
    }
    setLoading(true)
    setError(null)
    setResponse(null)

    const start = performance.now()
    try {
      // Build headers object, filtering empty entries
      const fetchHeaders: Record<string, string> = {}
      for (const h of headers) {
        const k = h.key.trim()
        const v = h.value.trim()
        if (k) fetchHeaders[k] = v
      }

      // Auto-add Content-Type for methods with body
      const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && body.trim()
      if (hasBody && !fetchHeaders['Content-Type']) {
        fetchHeaders['Content-Type'] = 'application/json'
      }

      const fetchInit: RequestInit = {
        method,
        headers: fetchHeaders,
      }

      if (hasBody) {
        fetchInit.body = body
      }

      const res = await fetch(url.trim(), fetchInit)

      // Read headers as plain key-value pairs
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        resHeaders[key] = value
      })

      const text = await res.text()
      const elapsed = performance.now() - start

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: text,
        time: Math.round(elapsed),
        size: new Blob([text]).size,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [method, url, headers, body])

  const formatJson = useCallback((text: string): string => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }, [send])

  const getMethodColor = (m: string): string => {
    switch (m) {
      case 'GET': return 'text-emerald-400'
      case 'POST': return 'text-blue-400'
      case 'PUT': return 'text-amber-400'
      case 'PATCH': return 'text-purple-400'
      case 'DELETE': return 'text-red-400'
      default: return 'text-muted'
    }
  }

  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return 'text-emerald-400'
    if (status >= 300 && status < 400) return 'text-blue-400'
    if (status >= 400 && status < 500) return 'text-amber-400'
    return 'text-red-400'
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Quick example URLs
  const quickUrls = [
    { label: 'JSON Placeholder', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' },
    { label: 'HTTPBin GET', url: 'https://httpbin.org/get', method: 'GET' },
    { label: 'HTTPBin POST', url: 'https://httpbin.org/post', method: 'POST' },
  ]

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-4">
        {/* URL and Method Row */}
        <div className="flex gap-2">
          <Select
            className="w-28 shrink-0"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            aria-label="HTTP method"
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Input
            className="flex-1"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            placeholder="https://api.example.com/resource"
            aria-label="Request URL"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
          />
          <Button onClick={send} disabled={loading || !url.trim()}>
            {loading ? (
              <><Play className="mr-1 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Play className="mr-1 h-4 w-4" /> Send</>
            )}
          </Button>
        </div>

        {/* Quick Examples */}
        <div className="flex flex-wrap gap-2">
          {quickUrls.map(q => (
            <Button
              key={q.label}
              variant="ghost"
              size="sm"
              onClick={() => {
                setMethod(q.method)
                setUrl(q.url)
                setError(null)
              }}
            >
              {q.label}
            </Button>
          ))}
        </div>

        {/* Headers Section */}
        <Card className="space-y-2">
          <button
            className="flex items-center gap-2 text-xs font-semibold uppercase text-muted w-full text-left hover:text-text transition"
            onClick={() => setHeadersExpanded(!headersExpanded)}
            aria-expanded={headersExpanded}
          >
            {headersExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Headers <span className="text-muted/50 font-normal">({headers.filter(h => h.key.trim()).length})</span>
          </button>
          {headersExpanded && (
            <div className="space-y-2">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="flex-1 text-xs"
                    placeholder="Header name"
                    value={h.key}
                    onChange={(e) => updateHeader(i, 'key', e.target.value)}
                    aria-label={`Header name ${i + 1}`}
                  />
                  <Input
                    className="flex-1 text-xs"
                    placeholder="Value"
                    value={h.value}
                    onChange={(e) => updateHeader(i, 'value', e.target.value)}
                    aria-label={`Header value ${i + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHeader(i)}
                    disabled={headers.length === 1}
                    aria-label={`Remove header ${i + 1}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addHeader}>
                <Plus className="w-3 h-3 mr-1" /> Add Header
              </Button>
            </div>
          )}
        </Card>

        {/* Body Section */}
        {['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && (
          <Card className="space-y-2">
            <button
              className="flex items-center gap-2 text-xs font-semibold uppercase text-muted w-full text-left hover:text-text transition"
              onClick={() => setBodyExpanded(!bodyExpanded)}
              aria-expanded={bodyExpanded}
            >
              {bodyExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Request Body
            </button>
            {bodyExpanded && (
              <>
                <Textarea
                  className="font-mono text-xs"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={6}
                  aria-label="Request body"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(body)
                        setBody(JSON.stringify(parsed, null, 2))
                      } catch {
                        setError('Invalid JSON in request body.')
                      }
                    }}
                  >
                    <Code2 className="w-3 h-3 mr-1" /> Format JSON
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(body)}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border border-red-500/50 bg-red-500/10 text-sm text-red-200">
            <AlertCircle className="inline-block w-4 h-4 mr-1" /> {error}
          </Card>
        )}

        {/* Response */}
        {response && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-bold ${getStatusColor(response.status)}`}>
                  {response.status} {response.statusText}
                </span>
                <span className="text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {response.time}ms
                </span>
                <span className="text-muted flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> {formatSize(response.size)}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={(responseSection === 'body' ? 'secondary' : 'ghost') as 'secondary' | 'ghost'}
                  size="sm"
                  onClick={() => setResponseSection('body')}
                >
                  Body
                </Button>
                <Button
                  variant={(responseSection === 'headers' ? 'secondary' : 'ghost') as 'secondary' | 'ghost'}
                  size="sm"
                  onClick={() => setResponseSection('headers')}
                >
                  Headers
                </Button>
              </div>
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(
                  responseSection === 'body' ? response.body : JSON.stringify(response.headers, null, 2)
                )}
                aria-label="Copy response to clipboard"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <pre
                className="rounded-lg border border-border bg-base/60 p-4 max-h-96 overflow-auto text-xs font-mono leading-relaxed whitespace-pre-wrap break-all"
                style={{ tabSize: 2 }}
              >
                {responseSection === 'body'
                  ? formatJson(response.body)
                  : JSON.stringify(response.headers, null, 2)}
              </pre>
            </div>
          </Card>
        )}

        {/* Offline badge */}
        <Badge className="border-0 bg-accent/15 text-accent">
          Shortcut: Ctrl/Cmd+Enter to send
        </Badge>
      </div>
    </BaseToolLayout>
  )
}
