import { describe, expect, it } from "vitest";
import { z } from "zod";

// The login, invite, account and admin routes all gate e-mail with
// `z.string().email()`. Zod 4 ships a stricter e-mail pattern than Zod 3,
// so pin the address shapes our teachers actually use.
const email = z.string().email();

describe("e-mail validation (zod)", () => {
  it.each([
    "docent@school.nl",
    "j.de.vries@hva.nl",
    "Bastiaan.Dressen@Example.COM",
    "naam+limeonit@student.hu.nl",
    "o'brien@uni-utrecht.nl",
    "a_b-c@sub.domein.example.nl",
  ])("accepts %s", (value) => {
    expect(email.safeParse(value).success).toBe(true);
  });

  it.each([
    "",
    "geen-apenstaartje",
    "a@b",
    "twee@@school.nl",
    "spatie @school.nl",
  ])("rejects %j", (value) => {
    expect(email.safeParse(value).success).toBe(false);
  });
});
