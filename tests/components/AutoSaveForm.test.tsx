import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Handler = (fd: FormData) => unknown;

/** A route with one AutoSaveForm holding a checkbox, a select and an e-mail field. */
function renderForm(handler: Handler = () => ({ saved: true })) {
  const calls: FormData[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    const fd = await request.formData();
    calls.push(fd);
    return handler(fd);
  });
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <AutoSaveForm
            intent="tool"
            hidden={{ slug: "x" }}
            aria-label="Row form"
            errorMessage={(code) => (code === "atLeastOne" ? "Kies er minstens één." : undefined)}
          >
            <label>
              Aan
              <input type="checkbox" name="enabled" defaultChecked />
            </label>
            <label>
              Rol
              <select name="role" defaultValue="teacher">
                <option value="teacher">teacher</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label>
              E-mail
              <input type="email" name="email" defaultValue="a@x.nl" />
            </label>
          </AutoSaveForm>
        </ToastProvider>
      ),
      action,
    },
  ]);
  const utils = render(<Stub initialEntries={["/"]} />);
  return { ...utils, action, calls };
}

describe("AutoSaveForm", () => {
  it("saves a checkbox change without a submit button and shows one 'Opgeslagen.' toast", async () => {
    const user = userEvent.setup();
    const { action, calls } = renderForm();
    expect(screen.queryByRole("button")).toBeNull();
    await user.click(screen.getByLabelText("Aan"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(calls[0]!.get("intent")).toBe("tool");
    expect(calls[0]!.get("slug")).toBe("x");
    expect(calls[0]!.get("enabled")).toBeNull(); // unchecked → not submitted
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("Opgeslagen.");
  });

  it("saves a select change at once", async () => {
    const user = userEvent.setup();
    const { action, calls } = renderForm();
    await user.selectOptions(screen.getByLabelText("Rol"), "admin");
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(calls[0]!.get("role")).toBe("admin");
  });

  it("keeps focus on the changed control", async () => {
    const user = userEvent.setup();
    const { action } = renderForm();
    const box = screen.getByLabelText("Aan");
    await user.click(box);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(box);
  });

  it("saves a text field on blur and on Enter, not on every keystroke", async () => {
    const user = userEvent.setup();
    const { action, calls } = renderForm();
    const email = screen.getByLabelText("E-mail");
    await user.clear(email);
    await user.type(email, "b@x.nl");
    expect(action).not.toHaveBeenCalled(); // typing alone saves nothing
    await user.tab(); // blur
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(calls[0]!.get("email")).toBe("b@x.nl");

    await user.clear(email);
    await user.type(email, "c@x.nl");
    // Enter in a lone text field is the browser's implicit submission (user-event only
    // emulates it for a form with a single <input>, ours also carries hidden ones).
    fireEvent.submit(screen.getByRole("form", { name: "Row form" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(calls[1]!.get("email")).toBe("c@x.nl");
    // Blurring after Enter does not save the same value twice.
    await user.tab();
    await new Promise((r) => setTimeout(r, 30));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("does not save a text field that was blurred unchanged", async () => {
    const user = userEvent.setup();
    const { action } = renderForm();
    await user.click(screen.getByLabelText("E-mail"));
    await user.tab();
    await new Promise((r) => setTimeout(r, 30));
    expect(action).not.toHaveBeenCalled();
  });

  it("reverts the control and shows an error toast when the action refuses", async () => {
    const user = userEvent.setup();
    const { action, calls } = renderForm(() => ({ error: "atLeastOne" }));
    const box = screen.getByLabelText("Aan") as HTMLInputElement;
    expect(box.checked).toBe(true);
    await user.click(box);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(calls[0]!.get("enabled")).toBeNull(); // the refused state was posted
    await waitFor(() => expect(box.checked).toBe(true)); // sprong terug
    expect(screen.getByRole("alert")).toHaveTextContent("Kies er minstens één.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("falls back to the generic error text for an unknown error code", async () => {
    const user = userEvent.setup();
    renderForm(() => ({ error: true }));
    await user.click(screen.getByLabelText("Aan"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/onverwachte fout|unexpected error/i);
  });

  it("adds no live region of its own", () => {
    renderForm();
    const form = screen.getByRole("form", { name: "Row form" });
    expect(form.querySelector('[role="status"],[role="alert"],[aria-live]')).toBeNull();
    expect(within(form).queryAllByRole("button")).toHaveLength(0);
  });

  it("has no a11y violations", async () => {
    const { container } = renderForm();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
