import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type BadgeProps = HTMLAttributes<HTMLSpanElement>

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-base/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted',
        className,
      )}
      {...props}
    />
  )
}
