import type { Route } from "./+types/api.transcribe";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { createRateLimiter } from "~/server/rateLimit.server";
import { dictationEnabled, transcribe } from "~/server/speechToText.server";

/** About two minutes of 16 kHz mono WAV, with room to spare. */
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const TranscribeBodySchema = z.object({
  audio: z.instanceof(Blob).refine((b) => b.size > 0),
  language: z.enum(["nl", "en"]),
});

// Process-local, like /api/stream: a few dictations a minute is plenty for one teacher.
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 20, maxConcurrent: 2 });

/**
 * Resource route (no UI): dictation. Takes one recording (WAV) and its language, and
 * returns `{ text }` from the configured speech server (`speechToText.server`). The
 * audio is passed through, never stored. Errors carry no detail of the speech server.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!dictationEnabled()) return Response.json({ error: "off" }, { status: 404 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + 64 * 1024) {
    return Response.json({ error: "tooLong" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = TranscribeBodySchema.safeParse({
    audio: form.get("audio"),
    language: form.get("language"),
  });
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  if (parsed.data.audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "tooLong" }, { status: 413 });
  }

  const gate = rateLimiter.acquire(user.id);
  if (!gate.ok) return Response.json({ error: "rateLimited" }, { status: 429 });
  try {
    const text = await transcribe(parsed.data.audio, parsed.data.language);
    return Response.json({ text });
  } catch (err) {
    console.error("Dictation failed:", (err as Error).message);
    return Response.json({ error: "failed" }, { status: 502 });
  } finally {
    gate.release();
  }
}
