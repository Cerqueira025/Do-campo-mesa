import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../../api/client";

// Um ciclo por página: só agenda a consulta seguinte depois da anterior terminar.
export function useOrderPolling<T>(path: string) {
  const { request } = useAuth();
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string;
  }>({ path, data: null, error: "" });
  const [revision, setRevision] = useState(0);
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
