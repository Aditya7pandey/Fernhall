import type { LoginInput } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export const sessionKey = ['session'] as const

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: api.auth.me, staleTime: 5 * 60_000 })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: (user) => {
      qc.clear()
      qc.setQueryData(sessionKey, user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(sessionKey, null)
    },
  })
}
