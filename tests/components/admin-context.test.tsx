import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminContext from "~/routes/admin.context";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// A small hbo domain group used by both teacher fixtures.
const hboDomainSector = {
  sector: "hbo",
  groups: [
    {
      tracks: [] as string[],
      domains: [
        { value: "ICT", label: "ICT" },
        { value: "Techniek", label: { nl: "Techniek", en: "Engineering" } },
      ],
    },
  ],
};
const havoDomainSector = {
  sector: "vo",
  groups: [
    {
      tracks: ["havo", "vwo"],
      domains: [{ value: "nt", label: { nl: "Natuur & Techniek", en: "Nature & Technology" } }],
    },
  ],
};

// Defaults-all for the instance.
const loaderData = {
  sectors: [
    { id: "vo", checked: true },
    { id: "mbo", checked: true },
    { id: "hbo", checked: true },
    { id: "wo", checked: true },
  ],
  // Instance domain axis: null = all enabled.
  enabledDomains: null,
  domainCatalogueSectors: [hboDomainSector, havoDomainSector],
};

function renderRoute(action?: (args: { request: Request }) => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminContext>;
  const Stub = createRoutesStub([
    {
      path: "/admin/context",
      Component: () => (
        <ToastProvider>
          <AdminContext {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/context"]} />);
}

/** The instance form. */
function instanceForm() {
  return within(screen.getByRole("form", { name: "Onderwijscontext" }));
}

describe("Admin context — instance toggle", () => {
  it("offers no country axis", () => {
    const { container } = renderRoute();
    expect(screen.queryByLabelText(/nederland|netherlands/i)).toBeNull();
    expect(container.querySelector('[name="countries"]')).toBeNull();
  });

  it("offers no per-teacher section", () => {
    const { container } = renderRoute();
    expect(container.querySelector('input[name="customAccess"]')).toBeNull();
    expect(container.querySelector('input[name="userId"]')).toBeNull();
    expect(screen.getAllByRole("form")).toHaveLength(1);
  });

  it("renders a checkbox per sector, pre-checked from settings", () => {
    renderRoute();
    const hbo = instanceForm().getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    const wo = instanceForm().getByLabelText(/wetenschappelijk onderwijs/i) as HTMLInputElement;
    expect(hbo.checked).toBe(true);
    expect(wo.checked).toBe(true);
  });

  it("has no save buttons", () => {
    renderRoute();
    expect(screen.queryAllByRole("button", { name: /opslaan|save|toepassen|apply/i })).toHaveLength(
      0,
    );
  });

  it("autosaves a sector toggle with the whole selection and one toast (mutation)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.click(instanceForm().getByLabelText(/wetenschappelijk onderwijs/i));
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent(/opgeslagen|saved/i);
    expect(body?.get("intent")).toBe("instance");
    expect(body?.getAll("sectors")).toEqual(["vo", "mbo", "hbo"]);
  });

  it("autosaves a domain toggle too", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.click(instanceForm().getByLabelText("ICT"));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(body?.getAll("domains")).not.toContain("ICT");
  });

  it("reverts the checkbox and shows the lockout as a toast when the action refuses", async () => {
    const user = userEvent.setup();
    let posted: FormData | undefined;
    renderRoute(async ({ request }) => {
      posted = await request.formData();
      return { error: "instance-empty" };
    });
    const wo = instanceForm().getByLabelText(/wetenschappelijk onderwijs/i) as HTMLInputElement;
    await user.click(wo);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /minstens één sector|at least one sector/i,
      );
    });
    expect(posted?.getAll("sectors")).not.toContain("wo"); // the refused state was posted
    expect(wo.checked).toBe(true); // sprong terug
    // The toast is the only announcer: no inline error line.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("renders an instance Domains section: a checkbox per catalogue slug, name=domains, all-checked (null)", () => {
    renderRoute();
    const ict = instanceForm().getByLabelText("ICT") as HTMLInputElement;
    expect(ict.name).toBe("domains");
    expect(ict.checked).toBe(true);
    // The vo profiel is offered too (grouped under its sector's details).
    expect(instanceForm().getByLabelText(/Natuur & Techniek/)).toBeInTheDocument();
  });
});

describe("Admin context — a11y", () => {
  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
