import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ManagementLayout from "../src/components/layout/ManagementLayout";
import { AuthContext } from "../src/features/auth/authContext";
import { authValue, mockDesktopQuery } from "./fixtures";

vi.mock("../src/features/cart/cartContext", () => ({
  useCart: () => ({ canBuy: false }),
}));

function layout(areaId: string, title = "Produtos") {
  return (
    <AuthContext.Provider value={authValue()}>
      <ManagementLayout
        areaId={areaId}
        areaName="Gestão"
        description="A sua atividade"
        title={title}
        documentTitle={`${title} · Gestão`}
        navigationLabel="Menu de gestão"
        navigation={[
          {
            title: "Atividade",
            links: [
              {
                label: "Produtos",
                href: "/produtos",
                current: title === "Produtos",
              },
            ],
          },
          {
            links: [
              {
                label: "Sistema",
                href: "https://example.test/entrar",
                description: "Serviços técnicos",
              },
            ],
          },
        ]}
        menuLabels={{ open: "Abrir menu", close: "Fechar menu" }}
      >
        <section>
          <h2>Informação da página</h2>
        </section>
      </ManagementLayout>
    </AuthContext.Provider>
  );
}

test("Estrutura comum tem um banner, um título principal e menu fora de main", () => {
  render(layout("structure"));
  const main = screen.getByRole("main");
  const menu = screen.getByRole("navigation", { name: "Menu de gestão" });
  const toggle = screen.getByRole("button", { name: "Fechar menu" });
  expect(screen.getAllByRole("banner")).toHaveLength(1);
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(main.contains(menu)).toBe(false);
  expect(main.id).toBe("main-content");
  expect(main.tabIndex).toBe(-1);
  expect(
    screen
      .getByRole("link", { name: "Saltar para o conteúdo" })
      .getAttribute("href"),
  ).toBe("#main-content");
  expect(toggle.getAttribute("aria-controls")).toBe(menu.id);
  expect(within(menu).getByRole("link", { current: "page" }).textContent).toBe(
    "Produtos",
  );
  expect(
    within(menu)
      .getByRole("link", { name: "Sistema Serviços técnicos" })
      .getAttribute("href"),
  ).toBe("https://example.test/entrar");
});

test("Menu começa recolhido em mobile e acompanha o breakpoint antes de uma escolha", () => {
  const media = mockDesktopQuery(false);
  const view = render(layout("responsive"));
  const toggle = screen.getByRole("button", { name: "Abrir menu" });
  const menu = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(menu.hidden).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Abrir menu" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  act(() => media.resize(true));
  expect(menu.hidden).toBe(false);
  act(() => media.resize(false));
  expect(menu.hidden).toBe(true);
  view.unmount();
  expect(media.query.removeEventListener).toHaveBeenCalledWith(
    "change",
    expect.any(Function),
  );
});

test("Escolha explícita mantém-se em navegação, resize e remontagem da mesma área", () => {
  const media = mockDesktopQuery(false);
  const view = render(layout("remember"));
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  act(() => media.resize(true));
  act(() => media.resize(false));
  expect(
    screen
      .getByRole("button", { name: "Fechar menu" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  const header = screen.getByRole("banner");
  const menu = screen.getByRole("navigation", { name: "Menu de gestão" });
  view.rerender(layout("remember", "Detalhe"));
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("navigation", { name: "Menu de gestão" })).toBe(menu);
  fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
  view.unmount();
  media.resize(true);
  render(layout("remember"));
  expect(
    screen
      .getByRole("button", { name: "Abrir menu" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
});

test("Escolhas são independentes entre áreas, mesmo ao mudar a área montada", () => {
  const view = render(layout("first-area"));
  fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
  view.rerender(layout("second-area"));
  expect(
    screen
      .getByRole("button", { name: "Fechar menu" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  view.rerender(layout("first-area"));
  expect(
    screen
      .getByRole("button", { name: "Abrir menu" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
});

test("Título do documento acompanha a página e é restaurado ao sair", () => {
  document.title = "Catálogo";
  const view = render(layout("document-title"));
  expect(document.title).toBe("Produtos · Gestão");
  view.rerender(layout("document-title", "Detalhe"));
  expect(document.title).toBe("Detalhe · Gestão");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Detalhe");
  view.unmount();
  expect(document.title).toBe("Catálogo");
});
