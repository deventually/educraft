import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import {
  RedactReview,
  emptyRedactDraft,
  type RedactDraft,
} from "~/components/privacy/RedactReview";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const TEXT =
  "Jan de Vries liep stage bij SportShop BV. Mail: jan@example.org. Project Zonnepark Noord.";

function Harness({ onConfirm }: { onConfirm: (r: unknown) => void }) {
  const [draft, setDraft] = useState<RedactDraft>(emptyRedactDraft);
  return (
    <RedactReview
      fields={[{ name: "document", label: "Document", text: TEXT }]}
      draft={draft}
      onDraft={setDraft}
      onConfirm={onConfirm}
      onCancel={() => {}}
    />
  );
}

describe("RedactReview", () => {
  it("marks every replacement with its code, not only with colour", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness onConfirm={() => {}} />);
    // The e-mail pattern works before the teacher types anything.
    const preview = screen.getByRole("region", { name: /What the AI receives: Document/ });
    expect(
      within(preview).getByRole("button", { name: /jan@example\.org.*\[E-MAIL-1\]/ }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    await user.type(screen.getByLabelText("Company or institution"), "SportShop BV");
    expect(
      within(preview).getByRole("button", { name: /Jan de Vries.*\[STUDENT\]/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(preview).getByText("[BEDRIJF]")).toBeInTheDocument();
    expect(screen.getByText(/3 replacements/)).toBeInTheDocument();
    // Honest about what it cannot do.
    expect(screen.getByText(/figures and photos are not anonymised/i)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lets the teacher undo one replacement and add extra words", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    await user.type(screen.getByLabelText(/Other words/), "Zonnepark Noord");

    await user.click(screen.getByRole("button", { name: /jan@example\.org/ }));
    expect(screen.getByRole("button", { name: /jan@example\.org/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Send anonymised" }));
    const { values, codes } = onConfirm.mock.calls[0][0];
    expect(values.document).toBe(
      "[STUDENT] liep stage bij SportShop BV. Mail: jan@example.org. Project [ANDER-1].",
    );
    expect(codes).toEqual({ STUDENT: "Jan de Vries", "ANDER-1": "Zonnepark Noord" });
  });
});
