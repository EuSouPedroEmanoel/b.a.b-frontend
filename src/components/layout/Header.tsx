import { Moon, Sun, Menu, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { MobileNavigationPanel } from './MobileNavigationPanel'
import { useNavigationFocusIntent } from '../navigation/useNavigationFocusIntent'

function ActiveNavIndicator({ navRef, activeKey, mobile = false }: { navRef: RefObject<HTMLElement | null>; activeKey: string; mobile?: boolean }) {
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [animatedPosition, setAnimatedPosition] = useState(position)
  const hasAnimatedPosition = useRef(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return undefined
    const update = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) {
        setPosition((current) => ({ ...current, width: 0 }))
        return
      }
      const navRect = nav.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      setPosition({
        left: activeRect.left - navRect.left,
        top: activeRect.top - navRect.top,
        width: activeRect.width,
        height: activeRect.height,
      })
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(nav)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [activeKey, navRef])

  useLayoutEffect(() => {
    if (!mobile || !position.width) {
      setAnimatedPosition(position)
      return undefined
    }
    if (!hasAnimatedPosition.current) {
      hasAnimatedPosition.current = true
      setAnimatedPosition(position)
      return undefined
    }
    if (position.left === animatedPosition.left && position.top === animatedPosition.top && position.width === animatedPosition.width) return undefined

    setAnimatedPosition((current) => ({ ...current, width: 0 }))
    const moveTimer = window.setTimeout(() => {
      setAnimatedPosition((current) => ({ ...current, left: position.left, top: position.top, height: position.height }))
      window.requestAnimationFrame(() => setAnimatedPosition(position))
    }, 160)
    return () => window.clearTimeout(moveTimer)
  }, [mobile, position])

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute ${mobile ? '' : 'rounded-sm bg-white/80 dark:bg-slate-200'}`}
      style={{
        left: 0,
        top: mobile ? `${animatedPosition.top + 1}px` : `${animatedPosition.top + animatedPosition.height - 2}px`,
        width: mobile ? '0.125rem' : `${animatedPosition.width}px`,
        height: mobile ? `${Math.max(0, animatedPosition.height - 1)}px` : '2px',
        transform: `translateX(${animatedPosition.left}px)`,
        transition: reducedMotion ? 'none' : 'top 250ms ease-out, transform 250ms ease-out, width 150ms ease-out',
      }}
    >
      {mobile && <>
        <span className="absolute left-0 top-0 h-full w-0.5 bg-white/80 dark:bg-slate-200" />
      </>}
    </span>
  )
}

type DesktopNavigationMeasurementProps = {
  isAuthenticated: boolean
  isGuest: boolean
  isLibrarian: boolean
  isUsersManager: boolean
  profileLabel: string
  role?: string
  schoolName?: string | null
  schoolCode?: string | null
}

function DesktopNavigationMeasurement({ isAuthenticated, isGuest, isLibrarian, isUsersManager, profileLabel, role, schoolName, schoolCode }: DesktopNavigationMeasurementProps) {
  return (
    <div className="flex items-center gap-4 whitespace-nowrap">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg font-bold text-lg">BAB</span>
      <div className="flex items-center gap-1">
        <span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-semibold">Início</span>
        <span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Acervo</span>
        {!isGuest && <><span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Empréstimos</span><span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Reservas</span></>}
        {isLibrarian && <span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Alunos</span>}
        {isUsersManager && <span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Usuários</span>}
        {(role === 'school_admin' || isLibrarian) && <span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Gerenciar escola</span>}
        {role === 'super_admin' && <span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-medium">Escolas</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-11 w-11" />
        {isGuest ? <><span className="text-sm">Visitante · {schoolName ?? schoolCode ?? 'Escola selecionada'}</span><span className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium">Trocar escola</span><span className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium">Sair</span></> : isAuthenticated ? <><span className="inline-flex min-h-[44px] items-center px-3 py-2 text-sm">{profileLabel} <span className="ml-1 px-2 py-0.5 text-xs">{role}</span></span><span className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium">Sair</span></> : <span className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium">Entrar</span>}
      </div>
    </div>
  )
}

export function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const location = useLocation()
  const { registerMouseNavigation } = useNavigationFocusIntent()
  const [open, setOpen] = useState(false)
  const [desktopNavVisible, setDesktopNavVisible] = useState(() => window.innerWidth >= 768)

  const isActivePath = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(to + '/'))
  const navItemCls = (to: string) =>
    `inline-flex min-h-[44px] items-center border-b-2 border-transparent px-3 py-2 text-sm font-medium text-white/85 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 active:bg-white/15 dark:text-slate-200 ${
      isActivePath(to) ? 'border-white/80 bg-white/10 font-semibold text-white dark:border-slate-200 dark:bg-slate-800/80 dark:text-white' : 'hover:bg-white/10 hover:text-white dark:hover:bg-slate-800/70 dark:hover:text-white'
    }`

  const handleToggle = () => {
    const next = resolved === 'dark' ? 'claro' : 'escuro'
    toggle()
    announce(`Tema ${next} ativado`, 'polite')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/entrar')
  }

  const handleChangeSchool = async () => {
    await logout()
    navigate('/entrar')
  }

  const isUsersManager =
    !!user && (user.role === 'super_admin' || user.role === 'school_admin')
  const isLibrarian = user?.role === 'librarian'
  const isGuest = user?.role === 'guest'
  const homePath = user && ['student', 'teacher', 'guest'].includes(user.role) ? '/inicio' : '/'

  // Ações (Tema / Entrar / Sair) — mesmos tokens de estado que links, mas Sair mantém destaque outline/destrutivo suave
  const themeBtnCls =
    'inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 dark:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const secondaryActionCls =
    'px-4 py-2 text-sm font-medium rounded-md bg-white text-[#0f4c75] hover:bg-white/90 active:bg-white/80 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] inline-flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const logoutCls =
    'px-4 py-2 text-sm font-medium rounded-md border border-white/30 text-white hover:bg-white/15 active:bg-white/25 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700 min-h-[44px] inline-flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const profileLabel = user?.name ?? user?.username ?? 'Meu perfil'
  const desktopNavRef = useRef<HTMLElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const headerRowRef = useRef<HTMLDivElement>(null)
  const desktopMeasurementRef = useRef<HTMLDivElement>(null)
  const pendingNavigationFocusRef = useRef<{ surface: 'desktop' | 'mobile'; destination: string } | null>(null)
  const pointerNavigationRef = useRef<string | null>(null)

  const getNavigationDestination = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null
    const link = target.closest<HTMLAnchorElement>('nav a[href]')
    return link ? new URL(link.href).pathname : null
  }

  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const destination = getNavigationDestination(event.target)
    if (!destination) return
    pointerNavigationRef.current = destination
    registerMouseNavigation(destination)
  }

  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const destination = getNavigationDestination(event.target)
    if (!destination) return
    pointerNavigationRef.current = destination
    registerMouseNavigation(destination)
  }

  const focusMouseNavigationDestination = (destination: string) => {
    const inputId = destination === '/emprestimos'
      ? 'loan-internal-code'
      : destination === '/acervo'
        ? 'book-search'
        : null
    if (!inputId) return
    ;[0, 100, 300].forEach((delay) => {
      window.setTimeout(() => {
        if (window.location.pathname === destination) {
          document.getElementById(inputId)?.focus()
        }
      }, delay)
    })
  }

  const handleHeaderNavigationClick = (event: React.MouseEvent<HTMLElement>) => {
    const destination = getNavigationDestination(event.target)
    if (!destination) return
    if (pointerNavigationRef.current === destination) {
      pointerNavigationRef.current = null
      if (!desktopNavVisible) setOpen(false)
      focusMouseNavigationDestination(destination)
      return
    }
    pendingNavigationFocusRef.current = {
      surface: desktopNavVisible ? 'desktop' : 'mobile',
      destination,
    }
    if (!desktopNavVisible) setOpen(false)
  }

  useEffect(() => {
    const pendingFocus = pendingNavigationFocusRef.current
    if (!pendingFocus) return
    pendingNavigationFocusRef.current = null
    if (pendingFocus.destination !== location.pathname) return
    window.requestAnimationFrame(() => {
      if (pendingFocus.surface === 'mobile') {
        mobileMenuButtonRef.current?.focus()
        return
      }
      desktopNavRef.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.focus()
    })
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!open || desktopNavVisible) return undefined
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (mobileNavRef.current?.contains(target) || mobileMenuButtonRef.current?.contains(target)) return
      setOpen(false)
      window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus())
    }
    document.addEventListener('pointerdown', handlePointerDownOutside)
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside)
  }, [desktopNavVisible, open])

  useLayoutEffect(() => {
    const row = headerRowRef.current
    const measurement = desktopMeasurementRef.current
    if (!row || !measurement) return undefined
    const updateLayout = () => {
      const hasDesktopViewport = window.innerWidth >= 768
      setDesktopNavVisible(hasDesktopViewport && measurement.getBoundingClientRect().width <= row.clientWidth)
    }
    updateLayout()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateLayout)
    observer?.observe(row)
    observer?.observe(measurement)
    const fontSizeObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(updateLayout)
    fontSizeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font-size'] })
    const handleResize = () => updateLayout()
    window.addEventListener('resize', handleResize)
    return () => {
      observer?.disconnect()
      fontSizeObserver?.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [isAuthenticated, isGuest, isLibrarian, isUsersManager, profileLabel, user?.role, user?.school_code, user?.school_name])

  return (
    <header data-app-navbar onPointerDown={handleHeaderPointerDown} onMouseDown={handleHeaderMouseDown} onClick={handleHeaderNavigationClick} className="relative sticky top-0 z-40 bg-[#0f4c75] dark:bg-slate-900/95 backdrop-blur border-b border-[#0c3d5e] dark:border-slate-700 shadow-lg pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={headerRowRef} className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link to="/" className="flex items-center shrink-0" aria-label="Base de Acesso Bibliotecário — página inicial">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0f4c75] dark:bg-white dark:text-slate-900 font-bold text-lg shadow-sm" aria-hidden="true">
                BAB
              </span>
            </Link>

            {/* Desktop nav — links reais para navegação e leitura semântica. */}
            <nav ref={desktopNavRef} aria-label="Principal" className={`relative shrink-0 items-center ${desktopNavVisible ? 'flex' : 'hidden'}`}>
              <ActiveNavIndicator navRef={desktopNavRef} activeKey={location.pathname} />
              <ul className="flex items-center gap-1 list-none m-0 p-0">
                <li><Link to={homePath} aria-current={isActivePath(homePath) ? 'page' : undefined} className={navItemCls(homePath)}>Início</Link></li>
                <li><Link to="/acervo" aria-current={isActivePath('/acervo') ? 'page' : undefined} className={navItemCls('/acervo')}>Acervo</Link></li>
                {!isGuest && <li><Link to="/emprestimos" aria-current={isActivePath('/emprestimos') ? 'page' : undefined} className={navItemCls('/emprestimos')}>Empréstimos</Link></li>}
                {!isGuest && <li><Link to="/reservas" aria-current={isActivePath('/reservas') ? 'page' : undefined} className={navItemCls('/reservas')}>Reservas</Link></li>}
                {isLibrarian && (<li><Link to="/alunos" aria-current={isActivePath('/alunos') ? 'page' : undefined} className={navItemCls('/alunos')}>Alunos</Link></li>)}
                {isUsersManager && (<li><Link to="/usuarios" aria-current={isActivePath('/usuarios') ? 'page' : undefined} className={navItemCls('/usuarios')}>Usuários</Link></li>)}
                {(user?.role === 'school_admin' || isLibrarian) && (<li><Link to="/gerenciar-escola" aria-current={isActivePath('/gerenciar-escola') ? 'page' : undefined} className={navItemCls('/gerenciar-escola')}>Gerenciar escola</Link></li>)}
                {user?.role === 'super_admin' && (<li><Link to="/escolas" aria-current={isActivePath('/escolas') ? 'page' : undefined} className={navItemCls('/escolas')}>Escolas</Link></li>)}
              </ul>
            </nav>
          </div>

          <div
            className={`shrink-0 items-center gap-2 ${desktopNavVisible ? 'flex' : 'hidden'}`}
            role="toolbar"
            aria-label="Ações da conta"
            aria-orientation="horizontal"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
              const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a'))
              const idx = els.indexOf(document.activeElement as HTMLElement)
              if (idx === -1) return
              e.preventDefault()
              let next = idx
              if (e.key === 'ArrowRight') next = (idx + 1) % els.length
              if (e.key === 'ArrowLeft') next = (idx - 1 + els.length) % els.length
              if (e.key === 'Home') next = 0
              if (e.key === 'End') next = els.length - 1
              els[next]?.focus()
            }}
          >
            <span className="hidden lg:block mx-1 h-6 w-px bg-white/20 dark:bg-slate-600" aria-hidden="true" />
            <button
              type="button"
              onClick={handleToggle}
              aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={resolved === 'dark'}
              title={resolved === 'dark' ? 'Modo escuro (clique para claro)' : 'Modo claro (clique para escuro)'}
              className={themeBtnCls}
            >
              {resolved === 'dark' ? <Sun className="h-5 w-5 transition-transform duration-300 rotate-0" aria-hidden="true" /> : <Moon className="h-5 w-5 transition-transform duration-300" aria-hidden="true" />}
            </button>
            {isGuest ? (
              <>
                <span className="hidden lg:inline text-sm text-white/90 dark:text-slate-300" aria-live="polite">
                  Visitante · {user?.school_name ?? user?.school_code ?? 'Escola selecionada'}
                </span>
                <button type="button" onClick={handleChangeSchool} className={secondaryActionCls}>Trocar escola</button>
                <button type="button" onClick={handleLogout} className={logoutCls}>Sair</button>
              </>
            ) : isAuthenticated ? (
              <>
                <Link
                  to="/minha-conta"
                  aria-label={`Ver perfil de ${profileLabel}`}
                  aria-current={isActivePath('/minha-conta') ? 'page' : undefined}
                  className="hidden lg:inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm text-left text-white/90 hover:bg-white/15 hover:text-white dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                >
                  <span aria-live="polite">
                    {isGuest ? 'Visitante' : profileLabel}{' '}
                    <span className="text-xs bg-white/20 dark:bg-slate-700 px-2 py-0.5 rounded-full ml-1">{isGuest ? 'acesso temporário' : user?.role}</span>
                  </span>
                </Link>
                <button type="button" onClick={handleLogout} className={logoutCls}>
                  Sair
                </button>
              </>
            ) : (
              <Link to="/entrar" className={secondaryActionCls}>
                Entrar
              </Link>
            )}
          </div>

          <div className={`${desktopNavVisible ? 'hidden' : 'flex'} shrink-0 items-center gap-2`} role="group" aria-label="Ações da conta">
            <button
              type="button"
              onClick={handleToggle}
              aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={resolved === 'dark'}
              className={themeBtnCls}
            >
              {resolved === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button
              ref={mobileMenuButtonRef}
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 text-white dark:border-slate-600 dark:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 active:bg-white/20"
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div ref={desktopMeasurementRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 -z-10 w-max opacity-0">
          <DesktopNavigationMeasurement
            isAuthenticated={isAuthenticated}
            isGuest={isGuest}
            isLibrarian={isLibrarian}
            isUsersManager={isUsersManager}
            profileLabel={profileLabel}
            role={user?.role}
            schoolName={user?.school_name}
            schoolCode={user?.school_code}
          />
        </div>

        {open && !desktopNavVisible && (
          <MobileNavigationPanel ref={mobileNavRef}>
            <ActiveNavIndicator navRef={mobileNavRef} activeKey={location.pathname} mobile />
            <ul className="flex flex-col gap-1 list-none m-0 p-0 [&>li>a:hover]:!bg-transparent [&>li>a:hover]:!text-inherit dark:[&>li>a:hover]:!bg-transparent dark:[&>li>a:hover]:!text-inherit">
              <li><Link to={homePath} aria-current={isActivePath(homePath) ? 'page' : undefined} className={`${navItemCls(homePath)} w-full justify-start hover:bg-transparent hover:text-inherit dark:hover:bg-transparent dark:hover:text-inherit`}>Início</Link></li>
              <li><Link to="/acervo" aria-current={isActivePath('/acervo') ? 'page' : undefined} className={`${navItemCls('/acervo')} w-full justify-start hover:bg-transparent hover:text-inherit dark:hover:bg-transparent dark:hover:text-inherit`}>Acervo</Link></li>
              {!isGuest && <li><Link to="/emprestimos" aria-current={isActivePath('/emprestimos') ? 'page' : undefined} className={`${navItemCls('/emprestimos')} w-full justify-start`}>Empréstimos</Link></li>}
              {!isGuest && <li><Link to="/reservas" aria-current={isActivePath('/reservas') ? 'page' : undefined} className={`${navItemCls('/reservas')} w-full justify-start`}>Reservas</Link></li>}
              {isLibrarian && (<li><Link to="/alunos" aria-current={isActivePath('/alunos') ? 'page' : undefined} className={`${navItemCls('/alunos')} w-full justify-start`}>Alunos</Link></li>)}
              {isUsersManager && (<li><Link to="/usuarios" aria-current={isActivePath('/usuarios') ? 'page' : undefined} className={`${navItemCls('/usuarios')} w-full justify-start`}>Usuários</Link></li>)}
              {(user?.role === 'school_admin' || isLibrarian) && (<li><Link to="/gerenciar-escola" aria-current={isActivePath('/gerenciar-escola') ? 'page' : undefined} className={`${navItemCls('/gerenciar-escola')} w-full justify-start`}>Gerenciar escola</Link></li>)}
              {user?.role === 'super_admin' && (<li><Link to="/escolas" aria-current={isActivePath('/escolas') ? 'page' : undefined} className={`${navItemCls('/escolas')} w-full justify-start`}>Escolas</Link></li>)}
              {!isGuest && <li><Link to="/minha-conta" aria-current={isActivePath('/minha-conta') ? 'page' : undefined} className={`${navItemCls('/minha-conta')} w-full justify-start`}>Ver perfil</Link></li>}
            </ul>
            <div role="group" aria-label="Ações da conta" className="flex flex-col gap-1 pt-2">
              {isGuest ? (
                <>
                  <p className="px-3 py-2 text-sm text-white/90 dark:text-slate-300 break-words">
                    Visitante · {user?.school_name ?? user?.school_code ?? 'Escola selecionada'}
                  </p>
                  <button type="button" onClick={handleChangeSchool} className={`w-full md:w-fit ${secondaryActionCls} justify-center`}>Trocar escola</button>
                  <button type="button" onClick={handleLogout} className={`w-full md:w-fit ${logoutCls} justify-center`}>Sair</button>
                </>
              ) : isAuthenticated ? (
                <button type="button" onClick={handleLogout} className={`w-full md:w-fit ${logoutCls} justify-center`}>Sair ({isGuest ? 'Visitante' : user?.name ?? user?.username})</button>
              ) : (
                <Link to="/entrar" className={`w-full md:w-fit ${secondaryActionCls} justify-center`}>Entrar</Link>
              )}
            </div>
          </MobileNavigationPanel>
        )}
      </div>
    </header>
  )
}
