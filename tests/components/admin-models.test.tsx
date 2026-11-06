import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ModelManagement } from "~/components/admin/models";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const none = { results: 0, people: 0, teams: 0, tools: 0 };

const loaderData = {
  providers: [
    {
      id: "anthropic",
      name: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
      connected: true,
      setting: "ANTHROPIC_API_KEY",
      modelsUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
      example: "claude-haiku-5-5",
    },
    {
      id: "openai",
      name: { nl: "OpenAI (ChatGPT)", en: "OpenAI (ChatGPT)" },
      connected: false,
      setting: "OPENAI_API_KEY",
      example: "gpt-5-mini",
    },
  ],
  models: [
    {
      id: "claude-sonnet-5-5",
      displayName: "Claude Sonnet 5.5",
      providerName: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
      added: false,
      state: "active",
      successor: null,
      usage: { results: 12, people: 2, teams: 1, tools: 23 },
    },
    {
      id: "claude-haiku-4-5",
      displayName: "Claude Haiku 4.5",
      providerName: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
      added: false,
      state: "retiring",
      successor: { id: "anthropic/claude-haiku-5-5", displayName: "Claude Haiku 5.5" },
      usage: { ...none, results: 3 },
    },
    {
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      providerName: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
      added: false,
      state: "retired",
      successor: { id: "claude-sonnet-5-5", displayName: "Claude Sonnet 5.5" },
      usage: none,
    },
    {
      id: "anthropic/claude-haiku-5-5",
      displayName: "Claude Haiku 5.5",
      providerName: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
      added: true,
      state: "active",
      successor: null,
      usage: none,
    },
  ],
  choices: [
    { id: "claude-sonnet-5-5", displayName: "Claude Sonnet 5.5", checked: true, group: "frontier" },
    { id: "claude-code", displayName: "Claude Code (CLI)", checked: false, group: "cli" },
  ],
};

function renderRoute(action?: (args: { request: Request }) => unknown) {
  const props = loaderData as unknown as ComponentProps<typeof ModelManagement>;
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => (
        <ToastProvider>
          <ModelManagement {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/tools"]} />);
}

/** The card of one model, found by its heading. */
const card = (name: string) =>
  screen.getByRole("heading", { level: 3, name }).closest("li") as HTMLElement;

describe("Admin — models part of Tools and models", () => {
  it("shows which providers are connected, and what a missing one needs", () => {
    renderRoute();
    const providers = screen.getByRole("list", { name: /aanbieders/i });
    const anthropic = within(providers).getByText("Anthropic (Claude)").closest("li")!;
    expect(within(anthropic).getByText("Gekoppeld")).toBeInTheDocument();
    const openai = within(providers).getByText("OpenAI (ChatGPT)").closest("li")!;
    expect(within(openai).getByText("Niet gekoppeld")).toBeInTheDocument();
    expect(within(openai).getByText(/OPENAI_API_KEY/)).toBeInTheDocument();
  });

  it("adds a model on a connected provider only", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { added: "Claude Haiku 5.5" };
    });
    const form = screen.getByRole("form", { name: "Model toevoegen" });
    const provider = within(form).getByLabelText("Aanbieder");
    expect(
      within(provider)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Anthropic (Claude)"]);
    await user.type(within(form).getByLabelText("Model-id bij de aanbieder"), "claude-haiku-5-5");
    await user.type(within(form).getByLabelText("Naam in LimeOnIt"), "Claude Haiku 5.5");
    await user.click(within(form).getByLabelText(/denkt eerst na/i));
    await user.click(within(form).getByRole("button", { name: "Toevoegen" }));
    await waitFor(() => expect(body?.get("intent")).toBe("add"));
    expect(body?.get("provider")).toBe("anthropic");
    expect(body?.get("apiId")).toBe("claude-haiku-5-5");
    expect(body?.get("displayName")).toBe("Claude Haiku 5.5");
    expect(body?.get("alwaysThinks")).toBe("on");
    expect(await screen.findByText("Claude Haiku 5.5 is toegevoegd.")).toBeInTheDocument();
  });

  it("upgrades an active model to another active one", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const sonnet = card("Claude Sonnet 5.5");
    expect(within(sonnet).getByText("In gebruik")).toBeInTheDocument();
    expect(within(sonnet).getByText(/12 resultaten in 30 dagen/)).toBeInTheDocument();
    const to = within(sonnet).getByLabelText("Claude Sonnet 5.5 upgraden naar");
    // Only active models, never itself or one on its way out.
    // Nothing preselected; only active models, never itself or one on its way out.
    expect(to).toHaveValue("");
    expect(
      within(to)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Kies een model", "Claude Haiku 5.5"]);
    await user.selectOptions(to, "anthropic/claude-haiku-5-5");
    await user.click(within(sonnet).getByRole("button", { name: "Upgraden" }));
    await waitFor(() => expect(body?.get("intent")).toBe("upgrade"));
    expect(body?.get("from")).toBe("claude-sonnet-5-5");
    expect(body?.get("to")).toBe("anthropic/claude-haiku-5-5");
  });

  it("a model being replaced names its successor and can be finished or undone", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const haiku = card("Claude Haiku 4.5");
    expect(within(haiku).getByText("Wordt vervangen")).toBeInTheDocument();
    expect(within(haiku).getByText(/vervangen door Claude Haiku 5\.5/)).toBeInTheDocument();
    expect(within(haiku).getByRole("button", { name: "Terugdraaien" })).toBeInTheDocument();
    await user.click(within(haiku).getByRole("button", { name: "Uitfaseren afronden" }));
    await waitFor(() => expect(body?.get("intent")).toBe("finish"));
    expect(body?.get("id")).toBe("claude-haiku-4-5");
  });

  it("a phased-out model can be restored", () => {
    renderRoute();
    const old = card("Claude Sonnet 4.6");
    expect(within(old).getByText("Uitgefaseerd")).toBeInTheDocument();
    expect(within(old).getByRole("button", { name: "Terugzetten" })).toBeInTheDocument();
  });

  it("keeps the allow-list of models users may choose", () => {
    renderRoute();
    const group = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    expect((within(group).getByLabelText("Claude Sonnet 5.5") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(group).getByLabelText("Claude Code (CLI)") as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("has no axe violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
