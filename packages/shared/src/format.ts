export const formatPrice = (cents: number, currency = 'USD', locale?: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)

/** Whole-dollar price for compact displays (e.g. $1,499) */
export const formatPriceCompact = (cents: number, currency = 'USD', locale?: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(undefined, opts).format(new Date(iso))

export const formatDateTime = (iso: string) => formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })

/** Percent off when compareAt > price, else null */
export const discountPercent = (priceCents: number, compareAtCents: number | null | undefined) =>
  compareAtCents && compareAtCents > priceCents ? Math.round((1 - priceCents / compareAtCents) * 100) : null

/** Dollars string from a form input → integer cents (NaN-safe) */
export const toCents = (value: string | number) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
