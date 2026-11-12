import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { SlideTemplateCard } from "~/components/export/SlideTemplateCard";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

/** P30.7b: uploading a PowerPoint template, for oneself or for a team. */
function show(
  current: { name: string } | null,
  result: unknown = { ok: "saved", name: "Hogeschool.pptx" },
) {
  const calls: FormData[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    calls.push(await request.formData());
    return result;
  });
  const Stub = createRoutesStub([
    {
      path: "/account",
      Component: () => (
        <ToastProvider>
          <SlideTemplateCard action="/account/slide-template" current={current} scope="own" />
        </ToastProvider>
      ),
    },
    { path: "/account/slide-template", action },
  ]);
  const utils = render(<Stub initialEntries={["/account"]} />);
  return { ...utils, calls };
}

describe("SlideTemplateCard (P30.7b)", () => {
  it("offers a labelled file field for .pptx and .potx, and says what happens with it", () => {
    show(null);
    expect(screen.getByRole("heading", { name: "PowerPoint-sjabloon" })).toBeTruthy();
    const input = screen.getByLabelText("Sjabloon (.pptx of .potx, max. 10 MB)");
    expect(input.getAttribute("accept")).toBe(".pptx,.potx");
    expect(screen.queryByRole("button", { name: /Verwijder/ })).toBeNull();
  });

  it("uploads the chosen file and says so", async () => {
    const user = userEvent.setup();
    const { calls } = show(null);
    await user.upload(
      screen.getByLabelText("Sjabloon (.pptx of .potx, max. 10 MB)"),
      new File(["x"], "Hogeschool.pptx"),
    );
    await user.click(screen.getByRole("button", { name: "Sjabloon uploaden" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.get("intent")).toBe("upload");
    // happy-dom leaves the file out of a form's FormData (a browser does not); the route test
    // sends the real bytes.
    await waitFor(() => expect(screen.getByText("Sjabloon Hogeschool.pptx bewaard.")).toBeTruthy());
  });

  it("explains a refused file in words", async () => {
    const user = userEvent.setup();
    show(null, { error: "macros" });
    await user.upload(
      screen.getByLabelText("Sjabloon (.pptx of .potx, max. 10 MB)"),
      new File(["x"], "Macro.pptx"),
    );
    await user.click(screen.getByRole("button", { name: "Sjabloon uploaden" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "Dit bestand bevat macro's. Bewaar het als .pptx of .potx zonder macro's.",
        ),
      ).toBeTruthy(),
    );
  });

  it("shows the current template and removes it", async () => {
    const user = userEvent.setup();
    const { calls } = show({ name: "Hogeschool.pptx" }, { ok: "deleted" });
    expect(screen.getByText("Hogeschool.pptx")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Verwijder sjabloon Hogeschool.pptx" }));
    await waitFor(() => expect(calls[0]?.get("intent")).toBe("delete"));
  });

  it("has no axe violations", async () => {
    const { container } = show({ name: "Hogeschool.pptx" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
