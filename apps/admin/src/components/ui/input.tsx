import { ChevronDown, Search, X } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const control =
  'w-full rounded-lg border border-border bg-surface text-sm text-fg shadow-xs placeholder:text-subtle transition-[border-color,box-shadow] ' +
  'focus:border-accent focus:outline-none focus:ring-4 focus:ring-ring disabled:opacity-60 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20'

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode; trailing?: ReactNode }

export function Input({ className, invalid, leading, trailing, ...props }: InputProps) {
  if (leading || trailing) {
    return (
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-subtle">{leading}</span>}
        <input
          aria-invalid={invalid || undefined}
          className={cn(control, 'h-9', leading ? 'pl-7' : 'pl-3', trailing ? 'pr-10' : 'pr-3', className)}
          {...props}
        />
        {trailing && <span className="absolute inset-y-0 right-3 flex items-center text-sm text-subtle">{trailing}</span>}
      </div>
    )
  }
  return <input aria-invalid={invalid || undefined} className={cn(control, 'h-9 px-3', className)} {...props} />
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn(control, 'min-h-24 px-3 py-2 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, invalid, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <select aria-invalid={invalid || undefined} className={cn(control, 'h-9 cursor-pointer appearance-none pr-9 pl-3')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" />
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(control, 'h-9 pr-8 pl-9')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-subtle hover:text-fg"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label?: ReactNode
  htmlFor?: string
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
