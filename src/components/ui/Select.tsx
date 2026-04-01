import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
        className,
      )}
      {...props}
    />
  )
}
