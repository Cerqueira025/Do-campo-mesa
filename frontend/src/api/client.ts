export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

export async function api<T>(
  path: string,
  { method = "GET", body, token, signal }: ApiOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      0,
      "Não foi possível contactar o servidor. Verifique a ligação e tente novamente.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.erro || "Não foi possível concluir o pedido.",
    );
  if (data === null)
    throw new ApiError(
      response.status,
      "O servidor devolveu uma resposta inválida.",
    );
  return data as T;
}
