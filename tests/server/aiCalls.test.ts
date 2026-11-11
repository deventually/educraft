import { describe, expect, it } from "vitest";
import { cancelAiCall, currentAiSignal, runAiCall } from "~/server/aiCalls.server";

// Seam: an AI action (no streaming) runs under a call id from the page; leaving the page
// with "Stop" cancels it by that id, for the same teacher only.
describe("aiCalls: an AI action the teacher can stop by its call id", () => {
  it("gives the work a live signal, and none outside a call", async () => {
    expect(currentAiSignal()).toBeUndefined();
    const aborted = await runAiCall("u1", "call-0001", async () => currentAiSignal()?.aborted);
    expect(aborted).toBe(false);
  });

  it("aborts the running call when its own teacher cancels it", async () => {
    let signal: AbortSignal | undefined;
    let release: () => void = () => {};
    const run = runAiCall("u2", "call-0002", async () => {
      signal = currentAiSignal();
      await new Promise<void>((r) => {
        release = r;
      });
    });
    cancelAiCall("u2", "call-0002");
    expect(signal?.aborted).toBe(true);
    release();
    await run;
  });

  it("ignores another teacher's cancel", async () => {
    let signal: AbortSignal | undefined;
    let release: () => void = () => {};
    const run = runAiCall("u3", "call-0003", async () => {
      signal = currentAiSignal();
      await new Promise<void>((r) => {
        release = r;
      });
    });
    cancelAiCall("someone-else", "call-0003");
    expect(signal?.aborted).toBe(false);
    release();
    await run;
  });

  it("starts aborted when the cancel came in before the work began", async () => {
    cancelAiCall("u4", "call-0004");
    expect(await runAiCall("u4", "call-0004", async () => currentAiSignal()?.aborted)).toBe(true);
  });

  it("runs without a signal when the page sent no (or no valid) call id", async () => {
    expect(await runAiCall("u5", null, async () => currentAiSignal())).toBeUndefined();
    expect(await runAiCall("u5", "x", async () => currentAiSignal())).toBeUndefined();
  });
});
