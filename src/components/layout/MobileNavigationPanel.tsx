import { forwardRef, type ReactNode } from 'react'

type MobileNavigationPanelProps = {
  children: ReactNode
}

export const MobileNavigationPanel = forwardRef<HTMLElement, MobileNavigationPanelProps>(
  function MobileNavigationPanel({ children }, ref) {
    return (
      <nav
        ref={ref}
        id="mobile-nav"
        aria-label="Principal móvel"
        className="absolute left-1/2 top-full z-40 mt-2 flex w-screen -translate-x-1/2 flex-col gap-1 rounded-xl border border-[#0c3d5e] bg-[#0b5278] px-4 pb-4 pt-2 shadow-2xl dark:border-slate-600 dark:bg-slate-800 sm:px-6 lg:px-8 md:left-auto md:right-8 md:translate-x-0 md:w-1/2"
      >
        {children}
      </nav>
    )
  },
)
