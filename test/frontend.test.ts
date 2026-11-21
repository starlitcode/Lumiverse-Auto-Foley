// The panel's pure parts: which engine a connection runs, how a line is
// fitted to it, how stability is set, and how a line is drawn.
import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { __testing } from "../src/frontend";

const { engineOf, fitTag, tagSound, textFor, styleFor, stripTags, stabilityFor, ENGINES } = __testing;

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

  test("Gemini: 3.8 takes tags and line notes, 2.5 and 3.1 take tags only", () => {
    expect(engineOf({ provider: "google_tts" }, "gemini-3.8-flash-tts").id).toBe("gemini");
    expect(engineOf({ provider: "google_vertex_tts" }, "gemini-3.8-flash-lite-tts").id).toBe("gemini");
    for (const m of ["gemini-2.5-pro-preview-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-tts", "gemini-2.5-flash-lite-preview-tts"]) {
      expect(engineOf({ provider: "google_vertex_tts" }, m).id).toBe("gemini_31");
    }
    expect(ENGINES.gemini_31.style).toBe(false);
    expect(engineOf({ provider: "google_tts" }, "gemini-2.0-flash").supported).toBe(false);
  });

  test("Chatterbox found by name on an OpenAI-style connection, and other engines not used", () => {
    expect(engineOf({ provider: "qwen3_tts_server" }, "auto").supported).toBe(false);
    expect(engineOf({ provider: "openai_tts", name: "Local Chatterbox", api_url: "http://localhost:8004/v1" }, "tts-1").id).toBe("chatterbox_turbo");
    expect(engineOf({ provider: "openai_tts", api_url: "http://box:8004/v1" }, "chatterbox-multilingual").supported).toBe(false);
    expect(engineOf({ provider: "openai_tts", api_url: "https://api.openai.com/v1" }, "tts-1").supported).toBe(false);
    expect(engineOf({ provider: "kokoro" }, "").supported).toBe(false);
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
    expect(fitTag("whispers", ENGINES.gemini_31.list)).toBe("whispering");
    expect(fitTag("laughs", ENGINES.gemini_31.list)).toBe("laughing");
    expect(fitTag("sarcastically", ENGINES.gemini_31.list)).toBe("sarcasm");
    expect(fitTag("a medium pause", ENGINES.gemini_31.list)).toBe("medium pause");
    expect(fitTag("whispering", ENGINES.chatterbox_turbo.list)).toBe("");
  });

  test("Gemini 2.5 and 3.1 never get the tags they read aloud", () => {
    for (const t of ["scared", "curious", "bored"]) expect(fitTag(t, ENGINES.gemini_31.list)).toBe("");
  });

  const line = { text: '[quietly] Stay down. [exhales] [sound of boots on gravel] They are close.' };

  test("ElevenLabs v3 keeps every tag and the sound in the voice", () => {
    expect(textFor(line, ENGINES.eleven_v3)).toBe("[quietly] Stay down. [exhales] [sound of boots on gravel] They are close.");
  });

  test("Fish keeps free tags and drops the sound it cannot make", () => {
    expect(textFor(line, ENGINES.fish)).toBe("[quietly] Stay down. [exhales] They are close.");
  });

  test("Gemini keeps only its own tags, in angle brackets", () => {
    expect(textFor(line, ENGINES.gemini)).toBe("Stay down. <exhales> They are close.");
  });

  test("Gemini 3.8 gets no pipes, stray angle brackets or slash pairs from the message", () => {
    const odd = { text: "[sighs] Fine |whatever| <3 the /north/ gate, 24/7." };
    expect(textFor(odd, ENGINES.gemini)).toBe("<sigh> Fine whatever 3 the north gate, 24/7.");
  });

  test("Gemini 2.5 and 3.1 keep their own tags, in square brackets", () => {
    expect(textFor({ text: "[whispers] Not yet. [laughs] Now." }, ENGINES.gemini_31)).toBe("[whispering] Not yet. [laughing] Now.");
    expect(textFor(line, ENGINES.gemini_31)).toBe("Stay down. They are close.");
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
  const tags = ["laughs", "a soft sigh", "clears throat", "whispering", "beat", "long pause", "medium pause", "sniffles", "gasping", "deadpan", "shh", "heavy breathing", "yells", "um", "sarcastic", "rapidly", "scared"];
  test("for every list", () => {
    for (const list of [ENGINES.gemini.list, ENGINES.gemini_31.list, ENGINES.chatterbox_turbo.list]) for (const t of tags) expect(box.__fit(t, list)).toBe(fitTag(t, list));
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
});

