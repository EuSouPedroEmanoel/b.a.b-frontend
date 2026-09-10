import { Minus, PersonStanding, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

type Side = 'left' | 'right'

type StoredPreference = {
  side?: Side
  top?: number
  textScale?: number
}

const STORAGE_KEY = 'bab-accessibility-preferences'
const MIN_SCALE = 0.9
const MAX_SCALE = 1.2
const DEFAULT_SCALE = 1
const BUTTON_SIZE = 48
const VIEWPORT_MARGIN = 12
const DRAG_THRESHOLD = 6

function readPreferences(): Required<StoredPreference> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as StoredPreference
    return {
      side: stored.side === 'left' || stored.side === 'right' ? stored.side : 'right',
      top: Number.isFinite(stored.top) ? stored.top! : 0.5,
      textScale: Number.isFinite(stored.textScale) && stored.textScale! >= MIN_SCALE && stored.textScale! <= MAX_SCALE
        ? stored.textScale!
        : DEFAULT_SCALE,
    }
  } catch {
    return { side: 'right', top: 0.5, textScale: DEFAULT_SCALE }
  }
}

function clampTop(top: number) {
  return Math.min(Math.max(top, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, window.innerHeight - BUTTON_SIZE - VIEWPORT_MARGIN))
}

export function AccessibilityMenu() {
  const initial = readPreferences()
  const [side, setSide] = useState<Side>(initial.side)
  const [top, setTop] = useState(() => clampTop(initial.top <= 1 ? (window.innerHeight - BUTTON_SIZE) * initial.top : initial.top))
  const [textScale, setTextScale] = useState(initial.textScale)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [suppressExpansion, setSuppressExpansion] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef({ pointerId: -1, startX: 0, startY: 0, startTop: 0, moved: false })

  const persist = useCallback((next: Partial<StoredPreference>) => {
    const current = readPreferences()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, side, top, textScale, ...next }))
  }, [side, textScale, top])

  useEffect(() => {
    document.documentElement.style.fontSize = `${textScale * 100}%`
    persist({ textScale })
    return () => { document.documentElement.style.fontSize = '' }
  }, [persist, textScale])

  useEffect(() => {
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

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startTop: top, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (distance < DRAG_THRESHOLD) return
    drag.moved = true
    setDragging(true)
    setSuppressExpansion(true)
    setTop(clampTop(drag.startTop + event.clientY - drag.startY))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return
    if (drag.moved) {
      const nextSide = event.clientX < window.innerWidth / 2 ? 'left' : 'right'
      setSide(nextSide)
      persist({ side: nextSide, top: clampTop(top) })
      setDragging(false)
    } else {
      setOpen((current) => !current)
      setSuppressExpansion(false)
    }
    dragRef.current.pointerId = -1
  }

  const moveSide = () => {
    const nextSide = side === 'left' ? 'right' : 'left'
    setSide(nextSide)
    persist({ side: nextSide })
  }

  const updateScale = (next: number) => setTextScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)))

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Fechar menu de acessibilidade' : 'Abrir menu de acessibilidade'}
        aria-expanded={open}
        aria-controls="accessibility-panel"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { setDragging(false); dragRef.current.pointerId = -1 }}
        onPointerLeave={() => setSuppressExpansion(false)}
        className={`group fixed z-50 flex h-12 w-12 aspect-square touch-none select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-blue-900 bg-blue-800 text-white leading-none shadow-md outline-none transition-[top,left,right,width,border-radius,transform,background-color,box-shadow] duration-200 hover:bg-blue-900 hover:text-white active:bg-blue-900 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-50 dark:hover:bg-blue-950 dark:hover:text-white ${dragging ? 'cursor-grabbing gap-0 transition-none' : suppressExpansion ? 'cursor-grab gap-0 transition-none' : 'cursor-grab gap-0 hover:w-40 hover:gap-2 focus-visible:w-40 focus-visible:gap-2 hover:rounded-xl focus-visible:rounded-xl'}`}
        style={{ top, [side]: VIEWPORT_MARGIN }}
      >
        <PersonStanding aria-hidden="true" className="block h-8 w-8 shrink-0" strokeWidth={2.5} />
        {!dragging && !suppressExpansion && (
          <span className="max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-150 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">
            Acessibilidade
          </span>
        )}
      </button>

      {open && (
        <section
          id="accessibility-panel"
          aria-labelledby="accessibility-panel-title"
          className={`fixed z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${side === 'left' ? 'left-4' : 'right-4'}`}
          style={{ top: Math.min(top, Math.max(VIEWPORT_MARGIN, window.innerHeight - 310)) }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="accessibility-panel-title" className="text-lg font-semibold">Acessibilidade</h2>
            <button ref={closeRef} type="button" aria-label="Fechar menu de acessibilidade" onClick={() => setOpen(false)} className="rounded-md p-1 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
            <p className="font-medium">Tamanho do texto</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" aria-label="Diminuir tamanho do texto" onClick={() => updateScale(textScale - 0.05)} disabled={textScale <= MIN_SCALE} className="rounded-md border p-2"><Minus aria-hidden="true" className="h-4 w-4" /></button>
              <button type="button" onClick={() => updateScale(DEFAULT_SCALE)} disabled={textScale === DEFAULT_SCALE} className="flex-1 rounded-md border px-3 py-2 text-sm"><RotateCcw aria-hidden="true" className="mr-1 inline h-4 w-4" />Padrão</button>
              <button type="button" aria-label="Aumentar tamanho do texto" onClick={() => updateScale(textScale + 0.05)} disabled={textScale >= MAX_SCALE} className="rounded-md border p-2"><Plus aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          </div>
          <button type="button" onClick={moveSide} className="mt-4 w-full rounded-md border px-3 py-2 text-left text-sm font-medium">
            Mover botão para a {side === 'left' ? 'direita' : 'esquerda'}
          </button>
        </section>
      )}
    </>
  )
}
