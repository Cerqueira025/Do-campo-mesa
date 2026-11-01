import { useEffect, type ReactNode } from "react";
import AppHeader from "../../components/layout/AppHeader";
import "./OrderLayout.scss";

export default function OrderLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Do campo à mesa`;
    return () => {
      document.title = previous;
    };
  }, [title]);
  return (
    <main className="order-page">
      <div className="order-page__header">
        <AppHeader />
      </div>
      <div className="order-page__inner page-content">
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
