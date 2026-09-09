import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RouteErrorFallback } from '@/components/feedback/ErrorBoundary'
import { HomePage, DiscoveryHome } from '@/features/home/HomePage'
import { AccountOnly, Protected, PublicOnly, RedirectBookCopies } from './RouteGuards'

const AccountPage = lazy(() => import('@/features/account/AccountPage').then((module) => ({ default: module.AccountPage })))
const AccountManagementPage = lazy(() => import('@/features/account/AccountManagementPage').then((module) => ({ default: module.AccountManagementPage })))
const BooksPage = lazy(() => import('@/features/books/BooksPage').then((module) => ({ default: module.BooksPage })))
const BookCreatePage = lazy(() => import('@/features/books/BookCreatePage').then((module) => ({ default: module.BookCreatePage })))
const BookDetailPage = lazy(() => import('@/features/books/BookDetailPage').then((module) => ({ default: module.BookDetailPage })))
const BookCopyCreatePage = lazy(() => import('@/features/books/BookCopyCreatePage').then((module) => ({ default: module.BookCopyCreatePage })))
const CopiesPage = lazy(() => import('@/features/copies/CopiesPage').then((module) => ({ default: module.CopiesPage })))
const LoansPage = lazy(() => import('@/features/loans/LoansPage').then((module) => ({ default: module.LoansPage })))
const ReservationsPage = lazy(() => import('@/features/reservations/ReservationsPage').then((module) => ({ default: module.ReservationsPage })))
const SchoolsPage = lazy(() => import('@/features/schools/SchoolsPage').then((module) => ({ default: module.SchoolsPage })))
const StudentsPage = lazy(() => import('@/features/students/StudentsPage').then((module) => ({ default: module.StudentsPage })))
const UsersPage = lazy(() => import('@/features/users/UsersPage').then((module) => ({ default: module.UsersPage })))
const ManageSchoolPage = lazy(() => import('@/features/schools/ManageSchoolPage').then((module) => ({ default: module.ManageSchoolPage })))

function RouteLoading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-[var(--color-text-muted)]">Carregando página…</div>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { path: '/', element: <Protected><LazyRoute><HomePage /></LazyRoute></Protected> },
      { path: '/inicio', element: <Protected><LazyRoute><DiscoveryHome /></LazyRoute></Protected> },
      {
        path: '/entrar',
        element: (
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        ),
      },
      {
        path: '/visitar/:schoolCode',
        element: <LoginPage />,
      },
      // Português — rotas principais
      {
        path: '/acervo',
        element: (
          <Protected>
            <LazyRoute><BooksPage /></LazyRoute>
          </Protected>
        ),
      },
      {
        path: '/acervo/novo',
        element: (
          <AccountOnly>
            <LazyRoute><BookCreatePage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/acervo/:bookId',
        element: (
          <Protected>
            <LazyRoute><BookDetailPage /></LazyRoute>
          </Protected>
        ),
      },
      {
        path: '/acervo/:bookId/exemplares/novo',
        element: (
          <AccountOnly>
            <LazyRoute><BookCopyCreatePage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/acervo/:bookId/exemplares',
        element: <RedirectBookCopies />,
      },
      {
        path: '/exemplares',
        element: (
          <AccountOnly>
            <LazyRoute><CopiesPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/emprestimos',
        element: (
          <AccountOnly>
            <LazyRoute><LoansPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/reservas',
        element: (
          <AccountOnly>
            <LazyRoute><ReservationsPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/escolas',
        element: (
          <AccountOnly>
            <LazyRoute><SchoolsPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/alunos',
        element: (
          <AccountOnly>
            <LazyRoute><StudentsPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/usuarios',
        element: (
          <AccountOnly>
            <LazyRoute><UsersPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/minha-conta',
        element: (
          <AccountOnly>
            <LazyRoute><AccountPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/minha-conta/gerenciar',
        element: (
          <AccountOnly>
            <LazyRoute><AccountManagementPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/gerenciar-escola',
        element: (
          <AccountOnly>
            <LazyRoute><ManageSchoolPage /></LazyRoute>
          </AccountOnly>
        ),
      },
      {
        path: '/regras-de-circulacao', element: <Navigate to="/gerenciar-escola?tab=rules" replace />,
      },
      {
        path: '/calendario-da-biblioteca', element: <Navigate to="/gerenciar-escola?tab=calendar" replace />,
      },
      // Redirects compatibilidade inglês → português
      { path: '/login', element: <Navigate to="/entrar" replace /> },
      { path: '/books', element: <Navigate to="/acervo" replace /> },
      { path: '/books/new', element: <Navigate to="/acervo/novo" replace /> },
      { path: '/copies', element: <Navigate to="/exemplares" replace /> },
      { path: '/loans', element: <Navigate to="/emprestimos" replace /> },
      { path: '/reservations', element: <Navigate to="/reservas" replace /> },
      { path: '/schools', element: <Navigate to="/escolas" replace /> },
      {
        path: '*',
        element: (
          <div className="py-16 text-center">
            <h1 className="text-2xl font-bold">Página não encontrada</h1>
            <p className="text-slate-500 mt-2">Verifique o endereço ou volte ao início.</p>
            <a href="/" className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">
              Voltar ao início
            </a>
          </div>
        ),
      },
    ],
  },
])
