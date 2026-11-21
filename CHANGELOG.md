# Changelog

## 0.1.0 (not yet released)

### Added

- **The Director.** A second model marks each message with ElevenLabs voice tags before it is spoken, and picks who says each quoted line. It never changes a word: a line with changed words is read as written. Its whole prompt can be read and changed on the Director tab.
- **The Cast tab.** A voice, model and settings for each person: the narrator, your personas, the characters and the NPCs. People are added when they write a message, when the Director finds them, or by you.
- **A voice for someone the AI added.** The first time they speak, they get one of your connection's voices that nobody else in the cast uses.
- **Sounds in the voice.** With Eleven v3 or v4, the Director can put a `[sound of ...]` tag inside a spoken line, and ElevenLabs performs the sound with the speech. Suggested by a Discord user.
- **Sound effects and a sound library.** Separate sounds before or after a line, made by ElevenLabs with a key saved in the Sounds tab. Every sound made is saved, so the same sound is free the next time. Your own uploads are used first.
- **The Decision model.** An optional Decision connection picks who says each quoted line, and checks which lines describe a sound.
- **The Stage tab.** Play, pause, stop, skip, and Direct again, with the script, a mixer for voices and sounds, and a Log.
- **A button on each message** to perform it, and **Autoplay new replies**.
- **Edited replies are directed again.** A reply changed after it was directed, such as one Auto Refine rewrote, is directed again, and one playing starts again with the new text. **Wait before autoplay** gives another extension time to change a reply first.
- **Debug info**, on the Settings tab. Build a report to paste into a bug report. People in the cast are named by their role, and no message text is included. **Log to the browser console** writes each Log line there too.
- **Thinking is never read aloud.** The same nine thinking formats as Auto Retry and Auto Refine are taken out of a message before it is read, with **Extra thinking tag names** for more.
- **Check my setup**, on the Settings tab. It checks the connection, the Director, the Decision model and the sounds key, and spends no ElevenLabs credits.
