import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { envSchema } from "~/server/env.server";
import { OPS_SCRIPTS } from "../../scripts/ops.config";

/**
 * The distributable build: a Docker image plus docker-compose that someone runs without the
 * source tooling. The LLM and the database are wired through environment variables only.
 */
const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

const dockerfile = read("Dockerfile");
const finalStage = dockerfile.slice(dockerfile.lastIndexOf("\nFROM "));
const compose = read("docker-compose.yml");
const envExample = read(".env.example");
const dockerignore = read(".dockerignore")
  .split("\n")
  .map((l) => l.trim());

describe("Dockerfile, final stage", () => {
  it("runs in production mode as a non-root user", () => {
    expect(finalStage).toMatch(/ENV NODE_ENV=production/);
    expect(finalStage).toMatch(/^USER node$/m);
  });

  it("keeps the database on the /data volume by default", () => {
    expect(finalStage).toMatch(/DATABASE_URL=file:\/data\/limeonit\.db/);
    expect(finalStage).toMatch(/VOLUME \["?\/data"?\]/);
  });

  it("ships the build, the migrations and the bundled ops scripts, not the source", () => {
    expect(finalStage).toMatch(/COPY --from=build-env \/app\/build /);
    expect(finalStage).toMatch(/COPY --from=build-env \/app\/drizzle /);
    expect(finalStage).not.toMatch(/COPY \. /);
    expect(finalStage).not.toMatch(/\/app\/(app|scripts|tests)\b/);
  });

  it("probes /healthz", () => {
    expect(finalStage).toMatch(/HEALTHCHECK[\s\S]*\/healthz/);
  });
});

describe(".dockerignore", () => {
  it.each([
    ".env",
    ".git",
    "data",
    "node_modules",
    "build",
  ])("keeps %s out of the build context", (entry) => {
    expect(dockerignore).toContain(entry);
  });

  it("still lets .env.example in", () => {
    expect(dockerignore).toContain("!.env.example");
  });
});

describe("docker-compose.yml", () => {
  it("reads its configuration from .env", () => {
    expect(compose).toMatch(/env_file:[\s\S]*\.env/);
  });

  it("mounts a named volume (or LIMEONIT_DATA) at /data", () => {
    expect(compose).toMatch(/:-limeonit-data\}:\/data/);
    expect(compose).toMatch(/^volumes:\s*\n\s+limeonit-data:/m);
  });

  it("restarts the app unless stopped", () => {
    expect(compose).toMatch(/restart: unless-stopped/);
  });
});

describe(".env.example", () => {
  it.each(envSchema.keyof().options)("documents %s", (key) => {
    expect(envExample).toMatch(new RegExp(`^#?\\s*${key}=`, "m"));
  });
});

describe("ops scripts in the image", () => {
  it.each(OPS_SCRIPTS)("$name has a source file", ({ entry }) => {
    expect(existsSync(resolve(root, entry))).toBe(true);
  });

  it("covers migrate, create-admin, set-owner and invite", () => {
    expect(OPS_SCRIPTS.map((s) => s.name).sort()).toEqual([
      "create-admin",
      "invite",
      "migrate",
      "set-owner",
    ]);
  });
});

describe("Dutch install guide", () => {
  const guide = read("docs/installatie-docker.md");

  it.each([
    "docker compose up",
    "SESSION_SECRET",
    "ANTHROPIC_API_KEY",
    "OPENAI_COMPAT_BASE_URL",
    "DATABASE_URL",
    "node build/ops/create-admin.js",
    "node build/ops/set-owner.js",
    "node build/ops/migrate.js",
    "/healthz",
  ])("mentions %s", (needle) => {
    expect(guide).toContain(needle);
  });
});
