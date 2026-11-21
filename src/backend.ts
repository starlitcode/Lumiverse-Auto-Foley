// Auto Foley, the backend.
//
// The backend is the part that thinks. It keeps each account's settings, asks
// the Decision model who says each quoted line, asks the Director (a second
// model) for voice tags and sounds, checks that the Director changed no words,
// and makes or finds sound effects. The panel in the browser is the part that
// plays: it reads the message, sends it here, and plays the script that comes
// back through the reader's ElevenLabs connection in Lumiverse.
//
// One backend process can serve every account on a server, so everything that
// belongs to a person is kept per user id, in spindle.userStorage, and every
// reply goes back addressed to that user.

declare const spindle: any;
declare function setTimeout(fn: () => void, ms: number): any;
declare function clearTimeout(handle: any): void;

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

type Strength = 'subtle' | 'natural' | 'dramatic';
type NarrationMode = 'read' | 'sounds' | 'skip';
type SoundStyle = 'voice' | 'effects' | 'both';
type CastKind = 'narrator' | 'character' | 'persona' | 'npc';
// 'found' is someone the text itself named as speaking, found on this device.
type AddedBy = 'you' | 'chat' | 'ai' | 'found';

interface CastMember {
  id: string;
  name: string;
  kind: CastKind;
  addedBy: AddedBy;
  // Other names this person is called by in the story, one per entry.
  aliases: string[];
  // An ElevenLabs voice and model picked before voices were kept for each
  // connection. Read as the pick on an ElevenLabs connection.
  voice: string;
  voiceName: string;
  model: string;
  // The TTS connection this person speaks through. Empty uses Auto Foley's.
  connection: string;
  // Their voice and model on each connection, by connection id.
  voices: Record<string, { voice: string; voiceName: string; model: string }>;
  // The folder they are in on the Cast tab. Empty is none.
  folder: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  // How this person speaks, for the Director, such as "soft-spoken, rarely shouts".
  note: string;
  // female, male or unknown. Used to pick a voice for someone the AI added.
  gender: string;
  muted: boolean;
}

interface Settings {
  enabled: boolean;
  // The reader's TTS connection in Lumiverse. Empty uses the one picked in
  // Lumiverse's Voice settings.
  ttsConnection: string;
  autoplay: boolean;
  prepareAhead: boolean;
  readOwnMessages: boolean;
  narration: NarrationMode;
  saveAudio: boolean;
  voiceVolume: number;
  soundVolume: number;
  reduceMotion: boolean;
  // The Director.
  directorOn: boolean;
  directorConnection: string;
  strength: Strength;
  tagsOn: boolean;
  breathsOn: boolean;
  soundsOn: boolean;
  // How sounds are made. "voice": a [sound of ...] tag inside a spoken line,
  // which Eleven v3 and v4 perform with the line. "effects": separate clips,
  // from the library or made by ElevenLabs. "both": the Director chooses.
  soundStyle: SoundStyle;
  intimateOn: boolean;
  findSpeakers: boolean;
  bigMoments: boolean;
  prompt: string;
  // The Decision model.
  decisionsOn: boolean;
  decisionConnection: string;
  // Sounds.
  makeSounds: boolean;
  soundSeconds: number;
  // The Director's model settings, named and sent the way Auto Refine sends
  // its own: thinking, the samplers typed in, and how long to wait.
  thinkingMode: string;
  thinkingEffort: string;
  samplers: Record<string, number | ''>;
  timeoutSecs: number;
  // How many times to wait and ask again when a provider is busy.
  rateWaits: number;
  // A note sent with an ask made again, saying what went wrong with the last
  // answer, and the reader's own text for each note.
  askNote: boolean;
  askNotes: Record<string, string>;
  // A second connection to ask when the Director still refuses or fails.
  fallbackConnection: string;
  // The look and the floating button, which follow the account like every
  // other setting.
  followScript: boolean;
  // The audience: a cheer after a performance, for the AI's characters, for
  // you, or both, and when.
  applauseOn: boolean;
  applauseForAi: boolean;
  applauseForUser: boolean;
  applauseWhen: string;
  applauseSound: string;
  applauseSeconds: number;
  applauseVolume: number;
  // Entries in the Extras menu of the message box.
  extrasMenu: boolean;
  panelPattern: string;
  boxSolid: number;
  widgetOn: boolean;
  widgetSize: number;
  // How many more times to ask the Director when its answer cannot be used.
  retryDirector: number;
  // A button on every message, and one in the chat's own row of buttons.
  messageButton: boolean;
  barButton: boolean;
  // The Start here guide on the Stage tab has been read.
  guideSeen: boolean;
  // Which parts the export, the import and Start again cover.
  exportParts: string[];
  importParts: string[];
  resetParts: string[];
  // Seconds to wait before a new reply plays by itself.
  autoplayDelay: number;
  // More tag names that hold thinking, one per entry, such as "musing".
  extraThinkTags: string[];
  // Also write each Log line to the browser's developer console.
  debugConsole: boolean;
  // The engine a connection runs, by connection id, when it is said outright
  // rather than found from the connection.
  engines: Record<string, string>;
  // The reader's own wording of the note sent with each engine, by engine id.
  engineNotes: Record<string, string>;
  // How much made audio to keep in the account, in MB. 0 keeps none.
  keepAudio: number;
  cast: CastMember[];
  // Folders that sort the cast on the Cast tab. Only for the panel: they
  // change nothing about how anyone sounds.
  folders: CastFolder[];
}

interface CastFolder {
  id: string;
  name: string;
  open: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  ttsConnection: '',
  autoplay: false,
  prepareAhead: false,
  readOwnMessages: false,
  narration: 'read',
  saveAudio: false,
  voiceVolume: 1,
  soundVolume: 0.8,
  reduceMotion: false,
  directorOn: true,
  directorConnection: '',
  strength: 'natural',
  tagsOn: true,
  breathsOn: true,
  soundsOn: true,
  soundStyle: 'voice',
  intimateOn: false,
  findSpeakers: true,
  bigMoments: true,
  prompt: '',
  decisionsOn: false,
  decisionConnection: '',
  makeSounds: true,
  soundSeconds: 0,
  autoplayDelay: 0,
  extraThinkTags: [],
  debugConsole: false,
  engines: {},
  engineNotes: {},
  keepAudio: 100,
  thinkingMode: 'off',
  thinkingEffort: 'low',
  samplers: {},
  timeoutSecs: 120,
  rateWaits: 2,
  askNote: true,
  askNotes: {},
  fallbackConnection: '',
  followScript: true,
  applauseOn: false,
  applauseForAi: true,
  applauseForUser: false,
  applauseWhen: 'message',
  applauseSound: '',
  applauseSeconds: 5,
  applauseVolume: 0.6,
  extrasMenu: true,
  panelPattern: '',
  boxSolid: 60,
  widgetOn: false,
  widgetSize: 44,
  retryDirector: 1,
  messageButton: true,
  barButton: true,
  guideSeen: false,
  exportParts: ['settings', 'prompt', 'cast'],
  importParts: ['settings', 'prompt', 'cast'],
  resetParts: ['settings', 'prompt', 'cast', 'sounds', 'audio', 'key'],
  cast: [],
  folders: [],
};

const NARRATOR_ID = 'narrator';

function narrator(): CastMember {
  return {
    id: NARRATOR_ID,
    name: 'Narrator',
    kind: 'narrator',
    addedBy: 'you',
    aliases: [],
    voice: '',
    voiceName: '',
    model: '',
    connection: '',
    voices: {},
    folder: '',
    stability: 0.5,
    similarity: 0.75,
    style: 0,
    speed: 1,
    note: 'Calm and clear. Reads what happens between the lines of dialogue.',
    gender: 'unknown',
    muted: false,
  };
}

function num(v: any, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

function str(v: any, max: number): string {
  return String(v == null ? '' : v).slice(0, max);
}

function bool(v: any, dflt: boolean): boolean {
  return typeof v === 'boolean' ? v : dflt;
}

function pick<T extends string>(v: any, allowed: readonly T[], dflt: T): T {
  return allowed.indexOf(v) >= 0 ? (v as T) : dflt;
}

const MAX_CAST = 80;
const MAX_FOLDERS = 30;

// A person's voice on each connection. Kept for at most 20 connections.
function cleanVoices(v: any): Record<string, { voice: string; voiceName: string; model: string }> {
  const out: Record<string, { voice: string; voiceName: string; model: string }> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of Object.keys(v).slice(0, 20)) {
    const id = str(k, 80);
    const e = v[k];
    if (!id || !e || typeof e !== 'object') continue;
    out[id] = { voice: str(e.voice, 120), voiceName: str(e.voiceName, 120), model: str(e.model, 120) };
  }
  return out;
}

function cleanMember(m: any): CastMember | null {
  if (!m || typeof m !== 'object') return null;
  const name = str(m.name, 80).trim();
  if (!name) return null;
  const base = narrator();
  return {
    id: str(m.id, 64) || newId(),
    name: name,
    kind: pick(m.kind, ['narrator', 'character', 'persona', 'npc'] as const, 'character'),
    addedBy: pick(m.addedBy, ['you', 'chat', 'ai', 'found'] as const, 'you'),
    aliases: Array.isArray(m.aliases)
      ? m.aliases.map((a: any) => str(a, 80).trim()).filter(Boolean).slice(0, 12)
      : [],
    voice: str(m.voice, 80),
    voiceName: str(m.voiceName, 120),
    model: str(m.model, 64),
    connection: str(m.connection, 80),
    voices: cleanVoices(m.voices),
    folder: str(m.folder, 64),
    stability: num(m.stability, 0, 1, base.stability),
    similarity: num(m.similarity, 0, 1, base.similarity),
    style: num(m.style, 0, 1, base.style),
    speed: num(m.speed, 0.7, 1.2, base.speed),
    note: str(m.note, 300),
    gender: pick(m.gender, ['female', 'male', 'unknown'] as const, 'unknown'),
    muted: bool(m.muted, false),
  };
}

// Settings from storage or from the panel are input, not a promise. Every
// field is checked and anything missing takes its default, so a file written
// by an older version, or edited by hand, still loads.
// The parts a file can carry, and the parts Start again can put back. A file
// never carries the sound library or the key: the library is made of audio
// files, and a key belongs in Lumiverse's secure storage, not in a file.
const TRANSFER_PARTS = ['settings', 'prompt', 'cast'];

// How much thinking the Director asks for. "inherit" sends nothing, so the
// connection's own setting is used.
const EFFORTS = ['auto', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

function reasoningFor(s: Settings): any {
  if (s.thinkingMode === 'off') return { source: 'off' };
  if (s.thinkingMode === 'custom') return { source: 'custom', effort: s.thinkingEffort };
  return null;
}

// The samplers that reach the request, the same list and bounds as Auto
// Refine's. Blank is the reader leaving it to the connection, and is not
// sent. A value outside the range is moved to the nearest end of it.
const SAMPLERS: Array<{ id: string; min: number; max: number; whole?: boolean }> = [
  { id: 'temperature', min: 0, max: 2 },
  { id: 'top_p', min: 0, max: 1 },
  { id: 'top_k', min: 0, max: 500, whole: true },
  { id: 'min_p', min: 0, max: 1 },
  { id: 'max_tokens', min: 1, max: 200000, whole: true },
  { id: 'max_context', min: 512, max: 2000000, whole: true },
  { id: 'frequency_penalty', min: -2, max: 2 },
  { id: 'presence_penalty', min: -2, max: 2 },
  { id: 'repetition_penalty', min: 0, max: 2 },
];

function cleanSamplerInput(raw: any): Record<string, number | ''> {
  const out: Record<string, number | ''> = {};
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const sp of SAMPLERS) {
    const v = src[sp.id];
    if (v === '' || v == null) continue;
    let n = Number(v);
    if (!Number.isFinite(n)) continue;
    n = Math.min(sp.max, Math.max(sp.min, n));
    out[sp.id] = sp.whole ? Math.round(n) : n;
  }
  return out;
}
const RESET_PARTS = ['settings', 'prompt', 'cast', 'sounds', 'audio', 'key'];
const KEEP_AUDIO_CHOICES = [0, 50, 100, 250, 500];

function cleanNotes(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of ['refused', 'empty', 'shape', 'changed']) if (typeof v[k] === 'string') out[k] = v[k].slice(0, 2000);
  return out;
}

function cleanEngineChoices(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of Object.keys(v).slice(0, 40)) {
    const id = str(k, 80);
    if (id && ENGINE_IDS.indexOf(v[k]) >= 0) out[id] = v[k];
  }
  return out;
}

function cleanEngineNotes(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of ENGINE_IDS) if (typeof v[k] === 'string') out[k] = v[k].slice(0, 2000);
  return out;
}

function partList(v: any, allowed: string[], dflt: string[]): string[] {
  if (!Array.isArray(v)) return dflt.slice();
  return allowed.filter((p) => v.indexOf(p) >= 0);
}

function cleanSettings(raw: any): Settings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  const cast: CastMember[] = [];
  const seen: Record<string, boolean> = {};
  if (Array.isArray(r.cast)) {
    for (const m of r.cast) {
      const c = cleanMember(m);
      if (!c || seen[c.id]) continue;
      seen[c.id] = true;
      cast.push(c);
      if (cast.length >= MAX_CAST) break;
    }
  }
  if (!cast.some((c) => c.kind === 'narrator')) cast.unshift(narrator());
  const folders: CastFolder[] = [];
  if (Array.isArray(r.folders)) {
    for (const f of r.folders) {
      const id = str(f && f.id, 64);
      const name = str(f && f.name, 60).trim();
      if (!id || !name || folders.some((x) => x.id === id)) continue;
      folders.push({ id, name, open: bool(f.open, true) });
      if (folders.length >= MAX_FOLDERS) break;
    }
  }
  // A person in a folder that is gone is in no folder.
  for (const c of cast) if (c.folder && !folders.some((f) => f.id === c.folder)) c.folder = '';
  return {
    enabled: bool(r.enabled, d.enabled),
    ttsConnection: str(r.ttsConnection, 80),
    autoplay: bool(r.autoplay, d.autoplay),
    prepareAhead: bool(r.prepareAhead, d.prepareAhead),
    readOwnMessages: bool(r.readOwnMessages, d.readOwnMessages),
    narration: pick(r.narration, ['read', 'sounds', 'skip'] as const, d.narration),
    saveAudio: bool(r.saveAudio, d.saveAudio),
    voiceVolume: num(r.voiceVolume, 0, 1, d.voiceVolume),
    soundVolume: num(r.soundVolume, 0, 1, d.soundVolume),
    reduceMotion: bool(r.reduceMotion, d.reduceMotion),
    directorOn: bool(r.directorOn, d.directorOn),
    directorConnection: str(r.directorConnection, 80),
    strength: pick(r.strength, ['subtle', 'natural', 'dramatic'] as const, d.strength),
    tagsOn: bool(r.tagsOn, d.tagsOn),
    breathsOn: bool(r.breathsOn, d.breathsOn),
    soundsOn: bool(r.soundsOn, d.soundsOn),
    soundStyle: pick(r.soundStyle, ['voice', 'effects', 'both'] as const, d.soundStyle),
    intimateOn: bool(r.intimateOn, d.intimateOn),
    findSpeakers: bool(r.findSpeakers, d.findSpeakers),
    bigMoments: bool(r.bigMoments, d.bigMoments),
    prompt: str(r.prompt, 20000),
    decisionsOn: bool(r.decisionsOn, d.decisionsOn),
    decisionConnection: str(r.decisionConnection, 80),
    makeSounds: bool(r.makeSounds, d.makeSounds),
    soundSeconds: num(r.soundSeconds, 0, 30, d.soundSeconds),
    autoplayDelay: num(r.autoplayDelay, 0, 30, d.autoplayDelay),
    extraThinkTags: Array.isArray(r.extraThinkTags) ? r.extraThinkTags.map((x: any) => str(x, 40).trim()).filter(Boolean).slice(0, 20) : [],
    debugConsole: bool(r.debugConsole, d.debugConsole),
    engines: cleanEngineChoices(r.engines),
    engineNotes: cleanEngineNotes(r.engineNotes),
    keepAudio: KEEP_AUDIO_CHOICES.indexOf(Number(r.keepAudio)) >= 0 ? Number(r.keepAudio) : d.keepAudio,
    thinkingMode: pick(r.thinkingMode, ['off', 'inherit', 'custom'] as const, 'off'),
    thinkingEffort: pick(r.thinkingEffort, EFFORTS, 'low'),
    samplers: cleanSamplerInput(r.samplers),
    timeoutSecs: Math.round(num(r.timeoutSecs, 0, 3600, d.timeoutSecs)),
    rateWaits: Math.round(num(r.rateWaits, 0, 5, d.rateWaits)),
    askNote: bool(r.askNote, d.askNote),
    askNotes: cleanNotes(r.askNotes),
    fallbackConnection: str(r.fallbackConnection, 80),
    followScript: bool(r.followScript, d.followScript),
    applauseOn: bool(r.applauseOn, d.applauseOn),
    applauseForAi: bool(r.applauseForAi, d.applauseForAi),
    applauseForUser: bool(r.applauseForUser, d.applauseForUser),
    applauseWhen: pick(r.applauseWhen, ['message', 'big'] as const, 'message'),
    applauseSound: str(r.applauseSound, 64).replace(/[^a-z0-9_-]/gi, ''),
    applauseSeconds: num(r.applauseSeconds, 1, 15, d.applauseSeconds),
    applauseVolume: num(r.applauseVolume, 0, 1, d.applauseVolume),
    extrasMenu: bool(r.extrasMenu, d.extrasMenu),
    panelPattern: pick(r.panelPattern, ['', 'diamonds', 'stripes', 'dots', 'hearts', 'stars'] as const, ''),
    boxSolid: Math.round(num(r.boxSolid, 0, 100, d.boxSolid)),
    widgetOn: bool(r.widgetOn, d.widgetOn),
    widgetSize: Math.round(num(r.widgetSize, 28, 96, d.widgetSize)),
    retryDirector: Math.round(num(r.retryDirector, 0, 3, d.retryDirector)),
    messageButton: bool(r.messageButton, d.messageButton),
    barButton: bool(r.barButton, d.barButton),
    guideSeen: bool(r.guideSeen, d.guideSeen),
    exportParts: partList(r.exportParts, TRANSFER_PARTS, d.exportParts),
    importParts: partList(r.importParts, TRANSFER_PARTS, d.importParts),
    resetParts: partList(r.resetParts, RESET_PARTS, d.resetParts),
    cast: cast,
    folders: folders,
  };
}

// An id that works over plain http too. crypto.randomUUID is missing outside
// a secure context, and a self-hosted Lumiverse is often reached that way.
let idCount = 0;
function newId(): string {
  idCount = (idCount + 1) % 1e6;
  return 'c' + Date.now().toString(36) + idCount.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

// ---------------------------------------------------------------------------
// Reading a message: what is said aloud and what is narration
// ---------------------------------------------------------------------------

type SegKind = 'speech' | 'narration';
interface Segment {
  i: number;
  kind: SegKind;
  text: string;
  // The text marks it as sung, with a music note such as ♪.
  sung?: boolean;
}

// Thinking a model writes inline. These are the formats Auto Retry and Auto
// Refine recognize too, and a change here goes into all three. Each is taken
// out closed, and opened with no closer, which is thinking cut off before the
// reply started. A closer with no opener means the opener was in the prompt,
// and everything before it is thinking.
const THINK_TAGS = ['think', 'thinking', 'thought', 'thoughts', 'reasoning', 'reflection', 'scratchpad', 'analysis'];
// The Harmony channels that carry thinking. The final channel is the reply.
const THINK_CHANNELS = 'analysis|thinking|thought|reasoning|commentary';
const HARMONY_END = '<\\|(?:end|return|start|call)\\|>';

interface ThinkPair {
  needs: string;
  open: string;
  close: string;
}

// The formats whose opener and closer are different tokens. `needs` is
// checked with indexOf first, so a message without the opener costs nothing.
const THINK_PAIRS: ThinkPair[] = [
  // Gemma 4. Every turn carries one, empty when the model is not thinking.
  { needs: '<|channel>', open: '<\\|channel>[ \\t]*(?:' + THINK_CHANNELS + ')\\b', close: '<channel\\|>' },
  // Cohere.
  { needs: '<|start_thinking|>', open: '<\\|START_THINKING\\|>', close: '<\\|END_THINKING\\|>' },
  // Seed-OSS.
  { needs: '<seed:think>', open: '<seed:think>', close: '<\\/seed:think>' },
  { needs: '<seed:cot_budget_reflect>', open: '<seed:cot_budget_reflect>', close: '<\\/seed:cot_budget_reflect>' },
  { needs: '<|begin_of_thought|>', open: '<\\|begin_of_thought\\|>', close: '<\\|end_of_thought\\|>' },
  // Kimi, with triangles in place of angle brackets.
  { needs: '◁think▷', open: '◁think▷', close: '◁\\/think▷' },
];

function escapeRe(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Tag names from the reader's Extra thinking tag names: letters, digits, _, -
// and :, so a name can never be read as a pattern.
function thinkNames(extra: string[]): string[] {
  const out = THINK_TAGS.slice();
  for (const n of extra || []) {
    const name = String(n || '').trim().toLowerCase();
    if (/^[a-z][a-z0-9_:-]{0,39}$/.test(name) && out.indexOf(name) < 0) out.push(name);
  }
  return out;
}

// The thinking Prefix and Suffix saved on the reader's connections, in
// Lumiverse's Reasoning settings. Read at most once a minute for each account.
const boundCache: Record<string, { at: number; pairs: ThinkPair[] }> = {};
const BOUND_EVERY_MS = 60000;

async function boundPairs(userId: string | undefined): Promise<ThinkPair[]> {
  const key = userId || '';
  const kept = boundCache[key];
  if (kept && Date.now() - kept.at < BOUND_EVERY_MS) return kept.pairs;
  const pairs: ThinkPair[] = [];
  try {
    const list = await spindle.connections.list(userId);
    for (const c of Array.isArray(list) ? list.slice(0, 40) : []) {
      const b = c && c.reasoning_bindings && c.reasoning_bindings.settings;
      const open = String((b && b.prefix) || '');
      const close = String((b && b.suffix) || '');
      // At least 3 characters, so ordinary punctuation is never taken for thinking.
      if (open.trim().length < 3 || close.trim().length < 3) continue;
      if (pairs.some((x) => x.needs === open.toLowerCase())) continue;
      pairs.push({ needs: open.toLowerCase(), open: escapeRe(open), close: escapeRe(close) });
      if (pairs.length >= 10) break;
    }
  } catch (_) {}
  boundCache[key] = { at: Date.now(), pairs };
  return pairs;
}

// The markers a local backend can pass through around the reply. They are not
// thinking, but read aloud they are noise.
function stripControlTokens(text: string): string {
  return text
    .replace(/<\|channel\|>[ \t]*\w*[ \t]*(?:<\|message\|>)?/gi, ' ')
    .replace(/<\|(?:im_start|start)\|>[ \t]*(?:system|user|assistant|model|tool|developer|human)?/gi, ' ')
    .replace(/<\|(?:end|return|call|message|im_end|eot_id|endoftext)\|>/gi, ' ')
    .replace(/<\|channel>|<channel\|>/gi, ' ');
}

function stripThinking(text: string, extra?: string[], bound?: ThinkPair[]): string {
  let t = String(text == null ? '' : text);
  const alt = thinkNames(extra || []).map(escapeRe).join('|');
  const pairs = THINK_PAIRS.concat(bound || []);

  // The channel form first, since a channel block holds the other shapes.
  t = t.replace(new RegExp('<\\|channel\\|>\\s*(?:' + THINK_CHANNELS + ')\\b[\\s\\S]*?(?:' + HARMONY_END + '|$)', 'gi'), ' ');

  const low = t.toLowerCase();
  for (const pair of pairs) {
    if (low.indexOf(pair.needs) < 0) continue;
    t = t.replace(new RegExp(pair.open + '[\\s\\S]*?' + pair.close, 'gi'), ' ');
    t = t.replace(new RegExp(pair.open + '[\\s\\S]*$', 'i'), ' ');
  }
  // A closer of one of these with nothing opening it. A closer with no letter
  // in it, such as *** on a connection, is also a scene break, so it ends
  // nothing.
  for (const pair of pairs) {
    if (!/[a-z]/i.test(pair.close)) continue;
    const close = new RegExp(pair.close, 'i').exec(t);
    if (close) t = ' ' + t.slice(close.index + close[0].length);
  }

  // A tag closer with no opener in front of it.
  {
    const close = new RegExp('<\\/(?:' + alt + ')\\s*>|\\[\\/(?:' + alt + ')\\s*\\]', 'i').exec(t);
    if (close) {
      const open = new RegExp('<(?:' + alt + ')(?:\\s[^>]*)?>|\\[(?:' + alt + ')(?:\\s[^\\]]*)?\\]|<\\|(?:' + alt + ')\\|?>', 'i');
      if (!open.test(t.slice(0, close.index))) t = ' ' + t.slice(close.index + close[0].length);
    }
  }

  t = stripControlTokens(t);

  // Angle and square brackets, the same name at both ends. Skipped when there
  // is no closer at all, so a message of openers does not scan to the end once
  // for each.
  if (t.indexOf('</') >= 0) t = t.replace(new RegExp('<(' + alt + ')(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1\\s*>', 'gi'), ' ');
  if (t.indexOf('[/') >= 0) t = t.replace(new RegExp('\\[(' + alt + ')(?:\\s[^\\]]*)?\\][\\s\\S]*?\\[\\/\\1\\s*\\]', 'gi'), ' ');

  // The pipe forms, with either closer for either opener.
  const CLOSE = '<\\|?\\/?(?:' + alt + ')\\|?>';
  if (t.indexOf('|>') >= 0 || t.indexOf('</') >= 0) t = t.replace(new RegExp('<\\|(' + alt + ')\\|?>[\\s\\S]*?' + CLOSE, 'gi'), ' ');

  // An opener with no closer runs to the end.
  t = t.replace(new RegExp('<\\|(?:' + alt + ')\\|?>[\\s\\S]*$', 'i'), ' ');
  t = t.replace(new RegExp('<(?:' + alt + ')(?:\\s[^>]*)?>[\\s\\S]*$', 'i'), ' ');
  t = t.replace(new RegExp('\\[(?:' + alt + ')(?:\\s[^\\]]*)?\\][\\s\\S]*$', 'i'), ' ');
  return t;
}

// What a message holds that is not meant to be heard. Square brackets go too:
// left in, ElevenLabs reads them as voice tags.
function cleanForVoice(raw: string, extra?: string[], bound?: ThinkPair[]): string {
  let t = String(raw == null ? '' : raw);
  t = stripThinking(t, extra, bound);
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/<(style|script)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  t = t.replace(/<[^>]{1,200}>/g, ' ');
  t = t.replace(/\(\([\s\S]*?\)\)/g, ' ');
  t = t.replace(/\[[^\]\n]{0,400}\]/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  t = t.replace(/\*\*|__|~~|`/g, '');
  t = t.replace(/^#{1,6}\s+/gm, '');
  return t;
}

// The longest line sent in one piece. Long lines go flat when read, so they
// are split at the end of a sentence.
const LINE_MAX = 320;

function splitLong(text: string): string[] {
  const t = text.trim();
  if (t.length <= LINE_MAX) return t ? [t] : [];
  const out: string[] = [];
  const sentences = t.match(/[^.!?…]+(?:[.!?…]+["”']?|$)\s*/g) || [t];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + s).length > LINE_MAX) {
      out.push(cur.trim());
      cur = '';
    }
    if (s.length > LINE_MAX) {
      // One sentence longer than a line: split at a comma or a space.
      let rest = s;
      while (rest.length > LINE_MAX) {
        let at = rest.lastIndexOf(', ', LINE_MAX);
        if (at < LINE_MAX / 2) at = rest.lastIndexOf(' ', LINE_MAX);
        if (at < 1) at = LINE_MAX;
        out.push(rest.slice(0, at + 1).trim());
        rest = rest.slice(at + 1);
      }
      cur = rest;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

const MUSIC_NOTE = /[\u266A\u266B\u266C\u{1F3B5}\u{1F3B6}]/u;
const MUSIC_NOTES = /[\u266A\u266B\u266C\u{1F3B5}\u{1F3B6}]/gu;

// Splits a message into lines in the order they are read. Text in straight
// or curly double quotes is speech. Everything else is narration, including
// *asterisk actions*. A paragraph break ends a narration line.
function splitSegments(raw: string, extra?: string[], bound?: ThinkPair[]): Segment[] {
  const t = cleanForVoice(raw, extra, bound);
  const parts: { kind: SegKind; text: string }[] = [];
  let buf = '';
  let inQuote = false;
  let closer = '"';
  const flush = (kind: SegKind) => {
    const text = buf.replace(/\*/g, ' ').replace(/[ \t]+/g, ' ').trim();
    buf = '';
    if (text && /[\p{L}\p{N}]/u.test(text)) parts.push({ kind, text });
  };
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (!inQuote && (ch === '"' || ch === '“')) {
      flush('narration');
      inQuote = true;
      closer = ch === '“' ? '”' : '"';
      continue;
    }
    if (inQuote && (ch === closer || (closer === '”' && ch === '"'))) {
      flush('speech');
      inQuote = false;
      continue;
    }
    if (!inQuote && ch === '\n' && t[k + 1] === '\n') {
      flush('narration');
      continue;
    }
    buf += ch === '\n' ? ' ' : ch;
  }
  flush(inQuote ? 'speech' : 'narration');
  const segs: Segment[] = [];
  for (const p of parts) {
    // A music note marks a line as sung. The note itself is not read.
    const sung = MUSIC_NOTE.test(p.text);
    const text = sung ? p.text.replace(MUSIC_NOTES, ' ').replace(/[ \t]+/g, ' ').trim() : p.text;
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    for (const piece of splitLong(text)) {
      const seg: Segment = { i: segs.length, kind: p.kind, text: piece };
      if (sung) seg.sung = true;
      segs.push(seg);
    }
  }
  return segs;
}

// ---------------------------------------------------------------------------
// Voice tags
// ---------------------------------------------------------------------------

// The words a line is made of, without tags, case or punctuation. The
// Director may add tags, capitals for stress, ellipses and dashes. It may not
// add, drop or change a word. If it does, the line is read as written.
function wordsOf(text: string): string {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function sameWords(a: string, b: string): boolean {
  return wordsOf(a) === wordsOf(b);
}

// Tags that describe something seen, not heard. ElevenLabs cannot voice
// them and sometimes reads them out.
const SILENT_TAG = /\b(stand|standing|stands|grin|grins|grinning|smile|smiles|smiling|nod|nods|nodding|pace|pacing|paces|music|look|looks|looking|glance|glances|wink|winks|shrug|shrugs|frown|frowns|blush|blushes|blushing|walks?|sits?|sitting|leans?|leaning|stares?|staring|eyes)\b/i;

// Tags for sounds the body makes. "Breaths, sighs and laughs" turns these off.
const BREATH_TAG = /\b(laugh\w*|chuckl\w*|giggl\w*|snicker\w*|sigh\w*|gasp\w*|exhal\w*|inhal\w*|breath\w*|pant\w*|moan\w*|groan\w*|whimper\w*|gulp\w*|swallow\w*|cough\w*|sniff\w*|sob\w*|cr(y|ies|ying)|scream\w*|yawn\w*|hum\w*|purr\w*|growl\w*|grunt\w*|snort\w*|scoff\w*|clears throat|hiccup\w*|kiss\w*|yelp\w*|squeal\w*|whine\w*)\b/i;

const MAX_TAGS: Record<Strength, number> = { subtle: 1, natural: 2, dramatic: 4 };

interface TagRules {
  tagsOn: boolean;
  breathsOn: boolean;
  max: number;
  // Whether a [sound of ...] tag may stay in the line.
  soundTags: boolean;
  // The only tags the engine knows. Empty takes any short tag.
  list?: string[];
}

// ---- Voice engines ----
// The panel says which engine Auto Foley's connection runs, and what it can
// do. The Director is told, so it writes what that engine can read. The panel
// fits each line again to the engine that speaks it.
// Only models that act are used. The panel speaks nothing through any other.
const ENGINE_IDS = ['eleven_v3', 'fish', 'gemini', 'chatterbox_turbo'];

interface EngineInfo {
  id: string;
  label: string;
  tags: 'free' | 'list' | 'none';
  list: string[];
  style: boolean;
  inVoiceSounds: boolean;
  sing: boolean;
}

// What the panel sent, checked. A message directed with no engine named is
// directed for ElevenLabs v3, which takes every kind of direction.
function cleanEngine(v: any): EngineInfo {
  const e = v && typeof v === 'object' ? v : {};
  const id = ENGINE_IDS.indexOf(e.id) >= 0 ? e.id : 'eleven_v3';
  const tags = pick(e.tags, ['free', 'list', 'none'] as const, id === 'eleven_v3' ? 'free' : 'none');
  return {
    id,
    label: str(e.label, 60) || 'ElevenLabs v3 or v4',
    tags,
    list: tags === 'list' && Array.isArray(e.list) ? e.list.map((x: any) => str(x, 30).toLowerCase()).filter((x: string) => /^[a-z][a-z -]*$/.test(x)).slice(0, 60) : [],
    style: e.style === true,
    inVoiceSounds: e.inVoiceSounds === true || (!v && true),
    sing: e.sing === true || (!v && true),
  };
}

// The note sent with each engine, saying how it reads tags. Shown in the
// Director tab, where it can be changed, with a way back to this text.
const ENGINE_NOTES: Record<string, string> = {
  eleven_v3:
    'ElevenLabs v3 acts out any short tag in square brackets. A tag shapes the words right after it, so it goes just before them. It can also perform a [sound of ...] tag inside the line.',
  fish:
    'Fish Audio acts out free tags in square brackets, like [barely holding it together] or [whispering]. Put a tag at the start of the sentence it shapes. A tag keeps going until the next one, so when a whisper ends, mark where the voice comes back up. One feeling per sentence works best. Fish can\'t make the sounds of the world, so sounds go in "before" and "after".',
  gemini:
    'Gemini knows only the tags in "tag_list". Use them as written, in square brackets, right where the sound happens, even mid-sentence. How a line is said goes in its "style": a few plain words like "hushed and nervous" or "fast, out of breath". Most lines need no style at all. Leave age, accent and who they are out of it, since the voice already carries those.',
  chatterbox_turbo:
    'Chatterbox knows only the nine tags in "tag_list", and they\'re all sounds a voice makes. Use them as written, in square brackets, and rarely: one in a line at most, and most lines get none. It can\'t take a delivery tag like [quietly], so the punctuation carries the delivery.',
};

function engineNote(s: Settings, id: string): string {
  const own = s.engineNotes && typeof s.engineNotes[id] === 'string' ? s.engineNotes[id].trim() : '';
  return own || ENGINE_NOTES[id] || '';
}

// Turns a tag into the vocal sound it names, so [laughs softly], [laughing]
// and [laughter] all become laugh. Empty when it names none of them. The
// panel has the same table, so a line fitted here and there comes out the
// same.
const TAG_WORDS: Record<string, string> = {
  laughs: 'laugh', laughing: 'laugh', laughter: 'laugh', laughed: 'laugh',
  chuckles: 'chuckle', chuckling: 'chuckle', chuckled: 'chuckle',
  sighs: 'sigh', sighing: 'sigh', sighed: 'sigh',
  gasps: 'gasp', gasping: 'gasp', gasped: 'gasp',
  coughs: 'cough', coughing: 'cough',
  groans: 'groan', groaning: 'groan',
  sniffs: 'sniff', sniffing: 'sniff', sniffles: 'sniff', sniffling: 'sniff', sniffle: 'sniff',
  sobs: 'sob', sobbing: 'sob',
  cries: 'cry', crying: 'cry',
  giggles: 'giggle', giggling: 'giggle',
  snorts: 'snort', snorting: 'snort',
  yawns: 'yawn', yawning: 'yawn',
  screams: 'scream', screaming: 'scream',
  shouts: 'shout', shouting: 'shout', yells: 'shout', yelling: 'shout', yell: 'shout',
  whisper: 'whispers', whispering: 'whispers', whispered: 'whispers',
  exhale: 'exhales', exhaling: 'exhales', exhaled: 'exhales',
  breathes: 'breath', breathing: 'breath', inhales: 'breath', inhale: 'breath', inhaling: 'breath', breaths: 'breath',
  pants: 'pant', panting: 'pant',
  moans: 'moan', moaning: 'moan',
  whimpers: 'whimper', whimpering: 'whimper',
  growls: 'growl', growling: 'growl',
  grunts: 'grunt', grunting: 'grunt',
  hisses: 'hiss', hissing: 'hiss',
  sneezes: 'sneeze', sneezing: 'sneeze',
  snickers: 'snicker', snickering: 'snicker',
  shrieks: 'shriek', shrieking: 'shriek',
  cackles: 'cackle', cackling: 'cackle',
  cheers: 'cheer', cheering: 'cheer',
  shh: 'shush', shushes: 'shush', shushing: 'shush',
  tuts: 'tsk', tut: 'tsk',
  pff: 'phew', whew: 'phew',
};
const TAG_KNOWN = new Set([
  'argh', 'breath', 'heavy breath', 'exhales', 'cackle', 'cheer', 'chuckle', 'cough', 'cry', 'gasp', 'giggle', 'groan', 'growl',
  'grunt', 'hiss', 'laugh', 'moan', 'pant', 'phew', 'scream', 'shout', 'shriek', 'sigh', 'sneeze', 'snicker', 'snort', 'sob',
  'throat-clearing', 'tsk', 'whimper', 'whispers', 'yawn', 'short pause', 'long pause', 'clear throat', 'shush', 'sniff',
]);
function tagSound(tag: string): string {
  const t = String(tag || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/\b(clears?|clearing)\b.*\bthroat\b|\bthroat[- ]clear/.test(t)) return 'throat';
  if (/\blong pause\b/.test(t)) return 'long pause';
  if (/\b(short pause|pause|beat)\b/.test(t)) return 'short pause';
  if (/\bheavy breath/.test(t)) return 'heavy breath';
  for (const w of t.split(' ')) {
    const c = TAG_WORDS[w] || w;
    if (TAG_KNOWN.has(c)) return c;
  }
  return '';
}
function fitTag(tag: string, list: string[]): string {
  const c = tagSound(tag);
  if (!c) return '';
  if (c === 'throat') return list.indexOf('clear throat') >= 0 ? 'clear throat' : list.indexOf('throat-clearing') >= 0 ? 'throat-clearing' : '';
  return list.indexOf(c) >= 0 ? c : '';
}

// A note on how a line is said, for an engine that takes it beside the line.
function cleanStyle(v: any): string {
  const t = str(v, 120).replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80 || t.split(' ').length > 12) return '';
  if (!/^[\p{L}][\p{L} ,'-]*$/u.test(t)) return '';
  return t;
}

// A sound performed inside the line, such as [sound of a chair scraping
// back, someone muttering "fine"]. It may be longer than a voice tag and may
// carry a few quoted words for a voice in the background.
const SOUND_TAG = /^sounds? of\b/i;
const SOUND_TAG_MAX = 140;
// One in a line is enough. More turn the line into a sound collage and the
// speech gets lost.
const SOUND_TAGS_PER_LINE = 1;

// Keeps the tags the engine can use and drops the rest. A tag is kept when it
// is short, made of plain words, describes a sound or a way of speaking, and
// fits the switches. A [sound of ...] tag has its own, looser rules. The rest
// of the text is left as it is.
function cleanTags(text: string, rules: TagRules): { text: string; tags: string[]; sounds: string[] } {
  const tags: string[] = [];
  const sounds: string[] = [];
  let out = String(text || '').replace(/\[([^\]]*)\]/g, (_m, innerRaw) => {
    const inner = String(innerRaw).replace(/\s+/g, ' ').trim();
    if (SOUND_TAG.test(inner)) {
      if (!rules.soundTags || sounds.length >= SOUND_TAGS_PER_LINE) return ' ';
      if (inner.length > SOUND_TAG_MAX) return ' ';
      // Letters, digits, spaces and the punctuation of a short quoted shout.
      // Square brackets cannot appear here, since they end the tag.
      if (!/^[\p{L}\p{N} ,.'"“”‘’!?-]+$/u.test(inner)) return ' ';
      const clean = inner.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      sounds.push(clean);
      return ' [' + clean + '] ';
    }
    if (!rules.tagsOn) return ' ';
    if (!inner || inner.length > 48) return ' ';
    if (inner.split(' ').length > 6) return ' ';
    if (!/^[\p{L}][\p{L} ,'-]*$/u.test(inner)) return ' ';
    if (SILENT_TAG.test(inner)) return ' ';
    if (!rules.breathsOn && BREATH_TAG.test(inner)) return ' ';
    if (tags.length >= rules.max) return ' ';
    const tag = rules.list && rules.list.length ? fitTag(inner, rules.list) : inner.toLowerCase();
    if (!tag) return ' ';
    tags.push(tag);
    return ' [' + tag + '] ';
  });
  out = out.replace(/[ \t]+/g, ' ').replace(/\s+([,.!?…;:])/g, '$1').trim();
  return { text: out, tags, sounds };
}

// ---------------------------------------------------------------------------
// The Director
// ---------------------------------------------------------------------------

// The built-in Director prompt. It is shown in full in the panel and can be
// changed there, with a way back to this text. It names no character and
// assumes nothing about who plays whom, so it suits group chats.
const BUILT_IN_PROMPT = `<the_director>
You're directing an audio drama. A scene from a roleplay is about to be read aloud by text-to-speech voices, and you get it first. Your job is how each line sounds. What's said belongs to the user, so every word stays exactly where they put it.

The user sets the tone. Maybe it's a lazy morning in a kitchen. Maybe it's a sex scene, or somebody bleeding out on a stairwell. You direct all of it the same way. The scene comes out at the strength it went in: quiet stays quiet, and a brutal scene keeps its teeth. Don't add drama nobody wrote, and don't sand any off either.

Sex scenes are between adults, 18 and older. If one involves anyone younger than that, or anyone written to seem younger, don't direct it. Send every line back plain, with no tags and no sounds. Characters of any age in scenes with nothing sexual in them get directed like anyone else.
</the_director>

<what_you_get>
A JSON object with:
"cast": everyone who might speak, each with a "note" on how they talk. "also_called" lists other names the story uses for them.
"author": who wrote this message.
"in_scene": the people this message names, the author first.
"lines": the message split into numbered lines, in order. Each has "i" (its number), "kind" and "text". A "speech" line is said out loud by someone, without its quote marks. A "narration" line is everything else, read by the narrator.
  Some speech lines already carry "speaker". The story itself named who said it, or another model picked it. Keep it.
  Some carry "likely_speaker" instead. That's a guess from an action right before the quote. Use it unless the text clearly points at someone else.
  A line with "sung": true is one the text itself marks as a song.
"rules": what you're allowed to do this time. Every rule is explained below.
</what_you_get>

<reading_the_room>
Every tag comes from the page. Read the narration around a line before you touch it. If it says she's hiding behind a door, she's quiet. If he's three drinks in and grinning, he's loose and loud. Whatever the text shows about the moment is your direction.

Each person keeps their own voice. Check their note in the cast. A dry, clipped character takes bad news dry and clipped, and a bubbly one doesn't turn into a brooding poet because the scene got heavy. Two people who sound different going in still sound different coming out.

The narrator isn't a character. They carry the mood of the scene in how they read: low and tight when things are tense, easy when nothing's at stake. They don't laugh or sob at the story.

Mood carries. Once a scene goes hushed, it stays hushed until something on the page breaks it. You don't need to re-tag every line to keep it there.
</reading_the_room>

<how_to_tag>
"voice_tags" in the rules says whether you can add voice tags at all. If it's false, add none, and go straight to sounds.

"engine" names the voice that reads this scene, and "engine_note" says how it takes tags. Voices differ a lot here, so read the note and follow it.

When "tag_list" is there, those are the only tags this voice knows. Use them exactly as written, in square brackets. Anything else you put in brackets gets cut before it reaches the voice.

When "line_style" is true, each line can also carry a "style": a few plain words on how it's said, like "hushed and nervous" or "bright, talking fast". That's where delivery goes for this voice. It follows the same rules as a tag: it comes from the page, and most lines are fine with "style" left as "".

A tag sits in square brackets and describes something you'd hear: a delivery like [quietly], [through gritted teeth], [deadpan] or [half asleep], or a sound a voice makes like [exhales] or [laughs under her breath]. One to four plain words. When "breaths_and_laughs" is false, leave out every sound a voice makes, like sighs, laughs, gasps and breaths.

Put a tag where the delivery changes, usually right before the words it shapes. A reaction can sit right after the line that caused it: "Sure you did." [snorts] A tag goes between words, never inside one.

"max_tags" is the most voice tags one line can have. "acting" says how big to go: "subtle" is sparing and close, "natural" is how a good actor would read it, "dramatic" lets the big feelings land big. Sound tags don't count toward "max_tags".

Keep it short. [low, shaking with anger] works. A whole stage direction doesn't make it sound any more real.

You can put a word in CAPITALS to lean on it, and use an ellipsis or a dash for a pause or a line that breaks off. That's the whole toolbox. Outside the brackets the words stay exactly as written, typos and all, in the language they're written in.

Anything you can only see has no place in a tag. [smiles], [nods], [looks away] and [crosses her arms] make no sound, and the voice will sometimes read them out loud.
</how_to_tag>

<worn_out_tags>
Voice tags have their own clichés, and listeners hear them fast. Each of these costs you:
- [sighs] dropped on a line because it's a bit sad, or for no reason at all.
- [chuckles] or [laughs] after every joke. If the line's funny, the voice will land it.
- [whispers] on every tender or sexy line. Most intimate talk is just quiet, close and plain.
- [voice breaking] or [tearfully] on anything sad. Save it for the moment someone actually comes apart.
- A tag that names what the words already show. "GET OUT!" doesn't need [shouting]. "I'm so sorry, I didn't mean it" doesn't need [apologetically].
- Bare feelings like [sad] or [angry]. They're vague. Say how it sounds instead, like [flat] or [bright and fast].
- The same tag twice in a few lines when nobody's repeating themselves.
- A tag on every line. The scene starts to sound like a demo reel.

When a line works fine plain, leave it plain. A clean line is a good line.
</worn_out_tags>

<who_speaks>
For narration, the speaker is "Narrator". For speech, pick the right person from the cast. Use the clues around the quote: who's named in the narration next to it, who was just talking, who's being answered, whose name is in the line. People in "in_scene" are the likeliest. If "speaker" is already filled in, keep it.

Dialogue never switches owners. When a quote really could be two people, go with the one the narration points at.
</who_speaks>

<sounds>
When "sounds" is true in the rules, you can add sounds for what happens. Only add one when the text clearly shows something that makes noise. Most lines don't get one.

"sound_style" says how sounds are made:
- "voice": the sound goes inside a line as one tag that starts with "sound of", like [sound of a kettle starting to whistle] or [sound of gravel under tires]. The voice performs it with the line. It can even carry a short voice in the background: [sound of a door banging shut upstairs, someone yelling "sorry!"]. One per line at most, under twenty words. Leave "before" and "after" empty. When "narration_is_read" is false, narration isn't spoken, so these go on speech lines only.
- "effects": put the sound in "before" (played just before the line) or "after" (just after it) instead, and add no [sound of ...] tags. Describe it the way a sound designer would, in under fifteen words, with what's moving and what it's made of: "a ceramic mug set down on a wooden table", "boots on a wet stone floor".
- "both": a short sound that happens while someone's talking goes inside the line as [sound of ...]. A bigger one, or one that stands between lines, goes in "before" or "after".

"sound_hints", when it's there, maps a line's "i" to the chance, from 0 to 1, that the line describes a sound. Lean on it.

Breaths, laughs and other noises a person makes are voice tags. Sounds are for the world around them.

When "intimate" is true, sounds can include the noises of a sex scene between adults, like skin on skin, kissing, wet sounds or a bed creaking. Keep them literal and at the strength the text describes.
</sounds>

<big_moments>
Set "big": true on a line that's a real peak: a scream, or the confession that cracks somebody open. It lets the voice swing wider. A scene has one, maybe two. Most have none.
</big_moments>

<singing>
Set "sung": true on a line someone actually sings, like song lyrics or a lullaby. Only mark it when the words are sung. A character who mentions a song, or teases in a sing-song voice, is still talking. Don't add a tag that says they sing, because "sung" handles that, and a voice that can't sing will just speak the line. Humming with no words is a sound a voice makes, so it's a tag like [hums].
</singing>

<new_speakers>
When "find_speakers" is true and someone speaks who isn't in the cast, use the name the text gives them, or a short plain one if it gives none, like "Bartender". List them in "new_speakers" with "gender" (female, male or unknown) and "about": a few words on how they sound, like "gravelly older man" or "bright, quick young woman". Anyone in a sex scene is an adult.
</new_speakers>

<clean_run>
A scene that already sounds right with no tags goes back with no tags, and that's a perfect job. Follow "max_tags" in the rules for each line. One tag in the right place beats three anywhere else.
</clean_run>

<your_answer>
Send back one JSON object and nothing else: no words before or after it, and no code fence.
Every line comes back, in order, with the same "i" it came with.
"text" is the whole line: every word of it, exactly as written, with your tags added. Never just the tags.
"speaker" is a name from the cast, a name from "new_speakers", or "Narrator".
Leave "before" and "after" as "" when there's no sound, and "big" as false unless it's a real peak.
Leave "style" as "" and "sung" as false unless the line needs them.
Leave "new_speakers" as [] when nobody new speaks.

{"lines":[{"i":0,"speaker":"Narrator","text":"...","style":"","before":"","after":"","big":false,"sung":false}],"new_speakers":[]}
</your_answer>`;

interface DirectedLine {
  i: number;
  kind: SegKind;
  speaker: string;
  // What is sent to ElevenLabs, tags included.
  text: string;
  // The line as it was written.
  plain: string;
  tags: string[];
  // Sounds performed inside the line, as [sound of ...] tags.
  inSounds: string[];
  big: boolean;
  // Separate sound effects played before and after the line.
  before: string;
  after: string;
  // Why the line is plain, when the Director's version was not used.
  note: string;
  // How the line is said, for an engine that takes it beside the line.
  style: string;
  // The line is sung.
  sung: boolean;
}

interface Script {
  key: string;
  messageId: string;
  author: string;
  lines: DirectedLine[];
  log: string[];
  directed: boolean;
  added: string[];
  // Who the message names or hears speak, for the Stage tab.
  inScene: string[];
  // Whether the message is one of the reader's own, for the audience.
  isUser: boolean;
  model: string;
  cost: number;
}

// Pulls one JSON object out of what the model wrote. Models wrap it in a code
// fence or a sentence often enough that a plain JSON.parse would fail on a
// good answer.
function parseJsonObject(text: string): any {
  const t = String(text || '');
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : t;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function cleanSound(v: any): string {
  const s = str(v, 200).replace(/\s+/g, ' ').trim();
  if (!s || s.length < 3) return '';
  if (/^(none|null|no sound|n\/a|-)$/i.test(s)) return '';
  return s.slice(0, 160);
}

// Finds the cast member a name means: the name itself, an alias, or the first
// name of someone in the cast.
function findMember(cast: CastMember[], name: string): CastMember | null {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  for (const c of cast) if (c.name.toLowerCase() === n) return c;
  for (const c of cast) if (c.aliases.some((a) => a.toLowerCase() === n)) return c;
  for (const c of cast) {
    const first = c.name.split(/\s+/)[0].toLowerCase();
    if (first.length >= 3 && first === n) return c;
  }
  return null;
}

// Turns the Director's answer into the lines that are played. Every line of
// the message is kept, in order, whatever the Director sent. A line it left
// out, changed the words of, or gave a bad shape to is read as written.
function applyDirection(
  segs: Segment[],
  answer: any,
  cast: CastMember[],
  author: string,
  fixed: Record<number, string>,
  rules: TagRules & { sounds: boolean; effects: boolean; narrationRead: boolean; findSpeakers: boolean; bigMoments: boolean; lineStyle?: boolean },
): { lines: DirectedLine[]; newSpeakers: { name: string; gender: string; about: string }[]; log: string[] } {
  const log: string[] = [];
  const byIndex: Record<number, any> = {};
  const got = answer && Array.isArray(answer.lines) ? answer.lines : [];
  for (const l of got) {
    const i = Number(l && l.i);
    if (Number.isInteger(i) && i >= 0 && i < segs.length && !byIndex[i]) byIndex[i] = l;
  }
  const newSpeakers: { name: string; gender: string; about: string }[] = [];
  if (rules.findSpeakers && answer && Array.isArray(answer.new_speakers)) {
    for (const s of answer.new_speakers.slice(0, 6)) {
      const name = str(s && s.name, 60).replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
      if (!name || name.toLowerCase() === 'narrator' || findMember(cast, name)) continue;
      if (newSpeakers.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
      newSpeakers.push({
        name,
        gender: pick(String(s.gender || '').toLowerCase(), ['female', 'male', 'unknown'] as const, 'unknown'),
        about: str(s.about, 120).trim(),
      });
    }
  }
  let changed = 0;
  let missing = 0;
  const lines: DirectedLine[] = segs.map((seg) => {
    const d = byIndex[seg.i];
    const line: DirectedLine = {
      i: seg.i,
      kind: seg.kind,
      speaker: seg.kind === 'narration' ? 'Narrator' : fixed[seg.i] || author,
      text: seg.text,
      plain: seg.text,
      tags: [],
      inSounds: [],
      big: false,
      before: '',
      after: '',
      note: '',
      style: '',
      sung: !!seg.sung,
    };
    if (!d) {
      if (answer) missing++;
      if (answer) line.note = 'The Director left this line out, so it is read as written.';
      return line;
    }
    if (seg.kind === 'speech' && !fixed[seg.i]) {
      const who = str(d.speaker, 80).trim();
      const member = findMember(cast, who);
      if (member) line.speaker = member.name;
      else if (who && newSpeakers.some((s) => s.name.toLowerCase() === who.toLowerCase())) line.speaker = who;
    }
    const proposed = typeof d.text === 'string' ? d.text : '';
    // A sound inside a narration line is only heard when narration is read.
    const lineRules = Object.assign({}, rules, { soundTags: rules.soundTags && (seg.kind === 'speech' || rules.narrationRead) });
    if (proposed && sameWords(proposed, seg.text)) {
      const c = cleanTags(proposed, lineRules);
      if (sameWords(c.text, seg.text)) {
        line.text = c.text;
        line.tags = c.tags;
        line.inSounds = c.sounds;
      }
    } else if (proposed) {
      changed++;
      line.note = 'The Director changed the words of this line, so it is read as written.';
    }
    if (rules.sounds && rules.effects) {
      line.before = cleanSound(d.before);
      line.after = cleanSound(d.after);
    }
    line.big = rules.bigMoments && d.big === true;
    if (d.sung === true) line.sung = true;
    if (rules.lineStyle) line.style = cleanStyle(d.style);
    return line;
  });
  if (changed) log.push(changed + (changed === 1 ? ' line was' : ' lines were') + ' read as written, because the Director changed the words.');
  if (missing) log.push(missing + (missing === 1 ? ' line was' : ' lines were') + ' left out by the Director and read as written.');
  return { lines, newSpeakers, log };
}

// What went wrong with a call to the Director, in plain words.
function generationTrouble(e: any): string {
  const raw = String((e && e.message) || e || '').slice(0, 300);
  if (/PERMISSION_DENIED/i.test(raw) || (/permission/i.test(raw) && /generation/i.test(raw)))
    return 'the Generation permission is refused. Grant it to Auto Foley in Lumiverse, under Extensions';
  if (/not found/i.test(raw) && /connection/i.test(raw))
    return 'the connection picked for the Director is gone. Pick another one in the Director tab';
  if (/no (api )?key|api key/i.test(raw)) return 'the Director\'s connection has no key saved in Lumiverse';
  if (/abort|cancel/i.test(raw)) return 'the call to the Director was stopped';
  if (/timed? ?out/i.test(raw)) return 'the Director did not answer in time';
  if (/content filter|refus|declined|blocked/i.test(raw))
    return 'the Director\'s provider refused this message. Try another connection for the Director';
  if (/rate|429/i.test(raw)) return 'the Director\'s provider is busy (too many requests). Try again in a moment';
  return 'the Director could not be asked: ' + (raw || 'no answer');
}

// ---- which errors are worth trying again ----
// The same in Auto Retry, Auto Refine and Auto Foley, so the three agree. errorKind reads an
// error as "hard" (waiting cannot fix it), "wait" (it clears if you wait), or
// "" (neither is known).
//
// Lumiverse writes a failed call as "Provider stream failed (504): detail".
// The number in the parentheses is the status the provider answered with, so
// it is read on its own, and a number in the detail is not a status: "try
// again in 2.404 seconds" is not a 404.
const STATED_STATUS = /\bfailed \((\d{3})\):/i;
// A gateway that could not reach the model, or a server that is not ready.
// The detail is then the gateway's own page, which can say "404 page not
// found" or "permission" about itself, so only the account and the prompt
// (HARD_SURE) still count against it.
const GATEWAY_STATUS = /^(?:408|425|502|503|504|52\d|530)$/;
// Every status that clears if you wait, as Lumiverse itself reads them.
const WAIT_STATUS = /^(?:408|409|425|429|5\d\d)$/;
// Statuses waiting cannot fix: a wrong key stays wrong, and a model that does
// not exist does not start existing.
const HARD_STATUS = /\b(?:400|401|402|403|404|405|406|411|413|415|422)\b/;
// The key, the account and the prompt. A balance does not refill, a daily
// limit only comes back the next day, and a prompt over the context length is
// the same prompt next time. A prompt declined as "reasoning_extraction",
// for asking the model to write out its thinking, is declined again the same
// way. These are hard whatever status comes with them.
const HARD_SURE =
  /\b(?:reasoning[_ -]?extraction|invalid[_ ]?api[_ ]?key|authentication|unauthorized|insufficient[_ ](?:balance|credits?|funds|quota)|billing|context[_ ]length(?:[_ ]exceeded)?|maximum context|(?:prompt|input|context|messages?) (?:is |are )?too long|daily (?:request |token |usage )?(?:limit|quota|cap)|today['’]?s (?:free )?(?:requests|quota|limit|usage)|\w*(?:requests|tokens) ?per ?day\w*|resets? at (?:midnight|00:00))\b/i;
// Words that are hard from a provider, and that a gateway's page can also use
// about itself.
const HARD_LOOSE = /\b(?:forbidden|permission|not allowed|not found|does not exist|model missing)\b/i;
// Errors that clear if you wait: a rate limit, a busy or loading server, a
// gateway that could not get through, a dropped connection.
const WAIT_ERROR =
  /\b(?:408|409|425|429|5\d\d)\b|rate.?limit|too many requests|quota|overloaded|capacity|try again|temporar(?:y|ily)|time(?:d ?| |-)?out|network|gateway|unavailable|server error|(?:no healthy|no available|bad) upstream|upstream (?:connect|error|request|server|service|time)|provider returned error|connection (?:was |is |has been )?(?:closed|reset|refused|lost|dropped|error|failed|failure|terminated)|closed unexpectedly|(?:unable|failed|could not) to connect|socket|terminated|econn\w+|etimedout|epipe|eai_again|enotfound|ehostunreach|enetunreach|und_err\w*|fetch failed|busy|loading/i;

function errorKind(text: string): string {
  const stated = STATED_STATUS.exec(text);
  const status = stated ? stated[1] : '';
  const detail = stated ? text.slice(stated.index + stated[0].length) : text;
  if (HARD_SURE.test(detail)) return 'hard';
  if (status) {
    if (GATEWAY_STATUS.test(status)) return 'wait';
    if (HARD_STATUS.test(status) || HARD_LOOSE.test(detail)) return 'hard';
    if (WAIT_STATUS.test(status) || WAIT_ERROR.test(detail)) return 'wait';
    return '';
  }
  if (HARD_STATUS.test(text) || HARD_LOOSE.test(text)) return 'hard';
  return WAIT_ERROR.test(text) ? 'wait' : '';
}

function rateLimited(err: any): boolean {
  const s = String(err == null ? '' : err);
  if (!s) return false;
  return errorKind(s) === 'wait';
}

// How long the provider said to wait, in milliseconds, or 0 when it said
// nothing. The header's own form first, which is a whole number of seconds
// against the words and no unit; then the wordings written into an error body.
// It is the only figure here that is not a guess, so it wins over the backoff.
const RETRY_AFTER = /retry[-_ ]?after["'\s:=]*(\d+(?:\.\d+)?)(?![.\d]*\s*[a-z])/i;
const STATED_WAIT =
  /(?:retry|try|again|wait|resets?|available)[^0-9]{0,24}?(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?)\b/i;
const WAIT_SCALE: Record<string, number> = {
  ms: 1, millisecond: 1, milliseconds: 1,
  s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
  m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
};
// An hour is the ceiling. A provider naming a longer one is naming a daily
// quota, and sitting on a timer for that is worse than saying so and stopping.
const WAIT_CEILING = 3600000;

function statedWait(err: any): number {
  const s = String(err == null ? '' : err);
  if (!s) return 0;
  const bare = RETRY_AFTER.exec(s);
  if (bare) {
    const secs = Number(bare[1]);
    if (Number.isFinite(secs) && secs > 0) return Math.min(WAIT_CEILING, secs * 1000);
  }
  const hit = STATED_WAIT.exec(s);
  if (!hit) return 0;
  const ms = Number(hit[1]) * (WAIT_SCALE[String(hit[2]).toLowerCase()] || 0);
  return Number.isFinite(ms) && ms > 0 ? Math.min(WAIT_CEILING, ms) : 0;
}

// The first wait, doubling, with a little spread on it so a pause everybody is
// serving does not end for everybody in the same instant. A figure the provider
// named wins outright: waiting less than it is spending a try to be told the
// same thing.
const RATE_WAIT_MS = 15000;
const RATE_WAIT_MAX = 120000;

function rateWait(attempt: number, err: any): number {
  const said = statedWait(err);
  if (said > 0) return said + Math.round(Math.random() * 1000);
  const grown = Math.min(RATE_WAIT_MAX, RATE_WAIT_MS * Math.pow(2, Math.max(0, attempt - 1)));
  return Math.round(grown * (0.85 + Math.random() * 0.3));
}

// Asks the Director, and gives up after Give up waiting after. 0 waits for as
// long as the model takes. The abort reaches Lumiverse, which stops the call.
async function withTimeout(req: any, secs: number): Promise<any> {
  const AC = (globalThis as any).AbortController;
  if (!secs || typeof AC !== 'function') return await spindle.generate.quiet(req);
  const ctl = new AC();
  req.signal = ctl.signal;
  const timer = setTimeout(() => {
    try {
      ctl.abort();
    } catch (_) {}
  }, secs * 1000);
  try {
    return await spindle.generate.quiet(req);
  } catch (e: any) {
    if (ctl.signal.aborted) throw new Error('The Director timed out after ' + secs + ' seconds');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, Math.max(0, ms)));
}

// ---------------------------------------------------------------------------
// A Director that declines the job
// ---------------------------------------------------------------------------

// The lists below are Auto Retry's, by way of Auto Refine, copied across so
// the three extensions agree on what a refusal is. What is judged here is a
// short answer to "direct this scene", so the length cap is the only rule
// around them.
const REFUSAL_STRONG: RegExp[] = [
  // Model naming itself as an AI.
  /\bas an? (?:ai|a\.i\.|language model|large language model|ai (?:model|assistant))\b/i,
  /\bI(?:'m| am)(?: just| only)? an? (?:ai|a\.i\.|language model|large language model|ai assistant)\b/i,
  // Policy / guideline framing. The adjective slot is what "my safety
  // guidelines" and "my content policies" need: without it the pattern only
  // matched when the noun followed the possessive directly, so the two most
  // common wordings of the most common refusal in the list went unmatched.
  /\b(?:against|violates?|violating|goes? against|contrary to) (?:my|our|the|its) (?:safety |content |usage |ethical |core |operating |current )?(?:guidelines|programming|policy|policies|principles|rules|instructions)\b/i,
  // Refusal opener + a task-word a character never says (request, prompt,
  // content, message, scenario, roleplay). This meta object separates "the model
  // refusing a task" from "a character refusing a person," so declining an
  // invitation, a duel, or a marriage proposal in-scene will NOT match.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|must not|must|have to|need to|refuse to|decline to|am (?:not able|unable) to|am going to have to)|'m (?:not able|unable) to|'m going to have to)\b[^.?!\n]{0,30}?\b(?:this|that|your|the) (?:request|prompt|content|message|scenario|roleplay)\b/i,
  // Assistant-only verbs (assist / comply / fulfill) that almost never
  // appear in first-person roleplay dialogue.
  // The object matters: a refusal is aimed at "that" or "this request", never at
  // a concrete thing in the scene. Without this, a servant or aide saying "I
  // can't assist you with the horses today" reads as the model refusing.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|am (?:not able|unable) to)|'m (?:not able|unable) to) (?:be able to )?(?:assist|comply|fulfill?)\b(?:[^.?!\n]{0,30}?\b(?:that|this|it|your request|this request|the request|your prompt)\b|(?:\s+you)?\s*[.!?,"'\u201d\u2019]|(?:\s+you)?\s*$)/i,
  // A reply that opens by declining to write, and names the content or the
  // request in the next few sentences: "I won't produce the next part. It is
  // explicit...". Both halves are needed. The opening alone is a line a
  // first-person narrator can write, and the content words alone are a scene.
  // Auto Retry has the same pattern.
  /^\s*(?:(?:I'm |I am )?sorry[,.!]?\s*(?:but\s+)?)?I(?: (?:can(?:no|')?t|can not|will not|won'?t|am (?:not able|unable|not going|not willing) to|must decline to|have to decline to)|'m (?:not able|unable|not going|not willing) to)\s+(?:write|continue|create|produce|generate|depict|portray|go on with|carry on with|take part in|help with|assist with)\b(?=[\s\S]{0,400}?\b(?:explicit|graphic|sexual(?:ly)?|non-?consensual|consent|polic(?:y|ies)|guidelines?|declin(?:e|ing)|not comfortable|(?:this|the|your) (?:request|prompt)|step(?:ping)? back)\b)/i,
  // Out-of-character comfort hedge, only in the assistant-action sense.
  /\bI don'?t feel comfortable (?:continuing|writing|creating|generating|producing|proceeding|providing|helping|assisting)\b/i,
  // Common modern refusal openers and bodies: "I'm sorry, but I can't create/generate...",
  // "that's not something I can help with", "I'm not going to generate that". Anchored on
  // assistant-action verbs so an in-character line like "I can't marry you" stays safe.
  /\bI(?:'m| am) sorry,? but I(?: can'?t| cannot| won'?t|'m (?:not able|unable) to| am (?:not able|unable) to) (?:create|generate|write|produce|provide|assist|comply|fulfill?|help you with|engage with)\b/i,
  // "that's not something I can help with" and "that isn't something I can
  // help with" are the same sentence, and only the first was matched. Written
  // as three explicit alternatives rather than an optional "not", so it can
  // never match the opposite sentence ("that's something I can help with").
  /\b(?:that|this)(?:'s not|\s+is not|\s+isn'?t) something I(?: can| am able to|'m able to| could) (?:help with|assist with|create|generate|provide|write|do|engage with|write about)\b/i,
  // The plain future has to end the clause where it lands. "This isn't
  // something I'll write" is the model; "that is not something I would write in
  // a letter to him" is somebody in the scene, and the words after the verb are
  // the only thing telling them apart.
  /\b(?:that|this)(?:'s not|\s+is not|\s+isn'?t) something I(?:'ll| will) (?:write|create|generate|produce|engage with|do)\s*[.!?,;]/i,
  /\bI(?:'m| am) not going to (?:create|generate|produce|write) (?:that|this|such|content|explicit|sexual|those)\b/i,
  // Refusing a category of content rather than a request, which is how a model
  // names what it will not write when the subject is self-harm or suicide.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t)|'m (?:not able|unable) to) (?:assist with|provide|create|generate|write|produce) content (?:that|which) (?:promotes|depicts|involves|encourages|facilitates|glorifies)\b/i,
  // The disclaimer a reply attaches instead of writing the scene.
  /\bgiven the (?:sensitive|serious) nature of (?:this|that|the) (?:topic|subject|request|content)\b/i,
  // Refusing a category of writing rather than a request or a subject. The
  // pattern above this one reads the word straight after the verb, so
  // "generate sexually explicit content" walked past it: the list held
  // "sexual" and the reply said "sexually". This leaves room for the adverbs
  // and adjectives that stack up in front of the noun, and the noun itself has
  // to be one a model uses about its own output.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|do not|don'?t|am (?:not able|unable) to|am not going to)|'m (?:not able|unable) to|'m not going to) (?:be able to )?(?:generate|create|write|produce|provide|depict|describe)\b[^.?!\n]{0,30}?\b(?:explicit|graphic|sexual\w*|erotic\w*|pornograph\w*|nsfw|adult|detailed|realistic|extreme|gratuitous|violent|gory) (?:content|material|descriptions?|depictions?)\b/i,
  // The counter-offer that comes with it: the same scene with the objectionable
  // part left out. Nobody in a scene talks about continuing the narrative.
  /\bcontinue the (?:narrative|story|scene|roleplay) with a focus on\b/i,
  /\bwithout (?:the )?(?:explicit|graphic) (?:anatomical|sexual|physical) (?:details?|descriptions?)\b/i,
  // The model deciding a character is under age. This is here for the false
  // positive: an adult character, written as an adult, that a model has
  // misread as a minor, which is a refusal that should not have happened. It
  // is not here to get sexual content involving a minor past a model, and
  // nothing in this extension is meant for that. Nobody in a scene says a
  // character reads as underage, which is what keeps it off ordinary writing.
  /\b(?:appears? to be|reads as|is described as|seems to be|may be) (?:a |an )?(?:minor|underage|child)\b/i,
  // The same thing with the reason in front of the refusal. The refusal has to
  // follow it, because "that would be illegal, he said, and went back to
  // picking the lock" is a scene.
  /\b(?:that|this|it) would be (?:illegal|unlawful)\b[^.?!\n]{0,30}?\bso I (?:can(?:no|')?t|won'?t|will not)\b/i,
  // Declining on the grounds that it would be against the law. The writing verb
  // has to sit between the refusal and the word, so a character refusing to do
  // something illegal in a scene is left alone.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t)|'m not going to)\b[^.?!\n]{0,30}?\b(?:write|create|generate|produce|depict|help with|assist with)\b[^.?!\n]{0,30}?\b(?:illegal|unlawful|against the law|violates? the law)\b/i,
  // The flat no. Some models do not soften it at all: the reply opens with the
  // word and then says what it will not do. Anchored to the start of the reply,
  // because a "No." in the middle of a scene is somebody answering a question,
  // and it still needs an object no character has. The writing verbs are kept
  // next to what they write, so "No. I can't tell you that story" stays safe
  // and "No. I won't write a scene like that" does not.
  /^no[\s.,!\u2014\u2013-]*(?:I(?:'m| am) not going to|I won'?t|I can(?:no|')?t|I cannot|I will not)\b[^.?!\n]{0,60}?(?:\b(?:content|request|prompt|roleplay|role-?play|scenario)\b|\b(?:engage|participate) with (?:this|that|it)\b|\b(?:write|generate|create|produce|depict|continue) (?:a |an |any |the |this )?(?:scene|story|passage|narrative)\b)/i,
  // The same refusal without the opening no, aimed at what it was asked to
  // write rather than at "that". A character declines to write a letter, never
  // a scene or a passage.
  /\bI(?:'m| am) not going to (?:write|create|generate|produce|describe|depict) (?:a |an |any |the )?(?:scene|story|passage|narrative|response|reply)\b/i,
  // The refusal stated as a boundary rather than as an inability: "what I won't
  // do is write that scene". It reads as the model setting terms, which is why
  // none of the patterns above see it: there is no "I can't" in the sentence at
  // all. A character can open a line the same way, so the meta object is doing
  // all the work here. "What I won't do is leave you here" has none of them.
  /\bwhat I(?: (?:won'?t|will not|can(?:no|')?t|cannot|am not going to)|'m not going to) do is\b[^.?!\n]{0,40}?\b(?:write|generate|create|produce|depict|simulate|roleplay|role-?play|content|this scene|that scene|this story)\b/i,
  // The other half of the same reply: what it will do instead. Offered in
  // help-desk register, with the thing it is offering to write named.
  /\b(?:here(?:'s| is) what I (?:can|will) do|what I can (?:do|offer) (?:instead )?is)\b[^.?!\n]{0,60}?\b(?:write|scene|story|content|roleplay|role-?play|instead)\b/i,
  // The doubled refusal: "I cannot and will not engage with content that...".
  // Every pattern above expects the verb straight after the modal, so the
  // conjunction hid the most emphatic refusal there is. A meta object is still
  // required, because "I cannot and will not marry him" is a line from a scene.
  /\bI (?:can(?:no|')?t|cannot|will not|won'?t) and (?:will not|won'?t|cannot|can(?:no|')?t) (?:engage|participate|assist|comply|help|create|generate|produce|write|continue)\b[^.?!\n]{0,40}?\b(?:content|request|prompt|scenario|roleplay|role-?play|this|that)\b/i,
  // "I'm not going to fulfill that request", "I'm not going to comply with that
  // request", "I'm not going to assist with that". The refusal opener list
  // above starts at "I can't" and never covered this shape.
  /\bI(?:'m| am) not going to (?:assist|comply|help|engage)\b[^.?!\n]{0,24}?\b(?:that|this|it|your request|the request)\b/i,
  /\bI(?:'m| am) not going to (?:fulfill?|process|answer)\b[^.?!\n]{0,24}?\b(?:that|this|your|the) (?:request|prompt|message|one)\b/i,
  // "I can't generate that", "I cannot generate that content", "I'm not able to
  // generate that". The object has to follow the verb directly. Allowing
  // anything in between caught "I can't generate enough heat with this flint",
  // because "this" turned up further along the sentence.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|am (?:not able|unable) to|do not|don'?t)|'m (?:not able|unable) to) (?:be able to )?generate (?:that|this|it|those|such|content|explicit|sexual|a response)\b/i,
  // "I don't create content like that", "I don't generate that kind of
  // content". The object is content, which is what a model calls its output.
  /\bI (?:do not|don'?t) (?:create|generate|produce|write|make) (?:(?:that|this) (?:kind|sort|type) of content|content(?: like that| of that (?:kind|sort|nature))?)\b/i,
  // "I can't process that request", "I can't provide advice on that". Process
  // and provide are both things a character can say, so a meta object is
  // required: a request, a prompt, instructions, guidance or advice.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|am (?:not able|unable) to)|'m (?:not able|unable) to) (?:process|handle)\b[^.?!\n]{0,24}?\b(?:that|this|your|the) (?:request|prompt|message|query)\b/i,
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|am (?:not able|unable) to)|'m (?:not able|unable) to) provide (?:that |the |any )?(?:information|instructions?|guidance|advice|assistance|details)\b/i,
  // "I can't help with illegal activities", "I can't assist with harmful
  // requests", "I can't help with requests of this nature".
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|am (?:not able|unable) to)|'m (?:not able|unable) to) (?:help|assist|engage) with\b[^.?!\n]{0,24}?(?:\b(?:illegal|harmful|dangerous|unethical|explicit|violent) (?:activit(?:y|ies)|requests?|content|material)\b|\brequests? of (?:this|that) (?:nature|kind|sort|type)\b)/i,
  // Refusal tied to specific prohibited content policies.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|am (?:not able|unable) to)|'m (?:not able|unable) to) (?:participate|engage) in (?:this |the |any )?(?:roleplay|role-?playing) or (?:create|generate|produce|write) (?:content|stories|scenes|text) depicting (?:sexual violence|non-?consensual (?:sexual )?(?:acts|situations|scenarios|content))\b/i,
  // Refusal aimed at roleplay itself. The verb list above is assistant-only
  // (assist / comply / fulfill); this covers "participate" and "engage", which a
  // character could say, so a meta object is required: roleplay, a scenario, or
  // qualified content. "I cannot participate in this duel" has none of those and
  // stays safe. Bare "content" is left out, since "he said, content
  // to wait" would otherwise match.
  /\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|do not|don'?t|am (?:not able|unable) to)|'m (?:not able|unable) to) (?:participate|engage)\b[^.?!\n]{0,40}?\b(?:role-?play(?:ing|s)?|scenarios?|(?:sexual|explicit|adult|nsfw|romantic|such|this|that) content)\b/i,
  // Fiction disclaimer. Nobody writes this inside a scene; it only appears when
  // the model is explaining that being fictional does not change its answer.
  /\beven (?:in|within) (?:a |an |the )?(?:fictional|fiction|hypothetical|imaginary|make-?believe|creative|roleplay) (?:context|setting|scenario|framing|situation)\b/i,
  // The same disclaimer said the other way round, which is the commoner half:
  // the refusal first and the fiction dismissed after it. Anchored on the word
  // fictional, because "no matter how you frame it" on its own is a line
  // somebody says in an argument.
  /\b(?:regardless of|despite|even with|no matter)\b[^.?!\n]{0,20}?\bfictional (?:framing|context|setting|scenario|premise)\b/i,
  // The same thing with the word fictional dropped, which is how both of the
  // replies that got past 4.9.0 wrote it. "Framing" as a bare noun is the
  // model's word for the wrapper around a request; nobody in a scene has one.
  /\b(?:won'?t|will not|can(?:no|')?t|cannot|do not|don'?t|not going to)\b[^.?!\n]{0,60}?\bregardless of (?:the |any |its )?framing\b/i,
  // Refusing the form rather than the subject. A character never says they do
  // not write roleplay, because a character does not know they are in one.
  /\bI (?:do not|don'?t) (?:write|do|create|generate|engage in) (?:roleplay|role-?play)\b/i,
  /\bI(?:'m| am) not going to (?:roleplay|role-?play)\b/i,
  // "That's something I won't write", which is the sentence the other way up
  // from "that's not something I'll write" and was matched by nothing. The verb
  // has to be one about producing text: "that's something I won't do" is a line
  // from a scene.
  /\b(?:that|this)(?:'s| is) something I (?:won'?t|will not|can(?:no|')?t|cannot) (?:write|create|generate|produce|engage with)(?:\s*[.!?,;]|\s+(?:regardless|even|no matter|under any|in any)\b)/i,
  // Reading your message as a request, and saying which reading it declined.
  /\bif you meant it as a request\b/i,
  // The framing dismissed as a device rather than as a word. "Calling it
  // roleplay doesn't change what it is" is the model arguing with the premise,
  // which is not a thing that happens inside a scene.
  /\b(?:framing|calling|labell?ing|describing|presenting)\b[^.?!\n]{0,60}?\bdoes(?:n'?t| not) change (?:what it is|that|anything|the)\b/i,
  /\bregardless of how\b[^.?!\n]{0,30}?\bis (?:framed|worded|presented|phrased|described)\b/i,
  // The model talking about its own limits, and the offers it closes with.
  /\bI(?:'m| am) here for a genuine conversation\b/i,
  // The redirect offer that closes most refusals. Help-desk register plus a task
  // noun, so an in-scene offer of help does not reach it.
  /\bI(?:'m| am|'d be| would be) (?:available|happy|glad) to (?:assist|help)\b[^.?!\n]{0,60}?\b(?:writing tasks?|creative writing|analysis|queries|other requests?|other topics?|other directions?|another direction|other ideas|a story|a different story|a scene|alternatives)\b/i,
];

// The subjects a model names when it refuses one.
//
// Read this for what it is: a list of words that appear in refusal messages,
// so that a refiner declining the job is recognized as declining it. It is
// not a list of things the extension produces, asks for, or helps anybody
// get. Nothing here reaches a prompt. All a match does is keep the refusal
// from being saved over your reply, which is left as it was.
//
// The words about age are here for one reason: an adult character that a
// model has misread as a minor. This extension is not meant for sexual
// content involving minors, and does not support anybody using it for that.
const REFUSED_SUBJECT =
  "(?:" +
  // Sexual writing as a category, in the words a model names it by.
  // Written with their endings, because a refusal about a backstory says
  // "a character is raped" rather than "rape", and the bare word missed it.
  // Spelled out rather than left to \\w*, so a rapeseed field is still a field.
  "sexual violence|sexual(?:ly)? (?:assault|abus)(?:e|ed|es|ing)?|sexualized? (?:violence|minors?)|" +
  "smut|erotica|porn\\w*|nsfw|sex scenes?|sexual acts?|sexual content|explicit content|" +
  // Consent, which is refused by name as often as by act.
  "non-?consensual\\w*|non-?consent\\w*|noncon|dubcon|dubious consent|questionable consent|" +
  "unclear consent|consent (?:is|being) (?:unclear|ambiguous|absent|dubious)|coerc\\w+|" +
  // Kink, by the words a refusal uses for it.
  // "choking" is left out on purpose, since a scene can choke on smoke.
  "bdsm|bondage|sadomasochis\\w*|sadis\\w*|masochis\\w*|degradation|humiliation|" +
  "breath ?play|impact play|age ?play|pet ?play|kinks?|fetish\\w*|power exchange|" +
  // Family framings a model reads as incest whether or not it is.
  "incest|step-?sibling\\w*|step-?brother|step-?sister|step-?parent|step-?father|" +
  "step-?mother|step-?son|step-?daughter|" +
  // The -ing forms drop the e, so they are written out rather than built from
  // the noun. A bare "rap" is not in here: it is a knock at a door.
  // Violence, in the forms a model refuses it by. "violence" on its own is not
  // here: "I can't describe the violence" is something a character says.
  "(?:graphic|extreme|gratuitous|realistic|detailed|explicit) violence|" +
  "violence against (?:children|minors|a child|animals)|violent deaths?|" +
  "gore|gory|mutilat\\w+|dismember\\w*|body horror|animal (?:cruelty|abuse)|" +
  "murder scenes?|stalking behaviou?r|depictions? of (?:violence|harm|injury|death)|" +
  "real (?:person|people|individuals?)|" +
  "rape(?:d|s)?|raping|bestiality|csam|child (?:sexual )?abuse|minors?|underage|" +
  "self-?harm(?:ed|ing|s)?|suicid(?:e|al)|torture(?:d|s)?|torturing" +
  ")";

const REFUSAL_SUBJECT: RegExp[] = [
  // A refusal verb, then the thing being refused, with room for the wrapper it
  // usually arrives in: "content depicting", "scenes involving", "stories about".
  new RegExp(
    "\\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t|do not|don'?t|am not going to|refuse to)|'m not going to) " +
      "(?:write|create|generate|produce|depict|portray|roleplay|role-?play|participate in|engage (?:in|with)|continue with)\\b" +
      "[^.?!\\n]{0,40}?\\b" + REFUSED_SUBJECT + "\\b",
    "i",
  ),
  // The reason named after the fact: "I can't continue as this involves ...".
  // A refusal has to come first, so an ordinary sentence about what a plot
  // involves is untouched.
  new RegExp(
    "\\bI(?: (?:can(?:no|')?t|cannot|will not|won'?t)|'m not going to)\\b[^.?!\\n]{0,30}?" +
      "\\b(?:as|because|since) (?:this|that|it) (?:involves|depicts|features|contains)\\b" +
      "[^.?!\\n]{0,20}?\\b" + REFUSED_SUBJECT + "\\b",
    "i",
  ),
];

const REFUSAL_PHRASES = [
  "i can't help with that",
  "i cannot help with that",
  "i can't assist with that",
  "i cannot assist with that",
  "i'm unable to help with that",
  "i'm unable to assist with that",
  "i'm not able to help with that",
  "i can't comply with that",
  "i cannot comply with that",
  "i can't provide that information",
  "i cannot provide that information",
  "i can't provide instructions",
  "i can't provide guidance on that",
  "i can't fulfill that request",
  "i can't fulfill that request",
  "i can't support that request",
  "i won't be able to help with that",
  "i can't generate a response to that",
  "i can't provide a response to that",
  "i can't generate that content",
  "i can't engage with that request",
  "can't help with requests like this",
  "can't assist with requests like this",
  "violates our polic",
  "violates the safety polic",
  "violates the content polic",
  "for safety reasons",
  "due to safety concerns",
  "i have to prioritize safety",
  "i cannot create that content",
  "i cannot generate that content",
  "i can't create that content",
  "i'm unable to provide that",
  "i'm unable to complete that request",
  "i can't provide instructions for that",
  "i can't provide guidance for that",
  "i can't provide advice on that",
  "i can't provide assistance with that",
  "i can't assist with harmful requests",
  "i won't be able to assist with that",
  "i'm not able to assist with that",
  "i'm not able to create that content",
  "i can't produce that content",
  "i can't write that content",
  "i can't continue with this request",
  "i can't continue with that request",
  "i must decline this request",
  "i must decline that request",
  "i have to decline that request",
  "i'll have to decline that request",
  "that request goes against",
  "goes against my safety",
  "against my content polic",
  "i'm not able to comply",
  // "this" where the list only had "that". Models pick between the two by which
  // word the sentence before it used, so every entry that reads naturally both
  // ways needs both, and half of these were only ever listed one way.
  "i'm unable to help with this",
  "i can't help with this request",
  "i can't assist with this request",
  "i'm unable to assist with this request",
  "i can't engage with this request",
  "i can't continue with this conversation",
  "i can't provide instructions for this",
  "i'm not going to engage with this prompt",
  // The same sentence without the "not", which is a different sentence and was
  // never matched by the one above it.
  "that's something i can't help with",
  "i'm not able to provide information or help with that",
  "i can't provide information that could facilitate harm",
  // A provider's own code for an answer its filter stopped, written as the
  // answer instead of sent as an error. Matched with the underscore only, so a
  // rewrite that mentions a content filter in words is left alone. It also
  // covers "content_filtered". Auto Retry's list has the same entry.
  "content_filter",
];

// A refusal sent as an error instead of as text: a provider's filter, or
// Lumiverse's words for a reply a provider stopped. Narrow to content wording,
// so a network error or a timeout never matches. The same pattern as Auto
// Retry's, so the two extensions agree on what a refusal is.
const REFUSAL_ERROR =
  /\b(?:prohibited[_ ]?content|content[_ ]?polic(?:y|ies)|safety[_ ]?(?:polic(?:y|ies)|filter|settings?)|response was blocked|blocked (?:by|for) (?:safety|content|moderation)|declined the response|blocked the prompt|reproduce protected material|content[_ ]?filter(?:ed|ing|s)?|moderation|flagged as|violat\w* (?:content|safety|polic)|finish[_ ]?reason["'\s:=]*(?:safety|prohibited|blocklist|recitation)|blocklist)\b/i;

// Every phrase written out, so a check is one pass over three lists rather than
// three passes and a concat on every answer.
function looksLikeRefusal(text: string): boolean {
  const t = String(text == null ? '' : text);
  if (!t) return false;
  // Straight quotes and apostrophes, so a model writing a curly one is read the
  // same as one writing a typewriter one.
  const norm = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  const lower = norm.toLowerCase();
  for (const re of REFUSAL_STRONG) if (re.test(norm)) return true;
  for (const re of REFUSAL_SUBJECT) if (re.test(norm)) return true;
  for (const p of REFUSAL_PHRASES) if (lower.indexOf(p) >= 0) return true;
  return false;
}


// A refusal sent as text: short, and holding refusal wording. A long answer
// that holds the words is a scene, or JSON quoting one.
const REFUSAL_REPLY_MAX = 1500;
function answerRefused(text: string): boolean {
  const shown = stripThinking(String(text == null ? '' : text)).trim();
  return !!shown && shown.length <= REFUSAL_REPLY_MAX && !/^\s*[{[]/.test(shown) && looksLikeRefusal(shown);
}

// The note that goes with an ask made again, from why the last answer failed.
// The panel shows each one and lets it be changed. An empty text sends no
// note for that failure.
const ASK_NOTES: Record<string, string> = {
  refused:
    'Your last answer declined to direct this scene. It is fiction from my own story, and I asked for these voice directions. Please answer with the JSON the instructions ask for, with every word kept exactly as written.',
  empty: 'Your last answer was empty. Please answer with the JSON the instructions ask for.',
  shape: 'Your last answer was not in the JSON shape the instructions ask for. Please answer with that JSON and nothing else.',
  changed:
    'Your last answer changed the words of the lines. Please keep every word exactly as written, and only add tags in square brackets, as the instructions say.',
};

function noteFor(s: Settings, why: string): string {
  if (!s.askNote) return '';
  const own = s.askNotes && typeof s.askNotes[why] === 'string' ? s.askNotes[why] : null;
  return String(own == null ? ASK_NOTES[why] || '' : own).trim();
}

// ---------------------------------------------------------------------------
// The Decision model
// ---------------------------------------------------------------------------

function hasDecisions(): boolean {
  return !!(spindle.decisions && typeof spindle.decisions.evaluate === 'function');
}

// The model's name for the Log: the model id without the maker in front of it.
function who(model?: string): string {
  const m = String(model || '').trim();
  if (!m) return 'the Decision model';
  return m.slice(m.lastIndexOf('/') + 1).replace(/^~/, '') || m;
}

// What went wrong with a Decision call, in words for the Log and the panel.
// Lumiverse's own message is kept after it, so a provider problem can still
// be read.
function decisionTrouble(e: any): string {
  const raw = String((e && e.message) || e || '').slice(0, 300);
  if (/permission/i.test(raw) && /decision/i.test(raw))
    return 'the Decision models permission is refused. Grant it to Auto Foley in Lumiverse, under Extensions';
  if (/No default Decision connection/i.test(raw))
    return 'there is no default Decision connection. Set one up under Decision models in Lumiverse\'s Connections panel, or pick one under Which Decision connection';
  if (/Decision connection not found/i.test(raw))
    return 'the Decision connection picked is gone. Pick another one under Which Decision connection';
  if (/No readable API key/i.test(raw))
    return 'the Decision connection has no key saved. Add its key under Decision models in Lumiverse\'s Connections panel';
  if (/timed out/i.test(raw)) return 'the Decision model did not answer within 30 seconds';
  if (/cancel|abort/i.test(raw)) return 'the call to the Decision model was stopped';
  return 'the Decision model could not be asked: ' + (raw || 'no answer');
}

// The most people offered as choices for one quote. A long list makes every
// choice less likely and the answer less sure.
const MAX_CHOICES = 12;
// How sure the Decision model must be before its pick is used. Below this the
// Director picks the speaker instead.
const SURE = 0.5;

function candidates(cast: CastMember[], text: string, author: string): CastMember[] {
  const lower = text.toLowerCase();
  const scored = cast
    .filter((c) => c.kind !== 'narrator' && !c.muted)
    .map((c) => {
      let s = 0;
      const names = [c.name].concat(c.aliases);
      if (names.some((n) => n && lower.indexOf(n.toLowerCase()) >= 0)) s += 3;
      if (c.name === author) s += 2;
      if (c.kind === 'persona') s += 1;
      return { c, s };
    })
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, MAX_CHOICES).map((x) => x.c);
}

async function askDecisions(
  userId: string | undefined,
  s: Settings,
  segs: Segment[],
  author: string,
  known?: Record<number, string>,
): Promise<{ speakers: Record<number, string>; hints: Record<number, number>; log: string[]; cost: number }> {
  const out = { speakers: {} as Record<number, string>, hints: {} as Record<number, number>, log: [] as string[], cost: 0 };
  if (!hasDecisions()) {
    out.log.push('The Decision model was not used: this Lumiverse has no Decision connections for extensions. Update Lumiverse to use it.');
    return out;
  }
  const passage = segs.map((g) => '#' + g.i + ' (' + g.kind + '): ' + g.text).join('\n');
  const people = candidates(s.cast, passage, author);
  const questions: Record<string, any> = {};
  const speech = segs.filter((g) => g.kind === 'speech' && !(known && known[g.i]));
  if (people.length > 1) {
    const criteria: Record<string, string> = {};
    people.forEach((c, k) => {
      criteria['p' + k] = c.name + (c.note ? ' (' + c.note.slice(0, 80) + ')' : '');
    });
    criteria.other = 'Someone else, who is not in this list';
    for (const g of speech.slice(0, 40)) {
      questions['who_' + g.i] = {
        type: 'choice',
        instructions: 'In `passage`, who says the quoted line #' + g.i + '? Use the narration around it and the flow of the conversation.',
        criteria: criteria,
      };
    }
  }
  if (s.soundsOn && s.directorOn) {
    for (const g of segs.filter((x) => x.kind === 'narration').slice(0, 40)) {
      questions['sound_' + g.i] = {
        type: 'noul',
        instructions: 'Line #' + g.i + ' of `passage` describes a sound a listener in the scene would hear, such as an object being moved, set down or broken, a door, footsteps, weather, or bodies moving.',
      };
    }
  }
  if (!Object.keys(questions).length) return out;
  let got: any;
  try {
    const input: any = { state: { passage: passage, author: author }, questions: questions };
    if (s.decisionConnection) input.connection_id = s.decisionConnection;
    if (userId) input.userId = userId;
    got = await spindle.decisions.evaluate(input);
  } catch (e: any) {
    out.log.push('The Decision model was not used: ' + decisionTrouble(e) + '. The Director picks the speakers instead.');
    return out;
  }
  if (!got || !got.answers || typeof got.answers !== 'object') {
    out.log.push('The Decision model sent back no answers. The Director picks the speakers instead.');
    return out;
  }
  const cost = Number(got.usage && got.usage.cost);
  out.cost = Number.isFinite(cost) ? cost : 0;
  let picked = 0;
  let unsure = 0;
  for (const key of Object.keys(got.answers)) {
    const a = got.answers[key];
    if (!a) continue;
    if (key.indexOf('who_') === 0) {
      const i = Number(key.slice(4));
      const choice = String(a.choice || '');
      const conf = Number(a.confidence);
      const k = choice.charAt(0) === 'p' ? Number(choice.slice(1)) : -1;
      if (k >= 0 && people[k] && Number.isFinite(conf) && conf >= SURE) {
        out.speakers[i] = people[k].name;
        picked++;
      } else unsure++;
    } else if (key.indexOf('sound_') === 0) {
      const i = Number(key.slice(6));
      const chance = Number(a.noul);
      if (Number.isFinite(chance)) out.hints[i] = Math.round(chance * 100) / 100;
    }
  }
  const name = who(got.model);
  if (speech.length && people.length > 1)
    out.log.push(name + ' picked the speaker for ' + picked + ' of ' + speech.length + ' quoted lines' + (unsure ? ', and left ' + unsure + ' to the Director' : '') + '.');
  return out;
}

// ---------------------------------------------------------------------------
// Directing one message
// ---------------------------------------------------------------------------

// Directed scripts kept per account, so playing a message twice, or playing
// one that was prepared ahead, asks nothing again.
const SCRIPTS_KEPT = 40;
const scripts: Record<string, { key: string; script: Script }[]> = {};

function keepScript(userId: string, script: Script) {
  const list = scripts[userId] || (scripts[userId] = []);
  const at = list.findIndex((x) => x.key === script.key);
  if (at >= 0) list.splice(at, 1);
  list.push({ key: script.key, script });
  while (list.length > SCRIPTS_KEPT) list.shift();
  void saveKeptScripts(userId);
}

// Directed messages are kept in the account too, with Keep made audio on, so
// a message played again after Lumiverse restarts asks the Director nothing.
const SCRIPTS_FILE = 'scripts.json';
const scriptsRead: Record<string, boolean> = {};
async function readKeptScripts(userId: string, s: Settings): Promise<void> {
  if (scriptsRead[userId]) return;
  scriptsRead[userId] = true;
  if (!s.keepAudio) return;
  const saved = await readJson(SCRIPTS_FILE, userId || undefined);
  if (!Array.isArray(saved)) return;
  const mine = scripts[userId] || [];
  const old = saved.filter((x: any) => x && typeof x.key === 'string' && x.script && Array.isArray(x.script.lines) && !mine.some((m) => m.key === x.key));
  scripts[userId] = old.concat(mine).slice(-SCRIPTS_KEPT);
}
async function saveKeptScripts(userId: string): Promise<void> {
  try {
    const s = await loadSettings(userId || undefined);
    if (!s.keepAudio) return;
    await writeJson(SCRIPTS_FILE, scripts[userId] || [], userId || undefined);
  } catch (_) {}
}

// ---- Made audio ----
// Each spoken line is kept by a fingerprint of everything sent to speak it:
// the connection, the voice, the model, the words with their tags, and the
// settings. The same line asked for again is played from here, and nothing is
// spent. A changed voice or setting is a new fingerprint, so only that line is
// made again. The oldest go first once the total passes Keep made audio.
const CLIP_INDEX = 'clips/index.json';
const CLIP_MAX_BYTES = 2.5 * 1024 * 1024;
interface ClipEntry {
  sig: string;
  mime: string;
  bytes: number;
  at: number;
}
const clipLists: Record<string, ClipEntry[]> = {};
async function loadClips(userId: string | undefined): Promise<ClipEntry[]> {
  const uid = userId || '';
  if (clipLists[uid]) return clipLists[uid];
  const raw = await readJson(CLIP_INDEX, userId);
  const list: ClipEntry[] = Array.isArray(raw)
    ? raw
        .filter((e: any) => e && /^[a-z0-9]{6,40}$/.test(String(e.sig)) && /^audio\/[a-z0-9.+-]+$/i.test(String(e.mime)))
        .map((e: any) => ({ sig: String(e.sig), mime: String(e.mime), bytes: num(e.bytes, 0, CLIP_MAX_BYTES, 0), at: num(e.at, 0, 1e15, 0) }))
    : [];
  clipLists[uid] = list;
  return list;
}
async function saveClips(userId: string | undefined, list: ClipEntry[]): Promise<boolean> {
  clipLists[userId || ''] = list;
  return writeJson(CLIP_INDEX, list, userId);
}
async function dropClips(userId: string | undefined, gone: ClipEntry[]) {
  for (const e of gone) {
    try {
      await spindle.userStorage.delete('clips/' + e.sig, userId);
    } catch (_) {}
  }
}

function keptScript(userId: string, key: string): Script | null {
  const list = scripts[userId] || [];
  const hit = list.find((x) => x.key === key);
  return hit ? hit.script : null;
}

// A short, stable fingerprint of a text. Not for security: it only tells two
// versions of a message, or two sets of settings, apart.
function hash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

function settingsSig(s: Settings): string {
  return hash(
    JSON.stringify([
      s.directorOn, s.directorConnection, s.strength, s.tagsOn, s.breathsOn, s.soundsOn, s.soundStyle, s.narration,
      s.intimateOn, s.findSpeakers, s.bigMoments, s.prompt, s.decisionsOn, s.decisionConnection, s.extraThinkTags,
      s.thinkingMode, s.thinkingEffort, s.samplers, s.engineNotes,
      s.cast.map((c) => [c.name, c.aliases, c.note, c.muted]),
    ]),
  );
}

// Settings change while a message is being directed. A new NPC is added to
// the copy on disk, not to the copy read before the Director was asked.
async function addSpeakers(userId: string | undefined, found: { name: string; gender: string; about: string }[], by: AddedBy = 'ai'): Promise<string[]> {
  if (!found.length) return [];
  const s = await loadSettings(userId);
  const added: string[] = [];
  for (const f of found) {
    if (findMember(s.cast, f.name) || s.cast.length >= MAX_CAST) continue;
    const m = narrator();
    m.id = newId();
    m.name = f.name;
    m.kind = 'npc';
    m.addedBy = by;
    m.note = f.about;
    m.gender = f.gender;
    s.cast.push(m);
    added.push(f.name);
  }
  if (added.length) await saveSettings(userId, s);
  return added;
}

// ---------------------------------------------------------------------------
// Who is in the scene, read on this device
// ---------------------------------------------------------------------------

// Verbs a story uses to say who spoke. "said Wren" and "Wren said" after or
// before a quote name the speaker for certain, so no model is asked.
const SPEECH_VERBS =
  'said|says|asked|asks|whispered|whispers|murmured|murmurs|muttered|mutters|shouted|shouts|yelled|yells|replied|replies|answered|answers|called|calls|snapped|snaps|growled|growls|hissed|hisses|breathed|breathes|added|adds|continued|continues|laughed|laughs|sighed|sighs|cried|cries|told|tells|demanded|demands|begged|begs|pleaded|pleads|offered|offers|warned|warns|admitted|admits|insisted|insists|whimpered|whimpers|purred|purrs|groaned|groans|teased|teases|corrected|corrects|interrupted|interrupts';

// Words that start a sentence with a capital and are never a name.
const NOT_NAMES = new Set(
  ('i he she they we you it his her their our your its the a an this that these those there here then when while as ' +
    'and but or so if after before once someone something somebody nobody everyone everybody one another both each ' +
    'mr mrs ms miss sir lady lord my mine his hers theirs').split(' '),
);

interface SceneRead {
  // Quoted lines whose speaker the text names, by line number.
  named: Record<number, string>;
  // Quoted lines where only an action next to them points at someone.
  likely: Record<number, string>;
  // Cast members the message names, the author first.
  inScene: string[];
  // Names the text says speak who are not in the cast.
  found: string[];
}

function nameIn(cast: CastMember[], raw: string): { member: CastMember | null; name: string } {
  const name = String(raw || '').replace(/['’]s$/, '').trim();
  return { member: findMember(cast, name), name };
}

// A capitalized name of one to three words that is not a common word.
function looksLikeName(t: string): boolean {
  const words = String(t || '').trim().split(/\s+/);
  if (!words.length || words.length > 3) return false;
  return words.every((w) => /^\p{Lu}[\p{L}'’-]{1,}$/u.test(w) && !NOT_NAMES.has(w.toLowerCase()));
}

function readScene(segs: Segment[], cast: CastMember[], author: string): SceneRead {
  const out: SceneRead = { named: {}, likely: {}, inScene: [], found: [] };
  const NAME = '(\\p{Lu}[\\p{L}\'’-]+(?:\\s\\p{Lu}[\\p{L}\'’-]+){0,2})';
  const AFTER_A = new RegExp('^\\s*' + NAME + '\\s+(?:' + SPEECH_VERBS + ')\\b', 'u');
  const AFTER_B = new RegExp('^\\s*(?:' + SPEECH_VERBS + ')\\s+' + NAME + '\\b', 'u');
  const BEFORE = new RegExp(NAME + '\\s+(?:' + SPEECH_VERBS + ')(?:\\s+\\w+){0,3}\\s*[:,]?\\s*$', 'u');
  const take = (i: number, raw: string, sure: boolean) => {
    if (!looksLikeName(raw)) return;
    const got = nameIn(cast, raw);
    const name = got.member ? got.member.name : got.name;
    if (got.member) {
      (sure ? out.named : out.likely)[i] = name;
    } else if (sure && out.found.indexOf(name) < 0 && name.toLowerCase() !== 'narrator') {
      out.found.push(name);
      out.named[i] = name;
    }
  };
  for (const g of segs) {
    if (g.kind !== 'speech') continue;
    const next = segs[g.i + 1];
    const prev = segs[g.i - 1];
    let m: RegExpMatchArray | null = null;
    if (next && next.kind === 'narration' && ((m = next.text.match(AFTER_A)) || (m = next.text.match(AFTER_B)))) {
      take(g.i, m[1], true);
      continue;
    }
    if (prev && prev.kind === 'narration' && (m = prev.text.match(BEFORE))) {
      take(g.i, m[1], true);
      continue;
    }
    // An action just before a quote, such as "Wren set the cup down.", points
    // at who speaks next. Only when the sentence starts with one cast name.
    if (prev && prev.kind === 'narration') {
      const tail = prev.text.match(/[^.!?…]+[.!?…]*\s*$/);
      const last = tail ? tail[0].trim() : '';
      const first = last.match(new RegExp('^' + NAME, 'u'));
      if (first) take(g.i, first[1], false);
    }
  }
  const all = segs.map((g) => g.text).join(' ').toLowerCase();
  const seen: string[] = [];
  const authorMember = findMember(cast, author);
  if (authorMember) seen.push(authorMember.name);
  for (const c of cast) {
    if (c.kind === 'narrator' || seen.indexOf(c.name) >= 0) continue;
    const names = [c.name, c.name.split(/\s+/)[0]].concat(c.aliases).filter((n) => n && n.length >= 3);
    if (names.some((n) => new RegExp('(^|[^\\p{L}])' + escapeRe(n.toLowerCase()) + '(?![\\p{L}])', 'u').test(all))) seen.push(c.name);
  }
  for (const f of out.found) if (seen.indexOf(f) < 0) seen.push(f);
  out.inScene = seen;
  return out;
}

// One round with one connection: the first ask, the waits and the asks made
// again. Answers with a usable answer, or none, and writes each step to the
// Log in plain words.
async function askDirector(userId: string | undefined, s: Settings, payload: any, connection: string, script: Script): Promise<{ answer: any }> {
  let waits = 0;
  let asks = 0;
  let note = '';
  for (;;) {
    let content = '';
    let failed = '';
    try {
      const messages: any[] = [
        { role: 'system', content: s.prompt.trim() || BUILT_IN_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ];
      if (note) messages.push({ role: 'user', content: note });
      const req: any = { messages };
      const reasoning = reasoningFor(s);
      if (reasoning) req.reasoning = reasoning;
      if (Object.keys(s.samplers).length) req.parameters = Object.assign({}, s.samplers);
      if (connection) req.connection_id = connection;
      if (userId) req.userId = userId;
      const res = await withTimeout(req, s.timeoutSecs);
      content = res && typeof res.content === 'string' ? res.content : '';
      const cost = Number(res && res.usage && res.usage.cost);
      if (Number.isFinite(cost)) script.cost += cost;
    } catch (e: any) {
      failed = String((e && e.message) || e || '');
    }
    let why = '';
    let kind = '';
    if (failed) {
      if (REFUSAL_ERROR.test(failed)) {
        why = 'The Director\'s provider refused this message';
        kind = 'refused';
      } else if (errorKind(failed) === 'wait' && waits < s.rateWaits) {
        waits++;
        const ms = Math.min(60000, rateWait(waits, failed));
        script.log.push('The Director\'s provider is busy. Asked again after ' + Math.round(ms / 1000) + ' s (wait ' + waits + ' of ' + s.rateWaits + ').');
        await sleep(ms);
        continue;
      } else {
        script.log.push('The Director could not be asked: ' + generationTrouble(failed) + '.');
        return { answer: null };
      }
    } else {
      const answer = parseJsonObject(content);
      const usable = answer && Array.isArray(answer.lines) && answer.lines.length > 0;
      const kept = usable
        ? answer.lines.filter((l: any) => {
            const seg = payload.lines[Number(l && l.i)];
            return seg && typeof l.text === 'string' && sameWords(l.text, seg.text);
          }).length
        : 0;
      // More than half the lines with changed words is an answer that did the
      // wrong job, not one with a slip in it.
      if (usable && kept * 2 >= answer.lines.length) return { answer };
      if (!content.trim()) {
        why = 'The Director sent back nothing';
        kind = 'empty';
      } else if (!answer && answerRefused(content)) {
        why = 'The Director declined to direct this message';
        kind = 'refused';
      } else if (!usable) {
        why = !answer ? 'The Director answered, but not in the shape asked for' : 'The Director sent back no lines';
        kind = 'shape';
      } else {
        why = 'The Director changed the words of most lines';
        kind = 'changed';
      }
    }
    if (asks < s.retryDirector) {
      asks++;
      note = noteFor(s, kind);
      script.log.push(why + ', so it was asked again' + (note ? ' with a note' : '') + ' (' + asks + ' of ' + s.retryDirector + ').');
      continue;
    }
    script.log.push(why + '.');
    return { answer: null };
  }
}

async function direct(userId: string | undefined, p: any): Promise<Script> {
  const s = await loadSettings(userId);
  const text = str(p.text, 40000);
  const author = str(p.name, 80).trim() || 'Someone';
  const isUser = p.isUser === true;
  const messageId = str(p.messageId, 80);
  const uid = userId || '';
  const engine = cleanEngine(p.engine);
  // The key holds the settings that change a direction, the cast among
  // them, so a changed note or a new person directs the message again.
  const keyFor = (set: Settings) => hash([messageId, str(p.swipeId, 8), text, JSON.stringify(engine), settingsSig(set)].join('\u0001'));
  // The author of a message is in the cast from the first time they speak, so
  // a voice can be picked for them. This comes before the key, so the key
  // holds the cast as it is directed.
  const authorAdded = !findMember(s.cast, author) && s.cast.length < MAX_CAST && author !== 'Someone';
  if (authorAdded) {
    const m = narrator();
    m.id = newId();
    m.name = author;
    m.kind = isUser ? 'persona' : 'character';
    m.addedBy = 'chat';
    m.note = '';
    s.cast.push(m);
    await saveSettings(userId, s);
  }
  const key = keyFor(s);
  await readKeptScripts(uid, s);
  if (!p.fresh) {
    const kept = keptScript(uid, key);
    if (kept) return Object.assign({}, kept, { added: [], log: kept.log.concat('Played from the copy directed before.') });
  }
  const segs = splitSegments(text, s.extraThinkTags, await boundPairs(userId));
  const script: Script = {
    key, messageId, author, lines: [], log: [], directed: false, added: authorAdded ? [author] : [], inScene: [], isUser, model: '', cost: 0,
  };

  if (!segs.length) {
    script.log.push('This message has nothing to read aloud.');
    return script;
  }

  // An engine that cannot make a sound inside a line has its sounds played
  // as separate effects instead.
  const soundStyle: SoundStyle = engine.inVoiceSounds ? s.soundStyle : 'effects';
  const tagsOn = s.tagsOn && engine.tags !== 'none';
  const rules = {
    tagsOn: tagsOn,
    breathsOn: s.breathsOn,
    max: MAX_TAGS[s.strength],
    soundTags: s.soundsOn && soundStyle !== 'effects',
    sounds: s.soundsOn,
    effects: soundStyle !== 'voice',
    narrationRead: s.narration === 'read',
    findSpeakers: s.findSpeakers,
    bigMoments: s.bigMoments,
    list: engine.tags === 'list' ? engine.list : [],
    lineStyle: engine.style && s.tagsOn,
  };

  // The text first: a quote the story itself says who spoke, such as
  // "said Wren", needs no model. The Decision model then picks the rest.
  const scene = readScene(segs, s.cast, author);
  const fixed: Record<number, string> = Object.assign({}, scene.named);
  let hints: Record<number, number> = {};
  const namedCount = Object.keys(scene.named).length;
  if (namedCount) script.log.push('The text names the speaker of ' + namedCount + (namedCount === 1 ? ' quoted line.' : ' quoted lines.'));
  if (scene.found.length && s.findSpeakers) {
    const addedNow = await addSpeakers(userId, scene.found.map((n) => ({ name: n, gender: 'unknown', about: '' })), 'found');
    if (addedNow.length) {
      script.added.push(...addedNow);
      script.log.push('Found in the text and added to the cast: ' + addedNow.join(', ') + '.');
    }
  }
  if (s.decisionsOn) {
    const left = segs.filter((g) => g.kind === 'narration' || !fixed[g.i]);
    const d = await askDecisions(userId, s, left.length ? segs : [], author, fixed);
    for (const k of Object.keys(d.speakers)) if (!fixed[Number(k)]) fixed[Number(k)] = d.speakers[Number(k)];
    hints = d.hints;
    script.log.push(...d.log);
    script.cost += d.cost;
  }
  script.inScene = scene.inScene;

  if (!s.directorOn) {
    const plain = applyDirection(segs, null, s.cast, author, fixed, rules);
    script.lines = plain.lines;
    script.log.push('The Director is off, so the message is read as written.');
    keepScript(uid, script);
    return script;
  }

  const castForPrompt = s.cast
    .filter((c) => !c.muted)
    .map((c) => ({ name: c.name, kind: c.kind, also_called: c.aliases, note: c.note }));
  const payload: any = {
    cast: castForPrompt,
    author: author,
    lines: segs.map((g) => {
      const l: any = { i: g.i, kind: g.kind, text: g.text };
      if (g.sung) l.sung = true;
      if (fixed[g.i]) l.speaker = fixed[g.i];
      else if (scene.likely[g.i]) l.likely_speaker = scene.likely[g.i];
      return l;
    }),
    in_scene: scene.inScene,
    rules: {
      engine: engine.label,
      engine_note: engineNote(s, engine.id),
      max_tags: MAX_TAGS[s.strength],
      acting: s.strength,
      voice_tags: tagsOn,
      line_style: engine.style && s.tagsOn,
      breaths_and_laughs: s.breathsOn,
      sounds: s.soundsOn,
      sound_style: soundStyle,
      narration_is_read: s.narration === 'read',
      intimate: s.soundsOn && s.intimateOn,
      find_speakers: s.findSpeakers,
      big_moments: s.bigMoments,
    },
  };
  if (tagsOn && engine.tags === 'list') payload.rules.tag_list = engine.list;
  if (Object.keys(hints).length) payload.rules.sound_hints = hints;

  // The Director is asked, and asked again when the answer cannot be used:
  // - A busy or rate-limited provider is waited out, up to Wait out a
  //   provider that will not take the call. The refused call cost nothing.
  // - A refusal, an empty answer, an answer in the wrong shape, or one that
  //   changed most words is asked for again, up to Ask again when the
  //   Director's answer fails, with a note saying what went wrong.
  // - Still nothing usable, and a fallback connection is picked: it is asked
  //   the same way.
  // Whatever happens, the message is still read, as written if need be.
  const firstTry = await askDirector(userId, s, payload, s.directorConnection, script);
  let answer = firstTry.answer;
  if (!answer && s.fallbackConnection && s.fallbackConnection !== s.directorConnection) {
    script.log.push('Asking the fallback connection instead.');
    const second = await askDirector(userId, s, payload, s.fallbackConnection, script);
    answer = second.answer;
  }
  if (!answer) script.log.push('The message is read as written.');

  const done = applyDirection(segs, answer, s.cast, author, fixed, rules);
  script.lines = done.lines;
  script.log.push(...done.log);
  script.directed = !!answer;
  if (answer) {
    const tagged = done.lines.filter((l) => l.tags.length).length;
    const sounds = done.lines.reduce((n, l) => n + l.inSounds.length + (l.before ? 1 : 0) + (l.after ? 1 : 0), 0);
    script.log.push('The Director tagged ' + tagged + ' of ' + done.lines.length + ' lines and added ' + sounds + (sounds === 1 ? ' sound.' : ' sounds.'));
  }
  const added = await addSpeakers(userId, done.newSpeakers);
  if (added.length) {
    script.added.push(...added);
    script.log.push('Added to the cast: ' + added.join(', ') + '.');
  }
  // A script is kept only when it was directed. One that fell back because
  // the Director failed is asked again next time. It is kept under the key
  // as the settings are now too, since this message added to the cast.
  if (answer) {
    keepScript(uid, script);
    if (added.length) keepScript(uid, Object.assign({}, script, { key: keyFor(await loadSettings(userId)) }));
  }
  return script;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const SETTINGS_FILE = 'settings.json';
const SOUND_INDEX = 'sounds/index.json';
const KEY_NAME = 'api.elevenlabs.io';

async function readJson(path: string, userId: string | undefined): Promise<any> {
  try {
    if (!spindle.userStorage || typeof spindle.userStorage.read !== 'function') return null;
    const exists = typeof spindle.userStorage.exists === 'function' ? await spindle.userStorage.exists(path, userId) : true;
    if (!exists) return null;
    const raw = await spindle.userStorage.read(path, userId);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function writeJson(path: string, value: any, userId: string | undefined): Promise<boolean> {
  try {
    await spindle.userStorage.write(path, JSON.stringify(value), userId);
    return true;
  } catch (e: any) {
    logWarn('could not save ' + path + ': ' + String((e && e.message) || e));
    return false;
  }
}

async function loadSettings(userId: string | undefined): Promise<Settings> {
  return cleanSettings(await readJson(SETTINGS_FILE, userId));
}

async function saveSettings(userId: string | undefined, s: Settings): Promise<boolean> {
  return writeJson(SETTINGS_FILE, cleanSettings(s), userId);
}

function logWarn(text: string) {
  try {
    spindle.log.warn(text);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Base64, written out because the backend has no Buffer or atob it can rely on
// ---------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  let k = 0;
  for (; k + 2 < bytes.length; k += 3) {
    const n = (bytes[k] << 16) | (bytes[k + 1] << 8) | bytes[k + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - k;
  if (rest === 1) {
    const n = bytes[k] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[k] << 16) | (bytes[k + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

function fromBase64(text: string): Uint8Array {
  const clean = String(text || '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let buf = 0;
  let bits = 0;
  for (let k = 0; k < clean.length; k++) {
    buf = (buf << 6) | B64.indexOf(clean[k]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 255;
    }
  }
  return out.slice(0, o);
}

// ---------------------------------------------------------------------------
// Sounds: the library, made sounds and uploads
// ---------------------------------------------------------------------------

interface SoundEntry {
  id: string;
  // What the sound is, as the Director describes it or as you name it.
  name: string;
  // Words that make this sound play when a description holds one of them.
  triggers: string[];
  source: 'made' | 'upload';
  mime: string;
  bytes: number;
  added: number;
  uses: number;
}

const MAX_SOUNDS = 400;
// Uploads are kept small: they travel through the extension's message bridge.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function cleanSoundEntry(e: any): SoundEntry | null {
  if (!e || typeof e !== 'object') return null;
  const id = str(e.id, 64).replace(/[^a-z0-9_-]/gi, '');
  if (!id) return null;
  return {
    id,
    name: str(e.name, 160).trim() || 'Sound',
    triggers: Array.isArray(e.triggers) ? e.triggers.map((t: any) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
    source: e.source === 'upload' ? 'upload' : 'made',
    mime: /^audio\/[a-z0-9.+-]+$/i.test(String(e.mime)) ? String(e.mime) : 'audio/mpeg',
    bytes: num(e.bytes, 0, 1e9, 0),
    added: num(e.added, 0, 1e15, 0),
    uses: num(e.uses, 0, 1e9, 0),
  };
}

async function loadSounds(userId: string | undefined): Promise<SoundEntry[]> {
  const raw = await readJson(SOUND_INDEX, userId);
  const list = raw && Array.isArray(raw.sounds) ? raw.sounds : [];
  return list.map(cleanSoundEntry).filter(Boolean) as SoundEntry[];
}

async function saveSounds(userId: string | undefined, list: SoundEntry[]): Promise<boolean> {
  return writeJson(SOUND_INDEX, { version: 1, sounds: list.slice(-MAX_SOUNDS) }, userId);
}

// A description in a form two descriptions of the same sound share: lower
// case, no punctuation, no filler words.
const FILLER = /\b(a|an|the|of|on|in|into|onto|against|with|and|some|sound|sounds|noise|softly|loudly|gently|quietly)\b/g;
function soundKey(text: string): string {
  return wordsOf(text).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
}

// The sound in the library that fits a description best: one of your
// triggers, then a sound made from the same description, then one that
// shares most of its words. Uploads come first, so your own clips are used
// before anything new is made.
function matchSound(list: SoundEntry[], description: string): SoundEntry | null {
  const want = soundKey(description);
  if (!want) return null;
  const words = want.split(' ');
  const ordered = list.slice().sort((a, b) => (a.source === b.source ? 0 : a.source === 'upload' ? -1 : 1));
  for (const e of ordered) {
    if (e.triggers.some((t) => t && (' ' + want + ' ').indexOf(' ' + soundKey(t) + ' ') >= 0)) return e;
  }
  for (const e of ordered) if (soundKey(e.name) === want) return e;
  let best: SoundEntry | null = null;
  let bestScore = 0;
  for (const e of ordered) {
    const theirs = soundKey(e.name).split(' ');
    if (!theirs.length) continue;
    const shared = words.filter((w) => w.length > 2 && theirs.indexOf(w) >= 0).length;
    const score = shared / Math.max(words.length, theirs.length);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

// Cleans a pasted key before it goes in a header. A key with a line break or
// a stray space in it fails in a way that looks like a refused key.
function cleanKey(raw: any): string | null {
  const k = String(raw == null ? '' : raw).trim();
  if (!k || k.length > 200 || !/^[\x21-\x7e]+$/.test(k)) return null;
  return k;
}

async function getKey(userId: string | undefined): Promise<string | null> {
  try {
    if (!spindle.enclave || typeof spindle.enclave.get !== 'function') return null;
    return await spindle.enclave.get(KEY_NAME, userId);
  } catch (_) {
    return null;
  }
}

function elevenTrouble(status: number, body: string): string {
  let detail = '';
  try {
    const j = JSON.parse(body);
    const d = j && j.detail;
    detail = typeof d === 'string' ? d : d && typeof d.message === 'string' ? d.message : '';
  } catch (_) {}
  const tail = detail ? ' ElevenLabs said: ' + detail.slice(0, 200) : '';
  if (status === 401) return 'ElevenLabs refused the key. Check the key in the Sounds tab.' + tail;
  if (status === 403) return 'ElevenLabs says this key cannot make sound effects. Check the key has the Sound Effects permission.' + tail;
  if (status === 402) return 'The ElevenLabs account has no credits left for sound effects.' + tail;
  if (status === 422) return 'ElevenLabs could not use this sound description.' + tail;
  if (status === 429) return 'ElevenLabs is busy (too many requests). Try again in a moment.' + tail;
  return 'ElevenLabs answered with an error (' + status + ').' + tail;
}

function corsTrouble(e: any): string {
  const raw = String((e && e.message) || e || '');
  if (/PERMISSION_DENIED|cors_proxy/i.test(raw))
    return 'The CORS proxy permission is refused, so new sounds cannot be made. Grant it to Auto Foley in Lumiverse, under Extensions.';
  if (/only serves audio/i.test(raw))
    return 'ElevenLabs answered with an error instead of a sound. The usual reasons are a refused key, no credits left, or a description ElevenLabs will not make.';
  if (/timed? ?out|timeout/i.test(raw)) return 'ElevenLabs did not answer within 30 seconds.';
  return 'ElevenLabs could not be reached: ' + raw.slice(0, 200);
}

async function cors(url: string, opts: any): Promise<any> {
  if (typeof spindle.cors !== 'function') throw new Error('PERMISSION_DENIED: cors_proxy is not available');
  return await spindle.cors(url, opts);
}

// One sound for a description: from the library when one fits, otherwise
// made by ElevenLabs and added to the library, so the same sound is free the
// next time.
async function soundFor(userId: string | undefined, description: string): Promise<{ id?: string; base64?: string; mime?: string; name?: string; error?: string; made?: boolean }> {
  const desc = cleanSound(description);
  if (!desc) return { error: 'No sound description.' };
  const list = await loadSounds(userId);
  const hit = matchSound(list, desc);
  if (hit) {
    try {
      const bytes = await spindle.userStorage.readBinary('sounds/' + hit.id, userId);
      hit.uses++;
      await saveSounds(userId, list);
      return { id: hit.id, base64: toBase64(bytes), mime: hit.mime, name: hit.name };
    } catch (_) {
      // The file is gone while its entry stayed. The entry goes, and a new
      // sound is made below.
      list.splice(list.indexOf(hit), 1);
      await saveSounds(userId, list);
    }
  }
  const s = await loadSettings(userId);
  if (!s.makeSounds) return { error: 'No sound in your library fits "' + desc + '", and making new sounds is off.' };
  const key = await getKey(userId);
  if (!key) return { error: 'No sound in your library fits "' + desc + '". Save an ElevenLabs key in the Sounds tab to make new ones.' };
  const body: any = { text: desc, prompt_influence: 0.4 };
  if (s.soundSeconds >= 0.5) body.duration_seconds = s.soundSeconds;
  // A busy answer is waited out, up to Wait out a provider that will not take
  // the call. Each wait is capped at 30 seconds, since a sound is wanted while
  // the message is still playing.
  let res: any;
  let status = 0;
  for (let wait = 0; ; wait++) {
    try {
      res = await cors('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key, Accept: 'audio/mpeg' },
        body: JSON.stringify(body),
        responseType: 'arraybuffer',
        mediaType: 'audio',
      });
    } catch (e: any) {
      const raw = String((e && e.message) || e || '');
      if (wait < s.rateWaits && errorKind(raw) === 'wait') {
        await sleep(Math.min(30000, rateWait(wait + 1, raw)));
        continue;
      }
      return { error: corsTrouble(e) };
    }
    status = Number(res && res.status);
    const busy = status === 429 || (status >= 500 && status < 600);
    if (busy && wait < s.rateWaits) {
      const said = String((res && res.headers && (res.headers['retry-after'] || res.headers['Retry-After'])) || '');
      await sleep(Math.min(30000, rateWait(wait + 1, said ? 'retry-after: ' + said : '')));
      continue;
    }
    break;
  }
  if (!res || status < 200 || status >= 300) return { error: elevenTrouble(status, String((res && res.body) || '')) };
  const b64 = String(res.body || '');
  const bytes = fromBase64(b64);
  if (bytes.length < 64) return { error: 'ElevenLabs sent back an empty sound.' };
  const entry: SoundEntry = {
    id: 's' + newId(),
    name: desc,
    triggers: [],
    source: 'made',
    mime: 'audio/mpeg',
    bytes: bytes.length,
    added: Date.now(),
    uses: 1,
  };
  try {
    await spindle.userStorage.writeBinary('sounds/' + entry.id, bytes, userId);
    list.push(entry);
    await saveSounds(userId, list);
  } catch (e: any) {
    logWarn('could not keep a made sound: ' + String((e && e.message) || e));
  }
  return { id: entry.id, base64: b64, mime: entry.mime, name: entry.name, made: true };
}

async function testKey(userId: string | undefined): Promise<{ ok: boolean; text: string }> {
  const key = await getKey(userId);
  if (!key) return { ok: false, text: 'No key is saved.' };
  let res: any;
  try {
    res = await cors('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: { 'xi-api-key': key, Accept: 'application/json' },
    });
  } catch (e: any) {
    return { ok: false, text: corsTrouble(e) };
  }
  const status = Number(res && res.status);
  if (status >= 200 && status < 300) {
    let left = '';
    try {
      const j = JSON.parse(String(res.body || ''));
      const used = Number(j.character_count);
      const limit = Number(j.character_limit);
      if (Number.isFinite(used) && Number.isFinite(limit)) left = ' ' + Math.max(0, limit - used).toLocaleString('en-US') + ' credits are left this month.';
    } catch (_) {}
    return { ok: true, text: 'The key works.' + left };
  }
  return { ok: false, text: elevenTrouble(status, String((res && res.body) || '')) };
}

// ---------------------------------------------------------------------------
// The panel's messages
// ---------------------------------------------------------------------------

function send(userId: string | undefined, msg: any) {
  try {
    spindle.sendToFrontend(msg, userId);
  } catch (e: any) {
    logWarn('could not answer the panel: ' + String((e && e.message) || e));
  }
}

function notify(kind: string, text: string, userId?: string) {
  const k = ['success', 'info', 'warning', 'error'].indexOf(kind) >= 0 ? kind : 'info';
  const words = String(text || '').trim().slice(0, 500);
  if (!words) return;
  try {
    if (!spindle.toast || typeof spindle.toast[k] !== 'function') return;
    spindle.toast[k](words, userId ? { userId } : undefined);
  } catch (_) {}
}

async function listConnections(userId: string | undefined): Promise<{ list: any[]; why?: string }> {
  try {
    const all = await spindle.connections.list(userId);
    const list = (Array.isArray(all) ? all : []).map((c: any) => ({
      id: str(c && c.id, 80),
      name: str(c && c.name, 120),
      model: str(c && c.model, 120),
      provider: str(c && c.provider, 60),
      isDefault: !!(c && c.is_default),
    }));
    return { list };
  } catch (e: any) {
    return { list: [], why: generationTrouble(e) };
  }
}

async function listDecisionConnections(userId: string | undefined): Promise<{ list: any[]; state: string; why?: string }> {
  if (!hasDecisions()) return { list: [], state: 'old', why: 'This Lumiverse has no Decision connections for extensions. Update Lumiverse to use them.' };
  try {
    const all = await spindle.decisions.listConnections(userId ? { userId } : undefined);
    const list = (Array.isArray(all) ? all : []).map((c: any) => ({
      id: str(c && c.id, 80),
      name: str(c && c.name, 120),
      model: who(str(c && c.model, 120)),
      isDefault: !!(c && c.is_default),
      hasKey: !!(c && c.has_api_key),
    }));
    return { list, state: list.length ? 'ok' : 'none' };
  } catch (e: any) {
    return { list: [], state: 'error', why: decisionTrouble(e) };
  }
}

async function onPanel(p: any, userId: string | undefined) {
  if (!p || typeof p !== 'object') return;
  const type = String(p.type || '');
  const requestId = str(p.requestId, 80);
  const answer = (msg: any) => send(userId, Object.assign({ requestId }, msg));
  try {
    switch (type) {
      case 'load': {
        const settings = await loadSettings(userId);
        const sounds = await loadSounds(userId);
        let hasKey = false;
        try {
          hasKey = !!(spindle.enclave && typeof spindle.enclave.has === 'function' && (await spindle.enclave.has(KEY_NAME, userId)));
        } catch (_) {}
        answer({ type: 'state', settings, sounds, hasKey, builtInPrompt: BUILT_IN_PROMPT, builtInNotes: ASK_NOTES, builtInEngineNotes: ENGINE_NOTES, version: VERSION, decisions: hasDecisions() });
        return;
      }
      case 'save': {
        const clean = cleanSettings(p.settings);
        const ok = await saveSettings(userId, clean);
        answer({ type: 'saved', ok, settings: clean });
        if (!ok) notify('warning', 'Your Auto Foley settings could not be saved. They will be lost when the page reloads.', userId);
        return;
      }
      case 'direct': {
        const script = await direct(userId, p);
        answer({ type: 'script', script });
        if (script.added.length) answer({ type: 'state_changed', settings: await loadSettings(userId) });
        return;
      }
      case 'sound': {
        const got = await soundFor(userId, str(p.description, 200));
        answer(Object.assign({ type: 'sound' }, got));
        if (got.made) answer({ type: 'sounds', sounds: await loadSounds(userId) });
        return;
      }
      case 'sound_play': {
        const id = str(p.id, 64).replace(/[^a-z0-9_-]/gi, '');
        const list = await loadSounds(userId);
        const e = list.find((x) => x.id === id);
        if (!e) return answer({ type: 'sound', error: 'That sound is no longer in the library.' });
        try {
          const bytes = await spindle.userStorage.readBinary('sounds/' + e.id, userId);
          return answer({ type: 'sound', id: e.id, base64: toBase64(bytes), mime: e.mime, name: e.name });
        } catch (_) {
          return answer({ type: 'sound', error: 'The file for this sound could not be read.' });
        }
      }
      case 'clip_get': {
        const sig = str(p.sig, 40);
        const s = await loadSettings(userId);
        if (!s.keepAudio || !/^[a-z0-9]{6,40}$/.test(sig)) return answer({ type: 'clip', found: false });
        const list = await loadClips(userId);
        const e = list.find((x) => x.sig === sig);
        if (!e) return answer({ type: 'clip', found: false });
        let bytes: Uint8Array | null = null;
        try {
          bytes = await spindle.userStorage.readBinary('clips/' + sig, userId);
        } catch (_) {
          bytes = null;
        }
        if (!bytes || !bytes.length) {
          await saveClips(userId, list.filter((x) => x.sig !== sig));
          return answer({ type: 'clip', found: false });
        }
        e.at = Date.now();
        void saveClips(userId, list);
        return answer({ type: 'clip', found: true, base64: toBase64(bytes), mime: e.mime });
      }
      case 'clip_put': {
        const sig = str(p.sig, 40);
        const s = await loadSettings(userId);
        const mime = /^audio\/[a-z0-9.+-]+$/i.test(String(p.mime)) ? String(p.mime) : '';
        if (!s.keepAudio || !/^[a-z0-9]{6,40}$/.test(sig) || !mime) return answer({ type: 'clip_kept', ok: false });
        const bytes = fromBase64(str(p.base64, CLIP_MAX_BYTES * 2));
        if (!bytes.length || bytes.length > CLIP_MAX_BYTES) return answer({ type: 'clip_kept', ok: false });
        try {
          await spindle.userStorage.writeBinary('clips/' + sig, bytes, userId);
        } catch (e: any) {
          return answer({ type: 'clip_kept', ok: false, error: 'The audio could not be kept: ' + String((e && e.message) || e).slice(0, 200) });
        }
        const list = (await loadClips(userId)).filter((x) => x.sig !== sig);
        list.push({ sig, mime, bytes: bytes.length, at: Date.now() });
        // The oldest go first, until the total fits.
        list.sort((a, b) => a.at - b.at);
        const cap = s.keepAudio * 1024 * 1024;
        let total = list.reduce((n, x) => n + x.bytes, 0);
        const gone: ClipEntry[] = [];
        while (total > cap && list.length > 1) {
          const old = list.shift() as ClipEntry;
          total -= old.bytes;
          gone.push(old);
        }
        const ok = await saveClips(userId, list);
        await dropClips(userId, gone);
        return answer({ type: 'clip_kept', ok });
      }
      case 'clips_state': {
        const list = await loadClips(userId);
        return answer({ type: 'clips_state', count: list.length, bytes: list.reduce((n, x) => n + x.bytes, 0) });
      }
      case 'clips_clear': {
        const list = await loadClips(userId);
        await dropClips(userId, list);
        const ok = await saveClips(userId, []);
        delete scripts[userId || ''];
        scriptsRead[userId || ''] = true;
        try {
          await writeJson(SCRIPTS_FILE, [], userId);
        } catch (_) {}
        return answer({ type: 'clips_state', ok, count: 0, bytes: 0, error: ok ? '' : 'The kept audio could not all be cleared.' });
      }
      case 'sound_upload': {
        const bytes = fromBase64(str(p.base64, MAX_UPLOAD_BYTES * 2));
        const mime = /^audio\/[a-z0-9.+-]+$/i.test(String(p.mime)) ? String(p.mime) : '';
        if (!mime) return answer({ type: 'uploaded', ok: false, error: 'That file is not a sound Auto Foley can play. Use MP3, WAV, OGG or M4A.' });
        if (!bytes.length) return answer({ type: 'uploaded', ok: false, error: 'That file is empty.' });
        if (bytes.length > MAX_UPLOAD_BYTES) return answer({ type: 'uploaded', ok: false, error: 'That file is larger than 3 MB. Use a shorter or smaller clip.' });
        const list = await loadSounds(userId);
        if (list.length >= MAX_SOUNDS) return answer({ type: 'uploaded', ok: false, error: 'The library is full (' + MAX_SOUNDS + ' sounds). Delete some first.' });
        const entry: SoundEntry = {
          id: 'u' + newId(),
          name: str(p.name, 160).replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_-]+/g, ' ').trim() || 'My sound',
          triggers: Array.isArray(p.triggers) ? p.triggers.map((t: any) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
          source: 'upload',
          mime,
          bytes: bytes.length,
          added: Date.now(),
          uses: 0,
        };
        try {
          await spindle.userStorage.writeBinary('sounds/' + entry.id, bytes, userId);
        } catch (e: any) {
          return answer({ type: 'uploaded', ok: false, error: 'The sound could not be saved: ' + String((e && e.message) || e).slice(0, 200) });
        }
        list.push(entry);
        const ok = await saveSounds(userId, list);
        answer({ type: 'uploaded', ok, error: ok ? '' : 'The sound was saved, but the library list could not be updated.' });
        answer({ type: 'sounds', sounds: await loadSounds(userId) });
        return;
      }
      case 'sound_edit': {
        const list = await loadSounds(userId);
        const e = list.find((x) => x.id === str(p.id, 64));
        if (!e) return answer({ type: 'sounds', sounds: list });
        if (typeof p.name === 'string') e.name = str(p.name, 160).trim() || e.name;
        if (Array.isArray(p.triggers)) e.triggers = p.triggers.map((t: any) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12);
        const ok = await saveSounds(userId, list);
        if (!ok) notify('warning', 'The change to this sound could not be saved.', userId);
        answer({ type: 'sounds', sounds: list });
        return;
      }
      case 'sound_delete': {
        const list = await loadSounds(userId);
        const at = list.findIndex((x) => x.id === str(p.id, 64));
        if (at >= 0) {
          const [gone] = list.splice(at, 1);
          try {
            await spindle.userStorage.delete('sounds/' + gone.id, userId);
          } catch (_) {}
          const ok = await saveSounds(userId, list);
          if (!ok) notify('warning', 'The sound could not be removed from the library.', userId);
        }
        answer({ type: 'sounds', sounds: list });
        return;
      }
      case 'key_save': {
        const key = cleanKey(p.key);
        if (!key) return answer({ type: 'key', hasKey: false, text: 'That does not look like an ElevenLabs key. Paste it again, with no spaces or line breaks.' });
        try {
          await spindle.enclave.put(KEY_NAME, key, userId);
        } catch (e: any) {
          return answer({ type: 'key', hasKey: false, text: 'The key could not be saved: ' + String((e && e.message) || e).slice(0, 200) });
        }
        const t = await testKey(userId);
        answer({ type: 'key', hasKey: true, ok: t.ok, text: t.text });
        return;
      }
      case 'key_forget': {
        try {
          await spindle.enclave.delete(KEY_NAME, userId);
        } catch (e: any) {
          return answer({ type: 'key', hasKey: true, text: 'The key could not be removed: ' + String((e && e.message) || e).slice(0, 200) });
        }
        answer({ type: 'key', hasKey: false, text: 'The key is removed.' });
        return;
      }
      case 'key_test': {
        const t = await testKey(userId);
        answer({ type: 'key', hasKey: t.text !== 'No key is saved.', ok: t.ok, text: t.text });
        return;
      }
      case 'list_connections': {
        answer(Object.assign({ type: 'connections' }, await listConnections(userId)));
        return;
      }
      case 'list_decision_connections': {
        answer(Object.assign({ type: 'decision_connections' }, await listDecisionConnections(userId)));
        return;
      }
      case 'check_director': {
        const s = await loadSettings(userId);
        try {
          const req: any = {
            messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
            reasoning: { source: 'off' },
          };
          if (s.directorConnection) req.connection_id = s.directorConnection;
          if (userId) req.userId = userId;
          const res = await spindle.generate.quiet(req);
          const got = res && typeof res.content === 'string' ? res.content.trim() : '';
          answer({ type: 'check', part: 'director', ok: !!got, text: got ? 'The Director answered.' : 'The Director sent back nothing.' });
        } catch (e: any) {
          answer({ type: 'check', part: 'director', ok: false, text: 'The Director could not be asked: ' + generationTrouble(e) + '.' });
        }
        return;
      }
      case 'check_decisions': {
        const d = await listDecisionConnections(userId);
        const s = await loadSettings(userId);
        let ok = false;
        let text = '';
        if (d.state === 'old' || d.state === 'error') text = d.why || 'Decision connections could not be read.';
        else if (!d.list.length) text = 'There are no Decision connections. Set one up under Decision models in Lumiverse\'s Connections panel.';
        else {
          const c = s.decisionConnection ? d.list.find((x) => x.id === s.decisionConnection) : d.list.find((x) => x.isDefault);
          if (!c) text = s.decisionConnection ? 'The Decision connection picked is gone. Pick another one in the Director tab.' : 'None of your Decision connections is the default. Pick one in the Director tab.';
          else if (!c.hasKey) text = 'The Decision connection "' + c.name + '" has no key saved.';
          else {
            ok = true;
            text = 'The Decision connection "' + c.name + '" (' + c.model + ') is ready.';
          }
        }
        answer({ type: 'check', part: 'decisions', ok, text });
        return;
      }
      case 'reset': {
        // Start again: each chosen part goes back to its default. With every
        // part chosen, everything Auto Foley keeps for this account is gone.
        const parts: string[] = Array.isArray(p.parts) ? p.parts.filter((x: any) => RESET_PARTS.indexOf(x) >= 0) : [];
        const s = await loadSettings(userId);
        const fresh = cleanSettings({});
        if (parts.indexOf('settings') >= 0) {
          const keep = { cast: s.cast, folders: s.folders, prompt: s.prompt, askNotes: s.askNotes, engineNotes: s.engineNotes, exportParts: s.exportParts, importParts: s.importParts, resetParts: s.resetParts };
          Object.assign(s, fresh, keep);
        }
        if (parts.indexOf('prompt') >= 0) {
          s.prompt = '';
          s.askNotes = {};
          s.engineNotes = {};
        }
        if (parts.indexOf('cast') >= 0) {
          s.cast = fresh.cast;
          s.folders = [];
        }
        let ok = await saveSettings(userId, s);
        if (parts.indexOf('sounds') >= 0) {
          const list = await loadSounds(userId);
          for (const e of list) {
            try {
              await spindle.userStorage.delete('sounds/' + e.id, userId);
            } catch (_) {}
          }
          ok = (await saveSounds(userId, [])) && ok;
        }
        if (parts.indexOf('audio') >= 0) {
          const list = await loadClips(userId);
          await dropClips(userId, list);
          ok = (await saveClips(userId, [])) && ok;
          try {
            await writeJson(SCRIPTS_FILE, [], userId);
          } catch (_) {}
        }
        if (parts.indexOf('key') >= 0) {
          try {
            await spindle.enclave.delete(KEY_NAME, userId);
          } catch (_) {
            ok = false;
          }
        }
        delete scripts[userId || ''];
        let hasKey = false;
        try {
          hasKey = !!(spindle.enclave && typeof spindle.enclave.has === 'function' && (await spindle.enclave.has(KEY_NAME, userId)));
        } catch (_) {}
        answer({ type: 'reset', ok, error: ok ? '' : 'Some of it could not be reset. The rest was.', settings: await loadSettings(userId), sounds: await loadSounds(userId), hasKey });
        return;
      }
      case 'notify': {
        notify(str(p.kind, 10), str(p.text, 500), userId);
        return;
      }
      default:
        return;
    }
  } catch (e: any) {
    logWarn('panel request ' + type + ' failed: ' + String((e && e.message) || e));
    answer({ type: 'failed', of: type, error: 'Something went wrong in Auto Foley\'s backend: ' + String((e && e.message) || e).slice(0, 200) });
  }
}

try {
  // The promise is returned so a caller that waits can see the work finish.
  // onPanel catches its own errors, so it never rejects.
  spindle.onFrontendMessage((payload: any, userId?: string) => onPanel(payload, userId));
} catch (e: any) {
  logWarn('could not listen to the panel: ' + String((e && e.message) || e));
}

try {
  spindle.log.info('Auto Foley ' + VERSION + ' loaded.');
} catch (_) {}
