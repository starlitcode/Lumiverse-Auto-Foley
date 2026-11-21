// Writes assets/applause.mp3 into src/frontend.ts as APPLAUSE_MP3, so the
// built-in cheer travels inside dist/frontend.js and needs no file of its own.
//   bun scripts/embed-applause.ts && bun run build
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const b64 = readFileSync(join(root, "assets", "applause.mp3")).toString("base64");
const file = join(root, "src", "frontend.ts");
const src = readFileSync(file, "utf8");
const next = src.replace(/const APPLAUSE_MP3 = '[^']*';/, "const APPLAUSE_MP3 = '" + b64 + "';");
if (next === src && !src.includes(b64)) throw new Error("APPLAUSE_MP3 was not found in src/frontend.ts");
writeFileSync(file, next);
console.log("Wrote " + b64.length + " characters of applause into src/frontend.ts.");
