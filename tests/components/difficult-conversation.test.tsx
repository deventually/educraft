import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { ChatView } from "~/components/ChatView";
import { getToolBySlug } from "~/lib/registry";

vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

// The real Dutch messages, so every label and aria-label is the one a teacher sees.
vi.mock("~/lib/i18n/useT", async () => {
  const { getMessages } = await import("~/lib/i18n");
  return { useLocale: () => "nl", useT: () => getMessages("nl") };
});

/** P24.8 — the practice conversation: greeting, send, stream, axe. */
describe("Lastig gesprek oefenen (chat)", () => {
  const tool = getToolBySlug("difficult-conversation")!;

  it("asks for a situation, greets, streams the student's answer, without a11y violations", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mock = streamPost as ReturnType<typeof vi.fn>;
    mock.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("*kijkt op* Gaat het over mijn verslag?");
      onDone?.("*kijkt op* Gaat het over mijn verslag?");
    });

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ChatView tool={tool} onGenerationStart={() => {}} />
      </MemoryRouter>,
    );
    expect((await axe(container)).violations).toEqual([]);

    await user.type(
      screen.getByLabelText(/situatie/i),
      "Tweedejaars student, verslag beoordeeld met een 4,2.",
    );
    await user.click(screen.getByRole("button", { name: "Doorgaan" }));
    expect(screen.getByText(/Geef feedback/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Jouw bericht…"), "Fijn dat je er bent.");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(await screen.findByText(/Gaat het over mijn verslag\?/)).toBeInTheDocument();
    const body = mock.mock.calls.at(-1)?.[1] as { values: Record<string, string> };
    expect(body.values.scenario).toBe("study-progress");
    expect(body.values.studentReaction).toBe("emotional");
    expect((await axe(container)).violations).toEqual([]);
  });
});
