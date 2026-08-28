import { Moon, Sun, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAnnouncer } from '@/components/feedback/LiveRegion'

export function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleToggle = () => {
    const next = resolved === 'dark' ? 'claro' : 'escuro'
    toggle()
    announce(`Tema ${next} ativado`, 'polite')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/entrar')
  }

  const isUsersManager =
    !!user && (user.role === 'super_admin' || user.role === 'school_admin')
  const isLibrarian = user?.role === 'librarian'

  // Links: no claro (header azul) texto branco, no escuro slate padrão
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] ${
      isActive
        ? 'bg-white text-[#0f4c75] dark:bg-white dark:text-slate-900'
        : 'text-white/90 hover:bg-white/15 hover:text-white dark:text-slate-200 dark:hover:bg-slate-800'
    }`

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

          {/* Desktop nav */}
          <nav aria-label="Principal" className="hidden md:flex items-center gap-1">
            <NavLink to="/" className={linkCls}>
              Início
            </NavLink>
            <NavLink to="/acervo" className={linkCls}>
              Acervo
            </NavLink>
            <NavLink to="/emprestimos" className={linkCls}>
              Empréstimos
            </NavLink>
            <NavLink to="/reservas" className={linkCls}>
              Reservas
            </NavLink>
            {isLibrarian && (
              <NavLink to="/alunos" className={linkCls}>
                Alunos
              </NavLink>
            )}
            {isUsersManager && (
              <NavLink to="/usuarios" className={linkCls}>
                Usuários
              </NavLink>
            )}
            {user?.role === 'super_admin' && (
              <NavLink to="/escolas" className={linkCls}>
                Escolas
              </NavLink>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={resolved === 'dark'}
              title={resolved === 'dark' ? 'Modo escuro (clique para claro)' : 'Modo claro (clique para escuro)'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/20 text-white dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 min-w-[44px] transition-colors"
            >
              {resolved === 'dark' ? <Sun className="h-5 w-5 transition-transform duration-300 rotate-0" aria-hidden="true" /> : <Moon className="h-5 w-5 transition-transform duration-300" aria-hidden="true" />}
            </button>
            {isAuthenticated ? (
              <>
                <span className="text-sm text-white/90 dark:text-slate-300 hidden lg:inline" aria-live="polite">
                  {user?.username} <span className="text-xs bg-white/20 dark:bg-slate-700 px-2 py-0.5 rounded-full ml-1">{user?.role}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-white/30 text-white hover:bg-white/15 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[44px] transition-colors"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link to="/entrar" className="px-4 py-2 text-sm font-medium rounded-md bg-white text-[#0f4c75] hover:bg-white/90 dark:bg-white dark:text-slate-900 min-h-[44px] inline-flex items-center transition-colors">
                Entrar
              </Link>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={resolved === 'dark'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white dark:border-slate-600 dark:bg-slate-800 min-w-[44px]"
            >
              {resolved === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 text-white dark:border-slate-600 dark:text-slate-200"
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Principal móvel" className="md:hidden pb-4 flex flex-col gap-1">
            <NavLink to="/" onClick={() => setOpen(false)} className={linkCls}>
              Início
            </NavLink>
            <NavLink to="/acervo" onClick={() => setOpen(false)} className={linkCls}>
              Acervo
            </NavLink>
            <NavLink to="/emprestimos" onClick={() => setOpen(false)} className={linkCls}>
              Empréstimos
            </NavLink>
            <NavLink to="/reservas" onClick={() => setOpen(false)} className={linkCls}>
              Reservas
            </NavLink>
            {isLibrarian && (
              <NavLink to="/alunos" onClick={() => setOpen(false)} className={linkCls}>
                Alunos
              </NavLink>
            )}
            {isUsersManager && (
              <NavLink to="/usuarios" onClick={() => setOpen(false)} className={linkCls}>
                Usuários
              </NavLink>
            )}
            <NavLink to="/escolas" onClick={() => setOpen(false)} className={linkCls}>
              Escolas
            </NavLink>
            <div className="pt-2 border-t border-white/20 dark:border-slate-700 mt-2">
              {isAuthenticated ? (
                <button type="button" onClick={handleLogout} className="w-full px-3 py-2.5 text-left rounded-md border border-white/20 text-white dark:border-slate-600 dark:text-slate-200 min-h-[44px]">
                  Sair ({user?.username})
                </button>
              ) : (
                <Link to="/entrar" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-md bg-white text-[#0f4c75] text-center min-h-[44px] font-medium">
                  Entrar
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
