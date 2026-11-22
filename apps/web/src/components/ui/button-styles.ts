import { cn } from '../../lib/utils'

export type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'danger' | 'link'
export type Size = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-[0_8px_20px_-8px_rgb(108_43_255_/_0.6)] hover:shadow-[0_10px_24px_-8px_rgb(108_43_255_/_0.75)]',
  secondary: 'bg-sand text-ink hover:bg-sand-2',
  outline: 'border border-ink/15 bg-surface text-ink hover:border-accent hover:text-accent',
  ghost: 'text-ink hover:bg-sand',
  accent: 'bg-brand-gradient text-white hover:brightness-110 shadow-[0_8px_20px_-8px_rgb(255_46_126_/_0.6)]',
  danger: 'bg-danger text-white hover:opacity-90',
  link: 'text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink rounded-none px-0 h-auto',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-sm',
  lg: 'h-13 px-8 text-[15px]',
  icon: 'h-10 w-10',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], variant !== 'link' && sizes[size], className)
}
