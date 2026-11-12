import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { GuidedWriting } from "~/components/portfolio/GuidedWriting";
import type { GuidedSectionView } from "~/lib/portfolio/guided";
import { EvidenceTextField } from "~/components/portfolio/EvidenceTextField";

// The button itself is tested in DictateButton.test.tsx; here only the wiring.
vi.mock("~/components/DictateButton", () => ({
  DictateButton: ({
    field,
    lang,
    onText,
  }: {
    field: string;
    lang: string;
    onText: (t: string) => void;
  }) => (
    <button type="button" onClick={() => onText("ingesproken tekst")}>
      {`mic ${field} ${lang}`}
    </button>
  ),
}));

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <form>{node}</form> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const sections: GuidedSectionView[] = [
  {
    id: "s1",
    title: "Beginsituatie",
    criterionIds: [],
    fromOutline: true,
    n: 1,
    covers: [],
    questions: ["Welke groep had je?", "Wat konden ze al?"],
    answers: ["Tweedejaars.", ""],
  },
];

describe("dictation in the portfolio", () => {
  it("offers dictation on every answer of guided writing, named after its question", async () => {
    const { container } = render(<GuidedWriting sections={sections} draftMode={false} />);
    expect(screen.getByRole("button", { name: "mic Welke groep had je? nl" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mic Wat konden ze al? nl" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("puts the dictated text after the answer, for the teacher to read back before saving", async () => {
    render(<GuidedWriting sections={sections} draftMode={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mic Welke groep/ }));
    await user.click(screen.getByRole("button", { name: /mic Wat konden/ }));
    expect(screen.getByRole("textbox", { name: "Welke groep had je?" })).toHaveValue(
      "Tweedejaars. ingesproken tekst",
    );
    const second = screen.getByRole("textbox", { name: "Wat konden ze al?" });
    expect(second).toHaveValue("ingesproken tekst");
    expect(second).toHaveAttribute("name", "answer:s1");
  });

  it("offers dictation on the evidence text and adds to what is there", async () => {
    const { container } = render(<EvidenceTextField id="new-text" defaultValue="Les 1." />);
    await userEvent.setup().click(screen.getByRole("button", { name: "mic Tekst nl" }));
    expect(screen.getByRole("textbox", { name: "Tekst" })).toHaveValue("Les 1. ingesproken tekst");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
