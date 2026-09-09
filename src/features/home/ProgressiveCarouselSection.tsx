import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Carousel } from '@/components/ui/Carousel'

const PRELOAD_MARGIN = '0px 0px 600px 0px'

type ProgressiveCarouselSectionProps<T> = {
  title: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  measureItem?: (item: T, index: number) => ReactNode
  circular?: boolean
  emptyText?: string
  priority?: boolean
}

export function ProgressiveCarouselSection<T>({
  title,
  items,
  renderItem,
  measureItem,
  circular = false,
  emptyText,
  priority = false,
}: ProgressiveCarouselSectionProps<T>) {
  const sectionRef = useRef<HTMLElement>(null)
  const [activated, setActivated] = useState(priority)

  useEffect(() => {
    if (activated) return undefined
    const section = sectionRef.current
    if (!section) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setActivated(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActivated(true)
          observer.disconnect()
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [activated])

  if (activated) {
    return (
      <Carousel
        title={title}
        items={items}
        circular={circular}
        renderItem={renderItem}
        measureItem={measureItem}
        emptyText={emptyText}
      />
    )
  }

  const titleId = `deferred-carousel-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section ref={sectionRef} aria-labelledby={titleId} className="w-full">
      <h2 id={titleId} className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div aria-hidden="true" className="min-h-[20rem] rounded-xl bg-slate-50/60 dark:bg-slate-900/20" />
    </section>
  )
}
