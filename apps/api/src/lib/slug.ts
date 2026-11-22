export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Returns `base`, or `base-2`, `base-3`… — the first one `exists` says is free. */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || 'item'
  let slug = root
  for (let i = 2; await exists(slug); i++) slug = `${root}-${i}`
  return slug
}
