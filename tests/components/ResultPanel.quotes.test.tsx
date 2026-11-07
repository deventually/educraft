import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ResultPanel } from "~/components/ResultPanel";
import { escapingSrOnly } from "../helpers/layout";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const MD = [
  "## Onderbouwing",
  "",
  "De student schrijft “ik heb de klant elke week gesproken” (p. 2), en *“de planning liep twee weken uit”*.",
  "",
  "Een paraphrase: “de klant was blij met de samenwerking en het resultaat”.",
  "",
  "> Ik heb geleerd om eerder om hulp te vragen bij mijn begeleider.",
  "",
  "`“code met een citaat dat er lang genoeg uitziet”`",
].join("\n");

const FOUND = [
  "ik heb de klant elke week gesproken",
  "de planning liep twee weken uit",
  "Ik heb geleerd om eerder om hulp te vragen bij mijn begeleider.",
  "code met een citaat dat er lang genoeg uitziet",
];

/**
 * A quote from the student's work in the result jumps to its place in the viewer.
 * Only quotes the viewer found in the original become a link (inline, so it wraps in the sentence); a paraphrase stays
 * plain text, so the result never points at a place that does not exist.
 */
describe("ResultPanel with quotes that can be shown in the document", () => {
  it("turns each found quote into a link that asks the viewer to show it", async () => {
    const user = userEvent.setup();
    const onQuote = vi.fn();
    const { container } = render(<ResultPanel markdown={MD} quotes={FOUND} onQuote={onQuote} />);

    const button = screen.getByRole("link", {
      name: /ik heb de klant elke week gesproken.*show in document/i,
    });
    await user.click(button);
    expect(onQuote).toHaveBeenCalledWith("ik heb de klant elke week gesproken");

    // Inside emphasis too, and a blockquote gets its own button.
    await user.click(screen.getByRole("link", { name: /de planning liep twee weken uit/i }));
    expect(onQuote).toHaveBeenLastCalledWith("de planning liep twee weken uit");
    const block = container.querySelector("blockquote") as HTMLElement;
    await user.click(within(block).getByRole("link", { name: /show in document/i }));
    expect(onQuote).toHaveBeenLastCalledWith(
      "Ik heb geleerd om eerder om hulp te vragen bij mijn begeleider.",
    );

    // Not found in the original, or code: plain text, no button.
    expect(screen.queryByRole("link", { name: /samenwerking/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /code met een citaat/i })).toBeNull();
    expect(screen.getByText(/de klant was blij met de samenwerking/)).toBeInTheDocument();

    // The hidden "(Show in document)" text stays inside the panel, so the page does not grow.
    expect(escapingSrOnly(container.firstElementChild as Element)).toEqual([]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("links no quotes without a document, or while the result streams", () => {
    const { rerender } = render(<ResultPanel markdown={MD} />);
    expect(screen.queryByRole("link", { name: /show in document/i })).toBeNull();
    rerender(<ResultPanel markdown={MD} quotes={FOUND} onQuote={vi.fn()} streaming />);
    expect(screen.queryByRole("link", { name: /show in document/i })).toBeNull();
  });
});
