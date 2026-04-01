import { useState, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'

type MarkdownToolProps = {
  tool: ToolDefinition
}

export function MarkdownTool({ tool }: MarkdownToolProps) {
  const [markdownText, setMarkdownText] = useState<string>('# Welcome to Markdown Tool\n\nStart typing or load a .md file to see the preview.')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setErrorMsg(null)
      const text = await file.text()
      setMarkdownText(text)
    } catch (error) {
      console.error('Failed to read file:', error)
      setErrorMsg('Failed to read the selected file.')
    }

    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownloadHtml = () => {
    try {
      setErrorMsg(null)
      // Convert markdown to HTML using marked and sanitize
      const rawHtml = marked.parse(markdownText) as string
      const htmlContent = DOMPurify.sanitize(rawHtml)

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    pre {
      background: #f4f4f4;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    code {
      background: #f4f4f4;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding-left: 1em;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`

      const blob = new Blob([fullHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'markdown-export.html'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to generate HTML:', error)
      setErrorMsg('Failed to download HTML.')
    }
  }

  // Convert markdown to HTML for preview with sanitization
  let previewHtml: string
  try {
    const rawHtml = marked.parse(markdownText) as string
    previewHtml = DOMPurify.sanitize(rawHtml)
  } catch (error) {
    previewHtml = `<div class="text-red-500">Error rendering markdown</div>`
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          {errorMsg && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
              {errorMsg}
            </div>
          )}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Load Markdown File</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Edit Mode</div>
            <textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              className="w-full h-40 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
              placeholder="Enter markdown here..."
            />
          </div>
          <Button onClick={handleDownloadHtml} className="w-full">
            Download HTML
          </Button>
        </div>
      }
    >
      <div className="border border-border rounded-lg bg-white p-4 min-h-[300px] overflow-auto">
        <div
          className="markdown-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </BaseToolLayout>
  )
}