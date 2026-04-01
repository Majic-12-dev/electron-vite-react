import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { tools } from '@/data/toolRegistry'
import { useAppStore } from '@/store/useAppStore'

const container = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function HomePage() {
  const recentTools = useAppStore((state) => state.recentTools)
  const quickActions = tools.slice(0, 6)

  return (
    <motion.div variants={container} initial='hidden' animate='show' className='space-y-6'>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold text-text'>Dashboard</h1>
        <p className='text-sm text-muted'>
          Your offline control room. Launch tools fast and monitor recent activity.
        </p>
      </div>

      <div className='grid gap-6 lg:grid-cols-[2fr_1fr]'>
        <Card className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-text'>Quick Actions</h2>
            <Badge>Top tools</Badge>
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            {quickActions.map((tool) => (
              <motion.div key={tool.id} variants={item}>
                <Link
                  to={`/tool/${tool.id}`}
                  className='flex items-center gap-3 rounded-xl border border-border bg-base/60 px-3 py-3 text-sm transition hover:border-accent hover:bg-accent/5'
                >
                  <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
                    <tool.icon className='h-5 w-5' />
                  </div>
                  <div>
                    <div className='font-semibold text-text'>{tool.name}</div>
                    <div className='text-xs text-muted'>{tool.description}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className='space-y-4'>
          <h2 className='text-sm font-semibold text-text'>Quick Stats</h2>
          <div className='space-y-3 text-sm text-muted'>
            <div className='flex items-center justify-between rounded-xl bg-base/60 px-3 py-2'>
              <span>Files processed today</span>
              <span className='font-semibold text-text'>0</span>
            </div>
            <div className='flex items-center justify-between rounded-xl bg-base/60 px-3 py-2'>
              <span>Most used tool</span>
              <span className='font-semibold text-text'>PDF Merge</span>
            </div>
            <div className='flex items-center justify-between rounded-xl bg-base/60 px-3 py-2'>
              <span>Current mode</span>
              <span className='font-semibold text-text'>Free Trial</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-text'>Recent Tools Used</h2>
          <Badge>History</Badge>
        </div>
        {recentTools.length === 0 ? (
          <div className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
            No recent tools yet. Start with a Quick Action above.
          </div>
        ) : (
          <div className='grid gap-3 md:grid-cols-2'>
            {recentTools.map((toolId) => {
              const tool = tools.find((item) => item.id === toolId)
              if (!tool) return null
              return (
                <Link
                  key={tool.id}
                  to={`/tool/${tool.id}`}
                  className='flex items-center gap-3 rounded-xl border border-border bg-base/60 px-3 py-3 text-sm transition hover:border-accent hover:bg-accent/5'
                >
                  <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
                    <tool.icon className='h-5 w-5' />
                  </div>
                  <div>
                    <div className='font-semibold text-text'>{tool.name}</div>
                    <div className='text-xs text-muted'>{tool.description}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </motion.div>
  )
}
