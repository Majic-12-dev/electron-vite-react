import { Link } from 'react-router-dom'
import type { ToolDefinition } from '@/data/toolRegistry'
import { Card } from '@/components/ui/Card'

type ToolCardProps = {
  tool: ToolDefinition
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link to={`/tool/${tool.id}`}>
      <Card className='group h-full transition hover:border-accent hover:bg-accent/5'>
        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent transition group-hover:bg-accent/15'>
          <tool.icon className='h-6 w-6' />
        </div>
        <div className='mt-4 space-y-2'>
          <h3 className='text-base font-semibold text-text'>{tool.name}</h3>
          <p className='text-sm text-muted'>{tool.description}</p>
        </div>
      </Card>
    </Link>
  )
}
