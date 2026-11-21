# Sounds

## In short

- Sounds can be made two ways, or both.
- **In the voice:** a tag that starts with "sound of", inside a spoken line. Eleven v3 and v4 perform it with the line. It needs no extra key.
- **Sound effects:** separate clips, played before or after a line. They come from your library, or are made by ElevenLabs with a key you save in the Sounds tab.
- Every sound made is saved, so the same sound is free the next time.
- Your own uploaded clips are used first.

## How sounds are made

On the Director tab, under **Sounds**, pick **How sounds are made**:

| Choice | What happens | Needs |
| --- | --- | --- |
| **In the voice** | The Director puts one `[sound of ...]` tag in a line. ElevenLabs performs the sound with the speech. | Eleven v3 or v4. Every other engine plays the sound as a sound effect instead. |
| **Sound effects** | The Director names a sound before or after a line. Auto Foley plays a separate clip. | A library clip, or an ElevenLabs key in the Sounds tab |
| **Both** | Short sounds during speech go in the voice. Bigger sounds, or sounds between lines, are effects. | Both of the above |

A sound in the voice can carry a short voice in the background, such as:

```
[sound of a chair scraping back, someone muttering "fine"]
```

What is kept in a sound tag:

- One in a line.
- Up to 140 characters.
- Letters, numbers, spaces, and the punctuation of a short quoted line.

When **Narration** is set to **Sounds only** or **Skip**, narration is not spoken. Sounds in the voice then go on speech lines only.

## Only sounds the text shows

**Only sounds the text shows**, under **Sounds** in the Director tab, is on by default.

- A sound is kept when a word of it is in its line, or in the line before or after. A word counts when it is the same, or starts the same way, such as `slammed` for `slamming`.
- A sound the text gives no sign of is left out. The Log says how many were left out.
- A line the Decision model said describes a sound keeps its sound.
- Turn it off to keep every sound the Director adds.

## The ElevenLabs key for sound effects

Lumiverse has no route for ElevenLabs sound effects, so this one feature needs a key of its own.

1. In ElevenLabs, make an API key with the **Sound Effects** permission.
2. On the Sounds tab, paste it under **Key for api.elevenlabs.io** and press **Save**.
3. Auto Foley tests it at once and says how many credits are left.

About the key:

- It is kept in Lumiverse's secure storage, for your account only.
- It is only ever sent to `api.elevenlabs.io`.
- The panel never gets it back. It only shows whether a key is saved.
- **Forget** removes it.

Without a key, sound effects come only from your library. Sounds in the voice still work.

## Your library

Every sound made by ElevenLabs is saved in your library. When the Director asks for a sound, Auto Foley looks there first:

1. A clip whose **trigger words** appear in the description. For example, a clip with the trigger word `glass` plays for "a wine glass breaking on tile".
2. A clip made from the same description.
3. A clip that shares most of the description's words.
4. Only then is a new sound made, if **Make new sounds with ElevenLabs** is on.

Your own uploads are checked before made sounds at every step.

- **Upload a sound** takes MP3, WAV, OGG or M4A files, up to 3 MB each.
- **Sound length** sets how long a made sound is. **Let ElevenLabs choose** is the default. Longer sounds cost more credits.
- The library holds up to 400 sounds.

## Intimate sounds

**Intimate sounds**, under **Sounds** on the Director tab, lets the Director add the sounds of a sex scene between adults, such as kissing or a bed creaking. It is off by default.

ElevenLabs may refuse to make some of these as sound effects. When it does, the Log says so. Uploads are the way around this: a clip you upload is played from your library and never goes through ElevenLabs.

## When a sound does not play

The Log on the Stage tab says why. The usual reasons:

- **No sound fits, and there is no key.** Save a key, upload a clip, or use **In the voice**.
- **ElevenLabs refused the key.** Check it with **Test** on the Sounds tab.
- **No credits left.**
- **ElevenLabs would not make this description.** Upload a clip for it, with a trigger word.
- **The CORS proxy permission is refused.** New sounds cannot be made. Your library still plays.

---

[Back to the README](../README.md)
