import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { errorMessage } from '../lib/utils'
import { useSession } from './useSession'

export function useWishlistIds() {
  const { user } = useSession()
  const query = useQuery({ queryKey: qk.wishlistIds, queryFn: api.wishlist.ids, enabled: !!user })
  return new Set(user ? (query.data ?? []) : [])
}

/** Toggle a product in the wishlist (optimistic). Sends guests to sign in. */
export function useToggleWishlist() {
  const qc = useQueryClient()
  const { user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  const mutation = useMutation({
    mutationFn: ({ productId, saved }: { productId: string; saved: boolean }) =>
      saved ? api.wishlist.remove(productId) : api.wishlist.add(productId),
    onMutate: async ({ productId, saved }) => {
      await qc.cancelQueries({ queryKey: qk.wishlistIds })
      const prev = qc.getQueryData<string[]>(qk.wishlistIds)
      qc.setQueryData<string[]>(qk.wishlistIds, (ids = []) =>
        saved ? ids.filter((id) => id !== productId) : [...ids, productId],
      )
      return { prev }
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(qk.wishlistIds, ctx?.prev)
      toast.error(errorMessage(err))
    },
    onSuccess: (_d, { saved }) => toast.success(saved ? 'Removed from wishlist' : 'Saved to wishlist'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  return (productId: string, saved: boolean) => {
    if (!user) {
      toast('Sign in to save items to your wishlist')
      navigate('/signin', { state: { from: location.pathname + location.search } })
      return
    }
    mutation.mutate({ productId, saved })
  }
}
