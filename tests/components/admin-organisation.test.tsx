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
  divisions: [
    { id: "d-1", name: "Faculteit Gezondheid", programmeCount: 1 },
    { id: "d-2", name: "Faculteit Techniek", programmeCount: 0 },
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
    expect(screen.getByRole("button", { name: /faculteit toevoegen/i })).toBeInTheDocument();
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

  it("offers delete only on an empty division", async () => {
    page();
    const zorg = await screen.findByRole("region", { name: "Faculteit Gezondheid" });
    expect(within(zorg).queryByRole("button", { name: /verwijderen/i })).toBeNull();
    const techniek = screen.getByRole("region", { name: "Faculteit Techniek" });
    expect(within(techniek).getByRole("button", { name: /verwijderen/i })).toBeInTheDocument();
  });

  it("moves a programme with a choice of division per programme", async () => {
    page();
    const select = await screen.findByLabelText(/Pabo \(hbo\) hoort bij/i);
    expect(within(select).getByRole("option", { name: "Faculteit Techniek" })).toBeInTheDocument();
    await userEvent.selectOptions(select, "d-2");
    expect(select).toHaveValue("d-2");
  });

  it("tells two programmes of the same name apart by their kind", async () => {
    page({
      ...data,
      programmes: [
        { ...data.programmes[0] },
        { ...data.programmes[0], id: "p-3", kindLabel: "hbo-bachelor · deeltijd" },
      ],
    });
    expect(
      await screen.findByLabelText("Verpleegkunde (hbo-bachelor · voltijd) hoort bij"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Verpleegkunde (hbo-bachelor · deeltijd) hoort bij"),
    ).toBeInTheDocument();
  });

  it("uses a neutral word before a kind is chosen", async () => {
    page({ ...data, kind: null });
    expect(await screen.findByRole("button", { name: /onderdeel toevoegen/i })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    await screen.findByRole("heading", { name: "Organisatie" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
