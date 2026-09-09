import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-secondary' | 'blue-secondary'
  size?: 'sm' | 'md' | 'lg'
}

export const buttonVariantClasses = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700',
  secondary: 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white',
  ghost: 'bg-transparent hover:bg-[var(--color-surface-muted)] dark:hover:bg-slate-800 text-[var(--color-text)] dark:text-slate-300',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  'danger-secondary': 'bg-white border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-red-50 hover:text-red-900 dark:bg-slate-800 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200',
  'blue-secondary': 'bg-blue-800 border border-blue-900 text-white hover:bg-blue-900 hover:text-white dark:bg-blue-900 dark:border-blue-700 dark:text-blue-50 dark:hover:bg-blue-950 dark:hover:text-white',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'primary', size = 'md', className = '', ...props }, ref) {
  const base =
    'inline-flex cursor-pointer items-center justify-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-busy:opacity-80 min-h-[44px] min-w-[44px] focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  const variants = buttonVariantClasses
  return <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
})
