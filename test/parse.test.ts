// The files Lumiverse loads must parse on every engine it runs in. A syntax
// error is worse than any runtime error: the engine rejects the whole file
// and nothing in it runs to say so. The panel would simply never appear.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
// Comments go first, so a pattern written about in a comment is not counted.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("dist/backend.js parses as a plain script", () => {
  expect(() => new vm.Script(read("dist/backend.js"))).not.toThrow();
});

test("dist/frontend.js parses", () => {
  expect(() => new vm.Script(read("dist/frontend.js").replace(/^export /gm, ""))).not.toThrow();
});

test("the backend has no import or export, so it loads as a plain script", () => {
  expect(/^\s*(import|export)\s/m.test(code(read("dist/backend.js")))).toBe(false);
});

test("no regex lookbehind, which older Safari cannot parse", () => {
  for (const f of ["dist/backend.js", "dist/frontend.js"]) expect(code(read(f)).includes("(?<")).toBe(false);
});
