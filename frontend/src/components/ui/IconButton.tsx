import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './IconButton.scss'

type IconButtonVariant = 'primary' | 'secondary' | 'cream' | 'product' | 'plain'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: ReactNode
  variant?: IconButtonVariant
  'aria-label': string
}

function IconButton({
  'aria-label': ariaLabel,
  className = '',
  icon,
  variant = 'primary',
  type = 'button',
  ...buttonProps
}: IconButtonProps) {
  const classes = ['icon-button', `icon-button--${variant}`, className].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      type={type}
      aria-label={ariaLabel}
      {...buttonProps}
    >
      {icon}
    </button>
  )
}

export default IconButton
