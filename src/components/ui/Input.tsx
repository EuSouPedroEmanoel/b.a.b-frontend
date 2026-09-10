import { forwardRef, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  rightElement?: React.ReactNode
  rowLayout?: boolean
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, error, hint, id, required, rightElement, rowLayout = false, className, 'aria-describedby': describedBy, ...props }, ref) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined
  const inputClass = `w-full rounded-md border px-3 py-2.5 text-base bg-[var(--color-field)] dark:bg-slate-800/80 min-h-[44px] placeholder:text-slate-400 transition-colors border-[var(--color-field-border-hover)] dark:border-slate-600 hover:border-[var(--color-border)] dark:hover:border-slate-400 focus-visible:border-transparent focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${error ? 'border-red-600' : ''} ${rightElement ? 'pr-20' : ''} ${className ?? ''}`
  return (
    <div className={rowLayout ? 'grid gap-2 sm:max-w-2xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6' : 'flex flex-col gap-1.5'}>
      <label htmlFor={inputId} className={`text-sm font-medium text-slate-700 dark:text-slate-200 ${rowLayout ? 'sm:col-start-1 sm:row-start-1' : ''}`}>
        {label} {required && <span aria-hidden="true" className="text-red-600">*</span>}
      </label>
      <div className={rowLayout ? 'relative sm:col-start-2 sm:row-start-1 sm:w-32' : 'relative'}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={[errId, hintId, describedBy].filter(Boolean).join(' ') || undefined}
          required={required}
          className={inputClass}
          {...props}
        />
        {rightElement && <div className="absolute right-1 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className={`text-xs text-slate-500 ${rowLayout ? 'sm:col-start-1 sm:row-start-2' : ''}`}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
})
