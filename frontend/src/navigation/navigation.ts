interface Entry {
  key: string;
  url: string;
  index: number;
  catalog?: { key: string; url: string; index: number };
}

const eventName = "campo-mesa:navigate";
const positions = new Map<string, { x: number; y: number; focus?: string }>();
let activeKey: string | undefined;
let navigationPending = true;
let restorePending = false;
let preservePosition = false;

export const locationSnapshot = () =>
  window.location.pathname + window.location.search + window.location.hash;
const entry = (): Entry | undefined => window.history.state?.campoMesa;
const writeEntry = (value: Entry) =>
  window.history.replaceState(
    { ...window.history.state, campoMesa: value },
    "",
    value.url,
  );

export function initializeNavigation() {
  if (!entry())
    writeEntry({ key: crypto.randomUUID(), url: locationSnapshot(), index: 0 });
  activeKey = entry()!.key;
  window.history.scrollRestoration = "manual";
}

function savePosition(key = activeKey) {
  if (!key) return;
  const element = document.activeElement?.closest<HTMLElement>(
    "[data-navigation-id]",
  );
  positions.set(key, {
    x: window.scrollX,
    y: window.scrollY,
    focus: element?.dataset.navigationId,
  });
  // History entries are small; bound snapshots for a long browsing session.
  if (positions.size > 100) positions.delete(positions.keys().next().value!);
}

const listeners = new Set<() => void>();
const notifyLocation = () => listeners.forEach((notify) => notify());
function handlePopState() {
  savePosition();
  activeKey = entry()?.key;
  navigationPending = true;
  restorePending = true;
  preservePosition = false;
  notifyLocation();
}

export function subscribeLocation(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) {
    window.addEventListener("popstate", handlePopState);
    window.addEventListener(eventName, notifyLocation);
  }
  return () => {
    listeners.delete(notify);
    if (!listeners.size) {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(eventName, notifyLocation);
    }
  };
}

export function navigate(
  destination: string,
  { replace = false, preserveScroll = false } = {},
) {
  const url = new URL(destination, window.location.href);
  if (url.origin !== window.location.origin) return;
  const relative = url.pathname + url.search + url.hash;
  if (relative === locationSnapshot()) return;
  if (!entry()) initializeNavigation();
  savePosition();
  const current = entry()!;
  const catalog =
    window.location.pathname === "/"
      ? { key: current.key, url: locationSnapshot(), index: current.index }
      : current.catalog;
  const next: Entry = {
    key: replace ? current.key : crypto.randomUUID(),
    url: relative,
    index: current.index + (replace ? 0 : 1),
    catalog,
  };
  window.history[replace ? "replaceState" : "pushState"](
    { ...window.history.state, campoMesa: next },
    "",
    relative,
  );
  activeKey = next.key;
  navigationPending = true;
  restorePending = false;
  preservePosition = preserveScroll;
  window.dispatchEvent(new Event(eventName));
}

export function returnToCatalog(destination: string) {
  const current = entry();
  if (
    current?.catalog?.url === destination &&
    current.catalog.index < current.index
  ) {
    window.history.go(current.catalog.index - current.index);
  } else navigate(destination);
}

export function restoreNavigation(ready = true) {
  if (!navigationPending || (!ready && restorePending)) return;
  navigationPending = false;
  if (preservePosition) {
    preservePosition = false;
    return;
  }
  const saved =
    restorePending && activeKey ? positions.get(activeKey) : undefined;
  if (saved) {
    const target = [
      ...document.querySelectorAll<HTMLElement>("[data-navigation-id]"),
    ].find((element) => element.dataset.navigationId === saved.focus);
    target?.focus({ preventScroll: true });
    window.scrollTo(saved.x, saved.y);
    return;
  }
  window.scrollTo(0, 0);
  const heading = document.querySelector<HTMLElement>(
    "main [data-navigation-content] h2",
  ) ?? document.querySelector<HTMLElement>(
    'main h1, main [role="status"]',
  );
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

export function shouldNavigate(
  event: {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    defaultPrevented: boolean;
  },
  target?: string,
  download?: unknown,
) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!target || target === "_self") &&
    (download === undefined || download === false)
  );
}
