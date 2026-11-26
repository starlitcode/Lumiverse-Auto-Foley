# Scene music

## In short

- **Scene music** plays music for the mood of the scene, quietly, under the voices and sounds.
- It is off by default. Turn it on in the **Sounds** tab.
- The Director picks the mood of each scene, and changes it when the scene turns.
- The music comes from your sound library. A track is marked with a mood under **Music for**.
- With no track for a mood, one can be found on Freesound, with your Freesound key. It is free, and it is kept in your library.
- The music goes down while someone speaks, pauses with the performance, and fades out at the end.
- Its volume is **Music** in the Mixer.

## Steps

1. Open the **Sounds** tab and switch on **Scene music**.
2. To use your own music, press **Upload a sound** under **Your sound library**, then pick its mood under **Music for**.
3. To have tracks found for you, save a Freesound key on the same tab, and leave **Where music comes from** on **Your library, then Freesound**.
4. Play a message. The Log says which track plays for which mood.
5. Set how loud the music is with **Music** in the Mixer, on the Stage tab, or in the floating player.

## The moods

The Director picks from these ten moods:

| Mood | Searched for on Freesound |
| --- | --- |
| calm | calm ambient music |
| cozy | cozy acoustic music |
| happy | happy upbeat music |
| playful | playful whimsical music |
| romantic | romantic piano music |
| sad | sad piano music |
| tense | tense suspense music |
| scary | horror dark ambient music |
| action | action battle music |
| mysterious | mysterious ambient music |

## What it sends

- **To the Director**: `"music": true` and the list of moods, with the message. It sends back a mood on the line where the scene starts, and on any line where the mood turns. It is the same call as before, so it costs nothing extra. The rules it follows are in the `<music>` part of its prompt, which can be read and changed on the Director tab. See [The prompt](director.md#the-prompt).
- **To Freesound**, only when your library has no track for a mood and **Where music comes from** allows it: the search words for that mood, with your Freesound key. See [Privacy](privacy.md).

Nothing is sent for music that is already in your library.

## An example

Wynn and Halloran are made-up characters, waiting on a night train. The reader has two tracks: one marked **tense**, and one marked **sad**.

1. The message opens with the lights going out in the carriage. The Director marks the first line **tense**.
2. The tense track starts, fading in over about a second. While the narrator and Wynn speak, it sits at 45% of the Music volume.
3. Halfway through, Halloran says the letter never arrived. The Director marks that line **sad**.
4. The tense track fades out as the sad one fades in.
5. The message ends, and the sad track fades out.
6. The next message is still sad, so the same track starts again.

## Your library

- **Music for**, on each sound in **Your sound library**, marks it as a track for one mood. **Not music, a sound effect** puts it back.
- A track marked with a mood is never played as a sound effect, even when its trigger words match.
- A mood with several tracks plays the one played least. The next scene in that mood gets the next track.
- An upload can be up to 3 MB, since it travels through the extension. A longer track can be added by link instead.
- A track found on Freesound is between 30 seconds and two and a half minutes long. It keeps its credit, its name, who made it, its license and its page, and the Log names it when it plays.
- **Freesound licenses**, under **Get new sounds**, applies to music too.

## Settings

| Setting | Where | Default | What it does |
| --- | --- | --- | --- |
| **Scene music** | Sounds tab | Off | Plays music for the mood of the scene. |
| **Where music comes from** | Under **Scene music** | **Your library, then Freesound** | **Your library only** never searches Freesound. |
| **Lower the music while someone speaks** | Under **Scene music** | On | The music goes to 45% of its volume while a voice plays. The narrator counts as a voice. |
| **Music** | Mixer, on the Stage tab, and the floating player | 35% | How loud the music is. **Mute** in the Mixer is for this page only. |

## In the Studio

**Music**, under **The performance** in the Studio, keeps the music in the audio and the video. It is on by default.

- The same track that played is used for each mood, at the **Music** volume, with the same fades and the same dip under voices.
- A performance opened from **Saved audio** gets the least played track for each mood, since which one played before is not saved.
- **A file for each part** has no music, since music is not one of the parts.
- A track added by link is in a download only when its site allows the browser to fetch it.

## Limits

- The Director has to direct the message for a mood to be picked. A message read as written, because the Director could not direct it, has no new mood, and music that was playing fades out at the end.
- The music loops. A short track repeats more often.
- The Director's mood is a judgment of the scene. It can be wrong. The Log says which mood and track played, so a wrong one is easy to spot.

---

[Back to the README](../README.md)
