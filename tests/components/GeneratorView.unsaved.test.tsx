import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneratorView } from "~/components/GeneratorView";
import { getToolBySlug } from "~/lib/registry";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

const streamPost = vi.fn();
vi.mock("~/lib/streamClient", () => ({
  streamPost: (...args: unknown[]) => streamPost(...args),
}));

const profiles = [{ id: "p1", name: "Stage" }];

/** P38.6: a result that was not saved can still go to Word, from the browser. */
describe("GeneratorView with an unsaved result", () => {
  beforeEach(() => streamPost.mockReset());

  async function run(meta: { generationId?: string } | undefined) {
    const user = userEvent.setup();
    streamPost.mockImplementation(async (...a: unknown[]) => {
      const [, body, handlers] = a as [
        string,
        unknown,
        { onToken: (s: string) => void; onDone: (m?: unknown) => void },
      ];
      if (!body) return;
      handlers.onToken("### Agreements\n- Send the planning.");
      handlers.onDone(meta);
    });
    render(<GeneratorView tool={getToolBySlug("arcs-reactor")!} profiles={profiles} defaultProfileId="p1" />);
    for (const box of screen.getAllByRole("textbox")) await user.type(box, "x");
    await user.selectOptions(screen.getByLabelText(/course level/i), "foundation year (year 1)");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await screen.findByText("Send the planning.");
  }

  it("offers Word when nothing was saved", async () => {
    await run(undefined);
    expect(screen.getByRole("button", { name: "Download as Word" })).toBeInTheDocument();
  });

  it("does not, when the result was saved (the export menu does that)", async () => {
    await run({ generationId: "g1" });
    expect(screen.queryByRole("button", { name: "Download as Word" })).toBeNull();
  });
});
