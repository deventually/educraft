import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ToastProvider } from "~/components/Toast";
import { CourseEditors } from "~/components/courses/CourseEditors";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAt(node: () => ReactNode, onPost?: (fd: FormData) => void) {
  const Stub = createRoutesStub([
    {
      path: "/page",
      Component: () => <ToastProvider>{node()}</ToastProvider>,
      action: async ({ request }) => {
        onPost?.(await request.formData());
        return { ok: true, intent: "add-editor", message: "Bewerker toegevoegd." };
      },
    },
  ]);
  return render(<Stub initialEntries={["/page"]} />);
}

const bram = { userId: "u-b", name: "Bram" };
const cas = { userId: "u-c", name: "Cas" };

describe("CourseEditors (BESLUIT-2026-11-10-3)", () => {
  it("lets the owner add a team-mate and remove an editor, accessibly", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => <CourseEditors isOwner ownerName="Anna" editors={[bram]} candidates={[cas]} />,
      (fd) => posted.push(fd),
    );
    expect(screen.getByRole("heading", { name: "Samen aan deze cursus werken" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bram weghalen als bewerker" })).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText("Bewerker kiezen"), "u-c");
    await userEvent.click(screen.getByRole("button", { name: "Toevoegen als bewerker" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({ intent: "add-editor", userId: "u-c" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("tells an owner without team-mates how to get them", () => {
    renderAt(() => <CourseEditors isOwner ownerName="Anna" editors={[]} candidates={[]} />);
    expect(screen.getByText(/deelt nog geen team/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Toevoegen als bewerker" })).toBeNull();
  });

  it("shows an editor the owner and the editors, and only a way to stop editing", async () => {
    const { container } = renderAt(() => (
      <CourseEditors isOwner={false} ownerName="Anna" editors={[bram]} candidates={[]} />
    ));
    expect(screen.getByText("Eigenaar: Anna")).toBeTruthy();
    expect(screen.getByText("Bram")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /weghalen/ })).toBeNull();
    expect(screen.queryByLabelText("Bewerker kiezen")).toBeNull();
    expect(screen.getByRole("button", { name: "Stoppen met bewerken" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
