import type { CategoryDTO, CategoryInput } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { ConfirmDialog, Dialog } from '../components/ui/dialog'
import { Field, Input, Textarea } from '../components/ui/input'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/misc'
import { api } from '../lib/api'
import { errorMessage, fieldErrors, imageUrl } from '../lib/utils'

export default function CategoriesPage() {
  const qc = useQueryClient()
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: api.admin.categories.list })
  const [editing, setEditing] = useState<CategoryDTO | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<CategoryDTO | null>(null)

  const remove = useMutation({
    mutationFn: (c: CategoryDTO) => api.admin.categories.remove(c.id),
    onSuccess: (_, c) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(`Deleted ${c.name}`)
      setToDelete(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products so customers can browse your store."
        actions={
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            Add category
          </Button>
        }
      />

      {categories.isError ? (
        <Card>
          <ErrorState message={errorMessage(categories.error)} onRetry={() => categories.refetch()} />
        </Card>
      ) : !categories.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : categories.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags />}
            title="No categories yet"
            description="Create categories like Apparel or Home to organise your catalog."
            action={
              <Button icon={<Plus />} onClick={() => setEditing('new')}>
                Add category
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.data.map((c) => (
            <Card key={c.id} className="group overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden bg-surface-3">
                {c.imageUrl ? (
                  <img src={imageUrl(c.imageUrl, 700)} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex size-full items-center justify-center text-subtle">
                    <Tags className="size-8" />
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="secondary" size="icon-sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                    <Pencil />
                  </Button>
                  <Button variant="secondary" size="icon-sm" className="text-danger" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{c.name}</h3>
                    <p className="font-mono text-[11px] text-muted">/{c.slug}</p>
                  </div>
                  <Link
                    to={`/products?categoryId=${c.id}`}
                    className="tabular shrink-0 rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-muted hover:text-fg"
                  >
                    {c.productCount} product{c.productCount === 1 ? '' : 's'}
                  </Link>
                </div>
                {c.description && <p className="mt-2 line-clamp-2 text-[13px] text-muted">{c.description}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <CategoryDialog category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        title={`Delete ${toDelete?.name ?? 'category'}?`}
        description={
          toDelete?.productCount
            ? `Its ${toDelete.productCount} product${toDelete.productCount === 1 ? '' : 's'} will become uncategorised (they won't be deleted).`
            : 'This category has no products.'
        }
        confirmLabel="Delete category"
        danger
        loading={remove.isPending}
      />
    </>
  )
}

function CategoryDialog({ category, onClose }: { category: CategoryDTO | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    imageUrl: category?.imageUrl ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = useMutation({
    mutationFn: (input: CategoryInput) => (category ? api.admin.categories.update(category.id, input) : api.admin.categories.create(input)),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
      toast.success(category ? 'Category updated' : `Created ${c.name}`)
      onClose()
    },
    onError: (err) => {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setErrors({ name: 'Name is required' })
    save.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
    })
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { urls } = await api.admin.upload([file])
      setForm((f) => ({ ...f, imageUrl: urls[0]! }))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={category ? `Edit ${category.name}` : 'New category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending}>
            {category ? 'Save' : 'Create category'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="cat-name" error={errors.name}>
            <Input id="cat-name" autoFocus value={form.name} invalid={!!errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="URL handle" htmlFor="cat-slug" error={errors.slug} hint={category ? undefined : 'Auto if blank'}>
            <Input id="cat-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} leading="/" className="font-mono text-[13px]" />
          </Field>
        </div>
        <Field label="Description" htmlFor="cat-desc">
          <Textarea id="cat-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Image">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-2 text-subtle hover:text-fg"
              aria-label="Upload image"
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : form.imageUrl ? (
                <img src={imageUrl(form.imageUrl, 200)} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-5" />
              )}
            </button>
            <div className="flex-1 space-y-1.5">
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Paste a URL or click the tile to upload" />
              {form.imageUrl && (
                <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="cursor-pointer text-xs text-muted hover:text-danger">
                  Remove image
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
          </div>
        </Field>
      </form>
    </Dialog>
  )
}
