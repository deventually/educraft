import { downsample, encodeWav, SPEECH_SAMPLE_RATE } from "./wav";

/** A running microphone recording. `stop` gives the WAV; `cancel` throws it away. */
export interface Recording {
  stop(): Promise<Blob>;
  cancel(): void;
}

export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.AudioContext === "function"
  );
}

/**
 * Record the microphone as raw samples (no MediaRecorder: its formats differ per
 * browser and a Whisper server wants WAV). Audio stays in memory until `stop`.
 * Rejects when the teacher refuses microphone access.
 */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessorNode is deprecated but works everywhere without a separate worklet file.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(ctx.destination);

  const close = () => {
    processor.disconnect();
    source.disconnect();
    for (const track of stream.getTracks()) track.stop();
    void ctx.close();
  };

  return {
    async stop() {
      close();
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(length);
      let offset = 0;
      for (const c of chunks) {
        all.set(c, offset);
        offset += c.length;
      }
      return encodeWav(downsample(all, ctx.sampleRate, SPEECH_SAMPLE_RATE), SPEECH_SAMPLE_RATE);
    },
    cancel: close,
  };
}
