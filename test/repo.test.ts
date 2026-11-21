// Things about the repository that nobody can check by reading one diff: that
// the version is the same everywhere, that every permission is used, that the
// docs link to pages and headings that exist, and that the writing rules hold
// in every file a reader sees.
import { test, expect, describe } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import vm from "node:vm";

const root = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const DOCS = ["README.md", "CHANGELOG.md", "SECURITY.md", ...readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => "docs/" + f)];
const CODE = ["src/backend.ts", "src/frontend.ts"];

describe("version", () => {
  const manifest = JSON.parse(read("spindle.json")).version;
  const grab = (p: string) => (read(p).match(/const VERSION = '([^']+)'/) || [])[1];

  test("spindle.json, package.json and the four VERSION constants agree", () => {
    expect(JSON.parse(read("package.json")).version).toBe(manifest);
    for (const p of ["src/frontend.ts", "src/backend.ts", "dist/frontend.js", "dist/backend.js"]) expect(grab(p)).toBe(manifest);
  });

  test("the changelog has an entry for it", () => {
    expect(read("CHANGELOG.md")).toMatch(new RegExp("\\n## " + manifest.replace(/\./g, "\\.") + " "));
  });
});

describe("the permissions it asks for", () => {
  const asked: string[] = JSON.parse(read("spindle.json")).permissions || [];
  const SRC = read("src/backend.ts") + read("src/frontend.ts");
  // permission -> what using it looks like. A permission with no entry fails,
  // so adding one means saying here what it is for.
  const EARNS: Record<string, RegExp> = {
    generation: /spindle\.generate\.quiet\(/,
    decisions: /spindle\.decisions\.evaluate\(/,
    cors_proxy: /spindle\.cors\(/,
    ui_panels: /ui\.createFloatWidget\(/,
  };

  test("every one is used by the code", () => {
    expect(asked.filter((p) => !EARNS[p] || !EARNS[p].test(SRC))).toEqual([]);
  });

  test("and nothing is used that was not asked for", () => {
    expect(Object.keys(EARNS).filter((p) => EARNS[p].test(SRC) && asked.indexOf(p) < 0)).toEqual([]);
  });

  test("the privacy page lists each one", () => {
    const page = read("docs/privacy.md");
    const names: Record<string, string> = { generation: "Generation", decisions: "Decision models", cors_proxy: "CORS proxy", ui_panels: "UI panels" };
    for (const p of asked) expect(page).toContain("| " + names[p] + " |");
  });
});

describe("installing runs nothing", () => {
  test("package.json has no install scripts", () => {
    const scripts = JSON.parse(read("package.json")).scripts || {};
    for (const k of ["preinstall", "install", "postinstall", "prepare"]) expect(scripts[k]).toBeUndefined();
  });
});

// Code blocks and quoted prompt text are left out of the prose checks: they
// show what a model reads or writes, which has its own rules.
function prose(md: string): string {
  return md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "").replace(/^>.*$/gm, "");
}

describe("the writing rules", () => {
  test("no em dash, and no en dash used as one", () => {
    const hits: string[] = [];
    for (const f of [...DOCS, ...CODE, "spindle.json", "package.json", "CLAUDE.md"]) {
      if (/[—–]/.test(read(f))) hits.push(f);
    }
    expect(hits).toEqual([]);
  });

  test("American spelling", () => {
    // aria-labelledby is a fixed HTML name, spelled that way everywhere.
    const british = /\b(colour|grey|behaviour|recognis\w*|cancelled|(?<!aria-)labelled|centre|favourite|organis\w*|realis(e|ed|es|ing|ation)\b|analys(e|ing)|licence|judgement|travell\w*)/i;
    const hits = [...DOCS, ...CODE, "CLAUDE.md"].filter((f) => british.test(read(f)));
    expect(hits).toEqual([]);
  });

  test("never the word ship", () => {
    const hits = [...DOCS, ...CODE, "spindle.json", "package.json"].filter((f) => /\bship(s|ped|ping)?\b/i.test(read(f)));
    expect(hits).toEqual([]);
  });

  test("no contractions in the docs", () => {
    const hits: string[] = [];
    for (const f of DOCS) {
      const m = prose(read(f)).match(/\b[A-Za-z]+(n't|'re|'ll|'ve|'d|'m)\b|\b(it's|that's|there's|what's|here's|let's)\b/i);
      if (m) hits.push(f + ": " + m[0]);
    }
    expect(hits).toEqual([]);
  });

  test("no contractions in the text the panel shows", () => {
    // Text in quotes in the panel's code. The built-in prompt lives in the
    // backend and has its own voice, so only the frontend is read.
    const src = read("src/frontend.ts");
    const strings = [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((t) => /\s/.test(t));
    const hits = strings.filter((t) => /\b[A-Za-z]+\\'(t|re|ll|ve|d|m)\b/.test(t));
    expect(hits).toEqual([]);
  });
});

describe("links in the docs", () => {
  const slug = (h: string) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} -]/gu, "").replace(/ /g, "-");

  test("every relative link and anchor resolves", () => {
    const broken: string[] = [];
    for (const f of [...DOCS]) {
      const text = read(f);
      for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const href = m[1];
        if (/^(https?:|mailto:)/.test(href)) continue;
        const [path, anchor] = href.split("#");
        const target = path ? join(dirname(join(root, f)), path) : join(root, f);
        if (!existsSync(target)) {
          broken.push(f + " -> " + href);
          continue;
        }
        if (anchor && target.endsWith(".md")) {
          const heads = readFileSync(target, "utf8").split("\n").filter((l) => /^#{1,6} /.test(l)).map((l) => slug(l.replace(/^#+ /, "")));
          if (heads.indexOf(anchor) < 0) broken.push(f + " -> " + href);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  test("the README lists the docs in three groups", () => {
    const r = read("README.md");
    for (const g of ["**Start here**", "**Going further**", "**About it**"]) expect(r).toContain(g);
    for (const f of readdirSync(join(root, "docs")).filter((x) => x.endsWith(".md"))) expect(r).toContain("docs/" + f);
  });
});

describe("the paragraph about adults", () => {
  test("the docs quote it word for word from the built-in prompt", () => {
    const box: any = { spindle: { onFrontendMessage() {}, log: { info() {} } }, console, Date, Math, JSON, Promise };
    vm.createContext(box);
    vm.runInContext(read("dist/backend.js") + "\n;globalThis.__prompt = BUILT_IN_PROMPT;", box);
    const para = String(box.__prompt).split("\n").find((l: string) => l.startsWith("Sex scenes are between adults"));
    expect(para).toBeTruthy();
    expect(read("docs/director.md")).toContain("> " + para);
  });
});
