import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import AdminLayout from "./AdminLayout";
import Button from "../../components/ui/Button";

const backofficeUrl =
  import.meta.env.VITE_BACKOFFICE_URL || "http://127.0.0.1:8000";

export default function BackofficeEntry() {
  const { request } = useAuth();
  const started = useRef(false);
  const state = new URLSearchParams(window.location.search).get("state");
  const validState = state !== null && /^[a-f0-9]{64}$/.test(state);
  const [error, setError] = useState(
    validState ? "" : "Abra o backoffice pelo botão Serviços e sistema.",
  );
  useEffect(() => {
    if (started.current || !validState || state === null) return;
    started.current = true;
    void request<{ code: string }>("/admin/backoffice/codes", {
      method: "POST",
      body: { state },
    })
      .then(({ code }) => {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = new URL("/entrada", backofficeUrl).href;
        for (const [name, value] of Object.entries({ code, state })) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.append(input);
        }
        document.body.append(form);
        form.submit();
      })
      .catch((failure: unknown) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "Não foi possível abrir o backoffice.",
        ),
      );
  }, [request, state, validState]);
  return (
    <AdminLayout title="Serviços e sistema">
      {error ? (
        <section role="alert">
          <p>{error}</p>
          <Button href={`${backofficeUrl}/entrar`}>Tentar novamente</Button>
        </section>
      ) : (
        <p role="status">A abrir o backoffice…</p>
      )}
    </AdminLayout>
  );
}
