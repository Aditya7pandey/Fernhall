import type { NotificationsDTO } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { useSession } from './useSession'

/**
 * The header bell's data. Notifications are written by background queue workers a moment
 * after an order changes, so we poll (cheap: one small query) instead of needing a refresh.
 */
export function useNotifications() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.notifications,
    queryFn: api.notifications.list,
    enabled: !!user,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.notifications.markAllRead,
    // Optimistic: the badge clears the moment the panel opens
    onMutate: () => {
      const now = new Date().toISOString()
      qc.setQueryData<NotificationsDTO>(qk.notifications, (prev) =>
        prev ? { unreadCount: 0, items: prev.items.map((n) => ({ ...n, readAt: n.readAt ?? now })) } : prev,
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })
}
