# Animations

## In short

- **Animations**, in the Studio, picks how each part of the video comes in and goes out.
- There are eleven places: six for the whole frame and five for text.
- Each place has a dropdown. **Default** keeps what the Studio did before an animation was picked.
- Pick a built-in animation, such as **Rise**, **Wipe from the left** or **Typewriter**, or one of your own.
- Each picked animation has a typed **Length, in seconds** and **Delay, in seconds**.
- The built-in animations are calm. None of them flashes.
- Animations are part of a saved look and of a project.

## Steps

1. Open the Studio, and pick **Animations** in the list of parts.
2. Find the place, such as **Lines**, and pick an animation in its dropdown.
3. Type its **Length** and **Delay** if you want them other than the built-in ones.
4. Play the preview. Each change shows at once.
5. Pick **Default** to go back to how the place was.

## What it sends

Nothing. Animations are drawn on your device, in the preview, full screen and every saved video. Your choices are kept with your settings on your account.

## An example

Ines Marlow makes a video of a quiet harbor scene.

1. **Opening**: **Iris**, 2 seconds. The video starts black, and a circle opens from the middle to show the frame.
2. **Title and byline**: **Typewriter**, 1.6 seconds. The title "Harbor Lights At Dusk" is typed in a letter at a time. The line under it fades in once the title is all shown.
3. **Lines**: **Slide from the left**. Each line comes in from the left and leaves to the right. Pictures still move to their new place as before.
4. **Ending**: **Iris**. Over **Fade to black at the end**, the circle closes on the middle.

Half way through the opening, the corners are still black and the middle of the frame shows. A quarter of the way through the ending, the corners are black again and the middle still shows.

## The places

| Place | Kind | Default |
| --- | --- | --- |
| Opening | The whole frame | In from black |
| Ending | The whole frame | Out to black |
| Between lines | The whole frame | The transition under **Moving between lines** |
| Scene change | The whole frame | The same as between lines |
| Background on a scene change | The whole frame | A slow fade |
| Pictures | The whole frame | They move to their new place |
| Lines | Text | The same as between lines |
| Words | Text | As set under **How the words show** |
| Title and byline | Text | Fade |
| Captions | Text | The same as lines |
| Watermarks | Text | Fade |

- **Between lines** moves the whole part as one: its pictures, names and words.
- **Lines** moves only the words and the names. Pictures move as **Pictures** says.
- With both picked, the whole part moves as **Between lines** says, and the words inside it move as **Lines** says.
- **Scene change** is used in place of **Between lines** where a new scene starts.
- **Pictures** is used for a speaker who comes in or goes. A speaker who stays moves to their new place.
- **Words** moves each word in as it is said. The words not said yet are not shown.
- **Captions** is used for sound captions, such as [thunder]. With it on **Default**, they move as **Lines** says.
- **Watermarks** is used at the start and the end of each watermark's time. A watermark shown during some backgrounds keeps its fade.

## The built-in animations

| Animation | In | Out | Length |
| --- | --- | --- | --- |
| Fade | Fades in | Fades out | 0.5 seconds |
| Rise | Fades in, rising 24 pixels | Fades out, rising 24 pixels | 0.5 seconds |
| Drop | Fades in, dropping 24 pixels | Fades out, dropping 24 pixels | 0.5 seconds |
| Slide from the left | Comes in from the left | Leaves to the right | 0.5 seconds |
| Slide from the right | Comes in from the right | Leaves to the left | 0.5 seconds |
| Slide from the top | Comes in from above | Leaves downward | 0.5 seconds |
| Slide from the bottom | Comes in from below | Leaves upward | 0.5 seconds |
| Soft focus | Comes into focus as it fades in | Goes soft as it fades out | 0.5 seconds |
| Wipe from the left, right, top or bottom | A soft edge moves across and shows it | The edge moves on and hides it | 0.7 seconds |
| Grow | Grows from 92% as it fades in | Shrinks to 92% as it fades out | 0.5 seconds |
| Iris | A circle opens from the middle | The circle closes on the middle | 0.8 seconds |
| Typewriter | The letters show one at a time | Fades out | 1.2 seconds, text only |
| Word by word | The words show one at a time | Fades out | 1 second, text only |
| None | Shows at once | Goes at once | 0 seconds |

Pixels are pixels of a 1080-pixel frame, so they look the same at any size of video.

## Your animations

Under the places, **Your animations** makes animations of your own. Up to 30.

1. Pick a built-in in **Start from**, and press **Make an animation**. A copy of it is made, named such as "My rise".
2. Press its name in the list to change it. The preview under its name plays it, in and then out, over and over.
3. Change what you want:
   - **Name**, as it shows in the dropdowns.
   - **Used for**: text and the frame, text only, or the frame only.
   - **Length**, **Delay** and **Overlap**. An overlap of 100% moves the leaving and the arriving part at once.
   - **Turns and sizes around**: the middle, top, bottom, left or right of the frame.
   - **Show the text**: all at once, a letter at a time, or a word at a time.
   - **Easing**: a preset, or the four numbers of a curve, as in CSS `cubic-bezier`. The small drawing shows the curve.
   - **Track**: **Coming in** or **Going out**. Each has its own keyframes and mask.
4. Pick it in a place's dropdown, under **Your animations**.

**The preview** has **Where in the preview**, to look at one moment, **Play** or **Pause**, and **Half speed**. With Reduce motion on, it starts paused.

### Keyframes

A keyframe is a moment of a track, from 0% (its start) to 100% (its end). Between two keyframes, each value moves in a straight line, along the easing curve. A value no keyframe sets stays at rest.

| Value | At rest | Range |
| --- | --- | --- |
| Strength, in percent | 100 | 0 to 100 |
| Across and Down, in pixels | 0 | -2000 to 2000 |
| Size, in percent | 100 | 0 to 400 |
| Turn, in degrees | 0 | -720 to 720 |
| Blur, in pixels | 0 | 0 to 60 |
| Brightness, in percent | 100 | 0 to 200 |
| Tint, in percent, with its color | 0 | 0 to 100 |

A track has up to 12 keyframes. **Add a keyframe** adds one after the last. **Delete this keyframe** takes it out.

Fast changes between light and dark can flash. Keep brightness changes slow.

### Masks

A mask shows a part a little at a time:

- **A straight wipe**, with an **Angle**: 0 wipes from the left, 90 from the top. Going out, the edge moves on in the same direction.
- **A soft circle** and **An iris**: a circle from the middle that opens coming in and closes going out. **Soft edge** sets how soft its edge is.
- **A clock**: a sweep like a clock's hand, from the top, clockwise.

### Sharing

- **Share** saves the animation in a file, `auto-foley-animation-` and its name. The file holds the animation and the version of Auto Foley. Nothing else is in it.
- **Add from a file** adds the animations in such a file. One with a name you already use is added as a copy, so nothing is replaced.
- **Duplicate** makes a copy to change.
- **Delete** asks first, and says which places use it. Those places go back to **Default**.

## Details

- **Typewriter** and **Word by word** are only offered for text.
- **Ending** takes as long as **Fade to black at the end**, under **Title and ending**. It has a delay of 0.
- On **Words**, an animation moves, sizes, turns, fades and blurs each word. A mask, a tint and a change in brightness are left out, since each word is drawn on its own.
- The leaving part and the arriving part move at the same time.
