import { describe, expect, it } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { ChapterEditor } from "~/components/portfolio/ChapterEditor";
import { GuidedWriting } from "~/components/portfolio/GuidedWriting";
import type { GuidedSectionView } from "~/lib/portfolio/guided";
import { C1, C2 } from "../portfolio/fixtures";

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const sections: GuidedSectionView[] = [
  {
    id: "s1",
    title: "Beginsituatie",
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
    questions: ["Hoe begon je?"],
    answers: [""],
    drafted: true,
  },
];

/** The route remounts the chapter after every post; focus must not fall back to the page. */
function editor(focusAfter?: string, draftMode = true) {
  return render(
    <ChapterEditor outcomeId="lu1" defaultValue="Tekst." focusAfter={focusAfter}>
      <GuidedWriting sections={sections} draftMode={draftMode} />
    </ChapterEditor>,
  );
}

describe("ChapterEditor: focus after a post", () => {
  it("leaves focus alone on a fresh visit", () => {
    editor();
    expect(document.body).toHaveFocus();
  });

  it("returns focus to the save button after saving", () => {
    editor("writeChapter");
    expect(screen.getByRole("button", { name: "Hoofdstuk opslaan" })).toHaveFocus();
  });

  it("moves to the first open answer of the part the coach just asked about", () => {
    editor("guideQuestions:s2");
    expect(screen.getByRole("textbox", { name: "Hoe begon je?" })).toHaveFocus();
  });

  it("moves to the first open answer of the chapter after Grill me", () => {
    editor("guideGrill");
    expect(screen.getByRole("textbox", { name: "Wat konden ze al?" })).toHaveFocus();
  });

  it("returns focus to the paragraph button of that part", () => {
    editor("guideDraft:s1");
    expect(
      screen.getByRole("button", { name: "Maak er een alinea van: Beginsituatie" }),
    ).toHaveFocus();
  });

  it("falls back to the chapter text when the button is gone", () => {
    editor("guideDraftAll", false);
    expect(screen.getByLabelText("Je tekst bij deze leeruitkomst")).toHaveFocus();
  });
});
