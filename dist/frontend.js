// Auto Foley, the panel and the player.
//
// The panel lives in a Lumiverse drawer tab, with five tabs: Stage, Cast,
// Director, Sounds and Settings. Each message gets an Auto Foley button in its
// row of buttons. Pressing it reads the message, sends it to the backend to be
// directed, and plays the script that comes back: each line through the
// reader's ElevenLabs connection in Lumiverse, with the voice of whoever says
// it, and each sound from the library or from ElevenLabs.
//
// The ElevenLabs key for speech stays in Lumiverse. Lines are spoken through
// Lumiverse's own TTS route, as the signed-in reader, so this file never sees
// that key.
const VERSION = '0.1.0';
// The marks Lumiverse puts on another extension's part of the page. Nothing
// inside one is read, written or pressed.
const OTHER_UI = '[data-spindle-extension-root],[data-spindle-ext],[data-spindle-modal]';
const STORE_KEY = 'lv-auto-foley:settings:v1';
const API = '/api/v1';
// The ElevenLabs models Lumiverse offers. Only v3 and v4 understand voice
// tags. On the others a tag is read out loud, so tags are taken out first.
const MODELS = [
    { id: '', label: 'The connection\'s model' },
    { id: 'eleven_v4', label: 'Eleven v4' },
    { id: 'eleven_v4_turbo', label: 'Eleven v4 Turbo' },
    { id: 'eleven_v3', label: 'Eleven v3' },
    { id: 'eleven_multilingual_v2', label: 'Eleven Multilingual v2 (no tags)' },
    { id: 'eleven_flash_v2_5', label: 'Eleven Flash v2.5 (no tags)' },
];
function takesTags(model) {
    return /^eleven_v(3|4)/.test(String(model || ''));
}
function stripTags(text) {
    return String(text || '')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.!?…;:])/g, '$1')
        .trim();
}
// Eleven v3 has three stability settings, not a range: Creative, Natural and
// Robust, at 0, 0.5 and 1. Any other value is moved to the nearest one.
const V3_STEPS = [0, 0.5, 1];
function stabilityFor(model, base, big) {
    const b = Math.min(1, Math.max(0, Number(base) || 0));
    if (/^eleven_v3/.test(model)) {
        let at = 0;
        for (let k = 1; k < V3_STEPS.length; k++)
            if (Math.abs(V3_STEPS[k] - b) < Math.abs(V3_STEPS[at] - b))
                at = k;
        if (big && at > 0)
            at--;
        return V3_STEPS[at];
    }
    // A big moment loosens the voice so it can swing further.
    return big ? Math.max(0.1, Math.round((b - 0.25) * 100) / 100) : b;
}
// An id that works over plain http. crypto.randomUUID is missing outside a
// secure context, which is how a self-hosted Lumiverse is often reached.
let idCounter = 0;
function rid(prefix) {
    idCounter = (idCounter + 1) % 1e6;
    return prefix + Date.now().toString(36) + idCounter.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
function esc(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
// A line with its tags drawn as chips, for the script on the Stage tab.
function lineHtml(text) {
    const parts = String(text || '').split(/(\[[^\]]*\])/g);
    return parts
        .map((p) => {
        if (!/^\[[^\]]*\]$/.test(p))
            return esc(p);
        const inner = p.slice(1, -1);
        const cls = /^sounds? of\b/i.test(inner) ? 'af-chip af-chip-insound' : 'af-chip af-chip-tag';
        return '<span class="' + cls + '">' + esc(inner) + '</span>';
    })
        .join('');
}
function base64ToBlob(b64, mime) {
    const bin = atob(String(b64 || ''));
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++)
        bytes[k] = bin.charCodeAt(k);
    return new Blob([bytes], { type: mime || 'audio/mpeg' });
}
function bytesToBase64(bytes) {
    let bin = '';
    const step = 0x8000;
    for (let k = 0; k < bytes.length; k += step) {
        bin += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes.subarray(k, k + step)));
    }
    return btoa(bin);
}
// What Lumiverse's own routes said, in words. Lumiverse answers an error with
// { error: "..." }, and its words are kept after ours.
async function hostTrouble(res, what) {
    let said = '';
    try {
        const text = await res.text();
        try {
            const j = JSON.parse(text);
            said = typeof j.error === 'string' ? j.error : '';
        }
        catch (_) {
            said = text.slice(0, 200);
        }
    }
    catch (_) { }
    const tail = said ? ' Lumiverse said: ' + said.slice(0, 240) : '';
    if (res.status === 401)
        return what + ' failed because Lumiverse says you are signed out. Reload the page and sign in.' + tail;
    if (res.status === 404)
        return what + ' failed because Lumiverse could not find it.' + tail;
    if (/No API key/i.test(said))
        return what + ' failed because your ElevenLabs connection in Lumiverse has no key saved.' + tail;
    if (/quota|credit/i.test(said))
        return what + ' failed because the ElevenLabs account is out of credits.' + tail;
    if (/401|invalid.*key|unauthori/i.test(said))
        return what + ' failed because ElevenLabs refused the key saved on your connection.' + tail;
    if (/429|rate|busy|too many/i.test(said))
        return what + ' failed because ElevenLabs is busy. Try again in a moment.' + tail;
    return what + ' failed (' + res.status + ').' + tail;
}
function netTrouble(e, what) {
    if (e && e.name === 'AbortError')
        return what + ' was stopped.';
    return what + ' failed because Lumiverse could not be reached. Check your connection to the server.';
}
// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
// A boom microphone, the long-pole microphone a film crew holds over a scene
// to record dialogue and foley, with the sound it picks up.
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.6" y="-0.2" width="5.6" height="13" rx="2.8" transform="rotate(-45 8.4 6.3)"/><path d="M9.1 11.6l4-4"/><path d="M13.2 13.1 21.6 21.5"/><path d="M2.2 13.6a7 7 0 0 0 5.2 5.2"/><path d="M1.4 18a10.4 10.4 0 0 0 4.6 4.6"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
const ICON_SKIP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6.5v11a1 1 0 0 0 1.55.83L15 13.2V17a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v3.8L7.55 5.67A1 1 0 0 0 6 6.5Z"/></svg>';
const ICON_REDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 9.5a4 4 0 0 1 0 5"/></svg>';
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
// Colors are the host's theme variables. The extension's own names start with
// --af- and only ever point at a host variable, so a theme recolors all of it.
const CSS = `
.af {
  --af-accent: var(--lumiverse-primary, #8b7cf6);
  --af-accent-text: var(--lumiverse-primary-text, var(--lumiverse-primary, #b9adff));
  --af-accent-contrast: var(--lumiverse-primary-contrast, #fff);
  --af-accent-soft: var(--lumiverse-primary-020, rgba(139,124,246,.2));
  --af-accent-faint: var(--lumiverse-primary-010, rgba(139,124,246,.1));
  /* The status colors are pale on a light theme, so they color borders,
     dots and fills only. Text stays in the text colors. */
  --af-sound: var(--lumiverse-warning, #e0a84f);
  --af-sound-soft: var(--lumiverse-warning-015, rgba(224,168,79,.16));
  --af-good: var(--lumiverse-success, #5fbf8a);
  --af-bad: var(--lumiverse-danger, #e06c6c);
  --af-text: var(--lumiverse-text, #e8e6f0);
  --af-muted: var(--lumiverse-text-muted, #a5a1b5);
  --af-dim: var(--lumiverse-text-dim, #807c90);
  --af-line: var(--lumiverse-border, rgba(128,128,128,.25));
  --af-line-hover: var(--lumiverse-border-hover, rgba(128,128,128,.4));
  --af-fill: var(--lumiverse-fill-subtle, rgba(128,128,128,.07));
  --af-hover: var(--lumiverse-bg-hover, rgba(128,128,128,.12));
  --af-card: var(--lumiverse-bg-elevated, rgba(128,128,128,.06));
  --af-input: var(--lumiverse-input-bg, rgba(128,128,128,.06));
  /* The reader's own corner setting from the Theme Panel. */
  --af-r: var(--lcs-radius, 10px);
  --af-r-sm: var(--lcs-radius-sm, 7px);
  --af-ease: cubic-bezier(.2,.7,.2,1);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 14px 14px 28px;
  color: var(--af-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
}
.af *, .af *::before, .af *::after { box-sizing: border-box; }
.af [hidden] { display: none !important; }

.af-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.af-brand { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
.af-brand-icon {
  display: grid; place-items: center; flex: none; width: 32px; height: 32px;
  border-radius: 9px; background: var(--af-accent-soft); color: var(--af-accent-text);
}
.af-brand-icon svg { width: 18px; height: 18px; }
.af-brand-name { font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
.af-brand-sub { color: var(--af-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-pill {
  flex: none; padding: 3px 9px; border: 1px solid var(--af-line); border-radius: 999px;
  color: var(--af-muted); font-size: 11px; font-weight: 600; white-space: nowrap;
}
.af-pill[data-on="true"] { border-color: var(--af-accent); color: var(--af-accent-text); background: var(--af-accent-faint); }

.af-tabs {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px;
  padding: 4px; border: 1px solid var(--af-line); border-radius: var(--af-r); background: var(--af-fill);
}
.af-tab {
  min-width: 0; min-height: 34px; padding: 0 4px; border: 0; border-radius: var(--af-r-sm);
  background: transparent; color: var(--af-muted); font: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: background-color .18s ease, color .18s ease;
}
.af-tab[aria-selected="true"] { background: var(--af-accent); color: var(--af-accent-contrast); }
.af-tab:focus-visible, .af button:focus-visible, .af select:focus-visible, .af input:focus-visible, .af textarea:focus-visible {
  outline: 2px solid var(--af-accent); outline-offset: 2px;
}
@media (hover: hover) {
  .af-tab:not([aria-selected="true"]):hover { background: var(--af-hover); color: var(--af-text); }
}

.af-page { display: flex; flex-direction: column; gap: 12px; }
.af-page.af-enter { animation: af-in .22s var(--af-ease) both; }
@keyframes af-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.af-card {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid var(--af-line); border-radius: var(--af-r); background: var(--af-card);
  min-width: 0;
}
.af-card-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; }
.af-card-title h3 {
  margin: 0; color: var(--af-muted); font-size: 11px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase;
}
.af-hint { margin: 0; color: var(--af-muted); font-size: 11.5px; line-height: 1.45; }
.af-hint a { color: var(--af-accent-text); }
.af-status { min-height: 18px; margin: 0; color: var(--af-muted); font-size: 12px; overflow-wrap: anywhere; }
.af-status[data-kind="bad"] { color: var(--af-bad); }
.af-status[data-kind="good"]::before { content: "✓ "; color: var(--af-good); font-weight: 700; }

.af-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.af-label { color: var(--af-text); font-size: 12px; font-weight: 600; }
.af-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.af-grow { flex: 1 1 160px; min-width: 0; }
.af-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 520px) { .af-grid2 { grid-template-columns: minmax(0, 1fr); } }

.af input[type="text"], .af input[type="password"], .af input[type="search"], .af select, .af textarea {
  width: 100%; min-height: 34px; padding: 6px 10px;
  border: 1px solid var(--af-line); border-radius: var(--af-r-sm);
  background: var(--af-input); color: var(--af-text); font: inherit; font-size: 13px;
  transition: border-color .15s ease;
}
.af textarea { min-height: 84px; resize: vertical; line-height: 1.45; }
.af textarea.af-prompt { min-height: 260px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.af select { cursor: pointer; }
@media (hover: hover) {
  .af input[type="text"]:hover, .af input[type="password"]:hover, .af select:hover, .af textarea:hover { border-color: var(--af-line-hover); }
}

.af-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 34px; padding: 0 12px; border: 1px solid var(--af-line); border-radius: var(--af-r-sm);
  background: transparent; color: var(--af-text); font: inherit; font-size: 12.5px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
  transition: background-color .15s ease, border-color .15s ease, opacity .15s ease;
}
.af-btn svg { width: 15px; height: 15px; flex: none; }
.af-btn:disabled { opacity: .45; cursor: default; }
.af-btn-main { border-color: var(--af-accent); background: var(--af-accent); color: var(--af-accent-contrast); }
.af-btn-danger { color: var(--af-bad); }
@media (hover: hover) {
  .af-btn:not(:disabled):hover { background: var(--af-hover); border-color: var(--af-line-hover); }
  .af-btn-main:not(:disabled):hover { background: var(--lumiverse-primary-hover, var(--af-accent)); border-color: var(--af-accent); }
}

/* Switches */
.af-switch {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px;
  min-height: 36px; cursor: pointer;
}
.af-switch-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.af-switch-text b { font-size: 12.5px; font-weight: 600; }
.af-switch-text span { color: var(--af-muted); font-size: 11.5px; }
.af-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.af-knob {
  position: relative; width: 38px; height: 22px; border-radius: 999px;
  background: var(--af-line); transition: background-color .2s ease;
}
.af-knob::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3);
  transition: transform .26s cubic-bezier(.3,1.5,.5,1);
}
.af-switch input:checked + .af-knob { background: var(--af-accent); }
.af-switch input:checked + .af-knob::after { transform: translateX(16px); }
.af-switch input:focus-visible + .af-knob { outline: 2px solid var(--af-accent); outline-offset: 2px; }

/* What opens under a switch */
.af-sub { overflow: hidden; }
.af-sub-inner { display: flex; flex-direction: column; gap: 10px; padding: 2px 0 2px 12px; border-left: 2px solid var(--af-accent-soft); }

/* Segmented choice */
.af-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; padding: 3px; border: 1px solid var(--af-line); border-radius: var(--af-r-sm); background: var(--af-fill); }
.af-seg button {
  min-height: 32px; padding: 0 6px; border: 0; border-radius: 5px; background: transparent;
  color: var(--af-muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.af-seg button[aria-pressed="true"] { background: var(--af-accent); color: var(--af-accent-contrast); }

/* Sliders. The host styles range inputs on every page, so these selectors
   carry the .af class twice to win over it. */
.af.af input[type="range"] {
  -webkit-appearance: none; appearance: none; width: 100%; height: 22px; margin: 0;
  background: transparent; cursor: pointer;
}
.af.af input[type="range"]::-webkit-slider-runnable-track {
  height: 4px; border-radius: 999px;
  background: linear-gradient(90deg, var(--af-accent) 0 var(--af-fill-to, 50%), var(--af-line) var(--af-fill-to, 50%) 100%);
}
.af.af input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -6px; border: 0;
  border-radius: 50%; background: var(--af-accent); box-shadow: 0 0 0 3px var(--af-accent-soft);
}
.af.af input[type="range"]::-moz-range-track { height: 4px; border-radius: 999px; background: var(--af-line); }
.af.af input[type="range"]::-moz-range-progress { height: 4px; border-radius: 999px; background: var(--af-accent); }
.af.af input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; border: 0; border-radius: 50%; background: var(--af-accent); }
.af-slider-head { display: flex; justify-content: space-between; gap: 8px; }
.af-slider-head output { color: var(--af-muted); font-size: 12px; font-variant-numeric: tabular-nums; }

/* The Stage */
.af-now { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.af-transport { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.af-play {
  display: grid; place-items: center; width: 46px; height: 46px; border: 0; border-radius: 50%;
  background: var(--af-accent); color: var(--af-accent-contrast); cursor: pointer; flex: none;
  box-shadow: 0 3px 12px var(--af-accent-soft);
}
.af-play svg { width: 20px; height: 20px; }
.af-play:disabled { opacity: .45; cursor: default; box-shadow: none; }
.af-round {
  display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--af-line);
  border-radius: 50%; background: transparent; color: var(--af-text); cursor: pointer; flex: none;
}
.af-round svg { width: 15px; height: 15px; }
.af-round:disabled { opacity: .4; cursor: default; }
@media (hover: hover) { .af-round:not(:disabled):hover { background: var(--af-hover); } }
.af-now-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 140px; }
.af-now-title { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-now-sub { color: var(--af-muted); font-size: 12px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.af-progress { height: 4px; border-radius: 999px; background: var(--af-line); overflow: hidden; }
.af-progress > div { height: 100%; width: 0; background: var(--af-accent); transition: width .3s linear; }

.af-mixer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.af-strip {
  display: flex; flex-direction: column; gap: 6px; padding: 10px; min-width: 0;
  border: 1px solid var(--af-line); border-radius: var(--af-r-sm); background: var(--af-fill);
}
.af-strip-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.af-strip-name { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 650; }
.af-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--af-accent); flex: none; }
.af-dot-sound { background: var(--af-sound); }
.af-mute {
  min-height: 32px; padding: 0 9px; border: 1px solid var(--af-line); border-radius: 6px; background: transparent;
  color: var(--af-muted); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
}
.af-mute[aria-pressed="true"] { border-color: var(--af-bad); color: var(--af-bad); }

.af-script { display: flex; flex-direction: column; gap: 6px; }
.af-line {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: start;
  padding: 8px; border: 1px solid transparent; border-radius: var(--af-r-sm);
  transition: background-color .6s ease, border-color .6s ease;
}
.af-line[data-now="true"] { background: var(--af-accent-faint); border-color: var(--af-accent-soft); }
.af-line[data-done="true"] { opacity: .72; }
.af-line-go {
  display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--af-line);
  border-radius: 8px; background: transparent; color: var(--af-muted); font: inherit; font-size: 11px;
  font-weight: 700; cursor: pointer; font-variant-numeric: tabular-nums;
}
@media (hover: hover) { .af-line-go:hover { background: var(--af-hover); color: var(--af-text); } }
.af-line-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.af-line-who { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--af-accent-text); }
.af-line-who[data-kind="narration"] { color: var(--af-muted); }
.af-line-text { overflow-wrap: anywhere; }
.af-line-note { color: var(--af-muted); font-size: 11px; }
.af-chip {
  display: inline-flex; align-items: center; gap: 4px; margin: 0 2px; padding: 0 7px; border-radius: 999px;
  font-size: 11px; font-weight: 650; line-height: 19px; vertical-align: 1px; white-space: nowrap;
}
.af-chip-tag { background: var(--af-accent-soft); color: var(--af-accent-text); }
.af-chip-insound { background: var(--af-sound-soft); color: var(--af-text); box-shadow: inset 0 0 0 1px var(--af-sound); white-space: normal; }
button.af-chip-sound {
  min-height: 24px; border: 1px solid var(--af-sound); background: var(--af-sound-soft); color: var(--af-text);
  font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; white-space: normal; text-align: left;
}
button.af-chip-sound svg { width: 12px; height: 12px; flex: none; color: var(--af-sound); }
.af-empty { padding: 18px 12px; color: var(--af-muted); text-align: center; font-size: 12.5px; }

.af-log { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow: auto; }
.af-log-line { color: var(--af-muted); font-size: 11.5px; overflow-wrap: anywhere; }
.af-log-line b { color: var(--af-muted); font-weight: 600; font-variant-numeric: tabular-nums; margin-right: 6px; }
.af-log-line[data-kind="bad"] { color: var(--af-bad); }

/* The Cast */
.af-person { padding: 0; gap: 0; }
.af-person-head {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 8px;
  width: 100%; min-height: 48px; padding: 8px 10px; border: 0; border-radius: var(--af-r);
  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
@media (hover: hover) { .af-person-head:hover { background: var(--af-hover); } }
.af-avatar {
  display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  background: var(--af-accent-soft); color: var(--af-text); font-size: 12px; font-weight: 700;
  box-shadow: inset 0 0 0 1.5px var(--af-accent);
}
.af-person[data-kind="narrator"] .af-avatar { background: var(--af-fill); box-shadow: inset 0 0 0 1.5px var(--af-line-hover); }
.af-person[data-kind="persona"] .af-avatar { background: var(--af-sound-soft); box-shadow: inset 0 0 0 1.5px var(--af-sound); }
.af-person-name { display: flex; flex-direction: column; min-width: 0; }
.af-person-name b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-person-name span { color: var(--af-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-badge { padding: 2px 7px; border: 1px solid var(--af-line); border-radius: 999px; color: var(--af-muted); font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.af-badge-ai { border-color: var(--af-sound); background: var(--af-sound-soft); color: var(--af-text); }
.af-chev { width: 16px; height: 16px; color: var(--af-muted); transition: transform .22s var(--af-ease); }
.af-person[data-open="true"] .af-chev { transform: rotate(90deg); }
.af-person-body { overflow: hidden; }
.af-person-inner { display: flex; flex-direction: column; gap: 10px; padding: 4px 12px 12px; }

/* The Sounds library */
.af-sounds { display: flex; flex-direction: column; gap: 6px; }
.af-sound {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center;
  padding: 6px 8px; border: 1px solid var(--af-line); border-radius: var(--af-r-sm); background: var(--af-fill);
}
.af-sound-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.af-sound-name { font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere; }
.af-sound-meta { color: var(--af-muted); font-size: 11px; }
.af-sound input[type="text"] { min-height: 32px; font-size: 12px; }

.af-check { display: flex; align-items: center; gap: 9px; min-height: 32px; font-size: 12.5px; cursor: pointer; }
.af-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--af-accent); flex: none; }
.af-checks { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.af-checks li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; font-size: 12px; }
.af-checks li::before { content: "•"; color: var(--af-muted); }
.af-checks li[data-ok="true"]::before { content: "✓"; color: var(--af-good); }
.af-checks li[data-ok="false"]::before { content: "!"; color: var(--af-bad); font-weight: 700; }

@media (pointer: coarse) {
  .af-tab, .af-btn, .af-seg button { min-height: 38px; }
  button.af-chip-sound { min-height: 32px; }
  .af input[type="text"], .af input[type="password"], .af select { min-height: 40px; font-size: 16px; }
  .af textarea { font-size: 16px; }
}

.af[data-calm="true"] *, .af[data-calm="true"] *::before, .af[data-calm="true"] *::after {
  animation: none !important; transition: none !important;
}

/* The button on each message */
.af-msg-btn { position: relative; }
.af-msg-btn[data-af-busy="true"] { color: var(--lumiverse-primary, #8b7cf6); }
.af-msg-btn.af-own {
  display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px;
  background: transparent; color: var(--lumiverse-text-muted, #a5a1b5); cursor: pointer;
}
.af-msg-btn.af-own svg { width: 16px; height: 16px; }
@media (hover: hover) { .af-msg-btn.af-own:hover { background: var(--lumiverse-bg-hover, rgba(128,128,128,.12)); } }
@media (pointer: coarse) { .af-msg-btn.af-own { width: 34px; height: 34px; } }
`;
const DEFAULTS = {
    enabled: true,
    ttsConnection: '',
    autoplay: false,
    prepareAhead: true,
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
    cast: [],
};
// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------
export function setup(ctx, overrides) {
    const disposers = [];
    const opts = overrides || {};
    const fetchImpl = opts.fetch || ((input, init) => fetch(input, init));
    const AudioCtor = opts.Audio || (typeof Audio !== 'undefined' ? Audio : null);
    let alive = true;
    // Timers that outlive a single call, cleared in teardown.
    const timers = new Set();
    const TABS = [
        { id: 'stage', label: 'Stage' },
        { id: 'cast', label: 'Cast' },
        { id: 'director', label: 'Director' },
        { id: 'sounds', label: 'Sounds' },
        { id: 'settings', label: 'Settings' },
    ];
    let tab = 'stage';
    try {
        const t = localStorage.getItem('lv-auto-foley:tab');
        if (t && TABS.some((x) => x.id === t))
            tab = t;
    }
    catch (_) { }
    // The Stage tab's live parts, while it is drawn.
    let stageRefs = null;
    // Mute on the mixer is for this page only, and is not saved.
    const muted = { voice: false, sound: false };
    // ---- settings ----
    let S = Object.assign({}, DEFAULTS);
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw)
            S = Object.assign({}, DEFAULTS, JSON.parse(raw));
    }
    catch (_) { }
    // Nothing is written to the account until the account has answered once,
    // so an empty first render can never overwrite real settings.
    let accountAnswered = false;
    let builtInPrompt = '';
    let sounds = [];
    let hasKey = false;
    let hostHasDecisions = true;
    // The version the backend reported, for the debug report. The two halves
    // load separately, so after an update they can briefly differ.
    let backendVersion = '';
    let saveTimer = null;
    function keepLocal() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(S));
        }
        catch (_) { }
    }
    function save() {
        keepLocal();
        if (!accountAnswered)
            return;
        if (saveTimer)
            clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            rpc({ type: 'save', settings: S }, 15000).then((r) => {
                if (!r || !r.ok)
                    log('Your settings could not be saved to your account.', 'bad');
            }, () => log('Your settings could not be saved: the backend did not answer.', 'bad'));
        }, 400);
    }
    function set(patch) {
        Object.assign(S, patch);
        save();
    }
    // ---- talking to the backend ----
    const pending = new Map();
    try {
        disposers.push(ctx.onBackendMessage((msg) => {
            if (!msg || typeof msg !== 'object')
                return;
            const id = String(msg.requestId || '');
            if (id && pending.has(id)) {
                const p = pending.get(id);
                // A sound list or a changed cast can come after the main answer
                // to the same request. Only the main answer settles it.
                if (msg.type === 'sounds' || msg.type === 'state_changed') {
                    onPush(msg);
                    return;
                }
                pending.delete(id);
                clearTimeout(p.timer);
                p.resolve(msg);
                return;
            }
            onPush(msg);
        }));
    }
    catch (_) { }
    function rpc(msg, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (!alive)
                return reject(new Error('Auto Foley was turned off.'));
            const requestId = rid('r');
            const timer = setTimeout(() => {
                pending.delete(requestId);
                reject(new Error('The backend did not answer in time.'));
            }, timeoutMs);
            pending.set(requestId, { resolve, reject, timer });
            try {
                ctx.sendToBackend(Object.assign({ requestId }, msg));
            }
            catch (e) {
                pending.delete(requestId);
                clearTimeout(timer);
                reject(new Error('The backend could not be reached.'));
            }
        });
    }
    function onPush(msg) {
        if (msg.type === 'sounds' && Array.isArray(msg.sounds)) {
            sounds = msg.sounds;
            if (tab === 'sounds')
                renderTab();
        }
        else if (msg.type === 'state_changed' && msg.settings) {
            // The backend added someone to the cast. Its copy is the newer one.
            S = Object.assign({}, DEFAULTS, msg.settings);
            keepLocal();
            if (tab === 'cast')
                renderTab();
        }
    }
    function notify(kind, text) {
        try {
            ctx.sendToBackend({ type: 'notify', kind, text });
        }
        catch (_) { }
    }
    // ---- the log ----
    const logLines = [];
    function log(text, kind) {
        const d = new Date();
        const at = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
        logLines.push({ at, text: String(text), kind: kind || '' });
        while (logLines.length > 120)
            logLines.shift();
        if (S.debugConsole) {
            try {
                console.info('[Auto Foley] ' + at + ' ' + text);
            }
            catch (_) { }
        }
        if (tab === 'stage')
            paintLog();
    }
    // ---- Lumiverse's own routes ----
    async function api(path, init) {
        return fetchImpl(API + path, Object.assign({ credentials: 'include', headers: { Accept: 'application/json' } }, init || {}));
    }
    let ttsConnections = [];
    let ttsWhy = '';
    async function loadTtsConnections() {
        try {
            const res = await api('/tts-connections?limit=200');
            if (!res.ok) {
                ttsWhy = await hostTrouble(res, 'Reading your TTS connections');
                ttsConnections = [];
                return;
            }
            const j = await res.json();
            const all = Array.isArray(j && j.data) ? j.data : [];
            ttsConnections = all.filter((c) => String(c && c.provider).toLowerCase() === 'elevenlabs');
            ttsWhy = ttsConnections.length ? '' : 'You have no ElevenLabs connection in Lumiverse. Add one under Connections, in the TTS section.';
        }
        catch (e) {
            ttsWhy = netTrouble(e, 'Reading your TTS connections');
            ttsConnections = [];
        }
    }
    function activeConnection() {
        if (S.ttsConnection)
            return ttsConnections.find((c) => c.id === S.ttsConnection) || null;
        return ttsConnections.find((c) => c.is_default) || ttsConnections[0] || null;
    }
    const voiceCache = {};
    async function loadVoices(connId) {
        if (!connId)
            return { voices: [], why: 'Pick your ElevenLabs connection in the Settings tab first.' };
        if (voiceCache[connId])
            return voiceCache[connId];
        try {
            const res = await api('/tts-connections/' + encodeURIComponent(connId) + '/voices');
            if (!res.ok)
                return { voices: [], why: await hostTrouble(res, 'Reading your ElevenLabs voices') };
            const j = await res.json();
            const voices = Array.isArray(j && j.voices) ? j.voices : [];
            const out = { voices, why: j && j.error ? 'Reading your ElevenLabs voices failed. Lumiverse said: ' + String(j.error).slice(0, 200) : '' };
            if (voices.length)
                voiceCache[connId] = out;
            return out;
        }
        catch (e) {
            return { voices: [], why: netTrouble(e, 'Reading your ElevenLabs voices') };
        }
    }
    function activeChatId() {
        try {
            const a = ctx.getActiveChat && ctx.getActiveChat();
            if (a && a.chatId)
                return String(a.chatId);
        }
        catch (_) { }
        try {
            const m = String(location.pathname || '').match(/\/chat\/([^/?#]+)/);
            if (m)
                return decodeURIComponent(m[1]);
        }
        catch (_) { }
        return '';
    }
    async function readMessage(chatId, messageId) {
        if (!chatId)
            return { why: 'No chat is open.' };
        try {
            const res = await api('/chats/' + encodeURIComponent(chatId) + '/messages?tail=true&limit=200');
            if (!res.ok)
                return { why: await hostTrouble(res, 'Reading the message') };
            const j = await res.json();
            const list = Array.isArray(j && j.data) ? j.data : [];
            const msg = list.find((m) => m && String(m.id) === messageId);
            if (!msg)
                return { why: 'That message is not in the last 200 messages of this chat, so Auto Foley cannot read it.' };
            return { msg };
        }
        catch (e) {
            return { why: netTrouble(e, 'Reading the message') };
        }
    }
    let show = null;
    let audio = null;
    let paused = false;
    let phase = '';
    let warnedHidden = false;
    let tick = null;
    function memberFor(name) {
        const n = String(name || '').trim().toLowerCase();
        const cast = S.cast || [];
        return (cast.find((c) => c.name.toLowerCase() === n) ||
            cast.find((c) => (c.aliases || []).some((a) => a.toLowerCase() === n)) ||
            null);
    }
    function narratorMember() {
        return (S.cast || []).find((c) => c.kind === 'narrator') || null;
    }
    // Someone the AI added has no voice yet. They get one from the
    // connection's voices that matches their gender and nobody in the cast
    // uses, so two new people never sound the same.
    async function voiceForNew(m, conn) {
        if (m.voice || !conn)
            return;
        const got = await loadVoices(conn.id);
        if (!got.voices.length)
            return;
        const used = new Set((S.cast || []).map((c) => c.voice).filter(Boolean));
        if (conn.voice)
            used.add(conn.voice);
        const free = got.voices.filter((v) => !used.has(v.id));
        const fits = free.filter((v) => m.gender !== 'unknown' && String(v.gender || '').toLowerCase() === m.gender);
        const pickFrom = fits.length ? fits : free.length ? free : got.voices;
        const v = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        if (!v)
            return;
        m.voice = v.id;
        m.voiceName = v.name || v.id;
        save();
        log(m.name + ' now has the voice ' + m.voiceName + '. You can change it in the Cast tab.');
    }
    function buildItems(script) {
        const items = [];
        for (const line of script.lines) {
            if (line.before && S.soundsOn)
                items.push({ kind: 'sound', line, sound: line.before, at: line.i });
            const isNarr = line.kind === 'narration';
            const who = isNarr ? narratorMember() : memberFor(line.speaker);
            const mutedPerson = who && who.muted;
            if (!(isNarr && S.narration !== 'read') && !mutedPerson)
                items.push({ kind: 'voice', line, at: line.i });
            if (line.after && S.soundsOn)
                items.push({ kind: 'sound', line, sound: line.after, at: line.i });
        }
        return items;
    }
    async function makeVoiceClip(line, signal) {
        const conn = activeConnection();
        if (!conn)
            return { why: ttsWhy || 'Pick your ElevenLabs connection in the Settings tab.' };
        const isNarr = line.kind === 'narration';
        let m = isNarr ? narratorMember() : memberFor(line.speaker);
        if (m && m.kind === 'npc' && !m.voice)
            await voiceForNew(m, conn);
        const model = (m && m.model) || conn.model || '';
        const text = takesTags(model) ? line.text : stripTags(line.text);
        const params = { use_speaker_boost: true };
        if (m) {
            params.stability = stabilityFor(model, m.stability, line.big);
            params.similarity_boost = m.similarity;
            params.style = m.style;
            params.speed = m.speed;
        }
        const body = { connectionId: conn.id, text, parameters: params };
        if (m && m.voice)
            body.voice = m.voice;
        if (m && m.model)
            body.model = m.model;
        try {
            const res = await fetchImpl(API + '/tts/synthesize', {
                method: 'POST',
                credentials: 'include',
                signal,
                headers: { 'Content-Type': 'application/json', Accept: 'audio/*' },
                body: JSON.stringify(body),
            });
            if (!res.ok)
                return { why: await hostTrouble(res, 'Speaking line ' + (line.i + 1)) };
            const blob = await res.blob();
            if (!blob.size)
                return { why: 'ElevenLabs sent back no sound for line ' + (line.i + 1) + '.' };
            return { blob };
        }
        catch (e) {
            return { why: netTrouble(e, 'Speaking line ' + (line.i + 1)) };
        }
    }
    async function makeSoundClip(description) {
        try {
            const r = await rpc({ type: 'sound', description }, 45000);
            if (r && r.base64) {
                if (r.made)
                    log('Made a new sound: ' + description + '. It is saved in the Sounds tab.');
                return { blob: base64ToBlob(r.base64, r.mime) };
            }
            return { why: (r && r.error) || 'No sound came back for "' + description + '".' };
        }
        catch (e) {
            return { why: String((e && e.message) || 'The sound could not be fetched.') };
        }
    }
    function clipFor(sh, k) {
        let p = sh.clips.get(k);
        if (!p) {
            const it = sh.items[k];
            p = it.kind === 'voice' ? makeVoiceClip(it.line, sh.abort.signal) : makeSoundClip(it.sound || '');
            sh.clips.set(k, p);
        }
        return p;
    }
    // How many clips are fetched ahead of the one playing. Two hides the wait
    // between lines without spending credits on lines the reader may skip.
    const AHEAD = 2;
    // The clip playing now, and how to settle the wait on it. Stopping or
    // skipping settles it at once, so the loop that waits on it never hangs.
    let settle = null;
    function stopAudio() {
        const s = settle;
        settle = null;
        if (audio) {
            try {
                audio.pause();
            }
            catch (_) { }
            try {
                if (audio.src)
                    URL.revokeObjectURL(audio.src);
            }
            catch (_) { }
            audio = null;
        }
        if (s)
            s('cut');
    }
    function stop(why) {
        const had = show;
        show = null;
        if (had) {
            try {
                had.abort.abort();
            }
            catch (_) { }
        }
        stopAudio();
        paused = false;
        phase = why || '';
        if (tick) {
            clearInterval(tick);
            tick = null;
        }
        paintButtons();
        if (tab === 'stage')
            renderTab();
        return had;
    }
    // Plays the show from item k to the end. The index can be moved while a
    // clip plays, by Skip, and the loop carries on from wherever it points.
    async function playFrom(sh, k) {
        sh.index = k;
        while (show === sh && sh.index < sh.items.length) {
            const at = sh.index;
            for (let a = at; a < Math.min(sh.items.length, at + 1 + AHEAD); a++)
                clipFor(sh, a);
            phase = paused ? 'Paused' : sh.items[at].kind === 'voice' ? 'Speaking' : 'Playing a sound';
            paintStage();
            const got = await clipFor(sh, at);
            if (show !== sh)
                return;
            if (sh.index !== at)
                continue;
            if (!got.blob) {
                log(got.why || 'A line could not be played.', 'bad');
                if (!drawerOpen() && !warnedHidden) {
                    warnedHidden = true;
                    notify('warning', 'Auto Foley could not play part of a message: ' + String(got.why || '').slice(0, 300));
                }
                sh.index++;
                continue;
            }
            const how = await playBlob(got.blob, sh.items[at].kind);
            if (show !== sh)
                return;
            if (how === 'ended')
                sh.played.push({ blob: got.blob });
            if (sh.index === at)
                sh.index++;
        }
        if (show === sh) {
            sh.complete = sh.played.length === sh.items.length;
            stop('Finished');
            if (S.saveAudio && sh.complete)
                saveToMessage(sh);
        }
    }
    function playBlob(blob, kind) {
        return new Promise((resolve) => {
            stopAudio();
            if (!AudioCtor) {
                log('This browser cannot play sound.', 'bad');
                return resolve('ended');
            }
            const el = new AudioCtor();
            audio = el;
            settle = resolve;
            el.src = URL.createObjectURL(blob);
            el.volume = kind === 'voice' ? (muted.voice ? 0 : S.voiceVolume) : muted.sound ? 0 : S.soundVolume;
            if (el.dataset)
                el.dataset.kind = kind;
            const finish = () => {
                if (audio !== el)
                    return;
                settle = null;
                try {
                    URL.revokeObjectURL(el.src);
                }
                catch (_) { }
                audio = null;
                resolve('ended');
            };
            el.onended = finish;
            el.onerror = () => {
                log('A clip could not be played by the browser.', 'bad');
                finish();
            };
            // While paused, the clip waits. Play starts it from togglePause.
            if (!paused)
                startClip(el);
        });
    }
    function startClip(el) {
        let p;
        try {
            p = el.play();
        }
        catch (_) {
            return;
        }
        if (!p || typeof p.catch !== 'function')
            return;
        p.catch((e) => {
            if (audio !== el || !e || e.name !== 'NotAllowedError')
                return;
            // The browser blocks sound until the page has been tapped. Playback
            // waits as if paused, and Play starts it.
            paused = true;
            phase = 'Press Play to start. Your browser blocks sound until you tap the page.';
            log(phase);
            if (!drawerOpen())
                notify('info', 'Auto Foley is ready. Tap the Auto Foley button on the message, or Play in the drawer, to start the sound.');
            paintStage();
            paintButtons();
        });
    }
    function togglePause() {
        if (!show) {
            if (lastScript)
                startShow(lastScript, lastMeta, 0);
            return;
        }
        paused = !paused;
        if (paused) {
            phase = 'Paused';
            if (audio) {
                try {
                    audio.pause();
                }
                catch (_) { }
            }
        }
        else {
            phase = show.items[show.index] && show.items[show.index].kind === 'sound' ? 'Playing a sound' : 'Speaking';
            if (audio)
                startClip(audio);
        }
        paintStage();
        paintButtons();
    }
    function skip() {
        if (!show)
            return;
        show.index++;
        paused = false;
        // Settles the clip playing now. The loop sees the index moved and plays
        // the next part, or finishes if there is none.
        stopAudio();
    }
    let lastScript = null;
    let lastMeta = { chatId: '', messageId: '', swipeId: 0 };
    function startShow(script, meta, fromLine) {
        stop();
        lastScript = script;
        lastMeta = meta;
        const items = buildItems(script);
        if (!items.length) {
            phase = script.lines.length ? 'Nothing to play with these settings. Narration may be skipped, or the speakers muted.' : 'This message has nothing to read aloud.';
            log(phase);
            if (tab === 'stage')
                renderTab();
            return;
        }
        let k = items.findIndex((it) => it.at >= fromLine);
        if (k < 0)
            k = 0;
        const sh = {
            script,
            messageId: meta.messageId,
            chatId: meta.chatId,
            swipeId: meta.swipeId,
            items,
            index: k,
            clips: new Map(),
            played: [],
            complete: false,
            abort: new AbortController(),
            startedAt: Date.now(),
        };
        show = sh;
        paused = false;
        warnedHidden = false;
        tick = setInterval(paintStage, 1000);
        if (tab === 'stage')
            renderTab();
        paintButtons();
        playFrom(sh, k);
    }
    async function saveToMessage(sh) {
        try {
            const form = new FormData();
            form.append('chatId', sh.chatId);
            form.append('messageId', sh.messageId);
            form.append('swipeId', String(sh.swipeId));
            sh.played.forEach((p, k) => form.append('segment', p.blob, 'part-' + String(k).padStart(4, '0') + '.mp3'));
            const res = await fetchImpl(API + '/tts/save-message-audio', { method: 'POST', credentials: 'include', body: form });
            if (!res.ok) {
                const why = await hostTrouble(res, 'Saving the performance to the message');
                log(why, 'bad');
                notify('warning', why);
                return;
            }
            log('The performance is saved to the message. Lumiverse plays it from there now.');
        }
        catch (e) {
            const why = netTrouble(e, 'Saving the performance to the message');
            log(why, 'bad');
            notify('warning', why);
        }
    }
    // ---------------------------------------------------------------------------
    // Performing a message
    // ---------------------------------------------------------------------------
    const preparing = new Map();
    let busyMessage = '';
    // The text each message had when it was directed, so an edit made after,
    // by the reader or by another extension, can be noticed.
    const directedText = new Map();
    async function getScript(chatId, messageId, fresh) {
        const got = await readMessage(chatId, messageId);
        if (!got.msg)
            return { why: got.why };
        const m = got.msg;
        const swipeId = Number.isInteger(m.swipe_id) ? m.swipe_id : 0;
        directedText.set(messageId, String(m.content || ''));
        while (directedText.size > 60)
            directedText.delete(directedText.keys().next().value);
        const key = messageId + ':' + swipeId + (fresh ? ':fresh' : '');
        let p = preparing.get(key);
        if (!p) {
            p = rpc({ type: 'direct', chatId, messageId, swipeId, text: String(m.content || ''), name: String(m.name || ''), isUser: !!m.is_user, fresh }, 150000);
            preparing.set(key, p);
            p.then(() => preparing.delete(key), () => preparing.delete(key));
        }
        try {
            const r = await p;
            if (!r || r.type !== 'script' || !r.script)
                return { why: (r && r.error) || 'The backend sent back no script.' };
            return { script: r.script, meta: { chatId, messageId, swipeId } };
        }
        catch (e) {
            return { why: String((e && e.message) || 'The message could not be directed.') };
        }
    }
    async function perform(messageId, fresh) {
        if (show && show.messageId === messageId && !fresh) {
            stop('Stopped');
            return;
        }
        const chatId = activeChatId();
        stop();
        busyMessage = messageId;
        phase = S.directorOn ? 'The Director is reading the message' : 'Reading the message';
        const started = Date.now();
        paintButtons();
        if (tab === 'stage')
            renderTab();
        const waitTick = setInterval(() => {
            if (busyMessage !== messageId)
                return;
            phase = (S.directorOn ? 'The Director is reading the message' : 'Reading the message') + ' (' + Math.round((Date.now() - started) / 1000) + ' s)';
            paintStage();
        }, 1000);
        if (!activeConnection())
            await loadTtsConnections();
        const got = await getScript(chatId, messageId, !!fresh);
        clearInterval(waitTick);
        if (busyMessage !== messageId)
            return;
        busyMessage = '';
        if (!got.script) {
            phase = got.why || 'The message could not be read.';
            log(phase, 'bad');
            if (!drawerOpen())
                notify('warning', 'Auto Foley could not perform the message: ' + phase);
            paintButtons();
            if (tab === 'stage')
                renderTab();
            return;
        }
        for (const line of got.script.log || [])
            log(line);
        startShow(got.script, got.meta, 0);
    }
    async function prepare(messageId) {
        const chatId = activeChatId();
        const got = await getScript(chatId, messageId, false);
        if (got.script) {
            for (const line of got.script.log || [])
                log(line);
            log('A new reply is directed and ready to play.');
            lastScript = got.script;
            lastMeta = got.meta;
            if (tab === 'stage' && !show)
                renderTab();
        }
        else if (got.why)
            log('Preparing a reply failed: ' + got.why, 'bad');
    }
    // ---------------------------------------------------------------------------
    // The button on every message
    // ---------------------------------------------------------------------------
    const msgButtons = new Map();
    function paintButtons() {
        msgButtons.forEach((set, id) => {
            set.forEach((b) => {
                const playing = !!show && show.messageId === id;
                const busy = busyMessage === id;
                b.hidden = !S.enabled;
                b.dataset.afBusy = playing || busy ? 'true' : 'false';
                b.title = busy ? 'Auto Foley is directing this message' : playing ? 'Stop Auto Foley' : 'Perform with Auto Foley';
                b.setAttribute('aria-label', b.title);
                b.innerHTML = playing && !paused ? ICON_STOP : ICON;
                sizeIcon(b);
            });
        });
    }
    // The icon takes the size and stroke of the host's own icon beside it.
    function sizeIcon(b) {
        const svg = b.querySelector('svg');
        if (!svg)
            return;
        // A host icon sized by CSS has no width attribute. Without a size of its
        // own, an svg draws at 300 by 150, so 16 is the fallback.
        const w = b.dataset.afIconW || '16';
        svg.setAttribute('width', w);
        svg.setAttribute('height', b.dataset.afIconH || w);
        if (b.dataset.afStroke && svg.getAttribute('stroke'))
            svg.setAttribute('stroke-width', b.dataset.afStroke);
    }
    // Reads the host's neighboring button, so this one wears the same class,
    // and with it the user's theme and their own CSS.
    function copyLook(b, root) {
        const mount = root.closest('[data-spindle-mount]') || root.parentElement;
        const row = mount && mount.parentElement;
        if (!row)
            return false;
        const twin = Array.prototype.find.call(row.querySelectorAll('button'), (x) => !x.closest('[data-spindle-mount]') && !x.closest(OTHER_UI) && !x.classList.contains('af-msg-btn'));
        if (!twin)
            return false;
        b.className = twin.className + ' af-msg-btn';
        const svg = twin.querySelector('svg');
        if (svg) {
            let w = svg.getAttribute('width');
            let h = svg.getAttribute('height');
            if (!w || /%/.test(w)) {
                // Sized by the host's CSS: read the size it is drawn at.
                const cs = getComputedStyle(svg);
                const pw = parseFloat(cs.width);
                const ph = parseFloat(cs.height);
                if (pw > 4 && pw < 64)
                    w = String(Math.round(pw));
                if (ph > 4 && ph < 64)
                    h = String(Math.round(ph));
            }
            if (w && !/%/.test(w))
                b.dataset.afIconW = w;
            if (h && !/%/.test(h))
                b.dataset.afIconH = h;
            const st = svg.getAttribute('stroke-width');
            if (st)
                b.dataset.afStroke = st;
        }
        return true;
    }
    try {
        if (ctx.ui && typeof ctx.ui.registerDomDecorator === 'function') {
            const off = ctx.ui.registerDomDecorator({
                mount: 'message_actions',
                render(root, info) {
                    const scope = String((info && info.scope) || '');
                    const messageId = scope.split(':')[1] || '';
                    if (!messageId)
                        return;
                    const b = document.createElement('button');
                    b.type = 'button';
                    if (!copyLook(b, root))
                        b.className = 'af-own af-msg-btn';
                    b.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (show && show.messageId === messageId && paused)
                            togglePause();
                        else
                            perform(messageId);
                    });
                    root.appendChild(b);
                    let set = msgButtons.get(messageId);
                    if (!set)
                        msgButtons.set(messageId, (set = new Set()));
                    set.add(b);
                    paintButtons();
                    return () => {
                        set.delete(b);
                        if (!set.size)
                            msgButtons.delete(messageId);
                        b.remove();
                    };
                },
            });
            if (typeof off === 'function')
                disposers.push(off);
            else if (off && typeof off.destroy === 'function')
                disposers.push(() => off.destroy());
        }
    }
    catch (e) {
        log('The Auto Foley button could not be added to messages. Use Play on the Stage tab instead.', 'bad');
    }
    // ---------------------------------------------------------------------------
    // New replies
    // ---------------------------------------------------------------------------
    try {
        disposers.push(ctx.events.on('GENERATION_ENDED', (p) => {
            if (!alive || !S.enabled || !p || p.error)
                return;
            const messageId = String(p.messageId || '');
            if (!messageId)
                return;
            if (p.generationType === 'impersonate')
                return;
            if (p.chatId && activeChatId() && String(p.chatId) !== activeChatId())
                return;
            if (S.autoplay) {
                const wait = Math.max(0, Math.min(30, Number(S.autoplayDelay) || 0)) * 1000;
                if (!wait)
                    perform(messageId);
                else {
                    phase = 'Waiting ' + S.autoplayDelay + ' s before playing the new reply';
                    paintStage();
                    const t = setTimeout(() => {
                        timers.delete(t);
                        if (alive && !show && !busyMessage)
                            perform(messageId);
                    }, wait);
                    timers.add(t);
                }
            }
            else if (S.prepareAhead)
                prepare(messageId);
        }));
    }
    catch (_) { }
    // A message edited after it was directed, such as a reply another
    // extension rewrote, is directed again. One playing starts again with the
    // new text, since what is heard should match what is on screen.
    try {
        disposers.push(ctx.events.on('MESSAGE_EDITED', (p) => {
            if (!alive || !S.enabled)
                return;
            const m = p && p.message;
            const id = m && m.id ? String(m.id) : '';
            if (!id || !directedText.has(id))
                return;
            if (String(m.content || '') === directedText.get(id))
                return;
            directedText.delete(id);
            if (show && show.messageId === id) {
                log('This message was edited while it played, so it is performed again with the new text.');
                stop();
                perform(id);
            }
            else if (busyMessage === id) {
                return;
            }
            else if (lastMeta.messageId === id && S.prepareAhead) {
                log('This message was edited, so it is directed again.');
                lastScript = null;
                prepare(id);
            }
        }));
    }
    catch (_) { }
    try {
        disposers.push(ctx.events.on('MESSAGE_SENT', (p) => {
            if (!alive || !S.enabled || !S.readOwnMessages || !S.autoplay)
                return;
            const m = p && p.message;
            if (!m || !m.is_user || !m.id)
                return;
            perform(String(m.id));
        }));
    }
    catch (_) { }
    const onChat = () => {
        if (show && show.chatId && show.chatId !== activeChatId())
            stop('Stopped, because the chat changed');
        lastScript = null;
        if (tab === 'stage')
            renderTab();
    };
    try {
        disposers.push(ctx.events.on('CHAT_CHANGED', onChat));
    }
    catch (_) { }
    try {
        disposers.push(ctx.events.on('CHAT_SWITCHED', onChat));
    }
    catch (_) { }
    // ---------------------------------------------------------------------------
    // The drawer
    // ---------------------------------------------------------------------------
    try {
        disposers.push(ctx.dom.addStyle(CSS));
    }
    catch (_) { }
    const root = document.createElement('div');
    root.className = 'af';
    root.setAttribute('data-af-root', '');
    let drawer = null;
    try {
        drawer = ctx.ui.registerDrawerTab({
            id: 'auto-foley',
            title: 'Auto Foley',
            shortName: 'Foley',
            headerTitle: 'Auto Foley',
            description: 'Voice acting and sound effects for ElevenLabs',
            keywords: ['tts', 'voice', 'elevenlabs', 'sound effects', 'audio', 'foley', 'speech'],
            iconSvg: ICON,
        });
        drawer.root.appendChild(root);
        disposers.push(() => {
            try {
                drawer.destroy();
            }
            catch (_) { }
        });
        if (typeof drawer.onActivate === 'function') {
            disposers.push(drawer.onActivate(() => {
                if (root.parentElement !== drawer.root)
                    drawer.root.appendChild(root);
                renderTab();
            }));
        }
    }
    catch (e) {
        log('The Auto Foley drawer tab could not be added. Lumiverse allows a limited number of drawer tabs; another extension may have taken the last one.', 'bad');
    }
    function drawerOpen() {
        if (!root.isConnected)
            return false;
        const r = root.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    const calm = () => !!S.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    root.innerHTML =
        '<div class="af-head"><div class="af-brand"><div class="af-brand-icon">' + ICON + '</div><div style="min-width:0">' +
            '<div class="af-brand-name">Auto Foley</div><div class="af-brand-sub">Voice acting and sound effects for ElevenLabs</div></div></div>' +
            '<span class="af-pill" data-af="pill"></span></div>' +
            '<div class="af-tabs" role="tablist">' +
            TABS.map((t) => '<button type="button" class="af-tab" role="tab" data-tab="' + t.id + '">' + t.label + '</button>').join('') +
            '</div><div class="af-page" data-af="page" role="tabpanel"></div>';
    const page = root.querySelector('[data-af="page"]');
    const pill = root.querySelector('[data-af="pill"]');
    root.querySelectorAll('.af-tab').forEach((b) => {
        b.addEventListener('click', () => {
            const id = b.dataset.tab;
            if (id === tab)
                return;
            tab = id;
            try {
                localStorage.setItem('lv-auto-foley:tab', id);
            }
            catch (_) { }
            renderTab(true);
        });
    });
    function paintHead() {
        root.dataset.calm = calm() ? 'true' : 'false';
        pill.dataset.on = S.enabled ? 'true' : 'false';
        pill.textContent = S.enabled ? 'On' : 'Off';
        root.querySelectorAll('.af-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
    }
    // ---- small builders ----
    function el(html) {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    }
    function card(title, extraHead) {
        return el('<section class="af-card"><div class="af-card-title"><h3>' + esc(title) + '</h3>' + (extraHead || '') + '</div></section>');
    }
    function hint(text) {
        return el('<p class="af-hint">' + text + '</p>');
    }
    // A switch row. When "under" is given, those rows sit straight under the
    // switch and open and close with it.
    function toggle(label, sub, key, onChange, under) {
        const wrap = document.createElement('div');
        const id = rid('sw');
        const row = el('<label class="af-switch" for="' + id + '"><span class="af-switch-text"><b>' + esc(label) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') +
            '</span><input type="checkbox" id="' + id + '" role="switch"' + (S[key] ? ' checked' : '') + '><span class="af-knob" aria-hidden="true"></span></label>');
        wrap.appendChild(row);
        let box = null;
        if (under) {
            box = el('<div class="af-sub"><div class="af-sub-inner"></div></div>');
            const inner = box.firstElementChild;
            for (const r of under())
                inner.appendChild(r);
            if (!S[key]) {
                box.hidden = true;
            }
            wrap.appendChild(box);
        }
        const input = row.querySelector('input');
        input.addEventListener('change', () => {
            set({ [key]: input.checked });
            if (box)
                reveal(box, input.checked);
            if (onChange)
                onChange(input.checked);
            if (key === 'enabled' || key === 'reduceMotion')
                paintHead();
        });
        return wrap;
    }
    // Opens or closes a part over several frames: its height moves, so the rows
    // under it move with it, and it fades and slides 4 pixels. With reduce
    // motion on, it appears and goes at once.
    function reveal(box, show) {
        const anyBox = box;
        if (anyBox._afAnim) {
            try {
                anyBox._afAnim.cancel();
            }
            catch (_) { }
            anyBox._afAnim = null;
        }
        if (calm() || typeof box.animate !== 'function') {
            box.hidden = !show;
            box.style.height = '';
            return;
        }
        const inner = box.firstElementChild;
        if (show) {
            box.hidden = false;
            const h = box.scrollHeight;
            anyBox._afAnim = box.animate([
                { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
                { height: h + 'px', opacity: 1, transform: 'none' },
            ], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
        else {
            const h = box.scrollHeight;
            anyBox._afAnim = box.animate([
                { height: h + 'px', opacity: 1, transform: 'none' },
                { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
            ], { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' });
            anyBox._afAnim.onfinish = () => {
                box.hidden = true;
                anyBox._afAnim = null;
            };
        }
        void inner;
    }
    function select(label, options, value, onChange, sub) {
        const id = rid('sel');
        const f = el('<div class="af-field"><label class="af-label" for="' + id + '">' + esc(label) + '</label><select id="' + id + '">' +
            options.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === value ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
            '</select>' + (sub ? '<p class="af-hint">' + sub + '</p>' : '') + '</div>');
        const s = f.querySelector('select');
        s.addEventListener('change', () => onChange(s.value));
        return f;
    }
    function segmented(label, options, value, onChange, sub) {
        const f = el('<div class="af-field"><span class="af-label">' + esc(label) + '</span><div class="af-seg" role="group" aria-label="' + esc(label) + '">' +
            options.map((o) => '<button type="button" data-v="' + esc(o.id) + '" aria-pressed="' + (o.id === value ? 'true' : 'false') + '">' + esc(o.label) + '</button>').join('') +
            '</div>' + (sub ? '<p class="af-hint">' + sub + '</p>' : '') + '</div>');
        f.querySelectorAll('.af-seg button').forEach((b) => {
            b.addEventListener('click', () => {
                f.querySelectorAll('.af-seg button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
                onChange(b.dataset.v || '');
            });
        });
        return f;
    }
    function slider(label, value, min, max, step, show, onChange, sub) {
        const id = rid('rg');
        const f = el('<div class="af-field"><div class="af-slider-head"><label class="af-label" for="' + id + '">' + esc(label) + '</label><output></output></div>' +
            '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
            (sub ? '<p class="af-hint">' + sub + '</p>' : '') + '</div>');
        const r = f.querySelector('input');
        const out = f.querySelector('output');
        const paint = () => {
            const v = Number(r.value);
            out.textContent = show(v);
            r.style.setProperty('--af-fill-to', ((v - min) / (max - min)) * 100 + '%');
        };
        paint();
        r.addEventListener('input', () => {
            paint();
            onChange(Number(r.value));
        });
        return f;
    }
    function text(label, value, onChange, placeholder, sub) {
        const id = rid('tx');
        const f = el('<div class="af-field"><label class="af-label" for="' + id + '">' + esc(label) + '</label><input type="text" id="' + id + '" value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">' +
            (sub ? '<p class="af-hint">' + sub + '</p>' : '') + '</div>');
        const i = f.querySelector('input');
        i.addEventListener('input', () => onChange(i.value));
        return f;
    }
    function button(label, onClick, cls, icon) {
        const b = el('<button type="button" class="af-btn ' + (cls || '') + '">' + (icon || '') + '<span>' + esc(label) + '</span></button>');
        b.addEventListener('click', onClick);
        return b;
    }
    // ---- rendering ----
    function renderTab(animate) {
        if (!alive)
            return;
        paintHead();
        page.innerHTML = '';
        page.classList.remove('af-enter');
        try {
            if (tab === 'stage')
                renderStage();
            else if (tab === 'cast')
                renderCast();
            else if (tab === 'director')
                renderDirector();
            else if (tab === 'sounds')
                renderSounds();
            else
                renderSettings();
        }
        catch (e) {
            page.appendChild(el('<p class="af-status" data-kind="bad">This tab could not be drawn: ' + esc((e && e.message) || e) + '</p>'));
        }
        if (animate && !calm()) {
            void page.offsetWidth;
            page.classList.add('af-enter');
        }
    }
    // ---------- Stage ----------
    function renderStage() {
        const now = card('Now playing');
        now.insertAdjacentHTML('beforeend', '<div class="af-now"><div class="af-transport">' +
            '<button type="button" class="af-play" data-af="play" aria-label="Play">' + ICON_PLAY + '</button>' +
            '<button type="button" class="af-round" data-af="stop" aria-label="Stop" title="Stop">' + ICON_STOP + '</button>' +
            '<button type="button" class="af-round" data-af="skip" aria-label="Skip to the next line" title="Skip to the next line">' + ICON_SKIP + '</button>' +
            '<button type="button" class="af-round" data-af="redo" aria-label="Direct again" title="Direct again">' + ICON_REDO + '</button>' +
            '<div class="af-now-text"><div class="af-now-title" data-af="title"></div><div class="af-now-sub" data-af="sub"></div></div></div>' +
            '<div class="af-progress"><div data-af="bar"></div></div></div>');
        page.appendChild(now);
        const q = (k) => now.querySelector('[data-af="' + k + '"]');
        q('play').addEventListener('click', () => togglePause());
        q('stop').addEventListener('click', () => stop('Stopped'));
        q('skip').addEventListener('click', () => skip());
        q('redo').addEventListener('click', () => {
            const id = (show && show.messageId) || lastMeta.messageId;
            if (id)
                perform(id, true);
        });
        const mix = card('Mixer');
        mix.insertAdjacentHTML('beforeend', '<div class="af-mixer"></div>');
        const mixer = mix.querySelector('.af-mixer');
        mixer.appendChild(strip('Voices', 'voice', 'voiceVolume'));
        mixer.appendChild(strip('Sounds', 'sound', 'soundVolume'));
        page.appendChild(mix);
        const sc = card('Script');
        const list = el('<div class="af-script"></div>');
        sc.appendChild(list);
        page.appendChild(sc);
        const lg = card('Log', '<button type="button" class="af-btn" data-af="copy">Copy</button>');
        const logBox = el('<div class="af-log" aria-live="polite"></div>');
        lg.appendChild(logBox);
        page.appendChild(lg);
        lg.querySelector('[data-af="copy"]').addEventListener('click', async () => {
            const t = logLines.map((l) => l.at + '  ' + l.text).join('\n') || 'The log is empty.';
            try {
                await navigator.clipboard.writeText('Auto Foley ' + VERSION + '\n' + t);
            }
            catch (_) {
                notify('warning', 'The log could not be copied. Your browser did not allow it.');
            }
        });
        stageRefs = { now, q, list, logBox };
        paintScript();
        paintStage();
        paintLog();
    }
    function strip(name, kind, key) {
        const s = el('<div class="af-strip"><div class="af-strip-head"><span class="af-strip-name"><span class="af-dot' + (kind === 'sound' ? ' af-dot-sound' : '') + '"></span>' + esc(name) +
            '</span><button type="button" class="af-mute" aria-pressed="' + (muted[kind] ? 'true' : 'false') + '">Mute</button></div></div>');
        s.appendChild(slider('Volume', Math.round(S[key] * 100), 0, 100, 1, (v) => v + '%', (v) => {
            set({ [key]: v / 100 });
            if (audio && audio.dataset && audio.dataset.kind === kind && !muted[kind])
                audio.volume = v / 100;
        }));
        const m = s.querySelector('.af-mute');
        m.addEventListener('click', () => {
            muted[kind] = !muted[kind];
            m.setAttribute('aria-pressed', muted[kind] ? 'true' : 'false');
            if (audio && audio.dataset && audio.dataset.kind === kind)
                audio.volume = muted[kind] ? 0 : S[key];
        });
        return s;
    }
    function currentScript() {
        return (show && show.script) || lastScript;
    }
    function paintScript() {
        if (!stageRefs)
            return;
        const list = stageRefs.list;
        const script = currentScript();
        list.innerHTML = '';
        if (!script) {
            list.appendChild(el('<div class="af-empty">Press the Auto Foley button on a message to perform it. With Autoplay on in Settings, new replies play by themselves.</div>'));
            return;
        }
        if (!script.lines.length) {
            list.appendChild(el('<div class="af-empty">This message has nothing to read aloud.</div>'));
            return;
        }
        for (const line of script.lines) {
            const who = line.kind === 'narration' ? 'Narrator' : line.speaker;
            const soundBtn = (s) => s ? '<button type="button" class="af-chip af-chip-sound" data-sound="' + esc(s) + '" title="Play this sound">' + ICON_SOUND + '<span>' + esc(s) + '</span></button>' : '';
            const row = el('<div class="af-line" data-i="' + line.i + '"><button type="button" class="af-line-go" title="Play from this line" aria-label="Play from line ' + (line.i + 1) + '">' + (line.i + 1) + '</button>' +
                '<div class="af-line-body"><div class="af-line-who" data-kind="' + esc(line.kind) + '">' + esc(who) + (line.big ? ' <span class="af-chip af-chip-tag">big moment</span>' : '') + '</div>' +
                (line.before ? '<div>' + soundBtn(line.before) + '</div>' : '') +
                '<div class="af-line-text">' + lineHtml(line.text) + '</div>' +
                (line.after ? '<div>' + soundBtn(line.after) + '</div>' : '') +
                (line.note ? '<div class="af-line-note">' + esc(line.note) + '</div>' : '') +
                '</div></div>');
            row.querySelector('.af-line-go').addEventListener('click', () => {
                if (script && lastMeta.messageId)
                    startShow(script, lastMeta, line.i);
            });
            row.querySelectorAll('[data-sound]').forEach((b) => {
                b.addEventListener('click', async () => {
                    const d = b.dataset.sound || '';
                    const got = await makeSoundClip(d);
                    if (got.blob)
                        previewBlob(got.blob, S.soundVolume);
                    else
                        log(got.why || 'The sound could not be played.', 'bad');
                });
            });
            list.appendChild(row);
        }
    }
    let preview = null;
    function previewBlob(blob, volume) {
        if (!AudioCtor)
            return;
        try {
            if (preview) {
                preview.pause();
                URL.revokeObjectURL(preview.src);
            }
        }
        catch (_) { }
        preview = new AudioCtor();
        preview.src = URL.createObjectURL(blob);
        preview.volume = volume;
        const p = preview.play();
        if (p && typeof p.catch === 'function')
            p.catch(() => log('The browser did not allow the sound to play. Tap the page and try again.', 'bad'));
    }
    function paintStage() {
        if (!stageRefs || tab !== 'stage')
            return;
        const q = stageRefs.q;
        const playBtn = q('play');
        const script = currentScript();
        const playing = !!show && !paused;
        playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        playBtn.title = playing ? 'Pause' : 'Play';
        playBtn.disabled = !show && !script;
        q('stop').disabled = !show;
        q('skip').disabled = !show;
        q('redo').disabled = !(show || lastMeta.messageId) || !!busyMessage;
        const title = q('title');
        const sub = q('sub');
        const bar = q('bar');
        if (busyMessage) {
            title.textContent = 'Getting ready';
            sub.textContent = phase;
            bar.style.width = '0%';
        }
        else if (show) {
            const it = show.items[Math.min(show.index, show.items.length - 1)];
            const secs = Math.round((Date.now() - show.startedAt) / 1000);
            title.textContent = show.script.author ? show.script.author + '’s message' : 'This message';
            sub.textContent = (phase || 'Playing') + ' · part ' + Math.min(show.index + 1, show.items.length) + ' of ' + show.items.length + ' · ' + secs + ' s';
            bar.style.width = Math.round((show.index / show.items.length) * 100) + '%';
            paintNow(it ? it.at : -1, show.index);
        }
        else {
            title.textContent = script ? (script.author ? script.author + '’s message' : 'This message') : 'Nothing playing';
            sub.textContent = phase || (script ? 'Ready. Press Play.' : 'Press the Auto Foley button on a message.');
            bar.style.width = phase === 'Finished' ? '100%' : '0%';
            paintNow(-1, -1);
        }
    }
    function paintNow(lineIndex, itemIndex) {
        if (!stageRefs)
            return;
        stageRefs.list.querySelectorAll('.af-line').forEach((row) => {
            const i = Number(row.dataset.i);
            const isNow = i === lineIndex;
            if ((row.dataset.now === 'true') !== isNow)
                row.dataset.now = isNow ? 'true' : 'false';
            const done = !!show && itemIndex >= 0 && i < lineIndex;
            if ((row.dataset.done === 'true') !== done)
                row.dataset.done = done ? 'true' : 'false';
        });
    }
    function paintLog() {
        if (!stageRefs)
            return;
        const box = stageRefs.logBox;
        box.innerHTML = logLines.length
            ? logLines
                .slice(-60)
                .map((l) => '<div class="af-log-line" data-kind="' + esc(l.kind) + '"><b>' + esc(l.at) + '</b>' + esc(l.text) + '</div>')
                .join('')
            : '<div class="af-log-line">Nothing has happened yet.</div>';
        box.scrollTop = 1e6;
    }
    // ---------- Cast ----------
    const openPeople = new Set();
    function renderCast() {
        stageRefs = null;
        const top = card('Cast', '');
        top.appendChild(hint('Everyone who speaks gets their own voice: your personas, the characters and the NPCs. People are added when they first speak, by the Director when it finds someone new, or by you.'));
        const row = el('<div class="af-row"></div>');
        row.appendChild(button('Add someone', () => {
            const m = {
                id: rid('c'), name: 'New person', kind: 'npc', addedBy: 'you', aliases: [], voice: '', voiceName: '', model: '',
                stability: 0.5, similarity: 0.75, style: 0, speed: 1, note: '', gender: 'unknown', muted: false,
            };
            S.cast.push(m);
            openPeople.add(m.id);
            save();
            renderTab();
        }, 'af-btn-main'));
        top.appendChild(row);
        const conn = activeConnection();
        if (!conn)
            top.appendChild(el('<p class="af-status" data-kind="bad">' + esc(ttsWhy || 'Pick your ElevenLabs connection in the Settings tab to choose voices.') + '</p>'));
        page.appendChild(top);
        const order = { narrator: 0, persona: 1, character: 2, npc: 3 };
        const people = S.cast.slice().sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
        for (const m of people)
            page.appendChild(personCard(m, conn));
    }
    const KIND_LABEL = { narrator: 'Narrator', character: 'Character', persona: 'Persona', npc: 'NPC' };
    function personCard(m, conn) {
        const open = openPeople.has(m.id);
        const initials = m.name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';
        const c = el('<section class="af-card af-person" data-kind="' + esc(m.kind) + '" data-open="' + (open ? 'true' : 'false') + '">' +
            '<button type="button" class="af-person-head" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="af-avatar">' + esc(initials) + '</span>' +
            '<span class="af-person-name"><b>' + esc(m.name) + '</b><span>' + esc(m.muted ? 'Not voiced' : m.voiceName || (m.voice ? m.voice : 'The connection\'s voice')) + '</span></span>' +
            (m.addedBy === 'ai' ? '<span class="af-badge af-badge-ai">Added by AI</span>' : '<span class="af-badge">' + esc(KIND_LABEL[m.kind] || m.kind) + '</span>') +
            '<span class="af-chev">' + ICON_CHEVRON + '</span></button><div class="af-person-body"' + (open ? '' : ' hidden') + '><div class="af-person-inner"></div></div></section>');
        const head = c.querySelector('.af-person-head');
        const body = c.querySelector('.af-person-body');
        const inner = c.querySelector('.af-person-inner');
        let built = false;
        const build = () => {
            if (built)
                return;
            built = true;
            fillPerson(inner, m, conn);
        };
        if (open)
            build();
        head.addEventListener('click', () => {
            const nowOpen = !openPeople.has(m.id);
            if (nowOpen)
                openPeople.add(m.id);
            else
                openPeople.delete(m.id);
            c.dataset.open = nowOpen ? 'true' : 'false';
            head.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
            if (nowOpen)
                build();
            reveal(body, nowOpen);
        });
        return c;
    }
    function fillPerson(inner, m, conn) {
        const refreshHead = () => {
            const card = inner.closest('.af-person');
            if (!card)
                return;
            const b = card.querySelector('.af-person-name b');
            const s = card.querySelector('.af-person-name span');
            if (b)
                b.textContent = m.name;
            if (s)
                s.textContent = m.muted ? 'Not voiced' : m.voiceName || (m.voice ? m.voice : 'The connection\'s voice');
        };
        const g1 = el('<div class="af-grid2"></div>');
        if (m.kind !== 'narrator') {
            g1.appendChild(text('Name', m.name, (v) => {
                m.name = v.trim() || m.name;
                save();
                refreshHead();
            }));
            g1.appendChild(text('Also called', (m.aliases || []).join(', '), (v) => {
                m.aliases = v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
                save();
            }, 'Other names, with commas'));
            g1.appendChild(select('Who they are', [
                { id: 'character', label: 'Character' },
                { id: 'persona', label: 'Persona (you)' },
                { id: 'npc', label: 'NPC' },
            ], m.kind, (v) => {
                m.kind = v;
                save();
            }));
            g1.appendChild(select('Voice type', [
                { id: 'unknown', label: 'Any' },
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
            ], m.gender, (v) => {
                m.gender = v;
                save();
            }));
            inner.appendChild(g1);
        }
        // The voice list loads from the connection, so it fills in after a moment.
        const voiceField = el('<div class="af-field"><label class="af-label">Voice</label><select disabled><option>Loading your voices…</option></select><p class="af-hint" data-af="vh"></p></div>');
        const vs = voiceField.querySelector('select');
        const vh = voiceField.querySelector('[data-af="vh"]');
        vs.id = rid('vc');
        voiceField.querySelector('label').setAttribute('for', vs.id);
        inner.appendChild(voiceField);
        if (conn) {
            loadVoices(conn.id).then((got) => {
                if (!vs.isConnected && !inner.isConnected)
                    return;
                vs.disabled = false;
                const opts = [{ id: '', label: 'The connection\'s voice' }].concat(got.voices.map((v) => ({ id: String(v.id), label: String(v.name || v.id) + (v.gender ? ' (' + v.gender + ')' : '') })));
                if (m.voice && !opts.some((o) => o.id === m.voice))
                    opts.push({ id: m.voice, label: m.voiceName || m.voice });
                vs.innerHTML = opts.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === m.voice ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
                vh.textContent = got.why || 'Designed or cloned voices act better than the stock voices.';
            });
        }
        else {
            vs.innerHTML = '<option>No ElevenLabs connection</option>';
            vh.textContent = ttsWhy || 'Pick your ElevenLabs connection in the Settings tab.';
        }
        vs.addEventListener('change', () => {
            m.voice = vs.value;
            m.voiceName = m.voice ? (vs.selectedOptions[0] ? vs.selectedOptions[0].textContent || '' : '').replace(/ \((female|male|neutral)\)$/i, '') : '';
            save();
            refreshHead();
        });
        const modelBox = el('<div></div>');
        inner.appendChild(modelBox);
        const stabilityBox = el('<div></div>');
        const drawStability = () => {
            stabilityBox.innerHTML = '';
            const model = m.model || (conn && conn.model) || '';
            if (/^eleven_v3/.test(model)) {
                stabilityBox.appendChild(segmented('Stability', [
                    { id: '0', label: 'Creative' },
                    { id: '0.5', label: 'Natural' },
                    { id: '1', label: 'Robust' },
                ], String(stabilityFor('eleven_v3', m.stability, false)), (v) => {
                    m.stability = Number(v);
                    save();
                }, 'Eleven v3 has three settings. Creative is the most expressive.'));
            }
            else {
                stabilityBox.appendChild(slider('Stability', m.stability, 0, 1, 0.05, (v) => v.toFixed(2), (v) => {
                    m.stability = v;
                    save();
                }, 'Lower is more expressive. Higher is steadier.'));
            }
        };
        modelBox.appendChild(select('Model', MODELS, m.model, (v) => {
            m.model = v;
            save();
            drawStability();
        }, 'Voice tags work with Eleven v3 and v4. Other models read the line without them.'));
        drawStability();
        inner.appendChild(stabilityBox);
        const g2 = el('<div class="af-grid2"></div>');
        g2.appendChild(slider('Similarity', m.similarity, 0, 1, 0.05, (v) => v.toFixed(2), (v) => {
            m.similarity = v;
            save();
        }));
        g2.appendChild(slider('Style', m.style, 0, 1, 0.05, (v) => v.toFixed(2), (v) => {
            m.style = v;
            save();
        }));
        g2.appendChild(slider('Speed', m.speed, 0.7, 1.2, 0.05, (v) => v.toFixed(2) + '×', (v) => {
            m.speed = v;
            save();
        }));
        inner.appendChild(g2);
        const noteId = rid('nt');
        const note = el('<div class="af-field"><label class="af-label" for="' + noteId + '">How they speak</label><textarea id="' + noteId + '" rows="2" placeholder="Soft-spoken and dry. Rarely raises their voice.">' + esc(m.note) +
            '</textarea><p class="af-hint">The Director reads this when it tags their lines.</p></div>');
        note.querySelector('textarea').addEventListener('input', (e) => {
            m.note = e.target.value.slice(0, 300);
            save();
        });
        inner.appendChild(note);
        const mutedId = rid('mt');
        const mutedRow = el('<label class="af-switch" for="' + mutedId + '"><span class="af-switch-text"><b>Do not voice</b><span>Their lines are skipped.</span></span><input type="checkbox" id="' + mutedId + '" role="switch"' +
            (m.muted ? ' checked' : '') + '><span class="af-knob" aria-hidden="true"></span></label>');
        mutedRow.querySelector('input').addEventListener('change', (e) => {
            m.muted = e.target.checked;
            save();
            refreshHead();
        });
        inner.appendChild(mutedRow);
        const actions = el('<div class="af-row"></div>');
        const status = el('<p class="af-status"></p>');
        actions.appendChild(button('Hear a sample', async () => {
            status.textContent = 'Asking ElevenLabs…';
            status.dataset.kind = '';
            const model = m.model || (conn && conn.model) || '';
            const sample = {
                i: 0, kind: m.kind === 'narrator' ? 'narration' : 'speech', speaker: m.name,
                text: takesTags(model) ? 'This is how I sound. [softly] And this is how I sound when I lower my voice.' : 'This is how I sound when I read a line for you.',
                plain: '', tags: [], big: false, before: '', after: '', note: '',
            };
            const ac = new AbortController();
            const got = await makeVoiceClip(sample, ac.signal);
            if (got.blob) {
                status.textContent = '';
                previewBlob(got.blob, S.voiceVolume);
            }
            else {
                status.textContent = got.why || 'The sample could not be made.';
                status.dataset.kind = 'bad';
            }
        }, '', ICON_SOUND));
        if (m.kind !== 'narrator') {
            actions.appendChild(button('Remove', async () => {
                let ok = true;
                try {
                    const r = await ctx.ui.showConfirm({ title: 'Remove ' + m.name, message: 'They are taken out of the cast. If they speak again, they are added back with no voice picked.', variant: 'danger', confirmLabel: 'Remove' });
                    ok = !!(r && r.confirmed);
                }
                catch (_) {
                    ok = confirm('Remove ' + m.name + ' from the cast?');
                }
                if (!ok)
                    return;
                S.cast = S.cast.filter((x) => x.id !== m.id);
                openPeople.delete(m.id);
                save();
                renderTab();
            }, 'af-btn-danger'));
        }
        inner.appendChild(actions);
        inner.appendChild(status);
    }
    // ---------- Director ----------
    let llmConnections = null;
    let llmWhy = '';
    let decisionList = null;
    let decisionWhy = '';
    function renderDirector() {
        stageRefs = null;
        const main = card('The Director');
        main.appendChild(hint('A second model reads each message and marks how every line is performed: voice tags such as [whispers] or [sighs], and the sounds that go with it. It never changes your words.'));
        main.appendChild(toggle('Use the Director', 'Off: messages are read as written, with no tags or sounds.', 'directorOn', undefined, () => {
            const rows = [];
            const connBox = el('<div></div>');
            const drawConn = () => {
                connBox.innerHTML = '';
                const opts = [{ id: '', label: 'The connection you chat with' }].concat((llmConnections || []).map((c) => ({ id: c.id, label: c.name + (c.model ? ' (' + c.model + ')' : '') })));
                if (S.directorConnection && !opts.some((o) => o.id === S.directorConnection))
                    opts.push({ id: S.directorConnection, label: 'A connection that is gone' });
                connBox.appendChild(select('Which connection', opts, S.directorConnection, (v) => set({ directorConnection: v }), llmWhy ? esc(llmWhy) : 'A fast, low-cost model works well here.'));
            };
            drawConn();
            if (!llmConnections) {
                rpc({ type: 'list_connections' }, 15000).then((r) => {
                    llmConnections = (r && r.list) || [];
                    llmWhy = (r && r.why) || '';
                    if (connBox.isConnected)
                        drawConn();
                }, () => {
                    llmConnections = [];
                    llmWhy = 'Your connections could not be read: the backend did not answer.';
                    if (connBox.isConnected)
                        drawConn();
                });
            }
            rows.push(connBox);
            rows.push(segmented('How much acting', [
                { id: 'subtle', label: 'Subtle' },
                { id: 'natural', label: 'Natural' },
                { id: 'dramatic', label: 'Dramatic' },
            ], S.strength, (v) => set({ strength: v }), 'At most 1, 2 or 4 voice tags in a line.'));
            rows.push(toggle('Voice tags', 'Delivery and emotion, such as [whispers], [shouting] or [voice breaking].', 'tagsOn'));
            rows.push(toggle('Breaths, sighs and laughs', 'Sounds a voice makes, such as [sighs], [laughs] or [gasps].', 'breathsOn'));
            rows.push(toggle('Sounds', 'Sounds for what happens: a door, footsteps, a glass breaking.', 'soundsOn', undefined, () => [
                segmented('How sounds are made', [
                    { id: 'voice', label: 'In the voice' },
                    { id: 'effects', label: 'Sound effects' },
                    { id: 'both', label: 'Both' },
                ], S.soundStyle, (v) => set({ soundStyle: v }), 'In the voice needs Eleven v3 or v4 and no extra key. Sound effects use your library and the key in the Sounds tab.'),
                toggle('Intimate sounds', 'Sounds for sex scenes between adults: kissing, skin, wet sounds, a bed creaking.', 'intimateOn'),
            ]));
            rows.push(toggle('Find new speakers', 'Someone new who speaks is added to the cast and given a voice.', 'findSpeakers'));
            rows.push(toggle('Big moments', 'The voice gets looser and more expressive on an emotional peak.', 'bigMoments'));
            return rows;
        }));
        page.appendChild(main);
        const dec = card('Decision model');
        dec.appendChild(hint('A fast Decision model picks who says each quoted line, and checks which lines describe a sound. The Director then writes the tags. If it cannot be asked, the Log says why and the Director does it alone.'));
        if (!hostHasDecisions)
            dec.appendChild(el('<p class="af-status" data-kind="bad">This Lumiverse has no Decision connections for extensions. Update Lumiverse to use them.</p>'));
        dec.appendChild(toggle('Use a Decision model', '', 'decisionsOn', undefined, () => {
            const box = el('<div></div>');
            const draw = () => {
                box.innerHTML = '';
                const opts = [{ id: '', label: 'Your default Decision connection' }].concat((decisionList || []).map((c) => ({ id: c.id, label: c.name + (c.model ? ' (' + c.model + ')' : '') + (c.hasKey ? '' : ', no key') })));
                if (S.decisionConnection && !opts.some((o) => o.id === S.decisionConnection))
                    opts.push({ id: S.decisionConnection, label: 'A connection that is gone' });
                box.appendChild(select('Which Decision connection', opts, S.decisionConnection, (v) => set({ decisionConnection: v }), decisionWhy ? esc(decisionWhy) : 'Set these up under Decision models in the Connections panel.'));
            };
            draw();
            if (!decisionList) {
                rpc({ type: 'list_decision_connections' }, 15000).then((r) => {
                    decisionList = (r && r.list) || [];
                    decisionWhy = (r && r.why) || (r && r.state === 'none' ? 'You have no Decision connections. Set one up under Decision models in the Connections panel.' : '');
                    if (box.isConnected)
                        draw();
                }, () => {
                    decisionList = [];
                    decisionWhy = 'Your Decision connections could not be read: the backend did not answer.';
                    if (box.isConnected)
                        draw();
                });
            }
            return [box];
        }));
        page.appendChild(dec);
        const pr = card('The Director’s prompt');
        pr.appendChild(hint('This is everything the Director is told. You can change it. The message and your cast are sent with it as JSON.'));
        const ta = el('<textarea class="af-prompt" spellcheck="false" aria-label="The Director’s prompt"></textarea>');
        ta.value = S.prompt || builtInPrompt;
        ta.addEventListener('input', () => {
            const v = ta.value;
            set({ prompt: v.trim() === builtInPrompt.trim() ? '' : v });
            paintPromptState();
        });
        pr.appendChild(ta);
        const prRow = el('<div class="af-row"></div>');
        const stateText = el('<span class="af-hint af-grow"></span>');
        const back = button('Back to the built-in prompt', () => {
            ta.value = builtInPrompt;
            set({ prompt: '' });
            paintPromptState();
        });
        prRow.appendChild(stateText);
        prRow.appendChild(back);
        pr.appendChild(prRow);
        const paintPromptState = () => {
            const custom = !!S.prompt;
            stateText.textContent = custom ? 'You are using your own version.' : 'You are using the built-in prompt.';
            back.disabled = !custom;
        };
        paintPromptState();
        page.appendChild(pr);
    }
    // ---------- Sounds ----------
    let soundFilter = '';
    let keyText = '';
    function renderSounds() {
        stageRefs = null;
        const k = card('ElevenLabs key for sounds');
        k.appendChild(hint('Lumiverse has no route for ElevenLabs sound effects, so making new sounds needs your key here. It is kept in Lumiverse’s secure storage and only sent to api.elevenlabs.io.'));
        const kid = rid('key');
        const kf = el('<div class="af-field"><label class="af-label" for="' + kid + '">Key for api.elevenlabs.io</label><input type="password" id="' + kid + '" autocomplete="off" spellcheck="false" placeholder="' +
            (hasKey ? 'A key is saved' : 'Paste your ElevenLabs key') + '"></div>');
        const kin = kf.querySelector('input');
        k.appendChild(kf);
        const kst = el('<p class="af-status"></p>');
        kst.textContent = keyText || (hasKey ? 'A key is saved.' : 'No key is saved. Sounds come only from your own uploads.');
        const krow = el('<div class="af-row"></div>');
        const doKey = async (msg, busy) => {
            kst.textContent = busy;
            kst.dataset.kind = '';
            try {
                const r = await rpc(msg, 40000);
                hasKey = !!(r && r.hasKey);
                keyText = (r && r.text) || '';
                kst.textContent = keyText;
                kst.dataset.kind = r && r.ok === false ? 'bad' : r && r.ok ? 'good' : '';
                kin.placeholder = hasKey ? 'A key is saved' : 'Paste your ElevenLabs key';
                forget.disabled = !hasKey;
                testB.disabled = !hasKey;
            }
            catch (e) {
                kst.textContent = String((e && e.message) || 'The backend did not answer.');
                kst.dataset.kind = 'bad';
            }
        };
        krow.appendChild(button('Save', () => {
            const v = kin.value;
            kin.value = '';
            if (!v.trim()) {
                kst.textContent = 'Paste a key first.';
                kst.dataset.kind = 'bad';
                return;
            }
            doKey({ type: 'key_save', key: v }, 'Saving and testing the key…');
        }, 'af-btn-main'));
        const testB = button('Test', () => doKey({ type: 'key_test' }, 'Testing the key…'));
        const forget = button('Forget', () => doKey({ type: 'key_forget' }, 'Removing the key…'), 'af-btn-danger');
        testB.disabled = !hasKey;
        forget.disabled = !hasKey;
        krow.appendChild(testB);
        krow.appendChild(forget);
        k.appendChild(krow);
        k.appendChild(kst);
        k.appendChild(toggle('Make new sounds with ElevenLabs', 'Off: only sounds already in your library are played.', 'makeSounds', undefined, () => [
            select('Sound length', [
                { id: '0', label: 'Let ElevenLabs choose' },
                { id: '1', label: '1 second' },
                { id: '2', label: '2 seconds' },
                { id: '3', label: '3 seconds' },
                { id: '5', label: '5 seconds' },
                { id: '10', label: '10 seconds' },
            ], String(S.soundSeconds || 0), (v) => set({ soundSeconds: Number(v) }), 'Longer sounds cost more credits.'),
        ]));
        page.appendChild(k);
        const lib = card('Your sound library', '<span class="af-badge">' + sounds.length + '</span>');
        lib.appendChild(hint('Every sound made is saved here, so the same sound is free the next time. Your own clips are used first. Trigger words make a clip play whenever a sound description holds one of them.'));
        const urow = el('<div class="af-row"></div>');
        const ust = el('<p class="af-status"></p>');
        urow.appendChild(button('Upload a sound', async () => {
            let files = [];
            try {
                files = await ctx.uploads.pickFile({ accept: ['audio/*', '.mp3', '.wav', '.ogg', '.m4a'], multiple: true, maxSizeBytes: 3 * 1024 * 1024 });
            }
            catch (e) {
                ust.textContent = 'The file picker could not open: ' + String((e && e.message) || e).slice(0, 200);
                ust.dataset.kind = 'bad';
                return;
            }
            for (const f of files || []) {
                ust.textContent = 'Saving ' + f.name + '…';
                ust.dataset.kind = '';
                const mime = /^audio\//.test(f.mimeType || '') ? f.mimeType : /\.mp3$/i.test(f.name) ? 'audio/mpeg' : /\.wav$/i.test(f.name) ? 'audio/wav' : /\.ogg$/i.test(f.name) ? 'audio/ogg' : /\.m4a$/i.test(f.name) ? 'audio/mp4' : '';
                try {
                    const r = await rpc({ type: 'sound_upload', name: f.name, mime, base64: bytesToBase64(f.bytes) }, 30000);
                    ust.textContent = r && r.ok ? 'Saved ' + f.name + '.' : (r && r.error) || 'The sound could not be saved.';
                    ust.dataset.kind = r && r.ok ? 'good' : 'bad';
                }
                catch (e) {
                    ust.textContent = String((e && e.message) || 'The backend did not answer.');
                    ust.dataset.kind = 'bad';
                }
            }
        }, 'af-btn-main'));
        const sid = rid('sf');
        const search = el('<input type="search" class="af-grow" id="' + sid + '" placeholder="Search sounds" aria-label="Search sounds">');
        search.value = soundFilter;
        urow.appendChild(search);
        lib.appendChild(urow);
        lib.appendChild(ust);
        const listBox = el('<div class="af-sounds"></div>');
        lib.appendChild(listBox);
        const drawList = () => {
            listBox.innerHTML = '';
            const f = soundFilter.trim().toLowerCase();
            const shown = sounds
                .filter((s) => !f || s.name.toLowerCase().indexOf(f) >= 0 || (s.triggers || []).some((t) => t.indexOf(f) >= 0))
                .slice()
                .reverse();
            if (!shown.length) {
                listBox.appendChild(el('<div class="af-empty">' + (sounds.length ? 'No sound matches.' : 'No sounds yet. Sounds the Director asks for are saved here, and you can upload your own.') + '</div>'));
                return;
            }
            for (const s of shown.slice(0, 200))
                listBox.appendChild(soundRow(s));
        };
        search.addEventListener('input', () => {
            soundFilter = search.value;
            drawList();
        });
        drawList();
        page.appendChild(lib);
    }
    function soundRow(s) {
        const r = el('<div class="af-sound"><button type="button" class="af-round" title="Play" aria-label="Play ' + esc(s.name) + '">' + ICON_PLAY + '</button>' +
            '<div class="af-sound-main"><div class="af-sound-name"></div><div class="af-sound-meta">' + (s.source === 'upload' ? 'Yours' : 'Made by ElevenLabs') + ' · ' +
            Math.max(1, Math.round((s.bytes || 0) / 1024)) + ' KB · played ' + (s.uses || 0) + ' times</div>' +
            '<input type="text" placeholder="Trigger words, with commas" aria-label="Trigger words for ' + esc(s.name) + '"></div>' +
            '<button type="button" class="af-btn af-btn-danger">Delete</button></div>');
        r.querySelector('.af-sound-name').textContent = s.name;
        const trig = r.querySelector('input');
        trig.value = (s.triggers || []).join(', ');
        let t = null;
        trig.addEventListener('input', () => {
            if (t)
                clearTimeout(t);
            t = setTimeout(() => {
                rpc({ type: 'sound_edit', id: s.id, triggers: trig.value.split(',').map((x) => x.trim()).filter(Boolean) }, 15000).then((res) => {
                    if (res && Array.isArray(res.sounds))
                        sounds = res.sounds;
                }, () => log('The trigger words could not be saved: the backend did not answer.', 'bad'));
            }, 600);
        });
        r.querySelector('.af-round').addEventListener('click', async () => {
            try {
                const got = await rpc({ type: 'sound_play', id: s.id }, 20000);
                if (got && got.base64)
                    previewBlob(base64ToBlob(got.base64, got.mime), S.soundVolume);
                else
                    log((got && got.error) || 'The sound could not be played.', 'bad');
            }
            catch (e) {
                log(String((e && e.message) || 'The sound could not be played.'), 'bad');
            }
        });
        r.querySelector('.af-btn-danger').addEventListener('click', async () => {
            try {
                const res = await rpc({ type: 'sound_delete', id: s.id }, 15000);
                if (res && Array.isArray(res.sounds))
                    sounds = res.sounds;
                renderTab();
            }
            catch (e) {
                log('The sound could not be deleted: the backend did not answer.', 'bad');
            }
        });
        return r;
    }
    // ---------- Settings ----------
    function renderSettings() {
        stageRefs = null;
        const a = card('Auto Foley');
        a.appendChild(toggle('Auto Foley is on', 'Off: no buttons on messages and nothing plays.', 'enabled', () => {
            if (!S.enabled)
                stop();
        }));
        const connBox = el('<div></div>');
        const drawConn = () => {
            connBox.innerHTML = '';
            const opts = [{ id: '', label: 'Your default ElevenLabs connection' }].concat(ttsConnections.map((c) => ({ id: c.id, label: c.name + (c.model ? ' (' + c.model + ')' : '') })));
            if (S.ttsConnection && !opts.some((o) => o.id === S.ttsConnection))
                opts.push({ id: S.ttsConnection, label: 'A connection that is gone' });
            connBox.appendChild(select('ElevenLabs connection', opts, S.ttsConnection, (v) => {
                set({ ttsConnection: v });
            }, ttsWhy ? esc(ttsWhy) : 'Auto Foley speaks through this connection. Only ElevenLabs connections are listed.'));
        };
        drawConn();
        loadTtsConnections().then(() => {
            if (connBox.isConnected)
                drawConn();
        });
        a.appendChild(connBox);
        page.appendChild(a);
        const p = card('Playing');
        p.appendChild(toggle('Autoplay new replies', 'Each new reply is performed when it finishes.', 'autoplay', undefined, () => [
            select('Wait before autoplay', [
                { id: '0', label: 'Play at once' },
                { id: '3', label: '3 seconds' },
                { id: '5', label: '5 seconds' },
                { id: '10', label: '10 seconds' },
                { id: '20', label: '20 seconds' },
            ], String(S.autoplayDelay || 0), (v) => set({ autoplayDelay: Number(v) }), 'Gives another extension time to change a reply first, such as Auto Refine.'),
        ]));
        p.appendChild(toggle('Prepare replies ahead', 'With Autoplay off, each new reply is directed in the background, so Play starts at once.', 'prepareAhead'));
        p.appendChild(toggle('Read your own messages', 'With Autoplay on, your messages are performed too, in your persona’s voice.', 'readOwnMessages'));
        p.appendChild(segmented('Narration', [
            { id: 'read', label: 'Read aloud' },
            { id: 'sounds', label: 'Sounds only' },
            { id: 'skip', label: 'Skip' },
        ], S.narration, (v) => set({ narration: v }), 'Sounds only plays the sounds of what happens, with no narrator voice.'));
        p.appendChild(toggle('Save the performance to the message', 'Lumiverse then plays it again from the message for free. It uses storage on the server.', 'saveAudio'));
        p.appendChild(toggle('Reduce motion', 'Turns off every fade and slide in this panel.', 'reduceMotion', () => renderTab()));
        page.appendChild(p);
        const r = card('Reading messages');
        r.appendChild(hint('Thinking a model writes in the message, such as &lt;think&gt; blocks, is never read aloud.'));
        const tid = rid('tt');
        const tf = el('<div class="af-field"><label class="af-label" for="' + tid + '">Extra thinking tag names</label><textarea id="' + tid + '" rows="2" spellcheck="false" placeholder="musing"></textarea>' +
            '<p class="af-hint">One per line, without the angle brackets. Text inside these tags is not read aloud.</p></div>');
        const ta = tf.querySelector('textarea');
        ta.value = (S.extraThinkTags || []).join('\n');
        ta.addEventListener('input', () => set({ extraThinkTags: ta.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20) }));
        r.appendChild(tf);
        page.appendChild(r);
        const c = card('Check my setup');
        c.appendChild(hint('Checks your ElevenLabs connection, the Director, the Decision model and the sounds key. It spends no ElevenLabs credits.'));
        const list = el('<ul class="af-checks"></ul>');
        const run = button('Check my setup', async () => {
            run.disabled = true;
            list.innerHTML = '';
            const add = (ok, text) => {
                const li = document.createElement('li');
                li.dataset.ok = ok == null ? '' : ok ? 'true' : 'false';
                const span = document.createElement('span');
                span.textContent = text;
                li.appendChild(span);
                list.appendChild(li);
            };
            await loadTtsConnections();
            const conn = activeConnection();
            if (!conn)
                add(false, ttsWhy || 'No ElevenLabs connection is picked.');
            else {
                add(conn.has_api_key !== false, conn.has_api_key === false ? 'The connection "' + conn.name + '" has no key saved in Lumiverse.' : 'Speaking through "' + conn.name + '".');
                const model = conn.model || '';
                add(takesTags(model) || S.cast.some((m) => takesTags(m.model)), takesTags(model)
                    ? 'Its model, ' + model + ', understands voice tags.'
                    : 'Its model, ' + (model || 'not set') + ', does not understand voice tags. Pick Eleven v3 or v4 on the connection, or for each person in the Cast tab.');
                const v = await loadVoices(conn.id);
                add(!!v.voices.length, v.voices.length ? v.voices.length + ' voices are available.' : v.why || 'No voices came back from ElevenLabs.');
            }
            if (S.directorOn) {
                try {
                    const r = await rpc({ type: 'check_director' }, 60000);
                    add(!!(r && r.ok), (r && r.text) || 'The Director did not answer.');
                }
                catch (e) {
                    add(false, 'The Director could not be checked: ' + String((e && e.message) || ''));
                }
            }
            else
                add(null, 'The Director is off.');
            if (S.decisionsOn) {
                try {
                    const r = await rpc({ type: 'check_decisions' }, 30000);
                    add(!!(r && r.ok), (r && r.text) || 'The Decision model could not be checked.');
                }
                catch (e) {
                    add(false, 'The Decision model could not be checked: ' + String((e && e.message) || ''));
                }
            }
            else
                add(null, 'The Decision model is off.');
            if (S.soundsOn && S.makeSounds) {
                try {
                    const r = await rpc({ type: 'key_test' }, 40000);
                    add(r && r.ok ? true : false, r && r.ok ? 'Sounds: ' + r.text : 'Sounds: ' + ((r && r.text) || 'the key could not be checked.') + ' Your uploads still play.');
                }
                catch (e) {
                    add(false, 'The sounds key could not be checked: ' + String((e && e.message) || ''));
                }
            }
            else
                add(null, S.soundsOn ? 'Making new sounds is off. Your uploads still play.' : 'Sounds are off.');
            run.disabled = false;
        }, 'af-btn-main');
        c.appendChild(run);
        c.appendChild(list);
        page.appendChild(c);
        page.appendChild(debugCard());
        const about = card('About');
        about.appendChild(el('<p class="af-hint">Auto Foley ' + VERSION + '. Made for adults. <a href="https://github.com/starlitcode/Lumiverse-Auto-Foley#readme" target="_blank" rel="noopener">Help on GitHub</a></p>'));
        page.appendChild(about);
    }
    // ---------- Debug info ----------
    // A snapshot anyone can paste into a bug report without opening developer
    // tools. People in the cast are named by their role, never by name, and no
    // message text is included. The box is editable, so anything private can be
    // taken out before copying.
    const DEBUG_PARTS = [
        { id: 'settings', label: 'Your settings' },
        { id: 'cast', label: 'Your cast and voices, by role only' },
        { id: 'environment', label: 'Permissions, browser and screen' },
        { id: 'activity', label: 'The last script and recent activity' },
    ];
    const debugPicked = { settings: true, cast: true, environment: true, activity: true };
    function stamp(d) {
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }
    function shown(v) {
        if (v === '' || (Array.isArray(v) && !v.length))
            return 'empty';
        return JSON.stringify(v);
    }
    // Each cast name, and each other name, mapped to the role the report calls
    // that person, so a Log line that names someone is written with the role.
    function roleNames() {
        const counts = {};
        return (S.cast || []).map((m) => {
            counts[m.kind] = (counts[m.kind] || 0) + 1;
            return { role: m.kind === 'narrator' ? 'narrator' : m.kind + ' ' + counts[m.kind], names: [m.name].concat(m.aliases || []).filter((n) => n && n.length > 1) };
        });
    }
    function withRoles(text, roles) {
        let out = text;
        const all = [];
        for (const r of roles)
            for (const n of r.names)
                all.push({ name: n, role: '[' + r.role + ']' });
        // Longest first, so a full name is replaced before the first name inside it.
        all.sort((a, b) => b.name.length - a.name.length);
        for (const a of all) {
            const safe = a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp('(^|[^\\p{L}])' + safe + '(?![\\p{L}])', 'giu'), (_m, pre) => pre + a.role);
        }
        return out;
    }
    async function buildDebugInfo() {
        const lines = [];
        const roles = roleNames();
        lines.push('Auto Foley v' + VERSION + ' debug info');
        lines.push('backend: ' + (!backendVersion ? 'has not answered' : backendVersion === VERSION ? 'the same version' : 'v' + backendVersion + ', which is not the version above'));
        lines.push('time: ' + stamp(new Date()));
        let host = '';
        try {
            host = String((ctx.host && ctx.host.lumiverseVersion) || '');
        }
        catch (_) { }
        lines.push('lumiverse: ' + (host ? 'v' + host.replace(/^v/, '') : 'not reported by this Lumiverse'));
        let secure = false;
        try {
            secure = !!window.isSecureContext;
        }
        catch (_) { }
        lines.push('secure page: ' + (secure ? 'yes' : 'no (plain http)'));
        lines.push('settings loaded from the account: ' + (accountAnswered ? 'yes' : 'no, using the copy in this browser'));
        lines.push('auto foley: ' + (S.enabled ? 'on' : 'off') + ', director ' + (S.directorOn ? 'on' : 'off') + ', decision model ' + (S.decisionsOn ? 'on' : 'off') +
            ', sounds ' + (S.soundsOn ? S.soundStyle : 'off') + ', narration ' + S.narration + ', autoplay ' + (S.autoplay ? 'on' : 'off'));
        if (debugPicked.settings) {
            const keys = Object.keys(DEFAULTS).filter((k) => k !== 'cast' && k !== 'prompt');
            const changed = keys.filter((k) => JSON.stringify(S[k]) !== JSON.stringify(DEFAULTS[k]));
            lines.push('');
            lines.push('settings changed from the default (' + changed.length + ' of ' + keys.length + '):');
            if (!changed.length)
                lines.push('  (none)');
            for (const k of changed)
                lines.push('  ' + k + ': ' + shown(S[k]) + ', default ' + shown(DEFAULTS[k]));
            lines.push('  prompt: ' + (S.prompt ? 'your own, ' + String(S.prompt).length + ' characters' : 'the built-in one'));
        }
        if (debugPicked.cast) {
            lines.push('');
            const conn = activeConnection();
            lines.push('elevenlabs connection: ' + (conn ? 'found, model ' + (conn.model || 'not set') + ', key ' + (conn.has_api_key === false ? 'MISSING' : 'saved') : ttsWhy || 'none picked'));
            if (conn && voiceCache[conn.id])
                lines.push('voices on it: ' + voiceCache[conn.id].voices.length);
            lines.push('sound effects key: ' + (hasKey ? 'saved' : 'none') + ', library: ' + sounds.length + ' sounds');
            lines.push('cast (' + (S.cast || []).length + '):');
            (S.cast || []).forEach((m, k) => {
                const role = roles[k].role;
                lines.push('  ' + role + ': added by ' + m.addedBy + ', voice ' + (m.voice ? 'picked' : 'the connection\'s') + ', model ' + (m.model || 'the connection\'s') +
                    ', stability ' + m.stability + ', similarity ' + m.similarity + ', style ' + m.style + ', speed ' + m.speed + (m.muted ? ', not voiced' : '') +
                    (m.note ? ', has a note' : ''));
            });
        }
        if (debugPicked.environment) {
            lines.push('');
            let granted = null;
            try {
                if (ctx.permissions && typeof ctx.permissions.getGranted === 'function')
                    granted = await ctx.permissions.getGranted();
            }
            catch (_) { }
            if (!Array.isArray(granted))
                lines.push('permissions: not reported by this build');
            else {
                lines.push('permissions:');
                for (const p of ['generation', 'decisions', 'cors_proxy'])
                    lines.push('  ' + p + ' = ' + (granted.indexOf(p) >= 0 ? 'granted' : 'MISSING'));
            }
            try {
                lines.push('browser: ' + (navigator.userAgent || 'unknown'));
            }
            catch (_) { }
            try {
                lines.push('screen: ' + window.innerWidth + ' x ' + window.innerHeight + ', touch: ' + (matchMedia('(pointer: coarse)').matches ? 'yes' : 'no'));
            }
            catch (_) { }
        }
        if (debugPicked.activity) {
            lines.push('');
            const sc = currentScript();
            if (!sc)
                lines.push('last script: none');
            else {
                lines.push('last script: ' + sc.lines.length + ' lines, ' + (sc.directed ? 'directed' : 'read as written'));
                sc.lines.forEach((l) => {
                    lines.push('  ' + (l.i + 1) + ': ' + l.kind + ', ' + (l.tags || []).length + ' tags, ' + ((l.inSounds || []).length + (l.before ? 1 : 0) + (l.after ? 1 : 0)) + ' sounds' +
                        (l.big ? ', big moment' : '') + (l.note ? ', note: ' + l.note : ''));
                });
            }
            lines.push('playing: ' + (show ? 'part ' + (show.index + 1) + ' of ' + show.items.length + (paused ? ', paused' : '') : 'no'));
            lines.push('recent activity:');
            if (!logLines.length)
                lines.push('  (nothing yet)');
            for (const l of logLines.slice(-40))
                lines.push('  ' + l.at + ' ' + withRoles(l.text, roles));
        }
        return lines.join('\n');
    }
    function debugCard() {
        const c = card('Debug info');
        c.appendChild(hint('Optional. Adding this to a bug report helps show exactly what went wrong. Nothing leaves your device until you paste it.'));
        for (const part of DEBUG_PARTS) {
            const id = rid('dbg');
            const row = el('<label class="af-check" for="' + id + '"><input type="checkbox" id="' + id + '"' + (debugPicked[part.id] ? ' checked' : '') + '><span>' + esc(part.label) + '</span></label>');
            row.querySelector('input').addEventListener('change', (e) => {
                debugPicked[part.id] = e.target.checked;
            });
            c.appendChild(row);
        }
        const area = el('<textarea class="af-prompt" rows="8" spellcheck="false" aria-label="Debug info" placeholder="Press Build preview to fill this, then edit out anything private before copying."></textarea>');
        const status = el('<p class="af-status"></p>');
        const row = el('<div class="af-row"></div>');
        row.appendChild(button('Build preview', async () => {
            area.value = await buildDebugInfo();
            status.textContent = 'Built. Edit anything you want to remove, then Copy.';
        }));
        row.appendChild(button('Copy', async () => {
            if (!area.value.trim())
                area.value = await buildDebugInfo();
            let ok = false;
            try {
                await navigator.clipboard.writeText(area.value);
                ok = true;
            }
            catch (_) {
                try {
                    area.select();
                    ok = document.execCommand('copy');
                }
                catch (_) { }
            }
            status.textContent = ok ? 'Copied. You can paste it into a bug report.' : 'Could not copy here. Select the text and copy it by hand.';
        }, 'af-btn-main'));
        c.appendChild(row);
        c.appendChild(area);
        c.appendChild(status);
        c.appendChild(toggle('Log to the browser console', 'Also writes each Log line to the browser\'s developer console.', 'debugConsole'));
        return c;
    }
    // ---------------------------------------------------------------------------
    // Start
    // ---------------------------------------------------------------------------
    renderTab();
    loadTtsConnections().then(() => {
        if (tab === 'settings' || tab === 'cast')
            renderTab();
    });
    rpc({ type: 'load' }, 20000).then((r) => {
        if (!alive || !r || r.type !== 'state')
            return;
        accountAnswered = true;
        S = Object.assign({}, DEFAULTS, r.settings || {});
        sounds = Array.isArray(r.sounds) ? r.sounds : [];
        hasKey = !!r.hasKey;
        builtInPrompt = String(r.builtInPrompt || '');
        hostHasDecisions = r.decisions !== false;
        backendVersion = String(r.version || '');
        keepLocal();
        renderTab();
        paintButtons();
    }, () => {
        log('Your settings could not be loaded from your account. The copy kept in this browser is used, and changes are not saved until the account answers.', 'bad');
    });
    return () => {
        alive = false;
        stop();
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        pending.forEach((p) => {
            clearTimeout(p.timer);
            p.reject(new Error('Auto Foley was turned off.'));
        });
        pending.clear();
        try {
            if (preview) {
                preview.pause();
                URL.revokeObjectURL(preview.src);
            }
        }
        catch (_) { }
        for (const dispose of disposers.splice(0)) {
            try {
                dispose();
            }
            catch (_) { }
        }
        try {
            root.remove();
        }
        catch (_) { }
        try {
            ctx.dom.cleanup();
        }
        catch (_) { }
    };
}
export const __testing = { takesTags, stripTags, stabilityFor, lineHtml };
