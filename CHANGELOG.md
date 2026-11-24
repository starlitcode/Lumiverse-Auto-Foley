# Changelog

Every released version of Auto Foley, newest first.

Versions follow [Semantic Versioning](https://semver.org). A new major version means a reinstall rather than an update, a minor version adds something, and a patch version only fixes things.

---

## 1.1.0

_Not yet released_

### Added

- **Play from the drawer.** Play in Now playing, on the Stage tab, performs the latest reply or your latest message when nothing is playing. The same choice as in the floating player sits under it.
- **Light up words in the chat**, on the Settings tab, on by default. The word being spoken is lit in the message itself, as it is said. Nothing in the message is changed.
- **Paste a voice ID**, in the Cast tab, for a voice the list does not show, such as one you made or cloned. Suggested by a Discord user.
- **More settings for each engine**, in the Cast tab, under each person's voice. Only the settings their engine takes are shown: speaker boost and language for ElevenLabs, voice direction, temperature, top P and steady loudness for Fish Audio, temperature, language and a usual way of speaking for Gemini, and exaggeration, CFG weight, temperature and seed for Chatterbox. **Back to defaults** clears them.
- **A Chatterbox server, without a Lumiverse connection**, in the Settings tab. Auto Foley talks to a Chatterbox-TTS-Server itself, listed as **Chatterbox server (direct)**, so its own settings reach it. **Save and test** says which model it runs and how many voices it has.
- **Speed in each engine's own range**: 0.7 to 1.2 for ElevenLabs, 0.5 to 2 for Fish Audio and Chatterbox.
- **Back to defaults for the mixer.** It sets voices to 100% and sounds to 80%, and unmutes both.

### Changed

- **Buttons are off by default.** **A button on every message**, **A button in the chat's row of controls** and **In the Extras menu** start off. If you were on the old setting, a notice on every tab says so, with **Take it** and **Keep mine**.
- **Notes for each voice engine** shows the engine in use first and open again. Every other engine has a fold of its own.
- **The floating player's quick switches** flip only when the switch itself is pressed, the same as every other switch.
- **The moving bars** next to the speaker in the floating player are gone.
- **Scripts.** The panel calls what the Director makes from a message its script, such as **Kept audio and scripts** in **Start again**.

### Fixed

- **The words in Now playing were choppy.** The word being said now fills from left to right as it is spoken, and the timing is worked out on every frame.
- **Now playing lost its place after you came back to the Lumiverse tab.** It now picks up from where the audio really is.
- **A message button could perform the wrong message.** After a delete, Lumiverse can show another message in the same row, and the button there still performed the message that was deleted, with its kept audio. A button now performs the message its row shows when it is pressed.
- **Play could bring back a deleted message.** A message deleted while it plays stops, and its script is not played again.
- **The floating player cut off the line being spoken.** The whole line shows now, up to eight lines, and a longer one scrolls inside its box.
- **The open floating player sometimes would not drag on a phone.** Its top bar now takes the drag instead of the page scrolling.
- **Switching tabs moved the drawer back up.** It now stays exactly where you scrolled it.
- **The seconds count could put its "s" on a line of its own.**

---

## 1.0.0

_2026-11-21_

First release.

---

[Back to the README](README.md)
