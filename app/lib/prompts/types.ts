export type PromptLanguage = "nl" | "en";

export interface PromptDef {
  /** Stable, versioned id referenced by ToolStage.systemPromptId. */
  id: string;
  /**
   * Verbatim prompt text from the book's appendix (CC BY 4.0). Preserved for
   * fidelity and surfaced in the UI ("originele prompt"). Not sent to the model.
   */
  verbatim: string;
  /**
   * Runtime system prompt actually sent to the model, one variant per output
   * language. Each variant is externalised to `files/<id>.<lang>.md` (loaded via
   * Vite `?raw`) and contains {{placeholders}} for form values, {{contextProfile}}
   * and any consumed prior-stage outputs. Both variants must share the same
   * placeholder set (enforced by tests/prompts.test.ts).
   */
  runtime: Record<PromptLanguage, string>;
}
