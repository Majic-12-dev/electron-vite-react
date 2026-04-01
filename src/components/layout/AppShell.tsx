import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAppStore } from '@/store/useAppStore'

export function AppShell() {
  const darkMode = useAppStore((state) => state.preferences.darkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className='min-h-screen bg-base text-text'>
      <div className='grid min-h-screen grid-cols-[280px_minmax(0,1fr)]'>
        <Sidebar />
        <div className='relative flex min-h-screen flex-col overflow-hidden'>
          <div className='pointer-events-none absolute inset-0'>
            <div className='absolute right-0 top-0 h-64 w-64 translate-x-16 -translate-y-12 rounded-full bg-accent/10 blur-3xl' />
            <div className='absolute bottom-10 left-10 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl' />
          </div>
          <main className='relative z-10 flex-1 overflow-y-auto px-6 py-6'>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
