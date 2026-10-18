import { lazy, Suspense, type ReactNode } from 'react'

export const AccountPage = lazy(() => import('@/features/account/AccountPage').then((module) => ({ default: module.AccountPage })))
export const AccountManagementPage = lazy(() => import('@/features/account/AccountManagementPage').then((module) => ({ default: module.AccountManagementPage })))
export const PrivacyCenterPage = lazy(() => import('@/features/privacy/PrivacyCenterPage').then((module) => ({ default: module.PrivacyCenterPage })))
export const BooksPage = lazy(() => import('@/features/books/BooksPage').then((module) => ({ default: module.BooksPage })))
export const BookCreatePage = lazy(() => import('@/features/books/BookCreatePage').then((module) => ({ default: module.BookCreatePage })))
export const BookDetailPage = lazy(() => import('@/features/books/BookDetailPage').then((module) => ({ default: module.BookDetailPage })))
export const BookEditPage = lazy(() => import('@/features/books/BookEditPage').then((module) => ({ default: module.BookEditPage })))
export const BookCopyCreatePage = lazy(() => import('@/features/books/BookCopyCreatePage').then((module) => ({ default: module.BookCopyCreatePage })))
export const CopiesPage = lazy(() => import('@/features/copies/CopiesPage').then((module) => ({ default: module.CopiesPage })))
export const LoansPage = lazy(() => import('@/features/loans/LoansPage').then((module) => ({ default: module.LoansPage })))
export const ReservationsPage = lazy(() => import('@/features/reservations/ReservationsPage').then((module) => ({ default: module.ReservationsPage })))
export const SchoolsPage = lazy(() => import('@/features/schools/SchoolsPage').then((module) => ({ default: module.SchoolsPage })))
export const UsersPage = lazy(() => import('@/features/users/UsersPage').then((module) => ({ default: module.UsersPage })))
export const ManageSchoolPage = lazy(() => import('@/features/schools/ManageSchoolPage').then((module) => ({ default: module.ManageSchoolPage })))

export function RouteLoading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-[var(--color-text-muted)]">Carregando página…</div>
}

export function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>
}
