# Voice engines

## In short

- Auto Foley speaks through a TTS connection you made in Lumiverse. The key for it stays in Lumiverse.
- Auto Foley works only with models that act. Four engines have them: ElevenLabs, Fish Audio, Gemini and Chatterbox.
- Each engine reads acting directions its own way. Auto Foley tells the Director which engine it writes for.
- Before a line is sent, it is fitted to the engine that speaks it. A tag the engine cannot read is taken out, so it is never read aloud.
- A model that cannot act is not used. Auto Foley says which model to pick instead.

## What each engine can do

| Engine | Voice tags | Notes on how a line is said | Sounds inside a line | Singing |
| --- | --- | --- | --- | --- |
| ElevenLabs, Eleven v3 or v4 | Any short tag | No | Yes | Yes, with `[sings]` |
| Fish Audio S2, S2.1 or Drama 3 | Any short tag | No | No | Yes, with `[singing]` |
| Gemini 3.8 Flash TTS or Flash-Lite TTS | Only its own sound tags | Yes | No | Yes, with a note |
| Chatterbox-Turbo | Only its nine sound tags | No | No | No |

These are not used, since they cannot act: ElevenLabs models older than v3, Fish Audio S1, Gemini models older than 3.8, Chatterbox-Multilingual, Qwen3-TTS, and every other TTS provider. A line for someone on one of them is not spoken. The Stage tab, the Cast tab and **Check my setup** say which model to pick instead.

"No" under **Sounds inside a line** means the engine cannot make the sound of a door or rain itself. Its sounds are played as separate sound effects instead. See [Sounds](sounds.md).

A sung line on an engine that cannot sing is spoken.

## How it works

1. You pick the connection in the **Settings** tab, under **TTS connection**.
2. Auto Foley finds the engine from the connection's provider and model. The line under the box says what that engine can do.
3. When you press the boom microphone, the Director is told the engine and gets its rules: whether it may add tags, which tags the engine knows, and whether a line can carry a note on how it is said.
4. The Director also gets a short note on how that engine reads tags. You can read and change it in the **Director** tab, under **Notes for each voice engine**.
5. Each line is fitted to the engine of the person who says it, and sent to Lumiverse to be spoken.

## What it sends

Each line goes to Lumiverse's own TTS route, with:

- The line, with only the tags its engine can read.
- The person's voice and model on that connection.
- For ElevenLabs: stability, similarity, style and speed from the Cast tab.
- For Gemini 3.8: the line's note, as the speech style.
- For Fish Audio and Chatterbox: the speed, when it is not 1.

A line with no note uses the speech style saved on the connection in Lumiverse.

## An example

Juno Pike writes this reply:

> Juno dropped her bag by the door. "Home at last."

The Director writes `[exhales] [softly] Home at last.` for the quoted line, with the note `worn out but warm`. It adds the sound of a heavy bag on a wooden floor after the first line.

Here is what each engine is sent for the quoted line:

| Engine | The line sent | The note sent |
| --- | --- | --- |
| Eleven v3 | `[exhales] [softly] Home at last.` | None |
| Fish Audio S2 | `[exhales] [softly] Home at last.` | None |
| Gemini 3.8 | `<exhales> Home at last.` | `worn out but warm` |
| Chatterbox-Turbo | `Home at last.` | None |

On Gemini and Chatterbox, the Director is given the engine's tag list, so it picks from it. The table shows what is left when it does not. `[softly]` is not a Gemini tag, and `[exhales]` is not one of Chatterbox's nine.

On every engine but Eleven v3, the bag is played as a sound effect after the first line.

## Mixing engines

A person can speak through a connection of their own. Open them in the **Cast** tab and pick it under **Connection**. For example, the narrator can use a local Chatterbox server while the characters use ElevenLabs.

- Each connection keeps its own voice and model for that person.
- The Director writes for Auto Foley's own connection. A line spoken by someone on another engine is fitted to that engine before it is sent.

## Each engine

### ElevenLabs

- Voice tags work with **Eleven v3** and **Eleven v4**. On other models the tags are taken out.
- Eleven v3 has three stability settings: Creative, Natural and Robust.
- A big moment loosens the voice so it can swing further.

### Fish Audio

- Pick **S2.1 Pro**, **S2 Pro** or **Drama 3** on the connection for voice tags.
- Fish reads free tags in square brackets, such as `[whispering]`. A tag works best at the start of a sentence, and it lasts until the next tag.
- S1 does not act, so Auto Foley does not use it. Fish Audio is retiring it.

### Gemini

- Voice tags and notes work with **Gemini 3.8 Flash TTS** and **Gemini 3.8 Flash-Lite TTS**.
- Gemini knows only vocal sounds as tags, such as `<sigh>`, `<laugh>` and `<short pause>`. Auto Foley writes them in Gemini's angle brackets.
- How a line is said goes in its note, such as `hushed and nervous`.
- With no note, the line uses the speech style saved on the connection in Lumiverse. With none saved there, Lumiverse uses its own: relaxed conversation.

### Chatterbox

Chatterbox runs on your own computer, through a server such as Chatterbox-TTS-Server.

1. Start the server.
2. In Lumiverse, add a TTS connection with the **OpenAI TTS** provider.
3. Set its address to the server's address with `/v1` at the end, such as `http://localhost:8004/v1`.
4. Put "Chatterbox" in the connection's name, or pick **Chatterbox-Turbo** under **What this connection runs** in Auto Foley's Settings tab.
5. Run **Chatterbox-Turbo** on the server. The server picks which model runs, and Auto Foley cannot change it.

- Chatterbox-Turbo knows nine tags: `[clear throat]`, `[sigh]`, `[shush]`, `[cough]`, `[groan]`, `[sniff]`, `[gasp]`, `[chuckle]` and `[laugh]`. It reads English only.
- Chatterbox-Multilingual takes no tags, so Auto Foley does not use it. A connection with "multilingual" in its name is taken to run it.

## When something cannot be done

Auto Foley says so in the Settings tab, the Director tab, the Cast tab and **Check my setup**:

- When the model cannot act. Nothing is spoken through it, and the message says which model to pick.
- When sounds are made **In the voice** and the engine cannot make them. Its sounds become sound effects.

---

[Back to the README](../README.md)
