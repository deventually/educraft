import { describe, it, expect } from "vitest";
import { appendTokenToLastTurn, markLastTurnInterrupted, type Turn } from "~/lib/chat/turns";

/**
 * These helpers back ChatView's streaming reducers. React (StrictMode, which
 * React Router's default client entry enables) double-invokes state updaters in
 * dev to surface impurity. A *mutating* updater (`lastTurn.content += token`)
 * therefore appends every token twice → duplicated/garbled chat output. These
 * tests pin the reducers as PURE: no input mutation, and invoking twice on the
 * same previous state yields the same result (idempotent the way StrictMode
 * requires).
 */
describe("chat turn reducers (StrictMode-safe)", () => {
  const base = (): Turn[] => [
    { role: "user", content: "Hi", id: "u1" },
    { role: "assistant", content: "Jou", id: "a1" },
  ];

  it("appendTokenToLastTurn does not mutate its input", () => {
    const prev = base();
    appendTokenToLastTurn(prev, "w");
    expect(prev[1].content).toBe("Jou"); // unchanged
  });

  it("appendTokenToLastTurn is idempotent across a double-invoked updater", () => {
    const prev = base();
    // Simulate React StrictMode invoking the updater twice with the SAME prev.
    const r1 = appendTokenToLastTurn(prev, "w");
    const r2 = appendTokenToLastTurn(prev, "w");
    expect(r1).toEqual(r2);
    // Crucially, the token is appended exactly once — not "Jouww".
    expect(r1[1].content).toBe("Jouw");
    expect(r2[1].content).toBe("Jouw");
  });

  it("accumulates correctly across sequential tokens", () => {
    let turns = base();
    for (const tok of ["w", " ", "naam"]) {
      turns = appendTokenToLastTurn(turns, tok);
    }
    expect(turns[1].content).toBe("Jouw naam");
  });

  it("returns input unchanged when there are no turns", () => {
    const empty: Turn[] = [];
    expect(appendTokenToLastTurn(empty, "x")).toBe(empty);
  });

  it("markLastTurnInterrupted is pure and idempotent", () => {
    const prev = base();
    const r1 = markLastTurnInterrupted(prev);
    const r2 = markLastTurnInterrupted(prev);
    expect(prev[1].interrupted).toBeUndefined(); // not mutated
    expect(r1[1].interrupted).toBe(true);
    expect(r1).toEqual(r2);
  });
});
