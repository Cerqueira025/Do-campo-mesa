import { useState, type ComponentProps } from 'react'
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import IconButton from '../IconButton'
import InputField from './InputField'

type Props = Omit<ComponentProps<typeof InputField>, 'type' | 'icon' | 'action'>

export default function PasswordField({ label, ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return <InputField {...props} label={label} icon={faLock} type={visible ? 'text' : 'password'}
    action={<IconButton variant="plain" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible}
      disabled={props.disabled} onClick={() => setVisible(value => !value)}
      icon={<FontAwesomeIcon icon={visible ? faEyeSlash : faEye} aria-hidden="true" />} />} />
}
