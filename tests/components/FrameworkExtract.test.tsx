import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";

vi.mock("~/lib/documents/extract", () => ({
  DOC_ACCEPT_ATTR: ".pdf,.docx",
  fileToText: vi.fn(async (file: File) => ({ text: `tekst van ${file.name}` })),
}));

import { FrameworkExtract } from "~/components/portfolio/FrameworkExtract";

function renderCard() {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <FrameworkExtract replaces={false} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("FrameworkExtract", () => {
  it("reads several files at once, one per learning outcome, and keeps pasted text", async () => {
    const { container } = renderCard();
    const text = screen.getByLabelText("Tekst van het beoordelingsformulier");
    fireEvent.change(text, { target: { value: "Al geplakt." } });

    const input = screen.getByLabelText(/Of kies het formulier/) as HTMLInputElement;
    expect(input.multiple).toBe(true);
    const files = [new File(["a"], "LU1.pdf"), new File(["b"], "LU2.pdf")];
    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect((text as HTMLTextAreaElement).value).toContain("LU2.pdf"));
    const value = (text as HTMLTextAreaElement).value;
    expect(value.indexOf("Al geplakt.")).toBe(0);
    expect(value.indexOf("tekst van LU1.pdf")).toBeLessThan(value.indexOf("tekst van LU2.pdf"));
    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
