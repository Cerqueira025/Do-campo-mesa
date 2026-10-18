import { useEffect, type ReactNode } from 'react'
import Button from '../../components/ui/Button'
import LoadingPlaceholder from '../../components/ui/LoadingPlaceholder'
import { useLocation } from '../../navigation/useLocation'
import { navigate } from '../../navigation/navigation'
import { useAuth } from './useAuth'
import type { Role } from './auth'
import './AuthPage.scss'

export default function ProtectedRoute({ roles = [], children }: { roles?: Role[]; children: ReactNode }) {
  const { estado, utilizador, erro, atualizar, sair } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (estado === 'anonimo') navigate(`/login?regresso=${encodeURIComponent(location)}`, { replace: true })
  }, [estado, location])

  if (estado === 'a-validar' || estado === 'anonimo') return <main className="auth-page"><LoadingPlaceholder label="A validar sessão…" /></main>
  if (estado === 'erro') return <main className="auth-page"><section className="auth-panel" role="alert"><h1>Sessão indisponível</h1><p>{erro}</p>
    <div className="auth-actions"><Button onClick={atualizar}>Tentar novamente</Button><Button variant="cream" onClick={sair}>Terminar sessão</Button></div>
  </section></main>
  if (roles.length && (!utilizador || !roles.includes(utilizador.papel))) return <main className="auth-page"><section className="auth-panel"><h1>Sem permissão</h1><p>A sua conta não tem acesso a esta página.</p><Button href="/">Voltar ao catálogo</Button></section></main>
  return children
}
