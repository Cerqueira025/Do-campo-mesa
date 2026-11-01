import { useEffect } from "react";
import AppHeader from "../components/layout/AppHeader";
import Button from "../components/ui/Button";
import "./NotFoundPage.scss";

export default function NotFoundPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Página não encontrada · Do campo à mesa";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <main className="not-found-page">
      <AppHeader />
      <div className="not-found-page__inner page-content">
        <section className="not-found-page__message">
          <h1>404 — Página não encontrada</h1>
          <p>
            O endereço que procurou não corresponde a uma página disponível.
          </p>
          <Button href="/">Voltar ao catálogo</Button>
        </section>
      </div>
    </main>
  );
}
