# Auto Foley

Voice acting and sound effects for your TTS, in Lumiverse.

Lumiverse can already read a reply aloud. Auto Foley makes it a performance:

- A second model, the **Director**, marks how each line is said, with voice tags such as `[whispers]`, `[sighs]` or `[through gritted teeth]`.
- Sounds go with what happens: a door, footsteps, a glass breaking. They can be made inside the voice or as separate sound effects.
- Everyone who speaks gets their own voice: your personas, the characters and the NPCs. New speakers are added by the AI, or by you.
- An optional **Decision model** picks who says each quoted line.
- It never changes the words of your story. Only the copy sent to the voice gets tags.

It works only with models that act: ElevenLabs v3 and v4, Fish Audio S2 and Drama 3, Gemini 2.5, 3.1 and 3.8, and Chatterbox-Turbo. See [Voice engines](docs/engines.md).

## Install

1. In Lumiverse, open **Settings**, then **Extensions**, then **Install**.
2. Enter `https://github.com/starlitcode/Lumiverse-Auto-Foley`.
3. Turn on Auto Foley and grant its permissions.

You also need a TTS connection in Lumiverse, under **Connections**, in the TTS section. Auto Foley speaks through it, so its key stays in Lumiverse.

## Where it is

- **The drawer:** a tab called **Foley**, with a headphones icon. It has five tabs: Stage, Cast, Director, Sounds and Settings.
- **Each message:** the Auto Foley button in its row of buttons. Press it to perform the message. Press it again to stop.
- **The floating player:** a round button over the chat. Turn on **A floating player** in the Settings tab. See [The floating player](docs/getting-started.md#the-floating-player).

## Documentation

**Start here**

- [Getting started](docs/getting-started.md): set it up and perform your first message.

**Going further**

- [Voice engines](docs/engines.md): what each engine can do, and how to set up Chatterbox.
- [The Director](docs/director.md): what it does, what it is sent, and its prompt.
- [The cast](docs/cast.md): voices for personas, characters and NPCs.
- [Sounds](docs/sounds.md): sounds in the voice, sound effects and your library.

**About it**

- [Privacy](docs/privacy.md): what is sent where, and what is kept.
- [Security](SECURITY.md): what it can reach and how to check it.
- [Changelog](CHANGELOG.md)

## Made for adults

Auto Foley is for adults, 18 and older. It is not for sexual content involving minors, and the owner does not help anyone under 18 with anything. The details are in [The one thing it does not direct](docs/director.md#the-one-thing-it-does-not-direct).

## Credits

- **starlitcode**: built and maintains the extension
- **[Claude](https://claude.ai)** (Anthropic): wrote the code, directed and tested by starlitcode
- **[Choir](https://github.com/patatasbravasch-arch/Choir)**: the extension that showed a voice for every character, with sound effects, was worth having, and inspired the floating player. Auto Foley is written from scratch and shares no code with it
- **[Chat Voice](https://github.com/WanderingMonk8/custom_voice)** by WanderingMonk8: the extension that showed a TTS voice for each speaker in a chat was worth having. Auto Foley is written from scratch and shares no code with it
- Sister extensions: [Auto Retry](https://github.com/starlitcode/Lumiverse-Auto-Retry) and [Auto Refine](https://github.com/starlitcode/Lumiverse-Auto-Refine)

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
