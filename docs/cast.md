# The cast

## In short

- Everyone who speaks has a card on the Cast tab: the narrator, your personas, the characters and the NPCs.
- Each has their own voice, model and settings, and can speak through a connection of their own.
- People join the cast three ways: when they write a message, when the Director finds them, or when you add them.
- The **How they speak** note tells the Director how to tag their lines.

## How people join

| How | Marked as | When |
| --- | --- | --- |
| They wrote the message | Character, or Persona for your own messages | The first time one of their messages is performed |
| The Director found them | NPC, with an **Added by AI** badge | **Find new speakers** is on, and someone speaks who is not in the cast |
| You added them | Whatever you pick | You press **Add someone** |

Someone the AI added has no voice picked. The first time they speak, Auto Foley gives them one of your connection's voices that nobody else in the cast uses. It picks one that matches **Voice type** when it can. The Log names the voice, and you can change it.

## A card

- **Picture.** Optional. **Choose a picture** picks one from your device, then a crop box opens. Drag the picture to move it, and use **Zoom**, or the mouse wheel, to zoom in. The circle shows what the round picture shows. **Use this** saves it, made small, with the cast. **Cancel** keeps the picture you had. With none, the first letter of the name is shown. **Take it out** asks first.
- **Name** and **Also called.** Other names the story uses for this person, with commas, such as a first name or a title. The Director and the Decision model match a line to a person by any of these.
- **Who they are.** Character, Persona or NPC.
- **Group.** Shown when you have groups. See [Groups](#groups).
- **Voice type.** Any, Female, Male or Nonbinary. Used to pick a voice for someone new.
- **Connection.** Shown when you have more than one TTS connection. Empty uses Auto Foley's. See [Mixing engines](engines.md#mixing-engines).
- **Voice.** From that connection. Empty uses the connection's own voice. Designed or cloned voices act much better than the stock ones. Each connection keeps its own voice for this person.
- **Or type a voice name or ID.** For a voice the list does not show, such as one you made or cloned, a Gemini voice name, or a voice file on a Chatterbox server. A name or ID that matches a voice in the list picks that voice. Anything else is sent as you typed it. It is saved when you leave the box.
- **Model.** Empty uses the connection's model. The line under it names the engine and what it can do. See [Voice engines](engines.md).
- **Stability.** ElevenLabs only. Lower is more expressive. On Eleven v3 it has three settings: Creative, Natural and Robust.
- **Similarity and Style.** ElevenLabs only. Sent to ElevenLabs as they are.
- **Speed.** Sent to every engine but Gemini, which has no speed.
- **More settings.** A fold under the voice, with only the settings their engine takes. **Back to defaults** clears them.
- **How they speak.** A note for the Director, such as "soft-spoken and dry, rarely raises their voice". It holds up to 1000 characters. See [How much a box holds](#how-much-a-box-holds).
- **Do not voice.** Their lines are skipped.
- **Hear a sample** speaks a test line with these settings. It costs a few credits.
- **Remove** takes them out of the cast. The narrator cannot be removed.

## How much a box holds

Three boxes on a card have a limit:

- **How they speak**: 1000 characters.
- **Voice direction**, for Fish Audio, in **More settings**: 300 characters.
- **Their usual way of speaking**, for Gemini 3.8, in **More settings**: 300 characters.

How it works:

- A count under each box shows how many characters are used, such as "700 of 1000 characters".
- The count turns bold near the limit.
- The box stops taking text at the limit. What you see in the box is what is saved.
- **Expand** has the same limit and count.

Why the limits are there:

- **How they speak** is read only by the Director. It is never sent to the voice engine, so the limit is the same for every model.
- Each time the Director writes a script, it gets the note for every person in the cast. Long notes for a big cast make each script slower to write and cost more.
- **Voice direction** and **Their usual way of speaking** are sent to the voice service with every line that person says, so Auto Foley keeps them short.

## Groups

Groups sort the cast on the Cast tab, such as one group for each story. They change nothing about how anyone sounds.

1. Press **New group**, type its name, and press **Save**.
2. Open a person and pick the group under **Group**.
3. Tap a group's name to open or close it.

- **Rename** changes its name.
- **Delete** asks first. The people in it stay in the cast, outside any group.
- Groups follow your account, and go with the cast in an export and in **Start again**.

## Group chats

Auto Foley names no character in its prompt and assumes nothing about who plays whom. In a group chat, each message's author joins the cast, and the Director picks speakers from everyone in it.

---

[Back to the README](../README.md)
