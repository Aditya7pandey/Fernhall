import { discountPercent, formatDate, toCents, type AdminProductDetail, type ProductInput } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ImageManager } from '../components/ImageManager'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Field, Input, Select, Textarea } from '../components/ui/input'
import { Card, CardHeader, ErrorState, PageHeader, Skeleton, Stars } from '../components/ui/misc'
import { SwitchRow } from '../components/ui/switch'
import { api } from '../lib/api'
import { centsToInput, errorMessage, fieldErrors } from '../lib/utils'

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173'

type Form = {
  name: string
  slug: string
  description: string
  price: string
  compareAt: string
  sku: string
  stock: string
  categoryId: string
  images: string[]
  featured: boolean
  isActive: boolean
}

const EMPTY: Form = {
  name: '',
  slug: '',
  description: '',
  price: '',
  compareAt: '',
  sku: '',
  stock: '0',
  categoryId: '',
  images: [],
  featured: false,
  isActive: true,
}

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.name.trim()) e.name = 'Name is required'
  const price = Number.parseFloat(f.price)
  if (f.price === '' || !Number.isFinite(price) || price < 0) e.priceCents = 'Enter a valid price'
  if (f.compareAt !== '') {
    const c = Number.parseFloat(f.compareAt)
    if (!Number.isFinite(c) || c < 0) e.compareAtPriceCents = 'Enter a valid price'
    else if (Number.isFinite(price) && c <= price) e.compareAtPriceCents = 'Should be higher than the price to show a discount'
  }
  const stock = Number(f.stock)
  if (!Number.isInteger(stock) || stock < 0) e.stock = 'Stock must be a whole number ≥ 0'
  return e
}

function toForm(p: AdminProductDetail): Form {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: centsToInput(p.priceCents),
    compareAt: centsToInput(p.compareAtPriceCents),
    sku: p.sku ?? '',
    stock: String(p.stock),
    categoryId: p.categoryId ?? '',
    images: p.images,
    featured: p.featured,
    isActive: p.isActive,
  }
}

const backLink = (
  <Link to="/products" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg">
    <ArrowLeft className="size-4" /> Products
  </Link>
)

/** Loads the product (when editing), then renders the form initialised from it. */
export default function ProductEditPage() {
  const { id } = useParams()
  const product = useQuery({ queryKey: ['admin', 'product', id], queryFn: () => api.admin.products.get(id!), enabled: !!id })

  if (!id) return <ProductForm key="new" product={null} />
  if (product.isError) {
    return (
      <>
        <PageHeader title="Product" back={backLink} />
        <Card>
          <ErrorState message={errorMessage(product.error)} onRetry={() => product.refetch()} />
        </Card>
      </>
    )
  }
  if (!product.data) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-64" />} back={backLink} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[600px] lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </>
    )
  }
  return <ProductForm key={product.data.id} product={product.data} />
}

function ProductForm({ product }: { product: AdminProductDetail | null }) {
  const isNew = !product
  const id = product?.id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(() => (product ? toForm(product) : EMPTY))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: api.admin.categories.list })

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const save = useMutation({
    mutationFn: (input: ProductInput) => (isNew ? api.admin.products.create(input) : api.admin.products.update(id!, input)),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(isNew ? `Created ${p.name}` : 'Changes saved')
      setDirty(false)
      if (isNew) navigate(`/products/${p.id}`, { replace: true })
    },
    onError: (err) => {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    },
  })

  const remove = useMutation({
    mutationFn: () => api.admin.products.remove(id!),
    onSuccess: async () => {
      // Leave the page first, then drop the deleted product's cache entry (doing it while the page
      // is still mounted would trigger a refetch → 404).
      await navigate('/products', { replace: true })
      qc.removeQueries({ queryKey: ['admin', 'product', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      toast.success(`Deleted ${form.name}`)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length) return toast.error('Please fix the highlighted fields')
    save.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim(),
      priceCents: toCents(form.price),
      compareAtPriceCents: form.compareAt === '' ? null : toCents(form.compareAt),
      sku: form.sku.trim() || null,
      stock: Number(form.stock),
      categoryId: form.categoryId || null,
      images: form.images,
      featured: form.featured,
      isActive: form.isActive,
    })
  }

  const off = discountPercent(toCents(form.price), form.compareAt ? toCents(form.compareAt) : null)

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        back={backLink}
        title={isNew ? 'New product' : form.name || 'Untitled product'}
        description={
          isNew ? 'Add a product to your catalog.' : `Created ${formatDate(product!.createdAt)} · Updated ${formatDate(product!.updatedAt)}`
        }
        actions={
          <>
            {product?.isActive && (
              <a
                href={`${STOREFRONT_URL}/products/${product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-3 hover:text-fg"
              >
                <ExternalLink className="size-4" /> View in store
              </a>
            )}
            <Button variant="secondary" onClick={() => navigate('/products')}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!isNew && !dirty}>
              {isNew ? 'Create product' : 'Save changes'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <div className="space-y-4 p-5">
              <Field label="Name" htmlFor="name" error={errors.name}>
                <Input id="name" value={form.name} invalid={!!errors.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Essential Organic Cotton Tee" />
              </Field>
              <Field label="Description" htmlFor="description" error={errors.description} hint={`${form.description.length}/5000`}>
                <Textarea
                  id="description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="What makes this product special? Materials, fit, care…"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Media" description="Upload or link images, then reorder with the arrows. The first image is the cover." />
            <div className="p-5">
              <ImageManager images={form.images} onChange={(imgs) => update('images', imgs)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Price" htmlFor="price" error={errors.priceCents}>
                <Input
                  id="price"
                  inputMode="decimal"
                  leading="₹"
                  value={form.price}
                  invalid={!!errors.priceCents}
                  onChange={(e) => update('price', e.target.value)}
                  placeholder="0.00"
                  className="tabular"
                />
              </Field>
              <Field
                label={
                  <span className="flex items-center justify-between">
                    Compare-at price
                    {off && <span className="rounded bg-success-soft px-1.5 py-px text-[11px] text-success-soft-fg">−{off}% sale</span>}
                  </span>
                }
                htmlFor="compareAt"
                error={errors.compareAtPriceCents}
                hint="Original price, shown struck through"
              >
                <Input
                  id="compareAt"
                  inputMode="decimal"
                  leading="₹"
                  value={form.compareAt}
                  invalid={!!errors.compareAtPriceCents}
                  onChange={(e) => update('compareAt', e.target.value)}
                  placeholder="—"
                  className="tabular"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Inventory" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="SKU" htmlFor="sku" error={errors.sku} hint="Optional, must be unique">
                <Input id="sku" value={form.sku} onChange={(e) => update('sku', e.target.value)} placeholder="SKU-1000" className="font-mono" />
              </Field>
              <Field label="Stock" htmlFor="stock" error={errors.stock}>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  step={1}
                  value={form.stock}
                  invalid={!!errors.stock}
                  onChange={(e) => update('stock', e.target.value)}
                  className="tabular"
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <div className="space-y-5 p-5">
              <SwitchRow
                title="Active"
                description="Visible and purchasable in the store"
                checked={form.isActive}
                onChange={(v) => update('isActive', v)}
              />
              <SwitchRow
                title="Featured"
                description="Highlighted on the storefront home page"
                checked={form.featured}
                onChange={(v) => update('featured', v)}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Organisation" />
            <div className="space-y-4 p-5">
              <Field label="Category" htmlFor="category">
                <Select id="category" value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
                  <option value="">Uncategorised</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="URL handle" htmlFor="slug" error={errors.slug} hint={isNew ? 'Generated from the name if left blank' : undefined}>
                <Input id="slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} placeholder="auto" leading="/" className="font-mono text-[13px]" />
              </Field>
            </div>
          </Card>

          {product && (
            <Card>
              <CardHeader title="Performance" />
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-border">
                <Stat label="Times ordered" value={String(product._count.orderItems)} />
                <Stat label="Reviews" value={String(product._count.reviews)} />
                <div className="col-span-2 flex items-center justify-between bg-surface px-5 py-3.5">
                  <dt className="text-xs text-muted">Average rating</dt>
                  <dd className="flex items-center gap-2 text-[13px] font-medium">
                    <Stars rating={product.ratingAvg} />
                    <span className="tabular">{product.ratingCount ? product.ratingAvg.toFixed(1) : '—'}</span>
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          {!isNew && (
            <Card className="border-danger/25">
              <div className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-[13px] font-medium">Delete product</p>
                  <p className="text-xs text-muted">Past orders keep their line items.</p>
                </div>
                <Button variant="secondary" className="text-danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </div>
            </Card>
          )}

        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        title={`Delete ${form.name}?`}
        description="It will be removed from the store and any carts. This cannot be undone."
        confirmLabel="Delete product"
        danger
        loading={remove.isPending}
      />
    </form>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  )
}
