# Working with a tool

Each tool turns one method from the book into a form or a conversation. The top of the tool page says what the tool does. Under **Help & examples** you find the guide to that one tool.

## Filling in a form

Most tools are filled in and generated in one go with **Generate**. Fields marked *required* must be filled in; the rest helps the AI but may stay empty. Each field has a short explanation.

Some tools work in **stages**: you first generate stage 1, read it, and then carry on. A stage marked *Optional* may be skipped.

Once the result is there, you can collapse the form to get more room to read. Not happy? Change your input and choose **Regenerate**.

## Holding a conversation

Other tools are a conversation, for example a critical colleague who keeps asking questions. First fill in the short questions under *Before you start*. Then begin with a suggestion or type your own message. **Stop** interrupts an answer.

Some conversations are meant for your students. **Copy for your students** gives you a text they paste into their own AI chat.

## Teaching context, course and model

- **Teaching context:** choose which profile the tool uses. Your default profile is already selected. See [Set up your teaching context](/help/context-profiles).
- **Course:** choose your course, and the tool fills in your learning outcomes and links the result to the course. See [Courses and the alignment spine](/help/courses).
- **Advanced:** here you choose the AI model, the language of the result and whether the model reasons first. Reasoning is more thorough, but slower.

## Documents and student work

Many tools let you upload a **PDF or Word file**. Your browser takes the text out; the file itself is not stored or sent. Under **What the AI receives** you see exactly which text goes to the AI. A scan without text won't work; paste the text yourself instead.

In tools that review student work, such as feedback or an assessment, you see the original next to the result. **Show in document** jumps to the place where a quote is.

Under the form, every tool shows **What goes to the AI**: the text as it goes, with each replacement marked and its code next to it (for example *Jan de Vries* → `[COLLEGA-1]`). It works while you type; nothing is sent until you press the button yourself.

- LimeOnIt knows your name and those of your colleagues (your teams and the people on your courses) and recognises email addresses, phone numbers, postcodes, IBANs and numbers that look like a student number.
- LimeOnIt does not know student names. Fill them in under **Names that must go**, with the student number, the company and supervisors. In tools for student work this is open already. From the student number you fill in, LimeOnIt learns what student numbers look like; other numbers of that shape go too, other numbers stay.
- Click a replacement to keep the word. If it is a word such as a surname that is also a term from your field, LimeOnIt remembers it on your **Never replace** list; you take it off there too. Select a word in the preview and choose **Also replace** to remove something extra.

A full name always goes. A single part of a name goes only when it starts with a capital, and when it is also an ordinary word (such as Rose or Will) only in the middle of a sentence. Names of researchers and models, such as Bloom, Vygotsky or Hattie, stay.

Student names and what you fill in under *Names that must go* stay in your browser: the server only sees codes, and the result shows the names again. *Earlier work* then keeps the version with codes. For student work, nothing but the version with codes leaves your browser. Your own name and your colleagues' names are replaced on the server and put back there too, so *Earlier work* shows them as written. Note: figures and photos are not anonymised, and a misspelt name can slip through. So do check the text.

Where you do not type, such as in **Evidence in one go**, the review team, importing from documents and processing a course evaluation, you see **Check what goes to the AI** before anything is sent: a list per word, with how often it occurs and where (for example *Jan de Vries (12×)* → `[COLLEGA-1]`), also in file and folder names. Per word you choose **Do not replace** or **Also replace**, and under *Replace another word* you add a word the list missed. Only after **Send** does anything go. Names in your course itself are replaced on the server; they come back as written in the result.

Everything that goes to the AI also passes a check **on the server**. If it finds something you did not see, for example a colleague in your context or in an earlier step, it sends nothing and you see **Look first**: per word you choose *Replace* or *Do not replace*, and only after **Send** does anything go. Nothing is ever replaced silently.

## Read aloud and dictation

- **Read aloud** reads a result out loud with a voice on your own device. If your device has no Dutch or English voice, you won't see the button.
- **Dictate** turns what you say into text in a field. The audio is only converted, never stored. You only see this button if your administrator has switched dictation on.

## After the result

- Under **Carry on with this result** you find a sensible **next step**, and you can keep the result with a course.
- **Was this helpful?** lets you say what you thought of it. That helps the administrator improve the tools.
- Everything you make then shows up in [Earlier work](/help/saved-work).
