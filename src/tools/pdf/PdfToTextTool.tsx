import { useState } from 'react'
import type { ReactNode } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type PdfToTextToolProps = {
  tool: ToolDefinition
}

export function PdfToTextTool({ tool }: PdfToTextToolProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [preserveLayout, setPreserveLayout] = useState(false)

  const handleProcess = async (
    files: Array<{ file: File; name: string; size: number }>,
    context: { setProgress: (value: number) => void; setResult: (result: ReactNode | null) => void; setError: (message: string | null) => void }
  ) => {
    if (!files.length) {
      context.setError('No files selected.')
      return
    }

    setIsProcessing(true)
    context.setProgress(0)

    try {
      const totalFiles = files.length
      const errors: Array<{ name: string; message: string }> = []
      const results: Array<{ name: string; text: string }> = []

      for (let i = 0; i < totalFiles; i++) {
        const toolFile = files[i]
        context.setProgress(Math.round((i / totalFiles) * 100))

        try {
          const arrayBuffer = await toolFile.file.arrayBuffer()
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
          const numPages = pdf.numPages
          let fullText = ''

          for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p)
            const textContent = await page.getTextContent()
            const items = textContent.items.filter(
              (item): item is typeof item & { str: string } => 'str' in item,
            )

            if (preserveLayout) {
              const lineMap = new Map<number, string[]>()
              for (const item of items) {
                const transform = (item as { transform: number[] }).transform
                const y = Math.round(transform[5])
                if (!lineMap.has(y)) lineMap.set(y, [])
                lineMap.get(y)!.push(item.str)
              }
              const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a)
              for (const y of sortedY) {
                fullText += lineMap.get(y)!.join(' ') + '\n'
              }
            } else {
              fullText += items.map(item => item.str).join(' ')
            }

            if (p < numPages) fullText += '\n--- Page ' + (p + 1) + ' ---\n'
          }

          results.push({ name: toolFile.name, text: fullText })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ name: toolFile.name, message })
        }
      }

      context.setProgress(100)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">Extraction Complete</h3>
          <div className="text-sm">
            Successfully processed {results.length} of {totalFiles} files.
            {errors.length > 0 && ` (${errors.length} failed)`}
          </div>
          {results.map((r, idx) => (
            <div key={idx} className="space-y-2">
              <div className="font-medium text-text">{r.name}</div>
              <pre className="max-h-64 overflow-auto rounded border border-border bg-base/40 p-3 text-xs text-text whitespace-pre-wrap break-words font-mono">
                {r.text || '(No text content found)'}
              </pre>
              <Button variant="secondary" onClick={() => downloadFile(r.text, r.name.replace(/\.pdf$/i, '.txt'))}>
                Download as .txt
              </Button>
            </div>
          ))}
          {errors.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-red-500">Errors</div>
              {errors.map((e, idx) => (
                <div key={idx} className="text-xs text-red-500">
                  {e.name}: {e.message}
                </div>
              ))}
            </div>
          )}
        </Card>
      )

      context.setResult(resultCard)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF text extraction failed.'
      context.setError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".pdf,application/pdf"
      onProcess={handleProcess}
      loading={isProcessing}
      options={
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted">
            Extract text content from PDF files. Supports batch processing.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Preserve Layout</div>
              <div className="text-xs text-muted">Group text by visual lines</div>
            </div>
            <input
              type="checkbox"
              checked={preserveLayout}
              onChange={(e) => setPreserveLayout(e.target.checked)}
            />
          </div>
        </div>
      }
    />
  )
}
