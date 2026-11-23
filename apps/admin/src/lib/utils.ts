import { ApiError } from '@ecom/shared'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { api } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Loadable image URL for a stored image path. Unsplash images are requested at `width`
 * (seeded URLs default to w=1200, far too big for thumbnails).
 */
export function imageUrl(url: string | null | undefined, width?: number): string | undefined {
  const resolved = api.assetUrl(url)
  if (!resolved || !width || !resolved.includes('images.unsplash.com')) return resolved
  try {
    const u = new URL(resolved)
    u.searchParams.set('w', String(width))
    u.searchParams.set('q', '70')
    return u.toString()
  } catch {
    return resolved
  }
}

export function errorMessage(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof ApiError && err.status === 429) return 'Too many attempts — please wait a few minutes and try again.'
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.fieldErrors : {}
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function formatPct(n: number | null) {
  if (n == null) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const mins = Math.round(diff / 60000)
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(-days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return rtf.format(-months, 'month')
  return rtf.format(-Math.round(months / 12), 'year')
}

/** Rupee string for form inputs from paise */
export const centsToInput = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2))
