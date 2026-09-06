import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Carousel } from '@/components/ui/Carousel'

type Geometry = { clientWidth: number; scrollWidth: number; cardWidth?: number }
let resizeCallbacks: ResizeObserverCallback[] = []

function renderCarousel(count: number, circular = true) {
  return render(<Carousel title="Livros" items={Array.from({ length: count }, (_, id) => ({ id }))} circular={circular} renderItem={(item) => <article aria-label={`Livro ${item.id + 1}`}>Livro {item.id + 1}</article>} />)
}

function region() {
  return screen
    .getAllByRole('region')
    .find((element) => element.getAttribute('aria-roledescription') === 'carrossel') as HTMLDivElement
}
function viewport() { return region().parentElement as HTMLDivElement }

function configureGeometry(geometry: Geometry, circular = true) {
  const scroller = region()
  const parent = viewport()
  const measurement = circular ? parent.querySelector('[aria-hidden="true"][inert]') as HTMLDivElement | null : null
  let scrollLeft = 0
  Object.defineProperty(parent, 'clientWidth', { configurable: true, get: () => geometry.clientWidth })
  if (!circular) Object.defineProperties(scroller, {
    scrollWidth: { configurable: true, get: () => geometry.scrollWidth },
    scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value } },
  })
  const move = (left: number) => { scrollLeft = Math.max(0, Math.min(left, geometry.scrollWidth - geometry.clientWidth)); fireEvent.scroll(scroller) }
  Object.defineProperty(scroller, 'scrollTo', { configurable: true, value: (options: ScrollToOptions | number) => move(typeof options === 'number' ? options : options.left ?? scrollLeft) })
  const cards = measurement ? Array.from(measurement.children) : Array.from(scroller.children)
  for (const card of cards) {
    const cardWidth = geometry.cardWidth ?? 100
    Object.defineProperty(card, 'offsetWidth', { configurable: true, get: () => cardWidth })
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: cardWidth, height: 180, top: 0, left: 0, right: cardWidth, bottom: 180, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  }
  if (!circular) fireEvent.scroll(scroller)
  act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
  return { viewport: parent, get scrollLeft() { return scrollLeft } }
}

function mainCards() {
  const currentRegion = region()
  return Array.from(currentRegion.querySelectorAll<HTMLElement>('[aria-label^="Livro"]')).filter((card) => {
    let node: HTMLElement | null = card
    while (node && node !== currentRegion) { if (node.getAttribute('aria-hidden') === 'true') return false; node = node.parentElement }
    return true
  })
}
function labels() { return mainCards().map((card) => card.getAttribute('aria-label')) }
function track() { return region().querySelector('[data-carousel-track="true"]') as HTMLElement }
function finishTransition() { fireEvent.transitionEnd(track()) }
function nextButton() { return screen.getAllByRole('button', { name: 'Próximo' })[0] }
function previousButton() { return screen.getAllByRole('button', { name: 'Anterior' })[0] }

describe('Carousel circular sem peeks', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback) }
      observe() {}
      disconnect() {}
    })
  })
  afterEach(() => { cleanup(); resizeCallbacks = []; vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13])('suporta qualquer quantidade de itens (%i)', (count) => {
    renderCarousel(count)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    expect(region()).toBeInTheDocument()
    expect(mainCards().every((card) => !card.closest('[aria-hidden="true"]'))).toBe(true)
  })

  it('não duplica itens quando todos cabem', () => {
    renderCarousel(3)
    configureGeometry({ clientWidth: 700, scrollWidth: 680, cardWidth: 100 })
    expect(mainCards()).toHaveLength(3)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(region().querySelector('[data-carousel-track="true"]')).not.toBeInTheDocument()
    expect(previousButton()).toBeDisabled()
    expect(nextButton()).toBeDisabled()
  })

  it('mostra quatro cards principais completos sem peeks laterais', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    expect(mainCards()).toHaveLength(4)
    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4'])
    expect(region().querySelectorAll('[aria-label^="Livro"]').length).toBeGreaterThan(mainCards().length)
  })

  it('mantém clones de animação fora da árvore acessível e sem foco', () => {
    renderCarousel(8)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    const hiddenCards = Array.from(region().querySelectorAll<HTMLElement>('[aria-hidden="true"] [aria-label^="Livro"]'))
    expect(hiddenCards.every((card) => card.tabIndex < 0 || card.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(mainCards().every((card) => !card.getAttribute('aria-hidden'))).toBe(true)
  })

  it('anima horizontalmente e avança/retrocede por grupo', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    const initial = track().style.transform
    fireEvent.click(nextButton())
    expect(track().style.transform).not.toBe(initial)
    expect(track().style.transition).toContain('transform')
    finishTransition()
    expect(labels()).toEqual(['Livro 5', 'Livro 6', 'Livro 7', 'Livro 8'])
    fireEvent.click(previousButton())
    expect(track().style.transition).toContain('transform')
    finishTransition()
    expect(labels()).toEqual(['Livro 1', 'Livro 2', 'Livro 3', 'Livro 4'])
  })

  it('aplica zoom e opacity sutis aos grupos durante a navegação', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    const carouselTrack = track()
    const currentPane = carouselTrack.children[1] as HTMLElement
    const nextPane = carouselTrack.children[2] as HTMLElement
    const currentCard = currentPane.querySelector('[data-carousel-card="true"]') as HTMLElement
    const nextCard = nextPane.querySelector('[data-carousel-card="true"]') as HTMLElement

    expect(currentCard.style.transform).toBe('scale(1)')
    fireEvent.click(nextButton())

    expect(currentCard.style.transform).toBe('scale(0.86)')
    expect(currentCard.style.opacity).toBe('0.72')
    expect(nextCard.style.transform).toBe('scale(0.86)')
    expect(nextCard.style.opacity).toBe('0.72')
    expect(carouselTrack.style.transition).toContain('280ms')
  })

  it('espelha a animação ao navegar para Anterior', () => {
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    fireEvent.click(previousButton())
    const carouselTrack = track()
    expect(carouselTrack.style.transform).toBe('translateX(0px)')
    expect((carouselTrack.children[0] as HTMLElement).querySelector('[data-carousel-card="true"]')?.getAttribute('style')).toContain('scale(0.86)')
    expect(carouselTrack.style.transition).toContain('280ms')
  })

  it('remove slide e zoom quando prefers-reduced-motion está ativo', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    renderCarousel(9)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    fireEvent.click(nextButton())
    const carouselTrack = track()
    const currentCard = (carouselTrack.children[1] as HTMLElement).querySelector('[data-carousel-card="true"]') as HTMLElement
    expect(carouselTrack.style.transition).toBe('none')
    expect(currentCard.style.transform).toBe('scale(1)')
    expect(currentCard.style.opacity).toBe('1')
  })

  it('circula modularmente e alcança todos os itens como principais', () => {
    renderCarousel(7)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    const seen = new Set<string>()
    for (let step = 0; step < 8; step += 1) { labels().forEach((label) => seen.add(label ?? '')); fireEvent.click(nextButton()); finishTransition() }
    expect(seen).toEqual(new Set(Array.from({ length: 7 }, (_, index) => `Livro ${index + 1}`)))
  })

  it('Anterior e setas do teclado preservam o foco', () => {
    renderCarousel(6)
    configureGeometry({ clientWidth: 480, scrollWidth: 1400, cardWidth: 100 })
    const currentRegion = region(); currentRegion.focus(); const initial = labels()
    fireEvent.keyDown(currentRegion, { key: 'ArrowRight' }); finishTransition()
    expect(document.activeElement).toBe(currentRegion)
    expect(labels()).not.toEqual(initial)
    fireEvent.keyDown(currentRegion, { key: 'ArrowLeft' }); finishTransition()
    expect(document.activeElement).toBe(currentRegion)
    expect(labels()).toEqual(initial)
  })

  it('recalcula cards completos ao redimensionar', () => {
    renderCarousel(9)
    const geometry = configureGeometry({ clientWidth: 400, scrollWidth: 1400, cardWidth: 100 })
    expect(mainCards()).toHaveLength(3)
    Object.defineProperty(geometry.viewport, 'clientWidth', { configurable: true, get: () => 480 })
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
    expect(mainCards()).toHaveLength(4)
    Object.defineProperty(geometry.viewport, 'clientWidth', { configurable: true, get: () => 400 })
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)))
    expect(mainCards()).toHaveLength(3)
  })
})
