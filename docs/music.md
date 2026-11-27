# Scene music

## In short

- **Scene music** plays music for the mood of the scene, at a low volume, under the voices and sounds.
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

The Director picks from the **Scene moods** list, under **Scene music** on the Sounds tab. The same list picks backgrounds for scenes in the Studio. These are the ten built-in moods:

| Mood | What it is for | Searched for on Freesound |
| --- | --- | --- |
| Calm | Quiet and settled. Nothing is at stake. | calm ambient music |
| Cozy | Warm and safe, like a home or a friend nearby. | cozy acoustic music |
| Happy | Bright and glad. Good news, a win, a party. | happy upbeat music |
| Playful | Teasing, silly or light. Jokes and games. | playful whimsical music |
| Romantic | Tender or longing, between people who care for each other. | romantic piano music |
| Sad | Loss, hurt or grief. | sad piano music |
| Tense | Something could go wrong. An argument, a threat, a wait. | tense suspense music |
| Scary | Fear and horror. Something is out there. | horror dark ambient music |
| Action | A fight, a chase or a race against time. | action battle music |
| Mysterious | Something hidden, strange or not yet known. | mysterious ambient music |

### Changing the moods

Open **Scene moods** under **Scene music**. Each mood has:

- **Name**: what the Director picks it by, and what the panel shows. Each mood needs a name of its own.
- **What it is for**: a short description the Director reads, up to 200 characters.
- **Freesound search words**: what scene music for it is searched for. Empty uses the name and "music".

**Add a mood** adds one at the end, up to 30. **Move up** and **Move down** change the order. **Delete** asks first, and says which backgrounds and tracks use the mood:

- A background used for it stops being used for it.
- A track marked with it stays in your library and plays for no mood. Its **Music for** reads **A deleted mood** until you pick another.

**Back to built-in** asks first, then puts the ten built-in moods back.

Each mood is kept by an id, so a renamed mood keeps its tracks and backgrounds. The built-in moods change only when Auto Foley is updated. If that happens while you have your own list, a notice says so.

## What it sends

- **To the Director**: `"music": true` and the list of moods, each with its name and what it is for, with the message. It sends back a mood on the line where the scene starts, and on any line where the mood turns. It is the same call as before, so it costs nothing extra. The rules it follows are in the `<music>` part of its prompt, which can be read and changed on the Director tab. See [The prompt](director.md#the-prompt).
- **To Freesound**, only when your library has no track for a mood and **Where music comes from** allows it: the Freesound search words for that mood, with your Freesound key. See [Privacy](privacy.md).

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

- The same track that played is used for each mood, at the **Music** volume. It fades in and out over a second, and goes down under voices.
- It is only added while **Scene music** is on.
- A performance opened from **Saved audio** gets the least played track for each mood, since which one played before is not saved.
- **A file for each part** has no music, since music is not one of the parts.
- A track added by link is in a download only when its site allows the browser to fetch it.

## Limits

- A message directed before **Scene music** was turned on has no mood, since its script was kept from then. Turn on **Scene music** before playing a new message, or press **Direct again** on the Stage tab, which directs the message afresh and costs a Director call.
- The Director has to direct the message for a mood to be picked. A message read as written, because the Director could not direct it, has no new mood, and music that was playing fades out at the end.
- The music loops. A short track repeats more often.
- The Director's mood is a judgment of the scene. It can be wrong. The Log says which mood and track played, so a wrong one is easy to spot.

---

[Back to the README](../README.md)
