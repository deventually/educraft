import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { GeneratorView } from "~/components/GeneratorView";
import { getToolBySlug } from "~/lib/registry";
import { gridBlowoutRisks } from "../helpers/layout";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

const streamPost = vi.fn();
vi.mock("~/lib/streamClient", () => ({
  streamPost: (...args: unknown[]) => streamPost(...args),
}));

vi.mock("~/lib/documents/extract", async (orig) => ({
  ...(await orig<typeof import("~/lib/documents/extract")>()),
  filesToDocumentText: async () => ({
    text: "Reflectie: ik heb de klant elke week gesproken.",
    emptyFiles: [],
    large: false,
  }),
}));

vi.mock("~/lib/documents/original", () => ({
  loadOriginal: async () => ({
    kind: "pdf",
    pages: ["Reflectie: ik heb de klant elke week gesproken."],
    renderPage: () => Promise.reject(new Error("no canvas")),
  }),
}));

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

/**
 * 24.0c: a `kind: "document"` field shows the original next to the text for the AI,
 * for every tool with such a field (data, not a per-tool branch), and the original
 * stays in the browser.
 */
describe("GeneratorView with a document field", () => {
  beforeEach(() => streamPost.mockReset());

  it("opens the viewer after an upload, without sending anything", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const tool = getToolBySlug("stage-assessment")!;
    const { container } = render(
      <GeneratorView tool={tool} profiles={[{ id: "p1", name: "Stage" }]} defaultProfileId="p1" />,
    );

    expect(screen.queryByRole("region", { name: "Original" })).toBeNull();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    const file = new File(["%PDF"], "verslag.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole("region", { name: "Original" })).toBeInTheDocument();
    expect(await screen.findByText("Page 1 of 1")).toBeInTheDocument();
    expect(gridBlowoutRisks(screen.getByRole("region", { name: "Original" }), container)).toEqual(
      [],
    );
    // A long document scrolls inside the viewer instead of growing past its column: the
    // viewer's box has a height (a share of the screen on a phone, the column on desktop).
    const box = screen.getByRole("region", { name: "Original" }).closest("[data-viewer-box]");
    expect(box?.className).toMatch(/(^|\s)h-\[\d+dvh\](\s|$)/);
    expect(box?.className).toMatch(/(^|\s)lg:h-full(\s|$)/);

    // The sticky right column fits the scroll region under the 4rem header (1px border),
    // with 1rem above and below; with 100vh its bottom (the notice) fell below the screen.
    const column = box?.closest(".lg\\:sticky");
    expect(column?.className).toMatch(/(^|\s)lg:top-4(\s|$)/);
    expect(column?.className).toMatch(/(^|\s)lg:h-\[calc\(100dvh-6rem-1px\)\](\s|$)/);
    // Scrolling inside the viewer stops at its end instead of dragging the page along.
    const pane = screen.getByRole("region", { name: "Original" }).querySelector("[tabindex='0']");
    expect(pane?.className).toMatch(/(^|\s)overscroll-contain(\s|$)/);
    expect(streamPost).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    fetchSpy.mockRestore();
  });

  it("keeps the original next to the result and offers its quotes", async () => {
    const user = userEvent.setup();
    streamPost.mockImplementation(async (...a: unknown[]) => {
      const [, body, handlers] = a as [
        string,
        { values: Record<string, unknown> },
        { onToken: (s: string) => void; onDone: () => void },
      ];
      if (!body) return;
      // Only plain strings go to the server — never the file itself.
      for (const v of Object.values(body.values)) {
        expect(v instanceof Blob).toBe(false);
      }
      handlers.onToken("De student schrijft “ik heb de klant elke week gesproken” (p. 1).");
      handlers.onDone();
    });
    const tool = getToolBySlug("stage-assessment")!;
    render(
      <GeneratorView tool={tool} profiles={[{ id: "p1", name: "Stage" }]} defaultProfileId="p1" />,
    );

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["%PDF"], "verslag.pdf", { type: "application/pdf" })] },
    });
    await screen.findByText("Page 1 of 1");

    await user.click(screen.getByRole("button", { name: /generate/i }));
    // Student work goes through the anonymise step first (24.0b).
    await user.click(screen.getByRole("button", { name: "Send anonymised" }));
    await waitFor(() => expect(streamPost).toHaveBeenCalled());

    const original = screen.getByRole("region", { name: "Original" });
    // Next to a result, a wide document still fits the page (no grid blow-out).
    expect(gridBlowoutRisks(original, document.body)).toEqual([]);
    // The quote in the result itself is the link; clicking it marks the place in the original.
    const quote = await screen.findByRole("link", {
      name: /ik heb de klant elke week gesproken.*show in document/i,
    });
    expect(original.contains(quote)).toBe(false);
    await user.click(quote);
    expect(await screen.findByText(/Found on page 1/i)).toBeInTheDocument();
    expect(document.querySelector('[data-located="true"]')).toHaveTextContent("Page 1 of 1");

    // On a phone the viewer scrolls into view; one tap brings you back to the same quote.
    await user.click(screen.getByRole("button", { name: "Back to the feedback" }));
    expect(quote).toHaveFocus();
  });
});
