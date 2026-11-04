import type { PromptDef } from "./types";
import en from "./files/dialogic-encounters@v2.en.md?raw";
import nl from "./files/dialogic-encounters@v2.nl.md?raw";

/**
 * SOURCE: Clark-Stallkamp, Berry, Cole & Lin, "Dialogic Encounters with Learning
 * Theorists", in The Pedagogical Promptbook (ed. D. Wiley), CC BY 4.0. Appendix
 * "Final Version of Prompt", printed pp. 100–102. `verbatim` below is that text, word
 * for word: in the book the prompt is an assignment for students with a template
 * they paste into the AI themselves ("You are a world-renowned expert simulating…").
 *
 * What @v2 changes (BESLUIT-2026-11-04-22): the template becomes the system prompt,
 * with the theorist chosen in the form. The chapter's findings are written into it:
 * answer in the theorist's own concepts and era (p. 87), correct a wrong assumption
 * in the question, also a subtle one on the boundary between theories (pp. 89–90),
 * mark talk about later technology as extrapolation (p. 96), present answers as
 * provisional (p. 86), invent no sources, and support the book's step 3: stop the
 * interview and run an honest CRAAP test. Translated to Dutch.
 */
const verbatim = `Module 6 - Tech Talk with a Theorist

What You'll Do:
Learn more deeply about one of the three foundational learning theories (behaviorism, cognitivism, constructivism)
Learn to prompt and critically evaluate generative AI
Practice identifying misinformation or "hallucinations" using the CRAAP test
Make connections between learning theory and classroom technology

Step 1: Choose Your Theory
Pick one of the Big Three learning theories and one of the listed key theorists:
Behaviorism – (B.F. Skinner, Ivan Pavlov)
Cognitivism – (Jean Piaget, Jerome Bruner)
Constructivism – (Lev Vygotsky, John Dewey)

Step 2: Interview the Theorist Using AI
Use ChatGPT (or a similar AI tool) to simulate a conversation with the theorist. Your goal is to interview them about their theory and ask follow-up questions to understand it better. You are welcome to just start messing around in AI to do this. I encourage trial and error here.

However, if you don't know where to begin, try this pre-made AI prompt template:

Copy and paste this into the AI tool and customize your name and questions.

Start by telling the AI: You are a world-renowned expert simulating [Theorist's Name], known for developing [Learning Theory Name]. I am a pre-service teacher learning about how to apply learning theory to classroom technology integration. Please answer my interview questions as if you are [Theorist's Name]. Make your responses clear for a beginner in education. I may ask follow-up questions as needed.

Once the AI confirms, ask each question individually to allow for follow up:
What is the core idea behind your learning theory?
How do students best learn according to your theory?
How would you explain this theory to a [grade] teacher?
What kind of classroom activities or technologies would support your theory?
How does your theory differ from the other theories?

Ask 2 more follow-up questions at some point in the interview.

TIP: You might have to stop and restart several times with AI and tweak the prompt to give AI more parameters about your theorist. If something seems off, do some research about the theorist and feed some information in. For example, if I had ChatGPT simulating Bandura for Social Learning Theory and it started giving me answers from another perspective, I would research Bandura, find a credible source, and prompt "Please consider this information about Bandura when you simulate him in responses [cut and paste or upload a doc]."

CRAAP Questions to Ask Your Evaluation & Evidence
Currency Is this information up to date?
Relevance Does it help you understand the theory for teaching?
Authority Does the information align with trusted sources (textbook, .edu/.org sources)?
Accuracy Is it supported by evidence? Does it contradict anything you know?
Purpose Does it seem objective? Or is it overly confident or vague?

Step 3: Check for Hallucinations with the CRAAP Test
After your AI interview, you must fact-check the AI's responses. AI can sometimes make things up OR it really likes to people please - it likes to tell you what you want to hear. Choose two answers from your interview and evaluate them using the CRAAP test [linked back to lesson on CRAAP test in course]:

You can do this yourself (review and provide concrete evidence) OR try an AI evaluation. In the same chat tell the AI that you want to stop the interview. Then, proceed to ask it to perform a CRAAP Test by using/tweaking the following prompt:

"Please stop the interview. Now, please perform a CRAAP (Currency, Relevance, Authority, Accuracy, and Purpose) Test on the following two questions you answered as a theorists: [insert two questions]. I need you to provide your evaluation and concrete evidence using peer-reviewed and reputable resources. Please provide a link to the source."

A note about evidence: Evidence is not "well I feel that was correct based on what I know" OR "I was taught that, so it seems right". Evidence is from credible sources (i.e., you will need to find some peer-reviewed journals - try Google Scholar OR texts online!). There is nothing worse than confirming personally that AI seemed correct because Piaget says that based on previous classes while at the same time AI refers to Piaget as "she" in the entire transcript - that my friends is a simple hallucination!

Step 4: A Short Reflection (150–250 words)
You will write a short reflection describing:
What you learned from the interview
Any hallucinations you found/strange replies from AI
How you verified the information given
How you think this theory could guide their technology use as a teacher

Step 5: Submit
Turn in:
Your AI conversation record (copy/paste or screenshot) - I want to see everything (It is okay to mess up or have issues and restart - this is learning!)
Completed CRAAP test on 2 responses
Your short-written reflection
`;

export const DIALOGIC_ENCOUNTERS_PROMPT_V2: PromptDef = {
  id: "dialogic-encounters@v2",
  verbatim,
  runtime: { nl, en },
};
