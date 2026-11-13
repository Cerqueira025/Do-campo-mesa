import { useEffect, type ReactNode } from "react";
import AppHeader from "../../components/layout/AppHeader";
import "./OrderLayout.scss";

export default function OrderLayout({
  title,
  children,
  embedded = false,
}: {
  title: string;
  children: ReactNode;
  embedded?: boolean;
}) {
  useEffect(() => {
    if (embedded) return;
    const previous = document.title;
    document.title = `${title} · Do campo à mesa`;
    return () => {
      document.title = previous;
    };
  }, [title, embedded]);
  if (embedded) return <div className="order-content">{children}</div>;
  return (
    <main className="order-page">
      <div className="order-page__header">
        <AppHeader />
      </div>
      <div
        className="order-page__inner page-content"
        id="main-content"
        tabIndex={-1}
      >
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
