import type { InputHTMLAttributes, ForwardedRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef(function Input(
  { className, ...props }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
        className,
      )}
      {...props}
    />
  )
})
