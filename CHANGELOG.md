# Changelog

## 0.1.0 (not yet released)

### Added

- **The Director.** A second model marks each message with voice tags before it is spoken, and picks who says each quoted line. It never changes a word: a line with changed words is read as written. Its whole prompt can be read and changed on the Director tab.
- **Voice engines.** Auto Foley speaks through ElevenLabs v3 and v4, Fish Audio S2 and Drama 3, Gemini 2.5, 3.1 and 3.8, and Chatterbox-Turbo, the models that act. Each line is fitted to the engine that speaks it, so a tag an engine cannot read is never read aloud. **What this connection runs**, on the Settings tab, names a Chatterbox-Turbo server that is not found by its name.
- **Keep made audio.** Each spoken line is kept in your account, so a message played again, even after you leave the chat or Lumiverse, spends nothing. Up to 100 MB by default, with **Clear kept audio**.
- **Words light up as they are spoken**, timed from the sound of each line, so pauses and breaths do not run them ahead.
- **Notes for each voice engine**, on the Director tab. The note the Director gets on how each engine reads tags can be read and changed, with **Back to built-in**.
- **Warnings for what an engine cannot do.** The Settings tab, the Director tab, the Cast tab and **Check my setup** say when a model cannot act, and which to pick, and when sounds in the voice are on and the engine cannot make them.
- **Singing.** A line someone sings is sung on Eleven v3, Fish Audio, and Gemini 3.8, and spoken on Chatterbox. A music note in the text, such as ♪, marks a line as sung too.
- **The Cast tab.** A voice, model and settings for each person: the narrator, your personas, the characters and the NPCs. People are added when they write a message, when the text names them speaking, when the Director finds them, or by you. A person can speak through a connection of their own, and each connection keeps its own voice for them.
- **A voice for someone the AI added.** The first time they speak, they get one of your connection's voices that nobody else in the cast uses.
- **Sounds in the voice.** With Eleven v3 or v4, the Director can put a `[sound of ...]` tag inside a spoken line, and ElevenLabs performs the sound with the speech. Suggested by a Discord user.
- **Sound effects and a sound library.** Separate sounds before or after a line, with every voice engine. A new sound is found on Freesound, which is free, or made by ElevenLabs, each with a key of your own saved in the Sounds tab. A sound from Freesound shows its credit, and **Find another** swaps it for the next result. Every new sound is saved, so the same sound is free the next time. Your own uploads are used first.
- **The Decision model.** An optional Decision connection picks who says each quoted line, and checks which lines describe a sound. **How sure it must be**, 50% by default, sets when an answer is used. The Log lists every answer, how sure it was, and whether it was used.
- **The Stage tab.** Now playing shows who speaks and the line, word by word, with Back, Play, Next, Stop, a mark for each part of the message to tap, **Make this part again** and **Direct again**. A line read as written says why under it. A mixer for voices and sounds, and a Log.
- **A button on each message** to perform it, and **Autoplay new replies**.
- **Edited replies are directed again.** A reply changed after it was directed, such as one Auto Refine rewrote, is directed again, and one playing starts again with the new text. **Wait before autoplay** gives another extension time to change a reply first.
- **Debug info**, on the Settings tab. Build a report to paste into a bug report. People in the cast are named by their role, and no message text is included.
- **Thinking is never read aloud.** The same nine thinking formats as Auto Retry and Auto Refine are taken out of a message before it is read, with **Extra thinking tag names** for more.
- **Check my setup**, on the Settings tab. It checks the connection and its engine, the Director, the Decision model and the sound keys. It speaks nothing, so it spends no voice credits.
- **Asking again.** A busy provider is waited out, and a Director answer that is empty, refused, in the wrong shape or with changed words is asked for again, with a note that says what went wrong. The notes can be changed on the Director tab.
- **Thinking, samplers and a time limit for the Director**, on the Director tab.
- **Buttons.** A button on every message, one in the chat's row of controls, and entries in the Extras menu, each with its own switch.
- **Applause.** An optional cheering crowd at the end of a message or after a big moment, for the AI's characters, for you, or both. The built-in cheer is a free recording from Pixabay.
- **Export, import and Start again**, on the Settings tab, each with the parts you choose.
- **A description for every setting**, behind a ? button beside it.
- **The look.** A pattern behind the panel and how solid the boxes are, the same as Auto Refine's. The tab bar stays at the top while you scroll.
- **Expand** for every long text box, and **Clear the log** on the Stage tab.
- **Leave out trackers and status blocks.** Tables, status lines, emoji markers, folded blocks and bars are not read. The patterns can be changed in the Settings tab, with **Use defaults**.
- **Speech and Text between asterisks**, beside Narration: read each aloud or skip it.
- **How speech is marked.** Guillemets, low quotes, corner brackets and dash dialogue are read as speech, with single quotes, or plain text with *asterisk* actions, as choices.
- **Speakers found from the text.** A speech verb, a name and a colon, script-style lines, an action in the same paragraph, the same speaker going on, and two people taking turns. The Director is told who it is, or who it likely is.
- **Only sounds the text shows**, on by default. A sound the text around it gives no sign of is left out.
- **Send the prompt as** system, user or assistant, and **the Decision model's questions** can be changed, with **Back to built-in**.
- **Make it again.** **Make this part again** in Now playing makes a new take of the line or sound playing, and **Make it again** in the sound library replaces a made sound. Both ask first, since they cost credits.
- **Warnings for refused permissions**, at the top of every tab, saying what each one stops.
- **Notices when a built-in text or a default changes.** Someone with their own version of a built-in prompt, note, question or pattern is told when an update changes it. Someone on a default that changes is told, and can take it or keep theirs.
- **Buttons that would change nothing say so.** **Back to built-in**, **Use defaults** and **Start again** say when something is already at its default, and ask nothing.
- **Perform my latest message**, in the Extras menu.
- **Tokens for each message**, in Now playing: how many the Director read and wrote, and the cost when the provider sends one.
- **Send the notes as**, for the notes for each engine and the notes sent when asking again.
- **What the Log shows**: a switch for each kind of Log line.
- **A picture for each person**, optional, shown in Now playing and the player. With none, the first letter of the name is shown.
- **Add a sound by link**, in the sound library. It is played from that address.
- **The symbol** is a pair of headphones with sound bars, on the drawer tab and on every Auto Foley button.
- **Cast groups.** Sort the cast on the Cast tab into groups you name, open and close.
- **A floating player.** A round button over the chat opens a small player, out of the button: who is speaking, the line, Play and the buttons around it, a bar through the part playing, a mark for each part, the volumes, quick switches, and who is voiced. Press and hold it, or right click it, for a menu in groups. It looks and holds like the floating buttons of Auto Retry and Auto Refine.
