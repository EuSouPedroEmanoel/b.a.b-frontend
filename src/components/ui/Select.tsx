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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const buttonId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`
  const listId = `${buttonId}-listbox`
  const selected = options.find((o) => o.value === value)
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapperRef.current && !wrapperRef.current.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const choose = (index: number) => {
    const option = options[index]
    if (!option || disabled) return
    onChange(option.value)
    close()
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
      <label id={`${buttonId}-label`} htmlFor={buttonId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={buttonId}
        aria-labelledby={`${buttonId}-label`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => {
            const next = !current
            if (next) setActiveIndex(selectedIndex)
            return next
          })
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              setActiveIndex(selectedIndex)
              return
            }
            setActiveIndex((current) => {
              if (!options.length) return -1
              return event.key === 'ArrowDown'
                ? (current + 1) % options.length
                : (current - 1 + options.length) % options.length
            })
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (open) choose(activeIndex)
            else setOpen(true)
          } else if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
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
          className="absolute z-20 top-full mt-1 max-h-[min(12.5rem,calc(100dvh-8rem))] w-full overflow-auto overscroll-contain rounded-md border border-[var(--color-border)] bg-[var(--color-field)] shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {options.map((opt, index) => (
            <li
              key={opt.value}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={opt.value === value}
              onPointerDown={(e) => {
                e.preventDefault()
                choose(index)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex min-h-[44px] cursor-pointer items-center px-3 py-2.5 text-sm ${index === activeIndex ? 'bg-slate-100 dark:bg-slate-700' : ''} ${opt.value === value ? 'font-semibold text-[#0f4c75] dark:text-sky-300' : 'text-slate-800 dark:text-slate-100'}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
