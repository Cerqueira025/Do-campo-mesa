import { useEffect } from 'react'
import Button from '../components/ui/Button'
import { useAuth } from '../features/auth/useAuth'
import SessionNav from '../features/auth/components/SessionNav'
import '../features/auth/AuthPage.scss'
import './AccountPage.scss'

const approvalText = {
  pendente: 'O seu registo aguarda aprovação. Poderá publicar produtos e criar leilões depois de ser aprovado.',
  aceite: 'O seu registo de produtor está aprovado.',
  rejeitado: 'O seu registo de produtor foi rejeitado. Não pode publicar produtos nem criar leilões.',
}

export default function AccountPage() {
  const { utilizador, atualizar } = useAuth()
  useEffect(() => {
    const previous = document.title
    document.title = 'A minha conta · Do campo à mesa'
    return () => { document.title = previous }
  }, [])
  if (!utilizador) return null
  return <main className="auth-page"><section className="auth-panel"><SessionNav /><h1>A minha conta</h1>
    <dl className="auth-details"><div><dt>Nome</dt><dd>{utilizador.nome}</dd></div><div><dt>Email</dt><dd>{utilizador.email}</dd></div>
      <div><dt>Tipo de conta</dt><dd>{utilizador.papel}</dd></div></dl>
    {utilizador.papel === 'produtor' && <section aria-labelledby="approval-title"><h2 id="approval-title">Validação do produtor</h2><p role="status">{approvalText[utilizador.validacao || 'pendente']}</p><Button onClick={atualizar}>Atualizar estado</Button></section>}
    {utilizador.papel === 'administrador' && <Button href="/admin/produtores">Validar produtores</Button>}
  </section></main>
}
