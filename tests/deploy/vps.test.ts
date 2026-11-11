import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rolling out to a VPS behind Caddy with one command: `./deploy.sh 1.2.0`. The VPS pulls the
 * image the release workflow built; it never builds itself, so what runs is exactly a tag.
 */
const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

const script = read("deploy/deploy.sh");
const compose = read("deploy/docker-compose.yml");
const caddy = read("deploy/Caddyfile.example");

describe("deploy/docker-compose.yml", () => {
  it("runs the released image at a pinned version and never builds", () => {
    expect(compose).toMatch(/image: ghcr\.io\/deventually\/educraft:\$\{LIMEONIT_VERSION:\?/);
    expect(compose).not.toMatch(/^\s+build:/m);
    expect(compose).not.toMatch(/:latest\b|:main\b/);
  });

  it("publishes no port: only Caddy reaches the app, over a shared network", () => {
    expect(compose).not.toMatch(/^\s+ports:/m);
    expect(compose).toMatch(/networks:[\s\S]*external: true/);
    expect(compose).toMatch(/aliases:\s*\[\s*limeonit\s*\]/);
  });

  it("keeps the database on a volume and reads its settings from .env", () => {
    expect(compose).toMatch(/:\/data\b/);
    expect(compose).toMatch(/env_file:\s*\n\s+- \.env/);
    expect(compose).toMatch(/restart: unless-stopped/);
  });
});

describe("deploy/Caddyfile.example", () => {
  it("proxies to the app and passes the real client IP for the login throttle", () => {
    expect(caddy).toMatch(/reverse_proxy limeonit:3000/);
    expect(caddy).toMatch(/header_up X-Real-IP \{remote_host\}/);
    expect(read(".env.example")).toMatch(/CLIENT_IP_HEADER/);
  });
});

describe("deploy/deploy.sh", () => {
  it("is executable and stops at the first error", () => {
    expect(statSync(resolve(root, "deploy/deploy.sh")).mode & 0o111).not.toBe(0);
    expect(script.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(script).toMatch(/^set -euo pipefail$/m);
  });

  it("accepts only a SemVer version, with or without the v", () => {
    expect(script).toMatch(/\^\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/);
    expect(script).toMatch(/VERSION="\$\{1#v\}"/);
  });

  it("pulls the image first, then makes a backup, then starts the new version", () => {
    const pull = script.indexOf("docker compose pull");
    const backup = script.indexOf("build/ops/backup.js");
    const up = script.indexOf("docker compose up -d");
    expect(pull).toBeGreaterThan(-1);
    expect(backup).toBeGreaterThan(pull);
    expect(up).toBeGreaterThan(backup);
  });

  it("can restore a backup before it starts, for a rollback over a migration", () => {
    expect(script).toContain("--restore");
    const restore = script.indexOf("build/ops/restore.js");
    expect(restore).toBeGreaterThan(-1);
    expect(restore).toBeLessThan(script.indexOf("docker compose up -d"));
  });

  it("waits until /healthz reports the version it just started", () => {
    expect(script).toMatch(/\/healthz/);
    expect(script).toMatch(/WANT="\\"version\\":\\"\$\{VERSION\}\\""/);
    expect(script).toMatch(/grep -qF "\$WANT"/);
  });

  it("prints how to roll back, on success and on failure", () => {
    expect(script.match(/Terugrollen/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("handover", () => {
  it("describes the one-command rollout and the rollback by version", () => {
    const handover = read("docs/overdracht.md");
    expect(handover).toContain("deploy/deploy.sh");
    expect(handover).toMatch(/\.\/deploy\.sh \d+\.\d+\.\d+ --restore/);
  });
});
