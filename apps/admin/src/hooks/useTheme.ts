import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'ecom-admin-theme'
type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme)

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage unavailable (private mode etc.) — theme still applies for this session
    }
    listeners.forEach((l) => l())
  }, [])

  const toggle = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark'), [setTheme])

  return { theme, setTheme, toggle }
}
