import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminTools from "~/routes/admin.tools";
import { getToolBySlug } from "~/lib/registry";
import { loc } from "~/lib/i18n/localized";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// Tool names come from the registry, never from hardcoded titles (P19.1 renamed them).
const first = getToolBySlug("mentorai")!;
const second = getToolBySlug("bloom-by-design")!;
const firstName = loc(first.name, "nl");
const secondName = loc(second.name, "nl");

const loaderData = {
  features: [
    {
      id: "portfolio",
      name: { nl: "BDB/BKE-werkplaats", en: "BDB/BKE workplace" },
      stand: "request",
    },
    { id: "courses", name: { nl: "Cursussen", en: "Courses" }, stand: "on" },
  ],
  models: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", checked: true, group: "frontier" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", checked: true, group: "frontier" },
    // P14: local/CLI models are curatable here too, grouped by origin.
    { id: "claude-code", displayName: "Claude Code (CLI)", checked: true, group: "cli" },
    { id: "ollama::gemma", displayName: "Ollama · gemma", checked: false, group: "local" },
  ],
  rows: [
    {
      slug: "mentorai",
      name: first.name,
      userType: "student" as const,
      mode: "chat" as const,
      phase: 1 as const,
      stand: "on" as const,
    },
    {
      slug: "bloom-by-design",
      name: second.name,
      userType: "instructor" as const,
      mode: "chat" as const,
      phase: 3 as const,
      stand: "off" as const,
    },
  ],
};

function renderRoute(action?: (args: { request: Request }) => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminTools>;
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => (
        <ToastProvider>
          <AdminTools {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/tools"]} />);
}

describe("Admin tools", () => {
  const toolsTable = () => screen.getByRole("table", { name: /alle tools/i });
  const featuresTable = () => screen.getByRole("table", { name: /grote onderdelen/i });

  it("lists every registry tool with its three-way stand (P28.3)", () => {
    renderRoute();
    expect(screen.getByText(firstName, { exact: false })).toBeInTheDocument();
    const first = within(toolsTable()).getByRole("combobox", { name: new RegExp(firstName) });
    expect(first).toHaveValue("on");
    const second = within(toolsTable()).getByRole("combobox", { name: new RegExp(secondName) });
    expect(second).toHaveValue("off");
    expect(
      within(second)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Aan", "Op aanvraag", "Uit"]);
  });

  it("lists the features with their stand and autosaves one (P28.3)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const portfolio = within(featuresTable()).getByRole("combobox", { name: /bdb\/bke/i });
    expect(portfolio).toHaveValue("request");
    await user.selectOptions(portfolio, "on");
    await waitFor(() => expect(body?.get("intent")).toBe("feature"));
    expect(body?.get("id")).toBe("portfolio");
    expect(body?.get("stand")).toBe("on");
  });

  it("renders a labelled checkbox per selectable model, pre-checked from settings", () => {
    renderRoute();
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    expect((within(instance).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(instance).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("[P14] renders local/CLI models as instance toggles too", () => {
    renderRoute();
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    expect((within(instance).getByLabelText("Claude Code (CLI)") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(instance).getByLabelText("Ollama · gemma") as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("has no save buttons", () => {
    renderRoute();
    expect(screen.queryAllByRole("button", { name: /opslaan|save|toepassen|apply/i })).toHaveLength(
      0,
    );
  });

  it("autosaves a model toggle with the whole list and one toast (mutation)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    await user.click(within(instance).getByLabelText("Claude Haiku 4.5"));
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent(/opgeslagen|saved/i);
    expect(body?.get("intent")).toBe("models");
    expect(body?.getAll("models")).toEqual(["claude-sonnet-4-6", "claude-code"]);
  });

  it("reverts the last model and shows an error toast when the action refuses", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: true }));
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    const haiku = within(instance).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    await user.click(haiku);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/minstens één model|at least one model/i);
    });
    expect(haiku.checked).toBe(true); // sprong terug
  });

  it("autosaves a tool stand per row with its slug (mutation)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.selectOptions(
      within(toolsTable()).getByRole("combobox", { name: new RegExp(secondName) }),
      "request",
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/opgeslagen|saved/i);
    });
    expect(body?.get("intent")).toBe("tool");
    expect(body?.get("slug")).toBe("bloom-by-design");
    expect(body?.get("stand")).toBe("request");
  });

  it("reverts a tool stand and says why when the action refuses", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "invalid" }));
    const select = within(toolsTable()).getByRole("combobox", { name: new RegExp(secondName) });
    await user.selectOptions(select, "on");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await waitFor(() => expect(select).toHaveValue("off"));
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
