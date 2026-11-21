# Privacy

## In short

- Your messages are sent to the Director's connection and, when it is on, to your Decision connection. Both are connections you set up in Lumiverse.
- Spoken lines go to your TTS engine through your TTS connection in Lumiverse.
- Sound descriptions go to ElevenLabs only when a new sound effect is made.
- Your settings, cast and sound library are kept in Lumiverse, under your account.

## What is sent, and where

| What | Where it goes | When |
| --- | --- | --- |
| The message, split into lines, and your cast with its notes | The Director's connection | Each message performed or prepared, while the Director is on |
| The message lines, and up to 12 cast names with the start of their notes | Your Decision connection | Each message, while the Decision model is on |
| Each line, with the tags its engine reads, and a note on how it is said for Gemini and Qwen3-TTS | Your TTS engine, through your Lumiverse TTS connection | Each line spoken |
| A short sound description | `api.elevenlabs.io`, with your sound effects key | Each new sound effect made |
| A key test | `api.elevenlabs.io` | When you save or test the key |

Earlier messages in the chat are not sent anywhere.

## What is kept

All of this is kept by Lumiverse, under your account, with `spindle.userStorage`:

- Your settings and your cast.
- Your sound library: made sounds and uploads.

Your sound effects key is kept in Lumiverse's secure storage, under your account.

**Debug info** builds its report on your device. Nothing in it is sent anywhere until you paste it.

Two things are kept in your browser: which tab of the panel was open, and a copy of your settings, so the panel draws at once. The copy in your account replaces it as soon as Lumiverse answers.

A directed message is kept in memory on the server, for up to 40 messages for each account, so playing one again asks nothing. It is gone when Lumiverse restarts.

With **Save the performance to the message** on, the finished audio is saved to the message, the same way Lumiverse's own TTS saves it.

## The permissions it asks for

| Permission | What it is for |
| --- | --- |
| Generation | Asking the Director, listing your connections for **Which connection**, and reading the thinking Prefix and Suffix saved on them |
| Decision models | Asking the Decision model, and listing your Decision connections |
| CORS proxy | Making sound effects with ElevenLabs, and testing the key |
| UI panels | The floating button, when you turn it on in the Settings tab |

Refusing **UI panels** stops only the floating button. Refusing **CORS proxy** stops only new sound effects. Refusing **Decision models** turns the Decision model off. Refusing **Generation** turns the Director off, and messages are read as written.

---

[Back to the README](../README.md)
