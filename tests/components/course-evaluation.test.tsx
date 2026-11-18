import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseEvaluationPanel } from "~/components/courses/CourseEvaluationPanel";
import type { CourseEvaluation } from "~/lib/courses/evaluation";
import { ACT1, alignedCourse, TEST1 } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const models = [
  { id: "claude-sonnet-5-5", displayName: "Sonnet 5.5" },
  { id: "claude-opus-5-5", displayName: "Opus 5.5" },
];

function renderPanel(result: CourseEvaluation | null = null) {
  const posted: Record<string, string>[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    posted.push(Object.fromEntries(await request.formData()) as Record<string, string>);
    return { ok: true };
  });
  const Stub = createRoutesStub([
    {
      path: "/",
      action,
      Component: () => (
        <CourseEvaluationPanel
          data={alignedCourse()}
          result={result}
          models={models}
          privacy={{ known: { colleagues: [] }, never: [] }}
        />
      ),
    },
  ]);
  return { ...render(<Stub initialEntries={["/"]} />), posted };
}

const result: CourseEvaluation = {
  respondents: 8,
  small: true,
  themes: [
    { label: "Tempo", polarity: "negative", count: 3, quotes: ["Normaliseren ging te snel."] },
    { label: "Eindopdracht", polarity: "positive", count: 2, quotes: [] },
  ],
  problems: [
    { place: { kind: "activity", id: ACT1 }, text: "Te hoog tempo.", basis: "students" },
    { place: { kind: "assessment", id: TEST1 }, text: "Was vraag 3 te vaag?", basis: "question" },
  ],
  improvements: [
    { place: { kind: "activity", id: ACT1 }, text: "Spreid normaliseren over twee lessen." },
    { place: { kind: "course" }, text: "Deel het rooster eerder." },
  ],
};

// Seam: the rendered forms; the name check runs in the browser before any text leaves.
describe("CourseEvaluationPanel (P33.3)", () => {
  it("asks for the answers, then shows per word what is replaced, and sends only after Versturen", async () => {
    const { container, posted } = renderPanel();
    const region = screen.getByRole("region", { name: "Cursusevaluatie verwerken" });
    expect(within(region).getByLabelText("Antwoorden van studenten")).toBeRequired();
    expect(within(region).getByLabelText("Of kies een CSV-bestand")).toHaveAttribute(
      "accept",
      ".csv,.txt,text/csv,text/plain",
    );
    expect(within(region).getByLabelText("Aantal respondenten")).toHaveAttribute("type", "number");
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    fireEvent.change(within(region).getByLabelText("Antwoorden van studenten"), {
      target: { value: "Jansen legde te snel uit.\nNormaliseren ging te snel." },
    });
    fireEvent.change(within(region).getByLabelText("Aantal respondenten"), {
      target: { value: "12" },
    });
    fireEvent.change(within(region).getByLabelText("Model"), {
      target: { value: "claude-opus-5-5" },
    });
    fireEvent.click(within(region).getByRole("button", { name: "Namen controleren" }));
    const overview = screen.getByRole("region", { name: "Kijk na wat er naar de AI gaat" });
    expect(within(overview).getByRole("heading")).toHaveFocus();
    fireEvent.change(within(overview).getByLabelText("Nog een woord vervangen"), {
      target: { value: "Jansen" },
    });
    fireEvent.click(within(overview).getByRole("button", { name: "Ook vervangen" }));
    expect(within(overview).getByText("Jansen (1×)")).toBeInTheDocument();
    expect(posted).toHaveLength(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    fireEvent.click(within(overview).getByRole("button", { name: "Versturen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      intent: "evaluate-course",
      respondents: "12",
      model: "claude-opus-5-5",
      evaluation: "[ANDER-1] legde te snel uit.\nNormaliseren ging te snel.",
    });
    expect(posted[0]?.course).toBeUndefined();
  });

  it("fills the answers and the respondents from a CSV", async () => {
    renderPanel();
    const csv = 'Naam;Cijfer;Opmerking\n;8;"Fijne les"\n;6;Te snel\n';
    const file = new File([csv], "enquete.csv", { type: "text/csv" });
    const input = screen.getByLabelText("Of kies een CSV-bestand");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    expect(await screen.findByDisplayValue(/Fijne les\s+Te snel/)).toBeInTheDocument();
    expect(screen.getByLabelText("Aantal respondenten")).toHaveValue(2);
  });

  it("shows the three blocks, warns for a small group, and accepts or rejects an improvement", async () => {
    const { container } = renderPanel(result);
    expect(screen.getByText(/Minder dan 10 respondenten/)).toBeVisible();
    const said = screen.getByRole("region", { name: "Wat zeiden studenten" });
    expect(within(said).getByText("Tempo")).toBeVisible();
    expect(within(said).getByText("Normaliseren ging te snel.")).toBeVisible();
    const wrong = screen.getByRole("region", { name: "Waar ging het mis" });
    expect(within(wrong).getByText(/Les of opdracht: Les normaliseren/)).toBeVisible();
    expect(within(wrong).getByText(/Vraag voor jou/)).toBeVisible();
    const better = screen.getByRole("region", { name: "Wat kan er beter" });
    const items = within(better).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const accept = within(items[0]!).getByRole("button", { name: "Akkoord" });
    expect(accept).toHaveAccessibleDescription("Spreid normaliseren over twee lessen.");
    const form = accept.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("add-improvement");
    expect(form.querySelector('input[name="source"]')).toHaveValue("evaluation");
    expect(form.querySelector('input[name="place"]')).toHaveValue(`activity:${ACT1}`);
    expect(form.querySelector('input[name="text"]')).toHaveValue(
      "Spreid normaliseren over twee lessen.",
    );

    // "Niet akkoord" posts nothing: the point just goes.
    const reject = within(items[1]!).getByRole("button", { name: "Niet akkoord" });
    expect(reject.closest("form")).toBeNull();
    fireEvent.click(reject);
    expect(within(better).getAllByRole("listitem")).toHaveLength(1);
    // Focus stays in the list instead of falling to the page top.
    expect(within(better).getByRole("button", { name: "Akkoord" })).toHaveFocus();
    fireEvent.click(within(better).getByRole("button", { name: "Niet akkoord" }));
    expect(within(better).getByRole("heading", { name: "Wat kan er beter" })).toHaveFocus();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
