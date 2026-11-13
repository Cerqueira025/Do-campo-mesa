import Button from "../../components/ui/Button";
import OrderDetailPage from "../../pages/OrderDetailPage";
import { useLocation } from "../../navigation/useLocation";
import { adminSections, adminReturnUrl, type AdminSection } from "./admin";
import AdminLayout from "./AdminLayout";
import AdminList from "./AdminList";
import AdminDetail from "./AdminDetail";
import AdminSummary from "./AdminSummary";

export default function AdminPage() {
  const location = useLocation();
  const [path, search = ""] = location.split("#")[0].split("?");
  if (path === "/admin" || path === "/admin/")
    return (
      <AdminLayout title="Resumo">
        <AdminSummary />
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
