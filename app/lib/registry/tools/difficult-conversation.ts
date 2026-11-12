import type { Tool } from "../types";
import { DIFFICULT_CONVERSATION_PROMPT_V3 } from "~/lib/prompts/difficult-conversation@v3.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONVERSATION = { nl: "Het gesprek", en: "The conversation" };

/**
 * Lastig gesprek oefenen — brief P24, 24.8. An original LimeOnIt chat tool: the AI plays a
 * fictional student in a difficult conversation the teacher chooses, stays in the role, and
 * on "Geef feedback" steps out of it to give feedback that quotes what the teacher said. Bad
 * news follows the six steps of SPIKES (Baile et al., 2000); the rest general technique.
 */
export const difficultConversation: Tool = {
  id: "difficult-conversation",
  slug: "difficult-conversation",
  name: { nl: "Lastig gesprek oefenen", en: "Practise a difficult conversation" },
  subtitle: {
    nl: "Rollenspel met een gespeelde student, met feedback",
    en: "Role-play with a simulated student, with feedback",
  },
  tagline: {
    nl: "Oefen een gesprek over studieadvies, een negatief studieadvies, een onvoldoende, een vermoeden van fraude, een student die vastloopt of wil stoppen. Daarna krijg je feedback op wat je echt zei.",
    en: "Practise a conversation about study advice, a negative study advice, a fail, a suspicion of fraud, a student who is stuck or thinking of dropping out. Afterwards you get feedback on what you actually said.",
  },
  icon: "message-circle",
  userType: "instructor",
  mode: "chat",
  theory: {
    name: {
      nl: "Slecht nieuws brengen (SPIKES) en gesprekstechniek",
      en: "Delivering bad news (SPIKES) and conversation technique",
    },
    summary: {
      nl: "Oefenen in een veilige setting voordat het echte gesprek komt. Voor slecht nieuws gebruikt de feedback de zes stappen van SPIKES, oorspronkelijk voor artsen: de setting, wat de ander al weet, hoeveel die wil weten, het nieuws helder brengen, ingaan op het gevoel, en samen een plan maken (Baile e.a., 2000). Voor de andere gesprekken: open vragen, luisteren, samenvatten en feiten scheiden van een oordeel.",
      en: "Practise in a safe setting before the real conversation. For bad news the feedback uses the six steps of SPIKES, originally for doctors: the setting, what the other person already knows, how much they want to know, giving the news clearly, responding to the feeling, and making a plan together (Baile et al., 2000). For the other conversations: open questions, listening, summarising and separating facts from a judgement.",
    },
    keyCitations: ["Baile et al. (2000)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument; de feedback op slecht-nieuwsgesprekken volgt SPIKES (Baile e.a., 2000).",
      en: "Original LimeOnIt instrument; the feedback on bad-news conversations follows SPIKES (Baile et al., 2000).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 3072,
  defaultTemperature: 0.7,
  next: ["conversation-prep"],
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "scenario",
      label: {
        nl: "Welk gesprek wil je oefenen?",
        en: "Which conversation do you want to practise?",
      },
      kind: "select",
      required: true,
      defaultValue: "study-progress",
      options: [
        {
          value: "study-progress",
          label: { nl: "Studievoortgang en studieadvies", en: "Study progress and study advice" },
        },
        {
          value: "negative-study-advice",
          label: {
            nl: "Een negatief studieadvies (BSA) brengen",
            en: "Bringing a negative binding study advice",
          },
        },
        {
          value: "bad-news-grade",
          label: { nl: "Slecht nieuws over een beoordeling", en: "Bad news about an assessment" },
        },
        {
          value: "suspected-fraud",
          label: { nl: "Een vermoeden van fraude", en: "A suspicion of fraud" },
        },
        {
          value: "student-stuck",
          label: { nl: "Een student die vastloopt", en: "A student who is stuck" },
        },
        {
          value: "dropout",
          label: { nl: "Stoppen met de studie bespreken", en: "Talking about dropping out" },
        },
      ],
      group: CONVERSATION,
    },
    {
      name: "situation",
      label: { nl: "De situatie", en: "The situation" },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. Tweedejaars student, het onderzoeksverslag is met een 4,2 beoordeeld. De student verwacht een voldoende.",
        en: "e.g. Second-year student, the research report was graded 4.2. The student expects a pass.",
      },
      help: {
        nl: "Beschrijf wat er speelt. Geen naam of studentnummer: de AI speelt een verzonnen student.",
        en: "Describe what is going on, with no name or student number. The AI plays a made-up student.",
      },
      group: CONVERSATION,
    },
    {
      name: "studentReaction",
      label: { nl: "Hoe reageert de student?", en: "How does the student react?" },
      kind: "select",
      required: true,
      defaultValue: "emotional",
      options: [
        { value: "calm", label: { nl: "Rustig en afwachtend", en: "Calm and reserved" } },
        { value: "emotional", label: { nl: "Emotioneel", en: "Emotional" } },
        { value: "defensive", label: { nl: "Verdedigend", en: "Defensive" } },
      ],
      group: CONVERSATION,
    },
    {
      name: "practiceGoal",
      label: {
        nl: "Wat wil je oefenen? (optioneel)",
        en: "What do you want to practise? (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. Het slechte nieuws snel en duidelijk brengen.",
        en: "e.g. Giving the bad news quickly and clearly.",
      },
      group: CONVERSATION,
    },
  ],
  stages: [
    {
      id: "conversation",
      name: { nl: "Oefengesprek", en: "Practice conversation" },
      description: {
        nl: "De AI speelt de student; op verzoek volgt feedback op je gesprek.",
        en: "The AI plays the student; on request you get feedback on your conversation.",
      },
      systemPromptId: DIFFICULT_CONVERSATION_PROMPT_V3.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een oefengesprek, daarna feedback met citaten uit wat je zei.",
          en: "A practice conversation, then feedback quoting what you said.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: 'De student zit tegenover je. Open het gesprek zoals je dat in het echt zou doen. Ben je klaar, typ dan "Geef feedback": de AI stapt dan uit de rol en geeft feedback op wat je zei. Het is een oefening met een verzonnen student.',
      en: 'The student is sitting across from you. Open the conversation as you would in real life. When you are done, type "Give feedback": the AI then steps out of the role and gives feedback on what you said. It is an exercise with a made-up student.',
    },
    starters: [
      {
        nl: "Goedemiddag, fijn dat je er bent. Ga zitten.",
        en: "Good afternoon, thanks for coming. Have a seat.",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
