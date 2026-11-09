import { describe, it, expect, beforeAll } from "vitest";
import { flashKeyOf } from "../helpers/flash";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Flash = typeof import("~/server/flash.server");
type Auth = typeof import("~/server/auth.server");
type Root = typeof import("~/root");
type I18n = typeof import("~/lib/i18n");
type FlashLib = typeof import("~/lib/flash");
let flash: Flash;
let auth: Auth;
let root: Root;
let i18n: I18n;
let flashLib: FlashLib;

beforeAll(async () => {
  [flash, auth, root, i18n, flashLib] = await Promise.all([
    import("~/server/flash.server"),
    import("~/server/auth.server"),
    import("~/root"),
    import("~/lib/i18n"),
    import("~/lib/flash"),
  ]);
});

/** The `name=value` pair of the named cookie among a response's Set-Cookie headers. */
function cookiePair(headers: Headers, name: string): string | null {
  const line = headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return line ? line.split(";")[0]! : null;
}

const withCookie = (cookie?: string | null) =>
  new Request("http://localhost/", { headers: cookie ? { Cookie: cookie } : {} });

describe("flash cookie (P16)", () => {
  it("is read once: takeFlash returns it and a header that clears it", async () => {
    const setCookie = await flash.setFlash("rubricDeleted");
    const pair = setCookie.split(";")[0];
    expect(pair!.startsWith("__flash=")).toBe(true);
    // HttpOnly and short-lived: it only has to survive one redirect.
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Max-Age=60/i);

    const taken = await flash.takeFlash(withCookie(pair));
    expect(taken.flash?.key).toBe("rubricDeleted");
    expect(taken.flash?.id).toBeTruthy();
    expect(taken.clearCookie).toMatch(/^__flash=;/);
    expect(taken.clearCookie).toMatch(/Max-Age=0/i);
  });

  it("gives every flash its own id, so the same message twice toasts twice", async () => {
    const a = await flash.takeFlash(withCookie((await flash.setFlash("signedIn")).split(";")[0]));
    const b = await flash.takeFlash(withCookie((await flash.setFlash("signedIn")).split(";")[0]));
    expect(a.flash?.id).not.toBe(b.flash?.id);
  });

  it("without a flash cookie: no flash and nothing to clear", async () => {
    expect(await flash.takeFlash(withCookie())).toEqual({ flash: null, clearCookie: null });
    expect(await flash.takeFlash(withCookie("other=1"))).toEqual({
      flash: null,
      clearCookie: null,
    });
  });

  it("drops a forged or unknown flash, but still clears the cookie", async () => {
    const forged = await flash.takeFlash(withCookie("__flash=eyJrZXkiOiJ4In0%3D.badsig"));
    expect(forged.flash).toBeNull();
    expect(forged.clearCookie).toMatch(/^__flash=;/);
  });

  it("redirectWithFlash keeps the other Set-Cookie headers", async () => {
    const res = await flash.redirectWithFlash("/somewhere", "teamDeleted", {
      headers: { "Set-Cookie": "__session=abc; Path=/" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/somewhere");
    expect(cookiePair(res.headers, "__session")).toBe("__session=abc");
    expect(await flashKeyOf(res)).toBe("teamDeleted");
  });
});

describe("auth redirects carry a flash (P16)", () => {
  it("createUserSession sets the session and the flash", async () => {
    const res = await auth.createUserSession("someone", "/", "signedIn");
    expect(cookiePair(res.headers, "__session")).toBeTruthy();
    expect(await flashKeyOf(res)).toBe("signedIn");
  });

  it("createUserSession without a flash sets none", async () => {
    const res = await auth.createUserSession("someone", "/");
    expect(await flashKeyOf(res)).toBeNull();
  });

  it("logout destroys the session and sets the flash", async () => {
    const res = await auth.logout(withCookie(), "signedOut");
    expect(res.headers.get("Location")).toBe("/login");
    expect(cookiePair(res.headers, "__session")).toBe("__session=");
    expect(await flashKeyOf(res)).toBe("signedOut");
  });
});

describe("root loader drains the flash (P16)", () => {
  type LoaderArgs = Parameters<typeof root.loader>[0];
  const runLoader = (request: Request) =>
    root.loader({ request, params: {}, context: {} } as unknown as LoaderArgs);

  it("returns the flash and clears the cookie, so a refresh does not toast again", async () => {
    const pair = (await flash.setFlash("passwordReset")).split(";")[0];
    const result = await runLoader(withCookie(pair));
    expect(result.data.flash?.key).toBe("passwordReset");
    const headers = new Headers(result.init?.headers);
    expect(headers.get("Set-Cookie")).toMatch(/^__flash=;/);
  });

  it("returns no flash and sets no cookie when there is none", async () => {
    const result = await runLoader(withCookie());
    expect(result.data.flash).toBeNull();
    expect(new Headers(result.init?.headers).get("Set-Cookie")).toBeNull();
  });
});

describe("flash messages (P16)", () => {
  it("every flash key has a message in both languages", () => {
    for (const locale of ["nl", "en"] as const) {
      const m = i18n.getMessages(locale);
      for (const key of flashLib.FLASH_KEYS) {
        expect(m.toast.flash[key], `${locale}.toast.flash.${key}`).toBeTruthy();
      }
    }
  });
});
