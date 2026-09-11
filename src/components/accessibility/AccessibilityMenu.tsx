import { PersonStanding, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type Side = 'left' | 'right'

type StoredPreference = {
  side?: Side
  top?: number
  textScale?: number
}

const STORAGE_KEY = 'bab-accessibility-preferences'
const FONT_SIZE_LEVELS = [100, 150, 200] as const
type FontSizeLevel = typeof FONT_SIZE_LEVELS[number]
const DEFAULT_SCALE: FontSizeLevel = 100
const BUTTON_SIZE = 48
const VIEWPORT_MARGIN = 12
const NAVBAR_GAP = 12
const DRAG_THRESHOLD = 6
const SNAP_DURATION = 250
const MIN_IMPACT_OVERSHOOT = 4
const MAX_IMPACT_OVERSHOOT = 16
const MAX_DRAG_SPEED = 1.2

function readPreferences(storageKey = STORAGE_KEY): Required<StoredPreference> {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as StoredPreference
    return {
      side: stored.side === 'left' || stored.side === 'right' ? stored.side : 'right',
      top: Number.isFinite(stored.top) ? stored.top! : 0.5,
      textScale: FONT_SIZE_LEVELS.includes(stored.textScale as FontSizeLevel)
        ? stored.textScale as FontSizeLevel
        : DEFAULT_SCALE,
    }
  } catch {
    return { side: 'right', top: 0.5, textScale: DEFAULT_SCALE }
  }
}

function clampTop(top: number) {
  const navbar = document.querySelector<HTMLElement>('[data-app-navbar]')
  const navbarBottom = navbar?.getBoundingClientRect().bottom ?? 0
  const minimumTop = Math.max(VIEWPORT_MARGIN, navbarBottom + NAVBAR_GAP)
  return Math.min(Math.max(top, minimumTop), Math.max(minimumTop, window.innerHeight - BUTTON_SIZE - VIEWPORT_MARGIN))
}

function initialLeft(side: Side) {
  return side === 'left' ? VIEWPORT_MARGIN : window.innerWidth - BUTTON_SIZE - VIEWPORT_MARGIN
}

export function AccessibilityMenu() {
  const { user } = useAuth()
  const preferenceKey = user?.id ? `${STORAGE_KEY}:user:${user.id}` : `${STORAGE_KEY}:guest`
  const initial = readPreferences(preferenceKey)
  const [side, setSide] = useState<Side>(initial.side)
  const [left, setLeft] = useState(() => initialLeft(initial.side))
  const [top, setTop] = useState(() => clampTop(initial.top <= 1 ? (window.innerHeight - BUTTON_SIZE) * initial.top : initial.top))
  const [textScale, setTextScale] = useState<FontSizeLevel>(initial.textScale as FontSizeLevel)
  const [previewScale, setPreviewScale] = useState<FontSizeLevel>(initial.textScale as FontSizeLevel)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [snapping, setSnapping] = useState(false)
  const [suppressExpansion, setSuppressExpansion] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const confirmScaleRef = useRef<HTMLButtonElement>(null)
  const scaleSliderRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [panelHeight, setPanelHeight] = useState(0)
  const animationRef = useRef(0)
  const snapAnimationRef = useRef<Animation | null>(null)
  const loadedPreferenceKey = useRef(preferenceKey)
  const skipPersistenceRef = useRef(false)
  const suppressClickRef = useRef(false)
  const pendingSnapRef = useRef<{ id: number; originLeft: number; side: Side; speed: number } | null>(null)
  const dragRef = useRef({ pointerId: -1, startX: 0, startY: 0, startTop: 0, startLeft: 0, lastX: 0, lastY: 0, lastTime: 0, speed: 0, moved: false })

  useEffect(() => {
    if (loadedPreferenceKey.current === preferenceKey) return
    const next = readPreferences(preferenceKey)
    loadedPreferenceKey.current = preferenceKey
    skipPersistenceRef.current = true
    setSide(next.side)
    setLeft(initialLeft(next.side))
    setTop(clampTop(next.top <= 1 ? (window.innerHeight - BUTTON_SIZE) * next.top : next.top))
    setTextScale(next.textScale as FontSizeLevel)
    setPreviewScale(next.textScale as FontSizeLevel)
  }, [preferenceKey])

  const persist = useCallback((next: Partial<StoredPreference>) => {
    const current = readPreferences(preferenceKey)
    localStorage.setItem(preferenceKey, JSON.stringify({ ...current, side, top, textScale, ...next }))
  }, [preferenceKey, side, textScale, top])

  useEffect(() => {
    if (skipPersistenceRef.current) {
      skipPersistenceRef.current = false
      return
    }
    document.documentElement.dataset.fontSize = String(textScale)
    persist({ textScale })
  }, [persist, textScale])

  useEffect(() => {
    setTop((current) => clampTop(current))
    const handleResize = () => {
      setTop((current) => {
        const next = clampTop(current)
        if (next !== current) persist({ top: next })
        return next
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [persist])

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return undefined
    const update = () => setPanelHeight(panelRef.current?.getBoundingClientRect().height ?? 0)
    update()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(panelRef.current)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [open, textScale])

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  const closeMenu = () => {
    setOpen(false)
    requestAnimationFrame(() => buttonRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return undefined
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('pointerdown', handlePointerDownOutside)
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside)
  }, [open])

  useLayoutEffect(() => {
    const pending = pendingSnapRef.current
    const button = buttonRef.current
    if (!pending || !button) return

    const targetLeft = button.getBoundingClientRect().left
    const distance = pending.originLeft - targetLeft
    const intensity = Math.min(1, pending.speed / MAX_DRAG_SPEED)
    const overshoot = MIN_IMPACT_OVERSHOOT
      + (MAX_IMPACT_OVERSHOOT - MIN_IMPACT_OVERSHOOT) * intensity
    const direction = pending.side === 'right' ? 1 : -1

    pendingSnapRef.current = null
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSnapping(false)
      return
    }

    const animation = button.animate(
      [
        { transform: `translateX(${distance}px) scale(1, 1)` },
        {
          transform: `translateX(${direction * overshoot}px) scale(${1 + 0.12 * intensity}, ${1 - 0.06 * intensity})`,
          offset: 0.65,
        },
        { transform: 'translateX(0) scale(1, 1)' },
      ],
      {
        duration: SNAP_DURATION,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
    )
    snapAnimationRef.current = animation
    void animation.finished.catch(() => undefined).then(() => {
      if (animationRef.current !== pending.id) return
      snapAnimationRef.current = null
      setSnapping(false)
    })
  }, [dragging, side, top])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    suppressClickRef.current = false
    animationRef.current += 1
    snapAnimationRef.current?.cancel()
    snapAnimationRef.current = null
    pendingSnapRef.current = null
    setSnapping(false)
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTop: top, startLeft: initialLeft(side), lastX: event.clientX, lastY: event.clientY, lastTime: performance.now(), speed: 0, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (distance < DRAG_THRESHOLD) return
    const previousX = drag.lastX
    const previousY = drag.lastY
    const previousTime = drag.lastTime
    const now = performance.now()
    if (!drag.moved) {
      drag.startX = event.clientX
      drag.startY = event.clientY
      drag.startLeft = event.clientX - BUTTON_SIZE / 2
      drag.startTop = event.clientY - BUTTON_SIZE / 2
    }
    drag.moved = true
    setDragging(true)
    setSuppressExpansion(true)
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    drag.speed = Math.min(MAX_DRAG_SPEED, Math.hypot(event.clientX - previousX, event.clientY - previousY) / Math.max(now - previousTime, 1))
    drag.lastTime = now
    const nextLeft = drag.startLeft + event.clientX - drag.startX
    const nextTop = clampTop(drag.startTop + event.clientY - drag.startY)
    const button = buttonRef.current
    if (button) {
      button.style.left = `${nextLeft}px`
      button.style.right = 'auto'
      button.style.top = `${nextTop}px`
    }
    setLeft(nextLeft)
    setTop(nextTop)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return
    if (drag.moved) {
      suppressClickRef.current = true
      setSuppressExpansion(true)
      const nextSide = event.clientX < window.innerWidth / 2 ? 'left' : 'right'
      const nextTop = clampTop(drag.startTop + event.clientY - drag.startY)
      startSnap(nextSide, nextTop, drag.speed)
      setDragging(false)
    } else {
      setSuppressExpansion(false)
    }
    dragRef.current.pointerId = -1
  }

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setOpen((current) => !current)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setOpen((current) => !current)
  }

  const moveSide = () => {
    const nextSide = side === 'left' ? 'right' : 'left'
    setSide(nextSide)
    persist({ side: nextSide })
  }

  const updateScale = (next: FontSizeLevel) => setPreviewScale(next)
  const previewIndex = FONT_SIZE_LEVELS.indexOf(previewScale)
  const applyPreviewScale = () => {
    setTextScale(previewScale)
    requestAnimationFrame(() => scaleSliderRef.current?.focus())
  }

  const startSnap = (nextSide: Side, nextTop: number, speed: number) => {
    const button = buttonRef.current
    const id = ++animationRef.current
    const originLeft = button?.getBoundingClientRect().left ?? left
    pendingSnapRef.current = { id, originLeft, side: nextSide, speed }
    setSide(nextSide)
    setLeft(initialLeft(nextSide))
    setTop(nextTop)
    setSnapping(true)
    persist({ side: nextSide, top: nextTop })
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Fechar menu de acessibilidade' : 'Abrir menu de acessibilidade'}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        aria-expanded={open}
        aria-controls="accessibility-panel"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={() => {
          if (dragRef.current.pointerId !== -1) setDragging(false)
        }}
        onPointerCancel={() => {
          if (dragRef.current.moved) {
            suppressClickRef.current = true
            const nextSide = dragRef.current.lastX < window.innerWidth / 2 ? 'left' : 'right'
            const nextTop = clampTop(top)
            startSnap(nextSide, nextTop, dragRef.current.speed)
          }
          setDragging(false)
          dragRef.current.pointerId = -1
        }}
        onPointerLeave={() => setSuppressExpansion(false)}
        className={`accessibility-trigger group fixed z-[60] flex h-12 w-12 aspect-square touch-none select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-blue-900 bg-blue-800 text-white leading-none shadow-md outline-none transition-[top,left,right,width,border-radius,transform,background-color,box-shadow,opacity] duration-200 hover:bg-blue-900 hover:text-white active:bg-blue-900 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-50 dark:hover:bg-blue-950 dark:hover:text-white ${open ? 'pointer-events-none opacity-0' : ''} ${side === 'left' ? 'flex-row-reverse' : ''} ${dragging ? '!cursor-grabbing gap-0 transition-none' : suppressExpansion || snapping ? '!cursor-pointer gap-0' : '!cursor-pointer gap-0 focus-visible:w-40 focus-visible:gap-2 focus-visible:rounded-xl'}`}
        style={dragging ? { top, left } : { top, [side]: VIEWPORT_MARGIN }}
      >
        <PersonStanding aria-hidden="true" className="block h-8 w-8 shrink-0" strokeWidth={2.5} />
        {!dragging && !suppressExpansion && (
          <span className="accessibility-trigger-label max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-150 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">
            Acessibilidade
          </span>
        )}
      </button>

      {open && (
        <section
          ref={panelRef}
          id="accessibility-panel"
          aria-labelledby="accessibility-panel-title"
          className={`fixed z-[70] max-h-[calc(100dvh-1.5rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-500 bg-white p-4 text-slate-900 shadow-xl dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100 ${side === 'left' ? 'left-4' : 'right-4'}`}
          style={{ top: Math.min(top, Math.max(VIEWPORT_MARGIN, window.innerHeight - (panelHeight || 310) - VIEWPORT_MARGIN)) }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="accessibility-panel-title" className="text-lg font-semibold">Acessibilidade</h2>
            <button ref={closeRef} type="button" aria-label="Fechar menu de acessibilidade" onClick={closeMenu} className="rounded-md p-1 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
            <fieldset>
              <legend className="font-medium">Tamanho do texto</legend>
              <div className="mt-3 flex items-start gap-2 text-sm font-semibold">
                <button
                  type="button"
                  aria-label="Diminuir fonte"
                  aria-disabled={previewIndex === 0}
                  onClick={() => { if (previewIndex > 0) updateScale(FONT_SIZE_LEVELS[previewIndex - 1]) }}
                  className="accessibility-decrease-label inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 font-semibold transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-slate-500 dark:hover:border-blue-300 dark:hover:bg-slate-700 dark:hover:text-blue-200 dark:active:bg-slate-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                >
                  A−
                </button>
                <div className="min-w-0 flex-1">
                  <div className="relative flex min-h-12 items-center px-1">
                    <div aria-hidden="true" className="pointer-events-none absolute left-3 right-3 top-1/2 flex -translate-y-1/2 justify-between">
                      {FONT_SIZE_LEVELS.map((level) => <span key={level} className={`h-3 w-3 rounded-full border-2 ${previewScale === level ? 'border-blue-700 bg-blue-700 dark:border-blue-300 dark:bg-blue-300' : 'border-slate-400 bg-white dark:border-slate-400 dark:bg-slate-800'}`} />)}
                    </div>
                    <input
                      ref={scaleSliderRef}
                      type="range"
                      min="0"
                      max={FONT_SIZE_LEVELS.length - 1}
                      step="1"
                      value={previewIndex}
                      aria-label="Tamanho do texto"
                      aria-valuetext={`${previewScale} por cento`}
                      onChange={(event) => setPreviewScale(FONT_SIZE_LEVELS[Number(event.target.value)])}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          confirmScaleRef.current?.focus()
                        }
                      }}
                      className="accessibility-font-slider relative z-10 w-full"
                    />
                  </div>
                  <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">{previewScale}%</p>
                  <p className="mt-1 text-center font-medium leading-tight text-slate-900 dark:text-slate-100" style={{ fontSize: `${previewScale / 100}rem` }}>Livro</p>
                </div>
                <button
                  type="button"
                  aria-label="Aumentar fonte"
                  aria-disabled={previewIndex === FONT_SIZE_LEVELS.length - 1}
                  onClick={() => { if (previewIndex < FONT_SIZE_LEVELS.length - 1) updateScale(FONT_SIZE_LEVELS[previewIndex + 1]) }}
                  className="accessibility-increase-label inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 font-semibold transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-slate-500 dark:hover:border-blue-300 dark:hover:bg-slate-700 dark:hover:text-blue-200 dark:active:bg-slate-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                >
                  A+
                </button>
              </div>
              <button ref={confirmScaleRef} type="button" onClick={applyPreviewScale} disabled={previewScale === textScale} className="mt-3 w-full rounded-xl border border-blue-700 bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-blue-700 dark:text-white dark:hover:bg-blue-800">
                Confirmar tamanho
              </button>
            </fieldset>
          </div>
          <button type="button" onClick={moveSide} className="mt-4 w-full rounded-md border px-3 py-2 text-left text-sm font-medium">
            Mover botão para a {side === 'left' ? 'direita' : 'esquerda'}
          </button>
        </section>
      )}
    </>
  )
}
