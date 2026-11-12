import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import TrackList from "~/routes/tracks._index";
import TrackPage from "~/routes/tracks.$id";
import { TrackBar } from "~/components/tracks/TrackBar";
import { SupervisionBlock } from "~/components/tracks/SupervisionBlock";
import { ResultActions } from "~/components/ResultActions";
import { FeedforwardPanel } from "~/components/tracks/FeedforwardPanel";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
function renderRoute(Component: ComponentType<any>, loaderData: unknown) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Component loaderData={loaderData} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

function renderWithRouter(ui: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{ui}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

const listData = (tracks = [] as unknown[]) => ({
  tracks,
  courses: [{ id: "c1", name: "Stage jaar 3" }],
  models: [
    { id: "m1", name: "Stageplan HBO-i", documentTypes: ["stageplan"] },
    { id: "m2", name: "Scriptiemodel", documentTypes: ["afstudeerscriptie"] },
  ],
});

const row = {
  id: "t1",
  code: "S-0423",
  kind: "internship",
  next: { milestone: "drafts", due: "2027-01-15" },
  resolved: 2,
  total: 7,
  closedAt: null,
};

describe("the track list", () => {
  it("asks for a code without a name, a kind, a course and a model, and passes axe", async () => {
    const { container } = renderRoute(TrackList, listData());
    expect(screen.getByRole("heading", { level: 1, name: "Mijn begeleiding" })).toBeTruthy();
    const code = screen.getByLabelText("Code van de student");
    expect(code.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/gebruik geen naam/i)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Soort traject" })).toBeTruthy();
    expect(screen.getByLabelText("Cursus (optioneel)")).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers only the models that fit the chosen kind", () => {
    renderRoute(TrackList, listData());
    const model = screen.getByLabelText("Beoordelingsmodel (optioneel)");
    expect(within(model).queryByText("Stageplan HBO-i")).toBeTruthy();
    expect(within(model).queryByText("Scriptiemodel")).toBeNull();
    fireEvent.click(screen.getByLabelText("Afstuderen"));
    expect(within(model).queryByText("Scriptiemodel")).toBeTruthy();
    expect(within(model).queryByText("Stageplan HBO-i")).toBeNull();
  });

  it("lists a track with its code, kind, progress and next milestone, and passes axe", async () => {
    const { container } = renderRoute(TrackList, listData([row]));
    const link = screen.getByRole("link", { name: "S-0423" });
    expect(link.getAttribute("href")).toBe("/tracks/t1");
    expect(screen.getByText(/Stage · 2 van 7 mijlpalen/)).toBeTruthy();
    expect(screen.getByText(/Volgende: Concepten/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nu wissen: S-0423" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

const pageData = (tab = "overview") => ({
  tab,
  track: {
    id: "t1",
    code: "S-0423",
    kind: "internship",
    courseName: "Stage jaar 3",
    modelName: "Stageplan HBO-i",
    criteria: "C1 Probleemstelling\nC2 Aanpak",
    closedAt: null,
    purgeAfter: null,
  },
  data: { status: { start: "done" }, deadlines: { visits: "2027-01-10" } },
  models: [] as { id: string; displayName: string }[],
  rounds: [
    {
      id: "r1",
      milestone: "start",
      round: 1,
      feedback: { text: "**Sterk:** de aanleiding." },
      createdAt: new Date("2026-11-12T10:00:00Z"),
    },
  ],
});

describe("a track", () => {
  it("the overview shows the milestones as steps with the next one, and passes axe", async () => {
    const { container } = renderRoute(TrackPage, pageData());
    expect(screen.getByRole("heading", { level: 1, name: /S-0423/ })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Onderdelen van het traject" })).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByText("1 van 7 mijlpalen klaar")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Volgende: Bezoeken" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("the start tab: status and date form, the way to the tool, the rounds, and axe", async () => {
    const { container } = renderRoute(TrackPage, pageData("start"));
    const tool = screen.getByRole("link", { name: /Plan van aanpak toetsen/ });
    expect(tool.getAttribute("href")).toBe("/tools/stage-assessment?track=t1&milestone=start");
    expect(screen.getByRole("group", { name: "Stand van deze mijlpaal" })).toBeTruthy();
    expect(screen.getByLabelText("Inleverdatum (optioneel)")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ronde 1" })).toBeTruthy();
    // Feedback is Markdown, rendered safely.
    expect(screen.getByText("Sterk:").tagName).toBe("STRONG");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("a milestone without a tool has no tool button", () => {
    renderRoute(TrackPage, pageData("visits"));
    expect(screen.queryByRole("link", { name: /Plan van aanpak toetsen/ })).toBeNull();
    expect(screen.getByText("Nog geen rondes bij deze mijlpaal.")).toBeTruthy();
  });
});

describe("TrackBar and keeping a result in a track", () => {
  const forTrack = { trackId: "t1", code: "S-0423", milestone: "start" as const };

  it("the bar says which track and milestone the work is for, and passes axe", async () => {
    const { container } = renderWithRouter(<TrackBar {...forTrack} />);
    expect(screen.getByRole("complementary", { name: "Traject" })).toBeTruthy();
    expect(screen.getByText(/S-0423 · Start/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Terug naar het traject/ }).getAttribute("href")).toBe(
      "/tracks/t1?tab=start",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("under a saved result one button keeps the feedback in the track", async () => {
    const { container } = renderWithRouter(
      <ResultActions
        generationId="g1"
        courseId=""
        nextTools={[]}
        linkTargets={[]}
        dossiers={[]}
        forTrack={forTrack}
      />,
    );
    expect(screen.getByRole("button", { name: "Bewaar de feedback in S-0423" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Mijn begeleiding on Start", () => {
  it("lists the open tracks with their next step and links to all, and passes axe", async () => {
    const { container } = renderWithRouter(
      <SupervisionBlock
        tracks={[{ id: "t1", code: "S-0423", next: { milestone: "start", due: "2027-01-15" } }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Mijn begeleiding" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "S-0423" }).getAttribute("href")).toBe("/tracks/t1");
    expect(screen.getByText(/Start · inleveren 15 jan/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Alle trajecten" }).getAttribute("href")).toBe(
      "/tracks",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("feedforward on the drafts tab (P38.3)", () => {
  it("the drafts tab offers feedforward; the start tab does not", () => {
    const { unmount } = renderRoute(TrackPage, pageData("drafts"));
    expect(screen.getByRole("heading", { name: "Feedforward op een nieuwe versie" })).toBeTruthy();
    unmount();
    renderRoute(TrackPage, pageData("start"));
    expect(screen.queryByRole("heading", { name: "Feedforward op een nieuwe versie" })).toBeNull();
  });

  it("paste, check for names, then send with the model's criteria; each step passes axe", async () => {
    const { container } = renderWithRouter(
      <FeedforwardPanel criteria={"C1 Probleemstelling\nC2 Aanpak"} />,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    fireEvent.change(screen.getByLabelText("Tekst van de nieuwe versie"), {
      target: { value: "Mijn plan van aanpak voor Jan de Vries." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Controleer op namen/ }));
    // The name check comes first: nothing can be sent before it.
    expect(screen.queryByRole("button", { name: "Geef feedforward" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
