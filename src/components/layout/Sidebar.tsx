import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Crown, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { categories, getToolById, toolsByCategory } from '@/data/toolRegistry'

export function Sidebar() {
  const location = useLocation()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const activeCategoryId = useMemo(() => {
    const [_, route, id] = location.pathname.split('/')
    if (route === 'category' && id) return id
    if (route === 'tool' && id) return getToolById(id)?.categoryId ?? null
    return null
  }, [location.pathname])

  useEffect(() => {
    if (activeCategoryId) {
      setOpenSections((prev) => ({ ...prev, [activeCategoryId]: true }))
    }
  }, [activeCategoryId])

  return (
    <aside className='flex h-screen flex-col gap-6 border-r border-border bg-panel/70 px-5 py-6 backdrop-blur'>
      <div className='flex items-center justify-between'>
        <div>
          <Link to='/' className='text-lg font-semibold text-text'>
            DocFlow Pro
          </Link>
          <p className='text-xs text-muted'>Offline utility suite</p>
        </div>
        <Badge className='border-0 bg-accent/10 text-accent'>v0.1</Badge>
      </div>

      <nav className='flex-1 space-y-4 overflow-y-auto pr-1'>
        {categories.map((category) => {
          const tools = toolsByCategory[category.id] ?? []
          const isOpen = openSections[category.id] ?? category.id === activeCategoryId
          const isActive = category.id === activeCategoryId
          return (
            <div key={category.id} className='space-y-2'>
              <div
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:bg-panel-strong hover:text-text',
                )}
              >
                <Link
                  to={`/category/${category.id}`}
                  className='flex flex-1 items-center gap-2'
                >
                  <category.icon className='h-4 w-4' />
                  {category.label}
                </Link>
                <button
                  type='button'
                  onClick={() =>
                    setOpenSections((prev) => ({
                      ...prev,
                      [category.id]: !isOpen,
                    }))
                  }
                  className='text-current'
                  aria-label={`Toggle ${category.label}`}
                >
                  <ChevronDown className={cn('h-4 w-4 transition', isOpen && 'rotate-180')} />
                </button>
              </div>
              {isOpen ? (
                <div className='space-y-1 pl-3'>
                  {tools.map((tool) => (
                    <NavLink
                      key={tool.id}
                      to={`/tool/${tool.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition',
                          isActive
                            ? 'bg-panel-strong text-text'
                            : 'text-muted hover:bg-panel hover:text-text',
                        )
                      }
                    >
                      <tool.icon className='h-3.5 w-3.5' />
                      {tool.name}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className='space-y-3'>
        <Button variant='outline' className='w-full justify-between'>
          <span className='flex items-center gap-2'>
            <Crown className='h-4 w-4 text-accent' />
            Go Pro
          </span>
          <Badge className='bg-panel text-muted'>Soon</Badge>
        </Button>
        <Link to='/settings'>
          <Button variant='secondary' className='w-full justify-start gap-2'>
            <Settings className='h-4 w-4' />
            Settings
          </Button>
        </Link>
      </div>
    </aside>
  )
}
