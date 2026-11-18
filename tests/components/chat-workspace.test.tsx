import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ChatView } from "~/components/ChatView";
import { ToastProvider } from "~/components/Toast";
import { getToolBySlug } from "~/lib/registry";
import type { StreamHandlers } from "~/lib/streamClient";

vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

// The real Dutch messages, so every label is the one a teacher sees.
vi.mock("~/lib/i18n/useT", async () => {
  const { getMessages } = await import("~/lib/i18n");
  return { useLocale: () => "nl", useT: () => getMessages("nl") };
});

const tool = getToolBySlug("mentorai")!;

/** Lets each answer be finished by the test: the conversation is mid-stream until then. */
async function controlStream() {
  const { streamPost } = await import("~/lib/streamClient");
  const finishers: (() => void)[] = [];
  (streamPost as ReturnType<typeof vi.fn>).mockImplementation(
    async (_url: string, _body: unknown, { onToken, onDone }: StreamHandlers) => {
      onToken("Wat weet je al?");
      finishers.push(() => onDone?.({ generationId: "gen-1" }));
    },
  );
  return () => act(() => finishers.shift()?.());
}

async function openChat() {
  const user = userEvent.setup();
  const Stub = createRoutesStub([
    {
      path: "/tools/mentorai",
      Component: () => (
        <ToastProvider>
          <ChatView
            tool={tool}
            onGenerationStart={() => {}}
            resultContext={{ nextTools: [], linkTargets: [], dossiers: [] }}
          />
        </ToastProvider>
      ),
    },
  ]);
  const view = render(<Stub initialEntries={["/tools/mentorai"]} />);
  await user.type(await screen.findByLabelText(/Vakgebied/), "Programmeren");
  await user.type(screen.getByLabelText(/achtergrond/), "Eerstejaars");
  await user.type(screen.getByLabelText(/vandaag leren/), "Recursie");
  await user.click(screen.getByRole("button", { name: "Doorgaan" }));
  return { user, ...view, box: await screen.findByPlaceholderText("Jouw bericht…") };
}

describe("The chat workspace of every chat tool", () => {
  it("keeps focus in the message box after sending with Enter, while and after it answers", async () => {
    const finish = await controlStream();
    const { user, box } = await openChat();

    await user.type(box, "Ik snap recursie niet.");
    await user.keyboard("{Enter}");
    await screen.findByText("Wat weet je al?");
    // A browser drops focus from a disabled field, so the box stays enabled while it answers.
    expect(box).toBeEnabled();
    expect(box).toHaveFocus();

    await finish();
    expect(box).toHaveFocus();
    // Typing straight on is the point: the next message goes without a click.
    await user.keyboard("Een functie roept zichzelf aan.");
    expect(box).toHaveValue("Een functie roept zichzelf aan.");
  });

  it("puts focus back in the message box after the send button is clicked", async () => {
    const finish = await controlStream();
    const { user, box } = await openChat();

    await user.type(box, "Ik snap recursie niet.");
    await user.click(screen.getByRole("button", { name: "Genereer" }));
    expect(box).toHaveFocus();
    await finish();
    expect(box).toHaveFocus();
  });

  it("puts focus in the message box after a starter is chosen", async () => {
    const finish = await controlStream();
    const { user, box } = await openChat();
    const starter = within(screen.getByRole("log")).getAllByRole("button")[0]!;

    await user.click(starter);
    await screen.findByText("Wat weet je al?");
    await finish();
    await waitFor(() => expect(box).toHaveFocus());
  });

  it("shows 'Verder met dit resultaat' beside the conversation, not inside it", async () => {
    const finish = await controlStream();
    const { user, box, container } = await openChat();

    await user.type(box, "Ik snap recursie niet.");
    await user.keyboard("{Enter}");
    await finish();

    const next = await screen.findByRole("region", { name: "Verder met dit resultaat" });
    expect(within(screen.getByRole("log")).queryByRole("region")).toBeNull();
    // It sits with the settings, next to the conversation, so new turns never push it around.
    const settings = screen.getByRole("complementary", { name: "Jouw instellingen" });
    expect(settings.parentElement).toContainElement(next);
    expect((await axe(container)).violations).toEqual([]);
  });
});
