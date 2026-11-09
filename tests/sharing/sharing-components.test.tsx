import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ToastProvider } from "~/components/Toast";
import { ShareWithTeam } from "~/components/sharing/ShareWithTeam";
import { SharedWithMe } from "~/components/sharing/SharedWithMe";
import SharedCoursePage from "~/routes/courses.shared.$id";
import SharedRubricPage from "~/routes/utilities.rubric.shared.$id";
import { alignedCourse } from "../courses/fixtures";
import { sampleRubric } from "../utilities/fixtures";
import { coverageMatrix } from "~/lib/courses/alignment";

// biome-ignore lint/suspicious/noExplicitAny: route components take generated prop types
type AnyPage = (props: any) => ReactNode;
const CoursePage = SharedCoursePage as AnyPage;
const RubricPage = SharedRubricPage as AnyPage;

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAt(node: () => ReactNode, onPost?: (fd: FormData) => void) {
  const Stub = createRoutesStub([
    {
      path: "/page",
      Component: () => <ToastProvider>{node()}</ToastProvider>,
      action: async ({ request }) => {
        onPost?.(await request.formData());
        return { ok: true, intent: "share", message: "Gedeeld met je team." };
      },
    },
  ]);
  return render(<Stub initialEntries={["/page"]} />);
}

const teams = [
  { id: "t1", name: "Verpleegkunde" },
  { id: "t2", name: "Techniek" },
];

describe("ShareWithTeam (P28.4)", () => {
  it("shows nothing without a team", () => {
    const { container } = renderAt(() => <ShareWithTeam teams={[]} sharedWith={[]} />);
    expect(container.textContent).toBe("");
  });

  it("offers to share per team and to stop where it is shared, accessibly", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => <ShareWithTeam teams={teams} sharedWith={["t1"]} />,
      (fd) => posted.push(fd),
    );
    expect(screen.getByRole("heading", { name: /Delen met je team/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Stoppen met delen met Verpleegkunde" }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Delen met Techniek" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({ intent: "share", teamId: "t2" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("folds away on a page with several items and sends the item id along", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => <ShareWithTeam teams={teams} sharedWith={[]} fields={{ id: "p1" }} collapsible />,
      (fd) => posted.push(fd),
    );
    await userEvent.click(screen.getByText("Delen met je team"));
    await userEvent.click(screen.getByRole("button", { name: "Delen met Verpleegkunde" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({ id: "p1", intent: "share", teamId: "t1" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("SharedWithMe (P28.4)", () => {
  const items = [{ id: "c1", name: "Anatomie", ownerName: "Anna", teamNames: ["Verpleegkunde"] }];

  it("lists colleagues' items with the owner and a copy button, accessibly", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => <SharedWithMe items={items} viewHref={(id) => `/courses/shared/${id}`} />,
      (fd) => posted.push(fd),
    );
    expect(screen.getByRole("heading", { name: /Van mijn team/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Anatomie" }).getAttribute("href")).toBe(
      "/courses/shared/c1",
    );
    expect(screen.getByText("Van Anna · Verpleegkunde")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Maak een kopie van Anatomie" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({ intent: "copy-shared", id: "c1" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows nothing when nothing is shared", () => {
    const { container } = renderAt(() => <SharedWithMe items={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("the read-only pages (P28.4)", () => {
  it("a shared course: read only, a copy button, the work folded, no edit fields", async () => {
    const data = alignedCourse();
    const loaderData = {
      course: { id: "c1", name: "Anatomie", ownerName: "Anna", data },
      matrix: coverageMatrix(data),
      work: [
        {
          generationId: "g1",
          toolName: { nl: "Les voorbereiden", en: "Prepare a lesson" },
          itemTitle: null,
          createdAt: new Date("2026-11-01"),
          outputMarkdown: "# Lesopzet",
        },
      ],
    };
    const { container } = renderAt(() => <CoursePage loaderData={loaderData} />);
    expect(screen.getByText(/Alleen lezen: dit is van Anna/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Maak een kopie/ })).toBeTruthy();
    expect(screen.getByText("Les voorbereiden")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("a shared rubric: read only, with its criteria and a copy button", async () => {
    const data = sampleRubric();
    const { container } = renderAt(() => (
      <RubricPage loaderData={{ rubric: { id: "r1", name: "Verslag", ownerName: "Anna", data } }} />
    ));
    expect(screen.getByRole("heading", { name: "Analyse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Maak een kopie/ })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
