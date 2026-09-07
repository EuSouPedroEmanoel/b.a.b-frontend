import type { AutocompleteOption } from './Autocomplete'

type SchoolSuggestionProps<T extends { name: string }> = {
  option: AutocompleteOption<T>
}

export function SchoolSuggestion<T extends { name: string }>({ option }: SchoolSuggestionProps<T>) {
  return <span className="block truncate">{option.label}</span>
}
