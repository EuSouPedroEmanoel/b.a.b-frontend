import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { buttonVariantClasses } from './Button.styles'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-secondary' | 'blue-secondary'
  size?: 'sm' | 'md' | 'lg'
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
