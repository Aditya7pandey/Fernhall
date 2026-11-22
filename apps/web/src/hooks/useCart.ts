import type { CartDTO } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { create } from './store'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { errorMessage } from '../lib/utils'
import { toast } from 'sonner'

export function useCart() {
  return useQuery({ queryKey: qk.cart, queryFn: api.cart.get })
}

/** Global open/closed state for the slide-over cart. */
export const cartDrawer = create(false)

function useCartMutation<V>(fn: (vars: V) => Promise<CartDTO>, opts: { success?: (v: V) => string; silent?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      qc.setQueryData(qk.cart, cart)
      qc.invalidateQueries({ queryKey: ['cart', 'quote'] })
      if (opts.success) toast.success(opts.success(vars))
    },
    onError: (err) => {
      if (!opts.silent) toast.error(errorMessage(err))
    },
  })
}

export function useAddToCart() {
  return useCartMutation(({ productId, quantity = 1 }: { productId: string; quantity?: number; name?: string }) =>
    api.cart.add(productId, quantity),
  )
}

export function useUpdateCartItem() {
  return useCartMutation(({ productId, quantity }: { productId: string; quantity: number }) =>
    api.cart.update(productId, quantity),
  )
}

export function useRemoveCartItem() {
  return useCartMutation((productId: string) => api.cart.remove(productId))
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => api.cart.applyCoupon(code), { silent: true })
}

export function useRemoveCoupon() {
  return useCartMutation(() => api.cart.removeCoupon())
}
