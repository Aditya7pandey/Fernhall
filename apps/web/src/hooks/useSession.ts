import type { LoginInput, RegisterInput } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { qk } from '../lib/query'

export function useSession() {
  const query = useQuery({ queryKey: qk.session, queryFn: api.auth.me, staleTime: 5 * 60_000 })
  return { user: query.data ?? null, isLoading: query.isLoading }
}

/** Refetch everything that depends on who is signed in. */
function useResetUserData() {
  const qc = useQueryClient()
  return async () => {
    // Drop per-user data first (removing doesn't refetch, so nothing fires with a stale session),
    // then refresh the session and cart; queries re-fetch as components re-render for the new user.
    qc.removeQueries({ queryKey: ['wishlist'] })
    await Promise.all([qc.invalidateQueries({ queryKey: qk.session }), qc.invalidateQueries({ queryKey: qk.cart })])
    qc.removeQueries({ queryKey: ['orders'] })
    qc.removeQueries({ queryKey: ['order'] })
    qc.removeQueries({ queryKey: qk.addresses })
  }
}

export function useLogin() {
  const reset = useResetUserData()
  return useMutation({ mutationFn: (input: LoginInput) => api.auth.login(input), onSuccess: reset })
}

export function useRegister() {
  const reset = useResetUserData()
  return useMutation({ mutationFn: (input: RegisterInput) => api.auth.register(input), onSuccess: reset })
}

export function useLogout() {
  const reset = useResetUserData()
  return useMutation({ mutationFn: api.auth.logout, onSuccess: reset })
}
