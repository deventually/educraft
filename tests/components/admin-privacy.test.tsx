import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminPrivacy from "~/routes/admin.privacy";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Data = { suggestions: { word: string; teachers: number }[]; shared: string[] };

function renderRoute(loaderData: Data, action?: (args: { request: Request }) => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminPrivacy>;
  const Stub = createRoutesStub([
    {
      path: "/admin/privacy",
      Component: () => (
        <ToastProvider>
          <AdminPrivacy {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ ok: true, intent: "share", word: "Engelmann" })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/privacy"]} />);
}

const full: Data = {
  suggestions: [
    { word: "Engelmann", teachers: 3 },
    { word: "Lave", teachers: 1 },
  ],
  shared: ["Meirieu"],
};

/**
 * The institution's never-words (anonymiseerpoort PR 5): the teachers' words with how many chose
 * each, one button to keep one for everyone, and the shared list with a button to take one off.
 */
describe("Admin never-words", () => {
  it("lists the teachers' words with how many teachers, never who", () => {
    renderRoute(full);
    expect(
      screen.getByRole("heading", { level: 2, name: "Voorstellen van docenten" }),
    ).toBeVisible();
    const table = screen.getByRole("table", { name: /nooit-lijst/i });
    const row = within(table).getByRole("row", { name: /engelmann/i });
    expect(within(row).getByText("3")).toBeVisible();
    expect(
      within(row).getByRole("button", { name: "Engelmann voor iedereen laten staan" }),
    ).toBeVisible();
    expect(screen.getByText(/nooit wie/i)).toBeVisible();
  });

  it("posts one word with one click and says so in a toast", async () => {
    let sent: FormData | undefined;
    renderRoute(full, async ({ request }) => {
      sent = await request.formData();
      return { ok: true, intent: "share", word: "Engelmann" };
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Engelmann voor iedereen laten staan" }),
    );
    await waitFor(() => expect(sent?.get("word")).toBe("Engelmann"));
    expect(sent?.get("intent")).toBe("share");
    expect(await screen.findByText("Engelmann blijft voor iedereen staan.")).toBeInTheDocument();
  });

  it("shows the shared list with a button to take a word off", async () => {
    let sent: FormData | undefined;
    renderRoute(full, async ({ request }) => {
      sent = await request.formData();
      return { ok: true, intent: "unshare", word: "Meirieu" };
    });
    const list = screen.getByRole("list", { name: "Voor de hele instelling" });
    expect(within(list).getByText("Meirieu")).toBeVisible();
    await userEvent.click(within(list).getByRole("button", { name: "Meirieu weghalen" }));
    await waitFor(() => expect(sent?.get("intent")).toBe("unshare"));
    expect(await screen.findByText("Meirieu wordt weer gewoon vervangen.")).toBeInTheDocument();
  });

  it("says so plainly when there is nothing yet", () => {
    renderRoute({ suggestions: [], shared: [] });
    expect(screen.getByText("Nog geen woorden van docenten.")).toBeVisible();
    expect(screen.getByText(/nog geen woorden voor de hele instelling/i)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("has no a11y violations, full and empty", async () => {
    const { container, unmount } = renderRoute(full);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();
    const empty = renderRoute({ suggestions: [], shared: [] });
    expect((await axe(empty.container, axeOpts)).violations).toEqual([]);
  });
});
