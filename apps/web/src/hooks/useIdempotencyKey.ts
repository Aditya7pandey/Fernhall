import { useMemo } from 'react'

/**
 * A client-generated Idempotency-Key for one "intent" (e.g. "place this order with this address").
 *
 * - Stays the SAME across retries/double-clicks of that intent → the server runs it once.
 * - Becomes NEW when any `deps` change (different address, shipping method…) → that's a different
 *   request, and reusing the old key for it would be rejected by the server (422).
 *
 * Pass a value in `deps` that changes after success too (e.g. the order id) if the same screen
 * can legitimately perform the action again.
 */
export function useIdempotencyKey(deps: readonly unknown[]): string {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => crypto.randomUUID(), deps)
}
