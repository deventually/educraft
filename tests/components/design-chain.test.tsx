import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { useDesignChain } from "~/components/courses/useDesignChain";

type Result = Parameters<typeof useDesignChain>[0];

function renderChain(result: Result) {
  const seen = vi.fn();
  const Stub = createRoutesStub([
    {
      path: "/courses/:id",
      action: async ({ request }) => {
        const fd = await request.formData();
        seen(Object.fromEntries(fd));
        return { ok: true };
      },
      Component: () => {
        useDesignChain(result);
        return null;
      },
    },
  ]);
  render(<Stub initialEntries={["/courses/c1"]} />);
  return seen;
}

describe("useDesignChain (the wizard runs on)", () => {
  it("asks for the next step's proposal right after an apply, as a stoppable AI call", async () => {
    const seen = renderChain({ ok: true, intent: "import-apply", next: "design-assessments" });
    await waitFor(() => expect(seen).toHaveBeenCalledOnce());
    const fields = seen.mock.calls[0]![0] as Record<string, string>;
    expect(fields.intent).toBe("design-assessments");
    expect(fields.aiCall).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("asks nothing after an apply without a next step, or a failed one", async () => {
    const seen = renderChain({ ok: true, intent: "import-apply" });
    const failed = renderChain({ ok: false, intent: "import-apply" });
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });
});
