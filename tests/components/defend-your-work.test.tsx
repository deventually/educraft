import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { ChatView } from "~/components/ChatView";
import { ToastProvider } from "~/components/Toast";
import { getToolBySlug } from "~/lib/registry";
import { studentPromptTemplates } from "~/lib/template/studentPromptTemplate";

vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

// The real Dutch messages, so every label and aria-label is the one a teacher sees.
vi.mock("~/lib/i18n/useT", async () => {
  const { getMessages } = await import("~/lib/i18n");
  return { useLocale: () => "nl", useT: () => getMessages("nl") };
});

/** P31.1 — the oral defense tutor: greeting, send, stream, copy for students, axe. */
describe("Je eigen werk mondeling verdedigen (chat)", () => {
  const tool = getToolBySlug("defend-your-work")!;
  const studentPrompt = studentPromptTemplates(tool, null);

  async function setup() {
    const user = userEvent.setup();
    const view = render(
      <ToastProvider>
        <MemoryRouter>
          <ChatView tool={tool} studentPrompt={studentPrompt} onGenerationStart={() => {}} />
        </MemoryRouter>
      </ToastProvider>,
    );
    await user.type(screen.getByLabelText(/vak of opleiding/i), "HBO-ICT");
    await user.type(
      screen.getByLabelText(/leerdoel/i),
      "De student verantwoordt de architectuurkeuzes.",
    );
    await user.click(screen.getByRole("button", { name: "Doorgaan" }));
    return { user, ...view };
  }

  it("greets, streams the expert's question, without a11y violations", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mock = streamPost as ReturnType<typeof vi.fn>;
    mock.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("Waarom koos je voor deze architectuur?");
      onDone?.("Waarom koos je voor deze architectuur?");
    });

    const { user, container } = await setup();
    expect((await axe(container)).violations).toEqual([]);
    expect(screen.getByText(/wat was het doel van je werk\?/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Jouw bericht…"), "Een webapp voor de planning.");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(await screen.findByText(/Waarom koos je voor deze architectuur\?/)).toBeInTheDocument();
    const body = mock.mock.calls.at(-1)?.[1] as { values: Record<string, unknown> };
    expect(body.values.workType).toBe("report");
    expect(body.values.subject).toBe("HBO-ICT");
    expect((await axe(container)).violations).toEqual([]);
  });

  it("copies the filled-in prompt for students and says so in a toast", async () => {
    const { user, container } = await setup();
    await user.click(screen.getByRole("button", { name: "Kopieer voor je studenten" }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain("HBO-ICT");
    expect(copied).toContain("De student verantwoordt de architectuurkeuzes.");
    expect(copied).not.toMatch(/\{\{\w+\}\}/);
    expect(await screen.findByText(/Gekopieerd/)).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("offers no copy button for a tool without a student text", () => {
    const other = getToolBySlug("difficult-conversation")!;
    render(
      <MemoryRouter>
        <ChatView tool={other} values={{}} onGenerationStart={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Kopieer voor je studenten" })).toBeNull();
  });
});
