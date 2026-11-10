import { describe, expect, it } from "vitest";
import { THINKING_HEADROOM } from "~/lib/ai/models";
import {
  anthropicSubmit,
  type BatchOutcome,
  type BatchRequest,
  createBatchingProvider,
  outcomeFromResult,
  toBatchParams,
} from "../../scripts/eval-batch";

/** `npm run eval -- --batch`: half-price measurements through the Message Batches API. */
describe("eval batches", () => {
  it("leaves temperature out for models that reject it, as the AI SDK does (Sonnet 5.5)", () => {
    const p = toBatchParams({
      model: "claude-sonnet-5-5",
      system: "S",
      messages: [{ role: "user", content: "Go" }],
      temperature: 0.3,
      maxTokens: 8192,
    });
    expect(p).not.toHaveProperty("temperature");
    expect(p.max_tokens).toBe(8192 + THINKING_HEADROOM);
  });

  it("sends what the app's AI SDK adapter sends: model id, system, messages, temperature, budget", () => {
    const p = toBatchParams({
      model: "claude-sonnet-4-6",
      system: "S",
      messages: [{ role: "user", content: "Go" }],
      temperature: 0.3,
      maxTokens: 8192,
    });
    expect(p).toEqual({
      model: "claude-sonnet-4-6",
      system: "S",
      messages: [{ role: "user", content: "Go" }],
      temperature: 0.3,
      max_tokens: 8192,
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

  // The SDK round trip with a fake fetch: create the batch, poll it, read the JSONL results.
  // Guards the SDK's batch API across major versions without an API key.
  it("submits through the Anthropic SDK and reads the batch results back", async () => {
    const calls: string[] = [];
    const batch = (status: string) => ({
      id: "msgbatch_1",
      type: "message_batch",
      processing_status: status,
      request_counts: { processing: 0, succeeded: 1, errored: 0, canceled: 0, expired: 0 },
      results_url: "https://api.anthropic.com/v1/messages/batches/msgbatch_1/results",
    });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
      if (url.endsWith("/results")) {
        const line = {
          custom_id: "r1",
          result: {
            type: "succeeded",
            message: {
              content: [{ type: "text", text: "Hoi" }],
              stop_reason: "end_turn",
              usage: { input_tokens: 3, output_tokens: 1 },
            },
          },
        };
        return new Response(`${JSON.stringify(line)}\n`, {
          headers: { "content-type": "application/binary" },
        });
      }
      return json(batch(init?.method === "POST" ? "in_progress" : "ended"));
    };
    const submit = anthropicSubmit("test-key", 0, fakeFetch as typeof fetch);
    const params = toBatchParams({ model: "claude-sonnet-5-5", system: "S", messages: [] });
    const out = await submit([{ custom_id: "r1", params }]);
    expect(calls[0]).toBe("POST /v1/messages/batches");
    expect(calls).toContain("GET /v1/messages/batches/msgbatch_1");
    expect(out.get("r1")).toMatchObject({ ok: true, text: "Hoi" });
  });
});
