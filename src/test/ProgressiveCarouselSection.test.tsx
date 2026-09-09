import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressiveCarouselSection } from '@/features/home/ProgressiveCarouselSection'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProgressiveCarouselSection', () => {
  it('mantém seção distante leve e monta o Carousel ao intersectar', () => {
    let callback: IntersectionObserverCallback | undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(next: IntersectionObserverCallback) { callback = next }
      observe() {}
      disconnect() {}
    })

    render(
      <ProgressiveCarouselSection
        title="Novidades"
        items={[{ id: 1 }]}
        renderItem={(item) => <article aria-label={`Livro ${item.id}`}>Livro</article>}
        measureItem={() => <div />}
      />,
    )

    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    act(() => callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('ativa imediatamente quando IntersectionObserver não existe', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    render(
      <ProgressiveCarouselSection
        title="Mais lidos"
        items={[{ id: 1 }]}
        renderItem={(item) => <article aria-label={`Livro ${item.id}`}>Livro</article>}
      />,
    )

    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('mantém a primeira seção ativa sem observer', () => {
    render(
      <ProgressiveCarouselSection
        title="Recomendados"
        priority
        items={[{ id: 1 }]}
        renderItem={(item) => <article aria-label={`Livro ${item.id}`}>Livro</article>}
      />,
    )

    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})
