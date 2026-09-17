import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Link } from 'react-router-dom'
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from './Button.styles'

type Props = ComponentPropsWithoutRef<typeof Link> & {
  variant?: keyof typeof buttonVariantClasses
  size?: keyof typeof buttonSizeClasses
}

export const ButtonLink = forwardRef<HTMLAnchorElement, Props>(function ButtonLink({ variant = 'primary', size = 'md', className = '', ...props }, ref) {
  return <Link ref={ref} className={`${buttonBaseClasses} ${buttonSizeClasses[size]} ${buttonVariantClasses[variant]} ${className}`} {...props} />
})
