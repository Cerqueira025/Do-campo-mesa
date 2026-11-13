import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { mockDesktopQuery } from "./fixtures";

beforeEach(() => {
  mockDesktopQuery();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});
