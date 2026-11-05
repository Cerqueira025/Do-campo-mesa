import { useEffect } from "react";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "../components/ui/Button";
import { useAuth } from "../features/auth/useAuth";
import AppHeader from "../components/layout/AppHeader";
import ProducerRating from "../features/reviews/ProducerRating";
import ProducerArea from "../features/products/ProducerArea";
import "./AccountPage.scss";

const approvalText = {
  pendente:
    "O seu registo aguarda aprovação. Poderá publicar produtos e criar leilões depois de ser aprovado.",
  aceite: "O seu registo de produtor está aprovado.",
  rejeitado:
    "O seu registo de produtor foi rejeitado. Não pode publicar produtos nem criar leilões.",
};

export default function AccountPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { utilizador } = useAuth();
  useEffect(() => {
    if (embedded || utilizador?.papel === "produtor") return;
    const previous = document.title;
    document.title = "A minha conta · Do campo à mesa";
    return () => {
      document.title = previous;
    };
  }, [embedded, utilizador?.papel]);
  if (!utilizador) return null;
  const isProducer = utilizador.papel === "produtor";
  const isApproved = utilizador.validacao === "aceite";
  const content = (
    <div className="account-page">
      <section
        className={`account-page__panel${isProducer || embedded ? " account-page__panel--managed" : ""}`}
        aria-labelledby="account-details-title"
      >
        <h2 id="account-details-title">Dados da conta</h2>
        <dl className="account-page__facts">
          <div>
            <dt>Nome</dt>
            <dd>{utilizador.nome}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{utilizador.email}</dd>
          </div>
          <div>
            <dt>Tipo de conta</dt>
            <dd className="account-page__role">{utilizador.papel}</dd>
          </div>
        </dl>
        {isProducer && isApproved && (
          <Button href={`/produtores/${utilizador.id}`} variant="cream">
            Ver perfil público
          </Button>
        )}
        {utilizador.papel === "administrador" && (
          <Button href="/admin">Administração</Button>
        )}
      </section>
      {isProducer && (
        <div className="account-page__summary">
          <section
            className="account-page__panel account-page__panel--managed account-page__approval"
            aria-labelledby="approval-title"
          >
            <h2 id="approval-title">Validação do produtor</h2>
            <span
              className={`account-page__badge${isApproved ? " account-page__badge--approved" : ""}`}
            >
              {isApproved && (
                <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
              )}
              {isApproved
                ? "Aprovado"
                : utilizador.validacao === "rejeitado"
                  ? "Rejeitado"
                  : "Pendente"}
            </span>
            <p role="status">
              {approvalText[utilizador.validacao || "pendente"]}
            </p>
          </section>
          {isApproved && (
            <ProducerRating key={utilizador.id} id={utilizador.id} />
          )}
        </div>
      )}
    </div>
  );
  if (embedded) return content;
  if (isProducer)
    return (
      <ProducerArea title="A minha conta" section="account">
        {content}
      </ProducerArea>
    );
  return (
    <div className="account-layout">
      <AppHeader />
      <main
        className="account-layout__inner page-content"
        id="main-content"
        tabIndex={-1}
      >
        <div className="account-layout__heading">
          <h1>A minha conta</h1>
        </div>
        {content}
      </main>
    </div>
  );
}
