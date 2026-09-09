export function Switch({ label, description, checked, disabled, onChange, controlOnRight, accessibleLabel }: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  controlOnRight?: boolean
  accessibleLabel?: string
}) {
  const control = <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center">
      <input type="checkbox" role="switch" aria-label={accessibleLabel} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="absolute inset-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] transition-colors peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-primary)] peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--color-focus)] peer-focus-visible:outline-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 peer-hover:not-peer-disabled:bg-[var(--color-surface)] peer-checked:peer-hover:not-peer-disabled:bg-[var(--color-primary-hover)] dark:border-slate-500 dark:bg-slate-800 dark:peer-hover:not-peer-disabled:bg-slate-700 dark:peer-checked:border-blue-600 dark:peer-checked:bg-blue-600 dark:peer-checked:peer-hover:not-peer-disabled:bg-blue-700" />
      <span aria-hidden="true" className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-5 motion-reduce:transition-none" />
    </span>
  const text = <span className="min-w-0 text-sm"><span className="block font-medium">{label}</span>{description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>}</span>
  return <label className={`group flex min-h-11 items-start gap-3 ${controlOnRight ? 'justify-between' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>{controlOnRight ? <>{text}{control}</> : <>{control}{text}</>}</label>
}
