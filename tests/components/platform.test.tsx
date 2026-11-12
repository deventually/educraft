import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { PlatformPage } from "~/components/platform/PlatformPage";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Props = ComponentProps<typeof PlatformPage>;

const institutions: Props["institutions"] = [
  {
    id: "hsl",
    name: "Hogeschool Leiden",
    hosts: ["hsl.limeonit.nl"],
    active: true,
    createdAt: "2026-11-01T09:00:00.000Z",
  },
  {
    id: "hhs",
    name: "De Haagse Hogeschool",
    hosts: ["hhs.limeonit.nl"],
    active: false,
    createdAt: "2026-11-02T09:00:00.000Z",
  },
];

const archived: Props["archived"] = [
  {
    key: "oud-20261110",
    id: "oud",
    name: "Oude School",
    hosts: ["oud.limeonit.nl"],
    removedAt: "2026-11-10T10:00:00.000Z",
    purgeAt: "2027-01-09T10:00:00.000Z",
  },
];

type Action = (fd: FormData) => unknown;

function renderPage(over: Partial<Props> = {}, action?: Action) {
  const posted: FormData[] = [];
  const Stub = createRoutesStub([
    {
      path: "/platform",
      Component: () => (
        <ToastProvider>
          <PlatformPage
            institutions={institutions}
            archived={archived}
            timeZone="Europe/Amsterdam"
            {...over}
          />
        </ToastProvider>
      ),
      action: async ({ request }) => {
        const fd = await request.formData();
        posted.push(fd);
        return (action ?? (() => ({ ok: true, intent: String(fd.get("intent")) })))(fd);
      },
    },
  ]);
  const view = render(<Stub initialEntries={["/platform"]} />);
  return { ...view, posted };
}

const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("Platform: the institutions", () => {
  it("lists every institution with its id, address and status", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 2, name: "Platform" })).toBeVisible();
    const table = screen.getByRole("table", { name: "Instellingen" });
    const hsl = within(table).getByRole("row", { name: /Hogeschool Leiden/ });
    expect(within(hsl).getByText("hsl")).toBeVisible();
    expect(within(hsl).getByText("hsl.limeonit.nl")).toBeVisible();
    expect(within(hsl).getByText("Actief")).toBeVisible();
    expect(within(rowOf("De Haagse Hogeschool")).getByText("Gedeactiveerd")).toBeVisible();
  });

  it("says so when there are none yet", async () => {
    renderPage({ institutions: [] });
    expect(await screen.findByText(/nog geen instellingen/)).toBeVisible();
    expect(screen.queryByRole("table", { name: "Instellingen" })).toBeNull();
  });

  it("asks before it deactivates an active institution", async () => {
    const user = userEvent.setup();
    const { posted } = renderPage();
    await user.click(
      await within(rowOf("Hogeschool Leiden")).findByRole("button", { name: "Deactiveren" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Hogeschool Leiden deactiveren?" });
    expect(dialog).toHaveTextContent(/tijdelijk niet beschikbaar/);
    await user.click(within(dialog).getByRole("button", { name: "Deactiveren" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.get("intent")).toBe("deactivate");
    expect(posted[0]?.get("id")).toBe("hsl");
  });

  it("activates a deactivated institution in one click", async () => {
    const user = userEvent.setup();
    const { posted } = renderPage();
    await user.click(await within(rowOf("De Haagse")).findByRole("button", { name: "Activeren" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.get("intent")).toBe("activate");
    expect(posted[0]?.get("id")).toBe("hhs");
  });

  it("offers removal only for a deactivated institution", async () => {
    renderPage();
    const active = rowOf("Hogeschool Leiden");
    expect(within(active).queryByRole("button", { name: "Verwijderen" })).toBeNull();
    expect(within(active).getByText("Eerst deactiveren")).toBeVisible();
    expect(within(rowOf("De Haagse")).getByRole("button", { name: "Verwijderen" })).toBeVisible();
  });

  it("removes only after the id is typed, and sends what was typed", async () => {
    const user = userEvent.setup();
    const { posted } = renderPage();
    await user.click(within(rowOf("De Haagse")).getByRole("button", { name: "Verwijderen" }));
    const dialog = screen.getByRole("dialog", { name: "De Haagse Hogeschool verwijderen?" });
    expect(dialog).toHaveTextContent(/60 dagen/);
    const confirm = within(dialog).getByRole("textbox", { name: /Typ het id \(hhs\)/ });
    expect(confirm).toHaveFocus();
    expect(confirm).toBeRequired();
    await user.type(confirm, "hhs");
    await user.click(within(dialog).getByRole("button", { name: "Naar het archief" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.get("intent")).toBe("remove");
    expect(posted[0]?.get("id")).toBe("hhs");
    expect(posted[0]?.get("confirm")).toBe("hhs");
  });

  it("groups each row's buttons under the institution's name", async () => {
    renderPage();
    expect(
      await screen.findByRole("group", { name: "Acties voor Hogeschool Leiden" }),
    ).toBeVisible();
  });
});

describe("Platform: adding an institution", () => {
  it("opens a labelled form with id, name, address and the first admin", async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole("button", { name: "Nieuwe instelling" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const form = screen.getByRole("form", { name: "Nieuwe instelling" });
    expect(within(form).getByRole("textbox", { name: "Id" })).toBeRequired();
    expect(within(form).getByRole("textbox", { name: "Id" })).toHaveAccessibleDescription(
      /kleine letters/i,
    );
    expect(within(form).getByRole("textbox", { name: "Naam" })).toBeRequired();
    expect(within(form).getByRole("textbox", { name: "Adres" })).toHaveAccessibleDescription(
      /zonder https/,
    );
    expect(
      within(form).getByRole("textbox", { name: /Naam van de eerste beheerder/ }),
    ).toBeRequired();
    expect(
      within(form).getByRole("textbox", { name: /E-mail van de eerste beheerder/ }),
    ).toHaveAttribute("type", "email");
  });

  it("posts the fields and then shows the password link once, with a copy button", async () => {
    const user = userEvent.setup();
    const { posted } = renderPage({}, (fd) => ({
      intent: "add",
      ok: true,
      name: String(fd.get("name")),
      adminName: String(fd.get("adminName")),
      setPasswordLink: "https://ru.limeonit.nl/set-password/abc",
    }));
    await user.click(await screen.findByRole("button", { name: "Nieuwe instelling" }));
    const form = screen.getByRole("form", { name: "Nieuwe instelling" });
    await user.type(within(form).getByRole("textbox", { name: "Id" }), "ru");
    await user.type(within(form).getByRole("textbox", { name: "Naam" }), "Radboud");
    await user.type(within(form).getByRole("textbox", { name: "Adres" }), "ru.limeonit.nl");
    await user.type(within(form).getByRole("textbox", { name: /Naam van de eerste/ }), "Kim");
    await user.type(
      within(form).getByRole("textbox", { name: /E-mail van de eerste/ }),
      "kim@ru.nl",
    );
    await user.click(within(form).getByRole("button", { name: "Instelling toevoegen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(Object.fromEntries(posted[0]!)).toEqual({
      intent: "add",
      id: "ru",
      name: "Radboud",
      host: "ru.limeonit.nl",
      adminName: "Kim",
      adminEmail: "kim@ru.nl",
    });
    const card = await screen.findByRole("heading", { name: "Wachtwoordlink voor Radboud" });
    expect(card).toBeVisible();
    expect(screen.getByText("https://ru.limeonit.nl/set-password/abc")).toBeVisible();
    expect(screen.getByText(/Stuur deze link aan Kim/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Kopieer link" })).toBeVisible();
  });

  it("reports a refusal as an error toast and keeps what was typed", async () => {
    const user = userEvent.setup();
    renderPage({}, () => ({ intent: "add", ok: false, error: "taken" }));
    await user.click(await screen.findByRole("button", { name: "Nieuwe instelling" }));
    const form = screen.getByRole("form", { name: "Nieuwe instelling" });
    await user.type(within(form).getByRole("textbox", { name: "Id" }), "hsl");
    await user.type(within(form).getByRole("textbox", { name: "Naam" }), "Dubbel");
    await user.type(within(form).getByRole("textbox", { name: "Adres" }), "hsl.limeonit.nl");
    await user.type(within(form).getByRole("textbox", { name: /Naam van de eerste/ }), "Kim");
    await user.type(
      within(form).getByRole("textbox", { name: /E-mail van de eerste/ }),
      "kim@x.nl",
    );
    await user.click(within(form).getByRole("button", { name: "Instelling toevoegen" }));
    expect(await screen.findByText(/al in gebruik/)).toBeVisible();
    expect(within(form).getByRole("textbox", { name: "Naam" })).toHaveValue("Dubbel");
    expect(screen.queryByRole("heading", { name: /Wachtwoordlink/ })).toBeNull();
  });
});

describe("Platform: the archive", () => {
  it("lists a removed institution with the day it is erased, and restores it", async () => {
    const user = userEvent.setup();
    const { posted } = renderPage();
    const table = await screen.findByRole("table", { name: "Archief" });
    const row = within(table).getByRole("row", { name: /Oude School/ });
    expect(within(row).getByText(/9 januari 2027/)).toBeVisible();
    expect(within(row).getByText(/10 november 2026/)).toBeVisible();
    await user.click(within(row).getByRole("button", { name: "Terugzetten" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.get("intent")).toBe("restore");
    expect(posted[0]?.get("key")).toBe("oud-20261110");
  });

  it("says so when the archive is empty", async () => {
    renderPage({ archived: [] });
    expect(await screen.findByText("Het archief is leeg.")).toBeVisible();
  });

  it("confirms a done action with a toast", async () => {
    const user = userEvent.setup();
    renderPage({}, () => ({ intent: "restore", ok: true, name: "Oude School" }));
    await user.click(await screen.findByRole("button", { name: "Terugzetten" }));
    expect(await screen.findByText(/Oude School is teruggezet/)).toBeVisible();
  });
});

describe("Platform: accessibility", () => {
  it("has no axe violations, with the form open and a dialog open", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await screen.findByRole("heading", { level: 2, name: "Platform" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Nieuwe instelling" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(within(rowOf("De Haagse")).getByRole("button", { name: "Verwijderen" }));
    expect((await axe(document.body, axeOpts)).violations).toEqual([]);
  });
});
