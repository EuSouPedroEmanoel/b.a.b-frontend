import { describe, expect, it } from 'vitest'
import { segmentedControlContainerClasses, segmentedControlItemClasses } from '@/components/ui/SegmentedControl'

describe('SegmentedControl styles', () => {
  it('uses space-responsive columns instead of fixed halves or clipping', () => {
    expect(segmentedControlContainerClasses).toContain('auto-fit')
    expect(segmentedControlContainerClasses).toContain('minmax(min(100%,20ch),1fr)')
    expect(segmentedControlContainerClasses).not.toContain('overflow-hidden')
    expect(segmentedControlContainerClasses).not.toContain('grid-cols-2')
    expect(segmentedControlItemClasses(false)).toContain('min-w-0')
    expect(segmentedControlItemClasses(false)).toContain('whitespace-normal')
    expect(segmentedControlItemClasses(false)).toContain('break-words')
  })

  it('applies selection styling directly to the selected item', () => {
    const selected = segmentedControlItemClasses(true, 'primary')
    const unselected = segmentedControlItemClasses(false, 'primary')

    expect(selected).toContain('bg-[var(--color-primary)]')
    expect(selected).toContain('text-white')
    expect(unselected).toContain('bg-[var(--color-surface)]')
    expect(selected).not.toContain('bg-transparent')
  })
})
