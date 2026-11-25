# Privacy

## In short

- Your messages are sent to the Director's connection and, when it is on, to your Decision connection. Both are connections you set up in Lumiverse.
- Spoken lines go to your TTS engine through your TTS connection in Lumiverse.
- The key words of a sound description go to Freesound when a new sound is searched for. A description goes to ElevenLabs only when a new sound is made there.
- Your settings, cast and sound library are kept in Lumiverse, under your account. With **Keep made audio** on, so are the lines it spoke and the scripts.

## What is sent, and where

| What | Where it goes | When |
| --- | --- | --- |
| The message, split into lines, and your cast with its notes | The Director's connection | Each message performed or prepared, while the Director is on |
| The message lines, and up to 12 cast names with the start of their notes | Your Decision connection | Each message, while the Decision model is on |
| Each line, with the tags its engine reads, and a note on how it is said for Gemini | Your TTS engine, through your Lumiverse TTS connection | Each line spoken |
| The key words of a sound description | `freesound.org`, with your Freesound key | Each new sound searched for |
| A request for the sound's preview, with no key | Freesound, at the preview's address | Each new sound found |
| A short sound description | `api.elevenlabs.io`, with your ElevenLabs key | Each new sound made |
| A key test | `freesound.org` or `api.elevenlabs.io` | When you save or test that key |

A sound you added by link is played by your browser from that address, so that site sees the request, as with any link you open.

Earlier messages in the chat are not sent anywhere.

## What is kept

All of this is kept by Lumiverse, under your account, with `spindle.userStorage`:

- Your settings and your cast, with any pictures you picked for it, made small on your device first.
- Your sound library: sounds found on Freesound, with their credit, sounds made by ElevenLabs, your uploads, and your links.
- With **Keep made audio** on, which it is by default: each spoken line, up to the size you pick, and the last 300 scripts, with their text. **Clear kept audio** deletes them, and **Do not keep it** stops it.

Your Freesound and ElevenLabs keys are kept in Lumiverse's secure storage, under your account.

**Debug info** builds its report on your device. Nothing in it is sent anywhere until you paste it.

Two things are kept in your browser: which tab of the panel was open, and a copy of your settings, so the panel draws at once. The copy in your account replaces it as soon as Lumiverse answers.

A script is also kept in memory on the server, up to 40 for each account, so playing one again asks nothing. With **Keep made audio** off, it is gone when Lumiverse restarts.

With **Save the performance to the message** on, the finished audio is saved to the message, the same way Lumiverse's own TTS saves it.

## The permissions it asks for

| Permission | What it is for |
| --- | --- |
| Generation | Asking the Director, listing your connections for **Which connection**, and reading the thinking Prefix and Suffix saved on them |
| Decision models | Asking the Decision model, and listing your Decision connections |
| CORS proxy | Finding sounds on Freesound, making them with ElevenLabs, and testing the keys |
| UI panels | The floating player, when you turn it on in the Settings tab |

Refusing **UI panels** stops only the floating player. Refusing **CORS proxy** stops only new sound effects. Refusing **Decision models** turns the Decision model off. Refusing **Generation** turns the Director off, and messages are read as written.

---

[Back to the README](../README.md)
