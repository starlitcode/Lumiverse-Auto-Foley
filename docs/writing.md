# Writing for each voice engine

## In short

- You can write in four places. Two are read by the Director, and two are sent to the voice service.
- **How they speak**, in the Cast tab, tells the Director how one person talks.
- **Notes for each voice engine**, in the Director tab, tell the Director how an engine reads tags.
- **Voice direction**, for Fish Audio, and **Their usual way of speaking**, for Gemini 3.8, go to the voice service with each line.
- Each engine takes different things, so what helps on one does nothing on another. This page says what to write for each.

## Where you can write

| Where | Who reads it | When |
| --- | --- | --- |
| **How they speak**, Cast tab | The Director | Each time it writes a script |
| **Notes for each voice engine**, Director tab | The Director | Each time it writes a script, for the engine in use |
| **Voice direction**, in a person's **More settings** | Fish Audio | With every line that person says |
| **Their usual way of speaking**, in a person's **More settings** | Gemini 3.8 | With every line of theirs that has no note of its own |

The Director's own prompt can be changed too, in the Director tab. See [The prompt](director.md#the-prompt).

## Steps

1. Pick the person's voice first, in the Cast tab. The voice does most of the work. Designed or cloned voices act better than stock ones.
2. Write **How they speak** in plain words: how they sound, and what they do when they talk. For example: "gruff and short with people, sighs before bad news".
3. Play a message and listen.
4. If a feeling is missing, add it to **How they speak** in the words the engine can use. The sections below say what each engine can use.
5. Only if the whole engine needs a rule, change its note under **Notes for each voice engine**.

## What it sends

- **How they speak** is put in the Director's request, with the name of each person in the cast. It is never sent to the voice service. It holds up to 1000 characters.
- The Director writes tags into the line, and a note on how it is said where the engine takes one.
- Before a line is sent, it is fitted to the engine. A tag the engine cannot read is taken out, so it is never read aloud. See [What it sends](engines.md#what-it-sends).

## An example

Pell Arden is a ferry pilot in a made-up story. Their **How they speak** says: "gruff and short with people, sighs before bad news".

The Director writes this for one of Pell's lines, with the note `gruff and tired`:

`[gruffly] Tide turns at six. [sighs] Miss it, and we wait a whole day.`

Here is what each engine is sent:

| Engine | The line sent | The note sent |
| --- | --- | --- |
| Eleven v3 or v4 | `[gruffly] Tide turns at six. [sighs] Miss it, and we wait a whole day.` | None |
| Fish Audio S2 | `[gruffly] Tide turns at six. [gruffly] [sighs] Miss it, and we wait a whole day.` | None |
| Gemini 3.8 | `Tide turns at six. <sigh> Miss it, and we wait a whole day.` | `gruff and tired` |
| Gemini 2.5 or 3.1 | `Tide turns at six. [sigh] Miss it, and we wait a whole day.` | None |
| Chatterbox-Turbo | `Tide turns at six. [sigh] Miss it, and we wait a whole day.` | None |

- On Fish Audio, `[gruffly]` goes again at the start of the second sentence, so both are said the same way. `[sighs]` is a sound, so it is not repeated.
- On Gemini 3.8, how the line is said goes in the note, and only the sigh stays in the line.
- On Gemini 2.5 and 3.1 and on Chatterbox-Turbo, `[sighs]` becomes the engine's own `[sigh]`, and `[gruffly]` is taken out, since they cannot read it. The voice you picked has to carry the gruffness.

## What helps on each engine

### ElevenLabs v3 and v4

- It reads any short tag in square brackets, for a feeling, a way of speaking or a sound: `[whispers]`, `[excited]`, `[laughs]`.
- It can make a sound inside a line, such as a door creaking. No other engine can. On every other engine, sounds are played as sound effects.
- In **How they speak**, name feelings and habits the Director can turn into tags: "laughs at their own jokes", "whispers when nervous".
- **Stability** in the Cast tab changes how far the voice swings. Lower is more expressive. See [The cast](cast.md#a-card).

### Fish Audio S2 and Drama 3

- It reads free tags in square brackets, and a tag can be a few plain words, such as `[warm and happy]`.
- Fish Audio's guide says a tag for how the words are said works best at the start of the sentence it is for, with one main feeling for each sentence. Auto Foley repeats that tag for each sentence. See [Fish Audio](engines.md#fish-audio).
- **Voice direction** is a few plain words sent with every line of theirs, such as "warm and tired". Keep it to how they always sound. Leave single moments to the Director's tags.
- Sounds are played as sound effects, not in the voice.

### Gemini 3.8

- How a line is said goes in its note, such as `hushed and nervous`. Tags are only for vocal sounds and pauses, such as `<sigh>` and `<short pause>`.
- **Their usual way of speaking** is the note for every line of theirs that has none, such as "calm and dry". Write it like a note to an actor, in a few plain words.
- In **How they speak**, describe the delivery in words the Director can put in notes: "flat and quiet, speeds up when angry".

### Gemini 2.5 and 3.1

- These models know eleven tags and take no notes. See [Gemini](engines.md#gemini) for the list.
- A feeling outside those tags cannot be asked for. Pick a voice that already has it.
- In **How they speak**, mention only what the tags can do, such as whispering, shouting or laughing.

### Chatterbox-Turbo

- It knows nine sound tags, such as `[sigh]`, `[laugh]` and `[gasp]`, and reads English only.
- How strong the feeling is comes from **Exaggeration**, in a person's **More settings**, when Auto Foley talks to the server itself. See [Chatterbox](engines.md#chatterbox).
- In **How they speak**, mention the sounds they make: "laughs a lot, clears their throat before speaking".

## Notes for each voice engine

Each engine has a short note the Director reads, on how that engine reads tags. Change it only when the Director keeps doing something the engine handles badly.

- Write a rule the Director can follow, such as "Use at most two tags in a line."
- Keep it short. It is sent with every script.
- **Back to built-in** puts the built-in note back.

See [Notes for each voice engine](director.md#notes-for-each-voice-engine).

---

[Back to the README](../README.md)
