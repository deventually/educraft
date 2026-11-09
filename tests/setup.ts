// DOM test setup: loaded only by the happy-dom project (vitest.config.ts).
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
