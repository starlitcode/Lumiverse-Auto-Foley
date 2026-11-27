# Privacy

## In short

- Your messages are sent to the Director's connection and, when it is on, to your Decision connection. Both are connections you set up in Lumiverse.
- Spoken lines go to your TTS engine through your TTS connection in Lumiverse. With **Chatterbox server (direct)**, they go to the server address you gave, through Lumiverse's CORS proxy.
- The key words of a sound description go to Freesound when a new sound is searched for. A description goes to ElevenLabs only when a new sound is made there.
- Your settings, cast and sound library are kept in Lumiverse, under your account. With **Keep made audio** on, so are the lines it spoke and the scripts.

## What is sent, and where

| What | Where it goes | When |
| --- | --- | --- |
| The message, split into lines, and your cast with its notes | The Director's connection | Each message performed or prepared, while the Director is on |
| The same as the Director gets | Your **Second Director**'s connection | Only when the Director refuses or sends back nothing usable, while **Second Director** is on |
| The message lines, and up to 12 cast names with the start of their notes | Your Decision connection | Each message, while the Decision model is on |
| Each line, with the tags its engine reads, a note on how it is said for Gemini, and a feeling for Cartesia | Your TTS engine, through your Lumiverse TTS connection | Each line spoken |
| Each line, with its tags, voice and settings | Your Chatterbox server, at the address you gave, through Lumiverse's CORS proxy | Each line spoken, with **Chatterbox server (direct)** picked |
| A request for the server's model and voices | Your Chatterbox server | When you press **Save and test** for it |
| The key words of a sound description | `freesound.org`, with your Freesound key | Each new sound searched for |
| A request for the sound's preview, with no key | Freesound, at the preview's address | Each new sound found |
| The search words for a music mood, such as "sad piano music" | `freesound.org`, with your Freesound key | With **Scene music** on, each mood your library has no track for, while **Where music comes from** allows it |
| A short sound description | `api.elevenlabs.io`, with your ElevenLabs key | Each new sound made |
| A key test | `freesound.org` or `api.elevenlabs.io` | When you save or test that key |

A sound you added by link is played by your browser from that address, so that site sees the request, as with any link you open.

Earlier messages in the chat are not sent anywhere.

## What is kept

All of this is kept by Lumiverse, under your account, with `spindle.userStorage`:

- Your settings and your cast, with any pictures you picked for it, made small on your device first.
- The ids of the chats you switched Auto Foley off in. A temporary chat is never kept.
- The background pictures for videos in the Studio, if you choose them, at most 1920 pixels on the long side, one file for each background.
- Fonts you add in the Studio, up to 8, each up to 3 MB. A font is read only to draw your videos on your device.
- Pictures for moods on the Cast tab, if you choose them, each in a file of its own, made small like the main picture.
- Watermark pictures in the Studio, if you choose them, each in a file of its own, at most 512 pixels on the long side.
- Projects in the Studio, if you make them, each in a file of its own with a list of their names. A project holds Studio settings and the id of the saved performance it uses, not audio or pictures.
- A picture taken from a character or persona in Lumiverse, when you press **Use pictures from Lumiverse** or **Use their Lumiverse picture**, made small like a picture you choose.
- Your sound library: sounds found on Freesound, with their credit, sounds made by ElevenLabs, your uploads, and your links. A music track is kept here too, with the mood it is marked with.
- With **Keep made audio** on, which it is by default: each spoken line, up to the size you pick, and the last 300 scripts, with their text. **Clear kept audio** deletes them, and **Do not keep it** stops it.

Your Freesound and ElevenLabs keys are kept in Lumiverse's secure storage, under your account.

**Debug info** builds its report on your device. Nothing in it is sent anywhere until you paste it.

Three things are kept in your browser:

- Which tab of the panel was open.
- Where the floating player sits on the screen, and whether it is open.
- A copy of your settings, so the panel draws at once. The copy in your account replaces it as soon as Lumiverse answers.

A script is also kept in memory on the server, up to 40 for each account, so playing one again asks nothing. With **Keep made audio** off, it is gone when Lumiverse restarts.

With **Save the performance to the message** on, the finished audio is saved to the message, the same way Lumiverse's own TTS saves it.

## The permissions it asks for

| Permission | What it is for |
| --- | --- |
| Generation | Asking the Director, listing your connections for **Which connection**, reading the thinking Prefix and Suffix saved on them, and reading each connection's address and thinking level for **Fit the wait to the model** |
| Decision models | Asking the Decision model, and listing your Decision connections |
| CORS proxy | Finding sounds and music on Freesound, making sounds with ElevenLabs, testing the keys, and reaching a Chatterbox server you added |
| UI panels | The floating player, when you turn it on in the Settings tab |
| App manipulation | Opening the Studio over the whole screen |

Refusing **UI panels** stops only the floating player. Refusing **App manipulation** opens the Studio in Lumiverse's extension window instead of over the whole screen. Refusing **CORS proxy** stops new sound effects and a Chatterbox server reached directly. Refusing **Decision models** turns the Decision model off. Refusing **Generation** turns the Director off, and messages are read as written.

## What it never does

- It never changes the words of a message. Only the copy sent to the voice gets tags.
- It never sends your Freesound or ElevenLabs key anywhere but its own host: `freesound.org` and `api.elevenlabs.io`. Neither key is sent back to the panel or put in settings.
- Apart from Lumiverse's own routes, and a sound you added by link, it never calls any host other than Freesound, ElevenLabs and a Chatterbox server you add. Every speech key for your TTS connections stays in Lumiverse.
- It never sends earlier messages in the chat anywhere.
- It never runs text as code. There is no `eval` and no `new Function`, so nothing in a message, a note or a model's answer can run.

## Checking any of this yourself

Lumiverse loads two files, named in `spindle.json`: `dist/frontend.js` and `dist/backend.js`. They are readable code, not minified or bundled. What you read is what runs. If you are checking this extension, or pointing a scanner at it, those two files are all of it.

The rest of the repo is for working on the extension and never reaches your browser:

- `src/` is the TypeScript the two files are built from. A scanner that only reads JavaScript cannot read it. The `dist/` files are plain JavaScript.
- `test/` only runs when a developer runs `bun run check`.
- `setup.sh` prepares a developer's machine. Nothing runs it when you install.
- `docs/` is these pages.
- `.github/workflows/` runs the checks on pull requests.

The checks rebuild `dist/` on every push and fail if it differs from `src/`, so the files Lumiverse loads always match the source. `package.json` has no install scripts, so nothing runs when Lumiverse installs the extension.

---

[Back to the README](../README.md)
