import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeNavigation,
  locationSnapshot,
  navigate,
  returnToCatalog,
  restoreNavigation,
  shouldNavigate,
  subscribeLocation,
} from "../src/navigation/navigation.ts";

function browserAt(href: string) {
  const location = new URL(href);
  const events = new EventTarget();
  const calls: { method: string; value?: unknown }[] = [];
  const history = {
    state: { other: "preserved" } as Record<string, unknown>,
    scrollRestoration: "auto",
    replaceState(state: Record<string, unknown>, _title: string, url: string) {
      this.state = state;
      location.href = new URL(url, location).href;
      calls.push({ method: "replace", value: url });
    },
    pushState(state: Record<string, unknown>, _title: string, url: string) {
      this.state = state;
      location.href = new URL(url, location).href;
      calls.push({ method: "push", value: url });
    },
    go(delta: number) {
      calls.push({ method: "go", value: delta });
    },
  };
  const browser = {
    location,
    history,
    scrollX: 0,
    scrollY: 420,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    scrollTo: (x: number, y: number) => {
      calls.push({ method: "scroll", value: [x, y] });
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      activeElement: null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  });
  initializeNavigation();
  calls.length = 0;
  return { browser, history, calls };
}

test("Navegação preserva estado alheio, emite alterações e evita destino externo", () => {
  const { history, calls } = browserAt("http://localhost/?q=mel");
  let updates = 0;
  const unsubscribe = subscribeLocation(() => {
    updates++;
  });
  navigate("/produtos/123");
  assert.equal(locationSnapshot(), "/produtos/123");
  assert.equal(history.state.other, "preserved");
  assert.equal(updates, 1);
  navigate("https://external.test/");
  assert.equal(updates, 1);
  assert.equal(calls.filter((c) => c.method === "push").length, 1);
  unsubscribe();
});

test("Regresso atravessa produtos relacionados até à entrada original do catálogo", () => {
  const { calls } = browserAt("http://localhost/?q=mel");
  navigate("/produtos/123?regresso=%2F%3Fq%3Dmel");
  navigate("/produtos/456?regresso=%2F%3Fq%3Dmel");
  returnToCatalog("/?q=mel");
  assert.deepEqual(calls.at(-1), { method: "go", value: -2 });
});

test("Acesso direto regressa por navegação interna e filtros preservam posição", () => {
  const { calls } = browserAt("http://localhost/produtos/123");
  returnToCatalog("/");
  assert.equal(locationSnapshot(), "/");
  navigate("/?q=mel", { replace: true, preserveScroll: true });
  restoreNavigation();
  assert.equal(
    calls.some((c) => c.method === "scroll"),
    false,
  );
});

test("Popstate restaura posição só quando os resultados estão prontos e uma única vez", () => {
  const { history, browser, calls } = browserAt("http://localhost/?q=mel");
  const catalogState = history.state;
  const unsubscribe = subscribeLocation(() => {});
  const unsubscribeSecond = subscribeLocation(() => {});
  navigate("/produtos/123");
  restoreNavigation();
  calls.length = 0;
  history.state = catalogState;
  browser.location.href = "http://localhost/?q=mel";
  browser.scrollY = 0;
  browser.dispatchEvent(new Event("popstate"));
  restoreNavigation(false);
  assert.equal(calls.length, 0);
  restoreNavigation(true);
  assert.deepEqual(calls.at(-1), { method: "scroll", value: [0, 420] });
  restoreNavigation(true);
  assert.equal(calls.length, 1);
  unsubscribeSecond();
  unsubscribe();
});

test("Links mantêm modificadores, novo separador, download e eventos já tratados", () => {
  const click = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  assert.equal(shouldNavigate(click), true);
  for (const change of [
    { button: 1 },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { defaultPrevented: true },
  ])
    assert.equal(shouldNavigate({ ...click, ...change }), false);
  assert.equal(shouldNavigate(click, "_blank"), false);
  assert.equal(shouldNavigate(click, undefined, ""), false);
});
