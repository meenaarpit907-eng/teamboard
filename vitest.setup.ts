import { afterEach, beforeEach, vi } from "vitest";

const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

function isExpectedLog(args: unknown[]): boolean {
  const first = args[0];
  return typeof first === "string" && first.startsWith("[");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (!isExpectedLog(args)) {
      originalError(...args);
    }
  });
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (!isExpectedLog(args)) {
      originalWarn(...args);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
