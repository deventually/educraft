import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStreamAborts } from "~/lib/hooks/useStreamAborts";
import { AI_DONE_EVENT } from "~/lib/usage/limits";

describe("useStreamAborts: the end of a call", () => {
  it("announces that an AI call ended, so the monthly limit is checked again", () => {
    const done = vi.fn();
    window.addEventListener(AI_DONE_EVENT, done);
    const { rerender } = renderHook(({ busy }) => useStreamAborts(busy), {
      initialProps: { busy: false },
    });
    expect(done).not.toHaveBeenCalled();
    rerender({ busy: true });
    expect(done).not.toHaveBeenCalled();
    rerender({ busy: false });
    expect(done).toHaveBeenCalledTimes(1);
    window.removeEventListener(AI_DONE_EVENT, done);
  });
});
