import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-panel/80 p-4 shadow-soft backdrop-blur',
        className,
      )}
      {...props}
    />
  )
}
