import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ReferralGuideEditor } from "~/components/referrals/ReferralGuideEditor";
import { ReferralGuideList } from "~/components/referrals/ReferralGuideList";
import { ResultActions } from "~/components/ResultActions";
import type { ReferralGuide } from "~/lib/referrals/guide";

const guide: ReferralGuide = [
  {
    kind: "mental-health",
    counter: "Studentpsycholoog",
    description: "Bij psychische klachten.",
    link: "https://school.nl/psycholoog",
  },
  { kind: "money", counter: "Studentendecaan", description: "", link: "" },
];

function inRouter(ui: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{ui}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

/** P39.4: what a teacher sees of the referral guide, and what the admin fills in. */
describe("ReferralGuideList", () => {
  it("lists each counter under its kind of question, with its link", async () => {
    const { container } = inRouter(<ReferralGuideList guide={guide} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Loketten bij je instelling" }),
    ).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const [first, second] = items as [HTMLElement, HTMLElement];
    expect(within(first).getByText("Psychische klachten")).toBeTruthy();
    expect(within(first).getByText("Bij psychische klachten.")).toBeTruthy();
    expect(within(first).getByRole("link", { name: "Studentpsycholoog" })).toHaveAttribute(
      "href",
      "https://school.nl/psycholoog",
    );
    expect(within(second).getByText("Studentendecaan")).toBeTruthy();
    expect(within(second).queryByRole("link")).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("says so when the admin has not filled it in", () => {
    inRouter(<ReferralGuideList guide={[]} headingLevel={2} />);
    expect(screen.getByText("Je beheerder heeft nog geen loketten ingevuld.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("ResultActions with a referral guide", () => {
  it("shows the guide under the result only when the tool has one", () => {
    const props = {
      generationId: null,
      courseId: "",
      nextTools: [],
      linkTargets: [],
      dossiers: [],
    };
    inRouter(<ResultActions {...props} referralGuide={guide} />);
    expect(screen.getByRole("heading", { name: "Loketten bij je instelling" })).toBeTruthy();
  });

  it("shows nothing of it for a tool without one", () => {
    const props = {
      generationId: null,
      courseId: "",
      nextTools: [],
      linkTargets: [],
      dossiers: [],
    };
    inRouter(<ResultActions {...props} referralGuide={null} />);
    expect(screen.queryByRole("heading", { name: "Loketten bij je instelling" })).toBeNull();
  });
});

describe("ReferralGuideEditor", () => {
  it("has one labelled group per kind of question, filled with what is saved", async () => {
    const { container } = inRouter(<ReferralGuideEditor guide={guide} />);
    const group = screen.getByRole("group", { name: "Psychische klachten" });
    expect(within(group).getByLabelText("Loket")).toHaveValue("Studentpsycholoog");
    expect(within(group).getByLabelText("Omschrijving (optioneel)")).toHaveValue(
      "Bij psychische klachten.",
    );
    expect(within(group).getByLabelText("Link (optioneel)")).toHaveValue(
      "https://school.nl/psycholoog",
    );
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Wegwijzer opslaan" })).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });
});
