# The Director

## In short

- The Director is a second model. It reads each message before it is spoken.
- It adds voice tags, such as `[whispers]` or `[flatly]`, where the delivery changes. It writes for the engine you use. See [Voice engines](engines.md).
- It adds sounds for what happens in the scene.
- It picks who says each quoted line, unless the Decision model already did.
- It never changes a word. If it does, that line is read as written.
- Its whole prompt is on the Director tab, where you can read it and change it.

## Steps

1. The message is split into numbered lines. Text in double quotes is speech. Everything else is narration.
2. The Director gets the lines, the cast, and the rules from your switches.
3. It answers with each line, marked up, and who says it.
4. Auto Foley checks each line:
   - The words outside the brackets must be the same words. Capitals, ellipses and dashes may change.
   - Tags that describe something seen, such as `[smiles]`, are taken out. No voice can say them.
   - A line keeps no more tags than **How much acting** allows: 1, 2 or 4.
5. A line that fails the word check is read as written. While it plays, **Now playing** on the Stage tab shows a note under it.

## What it sends

Two messages, to the connection picked under **Which connection**:

- **The prompt**, as the system message.
- **The message as JSON**, as the user message. It holds:
  - `cast`: each person's name, other names, and the **How they speak** note
  - `author`: who wrote the message
  - `lines`: the numbered lines, with a speaker filled in where the Decision model was sure
  - `rules`: your switches, such as the tag limit, the sound style, and whether intimate sounds are allowed. It also names the engine, with its note, and its tag list when it has one. See [Voice engines](engines.md).

Nothing else from your chat is sent. The Director does not see earlier messages.

Now playing says how many input and output tokens the Director used for the message, over every ask. The count comes from the provider when it sends one. If not, Lumiverse's own tokenizer counts it, for the Director's model. When neither can count, it is a guess from the length, and it says "about".

### What it costs

- **Input price, per million tokens** and **Output price, per million tokens** are in the Director tab, under **Give up waiting after**. Type your provider's prices, or paste the whole line, such as "$0.30 / 1M input tokens".
- With a price set, Now playing adds the cost of the script, such as "Cost: about 0.0021".
- When the provider sends its own cost, that figure is shown instead.
- At 0, which is the default, no cost is worked out.
- No currency symbol is shown, since Auto Foley does not know your currency.

## An example

A message from a character named Pell, with your persona Odessa in the cast:

> Pell slid the key across the counter. "Room six. The lock sticks." \*Somewhere upstairs, a door slammed.\* "Is it always this loud?" Odessa asked.

It is split into five lines:

| # | Kind | Text |
| --- | --- | --- |
| 0 | narration | Pell slid the key across the counter. |
| 1 | speech | Room six. The lock sticks. |
| 2 | narration | Somewhere upstairs, a door slammed. |
| 3 | speech | Is it always this loud? |
| 4 | narration | Odessa asked. |

With **How sounds are made** set to **In the voice**, the Director answers, and Auto Foley plays:

| # | Speaker | What Eleven v3 is sent |
| --- | --- | --- |
| 0 | Narrator | Pell slid the key across the counter. |
| 1 | Pell | Room six. [flatly] The lock sticks. |
| 2 | Narrator | [sound of a heavy door slamming upstairs] Somewhere upstairs, a door slammed. |
| 3 | Odessa | Is it ALWAYS this loud? |
| 4 | Narrator | Odessa asked. |

If the Director had sent line 3 as "Is it always this noisy?", the word check fails. Line 3 is then read as written, "Is it always this loud?", and **Now playing** says why under the line while it plays.

## A second Director

**Second Director**, on the Director tab under **Which connection**, is off by default.

- When the Director refuses, or sends back nothing it can use after every ask, a second connection is asked.
- It gets the same request, and the same number of asks.
- Pick a different connection from the first, such as another provider. The same connection is not asked twice.
- If the second Director also fails, the message is read as written, so it still plays. The Log says what each one did. It is saved, marked "read as written", and **Direct again** tries the Directors again.
- Stop cancels whichever Director is being asked.

## The switches

All on the Director tab:

- **Use the Director.** Off: messages are read as written.
- **Which connection.** The first choice is your default connection in Lumiverse. It is named in the box.
- **How much acting.** Subtle, Natural or Dramatic. At most 1, 2 or 4 tags in a line.
- **Voice tags.** Delivery and emotion.
- **Breaths, sighs and laughs.** Sounds a voice makes. Off takes them out of every line.
- **Sounds**, and under it **How sounds are made**, **Intimate sounds** and **Only sounds the text shows**. See [Sounds](sounds.md).
- **Find new speakers.** Someone new who speaks is added to the cast. See [The cast](cast.md).
- **Big moments.** The Director can mark an emotional peak. On ElevenLabs, that line gets a looser voice: one step toward Creative on Eleven v3, or 0.25 lower stability on Eleven v4. The audience can cheer on it.

## Singing

- A line someone sings is marked as sung. The Director marks it, and so does a music note in the text, such as ♪. The note is not read.
- Each engine that can sing is told the line is sung: `[sings]` on Eleven v3, `[singing]` on Fish Audio, and a note on Gemini 3.8.
- On an engine that cannot sing, the line is spoken.

## Notes for each voice engine

The Director tab has a note for each engine. It says how that engine reads tags, and it is sent with the rules.

- **Send the notes as** says where the note goes in the request:
  - **In the rules**, the default: inside the rules sent with each message, as `engine_note`, beside the other rules the Director follows, such as whether sounds are on.
  - **System**, **User** or **Assistant**: as a message of its own, with that role, right after the prompt. Most people can leave it on In the rules.
- The engine your connection runs is shown first, open, under **In use now**. Every other engine has its own fold, in the same order as the table in [Voice engines](engines.md).
- **Back to built-in** puts the built-in note back. It asks first.

## How speakers are found

Before the Director is asked, Auto Foley reads the message for clues. A sure clue fixes the speaker. A likely one is passed to the Director as a hint, and it can choose someone else when the text points elsewhere.

**Sure:**

- A speech verb next to the quote, such as `"Not tonight," Odile said.` or `said Odile`.
- A name and a colon before the quote, such as `Odile: "Not tonight."`
- A line in script style, such as `Odile: Not tonight.`, for someone in the cast. The name is not read aloud.

**Likely:**

- An action just before the quote, in the same paragraph, such as `Odile set the cup down. "Not tonight."`
- The same speaker going on in a paragraph, when nobody else is named in between.
- Two people taking turns: a paragraph that opens with a quote nobody is named for goes to whoever did not speak in the paragraph before.

Then the Decision model, when it is on, picks speakers for the quotes still open. The Director picks the rest.

## The Decision model

A Decision model answers questions with a choice or a chance. It writes no text. Lumiverse keeps its address and key, under **Decision models** in the **Connections** panel.

With **Use a Decision model** on:

- It picks who says each quoted line, from up to 12 people in the cast. A pick it is less sure of than **How sure it must be** is left to the Director.
- With sounds on, it gives the chance that each narration line describes a sound. The Director is told these chances. With **Only sounds the text shows** on, a line at or over **How sure it must be** keeps its sounds.
- **How sure it must be** is 50% by default, from 10% to 95%. It sits under **Use a Decision model**.
- The Log lists every answer under **What the Decision model answered**: who it picked for each quote and how sure it was, the next two it considered, and the chance for each line. Each says whether it was used.
- A Decision model gives numbers, not written thinking. The chances in the Log are everything it sends back.
- If it cannot be asked, the Log says why, and the Director does the whole job. The reasons it gives: no Decision connection, none set as the default, the one picked is gone, no key saved, the permission refused, or a Lumiverse too old to have Decision connections.

For example, with **How sure it must be** at 70%, the Log can read:

```
fast-judge answered. An answer is used at 70% sure or more.
"Leave the lamp," is Corin Vale, 84% sure. Used. Next: Ottoline 12%.
"Then who will carry it?" is Ottoline, 62% sure. Left to the Director. Next: Corin Vale 35%.
"Rain fell hard on the shutters." describes a sound: 91%. Its sounds are kept.
```

### Its questions

The two questions the Decision model is asked are in the Director tab, under **Use a Decision model**. You can change them. `{n}` is the number of the line asked about. **Back to built-in** puts a question back, and asks first.

## The prompt

The Director tab shows the whole prompt. You can change any of it.

- **Send it as** sends the prompt as the system message, the default, or as a user or assistant message. Some models follow a prompt better as a user message. The message itself is always sent as user.
- **Back to the built-in prompt** puts the built-in one back. It asks first, since there is no undo. When the prompt is already the built-in one, it says so and changes nothing.
- When an update changes the built-in prompt, notes, questions or patterns, and you have your own version of one, a notice on every tab says so. Your version is not changed. **Got it** hides the notice. On the built-in text, you get the new wording with no notice.
- When an update changes a default setting you were on, a notice says what changed and why. **Take it** moves you to the new default. **Keep mine** leaves your value.
- The message and the cast are always sent with it, as JSON. Your prompt should say what to do with them, and ask for the same JSON answer.
- The answer has to be JSON in this shape, or the message is read as written:

```json
{"lines":[{"i":0,"speaker":"Narrator","text":"...","style":"","before":"","after":"","big":false,"sung":false}],"new_speakers":[{"name":"","gender":"unknown","about":""}]}
```

The built-in prompt follows the same approach as Auto Refine's:

- **The user sets the tone.** A scene comes out at the strength it went in. The Director adds no drama and takes none away.
- **Reading the room.** Tags come from the page: the mood the narration sets, and each person's note in the cast.
- **Worn-out tags.** It names the habits that make tagged speech sound fake, such as `[sighs]` on every line or `[chuckles]` after every joke, so the Director avoids them.
- **A clean run.** A line that sounds right with no tags goes back with none.

## The one thing it does not direct

The built-in prompt tells the Director that the tone of the story is yours. Then it says who a sex scene is between. This is the paragraph, word for word:

> Sex scenes are between adults, 18 and older. If one involves anyone younger than that, or anyone written to seem younger, don't direct it. Send every line back plain, with no tags and no sounds. Characters of any age in scenes with nothing sexual in them get directed like anyone else.

What it does and does not do:

- It is text in the prompt. The extension's code does not read your story for this, and blocks nothing on its own.
- When the Director follows it, the message is read as written, with no tags and no sounds.
- A prompt of your own carries only what you put in it.
- **Intimate sounds** are for sex scenes between adults, and the prompt says so.

---

[Back to the README](../README.md)
