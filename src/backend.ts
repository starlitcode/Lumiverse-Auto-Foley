// Auto Foley, the backend.
//
// The backend is the part that thinks. It keeps each account's settings, asks
// the Decision model who says each quoted line, asks the Director (a second
// model) for voice tags and sounds, checks that the Director changed no words,
// and makes or finds sound effects. The panel in the browser is the part that
// plays: it reads the message, sends it here, and plays the script that comes
// back through the reader's TTS connections in Lumiverse.
//
// One backend process can serve every account on a server, so everything that
// belongs to a person is kept per user id, in spindle.userStorage, and every
// reply goes back addressed to that user.

declare const spindle: any;
declare function setTimeout(fn: () => void, ms: number): any;
declare function clearTimeout(handle: any): void;

const VERSION = '1.10.0';

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
  // The name the panel and the players show. The Director keeps using the
  // name, which is how lines are matched to people.
  display?: string;
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
  // The group they are in on the Cast tab. Empty is none.
  group: string;
  // A small picture made on the reader's device, as a data address. Empty
  // shows the first letter of the name.
  picture: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  // More settings for the person's engine, sent only to the engine that
  // takes each one. PARAM_SPEC says which keys there are.
  params: Record<string, number | string | boolean>;
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
  // Turns a louder voice down to match the quietest one in a message.
  evenVoices: boolean;
  voiceVolume: number;
  soundVolume: number;
  reduceMotion: boolean;
  // The Director.
  directorOn: boolean;
  directorConnection: string;
  // A second Director, asked when the first sends back no script it can use.
  // Empty asks the default connection.
  backupOn: boolean;
  backupConnection: string;
  strength: Strength;
  tagsOn: boolean;
  breathsOn: boolean;
  soundsOn: boolean;
  // How sounds are made. "voice": a [sound of ...] tag inside a spoken line,
  // which Eleven v3 and v4 perform with the line. "effects": separate clips,
  // from the library, Freesound or ElevenLabs. "both": the Director chooses.
  soundStyle: SoundStyle;
  intimateOn: boolean;
  findSpeakers: boolean;
  bigMoments: boolean;
  prompt: string;
  // The Decision model.
  decisionsOn: boolean;
  decisionConnection: string;
  // How sure the Decision model must be, in percent, before its answer is
  // used: a speaker it picks, or a line it finds likely to be a sound.
  decisionSure: number;
  // Sounds.
  makeSounds: boolean;
  // Where a sound the library does not have comes from: Freesound first and
  // then ElevenLabs, or only one of them.
  soundFrom: 'both' | 'freesound' | 'eleven';
  // Which Freesound licenses may be used: all three, the two that allow any
  // use, or Creative Commons 0 only.
  freesoundLicense: 'any' | 'free' | 'cc0';
  // Scene music: off by default. The Director picks a mood for the scene,
  // and a track for that mood plays quietly under it.
  musicOn: boolean;
  // How loud the music is, from 0 to 1.
  musicVolume: number;
  // The music is turned down while someone speaks.
  musicDip: boolean;
  // Where music comes from: the tracks in your library only, or your
  // library first and then Freesound.
  musicFrom: 'library' | 'both';
  soundSeconds: number;
  // The Director's model settings, named and sent the way Auto Refine sends
  // its own: thinking, the samplers typed in, and how long to wait.
  thinkingMode: string;
  thinkingEffort: string;
  samplers: Record<string, number | ''>;
  timeoutSecs: number;
  // The Director's prices, per million tokens, from the reader. 0 shows no
  // cost worked out from them.
  costIn: number;
  costOut: number;
  // The voice service's price per million characters, from the reader.
  voicePrice: number;
  // How many times to wait and ask again when a provider is busy.
  rateWaits: number;
  // A note sent with an ask made again, saying what went wrong with the last
  // answer, and the reader's own text for each note.
  askNote: boolean;
  askNotes: Record<string, string>;
  // A second connection to ask when the Director still refuses or fails.
  // The look and the floating player, which follow the account like every
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
  // The Studio tab. What goes into kept audio and video: sound effects, a
  // pause between parts in seconds, the volumes as heard, and evened-out
  // loudness. Audio is saved as one file or a ZIP of parts.
  studioSounds: boolean;
  studioGap: number;
  studioAsHeard: boolean;
  studioLoud: boolean;
  audioSplit: 'one' | 'parts';
  // How a video looks. Names also go in the title and in the name of every
  // file saved. Sizes are in percent or in pixels of a 1080-pixel frame, and
  // times in seconds. Colors are #rrggbb, empty for the built-in one.
  videoShape: 'wide' | 'tall' | 'square';
  videoFont: string;
  videoSize: number;
  videoInk: string;
  videoWords: 'light' | 'appear' | 'all';
  videoPlace: 'middle' | 'lower';
  videoQuotes: boolean;
  videoNames: boolean;
  videoPics: boolean;
  videoPicShape: 'circle' | 'rounded';
  videoPicSize: number;
  videoNameColor: 'kind' | 'words';
  videoBack: 'dark' | 'color' | 'picture';
  videoBackColor: string;
  videoDim: number;
  videoBlur: number;
  // How dark the edges of the frame are made, in percent. 0 is none.
  videoEdges: number;
  // Their color, as #rrggbb. Empty is black.
  videoEdgeColor: string;
  videoMove: string;
  videoMoveSecs: number;
  videoTitleOn: boolean;
  videoTitleText: string;
  videoFadeOut: number;
  videoCaptions: boolean;
  // Notes shown over the video: the words, when they show, and where.
  videoNotes: { text: string; when: 'all' | 'start' | 'end' | 'from'; from: number; secs: number; place: 'top' | 'bottom' }[];
  // Folders in Saved audio, and how it is sorted.
  savedFolders: { id: string; name: string; open: boolean }[];
  savedSort: 'new' | 'old' | 'az';
  // Video looks saved under a name in the Studio, each the video settings
  // it holds.
  videoLooks: { id: string; name: string; look: Record<string, any> }[];
  // Words hidden in kept video and audio: covered on screen, and bleeped.
  censorOn: boolean;
  censorWords: string;
  censorCover: 'bar' | 'blur' | 'pixels';
  censorBleep: boolean;
  // The word being spoken is lit in the message in the chat.
  chatHighlight: boolean;
  // The color of the lit word, as #rrggbb, and how strong it is, from 10 to
  // 80 per cent. Empty uses the theme's accent.
  wordColor: string;
  // A color of the reader's own for each kind of part, or empty for the
  // built-in one.
  colorNarrator: string;
  colorCharacter: string;
  colorPersona: string;
  colorNpc: string;
  colorSound: string;
  colorTag: string;
  wordStrength: number;
  // The player under a message: its accent, its background and its words, as
  // #rrggbb. Empty uses the theme's own.
  playerAccent: string;
  playerBack: string;
  playerInk: string;
  // The address of a Chatterbox-TTS-Server Auto Foley talks to itself, with
  // no Lumiverse connection between, so its own settings can be sent.
  chatterboxUrl: string;
  panelPattern: string;
  boxSolid: number;
  widgetOn: boolean;
  widgetSize: number;
  pauseKeyOn: boolean;
  pauseKey: string;
  // How many more times to ask the Director when its answer cannot be used.
  retryDirector: number;
  // A button on every message, and one in the chat's own row of buttons.
  messageButton: boolean;
  barButton: boolean;
  // A small player under each message performed.
  messagePlayer: boolean;
  // The Start here guide on the Stage tab has been read.
  guideSeen: boolean;
  // Which parts the export, the import and Start again cover.
  exportParts: string[];
  importParts: string[];
  resetParts: string[];
  // The chats Auto Foley is switched off in, by chat id. A temporary chat is
  // never kept here, since its id is never seen again.
  chatsOff: string[];
  // Seconds to wait before a new reply plays by itself.
  autoplayDelay: number;
  // More tag names that hold thinking, one per entry, such as "musing".
  extraThinkTags: string[];
  // Leave out trackers, status blocks and other text not meant to be heard.
  skipOn: boolean;
  // Send emojis in a line to the voice service. Off, they are left out.
  emojisOn: boolean;
  // The patterns for it, one per line. Empty uses the built-in ones.
  skipPatterns: string;
  // Which quote marks open speech: auto, or single quotes too.
  speechMarks: string;
  // Text between *asterisks*: read as narration, read as the speaker's
  // thoughts in their own voice, or left out.
  asterisks: string;
  // Text in (parentheses): read as narration, read as the speaker's
  // thoughts in their own voice, or left out.
  parens: string;
  // Text in quote marks: read as speech, read as narration, or left out.
  quotedText: string;
  // Text with no marks around it: read as narration, read as speech, or
  // left out.
  plainText: string;
  // The engine a connection runs, by connection id, when it is said outright
  // rather than found from the connection.
  engines: Record<string, string>;
  // The reader's own wording of the note sent with each engine, by engine id.
  engineNotes: Record<string, string>;
  // How much made audio to keep in the account, in MB. 0 keeps none.
  keepAudio: number;
  // The kinds of Log line switched off, by kind. Every kind shows by default.
  logShow: Record<string, boolean>;
  // What this account has been told about: a mark of the built-in prompt,
  // notes and patterns it last saw, and the moved defaults it answered.
  builtInSeen: string;
  movedSeen: string;
  // Who the Director's prompt is sent as: system, user or assistant.
  promptRole: string;
  // Where the note for the engine goes: inside the rules, or as its own
  // message from system, user or assistant.
  engineNoteRole: string;
  // Who a note sent with an ask made again is from.
  askNoteRole: string;
  // The reader's own wording of the Decision model's questions, by name.
  decisionQuestions: Record<string, string>;
  // Leave out a sound the text around it does not show.
  soundCheck: boolean;
  cast: CastMember[];
  // Groups that sort the cast on the Cast tab. Only for the panel: they
  // change nothing about how anyone sounds.
  groups: CastGroup[];
  // How the Cast tab lists people: by kind, A to Z, Z to A, by voice type,
  // or in the cast's own order, which dragging someone switches to.
  castSort: 'kind' | 'az' | 'za' | 'voice' | 'own';
}

interface CastGroup {
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
  evenVoices: true,
  voiceVolume: 1,
  soundVolume: 0.8,
  reduceMotion: false,
  directorOn: true,
  directorConnection: '',
  backupOn: false,
  backupConnection: '',
  strength: 'natural',
  tagsOn: true,
  breathsOn: true,
  soundsOn: true,
  soundStyle: 'both',
  intimateOn: false,
  findSpeakers: true,
  bigMoments: true,
  prompt: '',
  decisionsOn: false,
  decisionConnection: '',
  decisionSure: 50,
  makeSounds: true,
  soundFrom: 'both',
  freesoundLicense: 'any',
  musicOn: false,
  musicVolume: 0.35,
  musicDip: true,
  musicFrom: 'both',
  soundSeconds: 0,
  autoplayDelay: 0,
  extraThinkTags: [],
  engines: {},
  engineNotes: {},
  keepAudio: 100,
  logShow: {},
  builtInSeen: '',
  movedSeen: '',
  promptRole: 'system',
  engineNoteRole: 'rules',
  askNoteRole: 'user',
  decisionQuestions: {},
  soundCheck: true,
  skipOn: true,
  emojisOn: false,
  skipPatterns: '',
  speechMarks: 'auto',
  asterisks: 'narration',
  parens: 'narration',
  quotedText: 'speech',
  plainText: 'narration',
  thinkingMode: 'off',
  thinkingEffort: 'low',
  samplers: {},
  timeoutSecs: 120,
  costIn: 0,
  costOut: 0,
  voicePrice: 0,
  rateWaits: 2,
  askNote: true,
  askNotes: {},
  applauseOn: false,
  applauseForAi: true,
  applauseForUser: false,
  applauseWhen: 'message',
  applauseSound: '',
  applauseSeconds: 5,
  applauseVolume: 0.6,
  extrasMenu: false,
  studioSounds: true,
  studioGap: 0,
  studioAsHeard: true,
  studioLoud: true,
  audioSplit: 'one',
  videoShape: 'wide',
  videoFont: 'book',
  videoSize: 100,
  videoInk: '',
  videoWords: 'light',
  videoPlace: 'middle',
  videoQuotes: true,
  videoNames: true,
  videoPics: true,
  videoPicShape: 'circle',
  videoPicSize: 150,
  videoNameColor: 'kind',
  videoBack: 'dark',
  videoBackColor: '',
  videoDim: 40,
  videoBlur: 0,
  videoEdges: 50,
  videoEdgeColor: '',
  videoMove: 'rise',
  videoMoveSecs: 0.4,
  videoTitleOn: true,
  videoTitleText: '',
  videoFadeOut: 1.5,
  videoCaptions: true,
  videoNotes: [],
  savedFolders: [],
  savedSort: 'new',
  videoLooks: [],
  censorOn: false,
  censorWords: '',
  censorCover: 'bar',
  censorBleep: true,
  chatHighlight: true,
  wordColor: '',
  colorNarrator: '',
  colorCharacter: '',
  colorPersona: '',
  colorNpc: '',
  colorSound: '',
  colorTag: '',
  wordStrength: 20,
  playerAccent: '',
  playerBack: '',
  playerInk: '',
  chatterboxUrl: '',
  panelPattern: '',
  boxSolid: 60,
  widgetOn: false,
  widgetSize: 44,
  pauseKeyOn: false,
  pauseKey: 'Alt+P',
  retryDirector: 1,
  messageButton: false,
  barButton: false,
  messagePlayer: true,
  guideSeen: false,
  exportParts: ['settings', 'prompt', 'cast', 'chats'],
  importParts: ['settings', 'prompt', 'cast', 'chats'],
  resetParts: ['settings', 'prompt', 'cast', 'chats', 'sounds', 'audio', 'key'],
  chatsOff: [],
  cast: [],
  groups: [],
  castSort: 'kind',
};

const NARRATOR_ID = 'narrator';

function narrator(): CastMember {
  return {
    id: NARRATOR_ID,
    name: 'Narrator',
    display: '',
    kind: 'narrator',
    addedBy: 'you',
    aliases: [],
    voice: '',
    voiceName: '',
    model: '',
    connection: '',
    voices: {},
    group: '',
    picture: '',
    stability: 0.5,
    similarity: 0.75,
    style: 0,
    speed: 1,
    params: {},
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

// A color code as #rrggbb, or empty for anything else, which uses the theme.
function hexColor(v: any): string {
  const t = String(v == null ? '' : v).trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(t) ? t : '';
}

function pick<T extends string>(v: any, allowed: readonly T[], dflt: T): T {
  return allowed.indexOf(v) >= 0 ? (v as T) : dflt;
}

const MAX_CAST = 80;
const MAX_GROUPS = 30;

// A picture is kept only as a small image in a data address, at most 60 KB.
function cleanPicture(v: any): string {
  const t = typeof v === 'string' ? v : '';
  return t.length <= 60000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(t) ? t : '';
}

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

// The more settings a person can have, by key: its type, and its range or
// length. The panel has the same list and shows each one only for the engines
// that take it.
// The most Acting notes can hold. The panel's box has the same limit and
// counts it, so nothing is cut after it is typed.
const NOTE_MAX = 1000;

const PARAM_SPEC: Record<string, { type: 'num' | 'text' | 'bool'; lo?: number; hi?: number; max?: number }> = {
  boost: { type: 'bool' },
  lang: { type: 'text', max: 12 },
  temperature: { type: 'num', lo: 0, hi: 2 },
  top_p: { type: 'num', lo: 0, hi: 1 },
  normalize: { type: 'bool' },
  direction: { type: 'text', max: 300 },
  style_base: { type: 'text', max: 300 },
  exaggeration: { type: 'num', lo: 0.25, hi: 2 },
  cfg_weight: { type: 'num', lo: 0, hi: 1 },
  seed: { type: 'num', lo: 0, hi: 2147483647 },
};
function cleanParams(v: any): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of Object.keys(PARAM_SPEC)) {
    if (!(k in v)) continue;
    const spec = PARAM_SPEC[k];
    const x = v[k];
    if (spec.type === 'bool' && typeof x === 'boolean') out[k] = x;
    else if (spec.type === 'num' && typeof x === 'number' && Number.isFinite(x)) out[k] = Math.min(spec.hi as number, Math.max(spec.lo as number, x));
    else if (spec.type === 'text' && typeof x === 'string') {
      const t = x.replace(/[\u0000-\u001f\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, spec.max);
      if (t) out[k] = t;
    }
  }
  return out;
}

// A server address: http or https, a host, and an optional port and path,
// with no slash at the end. An address pasted with /v1, as an OpenAI-style
// connection takes it, has the /v1 taken off.
function cleanServer(v: any): string {
  const t = str(v, 200).trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
  return /^https?:\/\/[a-z0-9.\-\[\]:]+(\/[\w.\-\/]*)?$/i.test(t) ? t : '';
}

function cleanMember(m: any): CastMember | null {
  if (!m || typeof m !== 'object') return null;
  const name = str(m.name, 80).trim();
  // A name can be erased and left empty until a new one is typed. The
  // person is kept by their id.
  if (!name && !str(m.id, 64)) return null;
  const base = narrator();
  return {
    id: str(m.id, 64) || newId(),
    name: name,
    display: str(m.display, 60).trim(),
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
    group: str(m.group, 64),
    picture: cleanPicture(m.picture),
    stability: num(m.stability, 0, 1, base.stability),
    similarity: num(m.similarity, 0, 1, base.similarity),
    style: num(m.style, 0, 1, base.style),
    // Fish Audio and Chatterbox take 0.5 to 2. ElevenLabs takes 0.7 to 1.2,
    // and the panel keeps its slider in that range for an ElevenLabs voice.
    speed: num(m.speed, 0.5, 2, base.speed),
    params: cleanParams(m.params),
    note: str(m.note, NOTE_MAX),
    gender: pick(m.gender, ['female', 'male', 'nonbinary', 'unknown'] as const, 'unknown'),
    muted: bool(m.muted, false),
  };
}

// Settings from storage or from the panel are input, not a promise. Every
// field is checked and anything missing takes its default, so a file written
// by an older version, or edited by hand, still loads.
// The parts a file can carry, and the parts Start again can put back. A file
// never carries the sound library or the key: the library is made of audio
// files, and a key belongs in Lumiverse's secure storage, not in a file.
const TRANSFER_PARTS = ['settings', 'prompt', 'cast', 'chats'];

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
const RESET_PARTS = ['settings', 'prompt', 'cast', 'chats', 'sounds', 'audio', 'key'];
const KEEP_AUDIO_CHOICES = [0, 50, 100, 250, 500];

function cleanNotes(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of ['refused', 'empty', 'shape', 'changed']) if (typeof v[k] === 'string') out[k] = v[k].slice(0, 2000);
  return out;
}

// The questions the Decision model is asked. {n} is the number of the line.
// Shown in the Director tab, where they can be changed, with a way back.
const DECISION_QUESTIONS: Record<string, string> = {
  who: 'In `passage`, who says the quoted line #{n}? Use the narration around it and the flow of the conversation.',
  sound: 'Line #{n} of `passage` describes a sound a listener in the scene would hear, such as an object being moved, set down or broken, a door, footsteps, weather, or bodies moving.',
};

function cleanQuestions(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of Object.keys(DECISION_QUESTIONS)) if (typeof v[k] === 'string' && v[k].trim()) out[k] = v[k].slice(0, 1000);
  return out;
}

function question(s: Settings, k: string, n: number): string {
  const own = s.decisionQuestions && s.decisionQuestions[k] ? s.decisionQuestions[k] : '';
  const text = own || DECISION_QUESTIONS[k] || '';
  return text.indexOf('{n}') >= 0 ? text.split('{n}').join(String(n)) : text + ' (line #' + n + ')';
}

const LOG_KIND_IDS = ['play', 'director', 'decision', 'cast', 'sound', 'setting', 'problem'];
function cleanLogShow(v: any): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of LOG_KIND_IDS) if (v[k] === false) out[k] = false;
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

// At most 500 chats switched off, the newest kept, the same cap as Auto Retry
// and Auto Refine.
const CHATS_OFF_CAP = 500;
function cleanChatsOff(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const id = str(x, 200).trim();
    if (id && out.indexOf(id) < 0) out.push(id);
  }
  return out.slice(-CHATS_OFF_CAP);
}

// At most ten notes, each at most 300 characters. A note being written can
// be empty for a moment, so it is kept.
function cleanNotesList(v: any): Settings['videoNotes'] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 10).filter((n: any) => n && typeof n === 'object').map((n: any) => ({
    text: str(n.text, 300),
    when: pick(n.when, ['all', 'start', 'end', 'from'] as const, 'all'),
    from: Math.round(num(n.from, 0, 3600, 0) * 10) / 10,
    secs: Math.round(num(n.secs, 0.5, 600, 4) * 10) / 10,
    place: pick(n.place, ['top', 'bottom'] as const, 'bottom'),
  }));
}

// At most 50 folders, each with a name of at most 60 characters.
function cleanSavedFolders(v: any): Settings['savedFolders'] {
  if (!Array.isArray(v)) return [];
  const out: Settings['savedFolders'] = [];
  for (const f of v.slice(0, 50)) {
    const id = str(f && f.id, 40).replace(/[^a-z0-9_-]/gi, '');
    const name = str(f && f.name, 60).trim();
    if (id && name && !out.some((x) => x.id === id)) out.push({ id, name, open: !(f && f.open === false) });
  }
  return out;
}

// The settings a video look holds: how a video looks, not what it says or
// who it names. Names, pictures and notes stay as they are when a look is
// used.
const LOOK_KEYS = [
  'videoShape', 'videoFont', 'videoSize', 'videoInk', 'videoWords', 'videoPlace', 'videoQuotes', 'videoPicShape', 'videoPicSize',
  'videoNameColor', 'videoBack', 'videoBackColor', 'videoDim', 'videoBlur', 'videoEdges', 'videoEdgeColor', 'videoMove', 'videoMoveSecs',
  'videoTitleOn', 'videoFadeOut', 'videoCaptions',
];
// At most 20 looks, each cleaned the same way the settings are.
function cleanLooks(v: any): Settings['videoLooks'] {
  if (!Array.isArray(v)) return [];
  const out: Settings['videoLooks'] = [];
  for (const l of v.slice(0, 20)) {
    const id = str(l && l.id, 40).replace(/[^a-z0-9_-]/gi, '');
    const name = str(l && l.name, 60).trim();
    if (!id || !name || out.some((x) => x.id === id) || !l.look || typeof l.look !== 'object') continue;
    const clean: any = cleanSettings(Object.assign({}, l.look, { videoLooks: [] }));
    const look: Record<string, any> = {};
    for (const k of LOOK_KEYS) look[k] = clean[k];
    out.push({ id, name, look });
  }
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
  const groups: CastGroup[] = [];
  if (Array.isArray(r.groups)) {
    for (const f of r.groups) {
      const id = str(f && f.id, 64);
      const name = str(f && f.name, 60).trim();
      if (!id || !name || groups.some((x) => x.id === id)) continue;
      groups.push({ id, name, open: bool(f.open, true) });
      if (groups.length >= MAX_GROUPS) break;
    }
  }
  // A person in a group that is gone is in no group.
  for (const c of cast) if (c.group && !groups.some((f) => f.id === c.group)) c.group = '';
  return {
    enabled: bool(r.enabled, d.enabled),
    ttsConnection: str(r.ttsConnection, 80),
    autoplay: bool(r.autoplay, d.autoplay),
    prepareAhead: bool(r.prepareAhead, d.prepareAhead),
    readOwnMessages: bool(r.readOwnMessages, d.readOwnMessages),
    narration: pick(r.narration, ['read', 'sounds', 'skip'] as const, d.narration),
    saveAudio: bool(r.saveAudio, d.saveAudio),
    evenVoices: bool(r.evenVoices, d.evenVoices),
    voiceVolume: num(r.voiceVolume, 0, 1, d.voiceVolume),
    soundVolume: num(r.soundVolume, 0, 1, d.soundVolume),
    reduceMotion: bool(r.reduceMotion, d.reduceMotion),
    directorOn: bool(r.directorOn, d.directorOn),
    directorConnection: str(r.directorConnection, 80),
    backupOn: bool(r.backupOn, d.backupOn),
    backupConnection: str(r.backupConnection, 80),
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
    decisionSure: Math.round(num(r.decisionSure, 10, 95, d.decisionSure)),
    makeSounds: bool(r.makeSounds, d.makeSounds),
    soundFrom: pick(r.soundFrom, ['both', 'freesound', 'eleven'] as const, d.soundFrom),
    freesoundLicense: pick(r.freesoundLicense, ['any', 'free', 'cc0'] as const, d.freesoundLicense),
    musicOn: bool(r.musicOn, d.musicOn),
    musicVolume: num(r.musicVolume, 0, 1, d.musicVolume),
    musicDip: bool(r.musicDip, d.musicDip),
    musicFrom: pick(r.musicFrom, ['library', 'both'] as const, d.musicFrom),
    soundSeconds: num(r.soundSeconds, 0, 30, d.soundSeconds),
    autoplayDelay: num(r.autoplayDelay, 0, 30, d.autoplayDelay),
    extraThinkTags: Array.isArray(r.extraThinkTags) ? r.extraThinkTags.map((x: any) => str(x, 40).trim()).filter(Boolean).slice(0, 20) : [],
    engines: cleanEngineChoices(r.engines),
    engineNotes: cleanEngineNotes(r.engineNotes),
    logShow: cleanLogShow(r.logShow),
    builtInSeen: str(r.builtInSeen, 40).replace(/[^a-z0-9]/g, ''),
    movedSeen: str(r.movedSeen, 2000).replace(/[^a-zA-Z0-9: ]/g, ''),
    promptRole: pick(r.promptRole, ['system', 'user', 'assistant'] as const, 'system'),
    engineNoteRole: pick(r.engineNoteRole, ['rules', 'system', 'user', 'assistant'] as const, 'rules'),
    askNoteRole: pick(r.askNoteRole, ['system', 'user', 'assistant'] as const, 'user'),
    decisionQuestions: cleanQuestions(r.decisionQuestions),
    soundCheck: bool(r.soundCheck, d.soundCheck),
    skipOn: bool(r.skipOn, d.skipOn),
    emojisOn: bool(r.emojisOn, d.emojisOn),
    skipPatterns: str(r.skipPatterns, 8000),
    speechMarks: pick(r.speechMarks, ['auto', 'single'] as const, 'auto'),
    asterisks: pick(r.asterisks, ['narration', 'thought', 'skip'] as const, 'narration'),
    parens: pick(r.parens, ['narration', 'thought', 'skip'] as const, 'narration'),
    // speechRead and speechMarks "plain" are the old names of these choices,
    // read once to move a saved choice to Quoted text and Undecorated text.
    quotedText: pick(r.quotedText !== undefined ? r.quotedText : r.speechRead === 'skip' ? 'skip' : undefined, ['speech', 'narration', 'skip'] as const, 'speech'),
    plainText: pick(r.plainText !== undefined ? r.plainText : r.speechMarks === 'plain' ? 'speech' : undefined, ['narration', 'speech', 'skip'] as const, 'narration'),
    keepAudio: KEEP_AUDIO_CHOICES.indexOf(Number(r.keepAudio)) >= 0 ? Number(r.keepAudio) : d.keepAudio,
    thinkingMode: pick(r.thinkingMode, ['off', 'inherit', 'custom'] as const, 'off'),
    thinkingEffort: pick(r.thinkingEffort, EFFORTS, 'low'),
    samplers: cleanSamplerInput(r.samplers),
    timeoutSecs: Math.round(num(r.timeoutSecs, 0, 3600, d.timeoutSecs)),
    costIn: num(r.costIn, 0, 10000, d.costIn),
    costOut: num(r.costOut, 0, 10000, d.costOut),
    voicePrice: num(r.voicePrice, 0, 10000, d.voicePrice),
    rateWaits: Math.round(num(r.rateWaits, 0, 5, d.rateWaits)),
    askNote: bool(r.askNote, d.askNote),
    askNotes: cleanNotes(r.askNotes),
    applauseOn: bool(r.applauseOn, d.applauseOn),
    applauseForAi: bool(r.applauseForAi, d.applauseForAi),
    applauseForUser: bool(r.applauseForUser, d.applauseForUser),
    applauseWhen: pick(r.applauseWhen, ['message', 'big'] as const, 'message'),
    applauseSound: str(r.applauseSound, 64).replace(/[^a-z0-9_-]/gi, ''),
    applauseSeconds: num(r.applauseSeconds, 1, 15, d.applauseSeconds),
    applauseVolume: num(r.applauseVolume, 0, 1, d.applauseVolume),
    extrasMenu: bool(r.extrasMenu, d.extrasMenu),
    studioSounds: bool(r.studioSounds, d.studioSounds),
    studioGap: Math.round(num(r.studioGap, 0, 3, d.studioGap) * 10) / 10,
    studioAsHeard: bool(r.studioAsHeard, d.studioAsHeard),
    studioLoud: bool(r.studioLoud, d.studioLoud),
    audioSplit: pick(r.audioSplit, ['one', 'parts'] as const, d.audioSplit),
    videoShape: pick(r.videoShape, ['wide', 'tall', 'square'] as const, d.videoShape),
    videoFont: pick(r.videoFont, ['book', 'clean', 'type', 'round', 'theme'] as const, 'book'),
    videoSize: Math.round(num(r.videoSize, 60, 160, d.videoSize)),
    videoInk: hexColor(r.videoInk),
    videoWords: pick(r.videoWords, ['light', 'appear', 'all'] as const, d.videoWords),
    videoPlace: pick(r.videoPlace, ['middle', 'lower'] as const, d.videoPlace),
    videoQuotes: bool(r.videoQuotes, d.videoQuotes),
    videoNames: bool(r.videoNames, d.videoNames),
    videoPics: bool(r.videoPics, d.videoPics),
    videoPicShape: pick(r.videoPicShape, ['circle', 'rounded'] as const, d.videoPicShape),
    videoPicSize: Math.round(num(r.videoPicSize, 60, 300, d.videoPicSize)),
    videoNameColor: pick(r.videoNameColor, ['kind', 'words'] as const, d.videoNameColor),
    videoBack: pick(r.videoBack, ['dark', 'color', 'picture'] as const, d.videoBack),
    videoBackColor: hexColor(r.videoBackColor),
    videoDim: Math.round(num(r.videoDim, 0, 80, d.videoDim)),
    videoBlur: Math.round(num(r.videoBlur, 0, 20, d.videoBlur)),
    videoEdges: Math.round(num(r.videoEdges, 0, 100, d.videoEdges)),
    videoEdgeColor: hexColor(r.videoEdgeColor),
    videoMove: pick(r.videoMove, ['rise', 'fade', 'dissolve', 'black', 'slide', 'wipe', 'focus', 'zoom', 'cut'] as const, 'rise'),
    videoMoveSecs: Math.round(num(r.videoMoveSecs, 0.1, 2, d.videoMoveSecs) * 10) / 10,
    videoTitleOn: bool(r.videoTitleOn, d.videoTitleOn),
    videoTitleText: str(r.videoTitleText, 120).trim(),
    videoFadeOut: Math.round(num(r.videoFadeOut, 0, 5, d.videoFadeOut) * 10) / 10,
    videoCaptions: bool(r.videoCaptions, d.videoCaptions),
    videoNotes: cleanNotesList(r.videoNotes),
    savedFolders: cleanSavedFolders(r.savedFolders),
    savedSort: pick(r.savedSort, ['new', 'old', 'az'] as const, 'new'),
    videoLooks: cleanLooks(r.videoLooks),
    censorOn: bool(r.censorOn, d.censorOn),
    censorWords: str(r.censorWords, 4000),
    censorCover: pick(r.censorCover, ['bar', 'blur', 'pixels'] as const, d.censorCover),
    censorBleep: bool(r.censorBleep, d.censorBleep),
    chatHighlight: bool(r.chatHighlight, d.chatHighlight),
    wordColor: hexColor(r.wordColor),
    colorNarrator: hexColor(r.colorNarrator),
    colorCharacter: hexColor(r.colorCharacter),
    colorPersona: hexColor(r.colorPersona),
    colorNpc: hexColor(r.colorNpc),
    colorSound: hexColor(r.colorSound),
    colorTag: hexColor(r.colorTag),
    wordStrength: Math.round(num(r.wordStrength, 10, 80, d.wordStrength)),
    playerAccent: hexColor(r.playerAccent),
    playerBack: hexColor(r.playerBack),
    playerInk: hexColor(r.playerInk),
    chatterboxUrl: cleanServer(r.chatterboxUrl),
    panelPattern: pick(r.panelPattern, ['', 'diamonds', 'stripes', 'dots', 'hearts', 'stars'] as const, ''),
    boxSolid: Math.round(num(r.boxSolid, 0, 100, d.boxSolid)),
    widgetOn: bool(r.widgetOn, d.widgetOn),
    widgetSize: Math.round(num(r.widgetSize, 28, 96, d.widgetSize)),
    pauseKeyOn: bool(r.pauseKeyOn, d.pauseKeyOn),
    // Keys joined with + and ending in one key, such as Ctrl+Shift+K. Anything
    // else is put back to the default.
    pauseKey: /^(?=.*(?:Ctrl|Alt|Cmd)\+)(Ctrl\+)?(Alt\+)?(Shift\+)?(Cmd\+)?[A-Za-z0-9]+$/.test(String(r.pauseKey || '')) ? String(r.pauseKey).slice(0, 40) : d.pauseKey,
    retryDirector: Math.round(num(r.retryDirector, 0, 3, d.retryDirector)),
    messageButton: bool(r.messageButton, d.messageButton),
    barButton: bool(r.barButton, d.barButton),
    messagePlayer: bool(r.messagePlayer, d.messagePlayer),
    guideSeen: bool(r.guideSeen, d.guideSeen),
    exportParts: partList(r.exportParts, TRANSFER_PARTS, d.exportParts),
    importParts: partList(r.importParts, TRANSFER_PARTS, d.importParts),
    resetParts: partList(r.resetParts, RESET_PARTS, d.resetParts),
    chatsOff: cleanChatsOff(r.chatsOff),
    cast: cast,
    groups: groups,
    // castSorted is the name 1.5.0 saved this under: false was a cast moved
    // by hand. It is read once, to move it to castSort.
    castSort: pick(r.castSort, ['kind', 'az', 'za', 'voice', 'own'] as const, r.castSorted === false ? 'own' : d.castSort),
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
  // Which paragraph of the message it is in, from 0.
  para?: number;
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
const boundCache: Record<string, { at: number; pairs: ThinkPair[]; models: Record<string, string> }> = {};
const BOUND_EVERY_MS = 60000;

async function boundPairs(userId: string | undefined): Promise<ThinkPair[]> {
  const key = userId || '';
  const kept = boundCache[key];
  if (kept && Date.now() - kept.at < BOUND_EVERY_MS) return kept.pairs;
  const pairs: ThinkPair[] = [];
  // The model behind each connection, for Lumiverse's tokenizer. '' is the
  // default connection.
  const models: Record<string, string> = {};
  try {
    const list: any = await inTime(Promise.resolve(spindle.connections.list(userId)), 15000, 'Lumiverse, listing the connections,');
    for (const c of Array.isArray(list) ? list : []) {
      if (!c || !c.id) continue;
      models[String(c.id)] = String(c.model || '');
      if (c.is_default) models[''] = String(c.model || '');
    }
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
  boundCache[key] = { at: Date.now(), pairs, models };
  return pairs;
}

// The model a connection runs, read with the reasoning pairs. Empty when it
// cannot be read, and Lumiverse then counts for the main connection's model.
async function modelOfConnection(userId: string | undefined, id: string): Promise<string> {
  await boundPairs(userId);
  const kept = boundCache[userId || ''];
  return (kept && kept.models[id]) || '';
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
// left in, a voice engine reads them as voice tags.
function cleanForVoice(raw: string, extra?: string[], bound?: ThinkPair[], skips?: RegExp[]): string {
  let t = String(raw == null ? '' : raw);
  t = stripThinking(t, extra, bound);
  // The reader's patterns run on the text as written, before HTML is taken
  // out, so a pattern can match a whole block such as <details>.
  if (skips && skips.length) t = leaveOut(t, skips);
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  // A style or script block is never read, even one that is never closed,
  // since its text is code: colors, gradients and the like.
  t = t.replace(/<(style|script)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ');
  // An HTML tag of any length, by its shape: a name, then attributes whose
  // quoted values may hold any character, > included. A long style, such as
  // a gradient on colored text, goes with the tag.
  t = t.replace(/<\/?[a-zA-Z][\w:-]*(?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g, ' ');
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
// Emojis, with the marks that build them: skin tones, the joiner, the
// emoji style mark, keycaps and the letters of a flag. A voice service may
// read one out by its name, so they are left out unless Send emojis to the
// voice is on. Music notes are read first, to mark a line as sung.
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u200D\uFE0F\u20E3]/gu;

// Splits a message into lines in the order they are read. Text in straight
// or curly double quotes is speech. Everything else is narration, including
// *asterisk actions*. A paragraph break ends a narration line.
// ---- Text that is not meant to be heard ----
// Built-in patterns for trackers, status blocks and other parts of a message
// that are read with the eyes. Each is one line of the box in the Settings
// tab, where they can be changed.
const BUILT_IN_SKIPS = [
  // A table, one row per line, such as | HP | 30/40 |
  '^[ \\t]*\\|.*\\|[ \\t]*$',
  // A folded block, such as <details><summary>Stats</summary>...</details>
  '<details\\b[\\s\\S]*?</details>',
  // A status line: a short label, a colon, and a value with a number in it,
  // such as "Time: 9:40 PM" or "Health: 3 of 5", with no quote marks.
  '^[ \\t]*[-*•]?[ \\t]*[\\p{L}][\\p{L} ]{0,24}:[ \\t]*[^"“”«»\\n]*\\d[^"“”«»\\n]*$',
  // A line that starts with an emoji, such as a location or mood marker.
  '^[ \\t]*\\p{Extended_Pictographic}.*$',
  // Text in lenticular brackets, such as 【Day 2】
  '【[^】\\n]*】',
  // A line that is only a block of data in braces or square brackets.
  '^[ \\t]*[{\\[].*[}\\]][ \\t]*$',
  // A bar drawn with block characters, such as ▓▓▓░░
  '^.*[█▓▒░■□]{3,}.*$',
].join('\n');

// One line of a pattern box as a pattern. The same reader as Auto Refine's:
// written as /pattern/flags it takes those flags, plus g. A leading (?i),
// (?m) or (?s) is read as that flag. u is added where the pattern allows it.
function readPattern(src: string, flags: string): RegExp {
  let body = src;
  let use = flags;
  const slash = /^\/([\s\S]+)\/([a-z]*)$/.exec(src);
  if (slash) {
    if (!/^[dgimsuy]*$/.test(slash[2])) throw new Error('unknown flag in /' + slash[2]);
    body = slash[1];
    use = slash[2].indexOf('g') < 0 ? slash[2] + 'g' : slash[2];
  }
  const inline = /^\(\?([a-z]+)\)/.exec(body);
  if (inline) {
    if (!/^[ims]+$/.test(inline[1])) throw new Error('(?' + inline[1] + ') is not a flag this can read');
    body = body.slice(inline[0].length);
    for (const f of inline[1]) if (use.indexOf(f) < 0) use += f;
  }
  if (use.indexOf('u') < 0) {
    try {
      return new RegExp(body, use + 'u');
    } catch (_) {}
  }
  return new RegExp(body, use);
}

// Whether a pattern repeats a group that repeats something inside it, such as
// (a+)+. On text that almost matches, that shape tries every way of splitting
// the text, and stops the backend for every account while it does. It is
// refused when it is read.
function repeatsARepeat(src: string): boolean {
  const repeatAt = (i: number): boolean => {
    const c = src[i];
    if (c === '+' || c === '*') return true;
    if (c !== '{') return false;
    const close = src.indexOf('}', i);
    return close > i && src.slice(i, close).indexOf(',') >= 0;
  };
  const open: boolean[] = [];
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === '(') open.push(false);
    else if (c === ')') {
      const inner = open.pop();
      if (inner && repeatAt(i + 1)) return true;
      if (inner && open.length) open[open.length - 1] = true;
    } else if (repeatAt(i) && open.length && src[i - 1] !== '(') open[open.length - 1] = true;
  }
  return false;
}

const SKIP_MAX = 40;
// The patterns in a box, and the lines that could not be used, with why.
function makePatterns(raw: string): { list: RegExp[]; bad: string[] } {
  const list: RegExp[] = [];
  const bad: string[] = [];
  for (const line of String(raw == null ? '' : raw).split(/\n/)) {
    const src = line.trim();
    if (!src) continue;
    if (list.length >= SKIP_MAX) break;
    if (src.length > 400) {
      bad.push(src.slice(0, 40) + ' (too long)');
      continue;
    }
    if (repeatsARepeat(src)) {
      bad.push(src.slice(0, 40) + ' (a repeat inside a repeat, which can stop Auto Foley for a second on each message)');
      continue;
    }
    let re: RegExp;
    try {
      re = readPattern(src, 'gim');
    } catch (e: any) {
      bad.push(src.slice(0, 40) + ' (' + ((e && e.message) || 'not a pattern') + ')');
      continue;
    }
    re.lastIndex = 0;
    const hit = re.exec('');
    if (hit && hit[0] === '') {
      bad.push(src.slice(0, 40) + ' (matches nothing, so it would match everywhere)');
      continue;
    }
    re.lastIndex = 0;
    list.push(re);
  }
  return { list, bad };
}

const skipCache: Record<string, { list: RegExp[]; bad: string[] }> = {};
function skipsFor(raw: string): { list: RegExp[]; bad: string[] } {
  const key = raw || BUILT_IN_SKIPS;
  if (!skipCache[key]) skipCache[key] = makePatterns(key);
  return skipCache[key];
}

function leaveOut(text: string, patterns: RegExp[]): string {
  let t = text;
  for (const re of patterns) {
    re.lastIndex = 0;
    t = t.replace(re, ' ');
  }
  return t;
}

// ---- Where speech starts and ends ----
// Each opening mark, and the marks that close it. Auto reads double quotes,
// curly quotes, guillemets, low quotes and corner brackets.
const OPENERS: Record<string, string> = {
  '"': '"',
  '“': '”"',
  '«': '»',
  '»': '«',
  '„': '“”',
  '「': '」',
  '『': '』',
};
const SINGLE_OPENERS: Record<string, string> = { "'": "'", '‘': '’' };
// A dash at the start of a line opens speech in some languages' style:
//   (dash) Come here, (dash) she said.
const DASHES = '\u2014\u2015';
const LETTER = /[\p{L}\p{N}]/u;

interface SplitOptions {
  extra?: string[];
  bound?: ThinkPair[];
  skips?: RegExp[];
  // Which quote marks open speech: 'auto' or 'single'. The old 'plain'
  // means Undecorated text is speech.
  marks?: string;
  // Text between *asterisks*: 'narration', 'thought' or 'skip'.
  asterisks?: string;
  // Text in (parentheses): 'narration', 'thought' or 'skip'.
  parens?: string;
  // Text in quote marks: 'speech', 'narration' or 'skip'.
  quoted?: string;
  // Text with no marks around it: 'narration', 'speech' or 'skip'.
  plain?: string;
  // Keep emojis in the text sent to the voice.
  emojis?: boolean;
}

// The marks that stand for *asterisks* while a message is split. They are
// characters no story uses, so they cannot be taken for anything else.
const STAR_OPEN = '\uE000';
const STAR_CLOSE = '\uE001';
const PAREN_OPEN = '\uE002';
const PAREN_CLOSE = '\uE003';

// Splits a message into lines in the order they are read. The text is first
// sorted into four kinds: text in quote marks (or after a dash at the start
// of a line), text between *asterisks*, text in (parentheses), and
// undecorated text. ((Double parentheses)) are already gone by then. Each kind is
// then read as speech, narration or thoughts, or left out, as the settings
// say. Thoughts are read in the speaker's own voice, so they are speech
// lines. A paragraph break ends a narration line. Asterisks and
// parentheses inside quote marks stay part of what is said.
function splitSegments(raw: string, extra?: string[] | SplitOptions, bound?: ThinkPair[]): Segment[] {
  const o: SplitOptions = Array.isArray(extra) || extra === undefined ? { extra: extra as string[] | undefined, bound } : extra;
  let t = cleanForVoice(raw, o.extra, o.bound, o.skips);
  // A span stays on one line, so a stray asterisk cannot take a whole reply.
  t = t.replace(/\*([^*\n]{1,600})\*/g, STAR_OPEN + '$1' + STAR_CLOSE);
  t = t.replace(/\(([^()\n]{1,600})\)/g, PAREN_OPEN + '$1' + PAREN_CLOSE);
  const marks = o.marks === 'single' ? 'single' : 'auto';
  type Found = 'quoted' | 'plain' | 'asterisked' | 'parens';
  const found: { kind: Found; text: string; para: number }[] = [];
  let buf = '';
  let para = 0;
  const flush = (kind: Found) => {
    const text = buf.replace(/[*\uE000-\uE003]/g, ' ').replace(/[ \t]+/g, ' ').trim();
    buf = '';
    if (!text) return;
    if (/[\p{L}\p{N}]/u.test(text)) found.push({ kind, text, para });
    // Punctuation left after a span, such as the period in "She waited
    // (for hours).", stays with the text before it.
    else if (kind === 'plain' && found.length && found[found.length - 1].para === para) found[found.length - 1].text += text;
  };
  {
    let inStar = false;
    let inParen = false;
    const openers: Record<string, string> = marks === 'single' ? Object.assign({}, OPENERS, SINGLE_OPENERS) : OPENERS;
    let closers = '';
    let dashLine = false;
    for (let k = 0; k < t.length; k++) {
      const ch = t[k];
      const prev = k > 0 ? t[k - 1] : '';
      const next = k + 1 < t.length ? t[k + 1] : '';
      const lineStart = k === 0 || prev === '\n';
      // Asterisks outside quote marks start and end their own kind of text.
      // Inside quote marks or a dash line they are left in what is said.
      if (ch === STAR_OPEN || ch === STAR_CLOSE) {
        if (closers || dashLine || inParen) continue;
        if (ch === STAR_OPEN && !inStar) {
          flush('plain');
          inStar = true;
        } else if (ch === STAR_CLOSE && inStar) {
          flush('asterisked');
          inStar = false;
        }
        continue;
      }
      // Parentheses work the same way, as their own kind of text.
      if (ch === PAREN_OPEN || ch === PAREN_CLOSE) {
        if (closers || dashLine || inStar) continue;
        if (ch === PAREN_OPEN && !inParen) {
          flush('plain');
          inParen = true;
        } else if (ch === PAREN_CLOSE && inParen) {
          flush('parens');
          inParen = false;
        }
        continue;
      }
      if (inStar || inParen) {
        buf += ch;
        continue;
      }
      if (!closers && !dashLine) {
        if (lineStart && DASHES.indexOf(ch) >= 0) {
          flush('plain');
          dashLine = true;
          continue;
        }
        if (openers[ch] !== undefined) {
          // A single quote opens only where a word does not go on before it,
          // so the apostrophe in "don't" opens nothing.
          if ((ch === "'" || ch === '‘') && LETTER.test(prev)) {
            buf += ch;
            continue;
          }
          // » opens only in the reversed style, and « is more common.
          if (ch === '»' && !/[«]/.test(t.slice(k + 1, k + 400))) {
            buf += ch;
            continue;
          }
          flush('plain');
          closers = openers[ch];
          continue;
        }
      } else if (closers) {
        if (closers.indexOf(ch) >= 0) {
          if ((ch === "'" || ch === '’') && LETTER.test(next)) {
            buf += ch;
            continue;
          }
          flush('quoted');
          closers = '';
          continue;
        }
      } else if (dashLine) {
        // A dash with a space before it ends what is said, and the narration
        // after it runs to the next dash or the end of the line.
        if (DASHES.indexOf(ch) >= 0 && /\s/.test(prev)) {
          flush('quoted');
          dashLine = false;
          let end = k + 1;
          while (end < t.length && t[end] !== '\n' && DASHES.indexOf(t[end]) < 0) end++;
          buf = t.slice(k + 1, end);
          flush('plain');
          if (end < t.length && DASHES.indexOf(t[end]) >= 0) dashLine = true;
          k = end;
          continue;
        }
        if (ch === '\n') {
          flush('quoted');
          dashLine = false;
          continue;
        }
      }
      if (!closers && !dashLine && ch === '\n' && next === '\n') {
        flush('plain');
        para++;
        continue;
      }
      buf += ch === '\n' ? ' ' : ch;
    }
    flush(closers || dashLine ? 'quoted' : 'plain');
  }
  // Each kind of text, read as the settings say. The old marks 'plain'
  // means Undecorated text is speech.
  const doWith: Record<Found, string> = {
    quoted: o.quoted || 'speech',
    plain: o.plain || (o.marks === 'plain' ? 'speech' : 'narration'),
    asterisked: o.asterisks || 'narration',
    parens: o.parens || 'narration',
  };
  const parts: { kind: SegKind; text: string; para: number }[] = [];
  for (const x of found) {
    const how = doWith[x.kind];
    if (how === 'skip') continue;
    const kind: SegKind = how === 'narration' ? 'narration' : 'speech';
    const last = parts[parts.length - 1];
    // Narration next to narration in the same paragraph is one line, so
    // *she shrugs* read as narration joins the sentence beside it.
    if (kind === 'narration' && last && last.kind === 'narration' && last.para === x.para) last.text += ' ' + x.text;
    else parts.push({ kind, text: x.text, para: x.para });
  }
  const segs: Segment[] = [];
  for (const p of parts) {
    // A music note marks a line as sung. The note itself is not read.
    const sung = MUSIC_NOTE.test(p.text);
    const bare = p.text.replace(MUSIC_NOTES, ' ');
    const text = (o.emojis ? bare : bare.replace(EMOJI, ' ')).replace(/[ \t]+/g, ' ').replace(/ ([.,!?;:])/g, '$1').trim();
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    for (const piece of splitLong(text)) {
      const seg: Segment = { i: segs.length, kind: p.kind, text: piece, para: p.para };
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

// Tags that describe something seen, not heard. No voice engine can voice
// them, and some read them out.
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
const ENGINE_IDS = ['eleven_v3', 'fish', 'gemini', 'chatterbox_turbo', 'omnivoice', 'cartesia'];

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
    list: tags === 'list' && Array.isArray(e.list) ? e.list.map((x: any) => str(x, 30).toLowerCase()).filter((x: string) => /^[a-z][a-z -]*$/.test(x)).slice(0, 80) : [],
    style: e.style === true,
    inVoiceSounds: e.inVoiceSounds === true || (!v && true),
    sing: e.sing === true || (!v && true),
  };
}

// The note sent with each engine, saying how it reads tags. Shown in the
// Director tab, where it can be changed, with a way back to this text.
const ENGINE_NOTES: Record<string, string> = {
  eleven_v3:
    'ElevenLabs v3 and v4 act out any short tag in square brackets. A tag shapes the words right after it, so it goes just before them. It can also perform a [sound of ...] tag inside the line.',
  fish:
    'Fish Audio acts out free tags in square brackets, like [barely holding it together] or [whispering]. Put a tag at the start of the sentence it shapes. Each sentence of a line is read with the last feeling tagged before it, so when a whisper ends, mark where the voice comes back up with a new tag. One feeling per sentence works best, and never two that pull against each other. Fish makes almost none of the sounds of the world, so sounds go in "before" and "after".',
  gemini:
    'Gemini 3.8 knows only the tags in "tag_list", and they\'re all sounds a voice makes or pauses. Use them as written, in square brackets, right where the sound happens, even mid-sentence. How a line is said goes in its "style": a few plain words like "hushed and nervous" or "fast, out of breath". Most lines need no style at all, since Gemini reads the punctuation and the words around them. Leave age, accent and who they are out of it, since the voice already carries those.',
  chatterbox_turbo:
    'Chatterbox knows only the nine tags in "tag_list", and they\'re all sounds a voice makes. Use them as written, in square brackets, and rarely: one in a line at most, and most lines get none. It can\'t take a delivery tag like [quietly], so the punctuation carries the delivery.',
  omnivoice:
    'OmniVoice knows only the tags in "tag_list", and they\'re all small sounds a voice makes: a laugh, a sigh, a questioning hum, an agreeing one, a surprised gasp, an unhappy grunt. Use them as written, in square brackets, right where the sound happens. Keep them rare, one in a line at most. It can\'t take a delivery tag like [quietly], so the words and the punctuation carry the rest.',
  cartesia:
    'Cartesia reads one feeling for a whole line, and [laughter] where someone laughs. The feelings are the other words in "tag_list". When a line needs one, put it in square brackets at the very start, like [anxious] or [sarcastic], and only one per line. Six come out the most reliably: neutral, calm, angry, content, sad and scared. Only pick a feeling the words already carry, since Cartesia doesn\'t act one that fights them. Most lines need none, since Cartesia hears the feeling in the words.',
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
  sarcastic: 'sarcasm', sarcastically: 'sarcasm',
  robotically: 'robotic',
  um: 'uhm', umm: 'uhm', uh: 'uhm', uhh: 'uhm', hesitates: 'uhm', hesitating: 'uhm', hesitantly: 'uhm',
  rapidly: 'fast',
  // OmniVoice's own sounds: a questioning hum and an agreeing one.
  hmm: 'question-en', huh: 'question-en', questioning: 'question-en', mhm: 'confirmation-en', 'uh-huh': 'confirmation-en',
};
const TAG_KNOWN = new Set([
  'argh', 'breath', 'heavy breath', 'exhales', 'cackle', 'cheer', 'chuckle', 'cough', 'cry', 'gasp', 'giggle', 'groan', 'growl',
  'grunt', 'hiss', 'laugh', 'moan', 'pant', 'phew', 'scream', 'shout', 'shriek', 'sigh', 'sneeze', 'snicker', 'snort', 'sob',
  'throat-clearing', 'tsk', 'whimper', 'whispers', 'yawn', 'short pause', 'medium pause', 'long pause', 'clear throat', 'shush', 'sniff',
  'uhm', 'sarcasm', 'robotic', 'fast',
  'question-en', 'question-ah', 'question-oh', 'confirmation-en', 'surprise-ah', 'surprise-oh', 'dissatisfaction-hnn',
]);
function tagSound(tag: string): string {
  const t = String(tag || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/\b(clears?|clearing)\b.*\bthroat\b|\bthroat[- ]clear/.test(t)) return 'throat';
  if (/\blong pause\b/.test(t)) return 'long pause';
  if (/\bmedium pause\b/.test(t)) return 'medium pause';
  if (/\b(short pause|pause|beat)\b/.test(t)) return 'short pause';
  if (/\bheavy breath/.test(t)) return 'heavy breath';
  for (const w of t.split(' ')) {
    const c = TAG_WORDS[w] || w;
    if (TAG_KNOWN.has(c)) return c;
  }
  return '';
}
// The 58 emotions Cartesia's Sonic 3 takes for a whole line, from its own
// docs. A tag that names one, such as [angrily], is fitted to it.
const CARTESIA_EMOTIONS = [
  'neutral', 'happy', 'excited', 'enthusiastic', 'elated', 'euphoric', 'triumphant', 'amazed', 'surprised', 'flirtatious',
  'curious', 'content', 'peaceful', 'serene', 'calm', 'grateful', 'affectionate', 'trust', 'sympathetic', 'anticipation',
  'mysterious', 'angry', 'mad', 'outraged', 'frustrated', 'agitated', 'threatened', 'disgusted', 'contempt', 'envious',
  'sarcastic', 'ironic', 'sad', 'dejected', 'melancholic', 'disappointed', 'hurt', 'guilty', 'bored', 'tired',
  'rejected', 'nostalgic', 'wistful', 'apologetic', 'hesitant', 'insecure', 'confused', 'resigned', 'anxious', 'panicked',
  'alarmed', 'scared', 'proud', 'confident', 'distant', 'skeptical', 'contemplative', 'determined',
];
const EMOTION_WORDS: Record<string, string> = {
  angrily: 'angry', furious: 'outraged', furiously: 'outraged', annoyed: 'frustrated', irritated: 'agitated',
  irritably: 'agitated', sadly: 'sad', sorrowful: 'sad', mournful: 'melancholic', happily: 'happy',
  cheerful: 'happy', cheerfully: 'happy', joyful: 'elated', excitedly: 'excited', nervous: 'anxious',
  nervously: 'anxious', worried: 'anxious', afraid: 'scared', fearful: 'scared', fearfully: 'scared',
  frightened: 'scared', terrified: 'panicked', panicking: 'panicked', calmly: 'calm',
  sarcastically: 'sarcastic', curiously: 'curious', puzzled: 'confused', wearily: 'tired', weary: 'tired',
  exhausted: 'tired', sleepy: 'tired', hesitantly: 'hesitant', apologetically: 'apologetic',
  proudly: 'proud', confidently: 'confident', flirty: 'flirtatious', flirtatiously: 'flirtatious',
  teasing: 'flirtatious', teasingly: 'flirtatious', warmly: 'affectionate', tenderly: 'affectionate',
  lovingly: 'affectionate', coldly: 'distant', shocked: 'surprised', startled: 'surprised',
  disgustedly: 'disgusted', jealous: 'envious', jealously: 'envious', thoughtful: 'contemplative',
  thoughtfully: 'contemplative', wistfully: 'wistful', nostalgically: 'nostalgic', skeptically: 'skeptical',
  doubtful: 'skeptical', mysteriously: 'mysterious', determinedly: 'determined', resolute: 'determined',
  gratefully: 'grateful', sympathetically: 'sympathetic', guiltily: 'guilty', dejectedly: 'dejected',
  bitterly: 'frustrated', smugly: 'proud', dryly: 'ironic', wryly: 'ironic',
};
// The Cartesia emotion a tag names, or empty.
function emotionOf(tag: string): string {
  for (const w of String(tag || '').toLowerCase().split(/[^a-z]+/)) {
    const e = EMOTION_WORDS[w] || w;
    if (CARTESIA_EMOTIONS.indexOf(e) >= 0) return e;
  }
  return '';
}
// A tag an engine has no spelling of can still fit one close to it: on
// OmniVoice, a gasp is its surprised sound and a tsk its unhappy one.
const TAG_ALT: Record<string, string> = { gasp: 'surprise-ah', tsk: 'dissatisfaction-hnn' };
// The engine's own spelling of a tag, such as laughing for [laughs] on an
// engine that lists laughing. Empty when the engine has none for it.
function fitTag(tag: string, list: string[]): string {
  const c = tagSound(tag);
  if (c) {
    for (const x of list) if (tagSound(x) === c) return x;
    const alt = TAG_ALT[c];
    if (alt) for (const x of list) if (x === alt) return x;
  }
  // On Cartesia, whose list holds its emotions, a tag that names one.
  const e = emotionOf(tag);
  if (e && list.indexOf(e) >= 0) return e;
  return '';
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
"cast": everyone who might speak, each with a "note" on how they talk. "kind" is "narrator", "character", "persona" (someone the user plays) or "npc" (a minor part). "also_called" lists other names the story uses for them.
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
When "big_moments" is true in the rules, set "big": true on a line that's a real peak: a scream, or the confession that cracks somebody open. It lets the voice swing wider. A scene has one, maybe two. Most have none.
</big_moments>

<singing>
Set "sung": true on a line someone actually sings, like song lyrics or a lullaby. Only mark it when the words are sung. A character who mentions a song, or teases in a sing-song voice, is still talking. Don't add a tag that says they sing, because "sung" handles that, and a voice that can't sing will just speak the line. Humming with no words is a sound a voice makes, so it's a tag like [hums].
</singing>

<music>
When "music" is true in the rules, music plays quietly under the scene, and you pick its mood from "moods". Give the first line a "mood" that fits how the scene feels when it opens. After that, set "mood" only on a line where the feeling really turns and stays turned, like a joke that sours into a threat or a chase that finally ends. Everywhere else leave it as "", and the music carries on. Music that flips every other line is worse than music that holds, so let the small wobbles go.
</music>

<new_speakers>
When "find_speakers" is true and someone speaks who isn't in the cast, use the name the text gives them, or a short plain one if it gives none, like "Bartender". List them in "new_speakers" with "gender" (female, male, nonbinary or unknown), "role" (main or minor) and "about": a few words on how they sound, like "gravelly older man" or "bright, quick young woman". Use nonbinary only when the text says it, like "they" for one person or the word itself, and unknown when you can't tell. A main role is someone the story follows, and a minor one is a bartender or a passerby. Anyone in a sex scene is an adult.
</new_speakers>

<clean_run>
A scene that already sounds right with no tags goes back with no tags, and that's a perfect job. Follow "max_tags" in the rules for each line. One tag in the right place beats three anywhere else.
</clean_run>

<your_answer>
Send back one JSON object and nothing else: no words before or after it, and no code fence.
Every line comes back, in order, with the same "i" it came with.
"text" is the whole line: every word of it, exactly as written, with your tags added. Never just the tags.
"speaker" is a name from the cast, a name from "new_speakers", or "Narrator".
Leave "before" and "after" as "" when there's no sound, and "big" as false unless it's a real peak and "big_moments" is on.
Leave "style" as "" and "sung" as false unless the line needs them, and "mood" as "" unless "music" is on and the mood starts or turns there.
Leave "new_speakers" as [] when nobody new speaks.

{"lines":[{"i":0,"speaker":"Narrator","text":"...","style":"","before":"","after":"","big":false,"sung":false,"mood":""}],"new_speakers":[]}
</your_answer>`;

interface DirectedLine {
  i: number;
  kind: SegKind;
  speaker: string;
  // What is sent to the voice engine, tags included.
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
  // The mood of the scene's music from this line on, when it changes here.
  mood?: string;
}

interface Script {
  key: string;
  // The engine it was directed for. Scripts kept by an older version have none.
  engine?: string;
  // Set on a script played from what was kept, never stored.
  fromKept?: boolean;
  // Read as written because the Director could not direct it.
  fallback?: boolean;
  // When it was saved, and the chat it is from, for Saved audio. Scripts
  // kept by an older version have neither.
  keptAt?: number;
  chatId?: string;
  messageId: string;
  author: string;
  lines: DirectedLine[];
  log: string[];
  // What the Decision model answered, line by line, for its own kind in the
  // Log.
  decided?: string[];
  directed: boolean;
  added: string[];
  // Who the message names or hears speak, for the Stage tab.
  inScene: string[];
  // Whether the message is one of the reader's own, for the audience.
  isUser: boolean;
  model: string;
  cost: number;
  // Tokens sent to the Director and written back, over every ask for this
  // message. counted is false when any of them is a guess from the length.
  sent: number;
  back: number;
  counted: boolean;
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
  rules: TagRules & { sounds: boolean; effects: boolean; narrationRead: boolean; findSpeakers: boolean; bigMoments: boolean; lineStyle?: boolean; music?: boolean },
): { lines: DirectedLine[]; newSpeakers: { name: string; gender: string; about: string; role: string }[]; log: string[] } {
  const log: string[] = [];
  const byIndex: Record<number, any> = {};
  const got = answer && Array.isArray(answer.lines) ? answer.lines : [];
  for (const l of got) {
    const i = Number(l && l.i);
    if (Number.isInteger(i) && i >= 0 && i < segs.length && !byIndex[i]) byIndex[i] = l;
  }
  const newSpeakers: { name: string; gender: string; about: string; role: string }[] = [];
  if (rules.findSpeakers && answer && Array.isArray(answer.new_speakers)) {
    for (const s of answer.new_speakers.slice(0, 6)) {
      const name = str(s && s.name, 60).replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
      if (!name || name.toLowerCase() === 'narrator' || findMember(cast, name)) continue;
      if (newSpeakers.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
      newSpeakers.push({
        name,
        gender: pick(String(s.gender || '').toLowerCase(), ['female', 'male', 'nonbinary', 'unknown'] as const, 'unknown'),
        about: str(s.about, 120).trim(),
        role: String(s.role || '').toLowerCase() === 'main' ? 'main' : 'minor',
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
    if (rules.music) {
      const mood = String(d.mood || '').trim().toLowerCase();
      if (MUSIC_MOODS.indexOf(mood) >= 0) line.mood = mood;
    }
    return line;
  });
  if (changed) log.push(changed + (changed === 1 ? ' line was' : ' lines were') + ' read as written, because the Director changed the words.');
  if (missing) log.push(missing + (missing === 1 ? ' line was' : ' lines were') + ' left out by the Director and read as written.');
  return { lines, newSpeakers, log };
}

// ---- Sounds that make sense where they are ----
// A sound is kept when the text around it shows it: a word of the sound's
// description, or a word that starts the same way, is in the line or the line
// on either side. "a door slamming upstairs" is kept beside "slammed the
// door", and a sound the text gives no sign of is left out. A line the
// Decision model said describes a sound keeps its sound too.
const SOUND_FILLER = new Set(
  ('sound sounds noise noises someone something somebody distant nearby close softly loudly gently quietly heavy light small large ' +
    'slow fast quick sharp dull faint loud soft wooden metal glass stone with from into onto against over under across through ' +
    'the and some their his her its them they that this there back down away around').split(' '),
);
function soundWords(text: string): string[] {
  return (String(text || '').toLowerCase().match(/\p{L}{4,}/gu) || []).filter((w) => !SOUND_FILLER.has(w));
}
function shown(desc: string, around: string): boolean {
  const want = soundWords(desc);
  if (!want.length) return true;
  const have = soundWords(around);
  // Two words match when they are the same, when one starts with the other
  // (door, doors), or when they share their first five letters (slamming,
  // slammed).
  const near = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a) || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
  return want.some((w) => have.some((h) => near(w, h)));
}

function checkSounds(lines: DirectedLine[], segs: Segment[], hints: Record<number, number>, line: number): number {
  let dropped = 0;
  for (const l of lines) {
    const around = [segs[l.i - 1], segs[l.i], segs[l.i + 1]].filter(Boolean).map((g) => g.text).join(' ');
    const sure = (hints[l.i] || 0) >= line;
    for (const side of ['before', 'after'] as const) {
      if (l[side] && !sure && !shown(l[side], around)) {
        l[side] = '';
        dropped++;
      }
    }
    if (l.inSounds.length && !sure) {
      const keep = l.inSounds.filter((x) => shown(x.replace(/^sounds? of\s+/i, ''), around));
      if (keep.length !== l.inSounds.length) {
        for (const x of l.inSounds) if (keep.indexOf(x) < 0) l.text = l.text.split('[' + x + ']').join(' ').replace(/[ \t]+/g, ' ').replace(/\s+([,.!?…;:])/g, '$1').trim();
        dropped += l.inSounds.length - keep.length;
        l.inSounds = keep;
      }
    }
  }
  return dropped;
}

// What went wrong with a call to the Director, in plain words.
// Lumiverse installs an extension as Personal, for the account that installed
// it, or as Operator, for every account. A Personal one is refused for every
// other account, with this message. Auto Retry and Auto Refine say the same.
const PERSONAL_INSTALL = /user-scoped|cannot access this user context|Extension owner is not set/i;
const PERSONAL_WORDS =
  'Auto Foley is installed as Personal, so Lumiverse lets only the account that installed it use it. Ask whoever runs Lumiverse to install it as Operator, under Extensions, so every account can use it';

// A phrase that follows "could not be asked:", turned into a sentence of its
// own for a place that shows it alone.
function sentence(t: string): string {
  const s = String(t || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.');
}

function generationTrouble(e: any): string {
  const raw = String((e && e.message) || e || '').slice(0, 300);
  if (PERSONAL_INSTALL.test(raw)) return PERSONAL_WORDS;
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

// A script being written, for each account, so Stop can end it. Stop
// cancels the Director's call in Lumiverse and asks nothing more.
interface DirectRun {
  stopped: boolean;
  ctl: any;
}
const directRuns: Record<string, Set<DirectRun>> = {};
function stopDirecting(uid: string): number {
  const runs = directRuns[uid];
  if (!runs) return 0;
  for (const run of runs) {
    run.stopped = true;
    try {
      if (run.ctl) run.ctl.abort();
    } catch (_) {}
  }
  return runs.size;
}

// Asks the Director, and gives up after Give up waiting after. 0 waits for as
// long as the model takes. The abort reaches Lumiverse, which stops the call.
async function withTimeout(req: any, secs: number, run?: DirectRun): Promise<any> {
  const AC = (globalThis as any).AbortController;
  if ((!secs && !run) || typeof AC !== 'function') return await spindle.generate.quiet(req);
  const ctl = new AC();
  req.signal = ctl.signal;
  if (run) run.ctl = ctl;
  const timer = secs
    ? setTimeout(() => {
        try {
          ctl.abort();
        } catch (_) {}
      }, secs * 1000)
    : 0;
  try {
    return await spindle.generate.quiet(req);
  } catch (e: any) {
    if (run && run.stopped) throw new Error('Stopped');
    if (ctl.signal.aborted) throw new Error('The Director timed out after ' + secs + ' seconds');
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
    if (run) run.ctl = null;
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
  if (PERSONAL_INSTALL.test(raw)) return PERSONAL_WORDS;
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
// A line's first words, so the Log can say which line an answer is for.
function lineStart(text: string): string {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
  return words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '');
}

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
): Promise<{ speakers: Record<number, string>; hints: Record<number, number>; log: string[]; decided: string[]; cost: number }> {
  const out = { speakers: {} as Record<number, string>, hints: {} as Record<number, number>, log: [] as string[], decided: [] as string[], cost: 0 };
  const sure = s.decisionSure / 100;
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
        instructions: question(s, 'who', g.i),
        criteria: criteria,
      };
    }
  }
  if (s.soundsOn && s.directorOn) {
    for (const g of segs.filter((x) => x.kind === 'narration').slice(0, 40)) {
      questions['sound_' + g.i] = {
        type: 'noul',
        instructions: question(s, 'sound', g.i),
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
  const name = who(got.model);
  const textOf = (i: number) => lineStart((segs.find((g) => g.i === i) || { text: '' }).text);
  const pct = (x: number) => Math.round(x * 100) + '%';
  // Lines in the order of the message, so the Log reads top to bottom.
  const keys = Object.keys(got.answers).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  for (const key of keys) {
    const a = got.answers[key];
    if (!a) continue;
    if (key.indexOf('who_') === 0) {
      const i = Number(key.slice(4));
      const choice = String(a.choice || '');
      const conf = Number(a.confidence);
      const k = choice.charAt(0) === 'p' ? Number(choice.slice(1)) : -1;
      const pickName = k >= 0 && people[k] ? people[k].name : 'someone not in the cast';
      const known = Number.isFinite(conf);
      // The model gives a chance for every choice, not only the one it
      // picked. The next two, at 1% or more, show how close the call was.
      const probs = a.probabilities && typeof a.probabilities === 'object' ? a.probabilities : {};
      const others = Object.keys(probs)
        .filter((key) => key !== choice && Number(probs[key]) >= 0.01)
        .sort((x, y) => Number(probs[y]) - Number(probs[x]))
        .slice(0, 2)
        .map((key) => {
          const j = key.charAt(0) === 'p' ? Number(key.slice(1)) : -1;
          return (j >= 0 && people[j] ? people[j].name : 'someone else') + ' ' + pct(Number(probs[key]));
        });
      const also = others.length ? ' Next: ' + others.join(', ') + '.' : '';
      if (k >= 0 && people[k] && known && conf >= sure) {
        out.speakers[i] = people[k].name;
        picked++;
        out.decided.push('"' + textOf(i) + '" is ' + pickName + ', ' + pct(conf) + ' sure. Used.' + also);
      } else {
        unsure++;
        out.decided.push('"' + textOf(i) + '" is ' + pickName + (known ? ', ' + pct(conf) + ' sure' : '') + '. Left to the Director.' + also);
      }
    } else if (key.indexOf('sound_') === 0) {
      const i = Number(key.slice(6));
      const chance = Number(a.noul);
      if (!Number.isFinite(chance)) continue;
      out.hints[i] = Math.round(chance * 100) / 100;
      out.decided.push('"' + textOf(i) + '" describes a sound: ' + pct(chance) + (chance >= sure ? '. Its sounds are kept.' : '.'));
    }
  }
  if (out.decided.length) out.decided.unshift(name + ' answered. An answer is used at ' + s.decisionSure + '% sure or more.');
  if (speech.length && people.length > 1)
    out.log.push(name + ' picked the speaker for ' + picked + ' of ' + speech.length + ' quoted lines' + (unsure ? ', and left ' + unsure + ' to the Director' : '') + '.');
  return out;
}

// ---------------------------------------------------------------------------
// Directing one message
// ---------------------------------------------------------------------------

// Directed scripts kept per account, so playing a message twice, or playing
// one that was prepared ahead, asks nothing again.
// A script is a few KB, so this many is a small file, and enough for a long
// chat to be played again without asking the Director.
const SCRIPTS_KEPT = 300;
// A saved script can have a name and a folder, given in Saved audio. Both stay
// with it when the message is played and kept again.
interface KeptEntry {
  key: string;
  script: Script;
  name?: string;
  folder?: string;
}
const scripts: Record<string, KeptEntry[]> = {};

// Past the limit, the oldest script with no name and no folder goes first,
// so one the reader named or filed stays.
function trimKept(list: KeptEntry[]) {
  while (list.length > SCRIPTS_KEPT) {
    const plain = list.findIndex((x) => !x.name && !x.folder);
    list.splice(plain >= 0 ? plain : 0, 1);
  }
}

function keepScript(userId: string, script: Script) {
  if (!script.keptAt) script = Object.assign({}, script, { keptAt: Date.now() });
  const list = scripts[userId] || (scripts[userId] = []);
  const at = list.findIndex((x) => x.key === script.key);
  const was = at >= 0 ? list[at] : null;
  if (at >= 0) list.splice(at, 1);
  const entry: KeptEntry = { key: script.key, script };
  if (was && was.name) entry.name = was.name;
  if (was && was.folder) entry.folder = was.folder;
  list.push(entry);
  trimKept(list);
  void saveKeptScripts(userId);
}

// Scripts, the directed messages, are kept in the account too, with Keep made audio on, so
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
  const old: KeptEntry[] = saved
    .filter((x: any) => x && typeof x.key === 'string' && x.script && Array.isArray(x.script.lines) && !mine.some((m) => m.key === x.key))
    .map((x: any) => {
      const e: KeptEntry = { key: x.key, script: x.script };
      const name = str(x.name, 80).trim();
      const folder = str(x.folder, 40).replace(/[^a-z0-9_-]/gi, '');
      if (name) e.name = name;
      if (folder) e.folder = folder;
      return e;
    });
  const all = old.concat(mine);
  trimKept(all);
  scripts[userId] = all;
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

// A kept script is found by its key. A script kept under an older key, from
// before an update, is found by the message it belongs to and the words of
// its lines, the newest first, so what was made before is played again.
function keptScript(userId: string, key: string, messageId: string, plain: string, engineId: string): Script | null {
  const list = scripts[userId] || [];
  const hit = list.find((x) => x.key === key);
  if (hit) return hit.script;
  for (let k = list.length - 1; k >= 0; k--) {
    const sc = list[k].script;
    // A script that names its engine is only used for that engine.
    if (sc.engine && sc.engine !== engineId) continue;
    if (sc.messageId === messageId && sc.lines.map((l) => l.plain).join('\n') === plain) return sc;
  }
  return null;
}

// A short, stable fingerprint of a text. Not for security: it only tells two
// versions of a message apart.
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

// Settings change while a message is being directed. A new NPC is added to
// the copy on disk, not to the copy read before the Director was asked.
// A main role is added as a character, and a minor one as an NPC.
async function addSpeakers(userId: string | undefined, found: { name: string; gender: string; about: string; role?: string }[], by: AddedBy = 'ai'): Promise<string[]> {
  if (!found.length) return [];
  const s = await loadSettings(userId);
  const added: string[] = [];
  for (const f of found) {
    if (findMember(s.cast, f.name) || s.cast.length >= MAX_CAST) continue;
    const m = narrator();
    m.id = newId();
    m.name = f.name;
    m.kind = f.role === 'main' ? 'character' : 'npc';
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
  // Narration lines that are speech in script style, such as "Wren: Hold
  // on.", by line number: who says it and the words.
  script: Record<number, { name: string; text: string }>;
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
  const out: SceneRead = { named: {}, script: {}, likely: {}, inScene: [], found: [] };
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
  // A name and a colon at the start of a line, such as "Wren: Hold on.", is
  // that person speaking, in script style. Only for someone in the cast, so a
  // label such as "Note:" stays narration.
  const LABEL = new RegExp('^' + NAME + ':\\s+(\\S[\\s\\S]*)$', 'u');
  for (const g of segs) {
    if (g.kind !== 'narration') continue;
    const m = g.text.match(LABEL);
    const who = m ? findMember(cast, m[1]) : null;
    if (m && who && who.kind !== 'narrator') out.script[g.i] = { name: who.name, text: m[2].trim() };
  }
  for (const g of segs) {
    if (g.kind !== 'speech') continue;
    const next = segs[g.i + 1];
    const prev = segs[g.i - 1];
    let m: RegExpMatchArray | null = null;
    // A label right before the quote, such as Wren: "Hold on."
    if (prev && prev.kind === 'narration' && (m = prev.text.match(new RegExp('(?:^|[.!?…]\\s+)' + NAME + ':\\s*$', 'u')))) {
      take(g.i, m[1], true);
      continue;
    }
    if (next && next.kind === 'narration' && ((m = next.text.match(AFTER_A)) || (m = next.text.match(AFTER_B)))) {
      take(g.i, m[1], true);
      continue;
    }
    if (prev && prev.kind === 'narration' && (m = prev.text.match(BEFORE))) {
      take(g.i, m[1], true);
      continue;
    }
    // An action just before a quote, such as "Wren set the cup down.", points
    // at who speaks next. Only when the sentence starts with one cast name,
    // and in the same paragraph: a new paragraph is often someone answering.
    if (prev && prev.kind === 'narration' && prev.para === g.para) {
      const tail = prev.text.match(/[^.!?…]+[.!?…]*\s*$/);
      const last = tail ? tail[0].trim() : '';
      const first = last.match(new RegExp('^' + NAME, 'u'));
      if (first) take(g.i, first[1], false);
    }
  }
  // The same speaker goes on in a paragraph: a quote with no name of its own,
  // after a quote whose speaker is known, in the same paragraph, with no other
  // cast name in the narration between them.
  const known = (i: number) => out.named[i] || out.likely[i] || (out.script[i] && out.script[i].name) || '';
  const castNames = cast.filter((c) => c.kind !== 'narrator').map((c) => [c.name, c.name.split(/\s+/)[0]].concat(c.aliases).filter((n) => n && n.length >= 3));
  const namesSomeone = (text: string, but: string) =>
    castNames.some((ns, k) => cast.filter((c) => c.kind !== 'narrator')[k].name !== but && ns.some((n) => new RegExp('(^|[^\\p{L}])' + escapeRe(n) + '(?![\\p{L}])', 'u').test(text)));
  for (const g of segs) {
    if (g.kind !== 'speech' || known(g.i)) continue;
    for (let k = g.i - 1; k >= 0 && segs[k].para === g.para; k--) {
      const was = known(k);
      if (segs[k].kind === 'speech' && was) {
        let other = false;
        for (let j = k + 1; j < g.i; j++) if (segs[j].kind === 'narration' && namesSomeone(segs[j].text, was)) other = true;
        if (!other) out.likely[g.i] = was;
        break;
      }
    }
  }
  // Two people taking turns: when a paragraph opens with a quote nobody is
  // named for, and the two paragraphs before were each one of two speakers,
  // it is the one who did not speak last.
  const paraSpeaker: Record<number, string> = {};
  for (const g of segs) {
    if (g.para === undefined) continue;
    const who = known(g.i);
    if (who && !(g.para in paraSpeaker)) paraSpeaker[g.para] = who;
  }
  for (const g of segs) {
    if (g.kind !== 'speech' || known(g.i) || g.para === undefined || g.para < 2) continue;
    const firstInPara = !segs.some((x) => x.para === g.para && x.i < g.i && x.kind === 'speech');
    const narrated = segs.some((x) => x.para === g.para && x.i < g.i && x.kind === 'narration' && namesSomeone(x.text, ''));
    if (!firstInPara || narrated) continue;
    const a = paraSpeaker[g.para - 1];
    const b = paraSpeaker[g.para - 2];
    if (a && b && a !== b) {
      out.likely[g.i] = b;
      paraSpeaker[g.para] = b;
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
// The tokens one ask used. The provider's own count when it sends one, or
// Lumiverse's count of the text, or a guess from its length.
async function countSaying(text: string, userId?: string, model?: string): Promise<{ n: number; counted: boolean }> {
  const guess = Math.ceil(String(text || '').length / 4);
  try {
    if (!spindle.tokens || typeof spindle.tokens.countText !== 'function') return { n: guess, counted: false };
    // Lumiverse picks its tokenizer from the model. Named, it counts for the
    // Director's model, not the main connection's.
    const got = await spindle.tokens.countText(text, model ? { model: model, modelSource: 'explicit', userId: userId } : { userId: userId });
    if (got && got.approximate) return { n: guess, counted: false };
    const n = got && Number(got.total_tokens);
    return Number.isFinite(n) && n > 0 ? { n, counted: true } : { n: guess, counted: false };
  } catch (_) {
    return { n: guess, counted: false };
  }
}

async function addUsed(script: Script, usage: any, sent: string[], back: string, userId?: string, model?: string) {
  const pin = Number(usage && (usage.prompt_tokens != null ? usage.prompt_tokens : usage.input_tokens));
  const pout = Number(usage && (usage.completion_tokens != null ? usage.completion_tokens : usage.output_tokens));
  if (Number.isFinite(pin) && pin > 0 && Number.isFinite(pout) && pout >= 0) {
    script.sent += pin;
    script.back += pout;
    return;
  }
  let counted = true;
  for (const t of sent) {
    const c = await countSaying(t, userId, model);
    script.sent += c.n;
    if (!c.counted) counted = false;
  }
  const b = await countSaying(back, userId, model);
  script.back += b.n;
  if (!b.counted) counted = false;
  if (!counted) script.counted = false;
}

async function askDirector(userId: string | undefined, s: Settings, payload: any, connection: string, script: Script, run: DirectRun): Promise<{ answer: any }> {
  let waits = 0;
  let asks = 0;
  let note = '';
  for (;;) {
    if (run.stopped) {
      script.log.push('Stopped before the Director answered.');
      return { answer: null };
    }
    let content = '';
    let failed = '';
    try {
      // The note for the engine goes in the rules, or as a message of its own
      // right after the prompt, as the reader picked.
      const own = payload._engineNote ? String(payload._engineNote) : '';
      const sent = Object.assign({}, payload);
      delete sent._engineNote;
      const messages: any[] = [{ role: s.promptRole || 'system', content: s.prompt.trim() || BUILT_IN_PROMPT }];
      if (own) messages.push({ role: s.engineNoteRole, content: own });
      messages.push({ role: 'user', content: JSON.stringify(sent) });
      if (note) messages.push({ role: s.askNoteRole || 'user', content: note });
      const req: any = { messages };
      const reasoning = reasoningFor(s);
      if (reasoning) req.reasoning = reasoning;
      if (Object.keys(s.samplers).length) req.parameters = Object.assign({}, s.samplers);
      if (connection) req.connection_id = connection;
      if (userId) req.userId = userId;
      const res = await withTimeout(req, s.timeoutSecs, run);
      content = res && typeof res.content === 'string' ? res.content : '';
      const cost = Number(res && res.usage && res.usage.cost);
      if (Number.isFinite(cost)) script.cost += cost;
      await addUsed(script, res && res.usage, messages.map((m: any) => String(m.content || '')), content, userId, await modelOfConnection(userId, connection));
    } catch (e: any) {
      failed = String((e && e.message) || e || '');
    }
    let why = '';
    let kind = '';
    if (run.stopped) continue;
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

// A message can hold Lumiverse's macros, such as {{user}} and {{char}}. The
// chat shows them with the names filled in, so they are filled in here the
// same way before anything is directed or read aloud. Nothing is changed by
// it: commit is off, so a macro that sets a variable does not set it. When
// they cannot be filled in, the text is used as it is.
// A host call that has to answer within ms, or it is given up on with an
// error that says so. A call with no answer of its own would otherwise hold
// a script up for as long as it hangs.
function inTime<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: any = null;
  const late = new Promise<T>((_, no) => {
    timer = setTimeout(() => no(new Error(what + ' did not answer within ' + Math.round(ms / 1000) + ' seconds')), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

async function fillMacros(text: string, chatId: string, userId?: string): Promise<string> {
  if (text.indexOf('{{') < 0) return text;
  try {
    if (!spindle.macros || typeof spindle.macros.resolve !== 'function') return text;
    const out = await inTime(Promise.resolve(spindle.macros.resolve(text, { chatId: chatId || undefined, userId, commit: false })), 15000, 'Lumiverse, filling in the names,');
    const filled = typeof out === 'string' ? out : out && typeof out.text === 'string' ? out.text : '';
    return filled || text;
  } catch (e: any) {
    logWarn('Auto Foley: the macros in a message could not be filled in: ' + String((e && e.message) || e));
    return text;
  }
}

async function direct(userId: string | undefined, p: any): Promise<Script> {
  const s = await loadSettings(userId);
  const text = await fillMacros(str(p.text, 40000), str(p.chatId, 80), userId);
  const author = str(p.name, 80).trim() || 'Someone';
  const isUser = p.isUser === true;
  const messageId = str(p.messageId, 80);
  const uid = userId || '';
  const engine = cleanEngine(p.engine);
  // The key is the message as it is: which one, which swipe, its words and
  // the engine that speaks it. A message is directed once, and played from
  // what was kept after that, until its words change or Direct again is
  // pressed. Settings and the extension's own version are left out, so a
  // changed setting or an update does not direct every message again.
  const key = hash([messageId, str(p.swipeId, 8), text, engine.id].join('\u0001'));
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
  await readKeptScripts(uid, s);
  const skip = s.skipOn ? skipsFor(s.skipPatterns) : { list: [], bad: [] };
  const segs = splitSegments(text, { extra: s.extraThinkTags, bound: await boundPairs(userId), skips: skip.list, marks: s.speechMarks, asterisks: s.asterisks, parens: s.parens, quoted: s.quotedText, plain: s.plainText, emojis: s.emojisOn });
  if (!p.fresh) {
    const kept = keptScript(uid, key, messageId, segs.map((g) => g.text).join('\n'), engine.id);
    if (kept) {
      // Found under an older key, it is kept under this one from now on.
      if (kept.key !== key) keepScript(uid, Object.assign({}, kept, { key }));
      return Object.assign({}, kept, { key, added: [], fromKept: true, log: kept.log.concat('Played from the copy directed before.') });
    }
  }
  const script: Script = {
    key, engine: engine.id, messageId, chatId: str(p.chatId, 80), author, lines: [], log: [], directed: false, added: authorAdded ? [author] : [], inScene: [], isUser, model: '', cost: 0, sent: 0, back: 0, counted: true,
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
    music: s.musicOn,
  };

  // The text first: a quote the story itself says who spoke, such as
  // "said Wren", needs no model. The Decision model then picks the rest.
  const scene = readScene(segs, s.cast, author);
  const fixed: Record<number, string> = Object.assign({}, scene.named);
  // A line in script style is that person speaking. The label is not read.
  for (const k of Object.keys(scene.script)) {
    const i = Number(k);
    segs[i] = Object.assign({}, segs[i], { kind: 'speech' as SegKind, text: scene.script[i].text });
    fixed[i] = scene.script[i].name;
  }
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
    if (d.decided.length) script.decided = d.decided.slice(0, 41);
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
    .filter((c) => !c.muted && (c.name || c.aliases.length))
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
      engine_note: s.engineNoteRole === 'rules' ? engineNote(s, engine.id) : undefined,
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
      music: s.musicOn,
    },
  };
  if (s.musicOn) payload.rules.moods = MUSIC_MOODS;
  if (tagsOn && engine.tags === 'list') payload.rules.tag_list = engine.list;
  if (s.engineNoteRole !== 'rules') payload._engineNote = engineNote(s, engine.id);
  if (Object.keys(hints).length) payload.rules.sound_hints = hints;

  // The Director is asked, and asked again when the answer cannot be used:
  // - A busy or rate-limited provider is waited out, up to Wait out a
  //   provider that will not take the call. The refused call cost nothing.
  // - A refusal, an empty answer, an answer in the wrong shape, or one that
  //   changed most words is asked for again, up to Ask again when the
  //   Director's answer fails, with a note saying what went wrong.
  // Whatever happens, the message is still read, as written if need be.
  // The panel says the Director is writing only from here, so a script
  // played from what was kept never shows it.
  send(userId, { type: 'directing', messageId });
  const run: DirectRun = { stopped: false, ctl: null };
  (directRuns[uid] = directRuns[uid] || new Set()).add(run);
  let answer: any = null;
  try {
    answer = (await askDirector(userId, s, payload, s.directorConnection, script, run)).answer;
    // The second Director, on another connection, gets the same request
    // with a fresh count of asks. When it also sends back nothing usable,
    // the message is read as written, so it still plays.
    if (!answer && !run.stopped && s.backupOn && s.backupConnection !== s.directorConnection) {
      script.log.push('The second Director was asked.');
      answer = (await askDirector(userId, s, payload, s.backupConnection, script, run)).answer;
      if (answer) script.log.push('The second Director directed the message.');
    }
  } finally {
    directRuns[uid].delete(run);
  }
  if (!answer) script.log.push('The message is read as written.');

  const done = applyDirection(segs, answer, s.cast, author, fixed, rules);
  script.lines = done.lines;
  script.log.push(...done.log);
  if (answer && s.soundCheck) {
    const dropped = checkSounds(done.lines, segs, hints, s.decisionSure / 100);
    if (dropped) script.log.push(dropped + (dropped === 1 ? ' sound was' : ' sounds were') + ' left out, since the text around ' + (dropped === 1 ? 'it' : 'them') + ' does not show ' + (dropped === 1 ? 'it.' : 'them.'));
  }
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
  // A script is kept when it was directed, and when the Director could not
  // direct it, marked as read as written. Kept, it plays from saved audio
  // next time, and Direct again asks the Director anew. A message stopped
  // with Stop is not kept.
  if (!answer) script.fallback = true;
  if (answer || !run.stopped) keepScript(uid, script);
  return script;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const SETTINGS_FILE = 'settings.json';
const SOUND_INDEX = 'sounds/index.json';
const KEY_NAME = 'api.elevenlabs.io';
const FS_KEY_NAME = 'freesound.org';

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

// The picture behind a video, as a data URL, in a file of its own. It is
// made on the reader's device, at most 1920 pixels on its long side.
const VIDEO_BG_FILE = 'video-background.json';
const VIDEO_BG_MAX = 3000000;
function cleanVideoBg(v: any): string {
  const t = typeof v === 'string' ? v : '';
  return t.length <= VIDEO_BG_MAX && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(t) ? t : '';
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

// The moods scene music is picked by. A track in the library is marked with
// one of them, and the Director picks one for each turn in a scene.
const MUSIC_MOODS = ['calm', 'cozy', 'happy', 'playful', 'romantic', 'sad', 'tense', 'scary', 'action', 'mysterious'];
// What Freesound is searched for, for each mood.
const MUSIC_SEARCH: Record<string, string> = {
  calm: 'calm ambient music',
  cozy: 'cozy acoustic music',
  happy: 'happy upbeat music',
  playful: 'playful whimsical music',
  romantic: 'romantic piano music',
  sad: 'sad piano music',
  tense: 'tense suspense music',
  scary: 'horror dark ambient music',
  action: 'action battle music',
  mysterious: 'mysterious ambient music',
};

interface SoundEntry {
  id: string;
  // What the sound is, as the Director describes it or as you name it.
  name: string;
  // Words that make this sound play when a description holds one of them.
  triggers: string[];
  source: 'made' | 'upload' | 'link' | 'found';
  mime: string;
  bytes: number;
  added: number;
  uses: number;
  // For a sound added by link: the address the browser plays it from.
  url?: string;
  // For a sound found on Freesound: who made it, its license and its page,
  // shown wherever the sound is, since most licenses ask for credit.
  credit?: Credit;
  // A music track: the mood it is played for. A sound with a mood is never
  // used as a sound effect.
  mood?: string;
}

interface Credit {
  title: string;
  by: string;
  license: string;
  page: string;
  fsId: number;
  // Freesound sounds already used for this description, so Find another
  // does not pick one of them again.
  seen: number[];
}

function cleanCredit(c: any): Credit | null {
  if (!c || typeof c !== 'object') return null;
  const page = cleanLink(c.page);
  const fsId = num(c.fsId, 0, 1e12, 0);
  if (!fsId || !/^https:\/\/freesound\.org\//.test(page)) return null;
  return {
    title: str(c.title, 160).trim() || 'A Freesound sound',
    by: str(c.by, 80).trim() || 'a Freesound user',
    license: str(c.license, 30).trim(),
    page,
    fsId,
    seen: Array.isArray(c.seen) ? c.seen.map((x: any) => num(x, 0, 1e12, 0)).filter(Boolean).slice(-30) : [],
  };
}

// A link to a sound: http or https, with no spaces, at most 2000 letters.
function cleanLink(v: any): string {
  const t = String(v == null ? '' : v).trim();
  return t.length <= 2000 && /^https?:\/\/[^\s"'<>]+$/i.test(t) ? t : '';
}

const MAX_SOUNDS = 400;
// Uploads are kept small: they travel through the extension's message bridge.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function cleanSoundEntry(e: any): SoundEntry | null {
  if (!e || typeof e !== 'object') return null;
  const id = str(e.id, 64).replace(/[^a-z0-9_-]/gi, '');
  if (!id) return null;
  const url = e.source === 'link' ? cleanLink(e.url) : '';
  if (e.source === 'link' && !url) return null;
  const credit = e.source === 'found' ? cleanCredit(e.credit) : null;
  if (e.source === 'found' && !credit) return null;
  const entry: SoundEntry = {
    id,
    name: str(e.name, 160).trim() || 'Sound',
    triggers: Array.isArray(e.triggers) ? e.triggers.map((t: any) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
    source: e.source === 'upload' ? 'upload' : e.source === 'link' ? 'link' : e.source === 'found' ? 'found' : 'made',
    mime: /^audio\/[a-z0-9.+-]+$/i.test(String(e.mime)) ? String(e.mime) : 'audio/mpeg',
    bytes: num(e.bytes, 0, 1e9, 0),
    added: num(e.added, 0, 1e15, 0),
    uses: num(e.uses, 0, 1e9, 0),
  };
  if (url) entry.url = url;
  if (credit) entry.credit = credit;
  if (MUSIC_MOODS.indexOf(String(e.mood)) >= 0) entry.mood = String(e.mood);
  return entry;
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
  // Your own sounds, uploaded or linked, come before made and found ones.
  // Music tracks are never a sound effect.
  const mine = (e: SoundEntry) => (e.source === 'made' || e.source === 'found' ? 1 : 0);
  const ordered = list.filter((e) => !e.mood).sort((a, b) => mine(a) - mine(b));
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

async function getKey(userId: string | undefined, name = KEY_NAME): Promise<string | null> {
  try {
    if (!spindle.enclave || typeof spindle.enclave.get !== 'function') return null;
    return await spindle.enclave.get(name, userId);
  } catch (_) {
    return null;
  }
}

async function hasKeyFor(userId: string | undefined, name: string): Promise<boolean> {
  try {
    return !!(spindle.enclave && typeof spindle.enclave.has === 'function' && (await spindle.enclave.has(name, userId)));
  } catch (_) {
    return false;
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

// ---- Freesound ----
// Freesound's API is free for non-commercial use with a key of your own. A
// search costs one request: 60 a minute and 2000 a day are allowed. The
// preview, an MP3 of about 128 kbps, needs no sign-in, so the key is only
// sent to freesound.org.

// The short name of a license, from the name or the address Freesound sends.
function licenseName(v: any): string {
  const t = String(v || '');
  if (/publicdomain\/zero|creative commons 0|\bcc0\b/i.test(t)) return 'CC0';
  if (/sampling/i.test(t)) return 'Sampling+';
  if (/by-nc|noncommercial/i.test(t)) return 'CC BY-NC';
  if (/licenses\/by\/|attribution/i.test(t)) return 'CC BY';
  return '';
}

function licenseAllowed(name: string, which: Settings['freesoundLicense']): boolean {
  if (which === 'cc0') return name === 'CC0';
  if (which === 'free') return name === 'CC0' || name === 'CC BY';
  return !!name;
}

function freesoundTrouble(status: number, body: string): string {
  let detail = '';
  try {
    const j = JSON.parse(body);
    detail = j && typeof j.detail === 'string' ? j.detail : '';
  } catch (_) {}
  const tail = detail ? ' Freesound said: ' + detail.slice(0, 200) : '';
  if (status === 401 || status === 403) return 'Freesound refused the key. Check the key in the Sounds tab.' + tail;
  if (status === 429) return 'Freesound\'s limit is reached: 60 searches a minute and 2000 a day. Try again later.' + tail;
  return 'Freesound answered with an error (' + status + ').' + tail;
}

function freesoundCorsTrouble(e: any): string {
  const raw = String((e && e.message) || e || '');
  if (/PERMISSION_DENIED|cors_proxy/i.test(raw))
    return 'The CORS proxy permission is refused, so Freesound cannot be searched. Grant it to Auto Foley in Lumiverse, under Extensions.';
  if (/only serves audio|does not match/i.test(raw)) return 'Freesound sent something that is not a sound.';
  if (/timed? ?out|timeout/i.test(raw)) return 'Freesound did not answer within 30 seconds.';
  return 'Freesound could not be reached: ' + raw.slice(0, 200);
}

// The words a search uses: the description without filler words. A search
// with every word can find nothing, so shorter ones follow.
function freesoundQueries(desc: string): string[] {
  const words = soundKey(desc).split(' ').filter((w) => w.length > 2);
  const out: string[] = [];
  for (const n of [6, 3, 2]) {
    const q = words.slice(0, n).join(' ');
    if (q && out.indexOf(q) < 0) out.push(q);
  }
  return out;
}

// A sound from Freesound for a description: the first result with an
// allowed license and a preview, skipping the ones in skip. Sounds longer
// than 20 seconds are left out, since a sound plays between lines.
// For music, the searches and the filter are given: tracks tagged music,
// from 30 seconds to two and a half minutes, which loop under a scene and
// stay small enough to pass to the panel.
async function findFreesound(
  key: string,
  s: Settings,
  desc: string,
  skip: number[],
  music?: { queries: string[] },
): Promise<{ b64?: string; bytes?: Uint8Array; credit?: Credit; error?: string; none?: boolean }> {
  for (const q of music ? music.queries : freesoundQueries(desc)) {
    const url =
      'https://freesound.org/apiv2/search/?query=' + encodeURIComponent(q) +
      '&filter=' + encodeURIComponent(music ? 'duration:[30 TO 150] tag:music' : 'duration:[0.2 TO 20]') +
      '&fields=id,name,username,license,url,previews&page_size=15';
    let res: any;
    try {
      res = await cors(url, { method: 'GET', headers: { Authorization: 'Token ' + key, Accept: 'application/json' } });
    } catch (e: any) {
      return { error: freesoundCorsTrouble(e) };
    }
    const status = Number(res && res.status);
    if (status < 200 || status >= 300) return { error: freesoundTrouble(status, String((res && res.body) || '')) };
    let results: any[] = [];
    try {
      const j = JSON.parse(String(res.body || ''));
      results = Array.isArray(j && j.results) ? j.results : [];
    } catch (_) {
      return { error: 'Freesound sent an answer Auto Foley could not read.' };
    }
    for (const r of results) {
      const id = num(r && r.id, 0, 1e12, 0);
      const lic = licenseName(r && r.license);
      const preview = r && r.previews && String(r.previews['preview-hq-mp3'] || '');
      if (!id || skip.indexOf(id) >= 0 || !licenseAllowed(lic, s.freesoundLicense)) continue;
      if (!/^https:\/\/([a-z0-9-]+\.)*freesound\.org\//.test(preview)) continue;
      let got: any;
      try {
        got = await cors(preview, { method: 'GET', responseType: 'arraybuffer', mediaType: 'audio' });
      } catch (e: any) {
        return { error: freesoundCorsTrouble(e) };
      }
      const st = Number(got && got.status);
      if (st < 200 || st >= 300) continue;
      const b64 = String(got.body || '');
      const bytes = fromBase64(b64);
      if (bytes.length < 64) continue;
      const page = cleanLink(r.url);
      return {
        b64,
        bytes,
        credit: {
          title: str(r.name, 160).trim() || 'A Freesound sound',
          by: str(r.username, 80).trim() || 'a Freesound user',
          license: lic,
          page: /^https:\/\/freesound\.org\//.test(page) ? page : 'https://freesound.org/s/' + id + '/',
          fsId: id,
          seen: skip.concat([id]).slice(-30),
        },
      };
    }
  }
  return { none: true };
}

async function testFreesound(userId: string | undefined): Promise<{ ok: boolean; text: string }> {
  const key = await getKey(userId, FS_KEY_NAME);
  if (!key) return { ok: false, text: 'No key is saved.' };
  let res: any;
  try {
    res = await cors('https://freesound.org/apiv2/search/?query=door&fields=id&page_size=1', {
      method: 'GET',
      headers: { Authorization: 'Token ' + key, Accept: 'application/json' },
    });
  } catch (e: any) {
    return { ok: false, text: freesoundCorsTrouble(e) };
  }
  const status = Number(res && res.status);
  if (status >= 200 && status < 300) return { ok: true, text: 'The key works.' };
  return { ok: false, text: freesoundTrouble(status, String((res && res.body) || '')) };
}

// ---- Chatterbox, direct ----
// Chatterbox-TTS-Server's own routes: /api/model-info says which model is
// loaded, /get_predefined_voices and /get_reference_files list the voices,
// and /tts speaks. Its own settings, such as exaggeration, only reach it this
// way: an OpenAI-style connection in Lumiverse sends speed alone.
function chatterboxTrouble(e: any, what: string): string {
  const raw = String((e && e.message) || e || '');
  if (/PERMISSION_DENIED|cors_proxy/i.test(raw)) return 'The CORS proxy permission is refused, so the Chatterbox server cannot be reached. Grant it to Auto Foley in Lumiverse, under Extensions.';
  if (/timed? ?out|timeout/i.test(raw)) return what + ': the Chatterbox server did not answer in time.';
  if (/ECONNREFUSED|refused|ENOTFOUND|fetch failed|unable to connect/i.test(raw)) return what + ': nothing answered at the Chatterbox server address. Check that the server is running and the address is right.';
  return what + ': the Chatterbox server could not be reached. ' + raw.slice(0, 200);
}

async function chatterboxJson(base: string, path: string): Promise<any> {
  const res = await cors(base + path, { method: 'GET', headers: { Accept: 'application/json' } });
  const status = Number(res && res.status);
  if (status < 200 || status >= 300) throw new Error('HTTP ' + status);
  return JSON.parse(String((res && res.body) || 'null'));
}

async function chatterboxInfo(base: string): Promise<{ ok: boolean; model: string; voices: { id: string; name: string }[]; why: string }> {
  if (!base) return { ok: false, model: '', voices: [], why: 'No Chatterbox server address is saved.' };
  let info: any;
  try {
    info = await chatterboxJson(base, '/api/model-info');
  } catch (e: any) {
    if (/^HTTP 404/.test(String(e && e.message))) return { ok: false, model: '', voices: [], why: 'Something answered at that address, but it is not a Chatterbox-TTS-Server. Its /api/model-info was not found.' };
    return { ok: false, model: '', voices: [], why: chatterboxTrouble(e, 'Reading the Chatterbox server') };
  }
  const model = str(info && info.type, 20).toLowerCase();
  const voices: { id: string; name: string }[] = [];
  try {
    const pre = await chatterboxJson(base, '/get_predefined_voices');
    for (const v of Array.isArray(pre) ? pre.slice(0, 300) : []) {
      const file = str(v && v.filename, 200);
      if (file) voices.push({ id: 'p:' + file, name: str(v.display_name, 120) || file });
    }
  } catch (_) {}
  try {
    const refs = await chatterboxJson(base, '/get_reference_files');
    for (const f of Array.isArray(refs) ? refs.slice(0, 300) : []) {
      const file = str(f, 200);
      if (file) voices.push({ id: 'c:' + file, name: file.replace(/\.[a-z0-9]+$/i, '') + ' (cloned from a clip)' });
    }
  } catch (_) {}
  if (!(info && info.loaded)) return { ok: false, model, voices, why: 'The Chatterbox server has no model loaded yet. Open its web page and load one.' };
  return { ok: true, model, voices, why: model === 'turbo' ? '' : 'The server runs the ' + (model || 'unknown') + ' model, which takes no tags. Load Chatterbox-Turbo on it.' };
}

// One line from the Chatterbox server, as MP3. A voice id starts with p: for
// one of the server's own voices and c: for one cloned from a clip.
async function chatterboxSpeak(base: string, p: any): Promise<{ base64?: string; mime?: string; why?: string }> {
  if (!base) return { why: 'No Chatterbox server address is saved.' };
  const text = str(p.text, 5000);
  if (!text.trim()) return { why: 'There is nothing to say.' };
  let voice = str(p.voice, 220);
  if (!voice) {
    const info = await chatterboxInfo(base);
    voice = (info.voices.find((v) => v.id.indexOf('p:') === 0) || info.voices[0] || { id: '' }).id;
    if (!voice) return { why: 'The Chatterbox server has no voices. Add a voice on its web page, or pick one in the Cast tab.' };
  }
  const body: any = { text, output_format: 'mp3', split_text: true, chunk_size: 250 };
  if (voice.indexOf('c:') === 0) {
    body.voice_mode = 'clone';
    body.reference_audio_filename = voice.slice(2);
  } else {
    body.voice_mode = 'predefined';
    body.predefined_voice_id = voice.indexOf('p:') === 0 ? voice.slice(2) : voice;
  }
  const params = p.params && typeof p.params === 'object' ? p.params : {};
  const put = (k: string, lo: number, hi: number, as = k) => {
    const v = Number(params[k]);
    if (params[k] !== undefined && Number.isFinite(v)) body[as] = Math.min(hi, Math.max(lo, v));
  };
  put('exaggeration', 0.25, 2);
  put('cfg_weight', 0, 1);
  put('temperature', 0.05, 2);
  put('speed', 0.5, 2, 'speed_factor');
  const seed = Math.round(Number(params.seed));
  if (Number.isFinite(seed) && seed > 0) body.seed = seed;
  let res: any;
  try {
    res = await cors(base + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body), responseType: 'arraybuffer', mediaType: 'audio' });
  } catch (e: any) {
    if (/only serves audio|does not match/i.test(String((e && e.message) || ''))) return { why: 'The Chatterbox server answered with an error instead of a sound. Its own window or log says why.' };
    return { why: chatterboxTrouble(e, 'Speaking the line') };
  }
  const status = Number(res && res.status);
  if (status < 200 || status >= 300) return { why: 'The Chatterbox server answered with an error (' + status + ').' };
  const b64 = String(res.body || '');
  if (fromBase64(b64).length < 64) return { why: 'The Chatterbox server sent back no sound.' };
  return { base64: b64, mime: 'audio/mpeg' };
}

// One sound for a description: from the library when one fits, otherwise
// found on Freesound or made by ElevenLabs and added to the library, so the
// same sound is free the next time. With again set to a library id, a new
// take replaces that sound, keeping its name and trigger words.
async function soundFor(userId: string | undefined, description: string, again?: string): Promise<{ id?: string; base64?: string; url?: string; mime?: string; name?: string; credit?: Credit; error?: string; made?: boolean }> {
  const desc = cleanSound(description);
  if (!desc) return { error: 'No sound description.' };
  const list = await loadSounds(userId);
  const hit = again ? null : matchSound(list, desc);
  if (hit && hit.source === 'link' && hit.url) {
    hit.uses++;
    await saveSounds(userId, list);
    return { id: hit.id, url: hit.url, name: hit.name };
  }
  if (hit) {
    try {
      const bytes = await spindle.userStorage.readBinary('sounds/' + hit.id, userId);
      hit.uses++;
      await saveSounds(userId, list);
      return { id: hit.id, base64: toBase64(bytes), mime: hit.mime, name: hit.name, credit: hit.credit };
    } catch (_) {
      // The file is gone while its entry stayed. The entry goes, and a new
      // sound is made below.
      list.splice(list.indexOf(hit), 1);
      await saveSounds(userId, list);
    }
  }
  const s = await loadSettings(userId);
  if (!s.makeSounds) return { error: 'No sound in your library fits "' + desc + '", and getting new sounds is off.' };
  const old = again ? list.find((x) => x.id === again) : null;
  // Find another for a found sound looks on Freesound only. Make it again for
  // a made sound asks ElevenLabs only.
  const order: Array<'freesound' | 'eleven'> = old
    ? [old.source === 'found' ? 'freesound' : 'eleven']
    : s.soundFrom === 'both' ? ['freesound', 'eleven'] : [s.soundFrom];
  const why: string[] = [];
  for (const from of order) {
    if (from === 'freesound') {
      const fsKey = await getKey(userId, FS_KEY_NAME);
      if (!fsKey) {
        why.push('No Freesound key is saved.');
        continue;
      }
      const skip = old && old.credit ? old.credit.seen.concat([old.credit.fsId]) : [];
      const got = await findFreesound(fsKey, s, desc, skip);
      if (got.error) {
        why.push(got.error);
        continue;
      }
      if (got.none || !got.bytes || !got.credit) {
        why.push(old ? 'Freesound has no other sound for it.' : 'Freesound found nothing for it.');
        continue;
      }
      return keepSound(userId, list, old, desc, got.bytes, got.b64 || '', 'found', got.credit);
    }
    const made = await makeEleven(userId, s, desc);
    if (made.error) {
      why.push(made.error);
      continue;
    }
    return keepSound(userId, list, old, desc, made.bytes as Uint8Array, made.b64 || '', 'made');
  }
  // With no key saved for any place it could look, the answer says what to
  // do instead of listing each missing key.
  if (why.length && why.every((w) => /^No (Freesound|ElevenLabs) key is saved\.$/.test(w))) {
    const keys = order.map((f) => (f === 'freesound' ? 'a Freesound key' : 'an ElevenLabs key')).join(' or ');
    return { error: 'No sound in your library fits "' + desc + '". Save ' + keys + ' in the Sounds tab to get new ones.' };
  }
  return { error: 'No sound in your library fits "' + desc + '". ' + why.join(' ') };
}

// A music track for a mood. Your own tracks marked with the mood come
// first, the least played one, skipping those in skip. With none, and Where
// music comes from set to look on Freesound too, a track is found there and
// kept in the library, marked with the mood.
async function musicFor(userId: string | undefined, mood: string, skip: string[]): Promise<{ id?: string; base64?: string; url?: string; mime?: string; name?: string; credit?: Credit; error?: string }> {
  if (MUSIC_MOODS.indexOf(mood) < 0) return { error: 'There is no music mood called "' + mood + '".' };
  const list = await loadSounds(userId);
  const mine = list.filter((e) => e.mood === mood && skip.indexOf(e.id) < 0).sort((a, b) => a.uses - b.uses);
  for (const hit of mine) {
    if (hit.source === 'link' && hit.url) {
      hit.uses++;
      await saveSounds(userId, list);
      return { id: hit.id, url: hit.url, name: hit.name };
    }
    try {
      const bytes = await spindle.userStorage.readBinary('sounds/' + hit.id, userId);
      hit.uses++;
      await saveSounds(userId, list);
      return { id: hit.id, base64: toBase64(bytes), mime: hit.mime, name: hit.name, credit: hit.credit };
    } catch (_) {
      // The file is gone while its entry stayed. The next track is tried.
    }
  }
  const s = await loadSettings(userId);
  const none = 'No music in your library is marked ' + mood + '.';
  if (s.musicFrom !== 'both') return { error: none + ' Mark a track with it in the Sounds tab.' };
  const fsKey = await getKey(userId, FS_KEY_NAME);
  if (!fsKey) return { error: none + ' Mark a track with it in the Sounds tab, or save a Freesound key to find one.' };
  const seen = list.filter((e) => e.mood === mood && e.credit).map((e) => (e.credit as Credit).fsId);
  const got = await findFreesound(fsKey, s, mood, seen, { queries: [MUSIC_SEARCH[mood], mood + ' music'] });
  if (got.error) return { error: none + ' ' + got.error };
  if (got.none || !got.bytes || !got.credit) return { error: none + ' Freesound found no music for it either.' };
  return keepSound(userId, list, null, got.credit.title, got.bytes, got.b64 || '', 'found', got.credit, mood);
}

// Saves a new sound to the library, or a new take over an old one.
async function keepSound(
  userId: string | undefined,
  list: SoundEntry[],
  old: SoundEntry | null | undefined,
  desc: string,
  bytes: Uint8Array,
  b64: string,
  source: 'made' | 'found',
  credit?: Credit,
  mood?: string,
): Promise<{ id?: string; base64?: string; mime?: string; name?: string; credit?: Credit; error?: string; made?: boolean }> {
  if (old) {
    try {
      await spindle.userStorage.writeBinary('sounds/' + old.id, bytes, userId);
      old.bytes = bytes.length;
      old.mime = 'audio/mpeg';
      old.added = Date.now();
      if (credit) old.credit = credit;
      await saveSounds(userId, list);
    } catch (e: any) {
      return { error: 'The new take could not be saved: ' + String((e && e.message) || e).slice(0, 200) };
    }
    return { id: old.id, base64: b64, mime: old.mime, name: old.name, credit: old.credit, made: true };
  }
  const entry: SoundEntry = {
    id: 's' + newId(),
    name: desc,
    triggers: [],
    source,
    mime: 'audio/mpeg',
    bytes: bytes.length,
    added: Date.now(),
    uses: 1,
  };
  if (credit) entry.credit = credit;
  if (mood) entry.mood = mood;
  try {
    await spindle.userStorage.writeBinary('sounds/' + entry.id, bytes, userId);
    list.push(entry);
    await saveSounds(userId, list);
  } catch (e: any) {
    logWarn('could not keep a new sound: ' + String((e && e.message) || e));
  }
  return { id: entry.id, base64: b64, mime: entry.mime, name: entry.name, credit: entry.credit, made: true };
}

// A new sound made by ElevenLabs for a description.
async function makeEleven(userId: string | undefined, s: Settings, desc: string): Promise<{ bytes?: Uint8Array; b64?: string; error?: string }> {
  const key = await getKey(userId);
  if (!key) return { error: 'No ElevenLabs key is saved.' };
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
  return { bytes, b64 };
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
    return { list: [], why: sentence(generationTrouble(e)) };
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
      provider: str(c && c.provider, 60),
      isDefault: !!(c && c.is_default),
      hasKey: !!(c && c.has_api_key),
    }));
    return { list, state: list.length ? 'ok' : 'none' };
  } catch (e: any) {
    return { list: [], state: 'error', why: sentence(decisionTrouble(e)) };
  }
}

async function onPanel(p: any, userId: string | undefined) {
  if (!p || typeof p !== 'object') return;
  const type = String(p.type || '');
  const requestId = str(p.requestId, 80);
  const answer = (msg: any) => send(userId, Object.assign({ requestId }, msg));
  // Said every 10 seconds while a request runs, so the panel keeps waiting
  // through a slow Director, its retries and its waits, and only gives up
  // on a backend that has stopped.
  // A timer set again each time, rather than an interval, so it needs only
  // setTimeout.
  let beat: any = null;
  const tick = () => {
    beat = setTimeout(() => {
      answer({ type: 'working' });
      tick();
    }, 10000);
  };
  if (requestId) tick();
  try {
    switch (type) {
      case 'load': {
        // fresh: nothing is saved for this account yet. A new install starts
        // on every default as it is now, so no moved default is about it.
        const fresh = !(await readJson(SETTINGS_FILE, userId));
        const settings = await loadSettings(userId);
        const sounds = await loadSounds(userId);
        const hasKey = await hasKeyFor(userId, KEY_NAME);
        const hasFsKey = await hasKeyFor(userId, FS_KEY_NAME);
        // The messages with a saved script, so each gets its player.
        await readKeptScripts(userId || '', settings);
        const keptIds = Array.from(new Set((scripts[userId || ''] || []).map((x) => x.script.messageId).filter(Boolean)));
        answer({ type: 'state', settings, sounds, hasKey, hasFsKey, fresh, keptIds, builtInPrompt: BUILT_IN_PROMPT, builtInNotes: ASK_NOTES, builtInEngineNotes: ENGINE_NOTES, builtInSkips: BUILT_IN_SKIPS, builtInQuestions: DECISION_QUESTIONS, musicMoods: MUSIC_MOODS, version: VERSION, decisions: hasDecisions() });
        return;
      }
      case 'save': {
        const clean = cleanSettings(p.settings);
        const ok = await saveSettings(userId, clean);
        answer({ type: 'saved', ok, settings: clean });
        if (!ok) notify('warning', 'Your Auto Foley settings could not be saved. They will be lost when the page reloads.', userId);
        return;
      }
      case 'direct_stop': {
        // Stop, pressed while a script is written. Nothing is answered: the
        // panel has already moved on.
        stopDirecting(userId || '');
        return;
      }
      case 'direct': {
        const script = await direct(userId, p);
        // The cast first, so a person added for this message has their
        // voice before the panel speaks their first line.
        if (script.added.length) answer({ type: 'state_changed', settings: await loadSettings(userId) });
        answer({ type: 'script', script });
        return;
      }
      case 'sound': {
        const got = await soundFor(userId, str(p.description, 200));
        answer(Object.assign({ type: 'sound' }, got));
        if (got.made) answer({ type: 'sounds', sounds: await loadSounds(userId) });
        return;
      }
      case 'sound_kept': {
        // A sound already in the library, by its description, and nothing
        // more: no search and nothing made, so nothing is spent. Used to
        // open a saved performance in the Studio.
        const list = await loadSounds(userId);
        const e = matchSound(list, cleanSound(p.description));
        if (!e || e.source === 'link') return answer({ type: 'sound', missing: true });
        try {
          const bytes = await spindle.userStorage.readBinary('sounds/' + e.id, userId);
          return answer({ type: 'sound', base64: toBase64(bytes), mime: e.mime, name: e.name, credit: e.credit });
        } catch (_) {
          return answer({ type: 'sound', missing: true });
        }
      }
      case 'sound_again': {
        // A new take of a made sound, for someone who does not like it.
        const id = str(p.id, 64).replace(/[^a-z0-9_-]/gi, '');
        const list = await loadSounds(userId);
        // From Now playing, a sound is named by its description instead.
        const e = id ? list.find((x) => x.id === id) : matchSound(list, cleanSound(p.description));
        if (!e) return answer({ type: 'sound', error: 'That sound is no longer in the library.' });
        if (e.source !== 'made' && e.source !== 'found') return answer({ type: 'sound', error: 'Only a sound made by ElevenLabs or found on Freesound can be swapped. Upload a new file for one of yours.' });
        const got = await soundFor(userId, e.name, e.id);
        answer(Object.assign({ type: 'sound' }, got));
        answer({ type: 'sounds', sounds: await loadSounds(userId) });
        return;
      }
      case 'sound_play': {
        const id = str(p.id, 64).replace(/[^a-z0-9_-]/gi, '');
        const list = await loadSounds(userId);
        const e = list.find((x) => x.id === id);
        if (!e) return answer({ type: 'sound', error: 'That sound is no longer in the library.' });
        if (e.source === 'link') return answer({ type: 'sound', id: e.id, url: e.url, name: e.name });
        try {
          const bytes = await spindle.userStorage.readBinary('sounds/' + e.id, userId);
          return answer({ type: 'sound', id: e.id, base64: toBase64(bytes), mime: e.mime, name: e.name, credit: e.credit });
        } catch (_) {
          return answer({ type: 'sound', error: 'The file for this sound could not be read.' });
        }
      }
      case 'skip_check': {
        // The lines of a pattern box that cannot be used, and why.
        const got = makePatterns(str(p.text, 8000) || BUILT_IN_SKIPS);
        return answer({ type: 'skip_check', bad: got.bad, count: got.list.length });
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
      case 'clip_drop': {
        // One kept line is let go, so it is made again the next time.
        const sig = str(p.sig, 40);
        const list = await loadClips(userId);
        const gone = list.filter((x) => x.sig === sig);
        if (!gone.length) return answer({ type: 'clip_dropped', ok: true });
        await dropClips(userId, gone);
        const ok = await saveClips(userId, list.filter((x) => x.sig !== sig));
        return answer({ type: 'clip_dropped', ok });
      }
      case 'kept_list': {
        // Saved audio: every saved script, newest first, without its lines.
        const s = await loadSettings(userId);
        await readKeptScripts(userId || '', s);
        const list = (scripts[userId || ''] || []).slice().reverse().map((x) => {
          const sc = x.script;
          const voice = sc.lines.filter((l) => l.kind === 'speech' || l.kind === 'narration');
          return { key: x.key, messageId: sc.messageId, chatId: sc.chatId || '', author: sc.author, keptAt: sc.keptAt || 0, lines: voice.length, first: str(voice.length ? voice[0].plain : '', 160), how: sc.directed ? 'directed' : sc.fallback ? 'fallback' : 'off', name: x.name || '', folder: x.folder || '' };
        });
        return answer({ type: 'kept_list', list });
      }
      case 'kept_edit': {
        // A saved script's name or folder, from Saved audio. An empty name
        // goes back to the one made from whose script it is.
        const key = str(p.key, 80);
        const uid = userId || '';
        const s = await loadSettings(userId);
        await readKeptScripts(uid, s);
        const hit = (scripts[uid] || []).find((x) => x.key === key);
        if (!hit) return answer({ type: 'kept_edited', ok: false, error: 'This script is no longer saved.' });
        if (typeof p.name === 'string') {
          const name = str(p.name, 80).trim();
          if (name) hit.name = name;
          else delete hit.name;
        }
        if (typeof p.folder === 'string') {
          const folder = str(p.folder, 40).replace(/[^a-z0-9_-]/gi, '');
          if (folder) hit.folder = folder;
          else delete hit.folder;
        }
        await saveKeptScripts(uid);
        return answer({ type: 'kept_edited', ok: true, name: hit.name || '', folder: hit.folder || '' });
      }
      case 'kept_script': {
        const key = str(p.key, 80);
        const hit = (scripts[userId || ''] || []).find((x) => x.key === key);
        return answer({ type: 'kept_script', script: hit ? hit.script : null });
      }
      case 'clips_have': {
        // Which of these lines have saved audio. Nothing is sent back but the
        // fingerprints, so a check of many lines stays small.
        const want = Array.isArray(p.sigs) ? p.sigs.map((x: any) => str(x, 40)).filter((x: string) => /^[a-z0-9]{6,40}$/.test(x)).slice(0, 400) : [];
        const list = await loadClips(userId);
        const have = new Set(list.map((x) => x.sig));
        return answer({ type: 'clips_have', have: want.filter((x: string) => have.has(x)) });
      }
      case 'kept_drop': {
        // One saved script is deleted, with the saved audio of its lines.
        const key = str(p.key, 80);
        const uid = userId || '';
        const s = await loadSettings(userId);
        await readKeptScripts(uid, s);
        scripts[uid] = (scripts[uid] || []).filter((x) => x.key !== key);
        await saveKeptScripts(uid);
        const sigs = new Set(Array.isArray(p.sigs) ? p.sigs.map((x: any) => str(x, 40)) : []);
        const list = await loadClips(userId);
        const gone = list.filter((x) => sigs.has(x.sig));
        if (gone.length) {
          await dropClips(userId, gone);
          await saveClips(userId, list.filter((x) => !sigs.has(x.sig)));
        }
        return answer({ type: 'kept_dropped', ok: true, clips: gone.length });
      }
      case 'video_bg_get': {
        const v = await readJson(VIDEO_BG_FILE, userId);
        return answer({ type: 'video_bg', picture: cleanVideoBg(v && v.picture) });
      }
      case 'video_bg_put': {
        const picture = cleanVideoBg(p.picture);
        if (p.picture && !picture) return answer({ type: 'video_bg', ok: false, picture: '', error: 'That picture is too large to keep. Pick a smaller one.' });
        const ok = await writeJson(VIDEO_BG_FILE, { picture }, userId);
        return answer({ type: 'video_bg', ok, picture: ok ? picture : '', error: ok ? '' : 'The picture could not be saved to your account.' });
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
      case 'music_for': {
        const skip = Array.isArray(p.skip) ? p.skip.map((x: any) => str(x, 64)).slice(0, 50) : [];
        const got = await musicFor(userId, str(p.mood, 30).trim().toLowerCase(), skip);
        answer(Object.assign({ type: 'music' }, got));
        return;
      }
      case 'sound_edit': {
        const list = await loadSounds(userId);
        const e = list.find((x) => x.id === str(p.id, 64));
        if (!e) return answer({ type: 'sounds', sounds: list });
        if (typeof p.name === 'string') e.name = str(p.name, 160).trim() || e.name;
        if (Array.isArray(p.triggers)) e.triggers = p.triggers.map((t: any) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12);
        // '' makes a music track a sound effect again.
        if (typeof p.mood === 'string') {
          if (MUSIC_MOODS.indexOf(p.mood) >= 0) e.mood = p.mood;
          else delete e.mood;
        }
        const ok = await saveSounds(userId, list);
        if (!ok) notify('warning', 'The change to this sound could not be saved.', userId);
        answer({ type: 'sounds', sounds: list });
        return;
      }
      case 'sound_link': {
        // A sound kept as a link. The browser plays it from that address, so
        // nothing is downloaded or stored but the link.
        const url = cleanLink(p.url);
        if (!url) return answer({ type: 'uploaded', ok: false, error: 'That does not look like a link. It has to start with http:// or https://.' });
        const list = await loadSounds(userId);
        if (list.length >= MAX_SOUNDS) return answer({ type: 'uploaded', ok: false, error: 'The library is full (' + MAX_SOUNDS + ' sounds). Delete some first.' });
        // The file name in the link, as a name to show. A link with a broken
        // escape, such as a lone %C3, keeps its file name as written.
        const tail = url.split(/[?#]/)[0].split('/').pop() || '';
        let file = tail;
        try { file = decodeURIComponent(tail); } catch { /* kept as written */ }
        const fromUrl = file.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_-]+/g, ' ').trim();
        const entry: SoundEntry = {
          id: 'l' + newId(),
          name: str(p.name, 160).trim() || fromUrl.slice(0, 160) || 'A linked sound',
          triggers: Array.isArray(p.triggers) ? p.triggers.map((t: any) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
          source: 'link',
          mime: 'audio/mpeg',
          bytes: 0,
          added: Date.now(),
          uses: 0,
          url,
        };
        list.push(entry);
        const ok = await saveSounds(userId, list);
        answer({ type: 'uploaded', ok, error: ok ? '' : 'The link could not be saved to the library.' });
        answer({ type: 'sounds', sounds: await loadSounds(userId) });
        return;
      }
      case 'sound_delete': {
        const list = await loadSounds(userId);
        const at = list.findIndex((x) => x.id === str(p.id, 64));
        if (at >= 0) {
          const [gone] = list.splice(at, 1);
          if (gone.source !== 'link') {
            try {
              await spindle.userStorage.delete('sounds/' + gone.id, userId);
            } catch (_) {}
          }
          const ok = await saveSounds(userId, list);
          if (!ok) notify('warning', 'The sound could not be removed from the library.', userId);
        }
        answer({ type: 'sounds', sounds: list });
        return;
      }
      // Two keys: ElevenLabs, for making sounds, and Freesound, for finding
      // them. "which" says which one. Each is kept in the enclave and only
      // sent to its own host.
      case 'key_save': {
        const fs = p.which === 'freesound';
        const key = cleanKey(p.key);
        if (!key) return answer({ type: 'key', which: fs ? 'freesound' : 'eleven', hasKey: false, text: 'That does not look like a' + (fs ? ' Freesound' : 'n ElevenLabs') + ' key. Paste it again, with no spaces or line breaks.' });
        try {
          await spindle.enclave.put(fs ? FS_KEY_NAME : KEY_NAME, key, userId);
        } catch (e: any) {
          return answer({ type: 'key', which: fs ? 'freesound' : 'eleven', hasKey: false, text: 'The key could not be saved: ' + String((e && e.message) || e).slice(0, 200) });
        }
        const t = fs ? await testFreesound(userId) : await testKey(userId);
        answer({ type: 'key', which: fs ? 'freesound' : 'eleven', hasKey: true, ok: t.ok, text: t.text });
        return;
      }
      case 'key_forget': {
        const fs = p.which === 'freesound';
        try {
          await spindle.enclave.delete(fs ? FS_KEY_NAME : KEY_NAME, userId);
        } catch (e: any) {
          return answer({ type: 'key', which: fs ? 'freesound' : 'eleven', hasKey: true, text: 'The key could not be removed: ' + String((e && e.message) || e).slice(0, 200) });
        }
        answer({ type: 'key', which: fs ? 'freesound' : 'eleven', hasKey: false, text: 'The key is removed.' });
        return;
      }
      case 'key_test': {
        const fs = p.which === 'freesound';
        const t = fs ? await testFreesound(userId) : await testKey(userId);
        answer({ type: 'key', which: fs ? 'freesound' : 'eleven', hasKey: t.text !== 'No key is saved.', ok: t.ok, text: t.text });
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
      case 'cbx_info': {
        const s = await loadSettings(userId);
        const base = p.url !== undefined ? cleanServer(p.url) : s.chatterboxUrl;
        if (p.url !== undefined && String(p.url || '').trim() && !base) return answer({ type: 'cbx', ok: false, model: '', voices: [], why: 'That does not look like a server address. It looks like http://localhost:8004.' });
        answer(Object.assign({ type: 'cbx' }, await chatterboxInfo(base)));
        return;
      }
      case 'cbx_speak': {
        const s = await loadSettings(userId);
        answer(Object.assign({ type: 'cbx_audio' }, await chatterboxSpeak(s.chatterboxUrl, p)));
        return;
      }
      case 'reset_check': {
        // Which chosen parts are already at their defaults, so Start again
        // can say so and leave them out.
        const parts: string[] = Array.isArray(p.parts) ? p.parts.filter((x: any) => RESET_PARTS.indexOf(x) >= 0) : [];
        const s = await loadSettings(userId);
        const fresh = cleanSettings({});
        const NOT = ['cast', 'groups', 'prompt', 'promptRole', 'engineNoteRole', 'askNoteRole', 'askNotes', 'engineNotes', 'decisionQuestions', 'exportParts', 'importParts', 'resetParts', 'guideSeen', 'builtInSeen', 'movedSeen', 'chatsOff'];
        const strip = (x: any) => {
          const o: any = {};
          for (const k of Object.keys(x).sort()) if (NOT.indexOf(k) < 0) o[k] = x[k];
          return JSON.stringify(o);
        };
        const empty = (o: any) => !o || !Object.keys(o).length;
        const already: string[] = [];
        for (const part of parts) {
          let same = false;
          if (part === 'settings') {
            const bg = await readJson(VIDEO_BG_FILE, userId);
            same = strip(s) === strip(fresh) && !(bg && bg.picture);
          }
          else if (part === 'prompt')
            same = !s.prompt && empty(s.askNotes) && empty(s.engineNotes) && empty(s.decisionQuestions) &&
              s.promptRole === fresh.promptRole && s.engineNoteRole === fresh.engineNoteRole && s.askNoteRole === fresh.askNoteRole;
          else if (part === 'cast') same = JSON.stringify(s.cast) === JSON.stringify(fresh.cast) && !(s.groups || []).length;
          else if (part === 'chats') same = !(s.chatsOff || []).length;
          else if (part === 'sounds') same = !(await loadSounds(userId)).length;
          else if (part === 'audio') {
            const kept = await readJson(SCRIPTS_FILE, userId);
            same = !(await loadClips(userId)).length && !(Array.isArray(kept) && kept.length);
          } else if (part === 'key') same = !(await hasKeyFor(userId, KEY_NAME)) && !(await hasKeyFor(userId, FS_KEY_NAME));
          if (same) already.push(part);
        }
        answer({ type: 'reset_check', already });
        return;
      }
      case 'reset': {
        // Start again: each chosen part goes back to its default. With every
        // part chosen, everything Auto Foley keeps for this account is gone.
        const parts: string[] = Array.isArray(p.parts) ? p.parts.filter((x: any) => RESET_PARTS.indexOf(x) >= 0) : [];
        const s = await loadSettings(userId);
        const fresh = cleanSettings({});
        if (parts.indexOf('settings') >= 0) {
          const keep = { cast: s.cast, groups: s.groups, prompt: s.prompt, promptRole: s.promptRole, engineNoteRole: s.engineNoteRole, askNoteRole: s.askNoteRole, askNotes: s.askNotes, engineNotes: s.engineNotes, decisionQuestions: s.decisionQuestions, exportParts: s.exportParts, importParts: s.importParts, resetParts: s.resetParts, builtInSeen: s.builtInSeen, movedSeen: s.movedSeen, chatsOff: s.chatsOff };
          Object.assign(s, fresh, keep);
        }
        if (parts.indexOf('prompt') >= 0) {
          s.prompt = '';
          s.askNotes = {};
          s.engineNotes = {};
          s.decisionQuestions = {};
          s.promptRole = 'system';
          s.engineNoteRole = 'rules';
          s.askNoteRole = 'user';
        }
        if (parts.indexOf('cast') >= 0) {
          s.cast = fresh.cast;
          s.groups = [];
        }
        if (parts.indexOf('chats') >= 0) s.chatsOff = [];
        let ok = await saveSettings(userId, s);
        // The picture behind videos is a setting, kept in a file of its own.
        if (parts.indexOf('settings') >= 0) {
          const had = await readJson(VIDEO_BG_FILE, userId);
          if (had && had.picture) ok = (await writeJson(VIDEO_BG_FILE, { picture: '' }, userId)) && ok;
        }
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
          for (const name of [KEY_NAME, FS_KEY_NAME]) {
            try {
              if (await hasKeyFor(userId, name)) await spindle.enclave.delete(name, userId);
            } catch (_) {
              ok = false;
            }
          }
        }
        delete scripts[userId || ''];
        const hasKey = await hasKeyFor(userId, KEY_NAME);
        const hasFsKey = await hasKeyFor(userId, FS_KEY_NAME);
        answer({ type: 'reset', ok, error: ok ? '' : 'Some of it could not be reset. The rest was.', settings: await loadSettings(userId), sounds: await loadSounds(userId), hasKey, hasFsKey });
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
  } finally {
    if (beat) clearTimeout(beat);
    beat = null;
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
