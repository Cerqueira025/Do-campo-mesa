import type { ReactNode } from "react";
import ManagementLayout from "../../components/layout/ManagementLayout";

export default function BuyerArea({
  title,
  section,
  children,
}: {
  title: string;
  section: "account" | "orders";
  children: ReactNode;
}) {
  return (
    <ManagementLayout
      areaId="buyer"
      areaName="Área pessoal"
      title={title}
      documentTitle={`${title} · Do campo à mesa`}
      navigationLabel="Área pessoal"
      navigation={[
        {
          links: [
            {
              label: "A minha conta",
              href: "/conta",
              current: section === "account",
            },
            {
              label: "As minhas encomendas",
              href: "/encomendas",
              current: section === "orders",
            },
          ],
        },
      ]}
      menuLabels={{
        open: "Abrir menu da área pessoal",
        close: "Fechar menu da área pessoal",
      }}
    >
      {children}
    </ManagementLayout>
  );
}
