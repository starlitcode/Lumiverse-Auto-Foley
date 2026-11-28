// The panel's pure parts: which engine a connection runs, how a line is
// fitted to it, how stability is set, and how a line is drawn.
import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { __testing } from "../src/frontend";

const { engineOf, noTagsWhy, openRouterVoices, colorCode, hexHsl, hslHex, computedHex, fitTag, tagSound, textFor, styleFor, stripTags, stabilityFor, ENGINES } = __testing;

describe("which engine a connection runs", () => {
  test("ElevenLabs: v3 and v4 act, and the older models are not used", () => {
    expect(engineOf({ provider: "elevenlabs" }, "eleven_v3").id).toBe("eleven_v3");
    expect(engineOf({ provider: "elevenlabs" }, "eleven_v4_turbo").id).toBe("eleven_v3");
    expect(engineOf({ provider: "elevenlabs" }, "eleven_multilingual_v2").supported).toBe(false);
    expect(engineOf({ provider: "elevenlabs" }, "").supported).toBe(false);
  });

  test("Fish Audio: S2, S2.1 and Drama 3 act, S1 does not", () => {
    for (const m of ["s2-pro", "s2.1-pro", "s2.1-pro-free", "drama-3-preview", ""]) expect(engineOf({ provider: "fish_audio" }, m).id).toBe("fish");
    expect(engineOf({ provider: "fish_audio" }, "s1").supported).toBe(false);
  });

  test("Gemini: 3.8 takes tags and line notes, and 2.5 and 3.1 are not used, since Google shuts them down", () => {
    expect(engineOf({ provider: "google_tts" }, "gemini-3.8-flash-tts").id).toBe("gemini");
    expect(engineOf({ provider: "google_vertex_tts" }, "gemini-3.8-flash-lite-tts").id).toBe("gemini");
    for (const m of ["gemini-2.5-pro-preview-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-tts", "gemini-2.5-flash-lite-preview-tts"]) {
      for (const provider of ["google_tts", "google_vertex_tts", "openrouter_tts"]) {
        expect(engineOf({ provider }, m).supported).toBe(false);
        expect(noTagsWhy({ provider }, m)).toContain("December 18, 2026");
      }
    }
    expect(Object.keys(ENGINES).sort()).toEqual(["cartesia", "chatterbox_turbo", "eleven_v3", "fish", "gemini", "omnivoice"]);
    expect(engineOf({ provider: "google_tts" }, "gemini-2.0-flash").supported).toBe(false);
  });

  test("OpenRouter: ElevenLabs v3 and v4, Fish Audio S2.1 and Drama 3, and Gemini 3.8 act, and the rest are not used", () => {
    const or = { provider: "openrouter_tts" };
    for (const m of ["elevenlabs/eleven-v4", "elevenlabs/eleven-v4-turbo", "elevenlabs/eleven-v3", "elevenlabs/eleven-v3-conversational"]) expect(engineOf(or, m).id).toBe("eleven_v3");
    for (const m of ["fish-audio/s2.1-pro", "fish-audio/s2.1-pro-free", "fish-audio/drama-3"]) expect(engineOf(or, m).id).toBe("fish");
    expect(engineOf(or, "google/gemini-3.8-flash-tts").id).toBe("gemini");
    for (const m of ["fish-audio/s1", "elevenlabs/eleven-multilingual-v2", "elevenlabs/eleven-flash-v2.5", "hexgrad/kokoro-82m", "openai/gpt-4o-mini-tts-2025-12-15"]) {
      expect(engineOf(or, m).supported).toBe(false);
      expect(noTagsWhy(or, m)).toContain("elevenlabs/eleven-v4");
    }
  });

  test("OpenVox: OmniVoice and Chatterbox Turbo act, its other models are not used", () => {
    const ov = { provider: "openvox_tts" };
    expect(engineOf(ov, "omnivoice").id).toBe("omnivoice");
    expect(engineOf(ov, "chatterbox-turbo-small").id).toBe("chatterbox_turbo");
    for (const m of ["kokoro", "pocket-tts", "supertonic-3", "chatterbox-multilingual", "qwen3-tts"]) {
      expect(engineOf(ov, m).supported).toBe(false);
      expect(noTagsWhy(ov, m)).toContain("OmniVoice and Chatterbox Turbo");
    }
  });

  test("Cartesia: Sonic 3 and later act, older Sonic models are not used", () => {
    const ca = { provider: "cartesia" };
    for (const m of ["sonic-3", "sonic-3.5", "sonic-3.6", "sonic-latest"]) expect(engineOf(ca, m).id).toBe("cartesia");
    for (const m of ["sonic-2", "sonic-english", "sonic-turbo"]) expect(engineOf(ca, m).supported).toBe(false);
    expect(ENGINES.cartesia.emotions.length).toBe(58);
    expect(ENGINES.cartesia.speed).toEqual([0.6, 1.5]);
  });

  test("OpenRouter voices come from the model's own list", () => {
    const eleven = openRouterVoices("elevenlabs/eleven-v3");
    expect(eleven.length).toBe(21);
    expect(eleven.find((v: any) => v.id === "river").gender).toBe("neutral");
    expect(eleven.every((v: any) => /^[a-z]+$/.test(v.id) && /^(male|female|neutral)$/.test(v.gender))).toBe(true);
    const gemini = openRouterVoices("google/gemini-3.8-flash-tts");
    expect(gemini.length).toBe(30);
    expect(gemini.every((v: any) => /^(male|female)$/.test(v.gender))).toBe(true);
    expect(openRouterVoices("fish-audio/s2.1-pro")).toEqual([]);
    expect(openRouterVoices("openai/gpt-4o-mini-tts-2025-12-15")).toBe(null);
  });

  test("Chatterbox found by name on an OpenAI-style connection, and other engines not used", () => {
    expect(engineOf({ provider: "qwen3_tts_server" }, "auto").supported).toBe(false);
    expect(engineOf({ provider: "openai_tts", name: "Local Chatterbox", api_url: "http://localhost:8004/v1" }, "tts-1").id).toBe("chatterbox_turbo");
    expect(engineOf({ provider: "openai_tts", api_url: "http://box:8004/v1" }, "chatterbox-multilingual").supported).toBe(false);
    expect(engineOf({ provider: "openai_tts", api_url: "https://api.openai.com/v1" }, "tts-1").supported).toBe(false);
    expect(engineOf({ provider: "kokoro" }, "").supported).toBe(false);
  });

  test("a Chatterbox server reached directly acts only while it runs Turbo", () => {
    expect(engineOf({ provider: "chatterbox_direct" }, "turbo").id).toBe("chatterbox_turbo");
    expect(engineOf({ provider: "chatterbox_direct" }, "original").supported).toBe(false);
    expect(engineOf({ provider: "chatterbox_direct" }, "multilingual").supported).toBe(false);
  });

  test("an OpenAI-style connection can be named a Chatterbox-Turbo server in Settings", () => {
    expect(engineOf({ provider: "openai_tts", name: "Box" }, "tts-1", "chatterbox_turbo").id).toBe("chatterbox_turbo");
    // It names only that. A model with no tags stays unused.
    expect(engineOf({ provider: "elevenlabs" }, "eleven_flash_v2_5", "chatterbox_turbo").supported).toBe(false);
  });
});

describe("fitting a line to its engine", () => {
  test("a tag becomes the vocal sound it names", () => {
    expect(tagSound("laughs softly")).toBe("laugh");
    expect(tagSound("Sighing")).toBe("sigh");
    expect(tagSound("clears his throat")).toBe("throat");
    expect(tagSound("a long pause")).toBe("long pause");
    expect(tagSound("through gritted teeth")).toBe("");
  });

  test("each list keeps its own spelling", () => {
    expect(fitTag("clears her throat", ENGINES.chatterbox_turbo.list)).toBe("clear throat");
    expect(fitTag("clears her throat", ENGINES.gemini.list)).toBe("throat-clearing");
    expect(fitTag("whispering", ENGINES.gemini.list)).toBe("");
    expect(fitTag("whispering", ENGINES.chatterbox_turbo.list)).toBe("");
  });

  const line = { text: '[quietly] Stay down. [exhales] [sound of boots on gravel] They are close.' };

  test("ElevenLabs v3 keeps every tag and the sound in the voice", () => {
    expect(textFor(line, ENGINES.eleven_v3)).toBe("[quietly] Stay down. [exhales] [sound of boots on gravel] They are close.");
  });

  test("Fish keeps free tags and drops the sound it cannot make", () => {
    expect(textFor(line, ENGINES.fish)).toBe("[quietly] Stay down. [quietly] [exhales] They are close.");
  });

  test("Gemini keeps only its own tags, in angle brackets", () => {
    expect(textFor(line, ENGINES.gemini)).toBe("Stay down. <exhales> They are close.");
  });

  test("Gemini 3.8 gets no pipes, stray angle brackets or slash pairs from the message", () => {
    const odd = { text: "[sighs] Fine |whatever| <3 the /north/ gate, 24/7." };
    expect(textFor(odd, ENGINES.gemini)).toBe("<sigh> Fine whatever 3 the north gate, 24/7.");
  });

  test("OmniVoice keeps its own sounds, and a gasp or a tsk becomes its nearest one", () => {
    expect(textFor({ text: "[laughs] Fine. [hmm] Sure? [gasps] Oh. [tsk] No. [whispers] Go." }, ENGINES.omnivoice)).toBe("[laughter] Fine. [question-en] Sure? [surprise-ah] Oh. [dissatisfaction-hnn] No. Go.");
    // An engine with its own gasp keeps it.
    expect(fitTag("gasps", ENGINES.chatterbox_turbo.list)).toBe("gasp");
    expect(fitTag("tsk", ENGINES.chatterbox_turbo.list)).toBe("");
  });

  test("Cartesia keeps only [laughter] in the text, and an emotion is fitted to its list", () => {
    expect(textFor({ text: "[nervously] I checked twice. [laughs] Really." }, ENGINES.cartesia)).toBe("I checked twice. [laughter] Really.");
    expect(fitTag("nervously", ENGINES.cartesia.list)).toBe("anxious");
    expect(fitTag("terrified", ENGINES.cartesia.list)).toBe("panicked");
    expect(fitTag("sarcastically", ENGINES.cartesia.list)).toBe("sarcastic");
    expect(fitTag("angry", ENGINES.cartesia.list)).toBe("angry");
    expect(fitTag("quietly", ENGINES.cartesia.list)).toBe("");
    // Other engines are not given an emotion.
    expect(fitTag("angrily", ENGINES.chatterbox_turbo.list)).toBe("");
  });

  test("Chatterbox keeps only its nine tags", () => {
    expect(textFor({ text: "[chuckles] Fine. [whispers] Go." }, ENGINES.chatterbox_turbo)).toBe("[chuckle] Fine. Go.");
  });

  test("an engine with no tags gets none", () => {
    expect(textFor(line, Object.assign({}, ENGINES.fish, { tags: "none" }))).toBe("Stay down. They are close.");
    expect(stripTags("[quietly] Leave it, [sighs] please.")).toBe("Leave it, please.");
  });

  test("a sung line is marked the way each engine sings", () => {
    const sung = { text: "Row, row, row the boat.", sung: true };
    expect(textFor(sung, ENGINES.eleven_v3)).toBe("[sings] Row, row, row the boat.");
    expect(textFor(sung, ENGINES.fish)).toBe("[singing] Row, row, row the boat.");
    expect(textFor(sung, ENGINES.chatterbox_turbo)).toBe("Row, row, row the boat.");
    expect(styleFor(sung, ENGINES.gemini)).toBe("singing the words to a simple tune");
    expect(styleFor({ sung: true, style: "soft and slow" }, ENGINES.gemini)).toBe("singing, soft and slow");
    expect(styleFor({ style: "soft and slow" }, ENGINES.eleven_v3)).toBe("");
  });
});

describe("the backend fits tags the same way", () => {
  const box: any = { spindle: { onFrontendMessage() {}, log: { info() {}, warn() {} } }, console, Date, Math, JSON, Promise };
  vm.createContext(box);
  vm.runInContext(readFileSync(join(import.meta.dir, "..", "dist", "backend.js"), "utf8") + "\n;globalThis.__fit = fitTag;", box);
  const tags = ["nervously", "terrified", "hmm", "tsk", "angry", "laughs", "a soft sigh", "clears throat", "whispering", "beat", "long pause", "medium pause", "sniffles", "gasping", "deadpan", "shh", "heavy breathing", "yells", "um", "sarcastic", "rapidly", "scared"];
  test("for every list", () => {
    for (const list of [ENGINES.gemini.list, ENGINES.chatterbox_turbo.list, ENGINES.omnivoice.list, ENGINES.cartesia.list]) for (const t of tags) expect(box.__fit(t, list)).toBe(fitTag(t, list));
  });
});

describe("stability", () => {
  test("Eleven v3 snaps to Creative, Natural or Robust", () => {
    expect(stabilityFor("eleven_v3", 0.3, false)).toBe(0.5);
    expect(stabilityFor("eleven_v3", 0.2, false)).toBe(0);
    expect(stabilityFor("eleven_v3", 0.8, false)).toBe(1);
  });

  test("a big moment on v3 goes one step looser, and Creative stays Creative", () => {
    expect(stabilityFor("eleven_v3", 1, true)).toBe(0.5);
    expect(stabilityFor("eleven_v3", 0, true)).toBe(0);
  });

  test("a big moment on v4 loosens the voice, down to 0.1", () => {
    expect(stabilityFor("eleven_v4", 0.5, true)).toBe(0.25);
    expect(stabilityFor("eleven_v4", 0.2, true)).toBe(0.1);
    expect(stabilityFor("eleven_v4", 0.5, false)).toBe(0.5);
  });
});


describe("word timing from the sound", () => {
  const { voicedFrames, wordWeight, partTimes } = __testing;
  // Half a second of quiet, a second of tone, a third of quiet, a second of
  // tone, and quiet to the end, at 8000 samples a second.
  const rate = 8000;
  const wave: number[] = [];
  const add = (secs: number, loud: number) => {
    for (let k = 0; k < secs * rate; k++) wave.push(loud ? loud * Math.sin(k / 3) : 0.0005 * Math.sin(k));
  };
  add(0.5, 0);
  add(1, 0.5);
  add(0.34, 0);
  add(1, 0.5);
  add(0.5, 0);

  test("only the frames with a voice in them count as voiced", () => {
    const v = voicedFrames(wave, rate);
    expect(v.slice(0, 24).some(Boolean)).toBe(false);
    expect(v.slice(26, 74).every(Boolean)).toBe(true);
    expect(v.slice(77, 91).some(Boolean)).toBe(false);
    expect(v.slice(95, 140).every(Boolean)).toBe(true);
    expect(v.slice(-20).some(Boolean)).toBe(false);
  });

  test("words wait out the silence at the start and a pause in the middle", () => {
    const v = voicedFrames(wave, rate);
    const at = partTimes([1, 1, 1, 1], v, 3.34);
    expect(at[0]).toBeGreaterThanOrEqual(0.48);
    expect(at[0]).toBeLessThan(0.56);
    // The third word starts after the pause, not inside it.
    expect(at[2]).toBeGreaterThan(1.82);
    expect(at[2]).toBeLessThan(1.9);
  });

  test("with no sound read, the words are spread over the clip", () => {
    expect(partTimes([1, 1], [], 2)).toEqual([0, 1]);
  });

  test("a word weighs about its syllables", () => {
    expect(wordWeight("go")).toBe(1);
    expect(wordWeight("tomorrow")).toBe(3);
    expect(wordWeight("stone")).toBe(1);
    expect(wordWeight("...")).toBe(0);
  });
});

describe("the chat's title", () => {
  const { looksLikeDate } = __testing;
  test("the date Lumiverse gives a new chat is told apart from a title someone wrote", () => {
    expect(looksLikeDate("Mar 3, 2026, 4:12:09 PM")).toBe(true);
    expect(looksLikeDate("3 mars 2026, 16:12:09")).toBe(true);
    expect(looksLikeDate("2026/3/3 16:12")).toBe(true);
    expect(looksLikeDate("The lighthouse at 9")).toBe(false);
    expect(looksLikeDate("Winter of 1999")).toBe(false);
  });
});

describe("defaults that change after a release", () => {
  const { movedFor, movedRowMark, MOVED_DEFAULTS, markText } = __testing as any;
  const row = { key: "keepAudio", was: 100, label: "Keep made audio", why: "the new default keeps more." };
  test("only a reader still on the old value, who has not answered, is told", () => {
    expect(movedFor({ keepAudio: 100 }, "", [row]).length).toBe(1);
    expect(movedFor({ keepAudio: 250 }, "", [row]).length).toBe(0);
    expect(movedFor({ keepAudio: 100 }, movedRowMark(row), [row]).length).toBe(0);
  });
  test("a row with another old value is told again", () => {
    const later = Object.assign({}, row, { was: 250 });
    expect(movedFor({ keepAudio: 250 }, movedRowMark(row), [row, later]).length).toBe(1);
  });
  test("marks are short and change with the text", () => {
    expect(markText("abc")).toBe(markText("abc"));
    expect(markText("abc")).not.toBe(markText("abd"));
  });
  test("every row names a real setting", () => {
    for (const m of MOVED_DEFAULTS) expect(typeof m.label).toBe("string");
  });
  test("the Studio's new look tells a reader on the old one, and leaves one with their own", () => {
    const rows = MOVED_DEFAULTS.filter((m: any) => ["videoWords", "videoMoveSecs", "videoEdges", "videoBacks"].includes(m.key));
    expect(rows.length).toBe(4);
    const old = { videoWords: "light", videoMoveSecs: 0.4, videoEdges: 50, videoBacks: rows.find((m: any) => m.key === "videoBacks").was };
    expect(movedFor(old, "", rows).length).toBe(4);
    const own = { videoWords: "all", videoMoveSecs: 0.8, videoEdges: 10, videoBacks: [{ id: "main", name: "Mine", kind: "color", color: "#203040" }] };
    expect(movedFor(own, "", rows).length).toBe(0);
  });
});

describe("picking a voice for someone new", () => {
  const { voiceGender, describeWords } = __testing as any;
  test("every way a voice list writes gender is understood", () => {
    expect(voiceGender("female")).toBe("female");
    expect(voiceGender("Feminine")).toBe("female");
    expect(voiceGender("male")).toBe("male");
    expect(voiceGender("masculine")).toBe("male");
    expect(voiceGender("nonbinary")).toBe("neutral");
    expect(voiceGender("Neutral")).toBe("neutral");
    expect(voiceGender("")).toBe("");
  });
  test("a description gives the words worth matching", () => {
    expect(Array.from(describeWords("Gravelly, textured voice.")).sort()).toEqual(["gravelly", "textured"]);
  });
});


describe("Fish delivery tags per sentence", () => {
  const { perSentence, textFor, ENGINES } = __testing as any;
  const fish = ENGINES.fish;

  test("the leading delivery tag goes again at each sentence", () => {
    expect(perSentence("[hushed] The lantern is out. Stay close to the wall.")).toBe("[hushed] The lantern is out. [hushed] Stay close to the wall.");
  });

  test("a sound or a pause is never repeated", () => {
    expect(perSentence("[sighs] Fine. We go at dawn.")).toBe("[sighs] Fine. We go at dawn.");
    expect(perSentence("[weary] [sighs] Fine. We go at dawn.")).toBe("[weary] [sighs] Fine. [weary] We go at dawn.");
  });

  test("a sentence with its own delivery tag starts a new one", () => {
    expect(perSentence("[cheerful] Morning, Orrin. [worried] Where is Wren? She was here.")).toBe("[cheerful] Morning, Orrin. [worried] Where is Wren? [worried] She was here.");
  });

  test("a title with a period is not the end of a sentence", () => {
    expect(perSentence("[tense] Ask Dr. Pell first. Then wait.")).toBe("[tense] Ask Dr. Pell first. [tense] Then wait.");
  });

  test("one sentence, or no tag, is left as it is", () => {
    expect(perSentence("[calm] Sit down.")).toBe("[calm] Sit down.");
    expect(perSentence("Sit down. Now.")).toBe("Sit down. Now.");
  });

  test("only Fish Audio repeats tags", () => {
    expect(textFor({ text: "[hushed] Go. Now." }, fish)).toBe("[hushed] Go. [hushed] Now.");
    expect(textFor({ text: "[hushed] Go. Now." }, ENGINES.eleven_v3)).toBe("[hushed] Go. Now.");
  });
});

describe("Even out voice levels", () => {
  const { clipLevel, levelGain, voicedFrames } = __testing as any;
  const tone = (amp: number, secs: number, rate = 8000) => Array.from({ length: Math.round(secs * rate) }, (_, k) => amp * Math.sin((2 * Math.PI * 220 * k) / rate));

  test("the level counts only voiced frames", () => {
    const rate = 8000;
    const spoken = tone(0.5, 0.5, rate);
    const withSilence = [...new Array(rate).fill(0), ...spoken, ...new Array(rate).fill(0)];
    const a = clipLevel(spoken, rate, voicedFrames(spoken, rate));
    const b = clipLevel(withSilence, rate, voicedFrames(withSilence, rate));
    expect(Math.abs(a - b)).toBeLessThan(0.5);
    // A sine at 0.5 has an RMS of about 0.354, which is -9 dB.
    expect(Math.round(a)).toBe(-9);
  });

  test("silence has no level", () => {
    const quiet = new Array(4000).fill(0);
    expect(clipLevel(quiet, 8000, voicedFrames(quiet, 8000))).toBe(null);
  });

  test("a louder voice is turned down, by 6 dB at most", () => {
    expect(levelGain(-20, -20)).toBe(1);
    expect(levelGain(-17, -20)).toBe(0.708);
    expect(levelGain(-5, -20)).toBe(0.501);
  });

  test("a quieter voice is never turned up", () => {
    expect(levelGain(-26, -20)).toBe(1);
  });
});

describe("Download audio", () => {
  const { wavBlob } = __testing as any;
  test("a WAV file has the right header and length, in 24 bits", async () => {
    const left = new Float32Array([0, 0.5, -0.5, 1]);
    const right = new Float32Array([0, -0.25, 0.25, -1]);
    const b = wavBlob([left, right], 48000);
    const v = new DataView(await b.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    const s24 = (o: number) => {
      const u = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16);
      return u & 0x800000 ? u - 0x1000000 : u;
    };
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(34, true)).toBe(24);
    expect(v.getUint32(28, true)).toBe(48000 * 2 * 3);
    expect(v.getUint32(40, true)).toBe(4 * 2 * 3);
    expect(s24(44 + 6)).toBe(4194304);
    expect(s24(44 + 21)).toBe(-8388608);
    expect(s24(44 + 9)).toBe(-2097152);
    expect(s24(44 + 12)).toBe(-4194304);
    expect(b.type).toBe("audio/wav");
  });
});

describe("color codes for the color editor", () => {
  test("a code is taken with or without the #, and in the short form", () => {
    expect(colorCode("#FF0040")).toBe("#ff0040");
    expect(colorCode("ff0040")).toBe("#ff0040");
    expect(colorCode("#0f8")).toBe("#00ff88");
    expect(colorCode("#ff004")).toBe(null);
    expect(colorCode("teal")).toBe(null);
  });
  test("hue, saturation and lightness go there and back", () => {
    for (const hex of ["#ff0040", "#3a7bd5", "#808080", "#000000", "#ffffff", "#9370db"]) {
      const { h, s, l } = hexHsl(hex);
      const back = hslHex(h, s, l);
      const diff = [1, 3, 5].map((i) => Math.abs(parseInt(back.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)));
      expect(Math.max(...diff)).toBeLessThanOrEqual(3);
    }
  });
  test("a color the browser computed is read as a code", () => {
    expect(computedHex("rgb(147, 112, 219)")).toBe("#9370db");
    expect(computedHex("rgba(10 20 30 / 0.5)")).toBe("#0a141e");
    expect(computedHex("hsl(0 0% 0%)")).toBe(null);
  });
});

describe("keys to pause and play", () => {
  const { keyCombo, PAUSE_KEY_DEFAULT } = __testing;

  test("a key is read by its place, so Option+P on a Mac is still P", () => {
    expect(keyCombo({ code: "KeyP", key: "π", altKey: true })).toBe("Alt+P");
    expect(PAUSE_KEY_DEFAULT).toBe("Alt+P");
  });

  test("the keys held with it are named in one order", () => {
    expect(keyCombo({ code: "KeyK", ctrlKey: true, shiftKey: true })).toBe("Ctrl+Shift+K");
    expect(keyCombo({ code: "Digit5", metaKey: true })).toBe("Cmd+5");
    expect(keyCombo({ code: "F8", ctrlKey: true, altKey: true })).toBe("Ctrl+Alt+F8");
  });

  test("a key with no Ctrl, Alt or Cmd is not taken, so typing is never caught", () => {
    expect(keyCombo({ code: "KeyP" })).toBe("");
    expect(keyCombo({ code: "KeyP", shiftKey: true })).toBe("");
  });

  test("holding only Ctrl, Alt, Shift or Cmd is not a whole set of keys yet", () => {
    expect(keyCombo({ code: "AltLeft", altKey: true })).toBe("");
    expect(keyCombo({ code: "ControlRight", ctrlKey: true })).toBe("");
    expect(keyCombo({ code: "MetaLeft", metaKey: true })).toBe("");
  });
});

describe("sorting the cast", () => {
  const { sortCast } = __testing;
  const cast = [
    { name: "ilsa", kind: "npc", gender: "unknown" },
    { name: "Narrator", kind: "narrator", gender: "unknown" },
    { name: "Bram", kind: "character", gender: "male" },
    { name: "Corrie", kind: "persona", gender: "female" },
    { name: "Tamsin 10", kind: "character", gender: "nonbinary" },
    { name: "Tamsin 9", kind: "npc", gender: "female" },
  ];
  const names = (how: string) => sortCast(cast, how).map((m: any) => m.name);

  test("by kind: the narrator, personas, characters, then NPCs, ties kept in order", () => {
    expect(names("kind")).toEqual(["Narrator", "Corrie", "Bram", "Tamsin 10", "ilsa", "Tamsin 9"]);
  });
  test("A to Z ignores capitals and reads numbers as numbers", () => {
    expect(names("az")).toEqual(["Bram", "Corrie", "ilsa", "Narrator", "Tamsin 9", "Tamsin 10"]);
  });
  test("Z to A is the other way round", () => {
    expect(names("za")).toEqual(["Tamsin 10", "Tamsin 9", "Narrator", "ilsa", "Corrie", "Bram"]);
  });
  test("by voice type: female, male, neutral, then any, A to Z inside each", () => {
    expect(names("voice")).toEqual(["Corrie", "Tamsin 9", "Bram", "Tamsin 10", "ilsa", "Narrator"]);
  });
  test("my own order leaves the cast as it is, and the cast itself is never changed", () => {
    expect(names("own")).toEqual(cast.map((m) => m.name));
    sortCast(cast, "az");
    expect(cast[0].name).toBe("ilsa");
  });
});

describe("what Gemini is told about how a line is said", () => {
  const { geminiStyle } = __testing;
  test("the person's Gemini style comes first, then the line's own note", () => {
    expect(geminiStyle("Warm and unhurried, with a light Southern accent.", "quiet and hurt")).toBe("Warm and unhurried, with a light Southern accent. This line: quiet and hurt");
  });
  test("either one alone is sent as it is", () => {
    expect(geminiStyle("calm and dry", "")).toBe("calm and dry");
    expect(geminiStyle("", "quiet and hurt")).toBe("quiet and hurt");
    expect(geminiStyle("  ", "  ")).toBe("");
  });
});

describe("Hide words", () => {
  const { hideList, hiddenWords, plainWord } = __testing as any;
  test("a word is matched with its marks and a final 's taken off", () => {
    expect(plainWord("Ilse's,")).toBe("ilse");
    expect(plainWord("“Ilse’s")).toBe("ilse");
    expect(plainWord("lamp.")).toBe("lamp");
  });
  test("the example in docs/studio.md", () => {
    const list = hideList("Ilse\nCorvin Ashby");
    const line = "Pass me the lamp, Ilse. Ilse's hands are steadier than mine.".split(" ");
    expect(hiddenWords(line, list)).toEqual([false, false, false, false, true, true, false, false, false, false, false]);
  });
  test("a name of two words is hidden only where both are said together", () => {
    const list = hideList("Corvin Ashby");
    expect(hiddenWords("Ask Corvin about it.".split(" "), list)).toEqual([false, false, false, false]);
    expect(hiddenWords("Corvin Ashby waved.".split(" "), list)).toEqual([true, true, false]);
  });
  test("an empty list hides nothing", () => {
    expect(hiddenWords(["Ilse"], hideList("\n  \n"))).toEqual([false]);
  });
});

describe("Download audio, odd lengths", () => {
  const { wavBlob } = __testing as any;
  test("a data chunk of an odd length is followed by one zero byte", async () => {
    const b = wavBlob([new Float32Array([0.25])], 48000);
    const v = new DataView(await b.arrayBuffer());
    expect(v.getUint32(40, true)).toBe(3);
    expect(b.size).toBe(44 + 3 + 1);
    expect(v.getUint32(4, true)).toBe(36 + 3 + 1);
    expect(v.getUint8(47)).toBe(0);
  });
});

describe("the mood of a line, for a mood picture", () => {
  const { feelingOf, BUILT_IN_MOODS } = __testing;
  test("the mood whose words its tags and note name most is used", () => {
    expect(feelingOf({ tags: ["angrily"], text: "[angrily] Give the map back." }, "calm")).toBe("angry");
    expect(feelingOf({ tags: [], style: "teasing, with a grin" }, "")).toBe("playful");
    // A tie goes to the mood higher in the list.
    expect(feelingOf({ tags: ["softly", "tearfully"], text: "[softly] [tearfully] Stay." }, "")).toBe("sad");
  });
  test("with no word matched, the first mood whose words hold the scene's mood", () => {
    expect(feelingOf({ tags: [], text: "The rain had stopped." }, "scary")).toBe("scared");
    expect(feelingOf({ tags: [], text: "The rain had stopped." }, "cozy")).toBe("calm");
    expect(feelingOf({ tags: [], text: "The rain had stopped." }, "")).toBe("");
  });
  test("words are matched whole", () => {
    expect(feelingOf({ tags: ["flatter"], text: "" }, "")).toBe("");
    expect(feelingOf({ tags: ["flatly"], text: "" }, "")).toBe("tense");
  });
  test("a list of your own is used in its own order", () => {
    const mine = [{ id: "m1", name: "Smug", words: ["smugly", "smirks"] }, { id: "playful", name: "Playful", words: ["smirks", "teasing"] }];
    expect(feelingOf({ tags: ["smirks"], text: "" }, "", mine)).toBe("m1");
    expect(feelingOf({ tags: ["teasing"], text: "" }, "", mine)).toBe("playful");
    expect(feelingOf({ tags: ["angrily"], text: "" }, "", mine)).toBe("");
  });
  test("every built-in mood has words, and the scene moods are in them", () => {
    for (const m of BUILT_IN_MOODS) expect(m.words.length).toBeGreaterThan(5);
    const all = BUILT_IN_MOODS.flatMap((m) => m.words);
    for (const mood of ["calm", "cozy", "happy", "playful", "romantic", "sad", "tense", "scary", "action", "mysterious"]) expect(all).toContain(mood);
  });
});

describe("templates", () => {
  test("every template gives a value for every look setting, so nothing is left from the look before", () => {
    const src = readFileSync(new URL("../src/frontend.ts", import.meta.url), "utf8");
    const look = (src.match(/const LOOK_KEYS = \[([\s\S]*?)\];/) as RegExpMatchArray)[1].match(/'(\w+)'/g)!.map((x) => x.slice(1, -1));
    const want = look.filter((k) => k !== "videoByline" && k !== "videoMarks" && k !== "videoStickers" && k !== "videoAnimsOwn" && k !== "videoReveals" && k !== "videoShape").concat(["studioMusic"]).sort();
    const found = [...src.matchAll(/\n      id: '([a-z]+)',\n[^\n]*\n[^\n]*\n      look: (\{[\s\S]*?\n      \}),\n/g)];
    expect(found.length).toBeGreaterThanOrEqual(8);
    for (const m of found) {
      const keys = Object.keys(new Function("return " + m[2])()).sort();
      expect({ id: m[1], keys }).toEqual({ id: m[1], keys: want });
    }
  });
});

describe("scene moods", () => {
  test("the panel's built-in scene moods are the same as the backend's", () => {
    const list = (file: string) => {
      const src = readFileSync(join(import.meta.dir, "..", "src", file), "utf8");
      const m = src.match(/const BUILT_IN_SCENE_MOODS: SceneMood\[\] = (\[[\s\S]*?\n\]);/);
      expect(m).toBeTruthy();
      return vm.runInNewContext("(" + (m as RegExpMatchArray)[1] + ")");
    };
    const front = list("frontend.ts");
    expect(front.length).toBe(10);
    expect(JSON.stringify(front)).toBe(JSON.stringify(list("backend.ts")));
  });
});

describe("animations", () => {
  const { bezier, animAt, BUILT_IN_ANIMS, ANIM_PLACES, EASES } = __testing as any;
  test("the easing curves start at 0, end at 1, and Even is a straight line", () => {
    for (const e of EASES) {
      expect(bezier(e.curve, 0)).toBeCloseTo(0, 3);
      expect(bezier(e.curve, 1)).toBeCloseTo(1, 3);
    }
    expect(bezier([0, 0, 1, 1], 0.3)).toBeCloseTo(0.3, 3);
  });
  test("each built-in comes in to rest and leaves from rest, with unique ids and no change in brightness", () => {
    const ids = BUILT_IN_ANIMS.map((a: any) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of BUILT_IN_ANIMS) {
      const end = animAt(a, "in", 1);
      const start = animAt(a, "out", 0);
      for (const s of [end, start]) {
        expect(s.x).toBeCloseTo(0, 3);
        expect(s.y).toBeCloseTo(0, 3);
        expect(s.s).toBeCloseTo(100, 3);
        expect(s.b).toBeCloseTo(0, 3);
        expect(s.l).toBe(100);
      }
      expect(end.o).toBeCloseTo(1, 3);
    }
    const rise = BUILT_IN_ANIMS.find((a: any) => a.id === "rise");
    expect(animAt(rise, "in", 0)).toMatchObject({ o: 0, y: 24 });
    expect(animAt(rise, "out", 1)).toMatchObject({ o: 0, y: -24 });
  });
  test("there are eleven places, five of text and six of the frame", () => {
    expect(ANIM_PLACES.length).toBe(11);
    expect(ANIM_PLACES.filter((p: any) => p.kind === "text").length).toBe(5);
  });
});

describe("templates and animations", () => {
  test("a template uses only built-in animations, and never one that flashes", () => {
    const src = readFileSync(new URL("../src/frontend.ts", import.meta.url), "utf8");
    const { BUILT_IN_ANIMS } = __testing as any;
    const calm = new Set(BUILT_IN_ANIMS.filter((a: any) => !a.flash).map((a: any) => a.id));
    const block = src.slice(src.indexOf("  const TEMPLATES: Template[] = ["), src.indexOf("\n  ];\n", src.indexOf("  const TEMPLATES: Template[] = [")));
    const used = [...block.matchAll(/videoAnims: \{([^\n]*?)\},\s/g)].flatMap((m) => [...m[1].matchAll(/id: '([^']+)'/g)].map((x) => x[1]));
    expect(used.length).toBeGreaterThan(10);
    for (const id of used) expect(calm.has(id)).toBe(true);
  });
});

describe("built-in animation ids", () => {
  test("the backend keeps exactly the panel's built-in animations", () => {
    const { BUILT_IN_ANIMS } = __testing as any;
    const src = readFileSync(new URL("../src/backend.ts", import.meta.url), "utf8");
    const back = JSON.parse((src.match(/const BUILT_IN_ANIM_IDS = (\[[^\]]*\]);/) as RegExpMatchArray)[1].replace(/'/g, '"'));
    expect(back.slice().sort()).toEqual(BUILT_IN_ANIMS.map((a: any) => a.id).sort());
  });
});

// A connection that goes to another host than its service's own is named
// as a proxy, since a proxy can drop settings on the way.
describe("proxyNote", () => {
  const { proxyNote } = __testing as any;
  test("a direct connection, or one with no address, has none", () => {
    expect(proxyNote({ provider: "fish_audio", api_url: "" })).toBe("");
    expect(proxyNote({ provider: "fish_audio", api_url: "https://api.fish.audio/v1" })).toBe("");
    expect(proxyNote({ provider: "elevenlabs", api_url: "https://api.eu.residency.elevenlabs.io" })).toBe("");
    expect(proxyNote({ provider: "google_tts", api_url: "https://generativelanguage.googleapis.com/v1beta" })).toBe("");
  });
  test("another host is named as a proxy", () => {
    expect(proxyNote({ provider: "fish_audio", api_url: "https://relay.example.net/fish" })).toBe(
      "This connection goes through relay.example.net, not straight to Fish Audio. A proxy may drop some settings, so if a voice sounds off, compare it on a direct connection.",
    );
    expect(proxyNote({ provider: "elevenlabs", api_url: "https://notelevenlabs.io.example.com" })).toContain("goes through notelevenlabs.io.example.com");
  });
  test("a server of the reader's own is not a proxy", () => {
    expect(proxyNote({ provider: "openai_tts", api_url: "http://192.0.2.10:8004/v1" })).toBe("");
    expect(proxyNote({ provider: "openvox_tts", api_url: "http://localhost:7860" })).toBe("");
  });
});

