import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './IconButton.scss'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: ReactNode
  'aria-label': string
}

function IconButton({
  'aria-label': ariaLabel,
  className = '',
  icon,
  type = 'button',
  ...buttonProps
}: IconButtonProps) {
  const classes = ['icon-button', className].filter(Boolean).join(' ')

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
