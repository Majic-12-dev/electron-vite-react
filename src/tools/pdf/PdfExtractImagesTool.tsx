import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'

type PdfExtractImagesToolProps = {
  tool: ToolDefinition
}

type ExtractedImage = {
  data: string
  page: number
  index: number
  format: 'jpeg' | 'png'
}

export function PdfExtractImagesTool({ tool }: PdfExtractImagesToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [images, setImages] = useState<ExtractedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<ExtractedImage | null>(null)
  const [exportDir, setExportDir] = useState<string>('')

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) {
      setExportDir(selected)
      setDefaultOutputDir(selected)
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='.pdf'
      maxFiles={1}
      onProcess={async (files, context) => {
        if (!window.api?.extractImages) {
          throw new Error('The PDF image extraction engine is not available.')
        }

        const filePath = files[0]?.path
        if (!filePath) {
          throw new Error('No file path found. Remove and re-add the file.')
        }

        context.setProgress(20)
        const result = await window.api.extractImages({ filePath })
        context.setProgress(80)

        const extracted: ExtractedImage[] = result.images.map((img, idx) => ({
          data: img.data,
          page: img.page,
          index: idx,
          format: img.format,
        }))

        setImages(extracted)
        setSelectedImage(null)

        context.setProgress(100)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>
              {extracted.length} image{extracted.length === 1 ? '' : 's'} extracted
            </Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Found {extracted.length} image(s) in the PDF.</div>
              <p className='text-xs'>
                {extracted.length > 0
                  ? 'Preview below. To save, choose an output folder and click Download All.'
                  : 'No embedded images found in this PDF.'}
              </p>
            </div>
          </>,
        )
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Folder</div>
            <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
              {exportDir || outputDirLabel}
            </div>
            <Button variant='outline' className='w-full' onClick={handleChooseFolder}>
              Choose Folder
            </Button>
          </div>

          {images.length > 0 && (
            <Button
              className='w-full'
              disabled={!exportDir && !preferences.defaultOutputDir}
              onClick={async () => {
                const dir = exportDir || preferences.defaultOutputDir
                if (!dir) return

                const saved = await window.api.downloadExtractedImages({
                  images,
                  outputDir: dir,
                  baseName: 'extracted',
                })

                await window.api.revealInFolder(saved.outputDir)
              }}
            >
              Download All ({images.length})
            </Button>
          )}
        </div>
      }
    >
      {images.length > 0 && (
        <div className='space-y-4'>
          <h2 className='text-sm font-semibold text-text'>Extracted Images</h2>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
            {images.map((img) => (
              <button
                key={img.index}
                type='button'
                onClick={() => setSelectedImage(img.data === selectedImage?.data ? null : img)}
                className={`overflow-hidden rounded-xl border-2 bg-base/60 transition ${
                  selectedImage?.data === img.data
                    ? 'border-accent'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <img
                  src={img.data}
                  alt={`Image ${img.index + 1} from page ${img.page}`}
                  className='h-24 w-full object-cover'
                />
                <div className='px-2 py-1 text-left text-xs text-muted'>Page {img.page}</div>
              </button>
            ))}
          </div>

          {selectedImage && (
            <div className='rounded-xl border border-border bg-base/60 p-4 text-center'>
              <h3 className='mb-2 text-sm font-semibold text-text'>Preview</h3>
              <img
                src={selectedImage.data}
                alt={`Selected image from page ${selectedImage.page}`}
                className='mx-auto max-h-96 rounded-lg'
              />
              <div className='mt-2 text-xs text-muted'>
                Page {selectedImage.page} · Image {selectedImage.index + 1} · {selectedImage.format.toUpperCase()}
              </div>
              <Button
                variant='secondary'
                className='mt-3'
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = selectedImage.data
                  link.download = `image_page_${selectedImage.page}_${selectedImage.index + 1}.${selectedImage.format === 'jpeg' ? 'jpg' : 'png'}`
                  link.click()
                }}
              >
                Download This Image
              </Button>
              <Button variant='ghost' className='ml-2' onClick={() => setSelectedImage(null)}>
                Close
              </Button>
            </div>
          )}
        </div>
      )}
    </BaseToolLayout>
  )
}
