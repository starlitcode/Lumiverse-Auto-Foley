# Getting started

## In short

- Auto Foley speaks through a TTS connection in Lumiverse: ElevenLabs, Fish Audio, Gemini or Chatterbox.
- It works only with a model that acts. [Voice engines](engines.md) lists them.
- Give each person in the Cast tab a voice.
- Press the Auto Foley button on a message: a pair of headphones.

## Steps

1. **Add a TTS connection in Lumiverse**, if you do not have one. Open **Connections**, go to the TTS section, and add one with your key. For Chatterbox on your own computer, see [Chatterbox](engines.md#chatterbox).
2. **Pick the model.** On the connection, choose one that acts: Eleven v3 or v4, Fish Audio S2.1 Pro or Drama 3, or Gemini 3.8 Flash TTS. Gemini 2.5 and 3.1 TTS act too, with fewer tags. You can also pick a model for each person later, in the Cast tab. Only models that act are offered there.
3. **Open the Foley tab** in the drawer. Go to **Settings** and check that **TTS connection** shows yours. The line under it says what its engine can do.
4. **Press Check my setup** on the Settings tab. It says what is ready and what is missing. It speaks nothing, so it spends no voice credits.
5. **Perform a message.** Press the Auto Foley button on any message. The first time, the Director reads it, and the Stage tab shows each part as it plays.
6. **Give voices.** Open the **Cast** tab. Everyone who spoke is there now. Pick a voice for each, and press **Hear a sample**.

## What happens when you press the button

1. Auto Foley reads the message from Lumiverse.
2. It splits the message into lines. Text in quotes is speech. The rest is narration. See [How speech is marked](#how-speech-is-marked).
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
| Square brackets | `[thinking]` … `[/thinking]`, and `[THINK]` … `[/THINK]` |
| Pipes | `<\|think\|>` … `<\|/think\|>`, and `<\|think>` … `<think\|>` |
| Harmony channels | `<\|channel\|>analysis<\|message\|>` … `<\|end\|>` |
| Gemma 4 channels | `<\|channel>thought` … `<channel\|>` |
| Cohere | `<\|START_THINKING\|>` … `<\|END_THINKING\|>` |
| Seed-OSS | `<seed:think>` … `</seed:think>` |
| Begin and end of thought | `<\|begin_of_thought\|>` … `<\|end_of_thought\|>` |
| Kimi | `◁think▷` … `◁/think▷` |

- The tag names in the first three forms are `think`, `thinking`, `thought`, `thoughts`, `reasoning`, `reflection`, `scratchpad` and `analysis`.
- **Extra thinking tag names**, on the Settings tab, adds more.
- A closer with no opener means the opener was in the prompt. Everything before it is thinking.
- A **Prefix** and **Suffix** saved on a connection, in Lumiverse's **Reasoning** settings, are recognized too.

### Everything else left out

- **Anything in square brackets**, such as an out-of-character note. Left in, the voice would read it as a voice tag.
- **HTML, code blocks and comments.** Only the words inside HTML are read. Its code is not, such as the colors and gradients of colored text, however long. A `<style>` block is never read, even one that is not closed.
- **Text in double parentheses**, such as `((brb))`.

### Narration, speech and actions

Under **Reading messages** in the Settings tab:

- **Narration**: **Read aloud**, the default, **Sounds only**, or **Skip**.
- **Speech**: **Read aloud**, the default, or **Skip**. Skip plays only the narration and the sounds.
- **Text between asterisks**, such as `*she shrugs*`: **Read as narration**, the default, or **Skip**.

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

## How speech is marked

**How speech is marked**, in the Settings tab, says which text is said out loud.

| Choice | Speech |
| --- | --- |
| **Quote marks (Auto)**, the default | `"double"`, `“curly”`, `«guillemets»`, `„low quotes“`, `「corner brackets」`, and a line that starts with a dash |
| **Quote marks, single quotes too** | All of the above, and `'single quotes'`. An apostrophe, as in `don't`, does not count. |
| **Plain text is speech, \*asterisks\* are actions** | Everything outside asterisks. For stories written as `*waves* Hello there.` |

A line that starts with a dash is speech up to the next dash, and the narration after that dash runs to the next one or to the end of the line.

## Playing on its own

On the **Settings** tab:

- **Autoplay new replies** performs each reply when it finishes.
- **Wait before autoplay**, under it, waits a few seconds first. This gives another extension time to change the reply, such as Auto Refine.
- **Prepare replies ahead** directs each reply in the background, with Autoplay off. Play then starts at once.
- **Read your own messages** performs your messages too, with Autoplay on.

**Stop**, pressed while the Director is writing the script, cancels the Director's request. Nothing more is asked or spent on that message, and nothing is kept.

A message edited after it was directed is directed again. If it was playing, it starts again with the new text, so what you hear matches what is on screen.

Your browser may block sound until you tap the page. Auto Foley then waits, and the Stage tab says so. Press Play, or the button on the message, to start.

## The floating player

Turn on **A floating player** in the Settings tab, under **Look**. A round button with the Auto Foley symbol sits over the chat.

- **Tap** it to open the player. It opens out of the button, and the arrow at the top closes it back into it.
- **Drag** it to move it.
- **Press and hold** it, or right click it, for the menu. A ring fills round the edge while you hold. When it closes, the menu opens.

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
- **Who is voiced** lists the cast. The microphone beside a name is the same as **Do not voice** in the Cast tab.
- Where it sits, and whether it is open, are kept in this browser. With reduce motion on, it opens and closes at once, and no ring is drawn.

## Playing a message again

With **Keep made audio** on, in the Settings tab:

- Each spoken line is kept in your account, with the message's script: the lines, who says each one, and the tags and sounds the Director added.
- Going back to a chat later, even after closing Lumiverse, and pressing the button plays the kept lines. Nothing is spent on them, and the Log says how many were kept.
- A message is directed once. After that, Play uses its kept script until the message's words change, even after you change a setting, update Auto Foley or restart Lumiverse.
- To direct a message again with your new settings, press **Direct again** on the Stage tab.
- A line is made again only when something about it changed, such as the voice, the model or the words.
- The last 300 scripts are kept. The oldest go first.
- **Up to 100 MB** is the default. When the total passes it, the oldest lines go first.
- **Clear kept audio**, under it, deletes them all. It asks first.

## Downloads and videos

Three buttons under **Now playing**, on the Stage tab, keep what you heard. None of them spends anything.

- **Download audio** saves the last performance as one WAV file: every line and sound you heard, in order. Parts you skipped are not in it.
- **Download this part** saves the part playing now, as the voice service made it.
- **Make a video** saves a video of the script page: who is speaking, the words lighting up as they are said, the **On air** light, and the strip of parts.

About the video:

1. Press **Make a video** after a message has played.
2. The video is made from the audio you heard, as it plays, so it takes as long as the performance. You do not hear it while it is made.
3. The line under the buttons counts the time. If you go to another tab or app, the video pauses, and it goes on when you come back.
4. The video is saved when it ends. **Stop the video** stops it and saves nothing.

- The video is 1280 by 720, in your theme's colors. Most browsers save it as WebM, and Safari saves it as MP4.
- A browser that cannot make videos says so, and nothing is saved.

## What it costs

- **Voice credits** for every line spoken, the same as Lumiverse's own TTS. A local engine, such as Chatterbox, costs nothing.
- **One call to the Director** for each message. A fast, low-cost model works well. A message played again uses the copy already directed, and asks nothing.
- **One call to the Decision model** for each message, when it is on.
- **Nothing for a sound found on Freesound.** ElevenLabs credits for each sound it makes. A new sound is saved, so the same sound is free the next time.

## The Log

The Log on the Stage tab says what happened, newest last. Anything that went wrong says why.

- **What the Log shows**, under it, has a switch for each kind of line: playing, what the Director did, voices given and people added, sounds made, settings, and problems. Every kind is shown by default.
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
