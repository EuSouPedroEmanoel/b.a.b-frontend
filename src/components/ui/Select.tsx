import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

type Option = { value: string; label: string }

type Props = {
  label: string
  id?: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
}

export function Select({ label, id, value, onChange, options, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`
  const listId = `${buttonId}-listbox`
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapperRef.current && !wrapperRef.current.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
      <label id={`${buttonId}-label`} htmlFor={buttonId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <button
        type="button"
        id={buttonId}
        aria-labelledby={`${buttonId}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full cursor-pointer rounded-md border border-[var(--color-border)] dark:border-slate-600 px-3 py-2.5 text-sm bg-[var(--color-field)] dark:bg-slate-800 flex items-center justify-between gap-2 text-left min-h-[44px] hover:border-[var(--color-field-border-hover)] dark:hover:border-slate-500 focus-visible:border-[var(--color-focus)] focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{selected ? selected.label : (placeholder ?? options[0]?.label ?? '')}</span>
        <ArrowDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${buttonId}-label`}
          className="absolute z-20 top-full mt-1 w-full rounded-md border border-[var(--color-border)] dark:border-slate-600 bg-[var(--color-field)] dark:bg-slate-800 shadow-lg overflow-auto"
          style={{ maxHeight: '200px' }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(opt.value)
                setOpen(false)
              }}
              className={`px-3 py-2.5 text-sm cursor-pointer min-h-[40px] flex items-center ${opt.value === value ? 'bg-[#0f4c75] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
