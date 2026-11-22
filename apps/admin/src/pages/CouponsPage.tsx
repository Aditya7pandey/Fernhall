import { formatDate, formatPrice, toCents, type CouponDTO, type CouponInput, type DiscountType } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, MoreHorizontal, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { ConfirmDialog, Dialog } from '../components/ui/dialog'
import { Dropdown, DropdownItem, DropdownSeparator } from '../components/ui/dropdown'
import { Field, Input, Select } from '../components/ui/input'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../components/ui/misc'
import { Switch, SwitchRow } from '../components/ui/switch'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '../components/ui/table'
import { api } from '../lib/api'
import { centsToInput, errorMessage, fieldErrors } from '../lib/utils'

const isExpired = (c: CouponDTO) => !!c.expiresAt && new Date(c.expiresAt) < new Date()
const isUsedUp = (c: CouponDTO) => c.maxUses != null && c.usedCount >= c.maxUses

function couponState(c: CouponDTO) {
  if (!c.isActive) return <Badge>Inactive</Badge>
  if (isExpired(c)) return <Badge tone="danger">Expired</Badge>
  if (isUsedUp(c)) return <Badge tone="warning">Used up</Badge>
  return (
    <Badge tone="success" dot>
      Live
    </Badge>
  )
}

export default function CouponsPage() {
  const qc = useQueryClient()
  const coupons = useQuery({ queryKey: ['admin', 'coupons'], queryFn: api.admin.coupons.list })
  const [editing, setEditing] = useState<CouponDTO | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<CouponDTO | null>(null)

  const toggle = useMutation({
    mutationFn: (c: CouponDTO) => api.admin.coupons.update(c.id, { isActive: !c.isActive }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      toast.success(`${c.code} ${c.isActive ? 'activated' : 'deactivated'}`)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: (c: CouponDTO) => api.admin.coupons.remove(c.id),
    onSuccess: (_, c) => {
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      toast.success(`Deleted ${c.code}`)
      setToDelete(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes customers can apply at checkout."
        actions={
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            Create coupon
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {coupons.isError ? (
          <ErrorState message={errorMessage(coupons.error)} onRetry={() => coupons.refetch()} />
        ) : !coupons.data ? (
          <TableSkeleton cols={6} rows={4} />
        ) : coupons.data.length === 0 ? (
          <EmptyState
            icon={<Tag />}
            title="No coupons yet"
            description="Create a code like WELCOME10 to reward new customers."
            action={
              <Button icon={<Plus />} onClick={() => setEditing('new')}>
                Create coupon
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th className="hidden md:table-cell">Min. spend</Th>
                <Th>Usage</Th>
                <Th className="hidden lg:table-cell">Expires</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Active</Th>
                <Th className="w-10" />
              </tr>
            </THead>
            <tbody>
              {coupons.data.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(c.code)
                        toast.success(`Copied ${c.code}`)
                      }}
                      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface-2 px-2 py-0.5 font-mono text-[13px] font-medium"
                      title="Copy code"
                    >
                      {c.code}
                      <Copy className="size-3 text-subtle opacity-0 group-hover:opacity-100" />
                    </button>
                    {c.description && <p className="mt-1 max-w-56 truncate text-xs text-muted">{c.description}</p>}
                  </Td>
                  <Td className="tabular text-[13px] font-medium">{c.type === 'PERCENT' ? `${c.value}% off` : `${formatPrice(c.value)} off`}</Td>
                  <Td className="tabular hidden text-[13px] text-muted md:table-cell">{c.minSubtotalCents ? formatPrice(c.minSubtotalCents) : '—'}</Td>
                  <Td>
                    <p className="tabular text-[13px]">
                      {c.usedCount}
                      <span className="text-muted"> / {c.maxUses ?? '∞'}</span>
                    </p>
                    {c.maxUses != null && (
                      <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (c.usedCount / c.maxUses) * 100)}%` }} />
                      </div>
                    )}
                  </Td>
                  <Td className="hidden text-[13px] text-muted lg:table-cell">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</Td>
                  <Td>{couponState(c)}</Td>
                  <Td className="hidden sm:table-cell">
                    <Switch checked={c.isActive} onChange={() => toggle.mutate(c)} label={`Toggle ${c.code}`} />
                  </Td>
                  <Td>
                    <Dropdown
                      trigger={({ toggle: t }) => (
                        <Button variant="ghost" size="icon-sm" onClick={t} aria-label="Actions">
                          <MoreHorizontal />
                        </Button>
                      )}
                    >
                      {(close) => (
                        <>
                          <DropdownItem icon={<Pencil />} onClick={() => (close(), setEditing(c))}>
                            Edit
                          </DropdownItem>
                          <DropdownItem icon={<Tag />} onClick={() => (close(), toggle.mutate(c))}>
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem danger icon={<Trash2 />} onClick={() => (close(), setToDelete(c))}>
                            Delete
                          </DropdownItem>
                        </>
                      )}
                    </Dropdown>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && <CouponDialog coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        title={`Delete ${toDelete?.code ?? 'coupon'}?`}
        description="Customers won't be able to use this code any more. Past orders are unaffected."
        confirmLabel="Delete coupon"
        danger
        loading={remove.isPending}
      />
    </>
  )
}

function CouponDialog({ coupon, onClose }: { coupon: CouponDTO | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: (coupon?.type ?? 'PERCENT') as DiscountType,
    value: coupon ? (coupon.type === 'PERCENT' ? String(coupon.value) : centsToInput(coupon.value)) : '',
    minSubtotal: centsToInput(coupon?.minSubtotalCents),
    maxUses: coupon?.maxUses != null ? String(coupon.maxUses) : '',
    expiresAt: coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
    isActive: coupon?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (input: CouponInput) => (coupon ? api.admin.coupons.update(coupon.id, input) : api.admin.coupons.create(input)),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      toast.success(coupon ? 'Coupon updated' : `Created ${c.code}`)
      onClose()
    },
    onError: (err) => {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const code = form.code.trim().toUpperCase()
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) errs.code = 'Use 2–40 letters, numbers, - or _'
    const v = Number.parseFloat(form.value)
    if (!Number.isFinite(v) || v <= 0) errs.value = 'Enter a discount amount'
    else if (form.type === 'PERCENT' && (v > 100 || !Number.isInteger(v))) errs.value = 'Whole percent between 1 and 100'
    if (form.maxUses && (!Number.isInteger(Number(form.maxUses)) || Number(form.maxUses) < 1)) errs.maxUses = 'Whole number ≥ 1'
    setErrors(errs)
    if (Object.keys(errs).length) return

    save.mutate({
      code,
      description: form.description.trim() || null,
      type: form.type,
      value: form.type === 'PERCENT' ? v : toCents(v),
      minSubtotalCents: form.minSubtotal ? toCents(form.minSubtotal) : null,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt + 'T23:59:59').toISOString() : null,
      isActive: form.isActive,
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      description={coupon ? `Used ${coupon.usedCount} time${coupon.usedCount === 1 ? '' : 's'}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" loading={save.isPending}>
            {coupon ? 'Save' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="code" error={errors.code}>
            <Input
              id="code"
              autoFocus
              value={form.code}
              invalid={!!errors.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="WELCOME10"
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Description" htmlFor="desc" hint="Shown to customers">
            <Input id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="10% off your order" />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })}>
              <option value="PERCENT">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
            </Select>
          </Field>
          <Field label={form.type === 'PERCENT' ? 'Percent' : 'Amount'} htmlFor="value" error={errors.value}>
            <Input
              id="value"
              inputMode="decimal"
              value={form.value}
              invalid={!!errors.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              leading={form.type === 'FIXED' ? '$' : undefined}
              trailing={form.type === 'PERCENT' ? '%' : undefined}
              className="tabular"
            />
          </Field>
          <Field label="Minimum spend" htmlFor="min" hint="Optional">
            <Input id="min" inputMode="decimal" leading="$" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} className="tabular" />
          </Field>
          <Field label="Usage limit" htmlFor="max" error={errors.maxUses} hint="Blank = unlimited">
            <Input id="max" type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className="tabular" />
          </Field>
          <Field label="Expires on" htmlFor="exp" hint="Blank = never" className="sm:col-span-2">
            <Input id="exp" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-lg border border-border p-3.5">
          <SwitchRow title="Active" description="Customers can apply this code" checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </form>
    </Dialog>
  )
}
