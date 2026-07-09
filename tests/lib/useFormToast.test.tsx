import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form, createRoutesStub, useActionData } from "react-router";
import { ToastProvider, useFormToast, type ToastInput } from "~/components/Toast";

type Result = (d: unknown) => ToastInput | null;

/** A route whose action + result mapper are supplied per test. */
function makeStub(action: () => unknown, result: Result) {
  function RouteView() {
    const actionData = useActionData();
    useFormToast(actionData, { result });
    return (
      <Form method="post">
        <button type="submit">save</button>
      </Form>
    );
  }
  return createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <RouteView />
        </ToastProvider>
      ),
      action,
    },
  ]);
}

describe("useFormToast", () => {
  it("shows a pending toast on submit, then updates it in place to success", async () => {
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    const Stub = makeStub(
      async () => {
        await gate;
        return { ok: true };
      },
      (d) => ((d as { ok?: boolean }).ok ? { variant: "success", message: "Klaar." } : null),
    );
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);

    await user.click(screen.getByRole("button", { name: "save" }));
    // While the action is gated, the pending toast is visible.
    expect(await screen.findByText("Bezig…")).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Klaar."));
    // Updated in place — the pending toast became the success toast.
    expect(screen.queryByText("Bezig…")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("turns the pending toast into an assertive alert on an error result", async () => {
    const Stub = makeStub(
      async () => ({ error: "Mislukt." }),
      (d) => {
        const e = (d as { error?: string }).error;
        return e ? { variant: "error", message: e } : null;
      },
    );
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);

    await user.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Mislukt."));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("dismisses the pending toast when the result maps to null", async () => {
    const Stub = makeStub(
      async () => ({ ignored: true }),
      () => null,
    );
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);

    await user.click(screen.getByRole("button", { name: "save" }));
    // The pending toast must not hang — it is dismissed once the action settles.
    await waitFor(() => expect(screen.queryByRole("listitem")).toBeNull());
  });
});
