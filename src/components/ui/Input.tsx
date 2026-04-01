import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
        className,
      )}
      {...props}
    />
  )
}
