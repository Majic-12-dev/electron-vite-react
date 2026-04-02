import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, FileText } from 'lucide-react'
import { cn } from '@/lib/cn'

type PdfReorderToolProps = {
  tool: ToolDefinition
}

type PdfPage = {
  id: string
  number: number
}

interface SortablePageCardProps {
  page: PdfPage
  totalPages: number
  onDelete: (id: string) => void
}

function SortablePageCard({ page, totalPages, onDelete }: SortablePageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border-2 border-border bg-base/80 p-2 transition',
        isDragging && 'z-10 border-accent shadow-lg shadow-accent/20',
      )}
    >
      <div className='flex flex-col items-center gap-1'>
        <div className='flex h-28 w-full items-center justify-center rounded-lg bg-muted/20'>
          <FileText className='h-10 w-10 text-muted/50' />
        </div>
        <div className='flex w-full items-center justify-between text-xs text-muted'>
          <span>Pg {page.number}</span>
          <button
            type='button'
            className='flex cursor-pointer items-center gap-1 hover:text-red-400'
            {...attributes}
            {...listeners}
          >
            <GripVertical className='h-3 w-3' />
          </button>
        </div>
        <button
          type='button'
          onClick={() => onDelete(page.id)}
          className='absolute right-1 top-1 rounded-md bg-black/50 p-1 opacity-0 transition hover:bg-red-500/50 group-hover:opacity-100'
          title='Remove page'
        >
          <Trash2 className='h-3 w-3 text-white' />
        </button>
      </div>
    </div>
  )
}

export function PdfReorderTool({ tool }: PdfReorderToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [pages, setPages] = useState<PdfPage[]>([])
  const [filePath, setFilePath] = useState<string>('')
  const [pageCount, setPageCount] = useState(0)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const handleDeletePage = useCallback((id: string) => {
    setPages((prev) => {
      if (prev.length <= 1) return prev // Keep at least one page
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPages((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === String(active.id))
      const newIdx = prev.findIndex((p) => p.id === String(over.id))
      return arrayMove(prev, oldIdx, newIdx)
    })
  }, [])

  const handleProcess = async (files: { file: File; path?: string }[], context: { setProgress: (v: number) => void; setResult: (r: React.ReactNode) => void; setError: (m: string | null) => void }) => {
    if (!window.api?.reorderPages) {
      throw new Error('The PDF reorder engine is not available.')
    }

    const fp = files[0]?.path
    if (!fp) {
      throw new Error('No file path found.')
    }

    setFilePath(fp)
    context.setProgress(30)

    // Get page count by reading the PDF
    const pageCountResult = await window.api.getPdfPageCount({ filePath: fp })
    setPageCount(pageCountResult.pageCount)
    
    // Initialize pages array
    const initialPages: PdfPage[] = Array.from({ length: pageCountResult.pageCount }, (_, i) => ({
      id: `page-${i}`,
      number: i,
    }))
    setPages(initialPages)

    context.setProgress(100)
    context.setResult(
      <>
        <Badge className='border-0 bg-accent/15 text-accent'>PDF loaded</Badge>
        <div className='mt-3 space-y-1 text-sm text-muted'>
          <div>{pageCountResult.pageCount} page(s) loaded.</div>
          <div className='text-xs'>Drag to reorder, click × to remove, then save.</div>
        </div>
      </>,
    )
  }

  const handleSave = async () => {
    if (!filePath) return
    if (!window.api?.reorderPages) {
      throw new Error('The PDF reorder engine is not available.')
    }

    const outputDir = preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())
    if (!preferences.defaultOutputDir) {
      setDefaultOutputDir(outputDir)
    }

    // Get the page order - the index in the sorted array maps to the original page number
    const pageOrder = pages.map((p) => p.number)

    const result = await window.api.reorderPages({
      filePath,
      pageOrder,
      outputDir,
    })

    return result
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='.pdf'
      maxFiles={1}
      onProcess={handleProcess}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Folder</div>
            <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
              {outputDirLabel}
            </div>
            <Button variant='outline' className='w-full' onClick={handleChooseFolder}>
              Change Folder
            </Button>
          </div>

          {pages.length > 0 && (
            <>
              <div className='space-y-2'>
                <div className='text-xs font-semibold uppercase text-muted'>Pages</div>
                <div className='text-xs text-muted'>
                  {pages.length} page(s) in current order
                </div>
              </div>
              <Button
                className='w-full'
                onClick={async () => {
                  try {
                    const result = await handleSave()
                    if (result) {
                      // Show result in the result area
                    }
                  } catch (err) {
                    throw new Error(err instanceof Error ? err.message : 'Unknown error')
                  }
                }}
              >
                Save PDF
              </Button>
            </>
          )}
        </div>
      }
    >
      {pages.length > 0 && (
        <div className='space-y-4'>
          <h2 className='text-sm font-semibold text-text'>Page Order</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className='grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'>
                {pages.map((page) => (
                  <SortablePageCard
                    key={page.id}
                    page={page}
                    totalPages={pages.length}
                    onDelete={handleDeletePage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className='text-xs text-muted'>
            Drag pages to reorder. Page numbers show original position.
          </div>
        </div>
      )}
    </BaseToolLayout>
  )
}
