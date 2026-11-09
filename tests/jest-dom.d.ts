// Vitest 5 types matchers as `Matchers<R, T>`; jest-dom still augments the old
// one-parameter `Assertion<T>`, which no longer merges. Register its matchers here.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
