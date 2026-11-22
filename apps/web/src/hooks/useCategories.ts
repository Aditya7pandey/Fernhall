import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { qk } from '../lib/query'

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: api.categories.list, staleTime: 10 * 60_000 })
}
