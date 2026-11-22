import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * List-page state (filters, page, search) kept in the URL so it survives reloads and
 * back/forward navigation. Changing any key other than `page` resets to page 1.
 */
export function useSearchState<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams()

  const get = useCallback((key: K) => params.get(key) ?? defaults[key], [params, defaults])

  const set = useCallback(
    (updates: Partial<Record<K, string>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(updates) as [K, string | undefined][]) {
            if (v === undefined || v === '' || v === defaults[k]) next.delete(k)
            else next.set(k, v)
          }
          if (!('page' in updates)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams, defaults],
  )

  return { get, set }
}
