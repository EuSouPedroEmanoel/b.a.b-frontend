import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Input } from './Input'

export type AutocompleteOption<T> = {
  value: string
  label: string
  data: T
  disabled?: boolean
}

type AutocompleteOptionItemProps = {
  id: string
  active: boolean
  selected: boolean
  disabled: boolean
  onSelect: () => void
  children: ReactNode
}

export function AutocompleteOptionItem({
  id,
  active,
  selected,
  disabled,
  onSelect,
  children,
}: AutocompleteOptionItemProps) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      onMouseDown={(event) => {
        event.preventDefault()
        if (!disabled) onSelect()
      }}
      className={`min-h-10 rounded px-3 py-2 text-sm ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700'
      } ${active ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
    >
      {children}
    </li>
  )
}

type Props<T> = {
  label: string
  value: string
  options: AutocompleteOption<T>[]
  onChange: (value: string, option?: AutocompleteOption<T>) => void
  id?: string
  placeholder?: string
  hint?: string
  disabled?: boolean
  autoFocus?: boolean
  emptyMessage?: string
  minimumQueryLength?: number
  minimumQueryMessage?: string
  filterOptions?: (options: AutocompleteOption<T>[], query: string) => AutocompleteOption<T>[]
  renderOption?: (option: AutocompleteOption<T>, state: { active: boolean; selected: boolean }) => ReactNode
}

export function Autocomplete<T>({
  label,
  value,
  options,
  onChange,
  id,
  placeholder,
  hint,
  disabled = false,
  autoFocus = false,
  emptyMessage = 'Nenhum resultado encontrado.',
  minimumQueryLength = 2,
  minimumQueryMessage,
  filterOptions,
  renderOption,
}: Props<T>) {
  const generatedId = useId().replace(/:/g, '')
  const inputId = id ?? `autocomplete-${generatedId}`
  const listboxId = `${inputId}-listbox`
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedOption = options.find((option) => option.value === value)
  const normalizedQuery = query.trim()
  const canSearch = normalizedQuery.length >= minimumQueryLength
  const shouldPromptForMoreCharacters = open && normalizedQuery.length > 0 && !canSearch
  const minimumMessage = minimumQueryMessage ?? `Digite pelo menos ${minimumQueryLength} caracteres para pesquisar.`
  const filteredOptions = useMemo(() => {
    if (filterOptions) return filterOptions(options, query)
    const normalizedSearchQuery = normalizedQuery.toLocaleLowerCase()
    return normalizedSearchQuery
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedSearchQuery))
      : options
  }, [filterOptions, normalizedQuery, options, query])
  const enabledOptions = filteredOptions.filter((option) => !option.disabled)
  const activeOption = enabledOptions[activeIndex]
  const activeOptionIndex = activeOption ? filteredOptions.indexOf(activeOption) : -1

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown)
  }, [open])

  const selectOption = (option: AutocompleteOption<T>) => {
    onChange(option.value, option)
    setQuery('')
    setActiveIndex(-1)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={inputId}
        label={label}
        value={query || (value ? selectedOption?.label : '')}
        placeholder={placeholder}
        hint={hint}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open && canSearch}
        aria-activedescendant={open && canSearch && activeOption ? `${listboxId}-option-${activeOptionIndex}` : undefined}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
        }}
        onChange={(event) => {
          const nextQuery = event.target.value
          if (!nextQuery && value) onChange('')
          setQuery(nextQuery)
          setActiveIndex(-1)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setActiveIndex(-1)
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) setOpen(true)
            if (!canSearch || !enabledOptions.length) return
            setActiveIndex((current) => {
              const normalizedIndex = current >= enabledOptions.length ? -1 : current
              if (event.key === 'ArrowDown') return normalizedIndex < enabledOptions.length - 1 ? normalizedIndex + 1 : 0
              return normalizedIndex > 0 ? normalizedIndex - 1 : enabledOptions.length - 1
            })
            return
          }
          if (event.key === 'Enter' && open && canSearch) {
            const option = activeOption ?? enabledOptions[0]
            if (option) {
              event.preventDefault()
              selectOption(option)
            }
          }
        }}
      />
      {shouldPromptForMoreCharacters && (
        <p role="status" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {minimumMessage}
        </p>
      )}
      {open && canSearch && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {filteredOptions.length ? filteredOptions.map((option, optionIndex) => {
            const enabledIndex = enabledOptions.indexOf(option)
            const active = enabledIndex === activeIndex
            const selected = option.value === value
            return (
              <AutocompleteOptionItem
                key={option.value}
                id={`${listboxId}-option-${optionIndex}`}
                active={active}
                selected={selected}
                disabled={Boolean(option.disabled)}
                onSelect={() => selectOption(option)}
              >
                {renderOption ? renderOption(option, { active, selected }) : option.label}
              </AutocompleteOptionItem>
            )
          }) : (
            <li role="status" className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {emptyMessage}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
