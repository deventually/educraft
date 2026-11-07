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
    text: "Reflectie van Jan de Vries: ik heb de klant elke week gesproken.",
    emptyFiles: [],
    large: false,
  }),
}));

vi.mock("~/lib/documents/original", () => ({
  loadOriginal: async () => ({
    kind: "pdf",
    pages: ["Reflectie van Jan de Vries: ik heb de klant elke week gesproken."],
    layouts: [{ text: "", aspect: 0.75, items: [] }],
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
    // Opening "Export" under the result must not squash the viewer and the result to their
    // headers: they keep a minimum height and the column scrolls instead.
    const area = box?.parentElement;
    expect(area?.className).toMatch(/(^|\s)lg:min-h-\[\d+dvh\](\s|$)/);
    expect(column?.className).toMatch(/(^|\s)lg:overflow-y-auto(\s|$)/);
    expect(column?.className).toMatch(/(^|\s)lg:overscroll-contain(\s|$)/);
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
  it("shows the anonymised text under 'What the AI receives' once it is sent", async () => {
    const user = userEvent.setup();
    let sent = "";
    streamPost.mockImplementation(async (...a: unknown[]) => {
      const [, body, handlers] = a as [
        string,
        unknown,
        { onToken: (s: string) => void; onDone: () => void },
      ];
      if (!body) return;
      sent = JSON.stringify(body);
      handlers.onToken("Goed werk.");
      handlers.onDone();
    });
    const tool = getToolBySlug("stage-assessment")!;
    render(
      <GeneratorView tool={tool} profiles={[{ id: "p1", name: "Stage" }]} defaultProfileId="p1" />,
    );
    fireEvent.change(screen.getByLabelText("Upload PDF or Word") as HTMLInputElement, {
      target: { files: [new File(["%PDF"], "verslag.pdf", { type: "application/pdf" })] },
    });
    await screen.findByText("Page 1 of 1");
    const aiPanel = () =>
      screen.getByRole("tabpanel", { name: "What the AI receives", hidden: true });
    // Before anonymising, the panel shows the form's text.
    expect(aiPanel()).toHaveTextContent("Reflectie van Jan de Vries");

    await user.click(screen.getByRole("button", { name: /generate/i }));
    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    await user.click(screen.getByRole("button", { name: "Send anonymised" }));
    await waitFor(() => expect(sent).not.toBe(""));

    // The panel shows exactly what went to the AI: codes, not the name.
    expect(sent).toContain("Reflectie van [STUDENT]");
    expect(aiPanel()).toHaveTextContent("Reflectie van [STUDENT]: ik heb de klant");
    expect(aiPanel()).not.toHaveTextContent("Jan de Vries");

    // Editing the text afterwards shows the new form text again (not yet sent).
    const box = screen.getByRole("textbox", { name: /Document to assess/i });
    await user.type(box, " Extra.");
    expect(aiPanel()).toHaveTextContent("Jan de Vries");
  });

  it("folds the form away after a result, so the viewer and the result get the width", async () => {
    const user = userEvent.setup();
    streamPost.mockImplementation(async (...a: unknown[]) => {
      const [, body, handlers] = a as [
        string,
        unknown,
        { onToken: (s: string) => void; onDone: () => void },
      ];
      if (!body) return;
      handlers.onToken("De student schrijft “ik heb de klant elke week gesproken” (p. 1).");
      handlers.onDone();
    });
    const tool = getToolBySlug("stage-assessment")!;
    const { container } = render(
      <GeneratorView tool={tool} profiles={[{ id: "p1", name: "Stage" }]} defaultProfileId="p1" />,
    );
    // No toggle before there is a result: the form is what you work in.
    expect(screen.queryByRole("button", { name: "Hide the form" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Upload PDF or Word"), {
      target: { files: [new File(["%PDF"], "verslag.pdf", { type: "application/pdf" })] },
    });
    await screen.findByText("Page 1 of 1");
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await user.click(screen.getByRole("button", { name: "Send anonymised" }));
    await waitFor(() => expect(streamPost).toHaveBeenCalled());

    const hide = await screen.findByRole("button", { name: "Hide the form" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    const form = document.getElementById(hide.getAttribute("aria-controls") ?? "");
    expect(form).toContainElement(screen.getByLabelText("Upload PDF or Word"));

    await user.click(hide);
    const show = screen.getByRole("button", { name: "Show the form" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    expect(form).toHaveAttribute("hidden");
    // The form keeps its values while folded (it is hidden, not removed).
    expect(form).toContainElement(screen.getByLabelText("Upload PDF or Word"));
    // With the form folded, viewer and result stand side by side from laptop width.
    const box = screen.getByRole("region", { name: "Original" }).closest("[data-viewer-box]");
    expect(box?.parentElement?.className).toMatch(/(^|\s)lg:grid-cols-2(\s|$)/);
    // Folded, the toggle sits on its own row: no side column eats the width.
    const page = box?.parentElement?.parentElement?.parentElement;
    expect(page?.className).not.toMatch(/lg:grid-cols-\[/);
    // The hidden form adds no space under the toggle: its column spaces children with a
    // flex gap (which skips hidden ones), not space-y margins (which do not), so there is
    // as much room under the toggle as above it.
    const column = show.parentElement;
    expect(column?.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(column?.className).not.toMatch(/space-y-/);
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await user.click(show);
    expect(form).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Hide the form" })).toHaveFocus();
  });
});
