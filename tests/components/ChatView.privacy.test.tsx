import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { ChatView } from "~/components/ChatView";
import { getToolBySlug } from "~/lib/registry";
import type { StreamHandlers } from "~/lib/streamClient";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});
const streamPost = vi.fn();
vi.mock("~/lib/streamClient", () => ({
  streamPost: (...args: unknown[]) => streamPost(...args),
}));

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const privacy = { known: { teacher: "Mark de Groot", colleagues: ["Anna Visser"] }, never: [] };
const tool = getToolBySlug("socratic-partner")!;

type Body = {
  values: Record<string, unknown>;
  messages: { role: string; content: string }[];
  privacy?: { approved: string[]; keep: string[] };
};
function server(answer: (h: StreamHandlers, n: number) => void) {
  const bodies: Body[] = [];
  streamPost.mockImplementation(async (...a: unknown[]) => {
    const [url, body, handlers] = a as [string, Body, StreamHandlers];
    if (url !== "/api/stream" || !handlers) return;
    bodies.push(body);
    answer(handlers, bodies.length);
  });
  return bodies;
}

async function start(user: ReturnType<typeof userEvent.setup>) {
  const view = render(
    <MemoryRouter>
      <ChatView tool={tool} privacy={privacy} />
    </MemoryRouter>,
  );
  await user.type(screen.getByRole("textbox", { name: /Subject/ }), "Biologie");
  await user.type(screen.getByRole("textbox", { name: /Chapter title/ }), "Cellen");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return view;
}

/** The live preview in a chat (anonymiseerpoort PR 3): every message is seen before it goes. */
describe("ChatView — what goes to the AI", () => {
  beforeEach(() => streamPost.mockReset());

  it("shows the message as it goes and codes a student the teacher named", async () => {
    const user = userEvent.setup();
    const bodies = server((h) => {
      h.onToken("Vraag [STUDENT] eens waarom.");
      h.onDone?.({});
    });
    const { container } = await start(user);
    await user.type(
      screen.getByPlaceholderText("Your message…"),
      "Jan de Vries vroeg Anna Visser iets",
    );
    expect(
      await screen.findByRole("button", { name: "Anna Visser becomes [COLLEGA-1]" }),
    ).toBeInTheDocument();
    await user.click(screen.getByText("Names that must go"));
    await user.type(screen.getByLabelText("Student name"), "Jan de Vries");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByPlaceholderText("Your message…"));
    await user.keyboard("{Enter}");

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]?.messages.at(-1)?.content).toBe("[STUDENT] vroeg Anna Visser iets");
    expect(bodies[0]?.privacy?.approved).toEqual(["Anna Visser"]);
    expect(JSON.stringify(bodies[0])).not.toMatch(/Vries/);
    // The teacher reads the real names, in their own turn and in the answer.
    expect(await screen.findByText("Vraag Jan de Vries eens waarom.")).toBeInTheDocument();
    expect(screen.getByText("Jan de Vries vroeg Anna Visser iets")).toBeInTheDocument();
  });

  it("asks before sending what the gate found, then sends the same message again", async () => {
    const user = userEvent.setup();
    const bodies = server((h, n) => {
      if (n === 1)
        h.onPrivacy?.([{ value: "Piet Klaassen", code: "COLLEGA-2", kind: "colleague", count: 1 }]);
      else {
        h.onToken("Goed.");
        h.onDone?.({});
      }
    });
    await start(user);
    await user.type(screen.getByPlaceholderText("Your message…"), "Hoe verder?{Enter}");
    expect(await screen.findByRole("heading", { name: "Look first" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]?.privacy?.approved).toContain("Piet Klaassen");
    expect(bodies[1]?.messages).toEqual([{ role: "user", content: "Hoe verder?" }]);
    expect(await screen.findByText("Goed.")).toBeInTheDocument();
  });
});
