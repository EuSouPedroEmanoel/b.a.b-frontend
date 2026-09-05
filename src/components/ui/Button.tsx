import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-secondary'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'primary', size = 'md', className = '', ...props }, ref) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-busy:opacity-80 min-h-[44px] min-w-[44px] focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2'
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  const variants = {
    primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
    secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    'danger-secondary': 'bg-white border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-red-50 hover:text-red-900 dark:bg-slate-800 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200',
  }
  return <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
})
