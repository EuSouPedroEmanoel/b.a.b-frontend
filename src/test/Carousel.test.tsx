import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Carousel } from '@/components/ui/Carousel'

type Geometry = { clientWidth: number; scrollWidth?: number; cardWidth?: number; wrapperWidth?: number }
let resizeCallbacks: ResizeObserverCallback[] = []

function renderCarousel(count: number, circular = true, fluidItems = false) {
  return render(
    <Carousel
      title="Livros"
      items={Array.from({ length: count }, (_, id) => ({ id }))}
      circular={circular}
      fluidItems={fluidItems}
      renderItem={(item) => <article aria-label={`Livro ${item.id + 1}`} tabIndex={0}>Livro {item.id + 1}</article>}
    />,
  )
}

function region() {
  return screen.getByRole('region', { name: /Livros\. Página/i }) as HTMLDivElement
}

function viewport() {
  return region().parentElement as HTMLDivElement
}

function labels() {
  return Array.from(region().querySelectorAll<HTMLElement>('[aria-label^="Livro"]')).map((card) => card.getAttribute('aria-label'))
}

function configureGeometry({ clientWidth, scrollWidth = 0, cardWidth = 100, wrapperWidth = 280 }: Geometry, circular = true) {
  const carouselViewport = viewport()
  Object.defineProperty(carouselViewport, 'clientWidth', { configurable: true, get: () => clientWidth })

  if (circular) {
    const measurement = carouselViewport.querySelector('[aria-hidden="true"][inert]') as HTMLDivElement
    const measuredItem = measurement.querySelector('[data-carousel-measure-item]') as HTMLElement
    Object.defineProperties(measurement, {
      offsetWidth: { configurable: true, get: () => wrapperWidth },
      getBoundingClientRect: { configurable: true, value: () => ({ width: wrapperWidth, height: 180, top: 0, left: 0, right: wrapperWidth, bottom: 180, x: 0, y: 0, toJSON: () => ({}) }) },
    })
    Object.defineProperties(measuredItem, {
      offsetWidth: { configurable: true, get: () => cardWidth },
      getBoundingClientRect: { configurable: true, value: () => ({ width: cardWidth, height: 180, top: 0, left: 0, right: cardWidth, bottom: 180, x: 0, y: 0, toJSON: () => ({}) }) },
    })
  } else {
    const scroller = screen.getByRole('region', { name: 'Livros' }) as HTMLDivElement
    let scrollLeft = 0
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, get: () => clientWidth },
      scrollWidth: { configurable: true, get: () => scrollWidth },
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value } },
      scrollTo: { configurable: true, value: ({ left }: ScrollToOptions) => { scrollLeft = left ?? scrollLeft; fireEvent.scroll(scroller) } },
    })
  }

  act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
  return carouselViewport
}

function nextButton() { return screen.getByRole('button', { name: 'Próximo' }) }
function previousButton() { return screen.getByRole('button', { name: 'Anterior' }) }

describe('Carousel paginado e sequenciado', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback) }
      observe() {}
      disconnect() {}
    })
    vi.stubGlobal('MutationObserver', class {
      observe() {}
      disconnect() {}
    })
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })

  afterEach(() => {
    cleanup()
    resizeCallbacks = []
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('mantém estrutura acessível no estado vazio sem controles', () => {
    renderCarousel(0)
    expect(screen.getByText('Nenhum item disponível.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo' })).not.toBeInTheDocument()
  })

  it('mede somente um item leve e renderiza apenas a página atual', () => {
    let measured = 0
    let rendered = 0
    render(
      <Carousel
        title="Livros"
        items={Array.from({ length: 9 }, (_, id) => ({ id }))}
        circular
        renderItem={(item) => { rendered += 1; return <article aria-label={`Livro ${item.id + 1}`}>Livro</article> }}
        measureItem={() => { measured += 1; return <div data-carousel-measure-item data-testid="measure-item" /> }}
      />,
    )
    configureGeometry({ clientWidth: 480, cardWidth: 100 })

    expect(measured).toBeGreaterThan(0)
    expect(screen.getAllByTestId('measure-item')).toHaveLength(1)
    expect(rendered).toBeGreaterThanOrEqual(4)
    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4'])
  })

  it('mede o filho com a largura do card, não o wrapper absoluto', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 548, cardWidth: 100, wrapperWidth: 280 })

    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4', 'Livro 5'])
  })

  it('distribui uma diferença mínima entre cards fluídos para completar uma página', () => {
    renderCarousel(9, true, true)
    const carouselViewport = configureGeometry({ clientWidth: 544, cardWidth: 100 })

    expect(labels()).toHaveLength(5)
    expect(carouselViewport.style.getPropertyValue('--carousel-item-width')).toBe('99.2px')
  })

  it('calcula apenas cards completos por página, sem cards adjacentes no DOM', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, cardWidth: 100 })

    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4'])
    expect(region().querySelectorAll('[aria-label^="Livro"]')).toHaveLength(4)
  })

  it('desabilita as setas quando todos os itens cabem', () => {
    renderCarousel(3)
    configureGeometry({ clientWidth: 700, cardWidth: 100 })

    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3'])
    expect(previousButton()).toBeDisabled()
    expect(nextButton()).toBeDisabled()
  })

  it('faz loop e completa a última página com itens do início', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, cardWidth: 100 })

    fireEvent.click(nextButton())
    expect(labels()).toEqual(['Livro 5', 'Livro 6', 'Livro 7', 'Livro 8'])
    fireEvent.click(nextButton())
    expect(labels()).toEqual(['Livro 9', 'Livro 1', 'Livro 2', 'Livro 3'])
    fireEvent.click(nextButton())
    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4'])
  })

  it('troca a página somente depois da sequência de saída', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, cardWidth: 100 })

    fireEvent.click(nextButton())

    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4'])
    expect(nextButton()).toBeDisabled()
    await waitFor(() => expect(labels()).toEqual(['Livro 5', 'Livro 6', 'Livro 7', 'Livro 8']), { timeout: 1500 })
    await waitFor(() => expect(nextButton()).not.toBeDisabled(), { timeout: 1500 })
  })

  it('recalcula a página de quatro para cinco cards e volta sem fragmentos', () => {
    renderCarousel(9)
    const carouselViewport = configureGeometry({ clientWidth: 480, cardWidth: 100 })
    expect(labels()).toHaveLength(4)

    Object.defineProperty(carouselViewport, 'clientWidth', { configurable: true, get: () => 548 })
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
    expect(labels()).toHaveLength(5)

    Object.defineProperty(carouselViewport, 'clientWidth', { configurable: true, get: () => 480 })
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
    expect(labels()).toHaveLength(4)
  })

  it('restaura o foco programático para a região quando remove um card focado', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, cardWidth: 100 })
    const focusedCard = region().querySelector('[aria-label="Livro 1"]') as HTMLElement
    focusedCard.focus()

    fireEvent.click(nextButton())

    expect(document.activeElement).toBe(region())
    expect(region()).toHaveAttribute('tabindex', '-1')
    expect(labels()).toEqual(['Livro 5', 'Livro 6', 'Livro 7', 'Livro 8'])
  })

  it('usa as setas do teclado e mantém o foco na região', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, cardWidth: 100 })
    region().focus()

    fireEvent.keyDown(region(), { key: 'ArrowRight' })

    expect(document.activeElement).toBe(region())
    expect(labels()).toEqual(['Livro 5', 'Livro 6', 'Livro 7', 'Livro 8'])
  })

  it('preserva o modo não circular com rolagem e setas', () => {
    renderCarousel(3, false)
    const scroller = screen.getByRole('region', { name: '' }) as HTMLDivElement
    let scrollLeft = 0
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, get: () => 200 },
      scrollWidth: { configurable: true, get: () => 600 },
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value } },
      scrollTo: { configurable: true, value: ({ left }: ScrollToOptions) => { scrollLeft = left ?? scrollLeft; fireEvent.scroll(scroller) } },
    })
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))

    expect(nextButton()).not.toBeDisabled()
    fireEvent.click(nextButton())
    expect(previousButton()).not.toBeDisabled()
  })
})
