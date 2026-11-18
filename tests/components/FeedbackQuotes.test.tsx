import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub, useActionData } from "react-router";
import {
  FeedbackQuotes,
  type QuotesItem,
  type QuotesProposal,
} from "~/components/portfolio/FeedbackQuotes";
import { SendRound } from "~/components/privacy/SendRound";
import { useSendRound } from "~/lib/hooks/useSendRound";
import { C1, C2, LU } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const outcomes = [
  {
    id: LU,
    code: "LU1",
    title: "Doceren",
    criteria: [
      { id: C1, text: "Heldere structuur." },
      { id: C2, text: "Sluit aan bij de beginsituatie." },
    ],
  },
];

const TEXT =
  "Je startte met een vraag en iedereen dacht mee. Je kwam terug op de fouten van vorige week. Groet, Marieke de Groot";
const item: QuotesItem = { id: "fb-1", title: "Feedback werkplekbegeleider", text: TEXT };

type Posted = Record<string, string>;

function renderPage(stored: QuotesItem = item) {
  const posted: Posted[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    const fd = Object.fromEntries(await request.formData()) as Posted;
    posted.push(fd);
    if (fd.intent === "proposeQuotes")
      return {
        ok: true,
        intent: "proposeQuotes",
        evidenceId: "fb-1",
        quotes: [
          { criterionId: C1, text: "Je startte met een vraag en iedereen dacht mee." },
          { criterionId: C2, text: "Je kwam terug op de fouten van vorige week." },
        ],
        dropped: 1,
      };
    return { ok: true, intent: "chooseQuotes", evidenceId: "fb-1", saved: 1 };
  });
  function Page() {
    const data = useActionData() as (QuotesProposal & { intent?: string }) | undefined;
    const round = useSendRound({ known: { colleagues: [] }, never: [] }, data, "proposeQuotes");
    return (
      <main>
        <SendRound round={round} />
        <FeedbackQuotes
          item={stored}
          outcomes={outcomes}
          round={round}
          {...(data?.intent === "proposeQuotes" ? { proposal: data } : {})}
        />
      </main>
    );
  }
  const Stub = createRoutesStub([{ path: "/", Component: Page, action }]);
  return { ...render(<Stub initialEntries={["/"]} />), action, posted };
}

describe("FeedbackQuotes", () => {
  it("asks who gave the feedback and has no axe violations", async () => {
    const { container } = renderPage();
    expect(screen.getByRole("heading", { name: "Feedback werkplekbegeleider" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Van wie is deze feedback?" })).toBeTruthy();
    expect(screen.getByLabelText("Naam")).toBeTruthy();
    expect((screen.getByLabelText("Rol") as HTMLSelectElement).value).toBe("workplace-supervisor");
    expect(screen.getByText("Nog geen citaten gekozen.")).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the overview first, sends no text from the page, and also replaces the giver's name", async () => {
    const { posted } = renderPage();
    await userEvent.type(screen.getByLabelText("Naam"), "Marieke de Groot");
    await userEvent.click(screen.getByRole("button", { name: "Stel citaten voor" }));
    expect(posted).toHaveLength(0);
    // The overview lists the giver's name, which the gate will replace.
    expect(screen.getAllByText(/Marieke de Groot/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Versturen" }));
    await screen.findByRole("group", { name: "Citaten per criterium" });
    expect(posted[0]).toMatchObject({ intent: "proposeQuotes", evidenceId: "fb-1", role: "workplace-supervisor" });
    expect(Object.values(posted[0]!).join(" ")).not.toContain("iedereen dacht mee");
    expect(JSON.parse(posted[0]!.privacy!).replace).toEqual(["Marieke de Groot"]);
  });

  it("lists the proposals per criterion, unticked, and stores only what is ticked", async () => {
    const { container, posted } = renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Stel citaten voor" }));
    await userEvent.click(screen.getByRole("button", { name: "Versturen" }));
    const group = await screen.findByRole("group", { name: /LU1 Doceren · criterium 2/ });
    const box = within(group).getByRole("checkbox", {
      name: "“Je kwam terug op de fouten van vorige week.”",
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(/1 voorstel weggelaten/)).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await userEvent.click(box);
    await userEvent.type(screen.getByLabelText("Naam"), "M. de Groot");
    await userEvent.click(screen.getByRole("button", { name: "Bewaar" }));
    const saved = posted.at(-1)!;
    expect(saved).toMatchObject({ intent: "chooseQuotes", giver: "M. de Groot", role: "workplace-supervisor" });
    expect(JSON.parse(saved.quotes!)).toEqual([
      { criterionId: C2, text: "Je kwam terug op de fouten van vorige week." },
    ]);
  });

  it("shows the stored choice ticked, with who gave it", () => {
    renderPage({
      ...item,
      feedback: {
        giver: "M. de Groot",
        role: "expert",
        date: "2026-11-12",
        quotes: [{ criterionId: C1, text: "Je startte met een vraag en iedereen dacht mee." }],
      },
    });
    expect((screen.getByLabelText("Naam") as HTMLInputElement).value).toBe("M. de Groot");
    expect((screen.getByLabelText("Rol") as HTMLSelectElement).value).toBe("expert");
    expect((screen.getByLabelText("Datum") as HTMLInputElement).value).toBe("2026-11-12");
    const box = screen.getByRole("checkbox", {
      name: "“Je startte met een vraag en iedereen dacht mee.”",
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByRole("button", { name: "Stel opnieuw voor" })).toBeTruthy();
  });
});
