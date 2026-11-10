import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ToastProvider } from "~/components/Toast";
import { PersonCourses } from "~/components/admin/PersonCourses";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAt(node: () => ReactNode, onPost?: (fd: FormData) => void) {
  const Stub = createRoutesStub([
    {
      path: "/page",
      Component: () => <ToastProvider>{node()}</ToastProvider>,
      action: async ({ request }) => {
        onPost?.(await request.formData());
        return { coursesTransferred: 1 };
      },
    },
  ]);
  return render(<Stub initialEntries={["/page"]} />);
}

const colleagues = [
  { userId: "u-b", name: "Bram" },
  { userId: "u-c", name: "Cas" },
];
const list = [
  {
    id: "c-1",
    name: "Biologie",
    members: [{ userId: "u-b", name: "Bram", role: "co-owner" as const }],
  },
  { id: "c-2", name: "Scheikunde", members: [] },
];

describe("PersonCourses (BESLUIT-2026-11-10-5)", () => {
  it("lets the admin hand one course to a colleague, accessibly", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => <PersonCourses list={list} colleagues={colleagues} />,
      (fd) => posted.push(fd),
    );
    expect(screen.getByRole("heading", { name: "Cursussen" })).toBeTruthy();
    const bio = screen.getByRole("group", { name: "Biologie" });
    expect(within(bio).getByText(/Bram · Mede-eigenaar/)).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await userEvent.selectOptions(within(bio).getByLabelText("Nieuwe eigenaar"), "u-c");
    await userEvent.click(within(bio).getByRole("button", { name: "Biologie overdragen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({
      intent: "transferCourse",
      courseId: "c-1",
      toId: "u-c",
    });
  });

  it("hands all courses over at once and adds a member", async () => {
    const posted: FormData[] = [];
    renderAt(
      () => <PersonCourses list={list} colleagues={colleagues} />,
      (fd) => posted.push(fd),
    );
    await userEvent.selectOptions(screen.getByLabelText("Alle cursussen naar"), "u-b");
    await userEvent.click(screen.getByRole("button", { name: "Alles overdragen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]!.get("intent")).toBe("transferAllCourses");

    const chem = screen.getByRole("group", { name: "Scheikunde" });
    await userEvent.selectOptions(within(chem).getByLabelText("Collega"), "u-c");
    await userEvent.click(within(chem).getByRole("button", { name: "Toevoegen" }));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(Object.fromEntries(posted[1]!)).toEqual({
      intent: "courseMember",
      courseId: "c-2",
      userId: "u-c",
      role: "editor",
    });
  });

  it("says so when the teacher has no courses", () => {
    renderAt(() => <PersonCourses list={[]} colleagues={colleagues} />);
    expect(screen.getByText("Geen eigen cursussen.")).toBeTruthy();
  });
});
