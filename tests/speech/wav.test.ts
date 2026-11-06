import { describe, expect, it } from "vitest";
import { downsample, encodeWav } from "~/lib/speech/wav";

describe("downsample", () => {
  it("keeps samples at the same rate", () => {
    const s = new Float32Array([0, 0.5, -0.5]);
    expect(Array.from(downsample(s, 16000, 16000))).toEqual(Array.from(s));
  });

  it("averages down from 48 kHz to 16 kHz (three to one)", () => {
    const s = new Float32Array([0.3, 0.3, 0.3, -0.6, -0.6, -0.6]);
    const out = downsample(s, 48000, 16000);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0.3);
    expect(out[1]).toBeCloseTo(-0.6);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM WAV that whisper.cpp reads", async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
    expect(blob.type).toBe("audio/wav");
    const view = new DataView(await blob.arrayBuffer());
    const text = (o: number) => String.fromCharCode(...new Uint8Array(view.buffer, o, 4));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8); // 4 samples × 2 bytes
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(32767); // clipped
  });
});

import { appendDictation } from "~/lib/speech/dictation";

describe("appendDictation", () => {
  it("fills an empty field, and adds to a filled one with one space", () => {
    expect(appendDictation("", "Hallo")).toBe("Hallo");
    expect(appendDictation("Eerste zin.", "Tweede zin.")).toBe("Eerste zin. Tweede zin.");
    expect(appendDictation("Regel\n", "Nieuw")).toBe("Regel\nNieuw");
  });
});
