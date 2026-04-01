import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { PDFDocument, rgb } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// Set worker source for pdfjs using CDN (use absolute HTTPS)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type PdfOcrToolProps = {
  tool: ToolDefinition
}

// Supported languages for OCR
const LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
] as const

// Page-level OCR result with data for searchable PDF generation
interface PageOcrResult {
  pageNumber: number
  text: string
  imageDataUrl: string
  width: number
  height: number
}

// Result from processing a single PDF file
interface ProcessedFileResult {
  text: string
  pages: PageOcrResult[]
}

export function PdfOcrTool({ tool }: PdfOcrToolProps) {
  const [resultText, setResultText] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['eng'])
  const [generateSearchablePdf, setGenerateSearchablePdf] = useState(false)
  const [processedFiles, setProcessedFiles] = useState<Array<{ name: string; result: ProcessedFileResult }>>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleProcess = async (
    files: Array<{ file: File; name: string; size: number; path?: string }>,
    context: { setProgress: (value: number) => void; setResult: (result: ReactNode | null) => void; setError: (message: string | null) => void }
  ) => {
    if (!files.length) {
      context.setError('No files selected for OCR.')
      return
    }

    setIsProcessing(true)
    setResultText('')
    setProcessedFiles([])
    context.setProgress(0)
    setStatusMessage('Starting batch OCR...')

    try {
      const totalFiles = files.length
      const errors: Array<{ name: string; message: string }> = []
      const allProcessed: Array<{ name: string; result: ProcessedFileResult }> = []
      // Ensure at least one language is selected
      const effectiveLanguages = selectedLanguages.length > 0 ? selectedLanguages : ['eng']

      // Pre-check: verify language data files exist
      const checkLanguageExists = async (lang: string) => {
        try {
          const res = await fetch(`/tesseract/languages/${lang}.traineddata`, { method: 'HEAD' })
          return res.ok
        } catch {
          return false
        }
      }
      const existenceChecks = await Promise.all(effectiveLanguages.map(checkLanguageExists))
      const missingLangs = effectiveLanguages.filter((_ln, i) => !existenceChecks[i])
      if (missingLangs.length > 0) {
        context.setError(`Missing language data for: ${missingLangs.join(', ')}. Please install the required language packs.`)
        setIsProcessing(false)
        setStatusMessage('')
        return
      }

      for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
        const toolFile = files[fileIndex]

        setStatusMessage(`Processing file ${fileIndex + 1} of ${totalFiles}: ${toolFile.name}`)

        try {
          const fileResult = await processSinglePdf(toolFile, effectiveLanguages, (fileProgress) => {
            const perFileWeight = 1 / totalFiles
            const base = (fileIndex / totalFiles) * 100
            const increment = fileProgress * perFileWeight * 100
            context.setProgress(Math.round(base + increment))
          })
          allProcessed.push({ name: toolFile.name, result: fileResult })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ name: toolFile.name, message })
        }
      }

      // Combine text for display
      const combinedText = allProcessed.map(f => `=== ${f.name} ===\n\n${f.result.text}\n\n`).join('')
      setResultText(combinedText)
      setProcessedFiles(allProcessed)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">OCR Complete</h3>
          <div className="text-sm">
            Successfully processed {allProcessed.length} of {totalFiles} files.
            {errors.length > 0 && ` (${errors.length} failed)`}
          </div>
          {combinedText && (
            <div className="max-h-96 overflow-y-auto rounded border border-border bg-base/40 p-3 text-sm font-mono text-text whitespace-pre-wrap">
              {combinedText}
            </div>
          )}
          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-red-500">Errors</div>
              <ul className="space-y-1">
                {errors.map((e, idx) => (
                  <li key={idx} className="text-xs text-red-500">
                    <span className="font-mono">{e.name}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Download buttons */}
          <div className="space-y-2">
            <Button onClick={downloadText} className="w-full">
              Download Text (.txt)
            </Button>
            {generateSearchablePdf && allProcessed.length > 0 && (
              <Button onClick={() => downloadSearchablePdf(allProcessed)} className="w-full">
                Download Searchable PDF
              </Button>
            )}
          </div>
        </Card>
      )

      context.setResult(resultCard)
      context.setProgress(100)
      setStatusMessage('')
    } catch (error) {
      console.error('Batch OCR failed:', error)
      context.setError(error instanceof Error ? error.message : 'Batch OCR failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  const processSinglePdf = async (
    toolFile: { file: File; name: string },
    languages: string[],
    onFileProgress: (progress: number) => Promise<void> | void
  ): Promise<ProcessedFileResult> => {
    const { file } = toolFile
    setStatusMessage(`Loading PDF: ${file.name}`)

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages

    let currentPage = 0
    const worker = await createWorker(
      languages,
      1,
      {
        langPath: '/tesseract/languages/',
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const fileProgress = (currentPage - 1 + m.progress) / numPages
            onFileProgress(fileProgress)
          }
        },
      }
    )

    const pages: PageOcrResult[] = []

    try {
      for (let i = 1; i <= numPages; i++) {
        currentPage = i
        setStatusMessage(`Processing ${file.name}: page ${i}/${numPages}`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        if (!canvas) break
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        await page.render({ canvasContext: ctx, viewport }).promise
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const { data: { text } } = await worker.recognize(imageDataUrl)

        pages.push({
          pageNumber: i,
          text,
          imageDataUrl,
          width: viewport.width,
          height: viewport.height,
        })
      }
    } finally {
      await worker.terminate()
    }

    const fullText = pages.map(p => p.text).join('\n')
    return { text: fullText, pages }
  }

  const downloadText = () => {
    if (!resultText) return
    const blob = new Blob([resultText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ocr-results.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadSearchablePdf = async (files: Array<{ name: string; result: ProcessedFileResult }>) => {
    if (!files.length) return

    setIsGeneratingPdf(true)
    setStatusMessage('Generating searchable PDF...')

    try {
      const pdfDoc = await PDFDocument.create()

      for (const fileData of files) {
        // Optional: Add a separator page with filename if multiple files
        if (files.length > 1) {
          const coverPage = pdfDoc.addPage()
          coverPage.drawText(fileData.name, {
            x: 50,
            y: coverPage.getHeight() - 50,
            size: 24,
          })
        }

        for (const pageData of fileData.result.pages) {
          const pdfPage = pdfDoc.addPage([pageData.width, pageData.height])

          // Embed the page image (JPEG from canvas)
          const jpegImage = await pdfDoc.embedJpg(pageData.imageDataUrl)
          pdfPage.drawImage(jpegImage, {
            x: 0,
            y: 0,
            width: pageData.width,
            height: pageData.height,
          })

          // Add invisible text layer using opacity 0
          const pageText = pageData.text.trim()
          if (pageText) {
            pdfPage.drawText(pageText, {
              x: 10,
              y: pageData.height - 20,
              size: 10,
              lineHeight: 12,
              maxWidth: pageData.width - 20,
              opacity: 0,
              color: rgb(0, 0, 0),
            })
          }
        }
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ocr-results-searchable.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setStatusMessage('Searchable PDF generated.')
    } catch (error) {
      console.error('PDF generation failed:', error)
      setStatusMessage('Failed to generate PDF. See console for details.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".pdf,application/pdf"
      options={
        <div className="space-y-4 text-sm">
          <div className="text-xs text-muted">
            Upload one or more PDF files. OCR will extract text from each page. Larger files take longer.
          </div>

          {/* Language Selection (Accessible checkboxes) */}
          <div>
            <label className="block text-xs font-medium mb-2">OCR Languages</label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(lang => (
                <label key={lang.code} className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang.code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLanguages([...selectedLanguages, lang.code])
                      } else {
                        setSelectedLanguages(selectedLanguages.filter(c => c !== lang.code))
                      }
                    }}
                    className="rounded"
                  />
                  <span>{lang.name}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-muted mt-1">
              {selectedLanguages.length} language{selectedLanguages.length !== 1 ? 's' : ''} selected.
            </div>
          </div>

          {/* Searchable PDF Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="generatePdf"
              checked={generateSearchablePdf}
              onChange={(e) => setGenerateSearchablePdf(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="generatePdf" className="text-xs cursor-pointer">
              Generate searchable PDF (image + invisible text layer)
            </label>
          </div>

          {statusMessage && (
            <div className="text-xs text-muted">
              Status: {statusMessage}
            </div>
          )}

          {resultText && !isProcessing && !isGeneratingPdf && (
            <div className="text-xs text-muted">
              Processing complete. Use the buttons below to download results.
            </div>
          )}
        </div>
      }
      onProcess={handleProcess}
      loading={isProcessing || isGeneratingPdf}
    >
      <canvas ref={canvasRef} className="hidden" />
    </BaseToolLayout>
  )
}
