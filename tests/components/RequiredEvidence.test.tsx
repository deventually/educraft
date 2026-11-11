import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { RequiredEvidence } from "~/components/portfolio/RequiredEvidence";
import { requirementChecklist } from "~/lib/portfolio/requirements";
import type { DossierData } from "~/lib/portfolio/types";
import { EV, LU, sampleDossier } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderList(d: DossierData, action = vi.fn(async () => ({ ok: true }))) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <RequiredEvidence
          outcomeId={LU}
          items={requirementChecklist(d, LU)}
          evidence={d.evidence.map(({ id, title }) => ({ id, title }))}
        />
      ),
      action,
    },
  ]);
  return { ...render(<Stub initialEntries={["/"]} />), action };
}

const sent = (action: ReturnType<typeof vi.fn>) => {
  const { request } = action.mock.calls[0]![0] as { request: Request };
  return request.formData();
};

describe("RequiredEvidence (the form's required evidence as a checklist)", () => {
  it("shows each line with a word for its state, never colour alone", async () => {
    const { container } = renderList(sampleDossier());
    const list = screen.getByRole("list", { name: "Verplicht bewijs" });
    const [feedback, video] = within(list).getAllByRole("listitem");
    expect(feedback).toHaveTextContent("Controleren: Feedback van de werkplekbegeleider");
    expect(feedback).toHaveTextContent("Gevonden: Feedback werkplekbegeleider. Klopt dat?");
    expect(video).toHaveTextContent("Ontbreekt: Opname van de les");
    expect(within(video!).getByRole("link", { name: "Nieuw bewijs toevoegen" })).toHaveAttribute(
      "href",
      "#add-evidence-title",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("confirms a guess with one press", async () => {
    const { action } = renderList(sampleDossier());
    await userEvent.click(screen.getByRole("button", { name: "Ja, dit hoort erbij" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const fd = await sent(action);
    expect(Object.fromEntries(fd)).toEqual({
      intent: "linkRequirement",
      outcomeId: LU,
      line: "Feedback van de werkplekbegeleider",
      evidenceId: EV,
      linked: "on",
    });
  });

  it("links an existing item to a missing line", async () => {
    const { action } = renderList(sampleDossier());
    const video = screen.getAllByRole("listitem")[1]!;
    await userEvent.selectOptions(
      within(video).getByLabelText("Kies een bewijsstuk"),
      "Feedback werkplekbegeleider",
    );
    await userEvent.click(within(video).getByRole("button", { name: "Koppel" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    const fd = await sent(action);
    expect(fd.get("line")).toBe("Opname van de les");
    expect(fd.get("evidenceId")).toBe(EV);
    expect(fd.get("linked")).toBe("on");
  });

  it("shows a ticked line as done, with a way to undo the link", async () => {
    const d = sampleDossier();
    d.evidence[0]!.requirements = [{ outcomeId: LU, line: "Opname van de les" }];
    const { action, container } = renderList(d);
    const video = screen.getAllByRole("listitem")[1]!;
    expect(video).toHaveTextContent("Klaar: Opname van de les");
    expect(video).toHaveTextContent("Bewijs: Feedback werkplekbegeleider");
    await userEvent.click(
      within(video).getByRole("button", { name: "Ontkoppel Feedback werkplekbegeleider" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect((await sent(action)).get("linked")).toBe("off");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows nothing when the form asks for no evidence", () => {
    const d = sampleDossier();
    d.framework.outcomes[0]!.requiredEvidence = [];
    const { container } = renderList(d);
    expect(container).toBeEmptyDOMElement();
  });
});
