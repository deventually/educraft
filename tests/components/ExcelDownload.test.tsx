import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ExcelDownload } from "~/components/export/ExcelDownload";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const sheets = () => [{ name: "Cijfertabel", header: ["Punten", "Cijfer"], rows: [[0, 1]] }];

function renderButton() {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale: "nl" }),
      Component: () => (
        <ExcelDownload fileName="Cijfertabel 30 punten" title="Cijfertabel" sheets={sheets} />
      ),
    },
  ]);
  return render(<Stub />);
}

afterEach(() => vi.restoreAllMocks());

describe("ExcelDownload (P30.3)", () => {
  it("makes the workbook in the browser and downloads it, nothing goes to the server", async () => {
    const blobs: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((b: Blob | MediaSource) => {
      blobs.push(b as Blob);
      return "blob:excel";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderButton();
    fireEvent.click(await screen.findByRole("button", { name: "Download als Excel (.xlsx)" }));

    await waitFor(() => expect(names).toEqual(["Cijfertabel 30 punten.xlsx"]));
    expect(blobs[0]!.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blobs[0]!.arrayBuffer());
    expect(wb.worksheets[0]!.name).toBe("Cijfertabel");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = renderButton();
    await screen.findByRole("button");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
