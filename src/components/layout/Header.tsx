import { Moon, Sun, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'

export function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const isActivePath = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(to + '/'))
  const navItemCls = (to: string) =>
    `px-3 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 active:bg-white/20 ${
      isActivePath(to) ? 'bg-white text-[#0f4c75] dark:bg-white dark:text-slate-900' : 'text-white/90 hover:bg-white/15 hover:text-white dark:text-slate-200 dark:hover:bg-slate-800'
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

  // Ações (Tema / Entrar / Sair) — mesmos tokens de estado que links, mas Sair mantém destaque outline/destrutivo suave
  const themeBtnCls =
    'inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 dark:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const secondaryActionCls =
    'px-4 py-2 text-sm font-medium rounded-md bg-white text-[#0f4c75] hover:bg-white/90 active:bg-white/80 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] inline-flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const logoutCls =
    'px-4 py-2 text-sm font-medium rounded-md border border-white/30 text-white hover:bg-white/15 active:bg-white/25 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700 min-h-[44px] inline-flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'

  return (
    <header className="sticky top-0 z-40 bg-[#0f4c75] dark:bg-slate-900/95 backdrop-blur border-b border-[#0c3d5e] dark:border-slate-700 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Biblioteca Ginásio — página inicial">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0f4c75] dark:bg-white dark:text-slate-900 font-bold text-lg shadow-sm" aria-hidden="true">
              BG
            </span>
            <span className="hidden sm:block font-semibold text-white dark:text-white leading-none">
              Biblioteca
              <br />
              <span className="text-xs font-normal text-white/80 dark:text-slate-400">Ginásio</span>
            </span>
          </Link>

          {/* Desktop nav — links reais para navegação e leitura semântica. */}
          {!isGuest && <nav aria-label="Principal" className="hidden md:flex items-center">
            <ul className="flex items-center gap-1 list-none m-0 p-0">
              {!isGuest && <li><Link to="/" aria-current={isActivePath('/') ? 'page' : undefined} className={navItemCls('/')}>Início</Link></li>}
              <li><Link to="/acervo" aria-current={isActivePath('/acervo') ? 'page' : undefined} className={navItemCls('/acervo')}>Acervo</Link></li>
              {!isGuest && <li><Link to="/emprestimos" aria-current={isActivePath('/emprestimos') ? 'page' : undefined} className={navItemCls('/emprestimos')}>Empréstimos</Link></li>}
              {!isGuest && <li><Link to="/reservas" aria-current={isActivePath('/reservas') ? 'page' : undefined} className={navItemCls('/reservas')}>Reservas</Link></li>}
              {isLibrarian && (<li><Link to="/alunos" aria-current={isActivePath('/alunos') ? 'page' : undefined} className={navItemCls('/alunos')}>Alunos</Link></li>)}
              {isUsersManager && (<li><Link to="/usuarios" aria-current={isActivePath('/usuarios') ? 'page' : undefined} className={navItemCls('/usuarios')}>Usuários</Link></li>)}
              {user?.role === 'super_admin' && (<li><Link to="/escolas" aria-current={isActivePath('/escolas') ? 'page' : undefined} className={navItemCls('/escolas')}>Escolas</Link></li>)}
            </ul>
          </nav>}

          <div
            className="hidden md:flex items-center gap-2"
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
                <span className="text-sm text-white/90 dark:text-slate-300 hidden lg:inline" aria-live="polite">
                  {isGuest ? 'Visitante' : user?.username} <span className="text-xs bg-white/20 dark:bg-slate-700 px-2 py-0.5 rounded-full ml-1" aria-hidden="true">{isGuest ? 'acesso temporário' : user?.role}</span>
                </span>
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

          <div className="md:hidden flex items-center gap-2" role="group" aria-label="Ações da conta">
            {isGuest && <span className="max-w-[9rem] truncate text-xs text-white/90" aria-label={`Visitante na escola ${user?.school_name ?? user?.school_code ?? 'selecionada'}`}>Visitante · {user?.school_name ?? user?.school_code}</span>}
            <button
              type="button"
              onClick={handleToggle}
              aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={resolved === 'dark'}
              className={themeBtnCls}
            >
              {resolved === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            {!isGuest && <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 text-white dark:border-slate-600 dark:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 active:bg-white/20"
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
            </>}
            {isGuest && <button type="button" onClick={handleChangeSchool} className={`${secondaryActionCls} px-3`}>Trocar escola</button>}
            {isGuest && <button type="button" onClick={handleLogout} className={`${logoutCls} px-3`}>Sair</button>}
          </div>
        </div>

        {open && !isGuest && (
          <nav id="mobile-nav" aria-label="Principal móvel" className="md:hidden pb-4 flex flex-col gap-1">
            <ul className="flex flex-col gap-1 list-none m-0 p-0">
              {!isGuest && <li><Link to="/" aria-current={isActivePath('/') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/')}>Início</Link></li>}
              <li><Link to="/acervo" aria-current={isActivePath('/acervo') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/acervo')}>Acervo</Link></li>
              {!isGuest && <li><Link to="/emprestimos" aria-current={isActivePath('/emprestimos') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/emprestimos')}>Empréstimos</Link></li>}
              {!isGuest && <li><Link to="/reservas" aria-current={isActivePath('/reservas') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/reservas')}>Reservas</Link></li>}
              {isLibrarian && (<li><Link to="/alunos" aria-current={isActivePath('/alunos') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/alunos')}>Alunos</Link></li>)}
              {isUsersManager && (<li><Link to="/usuarios" aria-current={isActivePath('/usuarios') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/usuarios')}>Usuários</Link></li>)}
              {user?.role === 'super_admin' && (<li><Link to="/escolas" aria-current={isActivePath('/escolas') ? 'page' : undefined} onClick={() => setOpen(false)} className={navItemCls('/escolas')}>Escolas</Link></li>)}
            </ul>
            <div role="group" aria-label="Ações da conta" className="flex flex-col gap-1 pt-2">
              {isAuthenticated ? (
                <button type="button" onClick={handleLogout} className={`w-full ${logoutCls} justify-center`}>Sair ({isGuest ? 'Visitante' : user?.username})</button>
              ) : (
                <Link to="/entrar" onClick={() => setOpen(false)} className={`w-full ${secondaryActionCls} justify-center`}>Entrar</Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
