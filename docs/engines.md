# Voice engines

## In short

- Auto Foley speaks through a TTS connection you made in Lumiverse. The key for it stays in Lumiverse.
- Auto Foley works only with models that act. Six engines have them: ElevenLabs, Fish Audio, Gemini, Chatterbox, OmniVoice and Cartesia.
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
| OmniVoice, through OpenVox | Only its own sound tags | No | No | No |
| Cartesia Sonic 3 or later | Only `[laughter]`, and one feeling for the whole line | No | No | No |

These are not used: ElevenLabs models older than v3, Fish Audio S1, Gemini models older than 3.8, OpenRouter models other than those under [Through OpenRouter](#through-openrouter), OpenVox models other than OmniVoice and Chatterbox Turbo, Cartesia models older than Sonic 3, Chatterbox-Multilingual, Qwen3-TTS, and every other TTS provider. A line for someone on one of them is not spoken. The Stage tab, the Cast tab and **Check my setup** say which model to pick instead.

"No" under **Sounds inside a line** means the engine cannot make the sound of a door or rain itself. Its sounds are played as separate sound effects instead. See [Sounds](sounds.md).

A sung line on an engine that cannot sing is spoken.

## How it works

1. You pick the connection in the **Settings** tab, under **TTS connection**.
2. Auto Foley finds the engine from the connection's provider and model. The line under the box says what that engine can do.
3. When you press the Auto Foley button, the Director is told the engine and gets its rules: whether it may add tags, which tags the engine knows, and whether a line can carry a note on how it is said.
4. The Director also gets a short note on how that engine reads tags. You can read and change it in the **Director** tab, under **Notes for each voice engine**.
5. Each line is fitted to the engine of the person who says it, and sent to Lumiverse to be spoken.

## What it sends

Auto Foley replaces Lumiverse's own TTS. It speaks through your TTS connections, with settings of its own. A voice can sound different than with Lumiverse's own TTS. See [Sound quality, and where it replaces Lumiverse's TTS](#sound-quality-and-where-it-replaces-lumiverses-tts).

Each line goes to Lumiverse's own TTS route, with:

- The line, with only the tags its engine can read.
- The person's voice and model on that connection.
- For ElevenLabs: stability from the Cast tab, and on Eleven v4 similarity too.
- For Gemini 3.8: the line's note, as the speech style.
- For Fish Audio, Chatterbox, OmniVoice and Cartesia: the speed, when it is not 1.
- For Fish Audio: latency `normal`, as WAV. See [Fish Audio](#fish-audio).
- For Cartesia: WAV.
- For Gemini 3.8, on a line with no note: an empty style. See [Gemini](#gemini).

## Sound quality, and where it replaces Lumiverse's TTS

### In short

- Auto Foley replaces Lumiverse's TTS where the two overlap. It uses your TTS connections in Lumiverse, with its own player and its own settings.
- It asks each voice service for its best quality, as the service's own docs describe it, and not a choice Lumiverse made on its own.
- Auto Foley does not use the voice settings saved on a TTS connection in Lumiverse. It sends each person's own settings from the Cast tab, or the voice service's own defaults.
- Most engines send WAV, which is not compressed, so the audio is exactly as the voice made it. ElevenLabs' best formats need a paid plan, so it sends MP3 at ElevenLabs' own default.
- A few limits are in Lumiverse itself. Auto Foley cannot change them. They are listed below.
- A proxy may drop some settings. See [Proxies](#proxies).

### Settings saved on the connection

Lumiverse adds what is saved on the connection to each line, unless the line sends its own value. So Auto Foley sends every setting with each line:

- A setting the person has under **More settings**, in the Cast tab, is sent as they set it.
- Any other setting is sent as the voice service's own default. Where Lumiverse leaves an empty setting out, Auto Foley sends it empty, and the service uses its own default.

From the connection, Auto Foley takes only its address and key, which Lumiverse keeps, and its model and voice when a person has none picked.

What Auto Foley sends in place of the connection's settings:

| Engine | What Auto Foley sends |
| --- | --- |
| Gemini 3.8 | The line's style, or an empty one. Lumiverse would otherwise add its own "casual, relaxed conversation" style. |
| Gemini | The person's language and temperature, or empty ones, so each line's language is found. |
| Fish Audio | The person's own settings, or empty ones. Latency `normal`, as WAV at 44.1 kHz. |
| ElevenLabs | Stability from the Cast tab, and on Eleven v4 similarity too. Style 0, as ElevenLabs advises. The person's language, or an empty one. The rest at ElevenLabs' own defaults. |
| Cartesia | The line's feeling, or an empty one. The person's speed, volume and language, or the defaults. WAV. |
| Chatterbox server, OmniVoice | The person's speed, or 1. A Chatterbox server is asked for WAV. |
| Through OpenRouter | The voice and the text, with speed 1. |

### The format each engine sends

Auto Foley asks for audio as the voice made it, with no compression, wherever the service allows it on every plan:

| Engine | What you get |
| --- | --- |
| Gemini 3.8 | WAV, 24 kHz. Google makes only this. |
| Fish Audio | WAV, 44.1 kHz |
| Cartesia | WAV, at the 22.05 kHz Lumiverse asks for |
| Chatterbox, OmniVoice | WAV, 24 kHz |
| ElevenLabs | MP3, 44.1 kHz, 128 kbps, ElevenLabs' own default. Its uncompressed formats at full quality need a paid plan, so Auto Foley does not ask for them. |
| Through OpenRouter | Gemini as WAV. ElevenLabs and Fish Audio as MP3. |

WAV files are larger. A line of up to 16 MB is kept, about 3 minutes of Fish Audio's WAV. Lumiverse takes a message of up to 4 MB from the panel, so a longer line is sent to the backend in parts and put back together there.

### Audio you already kept

The latency, the format and the empty values are left out when Auto Foley checks whether a line was kept before. So a line kept before Auto Foley sent them still plays from what was kept, and is not paid for again.

### What only Lumiverse can change

Lumiverse makes the call to each voice service, and some of what it sends cannot be changed by an extension:

- **Cartesia** audio is made at 22.05 kHz. Cartesia's own default is 44.1 kHz.
- **ElevenLabs** takes a seed and a text normalization setting, but Lumiverse has no setting for either, so they are never sent.
- **Through OpenRouter**, only the text, the voice, the speed and Gemini's style reach the model. Stability, Fish Audio's own settings and the like cannot be sent.
- **OpenVox** is always sent English as the language.

Each of these needs a change in Lumiverse. When Lumiverse makes it, Auto Foley gets the better sound with no update of its own.

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
| OmniVoice | `Home at last.` | None |
| Cartesia | `Home at last.` | None |

On Gemini, Chatterbox, OmniVoice and Cartesia, the Director is given the engine's tag list, so it picks from it. The table shows what is left when it does not. `[softly]` is not a Gemini tag. `[exhales]` is not one of Chatterbox's nine, and neither is an OmniVoice sound or a Cartesia feeling.

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
- Style is sent as 0, as ElevenLabs advises, so a style saved on the connection does not make the voice more extreme on top of its tags.
- ElevenLabs' guide says Eleven v3 does not use similarity, speed or speaker boost, and Eleven v4 does not use style or speed. Lumiverse sends them all, so Auto Foley sends ElevenLabs' defaults for the ones a model does not use.

### Fish Audio

- Pick **S2.1 Pro**, **S2 Pro** or **Drama 3** on the connection for voice tags.
- Fish reads free tags in square brackets, such as `[whispering]`.
- Fish Audio's guide says a tag for how the words are said works best at the start of the sentence it is for, with one main feeling for each sentence.
- So on a line of several sentences, Auto Foley puts that tag again at the start of each sentence that has none of its own. `[hushed] The lantern is out. Stay close.` is sent as `[hushed] The lantern is out. [hushed] Stay close.`
- A sentence with its own tag starts a new way of speaking for the sentences after it.
- Sounds and pauses, such as `[sighs]` or `[short pause]`, happen once and are never repeated.
- S1 does not act, so Auto Foley does not use it. Fish Audio is retiring it.
- Fish Audio's docs say latency `normal` gives the best quality, and `balanced` is used when none is sent. Lumiverse shows `normal` as the default, but sends a latency only when one is saved on the connection. So Auto Foley always asks for `normal`.
- Auto Foley also asks for WAV, which Fish's docs call its highest quality. WAV is not compressed, so the audio is exactly as Fish made it.
- A **Fish Audio direction** saved on the connection in Lumiverse is not used. Each person's own direction, in the Cast tab, is used instead.
- Every Fish Audio setting Lumiverse shows is under **More settings** on each person, in the Cast tab. One left as it is uses Fish Audio's own default, the same number the box shows. See [The Cast tab](cast.md#fish-audio-settings).

#### Drama 3

- Fish Audio's docs name the model `drama-3`. A name Fish does not know, such as `drama-3-preview`, is read with S2.1 Pro, and Fish gives no error.
- Lumiverse lists Drama 3 as `drama-3-preview`. So when **Drama 3** is picked, Auto Foley asks Fish for `drama-3`.
- Lumiverse adds **Fish Audio direction** only for the model names on its own list. For Drama 3, Auto Foley puts the direction at the start of each line instead, as a tag, the same way Lumiverse does for the others.

### Gemini

Gemini 3.8:

- Voice tags and notes work with **Gemini 3.8 Flash TTS** and **Gemini 3.8 Flash-Lite TTS**.
- Gemini 3.8 knows only vocal sounds and pauses as tags, such as `<sigh>`, `<laugh>`, `<growl>` and `<short pause>`. Auto Foley writes them in Gemini's angle brackets. A tag in square brackets is not acted on, so it is never sent that way.
- Gemini 3.8 reads its text word for word. A few words in `|pipes|` are said by a second voice in the background, and a word in `/slashes/` is read as a phonetic spelling. Auto Foley takes pipes, angle brackets and slash pairs out of the message first, so only its own tags are read that way.
- How a line is said goes in its note, such as `hushed and nervous`.
- With no note and no **Gemini style**, Auto Foley sends an empty style. Otherwise Lumiverse adds the style saved on the connection, or its own, "casual, relaxed conversation, natural pacing, understated expression", which would hold back a loud or tense line. Google's guide says most lines need no style at all.
- Now and then Gemini answers with no audio. Auto Foley asks again after a moment.

Gemini 2.5 and 3.1:

- Google shuts down the Gemini 2.5 and 3.1 TTS models on December 18, 2026, so Auto Foley does not use them. Pick Gemini 3.8 Flash TTS instead.

### Through OpenRouter

An **OpenRouter TTS** connection in Lumiverse can run ElevenLabs, Fish Audio and Gemini models. Auto Foley reads their tags the same as on a direct connection.

| Model on OpenRouter | Engine |
| --- | --- |
| `elevenlabs/eleven-v4`, `elevenlabs/eleven-v4-turbo`, `elevenlabs/eleven-v3`, `elevenlabs/eleven-v3-conversational` | ElevenLabs v3 or v4 |
| `fish-audio/s2.1-pro`, `fish-audio/s2.1-pro-free` and Drama 3 | Fish Audio |
| `google/gemini-3.8-flash-tts`, `google/gemini-3.8-flash-lite-tts` | Gemini 3.8 |

- OpenRouter's other voice models do not act, so Auto Foley does not use them.
- Lumiverse sends OpenRouter only the text, the voice and the speed. So through OpenRouter, Stability, Similarity, Speed, Language and Fish Audio's own settings are not shown, since they cannot be sent. Big moments only let the audience cheer.
- A person's **More settings** has their usual way of speaking, for Gemini 3.8, and **Fish Audio direction**, for Fish Audio. OpenRouter does not pass the direction on, so Auto Foley writes it at the start of each of their lines, as a tag.
- Each model has its own voices on OpenRouter. ElevenLabs has 21, such as `george`, `sarah` and `river`. Gemini has its 30. Auto Foley picks from the model's own list.
- Fish Audio on OpenRouter has no list of voices. Type a Fish Audio voice ID under **Or type a voice name or ID**, in the Cast tab. With none, the voice saved on the connection in Lumiverse is used.

### Chatterbox

Chatterbox runs on your own computer, through a server such as Chatterbox-TTS-Server.

1. Start the server.
2. In Lumiverse, add a TTS connection with the **OpenAI TTS** provider.
3. Set its address to the server's address with `/v1` at the end, such as `http://localhost:8004/v1`.
4. Put "Chatterbox" in the connection's name, or pick **Chatterbox-Turbo** under **What this connection runs** in Auto Foley's Settings tab.
5. Run **Chatterbox-Turbo** on the server. The server picks which model runs, and Auto Foley cannot change it.

- Chatterbox-Turbo knows nine tags: `[clear throat]`, `[sigh]`, `[shush]`, `[cough]`, `[groan]`, `[sniff]`, `[gasp]`, `[chuckle]` and `[laugh]`. It reads English only.
- Chatterbox-Multilingual takes no tags, so Auto Foley does not use it. A connection with "multilingual" in its name is taken to run it.
- OpenVox can run Chatterbox Turbo too. See [OmniVoice, through OpenVox](#omnivoice-through-openvox).
- The server makes WAV by default. Lumiverse asks an OpenAI TTS connection for MP3, which the server then makes from the WAV. So Auto Foley asks for WAV, on an OpenAI TTS connection and on **Chatterbox server (direct)**.

### OmniVoice, through OpenVox

OpenVox is an app for Mac and Windows that runs voice models on your own computer, with a local address such as `http://127.0.0.1:8000/v1`. In Lumiverse, add a TTS connection with the **OpenVox TTS** provider.

Of the models OpenVox runs, two act:

| Model in OpenVox | Engine |
| --- | --- |
| OmniVoice | OmniVoice |
| Chatterbox Turbo, such as `chatterbox-turbo-small` | Chatterbox-Turbo |

- Auto Foley finds the model by its name: "omnivoice" in it means OmniVoice, and "chatterbox-turbo" means Chatterbox-Turbo.
- OpenVox's other models, such as Kokoro, Supertonic, Pocket TTS, Qwen3 TTS and Chatterbox Multilingual, take no tags, so Auto Foley does not use them.
- OmniVoice knows these sounds, in square brackets: `[laughter]`, `[sigh]`, `[confirmation-en]` (an agreeing hum), `[question-en]`, `[question-ah]` and `[question-oh]` (questioning sounds), `[surprise-ah]` and `[surprise-oh]` (surprised sounds), and `[dissatisfaction-hnn]` (an unhappy grunt). Its four Chinese sounds are left out.
- A tag close to one of these is changed to it: `[laughs]` becomes `[laughter]`, `[hmm]` becomes `[question-en]`, `[gasps]` becomes `[surprise-ah]` and `[tsk]` becomes `[dissatisfaction-hnn]`.
- Lumiverse sends OpenVox the text, the voice, the speed and the language, English. Chatterbox's Exaggeration and CFG weight cannot be sent this way.
- OpenVox runs one model at a time, so a message can take longer when its model has to load first.

### Cartesia

Cartesia is a voice service with its own key. In Lumiverse, add a TTS connection with the **Cartesia** provider, and pick a Sonic 3 model, such as `sonic-3.6`.

- Cartesia reads one tag in the text, `[laughter]`.
- It takes one feeling for a whole line, from a list of 58, such as `calm`, `anxious` or `sarcastic`. The Director writes it as a tag at the start of a line. Auto Foley takes it out of the text and sends it beside the line.
- A tag that means one of the feelings is fitted to it: `[nervously]` becomes `anxious`, and `[terrified]` becomes `panicked`.
- Cartesia's docs say six feelings work the best: `neutral`, `calm`, `angry`, `content`, `sad` and `scared`. Feelings work best with the voices Cartesia marks **Emotive**, and in English. They are in beta at Cartesia.
- Cartesia's docs say a feeling works only when it fits the words. The Director is told to pick only a feeling the line already carries.
- Speed goes from 0.6 to 1.5.
- Volume and language are under **More settings** on each person, in the Cast tab.
- A feeling saved on the connection in Lumiverse is not used. A line with no feeling of its own is sent with none.
- Models older than Sonic 3 take no tags, so Auto Foley does not use them.

An example: the Director writes `[wearily] [exhales] Home at last. [laughs]`. Cartesia is sent `Home at last. [laughter]`, with the feeling `tired`.

## What the voice costs

Lumiverse sends back only the audio, with no price. Auto Foley counts what it sends instead.

- **Voice price, per million characters** is in the Settings tab, under **TTS connection**. Type your voice service's price.
- Now playing says how many characters were sent for new audio in the message, such as "Voice: 1,240 characters, about 0.037."
- Lines played from saved audio send nothing, so they add nothing.
- The count includes the tags in each line, since a voice service counts them too.
- At 0, which is the default, the characters are counted with no cost.
- ElevenLabs and Fish Audio charge by the text, so the cost is close. Gemini charges for the audio it sends back, so for Gemini it is only a rough guide.

## Proxies

Auto Foley never calls a voice service itself. Lumiverse makes the call, to the address saved on the connection. So a proxy set up in Lumiverse works with Auto Foley.

A proxy may drop or change some settings on the way, such as stability, the style or the latency. A voice can then sound different than on a direct connection. When a connection for ElevenLabs, Fish Audio, Gemini, OpenRouter or Cartesia has an address on another host, the Settings tab says so, under the engine. If a voice sounds wrong, play the same line through a direct connection to compare, before reporting a problem.

- **TTS connections.** An ElevenLabs, Fish Audio, Gemini or OpenRouter connection can point at a proxy address in Lumiverse. Auto Foley reads only the connection's provider and model to find the engine, never its address.
- **The Director and the Decision model.** They are asked through your Lumiverse connections, so a proxy on those works too.
- **OpenAI TTS connections.** Auto Foley takes one to be Chatterbox only when "Chatterbox" is in its name, or when you pick **Chatterbox-Turbo** under **What this connection runs**. A proxy address does not change that.

Two things do not go through a Lumiverse connection:

- **Chatterbox server (direct)** talks to the server address you type in Settings. That address can be a proxy in front of the server, as long as it passes on the server's own routes.
- **Sound effects from Freesound or ElevenLabs** go only to `freesound.org` and `api.elevenlabs.io`, with your own key. These addresses are fixed, so a key is only ever sent to its own service. They cannot go through a proxy. See [Sounds](sounds.md).

## When something cannot be done

Auto Foley says so in the Settings tab, the Director tab, the Cast tab and **Check my setup**:

- When the model cannot act. Nothing is spoken through it, and the message says which model to pick.
- When sounds are made **In the voice** and the engine cannot make them. Its sounds become sound effects.
- When your account has no TTS connection Auto Foley can use. The message says whether Lumiverse found no TTS connection at all, or names the ones it found and their service.

### When a service says a limit was reached

A voice service can limit how many lines your account asks for in a minute or in a day. Google calls this a quota, and answers with error 429. It is not about the money in your account.

- Google's answer names the limit, such as "per day, limit: 100". Auto Foley reads it.
- A limit per day cannot be waited out. Auto Foley says so at once, with the limit, and that Gemini's resets at midnight Pacific time.
- A limit per minute, or one that is not named, is waited out. Auto Foley waits for the time the service names, up to about a minute, then asks again. Every other line waits too.
- **Wait out a provider that will not take the call**, on the Settings tab, says how many times it waits. It is 2 by default.
- If a limit that is not named is still there after that, the Log says the limit may be for the day.
- On Google's lowest paid level, a Gemini voice model can allow as few as 10 lines a minute and 100 a day. Google AI Studio shows yours on its **Rate limit** page. Each line Auto Foley speaks is one request.
- An answer that names credits, a balance or a payment is read as an account that is out of credits. Auto Foley says so at once and does not wait.

### When a line comes back with too little voice

A voice service can now and then send back a line with little or no voice in it, so the line is skipped or cut short. Auto Foley checks each new line:

- A line of 6 words or more needs at least one second of voice for every 10 words. Nobody speaks faster than that, even at double speed.
- A line with less is made again once, and the Log says so.
- If it comes back short again, it plays as it came, and the Log says so. It is not kept, so the next play asks for it again.

### When your connection does not show

1. Open **Connections** in Lumiverse, then the **TTS** tab. A key added under the **LLM** tab is not a TTS connection.
2. Check that the connection's provider is ElevenLabs, Fish Audio, Google Gemini, Google Vertex, OpenRouter or OpenAI TTS.
3. Open Auto Foley's **Settings** tab again. It reads the list each time the tab opens.
4. If it still does not show, build **Debug info** with **Permissions, browser and screen** ticked. It lists the service and model of every TTS connection Lumiverse sent, and whether Auto Foley can use each one. It never lists their names. See [Reporting a problem](getting-started.md#reporting-a-problem).

---

[Back to the README](../README.md)
