import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ChapterOutline } from "~/components/portfolio/ChapterOutline";
import type { Outcome } from "~/lib/portfolio/types";
import { C1, C2, sampleDossier } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

function outcome(patch: Partial<Outcome> = {}): Outcome {
  return { ...sampleDossier().framework.outcomes[0]!, ...patch };
}

describe("ChapterOutline", () => {
  it("shows the form's sections in order, with what they ask and the criteria they cover", async () => {
    const { container } = render(
      <ChapterOutline
        outcome={outcome({
          outline: [
            {
              id: "s1",
              title: "Beginsituatie",
              description: "Wat de groep al kan.",
              criterionIds: [C2],
            },
            { id: "s2", title: "Lesdoel en subdoelen", criterionIds: [C1, C2] },
            { id: "s3", title: "Inleiding", criterionIds: [] },
          ],
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "Opzet uit je formulier" });
    const items = within(region).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("h4")?.textContent)).toEqual([
      "Beginsituatie",
      "Lesdoel en subdoelen",
      "Inleiding",
    ]);
    expect(within(items[0]!).getByText("Wat de groep al kan.")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Dekt criterium 2")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Dekt criteria 1 en 2")).toBeInTheDocument();
    expect(within(items[2]!).queryByText(/Dekt/)).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks to check a section the form does not name literally", () => {
    render(
      <ChapterOutline
        outcome={outcome({
          outline: [{ id: "s1", title: "Reflectie", criterionIds: [], unverified: true }],
        })}
      />,
    );
    expect(screen.getByText(/staat niet letterlijk in je formulier/)).toBeInTheDocument();
  });

  it("lists the literature the form names", async () => {
    const { container } = render(
      <ChapterOutline outcome={outcome({ literature: ["Ebbens, S. (2016). Effectief leren."] })} />,
    );
    const region = screen.getByRole("region", { name: "Literatuur die je formulier noemt" });
    expect(within(region).getByText("Ebbens, S. (2016). Effectief leren.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Opzet uit je formulier" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows nothing when the form gave no outline and no literature", () => {
    const { container } = render(<ChapterOutline outcome={outcome()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves the sections out when guided writing lists them, but keeps the literature", () => {
    render(
      <ChapterOutline
        outcome={outcome({
          outline: [{ id: "s1", title: "Beginsituatie", criterionIds: [C2] }],
          literature: ["Ebbens, S., & Ettekoven, S. (2016). Effectief leren."],
        })}
        showOutline={false}
      />,
    );
    expect(screen.queryByRole("region", { name: "Opzet uit je formulier" })).toBeNull();
    expect(screen.getByText(/Ebbens/)).toBeInTheDocument();
  });
});
