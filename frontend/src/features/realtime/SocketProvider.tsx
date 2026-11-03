import { useEffect, useMemo, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import Button from "../../components/ui/Button";
import { priceFormatter } from "../products/product";
import { useAuth } from "../auth/useAuth";
import { SocketContext } from "./socketContext";
import "./SocketProvider.scss";

interface Notice {
  id: number;
  text: string;
  href: string;
}

export default function SocketProvider({ children }: { children: ReactNode }) {
  const { token, estado } = useAuth();
  const socket = useMemo(
    () =>
      estado === "a-validar"
        ? null
        : io({
            path: "/socket.io",
            transports: ["websocket"],
            autoConnect: false,
            auth: estado === "autenticado" && token ? { token } : {},
          }),
    [estado, token],
  );
  const [notices, setNotices] = useState<Notice[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const add = (text: string, href: string) =>
      setNotices((current) =>
        [...current, { id: Date.now() + Math.random(), text, href }].slice(-3),
      );
    socket.on(
      "nova-encomenda",
      ({ id, total }: { id: string; total: number }) =>
        add(
          `Nova encomenda recebida: ${priceFormatter.format(total / 100)}.`,
          `/encomendas/${id}`,
        ),
    );
    socket.on(
      "encomenda-atualizada",
      ({
        id,
        estado: next,
        produtor,
      }: {
        id: string;
        estado: string;
        produtor?: string;
      }) =>
        add(
          `${produtor ? `${produtor}: ` : ""}encomenda ${next}.`,
          `/encomendas/${id}`,
        ),
    );
    socket.on("leilao-ganho", ({ encomendaId }: { encomendaId: string }) =>
      add(
        "Ganhou um leilão. Escolha como receber o lote.",
        `/encomendas/${encomendaId}`,
      ),
    );
    socket.on("leilao-terminado", ({ encomendaId }: { encomendaId: string }) =>
      add(
        "Um leilão terminou com vencedor. Consulte a encomenda.",
        `/encomendas/${encomendaId}`,
      ),
    );
    socket.connect();
    return () => {
      socket.disconnect();
      setNotices([]);
    };
  }, [socket]);

  useEffect(() => {
    if (!notices.length || hovered || focused) return;
    const timer = window.setTimeout(
      () => setNotices((current) => current.slice(1)),
      7000,
    );
    return () => window.clearTimeout(timer);
  }, [notices, hovered, focused]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
      {notices.length > 0 && (
        <aside
          className="realtime-notices"
          aria-label="Notificações"
          aria-live="polite"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocused(false);
          }}
        >
          {notices.map((notice) => (
            <div className="realtime-notices__item" key={notice.id}>
              <p>{notice.text}</p>
              <div className="realtime-notices__actions">
                <Button href={notice.href} variant="cream">
                  Ver
                </Button>
                <Button
                  variant="cream"
                  aria-label="Fechar notificação"
                  onClick={() =>
                    setNotices((current) =>
                      current.filter((item) => item.id !== notice.id),
                    )
                  }
                >
                  Fechar
                </Button>
              </div>
            </div>
          ))}
        </aside>
      )}
    </SocketContext.Provider>
  );
}
