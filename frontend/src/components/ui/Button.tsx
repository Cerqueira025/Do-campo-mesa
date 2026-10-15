import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.scss'

type ButtonVariant = 'primary' | 'secondary' | 'cream'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  icon?: IconDefinition
  variant?: ButtonVariant
  iconPosition?: 'start' | 'end'
}

function Button({
  children,
  className = '',
  icon,
  type = 'button',
  variant = 'primary',
  iconPosition = 'start',
  ...buttonProps
}: ButtonProps) {
  const classes = ['btn', 'button', `button--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} type={type} {...buttonProps}>
      {icon && iconPosition === 'start' && <FontAwesomeIcon className="button__icon" icon={icon} aria-hidden="true" />}
      <span>{children}</span>
      {icon && iconPosition === 'end' && <FontAwesomeIcon className="button__icon" icon={icon} aria-hidden="true" />}
    </button>
  )
}

export default Button
