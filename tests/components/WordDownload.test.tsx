import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { WordDownload } from "~/components/export/WordDownload";
import { DOCX_TYPE } from "~/lib/export/docx";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.nl, useLocale: () => "nl" };
});

/**
 * P38.6: a result that is not saved (a visit report) still goes to Word, made in the browser:
 * nothing is sent to the server for it.
 */
describe("WordDownload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a Word file in the browser and offers it as a download", async () => {
    const user = userEvent.setup();
    const made: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      made.push(b);
      return "blob:x";
    }) as never;
    URL.revokeObjectURL = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(
      <WordDownload markdown={"### Afspraken\n- [STUDENT] stuurt de planning."} title="Bezoekverslag" lang="nl" />,
    );
    expect((await axe(container)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Download als Word" }));
    await waitFor(() => expect(made).toHaveLength(1));
    expect(made[0]?.type).toBe(DOCX_TYPE);
    expect(made[0]?.size).toBeGreaterThan(1000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
