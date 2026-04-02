import { useState, useCallback, useMemo } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Eye, Copy, Check, Globe, Loader2, ExternalLink, RefreshCw } from 'lucide-react'

type OpenGraphPreviewToolProps = {
  tool: ToolDefinition
}

type OGData = {
  title: string
  description: string
  image: string
  url: string
  siteName: string
  type: string
  imageWidth: string
  imageHeight: string
  locale: string
  twitterCard: string
  twitterSite: string
  twitterCreator: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
}

type OGField = {
  key: keyof OGData
  label: string
  placeholder: string
  group: 'og' | 'twitter' | 'basic'
  ogProperty?: string
}

const OG_FIELDS: OGField[] = [
  { key: 'title', label: 'Title', placeholder: 'Page title', group: 'basic', ogProperty: 'og:title' },
  { key: 'description', label: 'Description', placeholder: 'Page description', group: 'basic', ogProperty: 'og:description' },
  { key: 'url', label: 'URL', placeholder: 'https://example.com/page', group: 'basic', ogProperty: 'og:url' },
  { key: 'image', label: 'Image URL', placeholder: 'https://example.com/image.jpg', group: 'og', ogProperty: 'og:image' },
  { key: 'siteName', label: 'Site Name', placeholder: 'My Website', group: 'og', ogProperty: 'og:site_name' },
  { key: 'type', label: 'Type', placeholder: 'website', group: 'og', ogProperty: 'og:type' },
  { key: 'imageWidth', label: 'Image Width', placeholder: '1200', group: 'og', ogProperty: 'og:image:width' },
  { key: 'imageHeight', label: 'Image Height', placeholder: '630', group: 'og', ogProperty: 'og:image:height' },
  { key: 'locale', label: 'Locale', placeholder: 'en_US', group: 'og', ogProperty: 'og:locale' },
  { key: 'twitterCard', label: 'Card Type', placeholder: 'summary_large_image', group: 'twitter', ogProperty: 'twitter:card' },
  { key: 'twitterSite', label: 'Twitter @site', placeholder: '@mysite', group: 'twitter', ogProperty: 'twitter:site' },
  { key: 'twitterCreator', label: 'Twitter @creator', placeholder: '@author', group: 'twitter', ogProperty: 'twitter:creator' },
  { key: 'twitterTitle', label: 'Twitter Title', placeholder: 'Same as og:title if empty', group: 'twitter', ogProperty: 'twitter:title' },
  { key: 'twitterDescription', label: 'Twitter Description', placeholder: 'Same as og:description if empty', group: 'twitter', ogProperty: 'twitter:description' },
  { key: 'twitterImage', label: 'Twitter Image', placeholder: 'Same as og:image if empty', group: 'twitter', ogProperty: 'twitter:image' },
]

const DEFAULT_OG_DATA: OGData = {
  title: 'My Awesome Page',
  description: 'A brief description of my page that appears in social media previews.',
  image: '',
  url: 'https://example.com/page',
  siteName: 'My Website',
  type: 'website',
  imageWidth: '1200',
  imageHeight: '630',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
  twitterSite: '@mysite',
  twitterCreator: '@creator',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
}

export function OpenGraphPreviewTool({ tool }: OpenGraphPreviewToolProps) {
  const [ogData, setOgData] = useState<OGData>(DEFAULT_OG_DATA)
  const [previewMode, setPreviewMode] = useState<'facebook' | 'twitter' | 'linkedin'>('facebook')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [fetchUrl, setFetchUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [showSource, setShowSource] = useState(false)

  const effectiveTwitterTitle = ogData.twitterTitle || ogData.title
  const effectiveTwitterDesc = ogData.twitterDescription || ogData.description
  const effectiveTwitterImage = ogData.twitterImage || ogData.image

  const handleFieldChange = useCallback((key: keyof OGData, value: string) => {
    setOgData(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleReset = useCallback(() => {
    setOgData(DEFAULT_OG_DATA)
  }, [])

  const generateOGTags = useCallback((): string => {
    const tags: string[] = []

    if (ogData.title) tags.push(`<meta property="og:title" content="${ogData.title}" />`)
    if (ogData.description) tags.push(`<meta property="og:description" content="${ogData.description}" />`)
    if (ogData.url) tags.push(`<meta property="og:url" content="${ogData.url}" />`)
    if (ogData.image) tags.push(`<meta property="og:image" content="${ogData.image}" />`)
    if (ogData.siteName) tags.push(`<meta property="og:site_name" content="${ogData.siteName}" />`)
    if (ogData.type) tags.push(`<meta property="og:type" content="${ogData.type}" />`)
    if (ogData.imageWidth) tags.push(`<meta property="og:image:width" content="${ogData.imageWidth}" />`)
    if (ogData.imageHeight) tags.push(`<meta property="og:image:height" content="${ogData.imageHeight}" />`)
    if (ogData.locale) tags.push(`<meta property="og:locale" content="${ogData.locale}" />`)
    if (ogData.twitterCard) tags.push(`<meta name="twitter:card" content="${ogData.twitterCard}" />`)
    if (ogData.twitterSite) tags.push(`<meta name="twitter:site" content="${ogData.twitterSite}" />`)
    if (ogData.twitterCreator) tags.push(`<meta name="twitter:creator" content="${ogData.twitterCreator}" />`)
    if (ogData.twitterTitle) tags.push(`<meta name="twitter:title" content="${ogData.twitterTitle}" />`)
    if (ogData.twitterDescription) tags.push(`<meta name="twitter:description" content="${ogData.twitterDescription}" />`)
    if (ogData.twitterImage) tags.push(`<meta name="twitter:image" content="${ogData.twitterImage}" />`)

    return tags.join('\n')
  }, [ogData])

  const handleCopyTags = useCallback(() => {
    navigator.clipboard.writeText(generateOGTags()).catch(() => {})
    setCopiedField('all')
    setTimeout(() => setCopiedField(null), 2000)
  }, [generateOGTags])

  const handleCopyField = useCallback((property: string, value: string) => {
    const tag = `<meta property="${property}" content="${value}" />`
    navigator.clipboard.writeText(tag).catch(() => {})
    setCopiedField(property)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const handleFetchFromUrl = useCallback(async () => {
    if (!fetchUrl.trim()) return
    const targetUrl = fetchUrl.startsWith('http') ? fetchUrl : `https://${fetchUrl}`

    setFetching(true)
    try {
      // Use allorigins proxy to fetch page content
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
      const response = await fetch(proxyUrl)
      const data = await response.json()
      if (!data.contents) throw new Error('Could not fetch page')

      const parser = new DOMParser()
      const doc = parser.parseFromString(data.contents, 'text/html')

      const getMeta = (attr: string, value: string): string => {
        const el = doc.querySelector(`meta[${attr}="${value}"]`)
        return el?.getAttribute('content') || ''
      }

      setOgData({
        title: getMeta('property', 'og:title') || doc.querySelector('title')?.textContent || '',
        description: getMeta('property', 'og:description') || getMeta('name', 'description') || '',
        image: getMeta('property', 'og:image') || '',
        url: getMeta('property', 'og:url') || targetUrl,
        siteName: getMeta('property', 'og:site_name') || '',
        type: getMeta('property', 'og:type') || 'website',
        imageWidth: getMeta('property', 'og:image:width') || '',
        imageHeight: getMeta('property', 'og:image:height') || '',
        locale: getMeta('property', 'og:locale') || '',
        twitterCard: getMeta('name', 'twitter:card') || 'summary_large_image',
        twitterSite: getMeta('name', 'twitter:site') || '',
        twitterCreator: getMeta('name', 'twitter:creator') || '',
        twitterTitle: getMeta('name', 'twitter:title') || '',
        twitterDescription: getMeta('name', 'twitter:description') || '',
        twitterImage: getMeta('name', 'twitter:image') || '',
      })
    } catch {
      // Silent fail
    }
    setFetching(false)
  }, [fetchUrl])

  const previewImage = useMemo(() => {
    if (previewMode === 'twitter') return effectiveTwitterImage || ogData.image
    if (previewMode === 'linkedin') return ogData.image
    return ogData.image
  }, [ogData.image, effectiveTwitterImage, previewMode])

  const previewTitle = useMemo(() => {
    if (previewMode === 'twitter') return effectiveTwitterTitle
    return ogData.title
  }, [ogData.title, effectiveTwitterTitle, previewMode])

  const previewDesc = useMemo(() => {
    if (previewMode === 'twitter') return effectiveTwitterDesc
    return ogData.description
  }, [ogData.description, effectiveTwitterDesc, previewMode])

  const ogGroupFields = OG_FIELDS.filter(f => f.group === 'og')
  const twitterGroupFields = OG_FIELDS.filter(f => f.group === 'twitter')
  const basicGroupFields = OG_FIELDS.filter(f => f.group === 'basic')

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          {/* URL Fetch */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Import from URL</label>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchFromUrl()}
                placeholder="https://example.com"
                className="flex-1 h-9 rounded-lg border border-border bg-base/60 px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted"
              />
              <Button size="sm" onClick={handleFetchFromUrl} disabled={fetching || !fetchUrl.trim()}>
                {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Preview Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Preview Platform</label>
            <div className="grid grid-cols-3 gap-1">
              {(['facebook', 'twitter', 'linkedin'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                    previewMode === mode
                      ? 'bg-accent text-white'
                      : 'bg-base/60 text-muted hover:text-text'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={handleCopyTags} className="w-full">
              {copiedField === 'all' ? (
                <><Check className="mr-2 h-4 w-4" /> {'Copied!'}</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" /> Copy All Tags</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowSource(!showSource)} className="w-full">
              <Eye className="mr-2 h-4 w-4" /> {showSource ? 'Hide' : 'Show'} Source
            </Button>
            <Button variant="ghost" onClick={handleReset} className="w-full text-xs">
              Reset to Default
            </Button>
          </div>

          <Badge className="border-0 bg-accent/15 text-accent">Live Preview • Copy Ready</Badge>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Input Fields */}
        <div className="space-y-4">
          {/* Basic Fields */}
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Basic</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {basicGroupFields.map(field => (
                <div key={field.key}>
                  <label className="text-xs text-muted mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    value={ogData[field.key]}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full h-9 rounded-lg border border-border bg-base/60 px-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* OG Fields */}
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Open Graph</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ogGroupFields.map(field => (
                <div key={field.key} className="group relative">
                  <label className="text-xs text-muted mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    value={ogData[field.key]}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full h-9 rounded-lg border border-border bg-base/60 px-2 pr-8 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted"
                  />
                  {ogData[field.key] && field.ogProperty && (
                    <button
                      type="button"
                      onClick={() => handleCopyField(field.ogProperty!, ogData[field.key])}
                      className="absolute right-2 bottom-2 text-muted hover:text-text opacity-0 group-hover:opacity-100 transition"
                      title="Copy meta tag"
                    >
                      {copiedField === field.ogProperty ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Twitter Fields */}
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Twitter Card</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {twitterGroupFields.map(field => (
                <div key={field.key} className="group relative">
                  <label className="text-xs text-muted mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    value={ogData[field.key]}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full h-9 rounded-lg border border-border bg-base/60 px-2 pr-8 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted"
                  />
                  {ogData[field.key] && field.ogProperty && (
                    <button
                      type="button"
                      onClick={() => handleCopyField(field.ogProperty!, ogData[field.key])}
                      className="absolute right-2 bottom-2 text-muted hover:text-text opacity-0 group-hover:opacity-100 transition"
                      title="Copy meta tag"
                    >
                      {copiedField === field.ogProperty ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Source Code */}
        {showSource && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-muted">Generated Meta Tags</h4>
              <Button size="sm" variant="ghost" onClick={handleCopyTags}>
                {copiedField === 'all' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <pre className="text-[11px] font-mono text-muted overflow-x-auto whitespace-pre-wrap bg-[#0d1117] rounded-lg p-3">
              {generateOGTags()}
            </pre>
          </Card>
        )}

        {/* Live Preview */}
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            {previewMode.charAt(0).toUpperCase() + previewMode.slice(1)} Preview
          </h4>
          {previewMode === 'facebook' || previewMode === 'linkedin' ? (
            <Card className="overflow-hidden p-0">
              <div className="max-w-[500px] rounded-xl overflow-hidden border border-border/50 bg-[#242526]">
                {/* Image */}
                {previewImage ? (
                  <div className="relative w-full pt-[52.5%] bg-base/40">
                    <img
                      src={previewImage}
                      alt="OG Preview"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-[200px] bg-base/40 flex items-center justify-center">
                    <Globe className="h-8 w-8 text-muted" />
                  </div>
                )}
                {/* Content */}
                <div className="p-3">
                  <div className="text-[10px] text-muted uppercase tracking-wide">{ogData.siteName || ogData.url}</div>
                  <div className="text-sm font-semibold text-white mt-0.5 line-clamp-2">{previewTitle || 'Page Title'}</div>
                  <div className="text-xs text-muted mt-1 line-clamp-2">{previewDesc || 'Description will appear here...'}</div>
                </div>
                <div className="px-3 pb-3">
                  <div className="rounded-lg border border-border/50 bg-base/40 flex items-center justify-between p-2 text-xs text-text font-medium">
                    <span>{ogData.url || 'example.com'}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted" />
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            /* Twitter Preview */
            <Card className="overflow-hidden p-0">
              <div className="max-w-[500px] rounded-xl overflow-hidden border border-border/50 bg-[#15202B]">
                {ogData.twitterCard === 'summary_large_image' ? (
                  <>
                    {previewImage && (
                      <div className="relative w-full pt-[52.5%] bg-base/40">
                        <img
                          src={previewImage}
                          alt="Twitter Preview"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="text-xs text-muted">{ogData.siteName || ogData.url}</div>
                      <div className="text-sm font-semibold text-white mt-0.5">{previewTitle || 'Title'}</div>
                      <div className="text-xs text-muted mt-1">{previewDesc || 'Description'}</div>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-3 p-3">
                    {previewImage && (
                      <img
                        src={previewImage}
                        alt="Twitter Preview"
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted">{ogData.url}</div>
                      <div className="text-sm font-semibold text-white line-clamp-2">{previewTitle || 'Title'}</div>
                      <div className="text-xs text-muted line-clamp-2 mt-0.5">{previewDesc || 'Description'}</div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </BaseToolLayout>
  )
}
