# Writing for each voice engine

## In short

- A person's card has three boxes to write in. Each one is read by something different.
- **Acting notes** is read only by the Director. Write how they act. The Director decides how each line is said from it.
- **Gemini style** is sent to Gemini 3.8 with every line of theirs. Write how they always sound.
- **Fish Audio direction** is sent to Fish Audio with every line of theirs. Write how they always sound.
- **Notes for each voice engine**, on the Director tab, tell the Director how an engine reads tags.
- The voice you pick does the most. Age, gender and accent come from the voice first.

## Which box is which

| Box | Where | Read by | What to write | Example |
| --- | --- | --- | --- | --- |
| **Acting notes** | Cast tab, on the person's card | The Director only. Never sent to the voice. | How they act, and how that changes | "Calm and patient. Gets quiet, not loud, when upset." |
| **Gemini style** | Cast tab, under **More settings**, on Gemini 3.8 | Gemini 3.8, with every line of theirs | How they always sound | "Warm and unhurried, with a light Southern accent." |
| **Fish Audio direction** | Cast tab, under **More settings**, on Fish Audio | Fish Audio, with every line of theirs | How they always sound | "a warm, steady young man, relaxed and unhurried" |
| **Notes for each voice engine** | Director tab | The Director, for the engine in use | A rule for every line on that engine | "Use at most two tags in a line." |

- **Gemini style** shows on Gemini 3.8 direct and through OpenRouter.
- **Fish Audio direction** shows only on a Fish Audio connection. Through OpenRouter, Lumiverse sends only the text, the voice and the speed, so it is not shown there.

The Director's own prompt can be changed too, in the Director tab. See [The prompt](director.md#the-prompt).

## Steps

1. Pick the person's voice first, in the Cast tab. Press **Hear a sample** to compare voices. Designed or cloned voices act better than stock ones.
2. Write **Acting notes** in plain words: how they act, and what changes when they feel something. For example: "gruff and short with people, sighs before bad news".
3. On Gemini 3.8 or Fish Audio, write how they always sound in **Gemini style** or **Fish Audio direction**, under **More settings**.
4. Play a message and listen.
5. If a feeling is missing, add it to **Acting notes** in the words the engine can use. [What helps on each engine](#what-helps-on-each-engine) says what each engine can use.
6. Only if the whole engine needs a rule, change its note under **Notes for each voice engine**.

## What it sends

- **Acting notes** is put in the Director's request, with the name of each person in the cast. It is never sent to the voice service. It holds up to 1000 characters.
- The Director writes tags into the line, and a note on how it is said where the engine takes one.
- **Gemini style** and the line's own note go to Gemini together: the style first, then "This line:" and the note.
- **Fish Audio direction** goes to Fish Audio with every line, beside the line's own tags.
- Before a line is sent, it is fitted to the engine. A tag the engine cannot read is taken out, so it is never read aloud. See [What it sends](engines.md#what-it-sends).

## An example

Pell Arden is a ferry pilot in a made-up story. Their **Acting notes** say: "gruff and short with people, sighs before bad news".

The Director writes this for one of Pell's lines, with the note `gruff and tired`:

`[gruffly] Tide turns at six. [sighs] Miss it, and we wait a whole day.`

Here is what each engine is sent:

| Engine | The line sent | The note sent |
| --- | --- | --- |
| Eleven v3 or v4 | `[gruffly] Tide turns at six. [sighs] Miss it, and we wait a whole day.` | None |
| Fish Audio S2 | `[gruffly] Tide turns at six. [gruffly] [sighs] Miss it, and we wait a whole day.` | None |
| Gemini 3.8 | `Tide turns at six. <sigh> Miss it, and we wait a whole day.` | `gruff and tired` |
| Chatterbox-Turbo | `Tide turns at six. [sigh] Miss it, and we wait a whole day.` | None |
| OmniVoice | `Tide turns at six. [sigh] Miss it, and we wait a whole day.` | None |
| Cartesia | `Tide turns at six. Miss it, and we wait a whole day.` | None |

- On Fish Audio, `[gruffly]` goes again at the start of the second sentence, so both are said the same way. `[sighs]` is a sound, so it is not repeated.
- On Gemini 3.8, how the line is said goes in the note, and only the sigh stays in the line. If Pell's **Gemini style** were "low and gravelly", the note sent would be `low and gravelly. This line: gruff and tired`.
- On Chatterbox-Turbo and OmniVoice, `[sighs]` becomes their own `[sigh]`, and `[gruffly]` is taken out, since they cannot read it. The voice you picked has to carry the gruffness.
- On Cartesia, neither tag is a feeling on its list, so both are taken out. Given Cartesia's list, the Director writes a feeling instead, such as `[tired]` at the start of the line, and it is sent beside the line.

## Splitting up a voice description

A description written for a voice service often holds several kinds of thing at once. Each part goes in a different place. Here is a made-up one:

> A woman in her forties with a husky voice and a soft Irish lilt. Kind, slow and patient, but sharp when someone is rude. Studio quality audio.

| Part | Where it goes |
| --- | --- |
| "A woman in her forties with a husky voice" | The voice you pick. Pick a husky, mature voice and listen with **Hear a sample**. |
| "a soft Irish lilt", "kind, slow and patient" | **Gemini style** or **Fish Audio direction**, since it is how she always sounds: "Kind, slow and patient, with a soft Irish lilt." |
| "sharp when someone is rude" | **Acting notes**, since it changes from line to line: "Kind and patient. Gets sharp and short when someone is rude." |
| "Studio quality audio" | Nowhere. It is not about how she speaks. |

Writing the whole description in both **Acting notes** and **Gemini style** does no harm, but most of it is wasted. The Director cannot change the voice, and the voice service does not need the moments that change.

## Examples for each engine

Every example below is for a made-up person. Copy the shape, and write your own words.

### ElevenLabs v3 and v4

Quill is a nervous young courier.

- **Acting notes:** `Talks fast when nervous. Laughs under her breath at her own jokes. Whispers when she thinks someone is listening. Sighs before bad news.`
- There is no box sent to ElevenLabs. Her accent and age come from the voice you pick, or a voice you design or clone on ElevenLabs.

### Fish Audio S2 and Drama 3

Bram is a patient old blacksmith.

- **Acting notes:** `Calm and slow. Gets sharp and loud when someone is careless at the forge. Laughs warmly at children.`
- **Fish Audio direction:** `a deep, gravelly old man, calm and unhurried`

### Gemini 3.8

Tobiah is a soft-spoken young bookbinder.

- **Acting notes:** `Steady and unhurried, even when things are tense. Gets quieter, not louder, when upset. Teases his friends in a dry way.`
- **Gemini style:** `Warm, relaxed and unhurried, in a smooth low voice, with a light Southern accent.`
- A line where the Director writes `quiet and hurt` is sent with: `Warm, relaxed and unhurried, in a smooth low voice, with a light Southern accent. This line: quiet and hurt`

### Chatterbox-Turbo

Mags runs a noisy market stall.

- **Acting notes:** `Laughs loudly and often. Sighs when a customer haggles. Clears her throat before she names a price.`
- Chatterbox-Turbo only makes sounds such as a laugh or a sigh. Her voice and manner come from the voice file you pick.

### OmniVoice

Ilo is a curious apprentice.

- **Acting notes:** `Answers with a questioning hum when unsure. Laughs when nervous. Sighs when told to wait.`
- OmniVoice only makes small sounds such as these. The rest comes from the voice and the punctuation.

### Cartesia Sonic 3

Dace is a guard who hates his job.

- **Acting notes:** `Usually bored and flat. Sarcastic with his captain. Scared when he hears noises in the dark.`
- The Director picks one feeling from Cartesia's list for each line, such as `[sarcastic]` or `[scared]`, so name feelings like these.

## What helps on each engine

### ElevenLabs v3 and v4

- It reads any short tag in square brackets, for a feeling, a way of speaking or a sound: `[whispers]`, `[excited]`, `[laughs]`.
- It can make a sound inside a line, such as a door creaking. No other engine can. On every other engine, sounds are played as sound effects.
- In **Acting notes**, name feelings and habits the Director can turn into tags: "laughs at their own jokes", "whispers when nervous".
- **Stability** in the Cast tab changes how far the voice swings. Lower is more expressive. See [The cast](cast.md#a-card).

### Fish Audio S2 and Drama 3

- It reads free tags in square brackets, and a tag can be a few plain words, such as `[warm and happy]`.
- Fish Audio's guide says a tag for how the words are said works best at the start of the sentence it is for, with one main feeling for each sentence. Auto Foley repeats that tag for each sentence. See [Fish Audio](engines.md#fish-audio).
- **Fish Audio direction** is a few plain words sent with every line of theirs, such as "warm and tired". Keep it to how they always sound. Leave single moments to the Director's tags.
- Sounds are played as sound effects, not in the voice.

### Gemini 3.8

- How a line is said goes in its note, such as `hushed and nervous`. Tags are only for vocal sounds and pauses, such as `<sigh>` and `<short pause>`.
- **Gemini style** is sent with every line of theirs, before the line's own note, such as "calm and dry". Write it like a note to an actor, in a few plain words.
- In **Acting notes**, describe the delivery in words the Director can put in notes: "flat and quiet, speeds up when angry".

### Chatterbox-Turbo

- It knows nine sound tags, such as `[sigh]`, `[laugh]` and `[gasp]`, and reads English only.
- How strong the feeling is comes from **Exaggeration**, in a person's **More settings**, when Auto Foley talks to the server itself. See [Chatterbox](engines.md#chatterbox).
- In **Acting notes**, mention the sounds they make: "laughs a lot, clears their throat before speaking".

### OmniVoice

- It knows a few small sounds, such as `[laughter]`, `[sigh]` and a questioning hum. See [OmniVoice, through OpenVox](engines.md#omnivoice-through-openvox).
- It takes no delivery tags, so how they speak comes from the voice and the punctuation.
- In **Acting notes**, mention when they laugh, sigh or answer with a questioning sound.

### Cartesia Sonic 3

- It takes one feeling for each line, from a list of 58, and `[laughter]` in the text. See [Cartesia](engines.md#cartesia).
- In **Acting notes**, describe their usual feeling in a word or two, such as "calm" or "anxious and quick". The Director picks a feeling from the list that fits each line.
- Six feelings work the best: neutral, calm, angry, content, sad and scared.

## Notes for each voice engine

Each engine has a short note the Director reads, on how that engine reads tags. Change it only when the Director keeps doing something the engine handles badly.

- Write a rule the Director can follow, such as "Use at most two tags in a line."
- Keep it short. It is sent with every script.
- **Back to built-in** puts the built-in note back.

See [Notes for each voice engine](director.md#notes-for-each-voice-engine).

---

[Back to the README](../README.md)
