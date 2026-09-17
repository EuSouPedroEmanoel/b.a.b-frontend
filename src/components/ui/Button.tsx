import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from './Button.styles'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-secondary' | 'blue-secondary'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'primary', size = 'md', className = '', ...props }, ref) {
  const variants = buttonVariantClasses
  return <button ref={ref} className={`${buttonBaseClasses} ${buttonSizeClasses[size]} ${variants[variant]} ${className}`} {...props} />
})
