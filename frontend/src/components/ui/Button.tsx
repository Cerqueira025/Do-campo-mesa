import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import InternalLink from '../../navigation/InternalLink'
import './Button.scss'

type ButtonVariant = 'primary' | 'secondary' | 'cream'
interface Appearance {
  children: ReactNode
  icon?: IconDefinition
  variant?: ButtonVariant
  iconPosition?: 'start' | 'end'
  className?: string
}
type ButtonProps = Appearance & (
  (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }) |
  (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
)

function Button({ children, className = '', icon, variant = 'primary', iconPosition = 'start', ...props }: ButtonProps) {
  const classes = ['btn', 'button', `button--${variant}`, className].filter(Boolean).join(' ')
  const content = <>
    {icon && iconPosition === 'start' && <FontAwesomeIcon className="button__icon" icon={icon} aria-hidden="true" />}
    <span>{children}</span>
    {icon && iconPosition === 'end' && <FontAwesomeIcon className="button__icon" icon={icon} aria-hidden="true" />}
  </>
  if (props.href !== undefined) return <InternalLink {...props} className={classes}>{content}</InternalLink>
  return <button type="button" {...props} className={classes}>{content}</button>
}

export default Button
