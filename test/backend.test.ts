// The backend, run as Lumiverse runs it: dist/backend.js as a plain script,
// in a sandbox, against a stub of the spindle API. Top-level functions in a
// plain script become properties of the sandbox, so the pure ones are called
// directly, and the rest are driven through the panel's messages.
import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../dist/backend.js", import.meta.url), "utf8");

type Host = {
  box: any;
  sent: { msg: any; userId?: string }[];
  toasts: { kind: string; text: string; userId?: string }[];
  files: Map<string, any>;
  keys: Map<string, string>;
  calls: { generate: any[]; decisions: any[]; cors: any[]; counted: any[] };
  ask: (payload: any, userId?: string) => Promise<any[]>;
};

function host(opts: {
  answers?: (string | Error)[];
  slowMs?: number;
  hangMacros?: boolean;
  decide?: (input: any) => any;
  noDecisions?: boolean;
  cors?: (url: string, init: any) => any;
  connections?: any[] | Error;
  // Files already on disk, as after a restart.
  files?: Map<string, any>;
  hold?: boolean;
  tokens?: boolean;
} = {}): Host {
  const files = new Map<string, any>(opts.files || []);
  const keys = new Map<string, string>();
  const sent: { msg: any; userId?: string }[] = [];
  const toasts: { kind: string; text: string; userId?: string }[] = [];
  const calls = { generate: [] as any[], decisions: [] as any[], cors: [] as any[], counted: [] as any[] };
  const answers = (opts.answers || []).slice();
  let handler: any = null;
  const k = (path: string, userId?: string) => (userId || "-") + "/" + path;
  const spindle: any = {
    onFrontendMessage(fn: any) {
      handler = fn;
    },
    sendToFrontend(msg: any, userId?: string) {
      sent.push({ msg: JSON.parse(JSON.stringify(msg)), userId });
    },
    log: { info() {}, warn() {} },
    // Lumiverse fills in {{user}} and {{char}}. Here they are filled in with
    // made-up names, and the call is kept so a test can read it.
    macros: {
      async resolve(text: string, o: any) {
        (calls as any).macros = ((calls as any).macros || []).concat([{ text, o }]);
        // A Lumiverse that never answers.
        if (opts.hangMacros) return await new Promise(() => {});
        return { text: text.replace(/\{\{user\}\}/g, "Tamsin").replace(/\{\{char\}\}/g, "Orrin"), diagnostics: [] };
      },
    },
    toast: {
      success: (t: string, o: any) => toasts.push({ kind: "success", text: t, userId: o && o.userId }),
      info: (t: string, o: any) => toasts.push({ kind: "info", text: t, userId: o && o.userId }),
      warning: (t: string, o: any) => toasts.push({ kind: "warning", text: t, userId: o && o.userId }),
      error: (t: string, o: any) => toasts.push({ kind: "error", text: t, userId: o && o.userId }),
    },
    userStorage: {
      async read(path: string, userId?: string) {
        if (!files.has(k(path, userId))) throw new Error("ENOENT");
        return files.get(k(path, userId));
      },
      async write(path: string, data: string, userId?: string) {
        files.set(k(path, userId), data);
      },
      async exists(path: string, userId?: string) {
        return files.has(k(path, userId));
      },
      async readBinary(path: string, userId?: string) {
        if (!files.has(k(path, userId))) throw new Error("ENOENT");
        return files.get(k(path, userId));
      },
      async writeBinary(path: string, data: Uint8Array, userId?: string) {
        files.set(k(path, userId), data);
      },
      async delete(path: string, userId?: string) {
        files.delete(k(path, userId));
      },
    },
    enclave: {
      async put(key: string, value: string, userId?: string) {
        keys.set(k(key, userId), value);
      },
      async get(key: string, userId?: string) {
        return keys.get(k(key, userId)) || null;
      },
      async has(key: string, userId?: string) {
        return keys.has(k(key, userId));
      },
      async delete(key: string, userId?: string) {
        return keys.delete(k(key, userId));
      },
    },
    generate: {
      async quiet(req: any) {
        calls.generate.push(req);
        // A held answer waits until the call is canceled, as a slow model would.
        if (opts.hold)
          return await new Promise((_, no) => {
            if (req.signal) req.signal.addEventListener("abort", () => no(new Error("aborted")));
          });
        // A slow model, which answers after this many milliseconds.
        if (opts.slowMs) await new Promise((r) => setTimeout(r, opts.slowMs));
        const a = answers.length ? answers.shift() : "";
        if (a instanceof Error) throw a;
        return { content: a, finish_reason: "stop" };
      },
    },
    connections: {
      async list() {
        if (opts.connections instanceof Error) throw opts.connections;
        return opts.connections || [];
      },
    },
    // Lumiverse's tokenizer, only when a check asks for it. It keeps which
    // model each count was for.
    ...(opts.tokens
      ? {
          tokens: {
            async countText(text: string, o: any) {
              calls.counted.push(o && o.model);
              return { total_tokens: Math.ceil(String(text || "").length / 3), approximate: false };
            },
          },
        }
      : {}),
    async cors(url: string, init: any) {
      calls.cors.push({ url, init });
      if (!opts.cors) throw new Error("no cors in this test");
      return opts.cors(url, init);
    },
  };
  if (!opts.noDecisions) {
    spindle.decisions = {
      async evaluate(input: any) {
        calls.decisions.push(input);
        if (!opts.decide) throw new Error("No default Decision connection configured");
        return opts.decide(input);
      },
      async listConnections() {
        return [{ id: "d1", name: "Quick", model: "maker/fast-judge", is_default: true, has_api_key: true }];
      },
    };
  }
  // Waits run at once here, so a test of a busy provider does not take a minute.
  const box: any = { spindle, console, Date, Math, JSON, Promise, setTimeout: (fn: any) => setTimeout(fn, 0), clearTimeout };
  // Lumiverse's runtime has AbortController. Here it is only given to a check
  // that holds the Director's answer, since every wait runs at once and a
  // time limit would cancel every other call straight away.
  if (opts.hold) box.AbortController = AbortController;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return {
    box,
    sent,
    toasts,
    files,
    keys,
    calls,
    async ask(payload: any, userId = "u1") {
      const before = sent.length;
      await handler(Object.assign({ requestId: "r" + Math.random() }, payload), userId);
      return sent.slice(before).map((s) => s.msg);
    },
  };
}

const plainRules = { tagsOn: true, breathsOn: true, max: 2, soundTags: true };

describe("reading a message", () => {
  const h = host();
  const split = (t: string) => h.box.splitSegments(t).map((s: any) => s.kind + ":" + s.text);

  test("quotes are speech and the rest is narration, in order", () => {
    expect(split('Ilse set the lantern down. "You came back." *She did not look up.* "Why?"')).toEqual([
      "narration:Ilse set the lantern down.",
      "speech:You came back.",
      "narration:She did not look up.",
      "speech:Why?",
    ]);
  });

  test("curly quotes count as speech", () => {
    expect(split("Corin shrugged. “Fine by me.”")).toEqual(["narration:Corin shrugged.", "speech:Fine by me."]);
  });

  test("a paragraph break ends a narration line", () => {
    expect(split("The rain stopped.\n\nThe door opened.")).toEqual(["narration:The rain stopped.", "narration:The door opened."]);
  });

  test("square brackets are taken out, so ElevenLabs never reads them as tags", () => {
    expect(split('[OOC: back in ten] "Ready when you are."')).toEqual(["speech:Ready when you are."]);
  });

  test("closed thinking is taken out", () => {
    expect(split('<think>She is lying.</think>"I believe you."')).toEqual(["speech:I believe you."]);
  });

  test("thinking with no closer runs to the end and is taken out", () => {
    expect(split('"Hold the rope." <thinking>Now the plan')).toEqual(["speech:Hold the rope."]);
  });

  test("a long line is split at the end of a sentence", () => {
    const long = Array.from({ length: 12 }, (_, n) => "The tide came in over the flat stones number " + n + ".").join(" ");
    const segs = h.box.splitSegments(long);
    expect(segs.length).toBeGreaterThan(1);
    for (const s of segs) expect(s.text.length).toBeLessThanOrEqual(320);
    expect(segs.map((s: any) => s.text).join(" ")).toBe(long);
  });

  test("a message with nothing to say has no lines", () => {
    expect(split("*   *")).toEqual([]);
  });
});

describe("writing styles and text not meant to be heard", () => {
  const h = host();
  const split = (text: string, o: any = {}) => h.box.splitSegments(text, o).map((g: any) => g.kind[0] + ":" + g.text);
  const skips = () => h.box.skipsFor("").list;

  test("guillemets, low quotes and corner brackets are speech", () => {
    expect(split("Brin leaned in. «Not here.» He waited.")).toEqual(["n:Brin leaned in.", "s:Not here.", "n:He waited."]);
    expect(split("Sie nickte. \u201EGleich.\u201C")).toEqual(["n:Sie nickte.", "s:Gleich."]);
    expect(split("\u300C\u5F85\u3063\u3066\u300D\u3068\u8A00\u3063\u305F\u3002")).toEqual(["s:\u5F85\u3063\u3066", "n:\u3068\u8A00\u3063\u305F\u3002"]);
  });

  test("a line that starts with a dash is speech, up to the next dash", () => {
    expect(split("\u2014 Close the gate, \u2014 said Tova. \u2014 Now.")).toEqual(["s:Close the gate,", "n:said Tova.", "s:Now."]);
  });

  test("single quotes count only when picked, and an apostrophe opens nothing", () => {
    expect(split("Tova's hands shook. 'Leave it,' she said.", { marks: "single" })).toEqual(["n:Tova's hands shook.", "s:Leave it,", "n:she said."]);
    expect(split("Tova's hands shook. 'Leave it,' she said.")).toEqual(["n:Tova's hands shook. 'Leave it,' she said."]);
  });

  test("plain text is speech and *asterisks* are actions, when picked", () => {
    expect(split("*shrugs and turns away* Fine by me. *pauses* Mostly.", { marks: "plain" })).toEqual(["n:shrugs and turns away", "s:Fine by me.", "n:pauses", "s:Mostly."]);
  });

  test("text between asterisks can be left out, in any style", () => {
    expect(split('*leans on the rail* "Not tonight." *turns away*', { asterisks: "skip" })).toEqual(["s:Not tonight."]);
    expect(split("*leans on the rail* Not tonight.", { marks: "plain", asterisks: "skip" })).toEqual(["s:Not tonight."]);
    expect(split('*leans on the rail* "Not tonight."')).toEqual(["n:leans on the rail", "s:Not tonight."]);
  });

  test("Asterisked text can be read as thoughts, in the speaker's voice", () => {
    expect(split('*He would not lie to her.* "Fine."', { asterisks: "thought" })).toEqual(["s:He would not lie to her.", "s:Fine."]);
    // Asterisks inside quote marks only stress a word.
    expect(split('"I *really* mean it," Tova said.', { asterisks: "thought" })).toEqual(["s:I really mean it,", "n:Tova said."]);
  });

  test("Quoted text can be read as narration, or skipped", () => {
    expect(split('Tova nodded. "Fine." She left.', { quoted: "narration" })).toEqual(["n:Tova nodded. Fine. She left."]);
    expect(split('Tova nodded. "Fine." She left.', { quoted: "skip" })).toEqual(["n:Tova nodded. She left."]);
  });

  test("Undecorated text can be read as speech, or skipped", () => {
    expect(split("*waves from the gate* Hello there.", { plain: "speech" })).toEqual(["n:waves from the gate", "s:Hello there."]);
    expect(split('Tova nodded. "Fine."', { plain: "skip" })).toEqual(["s:Fine."]);
  });

  test("Text in parentheses can be read as thoughts, narration, or skipped", () => {
    expect(split('"Sure, I would love to." (Absolutely not.)', { parens: "thought" })).toEqual(["s:Sure, I would love to.", "s:Absolutely not."]);
    expect(split('"Sure, I would love to." (Absolutely not.)', { parens: "skip" })).toEqual(["s:Sure, I would love to."]);
    // Read as narration, the default, it joins the sentence, which keeps its period.
    expect(split("Tova waited (for hours) by the gate.")).toEqual(["n:Tova waited for hours by the gate."]);
    expect(split("Tova waited (for hours).")).toEqual(["n:Tova waited for hours."]);
    // Inside quote marks, parentheses stay part of what is said.
    expect(split('"I will be there (probably) by noon."', { parens: "skip" })).toEqual(["s:I will be there probably by noon."]);
    // Double parentheses are still left out.
    expect(split("Tova left. ((brb, dinner))", { parens: "thought" })).toEqual(["n:Tova left."]);
  });

  test("emojis in a line are not sent to the voice", () => {
    expect(split('Tova grinned 😏 and waved. "See you later! 👋❤️"')).toEqual(["n:Tova grinned and waved.", "s:See you later!"]);
    expect(split('"Fine 🙄." She left. ✨💫 👍🏽 🇺🇸')).toEqual(["s:Fine.", "n:She left."]);
    // With Send emojis to the voice on, they stay.
    expect(split("Tova grinned 😏 and waved.", { emojis: true })).toEqual(["n:Tova grinned 😏 and waved."]);
    expect([h.box.cleanSettings({}).emojisOn, h.box.cleanSettings({ emojisOn: true }).emojisOn]).toEqual([false, true]);
    // A music note still marks a line as sung.
    expect(h.box.splitSegments('"🎵 Over the hills 🎶"').map((g: any) => [g.text, !!g.sung])).toEqual([["Over the hills", true]]);
  });

  test("text between asterisks read as narration joins the narration beside it", () => {
    expect(split("Tova waited. *checks the latch* Nothing moved.")).toEqual(["n:Tova waited. checks the latch Nothing moved."]);
  });

  test("trackers, status lines and bars are left out", () => {
    const text = 'Brin set the lamp down. "Night shift again."\n\nTime: 11:20 PM\n| Mood | tired |\n📍 The east dock\nStamina ▓▓▓░░\n【Day 4】\n<details><summary>Notes</summary>Owes a favor.</details>';
    expect(split(text, { skips: skips() })).toEqual(["n:Brin set the lamp down.", "s:Night shift again."]);
  });

  test("a narration line with a colon and no number stays", () => {
    expect(split("The sign read: closed for the season.", { skips: skips() })).toEqual(["n:The sign read: closed for the season."]);
  });

  test("a pattern that would stall or match everywhere is refused, with why", () => {
    const got = h.box.makePatterns("(a+)+b\n^\n[unclosed\nstatus: \\d+");
    expect(got.list.length).toBe(1);
    expect(got.bad.length).toBe(3);
    expect(got.bad.join(" ")).toContain("repeat inside a repeat");
  });
});

describe("the words never change", () => {
  const h = host();
  test("tags, capitals, ellipses and dashes are allowed", () => {
    expect(h.box.sameWords("[quietly] I KNEW it... all along -", "I knew it all along.")).toBe(true);
  });
  test("a changed word is caught", () => {
    expect(h.box.sameWords("[quietly] I knew it the whole time.", "I knew it all along.")).toBe(false);
  });
  test("a dropped word is caught", () => {
    expect(h.box.sameWords("I knew it.", "I knew it all along.")).toBe(false);
  });
});

describe("tags", () => {
  const h = host();
  test("tags that can only be seen are dropped", () => {
    expect(h.box.cleanTags("[smiles] Hello [nods] there.", plainRules).text).toBe("Hello there.");
  });
  test("a tag that is too long is dropped", () => {
    expect(h.box.cleanTags("[speaking slowly and carefully while she counts the coins] Hi.", plainRules).text).toBe("Hi.");
  });
  test("no more tags than the rules allow", () => {
    const got = h.box.cleanTags("[quietly] One [sighs] two [laughs] three.", plainRules);
    expect(got.tags).toEqual(["quietly", "sighs"]);
    expect(got.text).toBe("[quietly] One [sighs] two three.");
  });
  test("breaths and laughs go when that switch is off", () => {
    const got = h.box.cleanTags("[quietly] One [sighs] two.", Object.assign({}, plainRules, { breathsOn: false }));
    expect(got.text).toBe("[quietly] One two.");
  });
  test("all voice tags go when voice tags are off", () => {
    expect(h.box.cleanTags("[quietly] One.", Object.assign({}, plainRules, { tagsOn: false })).text).toBe("One.");
  });
  test("a sound tag may be long and carry a quoted shout", () => {
    const got = h.box.cleanTags('Pass the salt. [sound of a pan clattering in the next room, someone shouting "my fault!"]', plainRules);
    expect(got.sounds).toEqual(['sound of a pan clattering in the next room, someone shouting "my fault!"']);
    expect(got.tags).toEqual([]);
  });
  test("one sound tag in a line at most", () => {
    const got = h.box.cleanTags("[sound of thunder] Go. [sound of a dog barking]", plainRules);
    expect(got.sounds.length).toBe(1);
    expect(got.text).toBe("[sound of thunder] Go.");
  });
  test("sound tags go when sounds are made as effects", () => {
    const got = h.box.cleanTags("[sound of thunder] Go.", Object.assign({}, plainRules, { soundTags: false }));
    expect(got.text).toBe("Go.");
  });
});

describe("keys to pause and play are saved", () => {
  const h = host();
  test("off by default, on Alt+P", () => {
    const d = h.box.cleanSettings({});
    expect([d.pauseKeyOn, d.pauseKey]).toEqual([false, "Alt+P"]);
  });
  test("keys the panel writes are kept", () => {
    expect(h.box.cleanSettings({ pauseKey: "Ctrl+Shift+K" }).pauseKey).toBe("Ctrl+Shift+K");
    expect(h.box.cleanSettings({ pauseKey: "Cmd+F8" }).pauseKey).toBe("Cmd+F8");
  });
  test("a key on its own, or anything else, goes back to Alt+P", () => {
    for (const bad of ["P", "Shift+P", "Alt+", "<b>Alt+P</b>", 7, null]) expect(h.box.cleanSettings({ pauseKey: bad }).pauseKey).toBe("Alt+P");
  });
});

describe("how the cast is sorted is saved", () => {
  const h = host();
  test("the old Speech and plain-text choices move to Quoted text and Undecorated text", () => {
    const d = h.box.cleanSettings({});
    expect([d.asterisks, d.quotedText, d.plainText, d.speechMarks]).toEqual(["narration", "speech", "narration", "auto"]);
    expect(h.box.cleanSettings({ speechRead: "skip" }).quotedText).toBe("skip");
    const plain = h.box.cleanSettings({ speechMarks: "plain" });
    expect([plain.plainText, plain.speechMarks]).toEqual(["speech", "auto"]);
    expect(h.box.cleanSettings({ speechRead: "skip", quotedText: "narration" }).quotedText).toBe("narration");
    expect(h.box.cleanSettings({ asterisks: "thought" }).asterisks).toBe("thought");
    expect([d.parens, h.box.cleanSettings({ parens: "skip" }).parens, h.box.cleanSettings({ parens: "speech" }).parens]).toEqual(["narration", "skip", "narration"]);
    expect("speechRead" in h.box.cleanSettings({ speechRead: "skip" })).toBe(false);
  });

  test("by kind by default, and only the known ways are kept", () => {
    expect(h.box.cleanSettings({}).castSort).toBe("kind");
    for (const how of ["az", "za", "voice", "own"]) expect(h.box.cleanSettings({ castSort: how }).castSort).toBe(how);
    expect(h.box.cleanSettings({ castSort: "newest" }).castSort).toBe("kind");
  });
  test("a cast moved by hand in 1.5.0 keeps its own order", () => {
    expect(h.box.cleanSettings({ castSorted: false }).castSort).toBe("own");
    expect(h.box.cleanSettings({ castSorted: true }).castSort).toBe("kind");
    expect(h.box.cleanSettings({ castSorted: false, castSort: "az" }).castSort).toBe("az");
  });
});

describe("the Director's answer", () => {
  const h = host();
  const segs = () => h.box.splitSegments('Mara turned. "Not again." "Again," Tobin said.');
  const cast = h.box.cleanSettings({
    cast: [
      { id: "a", name: "Mara Vell", kind: "character" },
      { id: "b", name: "Tobin", kind: "npc", aliases: ["the smith"] },
    ],
  }).cast;
  const rules = Object.assign({}, plainRules, { sounds: true, effects: true, narrationRead: true, findSpeakers: true, bigMoments: true });

  test("JSON is found inside a code fence or after a sentence", () => {
    expect(h.box.parseJsonObject('Here you go:\n```json\n{"lines":[]}\n```')).toEqual({ lines: [] });
    expect(h.box.parseJsonObject('Sure. {"lines":[{"i":0}]} Done.')).toEqual({ lines: [{ i: 0 }] });
    expect(h.box.parseJsonObject("no json here")).toBe(null);
  });

  test("a line with changed words is read as written, with a note", () => {
    const got = h.box.applyDirection(segs(), { lines: [{ i: 1, speaker: "Mara", text: "[flat] Not this again." }] }, cast, "Mara Vell", {}, rules);
    expect(got.lines[1].text).toBe("Not again.");
    expect(got.lines[1].note).toContain("changed the words");
  });

  test("a first name finds the cast member", () => {
    const got = h.box.applyDirection(segs(), { lines: [{ i: 1, speaker: "Mara", text: "[flat] Not again." }] }, cast, "Someone", {}, rules);
    expect(got.lines[1].speaker).toBe("Mara Vell");
    expect(got.lines[1].text).toBe("[flat] Not again.");
  });

  test("an alias finds the cast member", () => {
    const got = h.box.applyDirection(segs(), { lines: [{ i: 2, speaker: "the smith", text: "Again," }] }, cast, "Mara Vell", {}, rules);
    expect(got.lines[2].speaker).toBe("Tobin");
  });

  test("a speaker the Decision model picked is kept", () => {
    const got = h.box.applyDirection(segs(), { lines: [{ i: 1, speaker: "Tobin", text: "Not again." }] }, cast, "Mara Vell", { 1: "Mara Vell" }, rules);
    expect(got.lines[1].speaker).toBe("Mara Vell");
  });

  test("every line is kept, even ones the Director left out", () => {
    const got = h.box.applyDirection(segs(), { lines: [] }, cast, "Mara Vell", {}, rules);
    expect(got.lines.length).toBe(segs().length);
    expect(got.log.join(" ")).toContain("left out");
  });

  test("new speakers are found, and people already in the cast are not added twice", () => {
    const got = h.box.applyDirection(segs(), { lines: [], new_speakers: [{ name: "Old Harl", gender: "male", about: "rough" }, { name: "Tobin" }, { name: "Narrator" }] }, cast, "Mara Vell", {}, rules);
    expect(got.newSpeakers.map((s: any) => s.name)).toEqual(["Old Harl"]);
  });

  test("effects are dropped when sounds are made in the voice", () => {
    const voiceOnly = Object.assign({}, rules, { effects: false });
    const got = h.box.applyDirection(segs(), { lines: [{ i: 0, speaker: "Narrator", text: "Mara turned.", after: "a door creaking" }] }, cast, "Mara Vell", {}, voiceOnly);
    expect(got.lines[0].after).toBe("");
  });

  test("a sound inside narration goes when narration is not read", () => {
    const noNarration = Object.assign({}, rules, { narrationRead: false });
    const got = h.box.applyDirection(segs(), { lines: [{ i: 0, speaker: "Narrator", text: "[sound of boots on stone] Mara turned." }] }, cast, "Mara Vell", {}, noNarration);
    expect(got.lines[0].text).toBe("Mara turned.");
  });
});

describe("directing a message, end to end", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m1", swipeId: 0, name: "Mara Vell", text: 'Mara set the cup down. "Fine."' };
  const good = JSON.stringify({
    lines: [
      { i: 0, speaker: "Narrator", text: "Mara set the cup down.", after: "a ceramic cup set on wood" },
      { i: 1, speaker: "Mara Vell", text: "[flatly] Fine." },
    ],
    new_speakers: [],
  });

  // The panel waits through a slow Director only while the backend says it
  // is still working, so the backend says so every 10 seconds.
  test("a slow Director is reported as still working, and the script still comes", async () => {
    const h = host({ answers: [good], slowMs: 10600 });
    const out = await h.ask(msg);
    const types = out.map((m) => m.type);
    expect(types.indexOf("working")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("working")).toBeLessThan(types.indexOf("script"));
    expect(out.filter((m) => m.type === "working").every((m) => m.requestId === out.find((x) => x.type === "script").requestId)).toBe(true);
    // Nothing more is said once the answer is sent.
    const after = h.sent.length;
    await new Promise((r) => setTimeout(r, 10500));
    expect(h.sent.length).toBe(after);
  }, 30000);

  // A display name is only for the panel. The Director finds lines by name.
  test("a display name is kept, and never sent to the Director", async () => {
    const h = host({ answers: [good] });
    await h.ask({ type: "save", settings: { cast: [{ id: "n", name: "Narrator", kind: "narrator", display: "Old Wren" }, { id: "a", name: "Mara Vell", kind: "character", display: "The Captain" }] } });
    const saved = JSON.parse(h.files.get("u1/settings.json"));
    expect(saved.cast.map((m: any) => m.display)).toEqual(["Old Wren", "The Captain"]);
    await h.ask(msg);
    const sent = JSON.stringify(h.calls.generate[0]);
    expect(sent.indexOf("Mara Vell")).toBeGreaterThan(-1);
    expect(sent.indexOf("The Captain")).toBe(-1);
    expect(sent.indexOf("Old Wren")).toBe(-1);
  });

  test("the script comes back tagged, to the user who asked", async () => {
    const h = host({ answers: [good] });
    const out = await h.ask(msg, "u7");
    const script = out.find((m) => m.type === "script").script;
    expect(script.lines[1].text).toBe("[flatly] Fine.");
    expect(script.directed).toBe(true);
    expect(h.sent.every((s) => s.userId === "u7")).toBe(true);
  });

  test("the tokens the Director read and wrote are counted for the message", async () => {
    const h = host({ answers: [good] });
    const script = (await h.ask(msg)).find((m) => m.type === "script").script;
    expect(script.sent).toBeGreaterThan(100);
    expect(script.back).toBeGreaterThan(10);
    expect(script.counted).toBe(false);
  });

  test("the author joins the cast the first time they speak", async () => {
    const h = host({ answers: [good] });
    await h.ask(msg);
    const saved = JSON.parse(h.files.get("u1/settings.json"));
    expect(saved.cast.map((c: any) => c.name)).toContain("Mara Vell");
  });

  test("a persona's message adds them as a persona", async () => {
    const h = host({ answers: [good] });
    await h.ask(Object.assign({}, msg, { name: "Wyn", isUser: true }));
    const saved = JSON.parse(h.files.get("u1/settings.json"));
    expect(saved.cast.find((c: any) => c.name === "Wyn").kind).toBe("persona");
  });

  test("a new speaker the Director finds is added as an NPC, marked as added by the AI", async () => {
    const answer = JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara set the cup down." }], new_speakers: [{ name: "Ferryman", gender: "male", about: "slow and low" }] });
    const h = host({ answers: [answer] });
    const out = await h.ask(msg);
    const saved = JSON.parse(h.files.get("u1/settings.json"));
    const f = saved.cast.find((c: any) => c.name === "Ferryman");
    expect(f.kind).toBe("npc");
    expect(f.addedBy).toBe("ai");
    expect(out.some((m) => m.type === "state_changed")).toBe(true);
  });

  test("a second ask for the same message asks the Director nothing", async () => {
    const h = host({ answers: [good] });
    await h.ask(msg);
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(1);
  });

  test("Direct again asks again", async () => {
    const h = host({ answers: [good, good] });
    await h.ask(msg);
    await h.ask(Object.assign({}, msg, { fresh: true }));
    expect(h.calls.generate.length).toBe(2);
  });

  test("a failed Director call reads the message as written and says why in plain words", async () => {
    const h = host({ answers: [new Error("PERMISSION_DENIED: generation")] });
    const out = await h.ask(msg);
    const script = out.find((m) => m.type === "script").script;
    expect(script.directed).toBe(false);
    expect(script.lines.map((l: any) => l.text)).toEqual(["Mara set the cup down.", "Fine."]);
    expect(script.log.join(" ")).toContain("Generation permission is refused");
  });

  test("an answer that is not JSON reads the message as written", async () => {
    const h = host({ answers: ["I would whisper the second line."] });
    const out = await h.ask(msg);
    const script = out.find((m) => m.type === "script").script;
    expect(script.log.join(" ")).toContain("not in the shape asked for");
  });

  test("a failed answer is not kept, so the next press asks again", async () => {
    const h = host({ answers: [new Error("timed out"), good] });
    await h.ask(msg);
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
  });

  test("the built-in prompt is sent when no prompt of your own is saved", async () => {
    const h = host({ answers: [good] });
    await h.ask(msg);
    expect(h.calls.generate[0].messages[0].content).toContain("<the_director>");
  });

  test("a line in script style is spoken by that person, and the label is not read", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { directorOn: false, cast: [{ name: "Tamsin Reyes", kind: "character", aliases: ["Tamsin"] }] } });
    const out = await h.ask({ type: "direct", chatId: "c1", messageId: "m5", swipeId: 0, name: "Tamsin Reyes", text: "Tamsin: Keep the lantern low." });
    const line = out.find((m) => m.type === "script").script.lines[0];
    expect(line.kind).toBe("speech");
    expect(line.speaker).toBe("Tamsin Reyes");
    expect(line.text).toBe("Keep the lantern low.");
  });

  test("{{user}} and {{char}} are filled in, with nothing changed by it", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { directorOn: false } });
    const out = await h.ask({ type: "direct", chatId: "c7", messageId: "m9", swipeId: 0, name: "Orrin", text: "{{char}} turned toward {{user}} and nodded." });
    const lines = out.find((m) => m.type === "script").script.lines;
    expect(lines.map((l: any) => l.text).join(" ")).toBe("Orrin turned toward Tamsin and nodded.");
    const call = (h.calls as any).macros[0];
    expect(call.o.chatId).toBe("c7");
    expect(call.o.commit).toBe(false);
  });

  test("names that cannot be filled in within 15 seconds are read as written, and the script still comes", async () => {
    const h = host({ hangMacros: true });
    await h.ask({ type: "save", settings: { directorOn: false } });
    const out = await h.ask({ type: "direct", chatId: "c7", messageId: "m9", swipeId: 0, name: "Orrin", text: "{{char}} waved." });
    const script = out.find((m) => m.type === "script");
    expect(!!script).toBe(true);
    expect(script.script.lines.map((l: any) => l.text).join(" ")).toBe("{{char}} waved.");
  }, 30000);

  test("a message with no macros is not sent to be filled in", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { directorOn: false } });
    await h.ask({ type: "direct", chatId: "c7", messageId: "m10", swipeId: 0, name: "Orrin", text: "Orrin nodded." });
    expect((h.calls as any).macros).toBeUndefined();
  });

  test("the Director is not asked when it is off", async () => {
    const h = host({ answers: [good] });
    await h.ask({ type: "save", settings: { directorOn: false } });
    const out = await h.ask(msg);
    expect(h.calls.generate.length).toBe(0);
    expect(out.find((m) => m.type === "script").script.log.join(" ")).toContain("The Director is off");
  });
});

describe("directing for each voice engine", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m2", swipeId: 0, name: "Oren Sallow", text: 'Oren leaned on the rail. "Not again." The kettle shrieked behind him.' };
  const sent = (h: Host) => JSON.parse(h.calls.generate[0].messages[1].content);
  const GEMINI = { id: "gemini", label: "Gemini 3.8 TTS", tags: "list", list: ["sigh", "laugh", "gasp", "short pause"], style: true, inVoiceSounds: false, sing: true };
  const FISH = { id: "fish", label: "Fish Audio S2 or Drama 3", tags: "free", list: [], style: false, inVoiceSounds: false, sing: true };
  const answer = JSON.stringify({
    lines: [
      { i: 0, speaker: "Narrator", text: "Oren leaned on the rail.", before: "", after: "" },
      { i: 1, speaker: "Oren Sallow", text: "[sighs heavily] [through his teeth] Not again.", style: "tired and flat", after: "" },
      { i: 2, speaker: "Narrator", text: "[sound of a kettle whistling] The kettle shrieked behind him.", after: "a kettle whistling on a stove" },
    ],
    new_speakers: [],
  });

  test("Gemini gets its tag list and line notes, and keeps only its own tags", async () => {
    const h = host({ answers: [answer] });
    // A key, so there is somewhere for sound effects to come from.
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    const out = await h.ask(Object.assign({ engine: GEMINI }, msg));
    const rules = sent(h).rules;
    expect(rules.engine).toBe("Gemini 3.8 TTS");
    expect(rules.tag_list).toEqual(GEMINI.list);
    expect(rules.line_style).toBe(true);
    expect(rules.sound_style).toBe("effects");
    expect(rules.engine_note).toContain("tag_list");
    const lines = out.find((m) => m.type === "script").script.lines;
    expect(lines[1].text).toBe("[sigh] Not again.");
    expect(lines[1].style).toBe("tired and flat");
    expect(lines[2].text).toBe("The kettle shrieked behind him.");
    expect(lines[2].after).toBe("a kettle whistling on a stove");
  });

  test("Fish keeps free tags, gets no line notes, and plays its sounds as effects", async () => {
    const h = host({ answers: [answer] });
    const out = await h.ask(Object.assign({ engine: FISH }, msg));
    expect(sent(h).rules.sound_style).toBe("effects");
    expect(sent(h).rules.line_style).toBe(false);
    const lines = out.find((m) => m.type === "script").script.lines;
    expect(lines[1].text).toBe("[sighs heavily] [through his teeth] Not again.");
    expect(lines[1].style).toBe("");
    expect(lines[2].text).toBe("The kettle shrieked behind him.");
  });

  test("ElevenLabs v3 keeps the sound in the voice", async () => {
    const h = host({ answers: [answer] });
    await h.ask({ type: "save", settings: { soundStyle: "voice" } });
    const out = await h.ask(Object.assign({ engine: { id: "eleven_v3", label: "ElevenLabs v3 or v4", tags: "free", list: [], style: false, inVoiceSounds: true, sing: true } }, msg));
    expect(sent(h).rules.sound_style).toBe("voice");
    const lines = out.find((m) => m.type === "script").script.lines;
    expect(lines[2].text).toBe("[sound of a kettle whistling] The kettle shrieked behind him.");
    expect(lines[2].after).toBe("");
  });

  test("the same message for another engine is directed again", async () => {
    const h = host({ answers: [answer, answer] });
    await h.ask(Object.assign({ engine: GEMINI }, msg));
    await h.ask(Object.assign({ engine: FISH }, msg));
    expect(h.calls.generate.length).toBe(2);
  });

  test("a note the reader wrote for an engine is sent instead of the built-in one", async () => {
    const h = host({ answers: [answer] });
    await h.ask({ type: "save", settings: { engineNotes: { gemini: "Only gasps, please." } } });
    await h.ask(Object.assign({ engine: GEMINI }, msg));
    expect(sent(h).rules.engine_note).toBe("Only gasps, please.");
  });

  test("a line marked with music notes is sung, and the notes are not read", async () => {
    const h = host({ answers: [""] });
    const out = await h.ask({ type: "direct", chatId: "c1", messageId: "m3", swipeId: 0, name: "Oren Sallow", text: 'He hummed, then sang. "♪ Over the hills and gone ♪"' });
    expect(sent(h).lines[1].sung).toBe(true);
    const line = out.find((m) => m.type === "script").script.lines[1];
    expect(line.sung).toBe(true);
    expect(line.text).toBe("Over the hills and gone");
  });

  test("a line the Director marks as sung is sung", async () => {
    const h = host({ answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Oren leaned on the rail." }, { i: 1, speaker: "Oren Sallow", text: "Not again.", sung: true }], new_speakers: [] })] });
    const out = await h.ask(Object.assign({}, msg, { messageId: "m4", text: 'Oren leaned on the rail. "Not again."' }));
    expect(out.find((m) => m.type === "script").script.lines[1].sung).toBe(true);
  });
});

describe("keeping made audio", () => {
  const b64 = (n: number) => Buffer.from(new Uint8Array(n).fill(7)).toString("base64");

  test("a kept line comes back by its fingerprint", async () => {
    const h = host();
    const put = await h.ask({ type: "clip_put", sig: "abc123def", mime: "audio/mpeg", base64: b64(500) });
    expect(put.find((m) => m.type === "clip_kept").ok).toBe(true);
    const got = (await h.ask({ type: "clip_get", sig: "abc123def" })).find((m) => m.type === "clip");
    expect(got.found).toBe(true);
    expect(Buffer.from(got.base64, "base64").length).toBe(500);
    expect((await h.ask({ type: "clip_get", sig: "zzz999zzz" })).find((m) => m.type === "clip").found).toBe(false);
  });

  test("nothing is kept or found with Keep made audio off", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { keepAudio: 0 } });
    expect((await h.ask({ type: "clip_put", sig: "abc123def", mime: "audio/mpeg", base64: b64(100) })).find((m) => m.type === "clip_kept").ok).toBe(false);
    expect([...h.files.keys()].some((k) => k.includes("clips/abc123def"))).toBe(false);
  });

  test("the oldest go first once the total passes the limit", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { keepAudio: 50 } });
    const mb = 1024 * 1024;
    for (let k = 0; k < 22; k++) await h.ask({ type: "clip_put", sig: "clip" + String(k).padStart(4, "0"), mime: "audio/mpeg", base64: b64(2.4 * mb) });
    const state = (await h.ask({ type: "clips_state" })).find((m) => m.type === "clips_state");
    expect(state.bytes).toBeLessThanOrEqual(50 * mb);
    expect((await h.ask({ type: "clip_get", sig: "clip0000" })).find((m) => m.type === "clip").found).toBe(false);
    expect((await h.ask({ type: "clip_get", sig: "clip0021" })).find((m) => m.type === "clip").found).toBe(true);
    expect([...h.files.keys()].some((k) => k.endsWith("clips/clip0000"))).toBe(false);
  });

  test("Clear kept audio deletes every clip", async () => {
    const h = host();
    await h.ask({ type: "clip_put", sig: "abc123def", mime: "audio/mpeg", base64: b64(100) });
    const out = (await h.ask({ type: "clips_clear" })).find((m) => m.type === "clips_state");
    expect(out.count).toBe(0);
    expect([...h.files.keys()].some((k) => k.endsWith("clips/abc123def"))).toBe(false);
  });

  test("a directed message is still there after Lumiverse restarts", async () => {
    const msg = { type: "direct", chatId: "c1", messageId: "m9", swipeId: 0, name: "Tamsin Reyes", text: 'Tamsin knocked twice. "Anyone home?"' };
    const good = JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Tamsin knocked twice." }, { i: 1, speaker: "Tamsin Reyes", text: "[softly] Anyone home?" }], new_speakers: [] });
    const first = host({ answers: [good] });
    await first.ask(msg);
    await new Promise((r) => setTimeout(r, 20));
    const second = host({ answers: [] });
    for (const [k, v] of first.files) second.files.set(k, v);
    const out = await second.ask(msg);
    expect(second.calls.generate.length).toBe(0);
    expect(out.find((m) => m.type === "script").script.lines[1].text).toBe("[softly] Anyone home?");
  });
});

describe("sounds by link", () => {
  test("a link is kept, matched like any sound, and played from its address", async () => {
    const h = host();
    const out = await h.ask({ type: "sound_link", url: "https://sounds.example.org/clips/rain_on_glass.mp3", name: "" });
    expect(out.find((m) => m.type === "uploaded").ok).toBe(true);
    const list = out.filter((m) => m.type === "sounds").pop().sounds;
    expect(list[0].name).toBe("rain on glass");
    expect(list[0].source).toBe("link");
    const got = (await h.ask({ type: "sound", description: "rain on glass" })).find((m) => m.type === "sound");
    expect(got.url).toBe("https://sounds.example.org/clips/rain_on_glass.mp3");
    expect(h.calls.cors.length).toBe(0);
  });

  test("something that is not a web link is refused, in plain words", async () => {
    const h = host();
    const out = await h.ask({ type: "sound_link", url: "javascript:alert(1)" });
    expect(out.find((m) => m.type === "uploaded").error).toContain("http://");
  });

  test("a link with a broken escape in its file name is still kept", async () => {
    const h = host();
    const out = await h.ask({ type: "sound_link", url: "https://sounds.example.org/creak%C3_door.ogg", name: "" });
    expect(out.find((m) => m.type === "uploaded").ok).toBe(true);
    expect(out.filter((m) => m.type === "sounds").pop().sounds[0].name).toBe("creak%C3 door");
  });
});

describe("Start again", () => {
  test("says which parts are already at their defaults", async () => {
    const h = host();
    const all = ["settings", "prompt", "cast", "sounds", "audio", "key"];
    const fresh = (await h.ask({ type: "reset_check", parts: all })).find((m) => m.type === "reset_check");
    expect(fresh.already).toEqual(all);
    await h.ask({ type: "save", settings: { strength: "dramatic", prompt: "Direct it quietly." } });
    await h.ask({ type: "sound_link", url: "https://sounds.example.org/latch.mp3", name: "a latch" });
    const now = (await h.ask({ type: "reset_check", parts: all })).find((m) => m.type === "reset_check");
    expect(now.already).toEqual(["cast", "audio", "key"]);
  });
});

describe("code in a message is never read", () => {
  const read = (h: Host, t: string) => h.box.cleanForVoice(t).replace(/\s+/g, " ").trim();
  test("colored and gradient text is read as its words only", () => {
    const h = host();
    const long = '<span style="background: linear-gradient(90deg, #ff6ec4 0%, #c56cf0 20%, #7873f5 40%, #4ade80 60%, #facc15 80%, #f97316 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; font-weight: 700;">Velma grinned.</span>';
    expect(long.length).toBeGreaterThan(200);
    expect(read(h, long)).toBe("Velma grinned.");
    expect(read(h, '<font color="#8a2be2">"Over here," Bram called.</font>')).toBe('"Over here," Bram called.');
    expect(read(h, "<p style='color: rgb(200, 120, 255)'>The lantern flickered.</p>")).toBe("The lantern flickered.");
    expect(read(h, '<div title="a > b" style="color:#fff">Tide came in.</div>')).toBe("Tide came in.");
  });
  test("a style block is never read, closed or not", () => {
    const h = host();
    expect(read(h, "<style>.glow { background: linear-gradient(red, blue); }</style>Dusk fell.")).toBe("Dusk fell.");
    expect(read(h, "Dusk fell. <style>.glow { color: #abc; }")).toBe("Dusk fell.");
  });
  test("prose with a < in it is kept", () => {
    const h = host();
    expect(read(h, "Thanks <3 see you at 5 < 6.")).toBe("Thanks <3 see you at 5 < 6.");
  });
});

describe("Freesound", () => {
  const clip = new Uint8Array(400).fill(7);
  const results = [
    { id: 11, name: "door_nc.wav", username: "nightowl", license: "http://creativecommons.org/licenses/by-nc/4.0/", url: "https://freesound.org/people/nightowl/sounds/11/", previews: { "preview-hq-mp3": "https://cdn.freesound.org/previews/0/11_hq.mp3" } },
    { id: 12, name: "old door creak", username: "tinbox", license: "Attribution", url: "https://freesound.org/people/tinbox/sounds/12/", previews: { "preview-hq-mp3": "https://cdn.freesound.org/previews/0/12_hq.mp3" } },
    { id: 13, name: "door creak 2", username: "quill", license: "Creative Commons 0", url: "https://freesound.org/people/quill/sounds/13/", previews: { "preview-hq-mp3": "https://cdn.freesound.org/previews/0/13_hq.mp3" } },
  ];
  const fsCors = (url: string) => {
    if (url.startsWith("https://freesound.org/apiv2/search/")) return { status: 200, body: JSON.stringify({ results }) };
    if (url.startsWith("https://cdn.freesound.org/")) return { status: 200, body: Buffer.from(clip).toString("base64"), encoding: "base64" };
    return { status: 404, body: "" };
  };

  test("by default a non-commercial sound is passed over for one that allows any use", async () => {
    const h = host({ cors: fsCors });
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    const got = (await h.ask({ type: "sound", description: "an old door creaking open" })).find((m) => m.type === "sound");
    expect(got.credit.by).toBe("tinbox");
    expect(h.box.cleanSettings({}).freesoundLicense).toBe("free");
    expect(h.box.cleanSettings({}).studioMusic).toBe(true);
    expect(h.box.cleanSettings({ studioMusic: false }).studioMusic).toBe(false);
  });

  test("a sound is found, kept with its credit, and the key goes only to freesound.org", async () => {
    const h = host({ cors: fsCors });
    await h.ask({ type: "save", settings: { freesoundLicense: "any" } });
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    const got = (await h.ask({ type: "sound", description: "an old door creaking open" })).find((m) => m.type === "sound");
    expect(got.base64).toBeTruthy();
    expect(got.credit.by).toBe("nightowl");
    expect(got.credit.license).toBe("CC BY-NC");
    const list = (await h.ask({ type: "load" })).find((m) => m.type === "state").sounds;
    expect(list[0].source).toBe("found");
    expect(list[0].credit.page).toBe("https://freesound.org/people/nightowl/sounds/11/");
    const search = h.calls.cors.find((c) => c.url.startsWith("https://freesound.org/apiv2/search/") && c.url.includes("&filter="));
    expect(search.url).toContain("query=old%20door%20creaking%20open");
    expect(search.init.headers.Authorization).toBe("Token fs_key_123");
    for (const c of h.calls.cors) if (!c.url.startsWith("https://freesound.org/")) expect(JSON.stringify(c.init)).not.toContain("fs_key_123");
    expect(h.calls.cors.some((c) => c.url.includes("elevenlabs"))).toBe(false);
  });

  test("the license setting is followed", async () => {
    const h = host({ cors: fsCors });
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    await h.ask({ type: "save", settings: { freesoundLicense: "cc0" } });
    const got = (await h.ask({ type: "sound", description: "an old door creaking open" })).find((m) => m.type === "sound");
    expect(got.credit.by).toBe("quill");
    expect(got.credit.license).toBe("CC0");
  });

  test("Find another picks the next sound and keeps the same library entry", async () => {
    const h = host({ cors: fsCors });
    await h.ask({ type: "save", settings: { freesoundLicense: "any" } });
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    await h.ask({ type: "sound", description: "an old door creaking open" });
    const id = (await h.ask({ type: "load" })).find((m) => m.type === "state").sounds[0].id;
    const again = (await h.ask({ type: "sound_again", id })).find((m) => m.type === "sound");
    expect(again.credit.by).toBe("tinbox");
    const list = (await h.ask({ type: "load" })).find((m) => m.type === "state").sounds;
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(id);
  });

  test("with no Freesound key, ElevenLabs is asked, and with Freesound only it is not", async () => {
    const mp3 = new Uint8Array(400).fill(3);
    const h = host({ cors: () => ({ status: 200, body: Buffer.from(mp3).toString("base64"), encoding: "base64" }) });
    await h.ask({ type: "key_save", key: "sk_test_123" });
    const got = (await h.ask({ type: "sound", description: "rain on a tin roof" })).find((m) => m.type === "sound");
    expect(got.base64).toBeTruthy();
    expect(h.calls.cors.some((c) => c.url.includes("sound-generation"))).toBe(true);
    await h.ask({ type: "save", settings: { soundFrom: "freesound" } });
    const none = (await h.ask({ type: "sound", description: "wind in tall grass" })).find((m) => m.type === "sound");
    expect(none.error).toContain("Save a Freesound key in the Sounds tab");
  });

  test("a refused key and a full day are said in plain words", async () => {
    const h = host({ cors: () => ({ status: 401, body: JSON.stringify({ detail: "Invalid token" }) }) });
    const saved = (await h.ask({ type: "key_save", which: "freesound", key: "fs_bad" })).find((m) => m.type === "key");
    expect(saved.ok).toBe(false);
    expect(saved.text).toContain("Freesound refused the key");
    expect(h.box.freesoundTrouble(429, "")).toContain("2000 a day");
  });
});

describe("what an account has been told", () => {
  test("a new account is marked fresh until something is saved, and the marks are kept", async () => {
    const h = host();
    expect((await h.ask({ type: "load" })).find((m) => m.type === "state").fresh).toBe(true);
    await h.ask({ type: "save", settings: { builtInSeen: "k3x9q", movedSeen: "keepAudio:1ab2 <b>" } });
    const st = (await h.ask({ type: "load" })).find((m) => m.type === "state");
    expect(st.fresh).toBe(false);
    expect(st.settings.builtInSeen).toBe("k3x9q");
    expect(st.settings.movedSeen).toBe("keepAudio:1ab2 b");
  });
});

describe("more settings and Chatterbox, direct", () => {
  test("a person keeps only known settings, in range, and a server address is cleaned", () => {
    const h = host();
    const s = h.box.cleanSettings({ chatterboxUrl: "http://192.0.2.4:8004/v1/", cast: [{ name: "Oriel", params: { exaggeration: 9, cfg_weight: 0.3, direction: "[soft] and low", boost: "yes", rogue: 1 } }] });
    const oriel = s.cast.find((c: any) => c.name === "Oriel");
    expect(oriel.params).toEqual({ exaggeration: 2, cfg_weight: 0.3, direction: "soft and low" });
    expect(s.chatterboxUrl).toBe("http://192.0.2.4:8004");
    expect(h.box.cleanSettings({ chatterboxUrl: "javascript:alert(1)" }).chatterboxUrl).toBe("");
    // A color is kept only as a real #rrggbb code, and the strength stays in range.
    const c = h.box.cleanSettings({ playerAccent: "#FF0040", playerBack: "red", playerInk: "url(x)", wordColor: "#12345", wordStrength: 500 });
    expect([c.playerAccent, c.playerBack, c.playerInk, c.wordColor, c.wordStrength]).toEqual(["#ff0040", "", "", "", 80]);
    expect(h.box.cleanSettings({}).wordStrength).toBe(20);
  });

  test("Acting notes keeps up to 1000 characters, and a direction up to 300", () => {
    const h = host();
    const long = "Low and unhurried, with a dry edge. ".repeat(20);
    const s = h.box.cleanSettings({ cast: [{ name: "Pell", note: long.slice(0, 700), params: { direction: "slow ".repeat(50).trim() } }, { name: "Wren", note: long + long }] });
    const pell = s.cast.find((c: any) => c.name === "Pell");
    expect(pell.note.length).toBe(700);
    expect(pell.params.direction.length).toBe(249);
    expect(s.cast.find((c: any) => c.name === "Wren").note.length).toBe(1000);
  });

  test("the server is read, and a line is spoken with its own settings", async () => {
    const mp3 = Buffer.from(new Uint8Array(300).fill(5)).toString("base64");
    const h = host({
      cors: (url: string, init: any) => {
        if (url.endsWith("/api/model-info")) return { status: 200, body: JSON.stringify({ loaded: true, type: "turbo" }) };
        if (url.endsWith("/get_predefined_voices")) return { status: 200, body: JSON.stringify([{ display_name: "Tamsin", filename: "tamsin.wav" }]) };
        if (url.endsWith("/get_reference_files")) return { status: 200, body: JSON.stringify(["pell.mp3"]) };
        if (url.endsWith("/tts")) return { status: 200, body: mp3, encoding: "base64" };
        return { status: 404, body: "" };
      },
    });
    await h.ask({ type: "save", settings: { chatterboxUrl: "http://192.0.2.4:8004" } });
    const info = (await h.ask({ type: "cbx_info" })).find((m) => m.type === "cbx");
    expect(info.ok).toBe(true);
    expect(info.model).toBe("turbo");
    expect(info.voices.map((v: any) => v.id)).toEqual(["p:tamsin.wav", "c:pell.mp3"]);
    const said = (await h.ask({ type: "cbx_speak", text: "[sigh] Fine.", voice: "c:pell.mp3", params: { exaggeration: 0.9, speed: 1.4, seed: 7 } })).find((m) => m.type === "cbx_audio");
    expect(said.base64).toBe(mp3);
    const sent = JSON.parse(h.calls.cors.find((c) => c.url.endsWith("/tts")).init.body);
    expect(sent).toMatchObject({ text: "[sigh] Fine.", voice_mode: "clone", reference_audio_filename: "pell.mp3", exaggeration: 0.9, speed_factor: 1.4, seed: 7, output_format: "mp3" });
  });

  test("a server that is not running, or runs a model with no tags, says so", async () => {
    const down = host({ cors: () => { throw new Error("connect ECONNREFUSED 192.0.2.4:8004"); } });
    await down.ask({ type: "save", settings: { chatterboxUrl: "http://192.0.2.4:8004" } });
    expect((await down.ask({ type: "cbx_info" })).find((m) => m.type === "cbx").why).toContain("nothing answered");
    const orig = host({ cors: (url: string) => (url.endsWith("/api/model-info") ? { status: 200, body: JSON.stringify({ loaded: true, type: "original" }) } : { status: 200, body: "[]" }) });
    await orig.ask({ type: "save", settings: { chatterboxUrl: "http://192.0.2.4:8004" } });
    expect((await orig.ask({ type: "cbx_info" })).find((m) => m.type === "cbx").why).toContain("Load Chatterbox-Turbo");
  });
});

describe("new speakers", () => {
  test("a nonbinary or main character is kept as the Director says", async () => {
    const answer = JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Rook nodded." }], new_speakers: [{ name: "Rook", gender: "nonbinary", role: "main", about: "low and steady" }, { name: "Porter", gender: "male", role: "minor", about: "tired" }] });
    const h = host({ answers: [answer] });
    await h.ask({ type: "save", settings: { findSpeakers: true } });
    await h.ask({ type: "direct", chatId: "c1", messageId: "m1", swipeId: 0, name: "Ilse", text: 'Rook nodded. "Fine," said Porter.' });
    const cast = (await h.ask({ type: "load" })).find((m) => m.type === "state").settings.cast;
    const rook = cast.find((c: any) => c.name === "Rook");
    const porter = cast.find((c: any) => c.name === "Porter");
    expect(rook && rook.gender).toBe("nonbinary");
    expect(rook && rook.kind).toBe("character");
    expect(porter && porter.kind).toBe("npc");
  });
});

describe("a Personal install", () => {
  test("is said in plain words, for the Director and the Decision model", () => {
    const h = host();
    const e = new Error("Extension is user-scoped and cannot access this user context");
    expect(h.box.generationTrouble(e)).toContain("installed as Personal");
    expect(h.box.generationTrouble(e)).toContain("install it as Operator");
    expect(h.box.decisionTrouble(e)).toContain("installed as Personal");
    expect(h.box.sentence("the Generation permission is refused")).toBe("The Generation permission is refused.");
  });
});

describe("each account keeps its own", () => {
  test("settings, cast, sounds, kept audio, the key and scripts never cross accounts", async () => {
    const good = JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Brin waved." }], new_speakers: [] });
    const h = host({ answers: [good, good] });
    await h.ask({ type: "save", settings: { strength: "dramatic", cast: [{ name: "Brin" }] } }, "alice");
    await h.ask({ type: "sound_link", url: "https://sounds.example.org/bell.mp3", name: "a bell" }, "alice");
    await h.ask({ type: "clip_put", sig: "abc123def", mime: "audio/mpeg", base64: Buffer.from("abcdef").toString("base64") }, "alice");
    await h.ask({ type: "key_save", key: "sk_" + "a".repeat(40) }, "alice");
    await h.ask({ type: "direct", chatId: "c1", messageId: "m1", swipeId: 0, name: "Brin", text: "Brin waved." }, "alice");
    const alice = (await h.ask({ type: "load" }, "alice")).find((m) => m.type === "state");
    expect(alice.settings.strength).toBe("dramatic");
    expect(alice.settings.cast.some((c: any) => c.name === "Brin")).toBe(true);
    expect(alice.sounds.length).toBe(1);
    expect(alice.hasKey).toBe(true);
    const bob = await h.ask({ type: "load" }, "bob");
    const state = bob.find((m) => m.type === "state");
    expect(state.settings.strength).toBe("natural");
    expect(state.settings.cast.some((c: any) => c.name === "Brin")).toBe(false);
    expect(state.sounds.length).toBe(0);
    expect(state.hasKey).toBe(false);
    expect((await h.ask({ type: "clip_get", sig: "abc123def" }, "bob")).find((m) => m.type === "clip").found).toBe(false);
    await h.ask({ type: "direct", chatId: "c1", messageId: "m1", swipeId: 0, name: "Brin", text: "Brin waved." }, "bob");
    // Bob's message is directed for Bob, not taken from Alice's copy.
    expect(h.calls.generate.length).toBe(2);
    expect(h.sent.filter((x) => x.msg.type === "script").every((x) => x.userId === "alice" || x.userId === "bob")).toBe(true);
  });
});

describe("cast pictures", () => {
  test("only a small image in a data address is kept", async () => {
    const h = host();
    const ok = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
    await h.ask({ type: "save", settings: { cast: [{ name: "Pell", picture: ok }, { name: "Odile", picture: "https://example.com/a.png" }, { name: "Brin", picture: "data:text/html;base64,PGI+" }] } });
    const cast = JSON.parse(h.files.get("u1/settings.json")).cast;
    expect(cast.find((c: any) => c.name === "Pell").picture).toBe(ok);
    expect(cast.find((c: any) => c.name === "Odile").picture).toBe("");
    expect(cast.find((c: any) => c.name === "Brin").picture).toBe("");
  });
});

describe("cast groups", () => {
  test("groups are kept, and a person in a group that is gone is in none", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { groups: [{ id: "f1", name: "Harbor town", open: false }, { id: "", name: "No id" }], cast: [{ name: "Pell", group: "f1" }, { name: "Odessa", group: "f9" }] } });
    const saved = JSON.parse(h.files.get("u1/settings.json"));
    expect(saved.groups).toEqual([{ id: "f1", name: "Harbor town", open: false }]);
    expect(saved.cast.find((c: any) => c.name === "Pell").group).toBe("f1");
    expect(saved.cast.find((c: any) => c.name === "Odessa").group).toBe("");
  });

  test("Start again on the cast takes the groups too, and on settings keeps them", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { groups: [{ id: "f1", name: "Harbor town", open: true }], cast: [{ name: "Pell", group: "f1" }] } });
    await h.ask({ type: "reset", parts: ["settings"] });
    expect(JSON.parse(h.files.get("u1/settings.json")).groups.length).toBe(1);
    await h.ask({ type: "reset", parts: ["cast"] });
    expect(JSON.parse(h.files.get("u1/settings.json")).groups).toEqual([]);
  });
});

describe("sounds that make sense where they are", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m6", swipeId: 0, name: "Pell Darrow", text: 'Pell slammed the cellar door. "Stay put." She sat by the window.' };
  const answer = JSON.stringify({
    lines: [
      { i: 0, speaker: "Narrator", text: "Pell slammed the cellar door.", after: "a heavy wooden door slamming shut" },
      { i: 1, speaker: "Pell Darrow", text: "Stay put." },
      { i: 2, speaker: "Narrator", text: "She sat by the window.", after: "thunder rolling over the hills" },
    ],
    new_speakers: [],
  });

  test("a sound the text shows is kept, and one it does not is left out, with a Log line", async () => {
    const h = host({ answers: [answer] });
    await h.ask({ type: "save", settings: { soundStyle: "effects" } });
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    const script = (await h.ask(msg)).find((m) => m.type === "script").script;
    expect(script.lines[0].after).toBe("a heavy wooden door slamming shut");
    expect(script.lines[2].after).toBe("");
    expect(script.log.join(" ")).toContain("1 sound was left out");
  });

  test("with the check off, every sound is kept", async () => {
    const h = host({ answers: [answer] });
    await h.ask({ type: "save", settings: { soundStyle: "effects", soundCheck: false } });
    await h.ask({ type: "key_save", which: "freesound", key: "fs_key_123" });
    const script = (await h.ask(msg)).find((m) => m.type === "script").script;
    expect(script.lines[2].after).toBe("thunder rolling over the hills");
  });

  test("with no sound library and no key, the Director is not asked for sound effects, and the Log says why", async () => {
    const h = host({ answers: [answer] });
    await h.ask({ type: "save", settings: { soundStyle: "effects" } });
    const script = (await h.ask(msg)).find((m) => m.type === "script").script;
    const rules = JSON.parse(h.calls.generate[0].messages[h.calls.generate[0].messages.length - 1].content).rules;
    expect(rules.sounds).toBe(false);
    expect(script.lines.every((l: any) => !l.after && !l.before)).toBe(true);
    expect(script.log.join(" ")).toContain("No sound effects were asked for: your sound library has none and no Freesound or ElevenLabs key is saved.");
  });
});

describe("the prompt's role and the Decision questions", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m7", swipeId: 0, name: "Pell Darrow", text: '"Ready." Pell nodded.' };
  test("the prompt is sent as the role picked", async () => {
    const h = host({ answers: [""] });
    await h.ask({ type: "save", settings: { promptRole: "user" } });
    await h.ask(msg);
    expect(h.calls.generate[0].messages[0].role).toBe("user");
  });

  test("the engine note can go as its own message, and the note after a refusal as the role picked", async () => {
    const h = host({ answers: ["I can't help with that.", ""] });
    await h.ask({ type: "save", settings: { engineNoteRole: "system", askNote: true, askNoteRole: "assistant", retryDirector: 1 } });
    await h.ask(msg);
    const first = h.calls.generate[0].messages;
    expect(first[1].role).toBe("system");
    expect(first[1].content).toContain("ElevenLabs");
    expect(JSON.parse(first[2].content).rules.engine_note).toBeUndefined();
    const second = h.calls.generate[1].messages;
    expect(second[second.length - 1].role).toBe("assistant");
  });

  test("a question the reader wrote is asked, with the line number filled in", async () => {
    let seen: any = null;
    const h = host({ answers: [""], decide: (input: any) => { seen = input; return {}; } });
    await h.ask({ type: "save", settings: { decisionsOn: true, cast: [{ name: "Pell Darrow" }, { name: "Odile" }], decisionQuestions: { who: "Who speaks quote {n}?" } } });
    await h.ask(msg);
    const q = Object.values(seen.questions).find((x: any) => x.type === "choice") as any;
    expect(q.instructions).toBe("Who speaks quote 0?");
  });
});

describe("the Decision model", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m2", swipeId: 0, name: "Mara Vell", text: 'Mara looked at Tobin. "Go." "No," he said.' };
  const setup = async (h: Host) => {
    await h.ask({
      type: "save",
      settings: { decisionsOn: true, cast: [{ id: "a", name: "Mara Vell", kind: "character" }, { id: "b", name: "Tobin", kind: "npc" }] },
    });
  };

  test("its picks are given to the Director as fixed speakers", async () => {
    const h = host({
      answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara looked at Tobin." }] })],
      decide: (input) => {
        const answers: any = {};
        for (const k of Object.keys(input.questions)) {
          if (k.startsWith("who_")) {
            const crit = input.questions[k].criteria;
            const tobin = Object.keys(crit).find((c) => crit[c].startsWith("Tobin"))!;
            answers[k] = { type: "choice", choice: k === "who_1" ? Object.keys(crit).find((c) => crit[c].startsWith("Mara"))! : tobin, confidence: 0.9, probabilities: {} };
          } else answers[k] = { type: "noul", noul: 0.2 };
        }
        return { model: "maker/fast-judge", answers };
      },
    });
    await setup(h);
    const out = await h.ask(msg);
    const sentLines = JSON.parse(h.calls.generate[0].messages[1].content).lines;
    expect(sentLines.find((l: any) => l.i === 1).speaker).toBe("Mara Vell");
    expect(sentLines.find((l: any) => l.i === 2).speaker).toBe("Tobin");
    const script = out.find((m) => m.type === "script").script;
    expect(script.log.join(" ")).toContain("fast-judge picked the speaker for 2 of 2");
  });

  test("each answer is listed for the Log, and the line it needs can be changed", async () => {
    const decide = (input: any) => {
      const answers: any = {};
      for (const k of Object.keys(input.questions)) {
        if (k.startsWith("who_")) {
          const crit = input.questions[k].criteria;
          answers[k] = { type: "choice", choice: Object.keys(crit).find((c) => crit[c].startsWith("Tobin"))!, confidence: 0.65, probabilities: {} };
        } else answers[k] = { type: "noul", noul: 0.4 };
      }
      return { model: "maker/fast-judge", answers };
    };
    const lines = [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara looked at Tobin." }] })];
    const h = host({ answers: lines.concat(lines), decide });
    await setup(h);
    const first = (await h.ask(msg)).find((m) => m.type === "script").script;
    expect(first.decided[0]).toBe("fast-judge answered. An answer is used at 50% sure or more.");
    expect(first.decided).toContain('"Go." is Tobin, 65% sure. Used.');
    expect(first.decided).toContain('"Mara looked at Tobin." describes a sound: 40%.');
    await h.ask({ type: "save", settings: { decisionsOn: true, decisionSure: 80, cast: [{ id: "a", name: "Mara Vell", kind: "character" }, { id: "b", name: "Tobin", kind: "npc" }] } });
    const second = (await h.ask(Object.assign({}, msg, { messageId: "m3" }))).find((m) => m.type === "script").script;
    expect(second.decided[0]).toContain("used at 80% sure");
    expect(second.decided).toContain('"Go." is Tobin, 65% sure. Left to the Director.');
    expect(second.log.join(" ")).toContain("picked the speaker for 0 of 2");
  });

  test("the Log shows how close the call was", async () => {
    const h = host({
      answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara looked at Tobin." }] })],
      decide: (input: any) => {
        const answers: any = {};
        for (const k of Object.keys(input.questions)) {
          if (!k.startsWith("who_")) continue;
          const crit = input.questions[k].criteria;
          const tobin = Object.keys(crit).find((c) => crit[c].startsWith("Tobin"))!;
          const mara = Object.keys(crit).find((c) => crit[c].startsWith("Mara"))!;
          answers[k] = { type: "choice", choice: tobin, confidence: 0.7, probabilities: { [tobin]: 0.7, [mara]: 0.25, other: 0.05 } };
        }
        return { model: "maker/fast-judge", answers };
      },
    });
    await setup(h);
    const script = (await h.ask(msg)).find((m) => m.type === "script").script;
    expect(script.decided).toContain('"Go." is Tobin, 70% sure. Used. Next: Mara Vell 25%, someone else 5%.');
  });

  test("a pick it is unsure of is left to the Director", async () => {
    const h = host({
      answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara looked at Tobin." }] })],
      decide: (input) => {
        const answers: any = {};
        for (const k of Object.keys(input.questions)) answers[k] = k.startsWith("who_") ? { type: "choice", choice: "p0", confidence: 0.3 } : { type: "noul", noul: 0.1 };
        return { model: "x", answers };
      },
    });
    await setup(h);
    await h.ask(msg);
    const sentLines = JSON.parse(h.calls.generate[0].messages[1].content).lines;
    expect(sentLines.every((l: any) => !l.speaker)).toBe(true);
  });

  test("when it cannot be asked, the Log says why in plain words and the Director carries on", async () => {
    const h = host({ answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara looked at Tobin." }] })] });
    await setup(h);
    const out = await h.ask(msg);
    const log = out.find((m) => m.type === "script").script.log.join(" ");
    expect(log).toContain("there is no default Decision connection");
    expect(h.calls.generate.length).toBe(1);
  });

  test("an old Lumiverse with no Decision connections says so", async () => {
    const h = host({ answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara looked at Tobin." }] })], noDecisions: true });
    await setup(h);
    const out = await h.ask(msg);
    expect(out.find((m) => m.type === "script").script.log.join(" ")).toContain("Update Lumiverse");
  });

  test("each Lumiverse error has its own words", () => {
    const h = host();
    expect(h.box.decisionTrouble(new Error("Decision connection not found"))).toContain("is gone");
    expect(h.box.decisionTrouble(new Error("No readable API key for Decision connection x"))).toContain("no key saved");
    expect(h.box.decisionTrouble(new Error("PERMISSION_DENIED: decisions"))).toContain("permission is refused");
    expect(h.box.decisionTrouble(new Error("timed out after 30000ms"))).toContain("30 seconds");
  });
});

describe("asking again", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m7", swipeId: 0, name: "Mara Vell", text: 'Mara set the cup down. "Fine."' };
  const good = JSON.stringify({ lines: [{ i: 1, speaker: "Mara Vell", text: "[flatly] Fine." }] });

  test("a busy provider is waited out, and the Log says so", async () => {
    const h = host({ answers: [new Error("Provider stream failed (429): rate limit reached"), good] });
    const out = await h.ask(msg);
    const script = out.find((m) => m.type === "script").script;
    expect(h.calls.generate.length).toBe(2);
    expect(script.directed).toBe(true);
    expect(script.log.join(" ")).toContain("busy");
  });

  test("a refused key is not asked again", async () => {
    const h = host({ answers: [new Error("Provider stream failed (401): invalid api key"), good] });
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(1);
  });

  test("an answer that cannot be read is asked for again", async () => {
    const h = host({ answers: ["not json", good] });
    const out = await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
    expect(out.find((m) => m.type === "script").script.directed).toBe(true);
  });

  test("an answer that changed most words is asked for again", async () => {
    const changed = JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara put the mug away." }, { i: 1, speaker: "Mara Vell", text: "Okay." }] });
    const h = host({ answers: [changed, good] });
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
  });

  test("with both counts at 0, nothing is asked again", async () => {
    const h = host({ answers: [new Error("Provider stream failed (503): overloaded"), good] });
    await h.ask({ type: "save", settings: { rateWaits: 0, retryDirector: 0 } });
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(1);
  });

  test("a busy answer when making a sound is waited out", async () => {
    let n = 0;
    const mp3 = Buffer.from(new Uint8Array(200).fill(9)).toString("base64");
    const h = host({ cors: (url) => (url.includes("subscription") ? { status: 200, body: "{}" } : ++n === 1 ? { status: 429, body: "{}", headers: { "retry-after": "1" } } : { status: 200, body: mp3 }) });
    await h.ask({ type: "key_save", key: "sk_x" });
    const out = await h.ask({ type: "sound", description: "rain on a tin roof" });
    expect(out.find((m) => m.type === "sound").base64).toBe(mp3);
    expect(n).toBe(2);
  });
});

describe("a Director that refuses", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m8", swipeId: 0, name: "Mara Vell", text: 'Mara set the cup down. "Fine."' };
  const good = JSON.stringify({ lines: [{ i: 1, speaker: "Mara Vell", text: "[flatly] Fine." }] });

  test("a refusal is asked again, with a note that says it is fiction", async () => {
    const h = host({ answers: ["I'm sorry, but I can't help with that request.", good] });
    await h.ask({ type: "save", settings: { askNote: true } });
    const out = await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
    const second = h.calls.generate[1].messages;
    expect(second[second.length - 1].content).toContain("fiction from my own story");
    const script = out.find((m) => m.type === "script").script;
    expect(script.directed).toBe(true);
    expect(script.log.join(" ")).toContain("declined to direct");
  });

  test("a refusal sent as a content filter error is asked again too", async () => {
    const h = host({ answers: [new Error("The provider stopped the response because of a content filter (content_filter)."), good] });
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
  });

  test("with notes off, it is asked again with no note", async () => {
    const h = host({ answers: ["As an AI language model, I cannot do that.", good] });
    await h.ask({ type: "save", settings: { askNote: false } });
    await h.ask(msg);
    const second = h.calls.generate[1].messages;
    expect(second.length).toBe(2);
  });

  test("by default no note is sent when it asks again, so the ask costs no more", async () => {
    const h = host({ answers: ["I'm sorry, but I can't help with that request.", good] });
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
    const first = h.calls.generate[0].messages;
    const second = h.calls.generate[1].messages;
    expect(second.length).toBe(first.length);
    expect(JSON.stringify(second).indexOf("fiction from my own story")).toBe(-1);
  });

  test("a note the reader wrote is sent instead of the built-in one", async () => {
    const h = host({ answers: ["I'm sorry, but I can't assist with that.", good] });
    await h.ask({ type: "save", settings: { askNote: true, askNotes: { refused: "Please just tag it." } } });
    await h.ask(msg);
    const second = h.calls.generate[1].messages;
    expect(second[second.length - 1].content).toBe("Please just tag it.");
  });

  test("with nothing left to try, the message is still read as written", async () => {
    const h = host({ answers: ["I can't help with that.", "Still no."] });
    const out = await h.ask(msg);
    const script = out.find((m) => m.type === "script").script;
    expect(script.directed).toBe(false);
    expect(script.lines.map((l: any) => l.text)).toEqual(["Mara set the cup down.", "Fine."]);
    expect(script.log.join(" ")).toContain("read as written");
  });

  test("a long scene that happens to hold refusal words is not a refusal", () => {
    const h = host();
    const scene = "I can't do this anymore, she said, and the rain kept on. " + "The road ran on past the mill and the river. ".repeat(40);
    expect(h.box.answerRefused(scene)).toBe(false);
  });

  test("thinking, samplers and the connection go with the ask", async () => {
    const h = host({ answers: [good] });
    await h.ask({ type: "save", settings: { thinkingMode: "custom", thinkingEffort: "medium", samplers: { temperature: 0.6, top_k: "" }, directorConnection: "fast" } });
    await h.ask(msg);
    const req = h.calls.generate[0];
    expect(req.reasoning).toEqual({ source: "custom", effort: "medium" });
    expect(req.parameters).toEqual({ temperature: 0.6 });
    expect(req.connection_id).toBe("fast");
  });
});

describe("Start again", () => {
  test("only the chosen parts are put back", async () => {
    const h = host({ cors: () => ({ status: 200, body: "{}" }) });
    await h.ask({ type: "save", settings: { strength: "dramatic", prompt: "My own prompt", cast: [{ id: "x", name: "Ilse", kind: "character", voice: "v9" }] } });
    const out = await h.ask({ type: "reset", parts: ["settings"] });
    const r = out.find((m) => m.type === "reset");
    expect(r.ok).toBe(true);
    expect(r.settings.strength).toBe("natural");
    expect(r.settings.prompt).toBe("My own prompt");
    expect(r.settings.cast.some((c: any) => c.name === "Ilse")).toBe(true);
  });

  test("everything chosen deletes everything Auto Foley keeps", async () => {
    const h = host({ cors: () => ({ status: 200, body: "{}" }) });
    await h.ask({ type: "save", settings: { strength: "dramatic", prompt: "Mine", cast: [{ id: "x", name: "Ilse", kind: "character" }] } });
    await h.ask({ type: "sound_upload", name: "a.mp3", mime: "audio/mpeg", base64: h.box.toBase64(new Uint8Array(100).fill(3)) });
    await h.ask({ type: "key_save", key: "sk_x" });
    const out = await h.ask({ type: "reset", parts: ["settings", "prompt", "cast", "sounds", "key"] });
    const r = out.find((m) => m.type === "reset");
    expect(r.settings.prompt).toBe("");
    expect(r.settings.cast.map((c: any) => c.kind)).toEqual(["narrator"]);
    expect(r.sounds).toEqual([]);
    expect(r.hasKey).toBe(false);
    expect([...h.files.keys()].some((k) => k.startsWith("u1/sounds/u"))).toBe(false);
  });
});

describe("who is in the scene, read on this device", () => {
  const h = host();
  const cast = h.box.cleanSettings({ cast: [{ id: "a", name: "Wren Halloway", kind: "character" }, { id: "b", name: "Odile", kind: "persona", aliases: ["the courier"] }] }).cast;
  const read = (t: string, author = "Wren Halloway") => h.box.readScene(h.box.splitSegments(t), cast, author);

  test("a speech verb after the quote names the speaker", () => {
    expect(read('"Not tonight," Odile said.').named).toEqual({ 0: "Odile" });
  });

  test("the verb first works too", () => {
    expect(read('"Not tonight," said Wren.').named).toEqual({ 0: "Wren Halloway" });
  });

  test("a name with a speech verb before the quote", () => {
    expect(read('Odile whispered: "Keep walking."').named).toEqual({ 1: "Odile" });
  });

  test("an action just before a quote only points at someone", () => {
    const got = read('Wren shut the ledger. "Done."');
    expect(got.named).toEqual({});
    expect(got.likely).toEqual({ 1: "Wren Halloway" });
  });

  test("a pronoun names nobody", () => {
    expect(read('"Fine," she said.').named).toEqual({});
  });

  test("someone new who speaks is found", () => {
    const got = read('"Tickets," Barnaby said.');
    expect(got.found).toEqual(["Barnaby"]);
    expect(got.named).toEqual({ 0: "Barnaby" });
  });

  test("a name and a colon before a quote names the speaker", () => {
    expect(read('Odile: "The tide is turning."').named[1]).toBe("Odile");
  });

  test("a line in script style is that person speaking, and only for someone in the cast", () => {
    const r = read("Odile: The tide is turning.\n\nNote: the ferry is late.");
    expect(r.script[0]).toEqual({ name: "Odile", text: "The tide is turning." });
    expect(r.script[1]).toBeUndefined();
  });

  test("the same speaker goes on in a paragraph until someone else is named", () => {
    const segs = h.box.splitSegments('"Go," Odile said. She glanced back. "Now."\n\n"Wait," Odile said. Wren shook her head. "No."');
    const r = h.box.readScene(segs, cast, "Odile");
    expect(r.likely[segs.find((x: any) => x.text === "Now.").i]).toBe("Odile");
    // Wren is named between them, so it is not Odile going on. The action
    // points at Wren instead.
    expect(r.likely[segs.find((x: any) => x.text === "No.").i]).toBe("Wren Halloway");
  });

  test("two people taking turns, paragraph by paragraph", () => {
    const segs = h.box.splitSegments('"Ready?" Odile asked.\n\n"Always," Wren said.\n\n"Then follow me."\n\n"Lead on."');
    const r = h.box.readScene(segs, cast, "Odile");
    expect(r.likely[segs.find((x: any) => x.text === "Then follow me.").i]).toBe("Odile");
    expect(r.likely[segs.find((x: any) => x.text === "Lead on.").i]).toBe("Wren Halloway");
  });

  test("everyone named in the message is in the scene, the author first", () => {
    expect(read('The courier waved. "Morning."', "Wren Halloway").inScene).toEqual(["Wren Halloway", "Odile"]);
  });

  test("a found speaker is added to the cast, marked as found in the text", async () => {
    const h2 = host({ answers: [JSON.stringify({ lines: [{ i: 0, speaker: "Barnaby", text: "Tickets," }] })] });
    await h2.ask({ type: "direct", chatId: "c", messageId: "m", swipeId: 0, name: "Wren Halloway", text: '"Tickets," Barnaby said.' });
    const saved = JSON.parse(h2.files.get("u1/settings.json"));
    expect(saved.cast.find((c: any) => c.name === "Barnaby").addedBy).toBe("found");
  });
});

describe("a script is kept after people join the cast", () => {
  // Someone found in the text joins the cast while the message is directed.
  // The script is kept under the cast as it is after that, so the same
  // message played again uses it, and nothing is directed or spoken again.
  const answer = JSON.stringify({ lines: [{ i: 0, speaker: "Barnaby", text: "Tickets," }] });
  const msg = { type: "direct", chatId: "c", messageId: "m", swipeId: 0, name: "Wren Halloway", text: '"Tickets," Barnaby said.' };

  test("with the Director on", async () => {
    const h = host({ answers: [answer, answer] });
    await h.ask(msg);
    const again = await h.ask(msg);
    expect(h.calls.generate.length).toBe(1);
    expect(again.find((m) => m.type === "script").script.log.join(" ")).toContain("Played from the copy directed before.");
  });

  test("with the Director off", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { directorOn: false } });
    await h.ask(msg);
    const again = await h.ask(msg);
    expect(again.find((m) => m.type === "script").script.log.join(" ")).toContain("Played from the copy directed before.");
  });
});

describe("a message is directed once", () => {
  // A script is found by the message itself, so a changed setting, an
  // update or a restart plays what was kept. Direct again asks anew.
  const answer = JSON.stringify({ lines: [{ i: 0, speaker: "Pell Arden", text: "[gruffly] Tide turns at six." }] });
  const msg = { type: "direct", chatId: "c", messageId: "m7", swipeId: 0, name: "Pell Arden", text: '"Tide turns at six."' };
  const said = (out: any[]) => out.find((m) => m.type === "script").script.log.join(" ");

  test("a changed setting still plays the kept script", async () => {
    const h = host({ answers: [answer, answer] });
    await h.ask(msg);
    await h.ask({ type: "save", settings: { strength: "dramatic", breathsOn: false } });
    const again = await h.ask(msg);
    expect(h.calls.generate.length).toBe(1);
    expect(said(again)).toContain("Played from the copy directed before.");
    expect(again.find((m) => m.type === "script").script.fromKept).toBe(true);
  });

  test("Direct again asks the Director anew", async () => {
    const h = host({ answers: [answer, answer] });
    await h.ask(msg);
    await h.ask(Object.assign({}, msg, { fresh: true }));
    expect(h.calls.generate.length).toBe(2);
  });

  test("changed words direct it again", async () => {
    const seven = JSON.stringify({ lines: [{ i: 0, speaker: "Pell Arden", text: "[gruffly] Tide turns at seven." }] });
    const h = host({ answers: [answer, seven] });
    await h.ask(msg);
    await h.ask(Object.assign({}, msg, { text: '"Tide turns at seven."' }));
    expect(h.calls.generate.length).toBe(2);
  });

  test("a script kept under an older key is found after a restart", async () => {
    const h = host({ answers: [answer, answer] });
    await h.ask(msg);
    // As an earlier version kept it: the same message and lines, another key.
    const file = JSON.parse(h.files.get("u1/scripts.json"));
    for (const x of file) x.key = x.script.key = "older";
    const h2 = host({ answers: [answer], files: new Map([...h.files, ["u1/scripts.json", JSON.stringify(file)]]) });
    const again = await h2.ask(msg);
    expect(h2.calls.generate.length).toBe(0);
    expect(said(again)).toContain("Played from the copy directed before.");
  });
});

describe("counting the Director's tokens", () => {
  test("uses the tokenizer of the Director's model, not the main one", async () => {
    const good = JSON.stringify({ lines: [{ i: 0, speaker: "Oriel", text: "[quietly] Lanterns up." }] });
    const h = host({
      answers: [good],
      tokens: true,
      connections: [
        { id: "main", name: "Main", provider: "anthropic", model: "big-model", is_default: true },
        { id: "quick", name: "Quick", provider: "openai", model: "small-model", is_default: false },
      ],
    });
    await h.ask({ type: "save", settings: { directorConnection: "quick" } });
    await h.ask({ type: "direct", chatId: "c", messageId: "m12", swipeId: 0, name: "Oriel", text: '"Lanterns up."' });
    expect(h.calls.counted.length).toBeGreaterThan(0);
    expect(h.calls.counted.every((m: any) => m === "small-model")).toBe(true);
  });
});

describe("saved audio", () => {
  const good = JSON.stringify({ lines: [{ i: 0, speaker: "Oriel", text: "[quietly] Lanterns up." }] });
  const msg = { type: "direct", chatId: "c4", messageId: "m20", swipeId: 0, name: "Oriel", text: '"Lanterns up."' };

  test("lists a saved script with who, when, its chat and its first line", async () => {
    const h = host({ answers: [good] });
    await h.ask(msg);
    const out = await h.ask({ type: "kept_list" });
    const list = out.find((m: any) => m.type === "kept_list").list;
    expect(list.length).toBe(1);
    expect(list[0].messageId).toBe("m20");
    expect(list[0].chatId).toBe("c4");
    expect(list[0].author).toBe("Oriel");
    expect(list[0].first).toBe("Lanterns up.");
    expect(list[0].keptAt).toBeGreaterThan(0);
  });

  test("Delete takes the script and its saved audio away", async () => {
    const h = host({ answers: [good, good] });
    await h.ask(msg);
    await h.ask({ type: "clip_put", sig: "abc123def", mime: "audio/mpeg", base64: h.box.toBase64(new Uint8Array(50).fill(3)) });
    const key = (await h.ask({ type: "kept_list" })).find((m: any) => m.type === "kept_list").list[0].key;
    const gone = (await h.ask({ type: "kept_drop", key, sigs: ["abc123def"] })).find((m: any) => m.type === "kept_dropped");
    expect(gone.ok).toBe(true);
    expect(gone.clips).toBe(1);
    expect((await h.ask({ type: "kept_list" })).find((m: any) => m.type === "kept_list").list.length).toBe(0);
    expect((await h.ask({ type: "clip_get", sig: "abc123def" })).find((m: any) => m.type === "clip").found).toBe(false);
    // Played again, it is directed again, since nothing is saved for it.
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(2);
  });
});

describe("the second Director", () => {
  const good = JSON.stringify({ lines: [{ i: 0, speaker: "Oriel", text: "[quietly] Lanterns up." }] });
  const msg = { type: "direct", chatId: "c", messageId: "m11", swipeId: 0, name: "Oriel", text: '"Lanterns up."' };
  const said = (out: any[]) => out.find((m) => m.type === "script").script;

  test("is asked on its own connection when the first refuses", async () => {
    const h = host({ answers: ["I can't help with that.", good] });
    await h.ask({ type: "save", settings: { retryDirector: 0, backupOn: true, backupConnection: "second" } });
    const sc = said(await h.ask(msg));
    expect(h.calls.generate.length).toBe(2);
    expect(h.calls.generate[0].connection_id).toBeUndefined();
    expect(h.calls.generate[1].connection_id).toBe("second");
    expect(sc.directed).toBe(true);
    expect(sc.log.join(" ")).toContain("The second Director directed the message.");
  });

  test("when it fails too, the message is read as written", async () => {
    const h = host({ answers: ["I can't help with that.", "I won't do that."] });
    await h.ask({ type: "save", settings: { retryDirector: 0, backupOn: true, backupConnection: "second" } });
    const sc = said(await h.ask(msg));
    expect(h.calls.generate.length).toBe(2);
    expect(sc.directed).toBe(false);
    expect(sc.log.join(" ")).toContain("The message is read as written.");
  });

  test("is not asked while it is off", async () => {
    const h = host({ answers: ["I can't help with that.", good] });
    await h.ask({ type: "save", settings: { retryDirector: 0, backupConnection: "second" } });
    await h.ask(msg);
    expect(h.calls.generate.length).toBe(1);
  });
});

describe("a message the Director could not direct", () => {
  const msg = { type: "direct", chatId: "c", messageId: "m30", swipeId: 0, name: "Oriel", text: '"Lanterns up."' };
  const good = JSON.stringify({ lines: [{ i: 0, speaker: "Oriel", text: "[quietly] Lanterns up." }] });
  const script = (out: any[]) => out.find((m: any) => m.type === "script").script;

  test("is kept, read as written and marked, so the next play asks nothing", async () => {
    const h = host({ answers: ["I can't help with that.", good] });
    await h.ask({ type: "save", settings: { retryDirector: 0 } });
    const first = script(await h.ask(msg));
    expect(first.directed).toBe(false);
    expect(first.fallback).toBe(true);
    const again = script(await h.ask(msg));
    expect(h.calls.generate.length).toBe(1);
    expect(again.fromKept).toBe(true);
    expect(again.fallback).toBe(true);
    const list = (await h.ask({ type: "kept_list" })).find((m: any) => m.type === "kept_list").list;
    expect(list[0].how).toBe("fallback");
  });

  test("Direct again asks the Director, and keeps its script", async () => {
    const h = host({ answers: ["I can't help with that.", good] });
    await h.ask({ type: "save", settings: { retryDirector: 0 } });
    await h.ask(msg);
    const fresh = script(await h.ask(Object.assign({}, msg, { fresh: true })));
    expect(h.calls.generate.length).toBe(2);
    expect(fresh.directed).toBe(true);
    expect(fresh.fallback).toBeFalsy();
    const list = (await h.ask({ type: "kept_list" })).find((m: any) => m.type === "kept_list").list;
    expect(list[0].how).toBe("directed");
  });

  test("with the Director off, it is marked as off", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { directorOn: false } });
    await h.ask(msg);
    const list = (await h.ask({ type: "kept_list" })).find((m: any) => m.type === "kept_list").list;
    expect(list[0].how).toBe("off");
  });
});

describe("Stop while the script is written", () => {
  test("cancels the Director's call, and keeps nothing", async () => {
    const h = host({ hold: true });
    // No time limit, since every wait here runs at once.
    await h.ask({ type: "save", settings: { timeoutSecs: 0 } });
    const msg = { type: "direct", chatId: "c", messageId: "m9", swipeId: 0, name: "Oriel", text: '"Lanterns up."' };
    const going = h.ask(msg);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.calls.generate.length).toBe(1);
    expect(h.calls.generate[0].signal.aborted).toBe(false);
    await h.ask({ type: "direct_stop" });
    const out = await going;
    expect(h.calls.generate[0].signal.aborted).toBe(true);
    expect(h.calls.generate.length).toBe(1);
    const log = out.find((m: any) => m.type === "script").script.log.join(" ");
    expect(log).toContain("Stopped before the Director answered.");
    expect(h.files.has("u1/scripts.json")).toBe(false);
  });
});

describe("sounds", () => {
  const mp3 = new Uint8Array(200).fill(7);

  test("a sound in the library is used, and ElevenLabs is not asked", async () => {
    const h = host();
    await h.ask({ type: "sound_upload", name: "glass-shatter.mp3", mime: "audio/mpeg", base64: h.box.toBase64(mp3), triggers: ["glass"] });
    const out = await h.ask({ type: "sound", description: "a wine glass breaking on tile" });
    expect(out.find((m) => m.type === "sound").base64).toBe(h.box.toBase64(mp3));
    expect(h.calls.cors.length).toBe(0);
  });

  test("with no key and no match, the answer says how to get one", async () => {
    const h = host();
    const out = await h.ask({ type: "sound", description: "a kettle whistling" });
    expect(out.find((m) => m.type === "sound").error).toContain("Save a Freesound key or an ElevenLabs key in the Sounds tab");
  });

  test("a made sound is kept, so the same description is free next time", async () => {
    const h = host({ cors: () => ({ status: 200, body: Buffer.from(mp3).toString("base64"), encoding: "base64" }) });
    await h.ask({ type: "key_save", key: "sk_test_123" });
    const before = h.calls.cors.length;
    const first = await h.ask({ type: "sound", description: "a kettle whistling" });
    expect(first.find((m) => m.type === "sound").base64).toBeTruthy();
    await h.ask({ type: "sound", description: "a kettle whistling" });
    expect(h.calls.cors.length - before).toBe(1);
    const sent = h.calls.cors.find((c) => c.url.includes("sound-generation"));
    expect(sent.init.headers["xi-api-key"]).toBe("sk_test_123");
    expect(sent.url.startsWith("https://api.elevenlabs.io/")).toBe(true);
  });

  test("a refused key is said in plain words", async () => {
    const h = host({ cors: (url) => (url.includes("subscription") ? { status: 200, body: "{}" } : { status: 401, body: '{"detail":{"message":"Invalid API key"}}' }) });
    await h.ask({ type: "key_save", key: "sk_bad" });
    const out = await h.ask({ type: "sound", description: "a kettle whistling" });
    const err = out.find((m) => m.type === "sound").error;
    expect(err).toContain("refused the key");
    expect(err).toContain("Invalid API key");
  });

  test("an error ElevenLabs sends where a sound should be is explained", async () => {
    const h = host({ cors: () => { throw new Error("CORS proxy transparent proxy only serves audio data (received Content-Type: application/json)"); } });
    await h.ask({ type: "key_save", key: "sk_x" });
    const out = await h.ask({ type: "sound", description: "a kettle whistling" });
    expect(out.find((m) => m.type === "sound").error).toContain("answered with an error instead of a sound");
  });

  test("a key with a line break in it is refused before it is saved", async () => {
    const h = host();
    const out = await h.ask({ type: "key_save", key: "sk_a\nsk_b" });
    expect(out.find((m) => m.type === "key").text).toContain("does not look like");
    expect(h.keys.size).toBe(0);
  });

  test("the key never goes back to the panel", async () => {
    const h = host({ cors: () => ({ status: 200, body: '{"character_count":10,"character_limit":100}' }) });
    await h.ask({ type: "key_save", key: "sk_secret_value" });
    const all = await h.ask({ type: "load" });
    expect(JSON.stringify(h.sent)).not.toContain("sk_secret_value");
    expect(all.find((m) => m.type === "state").hasKey).toBe(true);
  });

  test("an upload that is not a sound is refused", async () => {
    const h = host();
    const out = await h.ask({ type: "sound_upload", name: "a.png", mime: "image/png", base64: "AAAA" });
    expect(out.find((m) => m.type === "uploaded").error).toContain("not a sound");
  });

  test("an upload over 3 MB is refused", async () => {
    const h = host();
    const big = new Uint8Array(3 * 1024 * 1024 + 10);
    const out = await h.ask({ type: "sound_upload", name: "big.mp3", mime: "audio/mpeg", base64: h.box.toBase64(big) });
    expect(out.find((m) => m.type === "uploaded").error).toContain("larger than 3 MB");
  });

  test("base64 survives the round trip", () => {
    const h = host();
    for (const n of [0, 1, 2, 3, 4, 255, 1000]) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 37) % 256);
      expect(Array.from(h.box.fromBase64(h.box.toBase64(bytes)))).toEqual(Array.from(bytes));
      expect(h.box.toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });
});

describe("settings", () => {
  test("anything broken in a saved file takes its default, and the narrator is always there", () => {
    const h = host();
    const s = h.box.cleanSettings({ strength: "loud", voiceVolume: 9, cast: [{ name: "" }, null, { name: "Ana", stability: "x", speed: 5 }] });
    expect(s.strength).toBe("natural");
    expect(s.voiceVolume).toBe(1);
    expect(s.cast[0].kind).toBe("narrator");
    const ana = s.cast.find((c: any) => c.name === "Ana");
    expect(ana.stability).toBe(0.5);
    // Fish Audio and Chatterbox take up to 2. The panel keeps an ElevenLabs
    // voice to 1.2.
    expect(ana.speed).toBe(2);
  });

  test("one account never sees another's settings", async () => {
    const h = host();
    await h.ask({ type: "save", settings: { strength: "dramatic" } }, "alice");
    const out = await h.ask({ type: "load" }, "bob");
    expect(out.find((m) => m.type === "state").settings.strength).toBe("natural");
  });

  test("a failed save warns, since nothing else on screen would say so", async () => {
    const h = host();
    h.box.spindle.userStorage.write = async () => {
      throw new Error("disk full");
    };
    const out = await h.ask({ type: "save", settings: {} });
    expect(out.find((m) => m.type === "saved").ok).toBe(false);
    expect(h.toasts.some((t) => t.kind === "warning" && t.userId === "u1")).toBe(true);
  });

  test("the connection list failing is said in plain words", async () => {
    const h = host({ connections: new Error("PERMISSION_DENIED: generation") });
    const out = await h.ask({ type: "list_connections" });
    expect(out.find((m) => m.type === "connections").why).toContain("Generation permission is refused");
  });
});

describe("thinking formats, the same nine as Auto Retry and Auto Refine", () => {
  const h = host();
  const said = (t: string, extra?: string[], bound?: any[]) =>
    h.box.splitSegments(t, extra, bound).map((s: any) => s.text).join(" | ");
  const REPLY = '"The bridge is out," Brannoc said.';
  const want = "The bridge is out, | Brannoc said.";
  const FORMATS: [string, string, string][] = [
    ["angle brackets", "<think>He is bluffing.</think>", "<think>He is bluffing."],
    ["angle brackets, other name", "<reasoning>Plan it.</reasoning>", "<reasoning>Plan it."],
    ["square brackets", "[thinking]Wait for it.[/thinking]", "[thinking]Wait for it."],
    ["Mistral", "[THINK]Short one.[/THINK]", "[THINK]Short one."],
    ["pipes", "<|think|>Count the boats.<|/think|>", "<|think|>Count the boats."],
    ["pipes, other way round", "<|think>Count again.<think|>", "<|think>Count again."],
    ["Harmony", "<|channel|>analysis<|message|>Check the map.<|end|><|start|>assistant<|channel|>final<|message|>", "<|channel|>analysis<|message|>Check the map."],
    ["Gemma 4", "<|channel>thought Look left.<channel|>", "<|channel>thought Look left."],
    ["Cohere", "<|START_THINKING|>Weigh it.<|END_THINKING|>", "<|START_THINKING|>Weigh it."],
    ["Seed-OSS", "<seed:think>Slow down.</seed:think>", "<seed:think>Slow down."],
    ["begin and end of thought", "<|begin_of_thought|>Hm.<|end_of_thought|>", "<|begin_of_thought|>Hm."],
    ["Kimi", "◁think▷Quietly now.◁/think▷", "◁think▷Quietly now."],
  ];
  for (const [name, closed, open] of FORMATS) {
    test(name + ", closed", () => {
      expect(said(closed + REPLY)).toBe(want);
    });
    test(name + ", opened with no closer", () => {
      expect(said(REPLY + " " + open)).toBe(want);
    });
  }

  test("a closer with no opener: the opener was in the prompt", () => {
    expect(said("still deciding what to say</think>" + REPLY)).toBe(want);
  });

  test("an empty Gemma pair is taken out", () => {
    expect(said("<|channel>thought<channel|>" + REPLY)).toBe(want);
  });

  test("extra thinking tag names", () => {
    expect(said("<musing>Not yet.</musing>" + REPLY, ["musing"])).toBe(want);
    expect(said("<musing>Not yet.</musing>" + REPLY, [])).toContain("Not yet.");
  });

  test("an extra name that is not a plain word is ignored", () => {
    expect(said(REPLY, ["a|b", "(x)"])).toBe(want);
  });

  test("a Prefix and Suffix saved on a connection", () => {
    const bound = [{ needs: "~~plan", open: "~~plan", close: "plan~~" }];
    expect(said("~~plan quietly~~ ok plan~~" + REPLY, [], bound)).toBe(want);
  });

  test("they are read from the connections, and short ones are ignored", async () => {
    const h2 = host({ answers: [JSON.stringify({ lines: [] })], connections: [
      { id: "c1", reasoning_bindings: { settings: { prefix: "%%plan", suffix: "%%done" } } },
      { id: "c2", reasoning_bindings: { settings: { prefix: "*", suffix: "*" } } },
    ] });
    const out = await h2.ask({ type: "direct", chatId: "c", messageId: "m", swipeId: 0, name: "Brannoc", text: "%%plan wait %%done" + REPLY });
    const script = out.find((m) => m.type === "script").script;
    expect(script.lines.map((l: any) => l.text).join(" | ")).toBe(want);
  });
});

describe("scene music", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m1", swipeId: 0, name: "Mara Vell", text: 'The lamps went out. "Stay low." Nobody came back.' };
  const reply = JSON.stringify({
    lines: [
      { i: 0, speaker: "Narrator", text: "The lamps went out.", mood: "Tense" },
      { i: 1, speaker: "Mara Vell", text: "Stay low.", mood: "furious" },
      { i: 2, speaker: "Narrator", text: "Nobody came back.", mood: "sad" },
    ],
    new_speakers: [],
  });

  test("with Scene music on, the Director is given the moods, and a mood it names is kept", async () => {
    const h = host({ answers: [reply] });
    await h.ask({ type: "save", settings: { musicOn: true } });
    const out = await h.ask(msg);
    const sent = JSON.stringify(h.calls.generate[0]);
    expect(sent.indexOf('\\"music\\":true')).toBeGreaterThan(-1);
    expect(sent.indexOf("mysterious")).toBeGreaterThan(-1);
    const lines = out.find((m: any) => m.type === "script").script.lines;
    // A mood not on the list is dropped, and the case does not matter.
    expect(lines.map((l: any) => l.mood || "")).toEqual(["tense", "", "sad"]);
  });

  test("with Scene music off, no mood is asked for or kept", async () => {
    const h = host({ answers: [reply] });
    const out = await h.ask(msg);
    const sent = JSON.stringify(h.calls.generate[0]);
    expect(sent.indexOf('\\"music\\":false')).toBeGreaterThan(-1);
    expect(sent.indexOf("mysterious")).toBe(-1);
    const lines = out.find((m: any) => m.type === "script").script.lines;
    expect(lines.every((l: any) => !l.mood)).toBe(true);
  });

  const library = (sounds: any[]) => [["u1/sounds/index.json", JSON.stringify({ sounds })]].concat(sounds.map((s) => ["u1/sounds/" + s.id, new Uint8Array([1, 2, 3, 4])])) as any;

  test("a track is picked from the library by mood, the least played first, skipping ones already played", async () => {
    const h = host({
      files: library([
        { id: "a1", name: "Harbor at night", source: "upload", mood: "calm", uses: 4, triggers: [] },
        { id: "a2", name: "Still water", source: "upload", mood: "calm", uses: 1, triggers: [] },
        { id: "a3", name: "Chase on the docks", source: "upload", mood: "action", uses: 0, triggers: [] },
      ]),
    });
    let out = await h.ask({ type: "music_for", mood: "calm" });
    expect(out[0].id).toBe("a2");
    out = await h.ask({ type: "music_for", mood: "calm", skip: ["a2"] });
    expect(out[0].id).toBe("a1");
    expect(!!out[0].base64).toBe(true);
  });

  test("with no track for the mood and Your library only, it says how to add one", async () => {
    const h = host({ files: library([{ id: "a3", name: "Chase on the docks", source: "upload", mood: "action", uses: 0, triggers: [] }]) });
    await h.ask({ type: "save", settings: { musicFrom: "library" } });
    const out = await h.ask({ type: "music_for", mood: "sad" });
    expect(out[0].error).toBe("No music in your library is marked sad. Mark a track with it in the Sounds tab.");
  });

  test("a music track is never played as a sound effect, and Music for can be set and cleared", async () => {
    const sounds = [{ id: "a4", name: "rain on a window", source: "upload", mood: "sad", uses: 0, triggers: ["rain"] }];
    const h = host({ files: library(sounds) });
    const list = await h.box.loadSounds("u1");
    expect(h.box.matchSound(list, "rain on a window")).toBe(null);
    let out = await h.ask({ type: "sound_edit", id: "a4", mood: "" });
    expect(out[0].sounds[0].mood).toBe(undefined);
    expect(h.box.matchSound(await h.box.loadSounds("u1"), "rain on a window").id).toBe("a4");
    out = await h.ask({ type: "sound_edit", id: "a4", mood: "romantic" });
    expect(out[0].sounds[0].mood).toBe("romantic");
    out = await h.ask({ type: "sound_edit", id: "a4", mood: "not a mood" });
    expect(out[0].sounds[0].mood).toBe(undefined);
  });
});

describe("fitting the wait to the model", () => {
  test("an address on your own computer or network counts as local, and a cloud one does not", () => {
    const h = host();
    const local = ["http://localhost:5001/v1", "http://127.0.0.1:8080", "http://192.168.1.40:11434/v1", "http://10.0.0.7:5000", "http://172.20.3.4:1234", "http://100.90.12.3:8080", "http://gpu-box:5001", "http://studio.local:1234/v1", "http://[::1]:8080", "https://user:pass@192.168.0.9/v1"];
    const cloud = ["https://api.openai.com/v1", "https://openrouter.ai/api/v1", "https://172.15.0.1/v1", "https://100.50.1.1", "", "not a url"];
    expect(local.filter((u) => !h.box.isLocalUrl(u))).toEqual([]);
    expect(cloud.filter((u) => h.box.isLocalUrl(u))).toEqual([]);
  });

  test("the wait is stretched for thinking and for a local model, at most an hour", () => {
    const h = host();
    expect(h.box.fitWait(120, "https://api.openai.com/v1", "").secs).toBe(120);
    expect(h.box.fitWait(120, "https://api.openai.com/v1", "low").secs).toBe(120);
    expect(h.box.fitWait(120, "https://api.openai.com/v1", "high").secs).toBe(240);
    expect(h.box.fitWait(120, "https://api.openai.com/v1", "max").secs).toBe(360);
    const local = h.box.fitWait(120, "http://localhost:5001", "medium");
    expect(local.secs).toBe(900);
    expect(local.why).toEqual(["thinking is set to medium", "the model runs on your own computer or network"]);
    expect(h.box.fitWait(600, "http://localhost:5001", "max").secs).toBe(3600);
  });
});

describe("fitting the Director's wait", () => {
  const msg = { type: "direct", chatId: "c1", messageId: "m1", swipeId: 0, name: "Mara Vell", text: 'Mara set the cup down. "Fine."' };
  const good = JSON.stringify({ lines: [{ i: 0, speaker: "Narrator", text: "Mara set the cup down." }, { i: 1, speaker: "Mara Vell", text: "Fine." }], new_speakers: [] });
  const home = [{ id: "c9", name: "Home", provider: "custom", api_url: "http://192.168.1.40:5001/v1", model: "local-model", is_default: true, reasoning_bindings: { settings: { apiReasoning: true, reasoningEffort: "high" } } }];

  test("a Director on a local connection with high thinking is given longer, and the Log says why", async () => {
    const h = host({ answers: [good], connections: home });
    await h.ask({ type: "save", settings: { thinkingMode: "inherit" } });
    const out = await h.ask(msg);
    const log = out.find((m: any) => m.type === "script").script.log.join(" ");
    expect(log).toContain("The Director is given up to 20 minutes, since thinking is set to high and the model runs on your own computer or network.");
  });

  test("with Fit the wait to the model off, the wait is used as it is", async () => {
    const h = host({ answers: [good], connections: home });
    await h.ask({ type: "save", settings: { thinkingMode: "inherit", waitFit: false } });
    const out = await h.ask(msg);
    expect(out.find((m: any) => m.type === "script").script.log.join(" ")).not.toContain("is given up to");
  });
});
