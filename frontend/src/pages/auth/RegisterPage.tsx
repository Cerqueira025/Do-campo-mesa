import { useState, type FormEvent } from 'react'
import { faEnvelope, faUser, faLocationDot, faHouse } from '@fortawesome/free-solid-svg-icons'
import Button from '../../components/ui/Button'
import InternalLink from '../../navigation/InternalLink'
import AuthLayout from '../../features/auth/components/AuthLayout'
import InputField from '../../components/ui/input/InputField'
import FormField from '../../components/ui/input/FormField'
import PasswordField from '../../components/ui/input/PasswordField'
import { useAuthRedirect } from '../../features/auth/useAuthRedirect'
import { authHref, passwordError, safeReturnPath, type Registration } from '../../features/auth/auth'
import { register } from '../../features/auth/authService'
import './AuthForm.scss'

export default function RegisterPage() {
  const params = new URLSearchParams(window.location.search)
  const regresso = safeReturnPath(params.get('regresso'))
  const { entrar, estado } = useAuthRedirect(regresso)
  const [role, setRole] = useState<'comprador' | 'produtor'>(params.get('papel') === 'produtor' ? 'produtor' : 'comprador')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const text = (name: string) => String(data.get(name) || '')
    const email = text('email').trim()
    const password = text('password')
    const invalidPassword = passwordError(password, text('confirmation'))
    if (invalidPassword) { setError(invalidPassword); return }
    setError('')
    setPending(true)
    let registered = false
    try {
      const body: Registration = { nome: text('nome').trim(), email, password, papel: role }
      if (role === 'produtor') body.perfilProdutor = {
        descricao: text('descricao').trim(), localidade: text('localidade').trim(), morada: text('morada').trim(),
        coordenadas: { latitude: Number(text('latitude')), longitude: Number(text('longitude')) },
      }
      await register(body)
      registered = true
      await entrar(email, password)
    } catch (failure) {
      if (registered) setCreatedEmail(email)
      setError(registered ? 'A conta foi criada, mas não foi possível iniciar sessão. Entre com o email e a password que escolheu.'
        : failure instanceof Error ? failure.message : 'Não foi possível criar a conta.')
    } finally { setPending(false) }
  }

  return <AuthLayout documentTitle="Criar conta" error={error}
    title={<>Crie a sua <span className="auth-layout__accent">conta</span></>}>
    {createdEmail !== null ? <Button variant="dark" href={authHref('/login', { email: createdEmail, regresso })}>Ir para o login</Button> :
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <fieldset className="auth-form__fields" disabled={pending || estado === 'a-validar'}>
          <legend className="auth-form__legend">Dados de registo</legend>
          <InputField id="register-name" label="Nome" icon={faUser} name="nome" autoComplete="name" required minLength={2} maxLength={100} />
          <FormField id="register-role" label="Tipo de conta"><select id="register-role" name="papel" value={role} onChange={event => setRole(event.target.value as typeof role)}>
            <option value="comprador">Comprador</option><option value="produtor">Produtor</option>
          </select></FormField>
          <InputField id="register-email" label="Email" icon={faEnvelope} name="email" type="email" autoComplete="email" required defaultValue={params.get('email') || ''} />
          <PasswordField id="register-password" name="password" label="Password" autoComplete="new-password" required minLength={8} hint="Pelo menos 8 caracteres e até 72 bytes em UTF-8." />
          <PasswordField id="register-confirmation" name="confirmation" label="Confirmar password" autoComplete="new-password" required />
          {role === 'produtor' && <>
            <p className="auth-form__note">A conta de produtor precisa de aprovação antes de publicar produtos ou criar leilões.</p>
            <FormField id="register-description" label="Descrição da exploração (opcional)"><textarea id="register-description" name="descricao" rows={3} /></FormField>
            <InputField id="register-locality" label="Localidade" icon={faLocationDot} name="localidade" autoComplete="address-level2" required />
            <InputField id="register-address" label="Morada" icon={faHouse} name="morada" autoComplete="street-address" required />
            <div className="auth-form__coordinates">
              <InputField id="register-latitude" label="Latitude" name="latitude" type="number" step="any" min={-90} max={90} required />
              <InputField id="register-longitude" label="Longitude" name="longitude" type="number" step="any" min={-180} max={180} required />
            </div>
          </>}
          <Button type="submit" variant="dark" className="auth-form__submit">{pending ? 'A criar conta…' : 'Criar conta'}</Button>
        </fieldset>
        <div className="auth-form__links"><p>Já tem conta? <InternalLink href={authHref('/login', { regresso })}>Iniciar sessão</InternalLink></p></div>
      </form>}
  </AuthLayout>
}
