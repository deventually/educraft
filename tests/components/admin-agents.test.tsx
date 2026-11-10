import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminAgents from "~/routes/admin.agents";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  main: "on",
  agents: [
    {
      id: "assessment-expert",
      role: { nl: "Toetsdeskundige", en: "Assessment expert" },
      watches: ["course", "generation"],
      stand: "on",
    },
    {
      id: "designer",
      role: { nl: "Ontwerper", en: "Designer" },
      watches: ["course"],
      stand: "off",
    },
  ],
};

function renderRoute(action?: (args: { request: Request }) => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminAgents>;
  const Stub = createRoutesStub([
    {
      path: "/admin/agents",
      Component: () => (
        <ToastProvider>
          <AdminAgents {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/agents"]} />);
}

describe("Admin role agents", () => {
  const table = () => screen.getByRole("table", { name: /reviewers/i });

  it("shows the main switch with the three stands", () => {
    renderRoute();
    expect(screen.getByRole("heading", { name: "Reviewteam" })).toBeVisible();
    const main = screen.getByRole("combobox", { name: /reviewteam voor docenten/i });
    expect(main).toHaveValue("on");
    expect(
      within(main)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Aan", "Op aanvraag", "Uit"]);
  });

  it("says that teams cannot switch the role agents (BESLUIT-2026-11-05-11)", () => {
    renderRoute();
    expect(screen.getByText(/een team kan het reviewteam niet aan- of uitzetten/i)).toBeVisible();
  });

  it("lists every hat with what it looks at and an On / Off switch", () => {
    renderRoute();
    const assessor = within(table()).getByRole("row", { name: /toetsdeskundige/i });
    expect(within(assessor).getByText(/cursus, gekoppelde toetsvragen/i)).toBeVisible();
    expect(within(assessor).getByRole("combobox", { name: /toetsdeskundige/i })).toHaveValue("on");
    const designer = within(table()).getByRole("combobox", { name: /ontwerper/i });
    expect(designer).toHaveValue("off");
    expect(
      within(designer)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Aan", "Uit"]);
  });

  it("autosaves a hat with its id and one toast, no save button", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    await user.selectOptions(within(table()).getByRole("combobox", { name: /ontwerper/i }), "on");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/opgeslagen/i));
    expect(body?.get("intent")).toBe("agent");
    expect(body?.get("id")).toBe("designer");
    expect(body?.get("stand")).toBe("on");
  });

  it("autosaves the main switch", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: /reviewteam voor docenten/i }),
      "off",
    );
    await waitFor(() => expect(body?.get("intent")).toBe("main"));
    expect(body?.get("stand")).toBe("off");
  });

  it("says the hats rest while the main switch is off", () => {
    loaderData.main = "off";
    try {
      renderRoute();
      expect(screen.getByText(/kijkt geen enkele reviewer mee/i)).toBeVisible();
    } finally {
      loaderData.main = "on";
    }
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
