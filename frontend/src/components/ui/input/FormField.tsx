import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { ReactNode } from 'react'
import './FormField.scss'

export interface FormFieldProps {
  id: string
  label: string
  icon?: IconDefinition
  hint?: string
  children: ReactNode
}

export default function FormField({ id, label, icon, hint, children }: FormFieldProps) {
  return <div className="form-field">
    <label className="form-field__label" htmlFor={id}>{label}</label>
    <div className="form-field__control">
      {icon && <FontAwesomeIcon className="form-field__icon" icon={icon} aria-hidden="true" />}
      {children}
    </div>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}
