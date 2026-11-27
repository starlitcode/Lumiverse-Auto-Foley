# Getting started

## In short

- Auto Foley speaks through a TTS connection in Lumiverse: ElevenLabs, Fish Audio, Gemini, Chatterbox, OmniVoice or Cartesia.
- It works only with a model that acts. [Voice engines](engines.md) lists them.
- Give each person in the Cast tab a voice.
- Press **Play** on the Stage tab to perform the latest reply.

## Steps

1. **Add a TTS connection in Lumiverse**, if you do not have one. Open **Connections**, go to the TTS section, and add one with your key. For Chatterbox on your own computer, see [Chatterbox](engines.md#chatterbox).
2. **Pick the model.** On the connection, choose one that acts: Eleven v3 or v4, Fish Audio S2.1 Pro or Drama 3, Gemini 3.8 Flash TTS, Chatterbox-Turbo, OmniVoice, or Cartesia Sonic 3. You can also pick a model for each person later, in the Cast tab. Only models that act are offered there.
3. **Open the Foley tab** in the drawer. Go to **Settings** and check that **TTS connection** shows yours. The line under it says what its engine can do.
4. **Press Check my setup** on the Settings tab. It says what is ready and what is missing. It speaks nothing, so it spends no voice credits.
5. **Perform a message.** Press **Play** under **Now playing** on the Stage tab. It performs the latest reply. For any other message, turn on **A button on every message** in the Settings tab. The first time, the Director reads it, and the Stage tab shows each part as it plays.
6. **Give voices.** Open the **Cast** tab. Everyone who spoke is there now. Pick a voice for each, and press **Hear a sample**.

## What happens when you press the button

1. Auto Foley reads the message from Lumiverse.
2. It splits the message into lines. By default, text in quotes is speech, and the rest is narration. See [Quoted, asterisked and undecorated text](#quoted-asterisked-and-undecorated-text).
3. If the Decision model is on, it picks who says each quoted line.
4. The Director marks each line with voice tags and sounds.
5. Auto Foley checks that no words changed. A line with changed words is read as written.
6. Each line is fitted to the speaker's engine and spoken through their connection, with their voice.
7. Sounds play from your library, or are found on Freesound or made by ElevenLabs. See [Sounds](sounds.md#where-new-sounds-come-from).

The Stage tab shows each step, with a time that counts up while it waits.

## What is not read aloud

### Thinking

Thinking a model writes in the message is never read aloud. The same nine formats as Auto Retry and Auto Refine are recognized, closed or cut off with no closer.

| Form | Example |
| --- | --- |
| Angle brackets | `<think>` … `</think>` |
| Square brackets | `[thinking]` … `[/thinking]`, and Mistral's `[THINK]` … `[/THINK]` |
| Pipes | `<\|think\|>` … `<\|/think\|>`, and `<\|think>` … `<think\|>` |
| Harmony channels | `<\|channel\|>analysis<\|message\|>` … `<\|end\|>` |
| Gemma 4 channels | `<\|channel>thought` … `<channel\|>` |
| Cohere | `<\|START_THINKING\|>` … `<\|END_THINKING\|>` |
| Seed-OSS | `<seed:think>` … `</seed:think>` |
| Begin and end of thought | `<\|begin_of_thought\|>` … `<\|end_of_thought\|>` |
| Kimi | `◁think▷` … `◁/think▷` |

- The tag names in the first three forms are `think`, `thinking`, `thought`, `thoughts`, `reasoning`, `reflection`, `scratchpad` and `analysis`.
- **Extra thinking tag names**, on the Settings tab, is for a model that uses a tag not listed above. Write only the name, with no brackets or pipes, one per line. It applies to the first three forms.
- A closer with no opener means the opener was in the prompt. Everything before it is thinking.
- A **Prefix** and **Suffix** saved on a connection, in Lumiverse's **Reasoning** settings, are recognized too.

### Everything else left out

- **Anything in square brackets**, such as an out-of-character note. Left in, the voice would read it as a voice tag.
- **HTML, code blocks and comments.** Only the words inside HTML are read. Its code is not, such as the colors and gradients of colored text, however long. A `<style>` block is never read, even one that is not closed.
- **Text in double parentheses**, such as `((brb))`.

### Narration

**Narration**, under **Reading messages** in the Settings tab, says how text read as narration is played: **Read aloud**, the default, **Sounds only**, or **Skip**. Which text is narration is set under [Quoted, asterisked and undecorated text](#quoted-asterisked-and-undecorated-text).

### Trackers and status blocks

**Leave out trackers and status blocks**, in the Settings tab, is on by default. These are not read:

| What | Example |
| --- | --- |
| A table | `\| Mood \| tired \|` |
| A status line: a short label, a colon, and a number | `Time: 11:20 PM` |
| A line that starts with an emoji | `📍 The east dock` |
| A folded block | `<details>` … `</details>` |
| Text in lenticular brackets | `【Day 4】` |
| A line that is only data in braces or square brackets | `{"hp": 30}` |
| A bar of block characters | `Stamina ▓▓▓░░` |

- Each one is a pattern in the box under the switch. Change them, or add your own, one on each line.
- A pattern can be written as `/pattern/flags`. A pattern that could stall Auto Foley, or that matches nothing, is not used, and the box says why.
- **Use defaults** puts the built-in patterns back. It asks first.

## Quoted, asterisked and undecorated text

Auto Foley sorts the text of a message into four kinds. Each kind has a choice under **Reading messages** in the Settings tab. Three of them are the same choices as **Speech detection** in Lumiverse's own Voice settings, but Auto Foley keeps its own, so the two can differ. **Text in parentheses** is Auto Foley's own.

| Setting | Which text | Choices |
| --- | --- | --- |
| **Asterisked text** | Text such as `*she shrugs*` | **Skip**, **Read as narration** (the default), or **Read as thoughts (character voice)** |
| **Text in parentheses** | Text such as `(not that she meant it)` | **Skip**, **Read as narration** (the default), or **Read as thoughts (character voice)** |
| **Quoted text** | Text in quote marks, or after a dash at the start of a line | **Read as speech** (the default), **Read as narration**, or **Skip** |
| **Undecorated text** | Text with no marks around it | **Read as narration** (the default), **Read as speech**, or **Skip** |

- **Read as speech** and **Read as thoughts** use the speaker's own voice. The Director picks who the speaker is.
- **Read as narration** uses the Narrator's voice, and **Narration** says how it is played.
- **Skip** leaves the text out. The Director does not see it either.
- Asterisks and parentheses inside quote marks stay part of what is said, as in `"I *mean* it."`.
- `((Double parentheses))` are always left out. See [What is not read aloud](#what-is-not-read-aloud).
- Text between asterisks read as narration joins the narration beside it, so `She waited. *checks the latch* Nothing moved.` is one line.
- For a story written as `*waves* Hello there.`, set **Undecorated text** to **Read as speech**.
- For a character who says one thing and thinks another, as in `"Sure, I would love to." (Absolutely not.)`, set **Text in parentheses** to **Read as thoughts**. Both lines are then in their voice.

### Emojis

**Send emojis to the voice** is off by default, so emojis in a line are left out. Some voice services read an emoji out by its name. Turn it on if yours acts them well. A music note, such as 🎵, still marks a line as sung either way.

### How speech is marked

**How speech is marked** says which marks count as quote marks.

| Choice | Quote marks |
| --- | --- |
| **Quote marks (Auto)**, the default | `"double"`, `“curly”`, `«guillemets»`, `„low quotes“`, `「corner brackets」`, and a line that starts with a dash |
| **Quote marks, single quotes too** | All of the above, and `'single quotes'`. An apostrophe, as in `don't`, does not count. |

A line that starts with a dash is quoted text up to the next dash, and the undecorated text after that dash runs to the next one or to the end of the line.

## Playing on its own

On the **Settings** tab:

- **Autoplay new replies** performs each reply when it finishes.
- **Wait before autoplay**, under it, waits a few seconds first. This gives another extension time to change the reply, such as Auto Refine.
- **Prepare replies ahead** directs each reply in the background, with Autoplay off. Play then starts at once.
- With **Wait before autoplay** at 0, the default, Autoplay and **Prepare replies ahead** wait until a new reply has gone 1.5 seconds with no change, and at most 10 seconds, before the Director is asked. A Play you press starts at once.
- With Auto Refine on, its word swaps change a reply just after it ends. Auto Foley waits for those, so the Director is asked once, for the words that stay. A full refine takes longer than that wait. When it changes a reply that was already directed, the reply is directed again, which is a second Director call. Set **Wait before autoplay** longer than your refines take to avoid it.
- **Read your own messages** performs your messages too, with Autoplay on.

While a message gets ready, the status says **Getting the script**. It changes to **The Director is writing the script** only when the Director is asked. A message played from its kept script never asks the Director, so it never says that.

**Stop**, pressed while the Director is writing the script, cancels the Director's request. Nothing more is asked or spent on that message, and nothing is kept.

A message edited after it was directed is directed again. If it was playing, it starts again with the new text, so what you hear matches what is on screen.

Your browser may block sound until you tap the page. Auto Foley then waits, and the Stage tab says so. Press Play, or the button on the message, to start.

## Turning it off in one chat

Use this for a chat you want to read in silence while every other chat carries on.

1. Open the chat.
2. Open the **Settings** tab.
3. Under **Auto Foley is on**, find the **This chat** row.
4. Press **Turn off here**.

In that chat:

- Nothing plays or is prepared on its own.
- Its messages have no button and no player.
- The pill at the top of the panel says **Off here**, and the line under the title says Auto Foley is switched off here.
- A press of the floating player or an Extras entry does nothing. The Stage tab says why, or a notification does while the panel is closed.

The button changes to **Turn on here**. Press it to switch Auto Foley back on in that chat.

- The chats switched off are kept on your account, so they follow you to other devices.
- A temporary chat is switched off only while it is open, since the chat itself is not kept.
- **Turn them all back on** switches it on again in every chat. It shows while at least one chat is switched off.
- **Chats you switched off** is a part of your setup file and of **Start again**. A file adds its chats to the ones already switched off. It never switches one back on.

## The floating player

Turn on **A floating player** in the Settings tab, under **Look**. A round button with the Auto Foley symbol sits over the chat.

- **Tap** it to open the player. It opens out of the button, and the arrow at the top closes it back into it.
- **Drag** it to move it.
- **Press and hold** it, or right click it, for the menu. A ring fills round the edge while you hold. When it closes, the menu opens.

**A shadow behind the player**, under **A floating player**, is on by default. It is your theme's own shadow, which sets the open player apart from the chat. Pick a **Color of the shadow**, and set **How dark** and **How soft**, to change it. It changes as you move them. Off shows the player with no shadow.

The button takes your theme's accent color while a message plays. While the Director works on a message, a ring also grows out of its edge and fades, until it is done.

The menu is in three groups, with a line between them:

1. **Open the player** and **Open the Auto Foley tab**.
2. **Perform the latest reply** and **Perform my latest message**. While something plays: **Pause** or **Go on playing**, and **Stop**.
3. **Hide the floating player**.

**More**, at the top of the player, opens the same menu.

In the player:

- **The top** shows the chat.
- **Now playing** shows who is speaking, with their picture or first letter, and which part is playing.
- **On air**, beside it, lights red while a message plays and amber while it is paused. It is dim the rest of the time. The **Now playing** card on the Stage tab has the same light.
- **The box under it** shows the line being spoken, or the sound playing, like a page of a script. The line on its left side has the color of whoever is speaking: slate for the narrator, violet for characters, teal for you, pink for NPCs, and amber for sounds.
- **The buttons**: **Prepare replies ahead** on the left, a switch that lights up while it is on, then back one part, Play or Pause, the next part, and **Stop** on the right. Turning it on also prepares the latest reply at once.
- **The bar** under them moves through the part playing. Drag it to go back or forward in that part.
- **The strip** has a mark for each part of the message: lines, sounds and the cheer. Tap a mark to go to that part.
- **Latest reply** and **My latest message** choose what Play performs when nothing is playing.
- A line divides these from the options under them.
- **Voices** and **Sounds** set the two volumes.
- **Autoplay**, **Sounds**, **Narrator** and **Applause** turn those settings on or off.
- **Who is voiced** lists the cast, like the people in a voice call:
  - The people in the message come first, in the order they speak. The rest of the cast is behind **Everyone else**, with how many there are. With no message yet, everyone is listed.
  - The person speaking has a green ring around their picture, and **Speaking** under their name. The ring fades in and stays for the whole line. It goes while the message is paused.
  - Someone not voiced has a red microphone on their picture, a dimmed picture, and **Not voiced** under their name.
  - Everyone else has nothing extra, and the kind of part they are under their name.
  - The microphone beside a name is the same as **Do not voice** in the Cast tab.
  - The green and red are your theme's own colors for good and bad.
- Where it sits, and whether it is open, are kept in this browser. With reduce motion on, it opens and closes at once, and no ring is drawn.

## Keys to pause and play

On a computer with a keyboard, a message can be paused and played again with keys.

1. Turn on **Keys to pause and play** in the Settings tab, under **Playing**.
2. The keys are Alt+P by default. To pick others, tap the box under **Which keys**, then press the keys you want.
3. While a message plays, press the keys to pause it. Press them again to play it.

What to know:

- The keys need Ctrl, Alt or Cmd, so a key on its own still types as usual. On a Mac, Option is Alt.
- They do nothing while you type in a box, such as the chat's message box.
- They do nothing inside another extension's part of the page.
- They only pause and play what is already playing. They never start a new message, so they never cost anything.
- Escape, while the box waits for keys, keeps the keys you had.

## Playing a message again

With **Keep made audio** on, in the Settings tab:

- Each spoken line is kept in your account, with the message's script: the lines, who says each one, and the tags and sounds the Director added.
- Going back to a chat later, even after closing Lumiverse, and pressing the button plays the kept lines. Nothing is spent on them, and the Log says how many were kept.
- A message is directed once. After that, Play uses its kept script until the message's words change, even after you change a setting, update Auto Foley or restart Lumiverse.
- To direct a message again with your new settings, press **Direct again** on the Stage tab.
- When the Director cannot direct a message, such as when its connection does not answer, the message is read as written, and that is saved too. **Now playing** and **Saved audio** say "read as written", so you can tell it from one the Director wrote. It plays from saved audio after that, and **Direct again** tries the Director.
- With the Director off, a message is read as written and saved the same way. Turn the Director on and press **Direct again** to direct it.
- **Now playing** says when it uses what was saved: "Saved script. The Director was not asked again." and how many lines played from saved audio. The floating player adds "saved" to the part number.
- A line is made again only when something about it changed, such as the voice, the model or the words.
- The last 300 scripts are kept. The oldest go first.
- **Up to 100 MB** is the default. When the total passes it, the oldest lines go first.
- **Clear kept audio**, under it, deletes them all, with their entries in **Saved audio**. It asks first, and says how many entries go.

## The player under a message

**A player under each message**, in the Settings tab, is on by default.

- A message Auto Foley has performed gets a small player under its text.
- It plays the saved script and saved audio, so playing it again spends nothing.
- While it plays, it says which part is playing and how far through the message it is. **Pause** pauses it.
- **Back** and **Next** move one part back or on while the message plays.
- Tap the line to go to that point of the message. In the part playing, it goes to that point in the audio.
- To download a message's saved audio, or make a video of it, use **Open in the Studio** in **Saved audio**.
- It sits where Lumiverse puts its own audio player. It takes the side padding of the message text, and it is centered or to the right when your theme puts the text there.
- It uses your theme's colors and the message's font, unless you pick colors of your own. See [Colors](#colors).
- It shows only on messages that have saved audio, so a new chat has none.
- Lumiverse's own player is only used with **Save the performance to the message** on. It is off by default, and Auto Foley's player does the same job.

## Lit words in the chat

**Light up words in the chat**, in the Settings tab, is on by default.

- The word being spoken is lit in the message itself, as it is said.
- Nothing in the message is changed.
- Some older browsers cannot light words. The audio still plays.

## Colors

The player under a message and the lit word use your theme's colors. You can pick your own in the Settings tab:

- Under **A player under each message**: **Player accent** (the ring around Play and the line that fills), **Player background**, and **Player text and icons**. A small player under them shows the colors as you pick.
- **A shadow behind it**, under the same switch, is on by default. It is your theme's own small shadow. Pick a **Color of the shadow**, and set **How dark** and **How soft**, to change it. Off shows the player with no shadow.
- Under **Light up words in the chat**: **Color of the lit word**, and **How strong it is**, from 10% to 80%. It is 20% by default.
- Under **Colors for each kind of part**, in the **Look** card: a color for the narrator, characters, personas, NPCs, sounds and voice tags. Each kind shows on pictures, on the Stage tab and in the players. **Use the built-in color** goes back to the one Auto Foley starts with. Sounds start with your theme's warning color.

To pick a color:

1. Tap the swatch beside the name. The editor opens under it.
2. Type a color code such as `#ff0040`, or move the **Hue**, **Saturation** and **Lightness** sliders.
3. **Use the theme's color** goes back to your theme.

The colors are saved with your settings, under your account.

## Saved audio

**Saved audio**, a part of the Studio, is a gallery of every message with a saved script.

- Each tile shows its name, the day it was saved, how many lines it has, its first line, and the name its files are saved under.
- **Play** plays the saved audio of its lines, joined. Press it again to stop. Sounds and the cheer are not in it.
- **Open in the Studio** opens the whole performance in the Studio, with its sounds from your library, to download or make a video of. See [Older performances](studio.md#older-performances).
- **More** opens three more things:
  - **Name**: type your own name for it. Downloads and videos of it are saved under that name. Empty uses whose script it is.
  - **Folder**: move it into a folder. Shown once you have a folder.
  - **Delete**: deletes the saved script and the saved audio of its lines. Press it, then press **Tap again to delete**. The next time the message plays, it is directed and spoken again.
- **Find a saved script** lists only the scripts whose name, file name, person or first line hold what you type.
- **Sort**: **Newest first** by default, **Oldest first**, or **By name, A to Z**.
- **New folder** makes a folder. Each folder opens and closes, and shows how many it holds. Type over its name to rename it. **Delete the folder** asks first, and the scripts in it stay, out of any folder.
- Play and Open in the Studio use only audio that is saved, so they spend nothing. A line with no saved audio, such as one spoken with a voice you changed since, is left out, and it says so.
- At most 300 scripts are kept. Past that, the oldest one with no name of yours and no folder goes first, so a script you named or filed stays.
- Its lines are kept by **Keep made audio**, which also has a size, from 50 MB to 500 MB. Past that, the oldest lines go first, even of a named script. Pick a larger size to keep more.
- To delete everything at once, use **Clear kept audio** in the Settings tab. Its entries leave **Saved audio** at once.
- An entry whose lines all went, such as after the oldest lines went to make room, says "The audio for this is gone." **Make it again** directs and speaks the message again, which costs a Director call and voice credits, and works while its chat is open. **Remove it** takes the entry out. Play and Open in the Studio say the same.

## Downloads and videos

Everything to keep what you heard is in the Studio: downloading the audio, a part, or a video. **Open the Studio**, on the drawer's **Studio** tab, opens it, and so does **Download or make a video**, under **Now playing**. For an older message, press **Open in the Studio** on it under **Saved audio**, in the Studio. See [The Studio](studio.md).

For a file in one tap, **Quick shortcuts** on the **Studio** tab has **Download audio** and **Make a video**, with your current look. See [Quick shortcuts](studio.md#quick-shortcuts).

## What it costs

- **Voice credits** for every line spoken, the same as Lumiverse's own TTS. A local engine, such as Chatterbox, costs nothing.
- **One call to the Director** for each message. A fast, low-cost model works well. A message played again uses the copy already directed, and asks nothing.
- **One call to the Decision model** for each message, when it is on.
- **Nothing for a sound found on Freesound.** ElevenLabs credits for each sound it makes. A new sound is saved, so the same sound is free the next time.

## The Log

The Log on the Stage tab says what happened, newest last. Anything that went wrong says why.

- **What the Log shows**, under it, has a switch for each kind of line: playing, what the Director did, voices given and people added, sounds made, settings, and problems. Every kind is shown by default.
- **All** turns every one of those switches on, and **None** turns every one off. The line beside them says how many are on.
- **Copy** copies every line, shown or not. **Clear the log** empties it.

## Even voice levels

Voices from different providers, or different voices on one provider, can be louder or quieter than each other. **Even out voice levels**, in the **Mixer** on the Stage tab, is on by default.

1. Each voice clip is measured while someone speaks. Silence is not counted.
2. Each voice keeps the average of its last six clips, for as long as the page is open.
3. A voice louder than the quietest voice in the message is turned down to match it, by 6 dB at most.
4. The Log says which voice was turned down, and by how much.

A quiet voice is never turned up, since the browser cannot play a clip louder than it is. Sounds and the cheer are not changed. A clip is measured once it is made, which is usually before it plays. A clip that is not measured yet plays as it is.

## Reporting a problem

1. Open the **Settings** tab and find **Debug info**.
2. Tick what to include, and press **Build preview**.
3. Read the report, and take out anything you do not want to share.
4. Press **Copy**, and paste it into an issue at https://github.com/starlitcode/Lumiverse-Auto-Foley/issues.

About the report:

- People in your cast are named by their role, such as "persona 1", never by name. A Log line that names someone uses the role too.
- No message text is included.
- TTS connections are listed by their service and model, never by name.
- Nothing leaves your device until you paste it.


---

[Back to the README](../README.md)
