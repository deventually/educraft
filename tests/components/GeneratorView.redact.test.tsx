import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { GeneratorView } from "~/components/GeneratorView";
import { getToolBySlug } from "~/lib/registry";
import type { PrivacyReviewItem, StreamHandlers } from "~/lib/streamClient";

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
const privacy = { known: { teacher: "Mark de Groot", colleagues: ["Anna Visser"] }, never: [] };

type Body = { values: Record<string, unknown>; privacy?: { approved: string[]; keep: string[] } };
/** Every request body, and an answer for each. */
function server(answer: (h: StreamHandlers, n: number) => void) {
  const bodies: Body[] = [];
  streamPost.mockImplementation(async (...a: unknown[]) => {
    const [, body, handlers] = a as [string, Body | undefined, StreamHandlers];
    if (!body) return;
    bodies.push(body);
    answer(handlers, bodies.length);
  });
  return bodies;
}

/**
 * The live preview (anonymiseerpoort PR 3) replaces the separate anonymise step: the teacher
 * sees what goes while typing and Generate sends at once. Names the teacher gives never leave
 * the browser; the result shows them again.
 */
describe("GeneratorView: what goes to the AI", () => {
  beforeEach(() => streamPost.mockReset());

  it("shows student work as it goes and sends only codes for the names the teacher gave", async () => {
    const user = userEvent.setup();
    const bodies = server((h) => {
      h.onToken("Goed werk van [STUDENT] bij [BEDRIJF].");
      h.onDone?.({});
    });
    const tool = getToolBySlug("stage-assessment")!;
    const { container } = render(
      <GeneratorView tool={tool} profiles={profiles} defaultProfileId="p1" privacy={privacy} />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Document to assess/i }),
      "Jan de Vries liep stage bij SportShop BV. Bel 06-12345678.",
    );
    await user.type(screen.getByRole("textbox", { name: /Assessment framework/i }), "C1");
    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    await user.type(screen.getByLabelText("Company or institution"), "SportShop BV");
    expect(
      await screen.findByRole("button", { name: "Jan de Vries becomes [STUDENT]" }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    const sent = JSON.stringify(bodies[0]);
    expect(sent).not.toMatch(/Jan|Vries|SportShop|12345678/);
    expect(sent).toContain("[STUDENT] liep stage bij [BEDRIJF]. Bel [TELEFOON-1].");
    expect(bodies[0]?.privacy).toEqual({ approved: [], keep: [] });
    expect(
      await screen.findByText(/Goed werk van Jan de Vries bij SportShop BV\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Earlier work keeps the version with codes/)).toBeInTheDocument();
  });

  it("sends a known name as typed, with the teacher's approval for the gate", async () => {
    const user = userEvent.setup();
    const bodies = server((h) => h.onDone?.({}));
    const tool = getToolBySlug("engagement-check")!;
    render(
      <GeneratorView tool={tool} profiles={profiles} defaultProfileId="p1" privacy={privacy} />,
    );
    await user.type(screen.getByRole("textbox", { name: /Your assignment/ }), "Anna Visser zegt x");
    expect(
      await screen.findByRole("button", { name: "Anna Visser becomes [COLLEGA-1]" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(Object.values(bodies[0]?.values ?? {})).toContain("Anna Visser zegt x");
    expect(bodies[0]?.privacy?.approved).toEqual(["Anna Visser"]);
  });

  it("lays the gate's question before the teacher and sends again only after the answer", async () => {
    const user = userEvent.setup();
    const review: PrivacyReviewItem[] = [
      { value: "Piet Klaassen", code: "COLLEGA-2", kind: "colleague", count: 2 },
    ];
    const bodies = server((h, n) => {
      if (n === 1) h.onPrivacy?.(review);
      else h.onDone?.({});
    });
    const tool = getToolBySlug("engagement-check")!;
    render(
      <GeneratorView tool={tool} profiles={profiles} defaultProfileId="p1" privacy={privacy} />,
    );
    await user.type(screen.getByRole("textbox", { name: /Your assignment/ }), "x");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(await screen.findByRole("heading", { name: "Look first" })).toBeInTheDocument();
    expect(screen.getByText("Piet Klaassen (2×)")).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]?.privacy?.approved).toContain("Piet Klaassen");
    expect(screen.queryByRole("heading", { name: "Look first" })).toBeNull();
  });
});
