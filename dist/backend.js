"use strict";
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
const VERSION = '0.1.0';
const DEFAULT_SETTINGS = {
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
const NARRATOR_ID = 'narrator';
function narrator() {
    return {
        id: NARRATOR_ID,
        name: 'Narrator',
        kind: 'narrator',
        addedBy: 'you',
        aliases: [],
        voice: '',
        voiceName: '',
        model: '',
        stability: 0.5,
        similarity: 0.75,
        style: 0,
        speed: 1,
        note: 'Calm and clear. Reads what happens between the lines of dialogue.',
        gender: 'unknown',
        muted: false,
    };
}
function num(v, lo, hi, dflt) {
    const n = Number(v);
    if (!Number.isFinite(n))
        return dflt;
    return Math.min(hi, Math.max(lo, n));
}
function str(v, max) {
    return String(v == null ? '' : v).slice(0, max);
}
function bool(v, dflt) {
    return typeof v === 'boolean' ? v : dflt;
}
function pick(v, allowed, dflt) {
    return allowed.indexOf(v) >= 0 ? v : dflt;
}
const MAX_CAST = 80;
function cleanMember(m) {
    if (!m || typeof m !== 'object')
        return null;
    const name = str(m.name, 80).trim();
    if (!name)
        return null;
    const base = narrator();
    return {
        id: str(m.id, 64) || newId(),
        name: name,
        kind: pick(m.kind, ['narrator', 'character', 'persona', 'npc'], 'character'),
        addedBy: pick(m.addedBy, ['you', 'chat', 'ai'], 'you'),
        aliases: Array.isArray(m.aliases)
            ? m.aliases.map((a) => str(a, 80).trim()).filter(Boolean).slice(0, 12)
            : [],
        voice: str(m.voice, 80),
        voiceName: str(m.voiceName, 120),
        model: str(m.model, 64),
        stability: num(m.stability, 0, 1, base.stability),
        similarity: num(m.similarity, 0, 1, base.similarity),
        style: num(m.style, 0, 1, base.style),
        speed: num(m.speed, 0.7, 1.2, base.speed),
        note: str(m.note, 300),
        gender: pick(m.gender, ['female', 'male', 'unknown'], 'unknown'),
        muted: bool(m.muted, false),
    };
}
// Settings from storage or from the panel are input, not a promise. Every
// field is checked and anything missing takes its default, so a file written
// by an older version, or edited by hand, still loads.
function cleanSettings(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const d = DEFAULT_SETTINGS;
    const cast = [];
    const seen = {};
    if (Array.isArray(r.cast)) {
        for (const m of r.cast) {
            const c = cleanMember(m);
            if (!c || seen[c.id])
                continue;
            seen[c.id] = true;
            cast.push(c);
            if (cast.length >= MAX_CAST)
                break;
        }
    }
    if (!cast.some((c) => c.kind === 'narrator'))
        cast.unshift(narrator());
    return {
        enabled: bool(r.enabled, d.enabled),
        ttsConnection: str(r.ttsConnection, 80),
        autoplay: bool(r.autoplay, d.autoplay),
        prepareAhead: bool(r.prepareAhead, d.prepareAhead),
        readOwnMessages: bool(r.readOwnMessages, d.readOwnMessages),
        narration: pick(r.narration, ['read', 'sounds', 'skip'], d.narration),
        saveAudio: bool(r.saveAudio, d.saveAudio),
        voiceVolume: num(r.voiceVolume, 0, 1, d.voiceVolume),
        soundVolume: num(r.soundVolume, 0, 1, d.soundVolume),
        reduceMotion: bool(r.reduceMotion, d.reduceMotion),
        directorOn: bool(r.directorOn, d.directorOn),
        directorConnection: str(r.directorConnection, 80),
        strength: pick(r.strength, ['subtle', 'natural', 'dramatic'], d.strength),
        tagsOn: bool(r.tagsOn, d.tagsOn),
        breathsOn: bool(r.breathsOn, d.breathsOn),
        soundsOn: bool(r.soundsOn, d.soundsOn),
        soundStyle: pick(r.soundStyle, ['voice', 'effects', 'both'], d.soundStyle),
        intimateOn: bool(r.intimateOn, d.intimateOn),
        findSpeakers: bool(r.findSpeakers, d.findSpeakers),
        bigMoments: bool(r.bigMoments, d.bigMoments),
        prompt: str(r.prompt, 20000),
        decisionsOn: bool(r.decisionsOn, d.decisionsOn),
        decisionConnection: str(r.decisionConnection, 80),
        makeSounds: bool(r.makeSounds, d.makeSounds),
        soundSeconds: num(r.soundSeconds, 0, 30, d.soundSeconds),
        autoplayDelay: num(r.autoplayDelay, 0, 30, d.autoplayDelay),
        extraThinkTags: Array.isArray(r.extraThinkTags) ? r.extraThinkTags.map((x) => str(x, 40).trim()).filter(Boolean).slice(0, 20) : [],
        debugConsole: bool(r.debugConsole, d.debugConsole),
        cast: cast,
    };
}
// An id that works over plain http too. crypto.randomUUID is missing outside
// a secure context, and a self-hosted Lumiverse is often reached that way.
let idCount = 0;
function newId() {
    idCount = (idCount + 1) % 1e6;
    return 'c' + Date.now().toString(36) + idCount.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
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
// The formats whose opener and closer are different tokens. `needs` is
// checked with indexOf first, so a message without the opener costs nothing.
const THINK_PAIRS = [
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
function escapeRe(t) {
    return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Tag names from the reader's Extra thinking tag names: letters, digits, _, -
// and :, so a name can never be read as a pattern.
function thinkNames(extra) {
    const out = THINK_TAGS.slice();
    for (const n of extra || []) {
        const name = String(n || '').trim().toLowerCase();
        if (/^[a-z][a-z0-9_:-]{0,39}$/.test(name) && out.indexOf(name) < 0)
            out.push(name);
    }
    return out;
}
// The thinking Prefix and Suffix saved on the reader's connections, in
// Lumiverse's Reasoning settings. Read at most once a minute for each account.
const boundCache = {};
const BOUND_EVERY_MS = 60000;
async function boundPairs(userId) {
    const key = userId || '';
    const kept = boundCache[key];
    if (kept && Date.now() - kept.at < BOUND_EVERY_MS)
        return kept.pairs;
    const pairs = [];
    try {
        const list = await spindle.connections.list(userId);
        for (const c of Array.isArray(list) ? list.slice(0, 40) : []) {
            const b = c && c.reasoning_bindings && c.reasoning_bindings.settings;
            const open = String((b && b.prefix) || '');
            const close = String((b && b.suffix) || '');
            // At least 3 characters, so ordinary punctuation is never taken for thinking.
            if (open.trim().length < 3 || close.trim().length < 3)
                continue;
            if (pairs.some((x) => x.needs === open.toLowerCase()))
                continue;
            pairs.push({ needs: open.toLowerCase(), open: escapeRe(open), close: escapeRe(close) });
            if (pairs.length >= 10)
                break;
        }
    }
    catch (_) { }
    boundCache[key] = { at: Date.now(), pairs };
    return pairs;
}
// The markers a local backend can pass through around the reply. They are not
// thinking, but read aloud they are noise.
function stripControlTokens(text) {
    return text
        .replace(/<\|channel\|>[ \t]*\w*[ \t]*(?:<\|message\|>)?/gi, ' ')
        .replace(/<\|(?:im_start|start)\|>[ \t]*(?:system|user|assistant|model|tool|developer|human)?/gi, ' ')
        .replace(/<\|(?:end|return|call|message|im_end|eot_id|endoftext)\|>/gi, ' ')
        .replace(/<\|channel>|<channel\|>/gi, ' ');
}
function stripThinking(text, extra, bound) {
    let t = String(text == null ? '' : text);
    const alt = thinkNames(extra || []).map(escapeRe).join('|');
    const pairs = THINK_PAIRS.concat(bound || []);
    // The channel form first, since a channel block holds the other shapes.
    t = t.replace(new RegExp('<\\|channel\\|>\\s*(?:' + THINK_CHANNELS + ')\\b[\\s\\S]*?(?:' + HARMONY_END + '|$)', 'gi'), ' ');
    const low = t.toLowerCase();
    for (const pair of pairs) {
        if (low.indexOf(pair.needs) < 0)
            continue;
        t = t.replace(new RegExp(pair.open + '[\\s\\S]*?' + pair.close, 'gi'), ' ');
        t = t.replace(new RegExp(pair.open + '[\\s\\S]*$', 'i'), ' ');
    }
    // A closer of one of these with nothing opening it. A closer with no letter
    // in it, such as *** on a connection, is also a scene break, so it ends
    // nothing.
    for (const pair of pairs) {
        if (!/[a-z]/i.test(pair.close))
            continue;
        const close = new RegExp(pair.close, 'i').exec(t);
        if (close)
            t = ' ' + t.slice(close.index + close[0].length);
    }
    // A tag closer with no opener in front of it.
    {
        const close = new RegExp('<\\/(?:' + alt + ')\\s*>|\\[\\/(?:' + alt + ')\\s*\\]', 'i').exec(t);
        if (close) {
            const open = new RegExp('<(?:' + alt + ')(?:\\s[^>]*)?>|\\[(?:' + alt + ')(?:\\s[^\\]]*)?\\]|<\\|(?:' + alt + ')\\|?>', 'i');
            if (!open.test(t.slice(0, close.index)))
                t = ' ' + t.slice(close.index + close[0].length);
        }
    }
    t = stripControlTokens(t);
    // Angle and square brackets, the same name at both ends. Skipped when there
    // is no closer at all, so a message of openers does not scan to the end once
    // for each.
    if (t.indexOf('</') >= 0)
        t = t.replace(new RegExp('<(' + alt + ')(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1\\s*>', 'gi'), ' ');
    if (t.indexOf('[/') >= 0)
        t = t.replace(new RegExp('\\[(' + alt + ')(?:\\s[^\\]]*)?\\][\\s\\S]*?\\[\\/\\1\\s*\\]', 'gi'), ' ');
    // The pipe forms, with either closer for either opener.
    const CLOSE = '<\\|?\\/?(?:' + alt + ')\\|?>';
    if (t.indexOf('|>') >= 0 || t.indexOf('</') >= 0)
        t = t.replace(new RegExp('<\\|(' + alt + ')\\|?>[\\s\\S]*?' + CLOSE, 'gi'), ' ');
    // An opener with no closer runs to the end.
    t = t.replace(new RegExp('<\\|(?:' + alt + ')\\|?>[\\s\\S]*$', 'i'), ' ');
    t = t.replace(new RegExp('<(?:' + alt + ')(?:\\s[^>]*)?>[\\s\\S]*$', 'i'), ' ');
    t = t.replace(new RegExp('\\[(?:' + alt + ')(?:\\s[^\\]]*)?\\][\\s\\S]*$', 'i'), ' ');
    return t;
}
// What a message holds that is not meant to be heard. Square brackets go too:
// left in, ElevenLabs reads them as voice tags.
function cleanForVoice(raw, extra, bound) {
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
function splitLong(text) {
    const t = text.trim();
    if (t.length <= LINE_MAX)
        return t ? [t] : [];
    const out = [];
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
                if (at < LINE_MAX / 2)
                    at = rest.lastIndexOf(' ', LINE_MAX);
                if (at < 1)
                    at = LINE_MAX;
                out.push(rest.slice(0, at + 1).trim());
                rest = rest.slice(at + 1);
            }
            cur = rest;
        }
        else {
            cur += s;
        }
    }
    if (cur.trim())
        out.push(cur.trim());
    return out.filter(Boolean);
}
// Splits a message into lines in the order they are read. Text in straight
// or curly double quotes is speech. Everything else is narration, including
// *asterisk actions*. A paragraph break ends a narration line.
function splitSegments(raw, extra, bound) {
    const t = cleanForVoice(raw, extra, bound);
    const parts = [];
    let buf = '';
    let inQuote = false;
    let closer = '"';
    const flush = (kind) => {
        const text = buf.replace(/\*/g, ' ').replace(/[ \t]+/g, ' ').trim();
        buf = '';
        if (text && /[\p{L}\p{N}]/u.test(text))
            parts.push({ kind, text });
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
    const segs = [];
    for (const p of parts) {
        for (const piece of splitLong(p.text))
            segs.push({ i: segs.length, kind: p.kind, text: piece });
    }
    return segs;
}
// ---------------------------------------------------------------------------
// Voice tags
// ---------------------------------------------------------------------------
// The words a line is made of, without tags, case or punctuation. The
// Director may add tags, capitals for stress, ellipses and dashes. It may not
// add, drop or change a word. If it does, the line is read as written.
function wordsOf(text) {
    return String(text || '')
        .replace(/\[[^\]]*\]/g, ' ')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}
function sameWords(a, b) {
    return wordsOf(a) === wordsOf(b);
}
// Tags that describe something seen, not heard. ElevenLabs cannot voice
// them and sometimes reads them out.
const SILENT_TAG = /\b(stand|standing|stands|grin|grins|grinning|smile|smiles|smiling|nod|nods|nodding|pace|pacing|paces|music|look|looks|looking|glance|glances|wink|winks|shrug|shrugs|frown|frowns|blush|blushes|blushing|walks?|sits?|sitting|leans?|leaning|stares?|staring|eyes)\b/i;
// Tags for sounds the body makes. "Breaths, sighs and laughs" turns these off.
const BREATH_TAG = /\b(laugh\w*|chuckl\w*|giggl\w*|snicker\w*|sigh\w*|gasp\w*|exhal\w*|inhal\w*|breath\w*|pant\w*|moan\w*|groan\w*|whimper\w*|gulp\w*|swallow\w*|cough\w*|sniff\w*|sob\w*|cr(y|ies|ying)|scream\w*|yawn\w*|hum\w*|purr\w*|growl\w*|grunt\w*|snort\w*|scoff\w*|clears throat|hiccup\w*|kiss\w*|yelp\w*|squeal\w*|whine\w*)\b/i;
const MAX_TAGS = { subtle: 1, natural: 2, dramatic: 4 };
// A sound performed inside the line, such as [sound of a chair scraping
// back, someone muttering "fine"]. It may be longer than a voice tag and may
// carry a few quoted words for a voice in the background.
const SOUND_TAG = /^sounds? of\b/i;
const SOUND_TAG_MAX = 140;
// One in a line is enough. More turn the line into a sound collage and the
// speech gets lost.
const SOUND_TAGS_PER_LINE = 1;
// Keeps the tags ElevenLabs can use and drops the rest. A tag is kept when it
// is short, made of plain words, describes a sound or a way of speaking, and
// fits the switches. A [sound of ...] tag has its own, looser rules. The rest
// of the text is left as it is.
function cleanTags(text, rules) {
    const tags = [];
    const sounds = [];
    let out = String(text || '').replace(/\[([^\]]*)\]/g, (_m, innerRaw) => {
        const inner = String(innerRaw).replace(/\s+/g, ' ').trim();
        if (SOUND_TAG.test(inner)) {
            if (!rules.soundTags || sounds.length >= SOUND_TAGS_PER_LINE)
                return ' ';
            if (inner.length > SOUND_TAG_MAX)
                return ' ';
            // Letters, digits, spaces and the punctuation of a short quoted shout.
            // Square brackets cannot appear here, since they end the tag.
            if (!/^[\p{L}\p{N} ,.'"“”‘’!?-]+$/u.test(inner))
                return ' ';
            const clean = inner.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
            sounds.push(clean);
            return ' [' + clean + '] ';
        }
        if (!rules.tagsOn)
            return ' ';
        if (!inner || inner.length > 48)
            return ' ';
        if (inner.split(' ').length > 6)
            return ' ';
        if (!/^[\p{L}][\p{L} ,'-]*$/u.test(inner))
            return ' ';
        if (SILENT_TAG.test(inner))
            return ' ';
        if (!rules.breathsOn && BREATH_TAG.test(inner))
            return ' ';
        if (tags.length >= rules.max)
            return ' ';
        tags.push(inner.toLowerCase());
        return ' [' + inner.toLowerCase() + '] ';
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
You're directing an audio drama. A scene from a roleplay is about to be read aloud by ElevenLabs voices, and you get it first. Your job is how each line sounds. What's said belongs to the user, so every word stays exactly where they put it.

The user sets the tone. Maybe it's a lazy morning in a kitchen. Maybe it's a sex scene, or a fight in the rain, or somebody bleeding out on a stairwell. You direct all of it the same way. The scene comes out at the strength it went in: quiet stays quiet, and a brutal scene keeps its teeth. Don't add drama nobody wrote, and don't sand any off either.

Sex scenes are between adults, 18 and older. If one involves anyone younger than that, or anyone written to seem younger, don't direct it. Send every line back plain, with no tags and no sounds. Characters of any age in scenes with nothing sexual in them get directed like anyone else.
</the_director>

<what_you_get>
A JSON object with:
"cast": who's in the scene, and a note on how each of them talks.
"author": who wrote this message.
"lines": the message split into numbered lines. A "speech" line is said out loud by someone. A "narration" line is read by the narrator.
"rules": what you're allowed to add this time.
</what_you_get>

<reading_the_room>
Every tag comes from the page. Read the narration around a line before you touch it. If it says she's hiding behind a door, she's quiet. If he's three drinks in and grinning, he's loose and loud. Whatever the text shows about the moment is your direction.

Each person keeps their own voice. Check their note in the cast. A dry, clipped character takes bad news dry and clipped, and a bubbly one doesn't turn into a brooding poet because the scene got heavy. Two people who sound different going in still sound different coming out.

The narrator isn't a character. They carry the mood of the scene in how they read: low and tight when things are tense, easy when nothing's at stake. They don't laugh or sob at the story.

Mood carries. Once a scene goes hushed, it stays hushed until something on the page breaks it. You don't need to re-tag every line to keep it there.
</reading_the_room>

<how_to_tag>
A tag sits in square brackets and describes something you'd hear: a delivery like [quietly], [through gritted teeth], [deadpan] or [half asleep], or a sound a voice makes like [exhales] or [laughs under her breath]. One to four plain words.

Put it where the delivery changes, usually right before the words it shapes. A reaction can sit right after the line that caused it: "Sure you did." [snorts]

Keep it short. [low, shaking with anger] works. A whole stage direction doesn't make it sound any more real.

You can put a word in CAPITALS to lean on it, and use an ellipsis or a dash for a pause or a line that breaks off. That's the whole toolbox. Words stay as written outside the brackets, typos included.

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
For narration, the speaker is "Narrator". For speech, pick the right person from the cast. Use the clues around the quote: who's named in the narration next to it, who was just talking, who's being answered, whose name is in the line. If "speaker" is already filled in, keep it.

Dialogue never switches owners. When a quote really could be two people, go with the one the narration points at.
</who_speaks>

<sounds>
When "sounds" is true in the rules, you can add sounds for what happens. Only add one when the text clearly shows something that makes noise. Most lines don't get one.

"sound_style" says how sounds are made:
- "voice": the sound goes inside a spoken line as one tag that starts with "sound of", like [sound of a kettle starting to whistle] or [sound of gravel under tires]. The voice performs it with the line. It can even carry a short voice in the background: [sound of a door banging shut upstairs, someone yelling "sorry!"]. One per line at most, under twenty words. When "narration_is_read" is false, narration isn't spoken, so these go on speech lines only.
- "effects": put the sound in "before" or "after" on the line instead. Describe it the way a sound designer would, in under fifteen words, with what's moving and what it's made of: "a ceramic mug set down on a wooden table", "boots on a wet stone floor".
- "both": a short sound that happens while someone's talking goes inside the line as [sound of ...]. A bigger one, or one that stands between lines, goes in "before" or "after".

"sound_hints", when it's there, gives the chance that a line describes a sound. Lean on it.

Breaths, laughs and other noises a person makes are voice tags. Sounds are for the world around them.

When "intimate" is true, sounds can include the noises of a sex scene between adults, like skin on skin, kissing, wet sounds or a bed creaking. Keep them literal and at the strength the text describes.
</sounds>

<big_moments>
Set "big": true on a line that's a real peak: a scream, or the confession that cracks somebody open. It lets the voice swing wider. A scene has one, maybe two. Most have none.
</big_moments>

<new_speakers>
When "find_speakers" is true and someone speaks who isn't in the cast, use the name the text gives them, or a short plain one if it gives none, like "Bartender". List them in "new_speakers" with "gender" (female, male or unknown) and "about": a few words on how they sound, like "gravelly older man" or "bright, quick young woman". Anyone in a sex scene is an adult.
</new_speakers>

<clean_run>
A scene that already sounds right with no tags goes back with no tags, and that's a perfect job. Follow "max_tags" in the rules for each line. One tag in the right place beats three anywhere else.
</clean_run>

<your_answer>
Send back only JSON, with every line in order:
{"lines":[{"i":0,"speaker":"Narrator","text":"...","before":"","after":"","big":false}],"new_speakers":[{"name":"","gender":"unknown","about":""}]}
</your_answer>`;
// Pulls one JSON object out of what the model wrote. Models wrap it in a code
// fence or a sentence often enough that a plain JSON.parse would fail on a
// good answer.
function parseJsonObject(text) {
    const t = String(text || '');
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : t;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start)
        return null;
    try {
        return JSON.parse(body.slice(start, end + 1));
    }
    catch (_) {
        return null;
    }
}
function cleanSound(v) {
    const s = str(v, 200).replace(/\s+/g, ' ').trim();
    if (!s || s.length < 3)
        return '';
    if (/^(none|null|no sound|n\/a|-)$/i.test(s))
        return '';
    return s.slice(0, 160);
}
// Finds the cast member a name means: the name itself, an alias, or the first
// name of someone in the cast.
function findMember(cast, name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n)
        return null;
    for (const c of cast)
        if (c.name.toLowerCase() === n)
            return c;
    for (const c of cast)
        if (c.aliases.some((a) => a.toLowerCase() === n))
            return c;
    for (const c of cast) {
        const first = c.name.split(/\s+/)[0].toLowerCase();
        if (first.length >= 3 && first === n)
            return c;
    }
    return null;
}
// Turns the Director's answer into the lines that are played. Every line of
// the message is kept, in order, whatever the Director sent. A line it left
// out, changed the words of, or gave a bad shape to is read as written.
function applyDirection(segs, answer, cast, author, fixed, rules) {
    const log = [];
    const byIndex = {};
    const got = answer && Array.isArray(answer.lines) ? answer.lines : [];
    for (const l of got) {
        const i = Number(l && l.i);
        if (Number.isInteger(i) && i >= 0 && i < segs.length && !byIndex[i])
            byIndex[i] = l;
    }
    const newSpeakers = [];
    if (rules.findSpeakers && answer && Array.isArray(answer.new_speakers)) {
        for (const s of answer.new_speakers.slice(0, 6)) {
            const name = str(s && s.name, 60).replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
            if (!name || name.toLowerCase() === 'narrator' || findMember(cast, name))
                continue;
            if (newSpeakers.some((x) => x.name.toLowerCase() === name.toLowerCase()))
                continue;
            newSpeakers.push({
                name,
                gender: pick(String(s.gender || '').toLowerCase(), ['female', 'male', 'unknown'], 'unknown'),
                about: str(s.about, 120).trim(),
            });
        }
    }
    let changed = 0;
    let missing = 0;
    const lines = segs.map((seg) => {
        const d = byIndex[seg.i];
        const line = {
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
        };
        if (!d) {
            if (answer)
                missing++;
            if (answer)
                line.note = 'The Director left this line out, so it is read as written.';
            return line;
        }
        if (seg.kind === 'speech' && !fixed[seg.i]) {
            const who = str(d.speaker, 80).trim();
            const member = findMember(cast, who);
            if (member)
                line.speaker = member.name;
            else if (who && newSpeakers.some((s) => s.name.toLowerCase() === who.toLowerCase()))
                line.speaker = who;
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
        }
        else if (proposed) {
            changed++;
            line.note = 'The Director changed the words of this line, so it is read as written.';
        }
        if (rules.sounds && rules.effects) {
            line.before = cleanSound(d.before);
            line.after = cleanSound(d.after);
        }
        line.big = rules.bigMoments && d.big === true;
        return line;
    });
    if (changed)
        log.push(changed + (changed === 1 ? ' line was' : ' lines were') + ' read as written, because the Director changed the words.');
    if (missing)
        log.push(missing + (missing === 1 ? ' line was' : ' lines were') + ' left out by the Director and read as written.');
    return { lines, newSpeakers, log };
}
// What went wrong with a call to the Director, in plain words.
function generationTrouble(e) {
    const raw = String((e && e.message) || e || '').slice(0, 300);
    if (/PERMISSION_DENIED/i.test(raw) || (/permission/i.test(raw) && /generation/i.test(raw)))
        return 'the Generation permission is refused. Grant it to Auto Foley in Lumiverse, under Extensions';
    if (/not found/i.test(raw) && /connection/i.test(raw))
        return 'the connection picked for the Director is gone. Pick another one in the Director tab';
    if (/no (api )?key|api key/i.test(raw))
        return 'the Director\'s connection has no key saved in Lumiverse';
    if (/abort|cancel/i.test(raw))
        return 'the call to the Director was stopped';
    if (/timed? ?out/i.test(raw))
        return 'the Director did not answer in time';
    if (/content filter|refus|declined|blocked/i.test(raw))
        return 'the Director\'s provider refused this message. Try another connection for the Director';
    if (/rate|429/i.test(raw))
        return 'the Director\'s provider is busy (too many requests). Try again in a moment';
    return 'the Director could not be asked: ' + (raw || 'no answer');
}
// ---------------------------------------------------------------------------
// The Decision model
// ---------------------------------------------------------------------------
function hasDecisions() {
    return !!(spindle.decisions && typeof spindle.decisions.evaluate === 'function');
}
// The model's name for the Log: the model id without the maker in front of it.
function who(model) {
    const m = String(model || '').trim();
    if (!m)
        return 'the Decision model';
    return m.slice(m.lastIndexOf('/') + 1).replace(/^~/, '') || m;
}
// What went wrong with a Decision call, in words for the Log and the panel.
// Lumiverse's own message is kept after it, so a provider problem can still
// be read.
function decisionTrouble(e) {
    const raw = String((e && e.message) || e || '').slice(0, 300);
    if (/permission/i.test(raw) && /decision/i.test(raw))
        return 'the Decision models permission is refused. Grant it to Auto Foley in Lumiverse, under Extensions';
    if (/No default Decision connection/i.test(raw))
        return 'there is no default Decision connection. Set one up under Decision models in Lumiverse\'s Connections panel, or pick one under Which Decision connection';
    if (/Decision connection not found/i.test(raw))
        return 'the Decision connection picked is gone. Pick another one under Which Decision connection';
    if (/No readable API key/i.test(raw))
        return 'the Decision connection has no key saved. Add its key under Decision models in Lumiverse\'s Connections panel';
    if (/timed out/i.test(raw))
        return 'the Decision model did not answer within 30 seconds';
    if (/cancel|abort/i.test(raw))
        return 'the call to the Decision model was stopped';
    return 'the Decision model could not be asked: ' + (raw || 'no answer');
}
// The most people offered as choices for one quote. A long list makes every
// choice less likely and the answer less sure.
const MAX_CHOICES = 12;
// How sure the Decision model must be before its pick is used. Below this the
// Director picks the speaker instead.
const SURE = 0.5;
function candidates(cast, text, author) {
    const lower = text.toLowerCase();
    const scored = cast
        .filter((c) => c.kind !== 'narrator' && !c.muted)
        .map((c) => {
        let s = 0;
        const names = [c.name].concat(c.aliases);
        if (names.some((n) => n && lower.indexOf(n.toLowerCase()) >= 0))
            s += 3;
        if (c.name === author)
            s += 2;
        if (c.kind === 'persona')
            s += 1;
        return { c, s };
    })
        .sort((a, b) => b.s - a.s);
    return scored.slice(0, MAX_CHOICES).map((x) => x.c);
}
async function askDecisions(userId, s, segs, author) {
    const out = { speakers: {}, hints: {}, log: [], cost: 0 };
    if (!hasDecisions()) {
        out.log.push('The Decision model was not used: this Lumiverse has no Decision connections for extensions. Update Lumiverse to use it.');
        return out;
    }
    const passage = segs.map((g) => '#' + g.i + ' (' + g.kind + '): ' + g.text).join('\n');
    const people = candidates(s.cast, passage, author);
    const questions = {};
    const speech = segs.filter((g) => g.kind === 'speech');
    if (people.length > 1) {
        const criteria = {};
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
    if (!Object.keys(questions).length)
        return out;
    let got;
    try {
        const input = { state: { passage: passage, author: author }, questions: questions };
        if (s.decisionConnection)
            input.connection_id = s.decisionConnection;
        if (userId)
            input.userId = userId;
        got = await spindle.decisions.evaluate(input);
    }
    catch (e) {
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
        if (!a)
            continue;
        if (key.indexOf('who_') === 0) {
            const i = Number(key.slice(4));
            const choice = String(a.choice || '');
            const conf = Number(a.confidence);
            const k = choice.charAt(0) === 'p' ? Number(choice.slice(1)) : -1;
            if (k >= 0 && people[k] && Number.isFinite(conf) && conf >= SURE) {
                out.speakers[i] = people[k].name;
                picked++;
            }
            else
                unsure++;
        }
        else if (key.indexOf('sound_') === 0) {
            const i = Number(key.slice(6));
            const chance = Number(a.noul);
            if (Number.isFinite(chance))
                out.hints[i] = Math.round(chance * 100) / 100;
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
const scripts = {};
function keepScript(userId, script) {
    const list = scripts[userId] || (scripts[userId] = []);
    const at = list.findIndex((x) => x.key === script.key);
    if (at >= 0)
        list.splice(at, 1);
    list.push({ key: script.key, script });
    while (list.length > SCRIPTS_KEPT)
        list.shift();
}
function keptScript(userId, key) {
    const list = scripts[userId] || [];
    const hit = list.find((x) => x.key === key);
    return hit ? hit.script : null;
}
// A short, stable fingerprint of a text. Not for security: it only tells two
// versions of a message, or two sets of settings, apart.
function hash(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let k = 0; k < text.length; k++) {
        const c = text.charCodeAt(k);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul(h2 + c, 2246822519) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
}
function settingsSig(s) {
    return hash(JSON.stringify([
        s.directorOn, s.directorConnection, s.strength, s.tagsOn, s.breathsOn, s.soundsOn, s.soundStyle, s.narration,
        s.intimateOn, s.findSpeakers, s.bigMoments, s.prompt, s.decisionsOn, s.decisionConnection, s.extraThinkTags,
        s.cast.map((c) => [c.name, c.aliases, c.note, c.muted]),
    ]));
}
// Settings change while a message is being directed. A new NPC is added to
// the copy on disk, not to the copy read before the Director was asked.
async function addSpeakers(userId, found) {
    if (!found.length)
        return [];
    const s = await loadSettings(userId);
    const added = [];
    for (const f of found) {
        if (findMember(s.cast, f.name) || s.cast.length >= MAX_CAST)
            continue;
        const m = narrator();
        m.id = newId();
        m.name = f.name;
        m.kind = 'npc';
        m.addedBy = 'ai';
        m.note = f.about;
        m.gender = f.gender;
        s.cast.push(m);
        added.push(f.name);
    }
    if (added.length)
        await saveSettings(userId, s);
    return added;
}
async function direct(userId, p) {
    const s = await loadSettings(userId);
    const text = str(p.text, 40000);
    const author = str(p.name, 80).trim() || 'Someone';
    const isUser = p.isUser === true;
    const messageId = str(p.messageId, 80);
    const uid = userId || '';
    // The key holds the settings that change a direction, the cast among
    // them, so a changed note or a new person directs the message again.
    const keyFor = (set) => hash([messageId, str(p.swipeId, 8), text, settingsSig(set)].join('\u0001'));
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
    if (!p.fresh) {
        const kept = keptScript(uid, key);
        if (kept)
            return Object.assign({}, kept, { added: [], log: kept.log.concat('Played from the copy directed before.') });
    }
    const segs = splitSegments(text, s.extraThinkTags, await boundPairs(userId));
    const script = {
        key, messageId, author, lines: [], log: [], directed: false, added: authorAdded ? [author] : [], model: '', cost: 0,
    };
    if (!segs.length) {
        script.log.push('This message has nothing to read aloud.');
        return script;
    }
    const rules = {
        tagsOn: s.tagsOn,
        breathsOn: s.breathsOn,
        max: MAX_TAGS[s.strength],
        soundTags: s.soundsOn && s.soundStyle !== 'effects',
        sounds: s.soundsOn,
        effects: s.soundStyle !== 'voice',
        narrationRead: s.narration === 'read',
        findSpeakers: s.findSpeakers,
        bigMoments: s.bigMoments,
    };
    let fixed = {};
    let hints = {};
    if (s.decisionsOn) {
        const d = await askDecisions(userId, s, segs, author);
        fixed = d.speakers;
        hints = d.hints;
        script.log.push(...d.log);
        script.cost += d.cost;
    }
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
    const payload = {
        cast: castForPrompt,
        author: author,
        lines: segs.map((g) => {
            const l = { i: g.i, kind: g.kind, text: g.text };
            if (fixed[g.i])
                l.speaker = fixed[g.i];
            return l;
        }),
        rules: {
            max_tags: MAX_TAGS[s.strength],
            acting: s.strength,
            voice_tags: s.tagsOn,
            breaths_and_laughs: s.breathsOn,
            sounds: s.soundsOn,
            sound_style: s.soundStyle,
            narration_is_read: s.narration === 'read',
            intimate: s.soundsOn && s.intimateOn,
            find_speakers: s.findSpeakers,
            big_moments: s.bigMoments,
        },
    };
    if (Object.keys(hints).length)
        payload.rules.sound_hints = hints;
    let answer = null;
    try {
        const req = {
            messages: [
                { role: 'system', content: s.prompt.trim() || BUILT_IN_PROMPT },
                { role: 'user', content: JSON.stringify(payload) },
            ],
            reasoning: { source: 'off' },
        };
        if (s.directorConnection)
            req.connection_id = s.directorConnection;
        if (userId)
            req.userId = userId;
        const res = await spindle.generate.quiet(req);
        const content = res && typeof res.content === 'string' ? res.content : '';
        const cost = Number(res && res.usage && res.usage.cost);
        if (Number.isFinite(cost))
            script.cost += cost;
        answer = parseJsonObject(content);
        if (!answer) {
            script.log.push(content.trim()
                ? 'The Director answered, but not in the shape asked for, so the message is read as written.'
                : 'The Director sent back nothing, so the message is read as written.');
        }
    }
    catch (e) {
        script.log.push('The message is read as written: ' + generationTrouble(e) + '.');
    }
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
        if (added.length)
            keepScript(uid, Object.assign({}, script, { key: keyFor(await loadSettings(userId)) }));
    }
    return script;
}
// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const SETTINGS_FILE = 'settings.json';
const SOUND_INDEX = 'sounds/index.json';
const KEY_NAME = 'api.elevenlabs.io';
async function readJson(path, userId) {
    try {
        if (!spindle.userStorage || typeof spindle.userStorage.read !== 'function')
            return null;
        const exists = typeof spindle.userStorage.exists === 'function' ? await spindle.userStorage.exists(path, userId) : true;
        if (!exists)
            return null;
        const raw = await spindle.userStorage.read(path, userId);
        return raw ? JSON.parse(raw) : null;
    }
    catch (_) {
        return null;
    }
}
async function writeJson(path, value, userId) {
    try {
        await spindle.userStorage.write(path, JSON.stringify(value), userId);
        return true;
    }
    catch (e) {
        logWarn('could not save ' + path + ': ' + String((e && e.message) || e));
        return false;
    }
}
async function loadSettings(userId) {
    return cleanSettings(await readJson(SETTINGS_FILE, userId));
}
async function saveSettings(userId, s) {
    return writeJson(SETTINGS_FILE, cleanSettings(s), userId);
}
function logWarn(text) {
    try {
        spindle.log.warn(text);
    }
    catch (_) { }
}
// ---------------------------------------------------------------------------
// Base64, written out because the backend has no Buffer or atob it can rely on
// ---------------------------------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes) {
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
    }
    else if (rest === 2) {
        const n = (bytes[k] << 16) | (bytes[k + 1] << 8);
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
    }
    return out;
}
function fromBase64(text) {
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
const MAX_SOUNDS = 400;
// Uploads are kept small: they travel through the extension's message bridge.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
function cleanSoundEntry(e) {
    if (!e || typeof e !== 'object')
        return null;
    const id = str(e.id, 64).replace(/[^a-z0-9_-]/gi, '');
    if (!id)
        return null;
    return {
        id,
        name: str(e.name, 160).trim() || 'Sound',
        triggers: Array.isArray(e.triggers) ? e.triggers.map((t) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
        source: e.source === 'upload' ? 'upload' : 'made',
        mime: /^audio\/[a-z0-9.+-]+$/i.test(String(e.mime)) ? String(e.mime) : 'audio/mpeg',
        bytes: num(e.bytes, 0, 1e9, 0),
        added: num(e.added, 0, 1e15, 0),
        uses: num(e.uses, 0, 1e9, 0),
    };
}
async function loadSounds(userId) {
    const raw = await readJson(SOUND_INDEX, userId);
    const list = raw && Array.isArray(raw.sounds) ? raw.sounds : [];
    return list.map(cleanSoundEntry).filter(Boolean);
}
async function saveSounds(userId, list) {
    return writeJson(SOUND_INDEX, { version: 1, sounds: list.slice(-MAX_SOUNDS) }, userId);
}
// A description in a form two descriptions of the same sound share: lower
// case, no punctuation, no filler words.
const FILLER = /\b(a|an|the|of|on|in|into|onto|against|with|and|some|sound|sounds|noise|softly|loudly|gently|quietly)\b/g;
function soundKey(text) {
    return wordsOf(text).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
}
// The sound in the library that fits a description best: one of your
// triggers, then a sound made from the same description, then one that
// shares most of its words. Uploads come first, so your own clips are used
// before anything new is made.
function matchSound(list, description) {
    const want = soundKey(description);
    if (!want)
        return null;
    const words = want.split(' ');
    const ordered = list.slice().sort((a, b) => (a.source === b.source ? 0 : a.source === 'upload' ? -1 : 1));
    for (const e of ordered) {
        if (e.triggers.some((t) => t && (' ' + want + ' ').indexOf(' ' + soundKey(t) + ' ') >= 0))
            return e;
    }
    for (const e of ordered)
        if (soundKey(e.name) === want)
            return e;
    let best = null;
    let bestScore = 0;
    for (const e of ordered) {
        const theirs = soundKey(e.name).split(' ');
        if (!theirs.length)
            continue;
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
function cleanKey(raw) {
    const k = String(raw == null ? '' : raw).trim();
    if (!k || k.length > 200 || !/^[\x21-\x7e]+$/.test(k))
        return null;
    return k;
}
async function getKey(userId) {
    try {
        if (!spindle.enclave || typeof spindle.enclave.get !== 'function')
            return null;
        return await spindle.enclave.get(KEY_NAME, userId);
    }
    catch (_) {
        return null;
    }
}
function elevenTrouble(status, body) {
    let detail = '';
    try {
        const j = JSON.parse(body);
        const d = j && j.detail;
        detail = typeof d === 'string' ? d : d && typeof d.message === 'string' ? d.message : '';
    }
    catch (_) { }
    const tail = detail ? ' ElevenLabs said: ' + detail.slice(0, 200) : '';
    if (status === 401)
        return 'ElevenLabs refused the key. Check the key in the Sounds tab.' + tail;
    if (status === 403)
        return 'ElevenLabs says this key cannot make sound effects. Check the key has the Sound Effects permission.' + tail;
    if (status === 402)
        return 'The ElevenLabs account has no credits left for sound effects.' + tail;
    if (status === 422)
        return 'ElevenLabs could not use this sound description.' + tail;
    if (status === 429)
        return 'ElevenLabs is busy (too many requests). Try again in a moment.' + tail;
    return 'ElevenLabs answered with an error (' + status + ').' + tail;
}
function corsTrouble(e) {
    const raw = String((e && e.message) || e || '');
    if (/PERMISSION_DENIED|cors_proxy/i.test(raw))
        return 'The CORS proxy permission is refused, so new sounds cannot be made. Grant it to Auto Foley in Lumiverse, under Extensions.';
    if (/only serves audio/i.test(raw))
        return 'ElevenLabs answered with an error instead of a sound. The usual reasons are a refused key, no credits left, or a description ElevenLabs will not make.';
    if (/timed? ?out|timeout/i.test(raw))
        return 'ElevenLabs did not answer within 30 seconds.';
    return 'ElevenLabs could not be reached: ' + raw.slice(0, 200);
}
async function cors(url, opts) {
    if (typeof spindle.cors !== 'function')
        throw new Error('PERMISSION_DENIED: cors_proxy is not available');
    return await spindle.cors(url, opts);
}
// One sound for a description: from the library when one fits, otherwise
// made by ElevenLabs and added to the library, so the same sound is free the
// next time.
async function soundFor(userId, description) {
    const desc = cleanSound(description);
    if (!desc)
        return { error: 'No sound description.' };
    const list = await loadSounds(userId);
    const hit = matchSound(list, desc);
    if (hit) {
        try {
            const bytes = await spindle.userStorage.readBinary('sounds/' + hit.id, userId);
            hit.uses++;
            await saveSounds(userId, list);
            return { id: hit.id, base64: toBase64(bytes), mime: hit.mime, name: hit.name };
        }
        catch (_) {
            // The file is gone while its entry stayed. The entry goes, and a new
            // sound is made below.
            list.splice(list.indexOf(hit), 1);
            await saveSounds(userId, list);
        }
    }
    const s = await loadSettings(userId);
    if (!s.makeSounds)
        return { error: 'No sound in your library fits "' + desc + '", and making new sounds is off.' };
    const key = await getKey(userId);
    if (!key)
        return { error: 'No sound in your library fits "' + desc + '". Save an ElevenLabs key in the Sounds tab to make new ones.' };
    const body = { text: desc, prompt_influence: 0.4 };
    if (s.soundSeconds >= 0.5)
        body.duration_seconds = s.soundSeconds;
    let res;
    try {
        res = await cors('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': key, Accept: 'audio/mpeg' },
            body: JSON.stringify(body),
            responseType: 'arraybuffer',
            mediaType: 'audio',
        });
    }
    catch (e) {
        return { error: corsTrouble(e) };
    }
    const status = Number(res && res.status);
    if (!res || status < 200 || status >= 300)
        return { error: elevenTrouble(status, String((res && res.body) || '')) };
    const b64 = String(res.body || '');
    const bytes = fromBase64(b64);
    if (bytes.length < 64)
        return { error: 'ElevenLabs sent back an empty sound.' };
    const entry = {
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
    }
    catch (e) {
        logWarn('could not keep a made sound: ' + String((e && e.message) || e));
    }
    return { id: entry.id, base64: b64, mime: entry.mime, name: entry.name, made: true };
}
async function testKey(userId) {
    const key = await getKey(userId);
    if (!key)
        return { ok: false, text: 'No key is saved.' };
    let res;
    try {
        res = await cors('https://api.elevenlabs.io/v1/user/subscription', {
            method: 'GET',
            headers: { 'xi-api-key': key, Accept: 'application/json' },
        });
    }
    catch (e) {
        return { ok: false, text: corsTrouble(e) };
    }
    const status = Number(res && res.status);
    if (status >= 200 && status < 300) {
        let left = '';
        try {
            const j = JSON.parse(String(res.body || ''));
            const used = Number(j.character_count);
            const limit = Number(j.character_limit);
            if (Number.isFinite(used) && Number.isFinite(limit))
                left = ' ' + Math.max(0, limit - used).toLocaleString('en-US') + ' credits are left this month.';
        }
        catch (_) { }
        return { ok: true, text: 'The key works.' + left };
    }
    return { ok: false, text: elevenTrouble(status, String((res && res.body) || '')) };
}
// ---------------------------------------------------------------------------
// The panel's messages
// ---------------------------------------------------------------------------
function send(userId, msg) {
    try {
        spindle.sendToFrontend(msg, userId);
    }
    catch (e) {
        logWarn('could not answer the panel: ' + String((e && e.message) || e));
    }
}
function notify(kind, text, userId) {
    const k = ['success', 'info', 'warning', 'error'].indexOf(kind) >= 0 ? kind : 'info';
    const words = String(text || '').trim().slice(0, 500);
    if (!words)
        return;
    try {
        if (!spindle.toast || typeof spindle.toast[k] !== 'function')
            return;
        spindle.toast[k](words, userId ? { userId } : undefined);
    }
    catch (_) { }
}
async function listConnections(userId) {
    try {
        const all = await spindle.connections.list(userId);
        const list = (Array.isArray(all) ? all : []).map((c) => ({
            id: str(c && c.id, 80),
            name: str(c && c.name, 120),
            model: str(c && c.model, 120),
            provider: str(c && c.provider, 60),
            isDefault: !!(c && c.is_default),
        }));
        return { list };
    }
    catch (e) {
        return { list: [], why: generationTrouble(e) };
    }
}
async function listDecisionConnections(userId) {
    if (!hasDecisions())
        return { list: [], state: 'old', why: 'This Lumiverse has no Decision connections for extensions. Update Lumiverse to use them.' };
    try {
        const all = await spindle.decisions.listConnections(userId ? { userId } : undefined);
        const list = (Array.isArray(all) ? all : []).map((c) => ({
            id: str(c && c.id, 80),
            name: str(c && c.name, 120),
            model: who(str(c && c.model, 120)),
            isDefault: !!(c && c.is_default),
            hasKey: !!(c && c.has_api_key),
        }));
        return { list, state: list.length ? 'ok' : 'none' };
    }
    catch (e) {
        return { list: [], state: 'error', why: decisionTrouble(e) };
    }
}
async function onPanel(p, userId) {
    if (!p || typeof p !== 'object')
        return;
    const type = String(p.type || '');
    const requestId = str(p.requestId, 80);
    const answer = (msg) => send(userId, Object.assign({ requestId }, msg));
    try {
        switch (type) {
            case 'load': {
                const settings = await loadSettings(userId);
                const sounds = await loadSounds(userId);
                let hasKey = false;
                try {
                    hasKey = !!(spindle.enclave && typeof spindle.enclave.has === 'function' && (await spindle.enclave.has(KEY_NAME, userId)));
                }
                catch (_) { }
                answer({ type: 'state', settings, sounds, hasKey, builtInPrompt: BUILT_IN_PROMPT, version: VERSION, decisions: hasDecisions() });
                return;
            }
            case 'save': {
                const clean = cleanSettings(p.settings);
                const ok = await saveSettings(userId, clean);
                answer({ type: 'saved', ok, settings: clean });
                if (!ok)
                    notify('warning', 'Your Auto Foley settings could not be saved. They will be lost when the page reloads.', userId);
                return;
            }
            case 'direct': {
                const script = await direct(userId, p);
                answer({ type: 'script', script });
                if (script.added.length)
                    answer({ type: 'state_changed', settings: await loadSettings(userId) });
                return;
            }
            case 'sound': {
                const got = await soundFor(userId, str(p.description, 200));
                answer(Object.assign({ type: 'sound' }, got));
                if (got.made)
                    answer({ type: 'sounds', sounds: await loadSounds(userId) });
                return;
            }
            case 'sound_play': {
                const id = str(p.id, 64).replace(/[^a-z0-9_-]/gi, '');
                const list = await loadSounds(userId);
                const e = list.find((x) => x.id === id);
                if (!e)
                    return answer({ type: 'sound', error: 'That sound is no longer in the library.' });
                try {
                    const bytes = await spindle.userStorage.readBinary('sounds/' + e.id, userId);
                    return answer({ type: 'sound', id: e.id, base64: toBase64(bytes), mime: e.mime, name: e.name });
                }
                catch (_) {
                    return answer({ type: 'sound', error: 'The file for this sound could not be read.' });
                }
            }
            case 'sound_upload': {
                const bytes = fromBase64(str(p.base64, MAX_UPLOAD_BYTES * 2));
                const mime = /^audio\/[a-z0-9.+-]+$/i.test(String(p.mime)) ? String(p.mime) : '';
                if (!mime)
                    return answer({ type: 'uploaded', ok: false, error: 'That file is not a sound Auto Foley can play. Use MP3, WAV, OGG or M4A.' });
                if (!bytes.length)
                    return answer({ type: 'uploaded', ok: false, error: 'That file is empty.' });
                if (bytes.length > MAX_UPLOAD_BYTES)
                    return answer({ type: 'uploaded', ok: false, error: 'That file is larger than 3 MB. Use a shorter or smaller clip.' });
                const list = await loadSounds(userId);
                if (list.length >= MAX_SOUNDS)
                    return answer({ type: 'uploaded', ok: false, error: 'The library is full (' + MAX_SOUNDS + ' sounds). Delete some first.' });
                const entry = {
                    id: 'u' + newId(),
                    name: str(p.name, 160).replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_-]+/g, ' ').trim() || 'My sound',
                    triggers: Array.isArray(p.triggers) ? p.triggers.map((t) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
                    source: 'upload',
                    mime,
                    bytes: bytes.length,
                    added: Date.now(),
                    uses: 0,
                };
                try {
                    await spindle.userStorage.writeBinary('sounds/' + entry.id, bytes, userId);
                }
                catch (e) {
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
                if (!e)
                    return answer({ type: 'sounds', sounds: list });
                if (typeof p.name === 'string')
                    e.name = str(p.name, 160).trim() || e.name;
                if (Array.isArray(p.triggers))
                    e.triggers = p.triggers.map((t) => str(t, 40).trim().toLowerCase()).filter(Boolean).slice(0, 12);
                const ok = await saveSounds(userId, list);
                if (!ok)
                    notify('warning', 'The change to this sound could not be saved.', userId);
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
                    }
                    catch (_) { }
                    const ok = await saveSounds(userId, list);
                    if (!ok)
                        notify('warning', 'The sound could not be removed from the library.', userId);
                }
                answer({ type: 'sounds', sounds: list });
                return;
            }
            case 'key_save': {
                const key = cleanKey(p.key);
                if (!key)
                    return answer({ type: 'key', hasKey: false, text: 'That does not look like an ElevenLabs key. Paste it again, with no spaces or line breaks.' });
                try {
                    await spindle.enclave.put(KEY_NAME, key, userId);
                }
                catch (e) {
                    return answer({ type: 'key', hasKey: false, text: 'The key could not be saved: ' + String((e && e.message) || e).slice(0, 200) });
                }
                const t = await testKey(userId);
                answer({ type: 'key', hasKey: true, ok: t.ok, text: t.text });
                return;
            }
            case 'key_forget': {
                try {
                    await spindle.enclave.delete(KEY_NAME, userId);
                }
                catch (e) {
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
                    const req = {
                        messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
                        reasoning: { source: 'off' },
                    };
                    if (s.directorConnection)
                        req.connection_id = s.directorConnection;
                    if (userId)
                        req.userId = userId;
                    const res = await spindle.generate.quiet(req);
                    const got = res && typeof res.content === 'string' ? res.content.trim() : '';
                    answer({ type: 'check', part: 'director', ok: !!got, text: got ? 'The Director answered.' : 'The Director sent back nothing.' });
                }
                catch (e) {
                    answer({ type: 'check', part: 'director', ok: false, text: 'The Director could not be asked: ' + generationTrouble(e) + '.' });
                }
                return;
            }
            case 'check_decisions': {
                const d = await listDecisionConnections(userId);
                const s = await loadSettings(userId);
                let ok = false;
                let text = '';
                if (d.state === 'old' || d.state === 'error')
                    text = d.why || 'Decision connections could not be read.';
                else if (!d.list.length)
                    text = 'There are no Decision connections. Set one up under Decision models in Lumiverse\'s Connections panel.';
                else {
                    const c = s.decisionConnection ? d.list.find((x) => x.id === s.decisionConnection) : d.list.find((x) => x.isDefault);
                    if (!c)
                        text = s.decisionConnection ? 'The Decision connection picked is gone. Pick another one in the Director tab.' : 'None of your Decision connections is the default. Pick one in the Director tab.';
                    else if (!c.hasKey)
                        text = 'The Decision connection "' + c.name + '" has no key saved.';
                    else {
                        ok = true;
                        text = 'The Decision connection "' + c.name + '" (' + c.model + ') is ready.';
                    }
                }
                answer({ type: 'check', part: 'decisions', ok, text });
                return;
            }
            case 'notify': {
                notify(str(p.kind, 10), str(p.text, 500), userId);
                return;
            }
            default:
                return;
        }
    }
    catch (e) {
        logWarn('panel request ' + type + ' failed: ' + String((e && e.message) || e));
        answer({ type: 'failed', of: type, error: 'Something went wrong in Auto Foley\'s backend: ' + String((e && e.message) || e).slice(0, 200) });
    }
}
try {
    // The promise is returned so a caller that waits can see the work finish.
    // onPanel catches its own errors, so it never rejects.
    spindle.onFrontendMessage((payload, userId) => onPanel(payload, userId));
}
catch (e) {
    logWarn('could not listen to the panel: ' + String((e && e.message) || e));
}
try {
    spindle.log.info('Auto Foley ' + VERSION + ' loaded.');
}
catch (_) { }
