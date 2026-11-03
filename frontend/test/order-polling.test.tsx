import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { useOrderPolling } from "../src/features/orders/useOrderPolling";
import { AuthContext } from "../src/features/auth/authContext";
import { SocketContext } from "../src/features/realtime/socketContext";
import { ApiError } from "../src/api/client";
import { authValue } from "./fixtures";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function polling(socket: Socket | null = null) {
  const request = vi.fn().mockResolvedValue({ estado: "pendente" });
  const auth = authValue({ request });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
    </AuthContext.Provider>
  );
  const hook = renderHook(
    ({ path }) => useOrderPolling<{ estado: string }>(path),
    {
      wrapper,
      initialProps: { path: "/orders/1" },
    },
  );
  return { ...hook, request };
}

async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

test("Atualiza automaticamente e não sobrepõe pedidos lentos", async () => {
  const { request, result } = polling();
  await advance();
  expect(result.current.data).toEqual({ estado: "pendente" });
  let resolve!: (value: { estado: string }) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await advance(5000);
  await advance(15_000);
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => resolve({ estado: "confirmada" }));
  expect(result.current.data).toEqual({ estado: "confirmada" });
  await advance(5000);
  expect(request).toHaveBeenCalledTimes(3);
});

test("Preserva dados numa falha de rede, mas remove-os quando perde acesso", async () => {
  const { request, result } = polling();
  await advance();
  request.mockRejectedValueOnce(new TypeError("Sem rede"));
  await advance(5000);
  expect(result.current.data).toEqual({ estado: "pendente" });
  expect(result.current.error).toBe("Sem rede");
  request.mockRejectedValueOnce(new ApiError(403, "Sem acesso"));
  await advance(5000);
  expect(result.current.data).toBeNull();
  expect(result.current.error).toBe("Sem acesso");
});

test("Cancela o pedido e o temporizador ao sair da página", async () => {
  const { request, unmount } = polling();
  const signal = request.mock.calls[0][1].signal as AbortSignal;
  await advance();
  unmount();
  expect(signal.aborted).toBe(true);
  await advance(15_000);
  expect(request).toHaveBeenCalledOnce();
});

test("Suspende consultas com a página oculta e atualiza quando volta a estar visível", async () => {
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const { request } = polling();
  await advance();
  hidden = true;
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await advance(15_000);
  expect(request).toHaveBeenCalledOnce();
  hidden = false;
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await advance();
  expect(request).toHaveBeenCalledTimes(2);
});

test("Uma resposta atrasada da página anterior não substitui a encomenda atual", async () => {
  const { request, result, rerender } = polling();
  await advance();
  let resolve!: (value: { estado: string }) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await advance(5000);
  const signal = request.mock.calls[1][1].signal as AbortSignal;
  request.mockResolvedValueOnce({ estado: "entregue" });
  rerender({ path: "/orders/2" });
  await advance();
  expect(signal.aborted).toBe(true);
  expect(result.current.data).toEqual({ estado: "entregue" });
  await act(async () => resolve({ estado: "confirmada" }));
  expect(result.current.data).toEqual({ estado: "entregue" });
});

test("Eventos de encomenda e reconexão atualizam dados e removem os listeners ao sair", async () => {
  const listeners = new Map<string, (payload: { id: string }) => void>();
  const on = vi.fn((event, callback) => listeners.set(event, callback));
  const off = vi.fn();
  const { request, unmount } = polling({ on, off } as unknown as Socket);
  await advance();
  act(() => listeners.get("encomenda-atualizada")!({ id: "outra" }));
  expect(request).toHaveBeenCalledOnce();
  act(() => listeners.get("encomenda-atualizada")!({ id: "1" }));
  await advance();
  expect(request).toHaveBeenCalledTimes(2);
  act(() => listeners.get("connect")!({ id: "" }));
  await advance();
  expect(request).toHaveBeenCalledTimes(3);
  unmount();
  for (const [event, callback] of listeners)
    expect(off).toHaveBeenCalledWith(event, callback);
});
