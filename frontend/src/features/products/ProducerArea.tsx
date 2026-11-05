import type { ReactNode } from "react";
import ManagementLayout, {
  type ManagementNavigationGroup,
} from "../../components/layout/ManagementLayout";
import { useAuth } from "../auth/useAuth";
import "./ProducerArea.scss";

export type ProducerSection =
  | "account"
  | "profile"
  | "orders"
  | "products"
  | "auction"
  | "product-create"
  | "auction-create";

const groups: {
  title: string;
  approved?: boolean;
  items: { section: ProducerSection; href: string; label: string }[];
}[] = [
  {
    title: "Gerir exploração",
    items: [
      { section: "account", href: "/conta", label: "A minha conta" },
      {
        section: "profile",
        href: "/produtor/perfil",
        label: "Perfil da exploração",
      },
      {
        section: "orders",
        href: "/produtor/encomendas",
        label: "Encomendas recebidas",
      },
    ],
  },
  {
    title: "Produtos",
    approved: true,
    items: [
      {
        section: "products",
        href: "/produtor/produtos",
        label: "Os meus produtos",
      },
      {
        section: "product-create",
        href: "/produtor/produtos/novo",
        label: "Novo produto",
      },
    ],
  },
  {
    title: "Leilões",
    approved: true,
    items: [
      {
        section: "auction",
        href: "/produtor/leiloes",
        label: "Os meus leilões",
      },
      {
        section: "auction-create",
        href: "/produtor/leiloes/novo",
        label: "Novo leilão",
      },
    ],
  },
];

export default function ProducerArea({
  children,
  title,
  section,
}: {
  children: ReactNode;
  title: string;
  section: ProducerSection;
}) {
  const { utilizador } = useAuth();
  const navigation: ManagementNavigationGroup[] = groups
    .filter((group) => !group.approved || utilizador?.validacao === "aceite")
    .map((group) => ({
      title: group.title,
      links: group.items.map((item) => ({
        label: item.label,
        href: item.href,
        current: section === item.section,
        ariaLabel:
          item.section === "profile"
            ? "Editar perfil da exploração"
            : undefined,
      })),
    }));
  return (
    <ManagementLayout
      areaId="producer"
      areaName="Área do produtor"
      title={title}
      documentTitle={`${title} · Do campo à mesa`}
      navigationLabel="Gerir exploração"
      navigation={navigation}
      menuLabels={{
        open: "Abrir menu da exploração",
        close: "Fechar menu da exploração",
      }}
    >
      <div className="producer-area">{children}</div>
    </ManagementLayout>
  );
}
