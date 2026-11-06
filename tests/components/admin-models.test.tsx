import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ModelsTab, ProvidersTab } from "~/components/admin/models";
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
      added: false,
    },
    {
      id: "openai",
      name: { nl: "OpenAI (ChatGPT)", en: "OpenAI (ChatGPT)" },
      connected: false,
      setting: "OPENAI_API_KEY",
      example: "gpt-5-mini",
      added: false,
    },
    {
      id: "eigen-server",
      name: "Eigen server",
      connected: true,
      setting: "EIGEN_SERVER_API_KEY",
      example: "",
      added: true,
      baseURL: "http://10.0.0.5:8000/v1",
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
  local: {
    enabled: true,
    agents: [
      { id: "claude-code", displayName: "Claude Code (CLI)" },
      { id: "codex", displayName: "Codex (CLI)" },
    ],
    servers: [
      { id: "ollama", name: "Ollama", found: 2 },
      { id: "lmstudio", name: "LM Studio", found: 0 },
    ],
  },
  choices: [
    { id: "claude-sonnet-5-5", displayName: "Claude Sonnet 5.5", checked: true, group: "frontier" },
    { id: "claude-code", displayName: "Claude Code (CLI)", checked: false, group: "cli" },
  ],
};

function renderRoute(action?: (args: { request: Request }) => unknown) {
  const props = loaderData as unknown as ComponentProps<typeof ModelsTab> &
    ComponentProps<typeof ProvidersTab>;
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => (
        <ToastProvider>
          <ModelsTab {...props} />
          <ProvidersTab {...props} />
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
    ).toEqual(["Anthropic (Claude)", "Eigen server"]);
    await user.type(within(form).getByLabelText("Model-id bij de aanbieder"), "claude-haiku-5-5");
    await user.type(within(form).getByLabelText("Naam in LimeOnIt"), "Claude Haiku 5.5");
    await user.click(within(form).getByLabelText(/denkt eerst na/i));
    await user.selectOptions(within(form).getByLabelText("Denkniveau (effort)"), "high");
    await user.type(within(form).getByLabelText("Temperatuur"), "0.2");
    await user.click(within(form).getByRole("button", { name: "Toevoegen" }));
    await waitFor(() => expect(body?.get("intent")).toBe("add"));
    expect(body?.get("provider")).toBe("anthropic");
    expect(body?.get("apiId")).toBe("claude-haiku-5-5");
    expect(body?.get("displayName")).toBe("Claude Haiku 5.5");
    expect(body?.get("alwaysThinks")).toBe("on");
    expect(body?.get("effort")).toBe("high");
    expect(body?.get("temperature")).toBe("0.2");
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

  it("shows the CLI agents and the local servers with what was found", () => {
    renderRoute();
    const local = screen.getByRole("region", { name: "Op deze computer" });
    expect(within(local).getByText("Codex (CLI)")).toBeInTheDocument();
    expect(within(local).getByText("Claude Code (CLI)")).toBeInTheDocument();
    const ollama = within(local).getByText("Ollama").closest("li")!;
    expect(within(ollama).getByText("2 modellen gevonden")).toBeInTheDocument();
    const lms = within(local).getByText("LM Studio").closest("li")!;
    expect(within(lms).getByText(/niets gevonden/i)).toBeInTheDocument();
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

  it("adds a provider: name, kind of API, address, and whether it needs a key", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { providerAdded: { name: "DeepSeek", setting: "DEEPSEEK_API_KEY" } };
    });
    const form = screen.getByRole("form", { name: "Aanbieder toevoegen" });
    await user.type(within(form).getByLabelText("Naam"), "DeepSeek");
    await user.selectOptions(within(form).getByLabelText("Soort koppeling"), "openai-compatible");
    await user.type(within(form).getByLabelText("Adres (base URL)"), "https://api.deepseek.com/v1");
    await user.click(within(form).getByRole("button", { name: "Aanbieder toevoegen" }));
    await waitFor(() => expect(body?.get("intent")).toBe("addProvider"));
    expect(body?.get("name")).toBe("DeepSeek");
    expect(body?.get("baseURL")).toBe("https://api.deepseek.com/v1");
    expect(body?.get("noKey")).toBeNull();
    expect(
      await screen.findByText(
        "DeepSeek is toegevoegd. Zet DEEPSEEK_API_KEY in .env en start LimeOnIt opnieuw.",
      ),
    ).toBeInTheDocument();
  });

  it("an added provider shows its address and can be removed; a built-in one cannot", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { providerRemoved: { name: "Eigen server" } };
    });
    const providers = screen.getByRole("list", { name: /aanbieders/i });
    const own = within(providers).getByText("Eigen server").closest("li")!;
    expect(within(own).getByText("http://10.0.0.5:8000/v1")).toBeInTheDocument();
    const anthropic = within(providers).getByText("Anthropic (Claude)").closest("li")!;
    expect(within(anthropic).queryByRole("button")).toBeNull();
    await user.click(within(own).getByRole("button", { name: "Eigen server verwijderen" }));
    await waitFor(() => expect(body?.get("intent")).toBe("removeProvider"));
    expect(body?.get("id")).toBe("eigen-server");
    expect(await screen.findByText("Eigen server is verwijderd.")).toBeInTheDocument();
  });

  it("says in plain words why expensive models are not in the teachers' list", () => {
    renderRoute();
    const allow = screen.getByRole("region", { name: "Beschikbaar voor gebruikers" });
    expect(allow.textContent).not.toMatch(/serverzijdig|Opus-klasse/);
    expect(allow.textContent).toMatch(/alleen een tool/i);
  });

  it("has no axe violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
