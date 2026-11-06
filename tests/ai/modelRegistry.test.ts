import { afterEach, describe, expect, it } from "vitest";
import {
  addModel,
  cancelUpgrade,
  customModelId,
  EMPTY_REGISTRY,
  finishUpgrade,
  parseModelRegistry,
  startUpgrade,
  type ModelRegistry,
} from "~/lib/ai/modelRegistry";
import {
  currentModelId,
  forwardRetired,
  installModelRegistry,
  isResolvableModel,
  listModels,
  modelState,
  resolveModelInfo,
} from "~/lib/ai/models";

const haiku55 = {
  provider: "anthropic" as const,
  apiId: "claude-haiku-5-5",
  displayName: "Claude Haiku 5.5",
  supportsImages: true,
  alwaysThinks: true,
  clientSelectable: true,
};

function withHaiku55(): { registry: ModelRegistry; id: string } {
  const res = addModel(EMPTY_REGISTRY, haiku55);
  if (!res.ok) throw new Error(res.error);
  return { registry: res.registry, id: res.id };
}

afterEach(() => installModelRegistry(EMPTY_REGISTRY));

describe("model registry — adding a model from any provider", () => {
  it("adds a model under a provider-prefixed id", () => {
    const { registry, id } = withHaiku55();
    expect(id).toBe(customModelId("anthropic", "claude-haiku-5-5"));
    expect(id).toBe("anthropic/claude-haiku-5-5");
    expect(registry.added).toHaveLength(1);
  });

  it("refuses a duplicate, an empty name and an API id with spaces", () => {
    const { registry } = withHaiku55();
    expect(addModel(registry, haiku55)).toEqual({ ok: false, error: "duplicate" });
    expect(addModel(EMPTY_REGISTRY, { ...haiku55, displayName: "  " })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(addModel(EMPTY_REGISTRY, { ...haiku55, apiId: "claude haiku" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("refuses a provider that cannot be added from the screen (local, CLI)", () => {
    expect(addModel(EMPTY_REGISTRY, { ...haiku55, provider: "ollama" })).toEqual({
      ok: false,
      error: "provider",
    });
    expect(addModel(EMPTY_REGISTRY, { ...haiku55, provider: "claude-code" })).toEqual({
      ok: false,
      error: "provider",
    });
  });

  it("once installed, an added model resolves and is listed like a catalog model", () => {
    const { registry, id } = withHaiku55();
    expect(isResolvableModel(id)).toBe(false);
    installModelRegistry(registry);
    expect(isResolvableModel(id)).toBe(true);
    expect(resolveModelInfo(id)).toMatchObject({
      provider: "anthropic",
      apiId: "claude-haiku-5-5",
      displayName: "Claude Haiku 5.5",
      alwaysThinks: true,
    });
    expect(listModels().some((m) => m.id === id)).toBe(true);
  });
});

describe("model registry — upgrading and retiring", () => {
  it("an upgrade puts the old model in 'retiring' with its successor", () => {
    const { registry, id } = withHaiku55();
    const res = startUpgrade(registry, "claude-haiku-4-5", id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    installModelRegistry(res.registry);
    expect(modelState("claude-haiku-4-5")).toBe("retiring");
    expect(modelState(id)).toBe("active");
    // New work goes to the successor …
    expect(currentModelId("claude-haiku-4-5")).toBe(id);
    // … but a running conversation may still finish on the old one.
    expect(forwardRetired("claude-haiku-4-5")).toBe("claude-haiku-4-5");
  });

  it("finishing an upgrade retires the old model: every call goes to the successor", () => {
    const { registry, id } = withHaiku55();
    const started = startUpgrade(registry, "claude-haiku-4-5", id);
    if (!started.ok) throw new Error(started.error);
    const done = finishUpgrade(started.registry, "claude-haiku-4-5");
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    installModelRegistry(done.registry);
    expect(modelState("claude-haiku-4-5")).toBe("retired");
    expect(forwardRetired("claude-haiku-4-5")).toBe(id);
    // Old results keep their name: a retired model still resolves.
    expect(resolveModelInfo("claude-haiku-4-5").displayName).toBe("Claude Haiku 4.5");
  });

  it("cancelling makes the old model active again, from either step", () => {
    const { registry, id } = withHaiku55();
    const started = startUpgrade(registry, "claude-haiku-4-5", id);
    if (!started.ok) throw new Error(started.error);
    const back = cancelUpgrade(started.registry, "claude-haiku-4-5");
    if (!back.ok) throw new Error(back.error);
    installModelRegistry(back.registry);
    expect(modelState("claude-haiku-4-5")).toBe("active");
    expect(currentModelId("claude-haiku-4-5")).toBe("claude-haiku-4-5");
  });

  it("follows a chain of upgrades to the newest active model", () => {
    const { registry, id } = withHaiku55();
    const a = startUpgrade(registry, "claude-haiku-4-5", "claude-sonnet-4-6");
    if (!a.ok) throw new Error(a.error);
    const b = startUpgrade(a.registry, "claude-sonnet-4-6", id);
    if (!b.ok) throw new Error(b.error);
    installModelRegistry(b.registry);
    expect(currentModelId("claude-haiku-4-5")).toBe(id);
  });

  it("refuses an upgrade to itself, to an unknown model, to a phasing-out model, or a loop", () => {
    const { registry, id } = withHaiku55();
    const known = (m: string) => m === id || m.startsWith("claude-");
    expect(startUpgrade(registry, id, id, known)).toEqual({ ok: false, error: "self" });
    expect(startUpgrade(registry, "claude-haiku-4-5", "nope/x", known)).toEqual({
      ok: false,
      error: "unknown",
    });
    const a = startUpgrade(registry, "claude-haiku-4-5", id, known);
    if (!a.ok) throw new Error(a.error);
    // The successor of a new upgrade may not itself be on its way out.
    expect(startUpgrade(a.registry, "claude-sonnet-4-6", "claude-haiku-4-5", known)).toEqual({
      ok: false,
      error: "successorRetiring",
    });
    expect(startUpgrade(a.registry, id, "claude-haiku-4-5", known).ok).toBe(false);
  });

  it("refuses to finish or cancel a model that is not being upgraded", () => {
    expect(finishUpgrade(EMPTY_REGISTRY, "claude-haiku-4-5")).toEqual({
      ok: false,
      error: "notRetiring",
    });
    expect(cancelUpgrade(EMPTY_REGISTRY, "claude-haiku-4-5")).toEqual({
      ok: false,
      error: "notRetiring",
    });
  });
});

describe("model registry — stored JSON is validated at the boundary", () => {
  it("drops garbage and keeps the valid parts", () => {
    const parsed = parseModelRegistry(
      JSON.stringify({
        added: [haiku55 && { ...haiku55, id: "anthropic/claude-haiku-5-5" }, { id: 3 }],
        lifecycle: {
          "claude-haiku-4-5": { state: "retiring", successor: "anthropic/claude-haiku-5-5" },
          bad: { state: "exploded" },
        },
      }),
    );
    expect(parsed.added.map((m) => m.id)).toEqual(["anthropic/claude-haiku-5-5"]);
    expect(Object.keys(parsed.lifecycle)).toEqual(["claude-haiku-4-5"]);
  });

  it("returns the empty registry for unreadable JSON", () => {
    expect(parseModelRegistry("{nope")).toEqual(EMPTY_REGISTRY);
    expect(parseModelRegistry(null)).toEqual(EMPTY_REGISTRY);
  });
});
