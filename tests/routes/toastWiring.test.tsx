import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form, createRoutesStub, useActionData } from "react-router";
import { ToastProvider, useFormToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";

// The real route modules pull in ~/server/* repositories, so this file rebuilds
// each route's wiring against a stub route with an inline action — the same
// technique ConfirmDialog.test.tsx uses. It locks in the result-mapper shapes.

/** Mirrors projects._index.tsx: a delete Form → success toast. */
function ProjectsView() {
  const t = useT();
  const actionData = useActionData() as { ok?: boolean } | undefined;
  useFormToast(actionData, {
    result: (d) => (d?.ok ? { variant: "success", message: t.projects.toastDeleted } : null),
  });
  return (
    <Form method="post">
      <button type="submit">delete</button>
    </Form>
  );
}

/** Mirrors admin.cohorts.tsx: assign/delete/reassign/remove → success, error → alert. */
function CohortsView() {
  const c = useT().admin.cohorts;
  const actionData = useActionData() as Record<string, unknown> | undefined;
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if ("deleted" in d) return { variant: "success", message: c.toastDeleted };
      if ("assigned" in d) return { variant: "success", message: c.toastAssigned };
      if ("reassigned" in d) return { variant: "success", message: c.toastReassigned };
      if ("removed" in d) return { variant: "success", message: c.toastRemoved };
      if ("error" in d) return { variant: "error", message: c.toastError };
      return null;
    },
  });
  return (
    <Form method="post">
      <button type="submit">go</button>
    </Form>
  );
}

function stub(View: () => React.ReactNode, action: () => unknown) {
  return createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <View />
        </ToastProvider>
      ),
      action,
    },
  ]);
}

describe("toast wiring", () => {
  it("announces a projects delete (previously silent)", async () => {
    const Stub = stub(ProjectsView, () => ({ ok: true }));
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);
    await user.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Resultaat verwijderd."),
    );
  });

  it("announces an admin.cohorts assign (previously silent)", async () => {
    const Stub = stub(CohortsView, () => ({ assigned: true }));
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);
    await user.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Docent toegewezen."));
  });

  it("shows an assertive alert for an admin.cohorts error", async () => {
    const Stub = stub(CohortsView, () => ({ error: true }));
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);
    await user.click(screen.getByRole("button", { name: "go" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
