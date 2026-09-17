import { test } from "node:test";
import assert from "node:assert/strict";
import { availableModel, modelCatalog } from "./model-catalog.ts";

test("catalog status controls enablement without a model denylist", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    "opencode-go": { models: {
      "retired-example": { name: "Retired example", status: "deprecated" },
      "active-example": { name: "Active example", modalities: { input: ["text", "image"] } },
    } },
  }));
  const models = await modelCatalog();
  assert.equal(models.find((m) => m.id === "retired-example")?.deprecated, true);
  assert.equal((await availableModel("active-example")).vision, true);
  await assert.rejects(availableModel("retired-example"), /no longer available/);
  await assert.rejects(availableModel("missing-example"), /no longer available/);
});

test("catalog failures cannot authorize enabling a model", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  await assert.rejects(availableModel("active-example"), /Could not load/);
  fetch.mock.mockImplementation(async () => Response.json({}));
  await assert.rejects(availableModel("active-example"), /Invalid model catalog/);
});
