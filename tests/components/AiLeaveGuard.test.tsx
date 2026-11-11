import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub, Form, Link, Outlet } from "react-router";
import { AiCallField, AiLeaveGuard, useAiWork } from "~/components/AiLeaveGuard";
import { getMessages } from "~/lib/i18n";

const m = getMessages("nl").aiLeave; // no root loader → Dutch
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

/** A page with a running stream (or not), and a link away. */
function renderStreaming(busy: boolean) {
  const work = { abort: vi.fn(), keep: vi.fn() };
  function Tool() {
    useAiWork(busy, work);
    return <Link to="/elsewhere">Weg</Link>;
  }
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <AiLeaveGuard>
          <Outlet />
        </AiLeaveGuard>
      ),
      children: [
        { path: "tool", Component: Tool },
        { path: "elsewhere", Component: () => <h1>Ergens anders</h1> },
      ],
    },
  ]);
  const { container } = render(<Stub initialEntries={["/tool"]} />);
  return Object.assign(work, { container });
}

afterEach(() => vi.unstubAllGlobals());

// Seam: leaving a page while the AI works, as the teacher sees it.
describe("AiLeaveGuard — leaving while the AI works", () => {
  it("lets the teacher leave without asking when no AI is working", async () => {
    const user = userEvent.setup();
    renderStreaming(false);
    await user.click(screen.getByRole("link", { name: "Weg" }));
    expect(await screen.findByRole("heading", { name: "Ergens anders" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks first, and keeps the AI running on request", async () => {
    const user = userEvent.setup();
    const work = renderStreaming(true);
    await user.click(screen.getByRole("link", { name: "Weg" }));
    expect(screen.getByRole("dialog", { name: m.title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: m.keep }));
    expect(await screen.findByRole("heading", { name: "Ergens anders" })).toBeInTheDocument();
    expect(work.keep).toHaveBeenCalledOnce();
    expect(work.abort).not.toHaveBeenCalled();
  });

  it("stops the AI and leaves on request", async () => {
    const user = userEvent.setup();
    const work = renderStreaming(true);
    await user.click(screen.getByRole("link", { name: "Weg" }));
    await user.click(screen.getByRole("button", { name: m.abort }));
    expect(await screen.findByRole("heading", { name: "Ergens anders" })).toBeInTheDocument();
    expect(work.abort).toHaveBeenCalledOnce();
    expect(work.keep).not.toHaveBeenCalled();
  });

  it("stays on the page with Escape or the stay button, and the AI goes on", async () => {
    const user = userEvent.setup();
    const work = renderStreaming(true);
    await user.click(screen.getByRole("link", { name: "Weg" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("link", { name: "Weg" }));
    await user.click(screen.getByRole("button", { name: m.stay }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("link", { name: "Weg" })).toBeInTheDocument();
    expect(work.abort).not.toHaveBeenCalled();
    expect(work.keep).not.toHaveBeenCalled();
  });

  it("puts the focus in the dialog and has no accessibility violations", async () => {
    const user = userEvent.setup();
    const { container } = renderStreaming(true);
    await user.click(screen.getByRole("link", { name: "Weg" }));
    expect(screen.getByRole("button", { name: m.keep })).toHaveFocus();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

// Seam: an AI action without streaming (a form with <AiCallField />).
describe("AiLeaveGuard — an AI action without streaming", () => {
  function renderAction() {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    function Page() {
      return (
        <>
          <Form method="post">
            <AiCallField />
            <button type="submit">Laat beoordelen</button>
          </Form>
          <Link to="/elsewhere">Weg</Link>
        </>
      );
    }
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => (
          <AiLeaveGuard>
            <Outlet />
          </AiLeaveGuard>
        ),
        children: [
          // The model is still thinking: the action never answers.
          { path: "page", Component: Page, action: () => new Promise(() => {}) },
          { path: "elsewhere", Component: () => <h1>Ergens anders</h1> },
        ],
      },
    ]);
    render(<Stub initialEntries={["/page"]} />);
    return fetchMock;
  }

  it("asks first while it runs, and stops it on the server on request", async () => {
    const user = userEvent.setup();
    const fetchMock = renderAction();
    await user.click(screen.getByRole("button", { name: "Laat beoordelen" }));
    await user.click(screen.getByRole("link", { name: "Weg" }));
    await user.click(screen.getByRole("button", { name: m.abort }));
    expect(await screen.findByRole("heading", { name: "Ergens anders" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai-cancel");
    expect(JSON.parse(String(init.body)).callId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("lets it run on request: nothing is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = renderAction();
    await user.click(screen.getByRole("button", { name: "Laat beoordelen" }));
    await user.click(screen.getByRole("link", { name: "Weg" }));
    await user.click(screen.getByRole("button", { name: m.keep }));
    expect(await screen.findByRole("heading", { name: "Ergens anders" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
