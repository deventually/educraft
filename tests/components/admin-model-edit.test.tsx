/** Editing and removing a model the admin added, on its card on the models page. */
import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ModelsTab } from "~/components/admin/models";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const none = { results: 0, people: 0, teams: 0, tools: 0 };
const provider = { nl: "OpenRouter", en: "OpenRouter" };

const props = {
  providers: [],
  models: [
    {
      id: "claude-sonnet-5-5",
      displayName: "Claude Sonnet 5.5",
      providerName: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
      added: false,
      state: "active",
      successor: null,
      usage: none,
      price: null,
      priceFrom: null,
    },
    {
      id: "openrouter/minimax/minimax-m3.1-flash",
      displayName: "MiniMax Flash",
      providerName: provider,
      added: true,
      state: "active",
      successor: null,
      usage: none,
      price: null,
      priceFrom: null,
      config: {
        supportsImages: false,
        alwaysThinks: true,
        clientSelectable: true,
        settings: { effort: "low", temperature: 0.5 },
      },
    },
  ],
  choices: [],
  defaultModel: null,
  fallbackModel: "Claude Sonnet 5.5",
} as unknown as ComponentProps<typeof ModelsTab>;

function renderRoute(action: (args: { request: Request }) => unknown) {
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => (
        <ToastProvider>
          <ModelsTab {...props} />
        </ToastProvider>
      ),
      action,
    },
  ]);
  return render(<Stub initialEntries={["/admin/tools"]} />);
}

const card = (name: string) =>
  screen.getByRole("heading", { level: 3, name }).closest("li") as HTMLElement;

describe("Admin — editing and removing an added model", () => {
  it("only a model added on screen can be edited", () => {
    renderRoute(() => ({}));
    expect(within(card("Claude Sonnet 5.5")).queryByText("Bewerken")).toBeNull();
    expect(within(card("MiniMax Flash")).getByText("Bewerken")).toBeInTheDocument();
  });

  it("opens with the current settings and saves the changes", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { edited: "MiniMax M3.1 Flash" };
    });
    const minimax = card("MiniMax Flash");
    await user.click(within(minimax).getByText("Bewerken"));
    const form = within(minimax).getByRole("form", { name: "MiniMax Flash bewerken" });
    expect(within(form).getByLabelText("Naam in LimeOnIt")).toHaveValue("MiniMax Flash");
    expect(within(form).getByLabelText("Denkniveau (effort)")).toHaveValue("low");
    expect(within(form).getByLabelText("Temperatuur")).toHaveValue(0.5);
    expect(within(form).getByLabelText(/denkt eerst na/i)).toBeChecked();
    expect(within(form).getByLabelText(/foto's/i)).not.toBeChecked();

    const name = within(form).getByLabelText("Naam in LimeOnIt");
    await user.clear(name);
    await user.type(name, "MiniMax M3.1 Flash");
    const temp = within(form).getByLabelText("Temperatuur");
    await user.clear(temp);
    await user.type(temp, "0.2");
    await user.click(within(form).getByRole("button", { name: "Wijzigingen bewaren" }));
    await waitFor(() => expect(body?.get("intent")).toBe("edit"));
    expect(body?.get("id")).toBe("openrouter/minimax/minimax-m3.1-flash");
    expect(body?.get("displayName")).toBe("MiniMax M3.1 Flash");
    expect(body?.get("temperature")).toBe("0.2");
    expect(body?.get("effort")).toBe("low");
    expect(body?.get("alwaysThinks")).toBe("on");
    expect(body?.get("supportsImages")).toBeNull();
    expect(await screen.findByText("MiniMax M3.1 Flash is bewaard.")).toBeInTheDocument();
  });

  it("removes only after a second, explicit click", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { removed: "MiniMax Flash" };
    });
    const minimax = card("MiniMax Flash");
    await user.click(within(minimax).getByText("Bewerken"));
    await user.click(within(minimax).getByRole("button", { name: "Model verwijderen" }));
    expect(body).toBeUndefined();
    const confirm = within(minimax).getByRole("button", { name: "Ja, MiniMax Flash verwijderen" });
    expect(confirm).toHaveFocus();
    await user.click(within(minimax).getByRole("button", { name: "Toch niet" }));
    expect(within(minimax).getByRole("button", { name: "Model verwijderen" })).toHaveFocus();
    await user.click(within(minimax).getByRole("button", { name: "Model verwijderen" }));
    await user.click(
      within(minimax).getByRole("button", { name: "Ja, MiniMax Flash verwijderen" }),
    );
    await waitFor(() => expect(body?.get("intent")).toBe("remove"));
    expect(body?.get("id")).toBe("openrouter/minimax/minimax-m3.1-flash");
    expect(await screen.findByText("MiniMax Flash is verwijderd.")).toBeInTheDocument();
  });

  it("explains why a used model cannot go", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "used" }));
    const minimax = card("MiniMax Flash");
    await user.click(within(minimax).getByText("Bewerken"));
    await user.click(within(minimax).getByRole("button", { name: "Model verwijderen" }));
    await user.click(
      within(minimax).getByRole("button", { name: "Ja, MiniMax Flash verwijderen" }),
    );
    expect(await screen.findByText(/al gebruikt/i)).toBeInTheDocument();
  });

  it("has no axe violations with the edit form open", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(() => ({}));
    await user.click(within(card("MiniMax Flash")).getByText("Bewerken"));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
