import { describe, expect, it } from "vitest";
import { addModel, EMPTY_REGISTRY } from "~/lib/ai/modelRegistry";
import { isResolvableModel } from "~/lib/ai/models";
import {
  getModelRegistry,
  saveModelRegistry,
  syncModelRegistry,
} from "~/server/modelRegistry.server";
import { runWithTenant, type Tenant } from "~/server/tenants.server";

const hsl: Tenant = { id: "models-hsl", hosts: ["hsl.test"], dbPath: ":memory:" };
const hhs: Tenant = { id: "models-hhs", hosts: ["hhs.test"], dbPath: ":memory:" };

describe("the admin's models, per institution", () => {
  it("shows a model one institution's admin added only at that institution", async () => {
    const added = addModel(EMPTY_REGISTRY, {
      provider: "anthropic",
      apiId: "only-at-hsl",
      displayName: "Alleen bij HSL",
      supportsImages: false,
      alwaysThinks: false,
      clientSelectable: true,
    });
    if (!added.ok) throw new Error(added.error);
    await runWithTenant(hsl, () => saveModelRegistry(added.registry));

    await runWithTenant(hhs, syncModelRegistry);
    expect(runWithTenant(hhs, () => isResolvableModel(added.id))).toBe(false);
    expect((await runWithTenant(hhs, getModelRegistry)).added).toEqual([]);

    expect(runWithTenant(hsl, () => isResolvableModel(added.id))).toBe(true);
  });
});
