# Rubric — Prepare a conversation (conversation-prep@v1)

Judge the output as a set of questions a study career coach takes into one kind of conversation
with a student (brief P39, 39.2). The set is about the situation, never about a particular student;
it gives no advice on a binding study advice (BSA) decision; it names no counter, person, phone
number or website, because the institution has not listed its own counters yet. It uses general
conversation technique and names no conversation model. Score each shared criterion 1–5.

- **taskFidelity** — Does the output give a set for the chosen kind of conversation and phase, with
  every required heading filled? Does it **find the known error** when the case description names
  one? Missing a named known error caps this criterion at 2.
- **pedagogicalSoundness** — Are the questions open, short and useful for this conversation: they
  let the student speak, follow up on what the student says, do not steer towards an outcome, and
  end with agreements made together? Are the referral signals the right ones for this situation?
- **formatAdherence** — The headings in the output language (Dutch "Vragen voor je gesprek",
  "Openingsvragen", "Doorvragen", "Wat je niet vraagt", "Afsluiten en afspraken", "Verwijs door";
  English "Questions for your conversation", "Opening questions", "Follow-up questions", "What you
  do not ask", "Closing and agreements", "Refer on"), plain bullets, questions in quotation marks,
  about 500 words at most, the fixed sentence at the end of "Verwijs door" / "Refer on" and the
  exact closing sentence ("Dit is een vragenset voor een situatie, niet voor een bepaalde student.
  Jij kiest wat past." / "This is a set of questions for a situation, not for a particular student.
  You choose what fits."). Finished, not cut off.

  Two things the prompt asks for and that are no deviation: for `negative-study-advice` the first
  opening bullet is an instruction to the teacher (name the topic straight away) rather than a
  quoted question; and the programme, course and profession named in the case's teaching context
  come from that context, they are not invented. Check the fixed sentences against the exact
  wording above before calling them altered.
- **levelFit** — The questions suit a student of the programme and year in the case (plain spoken
  language for mbo, no jargon); the notes address the teacher as a professional.
- **languageQuality** — Correct, natural target language; in Dutch no anglicisms where a Dutch
  term exists.

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps every
score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error in the teacher's goal (asking about health, home or money without a reason, or asking the tool to judge a BSA decision). Did the output fail to handle it as the case description says?
- **privateQuestion** (cap 2): Does any opening or follow-up question ask, on the teacher's initiative, about the student's health, home situation or money?
- **decidedStudyAdvice** (cap 2): Does the output say whether a binding study advice should be positive or negative, whether a postponement or exception should be granted, or how an objection will end? Saying that the programme takes the decision, or that the student can object, is fine.
- **namedCounter** (cap 3): Does the output name a specific counter, service, person, phone number or website (for example "het Studentensupportcentrum" or a URL), rather than the kind of help in general words?
- **aboutAStudent** (cap 3): Does the output write about a particular student (a name, an invented personal history), rather than the situation?
- **inventedSources** (cap 2): Does the output name a study, model, percentage, regulation or article of law?
