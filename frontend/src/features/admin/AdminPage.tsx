import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import OrderDetailPage from "../../pages/OrderDetailPage";
import { useLocation } from "../../navigation/useLocation";
import {
  adminSections,
  adminReturnUrl,
  type AdminSection,
  type AdminSummary,
} from "./admin";
import { useAdminData } from "./useAdminData";
import AdminLayout from "./AdminLayout";
import AdminList from "./AdminList";
import AdminDetail from "./AdminDetail";

function Summary() {
  const { data, error, refresh } = useAdminData<AdminSummary>(
    "/admin/summary",
    true,
  );
  return (
    <>
      <Button variant="cream" onClick={refresh}>
        Atualizar
      </Button>
      {error && (
        <p role="alert" className="admin-page__error">
          {error}
          {data && " A mostrar os dados anteriores."}
        </p>
      )}
      {!data && !error && <LoadingPlaceholder label="A carregar resumo…" />}
      {data && (
        <div className="admin-page__summary">
          <section className="admin-page__panel">
            <h2>Utilizadores</h2>
            <p className="admin-page__count">
              {Object.values(data.users).reduce((sum, count) => sum + count, 0)}
            </p>
            {["comprador", "produtor", "administrador"].map((role) => (
              <p key={role}>
                <Button
                  variant="cream"
                  href={`/admin/utilizadores?papel=${role}`}
                >
                  {role}: {data.users[role] ?? 0}
                </Button>
              </p>
            ))}
          </section>
          <section className="admin-page__panel">
            <h2>Produtores pendentes</h2>
            <p className="admin-page__count">{data.pendingProducers}</p>
            <Button href="/admin/produtores">Consultar pedidos</Button>
          </section>
          <section className="admin-page__panel">
            <h2>Encomendas</h2>
            <p className="admin-page__count">
              {Object.values(data.orders).reduce(
                (sum, count) => sum + count,
                0,
              )}
            </p>
            {["pendente", "confirmada", "pronta", "entregue"].map((state) => (
              <p key={state}>
                <Button
                  variant="cream"
                  href={`/admin/encomendas?estado=${state}`}
                >
                  {state}: {data.orders[state] ?? 0}
                </Button>
              </p>
            ))}
          </section>
          <section className="admin-page__panel">
            <h2>Leilões ativos</h2>
            <p className="admin-page__count">{data.activeAuctions}</p>
            <Button href="/admin/leiloes">Consultar leilões</Button>
          </section>
        </div>
      )}
    </>
  );
}

export default function AdminPage() {
  const location = useLocation();
  const [path, search = ""] = location.split("#")[0].split("?");
  if (path === "/admin" || path === "/admin/")
    return (
      <AdminLayout title="Resumo">
        <Summary />
      </AdminLayout>
    );
  const match = /^\/admin\/([^/]+)(?:\/([a-f\d]{24}))?\/?$/i.exec(path);
  if (!match || !Object.hasOwn(adminSections, match[1]))
    return (
      <AdminLayout title="Página não encontrada">
        <p>Esta página administrativa não existe.</p>
        <Button href="/admin">Voltar ao resumo</Button>
      </AdminLayout>
    );
  const section = match[1] as AdminSection;
  const id = match[2];
  const title = `${id ? "Detalhe · " : ""}${adminSections[section].title}`;
  const backUrl = adminReturnUrl(section, search);
  return (
    <AdminLayout title={title} section={section}>
      {id ? (
        section === "encomendas" ? (
          <OrderDetailPage id={id} embedded backUrl={backUrl} />
        ) : (
          <AdminDetail
            key={`${section}/${id}`}
            section={section}
            id={id}
            backUrl={backUrl}
          />
        )
      ) : (
        <AdminList key={section} section={section} />
      )}
    </AdminLayout>
  );
}
