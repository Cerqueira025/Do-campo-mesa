import FormField from "../../components/ui/input/FormField";
import { useState, type FormEvent } from "react";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import Button from "../../components/ui/Button";
import InternalLink from "../../navigation/InternalLink";
import AuthLayout from "../../features/auth/components/AuthLayout";
import { useAuthRedirect } from "../../features/auth/useAuthRedirect";
import { authHref, safeReturnPath } from "../../features/auth/auth";
import "./AuthForm.scss";

export default function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const regresso = safeReturnPath(params.get("regresso"));
  const { entrar, estado } = useAuthRedirect(regresso);
  const [email, setEmail] = useState(params.get("email") || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      await entrar(
        String(data.get("email") || "").trim(),
        String(data.get("password") || ""),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível iniciar sessão.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      documentTitle="Iniciar sessão"
      error={error}
      title={
        <>
          Inicie <span className="auth-layout__accent">sessão</span> para
          continuar
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <fieldset
          className="auth-form__fields"
          disabled={pending || estado === "a-validar"}
        >
          <legend className="auth-form__legend">Dados de acesso</legend>
          <FormField
            id="login-email"
            label="Email"
            icon={faEnvelope}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="email@exemplo.pt"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FormField
            type="password"
            id="login-password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
          />
          <Button type="submit" variant="dark" className="auth-form__submit">
            {pending ? "A entrar…" : "Entrar"}
          </Button>
        </fieldset>
        <div className="auth-form__links">
          <p>
            Ainda não tem conta?{" "}
            <InternalLink href={authHref("/registo", { email, regresso })}>
              Criar conta
            </InternalLink>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
