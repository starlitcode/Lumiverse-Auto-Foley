// Auto Foley, the panel and the player.
//
// The panel lives in a Lumiverse drawer tab, with five tabs: Stage, Cast,
// Director, Sounds and Settings. Each message gets an Auto Foley button in its
// row of buttons. Pressing it reads the message, sends it to the backend to be
// directed, and plays the script that comes back: each line through one of
// the reader's TTS connections in Lumiverse, with the voice of whoever says
// it, and each sound from the library or from ElevenLabs sound effects.
//
// The key for speech stays in Lumiverse. Lines are spoken through
// Lumiverse's own TTS route, as the signed-in reader, so this file never sees
// that key.
const VERSION = '0.1.0';
// The marks Lumiverse puts on another extension's part of the page. Nothing
// inside one is read, written or pressed.
const OTHER_UI = '[data-spindle-extension-root],[data-spindle-ext],[data-spindle-modal]';
const STORE_KEY = 'lv-auto-foley:settings:v1';
const API = '/api/v1';
// The ElevenLabs models that act out tags, used when the connection cannot
// list its own.
const ELEVEN_MODELS = [
    { id: 'eleven_v4', label: 'Eleven v4' },
    { id: 'eleven_v4_turbo', label: 'Eleven v4 Turbo' },
    { id: 'eleven_v3', label: 'Eleven v3' },
];
// The vocal sounds Gemini 3.8 lists for its inline tags.
const GEMINI_TAGS = [
    'argh', 'breath', 'heavy breath', 'exhales', 'cackle', 'cheer', 'chuckle', 'cough', 'cry', 'gasp', 'giggle', 'groan', 'growl',
    'grunt', 'hiss', 'laugh', 'moan', 'pant', 'phew', 'scream', 'shout', 'shriek', 'sigh', 'sneeze', 'snicker', 'snort', 'sob',
    'throat-clearing', 'tsk', 'whimper', 'whispers', 'yawn', 'short pause', 'long pause',
];
// The nine tags Chatterbox-Turbo knows.
const CHATTERBOX_TAGS = ['clear throat', 'sigh', 'shush', 'cough', 'groan', 'sniff', 'gasp', 'chuckle', 'laugh'];
const ENGINE_LIST = [
    { id: 'eleven_v3', label: 'ElevenLabs v3 or v4', tags: 'free', list: [], wrap: '[]', style: false, inVoiceSounds: true, singTag: 'sings', singStyle: false, eleven: true, supported: true },
    { id: 'fish', label: 'Fish Audio S2 or Drama 3', tags: 'free', list: [], wrap: '[]', style: false, inVoiceSounds: false, singTag: 'singing', singStyle: false, eleven: false, supported: true },
    { id: 'gemini', label: 'Gemini 3.8 TTS', tags: 'list', list: GEMINI_TAGS, wrap: '<>', style: true, inVoiceSounds: false, singTag: '', singStyle: true, eleven: false, supported: true },
    { id: 'chatterbox_turbo', label: 'Chatterbox-Turbo', tags: 'list', list: CHATTERBOX_TAGS, wrap: '[]', style: false, inVoiceSounds: false, singTag: '', singStyle: false, eleven: false, supported: true },
];
// A model that cannot act.
const NO_TAGS = { id: 'none', label: 'A model with no tags', tags: 'none', list: [], wrap: '[]', style: false, inVoiceSounds: false, singTag: '', singStyle: false, eleven: false, supported: false };
// The providers Auto Foley lists. Chatterbox runs behind an OpenAI-style
// connection.
const USABLE_PROVIDERS = ['elevenlabs', 'fish_audio', 'google_tts', 'google_vertex_tts', 'openai_tts'];
const ENGINES = {};
for (const e of ENGINE_LIST)
    ENGINES[e.id] = e;
// Which engine a connection runs, from its provider and model. A connection
// to a local server, such as Chatterbox, is an OpenAI-style connection in
// Lumiverse, so it is found by name: in the model, the connection's name or
// its address. Settings can say it outright when the name does not show it.
function engineOf(conn, model, chosen) {
    const provider = String((conn && conn.provider) || '').toLowerCase();
    const m = String(model || (conn && conn.model) || '').toLowerCase();
    const hay = [m, conn && conn.name, conn && conn.api_url].map((x) => String(x || '').toLowerCase()).join(' ');
    if (provider === 'elevenlabs')
        return /^eleven_v(3|4)/.test(m) ? ENGINES.eleven_v3 : NO_TAGS;
    if (provider === 'fish_audio')
        return /^s1$/.test(m) ? NO_TAGS : ENGINES.fish;
    if (provider === 'google_tts' || provider === 'google_vertex_tts')
        return /gemini-3\.8-flash(-lite)?-tts/.test(m) ? ENGINES.gemini : NO_TAGS;
    if (provider !== 'openai_tts')
        return NO_TAGS;
    if (chosen === 'chatterbox_turbo')
        return ENGINES.chatterbox_turbo;
    if (/chatterbox/.test(hay) && !/multilingual|\bmtl\b/.test(hay))
        return ENGINES.chatterbox_turbo;
    return NO_TAGS;
}
// Whether a model acts, for a list of models to pick from.
function modelActs(conn, model) {
    return engineOf(conn, model, 'chatterbox_turbo').supported;
}
// Why a model cannot be used, and what to pick instead.
function noTagsWhy(conn, model) {
    const provider = String((conn && conn.provider) || '').toLowerCase();
    const m = String(model || (conn && conn.model) || '');
    const hay = [m, conn && conn.name, conn && conn.api_url].map((x) => String(x || '').toLowerCase()).join(' ');
    const what = 'Auto Foley works only with models that act out tags. ';
    if (provider === 'elevenlabs')
        return what + (m || 'This model') + ' does not. Pick Eleven v3 or Eleven v4 on the connection, or for this person in the Cast tab.';
    if (provider === 'fish_audio')
        return what + 'Fish Audio S1 does not. Pick S2.1 Pro, S2 Pro or Drama 3.';
    if (provider === 'google_tts' || provider === 'google_vertex_tts')
        return what + (m || 'This Gemini model') + ' does not. Pick Gemini 3.8 Flash TTS or Gemini 3.8 Flash-Lite TTS.';
    if (provider === 'openai_tts' && /multilingual|\bmtl\b/.test(hay))
        return what + 'Chatterbox-Multilingual does not. Run Chatterbox-Turbo on your server.';
    if (provider === 'openai_tts')
        return what + 'This connection is not a Chatterbox-Turbo server. If it is one, pick Chatterbox-Turbo under What this connection runs, in the Settings tab.';
    return what + 'This connection is not one of them: ElevenLabs, Fish Audio, Gemini 3.8 or Chatterbox-Turbo.';
}
// Turns a tag into the vocal sound it names, so [laughs softly], [laughing]
// and [laughter] all become laugh. Empty when it names none of them.
const TAG_WORDS = {
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
const TAG_KNOWN = new Set(GEMINI_TAGS.concat(CHATTERBOX_TAGS));
function tagSound(tag) {
    const t = String(tag || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t)
        return '';
    if (/\b(clears?|clearing)\b.*\bthroat\b|\bthroat[- ]clear/.test(t))
        return 'throat';
    if (/\blong pause\b/.test(t))
        return 'long pause';
    if (/\b(short pause|pause|beat)\b/.test(t))
        return 'short pause';
    if (/\bheavy breath/.test(t))
        return 'heavy breath';
    for (const w of t.split(' ')) {
        const c = TAG_WORDS[w] || w;
        if (TAG_KNOWN.has(c))
            return c;
    }
    return '';
}
function fitTag(tag, list) {
    const c = tagSound(tag);
    if (!c)
        return '';
    if (c === 'throat')
        return list.indexOf('clear throat') >= 0 ? 'clear throat' : list.indexOf('throat-clearing') >= 0 ? 'throat-clearing' : '';
    return list.indexOf(c) >= 0 ? c : '';
}
// ---- Word timing ----
// The words of the line playing are lit as they are spoken. The time is read
// from the clip's own sound: it is cut into 20 ms frames, and a frame counts
// as voiced when it is louder than a share of the loudest part. Words move on
// only while the voice sounds, so the silence at each end, a pause at a comma
// and a held breath do not push them ahead.
const FRAME_SECS = 0.02;
function voicedFrames(samples, rate) {
    const per = Math.max(1, Math.round(rate * FRAME_SECS));
    const rms = [];
    for (let at = 0; at < samples.length; at += per) {
        let sum = 0;
        const end = Math.min(samples.length, at + per);
        for (let k = at; k < end; k++)
            sum += samples[k] * samples[k];
        rms.push(Math.sqrt(sum / Math.max(1, end - at)));
    }
    if (!rms.length)
        return [];
    // The loud end is read near the top rather than at the very top, so one
    // click does not set the bar for the whole clip.
    const sorted = rms.slice().sort((a, b) => a - b);
    const loud = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const bar = Math.max(loud * 0.1, 0.004);
    const out = rms.map((v) => v > bar);
    // A gap shorter than 80 ms inside speech is the space between two sounds
    // of one word, not a pause.
    for (let k = 1; k < out.length - 1; k++) {
        if (out[k])
            continue;
        let e = k;
        while (e < out.length && !out[e])
            e++;
        if (e < out.length && out[k - 1] && e - k <= 4)
            for (let j = k; j < e; j++)
                out[j] = true;
        k = e;
    }
    return out;
}
// How long a word takes to say, roughly: its groups of vowels, at least one.
// Text with no Latin vowels, such as Japanese, is counted by its length.
function wordWeight(word) {
    const w = String(word || '').toLowerCase();
    const groups = w.match(/[aeiouyàâäéèêëîïôöùûüáíóúãõåæø]+/g);
    if (groups)
        return Math.max(1, groups.length - (/[^aeiou]e$/.test(w) && groups.length > 1 ? 1 : 0));
    const letters = (w.match(/[\p{L}\p{N}]/gu) || []).length;
    return letters ? Math.max(1, Math.round(letters / 2)) : 0;
}
// The time each part of a line starts, in seconds, from how heavy each part
// is and which frames are voiced. With no voiced frames, the parts are
// spread over the whole clip.
function partTimes(weights, voiced, duration) {
    const total = weights.reduce((a, b) => a + b, 0);
    const at = [];
    const on = [];
    voiced.forEach((v, k) => {
        if (v)
            on.push(k);
    });
    let run = 0;
    for (const w of weights) {
        const share = total > 0 ? run / total : 0;
        if (on.length)
            at.push(on[Math.min(on.length - 1, Math.floor(share * on.length))] * FRAME_SECS);
        else
            at.push(share * (duration > 0 ? duration : 0));
        run += w;
    }
    return at;
}
// What an engine can do, in one short line for the panel.
function engineAbility(e) {
    if (!e.supported)
        return 'It does not act out tags, so Auto Foley cannot use it.';
    const tags = e.tags === 'free' ? 'yes' : e.tags === 'list' ? 'only its own ' + e.list.length + ' sound tags' : 'no';
    return ('Voice tags: ' + tags + '. ' +
        (e.style ? 'Notes on how a line is said: yes. ' : '') +
        'Sounds inside a line: ' + (e.inVoiceSounds ? 'yes' : 'no') + '. ' +
        'Singing: ' + (e.singTag || e.singStyle ? 'yes' : 'no, sung lines are spoken') + '.');
}
function stripTags(text) {
    return tidy(String(text || '').replace(/\[[^\]]*\]/g, ' '));
}
function tidy(text) {
    return String(text || '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.!?…;:])/g, '$1')
        .trim();
}
// The words sent for one line, fitted to the engine that speaks it.
function textFor(line, eng) {
    let t = String(line.text || '');
    if (eng.tags === 'none')
        t = stripTags(t);
    else
        t = tidy(t.replace(/\[([^\]]*)\]/g, (_m, inner) => {
            const tag = String(inner).trim();
            if (/^sounds? of\b/i.test(tag))
                return eng.inVoiceSounds ? ' [' + tag + '] ' : ' ';
            if (eng.tags === 'free')
                return ' [' + tag + '] ';
            const fit = fitTag(tag, eng.list);
            if (!fit)
                return ' ';
            return eng.wrap === '<>' ? ' <' + fit + '> ' : ' [' + fit + '] ';
        }));
    if (line.sung && eng.singTag && !/\[(sings?|singing)\b[^\]]*\]/i.test(t))
        t = '[' + eng.singTag + '] ' + t;
    return t;
}
// How a line is said, for an engine that takes it beside the line.
function styleFor(line, eng) {
    if (!eng.style)
        return '';
    const said = String(line.style || '').trim();
    if (line.sung && eng.singStyle)
        return said ? 'singing, ' + said : 'singing the words to a simple tune';
    return said;
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
// A short, stable fingerprint of a text, the same as the backend's. It tells
// two clips apart. It is not for security.
function fingerprint(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let k = 0; k < text.length; k++) {
        const c = text.charCodeAt(k);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul(h2 + c, 2246822519) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
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
    return (await readTrouble(res, what)).why;
}
// The words for a failed call, and the same failure in the shape errorKind
// reads, "failed (status): detail", to decide whether waiting can fix it.
async function readTrouble(res, what, who = 'the voice service') {
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
    const raw = 'failed (' + res.status + '): ' + said;
    const wrap = (why) => ({ why, raw });
    if (res.status === 401)
        return wrap(what + ' failed because Lumiverse says you are signed out. Reload the page and sign in.' + tail);
    if (res.status === 404)
        return wrap(what + ' failed because Lumiverse could not find it.' + tail);
    if (/No API key/i.test(said))
        return wrap(what + ' failed because your connection to ' + who + ' in Lumiverse has no key saved.' + tail);
    if (/quota|credit/i.test(said))
        return wrap(what + ' failed because your account with ' + who + ' is out of credits.' + tail);
    if (/401|invalid.*key|unauthori/i.test(said))
        return wrap(what + ' failed because ' + who + ' refused the key saved on your connection.' + tail);
    if (/429|rate|busy|too many/i.test(said))
        return wrap(what + ' failed because ' + who + ' is busy. Try again in a moment.' + tail);
    if (/ECONNREFUSED|fetch failed|Unable to connect|connect(ion)? refused|unreachable|timed? ?out/i.test(said))
        return wrap(what + ' failed because Lumiverse could not reach ' + who + '. If it runs on your own computer, check that the server is running and that the address on the connection is right.' + tail);
    return wrap(what + ' failed (' + res.status + ').' + tail);
}
// Whether a chat's title is the date and time Lumiverse gives a new chat, in
// any language's format: a year and a time of day.
function looksLikeDate(t) {
    return /\b(19|20)\d{2}\b/.test(t) && /\b\d{1,2}[:.]\d{2}([:.]\d{2})?\b/.test(t);
}
// A name for the service a connection speaks through, for messages.
function serviceName(conn) {
    const p = String((conn && conn.provider) || '').toLowerCase();
    if (p === 'elevenlabs')
        return 'ElevenLabs';
    if (p === 'fish_audio')
        return 'Fish Audio';
    if (p === 'google_tts' || p === 'google_vertex_tts')
        return 'Gemini';
    const hay = [conn && conn.model, conn && conn.name, conn && conn.api_url].map((x) => String(x || '').toLowerCase()).join(' ');
    if (/chatterbox/.test(hay))
        return 'your Chatterbox server';
    return 'the voice service';
}
function netTrouble(e, what) {
    if (e && e.name === 'AbortError')
        return what + ' was stopped.';
    return what + ' failed because Lumiverse could not be reached. Check your connection to the server.';
}
// ---------------------------------------------------------------------------
// Which errors are worth trying again
// ---------------------------------------------------------------------------
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
const HARD_SURE = /\b(?:reasoning[_ -]?extraction|invalid[_ ]?api[_ ]?key|authentication|unauthorized|insufficient[_ ](?:balance|credits?|funds|quota)|billing|context[_ ]length(?:[_ ]exceeded)?|maximum context|(?:prompt|input|context|messages?) (?:is |are )?too long|daily (?:request |token |usage )?(?:limit|quota|cap)|today['’]?s (?:free )?(?:requests|quota|limit|usage)|\w*(?:requests|tokens) ?per ?day\w*|resets? at (?:midnight|00:00))\b/i;
// Words that are hard from a provider, and that a gateway's page can also use
// about itself.
const HARD_LOOSE = /\b(?:forbidden|permission|not allowed|not found|does not exist|model missing)\b/i;
// Errors that clear if you wait: a rate limit, a busy or loading server, a
// gateway that could not get through, a dropped connection.
const WAIT_ERROR = /\b(?:408|409|425|429|5\d\d)\b|rate.?limit|too many requests|quota|overloaded|capacity|try again|temporar(?:y|ily)|time(?:d ?| |-)?out|network|gateway|unavailable|server error|(?:no healthy|no available|bad) upstream|upstream (?:connect|error|request|server|service|time)|provider returned error|connection (?:was |is |has been )?(?:closed|reset|refused|lost|dropped|error|failed|failure|terminated)|closed unexpectedly|(?:unable|failed|could not) to connect|socket|terminated|econn\w+|etimedout|epipe|eai_again|enotfound|ehostunreach|enetunreach|und_err\w*|fetch failed|busy|loading/i;
function errorKind(text) {
    const stated = STATED_STATUS.exec(text);
    const status = stated ? stated[1] : '';
    const detail = stated ? text.slice(stated.index + stated[0].length) : text;
    if (HARD_SURE.test(detail))
        return 'hard';
    if (status) {
        if (GATEWAY_STATUS.test(status))
            return 'wait';
        if (HARD_STATUS.test(status) || HARD_LOOSE.test(detail))
            return 'hard';
        if (WAIT_STATUS.test(status) || WAIT_ERROR.test(detail))
            return 'wait';
        return '';
    }
    if (HARD_STATUS.test(text) || HARD_LOOSE.test(text))
        return 'hard';
    return WAIT_ERROR.test(text) ? 'wait' : '';
}
function rateLimited(err) {
    const s = String(err == null ? '' : err);
    if (!s)
        return false;
    return errorKind(s) === 'wait';
}
// How long the provider said to wait, in milliseconds, or 0 when it said
// nothing. The header's own form first, which is a whole number of seconds
// against the words and no unit; then the wordings written into an error body.
// It is the only figure here that is not a guess, so it wins over the backoff.
const RETRY_AFTER = /retry[-_ ]?after["'\s:=]*(\d+(?:\.\d+)?)(?![.\d]*\s*[a-z])/i;
const STATED_WAIT = /(?:retry|try|again|wait|resets?|available)[^0-9]{0,24}?(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?)\b/i;
const WAIT_SCALE = {
    ms: 1, millisecond: 1, milliseconds: 1,
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
};
// An hour is the ceiling. A provider naming a longer one is naming a daily
// quota, and sitting on a timer for that is worse than saying so and stopping.
const WAIT_CEILING = 3600000;
function statedWait(err) {
    const s = String(err == null ? '' : err);
    if (!s)
        return 0;
    const bare = RETRY_AFTER.exec(s);
    if (bare) {
        const secs = Number(bare[1]);
        if (Number.isFinite(secs) && secs > 0)
            return Math.min(WAIT_CEILING, secs * 1000);
    }
    const hit = STATED_WAIT.exec(s);
    if (!hit)
        return 0;
    const ms = Number(hit[1]) * (WAIT_SCALE[String(hit[2]).toLowerCase()] || 0);
    return Number.isFinite(ms) && ms > 0 ? Math.min(WAIT_CEILING, ms) : 0;
}
// The first wait, doubling, with a little spread on it so a pause everybody is
// serving does not end for everybody in the same instant. A figure the provider
// named wins outright: waiting less than it is spending a try to be told the
// same thing.
const RATE_WAIT_MS = 15000;
const RATE_WAIT_MAX = 120000;
function rateWait(attempt, err) {
    const said = statedWait(err);
    if (said > 0)
        return said + Math.round(Math.random() * 1000);
    const grown = Math.min(RATE_WAIT_MAX, RATE_WAIT_MS * Math.pow(2, Math.max(0, attempt - 1)));
    return Math.round(grown * (0.85 + Math.random() * 0.3));
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
const ICON_BACK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 6.5v11a1 1 0 0 1-1.55.83L9 13.2V17a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v3.8l7.45-5.13A1 1 0 0 1 18 6.5Z"/></svg>';
const ICON_MORE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const ICON_MIC_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.7 2.5"/><path d="M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16"/></svg>';
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
// Colors are the host's theme variables. The extension's own names start with
// --af- and only ever point at a host variable, so a theme recolors all of it.
const CSS = `
.af {
  /* Auto Foley's own names point only at the host's theme variables, so the
     reader's theme recolors all of it. The status colors are pale on a light
     theme, so they color borders, dots and fills, and text stays in the text
     colors. */
  --af-accent: var(--lumiverse-primary, rgba(147,112,219,.9));
  --af-accent-text: var(--lumiverse-primary-text, rgba(186,135,255,.95));
  --af-accent-soft: var(--lumiverse-primary-020, rgba(147,112,219,.2));
  --af-accent-faint: var(--lumiverse-primary-010, rgba(147,112,219,.1));
  --af-accent-line: var(--lumiverse-primary-050, rgba(147,112,219,.5));
  --af-sound: var(--lumiverse-warning, #f59e0b);
  --af-sound-soft: var(--lumiverse-warning-015, rgba(245,158,11,.15));
  --af-good: var(--lumiverse-success, #22c55e);
  --af-bad: var(--lumiverse-danger, #ef4444);
  --af-text: var(--lumiverse-text, rgba(255,255,255,.9));
  --af-muted: var(--lumiverse-text-muted, rgba(255,255,255,.65));
  --af-line: var(--lumiverse-border, rgba(147,112,219,.12));
  --af-line-hover: var(--lumiverse-border-hover, rgba(147,112,219,.25));
  --af-fill: var(--lumiverse-fill, rgba(0,0,0,.15));
  --af-fill-subtle: var(--lumiverse-fill-subtle, rgba(0,0,0,.1));
  --af-second: var(--lumiverse-secondary, rgba(128,128,128,.15));
  --af-second-hover: var(--lumiverse-secondary-hover, rgba(128,128,128,.25));
  --af-r: var(--lumiverse-radius, 8px);
  --af-r-sm: var(--lumiverse-radius-sm, 5px);
  --af-r-md: var(--lumiverse-radius-md, 10px);
  --af-fast: var(--lumiverse-transition-fast, 150ms ease);
  display: flex; flex-direction: column; gap: 14px;
  box-sizing: border-box; width: 100%; max-width: 760px; margin: 0 auto; padding: 14px 14px 28px;
  color: var(--af-text); font: 13px/1.5 var(--lumiverse-font-family, system-ui);
}
.af *, .af *::before, .af *::after { box-sizing: border-box; }
.af [hidden] { display: none !important; }

.af-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.af-brand { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
.af-brand-icon { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 9px; background: var(--af-accent-soft); color: var(--af-accent-text); }
.af-brand-icon svg { width: 18px; height: 18px; }
.af-brand-name { font-size: 15px; font-weight: 650; }
.af-brand-sub { color: var(--af-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-pill { flex: none; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--af-second); color: var(--af-muted); white-space: nowrap; }
.af-pill[data-on="true"] { background: var(--af-accent-soft); color: var(--af-text); }

.af-chatline { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; color: var(--af-muted); }
.af-chatline span:last-child { min-width: 0; overflow-wrap: anywhere; }
.af-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--lumiverse-text-dim, rgba(255,255,255,.4)); }
.af-dot[data-state="chat"] { background: var(--af-accent); }
.af-dot[data-state="temporary"] { background: var(--af-sound); }

.af-tabs { display: flex; gap: 3px; padding: 3px; border-radius: var(--af-r-md); border: 1px solid var(--af-line); background: var(--af-fill-subtle); }
.af-tab {
  flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
  cursor: pointer; background: transparent; border: 0; padding: 8px 4px; border-radius: calc(var(--af-r-md) - 3px);
  font: 12.5px var(--lumiverse-font-family, system-ui); color: var(--af-muted);
  transition: color var(--af-fast), background var(--af-fast);
}
.af-tab[aria-selected="true"] { color: var(--af-text); background: var(--af-accent-soft); }
.af-tab:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--af-accent); }
@media (hover: hover) { .af-tab:not([aria-selected="true"]):hover { color: var(--af-text); background: var(--af-accent-faint); } }
@media (max-width: 340px) { .af-tabs { gap: 1px; } .af-tab { padding-left: 1px; padding-right: 1px; } }

.af-page { display: flex; flex-direction: column; gap: 12px; }
@keyframes af-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.af-card { display: flex; flex-direction: column; gap: 11px; padding: 12px; min-width: 0; border-radius: var(--af-r-md); border: 1px solid var(--af-line); background: var(--af-fill-subtle); }
.af-cardh { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; font-weight: 600; color: var(--af-text); }
.af-cardh > span:first-child { flex: 1; min-width: 0; }
.af-note { margin: 0; font-size: 12px; line-height: 1.45; color: var(--af-muted); }
.af-note a { color: var(--af-accent-text); }
.af-note b { color: var(--af-text); font-weight: 600; }
.af-status { margin: 0; min-height: 18px; font-size: 12px; color: var(--af-muted); overflow-wrap: anywhere; }
.af-status[data-kind="bad"] { color: var(--af-text); }
.af-status[data-kind="bad"]::before { content: "! "; color: var(--af-bad); font-weight: 700; }
.af-status[data-kind="good"]::before { content: "✓ "; color: var(--af-good); font-weight: 700; }
.af-rule { height: 1px; background: var(--af-line); margin: 2px 0; }

.af-col { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.af-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.af-between { display: flex; align-items: center; justify-content: space-between; gap: 9px; min-width: 0; }
.af-grow { flex: 1 1 160px; min-width: 0; }
.af-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 520px) { .af-grid2 { grid-template-columns: minmax(0, 1fr); } }
.af-labrow { display: flex; align-items: center; gap: 6px; min-width: 0; }
.af-lab { font-size: 12.5px; color: var(--af-text); min-width: 0; }

/* The "?" beside a setting, and the description it opens. */
.af-q {
  flex: none; width: 18px; height: 18px; padding: 0; line-height: 1; font-size: 11px; border-radius: 50%;
  border: 1px solid var(--af-line); background: transparent; color: var(--af-muted); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; font-family: inherit;
  transition: border-color var(--af-fast);
}
.af-q:hover, .af-q[aria-expanded="true"] { border-color: var(--af-accent); color: var(--af-accent-text); }
.af-q:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--af-accent-soft); }
.af-hint {
  position: fixed; z-index: 2147483300; box-sizing: border-box; padding: 8px 10px; border-radius: var(--lumiverse-radius, 8px);
  background-color: var(--lumiverse-card-bg-solid, rgb(24,20,34));
  background-image: linear-gradient(var(--lumiverse-bg-elevated, rgba(35,30,48,.98)), var(--lumiverse-bg-elevated, rgba(35,30,48,.98)));
  border: 1px solid var(--lumiverse-border, rgba(147,112,219,.12)); box-shadow: var(--lumiverse-shadow-md, 0 8px 24px rgba(0,0,0,.4));
  color: var(--lumiverse-text, rgba(255,255,255,.9)); font: 12px/1.45 var(--lumiverse-font-family, system-ui);
  opacity: 0; transform: none;
}
.af-hint[data-af-from="over"] { transform: translateY(4px); }
.af-hint[data-af-from="under"] { transform: translateY(-4px); }
.af-hint[data-af-moving] { transition: opacity 140ms ease-out, transform 140ms ease-out; }
.af-hint[data-af-open] { opacity: 1; transform: none; }

/* The switch. It bounces a little when flipped, the same as Auto Refine's. */
.af-box {
  -webkit-appearance: none; appearance: none; margin: 0; flex: none; position: relative; width: 38px; height: 22px;
  border-radius: 11px; cursor: pointer; background: var(--af-fill); border: 1px solid var(--af-line-hover);
  transition: background-color var(--af-fast), border-color var(--af-fast);
}
.af-box::after {
  content: ""; position: absolute; top: 50%; left: 3px; transform: translateY(-50%); width: 14px; height: 14px;
  border-radius: 50%; background: var(--af-muted);
  transition: left 320ms cubic-bezier(.34,1.56,.64,1), width 200ms ease, background-color var(--af-fast);
}
.af-box:checked { background: var(--af-accent-soft); border-color: var(--af-accent-line); }
.af-box:checked::after { left: 19px; background: var(--af-accent); }
.af-box:disabled { opacity: .45; cursor: not-allowed; }
.af-box:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--af-accent-soft), 0 0 8px 0 var(--af-accent-soft); }
@media (prefers-reduced-motion: no-preference) {
  html:not([data-af-still]) .af-box:active:not(:disabled)::after { width: 18px; }
  html:not([data-af-still]) .af-box:checked:active:not(:disabled)::after { left: 15px; }
}
@media (hover: hover) { .af-box:hover:not(:disabled) { box-shadow: 0 0 0 3px var(--af-accent-soft); } }

/* Rows that only matter while the switch above them is on. */
.af-sub > .af-under { display: flex; flex-direction: column; gap: 11px; padding: 2px 0 2px 11px; margin-left: 3px; border-left: 2px solid var(--af-line); }

.af-field {
  width: 100%; min-height: 34px; padding: 8px 10px; border-radius: var(--af-r); border: 1px solid var(--af-line);
  background: var(--lumiverse-input-bg, var(--af-fill)); color: var(--af-text); font: 13px/1.5 var(--lumiverse-font-family, system-ui);
  transition: border-color var(--af-fast), box-shadow var(--af-fast);
}
input.af-field:focus, textarea.af-field:focus { outline: none; border-color: var(--af-accent); box-shadow: 0 0 0 2px var(--af-accent-soft); }
select.af-field { cursor: pointer; }
select.af-field:focus, select.af-field:focus-visible { outline: none; box-shadow: none; border-color: var(--af-line-hover); }
textarea.af-field { resize: vertical; min-height: 64px; }
textarea.af-mono, .af-mono { font-family: var(--lumiverse-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; }
textarea.af-tall { min-height: 260px; }
@media (hover: hover) { .af-field:hover:not(:focus):not(:disabled) { border-color: var(--af-accent-line); } }

.af-seg { display: flex; border-radius: var(--af-r); overflow: hidden; border: 1px solid var(--af-line); }
.af-segbtn {
  flex: 1; min-width: 0; min-height: 32px; padding: 7px 8px; cursor: pointer; border: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font: 12.5px var(--lumiverse-font-family, system-ui); background: transparent; color: var(--af-muted);
}
.af-segbtn[aria-pressed="true"] { background: var(--af-second); color: var(--af-text); }
.af-segbtn:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--af-accent-soft); }
@media (hover: hover) { .af-segbtn:not([aria-pressed="true"]):hover { background: var(--af-fill-subtle); } }

.af-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 7px 12px;
  border-radius: var(--af-r); border: 1px solid transparent; background: var(--af-second); color: var(--af-text);
  font: 12.5px var(--lumiverse-font-family, system-ui); cursor: pointer; white-space: nowrap;
  transition: background-color var(--af-fast);
}
.af-btn svg { width: 14px; height: 14px; flex: none; }
.af-btn:hover:not(:disabled) { background: var(--af-second-hover); }
.af-btn.af-primary { background: var(--af-accent-soft); border-color: var(--af-accent-line); color: var(--af-text); font-weight: 600; }
.af-btn.af-primary:hover:not(:disabled) { background: var(--af-accent-line); }
.af-btn.af-danger { border-color: var(--af-bad); color: var(--af-text); background: rgba(239,68,68,.12); }
.af-btn.af-danger { border-color: color-mix(in srgb, var(--af-bad) 45%, transparent); background: color-mix(in srgb, var(--af-bad) 12%, transparent); }
.af-btn.af-danger:hover:not(:disabled) { background: rgba(239,68,68,.22); }
.af-btn.af-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--af-bad) 22%, transparent); }
.af-btn:disabled { opacity: .5; cursor: not-allowed; }
.af-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--af-accent-soft), 0 0 8px 0 var(--af-accent-soft); }

.af-fold {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 34px; padding: 7px 10px; text-align: left; cursor: pointer;
  border-radius: var(--af-r-sm); border: 1px solid var(--af-line); background: var(--af-fill-subtle); color: var(--af-text);
  font: 12.5px var(--lumiverse-font-family, system-ui); transition: background-color var(--af-fast);
}
.af-fold:hover { background: var(--af-second); }
.af-fold:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--af-accent-soft); }
.af-caret { flex: none; font-size: 9px; width: 9px; color: var(--af-muted); transition: transform .2s ease; }
.af-fold[aria-expanded="true"] .af-caret { transform: rotate(90deg); }
.af-foldbody { display: flex; flex-direction: column; gap: 11px; padding: 2px 2px 4px 10px; border-left: 1px solid var(--af-line); margin-left: 5px; }

.af-warn, .af-bad, .af-good { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.45; padding: 8px 10px; border-radius: var(--af-r-sm); border: 1px solid; color: var(--af-text); }
.af-warn { border-color: var(--af-sound); background: var(--af-sound-soft); }
.af-bad { border-color: var(--af-bad); background: rgba(239,68,68,.12); }
.af-bad { background: color-mix(in srgb, var(--af-bad) 12%, transparent); }
.af-good { border-color: var(--af-good); background: rgba(34,197,94,.12); }
.af-good { background: color-mix(in srgb, var(--af-good) 12%, transparent); }
.af-sign { flex: none; font-weight: 700; line-height: 1.45; }
.af-warn .af-sign { color: var(--af-sound); }
.af-bad .af-sign { color: var(--af-bad); }
.af-good .af-sign { color: var(--af-good); }

/* Sliders. Lumiverse styles range inputs on every page, so these carry the
   .af class twice to win over it. */
.af.af input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 22px; margin: 0; background: transparent; cursor: pointer; }
.af.af input[type="range"]::-webkit-slider-runnable-track {
  height: 4px; border-radius: 999px;
  background: linear-gradient(90deg, var(--af-accent) 0 var(--af-fill-to, 50%), var(--af-fill) var(--af-fill-to, 50%) 100%);
}
.af.af input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -6px; border: 0; border-radius: 50%; background: var(--af-accent); box-shadow: 0 0 0 3px var(--af-accent-soft); }
.af.af input[type="range"]::-moz-range-track { height: 4px; border-radius: 999px; background: var(--af-fill); }
.af.af input[type="range"]::-moz-range-progress { height: 4px; border-radius: 999px; background: var(--af-accent); }
.af.af input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; border: 0; border-radius: 50%; background: var(--af-accent); }
.af-slider-head output { margin-left: auto; color: var(--af-muted); font-size: 12px; font-variant-numeric: tabular-nums; }

/* The Stage */
.af-transport { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.af-play { display: grid; place-items: center; width: 46px; height: 46px; flex: none; border: 1px solid var(--af-accent-line); border-radius: 50%; background: var(--af-accent-soft); color: var(--af-accent-text); cursor: pointer; transition: background-color var(--af-fast); }
.af-play:hover:not(:disabled) { background: var(--af-accent-line); }
.af-play svg { width: 20px; height: 20px; }
.af-play:disabled { opacity: .45; cursor: not-allowed; }
.af-round { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border: 1px solid transparent; border-radius: 50%; background: var(--af-second); color: var(--af-text); cursor: pointer; transition: background-color var(--af-fast); }
.af-round svg { width: 15px; height: 15px; }
.af-round:hover:not(:disabled) { background: var(--af-second-hover); }
.af-round:disabled { opacity: .45; cursor: not-allowed; }
.af-play:focus-visible, .af-round:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--af-accent-soft), 0 0 8px 0 var(--af-accent-soft); }
.af-now-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 140px; }
.af-now-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-now-sub { color: var(--af-muted); font-size: 12px; line-height: 1.4; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; min-height: 2.8em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.af-scene { display: flex; flex-wrap: wrap; gap: 6px; }
.af-scene span { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; background: var(--af-second); color: var(--af-text); }

.af-mixer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.af-strip { display: flex; flex-direction: column; gap: 6px; padding: 10px; min-width: 0; border: 1px solid var(--af-line); border-radius: var(--af-r); background: var(--af-fill-subtle); }
.af-strip-name { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; }
.af-swatch { width: 8px; height: 8px; border-radius: 50%; background: var(--af-accent); flex: none; }
.af-swatch-sound { background: var(--af-sound); }

.af-parts { display: flex; align-items: center; gap: 3px; width: 100%; min-height: 32px; }
.af-parts:empty { display: none; }
.af-parts button { flex: 1 1 0; min-width: 4px; height: 32px; padding: 13px 0; border: 0; border-radius: 0; background: transparent; cursor: pointer; }
.af-parts button i { display: block; width: 100%; height: 6px; border-radius: 3px; background: var(--af-line-hover); transition: height .2s ease, background-color .2s ease; }
.af-parts button[data-k="sound"] i, .af-parts button[data-k="applause"] i { background: var(--af-sound-soft); }
.af-parts button[data-done] i { background: var(--af-accent-soft); }
.af-parts button[data-k="sound"][data-done] i, .af-parts button[data-k="applause"][data-done] i { background: var(--af-sound); }
.af-parts button[aria-current="true"] i { height: 10px; background: var(--af-accent); }
.af-parts button:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--af-accent); border-radius: 6px; }
.af-chip { display: inline-flex; align-items: center; gap: 4px; margin: 0 2px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 19px; vertical-align: 1px; white-space: nowrap; }
.af-chip-tag { background: var(--af-accent-soft); color: var(--af-text); }
.af-chip-insound { background: var(--af-sound-soft); color: var(--af-text); box-shadow: inset 0 0 0 1px var(--af-sound); white-space: normal; }
button.af-chip-sound { min-height: 24px; border: 1px solid var(--af-sound); background: var(--af-sound-soft); color: var(--af-text); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; white-space: normal; text-align: left; }
button.af-chip-sound svg { width: 12px; height: 12px; flex: none; color: var(--af-sound); }
.af-empty { padding: 14px 10px; color: var(--af-muted); text-align: center; font-size: 12.5px; }
.af-log { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow: auto; }
.af-log-line { color: var(--af-muted); font-size: 11.5px; overflow-wrap: anywhere; }
.af-log-line b { color: var(--af-muted); font-weight: 600; font-variant-numeric: tabular-nums; margin-right: 6px; }
.af-log-line[data-kind="bad"] { color: var(--af-text); }
.af-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; }
.af-steps li { padding-left: 2px; }
.af-steps svg { width: 14px; height: 14px; vertical-align: -2px; }

/* The Cast */
.af-person { padding: 0; gap: 0; }
.af-group { display: flex; flex-direction: column; gap: 10px; }
.af-group-head { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 3px 6px 3px 4px; border: 1px solid var(--af-line); border-radius: var(--af-r-md); background: var(--af-fill-subtle); }
.af-group-toggle { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px; border: 0; border-radius: var(--af-r-sm); background: transparent; color: var(--af-text); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.af-group-toggle > span:nth-child(2) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-group-toggle .af-chev { display: grid; place-items: center; width: 18px; height: 18px; color: var(--af-muted); transition: transform var(--af-fast); }
.af-group-toggle .af-chev svg { width: 14px; height: 14px; }
.af-group[data-open="true"] .af-group-toggle .af-chev { transform: rotate(90deg); }
.af-group-count { flex: none; color: var(--af-muted); font-weight: 400; font-size: 12px; }
.af-group-name { flex: 1 1 auto; min-width: 0; }
.af-group-body > div { display: flex; flex-direction: column; gap: 12px; padding: 2px 0 2px 12px; margin-left: 10px; border-left: 2px solid var(--af-line); }
.af-group-empty { margin: 0; color: var(--af-muted); font-size: 12.5px; }
.af-person-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 8px; width: 100%; min-height: 48px; padding: 8px 10px; border: 0; border-radius: var(--af-r-md); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
@media (hover: hover) { .af-person-head:hover { background: var(--af-accent-faint); } }
.af-person-head:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--af-accent-soft); }
.af-avatar { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--af-accent-soft); color: var(--af-text); font-size: 12px; font-weight: 700; box-shadow: inset 0 0 0 1.5px var(--af-accent); }
.af-person[data-kind="narrator"] .af-avatar { background: var(--af-fill); box-shadow: inset 0 0 0 1.5px var(--af-line-hover); }
.af-person[data-kind="persona"] .af-avatar { background: var(--af-sound-soft); box-shadow: inset 0 0 0 1.5px var(--af-sound); }
.af-person-name { display: flex; flex-direction: column; min-width: 0; }
.af-person-name b { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-person-name span { color: var(--af-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-badge { font-size: 11px; padding: 2px 7px; border-radius: 999px; background: var(--af-second); color: var(--af-muted); white-space: nowrap; }
.af-badge-ai { background: var(--af-sound-soft); color: var(--af-text); box-shadow: inset 0 0 0 1px var(--af-sound); }
.af-chev { width: 16px; height: 16px; color: var(--af-muted); transition: transform .22s cubic-bezier(.2,.7,.2,1); }
.af-person[data-open="true"] .af-chev { transform: rotate(90deg); }
.af-person-body > .af-person-inner { display: flex; flex-direction: column; gap: 11px; padding: 4px 12px 12px; }

/* The Sounds library */
.af-sounds { display: flex; flex-direction: column; gap: 6px; }
.af-sound { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 6px 8px; border: 1px solid var(--af-line); border-radius: var(--af-r); background: var(--af-fill-subtle); }
.af-sound-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.af-sound-name { font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere; }
.af-sound-meta { color: var(--af-muted); font-size: 11px; }

.af-checks { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.af-checks li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; font-size: 12px; }
.af-checks li::before { content: "•"; color: var(--af-muted); }
.af-checks li[data-ok="true"]::before { content: "✓"; color: var(--af-good); }
.af-checks li[data-ok="false"]::before { content: "!"; color: var(--af-bad); font-weight: 700; }

@media (pointer: coarse) {
  .af-btn { min-height: 40px; padding: 10px 14px; }
  .af-fold { min-height: 44px; }
  .af-tab { padding: 12px 4px; }
  .af-segbtn { min-height: 40px; }
  .af-q { width: 32px; height: 32px; font-size: 14px; }
  .af-field { padding: 10px 12px; }
  .af-box { width: 52px; height: 32px; border-radius: 17px; }
  .af-box::after { width: 24px; height: 24px; left: 4px; }
  .af-box:checked::after { left: 24px; }
  .af-box::before { content: ""; position: absolute; inset: -6px -4px; }
  button.af-chip-sound { min-height: 32px; }
}
@media (pointer: coarse) and (prefers-reduced-motion: no-preference) {
  html:not([data-af-still]) .af-box:active:not(:disabled)::after { width: 29px; }
  html:not([data-af-still]) .af-box:checked:active:not(:disabled)::after { left: 19px; }
}

/* The big editor that Expand opens over the page. */
.af-over { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: var(--lumiverse-modal-backdrop, rgba(0,0,0,.6)); animation: af-fade-in 200ms ease-out both; }
.af-bigbox { display: flex; flex-direction: column; gap: 10px; width: min(760px, 96vw); height: min(82vh, 700px); max-width: none; margin: 0; padding: 14px; border-radius: var(--lumiverse-radius-lg, 12px); border: 1px solid var(--lumiverse-border, rgba(147,112,219,.12)); background-color: var(--lumiverse-card-bg-solid, rgb(24,20,34)); background-image: linear-gradient(var(--lumiverse-bg-elevated, rgba(35,30,48,.9)), var(--lumiverse-bg-elevated, rgba(35,30,48,.9))); box-shadow: var(--lumiverse-shadow-xl, 0 20px 60px rgba(0,0,0,.5)); animation: af-card-in 220ms cubic-bezier(.2,.8,.28,1) both; }
textarea.af-bigta { flex: 1; min-height: 0; resize: none; }
.af-over.af-leaving { pointer-events: none; animation: af-fade-out 160ms ease-in both; }
.af-over.af-leaving .af-bigbox { animation: af-card-out 160ms ease-in both; }
@keyframes af-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes af-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes af-card-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes af-card-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(6px); } }

/* Auto Foley draws its own controls, never the browser's or Lumiverse's
   defaults: a dropdown with its own arrow, number boxes with no spinners, and
   thin scroll bars in the theme's colors. */
.af-selwrap { position: relative; display: block; min-width: 0; }
.af-selwrap select.af-field { -webkit-appearance: none; appearance: none; padding-right: 32px; text-overflow: ellipsis; }
.af-selwrap::after { content: ""; position: absolute; right: 13px; top: 50%; width: 7px; height: 7px; border-right: 1.5px solid var(--af-muted); border-bottom: 1.5px solid var(--af-muted); transform: translateY(-70%) rotate(45deg); pointer-events: none; }
.af select.af-field option { background-color: var(--lumiverse-bg-elevated, #231e30); color: var(--af-text); }
.af input.af-field[type="number"] { -moz-appearance: textfield; appearance: textfield; }
.af input.af-field[type="number"]::-webkit-outer-spin-button, .af input.af-field[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
.af input.af-field[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.af, .af * { scrollbar-width: thin; scrollbar-color: var(--af-line-hover) transparent; }
.af ::-webkit-scrollbar { width: 8px; height: 8px; }
.af ::-webkit-scrollbar-track { background: transparent; }
.af ::-webkit-scrollbar-thumb { min-height: 28px; border-radius: 999px; background: var(--af-line-hover); }
.af :focus-visible { outline: none; }

/* The button on each message and in the chat's row. It wears the host
   button's class where there is one beside it, and this look where not. */
.af-slot { display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; margin: 0; padding: 5px; border-radius: 8px; line-height: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; color: var(--lumiverse-text-muted, rgba(255,255,255,.62)); transition: color .15s ease, opacity .15s ease; }
.af-slot:hover { color: var(--lumiverse-text, rgba(255,255,255,.92)); }
.af-slot:focus-visible { outline: 2px solid var(--lumiverse-primary, #8b5cf6); outline-offset: 2px; }
.af-slot svg { display: block; width: 14px; height: 14px; }
[data-af-slot][aria-busy="true"] { color: var(--lumiverse-primary, #8b5cf6); }
.af-slot-row { display: flex; justify-content: center; align-items: center; padding: 2px 0; }
@media (pointer: coarse) { .af-slot-row .af-slot { padding: 9px; } }

/* Reduce motion, from the panel or the device: nothing moves or fades. */
html[data-af-still] [class*="af-"], html[data-af-still] [class*="af-"]::before, html[data-af-still] [class*="af-"]::after { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  [class*="af-"], [class*="af-"]::before, [class*="af-"]::after { animation: none !important; transition: none !important; }
}
`;
const DEFAULTS = {
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
    applauseOn: false,
    applauseForAi: true,
    applauseForUser: false,
    applauseWhen: 'message',
    engines: {},
    engineNotes: {},
    groups: [],
    promptRole: 'system',
    decisionQuestions: {},
    soundCheck: true,
    skipOn: true,
    skipPatterns: '',
    speechMarks: 'auto',
    keepAudio: 100,
    applauseSound: '',
    applauseSeconds: 5,
    applauseVolume: 0.6,
    extrasMenu: true,
    panelPattern: '',
    boxSolid: 60,
    widgetOn: false,
    widgetSize: 44,
    thinkingMode: 'off',
    thinkingEffort: 'low',
    samplers: {},
    timeoutSecs: 120,
    rateWaits: 2,
    retryDirector: 1,
    askNote: true,
    askNotes: {},
    messageButton: true,
    barButton: true,
    guideSeen: false,
    exportParts: ['settings', 'prompt', 'cast'],
    importParts: ['settings', 'prompt', 'cast'],
    resetParts: ['settings', 'prompt', 'cast', 'sounds', 'audio', 'key'],
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
    // The built-in notes sent with an ask made again, from the backend.
    let builtInNotes = {};
    let builtInEngineNotes = {};
    let builtInSkips = '';
    let builtInQuestions = {};
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
    // Lumiverse's own auto-play reads a new reply too. Said under Autoplay, the
    // switch it clashes with.
    function bothAutoplayWarning() {
        const box = el('<div class="af-col"></div>');
        const paint = () => {
            box.innerHTML = '';
            if (hostVoice && hostVoice.ttsEnabled && hostVoice.ttsAutoPlay)
                box.appendChild(notice('warn', 'Lumiverse’s own Auto-play responses is on too, so new replies would be read twice. Turn it off in Lumiverse’s Settings, on the Voice tab.'));
            box.hidden = !box.childElementCount;
        };
        paint();
        loadHostVoice().then(() => {
            if (box.isConnected)
                paint();
        });
        return [box];
    }
    // The heading a TTS connection is listed under: its service.
    function engineGroup(c) {
        const p = String((c && c.provider) || '').toLowerCase();
        if (p === 'elevenlabs')
            return 'ElevenLabs';
        if (p === 'fish_audio')
            return 'Fish Audio';
        if (p === 'google_tts' || p === 'google_vertex_tts')
            return 'Gemini';
        return 'Chatterbox and other servers';
    }
    // A provider id as a heading, such as openai_compatible as Openai compatible.
    function providerName(p) {
        const t = String(p || '').replace(/[_-]+/g, ' ').trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Other';
    }
    // What an engine cannot do of what is switched on, said where the switch
    // is, so nobody waits for a tag or a sound that never comes.
    function engineWarnings(eng, conn, model) {
        const out = [];
        if (!eng.supported) {
            out.push(noTagsWhy(conn || activeConnection(), model));
            return out;
        }
        if (S.directorOn && S.soundsOn && S.soundStyle !== 'effects' && !eng.inVoiceSounds)
            out.push('This engine cannot make sounds inside a line. Its sounds are played as separate sound effects instead, which need the sound effects key in the Sounds tab or sounds you upload there.');
        return out;
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
            ttsConnections = all.filter((c) => c && c.id && USABLE_PROVIDERS.indexOf(String(c.provider || '').toLowerCase()) >= 0);
            ttsWhy = ttsConnections.length
                ? ''
                : 'You have no TTS connection Auto Foley can use. Add one for ElevenLabs, Fish Audio, Gemini or a Chatterbox-Turbo server in Lumiverse, under Connections, in the TTS section.';
        }
        catch (e) {
            ttsWhy = netTrouble(e, 'Reading your TTS connections');
            ttsConnections = [];
        }
    }
    // Lumiverse's own Voice settings, read for two things: the connection
    // picked there, which is the default here, and whether its own auto-play is
    // on, which would read a reply at the same time as Auto Foley.
    let hostVoice = null;
    async function loadHostVoice() {
        try {
            const res = await api('/settings/voiceSettings');
            if (!res.ok)
                return;
            const j = await res.json();
            hostVoice = j && j.value && typeof j.value === 'object' ? j.value : null;
        }
        catch (_) { }
    }
    function activeConnection() {
        if (S.ttsConnection)
            return ttsConnections.find((c) => c.id === S.ttsConnection) || null;
        const hostPick = hostVoice && hostVoice.ttsConnectionId ? ttsConnections.find((c) => c.id === hostVoice.ttsConnectionId) : null;
        return hostPick || ttsConnections.find((c) => c.is_default) || ttsConnections[0] || null;
    }
    function connById(id) {
        return (id && ttsConnections.find((c) => c.id === id)) || null;
    }
    // The connection a person speaks through: their own, when one is picked
    // and still there, or Auto Foley's.
    function connOf(m) {
        const own = m && m.connection ? connById(m.connection) : null;
        return own || activeConnection();
    }
    // A person's voice and model on one connection. Voices belong to a
    // connection, so each connection keeps its own pick. A pick from before
    // connections were told apart was always an ElevenLabs voice.
    function pickOf(m, conn) {
        const none = { voice: '', voiceName: '', model: '' };
        if (!m || !conn)
            return none;
        const v = m.voices && m.voices[conn.id];
        if (v)
            return v;
        if (m.voice && String(conn.provider || '').toLowerCase() === 'elevenlabs')
            return { voice: m.voice, voiceName: m.voiceName, model: m.model };
        return none;
    }
    function setPick(m, conn, patch) {
        if (!conn)
            return;
        const next = Object.assign({}, pickOf(m, conn), patch);
        m.voices = Object.assign({}, m.voices || {});
        m.voices[conn.id] = next;
        if (String(conn.provider || '').toLowerCase() === 'elevenlabs') {
            m.voice = '';
            m.voiceName = '';
            m.model = '';
        }
    }
    // The engine a connection runs, with the model a person uses on it.
    function engineFor(conn, model) {
        return engineOf(conn, model, conn && S.engines ? S.engines[conn.id] : '');
    }
    // The engine for the connection Auto Foley speaks through, which the
    // Director writes for.
    function mainEngine() {
        const conn = activeConnection();
        return conn ? engineFor(conn, conn.model) : ENGINES.eleven_v3;
    }
    // Both play a new reply when Lumiverse's auto-play and Auto Foley's are on.
    function bothAutoplay() {
        return !!S.autoplay && !!S.enabled && !!hostVoice && !!hostVoice.ttsEnabled && !!hostVoice.ttsAutoPlay;
    }
    const voiceCache = {};
    async function loadVoices(connId) {
        if (!connId)
            return { voices: [], why: 'Pick your TTS connection in the Settings tab first.' };
        if (voiceCache[connId])
            return voiceCache[connId];
        try {
            const res = await api('/tts-connections/' + encodeURIComponent(connId) + '/voices');
            if (!res.ok)
                return { voices: [], why: await hostTrouble(res, 'Reading the voices on this connection') };
            const j = await res.json();
            const voices = Array.isArray(j && j.voices) ? j.voices : [];
            const out = { voices, why: j && j.error ? 'Reading the voices on this connection failed. Lumiverse said: ' + String(j.error).slice(0, 200) : '' };
            if (voices.length)
                voiceCache[connId] = out;
            return out;
        }
        catch (e) {
            return { voices: [], why: netTrouble(e, 'Reading the voices on this connection') };
        }
    }
    // The models a connection offers, for a person's own model. ElevenLabs
    // falls back to the models Lumiverse is known to offer.
    const modelCache = {};
    async function loadModels(conn) {
        if (!conn)
            return [];
        if (modelCache[conn.id])
            return modelCache[conn.id];
        let list = [];
        try {
            const res = await api('/tts-connections/' + encodeURIComponent(conn.id) + '/models');
            if (res.ok) {
                const j = await res.json();
                list = (Array.isArray(j && j.models) ? j.models : [])
                    .filter((x) => x && x.id)
                    .map((x) => ({ id: String(x.id), label: String(x.label || x.id) }));
            }
        }
        catch (_) { }
        if (!list.length && String(conn.provider || '').toLowerCase() === 'elevenlabs')
            list = ELEVEN_MODELS.slice();
        if (list.length)
            modelCache[conn.id] = list;
        return list;
    }
    // The chat on screen. Lumiverse's address for a chat is /chat/ and its id,
    // so on any other page of the app, such as the home screen, no chat is open
    // even though the app still remembers the last one. Where there is no
    // address to read, the app's own answer is used.
    function activeChatId() {
        let path = '';
        let web = false;
        try {
            path = String(location.pathname || '');
            web = /^https?:$/.test(String(location.protocol || ''));
        }
        catch (_) { }
        const m = path.match(/\/chat\/([^/?#]+)/);
        if (m)
            return decodeURIComponent(m[1]);
        if (web)
            return '';
        try {
            const a = ctx.getActiveChat && ctx.getActiveChat();
            if (a && a.chatId)
                return String(a.chatId);
        }
        catch (_) { }
        return '';
    }
    let chatInfo = { id: '', kind: 'none', name: '' };
    let chatAsk = 0;
    async function readChat() {
        const id = activeChatId();
        if (id === chatInfo.id && chatInfo.kind !== 'unknown')
            return;
        const ask = ++chatAsk;
        if (!id) {
            chatInfo = { id: '', kind: 'none', name: '' };
            paintChat();
            return;
        }
        chatInfo = { id, kind: 'unknown', name: '' };
        paintChat();
        try {
            const res = await api('/chats/' + encodeURIComponent(id) + '?messages=false');
            if (ask !== chatAsk)
                return;
            if (!res.ok) {
                chatInfo = { id, kind: 'chat', name: '' };
            }
            else {
                const c = await res.json();
                const meta = (c && c.metadata) || {};
                // Lumiverse titles a new chat with the date and time it was made.
                // That title says nothing about who the chat is with, so the
                // character's name is shown, and the title only when it was changed.
                const title = String((c && c.name) || '').trim();
                const own = title && !looksLikeDate(title) ? title : '';
                const group = meta.group === true || meta.group === 1;
                const ids = group && Array.isArray(meta.character_ids) ? meta.character_ids.filter((x) => typeof x === 'string' && x) : c && c.character_id ? [String(c.character_id)] : [];
                const names = [];
                for (const cid of ids.slice(0, 3)) {
                    try {
                        const cr = await api('/characters/' + encodeURIComponent(cid));
                        if (cr.ok) {
                            const n = String(((await cr.json()) || {}).name || '').trim();
                            if (n)
                                names.push(n);
                        }
                    }
                    catch (_) { }
                }
                if (ask !== chatAsk)
                    return;
                const more = ids.length - names.length;
                const who = names.length ? names.join(names.length === 2 && !more ? ' and ' : ', ') + (more > 0 ? ' and ' + more + ' more' : '') : '';
                chatInfo = { id, kind: meta.temporary === true ? 'temporary' : 'chat', name: who, title: own, group };
            }
        }
        catch (_) {
            if (ask !== chatAsk)
                return;
            chatInfo = { id, kind: 'chat', name: '' };
        }
        paintChat();
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
    // The parts of the last message that could not be played, for Try the
    // failed parts again.
    let lastFailed = null;
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
        if (!conn || pickOf(m, conn).voice)
            return;
        const got = await loadVoices(conn.id);
        if (!got.voices.length)
            return;
        const used = new Set((S.cast || []).map((c) => pickOf(c, conn).voice).filter(Boolean));
        if (conn.voice)
            used.add(conn.voice);
        const free = got.voices.filter((v) => !used.has(v.id));
        const fits = free.filter((v) => m.gender !== 'unknown' && String(v.gender || '').toLowerCase() === m.gender);
        const pickFrom = fits.length ? fits : free.length ? free : got.voices;
        const v = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        if (!v)
            return;
        setPick(m, conn, { voice: String(v.id), voiceName: String(v.name || v.id) });
        save();
        log(m.name + ' now has the voice ' + (v.name || v.id) + '. You can change it in the Cast tab.');
    }
    function buildItems(script) {
        const items = [];
        // The audience cheers for the AI's characters, for you, or both. Whose a
        // line is comes from the cast: a persona is you.
        const cheersFor = (who, mine) => {
            if (!S.applauseOn)
                return false;
            const yours = who ? who.kind === 'persona' : mine;
            return yours ? !!S.applauseForUser : !!S.applauseForAi;
        };
        for (const line of script.lines) {
            if (line.before && S.soundsOn)
                items.push({ kind: 'sound', line, sound: line.before, at: line.i });
            const isNarr = line.kind === 'narration';
            const who = isNarr ? narratorMember() : memberFor(line.speaker);
            const mutedPerson = who && who.muted;
            const spoken = !(isNarr && S.narration !== 'read') && !mutedPerson;
            if (spoken)
                items.push({ kind: 'voice', line, at: line.i });
            if (line.after && S.soundsOn)
                items.push({ kind: 'sound', line, sound: line.after, at: line.i });
            if (spoken && !isNarr && cheersFor(who, !!script.isUser)) {
                if (S.applauseWhen === 'big' && line.big)
                    items.push({ kind: 'applause', line, at: line.i });
            }
        }
        if (S.applauseWhen === 'message' && items.length && cheersFor(memberFor(script.author), !!script.isUser)) {
            const last = script.lines[script.lines.length - 1];
            items.push({ kind: 'applause', line: last, at: last.i });
        }
        return items;
    }
    // The cheer: the built-in recording, or a sound from your library.
    async function makeApplauseClip() {
        if (S.applauseSound) {
            try {
                const got = await rpc({ type: 'sound_play', id: S.applauseSound }, 20000);
                if (got && got.base64)
                    return { blob: base64ToBlob(got.base64, got.mime) };
                log('The applause sound picked is not in your library any more, so the built-in cheer plays instead.', 'bad');
            }
            catch (_) { }
        }
        return { blob: base64ToBlob(APPLAUSE_MP3, 'audio/mpeg') };
    }
    // What is sent to speak a line, and the fingerprint its kept audio is
    // found by. Someone the AI added gets a voice first.
    async function voiceRequest(line) {
        const isNarr = line.kind === 'narration';
        const m = isNarr ? narratorMember() : memberFor(line.speaker);
        const conn = connOf(m);
        if (!conn)
            return { why: ttsWhy || 'Pick your TTS connection in the Settings tab.' };
        if (m && m.kind === 'npc' && !pickOf(m, conn).voice)
            await voiceForNew(m, conn);
        const pick = pickOf(m, conn);
        const model = pick.model || conn.model || '';
        const eng = engineFor(conn, model);
        if (!eng.supported)
            return { why: noTagsWhy(conn, model) };
        const text = textFor(line, eng);
        const style = styleFor(line, eng);
        const provider = String(conn.provider || '').toLowerCase();
        const params = {};
        const speed = m ? Number(m.speed) || 1 : 1;
        if (eng.eleven) {
            params.use_speaker_boost = true;
            if (m) {
                params.stability = stabilityFor(model, m.stability, line.big);
                params.similarity_boost = m.similarity;
                params.style = m.style;
                params.speed = speed;
            }
        }
        else if (speed !== 1 && provider !== 'google_tts' && provider !== 'google_vertex_tts') {
            params.speed = speed;
        }
        // Gemini takes it as its speech style. With nothing to say, the
        // connection's own speech style is used.
        if (style)
            params.speech_style = style;
        const body = { connectionId: conn.id, text, parameters: params };
        if (pick.voice)
            body.voice = pick.voice;
        if (pick.model)
            body.model = pick.model;
        const sig = fingerprint(JSON.stringify([conn.id, conn.model || '', conn.voice || '', body]));
        return { body, sig, conn };
    }
    async function makeVoiceClip(line, signal, onWait) {
        const req = await voiceRequest(line);
        if (!req.body)
            return { why: req.why };
        const body = req.body;
        const conn = req.conn;
        const who = serviceName(conn);
        // A line made before with everything the same is played from the audio
        // kept in the account, and nothing is spent.
        const sig = S.keepAudio ? req.sig || '' : '';
        if (sig) {
            try {
                // Kept short: a backend that does not answer must not hold up the line.
                const r = await rpc({ type: 'clip_get', sig }, 5000);
                if (r && r.found && r.base64) {
                    keptUsed++;
                    return { blob: base64ToBlob(r.base64, r.mime || 'audio/mpeg') };
                }
            }
            catch (_) { }
        }
        const what = 'Speaking line ' + (line.i + 1);
        // A busy voice service, or a connection that dropped, is waited out up
        // to Wait out a provider that will not take the call. A refused key or an
        // empty account is said at once, since waiting cannot change it.
        for (let wait = 0;; wait++) {
            let raw = '';
            let why = '';
            try {
                const res = await fetchImpl(API + '/tts/synthesize', {
                    method: 'POST',
                    credentials: 'include',
                    signal,
                    headers: { 'Content-Type': 'application/json', Accept: 'audio/*' },
                    body: JSON.stringify(body),
                });
                if (res.ok) {
                    const blob = await res.blob();
                    if (blob.size) {
                        if (sig)
                            keepClip(sig, blob);
                        return { blob };
                    }
                    why = who.charAt(0).toUpperCase() + who.slice(1) + ' sent back no sound for line ' + (line.i + 1) + '.';
                    raw = 'empty';
                }
                else {
                    const t = await readTrouble(res, what, who);
                    why = t.why;
                    raw = t.raw;
                }
            }
            catch (e) {
                if (e && e.name === 'AbortError')
                    return { why: netTrouble(e, what) };
                why = netTrouble(e, what);
                raw = 'network error';
            }
            // An account out of credits reads like a busy one to the shared rules,
            // since some services word it as a quota. It is said at once.
            const kind = /quota|credits?|exceeds your/i.test(raw) ? 'hard' : raw === 'empty' ? 'wait' : errorKind(raw);
            if (kind !== 'wait' || wait >= (Number(S.rateWaits) || 0))
                return { why };
            const ms = Math.min(30000, rateWait(wait + 1, raw));
            if (onWait)
                onWait(ms, wait + 1);
            log(who.charAt(0).toUpperCase() + who.slice(1) + ' is busy for line ' + (line.i + 1) + '. Trying again in ' + Math.round(ms / 1000) + ' s (wait ' + (wait + 1) + ' of ' + S.rateWaits + ').');
            const went = await pause(ms, signal);
            if (onWait)
                onWait(0, 0);
            if (!went)
                return { why: what + ' was stopped.' };
        }
    }
    // How many lines of the show playing came from kept audio, for the Log.
    let keptUsed = 0;
    let keptWarned = false;
    async function keepClip(sig, blob) {
        try {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const r = await rpc({ type: 'clip_put', sig, mime: blob.type || 'audio/mpeg', base64: bytesToBase64(bytes) }, 30000);
            if (r && r.ok === false && r.error && !keptWarned) {
                keptWarned = true;
                log(r.error, 'bad');
            }
        }
        catch (_) { }
    }
    // Waits, and answers false when the wait was called off by Stop.
    function pause(ms, signal) {
        return new Promise((done) => {
            if (signal && signal.aborted)
                return done(false);
            const t = setTimeout(() => {
                timers.delete(t);
                done(true);
            }, ms);
            timers.add(t);
            if (signal)
                signal.addEventListener('abort', () => {
                    clearTimeout(t);
                    timers.delete(t);
                    done(false);
                });
        });
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
            p =
                it.kind === 'voice'
                    ? makeVoiceClip(it.line, sh.abort.signal, (ms, n) => {
                        if (ms)
                            sh.waiting.set(k, { until: Date.now() + ms, n });
                        else
                            sh.waiting.delete(k);
                        if (show === sh && sh.index === k)
                            paintStage();
                    })
                    : it.kind === 'applause'
                        ? makeApplauseClip()
                        : makeSoundClip(it.sound || '');
            sh.clips.set(k, p);
            if (it.kind === 'voice')
                p.then((r) => {
                    if (r && r.blob)
                        voicedOf(r.blob).then((v) => {
                            if (v)
                                sh.voiced.set(k, v);
                        });
                });
        }
        return p;
    }
    // Reads which parts of a clip are voiced. An offline audio context decodes
    // without asking to play, so it needs no tap first. Any failure leaves the
    // words spread over the clip by length.
    async function voicedOf(blob) {
        try {
            const w = window;
            const Off = w.OfflineAudioContext || w.webkitOfflineAudioContext;
            if (!Off || !blob || typeof blob.arrayBuffer !== 'function')
                return null;
            const data = await blob.arrayBuffer();
            const ctxA = new Off(1, 1, 44100);
            const buf = await new Promise((done, fail) => {
                const r = ctxA.decodeAudioData(data, done, fail);
                if (r && typeof r.then === 'function')
                    r.then(done, fail);
            });
            if (!buf || !buf.length)
                return null;
            return voicedFrames(buf.getChannelData(0), buf.sampleRate);
        }
        catch (_) {
            return null;
        }
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
            phase = paused ? 'Paused' : sh.items[at].kind === 'voice' ? 'Speaking' : sh.items[at].kind === 'applause' ? 'The audience cheers' : 'Playing a sound';
            paintStage();
            const got = await clipFor(sh, at);
            if (show !== sh)
                return;
            if (sh.index !== at)
                continue;
            if (!got.blob) {
                sh.failed.push(at);
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
            // The cheer is not saved with the message: it is the audience, not
            // the performance.
            if (how === 'ended' && sh.items[at].kind !== 'applause')
                sh.played.push({ blob: got.blob });
            if (sh.jumped) {
                sh.jumped = false;
                continue;
            }
            if (sh.index === at)
                sh.index++;
        }
        if (show === sh) {
            sh.complete = sh.played.length === sh.items.filter((x) => x.kind !== 'applause').length;
            if (keptUsed)
                log(keptUsed + (keptUsed === 1 ? ' line was' : ' lines were') + ' played from audio kept from before, so nothing was spent on ' + (keptUsed === 1 ? 'it.' : 'them.'));
            keptUsed = 0;
            lastFailed = sh.failed.length ? { script: sh.script, meta: { chatId: sh.chatId, messageId: sh.messageId, swipeId: sh.swipeId }, items: sh.failed.map((k) => sh.items[k]) } : null;
            stop(sh.failed.length ? 'Finished. ' + sh.failed.length + (sh.failed.length === 1 ? ' part' : ' parts') + ' could not be played. The Log says why.' : 'Finished');
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
            el.volume = kind === 'voice' ? (muted.voice ? 0 : S.voiceVolume) : muted.sound ? 0 : kind === 'applause' ? S.soundVolume * S.applauseVolume : S.soundVolume;
            if (kind === 'applause')
                fadeApplause(el);
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
            theaterRun();
        });
    }
    // The cheer plays for How long the audience cheers, then fades over most of
    // a second and ends, so a long recording never holds up the next part.
    function fadeApplause(el) {
        const isLive = () => audio === el || preview === el;
        const full = el.volume;
        const holdMs = Math.max(1, Number(S.applauseSeconds) || 5) * 1000;
        const FADE = 900;
        const t = setTimeout(() => {
            timers.delete(t);
            const began = Date.now();
            const step = setInterval(() => {
                if (!isLive() || (audio === el && paused)) {
                    if (!isLive())
                        clearInterval(step);
                    return;
                }
                const k = Math.min(1, (Date.now() - began) / FADE);
                el.volume = full * (1 - k);
                if (k >= 1) {
                    clearInterval(step);
                    try {
                        el.pause();
                    }
                    catch (_) { }
                    if (el.onended)
                        el.onended();
                }
            }, 50);
            disposers.push(() => clearInterval(step));
        }, holdMs);
        timers.add(t);
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
    // Back one line, or to the start of this one when it has played a while.
    function back() {
        if (!show)
            return;
        const t = audio ? Number(audio.currentTime) || 0 : 0;
        const to = t > 1.5 ? show.index : Math.max(0, show.index - 1);
        show.index = to;
        show.jumped = true;
        paused = false;
        stopAudio();
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
    function startShow(script, meta, fromLine, only) {
        stop();
        lastScript = script;
        lastMeta = meta;
        lastFailed = null;
        const items = only && only.length ? only : buildItems(script);
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
        keptUsed = 0;
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
            waiting: new Map(),
            voiced: new Map(),
            failed: [],
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
        // The Director writes for the engine of Auto Foley's connection. Each
        // line is fitted again to the engine that speaks it, when a person in the
        // cast uses another one.
        if (!activeConnection())
            await loadTtsConnections();
        const eng = mainEngine();
        if (!eng.supported)
            return { why: noTagsWhy(activeConnection()) };
        const engine = { id: eng.id, label: eng.label, tags: eng.tags, list: eng.list, style: eng.style, inVoiceSounds: eng.inVoiceSounds, sing: !!(eng.singTag || eng.singStyle) };
        const key = messageId + ':' + swipeId + ':' + eng.id + (fresh ? ':fresh' : '');
        let p = preparing.get(key);
        if (!p) {
            p = rpc({ type: 'direct', chatId, messageId, swipeId, text: String(m.content || ''), name: String(m.name || ''), isUser: !!m.is_user, fresh, engine }, 150000);
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
    // The button on every message, and in the chat's own row of buttons
    // ---------------------------------------------------------------------------
    // The host leaves empty mount points in its own rows for extensions, each
    // carrying the chat or message it belongs to in its scope. A message has two,
    // and which one it carries depends on the display mode. The row of buttons
    // is the place to join, so a message has one row of things to do with it.
    // The footer is the fallback for a mode that lays no row out. This is the
    // same way Auto Refine places its button.
    const BAR_SLOT = '[data-spindle-mount="chat_actions"]';
    const MSG_ACTIONS = '[data-spindle-mount="message_actions"]';
    const MSG_FOOT = '[data-spindle-mount="message_footer"]';
    const MSG_SLOT = MSG_ACTIONS + ',' + MSG_FOOT;
    const SETTLE_MS = 260;
    function slotId(node) {
        const parts = String(node.getAttribute('data-spindle-scope') || '').split(':');
        return parts.length > 1 && parts[1] ? String(parts[1]) : '';
    }
    // The row the host puts a message's own buttons in. The bubble mode marks it
    // with a component name. The other mode is found from its Edit button.
    function actionBar(msg) {
        try {
            const pill = msg.querySelector('[data-component="BubbleActions"]');
            if (pill)
                return pill;
            const edit = msg.querySelector('button[title="Edit"]');
            if (edit && edit.parentElement)
                return edit.parentElement;
        }
        catch (_) { }
        return null;
    }
    // While a message is open for editing, its row of buttons is gone and there
    // is nothing for this button to do.
    function beingEdited(msg) {
        try {
            return !!msg.querySelector('[data-spindle-mount="message_edit_actions"],textarea[name="message-edit-content"],textarea,[contenteditable="true"]');
        }
        catch (_) { }
        return false;
    }
    // The first of the host's own buttons in a row, to copy the look from. The
    // last is often a delete with a warning color of its own.
    function hostButton(bar) {
        try {
            const all = bar.querySelectorAll('button');
            for (let i = 0; i < all.length; i++) {
                const one = all[i];
                if (!one.hasAttribute('data-af-slot') && !one.closest(OTHER_UI))
                    return one;
            }
        }
        catch (_) { }
        return null;
    }
    // Wears the host button's class and its icon's size, read off the live
    // button, since the host's class names carry a build hash. A theme then
    // reaches this button the same way it reaches the host's own.
    function dressLikeHost(b, like) {
        if (!like)
            return false;
        try {
            const worn = String(like.className || '');
            if (worn)
                b.className = worn;
            const ours = b.querySelector('svg');
            const theirs = like.querySelector('svg');
            if (ours && theirs) {
                for (const k of ['width', 'height', 'stroke-width']) {
                    const v = theirs.getAttribute(k);
                    if (v)
                        ours.setAttribute(k, v);
                }
            }
            return true;
        }
        catch (_) { }
        return false;
    }
    function slotButton(kind, run, like) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-af-slot', kind);
        b.innerHTML = ICON;
        if (!dressLikeHost(b, like))
            b.className = 'af-slot';
        b.addEventListener('click', (e) => {
            try {
                e.preventDefault();
                e.stopPropagation();
            }
            catch (_) { }
            run();
        });
        return b;
    }
    // What each button says and shows, from whether its message is playing.
    function paintButtons() {
        paintFloat();
        syncExtras();
        let found = null;
        try {
            found = document.querySelectorAll('[data-af-slot]');
        }
        catch (_) {
            return;
        }
        for (let i = 0; i < found.length; i++) {
            const b = found[i];
            const kind = b.getAttribute('data-af-slot') || '';
            const id = kind === 'bar' ? (show ? show.messageId : '') : b.getAttribute('data-af-message') || '';
            const playing = !!show && !!id && show.messageId === id;
            const busy = !!busyMessage && (kind === 'bar' || busyMessage === id);
            const said = busy
                ? 'Auto Foley is directing this message. Press to stop.'
                : playing && !paused
                    ? 'Stop Auto Foley'
                    : playing && paused
                        ? 'Play with Auto Foley'
                        : kind === 'bar'
                            ? 'Perform the latest reply with Auto Foley'
                            : 'Perform this message with Auto Foley';
            if (b.title !== said) {
                b.title = said;
                b.setAttribute('aria-label', said);
            }
            const icon = playing && !paused ? 'stop' : 'mic';
            if (b.getAttribute('data-af-icon') !== icon) {
                b.setAttribute('data-af-icon', icon);
                const size = b.querySelector('svg');
                const w = size ? size.getAttribute('width') : null;
                const h = size ? size.getAttribute('height') : null;
                b.innerHTML = icon === 'stop' ? ICON_STOP : ICON;
                const fresh = b.querySelector('svg');
                if (fresh) {
                    fresh.setAttribute('width', w || '16');
                    fresh.setAttribute('height', h || w || '16');
                }
            }
            if (playing || busy)
                b.setAttribute('aria-busy', 'true');
            else
                b.removeAttribute('aria-busy');
        }
    }
    function pressMessage(id) {
        if (busyMessage === id) {
            busyMessage = '';
            phase = 'Stopped';
            paintButtons();
            if (tab === 'stage')
                renderTab();
            return;
        }
        if (show && show.messageId === id && paused)
            togglePause();
        else
            perform(id);
    }
    // The newest reply in the chat on screen, for the button in the chat's row.
    async function latestReplyId() {
        const chatId = activeChatId();
        if (!chatId)
            return '';
        try {
            const res = await api('/chats/' + encodeURIComponent(chatId) + '/messages?tail=true&limit=20');
            if (!res.ok)
                return '';
            const j = await res.json();
            const list = Array.isArray(j && j.data) ? j.data : [];
            for (let k = list.length - 1; k >= 0; k--)
                if (list[k] && !list[k].is_user)
                    return String(list[k].id);
        }
        catch (_) { }
        return '';
    }
    async function pressBar() {
        if (show || busyMessage) {
            if (busyMessage)
                busyMessage = '';
            stop('Stopped');
            return;
        }
        const id = await latestReplyId();
        if (id)
            perform(id);
        else {
            phase = 'There is no reply in this chat to perform.';
            log(phase);
            if (!drawerOpen())
                notify('info', 'Auto Foley found no reply in this chat to perform.');
            if (tab === 'stage')
                renderTab();
        }
    }
    let filling = false;
    let openEditors = [];
    let slotEye = null;
    let slotTimer = null;
    function fillSlots() {
        if (typeof document === 'undefined')
            return;
        const wantBar = !!S.enabled && !!S.barButton;
        const wantMsg = !!S.enabled && !!S.messageButton;
        filling = true;
        try {
            if (!wantBar || !wantMsg) {
                const stale = document.querySelectorAll('[data-af-slot]');
                for (let i = 0; i < stale.length; i++) {
                    const one = stale[i];
                    const kind = String(one.getAttribute('data-af-slot') || '');
                    if (kind === 'bar' ? wantBar : wantMsg)
                        continue;
                    const row = one.parentElement;
                    try {
                        one.remove();
                        if (row && row.classList.contains('af-slot-row'))
                            row.remove();
                    }
                    catch (_) { }
                }
            }
            const editors = [];
            if (wantBar) {
                const bar = document.querySelector(BAR_SLOT);
                if (bar && !bar.closest(OTHER_UI) && !bar.querySelector('[data-af-slot="bar"]')) {
                    bar.appendChild(slotButton('bar', () => pressBar(), hostButton(bar.parentElement || bar)));
                }
            }
            if (wantMsg) {
                const slots = document.querySelectorAll(MSG_SLOT);
                const picked = {};
                for (let i = 0; i < slots.length; i++) {
                    const slot = slots[i];
                    if (slot.closest(OTHER_UI))
                        continue;
                    const id = slotId(slot);
                    if (!id || picked[id])
                        continue;
                    picked[id] = slot;
                }
                for (const id in picked) {
                    const slot = picked[id];
                    const msg = slot.closest ? slot.closest('[data-message-id]') || slot.parentElement : slot.parentElement;
                    if (msg && beingEdited(msg)) {
                        editors.push(msg);
                        try {
                            msg.querySelectorAll('[data-af-slot]').forEach((n) => n.remove());
                            msg.querySelectorAll('.af-slot-row').forEach((n) => n.remove());
                        }
                        catch (_) { }
                        continue;
                    }
                    const bar = msg ? actionBar(msg) : null;
                    let into;
                    let like = null;
                    if (bar) {
                        like = hostButton(bar);
                        into = bar.querySelector(MSG_ACTIONS) || bar;
                    }
                    else {
                        let row = slot.querySelector('.af-slot-row');
                        if (!row) {
                            row = document.createElement('div');
                            row.className = 'af-slot-row';
                            slot.appendChild(row);
                        }
                        into = row;
                    }
                    // A change of display mode can leave a button behind somewhere else
                    // on the same message.
                    if (msg)
                        try {
                            msg.querySelectorAll('[data-af-slot]').forEach((n) => {
                                if (n.parentElement !== into)
                                    n.remove();
                            });
                            msg.querySelectorAll('.af-slot-row').forEach((n) => {
                                if (n !== into && !n.querySelector('[data-af-slot]'))
                                    n.remove();
                            });
                        }
                        catch (_) { }
                    if (!into.querySelector('[data-af-slot="message"]')) {
                        const b = slotButton('message', () => pressMessage(id), like);
                        b.setAttribute('data-af-message', id);
                        into.appendChild(b);
                    }
                }
            }
            openEditors = editors;
            paintButtons();
        }
        catch (_) {
        }
        finally {
            filling = false;
        }
    }
    function fillSlotsSoon() {
        if (slotTimer)
            return;
        slotTimer = setTimeout(() => {
            slotTimer = null;
            fillSlots();
        }, SETTLE_MS);
    }
    function editorClosed() {
        for (const msg of openEditors) {
            try {
                if (!msg.isConnected || !beingEdited(msg))
                    return true;
            }
            catch (_) {
                return true;
            }
        }
        return false;
    }
    // Keeps the buttons in step with the page. The host redraws messages as the
    // chat scrolls and as replies arrive, and a button has to follow.
    function syncSlots() {
        const want = !!S.enabled && (!!S.barButton || !!S.messageButton);
        if (want && !slotEye) {
            try {
                slotEye = new MutationObserver(() => {
                    if (filling)
                        return;
                    if (openEditors.length && editorClosed()) {
                        if (slotTimer) {
                            clearTimeout(slotTimer);
                            slotTimer = null;
                        }
                        fillSlots();
                        return;
                    }
                    fillSlotsSoon();
                });
                if (document.body)
                    slotEye.observe(document.body, { childList: true, subtree: true });
            }
            catch (_) {
                slotEye = null;
            }
        }
        else if (!want && slotEye) {
            try {
                slotEye.disconnect();
            }
            catch (_) { }
            slotEye = null;
        }
        fillSlots();
    }
    disposers.push(() => {
        if (slotTimer)
            clearTimeout(slotTimer);
        slotTimer = null;
        try {
            if (slotEye)
                slotEye.disconnect();
        }
        catch (_) { }
        slotEye = null;
        try {
            document.querySelectorAll('[data-af-slot]').forEach((n) => n.remove());
            document.querySelectorAll('.af-slot-row').forEach((n) => n.remove());
        }
        catch (_) { }
    });
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
    let lastChat = '';
    const onChat = () => {
        const now = activeChatId();
        if (now === lastChat)
            return;
        lastChat = now;
        if (show && show.chatId && show.chatId !== now)
            stop('Stopped, because the chat changed');
        if (busyMessage)
            busyMessage = '';
        lastScript = null;
        lastFailed = null;
        readChat();
        fillSlotsSoon();
        if (tab === 'stage')
            renderTab();
    };
    // Lumiverse publishes the active chat for extensions to watch. Leaving for
    // the home screen is announced by no event in some builds, so the address is
    // also looked at once a second: one string compared, nothing else.
    try {
        if (ctx.state && typeof ctx.state.subscribe === 'function')
            disposers.push(ctx.state.subscribe('chat.active', () => onChat()));
    }
    catch (_) { }
    {
        const watch = setInterval(() => onChat(), 1000);
        disposers.push(() => clearInterval(watch));
    }
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
            description: 'Voice acting and sound effects for your TTS',
            keywords: ['tts', 'voice', 'elevenlabs', 'fish audio', 'gemini', 'chatterbox', 'sound effects', 'audio', 'foley', 'speech', 'narrator'],
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
                readChat();
                renderTab();
                readGranted();
            }));
        }
    }
    catch (e) {
        log('The Auto Foley drawer tab could not be added. Lumiverse allows a limited number of drawer tabs, and other extensions may have taken them all.', 'bad');
    }
    function drawerOpen() {
        if (!root.isConnected)
            return false;
        const r = root.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    const calm = () => !!S.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Reduce motion is marked on the page, since a hint opens outside the panel.
    function paintStill() {
        try {
            if (S.reduceMotion)
                document.documentElement.setAttribute('data-af-still', '');
            else
                document.documentElement.removeAttribute('data-af-still');
        }
        catch (_) { }
    }
    disposers.push(() => {
        try {
            document.documentElement.removeAttribute('data-af-still');
        }
        catch (_) { }
    });
    root.innerHTML =
        '<div class="af-head"><div class="af-brand"><div class="af-brand-icon">' + ICON + '</div><div style="min-width:0">' +
            '<div class="af-brand-name">Auto Foley</div><div class="af-brand-sub">Voice acting and sound effects for your TTS</div></div></div>' +
            '<span class="af-pill" data-af="pill"></span></div>' +
            '<div class="af-chatline" data-af="chatline"><span class="af-dot"></span><span></span></div>' +
            '<div class="af-stick" data-af-stick><div class="af-tabs" role="tablist">' +
            TABS.map((t) => '<button type="button" class="af-tab" role="tab" data-tab="' + t.id + '">' + t.label + '</button>').join('') +
            '</div></div><div class="af-page" data-af="page" role="tabpanel"></div>';
    const page = root.querySelector('[data-af="page"]');
    const pill = root.querySelector('[data-af="pill"]');
    const chatline = root.querySelector('[data-af="chatline"]');
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
            hideHint();
            switchTab();
        });
    });
    // A new tab is drawn with the tab bar left where it is on screen, the same
    // as in Auto Refine. Scrolled down, with the bar held at the top, the new
    // tab starts right under the bar. With the bar in its own place, the scroll
    // is left as it is. The page keeps enough height for the bar to stay where
    // it was, so a short tab does not pull the panel back down.
    function switchTab() {
        const box = root.isConnected ? scrollBoxOf(root) : null;
        const stick = root.querySelector('[data-af-stick]');
        if (!box || !stick) {
            renderTab();
            return;
        }
        // Lumiverse's UI Scale: rectangles are read in zoomed pixels, and the
        // scroll and the height are written in CSS pixels.
        const zoom = box.offsetHeight ? box.getBoundingClientRect().height / box.offsetHeight || 1 : 1;
        const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
        const boxTop = box.getBoundingClientRect().top;
        const barBottom = stick.getBoundingClientRect().bottom;
        const pageTop = page.getBoundingClientRect().top;
        const target = Math.max(0, box.scrollTop + (pageTop - barBottom) / zoom - gap);
        page.style.minHeight = Math.ceil(box.clientHeight - (barBottom - boxTop) / zoom - gap) + 'px';
        renderTab();
        box.scrollTop = target;
    }
    function paintHead() {
        paintStill();
        paintLook();
        pill.dataset.on = S.enabled ? 'true' : 'false';
        pill.textContent = S.enabled ? 'On' : 'Off';
        root.querySelectorAll('.af-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
        paintChat();
    }
    // Which chat is on screen, under the title.
    function paintChat() {
        if (!chatline)
            return;
        const dot = chatline.firstElementChild;
        const words = chatline.lastElementChild;
        const k = chatInfo.kind;
        dot.dataset.state = k === 'chat' ? 'chat' : k === 'temporary' ? 'temporary' : 'none';
        words.textContent =
            k === 'none'
                ? 'No chat open. Open a chat to perform its messages.'
                : k === 'temporary'
                    ? 'A temporary chat. Messages can be performed, and nothing is kept when it closes.'
                    : k === 'unknown'
                        ? 'Reading which chat this is…'
                        : chatInfo.name
                            ? (chatInfo.group ? 'Group chat with ' : 'Chat with ') + chatInfo.name + (chatInfo.title ? ': ' + chatInfo.title : '') + '.'
                            : chatInfo.title
                                ? 'Chat: ' + chatInfo.title + '.'
                                : 'A chat is open.';
    }
    // ---- the "?" beside a setting ----
    // A mouse opens it on hover, a keyboard on focus, a finger on a tap. Which
    // one is happening is read from each event, since a phone can claim it
    // hovers. The description fades and slides 4 pixels, and goes on a tap
    // anywhere else, a scroll, Escape, or the screen changing size.
    let hintPop = null;
    let hintAnchor = null;
    let lastPointer = '';
    const HINT_FADE = 140;
    function hideHint() {
        const going = hintPop;
        const was = hintAnchor;
        hintPop = null;
        hintAnchor = null;
        if (was)
            was.setAttribute('aria-expanded', 'false');
        if (!going)
            return;
        going.removeAttribute('data-af-open');
        const t = setTimeout(() => {
            timers.delete(t);
            going.remove();
        }, calm() ? 0 : HINT_FADE + 40);
        timers.add(t);
    }
    function showHint(anchor, text) {
        hideHint();
        const box = document.createElement('div');
        box.className = 'af-hint';
        box.setAttribute('role', 'tooltip');
        box.textContent = text;
        box.style.left = '0';
        box.style.top = '-9999px';
        (document.body || document.documentElement).appendChild(box);
        const vw = window.innerWidth || 360;
        const vh = window.innerHeight || 640;
        // Placed against the whole row, so it never covers the setting itself.
        const row = anchor.closest('[data-af-row]') || anchor;
        const r = row.getBoundingClientRect();
        const want = Math.min(300, r.width > 180 ? Math.min(r.width, vw - 24) : vw - 24);
        box.style.width = want + 'px';
        // Lumiverse's UI Scale zooms the page, so a width written in CSS pixels
        // is drawn larger or smaller. It is measured once and written again.
        const first = box.getBoundingClientRect();
        const zoom = first.width && want ? first.width / want : 1;
        if (zoom > 0.01 && Math.abs(zoom - 1) > 0.01)
            box.style.width = Math.floor(want / zoom) + 'px';
        const got = box.getBoundingClientRect();
        const h = got.height;
        const w = got.width;
        const GAP = 6;
        const EDGE = 12;
        const left = Math.max(EDGE, Math.min(r.left, vw - w - EDGE));
        const under = Math.max(0, vh - EDGE - (r.bottom + GAP));
        const over = Math.max(0, r.top - GAP - EDGE);
        const above = over >= Math.min(h, under);
        const room = above ? over : under;
        const top = above ? Math.max(EDGE, r.top - GAP - Math.min(h, room)) : r.bottom + GAP;
        if (h > room) {
            box.style.maxHeight = Math.floor(room / (zoom > 0.01 ? zoom : 1)) + 'px';
            box.style.overflowY = 'auto';
            box.style.overscrollBehavior = 'contain';
        }
        box.style.left = left / (zoom || 1) + 'px';
        box.style.top = top / (zoom || 1) + 'px';
        if (!calm()) {
            box.setAttribute('data-af-from', above ? 'over' : 'under');
            void box.offsetWidth;
            box.setAttribute('data-af-moving', '');
        }
        void box.offsetWidth;
        box.setAttribute('data-af-open', '');
        box.addEventListener('click', () => hideHint());
        hintPop = box;
        hintAnchor = anchor;
        anchor.setAttribute('aria-expanded', 'true');
    }
    const fromMouse = (e) => {
        const t = e && e.pointerType;
        if (t)
            return t === 'mouse';
        if (lastPointer)
            return lastPointer === 'mouse';
        try {
            return matchMedia('(hover: hover)').matches;
        }
        catch (_) {
            return false;
        }
    };
    function hintButton(text, label) {
        const say = String(text || '').trim();
        if (!say)
            return null;
        const q = document.createElement('button');
        q.type = 'button';
        q.className = 'af-q';
        q.textContent = '?';
        q.setAttribute('aria-label', 'What ' + label + ' does');
        q.setAttribute('aria-expanded', 'false');
        q.setAttribute('data-af-hint', '');
        q.addEventListener('mouseenter', (e) => {
            if (fromMouse(e))
                showHint(q, say);
        });
        q.addEventListener('mouseleave', (e) => {
            if (fromMouse(e) && hintAnchor === q)
                hideHint();
        });
        // Focus opens it only when a key put you there. A tap focuses the button
        // too, so opening from focus as well would open it on the press and close
        // it again on the click, and the first tap would show nothing. Blur closes
        // only what focus opened, so a finger reading the popover keeps it open.
        let byFocus = false;
        q.addEventListener('focus', () => {
            let byKey = true;
            try {
                byKey = q.matches(':focus-visible');
            }
            catch (_) { }
            if (!byKey)
                return;
            byFocus = true;
            if (hintAnchor !== q)
                showHint(q, say);
        });
        q.addEventListener('blur', () => {
            if (!byFocus)
                return;
            byFocus = false;
            if (hintAnchor === q)
                hideHint();
        });
        q.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // On a mouse, hover has it open already. On touch, each tap toggles.
            if (fromMouse(e))
                return;
            if (hintAnchor === q)
                hideHint();
            else
                showHint(q, say);
        });
        return q;
    }
    {
        const noteKind = (e) => {
            if (e && e.pointerType)
                lastPointer = e.pointerType;
        };
        const onDown = (e) => {
            noteKind(e);
            if (!hintPop)
                return;
            const t = e && e.target;
            if (t && t.closest && (t === hintAnchor || t.closest('[data-af-hint]')))
                return;
            if (t && hintPop.contains(t))
                return;
            hideHint();
        };
        const onScroll = (e) => {
            if (!hintPop)
                return;
            const t = e && e.target;
            if (t && hintPop.contains && hintPop.contains(t))
                return;
            hideHint();
        };
        const onKey = (e) => {
            if (e && e.key === 'Escape')
                hideHint();
        };
        const onResize = () => hideHint();
        document.addEventListener('pointermove', noteKind, true);
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('scroll', onScroll, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
        disposers.push(() => {
            document.removeEventListener('pointermove', noteKind, true);
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('scroll', onScroll, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onResize);
            if (hintPop)
                hintPop.remove();
            hintPop = null;
        });
    }
    // ---- small builders ----
    function el(html) {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    }
    // A card, with its title and an optional line of plain words under it.
    function card(title, note, extraHead) {
        const c = el('<section class="af-card"><h3 class="af-cardh"><span>' + esc(title) + '</span>' + (extraHead || '') + '</h3></section>');
        if (note)
            c.appendChild(hint(note));
        return c;
    }
    // A line of plain words. Text given here is written by this file, and may
    // hold simple markup such as <b>.
    function hint(text) {
        return el('<p class="af-note">' + text + '</p>');
    }
    function notice(kind, text) {
        const sign = kind === 'good' ? '✓' : '!';
        const n = el('<div class="af-' + kind + '"><span class="af-sign">' + sign + '</span><span></span></div>');
        n.lastElementChild.textContent = text;
        return n;
    }
    // A setting's name, its "?", and anything that sits at the end of the row.
    function labelRow(label, help, forId, end) {
        const row = el('<div class="af-between"><div class="af-labrow af-grow"></div></div>');
        const left = row.firstElementChild;
        const lab = document.createElement(forId ? 'label' : 'span');
        lab.className = 'af-lab';
        if (forId)
            lab.setAttribute('for', forId);
        lab.textContent = label;
        left.appendChild(lab);
        const q = hintButton(help, label);
        if (q)
            left.appendChild(q);
        if (end)
            row.appendChild(end);
        return row;
    }
    // A switch. Only the switch flips it: the words beside it are not a second
    // way to press it, so running a finger along a row of settings changes
    // nothing by accident. When "under" is given, those rows sit straight under
    // the switch and open and close with it.
    function toggle(label, help, key, onChange, under) {
        const wrap = el('<div class="af-col"></div>');
        wrap.setAttribute('data-af-row', key);
        const id = rid('sw');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = id;
        box.className = 'af-box';
        box.setAttribute('role', 'switch');
        box.checked = !!S[key];
        const row = labelRow(label, help, undefined, box);
        const lab = row.querySelector('.af-lab');
        lab.id = id + '-name';
        box.setAttribute('aria-labelledby', lab.id);
        wrap.appendChild(row);
        let sub = null;
        if (under) {
            sub = el('<div class="af-sub"><div class="af-under"></div></div>');
            const inner = sub.firstElementChild;
            for (const r of under())
                inner.appendChild(r);
            sub.hidden = !S[key];
            wrap.appendChild(sub);
        }
        box.addEventListener('change', () => {
            set({ [key]: box.checked });
            if (sub)
                reveal(sub, box.checked);
            if (onChange)
                onChange(box.checked);
            if (key === 'enabled' || key === 'reduceMotion')
                paintHead();
        });
        return wrap;
    }
    // Opens or closes a part over several frames: its height moves, so the rows
    // under it move too, and it fades and slides 4 pixels. Overflow is hidden
    // only while it moves, so a focus ring or a box edge is never cut off once
    // it has settled. With reduce motion on, it appears and goes at once.
    function reveal(box, open) {
        const anyBox = box;
        if (anyBox._afAnim) {
            try {
                anyBox._afAnim.cancel();
            }
            catch (_) { }
            anyBox._afAnim = null;
        }
        const settle = () => {
            box.style.overflow = '';
            anyBox._afAnim = null;
        };
        if (calm() || typeof box.animate !== 'function') {
            box.hidden = !open;
            settle();
            return;
        }
        box.style.overflow = 'hidden';
        if (open) {
            box.hidden = false;
            const h = box.scrollHeight;
            anyBox._afAnim = box.animate([
                { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
                { height: h + 'px', opacity: 1, transform: 'none' },
            ], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
            anyBox._afAnim.onfinish = settle;
        }
        else {
            const h = box.scrollHeight;
            anyBox._afAnim = box.animate([
                { height: h + 'px', opacity: 1, transform: 'none' },
                { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
            ], { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' });
            anyBox._afAnim.onfinish = () => {
                box.hidden = true;
                settle();
            };
        }
    }
    // A dropdown. Options with a group are sorted under that heading, in the
    // order the groups first come, the same as Auto Refine's lists.
    function optionsHtml(options, value) {
        const one = (o) => '<option value="' + esc(o.id) + '"' + (o.id === value ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        let html = options.filter((o) => !o.group).map(one).join('');
        const groups = [];
        for (const o of options)
            if (o.group && groups.indexOf(o.group) < 0)
                groups.push(o.group);
        for (const g of groups)
            html += '<optgroup label="' + esc(g) + '">' + options.filter((o) => o.group === g).map(one).join('') + '</optgroup>';
        return html;
    }
    function select(label, options, value, onChange, help) {
        const id = rid('sel');
        const f = el('<div class="af-col"></div>');
        f.setAttribute('data-af-row', id);
        f.appendChild(labelRow(label, help || '', id));
        const wrap = el('<div class="af-selwrap"><select class="af-field" id="' + id + '">' + optionsHtml(options, value) + '</select></div>');
        const s = wrap.firstElementChild;
        s.addEventListener('change', () => onChange(s.value));
        f.appendChild(wrap);
        return f;
    }
    function segmented(label, options, value, onChange, help) {
        const f = el('<div class="af-col"></div>');
        f.setAttribute('data-af-row', rid('seg'));
        f.appendChild(labelRow(label, help || ''));
        const seg = el('<div class="af-seg" role="group"></div>');
        seg.setAttribute('aria-label', label);
        for (const o of options) {
            const b = el('<button type="button" class="af-segbtn" data-v="' + esc(o.id) + '" aria-pressed="' + (o.id === value ? 'true' : 'false') + '">' + esc(o.label) + '</button>');
            b.addEventListener('click', () => {
                seg.querySelectorAll('.af-segbtn').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
                onChange(o.id);
            });
            seg.appendChild(b);
        }
        f.appendChild(seg);
        return f;
    }
    function slider(label, value, min, max, step, show, onChange, help) {
        const id = rid('rg');
        const f = el('<div class="af-col"></div>');
        f.setAttribute('data-af-row', id);
        const out = document.createElement('output');
        const head = labelRow(label, help || '', id, out);
        head.classList.add('af-slider-head');
        f.appendChild(head);
        const r = el('<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">');
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
        f.appendChild(r);
        return f;
    }
    function text(label, value, onChange, placeholder, help) {
        const id = rid('tx');
        const f = el('<div class="af-col"></div>');
        f.setAttribute('data-af-row', id);
        f.appendChild(labelRow(label, help || '', id));
        const i = el('<input type="text" class="af-field" id="' + id + '" autocomplete="off">');
        i.value = value;
        i.placeholder = placeholder || '';
        i.addEventListener('input', () => onChange(i.value));
        f.appendChild(i);
        return f;
    }
    function area(label, value, onChange, opts) {
        const o = opts || {};
        const id = rid('ta');
        const f = el('<div class="af-col"></div>');
        f.setAttribute('data-af-row', id);
        f.appendChild(labelRow(label, o.help || '', id));
        const t = el('<textarea class="af-field ' + (o.cls || '') + '" id="' + id + '" rows="' + (o.rows || 2) + '" spellcheck="false"></textarea>');
        t.value = value;
        t.placeholder = o.placeholder || '';
        t.addEventListener('input', () => onChange(t.value));
        const big = expandButton(label, t, onChange);
        f.firstElementChild.appendChild(big);
        f.appendChild(t);
        return f;
    }
    // ---- the big editor ----
    // A box of a few rows in a drawer is a small place to write a paragraph.
    // Expand opens the same text at the size of the screen. It does not focus
    // the box on the way in, since that raises the keyboard on a phone and
    // covers what was opened. Escape, a tap outside, or Cancel closes it.
    let closeBig = null;
    function openBig(label, initial, done) {
        if (closeBig)
            closeBig();
        const over = el('<div class="af-over"></div>');
        const box = el('<div class="af-bigbox af"></div>');
        box.appendChild(el('<h3 class="af-cardh"><span></span></h3>'));
        box.querySelector('.af-cardh span').textContent = label;
        const ta = el('<textarea class="af-field af-mono af-bigta" spellcheck="false"></textarea>');
        ta.value = initial;
        ta.setAttribute('aria-label', label);
        if (!done)
            ta.readOnly = true;
        box.appendChild(ta);
        const row = el('<div class="af-row" style="justify-content:flex-end"></div>');
        row.appendChild(button('Copy', async () => {
            try {
                await navigator.clipboard.writeText(ta.value);
            }
            catch (_) {
                notify('warning', 'The text could not be copied. Your browser did not allow it.');
            }
        }));
        const cancel = button(done ? 'Cancel' : 'Close', () => shut());
        row.appendChild(cancel);
        if (done)
            row.appendChild(button('Done', () => {
                const v = ta.value;
                shut();
                done(v);
            }, 'af-primary'));
        box.appendChild(row);
        over.appendChild(box);
        const onKey = (e) => {
            if (e && e.key === 'Escape')
                shut();
        };
        function shut() {
            document.removeEventListener('keydown', onKey, true);
            if (closeBig === shut)
                closeBig = null;
            if (calm()) {
                over.remove();
                return;
            }
            over.classList.add('af-leaving');
            const t = setTimeout(() => {
                timers.delete(t);
                over.remove();
            }, 180);
            timers.add(t);
        }
        over.addEventListener('click', (e) => {
            if (e && e.target === over)
                shut();
        });
        document.addEventListener('keydown', onKey, true);
        (document.body || document.documentElement).appendChild(over);
        closeBig = shut;
    }
    disposers.push(() => {
        if (closeBig)
            closeBig();
        document.querySelectorAll('.af-over').forEach((n) => n.remove());
    });
    // An Expand button for a text box, which writes back to the box and its
    // setting when Done is pressed.
    function expandButton(label, t, onChange) {
        const big = button('Expand', () => openBig(label, t.value, t.readOnly ? undefined : (v) => {
            t.value = v;
            if (onChange)
                onChange(v);
            t.dispatchEvent(new Event('input', { bubbles: true }));
        }));
        big.setAttribute('aria-label', 'Open ' + label + ' at full size');
        return big;
    }
    function button(label, onClick, cls, icon) {
        const b = el('<button type="button" class="af-btn ' + (cls || '') + '">' + (icon || '') + '<span>' + esc(label) + '</span></button>');
        b.addEventListener('click', onClick);
        return b;
    }
    // A part that opens and closes on a tap, for detail most people skip.
    function fold(title, build) {
        const wrap = el('<div class="af-col"></div>');
        const head = el('<button type="button" class="af-fold" aria-expanded="false"><span class="af-caret">▶</span><span></span></button>');
        head.lastElementChild.textContent = title;
        const box = el('<div class="af-sub"><div class="af-foldbody"></div></div>');
        box.hidden = true;
        let built = false;
        head.addEventListener('click', () => {
            const open = head.getAttribute('aria-expanded') !== 'true';
            if (open && !built) {
                built = true;
                build(box.firstElementChild);
            }
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
            reveal(box, open);
        });
        wrap.appendChild(head);
        wrap.appendChild(box);
        return wrap;
    }
    // ---- rendering ----
    function renderTab() {
        if (!alive)
            return;
        paintHead();
        hideHint();
        // A redraw keeps the reader's place: the page holds its height while it
        // is rebuilt, and the scroll is put back after.
        const box = root.isConnected ? scrollBoxOf(root) : null;
        const was = box ? box.scrollTop : 0;
        const held = page.style.minHeight;
        if (!held)
            page.style.minHeight = page.offsetHeight + 'px';
        page.innerHTML = '';
        stageRefs = null;
        for (const w of permissionWarnings())
            page.appendChild(notice('bad', w));
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
            page.appendChild(notice('bad', 'This tab could not be drawn: ' + String((e && e.message) || e)));
        }
        if (!held)
            page.style.minHeight = '';
        if (box && box.scrollTop !== was)
            box.scrollTop = was;
    }
    // ---------- The look: a pattern behind the panel ----------
    // The same patterns as Auto Refine's, drawn in the theme's own faint
    // accent. The pattern is a wallpaper: the panel scrolls over it and it stays
    // where it is. The cards are drawn in the theme's raised color, and How solid
    // the boxes are sets how much of the pattern shows through them.
    const PATTERNS = ['', 'diamonds', 'stripes', 'dots', 'hearts', 'stars'];
    const PAT_INK = 'var(--lumiverse-primary-010,rgba(147,112,219,.12))';
    function shapeTile(kind) {
        const path = kind === 'hearts'
            ? 'M12 21 C12 21 3 15.3 3 9.4 C3 6.4 5.3 4 8.2 4 C9.9 4 11.3 4.9 12 6.2 C12.7 4.9 14.1 4 15.8 4 C18.7 4 21 6.4 21 9.4 C21 15.3 12 21 12 21 Z'
            : 'M12 2.8 L14.8 8.9 L21.4 9.6 L16.4 14.1 L17.8 20.7 L12 17.3 L6.2 20.7 L7.6 14.1 L2.6 9.6 L9.2 8.9 Z';
        const one = (x, y) => "<g transform='translate(" + x + ' ' + y + ") scale(.45)'><path d='" + path + "'/></g>";
        const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'>" + one(3, 3) + one(21, 21) + '</svg>';
        return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }
    const PAT_RAISED = 'var(--lumiverse-bg-elevated,rgba(35,30,48,.96))';
    const PAT_MIX = 'color-mix(in srgb,' + PAT_RAISED + ' var(--af-box-layer,37%),transparent)';
    const PAT_SOLID = 'background-color:' + PAT_RAISED + ';background-image:linear-gradient(' + PAT_RAISED + ',' + PAT_RAISED + ');' +
        'background-color:' + PAT_MIX + ';background-image:linear-gradient(' + PAT_MIX + ',' + PAT_MIX + ');';
    const PATTERN_CSS = '.af[data-af-pattern]{min-height:100%;position:relative;isolation:isolate}' +
        '.af[data-af-pattern]::before{content:"";display:block;position:sticky;top:0;flex:none;' +
        'height:var(--af-view,100vh);margin:-14px -14px calc(-1 * var(--af-view,100vh));z-index:-1;pointer-events:none}' +
        '.af[data-af-pattern="diamonds"]::before{background-image:repeating-linear-gradient(45deg,' + PAT_INK + ' 0 1px,transparent 1px 16px),repeating-linear-gradient(-45deg,' + PAT_INK + ' 0 1px,transparent 1px 16px)}' +
        '.af[data-af-pattern="stripes"]::before{background-image:repeating-linear-gradient(135deg,' + PAT_INK + ' 0 1px,transparent 1px 9px)}' +
        '.af[data-af-pattern="dots"]::before{background-image:radial-gradient(' + PAT_INK + ' 1.2px,transparent 1.6px);background-size:14px 14px}' +
        '.af[data-af-pattern] .af-card,.af[data-af-pattern] .af-tabs{' + PAT_SOLID + '}' +
        ['hearts', 'stars']
            .map((k) => '.af[data-af-pattern="' + k + '"]::before{background-color:' + PAT_INK + ';-webkit-mask:' + shapeTile(k) + ' 0 0/36px 36px repeat;mask:' + shapeTile(k) + ' 0 0/36px 36px repeat}')
            .join('') +
        // The tabs stay at the top of the drawer while it scrolls, with a shadow
        // once they are held there.
        '.af-stick{position:sticky;top:0;z-index:4}' +
        '.af-stick .af-tabs{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:box-shadow .18s ease}' +
        '.af-stick.af-stuck .af-tabs{box-shadow:var(--lumiverse-shadow-md,0 8px 24px rgba(0,0,0,.4))}' +
        // The floating player. Closed, it is a round button with a ring that
        // fills as a message plays. Open, it is a small card: who is speaking and
        // the line they are saying, a strip with every part of the message, the
        // transport, the two volumes, four switches, and who is voiced.
        '.af-float{position:relative;width:100%;height:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;border-radius:50%;' +
        'border:1px solid var(--lumiverse-border-hover,rgba(147,112,219,.25));background-color:var(--lumiverse-card-bg-solid,rgb(24,20,34));' +
        'background-image:linear-gradient(var(--lumiverse-bg-elevated,rgba(35,30,48,.9)),var(--lumiverse-bg-elevated,rgba(35,30,48,.9)));color:var(--lumiverse-text,rgba(255,255,255,.9));' +
        'box-shadow:var(--lumiverse-shadow-md,0 8px 24px rgba(0,0,0,.4));transition:border-color 260ms cubic-bezier(.2,.7,.3,1),transform 260ms cubic-bezier(.2,.7,.3,1)}' +
        '.af-float:hover{border-color:var(--lumiverse-primary-050,rgba(147,112,219,.5))}' +
        '.af-float .af-glyph{display:flex;line-height:0}.af-float .af-glyph svg{width:46%;height:46%;min-width:16px;min-height:16px}' +
        '.af-float[data-af-on="true"] .af-glyph{color:var(--lumiverse-primary-text,var(--lumiverse-primary,#a78bfa))}' +
        '.af-float .af-ring{position:absolute;inset:-1px;width:calc(100% + 2px);height:calc(100% + 2px);pointer-events:none;transform:rotate(-90deg);color:var(--lumiverse-primary,#a78bfa)}' +
        '.af-float .af-ring circle{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-dasharray:289;stroke-dashoffset:289;transition:stroke-dashoffset .4s ease-out}' +
        '@media (prefers-reduced-motion: no-preference){html:not([data-af-still]) .af-float:active{transform:scale(.94)}}' +
        '@media (prefers-reduced-motion: reduce){.af-float,.af-float .af-ring circle{transition:none}}' +
        'html[data-af-still] .af-float .af-ring circle{transition:none}' +
        '.af-pl{--pa:var(--lumiverse-primary,#a78bfa);--pa-text:var(--lumiverse-primary-text,var(--pa));--pa-on:var(--lumiverse-primary-contrast,#17122a);' +
        '--pa-soft:var(--lumiverse-primary-015,rgba(147,112,219,.15));--pa-line:var(--lumiverse-primary-050,rgba(147,112,219,.5));--pw:var(--lumiverse-warning,#f59e0b);' +
        '--pt:var(--lumiverse-text,rgba(255,255,255,.92));--pm:var(--lumiverse-text-muted,rgba(255,255,255,.65));--pl:var(--lumiverse-border,rgba(255,255,255,.08));' +
        '--ph:var(--lumiverse-border-hover,rgba(255,255,255,.18));--pf:var(--lumiverse-fill-subtle,rgba(255,255,255,.03));' +
        'box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:10px;padding:12px;overflow:hidden;color:var(--pt);font:13px/1.4 var(--lumiverse-font-family,system-ui,sans-serif);' +
        'border:1px solid var(--ph);border-radius:var(--lumiverse-radius-lg,16px);background-color:var(--lumiverse-card-bg-solid,#1a1526);' +
        'background-image:radial-gradient(120% 70% at 100% 0,var(--pa-soft),transparent 60%),linear-gradient(var(--lumiverse-bg-elevated,#1f1a2e),var(--lumiverse-bg-elevated,#1f1a2e));' +
        'box-shadow:var(--lumiverse-shadow-lg,0 18px 48px rgba(0,0,0,.5));animation:af-pl-in .2s ease-out both}' +
        '@keyframes af-pl-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
        '.af-pl *{box-sizing:border-box}' +
        '.af-pl button{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:0;margin:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background-color .15s,color .15s,box-shadow .15s}' +
        '.af-pl button svg{width:16px;height:16px;display:block}' +
        '@media (hover:hover){.af-pl button:not(:disabled):hover{background-color:var(--lumiverse-bg-hover,rgba(255,255,255,.07))}}' +
        '.af-pl button:disabled{opacity:.35;cursor:default}' +
        '.af-pl button:focus-visible,.af-pl input:focus-visible{outline:2px solid var(--pa);outline-offset:2px}' +
        '.af-pl-top{display:flex;align-items:center;gap:10px;min-width:0;cursor:grab;user-select:none;-webkit-user-select:none}' +
        '.af-pl-face{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-size:13px;font-weight:700;letter-spacing:.02em;' +
        'background:var(--pa-soft);color:var(--pa-text);box-shadow:inset 0 0 0 1.5px var(--pa-line)}' +
        '.af-pl-face svg{width:18px;height:18px}' +
        '.af-pl[data-af-state="playing"] .af-pl-face{box-shadow:inset 0 0 0 2px var(--pa)}' +
        '.af-pl-id{min-width:0;flex:1}' +
        '.af-pl-id b{display:block;font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.af-pl-id small{display:block;font-size:11px;color:var(--pm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.af-pl-icon{width:32px;height:32px;border-radius:50%;color:var(--pm)}' +
        '.af-pl-said{min-height:40px;padding:8px 10px;border-radius:10px;background:var(--pf);border:1px solid var(--pl);font-size:12.5px;line-height:1.45;color:var(--pt);' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}' +
        '.af-pl-said[data-quiet]{color:var(--pm)}' +
        '.af-pl-strip{display:flex;align-items:center;gap:2px;width:100%;height:32px;padding:0 1px}' +
        '.af-pl-strip button{flex:1 1 0;min-width:3px;height:32px;padding:13px 0!important;border-radius:0!important;background:transparent!important}' +
        '.af-pl-strip button i{display:block;width:100%;height:6px;border-radius:3px;background:var(--ph)}' +
        '.af-pl-strip button[data-k="sound"] i,.af-pl-strip button[data-k="applause"] i{background:color-mix(in srgb,var(--pw) 35%,transparent)}' +
        '.af-pl-strip button[data-done] i{background:var(--pa-line)}' +
        '.af-pl-strip button[data-k="sound"][data-done] i,.af-pl-strip button[data-k="applause"][data-done] i{background:color-mix(in srgb,var(--pw) 70%,transparent)}' +
        '.af-pl-strip button[aria-current="true"] i{background:var(--pa);height:10px;border-radius:5px}' +
        '.af-pl-strip:empty{display:none}' +
        '.af-pl-tr{display:flex;align-items:center;justify-content:center;gap:14px}' +
        '.af-pl-tr button{width:36px;height:36px;border-radius:50%;color:var(--pt)}' +
        '.af-pl-tr .af-pl-play{width:52px;height:52px;color:var(--pa-on);background:var(--pa)!important;box-shadow:0 0 0 5px var(--pa-soft)}' +
        '.af-pl-tr .af-pl-play svg{width:22px;height:22px}' +
        '.af-pl-tr .af-pl-stop{color:var(--pm)}' +
        '.af-pl-whose{display:flex;justify-content:center;gap:4px}' +
        '.af-pl-whose button{min-height:28px;padding:0 10px;border-radius:999px;font-size:11.5px;color:var(--pm);box-shadow:inset 0 0 0 1px var(--pl)}' +
        '.af-pl-whose button[aria-pressed="true"]{color:var(--pt);background:var(--pa-soft);box-shadow:inset 0 0 0 1px var(--pa-line)}' +
        '.af-pl-mix{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
        '.af-pl-mix label{display:flex;flex-direction:column;gap:2px;font-size:10.5px;color:var(--pm);min-width:0}' +
        '.af-pl-mix label>span{display:flex;justify-content:space-between;gap:4px}' +
        '.af-pl input[type=range].af-pl-range{-webkit-appearance:none;appearance:none;width:100%;min-width:0;height:24px;margin:0;padding:0;border:0;background:transparent;cursor:pointer;--lv:0%;' +
        '--trk:linear-gradient(to right,var(--pa) 0%,var(--pa) var(--lv),var(--ph) var(--lv),var(--ph) 100%)}' +
        '.af-pl input[type=range].af-pl-range::-webkit-slider-runnable-track{height:4px;border-radius:3px;background:var(--trk)}' +
        '.af-pl input[type=range].af-pl-range::-moz-range-track{height:4px;border-radius:3px;background:var(--trk)}' +
        '.af-pl input[type=range].af-pl-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;border:2px solid var(--lumiverse-bg-elevated,#1f1a2e);background:var(--pa)}' +
        '.af-pl input[type=range].af-pl-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;border:2px solid var(--lumiverse-bg-elevated,#1f1a2e);background:var(--pa)}' +
        '.af-pl-sw{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}' +
        '.af-pl-sw button{justify-content:space-between!important;gap:6px;min-height:32px;padding:0 2px!important;border-radius:8px;font-size:12px;color:var(--pt)}' +
        '.af-pl-sw button b{position:relative;width:30px;height:18px;border-radius:999px;background:var(--ph);transition:background-color .2s}' +
        '.af-pl-sw button b::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:var(--pt);transition:transform .25s cubic-bezier(.3,1.4,.5,1)}' +
        '.af-pl-sw button[aria-pressed="true"] b{background:var(--pa)}' +
        '.af-pl-sw button[aria-pressed="true"] b::after{transform:translateX(12px);background:var(--pa-on)}' +
        '.af-pl-fold{display:flex;align-items:center;gap:6px;width:100%;min-height:32px;padding:0 2px!important;font-size:12px;color:var(--pm);justify-content:flex-start!important;border-top:1px solid var(--pl)!important;border-radius:0!important}' +
        '.af-pl-fold svg{width:14px!important;height:14px!important;margin-left:auto;transition:transform .2s}' +
        '.af-pl-fold[aria-expanded="true"] svg{transform:rotate(180deg)}' +
        '.af-pl-cast{display:flex;flex-direction:column;gap:2px;max-height:210px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;margin-top:-6px}' +
        '.af-pl-ch{display:flex;align-items:center;gap:8px;padding:2px 4px;border-radius:8px;min-width:0}' +
        '.af-pl-ch[aria-current="true"]{background:var(--pa-soft)}' +
        '.af-pl-ch em{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:10px;font-weight:700;background:var(--pf);box-shadow:inset 0 0 0 1px var(--ph);flex-shrink:0}' +
        '.af-pl-ch>span{flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.af-pl-ch[data-off="true"]>span{color:var(--pm)}' +
        '.af-pl-ch button{width:32px;height:32px;border-radius:50%;color:var(--pm)}' +
        '.af-pl-ch button[aria-pressed="true"]{color:var(--pa-text)}' +
        '@media (pointer:coarse){.af-pl-icon,.af-pl-tr button{min-width:40px;min-height:40px}.af-pl-tr .af-pl-play{width:56px;height:56px}.af-pl-whose button,.af-pl-sw button,.af-pl-fold{min-height:36px}.af-pl-ch button{width:36px;height:36px}}' +
        '@media (prefers-reduced-motion: reduce){.af-pl{animation:none}.af-pl button,.af-pl-fold svg,.af-pl-sw button b,.af-pl-sw button b::after{transition:none}}' +
        'html[data-af-still] .af-pl{animation:none}html[data-af-still] .af-pl-sw button b,html[data-af-still] .af-pl-sw button b::after{transition:none}' +
        // The subtitles on the Stage.
        '.af-theater{display:flex;flex-direction:column;gap:8px;min-height:112px;padding:14px;border-radius:var(--lumiverse-radius-md,10px);' +
        'border:1px solid var(--lumiverse-border,rgba(147,112,219,.12));background:var(--lumiverse-fill,rgba(0,0,0,.15))}' +
        '.af-theater-who{display:flex;align-items:center;gap:8px;min-height:30px;font-weight:600;color:var(--lumiverse-text,rgba(255,255,255,.9))}' +
        '.af-theater-who .af-avatar{width:28px;height:28px;font-size:11px}' +
        '.af-theater-line{font-size:17px;line-height:1.6;overflow-wrap:anywhere}' +
        '.af-theater-idle{font-size:13px;color:var(--lumiverse-text-muted,rgba(255,255,255,.65))}' +
        '.af-w{color:var(--lumiverse-text-muted,rgba(255,255,255,.65));transition:color .25s ease}' +
        '.af-w.af-said{color:var(--lumiverse-text,rgba(255,255,255,.92))}' +
        '.af-theater-cue:empty{display:none}' +
        '.af-cue{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12.5px;color:var(--lumiverse-text,rgba(255,255,255,.9));' +
        'background:var(--lumiverse-warning-015,rgba(245,158,11,.15));box-shadow:inset 0 0 0 1px var(--lumiverse-warning,#f59e0b);animation:af-in .3s ease-out both}' +
        '.af-cue svg{width:14px;height:14px;color:var(--lumiverse-warning,#f59e0b)}' +
        '.af-avatar-persona{background:var(--lumiverse-warning-015,rgba(245,158,11,.15))!important;box-shadow:inset 0 0 0 1.5px var(--lumiverse-warning,#f59e0b)!important}' +
        '.af-avatar-narrator{background:var(--lumiverse-fill,rgba(0,0,0,.15))!important;box-shadow:inset 0 0 0 1.5px var(--lumiverse-border-hover,rgba(147,112,219,.25))!important}';
    try {
        disposers.push(ctx.dom.addStyle(PATTERN_CSS));
    }
    catch (_) { }
    // How solid the boxes are, as the share of the raised color in each of two
    // layers, so two layers together reach the share asked for.
    function boxLayer(solid) {
        const n = Number(solid);
        const s = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) / 100 : 0.6;
        return (100 * (1 - Math.sqrt(1 - s))).toFixed(1) + '%';
    }
    // The pattern layer is as tall as the box that scrolls the drawer shows.
    let wallBox = null;
    let wallSeen = null;
    function scrollBoxOf(n) {
        for (let p = n.parentElement; p; p = p.parentElement) {
            const oy = getComputedStyle(p).overflowY;
            if (oy === 'auto' || oy === 'scroll')
                return p;
        }
        return null;
    }
    function sizeWallpaper() {
        const box = root.isConnected ? scrollBoxOf(root) : null;
        if (box !== wallBox) {
            if (wallSeen && wallBox)
                wallSeen.unobserve(wallBox);
            wallBox = box;
            if (wallSeen && box)
                wallSeen.observe(box);
            if (box)
                box.addEventListener('scroll', onDrawerScroll, { passive: true });
        }
        if (!box || box.clientHeight <= 0)
            return;
        const cs = getComputedStyle(box);
        const inner = box.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        if (inner > 0)
            root.style.setProperty('--af-view', inner + 'px');
    }
    try {
        wallSeen = new ResizeObserver(() => sizeWallpaper());
        wallSeen.observe(root);
    }
    catch (_) {
        wallSeen = null;
    }
    disposers.push(() => {
        if (wallSeen)
            wallSeen.disconnect();
        if (wallBox)
            wallBox.removeEventListener('scroll', onDrawerScroll);
        wallSeen = null;
        wallBox = null;
    });
    function paintLook() {
        const pat = PATTERNS.indexOf(String(S.panelPattern)) > 0 ? String(S.panelPattern) : '';
        if (pat)
            root.setAttribute('data-af-pattern', pat);
        else
            root.removeAttribute('data-af-pattern');
        root.style.setProperty('--af-box-layer', boxLayer(S.boxSolid));
        sizeWallpaper();
    }
    // Whether the tabs are held at the top, for the shadow under them.
    let stuckSoon = 0;
    function onDrawerScroll() {
        if (stuckSoon)
            return;
        stuckSoon = requestAnimationFrame(() => {
            stuckSoon = 0;
            const stick = root.querySelector('[data-af-stick]');
            if (!stick || !stick.offsetHeight)
                return;
            const above = stick.previousElementSibling;
            const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
            const held = !!above && stick.getBoundingClientRect().top - above.getBoundingClientRect().bottom > gap + 1;
            stick.classList.toggle('af-stuck', held);
        });
    }
    // ---------- The floating player ----------
    // Closed, a round button over the chat. A tap opens the player: who is
    // speaking, Play and the buttons around it, the volume, quick switches, and
    // a level for each voice. Lumiverse does the dragging. Where it is left, and
    // whether it is open, are kept in this browser, since they belong to this
    // screen.
    const FLOAT_KEY = 'lv-auto-foley:float:v1';
    const PLAYER_W = 300;
    let widget = null;
    let floatBox = null;
    let floatBtn = null;
    let widgetFailed = false;
    let widgetOff = null;
    let widgetSize = 0;
    let playerOpen = false;
    let playerWhose = 'reply';
    let levelsOpen = false;
    let playerSeen = null;
    function floatAt() {
        try {
            const raw = localStorage.getItem(FLOAT_KEY);
            const j = raw ? JSON.parse(raw) : null;
            if (j && Number.isFinite(j.x) && Number.isFinite(j.y))
                return j;
        }
        catch (_) { }
        return null;
    }
    function keepFloat() {
        try {
            const at = widget && typeof widget.getPosition === 'function' ? widget.getPosition() : null;
            const was = floatAt() || { x: 16, y: 160 };
            localStorage.setItem(FLOAT_KEY, JSON.stringify({ x: Math.round(at ? at.x : was.x), y: Math.round(at ? at.y : was.y), open: playerOpen, levels: levelsOpen }));
        }
        catch (_) { }
    }
    function dropWidget() {
        if (widgetOff)
            widgetOff();
        widgetOff = null;
        if (playerSeen)
            playerSeen.disconnect();
        playerSeen = null;
        try {
            if (widget)
                widget.destroy();
        }
        catch (_) { }
        widget = null;
        floatBox = null;
        floatBtn = null;
    }
    // The size the widget takes: the round button, or the card at its height.
    function fitWidget() {
        if (!widget || !floatBox)
            return;
        const d = widgetSize;
        // Lumiverse's UI Scale zooms the page, so the screen is this many CSS
        // pixels wide and tall.
        let zoom = 1;
        try {
            zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
        }
        catch (_) { }
        const vw = (window.innerWidth || 360) / zoom;
        const vh = (window.innerHeight || 640) / zoom;
        let w = d;
        let h = d;
        if (playerOpen) {
            const card = floatBox.querySelector('.af-pl');
            w = Math.min(PLAYER_W, vw - 16);
            // One pixel spare, so a height with a fraction in it does not scroll.
            h = Math.min(vh - 16, Math.ceil(card ? card.offsetHeight : 320) + 1);
        }
        try {
            widget.setSize(w, h);
            if (typeof widget.getPosition === 'function' && typeof widget.moveTo === 'function') {
                const at = widget.getPosition();
                const x = Math.max(8, Math.min(at.x, vw - w - 8));
                const y = Math.max(8, Math.min(at.y, vh - h - 8));
                if (x !== at.x || y !== at.y)
                    widget.moveTo(x, y);
            }
        }
        catch (_) { }
    }
    function openPlayer(open) {
        playerOpen = open;
        keepFloat();
        drawFloat();
    }
    async function latestId(mine) {
        const chatId = activeChatId();
        if (!chatId)
            return '';
        try {
            const res = await api('/chats/' + encodeURIComponent(chatId) + '/messages?tail=true&limit=20');
            if (!res.ok)
                return '';
            const j = await res.json();
            const list = Array.isArray(j && j.data) ? j.data : [];
            for (let k = list.length - 1; k >= 0; k--)
                if (list[k] && !!list[k].is_user === mine)
                    return String(list[k].id);
        }
        catch (_) { }
        return '';
    }
    // Play in the player: pause or go on when something plays, or perform the
    // latest reply, or your latest message, when nothing does.
    async function playerPlay() {
        if (show)
            return togglePause();
        if (busyMessage)
            return;
        const id = await latestId(playerWhose === 'mine');
        if (id)
            perform(id);
        else {
            phase = playerWhose === 'mine' ? 'You have no message in this chat to perform.' : 'There is no reply in this chat to perform.';
            log(phase);
            paintFloat();
        }
    }
    async function playerPrepare() {
        const id = await latestId(playerWhose === 'mine');
        if (!id)
            return;
        phase = 'Directing it ahead';
        paintFloat();
        const got = await getScript(activeChatId(), id, false);
        phase = got.script ? 'Ready. Press Play.' : got.why || '';
        if (got.why)
            log(got.why, 'bad');
        paintFloat();
    }
    async function playerMenu(anchor) {
        if (!ctx.ui || typeof ctx.ui.showContextMenu !== 'function')
            return;
        let x = 40;
        let y = 40;
        try {
            const r = anchor.getBoundingClientRect();
            x = Math.round(r.left + r.width / 2);
            y = Math.round(r.bottom);
        }
        catch (_) { }
        const busy = !!show || !!busyMessage;
        let got = null;
        try {
            got = await ctx.ui.showContextMenu({
                position: { x, y },
                items: [
                    { key: 'prep', label: playerWhose === 'mine' ? 'Direct my latest message ahead' : 'Direct the latest reply ahead', disabled: busy || chatInfo.kind === 'none' },
                    { key: 'divider1', label: '', type: 'divider' },
                    { key: 'open', label: 'Open the Auto Foley tab' },
                    { key: 'hide', label: 'Hide the player' },
                ],
            });
        }
        catch (e) {
            log('The player’s menu could not open: ' + String((e && e.message) || e), 'bad');
            return;
        }
        const key = got && got.selectedKey;
        if (key === 'prep')
            playerPrepare();
        else if (key === 'open') {
            try {
                if (drawer)
                    drawer.activate();
            }
            catch (_) { }
        }
        else if (key === 'hide') {
            set({ widgetOn: false });
            syncWidget();
            // Nothing on screen says where it went, so it is said here.
            notify('info', 'The Auto Foley player is hidden. Turn it on again in the Settings tab, under Look.');
            if (tab === 'settings')
                renderTab();
        }
    }
    // Moves the show to part k, from the strip.
    function jumpTo(k) {
        if (!show || k < 0 || k >= show.items.length)
            return;
        show.index = k;
        show.jumped = true;
        paused = false;
        stopAudio();
    }
    const initialsOf = (name) => String(name || '')
        .split(/\s+/)
        .map((w) => w.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?';
    function drawFloat() {
        if (!floatBox)
            return;
        floatBox.innerHTML = '';
        floatBtn = null;
        if (!playerOpen) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'af-float';
            b.innerHTML =
                '<span class="af-glyph">' + ICON + '</span>' +
                    '<svg class="af-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="46"/></svg>';
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openPlayer(true);
            });
            floatBtn = b;
            floatBox.appendChild(b);
            paintFloat();
            fitWidget();
            return;
        }
        const SWITCHES = [
            { key: 'autoplay', label: 'Autoplay', title: 'Perform each new reply when it finishes' },
            { key: 'soundsOn', label: 'Sounds', title: 'Sounds of what happens in the scene' },
            { key: 'narrate', label: 'Narrator', title: 'Read the text outside quotes aloud' },
            { key: 'applauseOn', label: 'Applause', title: 'A cheer at the end of a message or a big moment' },
        ];
        const c = el('<div class="af-pl" role="group" aria-label="Auto Foley player">' +
            '<div class="af-pl-top"><span class="af-pl-face" data-p="face"></span><div class="af-pl-id"><b data-p="who"></b><small data-p="sub"></small></div>' +
            '<button type="button" class="af-pl-icon" data-p="menu" aria-label="More" title="More">' + ICON_MORE + '</button>' +
            '<button type="button" class="af-pl-icon" data-p="close" aria-label="Close the player" title="Close the player">' + ICON_DOWN + '</button></div>' +
            '<div class="af-pl-said" data-p="said" aria-live="polite"></div>' +
            '<div class="af-pl-strip" data-p="strip" role="group" aria-label="The parts of the message"></div>' +
            '<div class="af-pl-tr">' +
            '<button type="button" data-p="back" aria-label="Back one line" title="Back one line">' + ICON_BACK + '</button>' +
            '<button type="button" class="af-pl-play" data-p="play" aria-label="Play">' + ICON_PLAY + '</button>' +
            '<button type="button" data-p="next" aria-label="Next line" title="Next line">' + ICON_SKIP + '</button>' +
            '<button type="button" class="af-pl-stop" data-p="stop" aria-label="Stop" title="Stop">' + ICON_STOP + '</button>' +
            '</div>' +
            '<div class="af-pl-whose" role="group" aria-label="What Play performs"><button type="button" data-w="reply">Latest reply</button><button type="button" data-w="mine">My latest message</button></div>' +
            '<div class="af-pl-mix">' +
            '<label><span>Voices<b data-p="vv"></b></span><input type="range" class="af-pl-range" data-p="vol" min="0" max="100" step="5" aria-label="Voices volume"></label>' +
            '<label><span>Sounds<b data-p="sv"></b></span><input type="range" class="af-pl-range" data-p="svol" min="0" max="100" step="5" aria-label="Sounds volume"></label>' +
            '</div>' +
            '<div class="af-pl-sw" role="group" aria-label="Quick switches">' +
            SWITCHES.map((w) => '<button type="button" data-sw="' + w.key + '" title="' + esc(w.title) + '"><span>' + esc(w.label) + '</span><b aria-hidden="true"></b></button>').join('') +
            '</div>' +
            '<button type="button" class="af-pl-fold" data-p="fold" aria-expanded="false">Who is voiced' + ICON_DOWN + '</button>' +
            '<div class="af-pl-cast" data-p="cast" hidden></div>' +
            '</div>');
        const q = (k) => c.querySelector('[data-p="' + k + '"]');
        q('close').addEventListener('click', () => openPlayer(false));
        q('menu').addEventListener('click', () => playerMenu(q('menu')));
        c.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
            playerWhose = b.dataset.w === 'mine' ? 'mine' : 'reply';
            paintFloat();
        }));
        q('play').addEventListener('click', () => playerPlay());
        q('back').addEventListener('click', () => back());
        q('next').addEventListener('click', () => skip());
        q('stop').addEventListener('click', () => {
            if (busyMessage)
                busyMessage = '';
            stop('Stopped');
        });
        const vol = q('vol');
        vol.value = String(Math.round((Number(S.voiceVolume) || 0) * 100));
        vol.addEventListener('input', () => {
            S.voiceVolume = Number(vol.value) / 100;
            if (audio && audio.dataset && audio.dataset.kind === 'voice')
                audio.volume = muted.voice ? 0 : S.voiceVolume;
            paintFloat();
        });
        vol.addEventListener('change', () => set({ voiceVolume: Number(vol.value) / 100 }));
        const svol = q('svol');
        svol.value = String(Math.round((Number(S.soundVolume) || 0) * 100));
        svol.addEventListener('input', () => {
            S.soundVolume = Number(svol.value) / 100;
            paintFloat();
        });
        svol.addEventListener('change', () => set({ soundVolume: Number(svol.value) / 100 }));
        c.querySelectorAll('[data-sw]').forEach((b) => b.addEventListener('click', () => {
            const k = b.dataset.sw;
            if (k === 'narrate')
                set({ narration: S.narration === 'read' ? 'skip' : 'read' });
            else
                set({ [k]: !S[k] });
            paintFloat();
            if (tab === 'settings' || tab === 'director')
                renderTab();
        }));
        q('strip').addEventListener('click', (e) => {
            const b = e.target && e.target.closest ? e.target.closest('[data-at]') : null;
            if (b)
                jumpTo(Number(b.dataset.at));
        });
        q('fold').addEventListener('click', () => {
            levelsOpen = !levelsOpen;
            keepFloat();
            paintLevels();
            fitWidget();
        });
        floatBox.appendChild(c);
        paintLevels();
        paintFloat();
        fitWidget();
    }
    // Who is voiced: a switch for each person in the cast, the same as Do not
    // voice in the Cast tab.
    function paintLevels() {
        if (!floatBox)
            return;
        const fold = floatBox.querySelector('[data-p="fold"]');
        const box = floatBox.querySelector('[data-p="cast"]');
        if (!fold || !box)
            return;
        fold.setAttribute('aria-expanded', levelsOpen ? 'true' : 'false');
        box.hidden = !levelsOpen;
        if (!levelsOpen)
            return;
        box.innerHTML = '';
        const order = { narrator: 0, persona: 1, character: 2, npc: 3 };
        const people = S.cast.slice().sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
        for (const m of people) {
            const ch = el('<div class="af-pl-ch" data-person="' + esc(m.id) + '"><em>' + esc(initialsOf(m.name)) + '</em><span></span><button type="button"></button></div>');
            ch.querySelector('span').textContent = m.name;
            const b = ch.querySelector('button');
            const paintB = () => {
                ch.dataset.off = m.muted ? 'true' : 'false';
                b.innerHTML = m.muted ? ICON_MIC_OFF : ICON_MIC;
                b.setAttribute('aria-pressed', m.muted ? 'false' : 'true');
                const said = m.muted ? 'Voice ' + m.name + ' again' : 'Do not voice ' + m.name;
                b.setAttribute('aria-label', said);
                b.title = said;
            };
            paintB();
            b.addEventListener('click', () => {
                m.muted = !m.muted;
                save();
                paintB();
                if (tab === 'cast')
                    renderTab();
            });
            box.appendChild(ch);
        }
        paintFloat();
    }
    // What the player shows now. Called whenever the show changes.
    let stripFor = null;
    function paintFloat() {
        if (!floatBox)
            return;
        const on = !!show || !!busyMessage;
        const state = show ? (paused ? 'paused' : 'playing') : busyMessage ? 'working' : 'idle';
        const total = show ? show.items.length : 0;
        const frac = show && total ? Math.min(1, show.index / total) : 0;
        if (floatBtn) {
            floatBtn.dataset.afOn = on ? 'true' : 'false';
            const said = on ? 'Auto Foley is playing. Open the player' : 'Open the Auto Foley player';
            floatBtn.title = said;
            floatBtn.setAttribute('aria-label', said);
            const ring = floatBtn.querySelector('.af-ring circle');
            if (ring)
                ring.style.strokeDashoffset = String(Math.round(289 * (1 - (on ? Math.max(frac, 0.02) : 0))));
        }
        const c = floatBox.querySelector('.af-pl');
        if (!c)
            return;
        c.dataset.afState = state;
        const q = (k) => c.querySelector('[data-p="' + k + '"]');
        const it = show ? show.items[Math.min(show.index, show.items.length - 1)] : null;
        const line = it ? it.line : null;
        const who = !it ? null : it.kind === 'voice' && line ? (line.kind === 'narration' ? narratorMember() : memberFor(line.speaker)) : null;
        const name = !it ? '' : it.kind === 'voice' ? (line && line.kind === 'narration' ? 'Narrator' : (line && line.speaker) || '') : it.kind === 'applause' ? 'The audience' : 'A sound';
        const face = q('face');
        const faceKey = it ? (it.kind === 'voice' ? 'v:' + name : it.kind) : 'idle';
        if (face.dataset.k !== faceKey) {
            face.dataset.k = faceKey;
            face.innerHTML = it && it.kind === 'voice' ? esc(initialsOf(name)) : it ? ICON_SOUND : ICON;
        }
        q('who').textContent = name || (busyMessage ? 'Directing the message' : 'Auto Foley');
        const chat = chatInfo.kind === 'none' ? 'No chat open' : chatInfo.name || 'This chat';
        q('sub').textContent = show ? (paused ? 'Paused' : 'Part ' + (Math.min(show.index, total - 1) + 1) + ' of ' + total) + ' · ' + chat : chat;
        const said = q('said');
        const words = it && it.kind === 'voice' && line ? stripTags(line.text) : it && it.sound ? it.sound : '';
        const text = words || (busyMessage ? 'The Director is reading it.' : phase && !/^(Stopped|Finished)$/.test(phase) ? phase : playerWhose === 'mine' ? 'Press Play to perform your latest message.' : 'Press Play to perform the latest reply.');
        if (said.textContent !== text)
            said.textContent = text;
        if (words)
            said.removeAttribute('data-quiet');
        else
            said.setAttribute('data-quiet', '');
        // The strip has one mark for each part. It is drawn again only for a new
        // show, and its marks are updated as the show moves.
        const strip = q('strip');
        if (stripFor !== show || strip.childElementCount !== total) {
            stripFor = show;
            strip.innerHTML = show
                ? show.items
                    .map((x, k) => '<button type="button" data-at="' + k + '" data-k="' + x.kind + '" aria-label="Part ' + (k + 1) +
                    (x.kind === 'voice' ? ', ' + esc(x.line.kind === 'narration' ? 'Narrator' : x.line.speaker) : x.kind === 'applause' ? ', the audience' : ', a sound') +
                    '"><i></i></button>')
                    .join('')
                : '';
        }
        const sh = show;
        if (sh)
            strip.querySelectorAll('[data-at]').forEach((b) => {
                const k = Number(b.dataset.at);
                if (k < sh.index)
                    b.setAttribute('data-done', '');
                else
                    b.removeAttribute('data-done');
                if (k === sh.index)
                    b.setAttribute('aria-current', 'true');
                else
                    b.removeAttribute('aria-current');
            });
        c.querySelectorAll('[data-w]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.w === playerWhose ? 'true' : 'false'));
        const play = q('play');
        const playing = !!show && !paused;
        play.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        play.setAttribute('aria-label', playing ? 'Pause' : show ? 'Go on' : playerWhose === 'mine' ? 'Play my latest message' : 'Play the latest reply');
        play.title = play.getAttribute('aria-label') || '';
        play.disabled = !show && (!!busyMessage || chatInfo.kind === 'none');
        q('back').disabled = !show;
        q('next').disabled = !show;
        q('stop').disabled = !on;
        for (const [k, b] of [['vol', 'vv'], ['svol', 'sv']]) {
            const r = q(k);
            r.style.setProperty('--lv', r.value + '%');
            q(b).textContent = r.value + '%';
        }
        c.querySelectorAll('[data-sw]').forEach((b) => {
            const k = b.dataset.sw;
            const isOn = k === 'narrate' ? S.narration === 'read' : !!S[k];
            b.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        });
        c.querySelectorAll('.af-pl-ch').forEach((ch) => {
            const now = !!who && ch.dataset.person === who.id;
            if (now)
                ch.setAttribute('aria-current', 'true');
            else
                ch.removeAttribute('aria-current');
        });
    }
    function raiseWidget() {
        if (widget)
            return;
        const d = Math.min(96, Math.max(28, Math.round(Number(S.widgetSize) || 44)));
        const vw = window.innerWidth || 360;
        const vh = window.innerHeight || 640;
        const at = floatAt();
        playerOpen = !!(at && at.open);
        levelsOpen = !!(at && at.levels);
        const start = at ? { x: Math.max(8, Math.min(at.x, vw - d - 8)), y: Math.max(8, Math.min(at.y, vh - d - 8)) } : { x: 16, y: Math.max(16, Math.min(160, vh - d - 8)) };
        try {
            widget = ctx.ui.createFloatWidget({ width: d, height: d, initialPosition: start, snapToEdge: false, tooltip: 'Auto Foley', chromeless: true });
        }
        catch (_) {
            widget = null;
            widgetFailed = true;
            log('The floating player could not be added. Check that Auto Foley has the ui_panels permission, in Lumiverse under Extensions.', 'bad');
            return;
        }
        widgetFailed = false;
        widgetSize = d;
        try {
            const wroot = widget.root;
            // Only the size is set. The root's other styles are Lumiverse's.
            wroot.style.width = '100%';
            wroot.style.height = '100%';
            const box = document.createElement('div');
            box.style.cssText = 'width:100%;display:flex;align-items:flex-start;justify-content:center';
            wroot.appendChild(box);
            floatBox = box;
            drawFloat();
            // The card's height changes as the levels open, so the widget follows.
            try {
                playerSeen = new ResizeObserver(() => {
                    if (playerOpen)
                        fitWidget();
                });
                playerSeen.observe(box);
            }
            catch (_) {
                playerSeen = null;
            }
            const onDrop = () => setTimeout(keepFloat, 50);
            window.addEventListener('spindle:float-drag-end', onDrop);
            window.addEventListener('pointerup', onDrop, true);
            widgetOff = () => {
                window.removeEventListener('spindle:float-drag-end', onDrop);
                window.removeEventListener('pointerup', onDrop, true);
            };
        }
        catch (_) { }
    }
    function syncWidget() {
        const want = !!S.enabled && !!S.widgetOn;
        const d = Math.min(96, Math.max(28, Math.round(Number(S.widgetSize) || 44)));
        if (want && widget && widgetSize !== d)
            dropWidget();
        if (want)
            raiseWidget();
        else
            dropWidget();
    }
    disposers.push(() => dropWidget());
    // ---------- The audience ----------
    // Just for fun: a crowd that cheers the cast on for their acting.
    function audienceCard() {
        const c = card('The audience', 'Just for fun. A crowd that cheers the cast on after a performance, like an audience watching a show.');
        c.appendChild(toggle('Applause', 'Off by default. Plays a cheering crowd after a performance. The built-in cheer is a free recording from Pixabay.', 'applauseOn', () => { }, () => [
            toggle('Cheer for the AI\u2019s characters', 'On by default. The audience cheers after the characters the AI plays.', 'applauseForAi'),
            toggle('Cheer for you', 'Off by default. The audience cheers after your own messages too.', 'applauseForUser'),
            segmented('When they cheer', [
                { id: 'message', label: 'End of a message' },
                { id: 'big', label: 'Big moments' },
            ], S.applauseWhen, (v) => set({ applauseWhen: v }), 'End of a message is the default: one cheer when a message finishes. Big moments cheers after a line the Director marks as a peak, which needs Big moments on in the Director tab.'),
            slider('How long they cheer', Number(S.applauseSeconds) || 5, 1, 15, 1, (v) => v + ' s', (v) => set({ applauseSeconds: v }), '5 seconds by default. The cheer fades out at the end, so the next part is not held up.'),
            slider('How loud they cheer', Math.round((Number(S.applauseVolume) || 0) * 100), 0, 100, 5, (v) => v + '%', (v) => set({ applauseVolume: v / 100 }), '60% by default, of the Sounds volume on the Stage tab.'),
            select('Applause sound', [{ id: '', label: 'The built-in cheering crowd' }].concat(sounds.map((x) => ({ id: String(x.id), label: String(x.name) }))), S.applauseSound, (v) => set({ applauseSound: v }), 'The built-in cheer by default. Any sound in your library can be used instead. Upload one in the Sounds tab.'),
            (() => {
                const row = el('<div class="af-row"></div>');
                row.appendChild(button('Hear it', async () => {
                    const got = await makeApplauseClip();
                    if (!got.blob)
                        return;
                    previewBlob(got.blob, S.soundVolume * S.applauseVolume);
                    const el2 = preview;
                    if (el2)
                        fadeApplause(el2);
                }, '', ICON_SOUND));
                return row;
            })(),
        ]));
        return c;
    }
    // ---------- The Extras menu ----------
    // Entries in the Extras menu of the message box, put up or taken down to
    // match the settings. Registered by id, so Lumiverse is never handed two of
    // the same one.
    const extras = new Map();
    function extra(id, label, want, run) {
        const had = extras.get(id);
        if (want && !had) {
            try {
                if (ctx.ui && typeof ctx.ui.registerInputBarAction === 'function') {
                    const made = ctx.ui.registerInputBarAction({ id, label, iconSvg: ICON });
                    if (made && typeof made.onClick === 'function')
                        made.onClick(run);
                    extras.set(id, made);
                }
            }
            catch (_) {
                extras.delete(id);
            }
        }
        else if (!want && had) {
            try {
                if (had.destroy)
                    had.destroy();
            }
            catch (_) { }
            extras.delete(id);
        }
    }
    function syncExtras() {
        const on = !!S.enabled && !!S.extrasMenu;
        extra('auto-foley-latest', 'Perform the latest reply', on, () => {
            stop();
            pressBar();
        });
        extra('auto-foley-mine', 'Perform my latest message', on, async () => {
            stop();
            const id = await latestId(true);
            if (id)
                perform(id);
            else {
                phase = 'You have no message in this chat to perform.';
                log(phase);
                if (!drawerOpen())
                    notify('info', 'Auto Foley found no message of yours in this chat to perform.');
            }
        });
        extra('auto-foley-stop', 'Stop Auto Foley', on && (!!show || !!busyMessage), () => {
            if (busyMessage)
                busyMessage = '';
            stop('Stopped');
        });
    }
    disposers.push(() => {
        extras.forEach((one) => {
            try {
                if (one.destroy)
                    one.destroy();
            }
            catch (_) { }
        });
        extras.clear();
    });
    function lookCard() {
        const c = card('Look', 'How the panel looks. Your theme colors everything.');
        c.appendChild(select('Pattern behind the panel', [
            { id: '', label: 'None' },
            { id: 'diamonds', label: 'Diamonds' },
            { id: 'stripes', label: 'Stripes' },
            { id: 'dots', label: 'Dots' },
            { id: 'hearts', label: 'Hearts' },
            { id: 'stars', label: 'Stars' },
        ], String(S.panelPattern || ''), (v) => {
            set({ panelPattern: v });
            paintLook();
            renderTab();
        }, 'None by default. A faint pattern in your theme’s color, drawn behind the cards. The same patterns as Auto Refine.'));
        if (PATTERNS.indexOf(String(S.panelPattern)) > 0) {
            const under = el('<div class="af-sub"><div class="af-under"></div></div>');
            under.firstElementChild.appendChild(slider('How solid the boxes are (%)', Number(S.boxSolid), 0, 100, 5, (v) => v + '%', (v) => {
                set({ boxSolid: v });
                paintLook();
            }, '60 by default. Lower lets more of the pattern show through the cards and the tabs. Higher makes them more solid.'));
            c.appendChild(under);
        }
        c.appendChild(toggle('A floating player', 'Off by default. A round button over the chat that opens a small player: Play, the lines, the volume and quick switches. Drag it to move it. It needs the UI panels permission.', 'widgetOn', () => syncWidget(), () => [
            slider('How big it is', Number(S.widgetSize) || 44, 28, 96, 2, (v) => v + ' px', (v) => {
                set({ widgetSize: v });
                syncWidget();
            }, 'How wide the button is, in pixels. 44 by default, about a comfortable thumb.'),
        ]));
        if (S.widgetOn && widgetFailed)
            c.appendChild(notice('warn', 'The floating player could not be added. Check that Auto Foley has the UI panels permission, in Lumiverse under Extensions.'));
        return c;
    }
    // ---------- Stage ----------
    function renderStage() {
        if (!S.guideSeen)
            page.appendChild(guideCard());
        const now = card('Now playing');
        now.insertAdjacentHTML('beforeend', '<div class="af-transport">' +
            '<button type="button" class="af-round" data-af="back" aria-label="Back one part" title="Back one part">' + ICON_BACK + '</button>' +
            '<button type="button" class="af-play" data-af="play" aria-label="Play">' + ICON_PLAY + '</button>' +
            '<button type="button" class="af-round" data-af="skip" aria-label="Next part" title="Next part">' + ICON_SKIP + '</button>' +
            '<button type="button" class="af-round" data-af="stop" aria-label="Stop" title="Stop">' + ICON_STOP + '</button>' +
            '<div class="af-now-text"><div class="af-now-title" data-af="title"></div><div class="af-now-sub" data-af="sub"></div></div></div>' +
            '<div class="af-theater" data-af="theater"><div class="af-theater-who" data-af="who"></div><div class="af-theater-line" data-af="line"></div><div class="af-theater-cue" data-af="cue"></div></div>' +
            '<div class="af-parts" data-af="parts" role="group" aria-label="The parts of the message"></div>' +
            '<div class="af-scene" data-af="scene"></div>');
        // A new take of the part playing, or of the whole message.
        const againRow = el('<div class="af-row" data-af="againrow"></div>');
        const againPart = button('Make this part again', () => {
            const it = show ? show.items[Math.min(show.index, show.items.length - 1)] : null;
            if (!it || !show)
                return;
            if (it.kind === 'voice')
                lineAgain(show.script, it.line);
            else if (it.kind === 'sound' && it.sound)
                soundAgain(it.sound, '');
        }, '', ICON_REDO);
        againPart.setAttribute('data-af', 'again');
        const directAgain = button('Direct again', () => {
            const id = (show && show.messageId) || lastMeta.messageId;
            if (id)
                perform(id, true);
        }, '', ICON_REDO);
        directAgain.setAttribute('data-af', 'redo');
        againRow.appendChild(againPart);
        againRow.appendChild(directAgain);
        const retryRow = el('<div class="af-row" data-af="retryrow"></div>');
        retryRow.appendChild(button('Try the failed parts again', () => {
            if (lastFailed)
                startShow(lastFailed.script, lastFailed.meta, 0, lastFailed.items);
        }, 'af-primary', ICON_REDO));
        now.appendChild(againRow);
        now.appendChild(retryRow);
        page.appendChild(now);
        const q = (k) => now.querySelector('[data-af="' + k + '"]');
        q('play').addEventListener('click', () => togglePause());
        q('stop').addEventListener('click', () => {
            if (busyMessage)
                busyMessage = '';
            stop('Stopped');
        });
        q('skip').addEventListener('click', () => skip());
        q('back').addEventListener('click', () => back());
        q('parts').addEventListener('click', (e) => {
            const b = e.target && e.target.closest ? e.target.closest('[data-at]') : null;
            if (!b)
                return;
            const k = Number(b.dataset.at);
            if (show)
                jumpTo(k);
            else {
                const sc = currentScript();
                if (!sc)
                    return;
                const items = buildItems(sc);
                if (items[k])
                    startShow(sc, lastMeta, items[k].at);
            }
        });
        const mix = card('Mixer', 'How loud the voices and the sounds are, apart from each other. Mute is for this page only.');
        const mixer = el('<div class="af-mixer"></div>');
        mixer.appendChild(strip('Voices', 'voice', 'voiceVolume'));
        mixer.appendChild(strip('Sounds', 'sound', 'soundVolume'));
        mix.appendChild(mixer);
        page.appendChild(mix);
        const lg = card('Log', 'What happened, newest last. Anything that went wrong says why here.', '<button type="button" class="af-btn" data-af="copy">Copy</button><button type="button" class="af-btn af-danger" data-af="clear">Clear the log</button>');
        lg.querySelector('[data-af="clear"]').addEventListener('click', () => {
            logLines.length = 0;
            paintLog();
        });
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
        stageRefs = { now, q, logBox, retryRow, theaterItem: -1 };
        paintStage();
        paintLog();
        paintTheater();
    }
    // The first thing a new reader sees: where the button is and what to do.
    function guideCard() {
        const c = card('Start here');
        c.appendChild(el('<ol class="af-steps">' +
            '<li>Open the <b>Settings</b> tab and press <b>Check my setup</b>. It says what is ready and what is missing.</li>' +
            '<li>In a chat, find the boom microphone ' + ICON + ' in the row of buttons on any message. Press it to perform that message. Press it again to stop.</li>' +
            '<li>The same button sits in the chat’s own row of buttons, by the message box. It performs the newest reply.</li>' +
            '<li>Open the <b>Cast</b> tab and pick a voice for each person. <b>Hear a sample</b> plays one line.</li>' +
            '<li>Turn on <b>Autoplay new replies</b> in Settings to hear each reply as it finishes.</li>' +
            '</ol>'));
        c.appendChild(hint('Every setting has a <b>?</b> beside it that says what it does. The <a href="https://github.com/starlitcode/Lumiverse-Auto-Foley/blob/stable/docs/getting-started.md" target="_blank" rel="noopener">Getting started</a> page on GitHub has more.'));
        const row = el('<div class="af-row"></div>');
        row.appendChild(button('Got it', () => {
            set({ guideSeen: true });
            renderTab();
        }));
        c.appendChild(row);
        return c;
    }
    function strip(name, kind, key) {
        const s = el('<div class="af-strip"><div class="af-between"><span class="af-strip-name"><span class="af-swatch' + (kind === 'sound' ? ' af-swatch-sound' : '') + '"></span>' + esc(name) +
            '</span><button type="button" class="af-btn" aria-pressed="' + (muted[kind] ? 'true' : 'false') + '">' + (muted[kind] ? 'Unmute' : 'Mute') + '</button></div></div>');
        s.appendChild(slider('Volume', Math.round(S[key] * 100), 0, 100, 1, (v) => v + '%', (v) => {
            set({ [key]: v / 100 });
            if (audio && audio.dataset && audio.dataset.kind === kind && !muted[kind])
                audio.volume = v / 100;
        }));
        const m = s.querySelector('.af-btn');
        m.addEventListener('click', () => {
            muted[kind] = !muted[kind];
            m.setAttribute('aria-pressed', muted[kind] ? 'true' : 'false');
            m.textContent = muted[kind] ? 'Unmute' : 'Mute';
            if (audio && audio.dataset && audio.dataset.kind === kind)
                audio.volume = muted[kind] ? 0 : S[key];
        });
        return s;
    }
    function currentScript() {
        return (show && show.script) || lastScript;
    }
    // A new take of one line, for someone who does not like how it came out.
    // The kept take is let go, and the line is spoken again on its own.
    async function lineAgain(script, line) {
        if (!(await askSure('Make line ' + (line.i + 1) + ' again', 'A new take of this line is made and played. It costs voice credits, the same as the first take.', 'Make it again')))
            return;
        const req = await voiceRequest(line);
        if (!req.body) {
            log(req.why || 'This line could not be made again.', 'bad');
            return;
        }
        try {
            await rpc({ type: 'clip_drop', sig: req.sig }, 15000);
        }
        catch (_) { }
        log('Making line ' + (line.i + 1) + ' again.');
        startShow(script, lastMeta, line.i, [{ kind: 'voice', line, at: line.i }]);
    }
    // A new take of a sound effect made by ElevenLabs. It replaces the old one
    // in the library, so every message that uses it gets the new take.
    async function soundAgain(description, id) {
        if (!(await askSure('Make this sound again', 'A new take of “' + description + '” replaces the one in your library. It costs ElevenLabs credits.', 'Make it again')))
            return;
        log('Making the sound again: ' + description + '.');
        try {
            const got = await rpc(id ? { type: 'sound_again', id } : { type: 'sound_again', description }, 60000);
            if (got && got.base64)
                previewBlob(base64ToBlob(got.base64, got.mime), S.soundVolume);
            else
                log((got && got.error) || 'The sound could not be made again.', 'bad');
        }
        catch (e) {
            log('The sound could not be made again: ' + String((e && e.message) || 'the backend did not answer.'), 'bad');
        }
        if (tab === 'sounds')
            renderTab();
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
        // The floating player follows the show too, with the panel closed.
        paintFloat();
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
        q('stop').disabled = !show && !busyMessage;
        q('skip').disabled = !show;
        q('back').disabled = !show;
        q('redo').disabled = !(show || lastMeta.messageId) || !!busyMessage;
        const cur = show ? show.items[Math.min(show.index, show.items.length - 1)] : null;
        q('again').disabled = !cur || cur.kind === 'applause';
        q('again').lastElementChild.textContent = cur && cur.kind === 'sound' ? 'Make this sound again' : 'Make this line again';
        paintParts(q('parts'), script);
        stageRefs.retryRow.hidden = !(lastFailed && !show && !busyMessage);
        const title = q('title');
        const sub = q('sub');
        const scene = q('scene');
        const sc = currentScript();
        const inScene = sc && Array.isArray(sc.inScene) ? sc.inScene : [];
        const sceneKey = inScene.join('|');
        if (scene.dataset.key !== sceneKey) {
            scene.dataset.key = sceneKey;
            scene.innerHTML = inScene.length ? '<span class="af-note" style="padding:0;background:none">In this scene:</span>' + inScene.map((n) => '<span>' + esc(n) + '</span>').join('') : '';
        }
        if (busyMessage) {
            title.textContent = 'Getting ready';
            sub.textContent = phase;
        }
        else if (show) {
            const secs = Math.round((Date.now() - show.startedAt) / 1000);
            title.textContent = show.script.author ? show.script.author + '’s message' : 'This message';
            const w = show.waiting.get(show.index);
            const said = w
                ? 'The voice service is busy. Trying again in ' + Math.max(0, Math.ceil((w.until - Date.now()) / 1000)) + ' s (wait ' + w.n + ' of ' + S.rateWaits + ')'
                : phase || 'Playing';
            sub.textContent = said + ' · part ' + Math.min(show.index + 1, show.items.length) + ' of ' + show.items.length + ' · ' + secs + ' s';
        }
        else {
            title.textContent = script ? (script.author ? script.author + '’s message' : 'This message') : 'Nothing playing';
            sub.textContent = phase || (script ? 'Ready. Press Play.' : chatInfo.kind === 'none' ? 'Open a chat, then press the boom microphone on a message.' : 'Press the boom microphone on a message.');
        }
    }
    // One mark for each part of the message: lines, sounds and the cheer. The
    // part playing is wider, and the parts played are filled. A tap goes there.
    let partsFor = null;
    function paintParts(box, script) {
        const items = show ? show.items : script ? buildItems(script) : [];
        const key = show || script;
        if (partsFor !== key || box.childElementCount !== items.length) {
            partsFor = key;
            box.innerHTML = items
                .map((x, k) => '<button type="button" data-at="' + k + '" data-k="' + x.kind + '" aria-label="Part ' + (k + 1) +
                (x.kind === 'voice' ? ', ' + esc(x.line.kind === 'narration' ? 'Narrator' : x.line.speaker) : x.kind === 'applause' ? ', the audience' : ', a sound') +
                '" title="' + esc(x.kind === 'voice' ? stripTags(x.line.text).slice(0, 80) : x.kind === 'applause' ? 'The audience cheers' : x.sound || '') + '"><i></i></button>')
                .join('');
        }
        const at = show ? show.index : -1;
        box.querySelectorAll('[data-at]').forEach((b) => {
            const k = Number(b.dataset.at);
            if (at >= 0 && k < at)
                b.setAttribute('data-done', '');
            else
                b.removeAttribute('data-done');
            if (k === at)
                b.setAttribute('aria-current', 'true');
            else
                b.removeAttribute('aria-current');
        });
    }
    // ---- the subtitles ----
    // The part playing now, drawn large: who speaks, and their line with each
    // word changing from gray to full color as it is spoken. The timing is the
    // clip's own: how far through the audio it is, spread over the words by
    // their length. A sound between lines shows as a cue instead.
    let theaterRaf = 0;
    function paintTheater() {
        if (!stageRefs)
            return;
        const q = stageRefs.q;
        const who = q('who');
        const lineBox = q('line');
        const cue = q('cue');
        const sh = show;
        const it = sh ? sh.items[Math.min(sh.index, sh.items.length - 1)] : null;
        const key = sh && it ? sh.index + ':' + it.kind : 'none';
        if (stageRefs.theaterItem === key)
            return;
        stageRefs.theaterItem = key;
        q('theater').dataset.state = it ? it.kind : 'idle';
        if (!it) {
            who.innerHTML = '';
            lineBox.innerHTML = '<span class="af-theater-idle">The line being spoken shows here, word by word.</span>';
            cue.innerHTML = '';
            return;
        }
        if (it.kind === 'sound' || it.kind === 'applause') {
            cue.innerHTML = '<span class="af-cue">' + ICON_SOUND + '<span>' + esc(it.kind === 'applause' ? 'The audience cheers' : it.sound || '') + '</span></span>';
            return;
        }
        cue.innerHTML = '';
        const line = it.line;
        const name = line.kind === 'narration' ? 'Narrator' : line.speaker;
        const m = line.kind === 'narration' ? narratorMember() : memberFor(line.speaker);
        const initials = name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';
        who.innerHTML = '<span class="af-avatar af-avatar-' + esc((m && m.kind) || 'character') + '">' + esc(initials) + '</span><span>' + esc(name) + '</span>';
        // Each part has a weight: a word by its vowels, and a tag the engine
        // performs by the time a breath or a sound takes. A tag the engine was
        // not sent takes no time.
        const cn = connOf(m);
        const eng = engineFor(cn, pickOf(m, cn).model || (cn && cn.model));
        const parts = String(line.text || '').split(/(\[[^\]]*\])/g);
        let html = '';
        const weights = [];
        for (const p of parts) {
            if (!p)
                continue;
            if (/^\[[^\]]*\]$/.test(p)) {
                const inner = p.slice(1, -1);
                const isSound = /^sounds? of\b/i.test(inner);
                const kept = eng.tags === 'free' ? (isSound ? eng.inVoiceSounds : true) : eng.tags === 'list' && !isSound && !!fitTag(inner, eng.list);
                // A tag on how a line is said is heard in the words, not as a sound.
                const heard = kept && (isSound || !!tagSound(inner));
                html += '<span class="af-chip ' + (isSound ? 'af-chip-insound' : 'af-chip-tag') + '" data-af-part="' + weights.length + '">' + esc(inner) + '</span> ';
                weights.push(heard ? (isSound ? 4 : 2) : 0);
            }
            else {
                for (const w of p.split(/(\s+)/)) {
                    if (!w)
                        continue;
                    if (/^\s+$/.test(w))
                        html += ' ';
                    else {
                        html += '<span class="af-w" data-af-part="' + weights.length + '">' + esc(w) + '</span>';
                        weights.push(wordWeight(w));
                    }
                }
            }
        }
        lineBox.innerHTML = html;
        // The box keeps the tallest line of this message, so a short line after a
        // long one does not pull the rest of the tab up.
        const th = q('theater');
        const h = th.offsetHeight;
        if (h > (stageRefs.theaterTall || 0)) {
            stageRefs.theaterTall = h;
            th.style.minHeight = h + 'px';
        }
        stageRefs.weights = weights;
        stageRefs.timed = '';
    }
    // Moves the spoken words along with the audio. Runs only while a voice
    // clip plays, and writes only the words that changed.
    function theaterTick() {
        theaterRaf = 0;
        if (!alive || !stageRefs || tab !== 'stage')
            return;
        paintTheater();
        const el2 = audio;
        const box = stageRefs.q('line');
        if (el2 && el2.dataset && el2.dataset.kind === 'voice' && box && show) {
            const words = box.querySelectorAll('.af-w');
            const dur = Number(el2.duration);
            const t = Number(el2.currentTime);
            const weights = stageRefs.weights || [];
            if (words.length && dur > 0 && Number.isFinite(dur) && weights.length) {
                // The start of each part, worked out once the clip's sound has been
                // read, and again if it is read after the line was drawn.
                const voiced = show.voiced.get(show.index);
                const mark = show.index + ':' + (voiced ? 'v' : 'n') + ':' + Math.round(dur * 100);
                if (stageRefs.timed !== mark) {
                    stageRefs.timed = mark;
                    stageRefs.starts = partTimes(weights, voiced || [], dur);
                }
                const starts = stageRefs.starts || [];
                // A word is lit as it starts, a moment early, since the eye is slower
                // than the ear.
                const now = t + 0.08;
                words.forEach((w) => {
                    const at = starts[Number(w.dataset.afPart)];
                    const said = at != null && at <= now;
                    if (w.classList.contains('af-said') !== said)
                        w.classList.toggle('af-said', said);
                });
            }
        }
        if (show)
            theaterRaf = requestAnimationFrame(theaterTick);
    }
    function theaterRun() {
        if (!theaterRaf && typeof requestAnimationFrame === 'function')
            theaterRaf = requestAnimationFrame(theaterTick);
    }
    disposers.push(() => {
        if (theaterRaf)
            cancelAnimationFrame(theaterRaf);
        theaterRaf = 0;
    });
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
    const KIND_LABEL = { narrator: 'Narrator', character: 'Character', persona: 'Persona', npc: 'NPC' };
    const ADDED_LABEL = { ai: 'Added by AI', found: 'Found in the text' };
    const groups = () => (Array.isArray(S.groups) ? S.groups : []);
    let renamingGroup = '';
    function renderCast() {
        const top = card('Cast', 'Everyone who speaks gets their own voice: your personas, the characters and the NPCs. People join when they write a message, when the text names them speaking, when the Director finds them, or when you add them. Tap a person to open their settings.');
        const row = el('<div class="af-row"></div>');
        row.appendChild(button('Add someone', () => {
            const m = {
                id: rid('c'), name: 'New person', kind: 'npc', addedBy: 'you', aliases: [], voice: '', voiceName: '', model: '', connection: '', voices: {}, group: '',
                stability: 0.5, similarity: 0.75, style: 0, speed: 1, note: '', gender: 'unknown', muted: false,
            };
            S.cast.push(m);
            openPeople.add(m.id);
            save();
            renderTab();
        }, 'af-primary'));
        row.appendChild(button('New group', () => {
            const f = { id: rid('f'), name: 'New group', open: true };
            S.groups = groups().concat([f]);
            renamingGroup = f.id;
            save();
            renderTab();
        }));
        top.appendChild(row);
        top.appendChild(hint('Groups sort the cast on this tab, such as one for each story. Pick a person’s group in their settings.'));
        const conn = activeConnection();
        if (!conn)
            top.appendChild(notice('warn', ttsWhy || 'Pick your TTS connection in the Settings tab to choose voices.'));
        page.appendChild(top);
        const order = { narrator: 0, persona: 1, character: 2, npc: 3 };
        const people = S.cast.slice().sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
        const known = new Set(groups().map((f) => f.id));
        for (const f of groups())
            page.appendChild(groupSection(f, people.filter((m) => m.group === f.id), conn));
        for (const m of people)
            if (!m.group || !known.has(m.group))
                page.appendChild(personCard(m, conn));
    }
    function groupSection(f, people, conn) {
        const sec = el('<section class="af-group" data-group="' + esc(f.id) + '" data-open="' + (f.open ? 'true' : 'false') + '"><div class="af-group-head"></div><div class="af-sub af-group-body"' + (f.open ? '' : ' hidden') + '><div></div></div></section>');
        const head = sec.querySelector('.af-group-head');
        const body = sec.querySelector('.af-group-body');
        const inner = body.firstElementChild;
        const count = people.length === 1 ? '1 person' : people.length + ' people';
        if (renamingGroup === f.id) {
            const input = el('<input type="text" class="af-field af-group-name" maxlength="60" aria-label="Group name">');
            input.value = f.name;
            const done = () => {
                if (renamingGroup !== f.id)
                    return;
                renamingGroup = '';
                f.name = input.value.trim().slice(0, 60) || f.name;
                S.groups = groups().slice();
                save();
                renderTab();
            };
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter')
                    done();
                if (e.key === 'Escape') {
                    renamingGroup = '';
                    renderTab();
                }
            });
            input.addEventListener('blur', done);
            head.appendChild(input);
            head.appendChild(button('Save', done, 'af-primary'));
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                }
                catch (_) { }
            }, 0);
        }
        else {
            const toggle = el('<button type="button" class="af-group-toggle" aria-expanded="' + (f.open ? 'true' : 'false') + '"><span class="af-chev">' + ICON_CHEVRON + '</span><span></span><span class="af-group-count"></span></button>');
            toggle.children[1].textContent = f.name;
            toggle.children[2].textContent = count;
            toggle.addEventListener('click', () => {
                f.open = !f.open;
                S.groups = groups().slice();
                save();
                sec.dataset.open = f.open ? 'true' : 'false';
                toggle.setAttribute('aria-expanded', f.open ? 'true' : 'false');
                if (f.open && !inner.childElementCount)
                    fillGroup();
                reveal(body, f.open);
            });
            head.appendChild(toggle);
            head.appendChild(button('Rename', () => {
                renamingGroup = f.id;
                renderTab();
            }));
            head.appendChild(button('Delete', async () => {
                const ok = await askSure('Delete the group ' + f.name, 'The group is deleted. ' + (people.length ? 'The ' + count + ' in it stay in the cast, outside any group.' : 'It is empty.'), 'Delete', true);
                if (!ok)
                    return;
                S.groups = groups().filter((x) => x.id !== f.id);
                for (const m of S.cast)
                    if (m.group === f.id)
                        m.group = '';
                save();
                renderTab();
            }, 'af-danger'));
        }
        const fillGroup = () => {
            inner.innerHTML = '';
            if (!people.length)
                inner.appendChild(el('<p class="af-group-empty">Nobody is in this group yet. Open a person and pick it under Group.</p>'));
            for (const m of people)
                inner.appendChild(personCard(m, conn));
        };
        if (f.open)
            fillGroup();
        return sec;
    }
    function personCard(m, conn) {
        const open = openPeople.has(m.id);
        const initials = m.name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';
        const badge = ADDED_LABEL[m.addedBy] ? '<span class="af-badge af-badge-ai">' + esc(ADDED_LABEL[m.addedBy]) + '</span>' : '<span class="af-badge">' + esc(KIND_LABEL[m.kind] || m.kind) + '</span>';
        const c = el('<section class="af-card af-person" data-kind="' + esc(m.kind) + '" data-open="' + (open ? 'true' : 'false') + '">' +
            '<button type="button" class="af-person-head" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="af-avatar">' + esc(initials) + '</span>' +
            '<span class="af-person-name"><b></b><span></span></span>' + badge + '<span class="af-chev">' + ICON_CHEVRON + '</span></button>' +
            '<div class="af-sub af-person-body"' + (open ? '' : ' hidden') + '><div class="af-person-inner"></div></div></section>');
        const head = c.querySelector('.af-person-head');
        const body = c.querySelector('.af-person-body');
        const inner = c.querySelector('.af-person-inner');
        const paintName = () => {
            c.querySelector('.af-person-name b').textContent = m.name;
            const pick = pickOf(m, connOf(m));
            c.querySelector('.af-person-name span').textContent = m.muted ? 'Not voiced' : pick.voiceName || pick.voice || 'The connection’s voice';
        };
        paintName();
        let built = false;
        const build = () => {
            if (built)
                return;
            built = true;
            fillPerson(inner, m, conn, paintName);
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
    function fillPerson(inner, m, conn, paintName) {
        if (m.kind !== 'narrator') {
            const g1 = el('<div class="af-grid2"></div>');
            g1.appendChild(text('Name', m.name, (v) => {
                m.name = v.trim() || m.name;
                save();
                paintName();
            }, '', 'The name the story uses for them. Lines are matched to a person by this name and the names below.'));
            g1.appendChild(text('Also called', (m.aliases || []).join(', '), (v) => {
                m.aliases = v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
                save();
            }, 'Other names, with commas', 'Other names the story uses for them, such as a first name, a nickname or a title. Separate them with commas.'));
            g1.appendChild(select('Who they are', [
                { id: 'character', label: 'Character' },
                { id: 'persona', label: 'Persona (you)' },
                { id: 'npc', label: 'NPC' },
            ], m.kind, (v) => {
                m.kind = v;
                save();
            }, 'Persona is a character you play. NPC is a side character. It changes nothing about how they sound.'));
            g1.appendChild(select('Voice type', [
                { id: 'unknown', label: 'Any' },
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
            ], m.gender, (v) => {
                m.gender = v;
                save();
            }, 'Used only when someone new has no voice yet: they get a voice of this type that nobody else uses.'));
            inner.appendChild(g1);
        }
        if (groups().length) {
            inner.appendChild(select('Group', [{ id: '', label: 'No group' }].concat(groups().map((f) => ({ id: f.id, label: f.name }))), m.group || '', (v) => {
                m.group = v;
                save();
                renderTab();
            }, 'Which group they are in on this tab. It changes nothing about how they sound.'));
        }
        // The connection, voice and model, and the voice settings that engine
        // has. Drawn again when the connection or the model changes, since each
        // engine has its own.
        const voiceBox = el('<div class="af-col af-voicebox"></div>');
        inner.appendChild(voiceBox);
        const drawVoice = () => {
            voiceBox.innerHTML = '';
            const cn = connOf(m);
            if (ttsConnections.length > 1 || m.connection) {
                const main = activeConnection();
                const opts = [{ id: '', label: 'Auto Foley’s connection' + (main ? ' (' + main.name + ')' : '') }].concat(ttsConnections.map((c) => ({ id: String(c.id), label: String(c.name || c.id) + (engineFor(c, c.model).supported ? '' : ', no tags'), group: engineGroup(c) })));
                if (m.connection && !connById(m.connection))
                    opts.push({ id: m.connection, label: 'A connection that is gone' });
                voiceBox.appendChild(select('Connection', opts, m.connection || '', (v) => {
                    m.connection = v;
                    save();
                    paintName();
                    drawVoice();
                }, 'The TTS connection this person speaks through. Use it to mix engines, such as a narrator on a cheaper engine. Each connection keeps its own voice for them.'));
            }
            const vid = rid('vc');
            const voiceField = el('<div class="af-col"></div>');
            voiceField.appendChild(labelRow('Voice', 'Their voice on this connection. Designed or cloned voices act better than the stock voices.', vid));
            const vwrap = el('<div class="af-selwrap"><select class="af-field" id="' + vid + '" disabled><option>Loading your voices…</option></select></div>');
            const vs = vwrap.firstElementChild;
            voiceField.appendChild(vwrap);
            const vh = el('<p class="af-note" hidden></p>');
            voiceField.appendChild(vh);
            voiceBox.appendChild(voiceField);
            if (cn) {
                loadVoices(cn.id).then((got) => {
                    if (!vs.isConnected)
                        return;
                    vs.disabled = false;
                    const now = pickOf(m, cn);
                    const opts = [{ id: '', label: 'The connection’s voice' }].concat(got.voices.map((v) => ({ id: String(v.id), label: String(v.name || v.id) + (v.gender ? ' (' + v.gender + ')' : '') })));
                    if (now.voice && !opts.some((o) => o.id === now.voice))
                        opts.push({ id: now.voice, label: now.voiceName || now.voice });
                    vs.innerHTML = opts.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === now.voice ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
                    vh.textContent = got.why;
                    vh.hidden = !got.why;
                });
            }
            else {
                vs.innerHTML = '<option>No TTS connection</option>';
                vh.textContent = ttsWhy || 'Pick your TTS connection in the Settings tab.';
                vh.hidden = false;
            }
            vs.addEventListener('change', () => {
                const voice = vs.value;
                const voiceName = voice ? String((vs.selectedOptions[0] && vs.selectedOptions[0].textContent) || '').replace(/ \((female|male|neutral)\)$/i, '') : '';
                setPick(m, cn, { voice, voiceName });
                save();
                paintName();
            });
            if (!cn)
                return;
            const pick = pickOf(m, cn);
            const eng = engineFor(cn, pick.model || cn.model);
            const mid = rid('md');
            const modelField = el('<div class="af-col"></div>');
            modelField.appendChild(labelRow('Model', 'Empty uses the connection’s model. The model decides which acting directions work, shown under this box.', mid));
            const mwrap = el('<div class="af-selwrap"><select class="af-field" id="' + mid + '"><option value="">The connection’s model' + (cn.model ? ' (' + esc(cn.model) + ')' : '') + '</option></select></div>');
            const ms = mwrap.firstElementChild;
            modelField.appendChild(mwrap);
            modelField.appendChild(hint(esc((eng.supported ? 'Engine: ' + eng.label + '. ' : '') + engineAbility(eng))));
            if (!eng.supported)
                modelField.appendChild(notice('bad', noTagsWhy(cn, pick.model || cn.model)));
            voiceBox.appendChild(modelField);
            loadModels(cn).then((list) => {
                if (!ms.isConnected)
                    return;
                // Only models that act are offered. One picked before that does not
                // is still shown, marked, so it can be changed.
                const opts = list.filter((o) => modelActs(cn, o.id));
                if (pick.model && !opts.some((o) => o.id === pick.model))
                    opts.push({ id: pick.model, label: pick.model + (modelActs(cn, pick.model) ? '' : ' (no tags)') });
                ms.innerHTML =
                    '<option value="">The connection’s model' + (cn.model ? ' (' + esc(cn.model) + ')' : '') + '</option>' +
                        opts.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === pick.model ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
            });
            ms.addEventListener('change', () => {
                setPick(m, cn, { model: ms.value });
                save();
                drawVoice();
            });
            if (eng.eleven) {
                const model = pick.model || cn.model || '';
                if (/^eleven_v3/.test(model)) {
                    voiceBox.appendChild(segmented('Stability', [
                        { id: '0', label: 'Creative' },
                        { id: '0.5', label: 'Natural' },
                        { id: '1', label: 'Robust' },
                    ], String(stabilityFor('eleven_v3', m.stability, false)), (v) => {
                        m.stability = Number(v);
                        save();
                    }, 'Eleven v3 has three settings. Creative is the most expressive and can drift. Robust is the steadiest and acts the least. Natural is the default.'));
                }
                else {
                    voiceBox.appendChild(slider('Stability', m.stability, 0, 1, 0.05, (v) => v.toFixed(2), (v) => {
                        m.stability = v;
                        save();
                    }, 'Lower is more expressive and varied. Higher is steadier and more even. 0.50 by default.'));
                }
            }
            const g2 = el('<div class="af-grid2"></div>');
            if (eng.eleven) {
                g2.appendChild(slider('Similarity', m.similarity, 0, 1, 0.05, (v) => v.toFixed(2), (v) => {
                    m.similarity = v;
                    save();
                }, 'How closely ElevenLabs keeps to the original voice. 0.75 by default.'));
                g2.appendChild(slider('Style', m.style, 0, 1, 0.05, (v) => v.toFixed(2), (v) => {
                    m.style = v;
                    save();
                }, 'Exaggerates the voice’s own style. 0 by default. Higher can sound less stable.'));
            }
            if (!/^gemini/.test(eng.id)) {
                g2.appendChild(slider('Speed', m.speed, 0.7, 1.2, 0.05, (v) => v.toFixed(2) + '×', (v) => {
                    m.speed = v;
                    save();
                }, 'How fast they speak, from 0.7 to 1.2. 1.00 by default.'));
            }
            if (g2.childElementCount)
                voiceBox.appendChild(g2);
        };
        drawVoice();
        inner.appendChild(area('How they speak', m.note, (v) => {
            m.note = v.slice(0, 300);
            save();
        }, { placeholder: 'Soft-spoken and dry. Rarely raises their voice.', help: 'A short note the Director reads when it tags this person’s lines, such as how loud they are, how they joke, or how they sound when upset.' }));
        const mutedRow = el('<div class="af-col"></div>');
        {
            const id = rid('mt');
            const box = el('<input type="checkbox" class="af-box" role="switch" id="' + id + '">');
            box.checked = m.muted;
            const row = labelRow('Do not voice', 'Their lines are skipped and nothing is spoken for them. Use it for someone you do not want to hear, such as your own persona, while everyone else is still voiced.', undefined, box);
            box.setAttribute('aria-label', 'Do not voice');
            box.addEventListener('change', () => {
                m.muted = box.checked;
                save();
                paintName();
            });
            mutedRow.appendChild(row);
        }
        inner.appendChild(mutedRow);
        const actions = el('<div class="af-row"></div>');
        const status = el('<p class="af-status"></p>');
        actions.appendChild(button('Hear a sample', async () => {
            const cn = connOf(m);
            status.textContent = 'Asking ' + serviceName(cn) + '…';
            status.dataset.kind = '';
            const eng = engineFor(cn, pickOf(m, cn).model || (cn && cn.model));
            const sample = {
                i: 0, kind: m.kind === 'narrator' ? 'narration' : 'speech', speaker: m.name,
                text: eng.tags === 'free' ? 'This is how I sound. [softly] And this is how I sound when I lower my voice.' : eng.tags === 'list' ? 'This is how I sound. [sigh] And this is how I sound after a long day.' : 'This is how I sound when I read a line for you.',
                plain: '', tags: [], big: false, before: '', after: '', note: '',
                style: eng.style ? 'quiet and close' : '',
            };
            const got = await makeVoiceClip(sample, new AbortController().signal);
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
            }, 'af-danger'));
        }
        inner.appendChild(actions);
        inner.appendChild(status);
    }
    // ---------- Director ----------
    let llmConnections = null;
    let llmWhy = '';
    let decisionList = null;
    let decisionWhy = '';
    const SAMPLER_FIELDS = [
        { id: 'temperature', label: 'Temperature', min: 0, max: 2, step: '0.05', help: 'How loose the choices are. The Director follows its rules better a little lower than the temperature you roleplay with.' },
        { id: 'top_p', label: 'Top P', min: 0, max: 1, step: '0.01', help: 'Cuts the choices down to the likeliest ones, by share. 1 leaves them all in, and lower is tighter.' },
        { id: 'top_k', label: 'Top K', min: 0, max: 500, step: '1', help: 'Cuts the choices down to this many, by count. 0 leaves them all in. Some providers ignore it.' },
        { id: 'min_p', label: 'Min P', min: 0, max: 1, step: '0.01', help: 'Drops any choice this far below the likeliest one. 0 leaves them all in. Some providers ignore it.' },
        { id: 'max_tokens', label: 'Longest answer (tokens)', min: 1, max: 200000, step: '1', help: 'A ceiling too low cuts the Director off mid-answer, and the message is then read as written. Leave room.' },
        { id: 'max_context', label: 'Context size (tokens)', min: 512, max: 2000000, step: '1', help: 'The context size sent to the provider. Blank leaves it to the connection, which is nearly always right.' },
        { id: 'frequency_penalty', label: 'Frequency penalty', min: -2, max: 2, step: '0.05', help: 'Pushes against a word the more often it has been used. 0 is off. The Director repeats your words on purpose, so leave it blank.' },
        { id: 'presence_penalty', label: 'Presence penalty', min: -2, max: 2, step: '0.05', help: 'Pushes against a word that has been used at all. 0 is off. Best left blank here.' },
        { id: 'repetition_penalty', label: 'Repetition penalty', min: 0, max: 2, step: '0.01', help: 'Pushes against repeated words. 1 is off. Best left blank here.' },
    ];
    function samplerRow(f) {
        const id = rid('smp');
        const wrap = el('<div class="af-col"></div>');
        wrap.setAttribute('data-af-row', id);
        wrap.appendChild(labelRow(f.label, f.help + ' Blank leaves it to the connection.', id));
        const i = el('<input type="number" class="af-field" id="' + id + '" inputmode="decimal" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" placeholder="Blank: the connection decides">');
        const cur = (S.samplers || {})[f.id];
        i.value = cur === '' || cur == null ? '' : String(cur);
        i.addEventListener('input', () => {
            const next = Object.assign({}, S.samplers || {});
            if (i.value.trim() === '')
                delete next[f.id];
            else
                next[f.id] = Number(i.value);
            set({ samplers: next });
        });
        wrap.appendChild(i);
        return wrap;
    }
    function renderDirector() {
        const main = card('The Director', 'A second model reads each message before it is spoken, like a director with a script. It marks how every line is said, with voice tags such as [whispers] or [sighs], and adds the sounds of what happens. It never changes your words.');
        main.appendChild(toggle('Use the Director', 'On by default. Off: messages are read as written, with no voice tags and no sounds, and no second model is asked.', 'directorOn', undefined, () => {
            const rows = [];
            rows.push(segmented('How much acting', [
                { id: 'subtle', label: 'Subtle' },
                { id: 'natural', label: 'Natural' },
                { id: 'dramatic', label: 'Dramatic' },
            ], S.strength, (v) => set({ strength: v }), 'At most 1, 2 or 4 voice tags in one line. Natural by default. Subtle suits quiet scenes, and Dramatic suits big ones.'));
            // What the engine in use cannot do of what is on, painted again as
            // the switches change.
            const warnBox = el('<div class="af-col" data-af-engine-warn></div>');
            const paintWarn = () => {
                warnBox.innerHTML = '';
                for (const w of engineWarnings(mainEngine()))
                    warnBox.appendChild(notice(mainEngine().supported ? 'warn' : 'bad', w));
                warnBox.hidden = !warnBox.childElementCount;
            };
            paintWarn();
            rows.push(toggle('Voice tags', 'On by default. How a line is said, such as [whispers], [shouting] or [voice breaking]. Off: no voice tags at all.', 'tagsOn', paintWarn));
            rows.push(toggle('Breaths, sighs and laughs', 'On by default. Sounds a voice makes, such as [sighs], [laughs] or [gasps]. Off takes them out of every line.', 'breathsOn'));
            rows.push(toggle('Sounds', 'On by default. Sounds of what happens in the scene: a door, footsteps, a glass breaking.', 'soundsOn', paintWarn, () => [
                segmented('How sounds are made', [
                    { id: 'voice', label: 'In the voice' },
                    { id: 'effects', label: 'Sound effects' },
                    { id: 'both', label: 'Both' },
                ], S.soundStyle, (v) => {
                    set({ soundStyle: v });
                    paintWarn();
                }, 'In the voice is the default: a [sound of ...] tag inside a spoken line. Only Eleven v3 and v4 can perform it. Other engines play sound effects instead: separate clips from your library, or made with the key in the Sounds tab. Both lets the Director choose.'),
                toggle('Intimate sounds', 'Off by default. Lets the Director add the sounds of sex scenes between adults, such as kissing, skin, wet sounds or a bed creaking.', 'intimateOn'),
                toggle('Only sounds the text shows', 'On by default. A sound is left out when no word of it is in its line or the lines beside it. The Log says how many.', 'soundCheck'),
            ]));
            rows.push(warnBox);
            rows.push(toggle('Find new speakers', 'On by default. Someone who speaks and is not in the cast is added to it, and given a voice nobody else uses.', 'findSpeakers'));
            rows.push(toggle('Big moments', 'On by default. The Director can mark an emotional peak, such as a scream. On ElevenLabs, that line gets a looser, more expressive voice. The audience can cheer on it.', 'bigMoments'));
            return rows;
        }));
        page.appendChild(main);
        const model = card('The Director’s model', 'Which model directs, and how it is asked. A fast, low-cost model works well, since the job is short.');
        const connBox = el('<div></div>');
        const drawConn = () => {
            connBox.innerHTML = '';
            const list = llmConnections || [];
            // With one connection, the chat can only be using that one, so it is
            // named in the first choice and not listed a second time.
            const only = list.length === 1 && S.directorConnection !== list[0].id ? list[0] : null;
            const opts = [{ id: '', label: 'The connection you chat with' + (only ? ' (' + (only.name || only.model) + ')' : '') }].concat(list.filter((c) => c !== only).map((c) => ({ id: c.id, label: c.name + (c.model ? ' (' + c.model + ')' : '') + (c.isDefault ? ', default' : ''), group: c.provider ? providerName(c.provider) : undefined })));
            if (S.directorConnection && !opts.some((o) => o.id === S.directorConnection))
                opts.push({ id: S.directorConnection, label: 'A connection that is gone' });
            connBox.appendChild(select('Which connection', opts, S.directorConnection, (v) => set({ directorConnection: v }), 'Any connection you set up in Lumiverse. Empty uses the one you chat with. ' + (llmWhy || '')));
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
        model.appendChild(connBox);
        model.appendChild(select('Let it think first', [
            { id: 'off', label: 'No, keep it quick' },
            { id: 'inherit', label: 'Whatever my connection is set to' },
            { id: 'custom', label: 'Yes, and I will say how much' },
        ], S.thinkingMode, (v) => {
            set({ thinkingMode: v });
            renderTab();
        }, 'Off by default, since directing rarely needs thinking and thinking costs more and takes longer.'));
        if (S.thinkingMode === 'custom') {
            const under = el('<div class="af-sub"><div class="af-under"></div></div>');
            under.firstElementChild.appendChild(select('How much thinking', [
                { id: 'auto', label: 'Auto, whatever the provider does' },
                { id: 'none', label: 'None' },
                { id: 'minimal', label: 'Minimal' },
                { id: 'low', label: 'Low' },
                { id: 'medium', label: 'Medium' },
                { id: 'high', label: 'High' },
                { id: 'xhigh', label: 'Extra high' },
                { id: 'max', label: 'Max' },
            ], S.thinkingEffort, (v) => set({ thinkingEffort: v }), 'Each provider decides what each level means. Directing rarely needs more than low.'));
            model.appendChild(under);
        }
        model.appendChild(select('Give up waiting after', [
            { id: '30', label: '30 seconds' },
            { id: '60', label: '1 minute' },
            { id: '120', label: '2 minutes' },
            { id: '300', label: '5 minutes' },
            { id: '0', label: 'Never' },
        ], String(S.timeoutSecs), (v) => set({ timeoutSecs: Number(v) }), '2 minutes by default. A Director that has not answered by then is stopped, and the message is read as written.'));
        model.appendChild(fold('Samplers', (body) => {
            body.appendChild(hint('Blank leaves each one to the connection, which is right for most people. Only a value you type is sent.'));
            for (const f of SAMPLER_FIELDS)
                body.appendChild(samplerRow(f));
        }));
        page.appendChild(model);
        const again = card('Asking again', 'What happens when a call fails. A refused call costs nothing. An answer that came back costs a call each time it is asked for again.');
        again.appendChild(select('Wait out a provider that will not take the call', ['0', '1', '2', '3', '4', '5'].map((n) => ({ id: n, label: n === '0' ? 'Do not wait' : n + (n === '1' ? ' time' : ' times') })), String(S.rateWaits), (v) => set({ rateWaits: Number(v) }), 'How many times to wait and ask again when the voice service or the Director’s provider is busy, rate-limited or loading. 2 by default. A refused key or an empty account is never asked again.'));
        again.appendChild(select('Ask again when the Director’s answer fails', ['0', '1', '2', '3'].map((n) => ({ id: n, label: n === '0' ? 'Do not ask again' : n + (n === '1' ? ' time' : ' times') })), String(S.retryDirector), (v) => set({ retryDirector: Number(v) }), 'For an answer that is empty, not in the shape asked for, a refusal, or one that changed the words of most lines. 1 by default. Each one is another call to the Director.'));
        const NOTE_PARTS = [
            { id: 'refused', label: 'After a refusal' },
            { id: 'empty', label: 'After an empty answer' },
            { id: 'shape', label: 'After an answer in the wrong shape' },
            { id: 'changed', label: 'After changed words' },
        ];
        again.appendChild(toggle('Send a note when it asks again', 'On by default. The next ask ends with a short note that says what went wrong with the last answer. A model that refused a scene by mistake often does the job when told it is fiction from your own story.', 'askNote', undefined, () => NOTE_PARTS.map((n) => {
            const cur = S.askNotes && typeof S.askNotes[n.id] === 'string' ? S.askNotes[n.id] : (builtInNotes[n.id] || '');
            const f = area(n.label, cur, (v) => {
                const next = Object.assign({}, S.askNotes || {});
                if (v.trim() === String(builtInNotes[n.id] || '').trim())
                    delete next[n.id];
                else
                    next[n.id] = v;
                set({ askNotes: next });
            }, { rows: 3, help: 'The note sent with the next ask after this failure. Empty sends no note for it. Back to built-in puts the built-in note back.' });
            const back = button('Back to built-in', async () => {
                if (!(await askSure('Back to the built-in note', 'Your wording of “' + n.label + '” is replaced by the built-in note. There is no undo.', 'Use the built-in note')))
                    return;
                const next = Object.assign({}, S.askNotes || {});
                delete next[n.id];
                set({ askNotes: next });
                const ta = f.querySelector('textarea');
                ta.value = builtInNotes[n.id] || '';
            });
            f.appendChild(back);
            return f;
        })));
        page.appendChild(again);
        page.appendChild(engineNotesCard());
        const dec = card('Decision model', 'An optional fast model that only answers questions. It picks who says each quoted line, and checks which lines describe a sound. Speakers the text already names, such as "said Wren", are taken from the text first.');
        if (!hostHasDecisions)
            dec.appendChild(notice('warn', 'This Lumiverse has no Decision connections for extensions. Update Lumiverse to use them.'));
        dec.appendChild(toggle('Use a Decision model', 'Off by default. If it cannot be asked, the Log says why and the Director does the whole job.', 'decisionsOn', undefined, () => {
            const box = el('<div></div>');
            const draw = () => {
                box.innerHTML = '';
                const dl = decisionList || [];
                const only = dl.length === 1 && S.decisionConnection !== dl[0].id ? dl[0] : null;
                const opts = [{ id: '', label: 'Your default Decision connection' + (only ? ' (' + (only.name || only.model) + ')' : '') }].concat(dl.filter((c) => c !== only).map((c) => ({ id: c.id, label: c.name + (c.model ? ' (' + c.model + ')' : '') + (c.hasKey ? '' : ', no key'), group: c.provider ? providerName(c.provider) : undefined })));
                if (S.decisionConnection && !opts.some((o) => o.id === S.decisionConnection))
                    opts.push({ id: S.decisionConnection, label: 'A connection that is gone' });
                box.appendChild(select('Which Decision connection', opts, S.decisionConnection, (v) => set({ decisionConnection: v }), 'Set these up under Decision models in Lumiverse’s Connections panel. ' + (decisionWhy || '')));
            };
            draw();
            if (!decisionList) {
                rpc({ type: 'list_decision_connections' }, 15000).then((r) => {
                    decisionList = (r && r.list) || [];
                    decisionWhy = (r && r.why) || (r && r.state === 'none' ? 'You have no Decision connections yet.' : '');
                    if (box.isConnected)
                        draw();
                }, () => {
                    decisionList = [];
                    decisionWhy = 'Your Decision connections could not be read: the backend did not answer.';
                    if (box.isConnected)
                        draw();
                });
            }
            const qs = [
                { id: 'who', label: 'The question about who speaks', help: 'Asked for each quoted line the text does not name a speaker for. {n} is the line’s number.' },
                { id: 'sound', label: 'The question about sounds', help: 'Asked for each narration line, while Sounds is on. {n} is the line’s number.' },
            ];
            const fields = qs.map((q) => {
                const cur = S.decisionQuestions && S.decisionQuestions[q.id] ? S.decisionQuestions[q.id] : builtInQuestions[q.id] || '';
                const f = area(q.label, cur, (v) => {
                    const next = Object.assign({}, S.decisionQuestions || {});
                    if (!v.trim() || v.trim() === String(builtInQuestions[q.id] || '').trim())
                        delete next[q.id];
                    else
                        next[q.id] = v;
                    set({ decisionQuestions: next });
                }, { rows: 3, help: q.help });
                f.setAttribute('data-af-question', q.id);
                f.appendChild(button('Back to built-in', async () => {
                    if (!(await askSure('Back to the built-in question', 'Your wording of “' + q.label + '” is replaced by the built-in one. There is no undo.', 'Use the built-in question')))
                        return;
                    const next = Object.assign({}, S.decisionQuestions || {});
                    delete next[q.id];
                    set({ decisionQuestions: next });
                    f.querySelector('textarea').value = builtInQuestions[q.id] || '';
                }));
                return f;
            });
            return [box].concat(fields);
        }));
        page.appendChild(dec);
        const pr = card('The Director’s prompt', 'Everything the Director is told, in full. You can change any of it. The message, your cast and your switches are sent with it as JSON, and the answer has to be JSON in the shape the end of the prompt asks for.');
        pr.appendChild(segmented('Send it as', [
            { id: 'system', label: 'System' },
            { id: 'user', label: 'User' },
            { id: 'assistant', label: 'Assistant' },
        ], S.promptRole || 'system', (v) => set({ promptRole: v }), 'System by default. Some models follow a prompt better as a user message. The message itself is always sent as user.'));
        const ta = el('<textarea class="af-field af-mono af-tall" spellcheck="false" aria-label="The Director’s prompt"></textarea>');
        ta.value = S.prompt || builtInPrompt;
        pr.appendChild(ta);
        const prRow = el('<div class="af-row"></div>');
        prRow.appendChild(expandButton('The Director’s prompt', ta));
        const stateText = el('<span class="af-note af-grow"></span>');
        const back = button('Back to the built-in prompt', async () => {
            if (!(await askSure('Back to the built-in prompt', 'Your own version of the Director’s prompt is replaced by the built-in one. There is no undo.', 'Use the built-in prompt')))
                return;
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
        ta.addEventListener('input', () => {
            set({ prompt: ta.value.trim() === builtInPrompt.trim() ? '' : ta.value });
            paintPromptState();
        });
        paintPromptState();
        page.appendChild(pr);
    }
    // ---------- Sounds ----------
    let soundFilter = '';
    let keyText = '';
    function renderSounds() {
        const k = card('ElevenLabs key for sound effects', 'Only needed when sounds are made as Sound effects. Lumiverse has no route for ElevenLabs sound effects, so this one feature needs a key here. It is kept in Lumiverse’s secure storage and only sent to api.elevenlabs.io. Sounds in the voice need no key.');
        const kid = rid('key');
        const kf = el('<div class="af-col"></div>');
        kf.appendChild(labelRow('Key for api.elevenlabs.io', 'Make a key in ElevenLabs with the Sound Effects permission, paste it here and press Save. It is tested at once. The panel never shows it again.', kid));
        const kin = el('<input type="password" class="af-field" id="' + kid + '" autocomplete="off" spellcheck="false">');
        kin.placeholder = hasKey ? 'A key is saved' : 'Paste your ElevenLabs key';
        kf.appendChild(kin);
        k.appendChild(kf);
        const kst = el('<p class="af-status"></p>');
        kst.textContent = keyText || (hasKey ? 'A key is saved.' : 'No key is saved. Sound effects come only from your own uploads.');
        const krow = el('<div class="af-row"></div>');
        const doKey = async (msg, busyWords) => {
            kst.textContent = busyWords;
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
        }, 'af-primary'));
        const testB = button('Test', () => doKey({ type: 'key_test' }, 'Testing the key…'));
        const forget = button('Forget', () => doKey({ type: 'key_forget' }, 'Removing the key…'), 'af-danger');
        testB.disabled = !hasKey;
        forget.disabled = !hasKey;
        krow.appendChild(testB);
        krow.appendChild(forget);
        k.appendChild(krow);
        k.appendChild(kst);
        k.appendChild(toggle('Make new sounds with ElevenLabs', 'On by default. Off: only sounds already in your library are played, and no credits are spent on sounds.', 'makeSounds', undefined, () => [
            select('Sound length', [
                { id: '0', label: 'Let ElevenLabs choose' },
                { id: '1', label: '1 second' },
                { id: '2', label: '2 seconds' },
                { id: '3', label: '3 seconds' },
                { id: '5', label: '5 seconds' },
                { id: '10', label: '10 seconds' },
            ], String(S.soundSeconds || 0), (v) => set({ soundSeconds: Number(v) }), 'How long a new sound is. Let ElevenLabs choose is the default. Longer sounds cost more credits.'),
        ]));
        page.appendChild(k);
        const lib = card('Your sound library', 'Every sound made is saved here, so the same sound is free the next time. Your own clips are used first. Trigger words make a clip play whenever a sound description holds one of them.', '<span class="af-pill">' + sounds.length + '</span>');
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
        }, 'af-primary'));
        const search = el('<input type="search" class="af-field af-grow" placeholder="Search sounds" aria-label="Search sounds">');
        search.value = soundFilter;
        urow.appendChild(search);
        lib.appendChild(urow);
        lib.appendChild(ust);
        const listBox = el('<div class="af-sounds"></div>');
        lib.appendChild(listBox);
        const drawList = () => {
            listBox.innerHTML = '';
            const f = soundFilter.trim().toLowerCase();
            const shown = sounds.filter((s) => !f || s.name.toLowerCase().indexOf(f) >= 0 || (s.triggers || []).some((t) => t.indexOf(f) >= 0)).slice().reverse();
            if (!shown.length) {
                listBox.appendChild(el('<div class="af-empty">' + (sounds.length ? 'No sound matches.' : 'No sounds yet. Sounds made as effects are saved here, and you can upload your own.') + '</div>'));
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
        const r = el('<div class="af-sound"><button type="button" class="af-round" title="Play" aria-label="Play">' + ICON_PLAY + '</button>' +
            '<div class="af-sound-main"><div class="af-sound-name"></div><div class="af-sound-meta">' + (s.source === 'upload' ? 'Yours' : 'Made by ElevenLabs') + ' · ' +
            Math.max(1, Math.round((s.bytes || 0) / 1024)) + ' KB · played ' + (s.uses || 0) + ' times</div>' +
            '<input type="text" class="af-field" placeholder="Trigger words, with commas"></div>' +
            (s.source === 'upload' ? '' : '<button type="button" class="af-btn" data-again>Make it again</button>') +
            '<button type="button" class="af-btn af-danger">Delete</button></div>');
        const again = r.querySelector('[data-again]');
        if (again)
            again.addEventListener('click', () => soundAgain(s.name, s.id));
        r.querySelector('.af-sound-name').textContent = s.name;
        const trig = r.querySelector('input');
        trig.setAttribute('aria-label', 'Trigger words for ' + s.name);
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
        r.querySelector('.af-danger').addEventListener('click', async () => {
            if (!(await askSure('Delete this sound', '“' + s.name + '” is deleted from your library. ' + (s.source === 'upload' ? 'Upload it again to get it back.' : 'If it is needed again, a new one is made, which costs ElevenLabs credits.'), 'Delete', true)))
                return;
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
    let setupChecked = 0;
    function renderSettings() {
        const a = card('Auto Foley', 'Auto Foley speaks through a TTS connection in Lumiverse, so the key for it stays in Lumiverse. It works with models that act: ElevenLabs, Fish Audio, Gemini 3.8 and Chatterbox-Turbo.');
        a.appendChild(toggle('Auto Foley is on', 'On by default. Off: no buttons on messages, nothing plays, and nothing is sent anywhere.', 'enabled', () => {
            if (!S.enabled)
                stop();
            syncSlots();
        }));
        const connBox = el('<div></div>');
        const drawConn = () => {
            connBox.innerHTML = '';
            const hostPick = hostVoice && hostVoice.ttsConnectionId ? ttsConnections.find((c) => c.id === hostVoice.ttsConnectionId) : null;
            // The first choice follows Lumiverse's Voice settings. With one
            // connection it names that one, and it is not listed a second time.
            const only = ttsConnections.length === 1 && S.ttsConnection !== ttsConnections[0].id ? ttsConnections[0] : null;
            const named = hostPick || only;
            const opts = [{ id: '', label: 'Lumiverse’s TTS connection' + (named ? ' (' + named.name + ')' : '') }].concat(ttsConnections.filter((c) => c !== only).map((c) => ({ id: c.id, label: c.name + (engineFor(c, c.model).supported ? '' : ', no tags'), group: engineGroup(c) })));
            if (S.ttsConnection && !opts.some((o) => o.id === S.ttsConnection))
                opts.push({ id: S.ttsConnection, label: 'A connection that is gone' });
            connBox.appendChild(select('TTS connection', opts, S.ttsConnection, (v) => {
                set({ ttsConnection: v });
                drawConn();
            }, 'The connection Auto Foley speaks through. The first choice follows the connection picked in Lumiverse’s Voice settings. A person in the Cast tab can use another one.'));
            if (ttsWhy)
                connBox.appendChild(notice('warn', ttsWhy));
            const conn = activeConnection();
            if (conn) {
                // An OpenAI-style connection may be a Chatterbox server whose name
                // does not say so.
                if (String(conn.provider || '').toLowerCase() === 'openai_tts') {
                    const found = engineOf(conn, conn.model);
                    const chosen = S.engines && S.engines[conn.id] ? S.engines[conn.id] : '';
                    connBox.appendChild(select('What this connection runs', [
                        { id: '', label: 'Found from the connection (' + (found.supported ? found.label : 'not a Chatterbox-Turbo server') + ')' },
                        { id: 'chatterbox_turbo', label: 'Chatterbox-Turbo' },
                    ], chosen, (v) => {
                        const next = Object.assign({}, S.engines || {});
                        if (v)
                            next[conn.id] = v;
                        else
                            delete next[conn.id];
                        set({ engines: next });
                        drawConn();
                    }, 'Found by the word Chatterbox in the connection’s name, model or address. Pick Chatterbox-Turbo here when the name does not say it.'));
                }
                const eng = engineFor(conn, conn.model);
                connBox.appendChild(hint(esc((eng.supported ? 'Engine: ' + eng.label + '. ' : '') + engineAbility(eng))));
                for (const w of engineWarnings(eng, conn, conn.model))
                    connBox.appendChild(notice(eng.supported ? 'warn' : 'bad', w));
            }
        };
        drawConn();
        Promise.all([loadTtsConnections(), loadHostVoice()]).then(() => {
            if (connBox.isConnected)
                drawConn();
        });
        a.appendChild(connBox);
        a.appendChild(fold('How Auto Foley works with Lumiverse’s own voice settings', (body) => {
            body.appendChild(hint('Auto Foley does its own reading, so most of Lumiverse’s Voice settings do not change it:'));
            body.appendChild(el('<ul class="af-steps">' +
                '<li><b>Enable text-to-speech</b> can stay on. Auto Foley works either way.</li>' +
                '<li><b>Auto-play responses</b> should be off while Auto Foley’s Autoplay is on, or each reply is read twice.</li>' +
                '<li><b>Connection</b> is the one Auto Foley uses, unless you pick another above.</li>' +
                '<li><b>Speed</b>, <b>Volume</b>, the separate narrator voice and Speech detection are Lumiverse’s own. Auto Foley uses the Cast tab and the Mixer instead.</li>' +
                '<li>Lumiverse’s own play button on a message still reads it the plain way. The boom microphone is Auto Foley’s.</li>' +
                '</ul>'));
        }));
        page.appendChild(a);
        const btns = card('Buttons', 'Where the boom microphone appears.');
        btns.appendChild(toggle('A button on every message', 'On by default. One tap performs that message, an older one or the greeting too. It sits in each message\u2019s own row of buttons, in the space Lumiverse leaves for extensions.', 'messageButton', () => syncSlots()));
        btns.appendChild(toggle('A button in the chat\u2019s row of controls', 'On by default. One tap performs the newest reply. It goes in Lumiverse\u2019s own row of chat buttons, in the place the app leaves there for extensions.', 'barButton', () => syncSlots()));
        btns.appendChild(toggle('In the Extras menu', 'On by default. Adds Perform the latest reply to the Extras menu of the message box, and Stop Auto Foley while something plays.', 'extrasMenu', () => syncExtras()));
        page.appendChild(btns);
        const p = card('Playing');
        p.appendChild(toggle('Autoplay new replies', 'Off by default. Each new reply is performed as soon as it finishes.', 'autoplay', undefined, () => [
            select('Wait before autoplay', [
                { id: '0', label: 'Play at once' },
                { id: '3', label: '3 seconds' },
                { id: '5', label: '5 seconds' },
                { id: '10', label: '10 seconds' },
                { id: '20', label: '20 seconds' },
            ], String(S.autoplayDelay || 0), (v) => set({ autoplayDelay: Number(v) }), 'Play at once by default. Gives another extension time to change a reply first, such as Auto Refine. A reply changed while it plays starts again with the new text either way.'),
            toggle('Read your own messages', 'Off by default. Your own messages are performed too, in your persona’s voice. The button on a message always works.', 'readOwnMessages'),
        ].concat(bothAutoplayWarning())));
        p.appendChild(toggle('Prepare replies ahead', 'Off by default. With Autoplay off, each new reply is directed in the background, so pressing Play starts at once. It costs a Director call for every reply, played or not.', 'prepareAhead'));
        p.appendChild(segmented('Narration', [
            { id: 'read', label: 'Read aloud' },
            { id: 'sounds', label: 'Sounds only' },
            { id: 'skip', label: 'Skip' },
        ], S.narration, (v) => set({ narration: v }), 'What happens to text outside quotes. Read aloud uses the Narrator’s voice, and is the default. Sounds only plays the sounds of what happens with no narrator. Skip leaves narration out.'));
        p.appendChild(toggle('Save the performance to the message', 'Off by default. After a message plays through, its audio is saved to the message, and Lumiverse’s own player plays it again for free. It uses storage on the server.', 'saveAudio'));
        p.appendChild(keptAudioBox());
        p.appendChild(toggle('Reduce motion', 'Off by default. On, nothing in Auto Foley moves or fades. Your device’s own reduce motion setting does the same.', 'reduceMotion'));
        page.appendChild(p);
        page.appendChild(audienceCard());
        page.appendChild(lookCard());
        const r = card('Reading messages', 'Thinking a model writes in a message, such as a <think> block, is never read aloud. Neither is anything in square brackets, HTML or code.');
        r.appendChild(select('How speech is marked', [
            { id: 'auto', label: 'Quote marks (Auto)' },
            { id: 'single', label: 'Quote marks, single quotes too' },
            { id: 'plain', label: 'Plain text is speech, *asterisks* are actions' },
        ], S.speechMarks || 'auto', (v) => set({ speechMarks: v }), 'Auto reads "double", “curly”, «guillemet», „low” and 「corner」 quotes, and a line that starts with a dash. Pick the plain style for stories written as *she waves* Hello.'));
        r.appendChild(toggle('Leave out trackers and status blocks', 'On by default. Tables, status lines such as Time: 9:40 PM, lines that start with an emoji, folded blocks, and bars are not read. The patterns are below.', 'skipOn', undefined, () => {
            const cur = S.skipPatterns || builtInSkips;
            const said = el('<div class="af-col"></div>');
            const f = area('Patterns to leave out', cur, (v) => {
                const mine = v.trim() === builtInSkips.trim() ? '' : v;
                set({ skipPatterns: mine });
                checkSkips(v, said);
            }, { rows: 7, cls: 'af-mono', help: 'One pattern on each line. Text that matches is not read. /pattern/flags works too.' });
            f.setAttribute('data-af-skips', '');
            const back = button('Use defaults', async () => {
                if (!(await askSure('Use the default patterns', 'Your own patterns are replaced by the built-in ones. There is no undo.', 'Use defaults')))
                    return;
                set({ skipPatterns: '' });
                const ta = f.querySelector('textarea');
                ta.value = builtInSkips;
                checkSkips(builtInSkips, said);
            });
            f.appendChild(back);
            checkSkips(cur, said);
            return [f, said];
        }));
        r.appendChild(area('Extra thinking tag names', (S.extraThinkTags || []).join('\n'), (v) => set({ extraThinkTags: v.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20) }), {
            placeholder: 'musing',
            help: 'More tag names that hold thinking, one per line, without the angle brackets. Text inside these tags is not read aloud. The same setting as in Auto Retry and Auto Refine.',
        }));
        page.appendChild(r);
        const c = card('Check my setup', 'Checks your TTS connection, the Director, the Decision model and the sounds key. It speaks nothing, so it spends no voice credits.');
        const list = el('<ul class="af-checks"></ul>');
        const run = button('Check my setup', async () => {
            run.disabled = true;
            const ask = ++setupChecked;
            list.innerHTML = '';
            const add = (ok, words) => {
                if (ask !== setupChecked)
                    return;
                const li = document.createElement('li');
                li.dataset.ok = ok == null ? '' : ok ? 'true' : 'false';
                const span = document.createElement('span');
                span.textContent = words;
                li.appendChild(span);
                list.appendChild(li);
            };
            await Promise.all([loadTtsConnections(), loadHostVoice(), readChat()]);
            add(chatInfo.kind !== 'none', chatInfo.kind === 'none' ? 'No chat is open. Open one to perform its messages.' : chatInfo.kind === 'temporary' ? 'A temporary chat is open.' : 'A chat is open' + (chatInfo.name ? ', with ' + chatInfo.name : '') + '.');
            const conn = activeConnection();
            if (!conn)
                add(false, ttsWhy || 'No TTS connection is picked.');
            else {
                add(conn.has_api_key !== false, conn.has_api_key === false ? 'The connection "' + conn.name + '" has no key saved in Lumiverse.' : 'Speaking through "' + conn.name + '".');
                const eng = engineFor(conn, conn.model);
                if (eng.supported)
                    add(true, 'Its engine is ' + eng.label + '. ' + engineAbility(eng));
                for (const w of engineWarnings(eng, conn, conn.model))
                    add(false, w);
                const v = await loadVoices(conn.id);
                add(!!v.voices.length, v.voices.length ? v.voices.length + ' voices are available.' : v.why || 'No voices came back from ' + serviceName(conn) + '.');
            }
            // People who speak through a connection of their own.
            const own = S.cast.filter((x) => x.connection && x.connection !== (conn && conn.id));
            for (const x of own) {
                const cn = connById(x.connection);
                if (!cn)
                    add(false, x.name + ' speaks through a connection that is gone. Pick another in the Cast tab.');
                else {
                    const e2 = engineFor(cn, pickOf(x, cn).model || cn.model);
                    add(e2.supported, e2.supported ? x.name + ' speaks through "' + cn.name + '", ' + e2.label + '.' : x.name + ': ' + noTagsWhy(cn, pickOf(x, cn).model || cn.model));
                }
            }
            if (bothAutoplay())
                add(false, 'Lumiverse’s own Auto-play responses is on too, so new replies would be read twice. Turn it off on Lumiverse’s Voice settings tab.');
            if (S.directorOn) {
                try {
                    const res = await rpc({ type: 'check_director' }, 150000);
                    add(!!(res && res.ok), (res && res.text) || 'The Director did not answer.');
                }
                catch (e) {
                    add(false, 'The Director could not be checked: ' + String((e && e.message) || ''));
                }
            }
            else
                add(null, 'The Director is off.');
            if (S.decisionsOn) {
                try {
                    const res = await rpc({ type: 'check_decisions' }, 30000);
                    add(!!(res && res.ok), (res && res.text) || 'The Decision model could not be checked.');
                }
                catch (e) {
                    add(false, 'The Decision model could not be checked: ' + String((e && e.message) || ''));
                }
            }
            else
                add(null, 'The Decision model is off.');
            if (S.soundsOn && S.soundStyle !== 'voice' && S.makeSounds) {
                try {
                    const res = await rpc({ type: 'key_test' }, 40000);
                    add(!!(res && res.ok), res && res.ok ? 'Sound effects: ' + res.text : 'Sound effects: ' + ((res && res.text) || 'the key could not be checked.') + ' Your uploads still play.');
                }
                catch (e) {
                    add(false, 'The sound effects key could not be checked: ' + String((e && e.message) || ''));
                }
            }
            else
                add(null, !S.soundsOn ? 'Sounds are off.' : S.soundStyle === 'voice' ? 'Sounds are made in the voice, so no sound effects key is needed.' : 'Making new sounds is off. Your uploads still play.');
            run.disabled = false;
        }, 'af-primary');
        c.appendChild(run);
        c.appendChild(list);
        page.appendChild(c);
        page.appendChild(transferCard());
        page.appendChild(debugCard());
    }
    // ---------- Your whole setup ----------
    // One file with your settings, your Director prompt and your cast. Not the
    // sound library, which is audio files, and never the key, which belongs in
    // Lumiverse's secure storage. Start again is in the same card, since it is
    // the other half of the same subject.
    const TRANSFER = [
        { id: 'settings', label: 'Settings' },
        { id: 'prompt', label: 'The Director’s prompt and notes' },
        { id: 'cast', label: 'The cast and their voices' },
    ];
    const RESETS = TRANSFER.concat([
        { id: 'sounds', label: 'The sound library' },
        { id: 'audio', label: 'Kept audio and directed messages' },
        { id: 'key', label: 'The sound effects key' },
    ]);
    // The setting keys each part covers. Which parts are ticked are settings
    // too, but they are never carried in a file or put back by a reset.
    const NOT_SETTINGS = ['cast', 'groups', 'prompt', 'promptRole', 'askNotes', 'engineNotes', 'decisionQuestions', 'exportParts', 'importParts', 'resetParts', 'guideSeen'];
    const settingKeys = () => Object.keys(DEFAULTS).filter((k) => NOT_SETTINGS.indexOf(k) < 0);
    let transferSaid = '';
    let transferKind = '';
    let resetSaid = '';
    let resetArmed = false;
    function partsPicker(key, parts) {
        const wrap = el('<div class="af-col" style="gap:8px"></div>');
        for (const p of parts) {
            const id = rid('pt');
            const box = el('<input type="checkbox" class="af-box" role="switch" id="' + id + '">');
            box.checked = (S[key] || []).indexOf(p.id) >= 0;
            box.setAttribute('aria-label', p.label);
            box.addEventListener('change', () => {
                const now = (S[key] || []).filter((x) => x !== p.id);
                if (box.checked)
                    now.push(p.id);
                set({ [key]: parts.map((x) => x.id).filter((x) => now.indexOf(x) >= 0) });
                if (key === 'resetParts')
                    paintResetButton();
            });
            wrap.appendChild(labelRow(p.label, '', undefined, box));
        }
        return wrap;
    }
    let paintResetButton = () => { };
    function transferCard() {
        const c = card('Your whole setup', 'Save your setup to a file, or load it from one. Loading replaces what you have, so save a file first if you want a way back.');
        const row = el('<div class="af-row"></div>');
        row.appendChild(button('Export to file', () => {
            const parts = S.exportParts || [];
            if (!parts.length) {
                transferSaid = 'Nothing is chosen, so there would be nothing in the file.';
                transferKind = 'bad';
                renderTab();
                return;
            }
            const body = { extension: 'auto-foley', version: VERSION, savedAt: new Date().toISOString(), parts: parts.slice() };
            if (parts.indexOf('settings') >= 0) {
                body.settings = {};
                for (const k of settingKeys())
                    body.settings[k] = S[k];
            }
            if (parts.indexOf('prompt') >= 0) {
                body.prompt = S.prompt || '';
                body.askNotes = JSON.parse(JSON.stringify(S.askNotes || {}));
                body.engineNotes = JSON.parse(JSON.stringify(S.engineNotes || {}));
                body.decisionQuestions = JSON.parse(JSON.stringify(S.decisionQuestions || {}));
                body.promptRole = S.promptRole || 'system';
            }
            if (parts.indexOf('cast') >= 0) {
                body.cast = JSON.parse(JSON.stringify(S.cast || []));
                body.groups = JSON.parse(JSON.stringify(S.groups || []));
            }
            let ok = false;
            try {
                const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'auto-foley-setup.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                ok = true;
            }
            catch (_) { }
            transferSaid = ok ? 'Exported ' + parts.length + (parts.length === 1 ? ' part.' : ' parts.') : 'The browser would not save the file. Some private windows block downloads.';
            transferKind = ok ? 'good' : 'bad';
            renderTab();
        }));
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = 'application/json,.json';
        picker.style.display = 'none';
        picker.addEventListener('change', () => {
            const f = picker.files && picker.files[0];
            picker.value = '';
            if (!f)
                return;
            const reader = new FileReader();
            reader.onload = () => {
                transferSaid = applyImport(String(reader.result || ''));
                renderTab();
            };
            reader.onerror = () => {
                transferSaid = 'That file could not be read.';
                transferKind = 'bad';
                renderTab();
            };
            reader.readAsText(f);
        });
        row.appendChild(button('Import from file', () => {
            try {
                picker.click();
            }
            catch (_) {
                transferSaid = 'The browser would not open a file picker.';
                transferKind = 'bad';
                renderTab();
            }
        }));
        row.appendChild(picker);
        c.appendChild(row);
        if (transferSaid) {
            const st = el('<p class="af-status"></p>');
            st.textContent = transferSaid;
            st.dataset.kind = transferKind;
            c.appendChild(st);
        }
        c.appendChild(fold('What goes in the file', (b) => {
            b.appendChild(hint('The sound library and the key are never in a file.'));
            b.appendChild(partsPicker('exportParts', TRANSFER));
        }));
        c.appendChild(fold('What to take from a file', (b) => {
            b.appendChild(hint('A file can hold more than you want back. Anything switched off here is skipped, whatever the file holds.'));
            b.appendChild(partsPicker('importParts', TRANSFER));
        }));
        c.appendChild(el('<div class="af-rule"></div>'));
        c.appendChild(el('<span class="af-lab">Start again</span>'));
        c.appendChild(notice('bad', 'This cannot be undone. Export first if there is any chance you want your setup back. Only the parts switched on under What to put back are reset. With every part on, everything Auto Foley keeps is deleted.'));
        const rrow = el('<div class="af-row"></div>');
        const go = button('Reset everything', () => resetAll(), 'af-danger');
        paintResetButton = () => {
            const chosen = (S.resetParts || []).length;
            const label = go.querySelector('span');
            label.textContent = chosen === RESETS.length ? 'Reset everything' : 'Reset the ' + chosen + ' chosen';
            go.disabled = !chosen;
        };
        paintResetButton();
        rrow.appendChild(go);
        c.appendChild(rrow);
        if (resetSaid) {
            const st = el('<p class="af-status"></p>');
            st.textContent = resetSaid;
            st.dataset.kind = resetArmed ? 'bad' : 'good';
            c.appendChild(st);
        }
        c.appendChild(fold('What to put back', (b) => {
            b.appendChild(hint('Only what is switched on here is reset. Everything else is left exactly as it is, so you can put your settings back to their defaults and keep your cast and their voices.'));
            b.appendChild(partsPicker('resetParts', RESETS));
        }));
        return c;
    }
    // Reads a file back. Every value is checked again by the backend when it is
    // saved, so a hand-edited file cannot leave the panel in a broken state.
    function applyImport(raw) {
        let body = null;
        try {
            body = JSON.parse(raw);
        }
        catch (_) {
            transferKind = 'bad';
            return 'That file is not a setup file. It could not be read as JSON.';
        }
        if (!body || body.extension !== 'auto-foley') {
            transferKind = 'bad';
            return 'That file is not an Auto Foley setup. Nothing was changed.';
        }
        const want = S.importParts || [];
        const took = [];
        if (want.indexOf('settings') >= 0 && body.settings && typeof body.settings === 'object') {
            for (const k of settingKeys())
                if (k in body.settings)
                    S[k] = body.settings[k];
            took.push('settings');
        }
        if (want.indexOf('prompt') >= 0 && typeof body.prompt === 'string') {
            S.prompt = body.prompt;
            if (body.askNotes && typeof body.askNotes === 'object')
                S.askNotes = body.askNotes;
            if (body.engineNotes && typeof body.engineNotes === 'object')
                S.engineNotes = body.engineNotes;
            if (body.decisionQuestions && typeof body.decisionQuestions === 'object')
                S.decisionQuestions = body.decisionQuestions;
            if (typeof body.promptRole === 'string')
                S.promptRole = body.promptRole;
            took.push('the Director’s prompt and notes');
        }
        if (want.indexOf('cast') >= 0 && Array.isArray(body.cast)) {
            S.cast = body.cast;
            S.groups = Array.isArray(body.groups) ? body.groups : [];
            took.push('the cast');
        }
        if (!took.length) {
            transferKind = 'bad';
            return 'Nothing was taken. The file holds none of the parts switched on under What to take from a file.';
        }
        save();
        syncSlots();
        transferKind = 'good';
        return 'Imported ' + took.join(', ') + '.';
    }
    // Keep made audio: how much, how much is kept now, and a way to clear it.
    function keptAudioBox() {
        const box = el('<div class="af-col" data-af-row="keepAudio"></div>');
        box.appendChild(select('Keep made audio', [
            { id: '0', label: 'Do not keep it' },
            { id: '50', label: 'Up to 50 MB' },
            { id: '100', label: 'Up to 100 MB' },
            { id: '250', label: 'Up to 250 MB' },
            { id: '500', label: 'Up to 500 MB' },
        ], String(S.keepAudio), (v) => {
            set({ keepAudio: Number(v) });
            paintKept();
        }, 'Up to 100 MB by default. Each spoken line is kept in your account, so a message played again, even after you leave the chat or Lumiverse, spends nothing. The oldest goes first.'));
        const row = el('<div class="af-row"></div>');
        const said = el('<span class="af-note af-grow" data-af="kept"></span>');
        const clear = button('Clear kept audio', async () => {
            if (!(await askSure('Clear kept audio', 'Every kept line and every directed message is deleted. Playing them again makes them again, which costs voice credits and a Director call. There is no undo.', 'Clear', true)))
                return;
            clear.disabled = true;
            try {
                const r = await rpc({ type: 'clips_clear' }, 60000);
                if (r && r.error)
                    log(r.error, 'bad');
                showKept(r);
            }
            catch (_) {
                log('The kept audio could not be cleared: the backend did not answer.', 'bad');
            }
            clear.disabled = false;
        }, 'af-danger');
        row.appendChild(said);
        row.appendChild(clear);
        box.appendChild(row);
        const showKept = (r) => {
            if (!said.isConnected)
                return;
            const n = Number(r && r.count) || 0;
            const mb = (Number(r && r.bytes) || 0) / (1024 * 1024);
            said.textContent = n ? 'Kept now: ' + n + (n === 1 ? ' line, ' : ' lines, ') + (mb < 0.1 ? 'under 0.1' : mb.toFixed(1)) + ' MB.' : 'Nothing is kept yet.';
            clear.disabled = !n;
        };
        const paintKept = () => {
            row.hidden = !S.keepAudio;
            rpc({ type: 'clips_state' }, 15000).then(showKept, () => { });
        };
        paintKept();
        return box;
    }
    // The note sent with each engine, saying how it reads tags. The one for the
    // engine in use is open, and the rest sit in a fold.
    function engineNotesCard() {
        const c = card('Notes for each voice engine', 'Each engine reads acting directions its own way. The Director gets the note for the engine it writes for. Change a note here if your engine needs something else.');
        const now = mainEngine();
        const noteField = (e) => {
            const cur = S.engineNotes && typeof S.engineNotes[e.id] === 'string' ? S.engineNotes[e.id] : builtInEngineNotes[e.id] || '';
            const f = area(e.label, cur, (v) => {
                const next = Object.assign({}, S.engineNotes || {});
                if (v.trim() === String(builtInEngineNotes[e.id] || '').trim())
                    delete next[e.id];
                else
                    next[e.id] = v;
                set({ engineNotes: next });
            }, { rows: 4, help: 'Sent to the Director with the rules when this engine speaks. Empty sends the built-in note.' });
            f.setAttribute('data-af-engine-note', e.id);
            f.appendChild(button('Back to built-in', async () => {
                if (!(await askSure('Back to the built-in note', 'Your wording of the note for ' + e.label + ' is replaced by the built-in one. There is no undo.', 'Use the built-in note')))
                    return;
                const next = Object.assign({}, S.engineNotes || {});
                delete next[e.id];
                set({ engineNotes: next });
                const ta = f.querySelector('textarea');
                ta.value = builtInEngineNotes[e.id] || '';
            }));
            return f;
        };
        if (now.supported) {
            c.appendChild(hint(esc('In use now: ' + now.label + '. ' + engineAbility(now))));
            c.appendChild(noteField(now));
        }
        c.appendChild(fold('The notes for the other engines', (body) => {
            for (const e of ENGINE_LIST)
                if (e.id !== now.id)
                    body.appendChild(noteField(e));
        }));
        return c;
    }
    // Says which lines of the pattern box cannot be used.
    let skipAsk = 0;
    function checkSkips(text, box) {
        const ask = ++skipAsk;
        rpc({ type: 'skip_check', text }, 15000).then((r) => {
            if (ask !== skipAsk || !box.isConnected)
                return;
            box.innerHTML = '';
            const bad = (r && Array.isArray(r.bad) ? r.bad : []).slice(0, 5);
            for (const b of bad)
                box.appendChild(notice('warn', 'This pattern is not used: ' + b + '.'));
        }, () => { });
    }
    // ---- Permissions ----
    // Which of Auto Foley's permissions Lumiverse has granted, read when the
    // panel opens. A refused one that something switched on needs is said at
    // the top of every tab, with what it stops.
    let granted = null;
    async function readGranted() {
        let got = null;
        try {
            if (ctx.permissions && typeof ctx.permissions.getGranted === 'function')
                got = await ctx.permissions.getGranted();
        }
        catch (_) {
            got = null;
        }
        if (!Array.isArray(got))
            return;
        const was = JSON.stringify(granted);
        granted = got.slice();
        if (JSON.stringify(granted) !== was && alive)
            renderTab();
    }
    function permissionWarnings() {
        if (!granted || !S.enabled)
            return [];
        const has = (p) => granted.indexOf(p) >= 0;
        const out = [];
        const where = ' Grant it to Auto Foley in Lumiverse, under Extensions.';
        if (S.directorOn && !has('generation'))
            out.push('The Generation permission is refused, so the Director cannot be asked and messages are read as written.' + where);
        if (S.decisionsOn && !has('decisions'))
            out.push('The Decision models permission is refused, so the Decision model cannot be asked.' + where);
        if (S.soundsOn && S.makeSounds && !has('cors_proxy'))
            out.push('The CORS proxy permission is refused, so new sound effects cannot be made. Sounds already in your library still play.' + where);
        if (S.widgetOn && !has('ui_panels'))
            out.push('The UI panels permission is refused, so the floating player cannot be shown.' + where);
        return out;
    }
    // Asks before something is put back or deleted. Lumiverse's own dialog is
    // used, and the browser's when that is missing.
    async function askSure(title, message, confirmLabel, danger) {
        try {
            if (ctx.ui && typeof ctx.ui.showConfirm === 'function') {
                const r = await ctx.ui.showConfirm({ title, message, variant: danger ? 'danger' : 'default', confirmLabel });
                return !!(r && r.confirmed);
            }
        }
        catch (_) { }
        try {
            return confirm(title + '\n\n' + message);
        }
        catch (_) {
            return false;
        }
    }
    async function resetAll() {
        const chosen = S.resetParts || [];
        if (!chosen.length)
            return;
        const names = RESETS.filter((p) => chosen.indexOf(p.id) >= 0).map((p) => p.label.toLowerCase()).join(', ');
        let yes = null;
        try {
            if (ctx.ui && typeof ctx.ui.showConfirm === 'function') {
                const r = await ctx.ui.showConfirm({
                    title: chosen.length === RESETS.length ? 'Reset everything' : 'Reset these?',
                    message: 'This puts back the defaults for: ' + names + '. There is no undo.',
                    variant: 'danger',
                    confirmLabel: 'Reset',
                });
                yes = !!(r && r.confirmed);
            }
        }
        catch (_) { }
        if (yes === null) {
            // No confirm dialog: the button is pressed twice instead.
            if (!resetArmed) {
                resetArmed = true;
                resetSaid = 'Press it again to confirm. There is no undo.';
                renderTab();
                const t = setTimeout(() => {
                    timers.delete(t);
                    resetArmed = false;
                    resetSaid = '';
                    if (tab === 'settings')
                        renderTab();
                }, 6000);
                timers.add(t);
                return;
            }
            yes = true;
        }
        resetArmed = false;
        if (!yes)
            return;
        try {
            const r = await rpc({ type: 'reset', parts: chosen }, 30000);
            if (r && r.settings) {
                S = Object.assign({}, DEFAULTS, r.settings);
                keepLocal();
            }
            if (r && Array.isArray(r.sounds))
                sounds = r.sounds;
            if (r && typeof r.hasKey === 'boolean')
                hasKey = r.hasKey;
            resetSaid = r && r.ok ? 'Put back: ' + names + '.' : (r && r.error) || 'The reset did not finish.';
            log(resetSaid, r && r.ok ? '' : 'bad');
        }
        catch (e) {
            resetSaid = 'The reset did not finish: the backend did not answer.';
            log(resetSaid, 'bad');
        }
        syncSlots();
        renderTab();
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
            lines.push('tts connection: ' + (conn ? 'found, provider ' + (conn.provider || 'not set') + ', model ' + (conn.model || 'not set') + ', engine ' + engineFor(conn, conn.model).id + ', key ' + (conn.has_api_key === false ? 'MISSING' : 'saved') : ttsWhy || 'none picked'));
            if (conn && voiceCache[conn.id])
                lines.push('voices on it: ' + voiceCache[conn.id].voices.length);
            lines.push('sound effects key: ' + (hasKey ? 'saved' : 'none') + ', library: ' + sounds.length + ' sounds');
            lines.push('cast (' + (S.cast || []).length + '):');
            (S.cast || []).forEach((m, k) => {
                const role = roles[k].role;
                lines.push('  ' + role + ': added by ' + m.addedBy + (m.connection ? ', own connection ' + (connById(m.connection) ? engineFor(connById(m.connection)).id : 'gone') : '') +
                    ', voice ' + (pickOf(m, connOf(m)).voice ? 'picked' : 'the connection\'s') + ', model ' + (pickOf(m, connOf(m)).model || 'the connection\'s') +
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
                for (const p of ['generation', 'decisions', 'cors_proxy', 'ui_panels'])
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
        c.appendChild(hint('Optional. Adding this to a bug report helps show exactly what went wrong. Nothing leaves your device until you paste it. People in your cast are named by their role, and no message text is included.'));
        for (const part of DEBUG_PARTS) {
            const box = el('<input type="checkbox" class="af-box" role="switch">');
            box.checked = !!debugPicked[part.id];
            box.setAttribute('aria-label', part.label);
            box.addEventListener('change', () => {
                debugPicked[part.id] = box.checked;
            });
            c.appendChild(labelRow(part.label, '', undefined, box));
        }
        const area = el('<textarea class="af-field af-mono" rows="8" spellcheck="false" aria-label="Debug info" placeholder="Press Build preview to fill this, then edit out anything private before copying."></textarea>');
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
        }, 'af-primary'));
        row.appendChild(expandButton('Debug info', area));
        c.appendChild(row);
        c.appendChild(area);
        c.appendChild(status);
        return c;
    }
    // ---------------------------------------------------------------------------
    // ---------------------------------------------------------------------------
    // Start
    // ---------------------------------------------------------------------------
    renderTab();
    syncSlots();
    syncWidget();
    syncExtras();
    readChat();
    lastChat = activeChatId();
    Promise.all([loadTtsConnections(), loadHostVoice()]).then(() => {
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
        builtInNotes = r.builtInNotes && typeof r.builtInNotes === 'object' ? r.builtInNotes : {};
        builtInEngineNotes = r.builtInEngineNotes && typeof r.builtInEngineNotes === 'object' ? r.builtInEngineNotes : {};
        builtInSkips = typeof r.builtInSkips === 'string' ? r.builtInSkips : '';
        builtInQuestions = r.builtInQuestions && typeof r.builtInQuestions === 'object' ? r.builtInQuestions : {};
        hostHasDecisions = r.decisions !== false;
        backendVersion = String(r.version || '');
        keepLocal();
        renderTab();
        syncSlots();
        syncWidget();
        syncExtras();
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
export const __testing = { looksLikeDate, voicedFrames, wordWeight, partTimes, engineOf, fitTag, tagSound, textFor, styleFor, stripTags, stabilityFor, lineHtml, ENGINES };
// The built-in cheer: "Cheering and clapping crowd 1" by freesound_community,
// a free sound from Pixabay (pixabay.com/sound-effects/people-cheering-and-clapping-crowd-1-5995/),
// made mono at 64 kbps so it stays small. assets/applause.mp3 is the same
// file, and test/applause.test.ts checks the two match. To change it, replace
// that file and run bun scripts/embed-applause.ts.
// prettier-ignore
const APPLAUSE_MP3 = '//OEwAAAAAAAAAAAAEluZm8AAAAPAAACVAABv8AAAwUICg0PEhUXGhwfISQnKSwuMTM2OTs+QENFSEtNUFJVV1pdX2JkZ2lsb3F0dnl7foGChYeKjY+SlJeZnJ+hpKapq66xs7a4u73Aw8XIys3P0tXX2tzf4eTn6ezu8fP2+fv+AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQCQAAAAAAAAb/AwwGjRwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//OExAAk+9GUADJM+f//+2QXU0ikoeTMLqaRJDBIRrZOrlGL4ThaSrRtBOvdRe2xOvqSpo+YbYnkkJ8TihdaMlUQsOE7G5Jk0OCQnh/USQYYTi4sw0cHGEzHZ6yLb92NWPQvNi2fNZ2c4iHCyB7Tubmf/96ydzc1S0ELb92lacP//m207jTSkE8+bNIIHs7OUaHHkLZ+7f////9nZ6mlIBiALN0z7egY9KCgNtz8FCBAxS5G3e5sH0l3tT5GGQKU//OExB8jo9IU1UlAAINYBcP4p3hETgGgNBQUm5DsR94RDL8hbp+RgoKDShQaDcdCEUIAeK5gcB4jlCgoOAECAs+ReyKSi33hPii3F7ikIBoZ+8P/kGS//+iPf8n707vc2nLxT8ln1+9/5CJL6V7ln/V73Xy/+lf///IvWUpwuMWyy63reXD5WsSATWdSuZDh0Pf2/RnIAazn/ekZ0BFpEk0yJubgMIgMsmA1g5BzcxImYGZkAMuBYwAcHAzCY3SN//OExEM4/DJmX5mgAJKUSDj0aF8AIIFlABSMWgR46z5pQLZ4nyXQRFqBuoDYgCRcAwEFmLO6bMZObKWeNwtEEECIFw6fFmFw+bnTpkiZIpJVmKSCSIWQCcA+QkSfFLl8iY4LaVv1oJJMrU1GKDHsuCPyfL7GaZr///Wj3e6q1kXL4vwwGJzEBxplwnDMnyCHTc8T///////+bqIAQQ+YFw3WmQQ6T5dJ+OefLhXR8gE07CCQ8SRvTVND1LFV0RXY//OExBIsWx6MK5h4AF+CJQcGAl+PCyMtYL1KsZSqY4obEypw5SYFgXCGoE59liTRAnR/I5fnXyUwT8fHAZjuD2u77a4ULzaRiQla2UXFz4exa4a3kjufEXaxBrH7XO/gxFQ9l6iiR8VvreYUSf6YMRZa4j59/Nf2zT2v4G8ye773+6b+rZxmn+vuXUuveWlb//X99fWc7i41rP1jdP93trOYh1ri52LfylSP4urAJeG+Qcji4mkJAG7EnP43A7SD//OExBMli66MD89YARMFMcAsy7Oqz6zxoZY2kWjByiBAEoeEU0SwdCJAG4autWisybCllybTy98IH5dI/ueZUoS2f0eKDz/OduOuXay32+03X6j2RUXMfzXLf9kPian4f2z+3/XFPZuiWt5Xa5nzDHRf1bzjtst9Lr//6mv5rm4+v////+P2oHyPNb+QCkTLVQBOCziIhFB5oSzFdsmgWCEPlJMzSbajOS9Vgki1Oi4/+2VRaHKWMpzPRMv3DM4u//OExC8sA+58BspNLWc9SD+RCR0VBvUcSQeQ32sgRKpqxWp5M3SxQUMoYh9EZPQnjihW1yFlUFHrSGq2T0eObVm3l+PTtG0X5vI+5LcrI852d//FzvLm8z8v7/4zMK/1X+9vS35f3e3fPON+/8KnuVs87WQT3M9xEJf1ev433+RUsxDABQk6ziyKKRmYigAYlYYwltw7QUIukpMoq7bAg4LUFCGtM9pIZiIBIYYhl3nfeStecJnc4yxaNCwFzKeS//OExDIs29JwBsJHWDJ4k6yS7NJS02lg2LWqWnppc6MNqsD/S7FxIIEcycHS8YqE7A6qk2kssoyQKdR4lHD7xM95XEJuSHsWUjsZ/9nvfahMhTS6B22dPt1FTM2mWkFUk0jW69RZ9p10ld3pvUiLcRacZtIls/8vz8/7Z7u/vTs5EplveeXZ+fiiGOCjxKoBiQRctc7QWYN0RkR8zLI6iWmKYcPbq6YEAgO9MURu7E7nc2KiESbVx1nPBNH4D0ss//OExDEiwnqEBMPMWsXVYarB1U5mVXdLhA8qKzEPsZOx3/bwIn41ZLuzpbDU84jjs71ys96mY84WXd6iXzTojJIZ9fexxC9b854FOigGSDxqoxKv1WjGi1K3TyRAYcJh1lAJ6ZrM6wQGFwWyvwwOR0pAIGCvPBMjhDd053/h6evtUnY/c+S9rDFrGDVLFJAOUhiN9MvdjUKUl6dt4+dmqjeWbFeN7C0X3atr9vXpi1rxDlWcV1K0ti9J0VVfs3hL//OExFkkApaEpMsM2Ym6nSLbMF4zQRfp6Vie8wrE+qpj/3qvi/mR+XLYb4wzGcE6T/3NH8jtCev77XR/v/Khv63firwAMgAVDtEFJEmlUlhzA6BFC5GgqyhJiEoJwGKKQdRxXdWvaM8YFh42x8Jj7CUQ6VCjQZ7MVSUSzB4JalFRN1DgZAhTXge9qN7zjtzXoyd2Kc9EUK1CnSRUM+HKzRg7IEFglylekPSGO7cM2hUOYHsg1EMrlRDdc6v9G0la//OExHwj4+qNZnmFFMz2/vOS6l//8LDHY2qC6llHcI66AYDYQwXW1iUrzUqlyE2XQLIlpPsRFyXyulkbXH0gV6A6LUJsemTCZ1arL5YAYeLpjXFhLWM9Jlqs5uX0CR/WsmFCSSQKmUpmdm3SnntSmW0q01HNR3tOsaptw1XMshS++VLrOaTWPTECcmSzvhf5m/psYU7ZwKSm/aaLQ/o+A5wuQLqgFiQRln9gJdbs9rtRPPfbPQISBagE3lBkvodi//OExJ8k+qaEBMMMzNKH3bo98BI6avBQotiSdJ2x6VH8JeYxf0ENKMOHVUd/retW34aMc7WEpOohDg3TnAVDGR0RxVzu7UMzKpNV+no1stETSy6b/0V0uzHqpruhjsldtVkS+lytrf361SKW7SapdFRNHX3l/Sc2FgrZN3ElTEEgAcJsrLUohyQMADABUhadccbZLDDwuxal0vbrPrVmnGk0AmLhgNiVCqiRmkIEsCY0dHHuFKRch1FVnhSc60Lb//OExL4e476ZlsMEXFchN3QlShlcryIzUt9DhonvVM4IF0uiKrEBGE4FowQYiAA4YKAhjEsDosEP8Bg4LdhymdUJRbGRDiIHfBW5CDMRq6HVpU/Qy/yNlI28cUEPw+kCjigVEBcS4HP6CL/T6SOIdMtrNCFMQU1FBAgHADIeJgEASLT+clhAoAXQSiZPA+UPP1MyPUidJy4pFSxMFoMgsF3GETI2hDGlzomemjYmqQmxPaizKhpg0daxhRqixxcn//OExPMpw7p8DsJG2DVGDCY5EM0YodJ+rX5lSCmi9UQb08H+DP/2lkCnTYv9lPimNZsY4tknImEkugWmW3xBA1ZSfiv3MP/dImVJRSlb+qN///8//fmdQs2O2JQT0vNKjMOtPP1vefmNLl7/1flp6f/r2B4IZxDwGfA4MDgqnaLRkQYMALWaY2ZgM3EYebRcEopH9cO9STEBSGhmr8uxiMvoZLddiYZI258lH4nGi2A6QVb6dUhOIT7XobWGsK1O//OExPsru8KBDspM1YODgGC899bC3T7qT89OIVyOTsuXXpdN4yS8iey0S2y9beZmVy3bVQ4IHFp0lROvWLXKl8WF9Ewv/ELt967fo2lq55CRXJaiI5Q+29cfHmGI0KOR+cen7eQY1CWxdnFXKrIO5ypxJVrkB3XsVUxBBACgOqCRmlS0QJIlECnjoQeCVOVMuG2CHkVlLZpuUvgmMyTCzatz0sr6XZZirI80DgqTmfC5haTIOIkRu5gAUdqUeRGy//OExP8t60J0otMLPEYuDxsUsmEKTOzLS61I0ljFpwuOkRKH7bt0tg5Gjin/06OnNxOTacs5pZqG+07qibnNozC5iiwVQxlETbKYSkGmEha4YzTog2Md5lp0PyII2FyudXdVLWiTxIrf/y+59Li7IxENEpFMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVUT9yU6FYbQ6hwIUzI1CxeKp7EYHyjb9XSrTTH57LECGuj852jrZ6u84g6ByViX9o3r//OExPgrA9J4psJLHKvez/y2w3emfstPrV1vommmZnp7629uksvtCplBoIyI5i7zWK6DhRUnzGYtDuh6nu7odT3Q5FqhsWc5W1gGOGriw4UEg8PHyJ9E5yu9yo77HOUrxW/b/9L0UCgg+jsIc45BfVRF8Oo+uczGQVRBcmZB6aNKPBDNmgWsCOxkBDMmiAAyYUgjALImxICEg3WVfK4+mZCYZVUdyAXrTGHg63lBHZlKnbooaF8WQxBQN4FRFUEv//OExOQl7AKUznsK3ugiIRiAYYhp+GowiCq9I9D8zq6oKf6WLyZPxXKhLLKr7UMvfCGIPj7ryOFvvai0P2oecCCHZpkgRQapgnDRLgJocSfaWlMHoyKxiaVwp0S1qtVtT9tfpxLNZbVG/NM9mqY/UsfwsiBMiVfXCYpOhszOrV23F+ULm8uvNx/sbe0p0/lEhCGtKwzMe2bwKPmrDmr7387mo2xGIW53ftjDDZHV7dg2Wx6cXX9zvJmHwI5CJvOv//OExP9CW7pcANPNzPp/08Y6UAGFu+LVGdF8Z8iZQ8ApRcYwxESNCEWXkQ2WI6Swah5aVxygNGwsBgmdongXhPZSxgSnqGSPGw9izT4Jky52JqigVZM6x+Ybk3d9S3J1mfMjU1nnAfxHzE2opDFeon7qBO+MBKNCsbFtRHKvrURCGbC2i068YVo8XIyz1QaCfhLyBC0JopTfMpSmW/Y1Stz6ka3bU2wqvGxYcaQEAdyxDcU+upVYzJ2eKczDpAPV//OExKhDy/JsAtPTXdxla4w48VealYqliimVpYxCyxgpEMRsiZT5L1WZDEnUepGVOacHb96ulKhhLihlcyWJxIJQuEiUZGw84KAyIolQOWilyAUJIFVTxkHEYyPkcIr5qPzdS06hFmFLrqYm2jttHQ/SpgEqQAQSFMdNadayCZOMtZgKoUD1PPw/6dE2y9r8OR2mib6T0oeG0qJz2ys5XbDcUi1+AWxsIZdG3Lls5Um4diip6rCZXRc6ojPj7W0q//OExEs3E+58JMMHXMzln490rlTsB8ukom5yyerBKLjqwyN1CFQvX5WWKojwtratHyrVysluVcgQ2HX4DowiRpaInU0apuJJA+/yJatrx6tlqG49rz+hTHVAEkd3R+GkYPQik4PVSwhRWMGmI4CsXV3QHMPJR1Lw7I7nudKtAIUtDEUYMwRGYLIxhhQb4cQIgwBLggwQXdFAayYlLsVqACwA48tODFur+kJZK3FFgqmsOaVgfGInA4H7l0qMzMmZ//OExCEpw8aJZMMMdXHT0qnlCk2QPLNH1WAuFAISQWNB4SKnSnli8o62ozZSaIs0HpGsc5e1+AcRNOJKAzFETAeEKCiFil6b1UDamQhMxf98pJRH+zM6mdqwnhclGsjJhIKKNyFlES7eeafMgmK3Yn1+U/ZbU+Ud8/+buf/fedmpqnJ50fe37bT5P73V1vRU+UqMFtGoAEsDcoNZWPhHD0GHYfTAx+Co07ZplgM6Qmbm1wbSbV4tjrM0KsnilQiM//OExC0lY+KQ9npG/MLhpVGRienYu7VE5xu222jZ9adSW9G13//wvuv+M53ky7fwvHGs374VLbn7m2PkmlRNfyZypTpPOvNy4d/TeFUYAAw5CEwbAQoSLLBZMwIgdJP37E7NTSS8hN///l/isEmXCdEBkGHQigUgALwVpGSFBwBGS9pRDbBnJw3W9boxBGDml0h7BJtKRgspPLJ18J5mcmbDI+ophuSAUmlNxRGtkq2sr3hSEHruppY8vr427+8l//OExEojw9qMtnpG3ZRl85TgnmJBobOoDUmeMqFDP6WFkM3rN+ZHsHzzJDjrtwuUu3HEiYAhYzN8VvK+7f8L2aFDql5z////60//3i3zWODvZgHfQ1EWEEZ36aW2Muw+ggIYwvnNzLyoSCIXPtQU+Uw/FHrCkxmK0Tct6uTVqK9sOIm1asTFX5aTlUhy3OkjxHJA0SXSElQwuBtGZIKbuDuoR6v2X7qQyBgk2U+82LKx6STnTbt8/2wQ6YIPwFA3//OExG4mwoaABMJHUBiRrglRuMZEjbDIHKjhYDFAiWDoqAw6woGG5NYa2oUfNHZG1GZ29rhZgiFbKw2R2SnD2AMB6QyBdDMdNCAPcLrMyqVJELwp4jJDAUj0nmaPkuHt6d04N37WYfA7I5Hcc6TSl1jGpTa+ahTu28xWNVyLFlOQxAGIBBrGhqKzrdikmWhd7TlvKx8yrdZVVnRqTHOwxJNJTHRGiQsv8hrMQFvsZyHpCzTgMwuE3DGxZlUGBQFe//OExIYgSrqg7npKnqxGtCznVCAsrYO7/UVU+Hklk9DbK3mnalmBLyRya04u1nloSyWiuweTYhP6UazDc83L+Rlwc7kDc09ySHze73tmMxAYxmcBRMWHupQahbbkWsye5HZmeu0hXlpXRn0Q7PdrLYzMkjWJ9Sd9FnJqxx6Oy7dRIedUckBbryRegHL30ExBTUWqAYOlHGYmM6lyWpgg2aPhAi2K/GGQ/AzMXlwE5oc7q4luKGxGfPDJ5xawXTpk//OExLchO1aUzsGK2ObCI4bRsJHI4zbQqsxm/kPOPVd9iDTu10TNerWs8GCkwrGCMwYJAQYm6cUJdWCgLEQgLIz4MiuEc6GAFBTmJiDjIj9XmgjrW6ldqWLQrGTRim1NNrXmkn3nv1rOr7I5tf1ryp88K1VMCcAxgPGUwnOAUC0gOVQEIgA5NTkrEmS87eq/bJGJdguSQ8fic8iNLnpQi14spBWPJDRCcD6QXn4/PlZDRFcUEjYGTxlNB6MVPBY9//OExOAky+6EBMMEvthQgJzJ+0ArY8v4/qICJZMmkw2poOGFYSb5e1hdA2dtHAkbOQpUVvN2VktlkUtKqnepqRjl120ydgiIlFB6yfKljjl3TO0zNqff1lcz05+K/wrugESZahc0J6065Ryzw97nOk0CAMII9kNGQAIVKsQKwaNLAAHHTAg0awCEEc5BdBUs2sKiHSIqPpYgKWCEqDxZ9W9MVCtBstuWzAQy757ypM2ONhk+C6CgLfw+aUgZ500B//OExP4savZ4AssS0piAA0IMwmGLsYIqRt7jxqBQQEMSDIYrQYx6qZIl0HQdgGcJGdQs7SXhR7gK9zb0PnSA4SFKF5caB0tbexpFcoUnz/TyRNNmOUY6mJwfSSIImledjkSMWMtBhoNQF2IQumQu6XdK8VwW0PRYEmTdgHoCrGUDchDcFcEwJWNwkguBOGWiFkEDUC4EoHAGgjUwgkMP9BJRRC2PTnShwMSEMpfydkHJOrJt+VRsx8kHNRMMvqxx//OExP9LXAZwAtYefvEI68t+5Idtfztd8sDyb/W4Tz/zV38KjXV/d2iK92highLEBWOr7jv9qzKvhv91LEAFDnPNWsCmRzpfVLedh/Q3Ny3JG1CpGd4mX2NlRDmwEijKsfDQQoxGxnTh0IlwQhmcqR4S4iTtmvpHmTjXMIzwnebbqmUWyLtX5bv1LuybYijZPLImUM6fNp5v5RiH/5RSeLOKk/HmPOe6IyjcqO0pU5DQlKRH/I6J5kV6fM87u+rM//OExIQl24qkxnmFdacW//Upf/oD+D+WUYJfIzlrH6+qCBACpKKgiD8qDYMB4SHREEoI+1XVyzq2asx1WryqJpAoqMZEQQiTUjiKP68zxOalIumhPeklwx53N2gZ3YIcv0a15Avd+l5vJ7JdktLrEdNQHJqsbpZH/UbI+AkRpsIU1b2JY+qMN7aYVyuy+4ghGLagx2L3UqI963fqTH2Vy2epNiOnR04xk/9f9K7va/msBRiLUHKNxJJ1BALqnMZZ//OExJ8mG9qhRmGFrHIrTi1DL4dxzKlxQrdk5Hhv8t2I/hvU6uXr2AzNSLZFA7YYCCSCZZTRUyHuhBEIgFTqIpOfBtCnTjPKU0jEAQheX4jmhvpZNR5AyNbVBWpqSt9BrleQPsz+0qu7VJFT4x5FjFehJ+pB9Q1Fm/M38gkHraUSTqWiMZFshnbVj7FPL09f9nR7PoMKRAHSS1cYo8oAGANZqnAAYnaIATdCogwSaMJsPzTYXgkfNtrDNStKak/J//OExLklm66cpnoFWCVSykiNkYySHQWDUKCUSFyIo9AsQFmjSupPtC5PxfNnEKyyrOpf+3vSjFlPW/tque9VxI9yzamK+00Vd0kMI9oc3VeitrU3dFJlHqd9q/k0lo++kmcN4xlUyQ/3LGVDwXKqNX5IiFH7V9UiR1fqY4seF52+TEFNRaqqqgA7MAGjfD1UI0oCRhnguxkMxD2ZeVRvTRY0yhhzuFVbHTqlPJTxE9BVRwuUFrThP5ku7bcTq695//OExNUlcpaQBnsSdBmgz/mUTec1ksOGFNY3GMriIQqbNzmHCDZwmgkQFDDDWsgYZcbjLGHZjWMa0QXg5WFKs7jaSLUQmQUcaII46aHjaOWMqFYtLs6o9Skduq7VI//Ww5iyqd9WpbMy//tu0EyerQQMtppMQU1FAI5BhIPkkwooSPQHxZxDeEsoRLaOxpERNxLVRZwlQkyVg7TfSRuqkcpAl88i0Jk0s6oVYvUwjlUjkdhbT0N5Bw2cFT/2igrd//OExOsno+6MBnoFdOCIgJ3Cg2swiYZJGlFGMKKz2BwpT2kBfoiZJpldJEZs4MOt0ipc1KAvldVgmOpEjiZhGS9ZSNpOuBEI9PbFYqwdQIpHXh989/Owgh3fOu3+noVatD1kYGW1KilZ9blf+QbIgCVLQRpMAISwNRhhEceMInMmhC0yFKzIdY4ogI1HFO2AwHbjcdp79K7kpkNp6YMX7IFhHBfWIurZfQHglI4kFgr6dSeSgIdm2evd08QzyULm//OExPsrorp8BMPSsk7PVSk9cVDAnkyzsj2jbgfQoER5hmi0/Z1clk+Qp+YaL1R8l2PIGVyH/zMoTRzA/Giw9Q20hhLag7WMdWjbfw/9+5D3Mo2vmtvmIjnjSXTzpYGzDv6k8h7f/az6//ztxw5gFg6mS9VMQU1FMy4xMDBVVVVVVVVVVVVVAggAAvESAEBZ6V6KStCZbDqkzLmDPa1xYBwSDR8Uk25MKmLEsktuW3YrK5qLPe3qIbL3klc1yVuj//OExP4sS9Z8BMMFPmrMYt2b42JQJ1x0lXvlVkjyu+GHnh6GjAdO+kQLpZtlUtTkdPjG7VPLRlK/zGjHBGq8E9hnBpMcrLQ9nMpywZWMtNyHc284RT6DkHQPYhjM3V/tsJLZDUDE1wTuk70P/9aNUcqcOyoJQeKhZA9tCzphgrjpAp5jIdQRBtTVaQ6BLRGtVHNUmXIvmpgwRw3YXpm9vIjJsmGM2QKBSACig4e7a5IqZADJkwh0dLBAyEKCqI3Q//OExOwny+KJhsGFUPW02J2FgyXFeMlCAJC9fZEjO6llKSCkPCxxB431Y9itIbHdOJHjywmuC4K5n9gqDRy8LdP/skM5+KTS5mi4WtmmTUCYfTlha7VfO/7x1HnEt0sud3Vanb//3v//s5yhjjS8AEY2p7fVXooBxdIwwzCEEpS+RCK7MwX7RfbMsqctrraamkZbQTM+6ogEIg5ADive+jYl2XL9u6/bZyIx6EF5EzN+pM/KscuduVYzQEqENuTV//OExP8tYw54AtMNMsfSAqakDYbH0z6ayqUxWqDJ1GADNK9g0KtPzIYhRCm3d6IiOjoudGz7OHQvv9FndQkchVFeUQLOzqQXd96XrJ7T0jZs18Qv9z2Hvby+kEEgZCgAkOAADU+kn5T860gzMHudzqrMtupiEr+RnnhE6MRQ7mobCgSnesqoIwwV5HWh19nUXfGrsO0cNrlL7ulLb6+gNi9MwHI4Yf9/20Z22SB2lQh441AsNvhD7tOg/buSz0fl//OExPwvQ+6ABMpFWKxTnwpvr52xS4XEBAdj2UcMRwum6jKaNQXL0SHZNuaVMPUGHidAUhQykU8ftjEzZWHZUcica9iVkdKk8haRz0dpT0jXPLgQELQdMnPTN08nfh0sCLV7z/lkARwQ5X/N394TK9EtrlKWYmWVjopZ6if///0/oADby2n/tOovqOUIA1QpUEkkgj4ji+RKjIGR7AlFSvkbOk/E4TkH0Np8pUGkT/DDUh0JplYieoRaEr0PXlIW//OExPIva/aUrsJNTBOhcKhOUh7p4G9Mcs1qWzie8sY3W7UOHeHLqfMee6dI0BvRgskCgIrAjoILISZ91R2IG6em56RBHDOonTh1rkHCs6V20oWYrN6+2Wh4VZgIZ6Fg98xPKgnZnMIIGkyCGfl6+77iP3PnerqftO+x+IYklCXu5ECi9lgneUtSQQoURJ0IAXyzeQKLreH4oClMjKAv2jfHmAltEK3bWUGFrqXFxEBaaBeWKsYBTnYXmoC/yiAh//OExOcsc76cpHmFsIueTBZ8JAVqZSpJepAMWuqNXqcjPV4XVSPww91Eg2aMGj7LF/tsu2zLJ1HjvVL5SmuuD0X0MqlUKjocTF4TtWGUpygAIEWFydw0RHi6l2TsMlyTPFqWUUlyemirj5IScxYTMO0lBwixoF+dqI0wsZskGG6dhlhEHUW0wj6iKIlg4l8wHMmhP4yHrytUR3k4PMxjhT0pOkLu3FKPAYw8VEbqHHWij8dH8QsfAmYlB/h0q5uP//OExOhKDBKMAsPTldTy5s2qA0k4hsdcKuJrrINLGEKA+ZFRCQFEbKO1SiRIhCi9ERpGfGbnNVltWDUS5KjnzbkcUk2Mn9plBcWtRdCqrABCESZZgMjINWsFOyZVa8hTEy0XCWYmSGxH2ajDMiNysj9vXCiT6uMJmouR2qpKnpHRD47WZUWXdnvm55SKadIl15wCPIaPJOmf3WkvPHKDKUEvMqeit5oItpOp6Tu9jYQRpcimYXpu6lPKmZkhz0rJ//OExHIoAtKx4nmTZCIDQtJFHP+itJ/r3qWt55TZSmldwz257HS+KiJQvunlQbWQW8ywBFQTCWfa55LwQAmFoG50K1B7W6g8HcsOLlC/w9hbJJXAWwAtHyFAc3MmhJeWoRfMEE8PQMomURPCYTiaB3m79P2dlNt68yb8QpVlNGsHDytgiIJltX5ZpgpSNIOGcH50MVRr0Eft9ASjlCPMijS0VUPrBxAkEtQlg2SKhuJVKUNDS55mRbDUTBQS4s2p//OExIUjAkaxRmGHaIGiRO5T88hQlKQAFKTFYRxygrgtlRMlO3PLTJ6ywr8NXPknxDDOk3I+p3OdijOSGNcZyNZUs2HqEQbowihOS3pfHL52tdBpAmqmtJ38cThctVogH1yRojFbetVEmCkqmqVA5vZwYkAq/O0BxgTLBxzRhqAriAXoEQXBxR+GitLjKh08fvHHQ6FQk8Kwm6VphRJMRddMQaKAlOByakUp5Xs8y3BopEuwvsQnznGXz9RIIk31//OExKwjOdax9npHTEffc7Tafv7RVxCvMuVRQnlyGqwAKb0rb91PckoaRYsJ5Ps/SeveLFmEEkJkD40MH06MosifVNggls3oep9vg10nEWM4VwoSLHAhewP/2XN91hPmfbfGrU8f30vPBZXep//rhMf4KbwAlIN1TCYa2Fym8eGHY6gObtG3ihDzQYz1s1d51MSwdBSA7LgaUP3LWdMkht+4HdKMOs2KAY02KGoYiCg0CS4cQwwiIW81g+812xXp//OExNAhAcqxRnoFTS9nlQ247K6l662sW7hASwyuIYfeijEmiy05iUkwkiQIANVAkCWBgPxWIYKgzNzxE3eb/GkSYVUKI5Js4VHD8FF712zuOUIwXxKxRGkjZXL111/YX4DC6E5L9m7XM/bttJkaMYRVlWCZ1xs5/+dm6+e3Rv//nIVhHQnnOd+gRgDNH4nPS6q/UxAlB2UyCMRP+Wc7OMM1m0LcmNyPAVb8Sm7VJhdpsZuM8n5dSQ9hAL7vTDjw//OExP8yhAaUBNMFriODpy+pv78/S1u5fjjnqvzP6S92geRkmHaH/rI3+qrbR6nRmKXguAY6veffbHilGq27rFrLsrMMbUunVffvIlTnjkQwJupQa/1Qt2U/qLT7T5PkfixRj03ENGoTGaz/4ZWKzrRfY7MN4N2qZJMIoDAncihallJKOTME3n4o4pZnIvTTDOZitK85RSxgipSMzkgD+ShVWf6bdQYUTxoEzxss3q83Q541cRbxIE3exK4rt/dm//OExOgny/asBspFqYns4noLmoFZbfq6yetx+76xOpW4nKg2pH+63zvKruvL3IypiC/tvKpHPdQCgUEmSxhmK7Zc34W2jYqEG5/wc5N6AkMICRj23f6fh9Z9Oz3vJ3Lke2sgUgscJAoKGSn9Yw6wny5CJxBWD9VIQACLl258sutiyuUUSfjcUnOT9S1rs3RRaRZIQRV34PjcQik725OXJT2Xzcz25V32XM7d1F0EwhmphPYt67M53ZKLj3+nLgmb//OExPssS266TsPS9JDHc+vT4I0cL+s5M/Vav9WJ6cqk44YfYUHXIW1rivVLd4XJSWjSeZHywsr5M0aVe3V9Gsho10C42V50NXLxHcMSx/JlRYYWg4Ksz+p7DC0EmGxnRKMJsjn2p5HaX8j//5f+OAAhywKCqfwLKgDWc9dB9KvHGCXv5ADvv7Zb3cPymhzdOKqAwC+iiZOmxZ3K+VBZr8h+DJuLRl0nhfB3Wz1oYn6fTD4cFFK8k//EaWc5cq2f//OExPwtC8atRsMHda1S/l3Hmf0NLGZepq6TXMcKS53clgKCZBhg+j7RGA5/UPPJDbLds8Xg/kt3z+/+WUn7VgaHc/y7eotR6B6WU2LVD8zRUGH/Tyy9hP/uOYOnRbj9jWGUktT1Lb/9S6L0m/nd4/3///x5jqt3f/ypX3v9YZZf939Wv/8O//2dE/5oxlqQvdI25GEWA3EiECQ0bo7hCJFNRdCUl43dfypV7pEBdREB2UGkzAwyeFdqhZ2QOgyK//OExPoyq2agBVnAAEwMMaMDxb27pGV9ZDDoKCBR1UB1yA6VN1rso+VumWFxmHuNLBkkVnUkEdlsuIuvrPtYiEZSuutBbuhqppu0Dkuzczl0qlSm1PnLofeyNzcN2tyfK3SzLj0n3bUt7A0WLeP/ZvS92JyBHuZ+uSBW3rzNq1RyKfp7FN2vampql7J6W9Z1hDFLFpW5rrsMWUukFHYKt5SyHo3KcKTGxe323YyqUmO5bqHKlacwy79+V5cz1BLj//OExOJJpDKyP5jAAL2v5GXlm5HK4k5E1hatV6kunqXmGG7VTDOnu95///+/HZBZ5hVx5U1MUvec/WFj/Ym/8WltJN5Z9p2uUlW1K5exOJTNlakAA7TcJ8riyeOczUZtkkb1oKdIQQxNsrcpoysKIogEomynydDQoT2YmNEJQ7XbiNw7C5nKThPE2PdCmBUASAkr5jeuEd8rrqF4vM2UmhLJlyixXWZIFVMzQY9pGx9CpZXQtbhRbv9OauZoEGKn//OExG43I0K14c94AUh0mYL1lZX7NpqgpFnbW9kc1U7lpZPOU1Iba/X1AzM7QxJxahSHK4TeKwN0VmfQo0LbK1n9Oo19hVKpq8ZWF69mjb7FWyufWfP4MrlCtChsMTdI1Yu/rVoWUIEnoH38VVITmQhY5QVSCigrjEKiVaUAIBcPIJ62Xzxom1JUCQ3OTQ6AFTMI4s460dzQu32kWmxPvBr3yiYq0c9yI0yVsAOpZuzLSKaIOUsA396X3BYhSCE0//OExEQuWza6AGYS0HZsSEyQDJFyRoohqSfgLlJ40rqzm1tYZsz9edblpHZCGQovEUtIUXWo05ZqGTyRJewQIIbz5oIyxJIlI0kTZ5nV1lUpoljZ7rmLTVuTKz+hTr0siYk3jWKTepFE9qW/1H5HMppDmlGBvuCp0smBA7UPOyNjg0qEAAAlhsVUDCwjZ6q149lYEanVOVrYoW5ctb1SDFAgo052ZiLbBVzInWNdvL3UhYjlWW9x0wnSSVCVZOfr//OExD0tGv655HpNpOUze4Gkn0aXJ4zNpyvIROU8ozmfvWJFK1qR5wpmCbOosXQkpZJmawpdbkD5bRKAcAMluQajXn87FBWCChxZunhjy0/JkhUgihxoogJYHMX/3nuMAb0Z/q0F56NIt8Ko4s2dzos/TaCMNMHU8tdXupLSo0mxHFTN9YQGAHLAQt7Fgq+kFnnY5mZ5qHPK1ppHwN9eei3OZ+W79awxzNTNHRee14S7W0qVWyohEkyQplZmSc61//OExDsjQq7F5HoHiLf9hexLOLtrRzB4469YEVE/2yX8bdpyppE1BKhvLGOaxOPkdDYzm0/q3wiwYGwltguRaAh5XtoYQJecMhWKSK2PPMqERZqYnZRKiH4t0Gj0l+tlUAOyvZ4EVXtT2Iwoe3tvZk683IepX51/FcGZd+aaPZlhp9qtA0gUlpImQW5ALmjFGGK07sijP/iNzudBm8g+5DstX+tT4v//ZxfBGpyv1zv6R+crMJHX/3kUa2ck6PLM//OExGEiA67NRnmLPsWiUX/XXLmWit0XQScUFhMhv///+UrcwQD4P9dDeZ+C/EQ89ENfliIAAMV170uzMUzK/UenlHz1xbFM3hmHhAb25fChvxjOcOO51frCwue95ckZUQqlaJ49OSEk5lZh+nH946dS9OV1n4dvMFDpZ8de6aWvQ416zlX/byHq62LlEft5NqwTtObiWwUps/nN+dwyuYjcVGKycDKDCAjhvghnAq5OkUvRP/9vi/8L/3iJ+xBR//OExIwkk0K95HsHHMMJ5RbxIpVTNsODAPDKeka0zqOyNUVWMmbVYIcSe5puMKDJOQIuZeGRmtEjwP1w/pZj34F7QYEsKdtXavmjF7J5FK55vQWYmcXF9JFZFR10tFgNqz9vD/MmNKchl/dQqTHdre8aY9x58y/i5h2uVVNXGq0qX9fXxWo0gx6By0al97RBNEmjRtA5vfPyiyAgI3k3gn2TZk+ONEu//8thTfbfJ8VIgA3J1Nm71yRza9ccPI7I//OExKwm45bSLnmTeO6ZhHaDNUeu3QBdy5GexO1al5lfSZ4+cmGytZ2CGhSV2n35MmGmnHIw0SSFayaEVQrljZzaMIqJkgIDiSdtPa224/wpEUw5kjESA6ouuVgeJW4p5xtGo9M+khpWRyoZDnTj0eqPPkQoXnz/OJ+k1EDc5+8d89FkqlR2U8l5+1KYUvOLAR9xr/6RB6+hBwIACsR7WTbInXjnrbVD28a9x5oAuC1Eh6jHS0rTTu6vXjLTKNCv//OExMMm8wLBRHpHdDTE94yz0R0nRC6E1TGOSUHUb9bTyf+3POmuG4sLfa9S8YJRy635UczqiMmr99szg+EXM716UWb9M5JD6hsgQ8ScghsW77HUGHBjimR9+iuy6If//7Ovu4TPOv//zMCKYwIF6jSj8RoiAAAlgL+8mXgQDUSDFHU6auuOXMbQVI0x4NdglQpqcdciWTDeutNOI40WjXLlJ8/L4k5MXm6KOtyXI80Vm5aROFCNJl7GsHrXxjfe//OExNoja9rJ5npFHFqA+BcCQ9D+oIqtinKqyglY2ffh4fYXNR6B5GJ9O0K5N6ejiJt50YRjZG8fHFBosVLLxazlDhUgYIDFi5GDTMrIDy7x9sVrQul4LtnZptsxWxL2vOOIt///SWhUP16qkoBl4Nv8rRW3qEZ+CFXYAAnFaxe5cisvuxKNymSx+WzV2V1JuWiNcO2uW5SpbORqvPwPaeG7ErUtdScib/x6V0O4XafGXS2WwRL6CMSeWCHCAWQo//OExP8uC0695GYStCcUKaJKc/k17B192xP91mbhnqXNm+pQwofLilOc5ni8kkLZw6wfzf7tXT0iVAgJdJR2Akhy7KqITiY2PWjK2Ug0IyY4UIES88ssiGMIj010KZ3f+nPf3P////5yKZu2OYG0bIb//HkIrDYGfmyZ45VMQYUEAEjlNmLLIwPWxqhvkyqpV5kn6rCCmtAYGaERAflu5wm8uCsfQ8hquLgpIipQRDY9jSCI6O4lUEARCMXEhksQ//OExPktU77BRMJFeR2C5s54EChg7ZBAuG9mgrz9K5a2emFFP5JN4WBx6Bsl/izxTA/ZdwpKZrLanFRoRokPLUenB3+e4GDZs0jMlzvvm40HiKAhynFSqFCk960t1r+Kbod9RQ7ERAi0gGkliXrCQhzrkbWAAMmwncaSZ5Ulz7Rqq9tmR0FnsOsQEfF+Qukd2JI/RuVOjSuLKpXHY7L4ZiTfe7kPP8wWH7MCQw8cYfZWyQrmc99dtIgxMFrjF49J//OExPQp8uLFZHsS7NlNJQOpG2biSNR0iH0nFMen1R65979Cr7bH0DsmbTKdCOT5CHdPBM0bdocoGrVFW9QScZlc//jRnLl42fLB7D9KTDD0LidhcOvFR1SW3xIJHmBQLrZBAQC3UJiY5gi7EQxv//Z5GYp2V3i8gg43h7//hlXgAACKFU1Wkd+IdrRqUS+tK+W6lXPUMg0aFjrQ3IpSvlfEcnY3QySlaTLIxATJnLo5G4LtxjOLOnnFL7oM1qPo//OExP8vk1q9QsMLkN+5xKiLo+AbaOy6K6EoTqHhyVnDFFodNISdqjp6sXJK1tHsadb07b2d0iq0A+hnFO9j89qtlRLB3ZDOfx2DtRdSp4cpyT1G3P0+2sXIvMm1KHjyNMfZCCmAxnBw8Bht6CugbP/8xxUziRjq0cK79FYv//oT///xYeoEAoElU5KHhezL5VFnX5TS5s9t95rktCmq144lRRwE4yIb8VozDkYgd/YBicHP4/TSXEduBcWluk6z//OExPMuHBrBRsMLdDWaizBm30y9OKA5Uzp/o1GovSx2BIg/2Mqp31fOblMWrxJ141nJQCWl35vWSt3t6vn2psJkiko65U+2xvLujGJ00UjGVcVdVGRl5k5GG8JJMSHTyfMvR0KWxcXZF+UUcxj6YUyHxmy1iZnQzFT//83McyEFCfrHeqGOcL/Uf8n8rYCEAAJhg21wVe3v8nveKb7AXpvvFZrBWB6mS5Xq1iPeNK4KqqkZzpcZO1KJD0bDjx4L//OExO0uq264pMpHrOaF1KcJK2W5ON5ZI+WZtP9KOahL9KdDk8VLEr7LT0pqwoIMzLdvzPmrkWX0m7gPwP3LtTrFf7bNThKzrdT5KsosaPpdnVcktK1VCjUpySOxyklM82EmTrMQF3c9muDWm1Ptl3M/Za7U9m0p9QEZGNRpWZcFvnloYoAAALTNWPDdugxp5HTOBeq3I3m/8Vo7FIQah49OZK44kMITErOLEhoWDknsHj4kMlSI5QoSybxkFIIJ//OExOUqa+rF5npFreMDqChdHopuFlAHMw4SCuMLrHSvFSGNgqNxIm5u9NwSxpkuwXWZcjg2qgc8tIlfJb4tFyPEUE2YlkKutG4Eo4hCsTMZJERMeLItbYLvYH0bAqWWVTI1aVyz7m2muqpYxFqc4PS1icfFVqOw+9W0rUmw+m14Q1rzz/IUxqkfLxq4Z8dVwjisorsxowsIf2oQgYcjAgUoms4m44KZNTPk3l8IcRCu0h5REwKZKMUks1VbVlfP//OExO4yE9LB5MMS2V6poTqBEYWxQ4PI5WZAM9ERBTBdIiJC1JYhRPX5N0afAHbYkmr282xdEfRaHuK8iFRhAsvNO8OmmgkWdaiMm0c1JEOUCR1nXOVr0UiYvmiN6RTVZhRen48EJuWrnFESGVdBZyAZYVWD0o1hXTNMZyTqwICCdhiOc7GI3OWH4prsBOC0qXQU6F+lGRpYX8Iy+xlKEhcZFpOqVi4hGpyIIJ4q5QtE0fy7QrHC0Uko8BojQsMi//OExNglYs7JQjPMmBbIl8c5sXetVf9jJlriwnSVrbepX6dT0UcdD9JWF5TTLetWSjEI//3e8oKyxGJR/iFJWuNmlxGg5xpCc31CTFmKM/EJByWUGMTs2hku5RARtmxW0vn53//8vKM5o0/Oc4ervxfcYVn805QSYSqM2tXAQA1JN2j1Jdl9yZo4bu5RiXWpHKlKnPhsRJf9gdp5DCiEMNRrYnHqeOf7qRQphlZlCrmpSK9XL7g2vBHWeAekKd9O//OExPUsW5bBgMMS7d0Z6qW5tiSSxXWXjv9zqchWemV9////9P9XFvUsbRt7F6T1OFE0hiKbapxCfZM7zSrMtopNiGvgmkFFTZ81IYIsohLxil5T1Mr4JtTz9hCMh8wKRTS5G+45//6h/d01LX3nVRd5qX3/a1v/GpT9SlTbwUXx2b4HHD0oQBKx9mXCy8s7ZYCtXZ+Ih2wp1bhAVE2fikdk6KBXCHt6XVTCjHA6Vc8cWJQHA1FGiaMCddKpoVwi//OExPYu86LBRMPS2aZavuB7VqogL0uIM7izwJJJYsaEwODDAM4/4h0UjEPD+4eDG/pJGVDTD7AZlpZ7k0BMTYKUZC0mKv2DJizqh0iI2D+yKHUBwppVJ5225kyP+jG/nWuNmSLlyQPIoipIqe0iz2k9T///+aSf5QxnxoYwuOJCOFeqI79hS/cahCFHBkCEBvQtBcI6TEGJMkA3kJdOkZU4IWGGYsA8jI4rqKI8sqqbJNR1qwlVU1PdRQFuqtWV//OExO0wq/rArHpFsCR7ImieY62esTyPRLK9+ulh7SWkKE/rPq/3f+8eaSOguFJ8yI1zxjidpc9nE55UWMQJDVl98ODDwU4MXgmvgoIDDH4MWHT4rn9QEhUzVc4oIw6tob0Fk3XsOvYLzqAFqNPwcHRVLlWALJKlFK5W/VuWz0NxuG4fpIhK427DW3BBsrNYzQkoUrBRD2AAt/KOzK5GA0VOrTWVQ3EWTvBwQIphtG0LVoDMgmQ5TsC5mO8vZoMS//OExNsjqsLR5EvGvNmghKZ21RIr6+7vIMMb7MwxLMmO2idA8i6RzEWDtMZf5RooKIUSpmA7HZEFg8MDKqyE6R6o5xeAtUpNz6Q0Fgy/aMKEMjdmzRjf+togbSefMMm00Wq7aXTUWh7Xl6/j/+/fCX80ELe9KdZnuO4mn/slW3u5YWXgA5mIQc/1/DOVyWw/EWn6efhuki6lc4PNTypIgXYgxCevCG7MPL7wkrWo3CJdEK8fm6NqcNyyGoXBsERB//OExP8wY3a4osvTENt0KZ5GuNPRkhcef2U1ojOV7VCtTuIa2JthzB5DCVx4viejpBf52KWYEvsM62cGJ8/MStCOyANInCaNQhCakMR4Jqwh448hNnpCZaQLwJzA59Sd1alRjrx2Tlp4dH5tSZnGYOgQ4UHR8VOo9R0hBESZRZvzvuR6alX6f//oHBykaM8w/Zm/j+JKAAAGy6pRX/h2B4Jt/O4TMZicYpeTtYVVlWdptsE6ogsDIcpXOTsTfKXS//OExPAxPA68pMMLkfh2tDtqURmHIrL78obtLYcxp7zPYFFBYgfbayrjEUTFp+aZHVKG3XrHKzHNjed/n6twPrVUUsxuUddXztnu63MlpuvZS70o9P+VbMDSaIWAiiILOyURxSSmaNI7MxiOzqqKL6O89Ub0Z9VLqRKtRjr///aQUxGQmUDEiyLjdQaqibAAd/F6uBKOXKekhFPP16eVw9E3up5IzUEnaDnClJywSZDz6v/GItOP1Pyq3NtDfyWQ//OExN4qk/LJ5sMFcBSmYgOcw5fgqTUjOMeP5jBkUhiKatSyjksidGmduig+XV6kvlMjh9ms/rGtK3M6iES/fK0XevZEx7NTPISI6g1wnMB8zDN3+UlTHwSaOMFaEQ0FBIcMCQVD5O2mYGjCNgb8xW3tIE8N9NrKkugpTMWVYm3bbHg0hRLJwfn/FJeMikUeLCooj///dEFgkE2Id8tV3iJAIesKgja0LOK4hj8n2lQwxm3U1IckojqrokzyMIc5//OExOYxC8bF5MJFsMIx+ZSFInkoKASquhPiioMj58VNEY+LvIS5UlFBGIBMNkZP3KMoEJs4kczLPNH4+aXKaef54T/clSHdjkRn7ZppLIEV791EIYymJJitRpQGHAoBEBaAKXIwjZV3CFjAkaku+YgLSM6rz//ynq/4qPeI4kf/btf49tWxhLZABhCkk/a8Szu92eMDE+1Cfx3JuBcM1ESunRCqVQhkvSEzs+OvOcnrsMDaCBAckQcvhIXRoZCh//OExNQmsuLV5HpM9A5SpnGkAqKAlXJljRMjQ/J2qqhkinTmlaapP9hdbEkUkUVUpmdmUPr0fTY6ix2yxHyYleVLEROYE5Q/RwvSEi6ArSMlMmrwPsUQxZbJZBgsHxQuqnOGVUQEX//mS+gsxJavl0esX9YwAA71PbwmpVUll25SU0/LpbfiUpghEdIOQvs0h2paxWYdUbTIdSSNTToQ7EnanGR0cOwZKmsyClfldDztBjfw5GIadS9jLo3DFJSS//OExOwn+zbV5npLPBiPUZi4/iIUjJ0vpBWPV22JLRxFzM8rpJmlzgIIepu/S1J34uVISvk0XJKP4JQUBtvQwQHwfgKxQXAkiazoigqJOJGnSKc7h5ShnJ4omeeVnTjvbQKs1ttXD//z38KdEsE+1if910m7ZmiSq3lpKkxBTUUzLjEwMKqqqqqqqIAAIN1+0vmp3Z85tkBpgZQuK2wYoYAG1R0Lm4K+O+XQ+09Lc4OU50MB4LAfI0cJDPBLLSsv//OExP8uo77FRMJFlKUPjEXn6Q/FT0mp8LGjGNRIpeSMWIPWgmgCzdN0zNi+vb6ynMgaYGCxG7WENKlGu9Ai6WIN0DvSB9wjqGWgXpAcmSCuSAiYZRvPQg/sGqVoNBjgAVBA6s+tm+G7y0fWSb6PXEAoziCEAJ6g3zUr5MOiWvr2sCYiYdkDDCymTUsOP08LLKjASb9aB6aAKJyZJDDEmnzMotTLQMZLHJBIZuuyqFR6GMIwpxTRLUSq6jNBgZI+//OExOknQqbN5HsNDIChVIggkOeI2igso9RFKPULcVFD5xWAbQx6+RImOuiXRHxg2TCdvfpG0qXLri7KHPrSBJB+wjUhzS1SYN2TEKM3op87IS0GVYqu6jWMq/wQkuO9Vc6NA+WDgaNRQKI4hPPriJKqjjLAEAAmZsfeP7VPNdoJc89DEKSZdlbbEn9L0CEyZjok79IjpLUO8BwNBsds7Ieahc21HLYObapJ20oawrZysp/mM88ZZU4cC4QS4ZHc//OExP8ssuLFQmYSuGZ3zXMuQkqRknl4AxmRfGjfqkjnTICqRo4kJVcbKilyreG/AmmoWDzbLzMj5AqfFRJ1ERHJR9kS7K2eSCm9/bZ526IIqf4gMDRhNVtB8Vbbh1ulGpKpMvz/+5//wvf0g2wja6VeoIegLVFxiRd04ZrEAAAgF9nDiRmW3q1+5KpbMyPckeCWoHKQRWJVrMcd1KSkfh2G5oD+P5ATs1L0catNzcWfKHn2dRxJx4o1dzUVZhLa//OExP8u4y7F5MPS1Bn2zhVEANZUjMvSMHS0llBQVfhAKg2dx4Ht0jKKtrMnkyHJndKZaaD0IbSpX+443T0c8kKz2pqIMpkm5EbM/pz6UpNSO+7gybOLRJmIHUOyNN8MEDiAVQoZtzCm5aNGU3yuVMOQmeqJ+2W38yJCOXWLle7NVcQgAHBykcVe083NVKWtWvSyMRJ9JVK0qHFKpS3LDvh2o+Lo4P26tivMxFdU1lDFA9r1RJvG1b+RS5r8bnpU//OExPYty77F5MJFdPGsWC3loZXDUVtL+dmpFYMkVF9LPWuTf71TTHvxp4pgFt1sgQGQTWWtr3J/c0swf4iGb4EJ7AHnLPnuFfHDNEQEAQgmj/otI9a99pwUBCCjlxvNAi3tiWKm+vUc6WZrX+7//1V+U3YjFL29stV64kqav8jC86rAApBlT4RyH9S2JQ3J96s15ywvp/EjCQVIXprlIGGBFU6LfNr9RJc/w6EorC6HWZp2ltFiLqjD0TZ1rkXE//OExPEsy+7J5MGFsfldzpc/HSHjCOvbOxODY6xSu3sKWFmC7Z1w9Qd24c8uMzmYCQMDJHH/8s4N955kqFB9tA5PvcrsNAzGzs8g1CBrzEjMUiHT/gG2VejgCWMVQgk0lJU6KJXMf/kq1vytzf1mhR43F3SGjKKuaC6zNQs87YAgADYrbfrCmjc/RVZZL41ENQdt9mkP2lUne1GKQZMzibUEOwYiM0r31kBgINjodg+EI0AuBIpNSTkAukJOJYdU//OExPArqxbEpMPM2ExfHwe6QDHDjF6H53l20/VznBa70g20pkjSn1CfciQEtran498/ztIl0+iJmlDZk2ipB+kApO8j1MyePxw1uFHHCc9BDRbygSoER+flO+hSm1/2cWg+zEv/9UfVmBYXfvK0fSqRSweeWVMKwAAMNmIJcg08KigzWYVkI6Lpkwdx1wOK1R/IdiamhMB4BCfH5K77SmMLafuZfGniVttnhhqKUz+v62ORLDtq5OUOZSppko27//OExPQq2u7F5MMTDBWnJZSzqiBhHESoILHBIuJiVJ9ZZGRlFDjK6NCjcgJGC6hA7rrQW/dGbFXGPn1CNUl3OaabDwoJyBNWsMkRDN2e1TeCjoojkCNI1/yrTGzL56bgxPry2KN7oNLQ3///r29RB9X+vc9Sea1COtAACVjTRZGnuocJr5mbHR+TR4LopRRiZr7wlbZDNwenQ5lwsKVdJ9jKlGxzIOxdlyOtFLajLvOhLalzyZxlpNNpE/ikOhpP//OExPss4x7FRGYSuHRiVcna0uFAQhUP2B7CiI5wS7AcYiw9+KDQnPMvMFN7pMPjFHkEp5yenQw7v/K+ZeiWR/oFoRw6gKAgROOitGrM4eiEElnCkgyKCv+uj2nLkaPfbU9Y8Njin+ztZ8MLApBjyoSGPXxRtT6n1n8omCeGKsGAADLVJxJMw2VhpVXMr9qxASD43EakWl2X92r3iqYgjO7Jp1AUbbFZT/YH3LzLGNNILDYpm9nirpDDFSZopVdq//OExPouEvbJRGPSvOZm6Y41c6U6fQjKw0IWyMBx7wsrrMtntKWgxpfCxX8N6aMG/UqwDNFcVn8QZAcw9t3+ij97IkjiWDQUVZAHC3VMimMOpMHbOaDpu7lAhS4l0EfaX2f3r/+PWdqOepb83///jAjUYYZTUfmYQMgiw9WABb0AQzWjE7MTkZr0j9u9SwzDLP4y5aGRfRp2ESlcAwQxB6AMd7odhSdqn45LlQYJbhsFhbyxtpyy5TsdDIh8pm7M//OExPQsG/bR5HmFzJ8vjOv4NzNmF0fTcO05Yx9QV0yyQnOkjRMavAfdeb7IxxSLmH0gaS6iNhZEpiBZNvzRuETfkunmexOuTscWlERm85cOI7lwyFiduxtMxZSQ3lrqoTo6wKSMUCkwSmplsIp/Cu/L//QoOxEHk7t0QVh9SXKFhUfLZh7i6tQAubOsRdM0aMhre/UztR5eJ1YRwnIixkMpeXjpJKU7QSTcioxM1e4JdodGYn0QZrxkWi9QANDz//OExPYvWwLFQMPTEgsCJ2xbFB8GBeiEQJoR86ydahYimrFAy9DCmP7z0geoXZlFzoS9O87xZrzuKb++4z/gq+Bf2dhzHd0Y6//C+MeaNGsrvgzkelc0+slhMgnuNAW6ERVeefQWIIkw0Rh0K1IaKViZbXOJDVV8lWQIpSyq+vmrcxmnhikQgt/JfE3QvLMh0vu3skhNagaopZDpFFWF+32byV2IRUXgxuGlirmhUajrat5IPm4NgKXM5llLFWuy//OExOso6wLNQnpLWEh/tLLpfNVv/jp//BAsiTJVQRQ/9HtFs207j0iBZRcUEiT1ip3wHdTecTREKXpCIchIvZSkV4kF+ir+a7lyVEiSbQadpp175nFzPohcwSc/a1pV1zNS3+KtTz9Kf/DoAIIkiIX+09MpRgm5UODbCrt3SlVMQU1FMy4xMDBVVVVV9YAQIAOgYUoq2xXRH7QqIbdHa3jyCxymTgaKXP6Ozq8tgNRqE3lg8iETWIWBOPJHdWFI//OExPouU3rFQMJHlE0aVMoumBavIxVSyyU0aLNozmPy9yewuk/N7kBuKGXhm9GhTczNAj1TdzwiZjeh+DA3EFgqLiz4fC0AFfEO/lnT/tpHeqaf//0i//mwc44JjCMX16Xxhi41U/9bIZ0GDTMg2HxS02qEAA5RfiF+/A1SLPHEYesMboJ+MP5IEN3LZAi07dHMqLuSXpnxI0KZjEXoX8zJo8BtrHDKSRDCYihCHjxIlzW0ISaobCZIxuRkgxC4//OExOYmW7rWDnpHFCaXksuVfdfUabVb3HbITLLbXT87ewt+4fj6a9w6by1NT/Lqu8u5pm/4lWIMa6GtURWw1Lukm6ZcEorpm9wXShc63PDng0q2C75+J56UbAr2tWI9kaW1XOoTA59+ElKCghRZpUjDXCz5JfxmoIf/80qvWGfvuKL26//8Yyv+9f9/K0+OlE4q4bVlGuRsxb16zmWltayGEAOmYDhJFa6WeK/Dpc+LpeUjyOLM5PXlbKEJ9DyL//OExP83nBrBRMPNPJZ2E9UwpC+fjoS+IZlgsHMdTlQ6f/4sHlTYttK/YOYqtzBGb2tTSKZkmm0eyVZhnid5BJ52dXt4+qNqJ3o0V2L7TnIo+rcivbwtR5RBBHVh+ko8rfD4xiX39sLNC5wMioxYLDWinc5S5Huen6KBPGIG7m61kECNdVj8jsUZ47hYRsWGjlKjleXJUJMU6AXNyZVeXQm0pOI7kp8JZVAkdeeB8J0YVCQBoZwFnGyKTRpEMPn0//OExNMk4qbWBHsNDOpLoghwbsQCkz+S0drqaZGyNyA31ElVD7W9HSFlQ5Ono19/Tguw9/Yi2x7Ik/R+qajps1emdOYqlX+HlVxIVNDi5YyS/9pkMl+3ipFizGM/NafCcu9fx7AHBxgEmD4ED7HDjLKTKPYkqOdXK6xyqAAANi7uRe/SXKfUzGJ12aSj0+zVH/aREiEzNYAhOVhVRYFBivKtxSEtLijZbrmvQ3s22zrOPTOFGJdRRm/2w5s3DLTW//OExPIrKubNQnsTDtL8DNxg194cr180SAitg+uhErIiKBYOsAPuCkTopIQ1RKoqWIewoxoe5clQlqqDzAaIeXYaR6lRCtSF0IjS2cwZYMQ5NjSM4QyjZAV/g0O646KKdpERmgJT3nbYRyI9uKajfd8b/9K7/1U9bonq3sn/0XMKIHMHkM94rglopIAAJtekblypJYTW+SkFhbdRj/hipUIfQZKlgsT4skYBVZmpWUL62KU9V1YoKH4ZhScghYql//OExPgwg+7F5MJFlDNk4/kktE4mEcwRjEeyJHQWJW5yBtKZ9h2q9jqODByOxww5WdggOLVXQMKmugmjjClWthiu/hnM3dzS26uKy1Mn7DtemwwK7EUvONcjRQNNFn4ZbPSouTzdIsq5GEQRgp7uDHr0EKPkcjETg1PJo1/UUsuqhIAQATLYAjVDfpMqb5ZKco878knJVRMjkjrCxYnDmopQBGYacO289K3/xV2IrATlLVj9in+ndSFxRjtPOXqd//OExOkqUvLN5HsFPP+SQzEpU5DL3YhxmCib7LEXm/TuOi68TbpLJe5EAR+endG5tyHCU+SifeTpHt3ro4x48UJXoBncQKoP/2AscKRKmSYTcmcuoJd6IZLuOa0sQezSSKMv8KKCTT2Smz+MFiOOHiEWOHXEvipQM78yN17u7FrnVJtqkGuCHxChrqBPl3GQADaJctXjNU0DcGNLNaK9eK40SrJK5TxZl2hY50jHb3zxPHJWqWmg+wphdRbGXoj0//OExPIwA4LGBMJLrJrzFlRPIRBFroWJfKQjkl0lnfkI5T4W4lqm2Y4w9CGbETzkaIl6X8W0f4Uqm8Yqf7Yq8ZGATTeWX9neYsq+SaKUTc/Gg8hhjZimjMIN+2o9PYzMzCGLXOE70HqZql9qrBaoMT4g3CcehwYJ1a2QHFYJG52evSN330jUO0srrw/bfuecxowwWin5bT0cHIlQGknDEugdvSeIpPSBIXRKQCmBcrEoqIhIOUOg0lcnBOTSbpUd//OExOUnStrV5HsNEFihVER0B00O1BKQhrXPE2M2QC5hwCHxsgPYVEXhBC1+XNLIH+mmCUfOqMK/nTSizhMe6TdiDmRllcPkJmvnLUUMIyKBQjbUbqknWiwy8qhODaU2Ec0kEpOv+4K30FIai9zFQ/TSldW7ZpRqNsrYkrAHxE7kgePrm6XtO1x6Qfes2Jp41I0bTWu7KRZjDONEHydz6EkVyuHJCEONmDHLqQVNF+c2Ax455EtPdDVo33bZtbd0//OExPow617N4MMTEELc2pfO+VsPNqfqhteRlGSOIiBA/EZIq9hy8SesiamnE+XhGBN/jaMgedJ3Ew4rcptQz9dC+Yt5LlScWFQVKk5KP1QyLjnpUiNWc9gkYBTKPPJ582KifQq/wSAmf0ogMqFQMX1m+L/xoxa7BSsVhv+l45TWcQh5GdcGbphACbNSZiXCoKDcyBAdaFD2hgkIFzC0h7b7sivH0foc4jhuZZJz8TDS5VeFGl1zG2dJvKeO1yMk//OExOksQ3rMoHpHkO1MB9SozECQ68RE4kQ8oZTZLH7uSlYcMwYQ87qsW2EtkfKoHwcdmkorKaIsimfOU2KTMVVOV/VRCroSUTidUumwWbZ/A5Yphw8gEzZ26pdh5U4oTikwK9dJddfuZhu6ukncf/m9PiLeNJJDxtRw6Hazkfum/QX11YQAACGcipYd3U9XKExRXzJdlQgvJdzDZEGyPFpgKIi0JgoOGo0NcVSm0YghzGIarWm3zZCerFEMNw/V//OExOsryv7NREvSmHFsNNHhoNkxYjEjzDATBtDxmIlokKIbPvpdCTB4qndxecF58hb/RkDDWedxSFXKQQPh9240Pzr2uLUvAikD0Az/+kOCEbmNJClclE4Pg+XFb63vg6UtEwoOEMGXFx4DRBxwu/R+T85PW3cvySf/xMUZ/4wSeV/Z4yCqwWGB3V454fJ5t8y6OejihqPB0j0EgJ0o3bS2FqCoBgnStKk0l5YEkkJ44qaLU0y4KQ5qD3TahbHi//OExO4tDArJ5HpLdbC+niNPKrVJyK84E8RpOsi0rYrhEKEQWPCJGOCIP8uXJCgyFt6RIbNk3I1IJC7bAWcmJl0f3yNkhQfoenUIWPI9TMeCa8YD+mlHcPJHG3NBAuAi2g+4ND4ePznxATR/STEpEih6xAnP1RZC/k+f/tM//99afgdXV2sXxT6U7o8VPfxhIOZ9VVkACeSeNPeSOfydf0ezOmuK4jyalwyNQmbJ+UUg/qjUpNlgt4PhaUnzQtUG//OExOwv267EoHpRlouHUSBuVSW6dwIAUI5Eg5MUwCxeTXzqfhSRIA/UwgmokkQPz/tH/nUWTZczPKsts/+GXvMUFlZ3O8yAEcMy952qs4LIkBC0wMw0+AP5+6vu/f6GXWKzkIko/yWV0X78vpSdUHpk08D0VWYEGixrPuNWnlrUAxYS3jMNwq8kcEQ2RWxYaGMDKFyo0Cwt7CqhFAWQrwNJDVOiWFlnQSUeIZM2o9Dx+rtClgsaimJyaB4zG8mm//OExN8nqvrVRHsM1KQScOGUnUjlBuvMzW1XsKIV+QIWTZEmmmlUf07SRbtbkMVS21UaySNqbzIqJmhszHk5VT3AYG11TOmRkwYQ6bJiIQIC116IS56GTTPWbbiUzqFqgoaJoND1XQW1Fqigp/NYTMuJvkod72oqNFMq8HxVnL11sgCJ1wKGDQvNCcEQ0dDmMt7w6wtRzlAvbVHOQX0EUBCx6zmZ2FmalpAG/FhokxDpYhdzxR45ur2w4VTomKaK//OExPMs24bNQHpLkBLZBUiuhqOAdbm13qKbkz4bJ0RGTMQLFx8suR5CnqT2tTOOt9lucY53OiRI6NEgvRmZDolQs/CplQvAn/JnkDGlGPFA4i0bYSgTrxTbKm2jUzLjwz0REiJUKa6avuL9/xjL63///juPhqVbrEQHhZDoFO5UeExK2GpdamAA2bIsQtlYKdTERoa9WfLtmOREsokhuQ1XpdhIBITfQ9tQxyqhSZaBNifvS92Vo9K2gEau1cqW//OExPIuW0LJQkvSnHcz8FpF4nl8kUAXiuaHJPKs71YuUAT44EQ6ONP4VagVyARRMJ0DR5QTwaIsGDCUkJulzC7Js5IfpNhAMk7mDCYqYKVvqGQgK7FSGKZYydFB4PiIK2YE4UcPLkRiAa6AkMLDI8OG4pG+0bFBgjxQ2YRFn9RbOkuzNBB39ff1u8BuhVvPgdB0uu8AiR9QukRAs9QkrZYADozXmqVtE4vXP1LxzCTjsqE4cCyqW3pG4TCqfnSJ//OExOsyg2LJQnpHsHZMJPOTYuKlwSekMKVU+tnH1K46YM3WvXon2iU0WoCc8c9arT1lzDgZiDfV/DyCitMqnrDN9EsjioacfJiSICBG3VZsVQAhILsswYOAB42KKeVMRRiRV/zQtnsT0SnEYhIMwQRTPGrbnj3KBR3id+Ow7WAADbGuzbBZIDE3PVatMNVlfkGGBjZWpyb0+wxRNkJEELGS9OwnSsOUd5zwG6hM268VFyHGqFcQ14pTuJE1shcX//OExNQkq2Ld5mMGvBT2uT+Kr1NHu3AEUAZMABVBpoTQQLHGUwZKfzojbaIWbGhhnLXn6YXiYFiOErw6aOEkufECASIDERUE4CBgNVmkhKGi6AlTTna2BNGXOmEeNG0yVlykOKtIROmq5H1J+kK8ppqEVVfpCyfh6LQ2iIwkP5Ro7I3RG6n8g4XeDEY4SbqSdUxBTUUzLjEwMFVVVVVVVbWiAAo2m0QkQ+wSDZdsQSUIO0sCDf9y6gEBeZKy5i2K//OExPQxI9bJRHpLlfAWYDJosiX5MWBbwSzcMD1ZmSHUmzTCXte62+d3Mue75H8bbvn+RhZfbFZ/37R/7I2VZpp1+NSs3eakvFJObqPYdRvQLyNY9pq6+sykxYNRU5FcFshSIRH7zVR2NZSEXl1nVhQN+p64hAAGAcaPiafItP3TxSdCxdZuNaDVsvjovQXwTBuS1+GrsJ4VzsJ1qrDJUFypchoZR4gC0/IbBYMljnr/xgXqzN+UxIYUHnPQZASI//OExNMhuqbh5ksM5NFdom+0pBEiwzJluelMbZIK9HIN8+NpQgbFZGKDgHws+uWqHLmDIoIdKIyzC0aMkB5YcKGqigNncqSRvbaeqY4QGjsKRkD/Exc53o53pb5CMN3nfb1Kqkjr+q8crjnq6jMPldhVx3m6qMACOFJxXNqVLayNpeFpCpH7giVC8D0hK7wr0kfwcBVLtc3J2gF03nOrj+L8nW9yRUyNX0s4wEmhRhtSFKdVLaFE6bISJ6dbvDX0//OExP8s4/LV5mJLkJ1O3SvleVyzwosdNokA0khs8zBC9yFKRkueTTZKF+XKExByQVmVHKbbWPEmKtcCkZYNpoBTofnOAjTDJo2WMixMaMFmSWVwiRi7B5QMtzKYtisSZNx1LitboEFpu804vO0z//8yfrJ07F/0FJ9Z77axetUADYlnGYcDKoTrcr2rbcxLCoHWX9MoapmyIZgTp/kmQ1lYlvKdXShTatY1WroLc1xHyuXJfVWi0JamovCuglTJ//OExP4vI2bN4npHsBHDIqAIkLhb4xqBQLFG0lf7urZQ1GMmO96J+Mo1zb1FELFJx6NVjHKnySFto/jKOlfFDaf5Rpl50XSLKoxuuHqORIjjJAJYnjtF0KhPY8ePRB6HLIOCDMM1FpTDv6u7zS2fSTZn/2bxq0OJvBBvYRD+AH7qhQAAaG/gQnl2Z3AYIrFK9TzAcTVCZm5jZnMd5wocbEjmvwYrxpX0nXaKEpKdCpEsJRUVUFQ2RAuiFkdM8uJS//OExPQtE7rRRHpLdUcNLqJ29olJoOuZLvUMzufp0az3Cs6NBlTxvuStdRzlF1C5CsxFz+unHK/zCHDq5khYQFiQLCtGaJiixZlklPk1MpmLeWch1w8ygYXi06rOVDFHVo//VPuZ6iws3/0C4NB1AmHFhuaTTPAAqpeWm9+re1I1ziQ1MrGE4F9OH6rmRXJVcgJRIxAQ8KicJSylLJktG4i5QaisUymXhHHyHjcnIw7EhKIBYCpebp0xSa0+qpOA//OExPIpu1LV5HpLPJkb/6opfKOIyWnKCjgxKiQK2/tae+x6NjA5ykZEq0eByPAJuiiiggciCFocIOsmbxzAMwmsIBTAgQoekTZAp8igSPg0HWhwhGGRXGKk0rxv/////yU8MDUH/IWukyJhqwUGpBMc5bHANaloMeU16ck01LKr7sFhTiMkWAflr0ujzqrSg6Ck6HHaTUV87U+7r7QY/lSimJOy93XJl066Dzsff6NNEiFXIVW1EIgCmFXi4qIW//OExP0sMybNQnsM8MUIaLoxiB0sKFGdPl5GnTmfx9Buf6RzP/0yT8gnHHKhIfZ2jusipFL3GCFCLWC1sm8ksFdEOg+RHBMQtA+XeG8H7Lqi4bnRdzA0T+LnMLhYmYAREIuHRQO+ZFf/kJe52ahKOplfuRHs1HZHOikdpFtzCpdakAAAN2nzzLDKwQLL0jdMeJklAi1eMB4pj0iHiWFDlYZSsmOcsOF23oJzMs31arDoVyGE0LgcZNDKc1226VRf//OExP8v6+rEosJLdhDjeB4FgY3/XnGi+yToYFAIO9MC0LJVGwdf05lS9+LKZ32ufYz1CMf1uwo+4LrxP+oXOfnvufgmzYN70qXWIIlSFVAfUIlOSeyKTZtg+SxeyY80aNGUauDv8bzZ9PYRuFf3NTEDDVZyV6Eus7N1b/srHIUpwgtiR+jRkAAGkQiUPb3b1yiNUV+7cI5z5wqn14L0mZ4TQS/KZkXZbp1Luj3LczsMaIhCkiHoW5UobIqcSF7i//OExPIuA8bN5HpFlC4N9WuCGK1HuSGHQqTkTjPmzPVsbHioVk00C3ZOarMEHH7mdfQPbEPzRrsskQsUUo+J1DrJImws8jKzOleOGDE8KFp8ohpxqyaTFOX/8dNBCFHFKjkMya+e2jqh6qpX+3URg22S/AJhT/xPpAAAIWEvBhPMPmBggqtXKEjBqI8YtUJHupkKchDx+jARgLJLs0IkKGspf1DHTSHGqX0VRGjHL4QkyxunhEwX54WIUkuYwwA4//OExO0pO1bZ5nmFrAOhDTCIXs/DwWz0QtDlEbyiSSRQ0/VGjWVnwu1DbzuiUXlhzEppDaAsHxODhGiKcmmsLD/PIDLJTI80iNi8YIiULOEyliAVjUU+gaiJbQynCjR94rDsYDJslf7oE8Y6NJ5ZCKFx+0LefU4XvYldm+aTh/ZnK4IM4YOqUOYr0UW/ofoXB0CBQJtCf/qIkBAAedROc7HLujazw4Dt82qVMKtuqk1E+casr84G+0WtWeC6VrtT//OExPs1BAbJ5HpFsLpmsnbpVkes08V4hsqwolaLCfgvTlUc0labQvfHz3KgjNHEVSZ58lz2Ikmdau1bnxlYs5DsVSf72ZDL/5LFo3hqanTEO43wxAfCxxEGDLOHScXeYUSwmylUq57WCvI6X4jxvxZR6ZgxrMr+lYpiv4sqcQAKxdOeHC5XNDFaYJYTwaqiQpemyj46eYWaEjB+nRMyE+WUNLFBQt3ZZG+aRyI0yV48mBC3xcqpA6WA0S+mELea//OExNolyv7Z5HmRjITI8GZ4+Q6OwqJv24LaSyqN0ko6beDY4+kyZQEaLVPZyJJO2I4OYE9ZymgLHSDkvDnVnIpIhyPCESIDxQXnSrhk3SPAwxM7EtYCSReWUsqjek+Sr84/V9WvD//tnLD4teXlj/Ff1nXPnZnW6LVgA38TVfGeq6req1l8p6rLKHpWlsSdp6spXBsCIGUjFewqo7RNkcukcwqsWw3jtLgWJmJu3qNyaFtFJM/ZQkRth/rxkRxw//OExPUrqxbNRGPMvEZ+4qtkgdxePT4N49XxzvlC3oTsMzDAWRTDVTkn8pE0KsMCnEDUGziQnjEsaRKHy6HrsjRiPNEBEzulyNZAI+ZULfTZ5RJEQseLKVFeRrw30icFHodF6PkiYm6W9FYqzc/7WW7SdQ0aDso+Q6PgGs/s+hW0AAACBGoKITqeNiJldyJW1WJJRCfq84VOqz/VkVvCZQRlEDcerz0Hw/P050y7SqEraGLyRYlepGFdw3JkbTHS//OExPkuEybIpHpNrGhrm9OCQp1YSaGhbIvNoIRYaIDoKGlFI6RpNHmGaVkmjjjKLKTMxYbQ+QrzaJM30iaJ1VkfwumdUJSekq5KmjTRv3kXZph2vab/XzW/bdMOQeRnIA1cW9GWHdQ8kF79UPViNsT/+i9k4pC0aQk8bmP+AsACUexraR8rn5LHM4xYVywA0WKwnidRB8Ia4TpgMUfMfJQocecIx3aReo4n6wc6FR1emyMMSoY4SfN9UNAbxzKM//OExPMsa97N5npFkc0TEWQJAeSbau0p7QqNMGG0Rsky0eLZmz2U9IYEZtq/QfELBY61MUHzFMKVCw9EkRk79LhheEbUbRCuRsdaiPuceQtpNlDSBGu1/GKZ/0JOkQCnlE1YG/dsr0qmeIpP21pT////6lhm8k3QV/zYfA//WzHnytQNNOr//baqyAAANEE/RnleQsTOmJjlYXTMfRgajKQ73Ssj3qRpMQ1aXxacE+dLfWOcynPeCio7MpojQzOT//OExPQvUx7IpGPSudbKSK1kW4byFMbI1jj9OsazE3za6Siqc276K+3WOtFkrJa20DveY0xnpnnEK/lNnT0GZzs9ZE5RMTELETaZKbQN+RtPrrKEaefGuekOOSzoOOpA4oSFR4kPjBZhF9H/81Sd1erPWmbdv/FVMnnZRCHu6VrQAJSW4+spj17d6GITIaaNzblx6SqZOt8PuRE7b+yxlS751lzeMYWwrM/L7zcrdORxmQONnC5p9HLkiYFlt3Kf//OExOkqI9rV5HpLkAjkgeCOQ9F2E/iJBQrfOPfyGcY061d9bWPYTmCZLj673UCaIfucX39s7cpEtlac/v2bPnJuvP2DwLChhXWL/haKqygwLgNywjUISGasHiV/HcqVjMzLD1niWSvUuMFXzCSjmClOJiQk0eNY39Az8hypEDEvV36bNGt/8cpmj7VEV6x98JAB8BYNrl9fFjq44OyuyrksrxzToZycw0XppFiI6Rr05ke8rPzs/KCmT+KBt6bL//OExPMwq9bJQsMLksrOGQl+XTc0KChterCwkJUNkDD4+iR4D0nR64kgr499Xhd9knLPV3xI3edh+YsyzEwomryaRPckUcgsqxRNyZWGIQiWXn/KrbffmYfnHA1VwZ5mYF+hPRqNGZ0eqKKRiknPoaZv9U3+gJ2cyyrEAB0unmdgsyvINV+0FTKFsZjDb2VjhHMdDBPMsDedH+sCwE3FsLyqGszywmMdsdmXCVEmanPaMO8nRbjSUZpEwNtbS6oS//OExOMnC8Ld5GGFkGfApxOgidrChMidWUWllwixWRDVcLxEt9hVtA0nSikH6k+BDpW0bY8oRCsKxQz4qlFKZvbbpGdcZJ0biYqKmkKg2QpKj5Es40zno39TSlvKGrgYOo0ckOPISVeTf+w+9NmstL76b6Ywkp1Qc4I2yMcrp6yN2/qO0QdiOCmb4mrQAAx5sLA4vI8r5omgMzw6nFQJk3KHZo/dvWJk2PltSBuHUOtDzVNFSsR1OCFNqKMYxmAv//OExPkxE/rNRHpFsGobG6KSyQ1kxDmTzYyNJTIftSKskIc6nFiYgBmg+kF0chXxtDnwgXLXiI8u5hsjY0gLkfLJExOGhQOWCb376NGoTYPLn1nPOiIiNwh5kyQyNv6aKZFgfyGSrztPf9bYVyzMEGEaGc0cIILlcbopW9NRQrPeh9GI2352/x8jBxsVYzjA85hF6YgSADUyhjYfTRX7NCgKmFR9OkUL1NAcU3I0Pk+T59a5nEISiNVtGFRJ5nfn//OExOcuw+rNRHpLkBuD14xTJdWq8009OiXJk2dzcpHyFqMtimK0oCcxyFxKQCEYNgQREqah9VEzaOm0mERwMx6UNXV9kSkItnwwRt7zx1mM+klBadchYYJyM++6koqii4kV51GsZ1tG1THS6k12Px2OoJYUGS9mSC3/9VX/7t//v4Mcp7QQAvjublJQAgB6t2Y7hE8Z68c10q1Y1OnyEy4UWHak1u6tftiLKo60qei+lZ6IW36hyKR+wbUh+pBL//OExN8qs+LV5HpFkDEkXIplKw0Zpms8E2bqmYGkUDWnbECIPqTBuZHKYNRHf7QTJQUasGWcmSihgcEOjNdXQkyOSYPiRL+DEj0e2JrKJwZumeSdkSSl0Qxet55QlkODDqLP1NM2Q5/ojWiSP6D4a/rC55olqPSgstpKQAJGNdc1crLSScENfUiw2FtL2rXyuJ0ossbOqcMbhhUDoEBIFR2uBcFetLpctB/nIgSwoaiHFMGttTKJDC4UckJUK+dZ//OExOcoc0bV5HmFkPJDStqgo3i64gpjnTc5sgXjdmbH7s/NCRerxlLOdM9SzyZLZaT2GDucw0WKylAOJmVDf6J1r5L+ZSF1eI0l82Eu0oApsVHCrJaK5g+W0AqMrKTCiKi+5wZQT7qiVXXnfmW8mVN5xfOFQ4GYQd0Gf/nI38G5VviCoAAAMP0nqG/Ei4ZmWh0ocg1zAiwi8bh4XbEvNsVJlOSNiXnMvoQQ03qhnNk03N8kUIUTWTVnwYJdBvMq//OExPgu85bMpHsFlOFcbqlenzNSVC1adqcDLaWBN1SHe9k4RHaguY51MnPbEmthEtX9xv87l7IcGz6TSBYXoQ4xvWHVYCMhFmTJdEGg3jYw8wumbFUxqiBhluvaFlbTCzTTHRsftl+kTSnPoYJWq79Wf6J/qSbnIVXHKVj/+Urf5eEgaeToJ90uH9AAiZTuaXoXjlVIbDoVYoEZDP4Twhpx4SB2XhLPXFNI8twDSJ2nToa1pKuSEq1qOiGinSPX//OExO8ug87N5HpLlA+U7xnRiVrW7Cuj7cS/K0u5asabQ2P5sWmlyH0fgKZujDJpd1QpfWpzTaxmK72YQRuXXW/uOf0bKrKly5csA4jL3FUkMHoBJGD58oohDaKkX9Q+HZqZsO2XKMseTCn1P+Kqybe+X/taMnxPFBUckc5K1VasPim/62vqNAACj40yMVfgN+XFjQ9bwjoracTI4Oz8UScVp3mAsxjwqc4KApR8xFIbJKjKTTAsItvfQkgZPhYh//OExOgrkxLNQmPS8CffNceIh1U+h6LXQ4A+UsdB4nIJijBskWIEH0oQt6KC5ddNn1DlZmPA2q/KvEaPLDbx07vnqmcPxTVFWamqhUUf50ifhlUoVFSJkdMhpMhSnK+skibHhFzogIKJh2OFRs75nUMDxifmfqtJdilurLM4vxJWVepEsm/8WliGAAq3V0jzaDDc09H7E3qtmjzOiSKdahnsjZGNiL4i1csMbwuhosRYY8ypKF0rnKLPDR+oCvZ1//OExOws827N4npLkFKxhP5RKVsVzEqrqgO9tkHwrCj21GTOpIyKaIgQxkoauNdlrxTOxa9NTeknFF1kky8akt1Hyd/aKESpbVC8SFDOEiFj9QmRLGE+ZNJsMmq6538aciOPCEziUWOLREd0I1C/oTZU5zrio82g9LiWt0SCC1n+CtWAACSuNzmcqpbtTCTSWVv/cgCddhl8Fzbtsjt2JVWT+imrEja3QxtN+mf/tyv1yHdZu4MNtVcpakOMQfx3//OExOsrS07V5npLkOQQ2/cHOPVhEOv+/bFZUl8ICtmNEILPV6EuGGzZA5C1MUYk3ujUNUDYGZnqJuyfvxTezgfJOxdh96QLkenEeg+StB8eaSREYuMGyYVJBAWmKxKBssdAhcqCJEPms4hQUoS+MU1z6r1bL+EIJ/rnzj7P1+l/5JZylWaY7ty1I5S25vT3CAWECthAaduhPxM4UKxyTEFNRaqqULIABhyBAmSk1JlwNI1TopHHjcq+t1CeiPki//OExPAzrBLIpsJLlReXXkxPheS7SM8pKZuyKVVTWn0P0qKNzKq2FwjjawhTGgZie9SiD2pw2yYGNCz1G7IHymXioOIwQbdgAqGQeDjI9Uu5INweCcehz/EmowhKhCcZAJ7xssMXhMo/V/OknwMGogblXTFCAJKUYtCdRqMkmiU6wvMvjEOaAIYejnDexUEW5vcXXFNTyFKpxWlK6Kg4iY+QsBclVFRhckEbKkLJqU7ZM5rbM6Kg01UADxaRhuys//OExM4georh5jMGuNCWZVaOrPJVKJ+ftNBPnXIiQ3xVk0xVhlGvGWlmwo1pDK7GNN9GJVURcP42KRCNv2S9bxNAkMqjI7yQeIodQ8Dwy+rNWkb7D5I9eck/97E9RZ0o/p56tnUflFhwk0kVw91/On0gAhoxMsAAI6ssR51A1saim0rn8JnVJ8Cvr6QHymFyp3sdXDcZGU3EqaZez/yjEcpHBRHYuFEeCKN5vWDlYEINtQKweBc1cgWWOqUsT1ZM//OExP8tKyLNQkvSnJHeIyHwsBBKzKjjBCFkGJVFB1F2mGPQhKipci/XOYWKCdFCZ2lGUQqhRqxG1vKCsgXQHRLQXIlTB+cBK3zqkZiXfNEIXFj5Gwip4bDL4VKimji5y1UcooQjAkcwlxXu2hOvyP22//xpCeEdFihGDs5P7uoA6WSS3m5+I072zsYjErlNm1QvtBNdMZ934adGakTcp2IAgCIqPgp8LmnhqzDtvE476zcN4M7hxw35e5YzoyN7//OExP0vE9rMpnpFkVZjx0cPP09kkbm3zXmXpqA4rTmDOTBtPLYpFqegwlcRRnnR9YQ6n7Rnjb9/ZRJnjq1KkIwK0J/iEmqNlD9i3ToNx9gNJsaEKZM/CoixRJmO8gIllxzhQhxkZG0BHaDOwjcsqlWxOk3USLxz1dw//qGfzGeVqnf1feSh/5GYFOHEd2g3BqRjMOQQOuocbaQiACEuf6siQKaZrP8sWnqtcWwrcv0MVM8jA/ePl9i0eh/n4rjT//OExPMzLBLIBMJFsYjgzu46KYi56XOGxhcni4aGNxXocdTK+tVMwrTkLMdReLYnh2ZcTabtRhWHvg2iKsYMKoz+//GInkHGSJu1+eRcgibRHHoEgjDXMM6vM2gT9K5SKZhNuUziKnlG0mmUU08vuVF2Wr9PFagWLbj9DyKU+5yCskfcZpQSaoQQAAsYxgObW5uKfgQGar1hSloqkLW8MzoKqUb9GJwvDC8VyqVa4JFR3yxF5ZiROK5d3SrIhzW8//OExNkoKvLZ5HoNqEOc2WZYuqFyo1IuC2E3iPSBMwS1l08QjBQ+ZvHiRMYPrJMGq1HmOJGcDmVHDbKTtzW6Ypn8lkfi4tqPNican790ComPrYUBOoL5SViGXzxU8VfxapHkqJ5WPxTAjTL2D+UWKcw9m/nn0mN1dHvwreutbmcev0PZaZjOQQR+rZG9nBhP/K1qGQRRgQoqoZSCOEGLg5rMAkAHEKQ5o7qNnbdTKujRIkaVPSuSew2vJ40U/+xO//OExOsy9A7R5nsFlaJBWBZZVXKuVS4QDJbI6lTTkZQiHQXdnQLFi7qAMzITjzYAkbWqZiCUcaQQblPzZRIXw6aTSyJlR0IutqtgfURMI57Ki0NMdeDXOnHMuqly7Tcwgty9mMfUaz9P2u/fUoxzjRGxXcc16IpCqUyVf+Yjt/q3tt//nIQQOEQmQhHCPGC+jjsLDj3JkAAOA1FpV6bqvUTDmcK39dz5QQyqNXWs/rSKEvoKSiwBTRkeFs4qI4cM//OExNIprBLZ5npLWBIKC/j5UiQjpcPSQ/EjSGBxgBhE3qJubZXXOoFq8r3o90d7jDUTtbLWXzvLkg683cJ8x+SN75z2KY50nUZLIFgRTHrzeYPzm/83q/fP+8tzM7xpg4UGAQT5wzP/QJ6CdXpPAs8GzLzvOl2AAiaWzTXjxyh5o8HGigekPBphAkBItklYjbDtD4Je2cYKHHEAkne0IuYyhSgIQh6gIYb6VMVOn9CRBwp9JrJZJBYiN62OtD0P//OExN4lMsbZ5nsMfGVPqEBAbOv4onENlzJ/saUYgSCdDaptMsIGkc/MtrR0h0oRrHzKNtCQJC7YnCHC3hiMEUB8dkkKSMWHCVw0KHEgJEemPVo06HyiM3AHw/zLDlgpjGmHpoKxKUnW77S+qzN9D/CHTtZgQKPUsHQ+PDT0h7ksMbfTwyq1hAANiXLVNW0i4/FLQlrB+RrGB37RUBtUsiOTpG/ApbIp8EietKlMfzsBRyySXEM0KpcD1apKiRCW//OExPwwWxrEpGPS8Ma4/wpsMtNOCWTOO6Ttppby9GGC9d0NfUvav4j8h6YHJFEmwqOmmHLLWegp95DZC0P6naWVqSCuBIod0PFbsf6/vYs8xVdAhLTTXM6uhGK6s7kIic+r6f/7fUYMyeVoyCXUYYM4eN1BAAGV+IssJMxrI2AxOCnewFe1yQOwh7QXhxVJNIkULlXRdQvVA4KxNKA5XzE1l+TScQ9JEnSrkZrIiIyldsTM03V65UyVmPxlJ4su//OExO0oK/LZZmGFkDRcyN/Qte1LLJLKA2YmkOYSDQz7Mfo5YcMKIFG3njTzs2z+HlGmlhWvJCKDBCWJkkWGuDwmVXORHCdGWIZNQJMONmaQ7+gZbf1umt0nnFuv5s1DEnIVYRypbcXdiZrNq5R/y3+3/UeCIbq2hzZw2Kmjf8FFqjAEAARoq8gNJTWRmhoaJMHGAmvwIQ0geP+ePxyQ1ZbJ5fCsdCOdjhCqEd4sFAxPWyuPyJgwH4zLHJB4eaNk//OExP8wC+LMxnpPsQBlEo9o2BZoQoIEIocV0Gyc9dvktkaZbR/W1axI1TC9pHkOMM7+xpg/2Z3vPNxmSjp4uwiEU/ZdF2OfIlGjArSpAhrDqJJbPyi6Bk7QocbTID/pNdx7/tYoh8AMHA6YRxFqb6ANKOzmGExBTWRAAJHpAc1Y5sjBM3Zgu4BlqFSvO9GWZ1YONoYsx3kJENhYlFOyFyL9GblCjWJ/HVq0rFZGfuDitulUuVq7cg2KIr4CJb95//OExPEpwt7RZksSfAAJBZNQAAQOpKQLMwIOK9jHJBNxAHiStzsoiND9Pj/T8WENBMw6lFJu6WC1PmAowe57GawepDgvHuYa/YIH6QZiR0AQEwMUMvUGIz8F/Z69qZuylX1+1UgKjDGPFBWoPQuDzrgCDPVhsXOXU70/jdV0bS4Q5hTJiK0vHiC2uNUNQ9dqd+hB22OY7AD0sR9q07DmVkEaSi1ROKdItisiRmCA8clgyFMmRgP2dUIJDE4b6pTD//OExPorXBbRRnmFkPTqPV5yGAXc01d5UNuJNGfH6HZxIZ6PCyAZ1v97GeMLsu8Z1dUZ1ntKWWwofJzJOeaOiPjBCbFUFjwookBE0c+IpEKwrikfnb6LQPsN9JZnJIF6lrCSV6xBF4QqKJqH1Zx828+K5lk38wMnEf2qYADMrXtn0CRimX29xivcoTUhpyck6hXMRRuUEvKso0wBpDqFgVaGLtfT7wKIjB0snBUBkXBLbKlTPFBOGoUiwfxIgN0x//OExP8uWw7IoHsTpI+deWJ5F5AapUlHyiFSNPEK2qECK2MZlXw4pA6umgFU2z7RGuiwoNSLv7y6xdpUsXMNSmUTJo9vKV6RKWTJWooAf6SMwKuaTuf/Wj1FO+EIV0krhv9d39ZHf0gmPCRR8YJ22SrOOklRaj7K0AAAiw3emF2EqLDl8jkxCYUEgCOGK0dS2VUokOpxJPxt5QE4fUiUOkq1TEVxMjSMtu285ExCjKYjzvYXA5RtaeRmVndK0qGS//OExPgr4xbRQnsTKFP4cNDpIkQy7qFpH+IE1w+WJjMiMYKF3IZOK0JJUhMny4toyRCpRmBv2XNFWUB8kAY+kRFeQIhwiK1iBDRH12XJBQyTRjmGDLDf7rYjc01J1DO6S06RL2jvpebUs7uFtms5//C510MVkAANlbnCO1SxVZGc0ik4UJnUxoFASSRxbELa0aubmosFsQaeOcIctueCfKpnTjCPE9C6GS3MyYHnIwxSUEvOslqKDkQwWNELyulR//OExPsr2xrRRmPTRLDOUqxNKB8YI1hCSHRIS1JXSZcndBhChbNqnIomk71Jx88IhUfzRY8/00GTmHCY0Irw4sYEwrs9SOB85hfGhRUi7mEBdk4G3ejdI1B7f4WNYfE1Ua1CzJDwmVMVKQQfldtC/2///9CRo8W0H4cVkAAJyOeSaA2x4b2dUrlmVCnV6nJYmD+XSEKPLAyIk3DRRCnajsQsJprOl6SyGSlbQ1HmwwMpBDHSjier5ChgBKBJy4lg//OExP4uE9rJRHpLkBPAg0piREVB00JheZk28jRRQCiDprz56kEUSkbPrG7PGc6eHbQKtosOMsLsf3Lmyc8uvcr2Swwq/LLrc1ywewV+A4Ve2Bsan9Fynd72IKtBRmFN+fXxLl0//KPjr6z5wo9LFnlNVe/rm0re8oilhAAAAhKz+cdxl08UKyfFF2zKk6zt4qLsiGRGJlcH8Ox/Ks6kOO9FkLop1UaYpKUTStUKDTBe1CfjKPFADdLGayjLiytB//OExPgssxbJRHpNjPztVp5Qtcjc1qB2yOobUcDkt6i6h0gSJG6iTiZVyK03+KSjCqFEXBlAZQu5pdg+XM4gJmg/sA0KUETAYbFKMYy2i73DiYDLLIGLqUpgfiocE+jPTKGCoA9JJlxACA0GFUCgUyDlEEP7Rt//+W/kIhB+QnFDr+vo3+Q4U2Jhx1c8SO5ZhREBgAY0t2HDyqMuzg2ZlHKPGtbiMBwLBBLLsd1muIbZTIb1Q+qZHR2QDI+JNTry//OExPgx897J5npLsFmYgHSQSGCwvPDxSvTqCeczU9igxviBQwkn8LjSM2W0TJvXs4mX7c0LR/NUeiWZBfPOxtZE7TE6wo0EPIKyIUBE+/CyRABf/8YNFmpXvLClSlyR27PS2jWyyL2cb2nJ/tSmWN9Hs2o3kpSQQDIg4VYztqJPRnhKFrhvNq89R6zohKSzkvRKPFKtx2Y40i8Ppeg+GkWZKmq1tqZPE6GFWltLAfr5WsTeiQ8YNCk3etEjFM60//OExOMmQubapMMMuEopFTWiMiMdc0ygVXguGUSJ6lYJJb01zspmTQREWGzIbFaFGS8u9CKmzhM2IlM9OksdDRgwlAwQCt8cYFRnYQw3bz0ST9AvZGKsQShBtPNnayikJSxPzVY77WrP/i3fJn3/Q5Lf+HRql1cEcJ+DIYLVpAICT1rfwYclIcNnjrDLM/ZC/ue1XFfZjq9SyxDk0fbhARSIcKEqV66MWCnFWZKuVME5JCuSR0shWKIW5gLEkUmv//OExP0uk/bR5HpFeSvNBdsyrQxvWHGzIJicWGI9RHsIcuQ5OGdfGUZ7oOjeVsvYXQS5ihAhaFYfJWT/oWFDRrPS0IQCheQjJWcVOiqKYUOaknR2NvJgVFR5Rg+c7WL45lxD+soorcmsTZWNQaW8Nz/50feZ6r/x/1enqKrQAAgRATN1CqI3pvsUuCySLqR8qQXpFEyN2GRAKYvC8ZhtF3MhTrZbUsLu1GmwVVi8X1GFzOQeciWOYtFBhoL1SIqU//OExPUsa3rN4npFlFK1NnLGXi0qRjWEd2YN8UipzmOmPE7ZEHvFAKMyylCJSHiyWmF+RlXMSsQlCcQIxQhtGD8D/SVlLDZAUjvDBQuSK8epSt3lyIUEIjHC+E8f7ayy6LUMYpKdPI272n+r0OQz+qai4EQkfLBC2old5fX++TpAA3LLA5p9/PIno6SXZ+PE8StYCvOZSvSeLyhboKoJJY5Dnj4EfLYOJAB/CjZhDw8zkFRaFMwuRumMqELaFsfZ//OExPYtYybJREvSnGYTwjzaxxDIMo60sojzTDVAhjNenq4OmRwnMKyQ5gLc1Oj0d0XTKuBFMjmpdHJ2cwpCRbaqVLlJ0rjkvoJzQ6iRGIf6Sy22PPwi4mytQbEoJQ5nzVOQBJVl2VhLJxiV04DB9dN0SEAR6ArQ4AXvhbsrv3ssf+BV0n39z6IOZln4r/cwuDLbS0jSuf04znBijJCNwoZjnoFwTTIVnItVVRIALWiWIlVLbIuku0JEKow81sYM//OExPM3S+bEpHsNrGClxU0pEaC5ERLkaEKMEZkwNodoVGsFczhoqSiklCpCjJsREaNYgDhdcVxK6SBhSJGnBtz8S5i/tUrl0KDosmWj+TX9DWOxtRAkw7lU8d8/ZfNRkid8NlepcsiXpeq0DV5hzb/elJOPLHvPXEnLdGIPra9StFeWSbQ7Sx/QpAACLEoC4vdQp311p+wObOxsBvPo7BDcvK+gNrp4oVYaCtRIuKvS8VLD2V8JrZ4C6RrpbMBn//OExMgkesbd5EjNpI57zq5fwZcckHxAZEiFSLdsvRClXQsbGjp5ZC7UjiyrMv8WnXvKipaNSEVQ+Y7MEK+lIlRgENQWnWueMVPD7F0HcdYkI40eiIcYOCUkyuBNKKWc99mHWXEf/D7ovmNn6Uk6oBAVRqnJHyra2ljp4a464RCzdTRWkADEZjajJ+0S70Fw6HsJ9YTTSBQWUTI/tAXqtisUhJ1Q6FwkPM5EKZis2ypUzVSjHyLRCjYmlWvFqOYS//OExOkrMv7R4npNbBbBLk/DoWmFvnMmRUROSDR1MR4jYUj1Vm1GXT1dAVWbSO5TUCPstrqa5JfWU+jbNJ6jZQCGmHtR504rJZdltDmTaUdyFVQ8kkRxTovKKJJ/ol050lrg0f72ezLf1uvv/8Kbnhj+DV5EKsIriuvUK5AACcGFxzZWNz1fwhkFDEISxfwpbrWVNEeStjkxK9pNE4DaKU5kmnlGSMnxOYbt3d8XAxI7IwwWQ810wOamO5453VqZ//OExO8quxLNQmPS1Hl3apVoMgUiauCmJcijqHblxWGqSRQqMA08IpBJRM88t+sPbExw9PSZDtIkyXC1WJWPAKiwdyCCh0GYTik+QWKMSJIcnZJfLLQtdlmaT1DpKx0F9q2Ov+sz2IWDf9V/L/9aAjkJgxyMzCASj4QAAgtTxLA1KZtamduSenplzkZFiMUh/OtmB9qNlsMAh0NlJC3idCoI2PUhC5IcQoezAfiFLHRSaOwxlUh5xC3mQnFcojgJ//OExPcsA+LNRHmFlakhdPmlKo4tz5rMrCJ7JghBUqQTPNuQihrFV4oc6d6cNi/iubXsPSDRqhnxDClNC7JKSlSLLAYoJVwRiAqJk1pklOkLAhAuYfE6o1EgJmxDOxHuqluCJWSUBTF6SKR0yvBcs+kp9bP/cfc5xj/KGM5a7lR0zwULk///uhRbXbpsFKF1gAAN+4PIksKSCvv4DiyK4wVEGI+ZIDQpTJzhATpFSxOEAJBILAIhHRKGwMgquQ0K//OExPoyc9bB4npHlUUDOBQfFZYkNjQ7QjiGDI2uYGzp/z0lOZ8RrojiUtPYFNObvOop1/5SQQJWlrLLMAa0SZTG0ONLyCyyPIN/ZAVUx+6UHqf2m5QzyZh6mEVBi+QhbGahe9DTwSX1ET8KsbPgSDD83q8yYDaTrAcVgCm2dRw3kFSPGJrU6dkRpVjwEKVLyJDgNzK9PxPH45ni3k8QouC+gd5X2UxYB5GicZoHi2qdYQ8mz8dD9JiYxD4WT6WU//OExOMnUs7RRHpMvJI9Iq5vsYIEAIDTiiRc+BIiUZj6FQqnHKzpHrMc19VSdUZf15lpIJaw8Kt0KlDy8OYc8+Z3kMOYdO7J/EcPIBcgB04cI1XEMxSQMvUDx7SFYqttQfLDbSk/bqudlNqoGFs4zm5gjrBmVF9XQD//GOQ7ZDoYuzcQvIrsAA1emD8Yp7IYwxpZj9Z2VPpURVOw26Kej+AsPmuExsqGN7cWJDGU+XaaTkdRp1oUCVVStYDJUo+k//OExPgvW/bIonpFl4oxXOT5gCVkZttGULCQ0h5Z+vSZepM5uT/9f+jfosvf/879DuZ+PQgcR/opoa6SroxmtUNpc+1BWkYpFE2XU30Zl2kRqDCCHOpwVKKZFfdUTuEnMdpPfiBW5XaPzUln6KVCHrblVvZ+//sxwzPqraK2MlQ2RcAAJuiPXzJMfh/NCnUYO6SIYLaPEvbS8jOT5DmPDEsE5NEbwUFPBoluPRqemGrSAegJH0zKBkZ/aNQiYCQY//OExO0rc/bRRHpFebp2epUqsnD2MiW+daCojmD0JfsBiHKzgYbD76A31sdSZiPMR5//Y1SYV+YNLvQocmgAXUinRh2hJGkk1EYFY1Dyz8NAxomUzOHLDYCieu0+T6hKJT90mi++4q4sagAdmJQUfYj8gV39FFWrAJYW9WOcaO2C4k/FcJILeoHiEsgEk7Y1Q3HJAisquTylR6dZDnL4CKcz0b0WkzmHBOlAjAFoJgKJQAyUph0MSmGBktE4zKoG//OExPIqCvbJ5HsNKEkRqztBEo8iNq2NlJFUicUlBcP/jhkB0aIN/9ebH0lQFyMg5KeJ4/pjyMUMcwyqjMbB1pATpIssvhY8QPRh/eXPI2yxRIHxPogFyZREISvgQqBkRzXYUQw6Dchvfmpf3ak28Tz958hSjNdUmoRgAagIKV9TlWQACndvHmppH8NUR4qcSpzrgMdDHNzlVcjcr8vTsej9YCUGispkhycHYQQ6S7mISdXQkAzNC8eigRhcD3gm//OExPwvUvbFQnsTKLGsq4y+4KksZwFpM4XXmsC8xRQE9a/dCbje+UeOMww3b/ipeZxesLBppkoOPojwmOQJEpvS6Yqp2FM2ZMT4hLSssOT9PG6hEhgkAcM4+mxSOOigMDyxkSJy6XEsZpCAA4GBjqKGCM0RBOgNPUmQr2YhKvb3e3b22e8gIh6i3CtvV/4OCrCAADFpQlm6sLfDiu2KzniEdMZGM1MuO5dSQmBuQ984TKwyVMtNSZVqniwVFDR8//OExPEwbArNRHsFkcdbxWQ18v6jOViUqdYYTFEVyoZD/gNDIFCCKAWGD9cgP2C1GKPiyRJAokbWfu+B85ip3h2k937sgiJoMZHI8W6nFLcuUQXhIABRH3sJI0HCSIT5BRvnb3iVEA0ZVIU4xyHVu7/+qIzTP2+9f/8cEiPBK7GjqapIOlAABjc4HNDO1UKBahmTDw4RxiWrK0n5aOYUZydmZOLKEobCp4DYKDQqaNCsjPhoYBexsoAhkGhfChET//OExOIpo/LZ5HmFkC+Gwsi0n6HqOFB2YpwHDmAkcKJFLONkVoXZntKbEGj80kKKrkTPozMiGMMH7NF7QCphV3LHOwZFCh42pK5ehpgrZgzumXyPJKIEBw5LE0GdKHDmDYSRp15MHWIW/5lkG70qIibZ6u6qN5X/4dd1/+095AAI4YMvWwLjV2VRK2wuVAq+uRJRBISAtjWnSRcTTcqkowJwKngFhxPniRQE1ZNXgKRHw5GT6Ykld8wY9CO3xYtH//OExO4q6zbR4mJHPdJSGkMiorTOo2GzGjI2G0WEKbKczhOgLNFnprtNYdTiOLsnz7UDK+eytIRP9n/A+oSm1GedCosOgwOIIMUTcc4qy94On0pDpoYgmVtJuyglKIsr1S/6p8flnso80f6nkBHW/ZFoxBd7LObVcACq4Ud5Z81OEdsaU8iS2muhIujZGfrCHPLOB4F/PRLvB63A9zEZkybyrJsj3qicHM+hJidStRzuy3LtCFipgEpYJEa3ti6T//OExPUrEv7RRGJNjKpFU4Daaazy8VFjYTFXQMiiZw+nZCxykkRMgeK15OYrksWJSOqtmTRaibDGGjoU81H0Q3TAMHIKjHN9ZAsqSoSIhbYx5maYqmSkzyVv6y0Vve8iVgpn6ba+9TZ9/tn//3sPTvPiZ3CmzEOSj/ve1XAAlNA5xQTIDAUEQqQ9Jpg/SFvNvJES8VTZc50quC5oQiTuKcYsEnCWerg1zuj0N4vxuk90ilWe2DRM9nhHD2DwoE5j//OExPsto2bJQnpHlIyzRkmiQkIoFKwlLxF9ImTGdRdEmnrLSsmBUZxU+o88caRNljyaJaoihhBakKQmScgIxcoRoEyPScWFK5wx0bFMZ0kbYpYMncWJ/RmlWLt+as7t9tW/fikt53tNJIn5UNkWmQlOnRQiiW1mbEAsAjbQAAgJBcHTTZknsnEAnKjpotkUJ5PMURCeVzKoFA5PUIXcDJkHGepLR2qo9jdJ2ViVRamLzIjFVoxzCMdDbaQJYmc6//OExPcs+v7NQkvSfE5UmqFIq0Yco1RIw5M8QpEC+mxZmZcVl5LSI3WXFsT3oU2KPmtkgUj7JCPQvojYkKhjORn0bQ31YyGxvDhmZJGAUZkTYMSI6gF/AMmWtqUJ4Q9SSHGvitPTcltU7LuMWP1zellLnUzmJ/CbDA4+pBlxoFDSaqABmonlt7F/ZnSv6raC3nshEXtTxzKl3CwrVKpI6RX0Ub57xDoOljExhqJRtB1mcXFMpC6GoQebMey7XeUZ//OExPYt0wLJREvSnEstu4yRPJVNS4Qgvpxs8uqiEz/AUTRGlqIUIwMlEydE2ZMJj1q6RHUC1xz2bNkB1yqa6aWXhVay5o8+4FyEFERMDp5dAuYRDiRKs6qtHUqKl/M+k/hzBh4MKzsGZ3IDMOopVSDKN4RK+QVrePN0HpJYYU1/12QADMziNqxMKZ/BqVSYFFUNGxkiBCFBdcVMCAVQcAm4BEdxcnNIDUTyoLyeZIlYWxuXT1eUbkoniNdGfnNk//OExPEsuz7JQnpFkHOlHdYTpwPVDgwRWwSZdsv32/GSLCiIUkxQ/awbRospEgZmYMorl/1E2lytiSYgZMcgWgTEI2fe+JXeWiXWdhphbFKV1eTaJpjEiMzfUWxJae1BxJUJJY+D3TQ0TuqL7a3On7aw696nvPkPFjUGlTAAACnlOKGrFW+iRIzm3OBrtEBifplCU8d8BGaiVQlrOlsQhEvEY1HW5uJWkYO5EJ5ZZF2MoBihKRBssCB82CQqZDRA//OExPErExbJRGPTDDRQP4TCgggTyWepKU2D9kNKNnaSbaWOJq8C3GEJH1FG6MnPenIo5aQRRrOcwdSMNqpOikj2xW40XIxCQJgRFml7aLMSgXuLCj6UQMwL8OIcwIGIKDU4KcIjUdzM9SyYrbuqJ/Wx1GUHzhX1OE75wH9KgCglBGiYbGKO+c1MqkKOxCBXlFpaVW09dnVcWOuU4pT3P6MTg634mJjHGYA9ydmy1HgTcyT+rDbTwbKJ9fP9GaOC//OExPctK3rJ5HpFWEFaRICglRHA6ssMJn91HNYUwFC09FB5lxJZUbJQeZOG1B6KhPsxWwMhluS5ESlMF4xMhZ9ho8hC4E8WIBI28aCwFLmQ+FBucS5ABXTmAiA2cAdlRHVCQ96l4KIGI/oyIPw/i0tnSJtjAx/+iz8zAAUygILRujOdo6KXFf8zyXrZjsEuiXAAAAYNBsh5ZGSqlGzjjDbIGDCC30hQLKvQCNMW1OIJtiUTqgqNAGLihQNgElBQ//OExPUxe/LEonpFeTBsaNqQSVXFc0RglKAbmmKCBEHL3UrwmBjykIo9aknflkgZekdIvlagUnZyZHukiE8CyxoIsCsnAEn0dR4z/J3eDEVVnDGJhMD3Ja1cOdmt+jBI1yEK9Klb/fYbOy4bMH3azo3//G2OJx6TUMdWHzxVgC4k1MXbLsbjcV2y9MuFQWj1AbWcm1hLdHAocGvLrgZ/HaUGZkrp/i/zXBCAig0x/17Jcqor5XS3VR98ocGejB1s//OExOIn0/LR5kmFkaSU3TlJ2lU+cbYbBpxZwzCRCNHkkQrSYqRxQxDVp2k5TqOaGqjKfmiPlVPp3h7XamB5SkN5X512tXTtP9YrMwF/3WAfsA87QVuNEoe17yMCj5OGVOHgZZbG8myLNyGgDvQZoKvCROFBM8eBTnYf4/Dr3lugMBYDBSpjqpvbGTt+v27Sg3d/H1lmxAapsg5yiLhYmRhvU/UMMTAj/8aMoYW1ZmHscQFUHD9A7arEkAAhWEuV//OExPU7S/a8osPLXZujPAwhsPSvzM2VgQHF7RD40NcRHTuSOvNT2E/RBDX6Ic0JV+JHkBmbGJTbTipckEpnIUMGBSREFEimI4Td5DMhRpxR9lGgulrh0+ZcOyykfEfuXLkPz7iisbbjoodiakE9T3kEopBMk4USSyCwRf7pIJsmopMxWsFjxYiaMNda//GxzBLocizhG6Jepnb00DEP0EBazRXgKctju6sKrZwSlTwdFckOtjnAjZJaTaPUPHjU//OExLonWvbV5HmRdPOxOnjASgfhKEKVbJBPJcZR7Cj4TO5qZIJ5Fw1MpbJqKyvHGJS7jDfsqpb/3m5XskP2aJCTDkIS7EYW3RiDn/c68n2aS1EO6BZCQBSedBAAGGHcoocsLGGlUSSzuPEVwMDSNAmtW0ZnegMSxInBVRfR9/9RB2LxglLBdL6zsjTtlhmZFWsWWFHJggAnodJF3lTlTiZX7KrYMaRjTi6esiJmhs7JBXHc4Mr9jR6tGEPShB6K//OExM8o8ubMomPM9mfp5FqZUKlTnQKyKfnhiPhDgPvQ1whPFWqNrtSWRShTkTf/z4RwimikafrMYVelI3O6VzZQ7rZjiQ8YR8EwD4Qdy+ECCdgfLXBR/FEszrA6ayJi7oYaQskQz/umZvbKyldWHjuJMkkuAVOjIqeXboUQJijXPWqQEAzXJ8cT187Uy2qW4uSIWVIdJ2mgvPFAI9tla45z1lLGl1aikgyKtqYELNsnhGDMTqFC5l2azEoN5YbD//OExN4oQs7R5HsNRDlcj3T2jIfGxsnEjKej5+hWjd7XB8ogNWZRtOPZA3j9L1R8hcZgyKIuMCR71oWRIl+hH0aYqFBCNEk1bD+ixWbBjlwQPIZ6JzD1dh1SqBphIMouLsVkRVOHQKpa39nUTCt0z1f+VVer/7zvgkDtkV/6aP2/+dmAhgQsCUW4MWIihgdAriAQ9YACOjtDbaPKNlopn9bUMmoUNEYniCqXmTVfXmXpw3KBoIQ+D4ICkvA2QCOq//OExPAw5ArFRHpFeXhAVqFhZuxGmMkixo8L61a4jZoubXJFdr5SBG1DHCWf9azRpitnWp+eV7eS2yyiyX+2BR8lEpNQMAij4FaeXOeNLtDgEiYCIhTcgDBQEgqEEDi4j8lxTiheCZw3NQ4rDSf9qtzp9f//4MYwW0ch3cSOx3XojioRkACnYKMgP8QVWymQZSJX0qrlQj4sg6FPCzGbnyyeLcek0ZSLaPNwWhEtg8SbHLs0C8wDXlXRNqmnlYeH//OExN8otA7QpGGFyvJkChgKDQHAiDQgFm+QICo3MUSLYhn7QtkDjz6VM26qlvWOSwlXYpieMEx1q6LrIjxBabnLiTpoVi5xhHMlIY0iZ9mkSyxKdgc04Q0j6NkqZLsTLuSGQMoXwKghWDVAkKmD6PS/xhcS/xGoE3MLvqy9/+/Zf9bGX99JDqoKRCfkpsqruhlfsLY+rnjpQPTJNtTDRUil3dja0tETKFDxO1cyMadaYimQ051RlQJjLK2m86cI//OExO8tyxbJQnpHdeyJ9Uw0rCO1QsCAiQdrPScKIAhHTMbSXJryyy4h/+izkMSrf+5PHhDnwmEIZyTr0DcoWLWBB/k80p6AGmso5AmtM9oPTdZ/UpV4vOV7lxn7s09+Zf0XZSDVNFROUUVUGLHxf3iIMuDZdawk9Q+hFeAAlKtKyIfjvKvkJy4oU4odCVqZujl2kkMXCrw+O9kYTPdNDCYk56HAZRsMSmMJPnNDVx8JkQhOqVGnuq1WhhnqN0W8//OExOopWwrMAmPM8m8q0K57KNuOlJnQzHZZrmbjqboKhVrMjKLlyHO7TpZkk/tJQoT/wucIXeXHA9jkLBOGppCY3vNVEi525tDpN6KCWYp0vCbkI0KESaEwGfh1OOeBpN/3sthwm7Elm6STCUSQGYSSk3Us9WRwokW9Yf+k5lgqpvn3ylfUI9qLUVJa1lFVTEFNRTMuMTCUADADkyxJXGrPefJIbXUNRrkApHTCs4jWnh6WDSiqO9zA6iosFQQJ//OExPcxk1bJQnpNrYjMFWkiqSRo4CbRjtCM4IxZMmIhC07mRmLUki6cGDfamEIAtyChD6X9JJ4eyNR3c/ipBIyM4Nhyzgc9kcGWcFngQGIJgKBQprg+t3I8/p1TBsLOnw5PG5kSPFWIehjaPvWpaVhB2quABh/KneVl7qozO7IiuvcZLh3G8rEg+OEMUNAzOrICkRisRBwE8uAoLiwIhCLIfpywx5cthUQ2RHFi4aDMGqQKiUZByUBMjJoNh/C5//OExNsjwv7aBGJHLPIZUD4qjghJyNCQoFVHtyg16KDjyByauN4ji0ykiUb7SenIFCc8wUIRTrhERl8esSauOwI4B/qkeggfs+TkMBF5xELHD38OM66DxNx4IUYIEGDR7qJvov/QdJpxuYh//ye/qsbNOePOLcAADEyS7g9a2VvT7VFbnAu5mqNmTOVdez1CTplRaLMVyRTEfyuWjJLDMn2WMZDbOrjBXC22D0NzZBY0srTcZlKsMxuuSSU7mo36//OExP8tM97IpGJLrbXBgjni9c4zdBScPXYJyefTZKKVhqk0nGDFqwk+3okaBEds6TuRcbF8mJspc6gCmYjFy8TpMYwZhyVswsQPtWaokIefkhdDpHnKV4kqIOGCqgx4gxTGyCAcYRnf+a/2Uar/+Rnf9WUjjxpTs46JUyggA47Bt3DniM7hp21takQ0tpyqdNuDa/drt1CVRxJY/V9sNZQHUQ7RdTTRZOGwYRoJVUKoQNnXB1UK1Dk4vqs4kdpT//OExP0ue9rJRHpLrCUOhxUzKu8FEOvEvMikiPmRf7kZniWiVoVZSBA6AqL78++KsifSmnTxoc5V6ZV/pUiWFsEZCQB0SeaIUoEfEg8fWM8XmqNJwOkCxUwWxGouTZ3Da8IIF6TlvmVLTKanD0n/Df//Bi/xJTf4LMX+CAqAxIYDKCHMFGIcBQcHBmAQAqKNdUi0HuSg9lYow2RDoLQYCxw6RhwlCpww44sF2TTo9jPLoVB0KdbTreeRLVEpZHyl//OExPYwM/LIpHpFlXTxqsyNdFYfTc0KvdnJDhsgRP00Oo0ScKaJvyI4xl5UWV5f//lZtzZTb3YQiQionPEb3/SG4k8z6q50UYkFgoCoBMDbUUQy82TCENih5oUasXFArGlUKP9RohWghKFWiTP049LP/9z//93pMF3qC//1EIIHsnEVvIAAA4d1t2OsSbAIgSHGSQU78Rd2JTcATMB0UzE3AdeQWYnSPG/MqcVjrEM7TePzIWZzclYK5b/PtCE+//OExOgq6xrNRkvTDLana6m7M9eF4oLhD6hAB0KHgoUCMHh10RUfkjJMVFO9c4XYz1GGlFTkdW5b//84KpMReKB8UHfKUaLiV9jwDAAEAp2IjJrVweODQGggbF0PCjgEidCbIWN0RFJk691KanPka5QdWOyojQMHfclLz/9XP4MU3/rs/VP//94rjcRQ9eC+QnD8Jyj8oLAXIH1JJinqK5OquAJACrUabJETgln0dMHY5t7ExZL0rmendSVcdTL0//OExO80DBLF5sJVeEeRH0JzdJqK0qB6tBsjOF20IGEA4AoDkwnKSBEKEyQt12xcjwlmaZUgiTJ2VEMsfU/D/ZVnrZ+Gf/z9MNsJTdypOiV/Ro/+mRnERsZuDa+5evF4Anc5kQz+dfP+kEyVsc9XkekGigmwDhYDKIDhfxZB+rp0X8mrm6MXqx/k/nDgsZIYH400RqEmQo+WgWIRJ7QEWAEB4bsSuAY9NVY45AImIkBiKJpGwimBCpY8o9AJJErF//OExNErhBLR5npLPPExkYDxG5C2XHiQkUicUZNmGaNqZEtSJpC4p6uhVDhUw6SQ1Jwwnli3/qyo/1aIRyVxd7Jn6O/m1Hi3J1m2PIcQ8zliEYfBikVjlEU+35Mr9jfgloYxHaioZ+kvmeemQohDsX461/FqQkdy3DTF2/SqwAACHifmX59m4ZmqtvOAaCGpUuMqlWQmVcM92lbNFiYzBMJGk2RBrVOfDEh50qpvHwXxRKVPLIvSRdDjgcG5vRBe//OExNYk82beLEoHkOaOvyLg/U/HyTnGSgEPaLIm09Pd6BkrCLpSOEjbSw2Rf+b+H0CVNS4hBKpiAWTFb0GB4SlhSRs8H2T5MSDRdVgRiJi4A4RAi1obZaPf6fVNSoGZu//mQqE4rKJwL7y7F5DlJtno/9BKW9OdeeUkxn/q8f4T9/+n555Ekj7IkN3MAAA3xzjxoxyMl4t5VKwsbPpmU+WxTPYEFxoysSFzK6Kwqdsq1MiTSw3VYepfE6lU/BY1//OExPUwK4bF4sPSnGLSZXLk6VrLAUZweAzIokie5sGowY7ImsvMc3neAuju1qV/Onc/K3lmm30SoOJGSq0GNwiWK0vMW5g0rexhEpa0z8V+COknrACzTBOs8HGxgk44QaIFjGqi++NU1BE84NmpcM/3DxZJWQlAoAtSYAAAp+tL58dniF1BxSl8pFcpmcaY4BkXlBeWlQey6yuHYLZA2HQlnhOHclCKYB+aIhxE1sQBADlENZBNEBgtTZFIMHFy//OExOcoaxLR5HmLdARnnk54mbM2RH4QQ4etdA5lFS7UPvjpHDE98tK3cdJiG61geI/ShCzE8oOIEQhLWIg/pMCAlNGjvz60PhYYHYiBFE72GRZC+lXPD5U+RI1EBAdaeieplUygb/zKrT87z7xF5mj1dkqvoif/fyiJC6G6gy92DVXAACCwsrS0hL31qCZjGyhcshWKxCdLSg3QkgjGAfvHSKpKOcXQ6ltfqGKhh5G+d+XhqqBHl1lKY79MaKV8//OExPgui97JRmJLeBPlR9fZj/OSGhTic56J1TotEIefaMPk5kql7bYLHDLSc7MWRRciKf7X5zcxfnCZQZdI+k6SxfozDYZY06dUELo3Eje0fOrCjool6OqpkAqE1hZUiJBG+jRF2U49nvUf8evk3btM/rb1N9u47Hok8831sxL5VYQAAAIJidZvwY0Ksah+uIBaPUCNGzelhPXLFJZH4pr0+rD9pkshsDIiNIZ6NZMQConLIJmTAkH6BK6RwVeF//OExPAsYxbIpmPTEIHIBknGCkSACCV9IKRKjZYosgYR9D3KTOWuwxf86nNZxRdRmbLfi9/UZ1QsTESazVnkKsfhUu0K1W0R1i9Tcmf1lHM+QbRa0jQlg42g21pq+m4n8DyNhl6q0H6qEolRZYMCZ0i2/6hsP4gdIYgV4BAAqZKjWvxWXsx1SGBdcOUE9KnFs+Z46HEcl5ScFYcpjw7TMuLDwnugbhXGy8tOSdk65VIR6L0jCywKCSgkzAtjiR4W//OExPEq0uLN5nsSXERqJ8DBzGk4LYGBTF/0xtKLPSoDMcxE89AvRKyyXPIILF8kfonQNKCySHG0yagCNu3PGOKUOCQcNYY4sZ/WAxHnOpiDhYSDpvZRDqnkZB9WN07SFTXr//hxkCcaLCBpGnDg0QHxNXxCTEFNRaqgCzNXC5q7YjhOycv+enuFKBBRVfSd5YHodTM4YLg8mC0UAMHYQxjNtCWEdQbp1RBJ12zE8fhMiGDoBxqxuZ1Vt0pOUaQn//OExPgrO/rRRmGLdLt0Skjf7VNWmtTNrkO4dN6rtEhh/o2uRImDHKHdREXLsjzbe9Cmgb/mJFhvUkArIVzYw5sTmCUyufJoN3sNQG9Dxw+EA9DA6H3JzihaEYvu3Ix/RXxNvUhPyPnP7VJD9Co48EV0PimBAAISJ8o5KLMr2SiFxU6yLmM5IuO3tjkcrMzIJjP1LspOYDEwulEn1ewDQXAkGUOSx04iKROo1gYkq1LzadpbiVNyfZXsFBsiHkQR//OExPkrO9rQpGJLdDThoLGdKL6Hx6h1l/L4wPSKjDK8h3edUfLQqc7XqxU0cH2bkRlCeB+4LrhnRg3OL+vSMgW1MMqMDw2syhUHDY6RE0ckPiZDyIQnuuoaYMLIWpHH+lWfy68Z//5kPzEblMFT/Qi68zqip5fkhgT3FX8qdQAAZdsB/NaohK9SLLStIQs7zDOu8BWTtl2hrYYjO3Jw8lOn2y8zcpGwXdXToUXct4to6i/kYGMrD/aWhUniW6hq//OExP8vO9LJ4npFlKwXfKvXdXkfRCHj01s1ITqvOxOyU6TfRsE602RWhn+g1tHtzfvLdRpNBGxJB7RbMRSnpwuW0vmkS5ojWFBmc6OseVFmFaJV9rDJqS957RrFN2taWtPwb/6Px/SfUa1/I5/E36U/4ch8GdNc2evAx5hcCNQalqyACNCRp1zJ8YkV89iM9GjcUcUyVlewcLEM+H5g9HR05LQ4CcV1QnBymLC1cQhxL46gXhI54vPdBiVzM7MD//OExPUtw4LJ5HpHlKA1AfMskg+jP1DaI445MmtpzqWMIEZ5SbNI9vSJaR26ZtmiJSpLzTUeRF5kyTdWbOmY9nffRoTrl2IpE7aQnIDaBuyJDpM+lTkIPfajTjfxVETkr54wj1B6P7/cFYf/75dxeI/GJ7FRpv5ZZP9Xbv7ViAACGSQUuLxsjqmVVsxc1PBUjxKoOtVnhcVxitbqCUSQTVSQ7YPRrRgeKYWgcEQJx/ZACMiUB50f0J8BqGUBWJDg//OExPErixbJ4HsSnfDBLdFuMrCSZdox4EhOZM+XMT/qlDcukiSnM7ZCyyICh6RxRgxa4+hVJPQhKmpCjdYNEB5LVUL9gglIqNi6a8GdH2hxsn0PNrJ7ovyyI2p0LZa4eBlsngi/ns9udO////8JW2+LtSVPf8LpDxTD7ovFjIFVCyNiuZ52R+4o1fYS2MqlXN1s6Z2SBh67kORPSGUea5eHUdCnXxYy1UhkjXJ3NMgG9hH4IWKYBJO1JfKhkpLF//OExPUtUybJ4nsSnMzEAs4QHCUXoWVzRgtxLpZ/INf+VTqZSdplRzHAtjmeYXuYkxyrlTdkrl4SqFvhLLZOi84J7q2pu/+mcpwvPmSsoK0rTYsE1gcj5lATTCdPRIdy2QJPicde6ZF5Uju6zyZJLa6iVPpe+9Pm8zMy7AwEQBak1FYUav//WijEdW9mFMLkd+DUAAKIrRLjKI0QELCEsYQFuvCTVISWRUlctMkoUcgGwTwUBsQBHScBQNhoqINZ//OExPIw++bEAnsFXRUIm0ZCcVNCi1klZtG88oZ4zjZZO/nqO9/k/Vkppbzv9KUTeZKxpzptBp7fCOxwoGtPq/WcQUDY9EqTxCdSJH+wYVB/8GkSviMNHFyFKmoptjbZjGBiTeOCrVaFLqr7U/66NDzgKhXioP1tkqYZgCfaM2vUYqQ1WS5fOklbMpoCsZ2ncBUJdgdKc8nadOctTJRhfjigohjL29P5OFzAgCIm02p6O3lzK88TLQxVNikOGC/X//OExOEnA7rVRkmF5GpG1DlrTQuiMtajU9FjJiC7ZPD5DVmPRZCLffAgaYndpFiY3yBSRs2OtksY5i40PoCfoA5wUPcpIkdDan2mhXzqJCPFhUiJKbKmiQ0QgpryWUidE5LbWMdqcmlXs+DbKG18qH53UgbRVHyP5P/BG3CMTHRmsTZ3m4ACOJBNSqkOxTqVGI9UP1g+4N1O+hsbLCaGhXm4LafhNzgQgrnJOLoxBC1MEkFjOIm4F1SnsnXE6EQq//OExPgvQ5LEonpFlIZD1Xo5JoXKMhRnQYq4OdfJEn0OQ8/DvJgh65bE+kFWOxTqxWjZNKBGSMERlXUyHDsoWnrgTFK49AjDQegsIjpCS+EKQKAlMgHCSUDJc0Ts/RpkjEuAuRBQdWolPs2gjxUu5DKiRhofzl5wUMJ2PqTj/FASyPzm0s/vUpSf6s4gKJFIjPu/Uv/5WygwaIyEKXg1zwIYbpwAANMJlWR3MEZgfqOKS/UJQ9CZuJ2aFMiojscR//OExO40M+LApHpFsoMKgRbAQaqDQhB6CcBOAWHCJg+ExSFRPWl1OhqCuDQnh1yZk5LrJm4TziG9m4Tgo8s6aMwiPGkmYKp5kEJbUhSkVJFWGlSiCaeJKuJn2nKuTUkhTKPUCzD1VkTdDBNhMvjGm//kdokSJSLOkhV8+wyYhBF/aFL0r83pVvW3+cNT7Gmt6P1T3//7SpI8RmCcMmGIZHC5nmCgb6UiAAYTRKnZJKrWSSkJ/pyhycVm4G5MQSpA//OExNAtfALNRmJPlMoUfYbPttECcojZEuVBslRLn0KMyKIlUNoVVkFLrA2x7eBIIO8kcKOTKQqjqxd74WX9zrKrzhSKRklH/7z9KgJPlDtkyrogfbOv8/4t36OlEznxBTVB2dkC8NFB7RpIlJWZxvQFy5suNlb01KakcsSElCwUmrmK4AKxMJOPNevVyeVrxDEmuHigmVz5XrlzuwzI9kcSAnLCNJRMqLMYtY65MAdx/uR+tI519YWn9TdURorL//OExM0kGpbZ5npMnHk6TSGODZHUFKMXcEFAoKn201UiyFYzTbaVGVFdJWsYQ7JQU0gNlJtw9HNQCQnY5HEivPSyJWfDweKFmfmLjCgay7Ji3s+qIijjqYXTROP6RGKhxZRFCUUMFcOKjR692h0xWQrLBtkArVZPJoLPPi9FsEDZnXj9T0Rdq+K8U6SQ92p30ZLNTQ3Z0l0+YKqOpWqhzQp+ZYzVYskmMsz0qhKaWnlFQtv8nyXYoUkuk0+AkmaG//OExO8rKwLJQHpLkI6ACgzA9VC88aFQjkynIqZSF9fpxEJYvrr6WY+nBYifCoRY0aHuTISMcqJ4zC5zKGFTOg4LtAjADzooBcHBkaFIYDYPoAJ7jAfVNjeGzzQIco2qRYkuKNYNCpJtDpbKXJkMupKHVw5Np2FTgUo4CG5PUx8IY/uexyAPlWEgKhXFABADjWXKX3K5wrsVU7SHM5tsWFaWs1YDW7zAXC7Uc87x6wQFKzKmja1M7RGUzGjXJcqV//OExPUwE2LFQnpFeOq1sdPYSd53KCPDnVueVLQnaI70apbrxdZ3WsVWl6QbUe9KaJ5N0OpNF3XPVVv22ZCMUkTyEuS+iGIqOCkhQCZDyxOhZQ7h2BSld6JiEY1V1mecKVog6jxxNzBtFfysYahivmJa1U8tDt/+KVcHp59B1UxBTUUzLjEwMFVVVVVVVVXRJGAAUMdCCYxpWR+p3KIr4rOzq9457a8UV86uX4DhI/VrPmKjIVhCECgmkbNtaaTB//OExOcpU+7SBHpFkPRnRvkM0kEx7IlNURtI9+wabyLGwtD+i1OO9FTL/eebv6hLUKa29qkcX7X88jUv/m0icschrkVYZcEEMEIBRiFGd4Ui4DO7anMD0HdMh7/f17+cyKrrnVafZO/9RCW58YACEDcEN6rEABhrk+f5bHaiaWWVXGw1SpRLKax6Zc1I0ObI9MgvV9oY3Gsfp9CoNBCiUmyrUPZzqSalMUWYscBsOZTEJM5yUjShS5VaerOW2FZZ//OExOQly97WBnpFHGlpI16mOEZOmcQixM1vzC4XY2ihLNxWdLv+H1wQOqHw2EItmhw6UNmRTpyYjWlOS5KYjf1GzFslFByRcrwfyCE90i5NJGiKJmnMu3HS5LylM9v1FaX/+7+U7e/98dUGchCgnIKQUviOf6F8L8hLCHYKCVtglcyUwbpfGjWoFDH6GTtrCnU+eq5RLE7a0ZEyo7p2sznafateqC7xTTKhELlsHw0wO9Z0OVa2cz5Sp9SEwTiT//OExP8x7ArBRHpHlULPxrIiAuWJJNFBMojijbWXT++1kkmnqQ561uj1lG962JJmto54QRz3uaI4MPXkNkSr7mH3HiAhsWWI0CJdxmfQr2ysgxVymJNKFmTDnXO5Eriyhin5ZQahxQ3l//MPouqv5PW+B0uR2OuqEr5qSrWQAACHS0zb0r11Oym6kTyN9ZiI9pdySRaqFymYnFHQrTK9UqVxbVIcpSMZiTjO4/oDhgLjwpDwhpwrcK6QqvxEokRH//OExOopo0bJQHpRdI0YInV6sF3EZyW1SUfKj9KBtJVNVbWdSzVGJpO2dImdqfT58dQQef4scJTfiuVtGYDCBaCvGwTNKCQUDaMueiOGSHojjqgFEEBKmjjuMRXuYmr9C22d1SRfW9qFHE3+Fb+l2HsfqKV/7fmuUbD/WUuVhAAAIcCAMWWFCla6pWzpfeNLcqoCpkljxWt47VqsPpCbqBEJJVMqKZ0GukjAw2J6Ailymz0cUcgoinORCHgcI6MM//OExPYs01rJRnsTLJE4wA5lYufHkOwKCbo8tymQTQxqXdTTql+bVUo2SExWUWAbzZc39LKyeB9wH6b0vEcjtADIIsL5ZAkyob4mmvQ+NjpjgsCQJBLekCWEUw+/P6aRKnelPBS6meRNq0ez/8NVtEAj8rFCjKKUrVbg4RoxcAAAID4nHPvkfWT05WGB2JKosQEFe6WRzPsLuiYdazAcSTIFybVlCDtRT4naqRinXB/IxOO1C3HAaybb10qFAlOd//OExPUss47J5HpFeUfCdPaYtriklcd8R4rWDq9r1bs78QlTsI5kMFLDmLPchhhG861EjXFBVtxglKHmta5gkomKSKkKocZMyVFIrJyxY4faNOE3FKsRWNQaIixFHOYrUmzpOgulv5kW0fvWXOFLUv7Ju3n/88/bYms5/6d2oMowAACKZ01wnR3vYh7rtVqyqfYm9mZnJwsyHOpmxwZ0KXlLIc5VQT8galJOPWTsnY8V5CVyLgcCw6K5Qsy6UkB+//OExPUtKzLJ5GPS9KVYYDRyXxsfo9w/X7zKNDUzpTDNEqdE6cZJtpJwOGGM6JDi8DrtggRPJbkTu/YaUnZqxHOZZzk5yP2rMveFF5JKYdQNsjDZ1VODZbtmyypF1FNgq5mRI09HB/2SBmEMtV8c8/Zmxo7/8W4j/+dQwADoD4waHXIaakgAHbVQQ2JUa89LZgcULFUyKExZxhuKhdKVUdNjFpZQSOHQgDomNwYEMFD0si4XrG3IjioDUAUkMikA//OExPMt09bJRnpLlM8nEJkeLnUaEgdz5QoSpNvLwuKe+KSP+6/Sz1CW/wzY9DCKpmfm22TPOQQZqvESZbCQ+YJmTG6ZJ3E6IjoSTXkYOISqyM2kpNZ/4CHYYKOLEMj6o8eHiAraECuoqien///+Azgj+jpBt4N/BYIAARXPEZJFV0KApZy/nM3uDgsxX6HuKDYvRVpxVpyBRzLfBQ9TKA7iIbk4Zh1okE+b85OhOSIZDMBhbjORCQiCJi9QXFhq//OExO4pvArNRGJFWIy4WxJTzVeetvd7bzUNnoMmWD1iiEqzOq08rT6vim7Lbri9vpXsl8eBI4wOCWdtlY7BmI5PLdmIpSLCGdIZTQzA4KZ5JbuhvVQvfO0MjPS+8vR5JydozOOJa4850Gc3M/P1tSZvm2mZ3YwJiO3N///x7BAyAY4rDMBB2UmEfIpMQaAAAZRKaYhJ+1Fmq1MaPXnrwHbihdKVafkstGCkkmby8snIhPjJMjJC8TkRvGeJBKE5//OExPoxW/bExnsFXQidDEYM68tiRsa4tEhwHLqikPAkkzzdWvClcmq9mDk8h9YReEFErQpqGCYmNqoVVSFUqVVnyUlSNHz6ZCDMs54yYYR84pqOXtFLwWSpuNwTTg6s7nSn3J3ibnKQ1IO/+JBbEaeQHG5MQU1FgBAAsdDMp74iajNiuQ+RwlcmyGxskzJCyr2phlhnI2JEyFGd5lngqk6esAhKpY3r5jnmsjH9lwyO+jhUNIw2TAECaBUmxElc//OExOUmMurRRmDThKfQs2SEiJKXzX3araq1MPiruH0Vyj+kUz/1E4QRYejZ060oXJMOlCUNk5k2yjIMJ9MI47meWm3sGHJNwN8pMIB+bg7ldR3cKHxzFJqb6n9h0ICmsgueQq5HViHZnv+jZtToRsje74PALbeNHgN6OZ5FWaimPBDILOqTeb02SNBspfDebGI+yUthKTQu4RRhEQEbKXRYXOcOA1m8LsuB1JImXUBbFClhSXPYYKeLC1MykjWX//OExPsrxArN5HpFdC0iGkiU+jEqFGQFNJWbKuKSw4/UKl9kRWENfEIeYwSDO1jyKZM2GCWBVJFWLa7PxTHUhqdgMaNUSvKysZJshzaXCuOVmohy1lFRISnUfd4Vs7XpXTOTh2uekZh7LmHFfOmK94v/r//8wt01839v8ze25kCCn8PrYUJBwGzBYkUnqkxBTUWqqnkAgHgAqPxUhUvrOXxL0q10qMTp2hWdLcrmTlZdNCYF7TlwpmZ+qLBwWVHn//OExP8zE0bAonpfiMfKVydRXSkLiU6leURmxTOlpbNgiNylEx4Akm2NCK0GnV34fN1vT3RnMr0YR/S3kS0iqSQ5UC2xxgsO1qUeSfEhWCiJ9oF9RiwZL/OI7H3ov6J4fYVBK0CtNU3PbSc5lLQnCRV/1JpgBbePrM0ZWw4DglkUhiGK06VrDiyO9Xkc35okpQSmPSIpSSKE3k6r2lNm/gmK7VRgIF4rkennCUuAuJdmlhTTAT5cHLKRJpH8vqc8//OExN8kotbV5GGHjO55R2pbcVRCttcMCgPRFNGSZgTG5vUgQYaIiZjnPq5QJRtdEob0eIyBASXY8sGSrhZcgV4VClm6lAPjCI2vQaHRcSCVuIuUH2chQsxUMcvDl87cVSPXELtI95SN4x//t+zGdBxqNEa+DNE47EFijCE2ruyVOQAJchk+9iqiaTOKHlh06JCw9X2wSl/oXiEPJAgOyeVgTeR1EsmhOsg98uiWTDwOAuBcojw8SIzpCj1snGRo//OExP8v62LFQHpFsCx8kijZkiw5yAsth2iLVc/lyyukxMrJnP6PrzPKSNp7Z/ylSYiLImzx65sI9JkyXVGDhIHqP+qaPnmnHXHd2ZzV16OdcvamoQhTC2g2KYQCCIwZx0eVtqiNPRlZSJe3VlXe1Lt9ylAYiaf1VTAAAqiMcG2lFUgODLGUrpTPFcpVTRrfOcGqOS12M/VaZ5vTtpjmMaMRWjyVZyuByjmTBumldQEHaHIrVcu3mkWhWLJsfsEG//OExPIqk77NRGJFdeU4SqRhwHxGeDmaElcTVXbHMz88XS+kaWVcpSM7Uln5sket+nyzpL0wO+yPnFw9oOIM0RfWPFaMlluxVcJiMprVrQkl2aIbGlOcc0yd3RJiMi4wAwoCDgnBQ4QQIMMVyigoK/itS7kI3c53Wql9pPrKbyMlClmHoc5ZQAJAWJQBoISGJCTALi52AzfOYbI4HJqWxwQCqfpFhCAeEwUC09D03UloDhoP4wBgI13josm2FkY6//OExPowM9LF4nsLdcCkQERMp0R04iNeWIieEnsNo23dtgklFGSEBxAwOH+FdVQrv/kbE4zOiX/D8226RFFpW3/xAukKOZKqKEBw8yiQyFdHk7wwcYBQguJgQLDMkdIaULBSqiunFBsop36h/b0GzijjoupgsyEdm7OHYeLiw4CMLgQQggApEW8mfHxGYDgccsMLbaqlciWxLoY7OBSxnDUivNIehWLDTUT03V8vpczwR54OY1lQeWmlCk+rIJ6J//OExOwrwwLIpDMSXNaMWgokpoCdOmCtOt39eVVssJUL2ZhnGi93tFOraET17TKHHM3wkx4sqlesND1l95w2WLqEKIrxUqR5lXEJh8QbEmFCNdK5DWetKPn46KzKKy65jPYOJWHFd+O80kM0f+ZNPyqy8McwInObjzJlrpojdhJ37s8oVJuxCUL48SNiQw5dBVBTDKhjgsMqogDmtpEjr2XoxaHDxCRo03F5DtRa6fmAluImh58tCMfBSbXsXi4V//OExPAyHArF5HsFlCIkLyOZjQdoXQjWJFCYsTH52tcSVPcW5+9f5qMrQyGTxdEPvfcZ/4UHbWEvCH+wg2Mky3OXhaYhIq+NTCVMccYC6SGlpsc5KSCgB0mvSu5ou/xe4ecFtWqCwimeltsGo+4Y0g1iSVBVV29KC3XVjAIAMrk+eEBib043RoRzP0bIsOY2hlZBKtrlVYaLSqNZ8M2jEWmYhjwHBqbH8RfqhiMWBLQiyYFEilEmgZXRiEmDzxKS//OExNolCwbRQmGHkKIQyNl1AlPqUo1VVNtMmRxab6ul99Uf66e3ydVpp2JEzKRrKvxId6glFUn8LNFqvVxLAuiMOWQrcryBUw1EhIC7CIhJDXD5Is6E0yRtGhbi/X2t2c6GFRg6k2Nt3B8FgsGJEjYQIpBYC1s0O9uCGtUwAAuVWKniDInYQG8Jg2Tj2okMD5EeVJBhIJxlhM6zZdnA4LkuyaUTwr2JWsxbTeXRf3a4Os32Pl6Ta8zk/VTinGVv//OExPgtExbN5HsSmGBxHrEiJV8ySTBhGnBd287q2adUnCm2Ei7MGVOYjA5AmpKc06NQglvIe8of3Jk8eOQOraSkxRgnlnLyAc1h02PigkZIH/qim+pOsbSShOof/E0+7Nd++Cye94+OU4EnF6JqZ1JqYUva7AqEAK2oYGOpZnJ4rzqPFvSa+T1J9MtRf1Aola8OpRp1DDsaYJL1S3NBpkCO4vrEFpL2SEWUQ1hN1cltiQ1IrVsWVKHolPmYkpCy//OExPYrOxbJREvS8CggqUFWEHoKhRjyy781fX3+VJjp2t9CQpNDrsaq1/TGh6XjqeJcHHhG5tkyJP8UzKv2LJw4OlxGgEEBh3fzQpFofKUEo7vkRdZVm0nN538SUxGQTa9ank/sm7FMrLGhK9qt6Nv/r5v/9f7rHtGN9795YYYpdcNN4/97gFCJKUYW5V7BEakjEAmUFN9kSvFZg4eFyhJAjIQuHBsGwQAslbK5SA8HLIhEQYA2KJZJhPHsYFIu//OExPwww2bBQnsNdRoPRUJCG4+SSryG6Z41y+W7nBPWNr4NyXXqX6CCbMRTBDVI8shLi9ppPDREvQj1UrNWzBOmOUkSQsSkYXDiP5iOAmn9xsiSDBY9hECAk+XplN4rVdQkf0TkAtSreoNVPkDkC5RpRAgqPtGvbX/6Dh5jcHgQpAZM+o3PSk2AEVAg4hYIKkxkgQBl9JZyVVSRKnYmkZwgaQzgqu98m1kRxbZIxEjWPWRJrsFiYdJ7GHnxEyRI//OExOwvExrNQksTOMvR1LGHGV0akzPi4l2CpTh+wYF/G8UbjP+rDYOOGNRxgQoSSHN1JU/6amj9UL6/yaaQrlF0eqHXMNwxdyVnUyW0KUPn6Tea56npOk1pIXWl99sudi7UgMDySJcMyqH6mtKKdXvJlk2AALhSA5YXZzPHq8yqY7znViRq4tSocKJ9Tp1/KcZ3H4n0PNxGoUQM1DwZBcbxC+n00GgjC5ndMrzVGG8HwfEhTRTkUhczeORInQfC//OExOElKvbZ5EjTiNU0IQbJCcDZkDZkyFy5YaD8QgUfC0ELhsTc+kJZI4RXXFmvuvaPRTBkUEwj2UEw+TAu+rFBqXuOKCgPQBNoeFWDsVA+SngQFIXR5w+XFIoY/lho2I4ITA6tEUxJua/8BOmVzru//ATp4Ypo8EdutOkz/jejY4OGZW/yioAQk5FmJhQUIUBIcNBKmCI2n0RCRrTeDoZG0KRdGREwvFRBFY+k9ANgLCEwVwxMCmONxCUIbodF//OExP8xm6bBQnpFlYMyArDlTihccHCQ9Kh2i5CJTyhpXc2SPKTrpurU0MpSPGt1NqS3CuYKJpxzLmiL0cIxABuedwgDcnKae9sTnA8MbkB7rTRnsicQQ4In7/tMxbEj9S0rv7Fp/vy1xOyI4ugMrAQHoU4KrOIiAB2npZ9vdWyAjH0C6kUTY5KVma2F7M+VWlNtdqtQQ3sV8zHUfhSjWT5tkOVxf1QQdkPJbP8xhUF2J6okMTwbxwmMrmVgEAuM//OExOsqavbNQksNFAvLIhRIsOmEyNUjTLE1lVlUNXl20N5o49HzxmvX7eFBgdXIULDqKS1DiNaf2G9EmkspqVXRK2C6yrQ2B5OiziUq0VzaM+RlqFBX2crpa/DJ+Vt1z780Pt1RLCwrevkqK1/LJnfctMwtWrFlHCCOmwIXoA26zXhLQaqGdLlmatQAACMsFseDC7anNPZevorMj2+Llzdqyq5UcZ63yH/pgiRJKsU5iqdHqUylE4R1EsIhnOmG//OExPQvw4rEAHsHeKpfYaohLRJGgFVIUSInBIf+xdNtNDGbjaTmoWid0o3I/c4cdLL4EFHGExpRSXYwoKXDqLHlIf+i7Ixp57hw5RBfGf50uSLMOgSZ2jnFJUPRz8w8ozenicnnnU7EO51J/vM80SnmljochmIg+6Afp0KgAKtOcf6HnEW1xTszWaDKnJWBVMKeO6EuWlxdn8dyoL6xlAOswyiLenxc2U/WZRluGhDLkZLmi1c58pEwrJ1U5N6t//OExOgpKxLN5HpNaEnBKV0K9yUUjMpJUqDadTmKlNCfa8anKubPniWx7W5l2KWyTCh3mX+R+hqY46mFVpWQza84YMyS0SQnNuiVQlOXUnSQvrkrF38ownFbkqF0M7lR9hHFyUGHU4FAoUHhgdCZVKpWjRIxv8cd9HeURonrEnLoV4z4s2N3IdWAAAKuOl84tlk45PmFJOamfNzqr5ae7Vz1qesy84QmM2l0ZMU0SRGWh8c/VMXcWFDkMISW8eBb//OExPYvm5LBQnsLdcmCPLk9Q5nVyRZXxPjeaEQtWitSGpmBCfW6k1xGF9OrzefLnTgpV3wbwoklS6Wkrv3GU9PzXJiTMGDaFbDiTJMChr+K5V58mWIR52Er2j4hDFFVGLRCos0sX1MQo1Gd9AwegwTIMHjI8jMLxyloO/nmJo/HldvDumJRWDjUv0qCfEOZXyqdWoUsLoWw9SNMJ4kjV7UfjuDDcieOkQdbJDTr0x2g4yZnENgkRfxfCdHEKsRo//OExOota0bB4npLkNZtOBjVTnIi2/ciGLZlrwmCgQs4XBnYU8JDQulPy5VuR4mSo0rqeiyzenQyygAnlzgfEQzt9GrYgPqDy5EKusIT4gZDyNUmOIxQJ2UiBUaOxCyEmwyiBUhnnICyMk/lKnyPkDCj7dmoSAo6F5uZCslLz2EZHqh577W45fhJkqRAxTN/jofiSqAQGIqJTkmToiQjKtFCgZE5Zc+Fo7AIh9qlfGRr9egsKrTJYF2uGpPkkO08//OExOcuo5K8AHpFlN1Ip3J8oX7AyuEjJhmWHmm5OOUlsRpGRjwx1Y2fECKvxw7Jj+guDiiPgp9KcCFsfpVnlXymljSffRhrkXPdRq00bGMSeAAXyflA4wxWrGCzl/2pZbcwELDWQdifycMMLWMdjDTvrx/LTvOQfXX//7QPDhiv/i9AAmyEgpHUorKzxwPw6DwyJ7LI/DsOIhUW3Dsu1XkIXJSwoEIRLOgoOY5thhGmXQo12XVbX1EtkyRLG1Ia//OExN8oe0rNREvM9J6ObpNZVDFfRHi6WACMg24RuhaJUCSA1A5Bo4yQ4jScKg0seE2H5a1unpqIkuakVykAumFm12+gE0RxQZgGSgDBoZKCcjFJfZFJA4RO6YHRbMXaOaAavZDwvlosRza8iwrnFL3rLnoJFczpJPjDunkUv7z/32QWYJRQ3+eELIfrPgHxZeIAHAeHTulhSsKwcqQlZPh9IFBwUxK6PJ6woXLmiSYDghiOWsHCInFcfjktrQzO//OExPAwI07ApGPTKBYFAlsMKCwHAUnRkqXw4eGCGZGjC4iRpLob3IJpwRTbk9Immcms0hkZT9oWm5se73P+t9MH7nMhYOwQEjix+ps4xltrRDR3riFpA34fJ2KqJJLZ2koEmOQYMzjqJFjQQI46C6JX5VyUOSdmm+Wv/rthhMG/sOuplj+h9AUxGGFlO1uMmKf6knSaqYkY6dpOsF1VZXCKNliVe1SWOzEZZeobpWE1QxWlUbMFC3abVKdQZ5GO//OExOIqM+7IxGJFkI0xUW0OS7ixIGlPKZzLYyhEyqvXgiikKiJ0Vpm0PXglH0o2tSb+66y2lE87JHZ4vfnB7dCtiTOLmC4fICoNZaaciX0Ok7g2IuuGDxXRwlDbeRoSvcjCmNHCRtp7eKINTpHNQk7shGCdYvNfPLEx0csKDZP8wYfyblHUP6qNGpXmAA9F0UV1y8pR6r1wxSMcCKzqfCvfsDre4EqtYWyK5J5qRqCbUW9KVOsDEu1HhWzsRO1a//OExOwt02bFQHpHlP1pCJ06xvjLOo+HFjXLWxKpWKqW2369ef/VnNJmDmKe5e12v6USLZ4a1m2idUt5RrUJEfFIo7xLxtYcRv5RkVkweI6UbQsljK4nBhcVnSdAgRzMEJrpiiJOoj0ME8DH1v219cjKLRnaacMm5ixbzBe3QvxzMLiHUJimrWUcoxN5FWlYANRiuFxqFatNzAeT4prEzA4tPJKQNWWWML0WF69blgzTMm5mO+mY7GsQUnQfoTDZ//OExOctI4rNRHpFlOWJiaMSddMDpIrQ/MCgNKLwydF6ogzXW+tMC0/0EMwu1J33RdrLRtWb+3tP8+CV8emSpJueOLhBYW6Rug4M+HFdMDwlgT3r462RQqgOYpj7bfGhqfiZqC1WCjQMoowgke7US5HDsVlFDBT8OrEkE+qFs0aJ5ZXJyRDobpmBxVhlMj9ToxRrZKV2uGBPniwIg5T8HGWRguQXApYfAxoguy2i0Ub4/UwWZwl2kPOCNpQMJ0MZ//OExOUmYxbVZGGHkMyOP1QqYMJSmUcTOcLI+SydOoQGm/yaqxQoK2BzsJygT8CCZOThXLBTWCUXCuh0OpgWFlJchVZOC4PKAlMmmCFEyTD95GDcplomlbzTCuYoik7xhGeHdCNVQfmQskqpVS5WhHqaOZlhVdOrmGLLfOWmZmVBH8z/cT0M8H/+mjis7LUKTEFNRarAALRnEF0tm9WrN8dEJhu6S665rNUZj7pWskZIKwLy0hvPPKqCM2lrGmKq//OExP4zW768AnsFsPUIy+8NBZbP8NmYE20OIYCIJJmECd4lRzEoKZTjkxXK59ciQZLnHb/OR1VbI/sacbaj1DxCHYYTotbFETiZI7mk6DcFTSUaWIqK5d7U2UphYt+p+Q5BEO3/9z8jfK3qf/k92xb57lqBb7uRV0Y3AGTxxVpjkOsxGXTlmExdzHUfx2Is0yWUig8RkuINCzFXsvWgz5h6QzO0jkdFyvQXvUtoEzVikx4WiW6kRa/ACvy8BmkE//OExN4kc77QpmGFkBlUMIpySjmPOET1+fzwxEAbTCgEPCxNOTSOZS/Oi6L6mXB4VazXb8F+dbcHrgqIn/hPdfcGKSoT12uhaXbZYaItwZCfJsYgR9OKsXpI04KtdDoOSGdYcBHRSTI8cgnuzDJeO4kkQhyYJSi1XhrJNpcnWzJA7TmN1C1Rky2E51w8pZXudlnoi/////+RKGQqJYsyZb/5Uaf6CT4u469gKAAA4bFQ5ZOTZw8U88JCxGhjkYjw//OExP86O76wAMPPeDgOYdMojw+uZlY7MOJAim7BNPhrHQinYNwDHZaWoigeiEmMFpaZbQRUiRGeWmhkuHzjOoaQEFNpzR3cVWH0zGoq3OXj7Z5Sy3ue//+DGHqRIjp/E0pkTjyYEIDIfYFRUVnS/Jy5KaDJY4SzYFBSiQ+quP+M02SLgMBwQIi6jRowcEml2//zCIFDS1KKWkJ8jDujHFBh4uaB8ReJ1YAGAA6Yjwpo+tqRD8S7pnVxYa5Y8sQR//OExMksU4rNhmJLdPPI8T6cvCk6ccPTLRi2lFp0XV8dE6cYx9KLasZEJNOIxNrt/dpRKNVlzkthbduUwRlaiyUa1zWxX/80e/+KdQ51+kXwpTD4Q/gcICmddpYFAvAKxNCkEijJERndGzw4sg1PD7RoMh5qENFIWRKIsFR6KK6zprNMLpJm5zVf5w62f/2/0y3/2rFVY5iS67bl2bXICW2an3NVFVrns/VMHUaKe//+s6aJmAAAYwlCMRUM7LRU//OExMovc+LJ5mPTDFmpjhXgH4oHjnNDez1mh0eq5uYojCr1TS79vPQ+zuhpwykPTs2SopoukRCkuyoQQwU8yKUZLqJZCgpHSkI9e3xxbEHhqiBOcDnV6KOtrOnBspNiDE8j/htZwr/GjdSJDLJAqL+h2JG5RFcG+nkkL3/trSVOFUCjDfADY5RhQUSR53z92U9Nv0hIeKFYGFVINv68VgPv0iAAnvjq6IZYPDhWfl16M7dOYaHfF6y4ppnkROLg//OExL8oezLR5HpHWIzZ7QIxOJw/Nqi0JRwEwUksgDmEgjJSYioGCpxcUxIOhDySk9/RsnTTC+01SJMqxCb6jWM4Qqpunp5dlT/+CFPpmDgbMZ/pyA3vUQmsohps8RGO2zMUvLpzREnG4+SpF7YNGxo/RwaZJExwgsOCiaBhIMGX6qdsGYkAkoILOn1rCd+sSpM1CmkRAgACNFcPgbUEB8knFx7MGT9cqhYVwnFnTxDlqNjEcnFTpeHZJKxIJJDN//OExNApQwLNQmJFWglaWSmcKNTuEwpuHhLWNLDeFdZQmZgdEmWXXpOJXJqGx2tJ53xdzpE/J/W6faOhGk+UkxtBy8pFuWY85MonGQRQRAqk84z9m5Z1Mly8W/TKVjsMDBglQVUynxlDJqPaDlQlaLJ7E2//fjCYg7R1YzwTwbqTwCYjyerEB8pR0VHpT9eWza3ujmnYDhIJGskAnieFRbKCgQR44ay+HoKBGBuEw4hnomHolhWPFgiJ4+nBgTBO//OExN4nu9rR5mGFkCnATQbD2nTkqGLDrFbSKsIMZghd2WguXSO9VdPuqnyr2fQYcRHp6bSIKTkvKVDogQoGBgv7P/plZqLTplRschU21goF+SwksFw/FwaltIUDEUPxCjRZ7jhJX9r7nvev/yaWUcbIjbhO6H16R7ZBsyrQcSpAIAhCSmK27LrJildLaJNCTCX0kwJViaNa6hnBHDAxNQMlwFDZQJB+wSxeZEMwA8cLymgxOMmVA0GtREsGZcLT//OExPIsWzbEomJFlEqeyGi2jzMENnjJTpN1e7MUN3E08u+x9/IoI5aSywjZdmdbWL6ycWcNcVKXiSWR+6TgvxIkxJJhiqBGO5usKkZOmrS85UIUed9t1CPZ5bMChgYMUDtxZj6qvZQXMjWkZ6KyGt6/X/Pji6WOt0KG1QrU5EcukcscCAeiSYGGrC4bFdVG2osQLFcaj1UNzxOmE94MycYpkIfQbGJ2rdNxaZGZ4NwbGRIE89H7CS3U8b8wRfTB//OExPMri7bJRGMFPCpUWgjgtAy5Lk50HzBakR1pdksTYQsIpmFfq5NGacEWwbmwSGxp5zfFZjqCBARkJ0RU2fPyRB8nTRvPlypUbLjAKGF027PhcHJllBAQNG11R9ZTaTzCPLNncd5lyK3BhzouYLxTUyZh0+qKCM3Q5GlCcMWjykKYWjkzdMPq0BxutbpGXRmJQ9vpgblpAMBBfTBcHWCAEouOlLlI0KElLezK46HhrQlJOvvnaEM5zp2DHbVQ//OExPctAxLEAmJNkNjQ2mWkXh/pPLgnMLana1ioXLhMeQHJ2OZBBCGH1lYx/XfKzvKFU1SXZItj/tUhTocQoDkNHBAaVN70BYEbMWnMiTaOki4ZB1js6G5/txQ5vqUp2cpAtH80KVsJDB1hBl/x8pb6Vle+/J39t8VzyctcKG4i6AlSBGysgZXiPCgTAFDIWDwaMiM8NFk4meBImA5gmGCdxRyIhlHHeubezKE+1C2ORvQZLq2TCkZEraauxEJT//OExPYuA2bEAGPTLMUj6yZVY61FtIi8VRMCV49NRZbEMLxZJn7s/b4nlSnqbaNY99UyfKQXXMisnmSdvkLaAmM75F2VTpEoOuPliE0jKJKmiE9ikLfNFFhzM97CVW2hRKoJIWiq7NXlu97FpVidpT6cP1l+996vv/+pTEFNsAAJIHA+niA5C27BrQ4vqmXzAQVP2KtUxkbHJYHUWqi26yIY8JQiHcFRPjPmSUOxHUFIkOE08XmI6FqXPMapz5Dd//OExPEq82rIAkvTBlK4lK7nyRSufwzMdYNMQFaZpIznuc1521PUdK31Ke2nh1O00UUS+kv4WbksmZNsrSSae3c8fBEKm9pjokulBiOvRwYVWWmGUgkPOBmBI0dRZAVwI2JQjeuzuqP/7eb791QXrrtxJU1ANFIxN6fP5ryuXE/lGeb5YLm6WUQqXxmrDpPK0nzA8HAhBLqm0YZjGioi+qY2SnLsdZLhvnEb08jXm66UJNCxjc/PaJFZXO4zEwJE//OExPUqQ7LFRGJFrFIng+QyU5CpBDBrELTSZCV2y13iFOabkz5ytqeihlxcio5fL5HYBRu58/gbon4YpmEhUXWe1Fjox0auBktqJKj54okmicUVk9F7SRvS5OqvLEva8/ziRv+CkWL/x9xmPvAiWvOfOY0e/89qTEGpACAAVDzSw4V1kY7Lj8fj1DEpedWOlxa6J5HRpTdCG7I8B4emZLBoPEZLPFI7g46Km1xurJjRePV2leSwmSKFBgliRLUA//OExP8tmwLAonsTYYzVkmIJFEVeDk8712X0pJznZL+t8vi/6rLdkur4oeimih8SNFr6AQDq04imoJCSix6weA6JKrS0lT5gTzVmJodE/Hci8K//fWgts//6lZo5RD6MXdvE9F/HiSDhEa6MDDH0EkO/4yphAAzKqjHqhW8tJixzoeJKE3t0tDHdEwdMbGqmV8/X0iicIGA5Lxbxzrgvx4pxmUrSuV0izlOtLQybncXI9EC3qNSGmq0IPlIKRxag//OExPkrFArOBmGLlCiQeJxBR4nczA4jgHBhs6ojMMCrPXcOeo/2MzE1KElC9yS4kqOIieGRjRGVFzoYbcfD5daYpkIbTIyGj4kCxAqVkMSHScHTAIgI1xox7cYSS7RmyaGeZB4Pt6qSkv/1sdoCEEFB1UU+FDOF/Uf1//zBiAgUw6sx/AVCmPVSkACIaZT8BwhrmgeA+FD49jq2h0M41aIpFh0dW0wULSeSWiuPpIHU6LAIIJcOiqWVhgnLo1oZ//OExP8x2/LBRHpHlIAiF6sSFp8cj8Vi+w0sPzTRyo8/MTOHZ/BGXoAbZ165PTWgKvkOedjSUb3k5TUYpPxClkljCaPooieUErIZhhgox1quwoCAiDhRSRSzCGMbcQS6UJW6ynOwrXeToWZ/mFf3v/SlEVG63/9HV/xwRXRgiqqwsHAa9CrEAkU+hMDM3w2xwhscVXxVat5laFWknFlUb185sinanJlb1WmDgVp9vkSonZhnEXRIplDjYGErjYPN//OExOory9rNRmGFsJ9tzIjB0ExSdoIoiUhPrUcPkNHo4hYujiJpn3KR3UbKHMclUKLJJdJGiQ7zUpuY6+IGZntnE40R2qmyMYehrDZs20UxrV9c9u+RuIZRPJtNZ3mMBCQYABCFXGFSHGUkMcfZ+fZWlslft//4PKUsQKZzat/oNBrAAAxYXNQyRXqRjphJkbMo/VArV3h1KXJQzws6MAwWFoLJC0MUBlF3fl4dporQQBERBqHw7TDwOxgQRxMl//OExO0r5ArIpHpFd6Ti2oLiMKkjD1F6aM5RSJm2DTosJO5otFZJf4hgwwhVVZiK02ycLl5nGVEayp+K0plwSiqYDozpMQIxoPHxW8uVHwwNnxyLbBSsQf3exO6fJNWFM/PIxp7ORLkyNtI5BJ1I0EUfTZ//php8SiPJSIfWt+c8uD75urnKC5x3KArW9Rwkij1GWFWtp3rpPXfmkjlwrUwME9BcC+L4siLYkASyZTJceg0CwAQhbCpN1OKpDS+O//OExPAtowbBRHsTKMV9DSjH8ZyOq2HI+QiUPB7cJ2hzuOb54LqrioZctfZhXrdcE7Ms1Xi+oUQqy/KMuJTFRZMWSpNJ0e1iNH+CSOb54Ux1LZGaRcIpTSMRA0KiIL7jXGgNCgSC74+BWQDhr8NfKS8002v0zM3jQ+nmNPF/FxI8w0mzJvect8zMuG6itGGFSp2DH0OQ/8CGEYrQ+HsQ1UAHbWBVywpG6G4OKOxMxq5mP7LEulxGbk2lYaHkzMtL//OExOwyy6q4AnsFeiofFfETKePwv5wK5CkGzHeoEGrZ46makKQaLLlKyWYPiYHIEZUTjDbShGhONJMrty9qsvRKLzqCmcqRnYyIlXwmnZubNJI4LnmWfU45H5qJdZWyxGM42uRqlzy/6Jsm91FyNPy6z3XaC//ohqFu9H53fpWmP1gce9ApdTN7G5I8G8h4ytVMQU1FMpIACjxSbUqHw+HYB2VKtTy1D53ltF9F79DMklZUdIbtS4KlJSukHg0G//OExNMpEvrEpHpHdMQD59QVjklHbRwW0p8pBhpEkUmum5MopH2Qnm79porAlBGl8lMF5GHQ8mpwKQYxZj9dBAgSIMv3cOuJIGQct47E3LmMlMsSOLNrY8OB4DIe3aBORHvcTrMHFgPch1B9pWETWH4hiipwAKrKIVkdTo9GF4GSX4msp6Ik3Ws4mU41KtHSsm+fx5o1WmST4I+eLCJ2MAkZ7DUqTtcFC5hJIk5OlMiF2hrUZ5fCXGXBVALNVnSl//OExN0kCorR5mGHZLm6XMxTz6aTB4HOq0od6ukKbpE7EwX0WtUF/J8bJ+J0vKDPQs7KUuaU8NPqwyz++GyBU8EgfBRwUYf2DqOVeKBdKU8ENTDwlhfkIQ9PJMykAkHKHkx0nl4W5CjQDnkOVClgzUgehuoh6j0YaZyQVK+iYDgQxUTeQzQ2cMlCEZD4coRoZnGatjV6rimZlt+GI+Q5quXJtvl3Zmh7Q6h/UdIjmJ06dbioXBQJpOWTASTRGdRC//OExP9EPBq4pnvZPELTMsPjgJ5iPxYEskF0qEMyR+gACO2067nRKJpPKShdaKB+kK9dCfrUMwTlUgk/yFcwZvAeiW6dmh0vD9afoTx4cA8Lger1FUBI2o/DhHRAILTfKVe5M3rbDLCr7STSxDUE6Uz3Kk9ubbtbpJWBw65RAw9RVl6aJZ9PIyMoQNTmUm4/NHZInVyMIWHZzAlnTCGT2+WaCP0j9psoCJNeWehlJHuIuJ87F6G75jpVgYDHQ6sk//OExKEmkuLRRGJHWFS+EzjdThkbnfOaaQHnmKzhAEFbBpLEg0OTJ0lmZUEABYVnAnqxAbTqye1Qwk3KR4uHXlhERY8PUS45yA0LWqjs7uXTGtmD1UUyCytiaKa5z+Y6a9TPRqq8lflPFEmpLZ6eV6U4jjOitCK6XmkxLT48piGSnZEJPw2zEuTfiNEhC7Hk2ypvKMSTdyiUYfnXTu/TJd+fhswRD3uUfY7zpPDKqIJABgQHbFGjvl5glddUs9zi//OExLkpqurNQmMTHNaW2WoLh8dDPj4mmJ61TDk9bPXRIXrR9I7ZxQtk0+LB/G6uRvN4ncdRzK6DD71y2Le/vnRlA13O+PZEfiS+DJCMTg5bP2nOBH3D6HBtzMGMATcznwx1fowmgaUXJ89XxF4dAxoPiMqAAO2VfnVCixu6sWltZDiQkAUPoN1AAl9G3VZNmMwaWD9CToTM52EsqT5QVyehj4WAnOxcOzZOEgTwyFIMBqLZ92kMhAk6JimTYPS6//OExMUjapLZ5mDNpCY62xlgViHl6VCoLcqGU012bIBEQMHEiYqIYuKNZ3oi6bdJquyTjenC/lzl6dNkYrJ2cUTQHoFGm0IqPSPjah9IgVaKFxQnI1ngQCiP/NG24LmT5dUigaZSZTN2ifBBXu4JYkhg6NoyCTmxSSQJicDl/uKGsOQRvdpEipAACLMkmI6mIWhKLDQGFWDVMgegMis4RJ2DDEQfJtqZdFuFiPZvHvAOrEVYPQwj8mgmOqdkvLM3//OExOosWuLIpGPTDNiN612M84jI8Jqdpjt7cXJGW4J82Ughdq+wZ1bUDElUMMacXptJj82fOMoGS505APz69IpFies5pF5oV+s/WmIO5KYaVkVsvJuRMfekZ7fSaXKUiRG04RRNvk/PToLP1zltrrPnUmtQW11HvdWGsitVlAAN/HV756wuMZRNcFxWHkkBV0iamaJFYxnGdJc20YiHrK6UTQgVZFKprNFUE+ORDjXS0WMayLbkWrYuD/ISXAuS//OExOsqKurJREvS8HWtKMyFEpRjS9dqbKEQIsisepaRS3JuSm9/t2J66NM9a8RQZWbigbyHinv98jJWyEP5ASYIRoo8s3NK3NLFlUS0NQEFncTbRJpEy1ot6FeatJvntxpLdXUrau/6jUX2y+JL/r//+DVHttIf6jKAAA1Ai0tAgtmHE70OiUoqk81sx/biIBjT86JMlPk9OEkopaiXZHiGn4mVEGqRRIkoUJD7GQpFWh5vISeU5e3FnJJhoVvg//OExPUrq+7FRHpFlCRBEQ6K11o7NQ7xhfeyXmIppC7W3qm3GHvQq3O/mBBaQieoExfd04YEivK5wSi4OJcYaQaarLbBcJxsHB4WyOgBwXIBwiEktwHC9XqEXUIqqClSFzPm/rP9Ifq2VlUUr8h78WUayZyZz5s8k5JvV+i//44JqHoJmBvVRgAAiGYrTXmkjKLxRIxO9CXbYHh4jAk7awEk1I9MLxhvUAj1KvwTeCaVqYNE9jpZzcVpgrRvOJup//OExPkvy9a9RHsFePyTxzCqA0oBJGLkLy4qSQM0rxSByxHSK9Xcpi7MZsYgdC1dmJKRv9lpLpX+r4s/kB/+pSovslAyCoDCpwaA0kGQZAQGnAwCxfACkiIu1LhqUdhAbMGf+pJWap081cnfp3El2iucn/SGT5m2NlcBenI4LExyAACRkwRhrAgDzLRyYAbFK5pWx0v4j5Ntye5QHqcqyfCEqFqMNGKZNniezOry3OoTetMKRcIKbimuf7OOhTE5//OExOwquvrBRkvS7OUidbRLwiH0J6iRglxtk/vQuXOX0bfZ1EcjhwuipVEwaclGsiq+bCAid4JS/9KYKW6FjhgmE/Awk0gRnLEzB4yGvMTMv9CkeYZDUBSTX+KmZKIUXaLwvPvWSd/86D0hMw4QhKf9/poA7SKKjcultnVybXCfVisZE2aKqHIYj9oMw5zSJ8XR+8LavMzaeKfGKkFooVPQUoelZHsaZ7MbpQmQXY8Ji6rSuDQKCEcGGEgcAQ+G//OExPMpovbFRmPSmoVpEZLFGhgiI3vUIE5Eeq4UXo4J2WC5CxiaofMXUu+5Wu8KqsB5Q8gQOBEoJAqgOyo0xRMPlgfMihHQYCDiJKjkSURjxKYVO7J8jzRTNYKJVA686VPQWFCSN67s6+az319/7HvcznF9r72cXGs76oAAI+cGNRwWqPpFkxOknZ9PnkBdbfOC3FU6ITycJSvGiLm8NRJHWTsiS7MguJziZLovykJwczAxGGWIyjITCLY25aS5//OExP8uk3K4BHpFeKcFudEjaGVQsZTHMjEmrzIUbOeZyEsioei35pow5Loei6RH6uRE/ZEZhLHT513SMrCsQWa6ZAKikDckigIkQfFUW9MhTShwMCUmIE3j5KyGUSALnkjI6Sh4Ng+usBAMFH2n+cVwnXKH1AwiVfAy0mpz5Jfjf9Mv/sPTMIVE0d0zuKet5542IMw0H0DgouqUQJpDG5RaraXt3Xtoa4XvpUFMwU8QkjZkej+wtgKhGHkx46PD//OExPc0U7q8pnpLzBolOR7PAyPXFBJRmQnH6RCMxIAxFhlVaMSVYTAOBl4VMpjDQXEooIkIqBpUBYHFFz5MQgSilfRHkVRQu6yS//+X/c4p/Fwx+Q6MMLj+YXLMYXecVlH75tu04NqRVFZNayeqQ4sGDNR1ElAwGscsAEJTUHyfgnkf5O/3h38wx5Zyka6HE/RVrITgABAA0NWuMlz0azlhkTxLXK7LUE5QhNzgweJQQF0BGlOnjvBJAIYEpolO//OExNgqi3LNQmJHdANoRCKjpsMnmD6zRCQCZctdN2maHsEKMmjMTSLhVlmHtmqPhPW5ZSqUb+z0UV71HVtvNpcGwze+NVq+ZDonrS//7iBLJsFTP1RIdpJN0W/tKjYqfVlMMEoLHp+nLPJmCz6/8MBOJw9LlNcoXjshtUU5Ui2rTw32E3EJY40AvEKBKlYqnST5Qk6JybaQHxARRAFWZORrNhTnwSsox2BxjjPpI0IWtGKXC6qFKHReLuJwN2iw//OExOAl+trWBmJMuH6CTC4d2DgyiTNQcfkTtEMQSaY4wjX8VeKj+H3a+Urr5nEJkyiQPPL/8j01VW8gnvxQE4u8UDktUNEhYHJErlJQ8P7yb4ldIhLE8MiQxHQpnw40PbXP0hc8neilAqhk9D9PpIOZhXx4omYvmZK5wbxZVIDRv3eFyF/cQUJFWjiWxlEF3WgADOljCs1gyGxZkeHkTYlg4jJhy6jXD+QTBIYPIymOBJjFp+MxsPINzwhCYgD+//OExPsy+6K8AHsFeK0hlGFQnmS562vXHCH10Ml7D5dR6BhpJkdJMmF0SHR+0UxL6gaiktRnX1bJK6UU1xyg2oo0Uw/L0pJyf5J0Uyl9K++6SrOsCc1iJhLMjDsbokCilNk99LRcY8WfVxk78jo+HlHgrcUESSCSI5CgAA2BVPHc0HDk4n4zookJvs/dL7gsocrGc8DeXbYgkY4ms9Mg5XM5Gs3m5XF3JygzxWkqwmU4OJ+m48Qg9nTghh9rlXOD//OExOIm+tbNREsMuANTmnXuQ2wmWUPyOrMMWfW08cRs9Zv+21T3O2wrJUfOsKrEun63c9mZktho/pIpXvSAjrlieDKzB0VobGnGEhXYBEBu2m2GDZ2CQrnZkSiJENDcZOcumJzVY30bf+7v9Z7GJn/u3/OI3IFC5j9GQdfxDdAADBUsP31atgPWHHS4XUJG2JRib3gXH5sSSLK1YTTFtNExRCElHLHOp0yJ160pVJhTkUCQBBSaA4eFZGUFBcPh//OExPkt6+rFRHpPkF/OHjRrLPdbtk2CuBpbVf7WWcj22oc6jWhSfZD8rIPesG1TbKIUkRsUHCOipoUiLBY4Slo0hAYQ7cCBAZ5smYRkYgu09FbBxClBsZWaiJk4OUVUJ2ERVJAjmg/8s6U5///xa8XNfd6irlMxE+tAAm5qZ6MDS3e689W2RPzMKfZ0ObnJtQhWOBoIddmPI7jnWUChYvkqQMgzOPweQ+DrRCsHyc0x/oxqb1wtHmOsKCZdEUER//OExPQrgybJRGPTBMbYnpHxqJHzJCjWOzVbUMmyZqGOax6FH6P+LGQ9FDTHj1JLNEXohPNV5kS5lx42xZg0eiPG0mNtaQhjxUyyqznUXKXM4GiltJ7VX5kVNvQqKIpx3P/7/dcp77ct8x8iqeR/9FT/oUjaA4ZwnxOG1UxBTUVVkBAdakPF9SIaLSmuxdCSl76dBlWtP8K8ReAwexqh2EUGjRVbXFxoVgvg/lRotoI5JxY8qYHtCMQUJwtfUH8M//OExPktE9LApHpFemiOz2BMMAlJNtQXFEDTsV0eXW81U2I/ZA79NHDaNU1RKgseh0xWGJnpTwkGAx6isUtOdDkiqTFFJVTD2blJ6N0tJm5Fa2NUJ4f4tLEoR6//yv5xvyAqO1s2VP//Rb7nHb8ns8deNQpMQWADkxNMxvzfSDpza21C1E9jn5I7U6jmS0pyZRSuQuHAgMyHKFcmSpWw7DRejnT5Oj+ONleryGl4S7kbhcpYWRJgDiqK1m0qKrrS//OExPIpW7rFRGGFleYF3LnRXRdZjCaa6zElDikFF/4NoRPxQkgRkmVBBqZ3SrlDJYohRZIvxg9EbFZAK5pquO4q8zMg7U6Qc0h6nnY+jTeb6TC7lBxrCDauJCGJnnH5Bj6nYl6m///83jcmOswoPHw9w5WQN4rbZdVOdVvlEzOE713I1Kt68SCWYIaGKsZDCwG6m1osURbguZM1AZ5uqMSiJKpDUa9CVptCnNSrZ3obAHcqmIVEpk4KRgeF3DjD//OExP0sG97EpHpLdPMimwoPDFgo8ePGzqAkK5aQ1hvAeg0Ul1XCWXFJeN8XjyPdiqX0NOYmryEPrjSwtGo5HLagooK9RMAIxmqC4SVsdkA+eEsSTQdbLjKI3KJ+fIAkmpIQSa17VhwomWSJWeEgi2I33xGkuaV2kxMtb3Eh7pn2iD2iF2arUJACr+qrhys+W+FlCWstyjYkLb4zh1WyQ2dQoSqmtajyG6xuCktBR7Gf7fhjJGyqZtX5CIlCoZQF//OExP8xgxK8onsNdC0UCM83ASaXLCpRNFAmMnS6O0afRrpQzpI0EfqTEMTYqotqchxtYkS8TzzyJFZOqj06a1OEnNarMwm9ptUQ9ppheXoumUqNn9155hITelbZXDYNTeERAnaf/P2OfyvSBrnz/84he8v/7mY7PEMcJRXyWXXdpUAHVkBRM0JufqazSScsTAzxFvLCfmNSxmAlbKzGtssLAiGgtiRUCBc9GgsD5PxnQxTMZqJQqFOzpyQvWUQZ//OExOwrY8rJRnpHWRCjAnRW2y2uCIfJVVIWbqSwk4iVZRO5RssfIdpyIUZ62RmP/iZUd1CEs3vUguZfZ9NExGZQqXQB8sBgGGFRKYHTrl0GDgIriVkr3GCUCboFa0oXnB6ZK09i1Eavd06zGah1tf7Wz8UgVMQQQoMUT9J+QVwTyuDqYzAhTG4IxszAAGJ1iJPEhn7bDRzg7Uigx5v0z5gdLxIDshWyEfDIqFkrKVQ1g3MSMTiSQhoMRpRIk4lp//OExPEvO97ApHpFeR8TgiQnAIWcM0zxmO8RIEQGg6IkhcJiJcBM3JZPYXIxWKy7Vbztm4tsdPYNL6itc3BhDy5x1em28nMfbJBMIXpBSDnj66A6jWKCgPlBSTF1y8IEkD6FvLnUEKEVPSH5TtyU1Ec0XXg+a2IpR//9xz9bvuLIBOglCfM//+rKwh0BT4Ef8J6cKAAHcxlflU4FkarT+DXyuS1CY6yCkoRw6JIRjZlChPlqDAeLJPRciQ07wG1W//OExOcuM7rIpmJFsREMvZGTZEOE6BEcwUyJkiE7JIiCzqWWULGrVk0axSGXNf5HJt/+bO/+ETi3msitb7ZRIGTpEUJ9sU0d1GSGCUfYRlCE0mWSQj9k5gVhRuzV4hmeXMNLkCY0FJ3V5N+WP9/Pr3tutaNT/6NT8KguEcYCYKF8SwuI4sC4aB6PhgN1B+JJekxBTbhACDYKPNIixCyhRsELRgwRilYQoUI8OqJDBGSI0QmJlROuSFSMmDAiLhOO//OExOEsZALRZmJPWBYXFzdJoCMbXONjJikKarTBkm6h4owxi+Ir/SPdiC/105PQ/Zy7X6ChYsWOd6qSidBF9MrTekfo4PhKsucRnTIniwJpVtw9KIOamXmeNLOL6TBiJwJlFEQ3eWPPcgitfWj9MkdqH00wAgI32SMAIbGw/HZjAfsJfcPUq8kqztoLGklEuvFgrFgKMc4uAQomIkpqG8HwlTFVB2K9fKXDJAOBTIai0m+IUqCrZXj5+ptCYyAp//OExN8kqr7RREiNwACf4qu0oMctZGRc0ugmh0ym1GWf9NjnNTOtMW9h/9RpFpOcHkLLI+Nhk3IoMhUdJRS1ANUmIidwyGAsWRhAQ8MsKOcdEoiCpQawlVxQT2aSiqYSpppKTnO36+oPhBZYPpFC1AsDc89g8jI7pF8+QpBZChsJLXYGlwoyLtD53E/ssCw1pyGrWhcwE2rlamGROjxFgHUzJkmCAFJwikSS8yhSR2uSgNI5Es4IUgywjtWSoNg9//OExP8vMxLBQGPTDC0mRlkqnqs8JZy6VS6uRXUtUJXRYwvfQ0Nts5+G53HQ+6ZXnd5nSu1va28kr89Kyp4UvWOrnjSjqA4Pkj88JSonmOlcOElfzzdyGVRvJ2ddmGLFT+QY9DGLxRYq+0EuVn3bvgRVRJaRoeETwEWRFBhFFhHbDc6mxZgAYTmaH3oaEgtnAJLJcTKTptFYvsXViXEWx5+MG6o/OCCv6rilcE4EHTNOvMeDiJY6UkeTIzDRsyaQ//OExPUuYxK8AnsNdCZOiJEkkEGM9U1JD1KYgnzMdW9LLtVnggTb/m6f5tEQNodOXNuOP82J6KgZmRkeuggMMtktomIu7K8oJIaHLSzD3fJCX1BJFa7oxKqopgCiMSjIpXkqV+hLWJ0a21Tt92jGUMUfM7PM4T3KEYAADH1c08hqNIxXHEklQzLJ0TVrCoQSeXRzEkalAkBWQk8ZJEARDdkJATBccICuHQfEklDoPI7KDwOVyg60ehGTqy/DhwuN//OExO4ptAbIpmJFWFEJCaJJkmX5ClhVIjvUCKZXNZMznHqbkJjoDyZWE9imK8ZjveYVyLfyex9Qh2ouOiqYtlhlnvrCW11ZMn6+jAsYoS1l4kdCu3EP6lYIRDcEPJILSCW2gzki6Vv2q39r86Ue1FZ/1yv9jSsLZVtSk3CSKfgrWfWEa4P99Bo1wGVOLl/lVJhsh0kRDm35WmhbU57DbOeInlXLGiNp9RVCjlpMuhtGIeUM5j9Ry6OUvJjMyQcm//OExPovI5LBRGMNPHgOLGzHllslfNpYHSAga7VTSlq9mTee0UUkR7pRWNEJ5csjgrTEyrGcpsl0PxyJNA9CaQ5Hkkvb9NgmYOlXMpoxT+REWGD6IuhfZ5Q6ncTaqQIMJw44EImCAg+x0F0EjjUVTT9jz6ql+oSH8NSHLhxuMU7/FkxBTUUzLjEwMNgQAYrPVGpjhO2X2HlsGJ14TnUbMpneaZQy+dlhmg4tutMF0qWNB1CWBeOzJokXDZstQiQC//OExPAsg3bAonpHkDIJuZTmq0RP6Imj1nJwLpMo0CyrTD79LzSYR2TqKtvJF2Ma6KiD+k4tiQXdzCyWfLox2o1aFbRQjREzOxPAszg6Jc4mcySsKPqDl/1MlLRJpPXa4PyJy1YjhwIoPyCEC2pFHhW/9CoNWJzhztKcQiNAqTdeamprP9jMk5kSX1pG/BUJoimKRVHc9lFLQ1To7K4Qgolcn2VStrcfqPMBMHwhiFlHZAplSUjnCy3P2MxsMGgc//OExOgmyt7NRmJNVDECMgiLigG1zCFshKpotbMaWImioFLjMx1CkT8NuQKIw0OREz1UxZYlaPFokxCjLlA4uRaYswNtBuYLiOmhTZUJpnVR4lcPChhFAPWJ6CZpBY/AAxMO8FkUBDUlN9cWQ4zufEf98PMvsBZA97vmZRLIgiBAAJ47U8mUOnBWZRSea6KY5nJJODWyElXbIpUNfLUFLOZzuDqihbXEym1jPSZNoWj0OQMbUR8WxmVC2kJFU1UO//OExP8vcya8AnpNkrxSN/liMtnMC2J6HrLYbtMUmZos6DFsL2TuedYhnPRuI/UKXPbOTnMilSY0YfagRMHRahSpqv3qeuSSRFL6mMlNvF5GTsWkk6LToGXCc0JT8MB9V1pmbpVqE0zXu+KaPyzaGlLXmCtL/zPZKL26f1ClIGYEYIsGNUxBTZBQHH9aZzG01Y0PGnyy8sMGnTJcwcPOnPi8V8TSQceCRmp4nD8WxUPHDS0eFZ5KZqh0JpkTUMsD//OExPQuK9rFRnsFXMCQhkvx044YLpPwsHl3WzuAkExhmcldEAAQ2yPb6ZCzLPnOSvufqbLcDl5ddGmV6cCAZn4f3Ds4yrMtVLVPeuXnI76TUvn5rjX3iMeXaEDaHjXCKJlB8kOOJi6LkXVvXHkqw74gL6UwAJ+L8RX3VaG7V0zEj5nT9iQ5Wqd7Gfsri6V6APxCLOEJNJ88S+kARjGp2k22g6DoXSIVHbHGAuUeqzkcD/QB8FyOZyRzZLhDQZIg//OExOsnsorJRGGTpJ7QTsGUK7hfEcTIy6axp63PTEu50KKEoYcUFcE3nY2yu/pvE0zB4l5E9gPl0CB0fUkzKA9pUeTJSA8pTcocjUFkO+C0UbCNvL+culjpPpXYrPTz3b/nqH5w7+uGzW9Gy+DQ7DFTlPOm1rRUQC1sE8ZhjS3VKnaSSK1pTyphLDCoz+lRKrvqAShtZHJUnz2cYrpVD1qVUH6nShRhDp2wZAYNJtBQAg4CbgcDZYuXB2KhaCkC//OExP8tu47BQnpFlEQqgMTG9IckZYnqpAdicMGFU0G5a3Ka1Bs9JkueNknIFyiGxIXSYcc38Qt9QV7xJh0kHwtZs4jqky3WEK4wU5EOqy57zO5NAM4dsAHVBE55oFE6UIYASMCcBcsWPiUDxi1KfRYpYcEYoisxGjZMQU1FMy4xMNAQHbFXm8N9HaFyyqnCuWm5ggIl8/Sb7Th7J2ZxvCI2qlJs0S8O0+UK7SiGqtnYIx+pw/V2g1k5Vdp4AjDu//OExPstMw7AonpHWMTpIpRZvejvclOpSB/D/ltNWUWYd53nNP/bl8vtvYllbJyH9/hHdI0jAcN5STBCiQmTe9OWYRLRSUSwqiCpQ6FSWepz8frP/hLuSx3UzPk/rs0e1dSOuVzqyXR/8kz5HbEj1U420lWBPsnh0qwoUzp9IHSebOcy6WnCMl2wvTw7p29TsBeVGWGAuXhlsB+jkFzSRTXRCFkKQalOhbXC6LYr1KgEs/g8BGxKAOUhgKZiRC0l//OExPEpG/LJRHmFeBRJNKFSMmpDnTj4kOJlGEkWLuSiykqi06k8++hTSRN57cCeYLooNk4zaedIXkQiJ7fHUaMnbESYWDJ5XnB5PYB7j/Bp19FM45RJRCahvtroklWUS8FW+vJ8WOEJnGpy+N55+7jH0KzHj5IqJD5/etUQACTbCin6HLnLatpJQopGoU5vW40qx1lCmKuk0XAtyy2mSX00znWRjicqdkN6MPIlZ3sBgK06n+1AhNjfRqiNYx0N//OExP8u05K8oHpHeC7OaYWUfCfO0JhoOBQjNPaLkhY+VbQE7sUNHjIrXXgUPGOcMxjziNFAkMG0YrQNGKEyeqcdF0MhQ2DwENIMkLjyMLigh2gcQFiFtJ5GhK77Yefs4KU24ldFQsgEPHo7aiYYgF5S8oqNHRZkR77v6lxdxWUJRMUcXL/8mkAyMcLTMzq5sfoa0KtUKZHIQq4J/x2VTNlnUM4z5V5hKRPGQYqOUa6iE/Oo1SWGgcxfFTBVaKWh//OExPYva2a94HpLkmokSLcEXIfjKFgqTIl8UFAAA8CQfUSBNByBv5EpkVdZXaYRd6aIgZOc4xCe81HUmTJEjchFAsOuEC8zn8B0cO0tErIauBcUMHaZPEkTBwTIDrVXOWiF1VFvaSRhAfGhFwc+OMJEcf5R1k89t6nTrEHj/70A4cICqlgfk4gAQAYGAojbZQlpnc1JRVO4zE/u8pow2U2Z4pCS0OaNa4vOHFnFUikUIlzaZIPBocLrCVXxrIbq//OExOssw1bAonpLdumiJSZmrI+pNq3Xtw3Jaqxe70l59hLwnCe9KC6u9DOZd3taBGgzSPCN56e0047eyB5grZNI7iXNIZOT9rIpN21DyPIf46tzxHI509DvHOen+S1+IJo6pd729dVToCcDLRkfcOqC1RQ5B26A/zWQ2OxvoDWhjiHSXBrKA5TrvhXsZ3qAmBhKkQ8cRVt5AUOVi7GWcx1q4hS4OJSFWhKw4MocZPxsXzNIEgCCwUxGJ6tOEcm4//OExOsoc/7J5mJFdeBgyVC4SRik8UIV20QkKkCOJ9Us6CZiKU5cZXXPI2ziSHjS5ps8niBnEED7oic0Kh8nWuPTNKIGcTPo0UgvQMKkRDoVNj0d5pxGkCApF7giUdzDOJ6nAqdficrzf1FMlB3nPVnGMIDmrsBtkoT5QqjZXaPt2AAceiaY82VH2BUVRO91M8JR2nHL1/E1uq4mqC8yaLC3ASXURoTAKiwkoZoR1zwwPXyGhFkgdpTXRHhkeklM//OExPwvQw68oHsTRmZbP1FYg2kuUfVZaUks7dKEOwfCuKLc2RS+4xP/nw6s5YCNJMtxJqQbjLpLA4eTFECXXRizlqkMxyZFAJJmkm5xRBkjQILpOp0hgYlQ2cjlWI7+VP5WXrl/0+dOMZ/8fxWXjhHDPooKvllmZXOjW3Lbcyt92tXNipXBeG1ZYVczltVJjsc6GmusjBcDkEZShVGOhQVRpIQq1pzVzmwH0azmeJo7gl9IMrVYuDviK5RzNC40//OExPIpY8rFRGGHkFz1JplV1Z+qxWPFBWIob5+I2lAmD7KAu3zxlCtDnDKAeaoEiBqRGKhfkBZGyGQcemBQZaEwoJUYbD4wNwUAd4fxsTMWHwfEZ0Wo6QClEWJ6Q4wfX5RlHBhI2ocF/2bvS5dScoIU+CKpAVK8j8Fyhz0CtJshE9VgA4R91jMC4YYTIZR2Kg6HI44iHPEc/ValpNdXxVWmz9IhARWRjUZlsKOVguzAZJTDEDSbk8lC6lYyF8hL//OExP8wS164AnpFlgaChRza3FYYsqoSjmn3BAGIisnPLzJpc8IzHJL01JE9B/Bkxnw4UfIVis0F0ahBWuRksg6ogTB1jzaNG2wB6YbGmA+BY6iFCMpR0lFBKLnUHJCAcOCRNg2TYhREZCbcujNpQQY2+H6P9N//zWH+37X5jnkSrTb/Qjbu3/DZk4sqiTIomIfKErCWaAADwjQkBQTDp8V60JLBgBSc2uqdIFjI8AUsqGnHzb2SU4UGB8ZLVy6r//OExPAxA+q8pHpLlGgKFQURNryG7LS/mU6AelSrzZlHaFSy0sJD0u+k0j7+EcrYT7H9/yOF2brrdCZI9E2P7RP3eY0viigFM5/9FWpiNFN/aaCSbUmnZizKY2NasMiTPlYuP/G/9r/75/2QaWHIVpjO9O8WjNeVqSkp14ztwxkpKYOAQAB1mFhiQkgmNIkhZif9jcWAAlm2fy8Si5MPcKhlqhlGtLR84IKFr5yVlLBgiTGxgaw6TFAkGI7CMz4O//OExN8s5BrSJksNDKxcdjSUD4yNh2xqYhmTColUQov0yxYxylMJmCwDYkTNKoRxR9dNVZv49U1F+LPL7krdA//m4h2w1QlXKiGJ/oDxOhfUgSWUY+hA0shKeOos59T7Hm8wYJhCUkHz0qSioyHgA7Xh5dHYYWEjD/Y5Ut74UaYanqoXkY0sCFtpvOT+AwLavTinu4EhJmfi4RK7RQt6EqwNoJKFkbwtJPWtrJGQUnR9lsNNOIxPXNs6zrB8CyGe//OExN4mMq7IpGJNaNy0dHZMLpoiEA9JBpQgQHrJrqCflIfMQZOo3nKEw1K0Fjf2Cy7SmJBAOD5BoVHqHlpu1Rmu3Gi6nMCgfwKFhYJxUEMhA+uEtk3qcnxLuT2YDgyleycEUpCTweWKaDASzMG+qplijj5wy6oitDRYcORTd9Y7eKFGHAY5jiAQMfc8FU8QMJOLOwIT7blQazmQv/QGXW8mQkgUc2QoQLDIDyEABWB0nakR889RSKi0X4zkS5QG//OExPg19AK4AHsFeUXedQSMj4Dx8neJKlZYBkJGAg0jSqKJkEdfWxJHQZUcg0csw7f+16cUzahiuVnYl9QsqGVBnjwlOv0qJKD9FlsnjECzBAzwgPXo8Oe7/u7LTdIf5pijztf/1H/rcNxUqbCjku5c6hNOI0qCv6MGm7ZVQChbXEiNz+VWMj3CHNShUqheOavTLa3qleKntqNhGgdCviFCM04EsZApzFD2PJRI5EE5EKUyG7aEa+c8jeS9lETt//OExNMkMv7R4ksNIMVKb6NUqLXdSuidLQke9GPxS5liKI0RS6eecRSdqcb6Wmb2LyR5DfKz+IR4shD4mCSHpQjLqIsjgWDIlFItFwJiYOQlJ7Ft8sk7FsHpy+WyefnQ6UlgllYlo9iLFEISjcCwPipNwqjIPtsa2548K25rcxUOapxql+n0Oy/xE0YGAmLwzxz1lRAAA4oIpgW0I0LCyxVYid91ui0+QnlCj42m0KfaeH7OchGkely4qF0qHZBY//OExPUx43q8onsPkBwZDupyTDnoSoqQT5u5aMrdqBdpRv8pWwQryXagqpJ8WleocaQPSRJWpj0UG4Ppz0m0kH1RfUC5McFIrQMisgIdQKHnqKjNCB75a3KNwSQvbrr9eeqY1ElQKYWJFhm/uR3/5f/////oDCjFFgghRZSEECPios2xAACNr9KMSwr37ad87xtUCico97PHTiznU+a2+raiUMXms8Tzyp2o5YpDTrMukYci6HTJHSKELkxCIUqQ//OExOAos87N5mJFkXBSSs6+VD1FuMI6jmL4Nid8zaEo2cRESkpxKrwPIVz54ssjRoye12cwVq5BiSaFZNO8uKB5viBVoBCu8UniywJLIU6BrVMF2iu4INwK85DBIgHzNmEJLlAiizwQsUdBA6kGeOJOBpwiEJS1Qme3/X6f+DOGUKGBgIgdB+Yg/8UqQCANMi5gpQo6kWqqoY/YyiZDyfKSNhgVLkzt0JCVzKlFUuG1ILuj08SxH8n+ZT2KfwjH//OExPAvDA69RnpFkGSx8SCIwcXIhYgPhogXmSdN0Q+67zSDejlLf+QIblv16NRZiCI8n0itMo1Pc5mon+Rj4ZQCupghhs8kSkRgiywsStIeXIG5y09KSIyP9Yo2xzk3x3ps+EsSuKqDXpbUP2saz56TlPp4PDLSJ9btOHqu4Dv8T0AGeZcHF9K4zuDcqTkTTxXs6oVERTN6F2fnAlEPailZ9ub9cWYk6niWqEOZkOWPFXcdD0ERz6CIdCsXWjUG//OExOYp+xrBRDPSXIecrQWDGAnd1ysvQ0eQ3OG7428s34Hejv+3aS3MJPE508hmao5q7qmE+ibN5uYRBXkyV3EGdCtyE1vO0eKzRLPjzjlXTV905belCRTMmycjswm8ix2ElY4uggQfOIL0IQJj8aBiaOzVsZxeKzvGI5nE/9CdS1FX+JGQABjMOU9Tlg+TFkT23BGJhi4weLdfYiUj8ExcgTD8eGJ6NBfhDyzYgGKlWXCYZE1WT2E75mRS+pXK//OExPEts7q8pHsLWIaxWrVOsnriZEycQtK+Tr0JcWUhaSWfRRQLXY2WoP1QuOVLTCp9DliPU3GFzj2TJGkVVOkyLU+pE/rDtTVDFSReeiEeGRJKxGjOH5L10tZmCszKEpXInvkVigoIyCyHAQZUaboNR+KWx95UHlUhTTq/VSftouP24kVMQU1FVVWQCAAFDy9diMoH19zhaVapjSsSxEfsuxuGhGRmvLVitwtrtFx5AQWFqZKmTPh5h40YCQ6I//OExO0so6rFRGMLPNU8aOqIUNGGVFKtilUck421loanmLr1Vf+boKupOWpu5aLE7akidxakGtoMvWu+nUvbKVMt4xGovbOZifUppNaMoKtJaj3xRBZEupzg1RUM95vuje1P++nX9/3UhBn0cSCdDFggwyoIR8/Zp9YSnDk8K4wlkulQTiUWVouGozIYf+pTkWDpRZ8lmSVDx0OYzII4j7SISkl6IOh3pVL71SKZdIaaB3nSN1wVSNfF+fIUmmym//OExOcmm9LNZmJFWMiUhVNo4tnYCFyFF3mFWib5cSAthwgR1jHmX3TZg21EsizmyQEZ4ug1QhDo6MD3QC9NiJYwfCyMt0Nh4pI7VBWIXYWGT2yo/Z5CvSpAs1FKK+lwSi+sSugQkBAQagKH4Ju6kRYJAYJCI1mpIR5uwBACqMdts0sR8jIqtQ9VOCYfvmNgb0VBOxjSUGKX142ohgYm1DFKuF4mi02NDCWBDpWonyEHwrZmFyVlGdhOgUNFA8hY//OExP8ucsq8AmPS8iBkVnSY3NxdWRIsYmSY5Agi5BzptX0YWSWQ+kLUVup510Vpmd/ncmBAUKFjsyI9SUJkT4Yuh5x0WtwlIEDEut7mqhX9oov/HuqlxFUcdIU56m8epmxwnEziosIor1Y7Rv/+hfnfi4sbUGxd0A3+NQDY5HUGKzyLK5jwUotzsCuZHrI2PE7iC+U6WPOqGk7ZYTYfygcNoY/UpJEoyMCEynYZF3sxwnqvGMhsJjRCZipRAp6Q//OExPgs297FRnpLdf5xex2B07zarYlFQqMrTs5pMjNJH6WSRLYwo1iHX7raiB/hCFnCJIkOpYcd2yvSMKoZHyHCv02wy5rqOWgsSdHiqnYrKNQ+KUwwtwh3eoxhilNVX3VimaZupLbt9v//TI/BA/3RVar0igACskjMkY3JcsCsQ1SRCsJ9hmVbnJP9DLikTj8zMjQxMWEiM6XD+X9Kp1g4ozcsmYZFjR+No3kIwPywUgSFlwJDTHPF3C44OhPy//OExPcqi8bABHpFkMcNI2JFU9XPKH7KpI4ZSNRnJVDH5u7JEhAvLTloMSyi4Oi+RHJQkw4QTijqFhKWeN8uz6GDTSTnx9oeTY0tjb8cswb/V4z//QwqjR7jSU+O3+6//l/lvxCD4OkRxLIuKi39Yx+Liz4lA/XAAhuyscaArVNZrONRsKlQTfIfznlwliuR6nShygMFClUTkWMfSAJOD0OJJi2hvm0g0LVbtNEhUBcCgVgQ9qRqa7GXR/JIQFxQ//OExP8tXAbFhnsQfGp5Q3MEReQK6i1U+w5KdCOE5n+tsrpk9Pn2jFDVMYalSI0iQzdMcmB2Tycdfg/JEcwiRiwcCeY6Wh9LatRxEDstg0KZHFA+0UJ3yaO5PgHktiGSCSIZ1xuWoD4SBz8oTkBgVi1wUUzl3g2QHz4kRm9////9x32s6akWJ1n1bNn5X5Z8p1/L7m0zcGVKXbgl1XoO2oh/uHbUAxbSMogACBbMjE/hF0Ti7WjhXbmrttqpi8LM//OExPw4vA64pHsTdWqquil/EKMydKi+oscIQfN4p9hc/AUkUaSNKuO1zZwT0y3XLrd+I6975rwu399FH+F//v0s/Pgvplo95/YtZLWS1PcDFI0IAsb0WGAuKUZzzxYGWJU6dvwlbJrI697KmmCMVDkTuaW/QVsZitQVoayeNiIkY2JqUYAAYyV3dUQk6Lu0K1dNrfFdZbq5V6viUh9yYFyunqILvQ1VCoyUo5EqFSqBSpxMHShqnL6kE/FNdGMR//OExMwj0pbSJHsMnLlV0UEho6ceGSVI2eikjpXzS6evtDbBr3kv008Pk6e023JV/UkcifSHyYykYqKqMVMH0nEgTnhQKxUMHPcyo456GFmiUoKcIDpw/NMwTK2RKMGs4eFTgCfd1bL9/Bk+ITO0rN9ESzoOUEwPFCKx95g6GfitAWQA50VETcoZTVyOZYcToY6Kx4MrpltRTRUZdrDphKR0rmAdmrljgekBoyJx6yKUMfQPoKNFKREha08QSKDK//OExO8r627F5HpLdAPlER5Z1wauMcustNakLDdu8ZsuMGoTaEbH1szgv3ExlWPtcBXFhbSLVBcE1xKOhaecuEQWO2eIDciuksIOKCoUUiVISI/JPv/UjSgxJiY4Uh+ppCDTkbgnLLu3K5Fo4kxdKPy+CI5no3g/DSpGpHuLGhD1WIg8H+i5KJPMTt+9RaLuvq9CVHHRClYFhlQg5yrVMzYd6hT472BnenIME5hCTvnwlHo/mBFCU8Qh1aCgtISz//OExPIqy9rBZGJFdMzQ2y++/80pSkyv7XJds8jSm+KVBxV1DsdKoJgvEneOpb+7jRjsatlkbMH6tCTGb4jq2lytgdHEAaY8xa23aE9jLZaQrJDaNpKZvnzaxCRUlDv3cGB4HYYYhYdoX1wYvgiZvmDh5AEpPxCvZfUA2js/caK8Dq4Rh4LAkWVpHpgRKx/H2zy40JZFVmaAviFrJ4tK8cemScJyEJZiWBPKkiVFVrs+RERRUVGhSiZYPoYVSBsn//OExPksmza4AHsHWIRWnyBrwjyaooFd6yqI5kF0aNHP+Zof9kYuGzGHLVFIfebDb5KCrDqEliQhQUnJunKkJKqk89UZNEZEqGX0bIVVtkyhgRIDLKGSxKQESNCsrBLGFpJsIbaihrphsJB0JAXFdKv4f8oNekACc1pgZ2Oay4YUNTiqcWQ63J4qVIq8SKyr1ljk9YHJOMh4OZqLak5Nh+FuMWOa5/MRdlxCOxCEMbIVnJkXD6VBOTG1PrLCvNMo//OExPkrqxa8BGPTQAqcNmob9pI6igI9MpwIVK5xpVAKQ+Rm1BwKj3YFMpnBeBCQCEN9wqFAoHwoMhgTMBcLFgsXBvph0KBVoaSPDZokPmVjz5bVEb9q0SBXxFGtnLIi47Ypdn9XHPVbt+N1WfqVzJH12fk+OzLOSf/kfxH6fUPUqmCMwoAxmNW7XE1NqxTP17DLHP+BCWjrXmpzVqHtCvY6SKx63stleZx4tIww5290zF5IQaCN2f8qnOFpNt6Z//OExP0wc/K4pHpHlYxthIzlQsvpbTyPdyU7Ycb1LM7hGXLE97ksMLihQUSQjKGBsUKFCUmHz6CaA6YPCDCFCeFCRkQzIdUFJCqTh6Ylm3AVoECRwUZGQ2JgwfGzZCvCHONoEZgyXAc3PT43aAT9NEdmnrqZWFHSt8oXtIX5N6aV9ZXkeRrK52u7SRDqjd25zvQjWJIZltgzV6qEQGAAEeMTR9txM/4yAO3BRpWiUFWydbeJY4kQoWEV2ysvKS0g//OExO4yM+LAonpFsF2CotQrMnhmbe/UO3S20WS8drojmXY6OOKIvQy24hIRceSUM6GBBBukelec8/pl48619LKrDVn0UVvVXNXz4zW5EjTplMRKsrMmdZPlJEo/inY3yUmvlC3MaOhZgmqS8pRH+mt9W3+XX/uj4gZlDDjzGKNJOXVEOYmtM0JSwuQAsRhMTnq1MdxFkp0KrRJeXIpXqtcIpxLikUsPA/hZUcsncj4ZvMBt1WUqtKUkpxHalD6Y//OExNgmm9bSBmGFrJFmKaKwlYR+sNV8vqlfK1RUhLR+qGKcqN0wKQqCIlZREJ4ZEoy2WayxBqSgzu3xExyp8XIg9EuWVSmKJjLSQojMiIlzbieJGTohgEWd8g/2xXMV6LUsQA1noygf+QlYefpR7dYXlSJb//Ya/w//fEDQXLQyLOknCEVk8QrGqmQHuhniqBpvzM/RxGi1IdrDlgRrmUCNIYJqRHBWPnzSxaYjfPhwLq0SlMKMHxgoJIrEoqGT//OExPAuix7AAGPS9EJ46wllEULGVljK+LBc9fIcWOEqZEkvJGfCjWbPWjM0KA3c0BBPnJzUpv2ydXicixllSwwgEUGUheqbEYp4tdGCvMb65qI+sm87GT5Z6Wm/9EujhF7mosqpXGMXes8bTb9OX23CoUXmlHFCHUvqv/8FkkAAa/dLTWyJFv03MBtxYatiLcV6ZbBK1Iw7p25XzHST/b5+mS7mOpz2NlncEscbi4Keg62Iv6+gmeOoRemmXEYy//OExOgpw6rEpGJFlDxdtQiM0fuKrk6QkNJWhmZjCDAez5N3l8+nFdUf/NY2RHPU1mlTmNmGK7aF5khLBZDMqg9NNm2eTHFG0guXYPxV21SKUy3vWW95h+WSUxEvWL87b8+dptEe4r+d+V+a+09Xv6JtptIXUBQ1AAqEhHa5tS+U8G0kt4btiAWLoZyF8RULQ/YYpyUMqiBCd6NfC2HSZqjWR0iQoYjHNhPFPJQzDoDHNFJkm2cxpJUqmhkVqRmp//OExPQq+2bApnpNduIPiXlOeCjIVKZBWzpkgYbymFfMVtRc5MoiSJlLUREE+yxpbXkhjfuNY+pI6bb0mRKElAqREZk6kiLGLmxryI8mnBDZzyWjSSPHpl31PVEjh7Mmx8Y3VtpkNVAQElCM6qk6LSIVf4fSuI8bl3qEAAACA3TvLu72p4qumgMyrOKp/oeqTnOkzjpJyejAfj9uhMLpyPWAuFcPIjwlh9ltOtQHOXYcxyrhWRDrLki0OnUijQ1s//OExPstKwK4BmPTDFi7IrHERYidQ6RSKNiyAnWpRW1Xk88q1EFzHoxcntTDxiLdBhYuStzBsgdI3w1kpDWGewGW9BcTkTUvYlBdHpVIRGNSyLRMhEAEqKmnm4cRl4tD/CI5x9gc4wVjEAQwwdDnp0C2R+a+yV1dyF3Iz/9h2KOEdEZ0JO0dKCXmZ6EACVVIbUwomM0MqlWmd02QE9HhuMZxUMSaC9jwIqSS6vbW0tyqsb6QJWWAdQmJdVBBOgry//OExPkw/AK55npFdVoI6AyASBQqVSQxP+hVLhbrQzy54yvXOX442WKu76EtbtfUSNtE6l/EbyNah4v1Npipe89jnL2mZQcp8ygMKq1v5XLJaMax6Ew5r1p8JI5KxaWiSS0XxHT80OEV+gZVOHcbr0Sj5nb0a6Z2tfmKZnI5NMuElOd3+G3DJrs1+/wh/aoaUjEyLSfL9xpkANyYVx+OF5fOmIFB0VBDMjNo+fQWvWJmEuoRATHTMY+pVZHBgHqw//OExOgv++LBRHsHXbZkVzMxOkCgHAjGqqpESOQiYRigwiJiRk4wRM15q7M+QIpu/oVZyJQo1zz4zVh6Omm5S+OdOdDuLS9GvDN5e/TB/5GZXSgmXNrfMTCxkfKa3mlvRCnf9NO5XX4oqfStqCbSVye7H/+u//Pv5CDtBFOie0F4Z8dmLAgYZNiFHh0ygAUJZRMqsYUSAmYnGSYA6ow5tiQPQkJ1EyNFQIcW2yCbIC++VhzL54NxMY6GKOh/uNmh//OExNsoA1rBQmJFeAlQQD5olQcmCobNNPOe1U80j9oiOf6yI+83RjmfxSXQMUcPVllUK6FAjo3V96Ex7FEh8NZczsCh8u5CuJguXdWE75TKyMWdIDTCUBg84993n/BrsNNRikjjPfv/qepbrO/ypv/HiU9LXnCUj8w3Id2IkgALCFuLiytr5fao+FF2VX7mbYCNULyROIdl25K2ypNJQvGxRLmMYiHsoqWKkrh9xOiEx4GQeVCDi5pcsdUaMisT//OExO4quzK4AkvS7iryCFdpXwRo5IJsRhnKIGuiMJwpG0KOo9aBG0uPrNMWuQLWwRkiPmC7ylJvOY9AREw+iFDlCq61zUJ+5qDAfQGCJhosUbaZgykS9ASmmOrmgo7Fv8R7OuCWB7iwYoQGBkG6OtQEMJ/////6zCz3F8N4j0qAAgNQmivXXowztBUrofZdFO0lhgpXphhdLUBnONtZTPispFlvOpsUKRQoaBLB6iqMhkF2SEEJIUpykmQ9rU6Z//OExPYtW8bB5npHPVSqx3IzqMyk4UNHZnf1eyhkJb56eoR8tPGTn2qWXHSdSdp2+E4jW1bMZQStIGukCSlWulI4PRrvYh4u9DCR0jPgARhncSTCMRWhL4eieSDlEXCDHHEfwJDiNAkvp1Biz0OcsPviyis7vEf1fhjmaPM0hltyazGsfMIFSM+NNjTF/0b/5gtLyganq8oD0cl6ZAABghqjqNe204fHKREPqNW2tebP0A5bdfLkLElc8EYUFoyO//OExPMzo+a0pHsPeiVZ6jH4/fMjNhsnEZDJg+H1zOARFThUSHpxC85M3jurzmRzpjWOIt87EidvH/PT7qI5E3y/o5FXPAOL//azMghoo7izxj2MGsQgJA9c5o5Y2jg3782v8Pch2KDo7Kz1N+nmIWeZGc+RmUvrnbohGg0FkOcIUewl3QvQfH2QAIfTe/liU3GVaPQxRK9AplCDuiqI7kep1AuUoyGqoW441aX9uJjtjT6yPNKEqLnPQrpjrVpP//OExNcn6/bFRmGFkFZcnyFsCHt6sJBWSiYEVxEY4DggqNClA7oSjIww9UlzI+iXLhxdzsz9gmnMQ3NI4g4lNJjAfHP7xpcW/SECMWLkuWRZEsQ4JMEy9MiIqHiMyoT/yhz0P2AGJ/5sFgWpEoWQTUUWeyZHlmHmdfa4WiBTZJOG2/U5RIFhKqn6dSpYAItrcbVW87zcONEwDsOZVYT8j5dnWajCwKWva1ZKrDmkZrPmZlaqk/LYfC5QpOrZxrqj//OExOotSxa9QnpNdBSMbOUChscbmMNiHmkzwfUJKcxPbcv0osuUal+nUvNrEfyLe/wcgN8HmIOz3Fu/8XEWkJ6slBvkkkZI7pkswsLYeEMpx9r5rzpTkaFNFzdEku4pA0Nakj0SkSnTuJX8+uvs3/JHx6xV1AOO4ub9S6xBQP4nsFmUbVKio7KjCdp04lQSU5VS1luVJ/EpjG+rlAhrkhLAwmedZd14kYNQdZELyAPI4Uenhgm+UiqOAxyZCYiu//OExOcpOxa9QnpNdLcirgJ4PRPKoFWzwnECFJccFx4fnB76gey5AsLd0RfOj0/397D48Q5mBfFKKKMxcV/LZdydEk+iJTgnjuoqstkDCk8fLpDOi+QV3IBwvWgfUQkZsrrC8I/IoyqQ7D6oDkrRaERDQXcipzH8mIXdwbMd71KeMlPKsY//rna6H4bU0LpFFYAAAYvw7Wgw23tUFrYkPV+WPT1y24P548FlZGtcFE8ONUOk8uYjMgEIfEgJglMs//OExPUxU1q0oHsRdAhF3iER3M6ZCeud18EOYSUeXn5MSZyubj4WzwV+Wv06H7Zn/9/8qm/DOeV+XIXBCyyCjYQWrMZZbiT00eWswLIKZboarwzUW2wXmarCwTAopgodwhbqC5CA9m4n9H////2sHv0BvsxK/1mAAAx6kCq5YDFGVmTmLw1G6W1uVimTsY7GJNl3YFYq1uMWE5IadJzIgg4WwhS4PNPlxTpnqc/hSjtMhmVKsUbYfiejTluVaUUS//OExOImM7LFRnmFdXsWYb/GUREXHzVz3/xXQz0pwzP4U1Jf/zI1pnReR8xP9JGzdjqSyJqA8SqGw/PRhYFiVY2JBMaQQFQpBeDDLYWKKtEIZubzEIcuwUjT0LlD2uvdjTnNock/2s+bv9z/ohG1Od/f2//8cJV9iiwTT21E4kykAIetJ0cK8xSjmKg7O6lgeGw4NkfV+q00lGTZkwkJlKg+HFmfn7CLcXw00NNKQvRuJFXF1RRIyYqUWFDVplNF//OExPwuu/a1RHpFlckMjRWljmfucsotM+XV+ZJhQQe5G1MUS2AJvpUZ09PFn9P5DqYcWeZxB5irA2CYUR0/Akle2yY1gokSgK+lCBCgXXSABFlj3PRzpIpAitzl3/9iPv79VV58uw2mtklIVmCVTBSp4xOtgAKOKHNS5gG6jR/j6dNNUcW1GSNygkc3qkX3bizNN1QokKRiFK6RnLJZScA6nyAKRnLkXwzkgrDmylS3qNnyPkcnisodQJkXYjJf//OExPMpuva5QmPMuHz1dlvxOU0x0OUrnQpyRtHOmtaFEKUGyz3IUSme+rERVgpVjKBs94uwhdZYuvUN0iTgbhkCxAYRBcpiukeDr7qNJ0Rx8a/zvdodHaZs91l/0H19WjMt+fD5/l/v//N8vIfSTe0kOyjlHE7ACAFi1sysqqmpgY0+3IafioYmZUt67s5sbO07QK4fHtKfivb3xxzHIMfJYlfDW0OMNQjfMtNs8AziYTheaiMyRYeEJRtT070z//OExP8te8a9RnpNcHZFNLdT5Gmvf90lAqSmkxDDP4rnd/3/2TCP3M+uFlUxAfSIRmOnJGWEArPdIKB8PGzMIJkL6JQRLLiE7BAqgwKl6JJY6aEPNoe7Jt6m1UGs/ilL4hYRKw/g0igmEgqH41ChqMoSgwY//iWWodMg1oJl/v/9DyqAALpieNjXpqYbKE5WOVGOKmeOb+dxXbI5qZ8zpxCqHAwx1ZEL2SNMnSn0ORUztCTnWX7G6UByPVQehPJD//OExPwvk/69ZHpHXEXZmfKCcRPMH5ii0Sert27RR3XsPfevT3MQY5zz0qir/3n6cn4Sn8NML5A60cJhIdNAm8nMnLWWRk4fpdMwbG5k7KlVbfEqTYIEAWNieDyhAQMmDorR5cv+vO07mXRq2vmX/1LNVVnp1NUxCSf7+EWoEBviakxBTUUzLjEwMKqqiBIAIwwNGulPGRSTg4bCqUWGZqIii0El0SwRVRBOGkEyY2RIERANE9aUeExQgEIlMILV//OExPAsY7K9QnpFeGUKabiKaBNAlHfPoZLLmWk3M5Pp9bFZ55wz/w2NP/9zYf4Smko+Z2CXZjOppodWZkkYRJpuWZsElWU6Gg1NkmssIjckTTnYsWkgYUwQgICRzdklQzwxSoW/610/1m26N/o81RCgzVWEAAIqBbz3erpc9W4T6Lio1xVrn3BmQD47+vNquVyhRKKQ80No5IE+cCieGWaReDXGwWFS0UbG0GqsNuapkf4ogiGBsy2KF7DywACG//OExOYmS8rJ5EpFPds4XDQkKkvJpHD28lmJWlf4pT/F5ajfRxtJhv+tejIg8FBA9dYWmjJYaH+IBsTBUKJAwbOCIL8VmNoEw8REKoHYPWJTKoNyWRKrjWEb2aRIVyRVclTf2mEJ9I9n/8oqsf0aO4xHuC6UuPhk9RFlDaz79iGkAAkc0uKgnP5tiqxhTKmRm4L7bx+jjkbVGclVfhUK1hwPgx04u2Md6XJAgS3wjpJK4nId66EYSUwnPnj/GoxE//OExP8vsyq54npFeLD0mpC0KTYe0Ipk4qks8j0lJ6DiLhITmZWSrkSo8jOBQQ6InjBP8sOLY0yk+ghOTqaUcHOKVpbocvzCusscnCkctGf2cmq1B1KULVUXfe2GUR7iY7O0TCxes6AWcBMB4MQwsaEMQiKquQZQJDt3Pa7tcdmq4/9P9B6FMV6MZRvwakxBTUWqxIAETRVqvGGxVq5IRVGop3r7c8SeBCguorLHa2FicmBtH/LRS1XCRWmZxjp5//OExPMwG/K9RHsFWOKqZVytMzEdMB1iqyCZD4siOCWWKAo1ZcycskjDJIJkx8siaoQ7sgigpv/21i1uQpDSyS/0P4RKvpSlzVEk8bTvwO+UYktkd6Xaj/amf+1VPmEM/3KNbYfHUIfRBYgSQwqtm5zur9XQB4jHDW3iWiMiciCSbXMOymXbZHcE2yrs4j1USiUjCpW8SVWm+o1Shh5E3UKFmwQVCWKGPs60+S5ePRoNJJt8sTh4EIUyuSOD4eDw//OExOAk+xrJ4nmHdDKB54uYkISTmnk44jLE9e0ZATMDDTV2icszv8Iitg7BUyJDY2YEr4I+ZSLKsHUxiUPz5c0xZglE9ynzxQ40bLmb9Wx+lEhb9YlMEjOZ8CiBD9ME3/inPSwZHqlAZOsBQFZ78qeJHTwlALHiygAaZbU/guSdTK0XJgUT9RtT1Ao5tU9aOB1LERHxDqUzEgT7JwqDgXyQGMcS2rFSLgUacSitVLeJ4ahQjNVT1bdp5OnceKZq//OExP8t20a4pHpHdKWdgtKLMPFef0siE4fi5tD9tpZVhVClPSVC5lIyXQo0zc8ZLo3kNwMshR5OufpJWNli6E4w7lxXJVAHTsMXJe0kKNPKsyEA3SJmEBioQxiiijkcbMM196NyhhNd2ud974K+S7Z296by5mj8tnm+JUAAIpG5QJ2RJPoBe08m1tPps8lJVcx3i8qj1yuFwvs6qmNLdDQRRvrJYyIM1KjuCoGgYAvUAeR9mcQ0sn5PzKQUQMSO//OExPotg164BnpNjCAHDgSFheTg5shJoC385PyexpK1Wljph9dUvbnO9KH7xye+SWjo+qckxlaXIC1J2VDlAe/GILyUITIuKnS6JRxaB89jWGZywMCNydw9OILlYSZNBzNCuUyUcvE1WaCeWEiGqofUQSoSy6dLVyxBSL2GHVTCOjcAOwSyhxnBdi6Mjg/y1//6XIEOaZd+ulACAHJJXPEx1yg7Zw7iaZf1Ywt9cSGIysYP9VRo7GZHOiKcH5bO//OExPc0I7K0pnsHeFAuOoLBUhGDyNaXz8fB6EQuRHxfWprntl61iFVHAcXug6/XDgjwY8cYeEn8RCfRJhvpoF73qf/whp2ZgOUoESAsMPWkh1zaSjT2TRSQT2l3ScJdryCvB0PygMA6DlC5RBOoYhabf4lYL/vrVUQqEtDyu3r9lHeXw/yoN8r2BWGkXU0DNfkSvhmLpkEhUSvLJdj7ZAgwkpuDAP5mPQJIWgZB1oJyBnLByn9FJYPAv6oVq8qq//OExNkkasrB5GDNiKp6fHYSKCwZnDMapXK1lekE7jxxtcu3yQoOkwklYmGSg4jJJdTLNCWxyyTzNRq0nDZ6Zl1ANvlsMly8DATjWPRFfJ41DsTS0OZKfIY/DgU1ZTl8dRPEl7ca03BuUrnEiOWM03JMR2in1JmtMj16zNJUnevxTjs6sfzNG93BiiEdNxVYXY/HBE0SCx8UBfmRbWpuBIACARGg495NUtGhf5COIF448shajXrGVUryzRh252qX//OExPo124asAHsHeBylHsfXUlCh6SBg4QzFDhWD/TGCBgoF1aQKd3smRWkaBHqZyFs5xHiC+smr3FQtJNVJ/9/+Uk1oOG/3f3mdHhTnkIEGhbkrUG+GAIJFf6xE4P2MR1X+L/KCD3eRGfUnsdW/2+9lvtazdtyN9QwKMaCuHjusH9OlQAJPQ12mFIdDixm3DJmS0nEAeRflQ9fwk0dJ4nAyoYW6rOZgrpeyYgAmGMQkJ0m4frahMUvxc8GUT8Qo//OExNUmQ77J5mGFdfdxTji0LZcx6zhSSk8CY5HypoZjgxMKVPN5K397xigJkresp2OSUKraFS5FMWmEOZhOVhNxSsP1pzNbnnpZ1MYE8DhSJUUDqHyHGtRaivdbG38k9pCPkClGl0fzOrnyowv+9dXPu+/aPuZc+DJghvAc2mZnEOY7VdHaVyaD1nbd3b9BwmOKD7ChuYS8rblgAaI2UTK4hJ0xFMER7RPqFQnJRAfIx2ArbNpk2lW5gICDNYWk//OExO8yK8qwpHsLeMo0ZCfJICoK2RFCK0yNCePsyqaARAIb7W89PcT9s2fzGv/PP+nshGZykd75/swm6hDXq7xq+55rUCVmAgrrPJ4QM6JCGURz3e/+M/IR32RHI7ZXrnT+zX7rptb07qlNGx0KK2cJ+PVFgAI0oTS4RDufsTJCNR2j5lZEVLghjardItWp05k4epGXBnGsRRMFeoUMOBcG4jGIlR8lt71TAfVk4yjhWqyeLiuZRKj04Xyamh6o//OExNkjY6bJRkmFdTliJDcXNv2nl7bsydNuRruOXE6qxxB6W5/OLzE1fkjLVzLmGDZ6ST1xSSnlS5UCx06e+O0ZcdOSGCopHcROHjZqY9Kbg3Hspy/7TvyOOxW+yW1vm2UKb/BpNTP/V033gZ84GwsYPNtoAcC+s+28Sgq03EQd+xoqyM4tqEoasJQR5PH8nEOL4+VylXBosBKYQIcuAlxGzsJqTgWwXIcRwHuln+zFFdM0vRf3QmhJCqIhYEyF//OExP4uexq4pHsTVr1GrylOPRUWQsySTOBrGDAMMtiyjy+nMdpdHp/HOpeh8RpaFM2nsxMNGx1bWsXXd2D+U/pFZRe3509N6JxkiTYgamcm4eohy0omZuNeSdnOVScw0KgTqV2glyqrGlNmjyE3Hsm8Ugy75QQXF6gyEFjQEFxow7xoDDc7oZwuURFS8WITmBcd/u3/QhMQfw3kA/UIACMJrwMJlkZ2TFJ0sPCceZCRDdJHD5h5UaXIZOWRlNSR//OExPc1G9qwAnvLPguFqp2epfSDusBUJxgYnzw5E+VBEKpZteYqnBYONoOfzCJ2t+XGbRfQRet7Y/5zLLl//hJLkNLXhRUYalnI5WndK1/Tz4Ykkou2H7yjTECJ3MU6W9PPPXRSauRhcpmYuzIlH+V3d6lu/N///gwZyL+Yb+dmfFKAA1mMqHFqaZkwmLHql0+hrCW2VGF6QlVJ6Cn1ZdqSbI2mGpEWabIeJdFWkWUfD8lhZsJfmMV9uVZDTdjn//OExNUl7A7EpmGFkHMStXQkLgOIBYNGhAHwrYA2w8MHhjYa0J/zpVNYE2GCjDS7BSTfDPILQ6cPdGKIFaSCyJjPSpekZ48C5ssVOqER+BXeokkT4hBZD9hAOT3taJY0OHCVck3NYWYcYbMB8xb07dpejM6Tt/zDNOeh3/ggbrB105aRgAAQABFhUSVhxXJ4pDIhM6GMTLOn2xTsxIG965PkzLizXc5ygVSwmyslQ1nM9WFGXF/1zY5ZVMyVVCJR//OExPAtAyK4pHpNcFBbroJwS0VS9XN2ThicjFk66NQkK2KMbO6uZerp2lcOuOdtBVHEzHViYLpIrLTJDAqISjApJwFIgKFZalyA2xpokPBs8fXUwsVKJwRFVCMnFJEdQH+2Ky7GdpWC0HIpxgr2kCkIPXU25f3f6fcrkb/of///ECRLYIpXPBZijZAQAaZZzvIzHSjM8S8DsbmXNyUjQiCnhuLhMc0M2lcmVAyHmrDZQxkjneuBbxPXg8i8EoU4//OExO8ue+6+BnpFlN8iSUHw+DszjJ9YyGiVFYqA0dTEfRqhYnGxUrSzkRRK+UT2ydks/++hSz3phFlJPUy0iapZZzykRIikdaIiLkt5TgyUPiObT/aG11OmZlBXwWYykTyfYTiQWLBJBqDurDAI6O+DY10ItDGUS/K/on/p9PDoKcKhnK4jDhw/NYACE2UNmqiOn0qjshE4XK4bVUxqsYSGKxluwKxWHQuWNDSSIQUBFl9RRvXFcDSK4thrH+qD//OExOgso+65RnpFWXSmNAxDmX45YyalvOhyHtcWUUI5KyofPXSHaosJ3izsai9y0dMN6JPGHvPSQ0dnKoUsPxEU/MUPRxPBrTePiSqj9RiN0HAQHg0ShAYDYrWDYPBowQAEIIfLoQjngs0AgjpI4Rhg2PBwe5EKZHlRjGnpvKHlgIJ1poCY91E6p3pDJCn14xgulGo76tvr1/csY/+5//uf9M0KXljNQhM5+wjh6NUq9rqsDgCvZRklihpNJPF0//OExOg2C/qwpHsTbrjSxOQH/y3PyxiEBoHRX9JGdnrNdasRMtJPQoWAMGBq7tNIolXR7IaFOyuurGW/a1JE1/ZW55ETouVT/S7spWYxqpNPre22z2RmVZ1NIpnlIpld3Yl/zr+ZwQy2ONqVG//D1CmcHDfym/gu4QADV1OzZUKtqhcIXeGwF5EX1KVcMyz6JgBaU/NnsKg4oRiOAsIJ4CwkCAHAehs6XTErEBaWkqMAEqXUsoBSKkzqMjQF59lG//OExMIec7LaLnpEXYIO/ghh/U4Xr3o4qzyZ01sMOPYYi460jojRMt1j0iNnWzkUAoD4/ABy7QfCSQ4igaYlji7YYDwsD5Eek1/0lT8G2HHT6QoKk5Q60gQEKrKb0rPs7f8JTW2J6H5DGbG/0HYudyTlB2qQAACBomdMu19TLZpnQDBQ8lZ+GkiGS8rU1tDGzr6j0zIS/OpiQlCy+Fofi2h5KCSqY4juPBEkrOlHmGEiQ9Dwni4xWh48WkJk4nk6//OExPsrkvq8xnsSfBes5e/8tp1HTmsZ8sKu3ELX6PJo1CGeMO8j5FWqeUN316WX/pDVQuKJmWiicQQjq4uFyR8djovq6Hb10yO54uP6chFJX7ZwYts9y5jjgwLChAjrWkcy7muTNrfszO5Myc2kklVQrt5FZf/goYpGqOeQnoPuIapMQU1FMy4xMDCqYAgAHFa6658no1TSY2XNH5gdHS9DMeOzpdA1CVWlp7AWHwOXHkEzkxHsZqHSFbh/fKFk//OExP8wVAK1RnsFXBOB8P0kRFxeK4EgP3oHcmb+WafvaqV/3uyjU5c59e5NblTrSyeZjuWZQ5utg5hRZ3JES1EfMIxhIyr0m5hiR2lZ0S/8xVnLQKEM/V4Pqv/+Q42gUgPoUWpxqF8IdHf4IE0zZHhj3moh02MrA4Hgnn7EmxdYNSdJNvL8fDehaHm7OwC9Q1nVjKZ8Ir4wZ7agh+MiUOKE0EK0eyKOw+S2hYCGFMrzldvl6Kik+1Ljps42LLcW//OExOYmc9LBZmGFdETyJwdKnzh2Js4wxEwKRWcXU5GdVsbFJTTGrjpU9Z1gnCkackfo5Tw2jrlB8xkBwSjeEK/ouGGXYSkwHHk2h0kMt8aWHBAVk/1hViZzbIgmAV6ggD7EctDfzCCGh///7ZHlkz0+ktZSaTo9MGsGg78xh6oLOuY9VctWyxKY3mBUFhVK+rmdrWmVPtjpsRJ1MR03Nc9nYvTSXkEZJUkpGQQgug9yuV6FrCfil6MCAiEJZjvN//OExP8vk2KsoHpNkMZ6dqL+ozgZ21qVbeej12h7Y5t6KXcTCR0SFBnGLzfBlE2V5oVDMiev0xVRvh656WKJmyeqP0KY9Yr1SybzobKhton5QLFSRI+MESqwYN9lNoI7yjAdFO84qhV/UeckRl6Z+RPf03Bx///9UMHdQyGY2x+38jP0JiRMzQbSsL36CkxBTUWqlUANY0TIU8rDOMeCWWGB8WJM0ytH1X0HVpiy37JbGhNCJkBq+dJBBXlZSJT5//OExPMwQ/a0AnpFssPJiGckAvw1KNGFBgSiRjBycHIi4HAFtQIG5uT6nK32bjsd3ssrf387yk4MN76j+UzR8V+52KY/ustkbsgssEfC1ODVl/3KcndHXUpt5zXRqFORv9tGpQz/dvVOt+ulfuwiM5GBdzogUAlG5IQaDFBbWxuZiQHpKn1WxoBkUzS5tLYuHMvaiXbMn2FzXENnU55n6cZJGYpUMbFklxYHAwmdubVeuV8pWUJgbAOI1zlEp/Og//OExOAk4+7JRGGFdWSdl+meQwIMCqKcSFVtjy16y7oot7B9gtnZtDc3TXXT52A6bNEZ1OK6OfrE2VCh80KJDb6MCsSM6d6ktK2TRk238gtL+OOTRLdcvBXU7WahvnrUX+G/98o/5Ovkhnl55J/V/9mF1XdLxSY8U0vRRJpMQU1FqiQADVD1lUy7XTG1vXTKyxHbJuz9uwp5lLXMV6P5iZWx2X5Tsgtx2kHTJwnOrWNVKY3YJ1q04ScqZldMBlJI//OExP8u4/q5RHpHeBwCh4NnYnkW+nETUE3VMmRSy8qbV3GMPXc3bXYTT8le3jTkKT6d+kvK5SeXG1Z5104a2lijdCVjyVnEx02a//lSE6eQvdkOLB9iuHZDLoDMyB6wiRv9NGl/VFpVr///pmEiDIqciJeAgAAg0Q5GpuVuHGE5JN1ER6pYnGymZVQbFJH6JUyvcHEYB9JMuosSqIGbBvuRkvTOOch7KcbES86yQN5aNjxCSrPVoFxcbEklpBLM//OExPEpO9a9RHpLdN9CRuLKCoqdua+ZaSSS/LroyhQ8aYRyQ84rpQuRCmLBsuQHWiFYSouQWiJdOG6MIWIitkHdOejw8Ys4ZNkiAlJjI2eNEI+ehkkY+ePvTo31aY8EHRGagRpI3KJ9RGZRqPZ//6UtyOMaNqAjM3/X8IKgA1hwVtIB5dPTqqEyRDeiR0IQJoJ+pwxV0hTMtmY5jzQaujtRdQ4Dh0RCjjnI2ktPBTJ0oiWC5rR9p1jnF8kgKH25//OExP8u6zK15HsTYB9wwyydkSMinq8hMmVDmTQRWJu28V3UTmZqyGpMqYbYm9eKG1FGk0PXZVhXxQsTBqJ9Nphkrr44J97koG96B/Kn7C66M4d8VW5UnkMdfXmo9vTWEGvFfvqmT7X//oEQoSjhgSGzLfLLn//OCEOAYM7DFEFV46BDkH4EzT+8dmq2qAiOl54sAWtJsqmFhumKjaQ70SjsQaAUJCij2FLgFUp0a5BDlOumNQnWhBoHXVXmqrU8//OExPYu8/q0pHpFeJcKgOWIhXy9N0fJyzBKRn3igkVNYTnujb3EGvvNlrd4fTyTLEzSa3/SQzsxzxCuTHeoYctBS05oembNo9CAJpEvSZBMWUtuZgYIILgIxYLjSJRAKzYUkXcbIkiU22e9pyly7XuOwhn/66c3kH6mT7/T/5wHmBYAAMECaCDYGsAACBfRTWj0cnNwiOiujngn2NOw36rbNXw0Ltz05KQ5FFAXkwTsvqFIBzVciIJ4mSxqxtis//OExO0t80q0oGPTCG5RkOWDxVTHVcH6fNn0NRv1W+gNCt6T3M3ktORbjhnTBIi2Bw/WQ/ORyN4KqYdP84LG/nlNb/mW4cthM6JlELFE5A4wK/X0ffRVWrSpxZQw422pAoi8WESp1/fC4e+t6RXGGU5Def/leW81/2b/9f0QWchXIyw3+W/mTEFNRTMuMTCkgAAGCwGxCqfnTyssGNTNkd7MLDU+OCYoPCoqPkE9gWklQZQWPS2SAksTbLlI6mzh//OExOgrw7q5RHpFlfL0Ot3Vyd15tHhOfXVdUTq2mi+U20h0GnI6317aqNe+l9nen0EHP+mCIPA9yf+HvO/LA6C7lV+U9DtEn6H8IPfYxyN/9R2cKQskoIUmpj4Ldv/dd1PRv69q/TxqFMcatRTSIZ4+kHXAAACQhPA21p4LrBVqoA2q1D1UplVFX2cmR+HIlXkU9FGznQiRmhIiMFET8lYH0dS5OMGIZrxclssX1WEKQ5pWU+nuoSHG6T5FsZlJ//OExOQl3AbB5mGFkJfIchzFMvXOEx7JwWiq+vNEjMqEjaLlmLqK4WFScwkizXPkT3Xj1eea2qiJhvOJBPKisT1glHKYiICGNLrCucMHlSeNBLQ+plxWnj9okleFeW6EQdfxll3pu036RN7Ol9yCA7WL13TNX+lHMzrkmHTR4eUzPXY99/7/8oPHLqaz0CUzSIIgwBABoiKkGUyQXyhZmFxgnMoFpXanckZGklhSdaPtWH/K9YnlVudCFI5HATis//OExP80g+KtRnsPlDxU0h0aJFkp0EB0ecjW+vxVd9oEuzuJNLZGXq7j3X9lfilOEZOnWfvzJR9tv8IUjpAIAx0aNthX6T7JAKCdGRrIEB4hFcGMpAVeh1J9JuY/TJ5/uOQhxgiK53H7g6xLgx1o1CSNOfot5//sunKcapyo9zvcPoHKAKrwAAxeN5njxLggGyA15MxgQq1ZWCVic3T5dsbG1yPFKyxEaQITZkIbETqgNNVmKiTPgt7SzCUiodjc//OExOApS+LBRnpFPAePhHCWEkSK4A8JJaHFIYqkp96EbFmXSUSUbqp9RHAtehe9NCWPjOYsTfExGibhws31f5OXLnxCEYlHw9jyFPdpNHkGrgNnxK8osCEfDWRFvHcBKHlaQz3XE0ULpZSEaA/qfr0y8claMmlX3IWXS70bS1bSOaWXwNLm3rtdCV2OD21sqkp/uyPVuCVVtvfUCnCEAGAeWw9RtsnTQ7MlYrmBWK0JuhnKiOOrx2tYfR9Q4XFo//OExO0yc+K5RHsFXKQtWkthDSHr9ICkclZwfDpwbleBPL7UTZqcLa3XNBgICeY5ZiN8Gh8cZQbZiX/xNYVhY3cAEUGBkWhJ5ImFInmF6sXmF/Lrf/k4J6BMm/GhaLC9AAKP6xWF7y1luQlcYW/YyLMlZdR0u40A5S9sluMqNq20VYAAilOKHanRKGuUx07QtcqdWIFiZZ1325TqJqSbIzqedFqA1XNONQ8Ticj5fK0ZrQVRwl7IUex4p9DEqxQm//OExNYlys7F5GDNiMMAiAo0FEjBayg0fTOOS50vlGW7NlGkWFjlUswx4Ve85ba+b0UKqk3HtLqzIctD+i062ePCk8WXId5fH/+ZxAWwUpk+P59VNZpswvaLb9CiHCgVJgYGCBmheO6l/e/WIE4cy0E3PUahAyhbFKKDpBar74Awz+Q1zPyjivQ20wyIPwsLbBUKc3lNJ062NfOcsKNenopBZ0IMY9h9KFmCCD9FxaVIabGcLifjYczIW1sbC7o8//OExPEsAyK5QnpHdNZvUh3zM91mbTfxDEmNnAopOTSWQ66xXnFWDeqwXTaJ3Ilpoyq7JebFPTt0CRPzXms8zeqkRnilkVYXL9XlBvWaA0WEJuzpGlX6bU7FJpgw8u/o5mkaurOQyiolj4t9te6hv9SreaUjiyBSSxkc5209FM7f1lNohA95lQClSm0/ia1cfiS2STBPJLL3stDifkpQZFTKnSu5ZKpRORKJKYlFUqG4lHBkBmwCS4GA0CMJJ+DI//OExPQu09K0onpFlYQ+l9ARzS1fTL1lSRon7KZIpI9D/m4eSG8igWovqjDp30MvnLR9V1GczkuZv2ePDIygRRcu61xRrmgxR6D/9zSoNPCUFkjVwYCLBigpzMca5p5nRAjI/qzo+pWWiNKXv/1/VSiGuOEOCoAlCvnEKiAk4TlKtSkYVSiJhxlGhzJDhJirBqCp2yU+1ImzkM2RIoclEMQwwTLI0uFhRQlvCFnIg0NKBVGK2q0sK6OVDhSUDAqP//OExOspi+q4BGGFkxsowqf8yWZhGmm8RrkaB3Ynv8GRRI31IQSRNI/SPehc195So3fpGSriH1vZHND430DPDxIXlLLWRk2BQQAbJxASf/CQtnPCkJLD/DGDGDODBClFjGKd3qgkY9Bb+r2BAzER9fwxpn9Wb8j7sTUG3Imq4AAMfJ3H3DY2NJMEFDnavKNgVzkftS/Tt7IpD4fuDghLgcaFwydGShJKVSzLDIaUco4BwIw6lg97pV5BbFW1qQ/X//OExPctI9qwonpFdk6ZpWVndXVToiqxbLwwDK0uyQxErHhGV9IuaKX4s/4v/8v3N2rlyASpSP/9EHyGzxxFZKFiI6ZRFFDYhe2XACEQsJsMHKU0y4mE1oql4tSbSUmhc+SfVlGfqV5+9bf01sDpAlR//3k/toAADCoZnDKRUjGfkczA4AgANI5bN0dgMB/GRl4qHF/bbKJsEmjzRk2YcMWNgLeWbar7DgUKtZTEQkolQCALScb0RGJeOCYy6U1x//OExPUqsxK1RHmTiNGFVcq/TtrV7KOV7fNJduaro5lh/e4yXN6pRItX4/8sPO/k0RKdv9O9aDeMuJ4oFfafxyYVPyKhHTwqCgP3lrawlOMlxDRQKl7fSqEHKMBwoAAwVI4POhw5udfOfqNQrsbM9iP+7OhVSvx2SeMeUkMhgAChWDiLLkcoceMxSMziz2AMOZlBsMV7EYh50oJtw/TQBRNK5GqZy5AyuzA7j25yKtLftuc7TI8NfbZctyKwbL4F//OExP0uu8KpRHsLWHFf6SVMqoER8fJoFuwPNLU/OOOUsuutOnVjLGMfkzantdlecRdlV0Cyk/a1il2P0lL/nqv1sVm/OKBcfnx++ZoevJ1FURkjW6VVGevPWzgmXZtf8EgQUGOMGxKiTCDFQQTtFv6LPBor0T14WOfTX/XG/rFSuqSySoQgAIWI+0JblcdLOqVtzMMvi2q0EknjxcM7An3jcrD3hpJ4+XZ1W2qidnGynOzuUhOyRHATVmIKY7U1//OExPUuW3qtQsMHdqgib7We1TMmKmXiqgieTRU9Pk8mEkBCjVXQK/l15/zr3/+swR0SxrtnPNSKLLXn95qRvP9QAJJ3KKE5Ah2yLDzz3EayCyx6Djvsya/sw2p6uCS785GsussekrJlqM3+ef+zGrqafdGI/T//BURE1OHKCEi2cQOCaIy1RCgADRGL5gyYEErH46pQZHgiTJCEowI6aFmN6T0eCEWRzIozNAuSkIei+VC2RIQ0BADgqUVoRIGB//OExO4tLAK1RnpFeNUeQnzsz6SNbtz8FVCSLboedR8m+y62MlPfHZR1Nqf+J+vUKaZkshQ/sPv31GkQkFRMyu7nZFUS6IxaRKQrnjsnCckzr4mx+v53+K0iVS1FOQTxMQdOvzIJtKzjkZSO3ov/+PoQSFNXCxBqsVk4mjRWdcAACegNvFYLICJMuKRoCtEBssOpdTmnhiOQ6V2fxouzNTpPCEHOPFRrZbC0i60k4wwEKRR2HCslYXFCEjpULRkE//OExOwqpA69ZmJLPY7p0WNI2BAK8QhoSMHaxEdge4oJyv+vf56L9jyxQXk69/9Zh1yawrbXE5ARAYw6UmfRo9To0wmQHJlImHQNrGj+CsMmjgodxJCMcPqGjjM3NKI18f7SVtPwxbfi3pfUwyJ1sdv3ev4fOviQ6UAqTgJF2BnAAQkSU19WI7H551n8kE0/EMx6KcLWc1nVDhLIx4CJUjkoy5wiWm8tIecirqORMq4vpwB6Mk8Ugzox0jkuXBM5//OExPQtAv61REvStEKTJRtM8ruGrz/V89tULK9NNCKjRVNASsyIyJeVOQG9KDpMcXgsmdeaUQIGy2GUCxUhCt9F3B4PIjLTZgIkAqRkIzPZC1j4IkoHMt7BAJBWL4HiJDWb1wDmjw4lNGQNGn2u+GpebGfnvNvf/7Y6TcpZ/Oaed/q7m6E59X+G/9LcWNA3rasjehXAEABwgocRbYdnKNDVPRcGV++iTuk6/jRI8dqanlEKVUSad4/PRUN6rhsq//OExPMx05a1QsPSnA12fZyHuhcO6mWXa6cKQXT5tlgIxwrNBhTRCKtKRh8la6Tmsyb2VUvZgr9KIQLs1KP9rl7/D3+1SfhYxqoUUlQQgigJPJwromIFR/NMXqKcNuMdwZyor1hG2aFclB318jbEQOfmySB2D/4f8Tg+9e2gIAAKj8hr88skVCbIx9dWdqSrsoB8dsly0HkcyLbARokS4vkuo1UOicF5oYjEDqkQx8bZIRcSWhiPjh9EhL0NWlqt//OExN4mwzrF5HmFkB1NBeWwsLWPqb5FB5yPfDz5/1pUWymPkNFznElp/AxCbFSBQhxgqHpBTgcLUMsPiYFSR46s54byCasZTEf+tp3ggA36JUj90/FgdfGhtmPodGhKUfBTYJ/+BAZoMIBgZGRCARIHURoATg4YxypMQU1FqsdACQk/kvhPt2GFfP8uBDx+KphcPDo/Q+sWCdaMQaUWCS4+uTdUtCCWgeIPqh6OEa8nGaYcla4yPQIoK86TiRQy//OExPYrzBLF5mIHkVCxmI5eIwXBqCSHRG7/4hKU97JwmRW6aMoJIoE9QY048MFfmLV+IC4zgYIPIg0fmEe2BREGOYC4OZfT5df8DpKww5RKYtDsaU5hR8VrL/bnby9n/vmzX/yV3/Bo14ozUMDRl4sDj5iCggAdFjzkPTURgJ9pmHmzxlh6zYcZ4yab3NrhNaIWjfX5TdOB8p0G4oSTErlWvKBHJQ+C/ODihyXaV2hqVMqGfylTjg3qK7XDfrnE//OExPQqA0K9RHsMnL2tBIioKTBqIopY5Ns/2nnVFDoCmL/snSXK9q6kYl/2JHWD4hsv6InahBGitPBgF3cth7pIOQbvMfR6Rheb7MFJZ+lpFzu5NX/95P8P//Rlah+1KjrSrY/Yu0Cfbm5+0Z/7IjEy0bTUjheNVF7PLm3BlYBAibGGzqqZYUBaXMmUOUy2AwjEnbFlmPFVG8TZRJNBI4qT8EDYiYneilQTUW58fZfCoJaZcNXsiTPy51ISzEmO//OExP8vXAK1TsPMnVjH2uzpXLIvqhMq+fHIpJGHhTSQM/MPkyylpR+sFHRzzuYS3kSCUdCOxoY/APeZwkVvw9ADGgiYGaGPAISS/5ZJFIDGwRLxP3aSIwCAxccT1lHYaIEBgPU43W3R6DlA8fiEVApkGpHWxC77la5HJgAYlXBXp9+ry+IYzR0mtHWTg5EzKi4j8u51ofdPQHFsXSqH/CNhjTBfVGSN4nl0QV4n4bAcjawRmVHuSOujT5AySUDY//OExPQr+xKpQnmFkETZUhFRQUTvKb0oww9WhZYljfbXiuXUYTuOGDLPXmqcEBvWjfpA2VYPdRRmZ8pHUO8wssaMf5DL0u6b0Ti5S4Nys/ZQzh2zMc2zoUJh4aH3FCOJIUeV+3/lNK4vdsY6p///jxxFswxTTN0MOG4bAAoYJfiVsazYpyTIBCx8iKKYzTUTBiKDu2A/ZUXk4kgxN6gczDQBfXNIl9PYd57yTilIpGo4/Xy/DVpCBcBci9Kh6cmy//OExPcsg/KoBnpLdTWElg6XptM2EGrBy4oovXrDJ6DpQ/SbD2dKqq1Yk3LoZ2HWEMxMjlwyaZJqY6FdPVQkurIJkEDpeCjnFagphC4RLirUwzYqRBVCWSIpl2TigiLkzipwRNsoWDyqLl2OuJcIW4Y+Kh+v//UBTpE6GsNQafUA0abQ806d5OFQk0CZ6qNM5jvMQXFKD1pxSkGQ9cFiXcGQ3VSMap/DMUyOJEJYfywEkQgrh8rsb5hmIN8gZ1wV//OExPgt2t6gBnsTbFl4b08SsvBSq6KzMqFKR84q5s8TDZXS5buJ1jSJJNfWJrpv9IViQhFAoFaNpTpLqloQsmYcoTWZ8U294WCp44LQVDdkX0jQBMx14qOWJWiVuChQ+XaTbORE/jyzpNLvlCWrXVBqL3vvOykanCMT1gd31d34f+IFANtYGdsV8yXgRyZl5NwdCwQkpVQrVt85NaqjGY1G8aBd0q6WD+JKeyhENyJySIkKkjlsEKflhgDgUawe//OExPMtov6kBHpNkE0LSRORhaEp8uTFx1sUExKy1UlEKjNqKoK8otr3jeq7cFIZ5myE+hNmWukgJre9GSf/9U6QcPxYRnlyWtIdaVWp2fsmsOUhKCJAsfTxHT/AVuX1EDDBog1WVyxxVGCblXx/QfIyz62T6Leif/0PUPhk4oa1CDRcI6APJqJkgCAMUoUFGXCaJ6kRwPmBkmXAfP0OdfWvD8XSOeH6cJQRJQHDIGRaqDgOXHuiylZy9qN4hifQ//OExO8uRBqsBHpLdpYaKJqb1I2yiNBwUQFA7nAeH5ufXKThaPey9G87f2I7efmJq3fEGE95aSU/97pv9O//JpsxpZp+p8WQH/ALtyBJfMTJAyfLJIga+vaOLxI8wgV2lo/JDvsJ/y/+kgYQeU8LskxxIoqAECh7TSKketqlUGijGFVlQLYnU5VKHIka1nemWWT0ofFWCMLvd9QJ+V6KDNTCCp0kRkHS3VG19CQ9K11aC6SEt3C2b1JWIPw8lbGV//OExOknGua1RGPNJOKzom02R4rZgvGNz994e8eD6fuKzIbqIh0Ihs2V0lwkEQSyKbB+QUhgYEoh2EcEzInLQkKZ4rBoevlA4EMKb3E6UNMsE4gD2eohLVyOwDBKLEjO46k5afdMqGXjfXiSwHYR6+2TK5o9k59Kbl8oGYNx3Ht0EwboS9lANxAQiXe5cLhXXv9MzMzglC6Fid6cAUTgcHILvVEnSCyBjP////SkP8StNDSG/+ltpmrTrFW+0z1n//OExP8/zBqlRMMTlNWdEAoxVBDcyLJybMnsKGufbHwclVc9b50l00jPUPbxgwLZWAHFw5RmV3VRYJwUIETkIhC5tsELAOGyyAygNdPCEF9PuTpBJeO2PyFRDHEVYnS/Du+dGGvVeG5pffKz/sRZbHEjbIpEn2ltjTvdJtPh0mlSZTj09N/OFUiSjUEd/lGOppOEnrOjLEueZEbv3D2NvQRcCq7VoAAgAxEZ7GcarUVuU7h2XwFyWUjXFXTVHswN//OExLIlou7BRGJNRK5ViNbM2n6rnytMkfquJkxncpjlVJ+oefrCRgnpjMzI9P04W0rXyWXCrb+7es08F3S0zfzyKD7Jrqm1JE9MV1kjkrURHRO/3aJuMo5MgBLb+c//lDtlgpu8jMaWRm2bh5sZQl3YoUJ2F5QouEa6TKc7UOVqM4V/Mz////n39/CcBgI60OFu6pd2szbswgAYaCyu4DYxTuERWIY1wHqw0QFMwXZnCLBiIQhiNRLAllQhiEJJ//OExM4pwzq6BMPMnJCdHiuESe8dzWkGzooZQVKDB0fWzuFCEQAU+hM1BZeaRycZAWgXA8IktXagXf1eDSycpW5ArEMrUHf/CPPSnVl42aWG/JoLFubDcfCwnSy0Utf/ykT0pjDEAlu5KlOkjFKf9i57LB4MiNyjC0Sea5GDn+gs8DFErYpilYACA0X+2q6veFo5nEihSkJM5gYWxgYGFiWz/RSMdLA0GM9kMHYqhdzxP2fBdi9HuaaIWm9XHmmF//OExNooUtK0xHsNRDE+XKHvjwRTWZARBwuHR4Sgnj0ucJCpKT73Uob80DIqN80uhXgdfFWFpU9Q+iSQn1w8JmLP5BMiD0cOAebkO1QVbogewzn50eZiKzrhQ4hLeCAdLv5HCQVLUSkSwibsGnils0K+oaQk3QqEoi//vf/5klH+lhF2GVraKPw9BHfFTuSo+PTGUFB/82SXgKrAAi8ZQvoztnbk+I6cMz+SlCjZaKpSNi+hgmcxEBszKw+nglUH//OExOsxa3aspHpHeVOyugr0NOYr2BUisVbRqaGxVKxjbIV3OsPRu5upBgqEhsrNO27/LfKRG25qpP6km7fqI3/5yaLl6hk0HQiJme/2eLkT2ZqHWkbSF9qb4I2nwRwhH/od3E/c/jHRS9T//xHsA4BizIqWEzlCxVl4ZyJ1JX/TTEFNRTMuMTAwVf5YBIAXCDubgxKcqCcw0u2qxaa9sjanoC+2QFW9fPTOeHK+gqdNIlgOVyN1GJVDmdmljQnS//OExNgmOvq4pGDThN7FlJJME6SUBqBjlPFZ1LMYO3aiwxS/XSYrledr2+JdllZv/9b1xsr6/053pY8nkidZO9Rlhw5P+Mr8zrtD/DmWtjZ3+wt3gkMoIIhScHRAb9+FZSPQhSepfMjZ1fVDHMKeY283/HVMQU1FMy4xMDBVVVVVVVVVVYiUBlAMwsp73vjMOT0A3ZQPJq1QvE6BYVVRi4lPVTxNKgmOLiufm8RYDCI5WiIpQx2L6VSqQ3APFhZ5//OExOgm4/K9dnmFWOs4K7ElsCn2X1SiZJE8g2q5X5NHzGyfL3+h3eqxu3zDnivufpZX5mrY7molayzdJHCkC/qKXIanSRn7F6X+9b/mNe8pbU31O8/fd8fO7fPFmX187VMv7CO/+fn8xp2fuVxS2+UDGlUKhUNXpiG1ezz0r5cF/2XNrJa89YljqsrbSVReM1XmgKcUCZ+w50HkGDNWeNQVMtuKqDaSMkBYlKuyxE+JsWI/lOWImKhWEehjqGZb//OExO4oU6a59sMMXAtz9yet31tsiOrH0cFGzmmUXWJFzMYtoW7ZlJW4N4tfP5Wv8lrQnfabUsOjq60xEfGyQYbl+VGlwucTNOYEMx4jaFKM4PWKxgll//c+gfaRRHlzxD7Z3Ke/Isx6UxLU3LqgbPiVB3lzDRz0MYCjaBUkTBnAO+Km2U82xHnWwViIhwS7jlixDkaeoISYjtJpOC+j10AplpAhl8WjEU1TkUKYQ9PPXJXsbtqmOONPDY2uI2vo//OExP8vOwKgAsPTKhBvBeT6xDxmmbVjeJj4j//4ieB8wqQ40DFJdVvWS3n/3Gi/0tTeMa1eAyUiax5KaeVh7gfHxLPT+mpvF3JT/01E8atd6tWHu3/99/2mp669v//9XvSt4e//nN9+d5j5jvf7c+J2+uqwwQHgDJR1RmK+PEhYZoSXpFuIikciItmqihiGhUMBFsTdEtgiGjqFBDDBWHS7RLJVAYCGUkzxE2ZRZwBtPJAgAImCivHCqQX7LhEQ//OExPQp03KsA094AAg+pQmWiIqg3oYYFE0XUzwcgke4EPMmlsB1la2EwBdRQhlN5udatE35noEvOXEZpaM6+yRqBT0QG278sPhUJciQx14XgfdTtsjXVyKctNi5fUqAFQBUaPKwq036THVkikplDyvPNtjnX4chTSMz7zOk4LZExUEyRiJyDZbVUqw0ARxDixG23Z/4Ddtj7P3+gN6Y2zODWkwGzSUPw1fGBotjAsgoIdlj+M6aUy9LlVFExONh//OExP9SvCaVQZnIANMyaMxSfizuriZ5GXJlshfd23yuP5bs5/SQE7NaJSHCR/zXK2cuyvYf/f92JTDUzNRmtqPS/7M59SrnzXf+/f+VT0o18/TXLGFvvLOFIGAFA6S/qGAorIap2RWKIvalaVaaTfdoT9lpp7Fluan7ml14/oZuryPPWA3p1Pk3Th1nG5H2LQqqN6wcbDJK1v/uSZ+9zj13nN84+9W3833qNfW96+858/xSjfiF4E8KeLJD+6wP//OExGcsiza+Bc94AWixpdSQY0WLvxc62rIOcOWmzxodf8+mc7361tVujTY//m9K7pBx9RdW1i9v8Z8ucbzS+vffxrO4AGaOLPjhf5ukwSvetb9v/J3/6yqAAjlMODyfTBGXhqMlsIYwnBQIxk1xAePkBDLAIjgHgxEYXEaXxz1SRzp5Opcc7coSRlQZCKJS5nUunyEEnOoVgwqSCXUw6AVYTnWk1SEYXXJKFKzaIhzo7anFCTLsNzY6Fa1rJam5//OExGcuWzK0pGPTCKU33I6gmgMtEZKU7bcp7z9Ik2DDVqnyqTRKlN4CpE4Mg0XKekBGWbBVE7erRClLGDlIesy7lWYf/Z7vXUaTQN+o+UaVDIJUPnNvip4k2SJsTf01CO5DcRGJ70KMeGnCuYHq45xeUhFJY2D0t4gLcEZqQL8pxIUomy+HpYXNWLRLx+DoPoiBGzvN1ZbD1ZR8rggZEJyQcNtj6BG8kRhlAMrdOTdIk2tRHZe1Vtr/23hw69u8//OExGAsMx6wAmPS7OmSKqUTe0yhAX7Ns3fOoFlMSs09aeH9gu3pq4NlUJ9Cj1fTK9TYKkggTqD2mVUOp2Z2208Sy4/fuz1qUpNz9vsJoGNSTpDeIyDWZ81tejVYScACKdWK9X6iwXKVXQHPDftkjM9X0B62YVLApDddMjmsMYtlFCuW9Srm0I6EmTIdlxqHqQBRbM1CEpDYsDaYFBjseK2Nhu2xltrLHFFdUl4u4xs/GEIi5xS/z3B2cmPNjUZu//OExGIjWuq4pHsRJDunKGVLRdCo0aHpaedQyCZH81wil36tMFe1VfFfjCaDKGlTk9cjfosI/8QKxgAFSv3FYtrh44Kydwa412yPKzQIs0Rrgxrv5pmKsEyxbkYUMU6joZScZTEZCTG0CMfHkhwhJBOpTE2bJYEFb62hgQ0CUQB61/C9BRoAx9A4KxAL45GPWYGfg1EBfM2gFN7CyQKHIRoih4rm4rBenYbfeKU01z85P5/aknOIV++p5V3LzRP3//OExIcjG4q4xnpHKODfOLeDNbReAGIAPkQ5R9Qpmhwa+eNL0I9feSno9j1QaxyqlOnUlSvHYTUBxrUzDyMwNTqCh8/bW6Lv7tetL57aG8uL4bPK6RW7OyUMVVR7TmLfBHYuMpzlEZUd+7cynF1VyXarvoqEtWq1Y5vl6bGbvqr3/oyIzhlYpiPR+tryOjbVdJuMcoEbigcc/ieAAYBUEROVgjaXcZWUjPFQYqKUuZl02Ji8nuLy+o98/sSxIE0R//OExK0iA8LFlmCPtE4KJebRlst6Sa2gOuXrz4s+JLzwGBqQMNgj9kscl6r+zgYoesaIbOKMPylELCAYa/ESiORH/KrPUgZ8CGHEnBtWL6kxSCblhygIcxgmoxZhKZdNf/mCiE1P7x0mRxFNc9Z2U87r3uQY/DOFPeDGJtEYBAThMmfd2UPHNSucf6mh+OvZZ6bFkSXy+P7vxDyRzktEYf2Ea4Ug4MBB1YZHBMLEcWD+fHrmoZSJRVKw5LC2n5Y2//OExNglA7q5TnsGfJVyb14hN5fJIyg/8E7X3SjINdJyt0WUhBLOTSm77KlWdG4r9KZzlKzefrG0s5VmIznLelFFFqOWl/HbV8qT7H8o2m35/V7/6zsn+2/ok77ZOwZ/Of/oPd//N5XjZfPSFqbbbc//pCcVMkxBTUWqqgHMdPkwn2tq1dE/fMK2dSuzs+36Hn+VljoOQuDprWGJ81l9Y1QrYZdsLEcB2xYiZCQdFYoBNbAEmARUMrwYslzJymTt//OExPcrK/axbsMMnbfnB9eprJee4x/HcWz3cVZWmvj2BQIGF2WDq5tFTGTvP/+TmPRdcQEAIHix5CoRl7mQTQnHwJpM5/02Oe/rSnBinAwAYU9sZSQr6CGjK7HwxFUFTbndY0xjk6f33s2pphh+PBIRYipAAOS2RyS25sj+Cy8wE260stG6G8KjIRj06JpYEkVk0dgWEYqJyCVlLQnHRLFAOuHA2oXSsZFIbjESAnPSxYxzrUyVZXdQwilcLSul//OExPcqlAasBHpFPO4Odnucf/UP/p9DFpImOzZZZ5kiRlmyaBN//4Yy78MkxYTFwRAYnZwSh31bAL26p/7RP/u7kjMnUcr97/PQnd6+U//c4tD9MkgDFlE0RyM8XQ8NQSCFQpPpHmHp//4h+YS+fv4lXdIamX3JokpqYAcVp7ItcqlC25HqxjiyM6NgzSsbatngzu2VWJlUzINbLw5WZweSyV5lohNHiXROoWS+VTshAiOVLYb7JKuTEJioGQ8z//OExP8uVAa0pmJNcPKcgQLnEJPnTZgUb1JhOROSlK//p0PyuJGyzf8FEv/8J2CDBKm3Wcvi2f30CnOe4zb1ykdnjSij0OoYVNfU8lFHPkZhDSM1olxnLhHN+utooFIgNh1RuFBsbl/mbmM0WUMphgZWUmRQRxomTEFNRaqAAGgItAfJjyyRGI0InYARswhOoMRkcR4Ulm12zExu0vQfZhIaJuXAua5scZTohD4ipgtZlp9JJ9cM8NUmDS2JrGiE//OExPgr9A60pHpFdDY2oQkZa46hnIVtik0VRTQQUZ/8ChPn6RfrIUXteCdoENok3NWhROJsyKAjD4qKkC2L83c9VL5urVNyFLNpM88lRaUTi6asLtmT8Si5rLcUdUe4bUCJVp43Ja2+edhNAKBU6Ze5jpsMACrbSpl1AXC8yqg3cZY36F6LxmGf7JKnkMalIdqKUC7eIaZhLXxcSTvmR6LghZ6tKVNh6sI4ZSFF8OIvd0gvgZRaHhhQuXdSRont//OExPYqgsq0pkvS7Cc3pojkYVJagwtG/c9RrzxS4xdG29Wl245WZiHtokCpO1sVDWtLhhyJumPiKC6pASNM3TEiNGjnZGnKCijCqjtexXIjnFBBBSqdqO5zBCFPZCV6O9rSf///BVg0g4kUrWpaSwyB42qIAiLDOJFbbnN7llfigL6LCPqvCFx+KOjBFPjJoIe50XtbA80SdqGB0Sg0HNDQmJNFzWTNOnX5eZyWUwQzpN1QRX9WxefRpMEhiUhu//OExP8sk9KwpnpFdYSHUciOV1GxF46M1q1gvNeclUs2iXP0Q36VhcYfWG7aWBYcqYmWPu7+tfR6E8MmFRJLhKd1EVHS8IR+ama3Ik5harha1DPkxKclWJOnRPSkwvB0P7cmMOGKFdRtFh84cWF4gxzC0TvIe0WgvaLbSs9ikWLs4i32tNubTe0v/Vr8RUSS9Tsfu/2L7pAADC9jC3HWgD/aWx8kImW5VJxPPHJhkqroqlVzhGUCJTuYpVGOQwsT//OExP81c0aopMMTdbR6ha14LxVINGQELSPhJRwlr1qNOTFLp8i318M90ZKjUalC7K/1l1P7TEwTWzs+2js/vh2vR5R/ZVOYd4LU6FIPjkj9yNiQyMztYlb4TjIJTB9WyNYnGKN91tfaYp8WizpEBsRjqh6Totpo0cVLJDPK1Qw20GC3woWTOzF8V1MMh5Xrkwl64+2zwOK8bywNlLXSfl2XrdxTNx5U30+5LKFAWVK2jRVzpVMGd1HRLuAnWgBe//OExNwmivqxRHsNRC3WsmkvWCEkmZrCvAoFGmOVXVh6npUUzSKkg+hRNh9RATKTGV059E51bD3dMlEc8GD7ROgeibbJxNEeEqFU0QkJ0aRFeGIYXxEFR0hVA4T1QeKg+IFwRsNkpGKEZALMF2WwuIVhUYWBw4M2knI30a70RQ1Jdzb2poFWttCysihiHoKM16mRgTQ387fbBBGNqL0GR8gTpJEAFgS5wH0q0goIrCzp/DO9RKqjsL+HHfPHzPVX//OExPQ1g7aYAsJFltUD0QhqGWivXq8czKm7F7VDEumVyfH8p1bIikKWDoOkGxzVi2xKv6GVcW+wlm5xZ+u1bKnvdSV+2lFe+m+vGmPC8uKS5ueXU0GlMcldXq09QSruaLXHewOk1kyneW5nZTSjFKhJxBluT+Ru1EvRxrZbvL/K3o+caHxcOBwUCI+PHi5mIGjx4HggpOLyqhBwCHI/eOkRbXxjEzE7ioViseGTMb8A+lU+WGTNj4sjSOJmKQ3E//OExNEqjBKxTnmLdeseDc/Fp8TDlISXBEbEChowWOc8EgNNaQXSRqHdjOaTk1jpUZjwvlVZ9lkirPz/98B+CUaCpht6SH/fGE73v/i8rg2d9wIEh8T3BLBiXGjw6SpWCCD5MjHW3u+Im7L/xRu4Yh8OZbU6z/yJhTBiwMB3CqRiSNUAIaCJShcWdSL6DZS7I4+jFZbj8J2ny/rphP5YPDDQdSSQpGOCGkqL6kk2hUbTOeIozvL27PVPK+ckagTy//OExNkmyt6tRGJNQCITuV6TEzCwRGIHG1nwki1ZPLg5P1/Pf+mgl6q0Gf+c6l9Va6HqI0C9noQ6Ik5pNKe+Lh9kxhOgbaUz/DbAmPPesbEApdJqcfdtFCGYEqAJJwgGQAHqCM+rmbCOVvOFjke7czBv7qCsykaOLbMkAM0DAPI+1y5JUxC+0QJ+olMn+Z0adWoh4h7gaaAN1CWlUqtbJ6iYpkEyXZOSWF9SRe24t3U6ElsCYLqkpISrrFBIJsR0//OExPAqu1qpQnpFdNq5p3qZ5MoS6SKVd36sP59XpUzcbTdcoounC7j/q7qYSmzcU+SYx0GL6idXyFQGV2oHAuVxKpI3t2hyo9FSlzxgIGMH4WsTEBDVmjRoo7MMmf2aZ35fKW/W6/VtXQWHl/rJL4+9ff16gAILgvpvMC4PVRnmdjgYRdH5XsMBC3HDxcsirb0DtQsRJS3G+XgohCSOHk3F3Kl85ISK8RkuR0sbCx4LNTirVxP1pLASEwTZukKC//OExPgrQ7KgBHpLWWnTIqTUPOlCGf//f7aUhT6qCJsgTvPbn0k1/7kmamdhbaUPokQFxNl4FRlx2mVB5Dtjouqyd7axqZixEXMirPR0gMdMPyggINLMqKx7033/dbLP4Z/+1//onkJr/4McZFI6qZTs4tkINGNEpAhVCEyeEc6Eab6tTBdTeSBPnhcR8NqEIebsI5l6EXB4eSbaF2Mkl0gM8+yhFKEdAFJ5J8sRhAC0Kd6uBY1wMpCjjCMgXxNl//OExP4uK/qgpHpFeVEqOMQlUo4l7dHka2FPNKf32UNfEohzon7LIlcEExtymll+66szMzMsMXWdNFi0mTJXURihfKQ9cUidzCyA9fmY4z96hDZMliyg+lRdZyLJvalZ+geqb6Ql1W0Zl5XvZbMKNKscQkba+HZk735mfb1bnMy5irQztvmK6oX2oDeVQwc8soACFroVRlwUkctlwvn6xEZ6I7wUKiKtMThEbsGOJCLYkryCEzHrTIxzzsripPdb//OExPgyK+acAnsFlioSCNQ43SRGQTw5w1Y9AlynOtUHUXxcR3lt9ohNnekizlE1kJJO1kH918pSaRff//7I2E0eh8NhcsOQ6Y+tg5yhkDCNfU1QUDEQoaYSMCAoZxx+x8+L5qKNQLipj8iHUBGYJyhGlPPaxGig8wfxSf8EcjH6cp9UoXBMoIX16g9/3xBQDdVMgABgo2N6zwGSVXH7JBc5Fy9VSRYnFxtK4sFp4aRWGA+IqrSyDM0wFcUsBVbS//OExOIsyxKopGPTDGrYKnkiqw7U4S5Lq5awf0OCo73s33q78OJku7h7IdEFMig+vQQ36J06JU6urhu5qIZRZRptjQkWiBwgI9hKL4zQBvM4i2Iua+PLyUzmF4TNrBJxwKWCSg48VKEL6jKnbHGF/AYzESpMwAAolyq0onFsVp1GsrlAUKGKLKrfPYs7GxIQrmQ55y/Plg5lCW5UEhIQXAI0S4lg+BMxxlwgJwuhzGkFpOA2Wk7y/pZTsAcEv0Nz//OExOAkypa0pnjNiM8KvIj9HPhCy97ak+42Oi3rkkvxJXNsOmotToQsrRFsaGHcQlPF4/FAIOWdIEP8UhooFdbxwajjhAH3NMYU45S8lxdhmLIp5iKf7Zef7u/lbaugoMKPEVIWhiIxoBFuQEDiWIHewM2QAAKk0oy5dvGMyyCIep775RGZdm7HXevW4TDUnjE7Brz3YHh+Ms9oWbSGStJljrukwZwGs2ndbo7UCO5BrK1MlO51qc5ALuvN7mzc//OExP4saxKopnsNYDk5LbtFJnUtNEqWdH25OcEd/w1E0fudQkdgbbQELkzMaQ7yjUORjUefsr8up2VyKvwr0iUqT9JdQiKznqiuE3Snrv1D5yeJGRRcayoyG0Eh5xtU+VmzGMMFxg4tR49zVX+kv/FRxCgYfqfoNb/ibLpAAOkSZ6MR/c5DjuNZonthcNSTW4pefGbp4Bkb5T0NwqDZqBbD88cCCnYl7WakJag9dFTzUbfaai110JZBUfpYGdIq//OExP8u7BKlRsJLkQiRWRIC2oZcnehRt7Hyez5Pab1NNdN6TPSSZb2tZam6oejncfK0zA4pR5kieuSPl/l48okXWNAjQgEzTC+nRipKdfovG/6YPLZynIa9xydGCk6t5CHxwxhQVgMdyuo53ASfg6EI/IRpDxRsjBD8ochjEtUAyWkEPo/C7kiNMxSeNpTqIsMB+9W049WDxZmVgZ0WTVXtDAolCi1atm4c66UZeCeLyGk+Twnx1qpGrVEUiDij//OExPYtS86kpsJFdJvo0VCU/jVDaJo2iPkT5aNbhxeHcxiX5kRMvxJXf6jr72NhpzmAo0ny2pkkyknUIFkSPDmgpbmlooC0yRzYIsiQ5EjwWbIGrKUEnKVC0g5qz02bO0velzGFXrewemt/sWyWSsSvKlSBIulRBUxBTUVVVQAqPxPqWKyTMbNM7WW5Gp9yTk2VIoXi7ncG92rz/Os/EgaEdbiE8H+2FsOhYT5xQ08f9248Nh+1BELKnBRrpk5a//OExPMq4uKcBHpNZDNlGuulmQh09dmbFnV/GloWx99ymsjbUUjPYZlVqW14XilYjaIFShguLpJKKtb5wuEXmOqowVX9Xc2J3KGLw2V2FnZzPK8IyNeh+1fOc+hTmY7UbO+hVoRv8OR2PZFc5mOHfAyU/4BSrlCh/NbSoD+TyIOZCC8q5jOl4djClGU7y1X1AQmZwE0Po4HMP8WsOsTAnJJhACGR1YHedBczjNdIk8VowEgvyni9QoScpSFD5WBL//OExPQp++aoBnpFWaeRK4f2bUSIUfphpbVD84J1+v0BP35ykCUHTIpuGMxmHkajrbegFDJhcqsl0IgERKCgwNiMNihYlIlXiSOJuEi9/TYnwfc2jLFCSCb9TetwQEq4LJAqg8SIHQC8VCwRRhxoxylnUp/SgTSCDN0CJthjuNFzaNaaCh56qNDlytKRyQt8rRwwx8ssSLAqoGKmYuE4oU0dGFiMijtc3AJCeJNEeqyyEYMsm55E7PgqjWHRVEgy//OExP8wo4KcAHpHkA6FCkT2nReqIxvncpSMnRqueiMOWZL7/4VReufZwJgWo7M/aemM7pOomBM5WT+sg8uP3UThDNgokmkJrBvddWRA3mQXCSLkECd9kkDne3rfjo1mNL42T0qZ0f35fH2v7kVNHgtv9+Or9FcYKffVatVMQU1FVVVVQCEgQAulLpdH5JJpmXUL1S1/ZRRSuHJG+r8n5hL2F6trCEWi0VTklDndAJ4Bi6JZR8LCuFo8CAtLKAfF//OExO8qyyagAnsNR8EtOhNKyy7VchNxz7czN63gb6BLMyp4Tyow9jG5Em5MNxVj6CYn+rEA1MUJBYASF70XQHtGYHgEoU8PanjsgVNwx9Rmz/MWHbCQcv7mX6TS5NajpaVhEXlSiHzOBcbGv/HfuUo26MoI48LA+gDCURDDbYz6JuWAZ7WnzLL4ukI8SLZbNGRaLYXFNFGey5i3GYkFkuo6RcBdE2oQ6EYRJcSQkvcVWri/nYhrOfcKE+cLK9TU//OExO8om6qqDsMGvWaSFC7T9tERFE/5smkGEyjoIyyR6JCRtmJq0OigUIBWjOQOrpGks9v1dfRARUgEQxKJMKBvciSlyuwVNHRC8bC4XIOOC5UsGBISRLgW8bbPpEgwEK7GRv/M3EOGUmeTBRZYeAQAdkGjd2YaCEMXtTW/XT/pAMlquDlOkupo5QwcZCyWocaaMXZSoczmG4nSqEs6dneNIzD1LwYzeS46T8AWwZImghcgk50EnHAPsvhnuh8A//OExP8wA1aUAHpNkMA5w+j9SRUNb9EWz0SkoqRZ0svpoEeaZW/hKLaHxj5eFw5UUl9ihjlSLMsh4/HMdntrqnSFdJaN/olLWPl4aWIipdg81MxaOmeb+MEZYVCpO0TR3SFxWMfU3f+lIs4cNJNq4TW9VCznUGxhoMrIMo28b//6FKjzCVufE8vti/IIBgg0MMluH8spo+0W9QSdOZI2inPpQJV9K6dRIxLifHSykPHrJ83jHRIK8RRQFiYiTKGC//OExPIvc8acBHpFeadnH8HwLIXgurSQl7m4NnX5tqPHV369lEi9pQSZu8XPG/cU97uQfmSQbZxp4Zir4h3xsl2MKFBp8oSKGvbQMq1oS2DcF4iq8iKTIhkXRbiVCDqMP7x7s/ljRyYrBI8z+EYSl9J//BsLenqyj7nw4NWzqG00CPFagMAHgDVAjMMCMmT6YiGjgJ2EmH8h6LUJPFtvioM0T7Po3oZ0PDjOUZRREmChqAyhAHqoF1JMmjTNEyC9//OExOcqo1acAnpRZA5ZE9HNwyCbJw5TSV5VHKP5Q1W37ZEVz9EMoDy5JAgXRu9MwiWelTUQRehRHXEaSI4eSclaie015wpeXgKNSUX26amkuw5cawM2rQncdkK5QKk6BtLCp1gjaRR66AojMcVHjUxpE4yh30xt7pF+/X7sDZ+FIEsfB4taYlBqJVmup///D0FHQg3IXFHGVnYiABhKA0elkpK6HliabBIVC4S+4nrxOgMCUTjIvFwyNCsSRJHM//OExO8yw86crnpRkHEpC2AmFv0wyIBbQICOHxYWGCaMeMPXiU4osX2sHBDPEiWdMBbMSrliEal2Z93ZWlS/i2R1ii0Y9edyW/N1r5I8tvvinmCBCvloWlJyaTkHxMz5QbDe/WtkDoUD7ojWsp1ViLaoczJNaZkI/qpHkY3//VeCx3UkiAYBeCRl9VifUJJYSgMBhkOpldlja1KhrIpm1tYmRPbOhPsC4SKuSzAjIs+0eqYI87qc0YB7t6PnWTkU//OExNcmW76kBmGFkaxyMSMft8I//GotQI76gWih4ETNQv8+8KwpLvBpi5mYLKzNR6gK05NRTDSWmvwQj/ghk771qTxiKWc34x8cmYCRd9jG3+2rf3TCI5brsnJKbnG7GZR2k3qrLYVEBQUHUYMOwsIpMM///5CEb7UDjADInNIgiVOMl88zpS5gzew0PCrROq/TYIAlU1Ztu5FpDcwmo+o3IS7qgMZf5v06odX47KerJouudnrSk5WsP2xBw5dL//OExPAq++ap7nmLlGia+1McgLAWGYgnIp+KATj8OisfZjBRcjfnaRIRbndbl+dX2YJUR+bKzrJQ06EkIEZJLzaJ89+j6xTe/mx69aR4YWMijoOS1wnZOJfLuFWFaXSubr2Dgy6SouWdMr3apn17HCcTky6PX1sKNtm7kHx1ta0wiJhQcHMUGTU7N//+wMxUcCBtoOKIwx5AAkKNtxgKpUsa7lcjzfH2mz/bk/hzbn2oTCwvVTAgFDOfp4IKMZyr//OExPczs+qYBMMFeISdJwTpgP6QiEYkVKlJYiWP9bIWXRUMisB0KYlBkfZFR0HjTknEBJjCGZ6+6UuoRoETWESSy8co3ZomIbUZTX7/u1DpuKiQqQeBMfIyYXQsHTPJgRE+N7SFEImP+MSjqI2KXku9GgZhnYmoBGHCrDAQCiwBAPcNUardtrsUltSC2qGb//8Pf/xVBpJEAGo1fJITpjZ21yaVYjFejoz68rmvK5rYEKb9Rl9qVygeIc3ng2K2//OExNsss+qgpHpLdEJ+aJ6Ma7lZoZ+yOke9SzI5KtuUjWRJFHEYh2CgyyGwi9be/66s/88/r7GXusxKDsK07vv7tRRWdn/9paDdIjrYWiScsSiMrDZCim4BoBcUtBvmFMjLQGWGQQ+N0HLDSDqSRVrdq2f+DQ8EAKFCF8U8aZBOzjuRuGnZbPXn3QfSpUiXZZezoYzGZDL4YhiTwLUicxe5DT/RmEMMsReIuFTQXK8bMcpYrPtWiJCBohbOBRgW//OExNskgxKopnmFcAyadA4WPmD9rxlD2hguwkvkVmP6TQpPSjzlTctLPBO4q5n/SWx1tsn1sLtNm87LSJCcCROzhCw2m5TM/m1HrO/5ChowsRbZS5gwUwpUsb2IbVBcV9qMoN6z9BmcP4WcGCJwTvw+4QUgAAaZApojRWzPtA6qrR28HQqkcdWBgDQmSMVcqLtxT2f2vl1h75K5ayou/M7DzatPWa12CYw4aZjwOQylvW4ujHIo8qxHQR0X3FHG//OExPwr61qgpsJFdG4KW0u3AUivCy0au4sGgQuIwWM6mBxEIjmLkCj45lvUvPOTHqboB4GIcYDMbzE0dl2+1H0eb2JW8UmLyulyj08fjhUyTjQDww1hIOTZGa2fFGZPw73XC4UHr8+A8+ENb1XD6Z8l4/zeRTwFLv7ki36agbWa/NHuKKzt8nx2ukWad41Zdbg77fOrFY8bb3g6bHV2A/3jmLHpDilJAXwm5Es0V2pUUuGpTrtFLhcELQhQDBBT//OExP8/RBaMRsJfiQLOm9tyfXbp6Pxv2ExoW1Lz8K0qsmlYTqMaYWedXGTT7Kk8WobJeeOAQNnTZKBk8sXLmHHk0ok5D1nFjpaTaBD/qC1epTMJIWYVTayFLUdvSystK0cM/9tUzvpZNA2cr4rv7CNhuyVEyokjSlqx0cTyyZDqRzWb//qf9NIeomprt/WjGe/+k4IF6Vz/thQ2sT9TTeMkcUDI2CxQPC1QaftVBAMI/lzZu5HUzpBaO92p5mFc//OExLUokxqkCnsSeE7/XqpVZLGxKkYaFbbLpE4owKPcsiw4ThxzAxWlmkbcigNAIMtUkSB+JZNf21Zl88za+5P/9nMOSgVSiq2X3vWHf7c/WeAJE7OTw6CP6THDw8eEXF8U2Fbi0rh7vuh7Y1U7kV/te+u++7O/9b+rIy/jCCSlhw5UGUHc9iJAAxpT3rQgd8qGAnqbq0J4KBu+VBl2MzNzOXSWVxZ9bemKM4nJjGIS+DVPO9GZdLXSilT5unbu//OExMUjg9akpHmLHC4oBld6jiIQCSUW7NpHXFeu6RLBL9udoaqGeTSv/StTfrmlkaSaAiVe2/+1r/6xdhGyJhTpUrb2ayppJoOVroi6CDXSfA/g0lBFPUf/uzbwjipgUiiLGEjIUF0fVJvM/X9v/t+9w6DoYDivBkCpj9BdjHQ1PlvHpD/IsOtDg4SVj/S5ntcpcy3o5sQ49HA91mg6C+gtBFSVmCXhrLMWgIYEnBrqoyjTXI4x8K8W0A6FKM8z//OExOopu/KgpMJFWASqsa2NNqgvjB8FMEOUcMSOCN31RS3fqkt7/7+JUohrI/pIcKp9x02tRjd3/kEm370KA2KT0hS2cP+HQRfhlOUTQoIbmCFlSdyaJVjwgjSQJKIBoFwB0Qge9g/yBBwodXWgwZAmDMs2skWBlKXSGsy+LXS+U6IIgAcFgOlVQCBnW2OLaf5Il9dKZ+qY8I1IcdX1hUc06m2NcuavcmtpZU8yEuLEBskDIlJSPnRG4cAsLgYk//OExPYuMyqUAHpHdNoiTzTxNvV/JtHLeiaSlNXs/x37Po59131IQknUFI2To2bIxWTz2v0owVsntGgYSqCSwUxyaBBBJykk3JVAQICAUNQgKKg9i0EW+cDqYWd1X530dqSCGK4M4hgTRcI3RmarfmI/67EYaRMgY5KJVQh0U6Hzh2BIFhlSDH4bj7o8pH+i8rYU2aWO9cnbVbl2HJ5KZx6OY7RPk+TfUWpiFRGQUGeqGehqmcT7sPX7KUgs24MN//OExPAq676krnpFPJFWnClisM57pKG78/npTyrSyYhNyazxXLq4MAkRmGFA0TFmxTv4eQ5DiDimzYJCMbGTYgNjq8hdgfrW0DgdG7PGD7I3AnETwKGAaNjAdC2InqoLPEpXRz/wXUVLpmXZytRJI/9kOZleQ/Rr068ifwdApoIG4xajvIpMQU1FMy4xMDCqqqqqqqqqqqqq7OMBJMRBVwmAdDvRNXl5syaNlYgqzvTU6Fm24N0saOG4OAr1KiiG//OExPcvK86YAsJFekxFpPWEETE+heIi0fasUnub2pZ9wiD9zJPq0VQPRV8KQ1EuowxM3j5V//gr+Qf45vv8PNSXm4KiwmXKrwKBKkwE0ysmVyyCmCWyWp6fcv438KEePUqkC5f/1MHwgYv//4ptwKJZ8tVMQU1FMy4xMDBVVVVVVVVVVVVVVVUAGlsZJxMFRDJVQ5NVgzMh2Lh+BIr0WocB+/brJUhCAugnhJaPzhQdoVxIcMBww0NxUyeZgRdo//OExNojW8q1vmJGvJ8uPQzZbVUdtQTrw29e0pOVfr3FjPTGvi/zpaOOK7OXSmwtBP/pVBAtk5q/nlzUkKJatYc9R9t5QlcwxOlm2CuvYnNRCmKBCBAUIZhY7DA2Urdm/73+7//von/nRRoIyQobU4ZudQQBgkw/E0ojIOlEnexIE3RvjdN5c0LwnDpSqFpNKn4zl4kYyQlyE2aWI8TeJyUI1ROibjhehKzdHSyIonilFIJEMVwFuSzOnBUBJgKA//OExOonfAagBmJFWItuExQEBWqQWIzproRGTGORkqNsg9q9eO1JGekdZPUklnT1MlWzy0yY/5xHmFzCFKuXEopWj5kaFNnKFJdZGCKRk5EV6DjVscSAcTnmiKKSbzbZVs0RK0UI8ycIeoJXn///6UIWdroY10JhpTIR+WLz7NgEGV0DWUxBTUVVJEQEAugPHayMGwlpyeeEUc/NIfdQF6APGNXSHr28dEIezeTt4tYPankMFLIbz6g/ZOC45i1p//OExP8w+4qUBHpHeGlk8/nnE7SAo2BQzIZAIKKzHJNsI/9vPpT5vQgOb77vGdkTthX/rTv5meW+6/LW6t7dLcnM2mfM/34s+WE4i5kCtcTd4NmAtRKCl/zCxaixyjizPKCcomacdtSgkvlcHRpAVoSrbhOAAAzWBmrsRhbLgv9EbblrNX/QQDAO62cTgyXXJyo71erN0ErTlA2JC/kuird5XBkpjlBSQ1GoJfp/m6x+at1InLXodaRe0bkRRgTp//OExOknQ8KlbmGFkKEmJzyGTSAPFlGLJ0kRI8+nrv0/Kqk2Dk1lTeoN//TpDGG+ZGiM9JFETGC2UaPNGTZIk0QKqsG0VGlRW22hRYjTKIBdNAGiGZGDy5CaOR6NAkrhtHFtuYeVTSmQ/pL1UOyKQcKSQ6f8O6k//geIYUwUMDGCu8h23i1MQU1FMy4xMDBVVVVVVQ8AAQvp3RlOpDycSDvFyhJmHllULyojq9/SaJu73wXNdrALtVxBYiUPtaeF//OExP8xM9aZRMJFeVg4iVFM3PchOriL6pjFlzK1aXGgjI55bWL3dfcLyY3qMfUDktZFv/++//87mM6//yB52GXnsgjSSxWOll/kj0t397w3WDZZmeHIUYti6nZf+Izy73v+RZZQWLlX8in9FxVizwlJNDgAKAAHAYBgnYeItx+BwsSjYy9CtYjpI4/GVCmZYYWCXcZXXdo4tqXAJDOTS9MiF9oS6vgua7VZ/MqOaHLbOwoZcyXESncONCwrnFPu//OExN8kuxKkxnpNCCqpYp0Loqu5mGqt9Tdal6SlBfPlnv//4jnn/eeSJIMiDPLB0VZtxlxlcFmkdtmh0ga/8F2ZEfQJ3xWaeZuJY8vClYuatXDbmoS1n+m0rf/U5eiMHdx1Myt4YKMP/+hnggTJwSBUT+NGAZTUhsaw6SjMEiVgplzMUt0u5dDzXJZSPvG+Rp/ojBUVjTeo0Q1HmfEUILhx/5luL6O28zRH+n4i0V/Y8BJCHz4+FHFwsAaRQ4GS//OExP8tA/KVhHpFeVWOn68lJ5Z+kPu/0h6KhhxErFFzzLfIoJoSUcf04QteJQp+wiCC4mCg8ZyBQEp4MHATURhrBgmGYIJHUwsLuMVMVDD2hgkPQFSDcbSyMSyWNMpg8Er57lJkAyJLZktF6r9RXyc8e1Me0LgkVHlqNZmvPUxBTUUAGhzHgKFUikkKPM6k1BJ8ShDFpTH8qVyo8Kh7D21KF6b0aIlx0gY2teTkVOqhVd9qK4qRRtbNHhKjR1PW//OExP4vOz6IAMJNWLVzkyPXykUiv67Y5XTh++vTY0moG/98ooqDaT/Y125Z+ckmRTme/PgcdnKcTgSdY7ZnlqBQ5Po25xeoSklL/ylnxzCRR1DEO7inZ6unpR/T87Iyauqt7N6W4kUJKQEUFVyjQ1zBbKoC0DgIRMZcz4s6fYuY1lL0tG5zfSl6V5tbfdpULfhuNHdicRl70RWPLtUzBDn9e1ukC7eSpNsNoofhrcLkEPSyOPjIa+UNuyHp4iAQ//OExPAo6+6UBnmFdY9IjSPsqE7SulDkVVhBFRcUz+yIkNHPNcu493QWU/6JuDdxiXQpyNEB9cweuw8nEKAgqVRxDJtrJ7zwpFSI97E5ELJSPFCZ0SvLoLJM5mCrZL5mHNp6ZqWy/3J7zkpQ/6SHwilVsjug4n/+7XIFAy6horLaqgDG9K2LnUVQmIDaQChU0U8IgslW89rvMlgCQUEQiuqanj0vrS97pp2kGAutajvx1+2wTszAECIHEHDLKyQy//OExP8wE7KEBMJFeBoQlSYFgNeyVD5HwSjH1q7TCSsiAsdSRKIoMkyjR6Go3KRlZNfWjhs8mu6+e/Zb1bF24Lue9mZHRVZG+Tr10d/n90+bRliZvWrQRgqfG3vNMc5DAmIYAZCTmEvjmKF+Yuuv21RP/6+1LqYkEyAV1UxBTUUzLjEwMFUOiRpAV5uH4So4SDlefIky6Od6mH2VGssbSt0FNb0iZbOr0uwSP45ug/ntjQoDZOqJmiJRE2+N2z2F//OExPErC8KIBMJFPZPqmUcJ9dU6stotYE9DgUFgGKwpB+JKAXcKQjBeI0gqjj9PEAs2Bn5SQYK7KfFRCp5xkM9zJV0OEVTjs1AC67qK4K8Gfv3//9pmP8DH1CLGwhFg+//oxAEigYgPZYxD+LocDiIwwypMQU1FMy4xMDCqqqqqAZrgFeIgqy2GSepOT1MWNIdp/qphwyK9JoScq5j7hT7YkNUMNGOZqMMjxOJqGpTkV7ivSu6PxW0cYiM04vOc//OExO0oDAqc9npHDAcDSK1lWXHrI0ORNyFI3yDXZRZ+HuUQJxloHZ/t1v55UBe9IdNBggIQBUy/HNjIGDDBIABKHHY/5f5siEECBBv8RMATPX9VP//+Gpm3L7Q3pbI6+h/UZbQUcYGY+Fe34tBluglSBlVMQU1FMy4xMDBVVVVVVVUGbcgqcUgZhbQai4DCO9XIFDUSo02pzoeKNjSe2KAwWzSLCY2OOZpf5nUKK7SkGiVQCilsnUvrpInYUf/y//OExPIpXA6cVnmHUAKbDTG2hiB6dl0pcTdEGZo3LdCkrNTl4jfmvVRkZ9bfsbykFlYtJBCadinTTd7NkgbUn6pZho9PEXNL0rDcOogc3rFXRxRmaF///8hMZaZnkZ1EnD/6fyFWfQ2xjDSGqhhWWJHIg9UDk1G4FVpWEQhQHzy71qq42jfPAfl2BPle+YFwcbUyvhbH71Xi61PwM5ZRCAOii0vgTGgCigPC4HhIFqVNiGhsHS/TlFXUGr+we3q3//OExPAo0/ag1nmHPaM/UwY0/Dy9bERuU/iqiGjKxgeoadGQXjagkC3C2boRLAuObBMOI0fvvtlNOQkz5HQT0siEbEwCA6nAsEgSDsvpTha2EQCz8IzosJFaRG2cmywMjtagIS/EJDJrw/1hsdRnPsQXYpL2Wc5MYLOOyW+hDoTgaFhajfPJOPQmFLsq0dz5dEtmZv8zMxrXMYCDItElbUmggoAQADFeoiGIWQQ8kYyOEqhZGpTtuISKOyeKy0ie//OExP84a6aIBMPYWHZ4MCaADIGLBhKbG3CA0OL940q2DetgrYbwp0NRXaO7mye+0/3c/eXf/einP7bT8pfyGXfpzTVfSs+JvMomzmYRRg5IGI5I87ORAICFQiTPUNLc2CTEtrC5/FwRmFJy5s/PZkQcxhILBNJsk7Cp0Iq/FQSPoR4oQooJQepcWxZXAqT6aChLJGdNxhEKgWISSUUb3WqsWe2WPPKHKhiKxUYCMOlGl85W3B4WmS1ejYXFdl2W//OExNAlYxKcTnmFWB8vcF+RGwWUSpZNKlTuWPBabOpmVUNLsojRMr0VNVjSJCVFT3IULCFqDdMtIGm09aai306tgPYujUIkVBgIICzwSSNMwNPKkarTyNvR5kukxE+HzIh5zINZZP0KHMCFya5RCnquyU+d74/7nJCVzShgQrXlRRn8ki6vqOrqACUJQCnDpIfq8lCRL6RSYgRlUZb5n8PUjhsrj9NM9l0xIu4QxK7UscZ2l/GfAyJywD1I8QhR//OExO0tkwaIAspNWjDCENIlI5spw2cWY1GB4nn9WUf9trf2MWxi7tVhpdm5JNCVEFIV2Yc91WOvKVoMNLDRrACQg5oUHCMUkEHHK+rSNIci2OtRAAUcIUYEosp9T/E/UqowwnUf+Ju3/8QGOcd6DIMzg1gXj7a7LQAgAqCkKsSUd1POKNjgyCmeKYyFPhGjB3nCjlLSQNBnJ+1ZlMMPEiGVDsva5LpupJaVw42CI8hqKQAYfKrJHK49VW0Ojgp5//OExOkoa96ZjsJFFeSy2grBwHQGCgmFwgCQZm6oVgPHeMSyeTC44hcaD4kYelOzDNIFyRU7MzLL15nV0rfmZmaGRbpaZSzZKd4rTu85n4/c5uhZRpYr9DQ4uXPmFr6z8YdMp0HKEnHNUYUkaot/9Z7X15CEJ6n//cOiIg6CE4MJiI1RZFERIbkGC6oBgcV2FK0VVYGZMjZo1eXStNZL0ODGmdtHaBZmrrIL8Cv/IX0fpvmHtzRaTqWdDD7yCQPQ//OExPoxTAaNRsMLPNPhmE32r1X8qPldjLc35ytvNJJVUpIRAUOSKzB8zMyJwJRqhjrZmxKYu1ydhcbFCk2OCIeihYVZmXWl50c6YFdyU231inzu9H8zCZvnUlll9t+eOpMv81cwl4XS+YOFr9QJseH6janFB0KU3TrLWkgoIkCVoaOQNkUuq//RyizVFhyjByFcgt6ivQn8fHCZ4sClTMjVgkEBwFODpHcvM7AvMTw0XrpRm64ah1Y4kCGhiTIh//OExOcyC6qEBMMLrPZ0FGAwwt4UWFWaaUSNSJ1pd35IZ7LKtqLxblbKB0XfS3EubHCrUlRQlVdwsWNwxxgFqOcTZFJbVCuwXPZkZHPQ4Rl4xfGIyXXkUQWh1Mx3shKlNO9qE5yJmKqq3//IpNX4oyOdx6sCeKo13bkADxVBOTGUyT2L1G1IOWh+NZgFlj8IoSwiE5sOKdXaFqLWGZwOngrFZYsCguQ09+XbZCyFt4u3XrbOTtlC6BvlKlCdD4Os//OExNEh69ao9nmE2J0YDOhqOXI4RxlwIcT8xY0hwxFEhD8egd57HQPWTGNd1OklZqC1tbL+1HSyI6NvPexf/29XskUTSF66/N9ZTCH18jIw7ZzOKavQ0nRQsYlCKIQWEw5R9Ddb4phFiJaW4lI9ohTGSxligrBUGi4oeVRbS3DxMtmFnJehB1FtLknyJaN2arvOhEJUyz6yzNUSJ1kgnNHheQHQxgie/DJf/9HpIwHGmb///zd2boAAwnkFeMw+//OExPw887p8AMPNXAw1OVR8XFto/QzAvna5Wvu5OsHsC2OEdA3u2s5c49Si5tMcS5z7KZ1ggg+ogkNuEzukeyCK3dtroImHV/FfOopK9/8Z//BBLGRb72ftTdkTzS/+zQXYkdSSkgUp0M56pkoldGhSagJk0ISEwy0k1gHzyX/pP/7vKRdjs/OeEFbqFLR6hP//zVMwZ1ovKx2HvpoAgdprL7w3jaX86DiP001WxHI+eXYYrf33zmDFg2eNZIk8//OExLsmI/KcJmGFXOICTk+MRgOI5pCFTGZG0Z1dW0dND3adOluzFnCz/mb/6Vz+qWKuK1U03/+cd/8kKHmqSQyxM1/yz61lKXs3izD7tomIdIYl0d81FHmFe1eP/RlZFtfnW63s98TWX8Mf/83+2vrscoTLPSrAxb+s799MQU1FMy4xMIA2IWUAzgKgmyfXSFrSp50lcbD5lT4T4Kk8jKWId29+erOyKYofBAgsA+8qLiYgBKCzBgUpb9Z0qJh0//OExNUkew6YBMPSHlJyx8qIlBpaTarkjkEFzQdYSvJ3eg9ByFldZro3LoJVY7UVgf5hKg9ZLHB9dpCP6OxHRtMS1uLMg1RAdeR+qnv5JhSstR20l0PuR+wtUko9xY74H+PrWvofJtcr3/xHlCcDT/qBgPoACqfL/MyVM9IMK6KPjcRoxcxnzckTSsasLPoonOzV9npehr0AtY6+KXKxrEFM8eJ335j0hbk9NZ/3Gs387luT/t8XkluDQn9JjKFk//OExO4oa2KZlnpQ+PMoUBNElFBNgfOpiRpCy8xMj4eR/oOqoLjsWzKpgygyUOfoupLKFiI08iPybfNvZMALjB+iq5WB6KreSGa2AEnXhkAolCyQ1RLIjEn/WQn+8gSCIWBRg9UD5h6ixSg/dGEt/UyU/82pmfmJ/wmHhERHxAA5R0T8MwGE4IbJ1MNERlZn1awmGADq/jK/ggq7HRljesqnpfOP67sFv9JqGCXRTdbxxaDJUtJpAJ7ZXH0Wn7RF//OExP8w+7qEBsJLdFceHjJNZBMbl+p+f3K1IcsPiyJiUxahigPEN5c86KP42lhOf+cfuCoilcC2S4Hi2KgjYbyRJhP5dKYO44CjMGmXIjgShAckTLnEjMZhR/DK55BPVMWx1L8p+Fw8ZX/+FdlH5RwELOzWUNIhlfHMILQvakxBTUWqqoAF4yStA10+S8ZxK9EEISHoegb46R6iSi2q0SGz1R6h0s1jP2Fo1GDBKEo+4ticT1kTZ23daXEOIo8J//OExO4rKwKIBMMNEDFzjJLEDUgg6aYVa7tQbCpx73ZnnPN1/8jvxBIJ7g1BvvRRIzl2P5EJkGCmsqVnRluScZTQVoRK+bF9eqrf1VtVmrT6VUNPcT/Hf6m3MfH+n+N/avvaf0pqGCjKaNyGpfLU0a8S9tUK2SNZEpbzWFuip0Hm4ImOQ6iCqvBKDShoTTGWqnemyiTOIfHsqEUqXaMNAHIkj0Og6j/PEVrirUfIxYTjgrTvTqSuhLEdwIjrMg2c//OExO4oS+qQJnsQsECiRYV8ZMI/R6IwfRi6AX9wO4gmQN/9dvnLJLJ0ypyaJCzIPGeusU8CCxaXJHsn1fUCEkIdLqEKGHJn4v7MEIwkRsGquciaEMlKkRCvaupLse4IiJdtL1G5MRnlt4omcc8XjHJDxZmSFza1AM9nQiL5KRzCpUC0WVDmtsGSfGBMRYo82Sp3Di8MZSdwZDK5mMP3boJFDbDIAgGs8cruv077Xpf2xHZeCtqkZuZoGQREJ+ST//OExP8tosqAAsPS0m0sJlXCyBeeHZHl4zghQvoFF3VVWx/astIzuCqNmyQTuQEn4DsIW26eufQN/WzDZg9TtbMezSB2cvhQAhXdQlmGVuzcmFhSuwucQt5HIMKNEBoAPnHHGjtSdehmLvujJZ26mb5fvWYowVQouz+Yk2F6udIIGUWcUgxFbYgdDMMOkizLWaF5mBtu/LHokNAD2VQdG2g283YbD8jg8JZqHRYH4D5URKx7HZIuWlkZy+S0qxTy//OExPsuu8aEBMJLWeNIkV9tsncsTs0jGgQpOLvbhhGWih5mdJZ1yCUWNM+0lqtpBa/tt2KdMifS2dSUW5ZVBpHH33eHUg/ExWkbigJs5uKGOPuc8f07YnX8ri8t/muxVouuG8mxQdsaRW9GmdLPkg6jJkSqSyoEQBUBxS3SA1gysgsd00Rn+g5srHY+gmZJGoBhuHYCooTSzNJGIRu3K5A4naOZbxjj4QqzTQ3GLsSn52zfuymMcjzErUZPsRHU//OExPMqcuaEAsMStihoUrBlGtKcHuJYSkqYSIhtyImZNrJ4k0rIvf6sq1/Thc9SWyM5OKxjH/ZN65zrlXTS1Eo36ZixJPoY+abMYZE38juorZjCYHD1go4nFDkOHcjq2t3yRjxiJ6szpsJIf/lEUTqSIvA9BZ4GxDVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVEKMQNXJO8JRzULlyAZHSxExUpj1AdbGZ//OExPwtW8KIrsJLdHvQKWy+mWRBkicNJGIvBhpAu2Ray/A4QYFIvhVRGlxVT3Oqv1nSQQylQaiWMOFzp25Jf/4RUoxg6GzdboaH3Y4OWO9goRWw907B7DL2WxAxEWs57HJHcO1Vf/9+9u//dTa3/v7/9CpMQU1FMy4xMDCqqqqqqqqqqgHAUwQUaSpe69OwNjTI4nQxx6leccx+YTLEI8MThCLq+yzD18RwoC1JGSkZVaWwFA2N6V5xrKnTA4qV//OExMsfidqptmGG9bR/XOW2cJ2+dL6sX6KrbqNBP3hsjpHDhS0j8xrfFwgHy8djCZ93xBx2qmc3V3mih1FFjzpKbH+6B1I4ZzfFVkjoz+sZjIFS2OLWx5pSTQyFtqxu1T90dI6+2fTPCTzDHBM+SS4//hwAGCzzIpCKZYk09wVfp2pnPAvRukDyEv5Wd9NdxKKG6j8NambNuR14zB76IeulDLcIhKJmael5LsTlkaf1/4zSw44k32H6ZOKAo8Pz//OExO4og06QFsMQvIkrCR9uBLguNkKRARkBlYUGi7jDfPNdMgRtzYX1OUXJ5T5mH+Evto4o188UTROx5HEMfxLE6qKWGUShWeCsnn3OJ6VRtPOMzOQS7gisSSRHB1CPw7Tv0fkZNjK7o6EcikpZMhCG/CNP+GD+CAga4ODvIntDLPtTBIAQYNBiKA3UWmMIR8cFQlORdTt5x1i7cVjxpkkhdqSrqlscYuyWjoG6w/FC8Wi6ZaSgtWFQtgdLTTpv//OExP8uA66ABsJFdWNTwcCurE8qKzM2fMSmeoqJTBi7hMXqC1Gd0SHqJmkqUrbp1Fs0NsPnSmqQDgtWRq7xo1ol5tWBIWGaGodU7Mv6/f7+tLZ1EjibhV+rPIWXDksm5/6xMhndSxfpKDYMnFxgoLBlxYJqsZ2ZP+dMNzjTjVnMdfU+W6t+hGLHw1tvukxBTUUAOMQLAmpwUtpgCElNBdM2pg6Go01JmLJ8I3CY3LrEpr1pVIuxGHLk9clla7Ak//OExPoyA6Z8AssPP1IwICBI4EQOZCUkAnlySNsrPNwgyakozuYUpPQMw1pwtX+nkl/1K1GV3QXftm4pTTS0j5Xf7Bk/2yYdRm+E9Y4kvcOm+v+qUrs5TdPmO7utlKe1Ov/6kKSOEBrqBM3QxV6YX/nT7QULMzi2Llwk0AP5BpXLwhVz9xNsTAl+gxAfuGmGQ3KlK3soPgV+W/e1YRSct3HFcSF6GaKLuKctOCIyCak2dwmxGBbOcJhCSl8xVmSZ//OExOElO9aQBsGFPMPo5M31rvw6w2WYCqorE5TDRYsdeKyDe8VDoys0o3UUSWB9Gh3XFuXprVarLBT47Ka6cLCAodqUsKjLZbiMiwIgfYcqvaeLrimh4YRnmtKYkR5KJrjGLU+lk91MdHKPi9xC2Km3etZs7JnqXLQbiG911yJEggmxVGzEgUkMl5IDAoFJKSMGCLhkS8QAxKKXlHBhAoBbpsiLUCUKVyYktZgmO7bql35cggYgyJJB9BkHH0kV//OExP8wKzZ8AsMNPDBdawqeTcV4sCQHMEQKGkAYbtJ+I6K8c9pjoQ1SQDPs8YhNM7lVI2eQOhFJlujUGcqxwNRunpza8FSGD8HkfmTy2ccyhd5pDEF5xddjpMMQ0YIqRs0BuJVLKNdRHkamlx2XaYgySVNVZ0vNu7X3lc917iIbT43DCnbNmzOY9UUTTrLCM4S1HjrOMISQy7GIOituAV3psGE5esucPYRjQGobLtWSwAvvI5QuRd7LVJJ5KIPM//OExPFNO9JwAtYZXO6LDWItBdrJ3JM40dGaO6hu0tWZcMwsI1t5obWI/clBmEZXEI0gjo06okvnx6vfM1yN1cVUc2mWfmZx+VU2+ZTrFZ67AICyd6nRrOrXiBX1WZpvtziqzCLFEcW5x9JYMJSFmnZhdQnJ3hFJCTEnBtosIREgbRrkqesOVnPU9Qv1tAueRzb6bZ1Qt/qmrf/3P/yje+k0rb89a3DsGZBgvOQGDMKPb79/rWbuSpu9vvwKk7zI//OExG8o+0KcBHpY/rYDBDO7nGphPZN1Cm4nKoDiFbQyaU+jTkdx1a17ES9Y9Ft2opeZlZ083NfgmZtHcSu//0/WgABTvJ2pWY5xkL0dJJdyePEJYmZYvNC7hB+Z3tJZnr/akVrrEeNLAioXHSLCeqvGQ+RihBA6KcmbV1NhAvWkm6RZI6onWZ5inPP1D/f/6l/BedbyBpjcFq2akOC5osRFdTRfkP/9x9IHykd9oohIokY0KsZRAJhofLCoVEhM//OExH4qVA6cJnpFXbuz+OggeCyhAjIip1l9S6RmyFv37Vj/Kj3Lkezt5f//0/lF1MQg8SO1QCJqElAALJ0mcFXHuwtTAgTHmCRlk4EXCVVWC6ijqPT0AGd5IWmQIEmlijxwY021L7lIEvcquZ9LzeZ7zPv2vzcye2fP//JsN/cNupf+Zw1OZGnRmZzmR//5bb/0nN2OkpohNiIZZh/b6UVONLtibN900AggBxQd4GAwGBqSHrGmf+f1iFacNFZG//OExIchss6k5npMMAsABQF+ElQ9pWULQDCIshxpH01sSuPZo88diebi/z43S8kETHFAQoHWBIQQWJBi3NXoogsFE9R3RG3YHX0lsxcTQdRU9zTIlS7oXFKzSIr2S4cgYmO7hBBh0UO0Nnq7JdpAgmjWQI0dBhxGTpQtiDc3Pakxic712Rhlr8q44FAkpITBgufVILCxd7vKQQYLmljvIREABU7oiHKxTIpP0HcXpGTqOWZmjzv4kjk2Ylkktk7F//OExLMkuuagxnjTHM1yyIMMh7RN10UlmScamyXZpmZLgq85rnArlJcFNw5HKt8qK8x2zEHkufWu2O85VZH2pJxRVNXroTCSUULBUlOCpdlYQigMjAWeHwJUAMKlEgDEYGVRECR0BmjJ4iwwlNYhdODXvKvLy47mRl4w8cyVotjFLUX8JdWMIoclP568v83br1cNiipO+i1gcOviCrpAFMJkLaIHabqIY0KGseEC5oJNXtdnVqmewwLWjv55ZIk9//OExNMsK96gxnmS/SDM8Y8ZImCVhA4GJMkC7Ho2NTkQCwrEEc6DSw25DZlGzzLpMRFWGlO2TjvWpn4resz7NkkxVh6JlJB8yRY4zFCsw5mRQT0+LZxHHTqjFKRnsKTAJmKjSQsQlYlASVgkaNPdEILJopj0vSac19NVQADAexO+XQGKiomeLJWWNGW7CHHfuH6SggaKy2Wrk5Oyq9JrtNTOC2fcRq8p7sru/UpK9aLXNpUY94TPshh0bXQvfUFU//OExNUj6rqYJHjTNKLQMNrS1ahnWglRWInNH381+mrqElZviyCeeLMMkhJiZUKFpIj6XcBYKWrGiKY7nJnLHtMPKQnIFj1XEMVkneZkZ7UieaQZHUXo0qzk4p//w24+PY+3/U18xcO7l1///8cNQnzsw9mphM/nYdUAxlK5pTLAqNfDR5xqKBM13IXrTUJLxrOWJFZDOQyy9+YnI6sgYVDLTrz+Nmd2USyBpdPzxwpMogIyQqUJiFJMTILIkEMN//OExPgsY96MJsGXVApyCfN0gWQom+igurr+bvI+kCtsYxEvie3kWZZVWSPyjj0TndIlTV/piCI49WU+wcUeFTB89s1SjZEZRE6qImtYmRaCuokaFC2gIHCg1vDhD6IQGPN9COGewIyPx+fpb0ZUVPjDwMMcNk0Ai2Rb9prSlkqys0XOXkMIA0MSJhVi8FUlN1NJjbiu2hJafK3Gh5vnxaU+cEs1huC3pdKVq5gaHXYoEiBAZCr7LoTrQjPsjWIy//OExPkr8z6IBMJFPB7kaTeunIhgw5ya1RTQ43lHzL2F0UDy702Nsz9aN0Zpdo591Nohs8sIYUKzRO+cfBhnGDhMUNNGOUSLm0O1Bkw10xJ7lR1RG8lc44qHxAB3GsKsJVIVB8a3zk+eYuivOq///+gkLnxzqbibKgDEJ8LUhLCUYuE3BJFmYKWJb0BREgiGiihOibpxmVuMwZ84u6sw1l4ZPL37d+A8niUefVgkqqUEGUj9PJF4tVJJrUfwQIC0//OExPwtC+KEBMpLPqyxAMhZ33vm6BYI12H94JIfTOjIfryXA9euWY3Zn4oaHaUBThiq/+BE7AkYRQYKBRZjSB6SCBxBI1lSfRyQkeWsKKKC0igVAAwIIiqxovHiI8V+zZsaZuZyuznNTVZfqjSGX+xhBiMzvHRC9TMVTEFNQAMJSAwA0K8cHNeZ4uFtUi1/oProRKaQuKkcqLVmnuyzm4+tt7oAjT909f4boXoht2Yu9cxZkjtQMp+WSDEC6UIB//OExPotQ9KEBMmLWL6BCk8P7LE2dd16vaul6Wy41qqas81lZBUu7f+nDfUbXU8JJxx9Kt/uX1ijmImVGUSXUMQvU7QtSP1Bta5poGZQY85XH2YKxR7zlCA/xhjwrVKuDR+zCfm/latP/oRoNDL9zMCNQHUOiikt5SkLjDToS31MZRAxVQzlHmmaKexDSHoauyfl0PxQFoHt66bpGMo1KWTModmenRZE4g5kPKM/AkBbDPN0nRiRYR0o5vvNY2Ju//OExPUqHAKIpMpFWNvE4/ggRwOIFdWgMIWl00Y9EYKlMVSswvnlFbqYVOJPqrVmhSKECDKHyQi8MTsPkhzLeWNwDnWbMljio4yG2AoThVhoUwpgcbEpv4w+EHwQIGGkzJChFp5c7X6evRelv7r+5RlmyhVf/593t793pizWQ2AjCKr98UWqTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqhAkKABTBMBIQR6LI2b5pQDvfnlEYiXN5cpYHOoWCEjG//OExP8xS3p8AMPSmCLhWiiJEwRvxPkLlNtD6UnazQDlT6Sv7mVmOxO4q9SKPUKrSVK7+pG0b+xbWIdT1ezvu6KfQyjulSXdDyOzQZYtK9SbcrsRLxBzXuaGLCgaVGVthAVg6/BRSgAeE3qYFWxCG80WUfoILNFCDJKBT4MRGgi7qcbstxFhFa7bL3vMANQSmgtebjr8dWLqCNWhlEqUQ4sA+8jh+OPu1eUM8kcYk1FI6ZmURjjeRV4VISnOCZY5//OExNMhosac9npEvGWDxaVD5cntA867Qm/Dq9d1nPz67M3dnaTM5e6idM+L6MySkoII+QazK2OTjl95Q2WDJK2oRZVXiNvjM8bkp2HlcVU0zS5CfUzM3vLmWHn5AgmKsI1YOmD44eFE6JMO6ycqOZ6MSRVkZ6Kvt/uj1Le7qZ3xElVwCkJqBNElP5VikDcP07EkdYxgcxCTLAzHTeMwEZW3sMxW4/wgSGFgP/E7dvM7LuJDcIbuFEgPmRho9eHN//OExP8wW+p8AssLdwf1kRBP89MtlIEMSyUcJ6f4JNv/iSZPfzI//VoHgMyfT/8R+Uxmb/3URjqcnu8t0RQzj1Q7e4dV79y7GXOPldwkKjHGPZgwvbouvt+qlu7AGPqhF0GGMh1iqfwq/Ahf//9zn1z/gQAEEgA6RbLxLGRVbVg63E2S+L6g7TT0xV3JHl5ZTZtRpd5dNk8ORtx2CL/XGBTrTkcvdOAIckVRWN3ycukuLTM7IhMVMGzfsmCMyLh4//OExPApbAaQDnmHdNJ4ENeiIk2Zg+I0KZPLZm9iBcrq4U2XdcxRNPWLKTdW8tw0xY/xcEBhfFN1D7BYl/8UrMgRGBgeLbHZM0zXuJCwsfBwwUoaah67FJxp5Qrp+YEtXSdRyJDByCBNGn1Ft/9tkadF577mnYdRicn/s2WUMe0X/OakyRvOCgkR+sE6bv7A2GGFwH3gogXATOm9EFAh0jGNgPsEAhAeCXRxe3BaJarzeMVcH+MVEk0UgcaqY0C9//OExP04PAqIBsMTPJ0uzT6LawpFXoa1lkXl41I1OIYeBwDYl0RNOEjWM9AmS5TLUIK2iyknIFTe3WGTAeQbvbbDROiQEkYpLrvQtFs9ttybTgkqTTQs3Pz8kVaZS9XU3NQ3OkrfLIsXcmoqhZpliLvUmsT91CzfMJWY8goKCFRJOOZ0MyakoBhMZ41f0bQxtDGoGy+phJE0MLHYlOxEgAAL5KcBDBzD7D0nnJ2iwwF4QJm7QtKWlRwXPJxCHiZC//OExM8re86g7HpLPDYgwWYgw/mA5XIjn1EYwOnGWUlGWpZkcNzWfMEVpHK01OyCkTZKcc1dBVE8pI0OnzcwZtaKS3mtI261TpZZA4b9Tv/rW5fZRuddpx1O3s2g6Clz7mCk5kZJUT23WggzdNa+aGecRZN53qea///PmA90icUCwxHebGjEuiZFw1JNZqZppvM2wABdYABQAFxRgEJg1G4gGowgiRZGRDhYkaQpJWVLymcbCyBIESdLaI1qDA7Z//OExNQpxBKpR0xoAMssIk6jD0pAUmle4oBBFhnCa2oKoKiKX2tv/g8dOje1h+HxVdRS9DSIu6zJzlfyJW2sxt/X3V7HJZK7T6V3qsP6+8MvvNy2MRKenYccGOQfKpbIZiMSuGdyGfkEum3yk/YrLoNo6J2mxbjF+WRiUO/lJrr0NwjkTppiEPq+sbmMak9F4rFMpBB8atVu3oYh7le5eh6QyCaztQJI6Z1pTf5agS7OxuUZal0dpspZykqVN6vZ//OExOBIZC6NpZjIAOP6k87K7sOVqCrS7uX7Vm/ycxuWr2rl7mFSzX3nc/Hf/9izhKputapuYc3KO2a287l//t1N5ztPzW7ExSa7r7tfOoHQGjHQAg7qkgCCm4RRRGaBwB9TsADGEAQ2LxyMMCM/R3cQxQdHiPUi0xgj0ABgI8S1Dw0TOA2phHiMqM6gwDdTKqFcT6DEMH2wuTObTWzts6sLctoZCyUJ8IguZk+6sSDNlaUSUyet4rWrFejjhYGJ//OExHFDxCKeV5p4Adtj6VUti6am5PXhUcT8Vi/HY1Q9VEZ3Gdw5Ltz9WmU/jsjFGZo7aumJxfw25YMQ651umH9cy6SS6ZmGK867V7nCjucFWU2fjajVPFanqFsa3qCzxFt4rWLSucoT5c4vnTC9zF3Kzs8ed7SLEo+vSs0ShbFOlWPMD7kcNzXgZa7f+E9kfNU9exPt2szZg23Tf8GPAjR4uLbibiVgeBEVAYAhNMuJYQk6KQgnBdyUFhVZvJRC//OExBUm2oaUBc9YAZdB1bU7dBix2yOybFA3QBclgljcREVXjqHUTbJ216lUSpaqvGy45V2MkgjWZUpdI9J86uyGc0aQecmjSbpfbn/ZtnFn7nO/a7Se5ku7jqFKccPqU5JFZVS3w973tmHUdT7cdWwOqJU1yZcrSuPdfl35CBxWXwZtGx3+13O5t7/enbWd9//4dS8ZCtmaVbigqLgo8QK1NThYVmqh/rtZI5D925+NXo5B7Lou2eKPs80MqQQs//OExCwuy5aEAMJNMIq27kNyl7dVyIPPIyZDo60qamQGC4iXbgQqrjLycoKJpwakkvZWpMZCRgndMrLqNY3ggCqBLAViIwaI0dBrFMEl4Sk2U+QNEq5Ik1RJDL67GhZBApg5ZMiebwogDAjIcDMJDQJyX2os5jzD4QJDfuNmPz4xznr+W3Ixry+862VGy7fWn/5zklRiRpx2CnK1KoAELiiLzL2UOTykEdfqOPcovEI66zAn7Q5LoppTF6N94Ogp//OExCMoMyKMJMJHNPW1Owe7js0i05zJ2ohhYI70rbJ3IXlKRyTSBIz2oYloXQRkvOSd7Jnev3x1Pwm8+lVSED0kOrbiSbN+ffWJ9XEmAsBg6f4MWpNCgoELAgKiXHHBjECGE+BGpY8jQsNAUBR1is9Klm+SuX808FSykB0dIOWGe5WR8awqdA0sYgCG/l4W9UUmGlwSra97wO8+jdolEo3KohjhL43EH9vbsXtwzH3lYaGni+fy29KlhpA4mjKZ//OExDUkcsKQBMJNIvJAnp+h3s2ukx1nPj9MDot6gzfSNfSi/7N69rKJMlaJmFa7tyWU8cs/JyCePccsvMc1f/ctTq11LdTthRef1hFpmTPLe990rx5goeBMMtkIskVUPTCx/d5KJ+j+WoABQSAYSFta7SA+zjMc90PK7munVCSQts7cn32Yo9TyNKr3PooEcDChrubcsIGsvmK5ol9W75iod+5aoAhKTGYmX291eXrTulsuP31Ppc9A+JVj7f1q//OExFYiY8aQJnmLOIl+3+K7TdtkfxLpSqyhLcx0jw+ETNHf+w7QmZDtqads7MPH379rsY/qjW/6L/SYj43IYboKagF8ozSwI89l5XugVp7zuXC2kS2w/UPzNJagmf72nl9/GlztyUrC9M7V5YtZSZ6TdiplPMmHbe1x4KNAaQV9Srnwr4rJE+ramiMOEHM7Jah2RWJ69DndSMHnYhEZECLiimEqIikb+MxMlg96CKwIOcR8QJGPHLEaNn+8IMJq//OExH8gkoacNsGLLHqARmqAAPCUiQhkRiyV52nqPxCBbi3QDhV57o9SqF/GbI3Y3BDD+VD2MTM9BjTQn1W6gHVmKTDJFeHXpOYLMhTEyBoxkRw9/KH+79Ikhpz5TlPy8iAdzb9ndQJbXhUKjmeHgjFBHuJd1MxPYoPUhymorVt3a3X9d0f5F///8EOhTNRXBIFBMWg40hyjg0xBTUUzLjEwMKqqqqqqqqqqqqoAoABYOil6rmXylkqcLao6HQ6q//OExK8iRAqYDnjFOJxVqCKy4ZlbqTSuYbKF+g10H6JgOmjP1mCwDgxYpthzOOznDVSoMX6kRWopSk/jxSPOUv80bsYEWQJJ5fz8mYvQ1axij+7oHwN0CihpidwOmghFxW9+9IWu3cqSTfmV/8izCdPFMP1MQU1FMy4xMDBVVVUAGHeOOCNWZQXOQ0dxISVOqoC/EFO4+zPaN4K7yQQ51iOaicOR9+F3s+XmUAkx8TryuFRunyrQ7bnbfd9CwwEi//OExMYeal6YTsPGPGkcaY5IstmIKZLUMbbZbt4Y4n3vc3jvP3/dApA+TT5Hf/b/++rgP7tcApCET7VzQQ8ECjDJpEMzUlnG4igXnt6oewyuVe16zGh1yydZ5Ex+e/p9QsqZw+8X/n//VFR/fUJtw/6f60o5JYlLExlP8ISmIGhAAwBheik2VFlkmIaSoLAdoTO3YeVw4fijow5PtRd+HVDkJb4s3VSZjc5QuI5SAIVTIqaohGbTy18sJyfC08oS//OExPMpm66IBsmHWckaRoqQo4LsvckTSXYNoyJPCg0fNjRAUIx80Z/OovA0qiBiuZii0hteSqLwQGldFugE72A1zghMbHKMNicjMCcAyNmJkjTTMm+RwkuLiook/WE2Y6kQILLzUtyhu10KfQ+DQdgyMDxBw0gOOoFcBYqtNNUBwP2SJwKyha7IG0JABoZHlFhuUQZCTQJfhYCUJR8pFOfSZOAvRc2RLpxSknHsjkSoVMrojtlKU9csbDciJhdA//OExP8viuZ4ANMTJLLLh1BKQy4WMkcrhyrGpMIhWTbOH51TW+9Jdhnf/yrHnNhEiSJtZSJjLTFZ+7Vx3T/kmRLnzRVCTHdIRo2CoqLENaTUSkhPFYnYFJZGq4f+tyhnQxjHENpXdus8G6uyUaJVsHECQspu7ZmFTEFNRVVVVQAacDHJhGB4XRZmhKWHSiJAtMXjQF+78Qhlm8pm5TOT0up5HQw8zSFKOIrI3NMtZ9luFW7B8tnss/k8subzrfKZ//OExPMqos6ABMvSeB3AXoJoyCMWYtS3i09GOeopCUG3/vf/h73+GSQL/NPJZyEVl/9AIj97Vop2ABjAb3Z0lpkKPlAs8ihl9EvwgQy6KzoUWSn38m5nXRGtc7yrPpsdP//+Hl0k//JLCKjwpfyRTU/lFRUJTJFgq1iIECS5cVkwiCOWmWrWW2geWoFISHNQlRh/Mn5xgGUMsgxrbkP0u5xGtqEO1SSqbdPISykZDI/iUiWYGCVoxeONgSKMiPbF//OExPQp1AqEBsGHdKWrEpwqidMm1y9upxFAcNYecoUzzlOTylezsLjip9Leh/Q67VXOeTbnBIHAw2br3TkJwPlIQEI4ZfWNEvllCeJ5mOkm7YkA0LByoxcX7m69gnltEsAu9tzQxwxg7wU4asFOeR0LDehDhD3pvVbS8cLwWeZXx39p044K9yTh0PYzH//87ptsZM9cMlWf///O4CvZ4DJBf0p6axApLPCm4hUIdxQdI12wEVQJo6hjN4QlysK0//OExP860/Z8AtMfP9fdrkXXphBczalVH3KDcJQ7DDoQQAWHHCo+mah8m8OQiCw6Jp6Vj5WvKiU6mFqH2XHyyHrRX6U4zcOLJWF5kx2m5kqH1cdzOKX0JJLzaEnOV56wbKSdEWUh0WR8JS9Wlu2J1v2oVQvJRdR1YL03i9mlBQwpVOhJcWJs2oi6wRZ2I3TuIcPM2GBGx0MLaTVVoShjaapcGSMeI3SeHEaYtjpcpEMYuZCT8KZdCAF4jqHEFOHy//OExMY9m7KEAsMfGYpSppLMMFcq2Cd1mpVJ3SjmWUbBj6ja3m8WH2x/NiHCtG+N3+K1rCnEsQcpQWkvaOoAJQekZcUGmUrRaLlQlZBvCw942OpeKbqaYvE+FmVVK9j6Gnk0OUskQvQBM8hxhsqnKRCHNmfuCvYla3k8TiDUbO1SqWA9mQxw0X1WrlrZk+qkeai6aPaIrYCshn5dteO3F3EbdtsilzBo1K6K34gMWWd22nYlmtFiYoYzCdEOVpIj//OExII8W6KAAMPZPfhxNb0lJ0tp6kFYT1K4x0IKU1NwFlijzJNTmkxMJgl5L8tFtVipkSZ5rBfAwjWU5ywmmyhQlxiFJiYDi5cqvtlQAI0YK/40dPj0Yn6tfZLGtzMWSXFxkc7Z7vZtHN7bDW9eysMzuR0ypvfs0n0epNUj8PXVoZ4qZQ2LIdVGFtO+PQfKHE5lLmWxixT28aSkjF2UWYRDbpNVR6Y7O00AzGNVoeTkljtd85jumNopPjNY0WZH//OExEM0w7KEAMMNPSMaicuNRNWIae5fPjeXUqg5QpH1QjPDskr4v71CHUuPyj1DudJ0aFFmIzJSWkMsmw0HDgNSKDVBnlKctAeCcMDiIPA4EgFUW6iHp85JxEhgJS8cOMD+h0WoY4Hi5LCEdUUKNQ4QlVkRYhMKNgDHEeaFKc4Hh0PjNPlzfiPNyW+PL41SvGh/82rhF1ag6b/hCoACGxr1TkaGuNY5UDaZYYgXbir2pcu4xLToq0s4ltRE+rXK//OExCMruwaIQssSyHzJOfls/A+pPyae+2iPokKREZXYmxhQSsySkUjJBa7qFtNqwNOhjSd3iqOCa2obuMcLkuTX1L2h0nPRiSviRkUYMITCKJYTSV9EERBEDhGJQijiYjd4hVGgjEdaaJ21jsEzARscw0KW4u3txmkyhRSjNOavl0K3qsvpJvMTLEAkWFHXqHVoHbRRtV3WABpvkj2vOMNIdBu7SIcZfJH9d+OPvKp99p+vrHsZmq2tV7cdgFxJ//OExCcnO+6MBsJFPSWcbmeeCEYbN9pS20dOQX2KmWsvCMVG4zjV3Pt+LOb0FS/9pV+z/hnfB7TW+5v6pDmoqdQmSofJf0qERPzSRKjbWik2RI1nrE0adSAoZl2lUSNVNnTXRHNoxj0IipTH2mmipkbRWey5UXov31X/45FeSb8M3RUgAWBcWLuDDrTp552I3HnaTATtVH0pI09tBcu4ZUNDuxyxIL0pyv9ldS1vNE6CNUjKcJU7myrMKflXVFqz//OExD0kE9qQDsGFPDMfPGTGzD3Sse///8TR109e11nOi3uH1ck8rP6uN4iD8siSWfo3XSgme6BFudndKwMC5K+5XcSjFnVmN0f2r6Eehvkv+n+r/8IUowUGgmeLyshk1UIIAFg+ClqdbkoIVhnVh18g5Cw8eHgPyujLJ7J5Mbhl3+hrf0JxycaIKGh5v8krbZHK6hgjocqGO0OYICS9A1BBXDVJrqr6UMbKzIhkLdAajrICCERBVTI0GBAxULAj//OExF8ixBKQTsMEXJwE3SDGhxhRRphixsUTW5We7Ma+nzlStZ9VZGZlW/qn+v/G0VI2US/8O3hHAM5iV12mvLERoUysSRj6KDnxCTPECYWDR4mDWPLHA3TcCBYYCATSNlrJiwQDEm30Tms8xA9BibUgpzknTJBmXKZbP//yr2eqJ1pOvH1ZdoENTLYyM/OK3lcyUsN7vQhAQLTqI47qWX35/JP31zf3UgTUWEEVR/F0+mwXfh23Wb3MtfNwBh9B//OExIcjmwKIBMpMjLYLIxaj6vNqEADSPaVatjKFYn8bZ+IAY0xCkpX+lsCQc/Vu/YltnC7hck+ENZv4/du5LL9JR2YAYg4t5nDmtfQw5WZlIO2wyZJGHZ3vIeenWsyL28eLxinuPy/35usa01hREpWN/bKOW+yd/4WQ/JaaKURUY3k5Hle99KgmXw7omcjGBZmP/+8Gp0c1fm////kGwTnhXQTVgAHQNIbwzWE31kViQfG8iFhHDbchYkYFSI7m//OExKsjy96MJsGFPKBxVEk2N4GuTNtte2DqskCvSZ8KpaFbHN9LYywnMoGIVQbLKa/dHMytT1HZBlVmQ+RSo5wgEDiUPkeGquCyrYGPc0OAoDeDBQSsNOlg9ackzXtTVur7v7OyOpdmUE6qzQpEgbYDBFQbFkxBTUUzLjEwMADOiHMqMDAC8BQaXaSZoFGEvhIUxV/1epfPcnpQNme2JUMHUd6clUos2pLJ8vo6OA6aKUAPCoBBm08bHlZswQJI//OExM4hA1KQJnpEnN6OySZ5N7EBvwWuBhKm0STKzOR0mXluXDP/aJd2wVihqruDf82W1Tm2tL+pV8xK1pM9AsjrOYtJc50eHJYhqmHuxFc4RTfKoCEURI7FEnVi9RQrjBrSvHEbrune3///RRiVPeDyHaEBxFYGNLtLDjBDx+LFR6v07mLDQ2yDKWpqTShZqvx0Y/fdx/oEdfcEY0cLmn7hm5k0KxhehuafuU2Y9erkjLT2JbFahyMHhMPpoxda//OExPQp87qABNJLPFjhWeIz6SiU0PVRJkai5Pltf/rxQrroSGLqZuG0feGDGbRfTiJg8XagKx7olY3HtorKsIhE5cw5CQnVrR9zJMaShR42SCpGs4gdSCkzae0mRTZvf4RlqTN+W9CBFco+kYPjodKr7nf/+PUe5l1dR4kMSHEJ/LkJjHS/RaoEDp1GEEjmFyRKFQdlJWP8GaSIM0Xp0o5zRCbZXy5N2VDVGdj2FEbnkdqdKSqHJZ/uiSFhYYT9//OExP8vs954BMJLXOP5HrxGSICY6Yd22WoIj7Ltlik9VcixyZ2B9jLPf9N3SQPREKDz1VFiScC39PVSXLG7VmswVG2uqwWFLK67HNkpG0jLGmWWX79dNgp+NtQO6lSJpN7qipN1mfH/7Vful/3NGDbypVyVuJmUfibvQlUEAzvGjBCwEWHhCCELFAYESTSpCD5FYEQRRFPgHFHacyKJvvfMsfsYyl7piidqMSKdfOlxZZBNuJWMJZDEtv36aHQb//OExPMr0xZ4AsvSfgSPAnAwKDCgoMIBCKyNIwoa5QFMSI2RKfHioItxJZnxpLqTiX5FGmEPScu6M+o0tPnuuiJBGfTxFNNJ9MOQEkIrIBzpxUTIMTJEQnXLHmcfI6KMbeiRjkYMMl5PjGe9EphroU5rVmJKQnBObN/t+ixMyb0Sqd9NL5ODYK/YMGws1jdX4NECzVsHLFBiRmqJxJbBFGYLvZCgnBeCfjaWkLRJmEkVxuO1Aomo5XyDYjAIPofK//OExPYx9BJ0pNJFXIYEomJ1lCgmQb0ZMRMIRBriNcxCOPYN+K6FOaZ6KZ8upaqI6/4k1nShHfVVZbESFZZxL9rsQIldatPbWG8Pp9Rh6SNCbIRchJoGSddQlbEJZAK5gwRB8QYYQq4JzKyFkiOAuSUJSZDNH8Qt6iZYuaJWDduluJL0jvWN2Mcky2qbaxTxhJDKslGDbKWrWp/LPSydTxu5xjLr1aepxVVgHiWnNcJ3l0xdGxw5QvtICBu0saj9//OExOEyo/Z8BMPScS35fQUmeU/uHKvNGYMNRCoMDVpZk6xXN0zDbydXBf7CFU5zeTdMzWldAGxB/8qHQtPhbFkZGBno7UYIo/SFnAMzL6xWhgN3yBAwBAZjAQyhMFhxFCAPXyF45vmSQjYp1C5/+hl+xko6KsPUxp0yA0nHekWEK4qPtSoCxtw8cWy0WiUUBLnFZquRAx9GeIxvM8dA/1HWf2MyGXwPNVIm/8nh+FR6LO9TQznh87GqKxKnbpIf//OExMkjm06QDMGG9CSZA2k0teQ5NiFA5zCqJ6G54hW3104Nod/9bJ/t6Wd5Ovl/9DmsnnnkNuhTRV0V/BZFEgVtOnt6iyLmztYqRPJULLCJEsTkFLiR1GGoNIrenyGDjUbpXkPuWLf/9b1JrOhCDan7TXimmDlqgW6Lwf5/A0Qf6yiD6eLqCEjABVQHBVJcx0XjhskIXmdl3maw+8bImtoAryqJhsUoRGfYWXcVyIECVlJG6bNqKayFFjD2kmxg//OExO0s09aEBMJHXdpQMqT8ofNW5mYeJeZQlvOCYus36MzaFbFLr9WypWF3abaYyUgeOjF50kRKGkFIJIiRlDTTfzREKjUh7qKmRtUX9eVfUD8Y8yb/Q8d+tebUR9VFN/F1f//37f1+z840vOo6WinDP3UA1ZDOIx7Czm4tbBTxHsIyWmZW19O9JtH5pTpMPZLAD85tZjUPOXK4EhqEOVSxtlUacpdWbtVm7tKvPY89RlTX4hHoxUkbK8N1ZRDk//OExOwn29qM1sJQmduhLMoekzwyuAFTQgkCB8+QqQ4rKGgwQ7/PejCn2TnHDUMSUzqJciGDZ9Nyr7k1IRgoK0mSrGHRPEpszwYJjZOJ/UkpErxbja0RCOQREgqBgV+5qZ8Pm7LIU0C8IemTcOcM1DWkjm+oZ3R23Svqvv6/quK53ECygiR+IUxBTQDH8CkFLkjGmRRGUGHC40ASCFcqKrDIkHIfuIyfMYLi5AUEs4nkRIAMoCCGI08RIzxxYQox//OExP8xw9p0BMJFlOxkgD58ISoWtKr3WGIvxa9yLrT9RgeTjJv3OV1X19T/nBR/ThH5nyCz9PdAvBb98iFg7FNms5O1aNZwlaMqTTDL8xphDaDEpJf/EvtR9+aB+hUmJ3KFyGBpVIZVRu+RtQFgdQPOV0pMQU1FqqoEBznGxGBTREQNC9GgIBoIg4Ov0KhSz6YjoNLhmHo17oyt445aj8xHpNBfy+9deDGN/L8Z8KldQD4NmFyExBI+CWF1olbT//OExOgm6sKABMMSgF0aFRRH6crU6RKodyqpfNdTUS1ofbqrutTF0L47NH03JbXOeWxIXJPGE/zQkVWb8C5Abkem9DeqMd7X4jJF0pq+c8lkJ0K0gZAUwURWhtEzLS0hGVWS3f0lsb+p+qO5BVSlVtnMF9NMQU1FVVUAzngxkGh6/yWMCAkYOji46ZRdJXSibnw9A0LcF+qKOPPhnRQBHK0mdqY077sxWOUl2lgdI4iUAeRhVyIUFg2ySpavLEro//OExPkrO+58pNJFPP2usg1YnJn2aljTfsQ09Q/7TzVZMNfvukScdWSV1hZ8dm9f+s+849c2iSmfUJsWoURjrZF7hDCKbS7enUKLz0VJazkNDBXKIBIxlB6ImDrOC34xbHWWjr//tk0mdwYM8Hk7mEstCypMQU1FqqqqAYnAKgCgH8IMshaMupHhJ8v+tF3mlpZNycpfkpoIg/c3cu3oNtyy1RN3jVenj9HfhdNbrRWmoMKGHY/RSuL27Uk56U8J//OExPkrC658BNJFPCDDsJQo8kkSX3fTN3LhWfm9ZmmrQo3ePQAcdVUhqakmQelpPkG9rKneyyaeezTsK6SOYmtHVETCPrOJzsS5RKH1CWMT/qyFOQuen/xvLhmfnmX+ifG7mZs0HNEJwg+j5/LSlLpjgFVMQU1FMy4xMDBhgYAMoTeHWkq6Kgm6RZ0VbHUZ83sDPPE6sQxbZ+bNEGSNKaS8e2PqlHqmuQPbKiRxQNpJKRqkzSu9G0ilLE6HlpMV//OExPgqzAp8BMGHd+fZhCZl0kEL6zyksx7TdD/IMf/2PwmTxj6/PLhivP86eY/6b9yqK/aHjlNahxRO0IxXPy2T767ZpJ9uSv9v/tWOeWt4jpyTAedCtlM/oFrF74Jj/HV+6e+N/7MnCPrsVunfZvxJ2J0gAHLhNwHsNuw8vzFgMMtK9SSbM0Ri+Ty0klX+68Zm4HgSHcL0ef6hrUFFWiNHZqw9WzpZbjC5uYlkbiRIItKCRAg82kN3k3ChJgoi//OExPYqc96IVsJMzXOQnlU+s6MT1z21vCnoW021s9Mqq6SUeVbehY1ciw6gTXJmjyK17f5oVnke+9FAzowcQ5H0jMgcO2bRErTM7tKTe2fUlBjSkmd/9JQg/5fVy4uYn7mEJikUm4QwMeHmQX+NydBZvIVWFkVEFtIJfIoBiRIcuXM0ZCDQCUWnqBM/BiGRsGf6GZuGYxDzoPJiG/EgKTIRIJBQWCxtCbUIIlguJUa5AQDKD0fVE1DCsUbYeUI0//OExP8u6/58RMJFXIqVzC2NvQlVmJ3ZCHospFFS6e9PCvT92opvyhmQLFlqXCBI+dwgGLU0q/8mninuRSaxl3JMWNctCjeqsRCQ5hwuO2scQHdeE65f2etfmO37TX7JyVZzuTeeVpzuf33/f////6wtFFZY7OZskd75LGxz1m5ABUOYAiRBzI8U6aIqaKAGIWnhZBDLsuxJnYZ5Pq9dWjIokA6RyQmjZ9ZAuloiAhziNoVPgUwg7SwkHVSc8FiE//OExPYtc+6ABMJM2sC0BAaZUIjsDSinFKJVkSNihCskJCN71l1k8g151gjwUhxtE1AFDwADjgL9A1wkDc8i5ED/+VxG+CJEFlFEJQ7l5HYqFz+BQUrOmQT39mSI0ox6qd5iWMR99/3Bkf+Ueyd5/6rf//+9///+cU/ZVJm2OSomXj9iXie+eEoJ2Ob4gwDjJugrZeohItZO8PLIgm1abKG8dyAGhMNgKbXey4cpzwBK46UxkU4TsGhjD4/q7Xq0//OExPMu9BKAJspM3IZFOCTrNLn1CkWxIJpwyVV60rpXVKwtdEeQHDSMJ/OlB962CTuZxhmkcbcCV5k4Qm43lZ/kS9pTKO5PHzy1LB2y8ulCicNzjruUXnS3XmF6yMWNvQP/RQlPD35jN2ykoWRMvd8EU0pD917jHwzjLYAE8KOhkBv68TelQ0mx15R6OipMQU0B4ZTAU4kiwgRl40VmCrpZS9jz07MZe/buwzPU8S7rGcqMiaccacdZSukdYgUJ//OExOouEu58AsZYThQgZBuSCQgo1JS1TYdtWdJjJ5LLPNQ1OVUU1zUkIK6dSp8Lf++nV82im2Vl99bJzt/T2rLHnzE+d2uX6hJdeUOIRV9VJFebYedvm0RQgeEoiBa4LJGBNxU+FXhmQ6TvRqZOh3nmZaoAAICAAAEEAAEGGuqpicsSkwojGUow8nGYkplJeBDkxI0MUKVjGVg7yJkGDABgwmWcU6fYmAJFVM3cs6jyZFq5Xk67iMQiiWicd9lL//OExOElEqqMBVhYABHkrZcwIAPCRLxVTcRU7BHSa9Eo2nK1de692vrCNkuMNZ0rdAjou1ALoK2w4/S9UGmHLshcDPW/kZTsgODq7qxJ/mVWXChUaiLwSd9X4cqRsvmJY/LYnQcGFRzN1oBeB2Xqd9lUPs5fWLRpurXWmrGjbO2f2FoNOgKmZ3E3zhxy5VYlMGSWd79WpyGp6mjsVhmmktSVw28kBRS3LZ67KcqSdqNFjcfht6JI6UZiMpmsprC9//OExP9SBDptr5vAAEUdfaLQE+sV7Kq9iU8719Zd+FWjt/lhz+67zf6wv/9advyW3cqa3njU3jrLvNd/1mspikbdqJyaGZJL3aj8UdmUS9wpfRQzQS8RFgQIExDLQrVsX31ZzPuCzl3Z2tGo1LsJVGqbuNLjzzM9qr////vVVXc0iRpyJGWOAQCRYkSrfn//aqJEsaq1zQUApOaRRyiRKfVVpoKAakijPqqmZ/qv///6JEsY6q7zNeZn0SJS1VWv//OExGolUrIkKdgwATNeZnGOJZCCnxfxNyOhP8F+KKyGQgpsFO8Fd//0F/E3I6Ed0F8FNyOyG/FqTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
