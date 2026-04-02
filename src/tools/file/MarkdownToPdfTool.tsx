import { useCallback, useState, useMemo } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FileText, Download, FileUp } from 'lucide-react'
import { marked } from 'marked'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

type ToolProps = {
  tool: ToolDefinition
}

type PageSize = 'a4' | 'letter'
type MarginSize = 'narrow' | 'medium' | 'wide'

const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
}

const MARGINS: Record<MarginSize, number> = {
  narrow: 36,
  medium: 54,
  wide: 72,
}

interface TextSegment {
  text: string
  size: number
  isBold: boolean
  isItalic: boolean
  isCode: boolean
  indent?: number
  isHr?: boolean
  isBlockquote?: boolean
}

function parseMarkdownToSegments(md: string): TextSegment[] {
  const segments: TextSegment[] = []
  try {
    const tokens = marked.lexer(md)

    function extractText(token: unknown): string {
      if (typeof token !== 'object' || token === null) return String(token ?? '')
      const t = token as Record<string, unknown>

      if (t.type === 'text') return String(t.text ?? '')

      if (t.tokens && Array.isArray(t.tokens)) {
        const parts: string[] = []
        function walk(arr: unknown[]) {
          for (const item of arr) {
            if (typeof item === 'object' && item !== null) {
              const it = item as Record<string, unknown>
              if (it.tokens && Array.isArray(it.tokens)) walk(it.tokens as unknown[])
              else if (it.text !== undefined) parts.push(String(it.text))
            } else parts.push(String(item))
          }
        }
        walk(t.tokens as unknown[])
        return parts.join('').trim()
      }

      if (t.items && Array.isArray(t.items)) {
        const itemTexts: string[] = []
        for (const item of t.items) {
          if (typeof item === 'object' && item !== null) {
            const it = item as Record<string, unknown>
            if (it.text !== undefined) itemTexts.push(String(it.text))
          }
        }
        return itemTexts.join(', ')
      }

      if (t.text !== undefined) return String(t.text)
      return ''
    }

    for (const token of tokens) {
      const t = token as Record<string, unknown>
      const type = t.type as string

      switch (type) {
        case 'heading': {
          const depth = (t.depth as number) || 1
          const sizes: Record<number, number> = { 1: 24, 2: 20, 3: 16, 4: 14, 5: 12, 6: 11 }
          const text = extractText(token)
          segments.push({ text, size: sizes[depth] || 16, isBold: true, isItalic: false, isCode: false })
          if (depth <= 2) {
            segments.push({ text: '', size: 6, isBold: false, isItalic: false, isCode: false })
          }
          break
        }
        case 'paragraph': {
          const text = extractText(token)
          if (text) segments.push({ text, size: 11, isBold: false, isItalic: false, isCode: false })
          break
        }
        case 'list': {
          const items = (t.items || []) as unknown[]
          const ordered = t.ordered as boolean
          items.forEach((item, idx) => {
            const it = item as Record<string, unknown>
            const itemContent = extractText(item).trim()
            const prefix = ordered ? `${idx + 1}. ` : '• '
            segments.push({
              text: prefix + itemContent,
              size: 11,
              isBold: false,
              isItalic: false,
              isCode: false,
              indent: 12,
            })
          })
          break
        }
        case 'code': {
          const text = String(t.text || '')
          text.split('\n').forEach((line) => {
            segments.push({ text: '  ' + line, size: 10, isBold: false, isItalic: false, isCode: true })
          })
          break
        }
        case 'blockquote': {
          const text = extractText(token)
          segments.push({
            text,
            size: 11,
            isBold: false,
            isItalic: true,
            isCode: false,
            indent: 20,
            isBlockquote: true,
          })
          break
        }
        case 'hr': {
          segments.push({ text: '—'.repeat(30), size: 8, isBold: false, isItalic: false, isCode: false, isHr: true })
          break
        }
        case 'table': {
          const header = t.header as Record<string, unknown>[] | undefined
          const rows = t.rows as Record<string, unknown>[][] | undefined
          if (header) {
            segments.push({
              text: header.map((c) => extractText(c)).join(' | '),
              size: 12,
              isBold: true,
              isItalic: false,
              isCode: false,
            })
          }
          segments.push({ text: '—'.repeat(30), size: 6, isBold: false, isItalic: false, isCode: false, isHr: true })
          rows?.forEach((row) => {
            segments.push({
              text: row.map((c) => extractText(c)).join(' | '),
              size: 11,
              isBold: false,
              isItalic: false,
              isCode: false,
            })
          })
          break
        }
        default:
          break
      }
    }
  } catch {
    md.split('\n').forEach((line) => {
      segments.push({ text: line, size: 11, isBold: false, isItalic: false, isCode: false })
    })
  }
  return segments
}

async function generatePdf(
  segments: TextSegment[],
  pageSize: PageSize,
  margin: MarginSize,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const codeFont = await pdfDoc.embedFont(StandardFonts.Courier)
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const pageW = PAGE_SIZES[pageSize].width
  const pageH = PAGE_SIZES[pageSize].height
  const ml = MARGINS[margin]
  const mr = MARGINS[margin]
  const mt = MARGINS[margin]
  const mb = MARGINS[margin]
  const cw = pageW - ml - mr

  let y = pageH - mt
  let page = pdfDoc.addPage([pageW, pageH])

  function sf(s: TextSegment) {
    if (s.isCode) return codeFont
    if (s.isBold) return boldFont
    if (s.isItalic) return italicFont
    return font
  }

  function tc(s: TextSegment) {
    if (s.isCode) return rgb(0.2, 0.2, 0.2)
    if (s.isBlockquote) return rgb(0.3, 0.3, 0.3)
    return rgb(0, 0, 0)
  }

  function drawWrapped(text: string, size: number, s: TextSegment, x: number) {
    const f = sf(s)
    for (const line of text.split('\n')) {
      if (!line.trim()) {
        y -= size * 0.8
        if (y < mb + size) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - mt }
        continue
      }
      const words = line.split(' ')
      let cur = ''
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w
        if (f.widthOfTextAtSize(test, size) > cw - (x - ml) && cur) {
          page.drawText(cur, { x, y, size, font: f, color: tc(s) })
          y -= size * 1.5
          cur = w
          if (y < mb + size) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - mt }
        } else {
          cur = test
        }
      }
      if (cur) {
        page.drawText(cur, { x, y, size, font: f, color: tc(s) })
        y -= size * 1.5
        if (y < mb + size) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - mt }
      }
    }
  }

  for (const seg of segments) {
    if (seg.isHr) {
      y -= 10
      if (y < mb) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - mt }
      page.drawLine({ start: { x: ml, y }, end: { x: pageW - mr, y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) })
      y -= 10
      continue
    }
    const x = seg.indent ? ml + seg.indent : ml
    drawWrapped(seg.text, seg.size, seg, x)
    y -= 3
    if (y < mb) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - mt }
  }
  return pdfDoc.save()
}

export default function MarkdownToPdfTool({ tool }: ToolProps) {
  const [markdown, setMarkdown] = useState('')
  const [htmlPreview, setHtmlPreview] = useState('')
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [marginSize, setMarginSize] = useState<MarginSize>('medium')
  const [generating, setGenerating] = useState(false)
  const [fileName, setFileName] = useState('document')

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setMarkdown(text)
    setFileName(file.name.replace(/\.md$/i, ''))
  }, [])

  useMemo(() => {
    try {
      setHtmlPreview(String(marked.parse(markdown || '# Enter Markdown')))
    } catch { setHtmlPreview('') }
  }, [markdown])

  const handleExportPdf = useCallback(async () => {
    if (!markdown.trim()) return
    setGenerating(true)
    try {
      const pdfBytes = await generatePdf(parseMarkdownToSegments(markdown), pageSize, marginSize)
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (fileName || 'document') + '.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (_err) {
      // handled silently
    } finally {
      setGenerating(false)
    }
  }, [markdown, pageSize, marginSize, fileName])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Page Size</div>
            <div className='flex gap-1.5'>
              {(['a4', 'letter'] as const).map((s) => (
                <button
                  key={s}
                  type='button'
                  onClick={() => setPageSize(s)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-mono text-center transition
                    ${pageSize === s ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Margins</div>
            <div className='flex gap-1.5'>
              {(['narrow', 'medium', 'wide'] as const).map((m) => (
                <button
                  key={m}
                  type='button'
                  onClick={() => setMarginSize(m)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-mono text-center transition
                    ${marginSize === m ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output File Name</div>
            <input
              type='text'
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder='document'
              className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
            />
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side</Badge>
          <Button onClick={handleExportPdf} disabled={!markdown.trim() || generating} className='w-full'>
            <Download className='mr-2 h-4 w-4' />
            {generating ? 'Generating...' : 'Export PDF'}
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted'>Or upload a .md file:</span>
          <label className='cursor-pointer'>
            <input type='file' accept='.md,.markdown' onChange={handleFileUpload} className='hidden' />
            <div className='flex items-center gap-1.5 rounded-lg border border-border bg-base/60 px-3 py-1.5 text-xs text-muted hover:text-text transition'>
              <FileUp className='h-3 w-3' />
              Browse
            </div>
          </label>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <Card>
            <div className='text-xs font-semibold uppercase text-muted mb-2'>Markdown Input</div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="# Hello World&#10;&#10;Enter **markdown** here..."
              rows={16}
              className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm font-mono text-text placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y'
            />
          </Card>
          <Card>
            <div className='text-xs font-semibold uppercase text-muted mb-2 flex items-center gap-1.5'>
              <FileText className='h-3 w-3' />
              Live Preview
            </div>
            <div
              className='max-h-96 overflow-auto rounded-lg border border-border bg-base/40 p-3 text-sm text-text'
              dangerouslySetInnerHTML={{ __html: htmlPreview }}
            />
          </Card>
        </div>
      </div>
    </BaseToolLayout>
  )
}
