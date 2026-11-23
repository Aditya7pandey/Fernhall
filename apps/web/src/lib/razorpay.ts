/**
 * Minimal Razorpay Checkout (checkout.js) loader + types for the parts we use.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

export type RazorpaySuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayFailure = {
  error: { code: string; description: string; reason?: string; metadata?: { payment_id?: string; order_id?: string } }
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  handler: (response: RazorpaySuccess) => void
  modal?: { ondismiss?: () => void; confirm_close?: boolean }
}

type RazorpayInstance = {
  open: () => void
  on: (event: 'payment.failed', cb: (response: RazorpayFailure) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading: Promise<void> | null = null

/** Loads checkout.js once; later calls reuse the same promise. */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('Could not load Razorpay. Check your connection and try again.'))
    }
    document.body.appendChild(script)
  })
  return loading
}

export async function openRazorpay(options: RazorpayOptions, onFailure: (r: RazorpayFailure) => void) {
  await loadRazorpay()
  if (!window.Razorpay) throw new Error('Razorpay failed to initialise')
  const rzp = new window.Razorpay(options)
  rzp.on('payment.failed', onFailure)
  rzp.open()
}
