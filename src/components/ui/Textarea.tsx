import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-[96px] w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
        className,
      )}
      {...props}
    />
  )
}
