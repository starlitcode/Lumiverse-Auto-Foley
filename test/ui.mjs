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
    case 'direct': return reply({ type: 'script', script: SCRIPT });
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
    default: return;
  }
}
window.__fetch = async (url, init) => {
  const u = String(url);
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/tts-connections?')) return json({ data: [{ id: 't1', name: 'My ElevenLabs', provider: 'elevenlabs', model: 'eleven_v3', voice: 'v0', is_default: true, has_api_key: true }, { id: 't2', name: 'Fish on the side', provider: 'fish_audio', model: 's2.1-pro', has_api_key: true }, { id: 't3', name: 'Box at home', provider: 'openai_tts', api_url: 'http://192.0.2.10:8004/v1', model: 'chatterbox', has_api_key: true }, { id: 't4', name: 'Old flash', provider: 'elevenlabs', model: 'eleven_flash_v2_5', has_api_key: true }, { id: 't5', name: 'Kokoro here', provider: 'kokoro', has_api_key: true }], total: 5 });
  if (u.includes('/models')) return json({ models: [{ id: 's2.1-pro', label: 'Fish S2.1 Pro' }, { id: 'drama-3-preview', label: 'Drama 3 (Preview)' }], provider: 'fish_audio' });
  if (u.includes('/voices')) return json({ voices: [{ id: 'v1', name: 'Hollow Bell', gender: 'female' }, { id: 'v2', name: 'Grit', gender: 'male' }, { id: 'v3', name: 'Lark', gender: 'female' }], provider: 'elevenlabs' });
  if (u.includes('/chats/chat1?messages=false')) return json({ id: 'chat1', name: 'Mar 3, 2026, 4:12:09 PM', character_id: 'c', metadata: {} });
  if (u.includes('/characters/c')) return json({ id: 'c', name: 'Ysolde Marrow-Kestrel of the Lower Quays' });
  if (u.includes('/settings/voiceSettings')) return json({ key: 'voiceSettings', value: { ttsEnabled: true, ttsAutoPlay: true, ttsConnectionId: 't1' } });
  if (u.includes('/messages')) return json({ data: [{ id: 'm1', name: 'Ysolde Marrow-Kestrel of the Lower Quays', is_user: false, content: 'text', swipe_id: 0 }].concat(window.__moreMessages || []), total: 1 + (window.__moreMessages || []).length });
  if (u.includes('/tts/synthesize')) { window.__synth = (window.__synth || []).concat(JSON.parse(init.body)); return new Response(window.__wav ? window.__makeWav(window.__wav[0], window.__wav[1]) : new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }), { status: 200 }); }
  return new Response('{}', { status: 404 });
};
// A real WAV: some seconds of quiet, then some seconds of a tone, so the
// panel can read where the voice is.
window.__makeWav = (quiet, loud) => {
  const rate = 8000, n = Math.round((quiet + loud) * rate);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const ascii = (o, t) => { for (let k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
  ascii(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ascii(36, 'data'); v.setUint32(40, n * 2, true);
  for (let k = 0; k < n; k++) v.setInt16(44 + k * 2, k < quiet * rate ? 0 : Math.round(12000 * Math.sin(k / 3)), true);
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
      return {
        root: r,
        destroy() { surface.remove(); window.__widgetGone = true; },
        setSize(w, h) { surface.style.width = w + 'px'; surface.style.height = h + 'px'; },
        getPosition() { return at; },
        moveTo(x, y) { at = { x, y }; surface.style.left = x + 'px'; surface.style.top = y + 'px'; },
      };
    },
  },
  uploads: {
    // A picture asked for gets a small drawn one, so a picture can be chosen.
    pickFile: async (o) => {
      if (!o || !(o.accept || []).some((x) => /image/.test(x))) return [];
      const c = document.createElement('canvas');
      c.width = 40;
      c.height = 30;
      const g = c.getContext('2d');
      g.fillStyle = '#3a7';
      g.fillRect(0, 0, 40, 30);
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
  check(((await page.locator('[data-af="used"]').textContent()) || "").includes("1,840 tokens"), "Now playing says how many tokens the Director read and wrote");
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
    check(/In use now: Chatterbox-Turbo/.test(notes.now) && notes.first && notes.folds.length === 4 && notes.folds.indexOf("Chatterbox-Turbo") < 0, size.name + ": the engine in use is first and open, and every other engine has its own fold (" + notes.folds.join(" | ") + ")");
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
  // A word filling as it is said counts as lit.
  const lit = () => page.evaluate(() => [document.querySelectorAll('[data-af="line"] .af-w.af-said, [data-af="line"] .af-w.af-now').length, document.querySelectorAll('[data-af="line"] .af-w').length]);
  await page.waitForTimeout(Math.max(0, 450 - (Date.now() - t0)));
  const early = await lit();
  check(early[1] > 0 && early[0] === 0, "no word is lit while the clip is still quiet (" + early.join(" of ") + ")");
  await page.waitForTimeout(Math.max(0, 2250 - (Date.now() - t0)));
  const late = await lit();
  check(late[1] > 0 && late[0] === late[1], "every word is lit by the end of the voice (" + late.join(" of ") + ")");
  // Part of the way through, one word is part filled: it fills smoothly as it
  // is said, rather than turning on all at once.
  await page.evaluate(() => { window.__clipMs = 2400; });
  const fills = await page.evaluate(async () => {
    const seen = new Set();
    for (let k = 0; k < 40; k++) {
      const w = document.querySelector('[data-af="line"] .af-w.af-now');
      if (w) seen.add(Math.round(parseFloat(w.style.getPropertyValue("--af-p")) / 10));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return Array.from(seen);
  });
  check(fills.some((x) => x > 0 && x < 10), "a word fills part way as it is said (" + fills.join(",") + ")");
  check(!errors.length, "no console errors. " + errors.slice(0, 2).join("; "));
  await context.close();
}

if (section("kept")) {
  console.log("Kept audio plays again without being made again");
  const { context, page, errors } = await open(THEMES[0], SIZES[0]);
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForFunction(() => document.querySelector('#mount [data-af-slot="message"]').getAttribute("aria-busy") === null && (window.__synth || []).length > 0, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  const made = await page.evaluate(() => (window.__synth || []).length);
  check(made > 0 && (await page.evaluate(() => Object.keys(window.__clips || {}).length)) === made, "each line made is kept (" + made + ")");
  await page.click('#mount [data-af-slot="message"]');
  await page.waitForTimeout(1500);
  check((await page.evaluate(() => (window.__synth || []).length)) === made, "playing it again makes nothing new");
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
    await page.waitForTimeout(200);
    const input = page.locator('.af-group input[aria-label="Group name"]');
    check((await input.count()) === 1, where + ": a new group opens with its name ready to type");
    await input.fill("Harbor town");
    await input.press("Enter");
    await page.waitForTimeout(250);
    check((await page.locator(".af-group-toggle", { hasText: "Harbor town" }).count()) === 1, where + ": the group takes its name");
    // Move the first person who is not in a group into it.
    await page.locator(".af-page > .af-person .af-person-head").first().click();
    await page.waitForTimeout(350);
    const sel = page.locator('.af-page > .af-person .af-col:has(label:text-is("Group")) select').first();
    await sel.selectOption({ label: "Harbor town" });
    await page.waitForTimeout(300);
    check((await page.locator(".af-group .af-person").count()) === 1, where + ": a person moves into the group");
    check((await page.locator(".af-group-count").textContent()).includes("1 person"), where + ": the group says how many are in it");
    await page.locator(".af-group-toggle").click();
    await page.waitForTimeout(400);
    check(await page.evaluate(() => document.querySelector(".af-group-body").hidden), where + ": a tap closes the group");
    const m = await page.evaluate(MEASURE, size.touch);
    check(!m.overflow.length && !m.small.length, where + ": the group row fits and its buttons are big enough. " + m.overflow.concat(m.small).slice(0, 3).join("; "));
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
  await page.click('.af-tab[data-tab="settings"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-af-row="chatHighlight"] .af-box').click());
  await page.waitForTimeout(150);
  check(await page.evaluate(() => !CSS.highlights.get("auto-foley-word")), "turning Light up words in the chat off clears it");
  check(!errors.length, "no page errors. " + errors.slice(0, 2).join(" | "));
  await context.close();
}

if (section("more settings")) {
  console.log("Each person gets a voice ID box and the settings their engine takes");
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
      const fold = document.querySelector(".af-person [data-af-more]");
      const head = fold && fold.querySelector(".af-fold");
      if (head) head.click();
      await new Promise((r) => setTimeout(r, 400));
      const labels = fold ? Array.from(fold.querySelectorAll(".af-lab")).map((x) => x.textContent.trim()) : [];
      const vw = document.documentElement.clientWidth;
      const wide = Array.from(document.querySelectorAll(".af-person *")).filter((e) => e.getBoundingClientRect().right > vw + 0.5).length;
      return { picked, engine: fold && fold.getAttribute("data-af-more"), labels, wide };
    });
    check(got.picked, where + ": a pasted voice ID is saved as the person's voice");
    check(got.engine === "eleven_v3" && got.labels.indexOf("Speaker boost") >= 0 && got.labels.indexOf("Voice direction") < 0 && got.labels.indexOf("Exaggeration") < 0, where + ": an ElevenLabs voice shows only ElevenLabs settings (" + got.labels.join(", ") + ")");
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
    check((await head.locator(".af-person-head .af-avatar img").count()) === 1, size.name + ": a chosen picture is shown");
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
      for (const id of ["cast", "stage", "director", "settings"]) {
        await page.click(`.af-tab[data-tab="${id}"]`);
        await page.waitForTimeout(60);
        const r = await page.evaluate(() => {
          const bar = document.querySelector("[data-af-stick]").getBoundingClientRect();
          const pg = document.querySelector('[data-af="page"]').getBoundingClientRect();
          return { top: bar.top, gap: pg.top - bar.bottom };
        });
        const where = "zoom " + zoom + ", " + size.name + ", " + id;
        check(Math.abs(r.top - before) < 1.5, where + ": the tab bar stays where it was (" + before.toFixed(1) + " then " + r.top.toFixed(1) + ")");
        check(r.gap >= 0 && r.gap < 20, where + ": the new tab starts right under the bar (" + r.gap.toFixed(1) + " px)");
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
