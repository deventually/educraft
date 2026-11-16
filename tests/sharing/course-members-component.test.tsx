import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  it("adds colleagues through Collega toevoegen, and asks before Weghalen (plan step 6)", async () => {
    const posted: FormData[] = [];
    const user = userEvent.setup();
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
    const list = screen.getByRole("region", { name: "Collega's die meewerken" });
    expect(within(list).getByRole("combobox", { name: "Rol van Bram" })).toHaveValue("editor");
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await user.click(within(list).getByRole("button", { name: "Collega toevoegen" }));
    const add = screen.getByRole("dialog", { name: "Collega's toevoegen" });
    await user.click(within(add).getByRole("checkbox", { name: "Cas" }));
    await user.selectOptions(within(add).getByLabelText("Rol"), "co-owner");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(within(add).getByRole("button", { name: "Toevoegen (1)" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]!.get("intent")).toBe("add-members");
    expect(posted[0]!.getAll("userId")).toEqual(["u-c"]);
    expect(posted[0]!.get("role")).toBe("co-owner");

    await user.click(within(list).getByRole("button", { name: "Weghalen: Bram" }));
    const ask = screen.getByRole("dialog", { name: "Bram weghalen uit deze cursus?" });
    expect(within(ask).getByText(/De cursus blijft zoals hij is/)).toBeTruthy();
    await user.click(within(ask).getByRole("button", { name: "Weghalen" }));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(Object.fromEntries(posted[1]!)).toEqual({ intent: "remove-member", userId: "u-b" });
  });

  it("tells an owner without team-mates how to get them", () => {
    renderAt(() => (
      <CourseMembers myRole="owner" ownerName="Anna" members={[]} candidates={[]} transferTo={[]} />
    ));
    expect(screen.getByText(/deelt nog geen team/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Collega toevoegen" })).toBeNull();
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
    expect(screen.queryByRole("button", { name: /weghalen/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collega toevoegen" })).toBeNull();
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

  it("adds teams through Team toevoegen, changes a role, and asks before Weghalen", async () => {
    const posted: FormData[] = [];
    const user = userEvent.setup();
    const { container } = renderAt(
      () => (
        <CourseMembers
          myRole="owner"
          ownerName="Anna"
          members={[]}
          candidates={[cas]}
          transferTo={[]}
          teams={[{ id: "t-2", name: "Moduleteam Web", role: "editor", members: ["Bram", "Cas"] }]}
          teamCandidates={[{ id: "t-1", name: "Moduleteam Databases" }]}
        />
      ),
      (fd) => posted.push(fd),
    );
    const list = screen.getByRole("region", { name: "Teams die meewerken" });
    expect(within(list).getByText("Bram, Cas")).toBeTruthy();
    expect(within(list).getByRole("combobox", { name: "Rol van Moduleteam Web" })).toHaveValue(
      "editor",
    );
    await user.click(within(list).getByRole("button", { name: "Team toevoegen" }));
    const add = screen.getByRole("dialog", { name: "Teams toevoegen" });
    await user.click(within(add).getByRole("checkbox", { name: "Moduleteam Databases" }));
    await user.selectOptions(within(add).getByLabelText("Rol voor het team"), "co-owner");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(within(add).getByRole("button", { name: "Toevoegen (1)" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]!.get("intent")).toBe("link-teams");
    expect(posted[0]!.getAll("teamId")).toEqual(["t-1"]);
    expect(posted[0]!.get("role")).toBe("co-owner");

    await user.click(within(list).getByRole("button", { name: "Weghalen: Moduleteam Web" }));
    const ask = screen.getByRole("dialog", { name: "Moduleteam Web weghalen uit deze cursus?" });
    await user.click(within(ask).getByRole("button", { name: "Weghalen" }));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(Object.fromEntries(posted[1]!)).toEqual({ intent: "unlink-team", teamId: "t-2" });
  });

  it("shows an editor the linked teams without controls", () => {
    renderAt(() => (
      <CourseMembers
        myRole="editor"
        ownerName="Anna"
        members={[bram]}
        candidates={[]}
        transferTo={[]}
        teams={[{ id: "t-1", name: "Moduleteam", role: "editor", members: ["Bram"] }]}
        teamCandidates={[{ id: "t-3", name: "Ander team" }]}
      />
    ));
    expect(screen.getByText(/Moduleteam/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Team toevoegen" })).toBeNull();
    expect(screen.queryByRole("button", { name: /weghalen/i })).toBeNull();
  });
});
