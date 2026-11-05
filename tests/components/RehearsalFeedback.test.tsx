import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { RehearsalFeedback } from "~/components/portfolio/RehearsalFeedback";
import { ToastProvider } from "~/components/Toast";
import { C1, C2, LU, sampleDossier } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const ID = "dossier-1";
const feedback = {
  criteria: [
    {
      criterionId: C1,
      heard: "convincing" as const,
      quote: "Ik begon met een vraag.",
      tip: "Noem ook het effect.",
    },
    { criterionId: C2, heard: "partial" as const },
  ],
  overall: "Een helder gesprek.",
};

function renderFeedback(
  action: (args: { request: Request }) => Promise<unknown> = vi.fn(async () => ({
    ok: true,
    intent: "keepRehearsal",
  })),
) {
  const Stub = createRoutesStub([
    {
      path: `/portfolio/${ID}/rehearsal`,
      Component: () => (
        <ToastProvider>
          <RehearsalFeedback
            dossierId={ID}
            framework={sampleDossier().framework}
            feedback={feedback}
            raw='{"criteria":[]}'
            userTurns={["Ik ben er klaar voor.", "Ik begon met een vraag."]}
            outcomeIds={[LU]}
            model="claude-sonnet-5-5"
          />
        </ToastProvider>
      ),
      action,
    },
  ]);
  return { ...render(<Stub initialEntries={[`/portfolio/${ID}/rehearsal`]} />), action };
}

describe("RehearsalFeedback (29.3)", () => {
  it("shows a table per criterion with headers, quote, tip and a link to the chapter", async () => {
    const { container } = renderFeedback();
    const table = screen.getByRole("table", { name: "Feedback per criterium" });
    expect(within(table).getByRole("columnheader", { name: "Wat we hoorden" })).toBeInTheDocument();
    const row = within(table)
      .getByRole("rowheader", { name: /heldere structuur/ })
      .closest("tr")!;
    expect(row).toHaveTextContent("Overtuigend");
    expect(row).toHaveTextContent("Ik begon met een vraag.");
    expect(row).toHaveTextContent("Noem ook het effect.");
    expect(within(row).getByRole("link", { name: /Werk dit bij in je hoofdstuk/ })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/outcome/${LU}`,
    );
    expect(screen.getByText("Een helder gesprek.")).toBeInTheDocument();
    expect(screen.getByText(/de echte commissie kan anders oordelen/)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("keeps the feedback in the dossier only on the button, with what the server re-checks", async () => {
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const fd = await request.formData();
      expect(fd.get("intent")).toBe("keepRehearsal");
      expect(fd.get("raw")).toBe('{"criteria":[]}');
      expect(JSON.parse(String(fd.get("userTurns")))).toHaveLength(2);
      expect(JSON.parse(String(fd.get("outcomeIds")))).toEqual([LU]);
      expect(fd.get("model")).toBe("claude-sonnet-5-5");
      return { ok: true, intent: "keepRehearsal" };
    });
    renderFeedback(action);
    expect(action).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Bewaar in je dossier" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("link", { name: "Bekijk je dossier" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}`,
    );
  });
});
