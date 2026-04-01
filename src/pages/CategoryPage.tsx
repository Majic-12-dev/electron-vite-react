import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { ToolCard } from '@/components/ToolCard'
import { getCategoryById, toolsByCategory } from '@/data/toolRegistry'

const container = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function CategoryPage() {
  const { categoryId } = useParams()
  const category = categoryId ? getCategoryById(categoryId) : null

  if (!category) {
    return (
      <div className='rounded-2xl border border-border bg-panel/60 p-6 text-sm text-muted'>
        Category not found. Choose another one from the sidebar.
      </div>
    )
  }

  const tools = toolsByCategory[category.id] ?? []

  return (
    <motion.div variants={container} initial='hidden' animate='show' className='space-y-6'>
      <header className='space-y-2'>
        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent'>
            <category.icon className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-semibold text-text'>{category.label} Tools</h1>
            <p className='text-sm text-muted'>{category.description}</p>
          </div>
        </div>
      </header>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {tools.map((tool) => (
          <motion.div key={tool.id} variants={item}>
            <ToolCard tool={tool} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
