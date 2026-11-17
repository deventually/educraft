import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { PrivacyAskCard, PrivacyPreview } from "~/components/privacy/PrivacyPreview";
import { usePrivacy } from "~/lib/hooks/usePrivacy";
import type { PrivacyPage } from "~/lib/privacy/live";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const page: PrivacyPage = {
  known: { teacher: "Mark de Groot", colleagues: ["Anna Visser"] },
  never: ["Kolb"],
};

function Harness({
  text,
  redact = false,
  onSend,
}: {
  text: string;
  redact?: boolean;
  onSend?: (r: unknown) => void;
}) {
  const privacy = usePrivacy(page);
  const fields = [{ name: "q", label: "Question", text, redact }];
  return (
    <>
      <PrivacyPreview privacy={privacy} fields={fields} studentWork={redact} />
      <button type="button" onClick={() => onSend?.(privacy.prepare({ fields }))}>
        Send
      </button>
    </>
  );
}

afterEach(() => vi.unstubAllGlobals());

/**
 * "What goes to the AI" (anonymiseerpoort PR 3): under the form, in every tool, the text with
 * each replacement marked and its code. One click keeps a word; the teacher names students here,
 * and those names stay in the page.
 */
describe("PrivacyPreview", () => {
  it("shows each replacement with its code, as text, and counts them politely", async () => {
    const { container } = render(
      <Harness text="Anna Visser mailt anna@school.nl. Volgens Kolb werkt het." />,
    );
    const region = screen.getByRole("region", { name: "What goes to the AI" });
    expect(
      within(region).getByRole("button", { name: "Anna Visser becomes [COLLEGA-1]" }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: "anna@school.nl becomes [E-MAIL-1]" }),
    ).toBeInTheDocument();
    // On the never-list: shown as kept, one click away from being replaced again.
    expect(within(region).queryByRole("button", { name: /^Kolb/ })).toBeNull();
    expect(within(region).getByText("2 replaced")).toHaveAttribute("aria-live", "polite");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("keeps a known name with one click and remembers it on the never-list", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Harness text="Volgens Visser werkt het." onSend={onSend} />);
    await user.click(screen.getByRole("button", { name: "Visser becomes [COLLEGA-1]" }));
    expect(screen.getByRole("button", { name: "Visser is kept" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/privacy/keep",
      expect.objectContaining({ body: JSON.stringify({ intent: "add", word: "Visser" }) }),
    );
    expect(screen.getByRole("button", { name: "Replace Visser again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend.mock.calls[0]?.[0].approval.keep).toContain("Visser");
  });

  it("replaces a student the teacher names, in the browser only", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Harness text="Jan de Vries schreef dit." onSend={onSend} />);
    await user.click(screen.getByText("Names that must go"));
    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    expect(
      screen.getByRole("button", { name: "Jan de Vries becomes [STUDENT]" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    const sent = onSend.mock.calls[0]?.[0];
    expect(sent.values.q).toBe("[STUDENT] schreef dit.");
    expect(JSON.stringify(sent.approval)).not.toMatch(/Vries/);
  });

  it("opens the names for student work and says when nothing is replaced", () => {
    render(<Harness text="Een gewone tekst." redact />);
    expect(screen.getByLabelText("Student name")).toBeVisible();
    expect(screen.getByText("Nothing is replaced.")).toBeInTheDocument();
  });
});

describe("PrivacyAskCard: the gate found something the teacher did not see", () => {
  it("lists each word once with its count, sends only after the teacher chose", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const { container } = render(
      <PrivacyAskCard
        items={[
          { value: "Piet Klaassen", code: "COLLEGA-1", kind: "colleague", count: 3 },
          { value: "Hattie", code: "COLLEGA-2", kind: "colleague", count: 1 },
        ]}
        onAnswer={onAnswer}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "Look first" })).toBeInTheDocument();
    const piet = screen.getByRole("group", { name: "Piet Klaassen (3×)" });
    expect(within(piet).getByRole("radio", { name: "Replace" })).toBeChecked();
    await user.click(
      within(screen.getByRole("group", { name: "Hattie (1×)" })).getByRole("radio", {
        name: "Do not replace",
      }),
    );
    expect(onAnswer).not.toHaveBeenCalled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onAnswer).toHaveBeenCalledWith({ "Piet Klaassen": "replace", Hattie: "keep" });
  });
});
