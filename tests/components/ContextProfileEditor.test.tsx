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
    availableCountries: ["NL"],
    availableSectors: ["vo", "mbo", "hbo", "wo"],
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

describe("ContextProfileEditor — stepped flow", () => {
  it("starts at step 1 of 4 with a name field", () => {
    renderEditor();
    expect(screen.getByText(/stap 1 van 4|step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/naam|name/i)).toBeInTheDocument();
  });

  it("gates advancing past step 1 on a name", async () => {
    const user = userEvent.setup();
    renderEditor();
    const next = screen.getByRole("button", { name: /volgende|next/i });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText(/naam|name/i), "Mijn profiel");
    expect(next).toBeEnabled();
  });

  it("hides the country picker when only one country is available", () => {
    const { container } = renderEditor({ availableCountries: ["NL"] });
    expect(screen.queryByLabelText(/^land$|^country$/i)).toBeNull();
    // …but still submits the country as a hidden field.
    expect(sel(container, "country")?.value).toBe("NL");
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
});

describe("ContextProfileEditor — level & framework (step 2)", () => {
  async function toStep2(
    user: ReturnType<typeof userEvent.setup>,
    onderwijstype = "hbo::bachelor",
  ) {
    await user.type(screen.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      onderwijstype,
    );
    await user.click(screen.getByRole("button", { name: /volgende|next/i }));
  }

  it("shows the NLQF level select with a derived-EQF preview and a cited source", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toStep2(user);
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
    await toStep2(user);
    const domain = sel(container, "domain") as HTMLSelectElement;
    const values = Array.from(domain.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("ICT");
    const label = container.querySelector(`label[for="${domain.id}"]`);
    expect(label?.textContent?.trim()).toBe("Domein");
  });

  it("scopes vo domain options to the track's profielen and labels the field 'Profiel'", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await toStep2(user, "vo::havo");
    const domain = sel(container, "domain") as HTMLSelectElement;
    const values = Array.from(domain.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("nt"); // Natuur & Techniek
    expect(values).not.toContain("ICT"); // hbo domain, not offered for vo
    expect(values).not.toContain("zw"); // vmbo profiel, not offered on havo
    const label = container.querySelector(`label[for="${domain.id}"]`);
    expect(label?.textContent?.trim()).toBe("Profiel");
  });

  it("reveals the hbo-i pack with its source when ICT is chosen", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toStep2(user);
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "ICT");
    expect(screen.getByText("Architectuurlagen")).toBeInTheDocument();
    expect(screen.getByText(/hbo-i domeinbeschrijving/i)).toBeInTheDocument();
  });

  it("shows an honest 'no national framework' note for a vo profiel", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toStep2(user, "vo::havo");
    await user.selectOptions(screen.getByLabelText(/profiel|domein|domain/i), "nt");
    expect(screen.getByText(/geen landelijk raamwerk|no national framework/i)).toBeInTheDocument();
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
    // Professional field lives on the (hidden) step 3, but a self-hiding field
    // returning null is absent from the DOM regardless of the active step.
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

describe("ContextProfileEditor — context step (step 3)", () => {
  async function toStep3(user: ReturnType<typeof userEvent.setup>, onderwijstype: string) {
    await user.type(screen.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      onderwijstype,
    );
    await user.click(screen.getByRole("button", { name: /volgende|next/i }));
    await user.click(screen.getByRole("button", { name: /volgende|next/i }));
  }

  it("offers the mbo learner-noun override for mbo only", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toStep3(user, "mbo::mbo-4");
    expect(screen.getByLabelText(/aanspreekvorm|term for learners/i)).toBeInTheDocument();
  });

  it("does NOT offer the learner-noun override for hbo", async () => {
    const user = userEvent.setup();
    renderEditor();
    await toStep3(user, "hbo::bachelor");
    expect(screen.queryByLabelText(/aanspreekvorm|term for learners/i)).toBeNull();
  });

  it("has a free-text pedagogy (onderwijsconcept) field", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await toStep3(user, "hbo::bachelor");
    expect(sel(container, "pedagogy")).not.toBeNull();
  });
});

describe("ContextProfileEditor — edit mode", () => {
  it("prefills every field from the profile", () => {
    const { container } = renderEditor({ profile: ictProfile, isCurrentDefault: true });
    // Edit mode: the hidden id is always present (submits as an update).
    expect(sel(container, "id")?.value).toBe("p1");
    // Basics + axes (hidden inputs/selects resolve regardless of the active step).
    expect(screen.getByDisplayValue("SE jaar 3")).toBeInTheDocument();
    expect(sel(container, "sector")?.value).toBe("hbo");
    expect(sel(container, "track")?.value).toBe("bachelor");
    expect(sel(container, "nationalLevel")?.value).toBe("6");
    expect(sel(container, "domain")?.value).toBe("ICT");
    // Pack selection + custom field + pedagogy carried over (pack lives on a
    // not-yet-active step, so include hidden nodes for the checkbox).
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
  it("has no violations on step 1", async () => {
    const { container } = renderEditor();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no violations on the recap step", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await user.type(screen.getByLabelText(/naam|name/i), "P");
    await user.selectOptions(
      screen.getByLabelText(/onderwijstype|type of education/i),
      "hbo::bachelor",
    );
    for (let i = 0; i < 3; i++)
      await user.click(screen.getByRole("button", { name: /volgende|next/i }));
    expect(screen.getByText(/je maakt aan|you're creating|recap/i)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no violations with a domain pack rendered (edit mode)", async () => {
    const { container } = renderEditor({ profile: ictProfile });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
