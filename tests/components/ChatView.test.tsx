import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ChatView } from "~/components/ChatView";
import type { Tool } from "~/lib/registry/types";

// Mock streamPost to avoid actual API calls
vi.mock("~/lib/streamClient", () => ({
  streamPost: vi.fn(),
}));

// Mock localized helper
vi.mock("~/lib/i18n/localized", () => ({
  loc: (text: string | Record<string, string> | null | undefined, locale: string) => {
    if (!text) return "";
    if (typeof text === "string") return text;
    return text[locale] || text.en || text.nl || "";
  },
}));

// Mock useLocale and useT
vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      contextProfile: "Context",
      generate: "Generate",
      generating: "Generating…",
      stop: "Stop",
      regenerate: "Regenerate",
    },
    chat: {
      send: "Send",
      stop: "Stop",
      regenerate: "Regenerate",
      streaming: "Thinking…",
      inputPlaceholder: "Your message…",
      sandboxHint: "Fill in the details",
      continue: "Continue",
      startConversation: "Start the conversation",
      interrupted: "Interrupted",
    },
    error: {
      unknown: "Something went wrong",
    },
  }),
}));

// Mock tool (mentorai-like)
const mockTool: Tool = {
  id: "mentorai",
  slug: "mentorai",
  name: { nl: "MentorAI", en: "MentorAI" },
  tagline: { nl: "Your AI mentor", en: "Your AI mentor" },
  icon: "brain",
  userType: "student",
  mode: "chat",
  theory: {
    name: { nl: "Cognitive Apprenticeship", en: "Cognitive Apprenticeship" },
    summary: {
      nl: "Learn through modeling and scaffolding",
      en: "Learn through modeling and scaffolding",
    },
    keyCitations: [],
  },
  attribution: {
    chapterTitle: "From Model to Mentor",
    authors: "Author Name",
    bookTitle: "The Pedagogical Promptbook",
    editor: "Editor",
    doi: "10.1234/example",
    year: 2024,
    license: "CC BY 4.0",
  },
  inputs: [
    {
      name: "discipline",
      label: { nl: "Discipline", en: "Discipline" },
      kind: "text",
      required: true,
    },
  ],
  stages: [
    {
      id: "mentor",
      name: { nl: "Mentor", en: "Mentor" },
      systemPromptId: "mentorai@v1",
      output: { kind: "markdown" },
    },
  ],
  chat: {
    greeting: { nl: "Welkom!", en: "Welcome!" },
    starters: [
      { nl: "Help me verstaan OOP", en: "Help me understand OOP" },
      { nl: "Wat is een klasse?", en: "What is a class?" },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
  defaultModel: "claude-sonnet-4-6",
  usesContextProfile: false,
  defaultOutputLanguage: "en",
  enabled: true,
  phase: 1,
};

describe("ChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders greeting and starter chips with no a11y violations", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);

    // First, check a11y of the sandbox form (before continue)
    const results = await axe(container);
    expect(results.violations).toEqual([]);

    // Submit the sandbox form to see the greeting
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    await user.click(continueBtn);

    // Greeting should be visible
    expect(screen.getByText("Welcome!")).toBeInTheDocument();

    // Starter chips should be visible
    const starters = screen.getByText("Help me understand OOP");
    expect(starters).toBeInTheDocument();
  });

  it("renders one-time sandbox inputs from tool.inputs", async () => {
    const { container } = render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);

    // The sandbox form section should be visible
    expect(screen.getByText("Context")).toBeInTheDocument();

    // The continue button should be present
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    // Accessibility
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("sends a message and simulates streaming response", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;

    // Mock a simple streaming response
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      // Simulate streaming tokens
      setTimeout(() => onToken("Hello "), 10);
      setTimeout(() => onToken("student"), 20);
      setTimeout(() => onDone("Hello student"), 30);
    });

    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);

    const user = userEvent.setup();

    // Submit the sandbox form by clicking Continue
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    await user.click(continueBtn);

    // Wait for the greeting to appear (signals that ChatView updated)
    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
    });

    // Verify the composer is present by checking for the input placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your message…")).toBeInTheDocument();
    });

    // Type a message
    const messageInput = screen.getByPlaceholderText("Your message…");
    await user.type(messageInput, "What is OOP?");

    // Send the message by pressing Enter
    await user.keyboard("{Enter}");

    // Wait for the message to appear in the thread
    await waitFor(() => {
      expect(screen.getByText("What is OOP?")).toBeInTheDocument();
    });
  });

  it("shows live region for streaming with aria-live=polite", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);

    // Submit sandbox to show the chat interface
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    await user.click(continueBtn);

    // Check for aria-live region
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it("has accessible message thread and focus management", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);

    // Submit sandbox to show the chat interface
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    await user.click(continueBtn);

    // Check for semantic thread structure
    const thread = container.querySelector('[role="log"]');
    expect(thread).toBeInTheDocument();
  });

  it("stops an in-progress stream and marks the turn interrupted", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    let abortSignal: AbortSignal | undefined;
    // Simulate a stream that stays in progress (no tokens, never resolves on its own).
    mockStreamPost.mockImplementation(async (_url, _body, _handlers, signal) => {
      abortSignal = signal;
      return new Promise<void>(() => {});
    });

    const user = userEvent.setup();
    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.type(screen.getByPlaceholderText("Your message…"), "Explain recursion");
    await user.keyboard("{Enter}");

    // While streaming, the Stop button is shown; clicking it aborts the request.
    await user.click(await screen.findByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    });
    expect(abortSignal?.aborted).toBe(true);
    // Streaming ended (Send is back) and the empty assistant turn is marked interrupted.
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
  });

  it("regenerates by dropping the last answer and re-sending the prior message", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("First answer");
      onDone?.("First answer");
    });

    const user = userEvent.setup();
    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.type(screen.getByPlaceholderText("Your message…"), "What is OOP?");
    await user.keyboard("{Enter}");

    await screen.findByText("First answer");
    expect(mockStreamPost).toHaveBeenCalledTimes(1);

    // Regenerate is available once a turn exists and streaming has stopped.
    await user.click(await screen.findByRole("button", { name: "Regenerate" }));

    // It re-sends, with the prior user message as the last entry in the payload.
    await waitFor(() => expect(mockStreamPost).toHaveBeenCalledTimes(2));
    const resentBody = mockStreamPost.mock.calls[1][1] as {
      messages: { role: string; content: string }[];
    };
    expect(resentBody.messages.at(-1)).toEqual({ role: "user", content: "What is OOP?" });
  });
});
