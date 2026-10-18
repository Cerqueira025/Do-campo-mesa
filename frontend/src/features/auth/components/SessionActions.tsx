import Button from '../../../components/ui/Button'
import InternalLink from '../../../navigation/InternalLink'
import { navigate } from '../../../navigation/navigation'
import { useAuth } from '../useAuth'
import './SessionActions.scss'

export default function SessionActions() {
  const { estado, utilizador, sair } = useAuth()
  return <div className="session-actions">
    {estado === 'a-validar' ? <span role="status">A validar sessão…</span> : utilizador ? <>
      <InternalLink href="/conta">Olá, {utilizador.nome}</InternalLink>
      {utilizador.papel === 'administrador' && <InternalLink href="/admin/produtores">Validar produtores</InternalLink>}
      <Button variant="cream" onClick={() => { sair(); navigate('/') }}>Sair</Button>
    </> : estado === 'erro' ? <InternalLink href="/conta">Recuperar sessão</InternalLink> : <>
      <InternalLink href="/login">Iniciar sessão</InternalLink>
      <Button href="/registo" variant="cream">Criar conta</Button>
    </>}
  </div>
}
