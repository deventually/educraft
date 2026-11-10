import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import opsConfig from "../../scripts/ops.config";

/**
 * One Node version everywhere: the Volta pin in package.json is the source, and CI, the nightly
 * mutation run, the Docker image and the ops bundle follow it.
 */
const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

const pin = (JSON.parse(read("package.json")) as { volta: { node: string } }).volta.node;
const major = pin.split(".")[0];

describe("Node version", () => {
  it("is pinned with Volta to Node 26 (the current LTS)", () => {
    expect(major).toBe("26");
  });

  it.each([".github/workflows/ci.yml", ".github/workflows/mutation.yml"])(
    "%s sets up exactly the pinned Node version",
    (file) => {
      const versions = [...read(file).matchAll(/node-version: "([^"]+)"/g)].map((m) => m[1]);
      expect(versions.length).toBeGreaterThan(0);
      expect(new Set(versions)).toEqual(new Set([pin]));
    },
  );

  it("builds every Docker stage on the pinned Node major", () => {
    const images = [...read("Dockerfile").matchAll(/^FROM (\S+)/gm)].map((m) => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image).toBe(`node:${major}-alpine`);
  });

  it("bundles the ops scripts for the pinned Node major", () => {
    const config = opsConfig as { build?: { target?: unknown } };
    expect(config.build?.target).toBe(`node${major}`);
  });
});
