export type BookEditFormState = {
  title: string
  description: string
  cover_url: string
  published_date: string
  authors: string
  genres: string
}

type BookCustomizationPayload = {
  title?: string
  description?: string | null
  cover_url?: string | null
  published_date?: string | null
  author_names?: string[]
  genre_names?: string[]
}

export type CustomizationField =
  | 'title'
  | 'description'
  | 'cover_url'
  | 'published_date'
  | 'authors'
  | 'genres'

export function customizationFieldStatus(
  overriddenFields: string[],
  field: CustomizationField,
): 'customized' | 'inherited' {
  return overriddenFields.includes(field) ? 'customized' : 'inherited'
}

function splitNames(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * Builds a school override patch without materializing inherited fields.
 * Empty values are included when the user explicitly clears an existing value.
 */
export function buildSchoolCustomizationPayload(
  initial: BookEditFormState,
  current: BookEditFormState,
): BookCustomizationPayload {
  const payload: BookCustomizationPayload = {}
  const title = current.title.trim()
  const initialTitle = initial.title.trim()

  if (title !== initialTitle) payload.title = title
  if (current.description !== initial.description) {
    payload.description = current.description.trim() || null
  }
  if (current.cover_url !== initial.cover_url) {
    payload.cover_url = current.cover_url.trim() || null
  }
  if (current.published_date !== initial.published_date) {
    payload.published_date = current.published_date || null
  }

  const authors = splitNames(current.authors)
  const initialAuthors = splitNames(initial.authors)
  if (JSON.stringify(authors) !== JSON.stringify(initialAuthors)) {
    payload.author_names = authors
  }

  const genres = splitNames(current.genres)
  const initialGenres = splitNames(initial.genres)
  if (JSON.stringify(genres) !== JSON.stringify(initialGenres)) {
    payload.genre_names = genres
  }

  return payload
}
