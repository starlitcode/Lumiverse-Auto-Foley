# Changelog

Every released version of Auto Foley, newest first.

Versions follow [Semantic Versioning](https://semver.org). A new major version means a reinstall rather than an update, a minor version adds something, and a patch version only fixes things.

---

## 1.1.0

_Not yet released_

### Added

- **Play from the drawer.** Play in Now playing, on the Stage tab, performs the latest reply or your latest message when nothing is playing. The same choice as in the floating player sits under it.
- **Light up words in the chat**, on the Settings tab, on by default. The word being spoken is lit in the message itself, as it is said. Nothing in the message is changed.
- **Type a voice name or ID**, in the Cast tab, for a voice the list does not show, such as one you made or cloned, a Gemini voice name, or a voice file on a Chatterbox server. A name or ID that matches a voice in the list picks that voice.
- **More settings for each engine**, in the Cast tab, under each person's voice. Only the settings their engine takes are shown: speaker boost and language for ElevenLabs, voice direction, temperature, top P and steady loudness for Fish Audio, temperature, language and a usual way of speaking for Gemini, and exaggeration, CFG weight, temperature and seed for Chatterbox. **Back to defaults** clears them.
- **A Chatterbox server, without a Lumiverse connection**, in the Settings tab. Auto Foley talks to a Chatterbox-TTS-Server itself, listed as **Chatterbox server (direct)**, so its own settings reach it. **Save and test** says which model it runs and how many voices it has.
- **Speed in each engine's own range**: 0.7 to 1.2 for ElevenLabs, 0.5 to 2 for Fish Audio and Chatterbox.
- **How they speak says what helps on each engine.** The line under the box changes with the engine the person speaks through.
- **Nonbinary**, as a voice type in the Cast tab. The Director marks someone new as nonbinary only when the text says so, and a voice the provider marks neutral is picked for them when there is one.
- **Main characters and minor ones.** The Director says which a new speaker is, and the Cast tab files a main one as a character and a minor one as an NPC.
- **Crop a cast picture.** After you choose a picture, drag it and zoom so the circle frames the face, then press **Use this**.
- **The Decision model's next two choices.** **What the Decision model answered**, in the Log, now also lists the next two people it considered for each quote, with their chances, so you can see how close the call was.
- **Back to defaults for the mixer.** It sets voices to 100% and sounds to 80%, unmutes both, and turns on **Even out voice levels**.
- **Even out voice levels**, in the Mixer on the Stage tab, on by default. A voice louder than the quietest voice in the message is turned down to match it, by 6 dB at most. The Log says which voice was turned down.
- **Gemini through OpenRouter.** An OpenRouter TTS connection running a Gemini TTS model, such as google/gemini-3.8-flash-tts, can be picked and is used the same as Gemini. Reported by a Discord user.
- **TTS connections in Debug info.** It lists the service and model of every TTS connection Lumiverse sent, and whether Auto Foley can use each one. It never lists their names. Reported by a Discord user.

### Changed

- **Buttons are off by default.** **A button on every message**, **A button in the chat's row of controls** and **In the Extras menu** start off. If you were on the old setting, a notice on every tab says so, with **Take it** and **Keep mine**.
- **Notes for each voice engine** shows the engine in use first and open again. Every other engine has a fold of its own.
- **The floating player's quick switches** flip only when the switch itself is pressed, the same as every other switch.
- **The moving bars** next to the speaker in the floating player are gone.
- **A color for each kind of part.** The narrator is slate, characters violet, you teal, NPCs pink, sounds amber and voice tags blue, on the pictures, the marks for each part and the tags in Now playing. The colors are the same in every theme.
- **Warnings that fit the engine.** The Director tab says when Big moments change only the audience on an engine other than ElevenLabs, and when an engine cannot sing.
- **A new look for the players.** The floating player and **Now playing** on the Stage tab show the line like a page of a script, with a line on its left side in the color of whoever is speaking. An **On air** light shows red while a message plays and amber while it is paused. A thin striped band runs along the top of each player.
- **Groups have an editor.** **New group** and **Edit** open it, with the group's name and a switch for each person in the cast, so you can pick everyone in a group in one place. **Save** keeps it and **Cancel** changes nothing. **Edit** takes the place of **Rename**.
- **Scripts.** The panel calls what the Director makes from a message its script, such as **Kept audio and scripts** in **Start again**.
- **Fish Audio tags are repeated for each sentence.** Fish Audio reads a tag for how the words are said best at the start of the sentence it is for. On a line of several sentences, that tag now goes again at the start of each sentence that has none of its own, so the last sentence is said the same way as the first. Sounds and pauses are not repeated.

### Fixed

- **The notice that a built-in text changed could run off the side of a phone.** Its button now sits under the words, inside the notice.
- **"You have no TTS connection Auto Foley can use" did not say what it found.** It now says whether Lumiverse found no TTS connection on your account, or names the ones it found and their service. It also tells you that a key added under the LLM tab is not a TTS connection. When the list has nothing usable, the connection picked in Lumiverse's own voice settings is also read by itself, and used if it can be. Reported by a Discord user.
- **Other accounts saw no connections to pick, with no reason given.** Lumiverse refuses an extension installed as Personal for every account but the one that installed it. The panel now says so, and that it has to be installed as Operator, under Extensions, for every account to use it.
- **Sounds made with Both warned on every engine but ElevenLabs.** Both plays every sound as an effect on those engines, so only In the voice warns now.
- **A new speaker on Gemini got a voice of any gender.** Gemini lists its voices as masculine and feminine, which did not match. Every way a provider writes gender is understood now.
- **Only minor characters got a voice picked for them.** Anyone new but the narrator gets one now. The pick also matches words in how they sound, such as gravelly or young, to each voice's own description.
- **The words in Now playing were choppy.** The word being said now fills from left to right as it is spoken, and the timing is worked out on every frame.
- **Now playing lost its place after you came back to the Lumiverse tab.** It now picks up from where the audio really is.
- **A message button could perform the wrong message.** After a delete, Lumiverse can show another message in the same row, and the button there still performed the message that was deleted, with its kept audio. A button now performs the message its row shows when it is pressed.
- **Play could bring back a deleted message.** A message deleted while it plays stops, and its script is not played again.
- **The floating player cut off the line being spoken.** The whole line shows now, up to eight lines, and a longer one scrolls inside its box.
- **The open floating player sometimes would not drag on a phone.** Its top bar now takes the drag instead of the page scrolling.
- **Switching tabs moved the drawer back up.** It now stays exactly where you scrolled it.
- **A new group raised a phone's keyboard by itself.** Its name box was selected as soon as it appeared. Nothing is selected now until you tap a box.
- **Copying Debug info could raise a phone's keyboard.** When the browser did not allow the usual way to copy, the box on screen was selected to copy it. A hidden box that cannot be typed in is used instead.
- **The seconds count could put its "s" on a line of its own.**
- **How they speak cut off anything after 300 characters, with no warning.** It now holds up to 1000 characters, and a count under the box shows how many are used. The box stops taking text at the limit, so what you see is what is saved. **Voice direction** and **Their usual way of speaking** have a count too, up to 300 characters.

---

## 1.0.0

_2026-11-21_

First release.

---

[Back to the README](README.md)
