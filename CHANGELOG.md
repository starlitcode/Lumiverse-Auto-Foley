# Changelog

Every released version of Auto Foley, newest first.

Versions follow [Semantic Versioning](https://semver.org). A new major version means a reinstall rather than an update, a minor version adds something, and a patch version only fixes things.

---

## 1.10.0

_2026-11-26_

### Added

- **Scene music**, in the Sounds tab. Off by default. Music for the mood of the scene plays at a low volume under the voices and sounds. The Director picks the mood from ten, such as calm, tense or romantic, and changes it where the scene turns. The music fades from one track to the next, goes down while someone speaks, pauses with the performance, and fades out at the end. See [Scene music](docs/music.md). Suggested by a Discord user.
- **Music for**, on each sound in your library, marks it as a music track for one mood. A track is never played as a sound effect. With no track for a mood, one can be found on Freesound with your key, and kept in your library with its credit. **Where music comes from** can keep it to your library. Suggested by a Discord user.
- **Music** volume, in the Mixer and the floating player, while Scene music is on. Suggested by a Discord user.
- **Music**, under **The performance** in the Studio. On by default. The audio and the video keep the scene music that played, with the same fades. Suggested by a Discord user.

- **Full screen**, beside **Play the preview** in the Studio. The preview fills the page in its own shape, with its own play button, bar and close button. It fades in and out, and Escape closes it.
- **Fit the wait to the model**, under **Give up waiting after** on the Director tab. On by default. A Director on your own computer or network gets five times as long, and high thinking two or three times, so a slow model is not stopped too early. The Log says when it waits longer. See [How long it waits](docs/director.md#how-long-it-waits).
- **Getting an MP3**, a link in the Studio's **Audio** card to the guide on GitHub, which says how to turn the WAV into an MP3 on a computer or a phone. It opens in a new tab.
- **Color of the captions**, under **Show sounds as captions** in the Studio. Sound captions can have a color of their own, such as yellow. It is the color of the words until one is picked, and it is part of a saved look.
- **Fade in as they are said** and **Blur in as they are said**, under **How the words show** in the Studio. Each word fades in as it is said, or fades in from a blur, over about a third of a second.
- **Your own fonts** in the Studio. **Add a font**, under **Font**, adds a TTF, OTF, WOFF or WOFF2 file of up to 3 MB, and says which files work and that the font's license must allow your videos. It is kept on your account and listed under **Your fonts**, with a line drawn in it. **Take this font out** asks first. See [Your own fonts](docs/studio.md#your-own-fonts).
- **Font of the names** and **Size of the names, in percent**, under **Show names** in the Studio. The names can have their own font and size, apart from the words and the pictures.
- **A ring around each picture**, under **Show pictures** in the Studio. On by default. Off shows each picture with no ring. **How thick the ring is**, under it, is 3 by default, from 1 to 20.
- **A design of your own**, a new **Background** in the Studio. Add rectangles, rounded rectangles, ellipses, triangles, lines and text boxes over a color, and drag, size and turn them on the preview, or type exact numbers. Each has its own color, an optional gradient, and how see-through it is. See [A design of your own](docs/studio.md#a-design-of-your-own).
- **A background for each scene** in the Studio. Add backgrounds under **Background**, and say which scenes each is for under **Use it for**: some moods, some place words, or only scenes you pick it for. With two or more backgrounds, the Director marks where each scene starts, in the call it already makes. **Scenes**, under **The performance**, lists them, with a background for each, and ways to start or join a scene. Changes are kept with the performance in **Saved audio**. One background fades into the next over about a second. A saved look keeps the one background in use, and **Use** puts it into your list without changing the others. See [Scenes and their backgrounds](docs/studio.md#scenes-and-their-backgrounds).
- **A slow move on the picture**, under **A picture of your own** in the Studio. On by default. A picture background makes one slow move in each scene, at most 2% of the frame a second, so it looks still at a glance. Reduce motion holds it still on screen.
- **Two speakers on screen**, under **Show pictures** in the Studio. On by default. When two people take turns in a scene, both pictures show side by side, with the one speaking at full strength. A third person, or a new scene, goes back to one picture. A person on screen in both lines moves to their new place. See [Two speakers and mood pictures](docs/studio.md#two-speakers-and-mood-pictures).
- **Pictures for moods**, on the Cast tab, and **A picture for each mood** in the Studio. A person can have a picture for each mood, and a video shows the one that fits the line, from its voice tags, or else the mood of the scene. No model is asked. **Moods for pictures**, at the top of the Cast tab, is one list for the whole cast: eight built-in moods to start, each with the words that pick it. You can add your own, rename one, change its words, move it up or down, or delete it, and **Back to built-in** puts the list back. See [Pictures for moods](docs/cast.md#pictures-for-moods).
- **A shadow behind the words** and **A shadow behind the names** in the Studio, each with its own color, darkness, softness and distance. Both start as the shadow the words always had.
- **A shadow behind the player**, under **A floating player** in the Settings tab. On by default, your theme's own shadow, with a color, darkness and softness of your own.
- **An example clip** in the Studio's preview. With no performance, the preview shows a short silent clip with two made-up people, a sound caption, two scenes and a title, so each part of the look can be seen and changed before playing anything. With a performance, **Show in the preview** picks it or the example. The example is never saved. See [The example clip](docs/studio.md#the-example-clip).
- **Gradients** in the Studio, for the words, the names, the sound captions, **A color of your own** and each shape in a design. **Fill** picks one color, a linear gradient in one of four directions, or a radial gradient from the middle out, through two to six colors. On text, a gradient runs across each whole line or name. See [Gradients](docs/studio.md#gradients).
- **A shadow behind the player under each message**, as **A shadow behind it** under **A player under each message**. On by default, your theme's own small shadow, with a color, darkness and softness of your own.

### Changed

- **Autoplay and Prepare replies ahead wait for a new reply to settle.** With **Wait before autoplay** at 0, a new reply is directed once it has gone 1.5 seconds with no change, and at most 10 seconds after it ends. An extension that changes a reply just after it ends, such as Auto Refine's word swaps, then costs one Director call, not two. A Play you press starts at once.
- **Size, in percent** in the Studio is now **Size of the words, in percent**, since the names and the pictures have sizes of their own.
- **Send a note when it asks again is off by default**, the same as in Auto Refine. A note makes the Director's next ask longer, which costs more. If you were on the old default, a notice says so, and you can take the new one or keep yours.
- **Freesound licenses is CC0 and CC BY by default.** It was all three, which takes in CC BY-NC, a license for non-commercial use only. A video made in the Studio may be posted where money is made. If you were on the old default, a notice says so. Sounds already in your library stay.
- **No sound effects are asked for when they cannot play.** With no sound effects in your library, and no Freesound or ElevenLabs key saved or **Get new sounds** off, the Director is not asked for them, so no tokens go on them. The Log says why.
- **The Director's built-in prompt has a part on scenes.** It is only used while you have two or more backgrounds.
- **The Director's built-in prompt has a part on music.** It says how to pick a mood and when to change it, and it is only used while Scene music is on. If you have your own prompt, a notice says the built-in one changed. Suggested by a Discord user.

### Fixed

- **Fade and rise left a moment with nothing on screen.** The line faded out fully before the next began to fade in, so between two lines the words were gone for a moment. The two now fade at the same time.
- **Prepare replies ahead kept directing after it was turned off.** The reply being prepared was still directed, which costs a Director call, and the player kept saying Directing it ahead. Turning it off now stops it, and the player says Prepare replies ahead is off. Pressing the button now says whether it is on or off, since a phone shows no hover text.
- **Scrolling the floating player moved it instead.** With Who is voiced open on a small screen, a swipe in the player dragged the whole player. A swipe below its top row now scrolls it, and the top row still moves it.
- **A saved line could be paid for twice.** Reading a line from **Keep made audio** gave up after 5 seconds, then the line was made again. On a slow server, the read now gets 15 seconds, the same as other reads.
- **The message for no usable TTS connection left out services.** It now names Cartesia, OpenRouter and OpenVox too.
- **Check for the Director kept running on a connection that never answered.** The panel stopped waiting after 150 seconds, but the check itself went on in the background with no limit. It now stops after the same wait as the Director.
- **The shadow of the player under each message was cut off at the player's edge.** The player had your theme's small shadow, but its edge hid it. The shadow now shows in full.
- **A note said Speech detection is only Lumiverse's.** Under **How Auto Foley works with Lumiverse’s own voice settings**, in the Settings tab, it said Auto Foley uses the Cast tab and the Mixer instead. It now says Auto Foley has the same choices under **Reading messages**.

---

## 1.9.0

_2026-11-26_

### Added

- **Asterisked text, Quoted text and Undecorated text**, under **Reading messages** in the Settings tab. They have the same choices as **Speech detection** in Lumiverse's own Voice settings, set for Auto Foley alone. See [Quoted, asterisked and undecorated text](docs/getting-started.md#quoted-asterisked-and-undecorated-text).
  - **Asterisked text** can be **Read as thoughts (character voice)**, in the speaker's own voice.
  - **Quoted text** can be **Read as narration**, in the Narrator's voice.
  - **Undecorated text** can be **Read as speech**, or skipped.
- **Text in parentheses**, under **Reading messages**: **Skip**, **Read as narration**, the default, or **Read as thoughts (character voice)**. Thoughts suit a character who says one thing and thinks another. `((Double parentheses))` are still always left out.
- **Send emojis to the voice**, under **Reading messages**. Off by default. On, emojis in a line are sent to the voice service, for one that acts them well.

### Changed

- **Speech and Text between asterisks are now Quoted text and Asterisked text.** **Plain text is speech, \*asterisks\* are actions**, under **How speech is marked**, is now **Undecorated text** set to **Read as speech**. Your choices carry over. **How speech is marked** now only says which quote marks count.
- **Quoted text set to Skip leaves it out before the Director reads the message.** Before, the Director still directed it, and it was only not played.
- **Delete on a saved script asks in a confirmation**, the same as the rest of the panel, instead of asking for a second tap.

### Fixed

- **Emojis in a line were sent to the voice.** Only a line that starts with an emoji was left out, so an emoji in the middle of a line went to the voice service, which could read it out by its name. Emojis are now left out, unless **Send emojis to the voice** is on.
- **A person put in a folded group seemed to close.** Picking a group for someone on the Cast tab moved their card into that group at once, and a folded group hid it. The group now opens, and the card fades out and back in at its new place, still open, with the panel scrolled to it.

---

## 1.8.2

_2026-11-26_

### Fixed

- **Make a video could not go on after you left the tab.** On some phones, the sound does not start again by itself, so the video stayed stuck when you came back. It now goes on by itself where it can. Where it cannot, **Play the preview** becomes **Go on with the video**, and one press carries it on.
- **The preview could get stuck after you left the tab.** It now stops where it is, and **Play the preview** goes on from there.
- **The Language hint did not say what to do for someone who speaks two languages.** Under **More settings** on ElevenLabs and Gemini, it now says to leave **Language** empty, so each line is read in its own language. A code reads every line in that one language.
- **A person's label did not follow Who they are.** In the Cast tab, changing **Who they are**, such as from NPC to Character, left the old label beside their name until the tab was drawn again. It now changes at once.

---

## 1.8.1

_2026-11-26_

### Fixed

- **The Director was pointed at the wrong Cartesia feelings.** Its note said the first six feelings on Cartesia's list work best, but that list starts with laughter, neutral, happy, excited, enthusiastic and elated. It now names the six Cartesia's docs say work best: neutral, calm, angry, content, sad and scared. It also picks only a feeling the words already carry, as Cartesia's docs advise.
- **The Director's note for Fish Audio said something Fish's docs do not.** It said a Fish tag keeps going until the next one. It now says how Auto Foley sends each sentence: with the last feeling tagged before it. It also says never to put two feelings that pull against each other in one sentence, as Fish's docs advise.
- **The Director's note for ElevenLabs named only v3.** The same note is used for Eleven v4, and now says so.
- **Exaggeration and CFG weight said they work on Chatterbox-Turbo.** Resemble AI's Turbo code ignores both. Their hints now say they work only on the original Chatterbox model.
- **The Voice hint said designed or cloned voices always act better.** ElevenLabs says a designed voice may be less expressive on Eleven v4. The hint now says to compare voices with **Hear a sample**.
- **Drama 3 on Fish Audio played S2.1 Pro instead.** Lumiverse asks Fish for `drama-3-preview`, a name Fish does not know, and Fish then uses S2.1 Pro without an error. Auto Foley now asks for `drama-3`, the name in Fish's docs, and puts **Fish Audio direction** at the start of each line, since Lumiverse does not add it for that name. Lines kept from before were made with S2.1 Pro, so they are made again once.
- **Cartesia's hint named an older model.** It now names `sonic-3.6`, Cartesia's current model.

### Changed

- **The writing guide on GitHub covers every engine more closely.** It explains how to write a Gemini Voice Design description, what ElevenLabs says about custom voices, and how long a clip to clone from should be on Fish Audio, Chatterbox-Turbo, OmniVoice and OpenVox. It also says where Lumiverse puts **Fish Audio direction**.
- **The docs on GitHub list the right settings for each engine.** ElevenLabs is sent stability, and similarity on Eleven v4. Speed works on Fish Audio, Chatterbox, OmniVoice and Cartesia.

---

## 1.8.0

_2026-11-25_

### Added

- **Auto Foley can be switched off in one chat**, the same as Auto Retry and Auto Refine. In the Settings tab, under **Auto Foley is on**, the **This chat** row has **Turn off here**. In that chat nothing plays or is prepared on its own, and its messages have no button and no player. Every other chat carries on. The pill at the top of the panel says **Off here**. The chats switched off are kept on your account, and **Turn them all back on** switches it on again everywhere. A temporary chat is switched off only while it is open.
- **Chats you switched off** is a new part of your setup file and of **Start again**. It is chosen for a new install. If you set up Auto Foley before 1.8.0, tick it under each list to include it.
- **Pictures from Lumiverse for the cast.** **Use pictures from Lumiverse**, at the top of the Cast tab, gives everyone with no picture the picture of their character or persona in Lumiverse, found by name. **Use their Lumiverse picture**, on a card, does it for one person. A picture already chosen is kept. No new permission is asked for.
- **Saved looks**, in the Studio's **Video** card. **Save this look** keeps the look of a video under a name, and **Use** puts it back. Up to 20, saved to your account.
- **Find someone**, in the Cast tab, for a large cast. Typing part of a name lists only the people whose name, display name or other names hold it, with how many match.
- **All and None over the switches in What the Log shows**, the same as Auto Refine. All turns every kind of line on, and None turns every one off. A line beside them says how many are on.
- **The Studio**, a new tab for keeping a performance as audio or as a video. A preview shows the video with your choices, and can be moved through or played. See [The Studio](docs/studio.md).
  - **The performance**: pick which parts go in, with **All** and **None**, and trim where it starts and ends, typed in seconds or set from the preview with **Start here** and **End here**. Add a pause between parts, leave out the sound effects, keep the volumes as you heard them, and even out the loudness.
  - **Audio**: save one WAV file, or a ZIP with a WAV for each part.
  - **Video**: pick the shape (wide, tall for phones, or square), the font, size and color of the words, how the words show, where they sit, and quotation marks. Pick whether names and pictures show, the shape and size of the pictures, and the color of the names. Pick a dark background, a color of your own, or a picture of your own with dim and blur, and how dark the edges are and in what color, or no dark edges. Pick one of nine transitions between lines and how long it takes, the title at the start, the fade at the end, and captions for sounds. Add up to 10 notes for whoever watches, at the top or the bottom, for the whole video, at the start, at the end, or from a time. Notes are saved to your account. **Put the look back** asks first, then puts back the built-in look.
  - **Hide and bleep words**: words you list are covered with a black bar, blur or pixels in the video, and bleeped in the audio. **Add the cast's names** fills the list.
  - **Show names** off leaves names out of the video, its title, and the name of every file saved.
- **Open in the Studio**, on each entry in **Saved audio**, opens an older performance in the Studio from saved audio and your sound library. Nothing is spoken again, found or made, so nothing is spent.

### Changed

- **Saved audio moved to the top of the Studio tab, as a gallery.** It was on the Stage tab. Each saved script is a tile with its name and the name its files are saved under. **More** on a tile renames it, moves it to a folder, or deletes it. **New folder**, **Find a saved script** and **Sort** keep a long list in order. A script you named or put in a folder is kept past the 300 newest.
- **Downloads are all in the Studio tab.** Under **Now playing** on the Stage tab, **Download audio**, **Download this part** and **Make a video** are now one button, **Download or make a video**, which opens the Studio. In **Saved audio**, **Download** is now **Open in the Studio**, which opens the whole performance, with its sounds, in the Studio, where it can be downloaded.
- **Who is voiced, in the floating player, looks like a voice call.** The person speaking has a green ring around their picture and **Speaking** under their name, for as long as their line plays. Someone not voiced has a red microphone on their picture and **Not voiced** under their name. Everyone else shows the kind of part they are. The people in the message come first, in the order they speak, and the rest of the cast is behind **Everyone else**, so a large cast is not one long list.
- **Make a video looks like a story being read.** It opens with the chat's name and fades to black at the end. Each line is large in the middle of the screen, with the words lighting up as they are said. Speech is in quotation marks, with the speaker's picture and name above it, and a sound is a caption in square brackets. The On air light, the stripe and the strip of parts are gone.
- **Videos are 1920 by 1080, at a higher quality.** They were 1280 by 720. A browser that can make MP4, such as a recent Chrome or Safari, now saves MP4, which phones and sharing sites play. Other browsers save WebM.
- **Download audio is a 48 kHz, 24-bit WAV file.** It was 44.1 kHz and 16-bit. It now uses your volumes and evens out the loudness, which the Studio can switch off. Each part fades in and out over 3 thousandths of a second, so two parts never meet with a click.

### Fixed

- **Saved files were dated in UTC.** A file saved in the evening in the Americas was named with the next day. Files are now dated on your own clock.
- **A button tapped on a phone stayed lit.** A phone keeps the hover color on the last thing tapped, so a button such as **Prepare replies ahead** looked on after it was turned off. Hover colors are now only used with a mouse.
- **A player under each message turned itself back on.** Switching it off was not saved to your account, so it came back after a reload or on another device. It now stays off.
- **A saved script and a message could play over each other.** Playing one in **Saved audio** while a message played, or the other way round, played both at once. Now one thing plays at a time: a message, a saved script, a sample, or the Studio's preview. Starting one stops the others.
- **Play on a saved script could play it twice.** Play said nothing while it read the saved lines, so a second tap started it again, and both played over each other. Play now says **Getting ready** until it plays, and a tap while it gets ready stops it. The saved lines are read four at a time, so an older script with many lines is ready sooner.

---

## 1.7.1

_2026-11-25_

### Fixed

- **The gray name in Display name did not follow the name.** It showed the name as it was when the card opened, so typing a new name left the old one there. It now changes as you type the name.

---

## 1.7.0

_2026-11-25_

### Added

- **A display name for everyone in the cast**, on each person's card in the Cast tab. It is the name shown on the Cast tab and in the players, such as a nickname. The Director never sees it, and still finds lines by **Name**. The narrator has one too, while the Director still calls them the Narrator. **A to Z** and **Z to A** sort by the name shown.
- **Pick several people at once**, with **Select** on the Cast tab. Put them all in a group, or remove them all after one question. The narrator cannot be picked, since it cannot be removed. See [Picking several people](docs/cast.md#picking-several-people).
- **Colors for each kind of part**, in the **Look** card on the Settings tab. Pick your own color for the narrator, characters, personas, NPCs, sounds and voice tags. Each shows on pictures, on the Stage tab and in the players. **Use the built-in color** puts the first one back.

### Changed

- **Gemini style and Fish Audio direction say they are optional.** The hint under each says so, and that a custom voice may not need it, since the voice already carries its sound.
- **The writing guide on GitHub has a part on custom voices.** It says what to leave out of **Gemini style** and **Fish Audio direction** when the voice already does it, and how to check.

### Fixed

- **Erasing a person's name could leave its first letter behind.** The name was saved with every letter typed or erased, so erasing it saved its first letter one step before the box was empty, and that letter came back. Now an erased name stays empty until you type a new one. The card says "No name yet", and the picture circle shows a ? when there is no picture. The Director is not sent a person with no name.

---

## 1.6.3

_2026-11-25_

### Changed

- **Gemini gets each person's style and the line's own note together.** A line the Director gave a note of its own used to replace the person's usual style, so something like an accent was left out of that line. Now the person's style comes first, then the note for the line.
- **Clearer names for the boxes on a person's card.** **How they speak** is now **Acting notes**, **Their usual way of speaking** is now **Gemini style**, and **Voice direction** is now **Fish Audio direction**. The hint under each says who reads it. What you wrote is kept.
- **A clearer writing guide on GitHub.** It says which box is read by what, how to split up a voice description, and gives an example to copy for each engine.

---

## 1.6.2

_2026-11-25_

### Fixed

- **Playing a message could stop with "The backend did not answer in time."** The panel gave up after 150 seconds, while a slow Director could still be working, such as when its first answer failed and it was asked again. The backend now says it is still working every 10 seconds, and the panel waits for as long as it does. If the backend stops answering, the panel says so after a minute. Reported by a Discord user.
- **A script could wait for as long as Lumiverse took to fill in names or list your connections.** Neither had a time limit. Each now has 15 seconds. After that, the names are read as written, and the script goes on. Reported by a Discord user.
- **The line under Nothing playing could be cut off.** It shows two short lines, and some messages were longer. With no chat open, it also said to press the Auto Foley button on a message, which is off by default. It now says to press Play, and every message fits. A longer reason is in the Log in full.
- **Getting started named the Auto Foley button on a message, and left out OmniVoice and Cartesia.** It now says to press Play on the Stage tab, and lists every engine.

---

## 1.6.1

_2026-11-25_

### Fixed

- **A preview did not follow a number until you left its box.** **How strong it is**, for the lit word, **How solid the boxes are**, **How big it is** for the floating player, and every other number box now take effect as you type. The preview changes at once. The number is still held to its range when you leave the box.

---

## 1.6.0

_2026-11-25_

### Added

- **Sort the cast A to Z, Z to A or by voice type.** **Sort the cast**, on the Cast tab under **New group**, lists people by kind, A to Z, Z to A, by voice type, or in your own order. Inside a group, people are sorted the same way. The floating player lists the cast in the same order. See [Sorting and moving people](docs/cast.md#sorting-and-moving-people).

### Changed

- **Sort the cast takes the place of the Sort by kind button.** By kind is its first choice. Dragging someone switches it to **My own order**, and the order you dragged them into is kept when you pick another way to sort.
- **A pressed dropdown keeps its plain edge**, the same as in Auto Retry and Auto Refine. Its border no longer lights up while the list is open.
- **The Mixer's Voices and Sounds volume are sliders again**, so a level can be moved by ear while something plays. The other number settings stay as boxes.
- **The narrator's card says why it cannot be removed.** It reads everything outside quotes, so it would be added back at once. The card says to change **Narration** in the Settings tab to skip it.

---

## 1.5.0

_2026-11-25_

### Added

- **Move people and groups on the Cast tab.** Hold the dots on the left of a person or a group and drag it up or down. On a keyboard, the up and down arrow keys move it one place. **Sort by kind** puts people back in order of kind. The floating player lists the cast in the same order. See [Sorting and moving people](docs/cast.md#sorting-and-moving-people).

### Changed

- **Numbers are typed in boxes**, the same as in Auto Retry and Auto Refine. The Mixer's volumes, the audience's cheer, how solid the boxes are, how strong the lit word is, How sure it must be, and each person's Stability, Similarity, Speed and engine settings were sliders. A number outside the range is changed to the nearest one when you leave the box. The color editor, Zoom when you crop a picture, and the floating player's volume and seek bar keep their sliders.

---

## 1.4.0

_2026-11-25_

### Added

- **Keys to pause and play**, in the Settings tab under **Playing**. Off by default. On a keyboard, press the keys to pause a message, and press them again to play it. The keys are Alt+P by default, and you can pick others under **Which keys**. They do nothing while you type in a box. See [Keys to pause and play](docs/getting-started.md#keys-to-pause-and-play). Suggested by a Discord user.

---

## 1.3.0

_2026-11-25_

### Added

- **OmniVoice, through OpenVox.** An OpenVox TTS connection running OmniVoice can now be used. OmniVoice knows a few small sounds, such as `[laughter]`, `[sigh]` and a questioning hum, and the Director uses them. A tag close to one of them, such as `[gasps]`, is changed to it. See [OmniVoice, through OpenVox](docs/engines.md#omnivoice-through-openvox).
- **Chatterbox Turbo, through OpenVox.** An OpenVox connection running Chatterbox Turbo is used the same as Chatterbox-Turbo.
- **Cartesia Sonic 3.** A Cartesia connection running Sonic 3 or later can now be used. The Director gives a line one feeling from Cartesia's list of 58, such as anxious or sarcastic, which is sent beside the line, and `[laughter]` where someone laughs. Speed goes from 0.6 to 1.5. See [Cartesia](docs/engines.md#cartesia).

---

## 1.2.0

_2026-11-25_

### Added

- **ElevenLabs and Fish Audio through OpenRouter.** An OpenRouter TTS connection running ElevenLabs v3 or v4, such as `elevenlabs/eleven-v4`, or Fish Audio S2.1 or Drama 3, such as `fish-audio/s2.1-pro`, can now be used. Their tags are read the same as on a direct connection. Lumiverse sends OpenRouter only the text, the voice and the speed, so Stability, Similarity, Speed, Language and Fish Audio's own settings are not shown for them. See [Through OpenRouter](docs/engines.md#through-openrouter).

### Fixed

- **A new speaker on Gemini through OpenRouter could get a voice Gemini does not have.** Lumiverse lists the same few OpenAI and Gemini voices for every OpenRouter model, so a new speaker could be given an OpenAI voice. Auto Foley now picks from the model's own voices: Gemini's 30 and ElevenLabs' 21. Fish Audio has no list there, so a Fish Audio voice ID is typed in the Cast tab.

---

## 1.1.0

_2026-11-25_

### Added

- **Colors for the player and the lit word**, in the Settings tab. Under **A player under each message**, pick the player's accent, background, and text and icons. Under **Light up words in the chat**, pick the color of the lit word and how strong it is. Each color has its own editor: type a code such as #ff0040, or move the hue, saturation and lightness sliders. **Use the theme's color** goes back to your theme.
- **More vocal sounds for Gemini 3.8**: moan, growl, grunt, hiss, scream, shout, shriek, cheer and phew, from Google's own list.
- **Saved audio**, on the Stage tab. It lists every message with a saved script, newest first, with whose script it is, the day and its first line. **Play**, **Download** and **Delete** are on each row. Play and Download use only saved audio, so nothing is spent.
- **A player under each message**, on by default. A message Auto Foley has performed gets a small player under its text, where Lumiverse puts its own. It has Back, Play and Next, and a line you tap to go to any point. It says which part is playing, and plays the saved audio again with nothing spent. It follows your theme: its colors, the message font, and the side and alignment of the message text, centered too.
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
- **Gemini through OpenRouter.** An OpenRouter TTS connection running a Gemini TTS model, such as google/gemini-3.8-flash-tts, can be picked and is used the same as Gemini.
- **TTS connections in Debug info.** It lists the service and model of every TTS connection Lumiverse sent, and whether Auto Foley can use each one. It never lists their names. Reported by a Discord user.

### Changed

- **How big it is, for the floating player, is a number box**, from 28 to 96, the same as in Auto Retry and Auto Refine. A number outside that range is changed to the nearest one when you leave the box.
- **The sampler boxes on the Director tab keep a number in range**, the same as in Auto Refine. A number above or below what a sampler takes is changed to the nearest one it takes when you leave the box, and saved then. An empty box says **Leave to the connection**.
- **Extra thinking tag names** has no example in the box, and its hint reads the same as in Auto Retry and Auto Refine.
- **The README, security policy and privacy page are laid out the same as in Auto Retry and Auto Refine**, on GitHub. The security policy says how to report a security problem, and the privacy page says what the extension never does and how to check it.
- **The Debug info box has no ring around it while you type in it**, the same as in Auto Retry.
- **Gemini 2.5 and 3.1 are no longer used.** Google shuts down these TTS models on December 18, 2026. A person who speaks through one is not spoken, and the panel says to pick Gemini 3.8 Flash TTS instead. Their notes, tags and settings are gone.
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
- **Warnings that fit the engine.** The Director tab says when Big moments do nothing on the engine in use, and when an engine cannot sing.
- **A new look for the players.** The floating player and **Now playing** on the Stage tab show the line like a page of a script, with a line on its left side in the color of whoever is speaking. An **On air** light shows red while a message plays and amber while it is paused. A thin striped band runs along the top of each player.
- **Groups have an editor.** **New group** and **Edit** open it, with the group's name and a switch for each person in the cast, so you can pick everyone in a group in one place. **Save** keeps it and **Cancel** changes nothing. **Edit** takes the place of **Rename**.
- **Scripts.** The panel calls what the Director makes from a message its script, such as **Kept audio and scripts** in **Start again**. While a message gets ready, the status says "Getting the script", and "The Director is writing the script" only once the Director is asked. A message played from its kept script never says the Director is writing. **Now playing** and the floating player name what plays as a script, such as "Tamsin’s script".
- **The Director's built-in prompt** says what each kind of person in the cast is, and to mark a big moment only while **Big moments** is on. If you use a prompt of your own, a notice says the built-in one has changed.
- **Clearer explanations on GitHub.** The engines page says how Auto Foley works with proxies, and the cast page says how much each box holds and why.
- **Fish Audio tags are repeated for each sentence.** Fish Audio reads a tag for how the words are said best at the start of the sentence it is for. On a line of several sentences, that tag now goes again at the start of each sentence that has none of its own, so the last sentence is said the same way as the first. Sounds and pauses are not repeated.

### Fixed

- **The Cast tab could blink on a phone.** Opening or closing a person could draw the whole tab blank for a moment. Rows now open and close the same way as in Auto Retry and Auto Refine.
- **The floating player could open from beside the round button.** When the player had to move to fit on the screen, the circle it grows from started where the card was first placed, not on the button. It now starts on the button.
- **A line Gemini sent back with no audio waited 15 seconds or more.** Gemini's preview models now and then answer with no audio, and the line was waited out as if the service were busy. It is asked for again after a moment, and the Log says so.
- **A new person's lines could be made again on the next play, in two voices.** Lines are made ahead, several at once. Two lines of someone new each picked a voice, so the lines had different voices, and a line spoken before the person joined the cast used the connection's voice. On the next play, those lines did not match and were made, and paid for, again. Now one voice is picked for each new person, and every line waits for it.
- **The Director's tokens were counted with the tokenizer of your main connection.** When the provider sends no count, Lumiverse counts them, and it now counts for the Director's own model. Auto Refine does the same.
- **Stop did not stop the Director.** Pressed while the script was being written, Stop only stopped the panel waiting. The Director's request went on, and could be asked again. Stop now cancels the request in Lumiverse, and nothing more is asked or kept for that message.
- **Reduce motion could stop another extension's motion.** It matched any part of the page whose name held af- inside a word, such as leaf-. It now matches only Auto Foley's own parts.
- **The notice that a built-in text changed could run off the side of a phone.** Its button now sits under the words, inside the notice.
- **"You have no TTS connection Auto Foley can use" did not say what it found.** It now says whether Lumiverse found no TTS connection on your account, or names the ones it found and their service. It also tells you that a key added under the LLM tab is not a TTS connection. Reported by a Discord user.
- **Other accounts saw no connections to pick, with no reason given.** Lumiverse refuses an extension installed as Personal for every account but the one that installed it. The panel now says so, and that it has to be installed as Operator, under Extensions, for every account to use it. Reported by a Discord user.
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
