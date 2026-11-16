/** The chapter in the teacher's own voice: the check on generic, AI-like phrasing. */
export const portfolioVoice = {
  intro:
    "These words and turns of phrase make a text generic, and they are common in AI text. Rewrite them in your own words, with what really happened.",
  kind: {
    contrast: {
      label: "Not only … but also:",
      tip: "Say it in two plain sentences, or pick what mattered most.",
    },
    dash: {
      label: "Dash:",
      tip: "Make it a comma, a full stop or brackets.",
    },
    emphasis: {
      label: "A sentence that only stresses importance:",
      tip: "Let your example show why it matters and delete this sentence.",
    },
    hollow: {
      label: "Hollow words:",
      tip: "Say exactly what you saw or did: who, what, how many.",
    },
    wrapUp: {
      label: "Summarising closing sentence:",
      tip: "End with what you will do differently next time instead.",
    },
  },
  needs: {
    add: "Add evidence",
    criterion: "Criterion {n}: {text}",
    intro:
      "LimeOnIt has no evidence from you for these yet. Add it before you have a draft written, so nothing has to stay open.",
    title: "Still needed as evidence",
  },
  spots: {
    fill: "Fill in",
    filled: "Filled in in your text. Save your text to keep it.",
    fillLabel: "Fill in: {q}",
    intro:
      "For each spot, fill in what really happened, in a few words. It goes in that place in your text.",
    title: "Fill in open spots",
  },
  title: "Does this sound like you?",
};
