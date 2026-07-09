/** Provider-agnostic LLM abstraction. Adapters live in ./adapters. */

export type Role = "system" | "user" | "assistant";

export interface ImageInput {
  /** e.g. "image/png", "image/jpeg". */
  mediaType: string;
  /** base64-encoded image data (no data: prefix). */
  dataBase64: string;
}

export interface ChatMessage {
  role: Exclude<Role, "system">;
  content: string;
}

export interface GenerateOptions {
  /** Catalog model id (see models.ts), not the raw provider API id. */
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Attached to the LAST user message (e.g. handwritten-math grading). */
  images?: ImageInput[];
  /**
   * Reasoning ("thinking") switch for models that support it (e.g. Ollama Qwen3).
   * `false` forces a direct answer — no chain-of-thought — which is dramatically
   * faster for chat; `true` lets the model reason first. `undefined` = the
   * provider/model default. Only the native Ollama adapter honors this; other
   * providers ignore it.
   */
  thinking?: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface GenerateResult {
  text: string;
  usage?: TokenUsage;
}

export interface LLMProvider {
  /** Informational; the concrete provider is resolved per-model from the catalog. */
  readonly id: string;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  /** Yields text deltas as they arrive. */
  streamChat(opts: GenerateOptions): AsyncIterable<string>;
}
