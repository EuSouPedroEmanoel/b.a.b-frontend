import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { BooksPage } from '@/features/books/BooksPage'
import { BookCreatePage } from '@/features/books/BookCreatePage'
import { BookDetailPage } from '@/features/books/BookDetailPage'
import { BookCopyCreatePage } from '@/features/books/BookCopyCreatePage'
import { CopiesPage } from '@/features/copies/CopiesPage'
import { LoansPage } from '@/features/loans/LoansPage'
import { ReservationsPage } from '@/features/reservations/ReservationsPage'
import { SchoolsPage } from '@/features/schools/SchoolsPage'
import { StudentsPage } from '@/features/students/StudentsPage'
import { UsersPage } from '@/features/users/UsersPage'
import { RouteErrorFallback } from '@/components/feedback/ErrorBoundary'
import { AccountOnly, Protected, PublicOnly, RedirectBookCopies } from './RouteGuards'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { path: '/', element: <AccountOnly><DashboardPage /></AccountOnly> },
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
            <BooksPage />
          </Protected>
        ),
      },
      {
        path: '/acervo/novo',
        element: (
          <AccountOnly>
            <BookCreatePage />
          </AccountOnly>
        ),
      },
      {
        path: '/acervo/:bookId',
        element: (
          <Protected>
            <BookDetailPage />
          </Protected>
        ),
      },
      {
        path: '/acervo/:bookId/exemplares/novo',
        element: (
          <AccountOnly>
            <BookCopyCreatePage />
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
            <CopiesPage />
          </AccountOnly>
        ),
      },
      {
        path: '/emprestimos',
        element: (
          <AccountOnly>
            <LoansPage />
          </AccountOnly>
        ),
      },
      {
        path: '/reservas',
        element: (
          <AccountOnly>
            <ReservationsPage />
          </AccountOnly>
        ),
      },
      {
        path: '/escolas',
        element: (
          <AccountOnly>
            <SchoolsPage />
          </AccountOnly>
        ),
      },
      {
        path: '/alunos',
        element: (
          <AccountOnly>
            <StudentsPage />
          </AccountOnly>
        ),
      },
      {
        path: '/usuarios',
        element: (
          <AccountOnly>
            <UsersPage />
          </AccountOnly>
        ),
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
