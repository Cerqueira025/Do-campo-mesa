import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";

// As consultas públicas de avaliações e perfis voltam a carregar após alterações ou regresso à janela.
export function useReviewData<T>(path: string) {
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    loading: boolean;
    error: string;
    missing: boolean;
  }>({ path, data: null, loading: true, error: "", missing: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("reviews-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("reviews-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setResult((previous) => ({
        ...previous,
        path,
        data: previous.path === path ? previous.data : null,
        loading: true,
        error: "",
        missing: false,
      }));
      try {
        const data = await api<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted)
          setResult({ path, data, loading: false, error: "", missing: false });
      } catch (error) {
        if (!controller.signal.aborted) {
          const missing = error instanceof ApiError && error.status === 404;
          setResult((previous) => ({
            path,
            data: missing ? null : previous.data,
            loading: false,
            missing,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível carregar as avaliações.",
          }));
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [path, revision]);
  return {
    ...result,
    data: result.path === path ? result.data : null,
    refresh: () => setRevision((value) => value + 1),
  };
}
