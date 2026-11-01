import { useEffect, useRef, type ReactNode } from "react";
import BrandMark from "../../../components/brand/BrandMark";
import InternalLink from "../../../navigation/InternalLink";
import "./AuthLayout.scss";

interface Props {
  title: ReactNode;
  documentTitle: string;
  error: string;
  children: ReactNode;
}

export default function AuthLayout({
  title,
  documentTitle,
  error,
  children,
}: Props) {
  const errorElement = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const previous = document.title;
    document.title = `${documentTitle} · Do campo à mesa`;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);
  useEffect(() => {
    if (error) errorElement.current?.focus();
  }, [error]);

  return (
    <main className="auth-layout">
      <div className="auth-layout__card">
        <header className="auth-layout__header">
          <InternalLink
            href="/"
            className="auth-layout__brand"
            aria-label="Do campo à mesa: voltar ao catálogo"
          >
            <BrandMark variant="plain" />
            <span>Do campo à mesa</span>
          </InternalLink>
          <h1 className="auth-layout__title">{title}</h1>
        </header>
        <section className="auth-layout__body" aria-label={documentTitle}>
          <p
            className="auth-layout__error"
            role="alert"
            tabIndex={-1}
            ref={errorElement}
          >
            {error}
          </p>
          {children}
          <div className="auth-layout__back">
            <InternalLink href="/">Voltar ao catálogo</InternalLink>
          </div>
        </section>
      </div>
    </main>
  );
}
