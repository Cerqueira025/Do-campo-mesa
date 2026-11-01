import { useEffect } from "react";
import { navigate } from "../../navigation/navigation";
import { useAuth } from "./useAuth";
import { safeReturnPath } from "./auth";

export function useAuthRedirect(regresso: string | null) {
  const auth = useAuth();
  const { estado, utilizador } = auth;
  const destination = safeReturnPath(regresso);
  useEffect(() => {
    if (estado === "autenticado" && utilizador) {
      navigate(
        destination ||
          (utilizador.papel === "produtor"
            ? "/conta"
            : utilizador.papel === "administrador"
              ? "/admin"
              : "/"),
        { replace: true },
      );
    }
  }, [estado, utilizador, destination]);
  return auth;
}
