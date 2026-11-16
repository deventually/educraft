import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { CopyBlocks } from "~/components/CopyBlocks";
import { ToastProvider } from "~/components/Toast";

/**
 * Under a finished result: the paste-ready texts (e.g. a summary per report for OnStage), each
 * with its own Copy button, so the teacher does not dig through the whole assessment.
 */
function renderWithRouter(ui: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{ui}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

const markdown = [
  "## Samenvatting voor OnStage",
  "### Stageverslag",
  "Je verslag is **helder** opgebouwd.",
  "### Onderzoeksverslag",
  "Je deelvragen zijn scherp.",
  "## Aandachtspunten",
  "x",
].join("\n");

describe("CopyBlocks", () => {
  it("shows each block under the heading with its own copy button; axe", async () => {
    const { container } = renderWithRouter(
      <CopyBlocks markdown={markdown} heading="Samenvatting voor OnStage" />,
    );
    expect(screen.getByRole("heading", { name: "Samenvatting voor OnStage" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Stageverslag" })).toBeTruthy();
    expect(screen.getByText("Je verslag is helder opgebouwd.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kopieer: Stageverslag" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kopieer: Onderzoeksverslag" })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("copies only that block's text and confirms with a toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithRouter(
      <ToastProvider>
        <CopyBlocks markdown={markdown} heading="Samenvatting voor OnStage" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Kopieer: Onderzoeksverslag" }));
    expect(writeText).toHaveBeenCalledWith("Je deelvragen zijn scherp.");
    expect(await screen.findByText("Gekopieerd: Onderzoeksverslag")).toBeTruthy();
  });

  it("shows nothing when the result has no such heading", () => {
    renderWithRouter(<CopyBlocks markdown={"## Iets\nx"} heading="Samenvatting voor OnStage" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
