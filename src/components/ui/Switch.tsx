import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
}

export function Switch({ className, label, ...props }: SwitchProps) {
  return (
    <label className='inline-flex items-center gap-3 text-sm text-muted'>
      <span className='relative inline-flex h-6 w-11 items-center'>
        <input
          type='checkbox'
          className={cn(
            'peer absolute h-full w-full cursor-pointer appearance-none rounded-full border border-border bg-base/70 transition',
            className,
          )}
          {...props}
        />
        <span className='pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-muted transition peer-checked:translate-x-5 peer-checked:bg-white' />
        <span className='pointer-events-none absolute inset-0 rounded-full peer-checked:bg-accent/80' />
      </span>
      {label ? <span className='text-sm'>{label}</span> : null}
    </label>
  )
}
