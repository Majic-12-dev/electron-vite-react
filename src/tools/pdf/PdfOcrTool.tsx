import { useState, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// Set worker source for pdfjs using CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type PdfOcrToolProps = {
  tool: ToolDefinition
}

export function PdfOcrTool({ tool }: PdfOcrToolProps) {
  const [file, setFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [text, setText] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pdfFile = e.target.files?.[0]
    if (!pdfFile) return
    setFile(pdfFile.name)
    await runOcr(pdfFile)
  }

  const runOcr = async (pdfFile: File) => {
    setLoading(true)
    setProgress(0)
    setText('')
    setStatus('Loading PDF...')

    try {
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const numPages = pdf.numPages
      let fullText = ''

      // createWorker with proper args: language 'eng', OEM 1, and logger config
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
            setStatus(`Recognizing... ${Math.round(m.progress * 100)}%`)
          }
        },
      })

      for (let i = 1; i <= numPages; i++) {
        setStatus(`Processing page ${i} of ${numPages}...`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        if (!canvas) break
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        await page.render({ canvasContext: ctx, viewport }).promise

        // Use correct toDataURL signature: type, quality (number)
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const { data: { text: pageText } } = await worker.recognize(imageDataUrl)
        fullText += `--- Page ${i} ---\n${pageText}\n\n`
        setText(fullText)
        setProgress(Math.round((i / numPages) * 100))
      }

      await worker.terminate()
      setStatus('OCR complete!')
    } catch (error) {
      console.error('OCR failed:', error)
      setStatus('Error during OCR')
      alert('OCR failed. See console for details.')
    } finally {
      setLoading(false)
    }
  }

  const downloadText = () => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ocr-result.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Upload PDF</div>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={loading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer disabled:opacity-50"
            />
          </div>
          <div className="text-xs text-muted">
            {file && <div>File: {file}</div>}
            {status && <div>Status: {status}</div>}
          </div>
          <Button onClick={downloadText} disabled={!text} className="w-full">
            Download Text
          </Button>
        </div>
      }
      loading={loading}
      result={
        text ? (
          <Card className="space-y-3 border-border bg-base/60 p-4">
            <h3 className="text-sm font-semibold text-text">OCR Result</h3>
            <div className="max-h-64 overflow-y-auto rounded border border-border bg-base/40 p-3 text-sm font-mono text-text whitespace-pre-wrap">
              {text}
            </div>
          </Card>
        ) : null
      }
    >
      <canvas ref={canvasRef} className="hidden" />
    </BaseToolLayout>
  )
}
