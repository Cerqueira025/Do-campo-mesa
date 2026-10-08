import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.scss'

type ButtonVariant = 'primary' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  icon: IconDefinition
  variant?: ButtonVariant
}

function Button({
  children,
  className = '',
  icon,
  type = 'button',
  variant = 'primary',
  ...buttonProps
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} type={type} {...buttonProps}>
      <FontAwesomeIcon className="button__icon" icon={icon} aria-hidden="true" />
      <span>{children}</span>
    </button>
  )
}

export default Button
