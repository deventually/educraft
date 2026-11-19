import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminOrganisation from "~/routes/admin.organisation";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const data = {
  kind: "faculty" as const,
  kinds: [{ value: "hbo:bachelor", label: "hbo-bachelor" }],
  teams: [{ id: "t-1", name: "Team VPK" }],
  divisions: [
    {
      id: "d-1",
      name: "Faculteit Gezondheid",
      programmeCount: 1,
      teams: [{ id: "t-9", name: "Onderwijscommissie" }],
    },
    { id: "d-2", name: "Faculteit Techniek", programmeCount: 0, teams: [] },
  ],
  programmes: [
    {
      id: "p-1",
      name: "Verpleegkunde",
      kindLabel: "hbo-bachelor · voltijd",
      teamName: "Team VPK",
      divisionId: "d-1",
    },
    { id: "p-2", name: "Pabo", kindLabel: "hbo", teamName: "Team Pabo", divisionId: null },
  ],
  referralGuide: [{ kind: "money", counter: "Studentenloket", description: "", link: "" }],
};

function page(loaderData: unknown = data, action = () => ({ ok: "create" })) {
  const Stub = createRoutesStub([
    {
      path: "/admin/organisation",
      Component: () => (
        <ToastProvider>
          <AdminOrganisation
            {...({ loaderData } as object as Parameters<typeof AdminOrganisation>[0])}
          />
        </ToastProvider>
      ),
      action,
    },
  ]);
  return render(<Stub initialEntries={["/admin/organisation"]} />);
}

describe("/admin/organisation", () => {
  it("names the layer as the institution chose it, and lets the admin change that", async () => {
    page();
    expect(await screen.findByRole("heading", { name: "Organisatie" })).toBeInTheDocument();
    const choice = screen.getByLabelText(/hoe heet de laag/i);
    expect(choice).toHaveValue("faculty");
    expect(within(choice).getByRole("option", { name: "Vestiging" })).toBeInTheDocument();
  });

  it("makes a faculty through Nieuwe faculteit, a dialog with only the name (plan step 6)", async () => {
    const user = userEvent.setup();
    page();
    expect(screen.queryByLabelText("Naam")).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Nieuwe faculteit" }));
    const dialog = screen.getByRole("dialog", { name: "Nieuwe faculteit" });
    expect(within(dialog).getByLabelText("Naam")).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Aanmaken" })).toBeVisible();
  });

  it("shows each division with its programmes, and the programmes without one", async () => {
    page();
    const zorg = await screen.findByRole("region", { name: "Faculteit Gezondheid" });
    expect(within(zorg).getByText("Verpleegkunde")).toBeInTheDocument();
    expect(within(zorg).getByText(/Team VPK/)).toBeInTheDocument();
    const none = screen.getByRole("region", { name: /zonder faculteit/i });
    expect(within(none).getByText("Pabo")).toBeInTheDocument();
    const techniek = screen.getByRole("region", { name: "Faculteit Techniek" });
    expect(within(techniek).getByText(/nog geen opleidingen/i)).toBeInTheDocument();
  });

  it("names the teams under a division, linked to their page", async () => {
    page();
    const zorg = await screen.findByRole("region", { name: "Faculteit Gezondheid" });
    expect(within(zorg).getByRole("link", { name: "Onderwijscommissie" })).toHaveAttribute(
      "href",
      "/teams/t-9",
    );
  });

  it("says on a division that is not empty what to move before it can go", async () => {
    page();
    const zorg = await screen.findByRole("region", { name: "Faculteit Gezondheid" });
    expect(within(zorg).queryByRole("button", { name: /verwijderen/i })).toBeNull();
    expect(
      within(zorg).getByText(
        "Om Faculteit Gezondheid te verwijderen, zet je eerst de opleidingen en teams eronder op Geen of onder iets anders.",
      ),
    ).toBeVisible();
  });

  it("asks before deleting an empty division, and says what stays", async () => {
    const user = userEvent.setup();
    page();
    const techniek = await screen.findByRole("region", { name: "Faculteit Techniek" });
    await user.click(
      within(techniek).getByRole("button", { name: "Verwijderen: Faculteit Techniek" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Faculteit Techniek verwijderen?" });
    expect(within(dialog).getByText(/Er staan geen opleidingen of teams meer onder/)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Verwijderen" })).toBeVisible();
  });

  it("says programmes are made here, in their faculty", async () => {
    page({ ...data, programmes: [] });
    expect(
      await screen.findByText(/Een opleiding maak je hier met Nieuwe opleiding/),
    ).toBeVisible();
    expect(
      screen.getByText(/Nog geen opleidingen. Klik bij een faculteit op Nieuwe opleiding/),
    ).toBeVisible();
  });

  it("starts a new programme right in a faculty (BESLUIT-2026-11-16-4)", async () => {
    const user = userEvent.setup();
    page();
    const techniek = await screen.findByRole("region", { name: "Faculteit Techniek" });
    await user.click(within(techniek).getByRole("button", { name: "Nieuwe opleiding" }));
    const dialog = screen.getByRole("dialog", { name: "Nieuwe opleiding in Faculteit Techniek" });
    expect(within(dialog).getByLabelText("Team")).toHaveDisplayValue("Nog geen team");
    expect(within(dialog).queryByLabelText("Faculteit")).toBeNull();
    const form = within(dialog).getByRole("button", { name: "Opleiding aanmaken" }).closest("form");
    expect(form).toHaveAttribute("action", "/programmes");
    expect(form?.querySelector('input[name="divisionId"]')).toHaveValue("d-2");
  });

  it("links each programme to its Gegevens, where its faculty is chosen (plan step 6)", async () => {
    page();
    const zorg = await screen.findByRole("region", { name: "Faculteit Gezondheid" });
    expect(within(zorg).getByRole("link", { name: "Verpleegkunde" })).toHaveAttribute(
      "href",
      "/programmes/p-1?tab=details",
    );
    // No move form on this page any more: one place to choose, the programme's Gegevens.
    expect(screen.queryByRole("button", { name: "Verplaatsen" })).toBeNull();
    expect(screen.getByText(/kies je bij Gegevens van de opleiding/)).toBeVisible();
  });

  it("tells two programmes of the same name apart by their kind", async () => {
    page({
      ...data,
      programmes: [
        { ...data.programmes[0] },
        { ...data.programmes[0], id: "p-3", kindLabel: "hbo-bachelor · deeltijd" },
      ],
    });
    const zorg = await screen.findByRole("region", { name: "Faculteit Gezondheid" });
    expect(within(zorg).getByText(/hbo-bachelor · voltijd/)).toBeVisible();
    expect(within(zorg).getByText(/hbo-bachelor · deeltijd/)).toBeVisible();
  });

  it("uses a neutral word before a kind is chosen", async () => {
    page({ ...data, kind: null });
    expect(await screen.findByRole("button", { name: "Nieuw onderdeel" })).toBeInTheDocument();
  });

  it("ends with the referral guide, filled with what is saved (P39.4)", async () => {
    page();
    const guide = await screen.findByRole("region", { name: "Wegwijzer naar het loket" });
    expect(within(guide).getByRole("group", { name: "Geld" })).toBeVisible();
    expect(within(guide).getAllByLabelText("Loket")[4]).toHaveValue("Studentenloket");
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    await screen.findByRole("heading", { name: "Organisatie" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
