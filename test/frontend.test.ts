// The panel's pure parts: which models take tags, how stability is set, and
// how a line is drawn.
import { expect, test, describe } from "bun:test";
import { __testing } from "../src/frontend";

const { takesTags, stripTags, stabilityFor, lineHtml } = __testing;

describe("models and tags", () => {
  test("only Eleven v3 and v4 take voice tags", () => {
    expect(takesTags("eleven_v3")).toBe(true);
    expect(takesTags("eleven_v4")).toBe(true);
    expect(takesTags("eleven_v4_turbo")).toBe(true);
    expect(takesTags("eleven_multilingual_v2")).toBe(false);
    expect(takesTags("eleven_flash_v2_5")).toBe(false);
    expect(takesTags("")).toBe(false);
  });

  test("tags come out cleanly for a model that would read them aloud", () => {
    expect(stripTags("[quietly] Leave it, [sighs] please.")).toBe("Leave it, please.");
    expect(stripTags('Go. [sound of a door, someone yelling "wait"]')).toBe("Go.");
  });
});

describe("stability", () => {
  test("Eleven v3 snaps to Creative, Natural or Robust", () => {
    expect(stabilityFor("eleven_v3", 0.3, false)).toBe(0.5);
    expect(stabilityFor("eleven_v3", 0.2, false)).toBe(0);
    expect(stabilityFor("eleven_v3", 0.8, false)).toBe(1);
  });

  test("a big moment on v3 goes one step looser, and Creative stays Creative", () => {
    expect(stabilityFor("eleven_v3", 1, true)).toBe(0.5);
    expect(stabilityFor("eleven_v3", 0, true)).toBe(0);
  });

  test("a big moment on v4 loosens the voice, down to 0.1", () => {
    expect(stabilityFor("eleven_v4", 0.5, true)).toBe(0.25);
    expect(stabilityFor("eleven_v4", 0.2, true)).toBe(0.1);
    expect(stabilityFor("eleven_v4", 0.5, false)).toBe(0.5);
  });
});

describe("drawing a line", () => {
  test("voice tags and sound tags are drawn as different chips", () => {
    const html = lineHtml("[softly] Hush. [sound of rain]");
    expect(html).toContain('<span class="af-chip af-chip-tag">softly</span>');
    expect(html).toContain('<span class="af-chip af-chip-insound">sound of rain</span>');
  });

  test("text from a message is escaped", () => {
    expect(lineHtml('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });
});
