import { describe, expect, it } from "vitest";
import { getUser, requireRole, requireUser } from "~/server/auth.server";
import { signIn, signInAs, signedRequest, signOut, withCookie } from "../helpers/session";

/**
 * Route tests sign in for real (a session cookie for a user in the in-memory database) instead
 * of mocking `auth.server`, so they run in the shared projects and test the real guard.
 */
const get = (cookie: string) => withCookie(new Request("http://localhost/x"), cookie);

describe("signIn (test helper)", () => {
  it("creates the teacher and returns a cookie the real guard accepts", async () => {
    const cookie = await signIn({ id: "helper-teacher" });
    const user = await requireUser(get(cookie));
    expect(user).toMatchObject({ id: "helper-teacher", role: "teacher" });
  });

  it("signs in an existing user again without creating a second one", async () => {
    await signIn({ id: "helper-again", name: "Ann", email: "ann@school.nl" });
    const cookie = await signIn({ id: "helper-again" });
    expect(await getUser(get(cookie))).toMatchObject({ name: "Ann", email: "ann@school.nl" });
  });

  it("gives an admin two-step verification, so an admin page opens", async () => {
    const cookie = await signIn({ id: "helper-admin", role: "admin" });
    expect(await requireRole(get(cookie), "admin")).toMatchObject({ role: "admin" });
  });

  it("can leave an admin without two-step verification", async () => {
    const cookie = await signIn({ id: "helper-admin-no2fa", role: "admin", twoFactor: false });
    const thrown = await requireRole(get(cookie), "admin").catch((e: unknown) => e);
    expect((thrown as Response).headers.get("Location")).toBe("/account/2fa");
  });

  it("adds the session to a request that already has a cookie", async () => {
    const cookie = await signIn({ id: "helper-lang" });
    const request = withCookie(
      new Request("http://localhost/x", { headers: { cookie: "lang=en" } }),
      cookie,
    );
    expect(request.headers.get("cookie")).toMatch(/^lang=en; __session=/);
    expect(await getUser(request)).toMatchObject({ id: "helper-lang" });
  });
});

describe("signInAs and signedRequest (test helper)", () => {
  it("sends every request as the user signed in last", async () => {
    await signInAs({ id: "helper-ambient-a" });
    expect(await getUser(signedRequest("http://localhost/x"))).toMatchObject({
      id: "helper-ambient-a",
    });
    await signInAs({ id: "helper-ambient-b" });
    const post = signedRequest("http://localhost/x", {
      method: "POST",
      headers: { cookie: "lang=en", "Content-Type": "application/x-www-form-urlencoded" },
      body: "a=1",
    });
    expect(await getUser(post)).toMatchObject({ id: "helper-ambient-b" });
    expect(await post.text()).toBe("a=1");
  });

  it("sends an anonymous request after signOut", async () => {
    await signInAs({ id: "helper-ambient-out" });
    signOut();
    expect(await getUser(signedRequest("http://localhost/x"))).toBeNull();
  });
});
