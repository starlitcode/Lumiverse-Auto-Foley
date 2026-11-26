# Sounds

## In short

- Sounds can be played two ways, or both.
- **In the voice:** a tag that starts with "sound of", inside a spoken line. Eleven v3 and v4 perform it with the line. It needs no extra key.
- **Sound effects:** separate clips, played before or after a line. They work with every voice engine.
- A sound effect comes from your library first. A new one is found on Freesound, which is free, or made by ElevenLabs, which costs credits. Each needs a key of your own.
- Every new sound is saved, so the same sound is free the next time.
- Your own uploaded clips are used first.

## How sounds are made

On the Director tab, under **Sounds**, pick **How sounds are made**. **Both** is the default, so sounds work with every engine.

| Choice | What happens | Needs |
| --- | --- | --- |
| **In the voice** | The Director puts one `[sound of ...]` tag in a line. ElevenLabs performs the sound with the speech. | Eleven v3 or v4. Every other engine plays the sound as a sound effect instead. |
| **Sound effects** | The Director names a sound before or after a line. Auto Foley plays a separate clip. | A library clip, or a Freesound or ElevenLabs key in the Sounds tab |
| **Both** (the default) | Short sounds during speech go in the voice, on Eleven v3 and v4. Bigger sounds, sounds between lines, and every sound on other engines are effects. | Either of the above |

A sound in the voice can carry a short voice in the background, such as:

```
[sound of a chair scraping back, someone muttering "fine"]
```

What is kept in a sound tag:

- One in a line.
- Up to 140 characters.
- Letters, numbers, spaces, and the punctuation of a short quoted line.

When **Narration**, under **Reading messages** in the Settings tab, is set to **Sounds only** or **Skip**, narration is not spoken. Sounds in the voice then go on speech lines only.

## Only sounds the text shows

**Only sounds the text shows**, under **Sounds** in the Director tab, is on by default.

- A sound is kept when a word of it is in its line, or in the line before or after. A word counts when it is the same, or starts the same way, such as `slammed` for `slamming`.
- A sound the text gives no sign of is left out. The Log says how many were left out.
- A line the Decision model said describes a sound keeps its sound.
- Turn it off to keep every sound the Director adds.

## Where new sounds come from

### In short

- A sound your library does not have is found on Freesound, or made by ElevenLabs.
- **Freesound** has recorded sounds that its users share. It is free for non-commercial use. Most sounds ask you to credit the person who made them, and Auto Foley shows that credit.
- **ElevenLabs** makes a new sound from the description. It costs credits.
- By default, Freesound is asked first. ElevenLabs is asked only when Freesound finds nothing, or has no key.
- Every new sound is saved to your library.

### The steps

1. The Director names a sound, such as "a heavy wooden door slamming shut".
2. Auto Foley looks in your library. A sound there is played, and nothing is asked.
3. With **Get new sounds** on, it searches Freesound for the key words of the description.
4. It takes the first result with an allowed license and a preview, up to 20 seconds long.
5. If Freesound finds nothing, it asks ElevenLabs to make the sound, when **Where they come from** allows it.
6. The new sound is saved to your library, with its credit when it came from Freesound.

### What it sends

- To `freesound.org`: the key words of the description, and your Freesound key. The preview is then downloaded from Freesound with no key.
- To `api.elevenlabs.io`: the description, the sound length, and your ElevenLabs key.

Nothing else from the message is sent.

### An example

The Director asks for "a heavy wooden door slamming shut". Your library has no door sound.

1. Auto Foley searches Freesound for "heavy wooden door slamming shut".
2. The first result is under CC BY-NC, and **Freesound licenses** is set to **CC0 and CC BY, for any use**. It is skipped.
3. The second result, "slam_02" by a user called brasslantern, is under CC BY. It is taken.
4. It plays after the line. Now playing shows: From Freesound: slam_02 by brasslantern, CC BY.
5. It is saved to your library, with the same credit and a link to its Freesound page.

If the full search finds nothing, Auto Foley tries "heavy wooden door", then "heavy wooden".

### The settings

All are on the Sounds tab, under **Get new sounds**:

- **Where they come from**: Freesound first, then ElevenLabs (the default), Freesound only, or ElevenLabs only.
- **Freesound licenses**:
  - **All three**: CC0, CC BY and CC BY-NC. CC BY-NC is for non-commercial use only.
  - **CC0 and CC BY, for any use** (the default), so a video made in the Studio can be posted anywhere, a channel that earns money included.
  - **CC0 only, no credit needed**.
- With no sound effects in your library, and no Freesound or ElevenLabs key saved or **Get new sounds** off, the Director is not asked for sound effects, so no tokens go on sounds that cannot play. The Log says why. Sounds inside the line, on ElevenLabs v3 and v4, need no key.
- **ElevenLabs sound length**: how long a made sound is. **Let ElevenLabs choose** is the default. Longer sounds cost more credits.

### The keys

Each key is kept in Lumiverse's secure storage, for your account only. It is only ever sent to its own service. The panel never gets it back. It only shows whether a key is saved. **Forget** removes it.

For Freesound:

1. Sign in at freesound.org.
2. Open freesound.org/apiv2/apply and make a key.
3. On the Sounds tab, paste its **Client secret/Api key** under **Key for freesound.org** and press **Save**. It is tested at once.

Freesound allows 60 searches a minute and 2000 a day. A sound already in your library uses none.

For ElevenLabs:

1. In ElevenLabs, make an API key with the **Sound Effects** permission.
2. On the Sounds tab, paste it under **Key for api.elevenlabs.io** and press **Save**.
3. Auto Foley tests it at once and says how many credits are left.

With no key at all, sound effects come only from your library. Sounds in the voice still work.

## Your library

Every sound found on Freesound or made by ElevenLabs is saved in your library. When the Director asks for a sound, Auto Foley looks there first:

1. A clip whose **trigger words** appear in the description. For example, a clip with the trigger word `glass` plays for "a wine glass breaking on tile".
2. A clip made from the same description.
3. A clip that shares most of the description's words.
4. Only then is a new sound found or made, if **Get new sounds** is on.

Your own uploads and links are checked before found and made sounds at every step.

- **Upload a sound** takes MP3, WAV, OGG or M4A files, up to 3 MB each.
- **Add a sound by link** keeps a link to a sound, starting with `https://`. The sound is played from that address each time, so a big file costs no space. Name it so the Director's descriptions can find it. A linked sound cannot be saved to a message with **Save the performance to the message**.
- A sound from Freesound shows who made it, its license and a link to its page. **Find another** puts the next Freesound result in its place, at no cost.
- A sound made by ElevenLabs has **Make it again**, which costs credits.
- The library holds up to 400 sounds, music tracks included.
- **Music for** marks a sound as a music track for one mood. A track is never played as a sound effect. See [Scene music](music.md).

## Intimate sounds

**Intimate sounds**, under **Sounds** on the Director tab, lets the Director add the sounds of a sex scene between adults, such as kissing or a bed creaking. It is off by default.

ElevenLabs may refuse to make some of these, and Freesound may have none. When that happens, the Log says so. Uploads are the way around this: a clip you upload is played from your library and is never sent anywhere.

## When a sound does not play

The Log on the Stage tab says why. The usual reasons:

- **No sound fits, and there is no key.** Save a Freesound or ElevenLabs key, upload a clip, or use **In the voice**.
- **Freesound or ElevenLabs refused the key.** Check it with **Test** on its card in the Sounds tab.
- **Freesound found nothing.** Upload a clip for it, with a trigger word, or let ElevenLabs make it.
- **Freesound's daily limit is reached.** It allows 2000 searches a day.
- **ElevenLabs has no credits left, or would not make this description.**
- **The CORS proxy permission is refused.** New sounds cannot be found or made. Your library still plays.

---

[Back to the README](../README.md)
