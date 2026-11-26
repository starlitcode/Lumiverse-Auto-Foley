// Panel checks that need a real browser.
//
// The drawer is drawn with the reader's theme, which this repository has
// never seen, and on screens from a phone to a laptop. Whether a label is
// readable, and whether the panel fits, are measurements. These drive the
// built dist/frontend.js in headless Chromium against a stub of Lumiverse and
// measure what was painted.
//
//   bun run test:ui
//
// Playwright is not a dependency of this project: the install path is
// "Lumiverse clones the repo", and Playwright pulls a few hundred megabytes of
// browsers. When it is missing, this skips and exits cleanly. CI adds it for
// this run only, and turns a skip into a failure.

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const root = join(import.meta.dir, "..");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (_) {
  try {
    ({ chromium } = createRequire(import.meta.url)("playwright"));
  } catch (_) {
    console.log("playwright is not installed, skipping the browser checks.\n  bun add -d playwright && bunx playwright install chromium");
    process.exit(0);
  }
}

const bundle = join(root, "dist", "frontend.js");
if (!existsSync(bundle)) {
  console.error("dist/frontend.js is missing. Run `bun run build` first.");
  process.exit(1);
}
const SOURCE = readFileSync(bundle, "utf8").replace(/^export /gm, "") + "\nwindow.__setup = setup;\n";

// Lumiverse's own page-wide rules, from its reset.css and global.css. Every
// part of the extension sits under these in Lumiverse, so every check does
// too. A rule here can outrank one of the extension's: its slider rules beat a
// selector of one class, and phones get a 16px floor on every text box.
const HOST_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
img,picture,video,canvas,svg{display:block;max-width:100%;-webkit-user-select:none;user-select:none}
input,button,textarea,select{font:inherit;color:inherit}
@media screen and (max-width:600px){input,textarea,select{font-size:max(16px,1em)!important}}
button,a,[role="button"]{-webkit-user-select:none;user-select:none}
button{cursor:pointer;border:none;background:none}
a{color:inherit;text-decoration:none}
ul,ol{list-style:none}
input[type="range"]{-webkit-appearance:none;appearance:none;min-height:44px;background:transparent;cursor:pointer;touch-action:none}
input[type="range"]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--lumiverse-fill-medium,rgba(0,0,0,.15))}
input[type="range"]::-moz-range-track{height:4px;border-radius:2px;background:var(--lumiverse-fill-medium,rgba(0,0,0,.15));border:none}
input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--lumiverse-primary,#8c82ff);border:2px solid var(--lumiverse-bg,#1c1826);box-shadow:0 0 0 1px var(--lumiverse-primary-020,rgba(140,130,255,.2)),0 1px 4px rgba(0,0,0,.3);margin-top:-9px;cursor:pointer}
input[type="range"]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--lumiverse-primary,#8c82ff);border:2px solid var(--lumiverse-bg,#1c1826);box-shadow:0 0 0 1px var(--lumiverse-primary-020,rgba(140,130,255,.2)),0 1px 4px rgba(0,0,0,.3);cursor:pointer}
select{background-color:var(--lumiverse-bg-deep,#0a0812);color:var(--lumiverse-text,rgba(255,255,255,.9))}
select option{background-color:var(--lumiverse-bg-deep,#0a0812);color:var(--lumiverse-text,rgba(255,255,255,.9))}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--lumiverse-primary-020);border-radius:3px}
:focus-visible{outline:1.5px solid var(--lumiverse-primary-050);outline-offset:2px}
input:focus-visible,textarea:focus-visible,select:focus-visible,[contenteditable]:focus-visible{outline:none;border-color:var(--lumiverse-primary-050)}
`;

// The colors Lumiverse's own theme engine writes, dark and light.
const ENGINE = JSON.parse(readFileSync(join(root, "test", "lumiverse-themes.json"), "utf8"));

// A palette built to break a panel: a light accent and a near-white surface,
// where a label colored by hand instead of by the theme turns invisible.
const HOSTILE = `:root{--lumiverse-primary:hsl(55,90%,75%);--lumiverse-primary-text:hsl(55,60%,30%);--lumiverse-primary-contrast:hsl(55,40%,10%);--lumiverse-primary-010:hsla(55,90%,45%,.12);--lumiverse-primary-020:hsla(55,90%,45%,.22);--lumiverse-bg:#fbfaf2;--lumiverse-bg-elevated:#ffffff;--lumiverse-text:#1d1b10;--lumiverse-text-muted:#57543f;--lumiverse-text-dim:#6b6852;--lumiverse-border:rgba(0,0,0,.18);--lumiverse-warning:hsl(30,80%,32%);--lumiverse-warning-015:hsla(30,80%,45%,.15);--lumiverse-danger:hsl(0,70%,38%);--lumiverse-success:hsl(140,60%,28%)}`;

const THEMES = [
  { name: "dark", css: ENGINE.dark, bg: "var(--lumiverse-bg, #1b1a22)" },
  { name: "light", css: ENGINE.light, bg: "var(--lumiverse-bg, #f6f5fa)" },
  { name: "hostile light", css: HOSTILE, bg: "#fbfaf2" },
];

const SIZES = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "laptop", width: 1280, height: 800, touch: false },
];

const TABS = ["stage", "cast", "director", "sounds", "studio", "settings"];

// The stub host. It answers the panel's backend messages and Lumiverse's own
// routes with fixed data, and plays audio with a fake that ends after 40 ms.
const STUB = `
window.__log = [];
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason && e.reason.message || e.reason)));
const listeners = {};
const backendFns = new Set();
const styles = [];
const decorators = [];
window.__sent = [];
window.__settings = {
  enabled: true, ttsConnection: '', autoplay: false, prepareAhead: true, narration: 'read', soundsOn: true, soundStyle: 'both',
  directorOn: true, decisionsOn: true, strength: 'natural', tagsOn: true, breathsOn: true, findSpeakers: true, bigMoments: true,
  makeSounds: true, soundSeconds: 0, voiceVolume: 1, soundVolume: 0.8, prompt: '',
  // Off by default. On here, since most checks press them.
  messageButton: true, barButton: true, extrasMenu: true,
  cast: [
    { id: 'n', name: 'Narrator', kind: 'narrator', addedBy: 'you', aliases: [], voice: '', voiceName: '', model: '', stability: 0.5, similarity: 0.75, style: 0, speed: 1, note: 'Calm and clear.', gender: 'unknown', muted: false },
    { id: 'a', name: 'Ysolde Marrow-Kestrel of the Lower Quays', kind: 'character', addedBy: 'chat', aliases: ['Ysolde'], voice: 'v1', voiceName: 'Hollow Bell', model: 'eleven_v3', stability: 0.5, similarity: 0.75, style: 0.2, speed: 1, note: 'Dry and low.', gender: 'female', muted: false },
    { id: 'b', name: 'Ferryman', kind: 'npc', addedBy: 'ai', aliases: [], voice: '', voiceName: '', model: '', stability: 0.5, similarity: 0.75, style: 0, speed: 1, note: 'slow and gravelly', gender: 'male', muted: false },
    { id: 'c', name: 'Wyn', kind: 'persona', addedBy: 'chat', aliases: [], voice: '', voiceName: '', model: 'eleven_v4', stability: 0.4, similarity: 0.75, style: 0, speed: 1.1, note: '', gender: 'unknown', muted: false },
  ],
};
const SCRIPT = {
  key: 'k', messageId: 'm1', author: 'Ysolde Marrow-Kestrel of the Lower Quays', directed: true, added: [], sent: 1840, back: 212, counted: true,
  log: ['The Director tagged 2 of 3 lines and added 2 sounds.'],
  lines: [
    { i: 0, kind: 'narration', speaker: 'Narrator', text: 'She set the cup down on the long table by the window.', plain: '', tags: [], inSounds: [], big: false, before: '', after: 'a ceramic cup set down on a wooden table', note: '' },
    { i: 1, kind: 'speech', speaker: 'Ysolde Marrow-Kestrel of the Lower Quays', text: '[flatly] You are late. [sound of a door banging shut upstairs, someone yelling "sorry!"] Again.', plain: '', tags: ['flatly'], inSounds: ['x'], big: true, before: '', after: '', note: '' },
    { i: 2, kind: 'speech', speaker: 'Ferryman', text: 'The tide does not wait for anyone, and neither does the boat that runs on it.', plain: '', tags: [], inSounds: [], big: false, before: '', after: '', note: 'The Director changed the words of this line, so it is read as written.' },
  ],
};
window.__sounds = [
  { id: 'u1', name: 'glass shatter on a very long tile floor in the old kitchen', triggers: ['glass'], source: 'upload', mime: 'audio/mpeg', bytes: 40000, added: 1, uses: 3 },
  { id: 's1', name: 'a ceramic cup set down on a wooden table', triggers: [], source: 'made', mime: 'audio/mpeg', bytes: 12000, added: 2, uses: 1 },
];
function answer(msg) {
  const reply = (m) => setTimeout(() => backendFns.forEach((fn) => fn(Object.assign({ requestId: msg.requestId }, m))), 5);
  switch (msg.type) {
    case 'load': return reply({ type: 'state', fresh: window.__fresh !== false, settings: window.__settings, sounds: window.__sounds, hasKey: true, musicMoods: ['calm', 'cozy', 'happy', 'playful', 'romantic', 'sad', 'tense', 'scary', 'action', 'mysterious'], builtInPrompt: '<the_director>\\nYou direct.\\n</the_director>', builtInSkips: '^[ \\\\t]*\\\\|.*\\\\|[ \\\\t]*$\\n【[^】\\\\n]*】', version: '0', decisions: true });
    case 'save': window.__settings = msg.settings; return reply({ type: 'saved', ok: true, settings: msg.settings });
    case 'direct': {
      // A check can hold the answer, and send the note that the Director is
      // being asked, as the backend does when no kept script is found.
      if (window.__directingAt != null) setTimeout(() => backendFns.forEach((fn) => fn({ type: 'directing', messageId: msg.messageId })), window.__directingAt);
      const base = window.__script || SCRIPT;
      let sc = window.__fromKept ? Object.assign({}, base, { fromKept: true }) : base;
      if (window.__fallback) sc = Object.assign({}, sc, { directed: false, fallback: true });
      if (window.__directHold) {
        // A slow Director: the backend says it is still working while it
        // holds the answer, as the real one does every 10 seconds.
        if (window.__workingEvery) {
          const beat = setInterval(() => reply({ type: 'working' }), window.__workingEvery);
          setTimeout(() => clearInterval(beat), window.__directHold);
        }
        return setTimeout(() => reply({ type: 'script', script: sc }), window.__directHold);
      }
      return reply({ type: 'script', script: sc });
    }
    case 'sound': return reply({ type: 'sound', base64: window.__soundB64 || 'AAAA', mime: window.__soundB64 ? 'audio/wav' : 'audio/mpeg' });
    case 'list_connections': return reply({ type: 'connections', list: window.__llmList || [{ id: 'l1', name: 'Fast helper with a very long connection name for testing', model: 'maker/tiny-fast-model' }] });
    case 'list_decision_connections': return reply({ type: 'decision_connections', list: window.__decList || [{ id: 'd1', name: 'Quick', model: 'fast-judge', isDefault: true, hasKey: true }], state: 'ok' });
    case 'key_test': return reply({ type: 'key', hasKey: true, ok: true, text: 'The key works.' });
    case 'key_save': return reply({ type: 'key', which: msg.which || 'eleven', hasKey: true, ok: true, text: 'The key works.' });
    case 'reset_check': return reply({ type: 'reset_check', already: window.__already || [] });
    case 'reset': return reply({ type: 'reset', ok: true, settings: window.__settings, sounds: window.__sounds, hasKey: true });
    case 'check_director': return reply({ type: 'check', ok: true, text: 'The Director answered.' });
    case 'check_decisions': return reply({ type: 'check', ok: true, text: 'Ready.' });
    // The kept audio, as the backend keeps it: by fingerprint.
    case 'sound_link': window.__sounds = window.__sounds.concat([{ id: 'l9', name: msg.name || 'a linked sound', triggers: [], source: 'link', url: msg.url, mime: 'audio/mpeg', bytes: 0, added: 9, uses: 0 }]); reply({ type: 'uploaded', ok: true }); return reply({ type: 'sounds', sounds: window.__sounds });
    case 'skip_check': return reply({ type: 'skip_check', bad: /\(a\+\)\+/.test(msg.text) ? ['(a+)+ (a repeat inside a repeat)'] : [], count: 2 });
    case 'clip_get': {
      const c = (window.__clips || {})[msg.sig];
      const r = c ? { type: 'clip', found: true, base64: c.base64, mime: c.mime } : { type: 'clip', found: false };
      // A slow account, for the checks on Getting ready. The most read at
      // once is kept, to see the lines are read side by side.
      if (!window.__clipGetMs) return reply(r);
      window.__clipGetNow = (window.__clipGetNow || 0) + 1;
      window.__clipGetMost = Math.max(window.__clipGetMost || 0, window.__clipGetNow);
      return setTimeout(() => { window.__clipGetNow--; reply(r); }, window.__clipGetMs);
    }
    case 'clip_put': window.__clips = Object.assign(window.__clips || {}, { [msg.sig]: { base64: msg.base64, mime: msg.mime } }); return reply({ type: 'clip_kept', ok: true });
    case 'clips_state': { const c = window.__clips || {}; return reply({ type: 'clips_state', count: Object.keys(c).length, bytes: Object.values(c).reduce((n, x) => n + x.base64.length * 0.75, 0) }); }
    case 'clips_clear': window.__clips = {}; return reply({ type: 'clips_state', ok: true, count: 0, bytes: 0 });
    case 'kept_list': return reply({ type: 'kept_list', list: window.__keptList || [] });
    case 'kept_edit': { const e = (window.__keptList || []).find((x) => x.key === msg.key); if (!e) return reply({ type: 'kept_edited', ok: false }); if (typeof msg.name === 'string') e.name = msg.name; if (typeof msg.folder === 'string') e.folder = msg.folder; return reply({ type: 'kept_edited', ok: true, name: e.name || '', folder: e.folder || '' }); }
    case 'sound_kept': return reply({ type: 'sound', missing: true });
    case 'video_bg_get': return reply({ type: 'video_bg', picture: window.__videoBg || '' });
    case 'video_bg_put': window.__videoBg = msg.picture || ''; return reply({ type: 'video_bg', ok: true, picture: window.__videoBg });
    case 'kept_script': return reply({ type: 'kept_script', script: (window.__keptList || []).some((e) => e.key === msg.key) ? SCRIPT : null });
    case 'sound_play': if (String(msg.id).indexOf('mu-') === 0 && window.__musicB64) return reply({ type: 'sound', base64: window.__musicB64, mime: 'audio/wav' }); return;
    case 'music_for': (window.__musicAsked = window.__musicAsked || []).push(msg.mood); return reply({ type: 'music', id: 'mu-' + msg.mood, url: 'https://example.invalid/' + msg.mood + '.mp3', name: 'A ' + msg.mood + ' track' });
    case 'sound_edit': (window.__soundEdits = window.__soundEdits || []).push(msg); { const e = (window.__sounds || []).find((x) => x.id === msg.id); if (e && typeof msg.mood === 'string') { if (msg.mood) e.mood = msg.mood; else delete e.mood; } } return reply({ type: 'sounds', sounds: window.__sounds });
    case 'kept_drop': (window.__dropped = window.__dropped || []).push(msg); window.__keptList = (window.__keptList || []).filter((e) => e.key !== msg.key); return reply({ type: 'kept_dropped', ok: true, clips: (msg.sigs || []).length });
    default: return;
  }
}
window.__fetch = async (url, init) => {
  const u = String(url);
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/tts-connections?') && window.__ttsList) return json({ data: window.__ttsList, total: window.__ttsList.length });
  if (u.includes('/tts-connections?')) return json({ data: [{ id: 't1', name: 'My ElevenLabs', provider: 'elevenlabs', model: 'eleven_v3', voice: 'v0', is_default: true, has_api_key: true }, { id: 't2', name: 'Fish on the side', provider: 'fish_audio', model: 's2.1-pro', has_api_key: true }, { id: 't3', name: 'Box at home', provider: 'openai_tts', api_url: 'http://192.0.2.10:8004/v1', model: 'chatterbox', has_api_key: true }, { id: 't4', name: 'Old flash', provider: 'elevenlabs', model: 'eleven_flash_v2_5', has_api_key: true }, { id: 't5', name: 'Kokoro here', provider: 'kokoro', has_api_key: true }], total: 5 });
  if (u.includes('/models')) return json({ models: [{ id: 's2.1-pro', label: 'Fish S2.1 Pro' }, { id: 'drama-3-preview', label: 'Drama 3 (Preview)' }], provider: 'fish_audio' });
  if (u.includes('/voices')) return json({ voices: [{ id: 'v1', name: 'Hollow Bell', gender: 'female' }, { id: 'v2', name: 'Grit', gender: 'male' }, { id: 'v3', name: 'Lark', gender: 'female' }], provider: 'elevenlabs' });
  if (u.includes('/chats/chat1?messages=false')) return json({ id: 'chat1', name: 'Mar 3, 2026, 4:12:09 PM', character_id: 'c', metadata: {} });
  // A picture for the character and for one persona, drawn in one color
  // each, so a check can tell which it got.
  const pic = async (color) => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 40, 40); return new Response(await new Promise((r) => c.toBlob(r, 'image/png')), { status: 200, headers: { 'Content-Type': 'image/png' } }); };
  if (u.includes('/characters/c/avatar')) return pic('#2060e0');
  if (u.includes('/personas/p1/avatar')) return pic('#30c060');
  if (u.includes('/characters/summary')) return json({ data: /ysolde/i.test(decodeURIComponent(u)) ? [{ id: 'c', name: 'Ysolde Marrow-Kestrel of the Lower Quays' }] : [], total: 0 });
  if (u.includes('/personas?')) return json({ data: [{ id: 'p1', name: 'Wyn' }], total: 1 });
  if (u.includes('/characters/c')) return json({ id: 'c', name: 'Ysolde Marrow-Kestrel of the Lower Quays' });
  if (u.includes('/settings/voiceSettings')) return json({ key: 'voiceSettings', value: { ttsEnabled: true, ttsAutoPlay: true, ttsConnectionId: 't1' } });
  if (u.includes('/messages')) return json({ data: [{ id: 'm1', name: 'Ysolde Marrow-Kestrel of the Lower Quays', is_user: false, content: 'text', swipe_id: 0 }].concat(window.__moreMessages || []), total: 1 + (window.__moreMessages || []).length });
  if (u.includes('/tts/synthesize') && window.__emptyOnce) { window.__emptyOnce--; window.__emptyAt = (window.__emptyAt || []).concat(Date.now()); return new Response(JSON.stringify({ error: 'Google AI Studio tts synthesize failed: No audio payload in Gemini TTS response' }), { status: 502, headers: { 'Content-Type': 'application/json' } }); }
  if (u.includes('/tts/synthesize')) { window.__synthAt = (window.__synthAt || []).concat(Date.now()); window.__synth = (window.__synth || []).concat(JSON.parse(init.body)); const body = JSON.parse(init.body); return new Response(window.__wav ? window.__makeWav(window.__wav[0], window.__wav[1], (window.__amps || {})[body.voice || '']) : new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }), { status: 200 }); }
  return new Response('{}', { status: 404 });
};
// A real WAV: some seconds of quiet, then some seconds of a tone, so the
// panel can read where the voice is.
window.__makeWav = (quiet, loud, amp = 12000) => {
  const rate = 8000, n = Math.round((quiet + loud) * rate);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const ascii = (o, t) => { for (let k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
  ascii(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ascii(36, 'data'); v.setUint32(40, n * 2, true);
  for (let k = 0; k < n; k++) v.setInt16(44 + k * 2, k < quiet * rate ? 0 : Math.round(amp * Math.sin(k / 3)), true);
  return new Blob([buf], { type: 'audio/wav' });
};
class FakeAudio {
  constructor() { this.dataset = {}; this.volume = 1; this.paused = true; this.at = 0; FakeAudio.all.push(this); }
  get duration() { return (window.__clipMs || 40) / 1000; }
  get currentTime() { return this.paused ? this.at : this.at + (Date.now() - this.t0) / 1000; }
  play() { this.paused = false; this.t0 = Date.now(); window.__played = (window.__played || 0) + 1; clearTimeout(this.t); this.t = setTimeout(() => { this.paused = true; this.onended && this.onended(); }, (window.__clipMs || 40) - this.at * 1000); return Promise.resolve(); }
  pause() { if (!this.paused) this.at = this.currentTime; this.paused = true; clearTimeout(this.t); }
}
FakeAudio.all = [];
window.__Audio = FakeAudio;
window.__ctx = {
  dom: {
    addStyle(css) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styles.push(s); return () => s.remove(); },
    cleanup() {},
  },
  ui: {
    registerDrawerTab(spec) {
      window.__tabSpec = spec;
      const r = document.getElementById('drawer');
      return { root: r, setBadge() {}, activate() {}, destroy() { window.__tabDestroyed = true; }, onActivate() { return () => {}; } };
    },
    showConfirm: async (o) => { window.__asked = (window.__asked || 0) + 1; window.__askedTitle = o && o.title; return { confirmed: !window.__confirmNo }; },
    showContextMenu: async (o) => { window.__menu = o; return { selectedKey: null }; },
    createFloatWidget: (o) => {
      // As Lumiverse draws it: a sized, placed surface, with the root the
      // extension fills inside it.
      const surface = document.createElement('div');
      surface.style.cssText = 'position:fixed;z-index:50;left:' + o.initialPosition.x + 'px;top:' + o.initialPosition.y + 'px;width:' + o.width + 'px;height:' + o.height + 'px';
      const r = document.createElement('div');
      r.setAttribute('data-spindle-extension-root', 'auto_foley');
      surface.appendChild(r);
      document.body.appendChild(surface);
      window.__widget = surface;
      let at = { x: o.initialPosition.x, y: o.initialPosition.y };
      return (window.__floatApi = {
        root: r,
        destroy() { surface.remove(); window.__widgetGone = true; },
        setSize(w, h) { surface.style.width = w + 'px'; surface.style.height = h + 'px'; },
        getPosition() { return at; },
        // Lumiverse draws a move on its next render. A check can ask for that.
        moveTo(x, y) { at = { x, y }; const put = () => { surface.style.left = x + 'px'; surface.style.top = y + 'px'; }; if (window.__lateMove) requestAnimationFrame(() => requestAnimationFrame(put)); else put(); },
      });
    },
  },
  uploads: {
    // A picture asked for gets a small drawn one, so a picture can be chosen.
    pickFile: async (o) => {
      if (!o || !(o.accept || []).some((x) => /image/.test(x))) return [];
      const c = document.createElement('canvas');
      // Red on the left, blue on the right, so a crop that moves can be told
      // from one that does not.
      c.width = 80;
      c.height = 40;
      const g = c.getContext('2d');
      g.fillStyle = '#e02020';
      g.fillRect(0, 0, 40, 40);
      g.fillStyle = '#2040e0';
      g.fillRect(40, 0, 40, 40);
      const b = await new Promise((r) => c.toBlob(r, 'image/png'));
      return [{ name: 'face.png', mimeType: 'image/png', bytes: new Uint8Array(await b.arrayBuffer()) }];
    },
  },
  permissions: { getGranted: async () => ['generation', 'decisions'] },
  events: { on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; } },
  sendToBackend(msg) { window.__sent.push(msg); answer(msg); },
  onBackendMessage(fn) { backendFns.add(fn); return () => backendFns.delete(fn); },
  getActiveChat() { return { chatId: 'chat1', characterId: 'c' }; },
};
window.__counts = () => ({ backend: backendFns.size, listeners: Object.values(listeners).reduce((n, l) => n + l.length, 0) });
window.__emit = (name, p) => (listeners[name] || []).forEach((fn) => fn(p));
`;

// A message row as Lumiverse draws it: the host's own buttons, with an empty
// mount point among them.
function pageHtml(theme) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${HOST_CSS}</style><style>${theme.css}</style>
<style>body{background:${theme.bg};color:var(--lumiverse-text);font-family:system-ui,sans-serif;font-size:14px}
.hostbtn{display:inline-grid;place-items:center;width:30px;height:30px;color:var(--lumiverse-text-muted)} .hostbtn svg{width:16px;height:16px}
#row{display:flex;gap:4px;padding:8px}</style></head>
<body><div id="bar"><button class="hostbtn _barBtn_cd34e_1" title="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/></svg></button><span id="barmount" data-spindle-mount="chat_actions" data-spindle-scope="chat:chat1:actions" style="display:contents"></span></div>
<div data-message-id="m1"><p>A message.</p><div id="row"><button class="hostbtn _actionBtn_ab12c_3" title="Edit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/></svg></button><span id="mount" data-spindle-mount="message_actions" data-spindle-scope="message:m1:actions" style="display:contents"></span></div></div>
<div id="drawer" style="background:var(--lumiverse-bg)"></div></body></html>`;
}

let failures = 0;
let checks = 0;
function check(ok, what) {
  checks++;
  if (!ok) {
    failures++;
    console.log("  FAIL " + what);
  }
}
const only = process.env.UI_ONLY || "";
const section = (name) => !only || name.toLowerCase().includes(only.toLowerCase());

const shots = process.env.UI_SHOTS || "";
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();

async function open(theme, size, zoom = 1, pre = null) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    hasTouch: size.touch,
    isMobile: size.touch,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    else if (process.env.UI_DEBUG && m.type() === "log") console.log("  page: " + m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.setContent(pageHtml(theme));
  if (zoom !== 1) await page.evaluate((z) => (document.documentElement.style.zoom = String(z)), zoom);
  await page.addScriptTag({ content: STUB });
  if (pre) await page.evaluate(pre);
  await page.addScriptTag({ content: SOURCE });
  await page.evaluate(() => {
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio, directWaitMs: window.__directWait });
  });
  await page.waitForTimeout(120);
  return { context, page, errors };
}

async function showTab(page, id) {
  await page.click(`.af-tab[data-tab="${id}"]`);
  await page.waitForTimeout(320);
  // Every closed row opens, so its contents are measured too.
  await page.evaluate(() => document.querySelectorAll('.af-person-head[aria-expanded="false"]').forEach((b) => b.click()));
  await page.waitForTimeout(350);
}

// What is drawn: overflow past the side, tap targets, and contrast measured
// against the nearest painted surface behind each piece of text.
const MEASURE = (touch) => {
  const out = { overflow: [], small: [], contrast: [] };
  const af = document.querySelector('.af');
  const box = af.getBoundingClientRect();
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.overflow.push('page scrolls sideways: ' + document.documentElement.scrollWidth + ' > ' + window.innerWidth);
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const behind = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (base.a < 1) base = over(base, { r: 255, g: 255, b: 255, a: 1 });
    for (let k = layers.length - 1; k >= 0; k--) base = over(layers[k], base);
    return base;
  };
  for (const el of af.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    if (el.closest('.af-sub') && el.closest('.af-sub').hidden) continue;
    const name = (el.className && String(el.className)) || el.tagName;
    if (r.right > box.right + 1.5 || r.left < box.left - 1.5) out.overflow.push(name + ' runs off the side (' + Math.round(r.left) + '..' + Math.round(r.right) + ' in ' + Math.round(box.left) + '..' + Math.round(box.right) + ')');
    const tappable = el.matches('button, select, input, .af-box');
    if (touch && tappable && r.height < 32) out.small.push(name + ' is ' + Math.round(r.height) + 'px tall');
    const ownText = Array.prototype.some.call(el.childNodes, (n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = behind(el);
    const col = over(fg, bg);
    const L1 = lum(col), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const disabled = el.closest('button:disabled');
    const floor = disabled ? 1.5 : 3;
    if (ratio < floor) out.contrast.push(name + ' "' + el.textContent.trim().slice(0, 30) + '" is ' + ratio.toFixed(2) + ':1');
  }
  return out;
};

if (section("layout")) {
  console.log("Every tab, at phone and laptop widths, on dark, light and a hostile theme");
  for (const theme of THEMES) {
    for (const size of SIZES) {
      const { context, page, errors } = await open(theme, size);
      // A message is performed first, so the Stage has a script to measure.
      await page.click('#mount [data-af-slot="message"]');
      await page.waitForTimeout(900);
      for (const id of TABS) {
        await showTab(page, id);
        const m = await page.evaluate(MEASURE, size.touch);
        const where = theme.name + ", " + size.name + ", " + id;
        check(!m.overflow.length, where + ": nothing runs off the side. " + m.overflow.slice(0, 3).join("; "));
        check(!m.small.length, where + ": tap targets are at least 32px. " + m.small.slice(0, 3).join("; "));
        check(!m.contrast.length, where + ": text is readable. " + m.contrast.slice(0, 3).join("; "));
        if (shots && theme.name !== "hostile light") await page.screenshot({ path: join(shots, `${theme.name}-${size.name}-${id}.png`), fullPage: true });
      }
      check(!errors.length, theme.name + ", " + size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
      await context.close();
    }
  }
}

if (section("scale")) {
  console.log("UI Scale at 85%, 100% and 125%");
  for (const zoom of [0.85, 1, 1.25]) {
    for (const size of SIZES) {
      const { context, page } = await open(THEMES[0], size, zoom);
      for (const id of TABS) {
        await showTab(page, id);
        const m = await page.evaluate(MEASURE, false);
        check(!m.overflow.length, "zoom " + zoom + ", " + size.name + ", " + id + ": nothing runs off the side. " + m.overflow.slice(0, 2).join("; "));
      }
      await context.close();
    }
  }
}

if (section("perform")) {
  console.log("Performing a message from its button");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  const btn = page.locator('#mount [data-af-slot="message"]');
  check((await btn.count()) === 1, "the message gets one Auto Foley button");
  check((await btn.getAttribute("class")).includes("_actionBtn_ab12c_3"), "the button wears the host button's class");
  check((await page.evaluate(() => document.querySelector('#mount [data-af-slot="message"] svg').getAttribute("width"))) === "16", "its icon is the host icon's size");
  await btn.click();
  await page.waitForTimeout(150);
  check((await page.evaluate(() => window.__sent.some((m) => m.type === "direct" && m.messageId === "m1" && m.chatId === "chat1"))), "the message is sent to be directed, with its chat");
  check((await page.locator('[data-af="parts"] [data-at]').count()) >= 3, "Now playing has a mark for each part of the message");
  check((await page.locator('[data-af="parts"] [data-k="sound"]').count()) === 1, "a separate sound effect has a mark of its own");
  check((await page.locator(".af-script, .af-line").count()) === 0, "there is no script list beside Now playing");
  check(((await page.locator('[data-af="used"]').textContent()) || "").includes("1,840 input tokens and 212 output tokens"), "Now playing says how many input and output tokens the script used");
  check(!((await page.locator('[data-af="used"]').textContent()) || "").includes("Cost"), "with no prices set, no cost is shown");
  await page.waitForTimeout(700);
  const synth = await page.evaluate(() => window.__synth || []);
  check(synth.length >= 2, "lines are spoken through Lumiverse's TTS route (" + synth.length + ")");
  const ys = synth.find((b) => /You are late/.test(b.text));
  check(ys && ys.voice === "v1" && ys.model === "eleven_v3" && ys.connectionId === "t1", "a line goes out with its speaker's voice, model and the ElevenLabs connection");
  check(ys && ys.text.includes("[flatly]") && ys.text.includes("[sound of"), "a v3 line keeps its tags");
  check(ys && ys.parameters.stability === 0, "a big moment on v3 steps stability down from Natural to Creative");
  const ferry = synth.find((b) => /tide/.test(b.text));
  check(ferry && ferry.voice && ferry.voice !== "v1", "someone the AI added gets a voice nobody else uses (" + (ferry && ferry.voice) + ")");
  const played = await page.evaluate(() => window.__played || 0);
  check(played >= 4, "every part plays, voices and sounds (" + played + ")");
  check((await page.locator('[data-af="sub"]').textContent()).includes("Finished") || (await page.locator('[data-af="title"]').textContent()).length > 0, "the status line says where it is");
  // Each clip lasts long enough here for the second press to land mid-play.
  await page.evaluate(() => (window.__clipMs = 600));
  await btn.click();
  await page.waitForTimeout(80);
  check((await btn.getAttribute("aria-busy")) === "true", "the button shows the message is playing");
  await btn.click();
  await page.waitForTimeout(80);
  check((await btn.getAttribute("aria-busy")) === null, "pressing it again stops it");
  await page.evaluate(() => (window.__clipMs = 40));
  check(!errors.length, "no console errors while performing. " + errors.slice(0, 2).join("; "));

  console.log("The audience");
  await page.evaluate(() => {
    window.__played = 0;
  });
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-af-row="applauseOn"] .af-box').click());
  await page.waitForTimeout(350);
  check((await page.locator('[data-af-row="applauseForUser"]').count()) === 1, "Cheer for you sits under Applause once it is on");
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => (window.__clipMs = 120));
  await btn.click();
  let sawCheer = false;
  for (let k = 0; k < 40 && !sawCheer; k++) {
    await page.waitForTimeout(50);
    sawCheer = (await page.locator('.af-cue:has-text("The audience cheers")').count()) > 0;
  }
  check(sawCheer, "after the message, the audience cheers, and the subtitles say so");
  await page.waitForTimeout(400);
  await page.evaluate(() => (window.__clipMs = 40));
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-af-row="applauseOn"] .af-box').click());
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(250);

  console.log("A message edited while it plays");
  await btn.click();
  await page.waitForTimeout(120);
  const directsBefore = await page.evaluate(() => window.__sent.filter((m) => m.type === "direct").length);
  await page.evaluate(() => window.__emit("MESSAGE_EDITED", { chatId: "chat1", message: { id: "m1", content: "A rewritten reply." } }));
  await page.waitForTimeout(30);
  check((await btn.getAttribute("aria-busy")) === "true", "it starts again at once");
  await page.waitForTimeout(170);
  const directsAfter = await page.evaluate(() => window.__sent.filter((m) => m.type === "direct").length);
  check(directsAfter === directsBefore + 1, "an edit to the playing message directs it again (" + directsBefore + " then " + directsAfter + ")");
  await page.evaluate(() => window.__emit("MESSAGE_EDITED", { chatId: "chat1", message: { id: "m9", content: "x" } }));
  await page.waitForTimeout(100);
  check((await page.evaluate(() => window.__sent.filter((m) => m.type === "direct").length)) === directsAfter, "an edit to a message it never read does nothing");
  await page.waitForTimeout(900);

  console.log("Narration skipped, and a muted speaker");
  await page.evaluate(() => {
    window.__synth = [];
  });
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  await page.click('.af-segbtn[data-v="skip"]');
  await page.waitForTimeout(500);
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(250);
  await page.click('[data-af="parts"] [data-at] >> nth=0');
  await page.waitForTimeout(500);
  const s2 = await page.evaluate(() => window.__synth || []);
  check(!s2.some((b) => /set the cup down/.test(b.text)), "narration is not spoken when it is skipped");

  console.log("Switches open and close what sits under them");
  await page.click('.af-tab[data-tab="director"]');
  await page.waitForTimeout(250);
  const subOf = () => page.evaluate(() => {
    const wrap = document.querySelector('[data-af-row="soundsOn"]');
    const box = wrap && wrap.querySelector(':scope > .af-sub');
    return box ? { hidden: box.hidden, h: box.getBoundingClientRect().height } : null;
  });
  const before = await subOf();
  check(before && !before.hidden && before.h > 20, "the rows under Sounds show while it is on");
  await page.evaluate(() => document.querySelector('[data-af-row="soundsOn"] .af-box').click());
  await page.waitForTimeout(90);
  const mid = await subOf();
  check(mid && !mid.hidden && mid.h > 0 && mid.h < before.h, "they close over several frames (" + (mid && Math.round(mid.h)) + "px part way)");
  await page.waitForTimeout(300);
  const after = await subOf();
  check(after && after.hidden, "and are hidden once closed");

  console.log("Debug info");
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  await page.locator('.af-btn:has-text("Build preview")').click();
  await page.waitForTimeout(150);
  const report = await page.locator('textarea[aria-label="Debug info"]').inputValue();
  check(report.startsWith("Auto Foley v"), "the report says which version it is from");
  check(report.includes("cors_proxy = MISSING"), "a missing permission is named");
  check(!/Ysolde|Ferryman|Wyn/.test(report), "no cast name is in the report");
  check(report.includes("[npc 1] now has the voice"), "a Log line that names someone uses their role instead");
  check(!report.includes("You are late"), "no message text is in the report");
  await page.evaluate(() => Array.from(document.querySelectorAll('.af-between')).find((r) => r.textContent.startsWith('The last script')).querySelector('.af-box').click());
  await page.locator('.af-btn:has-text("Build preview")').click();
  await page.waitForTimeout(150);
  check(!(await page.locator('textarea[aria-label="Debug info"]').inputValue()).includes("recent activity"), "an unticked part is left out");

  console.log("Chat, buttons and hints");
  check((await page.locator('[data-af="chatline"]').textContent()).includes("Chat with Ysolde"), "the panel says which chat is open");
  check((await page.locator('#barmount [data-af-slot="bar"]').count()) === 1, "the chat's own row gets a button for the newest reply");
  check(((await page.locator('#barmount [data-af-slot="bar"]').getAttribute("class")) || "").includes("_barBtn_cd34e_1"), "and it wears that row's button class");
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  // Scrolled into view first: a scroll closes a description, and Playwright
  // scrolls just before it clicks.
  const q = page.locator('[data-af-row="autoplay"] > .af-between .af-q');
  await q.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await q.click();
  await page.waitForTimeout(200);
  check((await page.locator(".af-hint[data-af-open]").count()) === 1, "a ? opens its description");
  check((await page.locator(".af-hint").textContent()).includes("Off by default"), "and the description says the default");
  await page.mouse.click(5, 5);
  await page.waitForTimeout(250);
  check((await page.locator(".af-hint").count()) === 0, "a tap elsewhere closes it");

  console.log("Expand");
  await page.click('.af-tab[data-tab="director"]');
  await page.waitForTimeout(250);
  await page.locator('.af-card:has(textarea.af-tall) .af-btn:has-text("Expand")').click();
  await page.waitForTimeout(250);
  check((await page.locator(".af-bigbox textarea").count()) === 1, "Expand opens the text at full size");
  await page.locator(".af-bigbox textarea").fill("<my_prompt>Tag lightly.</my_prompt>");
  await page.locator('.af-bigbox .af-btn:has-text("Done")').click();
  await page.waitForTimeout(600);
  check((await page.evaluate(() => window.__settings.prompt)) === "<my_prompt>Tag lightly.</my_prompt>", "Done writes the text back and saves it");
  check((await page.locator(".af-over").count()) === 0, "and the big editor closes");

  console.log("Look and the floating player");
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('.af-col')).find((c) => c.textContent.startsWith('Pattern behind the panel'));
    const sel = s.querySelector('select');
    sel.value = 'stars';
    sel.dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(250);
  check((await page.evaluate(() => document.querySelector(".af").getAttribute("data-af-pattern"))) === "stars", "a pattern can be put behind the panel");
  check((await page.locator('.af-col:has-text("How solid the boxes are")').count()) > 0, "and How solid the boxes are shows under it");
  await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
  await page.waitForTimeout(250);
  check(await page.evaluate(() => !!window.__widget && !!window.__widget.querySelector(".af-float")), "the floating player appears, closed, as a round button");

  console.log("Teardown");
  await page.evaluate(() => window.__teardown());
  const left = await page.evaluate(() => ({
    root: !!document.querySelector(".af"),
    btn: !!document.querySelector("[data-af-slot]"),
    counts: window.__counts(),
    tab: !!window.__tabDestroyed,
    deco: !document.querySelector('[data-af-slot]') && !document.querySelector('.af-slot-row'),
    style: Array.from(document.querySelectorAll("style")).some((s) => s.textContent.includes(".af-tabs")),
  }));
  check(!left.root && !left.btn && !left.style, "nothing of the panel is left on the page");
  check(left.counts.backend === 0 && left.counts.listeners === 0, "every listener is gone (" + JSON.stringify(left.counts) + ")");
  check(left.tab && left.deco, "the drawer tab and every button on the page are handed back");
  await context.close();
}


if (section("no stuck hover")) {
  console.log("On a phone, a button tapped off is not left lit");
  const size = SIZES[0];
  const { context, page, errors } = await open(THEMES[0], size);
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__widget.querySelector(".af-float").click());
  await page.waitForTimeout(400);
  const prep = page.locator('[data-p="prep"]');
  const look = () => page.evaluate(() => { const b = window.__widget.querySelector('[data-p="prep"]'); const c = getComputedStyle(b); return { pressed: b.getAttribute("aria-pressed"), bg: c.backgroundColor }; });
  const was = await look();
  await prep.tap();
  await page.waitForTimeout(200);
  const on = await look();
  await prep.tap();
  await page.waitForTimeout(300);
  const off = await look();
  check(on.pressed !== was.pressed && off.pressed === was.pressed, "the button turns on and off (" + [was.pressed, on.pressed, off.pressed].join(" ") + ")");
  check(off.bg === was.bg, "tapped off, it looks as it did before it was turned on (" + was.bg + " then " + off.bg + ")");
  // A real phone keeps :hover on the last thing tapped, which the test
  // browser does not copy. So the rule is read: every hover style of Auto
  // Foley's sits inside @media (hover: hover), where a phone never uses it.
  const loose = await page.evaluate(() => {
    const out = [];
    const walk = (rules, inHover) => {
      for (const r of rules) {
        if (r.cssRules && r.media) walk(r.cssRules, inHover || /hover:\s*hover/.test(r.media.mediaText));
        else if (r.selectorText && /:hover/.test(r.selectorText) && /\.af-/.test(r.selectorText) && !inHover) out.push(r.selectorText);
      }
    };
    for (const sh of document.styleSheets) {
      try { walk(sh.cssRules, false); } catch (_) {}
    }
    return out;
  });
  check(!loose.length, "every hover color is only for a device that hovers (" + loose.slice(0, 4).join(" | ") + ")");
  check(!errors.length, "no errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("lumiverse pictures")) {
  console.log("Pictures for the cast from their characters and personas in Lumiverse");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    await page.click("[data-af-lvpics]");
    await page.waitForTimeout(1200);
    const said = await page.locator("[data-af-lvpicsaid]").textContent().catch(() => "");
    check(/Pictures added for 2 of 3/.test(said), where + ": it fills the people Lumiverse has, and says who it could not (" + said + ")");
    const colors = await page.evaluate(async () => {
      const at = async (url) => { if (!url) return ""; const i = new Image(); await new Promise((r) => { i.onload = r; i.src = url; }); const c = document.createElement("canvas"); c.width = 4; c.height = 4; c.getContext("2d").drawImage(i, 0, 0, 4, 4); const d = c.getContext("2d").getImageData(2, 2, 1, 1).data; return d[2] > 150 && d[1] < 140 ? "blue" : d[1] > 150 ? "green" : "other"; };
      const cast = window.__settings.cast;
      return { a: await at(cast[1].picture), b: cast[2].picture ? "some" : "", c: await at(cast[3].picture) };
    });
    check(colors.a === "blue" && colors.c === "green" && colors.b === "", where + ": the character gets the character's picture, the persona the persona's, and nobody else one (" + JSON.stringify(colors) + ")");
    await page.click("[data-af-lvpics]");
    await page.waitForTimeout(800);
    check(/Pictures added for 0 of 1/.test(await page.locator("[data-af-lvpicsaid]").textContent()), where + ": a picture already there is kept, and only the one without is tried again");
    // One person, from their card.
    const card = page.locator('.af-person[data-person="b"]');
    await card.locator(".af-person-head").click();
    await page.waitForTimeout(400);
    await card.locator("[data-af-lvpic]").click();
    await page.waitForTimeout(800);
    check(/No character or persona in Lumiverse has this name/.test(await card.textContent()), where + ": someone with no picture in Lumiverse is told so on their card");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the buttons fit. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, where + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("saved looks")) {
  console.log("A video look can be saved under a name, used, renamed and deleted");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(500);
    await page.locator(".af-fold", { hasText: /^▶?\s*Saved looks$/ }).click();
    await page.waitForTimeout(300);
    // A look of its own: Typewriter, tall.
    await page.evaluate(() => { window.__settings.videoFont = "type"; });
    await page.evaluate(() => {});
    await page.locator(".af-fold", { hasText: /^▶?\s*Shape and words$/ }).click();
    await page.waitForTimeout(300);
    await page.selectOption('[data-af-card="studio-video"] select >> nth=0', "tall");
    await page.waitForTimeout(300);
    await page.fill("[data-af-lookname]", "Noir");
    await page.click("[data-af-looksave]");
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => window.__settings.videoLooks);
    check(saved.length === 1 && saved[0].name === "Noir" && saved[0].look.videoShape === "tall", where + ": Save this look keeps the look under its name (" + JSON.stringify(saved.map((l) => [l.name, l.look.videoShape])) + ")");
    check(!("videoNames" in saved[0].look) && !("videoNotes" in saved[0].look), where + ": names and notes are not part of a look");
    // Change the shape, then use the look again.
    await page.selectOption('[data-af-card="studio-video"] select >> nth=0', "square");
    await page.waitForTimeout(300);
    await page.click("[data-af-lookuse]");
    await page.waitForTimeout(600);
    check(await page.evaluate(() => window.__settings.videoShape === "tall"), where + ": Use puts the look back");
    // Put the look back asks first, then puts the built-in look back. The
    // saved look stays.
    const asked = await page.evaluate(() => window.__asked || 0);
    await page.click('[data-af-studio="lookback"]');
    await page.waitForTimeout(600);
    check((await page.evaluate(() => window.__asked || 0)) === asked + 1, where + ": Put the look back asks first");
    check(await page.evaluate(() => window.__settings.videoShape === "wide" && window.__settings.videoLooks.length === 1), where + ": then puts the built-in look back, and the saved look stays");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the saved looks fit. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, where + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("smooth close")) {
  console.log("Who is voiced closes to the end with no jump in the last frame");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__widget.querySelector(".af-float").click());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__widget.querySelector('[data-p="fold"]').click());
    await page.waitForTimeout(800);
    // The player's height on every frame as it closes. The gap above the
    // list goes with it, so the last step is as small as the ones before.
    const steps = await page.evaluate(async () => {
      const card = window.__widget.querySelector(".af-pl");
      const hs = [];
      window.__widget.querySelector('[data-p="fold"]').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 500) {
        await new Promise((r) => requestAnimationFrame(r));
        hs.push(card.getBoundingClientRect().height);
      }
      return hs.slice(1).map((h, i) => hs[i] - h).filter((d) => Math.abs(d) > 0.5);
    });
    const last = steps.length ? steps[steps.length - 1] : 0;
    check(steps.length > 4 && last <= 6, size.name + ": it closes over several frames, and the last step is a small one (" + steps.map((x) => x.toFixed(0)).join(",") + ")");
    check(!errors.length, size.name + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("find someone")) {
  console.log("Find someone lists only the people who match, for a large cast");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    const cards = () => page.evaluate(() => [...document.querySelectorAll(".af-person")].map((c) => c.dataset.person));
    const all = await cards();
    await page.fill("[data-af-castfind]", "FERRY");
    await page.waitForTimeout(500);
    const got = await cards();
    check(got.join() === "b", where + ": typing part of a name lists only who matches, in any case (" + got.join() + ")");
    check(/1 of 4 people match/.test(await page.locator("[data-af-castfound]").textContent()), where + ": and says how many match");
    check(await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-af-castfind")), where + ": the box keeps the typing");
    const box = await page.evaluate(() => {
      const f = document.querySelector("[data-af-castfind]");
      const c = getComputedStyle(f);
      // The x is drawn by a rule the test browser does not report on the
      // element, so the rule itself is looked for.
      let x = "";
      for (const sh of document.styleSheets) {
        try {
          for (const r of sh.cssRules) if (r.selectorText && /search-cancel-button/.test(r.selectorText) && /\.af-field/.test(r.selectorText) && r.style) x = r.style.webkitMaskImage || r.style.maskImage || x;
        } catch (_) {}
      }
      return { shadow: c.boxShadow, border: c.borderColor, x };
    });
    const quiet = await page.evaluate(() => { const f = document.createElement("input"); f.className = "af-field"; document.querySelector(".af").appendChild(f); const b = getComputedStyle(f).borderColor; f.remove(); return b; });
    check(box.shadow === "none" && box.border === quiet, where + ": focused, the box has no highlight (" + box.shadow + ", " + box.border + " vs " + quiet + ")");
    check(/svg/.test(box.x), where + ": it has the same x as Auto Retry and Auto Refine to clear it");
    if (shots) await page.locator("[data-af-castfind]").screenshot({ path: shots + "/castfind-" + where + ".png" });
    check(await page.evaluate(() => [...document.querySelectorAll(".af-grip")].every((g) => getComputedStyle(g).display === "none")), where + ": people cannot be moved while it lists them");
    await page.fill("[data-af-castfind]", "zzz");
    await page.waitForTimeout(500);
    check((await cards()).length === 0 && /Nobody in the cast matches/.test(await page.locator("[data-af-castfound]").textContent()), where + ": no match says so");
    await page.fill("[data-af-castfind]", "");
    await page.waitForTimeout(500);
    check((await cards()).join() === all.join(), where + ": an empty box shows everyone again");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the box fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, where + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("voice call")) {
  console.log("Who is voiced looks like a voice call: a green ring while speaking, red when not voiced");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.__wav = [0.2, 3]; window.__clipMs = 6000; window.__widget.querySelector(".af-float").click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__widget.querySelector('[data-p="fold"]').click());
    await page.waitForTimeout(500);
    const rows = () =>
      page.evaluate(() =>
        [...window.__widget.querySelectorAll(".af-pl-ch")].filter((ch) => !ch.closest("[hidden]")).map((ch) => ({
          id: ch.dataset.person,
          speaking: ch.dataset.speaking,
          off: ch.dataset.off,
          state: ch.querySelector(".af-pl-state").textContent,
          ring: getComputedStyle(ch.querySelector(".af-avatar")).boxShadow,
          badge: getComputedStyle(ch.querySelector(".af-pl-badge")).display,
        })),
      );
    const quiet = await rows();
    const quietMore = await page.evaluate(() => !!window.__widget.querySelector('[data-p="more"]'));
    check(quiet.length > 1 && quiet.every((r) => r.speaking === "false" && !/rgb\(34, 197, 94\)/.test(r.ring)), where + ": with nothing playing, nobody has a ring");
    check(quiet.every((r) => r.state && r.state !== "Speaking"), where + ": each name has a line under it saying what kind of part it is (" + quiet.map((r) => r.state).join(", ") + ")");
    await page.evaluate(() => window.__widget.querySelector('[data-p="play"]').click());
    await page.waitForTimeout(1500);
    const live = await rows();
    // The people in the message come first, in the order they speak, and the
    // rest of the cast is behind one fold.
    check(quiet.length === 4 && !quietMore, where + ": with no message yet, everyone is listed");
    const order = live.map((r) => r.id).join(",");
    const more = await page.evaluate(() => { const b = window.__widget.querySelector('[data-p="more"]'); return b ? b.textContent : ""; });
    check(order === "n,a,b" && /Everyone else \(1\)/.test(more), where + ": during a message, its people are listed in the order they speak, with Everyone else (1) under them (" + order + " | " + more + ")");
    const grow = await page.evaluate(async () => {
      window.__widget.querySelector('[data-p="more"]').click();
      await new Promise((r) => setTimeout(r, 90));
      const mid = window.__widget.querySelector('[data-p="rest"]').getBoundingClientRect().height;
      await new Promise((r) => setTimeout(r, 600));
      return [mid, window.__widget.querySelector('[data-p="rest"]').getBoundingClientRect().height];
    });
    check(grow[0] > 0 && grow[0] < grow[1], where + ": Everyone else opens over several frames (" + grow.map((x) => x.toFixed(1)).join(" of ") + " px)");
    check((await rows()).map((r) => r.id).join(",") === "n,a,b,c", where + ": and shows the rest of the cast");
    const look = await page.evaluate(() => ({
      caret: getComputedStyle(window.__widget.querySelector('[data-p="more"] .af-caret')).transform,
      text: window.__widget.querySelector('[data-p="more"] .af-caret').textContent,
      list: getComputedStyle(window.__widget.querySelector(".af-pl-cast")).overflowY,
      bar: getComputedStyle(window.__widget.querySelector(".af-pl")).scrollbarWidth,
    }));
    // ▶ turned a quarter turn is ▼, so an open fold points down.
    check(look.text === "▶" && /matrix\(6\.\d+e-17, 1, -1, 6\.\d+e-17|matrix\(0, 1, -1, 0/.test(look.caret), where + ": open, its arrow points down, as on every fold (" + look.caret + ")");
    check(look.list === "visible" && look.bar === "none", where + ": the list has no scroll box of its own, and the player draws no scroll bar (" + look.list + ", " + look.bar + ")");
    // With the whole cast open the player is taller than the screen. Nothing
    // in it is squeezed: each part is as tall as what it holds.
    const squeezed = await page.evaluate(() => [...window.__widget.querySelectorAll(".af-pl > *")].filter((n) => !n.hidden && getComputedStyle(n).display !== "none" && n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflowY !== "visible").map((n) => n.className + " " + n.clientHeight + "/" + n.scrollHeight));
    check(!squeezed.length, where + ": no part of the player is squeezed to fit (" + squeezed.join(" | ") + ")");
    const seg = await page.evaluate(() => { const b = window.__widget.querySelector('.af-pl .af-seg .af-segbtn'); return b.scrollHeight <= b.clientHeight + 1 && b.getBoundingClientRect().height >= 28; });
    check(seg, where + ": Latest reply and My latest message keep their full height");
    await page.evaluate(() => window.__widget.querySelector('[data-p="more"]').click());
    await page.waitForTimeout(600);
    check((await rows()).map((r) => r.id).join(",") === "n,a,b", where + ": pressed again, it closes");
    const on = live.filter((r) => r.speaking === "true");
    check(on.length === 1 && on[0].state === "Speaking", where + ": the person speaking is marked, and says Speaking (" + JSON.stringify(on.map((r) => r.id)) + ")");
    check(on.length === 1 && /rgb\(34, 197, 94\)/.test(on[0].ring), where + ": with a green ring (" + (on[0] && on[0].ring) + ")");
    check(live.filter((r) => r.speaking === "false").every((r) => !/rgb\(34, 197, 94\)/.test(r.ring)), where + ": and nobody else has one");
    if (shots) await page.locator('[data-p="cast"]').screenshot({ path: shots + "/voice-call-" + where + ".png" });
    // Paused, nobody is speaking.
    await page.evaluate(() => window.__widget.querySelector('[data-p="play"]').click());
    await page.waitForTimeout(500);
    check((await rows()).every((r) => r.speaking === "false"), where + ": paused, the ring goes");
    // Not voiced: a red mic on the picture, and the words say so.
    await page.evaluate(() => window.__widget.querySelectorAll(".af-pl-ch .af-round")[1].click());
    await page.waitForTimeout(300);
    const muted = (await rows())[1];
    check(muted.off === "true" && muted.state === "Not voiced" && muted.badge === "grid", where + ": someone not voiced has a red mic on their picture and says Not voiced (" + JSON.stringify(muted) + ")");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length, where + ": the list fits. " + m.overflow.slice(0, 2).join("; "));
    check(!errors.length, where + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("video edges")) {
  console.log("Darken the edges of a video, or leave them as they are");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.click('.af-tab[data-tab="studio"]');
  await page.waitForTimeout(600);
  await page.locator(".af-fold", { hasText: /^▶?\s*Background$/ }).click();
  await page.waitForTimeout(300);
  const corner = () => page.evaluate(() => { const d = document.querySelector("[data-af-videopreview]").getContext("2d").getImageData(20, 20, 1, 1).data; return d[0] + d[1] + d[2]; });
  const set = async (v) => {
    await page.evaluate((v) => { const r = document.querySelector('[data-af-row="videoEdges"] input[type="range"]'); r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true })); }, v);
    await page.waitForTimeout(500);
  };
  const half = await corner();
  await set(0);
  const none = await corner();
  await set(100);
  const full = await corner();
  check(none > half && half > full, "the corners are darkest at 100, lighter at 50, and lightest when off (" + [full, half, none].join(", ") + ")");
  check(await page.evaluate(() => window.__settings.videoEdges === 100), "and the choice is saved");
  // A color of their own: the corner takes it on.
  await page.locator('[data-af-colorswatch="videoEdgeColor"]').click();
  await page.waitForTimeout(300);
  await page.fill('[data-af-colorcode="videoEdgeColor"]', "#c02040");
  await page.locator('[data-af-colorcode="videoEdgeColor"]').dispatchEvent("change");
  await page.waitForTimeout(600);
  const tint = await page.evaluate(() => { const d = document.querySelector("[data-af-videopreview]").getContext("2d").getImageData(20, 20, 1, 1).data; return [d[0], d[1], d[2]]; });
  check(tint[0] > tint[1] + 40 && tint[0] > tint[2] + 20, "Color of the edges colors the edges (" + tint.join(",") + ")");
  check(await page.evaluate(() => window.__settings.videoEdgeColor === "#c02040"), "and is saved");
  check(!errors.length, "no errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("on air")) {
  console.log("The On air light and the script page");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.__wav = [0.2, 3]; window.__clipMs = 6000; window.__widget.querySelector(".af-float").click(); });
    await page.waitForTimeout(500);
    const air = () => page.evaluate(() => Array.from(document.querySelectorAll(".af-air")).map((a) => a.dataset.on));
    check((await air()).every((x) => x === "off"), where + ": the light is dim before anything plays");
    await page.evaluate(() => window.__widget.querySelector('[data-p="play"]').click());
    await page.waitForTimeout(1500);
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(400);
    const lit = await air();
    check(lit.length === 2 && lit.every((x) => x === "on"), where + ": the light is on in the player and on the Stage while it plays (" + lit.join(",") + ")");
    const page1 = await page.evaluate(() => ({
      rule: getComputedStyle(window.__widget.querySelector('[data-p="said"]')).borderLeftWidth,
      who: window.__widget.querySelector('[data-p="said"]').dataset.who,
      cap: window.__widget.querySelector('[data-p="cap"]').textContent,
      capFits: (() => { const c = window.__widget.querySelector('[data-p="cap"]'); return c.scrollWidth <= c.clientWidth + 1 && c.getBoundingClientRect().height < 16; })(),
    }));
    check(page1.rule === "3px" && page1.who === "narrator", where + ": the line has a margin rule in the speaker's color (" + JSON.stringify(page1) + ")");
    check(/^Part 1 of \d+$/.test(page1.cap) && page1.capFits, where + ": the part count fits on one line beside the light (" + page1.cap + ")");
    await page.evaluate(() => window.__widget.querySelector('[data-p="play"]').click());
    await page.waitForTimeout(400);
    check((await air()).every((x) => x === "paused"), where + ": the light turns amber while paused");
    await page.evaluate(() => window.__widget.querySelector('[data-p="stop"]').click());
    await page.waitForTimeout(400);
    check((await air()).every((x) => x === "off"), where + ": the light goes dim when it stops");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length, where + ": nothing runs off the side. " + m.overflow.slice(0, 2).join("; "));
    check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("player")) {
  console.log("The floating player");
  for (const size of SIZES) {
    for (const zoom of [0.85, 1, 1.25]) {
      const { context, page, errors } = await open(THEMES[0], size, zoom);
      const where = size.name + ", zoom " + zoom;
      await page.click('.af-tab[data-tab="settings"]');
      await page.waitForTimeout(200);
      await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
      await page.waitForTimeout(250);
      const moving = await page.evaluate(() => {
        window.__widget.querySelector(".af-float").click();
        const card = window.__widget.querySelector(".af-pl");
        return !!card && card.getAnimations().some((x) => /circle/.test(JSON.stringify(x.effect.getKeyframes())));
      });
      check(moving, where + ": the player opens out of the round button as a growing circle");
      await page.waitForTimeout(400);
      check(await page.evaluate(() => !!window.__widget.querySelector(".af-pl")), where + ": a tap opens the player");
      const fit = await page.evaluate(() => {
        const w = window.__widget.getBoundingClientRect();
        const c = window.__widget.querySelector(".af-pl").getBoundingClientRect();
        return { w: w.width, h: w.height, cw: c.width, ch: c.height, right: w.right, vw: window.innerWidth };
      });
      check(fit.h + 0.5 >= fit.ch && fit.right <= fit.vw + 0.5, where + ": the widget holds the whole card and stays on screen (" + JSON.stringify(fit) + ")");
      if (size.touch) {
        const small = await page.evaluate(() => Array.from(window.__widget.querySelectorAll("button")).filter((b) => b.getBoundingClientRect().height && b.getBoundingClientRect().height / (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) < 32).map((b) => (b.getAttribute("aria-label") || b.textContent) + " " + Math.round(b.getBoundingClientRect().height)));
        check(!small.length, where + ": the player's tap targets are at least 32px. " + small.slice(0, 3).join("; "));
      }
      const before = await page.evaluate(() => (window.__sent || []).filter((m) => m.type === "direct").length);
      // Long clips, so the message is still playing when the strip is read.
      await page.evaluate(() => (window.__clipMs = 4000));
      await page.evaluate(() => window.__widget.querySelector('[data-p="play"]').click());
      await page.waitForTimeout(600);
      check((await page.evaluate(() => (window.__sent || []).filter((m) => m.type === "direct").length)) > before, where + ": Play performs the latest reply");
      const prep = await page.evaluate(async () => {
        const b = window.__widget.querySelector('[data-p="prep"]');
        const was = b.getAttribute("aria-pressed");
        b.click();
        await new Promise((r) => setTimeout(r, 30));
        const mid = b.getAttribute("aria-pressed");
        b.click();
        await new Promise((r) => setTimeout(r, 30));
        return [was, mid, b.getAttribute("aria-pressed")];
      });
      check(prep[0] !== prep[1] && prep[2] === prep[0], where + ": Prepare replies ahead switches over and back again from the player (" + prep.join() + ")");
      const chip = await page.evaluate(async () => {
        const b = window.__widget.querySelector('[data-sw="soundsOn"]');
        const was = b.checked;
        b.click();
        await new Promise((r) => setTimeout(r, 50));
        return [was, b.checked, window.__settings.soundsOn];
      });
      check(chip[0] === true && chip[1] === false, where + ": a quick switch is the panel's own switch, and turns its setting off");
      const fmid = await page.evaluate(async () => {
        window.__widget.querySelector('[data-p="fold"]').click();
        await new Promise((r) => setTimeout(r, 120));
        return window.__widget.querySelector('[data-p="cast"]').getBoundingClientRect().height;
      });
      await page.waitForTimeout(500);
      const fend = await page.evaluate(() => window.__widget.querySelector('[data-p="cast"]').getBoundingClientRect().height);
      check(fmid > 0 && fmid < fend, where + ": Who is voiced opens over several frames (" + fmid.toFixed(1) + " of " + fend.toFixed(1) + " px)");
      const lv = await page.evaluate(() => {
        const w = window.__widget.getBoundingClientRect();
        const c = window.__widget.querySelector(".af-pl").getBoundingClientRect();
        return { n: window.__widget.querySelectorAll(".af-pl-ch").length, fits: w.height + 0.5 >= c.height };
      });
      check(lv.n > 0 && lv.fits, where + ": Who is voiced lists the cast, and the widget grows with it (" + JSON.stringify(lv) + ")");
      const strip = await page.evaluate(() => window.__widget.querySelectorAll('[data-p="strip"] [data-at]').length);
      check(strip > 0, where + ": the strip has a mark for each part of the message (" + strip + ")");
      if (zoom === 1 && shots) {
        await page.evaluate(() => (window.__widget.style.zIndex = "9999"));
        await page.screenshot({ path: join(shots, "player-" + size.name + ".png") });
      }
      await page.evaluate(() => window.__widget.querySelector('[data-p="menu"]').click());
      await page.waitForTimeout(150);
      check(await page.evaluate(() => !!window.__menu && ["hide", "open"].every((k) => window.__menu.items.some((i) => i.key === k))), where + ": More offers Open the Auto Foley tab and Hide the player");
      const closing = await page.evaluate(() => {
        const card = window.__widget.querySelector(".af-pl");
        window.__widget.querySelector('[data-p="close"]').click();
        return card.getAnimations().some((x) => /circle/.test(JSON.stringify(x.effect.getKeyframes())));
      });
      check(closing, where + ": the player draws back into the round button over several frames");
      await page.waitForTimeout(600);
      check(await page.evaluate(() => !!window.__widget.querySelector(".af-float") && !window.__widget.querySelector(".af-pl")), where + ": closing it leaves the round button");
      check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
      await context.close();
    }
  }
}

if (section("hold")) {
  console.log("Press and hold on the floating player");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size, 1);
    const where = size.name;
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(250);
    const hold = await page.evaluate(async () => {
      window.__menu = null;
      const b = window.__widget.querySelector(".af-float");
      const r = b.getBoundingClientRect();
      const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true };
      b.dispatchEvent(new PointerEvent("pointerdown", at));
      await new Promise((r2) => setTimeout(r2, 60));
      const early = parseFloat(getComputedStyle(b.querySelector(".af-hold")).opacity);
      await new Promise((r2) => setTimeout(r2, 280));
      const mid = parseFloat(getComputedStyle(b.querySelector(".af-hold")).opacity);
      await new Promise((r2) => setTimeout(r2, 300));
      const menu = window.__menu;
      window.dispatchEvent(new PointerEvent("pointerup", at));
      b.click();
      await new Promise((r2) => setTimeout(r2, 50));
      return { early, mid, menu, opened: !!window.__widget.querySelector(".af-pl") };
    });
    check(hold.early < 0.2 && hold.mid > 0.8, where + ": the hold ring shows only once a press outlasts a tap (" + hold.early + ", " + hold.mid + ")");
    check(!!hold.menu, where + ": a press and hold opens the menu");
    const items = (hold.menu && hold.menu.items) || [];
    const lines = items.filter((i) => i.type === "divider").length;
    check(lines >= 1 && items[0].type !== "divider" && items[items.length - 1].type !== "divider", where + ": the menu is in groups, with a line between them (" + items.map((i) => i.type === "divider" ? "|" : i.key).join(" ") + ")");
    check(["player", "open", "hide"].every((k) => items.some((i) => i.key === k)), where + ": the menu opens the player, the tab, and hides the button");
    check(!hold.opened, where + ": letting go after the menu opened does not also open the player");
    const drag = await page.evaluate(async () => {
      window.__menu = null;
      const b = window.__widget.querySelector(".af-float");
      b.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true }));
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 130, clientY: 100 }));
      await new Promise((r2) => setTimeout(r2, 620));
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 130, clientY: 100 }));
      return !!window.__menu;
    });
    check(!drag, where + ": dragging the button opens no menu");
    const right = await page.evaluate(async () => {
      window.__menu = null;
      window.__widget.querySelector(".af-float").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
      await new Promise((r2) => setTimeout(r2, 50));
      return !!window.__menu;
    });
    check(right, where + ": a right click opens the menu");
    const tap = await page.evaluate(async () => {
      window.__menu = null;
      const b = window.__widget.querySelector(".af-float");
      b.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true }));
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 100, clientY: 100 }));
      b.click();
      await new Promise((r2) => setTimeout(r2, 650));
      return { menu: !!window.__menu, opened: !!window.__widget.querySelector(".af-pl") };
    });
    check(tap.opened && !tap.menu, where + ": a tap opens the player and no menu");
    const line = await page.evaluate(() => {
      const hr = window.__widget.querySelector(".af-pl-line");
      if (!hr) return null;
      const r = hr.getBoundingClientRect();
      const seg = window.__widget.querySelector(".af-pl .af-seg").getBoundingClientRect();
      const mix = window.__widget.querySelector(".af-pl-mix").getBoundingClientRect();
      return { w: r.width, top: parseFloat(getComputedStyle(hr).borderTopWidth), below: r.top >= seg.bottom - 0.5, above: r.bottom <= mix.top + 0.5 };
    });
    check(!!line && line.w > 100 && line.top >= 1 && line.below && line.above, where + ": a line divides playing from the options under it (" + JSON.stringify(line) + ")");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
  {
    const { context, page } = await open(THEMES[0], SIZES[0], 1);
    await page.evaluate(() => (window.__settings.reduceMotion = true));
    await page.evaluate(() => window.__teardown());
    await page.evaluate(() => {
      document.getElementById("drawer").innerHTML = "";
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    });
    await page.waitForTimeout(150);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(250);
    const still = await page.evaluate(async () => {
      window.__menu = null;
      const b = window.__widget.querySelector(".af-float");
      b.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true }));
      await new Promise((r2) => setTimeout(r2, 300));
      const shown = getComputedStyle(b.querySelector(".af-hold")).display;
      await new Promise((r2) => setTimeout(r2, 300));
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 100, clientY: 100 }));
      return { shown, menu: !!window.__menu };
    });
    check(still.shown === "none" && still.menu, "with Reduce motion on, a hold opens the menu with no ring drawn (" + still.shown + ")");
    await context.close();
  }
}

if (section("engines")) {
  console.log("Voice engines in the Cast and Settings tabs");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(250);
    await page.locator(".af-person-head").first().click();
    await page.waitForTimeout(400);
    const first = page.locator(".af-person").first();
    check((await first.locator('label:has-text("Connection")').count()) >= 1, size.name + ": a person can speak through another connection");
    check((await first.locator(".af-note", { hasText: "Engine: ElevenLabs v3 or v4" }).count()) === 1, size.name + ": the person card names the engine and what it can do");
    const sel = first.locator(".af-voicebox select").first();
    await sel.selectOption("t2");
    await page.waitForTimeout(400);
    check((await first.locator(".af-note", { hasText: "Engine: Fish Audio S2 or Drama 3" }).count()) === 1, size.name + ": picking Fish shows the Fish engine");
    check((await first.locator('label:has-text("Similarity")').count()) === 0, size.name + ": ElevenLabs-only settings are hidden for Fish");
    const options = await sel.locator("option").allTextContents();
    check(!options.some((o) => /Kokoro/.test(o)), size.name + ": a provider that cannot act is not listed (" + options.join(" | ") + ")");
    await sel.selectOption("t4");
    await page.waitForTimeout(400);
    check((await first.locator(".af-bad", { hasText: "works only with models that act out tags" }).count()) >= 1, size.name + ": a model with no tags says it cannot be used, and what to pick");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length, size.name + ": the cast card fits. " + m.overflow.slice(0, 2).join("; "));
    check(!m.small.length, size.name + ": its tap targets are big enough. " + m.small.slice(0, 2).join("; "));
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    check((await page.locator('label:has-text("What this connection runs")').count()) === 0, size.name + ": an ElevenLabs connection is not asked what it runs");
    await page.locator('[data-af-row] select').filter({ has: page.locator('option[value="t3"]') }).first().selectOption("t3");
    await page.waitForTimeout(300);
    check((await page.locator('label:has-text("What this connection runs")').count()) === 1, size.name + ": an OpenAI-style connection can be named a Chatterbox-Turbo server");
    check((await page.locator(".af-note", { hasText: "Engine: Chatterbox-Turbo" }).count()) === 1, size.name + ": a server named Chatterbox is found as Chatterbox-Turbo");
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(300);
    const notes = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll(".af-card")).find((c) => /Notes for each voice engine/.test(c.textContent));
      const now = card.querySelector("[data-af-engine-now]");
      const folds = Array.from(card.querySelectorAll(".af-fold")).map((f) => f.textContent.replace("▶", "").trim());
      return { now: now ? now.textContent : "", first: card.querySelector("[data-af-engine-now], .af-fold") === now, folds };
    });
    check(/In use now: Chatterbox-Turbo/.test(notes.now) && notes.first && notes.folds.length === 5 && notes.folds.indexOf("Chatterbox-Turbo") < 0, size.name + ": the engine in use is first and open, and every other engine has its own fold (" + notes.folds.join(" | ") + ")");
    check((await page.locator('[data-af-engine-note="chatterbox_turbo"] textarea').count()) === 1, size.name + ": the note for the engine in use can be read and changed");
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("sync")) {
  console.log("The words light up with the voice");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  // Each clip: 0.8 s of quiet, then 1.6 s of voice.
  await page.evaluate(() => {
    window.__wav = [0.8, 1.6];
    window.__clipMs = 2400;
  });
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(200);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForFunction(() => document.querySelector('[data-af="theater"]') && document.querySelector('[data-af="theater"]').dataset.state === "voice", null, { timeout: 8000 });
  const t0 = Date.now();
  const lit = () => page.evaluate(() => [document.querySelectorAll('[data-af="line"] .af-w.af-said').length, document.querySelectorAll('[data-af="line"] .af-w').length]);
  await page.waitForTimeout(Math.max(0, 450 - (Date.now() - t0)));
  const early = await lit();
  check(early[1] > 0 && early[0] === 0, "no word is lit while the clip is still quiet (" + early.join(" of ") + ")");
  await page.waitForTimeout(Math.max(0, 2250 - (Date.now() - t0)));
  const late = await lit();
  check(late[1] > 0 && late[0] === late[1], "every word is lit by the end of the voice (" + late.join(" of ") + ")");
  // The word being said is lit whole, with only its color changing, so it
  // stays in place in the theme's own font. Nothing is drawn on top of it.
  const looks = await page.evaluate(async () => {
    window.__clipMs = 2400;
    const out = [];
    for (let k = 0; k < 30; k++) {
      for (const w of document.querySelectorAll('[data-af="line"] .af-w.af-said')) {
        out.push([w.children.length, getComputedStyle(w, "::after").content, getComputedStyle(w).color]);
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return out;
  });
  check(looks.length > 0 && looks.every((x) => x[0] === 0 && (x[1] === "none" || x[1] === "normal")), "a lit word is the word itself, with nothing drawn over it");
  check(looks.every((x) => !/rgba\(0, 0, 0, 0\)|transparent/.test(x[2])), "a lit word is never see-through");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("script status")) {
  console.log("The status says the Director is writing only when it is asked, and prices give a cost");
  for (const asked of [false, true]) {
    const { context, page, errors } = await open(THEMES[0], SIZES[0]);
    await page.evaluate((asked) => {
      window.__directHold = 900;
      if (asked) window.__directingAt = 100;
    }, asked);
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(150);
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(400);
    const said = (await page.locator('[data-af="sub"]').textContent()) || "";
    if (!asked) check(said.includes("Getting the script") && !said.includes("Director is writing"), "a kept script says it is getting the script (" + said + ")");
    else check(said.includes("The Director is writing the script"), "once the Director is asked, it says so (" + said + ")");
    check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
  {
    // A script played from what was kept says so.
    const { context, page, errors } = await open(THEMES[0], SIZES[0]);
    await page.evaluate(() => { window.__fromKept = true; });
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(150);
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(300);
    const used = (await page.locator('[data-af="used"]').textContent()) || "";
    check(used.startsWith("Saved script. The Director was not asked again."), "a saved script says so in Now playing (" + used + ")");
    // A script the Director could not direct says so, and what to press.
    await page.evaluate(() => { window.__fallback = true; });
    await page.evaluate(() => document.querySelector('[data-af="stop"]').click());
    await page.waitForTimeout(200);
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(400);
    const fell = (await page.locator('[data-af="used"]').textContent()) || "";
    check(fell.startsWith("Saved script, read as written: the Director could not direct this message.") && fell.includes("Direct again tries the Director."), "a script read as written says why, and what Direct again does (" + fell + ")");
    check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
  const { context, page, errors } = await open(THEMES[0], SIZES[0]);
  await page.click('.af-tab[data-tab="director"]');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => { const b = document.querySelector('[data-af-row="costOut"] input'); return b.value === "0" && !b.placeholder; }), "a price box shows its number, 0 by default, with no grey placeholder, as in Auto Refine");
  // Pasted, as a price is copied off a provider's page.
  await page.evaluate(() => {
    const box = document.querySelector('[data-af-row="costIn"] input');
    const data = new DataTransfer();
    data.setData("text", "$1.00 / 1M input tokens");
    box.focus();
    box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    box.blur();
  });
  check(await page.evaluate(() => { const b = document.querySelector('[data-af-row="costIn"] input'); return b.type === "number" && b.min === "0" && b.max === "10000"; }), "a price box is a number box from 0 to 10000, as in Auto Retry and Auto Refine");
  await page.fill('[data-af-row="costOut"] input', "2");
  await page.locator('[data-af-row="costOut"] input').blur();
  await page.waitForTimeout(100);
  check((await page.locator('[data-af-row="costIn"] input').inputValue()) === "1", "a pasted price line keeps its number");
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(150);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForTimeout(300);
  const used = (await page.locator('[data-af="used"]').textContent()) || "";
  check(used.includes("Cost: about 0.0023"), "with prices set, Now playing gives the cost (" + used + ")");
  const m = await page.evaluate(MEASURE, true);
  check(!m.overflow.length && !m.small.length, "the Stage fits on a phone. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("message player")) {
  console.log("A performed message gets a player under its text, lined up with it, in both chat modes");
  for (const mode of ["bubble", "minimal"]) for (const size of SIZES) {
    const where = mode + ", " + size.name;
    const { context, page, errors } = await open(THEMES[0], size);
    // As Lumiverse lays a message out. Bubble: the text in a padded box,
    // then the place it leaves for an extension. Minimal: the message text
    // with no padding of its own, then the same place.
    await page.evaluate((mode) => {
      const msg = document.querySelector('[data-message-id="m1"]');
      const p = msg.querySelector("p");
      const content = document.createElement("div");
      if (mode === "bubble") {
        content.className = "content";
        content.style.padding = "0 22px";
      } else content.setAttribute("data-component", "MessageContent");
      p.replaceWith(content);
      content.appendChild(p);
      const mount = document.createElement("span");
      mount.setAttribute("data-spindle-mount", "message_body_after");
      mount.setAttribute("data-spindle-scope", "message:m1:" + mode + ":body-after");
      mount.style.display = "contents";
      content.after(mount);
      window.__clipMs = 4000;
      window.__wav = [0.05, 0.5];
    }, mode);
    await page.waitForTimeout(400);
    check((await page.locator("[data-af-player]").count()) === 0, where + ": no player before the message is performed");
    const look = () =>
      page.evaluate(() => {
        const box = document.querySelector("[data-af-player]");
        if (!box) return null;
        const inner = box.firstElementChild;
        const pill = box.querySelector(".af-mp-box").getBoundingClientRect();
        const text = box.querySelector("[data-af-mp=text]").getBoundingClientRect();
        const btn = box.querySelector("[data-af-mp=play]").getBoundingClientRect();
        const msg = document.querySelector('[data-message-id="m1"]').getBoundingClientRect();
        return {
          open: box.hasAttribute("data-open"),
          pad: getComputedStyle(inner).paddingLeft,
          label: box.querySelector("[data-af-mp=play]").getAttribute("aria-label"),
          text: box.querySelector("[data-af-mp=text]").textContent,
          btnH: btn.height,
          inside: pill.left >= msg.left - 1 && pill.right <= msg.right + 1 && text.right <= pill.right + 1,
          mid: Math.abs((pill.left + pill.right) / 2 - (msg.left + msg.right) / 2),
          sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          cut: box.querySelector("[data-af-mp=text]").scrollWidth > box.querySelector("[data-af-mp=text]").clientWidth,
        };
      });
    // While the Director writes, with the longest words it shows and a
    // large font, it still fits inside the message.
    await page.evaluate(() => {
      window.__directHold = 1500;
      window.__directingAt = 50;
    });
    const bigStyle = await page.addStyleTag({ content: '[data-message-id="m1"]{font-size:26px}' });
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(400);
    const busy = await look();
    check(!!busy && busy.text === "Writing the script" && busy.inside && !busy.sideways, where + ": while the script is written, with a large font, it fits inside the message (" + JSON.stringify(busy) + ")");
    await bigStyle.evaluate((n) => n.remove());
    await page.waitForTimeout(1800);
    const got = await look();
    if (shots) await page.locator('[data-message-id="m1"]').screenshot({ path: shots + "/message-player-" + mode + "-" + size.name + ".png" });
    check(!!got && got.open, where + ": the player opens under the message");
    check(!!got && got.pad === (mode === "bubble" ? "22px" : "0px"), where + ": it has the message text's side padding (" + (got && got.pad) + ")");
    check(!!got && got.label === "Pause" && /^Part \d+ of \d+/.test(got.text), where + ": while it plays, it says the part and offers Pause (" + JSON.stringify(got) + ")");
    check(!!got && got.inside && !got.sideways, where + ": it fits inside the message, with no sideways scrolling");
    check(!!got && !got.cut, where + ": with room to spare, its words are not cut off (" + (got && got.text) + ")");
    if (size.touch) check(!!got && got.btnH >= 32, where + ": its button is at least 32 pixels high (" + (got && got.btnH) + ")");
    // Next and Back move through the message.
    const partNow = () => page.evaluate(() => (document.querySelector("[data-af-player] [data-af-mp=text]").textContent.match(/Part (\d+)/) || [])[1] || "");
    const p0 = await partNow();
    await page.evaluate(() => document.querySelector("[data-af-player] [data-af-mp=next]").click());
    await page.waitForTimeout(300);
    const p1 = await partNow();
    await page.evaluate(() => document.querySelector("[data-af-player] [data-af-mp=back]").click());
    await page.waitForTimeout(300);
    const p2 = await partNow();
    check(Number(p1) === Number(p0) + 1 && Number(p2) === Number(p0), where + ": Next moves on one part and Back returns (" + [p0, p1, p2].join(" ") + ")");
    // A tap near the end of the line goes to the last part.
    const total = await page.evaluate(() => Number((document.querySelector("[data-af-player] [data-af-mp=text]").textContent.match(/of (\d+)/) || [])[1] || 0));
    const seekBox = await page.locator("[data-af-player] [data-af-mp=seek]").boundingBox();
    await page.mouse.click(seekBox.x + seekBox.width - 3, seekBox.y + seekBox.height / 2);
    await page.waitForTimeout(300);
    const p3 = await partNow();
    check(total > 1 && Number(p3) === total, where + ": a tap near the end of the line goes to the last part (" + p3 + " of " + total + ")");
    if (size.touch) check(seekBox.height >= 32, where + ": the line is at least 32 pixels tall to tap (" + seekBox.height + ")");
    if (size.touch) {
      const small = await page.evaluate(() => Array.from(document.querySelectorAll("[data-af-player] button")).filter((b) => b.getBoundingClientRect().height < 32).length);
      check(small === 0, where + ": every button in the player is at least 32 pixels high");
    }
    // The player's words are not cut short at its usual font size.
    // Read from the drawn width of the words, since the box can be short of
    // them by a fraction of a pixel, which scrollWidth rounds away.
    const cut = await page.evaluate(() => { const t = document.querySelector("[data-af-player] [data-af-mp=text]"); const r = document.createRange(); r.selectNodeContents(t); return { cut: r.getBoundingClientRect().width > t.getBoundingClientRect().width + 0.005, text: t.textContent }; });
    check(!cut.cut, where + ": the player's words are shown whole (" + cut.text + ")");
    // In a narrow message the line gives up its room first, so the words
    // stay whole while the line is longer than its smallest.
    const narrow = await page.evaluate(async () => {
      const m = document.querySelector('[data-message-id="m1"]');
      const was = m.style.width;
      const t = document.querySelector("[data-af-player] [data-af-mp=text]");
      const seek = document.querySelector("[data-af-player] [data-af-mp=seek]");
      const r = document.createRange();
      r.selectNodeContents(t);
      const out = [];
      for (const w of [300, 280, 260]) {
        m.style.width = w + "px";
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        out.push({ w, seek: Math.round(seek.getBoundingClientRect().width), cut: r.getBoundingClientRect().width > t.getBoundingClientRect().width + 0.005 });
      }
      m.style.width = was;
      return out;
    });
    check(narrow.every((x) => !x.cut || x.seek <= 25), where + ": in a narrow message the line shrinks before the words are cut (" + JSON.stringify(narrow) + ")");
    // A theme with centered text, a large wide font and its own look for
    // every button centers the player and keeps all of it inside the message.
    await page.addStyleTag({ content: '[data-message-id="m1"]{font-size:26px;font-family:"Comic Sans MS",cursive} [data-message-id="m1"] p{text-align:center} button{padding:6px 14px;min-width:44px;margin:2px 4px;border:2px solid currentColor}' });
    await page.evaluate(() => document.body.appendChild(document.createElement("i")));
    await page.waitForTimeout(500);
    const big = await look();
    const at = await page.evaluate(() => getComputedStyle(document.querySelector("[data-af-player]").firstElementChild).justifyContent);
    check(at === "center" && !!big && big.mid <= 2, where + ": with the message text centered, the player is centered (" + at + ", " + (big && big.mid) + ")");
    check(!!big && big.inside && !big.sideways, where + ": with a large font, it still fits inside the message (" + JSON.stringify(big) + ")");
    const allIn = await page.evaluate(() => {
      const pill = document.querySelector("[data-af-player] .af-mp-box").getBoundingClientRect();
      return Array.from(document.querySelectorAll("[data-af-player] .af-mp-box > *, [data-af-player] .af-mp-run > *")).every((n) => { const r = n.getBoundingClientRect(); return r.left >= pill.left - 1 && r.right <= pill.right + 1; });
    });
    check(allIn, where + ": with a theme that styles every button, every part stays inside the pill");
    // Turned off, it goes.
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.locator('[data-af-row="messagePlayer"] .af-box').first().click();
    await page.waitForTimeout(600);
    check((await page.locator("[data-af-player]").count()) === 0, where + ": switched off, the player goes");
    check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("message player contrast")) {
  console.log("The player in a message reads clearly on every theme, over a busy picture");
  // The colors drawn, read from a screenshot: the pill's own background
  // beside the words, and the word pixel that differs most from it.
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const theme of THEMES) {
    const { context, page, errors } = await open(theme, SIZES[0]);
    await page.evaluate(() => {
      const msg = document.querySelector('[data-message-id="m1"]');
      // A picture behind the message, in bright and dark stripes.
      msg.style.background = "repeating-linear-gradient(90deg,#fff 0 6px,#111 6px 12px,#c9a 12px 18px)";
      const p = msg.querySelector("p");
      const content = document.createElement("div");
      content.setAttribute("data-component", "MessageContent");
      p.replaceWith(content);
      content.appendChild(p);
      const mount = document.createElement("span");
      mount.setAttribute("data-spindle-mount", "message_body_after");
      mount.setAttribute("data-spindle-scope", "message:m1:minimal:body-after");
      mount.style.display = "contents";
      content.after(mount);
      window.__clipMs = 4000;
    });
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const t = document.querySelector("[data-af-player] [data-af-mp=text]").getBoundingClientRect();
      const b = document.querySelector("[data-af-player] .af-mp-box").getBoundingClientRect();
      const i = document.querySelector("[data-af-player] [data-af-mp=play] svg").getBoundingClientRect();
      return { t: { x: t.left, y: t.top, w: t.width, h: t.height }, bg: { x: b.right - 6, y: b.top + b.height / 2 }, icon: { x: i.left, y: i.top, w: i.width, h: i.height }, btn: document.querySelector("[data-af-player] [data-af-mp=play]").getBoundingClientRect().left + 2 };
    });
    const shot = (await page.screenshot()).toString("base64");
    const px = await page.evaluate(async ({ shot, r }) => {
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = "data:image/png;base64," + shot; });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const s = img.naturalWidth / innerWidth;
      const at = (x, y) => Array.from(g.getImageData(Math.round(x * s), Math.round(y * s), 1, 1).data).slice(0, 3);
      const area = (q) => Array.from(g.getImageData(Math.round(q.x * s), Math.round(q.y * s), Math.max(1, Math.round(q.w * s)), Math.max(1, Math.round(q.h * s))).data);
      return { bg: at(r.bg.x, r.bg.y), text: area(r.t), icon: area(r.icon), btnBg: at(r.btn, r.icon.y + r.icon.h / 2) };
    }, { shot, r });
    const most = (data, from) => {
      let best = from, d = -1;
      for (let k = 0; k < data.length; k += 4) {
        const c = [data[k], data[k + 1], data[k + 2]];
        const e = Math.abs(c[0] - from[0]) + Math.abs(c[1] - from[1]) + Math.abs(c[2] - from[2]);
        if (e > d) { d = e; best = c; }
      }
      return best;
    };
    const words = ratio(most(px.text, px.bg), px.bg);
    const icon = ratio(most(px.icon, px.btnBg), px.btnBg);
    check(words >= 4.5, theme.name + ": the words read clearly on the player (" + words.toFixed(1) + ")");
    check(icon >= 3, theme.name + ": the play button's icon stands out (" + icon.toFixed(1) + ")");
    check(!errors.length, theme.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("saved audio")) {
  console.log("Saved audio, in the Studio, lists every saved script, and plays, opens and deletes them");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    // A message is played once, so its lines are saved. The backend then
    // lists its script.
    await page.evaluate(() => {
      window.__keptList = [{ key: "k1", messageId: "m1", chatId: "chat1", author: "Ysolde", keptAt: Date.UTC(2026, 10, 20, 15), lines: 3, first: "The quay was empty but for the ferry." }];
      window.__clipMs = 300;
      window.__wav = [0.05, 0.25];
    });
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForFunction(() => document.querySelector('#mount [data-af-slot="message"]').getAttribute("aria-busy") === null && (window.__synth || []).length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const made = await page.evaluate(() => (window.__synth || []).length);
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(200);
    // The list shows with no fold to open.
    await page.waitForTimeout(400);
    const row = page.locator("[data-af-saved-row]");
    check((await row.count()) === 1, size.name + ": the saved script is listed");
    check(((await row.textContent()) || "").includes("Ysolde’s script") && ((await row.textContent()) || "").includes("The quay was empty"), size.name + ": the row names whose script it is and its first line");
    // Open in the Studio builds the performance from saved audio alone.
    const spentBefore = await page.evaluate(() => (window.__synth || []).length);
    await row.locator("[data-af-saved-open]").click();
    await page.waitForFunction(() => document.querySelector('.af-tab[data-tab="studio"]').getAttribute("aria-selected") === "true", null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    check(await page.evaluate(() => document.querySelector('.af-tab[data-tab="studio"]').getAttribute("aria-selected") === "true"), size.name + ": Open in the Studio opens the Studio tab");
    check((await page.locator(".af-fold", { hasText: "Which parts go in" }).count()) === 1, size.name + ": with the saved performance in it");
    check((await page.evaluate(() => (window.__synth || []).length)) === spentBefore, size.name + ": and nothing is spoken again to make it");
    const dl = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await page.click('[data-af-studio="dlall"]');
    const file = await dl;
    check(!!file && /^auto-foley Ysolde 2026-11-20\.wav$/.test(file.suggestedFilename()), size.name + ": its audio downloads, named for whose script it is and the day it was saved (" + (file && file.suggestedFilename()) + ")");
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__clipMs = 4000; });
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(500);
    check(((await row.locator("[data-af-saved-play]").textContent()) || "") === "Stop", size.name + ": Play plays it, and the button turns to Stop");
    check((await page.evaluate(() => (window.__synth || []).length)) === made, size.name + ": playing and opening it in the Studio make nothing new");
    // With a slow account, Play says Getting ready while the lines are
    // read, and a second press lets it go, so nothing plays twice.
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__clipGetMs = 500; window.__clipGetMost = 0; window.__played = 0; });
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(100);
    check(((await row.locator("[data-af-saved-play]").textContent()) || "") === "Getting ready" && ((await row.textContent()) || "").includes("Reading the saved audio"), size.name + ": while the saved lines are read, Play says Getting ready (" + (await row.locator("[data-af-saved-play]").textContent()) + ")");
    await page.click('.af-tab[data-tab="stage"]');
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(100);
    check(((await row.locator("[data-af-saved-play]").textContent()) || "") === "Getting ready", size.name + ": and still says so when the tab is drawn again");
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(1800);
    check((await page.evaluate(() => window.__played || 0)) === 0 && ((await row.locator("[data-af-saved-play]").textContent()) || "") === "Play", size.name + ": a second press while it gets ready lets it go, and nothing plays (" + (await page.evaluate(() => window.__played || 0)) + ")");
    await row.locator("[data-af-saved-play]").click();
    await row.locator("[data-af-saved-play]").click();
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(1800);
    check((await page.evaluate(() => window.__played || 0)) === 1 && ((await row.locator("[data-af-saved-play]").textContent()) || "") === "Stop", size.name + ": three quick presses play it once (" + (await page.evaluate(() => window.__played || 0)) + " times)");
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__clipGetMost = 0; });
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(1800);
    check((await page.evaluate(() => window.__clipGetMost || 0)) > 1, size.name + ": one press reads the saved lines side by side (" + (await page.evaluate(() => window.__clipGetMost || 0)) + " at once)");
    await page.evaluate(() => { window.__clipGetMs = 0; });
    // One thing plays at a time. A message started while a saved script
    // plays stops the saved script, and the other way round.
    // The message's own button says Stop Auto Foley while it plays.
    const playLabel = () => page.evaluate(() => (document.querySelector('#mount [data-af-slot="message"]').getAttribute("aria-label") === "Stop Auto Foley" ? "Pause" : "not playing"));
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(700);
    check(((await row.locator("[data-af-saved-play]").textContent()) || "") === "Play", size.name + ": starting a message stops the saved script");
    check((await playLabel()) === "Pause", size.name + ": and the message plays (" + (await playLabel()) + ")");
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(700);
    check((await playLabel()) !== "Pause", size.name + ": starting the saved script stops the message (" + (await playLabel()) + ")");
    check(((await row.locator("[data-af-saved-play]").textContent()) || "") === "Stop", size.name + ": and the saved script plays");
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(200);
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the list fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    // Its file name shows, and it can be renamed, which changes the file
    // name too.
    check(/^auto-foley Ysolde 2026-11-20\.wav$/.test(((await row.locator("[data-af-savedfile]").textContent()) || "").trim()), size.name + ": the tile shows the name its files are saved under");
    await row.locator("[data-af-savedmore-btn]").click();
    await page.waitForTimeout(450);
    await row.locator("[data-af-savedrename]").fill("The ferry at dawn");
    await row.locator("[data-af-savedrename]").dispatchEvent("change");
    await page.waitForTimeout(400);
    check(((await row.locator("[data-af-savedname]").textContent()) || "") === "The ferry at dawn" && /^auto-foley The ferry at dawn 2026-11-20\.wav$/.test(((await row.locator("[data-af-savedfile]").textContent()) || "").trim()), size.name + ": renamed, its name and file name change");
    check(await page.evaluate(() => window.__keptList[0].name === "The ferry at dawn"), size.name + ": and the name is saved");
    // Folders: a new one, and the script moved into it.
    await page.click("[data-af-newfolder]");
    await page.waitForTimeout(400);
    check(await page.evaluate(() => (window.__settings.savedFolders || []).length === 1), size.name + ": New folder makes a folder, saved to the account");
    await row.locator("[data-af-savedmore-btn]").click().catch(() => {});
    await page.waitForTimeout(450);
    const moreOpen = await row.locator("[data-af-savedmove] select").isVisible().catch(() => false);
    if (!moreOpen) { await row.locator("[data-af-savedmore-btn]").click(); await page.waitForTimeout(450); }
    const fid = await page.evaluate(() => window.__settings.savedFolders[0].id);
    await row.locator("[data-af-savedmove] select").selectOption(fid);
    await page.waitForTimeout(500);
    check(await page.evaluate((fid) => !!document.querySelector('[data-af-folderid="' + fid + '"] [data-af-saved-row]') && window.__keptList[0].folder === fid, fid), size.name + ": Folder moves the script into the folder");
    // Find.
    await page.fill("[data-af-savedfind]", "nothing like it");
    await page.waitForTimeout(400);
    check((await row.count()) === 0 && /0 of 1 match/.test(await page.locator('[data-af="savedsaid"]').textContent()), size.name + ": Find lists only what matches");
    await page.fill("[data-af-savedfind]", "dawn");
    await page.waitForTimeout(400);
    check((await row.count()) === 1, size.name + ": and finds it by its new name");
    await page.fill("[data-af-savedfind]", "");
    await page.waitForTimeout(400);
    const mg = await page.evaluate(MEASURE, size.touch);
    check(!mg.overflow.length && !mg.small.length, size.name + ": the gallery fits. " + mg.overflow.concat(mg.small).slice(0, 2).join("; "));
    if (shots) await page.locator("[data-af-saved]").screenshot({ path: shots + "/gallery-" + size.name + ".png" });
    if (!(await row.locator(".af-btn", { hasText: "Delete" }).isVisible())) { await row.locator("[data-af-savedmore-btn]").click(); await page.waitForTimeout(450); }
    // Delete asks in a confirmation. Answered no, nothing is deleted.
    await page.evaluate(() => { window.__confirmNo = true; window.__asked = 0; });
    await row.locator(".af-btn", { hasText: "Delete" }).click();
    await page.waitForTimeout(400);
    check((await page.evaluate(() => window.__asked)) === 1 && (await page.evaluate(() => window.__askedTitle)) === "Delete this saved script" && (await row.count()) === 1 && !(await page.evaluate(() => (window.__dropped || []).length)), size.name + ": Delete asks first in a confirmation, and No keeps it");
    await page.evaluate(() => { window.__confirmNo = false; });
    await row.locator(".af-btn", { hasText: "Delete" }).click();
    await page.waitForTimeout(600);
    const dropped = await page.evaluate(() => window.__dropped || []);
    check((await page.locator("[data-af-saved-row]").count()) === 0 && dropped.length === 1 && dropped[0].sigs.length > 0, size.name + ": Yes deletes it, with its saved audio");
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("voice levels")) {
  console.log("A louder voice is turned down to match the others");
  for (const even of [true, false]) {
    const { context, page, errors } = await open(THEMES[0], SIZES[1]);
    // One voice four times as loud as every other, which is 12 dB, so it is
    // turned down by the most, 6 dB.
    await page.evaluate(() => {
      window.__wav = [0.1, 0.5];
      window.__clipMs = 300;
      window.__amps = { v1: 12000, v2: 3000, v3: 3000, "": 3000 };
    });
    if (!even) {
      await page.click('.af-tab[data-tab="stage"]');
      await page.waitForTimeout(200);
      await page.locator('[data-af-row="evenVoices"] .af-box').first().click();
      await page.waitForTimeout(100);
    }
    // Twice, so every voice's level is known by the second time through.
    for (let k = 0; k < 2; k++) {
      await page.click('#mount [data-af-slot="message"]');
      await page.waitForFunction(() => document.querySelector('#mount [data-af-slot="message"]').getAttribute("aria-busy") === null, null, { timeout: 10000 });
      await page.waitForTimeout(200);
    }
    const seen = await page.evaluate(() => ({
      voices: Array.from(new Set((window.__synth || []).map((b) => b.voice || ""))),
      volumes: window.__Audio.all.filter((a) => a.dataset.kind === "voice").map((a) => Math.round(a.volume * 1000) / 1000),
    }));
    const down = seen.volumes.filter((v) => v < 0.99);
    if (even) {
      check(seen.voices.length > 1 && down.length > 0 && down.every((v) => Math.abs(v - 0.501) < 0.01), "the loud voice plays at half volume, 6 dB down (voices " + seen.voices.join(",") + "; volumes " + seen.volumes.join(",") + ")");
      check(seen.volumes.some((v) => v === 1), "the quiet voices play at full volume");
      await page.click('.af-tab[data-tab="stage"]');
      await page.waitForTimeout(200);
      check(/turned down by 6 dB/.test(await page.locator(".af-log").first().textContent()), "the Log says which voice was turned down, and by how much");
    } else {
      check(seen.volumes.length > 0 && !down.length, "with Even out voice levels off, every voice plays at its own volume (" + seen.volumes.join(",") + ")");
    }
    check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("connection list")) {
  console.log("The TTS connection list says what Lumiverse sent");
  const cases = [
    { name: "no connections", list: [], want: /Lumiverse found no TTS connection on your account/, usable: false },
    { name: "only an unusable service", list: [{ id: "k1", name: "Read aloud", provider: "kokoro" }], want: /Lumiverse sent: Read aloud \(kokoro\)/, usable: false },
    { name: "Gemini through OpenRouter", list: [{ id: "o1", name: "Router voices", provider: "openrouter_tts", model: "google/gemini-3.8-flash-tts", has_api_key: true }], want: /Router voices/, usable: true },
    { name: "ElevenLabs through OpenRouter", list: [{ id: "o2", name: "Router eleven", provider: "openrouter_tts", model: "elevenlabs/eleven-v4", has_api_key: true }], want: /Router eleven/, usable: true },
    { name: "Fish Audio through OpenRouter", list: [{ id: "o3", name: "Router fish", provider: "openrouter_tts", model: "fish-audio/s2.1-pro", has_api_key: true }], want: /Router fish/, usable: true },
    { name: "OmniVoice through OpenVox", list: [{ id: "v1x", name: "Desk voices", provider: "openvox_tts", model: "omnivoice", has_api_key: true }], want: /Desk voices/, usable: true },
    { name: "Cartesia", list: [{ id: "c1", name: "Sonic line", provider: "cartesia", model: "sonic-3.5", has_api_key: true }], want: /Sonic line/, usable: true },
  ];
  for (const size of SIZES) {
    for (const c of cases) {
      const { context, page, errors } = await open(THEMES[0], size);
      // Set before the panel starts, since it reads the list once at the start.
      await page.evaluate((c) => {
        window.__teardown();
        document.getElementById("drawer").innerHTML = "";
        window.__ttsList = c.list;
        window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
      }, c);
      await page.waitForTimeout(200);
      await page.click('.af-tab[data-tab="settings"]');
      await page.waitForTimeout(500);
      const text = await page.evaluate(() => document.getElementById("drawer").innerText);
      check(c.want.test(text), size.name + ", " + c.name + ": the Settings tab says so");
      check(/no TTS connection|None of your TTS connections/.test(text) === !c.usable, size.name + ", " + c.name + ": " + (c.usable ? "no warning, since it can be used" : "the warning shows"));
      if (c.name === "Gemini through OpenRouter") check(/Engine: Gemini 3\.8/.test(text), size.name + ": OpenRouter's Gemini 3.8 is read as Gemini 3.8");
      if (c.name === "ElevenLabs through OpenRouter") check(/Engine: ElevenLabs v3 or v4/.test(text), size.name + ": OpenRouter's Eleven v4 is read as ElevenLabs");
      if (c.name === "Fish Audio through OpenRouter") check(/Engine: Fish Audio/.test(text), size.name + ": OpenRouter's Fish Audio S2.1 is read as Fish Audio");
      if (c.name === "OmniVoice through OpenVox") check(/Engine: OmniVoice/.test(text), size.name + ": OpenVox's OmniVoice is read as OmniVoice");
      if (c.name === "Cartesia") {
        check(/Engine: Cartesia Sonic 3/.test(text), size.name + ": Cartesia's Sonic 3.5 is read as Cartesia");
        // A line with a feeling and a laugh: the feeling goes beside the
        // line, and only [laughter] stays in the text.
        await page.evaluate(() => {
          window.__clipMs = 300;
          window.__script = { key: "kc", messageId: "m1", author: "Ysolde Marrow-Kestrel of the Lower Quays", directed: true, added: [], sent: 10, back: 10, counted: true, log: [], lines: [
            { i: 0, kind: "speech", speaker: "Ysolde Marrow-Kestrel of the Lower Quays", text: "[nervously] We leave at dawn. [laughs] Truly.", plain: "", tags: [], inSounds: [], big: false, before: "", after: "", note: "" },
          ] };
        });
        await page.click('#mount [data-af-slot="message"]');
        await page.waitForTimeout(1500);
        const sent = await page.evaluate(() => (window.__synth || []).map((b) => ({ text: b.text, emotion: b.parameters && b.parameters.emotion })));
        check(sent.some((b) => b.text === "We leave at dawn. [laughter] Truly." && b.emotion === "anxious"), size.name + ": Cartesia is sent the feeling beside the line and only [laughter] in it (" + JSON.stringify(sent.slice(0, 2)) + ")");
      }
      if (c.name === "ElevenLabs through OpenRouter") {
        // In the Cast tab: the model's own voices, and no setting that
        // cannot be sent through OpenRouter.
        await page.click('.af-tab[data-tab="cast"]');
        await page.waitForTimeout(300);
        await page.locator(".af-person-head").nth(1).click();
        await page.waitForTimeout(900);
        const cast = await page.evaluate(() => {
          const p = Array.from(document.querySelectorAll(".af-person")).find((x) => x.querySelector(".af-person-body:not([hidden])"));
          const labels = Array.from(p.querySelectorAll(".af-lab")).map((x) => x.textContent.trim());
          const opts = Array.from(p.querySelectorAll("select option")).map((o) => o.textContent);
          return { labels, opts };
        });
        check(cast.opts.some((o) => /^George/.test(o)) && !cast.opts.some((o) => /OpenAI|Alloy/i.test(o)), size.name + ": the voice list is ElevenLabs' own on OpenRouter (" + cast.opts.slice(0, 4).join(", ") + ")");
        check(["Stability", "Similarity", "Speed"].every((x) => cast.labels.indexOf(x) < 0), size.name + ": no Stability, Similarity or Speed, which OpenRouter cannot be sent (" + cast.labels.join(", ") + ")");
      }
      const m = await page.evaluate(MEASURE, true);
      check(!m.overflow.length, size.name + ", " + c.name + ": nothing runs off the side. " + m.overflow.slice(0, 2).join("; "));
      check(!errors.length, size.name + ", " + c.name + ": no console errors. " + errors.slice(0, 2).join("; "));
      await context.close();
    }
  }
}

if (section("note limit")) {
  console.log("Acting notes keeps what is typed, and counts it");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    await page.locator(".af-person-head").first().click();
    await page.waitForTimeout(600);
    const box = page.locator(".af-person [data-af-speak] textarea").first();
    await box.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Delete");
    // 14 times 50 characters is 700.
    await page.keyboard.insertText("Slow and careful, like each word costs something. ".repeat(14));
    await box.evaluate((t) => t.blur());
    await page.waitForTimeout(900);
    const a = await page.evaluate(() => ({
      len: document.querySelector(".af-person [data-af-speak] textarea").value.length,
      saved: (window.__settings.cast[0].note || "").length,
      count: (document.querySelector(".af-person [data-af-speak] .af-count") || {}).textContent || "",
    }));
    check(a.len === 700 && a.saved === 700, where + ": a 700-character note is kept whole (" + a.len + " typed, " + a.saved + " saved)");
    check(a.count === "700 of 1000 characters", where + ": the count under the box says how much is used (" + a.count + ")");
    await box.click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" More words.".repeat(40));
    await page.waitForTimeout(900);
    const b = await page.evaluate(() => ({
      len: document.querySelector(".af-person [data-af-speak] textarea").value.length,
      saved: (window.__settings.cast[0].note || "").length,
      count: document.querySelector(".af-person [data-af-speak] .af-count"),
    })).then(async (r) => r);
    const near = await page.locator(".af-person [data-af-speak] .af-count[data-near]").count();
    const countText = await page.locator(".af-person [data-af-speak] .af-count").textContent();
    check(b.len === 1000 && b.saved === 1000, where + ": typing stops at 1000 characters, and what shows is what is saved (" + b.len + ", " + b.saved + ")");
    check(countText === "1000 of 1000 characters" && near === 1, where + ": the count stands out at the limit (" + countText + ")");
    const m = await page.evaluate(MEASURE, true);
    check(!m.overflow.length, where + ": nothing runs off the side. " + m.overflow.slice(0, 2).join("; "));
    check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("kept")) {
  console.log("Kept audio plays again without being made again");
  const { context, page, errors } = await open(THEMES[0], SIZES[0]);
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(200);
  await page.fill('[data-af-row="voicePrice"] input', "30");
  await page.locator('[data-af-row="voicePrice"] input').blur();
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(200);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForFunction(() => document.querySelector('#mount [data-af-slot="message"]').getAttribute("aria-busy") === null && (window.__synth || []).length > 0, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  const made = await page.evaluate(() => (window.__synth || []).length);
  {
    const chars = await page.evaluate(() => (window.__synth || []).reduce((n, b) => n + Array.from(String(b.text || "")).length, 0));
    const firstSaid = (await page.locator('[data-af="used"]').textContent()) || "";
    const cost = Number(((chars / 1e6) * 30).toPrecision(2));
    check(firstSaid.includes("Voice: " + chars.toLocaleString("en-US") + " characters, about " + cost + "."), "Now playing gives the characters sent for new audio, and their cost (" + firstSaid + ")");
  }
  check(made > 0 && (await page.evaluate(() => Object.keys(window.__clips || {}).length)) === made, "each line made is kept (" + made + ")");
  await page.evaluate(() => {
    window.__clipMs = 700;
    // The place Lumiverse leaves under a message, where the player goes.
    const mount = document.createElement("span");
    mount.setAttribute("data-spindle-mount", "message_body_after");
    mount.setAttribute("data-spindle-scope", "message:m1:minimal:body-after");
    mount.style.display = "contents";
    document.querySelector('[data-message-id="m1"] p').after(mount);
    // The drawer closed, as on a phone: Lumiverse takes it off the page, so
    // Now playing is not drawn and nothing else changes as the parts go by.
    window.__drawerBox = document.getElementById("drawer");
    window.__drawerNext = window.__drawerBox.nextSibling;
    window.__drawerBox.remove();
  });
  await page.waitForTimeout(400);
  await page.click('#mount [data-af-slot="message"]');
  // The player under the message moves through the parts while saved audio
  // plays, with nothing new being made to repaint it.
  const parts = await page.evaluate(async () => {
    const seen = [];
    for (let k = 0; k < 60; k++) {
      const t = document.querySelector("[data-af-player] [data-af-mp=text]");
      const m = t && t.textContent.match(/^Part (\d+)/);
      if (m && seen.indexOf(m[1]) < 0) seen.push(m[1]);
      await new Promise((r) => setTimeout(r, 50));
    }
    return seen;
  });
  check(parts.length >= 2, "while saved audio plays, the player under the message says each part in turn (" + parts.join(", ") + ")");
  await page.evaluate(() => document.body.insertBefore(window.__drawerBox, window.__drawerNext));
  await page.waitForTimeout(1500);
  check((await page.evaluate(() => (window.__synth || []).length)) === made, "playing it again makes nothing new");
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(200);
  const savedSaid = (await page.locator('[data-af="used"]').textContent()) || "";
  check(/\d+ of \d+ lines?(?: so far)? played from saved audio, with nothing spent\./.test(savedSaid), "Now playing says the lines came from saved audio (" + savedSaid + ")");
  check(!savedSaid.includes("Voice:"), "audio played from what was saved adds no characters");
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(300);
  check((await page.locator('[data-af="kept"]').textContent()).includes("Kept now: " + made), "Settings says how much is kept");
  await page.locator('[data-af-row="keepAudio"] .af-btn', { hasText: "Clear kept audio" }).click();
  await page.waitForTimeout(300);
  check((await page.locator('[data-af="kept"]').textContent()).includes("Nothing is kept"), "Clear kept audio empties it");
  const m = await page.evaluate(MEASURE, true);
  check(!m.overflow.length && !m.small.length, "the Keep made audio rows fit on a phone. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("steady")) {
  console.log("The Stage stays still while lines play");
  for (const zoom of [0.85, 1, 1.25]) {
    for (const size of SIZES) {
      const { context, page, errors } = await open(THEMES[0], size, zoom);
      const where = "zoom " + zoom + ", " + size.name;
      await page.evaluate(() => window.__teardown());
      await page.evaluate(() => {
        const d = document.getElementById("drawer");
        d.innerHTML = "";
        d.style.height = "520px";
        d.style.overflowY = "auto";
        window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
      });
      await page.waitForTimeout(200);
      await page.click('.af-tab[data-tab="stage"]');
      await page.waitForTimeout(200);
      await page.evaluate(() => (window.__clipMs = 500));
      await page.click('#mount [data-af-slot="message"]');
      await page.waitForTimeout(400);
      await page.evaluate(() => (document.getElementById("drawer").scrollTop = 60));
      await page.waitForTimeout(100);
      const at = await page.evaluate(() => [document.getElementById("drawer").scrollTop, document.querySelector('[data-af="theater"]').getBoundingClientRect().top]);
      let moved = 0;
      for (let k = 0; k < 8; k++) {
        await page.waitForTimeout(250);
        const now = await page.evaluate(() => [document.getElementById("drawer").scrollTop, document.querySelector('[data-af="theater"]') ? document.querySelector('[data-af="theater"]').getBoundingClientRect().top : null]);
        if (now[1] != null && (Math.abs(now[0] - at[0]) > 1 || Math.abs(now[1] - at[1]) > 1)) moved++;
      }
      check(moved === 0, where + ": the drawer does not scroll and Now playing does not move as lines change (" + moved + " moves)");
      const redrawn = await page.evaluate(async () => {
        const now = document.querySelector('[data-af="theater"]').closest(".af-card");
        let n = 0;
        const mo = new MutationObserver((list) => {
          for (const m of list) if (m.type === "childList" && m.target.closest && !m.target.closest('[data-af="line"],[data-af="who"],[data-af="cue"],[data-af="sub"]')) n++;
        });
        mo.observe(now, { childList: true, subtree: true });
        await new Promise((r) => setTimeout(r, 1000));
        mo.disconnect();
        return n;
      });
      check(redrawn <= 3, where + ": Now playing is not drawn again while a part plays (" + redrawn + " times in 1 s)");
      check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
      await context.close();
    }
  }
}

if (section("groups")) {
  console.log("Groups in the Cast tab");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(250);
    await page.locator('.af-btn', { hasText: "New group" }).click();
    await page.waitForTimeout(300);
    const ed = page.locator("[data-af-group-edit]");
    check((await ed.count()) === 1, where + ": New group opens the group editor");
    // Nothing is focused, so a phone does not raise its keyboard on its own.
    check(await page.evaluate(() => !document.activeElement || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)), where + ": no box is focused when the editor opens");
    const people = await ed.locator('input[role="switch"]').count();
    check(people >= 4, where + ": the editor has a switch for each person in the cast (" + people + ")");
    // Save with no name says what is missing, and saves nothing.
    await ed.locator(".af-btn", { hasText: "Save" }).click();
    await page.waitForTimeout(200);
    check((await ed.locator("[data-af-already]").textContent()) === "Type a name for the group first." && (await page.locator(".af-group").count()) === 0, where + ": Save with no name asks for one");
    const m0 = await page.evaluate(MEASURE, size.touch);
    check(!m0.overflow.length && !m0.small.length, where + ": the editor fits and its switches are big enough. " + m0.overflow.concat(m0.small).slice(0, 3).join("; "));
    await ed.locator('input[type="text"]').fill("Harbor town");
    // The second person goes in, by its switch.
    await ed.locator('input[role="switch"]').nth(1).click();
    await ed.locator(".af-btn", { hasText: "Save" }).click();
    await page.waitForTimeout(300);
    check((await page.locator(".af-group-toggle", { hasText: "Harbor town" }).count()) === 1, where + ": the group takes its name");
    check((await page.locator(".af-group .af-person").count()) === 1, where + ": a person moves into the group");
    check((await page.locator(".af-group-count").textContent()).includes("1 person"), where + ": the group says how many are in it");
    await page.locator(".af-group-toggle").click();
    await page.waitForTimeout(400);
    check(await page.evaluate(() => document.querySelector(".af-group-body").hidden), where + ": a tap closes the group");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the group row fits and its buttons are big enough. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    // Edit opens the same editor, with the group as it is. Cancel changes
    // nothing.
    await page.locator(".af-group-head .af-btn", { hasText: "Edit" }).click();
    await page.waitForTimeout(300);
    const ed2 = page.locator("[data-af-group-edit]");
    check((await ed2.locator('input[type="text"]').inputValue()) === "Harbor town" && (await ed2.locator('input[role="switch"]:checked').count()) === 1, where + ": Edit shows the group's name and who is in it");
    check(await page.evaluate(() => !document.activeElement || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)), where + ": no box is focused when Edit opens");
    await ed2.locator('input[role="switch"]').nth(2).click();
    await ed2.locator(".af-btn", { hasText: "Cancel" }).click();
    await page.waitForTimeout(300);
    check((await page.locator(".af-group-count").textContent()).includes("1 person"), where + ": Cancel changes nothing");
    await page.locator(".af-group-head .af-btn", { hasText: "Delete" }).click();
    await page.waitForTimeout(300);
    check((await page.locator(".af-group").count()) === 0 && (await page.locator(".af-page > .af-person").count()) >= 4, where + ": deleting the group keeps its people in the cast");
    check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("patterns")) {
  console.log("Patterns to leave out");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(250);
    const ta = page.locator("[data-af-skips] textarea");
    check((await ta.inputValue()).includes("【"), size.name + ": the built-in patterns show in the box");
    await ta.fill("(a+)+");
    await page.waitForTimeout(250);
    check((await page.locator('.af-warn', { hasText: "This pattern is not used" }).count()) === 1, size.name + ": a pattern that cannot be used says why");
    await page.locator('[data-af-skips] .af-btn', { hasText: "Use defaults" }).click();
    // Settings are saved to the account a moment after the last change.
    await page.waitForTimeout(800);
    check((await ta.inputValue()).includes("【") && (await page.evaluate(() => window.__settings.skipPatterns)) === "", size.name + ": Use defaults puts the built-in patterns back");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length, size.name + ": nothing runs off the side. " + m.overflow.slice(0, 2).join("; "));
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("one connection")) {
  console.log("With one TTS connection, it is listed once");
  const { context, page, errors } = await open(THEMES[0], SIZES[0]);
  await page.evaluate(() => window.__teardown());
  await page.evaluate(() => {
    const base = window.__fetch;
    window.__fetch = async (url, init) => {
      if (String(url).includes("/tts-connections?")) return new Response(JSON.stringify({ data: [{ id: "t1", name: "My ElevenLabs", provider: "elevenlabs", model: "eleven_v3", has_api_key: true }], total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (String(url).includes("/settings/voiceSettings")) return new Response("{}", { status: 404 });
      return base(url, init);
    };
    document.getElementById("drawer").innerHTML = "";
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
  });
  await page.waitForTimeout(250);
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(400);
  const opts = await page.locator('.af-col:has(> .af-between label:text-is("TTS connection")) select option, .af-col:has(label:text-is("TTS connection")) select option').allTextContents();
  check(opts.length === 1 && opts[0].includes("My ElevenLabs"), "the only connection is named once (" + opts.join(" | ") + ")");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("listed once")) {
  console.log("A choice the first one already makes is not listed again");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.evaluate(() => window.__teardown());
  await page.evaluate(() => {
    window.__llmList = [{ id: "l1", name: "Brisk", model: "maker/brisk-1", provider: "openai", isDefault: true }, { id: "l2", name: "Slowpoke", model: "maker/slow-2", provider: "openai" }];
    window.__decList = [{ id: "d1", name: "Quick", model: "fast-judge", isDefault: true, hasKey: true }, { id: "d2", name: "Careful", model: "slow-judge", hasKey: true }];
    window.__settings.decisionsOn = true;
    const base = window.__fetch;
    window.__fetch = async (url, init) => {
      if (/\/tts-connections\/t1\/models/.test(String(url))) return new Response(JSON.stringify({ models: [{ id: "eleven_v3", label: "Eleven v3" }, { id: "eleven_v4", label: "Eleven v4" }], provider: "elevenlabs" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (String(url).includes("/settings/voiceSettings")) return new Response("{}", { status: 404 });
      return base(url, init);
    };
    document.getElementById("drawer").innerHTML = "";
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
  });
  await page.waitForTimeout(300);
  const twice = (opts, name) => opts.filter((o) => o.includes(name)).length;
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(400);
  const tts = await page.locator('.af-col:has(label:text-is("TTS connection")) select option').allTextContents();
  check(twice(tts, "My ElevenLabs") === 1 && tts[0].includes("My ElevenLabs") && tts.length === 4, "TTS connection: the default is named in the first choice only (" + tts.join(" | ") + ")");
  await page.click('.af-tab[data-tab="director"]');
  await page.waitForTimeout(400);
  const dir = await page.locator('.af-col:has(label:text-is("Which connection")) select option').allTextContents();
  check(twice(dir, "Brisk") === 1 && dir[0].includes("Brisk") && dir.some((o) => o.includes("Slowpoke")), "Which connection: the default is named in the first choice only (" + dir.join(" | ") + ")");
  const dec = await page.locator('.af-col:has(label:text-is("Which Decision connection")) select option').allTextContents();
  check(twice(dec, "Quick") === 1 && dec[0].includes("Quick") && dec.some((o) => o.includes("Careful")), "Which Decision connection: the default is named in the first choice only (" + dec.join(" | ") + ")");
  await page.click('.af-tab[data-tab="cast"]');
  await page.waitForTimeout(300);
  await page.locator(".af-person-head").first().click();
  await page.waitForTimeout(600);
  // The options of the one box under the label with these words.
  const box = (words) => page.evaluate((w) => {
    const p = document.querySelector(".af-person");
    const l = Array.from(p.querySelectorAll("label")).find((x) => x.textContent.trim() === w);
    const sel = l && (l.htmlFor ? document.getElementById(l.htmlFor) : l.closest(".af-col").querySelector("select"));
    return sel ? Array.from(sel.options).map((o) => o.textContent) : [];
  }, words);
  const conn = await box("Connection");
  check(twice(conn, "My ElevenLabs") === 1 && conn[0].includes("My ElevenLabs"), "a person's Connection: Auto Foley's own is named in the first choice only (" + conn.join(" | ") + ")");
  const models = await box("Model");
  check(twice(models, "eleven_v3") + twice(models, "Eleven v3") === 1 && models.some((o) => o.includes("Eleven v4")), "a person's Model: the connection's model is named in the first choice only (" + models.join(" | ") + ")");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
  {
    // The same, with every default picked by name.
    const { context, page, errors } = await open(THEMES[0], SIZES[0]);
    await page.evaluate(() => window.__teardown());
    await page.evaluate(() => {
      window.__llmList = [{ id: "l1", name: "Brisk", model: "maker/brisk-1", provider: "openai", isDefault: true }, { id: "l2", name: "Slowpoke", model: "maker/slow-2", provider: "openai" }];
      window.__decList = [{ id: "d1", name: "Quick", model: "fast-judge", isDefault: true, hasKey: true }];
      Object.assign(window.__settings, { decisionsOn: true, directorConnection: "l1", decisionConnection: "d1", ttsConnection: "t1" });
      window.__settings.cast[0] = Object.assign({}, window.__settings.cast[0], { connection: "t1", voices: { t1: { voice: "", voiceName: "", model: "eleven_v3" } } });
      const base = window.__fetch;
      window.__fetch = async (url, init) => {
        if (/\/tts-connections\/t1\/models/.test(String(url))) return new Response(JSON.stringify({ models: [{ id: "eleven_v3", label: "Eleven v3" }, { id: "eleven_v4", label: "Eleven v4" }], provider: "elevenlabs" }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (String(url).includes("/settings/voiceSettings")) return new Response("{}", { status: 404 });
        return base(url, init);
      };
      document.getElementById("drawer").innerHTML = "";
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    });
    await page.waitForTimeout(300);
    const read = (words) => page.evaluate((w) => {
      const l = Array.from(document.querySelectorAll(".af label")).find((x) => x.textContent.trim() === w);
      const sel = l && (l.htmlFor ? document.getElementById(l.htmlFor) : l.closest(".af-col").querySelector("select"));
      return sel ? { opts: Array.from(sel.options).map((o) => o.textContent), at: sel.selectedIndex } : null;
    }, words);
    const one = (r, name) => !!r && r.at === 0 && r.opts.filter((o) => o.includes(name)).length === 1 && !r.opts.some((o) => /gone/.test(o));
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(400);
    const tts = await read("TTS connection");
    check(one(tts, "My ElevenLabs"), "picked by name, the TTS connection shows once, as the first choice (" + JSON.stringify(tts) + ")");
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(400);
    const dir = await read("Which connection");
    check(one(dir, "Brisk"), "picked by name, the Director's connection shows once, as the first choice (" + JSON.stringify(dir) + ")");
    const dec = await read("Which Decision connection");
    check(one(dec, "Quick") && dec.opts.length === 1, "the only Decision connection, picked by name, is one choice (" + JSON.stringify(dec) + ")");
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    await page.locator(".af-person-head").first().click();
    await page.waitForTimeout(600);
    const conn = await read("Connection");
    check(one(conn, "My ElevenLabs"), "picked by name, a person's Connection shows Auto Foley's once (" + JSON.stringify(conn) + ")");
    const model = await read("Model");
    check(!!model && model.at === 0 && model.opts.filter((o) => /eleven_v3|Eleven v3/.test(o)).length === 1, "picked by name, a person's Model shows the connection's model once (" + JSON.stringify(model) + ")");
    check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("erase name")) {
  console.log("Erasing a person's name leaves no old letter behind");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    // The Ferryman, typed into with the keyboard as a person does.
    await page.evaluate(() => document.querySelector('.af-person[data-person="b"] .af-person-head').click());
    await page.waitForTimeout(450);
    const sel = await page.evaluate(() => {
      const c = document.querySelector('.af-person[data-person="b"]');
      const col = Array.from(c.querySelectorAll(".af-col")).find((x) => ((x.querySelector(".af-lab") || {}).textContent || "").trim() === "Name");
      const i = col.querySelector("input");
      i.id = "name-b";
      return "#" + i.id;
    });
    const look = () => page.evaluate((sel) => {
      const c = document.querySelector('.af-person[data-person="b"]');
      return { name: c.querySelector(".af-person-name b").textContent, face: c.querySelector(".af-person-head .af-avatar").textContent, box: document.querySelector(sel).value, saved: window.__settings.cast.find((m) => m.id === "b").name };
    }, sel);
    await page.focus(sel);
    await page.keyboard.press("End");
    for (let k = 0; k < 8; k++) { await page.keyboard.press("Backspace"); await page.waitForTimeout(120); }
    await page.waitForTimeout(700);
    const empty = await look();
    check(empty.name === "No name yet" && empty.face === "?" && empty.box === "", size.name + ": erased, the box is empty, and the card shows No name yet and ? (" + JSON.stringify(empty) + ")");
    check(empty.saved === "Ferryman", size.name + ": while it is being erased, no shorter name is saved, such as its first letter (" + empty.saved + ")");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(700);
    const left = await look();
    check(left.box === "" && left.saved === "" && left.name === "No name yet" && left.face === "?", size.name + ": left empty, it stays empty, with no letter put back (" + JSON.stringify(left) + ")");
    // Drawn again, such as after a tab switch, it is still empty.
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    await page.evaluate(() => { const h = document.querySelector('.af-person[data-person="b"] .af-person-head'); if (h.getAttribute("aria-expanded") !== "true") h.click(); });
    await page.waitForTimeout(450);
    const again = await page.evaluate(() => {
      const c = document.querySelector('.af-person[data-person="b"]');
      const col = Array.from(c.querySelectorAll(".af-col")).find((x) => ((x.querySelector(".af-lab") || {}).textContent || "").trim() === "Name");
      const i = col.querySelector("input");
      i.id = "name-b";
      return { box: i.value, name: c.querySelector(".af-person-name b").textContent, face: c.querySelector(".af-person-head .af-avatar").textContent };
    });
    check(again.box === "" && again.name === "No name yet" && again.face === "?", size.name + ": and is still empty after the tab is drawn again (" + JSON.stringify(again) + ")");
    await page.focus(sel);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Wren");
    await page.waitForTimeout(150);
    const typed = await look();
    check(typed.name === "Wren" && typed.face === "W", size.name + ": a new name shows at once, with its own first letter (" + JSON.stringify(typed) + ")");
    const hintName = await page.evaluate(() => document.querySelector('.af-person[data-person="b"] [data-af-display] input').placeholder);
    check(hintName === "Wren", size.name + ": the gray name in Display name follows the name as it is typed (" + hintName + ")");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(700);
    const kept = await look();
    check(kept.saved === "Wren" && kept.box === "Wren", size.name + ": and is saved when the box is left (" + JSON.stringify(kept) + ")");
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("already")) {
  console.log("Pressing a button that would change nothing says so");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(400);
    const prompt = await page.evaluate(async () => {
      window.__asked = 0;
      const b = Array.from(document.querySelectorAll(".af button")).find((x) => x.textContent.trim() === "Back to the built-in prompt");
      b.click();
      await new Promise((r) => setTimeout(r, 100));
      const line = b.parentElement.querySelector(".af-note");
      return { said: line ? line.textContent : "", asked: window.__asked };
    });
    check(prompt.asked === 0 && /already the built-in prompt\. Nothing changed\./.test(prompt.said), where + ": the built-in prompt says it is already in use, and asks nothing (" + JSON.stringify(prompt) + ")");
    const note = await page.evaluate(async () => {
      window.__asked = 0;
      const card = Array.from(document.querySelectorAll(".af-card")).find((c) => /Notes for each voice engine/.test(c.textContent));
      card.querySelector(".af-fold").click();
      await new Promise((r) => setTimeout(r, 400));
      const f = document.querySelector("[data-af-engine-note]");
      if (!f) return null;
      const b = Array.from(f.querySelectorAll("button")).find((x) => x.textContent.trim() === "Back to built-in");
      b.click();
      await new Promise((r) => setTimeout(r, 100));
      const line = f.querySelector("[data-af-already]");
      const said = line ? line.textContent : "";
      const ta = f.querySelector("textarea");
      ta.value = ta.value + " More.";
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      return { said, asked: window.__asked, gone: !f.querySelector("[data-af-already]") };
    });
    check(!!note && note.asked === 0 && note.said === "This is already the built-in note. Nothing changed." && note.gone, where + ": an engine note says the same, and the line goes once the note is changed (" + JSON.stringify(note) + ")");
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(400);
    const reset = await page.evaluate(async () => {
      window.__asked = 0;
      window.__already = window.__settings.resetParts && window.__settings.resetParts.length ? window.__settings.resetParts.slice() : ["settings", "prompt", "cast", "sounds", "audio", "key"];
      const b = Array.from(document.querySelectorAll(".af button")).find((x) => /^Reset (everything|the \d+ chosen)$/.test(x.textContent.trim()));
      b.click();
      await new Promise((r) => setTimeout(r, 300));
      const st = Array.from(document.querySelectorAll(".af-status")).find((x) => /defaults/.test(x.textContent));
      window.__already = [];
      return { said: st ? st.textContent : "", kind: st ? st.dataset.kind : "?", asked: window.__asked };
    });
    check(reset.asked === 0 && /already at (its|their) defaults\. Nothing changed\./.test(reset.said) && reset.kind === "", where + ": Start again with nothing to reset says so, asks nothing, and is not shown as done (" + JSON.stringify(reset) + ")");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("decision line")) {
  console.log("The Decision model's line can be changed, and its answers have a Log kind");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(400);
    const got = await page.evaluate(async () => {
      const row = document.querySelector("[data-af-sure]");
      if (!row) return null;
      const r = row.querySelector('input[type="number"]');
      const before = r.value;
      r.value = "70";
      r.dispatchEvent(new Event("input", { bubbles: true }));
      r.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((x) => setTimeout(x, 400));
      const box = row.getBoundingClientRect();
      return { before, after: r.value, saved: window.__settings.decisionSure, w: box.width, vw: document.documentElement.clientWidth, right: box.right };
    });
    check(!!got && got.before === "50" && got.after === "70" && got.saved === 70, size.name + ": How sure it must be is a box at 50 and saves a new value (" + JSON.stringify(got) + ")");
    check(!!got && got.right <= got.vw + 0.5, size.name + ": the box stays on screen");
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    const kind = await page.evaluate(async () => {
      const fold = Array.from(document.querySelectorAll(".af-fold")).find((x) => /What the Log shows/.test(x.textContent));
      if (fold && fold.getAttribute("aria-expanded") !== "true") fold.click();
      await new Promise((x) => setTimeout(x, 400));
      return Array.from(document.querySelectorAll(".af label, .af span")).some((x) => x.textContent.trim() === "What the Decision model answered");
    });
    check(kind, size.name + ": the Log has a switch for What the Decision model answered");
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("freesound")) {
  console.log("Sounds come from Freesound or ElevenLabs, and a found sound shows its credit");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.evaluate(() => window.__teardown());
    await page.evaluate(() => {
      window.__sounds = window.__sounds.concat([{ id: "f1", name: "a door creaking open", triggers: [], source: "found", mime: "audio/mpeg", bytes: 30000, added: 3, uses: 2, credit: { title: "old door creak", by: "tinbox", license: "CC BY", page: "https://freesound.org/people/tinbox/sounds/12/", fsId: 12, seen: [12] } }]);
      document.getElementById("drawer").innerHTML = "";
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    });
    await page.waitForTimeout(300);
    await page.click('.af-tab[data-tab="sounds"]');
    await page.waitForTimeout(400);
    const got = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("[data-af-key]")).map((c) => c.getAttribute("data-af-key"));
      const labels = Array.from(document.querySelectorAll(".af label")).map((x) => x.textContent.trim());
      const row = Array.from(document.querySelectorAll(".af-sound")).find((r) => /a door creaking open/.test(r.textContent));
      const link = row && row.querySelector(".af-credit a");
      const again = row && Array.from(row.querySelectorAll("button")).find((b) => b.textContent.trim() === "Find another");
      const vw = document.documentElement.clientWidth;
      const wide = Array.from(document.querySelectorAll(".af-page *")).filter((e) => e.getBoundingClientRect().right > vw + 0.5).length;
      return { cards, from: labels.indexOf("Where they come from") >= 0, lic: labels.indexOf("Freesound licenses") >= 0, credit: row ? (row.querySelector(".af-credit") || {}).textContent : "", href: link ? link.getAttribute("href") : "", rel: link ? link.getAttribute("rel") : "", again: !!again, wide };
    });
    check(got.cards.join() === "freesound,eleven", where + ": a key card for Freesound, then one for ElevenLabs (" + got.cards.join() + ")");
    check(got.from && got.lic, where + ": Where they come from and Freesound licenses sit under Get new sounds");
    check(got.credit === "From Freesound: old door creak by tinbox, CC BY" && got.href === "https://freesound.org/people/tinbox/sounds/12/" && /noopener/.test(got.rel), where + ": a found sound credits its maker, with a link to its page (" + got.credit + ")");
    check(got.again, where + ": a found sound has Find another");
    check(got.wide === 0, where + ": nothing runs off the side (" + got.wide + ")");
    const key = await page.evaluate(async () => {
      window.__sent = [];
      const c = document.querySelector('[data-af-key="freesound"]');
      c.querySelector("input").value = "fs_try";
      Array.from(c.querySelectorAll("button")).find((b) => b.textContent.trim() === "Save").click();
      await new Promise((r) => setTimeout(r, 200));
      const m = (window.__sent || []).find((x) => x.type === "key_save");
      return { which: m && m.which, said: c.querySelector(".af-status").textContent };
    });
    check(key.which === "freesound" && /works/.test(key.said), where + ": Save on the Freesound card saves the Freesound key (" + JSON.stringify(key) + ")");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("reminders")) {
  console.log("A change to the built-in text is said once, to someone with their own version");
  {
    const { context, page, errors } = await open(THEMES[0], SIZES[0]);
    await page.evaluate(() => {
      window.__teardown();
      window.__fresh = false;
      Object.assign(window.__settings, { movedSeen: "", messageButton: true, barButton: true, extrasMenu: true });
      document.getElementById("drawer").innerHTML = "";
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    });
    await page.waitForTimeout(300);
    const said = await page.evaluate(() => (document.querySelector("[data-af-moved]") || {}).textContent || "");
    check(/Some default settings have changed in this update/.test(said) && /A button on every message/.test(said), "someone still on the old button defaults is told (" + said.slice(0, 70) + ")");
    for (const z of [0.85, 1, 1.25]) {
      const fit = await page.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom);
        const n = document.querySelector("[data-af-moved]");
        const box = n.getBoundingClientRect();
        const out = Array.from(n.querySelectorAll("button")).filter((b) => { const r = b.getBoundingClientRect(); return r.right > box.right + 0.5 || r.left < box.left - 0.5; }).length;
        document.documentElement.style.zoom = "";
        return { out, vw: document.documentElement.clientWidth, right: box.right };
      }, z);
      check(fit.out === 0 && fit.right <= fit.vw * 1.25 + 1, "phone, zoom " + z + ": the notice's buttons stay inside it (" + JSON.stringify(fit) + ")");
    }
    const took = await page.evaluate(async () => {
      Array.from(document.querySelectorAll("[data-af-moved] button")).find((b) => b.textContent.trim() === "Take it").click();
      await new Promise((r) => setTimeout(r, 1500));
      return { gone: !document.querySelector("[data-af-moved]"), s: window.__settings };
    });
    check(took.gone && took.s.messageButton === false && took.s.barButton === false && took.s.extrasMenu === false && took.s.movedSeen.split(" ").length === 3, "Take it turns the three buttons off and marks the rows as answered");
    await page.evaluate(() => { window.__fresh = true; });
    check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    const restart = (own) => page.evaluate((mine) => {
      window.__teardown();
      Object.assign(window.__settings, { builtInSeen: "oldmark", prompt: mine });
      document.getElementById("drawer").innerHTML = "";
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    }, own);
    await restart("Direct it my way.");
    await page.waitForTimeout(300);
    const shown = await page.evaluate(() => {
      const n = document.querySelector("[data-af-builtin-moved]");
      return n ? n.textContent : "";
    });
    check(/You have your own version of the Director’s prompt\. Yours is untouched\./.test(shown), where + ": someone with their own prompt is told the built-in text changed (" + shown.slice(0, 80) + ")");
    const after = await page.evaluate(async () => {
      const n = document.querySelector("[data-af-builtin-moved]");
      Array.from(n.querySelectorAll("button")).find((b) => b.textContent.trim() === "Got it").click();
      await new Promise((r) => setTimeout(r, 1500));
      return { gone: !document.querySelector("[data-af-builtin-moved]"), seen: window.__settings.builtInSeen };
    });
    check(after.gone && after.seen && after.seen !== "oldmark", where + ": Got it hides it and keeps the new mark in the account (" + JSON.stringify(after) + ")");
    await restart("");
    await page.waitForTimeout(1500);
    const quiet = await page.evaluate(() => ({ shown: !!document.querySelector("[data-af-builtin-moved]"), seen: window.__settings.builtInSeen }));
    check(!quiet.shown && quiet.seen !== "oldmark", where + ": someone on the built-in text is not told, and is marked as told (" + JSON.stringify(quiet) + ")");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("widget fixes")) {
  console.log("The open player shows the whole line, and only a switch flips a switch");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__widget.querySelector(".af-float").click());
    await page.waitForTimeout(700);
    const got = await page.evaluate(async () => {
      const w = window.__widget;
      const said = w.querySelector('[data-p="said"]');
      said.textContent = "Brin set the lantern on the step and waited for the gulls to settle before she spoke again, slow and low.";
      await new Promise((r) => setTimeout(r, 50));
      const fits = said.scrollHeight <= said.clientHeight + 1;
      said.textContent = Array.from({ length: 30 }, (_, k) => "Line " + k + " of a very long passage that keeps going.").join(" ");
      await new Promise((r) => setTimeout(r, 50));
      said.scrollTop = 1e6;
      const scrolls = said.scrollTop > 0;
      const sw = w.querySelector('[data-sw="soundsOn"]');
      const words = sw.parentElement.querySelector("span");
      const before = sw.checked;
      words.click();
      await new Promise((r) => setTimeout(r, 50));
      const afterWords = sw.checked;
      sw.click();
      await new Promise((r) => setTimeout(r, 50));
      return {
        fits, scrolls, wordsLeft: afterWords === before, boxFlips: sw.checked !== before,
        label: sw.closest("label") === null && !!sw.getAttribute("aria-labelledby"),
        drag: getComputedStyle(w.querySelector(".af-pl-top")).touchAction,
        bars: !!w.querySelector(".af-pl-bars"),
      };
    });
    check(got.fits, where + ": a three-line line shows in full, with nothing cut off");
    check(got.scrolls, where + ": a very long line scrolls inside its box instead of being cut off");
    check(got.wordsLeft && got.boxFlips && got.label, where + ": pressing a quick switch's words does nothing, pressing the switch flips it (" + JSON.stringify(got) + ")");
    check(got.drag === "none", where + ": the top bar can be dragged on a phone without the page scrolling (" + got.drag + ")");
    check(!got.bars, where + ": no moving bars symbol");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("scroll kept")) {
  console.log("Switching tabs keeps the drawer where it was scrolled to");
  for (const size of SIZES) {
    for (const zoom of [0.85, 1, 1.25]) {
      const { context, page, errors } = await open(THEMES[0], size, zoom);
      const where = size.name + ", zoom " + zoom;
      // Lumiverse's drawer is a box of its own that scrolls, not the page.
      await page.evaluate(() => { const d = document.getElementById("drawer"); d.style.height = "100vh"; d.style.overflowY = "auto"; });
      await page.click('.af-tab[data-tab="settings"]');
      await page.waitForTimeout(300);
      const got = await page.evaluate(async () => {
        let box = document.querySelector(".af");
        while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
        // The test page has no drawer box, so the page itself scrolls.
        if (!box) box = document.scrollingElement;
        box.scrollTop = 400;
        const at = box.scrollTop;
        await new Promise((r) => setTimeout(r, 50));
        document.querySelector('.af-tab[data-tab="director"]').click();
        await new Promise((r) => setTimeout(r, 300));
        const director = box.scrollTop;
        document.querySelector('.af-tab[data-tab="sounds"]').click();
        await new Promise((r) => setTimeout(r, 300));
        return { at, director, sounds: box.scrollTop };
      });
      check(!!got && got.at > 100 && Math.abs(got.director - got.at) <= 1 && Math.abs(got.sounds - got.at) <= 1, where + ": the scroll stays where it was on every tab switch (" + JSON.stringify(got) + ")");
      check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
      await context.close();
    }
  }
}

if (section("reused row")) {
  console.log("A row Lumiverse reuses for another message performs that message");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.waitForTimeout(400);
  const got = await page.evaluate(async () => {
    const msg = document.querySelector('[data-message-id="m1"]');
    const btn = msg.querySelector('[data-af-slot="message"]');
    if (!btn) return { none: true };
    // The row now shows another message.
    window.__moreMessages = [{ id: "m7", name: "Pell", is_user: false, content: "Pell shut the gate.", swipe_id: 0 }];
    msg.setAttribute("data-message-id", "m7");
    msg.querySelector("#mount").setAttribute("data-spindle-scope", "message:m7:actions");
    window.__sent = [];
    btn.click();
    await new Promise((r) => setTimeout(r, 300));
    const asked = (window.__sent.find((m) => m.type === "direct") || {}).messageId;
    // The next placement pass replaces a button left with the old id.
    msg.appendChild(document.createElement("span"));
    await new Promise((r) => setTimeout(r, 700));
    const now = msg.querySelector('[data-af-slot="message"]');
    return { asked, id: now && now.getAttribute("data-af-message") };
  });
  check(got.asked === "m7", "pressing a button in a reused row performs the message now in that row (" + JSON.stringify(got) + ")");
  check(got.id === "m7", "the button left with the old message id is replaced");
  await page.evaluate(async () => {
    window.__clipMs = 4000;
    document.querySelector('[data-af-slot="message"]').click();
    await new Promise((r) => setTimeout(r, 600));
  });
  const playing = await page.evaluate(() => !!document.querySelector('[data-af-slot="message"][aria-pressed="true"], [data-af-slot="message"][data-af-state="playing"]'));
  await page.evaluate(() => window.__emit("MESSAGE_DELETED", { chatId: "chat1", messageId: "m7" }));
  await page.waitForTimeout(300);
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector('[data-af="sub"]').textContent);
  check(/deleted, so it stopped/.test(after) || /Press Play to start/.test(after), "a message deleted while it plays stops, and its script is not kept for Play (" + after + ", playing before: " + playing + ")");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("no audio")) {
  console.log("An answer with no audio is asked for again at once");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.evaluate(() => { window.__emptyOnce = 1; window.__clipMs = 300; });
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(150);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForTimeout(3500);
  const got = await page.evaluate(() => ({ empty: window.__emptyAt || [], made: window.__synthAt || [], log: (document.querySelector('.af-log') || {}).innerText || '' }));
  const gap = got.empty.length && got.made.length ? Math.min(...got.made.filter((t) => t > got.empty[0])) - got.empty[0] : -1;
  check(got.empty.length === 1 && gap > 0 && gap < 3000, "the line is asked for again within 3 seconds (" + gap + " ms)");
  check(/sent back no audio for line \d+\. Trying again in 2 s/.test(got.log), "the Log says no audio came back and it is asked again");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("pause keys")) {
  console.log("Keys to pause and play");
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size);
    await page.evaluate(() => { window.__clipMs = 4000; });
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    const seen = (sel) => page.evaluate((sel) => { const n = document.querySelector(sel); return !!n && !n.closest("[hidden]") && n.getClientRects().length > 0; }, sel);
    check(await seen('[data-af-row="pauseKeyOn"]'), where + ": the switch is in the Settings tab");
    check(!(await seen("[data-af-pausekey]")), where + ": its keys are hidden while it is off");
    await page.evaluate(() => document.querySelector('[data-af-row="pauseKeyOn"] .af-box').click());
    await page.waitForTimeout(600);
    check(await seen("[data-af-pausekey]"), where + ": switched on, Which keys shows under it");
    check((await page.evaluate(() => document.querySelector("[data-af-pausekey]").textContent)) === "Alt+P", where + ": and says Alt+P");
    const look = await page.evaluate(() => ({ h: document.querySelector("[data-af-pausekey]").getBoundingClientRect().height, side: document.documentElement.scrollWidth > window.innerWidth + 1 }));
    if (size.touch) check(look.h >= 32, where + ": the keys box is at least 32 pixels high (" + look.h + ")");
    check(!look.side, where + ": nothing runs off the side");

    // Picked by pressing them. Escape keeps the keys there were.
    await page.click("[data-af-pausekey]");
    check(/Press the keys now/.test(await page.evaluate(() => document.querySelector("[data-af-pausekey]").textContent)), where + ": tapped, it asks for the keys");
    await page.keyboard.press("Escape");
    check((await page.evaluate(() => document.querySelector("[data-af-pausekey]").textContent)) === "Alt+P", where + ": Escape keeps Alt+P");
    await page.click("[data-af-pausekey]");
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(150);
    check((await page.evaluate(() => document.querySelector("[data-af-pausekey]").textContent)) === "Ctrl+Shift+K", where + ": pressed keys are shown");
    check((await page.evaluate(() => window.__settings.pauseKey)) === "Ctrl+Shift+K", where + ": and saved");

    // While a message plays, the keys pause it and play it again.
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(900);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const playing = () => page.evaluate(() => { const a = FakeAudio.all[FakeAudio.all.length - 1]; return !!a && !a.paused; });
    check(await playing(), where + ": a message is playing");
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);
    check(!(await playing()), where + ": the keys pause it");
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);
    check(await playing(), where + ": pressed again, it plays");

    // Not while typing in a box, and not in another extension's part.
    await page.evaluate(() => {
      const box = document.createElement("textarea");
      box.id = "typing";
      document.body.appendChild(box);
      const other = document.createElement("div");
      other.setAttribute("data-spindle-extension-root", "another_one");
      other.innerHTML = '<button type="button" id="otherbtn">Go</button>';
      document.body.appendChild(other);
    });
    await page.focus("#typing");
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);
    check(await playing(), where + ": typing in a box does not pause it");
    // Back to playing first, so this step is read on its own.
    if (!(await playing())) {
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press("Control+Shift+KeyK");
      await page.waitForTimeout(100);
    }
    await page.focus("#otherbtn");
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);
    check(await playing(), where + ": inside another extension's part it does not pause");

    // Lumiverse marks Auto Foley's own tab the same way, with its id, and
    // the keys still work there.
    await page.evaluate(() => document.querySelector(".af").parentElement.setAttribute("data-spindle-extension-root", "auto_foley"));
    await page.focus('.af-tab[data-tab="settings"]');
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);
    check(!(await playing()), where + ": in Auto Foley's own tab the keys still pause");
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);

        // Switched off, the keys do nothing.
    await page.evaluate(() => document.querySelector('[data-af-row="pauseKeyOn"] .af-box').click());
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("Control+Shift+KeyK");
    await page.waitForTimeout(100);
    check(await playing(), where + ": switched off, the keys do nothing");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("number boxes")) {
  console.log("Numbers are typed in boxes, as in Auto Retry and Auto Refine");
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size);
    const ranges = [];
    for (const tab of TABS) {
      await showTab(page, tab);
      const got = await page.evaluate(() => Array.from(document.querySelectorAll('.af input[type="range"]')).filter((r) => !r.classList.contains("af-colorrange") && !r.closest(".af-mixer") && !r.closest("[data-af-byeye]")).map((r) => (r.closest(".af-col") || r.parentElement).textContent.trim().slice(0, 40)));
      for (const g of got) ranges.push(tab + ": " + g);
    }
    check(ranges.length === 0, where + ": no slider is left outside the color editor and the Mixer (" + ranges.join(" | ") + ")");
    await showTab(page, "stage");
    const mixer = await page.evaluate(() => Array.from(document.querySelectorAll('.af-mixer input[type="range"]')).length);
    check(mixer === 2, where + ": the Mixer's Voices and Sounds volume are sliders (" + mixer + ")");
    await showTab(page, "settings");
    const held = await page.evaluate(async () => {
      const row = Array.from(document.querySelectorAll(".af-col")).find((c) => /^How loud they cheer \(%\)/.test((c.querySelector(".af-lab") || {}).textContent || ""));
      if (!row) return null;
      const box = row.querySelector('input[type="number"]');
      box.value = "150";
      box.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((x) => setTimeout(x, 700));
      return { box: box.value, saved: window.__settings.applauseVolume };
    });
    check(!!held && held.box === "100" && held.saved === 1, where + ": a number above the range is held to the top of it (" + JSON.stringify(held) + ")");
    // A preview follows a number as it is typed, before the box is left.
    const live = await page.evaluate(async () => {
      const bg = () => getComputedStyle(document.querySelector(".af-wordsample")).backgroundColor;
      const row = Array.from(document.querySelectorAll(".af-col")).find((c) => /^How strong it is/.test((c.querySelector(".af-lab") || {}).textContent || ""));
      const box = row.querySelector('input[type="number"]');
      const before = bg();
      box.focus();
      box.value = "70";
      box.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((x) => setTimeout(x, 150));
      return { before, typed: bg(), box: box.value };
    });
    check(/0\.2\)$/.test(live.before) && /0\.7\)$/.test(live.typed) && live.box === "70", where + ": the lit word preview follows How strong it is as it is typed (" + JSON.stringify(live) + ")");
    const look = await page.evaluate((touch) => {
      const small = [];
      for (const b of document.querySelectorAll('.af input[type="number"]')) {
        if (b.closest("[hidden]") || !b.getClientRects().length) continue;
        if (touch && b.getBoundingClientRect().height < 32) small.push(b.id + ":" + b.getBoundingClientRect().height);
      }
      return { small, side: document.documentElement.scrollWidth > window.innerWidth + 1 };
    }, size.touch);
    check(!look.small.length, where + ": every number box is at least 32 pixels high on a phone (" + look.small.join(", ") + ")");
    check(!look.side, where + ": nothing runs off the side");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("dropdown press")) {
  console.log("A pressed dropdown keeps its plain edge, as in Auto Retry and Auto Refine");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    const got = await page.evaluate(async () => {
      const sel = Array.from(document.querySelectorAll(".af select.af-field")).find((s) => s.getClientRects().length);
      const edge = () => { const c = getComputedStyle(sel); return [c.borderTopColor, c.boxShadow, c.outlineStyle].join(" | "); };
      sel.blur();
      await new Promise((r) => setTimeout(r, 250));
      const before = edge();
      sel.focus();
      await new Promise((r) => setTimeout(r, 250));
      return { before, after: edge() };
    });
    check(got.before === got.after, size.name + ": the edge does not change when it is pressed (" + JSON.stringify(got) + ")");
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("still working")) {
  console.log("A slow Director is waited for while the backend says it is still working");
  for (const size of SIZES) {
    const where = size.name;
    // The backend holds the script for 2.5 seconds, and the panel gives up
    // after 0.8 seconds with no word from it.
    for (const [label, every] of [["still working", 300], ["silent", 0]]) {
      const { context, page, errors } = await open(THEMES[0], size, 1, () => {
        window.__directWait = 800;
      });
      await page.evaluate((every) => { window.__directHold = 2500; window.__workingEvery = every; window.__played = 0; }, every);
      await page.click('.af-tab[data-tab="stage"]');
      await page.waitForTimeout(150);
      // The line under Nothing playing shows in two lines at most, so what
      // it says has to fit in them, whole.
      const whole = () => page.evaluate(() => Array.from(document.querySelectorAll(".af-now-sub")).filter((n) => n.getClientRects().length).map((n) => ({ text: n.textContent, cut: n.scrollHeight > n.clientHeight + 1 })));
      const idle = await whole();
      check(idle.length > 0 && idle.every((x) => !x.cut), where + ", " + label + ": the line under Nothing playing is shown whole (" + JSON.stringify(idle) + ")");
      await page.click('#mount [data-af-slot="message"]');
      await page.waitForTimeout(3600);
      const got = await page.evaluate(() => ({ played: window.__played || 0, said: (document.querySelector(".af") || {}).innerText || "" }));
      if (every) check(got.played > 0 && !/backend stopped/.test(got.said), where + ": a backend that says it is still working is waited for, and the message plays (" + got.played + " played)");
      else {
        check(got.played === 0 && /The backend stopped\. Reload the page\./.test(got.said), where + ": a backend that goes silent is given up on, with a plain reason");
        const said = await whole();
        check(said.every((x) => !x.cut), where + ": and the reason is shown whole (" + JSON.stringify(said) + ")");
      }
      check(!errors.length, where + ", " + label + ": no page errors. " + errors.slice(0, 2).join(" | "));
      await context.close();
    }
  }
}

if (section("gemini style")) {
  console.log("Gemini gets the person's Gemini style and the line's own note together");
  const { context, page, errors } = await open(THEMES[0], SIZES[1], 1, () => {
    window.__ttsList = [{ id: "t1", name: "Gemini here", provider: "google_tts", model: "gemini-3.8-flash-tts", is_default: true, has_api_key: true }];
    window.__settings.ttsConnection = "t1";
    window.__settings.cast = window.__settings.cast.map((m) => (m.id === "a" ? Object.assign({}, m, { params: { style_base: "Warm and unhurried, with a light Southern accent." } }) : m));
    window.__script = JSON.parse(JSON.stringify(SCRIPT));
    window.__script.lines[1].style = "quiet and hurt";
  });
  await page.evaluate(() => { window.__clipMs = 200; window.__synth = []; });
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(150);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForTimeout(2500);
  const sent = await page.evaluate(() => (window.__synth || []).map((b) => ({ text: b.text, style: (b.parameters || {}).speech_style })));
  const hers = sent.find((b) => /You are late/.test(b.text || ""));
  check(!!hers && hers.style === "Warm and unhurried, with a light Southern accent. This line: quiet and hurt", "her line is sent with her Gemini style first, then its own note (" + JSON.stringify(hers) + ")");
  const narr = sent.find((b) => /set the cup down/.test(b.text || ""));
  check(!!narr && !narr.style, "the narrator, with neither, sends no style of its own (" + JSON.stringify(narr) + ")");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("display name")) {
  console.log("A display name shows in the panel and the players, and the name stays for the Director");
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size, 1, () => {
      window.__settings.cast = window.__settings.cast.map((m) => (m.id === "a" ? Object.assign({}, m, { display: "The Harbormistress" }) : m.id === "n" ? Object.assign({}, m, { display: "Old Wren" }) : m));
      window.__settings.widgetOn = true;
    });
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    const heads = await page.evaluate(() => Array.from(document.querySelectorAll(".af-person-name b")).map((b) => b.textContent));
    check(heads.indexOf("The Harbormistress") >= 0 && heads.indexOf("Old Wren") >= 0, where + ": the cards show the display names (" + heads.join(", ") + ")");
    // A to Z goes by the name shown.
    await page.selectOption("[data-af-castsort] select", "az");
    await page.waitForTimeout(400);
    const az = await page.evaluate(() => Array.from(document.querySelectorAll(".af-person-name b")).map((b) => b.textContent));
    check(az.join("|") === ["Ferryman", "Old Wren", "The Harbormistress", "Wyn"].join("|"), where + ": A to Z sorts by the name shown (" + az.join(", ") + ")");
    // Typed on a card, it is saved, and the name is kept.
    await page.evaluate(() => document.querySelector('.af-person[data-person="b"] .af-person-head').click());
    await page.waitForTimeout(450);
    await page.fill('.af-person[data-person="b"] [data-af-display] input', "Captain Oarlock");
    await page.waitForTimeout(700);
    const savedB = await page.evaluate(() => window.__settings.cast.find((m) => m.id === "b"));
    check(savedB.display === "Captain Oarlock" && savedB.name === "Ferryman", where + ": a typed display name is saved, and the name is kept (" + JSON.stringify({ display: savedB.display, name: savedB.name }) + ")");
    const tall = await page.evaluate(() => document.querySelector('.af-person[data-person="b"] [data-af-display] input').getBoundingClientRect().height);
    if (size.touch) check(tall >= 32, where + ": the box is at least 32 pixels high (" + tall + ")");
    // While a line plays, the stage shows who says it by the name shown.
    await page.evaluate(() => { window.__clipMs = 1500; });
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(200);
    await page.click('#mount [data-af-slot="message"]');
    const seen = await page.evaluate(async () => {
      const out = new Set();
      for (let k = 0; k < 80; k++) {
        const w = document.querySelector('[data-af="who"]');
        if (w && w.textContent.trim()) out.add(w.textContent.trim());
        await new Promise((r) => setTimeout(r, 60));
      }
      return Array.from(out);
    });
    check(seen.some((t) => /Old Wren/.test(t)) && seen.some((t) => /The Harbormistress/.test(t)) && !seen.some((t) => /^.?Narrator$/.test(t)), where + ": the stage shows the display names while they speak (" + seen.join(" | ") + ")");
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), where + ": nothing runs off the side");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("select several")) {
  console.log("Several people can be picked, then put in a group or removed together");
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size, 1, () => {
      window.__settings.groups = [{ id: "g1", name: "The harbor", open: true }];
    });
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    check(!(await page.$("[data-af-pickbar]")) && !(await page.$("[data-af-pick]")), where + ": no tick boxes or bar until Select is pressed");
    await page.click("[data-af-select]");
    // The bar fades in and slides, rather than appearing at once.
    const fading = await page.evaluate(async () => {
      const seen = [];
      for (let k = 0; k < 8; k++) {
        const b = document.querySelector("[data-af-pickbar]");
        if (b) seen.push(Number(getComputedStyle(b).opacity));
        await new Promise((r) => requestAnimationFrame(r));
      }
      return seen;
    });
    check(fading.length > 0 && fading.some((o) => o > 0 && o < 1), where + ": the bar fades in (" + fading.map((o) => o.toFixed(2)).join(",") + ")");
    await page.waitForTimeout(500);
    check((await page.evaluate(() => Number(getComputedStyle(document.querySelector("[data-af-pickbar]")).opacity))) === 1, where + ": and ends fully shown");
    const picks = await page.evaluate(() => Array.from(document.querySelectorAll("[data-af-pick]")).map((b) => b.getAttribute("data-af-pick")));
    check(picks.sort().join(",") === "a,b,c", where + ": every person but the narrator has a tick box (" + picks.join(",") + ")");
    const tick = await page.evaluate(() => { const b = document.querySelector("[data-af-pick]"); return { type: b.type, role: b.getAttribute("role"), w: b.getBoundingClientRect().width, look: getComputedStyle(b).appearance }; });
    check(tick.type === "checkbox" && tick.role === null && tick.w === 20 && tick.look === "none", where + ": it is a tick box drawn like Auto Retry's, not a switch (" + JSON.stringify(tick) + ")");
    const start = await page.evaluate(() => ({ said: document.querySelector("[data-af-pickcount]").textContent, off: document.querySelector("[data-af-pickremove]").disabled }));
    check(/Nobody is selected/.test(start.said) && start.off, where + ": with nobody picked it says so, and Remove cannot be pressed");
    // Two people go in the group.
    await page.click('[data-af-pick="b"]');
    await page.click('[data-af-pick="c"]');
    await page.waitForTimeout(150);
    check(/2 people are selected/.test(await page.evaluate(() => document.querySelector("[data-af-pickcount]").textContent)), where + ": it counts the people picked");
    await page.selectOption("[data-af-pickbar] select", "g1");
    await page.click("[data-af-pickmove]");
    await page.waitForTimeout(700);
    const grouped = await page.evaluate(() => window.__settings.cast.filter((m) => m.group === "g1").map((m) => m.id).sort().join(","));
    check(grouped === "b,c", where + ": Put them in it puts both in the group (" + grouped + ")");
    check(!(await page.$("[data-af-pickbar]")), where + ": and picking ends");
    // Everyone but the narrator is removed together, after one question.
    await page.click("[data-af-select]");
    await page.waitForTimeout(400);
    await page.click("[data-af-pickall]");
    await page.waitForTimeout(150);
    const look = await page.evaluate((touch) => {
      const small = [];
      for (const n of document.querySelectorAll("[data-af-pickbar] button, [data-af-pickbar] select")) {
        const h = n.getBoundingClientRect().height;
        if (touch && h < 32) small.push((n.textContent || n.tagName).trim().slice(0, 20) + ":" + h);
      }
      // A tick box answers a tap 6 pixels around it on a touch screen, as in
      // Auto Retry, so the place to tap is its size plus 12.
      for (const n of document.querySelectorAll("[data-af-pick]")) {
        const reach = n.getBoundingClientRect().height - 2 * (parseFloat(getComputedStyle(n, "::before").top) || 0);
        if (touch && reach < 32) small.push((n.getAttribute("aria-label") || "tick").slice(0, 20) + ":" + reach);
      }
      return { small, side: document.documentElement.scrollWidth > window.innerWidth + 1 };
    }, size.touch);
    if (size.touch) check(!look.small.length, where + ": everything in the bar is at least 32 pixels high (" + look.small.join(", ") + ")");
    check(!look.side, where + ": nothing runs off the side");
    await page.evaluate(() => { window.__asked = 0; });
    await page.click("[data-af-pickremove]");
    await page.waitForTimeout(700);
    const left = await page.evaluate(() => ({ ids: window.__settings.cast.map((m) => m.id), asked: window.__asked }));
    check(left.asked === 1 && left.ids.join(",") === "n", where + ": Remove asks once, then removes all three and keeps the narrator (" + JSON.stringify(left) + ")");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("kind colors")) {
  console.log("Each kind of part can have a color of the reader's own");
  // The color drawn at a point inside an element, read from a screenshot.
  const drawnAt = async (page, sel, fx, fy) => {
    const buf = await page.locator(sel).first().screenshot();
    return page.evaluate(async ([b64, fx, fy]) => {
      const img = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      return Array.from(g.getImageData(Math.floor(img.width * fx), Math.floor(img.height * fy), 1, 1).data).slice(0, 3);
    }, [buf.toString("base64"), fx, fy]);
  };
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size);
    // The NPC's ring, before: the built-in pink.
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    const ring = '.af-person[data-person="b"] .af-person-head .af-avatar';
    const pink = await drawnAt(page, ring, 0.04, 0.5);
    check(pink[0] > 200 && pink[1] < 160 && pink[2] > 140, where + ": an NPC's ring is pink at first (" + pink.join(",") + ")");
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => Array.from(document.querySelectorAll(".af-fold")).find((b) => /Colors for each kind of part/.test(b.textContent)).click());
    await page.waitForTimeout(400);
    const row = '[data-af-row="colorNpc"]';
    check((await page.locator(row).count()) === 1 && (await page.locator('[data-af-row="colorNarrator"], [data-af-row="colorCharacter"], [data-af-row="colorPersona"], [data-af-row="colorSound"], [data-af-row="colorTag"]').count()) === 5, where + ": the fold has a color for each of the six kinds of part");
    await page.locator(row + " [data-af-colorswatch]").scrollIntoViewIfNeeded();
    await page.click(row + " [data-af-colorswatch]");
    await page.waitForTimeout(400);
    await page.fill(row + " [data-af-colorcode]", "#22cc44");
    await page.locator(row + " [data-af-colorcode]").press("Enter");
    await page.locator(row + " [data-af-colorcode]").blur();
    await page.waitForTimeout(700);
    check(await page.evaluate(() => window.__settings.colorNpc === "#22cc44"), where + ": the NPC color is saved");
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    const green = await drawnAt(page, ring, 0.04, 0.5);
    check(green[1] > 150 && green[0] < 100 && green[2] < 120, where + ": the NPC's ring is drawn in the new color (" + green.join(",") + ")");
    // The built-in color comes back.
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => Array.from(document.querySelectorAll(".af-fold")).find((b) => /Colors for each kind of part/.test(b.textContent)).click());
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => { const b = document.querySelector('[data-af-row="colorNpc"] [data-af-colorback]'); return b ? b.textContent.trim() : ""; });
    check(back === "Use the built-in color", where + ": its button says Use the built-in color (" + back + ")");
    await page.click(row + " [data-af-colorback]");
    await page.waitForTimeout(500);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    const again = await drawnAt(page, ring, 0.04, 0.5);
    check(again[0] > 200 && again[2] > 140 && (await page.evaluate(() => window.__settings.colorNpc === "")), where + ": Use the built-in color puts pink back (" + again.join(",") + ")");
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), where + ": nothing runs off the side");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("reorder")) {
  console.log("People and groups can be picked up and moved");
  const order = (page, sel, attr) => page.evaluate(([sel, attr]) => Array.from(document.querySelectorAll(sel)).map((n) => n.getAttribute(attr)), [sel, attr]);
  // Drags a grip to a point with a mouse, or with a finger on a phone, in
  // small steps, and reports how far the row moved on screen halfway.
  const drag = async (page, context, touch, gripSel, toY) => {
    const g = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, gripSel);
    const rowTop = () => page.evaluate((sel) => document.querySelector(sel).closest(".af-person, .af-group").getBoundingClientRect().top, gripSel);
    const start = await rowTop();
    const steps = 12;
    let mid = null;
    if (touch) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: g.x, y: g.y }] });
      for (let k = 1; k <= steps; k++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: g.x, y: g.y + ((toY - g.y) * k) / steps }] });
        await page.waitForTimeout(16);
        if (k === steps / 2) mid = { moved: (await rowTop()) - start, pointer: ((toY - g.y) * k) / steps };
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await page.mouse.move(g.x, g.y);
      await page.mouse.down();
      for (let k = 1; k <= steps; k++) {
        await page.mouse.move(g.x, g.y + ((toY - g.y) * k) / steps);
        await page.waitForTimeout(16);
        if (k === steps / 2) mid = { moved: (await rowTop()) - start, pointer: ((toY - g.y) * k) / steps };
      }
      await page.mouse.up();
    }
    await page.waitForTimeout(700);
    return mid;
  };
  const runs = [[SIZES[0], 1], [SIZES[1], 1], [SIZES[1], 1.25], [SIZES[1], 0.85]];
  for (const [size, zoom] of runs) {
    const where = size.name + (zoom !== 1 ? ", zoom " + zoom : "");
    const { context, page, errors } = await open(THEMES[0], size, zoom, () => {
      window.__settings.groups = [{ id: "g1", name: "The harbor", open: true }, { id: "g2", name: "The mill", open: true }];
    });
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(400);
    check(JSON.stringify(await order(page, ".af-page > .af-person, .af > * .af-person", "data-person")) !== "[]", where + ": the cast is shown");
    const before = await order(page, ".af-person", "data-person");
    check(JSON.stringify(before) === JSON.stringify(["n", "c", "a", "b"]), where + ": sorted by kind at first (" + before.join(",") + ")");
    const sortIs = () => page.evaluate(() => document.querySelector("[data-af-castsort] select").value);
    check((await sortIs()) === "kind", where + ": Sort the cast says By kind");
    const tall = await page.evaluate(() => Array.from(document.querySelectorAll(".af-grip")).every((g) => g.getBoundingClientRect().height >= 32));
    if (size.touch) check(tall, where + ": every grip is at least 32 pixels high");

    // The NPC, last, is dragged above the narrator, with both on screen.
    await page.evaluate(() => document.querySelector('.af-person[data-person="n"]').scrollIntoView({ block: "start" }));
    await page.waitForTimeout(100);
    const topY = await page.evaluate(() => document.querySelector('.af-person[data-person="n"]').getBoundingClientRect().top + 4);
    const mid = await drag(page, context, size.touch, '.af-person[data-person="b"] .af-grip', topY);
    check(!!mid && Math.abs(mid.moved - mid.pointer) <= 2, where + ": the row follows the pointer while it is held (" + JSON.stringify(mid) + ")");
    const after = await order(page, ".af-person", "data-person");
    check(JSON.stringify(after) === JSON.stringify(["b", "n", "c", "a"]), where + ": let go above the narrator, it is first (" + after.join(",") + ")");
    const saved = await page.evaluate(() => ({ ids: window.__settings.cast.map((m) => m.id), sort: window.__settings.castSort }));
    check(saved.ids[0] === "b" && saved.sort === "own", where + ": the new order is saved (" + JSON.stringify(saved) + ")");
    check((await sortIs()) === "own", where + ": Sort the cast now says My own order");
    const still = await page.evaluate(() => Array.from(document.querySelectorAll(".af-person, .af-group")).every((n) => !n.style.transform && !n.classList.contains("af-lifted")));
    check(still, where + ": no row is left lifted or moved");

    // The arrow keys move one place.
    await page.focus('.af-person[data-person="c"] .af-grip');
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    const keyed = await order(page, ".af-person", "data-person");
    check(JSON.stringify(keyed) === JSON.stringify(["b", "n", "a", "c"]), where + ": the down arrow moves a person one place (" + keyed.join(",") + ")");

    // Groups move the same way.
    await page.evaluate(() => document.querySelector('.af-group[data-group="g1"]').scrollIntoView({ block: "start" }));
    await page.waitForTimeout(100);
    const g1Top = await page.evaluate(() => document.querySelector('.af-group[data-group="g1"]').getBoundingClientRect().top + 4);
    await drag(page, context, size.touch, '.af-group[data-group="g2"] .af-grip', g1Top);
    const gOrder = await order(page, ".af-group", "data-group");
    check(JSON.stringify(gOrder) === JSON.stringify(["g2", "g1"]), where + ": a group dragged above another is first (" + gOrder.join(",") + ")");
    await page.waitForTimeout(700);
    check((await page.evaluate(() => window.__settings.groups.map((g) => g.id).join(","))) === "g2,g1", where + ": and the group order is saved");

    // Held near the edge of a drawer that scrolls, the drawer scrolls, and
    // stops at its end even though the lifted row makes it taller.
    if (!size.touch && zoom === 1) {
      await page.evaluate(() => {
        const d = document.querySelector("#drawer");
        d.style.height = "320px";
        d.style.overflowY = "auto";
        d.scrollTop = d.scrollHeight;
      });
      await page.waitForTimeout(100);
      const hold = async (toEdge) => {
        const g = await page.evaluate(() => { const d = document.querySelector("#drawer"); const grips = Array.from(document.querySelectorAll(".af-person .af-grip")); const r = grips[grips.length - 1].getBoundingClientRect(); const b = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: b.top, bottom: b.bottom, was: d.scrollTop, most: d.scrollHeight - d.clientHeight }; });
        await page.mouse.move(g.x, g.y);
        await page.mouse.down();
        await page.mouse.move(g.x, g.y + (toEdge === "down" ? 10 : -10));
        await page.mouse.move(g.x, toEdge === "down" ? g.bottom - 8 : g.top + 8);
        await page.waitForTimeout(500);
        const now = await page.evaluate(() => document.querySelector("#drawer").scrollTop);
        await page.mouse.up();
        await page.waitForTimeout(300);
        return { was: g.was, most: g.most, now };
      };
      const down = await hold("down");
      check(down.now <= down.most + 1, where + ": held at the bottom, the drawer does not scroll past its end (" + JSON.stringify(down) + ")");
      await page.evaluate(() => { const d = document.querySelector("#drawer"); d.scrollTop = d.scrollHeight; });
      await page.waitForTimeout(100);
      const up = await hold("up");
      check(up.now < up.was, where + ": held near the top, the drawer scrolls up (" + JSON.stringify(up) + ")");
      await page.evaluate(() => { const d = document.querySelector("#drawer"); d.style.height = ""; d.style.overflowY = ""; });
    }

    // Sort by kind puts it back.
    // The other ways to sort, then back to your own order and to by kind.
    const sortBy = async (how) => {
      await page.selectOption("[data-af-castsort] select", how);
      await page.waitForTimeout(500);
      return (await order(page, ".af-person", "data-person")).join(",");
    };
    const own = (await order(page, ".af-person", "data-person")).join(",");
    check((await sortBy("az")) === "b,n,c,a", where + ": A to Z");
    check((await sortBy("za")) === "a,c,n,b", where + ": Z to A");
    check((await sortBy("voice")) === "a,b,n,c", where + ": by voice type, female, male, then any");
    check((await page.evaluate(() => window.__settings.castSort)) === "voice", where + ": the way it is sorted is saved");
    check((await sortBy("own")) === own, where + ": My own order shows the order it was dragged into (" + own + ")");
    const back = (await sortBy("kind")).split(",");
    check(JSON.stringify(back) === JSON.stringify(["n", "c", "a", "b"]), where + ": By kind puts it back (" + back.join(",") + ")");
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), where + ": nothing runs off the side");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("chat words name")) {
  console.log("Only the message text is lit, not the name above it");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  // As Lumiverse lays a message out: the name, then the text in its own box.
  // The text starts with the same word as the name.
  await page.evaluate(() => {
    window.__wav = [0.05, 2.4];
    window.__clipMs = 2500;
    const msg = document.querySelector('[data-message-id="m1"]');
    const p = msg.querySelector("p");
    const head = document.createElement("div");
    head.className = "name";
    head.textContent = "She";
    const content = document.createElement("div");
    content.setAttribute("data-component", "MessageContent");
    p.replaceWith(content);
    content.appendChild(p);
    msg.insertBefore(head, content);
    p.textContent = 'She set the cup down on the long table by the window.';
  });
  await page.click('#mount [data-af-slot="message"]');
  const where = await page.evaluate(async () => {
    const out = [];
    for (let k = 0; k < 120; k++) {
      const h = CSS.highlights.get("auto-foley-word");
      if (h) for (const r of h) out.push(r.startContainer.parentElement && r.startContainer.parentElement.closest('[data-component="MessageContent"]') ? "text" : "outside");
      await new Promise((r) => setTimeout(r, 20));
    }
    return out;
  });
  check(where.length > 0 && where.every((x) => x === "text"), "every lit word is in the message text (" + where.filter((x) => x === "outside").length + " outside of " + where.length + ")");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("chat words")) {
  console.log("The word being spoken is lit in the chat, without changing the message");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.evaluate(() => {
    window.__wav = [0.2, 2.2];
    window.__clipMs = 2400;
    document.querySelector('[data-message-id="m1"] p').innerHTML = 'She set the cup down on the long table by the window. <em>"You are late.</em> Again." "The tide does not wait for anyone, and neither does the boat that runs on it."';
  });
  const before = await page.evaluate(() => document.querySelector('[data-message-id="m1"]').innerHTML.replace(/<button[\s\S]*?<\/button>/g, ""));
  await page.click('#mount [data-af-slot="message"]');
  const seen = await page.evaluate(async () => {
    const out = new Set();
    for (let k = 0; k < 200; k++) {
      const h = CSS.highlights.get("auto-foley-word");
      if (h) for (const r of h) out.add(r.toString());
      await new Promise((r) => setTimeout(r, 25));
    }
    return Array.from(out);
  });
  const after = await page.evaluate(() => document.querySelector('[data-message-id="m1"]').innerHTML.replace(/<button[\s\S]*?<\/button>/g, ""));
  check(seen.length >= 3 && seen.every((w) => /^[A-Za-z]+$/.test(w)) && seen.some((w) => /^(set|cup|table|window|late|Again)$/.test(w)), "words of the line playing are lit in the chat, one at a time (" + seen.slice(0, 8).join(" ") + ")");
  check(before === after, "the message itself is not changed");
  // Lumiverse can draw the message again while it is read, as it does just
  // after a reply finishes. The light finds the words in the new copy.
  await page.waitForTimeout(8000);
  await page.click('#mount [data-af-slot="message"]');
  const redrawn = await page.evaluate(async () => {
    const p = document.querySelector('[data-message-id="m1"] p');
    const html = p.innerHTML;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // Played again from the start, and the copy swapped while a line is lit.
    for (let k = 0; k < 120; k++) {
      const h = CSS.highlights.get("auto-foley-word");
      if (h && h.size) break;
      await wait(25);
    }
    p.innerHTML = html;
    const lit = [];
    for (let k = 0; k < 12; k++) {
      await wait(40);
      const h = CSS.highlights.get("auto-foley-word");
      let on = false;
      // A word whose text was taken off the page shrinks to nothing, so a
      // lit word is one with its text still in it.
      if (h) for (const r of h) on = on || (!r.collapsed && r.startContainer.isConnected && r.toString().trim().length > 0);
      lit.push(on);
    }
    return lit;
  });
  check(redrawn.slice(4).some((x) => x), "after the message is drawn again, the words are lit in the new copy (" + redrawn.join(",") + ")");
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-af-row="chatHighlight"] .af-box').click());
  await page.waitForTimeout(150);
  check(await page.evaluate(() => !CSS.highlights.get("auto-foley-word")), "turning Light up words in the chat off clears it");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("chat words jump")) {
  console.log("After Back, Next or a tap on a part, the lit words are in the line playing");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    window.__wav = [0.1, 2.3];
    window.__clipMs = 2400;
    const line = (i, kind, speaker, text) => ({ i, kind, speaker, text, plain: '', tags: [], inSounds: [], big: false, before: '', after: '', note: '' });
    // Each line starts with the same words, so a search that starts in the
    // wrong place finds them in another line.
    window.__script = { key: 'kj', messageId: 'm1', author: 'Ysolde Marrow-Kestrel of the Lower Quays', directed: true, added: [], sent: 10, back: 10, counted: true, log: [], lines: [
      line(0, 'narration', 'Narrator', 'Rain hit the glass of the low window.'),
      line(1, 'speech', 'Ysolde Marrow-Kestrel of the Lower Quays', 'Rain hit the roof and ran down the gutter.'),
      line(2, 'speech', 'Ferryman', 'Rain hit the road as the cart rolled in.'),
    ] };
    document.querySelector('[data-message-id="m1"] p').innerHTML = '<span id="s0">Rain hit the glass of the low window.</span> "<span id="s1">Rain hit the roof and ran down the gutter.</span>" "<span id="s2">Rain hit the road as the cart rolled in.</span>"';
  });
  await page.click('#mount [data-af-slot="message"]');
  const litIn = () => page.evaluate(async () => {
    const out = new Set();
    for (let k = 0; k < 24; k++) {
      const h = CSS.highlights.get("auto-foley-word");
      if (h) for (const r of h) { const sp = r.startContainer.parentElement && r.startContainer.parentElement.closest("span[id]"); out.add(sp ? sp.id : "none"); }
      await new Promise((r) => setTimeout(r, 25));
    }
    return Array.from(out);
  });
  const first = await litIn();
  await page.click('[data-af="parts"] [data-at="2"]');
  await page.waitForTimeout(150);
  const jumped = await litIn();
  await page.click('[data-af="back"]');
  await page.waitForTimeout(150);
  const back = await litIn();
  await page.click('[data-af="skip"]');
  await page.waitForTimeout(150);
  const next = await litIn();
  check(first.join() === "s0", "the first line lights its own words (" + first.join() + ")");
  check(jumped.join() === "s2", "a tap on the third part lights the third line (" + jumped.join() + ")");
  check(back.join() === "s1", "Back lights the second line (" + back.join() + ")");
  check(next.join() === "s2", "Next lights the third line again (" + next.join() + ")");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("big moments warning")) {
  console.log("The Big moments warning shows only when Big moments do nothing");
  const { context, page, errors } = await open(THEMES[0], SIZES[0]);
  await page.evaluate(() => {
    window.__teardown();
    document.getElementById("drawer").innerHTML = "";
    window.__ttsList = [{ id: "t1", name: "Fish here", provider: "fish_audio", model: "s2.1-pro", is_default: true, has_api_key: true }];
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
  });
  await page.waitForTimeout(300);
  const shown = async () => {
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(200);
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(400);
    return (await page.locator(".af-warn", { hasText: "Big moments do nothing" }).count()) > 0;
  };
  check(await shown(), "on Fish Audio, with the audience not cheering on big moments, it says Big moments do nothing");
  // Turned off, the warning goes at once.
  await page.locator('[data-af-row="bigMoments"] .af-box').first().click();
  await page.waitForTimeout(300);
  check((await page.locator(".af-warn", { hasText: "Big moments do nothing" }).count()) === 0, "turning Big moments off takes the warning away at once");
  // With the audience cheering on big moments, they do something, so no warning.
  await page.evaluate(() => {
    window.__teardown();
    document.getElementById("drawer").innerHTML = "";
    window.__settings = Object.assign({}, window.__settings, { bigMoments: true, applauseOn: true, applauseWhen: "big" });
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
  });
  await page.waitForTimeout(300);
  check(!(await shown()), "with the audience cheering on big moments, there is no warning");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("fish drama")) {
  console.log("Drama 3 is asked for by the name Fish Audio knows, with the Fish Audio direction in the line");
  for (const [model, expect] of [["drama-3-preview", "drama-3"], ["s2.1-pro", ""]]) {
    const { context, page, errors } = await open(THEMES[0], SIZES[0]);
    await page.evaluate((model) => {
      window.__teardown();
      document.getElementById("drawer").innerHTML = "";
      window.__ttsList = [{ id: "t1", name: "Fish here", provider: "fish_audio", model, is_default: true, has_api_key: true }];
      window.__settings = Object.assign({}, window.__settings, { ttsConnection: "t1", cast: window.__settings.cast.map((m) => Object.assign({}, m, { params: { direction: "low and [tired]" } })) });
      window.__synth = [];
      window.__clipMs = 40;
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    }, model);
    await page.waitForTimeout(400);
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForFunction(() => (window.__synth || []).length > 0, null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const sent = await page.evaluate(() => window.__synth || []);
    const one = sent[0] || {};
    if (expect) {
      check(sent.length > 0 && sent.every((b) => b.model === "drama-3"), model + ": every line asks Fish Audio for drama-3 (" + sent.map((b) => b.model).join(", ") + ")");
      check(sent.length > 0 && sent.every((b) => /^\[low and tired\] /.test(b.text) && !(b.parameters || {}).voice_direction), model + ": the direction is at the start of each line, and not sent beside it (" + String(one.text).slice(0, 40) + ")");
    } else {
      check(sent.length > 0 && sent.every((b) => b.model !== "drama-3" && (b.parameters || {}).voice_direction === "low and [tired]" && !/^\[low and tired\]/.test(b.text)), model + ": other Fish models are sent as before, with the direction beside the line");
    }
    check(!errors.length, model + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("colors")) {
  console.log("Colors for the player and the lit word, picked in their own editor");
  // The color drawn at the middle of an element, read from a screenshot.
  const drawn = async (page, sel) => {
    const buf = await page.locator(sel).first().screenshot();
    return page.evaluate(async (b64) => {
      const img = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      return Array.from(g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data).slice(0, 3);
    }, buf.toString("base64"));
  };
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    const row = '[data-af-row="playerAccent"]';
    await page.locator(row + " [data-af-colorswatch]").scrollIntoViewIfNeeded();
    await page.click(row + " [data-af-colorswatch]");
    await page.waitForTimeout(400);
    await page.fill(row + " [data-af-colorcode]", "#ff0040");
    await page.locator(row + " [data-af-colorcode]").press("Enter");
    await page.locator(row + " [data-af-colorcode]").blur();
    await page.waitForTimeout(700);
    const accent = await page.evaluate(() => document.documentElement.style.getPropertyValue("--af-mp-accent"));
    check(accent === "#ff0040", where + ": a typed code is put on the page for the player (" + accent + ")");
    check(await page.evaluate(() => window.__settings.playerAccent === "#ff0040"), where + ": it is saved with the settings");
    const bar = await drawn(page, ".af-mpsample .af-mp-bar i");
    check(bar[0] > 200 && bar[1] < 60 && bar[2] < 110, where + ": the sample player draws its line in that color (" + bar.join(",") + ")");
    // A slider changes the code shown.
    const before = await page.inputValue(row + " [data-af-colorcode]");
    await page.locator(row + ' [data-af-colorpart="h"]').fill("200");
    await page.waitForTimeout(300);
    const after = await page.inputValue(row + " [data-af-colorcode]");
    check(before !== after && /^#[0-9a-f]{6}$/.test(after), where + ": the hue slider changes the color (" + before + " to " + after + ")");
    await page.click(row + " [data-af-colorback]");
    await page.waitForTimeout(400);
    check(await page.evaluate(() => !document.documentElement.style.getPropertyValue("--af-mp-accent") && window.__settings.playerAccent === ""), where + ": Use the theme's color clears it");
    // The lit word.
    const wrow = '[data-af-row="wordColor"]';
    await page.locator(wrow + " [data-af-colorswatch]").scrollIntoViewIfNeeded();
    await page.click(wrow + " [data-af-colorswatch]");
    await page.waitForTimeout(400);
    await page.fill(wrow + " [data-af-colorcode]", "#00ff88");
    await page.locator(wrow + " [data-af-colorcode]").blur();
    await page.waitForTimeout(500);
    const word = await page.evaluate(() => document.documentElement.style.getPropertyValue("--af-word"));
    check(word === "rgba(0,255,136,0.2)", where + ": the lit word takes the color at 20 per cent (" + word + ")");
    const lit = await drawn(page, ".af-wordsample");
    check(lit[1] > lit[0] + 20 && lit[1] > lit[2], where + ": the sample word is drawn green (" + lit.join(",") + ")");
    const m = await page.evaluate(MEASURE, !!size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the color rows fit, with tap targets big enough. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    await page.evaluate(() => window.__teardown());
    check(await page.evaluate(() => !document.documentElement.style.getPropertyValue("--af-word")), where + ": teardown takes the colors off the page");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("sampler range")) {
  console.log("A sampler box keeps its number in range, as in Auto Refine");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(300);
    await page.locator(".af-fold", { hasText: "Samplers" }).first().click();
    await page.waitForTimeout(400);
    const box = page.locator('[data-af-sampler="top_p"]');
    await box.scrollIntoViewIfNeeded();
    check((await box.getAttribute("placeholder")) === "Leave to the connection", where + ": an empty box says Leave to the connection");
    await box.fill("5");
    await box.blur();
    await page.waitForTimeout(500);
    const held = await page.evaluate(() => ({ box: document.querySelector('[data-af-sampler="top_p"]').value, saved: (window.__settings.samplers || {}).top_p }));
    check(held.box === "1" && held.saved === 1, where + ": a number above the range is held to the top of it (" + JSON.stringify(held) + ")");
    await box.fill("");
    await box.blur();
    await page.waitForTimeout(500);
    const gone = await page.evaluate(() => !("top_p" in (window.__settings.samplers || {})));
    check(gone, where + ": an emptied box hands it back to the connection");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("size box")) {
  console.log("The floating button's size is a number box held to 28 to 96, as in Auto Retry and Auto Refine");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(500);
    const box = page.locator('[data-af-row="widgetSize"] input');
    await box.scrollIntoViewIfNeeded();
    check((await box.getAttribute("type")) === "number" && (await box.getAttribute("min")) === "28" && (await box.getAttribute("max")) === "96", where + ": it is a number box from 28 to 96");
    await box.fill("200");
    await box.blur();
    await page.waitForTimeout(400);
    const big = await page.evaluate(() => ({ box: document.querySelector('[data-af-row="widgetSize"] input').value, saved: window.__settings.widgetSize, w: parseFloat(window.__widget.style.width) }));
    check(big.box === "96" && big.saved === 96 && big.w === 96, where + ": a number above the range is held to 96, and the button takes it (" + JSON.stringify(big) + ")");
    if (size.touch) check((await box.boundingBox()).height >= 32, where + ": the box is at least 32 pixels tall");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("more settings")) {
  console.log("Each person gets a voice name or ID box and the settings their engine takes");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    await page.locator(".af-person-head").first().click();
    await page.waitForTimeout(600);
    const got = await page.evaluate(async () => {
      const p = document.querySelector(".af-person");
      const idBox = p.querySelector("[data-af-voiceid] input");
      idBox.value = "my-cloned-voice-77";
      idBox.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 900));
      const cast = window.__settings.cast[0];
      const picked = cast.voices && Object.values(cast.voices).some((v) => v.voice === "my-cloned-voice-77");
      // A name that is in the list, typed in another case, picks that voice.
      const box2 = document.querySelector(".af-person [data-af-voiceid] input");
      box2.value = "grit";
      box2.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 900));
      const named = Object.values(window.__settings.cast[0].voices || {}).some((v) => v.voice === "v2" && v.voiceName === "Grit");
      const fold = document.querySelector(".af-person [data-af-more]");
      const head = fold && fold.querySelector(".af-fold");
      if (head) head.click();
      await new Promise((r) => setTimeout(r, 400));
      const labels = fold ? Array.from(fold.querySelectorAll(".af-lab")).map((x) => x.textContent.trim()) : [];
      const vw = document.documentElement.clientWidth;
      const wide = Array.from(document.querySelectorAll(".af-person *")).filter((e) => e.getBoundingClientRect().right > vw + 0.5).length;
      return { picked, named, engine: fold && fold.getAttribute("data-af-more"), labels, wide };
    });
    check(got.picked, where + ": a typed voice ID is saved as the person's voice");
    check(got.named, where + ": a typed voice name that is in the list picks that voice");
    check(got.engine === "eleven_v3" && got.labels.indexOf("Language") >= 0 && ["Speaker boost", "Style", "Speed", "Similarity"].every((x) => got.labels.indexOf(x) < 0) && got.labels.indexOf("Fish Audio direction") < 0 && got.labels.indexOf("Exaggeration") < 0, where + ": an ElevenLabs voice shows only ElevenLabs settings (" + got.labels.join(", ") + ")");
    check(got.wide === 0, where + ": nothing runs off the side (" + got.wide + ")");
    check(!errors.length, where + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("switch rows")) {
  console.log("Rows under a switch open in place, over several frames");
  const { context, page } = await open(THEMES[0], SIZES[1]);
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__row = document.querySelector('[data-af-row="autoplay"]');
    // In sight, since a row with none of it in sight opens at once.
    window.__row.scrollIntoView({ block: "start" });
    window.__row.querySelector(".af-box").click();
  });
  const mid = await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sub = window.__row.querySelector(".af-sub");
    return { same: window.__row.isConnected, h: sub.getBoundingClientRect().height, hidden: sub.hidden };
  });
  await page.waitForTimeout(500);
  const end = await page.evaluate(() => window.__row.querySelector(".af-sub").getBoundingClientRect().height);
  check(mid.same, "the tab is not drawn again when Autoplay changes");
  check(!mid.hidden && mid.h > 0 && mid.h < end, "Wait before autoplay opens over several frames (" + mid.h.toFixed(1) + " of " + end.toFixed(1) + " px)");
  await context.close();
}

if (section("new person")) {
  console.log("A person added with Add someone shows each change in their header as it is made");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Add someone" }).click();
    await page.waitForTimeout(500);
    const card = page.locator('.af-person[data-open="true"]').last();
    const kind = card.locator("select").filter({ has: page.locator('option[value="persona"]') }).first();
    await kind.selectOption("character");
    await page.waitForTimeout(200);
    const got = await card.evaluate((c) => ({ badge: c.querySelector(".af-person-head .af-badge").textContent, kind: c.getAttribute("data-kind") }));
    check(got.badge === "Character" && got.kind === "character", size.name + ": changing Who they are changes the label in their header at once (" + got.badge + ")");
    const name = card.locator('input[type="text"]').first();
    await name.fill("Wrenna Quill");
    await page.waitForTimeout(200);
    check(((await card.locator(".af-person-name b").textContent()) || "") === "Wrenna Quill", size.name + ": typing a name changes the header as it is typed");
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("group move")) {
  console.log("A new person put in a folded group stays open and in sight, and moves with a fade");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.evaluate(() => {
      window.__teardown();
      document.getElementById("drawer").innerHTML = "";
      window.__settings = Object.assign({}, window.__settings, { groups: [{ id: "g1", name: "Lighthouse crew", open: false }] });
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    });
    await page.waitForTimeout(300);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Add someone" }).click();
    await page.waitForTimeout(500);
    const card = page.locator('.af-person[data-open="true"]').last();
    const id = await card.getAttribute("data-person");
    const pick = card.locator("select").filter({ has: page.locator('option[value="g1"]') }).first();
    // Read the card's look every frame while it moves.
    await page.evaluate((id) => {
      window.__fade = [];
      const t0 = performance.now();
      const look = () => {
        const c = document.querySelector('.af-person[data-person="' + id + '"]');
        window.__fade.push(c ? Number(getComputedStyle(c).opacity) : -1);
        if (performance.now() - t0 < 700) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    }, id);
    await pick.selectOption("g1");
    await page.waitForTimeout(800);
    const got = await page.evaluate((id) => {
      const c = document.querySelector('.af-person[data-person="' + id + '"]');
      const sec = c && c.closest(".af-group");
      const r = c ? c.getBoundingClientRect() : null;
      const hidden = !c || !!c.closest("[hidden]");
      return { inGroup: !!sec && sec.getAttribute("data-group") === "g1", groupOpen: sec && sec.getAttribute("data-open"), open: c && c.getAttribute("data-open"), hidden, seen: !!r && r.height > 0, saved: window.__settings.groups[0].open, fade: window.__fade };
    }, id);
    const mids = got.fade.filter((o) => o > 0.05 && o < 0.95).length;
    check(got.inGroup && got.groupOpen === "true" && got.saved === true, size.name + ": the group they go into opens");
    check(got.open === "true" && !got.hidden && got.seen, size.name + ": their card stays open and in sight");
    check(mids >= 3, size.name + ": the card fades out and in over several frames (" + mids + " frames between)");
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("speech detection")) {
  console.log("Reading messages has Asterisked text, Quoted text and Undecorated text, with Lumiverse's choices");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() => {
      const out = {};
      for (const name of ["Asterisked text", "Text in parentheses", "Quoted text", "Undecorated text", "How speech is marked"]) {
        const lab = Array.from(document.querySelectorAll(".af-page label, .af-page .af-label")).find((l) => l.textContent.trim().startsWith(name));
        const row = lab && lab.closest(".af-col, .af-field-row, .af-row, div");
        const sel = row && (row.querySelector("select") || (lab.htmlFor && document.getElementById(lab.htmlFor)));
        out[name] = sel ? Array.from(sel.options).map((o) => o.textContent) : null;
      }
      return out;
    });
    check(JSON.stringify(rows["Asterisked text"]) === JSON.stringify(["Skip", "Read as narration", "Read as thoughts (character voice)"]), size.name + ": Asterisked text has Skip, narration and thoughts (" + JSON.stringify(rows["Asterisked text"]) + ")");
    check(JSON.stringify(rows["Text in parentheses"]) === JSON.stringify(["Skip", "Read as narration", "Read as thoughts (character voice)"]), size.name + ": Text in parentheses has Skip, narration and thoughts");
    check(JSON.stringify(rows["Quoted text"]) === JSON.stringify(["Read as speech", "Read as narration", "Skip"]), size.name + ": Quoted text has speech, narration and Skip");
    const emo = page.locator('[data-af-row="emojisOn"]');
    check((await emo.count()) === 1 && (await page.evaluate(() => !window.__settings.emojisOn)), size.name + ": Send emojis to the voice is there, and off");
    await emo.locator(".af-box").first().click();
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__settings.emojisOn === true), size.name + ": switching it on is saved");
    check(JSON.stringify(rows["Undecorated text"]) === JSON.stringify(["Read as narration", "Read as speech", "Skip"]), size.name + ": Undecorated text has narration, speech and Skip");
    check(!!rows["How speech is marked"] && rows["How speech is marked"].length === 2, size.name + ": How speech is marked keeps only which quote marks count");
    const sel = page.locator("select").filter({ has: page.locator('option[value="thought"]') }).first();
    await sel.selectOption("thought");
    await page.waitForTimeout(400);
    check((await page.evaluate(() => window.__settings.asterisks)) === "thought", size.name + ": picking thoughts is saved");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the Settings tab fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("scene music")) {
  console.log("Scene music plays the Director's mood under the voices, dips while someone speaks, changes with the mood, and fades out at the end");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.evaluate(() => {
      window.__teardown();
      document.getElementById("drawer").innerHTML = "";
      window.__settings = Object.assign({}, window.__settings, { musicOn: true, musicVolume: 0.35, musicDip: true, pauseKeyOn: true, pauseKey: "Alt+P" });
      window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const base = { key: "km", messageId: "m1", author: "Ysolde Marrow-Kestrel of the Lower Quays", directed: true, added: [], sent: 10, back: 10, counted: true, log: [], lines: [
        { i: 0, kind: "narration", speaker: "Narrator", text: "The lamps went out along the quay.", plain: "", tags: [], inSounds: [], big: false, before: "", after: "", note: "", mood: "tense" },
        { i: 1, kind: "speech", speaker: "Ferryman", text: "Stay low and keep quiet.", plain: "", tags: [], inSounds: [], big: false, before: "", after: "", note: "" },
        { i: 2, kind: "narration", speaker: "Narrator", text: "Nobody came back for the boat.", plain: "", tags: [], inSounds: [], big: false, before: "", after: "", note: "", mood: "sad" },
      ] };
      window.__script = base;
      window.__clipMs = 1400;
      window.__wav = [0.2, 0.3];
      window.__musicAsked = [];
    });
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForFunction(() => (window.__musicAsked || []).indexOf("tense") >= 0, null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(900);
    const music = () => page.evaluate(() => window.__Audio.all.filter((a) => a.dataset && a.dataset.kind === "music").map((a) => ({ src: a.src, loop: a.loop, vol: Math.round(a.volume * 100) / 100, paused: a.paused })));
    const m1 = await music();
    check(m1.length === 1 && /tense/.test(m1[0].src) && m1[0].loop === true, size.name + ": the tense track loops under the first line (" + JSON.stringify(m1) + ")");
    // The narrator is a voice too, so the music sits at 45% of the Music
    // volume under it.
    check(m1.length === 1 && m1[0].vol > 0.12 && m1[0].vol < 0.2, size.name + ": it fades up, lowered under the voice reading (" + (m1[0] && m1[0].vol) + ")");
    await page.waitForFunction(() => { const a = window.__Audio.all.filter((x) => x.dataset && x.dataset.kind === "voice" && !x.paused); return a.length && a[a.length - 1] && document.body; }, null, { timeout: 5000 }).catch(() => {});
    // Paused, the music pauses with the performance, and goes on with it.
    await page.keyboard.press("Alt+P");
    await page.waitForTimeout(200);
    const paused = await music();
    check(paused.length >= 1 && paused.every((x) => x.paused), size.name + ": paused, the music pauses too (" + JSON.stringify(paused) + ")");
    await page.keyboard.press("Alt+P");
    await page.waitForFunction(() => (window.__musicAsked || []).indexOf("sad") >= 0, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1300);
    const m3 = await music();
    const sad = m3.find((x) => /sad/.test(x.src));
    const tense = m3.find((x) => /tense/.test(x.src));
    check(!!sad && sad.vol > 0.1 && (!tense || tense.vol < 0.05 || tense.paused), size.name + ": where the mood turns, the music fades to the sad track (" + JSON.stringify(m3) + ")");
    await page.waitForTimeout(2500);
    const m4 = await music();
    check(m4.length > 0 && m4.every((x) => x.vol === 0 || x.paused), size.name + ": when the message ends, the music fades out (" + JSON.stringify(m4) + ")");
    // The Studio keeps the music under the performance, and Music off
    // leaves it out.
    await page.evaluate(async () => {
      const b = window.__makeWav(0, 4, 4000);
      window.__musicB64 = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); });
    });
    const fsm = await import("node:fs");
    const energy = (path) => {
      const b = fsm.readFileSync(path);
      const ch = b.readUInt16LE(22), bits = b.readUInt16LE(34), n = b.readUInt32LE(40) / (ch * (bits / 8));
      // The test voices start with a stretch of silence. Music fills it.
      let silent = 0;
      for (let i = 0; i < n; i++) {
        const o = 44 + i * ch * (bits / 8);
        let v = bits === 24 ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) : b.readInt16LE(o);
        if (bits === 24 && v & 0x800000) v -= 0x1000000;
        if (Math.abs(v) < 64) silent++;
      }
      return { n, silent: Math.round((silent / Math.max(1, n)) * 100) / 100 };
    };
    const takeAudio = async () => {
      const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
      await page.click('[data-af-studio="dlall"]');
      const d = await dl;
      return d ? energy(await d.path()) : null;
    };
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(1500);
    const withMusic = await takeAudio();
    await page.locator('[data-af-row="studioMusic"] .af-box').first().click();
    await page.waitForTimeout(1500);
    const without = await takeAudio();
    check(!!withMusic && !!without && withMusic.n === without.n && without.silent > 0.2 && withMusic.silent < without.silent / 2, size.name + ": the downloaded audio has the music in it, and Music off leaves it out (" + JSON.stringify([withMusic, without]) + ")");
    await page.locator('[data-af-row="studioMusic"] .af-box').first().click();
    await page.waitForTimeout(300);
    // The Mixer has a Music strip while Scene music is on, and the Log names
    // each track.
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => /Music for a tense mood: A tense track\./.test((document.querySelector(".af-log") || {}).textContent || "")), size.name + ": the Log names the track");
    check((await page.locator(".af-strip", { hasText: "Music" }).count()) === 1, size.name + ": the Mixer has a Music strip");
    // Each library sound can be marked as music for a mood.
    await page.click('.af-tab[data-tab="sounds"]');
    await page.waitForTimeout(400);
    const pick = page.locator("[data-af-soundmood] select").first();
    await pick.selectOption("calm");
    await page.waitForTimeout(300);
    const ed = await page.evaluate(() => (window.__soundEdits || []).slice(-1)[0] || null);
    check(!!ed && ed.mood === "calm", size.name + ": Music for marks a sound as a calm track (" + JSON.stringify(ed) + ")");
    const ms = await page.evaluate(MEASURE, size.touch);
    check(!ms.overflow.length && !ms.small.length, size.name + ": the Sounds tab fits. " + ms.overflow.concat(ms.small).slice(0, 2).join("; "));
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("full screen")) {
  console.log("The Studio's preview opens full screen, fitted to the screen, with its own controls, and closes back");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(600);
    for (const shape of ["wide", "tall"]) {
      if (shape === "tall") {
        await page.locator(".af-fold", { hasText: "Shape and words" }).first().click();
        await page.waitForTimeout(400);
        await page.locator("select").filter({ has: page.locator('option[value="tall"]') }).first().selectOption("tall");
        await page.waitForTimeout(500);
      }
      await page.click('[data-af-studio="full"]');
      await page.waitForTimeout(400);
      const got = await page.evaluate(() => {
        const root = document.querySelector("[data-af-theater]");
        const c = root && root.querySelector("canvas");
        const r = c ? c.getBoundingClientRect() : null;
        const btns = root ? Array.from(root.querySelectorAll("button")).map((b) => Math.round(b.getBoundingClientRect().height)) : [];
        return { open: !!root && root.hasAttribute("data-af-open"), inside: !!c, r: r && { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, vw: innerWidth, vh: innerHeight, btns, ratio: c ? c.width / c.height : 0, op: root ? getComputedStyle(root).opacity : "" };
      });
      const fits = !!got.r && got.r.l >= 0 && got.r.t >= 0 && got.r.l + got.r.w <= got.vw && got.r.t + got.r.h <= got.vh;
      const big = !!got.r && (got.r.w >= got.vw * 0.94 || got.r.h >= (got.vh - 80) * 0.94);
      check(got.open && got.inside && fits && big, size.name + ", " + shape + ": the preview fills the screen and fits on it (" + JSON.stringify(got.r) + " in " + got.vw + "x" + got.vh + ")");
      check(!!got.r && Math.abs(got.r.w / got.r.h - got.ratio) < 0.05, size.name + ", " + shape + ": in its own shape");
      check(got.btns.length === 2 && got.btns.every((h) => h >= 32), size.name + ", " + shape + ": its buttons are big enough to tap (" + got.btns.join(", ") + ")");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const back = await page.evaluate(() => ({ gone: !document.querySelector("[data-af-theater]"), home: !!document.querySelector('[data-af-card="studio-video"] canvas[data-af-videopreview]'), drawer: !!document.querySelector('.af-tab[data-tab="studio"]') }));
      check(back.gone && back.home && back.drawer, size.name + ", " + shape + ": Escape closes it, the preview is back in the Studio, and the drawer stays open");
    }
    // Smooth: the layer fades in over several frames at one size, and on
    // close the Studio is where it was, with no jump in where it is
    // scrolled to. The browser's own full screen is never asked for, since
    // a phone switches to it in one cut.
    const motion = await page.evaluate(async () => {
      let asked = 0;
      Element.prototype.requestFullscreen = function () { asked++; return Promise.resolve(); };
      const cv = document.querySelector("[data-af-videopreview]");
      let box = cv.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box) box.scrollTop = Math.max(0, cv.getBoundingClientRect().top + box.scrollTop - box.getBoundingClientRect().top - 40);
      const before = box ? box.scrollTop : 0;
      const card = document.querySelector('[data-af-card="studio-video"]');
      const cardBefore = Math.round(card.getBoundingClientRect().height);
      const frames = [];
      document.querySelector('[data-af-studio="full"]').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 700) {
        await new Promise((r) => requestAnimationFrame(r));
        const r = document.querySelector("[data-af-theater]");
        const c = r && r.querySelector("canvas");
        frames.push([r ? Number(getComputedStyle(r).opacity) : -1, c ? Math.round(c.getBoundingClientRect().width) : 0, box ? box.scrollTop : 0, Math.round(card.getBoundingClientRect().height)]);
      }
      document.querySelector('[data-af-theater] [data-th="close"]').click();
      await new Promise((r) => setTimeout(r, 450));
      return { frames, asked, before, after: box ? box.scrollTop : 0, scrolls: !!box, cardBefore };
    });
    const seen = motion.frames.filter((f) => f[0] > 0.01);
    const widths = new Set(seen.map((f) => f[1]));
    const mids = motion.frames.filter((f) => f[0] > 0.05 && f[0] < 0.95).length;
    check(seen.length > 0 && widths.size === 1, size.name + ": the video fades in at one size, and does not jump while it shows (" + [...widths].join(", ") + ")");
    check(mids >= 3, size.name + ": it fades in over several frames (" + mids + ")");
    check(motion.asked === 0, size.name + ": the phone's own full screen, which switches in one cut, is not asked for");
    check(motion.frames.every((f) => Math.abs(f[3] - motion.cardBefore) <= 1), size.name + ": the Video card keeps its height while the preview is away, so the page does not move (" + motion.cardBefore + " to " + Math.min(...motion.frames.map((f) => f[3])) + ")");
    check(motion.frames.every((f) => f[2] === motion.before) && motion.after === motion.before, size.name + ": the Studio stays scrolled where it was, open and closed (" + motion.before + " to " + motion.after + ", page scrolls: " + motion.scrolls + ")");
    // The Audio card links the converter, which opens in a new tab.
    const conv = await page.evaluate(() => { const a = document.querySelector("a[data-af-converter]"); return a ? { href: a.href, target: a.target, rel: a.rel, text: a.textContent } : null; });
    check(!!conv && conv.href === "https://wave.co/tools/audio-converter" && conv.target === "_blank" && /noopener/.test(conv.rel), size.name + ": the Audio card links the audio converter in a new tab (" + JSON.stringify(conv) + ")");
    // The close button works too, and Play plays from full screen.
    await page.click('[data-af-studio="full"]');
    await page.waitForTimeout(400);
    await page.click('[data-af-theater] [data-th="close"]');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => !document.querySelector("[data-af-theater]")), size.name + ": the close button closes it");
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("caption color")) {
  console.log("Sound captions in a video can have a color of their own");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.evaluate(async () => {
      const b = window.__makeWav(0, 0.6, 3000);
      window.__soundB64 = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); });
      window.__wav = [0.1, 0.3];
      window.__clipMs = 200;
    });
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForFunction(() => document.querySelector('#mount [data-af-slot="message"]').getAttribute("aria-busy") === null && (window.__synth || []).length > 0, null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(1500);
    // The most yellow pixels in any frame of the preview, looked at every
    // fifth of a second.
    const mostYellow = () => page.evaluate(async () => {
      const r = document.querySelector("[data-af-scrub] input");
      const c = document.querySelector("[data-af-videopreview]");
      const g = c.getContext("2d");
      let most = 0;
      for (let t = 0; t <= Number(r.max); t += 0.2) {
        r.value = String(t);
        r.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((x) => requestAnimationFrame(x));
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4 * 7) if (d[i] > 200 && d[i + 1] > 160 && d[i + 2] < 90) n++;
        most = Math.max(most, n);
      }
      return most;
    });
    const before = await mostYellow();
    await page.locator(".af-fold", { hasText: "Sounds" }).last().click();
    await page.waitForTimeout(400);
    await page.locator('[data-af-colorswatch="videoCaptionInk"]').click();
    await page.waitForTimeout(300);
    await page.fill('[data-af-colorcode="videoCaptionInk"]', "#ffd400");
    await page.locator('[data-af-colorcode="videoCaptionInk"]').dispatchEvent("change");
    await page.waitForTimeout(600);
    const after = await mostYellow();
    check(before < 20 && after > 200, size.name + ": a yellow caption color draws the sound captions yellow (" + before + " yellow before, " + after + " after)");
    check(await page.evaluate(() => window.__settings.videoCaptionInk === "#ffd400"), size.name + ": and it is saved");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the Studio fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, size.name + ": no page errors. " + errors.slice(0, 2).join(" | "));
    await context.close();
  }
}

if (section("person close")) {
  console.log("A person in the Cast tab opens and closes over several frames, with CSS transitions");
  const { context, page, errors } = await open(THEMES[0], SIZES[0]);
  await page.click('.af-tab[data-tab="cast"]');
  await page.waitForTimeout(300);
  const run = (open) =>
    page.evaluate(async (open) => {
      const head = document.querySelector(".af-person-head");
      const body = head.closest(".af-person").querySelector(".af-person-body");
      head.scrollIntoView({ block: "start" });
      await new Promise((r) => requestAnimationFrame(r));
      head.click();
      const hs = [];
      const anims = body.getAnimations().filter((a) => !(a instanceof CSSTransition)).length;
      for (let k = 0; k < 24; k++) {
        await new Promise((r) => requestAnimationFrame(r));
        hs.push(Math.round(body.getBoundingClientRect().height));
      }
      await new Promise((r) => setTimeout(r, 300));
      return { hs, anims, hidden: body.hidden, left: ["height", "opacity", "transform", "overflow", "transition"].filter((k) => body.style[k]) };
    }, open);
  const opened = await run(true);
  const closed = await run(false);
  const mids = (hs) => { const top = Math.max(...hs); return hs.filter((h) => h > 2 && h < top - 2).length; };
  check(mids(opened.hs) >= 3 && !opened.hidden, "opening moves over several frames (" + opened.hs.slice(0, 10).join(",") + ")");
  check(mids(closed.hs) >= 3 && closed.hidden, "closing moves over several frames and ends hidden (" + closed.hs.slice(0, 10).join(",") + ")");
  check(opened.anims === 0 && closed.anims === 0, "it uses CSS transitions, not the Web Animations API");
  check(!opened.left.length && !closed.left.length, "no motion styles are left on it (" + opened.left.concat(closed.left).join(",") + ")");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("stage buttons")) {
  console.log("Back, next and the part marks in Now playing");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => (window.__clipMs = 1500));
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(600);
    const at = () => page.evaluate(() => { const b = document.querySelector('[data-af="parts"] [aria-current="true"]'); return b ? Number(b.dataset.at) : -1; });
    await page.click('[data-af="skip"]');
    await page.waitForTimeout(300);
    const a1 = await at();
    await page.click('[data-af="back"]');
    await page.waitForTimeout(300);
    const a2 = await at();
    check(a1 === 1 && a2 === 0, size.name + ": Next goes forward one part and Back goes back one (" + a1 + ", " + a2 + ")");
    await page.click('[data-af="parts"] [data-at="2"]');
    await page.waitForTimeout(300);
    check((await at()) === 2, size.name + ": a tap on a mark goes to that part");
    check((await page.locator('[data-af="again"]').isEnabled()), size.name + ": Make this part again is ready while a part plays");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": Now playing fits and its buttons are big enough. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("key notice")) {
  console.log("A key test says how it went in a Lumiverse notification");
  const { context, page } = await open(THEMES[0], SIZES[1]);
  await page.click('.af-tab[data-tab="sounds"]');
  await page.waitForTimeout(250);
  await page.locator('[data-af-key="eleven"] .af-btn', { hasText: "Test" }).first().click();
  await page.waitForTimeout(250);
  check(await page.evaluate(() => window.__sent.some((m) => m.type === "notify" && m.kind === "success" && /key works/.test(m.text))), "a key that works says so");
  await context.close();
}

if (section("log kinds")) {
  console.log("Switches for each kind of Log line");
  const { context, page } = await open(THEMES[0], SIZES[0]);
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(200);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForTimeout(1200);
  const count = () => page.evaluate(() => document.querySelectorAll(".af-log .af-log-line").length);
  const before = await count();
  await page.locator(".af-fold", { hasText: "What the Log shows" }).click();
  await page.waitForTimeout(350);
  await page.locator('[data-af-logkind="director"] .af-box').click();
  await page.waitForTimeout(200);
  const after = await count();
  check(before > after && after > 0, "switching off a kind hides its lines and keeps the rest (" + before + " then " + after + ")");
  await page.waitForTimeout(600);
  check(await page.evaluate(() => window.__settings.logShow && window.__settings.logShow.director === false), "the choice is saved to the account");
  const m = await page.evaluate(MEASURE, true);
  check(!m.overflow.length && !m.small.length, "the switches fit on a phone. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
  await context.close();
}

if (section("log all none")) {
  console.log("All and None over the Log switches, as in Auto Refine");
  for (const size of SIZES) {
    for (const still of [false, true]) {
      const tag = size.name + (still ? ", Reduce motion" : "");
      const { context, page, errors } = await open(THEMES[0], size, 1, still ? () => (window.__settings.reduceMotion = true) : null);
      await page.click('.af-tab[data-tab="stage"]');
      await page.waitForTimeout(200);
      await page.locator(".af-fold", { hasText: "What the Log shows" }).click();
      await page.waitForTimeout(350);
      const read = () =>
        page.evaluate(() => {
          const bar = document.querySelector("[data-af-bulk]");
          const boxes = [...document.querySelectorAll("[data-af-logkind] .af-box")];
          return {
            bar: !!bar,
            said: bar ? bar.querySelector(".af-note").textContent : "",
            on: boxes.filter((b) => b.checked).length,
            total: boxes.length,
            nudged: boxes.filter((b) => b.classList.contains("af-nudge")).length,
            all: bar ? bar.querySelector('[data-af-pick="all"]').disabled : null,
            none: bar ? bar.querySelector('[data-af-pick="none"]').disabled : null,
          };
        });
      const first = await read();
      check(first.bar && first.total === 7 && first.on === 7 && first.said === "7 of 7 chosen" && first.all && !first.none, tag + ": the bar counts every switch on, with All grayed. " + JSON.stringify(first));
      await page.locator('[data-af-pick="none"]').click();
      const pressed = await read();
      if (still) check(pressed.on === 0 && pressed.nudged === 0, tag + ": None turns every switch off at once, with no press. " + JSON.stringify(pressed));
      else check(pressed.nudged === 7 && pressed.on === 7, tag + ": None first gives every switch the press a finger gives it. " + JSON.stringify(pressed));
      await page.waitForTimeout(700);
      const off = await read();
      check(off.on === 0 && off.nudged === 0 && off.said === "0 of 7 chosen" && off.none && !off.all, tag + ": then every switch is off, and None is grayed. " + JSON.stringify(off));
      const savedOff = await page.evaluate(() => window.__settings.logShow);
      check(Object.keys(savedOff || {}).length === 7 && Object.values(savedOff).every((v) => v === false), tag + ": every kind is saved as hidden. " + JSON.stringify(savedOff));
      check(await page.evaluate(() => { const l = document.querySelectorAll(".af-log .af-log-line"); return l.length === 1 && /^Nothing (to show|has happened)/.test(l[0].textContent); }), tag + ": the Log shows only the line that says nothing is shown");
      await page.locator('[data-af-pick="all"]').click();
      await page.waitForTimeout(700);
      const on = await read();
      check(on.on === 7 && on.said === "7 of 7 chosen" && on.all && !on.none, tag + ": All turns every switch back on. " + JSON.stringify(on));
      check(JSON.stringify(await page.evaluate(() => window.__settings.logShow)) === "{}", tag + ": and saves every kind as shown");
      await page.locator('[data-af-logkind="director"] .af-box').click();
      await page.waitForTimeout(200);
      const one = await read();
      check(one.on === 6 && one.said === "6 of 7 chosen" && !one.all && !one.none, tag + ": one switch by hand moves the count. " + JSON.stringify(one));
      const m = await page.evaluate(MEASURE, size.touch);
      check(!m.overflow.length && !m.small.length, tag + ": the bar fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
      check(!errors.length, tag + ": no errors. " + errors.slice(0, 2).join("; "));
      await context.close();
    }
  }
}

if (section("this chat")) {
  console.log("Auto Foley can be switched off in one chat, as in Auto Retry and Auto Refine");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    const row = page.locator('[data-af-row="thisChat"]');
    check((await row.count()) === 1, size.name + ": Settings has a This chat row");
    const slots = () => page.evaluate(() => document.querySelectorAll("#mount [data-af-slot]").length);
    const before = await slots();
    check(before > 0 && (await page.locator('[data-af="pill"]').textContent()) === "On", size.name + ": on in this chat, its messages have buttons");
    check(((await row.locator("[data-af-chatswitch]").textContent()) || "").trim() === "Turn off here", size.name + ": the button says Turn off here");
    await row.locator("[data-af-chatswitch]").click();
    await page.waitForTimeout(700);
    check(((await row.locator("[data-af-chatswitch]").textContent()) || "").trim() === "Turn on here", size.name + ": pressed, it says Turn on here");
    check((await slots()) === 0, size.name + ": the messages in this chat lose their buttons");
    check((await page.locator('[data-af="pill"]').textContent()) === "Off here", size.name + ": the pill at the top says Off here");
    check(/switched off here/.test(await page.locator('[data-af="chatline"]').textContent()), size.name + ": the line under the title says so");
    check(await page.evaluate(() => JSON.stringify(window.__settings.chatsOff) === '["chat1"]'), size.name + ": the chat is saved on the account");
    check(/1 chat switched off/.test(await row.textContent()) && (await row.locator(".af-btn", { hasText: "Turn them all back on" }).isVisible()), size.name + ": the row counts the chats switched off");
    const sentBefore = await page.evaluate(() => window.__sent.filter((m) => m.type === "direct").length);
    await page.evaluate(() => window.__emit("GENERATION_ENDED", { chatId: "chat1", messageId: "m1" }));
    await page.waitForTimeout(400);
    check((await page.evaluate(() => window.__sent.filter((m) => m.type === "direct").length)) === sentBefore, size.name + ": a new reply in this chat is not prepared");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the row fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    if (shots) await row.screenshot({ path: shots + "/this-chat-" + size.name + ".png" });
    await row.locator("[data-af-chatswitch]").click();
    await page.waitForTimeout(700);
    check((await slots()) === before && (await page.locator('[data-af="pill"]').textContent()) === "On", size.name + ": Turn on here puts the buttons back");
    check(await page.evaluate(() => JSON.stringify(window.__settings.chatsOff) === "[]"), size.name + ": and the account no longer holds the chat");
    check(!(await row.locator("[data-af-chatsoff]").isVisible()), size.name + ": with none switched off, the count is gone");
    check(!errors.length, size.name + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
  // Read from the account when the panel loads.
  {
    const { context, page, errors } = await open(THEMES[0], SIZES[1], 1, () => (window.__settings.chatsOff = ["chat1"]));
    await page.waitForTimeout(300);
    check((await page.evaluate(() => document.querySelectorAll("#mount [data-af-slot]").length)) === 0, "a chat switched off on another device has no buttons when the page opens");
    check((await page.locator('[data-af="pill"]').textContent()) === "Off here", "and the pill says Off here");
    // A press of the floating button or Extras goes nowhere, and says why.
    await page.evaluate(() => window.__emit("GENERATION_ENDED", { chatId: "chat1", messageId: "m1" }));
    await page.waitForTimeout(300);
    check(!(await page.evaluate(() => window.__sent.some((m) => m.type === "direct"))), "nothing is directed in it");
    check(!errors.length, "no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("pictures")) {
  console.log("A picture for a person, or the first letter of the name");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="cast"]');
    await page.waitForTimeout(250);
    const head = page.locator(".af-person").nth(1);
    check(/^[A-Z]$/.test(((await head.locator(".af-person-head .af-avatar").textContent()) || "").trim()), size.name + ": with no picture, the first letter of the name is shown");
    await head.locator(".af-person-head").click();
    await page.waitForTimeout(350);
    await head.locator(".af-btn", { hasText: "Choose a picture" }).click();
    await page.waitForTimeout(400);
    check((await head.locator("[data-af-crop]").count()) === 1, size.name + ": a chosen picture opens a crop first");
    const m0 = await page.evaluate(MEASURE, size.touch);
    // The picture inside the frame is larger than the frame on purpose: the
    // frame clips it, so it is left out of this.
    const spill = m0.overflow.filter((x) => !/^IMG /.test(x));
    check(!spill.length, size.name + ": the crop fits. " + spill.slice(0, 2).join("; "));
    const frameFits = await page.evaluate(() => { const r = document.querySelector(".af-crop-frame").getBoundingClientRect(); return r.left >= -0.5 && r.right <= document.documentElement.clientWidth + 0.5; });
    check(frameFits, size.name + ": the crop frame stays on screen");
    // Dragged right as far as it goes, the left, red half fills the frame.
    const frame = head.locator(".af-crop-frame");
    // On screen first: a drag aimed below the window presses nothing.
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await head.locator(".af-btn", { hasText: "Use this" }).click();
    await page.waitForTimeout(300);
    check((await head.locator("[data-af-crop]").count()) === 0, size.name + ": Use this closes the crop");
    check((await head.locator(".af-person-head .af-avatar img").count()) === 1, size.name + ": a chosen picture is shown");
    const color = await page.evaluate(async () => {
      const src = document.querySelector(".af-person-head .af-avatar img").src;
      const i = new Image();
      await new Promise((r) => { i.onload = r; i.src = src; });
      const c = document.createElement("canvas");
      c.width = i.naturalWidth; c.height = i.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(i, 0, 0);
      const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
      return { r: d[0], b: d[2], w: c.width };
    });
    check(color.r > 150 && color.b < 100 && color.w === 128, size.name + ": the saved picture is the part the crop showed (" + JSON.stringify(color) + ")");
    await page.waitForTimeout(600);
    const saved = await page.evaluate(() => (window.__settings.cast || []).some((m) => /^data:image\/jpeg;base64,/.test(m.picture || "")));
    check(saved, size.name + ": it is made small and saved with the cast");
    await head.locator(".af-btn", { hasText: "Take it out" }).click();
    await page.waitForTimeout(300);
    check((await head.locator(".af-person-head .af-avatar img").count()) === 0, size.name + ": Take it out goes back to the first letter");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the picture row fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("no flicker")) {
  console.log("Opening a person shows their voice from the first frame");
  const { context, page } = await open(THEMES[0], SIZES[0]);
  await page.click('.af-tab[data-tab="cast"]');
  await page.waitForTimeout(250);
  // Every frame for half a second, the words the voice and model boxes show.
  const seen = await page.evaluate(async () => {
    const card = Array.from(document.querySelectorAll(".af-person")).find((c) => /Ysolde/.test(c.textContent));
    card.querySelector(".af-person-head").click();
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 500) {
      const sels = card.querySelectorAll(".af-voicebox select");
      const show = (sel) => (sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : "");
      out.push(Array.from(sels).map(show).join(" | "));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return Array.from(new Set(out.filter(Boolean)));
  });
  check(seen.length === 1, "what the boxes show never changes while the lists load (" + seen.join(" / ") + ")");
  await context.close();
}

if (section("sound link")) {
  console.log("Adding a sound by link");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    await page.click('.af-tab[data-tab="sounds"]');
    await page.waitForTimeout(250);
    await page.locator("[data-af-link] input").first().fill("ftp://nope");
    await page.locator(".af-btn", { hasText: "Add the link" }).click();
    await page.waitForTimeout(150);
    check(((await page.locator("[data-af-link] + .af-status").textContent()) || "").includes("http"), size.name + ": something that is not a link says so");
    await page.locator("[data-af-link] input").first().fill("https://sounds.example.org/door.mp3");
    await page.locator("[data-af-link] input").nth(1).fill("a heavy door closing");
    await page.locator(".af-btn", { hasText: "Add the link" }).click();
    await page.waitForTimeout(300);
    check((await page.locator(".af-sound-meta", { hasText: "A link" }).count()) === 1, size.name + ": the link is in the library, marked as a link");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the link field fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("tab flicker")) {
  console.log("Switching tabs draws each tab once");
  for (const size of SIZES) {
    const { context, page } = await open(THEMES[0], size);
    await page.waitForTimeout(400);
    for (const id of ["settings", "director", "cast", "sounds", "stage", "settings", "director"]) {
      const changes = await page.evaluate(async (id) => {
        document.querySelector('.af-tab[data-tab="' + id + '"]').click();
        const pg = document.querySelector('[data-af="page"]');
        const seen = [];
        const t0 = performance.now();
        let last = "";
        while (performance.now() - t0 < 700) {
          const snap = pg.offsetHeight + ":" + pg.textContent.length;
          if (snap !== last) seen.push(Math.round(performance.now() - t0) + "ms " + snap);
          last = snap;
          await new Promise((r) => requestAnimationFrame(r));
        }
        return seen;
      }, id);
      check(changes.length === 1, size.name + ", " + id + ": the tab is drawn once, with no change after (" + changes.join(", ") + ")");
    }
    // The highlight moves at once: on every frame after a switch, one tab
    // carries it, never two.
    const lit = await page.evaluate(async () => {
      const counts = [];
      document.querySelector('.af-tab[data-tab="cast"]').click();
      for (let k = 0; k < 15; k++) {
        await new Promise((r) => requestAnimationFrame(r));
        counts.push(Array.from(document.querySelectorAll(".af-tab")).filter((b) => {
          const m = getComputedStyle(b).backgroundColor.match(/[\d.]+/g) || [];
          return m.length === 4 ? parseFloat(m[3]) > 0.02 : m.length === 3;
        }).length);
      }
      return counts;
    });
    check(lit.every((n) => n === 1), size.name + ": one tab is highlighted on every frame after a switch (" + lit.join(",") + ")");
    await context.close();
  }
}

if (section("setup check")) {
  console.log("Check my setup changes the page once");
  const { context, page } = await open(THEMES[0], SIZES[0]);
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(400);
  const changes = await page.evaluate(async () => {
    const btn = Array.from(document.querySelectorAll(".af-btn")).find((b) => b.textContent.trim() === "Check my setup");
    const list = btn.closest(".af-card").querySelector(".af-checks");
    btn.click();
    const seen = [];
    let last = "";
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      const snap = String(list.children.length);
      if (snap !== last) seen.push(snap);
      last = snap;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return seen;
  });
  check(changes.length <= 2 && changes[changes.length - 1] !== "0", "the answers appear together, not one by one (" + changes.join(" > ") + ")");
  await context.close();
}

if (section("widget low")) {
  console.log("The player opens from the round button, wherever it sits");
  for (const size of SIZES) {
    for (const zoom of [0.85, 1, 1.25]) {
      for (const corner of ["low left", "low right", "high left"]) {
        const { context, page, errors } = await open(THEMES[0], size, zoom);
        const where = size.name + ", zoom " + zoom + ", " + corner;
        await page.click('.af-tab[data-tab="settings"]');
        await page.waitForTimeout(200);
        await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
        await page.waitForTimeout(300);
        // The button is dragged to the corner, as Lumiverse moves it.
        await page.evaluate(({ corner, zoom }) => {
          const vw = window.innerWidth / zoom, vh = window.innerHeight / zoom;
          const d = parseFloat(window.__widget.style.width);
          window.__floatApi.moveTo(/right/.test(corner) ? vw - d - 20 : 20, /low/.test(corner) ? vh - d - 30 : 90);
          window.dispatchEvent(new Event("spindle:float-drag-end"));
        }, { corner, zoom });
        await page.waitForTimeout(200);
        const pos = () => page.evaluate(() => ({ x: parseFloat(window.__widget.style.left), y: parseFloat(window.__widget.style.top), w: parseFloat(window.__widget.style.width), h: parseFloat(window.__widget.style.height) }));
        const home = await pos();
        await page.evaluate((h) => (window.__homeAt = h), home);
        // Moved on the next render, as Lumiverse does, the circle still
        // starts on the button.
        const start = await page.evaluate(async (zoom) => {
          window.__lateMove = true;
          const btn = window.__widget.querySelector(".af-float").getBoundingClientRect();
          window.__widget.querySelector(".af-float").click();
          const card = window.__widget.querySelector(".af-pl");
          // Read once the first frame is drawn, as it is seen. A frame runs
          // its resize pass after the frame's callbacks and before it draws.
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const a = card && card.getAnimations().find((x) => /circle/.test(String(x.effect.getKeyframes()[0].clipPath)));
          const m = a && String(a.effect.getKeyframes()[0].clipPath).match(/at ([\d.-]+)px ([\d.-]+)px/);
          await new Promise((r) => setTimeout(r, 120));
          const r = card.getBoundingClientRect();
          window.__lateMove = false;
          if (!m) return null;
          return { dx: r.left + parseFloat(m[1]) * zoom - (btn.left + btn.width / 2), dy: r.top + parseFloat(m[2]) * zoom - (btn.top + btn.height / 2) };
        }, zoom);
        check(!!start && Math.abs(start.dx) < 2 && Math.abs(start.dy) < 2, where + ": the opening circle starts on the button (" + JSON.stringify(start) + ")");
        await page.waitForTimeout(500);
        const opened = await pos();
        const low = /low/.test(corner), right = /right/.test(corner);
        // A player wider or taller than the room left is held 8 px from the
        // edge, which is the most it can do.
        const vert = low ? Math.abs(opened.y + opened.h - (home.y + home.h)) < 2 || opened.y <= 9 : Math.abs(opened.y - home.y) < 2;
        const horiz = right ? Math.abs(opened.x + opened.w - (home.x + home.w)) < 2 || opened.x <= 9 : Math.abs(opened.x - home.x) < 2 || opened.x <= 9;
        check(vert && horiz, where + ": the player grows away from the side the button is near (" + JSON.stringify({ home, opened }) + ")");
        // Moved on the next render, as Lumiverse does, the round button is
        // drawn only at its home, never for a frame at the card's corner.
        const off = await page.evaluate(async (zoom) => {
          window.__lateMove = true;
          window.__widget.querySelector('[data-p="close"]').click();
          const want = { x: parseFloat(window.__homeAt.x), y: parseFloat(window.__homeAt.y) };
          const seen = [];
          for (let k = 0; k < 50; k++) {
            await new Promise((r) => requestAnimationFrame(r));
            const b = window.__widget.querySelector(".af-float");
            if (b && b.getClientRects().length) {
              const r = b.getBoundingClientRect();
              seen.push(Math.round(Math.max(Math.abs(r.left / zoom - want.x), Math.abs(r.top / zoom - want.y))));
            }
          }
          window.__lateMove = false;
          return seen;
        }, zoom);
        check(off.length > 0 && Math.max(...off) <= 2, where + ": closing draws the round button only at its home (" + off.slice(0, 8).join(",") + ")");
        await page.waitForTimeout(300);
        const back = await pos();
        check(Math.abs(back.x - home.x) < 1 && Math.abs(back.y - home.y) < 1, where + ": closing puts the button back where it was (" + JSON.stringify({ home, back }) + ")");
        check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
        await context.close();
      }
    }
  }
}

if (section("under a pick")) {
  console.log("A setting under a pick opens and closes smoothly");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const watch = (tab, label, value) =>
      page.evaluate(async ({ label, value }) => {
        const row = Array.from(document.querySelectorAll(".af-page .af-col")).find((c) => {
          const l = c.querySelector(":scope > .af-between .af-lab, :scope > label, .af-lab");
          return l && l.textContent.trim() === label && c.querySelector("select");
        });
        const sel = row.querySelector("select");
        const under = row.nextElementSibling;
        // In sight, since a row with none of it in sight opens at once.
        row.scrollIntoView({ block: "start" });
        await new Promise((r) => requestAnimationFrame(r));
        const card = row.closest(".af-card");
        card.__mark = 1;
        sel.value = value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        const hs = [];
        for (let k = 0; k < 24; k++) {
          await new Promise((r) => requestAnimationFrame(r));
          hs.push(Math.round(under.getBoundingClientRect().height));
        }
        return { hs, kept: card.isConnected && card.__mark === 1, hidden: under.hidden };
      }, { label, value });
    const smooth = (hs, opening) => {
      const end = opening ? Math.max(...hs) : hs[0];
      const mids = hs.filter((h) => h > 2 && h < end - 2).length;
      return end > 20 && mids >= 3;
    };
    await page.click('.af-tab[data-tab="director"]');
    await page.waitForTimeout(300);
    const open1 = await watch("director", "Let it think first", "custom");
    check(open1.kept, size.name + ": picking Yes does not draw the tab again");
    check(smooth(open1.hs, true), size.name + ": How much thinking opens over several frames (" + open1.hs.join(",") + ")");
    const shut1 = await watch("director", "Let it think first", "off");
    check(smooth(shut1.hs, false) && shut1.hidden, size.name + ": and closes over several frames (" + shut1.hs.join(",") + ")");
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(300);
    const open2 = await watch("settings", "Pattern behind the panel", "dots");
    check(open2.kept && smooth(open2.hs, true), size.name + ": How solid the boxes are opens over several frames (" + open2.hs.join(",") + ")");
    const same = await watch("settings", "Pattern behind the panel", "stars");
    check(same.hs.every((h) => h === same.hs[0]) && same.hs[0] > 20, size.name + ": picking another pattern leaves it open and still (" + same.hs.join(",") + ")");
    check(!errors.length, size.name + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("downloads")) {
  console.log("Download audio, a part, and a video");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.evaluate(() => { window.__wav = [0.1, 0.5]; window.__clipMs = 1500; });
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    // The Stage has one button for all of it, which opens the Studio.
    check(await page.evaluate(() => !document.querySelector('[data-af="dlall"]') && !document.querySelector('[data-af="dlpart"]') && /Download or make a video/.test(document.querySelector('[data-af="studio"]').textContent)), where + ": the Stage has one Download or make a video button, and no download buttons of its own");
    await page.click('[data-af="studio"]');
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.querySelector('.af-tab[data-tab="studio"]').getAttribute("aria-selected") === "true"), where + ": it opens the Studio tab");
    const state = () => page.evaluate(() => ["dlall", "dlpart"].map((k) => document.querySelector('[data-af-studio="' + k + '"]').disabled));
    check((await state()).join() === "true,true", where + ": with nothing played, both downloads are off (" + (await state()).join() + ")");
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(900);
    const part = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await page.click('[data-af-studio="dlpart"]');
    const p1 = await part;
    check(!!p1 && /part 1\.wav$/.test(p1.suggestedFilename()), where + ": Download this part saves the part playing (" + (p1 && p1.suggestedFilename()) + ")");
    // Let the message play to the end.
    await page.waitForFunction(() => document.querySelector('[data-af-studio="dlpart"]') && document.querySelector('[data-af-studio="dlpart"]').disabled, null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const all = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await page.click('[data-af-studio="dlall"]');
    const p2 = await all;
    let size2 = 0;
    if (p2) { const fs = await import("node:fs"); size2 = fs.statSync(await p2.path()).size; }
    check(!!p2 && /\.wav$/.test(p2.suggestedFilename()) && size2 > 44 + 8000, where + ": Download audio saves the whole performance as one WAV (" + (p2 && p2.suggestedFilename()) + ", " + size2 + " bytes)");
    const vid = page.waitForEvent("download", { timeout: 60000 }).catch(() => null);
    await page.click('[data-af-studio="video"]');
    await page.waitForTimeout(600);
    const making = await page.evaluate(() => ({ said: document.querySelector('[data-af-studio="said"]').textContent, label: document.querySelector('[data-af-studio="video"]').textContent }));
    check(/Making the video/.test(making.said) && /Stop the video/.test(making.label), where + ": while it is made, the count shows and the button stops it (" + making.said + ")");
    // Away from the tab, it pauses, and it goes on when the tab is back.
    const paused = await page.evaluate(async () => {
      let state = "hidden";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
      const a = document.querySelector('[data-af-studio="said"]').textContent;
      // The count is in whole seconds, so it is read well over a second apart.
      await new Promise((r) => setTimeout(r, 1600));
      const b = document.querySelector('[data-af-studio="said"]').textContent;
      state = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      return a === b;
    });
    check(paused, where + ": away from the tab, the video pauses");
    // A phone that starts sound again only after a press: back on the tab,
    // the video waits, and Go on with the video carries it on.
    const waits = await page.evaluate(async () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      const real = AC.prototype.resume;
      window.__realResume = real;
      // A press counts for a second here, which is stricter than Chrome.
      window.__pressAt = 0;
      document.addEventListener("pointerdown", () => (window.__pressAt = Date.now()), true);
      AC.prototype.resume = function () {
        return Date.now() - window.__pressAt < 1000 ? real.call(this) : new Promise(() => {});
      };
      let state = "hidden";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 300));
      state = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 900));
      const a = document.querySelector('[data-af-studio="said"]').textContent;
      await new Promise((r) => setTimeout(r, 1400));
      const b = document.querySelector('[data-af-studio="said"]').textContent;
      const btn = document.querySelector('[data-af-studio="play"]');
      return { still: a === b, said: b, label: btn.textContent, off: btn.disabled };
    });
    check(waits.still && /Go on with the video/.test(waits.label) && !waits.off && /paused/.test(waits.said), where + ": back on the tab, if the sound cannot start by itself, the video waits with Go on with the video (" + waits.label + "; " + waits.said + ")");
    const mw = await page.evaluate(MEASURE, size.touch);
    check(!mw.overflow.length && !mw.small.length, where + ": with Go on with the video showing, the buttons fit. " + mw.overflow.concat(mw.small).slice(0, 3).join("; "));
    await page.click('[data-af-studio="play"]');
    await page.waitForTimeout(1600);
    const goes = await page.evaluate(() => ({ said: document.querySelector('[data-af-studio="said"]').textContent, label: document.querySelector('[data-af-studio="play"]').textContent }));
    check(/Making the video/.test(goes.said) && /Play the preview/.test(goes.label), where + ": a press on Go on with the video carries the video on (" + goes.said + ")");
    await page.evaluate(() => { const AC = window.AudioContext || window.webkitAudioContext; AC.prototype.resume = window.__realResume; });
    const p3 = await vid;
    let size3 = 0;
    if (p3) { const fs = await import("node:fs"); size3 = fs.statSync(await p3.path()).size; if (process.env.UI_VIDEO) await p3.saveAs(process.env.UI_VIDEO + "-" + size.name + ".webm"); }
    check(!!p3 && /\.(webm|mp4)$/.test(p3.suggestedFilename()) && size3 > 1000, where + ": Make a video saves a video (" + (p3 && p3.suggestedFilename()) + ", " + size3 + " bytes)");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the buttons fit and are big enough. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("studio")) {
  console.log("The Studio tab keeps the audio and makes the video, with every choice");
  const fs = await import("node:fs");
  // A WAV file's rate, bits, channels and length in seconds, and its samples
  // as numbers from -1 to 1, the first channel only.
  const readWav = (path) => {
    const b = fs.readFileSync(path);
    const rate = b.readUInt32LE(24);
    const ch = b.readUInt16LE(22);
    const bits = b.readUInt16LE(34);
    const bytes = b.readUInt32LE(40);
    const n = bytes / (ch * (bits / 8));
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = 44 + i * ch * (bits / 8);
      let v = bits === 24 ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) : b.readInt16LE(o);
      if (bits === 24 && v & 0x800000) v -= 0x1000000;
      samples[i] = v / (bits === 24 ? 0x800000 : 0x8000);
    }
    return { rate, ch, bits, secs: n / rate, samples };
  };
  const grab = async (page, sel) => {
    const dl = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await page.click(sel);
    const d = await dl;
    return d ? { name: d.suggestedFilename(), path: await d.path() } : null;
  };
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size);
    await page.evaluate(() => { window.__wav = [0.1, 0.5]; window.__clipMs = 300; });
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(300);
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForFunction(() => document.querySelector('[data-af-studio="dlall"]') && !document.querySelector('[data-af-studio="dlall"]').disabled && document.querySelector('[data-af-studio="dlpart"]').disabled, null, { timeout: 20000 });
    await page.waitForTimeout(900);
    const cards = await page.evaluate(() => ["studio-show", "studio-audio", "studio-video", "studio-censor"].map((k) => !!document.querySelector('[data-af-card="' + k + '"]')));
    check(cards.every(Boolean), where + ": the Studio has the performance, audio, video and hide words cards");

    // The audio: 48 kHz, 24-bit, every part in.
    const one = await grab(page, '[data-af-studio="dlall"]');
    const w1 = one ? readWav(one.path) : null;
    check(!!w1 && w1.rate === 48000 && w1.bits === 24 && w1.secs > 1, where + ": Download audio is a 48 kHz, 24-bit WAV (" + (w1 && [w1.rate, w1.bits, w1.secs.toFixed(2)].join(", ")) + ")");
    const parts = await page.evaluate(() => {
      const f = [...document.querySelectorAll(".af-fold")].find((b) => /Which parts go in/.test(b.textContent));
      f.click();
      return new Promise((r) => setTimeout(() => r(document.querySelectorAll("[data-af-studiopart]").length), 400));
    });
    check(parts >= 2, where + ": Which parts go in lists every part heard (" + parts + ")");
    // Even loudness brings the loudest moment to just under full.
    const peak = w1 ? w1.samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0) : 0;
    check(peak > 0.85 && peak < 0.9, where + ": the loudness is evened out to just under full (" + peak.toFixed(3) + ")");

    // A pause between parts makes the file longer by that much each time.
    await page.evaluate(() => {
      const box = [...document.querySelectorAll('[data-af-card="studio-show"] input[type="number"]')][0];
      box.value = "0.5";
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const gapped = await grab(page, '[data-af-studio="dlall"]');
    const w2 = gapped ? readWav(gapped.path) : null;
    // A part the browser cannot read, such as the stub's sound, is not
    // joined, so the gaps are counted from the length added.
    const added = w2 ? (w2.secs - w1.secs) / 0.5 : 0;
    check(!!w2 && added >= 1 && Math.abs(added - Math.round(added)) < 0.04, where + ": a pause of 0.5 s adds 0.5 s between each part (" + (w2 && (w2.secs - w1.secs).toFixed(2)) + " s more)");
    await page.evaluate(() => {
      const box = [...document.querySelectorAll('[data-af-card="studio-show"] input[type="number"]')][0];
      box.value = "0";
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // A part left out is not in the file.
    await page.locator('[data-af-studiopart="0"] .af-box').click();
    await page.waitForTimeout(400);
    const less = await grab(page, '[data-af-studio="dlall"]');
    const w3 = less ? readWav(less.path) : null;
    check(!!w3 && w3.secs < w1.secs - 0.3, where + ": a part switched off is left out (" + (w3 && w3.secs.toFixed(2)) + " s, was " + w1.secs.toFixed(2) + ")");
    check(await page.evaluate(() => /of \d+ chosen/.test(document.querySelector("[data-af-bulk] .af-note").textContent)), where + ": the parts have All and None, with a count");
    await page.locator('[data-af-pick="all"]').click();
    await page.waitForTimeout(500);

    // A file for each part, in a ZIP.
    await page.locator('[data-af-card="studio-audio"] .af-segbtn[data-v="parts"]').click();
    await page.waitForTimeout(300);
    const zip = await grab(page, '[data-af-studio="dlall"]');
    const zb = zip ? fs.readFileSync(zip.path) : null;
    const entries = zb ? zb.readUInt16LE(zb.length - 22 + 10) : 0;
    check(!!zip && /\.zip$/.test(zip.name) && zb.readUInt32LE(0) === 0x04034b50 && entries >= 2 && entries <= parts, where + ": A file for each part saves a ZIP with one WAV for each part (" + (zip && zip.name) + ", " + entries + " files)");
    await page.locator('[data-af-card="studio-audio"] .af-segbtn[data-v="one"]').click();

    // Hiding a word: bleeped in the audio. "late" is said in the second line.
    await page.locator('[data-af-row="censorOn"] .af-box').first().click();
    await page.waitForTimeout(300);
    await page.fill("[data-af-censorwords]", "late");
    await page.locator("[data-af-censorwords]").dispatchEvent("change");
    await page.waitForTimeout(500);
    const bleeped = await grab(page, '[data-af-studio="dlall"]');
    const w4 = bleeped ? readWav(bleeped.path) : null;
    let differ = 0;
    if (w4 && w1) for (let i = 0; i < Math.min(w4.samples.length, w1.samples.length); i++) if (Math.abs(w4.samples[i] - w1.samples[i]) > 0.05) differ++;
    check(differ > 4800, where + ": a hidden word is bleeped in the downloaded audio (" + differ + " samples changed)");
    // A 1 kHz tone crosses zero 2000 times a second.
    let zc = 0;
    let at = -1;
    if (w4 && w1) {
      for (let i = 0; i < w4.samples.length; i++) if (Math.abs(w4.samples[i] - w1.samples[i]) > 0.05) { at = i; break; }
      for (let i = at + 480; i < at + 480 + 4800 && i + 1 < w4.samples.length; i++) if ((w4.samples[i] >= 0) !== (w4.samples[i + 1] >= 0)) zc++;
    }
    check(zc > 180 && zc < 220, where + ": the bleep is a 1 kHz tone, which crosses zero 200 times in 0.1 s (" + zc + ")");
    await page.locator('[data-af-row="censorOn"] .af-box').first().click();
    await page.waitForTimeout(300);

    // The preview: its bar and its play button.
    check(await page.locator("[data-af-scrub]").isVisible(), where + ": the preview has a bar to move through the video");
    await page.click('[data-af-studio="play"]');
    await page.waitForTimeout(500);
    const playing = await page.evaluate(() => document.querySelector('[data-af-studio="play"]').textContent);
    const moved = await page.evaluate(() => Number(document.querySelector("[data-af-scrub] input").value));
    check(/Stop the preview/.test(playing) && moved > 0, where + ": Play the preview plays it, and the bar moves (" + moved + ")");
    await page.click('[data-af-studio="play"]');
    await page.waitForTimeout(200);
    check(/Play the preview/.test(await page.evaluate(() => document.querySelector('[data-af-studio="play"]').textContent)), where + ": pressed again, it stops");
    // Leaving the tab stops the preview where it is, and Play the preview
    // goes on from there.
    await page.click('[data-af-studio="play"]');
    await page.waitForTimeout(500);
    const left = await page.evaluate(async () => {
      let state = "hidden";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 300));
      const at = Number(document.querySelector("[data-af-scrub] input").value);
      const label = document.querySelector('[data-af-studio="play"]').textContent;
      state = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      return { at, label };
    });
    check(/Play the preview/.test(left.label) && left.at > 0, where + ": leaving the tab stops the preview where it is (" + left.label + ", " + left.at + ")");
    await page.click('[data-af-studio="play"]');
    await page.waitForTimeout(400);
    const again = await page.evaluate(() => Number(document.querySelector("[data-af-scrub] input").value));
    check(again > left.at, where + ": Play the preview goes on from there (" + left.at + " to " + again + ")");
    await page.click('[data-af-studio="play"]');
    await page.waitForTimeout(200);

    // Every fold opened, nothing runs off the side.
    await page.evaluate(() => document.querySelectorAll('.af-page .af-fold[aria-expanded="false"]').forEach((b) => b.click()));
    await page.waitForTimeout(500);
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": every part of the Studio fits. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    if (shots) await page.locator('[data-af-card="studio-video"]').screenshot({ path: shots + "/studio-video-" + where + ".png" });

    // The shape changes the preview.
    const shape = async (v) => {
      await page.selectOption('[data-af-card="studio-video"] select >> nth=0', v);
      await page.waitForTimeout(500);
      return page.evaluate(() => { const c = document.querySelector("[data-af-videopreview]"); return c.width + "x" + c.height; });
    };
    check((await shape("tall")) === "1080x1920" && (await shape("square")) === "1080x1080" && (await shape("wide")) === "1920x1080", where + ": Tall, Square and Wide give a frame of that shape");
    check(!errors.length, where + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("studio follows")) {
  console.log("With the Studio open, a message played is picked up");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.evaluate(() => { window.__wav = [0.1, 0.5]; window.__clipMs = 300; });
  await page.click('.af-tab[data-tab="studio"]');
  await page.waitForTimeout(500);
  check((await page.locator(".af-fold", { hasText: "Which parts go in" }).count()) === 0, "before anything is played, there are no parts to pick");
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForFunction(() => !!document.querySelector('[data-af-studio="dlall"]') && !document.querySelector('[data-af-studio="dlall"]').disabled, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  check((await page.locator(".af-fold", { hasText: "Which parts go in" }).count()) === 1, "after a message plays, its parts can be picked, without leaving the tab");
  check(!errors.length, "no errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("trim and notes")) {
  console.log("A trim keeps part of a performance, and notes show over the video");
  const fs = await import("node:fs");
  const secsOf = (path) => { const b = fs.readFileSync(path); return b.readUInt32LE(40) / (b.readUInt16LE(22) * (b.readUInt16LE(34) / 8)) / b.readUInt32LE(24); };
  const grab = async (page) => {
    const dl = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await page.click('[data-af-studio="dlall"]');
    const d = await dl;
    return d ? secsOf(await d.path()) : 0;
  };
  for (const size of SIZES) {
    const where = size.name;
    const { context, page, errors } = await open(THEMES[0], size);
    await page.evaluate(() => { window.__wav = [0.1, 0.5]; window.__clipMs = 300; });
    await page.click('.af-tab[data-tab="studio"]');
    await page.waitForTimeout(300);
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForFunction(() => document.querySelector('[data-af-studio="dlall"]') && !document.querySelector('[data-af-studio="dlall"]').disabled && document.querySelector('[data-af-studio="dlpart"]').disabled, null, { timeout: 20000 });
    await page.waitForTimeout(900);
    const whole = await grab(page);
    check(whole > 1, where + ": the whole performance is " + whole.toFixed(2) + " s");
    // Trim by typing.
    await page.locator(".af-fold", { hasText: /^▶?\s*Trim$/ }).click();
    await page.waitForTimeout(300);
    const boxes = page.locator('[data-af-card="studio-show"] input[type="number"]');
    const type = async (n, v) => {
      await boxes.nth(n).fill(String(v));
      await boxes.nth(n).dispatchEvent("change");
      await page.waitForTimeout(500);
    };
    // The Trim fold's two boxes come first in the card, Start at then End at.
    await type(0, 0.3);
    await type(1, 1.1);
    const cut = await grab(page);
    check(Math.abs(cut - 0.8) < 0.02, where + ": Start at 0.3 and End at 1.1 keep 0.8 s (" + cut.toFixed(2) + " s)");
    check(/Kept: 0:00 to 0:01/.test(await page.locator("[data-af-trimsaid]").textContent()), where + ": the trim says what is kept");
    await page.click('[data-af-studio="trimclear"]');
    await page.waitForTimeout(700);
    const back = await grab(page);
    check(Math.abs(back - whole) < 0.02, where + ": Clear the trim keeps it all again");
    // Trim from where the preview is.
    const at = await page.evaluate(() => {
      const bar = document.querySelector("[data-af-scrub] input");
      bar.value = String(Number(bar.max) - 1.5 - 0.6);
      bar.dispatchEvent(new Event("input", { bubbles: true }));
      return Number(bar.value);
    });
    await page.click('[data-af-studio="trimend"]');
    await page.waitForTimeout(700);
    const ended = await grab(page);
    check(ended < whole - 0.4 && ended > 0.5, where + ": End here ends it where the preview was (" + ended.toFixed(2) + " s of " + whole.toFixed(2) + ", at " + at.toFixed(2) + ")");
    await page.click('[data-af-studio="trimclear"]');
    await page.waitForTimeout(600);

    // Notes.
    const print = () =>
      page.evaluate(() => {
        const c = document.querySelector("[data-af-videopreview]");
        const d = c.getContext("2d").getImageData(0, Math.round(c.height * 0.75), c.width, Math.round(c.height * 0.25)).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 16) sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000000007;
        return sum;
      });
    const before = await print();
    await page.locator(".af-fold", { hasText: /^▶?\s*Notes$/ }).click();
    await page.waitForTimeout(300);
    await page.click('[data-af-studio="noteadd"]');
    await page.waitForTimeout(300);
    const note = page.locator("[data-af-videonote] textarea").first();
    await note.fill("Thanks for watching, part two is next week.");
    await note.dispatchEvent("change");
    await page.waitForTimeout(600);
    const saved = await page.evaluate(() => window.__settings.videoNotes);
    check(Array.isArray(saved) && saved.length === 1 && /part two/.test(saved[0].text) && saved[0].when === "all" && saved[0].place === "bottom", where + ": a note is saved to the account (" + JSON.stringify(saved) + ")");
    check((await print()) !== before, where + ": the note shows at the bottom of the preview");
    if (shots) await page.locator("[data-af-videopreview]").screenshot({ path: shots + "/note-" + where + ".png" });
    await page.click('[data-af-studio="notehere"]');
    await page.waitForTimeout(300);
    const two = await page.evaluate(() => window.__settings.videoNotes);
    check(two.length === 2 && two[1].when === "from", where + ": Add a note here starts one at the preview's place");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the trim and the notes fit. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    await page.locator("[data-af-videonote] .af-btn", { hasText: "Remove this note" }).first().click();
    await page.waitForTimeout(300);
    check((await page.evaluate(() => window.__settings.videoNotes.length)) === 1, where + ": Remove this note removes it");
    check(!errors.length, where + ": no errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("transitions")) {
  console.log("Every transition moves from one line to the next, and none is a cut but Cut");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.evaluate(() => { window.__wav = [0.1, 0.5]; window.__clipMs = 300; });
  await page.click('.af-tab[data-tab="stage"]');
  await page.waitForTimeout(300);
  await page.click('.af-tab[data-tab="studio"]');
  await page.waitForTimeout(300);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForFunction(() => document.querySelector('[data-af-studio="dlall"]') && !document.querySelector('[data-af-studio="dlall"]').disabled && document.querySelector('[data-af-studio="dlpart"]').disabled, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.locator(".af-fold", { hasText: "Moving between lines" }).click();
  await page.waitForTimeout(300);
  // Fingerprints of every frame of the preview, 50 ms apart.
  const frames = () =>
    page.evaluate(async () => {
      const bar = document.querySelector("[data-af-scrub] input");
      const c = document.querySelector("[data-af-videopreview]");
      const out = [];
      for (let t = 0; t <= Number(bar.max); t += 0.05) {
        bar.value = String(t);
        bar.dispatchEvent(new Event("input", { bubbles: true }));
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 64) sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000000007;
        out.push(sum);
      }
      return out;
    });
  const pick = async (v) => {
    await page.selectOption('[data-af-row="videoMove"] select', v);
    await page.waitForTimeout(500);
  };
  await pick("cut");
  const cut = await frames();
  const ids = ["rise", "fade", "dissolve", "black", "slide", "wipe", "focus", "zoom"];
  for (const id of ids) {
    await pick(id);
    const f = await frames();
    const diff = f.filter((x, i) => x !== cut[i]).length;
    check(diff >= 2, id + ": the frames between two lines differ from a cut (" + diff + " frames)");
    if (shots && id === "wipe") await page.locator("[data-af-videopreview]").screenshot({ path: shots + "/transition-wipe.png" });
  }
  check(!errors.length, "no errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("hide words")) {
  console.log("Hidden words are covered in the video with a bar, blur or pixels");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  await page.click('.af-tab[data-tab="studio"]');
  await page.waitForTimeout(800);
  const print = () =>
    page.evaluate(() => {
      const c = document.querySelector("[data-af-videopreview]");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 16) sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000000007;
      return sum;
    });
  const plain = await print();
  await page.locator('[data-af-row="censorOn"] .af-box').first().click();
  await page.waitForTimeout(300);
  await page.fill("[data-af-censorwords]", "bells");
  await page.locator("[data-af-censorwords]").dispatchEvent("change");
  await page.waitForTimeout(500);
  const seen = {};
  for (const v of ["bar", "blur", "pixels"]) {
    await page.locator('[data-af-card="studio-censor"] .af-segbtn[data-v="' + v + '"]').click();
    await page.waitForTimeout(400);
    seen[v] = await print();
    if (shots) await page.locator("[data-af-videopreview]").screenshot({ path: shots + "/hide-" + v + ".png" });
  }
  check(seen.bar !== plain && seen.blur !== plain && seen.pixels !== plain, "each cover changes the frame");
  check(seen.bar !== seen.blur && seen.blur !== seen.pixels, "and each cover looks different");
  await page.click("[data-af-censornames]");
  await page.waitForTimeout(300);
  const names = await page.inputValue("[data-af-censorwords]");
  check(/Ysolde/.test(names) && /Ferryman/.test(names) && !/Narrator/.test(names), "Add the cast's names adds each name, and not the narrator");
  check(await page.evaluate(() => /Ysolde/.test(window.__settings.censorWords)), "and the list is saved");
  check(!errors.length, "no errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("start here")) {
  console.log("Start here takes you to each step");
  for (const size of SIZES) {
    const { context, page, errors } = await open(THEMES[0], size);
    const where = size.name;
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    const card = page.locator('[data-af-card="Start here"]');
    check((await card.count()) === 1, where + ": Start here is on the Stage tab");
    const text = await card.textContent();
    check(/Press Play under Now playing/.test(text) && /off by default/.test(text), where + ": it says Play performs a message, and that the other buttons start off");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": its steps and buttons fit. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
    await card.locator(".af-btn", { hasText: "Open the Cast tab" }).click();
    await page.waitForTimeout(300);
    check(await page.evaluate(() => document.querySelector('.af-tab[data-tab="cast"]').getAttribute("aria-selected") === "true"), where + ": Open the Cast tab goes there");
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(300);
    await card.locator(".af-btn", { hasText: "Check my setup" }).click();
    await page.waitForTimeout(600);
    const went = await page.evaluate(() => ({ tab: document.querySelector('.af-tab[data-tab="settings"]').getAttribute("aria-selected"), ran: /Checking|\u2713|ready|missing/i.test(document.querySelector('[data-af-card="Check my setup"]').textContent) }));
    check(went.tab === "true" && went.ran, where + ": Check my setup goes to Settings and runs the check (" + JSON.stringify(went) + ")");
    check(!errors.length, where + ": no console errors. " + errors.slice(0, 2).join("; "));
    await context.close();
  }
}

if (section("drawer bar")) {
  console.log("The drawer's scroll bar is hidden while it holds this tab");
  const { context, page, errors } = await open(THEMES[0], SIZES[1]);
  const got = await page.evaluate(async () => {
    window.__teardown();
    // As Lumiverse lays the drawer out: a box that scrolls, a holder, and
    // the tab's own root inside it.
    const content = document.createElement("div");
    content.style.cssText = "height:400px;overflow-y:auto;width:360px";
    const holder = document.createElement("div");
    const tabRoot = document.createElement("div");
    holder.appendChild(tabRoot);
    content.appendChild(holder);
    document.body.appendChild(content);
    const ctx = Object.assign({}, window.__ctx, {
      ui: Object.assign({}, window.__ctx.ui, {
        registerDrawerTab() {
          return { root: tabRoot, setBadge() {}, activate() {}, destroy() {}, onActivate() { return () => {}; } };
        },
      }),
    });
    window.__teardown = window.__setup(ctx, { fetch: window.__fetch, Audio: window.__Audio });
    await new Promise((r) => setTimeout(r, 400));
    // The test browser draws no scroll bars at all, so the style the bar
    // is given is read instead.
    const bar = () => (getComputedStyle(content).scrollbarWidth === "none" ? 0 : 1);
    const tall = content.scrollHeight > content.clientHeight;
    const ours = bar();
    // Another tab picked: Lumiverse puts that tab's root in the holder.
    const other = document.createElement("div");
    other.style.height = "2000px";
    holder.replaceChildren(other);
    await new Promise((r) => requestAnimationFrame(r));
    const theirs = bar();
    holder.replaceChildren(tabRoot);
    content.scrollTop = 300;
    return { tall, ours, theirs, scrolls: content.scrollTop > 0 };
  });
  check(got.tall && got.ours === 0, "with this tab in the drawer, the drawer shows no scroll bar (" + JSON.stringify(got) + ")");
  check(got.scrolls, "the drawer still scrolls");
  check(got.theirs > 0, "another tab in the drawer keeps its scroll bar");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("widget steady")) {
  console.log("The round button and the open player stay still");
  for (const zoom of [0.85, 1, 1.25]) {
    const { context, page } = await open(THEMES[0], SIZES[0], zoom);
    await page.click('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-af-row="widgetOn"] .af-box').click());
    await page.waitForTimeout(300);
    const off = await page.evaluate(() => {
      const b = window.__widget.querySelector(".af-float").getBoundingClientRect();
      const g = window.__widget.querySelector(".af-float .af-glyph svg").getBoundingClientRect();
      return Math.max(Math.abs(b.left + b.width / 2 - (g.left + g.width / 2)), Math.abs(b.top + b.height / 2 - (g.top + g.height / 2)));
    });
    check(off < 0.75, "zoom " + zoom + ": the symbol is in the middle of the round button (" + off.toFixed(2) + " px off)");
    // While a message plays, the open player changes only what changed.
    await page.evaluate(() => (window.__clipMs = 3000));
    await page.evaluate(() => window.__widget.querySelector(".af-float").click());
    await page.waitForTimeout(450);
    await page.evaluate(() => window.__widget.querySelector('[data-p="play"]').click());
    await page.waitForTimeout(900);
    const redrawn = await page.evaluate(async () => {
      const card = window.__widget.querySelector(".af-pl");
      let n = 0;
      const mo = new MutationObserver((list) => {
        for (const m of list) if (m.type === "childList" && (m.removedNodes.length || m.addedNodes.length)) n++;
      });
      mo.observe(card, { childList: true, subtree: true });
      await new Promise((r) => setTimeout(r, 1500));
      mo.disconnect();
      return n;
    });
    check(redrawn <= 2, "zoom " + zoom + ": nothing in the player is drawn again while a part plays (" + redrawn + " times in 1.5 s)");
    await context.close();
  }
}

if (section("taps")) {
  console.log("A tap on a ?, and the tab bar when the tab changes");
  {
    const { context, page } = await open(THEMES[0], SIZES[0]);
    await page.tap('.af-tab[data-tab="settings"]');
    await page.waitForTimeout(250);
    const q = page.locator('[data-af-row="autoplay"] > .af-between .af-q');
    await q.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await q.tap();
    await page.waitForTimeout(350);
    check((await page.locator(".af-hint[data-af-open]").count()) === 1, "the first tap on a ? opens its description, and it stays open");
    await q.tap();
    await page.waitForTimeout(350);
    check((await page.locator(".af-hint").count()) === 0, "a second tap on the same ? closes it");
    await context.close();
  }
  for (const zoom of [0.85, 1, 1.25]) {
    for (const size of SIZES) {
      const { context, page } = await open(THEMES[0], size, zoom);
      // The drawer scrolls inside its own box, as Lumiverse's does.
      await page.evaluate(() => window.__teardown());
      await page.evaluate(() => {
        const d = document.getElementById("drawer");
        d.innerHTML = "";
        d.style.height = "520px";
        d.style.overflowY = "auto";
        window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
      });
      await page.waitForTimeout(200);
      await page.click('.af-tab[data-tab="settings"]');
      await page.waitForTimeout(200);
      await page.evaluate(() => (document.getElementById("drawer").scrollTop = 900));
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => document.querySelector("[data-af-stick]").getBoundingClientRect().top);
      let held = await page.evaluate(() => document.getElementById("drawer").scrollTop);
      for (const id of ["cast", "stage", "director", "settings"]) {
        await page.click(`.af-tab[data-tab="${id}"]`);
        await page.waitForTimeout(60);
        const r = await page.evaluate(() => {
          const d = document.getElementById("drawer");
          const bar = document.querySelector("[data-af-stick]").getBoundingClientRect();
          return { top: bar.top, at: d.scrollTop, most: d.scrollHeight - d.clientHeight };
        });
        const where = "zoom " + zoom + ", " + size.name + ", " + id;
        check(Math.abs(r.top - before) < 1.5, where + ": the tab bar stays where it was (" + before.toFixed(1) + " then " + r.top.toFixed(1) + ")");
        // The drawer keeps its exact place, as in Auto Refine, unless the new
        // tab is too short to scroll that far.
        const want = Math.min(held, r.most);
        check(Math.abs(r.at - want) < 1.5, where + ": the drawer stays where it was scrolled (" + want.toFixed(1) + " then " + r.at.toFixed(1) + ")");
        held = r.at;
      }
      await context.close();
    }
  }
}

if (section("reduce")) {
  console.log("Reduce motion");
  const { context, page } = await open(THEMES[0], SIZES[1]);
  await page.evaluate(() => {
    window.__settings.reduceMotion = true;
  });
  await page.evaluate(() => window.__teardown());
  await page.evaluate(() => {
    document.getElementById("drawer").innerHTML = "";
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
  });
  await page.waitForTimeout(150);
  await page.click('.af-tab[data-tab="director"]');
  await page.waitForTimeout(50);
  await page.evaluate(() => document.querySelector('[data-af-row="soundsOn"] .af-box').click());
  await page.waitForTimeout(20);
  const hidden = await page.evaluate(() => {
    return document.querySelector('[data-af-row="soundsOn"] > .af-sub').hidden;
  });
  check(hidden, "with reduce motion on, a switch closes its rows at once");
  check(await page.evaluate(() => document.documentElement.hasAttribute("data-af-still")), "the page is marked still, so a description that opens outside the panel stays still too");
  await context.close();
}

await browser.close();
console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) process.exit(1);
