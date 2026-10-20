import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder'
import { useAuth } from '../features/auth/useAuth'
import SessionNav from '../features/auth/components/SessionNav'
import type { AuthUser } from '../features/auth/auth'
import '../features/auth/AuthPage.scss'
import './ProducerApprovalPage.scss'

interface PendingProducer {
  _id: string
  nome: string
  email: string
  perfilProdutor: { descricao: string; localidade: string; morada: string; coordenadas: { latitude: number; longitude: number } }
}

export default function ProducerApprovalPage() {
  const { request } = useAuth()
  const [producers, setProducers] = useState<PendingProducer[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const previous = document.title
    document.title = 'Validar produtores · Do campo à mesa'
    return () => { document.title = previous }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const data = await request<PendingProducer[]>('/producers/pendentes', { signal: controller.signal })
        if (!controller.signal.aborted) { setProducers(data); setError('') }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os produtores.')
      }
    }
    void load()
    return () => controller.abort()
  }, [request, revision])

  async function decide(producer: PendingProducer, validacao: 'aceite' | 'rejeitado') {
    if (pending) return
    setPending(producer._id)
    setError('')
    setMessage('')
    try {
      await request<AuthUser>(`/producers/${producer._id}/validacao`, { method: 'PATCH', body: { validacao } })
      setProducers(previous => previous?.filter(item => item._id !== producer._id) ?? null)
      setMessage(`${producer.nome}: registo ${validacao}.`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível guardar a decisão.') }
    finally { setPending(null) }
  }

  return <main className="auth-page auth-page--wide"><section className="auth-panel"><SessionNav /><h1>Validar produtores</h1>
    <p>Analise os registos pendentes antes de permitir a publicação de produtos e a criação de leilões.</p>
    <p role="status">{message}</p>
    {error && <div role="alert" className="auth-error"><p>{error}</p><Button onClick={() => { setError(''); setRevision(value => value + 1) }}>Tentar novamente</Button></div>}
    {!producers && !error ? <LoadingPlaceholder label="A carregar produtores…" /> : producers?.length === 0 ? <p>Não há produtores por validar.</p> : <ul className="approval-list">{producers?.map(producer => <li key={producer._id}>
      <h2>{producer.nome}</h2><p>{producer.email}</p><p>{producer.perfilProdutor.localidade} · {producer.perfilProdutor.morada}</p>
      <p>Latitude: {producer.perfilProdutor.coordenadas.latitude} · Longitude: {producer.perfilProdutor.coordenadas.longitude}</p>
      {producer.perfilProdutor.descricao && <p>{producer.perfilProdutor.descricao}</p>}
      <div className="auth-actions" aria-busy={pending === producer._id}>
        <Button disabled={Boolean(pending)} onClick={() => void decide(producer, 'aceite')}>Aprovar</Button>
        <Button variant="cream" disabled={Boolean(pending)} onClick={() => void decide(producer, 'rejeitado')}>Rejeitar</Button>
      </div>
    </li>)}</ul>}
  </section></main>
}
