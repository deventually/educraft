import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { FileInput } from "~/components/FileInput";
import { Label } from "~/components/ui";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderPicker(locale: "nl" | "en" = "nl", onChange = vi.fn()) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      Component: () => (
        <div>
          <Label htmlFor="doc">Kies een document</Label>
          <FileInput id="doc" accept=".pdf" multiple onChange={onChange} />
        </div>
      ),
    },
  ]);
  return { ...render(<Stub initialEntries={["/"]} />), onChange };
}

const pdf = (name: string) => new File(["x"], name, { type: "application/pdf" });

describe("FileInput", () => {
  it("shows a real, Dutch button instead of the browser's 'Choose file'", async () => {
    const { container } = renderPicker();
    const button = await screen.findByText("Kies bestand");
    expect(button.className).toMatch(/border/);
    expect(button.className).toMatch(/rounded-lg/);
    expect(screen.getByText("Geen bestand gekozen")).toBeVisible();
    const input = screen.getByLabelText("Kies een document");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".pdf");
    expect(input).toHaveAccessibleDescription("Geen bestand gekozen");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("speaks English when the interface is English", async () => {
    renderPicker("en");
    expect(await screen.findByText("Choose file")).toBeVisible();
    expect(screen.getByText("No file chosen")).toBeVisible();
  });

  it("names the chosen files and still hands the change to the caller", async () => {
    const { onChange } = renderPicker();
    const input = await screen.findByLabelText("Kies een document");
    fireEvent.change(input, { target: { files: [pdf("oer.pdf"), pdf("domein.pdf")] } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByText("oer.pdf, domein.pdf")).toBeVisible();
    expect(input).toHaveAccessibleDescription("oer.pdf, domein.pdf");
  });

  it("keeps the caller's own description next to the file name", async () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ locale: "nl" }),
        Component: () => (
          <div>
            <Label htmlFor="doc">Document</Label>
            <FileInput id="doc" aria-describedby="help" />
            <p id="help">Alleen PDF.</p>
          </div>
        ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByLabelText("Document")).toHaveAccessibleDescription(
      "Geen bestand gekozen Alleen PDF.",
    );
  });
});

/** Every .tsx under app/, as [path, source]. */
function appSources(dir = "app"): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return appSources(p);
    return p.endsWith(".tsx") ? [[p, readFileSync(p, "utf8")] as [string, string]] : [];
  });
}

describe("file pickers in the app", () => {
  it("never show the browser's own control: a visible file input goes through FileInput", () => {
    const raw = appSources()
      .filter(([p]) => !p.endsWith("FileInput.tsx"))
      .flatMap(([p, src]) =>
        [...src.matchAll(/<input[^>]*type="file"[^>]*>/gs)]
          .filter((m) => !/className="hidden"/.test(m[0]))
          .map(() => p),
      );
    expect(raw).toEqual([]);
  });
});
