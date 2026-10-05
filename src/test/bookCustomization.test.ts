import { describe, expect, it } from 'vitest'
import { buildSchoolCustomizationPayload, customizationFieldStatus, type BookEditFormState } from '@/features/books/bookCustomization'

const initial: BookEditFormState = {
  title: 'Título global',
  description: 'Descrição global',
  cover_url: 'https://example.com/cover.jpg',
  published_date: '2026-01-01',
  authors: 'Autor global',
  genres: 'Ficção',
}

describe('customização escolar de livros', () => {
  it('identifica campos personalizados e herdados', () => {
    expect(customizationFieldStatus(['title', 'authors'], 'title')).toBe('customized')
    expect(customizationFieldStatus(['title', 'authors'], 'description')).toBe('inherited')
  })

  it('envia somente o campo alterado para preservar a herança', () => {
    expect(buildSchoolCustomizationPayload(initial, { ...initial, title: 'Título local' })).toEqual({
      title: 'Título local',
    })
  })

  it('envia valores vazios quando o usuário limpa um campo', () => {
    expect(buildSchoolCustomizationPayload(initial, {
      ...initial,
      description: '',
      authors: '',
      genres: '',
    })).toEqual({
      description: null,
      author_names: [],
      genre_names: [],
    })
  })

  it('ignora diferenças apenas de espaços nos nomes', () => {
    expect(buildSchoolCustomizationPayload(initial, {
      ...initial,
      authors: ' Autor global ',
      genres: ' Ficção ',
    })).toEqual({})
  })
})
