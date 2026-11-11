import { beforeAll, describe, expect, it } from "vitest";
import { signIn } from "../helpers/session";

type ActionMod = typeof import("~/routes/api.ai-cancel");
type Calls = typeof import("~/server/aiCalls.server");

let action: ActionMod["action"];
let calls: Calls;

beforeAll(async () => {
  ({ action } = await import("~/routes/api.ai-cancel"));
  calls = await import("~/server/aiCalls.server");
});

async function post(body: unknown, cookie?: string): Promise<Response> {
  const request = new Request("http://localhost/api/ai-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);
}

/** Starts a call for `userId` that waits until released; returns its signal. */
function hold(userId: string, callId: string) {
  let signal: AbortSignal | undefined;
  let release: () => void = () => {};
  const done = calls.runAiCall(userId, callId, async () => {
    signal = calls.currentAiSignal();
    await new Promise<void>((r) => {
      release = r;
    });
  });
  return {
    signal: () => signal,
    finish: () => {
      release();
      return done;
    },
  };
}

// Seam: the page cancels its own AI action when the teacher leaves with "Stop".
describe("api.ai-cancel", () => {
  it("stops the signed-in teacher's own running action", async () => {
    const call = hold("cancel-a", "call-cancel-a");
    const res = await post({ callId: "call-cancel-a" }, await signIn({ id: "cancel-a" }));
    expect(res.status).toBe(200);
    expect(call.signal()?.aborted).toBe(true);
    await call.finish();
  });

  it("never stops another teacher's action", async () => {
    const call = hold("cancel-b", "call-cancel-b");
    await post({ callId: "call-cancel-b" }, await signIn({ id: "cancel-intruder" }));
    expect(call.signal()?.aborted).toBe(false);
    await call.finish();
  });

  it("refuses a malformed call id, and anyone not signed in", async () => {
    const cookie = await signIn({ id: "cancel-c" });
    expect((await post({ callId: "x" }, cookie)).status).toBe(400);
    expect((await post({}, cookie)).status).toBe(400);
    const anonymous = await post({ callId: "call-cancel-c" }).catch((e) => e as Response);
    expect(anonymous.status).not.toBe(200);
  });
});
