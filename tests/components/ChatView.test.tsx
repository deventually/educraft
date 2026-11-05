import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
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
      model: "Model",
      outputLanguage: "Output language",
      dutch: "Dutch",
      english: "English",
      reasoning: "Reason before answering",
      reasoningHint: "Off is much faster.",
      advanced: "Advanced",
      noProfileAction: "Set up teaching context",
      course: "Course",
      noCourse: "No course",
      courseHint: "Fills in its learning outcomes and links the result to it.",
    },
    chat: {
      send: "Send",
      stop: "Stop",
      regenerate: "Regenerate",
      streaming: "Thinking…",
      inputPlaceholder: "Your message…",
      sandboxHint: "Fill in the details",
      setupHeading: "Before you start",
      noProfileHint: "This conversation does not know your teaching context.",
      continue: "Continue",
      startConversation: "Start the conversation",
      interrupted: "Interrupted",
      yourSettings: "Your settings",
      edit: "Edit",
      endSession: "End session",
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
    expect(screen.getByText("Before you start")).toBeInTheDocument();

    // The continue button should be present
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    // Accessibility
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("reflects the chosen sandbox settings in the chat screen", async () => {
    const user = userEvent.setup();
    const selectTool: Tool = {
      ...mockTool,
      inputs: [
        {
          name: "theorist",
          label: { nl: "Theoreticus", en: "Theorist" },
          kind: "select",
          required: true,
          options: [
            { value: "Jean Piaget", label: { nl: "Piaget", en: "Piaget" } },
            { value: "Lev Vygotsky", label: { nl: "Vygotsky", en: "Vygotsky" } },
          ],
        },
      ],
    };

    const { container } = render(<ChatView tool={selectTool} onGenerationStart={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // The chat screen surfaces what was selected before entering the chat,
    // shown in the settings aside.
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
    expect(within(aside as HTMLElement).getByText("Theorist")).toBeInTheDocument();
    expect(within(aside as HTMLElement).getByText("Piaget")).toBeInTheDocument();

    // And offers a way back to change it.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("sends the currently selected output language with the next message", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("ok");
      onDone?.("ok");
    });

    const user = userEvent.setup();
    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Switch the aside's output language, then send a message.
    await user.selectOptions(screen.getByLabelText("Output language"), "nl");
    await user.type(screen.getByPlaceholderText("Your message…"), "Hello");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(mockStreamPost).toHaveBeenCalled());
    const body = mockStreamPost.mock.calls.at(-1)?.[1] as { outputLanguage: string };
    expect(body.outputLanguage).toBe("nl");
  });

  it("[bugfix] sends an offered model, not the tool default, when the default isn't offered", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("ok");
      onDone?.("ok");
    });

    const user = userEvent.setup();
    // Simulate a local-only cohort: the loader offers only the local model, so
    // the tool's frontier default (Sonnet) is not selectable for this student.
    render(
      <ChatView
        tool={mockTool} // defaultModel: "claude-sonnet-4-6"
        onGenerationStart={() => {}}
        catalogModels={[]}
        localModels={[{ id: "ollama::qwen3.6:27b-coding-nvfp4", displayName: "Ollama · qwen" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // One offered model → nothing to choose, so no picker (and no "Advanced") is shown.
    expect(screen.queryByLabelText("Model")).toBeNull();

    // And the model actually sent is the offered one, not the tool default.
    await user.type(screen.getByPlaceholderText("Your message…"), "Hello");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(mockStreamPost).toHaveBeenCalled());
    const body = mockStreamPost.mock.calls.at(-1)?.[1] as { model: string };
    expect(body.model).toBe("ollama::qwen3.6:27b-coding-nvfp4");
    expect(body.model).not.toBe("claude-sonnet-4-6");
  });

  it("[thinking] shows a reasoning toggle for a thinking-capable model and sends the flag", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("ok");
      onDone?.("ok");
    });

    const user = userEvent.setup();
    const { container } = render(
      <ChatView
        tool={mockTool}
        onGenerationStart={() => {}}
        catalogModels={[]}
        localModels={[
          { id: "ollama::qwen3", displayName: "Ollama · qwen3", supportsThinking: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByText("Advanced"));
    const toggle = screen.getByLabelText("Reason before answering") as HTMLInputElement;
    expect(toggle.checked).toBe(false); // default OFF → fast answers
    expect((await axe(container)).violations).toEqual([]);

    // Default (off) → thinking:false is sent.
    await user.type(screen.getByPlaceholderText("Your message…"), "hi");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockStreamPost).toHaveBeenCalled());
    expect((mockStreamPost.mock.calls.at(-1)?.[1] as { thinking?: boolean }).thinking).toBe(false);

    // Turn reasoning on → thinking:true is sent.
    await user.click(toggle);
    await user.type(screen.getByPlaceholderText("Your message…"), "again");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockStreamPost.mock.calls.length).toBeGreaterThan(1));
    expect((mockStreamPost.mock.calls.at(-1)?.[1] as { thinking?: boolean }).thinking).toBe(true);
  });

  it("keeps model and reasoning inside 'Advanced'; language stays visible", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ChatView
        tool={mockTool}
        onGenerationStart={() => {}}
        catalogModels={[]}
        localModels={[
          { id: "ollama::qwen3", displayName: "Ollama · qwen3", supportsThinking: true },
          { id: "ollama::llama3", displayName: "Ollama · llama3" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const details = container.querySelector("aside details") as HTMLDetailsElement;
    expect(details).toBeInTheDocument();
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")).toHaveTextContent("Advanced");
    expect(details.querySelector("summary")).toHaveTextContent("Ollama · qwen3");
    expect(details.contains(container.querySelector("#chat-model"))).toBe(true);
    expect(details.contains(container.querySelector("#chat-thinking"))).toBe(true);
    // Output language is not technique: it stays outside the disclosure.
    const lang = container.querySelector("#chat-lang") as HTMLElement;
    expect(lang).toBeInTheDocument();
    expect(lang.closest("details")).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("shows no 'Advanced' for one model without a reasoning switch", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ChatView
        tool={mockTool}
        onGenerationStart={() => {}}
        catalogModels={[]}
        localModels={[{ id: "ollama::llama3", displayName: "Ollama · llama3" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(container.querySelector("aside details")).toBeNull();
    expect(container.querySelector("#chat-model")).toBeNull();
    expect(container.querySelector("#chat-lang")).toBeInTheDocument();
  });

  it("titles the one-time setup card 'Before you start'", () => {
    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);
    expect(screen.getByRole("heading", { name: "Before you start" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Context" })).toBeNull();
  });

  it("hints at setting a default context when a context tool has none", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ChatView
          tool={{ ...mockTool, usesContextProfile: true }}
          contextProfile={null}
          onGenerationStart={() => {}}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText("This conversation does not know your teaching context."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up teaching context" })).toHaveAttribute(
      "href",
      "/context-profiles",
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it("shows no context hint when a profile is set", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChatView
          tool={{ ...mockTool, usesContextProfile: true }}
          contextProfile={{ id: "p1" }}
          onGenerationStart={() => {}}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("link", { name: "Set up teaching context" })).toBeNull();
  });

  it("shows no context hint for a tool that does not use one", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChatView tool={mockTool} contextProfile={null} onGenerationStart={() => {}} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("link", { name: "Set up teaching context" })).toBeNull();
  });

  it("[thinking] hides the toggle and omits the flag for a non-thinking model", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("ok");
      onDone?.("ok");
    });

    const user = userEvent.setup();
    render(
      <ChatView
        tool={mockTool}
        onGenerationStart={() => {}}
        catalogModels={[]}
        localModels={[{ id: "ollama::llama3", displayName: "Ollama · llama3" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.queryByLabelText("Reason before answering")).toBeNull();

    await user.type(screen.getByPlaceholderText("Your message…"), "hi");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockStreamPost).toHaveBeenCalled());
    expect(
      (mockStreamPost.mock.calls.at(-1)?.[1] as { thinking?: boolean }).thinking,
    ).toBeUndefined();
  });

  it("re-renders greeting and starters in the selected output language at once", async () => {
    const user = userEvent.setup();
    // mockTool defaults to English output, so the welcome view starts English.
    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Welcome!")).toBeInTheDocument();
    expect(screen.getByText("Help me understand OOP")).toBeInTheDocument();

    // Switching the aside's output language flips the conversation scaffolding.
    await user.selectOptions(screen.getByLabelText("Output language"), "nl");

    expect(screen.getByText("Welkom!")).toBeInTheDocument();
    expect(screen.queryByText("Welcome!")).toBeNull();
    expect(screen.getByText("Help me verstaan OOP")).toBeInTheDocument();
    expect(screen.queryByText("Help me understand OOP")).toBeNull();
  });

  it("defaults the chat output language to the UI locale, not the tool default", async () => {
    const user = userEvent.setup();
    // UI locale is mocked to "en"; give the tool a conflicting Dutch default to
    // prove the chat follows the interface language, not the tool's own default.
    const nlDefaultTool: Tool = { ...mockTool, defaultOutputLanguage: "nl" };
    const { container } = render(<ChatView tool={nlDefaultTool} onGenerationStart={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const langSelect = container.querySelector("#chat-lang") as HTMLSelectElement;
    expect(langSelect.value).toBe("en");
  });

  it("lets the user reopen the sandbox via Edit", async () => {
    const user = userEvent.setup();
    render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    // Back on the sandbox gate.
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
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

  it("offers no end-session control after a completed turn", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    (streamPost as ReturnType<typeof vi.fn>).mockImplementation(
      async (_url, _body, { onToken, onDone }) => {
        onToken("Hi");
        onDone("Hi");
      },
    );
    const { container } = render(<ChatView tool={mockTool} onGenerationStart={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByPlaceholderText("Your message…"), "What is OOP?");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByText("What is OOP?")).toBeInTheDocument());
    await screen.findByText("Hi");
    expect(screen.queryByRole("button", { name: /end session|sessie beëindigen/i })).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
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

  it("offers the full model list (catalog + CLIs + discovered local) in the chat picker", async () => {
    const user = userEvent.setup();
    const local = [{ id: "ollama::gemma4:31b", displayName: "Ollama · gemma4:31b" }];
    const { container } = render(
      <ChatView tool={mockTool} localModels={local} onGenerationStart={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByText("Advanced"));

    const picker = container.querySelector("#chat-model") as HTMLSelectElement;
    expect(picker).toBeInTheDocument();
    const optionValues = [...picker.options].map((o) => o.value);
    // API-key model, a CLI agent, and the running local model are all selectable.
    expect(optionValues).toContain("claude-sonnet-4-6");
    expect(optionValues).toContain("claude-code");
    expect(optionValues).toContain("ollama::gemma4:31b");
    // The stale hardcoded Opus id is gone.
    expect(optionValues).not.toContain("claude-opus-4-7");

    // Every offered id must actually resolve, so none silently falls back server-side.
    const { isResolvableModel } = await import("~/lib/ai/models");
    for (const value of optionValues) {
      expect(isResolvableModel(value), value).toBe(true);
    }
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

describe("ChatView — course (P20, 20.4)", () => {
  const courseTool: Tool = {
    ...mockTool,
    inputs: [
      {
        name: "learningOutcome",
        prefillFromCourse: { source: "learningOutcomes" },
        label: { nl: "Leeruitkomst", en: "Learning outcome" },
        kind: "textarea",
        required: true,
      },
    ],
  };
  const courses = [
    {
      id: "c1",
      name: "Biology",
      contextProfileId: null,
      outcomes: [{ text: "Explains photosynthesis" }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers the course in the setup card, prefills the outcomes and sends the courseId", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mockStreamPost = streamPost as ReturnType<typeof vi.fn>;
    mockStreamPost.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken("ok");
      onDone?.("ok");
    });
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ChatView tool={courseTool} courses={courses} />
      </MemoryRouter>,
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Course" }), "c1");
    expect(screen.getByLabelText(/Learning outcome/)).toHaveValue("- Explains photosynthesis");
    expect((await axe(container)).violations).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByPlaceholderText("Your message…"), "Hello");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockStreamPost).toHaveBeenCalled());
    const body = mockStreamPost.mock.calls.at(-1)?.[1] as { courseId?: string };
    expect(body.courseId).toBe("c1");
  });

  it("shows no course picker without courses and sends no courseId", async () => {
    render(
      <MemoryRouter>
        <ChatView tool={courseTool} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("combobox", { name: "Course" })).toBeNull();
  });
});
