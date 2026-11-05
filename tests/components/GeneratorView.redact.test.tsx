import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
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

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const profiles = [{ id: "p1", name: "Stage" }];

/**
 * 24.0b: a field with `redact: true` goes through the anonymise step; the request to
 * /api/stream never contains a name the teacher gave, and the result shows the names again.
 */
describe("GeneratorView with student work", () => {
  beforeEach(() => streamPost.mockReset());

  it("asks to anonymise first and sends only codes", async () => {
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
      handlers.onToken("Goed werk van [STUDENT] bij [BEDRIJF].");
      handlers.onDone();
    });
    const tool = getToolBySlug("stage-assessment")!;
    const { container } = render(
      <GeneratorView tool={tool} profiles={profiles} defaultProfileId="p1" />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /Document to assess/i }),
      "Jan de Vries liep stage bij SportShop BV. Bel 06-12345678.",
    );
    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    // Nothing is sent before the review.
    expect(streamPost).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Anonymise first" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    await user.type(screen.getByLabelText("Company or institution"), "SportShop BV");
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Send anonymised" }));
    await waitFor(() => expect(sent).not.toBe(""));
    expect(sent).not.toMatch(/Jan|Vries|SportShop|12345678/);
    expect(sent).toContain("[STUDENT] liep stage bij [BEDRIJF]. Bel [TELEFOON-1].");

    // The browser puts the names back in what the teacher sees.
    expect(
      await screen.findByText(/Goed werk van Jan de Vries bij SportShop BV\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Earlier work keeps the version with codes/)).toBeInTheDocument();
  });

  it("sends a tool without such fields straight away", async () => {
    const user = userEvent.setup();
    const tool = getToolBySlug("arcs-reactor")!;
    render(<GeneratorView tool={tool} profiles={profiles} defaultProfileId="p1" />);
    for (const box of screen.getAllByRole("textbox")) await user.type(box, "x");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(screen.queryByRole("heading", { name: "Anonymise first" })).toBeNull();
  });
});
