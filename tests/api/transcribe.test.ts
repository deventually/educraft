import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

const { requireUserMock, transcribeMock, enabledMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  transcribeMock: vi.fn(),
  enabledMock: vi.fn(),
}));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));
vi.mock("~/server/speechToText.server", () => ({
  transcribe: transcribeMock,
  dictationEnabled: enabledMock,
}));

type ActionMod = typeof import("~/routes/api.transcribe");
let action: ActionMod["action"];

beforeAll(async () => {
  ({ action } = await import("~/routes/api.transcribe"));
});

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: "u1", name: "T", role: "teacher" });
  enabledMock.mockReturnValue(true);
  transcribeMock.mockResolvedValue("Hallo klas");
});

function post(fields: Record<string, string | Blob>): Promise<Response> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const request = new Request("http://localhost/api/transcribe", { method: "POST", body: form });
  return action({ request, params: {}, context: {} } as Parameters<
    typeof action
  >[0]) as Promise<Response>;
}

const wav = (bytes = 1000) => new Blob([new Uint8Array(bytes)], { type: "audio/wav" });

describe("api.transcribe", () => {
  it("requires a signed-in user", async () => {
    requireUserMock.mockRejectedValueOnce(new Response(null, { status: 302 }));
    await expect(post({ audio: wav(), language: "nl" })).rejects.toBeInstanceOf(Response);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("returns the text of the recording", async () => {
    const res = await post({ audio: wav(), language: "nl" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Hallo klas" });
    expect(transcribeMock).toHaveBeenCalledWith(expect.any(Blob), "nl");
  });

  it("is 404 when dictation is not configured", async () => {
    enabledMock.mockReturnValue(false);
    const res = await post({ audio: wav(), language: "nl" });
    expect(res.status).toBe(404);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("refuses a body without audio, an unknown language, or a recording that is too long", async () => {
    expect((await post({ language: "nl" })).status).toBe(400);
    expect((await post({ audio: wav(), language: "de" })).status).toBe(400);
    expect((await post({ audio: wav(0), language: "nl" })).status).toBe(400);
    expect((await post({ audio: wav(6 * 1024 * 1024), language: "nl" })).status).toBe(413);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("answers 502 without detail when the speech server fails", async () => {
    transcribeMock.mockRejectedValueOnce(new Error("Speech server answered 500. secret detail"));
    const res = await post({ audio: wav(), language: "en" });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
