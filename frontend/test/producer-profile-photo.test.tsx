import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ProducerProfile from "../src/features/producers/ProducerProfile";
import ProductForm from "../src/features/products/ProductForm";
import AccountPage from "../src/pages/AccountPage";
import AppRoutes from "../src/navigation/AppRoutes";
import { AuthContext } from "../src/features/auth/authContext";
import { navigate } from "../src/navigation/navigation";
import {
  readFilterCache,
  writeFilterCache,
} from "../src/features/home/catalogCache";
import { authValue, product } from "./fixtures";

vi.mock("../src/components/layout/AppHeader", () => ({ default: () => null }));
vi.mock("../src/features/reviews/ProducerRating", () => ({
  default: () => null,
}));
vi.mock("../src/navigation/navigation", async (original) => ({
  ...(await original<typeof import("../src/navigation/navigation")>()),
  navigate: vi.fn(),
  restoreNavigation: vi.fn(),
}));
const producer = {
  id: "produtor",
  nome: "Produtor",
  email: "p@example.test",
  papel: "produtor",
  validacao: "aceite",
} as const;
const profile = {
  descricao: "Horta",
  localidade: "Viana",
  morada: "Rua da Horta",
  coordenadas: { latitude: 41, longitude: -8 },
};
const managed = {
  ...product,
  publicado: false,
  bloqueado: true,
  createdAt: "",
  updatedAt: "",
};
const photo = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.mocked(navigate).mockClear();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:preview");
      static revokeObjectURL = vi.fn();
    },
  );
});
function mount(
  element: React.ReactNode,
  request = vi.fn().mockResolvedValue(profile),
) {
  render(
    <AuthContext.Provider value={authValue({ utilizador: producer, request })}>
      {element}
    </AuthContext.Provider>,
  );
  return request;
}

test("Perfil carrega dados privados, guarda só alterações e invalida filtros", async () => {
  const request = mount(<ProducerProfile />);
  const locality = await screen.findByLabelText("Localidade");
  expect((screen.getByLabelText("Morada") as HTMLInputElement).value).toBe(
    profile.morada,
  );
  fireEvent.change(locality, { target: { value: "  Braga  " } });
  request.mockResolvedValue({ ...profile, localidade: "Braga" });
  writeFilterCache({ categorias: [], produtores: [], localidades: ["Viana"] });
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar perfil" }).closest("form")!,
  );
  await screen.findByText("Perfil da exploração guardado.");
  expect(request.mock.calls.at(-1)).toEqual([
    "/producers/me",
    { method: "PATCH", body: { localidade: "Braga" } },
  ]);
  expect(readFilterCache()).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("status"));
  expect(
    screen.getByRole("link", { name: "Cancelar" }).getAttribute("href"),
  ).toBe("/conta");
});

test("Perfil conserva dados em falhas, bloqueia repetição e permite voltar a tentar", async () => {
  const request = mount(<ProducerProfile />);
  fireEvent.change(await screen.findByLabelText("Descrição (opcional)"), {
    target: { value: "Nova descrição" },
  });
  let reject!: (error: Error) => void;
  request.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const form = screen
    .getByRole("button", { name: "Guardar perfil" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(request).toHaveBeenCalledTimes(2);
  expect(
    (
      screen
        .getByRole("button", { name: "A guardar…" })
        .closest("fieldset") as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  await act(async () => reject(new Error("Sem ligação")));
  expect(
    (screen.getByLabelText("Descrição (opcional)") as HTMLTextAreaElement)
      .value,
  ).toBe("Nova descrição");
  expect(document.activeElement).toBe(screen.getByRole("alert"));
  request.mockResolvedValue({ ...profile, descricao: "Nova descrição" });
  fireEvent.submit(form);
  await screen.findByText("Perfil da exploração guardado.");
});

test("Perfil apresenta falha de leitura e recupera por tentativa explícita", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("API indisponível"))
    .mockResolvedValue(profile);
  mount(<ProducerProfile />, request);
  await screen.findByText("API indisponível");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByLabelText("Morada");
  expect(request).toHaveBeenCalledTimes(2);
});

test("Perfil aceita coordenadas zero e rejeita campos vazios antes da API", async () => {
  const request = mount(<ProducerProfile />);
  fireEvent.change(await screen.findByLabelText("Latitude"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: "0" },
  });
  const form = screen
    .getByRole("button", { name: "Guardar perfil" })
    .closest("form")!;
  fireEvent.change(screen.getByLabelText("Morada"), { target: { value: " " } });
  fireEvent.submit(form);
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Morada"), {
    target: { value: profile.morada },
  });
  request.mockResolvedValue({
    ...profile,
    coordenadas: { latitude: 0, longitude: 0 },
  });
  fireEvent.submit(form);
  await screen.findByText("Perfil da exploração guardado.");
  expect(request.mock.calls.at(-1)![1].body).toEqual({
    coordenadas: { latitude: 0, longitude: 0 },
  });
});

test.each(["pendente", "rejeitado", "aceite"] as const)(
  "Produtor %s encontra o perfil na conta e pode abrir a rota",
  async (validacao) => {
    const request = vi.fn().mockResolvedValue(profile);
    const value = authValue({
      utilizador: { ...producer, validacao },
      request,
    });
    const { unmount } = render(
      <AuthContext.Provider value={value}>
        <AccountPage />
      </AuthContext.Provider>,
    );
    expect(
      screen
        .getByRole("link", { name: "Editar perfil da exploração" })
        .getAttribute("href"),
    ).toBe("/produtor/perfil");
    unmount();
    window.history.replaceState(null, "", "/produtor/perfil");
    render(
      <AuthContext.Provider value={value}>
        <AppRoutes />
      </AuthContext.Provider>,
    );
    await screen.findByLabelText("Morada");
  },
);

test("Criação sem fotografia abre a consulta privada", async () => {
  const request = vi.fn().mockResolvedValue(managed);
  mount(<ProductForm />, request);
  for (const [label, value] of [
    ["Nome", "Batata"],
    ["Descrição", "Da horta"],
    ["Categoria", "Hortícolas"],
    ["Preço (€ por unidade)", "1,50"],
    ["Stock disponível", "5"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar produto" }).closest("form")!,
  );
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      `/produtor/produtos/${managed._id}?guardado=1`,
    ),
  );
  expect(request).toHaveBeenCalledTimes(1);
});

test("Upload tem pré-visualização, preserva edições dos dados e bloqueia submissões concorrentes", async () => {
  const request = vi.fn().mockResolvedValue(managed);
  const { unmount } = render(
    <AuthContext.Provider value={authValue({ utilizador: producer, request })}>
      <ProductForm id={managed._id} />
    </AuthContext.Provider>,
  );
  fireEvent.change(await screen.findByLabelText("Nome"), {
    target: { value: "Batata nova" },
  });
  const file = new File(["imagem"], "batata.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Nova fotografia"), {
    target: { files: [file] },
  });
  expect(
    screen.getByAltText("Pré-visualização de Batata").getAttribute("src"),
  ).toBe("blob:preview");
  let resolve!: (value: unknown) => void;
  request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const form = screen
    .getByRole("button", { name: "Guardar fotografia" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar produto" }).closest("form")!,
  );
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.at(-1)).toEqual([
    `/products/${managed._id}/photo`,
    { method: "PUT", body: file },
  ]);
  await act(async () => resolve({ ...managed, fotografia: photo }));
  await screen.findByText("Fotografia guardada.");
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
    "Batata nova",
  );
  expect(screen.getByAltText("Batata").getAttribute("src")).toBe(
    `/api/uploads/products/${photo}-960.webp`,
  );
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  unmount();
});

test("Ficheiros inválidos são rejeitados; uma falha de upload mantém fotografia e seleção", async () => {
  const request = vi.fn().mockResolvedValue({ ...managed, fotografia: photo });
  mount(<ProductForm id={managed._id} />, request);
  const input = await screen.findByLabelText("Nova fotografia");
  fireEvent.change(input, {
    target: { files: [new File(["x"], "x.svg", { type: "image/svg+xml" })] },
  });
  expect(screen.getByRole("alert").textContent).toContain("JPEG, PNG ou WebP");
  const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", {
    type: "image/png",
  });
  fireEvent.change(input, { target: { files: [large] } });
  expect(screen.getByRole("alert").textContent).toContain("5 MiB");
  expect(request).toHaveBeenCalledTimes(1);
  const file = new File(["x"], "x.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  request.mockRejectedValueOnce(new Error("Disco indisponível"));
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar fotografia" }).closest("form")!,
  );
  await screen.findByText("Disco indisponível");
  expect(screen.getByAltText("Pré-visualização de Batata")).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Guardar fotografia",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  request.mockResolvedValue({ ...managed, fotografia: photo });
  fireEvent.submit(
    screen.getByRole("button", { name: "Guardar fotografia" }).closest("form")!,
  );
  await screen.findByText("Fotografia guardada.");
});

test("Remover fotografia antiga desativa associação pelo nome e não envia outros dados", async () => {
  const request = vi.fn().mockResolvedValue(managed);
  mount(<ProductForm id={managed._id} />, request);
  await screen.findByLabelText("Nova fotografia");
  request.mockResolvedValue({ ...managed, fotografia: null });
  fireEvent.click(screen.getByRole("button", { name: "Remover fotografia" }));
  await screen.findByText("Fotografia removida.");
  expect(request.mock.calls.at(-1)).toEqual([
    `/products/${managed._id}/photo`,
    { method: "DELETE" },
  ]);
  expect(screen.getByText("Imagem indisponível")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Remover fotografia" }),
  ).toBeNull();
});


test("Criação com fotografia recupera falha de envio sem criar outro produto", async () => {
  const request = vi.fn().mockResolvedValueOnce(managed).mockRejectedValueOnce(new Error("Envio falhou")).mockResolvedValueOnce({ ...managed, fotografia: photo });
  mount(<ProductForm />, request);
  for (const [label, value] of [["Nome", "Batata"], ["Descrição", "Da horta"], ["Categoria", "Hortícolas"], ["Preço (€ por unidade)", "1,50"], ["Stock disponível", "5"]])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const file = new File(["imagem"], "batata.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Fotografia"), { target: { files: [file] } });
  const form = screen.getByRole("button", { name: "Guardar produto" }).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await screen.findByText("Envio falhou");
  expect(request.mock.calls.filter((call) => call[0] === "/products")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Consultar produto sem fotografia" }).getAttribute("href")).toBe(`/produtor/produtos/${managed._id}`);
  fireEvent.click(screen.getByRole("button", { name: "Repetir envio da fotografia" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/produtor/produtos/${managed._id}?guardado=1`));
  expect(request.mock.calls.filter((call) => call[0] === "/products")).toHaveLength(1);
  expect(request.mock.calls.at(-1)).toEqual([`/products/${managed._id}/photo`, { method: "PUT", body: file }]);
});
