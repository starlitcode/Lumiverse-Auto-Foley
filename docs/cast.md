# The cast

## In short

- Everyone who speaks has a card on the Cast tab: the narrator, your personas, the characters and the NPCs.
- Each has their own voice, model and settings, and can speak through a connection of their own.
- People join the cast three ways: when they write a message, when the Director finds them, or when you add them.
- **Acting notes** tell the Director how to tag their lines. Only the Director reads them.

## How people join

| How | Marked as | When |
| --- | --- | --- |
| They wrote the message | Character, or Persona for your own messages | The first time one of their messages is performed |
| The Director found them | NPC, with an **Added by AI** badge | **Find new speakers** is on, and someone speaks who is not in the cast |
| You added them | Whatever you pick | You press **Add someone** |

Someone the AI added has no voice picked. The first time they speak, Auto Foley gives them one of your connection's voices that nobody else in the cast uses. It picks one that matches **Voice type** when it can. The Log names the voice, and you can change it.

## A card

- **Picture.** Optional. **Choose a picture** picks one from your device, then a crop box opens. Drag the picture to move it, and use **Zoom**, or the mouse wheel, to zoom in. The circle shows what the round picture shows. **Use this** saves it, made small, with the cast. **Cancel** keeps the picture you had. With none, the first letter of the name is shown. **Take it out** asks first.
- **Display name.** Optional. The name shown on the Cast tab and in the players, such as a nickname. The Director never sees it, and still finds a person's lines by **Name**. The narrator has one too, and the Director still calls them the Narrator.
- **Name** and **Also called.** Other names the story uses for this person, with commas, such as a first name or a title. The Director and the Decision model match a line to a person by any of these.
- **Who they are.** Character, Persona or NPC.
- **Group.** Shown when you have groups. See [Groups](#groups).
- **Voice type.** Used only to pick a voice for someone new.
  - **Any** picks from every voice, with no gender in mind.
  - **Female** and **Male** pick a voice the provider marks that way.
  - **Neutral** picks a voice the provider marks neutral. When there is none, it avoids voices marked female or male. Some providers, such as Gemini, mark every voice female or male, so there Neutral picks the same way as Any.
  - The Director sets **Neutral** for someone new only when the story says they are nonbinary, such as "they" for one person.
- **Connection.** Shown when you have more than one TTS connection. Empty uses Auto Foley's. See [Mixing engines](engines.md#mixing-engines).
- **Voice.** From that connection. Empty uses the connection's own voice. Designed or cloned voices act much better than the stock ones. Each connection keeps its own voice for this person.
- **Or type a voice name or ID.** For a voice the list does not show, such as one you made or cloned, a Gemini voice name, or a voice file on a Chatterbox server. A name or ID that matches a voice in the list picks that voice. Anything else is sent as you typed it. It is saved when you leave the box.
- **Model.** Empty uses the connection's model. The line under it names the engine and what it can do. See [Voice engines](engines.md).
- **Stability.** ElevenLabs only. Lower is more expressive. On Eleven v3 it has three settings: Creative, Natural and Robust.
- **Similarity.** Eleven v4 only. Eleven v3 does not take it.
- **Speed.** Fish Audio and Chatterbox only. ElevenLabs' docs say Eleven v3 and v4 take no speed, and Gemini has none either.
- **More settings.** A fold under the voice, with only the settings their engine takes. **Back to defaults** clears them.
- **Acting notes.** A note for the Director, such as "soft-spoken and dry, rarely raises their voice". It holds up to 1000 characters. See [How much a box holds](#how-much-a-box-holds), and [Writing for each voice engine](writing.md) for what helps on each engine.
- **Do not voice.** Their lines are skipped.
- **Hear a sample** speaks a test line with these settings. It costs a few credits.
- **Remove** takes them out of the cast. The narrator cannot be removed, since it reads everything outside quotes. If it were taken out, it would be added back at once. To skip narration, set **Narration** in the Settings tab to **Skip**.
- The narrator has no **Voice type**. A voice type is only used to pick a voice for someone new, and the narrator uses the connection's voice until you pick one.

## How much a box holds

Three boxes on a card have a limit:

- **Acting notes**: 1000 characters.
- **Fish Audio direction**, in **More settings**: 300 characters.
- **Gemini style**, in **More settings**: 300 characters.

How it works:

- A count under each box shows how many characters are used, such as "700 of 1000 characters".
- The count turns bold near the limit.
- The box stops taking text at the limit. What you see in the box is what is saved.
- **Expand** has the same limit and count.

Why the limits are there:

- **Acting notes** is read only by the Director. It is never sent to the voice engine, so the limit is the same for every model.
- Each time the Director writes a script, it gets the note for every person in the cast. Long notes for a big cast make each script slower to write and cost more.
- **Fish Audio direction** and **Gemini style** are sent to the voice service with every line that person says, so Auto Foley keeps them short.

## Groups

Groups sort the cast on the Cast tab, such as one group for each story. They change nothing about how anyone sounds.

1. Press **New group**. The group editor opens.
2. Type the group's name.
3. Switch on each person who goes in it. A person is in one group at a time, so switching on someone from another group moves them.
4. Press **Save**. **Cancel** closes the editor and changes nothing.
5. Tap a group's name to open or close it.

- **Edit** opens the same editor, to change the name or who is in it.
- You can also open a person and pick their group under **Group**.
- Nothing in the editor is selected when it opens, so a phone keeps its keyboard down until you tap the name box.
- **Delete** asks first. The people in it stay in the cast, outside any group.
- Groups follow your account, and go with the cast in an export and in **Start again**.

## Picking several people

**Select**, next to **New group**, lets you pick several people at once.

1. Press **Select**. A tick box shows beside each person, in place of the dots.
2. Tick the box for each person you want. **Select all** picks everyone, and **Select none** clears it.
3. Press **Put them in it** to put them all in the group picked above it. **No group** takes them out of their groups.
4. Or press **Remove** to take them all out of the cast. It asks first.
5. **Done** ends picking without changing anything.

The narrator has no tick box, since it cannot be removed.

## Sorting and moving people

**Sort the cast**, under **New group**, says how people are listed:

- **By kind**, the first choice: the narrator, your personas, the characters, then the NPCs.
- **A to Z** or **Z to A**, by name.
- **By voice type**: female, male, neutral, then any. Inside each, A to Z.
- **My own order**: the order you dragged them into.

Inside a group, people are sorted the same way. Groups stay in their own order.

To put people in your own order:

1. Hold the six dots on the left of a person or a group.
2. Drag up or down. The others move out of the way.
3. Let go. The new order is kept.

What to know:

- A person moves within their own list: their group, or the people outside any group. To put someone in another group, use **Edit** on the group, or **Group** on the person.
- On a keyboard, tap the dots, then press the up or down arrow key to move one place.
- Near the top or the bottom of the drawer, the drawer scrolls while you hold.
- Dragging someone switches **Sort the cast** to **My own order**. Your order is kept when you pick another way to sort, and comes back when you pick **My own order** again.
- The floating player lists the cast in the same order.
- The order follows your account.

## Group chats

Auto Foley names no character in its prompt and assumes nothing about who plays whom. In a group chat, each message's author joins the cast, and the Director picks speakers from everyone in it.

---

[Back to the README](../README.md)
