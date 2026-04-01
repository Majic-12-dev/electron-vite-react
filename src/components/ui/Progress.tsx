import { cn } from '@/lib/cn'

type ProgressProps = {
  value: number
  className?: string
}

export function Progress({ value, className }: ProgressProps) {
  const safeValue = Math.min(Math.max(value, 0), 100)
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-panel-strong', className)}>
      <div
        className='h-full rounded-full bg-accent transition-all'
        style={{ width: `${safeValue}%` }}
      />
    </div>
  )
}
