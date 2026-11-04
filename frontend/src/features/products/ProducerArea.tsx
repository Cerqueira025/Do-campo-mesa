import type { ReactNode } from "react";
import ManagementLayout from "../../components/layout/ManagementLayout";
import { useAuth } from "../auth/useAuth";
import "./ProducerArea.scss";

export type ProducerSection =
  "account" | "profile" | "orders" | "products" | "auction";

const sections: { section: ProducerSection; href: string; label: string }[] = [
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
  {
    section: "products",
    href: "/produtor/produtos",
    label: "Os meus produtos",
  },
  { section: "auction", href: "/produtor/leiloes", label: "Os meus leilões" },
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
  const links = sections
    .filter(
      (item) =>
        utilizador?.validacao === "aceite" ||
        (item.section !== "products" && item.section !== "auction"),
    )
    .map((item) => ({
      label: item.label,
      href: item.href,
      current: section === item.section,
      ariaLabel:
        item.section === "profile" ? "Editar perfil da exploração" : undefined,
    }));
  return (
    <ManagementLayout
      areaId="producer"
      areaName="Área do produtor"
      title={title}
      documentTitle={`${title} · Do campo à mesa`}
      navigationLabel="Gerir exploração"
      navigation={[{ title: "Gerir exploração", links }]}
      menuLabels={{
        open: "Abrir menu da exploração",
        close: "Fechar menu da exploração",
      }}
    >
      <div className="producer-area">{children}</div>
    </ManagementLayout>
  );
}
