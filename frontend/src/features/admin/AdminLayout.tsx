import { useEffect, useId, useState, type ReactNode } from "react";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import IconButton from "../../components/ui/IconButton";
import InternalLink from "../../navigation/InternalLink";
import AppHeader from "../../components/layout/AppHeader";
import { adminSections, type AdminSection } from "./admin";
import "./AdminLayout.scss";

let menuPreference: boolean | undefined;

export default function AdminLayout({
  title,
  section,
  children,
}: {
  title: string;
  section?: AdminSection;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(
    () => menuPreference ?? window.matchMedia("(min-width: 1024px)").matches,
  );
  const menuId = useId();
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Administração · Do campo à mesa`;
    return () => {
      document.title = previous;
    };
  }, [title]);
  return (
    <main className="admin-page">
      <div className="admin-page__inner">
        <div className="admin-page__header">
          <AppHeader />
        </div>
        <div className="admin-page__heading page-content">
          <IconButton
            variant="primary"
            aria-label={
              open ? "Fechar menu administrativo" : "Abrir menu administrativo"
            }
            aria-expanded={open}
            aria-controls={menuId}
            icon={<FontAwesomeIcon icon={faBars} aria-hidden="true" />}
            onClick={() => {
              menuPreference = !open;
              setOpen(!open);
            }}
          />
          <div>
            <p>Administração</p>
            <h1>{title}</h1>
          </div>
        </div>
        <div
          className={`admin-page__layout page-content${open ? " admin-page__layout--open" : ""}`}
        >
          <nav
            id={menuId}
            hidden={!open}
            className="admin-page__menu"
            aria-label="Administração"
          >
            <InternalLink
              href="/admin"
              aria-current={!section && title === "Resumo" ? "page" : undefined}
            >
              Resumo
            </InternalLink>
            {Object.entries(adminSections).map(([key, value]) => (
              <InternalLink
                key={key}
                href={`/admin/${key}`}
                aria-current={section === key ? "page" : undefined}
              >
                {key === "produtores" ? "Produtores" : value.title}
              </InternalLink>
            ))}
          </nav>
          <div className="admin-page__content">{children}</div>
        </div>
      </div>
    </main>
  );
}
