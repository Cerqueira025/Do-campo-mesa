import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Select from "../src/components/ui/input/Select";
import FormField from "../src/components/ui/input/FormField";
import ProductFilters from "../src/features/home/components/ProductFilters";
import { emptyFilters } from "../src/features/home/catalogFilters";

const options = [
  { value: "", label: "Selecione um produto" },
  { value: "batata", label: "Batata" },
  { value: "brocolos", label: "Brócolos", disabled: true },
  { value: "azeite", label: "Azeite" },
  { value: "abobora", label: "Abóbora" },
];

function Field({
  disabled = false,
  fieldsetDisabled = false,
  required = false,
  variant = "form",
}: {
  disabled?: boolean;
  fieldsetDisabled?: boolean;
  required?: boolean;
  variant?: "form" | "filter";
}) {
  const [value, setValue] = useState("");
  return (
    <form aria-label="Produto">
      <fieldset disabled={fieldsetDisabled}>
        <FormField id="product" label="Produto" unframed compact={false}>
          <Select
            id="product"
            name="product"
            value={value}
            onValueChange={setValue}
            options={options}
            required={required}
            disabled={disabled}
            variant={variant}
            aria-describedby="product-hint"
          />
        </FormField>
      </fieldset>
      <small id="product-hint">Escolha um produto disponível.</small>
      <button type="submit">Guardar</button>
    </form>
  );
}

test.each(["form", "filter"] as const)(
  "A variante %s permite selecionar por clique, marca a seleção e mantém FormData",
  (variant) => {
    const view = render(<Field variant={variant} />);
    const trigger = screen.getByRole("combobox", { name: "Produto" });
    expect(trigger.getAttribute("aria-describedby")).toBe("product-hint");
    fireEvent.click(trigger);
    const menu = screen.getByRole("listbox", { name: "Produto" });
    expect(view.container.contains(menu)).toBe(false);
    expect(menu.classList.contains(`select--${variant}`)).toBe(true);
    fireEvent.click(screen.getByRole("option", { name: "Batata" }));
    expect(trigger.textContent).toBe("Batata");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).get("product"),
    ).toBe("batata");
    fireEvent.click(trigger);
    expect(
      screen
        .getByRole("option", { name: "Batata" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  },
);

test("Navega por teclado sem alterar a seleção, ignora opções disabled e confirma com Enter ou Espaço", () => {
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Produto" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(
    document.getElementById(trigger.getAttribute("aria-activedescendant")!)
      ?.textContent,
  ).toBe("Azeite");
  expect(trigger.textContent).toBe("Selecione um produto");
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(trigger.textContent).toBe("Azeite");
  fireEvent.keyDown(trigger, { key: " " });
  fireEvent.keyDown(trigger, { key: "End" });
  fireEvent.keyDown(trigger, { key: " " });
  expect(trigger.textContent).toBe("Abóbora");
  fireEvent.keyDown(trigger, { key: "ArrowUp" });
  fireEvent.keyDown(trigger, { key: "Home" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(trigger.textContent).toBe("Batata");
});

test("Escape, Tab, blur e clique fora fecham sem confirmar a opção ativa", () => {
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Produto" });
  for (const key of ["Escape", "Tab"]) {
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toBe("Selecione um produto");
  }
  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(trigger);
  fireEvent.blur(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("A pesquisa por digitação aceita acentos e percorre opções com a mesma inicial", () => {
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Produto" });
  fireEvent.keyDown(trigger, { key: "a" });
  expect(
    document.getElementById(trigger.getAttribute("aria-activedescendant")!)
      ?.textContent,
  ).toBe("Azeite");
  fireEvent.keyDown(trigger, { key: "a" });
  expect(
    document.getElementById(trigger.getAttribute("aria-activedescendant")!)
      ?.textContent,
  ).toBe("Abóbora");
  fireEvent.keyDown(trigger, { key: "Escape" });
  fireEvent.click(trigger);
  for (const key of "abó") fireEvent.keyDown(trigger, { key });
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(trigger.textContent).toBe("Abóbora");
});

test.each(["disabled", "fieldsetDisabled"] as const)(
  "Respeita %s e não inclui o valor nos dados submetidos",
  (property) => {
    render(<Field {...{ [property]: true }} />);
    const trigger = screen.getByRole("combobox", { name: "Produto" });
    expect(trigger.matches(":disabled")).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).has("product"),
    ).toBe(false);
  },
);

test("Um fieldset desativado com o menu aberto impede a escolha no portal e fecha-o", async () => {
  const view = render(<Field />);
  fireEvent.click(screen.getByRole("combobox", { name: "Produto" }));
  const option = screen.getByRole("option", { name: "Batata" });
  view.rerender(<Field fieldsetDisabled />);
  fireEvent.click(option);
  expect(screen.getByRole("combobox", { name: "Produto" }).textContent).toBe(
    "Selecione um produto",
  );
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
});

test("Desativar diretamente fecha o menu e reativar não o volta a abrir", async () => {
  const view = render(<Field />);
  fireEvent.click(screen.getByRole("combobox", { name: "Produto" }));
  view.rerender(<Field disabled />);
  await act(async () => {});
  view.rerender(<Field />);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("O menu cabe no ecrã e abre acima quando falta espaço em baixo", () => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 800);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute("role") === "listbox"
        ? {
            top: 0,
            left: 0,
            width: 366,
            height: 320,
            right: 366,
            bottom: 320,
            x: 0,
            y: 0,
            toJSON() {},
          }
        : {
            top: 700,
            left: 4,
            width: 382,
            height: 64,
            right: 386,
            bottom: 764,
            x: 4,
            y: 700,
            toJSON() {},
          };
    },
  );
  render(<Field />);
  fireEvent.click(screen.getByRole("combobox", { name: "Produto" }));
  const popup = screen.getByRole("listbox");
  expect(popup.style.width).toBe("366px");
  expect(popup.style.left).toBe("12px");
  expect(popup.style.top).toBe("372px");
  expect(popup.style.maxHeight).toBe("320px");
});

test("A validação required foca o campo visível, anuncia o erro e recupera após a escolha", () => {
  render(<Field required />);
  const form = screen.getByRole("form") as HTMLFormElement;
  const trigger = screen.getByRole("combobox", { name: "Produto" });
  act(() => {
    expect(form.checkValidity()).toBe(false);
  });
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").textContent).toBe("Selecione uma opção.");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: "Batata" }));
  expect(form.checkValidity()).toBe(true);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("Atualiza opções e valores controlados sem perder a associação à opção ativa", () => {
  const change = vi.fn();
  const field = (items: typeof options, value = "batata") => (
    <Select
      id="dynamic"
      aria-label="Produto"
      value={value}
      onValueChange={change}
      options={items}
    />
  );
  const view = render(field(options));
  const trigger = screen.getByRole("combobox", { name: "Produto" });
  fireEvent.click(trigger);
  view.rerender(
    field(
      options.filter((option) => option.value !== "batata"),
      "azeite",
    ),
  );
  expect(trigger.textContent).toBe("Azeite");
  expect(
    document.getElementById(trigger.getAttribute("aria-activedescendant")!)
      ?.textContent,
  ).toBe("Azeite");
  fireEvent.click(screen.getByRole("option", { name: "Brócolos" }));
  expect(change).not.toHaveBeenCalled();
  view.rerender(field([], ""));
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("Os filtros mantêm valores recuperados, opções carregadas e o estado disabled", () => {
  const change = vi.fn();
  const props = {
    id: "filters",
    isOpen: true,
    value: { ...emptyFilters, localidade: "Localidade anterior" },
    options: null,
    optionsError: false,
    onChange: change,
    onClear: vi.fn(),
    onRetry: vi.fn(),
    onViewResults: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(<ProductFilters {...props} />);
  const location = screen.getByRole("combobox", { name: "Localidade" });
  expect(location.matches(":disabled")).toBe(true);
  view.rerender(
    <ProductFilters
      {...props}
      options={{ categorias: [], produtores: [], localidades: ["Braga"] }}
    />,
  );
  expect(location.textContent).toBe("Localidade anterior");
  fireEvent.click(location);
  expect(
    within(screen.getByRole("listbox")).getByRole("option", {
      name: "Localidade anterior",
    }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("option", { name: "Braga" }));
  expect(change).toHaveBeenCalledWith({ ...emptyFilters, localidade: "Braga" });
});
