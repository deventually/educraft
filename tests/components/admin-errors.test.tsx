import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminErrors from "~/routes/admin.errors";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Data = ComponentProps<typeof AdminErrors>["loaderData"];

const errors: Data["errors"] = [
  {
    requestId: "5f0c2a9e-0000-4000-8000-000000000001",
    at: "2026-11-09T10:15:00.000Z",
    method: "POST",
    path: "/portfolio/7",
    name: "TypeError",
    message: "Cannot read properties of undefined (reading 'items')",
    stack: "TypeError: Cannot read properties of undefined\n    at loader (portfolio.tsx:12)",
  },
  {
    requestId: "5f0c2a9e-0000-4000-8000-000000000002",
    at: "2026-11-09T09:00:00.000Z",
    method: "GET",
    path: "/courses/3",
    name: "Error",
    message: "database is locked",
    stack: "Error: database is locked",
  },
];

async function renderPage(data: Data) {
  const Stub = createRoutesStub([
    { path: "/admin/errors", Component: AdminErrors as never, loader: () => data },
  ]);
  const view = render(<Stub initialEntries={["/admin/errors"]} />);
  await screen.findByRole("heading", { name: "Recente fouten" });
  return view;
}

describe("Recente fouten (owner only)", () => {
  it("lists each error with its request id, the page and the message, newest first", async () => {
    await renderPage({ errors, max: 50, timeZone: "Europe/Amsterdam" });
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("5f0c2a9e-0000-4000-8000-000000000001")).toBeInTheDocument();
    expect(within(rows[0]).getByText("POST /portfolio/7")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/reading .items./)).toBeInTheDocument();
    expect(within(rows[1]).getByText("GET /courses/3")).toBeInTheDocument();
  });

  it("shows the time to the second in the school's time zone (UTC 10:15:00 = 11:15:00)", async () => {
    await renderPage({ errors, max: 50, timeZone: "Europe/Amsterdam" });
    expect(screen.getByText(/11:15:00/)).toBeInTheDocument();
  });

  it("shows the technical details (stack) only on request", async () => {
    await renderPage({ errors, max: 50, timeZone: "Europe/Amsterdam" });
    const [first] = screen.getAllByText("Technische details");
    expect(screen.queryByText(/at loader/)).not.toBeVisible();
    await userEvent.click(first);
    expect(screen.getByText(/at loader/)).toBeVisible();
  });

  it("explains that the list starts empty after a restart and where the full log is", async () => {
    await renderPage({ errors, max: 50, timeZone: "Europe/Amsterdam" });
    expect(
      screen.getByText(/laatste 50 onverwachte fouten sinds de laatste herstart/),
    ).toBeInTheDocument();
    expect(screen.getByText(/serverlog/)).toBeInTheDocument();
  });

  it("says so when nothing went wrong", async () => {
    await renderPage({ errors: [], max: 50, timeZone: "Europe/Amsterdam" });
    expect(screen.getByText("Geen fouten sinds de laatste herstart.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = await renderPage({ errors, max: 50, timeZone: "Europe/Amsterdam" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
