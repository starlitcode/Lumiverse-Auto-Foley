# The Director

## In short

- The Director is a second model. It reads each message before it is spoken.
- It adds ElevenLabs voice tags, such as `[whispers]` or `[flatly]`, where the delivery changes.
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
   - Tags that describe something seen, such as `[smiles]`, are taken out. ElevenLabs cannot voice them.
   - A line keeps no more tags than **How much acting** allows: 1, 2 or 4.
5. A line that fails the word check is read as written. The Stage tab shows a note under it.

## What it sends

Two messages, to the connection picked under **Which connection**:

- **The prompt**, as the system message.
- **The message as JSON**, as the user message. It holds:
  - `cast`: each person's name, other names, and the **How they speak** note
  - `author`: who wrote the message
  - `lines`: the numbered lines, with a speaker filled in where the Decision model was sure
  - `rules`: your switches, such as the tag limit, the sound style, and whether intimate sounds are allowed

Nothing else from your chat is sent. The Director does not see earlier messages.

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

| # | Speaker | What ElevenLabs is sent |
| --- | --- | --- |
| 0 | Narrator | Pell slid the key across the counter. |
| 1 | Pell | Room six. [flatly] The lock sticks. |
| 2 | Narrator | [sound of a heavy door slamming upstairs] Somewhere upstairs, a door slammed. |
| 3 | Odessa | Is it ALWAYS this loud? |
| 4 | Narrator | Odessa asked. |

If the Director had sent line 3 as "Is it always this noisy?", the word check fails. Line 3 is then read as written, "Is it always this loud?", and the Stage tab says why.

## The switches

All on the Director tab:

- **Use the Director.** Off: messages are read as written.
- **Which connection.** Empty uses the connection you chat with.
- **How much acting.** Subtle, Natural or Dramatic. At most 1, 2 or 4 tags in a line.
- **Voice tags.** Delivery and emotion.
- **Breaths, sighs and laughs.** Sounds a voice makes. Off takes them out of every line.
- **Sounds**, and under it **How sounds are made** and **Intimate sounds**. See [Sounds](sounds.md).
- **Find new speakers.** Someone new who speaks is added to the cast. See [The cast](cast.md).
- **Big moments.** The Director can mark an emotional peak. That line gets a looser voice: one step toward Creative on Eleven v3, or 0.25 lower stability on Eleven v4.

## The Decision model

A Decision model answers questions with a choice or a chance. It writes no text. Lumiverse keeps its address and key, under **Decision models** in the **Connections** panel.

With **Use a Decision model** on:

- It picks who says each quoted line, from up to 12 people in the cast. A pick it is less than 50% sure of is left to the Director.
- With sounds on, it gives the chance that each narration line describes a sound. The Director is told these chances.
- If it cannot be asked, the Log says why, and the Director does the whole job. The reasons it gives: no Decision connection, none set as the default, the one picked is gone, no key saved, the permission refused, or a Lumiverse too old to have Decision connections.

## The prompt

The Director tab shows the whole prompt. You can change any of it.

- **Back to the built-in prompt** puts the built-in one back.
- The message and the cast are always sent with it, as JSON. Your prompt should say what to do with them, and ask for the same JSON answer.
- The answer has to be JSON in this shape, or the message is read as written:

```json
{"lines":[{"i":0,"speaker":"Narrator","text":"...","before":"","after":"","big":false}],"new_speakers":[{"name":"","gender":"unknown","about":""}]}
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
