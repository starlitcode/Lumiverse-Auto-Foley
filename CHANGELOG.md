# Changelog

Every released version of Auto Foley, newest first.

Versions follow [Semantic Versioning](https://semver.org). A new major version means a reinstall rather than an update, a minor version adds something, and a patch version only fixes things.

---

## 1.1.0

_Not yet released_

### Added

- **More vocal sounds for Gemini 3.8**: moan, growl, grunt, hiss, scream, shout, shriek, cheer and phew, from Google's own list.
- **A warning for Gemini 2.5 and 3.1.** Google shuts those TTS models down on December 18, 2026. The panel says so, and names Gemini 3.8 as the model to use.
- **Saved audio**, on the Stage tab. It lists every message with a saved script, newest first, with whose script it is, the day and its first line. **Play**, **Download** and **Delete** are on each row. Play and Download use only saved audio, so nothing is spent.
- **A player under each message**, on by default. A message Auto Foley has performed gets a small player under its text, where Lumiverse puts its own. It has Back, Play, Next and Download, and a line you tap to go to any point. It says which part is playing, and plays the saved audio again with nothing spent. It follows your theme: its colors, the message font, and the side and alignment of the message text, centered too.
- **Voice price, per million characters**, in the Settings tab. Now playing says how many characters were sent to the voice service for new audio, and with a price set, what it cost. Saved audio adds nothing.
- **Second Director**, on the Director tab. When the Director refuses or sends back nothing usable, a second connection you pick is asked. If it fails too, the message is read as written.
- **Saved scripts and saved audio are named on screen.** Now playing says "Saved script" when the Director was not asked again, and how many lines played from saved audio. The floating player adds "saved" to the part number.
- **Input price and Output price, per million tokens**, in the Director tab, the same as in Auto Refine and Auto Retry. Now playing says how many input and output tokens the script used, and with a price set, what it cost. Paste your provider's whole price line if you like.
- **A guide to writing for each voice engine**, on GitHub. It says what to write in **How they speak** and the notes for ElevenLabs, Fish Audio, Gemini and Chatterbox, with one example followed through every engine.
- **A Contributing page**, on GitHub, with what to put in a bug report and how to build the debug report.
- **Downloads and videos**, under **Now playing** on the Stage tab. **Download audio** saves the last performance as one WAV file, **Download this part** saves the part playing, and **Make a video** saves a video of the script page with the words lighting up as they are said. Nothing is spent on any of them.
- **Play from the drawer.** Play in Now playing, on the Stage tab, performs the latest reply or your latest message when nothing is playing. The same choice as in the floating player sits under it.
- **Light up words in the chat**, on the Settings tab, on by default. The word being spoken is lit in the message itself, as it is said. Nothing in the message is changed.
- **Type a voice name or ID**, in the Cast tab, for a voice the list does not show, such as one you made or cloned, a Gemini voice name, or a voice file on a Chatterbox server. A name or ID that matches a voice in the list picks that voice.
- **More settings for each engine**, in the Cast tab, under each person's voice. Only the settings their engine takes are shown: language for ElevenLabs, voice direction, temperature, top P and steady loudness for Fish Audio, temperature, language and a usual way of speaking for Gemini, and exaggeration, CFG weight, temperature and seed for Chatterbox. **Back to defaults** clears them.
- **A Chatterbox server, without a Lumiverse connection**, in the Settings tab. Auto Foley talks to a Chatterbox-TTS-Server itself, listed as **Chatterbox server (direct)**, so its own settings reach it. **Save and test** says which model it runs and how many voices it has.
- **Speed in each engine's own range**: 0.5 to 2 for Fish Audio and Chatterbox.
- **How they speak says what helps on each engine.** The line under the box changes with the engine the person speaks through.
- **Neutral**, as a voice type in the Cast tab. A voice the provider marks neutral is picked when there is one. The Director sets it for someone new only when the story says they are nonbinary.
- **Main characters and minor ones.** The Director says which a new speaker is, and the Cast tab files a main one as a character and a minor one as an NPC.
- **Crop a cast picture.** After you choose a picture, drag it and zoom so the circle frames the face, then press **Use this**.
- **The Decision model's next two choices.** **What the Decision model answered**, in the Log, now also lists the next two people it considered for each quote, with their chances, so you can see how close the call was.
- **Back to defaults for the mixer.** It sets voices to 100% and sounds to 80%, unmutes both, and turns on **Even out voice levels**.
- **Even out voice levels**, in the Mixer on the Stage tab, on by default. A voice louder than the quietest voice in the message is turned down to match it, by 6 dB at most. The Log says which voice was turned down.
- **Gemini through OpenRouter.** An OpenRouter TTS connection running a Gemini TTS model, such as google/gemini-3.8-flash-tts, can be picked and is used the same as Gemini. Reported by a Discord user.
- **TTS connections in Debug info.** It lists the service and model of every TTS connection Lumiverse sent, and whether Auto Foley can use each one. It never lists their names. Reported by a Discord user.

### Changed

- **ElevenLabs shows only the settings Eleven v3 and v4 take.** ElevenLabs' docs say v3 takes Stability only, and v4 Stability and Similarity. **Style**, **Speed** and **Speaker boost** are gone for them, and Similarity shows on Eleven v4 only. They did nothing on these models.
- **A message the Director could not direct is saved, read as written.** Before, nothing was saved, so every play asked the Director again and it did not show in Saved audio. Now it plays from saved audio, and **Now playing** and **Saved audio** say "read as written" and why. **Direct again** tries the Director. A script saved with the Director off says so too.
- **A sound with nothing to play no longer pops up a warning.** Without a Freesound or ElevenLabs key, a sound missing from your library warned on every play. It is now said once in the Log, and the message plays on without it.
- **Start here says what to do first, with a button for each step.** **Check my setup** goes to the Settings tab and runs the check, **Open the Cast tab** goes to the cast, and it says to press Play under **Now playing**, since the buttons on messages now start off.
- **No scroll bar at the side of the drawer.** Lumiverse's scroll bar popped up at the side when an open card made the tab longer than the drawer. It is hidden while the Auto Foley tab is open, and the drawer still scrolls. Other tabs keep theirs.
- **Buttons are off by default.** **A button on every message**, **A button in the chat's row of controls** and **In the Extras menu** start off. If you were on the old setting, a notice on every tab says so, with **Take it** and **Keep mine**.
- **Notes for each voice engine** shows the engine in use first and open again. Every other engine has a fold of its own.
- **The floating player's quick switches** flip only when the switch itself is pressed, the same as every other switch.
- **The moving bars** next to the speaker in the floating player are gone.
- **A color for each kind of part.** The narrator is slate, characters violet, you teal, NPCs pink, sounds amber and voice tags blue, on the pictures, the marks for each part and the tags in Now playing. The colors are the same in every theme.
- **Warnings that fit the engine.** The Director tab says when Big moments change only the audience on an engine other than ElevenLabs, and when an engine cannot sing.
- **A new look for the players.** The floating player and **Now playing** on the Stage tab show the line like a page of a script, with a line on its left side in the color of whoever is speaking. An **On air** light shows red while a message plays and amber while it is paused. A thin striped band runs along the top of each player.
- **Groups have an editor.** **New group** and **Edit** open it, with the group's name and a switch for each person in the cast, so you can pick everyone in a group in one place. **Save** keeps it and **Cancel** changes nothing. **Edit** takes the place of **Rename**.
- **Scripts.** The panel calls what the Director makes from a message its script, such as **Kept audio and scripts** in **Start again**. While a message gets ready, the status says "Getting the script", and "The Director is writing the script" only once the Director is asked. A message played from its kept script never says the Director is writing. **Now playing** and the floating player name what plays as a script, such as "Tamsin’s script".
- **The Director's built-in prompt** says what each kind of person in the cast is, and to mark a big moment only while **Big moments** is on. If you use a prompt of your own, a notice says the built-in one has changed.
- **Fish Audio tags are repeated for each sentence.** Fish Audio reads a tag for how the words are said best at the start of the sentence it is for. On a line of several sentences, that tag now goes again at the start of each sentence that has none of its own, so the last sentence is said the same way as the first. Sounds and pauses are not repeated.

### Fixed

- **A name at the top of a message could be lit instead of the text.** **Light up words in the chat** looked through the whole message, name and all, so a message that started with the speaker's name lit the name. It now looks only at the message text, in both chat modes.
- **A line Gemini sent back with no audio waited 15 seconds or more.** Gemini's preview models now and then answer with no audio, and the line was waited out as if the service were busy. It is asked for again after a moment, and the Log says so.
- **A new person's lines could be made again on the next play, in two voices.** Lines are made ahead, several at once. Two lines of someone new each picked a voice, so the lines had different voices, and a line spoken before the person joined the cast used the connection's voice. On the next play, those lines did not match and were made, and paid for, again. Now one voice is picked for each new person, and every line waits for it.
- **The Director's tokens were counted with the tokenizer of your main connection.** When the provider sends no count, Lumiverse counts them, and it now counts for the Director's own model. Auto Refine does the same.
- **Stop did not stop the Director.** Pressed while the script was being written, Stop only stopped the panel waiting. The Director's request went on, and could be asked again. Stop now cancels the request in Lumiverse, and nothing more is asked or kept for that message.
- **Reduce motion could stop another extension's motion.** It matched any part of the page whose name held af- inside a word, such as leaf-. It now matches only Auto Foley's own parts.
- **The notice that a built-in text changed could run off the side of a phone.** Its button now sits under the words, inside the notice.
- **"You have no TTS connection Auto Foley can use" did not say what it found.** It now says whether Lumiverse found no TTS connection on your account, or names the ones it found and their service. It also tells you that a key added under the LLM tab is not a TTS connection. Reported by a Discord user.
- **Other accounts saw no connections to pick, with no reason given.** Lumiverse refuses an extension installed as Personal for every account but the one that installed it. The panel now says so, and that it has to be installed as Operator, under Extensions, for every account to use it.
- **Sounds made with Both warned on every engine but ElevenLabs.** Both plays every sound as an effect on those engines, so only In the voice warns now.
- **A new speaker on Gemini got a voice of any gender.** Gemini lists its voices as masculine and feminine, which did not match. Every way a provider writes gender is understood now.
- **Only minor characters got a voice picked for them.** Anyone new but the narrator gets one now. The pick also matches words in how they sound, such as gravelly or young, to each voice's own description.
- **Now playing lost its place after you came back to the Lumiverse tab.** It now picks up from where the audio really is.
- **A message button could perform the wrong message.** After a delete, Lumiverse can show another message in the same row, and the button there still performed the message that was deleted, with its kept audio. A button now performs the message its row shows when it is pressed.
- **Play could bring back a deleted message.** A message deleted while it plays stops, and its script is not played again.
- **The floating player cut off the line being spoken.** The whole line shows now, up to eight lines, and a longer one scrolls inside its box.
- **The open floating player sometimes would not drag on a phone.** Its top bar now takes the drag instead of the page scrolling.
- **Switching tabs moved the drawer back up.** It now stays exactly where you scrolled it.
- **A new group raised a phone's keyboard by itself.** Its name box was selected as soon as it appeared. Nothing is selected now until you tap a box.
- **Copying Debug info could raise a phone's keyboard.** When the browser did not allow the usual way to copy, the box on screen was selected to copy it. A hidden box that cannot be typed in is used instead.
- **Opening the floating player from low on the screen moved it to the top.** The player now opens upward from the button when the button is low, and to the left when it is on the right. Closing it puts the button back where it was. If you drag the open player, the button stays where you dragged it.
- **The settings under Let it think first and Pattern behind the panel appeared in one step.** **How much thinking** and **How solid the boxes are** now open and close smoothly, the same as the settings under a switch.
- **Playing a message again could direct it again and make its audio again.** A script was kept under the settings and the cast as they were, so a new person in the cast, a changed setting or an update meant the script was not found. A script is now found by the message itself: which one, which swipe, its words and the engine. A message is directed once, and Play uses its kept script until its words change. **Direct again** directs it with your settings as they are now. Scripts kept before this are found too. The last 300 scripts are kept, up from 40.
- **{{user}} and {{char}} were read aloud as written.** A message that holds Lumiverse's name macros is now filled in the same way the chat shows it, before the Director reads it, so the voice says the names.
- **Switching tabs flickered.** The highlight faded from one tab to the next, so for a moment two tabs looked picked. The tab you press is now marked at once.
- **The seconds count could put its "s" on a line of its own.**
- **How they speak cut off anything after 300 characters, with no warning.** It now holds up to 1000 characters, and a count under the box shows how many are used. The box stops taking text at the limit, so what you see is what is saved. **Voice direction** and **Their usual way of speaking** have a count too, up to 300 characters.

---

## 1.0.0

_2026-11-21_

First release.

---

[Back to the README](README.md)
