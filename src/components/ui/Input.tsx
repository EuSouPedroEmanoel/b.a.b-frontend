import { forwardRef, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, error, hint, id, required, ...props }, ref) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label} {required && <span aria-hidden="true" className="text-red-600">*</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={[errId, hintId].filter(Boolean).join(' ') || undefined}
        required={required}
        className={`w-full rounded-md border px-3 py-2.5 text-base bg-white dark:bg-slate-800 min-h-[44px] placeholder:text-slate-400 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${
          error ? 'border-red-600' : 'border-slate-300 dark:border-slate-600'
        }`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
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
