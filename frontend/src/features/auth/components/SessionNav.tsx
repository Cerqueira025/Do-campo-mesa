import InternalLink from '../../../navigation/InternalLink'
import SessionActions from './SessionActions'
import './SessionNav.scss'

export default function SessionNav() {
  return <header className="session-nav"><nav className="session-nav__inner" aria-label="Navegação da conta">
    <InternalLink href="/" className="session-nav__brand">Do campo à mesa</InternalLink>
    <SessionActions />
  </nav></header>
}
