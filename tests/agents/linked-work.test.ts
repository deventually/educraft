// P21.7: linked test questions in the hat's input — only when the teacher asks, clipped,
// under the course's short keys, and always as data.
import { describe, expect, it } from "vitest";
import { buildReviewMessage, LINKED_LIMITS } from "~/lib/agents/input";
import { alignedCourse, TEST1 } from "../courses/fixtures";

const base = { course: alignedCourse(), alignment: [], rejected: [] };

describe("linked work in the review message", () => {
  it("is absent without linked work", () => {
    expect(buildReviewMessage(base, "nl")).not.toContain("<linkedWork>");
    expect(buildReviewMessage({ ...base, linkedWork: [] }, "nl")).not.toContain("<linkedWork>");
  });

  it("names the item each piece of work belongs to, by its short key", () => {
    const msg = buildReviewMessage(
      {
        ...base,
        linkedWork: [
          { itemId: TEST1, text: "Vraag 1: Noem de drie normaalvormen." },
          { itemId: null, text: "Losse matrijs." },
        ],
      },
      "nl",
    );
    expect(msg).toContain("<linkedWork>");
    expect(msg).toContain('<work item="T2">\nVraag 1: Noem de drie normaalvormen.\n</work>');
    expect(msg).toContain("<work>\nLosse matrijs.\n</work>");
  });

  it("is clipped in length and number", () => {
    const long = "x".repeat(LINKED_LIMITS.chars + 500);
    const many = Array.from({ length: LINKED_LIMITS.count + 2 }, (_, i) => ({
      itemId: null,
      text: `werk ${i} ${long}`,
    }));
    const msg = buildReviewMessage({ ...base, linkedWork: many }, "nl");
    expect(msg.match(/<work>/g)).toHaveLength(LINKED_LIMITS.count);
    expect(msg).not.toContain("x".repeat(LINKED_LIMITS.chars + 1));
  });
});
