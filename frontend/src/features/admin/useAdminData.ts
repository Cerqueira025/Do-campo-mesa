import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../../api/client";

export function useAdminData<T>(path: string, poll = false) {
  const { request } = useAuth();
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ path, data: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted || (poll && document.hidden))
        return;
      busy = true;
      clearTimeout(timer);
      try {
        const data = await request<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted)
          setResult({ path, data, error: "", loading: false });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            path,
            loading: false,
            data:
              previous.path === path &&
              !(error instanceof ApiError && [403, 404].includes(error.status))
                ? previous.data
                : null,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível carregar os dados.",
          }));
      } finally {
        busy = false;
        if (poll && !controller.signal.aborted && !document.hidden)
          timer = setTimeout(() => void load(), 5000);
      }
    }
    function visible() {
      if (document.hidden) clearTimeout(timer);
      else void load();
    }
    void load();
    if (poll) document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [path, poll, request, revision]);
  return {
    data: result.path === path ? result.data : null,
    error: result.path === path ? result.error : "",
    loading: result.path !== path || result.loading,
    refresh: () => setRevision((value) => value + 1),
  };
}
