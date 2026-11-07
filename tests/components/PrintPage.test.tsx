import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { toExportDoc } from "~/lib/export/doc";
import PrintPage from "~/routes/work.$generationId.print";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const doc = toExportDoc({
  title: "Toetsvragen maken",
  locale: "nl",
  sections: [
    { heading: "1. Toetsmatrijs", markdown: "| Doel | Vragen |\n|---|---|\n| LU1 | 3 |" },
    { heading: "2. Toetsvragen", markdown: "1. Wat is een cel?" },
  ],
});

function show() {
  const props = { loaderData: { doc } } as unknown as ComponentProps<typeof PrintPage>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <PrintPage {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

// happy-dom has no print window; each test installs its own spy.
const stubPrint = () => {
  const print = vi.fn();
  window.print = print;
  return print;
};

afterEach(() => vi.restoreAllMocks());

describe("print page (P30.2)", () => {
  it("shows the result as a document: the title as h1, a step per h2, a real table", () => {
    stubPrint();
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Toetsvragen maken" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "1. Toetsmatrijs" })).toBeTruthy();
    const table = screen.getByRole("table");
    expect(table.querySelector("thead th")?.textContent).toBe("Doel");
  });

  it("opens the browser's print window, and offers it again with a button that is not printed", () => {
    const print = stubPrint();
    show();
    expect(print).toHaveBeenCalledTimes(1);
    const button = screen.getByRole("button", { name: "Print of bewaar als PDF" });
    button.click();
    expect(print).toHaveBeenCalledTimes(2);
    expect(button.closest(".print\\:hidden")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    stubPrint();
    const { container } = show();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
