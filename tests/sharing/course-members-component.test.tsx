import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ToastProvider } from "~/components/Toast";
import { CourseMembers } from "~/components/courses/CourseMembers";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAt(node: () => ReactNode, onPost?: (fd: FormData) => void) {
  const Stub = createRoutesStub([
    {
      path: "/page",
      Component: () => <ToastProvider>{node()}</ToastProvider>,
      action: async ({ request }) => {
        onPost?.(await request.formData());
        return { ok: true, intent: "set-member", message: "Opgeslagen." };
      },
    },
  ]);
  return render(<Stub initialEntries={["/page"]} />);
}

const bram = { userId: "u-b", name: "Bram", role: "editor" as const };
const cas = { userId: "u-c", name: "Cas" };

describe("CourseMembers (BESLUIT-2026-11-10-5)", () => {
  it("lets a manager add a team-mate as co-owner, change a role and remove someone, accessibly", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => (
        <CourseMembers
          myRole="owner"
          ownerName="Anna"
          members={[bram]}
          candidates={[cas]}
          transferTo={[]}
        />
      ),
      (fd) => posted.push(fd),
    );
    expect(screen.getByRole("heading", { name: "Samen aan deze cursus werken" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bram weghalen" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Rol van Bram" })).toHaveValue("editor");

    await userEvent.selectOptions(screen.getByLabelText("Collega"), "u-c");
    await userEvent.selectOptions(screen.getByLabelText("Rol"), "co-owner");
    await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({
      intent: "set-member",
      userId: "u-c",
      role: "co-owner",
    });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("tells an owner without team-mates how to get them", () => {
    renderAt(() => (
      <CourseMembers myRole="owner" ownerName="Anna" members={[]} candidates={[]} transferTo={[]} />
    ));
    expect(screen.getByText(/deelt nog geen team/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Toevoegen" })).toBeNull();
  });

  it("shows an editor the owner and the members, and only a way to stop", async () => {
    const { container } = renderAt(() => (
      <CourseMembers
        myRole="editor"
        ownerName="Anna"
        members={[bram]}
        candidates={[]}
        transferTo={[]}
      />
    ));
    expect(screen.getByText("Eigenaar: Anna")).toBeTruthy();
    expect(screen.getByText(/Bram/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /weghalen/ })).toBeNull();
    expect(screen.queryByLabelText("Collega")).toBeNull();
    expect(screen.getByRole("button", { name: "Stoppen met meewerken" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lets the owner hand the course to a colleague, staying on as editor by default", async () => {
    const posted: FormData[] = [];
    const { container } = renderAt(
      () => (
        <CourseMembers
          myRole="owner"
          ownerName="Anna"
          members={[bram]}
          candidates={[cas]}
          transferTo={[{ userId: "u-b", name: "Bram" }, cas]}
        />
      ),
      (fd) => posted.push(fd),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cursus overdragen" }));
    const dialog = screen.getByRole("dialog", { name: "Cursus overdragen" });
    expect(dialog.textContent).toMatch(/onderwijscontext gaat niet mee/);
    expect(screen.getByRole("checkbox", { name: "Ik blijf meewerken als bewerker" })).toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText("Nieuwe eigenaar"), "u-c");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Overdragen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({
      intent: "transfer-course",
      userId: "u-c",
      keepAsEditor: "on",
    });
  });

  it("offers no hand-over to a co-owner or without colleagues", () => {
    renderAt(() => (
      <CourseMembers
        myRole="co-owner"
        ownerName="Anna"
        members={[]}
        candidates={[]}
        transferTo={[]}
      />
    ));
    expect(screen.queryByRole("button", { name: "Cursus overdragen" })).toBeNull();
  });
});
