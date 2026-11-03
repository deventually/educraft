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
});
