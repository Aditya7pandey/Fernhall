import { ApiError } from '@ecom/shared'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { api } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Resolves an image URL (API upload or absolute) and, for Unsplash images, requests a
 * width suited to where it's rendered instead of the 1200px original.
 */
export function imageUrl(url: string | null | undefined, width = 800): string | undefined {
  const resolved = api.assetUrl(url)
  if (!resolved) return undefined
  if (!resolved.includes('images.unsplash.com')) return resolved
  try {
    const u = new URL(resolved)
    u.searchParams.set('w', String(width))
    return u.toString()
  } catch {
    return resolved
  }
}

/** Human message for any error thrown by the API client (or fetch). */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
    return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.fieldErrors : {}
}

export const STORE_NAME = 'Fernhall'
export { FREE_SHIPPING_THRESHOLD as FREE_SHIPPING_CENTS } from '@ecom/shared'
