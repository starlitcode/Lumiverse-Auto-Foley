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

const TABS = ["stage", "cast", "director", "sounds", "settings"];

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
    case 'load': return reply({ type: 'state', fresh: window.__fresh !== false, settings: window.__settings, sounds: window.__sounds, hasKey: true, builtInPrompt: '<the_director>\\nYou direct.\\n</the_director>', builtInSkips: '^[ \\\\t]*\\\\|.*\\\\|[ \\\\t]*$\\n【[^】\\\\n]*】', version: '0', decisions: true });
    case 'save': window.__settings = msg.settings; return reply({ type: 'saved', ok: true, settings: msg.settings });
    case 'direct': {
      // A check can hold the answer, and send the note that the Director is
      // being asked, as the backend does when no kept script is found.
      if (window.__directingAt != null) setTimeout(() => backendFns.forEach((fn) => fn({ type: 'directing', messageId: msg.messageId })), window.__directingAt);
      const base = window.__script || SCRIPT;
      let sc = window.__fromKept ? Object.assign({}, base, { fromKept: true }) : base;
      if (window.__fallback) sc = Object.assign({}, sc, { directed: false, fallback: true });
      if (window.__directHold) return setTimeout(() => reply({ type: 'script', script: sc }), window.__directHold);
      return reply({ type: 'script', script: sc });
    }
    case 'sound': return reply({ type: 'sound', base64: 'AAAA', mime: 'audio/mpeg' });
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
    case 'clip_get': { const c = (window.__clips || {})[msg.sig]; return reply(c ? { type: 'clip', found: true, base64: c.base64, mime: c.mime } : { type: 'clip', found: false }); }
    case 'clip_put': window.__clips = Object.assign(window.__clips || {}, { [msg.sig]: { base64: msg.base64, mime: msg.mime } }); return reply({ type: 'clip_kept', ok: true });
    case 'clips_state': { const c = window.__clips || {}; return reply({ type: 'clips_state', count: Object.keys(c).length, bytes: Object.values(c).reduce((n, x) => n + x.base64.length * 0.75, 0) }); }
    case 'clips_clear': window.__clips = {}; return reply({ type: 'clips_state', ok: true, count: 0, bytes: 0 });
    case 'kept_list': return reply({ type: 'kept_list', list: window.__keptList || [] });
    case 'kept_script': return reply({ type: 'kept_script', script: (window.__keptList || []).some((e) => e.key === msg.key) ? SCRIPT : null });
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
    showConfirm: async () => { window.__asked = (window.__asked || 0) + 1; return { confirmed: true }; },
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

async function open(theme, size, zoom = 1) {
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
  await page.addScriptTag({ content: SOURCE });
  await page.evaluate(() => {
    window.__teardown = window.__setup(window.__ctx, { fetch: window.__fetch, Audio: window.__Audio });
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
  console.log("Saved audio lists every saved script, and plays, downloads and deletes them");
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
    await page.click('.af-tab[data-tab="stage"]');
    await page.waitForTimeout(200);
    // The list shows with no fold to open.
    await page.waitForTimeout(400);
    const row = page.locator("[data-af-saved-row]");
    check((await row.count()) === 1, size.name + ": the saved script is listed");
    check(((await row.textContent()) || "").includes("Ysolde’s script") && ((await row.textContent()) || "").includes("The quay was empty"), size.name + ": the row names whose script it is and its first line");
    const dl = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await row.locator(".af-btn", { hasText: "Download" }).click();
    const file = await dl;
    check(!!file && /\.wav$/.test(file.suggestedFilename()), size.name + ": Download saves one WAV file (" + (file && file.suggestedFilename()) + ")");
    await page.evaluate(() => { window.__clipMs = 4000; });
    await row.locator("[data-af-saved-play]").click();
    await page.waitForTimeout(500);
    check(((await row.locator("[data-af-saved-play]").textContent()) || "") === "Stop", size.name + ": Play plays it, and the button turns to Stop");
    check((await page.evaluate(() => (window.__synth || []).length)) === made, size.name + ": playing and downloading make nothing new");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, size.name + ": the list fits. " + m.overflow.concat(m.small).slice(0, 2).join("; "));
    await row.locator(".af-btn", { hasText: "Delete" }).click();
    await page.waitForTimeout(150);
    check((await row.count()) === 1 && ((await row.textContent()) || "").includes("Tap again to delete"), size.name + ": Delete asks once more first");
    await row.locator(".af-btn", { hasText: "Tap again to delete" }).click();
    await page.waitForTimeout(600);
    const dropped = await page.evaluate(() => window.__dropped || []);
    check((await page.locator("[data-af-saved-row]").count()) === 0 && dropped.length === 1 && dropped[0].sigs.length > 0, size.name + ": the second tap deletes it, with its saved audio");
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
  console.log("How they speak keeps what is typed, and counts it");
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
    const got = await page.evaluate(async () => {
      const people = Array.from(document.querySelectorAll(".af-person"));
      for (const c of people) {
        const head = c.querySelector(".af-person-head");
        if (head.getAttribute("aria-expanded") !== "true") head.click();
        await new Promise((r) => setTimeout(r, 400));
        const label = Array.from(c.querySelectorAll("label")).find((x) => x.textContent.trim() === "Name");
        if (!label) continue;
        const input = label.htmlFor ? document.getElementById(label.htmlFor) : label.closest(".af-col").querySelector("input");
        const was = c.querySelector(".af-person-name b").textContent;
        input.focus();
        for (let k = input.value.length; k >= 0; k--) {
          input.value = input.value.slice(0, k);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        await new Promise((r) => setTimeout(r, 50));
        const empty = { name: c.querySelector(".af-person-name b").textContent, face: c.querySelector(".af-person-head .af-avatar").textContent };
        input.value = "Wren";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 50));
        const typed = { name: c.querySelector(".af-person-name b").textContent, face: c.querySelector(".af-person-head .af-avatar").textContent };
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.blur();
        await new Promise((r) => setTimeout(r, 50));
        const back = { name: c.querySelector(".af-person-name b").textContent, field: input.value };
        return { was, empty, typed, back };
      }
      return null;
    });
    check(!!got && got.empty.name === "No name yet" && got.empty.face === "?", size.name + ": an empty name shows No name yet and ? (" + JSON.stringify(got && got.empty) + ")");
    check(!!got && got.typed.name === "Wren" && got.typed.face === "W", size.name + ": a new name shows at once, with its own first letter");
    check(!!got && got.back.name === "Wren" && got.back.field === "Wren", size.name + ": leaving the field empty puts the saved name back (" + JSON.stringify(got && got.back) + ")");
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
      const r = row.querySelector('input[type="range"]');
      const before = row.textContent;
      r.value = "70";
      r.dispatchEvent(new Event("input", { bubbles: true }));
      r.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((x) => setTimeout(x, 400));
      const box = row.getBoundingClientRect();
      return { before, after: row.textContent, saved: window.__settings.decisionSure, w: box.width, vw: document.documentElement.clientWidth, right: box.right };
    });
    check(!!got && /50%/.test(got.before) && /70%/.test(got.after) && got.saved === 70, size.name + ": How sure it must be shows 50% and saves a new value (" + JSON.stringify(got) + ")");
    check(!!got && got.right <= got.vw + 0.5, size.name + ": the slider stays on screen");
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
  check(/deleted, so it stopped/.test(after) || /Press the Auto Foley button/.test(after), "a message deleted while it plays stops, and its script is not kept for Play (" + after + ", playing before: " + playing + ")");
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
    check(got.engine === "eleven_v3" && got.labels.indexOf("Language") >= 0 && ["Speaker boost", "Style", "Speed", "Similarity"].every((x) => got.labels.indexOf(x) < 0) && got.labels.indexOf("Voice direction") < 0 && got.labels.indexOf("Exaggeration") < 0, where + ": an ElevenLabs voice shows only ElevenLabs settings (" + got.labels.join(", ") + ")");
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
    const state = () => page.evaluate(() => ["dlall", "dlpart", "video"].map((k) => document.querySelector('[data-af="' + k + '"]').disabled));
    check((await state()).join() === "true,true,true", where + ": with nothing played, the three are off (" + (await state()).join() + ")");
    await page.click('#mount [data-af-slot="message"]');
    await page.waitForTimeout(900);
    const part = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await page.click('[data-af="dlpart"]');
    const p1 = await part;
    check(!!p1 && /part 1\.wav$/.test(p1.suggestedFilename()), where + ": Download this part saves the part playing (" + (p1 && p1.suggestedFilename()) + ")");
    // Let the message play to the end.
    await page.waitForFunction(() => !document.querySelector('[data-af="dlpart"]') || document.querySelector('[data-af="dlpart"]').disabled, null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const all = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await page.click('[data-af="dlall"]');
    const p2 = await all;
    let size2 = 0;
    if (p2) { const fs = await import("node:fs"); size2 = fs.statSync(await p2.path()).size; }
    check(!!p2 && /\.wav$/.test(p2.suggestedFilename()) && size2 > 44 + 8000, where + ": Download audio saves the whole performance as one WAV (" + (p2 && p2.suggestedFilename()) + ", " + size2 + " bytes)");
    const vid = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
    await page.click('[data-af="video"]');
    await page.waitForTimeout(400);
    const making = await page.evaluate(() => ({ said: document.querySelector('[data-af="keepsaid"]').textContent, label: document.querySelector('[data-af="video"]').textContent }));
    check(/Making the video/.test(making.said) && /Stop the video/.test(making.label), where + ": while it is made, the count shows and the button stops it (" + making.said + ")");
    // Away from the tab, it pauses, and it goes on when the tab is back.
    const paused = await page.evaluate(async () => {
      let state = "hidden";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
      const a = document.querySelector('[data-af="keepsaid"]').textContent;
      // The count is in whole seconds, so it is read well over a second apart.
      await new Promise((r) => setTimeout(r, 1600));
      const b = document.querySelector('[data-af="keepsaid"]').textContent;
      state = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      return a === b;
    });
    check(paused, where + ": away from the tab, the video pauses");
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
