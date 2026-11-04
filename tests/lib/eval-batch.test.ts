import { describe, expect, it } from "vitest";
import { THINKING_HEADROOM } from "~/lib/ai/models";
import {
  type BatchOutcome,
  type BatchRequest,
  createBatchingProvider,
  outcomeFromResult,
  toBatchParams,
} from "../../scripts/eval-batch";

/** `npm run eval -- --batch`: half-price measurements through the Message Batches API. */
describe("eval batches", () => {
  it("sends what the app's AI SDK adapter sends: model id, system, messages, temperature, budget", () => {
    const p = toBatchParams({
      model: "claude-sonnet-5-5",
      system: "S",
      messages: [{ role: "user", content: "Go" }],
      temperature: 0.3,
      maxTokens: 8192,
    });
    expect(p).toEqual({
      model: "claude-sonnet-5-5",
      system: "S",
      messages: [{ role: "user", content: "Go" }],
      temperature: 0.3,
      max_tokens: 8192 + THINKING_HEADROOM,
    });
  });

  it("attaches images to the last user message, as the adapter does", () => {
    const p = toBatchParams({
      model: "claude-sonnet-5-5",
      system: "S",
      messages: [{ role: "user", content: "Grade" }],
      images: [{ mediaType: "image/png", dataBase64: "AAA" }],
    });
    expect(p.messages[0]?.content).toEqual([
      { type: "text", text: "Grade" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } },
    ]);
  });

  it("refuses a model that the Batches API cannot serve", () => {
    expect(() => toBatchParams({ model: "ollama::qwen3", system: "", messages: [] })).toThrow(
      /Anthropic/,
    );
  });

  it("reads text, a cut-off answer and an error from the results", () => {
    expect(
      outcomeFromResult({
        type: "succeeded",
        message: {
          content: [
            { type: "thinking" },
            { type: "text", text: "Hi" },
            { type: "text", text: "!" },
          ],
          stop_reason: "max_tokens",
          usage: { input_tokens: 3, output_tokens: 4 },
        },
      }),
    ).toEqual({ ok: true, text: "Hi!", stopReason: "max_tokens", usage: { input: 3, output: 4 } });
    expect(outcomeFromResult({ type: "expired" })).toEqual({
      ok: false,
      error: "batch request expired",
    });
  });

  it("puts concurrent calls in one batch and a dependent call in the next", async () => {
    const sent: BatchRequest[][] = [];
    const submit = async (reqs: BatchRequest[]) => {
      sent.push(reqs);
      return new Map<string, BatchOutcome>(
        reqs.map((r) => [
          r.custom_id,
          {
            ok: true,
            text: `out:${r.params.system}`,
            stopReason: r.params.system === "cut" ? "max_tokens" : "end_turn",
          },
        ]),
      );
    };
    const provider = createBatchingProvider(submit, 5);
    const ask = (system: string) =>
      provider.generate({
        model: "claude-sonnet-5-5",
        system,
        messages: [{ role: "user", content: "x" }],
      });

    const pipeline = async (name: string) => {
      const first = await ask(name);
      return ask(`${first.text}+2`);
    };
    const [a, b, cut] = await Promise.all([pipeline("a"), pipeline("b"), ask("cut")]);

    expect(sent.map((s) => s.length)).toEqual([3, 2]);
    expect(a.text).toBe("out:out:a+2");
    expect(b.text).toBe("out:out:b+2");
    expect(cut.finishReason).toBe("length");
    expect(provider.batches()).toBe(2);
  });

  it("rejects a call whose request failed, without failing the others", async () => {
    const submit = async (reqs: BatchRequest[]) =>
      new Map<string, BatchOutcome>(
        reqs.map((r, i) => [
          r.custom_id,
          i === 0
            ? { ok: false, error: "batch request errored" }
            : { ok: true, text: "ok", stopReason: "end_turn" },
        ]),
      );
    const provider = createBatchingProvider(submit, 5);
    const call = () => provider.generate({ model: "claude-sonnet-5-5", system: "", messages: [] });
    const [bad, good] = await Promise.allSettled([call(), call()]);
    expect(bad.status).toBe("rejected");
    expect(good.status === "fulfilled" && good.value.text).toBe("ok");
  });
});
