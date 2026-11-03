import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../../api/client";
import { useSocket } from "../realtime/socketContext";

// Um ciclo por página: só agenda a consulta seguinte depois da anterior terminar.
export function useOrderPolling<T>(path: string) {
  const { request } = useAuth();
  const socket = useSocket();
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string;
  }>({ path, data: null, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!socket) return;
    const update = ({ id }: { id: string }) => {
      if (path === "/orders" || path === `/orders/${id}`)
        setRevision((value) => value + 1);
    };
    const auctionOrder = ({ encomendaId }: { encomendaId: string }) =>
      update({ id: encomendaId });
    const reconnect = () => setRevision((value) => value + 1);
    socket.on("nova-encomenda", update);
    socket.on("encomenda-atualizada", update);
    socket.on("leilao-ganho", auctionOrder);
    socket.on("leilao-terminado", auctionOrder);
    socket.on("connect", reconnect);
    return () => {
      socket.off("nova-encomenda", update);
      socket.off("encomenda-atualizada", update);
      socket.off("leilao-ganho", auctionOrder);
      socket.off("leilao-terminado", auctionOrder);
      socket.off("connect", reconnect);
    };
  }, [socket, path]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted || document.hidden) return;
      clearTimeout(timer);
      busy = true;
      try {
        const data = await request<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ path, data, error: "" });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            path,
            data:
              previous.path === path &&
              !(error instanceof ApiError && [403, 404].includes(error.status))
                ? previous.data
                : null,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível atualizar os dados.",
          }));
      } finally {
        busy = false;
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(() => void load(), 5000);
      }
    }
    function visible() {
      if (document.hidden) clearTimeout(timer);
      else void load();
    }
    void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [path, request, revision]);
  return {
    data: result.path === path ? result.data : null,
    error: result.path === path ? result.error : "",
    refresh: () => setRevision((value) => value + 1),
  };
}
