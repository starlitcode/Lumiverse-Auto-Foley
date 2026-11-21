// The built-in cheer inside the panel is the file in assets, byte for byte.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("APPLAUSE_MP3 is assets/applause.mp3", () => {
  const src = readFileSync(new URL("../src/frontend.ts", import.meta.url), "utf8");
  const inCode = (src.match(/const APPLAUSE_MP3 = '([^']*)';/) || [])[1];
  const file = readFileSync(new URL("../assets/applause.mp3", import.meta.url)).toString("base64");
  expect(inCode).toBe(file);
  expect(file.length).toBeGreaterThan(1000);
});
