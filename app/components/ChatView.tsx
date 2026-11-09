import { useState } from "react";
import type { Tool } from "~/lib/registry/types";
import { useSandbox, type SandboxCourse } from "~/lib/hooks/useSandbox";
import { useChatSession } from "~/lib/hooks/useChatSession";
import { summarizeSandbox } from "~/lib/forms/summarize";
import { useLocale } from "~/lib/i18n/useT";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { initialPickerModel, pickableModels, type PickerModel } from "~/lib/ai/models";
import { interpolateGreeting } from "~/lib/chat/greeting";
import type { TemplateValues } from "~/lib/template/interpolate";
import type { FormValues } from "~/lib/forms/values";
import { ResultActions, type ResultContext } from "./ResultActions";
import { ChatSetupCard } from "./chat/ChatSetupCard";
import { ChatSettingsAside } from "./chat/ChatSettingsAside";
import { ChatThread, type RenderAssistant } from "./chat/ChatThread";
import { ChatComposer } from "./chat/ChatComposer";

interface ChatViewProps {
  tool: Tool;
  contextProfile?: { id: string } | null;
  defaultModel?: string;
  outputLanguage?: "nl" | "en";
  /** Local models discovered at runtime (Ollama / LM Studio), appended to the catalog. */
  localModels?: PickerModel[];
  /** Admin-configured catalog allow-list (Phase 4); omitted → full client-selectable catalog. */
  catalogModels?: PickerModel[];
  onGenerationStart?: () => void;
  /** The teacher's courses (P20.4), offered in the setup card. */
  courses?: (SandboxCourse & { name: string })[];
  /** The course to start on (P27.1, `?course=`). */
  initialCourseId?: string;
  /** The course item to link the result to (P27.4, `?item=`). */
  initialItemId?: string;
  /** Next steps and places to keep the conversation (P27.1). */
  resultContext?: ResultContext;
  /**
   * Values chosen on the page itself (P29.3): the setup card is skipped and these
   * are sent with every turn.
   */
  values?: FormValues;
  /** What the settings aside shows instead of the summary of `tool.inputs`. */
  settingsSummary?: { name: string; label: string; value: string }[];
  /**
   * The text a teacher copies for students, per language, with the form fields still as
   * placeholders (P31.1, `studentPromptTemplates`). Shown only for `tool.copyableStudentPrompt`.
   */
  studentPrompt?: Record<"nl" | "en", string>;
  /** Extra fields for /api/stream, e.g. `{ dossierId }` (P29.3). */
  streamExtras?: Record<string, unknown>;
  /**
   * Renders an answer itself (e.g. the rehearsal feedback as a table); `undefined`
   * falls back to Markdown. Gets the user's own turns for checks on quotes.
   */
  renderAssistant?: RenderAssistant;
}

export function ChatView({
  tool,
  contextProfile,
  defaultModel,
  outputLanguage: defaultOutputLanguage,
  localModels,
  catalogModels,
  onGenerationStart,
  courses,
  initialCourseId,
  initialItemId,
  resultContext,
  values: presetValues,
  settingsSummary,
  studentPrompt,
  streamExtras,
  renderAssistant,
}: ChatViewProps) {
  const locale = useLocale();
  // Shared sandbox (see useSandbox). ChatView has no profile selector — the
  // context profile arrives as a prop — so it only uses the values.
  const {
    values: ownValues,
    setValue: setSandboxValue,
    courseId,
    selectCourse,
    itemId,
  } = useSandbox({ inputs: tool.inputs, courses, initialCourseId, initialItemId });
  const sandboxValues = presetValues ?? ownValues;
  const [sandboxSubmitted, setSandboxSubmitted] = useState(!!presetValues);
  const [messageInput, setMessageInput] = useState("");
  // Every screen offers the same models: API-key catalog + local CLI agents +
  // any Ollama / LM Studio models discovered at runtime.
  const modelOptions = pickableModels(localModels ?? [], false, catalogModels);
  // Pre-select an OFFERED model (not blindly the tool default): a teacher whose set
  // offers only a local model must not start on — and then send — the frontier
  // default it disabled.
  const [selectedModel, setSelectedModel] = useState(() =>
    initialPickerModel(modelOptions, tool.defaultModel, defaultModel),
  );
  // Reasoning switch for thinking-capable local models (Ollama Qwen3 etc.). Off by
  // default: a direct answer is dramatically faster for chat than reasoning first.
  // Only sent to the server when the selected model actually supports it.
  const [thinking, setThinking] = useState(false);
  const selectedModelSupportsThinking =
    modelOptions.find((m) => m.id === selectedModel)?.supportsThinking ?? false;
  // The conversation defaults to the interface language: a Dutch UI opens a
  // Dutch chat, an English UI an English one. An explicit prop still wins.
  const [outputLanguage, setOutputLanguage] = useState<"nl" | "en">(
    defaultOutputLanguage || locale,
  );

  const chat = useChatSession({
    body: {
      slug: tool.slug,
      stageId: tool.stages[0]?.id,
      values: sandboxValues,
      contextProfileId: contextProfile?.id || null,
      outputLanguage,
      model: selectedModel,
      // Only govern reasoning for models that support it; otherwise leave it to
      // the model default (omit the flag).
      thinking: selectedModelSupportsThinking ? thinking : undefined,
      courseId: courseId || undefined,
      itemId: (courseId && itemId) || undefined,
      ...streamExtras,
    },
    onGenerationStart,
  });

  const sendMessage = (message: string = messageInput) => {
    if (!message.trim() || chat.isStreaming) return;
    setMessageInput("");
    void chat.send(message);
  };

  const handleSandboxSubmit = () => {
    setSandboxSubmitted(true);
  };

  const handleStarterClick = (starter: string) => {
    if (!sandboxSubmitted) {
      handleSandboxSubmit();
      setTimeout(() => sendMessage(starter), 100);
    } else {
      sendMessage(starter);
    }
  };

  const handleRegenerate = () => {
    // Re-send the last user message
    const lastUserMessage = chat.dropLastAnswer();
    if (lastUserMessage !== undefined) {
      setTimeout(() => sendMessage(lastUserMessage), 100);
    }
  };

  if (!sandboxSubmitted) {
    return (
      <ChatSetupCard
        tool={tool}
        courses={courses ?? []}
        courseId={courseId}
        onSelectCourse={selectCourse}
        values={sandboxValues}
        onChange={setSandboxValue}
        onSubmit={handleSandboxSubmit}
      />
    );
  }

  // Greeting and starters are conversation content, so they follow the output
  // language (the aside's "Taal van uitvoer") — switching it re-renders them at
  // once and keeps them consistent with the language the model replies in. UI
  // chrome (labels, buttons) stays in the interface `locale`.
  const greeting = tool.chat?.greeting;
  const greetingText = greeting
    ? interpolateGreeting(
        loc(greeting, outputLanguage),
        // Sandbox values supply greeting placeholders like {{subject}};
        // image fields are irrelevant to greetings, hence the cast.
        sandboxValues as unknown as TemplateValues,
      )
    : "";
  const inOutputLanguage = (texts: LocalizedText[] | undefined) =>
    (texts ?? []).map((text) => loc(text, outputLanguage));

  return (
    // Two-pane chat. On a wide screen it's a fixed-height layout: the aside sits
    // on the right, and the chat column's thread scrolls internally so the
    // composer stays pinned. On mobile it collapses to a single column (aside on
    // top) that scrolls with the page — pinning there would trap the tall aside
    // and its model/language controls off-screen.
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:flex-row md:gap-6">
      <ChatSettingsAside
        tool={tool}
        summary={settingsSummary ?? summarizeSandbox(tool.inputs, sandboxValues, locale)}
        onEdit={
          tool.inputs.length > 0 && !presetValues ? () => setSandboxSubmitted(false) : undefined
        }
        values={sandboxValues}
        studentPrompt={studentPrompt}
        hasContextProfile={!!contextProfile}
        outputLanguage={outputLanguage}
        onOutputLanguage={setOutputLanguage}
        model={{
          options: modelOptions,
          selected: selectedModel,
          onSelect: setSelectedModel,
          supportsThinking: selectedModelSupportsThinking,
          thinking,
          onThinking: setThinking,
        }}
      />

      {/* Chat column — on wide screens the thread fills the height and the
          composer pins; on mobile it flows in the page scroll. */}
      <div className="flex flex-col md:min-h-0 md:flex-1">
        <ChatThread
          tool={tool}
          turns={chat.turns}
          isStreaming={chat.isStreaming}
          greeting={greetingText}
          starters={inOutputLanguage(tool.chat?.starters)}
          onStarter={handleStarterClick}
          outputLanguage={outputLanguage}
          model={selectedModel}
          renderAssistant={renderAssistant}
          footer={
            resultContext &&
            chat.savedId &&
            !chat.isStreaming && (
              <ResultActions
                {...resultContext}
                generationId={chat.savedId}
                courseId={courseId}
                itemId={itemId}
              />
            )
          }
        />
        <ChatComposer
          tool={tool}
          value={messageInput}
          onChange={setMessageInput}
          onSend={sendMessage}
          onStop={chat.stop}
          onRegenerate={handleRegenerate}
          isStreaming={chat.isStreaming}
          hasTurns={chat.turns.length > 0}
          quickReplies={inOutputLanguage(tool.chat?.quickReplies)}
          outputLanguage={outputLanguage}
        />
      </div>
    </div>
  );
}
