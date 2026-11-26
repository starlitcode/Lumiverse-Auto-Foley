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
- **Pictures for moods**, under it. Optional. A picture for each mood in **Moods for pictures**, for the Studio's videos. See [Pictures for moods](#pictures-for-moods).
  - **Use their Lumiverse picture** takes the picture of the character or persona in Lumiverse with the same name, display name or other name, cut to a square from the middle. If there is none, the card says so.
  - **Use pictures from Lumiverse**, at the top of the Cast tab, does the same for everyone who has no picture yet. A picture already chosen is kept. It says how many it found.
  - Lumiverse's pictures are read the same way the panel reads your chat, so no permission is asked for.
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
- **Voice.** From that connection. Empty uses the connection's own voice. Press **Hear a sample** to compare voices. Each connection keeps its own voice for this person.
- **Or type a voice name or ID.** For a voice the list does not show, such as one you made or cloned, a Gemini voice name, or a voice file on a Chatterbox server. A name or ID that matches a voice in the list picks that voice. Anything else is sent as you typed it. It is saved when you leave the box.
- **Model.** Empty uses the connection's model. The line under it names the engine and what it can do. See [Voice engines](engines.md).
- **Stability.** ElevenLabs only. Lower is more expressive. On Eleven v3 it has three settings: Creative, Natural and Robust.
- **Similarity.** Eleven v4 only. Auto Foley does not send it to Eleven v3.
- **Speed.** Fish Audio, Chatterbox, OmniVoice and Cartesia. ElevenLabs' docs say Eleven v4 takes no speed, and Auto Foley sends none to Eleven v3. Gemini has none either.
- **More settings.** A fold under the voice, with only the settings their engine takes. **Back to defaults** clears them.
- **Language**, in **More settings**, on ElevenLabs and Gemini. Empty, the voice service tells the language of each line from its words. A code, such as `en-US` on Gemini or `en` on ElevenLabs, reads every line in that language.
  - Leave it empty for someone who speaks more than one language. For example, a person who flirts in French and talks in English then has the French lines read as French. With `en-US`, those lines may sound English.
- **Acting notes.** A note for the Director, such as "soft-spoken and dry, rarely raises their voice". It holds up to 1000 characters. See [How much a box holds](#how-much-a-box-holds), and [Writing for each voice engine](writing.md) for what helps on each engine.
- **Do not voice.** Their lines are skipped.
- **Hear a sample** speaks a test line with these settings. It costs a few credits.
- **Remove** takes them out of the cast. The narrator cannot be removed, since it reads everything outside quotes. If it were taken out, it would be added back at once. To skip narration, set **Narration** in the Settings tab to **Skip**.
- The narrator has no **Voice type**. A voice type is only used to pick a voice for someone new, and the narrator uses the connection's voice until you pick one.

## Pictures for moods

A person can have a picture for each mood, for the Studio's videos. A line is shown with the picture for its mood.

### The moods

**Moods for pictures**, at the top of the Cast tab, is one list of moods for the whole cast. It is on the Cast tab since the moods belong to the people and their pictures, not to one video.

Each mood has:

- **Name**, as shown beside each person's pictures.
- **Words that pick it**, one per line, such as `angrily`. They are matched whole, so `flat` does not match `flatter`.

And:

- **Add a mood** adds one at the end. Give it a name and words.
- **Move up** and **Move down** change the order. The order decides a tie.
- **Delete** asks first. Any pictures people have for that mood are taken out with it, from your account too. One mood is always left.
- **Back to built-in** puts the eight built-in moods and their words back. It asks first. Pictures for moods that are not built in are taken out.
- A renamed mood keeps its pictures, since each mood is kept by an id of its own.
- A list can have up to 40 moods, with up to 30 words each.

### A person's pictures

- Open the person and open **Pictures for moods**, under **Picture**. Every mood in the list is there, so a new one can have a picture at once.
- Press **Choose** beside a mood. The same crop box opens as for the main picture.
- **Take it out** asks first. The main picture is used again for that mood.
- Each picture is kept on your account in a file of its own, so the cast stays small.
- **A picture for each mood**, in the Studio under **Show pictures**, turns them on or off for videos.

### How a line's mood is found

1. The words in the line's voice tags, its note on how it is said, and its tags in square brackets are matched against each mood's words.
2. The mood with the most matches is used. On a tie, the one higher in the list is used.
3. With no match, the scene's mood is matched against the words, such as scary or cozy. The first mood that has it is used.
4. With neither, or with no picture for that mood, the main picture is used.

### The built-in list

| Mood | Words |
| --- | --- |
| Happy | happy, happily, cheerful, cheerfully, joyful, delighted, excited, excitedly, elated, laughs, laughing, laughter, chuckles, chuckling, giggles, giggling, grinning, beaming, brightly, warmly |
| Sad | sad, sadly, sorrowful, mournful, tearful, tearfully, crying, cries, sobs, sobbing, sniffles, heartbroken, grieving, choked, despairing, wistful, wistfully |
| Angry | angry, angrily, furious, furiously, enraged, shouts, shouting, yells, yelling, snaps, snapping, snarls, growls, seething, irritated, annoyed, bitter, bitterly, hostile |
| Scared | scared, scary, afraid, frightened, terrified, fearful, fearfully, panicked, panicking, nervous, nervously, trembling, shaky, shakily, gasps, whimpers, anxious, anxiously |
| Calm | calm, calmly, cozy, gentle, gently, soothing, soothingly, steady, steadily, relaxed, peaceful, serene, softly, patient, patiently |
| Playful | playful, playfully, teasing, teasingly, teases, mischievous, mischievously, sly, slyly, cheeky, smirking, smirks, sing-song, singsong, giddy |
| Romantic | romantic, tender, tenderly, loving, lovingly, affectionate, affectionately, sultry, seductive, seductively, breathy, longing, adoring, flirtatious, flirty, intimate |
| Tense | tense, tensely, action, mysterious, urgent, urgently, strained, cold, coldly, flat, flatly, wary, warily, guarded, clipped, curt, curtly, grim, grimly |

The words scary, cozy, action and mysterious are there for the scene's mood. When an update changes the built-in list and you have your own, a notice says so, and your list is not changed.

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

## Finding someone

With a large cast, **Find someone**, at the top of the Cast tab, lists only the people you look for.

1. Type part of a name in the box.
2. Only the people whose name, display name or other names hold what you typed are listed, with how many match.
3. Clear the box to see everyone again, in their groups.

- Capital letters do not matter.
- People cannot be moved while the list shows only some of them.
- What is typed is kept while the page is open, and not saved.

## Group chats

Auto Foley names no character in its prompt and assumes nothing about who plays whom. In a group chat, each message's author joins the cast, and the Director picks speakers from everyone in it.

---

[Back to the README](../README.md)
