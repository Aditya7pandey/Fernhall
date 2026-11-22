import type { AddressDTO, AddressInput } from '@ecom/shared'
import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Button } from '../ui/Button'
import { Checkbox, Field, Input } from '../ui/Form'

const empty: AddressInput = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
  phone: '',
  isDefault: false,
}

export function AddressForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  errors = {},
  submitLabel = 'Save address',
  showDefault = true,
}: {
  initial?: AddressDTO | null
  onSubmit: (input: AddressInput) => void
  onCancel?: () => void
  submitting?: boolean
  errors?: Record<string, string>
  submitLabel?: string
  showDefault?: boolean
}) {
  const [form, setForm] = useState<AddressInput>(() =>
    initial
      ? {
          fullName: initial.fullName,
          line1: initial.line1,
          line2: initial.line2 ?? '',
          city: initial.city,
          state: initial.state,
          postalCode: initial.postalCode,
          country: initial.country,
          phone: initial.phone ?? '',
          isDefault: initial.isDefault,
        }
      : empty,
  )
  const set = (k: keyof AddressInput) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ ...form, line2: form.line2 || null, phone: form.phone || null })
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-6">
      <Field label="Full name" error={errors.fullName} className="sm:col-span-6">
        {(p) => <Input {...p} autoComplete="name" value={form.fullName} onChange={set('fullName')} required />}
      </Field>
      <Field label="Address" error={errors.line1} className="sm:col-span-6">
        {(p) => <Input {...p} autoComplete="address-line1" value={form.line1} onChange={set('line1')} required placeholder="Street address" />}
      </Field>
      <Field label="Apartment, suite, etc. (optional)" className="sm:col-span-6">
        {(p) => <Input {...p} autoComplete="address-line2" value={form.line2 ?? ''} onChange={set('line2')} />}
      </Field>
      <Field label="City" error={errors.city} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="address-level2" value={form.city} onChange={set('city')} required />}
      </Field>
      <Field label="State / region" error={errors.state} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="address-level1" value={form.state} onChange={set('state')} required />}
      </Field>
      <Field label="Postal code" error={errors.postalCode} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} required />}
      </Field>
      <Field label="Country" error={errors.country} className="sm:col-span-3">
        {(p) => <Input {...p} autoComplete="country-name" value={form.country} onChange={set('country')} required />}
      </Field>
      <Field label="Phone (optional)" className="sm:col-span-3">
        {(p) => <Input {...p} type="tel" autoComplete="tel" value={form.phone ?? ''} onChange={set('phone')} />}
      </Field>
      {showDefault && (
        <Checkbox
          className="sm:col-span-6"
          checked={!!form.isDefault}
          onChange={(isDefault) => setForm((f) => ({ ...f, isDefault }))}
          label="Use as my default address"
        />
      )}
      <div className="flex gap-3 sm:col-span-6">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
