import { useState, type FormEvent } from 'react'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import Button from '../../components/ui/Button'
import InternalLink from '../../navigation/InternalLink'
import AuthLayout from '../../features/auth/components/AuthLayout'
import InputField from '../../components/ui/input/InputField'
import PasswordField from '../../components/ui/input/PasswordField'
import { authHref, passwordError, safeReturnPath } from '../../features/auth/auth'
import { resetPassword } from '../../features/auth/authService'
import './AuthForm.scss'

export default function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search)
  const regresso = safeReturnPath(params.get('regresso'))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [savedEmail, setSavedEmail] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    const invalidPassword = passwordError(password, String(data.get('confirmation') || ''))
    if (invalidPassword) { setError(invalidPassword); return }
    setPending(true)
    setError('')
    try { await resetPassword(email, password); setSavedEmail(email) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível guardar a nova password.') }
    finally { setPending(false) }
  }

  return <AuthLayout documentTitle="Recuperar password" error={error}
    title={<>Defina uma nova <span className="auth-layout__accent">password</span></>}>
    {savedEmail !== null ? <div className="auth-form">
      <p role="status">A sua password foi atualizada. Já pode iniciar sessão com a nova password.</p>
      <Button variant="dark" className="auth-form__submit" href={authHref('/login', { email: savedEmail, regresso })}>Ir para o login</Button>
    </div> : <form className="auth-form" onSubmit={submit} aria-busy={pending}>
      <fieldset className="auth-form__fields" disabled={pending}>
        <legend className="auth-form__legend">Nova password</legend>
        <InputField id="reset-email" label="Email" icon={faEnvelope} name="email" type="email" autoComplete="email" required defaultValue={params.get('email') || ''} />
        <PasswordField id="reset-password" name="password" label="Nova password" autoComplete="new-password" required minLength={8} hint="Pelo menos 8 caracteres e até 72 bytes em UTF-8." />
        <PasswordField id="reset-confirmation" name="confirmation" label="Confirmar nova password" autoComplete="new-password" required />
        <Button type="submit" variant="dark" className="auth-form__submit">{pending ? 'A guardar…' : 'Guardar nova password'}</Button>
      </fieldset>
      <div className="auth-form__links"><InternalLink href={authHref('/login', { email: params.get('email') || '', regresso })}>Voltar ao login</InternalLink></div>
    </form>}
  </AuthLayout>
}
