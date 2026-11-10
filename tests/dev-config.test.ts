import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../react-router.config";

/**
 * `npm run dev` should start without warnings. React Router v7 printed v8 future-flag warnings and
 * passed Vite 8's deprecated `envFile` option; on v8 both are gone.
 */
const root = resolve(__dirname, "..");
const pkg = (name: string) =>
  JSON.parse(readFileSync(resolve(root, "node_modules", name, "package.json"), "utf8")) as {
    version: string;
  };

describe("dev server config", () => {
  it.each(["react-router", "@react-router/dev", "@react-router/node", "@react-router/serve"])(
    "%s is on major version 8",
    (name) => {
      expect(pkg(name).version.split(".")[0]).toBe("8");
    },
  );

  it("@types/node matches the pinned Node major (Volta)", () => {
    const own = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      volta: { node: string };
    };
    const nodeMajor = own.volta.node.split(".")[0];
    expect(pkg("@types/node").version.split(".")[0]).toBe(nodeMajor);
  });

  it("sets no v8_ future flags (they are the default on v8)", () => {
    const flags = Object.keys((config as { future?: object }).future ?? {});
    expect(flags.filter((f) => f.startsWith("v8_"))).toEqual([]);
  });

  it("@react-router/dev no longer passes Vite's deprecated envFile option", () => {
    const dist = resolve(root, "node_modules/@react-router/dev/dist");
    const files = readdirSync(dist, { recursive: true, encoding: "utf8" }).filter((f) =>
      f.endsWith(".js"),
    );
    for (const f of files) {
      expect(readFileSync(resolve(dist, f), "utf8"), f).not.toContain("envFile: false");
    }
  });
});
