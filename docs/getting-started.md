# Getting started

## In short

- Auto Foley speaks through your ElevenLabs connection in Lumiverse.
- Pick **Eleven v3** or **Eleven v4** as the model, so voice tags work.
- Give each person in the Cast tab a voice.
- Press the boom microphone button on a message.

## Steps

1. **Add an ElevenLabs connection in Lumiverse**, if you do not have one. Open **Connections**, go to the TTS section, and add ElevenLabs with your key.
2. **Pick the model.** On the connection, choose **Eleven v3** or **Eleven v4**. You can also pick a model for each person later, in the Cast tab.
3. **Open the Foley tab** in the drawer. Go to **Settings** and check that **ElevenLabs connection** shows yours.
4. **Press Check my setup** on the Settings tab. It says what is ready and what is missing. It spends no ElevenLabs credits.
5. **Perform a message.** Press the boom microphone button on any message. The first time, the Director reads it, and the Stage tab shows the script.
6. **Give voices.** Open the **Cast** tab. Everyone who spoke is there now. Pick a voice for each, and press **Hear a sample**.

## What happens when you press the button

1. Auto Foley reads the message from Lumiverse.
2. It splits the message into lines. Text in quotes is speech. The rest is narration.
3. If the Decision model is on, it picks who says each quoted line.
4. The Director marks each line with voice tags and sounds.
5. Auto Foley checks that no words changed. A line with changed words is read as written.
6. Each line is spoken through your ElevenLabs connection, with the speaker's voice.
7. Sounds play from your library, or are made by ElevenLabs.

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

- **Anything in square brackets**, such as an out-of-character note. Left in, ElevenLabs would read it as a voice tag.
- **HTML, code blocks and comments.**
- **Text in double parentheses**, such as `((brb))`.

## Playing on its own

On the **Settings** tab:

- **Autoplay new replies** performs each reply when it finishes.
- **Wait before autoplay**, under it, waits a few seconds first. This gives another extension time to change the reply, such as Auto Refine.
- **Prepare replies ahead** directs each reply in the background, with Autoplay off. Play then starts at once.
- **Read your own messages** performs your messages too, with Autoplay on.

A message edited after it was directed is directed again. If it was playing, it starts again with the new text, so what you hear matches what is on screen.

Your browser may block sound until you tap the page. Auto Foley then waits, and the Stage tab says so. Press Play, or the button on the message, to start.

## What it costs

- **ElevenLabs credits** for every line spoken, the same as Lumiverse's own TTS.
- **One call to the Director** for each message. A fast, low-cost model works well. A message played again uses the copy already directed, and asks nothing.
- **One call to the Decision model** for each message, when it is on.
- **ElevenLabs credits for each new sound effect**, when sounds are made as effects. A sound is saved after it is made, so the same sound is free the next time.

## Reporting a problem

1. Open the **Settings** tab and find **Debug info**.
2. Tick what to include, and press **Build preview**.
3. Read the report, and take out anything you do not want to share.
4. Press **Copy**, and paste it into an issue at https://github.com/starlitcode/Lumiverse-Auto-Foley/issues.

About the report:

- People in your cast are named by their role, such as "persona 1", never by name. A Log line that names someone uses the role too.
- No message text is included.
- Nothing leaves your device until you paste it.

**Log to the browser console**, under it, also writes each Log line to the browser's developer console.

---

[Back to the README](../README.md)
