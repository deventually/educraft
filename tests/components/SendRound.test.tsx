import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub, useActionData } from "react-router";
import { SendRound } from "~/components/privacy/SendRound";
import { useSendRound } from "~/lib/hooks/useSendRound";
import type { PrivacyPage } from "~/lib/privacy/live";
import type { OverviewPart } from "~/lib/privacy/overview";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const page: PrivacyPage = { known: { colleagues: ["Jan de Vries"] }, never: [] };

const PARTS: OverviewPart[] = [
  {
    name: "doc",
    label: "Document",
    text: "Jan de Vries gaf les. Jan de Vries ook. Ook de Zonnebloem.",
  },
  { name: "course", label: "Your course", text: "Docent: Jan de Vries.", held: true },
];

type Posted = Record<string, string>;

const fetchSpy = vi.fn(async () => new Response("{}"));
beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

function renderRound(reply: (fd: Posted, n: number) => unknown = () => ({ ok: true })) {
  const posted: Posted[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    const fd = Object.fromEntries(await request.formData()) as Posted;
    posted.push(fd);
    return reply(fd, posted.length);
  });
  function Page() {
    const data = useActionData();
    const round = useSendRound(page, data, "do-it");
    return (
      <>
        <button
          type="button"
          onClick={() => {
            const fd = new FormData();
            fd.set("intent", "do-it");
            fd.set("doc", "ignored: the parts are what goes");
            round.start(fd, PARTS);
          }}
        >
          Start
        </button>
        <SendRound round={round} />
      </>
    );
  }
  const Stub = createRoutesStub([{ path: "/", Component: Page, action }]);
  return { ...render(<Stub initialEntries={["/"]} />), posted };
}

/**
 * The overview before sending (anonymiseerpoort step 4): on a screen without a typing moment,
 * the teacher sees every replacement per word before anything goes, and nothing goes until
 * Send. Words the gate still finds on the server come back as a question, also before anything
 * goes.
 */
describe("SendRound", () => {
  it("lists every replacement per word, with how often and where, before anything goes", async () => {
    const { container, posted } = renderRound();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const region = screen.getByRole("region", { name: "Check what goes to the AI" });
    expect(
      within(region).getByRole("heading", { name: "Check what goes to the AI" }),
    ).toHaveFocus();
    const [jan] = within(region).getAllByRole("listitem");
    expect(jan).toHaveTextContent("Jan de Vries (3×)");
    expect(jan).toHaveTextContent("[COLLEGA-1]");
    expect(jan).toHaveTextContent("in Document, Your course");
    expect(within(region).getByText("1 word replaced")).toBeInTheDocument();
    expect(posted).toHaveLength(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("sends only after Send: the page's text, and the approval for the gate", async () => {
    const { posted } = renderRound();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.intent).toBe("do-it");
    expect(posted[0]?.doc).toBe(PARTS[0]?.text);
    expect(posted[0]?.course).toBeUndefined();
    expect(JSON.parse(posted[0]?.privacy ?? "{}")).toEqual({
      approved: ["Jan de Vries"],
      keep: [],
    });
    expect(posted[0]?.aiCall).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(screen.queryByRole("region", { name: "Check what goes to the AI" })).toBeNull();
  });

  it("Do not replace keeps a word everywhere; Also replace adds one the list missed", async () => {
    const { posted } = renderRound();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByRole("button", { name: "Do not replace: Jan de Vries" }));
    expect(screen.getByRole("button", { name: "Also replace: Jan de Vries" })).toBeInTheDocument();
    // A colleague's name is no person's data to the teacher: it goes on their never-list.
    expect(fetchSpy).toHaveBeenCalledWith("/api/privacy/keep", expect.anything());
    await userEvent.type(screen.getByLabelText("Replace another word"), "Zonnebloem");
    await userEvent.click(screen.getByRole("button", { name: "Also replace" }));
    expect(screen.getByText("Zonnebloem (1×)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.doc).toBe("Jan de Vries gaf les. Jan de Vries ook. Ook de [ANDER-1].");
    expect(JSON.parse(posted[0]?.privacy ?? "{}")).toMatchObject({
      approved: [],
      keep: ["Jan de Vries"],
    });
  });

  it("Back closes the overview without sending", async () => {
    const { posted } = renderRound();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("region", { name: "Check what goes to the AI" })).toBeNull();
    expect(posted).toHaveLength(0);
    // Focus goes back to where the teacher was, not to the top of the page.
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
  });

  it("says so when nothing is replaced, and still waits for Send", async () => {
    const { posted } = renderRound();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByRole("button", { name: "Do not replace: Jan de Vries" }));
    expect(screen.getByText("Nothing is replaced.")).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("asks about what the gate still found, and sends again with the teacher's answer", async () => {
    const { container, posted } = renderRound((_fd, n) =>
      n === 1
        ? {
            ok: false,
            intent: "do-it",
            error: "x",
            privacyReview: [{ value: "Mark de Groot", code: "DOCENT", kind: "teacher", count: 2 }],
          }
        : { ok: true },
    );
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const ask = await screen.findByRole("region", { name: "Look first" });
    expect(ask).toHaveTextContent("Mark de Groot (2×)");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await userEvent.click(within(ask).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(JSON.parse(posted[1]?.privacy ?? "{}").approved).toEqual([
      "Jan de Vries",
      "Mark de Groot",
    ]);
    expect(posted[1]?.aiCall).not.toBe(posted[0]?.aiCall);
  });
});
