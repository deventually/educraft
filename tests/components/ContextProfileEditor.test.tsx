import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ContextProfileEditor } from "~/components/context/ContextProfileEditor";
import type { ContextProfile } from "~/lib/context/types";

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Props = ComponentProps<typeof ContextProfileEditor>;

function renderEditor(overrides: Partial<Props> = {}) {
  const props: Props = {
    availableSectors: ["vo", "mbo", "hbo", "wo"],
    availableDomains: null,
    onCancel: () => {},
    ...overrides,
  };
  const Stub = createRoutesStub([
    { path: "/context-profiles", Component: () => <ContextProfileEditor {...props} /> },
  ]);
  return render(<Stub initialEntries={["/context-profiles"]} />);
}

const sel = (container: HTMLElement, name: string) =>
  container.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;

const ictProfile: ContextProfile = {
  id: "p1",
  name: "SE jaar 3",
  country: "NL",
  sector: "hbo",
  track: "bachelor",
  nationalLevel: "6",
  programme: "HBO-ICT",
  domain: "ICT",
  courseName: "Backend",
  pedagogy: "Probleemgestuurd onderwijs",
  packValues: { architectuurlagen: ["Software"], beheersingsniveau: 2 },
  customFields: [{ label: "Specialisatie", value: "Security" }],
};

const MORE = /meer details|more details/i;

/** Open the closed "Meer details (optioneel)" disclosure. */
async function openMore(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText(MORE));
}

describe("ContextProfileEditor — one short page", () => {
  it("is one page without steps", () => {
    renderEditor();
    expect(screen.queryByText(/stap \d van|step \d of/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /volgende|next|vorige|back/i })).toBeNull();
    // One submit button (plus Cancel, which is not a submit).
    const submits = screen
      .getAllByRole("button")
      .filter((b) => (b as HTMLButtonElement).type === "submit");
    expect(submits).toHaveLength(1);
    expect(screen.getByLabelText(/naam|name/i)).toBeInTheDocument();
  });

  it("disables the save button while the name is empty", async () => {
    const user = userEvent.setup();
    renderEditor();
    const save = screen.getByRole("button", { name: /profiel opslaan|save profile/i });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/naam|name/i), "Mijn profiel");
    expect(save).toBeEnabled();
  });

  it("has no country field at all", () => {
    const { container } = renderEditor();
    expect(screen.queryByLabelText(/^land$|^country$/i)).toBeNull();
    expect(sel(container, "country")).toBeNull();
  });

  it("the grouped Onderwijstype picker sets sector + track and prefills the NLQF level", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      "hbo::bachelor",
    );
    expect(sel(container, "sector")?.value).toBe("hbo");
    expect(sel(container, "track")?.value).toBe("bachelor");
    // hbo-bachelor → NLQF 6 prefilled (overridable).
    expect(sel(container, "nationalLevel")?.value).toBe("6");
  });

  it("shows name, onderwijstype, programme, course and study year up front", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      "hbo::bachelor",
    );
    for (const label of [
      /naam|name/i,
      /onderwijstype|type of education/i,
      /opleiding|programme/i,
      /^vak$|^course$/i,
      /studiejaar|study year/i,
    ]) {
      const field = screen.getByLabelText(label);
      expect(field.closest("details"), String(label)).toBeNull();
    }
  });

  it("shows the vo Fase (instead of Studiejaar) up front", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(screen.getByLabelText(/onderwijstype|type of education/i), "vo::havo");
    expect(screen.getByLabelText(/^fase$|^phase$/i).closest("details")).toBeNull();
    expect(screen.queryByLabelText(/studiejaar|study year/i)).toBeNull();
  });

  it("puts level, domain and the free fields under a closed 'Meer details'", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      "hbo::bachelor",
    );
    const details = screen.getByText(MORE).closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    for (const label of [
      /niveau \(nlqf\)|level \(nlqf\)/i,
      /^domein$|^domain$/i,
      /beroepspraktijk|professional field/i,
      /onderwijsconcept|teaching approach|educational concept/i,
    ]) {
      expect(screen.getByLabelText(label).closest("details"), String(label)).toBe(details);
    }
    expect(
      within(details).getByRole("heading", { name: /eigen velden|custom fields/i }),
    ).toBeInTheDocument();
    expect(details.open).toBe(false);
  });

  it("submits the level prefilled from the onderwijstype while 'Meer details' is closed", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await user.type(screen.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      "hbo::bachelor",
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect((screen.getByText(MORE).closest("details") as HTMLDetailsElement).open).toBe(false);
    expect(new FormData(form).get("nationalLevel")).toBe("6");
  });

  it("counts the filled details in the summary when editing", () => {
    renderEditor({ profile: ictProfile });
    // domain + 2 pack fields + pedagogy + 1 custom field.
    expect(screen.getByText(MORE).closest("summary")).toHaveTextContent(/5 ingevuld|5 filled in/);
  });

  it("shows no count when nothing under 'Meer details' is filled", () => {
    renderEditor();
    expect(screen.getByText(MORE).closest("summary")).not.toHaveTextContent(/ingevuld|filled in/);
  });
});

describe("ContextProfileEditor — level & framework (under Meer details)", () => {
  async function toMore(
    user: ReturnType<typeof userEvent.setup>,
    onderwijstype = "hbo::bachelor",
    phase?: "onderbouw" | "bovenbouw",
  ) {
    await user.type(screen.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      onderwijstype,
    );
    // vo's profiel is a bovenbouw concept, so a vo test must pick the fase first.
    if (phase) await user.selectOptions(screen.getByLabelText(/^fase$|^phase$/i), phase);
    await openMore(user);
  }

  it("shows the NLQF level select with a derived-EQF preview and a cited source", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toMore(user);
    expect(screen.getByLabelText(/nlqf|niveau/i)).toBeInTheDocument();
    // Derived EQF preview.
    expect(screen.getByText(/EQF 6/)).toBeInTheDocument();
    // Cited source link to nlqf.nl.
    const link = screen.getByRole("link", { name: /bron|source/i }) as HTMLAnchorElement;
    expect(link.href).toContain("nlqf.nl");
  });

  it("scopes domain options to the chosen sector (hbo → ICT present, labelled 'Domein')", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await toMore(user);
    const domain = sel(container, "domain") as HTMLSelectElement;
    const values = Array.from(domain.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("ICT");
    const label = container.querySelector(`label[for="${domain.id}"]`);
    expect(label?.textContent?.trim()).toBe("Domein");
  });

  it("scopes vo domain options to the track's profielen and labels the field 'Profiel'", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await toMore(user, "vo::havo", "bovenbouw");
    const domain = sel(container, "domain") as HTMLSelectElement;
    const values = Array.from(domain.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("nt"); // Natuur & Techniek
    expect(values).not.toContain("ICT"); // hbo domain, not offered for vo
    expect(values).not.toContain("zw"); // vmbo profiel, not offered on havo
    const label = container.querySelector(`label[for="${domain.id}"]`);
    expect(label?.textContent?.trim()).toBe("Profiel");
  });

  it("hides the vo profiel in the onderbouw (it is a bovenbouw / tweede-fase concept)", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await toMore(user, "vo::havo", "onderbouw");
    expect(sel(container, "domain")).toBeNull();
  });

  it("reveals the hbo-i pack with its source when ICT is chosen", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toMore(user);
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "ICT");
    expect(screen.getByText("Architectuurlagen")).toBeInTheDocument();
    expect(screen.getByText(/hbo-i domeinbeschrijving/i)).toBeInTheDocument();
  });

  it("shows an honest 'no national framework' note for a vo profiel", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toMore(user, "vo::havo", "bovenbouw");
    await user.selectOptions(screen.getByLabelText(/profiel|domein|domain/i), "nt");
    expect(screen.getByText(/geen landelijk raamwerk|no national framework/i)).toBeInTheDocument();
  });

  it("filters the domain dropdown by the teacher's available domains (P10.3)", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ availableDomains: ["nt"] });
    await toMore(user, "vo::havo", "bovenbouw");
    const domain = sel(container, "domain") as HTMLSelectElement;
    const values = Array.from(domain.querySelectorAll("option"))
      .map((o) => o.value)
      .filter(Boolean);
    // Only the assigned profiel survives; ng/em/cm are filtered out.
    expect(values).toEqual(["nt"]);
  });
});

describe("ContextProfileEditor — field relevance (P10.1)", () => {
  /** Render a fresh editor and choose an onderwijstype; return its container. */
  async function editorWith(onderwijstype: string) {
    const { container } = renderEditor();
    const user = userEvent.setup();
    const scope = within(container);
    await user.type(scope.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      scope.getByLabelText(/onderwijstype|type of education/i),
      onderwijstype,
    );
    return container;
  }

  it("hides Programme for havo but shows it for hbo", async () => {
    expect(sel(await editorWith("vo::havo"), "programme")).toBeNull();
    expect(sel(await editorWith("hbo::bachelor"), "programme")).not.toBeNull();
  });

  it("hides the Professional field for havo, keeps it for vmbo and hbo", async () => {
    // Professional field lives on the closed "Meer details", but a self-hiding field
    // returning null is absent from the DOM regardless of the disclosure state.
    expect(sel(await editorWith("vo::havo"), "professionalContext")).toBeNull();
    expect(sel(await editorWith("vo::vmbo-bb"), "professionalContext")).not.toBeNull();
    expect(sel(await editorWith("hbo::bachelor"), "professionalContext")).not.toBeNull();
  });

  it("labels the Course field 'Vak' when a vo track is chosen", async () => {
    const container = await editorWith("vo::havo");
    const course = sel(container, "courseName") as HTMLInputElement;
    expect(course).not.toBeNull();
    const label = container.querySelector(`label[for="${course.id}"]`);
    expect(label?.textContent?.trim()).toBe("Vak");
  });
});

describe("ContextProfileEditor — free fields (under Meer details)", () => {
  async function toDetails(user: ReturnType<typeof userEvent.setup>, onderwijstype: string) {
    await user.type(screen.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      onderwijstype,
    );
    await openMore(user);
  }

  it("offers the mbo learner-noun override for mbo only", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toDetails(user, "mbo::mbo-4");
    expect(screen.getByLabelText(/aanspreekvorm|term for learners/i)).toBeInTheDocument();
  });

  it("does NOT offer the learner-noun override for hbo", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toDetails(user, "hbo::bachelor");
    expect(screen.queryByLabelText(/aanspreekvorm|term for learners/i)).toBeNull();
  });

  it("has a free-text pedagogy (onderwijsconcept) field", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await toDetails(user, "hbo::bachelor");
    expect(sel(container, "pedagogy")).not.toBeNull();
  });
});

describe("ContextProfileEditor — edit mode", () => {
  it("prefills every field from the profile", () => {
    const { container } = renderEditor({ profile: ictProfile, isCurrentDefault: true });
    // Edit mode: the hidden id is always present (submits as an update).
    expect(sel(container, "id")?.value).toBe("p1");
    // Basics + axes (hidden inputs and the closed disclosure stay in the DOM).
    expect(screen.getByDisplayValue("SE jaar 3")).toBeInTheDocument();
    expect(sel(container, "sector")?.value).toBe("hbo");
    expect(sel(container, "track")?.value).toBe("bachelor");
    expect(sel(container, "nationalLevel")?.value).toBe("6");
    expect(sel(container, "domain")?.value).toBe("ICT");
    // Pack selection + custom field + pedagogy carried over (pack lives in a
    // closed disclosure, so include hidden nodes for the checkbox).
    expect(screen.getByRole("checkbox", { name: "Software", hidden: true })).toBeChecked();
    expect(screen.getByDisplayValue("Specialisatie")).toBeInTheDocument();
    expect((sel(container, "pedagogy") as HTMLInputElement).value).toBe(
      "Probleemgestuurd onderwijs",
    );
  });

  it("preserves a legacy stored domain no longer in the track catalogue (P10.2 back-compat)", () => {
    // A pre-P10 flat-vo profile stored a kernvak slug that the track catalogue no
    // longer offers — the editor keeps it as a selected option so opening +
    // editing doesn't silently blank it.
    const legacy = {
      id: "leg",
      name: "Legacy vo",
      country: "NL",
      sector: "vo",
      track: "havo",
      domain: "nederlands",
    } as ContextProfile;
    const { container } = renderEditor({ profile: legacy });
    const domain = sel(container, "domain") as HTMLSelectElement;
    expect(domain.value).toBe("nederlands");
    const values = Array.from(domain.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("nederlands");
  });
});

describe("ContextProfileEditor — a11y", () => {
  it("has no violations with 'Meer details' closed", async () => {
    const { container } = renderEditor();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no violations with 'Meer details' open", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      "hbo::bachelor",
    );
    await openMore(user);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no violations open with a domain pack rendered (edit mode)", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor({ profile: ictProfile });
    await openMore(user);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
