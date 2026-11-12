import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { GuidedWriting } from "~/components/portfolio/GuidedWriting";
import type { GuidedSectionView } from "~/lib/portfolio/guided";
import { C1, C2 } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <form>{node}</form> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const sections: GuidedSectionView[] = [
  {
    id: "s1",
    title: "Beginsituatie",
    description: "Beschrijf de groep.",
    criterionIds: [C2],
    fromOutline: true,
    n: 1,
    covers: [2],
    questions: ["Welke groep had je?", "Wat konden ze al?"],
    answers: ["Tweedejaars.", ""],
    drafted: false,
  },
  {
    id: "s2",
    title: "Opbouw van de les",
    criterionIds: [C1],
    fromOutline: true,
    n: 2,
    covers: [1],
    questions: [],
    answers: [],
    drafted: false,
  },
];

describe("GuidedWriting", () => {
  it("lists each section with what it asks and the criteria it covers", async () => {
    const { container } = render(<GuidedWriting sections={sections} draftMode={false} />);
    const region = screen.getByRole("region", { name: "Schrijf per onderdeel" });
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("heading", { name: "Beginsituatie" })).toBeInTheDocument();
    expect(within(items[0]!).getByText("Beschrijf de groep.")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Dekt criterium 2")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks for questions on a section without them", () => {
    render(<GuidedWriting sections={sections} draftMode={false} />);
    const ask = screen.getByRole("button", { name: "Stel me vragen over Opbouw van de les" });
    expect(ask).toHaveAttribute("name", "intent");
    expect(ask).toHaveAttribute("value", "guideQuestions:s2");
  });

  it("gives every question its own labelled answer field, with what was saved", () => {
    render(<GuidedWriting sections={sections} draftMode={false} />);
    const first = screen.getByRole("textbox", { name: "Welke groep had je?" });
    expect(first).toHaveAttribute("name", "answer:s1");
    expect(first).toHaveValue("Tweedejaars.");
    expect(screen.getByRole("textbox", { name: "Wat konden ze al?" })).toHaveValue("");
  });

  it("in coaching mode keeps the answers as notes: no paragraph button", () => {
    render(<GuidedWriting sections={sections} draftMode={false} />);
    expect(screen.queryByRole("button", { name: /Maak er een alinea van/ })).toBeNull();
    expect(screen.getByText(/Schrijf je hoofdstuk zelf/)).toBeInTheDocument();
  });

  it("in draft mode offers a paragraph from the answers, per section with questions", async () => {
    const { container } = render(<GuidedWriting sections={sections} draftMode />);
    const make = screen.getByRole("button", { name: "Maak er een alinea van: Beginsituatie" });
    expect(make).toHaveAttribute("value", "guideDraft:s1");
    expect(screen.queryByRole("button", { name: /alinea van: Opbouw/ })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("names a criterion section by its number when the form gives no outline", () => {
    render(
      <GuidedWriting
        sections={[
          {
            id: C1,
            title: "De les heeft een heldere structuur.",
            criterionIds: [C1],
            fromOutline: false,
            n: 1,
            covers: [1],
            questions: [],
            answers: [],
            drafted: false,
          },
        ]}
        draftMode={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Criterium 1" })).toBeInTheDocument();
    expect(screen.getByText("De les heeft een heldere structuur.")).toBeInTheDocument();
    expect(screen.queryByText("Dekt criterium 1")).toBeNull();
  });

  it("asks the questions of every section in one go, until all have them", () => {
    const { unmount } = render(<GuidedWriting sections={sections} draftMode={false} />);
    const all = screen.getByRole("button", { name: "Stel alle vragen" });
    expect(all).toHaveAttribute("name", "intent");
    expect(all).toHaveAttribute("value", "guideQuestionsAll");
    unmount();
    const asked = sections.map((s) => ({ ...s, questions: ["Wat deed je?", "Waarom?"] }));
    render(<GuidedWriting sections={asked} draftMode={false} />);
    expect(screen.queryByRole("button", { name: "Stel alle vragen" })).toBeNull();
  });

  it("in draft mode writes the whole chapter with one button, section by section", async () => {
    const { container } = render(<GuidedWriting sections={sections} draftMode />);
    const write = screen.getByRole("button", { name: "Stel het hoofdstuk op" });
    expect(write).toHaveAttribute("value", "guideDraftAll");
    expect(screen.getByText(/één voor één, in volgorde/)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers no chapter button in coaching mode or when every section is written", () => {
    const { unmount } = render(<GuidedWriting sections={sections} draftMode={false} />);
    expect(screen.queryByRole("button", { name: "Stel het hoofdstuk op" })).toBeNull();
    unmount();
    const written = sections.map((s) => ({ ...s, drafted: true }));
    render(<GuidedWriting sections={written} draftMode />);
    expect(screen.queryByRole("button", { name: "Stel het hoofdstuk op" })).toBeNull();
    expect(screen.getAllByText("Staat in je hoofdstuk.")).toHaveLength(2);
  });
});
