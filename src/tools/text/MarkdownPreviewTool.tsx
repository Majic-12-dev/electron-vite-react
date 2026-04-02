import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Copy, CheckCircle, FileText } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

// Lightweight markdown parser (client-side, no dependencies)
function parseMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code class="language-$1">$2</code></pre>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-image" />')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />')

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br />')

  // Wrap in paragraph if not already in a block element
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>'
  }

  return html
}

const MARKDOWN_EXAMPLES: Record<string, string> = {
  'Basic Formatting': `# Hello World

This is **bold** and this is *italic* and this is ***both***.

## Lists

- Item one
- Item two
  - Nested item

1. First
2. Second
3. Third

## Links and Code

Visit [Example](https://example.com) for more.

Inline \`code\` works too.

\`\`\`javascript
const x = 42
console.log(x)
\`\`\`

> This is a blockquote

---

~~Strikethrough text~~`,
  Table: `| Feature | Status |
| --- | --- |
| Live preview | ✅ Available |
| Export HTML | ✅ Available |
| Dark mode | 🌙 Supported |`,
}

export function MarkdownPreviewTool({ tool }: ToolProps) {
  const [input, setInput] = useState(MARKDOWN_EXAMPLES['Basic Formatting'])
  const [copied, setCopied] = useState(false)

  const htmlOutput = parseMarkdown(input)

  const handleCopyHtml = useCallback(() => {
    navigator.clipboard.writeText(htmlOutput).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [htmlOutput])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async () => {
        // Preview is live; process button triggers copy
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Load Example</div>
            <div className="flex flex-col gap-2">
              {Object.entries(MARKDOWN_EXAMPLES).map(([label, content]) => (
                <button
                  key={label}
                  onClick={() => setInput(content)}
                  className="text-left rounded-lg border border-border bg-base/50 px-3 py-2 text-xs text-muted hover:bg-panel hover:text-text transition"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Syntax Reference</div>
            <ul className="text-xs text-muted space-y-1 font-mono">
              <li># Heading 1</li>
              <li>## Heading 2</li>
              <li>**bold** / *italic*</li>
              <li>- list item</li>
              <li>[text](url)</li>
              <li>![alt](image-url)</li>
              <li>`code`</li>
              <li>--- separator</li>
              <li>&gt; blockquote</li>
            </ul>
          </div>
          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted">Markdown Input</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste your Markdown here..."
            rows={12}
            className="w-full rounded-xl border border-border bg-base/70 px-3 py-3 text-sm font-mono text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            {input.split(/\n/).length} lines • {input.length} chars
          </span>
          <Button variant="secondary" onClick={handleCopyHtml}>
            {copied ? (
              <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy HTML'}
          </Button>
        </div>

        {/* Preview */}
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted" />
            <h3 className="text-sm font-semibold text-text">Preview</h3>
          </div>
          <div
            className="prose-preview rounded-xl border border-border bg-base/50 p-4 text-sm text-text"
            dangerouslySetInnerHTML={{ __html: htmlOutput }}
          />
        </Card>
      </div>
    </BaseToolLayout>
  )
}
