import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { categories, type ToolDefinition, tools } from '@/data/toolRegistry'

const categoryMap = new Map(categories.map((c) => [c.id, c]))

function useFuzzyFilter(query: string): ToolDefinition[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tools.filter((tool) => {
      const name = tool.name.toLowerCase()
      const desc = tool.description.toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [query])
}

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const results = useFuzzyFilter(query)

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Escape to close (capture phase so it fires before React handlers)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const selectTool = useCallback(
    (tool: ToolDefinition) => {
      navigate(`/tool/${tool.id}`)
      onClose()
    },
    [navigate, onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[activeIndex]) selectTool(results[activeIndex])
      }
    },
    [results, activeIndex, selectTool],
  )

  // Scroll active item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const active = listRef.current.querySelector('[aria-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  if (!open) return null

  return (
    <div
      className='fixed inset-0 z-[9999] flex items-start justify-center'
      onKeyDown={handleKeyDown}
      role='dialog'
      aria-modal='true'
      aria-label='Search tools'
    >
      {/* Backdrop */}
      <div className='fixed inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />

      {/* Panel */}
      <div className='relative z-10 mt-24 w-full max-w-xl rounded-xl border border-border bg-panel shadow-2xl'>
        {/* Search input row */}
        <div className='flex items-center gap-3 border-b border-border px-4 py-3'>
          <Search className='h-5 w-5 flex-shrink-0 text-muted' />
          <Input
            ref={inputRef}
            className='border-0 bg-transparent p-0 text-base shadow-none focus:ring-0'
            placeholder='Search tools by name or description...'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
          />
          <button
            type='button'
            onClick={onClose}
            className='flex-shrink-0 rounded-lg p-1 text-muted transition hover:bg-panel-strong hover:text-text'
            aria-label='Close search'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul ref={listRef} className='max-h-80 overflow-y-auto p-2' role='listbox'>
            {results.map((tool, i) => {
              const category = categoryMap.get(tool.categoryId)
              const isActive = i === activeIndex
              return (
                <li
                  key={tool.id}
                  role='option'
                  aria-selected={isActive}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition',
                    isActive
                      ? 'bg-accent/10 text-text'
                      : 'text-muted hover:bg-panel-strong hover:text-text',
                  )}
                  onClick={() => selectTool(tool)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-panel-strong/60'>
                    <tool.icon className='h-4 w-4 text-accent' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium text-text'>{tool.name}</p>
                    <p className='truncate text-xs text-muted'>{tool.description}</p>
                  </div>
                  {category && (
                    <Badge className='flex-shrink-0 bg-panel text-[10px] text-muted'>
                      {category.label}
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        ) : query.length > 0 ? (
          <div className='flex flex-col items-center gap-2 py-10 text-muted'>
            <FileText className='h-8 w-8 opacity-40' />
            <p className='text-sm'>No tools found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-2 py-10 text-muted'>
            <FileText className='h-8 w-8 opacity-40' />
            <p className='text-sm'>Start typing to search tools</p>
          </div>
        )}

        {/* Footer hints */}
        <div className='flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted'>
          <span className='flex items-center gap-1.5'>
            <kbd className='rounded bg-panel-strong px-1.5 py-0.5 text-[10px] font-mono'>
              ↑↓
            </kbd>
            navigate
          </span>
          <span className='flex items-center gap-1.5'>
            <kbd className='rounded bg-panel-strong px-1.5 py-0.5 text-[10px] font-mono'>
              ↵
            </kbd>
            open
          </span>
          <span className='flex items-center gap-1.5'>
            <kbd className='rounded bg-panel-strong px-1.5 py-0.5 text-[10px] font-mono'>
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
