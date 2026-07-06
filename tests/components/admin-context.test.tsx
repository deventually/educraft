import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminContext from "~/routes/admin.context";

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

// Defaults-all for the instance; two teachers — one activated + restricted, one
// inheriting (custom access off).
const loaderData = {
  countries: [{ id: "NL", checked: true }],
  sectors: [
    { id: "vo", checked: true },
    { id: "mbo", checked: true },
    { id: "hbo", checked: true },
    { id: "wo", checked: true },
  ],
  // Instance domain axis: null = all enabled. The shared catalogue is used for
  // both the instance section and every teacher (activation ignores the instance).
  enabledDomains: null,
  domainCatalogueSectors: [hboDomainSector, havoDomainSector],
  teachers: [
    {
      id: "t-restricted",
      name: "Docent Beperkt",
      email: "beperkt@school.nl",
      customAccess: true,
      countries: ["NL"],
      sectors: ["mbo"],
      domains: ["ICT"],
    },
    {
      id: "t-open",
      name: "Docent Open",
      email: null,
      customAccess: false,
      countries: null,
      sectors: null,
      domains: null,
    },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminContext>;
  const Stub = createRoutesStub([
    {
      path: "/admin/context",
      Component: () => <AdminContext {...props} />,
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/context"]} />);
}

/** The instance-toggle form, scoped so per-teacher forms don't shadow its labels. */
function instanceForm() {
  return within(screen.getByRole("form", { name: "Onderwijscontext" }));
}

describe("Admin context — instance toggle", () => {
  it("renders a checkbox per country, pre-checked from settings", () => {
    renderRoute();
    const nl = instanceForm().getByLabelText("Nederland") as HTMLInputElement;
    expect(nl.checked).toBe(true);
  });

  it("renders a checkbox per sector, pre-checked from settings", () => {
    renderRoute();
    const hbo = instanceForm().getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    const wo = instanceForm().getByLabelText(/wetenschappelijk onderwijs/i) as HTMLInputElement;
    expect(hbo.checked).toBe(true);
    expect(wo.checked).toBe(true);
  });

  it("surfaces the lockout guard when the action rejects an empty selection", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "instance-empty" }));
    await user.click(instanceForm().getByRole("button", { name: /opslaan|save/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
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

describe("Admin context — activate custom access (P12)", () => {
  it("checks the toggle for an activated teacher and unchecks it for an inheriting one", () => {
    renderRoute();
    const restricted = within(screen.getByRole("form", { name: "Docent Beperkt" }));
    const open = within(screen.getByRole("form", { name: "Docent Open" }));
    const rBox = restricted.getByLabelText(/aangepaste toegang|custom access/i) as HTMLInputElement;
    const oBox = open.getByLabelText(/aangepaste toegang|custom access/i) as HTMLInputElement;
    expect(rBox).toHaveAttribute("name", "customAccess");
    expect(rBox.checked).toBe(true);
    expect(oBox.checked).toBe(false);
  });

  it("disables the axis controls until custom access is activated, then enables them", async () => {
    const user = userEvent.setup();
    renderRoute();
    const open = within(screen.getByRole("form", { name: "Docent Open" }));
    const mbo = open.getByLabelText(/middelbaar beroepsonderwijs/i) as HTMLInputElement;
    expect(mbo.disabled).toBe(true); // inheriting → controls disabled
    await user.click(open.getByLabelText(/aangepaste toegang|custom access/i));
    expect(mbo.disabled).toBe(false); // activating enables them
  });
});

describe("Admin context — per-teacher assignment", () => {
  it("renders one form per teacher carrying its userId + intent", () => {
    renderRoute();
    const form = screen.getByRole("form", { name: "Docent Beperkt" });
    expect(form.querySelector('input[name="intent"]')).toHaveValue("teacher");
    expect(form.querySelector('input[name="userId"]')).toHaveValue("t-restricted");
  });

  it("pre-checks a restricted teacher's assignment only (mbo, not hbo)", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Beperkt" }));
    const mbo = form.getByLabelText(/middelbaar beroepsonderwijs/i) as HTMLInputElement;
    const hbo = form.getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    expect(mbo.checked).toBe(true);
    expect(hbo.checked).toBe(false);
  });

  it("pre-checks everything for an unrestricted teacher (null = all)", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Open" }));
    const mbo = form.getByLabelText(/middelbaar beroepsonderwijs/i) as HTMLInputElement;
    const hbo = form.getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    expect(mbo.checked).toBe(true);
    expect(hbo.checked).toBe(true);
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin context — per-teacher domains (P10.3)", () => {
  it("renders domain checkboxes and pre-checks a restricted teacher's assignment only", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Beperkt" }));
    // ICT is assigned → checked; Techniek is not → unchecked.
    const ict = form.getByLabelText("ICT") as HTMLInputElement;
    const tech = form.getByLabelText("Techniek") as HTMLInputElement;
    expect(ict.name).toBe("domains");
    expect(ict.checked).toBe(true);
    expect(tech.checked).toBe(false);
  });

  it("pre-checks every domain for an unrestricted teacher (null = all)", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Open" }));
    const ict = form.getByLabelText("ICT") as HTMLInputElement;
    expect(ict.checked).toBe(true);
  });

  it("groups vo profielen under a collapsible details for the reachable track(s)", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Beperkt" }));
    // The havo/vwo profiel is present (grouped under the vo sector's details).
    expect(form.getByLabelText(/Natuur & Techniek/)).toBeInTheDocument();
  });
});
