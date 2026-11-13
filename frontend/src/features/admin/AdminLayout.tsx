import type { ReactNode } from "react";
import ManagementLayout, {
  type ManagementNavigationGroup,
} from "../../components/layout/ManagementLayout";
import { adminSections, type AdminSection } from "./admin";
import "./AdminLayout.scss";

export default function AdminLayout({
  title,
  section,
  children,
}: {
  title: string;
  section?: AdminSection;
  children: ReactNode;
}) {
  const navigation: ManagementNavigationGroup[] = [
    {
      links: [
        {
          label: "Resumo",
          href: "/admin",
          current: !section && title === "Resumo",
        },
      ],
    },
    ...(
      [
        {
          title: "Moderação",
          sections: ["produtores", "avaliacoes", "produtos"],
        },
        {
          title: "Gestão",
          sections: ["utilizadores", "encomendas", "leiloes"],
        },
      ] as const
    ).map((group) => ({
      title: group.title,
      links: group.sections.map((key) => ({
        label: adminSections[key].title,
        href: `/admin/${key}`,
        current: section === key,
      })),
    })),
    {
      links: [
        {
          label: "Serviços e sistema",
          href: `${import.meta.env.VITE_BACKOFFICE_URL || "http://127.0.0.1:8000"}/entrar`,
          description: "Backoffice técnico ↗",
        },
      ],
    },
  ];
  return (
    <ManagementLayout
      areaId="admin"
      areaName="Administração"
      description="Gestão da plataforma"
      title={title}
      documentTitle={`${title} · Administração · Do campo à mesa`}
      navigationLabel="Administração"
      navigation={navigation}
      menuLabels={{
        open: "Abrir menu administrativo",
        close: "Fechar menu administrativo",
      }}
    >
      <div className="admin-page">{children}</div>
    </ManagementLayout>
  );
}
