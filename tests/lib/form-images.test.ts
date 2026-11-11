import { describe, expect, it } from "vitest";
import { imagesOf } from "~/lib/forms/values";
import type { InputField } from "~/lib/registry/types";

describe("imagesOf", () => {
  it("collects the images of the image fields, and nothing else", () => {
    const photo = { dataBase64: "AAA", mediaType: "image/png" };
    const inputs = [
      { name: "work", kind: "image" },
      { name: "empty", kind: "image" },
      { name: "topic", kind: "text" },
    ] as unknown as InputField[];
    expect(imagesOf(inputs, { work: [photo], empty: [], topic: "x" } as never)).toEqual([photo]);
  });
});
