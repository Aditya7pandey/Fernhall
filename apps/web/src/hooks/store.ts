import { useSyncExternalStore } from 'react'

/** Tiny global state container (for UI state like "cart drawer open"). */
export function create<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  const store = {
    get: () => value,
    set: (next: T) => {
      value = next
      listeners.forEach((l) => l())
    },
    subscribe: (l: () => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    use: () => useSyncExternalStore(store.subscribe, store.get),
  }
  return store
}
